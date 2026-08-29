import { generate, demandOf } from '../src/learn/generators.js';
const N = Number(process.argv[2] || 2000);
const means = [];
for (let d = 1; d <= 5; d++) {
  let s = 0, c = 0;
  for (let i = 0; i < N; i++) {
    try { s += demandOf(generate('multi-step', d, i * 7919 + d * 131, { locale: 'en', strict: true, record: false })); c++; } catch {}
  }
  means.push(s / c);
}
console.log('multi-step, N=' + N, means.map(m => m.toFixed(3).padStart(8)).join(''));
for (let i = 1; i < 5; i++) console.log(`  band ${i} -> ${i + 1}: ${(means[i] - means[i - 1]).toFixed(3)}`);
