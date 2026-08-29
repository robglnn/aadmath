#!/usr/bin/env node
/** Band means for one or more skills, measured exactly as validate-courses does. */
import { generate, demandOf } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';
import { ladderFaults } from '../../tools/critic/ladder.mjs';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) || 240);
const skills = process.argv.slice(2).filter((a) => !/^\d+$/.test(a));
for (const { unit } of await allUnits()) await loadUnit(unit);
for (const skill of skills) {
  const mean = [];
  const forms = new Map();
  for (let d = 1; d <= 5; d++) {
    let sum = 0, count = 0;
    const per = new Map();
    for (let s = 0; s < N; s++) {
      let it;
      try { it = generate(skill, d, s * 7919 + d * 131, { locale: 'en', strict: true, record: false }); }
      catch (e) { console.log(`  !! ${skill} d${d} s${s}: ${e.message}`); continue; }
      const v = demandOf(it);
      sum += v; count += 1;
      const p = per.get(it.form) || { n: 0, s: 0 }; p.n++; p.s += v; per.set(it.form, p);
    }
    mean.push(count ? sum / count : 0);
    forms.set(d, per);
  }
  const faults = ladderFaults(mean, { seeds: N });
  console.log(`${skill.padEnd(22)} ${mean.map((m) => m.toFixed(2).padStart(7)).join('')}  ${faults.map((f) => f.rule).join(',') || 'ok'}`);
  for (const f of faults) console.log(`    ${f.text}`);
  if (process.argv.includes('--forms')) {
    for (let d = 1; d <= 5; d++) {
      const per = forms.get(d);
      console.log(`    d${d}: ` + [...per.entries()].map(([k, p]) => `${k} ${(p.s / p.n).toFixed(2)}x${p.n}`).join('  '));
    }
  }
}
