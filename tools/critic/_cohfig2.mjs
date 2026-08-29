/** COHERENCE: readTraceAt — is the asked reading inside the drawn window? */
import { generate } from '../../src/learn/generators.js';
import { allUnits, loadUnit, routeUnits } from '../_courses.mjs';
const { road } = await routeUnits();
const onRoute = new Set(road.map((u) => u.id));
const units = await allUnits();
const skillsByUnit = new Map();
for (const { unit } of units) skillsByUnit.set(unit.id, ((await loadUnit(unit)).nodes || []).map((n) => n.id));
const SEEDS = Number(process.argv[2] || 60);
let seen = 0, off = 0; const sample = [];
for (const [unit, skills] of skillsByUnit) {
  if (!onRoute.has(unit)) continue;
  for (const sk of skills) for (let d = 1; d <= 5; d++) for (let s = 0; s < SEEDS; s++) {
    let it; try { it = generate(sk, d, s * 7919 + d * 131, { locale: 'en', strict: true, record: false }); } catch { continue; }
    const f = it.figure; if (!f || (f.kind !== 'line' && f.kind !== 'lines')) continue;
    if (!/trace read at|read at/i.test(String(it.stem))) continue;
    seen++;
    const range = f.range ?? 9;
    const y = Number(it.answer);
    const m = /=\s*(-?\d+(?:\.\d+)?)/.exec(String(it.latex || it.stem)); const x = m ? Number(m[1]) : null;
    if ((Number.isFinite(y) && Math.abs(y) > range) || (x !== null && Math.abs(x) > range)) {
      off++;
      if (sample.length < 12) sample.push({ unit, sk, form: it.form, d, seed: s * 7919 + d * 131, range, f, x, y, stem: it.stem, latex: it.latex, check: it.check });
    }
  }
}
console.log(`readTraceAt items on the route: ${seen}; off the drawn window: ${off} (${(100 * off / Math.max(1, seen)).toFixed(1)}%)`);
for (const q of sample) console.log(`  ${q.unit} ${q.sk}/${q.form} b${q.d} seed ${q.seed}  range +-${q.range}  fig=${JSON.stringify(q.f)}\n     "${q.stem}"  latex=${q.latex}  x=${q.x} answer(y)=${q.y}\n     check=${JSON.stringify(q.check)}`);
