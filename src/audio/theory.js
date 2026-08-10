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
 *   MASTERY  picks the *cadence*. This is the part worth being careful about.
 *            At low integrity the progression is built from suspensions and
 *            never lands: every phrase leaves a fourth hanging over the root.
 *            As the lattice knits together the suspensions start resolving,
 *            then the sevenths arrive, and at the top the score is allowed
 *            major sixths and ninths — the sound of a thing that is finished.
 *            Nobody will name what changed. Everybody will feel that the
 *            world stopped asking a question.
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
 * Resolve the whole harmonic situation for one chord slot.
 *
 * @param {string} place  region id, or 'home'
 * @param {number} mastery 0..1 lattice integrity
 * @param {number} index  which chord of the phrase
 */
export function harmony(place, mastery, index) {
  const P = PLACES[place] || PLACES.home;
  // Blend between adjacent cadence banks rather than snapping: a learner who
  // crosses 0.25 integrity mid-session should hear the suspension resolve, not
  // hear the soundtrack change.
  const f = Math.max(0, Math.min(0.999, mastery)) * (CADENCES.length - 0.001);
  const bank = CADENCES[Math.floor(f)];
  const [deg, chord] = bank[index % bank.length];
  const root = P.root + deg;
  const minorish = chord === MIN || chord === MIN7 || chord === MIN9;
  return {
    place: P,
    root,
    bass: root - 12 + (P.oct < 0 ? 0 : 0),
    // Voicing, and it matters more than the chord. Stacked as written, a
    // five-note chord occupies a major ninth at the bottom of the piano and
    // reads as one growling tone. Lifting everything above the third by an
    // octave opens a fifth of air under the upper structure — which is how
    // every orchestrator since Mozart has voiced a sustained chord, and why
    // one sounds like a section and the other sounds like a synthesiser.
    notes: chord.map((iv, i) => root + iv + (i >= 2 ? 12 : 0)),
    scale: (minorish ? PENTA_MIN : PENTA_MAJ).map((d) => P.root + d),
    minorish,
    // How settled this chord is, for the pad's filter and the bell density.
    settle: Math.floor(f) / (CADENCES.length - 1),
  };
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
