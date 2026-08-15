/**
 * The shard's ledger — the fast clock.
 *
 * ASCENT has two clocks and they are supposed to run at different speeds.
 *
 *   RANK is the order's judgement of you. It is bought with `standing`, most of
 *   which above silver can only come from lines actually held, so it is slow on
 *   purpose: a rite has to be scarce to be worth watching.
 *
 *   THE CHAPTER is the story, and the story is not a reward. It is the reason
 *   the next ten minutes are interesting. Hanging it off the same slow number
 *   as rank is what made four fifths of the writing unreachable: a real session
 *   of ten sealed rifts finished in chapter one, having heard the cold open and
 *   nothing else, with the reveal and the coda sitting unread in the bundle.
 *
 * So the chapter turns on the one thing a player unambiguously does, feels, and
 * can count: **tears closed on this shard**. One correct answer, one sealed
 * statement, one tick. Nothing else is folded in — no weighting, no caps, no
 * arithmetic to explain — because the number is printed on the chapter card and
 * a currency you cannot verify by eye is a currency nobody trusts.
 *
 *   CHAPTER 2   3 seals    ninety seconds in
 *   CHAPTER 3   7 seals    the ninth lemma, inside the first five minutes
 *   CHAPTER 4   16 seals   the reveal — Marlow's own hand in the margin
 *   CHAPTER 5   28 seals   the ask
 *   CODA        the tenth line held: the proof, closed
 *
 * That is deliberately reachable. Pacing a story by time on task is what a
 * story is for; the honest, unforgiving measure of the mathematics is rank, the
 * Standard and the ten lines in the dossier, and none of those move a
 * millimetre for grinding an easy rift.
 */

/** Tears that must be closed before each chapter opens. Index = chapter - 1. */
export const CHAPTER_AT = [0, 3, 7, 16, 28];
// Marlow names these four numbers out loud in `story.chN.b1`, in all three
// locales. Retune them here and the lines have to be retuned with them.

/**
 * NIGHTS HELD that must also be behind you. See `days.js` for what a night is.
 *
 * The first three chapters are the hook and stay on the fast clock: chapter
 * three lands inside the first five minutes, exactly as before. The last two
 * are the payload — Marlow's own hand in the margin, and what he asks you for
 * — and a story whose whole arc can be finished in one afternoon has spent its
 * best material on the session least likely to need it.
 *
 *   CHAPTER 4   the reveal   1 night held   — day two
 *   CHAPTER 5   the ask      3 nights held  — about day three
 *
 * Neither is a wall. The chapter card names the night it is waiting for, and
 * everything else in the game stays open while it waits.
 */
export const CHAPTER_NIGHTS = [0, 0, 0, 1, 3];

/**
 * NIGHTS HELD BEFORE THE PROOF CLOSES.
 *
 * The coda is not a chapter and never was: it fires on `integrity() >= 0.999`,
 * which is the tenth line held, and nothing else. That left one hole in the
 * third clock big enough to drive the whole complaint through — a cadet who
 * mastered all ten lines in one long afternoon reached **Chapter 6, the coda,
 * with zero nights held**, measured. The pay-off of the entire game, and the
 * line about nine thousand shards that have stopped arguing, arrived on a
 * Sunday to somebody who had not yet held a single line overnight.
 *
 * Five nights. Five separate mornings on which something this cadet already
 * knew came back round and was still known. It is the highest count in the
 * game after Sovereign's nine, and it is the right one: the coda's claim is
 * that the proof is *closed*, and a proof that has not survived a night is a
 * claim about today.
 *
 * It is not a wall. Everything stays open while it waits — the descent, the
 * charters, the waystations, every line in the lattice — and the watch card
 * prints the number it is waiting for (`src/meta/quest.js`).
 */
export const CODA_NIGHTS = 5;

/** Is the pay-off earned? Whole lattice, and nights that a sitting cannot buy. */
export function codaReady(whole, nights) {
  return !!whole && (nights || 0) >= CODA_NIGHTS;
}

/** How many nights the coda is still waiting for. Zero once it is due. */
export function codaIn(nights) {
  return Math.max(0, CODA_NIGHTS - (nights || 0));
}

/** Tears closed = statements sealed, assisted or not. One answer, one tear. */
export function tearsOf(led) {
  return (led?.clean || 0) + (led?.assisted || 0);
}

/**
 * Which chapter this state has opened (1..5). Both gates, so the answer is the
 * lower of the two ladders — and a chapter, once opened, is never taken back.
 *
 * @param {number} tears
 * @param {number} nights nights held; omitted means "do not ask".
 */
export function chapterFor(tears, nights = Infinity) {
  let ch = 1;
  for (let i = 1; i < CHAPTER_AT.length; i++) {
    if ((tears || 0) >= CHAPTER_AT[i] && (nights ?? Infinity) >= CHAPTER_NIGHTS[i]) ch = i + 1;
    else break;
  }
  return ch;
}

/**
 * What the next chapter is still waiting for — one thing, never two.
 * @returns {{kind:'tears'|'nights'|'top', need:number}}
 */
export function chapterGate(tears, nights, chapter) {
  if (chapter >= CHAPTER_AT.length) return { kind: 'top', need: 0 };
  const owed = Math.max(0, CHAPTER_AT[chapter] - (tears || 0));
  if (owed > 0) return { kind: 'tears', need: owed };
  const nightsOwed = Math.max(0, CHAPTER_NIGHTS[chapter] - (nights || 0));
  if (nightsOwed > 0) return { kind: 'nights', need: nightsOwed };
  return { kind: 'tears', need: 0 };
}

/** How far across the current chapter, 0..1. Chapter five reads full. */
export function chapterFrac(tears, chapter) {
  if (chapter >= CHAPTER_AT.length) return 1;
  const a = CHAPTER_AT[chapter - 1], b = CHAPTER_AT[chapter];
  return Math.max(0, Math.min(1, ((tears || 0) - a) / (b - a)));
}

/** Tears still owed to the next chapter, or 0 at the top. */
export function tearsToNext(tears, chapter) {
  if (chapter >= CHAPTER_AT.length) return 0;
  return Math.max(0, CHAPTER_AT[chapter] - (tears || 0));
}
