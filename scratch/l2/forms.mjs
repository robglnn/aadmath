import { registerPack } from '/Users/harrison/dev/aadmath/src/content/registry.js';
import { generate, demandOf } from '/Users/harrison/dev/aadmath/src/learn/generators.js';
import pack from '/Users/harrison/dev/aadmath/src/content/packs/algebra1-l2.js';
registerPack(pack);
const want = process.argv.slice(2);
for (const [s, forms] of Object.entries(pack.skills)) {
  if (want.length && !want.includes(s)) continue;
  for (const f of forms) {
    const line = [];
    for (let d = 1; d <= 5; d++) {
      if (d < f.dMin || d > f.dMax) { line.push('   -  '); continue; }
      let sum = 0, n = 0;
      for (let i = 0; i < 120; i++) {
        try { sum += demandOf(generate(s, d, i * 7919 + d * 131, { locale: 'en', form: f.id, record: false })); n++; } catch {}
      }
      line.push(n ? (sum / n).toFixed(2).padStart(6) : '  x   ');
    }
    console.log(`${s.padEnd(20)} ${f.id.padEnd(16)} ${line.join(' ')}`);
  }
}
