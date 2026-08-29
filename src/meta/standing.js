/**
 * Standing — what the lattice can actually see you do.
 *
 * The arc used to hang off `mastery.integrity()`, which is mastered-skills over
 * ten: a ten-step staircase whose first step costs roughly twenty-five items.
 * Play fourteen items well and it reads zero. Nothing in the story moved,
 * nothing in the world moved, and four fifths of the writing was unreachable.
 *
 * Standing is the middle clock — faster than integrity, slower than the shard's
 * seal ledger in `shard.js`, which is what actually turns the chapters. It is
 * not a participation trophy: every term below is evidence the mastery engine
 * already produces, and the two terms that can be farmed are capped, hard.
 *
 *   SEALS      3 per clean solve, 2 per assisted one, capped at 26.
 *              This is the term that moves in the first ninety seconds — four
 *              clean seals is a bronze rite, which is minutes, not sessions.
 *              It runs out after about nine of them, and after that grinding
 *              easy rifts buys you exactly nothing.
 *   PROVING    3 per item survived inside a proving run, capped at 12.
 *              Unassisted, high band, unfamiliar form — the transfer gate.
 *   LINES      9 per line held. Uncapped, and above Silver it is essentially
 *              the only term left: Gold needs two held lines on top of every
 *              capped point, Sovereign needs six.
 *   LATTICE    2 per line the lattice has opened beneath you, capped at 12.
 *              Progress you made by mastering prerequisites, not by answering.
 *
 * Maximum 140. The rank gates in `arc.js` are read against that.
 *
 * `slips` is tracked but deliberately costs nothing. Standing is a record of
 * what was built, and a wrong answer in a mastery system is how building works.
 */

export const SEAL_CLEAN = 3;
export const SEAL_ASSISTED = 2;
export const SEAL_CAP = 26;
export const CHECK_WORTH = 3;
export const CHECK_CAP = 12;
export const LATTICE_WORTH = 2;
export const LATTICE_CAP = 12;
export const LINE_WORTH = 9;
/** The ceiling, for a lattice of `total` lines. Ten was the whole world once. */
export function standingMax(total = 10) {
  return SEAL_CAP + CHECK_CAP + LATTICE_CAP + LINE_WORTH * Math.max(1, total || 10);
}
export const STANDING_MAX = standingMax(10);

export function blankLedger() {
  return { clean: 0, assisted: 0, checks: 0, slips: 0, best: 0 };
}

/**
 * @param {{clean:number, assisted:number, checks:number}} led counted answers
 * @param {number} lines skills fully held
 * @param {number} open  skills the lattice has unlocked
 */
export function standingOf(led, lines, open) {
  return sealTerm(led) + checkTerm(led) + latticeTerm(open) + (lines || 0) * LINE_WORTH;
}

const sealTerm = (led) => Math.min(
  SEAL_CAP, (led.clean || 0) * SEAL_CLEAN + (led.assisted || 0) * SEAL_ASSISTED,
);
const checkTerm = (led) => Math.min(CHECK_CAP, (led.checks || 0) * CHECK_WORTH);
const latticeTerm = (open) => Math.min(LATTICE_CAP, Math.max(0, open || 0) * LATTICE_WORTH);

/**
 * The four terms, for the dossier — progression you can read the arithmetic of.
 *
 * `total` is how many lines the lattice actually holds. It was ten, hard-coded,
 * for as long as ten was the whole game; the road now composes a region at a
 * time, and a bar whose fill exceeds its own cap is a readout that has stopped
 * being true. (src/content/route.js)
 */
export function breakdown(led, lines, open, total = 10) {
  return [
    { id: 'seals', have: sealTerm(led), cap: SEAL_CAP },
    { id: 'proving', have: checkTerm(led), cap: CHECK_CAP },
    { id: 'lattice', have: latticeTerm(open), cap: LATTICE_CAP },
    { id: 'lines', have: (lines || 0) * LINE_WORTH, cap: LINE_WORTH * Math.max(total || 10, lines || 0) },
  ];
}
