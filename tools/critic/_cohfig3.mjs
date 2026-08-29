import { generate } from '../../src/learn/generators.js';
import { allUnits, loadUnit, routeUnits } from '../_courses.mjs';
const { road } = await routeUnits();
const onRoute = new Set(road.map((u) => u.id));
const units = await allUnits();
const byU = new Map();
for (const { unit } of units) byU.set(unit.id, ((await loadUnit(unit)).nodes || []).map((n) => n.id));
let n = 0, worst = [];
for (const [unit, skills] of byU) { if (!onRoute.has(unit)) continue;
  for (const sk of skills) for (let d = 1; d <= 5; d++) for (let s = 0; s < 120; s++) {
    let it; try { it = generate(sk, d, s * 7919 + d * 131, { locale: 'en', strict: true, record: false }); } catch { continue; }
    const f = it.figure; if (!f || (f.kind !== 'line' && f.kind !== 'lines')) continue;
    if (!/read at/i.test(String(it.stem))) continue;
    n++;
    const range = f.range ?? 9;
    const lines = f.kind === 'lines' ? f.lines : [{ m: f.m, b: f.b }];
    // how far the drawn trace runs past the labelled window at the frame edges
    const overshoot = Math.max(...lines.map((L) => Math.max(Math.abs(L.m * range + L.b), Math.abs(-L.m * range + L.b)))) - range;
    worst.push({ unit, sk, form: it.form, d, range, lines, ans: it.answer, stem: it.stem, latex: it.latex, overshoot: +overshoot.toFixed(2) });
  } }
worst.sort((a, b) => b.overshoot - a.overshoot);
console.log(`read-at chart items on the route: ${n}`);
console.log(`how far the drawn trace runs past the labelled window (units), worst first:`);
for (const w of worst.slice(0, 12)) console.log(`  +${w.overshoot}  ${w.unit} ${w.sk}/${w.form} b${w.d} range +-${w.range} ${JSON.stringify(w.lines)} answer=${w.ans}  "${w.stem}" ${w.latex || ''}`);
const over = worst.filter((w) => w.overshoot > 0.5).length;
console.log(`\n${over} of ${n} draw the trace outside their own labelled window (${(100 * over / Math.max(1, n)).toFixed(0)}%)`);
