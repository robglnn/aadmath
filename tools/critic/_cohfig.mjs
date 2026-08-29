/** COHERENCE: does a line-chart item ever ask for a reading outside the drawn window? */
import { generate } from '../../src/learn/generators.js';
import { allUnits, loadUnit, routeUnits } from '../_courses.mjs';
const { road } = await routeUnits();
const onRoute = new Set(road.map((u) => u.id));
const units = await allUnits();
const skillsByUnit = new Map();
for (const { unit } of units) skillsByUnit.set(unit.id, ((await loadUnit(unit)).nodes || []).map((n) => n.id));
const SEEDS = Number(process.argv[2] || 60);
let seen = 0, offWindow = 0, sample = [];
const kinds = new Map();
for (const [unit, skills] of skillsByUnit) {
  if (!onRoute.has(unit)) continue;
  for (const sk of skills) for (let d = 1; d <= 5; d++) for (let s = 0; s < SEEDS; s++) {
    let it; try { it = generate(sk, d, s * 7919 + d * 131, { locale: 'en', strict: true, record: false }); } catch { continue; }
    const f = it.figure; if (!f) continue;
    kinds.set(f.kind, (kinds.get(f.kind) || 0) + 1);
    if (f.kind !== 'line' && f.kind !== 'lines') continue;
    seen++;
    const range = f.range ?? 9;
    const lines = f.kind === 'lines' ? f.lines : [{ m: f.m, b: f.b }];
    // the x the question asks about, if the item declares one
    const at = it.check?.at ?? it.check?.x ?? f.at ?? null;
    const ans = Number(it.answer);
    const bad = [];
    if (Number.isFinite(ans) && Math.abs(ans) > range + 1e-9) bad.push(`answer y=${ans} outside +-${range}`);
    if (at !== null && Number.isFinite(Number(at)) && Math.abs(Number(at)) > range + 1e-9) bad.push(`ask x=${at} outside +-${range}`);
    if (bad.length) {
      offWindow++;
      if (sample.length < 14) sample.push({ unit, sk, form: it.form, d, seed: s * 7919 + d * 131, range, lines, at, answer: it.answer, stem: it.stem, check: it.check });
    }
  }
}
console.log('figure kinds on the route:', [...kinds.entries()].map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`line/lines figures sampled: ${seen}; asked-for reading off the drawn window: ${offWindow} (${(100 * offWindow / Math.max(1, seen)).toFixed(1)}%)`);
for (const x of sample) console.log(`  ${x.unit} ${x.sk}/${x.form} b${x.d} seed ${x.seed} range +-${x.range} lines ${JSON.stringify(x.lines)} at=${x.at} answer=${x.answer}\n     "${x.stem}"\n     check=${JSON.stringify(x.check)}`);
