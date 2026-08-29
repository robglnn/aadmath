import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7, HALF = ISLAND_R + 6;
const FN = Math.ceil((HALF * 2) / E) + 1;
const FH = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) { const z = -HALF + j * E; for (let i = 0; i < FN; i++) { const h = heightAt(-HALF + i * E, z); FH[j * FN + i] = (h ?? NaN); } }
const FG = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
  const k = j * FN + i, h = FH[k]; if (Number.isNaN(h)) { FG[k] = NaN; continue; }
  const r = i + 1 < FN ? FH[k + 1] : h, l = i ? FH[k - 1] : h, u = j + 1 < FN ? FH[k + FN] : h, d = j ? FH[k - FN] : h;
  FG[k] = Math.hypot(((Number.isNaN(r) ? h : r) - (Number.isNaN(l) ? h : l)) / (2 * E), ((Number.isNaN(u) ? h : u) - (Number.isNaN(d) ? h : d)) / (2 * E));
}
const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const K = (x, z) => Math.round((z + HALF) / E) * FN + Math.round((x + HALF) / E);
const best = new Float32Array(FN * FN).fill(Infinity), prev = new Int32Array(FN * FN).fill(-1);
const heap = []; const push = (k, v) => { heap.push([v, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } };
const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m; } } return top; };
const k0 = K(0, 0); best[k0] = FG[k0]; push(k0, best[k0]);
const done = new Uint8Array(FN * FN);
while (heap.length) { const [v, k] = pop(); if (done[k]) continue; done[k] = 1;
  const ci = k % FN, cj = (k - ci) / FN;
  for (const [di, dj] of NB) { const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= FN || nj >= FN) continue;
    const nk = nj * FN + ni; if (done[nk] || Number.isNaN(FH[nk])) continue;
    const w = Math.max(v, FG[nk]); if (w < best[nk]) { best[nk] = w; prev[nk] = k; push(nk, w); } } }
const goal = K(68, -93);
console.log('bottleneck to lookout:', best[goal].toFixed(2));
const path = []; for (let k = goal; k !== -1; k = prev[k]) path.push(k);
path.reverse();
console.log('path length', path.length, 'nodes');
const worst = [];
for (const k of path) { const i = k % FN, j = (k - i) / FN; if (FG[k] > 1.3) worst.push([+( -HALF + i * E).toFixed(1), +(-HALF + j * E).toFixed(1), +FG[k].toFixed(2), +FH[k].toFixed(1)]); }
console.log(`${worst.length} nodes on the gentlest line over 1.30:`);
for (const w of worst) console.log('   ', w.join('  '));
