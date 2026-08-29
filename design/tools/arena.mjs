/**
 * THE FRONTIER — every candidate fix, on identical seeds, judged on both halves
 * of the promise at once.
 *
 *   node design/tools/arena.mjs [knowers] [frozen-per-cell] [population]
 *
 * A change that shortens the test-out tail and raises the rate at which a
 * learner who does not know the material is handed a mastery claim has not
 * fixed anything; it has moved the cost onto the one number the teacher record
 * rests on. So every arm prints, on the same seeds and the same bank:
 *
 *   TAIL        contact minutes to clear one skill, for a learner at 0.95
 *   CLASSIFIER  the share of learners FROZEN at 0.50 / 0.60 / 0.70 / 0.80 /
 *               0.90 who are handed a claim anyway
 *   POPULATION  true mastery and hollow claims for the ordinary cold-start
 *               cohort, which is who the teaching is for
 */
import { buildWorld, runLearner, q, med, mean, wilson, TRUE_MASTERY, HOLLOW } from './lib/sim.mjs';
import * as P from './lib/patches.mjs';
import { ARMS as NAMED } from './lib/arms.mjs';

const KN = Number(process.argv[2] || 400);
const FZ = Number(process.argv[3] || 400);
const POP = Number(process.argv[4] || 0);
const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;
const LEVELS = [0.50, 0.60, 0.70, 0.80, 0.90];
const SEED = (i) => (i * 2654435761 + 12345) >>> 0;

const ARMS = [
  ['shipping', {}],
  ['A  gate at the bar', { patch: P.gateAtBar }],
  ['B  hole at the bar', { patch: P.holeAtBar }],
  ['C  no new debt', { patch: P.noNewDebt }],
  ['D  holeSpacing 1', { cfg: { holeSpacing: 1 } }],
  ['E  pay at once', { patch: P.payAtOnce }],
  ["E' pay at once, steady", { patch: P.payAtOnceSteady }],
  ["B' hole at bar, steady", { patch: P.holeAtBarSteady }],
  ["B'+E'", { patch: P.all(P.holeAtBarSteady, P.payAtOnceSteady) }],
  ["B'+E'+S", { patch: P.all(P.holeAtBarSteady, P.payAtOnceSteady, P.holeIsALapse) }],
  ["A'+B'+E'", { patch: P.all(P.gateAtBarSteady, P.holeAtBarSteady, P.payAtOnceSteady) }],
  ['S  hole is a lapse', { patch: P.holeIsALapse }],
  ["A'+B'+E'+S", { patch: P.all(P.gateAtBarSteady, P.holeAtBarSteady, P.payAtOnceSteady, P.holeIsALapse) }],
  ['B+E', { patch: P.all(P.holeAtBar, P.payAtOnce) }],
];
const ONLY = process.env.ARMS ? process.env.ARMS.split(',').map((x) => x.trim()) : null;

function tail(arm) {
  const c = [], el = [], it = [];
  const worst = [], whole = [], wholeItems = [], churn = [];
  for (let i = 0; i < KN; i++) {
    const r = runLearner(world, SEED(i), { knows: () => 0.95, budget: 220, ...arm });
    const mine = [];
    let last = 0, all = true;
    for (const s of skills) {
      const cl = r.cleared.get(s);
      if (!cl) { all = false; continue; }
      c.push(cl.contact / 60); el.push(cl.elapsed / 60); it.push(cl.items);
      mine.push(cl.contact / 60);
      last = Math.max(last, cl.runElapsed);
    }
    if (mine.length) worst.push(Math.max(...mine));
    if (all) { whole.push(last / 60); wholeItems.push(r.cleared.size ? [...r.cleared.values()].reduce((a, x) => a + x.items, 0) : 0); }
    churn.push(r.withdrawn.length);
  }
  return { c, el, it, worst, whole, wholeItems, churn };
}

function classifier(arm) {
  const out = {};
  for (const lv of LEVELS) {
    let seen = 0, ever = 0, inTime = 0, three = 0, held = 0;
    for (let i = 0; i < FZ; i++) {
      const r = runLearner(world, SEED(i), { knows: () => lv, frozen: true, budget: 40, ...arm });
      const target = skills.find((s) => r.spent.get(s).items > 0);
      if (!target) continue;
      seen++;
      const cl = r.cleared.get(target);
      if (!cl) continue;
      ever++;
      if (cl.runElapsed <= 25 * 60) inTime++;
      if (cl.items <= 3) three++;
      if (r.heldSet.has(target)) held++;
    }
    out[lv] = { seen, ever, inTime, three, held };
  }
  return out;
}

function population(arm) {
  let reached = 0, all10 = 0, hollowAny = 0, claims = 0, hollowClaims = 0, n = 0;
  for (let i = 0; i < POP; i++) {
    const r = runLearner(world, SEED(i), { budget: 800, ...arm });
    n++;
    if (r.trueMastered >= Math.round(0.9 * skills.length)) reached++;
    if (r.trueMastered === skills.length) all10++;
    if (r.hollow > 0) hollowAny++;
    for (const cl of r.claims) { claims++; if (cl.k < HOLLOW) hollowClaims++; }
  }
  return { n, reached, all10, hollowAny, claims, hollowClaims };
}

console.log(`THE FRONTIER — ${KN} knowers, ${FZ} frozen per cell, ${POP} cold starts, identical seeds`);
console.log(`  lattice ${skills.length} skills   feedback ${(100 * world.feedbackRate).toFixed(1)}%${world.feedbackPinned ? ' pinned' : ''}\n`);

const hdr = ['arm', 'med', 'p75', 'p90', 'p95', 'p99', 'max', 'items p90', '>15min learners', 'elapsed p90'];
console.log('TEST-OUT (contact minutes to clear one skill, learner at hidden competence 0.95)');
console.log('  ' + 'arm'.padEnd(20) + '  med   p75   p90   p95   p99    max   itp90   learners w/ a >15min clear   elapsed p90');
const tails = new Map();
for (const [name, arm] of ARMS) {
  if (ONLY && !ONLY.includes(name.split(' ')[0])) continue;
  const t = tail(arm);
  tails.set(name, t);
  console.log(`  ${name.padEnd(20)} ${med(t.c).toFixed(1).padStart(4)} ${q(t.c, 0.75).toFixed(1).padStart(5)} ${q(t.c, 0.9).toFixed(1).padStart(5)} ${q(t.c, 0.95).toFixed(1).padStart(5)} ${q(t.c, 0.99).toFixed(1).padStart(6)} ${Math.max(...t.c).toFixed(1).padStart(6)} ${q(t.it, 0.9).toFixed(0).padStart(7)}   ${(100 * t.worst.filter((x) => x > 15).length / t.worst.length).toFixed(1).padStart(21)}%   ${q(t.el, 0.9).toFixed(1).padStart(9)}`);
}

console.log('\nTHE WHOLE LEVEL — a learner who already knows all ten, from the first item to the tenth claim');
console.log('  ' + 'arm'.padEnd(20) + '  wall-clock min med / p75 / p90    items med   claims withdrawn per learner');
for (const [name] of ARMS) {
  const t = tails.get(name);
  if (!t) continue;
  console.log(`  ${name.padEnd(20)} ${med(t.whole).toFixed(0).padStart(16)} ${q(t.whole, 0.75).toFixed(0).padStart(5)} ${q(t.whole, 0.9).toFixed(0).padStart(5)}  ${med(t.wholeItems).toFixed(0).padStart(11)}  ${mean(t.churn).toFixed(2).padStart(28)}`);
}

console.log('\nTHE CLASSIFIER — share of learners FROZEN at each hidden competence who are handed a claim');
console.log('  ever inside 40 items / inside 25 real minutes / STILL HELD at the buzzer   (+/- is the 95% Wilson half-width on the first)');
console.log('  ' + 'arm'.padEnd(20) + LEVELS.map((l) => `k=${l.toFixed(2)}`.padStart(22)).join(''));
for (const [name, arm] of ARMS) {
  if (ONLY && !ONLY.includes(name.split(' ')[0])) continue;
  const c = classifier(arm);
  const cells = LEVELS.map((l) => {
    const v = c[l];
    const [lo, hi] = wilson(v.ever, v.seen);
    const hw = 100 * (hi - lo) / 2;
    return `${(100 * v.ever / v.seen).toFixed(1)}/${(100 * v.inTime / v.seen).toFixed(1)}/${(100 * v.held / v.seen).toFixed(1)}±${hw.toFixed(1)}`.padStart(22);
  });
  console.log(`  ${name.padEnd(20)}` + cells.join(''));
}

if (POP) {
  console.log('\nTHE ORDINARY POPULATION — cold starts, 800 items, who the teaching is actually for');
  console.log('  ' + 'arm'.padEnd(20) + '  true mastery   all ten   any hollow claim   hollow claims');
  for (const [name, arm] of ARMS) {
    if (ONLY && !ONLY.includes(name.split(' ')[0])) continue;
    const p = population(arm);
    console.log(`  ${name.padEnd(20)} ${(100 * p.reached / p.n).toFixed(1).padStart(12)}%  ${(100 * p.all10 / p.n).toFixed(1).padStart(7)}%  ${(100 * p.hollowAny / p.n).toFixed(1).padStart(15)}%  ${(100 * p.hollowClaims / Math.max(1, p.claims)).toFixed(2).padStart(12)}%`);
  }
}
