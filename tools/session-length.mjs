/**
 * Does a run actually take fifteen to twenty-five minutes?
 *
 * The session planner (src/session/estimate.js) sizes a goal by playing the
 * real mastery engine forward against a crude model of the learner: an accuracy
 * that slides with how far above their own band an item sits. If the *only*
 * check on that plan were the same model, this file would be measuring nothing
 * but its own opinion.
 *
 * So the learner here is a different animal entirely, and a deliberately
 * unforgiving one — the same hidden-competence model tools/simulate.mjs grades
 * true mastery with:
 *
 *   · a hidden competence per skill that the engine never sees;
 *   · ability theta ~ N(0,1), mapped to a learning rate of 0.12–0.30;
 *   · one learner in three carrying a misconception that resists teaching;
 *   · a 6% inattention slip on top of everything;
 *   · response probability logistic in (competence − measured item demand),
 *     where the demand of every (skill, band) pair is scored off the shipping
 *     bank with `generators.demandOf()` rather than assumed;
 *   · and an independent speed: each learner has a true pace multiplier and
 *     per-item noise the planner has to *discover* from their answers.
 *
 * Everything else is the shipping code: the real `MasteryEngine`, the real
 * `planRun`, the real close condition, the real `itemSeconds` cost model, and
 * the real EWMA pace filter from src/session/pace.js reimplemented here only
 * because that file talks to `localStorage`.
 *
 *   node tools/session-length.mjs [learners] [sessions-each]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MasteryEngine, itemSeconds } from '../src/learn/mastery.js';
import { FORMS_BY_SKILL, SKILLS, generate, demandOf } from '../src/learn/generators.js';
import { planRun, SESSION_MAX, SESSION_MIN } from '../src/session/estimate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(await readFile(path.join(ROOT, 'content/graph/algebra1-l1.json'), 'utf8'));

const LEARNERS = Number(process.argv[2] || 300);
const SESSIONS = Number(process.argv[3] || 8);

// --- the difficulty ladder, measured off the shipping bank -----------------
const SAMPLES = Number(process.env.LADDER_SAMPLES || 120);
const RAW = {};
let lo = Infinity;
let hi = -Infinity;
for (const s of SKILLS) {
  RAW[s] = [];
  for (let d = 1; d <= 5; d++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < SAMPLES; i++) {
      try { sum += demandOf(generate(s, d, (i * 104729 + d * 7919 + s.length * 31) >>> 0)); n++; } catch { /* skip */ }
    }
    const m = n ? sum / n : 0;
    RAW[s][d - 1] = m;
    lo = Math.min(lo, m); hi = Math.max(hi, m);
  }
}
const DEMAND_LO = 0.22;
const DEMAND_HI = 0.84;
const DEMAND = {};
for (const s of SKILLS) {
  DEMAND[s] = RAW[s].map((m) => DEMAND_LO + (DEMAND_HI - DEMAND_LO) * (m - lo) / Math.max(1e-9, hi - lo));
}
const REP_OF = {};
for (const s of SKILLS) for (const f of FORMS_BY_SKILL[s]) REP_OF[`${s}/${f.id}`] = f.rep;

// --- learner model constants (tools/simulate.mjs) ---------------------------
const SHARPNESS = 6.0;
const SLIP = 0.06;
const STICKY_RATE = 0.35;
const GAIN = {
  studyExample: 0.26, completion: 0.30, errorFeedback: 0.42,
  assistedWin: 0.30, cleanWin: 0.24, retrieval: 0.26,
};
const DECAY = 0.0018;

// --- session/pace.js, without the localStorage ------------------------------
const PACE_SEED = { factor: 1, accuracy: 0.72 };
const ALPHA_TIME = 0.22;
const ALPHA_ACC = 0.12;

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
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const median = (xs) => quantile(xs, 0.5);
function quantile(xs, q) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const i = clamp(Math.floor(q * (a.length - 1)), 0, a.length - 1);
  return a[i];
}

/** One learner, `sessions` runs of the real loop. */
function live(seed, sessions) {
  const rnd = mulberry(seed);
  const theta = clamp(gauss(rnd), -2.5, 2.5);
  const lr = 0.12 + 0.18 * sigmoid(theta);
  const sticky = rnd() < STICKY_RATE ? SKILLS[Math.floor(rnd() * SKILLS.length)] : null;
  // How fast this person actually works, and how variable they are. The planner
  // is not told either; it has to find them out of the answers.
  const trueFactor = clamp(Math.exp(gauss(rnd) * 0.34), 0.45, 2.6);
  const jitter = 0.3;

  const engine = new MasteryEngine(graph);
  const k = new Map(SKILLS.map((s) => [s, clamp(0.12 + 0.30 * sigmoid(theta) + gauss(rnd) * 0.08, 0, 1)]));
  const stability = new Map(SKILLS.map((s) => [s, 1]));
  const repSeen = new Map(SKILLS.map((s) => [s, {}]));
  const pace = { ...PACE_SEED, samples: 0 };
  const out = [];

  const learn = (s, g) => {
    k.set(s, clamp(k.get(s) + lr * g * (1 - k.get(s)), 0, 1));
    stability.set(s, stability.get(s) + 0.35);
  };

  for (let n = 0; n < sessions; n++) {
    if (engine.integrity() >= 0.999) break;
    const plan = planRun(engine, pace, { seed: 0x5eed + n * 131 });
    let tears = 0;
    let seconds = 0;
    let items = 0;
    const held = [];
    while (tears < plan.tears && seconds < SESSION_MAX * 60) {
      const objective = engine.next();
      if (!objective) break;
      const task = engine.taskFor(objective.id);
      if (!task) break;
      const forms = FORMS_BY_SKILL[task.skill];
      const pool = task.formCandidates?.length
        ? task.formCandidates
        : forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax).map((f) => f.id);
      const form = pool[Math.floor(rnd() * pool.length)] || forms[0].id;
      const rep = REP_OF[`${task.skill}/${form}`] || 'symbolic';

      if (task.scaffold === 'full') learn(task.skill, GAIN.studyExample);
      else if (task.scaffold === 'partial') learn(task.skill, GAIN.completion);

      const exposures = repSeen.get(task.skill)[rep] || 0;
      const novelty = 0.15 * Math.exp(-0.7 * exposures);
      const support = task.scaffold === 'full' ? 0.13 : task.scaffold === 'partial' ? 0.06 : 0;
      const demand = DEMAND[task.skill][clamp(task.difficulty, 1, 5) - 1];

      let assisted = task.scaffold !== 'none';
      let solved = false;
      let tries = 0;
      for (let attempt = 0; attempt < 3 && !solved; attempt++) {
        const eff = clamp(k.get(task.skill) * (1 - novelty) + support - (task.skill === sticky ? 0.10 : 0), 0, 1);
        const guess = attempt >= 2 ? 1 / 3 : 0.02;
        const p = (1 - SLIP) * (guess + (1 - guess) * sigmoid(SHARPNESS * (eff - demand)));
        tries++;
        items++;
        // the modelled cost of this attempt, and what it actually cost them
        const modelled = itemSeconds({ rep, difficulty: task.difficulty, scaffold: task.scaffold });
        const spent = modelled * trueFactor * Math.exp(gauss(rnd) * jitter);
        seconds += spent;
        // the pace filter, exactly as src/session/pace.js runs it
        if (spent >= 3 && spent <= 180 && modelled > 0) {
          pace.factor = clamp(pace.factor + (clamp(spent / modelled, 0.2, 4) - pace.factor) * ALPHA_TIME, 0.35, 3.2);
          pace.samples++;
        }
        const correct = rnd() < p;
        pace.accuracy = clamp(pace.accuracy + ((correct ? 1 : 0) - pace.accuracy) * ALPHA_ACC, 0.25, 0.98);
        const res = engine.observe(task.skill, correct, { assisted, form, rep, kind: task.kind });
        if (correct) {
          tears++;
          learn(task.skill, assisted ? GAIN.assistedWin : GAIN.cleanWin);
          if (task.kind === 'review' || task.kind === 'retrieval') learn(task.skill, GAIN.retrieval);
          repSeen.get(task.skill)[rep] = exposures + 1;
          solved = true;
        } else {
          learn(task.skill, GAIN.errorFeedback);
          assisted = true;
        }
        if (res?.justMastered) held.push(task.skill);
      }
      if (!solved) learn(task.skill, GAIN.studyExample);
      for (const s of SKILLS) k.set(s, k.get(s) * (1 - DECAY / stability.get(s)));
    }
    out.push({
      n: n + 1,
      minutes: seconds / 60,
      items,
      tears,
      target: plan.tears,
      planned: plan.minutes,
      met: tears >= plan.tears,
      held: held.length,
      promised: plan.promised.length,
      keptPromise: plan.promised.every((id) => engine.get(id).mastered),
      factor: pace.factor,
      accuracy: pace.accuracy,
    });
    // Between two sessions there is a night. Memory does what memory does.
    for (const s of SKILLS) k.set(s, k.get(s) * 0.985);
  }
  return { theta, trueFactor, sessions: out, lines: SKILLS.filter((s) => engine.get(s).mastered).length };
}

// ---------------------------------------------------------------------------
console.log(`measuring ${LEARNERS} learners × up to ${SESSIONS} sessions of the real loop…\n`);
const all = [];
const learners = [];
for (let i = 0; i < LEARNERS; i++) {
  const r = live(i * 7919 + 13, SESSIONS);
  learners.push(r);
  for (const s of r.sessions) all.push({ ...s, theta: r.theta, trueFactor: r.trueFactor });
}

const mins = all.map((s) => s.minutes);
const inWindow = all.filter((s) => s.minutes >= SESSION_MIN && s.minutes <= SESSION_MAX).length;
const bar = (f, w = 30) => '█'.repeat(Math.round(f * w)).padEnd(w, '·');

console.log('SESSION LENGTH — every run of every learner');
console.log(`  runs measured                 ${all.length}`);
console.log(`  median                        ${median(mins).toFixed(1)} min`);
console.log(`  p25 / p75                     ${quantile(mins, 0.25).toFixed(1)} / ${quantile(mins, 0.75).toFixed(1)} min`);
console.log(`  p05 / p95                     ${quantile(mins, 0.05).toFixed(1)} / ${quantile(mins, 0.95).toFixed(1)} min`);
console.log(`  inside the 15–25 min window   ${bar(inWindow / all.length)}  ${(100 * inWindow / all.length).toFixed(1)}%`);
// A run is called the moment the cap is reached *and* the learner is out of a
// rift — never mid-item — so the honest upper figure is the cap plus whatever
// was in their hands when it struck.
const spill = all.filter((s) => s.minutes >= SESSION_MIN && s.minutes <= SESSION_MAX + 1.5).length;
console.log(`  …plus the item still in hand  ${bar(spill / all.length)}  ${(100 * spill / all.length).toFixed(1)}%`);
console.log(`  ran past 25 min               ${(100 * all.filter((s) => s.minutes > SESSION_MAX).length / all.length).toFixed(1)}%  (median overshoot ${(median(all.filter((s) => s.minutes > SESSION_MAX).map((s) => s.minutes - SESSION_MAX)) || 0).toFixed(1)} min)`);
console.log(`  goal met before the cap       ${(100 * all.filter((s) => s.met).length / all.length).toFixed(1)}%`);

console.log('\nBY ABILITY — is the slow learner given a shorter goal or a longer session?');
const q = [...all].sort((a, b) => a.theta - b.theta);
const size = Math.ceil(q.length / 5);
for (let i = 0; i < 5; i++) {
  const g = q.slice(i * size, (i + 1) * size);
  if (!g.length) continue;
  const gm = median(g.map((s) => s.minutes));
  console.log(`  Q${i + 1}  theta ${g[0].theta.toFixed(2).padStart(5)} .. ${g[g.length - 1].theta.toFixed(2).padStart(5)}` +
    `   goal ${median(g.map((s) => s.target)).toString().padStart(3)} tears` +
    `   ran ${gm.toFixed(1).padStart(5)} min` +
    `   met ${(100 * g.filter((s) => s.met).length / g.length).toFixed(0).padStart(3)}%` +
    `   lines held ${(g.reduce((a, s) => a + s.held, 0) / g.length).toFixed(2)}/run`);
}

console.log('\nBY SPEED — the same question for a learner who is simply slower');
const fq = [...all].sort((a, b) => a.trueFactor - b.trueFactor);
for (let i = 0; i < 5; i++) {
  const g = fq.slice(i * size, (i + 1) * size);
  if (!g.length) continue;
  console.log(`  Q${i + 1}  pace ×${g[0].trueFactor.toFixed(2)} .. ×${g[g.length - 1].trueFactor.toFixed(2)}` +
    `   goal ${median(g.map((s) => s.target)).toString().padStart(3)} tears` +
    `   ran ${median(g.map((s) => s.minutes)).toFixed(1).padStart(5)} min` +
    `   met ${(100 * g.filter((s) => s.met).length / g.length).toFixed(0).padStart(3)}%`);
}

console.log('\nDOES THE PLAN KEEP ITS WORD?');
const promises = all.filter((s) => s.promised > 0);
console.log(`  runs that promised a line     ${promises.length} of ${all.length} (${(100 * promises.length / all.length).toFixed(0)}%)`);
console.log(`  …and closed every one         ${promises.length ? (100 * promises.filter((s) => s.keptPromise).length / promises.length).toFixed(1) : '—'}%`);
console.log(`  runs that closed a line       ${(100 * all.filter((s) => s.held > 0).length / all.length).toFixed(1)}%`);

console.log('\nSESSION BY SESSION (median across learners)');
for (let n = 1; n <= SESSIONS; n++) {
  const g = all.filter((s) => s.n === n);
  if (!g.length) continue;
  console.log(`  run ${String(n).padStart(2)}   goal ${median(g.map((s) => s.target)).toString().padStart(3)} tears` +
    `   ran ${median(g.map((s) => s.minutes)).toFixed(1).padStart(5)} min` +
    `   items ${median(g.map((s) => s.items)).toString().padStart(3)}` +
    `   lines held ${(g.reduce((a, s) => a + s.held, 0) / g.length).toFixed(2)}` +
    `   pace factor ${median(g.map((s) => s.factor)).toFixed(2)}`);
}

const done = learners.filter((l) => l.lines >= 9).length;
console.log(`\n  learners holding 9+ of 10 lines after ${SESSIONS} runs: ${(100 * done / learners.length).toFixed(1)}%`);
console.log(`\n  >>> median run: ${median(mins).toFixed(1)} minutes; ${(100 * inWindow / all.length).toFixed(0)}% inside 15–25 <<<`);
