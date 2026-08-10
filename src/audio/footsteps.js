/**
 * Boots.
 *
 * A footstep is not one sound, it is three events inside 120 ms: the *body*
 * (a low sweep — mass arriving), the *contact* (a short filtered transient —
 * the boot meeting the material) and the *scatter* (a longer, quieter tail of
 * whatever the material does afterwards: grass springs, snow packs, scree
 * rolls, water displaces). Every surface in this game is those three with
 * different numbers, which is why none of them needed a sample.
 *
 * Six surfaces, and the rule for picking one is the same rule the terrain
 * shader uses, so what you hear and what you see can never disagree:
 *
 *   lattice  a piece you built. Rings. It is not made of the island.
 *   stone    plaza, dais, worn track, or ground too steep to hold soil.
 *   snow     above the snow line in the spine.
 *   scree    alpine, below the snow.
 *   dust     the wastes and the dry steppe.
 *   grass    the vale, and anywhere green.
 *   water    the lake shallows and the fen.
 */

import { grain, thump, ping } from './voices.js';
import { rnd, clamp } from './dsp.js';

const SURFACES = {
  grass: {
    body: { freq: 88, to: 46, decay: 0.11, level: 0.10 },
    contact: { freq: 1750, Q: 0.7, decay: 0.055, level: 0.085, colour: 'pink', sweep: 0.55 },
    tail: { freq: 4200, Q: 0.5, decay: 0.14, level: 0.030, colour: 'white', sweep: 0.5 },
    air: 0.20,
  },
  scree: {
    body: { freq: 105, to: 52, decay: 0.09, level: 0.10 },
    contact: { freq: 2400, Q: 1.6, decay: 0.035, level: 0.115, colour: 'white', sweep: 0.6 },
    tail: { freq: 1500, Q: 1.0, decay: 0.20, level: 0.045, colour: 'white', sweep: 0.55 },
    grit: 4,
    air: 0.34,
  },
  snow: {
    body: { freq: 76, to: 40, decay: 0.13, level: 0.075 },
    contact: { freq: 780, Q: 1.4, decay: 0.075, level: 0.10, colour: 'pink', sweep: 0.5 },
    tail: { freq: 2600, Q: 0.7, decay: 0.10, level: 0.028, colour: 'white', sweep: 0.45 },
    grit: 3,
    air: 0.10,
  },
  dust: {
    body: { freq: 92, to: 44, decay: 0.12, level: 0.10 },
    contact: { freq: 1150, Q: 0.6, decay: 0.085, level: 0.085, colour: 'pink', sweep: 0.45 },
    tail: { freq: 2200, Q: 0.5, decay: 0.19, level: 0.034, colour: 'pink', sweep: 0.4 },
    air: 0.30,
  },
  stone: {
    body: { freq: 130, to: 62, decay: 0.055, level: 0.085 },
    contact: { freq: 3100, Q: 2.4, decay: 0.022, level: 0.13, colour: 'white', sweep: 0.7 },
    ring: 420,
    air: 0.46,
  },
  water: {
    body: { freq: 70, to: 38, decay: 0.10, level: 0.065 },
    contact: { freq: 560, Q: 0.9, decay: 0.10, level: 0.10, colour: 'pink', sweep: 1.9 },
    tail: { freq: 3400, Q: 0.6, decay: 0.16, level: 0.030, colour: 'white', sweep: 0.6 },
    drip: true,
    air: 0.38,
  },
  lattice: {
    body: { freq: 150, to: 74, decay: 0.05, level: 0.075 },
    contact: { freq: 4200, Q: 3.0, decay: 0.02, level: 0.10, colour: 'white', sweep: 0.8 },
    ring: 880,
    crystal: true,
    air: 0.55,
  },
};

export class Footsteps {
  constructor(A) {
    this.A = A;
    this.last = 0;
  }

  /**
   * @param {string} surface  key of SURFACES
   * @param {number} power    0..1, how hard the boot landed
   * @param {number} pan      -1..1, which foot
   * @param {number} muffle   0..1, how much the world is dulled
   */
  step(surface, power = 0.5, pan = 0, muffle = 0) {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    // Two boots inside 40 ms is a bug in someone's animation, not a stride.
    if (t - this.last < 0.045) return;
    this.last = t;

    const S = SURFACES[surface] || SURFACES.grass;
    // Boots were sitting twenty-five decibels under the score. A footstep you
    // cannot hear is not restraint, it is an absence.
    const v = clamp(0.32 + power * 0.85, 0, 1.35) * (1 - muffle * 0.7) * 2.3;
    const j = rnd(0.9, 1.12);   // no two steps identical, ever
    const air = S.air * (1 - muffle * 0.5);

    // The body is the smallest part of a footstep and the easiest to overdo.
    // Weighted equally with the contact it turns every stride into a kick
    // drum, which is what a boot sounds like through a wall and nothing like
    // what it sounds like when it is your boot.
    thump(A, t, {
      freq: S.body.freq * j, to: S.body.to * j, decay: S.body.decay * j,
      level: S.body.level * v * 0.55, pan: pan * 0.4, bus: A.sfx,
    });

    grain(A, t + rnd(0, 0.006), {
      colour: S.contact.colour, freq: S.contact.freq * j, Q: S.contact.Q,
      decay: S.contact.decay * j, level: S.contact.level * v * 1.55,
      sweep: S.contact.sweep, pan, air, bus: A.sfx,
    });

    if (S.tail) {
      grain(A, t + 0.012 + rnd(0, 0.01), {
        colour: S.tail.colour, freq: S.tail.freq * j, Q: S.tail.Q,
        decay: S.tail.decay * j, level: S.tail.level * v * 1.9 * (0.5 + power * 0.7),
        sweep: S.tail.sweep, pan: pan * 0.8, air, bus: A.sfx,
      });
    }

    // Loose material does not make one sound, it makes a handful of very short
    // ones spread over the next 80 ms. That scatter is the whole difference
    // between snow and carpet.
    if (S.grit) {
      const n = 2 + ((Math.random() * S.grit) | 0);
      for (let i = 0; i < n; i++) {
        grain(A, t + rnd(0.015, 0.09), {
          colour: 'white', freq: rnd(1800, 5200), Q: 8,
          decay: rnd(0.012, 0.03), level: 0.048 * v * rnd(0.5, 1),
          pan: pan + rnd(-0.25, 0.25), air, bus: A.sfx,
        });
      }
    }

    // Hard surfaces have a pitch. It is faint and it is what tells you the
    // plaza is stone before you look down.
    if (S.ring) {
      ping(A, S.ring * rnd(0.94, 1.09), t + 0.004, {
        type: 'triangle', decay: S.crystal ? 0.34 : 0.10,
        level: (S.crystal ? 0.045 : 0.028) * v, pan, air: air + 0.2, bus: A.sfx,
      });
      if (S.crystal) {
        ping(A, S.ring * 2.51 * rnd(0.97, 1.03), t + 0.006, {
          type: 'sine', decay: 0.5, level: 0.022 * v, pan: -pan, air: 0.7, bus: A.sfx,
        });
      }
    }

    if (S.drip && Math.random() < 0.5) {
      ping(A, rnd(600, 1100), t + rnd(0.06, 0.16), {
        type: 'sine', to: rnd(1700, 2700), decay: 0.07,
        level: 0.035 * v, pan: pan + rnd(-0.2, 0.2), air: 0.6, bus: A.sfx,
      });
    }
  }

  /** A landing: the same materials, hit much harder, plus the knees. */
  land(surface, power, muffle = 0) {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    this.last = t;
    const S = SURFACES[surface] || SURFACES.grass;
    const v = (0.6 + power * 1.5) * 1.8;

    thump(A, t, {
      freq: S.body.freq * 1.25, to: S.body.to * 0.8, decay: 0.16 + power * 0.16,
      level: Math.min(0.34, S.body.level * v * 1.3) * (1 - muffle * 0.6), bus: A.sfx,
    });
    grain(A, t, {
      colour: S.contact.colour, freq: S.contact.freq * 0.85, Q: S.contact.Q * 0.8,
      decay: S.contact.decay * 2.4, level: Math.min(0.34, S.contact.level * v * 2.1),
      sweep: 0.45, air: S.air + 0.2, bus: A.sfx,
    });
    // The scatter of a real landing throws material outward for a third of a
    // second. Count scales with the drop, so a hop and a cliff are different
    // events rather than the same event at two volumes.
    const n = 3 + ((power * 9) | 0);
    for (let i = 0; i < n; i++) {
      grain(A, t + rnd(0.01, 0.16 + power * 0.2), {
        colour: 'white', freq: rnd(900, 4800), Q: 5,
        decay: rnd(0.02, 0.07), level: 0.035 * v * rnd(0.4, 1),
        pan: rnd(-0.8, 0.8), air: S.air + 0.25, bus: A.sfx,
      });
    }
    if (power > 0.45) A.duck(0.16 * power, 0.06, 0.5);
  }

  // ------------------------------------------------------------- the body
  /**
   * A jump is not a sound the ground makes, it is a sound a *person* makes:
   * cloth, a push-off against the material, and a breath. Kept quiet enough
   * that a hundred of them in a minute does not become the mix.
   */
  jump(surface, power = 0.6) {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    const S = SURFACES[surface] || SURFACES.grass;
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: S.contact.freq * 0.8, Q: 0.9,
      decay: 0.07, level: 0.06 * power, sweep: 0.5, air: S.air, bus: A.sfx,
    });
    // fabric
    grain(A, t + 0.01, {
      colour: 'white', type: 'bandpass', freq: 2600, Q: 1.2,
      decay: 0.09, level: 0.030 * power, sweep: 0.4, air: 0.2, bus: A.sfx,
    });
    thump(A, t, { freq: 92, to: 56, decay: 0.07, level: 0.055 * power, bus: A.sfx });
  }

  /** The second jump has no ground under it, so it is all air and lattice. */
  airJump() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 420, Q: 1.1, sweep: 5.5,
      attack: 0.006, decay: 0.30, level: 0.075, air: 0.5, bus: A.sfx,
    });
    ping(A, 620, t, { type: 'triangle', to: 1240, decay: 0.16, level: 0.05, air: 0.5, bus: A.sfx });
    ping(A, 1860, t + 0.02, { type: 'sine', decay: 0.42, level: 0.026, air: 0.8, bus: A.sfx });
  }

  /** A dash: a hard, short whoosh that starts bright and closes. */
  dash() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 3200, Q: 1.4, sweep: 0.12,
      attack: 0.004, decay: 0.26, level: 0.12, air: 0.4, bus: A.sfx,
    });
    thump(A, t, { freq: 140, to: 48, decay: 0.16, drop: 0.09, level: 0.10, bus: A.sfx });
  }

  /**
   * The canopy cracking open. This is the single most physical sound in the
   * movement set and it has to be: a sharp fabric snap, then the pressure of
   * air arriving under a wing that was not there a moment ago.
   */
  wingOpen() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    grain(A, t, {
      colour: 'white', type: 'bandpass', freq: 1800, Q: 0.8,
      attack: 0.002, decay: 0.055, level: 0.16, sweep: 0.35, air: 0.35, bus: A.sfx,
    });
    grain(A, t + 0.03, {
      colour: 'pink', type: 'lowpass', freq: 700, Q: 0.7,
      attack: 0.05, decay: 0.55, level: 0.085, sweep: 1.8, air: 0.6, bus: A.sfx,
    });
    thump(A, t + 0.01, { freq: 170, to: 46, decay: 0.30, drop: 0.16, level: 0.14, bus: A.sfx });
    A.duck(0.18, 0.15, 0.9);
  }

  /** And folding away. */
  wingClose() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    grain(A, t, {
      colour: 'white', type: 'bandpass', freq: 1200, Q: 1.1,
      decay: 0.16, level: 0.06, sweep: 0.35, air: 0.3, bus: A.sfx,
    });
  }

  /** Hands and boots on a ledge. */
  mantle(surface) {
    const A = this.A;
    if (!A.live) return;
    const S = SURFACES[surface] || SURFACES.grass;
    const t = A.t;
    for (let i = 0; i < 3; i++) {
      grain(A, t + i * rnd(0.04, 0.09), {
        colour: 'white', type: 'bandpass', freq: S.contact.freq * rnd(0.7, 1.3), Q: 2.5,
        decay: rnd(0.05, 0.12), level: 0.05, sweep: 0.5, air: S.air, bus: A.sfx,
      });
    }
  }

  /** Boots plant and plough. One burst; the tail is `slide`. */
  skid(surface, power = 1) {
    const A = this.A;
    if (!A.live) return;
    const S = SURFACES[surface] || SURFACES.grass;
    grain(A, A.t, {
      colour: 'white', type: 'bandpass', freq: S.contact.freq * 0.9, Q: 1.2,
      attack: 0.01, decay: 0.24, level: 0.09 * clamp(power, 0, 1.4),
      sweep: 0.4, air: S.air + 0.1, bus: A.sfx,
    });
  }

  /** Shoulder into rock. */
  bump() {
    const A = this.A;
    if (!A.live) return;
    thump(A, A.t, { freq: 130, to: 60, decay: 0.14, level: 0.11, bus: A.sfx });
    grain(A, A.t, {
      colour: 'white', type: 'lowpass', freq: 900, Q: 0.7,
      decay: 0.06, level: 0.05, air: 0.3, bus: A.sfx,
    });
  }

  /** The legs commit. A breath, not a sound effect. */
  effort() {
    const A = this.A;
    if (!A.live) return;
    grain(A, A.t, {
      colour: 'pink', type: 'bandpass', freq: 900, Q: 0.9,
      attack: 0.02, decay: 0.24, level: 0.045, sweep: 1.9, air: 0.25, bus: A.sfx,
    });
  }

  /**
   * A breath, under a sustained run.
   *
   * Two grains: an inhale, which is narrow and rises, and an exhale a beat
   * later, which is wider and falls. Both are far too quiet to be *heard* as a
   * sound effect — the point is that they are heard as a person. The alternation
   * matters: two identical breaths in a row is a loop, and the ear finds loops
   * in about four seconds.
   */
  breath(effortN = 0.5) {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    this._out = !this._out;
    const v = 0.026 + effortN * 0.026;
    if (this._out) {
      grain(A, t, {
        colour: 'pink', type: 'bandpass', freq: rnd(560, 700), Q: 1.5,
        attack: 0.09, decay: 0.22, level: v, sweep: 1.7, air: 0.18, bus: A.sfx,
      });
    } else {
      grain(A, t, {
        colour: 'pink', type: 'bandpass', freq: rnd(760, 940), Q: 0.9,
        attack: 0.03, decay: 0.30, level: v * 1.15, sweep: 0.52, air: 0.22, bus: A.sfx,
      });
    }
  }

  /** Sliding, skidding, ploughing: a continuous version of the contact band. */
  slide(surface, amount, dt) {
    const A = this.A;
    if (!A.live || amount <= 0.02) return;
    const S = SURFACES[surface] || SURFACES.grass;
    // Rate-limited grains rather than a held noise loop: a skid is granular,
    // and a filtered loop sounds like a hairdryer.
    if (Math.random() > dt * 34 * amount) return;
    grain(A, A.t, {
      colour: 'white', freq: rnd(S.contact.freq * 0.6, S.contact.freq * 1.5),
      Q: 3.5, decay: rnd(0.03, 0.09), level: 0.035 * amount * rnd(0.5, 1),
      pan: rnd(-0.4, 0.4), air: S.air, bus: A.sfx,
    });
  }
}

export { SURFACES };
