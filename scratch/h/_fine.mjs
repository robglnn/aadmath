/** The walk graph at the boots' own resolution. */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7, HALF = ISLAND_R + 6;
const FN = Math.ceil((HALF * 2) / E) + 1;
const t0 = performance.now();
const FH = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) { const z = -HALF + j * E;
  for (let i = 0; i < FN; i++) { const h = heightAt(-HALF + i * E, z); FH[j * FN + i] = (h ?? NaN); } }
const t1 = performance.now();
const FG = new Float32Array(FN * FN);
for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
  const k = j * FN + i, h = FH[k];
  if (Number.isNaN(h)) { FG[k] = NaN; continue; }
  const r = i + 1 < FN ? FH[k + 1] : h, l = i ? FH[k - 1] : h;
  const u = j + 1 < FN ? FH[k + FN] : h, d = j ? FH[k - FN] : h;
  FG[k] = Math.hypot(((Number.isNaN(r) ? h : r) - (Number.isNaN(l) ? h : l)) / (2 * E),
                     ((Number.isNaN(u) ? h : u) - (Number.isNaN(d) ? h : d)) / (2 * E));
}
const t2 = performance.now();
const NB = [[1,0,E],[-1,0,E],[0,1,E],[0,-1,E],[1,1,E*Math.SQRT2],[1,-1,E*Math.SQRT2],[-1,1,E*Math.SQRT2],[-1,-1,E*Math.SQRT2]];
function fill(STAND, CLIMB) {
  const HOME = new Uint8Array(FN * FN);
  const q = new Int32Array(FN * FN); let head = 0, tail = 0;
  const i0 = Math.round((0 + HALF) / E), j0 = Math.round((0 + HALF) / E);
  const k0 = j0 * FN + i0; HOME[k0] = 1; q[tail++] = k0;
  while (head < tail) {
    const k = q[head++]; const ci = k % FN, cj = (k - ci) / FN; const h0 = FH[k];
    for (let b = 0; b < 8; b++) {
      const ni = ci + NB[b][0], nj = cj + NB[b][1];
      if (ni < 0 || nj < 0 || ni >= FN || nj >= FN) continue;
      const nk = nj * FN + ni; if (HOME[nk]) continue;
      const h1 = FH[nk]; if (Number.isNaN(h1)) continue;
      if (FG[nk] > STAND) continue;                       // he cannot stand there
      if (h0 - h1 > CLIMB * NB[b][2]) continue;           // …nor climb from there to here
      HOME[nk] = 1; q[tail++] = nk;
    }
  }
  return HOME;
}
for (const [S, C] of [[1.3, 1.3], [1.5, 1.4], [1.45, 1.45], [1.3, 1.15]]) {
  const t3 = performance.now();
  const HOME = fill(S, C);
  const t4 = performance.now();
  let ground = 0, stand = 0, home = 0, trap = 0;
  for (let k = 0; k < FN * FN; k++) {
    if (Number.isNaN(FH[k])) continue; ground++;
    const st = FG[k] <= S; if (st) stand++;
    if (HOME[k]) home++; else if (st) trap++;
  }
  console.log(`stand<=${S} climb<=${C}: ground ${ground} standable ${stand} home ${home} TRAPPED-standable ${trap} (${(trap / stand * 100).toFixed(2)}%)  fill ${(t4 - t3).toFixed(0)} ms`);
  // is the Spine's lookout reachable on foot?
  const at = (x, z) => HOME[Math.round((z + HALF) / E) * FN + Math.round((x + HALF) / E)];
  console.log(`   summit(62,-98)=${at(62, -98)}  lookout(68,-93)=${at(68, -93)}  mesa(30,104)=${at(30, 104)}  grove(-108,-8)=${at(-108, -8)}  henge(-84,74)=${at(-84, 74)}  evalexpr(-13,-57)=${at(-13, -57)}`);
}
console.log(`heights ${(t1 - t0).toFixed(0)} ms  gradients ${(t2 - t1).toFixed(0)} ms`);
