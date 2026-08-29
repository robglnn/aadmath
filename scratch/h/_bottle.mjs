/** The gentlest possible way up: minimise the WORST gradient on the line. */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7, HALF = ISLAND_R + 6;
const FN = Math.ceil((HALF * 2) / E) + 1;
const FH = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) { const z = -HALF + j * E;
  for (let i = 0; i < FN; i++) { const h = heightAt(-HALF + i * E, z); FH[j * FN + i] = (h ?? NaN); } }
const FG = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
  const k = j * FN + i, h = FH[k];
  if (Number.isNaN(h)) { FG[k] = NaN; continue; }
  const r = i + 1 < FN ? FH[k + 1] : h, l = i ? FH[k - 1] : h;
  const u = j + 1 < FN ? FH[k + FN] : h, d = j ? FH[k - FN] : h;
  FG[k] = Math.hypot(((Number.isNaN(r) ? h : r) - (Number.isNaN(l) ? h : l)) / (2 * E),
                     ((Number.isNaN(u) ? h : u) - (Number.isNaN(d) ? h : d)) / (2 * E));
}
const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const K = (x, z) => Math.round((z + HALF) / E) * FN + Math.round((x + HALF) / E);
// bottleneck Dijkstra from the plaza: best[k] = smallest possible max-gradient
const best = new Float32Array(FN * FN).fill(Infinity);
const heap = [];
const push = (k, v) => { heap.push([v, k]); let c = heap.length - 1;
  while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } };
const pop = () => { const top = heap[0], last = heap.pop();
  if (heap.length) { heap[0] = last; let c = 0;
    for (;;) { const l = c * 2 + 1, r = l + 1; let m = c;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === c) break; const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m; } }
  return top; };
const k0 = K(0, 0); best[k0] = FG[k0]; push(k0, best[k0]);
const done = new Uint8Array(FN * FN);
while (heap.length) {
  const [v, k] = pop(); if (done[k]) continue; done[k] = 1;
  const ci = k % FN, cj = (k - ci) / FN;
  for (const [di, dj] of NB) {
    const ni = ci + di, nj = cj + dj;
    if (ni < 0 || nj < 0 || ni >= FN || nj >= FN) continue;
    const nk = nj * FN + ni; if (done[nk] || Number.isNaN(FH[nk])) continue;
    const w = Math.max(v, FG[nk]);
    if (w < best[nk]) { best[nk] = w; push(nk, w); }
  }
}
for (const [n, x, z] of [['summit', 62, -98], ['lookout', 68, -93], ['reach-mid', 74, -70], ['eval-expr', -13.25, -56.63],
  ['mesa', 30, 104], ['grove', -108, -8], ['henge', -84, 74], ['peak2', -92, -66], ['A', 29.4, -93.5], ['B', 44.4, -122.3], ['C', 15.1, -110.1]]) {
  console.log(`${n.padEnd(10)} (${x},${z})  gentlest way up needs gradient ${best[K(x, z)].toFixed(2)}   h=${(FH[K(x, z)] ?? NaN).toFixed(1)}`);
}
// distribution of the bottleneck over all ground
const vs = []; for (let k = 0; k < FN * FN; k++) if (!Number.isNaN(FH[k])) vs.push(best[k]);
vs.sort((a, b) => a - b);
const q = (p) => vs[Math.floor(vs.length * p)].toFixed(2);
console.log(`\nbottleneck over ${vs.length} ground nodes: p50 ${q(0.5)} p75 ${q(0.75)} p90 ${q(0.9)} p95 ${q(0.95)} p99 ${q(0.99)} max ${vs[vs.length - 1].toFixed(2)}`);
for (const lim of [1.3, 1.5, 2, 3, 5]) { const n = vs.filter((v) => v <= lim).length;
  console.log(`  reachable with gradient <= ${lim}: ${n} (${(n / vs.length * 100).toFixed(1)}%)`); }
