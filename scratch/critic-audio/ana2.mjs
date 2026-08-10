// Musical analysis: chroma over time, onsets, envelope shape, harmonic motion.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const DIR = process.argv[2];
const RATE = 48000;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.f32')).sort()) {
  const buf = readFileSync(path.join(DIR, f));
  const inter = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const n = inter.length / 2;
  const M = new Float32Array(n);
  for (let i = 0; i < n; i++) M[i] = (inter[i * 2] + inter[i * 2 + 1]) / 2;

  const N = 4096, HOP = 2048;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const frames = [];
  let prev = null;
  const flux = [];
  const chromaSeq = [];
  for (let s = 0; s + N <= n; s += HOP) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = M[s + i] * win[i];
    fft(re, im);
    const mag = new Float64Array(N / 2);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    let fl = 0;
    if (prev) for (let k = 2; k < N / 2; k++) { const d = mag[k] - prev[k]; if (d > 0) fl += d; }
    flux.push(fl);
    prev = mag;
    const ch = new Float64Array(12);
    for (let k = 2; k < N / 2; k++) {
      const fr = k * RATE / N;
      if (fr < 55 || fr > 2200) continue;
      const pc = ((Math.round(69 + 12 * Math.log2(fr / 440)) % 12) + 12) % 12;
      ch[pc] += mag[k] * mag[k];
    }
    chromaSeq.push(ch);
    frames.push(s / RATE);
  }
  // envelope, 100 ms
  const W = Math.round(RATE * 0.1), env = [];
  for (let s = 0; s + W <= n; s += W) {
    let e = 0; for (let i = s; i < s + W; i++) e += M[i] * M[i];
    env.push(Math.sqrt(e / W));
  }
  const emax = Math.max(...env);
  const envDb = env.map((x) => 20 * Math.log10((x || 1e-9) / emax));
  // longest stretch more than 14 dB below peak = "breath"
  let best = 0, cur = 0, quietFrac = 0;
  for (const d of envDb) { if (d < -14) { cur++; quietFrac++; if (cur > best) best = cur; } else cur = 0; }
  // onsets from spectral flux
  const mf = flux.reduce((a, b) => a + b, 0) / flux.length;
  const sd = Math.sqrt(flux.reduce((a, b) => a + (b - mf) ** 2, 0) / flux.length);
  const on = [];
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > mf + 2.0 * sd && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) on.push(+(frames[i]).toFixed(2));
  }
  // dedupe within 120ms
  const onsets = on.filter((t, i) => i === 0 || t - on[i - 1] > 0.12);
  // aggregate chroma + chroma change
  const agg = new Float64Array(12);
  for (const c of chromaSeq) for (let i = 0; i < 12; i++) agg[i] += c[i];
  const mx = Math.max(...agg) || 1;
  const chroma = Array.from(agg).map((x) => +(x / mx).toFixed(2));
  const pcs = chroma.map((v, i) => ({ n: NOTE[i], v })).sort((a, b) => b.v - a.v).slice(0, 7);
  // harmonic motion: cosine distance between chroma of consecutive 4s blocks
  const BL = Math.round(4 * RATE / HOP);
  const blocks = [];
  for (let b = 0; b + BL <= chromaSeq.length; b += BL) {
    const c = new Float64Array(12);
    for (let i = b; i < b + BL; i++) for (let k = 0; k < 12; k++) c[k] += chromaSeq[i][k];
    const nn = Math.sqrt(c.reduce((a, x) => a + x * x, 0)) || 1;
    blocks.push(Array.from(c).map((x) => x / nn));
  }
  const motion = [];
  for (let i = 1; i < blocks.length; i++) {
    let d = 0; for (let k = 0; k < 12; k++) d += blocks[i][k] * blocks[i - 1][k];
    motion.push(+(1 - d).toFixed(3));
  }
  const blockTop = blocks.map((b) => NOTE[b.indexOf(Math.max(...b))]);
  console.log(`${f.replace('.f32', '').padEnd(18)} dur ${(n / RATE).toFixed(0)}s onsets ${String(onsets.length).padStart(3)} (${(onsets.length / (n / RATE)).toFixed(2)}/s)  quiet${'<'}-14dB ${(quietFrac / envDb.length * 100).toFixed(0)}% longestQuiet ${(best * 0.1).toFixed(1)}s  envRange ${(Math.max(...envDb) - Math.min(...envDb)).toFixed(1)}dB`);
  console.log(`   chroma: ${pcs.map((p) => `${p.n}:${p.v}`).join(' ')}`);
  console.log(`   blockRoots: ${blockTop.join(' ')}`);
  console.log(`   harmonicMotion: ${motion.join(' ')}`);
  console.log(`   onsetTimes: ${onsets.slice(0, 30).join(' ')}`);
  console.log(`   envDb(1s): ${envDb.filter((_, i) => i % 10 === 0).map((x) => x.toFixed(0)).join(' ')}`);
}
