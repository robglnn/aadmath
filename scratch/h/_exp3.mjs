import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7, HALF = ISLAND_R + 6;
const FN = Math.ceil((HALF * 2) / E) + 1;
const FH = new Float32Array(FN * FN), FG = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) { const z = -HALF + j * E;
  for (let i = 0; i < FN; i++) { const h = heightAt(-HALF + i * E, z); FH[j * FN + i] = (h ?? NaN); } }
for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
  const k = j * FN + i, h = FH[k];
  if (Number.isNaN(h)) { FG[k] = NaN; continue; }
  const r = i + 1 < FN ? FH[k + 1] : h, l = i ? FH[k - 1] : h;
  const u = j + 1 < FN ? FH[k + FN] : h, d = j ? FH[k - FN] : h;
  FG[k] = Math.hypot(((Number.isNaN(r) ? h : r) - (Number.isNaN(l) ? h : l)) / (2 * E),
                     ((Number.isNaN(u) ? h : u) - (Number.isNaN(d) ? h : d)) / (2 * E));
}
const FI = (x) => Math.round((x + HALF) / E), FJ = (z) => Math.round((z + HALF) / E);
const gradAt = (x, z) => { const i = FI(x), j = FJ(z); if (i < 0 || j < 0 || i >= FN || j >= FN) return NaN; return FG[j * FN + i]; };
const STEP = 3, N = Math.ceil((HALF * 2) / STEP) + 1;
const IDX = (i, j) => j * N + i, CX = (i) => -HALF + i * STEP, CZ = (j) => -HALF + j * STEP;
const H = new Float32Array(N * N), G = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = CX(i), z = CZ(j); const h = heightAt(x, z);
  H[IDX(i, j)] = (h ?? NaN); G[IDX(i, j)] = gradAt(x, z);
}
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
  const k0 = IDX(CELL(0), CELL(0)); HOME[k0] = 1; qi[0] = CELL(0); qj[0] = CELL(0); tail = 1;
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
  return HOME;
}
const report = (name, HOME, standLim) => {
  let ground = 0, home = 0, trap = 0, standable = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = IDX(i, j); if (Number.isNaN(H[k])) continue; ground++;
    const stand = G[k] <= standLim;
    if (stand) standable++;
    if (HOME[k]) home++; else if (stand) trap++;
  }
  console.log(`${name}: ground ${ground} home ${home} oneWay ${ground - home} (${((ground - home) / ground * 100).toFixed(2)}%)`
    + `  |  standable (grad<=${standLim}) ${standable}, of which TRAPPED ${trap} (${(trap / standable * 100).toFixed(2)}%)`);
  return HOME;
};
report('current (no walk rule)', fill(1.15, 0), 1.3);
report('walk<=1.25           ', fill(1.15, 1.25), 1.3);
report('walk<=1.5            ', fill(1.15, 1.5), 1.3);
report('walk<=1.5            ', fill(1.15, 1.5), 1.0);

// where are the traps?
{
  const HOME = fill(1.15, 1.5);
  const pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = IDX(i, j); if (Number.isNaN(H[k]) || HOME[k] || G[k] > 1.0) continue;
    pts.push([CX(i), CZ(j), +H[k].toFixed(0), +G[k].toFixed(2)]);
  }
  // cluster them crudely
  const used = new Uint8Array(pts.length); const cl = [];
  for (let a = 0; a < pts.length; a++) {
    if (used[a]) continue;
    const grp = [pts[a]]; used[a] = 1;
    for (let b = a + 1; b < pts.length; b++) {
      if (used[b]) continue;
      if (grp.some((p) => Math.hypot(p[0] - pts[b][0], p[1] - pts[b][1]) <= 6)) { grp.push(pts[b]); used[b] = 1; b = a; }
    }
    cl.push(grp);
  }
  cl.sort((p, q) => q.length - p.length);
  console.log(`\n${pts.length} standable trapped cells in ${cl.length} clusters; biggest:`);
  for (const g of cl.slice(0, 12)) {
    const cx = g.reduce((s, p) => s + p[0], 0) / g.length, cz = g.reduce((s, p) => s + p[1], 0) / g.length;
    console.log(`  ${String(g.length).padStart(3)} cells (${(g.length * 9)} m2) around ${cx.toFixed(0)}, ${cz.toFixed(0)}  h~${g[0][2]}  dist from plaza ${Math.hypot(cx, cz).toFixed(0)} m`);
  }
}
