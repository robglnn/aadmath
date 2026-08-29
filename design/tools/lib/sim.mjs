/**
 * A SECOND INSTRUMENT.
 *
 * This is not tools/simulate.mjs. It was written from scratch, against the same
 * documented learner model, for one reason: the project rule is that the
 * instrument is the usual bottleneck, and two of this build's headline numbers
 * (the test-out p90, and the frozen-competence clear rates) have only ever been
 * produced by one program. A figure with one witness is a figure nobody has
 * checked.
 *
 * What it shares with tools/simulate.mjs: the REAL engine
 * (src/learn/mastery.js), the REAL item bank (src/learn/generators.js), the
 * REAL cost model (itemSeconds), and the REAL graph. Nothing about the gate is
 * re-stated here.
 *
 * What it does NOT share: a single line of scheduling or measurement code. The
 * learner model below is re-implemented from the specification written in that
 * file's header rather than copied from its body, and every figure this
 * directory prints is computed here.
 *
 * WHAT IT MEASURES THAT THE OTHER INSTRUMENT DOES NOT
 *
 *   · elapsed minutes as well as contact minutes. "A student tests out in two
 *     minutes" is a sentence about the clock on the wall, and the shipping
 *     figure is the sum of the seconds of items served ON THAT SKILL — which
 *     is not the same number the moment the router interleaves anything.
 *   · the whole per-skill trace with the engine's own state read BEFORE each
 *     item, so "the run ended", "the run was charged", "the learner was not yet
 *     steady" are counted rather than inferred.
 *   · retention on a named night, off the same wall clock the engine schedules
 *     on.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MasteryEngine, itemSeconds } from '../../../src/learn/mastery.js';
import { FORMS_BY_SKILL, generate, demandOf } from '../../../src/learn/generators.js';
import { registerPack } from '../../../src/content/registry.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Load one unit's graph and register its pack, without going through tools/. */
export async function loadLattice(unitId = 'algebra1-l1') {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'content/courses.json'), 'utf8'));
  let unit = null;
  for (const c of manifest.courses) for (const u of c.units || []) if (u.id === unitId) unit = u;
  if (!unit) throw new Error(`no unit "${unitId}"`);
  const graph = JSON.parse(await readFile(path.join(ROOT, 'content', unit.graph), 'utf8'));
  if (unit.pack) {
    const mod = await import(path.join(ROOT, 'src/content/packs', `${unit.pack}.js`));
    registerPack(mod.default);
  }
  // A unit read on its own: prerequisites that live in an earlier unit are
  // dropped, which is how the shipping boot resolves a standalone lattice.
  const ids = new Set(graph.nodes.map((n) => n.id));
  return { ...graph, nodes: graph.nodes.map((n) => ({ ...n, prereqs: (n.prereqs || []).filter((p) => ids.has(p)) })) };
}

// ---------------------------------------------------------------------------
// The difficulty ladder, measured off the real bank
// ---------------------------------------------------------------------------

const DEMAND_LO = 0.22, DEMAND_HI = 0.84;

/**
 * Mean `demandOf` for every (skill, band) cell, and the same numbers mapped
 * onto the response scale. The SHAPE is the bank's; the only free parameters
 * are the two endpoints, exactly as the shipping instrument states.
 */
export function measureLadder(skills, samples = 400) {
  const raw = {};
  let lo = Infinity, hi = -Infinity;
  for (const s of skills) {
    raw[s] = [];
    for (let d = 1; d <= 5; d++) {
      let sum = 0, n = 0;
      for (let i = 0; i < samples; i++) {
        try { sum += demandOf(generate(s, d, (i * 104729 + d * 7919 + s.length * 31) >>> 0)); n++; } catch { /* unbuildable seed */ }
      }
      const m = n ? sum / n : 0;
      raw[s][d - 1] = m;
      lo = Math.min(lo, m); hi = Math.max(hi, m);
    }
  }
  const demand = {};
  for (const s of skills) demand[s] = raw[s].map((m) => DEMAND_LO + (DEMAND_HI - DEMAND_LO) * (m - lo) / Math.max(1e-9, hi - lo));
  return { raw, demand, lo, hi };
}

/** Which framings each form's deck can produce, sampled off the real generator. */
export function measureScenes(skills) {
  const out = {};
  for (const s of skills) {
    for (const f of FORMS_BY_SKILL[s]) {
      const found = new Set();
      for (let i = 0; i < 48; i++) {
        const d = f.dMin + (i % (f.dMax - f.dMin + 1));
        try {
          const it = generate(s, d, (i * 1103515245 + 12345 + s.length * 31) >>> 0, { form: f.id });
          if (it.scene) found.add(it.scene);
        } catch { /* unbuildable seed */ }
      }
      out[`${s}/${f.id}`] = [...found];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The learner
// ---------------------------------------------------------------------------

export const SHARPNESS = 6.0;
export const SLIP = 0.06;
export const STICKY_RATE = 0.35;
export const GAIN = {
  studyExample: 0.26,
  completion: 0.30,
  errorFeedback: 0.42,
  assistedWin: 0.30,
  cleanWin: 0.24,
  retrieval: 0.26,
};
export const DECAY = 0.0018;
export const GAP_POW = Number(process.env.SIM_GAP_POW || 0.35);
export const PERMA = Number(process.env.SIM_PERMA || 0.60);
export const GAP_HOURS = 24;
export const GAP_GROWTH = Number(process.env.SIM_GROWTH || 2.5);
const HOUR = 3600e3;
/** Monday, 09:00 UTC. Every learner's first item lands here. */
export const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);

/**
 * How often a miss is answered with mathematics rather than the prompt read
 * back. Pinned by `SIM_FEEDBACK` because src/learn/echo.js is owned by another
 * lane and is being edited while this runs; left unpinned it is measured, and
 * every caller prints whichever it used.
 *
 * It moves nothing in the test-out or frozen cohorts — a frozen learner does
 * not learn at all, and a learner at competence 0.95 gains
 * `lr * w * (1 - 0.95)`, which is under a thousandth per item — so those
 * figures are independent of it by construction. It matters to the ordinary
 * population and to the retention cohorts, and it is reported there.
 */
export async function feedbackRate(skills) {
  if (process.env.SIM_FEEDBACK) return { rate: Number(process.env.SIM_FEEDBACK), per: null, pinned: true };
  const { echoScript } = await import('../../../src/learn/echo.js');
  const items = (await import('../../../content/lang/items.en.js')).default;
  const restatement = items['echo.theTear'];
  const nrm = (t) => String(t).replace(/\s+/g, '');
  const per = {};
  let hit = 0, all = 0;
  for (const s of skills) {
    for (const f of FORMS_BY_SKILL[s]) {
      let h = 0, a = 0;
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (let i = 0; i < 3; i++) {
          let item;
          try { item = generate(s, d, (i * 2654435761 + d * 40503 + s.length * 7919) >>> 0, { form: f.id }); } catch { continue; }
          for (const dg of (item.diagnostics || []).slice(0, 4)) {
            const rows = echoScript({ item, analogue: null, entry: dg.value, tier: 1 }).rows.filter((r) => r.latex);
            a++;
            const bare = rows.length === 1 && nrm(rows[0].latex) === nrm(item.latex) && rows[0].why === restatement;
            if (!bare) h++;
          }
        }
      }
      per[`${s}/${f.id}`] = a ? h / a : 0;
      hit += h; all += a;
    }
  }
  return { rate: all ? hit / all : 0, per, pinned: false };
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gauss = (rnd) => {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * One simulated learner, driven through the real engine.
 *
 * @param {object} world  {graph, skills, demand, scenes, repOf, feedback}
 * @param {number} seed
 * @param {object} opts
 *   knows(skill)   hidden competence to seed a skill at, or null
 *   frozen         competence neither rises nor falls: the psychometric arm
 *   budget         items
 *   cfg            {k: v} written onto engine.cfg AFTER construction
 *   sessions       number of sittings; 0 = one unbroken sitting
 *   sessionMinutes minutes of work per sitting
 *   gapHours       wall-clock hours between sittings
 *   watch(e)       per-item hook, with the engine's state read BEFORE the item
 */
export function runLearner(world, seed, opts = {}) {
  const { graph, skills, demand, scenes, repOf, feedback } = world;
  const budget = opts.budget || 800;
  const rnd = mulberry(seed);
  const theta = clamp(gauss(rnd), -2.5, 2.5);
  const lr = 0.12 + 0.18 * sigmoid(theta * 1.1);
  let sticky = rnd() < STICKY_RATE ? skills[Math.floor(rnd() * skills.length)] : null;
  const rateFor = (s) => (s === sticky ? lr * 0.5 : lr);

  const engine = new MasteryEngine(graph);
  let vnow = T0 + (seed % 977) * 37_000;
  engine.setClock(() => vnow);
  for (const [k2, v2] of Object.entries(opts.cfg || {})) engine.cfg[k2] = v2;
  // A candidate change to the engine, applied to the REAL engine object rather
  // than modelled. See design/tools/lib/patches.mjs — every arm in the frontier
  // table is one of these, so a proposal is graded on the shipping code with one
  // method replaced and nothing else.
  if (opts.patch) opts.patch(engine);

  const k = new Map();
  const repSeen = new Map();
  const stability = new Map();
  const strength = new Map();
  for (const s of skills) {
    // Drawn for every cohort in the same order, so a seeded learner is the
    // ordinary learner of that seed with knowledge already in place.
    k.set(s, clamp(0.10 + 0.10 * sigmoid(theta) + 0.06 * rnd(), 0, 0.4));
    repSeen.set(s, {});
    stability.set(s, 1);
    strength.set(s, 1);
  }
  if (opts.unlock) {
    for (const s of skills) {
      if (s === opts.unlock) continue;
      const st = engine.get(s);
      engine.place(st);
      st.mastered = true; st.everMastered = true; st.probe = null;
      st.masteredAt = 0; st.masteredTime = vnow; st.provedTime = vnow;
      st.dueTime = vnow + 1e13; st.dueAt = 1e9;
      // A HELD LINE WITH NO FORM HISTORY IS NOT A HELD LINE.
      //
      // Marking the rest of the lattice mastered and leaving `formsSeen` empty
      // makes every shape of it novel, so the endgame descent picks those lines
      // (`soundingPick` prefers a bank the learner has not worked), serves a
      // band-5 form nobody has ever met, and one miss opens a hole that
      // WITHDRAWS the prerequisite — which then blocks the node under test,
      // because `promote` refuses a claim on a line whose prerequisites are not
      // held. Measured on the shipping engine: 2.1 to 2.6 pre-held lines are
      // knocked over per learner against 0.1 withdrawals of the target, so the
      // diagnostic was mostly reporting on its own scaffolding.
      //
      // So a line the harness declares held arrives with the history a held
      // line really has: one clean unassisted solve on every shape of it.
      if (opts.unlockClean !== false) {
        for (const f of FORMS_BY_SKILL[s] || []) st.formsSeen[f.id] = { seen: 1, items: 1, correct: 1, at: 0 };
      }
    }
  }
  if (opts.knows) {
    for (const s of skills) {
      const known = opts.knows(s);
      if (known == null) continue;
      k.set(s, known);
      if (s === sticky) sticky = null;
      for (const f of FORMS_BY_SKILL[s]) repSeen.get(s)[f.rep] = 2;
      stability.set(s, 3);
      strength.set(s, 2.5);
    }
  }

  const frozen = !!opts.frozen;
  const peak = new Map(skills.map((s) => [s, k.get(s)]));
  const learn = frozen ? () => {} : (s, w) => {
    const v = clamp(k.get(s) + rateFor(s) * w * (1 - k.get(s)), 0, 1);
    k.set(s, v);
    if (v > (peak.get(s) || 0)) peak.set(s, v);
  };

  // --- what is measured -----------------------------------------------------
  const spent = new Map(skills.map((s) => [s, { items: 0, seconds: 0 }]));
  const firstTouch = new Map();       // skill -> {seconds, vnow, step} of its first item
  const cleared = new Map();          // skill -> the whole shape of the first claim
  const claims = [];
  let seconds = 0;
  let items = 0;
  const sessionTrace = [];
  const sessions = opts.sessions || 0;
  const sessionCap = (opts.sessionMinutes ?? 22) * 60;
  const gapHours = opts.gapHours ?? 24;
  const gpow = opts.gapPow ?? GAP_POW;
  const perma = opts.perma ?? PERMA;
  let sitting = 1, sessionSeconds = 0;
  // Every cold re-probe the schedule actually called for, stamped with the day
  // it landed on and whether it came back right. This is the retention ledger.
  const probes = [];
  // When each line was FIRST proved, on the wall clock. "Five nights after the
  // claim" is the question retention is actually about, and it is a different
  // question from "night five of the course".
  const provedAt = new Map();
  // Claims the engine GRANTED and then took away, and what took them: a missed
  // cold re-probe ('lapse'), or a shape that went never-once-solved on a line
  // already held ('formFloor'). `observe` reports both; nothing in the shipping
  // instrument counts either.
  const withdrawn = [];
  /** Item-time during which some held line carried an unanswered shape. */
  const exposure = { items: 0, seconds: 0, heldItems: 0, lines: new Set() };

  for (let step = 0; step < budget; step++) {
    const objective = engine.next();
    if (!objective) break;
    const task = engine.taskFor(objective.id) || {
      skill: objective.id, kind: 'learn', difficulty: 1, scaffold: 'none', formCandidates: [],
    };
    const forms = FORMS_BY_SKILL[task.skill];
    const pool = (task.formCandidates && task.formCandidates.length)
      ? task.formCandidates
      : forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax).map((f) => f.id);
    const form = pool[Math.floor(rnd() * pool.length)] || forms[0].id;
    const rep = repOf[`${task.skill}/${form}`] || 'symbolic';
    const bank = scenes[`${task.skill}/${form}`] || [];
    let scene = '';
    if (bank.length) {
      const avoid = new Set(task.avoidScenes || []);
      const open = bank.filter((x) => !avoid.has(x));
      const from = open.length ? open : bank;
      scene = from[Math.floor(rnd() * from.length)];
    }
    if (!firstTouch.has(task.skill)) firstTouch.set(task.skill, { seconds, vnow, step });

    if (!frozen) for (const s of skills) k.set(s, k.get(s) * (1 - DECAY / stability.get(s)));

    const spaced = task.kind === 'review' || task.kind === 'retrieval';
    const retrievalOnly = task.kind === 'deep';
    if (task.scaffold === 'full') learn(task.skill, GAIN.studyExample);
    else if (task.scaffold === 'partial') learn(task.skill, GAIN.completion);

    const exposures = repSeen.get(task.skill)[rep] || 0;
    const novelty = 0.15 * Math.exp(-0.7 * exposures);
    const support = task.scaffold === 'full' ? 0.13 : task.scaffold === 'partial' ? 0.06 : 0;
    const dem = demand[task.skill][clamp(task.difficulty, 1, 5) - 1];
    let assisted = task.scaffold !== 'none';
    let solved = false;
    const durableBefore = engine.get(task.skill)?.durable || 0;
    // The learner's true competence BEFORE the answer. Recorded because the
    // answer itself teaches: a passed re-probe earns the retrieval gain, so a
    // figure read afterwards is contaminated by its own outcome.
    const kBefore = k.get(task.skill);

    // The engine's own reading of this learner, taken BEFORE the answer lands.
    const st0 = engine.get(task.skill);
    let gs = 0, gc = 0;
    for (const x of engine.state.values()) { gs += x.gateSeen || 0; gc += x.gateClean || 0; }
    const before = {
      steady: engine.steadyAtGate(),
      gateSeen: gs, gateClean: gc,
      need: st0.check?.need ?? 0, done: st0.check?.done ?? 0,
      base: st0.check?.base ?? 0, missed: st0.check?.missed ?? 0,
      ext: st0.check?.ext ?? 0, formExt: st0.check?.formExt ?? 0,
      road: st0.check?.road ?? null,
      pL: st0.pL, band: st0.difficulty,
      holes: engine.weakForms(st0).slice(),
      gateSeenHere: st0.gateSeen || 0, gateCleanHere: st0.gateClean || 0,
      mastered: st0.mastered,
      probe: !!st0.probe,
      hole: task.check?.hole ?? null,
      // Read before `observe` moves them: the rung this line was on and when it
      // was last proved, which is what makes the gap a real gap.
      stage: st0.reviewStage || 0,
      provedTime: st0.provedTime ?? null,
      durable: st0.durable || 0,
      dueTime: st0.dueTime ?? null,
    };
    const events = [];
    let tries = 0;
    for (let attempt = 0; attempt < 3 && !solved; attempt++) {
      const eff = clamp(k.get(task.skill) * (1 - novelty) + support - (task.skill === sticky ? 0.10 : 0), 0, 1);
      const sk = sigmoid(SHARPNESS * (eff - dem));
      const guess = attempt >= 2 ? 1 / 3 : 0.02;
      const p = (1 - SLIP) * (guess + (1 - guess) * sk);
      items++; tries++;
      let res;
      if (rnd() < p) {
        res = engine.observe(task.skill, true, { assisted, form, rep, scene, kind: task.kind });
        learn(task.skill, assisted ? GAIN.assistedWin : GAIN.cleanWin);
        if (spaced) { learn(task.skill, GAIN.retrieval); stability.set(task.skill, stability.get(task.skill) + 0.7); }
        else if (retrievalOnly) learn(task.skill, GAIN.retrieval);
        if ((engine.get(task.skill)?.durable || 0) > durableBefore) {
          strength.set(task.skill, Math.min(60, strength.get(task.skill) * GAP_GROWTH));
        }
        repSeen.get(task.skill)[rep] = exposures + 1;
        solved = true;
      } else {
        res = engine.observe(task.skill, false, { assisted: true, form, rep, scene, kind: task.kind });
        const answered = rnd() < (feedback[`${task.skill}/${form}`] ?? world.feedbackRate ?? 0);
        learn(task.skill, answered ? GAIN.errorFeedback : GAIN.studyExample);
        assisted = true;
      }
      if (res?.checkEvent) events.push(res.checkEvent);
      if (res?.justWithdrawn) {
        withdrawn.push({ skill: task.skill, why: res.withdrawnFor, kind: task.kind, band: task.difficulty, day: (vnow - T0) / (24 * HOUR), k: k.get(task.skill) });
      }
      if (res?.justMastered) {
        const ft = firstTouch.get(task.skill);
        const stc = engine.get(task.skill);
        claims.push({
          skill: task.skill, k: k.get(task.skill), day: Math.floor((vnow - T0) / (24 * HOUR)),
          // The engine's own receipt, frozen at the instant of the claim, and
          // the raw form ledger beside it — so an audit reads what the engine
          // recorded rather than a second copy of the same rule.
          provenBy: stc.provenBy ? { ...stc.provenBy } : null,
          holes: engine.weakForms(stc).slice(),
          servedHoles: Object.entries(stc.formsSeen || {})
            .filter(([, r]) => (r?.items ?? r?.seen ?? 0) >= 1 && (r?.correct || 0) < 1)
            .map(([f]) => f),
          gateFloor: engine.gateFloorFor(task.skill),
          contact: spent.get(task.skill).seconds
            + itemSeconds({ rep, difficulty: task.difficulty, scaffold: task.scaffold, attempts: tries }),
          elapsed: (vnow - ft.vnow) / 1000,
          items: spent.get(task.skill).items + 1,
        });
      }
    }
    if (!solved) learn(task.skill, GAIN.studyExample);

    const cost = itemSeconds({ rep, difficulty: task.difficulty, scaffold: task.scaffold, attempts: tries });
    seconds += cost;
    vnow += cost * 1000;
    sessionSeconds += cost;
    const sp = spent.get(task.skill);
    sp.items += 1;
    sp.seconds += cost;

    // A cold re-probe the wall clock actually called for. The one event in the
    // engine that can say anything about retention, so it is logged whole.
    if (task.kind === 'review') {
      const st = engine.get(task.skill);
      probes.push({
        skill: task.skill,
        day: (vnow - T0) / (24 * HOUR),
        sitting,
        // Hours since this line was last proved — the gap the answer is
        // evidence about. Read off the state as it stood BEFORE the answer,
        // because `observe` moves `provedTime` the moment a re-probe passes.
        gapHours: before.provedTime == null ? 0 : (vnow - before.provedTime) / HOUR,
        stage: before.stage,
        wasDurable: before.durable,
        clean: solved && tries === 1,
        solved,
        durable: (engine.get(task.skill)?.durable || 0) > durableBefore,
        k: kBefore,
        kAfter: k.get(task.skill),
        band: task.difficulty,
        rep,
        demand: dem,
        novelty,
        // Nights since the claim on this line was first granted.
        sinceClaim: provedAt.has(task.skill) ? (vnow - provedAt.get(task.skill)) / (24 * HOUR) : null,
      });
    }

    if (!cleared.has(task.skill) && engine.get(task.skill).mastered) {
      provedAt.set(task.skill, vnow);
      const ft = firstTouch.get(task.skill);
      cleared.set(task.skill, {
        items: sp.items,
        contact: sp.seconds,                       // seconds of items ON this skill
        elapsed: (vnow - ft.vnow) / 1000,          // wall clock since its first item
        at: step + 1,
        runElapsed: seconds,                        // seconds since the run began
        day: (vnow - T0) / (24 * HOUR),
        sitting,
      });
    }

    // --- THE STANDING INVARIANT ---------------------------------------------
    // Asked of every line on every item, not only at the moment a claim is
    // made: is any line standing HELD while a shape of it that this learner was
    // SERVED has never once been solved unaided? Zero is what the shipping
    // engine produces. A design that lets the claim stand while the shape is
    // re-asked produces a short non-zero window, and the size of that window is
    // the whole of what it costs — so it is measured in items and in seconds
    // rather than argued about.
    for (const sk of skills) {
      const st = engine.get(sk);
      if (!st.mastered) continue;
      let hole = false;
      for (const rec of Object.values(st.formsSeen || {})) {
        if ((rec?.items ?? rec?.seen ?? 0) >= 1 && (rec?.correct || 0) < 1) { hole = true; break; }
      }
      if (hole) { exposure.items += 1; exposure.seconds += cost; exposure.lines.add(sk); }
    }
    exposure.heldItems += [...skills].filter((sk) => engine.get(sk).mastered).length;

    if (opts.watch) {
      opts.watch({
        step, skill: task.skill, kind: task.kind, band: task.difficulty,
        scaffold: task.scaffold, rep, form, tries, solved, cost,
        mastered: engine.get(task.skill).mastered,
        sightRead: engine.get(task.skill).sightRead,
        check: engine.get(task.skill).check
          ? { done: engine.get(task.skill).check.done, need: engine.get(task.skill).check.need }
          : null,
        checkExt: engine.get(task.skill).check?.ext ?? null,
        checkFormExt: engine.get(task.skill).check?.formExt ?? null,
        holesAfter: engine.weakForms(engine.get(task.skill)).slice(),
        before, events, seconds, vnow,
      });
    }

    if (sessions && sessionSeconds >= sessionCap) {
      sessionTrace.push({ n: sitting, items, seconds, durable: engine.durableCount(), ...score(engine, skills, k) });
      if (sitting >= sessions) break;
      sitting++;
      sessionSeconds = 0;
      if (!frozen) {
        for (const s of skills) {
          const floor = perma * (peak.get(s) || 0);
          const keep = Math.pow(1 + gapHours / (GAP_HOURS * strength.get(s)), -gpow);
          k.set(s, Math.max(floor, floor + (k.get(s) - floor) * keep));
        }
      }
      vnow += gapHours * HOUR;
    }
  }
  if (sessions && sessionTrace.length < sitting) {
    sessionTrace.push({ n: sitting, items, seconds, durable: engine.durableCount(), ...score(engine, skills, k) });
  }

  return {
    theta, lr, items, seconds, spent, cleared, claims, probes, sessionTrace, provedAt, withdrawn, exposure,
    k, peak, strength, gapPow: gpow, perma, sittings: sitting,
    durable: engine.durableCount(),
    heldSet: new Set(skills.filter((s) => engine.get(s).mastered)),
    everSet: new Set(skills.filter((s) => engine.get(s).everMastered)),
    reviewStages: Object.fromEntries(skills.map((s) => [s, engine.get(s).reviewStage])),
    ...score(engine, skills, k),
  };
}

export const TRUE_MASTERY = 0.85;
export const HOLLOW = 0.75;

function score(engine, skills, k) {
  let trueMastered = 0, engineMastered = 0, hollow = 0;
  for (const s of skills) {
    const kk = k.get(s);
    const m = engine.get(s).mastered;
    if (kk >= TRUE_MASTERY) trueMastered++;
    if (m) engineMastered++;
    if (m && kk < HOLLOW) hollow++;
  }
  return { trueMastered, engineMastered, hollow, avg: skills.reduce((a, s) => a + k.get(s), 0) / skills.length };
}

/** The same learner `days` later, taught nothing and re-probed nothing. */
export function decayTo(r, skills, days) {
  const out = new Map();
  for (const s of skills) {
    const floor = (r.perma ?? PERMA) * (r.peak.get(s) || 0);
    const keep = Math.pow(1 + (days * 24) / (GAP_HOURS * r.strength.get(s)), -(r.gapPow ?? GAP_POW));
    out.set(s, Math.max(floor, floor + (r.k.get(s) - floor) * keep));
  }
  return out;
}

// --- statistics -------------------------------------------------------------
export const q = (xs, p) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
};
export const med = (xs) => q(xs, 0.5);
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
/** Wilson 95% interval on a proportion, so a table of rates says how sure it is. */
export function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n;
  const d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}

/** Everything a cohort run needs, built once. */
export async function buildWorld(unitId = 'algebra1-l1', { samples = 400 } = {}) {
  const graph = await loadLattice(unitId);
  const skills = graph.nodes.map((n) => n.id);
  const { raw, demand } = measureLadder(skills, samples);
  const scenes = measureScenes(skills);
  const repOf = {};
  for (const s of skills) for (const f of FORMS_BY_SKILL[s]) repOf[`${s}/${f.id}`] = f.rep;
  const fb = await feedbackRate(skills);
  return { graph, skills, raw, demand, scenes, repOf, feedback: fb.per || {}, feedbackRate: fb.rate, feedbackPinned: fb.pinned };
}
