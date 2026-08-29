/** Plan on the boots' rule: what does connectivity look like? */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7, HALF = ISLAND_R + 6;
const FN = Math.ceil((HALF * 2) / E) + 1;
const FH = new Float32Array(FN * FN), FG = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) { const z = -HALF + j * E;
  for (let i = 0; i < FN; i++) { const h = heightAt(-HALF + i * E, z); FH[j * FN + i] = (h ?? NaN); } }
for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
  const k = j * FN + i, h = FH[k];
  if (Number.isNaN(h)) { FG[k] = NaN; continue; }
  const gx = ((i + 1 < FN ? FH[k + 1] : h) - (i ? FH[k - 1] : h));
  const gz = ((j + 1 < FN ? FH[k + FN] : h) - (j ? FH[k - FN] : h));
  const a = Number.isNaN(gx) ? 0 : gx, b = Number.isNaN(gz) ? 0 : gz;
  FG[k] = Math.hypot(a, b) / (2 * E);
}
const FI = (x) => Math.round((x + HALF) / E), FJ = (z) => Math.round((z + HALF) / E);
const gradAt = (x, z) => { const i = FI(x), j = FJ(z); if (i < 0 || j < 0 || i >= FN || j >= FN) return NaN; return FG[j * FN + i]; };

const STEP = 3, N = Math.ceil((HALF * 2) / STEP) + 1;
const IDX = (i, j) => j * N + i, CX = (i) => -HALF + i * STEP, CZ = (j) => -HALF + j * STEP;
const H = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = heightAt(CX(i), CZ(j)); H[IDX(i, j)] = (h ?? NaN); }
const NB = [[1,0,STEP],[-1,0,STEP],[0,1,STEP],[0,-1,STEP],[1,1,STEP*Math.SQRT2],[1,-1,STEP*Math.SQRT2],[-1,1,STEP*Math.SQRT2],[-1,-1,STEP*Math.SQRT2]];

function edgeWorst(x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / E));
  let w = 0;
  for (let k = 0; k <= n; k++) { const t = k / n; const g = gradAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    if (Number.isNaN(g)) return Infinity; if (g > w) w = g; }
  return w;
}

function fill(CLIMB, WALK) {
  const HOME = new Uint8Array(N * N);
  const qi = new Int32Array(N * N), qj = new Int32Array(N * N);
  let head = 0, tail = 0;
  const CELL = (v) => Math.round((v + HALF) / STEP);
  const seed = (i, j) => { const k = IDX(i, j); if (HOME[k] || Number.isNaN(H[k])) return; HOME[k] = 1; qi[tail] = i; qj[tail] = j; tail++; };
  seed(CELL(0), CELL(0));
  while (head < tail) {
    const ci = qi[head], cj = qj[head]; head++;
    const h0 = H[IDX(ci, cj)];
    for (let b = 0; b < NB.length; b++) {
      const ni = ci + NB[b][0], nj = cj + NB[b][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const k = IDX(ni, nj); if (HOME[k]) continue;
      const h1 = H[k]; if (Number.isNaN(h1)) continue;
      if (h0 - h1 > CLIMB * NB[b][2]) continue;
      if (WALK && edgeWorst(CX(ni), CZ(nj), CX(ci), CZ(cj)) > WALK) continue;
      HOME[k] = 1; qi[tail] = ni; qj[tail] = nj; tail++;
    }
  }
  let ground = 0, home = 0;
  for (let k = 0; k < N * N; k++) { if (Number.isNaN(H[k])) continue; ground++; if (HOME[k]) home++; }
  return { ground, home, oneWay: ground - home, share: (ground - home) / ground };
}
console.log('current rule            ', JSON.stringify(fill(1.15, 0)));
for (const w of [2.0, 1.6, 1.5, 1.4, 1.3, 1.25, 1.15]) {
  const t0 = performance.now();
  const r = fill(1.15, w);
  console.log(`boots rule, walk<=${w}   `, JSON.stringify(r), ` ${(performance.now() - t0).toFixed(0)} ms`);
}
