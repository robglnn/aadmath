// Event-shaped analysis: fine envelope, sub-energy, band-over-time.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const DIR = process.argv[2];
const ONLY = process.argv[3];
const RATE = 48000;

function biquad(x, type, f0, Q) {
  const w = 2 * Math.PI * f0 / RATE, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const o = (b0 / a0) * x[i] + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}
const rmsWin = (x, ms) => {
  const W = Math.round(RATE * ms / 1000), out = [];
  for (let s = 0; s + W <= x.length; s += W) {
    let e = 0; for (let i = s; i < s + W; i++) e += x[i] * x[i];
    out.push(Math.sqrt(e / W));
  }
  return out;
};
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -99);

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.f32')).sort()) {
  if (ONLY && !f.includes(ONLY)) continue;
  const buf = readFileSync(path.join(DIR, f));
  const inter = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const n = inter.length / 2;
  const M = new Float32Array(n);
  for (let i = 0; i < n; i++) M[i] = (inter[i * 2] + inter[i * 2 + 1]) / 2;
  const sub = biquad(biquad(M, 'lp', 32, 0.7), 'lp', 32, 0.7);
  const low = biquad(biquad(M, 'hp', 60, 0.7), 'lp', 300, 0.7);
  const mid = biquad(biquad(M, 'hp', 400, 0.7), 'lp', 2500, 0.7);
  const hi = biquad(biquad(M, 'hp', 3000, 0.7), 'hp', 3000, 0.7);
  const e = rmsWin(M, 50), es = rmsWin(sub, 50), el = rmsWin(low, 50), em = rmsWin(mid, 50), eh = rmsWin(hi, 50);
  const tot = M.reduce((a, x) => a + x * x, 0);
  const subE = sub.reduce((a, x) => a + x * x, 0);
  console.log(`\n== ${f.replace('.f32', '')}  sub<32Hz share ${(100 * subE / tot).toFixed(1)}%  peak ${db(M.reduce((a,x)=>Math.max(a,Math.abs(x)),0)).toFixed(1)} dB`);
  const fmt = (a) => a.map((x) => String(Math.round(db(x))).padStart(4)).join('');
  console.log(` all ${fmt(e)}`);
  console.log(` sub ${fmt(es)}`);
  console.log(` low ${fmt(el)}`);
  console.log(` mid ${fmt(em)}`);
  console.log(` hi  ${fmt(eh)}`);
  console.log(` (each column = 50 ms)`);
}
