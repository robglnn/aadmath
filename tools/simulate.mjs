/**
 * Does the pipeline actually get people there?
 *
 * A mastery claim that rests on the engine's own posterior is circular: BKT will
 * happily call a learner mastered because BKT said so. This simulation is the
 * non-circular version. It runs synthetic learners of varying ability through
 * the *real* MasteryEngine — the real prerequisite gate, the real placement,
 * the real difficulty adaptation, the real worked-example fading, the real
 * interleaved retrieval schedule, the real transfer proving run — while
 * tracking a hidden competence value that the engine never sees and cannot
 * influence except by teaching.
 *
 * Then it asks the only question that matters: what fraction of learners end up
 * genuinely competent, and how often does the engine claim a mastery that the
 * hidden truth does not support?
 *
 *   node tools/simulate.mjs [learners] [budget]
 *
 * Learner model (deliberately not generous):
 *   · ability theta ~ N(0,1), clipped, mapped to a learning rate of 0.12–0.30;
 *   · one learner in three carries a misconception that resists teaching: half
 *     learning rate and a standing accuracy penalty on one skill;
 *   · a 6% inattention slip is applied on top, whatever the learner knows;
 *   · response probability is a logistic in (competence − difficulty demand),
 *     floored by a guess rate that only rises as the surface narrows;
 *   · an unfamiliar representation costs real accuracy until it has been met,
 *     which is what makes the proving run a transfer test rather than a formality;
 *   · learning gains follow the effect ordering the literature reports — an error
 *     followed by targeted, elaborated feedback teaches more than a bare correct
 *     answer, and a studied worked example teaches more than an unsupported miss;
 *   · everything decays with time, and successful spaced retrieval slows the decay.
 *
 * The one thing this file refuses to assume is the difficulty ladder. Older
 * versions hard-coded DEMAND(d) = 0.18 + 0.12d, which quietly *assumed* that a
 * band-5 item is harder than a band-3 one. Here the demand of every (skill,
 * band) pair is **measured off the real generated bank** with
 * `generators.demandOf()` before a single learner is run, and printed, so the
 * ladder the simulation believes in is the ladder the game actually ships.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MasteryEngine } from '../src/learn/mastery.js';
import { FORMS_BY_SKILL, SKILLS, generate, demandOf } from '../src/learn/generators.js';
import { echoScript } from '../src/learn/echo.js';
import enItems from '../content/lang/items.en.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(await readFile(path.join(ROOT, 'content/graph/algebra1-l1.json'), 'utf8'));

const LEARNERS = Number(process.argv[2] || 2000);
const BUDGET = Number(process.argv[3] || 800);
const CHECKPOINTS = [150, 300, 450, 600, 800, 1000].filter((c) => c <= BUDGET);

// --- competence thresholds ------------------------------------------------
const TRUE_MASTERY = 0.85;   // hidden competence that counts as "really knows it"
const SKILLS_NEEDED = 9;     // of 10 — the level is mastered, not every atom perfect
const HOLLOW = 0.75;         // engine says mastered but truth is below this

// ---------------------------------------------------------------------------
// The difficulty ladder, measured off the shipping item bank.
// ---------------------------------------------------------------------------
const SAMPLES = Number(process.env.LADDER_SAMPLES || 400);
const RAW = {};
let lo = Infinity, hi = -Infinity;
for (const s of SKILLS) {
  RAW[s] = [];
  for (let d = 1; d <= 5; d++) {
    let sum = 0, n = 0;
    for (let i = 0; i < SAMPLES; i++) {
      try { sum += demandOf(generate(s, d, (i * 104729 + d * 7919 + s.length * 31) >>> 0)); n++; } catch { /* skip */ }
    }
    const m = n ? sum / n : 0;
    RAW[s][d - 1] = m;
    lo = Math.min(lo, m); hi = Math.max(hi, m);
  }
}
// Map the measured spread onto the response scale. The *shape* is the bank's,
// not this file's: the only free parameters are the two endpoints.
const DEMAND_LO = 0.22, DEMAND_HI = 0.84;
const DEMAND = {};
for (const s of SKILLS) {
  DEMAND[s] = RAW[s].map((m) => DEMAND_LO + (DEMAND_HI - DEMAND_LO) * (m - lo) / Math.max(1e-9, hi - lo));
}
const ladderBroken = SKILLS.filter((s) => RAW[s].some((m, i) => i > 0 && m <= RAW[s][i - 1]));

// ---------------------------------------------------------------------------
// How often a miss is actually answered with mathematics.
//
// The literature's large effect for "error followed by elaborated feedback" is
// an effect of the *feedback*, not of the error. Assuming every wrong answer in
// this game earns it would be assuming the thing this project most needs to
// prove, so the rate is measured off the shipping bank instead: for every item
// form, the tagged wrong values that form can produce are pushed through the
// real `echoScript` at depth one, and the share that come back with a probe —
// a computed counterexample, an implied input, a rate that breaks, a claim
// refuted by a single number — rather than with the prompt restated is what the
// simulation uses as the probability of the elaborated-feedback gain. A miss
// that would only be handed the question back gets the weaker studied-example
// gain instead. Content quality therefore moves this file's headline number,
// which is the only arrangement under which the number means anything.
// ---------------------------------------------------------------------------
const restatement = enItems['echo.theTear'];
const nrm = (t) => String(t).replace(/\s+/g, '');
const FEEDBACK = {};
let fbHit = 0, fbAll = 0;
for (const s of SKILLS) {
  for (const f of FORMS_BY_SKILL[s]) {
    let hit = 0, all = 0;
    for (let d = f.dMin; d <= f.dMax; d++) {
      for (let i = 0; i < 3; i++) {
        let item;
        try { item = generate(s, d, (i * 2654435761 + d * 40503 + s.length * 7919) >>> 0, { form: f.id }); }
        catch { continue; }
        for (const dg of (item.diagnostics || []).slice(0, 4)) {
          const rows = echoScript({ item, analogue: null, entry: dg.value, tier: 1 }).rows.filter((r) => r.latex);
          all++;
          const bare = rows.length === 1 && nrm(rows[0].latex) === nrm(item.latex) && rows[0].why === restatement;
          if (!bare) hit++;
        }
      }
    }
    FEEDBACK[`${s}/${f.id}`] = all ? hit / all : 0;
    fbHit += hit; fbAll += all;
  }
}
const FEEDBACK_RATE = fbAll ? fbHit / fbAll : 0;

// --- learner model constants ---------------------------------------------
const SHARPNESS = 6.0;
const SLIP = 0.06;                          // inattention, independent of knowing
const STICKY_RATE = 0.35;                   // learners carrying one resistant misconception
const GAIN = {
  studyExample: 0.26,   // read a complete worked analogue
  completion: 0.30,     // finish a worked analogue whose last line is missing
  errorFeedback: 0.42,  // got it wrong, then saw the line that addresses the error
  assistedWin: 0.30,    // got there with support
  cleanWin: 0.24,       // got there alone
  retrieval: 0.26,      // successful spaced retrieval — the testing effect
};
const DECAY = 0.0018;

const REP_OF = {};
for (const s of SKILLS) for (const f of FORMS_BY_SKILL[s]) REP_OF[`${s}/${f.id}`] = f.rep;

// ---------------------------------------------------------------------------
// The situations each form can be dressed in.
//
// The simulation does not render items, so it cannot read a scene off one. It
// reads the bank's *capacity* instead: every form is sampled until its deck of
// framings stops producing new ones, and a served item is then modelled as a
// uniform draw from that deck, honouring whatever the scheduler asked to avoid.
// That is the same distribution the running game produces, and it is what lets
// the transfer figures below be about situations rather than about templates.
// ---------------------------------------------------------------------------
const SCENES = {};
for (const s of SKILLS) {
  for (const f of FORMS_BY_SKILL[s]) {
    const found = new Set();
    for (let i = 0; i < 48; i++) {
      const d = f.dMin + (i % (f.dMax - f.dMin + 1));
      try {
        const it = generate(s, d, (i * 1103515245 + 12345 + s.length * 31) >>> 0, { form: f.id });
        if (it.scene) found.add(it.scene);
      } catch { /* a seed that will not build tells us nothing about framings */ }
    }
    SCENES[`${s}/${f.id}`] = [...found];
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd) => {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp = (x, lo2, hi2) => Math.max(lo2, Math.min(hi2, x));

/**
 * Is the proving run actually a transfer test?
 *
 * The gate claims three things about itself: that it draws item forms this
 * learner has *not* been drilled on, that it spans more than one
 * representation, and that at least one of its items asks the learner to walk
 * between a situation and the algebra. Those are claims about what happens to
 * real learners over a real run, not about the code that intends them, so they
 * are counted here on the shipping policy and printed with everything else. A
 * gate that quietly stopped meeting them would still produce a good mastery
 * number, which is exactly why it gets its own line.
 */
const XFER = { items: 0, unseen: 0, runs: 0, withUnseen: 0, twoReps: 0, modelled: 0 };
const MODELLING = new Set(['context', 'verbal']);
function closeRun(cur) {
  XFER.runs++;
  if (cur.unseen) XFER.withUnseen++;
  if (cur.reps.size >= 2) XFER.twoReps++;
  if (cur.model) XFER.modelled++;
}

/**
 * @param {number} seed
 * @param {'engine'|'null'|'worst'} policy which scheduler chooses the next item
 *
 * The control arms exist because "94% reach mastery" is not, on its own, a
 * claim about the engine — it could be a claim about a generous learner model.
 * So the learner model is held byte-for-byte fixed and only the choosing
 * policy is swapped: `null` picks a random skill at a random band with no
 * prerequisite gate and no scaffold, `worst` serves the hardest band from the
 * first minute. Same seeds, same decay, same everything else. If those arms
 * also reached mastery, this file would be measuring nothing.
 */
function runLearner(seed, policy = 'engine') {
  const rnd = mulberry(seed);
  const theta = clamp(gauss(rnd), -2.5, 2.5);
  const lr = 0.12 + 0.18 * sigmoid(theta * 1.1);

  // A third of learners carry one misconception that genuinely resists teaching:
  // on that skill they learn at half rate and make errors they would not make
  // elsewhere. Without this, no simulation of this kind is honest.
  const sticky = rnd() < STICKY_RATE ? SKILLS[Math.floor(rnd() * SKILLS.length)] : null;
  const rateFor = (s) => (s === sticky ? lr * 0.5 : lr);

  const engine = new MasteryEngine(graph);
  const k = new Map();              // hidden competence, invisible to the engine
  const repSeen = new Map();        // skill -> rep -> successful exposures
  const stability = new Map();      // grows with each survived spaced review
  for (const s of SKILLS) {
    k.set(s, clamp(0.10 + 0.10 * sigmoid(theta) + 0.06 * rnd(), 0, 0.4));
    repSeen.set(s, {});
    stability.set(s, 1);
  }

  const learn = (s, weight) => k.set(s, clamp(k.get(s) + rateFor(s) * weight * (1 - k.get(s)), 0, 1));
  const trace = [];
  let items = 0;
  // Which forms this learner has actually practised, and the run being built.
  const practised = new Map(SKILLS.map((s) => [s, new Set()]));
  const worked = new Map(SKILLS.map((s) => [s, new Set()]));
  const run = new Map();

  for (let step = 0; step < BUDGET; step++) {
    let task;
    if (policy === 'engine') {
      const objective = engine.next();
      if (!objective) break;
      task = engine.taskFor(objective.id) || {
        skill: objective.id, kind: 'learn', difficulty: 1, scaffold: 'none', formCandidates: [],
      };
    } else {
      task = {
        skill: SKILLS[Math.floor(rnd() * SKILLS.length)],
        kind: 'learn',
        difficulty: policy === 'worst' ? 5 : 1 + Math.floor(rnd() * 5),
        scaffold: 'none',
        formCandidates: [],
      };
    }
    const forms = FORMS_BY_SKILL[task.skill];
    const pool = (task.formCandidates && task.formCandidates.length)
      ? task.formCandidates
      : forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax).map((f) => f.id);
    const form = pool[Math.floor(rnd() * pool.length)] || forms[0].id;
    const rep = REP_OF[`${task.skill}/${form}`] || 'symbolic';
    // Which world the item arrives in. The engine names the framings it does
    // not want; a bank with nothing else to offer serves one anyway, exactly
    // as generate() does when its retry budget runs out.
    const bank = SCENES[`${task.skill}/${form}`] || [];
    let scene = '';
    if (bank.length) {
      const avoid = new Set(task.avoidScenes || []);
      const open = bank.filter((x) => !avoid.has(x));
      const from = open.length ? open : bank;
      scene = from[Math.floor(rnd() * from.length)];
    }

    if (policy === 'engine') {
      if (task.kind === 'check') {
        const fresh = !practised.get(task.skill).has(form)
          || (!!scene && !worked.get(task.skill).has(scene));
        XFER.items++;
        if (fresh) XFER.unseen++;
        // A run's `need` can grow while it is in flight, so it is closed by the
        // next run starting (done back at 0) or by the learner running out of
        // budget — never by guessing at its length.
        let cur = run.get(task.skill);
        if (!cur || task.check?.done === 0) {
          if (cur) closeRun(cur);
          cur = { unseen: false, reps: new Set(), model: false };
          run.set(task.skill, cur);
        }
        if (fresh) cur.unseen = true;
        cur.reps.add(rep);
        if (MODELLING.has(rep)) cur.model = true;
      } else {
        practised.get(task.skill).add(form);
      }
      if (scene) worked.get(task.skill).add(scene);
    }

    // forgetting, everywhere, every item
    for (const s of SKILLS) k.set(s, k.get(s) * (1 - DECAY / stability.get(s)));

    if (task.scaffold === 'full') learn(task.skill, GAIN.studyExample);
    else if (task.scaffold === 'partial') learn(task.skill, GAIN.completion);

    const exposures = repSeen.get(task.skill)[rep] || 0;
    const novelty = 0.15 * Math.exp(-0.7 * exposures);
    const support = task.scaffold === 'full' ? 0.13 : task.scaffold === 'partial' ? 0.06 : 0;
    const demand = DEMAND[task.skill][clamp(task.difficulty, 1, 5) - 1];

    // A scaffolded win is assisted evidence by construction: the answer was on
    // the card. Only unsupported, first-try solves can satisfy the gate.
    let assisted = task.scaffold !== 'none';
    let solved = false;

    for (let attempt = 0; attempt < 3 && !solved; attempt++) {
      const eff = clamp(k.get(task.skill) * (1 - novelty) + support - (task.skill === sticky ? 0.10 : 0), 0, 1);
      const skill = sigmoid(SHARPNESS * (eff - demand));
      // Nothing is multiple-choice on the first try: the guess floor only
      // appears once the surface has narrowed after two misses.
      const guess = attempt >= 2 ? 1 / 3 : 0.02;
      const p = (1 - SLIP) * (guess + (1 - guess) * skill);
      items++;
      if (rnd() < p) {
        engine.observe(task.skill, true, { assisted, form, rep, scene, kind: task.kind });
        learn(task.skill, assisted ? GAIN.assistedWin : GAIN.cleanWin);
        if (task.kind === 'review' || task.kind === 'retrieval') {
          learn(task.skill, GAIN.retrieval);
          stability.set(task.skill, stability.get(task.skill) + 0.7);
        }
        repSeen.get(task.skill)[rep] = exposures + 1;
        solved = true;
      } else {
        engine.observe(task.skill, false, { assisted: true, form, rep, scene, kind: task.kind });
        // The wrong tap calls the echo. Whether that echo can say anything
        // about *this* slip is a property of the bank, measured above — and a
        // miss that only gets the question read back to it is worth no more
        // than having studied a worked example.
        const answered = rnd() < (FEEDBACK[`${task.skill}/${form}`] ?? 0);
        learn(task.skill, answered ? GAIN.errorFeedback : GAIN.studyExample);
        assisted = true;
      }
    }
    if (!solved) learn(task.skill, GAIN.studyExample);

    if (CHECKPOINTS.includes(step + 1)) trace.push({ at: step + 1, ...score(engine, k) });
  }
  if (policy === 'engine') for (const cur of run.values()) closeRun(cur);

  return { theta, lr, items, trace, ...score(engine, k) };
}

function score(engine, k) {
  let trueMastered = 0, engineMastered = 0, hollow = 0;
  for (const s of SKILLS) {
    const kk = k.get(s);
    const m = engine.get(s).mastered;
    if (kk >= TRUE_MASTERY) trueMastered++;
    if (m) engineMastered++;
    if (m && kk < HOLLOW) hollow++;
  }
  const avg = SKILLS.reduce((a, s) => a + k.get(s), 0) / SKILLS.length;
  return { trueMastered, engineMastered, hollow, avg };
}

// ---------------------------------------------------------------------------
console.log(`ASCENT — mastery simulation`);
console.log(`${LEARNERS} synthetic learners, budget ${BUDGET} items each, ${SKILLS.length} skills\n`);

console.log('measured difficulty ladder (mean demandOf over the real bank, ' + SAMPLES + ' items per cell)');
console.log('  skill            d1     d2     d3     d4     d5');
for (const s of SKILLS) {
  console.log(`  ${s.padEnd(14)} ` + RAW[s].map((m) => m.toFixed(2).padStart(6)).join(' '));
}
console.log('  ' + (ladderBroken.length
  ? `LADDER NOT MONOTONE for: ${ladderBroken.join(', ')}`
  : 'every skill rises strictly d1 -> d5, so the bands mean something'));
console.log('  response demand runs ' + DEMAND_LO.toFixed(2) + ' .. ' + DEMAND_HI.toFixed(2) + ', shape taken from the bank');
console.log(`  ${(100 * FEEDBACK_RATE).toFixed(1)}% of ${fbAll} tagged slips are answered with computed mathematics, not the prompt restated;`);
console.log('  only those earn the elaborated-feedback gain — the rest are worth a studied example\n');

const results = [];
for (let i = 0; i < LEARNERS; i++) results.push(runLearner((i * 2654435761 + 12345) >>> 0));

// The falsification arms: identical learners, identical bank, identical decay,
// a different hand on the tiller.
const CONTROL_N = Math.min(LEARNERS, 400);
const arm = (policy) => {
  let reached = 0;
  for (let i = 0; i < CONTROL_N; i++) {
    const r = runLearner((i * 2654435761 + 12345) >>> 0, policy);
    if (r.trueMastered >= SKILLS_NEEDED) reached++;
  }
  return reached / CONTROL_N;
};
const armNull = arm('null');
const armWorst = arm('worst');

const pct = (n) => `${(100 * n / LEARNERS).toFixed(1)}%`;
const reached = results.filter((r) => r.trueMastered >= SKILLS_NEEDED).length;
const allTen = results.filter((r) => r.trueMastered === SKILLS.length).length;
const engineAll = results.filter((r) => r.engineMastered === SKILLS.length).length;
const anyHollow = results.filter((r) => r.hollow > 0).length;

console.log('growth of true mastery (hidden competence >= ' + TRUE_MASTERY + ' on >= ' + SKILLS_NEEDED + '/' + SKILLS.length + ' skills)');
for (const c of CHECKPOINTS) {
  const at = results.map((r) => r.trace.find((t) => t.at === c)).filter(Boolean);
  if (!at.length) continue;
  const got = at.filter((t) => t.trueMastered >= SKILLS_NEEDED).length;
  const bar = '█'.repeat(Math.round(40 * got / at.length)).padEnd(40, '·');
  console.log(`  after ${String(c).padStart(4)} items  ${bar} ${(100 * got / at.length).toFixed(1)}%`);
}

console.log('\nby ability quintile (theta)');
const sorted = [...results].sort((a, b) => a.theta - b.theta);
const q = Math.floor(sorted.length / 5);
for (let i = 0; i < 5; i++) {
  const slice = sorted.slice(i * q, i === 4 ? sorted.length : (i + 1) * q);
  const got = slice.filter((r) => r.trueMastered >= SKILLS_NEEDED).length;
  const bar = '█'.repeat(Math.round(30 * got / slice.length)).padEnd(30, '·');
  console.log(`  Q${i + 1}  theta ${slice[0].theta.toFixed(2).padStart(5)} .. ${slice[slice.length - 1].theta.toFixed(2).padStart(5)}  ${bar} ${(100 * got / slice.length).toFixed(1)}%`);
}

console.log('\nis the proving run a transfer test? (measured over every run the engine served)');
{
  const p1 = (n, d) => (d ? (100 * n / d).toFixed(1) : '  n/a').padStart(5);
  const bar = (n, d) => '█'.repeat(Math.round(30 * (d ? n / d : 0))).padEnd(30, '·');
  console.log(`  gate items in a form or a situation never practised  ${bar(XFER.unseen, XFER.items)} ${p1(XFER.unseen, XFER.items)}%  (${XFER.unseen}/${XFER.items})`);
  console.log(`  runs containing at least one of those               ${bar(XFER.withUnseen, XFER.runs)} ${p1(XFER.withUnseen, XFER.runs)}%  (${XFER.withUnseen}/${XFER.runs})`);
  console.log(`  runs spanning two representations                  ${bar(XFER.twoReps, XFER.runs)} ${p1(XFER.twoReps, XFER.runs)}%`);
  console.log(`  runs including a modelling item                    ${bar(XFER.modelled, XFER.runs)} ${p1(XFER.modelled, XFER.runs)}%`);
}

console.log('\nfalsification — the same learners, the same bank, a different chooser');
{
  const bar = (x) => '█'.repeat(Math.round(30 * x)).padEnd(30, '·');
  console.log(`  the shipping engine        ${bar(reached / LEARNERS)} ${(100 * reached / LEARNERS).toFixed(1)}%`);
  console.log(`  random skill, random band  ${bar(armNull)} ${(100 * armNull).toFixed(1)}%`);
  console.log(`  hardest band from item 1   ${bar(armWorst)} ${(100 * armWorst).toFixed(1)}%`);
  console.log(`  (${CONTROL_N} learners per control arm; identical seeds, decay and learner model)`);
}

const meanAvg = results.reduce((a, r) => a + r.avg, 0) / results.length;
console.log('\ncalibration — is the engine telling the truth?');
console.log(`  engine declared all ${SKILLS.length} skills mastered   ${pct(engineAll)}`);
console.log(`  learners with any hollow mastery claim   ${pct(anyHollow)}  (engine says mastered, hidden competence < ${HOLLOW})`);
console.log(`  mean hidden competence across all skills ${meanAvg.toFixed(3)}`);

console.log('\nRESULT');
console.log(`  true mastery of Algebra I Level 1: ${pct(reached)} of learners`);
console.log(`  every one of the ${SKILLS.length} skills truly mastered: ${pct(allTen)}`);
console.log(`\n  >>> ${(100 * reached / LEARNERS).toFixed(1)}% of simulated learners reach true mastery <<<\n`);

process.exit(reached / LEARNERS >= 0.8 && ladderBroken.length === 0 ? 0 : 1);
