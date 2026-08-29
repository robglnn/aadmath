/** Asymmetric fill (drop free, climb only what the boots hold) at 1.4 m with 0.7 m midpoints. */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7, HALF = ISLAND_R + 6;
const FN = Math.ceil((HALF * 2) / E) + 1;
const t0 = performance.now();
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
const t1 = performance.now();
// 1.4 m lattice = even fine indices
const S = 1.4, N = ((FN - 1) >> 1) + 1;
const fk = (i, j) => (j * 2) * FN + (i * 2);
const IDX = (i, j) => j * N + i;
const H = new Float32Array(N * N), G = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = fk(i, j); H[IDX(i, j)] = FH[k]; G[IDX(i, j)] = FG[k]; }
const NB = [[1,0,S],[-1,0,S],[0,1,S],[0,-1,S],[1,1,S*Math.SQRT2],[1,-1,S*Math.SQRT2],[-1,1,S*Math.SQRT2],[-1,-1,S*Math.SQRT2]];
const mid = (i, j, b) => (j * 2 + NB[b][1]) * FN + (i * 2 + NB[b][0]);
const CX = (i) => -HALF + i * S, CZ = (j) => -HALF + j * S;
function fillHome(SLOPE, CLIMB) {
  const HOME = new Uint8Array(N * N); const q = new Int32Array(N * N); let head = 0, tail = 0;
  const c0 = IDX(Math.round(HALF / S), Math.round(HALF / S)); HOME[c0] = 1; q[tail++] = c0;
  while (head < tail) {
    const k = q[head++]; const ci = k % N, cj = (k - ci) / N; const h0 = H[k];
    for (let b = 0; b < 8; b++) {
      const ni = ci + NB[b][0], nj = cj + NB[b][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = IDX(ni, nj); if (HOME[nk]) continue;
      const h1 = H[nk]; if (Number.isNaN(h1)) continue;
      // he is at n and must get to c. Climbing to c is the constrained way.
      const rise = h0 - h1;
      if (rise > 0.03) {
        if (rise > CLIMB * NB[b][2]) continue;
        if (G[k] > SLOPE) continue;                 // the face he'd be climbing into
        const m = FG[mid(ci, cj, [1,0,2,3,4,5,6,7].map(() => 0)[0])]; // placeholder
      }
      // midpoint: the lip between the two
      const mk = (cj * 2 + NB[b][1]) * FN + (ci * 2 + NB[b][0]);
      const mh = FH[mk];
      if (!Number.isNaN(mh) && mh - h1 > 0.03 && (mh - h1 > CLIMB * NB[b][2] * 0.5 || FG[mk] > SLOPE)) continue;
      HOME[nk] = 1; q[tail++] = nk;
    }
  }
  return HOME;
}
function fillWalk(STAND, CLIMB) {   // symmetric-ish: both nodes standable
  const OK = new Uint8Array(N * N); const q = new Int32Array(N * N); let head = 0, tail = 0;
  const c0 = IDX(Math.round(HALF / S), Math.round(HALF / S)); OK[c0] = 1; q[tail++] = c0;
  while (head < tail) {
    const k = q[head++]; const ci = k % N, cj = (k - ci) / N; const h0 = H[k];
    for (let b = 0; b < 8; b++) {
      const ni = ci + NB[b][0], nj = cj + NB[b][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = IDX(ni, nj); if (OK[nk]) continue;
      const h1 = H[nk]; if (Number.isNaN(h1)) continue;
      if (G[nk] > STAND) continue;
      const mk = (cj * 2 + NB[b][1]) * FN + (ci * 2 + NB[b][0]);
      if (Number.isNaN(FH[mk]) || FG[mk] > STAND) continue;
      if (Math.abs(h1 - h0) > CLIMB * NB[b][2]) continue;
      OK[nk] = 1; q[tail++] = nk;
    }
  }
  return OK;
}
const t2 = performance.now();
const HOME = fillHome(1.5, 1.15);
const t3 = performance.now();
const WALK = fillWalk(1.3, 1.15);
const t4 = performance.now();
let ground = 0, home = 0, walk = 0, stand = 0, trap = 0;
for (let k = 0; k < N * N; k++) { if (Number.isNaN(H[k])) continue; ground++;
  const st = G[k] <= 1.3; if (st) stand++;
  if (HOME[k]) home++; else if (st) trap++;
  if (WALK[k]) walk++; }
console.log(`lattice ${N}x${N} at ${S} m: ground ${ground} standable ${stand}`);
console.log(`  HOME (escapable, drop free) ${home}  one-way ${ground - home} (${((ground - home) / ground * 100).toFixed(2)}%)  standable-and-trapped ${trap} (${(trap / stand * 100).toFixed(2)}%)`);
console.log(`  WALK (routable) ${walk} (${(walk / ground * 100).toFixed(1)}% of ground, ${(walk / stand * 100).toFixed(1)}% of standable)`);
const at = (F, x, z) => F[IDX(Math.round((x + HALF) / S), Math.round((z + HALF) / S))];
for (const [n, x, z] of [['summit', 62, -98], ['lookout', 68, -93], ['evalexpr', -13.25, -56.63], ['mesa', 30, 104], ['grove', -108, -8], ['henge', -84, 74], ['A', 29.4, -93.5], ['B', 44.4, -122.3], ['C', 15.1, -110.1]])
  console.log(`   ${n.padEnd(9)} HOME=${at(HOME, x, z)} WALK=${at(WALK, x, z)}`);
console.log(`timings: fine ${(t1 - t0).toFixed(0)} ms  home ${(t3 - t2).toFixed(0)} ms  walk ${(t4 - t3).toFixed(0)} ms`);
