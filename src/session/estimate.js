/**
 * How much work is a session, and what will it buy?
 *
 * A Pomodoro session needs a goal that is set before the first item and is the
 * right size — big enough that finishing it means something, small enough that
 * a fifteen-year-old finishes it inside twenty minutes. The tempting way to do
 * that is a constant: "three rifts". It is also wrong, because three rifts is
 * four minutes for one learner and fifty for another, and the second learner is
 * the one this whole game exists for.
 *
 * So nothing here is a number somebody chose. The plan is produced by **running
 * the real mastery engine forward** against this learner's own measured pace:
 *
 *   1. `pace` (pace.js) says how much longer or shorter than the engine's own
 *      `itemSeconds()` model this learner takes, and how often they get one
 *      right. Both are measured in play and persisted.
 *   2. That fixes a budget in *seconds*, not in items — because twenty minutes
 *      of graph-reading and twenty minutes of bare symbolic practice are not
 *      the same number of items, and the scheduler already knows the difference.
 *   3. A fork of the live `MasteryEngine` — same graph, same saved state, same
 *      scheduler, same placement, same sight-read probe, same worked-example
 *      fading, same proving run — is then played until the budget is spent, by
 *      a synthetic learner who answers at the measured accuracy adjusted for
 *      how far above their own band each item sits. Twenty-one such trials are
 *      run and the median is taken.
 *   4. What the median trial *did* is the goal: this many tears closed, on
 *      these lines, and — only where the engine holds a line in four trials out
 *      of five — a promise that a line will actually close.
 *
 * The consequence is the property that matters: a learner who is finding this
 * hard is handed a smaller goal, not a longer session, and is never shown a
 * target that the engine's own model says they cannot reach. Nothing is being
 * lowered for them — the mastery bar is untouched — but the *shape of the
 * afternoon* is theirs rather than the median's.
 *
 * Cost: ~21 × 35 = 750 `observe` calls on a ten-node graph, a few milliseconds,
 * run twice a session (once when it is planned, once when it closes).
 */
import { MasteryEngine, itemSeconds } from '../learn/mastery.js';
import { FORMS_BY_SKILL } from '../learn/generators.js';

/** The window the whole loop is designed around. Minutes. */
export const SESSION_MIN = 15;
export const SESSION_TARGET = 20;
export const SESSION_MAX = 25;

/** A line is promised only where the engine closes it in four trials out of five.
 *  Measured against an independent learner model (tools/session-length.mjs) that
 *  threshold keeps two thirds of promises; 0.65 kept barely half, and a promise
 *  a learner cannot rely on is worse than no promise at all. */
const PROMISE_AT = 0.8;
/** …and named on the orders at all only if it is worked in most trials. */
const NAME_AT = 0.5;
const TRIALS = 21;

/** Deterministic RNG, so the same learner state always plans the same run. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const median = (xs) => quantile(xs, 0.5);
function quantile(xs, q) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.max(0, Math.min(a.length - 1, Math.floor(q * (a.length - 1))))];
}

/**
 * The goal is set at the 35th percentile of what the projection achieves, not
 * at the median.
 *
 * A median goal is one a learner misses half the time, and a run that ends on
 * "enough for today" half the time is a run whose promise means nothing. It is
 * also the wrong side to err on: the cost of finishing early is one button —
 * ONE MORE LINE — and the cost of finishing late is a fifteen-year-old being
 * told, twice a week, that they did not get there. Measured end to end against
 * an independent learner model (tools/session-length.mjs, 1600 runs), moving
 * the goal from the median to the 35th percentile takes the share of runs that
 * reach their goal before the twenty-five-minute cap from 78% to 81% and costs
 * the median run about a minute.
 */
const GOAL_Q = 0.35;

/** A JSON freeze of the live learner model, cheap to fork from. */
export function snapshot(mastery) {
  return JSON.stringify(mastery.save());
}

/**
 * What are the odds this learner gets *this* item?
 *
 * A flat "answers 72% of everything" learner is not a learner, it is a coin,
 * and it breaks the projection in exactly the place that matters: the engine
 * opens every cold skill with a sight-read probe at band four, so a coin tests
 * out of the whole shard in twenty items and the plan promises a beginner six
 * lines they will not get. Two corrections, and neither of them is a number
 * somebody liked the look of:
 *
 *   · BAND. `pace.accuracy` is what this learner scores on the items the engine
 *     has been serving them, which sit at the band the engine believes they are
 *     on. An item one band above that costs 0.15 of probability: the shipping
 *     bank's measured demand (`generators.demandOf`, as mapped in
 *     tools/simulate.mjs) rises 0.155 per band on the competence scale, and the
 *     logistic that file turns competence into a response with — sharpness 6 —
 *     has slope 6·p(1−p) ≈ 0.96 near four in five. 0.155 × 0.96 ≈ 0.15.
 *   · SUPPORT. A worked example on the card is worth about 0.12 and a
 *     completion problem about half that: the same two constants, same scale.
 *
 * The result is a probe that only a learner who really is at band four passes
 * three times running, which is what makes the two-minute test-out appear in
 * the plan as an opportunity rather than as a promise.
 */
const BAND_SLOPE = 0.15;
const SUPPORT = { full: 0.12, partial: 0.06, none: 0 };

function pCorrect(m, task, accuracy) {
  const band = m.get(task.skill)?.difficulty ?? 1;
  const p = accuracy
    + BAND_SLOPE * (band - task.difficulty)
    + (SUPPORT[task.scaffold] || 0);
  return Math.max(0.1, Math.min(0.97, p));
}

/**
 * One synthetic item. The task comes from the real scheduler, the form comes
 * from the real bank, the cost comes from the engine's own `itemSeconds`, and
 * the only thing invented here is whether the learner got it right.
 *
 * Passing the form's representation and one of its situations through is not
 * decoration: the proving run refuses to close until it has spanned two
 * representations and asked once for the walk between a situation and the
 * algebra, so a projection that fed it bare booleans would predict a gate two
 * items shorter than the one the learner will actually meet.
 */
function play(m, id, rand, accuracy, factor, force) {
  const task = m.taskFor(id);
  if (!task) return null;
  const forms = FORMS_BY_SKILL[task.skill] || [];
  const cand = task.formCandidates?.length
    ? forms.filter((f) => task.formCandidates.includes(f.id))
    : forms;
  const pool = cand.length ? cand : forms;
  const f = pool.length ? pool[(rand() * pool.length) | 0] : null;
  const keys = f?.sceneKeys || [];
  const seconds = itemSeconds({
    rep: f?.rep, difficulty: task.difficulty, scaffold: task.scaffold,
  }) * factor;
  const correct = force === undefined ? rand() < pCorrect(m, task, accuracy) : force;
  const res = m.observe(task.skill, correct, {
    assisted: task.scaffold !== 'none',
    kind: task.kind,
    form: f?.id,
    rep: f?.rep,
    scene: keys.length ? keys[(rand() * keys.length) | 0] : undefined,
  });
  return { skill: task.skill, correct, res, seconds };
}

/**
 * Play one whole session forward, in seconds.
 * @returns {{tears:number, items:number, seconds:number,
 *            held:Array<{id:string,at:number}>, touched:string[], complete:boolean}}
 */
function trial(graph, saved, budget, accuracy, factor, seed) {
  const m = new MasteryEngine(graph, JSON.parse(saved));
  const rand = rng(seed);
  const held = [];
  const touched = [];
  let tears = 0;
  let items = 0;
  let seconds = 0;
  let complete = false;
  while (seconds < budget && items < 400) {
    const objective = m.next();
    if (!objective) { complete = true; break; }
    const turn = play(m, objective.id, rand, accuracy, factor);
    if (!turn) break;
    items++;
    seconds += turn.seconds;
    if (!touched.includes(turn.skill)) touched.push(turn.skill);
    if (turn.correct) tears++;
    // Where on the band a line is expected to close, in tears — which is what
    // lets the ladder mark be drawn before the learner reaches it.
    if (turn.res?.justMastered) held.push({ id: turn.skill, at: tears });
    // endgame (one condition, additive — src/kit, src/learn): stop early only
    // when *this run* finished the lattice. A learner who sits down already
    // holding all ten lines used to fall out of the projection on item one, so
    // the orders card offered "0 of 1 tear" and the band had nothing to draw:
    // the engine still has a session's work for them — the re-probes that have
    // fallen due, and the sounding — and the plan is entitled to project it.
    if (m.integrity() >= 0.999 && held.length) { complete = true; break; }
  }
  return { tears, items, seconds, held, touched, complete };
}

/**
 * The plan for one session.
 *
 * @param {MasteryEngine} mastery the live model — never mutated
 * @param {{factor:number, accuracy:number, seeded:boolean}} pace
 * @param {{minutes?:number, seed?:number}} [opts]
 */
export function planRun(mastery, pace, opts = {}) {
  const minutes = opts.minutes ?? SESSION_TARGET;
  const budget = minutes * 60;
  const saved = snapshot(mastery);
  const seed = (opts.seed ?? 0x5eed) >>> 0;
  const factor = pace.factor ?? 1;

  const runs = [];
  for (let i = 0; i < TRIALS; i++) {
    runs.push(trial(mastery.graph, saved, budget, pace.accuracy, factor, seed + i * 7919));
  }

  // How often each line was worked, how often it actually closed, and where.
  const worked = new Map();
  const closed = new Map();
  const where = new Map();
  const order = [];
  for (const r of runs) {
    for (const id of r.touched) {
      if (!order.includes(id)) order.push(id);
      worked.set(id, (worked.get(id) || 0) + 1);
    }
    const first = new Map();
    for (const h of r.held) if (!first.has(h.id)) first.set(h.id, h.at);
    for (const [id, at] of first) {
      closed.set(id, (closed.get(id) || 0) + 1);
      if (!where.has(id)) where.set(id, []);
      where.get(id).push(at);
    }
  }

  const seams = order
    .filter((id) => (worked.get(id) || 0) / TRIALS >= NAME_AT)
    .map((id) => ({
      id,
      hold: (closed.get(id) || 0) / TRIALS >= PROMISE_AT,
      confidence: (closed.get(id) || 0) / TRIALS,
      at: where.has(id) ? median(where.get(id)) : null,
    }));

  // A run that would run out of shard is short by exactly that much.
  const complete = runs.filter((r) => r.complete).length > TRIALS / 2;
  const seconds = complete ? median(runs.map((r) => r.seconds)) : budget;
  const tears = Math.max(1, quantile(runs.map((r) => r.tears), GOAL_Q));

  // --- WHAT THE RUN WILL ACTUALLY COST, AS A RANGE -------------------------
  // The orders card promised "seal 16 rifts" while this projection had planned
  // 24 items, and a cold reader called that quoting a player two thirds of the
  // real workload. Both numbers were right and they are not the same number: a
  // rift is a question ANSWERED CORRECTLY, and nobody answers everything
  // correctly, so the goal in tears is always smaller than the questions it
  // takes to reach it. Nothing on the card said so, and a number a learner
  // reads as "how much work is this" had better be about how much work it is.
  //
  // So the plan now carries the work as well as the goal, and carries it as a
  // range, because that is what twenty-one trials actually produce. The card
  // states it out loud, the band draws its work read against the same middle
  // figure, and `run.overrun` in src/session/index.js says so once when a run
  // goes past the top of it. A single number here would be a promise the
  // projection cannot make; a range is one it can.
  const allItems = runs.map((r) => r.items).sort((a, b) => a - b);
  const itemsMid = quantile(allItems, 0.5);
  const itemsLow = Math.min(itemsMid, quantile(allItems, 0.2));
  const itemsHigh = Math.max(itemsMid, quantile(allItems, 0.8));
  return {
    tears,
    items: itemsMid,
    // The workload the card quotes. Never below the goal itself: a run cannot
    // seal sixteen rifts in fourteen questions, and a range that said it could
    // would be a worse lie than the one it replaced.
    itemsLow: Math.max(tears, itemsLow),
    itemsHigh: Math.max(tears, itemsHigh),
    minutes: Math.max(1, Math.round(seconds / 60)),
    seams: seams.length ? seams : fallbackSeam(mastery),
    promised: seams.filter((s) => s.hold).map((s) => s.id),
    complete,
  };
}

/** The engine had nothing to say — take whatever it would point at right now. */
function fallbackSeam(mastery) {
  const next = mastery.next();
  return next ? [{ id: next.id, hold: false, confidence: 0, at: null }] : [];
}

/**
 * How much further is this one line from holding?
 *
 * This number is load-bearing in a way the goal is not. The goal is stated once
 * and then lives on the band; *this* is the number the close beat's honesty
 * rests on — "down to four tears from holding, two closer than when the run
 * opened" — and a learner reads it twice a session, twenty minutes apart.
 *
 * It used to be the median of nine Monte-Carlo trials of a coin-flipping
 * learner, and that made it useless. Measured on the shipping engine, one
 * correct answer moved it from 17 to 2 and ten misses moved it from 17 to 35:
 * both of those are inside the sampling noise of a nine-trial median whose
 * per-trial spread is the whole road, so the ledger the close beat is most
 * proud of was reporting mostly dice. A number that jumps fifteen on one answer
 * is not a distance, and a learner cannot tell it apart from a lie.
 *
 * So the question is asked differently, and the new question has one answer
 * rather than a distribution: **what is the shortest road from here?** The live
 * model is forked and played forward by a learner who gets everything right,
 * through the real scheduler, the real credit ladder, the real proving run and
 * the real interleaving, until the line closes. That is a floor, not a forecast,
 * and it has the three properties the beat needs:
 *
 *   · it is deterministic — the same learner state always gives the same number,
 *     so two readings twenty minutes apart are comparable;
 *   · it moves by one per clean tear, because a clean tear is exactly one step
 *     of the shortest road. Nothing else in this game gives a learner a number
 *     that answers to their own hand that directly;
 *   · it goes *up* only when something real went up — a missed gate item resets
 *     the proving run, which genuinely lengthens the shortest road — and by the
 *     size of the thing that happened rather than by the width of a sample.
 *
 * Returns null when the line cannot be closed from here inside the ceiling,
 * which is the honest answer for a skill whose prerequisites are still open.
 */
/** No shortest road on a ten-node graph is longer than this. */
const IDEAL_CEILING = 60;

export function tearsToHold(mastery, id, pace, opts = {}) {
  const live = mastery.state?.get?.(id);
  if (live?.mastered) return { tears: 0, minutes: 0 };
  const m = new MasteryEngine(mastery.graph, JSON.parse(snapshot(mastery)));
  // Fixed seed: the shortest road is one road, and which situation dresses its
  // third item must not change how far away the learner is told they are.
  const rand = rng(opts.seed ?? 0x51ab);
  const factor = pace?.factor ?? 1;
  let tears = 0;
  let seconds = 0;
  for (let i = 0; i < IDEAL_CEILING; i++) {
    const turn = play(m, id, rand, 1, factor, true);
    if (!turn) break;
    tears += 1;
    seconds += turn.seconds;
    if (turn.res?.justMastered && turn.skill === id) {
      return { tears, minutes: minutesFor(seconds, pace) };
    }
  }
  return null;
}

/**
 * The shortest road costs what it costs; a learner walking it at four fifths
 * accuracy walks it more than once in places. The stated minutes are the ideal
 * seconds divided by the accuracy actually measured on this learner, which is
 * the expectation of a geometric retry and is the same arithmetic the scheduler
 * would do — bounded, because a bad afternoon must not turn eight minutes into
 * an hour on a card a fifteen-year-old is deciding whether to come back for.
 */
function minutesFor(seconds, pace) {
  const acc = Math.max(0.5, Math.min(0.95, pace?.accuracy ?? 0.72));
  return Math.max(1, Math.round(seconds / acc / 60));
}

/** Minutes of work the engine thinks a line still owes, at this learner's pace. */
export function minutesToHold(mastery, id, pace) {
  const r = tearsToHold(mastery, id, pace);
  return r ? r.minutes : null;
}
