/**
 * Lane D: how many DISTINCT items each Level 5 skill really produces per
 * locale, and whether EVERY declared form generates in EVERY band it declares,
 * in every language.
 *
 * The second half is here because the first half hid a defect: a form that
 * throws on every seed simply vanishes from a sample loop that catches and
 * continues, and the count of the skill beside it looks healthy.
 */
import { generate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';

for (const { unit } of await allUnits()) await loadUnit(unit);
const mod = await import('../../src/content/packs/algebra1-l5.js');
const mine = Object.keys(mod.default.skills);
const SEEDS = Number(process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : 200);
const LOCS = ['en', 'es', 'pl'];

// ---- every form, every band, every locale ---------------------------------
const dead = [];
let forms = 0;
for (const skill of mine) {
  for (const f of FORMS_BY_SKILL[skill]) {
    for (let d = f.dMin; d <= f.dMax; d++) {
      for (const loc of LOCS) {
        forms++;
        let ok = false; let why = '';
        for (let s = 0; s < 60 && !ok; s++) {
          try { generate(skill, d, s * 613 + d * 97, { locale: loc, strict: true, record: false, form: f.id }); ok = true; }
          catch (e) { why = e.message; }
        }
        if (!ok) dead.push(`${skill}/${f.id} d${d} ${loc}: ${why}`);
      }
    }
  }
}
console.log(`forms x bands x locales asked: ${forms}; dead: ${dead.length}`);
for (const d of dead) console.log('  DEAD ' + d);

// ---- distinct items per skill per locale ----------------------------------
console.log('\nskill                        en      es      pl');
let worst = Infinity; let worstName = '';
for (const skill of mine) {
  const per = {};
  for (const loc of LOCS) {
    const seen = new Set();
    for (let d = 1; d <= 5; d++) {
      for (let s = 0; s < SEEDS; s++) {
        try {
          const it = generate(skill, d, s * 7919 + d * 131, { locale: loc, strict: true, record: false });
          seen.add(`${it.stem}||${it.latex}||${it.answer}`);
        } catch { /* the loop above is what catches a dead form */ }
      }
    }
    per[loc] = seen.size;
    if (seen.size < worst) { worst = seen.size; worstName = `${skill}/${loc}`; }
  }
  console.log(`${skill.padEnd(24)} ${String(per.en).padStart(7)} ${String(per.es).padStart(7)} ${String(per.pl).padStart(7)}`);
}
console.log(`\nthinnest: ${worstName} at ${worst} distinct items from ${SEEDS * 5} draws`);
