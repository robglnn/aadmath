import { registerPack } from '/Users/harrison/dev/aadmath/src/content/registry.js';
import { generate, demandOf } from '/Users/harrison/dev/aadmath/src/learn/generators.js';
import pack from '/Users/harrison/dev/aadmath/src/content/packs/algebra1-l2.js';
registerPack(pack);
const skills = Object.keys(pack.skills);
let bad = 0;
for (const s of skills) {
  const line = [];
  for (let d = 1; d <= 5; d++) {
    let ok = 0, sum = 0, err = null;
    for (let i = 0; i < 240; i++) {
      try { const it = generate(s, d, i * 7919 + d * 131, { locale: 'en', strict: true, record: false }); ok++; sum += demandOf(it); }
      catch (e) { if (!err) err = e.message; }
    }
    line.push(`d${d}:${ok}/240 ${ok ? (sum / ok).toFixed(2) : '--'}`);
    if (ok < 240) { bad++; console.log(`  !! ${s} d${d}: ${err}`); }
  }
  console.log(s.padEnd(22), line.join('  '));
}
// per-form
console.log('\n--- every form, every band, by name');
for (const [s, forms] of Object.entries(pack.skills)) {
  for (const f of forms) {
    for (let d = f.dMin; d <= f.dMax; d++) {
      try { generate(s, d, d * 977 + 13, { locale: 'en', strict: true, form: f.id, record: false }); }
      catch (e) { console.log(`  FAIL ${s}/${f.id} d${d}: ${e.message}`); bad++; }
    }
  }
}
console.log(bad ? `\n${bad} problem cells` : '\nall clean');
