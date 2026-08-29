/** COHERENCE: how long is the longest option a learner is shown, per locale, on the route? */
import { generate } from '../../src/learn/generators.js';
import { allUnits, loadUnit, routeUnits } from '../_courses.mjs';

const { road } = await routeUnits();
const onRoute = new Set(road.map((u) => u.id));
const units = await allUnits();
const skillsByUnit = new Map();
for (const { unit } of units) {
  const g = await loadUnit(unit);
  skillsByUnit.set(unit.id, (g.nodes || []).map((n) => n.id));
}
const SEEDS = Number(process.argv[2] || 10);
const rows = [];
for (const [unit, skills] of skillsByUnit) {
  if (!onRoute.has(unit)) continue;
  for (const sk of skills) {
    for (const loc of ['en', 'es', 'pl']) {
      for (let d = 1; d <= 5; d++) {
        for (let s = 0; s < SEEDS; s++) {
          let it;
          try { it = generate(sk, d, s * 7919 + d * 131, { locale: loc, strict: true, record: false }); }
          catch { continue; }
          const ds = (it.distractors || []).map((x) => String(x.value ?? x));
          if (ds.length < 2) continue;
          const strs = [String(it.answer), ...ds];
          const lens = strs.map((x) => x.length);
          const max = Math.max(...lens);
          rows.push({ unit, sk, loc, d, form: it.form, max, k: strs.length,
            keyIsLongest: String(it.answer).length === max && lens.filter((l) => l === max).length === 1,
            longest: strs[lens.indexOf(max)], stemLen: String(it.stem || '').length,
            sumLen: lens.reduce((a, b) => a + b, 0) });
        }
      }
    }
  }
}
const by = {};
for (const r of rows) {
  const b = (by[r.loc] ||= { n: 0, sumMax: 0, sumStem: 0, sumAll: 0, keyLong: 0, over: {}, stemOver: {}, worst: null, worstStem: null });
  b.n++; b.sumMax += r.max; b.sumStem += r.stemLen; b.sumAll += r.sumLen;
  if (r.keyIsLongest) b.keyLong++;
  for (const T of [24, 32, 40, 52, 64]) if (r.max > T) b.over[T] = (b.over[T] || 0) + 1;
  for (const T of [90, 120, 150, 190]) if (r.stemLen > T) b.stemOver[T] = (b.stemOver[T] || 0) + 1;
  if (!b.worst || r.max > b.worst.max) b.worst = r;
  if (!b.worstStem || r.stemLen > b.worstStem.stemLen) b.worstStem = r;
}
console.log(`route option sets sampled: ${rows.length} (units ${[...onRoute].join(', ')})`);
for (const loc of ['en', 'es', 'pl']) {
  const b = by[loc]; if (!b) continue;
  console.log(`\n${loc.toUpperCase()}  sets=${b.n}  mean longest option ${(b.sumMax / b.n).toFixed(1)}ch  mean total ink ${(b.sumAll / b.n).toFixed(0)}ch  mean stem ${(b.sumStem / b.n).toFixed(0)}ch`);
  console.log(`  key is the unique LONGEST option: ${(100 * b.keyLong / b.n).toFixed(1)}% (chance = ${(100 / 4).toFixed(0)}%)`);
  console.log(`  longest option over: ` + [24, 32, 40, 52, 64].map((T) => `${T}ch ${(100 * (b.over[T] || 0) / b.n).toFixed(1)}%`).join('  '));
  console.log(`  stem over: ` + [90, 120, 150, 190].map((T) => `${T}ch ${(100 * (b.stemOver[T] || 0) / b.n).toFixed(1)}%`).join('  '));
  console.log(`  widest option: ${b.worst.sk}/${b.worst.form} b${b.worst.d} — ${b.worst.max}ch ${JSON.stringify(b.worst.longest).slice(0, 160)}`);
  console.log(`  longest stem:  ${b.worstStem.sk}/${b.worstStem.form} b${b.worstStem.d} — ${b.worstStem.stemLen}ch`);
}
const pl = rows.filter((r) => r.loc === 'pl').sort((a, b2) => b2.max - a.max).slice(0, 10);
console.log('\nthe ten widest PL options on the route:');
for (const r of pl) console.log(`  ${String(r.max).padStart(3)}ch  ${r.unit} ${r.sk}/${r.form} b${r.d}  ${JSON.stringify(r.longest).slice(0, 150)}`);
