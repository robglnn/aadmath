/**
 * The arc.
 *
 * ASCENT has a spine, and this file is it. Everything else in src/meta is a
 * surface that plays one of these beats.
 *
 * The premise, stated once so nobody has to reverse-engineer it from strings:
 *
 *   The Skyren Lattice is not a place that happens to obey mathematics. It *is*
 *   a proof — nine thousand shards of world entailed, step by step, by one
 *   founding argument. Where a step holds, there is ground. Where a step fails,
 *   the world it supported tears open, and what stands in the tear is the
 *   statement that stopped being true. Rifts are not damage. They are the proof
 *   asking to be finished.
 *
 *   Step nine of that argument was never proved. It was *assumed* — one word,
 *   written fast, in the margin, nine hundred years ago. Everything above it has
 *   been standing on a promise ever since. That is why Shard Nine is tearing,
 *   and the hand that wrote the word in the margin belongs to the companion
 *   talking in your ear.
 *
 * ---------------------------------------------------------------------------
 * TWO CLOCKS
 *
 * The acts used to be hung off rank, and rank off `mastery.integrity()` — a
 * ten-step staircase whose first step costs about twenty-five items. Ten rifts
 * sealed cleanly through the real scheduler therefore finished at Copper,
 * chapter one, integrity zero, with four acts, four rites, the reveal and the
 * coda written and unreachable. An arc nobody can reach is not an arc.
 *
 * It now runs on two clocks, deliberately at different speeds.
 *
 *   THE CHAPTER turns on **tears closed on this shard** (`shard.js`): one
 *   correct answer, one seal, one tick, printed on the chapter card where you
 *   can count it. Chapter two is four seals away. The reveal is twenty. The
 *   story is not a reward for mastery — it is the reason the next ten minutes
 *   are worth playing, and it has to move while you are playing them.
 *
 *   THE RANK is bought with **standing** (`standing.js`), which counts what the
 *   lattice can actually see: clean solves, proving runs survived, lines held,
 *   lattice opened beneath you. The seal term caps early and hard, so above
 *   Silver essentially the only currency left is lines actually held. Bronze is
 *   four clean seals. Sovereign is six held lines. The rite stays scarce, and
 *   the Standard in the plaza never lies about how much mathematics you own.
 */

import { CHAPTER_AT } from './shard.js';

export const RANKS = ['copper', 'bronze', 'silver', 'gold', 'sovereign'];

/**
 * Standing at which each rank begins. See `standing.js` for how the number is
 * earned and what it is worth; the short version:
 *
 *   BRONZE    12   four clean seals              — two minutes in
 *   SILVER    30   the seal term has capped: this needs a proving run or a line
 *   GOLD      60   two held lines on top of every capped point
 *   SOVEREIGN 96   six held lines. Earned, and felt.
 *
 * Maximum available standing is 140, so Sovereign is reachable before the last
 * line closes — the rank is your standing in the order, the coda is the proof.
 */
export const RANK_AT = [0, 12, 30, 60, 96];

/**
 * NIGHTS HELD, per rank. The third clock — see `days.js`.
 *
 * Standing alone could be maxed in one long sitting: two hundred and sixty
 * items reached Sovereign with zero nights held, which made the highest rank in
 * the order a statement about one Sunday afternoon. It is not that any more.
 *
 *   COPPER    0   you are here
 *   BRONZE    0   four clean seals, minutes in. The first rite has to be
 *                 reachable inside the first session or nobody ever sees one.
 *   SILVER    1   one line you held yesterday, still held today
 *   GOLD      4   four of them
 *   SOVEREIGN 9   nine. Reachable in about a week of coming back, and not
 *                 reachable any faster, by anybody, at any skill level.
 *
 * A night held is a re-probe passed after five hours or more away from the
 * machine (`mastery.durableCount()`). It is evidence the engine already
 * gathers for its own purposes; nothing new is asked of the learner, and
 * nothing about learning is gated behind it.
 */
export const RANK_NIGHTS = [0, 0, 1, 4, 9];

/**
 * Which rank a state buys. Both gates must be met, so the answer is the lower
 * of the two ladders.
 *
 * @param {number} standing
 * @param {number} nights nights held; omitted means "do not ask", which is what
 *        a critic previewing a rank and the old save format both want.
 */
export function rankFor(standing, nights = Infinity) {
  let i = 0;
  for (let k = 1; k < RANK_AT.length; k++) {
    if ((standing || 0) >= RANK_AT[k] && (nights ?? Infinity) >= RANK_NIGHTS[k]) i = k;
    else break;
  }
  return i;
}

/**
 * Why the next rank is not here yet — the one number the card prints.
 *
 * Exactly one of these is returned, and standing comes first: a cadet who is
 * short of both should be told to go and work, not told to come back tomorrow.
 *
 * @returns {{kind:'standing'|'nights'|'top', need:number}}
 */
export function rankGate(standing, nights, rank) {
  const next = rank + 1;
  if (next >= RANK_AT.length) return { kind: 'top', need: 0 };
  const shortStanding = Math.max(0, RANK_AT[next] - (standing || 0));
  if (shortStanding > 0) return { kind: 'standing', need: shortStanding };
  const shortNights = Math.max(0, RANK_NIGHTS[next] - (nights || 0));
  if (shortNights > 0) return { kind: 'nights', need: shortNights };
  return { kind: 'standing', need: 0 };
}

/** Progress across the current rung, 0..1. Sovereign is always full. */
export function rungProgress(standing, rank) {
  if (rank >= RANKS.length - 1) return 1;
  const a = RANK_AT[rank], b = RANK_AT[rank + 1];
  return Math.max(0, Math.min(1, ((standing || 0) - a) / (b - a)));
}

export const RANK_INK = {
  copper: '#e08a4c',
  bronze: '#ffc061',
  silver: '#cfe4f7',
  // Sovereign is the only rank that is not a metal, and it used to render as
  // near-white — indistinguishable from silver at a glance, which took the
  // punch out of the one promotion that matters most.
  gold: '#ffd75e',
  sovereign: '#c2a4ff',
};
export const RANK_GLOW = {
  copper: '#ff7a2f',
  bronze: '#ffae35',
  silver: '#8fd0ff',
  gold: '#ffc93c',
  sovereign: '#8b5cf6',
};
/** THREE-side colours for the Standard in the plaza. */
export const RANK_HEX = {
  copper: 0xff8a3c, bronze: 0xffb347, silver: 0x9fd8ff, gold: 0xffd45e, sovereign: 0xa47cff,
};

/**
 * The acts. `lines` are i18n keys played in order through the comms channel;
 * `id` is what gets written to the save so a beat never fires twice; `at` is the
 * number of tears this shard needs closed before the act opens, and is the same
 * ladder the chapter card counts against (`shard.js`).
 */
export const ACTS = [
  {
    n: 1, id: 'ch1', at: CHAPTER_AT[0],
    lines: ['story.open.l1', 'story.open.l2', 'story.open.l3', 'story.open.l4', 'story.open.l5'],
  },
  {
    n: 2, id: 'ch2', at: CHAPTER_AT[1],
    lines: ['story.ch2.b1', 'story.ch2.b2', 'story.ch2.b3'],
  },
  {
    n: 3, id: 'ch3', at: CHAPTER_AT[2],
    /* src/ui P1 — b1 used to be one 197-character sentence carrying both the
       founding proof AND the word "lemma", which this chapter is named after
       and which nothing in the game ever defined. It is two beats now: the
       fact, then the definition. Same information, read instead of skipped. */
    lines: ['story.ch3.b1', 'story.ch3.b1b', 'story.ch3.b2', 'story.ch3.b3'],
  },
  {
    n: 4, id: 'ch4', at: CHAPTER_AT[3],
    lines: ['story.ch4.b1', 'story.ch4.b2', 'story.ch4.b3'],
  },
  {
    n: 5, id: 'ch5', at: CHAPTER_AT[4],
    lines: ['story.ch5.b1', 'story.ch5.b2'],
  },
];

/** Played when the last of the ten lines is sealed — the pay-off. */
export const CODA = ['story.coda.c1', 'story.coda.c2', 'story.coda.c3'];

/**
 * A rank insignia: a hexagon with one ascending chevron per rank earned, and a
 * core that only lights for a Sovereign. Drawn, not iconified — the strokes are
 * animatable, which is what makes the ascension beat feel like something being
 * awarded rather than a badge appearing.
 */
export function sigilSVG(i, cls = '') {
  const chev = [];
  for (let k = 0; k <= i; k++) {
    const y = 33 - k * 5.6;
    chev.push(`<path class="sig-chev" style="--k:${k}" d="M15 ${y} L24 ${(y - 5).toFixed(1)} L33 ${y}"/>`);
  }
  return `<svg class="sigil ${cls}" viewBox="0 0 48 48" aria-hidden="true">
    <path class="sig-hex" d="M24 2.5 L42.6 13.2 L42.6 34.8 L24 45.5 L5.4 34.8 L5.4 13.2 Z"/>
    ${i >= 4 ? '<circle class="sig-core" cx="24" cy="24" r="2.9"/>' : ''}
    <g class="sig-chevs">${chev.join('')}</g>
  </svg>`;
}
