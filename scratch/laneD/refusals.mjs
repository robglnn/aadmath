/**
 * Lane D: GENERATED and REJECTED, with the reason, at the level the pack's own
 * guards work — one `build()` call per seed, exactly as `generate` makes it.
 */
import { rng } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';

for (const { unit } of await allUnits()) await loadUnit(unit);
const pack = (await import('../../src/content/packs/algebra1-l5.js')).default;
const SEEDS = Number(process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : 500);
const T = (k) => String(k);          // the reason census does not read prose

const why = new Map();
let built = 0, refused = 0;
const perSkill = new Map();
for (const [skill, forms] of Object.entries(pack.skills)) {
  let b = 0, x = 0;
  for (const form of forms) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let s = 0; s < SEEDS; s++) {
        const seed = (s * 7919 + d * 131) >>> 0;
        const r = rng(seed);
        const sr = rng((seed ^ 0x5bf03635) >>> 0);
        try { form.build({ r, d, T, skill, sr }); built++; b++; }
        catch (e) {
          refused++; x++;
          const m = String(e.message).replace(/^retry: /, '');
          const key = `${skill}/${form.id}: ${m}`;
          why.set(key, (why.get(key) || 0) + 1);
        }
      }
    }
  }
  perSkill.set(skill, [b, x]);
}
console.log(`${SEEDS} seeds per form per band over 13 skills / ${Object.values(pack.skills).flat().length} forms`);
console.log(`built ${built}, refused ${refused}  (${(100 * refused / (built + refused)).toFixed(1)}% of draws)`);
console.log('\nper skill (built / refused):');
for (const [k, [b, x]] of perSkill) console.log(`  ${k.padEnd(24)} ${String(b).padStart(6)} / ${x}`);
console.log('\nevery reason a draw was refused:');
for (const [k, n] of [...why.entries()].sort((a, b) => b[1] - a[1])) console.log(`  x${String(n).padStart(5)}  ${k}`);
