/**
 * Audio capture harness.
 *
 * A screenshot proves a picture. Nothing in this repo proved a *sound*, so a
 * builder could ship a silent game, or a clipping one, and describe it as
 * "lush". This drives the real running game in Chromium, taps the master bus
 * with a recorder, plays a scripted twenty-six seconds — stand, sprint, glide,
 * cross a region, walk up to a rift, get one wrong, get one right — and writes
 * three artefacts you can actually inspect:
 *
 *   probe.wav    the recording, at the context's own sample rate
 *   probe.png    a log-frequency spectrogram with an RMS envelope under it
 *   probe.json   per-beat level, peak, clipping and silence measurements
 *
 * Usage:  node tools/audio-probe.mjs --url http://127.0.0.1:4173 --out shots/audio
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/audio'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1800);

// --- the gesture, and the tap ---------------------------------------------
await page.mouse.click(640, 360);
await page.waitForFunction(() => window.__ascent.audio?.bus?.ready, null, { timeout: 8000 });

const started = await page.evaluate(() => {
  const bus = window.__ascent.audio.bus;
  const c = bus.ctx;
  const rec = { chunks: [], rate: c.sampleRate, peak: 0, clipped: 0, n: 0 };
  window.__rec = rec;
  const sp = c.createScriptProcessor(4096, 2, 2);
  sp.onaudioprocess = (e) => {
    const l = e.inputBuffer.getChannelData(0);
    const r = e.inputBuffer.getChannelData(1);
    const out = new Float32Array(l.length * 2);
    for (let i = 0; i < l.length; i++) {
      out[i * 2] = l[i]; out[i * 2 + 1] = r[i];
      const m = Math.max(Math.abs(l[i]), Math.abs(r[i]));
      if (m > rec.peak) rec.peak = m;
      if (m >= 0.999) rec.clipped++;
    }
    rec.n += l.length;
    rec.chunks.push(out);
  };
  bus.out.connect(sp);
  sp.connect(c.destination);
  return { rate: c.sampleRate, state: c.state, muted: bus.muted };
});
if (started.muted) await page.evaluate(() => window.__ascent.audio.bus.setMuted(false));
console.log(`recording at ${started.rate} Hz (context ${started.state})`);

// --- the score of events ---------------------------------------------------
const marks = [];
const mark = (label) => marks.push({ label, t: Date.now() });
const T0 = Date.now();

// `--score` solos the music bus and holds the real Score class at chosen
// values of the two dials it actually listens to — where you are standing, and
// how much of the lattice is true — so the composition can be judged on its
// own instead of being guessed at underneath wind and boots. Nothing is mocked:
// this is the running game's own scheduler, with its inputs pinned.
if (process.argv.includes('--score')) {
  await page.evaluate(() => {
    const a = window.__ascent.audio;
    const b = a.bus;
    for (const k of ['amb', 'sfx', 'ui']) b[k].gain.value = 0;
    // Pinned immediately before the scheduler runs, not after: the director
    // writes travel/alt/focus into the score every frame, so anything set
    // afterwards is overwritten before it can reach a chord.
    const su = a.score.update.bind(a.score);
    window.__pin = { place: 'home', mastery: 0, travel: 1, alt: 0 };
    a.score.update = (dt) => {
      const p = window.__pin;
      a.score.setPlace(p.place);
      a.score.setMastery(p.mastery);
      a.score.travel = p.travel;
      a.score.alt = p.alt;
      a.score.focus = 0;
      su(dt);
    };
  });
  const takes = [
    ['home · lattice empty', 'home', 0.02],
    ['home · half true', 'home', 0.45],
    ['home · whole', 'home', 0.97],
    ['spine · whole', 'alpine', 0.97],
    ['vale · half', 'verdant', 0.45],
    ['wastes · empty', 'badland', 0.05],
    ['fen · half', 'mire', 0.5],
    ['home · standing still', 'home', 0.6],
  ];
  for (const [label, place, m] of takes) {
    await page.evaluate(([p, mm, still]) => {
      window.__pin.place = p; window.__pin.mastery = mm;
      window.__pin.travel = still ? 0 : 0.7;
    }, [place, m, label.includes('standing')]);
    mark(label);
    await page.waitForTimeout(label.includes('standing') ? 20000 : 13000);
  }
  mark('end');
} else if (process.argv.includes('--feet')) {
  // Boots only, one material at a time. The label is not what we hoped the
  // ground was: it is what the director actually decided it was standing on.
  await page.evaluate(() => {
    const b = window.__ascent.audio.bus;
    for (const k of ['music', 'amb', 'ui']) b[k].gain.value = 0;
  });
  const spots = [[0, 10], [-26, 62], [58, -96], [46, -74], [30, 100], [-104, -6]];
  for (const [x, z] of spots) {
    await page.evaluate(([px, pz]) => {
      const a = window.__ascent;
      a.player.pos.set(px, (a.player.groundAt(px, pz) ?? 20) + 0.4, pz);
      a.player.vel.set(0, 0, 0);
    }, [x, z]);
    await page.waitForTimeout(700);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    const sfc = await page.evaluate(() => window.__ascent.audio._surface);
    mark(`${sfc} (${x},${z})`);
    await page.waitForTimeout(2600);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(400);
  }
  mark('end');
} else if (process.argv.includes('--seals')) {
  await page.evaluate(() => window.__ascent.teleportTo('var-meaning'));
  await page.waitForTimeout(500);
  mark('rest');
  await page.waitForTimeout(3000);
  for (const [label, big] of [['seal', false], ['seal: mastered', true], ['slip', null]]) {
    await page.evaluate(() => window.__ascent.panel.close());
    await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
    await page.waitForTimeout(1400);
    mark(label);
    if (label === 'slip') {
      await page.evaluate(() => window.__ascent.audio.answered(false, null));
    } else {
      await page.evaluate((b) => window.__ascent.audio.answered(true, {
        pL: b ? 0.95 : 0.55, justMastered: b,
      }), big);
    }
    await page.waitForTimeout(5200);
  }
  mark('end');
} else {
mark('spawn / ambience');
await page.waitForTimeout(4000);

mark('sprint');
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(3500);
mark('jump + glide');
await page.keyboard.press('Space');
await page.waitForTimeout(320);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(3200);
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');

mark('free fall');
await page.evaluate(() => {
  const a = window.__ascent;
  a.player.pos.set(0, (a.player.groundAt(0, 30) ?? 12) + 95, 30);
  a.player.vel.set(0, 0, 0);
});
await page.waitForTimeout(4200);

mark('alpine');
await page.evaluate(() => {
  const a = window.__ascent;
  a.player.pos.set(24, (a.player.groundAt(24, -114) ?? 90) + 0.4, -114);
  a.player.vel.set(0, 0, 0);
});
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW');

mark('approach rift');
await page.evaluate(() => window.__ascent.teleportTo('var-meaning'));
await page.waitForTimeout(2500);

mark('rift opens');
await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
await page.waitForTimeout(1800);

mark('wrong answer');
await page.evaluate(() => window.__ascent.panel.demo('wrong'));
await page.waitForTimeout(2200);

mark('seal');
await page.evaluate(() => window.__ascent.panel.demo('right'));
await page.waitForTimeout(4200);

// --- solo passes: each bus on its own, so a muddy mix can be blamed on the
// layer that is actually muddy rather than on the mix.
const solo = async (label, which, drive) => {
  // Solo by muting the others, never by re-levelling the one under test —
  // otherwise the report describes a mix nobody will ever hear.
  await page.evaluate((w) => {
    const b = window.__ascent.audio.bus;
    b.__solo ||= { music: b.music.gain.value, amb: b.amb.gain.value, sfx: b.sfx.gain.value, ui: b.ui.gain.value };
    for (const k of ['music', 'amb', 'sfx', 'ui']) b[k].gain.value = w === k ? b.__solo[k] : 0;
  }, which);
  mark(label);
  if (drive) await drive();
  else await page.waitForTimeout(4000);
};
await page.evaluate(() => { window.__ascent.panel.close(); window.__ascent.player.pos.set(0, 40, 26); });
await page.waitForTimeout(600);
// The score rests when the cadet does, so a solo taken standing still measures
// the silence between phrases rather than the music.
await solo('solo: score', 'music', async () => {
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(6000);
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
});
await solo('solo: world', 'amb');
await solo('solo: body', 'sfx', async () => {
  await page.evaluate(() => {
    const a = window.__ascent;
    a.player.pos.set(0, (a.player.groundAt(0, 26) ?? 12) + 0.4, 26); a.player.vel.set(0, 0, 0);
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
});

mark('end');
}
const rec = await page.evaluate(() => {
  const r = window.__rec;
  const total = r.chunks.reduce((s, c) => s + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of r.chunks) { all.set(c, o); o += c.length; }
  const bytes = new Uint8Array(all.buffer);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return { b64: btoa(bin), rate: r.rate, peak: r.peak, clipped: r.clipped, frames: r.n };
});
await browser.close();

const raw = Buffer.from(rec.b64, 'base64');
const inter = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const N = inter.length / 2;
const mono = new Float32Array(N);
for (let i = 0; i < N; i++) mono[i] = (inter[i * 2] + inter[i * 2 + 1]) * 0.5;
const dur = N / rec.rate;
console.log(`captured ${dur.toFixed(1)}s  peak ${rec.peak.toFixed(3)}  clipped ${rec.clipped} samples`);

// --- wav -------------------------------------------------------------------
{
  const pcm = Buffer.alloc(inter.length * 2);
  for (let i = 0; i < inter.length; i++) {
    const v = Math.max(-1, Math.min(1, inter[i]));
    pcm.writeInt16LE((v * 32767) | 0, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22); h.writeUInt32LE(rec.rate, 24);
  h.writeUInt32LE(rec.rate * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  await writeFile(path.join(OUT, 'probe.wav'), Buffer.concat([h, pcm]));
}

// --- analysis --------------------------------------------------------------
const FFT = 2048, HOP = Math.round(rec.rate * 0.020);
const cols = Math.floor((N - FFT) / HOP);
const bins = FFT / 2;
const win = new Float32Array(FFT);
for (let i = 0; i < FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT - 1));

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
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

const spec = new Float32Array(cols * bins);
const re = new Float32Array(FFT), im = new Float32Array(FFT);
for (let c = 0; c < cols; c++) {
  const off = c * HOP;
  for (let i = 0; i < FFT; i++) { re[i] = mono[off + i] * win[i]; im[i] = 0; }
  fft(re, im);
  for (let k = 0; k < bins; k++) spec[c * bins + k] = Math.hypot(re[k], im[k]);
}

// RMS envelope, 20 ms
const env = new Float32Array(cols);
for (let c = 0; c < cols; c++) {
  let s = 0;
  const off = c * HOP;
  for (let i = 0; i < HOP && off + i < N; i++) s += mono[off + i] ** 2;
  env[c] = Math.sqrt(s / HOP);
}

// --- png -------------------------------------------------------------------
const W = Math.min(1600, cols);
const HS = 420, HE = 130, PAD = 26;
const H = HS + HE + PAD;
const px = Buffer.alloc(W * H * 3, 8);
const put = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = r; px[o + 1] = g; px[o + 2] = b;
};
// magma-ish ramp: dark blue → magenta → orange → white
const ramp = (v) => {
  const t = Math.max(0, Math.min(1, v));
  const stops = [[4, 6, 24], [58, 12, 96], [148, 24, 108], [222, 74, 62], [250, 176, 62], [255, 250, 224]];
  const f = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f)), k = f - i;
  return [0, 1, 2].map((c) => Math.round(stops[i][c] + (stops[i + 1][c] - stops[i][c]) * k));
};
const fmax = rec.rate / 2;
const LOMIN = 40;
for (let x = 0; x < W; x++) {
  const c = Math.floor((x / W) * cols);
  for (let y = 0; y < HS; y++) {
    // log frequency axis, 40 Hz at the bottom to Nyquist at the top
    const u = 1 - y / HS;
    const f = LOMIN * Math.pow(fmax / LOMIN, u);
    const k = Math.min(bins - 1, Math.round((f / fmax) * bins));
    const mag = spec[c * bins + k];
    const dbv = 20 * Math.log10(mag / (FFT / 4) + 1e-9);
    const v = (dbv + 96) / 96;
    const [r, g, b] = ramp(v);
    put(x, y, r, g, b);
  }
}
// envelope panel
for (let x = 0; x < W; x++) {
  const c = Math.floor((x / W) * cols);
  const dbv = 20 * Math.log10(env[c] + 1e-9);
  const h = Math.max(0, Math.min(1, (dbv + 60) / 60)) * (HE - 8);
  for (let y = 0; y < h; y++) put(x, HS + PAD + HE - 1 - y, 90, 220, 255);
}
// -6 dBFS and -20 dBFS guides on the envelope
for (const [lvl, col] of [[-6, [255, 96, 96]], [-20, [70, 90, 110]]]) {
  const y = HS + PAD + HE - 1 - Math.round(((lvl + 60) / 60) * (HE - 8));
  for (let x = 0; x < W; x += 3) put(x, y, ...col);
}
// event marks
for (const m of marks) {
  const x = Math.round(((m.t - T0) / 1000 / dur) * W);
  for (let y = 0; y < H; y += 4) put(x, y, 255, 255, 255);
}

function png(w, h, rgb) {
  const stride = w * 3 + 1;
  const rawBuf = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    rawBuf[y * stride] = 0;
    rgb.copy(rawBuf, y * stride + 1, y * w * 3, (y + 1) * w * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rawBuf, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
let TBL = null;
function crc32(buf) {
  if (!TBL) {
    TBL = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TBL[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}
await writeFile(path.join(OUT, 'probe.png'), png(W, H, px));

// --- per-section report ----------------------------------------------------
const sections = marks.map((m, i) => {
  const a = (m.t - T0) / 1000;
  const b = i + 1 < marks.length ? (marks[i + 1].t - T0) / 1000 : dur;
  const c0 = Math.max(0, Math.floor((a / dur) * cols));
  const c1 = Math.min(cols, Math.ceil((b / dur) * cols));
  let sum = 0, peak = 0, n = 0;
  for (let c = c0; c < c1; c++) { sum += env[c] ** 2; peak = Math.max(peak, env[c]); n++; }
  const rms = n ? Math.sqrt(sum / n) : 0;
  // Tonal balance, measured the way an ear measures it: energy per OCTAVE,
  // not per hertz. A plain low/mid/high split always says "your mix is 70 %
  // bass", because an octave at the bottom is 40 Hz wide and an octave at the
  // top is 5 kHz wide. Octave bands referenced to pink noise are flat for a
  // balanced mix, and the tilt is then readable at a glance.
  const OCT = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
  const band = OCT.map(() => 0);
  for (let c = c0; c < c1; c++) {
    for (let k = 1; k < bins; k++) {
      const f = (k / bins) * (rec.rate / 2);
      const e = spec[c * bins + k] ** 2;
      for (let j = 0; j < OCT.length; j++) {
        if (f >= OCT[j] * 0.707 && f < OCT[j] * 1.414) band[j] += e;
      }
    }
  }
  const nrm = Math.max(...band) || 1;
  return {
    label: m.label, from: +a.toFixed(2), to: +b.toFixed(2),
    rmsDb: +(20 * Math.log10(rms + 1e-9)).toFixed(1),
    peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1),
    // dB relative to the loudest octave: 0 is the peak band, negatives below.
    octaves: band.map((v) => +(10 * Math.log10(v / nrm + 1e-12)).toFixed(0)),
  };
});
const report = {
  rate: rec.rate, seconds: +dur.toFixed(2),
  peak: +rec.peak.toFixed(4), peakDb: +(20 * Math.log10(rec.peak + 1e-9)).toFixed(2),
  clippedSamples: rec.clipped,
  silentSeconds: +(env.reduce((s, v) => s + (v < 1e-4 ? 1 : 0), 0) * (HOP / rec.rate)).toFixed(2),
  sections, errors: logs,
};
await writeFile(path.join(OUT, 'probe.json'), JSON.stringify(report, null, 2));

console.log(`\n${OUT}/probe.png`);
console.log('   time  section              rms    peak   octaves rel dB  63 125 250 500  1k  2k  4k  8k');
for (const s of sections) {
  console.log(`  ${s.from.toFixed(1).padStart(5)}s  ${s.label.padEnd(18)} ${String(s.rmsDb).padStart(6)} ${String(s.peakDb).padStart(6)}                  ${s.octaves.map((v) => String(v).padStart(3)).join(' ')}`);
}
console.log(`peak ${report.peakDb} dBFS   clipped ${report.clippedSamples}   silent ${report.silentSeconds}s   errors ${logs.length}`);
process.exit(logs.length ? 2 : 0);
