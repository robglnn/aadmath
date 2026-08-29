/**
 * THE HOLE TREADMILL.
 *
 *   node design/tools/holes.mjs [n]
 *
 * `formFloor` is 1: a shape the engine has SERVED once and never had answered
 * unaided is a hole, and a proving run cannot close while a hole stands
 * (`observe`: `if (holes.length) { s.check.need += 1 }`).
 *
 * A proving run opened by a clean sight-read runs at band 5 — the sight-read
 * lifts `s.difficulty` to its own band and the run inherits it — and it
 * deliberately prefers forms this learner has never practised. So every miss on
 * a fresh form inside the run OPENS A NEW HOLE, which lengthens the run by one,
 * which serves another fresh form.
 *
 * That is a branching process, and this measures its reproduction number: how
 * many new holes each hole costs before it is paid off. Below one it converges
 * with a heavy tail; at or above one it does not converge at all.
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
  const r = runLearner(world, (i * 2654435761 + 12345) >>> 0, { knows: () => 0.95, budget: 220, ...arm, cfg, watch: (e) => log.push(e) });
  for (const s of skills) {
    const c = r.cleared.get(s);
    if (!c) continue;
    clears.push({ skill: s, mins: c.contact / 60, items: c.items, log: log.filter((e) => e.skill === s).slice(0, c.items) });
  }
}
console.log(`THE HOLE TREADMILL — ${clears.length} clears, competence 0.95   arm "${arm.name}" cfg ${JSON.stringify(cfg)}`);
console.log(`  contact minutes  median ${med(clears.map((x) => x.mins)).toFixed(1)}  p90 ${q(clears.map((x) => x.mins), 0.9).toFixed(1)}  p99 ${q(clears.map((x) => x.mins), 0.99).toFixed(1)}`);

// --- 1. how many holes does a clear open, and what does that cost? ----------
const rows = new Map();
let opened = 0, gateItems = 0, gateFresh = 0, freshMiss = 0;
const bandStat = new Map();
for (const x of clears) {
  const seen = new Set();
  let n = 0;
  for (const e of x.log) {
    for (const h of e.holesAfter) if (!seen.has(h)) { seen.add(h); n++; }
    if (e.kind === 'check' || e.kind === 'probe') {
      gateItems++;
      const clean = e.solved && e.tries === 1;
      const b = bandStat.get(e.band) || { n: 0, clean: 0, newHole: 0, secs: 0 };
      b.n++; if (clean) b.clean++; b.secs += e.cost;
      const fresh = e.holesAfter.filter((h) => !e.before.holes.includes(h)).length;
      b.newHole += fresh;
      bandStat.set(e.band, b);
      if (fresh) freshMiss += fresh;
    }
  }
  opened += n;
  const key = Math.min(4, n);
  const r = rows.get(key) || { n: 0, m: [], i: [] };
  r.n++; r.m.push(x.mins); r.i.push(x.items); rows.set(key, r);
}
console.log('\n  distinct holes opened before the claim landed');
console.log('    holes    clears        share   median min   p90 min   median items');
for (const [k, v] of [...rows].sort((a, b) => a[0] - b[0])) {
  console.log(`      ${k === 4 ? '4+' : ` ${k}`}   ${String(v.n).padStart(6)}   ${(100 * v.n / clears.length).toFixed(1).padStart(6)}%   ${med(v.m).toFixed(1).padStart(9)}  ${q(v.m, 0.9).toFixed(1).padStart(8)}   ${med(v.i).toFixed(0).padStart(11)}`);
}
console.log(`    mean holes per clear ${(opened / clears.length).toFixed(2)}`);

// --- 2. the gate item, by the band it was asked at --------------------------
console.log('\n  gate items by band — what a learner at 0.95 actually does with them');
console.log('    band     items    clean, unaided     new holes opened per item     mean seconds');
for (const [b, v] of [...bandStat].sort((a, c) => a[0] - c[0])) {
  console.log(`      ${b}    ${String(v.n).padStart(6)}    ${(100 * v.clean / v.n).toFixed(1).padStart(9)}%    ${(v.newHole / v.n).toFixed(3).padStart(22)}     ${(v.secs / v.n).toFixed(1).padStart(9)}`);
}

// --- 3. the reproduction number ---------------------------------------------
// Every gate item served while a hole was outstanding is an item the hole is
// responsible for. How many new holes do those items open?
let holeItems = 0, holeNew = 0, cleanItems = 0, cleanNew = 0;
for (const x of clears) {
  for (const e of x.log) {
    if (e.kind !== 'check' && e.kind !== 'probe') continue;
    const fresh = e.holesAfter.filter((h) => !e.before.holes.includes(h)).length;
    if (e.before.holes.length) { holeItems++; holeNew += fresh; } else { cleanItems++; cleanNew += fresh; }
  }
}
console.log('\n  the branching ratio');
console.log(`    gate items served with no hole outstanding   ${cleanItems}, opening ${(cleanNew / Math.max(1, cleanItems)).toFixed(3)} new holes each`);
console.log(`    gate items served while a hole stood         ${holeItems}, opening ${(holeNew / Math.max(1, holeItems)).toFixed(3)} new holes each`);
{
  // How many gate items a single outstanding hole costs before it clears: the
  // run must serve `holeSpacing` other items between two asks of one shape.
  let spans = [];
  for (const x of clears) {
    let start = -1;
    x.log.forEach((e, i) => {
      const had = e.before.holes.length > 0;
      if (had && start < 0) start = i;
      if (!had && start >= 0) { spans.push(i - start); start = -1; }
    });
    if (start >= 0) spans.push(x.log.length - start);
  }
  if (spans.length) console.log(`    items served per hole-episode               median ${med(spans).toFixed(0)}  mean ${mean(spans).toFixed(2)}  p90 ${q(spans, 0.9).toFixed(0)}  max ${Math.max(...spans)}`);
  console.log(`    -> R = (new holes per hole-episode item) x (items per episode) = ${(holeNew / Math.max(1, holeItems) * mean(spans)).toFixed(2)}`);
}

// --- 4. what does a run actually end up asking for? -------------------------
const needs = [];
for (const x of clears) {
  const last = [...x.log].reverse().find((e) => e.kind === 'check');
  if (last) needs.push(last.before.need + 1);
}
console.log(`\n  the run's final length (need)   median ${med(needs).toFixed(0)}  p75 ${q(needs, 0.75)}  p90 ${q(needs, 0.9)}  p99 ${q(needs, 0.99)}  max ${Math.max(...needs)}   (the bar names 3)`);
const ext = clears.map((x) => { const l = [...x.log].reverse().find((e) => e.kind === 'check'); return l ? l.before.formExt : 0; });
console.log(`  of that, items added purely to re-ask a hole (formExt)   median ${med(ext).toFixed(0)}  p90 ${q(ext, 0.9)}  p99 ${q(ext, 0.99)}  max ${Math.max(...ext)}`);

// --- 5. per learner: the worst single skill --------------------------------
{
  const worst = [];
  const totals = [];
  for (let i = 0; i < N; i++) {
    const mine = clears.filter((_, j) => Math.floor(j / skills.length) === i);
  }
  // Recomputed properly: group by learner using the run order in `clears`.
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const mine = [];
    while (idx < clears.length && mine.length < skills.length) { mine.push(clears[idx]); idx++; }
    if (!mine.length) break;
    worst.push(Math.max(...mine.map((x) => x.mins)));
    totals.push(mine.reduce((a, x) => a + x.mins, 0));
  }
  console.log(`\n  per learner, the single slowest of their ${skills.length} test-outs   median ${med(worst).toFixed(1)}  p75 ${q(worst, 0.75).toFixed(1)}  p90 ${q(worst, 0.9).toFixed(1)}  max ${Math.max(...worst).toFixed(1)}`);
  console.log(`  per learner, contact minutes over the whole level          median ${med(totals).toFixed(0)}  p75 ${q(totals, 0.75).toFixed(0)}  p90 ${q(totals, 0.9).toFixed(0)}  max ${Math.max(...totals).toFixed(0)}`);
  console.log(`  learners with at least one test-out over 15 contact min    ${(100 * worst.filter((x) => x > 15).length / worst.length).toFixed(1)}%`);
}
