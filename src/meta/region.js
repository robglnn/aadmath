/**
 * THE LATTICE OPENS — the beat that says a whole new region of the knowledge
 * graph has lit up.
 *
 * Sixty-two lines shipped on disk and a learner reached ten, because nothing
 * in `src/` ever advanced past the first unit. `src/content/route.js` fixes the
 * road; this file is the moment. Without it a region would appear on the island
 * one morning with nobody having said anything, which is the same as it not
 * having been earned.
 *
 * WHAT KIND OF BEAT IT IS
 *
 * There are two ceremonies in this game already and this is neither of them.
 *
 *   · THE RITE (`rite.js`) belongs to rank. Letterbox, sparks, a name arriving
 *     too big and settling. Scarce, and it must stay scarce.
 *   · THE CHAPTER PLATE (`turn.js`) belongs to the story clock. A rule draws
 *     itself across the frame, nothing dims, the controls are never taken, and
 *     you can be running when it happens.
 *
 * A region opening is rarer than a chapter and commoner than a rank, and it is
 * about the WORLD rather than about the learner — so it borrows the chapter's
 * gesture (running through it is exactly right; the horizon is the subject) and
 * gets the rite's rarity. It takes the same queue, waits for the same frame,
 * and is skipped by the same key. One plate, two kinds of words.
 *
 * IT IS NEVER A LESSON NUMBER. "Level 2" is a label out of a syllabus and this
 * game teaches invisibly (BRIEF invariant 4). What the plate says is the name
 * of a place, what Marlow says is that ground is being written out there, and
 * what the close card says is where the next run lands. The unit id never
 * reaches the glass.
 *
 * WHEN THE GROUND ACTUALLY APPEARS
 *
 * The island is raised once, at planetfall, by `src/world` — so a region earned
 * in the middle of a run is announced now and stood on at the next landing.
 * That is not a compromise, it is the shape of the thing: a session is a
 * Pomodoro with an ending, and "we land there on the next run" is a reason to
 * come back rather than a loading screen. `crossing()` below is what a learner
 * who wants it now presses, and it is the same call the pause menu's own
 * restart already makes.
 */
import { ROUTE, regionEarned, routeState, seatedUnits } from '../content/index.js';

/** Shared copy: the words over the rule, and the three lines under it. */
export const REGION_KICK = 'story.region.kick';
export const REGION_LINES = ['story.region.open1', 'story.region.open2', 'story.region.open3'];
export const REGION_ARRIVE = 'story.region.arrive';

/** The name of a region, as a place. Never the unit id, never a level number. */
export function regionName(unitId) { return `story.region.${unitId}.name`; }
/** One line about the kind of ground it is. */
export function regionWhat(unitId) { return `story.region.${unitId}.ground`; }

/**
 * Has this learner earned a region that is not on the island yet?
 *
 * Read off the live engine, so the beat can fire on the answer that bought it.
 * Returns the unit id of the first such region, or null.
 *
 * @param {object} mastery the live MasteryEngine
 */
export function earnedRegion(mastery) {
  try {
    const found = regionEarned(mastery, seatedUnits(mastery?.graph));
    return found ? found.unit : null;
  } catch { return null; }
}

/**
 * Which region the learner is standing in — the last one seated on the island.
 * The close card names it when it says where the next run begins.
 */
export function currentRegion(mastery) {
  try {
    const on = seatedUnits(mastery?.graph);
    return on.length ? on[on.length - 1] : null;
  } catch { return null; }
}

/**
 * How far the next region is, in lines. Never a percentage: a fraction of a
 * lattice is the one number this game already has (`progress.js`), and a second
 * one under a different name is the defect that file exists to prevent.
 *
 * @returns {{unit:string, owed:number}|null}
 */
export function nextRegion(mastery) {
  try {
    const held = new Set();
    for (const [id, s] of mastery?.state || []) if (s?.everMastered) held.add(id);
    const st = routeState(ROUTE.course, { held, evidence: held }, seatedUnits(mastery?.graph));
    if (!st.next) return null;
    return { unit: st.next.unit, owed: st.next.owed.length };
  } catch { return null; }
}

/**
 * MAKE PLANETFALL IN THE NEW REGION.
 *
 * The world is built once, at boot, from the lattice the route hands it. So the
 * crossing is a landing: the record is already on disk (`src/main.js` writes it
 * on every answer), and the island is raised again with the new ground on it.
 * Nothing is cleared and nothing is lost — this is the same call the pause
 * menu's own restart makes, without the part that throws the save away.
 */
export function crossing() {
  try { location.reload(); } catch { /* no window: a tool asked, and nothing happens */ }
}
