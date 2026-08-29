/** Lane D: strict KaTeX over every string a Level 5 card actually renders. */
import katex from 'katex';
import { generate } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';

for (const { unit } of await allUnits()) await loadUnit(unit);
const mod = await import('../../src/content/packs/algebra1-l5.js');
const mine = Object.keys(mod.default.skills);
const SEEDS = Number(process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : 200);

const bad = new Map();
let rendered = 0, items = 0;
const render = (src, where) => {
  if (src == null || String(src).trim() === '') return;
  rendered++;
  try { katex.renderToString(String(src), { throwOnError: true, strict: 'error', displayMode: true }); }
  catch (e) { bad.set(`${where}: ${String(e.message).slice(0, 90)}`, (bad.get(`${where}: ${String(e.message).slice(0, 90)}`) || 0) + 1); }
};

for (const skill of mine) {
  for (let d = 1; d <= 5; d++) {
    for (let s = 0; s < SEEDS; s++) {
      for (const loc of ['en', 'es', 'pl']) {
        let it;
        try { it = generate(skill, d, s * 7919 + d * 131, { locale: loc, strict: true, record: false }); } catch { continue; }
        items++;
        render(it.latex, `${skill}/${it.form} latex`);
        render(it.answer, `${skill}/${it.form} answer`);
        for (const dd of it.distractors || []) render(dd.value, `${skill}/${it.form} option`);
        for (const st of it.steps || []) render(st.latex, `${skill}/${it.form} step`);
      }
    }
  }
}
console.log(`${items} items, ${rendered} strings rendered under throwOnError + strict:'error'`);
for (const [k, n] of [...bad.entries()].sort((a, b) => b[1] - a[1])) console.log(`  x${n}  ${k}`);
console.log(bad.size ? `FAIL — ${bad.size} distinct strict-KaTeX faults` : 'PASS — every rendered string is strict-KaTeX clean');
