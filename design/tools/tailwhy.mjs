/**
 * WHERE THE TAIL'S MINUTES GO.
 *
 *   node design/tools/tailwhy.mjs [n]
 *
 * A learner at hidden competence 0.95 clears the median skill in three items
 * and 2.7 minutes. This asks what the other clears are made of, item by item,
 * reading the engine's own state BEFORE each item rather than inferring it.
 *
 * Every item of every clear is put in exactly one bucket, and the buckets are
 * chosen so that each one names a MECHANISM in src/learn/mastery.js rather than
 * a symptom:
 *
 *   sight-read clean / missed   the one cold item at the top of the bank
 *   gate clean / gate missed    items of a proving run
 *   hole                        a gate item pinned to a shape this learner has
 *                               been served and never once solved unaided
 *                               (`formFloor`), which the run cannot close over
 *   re-teaching                 a taught item served AFTER this learner had
 *                               already produced a clean gate-band solve here
 *   climb                       a taught item before any gate evidence: the
 *                               walk back up the credit ladder
 */
import { buildWorld, runLearner, q, med, mean } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 400);
const arm = armOf();
const cfg = arm.cfg;

const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;

const clears = [];
for (let i = 0; i < N; i++) {
  const log = [];
  const r = runLearner(world, (i * 2654435761 + 12345) >>> 0, {
    knows: () => 0.95, budget: 220, ...arm, cfg, watch: (e) => log.push(e),
  });
  for (const s of skills) {
    const c = r.cleared.get(s);
    if (!c) continue;
    clears.push({ skill: s, mins: c.contact / 60, elapsed: c.elapsed / 60, items: c.items, log: log.filter((e) => e.skill === s).slice(0, c.items), order: c.at });
  }
}

const mins = clears.map((x) => x.mins);
const cut = q(mins, 0.75);
const p90 = q(mins, 0.90);
console.log(`WHERE THE TAIL GOES — ${clears.length} clears by ${N} learners at competence 0.95   arm "${arm.name}" cfg ${JSON.stringify(cfg)}`);
console.log(`  contact minutes  median ${med(mins).toFixed(1)}  p75 ${cut.toFixed(1)}  p90 ${p90.toFixed(1)}  p99 ${q(mins, 0.99).toFixed(1)}  mean ${mean(mins).toFixed(1)}`);

/** One item, one bucket. */
function bucketOf(e, provedGate) {
  if (e.kind === 'probe') return e.solved && e.tries === 1 ? 'sight-read clean' : 'sight-read MISSED';
  if (e.kind === 'check') {
    const clean = e.solved && e.tries === 1;
    if (e.before.hole) return clean ? 'hole paid' : 'hole MISSED';
    return clean ? 'gate clean' : 'gate MISSED';
  }
  if (e.kind === 'learn') return provedGate ? 're-teaching (after a clean gate solve)' : 'climb (before any gate evidence)';
  return `${e.kind}`;
}

function decompose(set, label) {
  const b = new Map();
  let secs = 0, ended = 0, charged = 0, opened = 0;
  for (const x of set) {
    let provedGate = false;
    for (const e of x.log) {
      const name = bucketOf(e, provedGate);
      const rec = b.get(name) || { n: 0, s: 0 };
      rec.n++; rec.s += e.cost; b.set(name, rec);
      secs += e.cost;
      if ((e.kind === 'check' || e.kind === 'probe') && e.solved && e.tries === 1 && e.band >= 4) provedGate = true;
      for (const ev of e.events) { if (ev === 'failed') ended++; if (ev === 'charged') charged++; if (ev === 'opened') opened++; }
    }
  }
  console.log(`\n  ${label} — ${set.length} clears, ${(secs / 60 / set.length).toFixed(2)} min each`);
  for (const [k, v] of [...b].sort((a, c) => c[1].s - a[1].s)) {
    console.log(`    ${k.padEnd(40)} ${(v.n / set.length).toFixed(2).padStart(5)} items  ${(v.s / 60 / set.length).toFixed(2).padStart(5)} min  ${(100 * v.s / secs).toFixed(1).padStart(5)}%`);
  }
  console.log(`    runs opened ${(opened / set.length).toFixed(2)}  ended by a miss ${(ended / set.length).toFixed(2)}  misses absorbed ${(charged / set.length).toFixed(2)}`);
  return { secs, per: secs / set.length };
}

decompose(clears, 'every clear');
const slow = clears.filter((x) => x.mins > cut);
decompose(slow, `the tail — above the p75 (${cut.toFixed(1)} min)`);
const fast = clears.filter((x) => x.mins <= cut);
decompose(fast, 'the rest');

// --- THE ONE SPLIT THAT MATTERS -------------------------------------------
// Did the cold item land? Everything downstream of that answer is a different
// road, and the two roads are reported side by side rather than averaged.
const srMiss = (x) => x.log[0] && x.log[0].kind === 'probe' && !(x.log[0].solved && x.log[0].tries === 1);
const landed = clears.filter((x) => !srMiss(x));
const missed = clears.filter(srMiss);
console.log('\n  THE SIGHT-READ, and what missing it costs');
const rowOf = (label, set) => {
  const m = set.map((x) => x.mins);
  console.log(`    ${label.padEnd(22)} ${String(set.length).padStart(6)} clears (${(100 * set.length / clears.length).toFixed(1)}%)   median ${med(m).toFixed(1).padStart(5)}  p75 ${q(m, 0.75).toFixed(1).padStart(5)}  p90 ${q(m, 0.9).toFixed(1).padStart(5)}  p99 ${q(m, 0.99).toFixed(1).padStart(5)}  items med ${med(set.map((x) => x.items)).toFixed(0)}`);
};
rowOf('landed cold', landed);
rowOf('missed', missed);
const totalMin = mins.reduce((a, b) => a + b, 0);
console.log(`    the missed group is ${(100 * missed.length / clears.length).toFixed(1)}% of clears and ${(100 * missed.reduce((a, x) => a + x.mins, 0) / totalMin).toFixed(1)}% of every test-out minute`);
console.log(`    of the ${slow.length} clears in the tail, ${slow.filter(srMiss).length} (${(100 * slow.filter(srMiss).length / slow.length).toFixed(1)}%) began with a missed sight-read`);

// --- THE HOLE --------------------------------------------------------------
// A shape served once and not answered cold is a hole the moment it is served,
// because `formFloor` is 1. The sight-read is the hardest and most expensive
// item the bank can produce, so a missed one opens a hole on exactly the form
// the learner is worst at, and the run cannot close until it is paid.
console.log('\n  THE FORM HOLE (formFloor = 1)');
{
  let withHole = 0, holeItems = 0, holeSecs = 0, holeMisses = 0, extItems = 0;
  let openedWithHole = 0;
  const holeClears = [];
  for (const x of clears) {
    let saw = false, hi = 0, hs = 0, hm = 0;
    for (const e of x.log) {
      if (e.before.hole) { saw = true; hi++; hs += e.cost; if (!(e.solved && e.tries === 1)) hm++; }
      if (e.before.formExt > 0) extItems++;
    }
    if (saw) { withHole++; holeItems += hi; holeSecs += hs; holeMisses += hm; holeClears.push(x); }
    if (x.log.some((e) => e.holesAfter.length > 0)) openedWithHole++;
  }
  console.log(`    clears where a hole was ever outstanding      ${openedWithHole} (${(100 * openedWithHole / clears.length).toFixed(1)}%)`);
  console.log(`    clears that served a hole-pinned gate item    ${withHole} (${(100 * withHole / clears.length).toFixed(1)}%)`);
  console.log(`    hole-pinned items                             ${(holeItems / Math.max(1, withHole)).toFixed(2)} per such clear, ${(holeSecs / 60 / Math.max(1, withHole)).toFixed(2)} min, ${(100 * holeMisses / Math.max(1, holeItems)).toFixed(1)}% of them missed`);
  const hm = holeClears.map((x) => x.mins);
  if (hm.length) console.log(`    those clears                                  median ${med(hm).toFixed(1)}  p90 ${q(hm, 0.9).toFixed(1)}   vs ${med(clears.filter((x) => !holeClears.includes(x)).map((x) => x.mins)).toFixed(1)} median for the rest`);
  console.log(`    run items served while the run was extended for a hole   ${(extItems / clears.length).toFixed(2)} per clear`);
}

// --- COLD START ------------------------------------------------------------
// `steadyAtGate` will not answer until this learner has met `gateFormMin` gate
// items ANYWHERE in the lattice, so every concession the engine grants a knower
// is withheld on their first skill or two. That is a property of the design,
// not of the learner, and it is measurable.
console.log('\n  THE COLD START — steadyAtGate needs gateFormMin gate items before it answers');
{
  const byOrder = new Map();
  for (const x of clears) {
    const o = byOrder.get(x.order > 0 ? Math.min(9, clears.filter(() => false).length) : 0);
  }
  // Position in this learner's own run, recomputed from the clear order.
  const perLearner = new Map();
  for (const x of clears) {
    // `order` is the step index of the clear; rank within its learner is what
    // is wanted, so group by learner via the step ordering of the whole trace.
  }
  const rows = new Map();
  for (const x of clears) {
    const firstItem = x.log[0];
    const steady = firstItem ? firstItem.before.steady : false;
    const gs = firstItem ? firstItem.before.gateSeen : 0;
    const key = steady ? 'steady when the skill opened' : `not yet steady (gate items seen: ${gs < 8 ? '<8' : '>=8, but the ratio failed'})`;
    const r = rows.get(key) || { n: 0, m: [], i: [] };
    r.n++; r.m.push(x.mins); r.i.push(x.items); rows.set(key, r);
  }
  for (const [k, v] of [...rows].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`    ${k.padEnd(48)} ${String(v.n).padStart(6)} clears   median ${med(v.m).toFixed(1).padStart(5)}  p90 ${q(v.m, 0.9).toFixed(1).padStart(5)}  items med ${med(v.i).toFixed(0)}`);
  }
}

// --- WHAT THE SLOWEST CLEARS ACTUALLY LOOK LIKE ---------------------------
console.log('\n  the ten slowest clears, item by item  (kind band scaffold; X = missed, ~ = second try, H = hole-pinned)');
for (const x of [...clears].sort((a, b) => b.mins - a.mins).slice(0, 10)) {
  console.log(`    ${x.mins.toFixed(1).padStart(5)}m ${String(x.items).padStart(2)}i ${x.skill.padEnd(13)} ` + x.log.map((e) => `${e.kind[0]}${e.band}${e.before.hole ? 'H' : ''}${e.scaffold === 'none' ? '' : e.scaffold[0]}${e.solved ? (e.tries > 1 ? '~' : '') : 'X'}`).join(' '));
}
