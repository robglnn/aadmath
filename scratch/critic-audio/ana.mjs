// Offline analysis of captured takes. No dependencies.
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
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
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

function spectrum(mono, N = 8192, hop = 4096) {
  const bins = new Float64Array(N / 2);
  let frames = 0;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  for (let s = 0; s + N <= mono.length; s += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = mono[s + i] * win[i];
    fft(re, im);
    for (let k = 0; k < N / 2; k++) bins[k] += Math.hypot(re[k], im[k]);
    frames++;
  }
  for (let k = 0; k < bins.length; k++) bins[k] /= Math.max(1, frames);
  return bins;
}

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (f) => {
  if (f <= 0) return '-';
  const m = Math.round(69 + 12 * Math.log2(f / 440));
  return NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
};

function analyse(file) {
  const buf = readFileSync(file);
  const inter = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const n = inter.length / 2;
  const L = new Float32Array(n), R = new Float32Array(n), M = new Float32Array(n), S = new Float32Array(n);
  let peak = 0, clip = 0;
  for (let i = 0; i < n; i++) {
    const l = inter[i * 2], r = inter[i * 2 + 1];
    L[i] = l; R[i] = r; M[i] = (l + r) / 2; S[i] = (l - r) / 2;
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (a >= 0.995) clip++;
  }
  // envelope, 20ms
  const W = Math.round(RATE * 0.02);
  const env = [];
  for (let s = 0; s + W <= n; s += W) {
    let e = 0; for (let i = s; i < s + W; i++) e += M[i] * M[i];
    env.push(Math.sqrt(e / W));
  }
  const rms = Math.sqrt(M.reduce((a, x) => a + x * x, 0) / n);
  const sorted = [...env].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] || 0;
  const silent = env.filter((x) => x < 1e-4).length / Math.max(1, env.length);
  // stereo correlation
  let num = 0, dl = 0, dr = 0;
  for (let i = 0; i < n; i++) { num += L[i] * R[i]; dl += L[i] * L[i]; dr += R[i] * R[i]; }
  const corr = num / (Math.sqrt(dl * dr) || 1);
  const sideRms = Math.sqrt(S.reduce((a, x) => a + x * x, 0) / n);

  const spec = spectrum(M);
  let sum = 0, wsum = 0, geo = 0, cnt = 0;
  const bands = { sub: 0, low: 0, lomid: 0, mid: 0, himid: 0, hi: 0, air: 0 };
  const edges = [[20, 60, 'sub'], [60, 250, 'low'], [250, 700, 'lomid'], [700, 2000, 'mid'], [2000, 5000, 'himid'], [5000, 10000, 'hi'], [10000, 20000, 'air']];
  for (let k = 1; k < spec.length; k++) {
    const f = k * RATE / 16384;
    const a = spec[k];
    sum += a; wsum += a * f;
    if (a > 0) { geo += Math.log(a); cnt++; }
    for (const [lo, hi, name] of edges) if (f >= lo && f < hi) bands[name] += a * a;
  }
  const centroid = wsum / (sum || 1);
  const flat = Math.exp(geo / Math.max(1, cnt)) / (sum / spec.length || 1);
  const bt = Object.values(bands).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(bands)) bands[k] = +(10 * Math.log10(bands[k] / bt)).toFixed(1);

  // top spectral peaks below 3kHz -> pitch content
  const peaks = [];
  for (let k = 4; k < Math.floor(3000 * 16384 / RATE); k++) {
    if (spec[k] > spec[k - 1] && spec[k] >= spec[k + 1] && spec[k] > 0) {
      const f = k * RATE / 16384;
      peaks.push({ f, a: spec[k] });
    }
  }
  peaks.sort((a, b) => b.a - a.a);
  const top = peaks.slice(0, 12).map((p) => ({ hz: +p.f.toFixed(1), note: noteName(p.f), db: +(20 * Math.log10(p.a / (peaks[0].a || 1))).toFixed(1) }));

  // onsets on the envelope
  const onsets = [];
  for (let i = 2; i < env.length - 1; i++) {
    const prev = Math.max(env[i - 1], env[i - 2]);
    if (env[i] > 0.012 && env[i] > prev * 2.4 && env[i] > env[i + 1] * 0.9) onsets.push(+(i * 0.02).toFixed(2));
  }

  return {
    take: path.basename(file, '.f32'),
    sec: +(n / RATE).toFixed(2),
    rms_db: +(20 * Math.log10(rms || 1e-9)).toFixed(1),
    peak_db: +(20 * Math.log10(peak || 1e-9)).toFixed(1),
    crest_db: +(20 * Math.log10((peak || 1e-9) / (rms || 1e-9))).toFixed(1),
    env_p10_db: +(20 * Math.log10(q(0.1) || 1e-9)).toFixed(1),
    env_p50_db: +(20 * Math.log10(q(0.5) || 1e-9)).toFixed(1),
    env_p95_db: +(20 * Math.log10(q(0.95) || 1e-9)).toFixed(1),
    dyn_range_db: +(20 * Math.log10((q(0.95) || 1e-9) / (q(0.1) || 1e-9))).toFixed(1),
    clipped: clip,
    silentFrac: +silent.toFixed(3),
    stereoCorr: +corr.toFixed(3),
    side_db: +(20 * Math.log10(sideRms || 1e-9)).toFixed(1),
    centroid_hz: Math.round(centroid),
    flatness: +flat.toFixed(4),
    bands,
    topPeaks: top,
    onsets: onsets.length,
    onsetTimes: onsets.slice(0, 24),
    _spec: spec,
  };
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.f32')).sort();
const res = files.map((f) => analyse(path.join(DIR, f)));

// pairwise spectral distance (log-band cosine distance) to test differentiation
function logBands(spec, nb = 40) {
  const out = new Float64Array(nb);
  const fmin = 40, fmax = 18000;
  for (let k = 1; k < spec.length; k++) {
    const f = k * RATE / 16384;
    if (f < fmin || f > fmax) continue;
    const b = Math.min(nb - 1, Math.floor(nb * Math.log(f / fmin) / Math.log(fmax / fmin)));
    out[b] += spec[k] * spec[k];
  }
  for (let i = 0; i < nb; i++) out[i] = Math.log10(out[i] + 1e-12);
  return out;
}
const lb = res.map((r) => logBands(r._spec));
const dist = [];
for (let i = 0; i < res.length; i++) {
  for (let j = i + 1; j < res.length; j++) {
    let d = 0; for (let k = 0; k < lb[i].length; k++) d += (lb[i][k] - lb[j][k]) ** 2;
    dist.push({ a: res[i].take, b: res[j].take, d: +Math.sqrt(d / lb[i].length).toFixed(3) });
  }
}
for (const r of res) delete r._spec;
writeFileSync(path.join(DIR, 'analysis.json'), JSON.stringify({ takes: res, dist }, null, 2));
for (const r of res) {
  console.log(`${r.take.padEnd(22)} ${String(r.sec).padStart(5)}s rms ${String(r.rms_db).padStart(6)} peak ${String(r.peak_db).padStart(6)} crest ${String(r.crest_db).padStart(5)} dyn ${String(r.dyn_range_db).padStart(5)} clip ${r.clipped} sil ${r.silentFrac} corr ${r.stereoCorr} cent ${String(r.centroid_hz).padStart(5)}Hz flat ${r.flatness} onsets ${r.onsets}`);
  console.log(`   bands ${JSON.stringify(r.bands)}`);
  console.log(`   peaks ${r.topPeaks.slice(0, 8).map((p) => `${p.note}/${p.hz}(${p.db})`).join(' ')}`);
}
console.log('\n--- spectral distances (higher = more different) ---');
for (const d of dist.sort((a, b) => a.d - b.d)) console.log(`${d.d}  ${d.a}  vs  ${d.b}`);
