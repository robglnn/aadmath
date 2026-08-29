/** Can every form be generated at every band it declares, in every locale? */
import { generate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';
for (const { unit } of await allUnits()) await loadUnit(unit);
const N = Number(process.argv[2] || 120);
let bad = 0;
for (const skill of SKILLS) {
  for (const f of FORMS_BY_SKILL[skill] || []) {
    for (let d = f.dMin; d <= f.dMax; d++) {
      for (const loc of ['en', 'es', 'pl']) {
        let ok = 0, last = '';
        for (let s = 0; s < N; s++) {
          try { const it = generate(skill, d, s * 7919 + d * 131, { locale: loc, strict: true, record: false, form: f.id }); if (it.form === f.id) ok++; }
          catch (e) { last = e.message; }
        }
        if (ok === 0) { console.log(`DEAD  ${skill}/${f.id} d${d} ${loc}: ${last}`); bad++; }
        else if (ok < N * 0.15) console.log(`thin  ${skill}/${f.id} d${d} ${loc}: ${ok}/${N}`);
      }
    }
  }
}
console.log(bad ? `FAIL ${bad} dead cells` : 'every declared (form, band, locale) generates');
process.exit(bad ? 1 : 0);
