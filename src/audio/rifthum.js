/**
 * What a rift sounds like from across a valley, and from a metre away.
 *
 * The core idea is one interval of physics: two sawtooths a few cents apart
 * beat against each other at a rate you can count. A statement that is not
 * true yet gets eighteen cents of detune — a slow, uneasy wobble about once a
 * second. A sealed one gets two cents, which is not a wobble at all, it is a
 * chorus. So the *same* voice tells you, from a distance and without a single
 * word, whether the mathematics over there holds.
 *
 * Approach does three things at once, because distance in air does three
 * things at once: it gets louder, it gets brighter (air eats treble, so
 * closing removes that filter), and it gains a sub-harmonic you feel before
 * you identify. Only three voices exist; they are reassigned to the three
 * nearest rifts every frame, which is indistinguishable from ten and costs a
 * third as much.
 */

import { gain, filter, panner, mtof, clamp, noiseSource } from './dsp.js';

const RANGE = 92;
const VOICES = 3;

export class RiftHum {
  constructor(A) {
    this.A = A;
    const ctx = A.ctx;
    this.note = 38;              // set by the score, so the hum is always in key
    this.voices = [];
    for (let i = 0; i < VOICES; i++) {
      const out = gain(ctx, 0);
      const p = panner(ctx, 0);
      const bp = filter(ctx, 'bandpass', 320, 4.5);
      const lp = filter(ctx, 'lowpass', 2400, 0.8);
      bp.connect(lp); lp.connect(out); out.connect(p); p.connect(A.sfx);
      const hall = A.send(p, 'hall', 0.55);

      const a = ctx.createOscillator(); a.type = 'sawtooth';
      const b = ctx.createOscillator(); b.type = 'sawtooth';
      const mix = gain(ctx, 0.5);
      a.connect(mix); b.connect(mix); mix.connect(bp);

      // The partial that only exists when you are close: a high sine two
      // octaves and a fifth up, the "singing" edge of the tear.
      const hi = ctx.createOscillator(); hi.type = 'sine';
      const hiG = gain(ctx, 0);
      hi.connect(hiG); hiG.connect(lp);

      // The body you feel rather than hear, which only arrives inside ten
      // metres. It is the reason walking up to a rift has weight.
      const lo = ctx.createOscillator(); lo.type = 'sine';
      const loG = gain(ctx, 0);
      lo.connect(loG); loG.connect(out);

      // Instability: a narrow band of noise, gated by how far the statement is
      // from being true. A sealed rift has none of it.
      const ns = noiseSource(ctx, 'pink', 0.9);
      const nf = filter(ctx, 'bandpass', 2100, 7);
      const nG = gain(ctx, 0);
      ns.connect(nf); nf.connect(nG); nG.connect(lp);

      const t0 = ctx.currentTime;
      a.start(t0); b.start(t0); hi.start(t0); lo.start(t0);
      this.voices.push({ a, b, hi, lo, hiG, loG, nG, nf, bp, lp, out, p, hall });
    }
    this.focus = -1;      // index of the rift whose panel is open
  }

  /** Keep the hum inside the score's key. */
  setKey(root) { this.note = root - 12; }

  /**
   * @param {Array} near  up to three entries, nearest first:
   *   { d, pan, mastered, locked, tension }
   *   `tension` 0..1 — how unresolved this rift's statement still is.
   */
  update(dt, near) {
    const A = this.A;
    if (!A.live) return;
    const ctx = A.ctx, t = ctx.currentTime;
    const set = (p, v, tau = 0.25) => p.setTargetAtTime(v, t, tau);
    const base = mtof(this.note);

    for (let i = 0; i < VOICES; i++) {
      const v = this.voices[i];
      const r = near[i];
      if (!r) { set(v.out.gain, 0, 0.5); set(v.hiG.gain, 0, 0.4); set(v.loG.gain, 0, 0.4); set(v.nG.gain, 0, 0.4); continue; }

      // Inverse-ish falloff, floored so a rift at the far edge of the island is
      // a presence rather than a discontinuity when it pops in.
      const k = clamp(1 - r.d / RANGE, 0, 1);
      const close = k * k;
      const lock = r.locked ? 0.28 : 1;

      // Pitch: a fifth for a sealed rift, a fourth-plus-a-hair for an open
      // one. The open interval is deliberately not a consonance.
      const f = base * (r.mastered ? 1.4983 : 1.3480);
      set(v.a.frequency, f, 0.6);
      set(v.b.frequency, f, 0.6);
      const cents = r.mastered ? 2.2 : (5 + r.tension * 16);
      set(v.a.detune, -cents, 0.5);
      set(v.b.detune, cents, 0.5);

      set(v.out.gain, (0.020 + close * 0.15) * lock * (r.focus ? 1.45 : 1), 0.35);
      set(v.bp.frequency, f * (1.1 + close * 1.5), 0.4);
      set(v.bp.Q, 6.5 - close * 3.5, 0.4);
      set(v.lp.frequency, 500 + close * 5200 * lock, 0.4);

      set(v.hi.frequency, f * 3.0, 0.6);
      set(v.hiG.gain, close * close * 0.030 * lock * (r.mastered ? 1.4 : 0.8), 0.4);

      set(v.lo.frequency, f * 0.25, 0.6);
      set(v.loG.gain, clamp(1 - r.d / 14, 0, 1) ** 2 * 0.10 * lock, 0.35);

      set(v.nG.gain, close * 0.022 * r.tension * lock, 0.4);
      set(v.nf.frequency, 1800 + close * 1400, 0.5);

      if (v.p.pan) set(v.p.pan, clamp(r.pan, -1, 1), 0.18);
      set(v.hall.gain, 0.30 + (1 - close) * 0.55, 0.5);
    }
  }

  /**
   * The tear stops arguing. Both saws slide onto the same pitch over a quarter
   * of a second, the instability band closes, and the whole voice steps up a
   * fifth — the audible half of a statement becoming true. Called just before
   * the resolution chord so the two land together.
   */
  resolve(index = 0) {
    const A = this.A;
    if (!A.live) return;
    const v = this.voices[index];
    if (!v) return;
    const t = A.t;
    v.a.detune.cancelScheduledValues(t);
    v.b.detune.cancelScheduledValues(t);
    v.a.detune.setValueAtTime(v.a.detune.value, t);
    v.b.detune.setValueAtTime(v.b.detune.value, t);
    v.a.detune.linearRampToValueAtTime(0, t + 0.26);
    v.b.detune.linearRampToValueAtTime(0, t + 0.26);
    const f0 = v.a.frequency.value;
    for (const o of [v.a, v.b]) {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.1115, t + 0.30);
    }
    v.nG.gain.cancelScheduledValues(t);
    v.nG.gain.setTargetAtTime(0, t, 0.08);
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setValueAtTime(v.out.gain.value, t);
    v.out.gain.linearRampToValueAtTime(v.out.gain.value * 1.5, t + 0.10);
    v.out.gain.setTargetAtTime(0.02, t + 0.34, 0.5);
  }

  /**
   * A wrong move does not punish the tear, it tightens it: the band narrows
   * and closes for a third of a second, then breathes back out. Felt, not
   * announced.
   */
  tighten(index = 0) {
    const A = this.A;
    if (!A.live) return;
    const v = this.voices[index];
    if (!v) return;
    const t = A.t;
    v.lp.frequency.cancelScheduledValues(t);
    v.lp.frequency.setValueAtTime(v.lp.frequency.value, t);
    v.lp.frequency.exponentialRampToValueAtTime(Math.max(180, v.lp.frequency.value * 0.35), t + 0.09);
    v.lp.frequency.setTargetAtTime(2200, t + 0.34, 0.4);
  }
}

export { RANGE };
