/**
 * The score.
 *
 * There is no loop and no track list. A scheduler walks a phrase of four
 * chords at 56 bpm and, for each one, asks two questions — *where is the cadet
 * standing* and *how much of the lattice is true* — then voices that chord
 * accordingly. Because the harmony is derived rather than recorded, the music
 * can change key when you cross a border and change cadence when you master a
 * skill, and neither transition ever needs a crossfade between two mp3s.
 *
 * Layers, from the floor up:
 *
 *   sub      the root, always. The thing you stop noticing and would miss.
 *   pad      the chord. Two detuned saws per note through a filter that opens
 *            as the note blooms.
 *   bells    an inharmonic FM bell and a Karplus–Strong harp, sharing a
 *            pentatonic that cannot produce a wrong note against the pad.
 *   shimmer  filtered air, keyed to altitude — it arrives when you leave the
 *            ground and it is most of why gliding feels like gliding.
 *   motif    six notes. The only fixed melodic material in the game, saved for
 *            phrase heads when something is actually happening.
 */

import { harmony, PHRASE, PLACES } from './theory.js';
import { pad, sub, bell, pluck, shimmer } from './voices.js';
import { clamp, rnd } from './dsp.js';

const BPM = 56;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const CHORD = BAR * 2;          // ~8.6 s — long enough to breathe in

/** ASCENT's theme, in scale degrees of the region's pentatonic. */
const MOTIF = [0, 3, 4, 6, 4, 3];
const MOTIF_T = [0, 1, 2, 3.5, 5, 6.5];

export class Score {
  constructor(A) {
    this.A = A;
    this.place = 'home';
    this._place = 'home';
    this.mastery = 0;
    this.travel = 0;      // 0 idle → 1 sprinting or gliding
    this.alt = 0;         // 0 on the ground → 1 very high
    this.focus = 0;       // 1 while a rift is open
    this.arrival = 0;     // counts down after entering a new region
    // A run of statements that held. It decays over about half a minute, and
    // while it lasts the score is denser, brighter and more willing to play
    // the theme — the difference between a learner who is working and a
    // learner who is *going*. Nobody will notice it arrive. They will notice
    // it leave.
    this.momentum = 0;
    this.index = 0;
    this.phrase = 0;
    this.rest = 2;        // chords of silence after each phrase
    this.play = 2;        // chords of music before it
    this.slot = 0;        // where we are inside phrase + rest
    this.nextT = 0;
    this.enabled = true;
  }

  /** Where the cadet is. Applied at the next chord so a border is not a lurch. */
  setPlace(id) { if (PLACES[id]) this.place = id; }

  setMastery(m) { this.mastery = clamp(m, 0, 1); }

  update(dt) {
    const A = this.A;
    if (!A.live || !this.enabled) return;
    this.momentum = Math.max(0, this.momentum - dt / 34);
    const now = A.t;
    if (!this.nextT) this.nextT = now + 0.4;
    // A backgrounded tab stops the frame loop but not the audio clock. Without
    // this the first frame after returning would schedule four minutes of
    // chords into the same instant.
    if (this.nextT < now - CHORD) this.nextT = now + 0.2;
    let guard = 0;
    while (this.nextT < now + 1.8 && guard++ < 4) {
      this._chord(this.nextT);
      this.nextT += CHORD;
    }
  }

  _chord(t0) {
    const A = this.A;
    // The region only changes on a chord boundary. Crossing an ecotone at a
    // run should sound like the music turning its head, not like a skip.
    const changed = this.place !== this._place;
    if (changed) { this._place = this.place; this.arrival = 2; this.index = 0; this.slot = 0; }

    // THE BREATH.
    //
    // The single biggest difference between a game score and a drone is that a
    // score stops. A phrase of four chords plays, and then — if the cadet is
    // just standing in a meadow — the pad lifts out entirely for two chord
    // lengths and you are left with the wind, a low root you can barely hear,
    // and the occasional note of harp. Seventeen seconds of near-silence is
    // what makes the next entry mean anything, and it is also the only way the
    // boots and the birds ever get to be the loudest thing on the island.
    //
    // Movement closes the gap. At a sprint or on the wing the rest goes to
    // nothing and the music is continuous, which is exactly the contract a
    // player already understands from every open-world game they have played.
    if (this.slot === 0) {
      const drive = Math.max(this.travel, this.arrival > 0 ? 0.8 : 0, this.alt * 0.7,
        this.momentum * 0.75);
      // Standing still: two chords on, two chords off — seventeen seconds of
      // music and seventeen of island. Moving: the phrase runs its full four
      // and the gap closes to nothing.
      this.play = this.focus > 0.5 ? PHRASE : (drive > 0.35 ? PHRASE : 2);
      this.rest = this.focus > 0.5 ? 0 : Math.max(0, Math.round(2.2 - drive * 2.4));
    }
    const resting = this.slot >= this.play;

    const H = harmony(this._place, this.mastery, this.index);
    const P = H.place;

    const focus = this.focus;
    const open = 1 - focus;                   // how much of the world is audible
    const air = P.air * (0.6 + this.alt * 0.6);
    const bright = P.bright * (0.72 + H.settle * 0.5 + this.alt * 0.25 + this.momentum * 0.22);

    // --- floor ---------------------------------------------------------
    // One octave under the chord, not two. Two put the root at 37 Hz, which is
    // below the range of every device this game will ever be played on.
    // The root fills its whole slot and releases over the next one, so there is
    // never a moment with no floor under the island.
    sub(A, H.root - 12 + (P.oct < 0 ? 12 : 0), t0, CHORD,
      (0.054 + this.mastery * 0.024) * (resting ? 0.72 : 1),
      { attack: resting ? 3.0 : 1.6, release: 3.4 });

    if (resting) {
      // Two or three notes of harp across seventeen seconds, high and wet, and
      // nothing else. This is the part of the score that sounds expensive.
      const scale0 = H.scale;
      const oct0 = P.oct > 0 ? 12 : 0;
      const n = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const deg = scale0[3 + ((Math.random() * (scale0.length - 3)) | 0)];
        pluck(A, deg + oct0 + 12, t0 + rnd(0.2, CHORD - 1.2), {
          level: 0.13 * P.bell, air: 0.9, damp: 0.24, pan: rnd(-0.9, 0.9),
        });
      }
      this._advance();
      return;
    }

    // --- chord ---------------------------------------------------------
    const level = (0.086 + H.settle * 0.018) * (0.78 + open * 0.22);
    const voices = H.notes.slice(0, focus > 0.5 ? 3 : Math.min(4, H.notes.length));
    voices.forEach((n, i) => {
      pad(A, n, t0 + i * 0.06, CHORD, {
        level: level * (i === 0 ? 1.15 : 1),
        bright,
        air,
        pan: (i / Math.max(1, voices.length - 1) - 0.5) * 1.25,
        // Voices enter at slightly different rates, which is what makes a
        // chord sound like players rather than like a key being pressed. The
        // release runs on into the next chord: the harmony changes underneath
        // a sound that never stopped.
        attack: 2.0 + i * 0.30,
        release: 4.2,
      });
    });

    if (focus > 0.6) { this._advance(); return; }   // inside a rift, that is all

    // --- bells ---------------------------------------------------------
    // Density is the honest signal here: an empty lattice is a sparse score.
    // Sparse is not the same as empty. Even a lattice with nothing true in it
    // has a harp in it; what integrity buys is how *often* it plays and how
    // resolved what it plays is.
    const density = clamp(0.34 + H.settle * 0.30 + this.travel * 0.26 + this.arrival * 0.20
      + this.momentum * 0.22, 0, 0.94) * open;
    const scale = H.scale;
    const octave = P.oct > 0 ? 12 : 0;
    for (let b = 0; b < 8; b++) {
      if (Math.random() > density * (b % 2 === 0 ? 1 : 0.55)) continue;
      const deg = scale[(Math.random() * scale.length) | 0];
      const t = t0 + b * BEAT + rnd(-0.02, 0.02);
      const hi = Math.random() < 0.34;
      if (hi) {
        bell(A, deg + 12 + octave, t, {
          level: 0.16 * P.bell * (0.6 + this.travel * 0.6),
          decay: 2.6 + Math.random() * 1.4,
          index: 3.0, ratio: 2.76, air: 0.6 * P.air + 0.2,
        });
      } else {
        pluck(A, deg + octave, t, {
          level: 0.30 * P.bell * (0.65 + this.travel * 0.5),
          air: 0.45 * P.air + 0.2,
          damp: H.minorish ? 0.5 : 0.38,
        });
      }
    }

    // --- theme ---------------------------------------------------------
    // Saved. It plays on the head of a phrase when the cadet has just arrived
    // somewhere or is moving with purpose, and never twice running.
    const wantMotif = (this.arrival > 0 || this.travel > 0.55 || this.mastery > 0.82
      || this.momentum > 0.45)
      && this.slot === 0 && this.phrase !== this._lastMotif;
    if (wantMotif) {
      this._lastMotif = this.phrase;
      MOTIF.forEach((d, i) => {
        const n = scale[clamp(d, 0, scale.length - 1)] + 12 + octave;
        bell(A, n, t0 + MOTIF_T[i] * BEAT * 0.75, {
          level: 0.175 * P.bell * (0.7 + this.mastery * 0.5),
          decay: 3.2, index: 2.0, ratio: 3.51,
          air: 0.55 * P.air + 0.3,
          pan: (i / MOTIF.length - 0.5) * 0.9,
        });
      });
    }

    // --- air -----------------------------------------------------------
    if (this.alt > 0.12 || this.travel > 0.4) {
      shimmer(A, t0 + rnd(0, BAR), {
        freq: 900 + this.alt * 2600,
        Q: 1.6,
        level: 0.055 * (0.4 + this.alt * 0.9 + this.travel * 0.3),
        rise: 2.2, hold: 0.6, fall: 3.4, sweep: 1.9,
        air: 0.9,
      });
    }

    this._advance();
  }

  _advance() {
    this.index++;
    this.slot++;
    if (this.slot >= (this.play || PHRASE) + this.rest) { this.slot = 0; this.phrase++; }
    if (this.arrival > 0) this.arrival--;
  }

  /**
   * A one-off lift: the four notes of the region's tonic, rolled upward. Used
   * when a skill is mastered, on top of the seal chord, so that the *music*
   * acknowledges it and not only the sound effect.
   */
  lift(big = false) {
    const A = this.A;
    if (!A.live) return;
    const H = harmony(this._place, Math.min(1, this.mastery + 0.15), 0);
    const t0 = A.t + 0.02;
    const oct = (PLACES[this._place] || PLACES.home).oct > 0 ? 12 : 0;
    H.scale.slice(0, big ? 7 : 5).forEach((n, i) => {
      bell(A, n + 12 + oct, t0 + i * 0.085, {
        level: 0.15, decay: 3.4, index: 2.4, air: 0.8,
        pan: (i / 6 - 0.5) * 1.2,
      });
    });
  }
}

export { CHORD, BEAT, BAR };
