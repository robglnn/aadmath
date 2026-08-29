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
 *   pedal    one tone, only while a proving run is open, climbing a degree per
 *            item the run banks. The one continuous thing in the score that
 *            means "you are being asked to hold something up".
 *
 * WHAT THE SCORE KNOWS ABOUT THE LEARNER, which is the half that was missing.
 *
 * It had one number — the mean posterior over the whole record — and that
 * number moves by a sixtieth when a line holds, against cadence banks a quarter
 * of the range wide. So the dial that was supposed to make the music follow
 * mastery could not be turned by an afternoon of genuine mastery. It now runs
 * on four inputs, and three of them move on the timescale a learner lives on:
 *
 *   mastery  the lattice. The arc of a course. Slow, and it still counts.
 *   line     the posterior on the skill this rift is asking about. Fast.
 *   run      how far a live proving run has filled. Fast, and it is the only
 *            one that is *about to be resolved*, so it carries the pedal.
 *   open     how much of the ground in front of the learner is unknown. This
 *            one runs the other way: it takes the third out of the chord,
 *            thins the bells, widens the rest, and lets the wind back in. A
 *            unit opening is supposed to sound like standing somewhere new,
 *            which is a quieter sound than the one you were making before.
 */

import { harmony, resolveOf, runPedal, PHRASE, PLACES } from './theory.js';
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
    // --- what the learner is doing, right now -----------------------------
    // `line` is the posterior on the skill in front of them; `open` is how much
    // of the ground is unknown; `run` is a live proving run's fill. All three
    // are set by the director from the mastery engine, all three are 0 for a
    // cadet who is simply out walking, and none of them is ever read as a
    // volume — they change what the harmony is, not how loud it is.
    this.line = 0;
    this.open = 0;
    this.run = 0;
    // THE SCORE STANDS DOWN. At 1 the phrase stops entirely and all that is
    // left is the root and the island. It is set while the break beat is on
    // screen (`src/session/rest.js`), because a rest whose whole premise is
    // looking at something a long way off is not improved by a chord
    // progression, and because the ONE thing a paced breath needs is room.
    this.hush = 0;
    this._pedalT = 0;
    this._pedalNote = null;
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

  /**
   * The fast half of the dial. Everything here is a fact the mastery engine
   * already holds; nothing is computed twice and nothing is remembered between
   * calls, so a learner who walks away from a rift stops sounding like one who
   * is standing at it inside a chord.
   */
  setLine({ line = 0, open = 0, run = 0 } = {}) {
    this.line = clamp(line, 0, 1);
    this.open = clamp(open, 0, 1);
    this.run = clamp(run, 0, 1);
  }

  /** The blended number the harmony is actually built from. */
  get resolve() { return resolveOf(this.mastery, this.line, this.run); }

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
      // Unknown ground gets a longer silence. Standing at the mouth of a unit
      // nobody has opened, the score plays two chords and then leaves for
      // twenty-six seconds — which is the difference between a game that is
      // telling you something is coming and a game that is waiting with you.
      this.rest = this.focus > 0.5 ? 0
        : Math.max(0, Math.round(2.2 - drive * 2.4 + this.open * 1.4));
    }
    const resting = this.slot >= this.play || this.hush > 0.5;

    // Unknown ground opens the voicing, and it opens the SILENCE too — see
    // the rest arithmetic above. Both halves matter: a chord with no third in
    // it, played continuously, is a drone.
    const H = harmony(this._place, this.resolve, this.index, { open: this.open });
    const P = H.place;

    const focus = this.focus;
    // How much of the world is audible. Named for what it is, because the score
    // now carries a second, unrelated `this.open` — how much of the ground in
    // front of the learner is unknown — and two things called `open` inside one
    // function is a defect waiting for somebody in a hurry.
    const audible = 1 - focus;
    const air = P.air * (0.6 + this.alt * 0.6);
    const bright = P.bright * (0.72 + H.settle * 0.5 + this.alt * 0.25 + this.momentum * 0.22);

    // --- floor ---------------------------------------------------------
    // One octave under the chord, not two. Two put the root at 37 Hz, which is
    // below the range of every device this game will ever be played on.
    // The root fills its whole slot and releases over the next one, so there is
    // never a moment with no floor under the island.
    sub(A, H.root - 12 + (P.oct < 0 ? 12 : 0), t0, CHORD,
      (0.054 + this.resolve * 0.024) * (resting ? 0.72 : 1) * (1 - this.hush * 0.30),
      { attack: resting ? 3.0 : 1.6, release: 3.4 });

    // --- the proving run's pedal ---------------------------------------
    // It plays through the rest as well as through the phrase, because the one
    // thing it is saying is that something is still being asked of you, and
    // that does not stop being true for seventeen seconds.
    this._pedal(t0, H, P);

    if (resting) {
      // Two or three notes of harp across seventeen seconds, high and wet, and
      // nothing else. This is the part of the score that sounds expensive.
      // Under a full hush there is one note, or none.
      const scale0 = H.scale;
      const oct0 = P.oct > 0 ? 12 : 0;
      const n = this.hush > 0.5
        ? (Math.random() < 0.55 ? 1 : 0)
        : 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const deg = scale0[3 + ((Math.random() * (scale0.length - 3)) | 0)];
        pluck(A, deg + oct0 + 12, t0 + rnd(0.2, CHORD - 1.2), {
          level: 0.13 * P.bell * (1 - this.hush * 0.45), air: 0.9, damp: 0.24,
          pan: rnd(-0.9, 0.9),
        });
      }
      this._advance();
      return;
    }

    // --- chord ---------------------------------------------------------
    const level = (0.086 + H.settle * 0.018) * (0.78 + audible * 0.22) * (1 - this.open * 0.30);
    // Unknown ground is voiced with fewer players and further apart. Three
    // notes across two octaves is a horizon; five inside one is a wall — and
    // taking the FIRST three of a quartal stack throws away the top of it,
    // which is the half that was doing the work. Root, the fourth over it, and
    // the top of the stack.
    const cap = focus > 0.5 ? 3 : Math.min(4, H.notes.length);
    const voices = this.open > 0.66 && H.notes.length >= 3
      ? [H.notes[0], H.notes[1], H.notes[H.notes.length - 1]].slice(0, Math.min(3, cap))
      : H.notes.slice(0, cap);
    voices.forEach((n, i) => {
      pad(A, n, t0 + i * 0.06, CHORD, {
        level: level * (i === 0 ? 1.15 : 1),
        bright,
        air,
        pan: (i / Math.max(1, voices.length - 1) - 0.5) * (1.25 + this.open * 0.5),
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
      + this.momentum * 0.22, 0, 0.94) * audible * (1 - this.open * 0.45);
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
    // …and it is not played over ground nobody has stood on. The theme is the
    // sound of this cadet's own history in a place; a unit that opened ninety
    // seconds ago has none yet, and playing it there spends the one piece of
    // fixed melodic material the game owns on nothing.
    //
    // ARRIVING SOMEWHERE IS THE EXCEPTION, and it has to be, or a cadet who has
    // never played would never hear the theme at all — everything is unknown
    // ground on the first morning. Walking into a region is the game
    // introducing itself; a unit opening mid-session is not.
    const earned = this.travel > 0.55 || this.mastery > 0.82 || this.momentum > 0.45;
    const wantMotif = (this.arrival > 0 || (earned && this.open < 0.5))
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

  /**
   * One held tone over the region's root, only while a proving run is open,
   * climbing a degree per item the run has banked.
   *
   * It is deliberately at the level of the harp rather than the level of the
   * pad: a learner should not be able to say what it is, only that the room is
   * holding its breath. It is silent for every cadet who is not inside a run,
   * which is most of the game most of the time.
   */
  _pedal(t0, H, P) {
    const A = this.A;
    if (this.run <= 0 || this.hush > 0.5) { this._pedalNote = null; return; }
    const note = runPedal(this._place, this.run * 100, 100);
    if (note === null) return;
    this._pedalNote = note;
    // A whole chord long, released over the next one, so a run has no seam in
    // it. The level rises as the run fills — barely, and never past the harp.
    pad(A, note, t0, CHORD, {
      level: (0.020 + this.run * 0.014) * (1 - this.focus * 0.35),
      bright: P.bright * 1.25,
      air: P.air * 1.1,
      pan: 0.0,
      attack: 2.6, release: 3.2,
      detune: 3,
    });
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
    const H = harmony(this._place, Math.min(1, this.resolve + 0.15), 0);
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
