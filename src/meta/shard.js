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

/** Tears closed = statements sealed, assisted or not. One answer, one tear. */
export function tearsOf(led) {
  return (led?.clean || 0) + (led?.assisted || 0);
}

/** Which chapter that many sealed tears has opened (1..5). */
export function chapterFor(tears) {
  let ch = 1;
  for (let i = 1; i < CHAPTER_AT.length; i++) if ((tears || 0) >= CHAPTER_AT[i]) ch = i + 1;
  return ch;
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
