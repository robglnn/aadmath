/**
 * The learner model.
 *
 * Per skill we run Bayesian Knowledge Tracing: a hidden binary "knows it" state
 * updated from each observed response. BKT alone is a famously soft gate — a
 * lucky run of four-option guesses will push a posterior past 0.95. So five
 * mechanisms sit on top of it, and between them they are what makes 80%+ true
 * mastery the default outcome rather than a lucky one:
 *
 *   1. Prerequisite gating   — a rift line never opens before its parents are
 *      mastered, so nobody accumulates failure on a skill they were never
 *      equipped for. (Bloom's mastery-learning condition.)
 *   2. Unassisted evidence   — hinted or scaffolded successes move pL only
 *      fractionally and never satisfy the gate. Only clean solves count.
 *   3. Worked-example fading — support is complete when the model says the
 *      learner is new, partial in the middle, and absent once competence shows.
 *      (Sweller's completion effect and the expertise-reversal effect.)
 *   4. Interleaved retrieval — practice is not blocked. Prerequisites are
 *      re-probed on an expanding schedule, and a rift will hand you an item
 *      from the lattice below it rather than a third helping of the same thing.
 *      **That schedule is measured in wall-clock time, not in attempts.** It
 *      used to be [3, 8, 20, 48] *items* of separation, which is a spacing
 *      schedule in name only: a determined player sat down once and cleared the
 *      whole retention ladder without ever leaving the machine, and the engine
 *      recorded every one of those re-probes as evidence that the knowledge had
 *      survived. It had survived twenty questions. The whole value of spaced
 *      retrieval is that it survives a *night*, so the ladder is now ten
 *      minutes, a day, three days, eight days, three weeks of real elapsed
 *      time, persisted across sessions, with the old attempt counts kept only
 *      as a secondary floor so that a probe can never be served twice inside
 *      the same handful of items. A re-probe that crosses less than
 *      `durableMinutes` of real time still teaches — retrieval practice is
 *      retrieval practice — but it is not counted as durable retention by
 *      anything downstream, and `durable` below is the number that says so.
 *   5. A proving run          — the final gate is three unassisted items with
 *      all support switched off, and it does not close until it has spanned two
 *      representations, one of them non-symbolic, has asked once for the walk
 *      between a situation and the algebra. Its first pick at every step, and
 *      the first debt it settles at the last step, is an item form *or a
 *      situation* this learner has never practised in. Transfer, not repetition
 *      — and by the late gates it is the unseen situation, not the unseen form,
 *      that carries that claim. Every run that ends in a mastery claim spans two
 *      representations and includes a modelling item — 100% of 47,751 of them in
 *      the last full simulation, which is the line to watch, because the same
 *      figures over *all* runs move with how many get abandoned.
 *
 *      The run also remembers. A miss still ends it, but the misses are counted:
 *      a learner whose accuracy at the gate band runs low is asked for a longer
 *      run each time, to a bounded ceiling. Without that the gate was a
 *      memoryless repeated trial, and a frozen learner at competence 0.70
 *      cleared 84.3% of the time inside 25 minutes off seven independent 22%
 *      attempts. With it, 65.5%.
 *
 *   6. Placement            — a skill whose prerequisites are already solid does
 *      not restart at band 1 with a full worked example. Re-teaching what the
 *      lattice below already proves is the largest single waste of items in a
 *      mastery system, and it is what makes 450 items enough for most learners
 *      rather than 800.
 *
 *   7. The sight-read      — the *first* thing a new skill asks is the same
 *      question its proving run would ask, and harder: one unscaffolded item at
 *      the top of the bank, dressed in a situation wherever the bank offers one.
 *      Answer it cold and that item **is** the run's first, so a learner who
 *      already knows this skill is two items from done. There is no separate,
 *      softer "test-out gate": testing out and grinding out end at exactly the
 *      same bar (three unassisted items at band 4+, spanning two
 *      representations, one non-symbolic, one modelling, in forms or worlds
 *      never practised). Only the road to the bar is shorter. What that costs
 *      in false positives is measured, not asserted — tools/simulate.mjs runs
 *      cohorts frozen at a known hidden competence and prints the pass rate of
 *      each: 57.3% of learners who genuinely sit at 0.95 clear a skill in the
 *      minimum three items, against 22.8% of learners at 0.70 and 3.5% at 0.50,
 *      and *ever*, inside a 40-item sitting, 100% / 65.5% / 14.8%.
 *      Driven through the real game (tools/critic/testout.mjs) a player who can
 *      answer clears every one of the ten skills in exactly three items and a
 *      median of 2.3 minutes — the whole level proved inside one session.
 *
 *      "The top of the bank" is a demand, not an ordinal. A band-5 item measures
 *      anywhere from 6.9 to 10.1 on generators.demandOf() across this level, so
 *      pinning the sight-read to the ordinal asked a far harder question of a
 *      multi-step equation than of a one-step one — hard enough that a learner
 *      who genuinely knew multi-step needed a median of 15 minutes and 18 items
 *      to prove it, against 2.5 minutes and 3 items everywhere else. So no
 *      skill's sight-read may be harder than the hardest sight-read the rest of
 *      the level can offer. It is a one-sided outlier rule: it binds on exactly
 *      one skill here, lowers it only to the second-hardest gate in the level,
 *      never goes below the gate floor, and leaves the frozen-competence table
 *      above untouched to the decimal.
 *
 *   8. Leverage routing    — `next()` does not serve the weakest skill. It
 *      serves the item with the greatest expected mastery gain **per minute**:
 *      expected information gain from the answer, expected teaching gain,
 *      how close a claim is to closing, how much of the lattice mastering it
 *      unlocks, and how overdue a retention probe is — all divided by the real
 *      time that item costs, damped for massed practice, and floored by an
 *      anti-starvation rule so that no unmastered skill can be routed around.
 *      The fast routes above cost true mastery under the router this replaced
 *      (88.0%); under this one the same learners reach 99.8%.
 *
 * A miss on a spaced re-probe demotes the skill and reopens practice, so
 * "mastered" cannot rot silently. Nothing anywhere in this file marks a skill
 * done on a timer, an attempt count or a budget: a learner who has not proved a
 * skill keeps being handed items on it, and `starveLimit` guarantees they are
 * handed one at least every forty observations for as long as it takes.
 *
 * The difficulty bands these rules lean on are not labels: generators.demandOf()
 * scores every item and tools/validate-items.mjs fails the build unless measured
 * demand rises strictly from band 1 to band 5 inside every skill. That is what
 * lets the proving run say "at band 4 or above" and mean something — inside one
 * skill. It says nothing across skills, and `sightReadBandFor` below is where
 * that gap is closed.
 */
import { FORMS_BY_SKILL, SKILLS, generate, demandOf } from './generators.js';

const DEFAULT_BKT = { pInit: 0.25, pTransit: 0.25, pSlip: 0.1, pGuess: 0.15 };
const DEFAULT_MASTERY = {
  pL: 0.95,
  cleanRun: 3,
  minDifficulty: 3,
  checkItems: 3,
  checkMinDifficulty: 4,
  // --- the spacing schedule, in real elapsed minutes -------------------------
  // Ten minutes, eight hours, twenty-one hours, two days, five and a half days,
  // and five and a half days for ever after that. The first rung is inside a
  // sitting on purpose — consolidation after a short gap is real, and it is the
  // only rung a single session can ever pay out. Every rung above it can only be
  // reached by leaving and coming back.
  //
  // The rungs expand by about 2.5 because that is what one survived, genuinely
  // spaced re-probe is worth to a memory, and an expanding schedule is only
  // correct if the two grow together: intervals that outrun the strength they
  // are buying ask for less and less reliable recall at every rung. Graded
  // against the forgetting model in tools/simulate.mjs this ladder holds
  // predicted retention at the moment of review near 0.9 at every rung; against
  // the [1 day, 3 days, 8 days, 21 days] ladder it was first written with, on
  // the same 600 learners coming back daily (SIM_MINUTES=10,1440,4320,11520,30240
  // runs the old one), it is worth +5.0 points of true mastery at the buzzer,
  // +17.0 points of true mastery a month later, and +19.1 points in the lowest
  // ability quintile. Nothing in this file advances the stage on an item that
  // did not wait.
  reviewMinutes: [10, 480, 1260, 3120, 7800],
  // The secondary floor, in attempts of separation. Time alone would let a
  // learner who left the tab open over lunch be re-probed on the same skill
  // three items running; both gates must be met before a probe comes due.
  reviewFloor: [3, 6, 8, 10, 12],
  // The gap above which a passed re-probe is evidence that the knowledge
  // *survived a walk away from the machine* rather than merely being still warm.
  // Five hours: long enough that a school day cannot manufacture one, short
  // enough that a period after lunch and a period the next morning both count.
  durableMinutes: 300,
  // --- how long a belief stays fresh ---------------------------------------
  // BKT has no clock in it. Its posterior is a function of the answers it has
  // seen and of nothing else, so a model that watched a learner solve three
  // two-step equations on Friday walks into Monday believing exactly what it
  // believed on Friday afternoon — and hands them a mastery claim off two more
  // items, on evidence that is three days stale. Measured on learners coming
  // back across days, that is where hollow claims came from.
  //
  // So an untouched belief relaxes back towards this skill's prior, halving
  // the distance every `beliefHalfLife` minutes of real time — a day for a
  // skill still being learned, and for a held line the very window the engine
  // itself thinks is the right one to re-check on, which is the only
  // self-consistent choice available. Nothing about *standing* decays: a held
  // line is demoted by missing its re-probe, never by the calendar.
  beliefHalfLife: 1440,
  // Below this, nothing decays: a stretch, a walk to another rift and a break
  // for a drink are not evidence about memory.
  beliefStale: 45,
  // How deep a sounding goes before it lands. Twelve unassisted items at the
  // top of the bank, across the whole shard, one miss from the surface: long
  // enough to be a run worth telling somebody about, short enough that a good
  // player finishes one inside a sitting and starts another.
  soundingFloor: 12,
  // A line caught lapsing comes back round almost immediately — the point of a
  // lapse probe is to find out whether that was a slip, and next Tuesday is too
  // late to ask.
  lapseMinutes: 2,
  // --- the sight-read -------------------------------------------------------
  // One unscaffolded item at the gate band, served the first time a learner
  // meets a skill. It is not a softer gate; it is the proving run's own first
  // item, offered before the grind rather than after it.
  sightRead: true,
  // The sight-read is asked at the top of the bank, not merely at the gate
  // floor: it is the one claim made with no prior evidence on this skill, so it
  // is made against the highest demand the bank can produce — subject to the
  // cross-skill cap in `sightReadBandFor`, which is what stops "the top of the
  // bank" meaning ten different things.
  // Measured, on frozen learners in tools/simulate.mjs (AB_SRBAND=4): dropping
  // it back to band 4 takes the chance that a learner who genuinely sits at
  // competence 0.70 tests out in three items from 22.8% to 29.5%, and their
  // chance of clearing at all inside a sitting from 65.5% to 80.8%. It buys the
  // knower a minute and a half off the p90 and it is not worth it.
  sightReadBand: 5,
  // A stricter setting for a district that wants one: every extra item is
  // another unassisted transfer item at the gate band behind the claim. At 1
  // (AB_SREXTRA=1) a learner at competence 0.70 clears inside a sitting 62.5% of
  // the time rather than 65.5%, and inside six items 15.0% rather than 24.5% —
  // but the median knower's two and a half minutes becomes five and a half,
  // which is not the product this is.
  sightReadExtra: 0,
  // A learner may attempt the proving run on this weaker standing *provided*
  // the standing was earned at the gate band itself: one clean unassisted solve
  // at band 4 or above, on top of a posterior already at 0.90. The run it opens
  // is the same three-item run, so a claim off this route still rests on four
  // unassisted band-4+ items and never on fewer than the three the bar names.
  fastPL: 0.90,
  fastRun: 1,
  // --- the gate's memory ----------------------------------------------------
  // A proving run used to be a memoryless repeated trial: a miss threw the run
  // away, the posterior recovered inside one item, and the next run asked for
  // exactly the same three things. Measured, that protected nothing — a frozen
  // learner at competence 0.70 cleared 84.2% of the time inside 25 minutes,
  // because seven independent 22% shots is not a 22% test — while costing a
  // learner who already knew the skill eight items for every slip.
  //
  // So the run now remembers. Every item served *as a gate item* at the gate
  // band is counted, and a learner whose accuracy there runs low is asked for a
  // longer run each time: `gateTol` is how many misses one clean solve pays
  // off, `gateDebtFree` is an allowance that keeps a slip or two from ever
  // costing anything, and `gateDebtCap` bounds the whole thing so no learner can
  // be held on a gate that has grown without limit. This is the only part of the
  // design that makes repeated attempts *harder* rather than merely slower, and
  // it is what pays for everything else here that makes them cheaper.
  gateTol: 0.8,
  gateDebtFree: 2,
  gateDebtCap: 3,
  // Whether a clean solve below the gate band buys a whole step of the credit
  // ladder rather than a third of one. See the ladder in `observe` for why.
  fastClimb: true,
  // Nobody is routed around. An unmastered, unlocked skill that has gone this
  // many observations without an item is served next, whatever the scoring says.
  starveLimit: 40,
};

export const MASTERY_PL = DEFAULT_MASTERY.pL;
export const MASTERY_CLEAN_RUN = DEFAULT_MASTERY.cleanRun;
/** The spacing ladder, in real elapsed minutes. */
export const REVIEW_MINUTES = DEFAULT_MASTERY.reviewMinutes;
/** The same ladder's secondary floor, in attempts of separation. */
export const REVIEW_FLOOR = DEFAULT_MASTERY.reviewFloor;
const MINUTE = 60000;

/**
 * What an item costs a learner, in seconds.
 *
 * Nothing else in this file can talk about "highest leverage per minute"
 * without a minute, so the cost model lives here, is exported, and is the one
 * the simulation reports its minutes from — a schedule that optimises against
 * one clock and is graded against another is measuring nothing. The numbers are
 * an assumption about reading and working time (a bare symbolic item is quick;
 * a situation has to be read first; a worked example has to be studied), which
 * is why tools/simulate.mjs prints items-to-clear beside minutes-to-clear: the
 * item count does not depend on this table.
 */
export const ITEM_SECONDS = { symbolic: 26, table: 34, graph: 33, verbal: 38, context: 46 };

export function itemSeconds({ rep = 'symbolic', difficulty = 3, scaffold = 'none', attempts = 1 } = {}) {
  const base = ITEM_SECONDS[rep] ?? 30;
  const band = 0.74 + 0.13 * Math.max(1, Math.min(5, difficulty || 1));
  const support = scaffold === 'full' ? 30 : scaffold === 'partial' ? 17 : 0;
  // A second go means re-reading the statement and the echo that answered it.
  const retry = Math.max(0, (attempts | 0) - 1) * (base * 0.55 + 12);
  return base * band + support + retry;
}

const MODELLING_REPS = new Set(['context', 'verbal']);

/**
 * How much prose a session is actually made of.
 *
 * A schedule that proves people faster serves fewer worked analogues and more
 * unscaffolded gate items, and the first thing that thins out is the situation
 * a problem arrives dressed in. A learner who meets nothing but bare notation
 * for a dozen items is being handed a worksheet, whatever the mastery numbers
 * say — so when the last dozen items have gone thin, a form that carries a
 * world outranks every other preference the scheduler has except the proving
 * run's own structural debts. tools/scene-audit.mjs is what holds this honest.
 */
const PROSE_WINDOW = 12;
const PROSE_FLOOR = 8;

/** Shannon entropy of a Bernoulli belief, in bits. */
function bits(x) {
  if (!(x > 0) || !(x < 1)) return 0;
  return -(x * Math.log2(x) + (1 - x) * Math.log2(1 - x));
}

/**
 * How much the next answer on this skill is expected to sharpen the posterior.
 * This is the "information gain" half of leverage: it is largest when the model
 * genuinely does not know whether the learner knows, and near zero at both ends.
 */
function expectedInfoGain(pL, p) {
  const pc = pL * (1 - p.pSlip) + (1 - pL) * p.pGuess;
  const postC = (pL * (1 - p.pSlip)) / Math.max(pc, 1e-6);
  const postW = (pL * p.pSlip) / Math.max(1 - pc, 1e-6);
  return Math.max(0, bits(pL) - (pc * bits(postC) + (1 - pc) * bits(postW)));
}

/**
 * The weights behind "highest leverage". Information and teaching are the two
 * halves of what an item is for; `close` exists because abandoning a proving run
 * one item from the end throws away every item already in it; `fan` is the
 * lattice argument — a skill that unlocks three others is worth more than a leaf
 * of equal difficulty; `starve` is the promise that nothing is routed around.
 */
const W = { info: 1.0, teach: 1.1, close: 0.55, probe: 0.85, fan: 0.5, review: 1.15, starve: 0.7 };

export class MasteryEngine {
  /** @param {object} graph parsed algebra1-l1.json */
  constructor(graph, saved) {
    this.graph = graph;
    this.cfg = { ...DEFAULT_MASTERY, ...(graph.mastery || {}) };
    this.nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    this.state = new Map();
    this.clock = 0;         // global count of attempts; the spacing schedule's *floor*
    /**
     * The wall clock. Everything about retention is measured against this and
     * not against `clock`, and it is a function rather than a call to Date.now()
     * so that tools/simulate.mjs can run a cohort that comes back across days
     * and tools/critic can drive a returning player, both through the real
     * engine rather than through a model of it.
     */
    this.clockFn = () => Date.now();
    /**
     * THE SOUNDING — what the lattice offers once every line is held and none of
     * them has waited long enough to be worth re-probing.
     *
     * A descent: one unassisted item at the top of the bank, then another
     * deeper in the lattice, then another, in forms and worlds this learner has
     * not worked in. It pays, it records how deep you got, and one miss ends
     * it. It grants no mastery and no retention credit — it cannot, nothing
     * inside a sitting can — so it can never be farmed for standing. It exists
     * because "you have proved everything and nothing is due for a day" has to
     * have an answer, and re-probing ten lines that are already at 100% is not
     * one.
     */
    this.sounding = { rung: 0, best: 0, runs: 0, items: 0, clean: 0 };
    // Identity of this learner record, and how many observations it has taken.
    // Nothing in the learning engine reads either — they exist so that a second
    // store written beside this one (the evidence ledger in src/report) can
    // prove it belongs to *this* record and is not one save behind it. A
    // progress screen that cannot tell those apart reports "4 lines held"
    // beside "0 questions answered" and calls it a record.
    this.recordId = newRecordId();
    this.seq = 0;
    this.recent = [];       // skills of the last few items, for interleaving
    this.recentReps = [];   // representations of the last few items, so the surface keeps changing
    this.dry = 0;           // consecutive items that arrived with no situation at all
    this.sceneLog = [];     // did the last dozen items arrive dressed in a situation?
    // 'leverage' is what ships. 'lowest-pL' is the policy this replaced, kept
    // callable so tools/simulate.mjs can run it as a control arm on identical
    // learners rather than taking the improvement on trust.
    this.policy = 'leverage';
    // How much of the lattice each skill is standing in front of. Fan-out is a
    // property of the graph, so it is counted once.
    this.descendants = new Map(graph.nodes.map((n) => [n.id, []]));
    for (const n of graph.nodes) {
      for (const a of allPrereqs(graph, n.id)) this.descendants.get(a)?.push(n.id);
    }
    this.maxFanout = Math.max(1, ...[...this.descendants.values()].map((v) => v.length));
    // How much lattice each skill stands on. The sounding descends by it.
    this.standsOn = new Map(graph.nodes.map((n) => [n.id, allPrereqs(graph, n.id).size]));
    for (const n of graph.nodes) this.state.set(n.id, blank(n));
    // Measure the bank's demand ladder now, while the game is still booting.
    // It is memoised across engines and costs about 20ms, which is nothing here
    // and a dropped frame if it lands on the first rift a player opens.
    demandLadder();
    if (saved) this.load(saved);
  }

  /** Has the prose gone thin over the last dozen items? */
  proseThin() {
    if (this.sceneLog.length < 4) return this.dry >= 1;
    const dressed = this.sceneLog.reduce((a, b) => a + b, 0);
    return dressed < Math.round(PROSE_FLOOR * this.sceneLog.length / PROSE_WINDOW);
  }

  node(id) { return this.nodes.get(id); }
  get(id) { return this.state.get(id); }

  isUnlocked(id) {
    const n = this.nodes.get(id);
    if (!n) return false;
    return n.prereqs.every((p) => this.state.get(p)?.mastered);
  }

  unlockedSkills() {
    return this.graph.nodes.map((n) => n.id).filter((id) => this.isUnlocked(id));
  }

  // -------------------------------------------------------------------------
  // Scheduling
  // -------------------------------------------------------------------------

  // --- the two clocks -------------------------------------------------------

  /** Wall clock, in ms since the epoch. */
  now() { return this.clockFn(); }

  /** Drive the wall clock from somewhere else (simulation, critic harness). */
  setClock(fn) { this.clockFn = typeof fn === 'function' ? fn : () => Date.now(); }

  /** How long this line's current spacing rung is, in ms. */
  windowMs(s) {
    const m = this.cfg.reviewMinutes;
    return Math.max(1, m[Math.min(s.reviewStage || 0, m.length - 1)]) * MINUTE;
  }

  /** How many items of separation the same rung asks for. */
  floorFor(s) {
    const f = this.cfg.reviewFloor;
    return f[Math.min(s.reviewStage || 0, f.length - 1)] ?? 3;
  }

  /**
   * Has this line's re-probe actually come round?
   *
   * Both gates. The wall clock is the schedule — that is the whole claim a
   * spaced re-probe makes — and the attempt count is a floor under it, so that
   * a tab left open across lunch cannot serve the same skill three items
   * running and call the third one retention.
   */
  isDue(s, now = this.now()) {
    if (!s || !s.mastered || s.dueTime == null) return false;
    return now >= s.dueTime && (s.dueAt == null || this.clock >= s.dueAt);
  }

  /** Skills whose spaced re-probe has come round, soonest-due first. */
  dueReviews(now = this.now()) {
    return this.unlockedSkills()
      .map((id) => this.state.get(id))
      .filter((s) => this.isDue(s, now))
      .sort((a, b) => a.dueTime - b.dueTime);
  }

  /**
   * The watch: what is due now, and when the next thing falls due.
   * The endgame surfaces read this, and so does the report.
   */
  watch(now = this.now()) {
    let due = 0, next = null, held = 0, durable = 0;
    for (const s of this.state.values()) {
      if (!s.mastered) continue;
      held++;
      durable += s.durable || 0;
      if (this.isDue(s, now)) { due++; continue; }
      if (s.dueTime != null && (next == null || s.dueTime < next)) next = s.dueTime;
    }
    return {
      held, due, durable,
      nextAt: next,
      nextInMinutes: next == null ? null : Math.max(0, Math.round((next - now) / MINUTE)),
      sounding: { ...this.sounding },
    };
  }

  /** Re-probes passed after a real walk away from the machine. */
  durableCount() {
    let n = 0;
    for (const s of this.state.values()) n += s.durable || 0;
    return n;
  }

  /** What the scheduler would call this skill's next item. */
  kindFor(s, now = this.now()) {
    if (s.check) return 'check';
    // A held line that has not waited is not a re-probe. It is a sounding: the
    // top of the bank, for the run, for the shards, for nothing that could ever
    // be mistaken for evidence of retention.
    if (s.mastered) return this.isDue(s, now) ? 'review' : 'deep';
    if (s.probe) return 'probe';
    return 'learn';
  }

  /** The band the next item on this skill would be served at. */
  bandFor(s, kind = this.kindFor(s)) {
    if (kind === 'check') return Math.min(5, Math.max(this.cfg.checkMinDifficulty, s.difficulty));
    if (kind === 'probe') return s.probe.band;
    if (kind === 'review') return Math.min(4, Math.max(3, s.difficulty));
    if (kind === 'deep') return 5;
    return s.difficulty;
  }

  /**
   * Expected minutes for the next item on this skill — the denominator of
   * "leverage per minute". Averaged over the forms actually eligible at that
   * band, because a skill whose only band-4 forms are word problems really does
   * cost more per item than one that can be asked symbolically.
   */
  minutesFor(s, kind = this.kindFor(s)) {
    const band = this.bandFor(s, kind);
    const scaffold = kind === 'learn' ? this.scaffoldFor(s.id) : 'none';
    const forms = (FORMS_BY_SKILL[s.id] || []).filter((f) => band >= f.dMin && band <= f.dMax);
    const secs = forms.length
      ? forms.reduce((a, f) => a + itemSeconds({ rep: f.rep, difficulty: band, scaffold }), 0) / forms.length
      : itemSeconds({ difficulty: band, scaffold });
    return Math.max(0.15, secs / 60);
  }

  /** How far along the road to a mastery claim this skill already is, 0..1. */
  progress(s) {
    if (s.check) return 0.8 + 0.2 * (s.check.done / Math.max(1, s.check.need));
    const base = (this.nodes.get(s.id)?.bkt || DEFAULT_BKT).pInit;
    return Math.max(0, Math.min(1, (s.pL - base) / Math.max(1e-6, this.cfg.pL - base)));
  }

  /** How many skills sit downstream of this one and are not open yet. */
  fanout(id) {
    const down = this.descendants.get(id) || [];
    let n = 0;
    for (const d of down) if (!this.state.get(d)?.mastered) n++;
    return n / this.maxFanout;
  }

  /**
   * What one more item on this skill is worth per minute it costs.
   *
   * Returns -1 for a skill with nothing to offer right now (mastered, and its
   * retention probe not yet due).
   */
  leverage(id) {
    const s = this.state.get(id);
    const n = this.nodes.get(id);
    if (!s || !n) return -1;
    // A skill is placed the moment it comes into view, not the moment it is
    // first served, so the router can see that a two-minute sight-read is on
    // offer here and weigh it against an hour of practice somewhere else.
    if (!s.mastered) this.place(s);
    const p = { ...DEFAULT_BKT, ...(n.bkt || {}) };
    const kind = this.kindFor(s);
    const mins = this.minutesFor(s, kind);

    if (s.mastered) {
      const now = this.now();
      // Not due. There is no such thing as a cheap retention probe served
      // fifteen minutes after the last one: it costs a real minute of a real
      // session and buys nothing the model does not already know. The endgame
      // answer to a spare minute is the sounding, and `next()` reaches it by
      // finding nothing here worth doing.
      if (!this.isDue(s, now)) return -1;
      const over = (now - s.dueTime) / this.windowMs(s);
      // A skill already caught lapsing is the one piece of standing in the whole
      // model that is actively rotting; it outranks a routine probe.
      const risk = s.lapsePending ? 2.2 : 1;
      return (W.review * risk * (0.6 + Math.min(4, over))) / mins;
    }

    const info = expectedInfoGain(s.pL, p);
    const teach = (1 - s.pL) * p.pTransit;
    const closing = s.check ? (0.7 + 0.5 * s.check.done) : 0;
    const probe = s.probe ? 1 : 0;
    const fan = this.fanout(id) * this.progress(s);
    const gap = this.clock - (s.lastSeenAt ?? s.openedAt ?? this.clock);
    const starve = Math.min(3, gap / 25);

    // Massed practice is worth less than the same items spread out — that is
    // the whole reason the file interleaves at all — and it is worth less to the
    // prose too: a skill served eight times running exhausts the deck of
    // situations its forms can be dressed in, and tools/scene-audit.mjs fails
    // the build when a learner meets the same world twice in one session. A run
    // that has just banked a gate item is exempt: it is finishing something.
    let massed = 0;
    for (const r of this.recent.slice(-6)) if (r === id) massed++;
    const damp = s.check ? 1 : 1 / (1 + 0.55 * massed);

    return damp * (W.info * info + W.teach * teach + W.close * closing
      + W.probe * probe + W.fan * fan + W.starve * starve) / mins;
  }

  /**
   * The single most useful rift to be standing in front of right now.
   *
   * Highest expected mastery gain per minute, with one hard promise in front of
   * the scoring: an unmastered skill that has gone `starveLimit` observations
   * without an item is served, whatever anything else scores. That is what makes
   * "we never abandon a struggler" a property of the code rather than a hope
   * about the weights.
   */
  next() {
    if (this.policy === 'lowest-pL') return this.nextByLowestPL();
    const open = this.unlockedSkills().map((id) => this.state.get(id));
    if (!open.length) return null;

    const starved = open
      .filter((s) => !s.mastered
        && this.clock - (s.lastSeenAt ?? s.openedAt ?? this.clock) >= this.cfg.starveLimit)
      .sort((a, b) => (a.lastSeenAt ?? a.openedAt ?? 0) - (b.lastSeenAt ?? b.openedAt ?? 0));
    if (starved.length) return { id: starved[0].id, kind: this.kindFor(starved[0]), reason: 'starved' };

    let best = null, bestV = -Infinity;
    for (const s of open) {
      const v = this.leverage(s.id);
      if (v > bestV) { bestV = v; best = s; }
    }
    if (best && bestV > 0) return { id: best.id, kind: this.kindFor(best), value: bestV };
    // Everything unlocked is mastered and nothing has waited long enough to be
    // worth asking again. That is the endgame, and it is not the end: the
    // lattice sounds. See `soundingPick`.
    return this.nextSounding();
  }

  // -------------------------------------------------------------------------
  // The sounding
  // -------------------------------------------------------------------------

  /**
   * Which held line the descent asks next.
   *
   * It descends. Early rungs come off the shallow end of the lattice, and the
   * deeper the sounding goes the more it prefers skills that stand on the most
   * proved ground beneath them — so a ten-rung descent walks the whole shard
   * rather than asking one skill ten times. Nothing just asked is asked again,
   * and a line that has gone longest untouched wins the tie.
   */
  soundingPick() {
    const pool = this.unlockedSkills()
      .map((id) => this.state.get(id))
      .filter((s) => s.mastered);
    if (!pool.length) return null;
    const last = this.recent.slice(-2);
    const want = Math.min(1, this.sounding.rung / 6);
    let best = null, bestV = -Infinity;
    for (const s of pool) {
      const deep = (this.standsOn.get(s.id) || 0) / Math.max(1, this.standsOn.size - 1);
      // How much of this skill's bank this learner has never worked in — a
      // descent that can still surprise is worth more than one that cannot.
      const forms = FORMS_BY_SKILL[s.id] || [];
      const fresh = forms.length
        ? forms.filter((f) => !(s.formsSeen[f.id]?.seen)
          || (f.sceneKeys || []).some((key) => !(key in s.scenesSeen))).length / forms.length
        : 0;
      const cold = Math.min(1, (this.clock - (s.lastSeenAt ?? 0)) / 20);
      const v = want * deep + (1 - want) * (1 - deep) * 0.6 + 0.5 * fresh + 0.4 * cold
        - (last.includes(s.id) ? 1.5 : 0);
      if (v > bestV) { bestV = v; best = s; }
    }
    return best;
  }

  nextSounding() {
    const s = this.soundingPick();
    return s ? { id: s.id, kind: 'deep', reason: 'sounding' } : null;
  }

  /**
   * One rung of the descent: the top of the bank, no support, and every
   * preference the proving run uses to make a claim hard to fake — an unworked
   * form, an unworked situation, a surface the last item did not use — with
   * none of the standing a proving run confers.
   */
  soundingTask(s) {
    const forms = FORMS_BY_SKILL[s.id] || [];
    const d = 5;
    let pool = forms.filter((f) => d >= f.dMin && d <= f.dMax);
    if (!pool.length) pool = forms.slice();
    const novel = (f) => !(s.formsSeen[f.id]?.seen)
      || (f.sceneKeys || []).some((key) => !(key in s.scenesSeen));
    const fresh = pool.filter(novel);
    let chosen = fresh.length ? fresh : pool;
    // Every third rung asks for the walk between a situation and the algebra,
    // which is the direction that collapses first.
    if (this.sounding.rung % 3 === 2) {
      const modelling = chosen.filter((f) => MODELLING_REPS.has(f.rep));
      if (modelling.length) chosen = modelling;
    }
    const lastRep = this.recentReps[this.recentReps.length - 1];
    if (lastRep && chosen.length > 1) {
      const other = chosen.filter((f) => f.rep !== lastRep);
      if (other.length) chosen = other;
    }
    s.lastServed = { difficulty: d, kind: 'deep' };
    return {
      skill: s.id,
      kind: 'deep',
      difficulty: d,
      scaffold: 'none',
      formCandidates: chosen.map((f) => f.id),
      reps: null,
      avoidScenes: Object.keys(s.scenesSeen),
      check: null,
      // How deep the descent already is, so the surface can say so.
      sounding: { rung: this.sounding.rung + 1, best: this.sounding.best },
    };
  }

  /** The policy this replaced: due review first, then the lowest posterior. */
  nextByLowestPL() {
    const due = this.dueReviews();
    if (due.length) return { id: due[0].id, kind: 'review' };
    const open = this.unlockedSkills()
      .map((id) => this.state.get(id))
      .filter((s) => !s.mastered)
      .sort((a, b) => (b.check ? 1 : 0) - (a.check ? 1 : 0) || a.pL - b.pL);
    if (open.length) return { id: open[0].id, kind: open[0].check ? 'check' : 'learn' };
    const any = this.unlockedSkills().map((id) => this.state.get(id)).sort((a, b) => a.pL - b.pL);
    return any.length ? { id: any[0].id, kind: 'enrich' } : null;
  }

  /**
   * Turn "the learner walked into the rift for `skillId`" into a concrete task.
   *
   * The rift's own skill is the default, but the scheduler will hand back a
   * retrieval item from the lattice beneath it when practice has gone blocked,
   * or a spaced re-probe of something already mastered. That is interleaving:
   * it costs a little accuracy in the moment and buys a lot of retention.
   */
  /**
   * How much this learner has already shown on everything this skill sits on.
   * 0 when the skill has no prerequisites (a genuinely cold start), otherwise
   * the weakest posterior among its parents — a chain is as strong as its
   * weakest link, and this is the number that decides where a newly opened
   * skill *starts* rather than making everyone begin again at band 1.
   */
  priorCompetence(id) {
    const n = this.nodes.get(id);
    if (!n || !n.prereqs.length) return 0;
    return Math.min(...n.prereqs.map((p) => this.state.get(p)?.pL ?? 0));
  }

  /**
   * Items spent per skill this learner has actually got to a mastery claim.
   * A knower clears a skill in a handful; a grinder takes thirty. It is the one
   * honest read on pace the engine owns, and `seedPL` uses it so that a new
   * skill does not open on a constant that is wrong for both of them.
   */
  pace() {
    let n = 0, items = 0;
    for (const s of this.state.values()) if (s.everMastered) { n++; items += s.attempts; }
    return n ? items / n : null;
  }

  /**
   * Where a skill's posterior *starts*.
   *
   * BKT's pInit is a constant, which means the model opens every skill believing
   * the same thing about a student who has just proved four prerequisites in
   * twelve items and a student who needed a hundred and forty. This replaces the
   * constant with evidence: the weakest prerequisite posterior, discounted by
   * how expensive those prerequisites were to earn. It is capped well under the
   * gate — seeding can shorten the road to a claim, never make the claim.
   */
  seedPL(id) {
    const n = this.nodes.get(id);
    const base = (n?.bkt || DEFAULT_BKT).pInit;
    if (!n || !n.prereqs.length) return base;
    const ready = this.priorCompetence(id);
    const pace = this.pace();
    const speed = pace == null ? 0.5 : clamp01((22 - pace) / 18);
    const lift = clamp01((ready - 0.85) / 0.13) * (0.45 + 0.55 * speed);
    return Math.max(base, Math.min(SEED_CAP, base + (SEED_CAP - base) * lift));
  }

  /**
   * Placement, once, when a skill is first met.
   *
   * Two decisions. Where practice starts if the learner turns out to need it —
   * re-teaching what the lattice below already proves is the largest single
   * waste of items in a mastery system, so a skill whose parents are solid opens
   * at band 2 or 3 instead of band 1. And whether to open with a sight-read:
   * one unscaffolded item at the gate band, which is the whole of the fast route
   * out. It costs one item to offer and saves a dozen when it lands.
   */
  place(s) {
    if (s.placed || s.attempts > 0) return;
    s.placed = true;
    s.pL = this.seedPL(s.id);
    const ready = this.priorCompetence(s.id);
    const parents = (this.nodes.get(s.id)?.prereqs || [])
      .map((p) => this.state.get(p))
      .filter(Boolean);
    if (parents.length) {
      const floor = Math.min(...parents.map((p) => p.difficulty));
      if (ready >= 0.93) s.difficulty = Math.max(s.difficulty, Math.min(3, floor));
      else if (ready >= 0.85) s.difficulty = Math.max(s.difficulty, Math.min(2, floor));
    }
    s.baseBand = s.difficulty;
    // When this skill came into view. Until it has been served once, this is
    // what the starvation floor counts from — a skill that has just opened has
    // not been neglected.
    s.openedAt = this.clock;
    if (this.cfg.sightRead) s.probe = { band: this.sightReadBandFor(s.id) };
  }

  taskFor(skillId) {
    const s = this.state.get(skillId);
    if (!s) return null;
    this.place(s);

    // A proving run in progress always continues, uninterrupted.
    if (s.check) return this.checkTask(s);

    // The sight-read. One item, gate band, no support, before anything is
    // taught — because if the learner can already do this, everything the rift
    // was about to say is a waste of their afternoon. Symbolic where the bank
    // offers it: it is the quickest surface to read, and the two run items that
    // follow a pass are the ones that have to carry the transfer claim.
    if (s.probe && !s.mastered) return this.task(s, 'probe', { difficulty: s.probe.band, scaffold: 'none' });

    // A spaced re-probe that has come due beats new material.
    const due = this.dueReviews();
    if (due.length && (due[0].id === skillId || this.blocked(skillId))) {
      const target = due[0];
      return this.task(target, 'review', { difficulty: Math.min(4, Math.max(3, target.difficulty)), scaffold: 'none' });
    }

    // Blocked practice: after two items in a row on one skill, drop in a
    // retrieval item from a mastered prerequisite instead.
    if (this.blocked(skillId)) {
      const prereq = this.retrievalCandidate(skillId);
      if (prereq) return this.task(prereq, 'retrieval', { difficulty: Math.max(2, prereq.difficulty - 1), scaffold: 'none' });
    }

    if (s.mastered) {
      // Due means due on the clock a night is measured on. If it is, this is a
      // re-probe on the terms a re-probe is judged on: the schedule advances, a
      // miss opens the lapse path, and a pass across a real gap is durable
      // retention. If it is not, no amount of dressing makes it one, so the
      // rift hands back a rung of the sounding instead — the top of the bank,
      // for the descent, for the shards, and for no standing at all.
      if (this.isDue(s)) {
        return this.task(s, 'review', { difficulty: Math.min(4, Math.max(3, s.difficulty)), scaffold: 'none' });
      }
      return this.soundingTask(s);
    }
    return this.task(s, 'learn', { difficulty: s.difficulty, scaffold: this.scaffoldFor(skillId) });
  }

  blocked(skillId) {
    const r = this.recent;
    return r.length >= 2 && r[r.length - 1] === skillId && r[r.length - 2] === skillId;
  }

  /** A mastered prerequisite that has gone longest without being touched. */
  retrievalCandidate(skillId) {
    const n = this.nodes.get(skillId);
    if (!n) return null;
    const pool = [...allPrereqs(this.graph, skillId)]
      .map((id) => this.state.get(id))
      .filter((x) => x && x.mastered)
      .sort((a, b) => (a.lastSeenAt ?? -1) - (b.lastSeenAt ?? -1));
    return pool[0] || null;
  }

  task(s, kind, extra) {
    const forms = FORMS_BY_SKILL[s.id] || [];
    const seen = (f) => (s.formsSeen[f.id]?.seen || 0);
    const d = Math.max(1, Math.min(5, extra.difficulty | 0 || 1));
    let eligible = forms.filter((f) => d >= f.dMin && d <= f.dMax);
    // Two bare readings in a row and the world has stopped talking. A schedule
    // that finishes people faster serves fewer worked examples and fewer
    // contextual items, and the first thing to go is the prose — so once the
    // last two items have arrived carrying no situation at all, a form that
    // carries one takes precedence over every other preference below.
    // tools/scene-audit.mjs counts what actually reaches the screen and fails
    // the build when a session goes thin.
    if (this.proseThin()) {
      const dressed = eligible.filter((f) => (f.sceneKeys || []).length);
      if (dressed.length) eligible = dressed;
    }
    // Prefer a form this learner has met least often, so a skill is never
    // reducible to one template.
    // New practice hunts for the forms this learner has met least, so a skill
    // can never collapse into one template. A retention probe does not: it is
    // asking "is it still there?", not "can you transfer it?".
    const least = eligible.length ? Math.min(...eligible.map(seen)) : 0;
    let chosen = kind === 'learn' ? eligible.filter((f) => seen(f) <= least + 1) : eligible;
    // The sight-read asks the hardest thing to fake: walk between a situation
    // and the algebra, cold, at the top band. It is the most expensive surface
    // in the bank to read, and it costs the run nothing, because it settles all
    // three of the proving run's closing conditions in its first item and the
    // two that follow can then be asked on the cheapest surfaces there are.
    if (kind === 'probe' && chosen.length > 1) {
      const modelling = chosen.filter((f) => MODELLING_REPS.has(f.rep));
      if (modelling.length) chosen = modelling;
    }
    // Two items in the same representation back to back is how a mastery game
    // turns into a worksheet. Where the pool allows it, change the surface.
    const lastRep = this.recentReps[this.recentReps.length - 1];
    if (lastRep && chosen.length > 1) {
      const other = chosen.filter((f) => f.rep !== lastRep);
      if (other.length) chosen = other;
    }
    const fresh = chosen.map((f) => f.id);
    const requiredReps = (this.nodes.get(s.id)?.requiredReps || []).filter((rep) => !(s.repsCorrect[rep] > 0));
    // What band this skill was actually asked at, so `observe` can judge the
    // answer against the demand it was given rather than against wherever the
    // ladder has since moved.
    s.lastServed = { difficulty: d, kind };
    return {
      skill: s.id,
      kind,
      difficulty: d,
      scaffold: extra.scaffold || 'none',
      formCandidates: fresh,
      reps: requiredReps.length && kind === 'learn' ? requiredReps : null,
      // Practice does not have to be novel, but it must not be a loop: the
      // last handful of framings are off the table so the same sentence is
      // never served twice running.
      avoidScenes: s.recentScenes.slice(),
      check: null,
    };
  }

  /**
   * The proving run — and what makes it a transfer test rather than a lap of
   * honour.
   *
   * Drawing from the forms a learner has practised least is not, on its own,
   * transfer: "least" can still mean "four times last week". So the run is
   * built against three requirements, in order of how much they cost the
   * learner to fake:
   *
   *   · a form this learner has **never met** is preferred over every other,
   *     at every step of the run. Nothing else in the system asks a learner to
   *     recognise the skill in a shape they have not been trained on;
   *   · the run must span **two representations at least** — a claim proved
   *     only in one surface is a claim about that surface;
   *   · and it must include one **modelling** item, verbal or contextual: the
   *     translation between a situation and the algebra is the direction that
   *     collapses first when a skill has been learned as a procedure.
   *
   * The last two are enforced by *extending* the run rather than by failing it,
   * and the extension is bounded, so a learner on a skill whose band offers no
   * modelling form is not held for ever on a requirement the bank cannot meet.
   */
  /**
   * What band the sight-read is asked at on this skill.
   *
   * "Band 5" is an ordinal inside one skill's own ladder, not a standard. Across
   * this level a band-5 item runs from demandOf 6.9 to 10.1, so a sight-read
   * pinned to the ordinal asks a very different question of a multi-step
   * equation than it does of a one-step one. This caps it: no skill's sight-read
   * may be harder than the hardest sight-read the rest of the level can offer.
   * It is a one-sided outlier rule — it can only ever bind on the single
   * hardest skill, it lowers that skill no further than the second-hardest, and
   * it never goes below the gate floor.
   */
  sightReadBandFor(id) {
    const c = this.cfg;
    const floor = c.checkMinDifficulty;
    const want = Math.max(floor, c.sightReadBand);
    const lad = demandLadder();
    const row = lad[id];
    const others = this.graph.nodes.map((n) => n.id).filter((x) => x !== id && lad[x]);
    if (!row || !others.length) return want;
    const ceiling = Math.max(...others.map((x) => lad[x][want - 1]));
    let d = want;
    while (d > floor && row[d - 1] > ceiling) d--;
    return d;
  }

  /** The highest band this learner has already solved cleanly on this skill. */
  provenBand(s) {
    for (let d = 5; d >= 1; d--) if (s.bandClean[d]) return d;
    return 0;
  }

  /**
   * How long a proving run on this skill is, given what this learner has already
   * done at the gate band.
   *
   * Three unassisted items is the bar, and it stays three for anyone whose
   * gate-band record supports it. It grows — by one item per unpaid miss, to a
   * hard ceiling — for a learner who keeps arriving at the gate and missing.
   * The arithmetic is a running balance rather than a count of failed runs,
   * because a count cannot tell a slip apart from a pattern: at `gateTol` 0.8
   * the balance drifts down for anyone above about 56% at the gate band and up
   * for anyone below it, and `gateDebtFree` makes the first two net misses free
   * outright.
   */
  runLength(s, base) {
    const missed = (s.gateSeen || 0) - (s.gateClean || 0);
    const debt = Math.floor(missed - this.cfg.gateTol * (s.gateClean || 0) - this.cfg.gateDebtFree);
    return base + Math.min(this.cfg.gateDebtCap, Math.max(0, debt));
  }

  /**
   * How long the proving run is for a line that has been held before.
   *
   * It used to be two items rather than three for anybody who had ever held
   * this line — a discount on the grounds that they had proved it once. There
   * are two ways to arrive back here and they deserve opposite answers, and the
   * discount could not tell them apart:
   *
   *   · a line the learner has *never lost* and is re-proving after a long
   *     gap — a re-grant that follows a lapse caught by the spacing schedule.
   *     The evidence this discount was resting on is precisely the evidence
   *     that has just turned out to be stale, so charging less for the second
   *     claim than for the first is charging least exactly when the model has
   *     been shown to be wrong. Measured on learners coming back across days,
   *     that discount is where the hollow claims came from: the same cohort
   *     runs 7.9% hollow claims with it and 2.4% without.
   *
   * So a re-grant costs the full run. What a learner who really still knows it
   * keeps is the *road* — the sight-read is still offered, so they are still
   * three items from done and never sent back to band 1.
   */
  regrantItems() { return this.cfg.checkItems; }

  checkTask(s) {
    const forms = (FORMS_BY_SKILL[s.id] || []);
    // The proving run is never easier than the band the claim is being made
    // about, and never below the configured floor — a gate served at band 1
    // would prove nothing about a band-4 claim.
    // It is also never *harder* than the band it opened at. The band used to be
    // read fresh off the credit ladder on every item of the run, so two clean
    // solves inside a run pushed the ladder up and the third item arrived a band
    // above the two already banked. A run that answers good performance by
    // raising its own bar on the last item is not a stricter test, it is a
    // moving one, and it threw away runs that had already met the standard they
    // opened on.
    const floor = this.cfg.checkMinDifficulty;
    const d = Math.min(5, Math.max(floor, s.check.band ?? s.difficulty));
    const eligible = forms.filter((f) => d >= f.dMin && d <= f.dMax);
    const seen = (f) => (s.formsSeen[f.id]?.seen || 0);
    const unused = eligible.filter((f) => !s.check.forms.includes(f.id));
    const pool = unused.length ? unused : eligible;
    // "A form you have met least often" stops being transfer the moment a
    // learner has met all of them, which is the normal case by the time the
    // gate opens. So novelty is measured twice: a form never practised, or a
    // form whose deck of situations still holds a world this learner has never
    // worked inside. The second one is what keeps the gate honest late on.
    const novel = (f) => seen(f) === 0
      || (f.sceneKeys || []).some((key) => !(key in s.scenesSeen));
    const fresh = pool.filter(novel);
    const sorted = (fresh.length ? fresh : pool).slice()
      .sort((a, b) => (novel(b) - novel(a)) || (seen(a) - seen(b)));
    let want = sorted.slice(0, Math.max(2, Math.ceil(sorted.length / 2)));

    // What the run still owes before it can close — and it is paid *early*, not
    // at the last step. Leaving a debt unpaid extends the run, and every extra
    // unassisted item at band 4 is another chance for a learner who does know
    // this to be knocked back to the start of the gate. One modelling item
    // settles all three of the closing conditions at once, which is why the
    // scoring below counts debts paid rather than picking one debt to chase.
    const owes = [];
    if (!s.check.modelled) owes.push((f) => MODELLING_REPS.has(f.rep));
    if (!s.check.nonSymbolic) owes.push((f) => f.rep !== 'symbolic');
    if ((s.check.reps || []).length < 2) owes.push((f) => !(s.check.reps || []).includes(f.rep));
    // Debts are chased once the run has as many items left as it has claims to
    // make, and not before: the opening item of a run stays free to be the most
    // unfamiliar thing in the bank, which is the whole transfer argument, and
    // the closing items settle what the run still owes.
    const left = s.check.need - s.check.done;
    if (owes.length && left <= 2) {
      const pays = (f) => owes.reduce((a, owed) => a + (owed(f) ? 1 : 0), 0);
      const most = Math.max(...pool.map(pays));
      if (most > 0) {
        want = pool.filter((f) => pays(f) === most)
          // Among forms that settle the same debt, the honest tie-break is the
          // one that costs the learner least: novelty first, then minutes.
          .sort((a, b) => (novel(b) - novel(a))
            || (itemSeconds({ rep: a.rep, difficulty: d }) - itemSeconds({ rep: b.rep, difficulty: d }))
            || (seen(a) - seen(b)));
      }
    } else if (!s.check.novel && s.check.done === s.check.need - 1) {
      const can = pool.filter(novel);
      if (can.length) want = can;
    } else if (this.proseThin()) {
      // The run owes nothing structural, so the tie goes to a form that arrives
      // dressed in a situation. A proving run is where the schedule now spends
      // most of its unscaffolded items, and a run made entirely of bare notation
      // is both a weaker transfer claim and a session with no prose in it.
      const dressed = want.filter((f) => (f.sceneKeys || []).length);
      if (dressed.length) want = dressed;
    }
    s.lastServed = { difficulty: d, kind: 'check' };
    return {
      skill: s.id,
      kind: 'check',
      difficulty: d,
      scaffold: 'none',
      formCandidates: want.map((f) => f.id),
      reps: null,
      // Every situation this learner has already worked inside, refused.
      avoidScenes: Object.keys(s.scenesSeen),
      check: { done: s.check.done, need: s.check.need },
    };
  }

  /**
   * How much of a worked example to put in front of this item.
   *   full    — a complete solved analogue, then the live problem
   *   partial — the analogue with its last line left blank (a completion problem)
   *   none    — no support; the learner is the expert now
   */
  scaffoldFor(id) {
    const s = this.state.get(id);
    if (!s) return 'none';
    if (s.check) return 'none';
    const recentMiss = s.lastCorrect === false;
    // A cold start gets the whole worked analogue — unless the lattice below
    // this skill is already solid, in which case a completion problem is the
    // right level of support and the full example is redundant load.
    if (s.attempts < 2) return this.priorCompetence(id) >= 0.9 ? 'partial' : 'full';
    if (s.pL < 0.35 || s.consecutiveWrong >= 2) return 'full';
    if (s.pL < 0.7 || recentMiss) return 'partial';
    return 'none';
  }

  // -------------------------------------------------------------------------
  // Observation
  // -------------------------------------------------------------------------

  /**
   * Fold one observed response into the model.
   * @param {string} id skill id
   * @param {boolean} correct
   * @param {{assisted?:boolean, misconception?:string|null, form?:string, rep?:string, kind?:string}} meta
   */
  observe(id, correct, meta = {}) {
    const s = this.state.get(id);
    const n = this.nodes.get(id);
    if (!s || !n) return null;
    const p = { ...DEFAULT_BKT, ...(n.bkt || {}) };

    this.clock += 1;
    this.seq += 1;
    const now = this.now();
    // --- the belief goes stale before the answer is folded in ---------------
    // How long since this skill was last put in front of this learner, in real
    // time. See `beliefHalfLife`: a posterior nobody has tested since Friday is
    // not the posterior it was on Friday.
    this.stale(s, now, { ...DEFAULT_BKT, ...(n.bkt || {}) });
    s.attempts += 1;
    s.lastSeenAt = this.clock;
    s.lastTime = now;
    s.lastCorrect = correct;
    if (correct) s.correct += 1;
    this.recent.push(id);
    if (this.recent.length > 12) this.recent.shift();
    // Judged before anything below records it: was this item in a shape or a
    // world this learner had genuinely never worked in?
    const wasNovel = (!!meta.form && !(s.formsSeen[meta.form]?.seen))
      || (!!meta.scene && !(meta.scene in s.scenesSeen));
    if (meta.rep) { this.recentReps.push(meta.rep); if (this.recentReps.length > 8) this.recentReps.shift(); }
    this.dry = meta.scene ? 0 : this.dry + 1;
    this.sceneLog.push(meta.scene ? 1 : 0);
    if (this.sceneLog.length > 12) this.sceneLog.shift();

    if (meta.form) {
      const f = (s.formsSeen[meta.form] ||= { seen: 0, correct: 0 });
      f.seen += 1;
      if (correct && !meta.assisted) f.correct += 1;
    }
    // Which situations this skill has already been dressed in for this learner.
    // The proving run reads this and refuses to re-use them, which is what
    // turns "a form you have met less often" into "a world you have not seen".
    if (meta.scene) {
      s.scenesSeen[meta.scene] = (s.scenesSeen[meta.scene] || 0) + 1;
      s.recentScenes.push(meta.scene);
      // How far back a skill remembers the worlds it has already been dressed
      // in. It is longer than it used to be because the router now interleaves
      // harder and finishes sooner, which means more re-probes and enrichment on
      // a mastered skill inside one session; six was short enough that a session
      // could serve the same situation twice. tools/scene-audit.mjs is the gate.
      if (s.recentScenes.length > 14) s.recentScenes.shift();
    }
    if (meta.rep && correct && !meta.assisted) {
      s.repsCorrect[meta.rep] = (s.repsCorrect[meta.rep] || 0) + 1;
    }

    // --- BKT posterior given the observation ---
    const prior = s.pL;
    const pCorrect = prior * (1 - p.pSlip) + (1 - prior) * p.pGuess;
    const pIncorrect = 1 - pCorrect;
    let post = correct
      ? (prior * (1 - p.pSlip)) / Math.max(pCorrect, 1e-6)
      : (prior * p.pSlip) / Math.max(pIncorrect, 1e-6);

    // An assisted success is much weaker evidence of knowing than a clean one.
    if (correct && meta.assisted) post = prior + (post - prior) * 0.35;

    s.pL = Math.min(0.999, Math.max(0.001, post + (1 - post) * p.pTransit));

    if (correct) s.consecutiveWrong = 0; else s.consecutiveWrong += 1;
    if (correct && !meta.assisted) s.cleanRun += 1; else s.cleanRun = 0;

    if (meta.misconception) {
      s.misconceptions[meta.misconception] = (s.misconceptions[meta.misconception] || 0) + 1;
    }

    // The band this item was actually asked at. A gate item is a gate item
    // because of the demand it carried, not because of where the ladder sits by
    // the time the answer lands.
    const band = s.lastServed?.difficulty ?? s.difficulty;
    const clean = correct && !meta.assisted;

    // --- adaptive difficulty band ---
    // A credit ladder rather than a staircase: three clean solves buy a step up,
    // two misses buy a step down. That holds observed success near four in five,
    // which is where practice is hard enough to teach and easy enough to finish.
    if (correct && !meta.assisted) s.credit += 1;
    else if (!correct) s.credit -= 2;
    else s.credit += 0.34;
    if (clean) s.bandClean[band] = (s.bandClean[band] || 0) + 1;
    const wasGate = (s.lastServed?.kind === 'check' || s.lastServed?.kind === 'probe')
      && band >= this.cfg.checkMinDifficulty;
    if (wasGate) { s.gateSeen += 1; if (clean) s.gateClean += 1; }
    // Two places where three clean solves per step is the wrong price.
    //
    // Below the gate band, because no claim is made down there: the ladder is
    // for keeping *practice* near four in five, and a learner sitting at band 2
    // on a skill whose gate is band 4 is not being taught by the wait, only
    // delayed by it. Measured on learners who genuinely knew a skill and missed
    // the cold sight-read, this was the single largest waste in the system —
    // four to six band-1 and band-2 items, answered correctly every time,
    // before the engine would let them near the gate again.
    //
    // And when re-climbing to a band this learner has already solved cleanly,
    // because restoring standing you have demonstrated is not the same claim as
    // reaching it for the first time.
    //
    // A miss still costs two credits and still steps the ladder down, so a
    // learner who cannot do it is caught on the very next item and handed
    // support. This shortens the road back up; it does not remove the road down.
    if (this.cfg.fastClimb && clean && (s.difficulty < this.cfg.checkMinDifficulty
      || s.difficulty < this.provenBand(s))) {
      s.credit = Math.max(s.credit, 3);
    }
    if (s.credit >= 3) { s.difficulty = Math.min(5, s.difficulty + 1); s.credit = 0; }
    else if (s.credit <= -2) { s.difficulty = Math.max(1, s.difficulty - 1); s.credit = 0; }

    const wasMastered = s.mastered;
    let checkEvent = null;
    // Did a descent just touch its floor on this item? See `soundingFloor`.
    let landed = false;

    // --- the sight-read -----------------------------------------------------
    // One item, at the gate band, with nothing in front of it. Answer it cold
    // and it is not "evidence towards a gate" — it *is* the first item of the
    // proving run, banked with everything it proved about form, surface and
    // situation. Miss it and it costs one item: the rift teaches, as it always
    // would have, and the miss is ordinary evidence like any other.
    if (s.probe && !s.check && !s.mastered) {
      s.probe.served = (s.probe.served || 0) + 1;
      if (clean && band >= this.cfg.checkMinDifficulty) {
        s.probe = null;
        s.sightRead = 'passed';
        s.difficulty = Math.max(s.difficulty, band);
        const need = this.runLength(s, this.regrantItems(s) + this.cfg.sightReadExtra);
        s.check = {
          done: 1,
          need,
          base: need,
          forms: meta.form ? [meta.form] : [],
          reps: meta.rep ? [meta.rep] : [],
          nonSymbolic: !!meta.rep && meta.rep !== 'symbolic',
          modelled: MODELLING_REPS.has(meta.rep),
          novel: wasNovel,
          viaSightRead: true,
          band,
          // The road this run was opened by, and the clean unassisted solves
          // that were standing behind it when it opened. On this road there are
          // none: the cold item is the run's own first item, counted once, in
          // `done` above. Recorded here so the report can name what actually
          // happened instead of reciting the configured thresholds back.
          road: 'sight',
          entryRun: 0,
          entryNeed: 0,
        };
        checkEvent = 'opened';
      } else if (!clean || s.probe.served >= 2) {
        // Missed, or answered with help — either way it was not answered cold,
        // and the rift goes back to teaching. One item spent.
        s.probe = null;
        s.sightRead = 'missed';
        // Back to where placement put them — not below it. The sight-read is
        // deliberately asked two bands above where this skill would otherwise
        // start, so running the miss through the credit ladder demoted the
        // learner one band per wrong attempt *because* the question was hard:
        // the harder the probe, the worse the starting point it left behind.
        // Placement is the engine's own judgement, formed from the whole
        // mastered lattice below this skill, and one cold item asked above it
        // is not evidence against it. Miss it and it costs one item, which is
        // what the line above always claimed.
        s.difficulty = s.baseBand ?? s.difficulty;
        s.credit = 0;
      }
      return this.report(s, id, wasMastered, checkEvent);
    }

    if (s.check) {
      // --- proving run in progress ---
      if (correct && !meta.assisted) {
        s.check.done += 1;
        if (meta.form && !s.check.forms.includes(meta.form)) s.check.forms.push(meta.form);
        if (wasNovel) s.check.novel = true;
        if (meta.rep && meta.rep !== 'symbolic') s.check.nonSymbolic = true;
        if (meta.rep === 'context' || meta.rep === 'verbal') s.check.modelled = true;
        s.check.reps ||= [];
        if (meta.rep && !s.check.reps.includes(meta.rep)) s.check.reps.push(meta.rep);
        if (s.check.done >= s.check.need) {
          // The run is not complete until it has spanned more than one surface
          // and has been proved at least once on a modelling item — but it
          // cannot be extended for ever, or a skill whose band offers no such
          // form would never close.
          // Three claims the run must make before it closes: two surfaces, one
          // of them not symbolic, and one item that walks between a situation
          // and the algebra. Novelty — a form or a world this learner has never
          // practised in — is claimed *first* among the run's debts (see
          // checkTask) but is not a closing condition, because a bank can run
          // out of unseen framings for a learner while a gate must not run out
          // of ways to close.
          //
          // The bound is on how far this run has been *extended*, not on how
          // long it is: a learner carrying gate debt already opens on a longer
          // run, and reading the bound off the absolute length would let that
          // learner's run close without ever spanning a second surface — the
          // stricter gate silently dropping the transfer requirement, which is
          // the exact opposite of what the debt is for.
          const spans = s.check.nonSymbolic && s.check.reps.length >= 2 && s.check.modelled;
          if (spans || s.check.need >= (s.check.base ?? this.cfg.checkItems) + 2) {
            this.promote(s);
            checkEvent = 'passed';
          } else {
            s.check.need += 1;
          }
        }
      } else {
        // The band is deliberately *not* pinned here. Holding a learner who has
        // just failed a gate item at the gate band reads like rigour and
        // measures like abandonment: tools/simulate.mjs puts true mastery 8.4
        // points lower and the bottom ability quintile 18 points lower when the
        // band is held, because a learner who cannot yet do band 4 is then
        // served nothing but band 4. The credit ladder takes them down a step,
        // support comes back, and they climb again.
        s.check = null;
        s.cleanRun = 0;
        s.pL = Math.min(s.pL, 0.88);
        checkEvent = 'failed';
      }
    } else if (!s.mastered) {
      // Two roads to the same run. The long one is unchanged: a posterior at
      // 0.95, three clean solves, band 3 or better. The short one asks for less
      // standing but demands it at the gate band itself — two clean unassisted
      // solves at band 4+, which is a harder pair of items than the three the
      // long road accepts. Neither road weakens what the run then asks for.
      const c = this.cfg;
      const classic = s.pL >= c.pL && s.cleanRun >= c.cleanRun && s.difficulty >= c.minDifficulty;
      const fast = s.pL >= c.fastPL && s.cleanRun >= c.fastRun && band >= c.checkMinDifficulty
        && s.difficulty >= c.checkMinDifficulty;
      if (classic || fast) {
        const need = this.runLength(s, this.regrantItems(s));
        s.check = {
          done: 0, need, base: need,
          forms: [], reps: [], nonSymbolic: false, modelled: false, novel: false,
          band: Math.min(5, Math.max(c.checkMinDifficulty, s.difficulty)),
          // Which road opened it, and on how many clean unassisted solves. The
          // long road and the short one ask for different things and the two
          // are not interchangeable evidence, so the report is given both the
          // number that was met and the number that had to be met.
          road: classic ? 'long' : 'fast',
          entryRun: s.cleanRun,
          entryNeed: classic ? c.cleanRun : c.fastRun,
          entryBand: classic ? s.difficulty : band,
        };
        checkEvent = 'opened';
      }
    } else {
      // --- what happened on a line already held --------------------------
      const served = s.lastServed?.kind;
      if (served === 'deep') {
        // A rung of the sounding. It is asked above the band the claim was made
        // at, in a shape this learner has not worked, inside the same sitting —
        // which is exactly why it proves nothing about retention and is allowed
        // to prove nothing. It moves the descent and touches no standing: a
        // miss ends the run and costs the line not one point of its claim.
        this.sounding.items += 1;
        if (clean) {
          this.sounding.clean += 1;
          this.sounding.rung += 1;
          this.sounding.best = Math.max(this.sounding.best, this.sounding.rung);
          s.soundings = (s.soundings || 0) + 1;
          // A descent has a floor. Without one it is not a run, it is a queue:
          // a player who does not miss simply accumulates, and "deepest
          // sounding: 700" is a number about stamina rather than about a
          // descent. Touch the floor and the run *lands* — it is scored, it
          // pays, and the next one starts at the top.
          if (this.sounding.rung >= this.cfg.soundingFloor) {
            this.sounding.runs += 1;
            this.sounding.cleared = (this.sounding.cleared || 0) + 1;
            this.sounding.rung = 0;
            landed = true;
          }
        } else {
          if (this.sounding.rung > 0) this.sounding.runs += 1;
          this.sounding.rung = 0;
        }
      } else if (served === 'review') {
        // --- the spaced re-probe -------------------------------------------
        // This item was served *because the clock said so*: `taskFor` only calls
        // an item a review when `isDue` is true, and `isDue` is real elapsed
        // time first and attempts of separation second. So the outcome here is
        // the only outcome in the whole engine entitled to move the schedule.
        if (clean) {
          const gap = now - (s.provedTime ?? s.masteredTime ?? now);
          s.lapsePending = false;
          // Survived a walk away from the machine, rather than fifty more
          // questions. This is the number the endgame ladder is paid in, and
          // nothing that happens inside one sitting can increment it.
          if (gap >= this.cfg.durableMinutes * MINUTE) {
            s.durable = (s.durable || 0) + 1;
            s.lastDurableAt = now;
            s.longestGap = Math.max(s.longestGap || 0, gap);
          }
          s.provedTime = now;
          s.reviewStage = Math.min(this.cfg.reviewMinutes.length - 1, s.reviewStage + 1);
          s.dueTime = now + this.windowMs(s);
          s.dueAt = this.clock + this.floorFor(s);
        } else if (!correct) {
          this.lapse(s, now);
        }
      } else if (!correct) {
        // A miss on an interleaved retrieval item drawn from a held line is
        // rot wherever it is found, so it opens the same lapse path.
        this.lapse(s, now);
      }
    }

    // A clean solve at band 3 or above did not only exercise this skill: every
    // prerequisite it is built out of was used inside it. That is the knowledge
    // graph read downwards — evidence about a parent, obtained for free, which
    // buys the parent's next retention probe a little more time instead of
    // spending an item asking a question the learner just answered implicitly.
    if (clean && band >= this.cfg.minDifficulty) this.creditParents(id);

    return this.report(s, id, wasMastered, checkEvent, landed);
  }

  /**
   * Relax an untested belief back towards this skill's prior.
   *
   * Called once, before every observation, and a no-op inside a sitting. The
   * half-life is a day for a skill still being learned and this line's own
   * spacing window for one already held — the engine's own statement of how
   * long it thinks a claim about this learner stays good for.
   *
   * A clean run does not survive a night either: "three unassisted solves in a
   * row" is a claim about a sitting, and stapling Friday's two to Monday's one
   * is how a proving run turns into a filing exercise.
   */
  stale(s, now = this.now(), p = DEFAULT_BKT) {
    const idle = s.lastTime == null ? 0 : Math.max(0, now - s.lastTime);
    if (idle < this.cfg.beliefStale * MINUTE) return 0;
    const half = s.mastered ? this.windowMs(s) : this.cfg.beliefHalfLife * MINUTE;
    const keep = Math.pow(0.5, idle / Math.max(MINUTE, half));
    const base = p.pInit ?? DEFAULT_BKT.pInit;
    s.pL = base + (s.pL - base) * keep;
    s.cleanRun = 0;
    s.wentCold = (s.wentCold || 0) + 1;
    return idle;
  }

  /**
   * A held line has just been missed.
   *
   * A single miss is a lapse, not a collapse: the line keeps its standing but
   * comes back round in a couple of minutes, because the question a lapse asks
   * is "was that a slip?" and next Tuesday is too late to ask it. Miss it again
   * and the line is demoted and practice reopens, so mastery cannot rot
   * silently.
   */
  lapse(s, now = this.now()) {
    if (s.lapsePending) {
      s.mastered = false;
      s.lapsePending = false;
      s.cleanRun = 0;
      s.pL = Math.min(s.pL, 0.78);
      s.reviewStage = 0;
      s.dueAt = null;
      s.dueTime = null;
    } else {
      s.lapsePending = true;
      s.reviewStage = 0;
      s.dueTime = now + this.cfg.lapseMinutes * MINUTE;
      s.dueAt = this.clock + 2;
      s.pL = Math.min(s.pL, 0.9);
    }
  }

  /** What one observation changed, in the shape the game and the critics read. */
  report(s, id, wasMastered, checkEvent, landed = false) {
    const newlyUnlocked = !wasMastered && s.mastered
      ? this.graph.nodes.filter((n2) => n2.prereqs.includes(id) && this.isUnlocked(n2.id)).map((n2) => n2.id)
      : [];
    return {
      skill: id,
      pL: s.pL,
      mastered: s.mastered,
      justMastered: !wasMastered && s.mastered,
      newlyUnlocked,
      difficulty: s.difficulty,
      check: s.check ? { done: s.check.done, need: s.check.need } : null,
      checkEvent,
      sightRead: s.sightRead || null,
      // What the scheduler had actually called this item, and where the descent
      // stands after it — the endgame surfaces read this rather than guessing.
      served: s.lastServed?.kind || null,
      sounding: { ...this.sounding },
      soundingLanded: !!landed,
      durable: s.durable || 0,
    };
  }

  /**
   * Downstream evidence, applied upstream. Solving a two-step equation cold is
   * a one-step multiplication carried out under load; the model would be
   * throwing that away if it only ever updated the skill named on the rift.
   * Deliberately modest — it defers a probe, it never grants or restores
   * standing, and a skill already caught lapsing is left alone to be re-probed.
   */
  creditParents(id) {
    const now = this.now();
    for (const pid of this.nodes.get(id)?.prereqs || []) {
      const p = this.state.get(pid);
      if (!p || !p.mastered || p.lapsePending || p.dueTime == null) continue;
      // A little more time, once — never compounding. Every clean band-5 item
      // in the endgame is downstream evidence about something, and a deferral
      // that stacked would let a session of them push every retention probe in
      // the lattice permanently over the horizon: the schedule would quietly
      // stop existing for exactly the learner it matters most for. So the
      // deferral is capped against the rung this line is actually on.
      const win = this.windowMs(p);
      const ceiling = (p.provedTime ?? now) + Math.round(win * 1.4);
      p.dueTime = Math.min(ceiling, Math.max(p.dueTime, now + Math.round(win * 0.4)));
      p.dueAt = Math.max(p.dueAt ?? 0, this.clock + Math.round(this.floorFor(p) * 0.4));
      p.creditedBy = (p.creditedBy || 0) + 1;
    }
  }

  promote(s) {
    const regrant = s.everMastered;
    const now = this.now();
    s.mastered = true;
    s.everMastered = true;
    s.masteredAt = this.clock;
    s.masteredTime = s.masteredTime ?? now;
    // The gap the first re-probe will be measured against starts here.
    s.provedTime = now;
    // A claim made in three items off a cold sight-read is the same claim, made
    // on the same evidence — but it is the one this engine has had least chance
    // to contradict, so it comes back round on the shortest schedule the
    // spacing table has, and it is flagged so a teacher-facing view can say so.
    s.viaSightRead = !!s.check?.viaSightRead;
    // --- what actually proved it ------------------------------------------
    // The receipt for this claim, frozen at the instant it was granted.
    //
    // Everything here was previously reconstructed by the report from the
    // *configuration* — "the gate asks for three, so print three" — which is
    // not evidence, it is the gate quoting itself. It cannot disagree with the
    // claim it sits under, so it cannot audit it, and on the short road it
    // printed six items of evidence over a learner who had answered four
    // questions. These are the counts this learner actually put up:
    //
    //   entryRun   clean unassisted solves standing when the run opened, and
    //              the number that road required. Zero on the sight-read road,
    //              where the cold item *is* the run's first item and is
    //              counted once, in `checkDone`.
    //   checkDone  items of the proving run, unassisted, at the gate band —
    //              including the extensions the run demanded of itself.
    //   items      entryRun + checkDone: the total this claim rests on, which
    //              can now be laid beside the question count without lying.
    //
    // It is deliberately a snapshot and not a live read: `cleanRun` keeps
    // moving after promotion (a missed re-probe zeroes it), so a live read of
    // it is a number about last Tuesday, not about the claim.
    const c = s.check || {};
    const entryRun = c.entryRun ?? 0;
    const checkDone = c.done ?? 0;
    s.provenBy = {
      road: c.road || (c.viaSightRead ? 'sight' : 'long'),
      entryRun,
      entryNeed: c.entryNeed ?? this.cfg.cleanRun,
      entryBand: c.entryBand ?? c.band ?? this.cfg.checkMinDifficulty,
      checkDone,
      checkNeed: c.need ?? checkDone,
      checkBase: c.base ?? c.need ?? checkDone,
      band: c.band ?? this.cfg.checkMinDifficulty,
      reps: [...(c.reps || [])],
      forms: [...(c.forms || [])],
      novel: !!c.novel,
      items: entryRun + checkDone,
      pL: s.pL,
      regrant,
      clock: this.clock,
      at: Date.now(),
    };
    s.check = null;
    s.reviewStage = 0;
    s.dueTime = now + this.windowMs(s);
    s.dueAt = this.clock + this.floorFor(s);
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------
  integrity() {
    const total = this.graph.nodes.length;
    const done = [...this.state.values()].filter((s) => s.mastered).length;
    return total ? done / total : 0;
  }

  softIntegrity() {
    const vals = [...this.state.values()];
    if (!vals.length) return 0;
    return vals.reduce((a, s) => a + (s.mastered ? 1 : s.pL), 0) / vals.length;
  }

  /** Which misconception has this learner shown most on this skill? */
  topMisconception(id) {
    const s = this.state.get(id);
    if (!s) return null;
    let best = null, n = 0;
    for (const [k, v] of Object.entries(s.misconceptions)) if (v > n) { n = v; best = k; }
    return best;
  }

  /**
   * The record's own identity, for anything that keeps a second store beside
   * this one. `seq` is the number of observations this model has taken, so a
   * ledger that has seen fewer is provably behind it and one that has seen more
   * was written against a different save.
   */
  stamp() {
    return { recordId: this.recordId, seq: this.seq, clock: this.clock };
  }

  save() {
    return {
      v: 3,
      recordId: this.recordId,
      seq: this.seq,
      clock: this.clock,
      // When this record was last written, and how deep the descent got. The
      // spacing schedule is wall-clock, so a save that could not say when it was
      // made would be a schedule with no way of noticing a night went by.
      savedAt: this.now(),
      sounding: { ...this.sounding },
      recent: this.recent.slice(-12),
      recentReps: this.recentReps.slice(-8),
      skills: Object.fromEntries([...this.state].map(([k, v]) => [k, v])),
    };
  }

  load(saved) {
    if (!saved) return;
    // A save written before records were stamped keeps the id this engine
    // generated at construction: it is a new identity for an old record, which
    // is exactly right — nothing has ever been reconciled against it before.
    if (saved.recordId) this.recordId = saved.recordId;
    this.seq = Number.isFinite(saved.seq) ? saved.seq
      // Pre-stamp saves: the closest honest count of observations is the sum of
      // the per-skill attempt counts, which is what `clock` also counts.
      : Object.values(saved.skills || {}).reduce((a, v) => a + (v.attempts || 0), 0);
    this.clock = saved.clock || 0;
    this.recent = Array.isArray(saved.recent) ? saved.recent.slice(-12) : [];
    this.recentReps = Array.isArray(saved.recentReps) ? saved.recentReps.slice(-8) : [];
    // The descent's record survives; the descent itself does not. Coming back
    // tomorrow standing eight rungs down is not where a run left off, it is a
    // run that was never finished.
    if (saved.sounding) {
      this.sounding = {
        ...this.sounding, ...saved.sounding, rung: 0,
      };
    }
    const now = this.now();
    for (const [k, v] of Object.entries(saved.skills || {})) {
      if (!this.state.has(k)) continue;
      const base = this.state.get(k);
      this.state.set(k, {
        ...base, ...v,
        misconceptions: { ...(v.misconceptions || {}) },
        formsSeen: { ...(v.formsSeen || {}) },
        // A save written before situations were tracked simply has none yet.
        scenesSeen: { ...(v.scenesSeen || {}) },
        recentScenes: Array.isArray(v.recentScenes) ? v.recentScenes.slice(-14) : [],
        repsCorrect: { ...(v.repsCorrect || {}) },
        bandClean: { ...(v.bandClean || {}) },
        gateSeen: v.gateSeen || 0,
        gateClean: v.gateClean || 0,
        // A save written before the sight-read existed simply has not been
        // offered one, and a skill it never touched still gets its chance.
        probe: v.probe || (v.placed && !v.attempts && this.cfg.sightRead
          ? { band: this.cfg.checkMinDifficulty } : (v.probe ?? null)),
        // The receipt for a claim granted before receipts existed cannot be
        // invented, and inventing one is the whole defect this fixes. It stays
        // null and the report says the evidence predates the record.
        provenBy: v.provenBy ? { ...v.provenBy } : null,
        durable: v.durable || 0,
        // --- the wall clock, carried across the break ------------------------
        // A save written before the schedule was measured in time has attempt
        // counts and nothing else. Its lines have, by definition, been away
        // from the machine for however long the tab was shut, so they come back
        // due now — which is both the honest reading and the generous one: the
        // learner is asked, and the answer decides.
        dueTime: sane(v.dueTime, now) ?? (v.mastered ? now : null),
        provedTime: sane(v.provedTime, now) ?? sane(v.masteredTime, now) ?? null,
        masteredTime: sane(v.masteredTime, now) ?? null,
        lastTime: sane(v.lastTime, now) ?? null,
      });
    }
  }
}

/**
 * The demand of every (skill, band) pair, measured off the shipping bank.
 *
 * Built once, lazily, from the same `demandOf` that tools/validate-items.mjs
 * gates the build on — about 20ms — so nothing in this file has to take the
 * band ordinals at their word.
 */
let LADDER = null;
function demandLadder() {
  // `SKILLS` is the live registry (src/content/registry.js), so a course pack
  // loaded after the first engine was built adds rows to it. Memoise per skill
  // rather than per call, or the ladder silently has no opinion about the
  // skills of the second unit.
  if (LADDER && SKILLS.every((s) => LADDER[s])) return LADDER;
  LADDER = LADDER || {};
  for (const s of SKILLS) {
    if (LADDER[s]) continue;
    const row = [];
    for (let d = 1; d <= 5; d++) {
      let sum = 0, n = 0;
      for (let i = 0; i < 12; i++) {
        try { sum += demandOf(generate(s, d, (i * 104729 + d * 7919 + s.length * 31) >>> 0)); n++; }
        catch { /* a seed that will not build says nothing about demand */ }
      }
      row.push(n ? sum / n : 0);
    }
    LADDER[s] = row;
  }
  return LADDER;
}

function blank(n) {
  return {
    id: n.id,
    pL: (n.bkt || DEFAULT_BKT).pInit,
    cleanRun: 0,
    consecutiveWrong: 0,
    credit: 0,
    everMastered: false,
    lapsePending: false,
    // Items asked of this learner *as gate items* at the gate band or above,
    // and how many of them were clean. The proving run's memory.
    gateSeen: 0,
    gateClean: 0,
    // Clean unassisted solves, counted by the band they were asked at.
    bandClean: {},
    placed: false,
    attempts: 0,
    correct: 0,
    mastered: false,
    masteredAt: null,
    reviewStage: 0,
    // The spacing schedule, on both clocks. `dueTime` is the schedule; `dueAt`
    // is a floor in attempts underneath it. A probe needs both.
    dueAt: null,
    dueTime: null,
    // Wall-clock: when this line was last proved (granted, or a re-probe
    // survived), when it was first granted, and when it was last touched at all.
    provedTime: null,
    masteredTime: null,
    lastTime: null,
    // Re-probes this line has survived across a real walk away from the
    // machine. The one number in the record that a single sitting cannot move.
    durable: 0,
    lastDurableAt: null,
    longestGap: 0,
    lastSeenAt: null,
    lastCorrect: null,
    misconceptions: {},
    formsSeen: {},
    scenesSeen: {},
    recentScenes: [],
    repsCorrect: {},
    check: null,
    difficulty: 1,
    // Where practice restarts if the sight-read does not land.
    baseBand: 1,
    // The pending sight-read, and how it went once it is spent.
    probe: null,
    sightRead: null,
    viaSightRead: false,
    // The receipt written by promote(): what this claim was actually granted
    // on. Null until there is a claim, and never reconstructed from config.
    provenBy: null,
    lastServed: null,
    openedAt: null,
  };
}

/**
 * An id for one learner record. It never leaves the device unless a teacher
 * exports the record on purpose, and it identifies a *save*, not a person —
 * which is the whole point: two stores can then prove they describe the same
 * save rather than assuming it.
 */
function newRecordId() {
  const rnd = globalThis.crypto?.randomUUID?.();
  if (rnd) return rnd;
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const SEED_CAP = 0.80;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * A stored wall-clock stamp, read defensively.
 *
 * A schedule kept in real time is a schedule that trusts the device's clock,
 * and a device's clock can be wrong, can be changed by hand, and moves when a
 * laptop crosses a timezone. A stamp that is not a number is no stamp; a stamp
 * absurdly far in the future is a clock that has since moved backwards, and
 * parking a learner's line behind it for six weeks is the one failure mode
 * worth writing code against. Such a stamp is read as "now" — the line is
 * asked, and the answer decides.
 */
const MAX_AHEAD = 40 * 24 * 60 * MINUTE;
function sane(v, now) {
  if (!Number.isFinite(v)) return null;
  if (v > now + MAX_AHEAD) return now;
  return v;
}

/** Every ancestor of a node in the knowledge graph. */
export function allPrereqs(graph, id, out = new Set()) {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n) return out;
  for (const p of n.prereqs) {
    if (out.has(p)) continue;
    out.add(p);
    allPrereqs(graph, p, out);
  }
  return out;
}
