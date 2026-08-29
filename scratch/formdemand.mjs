import { generate, demandOf } from '../src/learn/generators.js';
import { registerPack, formsFor } from '../src/content/registry.js';
import pack from '../src/content/packs/algebra1-l3.js';
registerPack(pack);
for (const sk of process.argv.slice(2)) {
  console.log('== ' + sk);
  for (const f of formsFor(sk)) {
    const m = [];
    for (let d = 1; d <= 5; d++) {
      if (d < f.dMin || d > f.dMax) { m.push(null); continue; }
      let s = 0, c = 0;
      for (let i = 0; i < 500; i++) { try { s += demandOf(generate(sk, d, i * 7919 + d * 131, { locale: 'en', form: f.id, strict: true, record: false })); c++; } catch {} }
      m.push(c ? s / c : NaN);
    }
    console.log('  ' + f.id.padEnd(14) + m.map(x => (x == null ? '      ·' : x.toFixed(2).padStart(7))).join(''));
  }
}
