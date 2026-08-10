/**
 * The world's own noise.
 *
 * Three things are happening at once here and they are deliberately separable:
 *
 *   WIND      four bands of filtered pink noise whose balance is a function of
 *             altitude and airspeed. Near the ground it is almost all low
 *             rumble and you barely notice it. Two hundred metres up with the
 *             wing open, the low band has thinned out and a narrow resonant
 *             band around 1.6 kHz has taken over — that is the sound of air
 *             going past an edge, and it is most of why a glide reads as fast.
 *
 *   PLACE     five continuous beds, crossfaded by the *same* region weights the
 *             terrain shader uses. Nothing here has its own opinion about where
 *             the fen ends. Under them, sparse scheduled events — birds in the
 *             vale, cicadas on the steppe, ticking stone in the wastes, water
 *             falling in the fen — which is what stops a bed from being a hum.
 *
 *   HEIGHT    leaving the ground does not just add wind, it *removes* detail.
 *             The beds low-pass and duck as you climb, and the reverb send
 *             rises, so altitude sounds like emptiness rather than volume.
 */

import {
  gain, filter, noiseSource, clamp, rnd, panner,
} from './dsp.js';
import { grain, ping } from './voices.js';

const ZONES = ['alpine', 'verdant', 'steppe', 'badland', 'mire'];

export class Ambience {
  constructor(A) {
    this.A = A;
    const ctx = A.ctx;

    // ---------------- wind ----------------
    this.windSum = gain(ctx, 1);
    this.windSum.connect(A.amb);
    this.windAir = A.send(this.windSum, 'air', 0.30);
    this.windHall = A.send(this.windSum, 'hall', 0.16);

    const band = (colour, type, freq, Q, rate) => {
      const s = noiseSource(ctx, colour, rate);
      const f = filter(ctx, type, freq, Q);
      const g = gain(ctx, 0);
      const p = panner(ctx, 0);
      s.connect(f); f.connect(g); g.connect(p); p.connect(this.windSum);
      return { s, f, g, p };
    };

    // the body of the air — always there, felt more than heard
    this.wLow = band('brown', 'lowpass', 190, 0.7, 0.8);
    // the middle, where the moving air lives
    this.wMid = band('pink', 'bandpass', 620, 0.9, 1);
    // gusts: a narrow band that wanders
    this.wGust = band('pink', 'bandpass', 1100, 3.2, 0.85);
    // the edge tone a wing makes
    this.wEdge = band('pink', 'bandpass', 1900, 9, 1.15);

    this.wLow.g.gain.value = 0.10;
    this.gustPhase = 0;
    this.gustTarget = 0;

    // ---------------- the five beds ----------------
    this.beds = {};
    const bed = (id, spec) => {
      const s = noiseSource(ctx, spec.colour || 'pink', spec.rate || 1);
      const f = filter(ctx, spec.type, spec.freq, spec.Q);
      const f2 = spec.freq2 ? filter(ctx, spec.type2 || 'bandpass', spec.freq2, spec.Q2 || 2) : null;
      const mod = gain(ctx, 1);
      const lvl = gain(ctx, 0);
      const p = panner(ctx, spec.pan || 0);
      s.connect(f);
      if (f2) { f.connect(f2); f2.connect(mod); } else f.connect(mod);
      mod.connect(lvl); lvl.connect(p); p.connect(A.amb);
      const air = A.send(p, 'air', spec.air ?? 0.3);
      // A slow tremolo keeps a bed alive. Rates are prime-ish against each
      // other so five beds playing at once never pulse together.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = spec.lfo || 0.07;
      const depth = gain(ctx, spec.lfoDepth ?? 0.35);
      lfo.connect(depth); depth.connect(mod.gain);
      lfo.start(ctx.currentTime + Math.random());
      this.beds[id] = { lvl, f, base: spec.gain ?? 0.1, air };
    };

    bed('alpine', {
      type: 'bandpass', freq: 2300, Q: 0.9, gain: 0.10, lfo: 0.043, air: 0.55,
    });
    bed('verdant', {
      type: 'bandpass', freq: 780, Q: 1.0, freq2: 3200, type2: 'lowpass', Q2: 0.7,
      gain: 0.15, lfo: 0.061, air: 0.30,
    });
    bed('steppe', {
      type: 'bandpass', freq: 1500, Q: 0.8, gain: 0.13, lfo: 0.053, air: 0.34,
    });
    bed('badland', {
      colour: 'brown', type: 'lowpass', freq: 260, Q: 0.6, gain: 0.075, lfo: 0.029, air: 0.22,
    });
    bed('mire', {
      type: 'bandpass', freq: 360, Q: 2.0, gain: 0.13, lfo: 0.037, air: 0.45,
    });

    // ---------------- water ----------------
    const ws = noiseSource(ctx, 'pink', 0.6);
    this.waterF = filter(ctx, 'bandpass', 520, 0.8);
    this.waterG = gain(ctx, 0);
    const wp = panner(ctx, 0);
    ws.connect(this.waterF); this.waterF.connect(this.waterG);
    this.waterG.connect(wp); wp.connect(A.amb);
    A.send(wp, 'air', 0.4);
  }

  /**
   * @param {object} s
   *   weights   Float32Array(5) region weights, in ZONES order
   *   alt       0..1 how far above the ground the cadet is
   *   speed     0..1 ground speed against sprint
   *   glide     0..1 airspeed while the wing is open
   *   fall      0..1 how fast the ground is arriving, wing shut
   *   water     0..1 proximity to the lake
   *   indoors   0..1 how much the world is muffled (a rift is open)
   */
  update(dt, s) {
    const A = this.A;
    if (!A.live) return;
    const ctx = A.ctx, t = ctx.currentTime;
    const set = (p, v, tau = 0.35) => p.setTargetAtTime(v, t, tau);

    const alt = clamp(s.alt, 0, 1);
    const fall = clamp(s.fall || 0, 0, 1);
    const move = clamp(Math.max(s.speed * 0.7, s.glide, fall), 0, 1.4);
    const quiet = 1 - clamp(s.indoors, 0, 1) * 0.55;

    // --- wind ----------------------------------------------------------
    // The low band is the mass of the air; it grows with height but slowly,
    // because a gale that scales linearly with altitude sounds like a fader.
    // A fall is the one thing allowed to move it quickly: it is the only
    // moment in this game where the air is genuinely doing something to you,
    // and it has to arrive in the second it starts and leave in the frame the
    // boots land.
    set(this.wLow.g.gain, (0.030 + alt * 0.045 + move * 0.022 + fall * 0.075) * quiet, fall > 0.05 ? 0.16 : 0.55);
    set(this.wMid.g.gain, (0.075 + alt * 0.20 + move * 0.26 + fall * 0.30) * quiet, fall > 0.05 ? 0.12 : 0.40);
    set(this.wMid.f.frequency, 620 + alt * 620 + move * 520 - fall * 240, 0.5);

    // Gusts are a random walk, not an LFO: real wind is not periodic, and a
    // sine on the gust bus is the single most recognisable tell of fake wind.
    this.gustPhase -= dt;
    if (this.gustPhase <= 0) {
      this.gustPhase = rnd(1.1, 3.8);
      this.gustTarget = Math.random() ** 2;
      set(this.wGust.f.frequency, rnd(700, 2100), 0.9);
      if (this.wGust.p.pan) set(this.wGust.p.pan, rnd(-0.75, 0.75), 1.2);
    }
    set(this.wGust.g.gain, this.gustTarget * (0.055 + alt * 0.13 + move * 0.12) * quiet + fall * 0.06 * quiet, fall > 0.05 ? 0.2 : 0.8);

    // The wing's edge tone. Its pitch tracks airspeed, so a dive audibly
    // sharpens and a flare audibly drops.
    set(this.wEdge.g.gain, clamp(s.glide - 0.10, 0, 1) * 0.22 * quiet, 0.22);
    set(this.wEdge.f.frequency, 1250 + s.glide * 1800, 0.25);

    set(this.windAir.gain, 0.22 + alt * 0.35, 0.6);
    set(this.windHall.gain, 0.10 + alt * 0.30, 0.6);

    // --- beds -----------------------------------------------------------
    // Detail belongs to the ground. Climb and it thins; open the wing and it
    // is gone, replaced by the sound of nothing being nearby.
    const ground = (1 - clamp(alt * 1.35, 0, 1)) * quiet;
    const w = s.weights;
    for (let i = 0; i < ZONES.length; i++) {
      const b = this.beds[ZONES[i]];
      set(b.lvl.gain, b.base * (w ? w[i] : (i === 0 ? 1 : 0)) * ground, 0.55);
    }
    set(this.waterG.gain, clamp(s.water, 0, 1) * 0.09 * ground, 0.6);

    // --- events ----------------------------------------------------------
    if (ground > 0.25 && quiet > 0.5) this._events(dt, w, ground);
  }

  /**
   * Sparse, per-region incident. Everything here is scheduled against a
   * probability per second so that nothing is ever on a grid — a bird that
   * calls every four seconds exactly is a metronome with feathers.
   */
  _events(dt, w, ground) {
    const A = this.A, ctx = A.ctx;
    const t = ctx.currentTime;
    const chance = (p) => Math.random() < p * dt;

    // Vale: a two- or three-note call, up an interval and back down.
    if (w && w[1] > 0.28 && chance(w[1] * 0.55)) this._bird(t + rnd(0, 0.2), ground * w[1]);

    // Steppe: dry stridulation, a burst of amplitude-modulated high band.
    if (w && w[2] > 0.3 && chance(w[2] * 0.5)) {
      const pan = rnd(-0.8, 0.8);
      const n = 3 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) {
        grain(A, t + i * rnd(0.055, 0.085), {
          colour: 'white', type: 'bandpass', freq: rnd(5200, 7200), Q: 14,
          level: 0.020 * ground * w[2], decay: 0.04, pan, air: 0.35, bus: A.amb,
        });
      }
    }

    // Wastes: a stone gives up somewhere out of sight.
    if (w && w[3] > 0.3 && chance(w[3] * 0.26)) {
      const pan = rnd(-0.9, 0.9);
      grain(A, t, {
        colour: 'white', type: 'bandpass', freq: rnd(900, 2400), Q: 6,
        level: 0.05 * ground * w[3], decay: 0.07, pan, air: 0.75, bus: A.amb,
      });
      if (Math.random() < 0.4) {
        grain(A, t + rnd(0.08, 0.2), {
          colour: 'white', type: 'bandpass', freq: rnd(700, 1600), Q: 7,
          level: 0.03 * ground * w[3], decay: 0.06, pan, air: 0.8, bus: A.amb,
        });
      }
    }

    // Fen: water finds somewhere lower. A drip is a *rising* pitch — the
    // cavity it lands in shortens as it fills.
    if (w && w[4] > 0.26 && chance(w[4] * 0.7)) {
      ping(A, rnd(520, 900), t, {
        type: 'sine', to: rnd(1500, 2600), decay: 0.085,
        level: 0.055 * ground * w[4], pan: rnd(-0.85, 0.85),
        air: 0.9, bus: A.amb,
      });
    }

    // Spine: something enormous shifts, far away and below.
    if (w && w[0] > 0.35 && chance(w[0] * 0.06)) {
      const g = gain(ctx, 0);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = rnd(48, 74);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * rnd(0.55, 0.8), t + 2.4);
      const lp = filter(ctx, 'lowpass', 220, 1.2);
      o.connect(lp); lp.connect(g); g.connect(A.amb);
      A.send(g, 'hall', 0.8);
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.055 * ground, t + 0.9);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 2.8);
      o.start(t); o.stop(t + 3.0);
      o.onended = () => { try { g.disconnect(); lp.disconnect(); } catch { /* gone */ } };
    }
  }

  _bird(t0, amp) {
    const A = this.A, ctx = A.ctx;
    const pan = rnd(-0.9, 0.9);
    const base = rnd(2100, 3900);
    const notes = 2 + ((Math.random() * 3) | 0);
    const up = Math.random() < 0.6;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      o.type = Math.random() < 0.5 ? 'triangle' : 'sine';
      const t = t0 + i * rnd(0.09, 0.16);
      const f = base * Math.pow(up ? 1.16 : 0.9, i);
      const dur = rnd(0.055, 0.11);
      o.frequency.setValueAtTime(f * rnd(0.86, 0.95), t);
      o.frequency.exponentialRampToValueAtTime(f * rnd(1.05, 1.3), t + dur * 0.45);
      o.frequency.exponentialRampToValueAtTime(f * rnd(0.85, 1.0), t + dur);
      const g = gain(ctx, 0);
      const p = panner(ctx, pan);
      o.connect(g); g.connect(p); p.connect(A.amb);
      const send = A.send(p, 'air', 0.85);
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.055 * amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      o.start(t); o.stop(t + dur + 0.03);
      o.onended = () => {
        for (const n of [g, p, send]) { try { n && n.disconnect(); } catch { /* gone */ } }
      };
    }
  }
}

export { ZONES };
