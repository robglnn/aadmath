/**
 * The harmony the score is allowed to use, and what decides it.
 *
 * Two dials, and they are the two dials the game already has:
 *
 *   PLACE    picks the mode and the register. Each of the island's five
 *            regions gets a different colour of the same tonal family, so
 *            walking from the vale into the wastes is a modal shift and not a
 *            key change — you can cross a border mid-phrase without the music
 *            lurching. Every root sits inside D major's neighbourhood, which
 *            is why the transitions are legal.
 *
 *   RESOLVE  picks the *cadence*. This is the part worth being careful about.
 *            At low resolve the progression is built from suspensions and
 *            never lands: every phrase leaves a fourth hanging over the root.
 *            As things knit together the suspensions start resolving, then the
 *            sevenths arrive, and at the top the score is allowed major sixths
 *            and ninths — the sound of a thing that is finished. Nobody will
 *            name what changed. Everybody will feel that the world stopped
 *            asking a question.
 *
 *            WHAT RESOLVE IS MADE OF, AND WHY IT IS NOT LATTICE INTEGRITY.
 *
 *            It used to be `mastery.softIntegrity()` alone — the mean posterior
 *            over every skill in the record. That is the right number for the
 *            arc of a course and the wrong number for the arc of an afternoon:
 *            holding one line of sixty-two moves it by 0.016, and the first
 *            cadence bank runs from 0 to 0.25. A learner could master four
 *            skills in a sitting, walk out having genuinely changed, and never
 *            once hear the suspension resolve. The dial existed and nobody
 *            could reach it.
 *
 *            So resolve is a blend, and the faster half weighs more: how the
 *            LINE IN FRONT OF THE LEARNER stands — the posterior on the skill
 *            this rift is asking about, what a live proving run has filled, and
 *            a run of statements that held — against the long integrity of the
 *            lattice. Ten minutes of real work moves it a whole bank. Nothing
 *            about the long arc is lost: a cadet who holds forty lines still
 *            arrives somewhere a cadet who holds four never gets to.
 *
 *   OPEN     how much of the ground in front of the learner is unknown. It is
 *            not a volume and it is not a mode: it takes the THIRD OUT of the
 *            chord. A triad has already decided whether the news is good; a
 *            fourth stacked on a fifth has not, which is why every score
 *            written about standing at the edge of somewhere is quartal. A unit
 *            opening should sound like altitude and space, not like a fanfare
 *            for work nobody has done yet.
 */

// Chords as interval stacks over the chord root, in semitones.
const SUS2 = [0, 2, 7];
const SUS4 = [0, 5, 7];
const MIN = [0, 3, 7];
const MIN7 = [0, 3, 7, 10];
const MIN9 = [0, 3, 7, 14];
const MAJ = [0, 4, 7];
const MAJ7 = [0, 4, 7, 11];
const ADD9 = [0, 2, 4, 7];
const SIX9 = [0, 4, 7, 9, 14];
const MAJ9 = [0, 4, 7, 11, 14];

/**
 * Four cadence banks, from unresolved to resolved. Each entry is
 * `[scale-degree offset from the region's root, chord]`.
 */
const CADENCES = [
  // 0 — the lattice is mostly holes. Nothing lands.
  [[0, SUS2], [5, SUS2], [-2, SUS4], [0, SUS4]],
  // 1 — the first thing that holds. One resolution per phrase, and it is minor.
  [[0, SUS2], [-3, MIN], [5, SUS4], [0, MIN7]],
  // 2 — sevenths. The harmony starts to have somewhere to go.
  [[0, ADD9], [-3, MIN7], [5, MAJ7], [0, MAJ]],
  // 3 — whole. The tonic is a six-nine and the phrase ends on it.
  [[0, SIX9], [5, MAJ9], [-3, MIN9], [0, SIX9]],
];

/**
 * The open voicing: the same degrees, with the third taken out and a fourth put
 * in its place. Used when the ground in front of the learner is unknown.
 *
 * This is a substitution rather than a fifth cadence bank on purpose. A learner
 * who opens a new unit has not gone backwards, and a score that drops them to
 * bank 0 the moment something new appears is telling them they have. What
 * changes is not how *resolved* the harmony is, it is whether it has committed
 * to a colour — and a stack of fourths has not.
 */
const OPEN_VOICE = [0, 5, 7, 12, 17];

/**
 * The regions. `root` is a MIDI note, `bright` biases the pad's filter, `air`
 * is how much of the long reverb this place gets — the fen is close and wet,
 * the spine is enormous and empty.
 */
export const PLACES = {
  home: { root: 50, bright: 1.00, air: 0.60, bell: 1.00, oct: 0 },   // D — the plaza
  alpine: { root: 57, bright: 1.35, air: 1.00, bell: 1.25, oct: 12 }, // A — thin, high, huge
  verdant: { root: 55, bright: 0.86, air: 0.45, bell: 0.85, oct: 0 }, // G — warm, close
  steppe: { root: 50, bright: 1.12, air: 0.72, bell: 0.95, oct: 0 },  // D — wide, dry
  badland: { root: 52, bright: 0.70, air: 0.55, bell: 0.60, oct: -12 }, // E — low, heavy
  mire: { root: 48, bright: 0.62, air: 0.80, bell: 0.75, oct: -12 },  // C — dark, wet
};

/** Pentatonic degrees the bell layer may play, per mode colour. */
const PENTA_MAJ = [0, 2, 4, 7, 9, 12, 14, 16, 19];
const PENTA_MIN = [0, 3, 5, 7, 10, 12, 15, 17, 19];

/**
 * How resolved the harmony is allowed to be, from the two clocks the game
 * actually runs on.
 *
 * @param {number} lattice 0..1 mean posterior over the whole record — the arc
 *        of a course. Moves by a sixtieth when a line holds.
 * @param {number} line    0..1 how the line in front of the learner stands.
 *        Moves by tenths inside one sitting, which is the whole point.
 * @param {number} run     0..1 how much of a live proving run has filled. A run
 *        in progress is the single most resolved thing a learner can be doing,
 *        so it is allowed to pull the cadence up on its own.
 */
export function resolveOf(lattice = 0, line = 0, run = 0) {
  const L = Math.max(0, Math.min(1, lattice));
  const N = Math.max(0, Math.min(1, line));
  const R = Math.max(0, Math.min(1, run));
  // The line weighs more than the lattice because it is the half a learner can
  // hear change. The run is a bonus on top rather than a third of the total: a
  // proving run is evidence of standing already counted in `line`, and counting
  // it twice would make a run sound like mastery before it has been earned.
  return Math.max(0, Math.min(1, L * 0.42 + N * 0.58 + R * 0.12 * (1 - L * 0.5)));
}

/**
 * Resolve the whole harmonic situation for one chord slot.
 *
 * @param {string} place  region id, or 'home'
 * @param {number} resolve 0..1 — see `resolveOf`
 * @param {number} index  which chord of the phrase
 * @param {object} [opts]
 *   open  0..1 how much of the ground in front of the learner is unknown. At 1
 *         the chord loses its third and becomes a stack of fourths.
 */
export function harmony(place, resolve, index, opts = {}) {
  const P = PLACES[place] || PLACES.home;
  // Blend between adjacent cadence banks rather than snapping: a learner who
  // crosses 0.25 resolve mid-session should hear the suspension resolve, not
  // hear the soundtrack change.
  const f = Math.max(0, Math.min(0.999, resolve)) * (CADENCES.length - 0.001);
  const bank = CADENCES[Math.floor(f)];
  const [deg, chordRaw] = bank[index % bank.length];
  const open = Math.max(0, Math.min(1, opts.open ?? 0));
  // Above two thirds unknown the third comes out. Below it the chord is left
  // alone: a half-open voicing is neither one thing nor the other, and the ear
  // reads it as a mistake rather than as a colour.
  const chord = open > 0.66 ? OPEN_VOICE : chordRaw;
  const root = P.root + deg;
  const minorish = chord === MIN || chord === MIN7 || chord === MIN9;
  return {
    place: P,
    root,
    open,
    bass: root - 12 + (P.oct < 0 ? 0 : 0),
    // Voicing, and it matters more than the chord. Stacked as written, a
    // five-note chord occupies a major ninth at the bottom of the piano and
    // reads as one growling tone. Lifting everything above the third by an
    // octave opens a fifth of air under the upper structure — which is how
    // every orchestrator since Mozart has voiced a sustained chord, and why
    // one sounds like a section and the other sounds like a synthesiser.
    notes: chord.map((iv, i) => root + iv + (i >= 2 ? 12 : 0)),
    // Unknown ground gets the major pentatonic whatever the chord is doing.
    // A minor colour over a skill nobody has tried yet is the score making a
    // judgement about work that has not happened.
    scale: (minorish && open <= 0.66 ? PENTA_MIN : PENTA_MAJ).map((d) => P.root + d),
    minorish: minorish && open <= 0.66,
    // How settled this chord is, for the pad's filter and the bell density.
    settle: Math.floor(f) / (CADENCES.length - 1),
  };
}

/**
 * The pedal a live proving run holds under the score.
 *
 * A proving run is the one stretch of this game where a learner is being asked
 * to hold something up rather than to find it, and it is the one stretch that
 * had no sound of its own at all. So while a run is open the score carries one
 * extra tone, very quiet, a fifth over the region's root — and it CLIMBS the
 * pentatonic one degree per item the run has banked. By the last rung it is an
 * octave over where it started and it is the reason the closing seal lands.
 *
 * Returns a MIDI note, or null when there is no run.
 */
export function runPedal(place, done, need) {
  if (!need || done < 0) return null;
  const P = PLACES[place] || PLACES.home;
  const k = Math.max(0, Math.min(1, done / Math.max(1, need)));
  const steps = PENTA_MAJ;
  const i = Math.min(steps.length - 1, Math.round(k * 4) + 2);
  return P.root + steps[i] + (P.oct > 0 ? 12 : 0);
}

/** How long a phrase is, in chords. */
export const PHRASE = 4;

/**
 * The chord the seal beat resolves onto: always the region's tonic, always the
 * fullest voicing that mastery has earned, always with the ninth on top. It is
 * the one moment the score is allowed to be unambiguous.
 */
export function sealChord(place, mastery, big) {
  const P = PLACES[place] || PLACES.home;
  const r = P.root;
  const base = big
    ? [r - 24, r - 12, r, r + 7, r + 12, r + 16, r + 19, r + 26]
    : [r - 12, r, r + 7, r + 12, r + 16, r + 19];
  // Below half integrity the resolution is honest about being partial: it is a
  // suspended fourth that resolves down a step, not a full triad.
  if (mastery < 0.5 && !big) return { notes: [r - 12, r, r + 5, r + 12, r + 17], resolveTo: [r + 4, r + 16] };
  return { notes: base, resolveTo: null };
}
