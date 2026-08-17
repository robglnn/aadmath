/**
 * Instruments.
 *
 * Each function builds a complete one-shot voice, schedules it, and arranges
 * its own funeral. They take an absolute audio-clock time so a scheduler can
 * place them ahead of the playhead, which is the only way to get a chord that
 * arrives on the beat instead of whenever the browser felt like running a
 * frame.
 */

import {
  mtof, gain, filter, panner, hit, swell, noiseSource, pluckBuffer, rnd, clamp,
} from './dsp.js';

/**
 * The pad: two saws a few cents apart through a resonant lowpass.
 *
 * The detune is doing all the work. A single saw through a filter is a synth
 * preset; two saws six cents apart beat against each other about once every
 * two seconds at this register, and that slow beating is what the ear hears as
 * "an ensemble" rather than "an oscillator". The filter opens slightly across
 * the note's life so the chord blooms rather than merely appearing.
 */
export function pad(A, note, t0, dur, opts = {}) {
  const ctx = A.ctx;
  const f = mtof(note);
  const g = gain(ctx, 0);
  // The cutoff has to be mostly absolute. Scaling it off the note's own pitch
  // meant a chord voiced at D2 got a 130 Hz lowpass — the pad contributed a
  // fundamental and nothing else, and the whole score turned into rumble.
  const cut = (hz) => Math.max(260, Math.min(9000, hz)) * (opts.bright || 1);
  const lp = filter(ctx, 'lowpass', cut(f * 4.0 + 1500), 0.9);
  const p = panner(ctx, opts.pan ?? rnd(-0.55, 0.55));
  const oscs = [];
  for (const cents of [-6.5, 6.5]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = cents + (opts.detune || 0);
    o.connect(lp);
    oscs.push(o);
  }
  // A sine an octave below fills the body without adding another saw's worth
  // of harmonics — but only where an octave down is still a note. Below about
  // 150 Hz it stops being warmth and becomes cabinet noise.
  let bodyG = null;
  if (f > 150) {
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = f * 0.5;
    bodyG = gain(ctx, 0.30);
    body.connect(bodyG); bodyG.connect(lp);
    oscs.push(body);
  }

  lp.connect(g); g.connect(p); p.connect(opts.bus || A.music);
  const sendG = A.send(p, 'hall', (opts.air ?? 0.5) * 0.55);

  // `dur` is how long this chord *owns the slot*; the release happens on top
  // of the next chord, which is the whole of what legato is. Subtracting the
  // release out of the slot instead — which is what this did — leaves a hole
  // between every pair of chords.
  const atk = opts.attack ?? 2.4;
  const rel = opts.release ?? 3.4;
  const sus = Math.max(0.1, dur - atk);
  swell(g.gain, t0, opts.level ?? 0.12, atk, sus, rel);

  lp.frequency.setValueAtTime(cut(f * 2.4 + 700), t0);
  lp.frequency.linearRampToValueAtTime(cut(f * 6.0 + 2600), t0 + atk + sus * 0.6);
  lp.frequency.linearRampToValueAtTime(cut(f * 2.0 + 600), t0 + atk + sus + rel);

  const end = t0 + atk + sus + rel + 0.1;
  for (const o of oscs) { o.start(t0); o.stop(end); }
  oscs[0].onended = () => {
    for (const n of [lp, g, p, bodyG, sendG]) { try { n && n.disconnect(); } catch { /* gone */ } }
  };
  return end;
}

/**
 * The floor of the mix: a sine root with a twelfth above it, barely moving.
 *
 * It has to be *continuous*. A root that fades out inside its own slot leaves
 * the score with no floor for five seconds out of every eight, and what the
 * ear reads then is not restraint, it is the music having stopped. So the
 * sustain fills the slot and the release runs on into the next one.
 */
export function sub(A, note, t0, dur, level = 0.20, opts = {}) {
  const ctx = A.ctx;
  const g = gain(ctx, 0);
  const o = ctx.createOscillator();
  o.type = 'sine'; o.frequency.value = mtof(note);
  // The octave and the twelfth above the root, quietly. A 73 Hz sine on its
  // own is inaudible on a laptop and on every phone ever made; with its second
  // and third partials present the ear reconstructs the missing fundamental
  // and hears the root anyway. On headphones the same two partials are simply
  // the warmth of the note.
  const o2 = ctx.createOscillator();
  o2.type = 'sine'; o2.frequency.value = mtof(note + 19); o2.detune.value = -4;
  const g2 = gain(ctx, 0.13);
  const o3 = ctx.createOscillator();
  o3.type = 'sine'; o3.frequency.value = mtof(note + 12); o3.detune.value = 3;
  const g3 = gain(ctx, 0.16);
  o.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
  g.connect(opts.bus || A.music);
  const atk = opts.attack ?? 1.6;
  const rel = opts.release ?? 3.2;
  swell(g.gain, t0, level, atk, Math.max(0.1, dur - atk), rel);
  const end = t0 + dur + rel + 0.2;
  for (const x of [o, o2, o3]) { x.start(t0); x.stop(end); }
  o.onended = () => {
    for (const n of [g, g2, g3]) { try { n.disconnect(); } catch { /* gone */ } }
  };
}

/**
 * A bell, by frequency modulation.
 *
 * The inharmonic ratio is the entire point: at 3.51 the sidebands do not land
 * on the harmonic series, which is what makes metal sound like metal and not
 * like an organ. The modulation index collapses far faster than the amplitude,
 * so the strike is bright and clangorous and what rings on is a near-sine —
 * exactly what a struck bar does.
 */
export function bell(A, note, t0, opts = {}) {
  const ctx = A.ctx;
  const f = mtof(note);
  const car = ctx.createOscillator();
  car.type = 'sine'; car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.type = 'sine'; mod.frequency.value = f * (opts.ratio ?? 3.51);
  const idx = gain(ctx, 0);
  mod.connect(idx); idx.connect(car.frequency);

  const g = gain(ctx, 0);
  const p = panner(ctx, opts.pan ?? rnd(-0.7, 0.7));
  car.connect(g); g.connect(p); p.connect(opts.bus || A.music);
  const sendG = A.send(p, 'hall', opts.air ?? 0.42);

  const decay = opts.decay ?? 2.4;
  const level = opts.level ?? 0.16;
  hit(g.gain, t0, level, 0.004, decay);
  const depth = f * (opts.index ?? 2.6);
  idx.gain.setValueAtTime(depth, t0);
  idx.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.02), t0 + decay * 0.22);

  const end = t0 + decay + 0.08;
  car.start(t0); car.stop(end); mod.start(t0); mod.stop(end);
  car.onended = () => {
    for (const n of [idx, g, p, sendG]) { try { n && n.disconnect(); } catch { /* gone */ } }
  };
}

/**
 * A plucked string, played from the offline Karplus–Strong buffer at whatever
 * rate the pitch needs. Transposing a physical model by playback rate also
 * scales its decay, which is exactly what a real string does — the top of a
 * harp dies in half a second and the bottom rings for four.
 */
export function pluck(A, note, t0, opts = {}) {
  const ctx = A.ctx;
  const s = ctx.createBufferSource();
  s.buffer = pluckBuffer(ctx, 220, 2.8, opts.damp ?? 0.28);
  s.playbackRate.value = clamp(mtof(note) / 220, 0.18, 6);
  const lp = filter(ctx, 'lowpass', clamp(mtof(note) * 16, 2400, 13000), 0.7);
  const g = gain(ctx, opts.level ?? 0.2);
  const p = panner(ctx, opts.pan ?? rnd(-0.6, 0.6));
  s.connect(lp); lp.connect(g); g.connect(p); p.connect(opts.bus || A.music);
  const sendG = A.send(p, 'hall', opts.air ?? 0.5);
  s.start(t0);
  const dur = (s.buffer.duration / s.playbackRate.value) + 0.1;
  s.stop(t0 + dur);
  s.onended = () => {
    for (const n of [lp, g, p, sendG]) { try { n && n.disconnect(); } catch { /* gone */ } }
  };
}

/**
 * A breath of filtered noise that rises and falls — the layer that makes a
 * static chord feel like weather rather than a held key.
 */
export function shimmer(A, t0, opts = {}) {
  const ctx = A.ctx;
  const s = noiseSource(ctx, 'pink', 1, t0);
  const bp = filter(ctx, 'bandpass', opts.freq ?? 1400, opts.Q ?? 2.4);
  const g = gain(ctx, 0);
  const p = panner(ctx, opts.pan ?? rnd(-0.8, 0.8));
  s.connect(bp); bp.connect(g); g.connect(p); p.connect(opts.bus || A.music);
  const sendG = A.send(p, 'hall', opts.air ?? 0.7);
  const rise = opts.rise ?? 1.6, fall = opts.fall ?? 2.4;
  swell(g.gain, t0, opts.level ?? 0.05, rise, opts.hold ?? 0.2, fall);
  bp.frequency.setValueAtTime((opts.freq ?? 1400) * 0.6, t0);
  bp.frequency.exponentialRampToValueAtTime((opts.freq ?? 1400) * (opts.sweep ?? 1.7), t0 + rise + fall);
  const end = t0 + rise + (opts.hold ?? 0.2) + fall + 0.1;
  s.stop(end);
  s.onended = () => {
    for (const n of [bp, g, p, sendG]) { try { n && n.disconnect(); } catch { /* gone */ } }
  };
}

/**
 * A VOICE. Three singers on one note, through the formants of an open vowel.
 *
 * This is the one instrument in the game that is not an object. Everything else
 * in this file is a thing being struck, blown or plucked; nothing until now was
 * a person. That is why it is here, and it is spent on exactly one event — a
 * statement that held — because a choir that turns up for a footstep is not a
 * choir, it is a preset.
 *
 * How it works, and why it is not just a pad with a filter on it:
 *
 *   THE SINGERS  three sawtooths, detuned by a few cents *and* started with
 *                independent phase, because what the ear identifies as "more
 *                than one person" is the beating between voices that are almost
 *                but never exactly together.
 *   THE VOWEL    three bandpass filters in parallel at the first three formants
 *                of a sung "ah" — about 700, 1150 and 2600 Hz. Formants are
 *                fixed in *absolute* frequency, not relative to the note: that
 *                is the whole difference between a choir and a chipmunk, and it
 *                is why singing the same vowel higher does not raise the vowel.
 *   THE VIBRATO  arrives late and shallow. A singer does not vibrate on the
 *                attack; they place the note first and the vibrato grows into
 *                it. Starting it at full depth is the most recognisable tell of
 *                a synthesised voice there is.
 *   THE BREATH   a whisper of noise through the same formants, under everything,
 *                so the tone has a body producing it.
 *
 * @param {number} dur seconds the voice holds before it releases
 */
export function choir(A, note, t0, dur, opts = {}) {
  const ctx = A.ctx;
  const f = mtof(note);
  const src = gain(ctx, 0.34);
  const parts = [];

  for (const cents of [-7.5, 0.5, 8.5]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = cents + (opts.detune || 0);
    o.connect(src);
    parts.push(o);
  }

  // Vibrato, growing in. One oscillator drives all three singers, which is
  // correct: a section breathes together even when it does not tune together.
  const vib = ctx.createOscillator();
  vib.type = 'sine';
  vib.frequency.value = rnd(4.4, 5.4);
  const vibDepth = gain(ctx, 0);
  vib.connect(vibDepth);
  for (const o of parts) vibDepth.connect(o.detune);
  parts.push(vib);
  const atk = opts.attack ?? 0.42;
  vibDepth.gain.setValueAtTime(0, t0);
  vibDepth.gain.linearRampToValueAtTime(opts.vibrato ?? 8, t0 + atk + 0.7);

  // Breath. Cheap, quiet, and the difference between a voice and an oscillator.
  const br = noiseSource(ctx, 'pink', 1, t0);
  const brG = gain(ctx, 0.055);
  br.connect(brG); brG.connect(src);

  const g = gain(ctx, 0);
  const p = panner(ctx, opts.pan ?? rnd(-0.5, 0.5));
  // "ah" — open, forward, the vowel a held note is sung on.
  const FORMANTS = [[700, 1.9, 1.0], [1150, 3.4, 0.62], [2620, 5.5, 0.22]];
  const chain = [];
  for (const [hz, Q, lv] of FORMANTS) {
    const bp = filter(ctx, 'bandpass', hz * (opts.vowel ?? 1), Q);
    const lg = gain(ctx, lv);
    src.connect(bp); bp.connect(lg); lg.connect(g);
    chain.push(bp, lg);
  }
  // A little of the raw tone under the formants, so low notes keep a body —
  // three bandpasses on their own throw the fundamental away.
  const body = filter(ctx, 'lowpass', Math.max(220, f * 1.6), 0.7);
  const bodyG = gain(ctx, 0.30);
  src.connect(body); body.connect(bodyG); bodyG.connect(g);

  g.connect(p); p.connect(opts.bus || A.music);
  const sendHall = A.send(p, 'hall', opts.air ?? 0.85);

  const rel = opts.release ?? 2.2;
  swell(g.gain, t0, opts.level ?? 0.10, atk, Math.max(0.1, dur - atk), rel);

  const end = t0 + dur + rel + 0.15;
  for (const o of parts) { o.start(t0); o.stop(end); }
  br.stop(end);
  parts[0].onended = () => {
    for (const n of [src, vibDepth, brG, body, bodyG, g, p, sendHall, ...chain]) {
      try { n && n.disconnect(); } catch { /* gone */ }
    }
  };
  return end;
}

/**
 * A body: the low thump under an impact. No pitch to speak of, just a fast
 * downward sine sweep, which is what every kick drum and every boot on packed
 * earth actually is.
 */
export function thump(A, t0, opts = {}) {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = 'sine';
  const f0 = opts.freq ?? 96, f1 = opts.to ?? 42;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + (opts.drop ?? 0.09));
  const g = gain(ctx, 0);
  o.connect(g);
  const p = panner(ctx, opts.pan ?? 0);
  g.connect(p); p.connect(opts.bus || A.sfx);
  hit(g.gain, t0, opts.level ?? 0.22, 0.002, opts.decay ?? 0.20);
  const end = t0 + (opts.decay ?? 0.20) + 0.06;
  o.start(t0); o.stop(end);
  o.onended = () => { for (const n of [g, p]) { try { n.disconnect(); } catch { /* gone */ } } };
}

/**
 * A grain of noise, shaped. This is the whole vocabulary of footsteps: give it
 * a centre frequency, a width, a decay and a colour, and it is gravel, snow,
 * grass, dust or water depending only on those four numbers.
 */
export function grain(A, t0, opts = {}) {
  const ctx = A.ctx;
  const s = noiseSource(ctx, opts.colour || 'white', opts.rate ?? 1, t0);
  const f = ctx.createBiquadFilter();
  f.type = opts.type || 'bandpass';
  f.frequency.value = opts.freq ?? 1600;
  f.Q.value = opts.Q ?? 1.1;
  const g = gain(ctx, 0);
  const p = panner(ctx, opts.pan ?? 0);
  s.connect(f); f.connect(g); g.connect(p); p.connect(opts.bus || A.sfx);
  const sendG = A.send(p, opts.space || 'air', opts.air ?? 0.28);
  const atk = opts.attack ?? 0.003;
  const dec = opts.decay ?? 0.10;
  hit(g.gain, t0, opts.level ?? 0.2, atk, dec, opts.hold ?? 0);
  if (opts.sweep) {
    f.frequency.setValueAtTime((opts.freq ?? 1600), t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, (opts.freq ?? 1600) * opts.sweep), t0 + atk + dec);
  }
  const end = t0 + atk + dec + (opts.hold ?? 0) + 0.05;
  s.stop(end);
  s.onended = () => {
    for (const n of [f, g, p, sendG]) { try { n && n.disconnect(); } catch { /* gone */ } }
  };
}

/** A short pitched tick — interface, and the crystalline ring of set lattice. */
export function ping(A, freq, t0, opts = {}) {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = opts.type || 'triangle';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + (opts.decay ?? 0.09));
  const g = gain(ctx, 0);
  const p = panner(ctx, opts.pan ?? 0);
  o.connect(g); g.connect(p); p.connect(opts.bus || A.ui);
  const sendG = A.send(p, opts.space || 'air', opts.air ?? 0.2);
  hit(g.gain, t0, opts.level ?? 0.1, opts.attack ?? 0.002, opts.decay ?? 0.09);
  const end = t0 + (opts.decay ?? 0.09) + 0.05;
  o.start(t0); o.stop(end);
  o.onended = () => {
    for (const n of [g, p, sendG]) { try { n && n.disconnect(); } catch { /* gone */ } }
  };
}
