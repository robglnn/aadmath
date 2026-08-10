/**
 * The moments.
 *
 * Two of these matter more than everything else in this directory put
 * together, and they are the two the game is actually about.
 *
 * THE SEAL. A statement becomes true. The design constraint is that it must be
 * satisfying on the four hundredth time as well as the first, which rules out
 * anything with a novelty in it. So it is built the way an orchestra builds a
 * cadence: an inhale (rising filtered air, 200 ms), a *landing* on the down-
 * beat with weight under it, a harp roll upward through the tonic so the ear
 * gets to travel, and a tail of high bells in a long reverb that lets the room
 * finish the sentence. It resolves onto the region's own tonic, in the key the
 * score is already in, so it is not a sound effect over music — it is the
 * music arriving.
 *
 * THE SLIP. A learner got it wrong. Almost every game reaches for a buzzer
 * here, and a buzzer teaches a fifteen-year-old that being wrong is a public
 * humiliation, which is precisely the belief that stops people learning
 * algebra. So: no dissonance, no descending minor third, nothing that sounds
 * like a game show. A soft low knock, a warm two-note figure that *does not
 * resolve downward*, and the rift's own hum tightening for a third of a
 * second. It reads as "not yet", holds attention, and costs nothing.
 */

import { sealChord, PLACES } from './theory.js';
import { pad, sub, bell, pluck, shimmer, thump, grain, ping } from './voices.js';
import { mtof, rnd, clamp } from './dsp.js';

export class Stings {
  constructor(A) {
    this.A = A;
  }

  /**
   * @param {object} o
   *   place    region id — the seal lands in the key of where you are standing
   *   mastery  0..1 — a half-built lattice gets a half-resolved cadence
   *   big      true when this answer mastered the skill outright
   */
  seal(o = {}) {
    const A = this.A;
    if (!A.live) return;
    const place = PLACES[o.place] ? o.place : 'home';
    const mastery = clamp(o.mastery ?? 0.5, 0, 1);
    const big = !!o.big;
    const C = sealChord(place, mastery, big);
    const t = A.t;
    const LAND = t + 0.20;      // the downbeat everything is aimed at

    A.duck(big ? 0.68 : 0.52, 0.70, 1.6, big ? 0.48 : 0.32);

    // --- inhale --------------------------------------------------------
    // Rising air into the landing. It is short, it is quiet, and removing it
    // makes the chord sound like it starts rather than arrives.
    shimmer(A, t, {
      freq: 700, Q: 1.2, level: big ? 0.075 : 0.055,
      rise: 0.19, hold: 0.02, fall: 0.5, sweep: 4.2, air: 0.9, bus: A.sfx,
    });
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 300, Q: 0.8, sweep: 7,
      attack: 0.18, decay: 0.22, level: 0.05, air: 0.6, bus: A.sfx,
    });

    // --- landing -------------------------------------------------------
    thump(A, LAND, {
      freq: big ? 120 : 96, to: big ? 38 : 44,
      decay: big ? 0.42 : 0.26, drop: 0.13,
      level: big ? 0.34 : 0.22, bus: A.sfx,
    });
    sub(A, C.notes[0] - 12, LAND, big ? 4.2 : 3.0, big ? 0.20 : 0.15,
      { bus: A.sfx, attack: 0.05, release: big ? 2.4 : 1.6 });

    // The chord itself, held. Fast attack — this is a landing, not a swell —
    // and a release long enough that the shards still have something to fall
    // through when the rift's outline finishes closing.
    C.notes.slice(0, big ? 6 : 4).forEach((n, i) => {
      pad(A, n, LAND + i * 0.012, big ? 3.6 : 2.6, {
        level: (big ? 0.125 : 0.105) * (i === 0 ? 1.2 : 1),
        bright: 1.5, air: 1, attack: 0.045, release: big ? 2.2 : 1.5,
        pan: (i / 5 - 0.5) * 1.3, bus: A.sfx,
      });
    });

    // --- the roll ------------------------------------------------------
    // Upward, accelerating slightly, so the gesture has a direction. This is
    // the part a player will hum back at you.
    C.notes.forEach((n, i) => {
      pluck(A, n, LAND + i * (0.052 - i * 0.003), {
        level: 0.26 - i * 0.014, air: 0.8, damp: 0.26,
        pan: (i / Math.max(1, C.notes.length - 1) - 0.5) * 1.4, bus: A.sfx,
      });
    });

    // Top bell — the one that rings after everything else has stopped.
    bell(A, C.notes[C.notes.length - 1] + (big ? 12 : 0), LAND + 0.02, {
      level: big ? 0.19 : 0.14, decay: big ? 5.6 : 3.8,
      index: 2.0, ratio: 3.51, air: 1, pan: 0.12, bus: A.sfx,
    });

    // A partial cadence, honestly voiced: the suspended fourth steps down onto
    // the third three-quarters of a second later. Only below half integrity —
    // the sound of "true, and there is more of this to get right".
    if (C.resolveTo) {
      C.resolveTo.forEach((n, i) => {
        pluck(A, n, LAND + 0.62 + i * 0.05, { level: 0.13, air: 0.85, damp: 0.34, bus: A.sfx });
      });
    }

    // --- tail ----------------------------------------------------------
    const sparkles = big ? 7 : 4;
    for (let i = 0; i < sparkles; i++) {
      const n = C.notes[(Math.random() * C.notes.length) | 0] + (Math.random() < 0.5 ? 12 : 19);
      bell(A, n, LAND + 0.45 + i * rnd(0.14, 0.34), {
        level: 0.035 * rnd(0.6, 1), decay: rnd(2.2, 4.2), index: 1.8,
        air: 1, pan: rnd(-1, 1), bus: A.sfx,
      });
    }

    // --- mastery -------------------------------------------------------
    // A whole skill closing gets the one thing nothing else in the game gets:
    // a lift, a fifth above, nine hundred milliseconds later.
    if (big) {
      const r = C.notes[1];
      [0, 7, 12, 16, 19].forEach((iv, i) => {
        bell(A, r + iv + 7, LAND + 0.92 + i * 0.075, {
          level: 0.085 - i * 0.008, decay: 4.4, index: 2.2, air: 1,
          pan: (i / 4 - 0.5) * 1.2, bus: A.sfx,
        });
      });
      shimmer(A, LAND + 0.85, {
        freq: 1600, Q: 1.4, level: 0.07, rise: 0.9, hold: 0.4, fall: 3.2,
        sweep: 2.6, air: 1, bus: A.sfx,
      });
    }
  }

  /**
   * Wrong, and told so kindly. Quiet, warm, over in half a second, and
   * deliberately *not* a falling interval.
   *
   * `n` is how many the learner has missed in a row, and it makes the response
   * *quieter and gentler*, not louder. This is the opposite of what almost
   * every game does, and it is the entire point: a learner who is stuck is
   * already receiving the information that they are stuck. Repeating it at them
   * with rising emphasis is the mechanism by which a person decides they are
   * not a maths person. By the third one the knock has gone entirely and what
   * is left is a single warm tone that does not resolve — an ellipsis.
   */
  slip(n = 1) {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    const soft = clamp(1 - (n - 1) * 0.34, 0.3, 1);
    A.duck(0.16 * soft, 0.1, 0.6);

    // the knock: wood, not metal, and no higher than a knuckle on a desk
    if (n < 3) {
      thump(A, t, {
        freq: 168, to: 96, decay: 0.11, drop: 0.05, level: 0.10 * soft, bus: A.sfx,
      });
      grain(A, t, {
        colour: 'pink', type: 'lowpass', freq: 900, Q: 0.6,
        decay: 0.055, level: 0.045 * soft, air: 0.25, bus: A.sfx,
      });
    }

    // Two soft tones a whole step apart, *rising* then settling back onto the
    // first — the shape of a question, not a verdict.
    ping(A, mtof(62), t + 0.03, {
      type: 'sine', decay: 0.34 + n * 0.12, level: 0.055 * soft, air: 0.5, bus: A.sfx,
    });
    ping(A, mtof(64), t + 0.14, {
      type: 'sine', decay: 0.46 + n * 0.14, level: 0.042 * soft, air: 0.6, bus: A.sfx,
    });
    ping(A, mtof(62), t + 0.30, {
      type: 'sine', decay: 0.7 + n * 0.2, level: 0.030 * soft, air: 0.7, bus: A.sfx,
    });
  }

  /**
   * Close enough to touch a tear you are allowed to touch.
   *
   * The rift hum has been telling you where it is for the last ninety metres;
   * this says only that you have arrived. Two notes, up a fourth, very quiet,
   * in the key the hum is already sitting in — an invitation, not a
   * notification. If it is ever loud enough to be annoying on the fortieth
   * approach it is wrong.
   */
  inRange() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    ping(A, mtof(74), t, { type: 'sine', decay: 0.30, level: 0.028, air: 0.65, bus: A.sfx });
    ping(A, mtof(79), t + 0.085, { type: 'sine', decay: 0.55, level: 0.022, air: 0.8, bus: A.sfx });
  }

  /** The tear opens: pressure drops, the world moves off. */
  riftOpen() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    A.duck(0.22, 0.5, 1.6, 0.35);
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 2600, Q: 1.1, sweep: 0.12,
      attack: 0.012, decay: 0.75, level: 0.09, air: 0.7, bus: A.sfx,
    });
    thump(A, t + 0.02, { freq: 190, to: 34, decay: 0.5, drop: 0.3, level: 0.13, bus: A.sfx });
    ping(A, mtof(74), t + 0.02, { type: 'sine', to: mtof(69), decay: 0.4, level: 0.05, air: 0.6, bus: A.sfx });
  }

  /** And shuts. */
  riftClose() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 500, Q: 1.0, sweep: 3.4,
      attack: 0.10, decay: 0.16, level: 0.055, air: 0.5, bus: A.sfx,
    });
    ping(A, mtof(69), t + 0.10, { type: 'sine', decay: 0.5, level: 0.04, air: 0.7, bus: A.sfx });
  }

  // ------------------------------------------------------------ world verbs
  /** A piece of lattice set: it rings, because it is not made of the island. */
  place(kind = 0) {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    const base = [880, 740, 988, 660][kind % 4];
    thump(A, t, { freq: 150, to: 68, decay: 0.11, level: 0.13, bus: A.sfx });
    ping(A, base, t + 0.004, { type: 'triangle', decay: 0.30, level: 0.075, air: 0.5, bus: A.sfx });
    ping(A, base * 2.51, t + 0.008, { type: 'sine', decay: 0.62, level: 0.035, air: 0.8, bus: A.sfx });
    grain(A, t, {
      colour: 'white', type: 'bandpass', freq: 3600, Q: 2.5,
      decay: 0.035, level: 0.05, air: 0.4, bus: A.sfx,
    });
  }

  /** And taken away again. */
  unplace() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    grain(A, t, {
      colour: 'white', type: 'bandpass', freq: 2400, Q: 2, sweep: 0.25,
      decay: 0.16, level: 0.05, air: 0.4, bus: A.sfx,
    });
    ping(A, 500, t, { type: 'triangle', to: 260, decay: 0.16, level: 0.045, bus: A.sfx });
  }

  /** An anchor takes hold — a small, real achievement, and it sounds like one. */
  anchor() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    A.duck(0.3, 0.3, 1.0);
    thump(A, t, { freq: 110, to: 42, decay: 0.34, drop: 0.14, level: 0.24, bus: A.sfx });
    [0, 7, 12, 19].forEach((iv, i) => {
      bell(A, 62 + iv, t + 0.05 + i * 0.09, {
        level: 0.11 - i * 0.012, decay: 3.6, index: 2.2, air: 0.9,
        pan: (i / 3 - 0.5) * 1.1, bus: A.sfx,
      });
    });
  }

  /** Nowhere to stand. Low, dull, and over immediately. */
  deny() {
    const A = this.A;
    if (!A.live) return;
    thump(A, A.t, { freq: 120, to: 74, decay: 0.10, drop: 0.04, level: 0.09, bus: A.sfx });
  }

  // ------------------------------------------------------------ interface
  tick() {
    const A = this.A;
    if (!A.live) return;
    ping(A, rnd(2100, 2600), A.t, { type: 'triangle', decay: 0.018, level: 0.028, air: 0.1 });
  }

  hover() {
    const A = this.A;
    if (!A.live) return;
    ping(A, 3200, A.t, { type: 'sine', decay: 0.03, level: 0.014, air: 0.1 });
  }

  /** Committing an answer. Two notes up: the sound of handing something over. */
  commit() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    ping(A, mtof(69), t, { type: 'triangle', decay: 0.06, level: 0.05, air: 0.3 });
    ping(A, mtof(76), t + 0.055, { type: 'triangle', decay: 0.10, level: 0.045, air: 0.4 });
  }

  /** A new line of the lattice opens. Wide, and further away than it is. */
  unlocked() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    [0, 5, 7, 12, 17].forEach((iv, i) => {
      bell(A, 57 + iv, t + i * 0.11, {
        level: 0.07, decay: 4.2, index: 1.9, air: 1, pan: (i / 4 - 0.5) * 1.4, bus: A.sfx,
      });
    });
  }

  /**
   * Marlow opens a channel. Two clipped tones and a breath of carrier noise —
   * the grammar every cockpit radio in every film has used since 1965 — with a
   * small dip in the score underneath so the line has somewhere to sit.
   */
  commsBlip() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    A.duck(0.22, 0.9, 1.4);
    ping(A, 1480, t, { type: 'square', decay: 0.035, level: 0.022, air: 0.15 });
    ping(A, 1980, t + 0.048, { type: 'square', decay: 0.05, level: 0.020, air: 0.2 });
    grain(A, t + 0.02, {
      colour: 'white', type: 'bandpass', freq: 2400, Q: 1.4,
      decay: 0.10, level: 0.012, air: 0.2, bus: A.ui,
    });
  }

  /** The first thing the player hears, the instant sound is allowed to exist. */
  wake() {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    [50, 57, 62, 69].forEach((n, i) => {
      bell(A, n, t + 0.02 + i * 0.10, {
        level: 0.075 - i * 0.008, decay: 3.6, index: 2.0, air: 0.9,
        pan: (i / 3 - 0.5) * 1.1, bus: A.sfx,
      });
    });
    shimmer(A, t, {
      freq: 900, Q: 1.3, level: 0.045, rise: 1.1, hold: 0.3, fall: 2.6,
      sweep: 2.4, air: 1, bus: A.sfx,
    });
  }
}
