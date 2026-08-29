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
 *
 * ── AND THE SIX THAT WERE MISSING ───────────────────────────────────────────
 *
 * Those two covered "right" and "wrong" and nothing else, which meant the four
 * events a learner actually cares about most had no sound of their own at all.
 * The mastery engine has always handed the whole report back on every answer —
 * `checkEvent`, `check.done`, `check.need`, `justMastered`, `justWithdrawn` —
 * and the audio layer was reading two fields of it. The rest are here now:
 *
 *   `rung`        one item of a proving run banked. Pitched off how full the
 *                 run is, so three of them in a row is an ascending figure a
 *                 learner learns to want. It is the strongest single idea
 *                 available: a run you can HEAR filling.
 *   `runOpened`   the gate arrives. The score lifts onto the dominant and does
 *                 not land. Nobody is told anything; the room changes.
 *   `runCharged`  a miss the run absorbed. The ladder steps back down one rung
 *                 and the warm figure plays. It is quieter than a plain slip,
 *                 not louder, for the same reason `slip` gets gentler the more
 *                 you miss: a learner inside a run is already trying hardest.
 *   `runEnded`    the run collapsed. It unwinds, downward, warm, over a second
 *                 — and lands on the tonic. Not a failure sound. The thing that
 *                 just happened is that a ladder you now know how to climb is
 *                 back at the bottom.
 *   `withdrawn`   a claim the engine has taken back. One low tone with no
 *                 attack, fading. A light going out, not an alarm.
 *   `echoOpen`    a layer of the worked echo cut. `src/learn/echo.js` treats a
 *                 wrong answer as information and answers it with mathematics
 *                 computed from the learner's own move; the sound has to take
 *                 the same stance, so it is an OPENING gesture — rising, in
 *                 key, quieter the deeper the cut — and never a confirmation.
 *
 * Every one of them is under the pad, none of them is longer than the seal, and
 * not one carries information that is not also on the glass.
 */

import { sealChord, PLACES, runPedal } from './theory.js';
import { pad, sub, bell, pluck, shimmer, thump, grain, ping, choir } from './voices.js';
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
   *   quiet    0..1 — how much of its usual size this seal is allowed. It is
   *            below 1 in exactly one case: the same answer also banked a rung
   *            of a proving run, and the rung is the news. Two full-size events
   *            on one downbeat is one event played twice.
   */
  seal(o = {}) {
    const A = this.A;
    if (!A.live) return;
    const place = PLACES[o.place] ? o.place : 'home';
    const mastery = clamp(o.mastery ?? 0.5, 0, 1);
    const big = !!o.big;
    const q = clamp(o.quiet ?? 1, 0.25, 1);
    const C = sealChord(place, mastery, big);
    const t = A.t;
    const LAND = t + 0.20;      // the downbeat everything is aimed at

    // THE ROOM GOES QUIET FIRST. This is the cheapest and largest thing in the
    // whole beat and it is not a sound at all: the island's wind, its birds and
    // its stone are pulled down under the chord and then walk back in over two
    // and a half seconds. A cadence played on top of a gale is a cadence in a
    // gale. The same cadence played into a room that just stopped is an event.
    // Mastery gets the deepest hole and the slowest walk back.
    A.duck((big ? 0.74 : 0.52) * q, big ? 1.05 : 0.70, big ? 2.6 : 1.6, (big ? 0.62 : 0.32) * q);

    // --- inhale --------------------------------------------------------
    // Rising air into the landing. It is short, it is quiet, and removing it
    // makes the chord sound like it starts rather than arrives.
    shimmer(A, t, {
      freq: 700, Q: 1.2, level: (big ? 0.075 : 0.055) * q,
      rise: 0.19, hold: 0.02, fall: 0.5, sweep: 4.2, air: 0.9, bus: A.sfx,
    });
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 300, Q: 0.8, sweep: 7,
      attack: 0.18, decay: 0.22, level: 0.05 * q, air: 0.6, bus: A.sfx,
    });

    // --- landing -------------------------------------------------------
    thump(A, LAND, {
      freq: big ? 120 : 96, to: big ? 38 : 44,
      decay: big ? 0.42 : 0.26, drop: 0.13,
      level: (big ? 0.34 : 0.22) * q, bus: A.sfx,
    });
    sub(A, C.notes[0] - 12, LAND, big ? 2.4 : 1.5, (big ? 0.15 : 0.10) * q,
      { bus: A.sfx, attack: 0.05, release: big ? 2.4 : 1.8 });

    // The chord itself. Fast attack — this is a landing, not a swell — and a
    // release long enough that the shards still have something to fall through
    // when the rift's outline finishes closing.
    //
    // IT LANDS AND IT RECEDES. Written to hold flat for two and a half seconds
    // it measured as a three-second plateau at 0.24 RMS over a bed of 0.05 —
    // fourteen decibels, sustained, on every correct answer, twenty-plus times
    // a sitting. That is a limiter pumping the whole island once a minute for
    // twenty minutes, and it is the exact difference between a game that
    // confirms an action and a game that shouts at you for having taken one.
    // The tail is the roll and the bells now; the chord gets out of their way.
    C.notes.slice(0, big ? 6 : 4).forEach((n, i) => {
      pad(A, n, LAND + i * 0.012, big ? 2.3 : 1.35, {
        level: (big ? 0.098 : 0.072) * (i === 0 ? 1.2 : 1) * q,
        bright: 1.5, air: 1, attack: 0.045, release: big ? 2.6 : 1.9,
        pan: (i / 5 - 0.5) * 1.3, bus: A.sfx,
      });
    });

    // --- the roll ------------------------------------------------------
    // Upward, accelerating slightly, so the gesture has a direction. This is
    // the part a player will hum back at you.
    C.notes.forEach((n, i) => {
      pluck(A, n, LAND + i * (0.052 - i * 0.003), {
        level: (0.26 - i * 0.014) * q, air: 0.8, damp: 0.26,
        pan: (i / Math.max(1, C.notes.length - 1) - 0.5) * 1.4, bus: A.sfx,
      });
    });

    // Top bell — the one that rings after everything else has stopped.
    bell(A, C.notes[C.notes.length - 1] + (big ? 12 : 0), LAND + 0.02, {
      level: (big ? 0.19 : 0.14) * q, decay: big ? 5.6 : 3.8,
      index: 2.0, ratio: 3.51, air: 1, pan: 0.12, bus: A.sfx,
    });

    // A partial cadence, honestly voiced: the suspended fourth steps down onto
    // the third three-quarters of a second later. Only below half integrity —
    // the sound of "true, and there is more of this to get right".
    if (C.resolveTo) {
      C.resolveTo.forEach((n, i) => {
        pluck(A, n, LAND + 0.62 + i * 0.05, { level: 0.13 * q, air: 0.85, damp: 0.34, bus: A.sfx });
      });
    }

    // --- tail ----------------------------------------------------------
    const sparkles = big ? 7 : 4;
    for (let i = 0; i < sparkles; i++) {
      const n = C.notes[(Math.random() * C.notes.length) | 0] + (Math.random() < 0.5 ? 12 : 19);
      bell(A, n, LAND + 0.45 + i * rnd(0.14, 0.34), {
        level: 0.035 * q * rnd(0.6, 1), decay: rnd(2.2, 4.2), index: 1.8,
        air: 1, pan: rnd(-1, 1), bus: A.sfx,
      });
    }

    // --- the voice -----------------------------------------------------
    // THE PAYLOAD.
    //
    // Everything above this line is objects: struck metal, plucked string,
    // moved air. A person is a different category of thing to hear, and the ear
    // knows it in one note. So the game holds its only human sound back and
    // spends it on exactly one meaning — *this held, and it was yours* — which
    // is why it must not be here for every seal.
    //
    // It arrives on a ladder, and the ladder is the answer to a build that was
    // called flat: an early answer on a shaky line gets no voice at all; as a
    // line comes together one voice appears under the chord, faintly, and a
    // learner notices without being able to say what changed; and the answer
    // that closes the skill gets the full section — root, fifth, octave — held
    // for four seconds over the bells.
    //
    // The attack is slow on purpose. The chord lands, and *then* the voice
    // grows into the room behind it, which is the difference between a stab and
    // an arrival. It is also why the frame's light (src/fx `seal()`) is still
    // up when the voice reaches full: they are the same event.
    const voices = big ? 3 : (mastery > 0.62 ? 1 : 0);
    if (voices) {
      const r = C.notes[big ? 2 : 1];
      const line = big ? [r, r + 7, r + 12] : [r];
      line.forEach((n, i) => {
        choir(A, n, LAND + 0.06 + i * 0.09, big ? 3.4 : 1.9, {
          level: (big ? 0.075 : 0.030) * (i === 0 ? 1 : 0.72) * q,
          attack: big ? 0.55 : 0.42,
          release: big ? 3.0 : 1.8,
          vibrato: big ? 9 : 6,
          air: 0.95,
          pan: line.length > 1 ? (i / (line.length - 1) - 0.5) * 1.15 : 0.06,
          bus: A.sfx,
        });
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
    // A FLOOR UNDER THE LADDER.
    //
    // The ladder was right and the arithmetic was wrong. `1 - (n-1) * 0.34`
    // put the third slip at 0.30 of an already quiet figure, and rendered
    // offline the whole thing peaked at 0.0093 against a seal at 0.26 — twenty
    // nine decibels down, under a wind bed that sits higher than that on its
    // own. That is not gentleness, it is the game not answering. A learner who
    // has missed three in a row and hears NOTHING has been told something much
    // worse than "not yet": they have been told the machine has stopped
    // bothering. So the ladder still softens, and it stops at half.
    const soft = clamp(1 - (n - 1) * 0.22, 0.5, 1);
    A.duck(0.20 * soft, 0.12, 0.6);

    // the knock: wood, not metal, and no higher than a knuckle on a desk
    if (n < 3) {
      thump(A, t, {
        freq: 168, to: 96, decay: 0.11, drop: 0.05, level: 0.18 * soft, bus: A.sfx,
      });
      grain(A, t, {
        colour: 'pink', type: 'lowpass', freq: 900, Q: 0.6,
        decay: 0.055, level: 0.075 * soft, air: 0.25, bus: A.sfx,
      });
    }

    // Two soft tones a whole step apart, *rising* then settling back onto the
    // first — the shape of a question, not a verdict.
    ping(A, mtof(62), t + 0.03, {
      type: 'sine', decay: 0.34 + n * 0.12, level: 0.115 * soft, air: 0.5, bus: A.sfx,
    });
    ping(A, mtof(64), t + 0.14, {
      type: 'sine', decay: 0.46 + n * 0.14, level: 0.090 * soft, air: 0.6, bus: A.sfx,
    });
    ping(A, mtof(62), t + 0.30, {
      type: 'sine', decay: 0.7 + n * 0.2, level: 0.062 * soft, air: 0.7, bus: A.sfx,
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
    ping(A, mtof(69), t, { type: 'triangle', decay: 0.07, level: 0.105, air: 0.3 });
    ping(A, mtof(76), t + 0.055, { type: 'triangle', decay: 0.13, level: 0.095, air: 0.4 });
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

  // ------------------------------------------------------- the proving run
  /**
   * One item of a proving run, banked.
   *
   * @param {number} done how many the run has now
   * @param {number} need how many it wants
   * @param {string} place region id — the rung is in the key you are standing in
   *
   * It is a bell and a very small click, and the bell's pitch is a degree of
   * the region's pentatonic chosen by how full the run is. Three items in a row
   * is therefore an ascending figure, in key, that a learner hears as *going
   * somewhere* without ever being told a count. The last rung is the highest
   * and it arrives a beat before the seal, so the seal lands on top of it.
   */
  rung(done, need, place = 'home') {
    const A = this.A;
    if (!A.live || !need) return;
    const t = A.t;
    const k = clamp(done / Math.max(1, need), 0, 1);
    const note = runPedal(place, done, need);
    if (note === null) return;
    // The click first: a rung is a thing landing in a slot, and the slot is
    // wood, not metal. Under the bell, and inaudible on its own.
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 1200, Q: 1.4,
      decay: 0.05, level: 0.032, air: 0.3, bus: A.sfx,
    });
    bell(A, note + 12, t + 0.012, {
      level: 0.085 + k * 0.05, decay: 2.2 + k * 1.4, index: 2.2, ratio: 3.51,
      air: 0.8, pan: -0.18 + k * 0.36, bus: A.sfx,
    });
    // …and its own fifth, only on the last two rungs, so the top of the ladder
    // is audibly wider than the bottom of it.
    if (k > 0.6) {
      bell(A, note + 19, t + 0.09, {
        level: 0.038, decay: 3.0, index: 1.8, air: 1, pan: 0.3, bus: A.sfx,
      });
    }
  }

  /**
   * The gate arrives. A learner has just produced enough standing that the
   * engine will now ask them to prove it.
   *
   * The score lifts onto the fifth and holds there without landing. It is the
   * only unresolved sustained thing in the game and it is on purpose: what has
   * just happened is that a question has been asked, and a question that
   * resolves is not a question.
   */
  runOpened(place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    A.duck(0.30, 0.55, 1.9, 0.20);
    const r = P.root;
    // root and fifth, no third — the room has not decided anything yet
    // It arrives 0.62 s after a seal, so it grows in under that chord's own
    // release rather than on top of its landing. Measured together the two used
    // to sum to a three-second plateau; separately they are a resolution and
    // then a question, which is what they are.
    [r, r + 7, r + 19].forEach((n, i) => {
      pad(A, n, t + i * 0.05, 2.0, {
        level: 0.042 * (i === 0 ? 1.15 : 0.8), bright: 1.25, air: 0.95,
        attack: 0.75, release: 2.6, pan: (i - 1) * 0.5, bus: A.sfx,
      });
    });
    shimmer(A, t, {
      freq: 1250, Q: 1.5, level: 0.045, rise: 0.8, hold: 0.5, fall: 2.4,
      sweep: 1.9, air: 1, bus: A.sfx,
    });
    // one bell on the fifth, up top, so the lift has a point on it
    bell(A, r + 19, t + 0.24, {
      level: 0.10, decay: 4.2, index: 2.0, air: 1, pan: 0.1, bus: A.sfx,
    });
  }

  /**
   * A miss the run absorbed: the run is longer now, and that is all.
   *
   * Quieter than an ordinary slip, and it steps the ladder tone back DOWN one
   * rung rather than adding anything. A learner inside a proving run is already
   * working at the top of what they can do; the correct response to a slip
   * there is to take something away, not to add an alarm.
   */
  runCharged(done, need, place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const t = A.t;
    const note = runPedal(place, Math.max(0, done - 1), need || 3);
    A.duck(0.12, 0.1, 0.7);
    if (note !== null) {
      pluck(A, note + 12, t, { level: 0.24, air: 0.8, damp: 0.4, pan: -0.1, bus: A.sfx });
      pluck(A, note + 5, t + 0.13, { level: 0.16, air: 0.9, damp: 0.46, pan: 0.14, bus: A.sfx });
    }
    ping(A, mtof(62), t + 0.02, {
      type: 'sine', decay: 0.5, level: 0.075, air: 0.6, bus: A.sfx,
    });
  }

  /**
   * The run ends without closing.
   *
   * It unwinds — the ladder played backwards, warm, over about a second, landing
   * on the region's root. It is the longest of the "not yet" sounds and the
   * quietest, and there is nothing percussive anywhere in it. What it must not
   * be is a failure sting: `src/learn/echo.js` answers a wrong move by taking it
   * seriously enough to compute mathematics from it, and a stinger here would
   * contradict the whole surface it plays over.
   */
  runEnded(place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    A.duck(0.20, 0.25, 1.4);
    const r = P.root;
    [19, 14, 9, 4, 0].forEach((iv, i) => {
      pluck(A, r + iv + 12, t + i * 0.115, {
        level: 0.085 - i * 0.011, air: 0.85, damp: 0.34,
        pan: (0.5 - i / 4) * 0.9, bus: A.sfx,
      });
    });
    // and the floor is still there underneath, which is the point
    sub(A, r - 12, t + 0.44, 2.2, 0.075, { bus: A.sfx, attack: 0.5, release: 2.0 });
  }

  /**
   * A claim the engine has taken back — a cold re-probe missed, or a question
   * type that a line proved last week has never once been solved.
   *
   * One low tone, no attack at all, fading over three seconds under everything
   * else. The surface says what happened in words; this is only so that a
   * learner who was looking away notices the room got one voice quieter.
   */
  withdrawn(place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    // The order matters and the first draft had it backwards: the bell came
    // half a second AFTER the pad, so the thing left ringing at the end was the
    // bright half and the sound got brighter as it died. A light going out gets
    // dimmer. The bell is first now, and what outlives it is the low tone.
    bell(A, P.root + 7, t, {
      level: 0.042, decay: 1.9, index: 1.4, ratio: 2.0, air: 1, pan: 0.2, bus: A.sfx,
    });
    pad(A, P.root - 12, t + 0.06, 1.8, {
      level: 0.060, bright: 0.45, air: 0.9,
      attack: 0.9, release: 3.0, pan: -0.1, bus: A.sfx,
    });
  }

  /**
   * A layer of the worked echo cut open.
   *
   * `depth` is which stratum, 1 upward. It gets QUIETER and lower as it goes
   * deeper, which is the opposite of a reward ladder and is deliberate: the
   * first cut is the interesting one, and a learner who has asked four times is
   * concentrating, not celebrating. Rising interval, always — the sound of a
   * lid coming off, never of a box being ticked.
   */
  echoOpen(depth = 1, place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    const d = clamp(depth, 1, 4);
    const soft = 1 - (d - 1) * 0.19;
    const r = P.root + 12 - (d - 1) * 2;
    // a breath of air first — something opening, not something confirming
    // These levels are what they are because the first draft of them was not
    // audible. Rendered offline the pair peaked at 0.017 against a seal at
    // 0.26, which is twenty-four decibels down — under the wind, under the
    // rift's own hum, and under the score's own harp. The most important thing
    // this game does in answer to a wrong answer would have made no sound at
    // all. It sits at about a third of a seal now: clearly an event, clearly
    // not a reward.
    grain(A, t, {
      colour: 'pink', type: 'bandpass', freq: 640, Q: 0.9, sweep: 3.2,
      attack: 0.07, decay: 0.30, level: 0.075 * soft, air: 0.55, bus: A.sfx,
    });
    pluck(A, r, t + 0.03, { level: 0.42 * soft, air: 0.7, damp: 0.30, pan: -0.24, bus: A.sfx });
    pluck(A, r + 7, t + 0.135, { level: 0.34 * soft, air: 0.85, damp: 0.28, pan: 0.22, bus: A.sfx });
    // …and the fifth over it, once, on the first cut only — the sound of
    // something opening rather than of something being handed over.
    if (d === 1) {
      bell(A, r + 19, t + 0.30, {
        level: 0.045, decay: 2.8, index: 1.6, ratio: 2.0, air: 1, pan: 0.3, bus: A.sfx,
      });
    }
  }

  // ------------------------------------------------------------- ceremonies
  /**
   * The orders. A run has a shape now, and its opening gets one low note and a
   * channel-open breath — the same grammar as the companion's radio, an octave
   * down and much slower, because this is not a line being spoken, it is a
   * sitting beginning.
   */
  ordersOpen(place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    A.duck(0.42, 0.9, 2.2, 0.45);
    thump(A, t, { freq: 96, to: 44, decay: 0.34, drop: 0.16, level: 0.16, bus: A.sfx });
    sub(A, P.root - 12, t, 2.6, 0.13, { bus: A.sfx, attack: 0.35, release: 2.2 });
    [0, 7].forEach((iv, i) => {
      bell(A, P.root + iv + 12, t + 0.22 + i * 0.19, {
        level: 0.085 - i * 0.02, decay: 4.0, index: 1.9, air: 0.95,
        pan: i ? 0.3 : -0.26, bus: A.sfx,
      });
    });
    shimmer(A, t + 0.1, {
      freq: 900, Q: 1.4, level: 0.040, rise: 1.2, hold: 0.3, fall: 2.4,
      sweep: 2.0, air: 1, bus: A.sfx,
    });
  }

  /**
   * The close. Twenty minutes of work resolving onto one chord.
   *
   * This is the only place in the game other than a skill closing where the
   * choir is allowed to sing, and it sings only when the run actually held a
   * line. A résumé card over a run that held nothing gets the chord and no
   * voice, which is honest: the arithmetic on the card says the same thing.
   */
  resolutionLand(place = 'home', held = 0) {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    const big = held > 0;
    A.duck(0.66, 1.2, 3.0, 0.55);
    const r = P.root;
    const notes = big ? [r - 12, r, r + 7, r + 12, r + 16, r + 19] : [r - 12, r, r + 7, r + 12, r + 17];
    thump(A, t, { freq: 108, to: 40, decay: 0.40, drop: 0.14, level: 0.24, bus: A.sfx });
    sub(A, r - 24, t, 4.4, 0.17, { bus: A.sfx, attack: 0.1, release: 2.6 });
    notes.forEach((n, i) => {
      pad(A, n, t + i * 0.03, 3.6, {
        level: 0.10 * (i === 0 ? 1.2 : 1), bright: 1.35, air: 1,
        attack: 0.35, release: 2.6, pan: (i / (notes.length - 1) - 0.5) * 1.3, bus: A.sfx,
      });
    });
    notes.forEach((n, i) => {
      pluck(A, n + 12, t + 0.06 + i * (0.06 - i * 0.004), {
        level: 0.19 - i * 0.016, air: 0.85, damp: 0.26,
        pan: (i / (notes.length - 1) - 0.5) * 1.4, bus: A.sfx,
      });
    });
    if (big) {
      // The choir grows in BEHIND the landing rather than over it. Written with
      // a longer hold it peaked three and a half seconds after the chord, which
      // makes the résumé card the loudest thing and the resolution a run-up to
      // it. A cadence lands; it does not crescendo.
      [r + 7, r + 14].forEach((n, i) => {
        choir(A, n, t + 0.30 + i * 0.1, 1.9, {
          level: 0.042 * (i ? 0.7 : 1), attack: 0.85, release: 2.6,
          vibrato: 7, air: 0.95, pan: i ? 0.55 : -0.45, bus: A.sfx,
        });
      });
    }
    bell(A, r + 24, t + 0.16, {
      level: 0.11, decay: 6.0, index: 2.0, ratio: 3.51, air: 1, pan: 0.1, bus: A.sfx,
    });
  }

  /**
   * ONE BREATH OF THE REST.
   *
   * `src/session/rest.js` paces four seconds in, two held, six out — five
   * breaths a minute — with a ring and no sound at all. A pacer you have to
   * WATCH is a pacer that asks the eyes to keep working through the break the
   * eyes were given, which is most of the way to undoing the point of it.
   *
   * So: an inhale that rises and an exhale that falls, both filtered air,
   * both far too quiet to be a sound effect. Nothing is added that the ring does
   * not already show, so a learner with sound off loses nothing at all — and a
   * learner who closes their eyes for two minutes gets the whole of it.
   *
   * @param {number} inSec how long the inhale runs
   * @param {number} holdSec the pause at the top
   * @param {number} outSec how long the exhale runs
   */
  breathe(inSec = 4, holdSec = 2, outSec = 6, place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    // the inhale: narrow, rising, and it arrives at the top of its sweep on the
    // exact beat the ring reaches full
    shimmer(A, t, {
      freq: 380, Q: 1.1, level: 0.085, rise: inSec * 0.86, hold: holdSec * 0.5,
      fall: 0.5, sweep: 3.1, air: 0.9, pan: -0.12, bus: A.amb,
    });
    // …and the exhale, wider and falling, starting when the hold ends
    shimmer(A, t + inSec + holdSec, {
      freq: 900, Q: 0.8, level: 0.080, rise: 0.5, hold: outSec * 0.3,
      fall: outSec * 0.7, sweep: 0.34, air: 1, pan: 0.14, bus: A.amb,
    });
    // one tone a whole step down across the pair, so the breath has a shape a
    // learner can follow with their eyes shut
    ping(A, mtof(P.root + 19), t + 0.1, {
      type: 'sine', decay: inSec * 0.7, level: 0.040, air: 0.9, bus: A.amb,
    });
    ping(A, mtof(P.root + 17), t + inSec + holdSec + 0.05, {
      type: 'sine', decay: outSec * 0.7, level: 0.034, air: 1, bus: A.amb,
    });
  }

  /** The rest is over and the learner may stand down. One note, and room. */
  restEnd(place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    [0, 7, 12].forEach((iv, i) => {
      bell(A, P.root + iv + 12, t + i * 0.16, {
        level: 0.065 - i * 0.012, decay: 4.6, index: 1.8, air: 1,
        pan: (i - 1) * 0.5, bus: A.sfx,
      });
    });
  }

  /**
   * A promotion. The one moment this game is allowed to be grand, and the only
   * sting in the file with a real fanfare shape in it — a fifth answered by an
   * octave, over a low swell, with the room pulled right down underneath.
   *
   * It used to share a sound with "you can now afford a beacon".
   */
  rankUp(place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    A.duck(0.72, 1.3, 3.2, 0.6);
    const r = P.root;
    // The floor is under the call, not over it. Written with a 0.30 thump and a
    // 0.20 sub, the whole ceremony measured as a 47 Hz event: the horns were
    // there and the low end was the only thing loud enough to be the sound.
    thump(A, t, { freq: 126, to: 36, decay: 0.5, drop: 0.16, level: 0.19, bus: A.sfx });
    sub(A, r - 24, t, 4.6, 0.12, { bus: A.sfx, attack: 0.06, release: 2.8 });
    // the call: fifth, then the octave over it, spaced like a horn pair
    [[7, 0], [12, 0.30], [19, 0.60]].forEach(([iv, dt], i) => {
      bell(A, r + iv + 12, t + 0.08 + dt, {
        level: 0.26 - i * 0.03, decay: 5.2, index: 2.4, ratio: 2.76,
        air: 1, pan: (i - 1) * 0.75, bus: A.sfx,
      });
      pad(A, r + iv, t + 0.06 + dt, 2.8 - i * 0.4, {
        level: 0.105, bright: 1.6, air: 1, attack: 0.09, release: 2.4,
        pan: (1 - i) * 0.7, bus: A.sfx,
      });
    });
    [r + 7, r + 12, r + 19].forEach((n, i) => {
      choir(A, n, t + 0.9 + i * 0.09, 3.0, {
        level: 0.070 * (i === 0 ? 1 : 0.7), attack: 0.5, release: 3.0,
        vibrato: 9, air: 0.95, pan: (i - 1) * 0.85, bus: A.sfx,
      });
    });
    shimmer(A, t + 0.85, {
      freq: 1700, Q: 1.3, level: 0.075, rise: 1.0, hold: 0.5, fall: 3.4,
      sweep: 2.4, air: 1, bus: A.sfx,
    });
  }

  /** A capability handed over: it is a tool, so it sounds like one being set down. */
  granted(place = 'home') {
    const A = this.A;
    if (!A.live) return;
    const P = PLACES[place] || PLACES.home;
    const t = A.t;
    A.duck(0.34, 0.4, 1.3);
    thump(A, t, { freq: 140, to: 58, decay: 0.16, drop: 0.07, level: 0.15, bus: A.sfx });
    ping(A, 1240, t + 0.006, { type: 'triangle', decay: 0.22, level: 0.055, air: 0.5, bus: A.sfx });
    [0, 4, 7, 12].forEach((iv, i) => {
      bell(A, P.root + iv + 12, t + 0.07 + i * 0.075, {
        level: 0.075 - i * 0.010, decay: 3.4, index: 2.1, air: 0.95,
        pan: (i / 3 - 0.5) * 1.1, bus: A.sfx,
      });
    });
  }

  /**
   * A CHOSEN THING, not a committed one.
   *
   * The rift's whole surface used to answer every press with `commit()` — the
   * two-note "handing something over" figure — which meant picking an option,
   * typing a digit, and actually submitting an answer were the same sound, and
   * so was calling up the worked echo. A sound that means four things means
   * nothing. This is what a selection sounds like: one soft tick, no interval,
   * no direction.
   */
  pick() {
    const A = this.A;
    if (!A.live) return;
    ping(A, rnd(760, 840), A.t, { type: 'sine', decay: 0.045, level: 0.055, air: 0.15 });
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
