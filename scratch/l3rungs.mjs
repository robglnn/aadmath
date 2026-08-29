import { generate, demandOf } from '../src/learn/generators.js';
import { registerPack } from '../src/content/registry.js';
import pack from '../src/content/packs/algebra1-l3.js';
registerPack(pack);
const N = 1200;
let worst = Infinity, worstAt = '';
for (const sk of Object.keys(pack.skills)) {
  const m = [];
  for (let d = 1; d <= 5; d++) {
    let s = 0, c = 0;
    for (let i = 0; i < N; i++) { try { s += demandOf(generate(sk, d, i * 7919 + d * 131, { locale: 'en', strict: true, record: false })); c++; } catch {} }
    m.push(s / c);
  }
  const gaps = m.slice(1).map((x, i) => x - m[i]);
  const min = Math.min(...gaps);
  if (min < worst) { worst = min; worstAt = sk; }
  console.log(`${min > 0 ? ' ' : '!'} ${sk.padEnd(24)}${m.map(x => x.toFixed(2).padStart(7)).join('')}   min rung ${min.toFixed(3)}`);
}
console.log(`\nsmallest rung anywhere in Level 3: ${worst.toFixed(3)} (${worstAt})`);
