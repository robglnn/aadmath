/** Experiment: plan on the BOOTS' rule and see what it costs. */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7;
const HALF = ISLAND_R + 6;
const FN = Math.ceil((HALF * 2) / E) + 1;
console.log('fine grid', FN, 'x', FN, '=', FN * FN);
let t0 = performance.now();
const FH = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) {
  const z = -HALF + j * E;
  for (let i = 0; i < FN; i++) {
    const h = heightAt(-HALF + i * E, z);
    FH[j * FN + i] = (typeof h === 'number' && Number.isFinite(h)) ? h : NaN;
  }
}
let t1 = performance.now();
const FG = new Float32Array(FN * FN);
for (let j = 1; j < FN - 1; j++) {
  for (let i = 1; i < FN - 1; i++) {
    const k = j * FN + i, h = FH[k];
    if (Number.isNaN(h)) { FG[k] = NaN; continue; }
    const a = FH[k + 1], b = FH[k - 1], c = FH[k + FN], d = FH[k - FN];
    const gx = ((Number.isNaN(a) ? h : a) - (Number.isNaN(b) ? h : b)) / (2 * E);
    const gz = ((Number.isNaN(c) ? h : c) - (Number.isNaN(d) ? h : d)) / (2 * E);
    FG[k] = Math.hypot(gx, gz);
  }
}
let t2 = performance.now();
console.log(`heights ${(t1 - t0).toFixed(0)} ms, gradients ${(t2 - t1).toFixed(0)} ms`);
// distribution of gradient over ground
const gs = [];
for (let k = 0; k < FN * FN; k++) if (!Number.isNaN(FG[k])) gs.push(FG[k]);
gs.sort((a, b) => a - b);
const q = (p) => gs[Math.floor(gs.length * p)].toFixed(2);
console.log(`ground nodes ${gs.length}: p50 ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  p95 ${q(0.95)}  p99 ${q(0.99)}  max ${gs[gs.length - 1].toFixed(2)}`);
for (const lim of [1.0, 1.15, 1.25, 1.3, 1.5, 2.0]) {
  const n = gs.filter((g) => g > lim).length;
  console.log(`  over ${lim}: ${n} (${(n / gs.length * 100).toFixed(2)}%)`);
}
