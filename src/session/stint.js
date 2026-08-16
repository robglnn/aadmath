/**
 * THE STINT — how many questions one arrival at a rift is worth.
 *
 * A cold critic played fifteen minutes and wrote down the exact shape of the
 * defect:
 *
 *   "From 01:16 to 11:30 I answered twelve consecutive items inside a modal
 *    card without ever choosing to return to the 3D world — sealing a rift
 *    auto-opens the next card, so there is no beat where I decide what to do."
 *
 * He is describing four lines in `src/main.js`. A correct answer set
 * `chainNext = true`, the panel shut itself 2.9 s after the seal, and 460 ms
 * later the SAME rift opened the SAME card again. Ten minutes of a 3-D game
 * were spent on a keypad, and every single one of those transitions was the
 * game's decision rather than the player's.
 *
 * This module is the rule that ends that, and it is one sentence:
 *
 *   **One arrival at a tear buys THREE items. Then the world comes back.**
 *
 * Three, not one, because the other failure mode is real too: a walk of forty
 * metres per question is not a rhythm either, it is an obstacle course with
 * arithmetic in it, and the mastery engine needs runs of items on one line to
 * read anything at all. Three is one coherent piece of work — long enough that
 * the scheduler can interleave and short enough that nobody is ever eleven
 * items deep in a card they did not choose to still be in.
 *
 * WHAT HAPPENS WHEN A STINT ENDS
 *   · the panel closes for real: no chained card, no 460 ms timer;
 *   · the tear **settles** for a few seconds — walking across its plate will
 *     not pull you back in, so the way out of a rift is not a corridor back
 *     into it. The interact key still works the whole time, because a player
 *     who *wants* another three is making a choice and this module's entire
 *     purpose is that the choice exists;
 *   · `onEnd` fires, and `src/world/errand.js` lights the next place worth
 *     walking to.
 *
 * WHAT IT DELIBERATELY IS NOT. It is not a cap on how much mathematics a
 * session contains — a run is still sized in tears by `estimate.js` and a
 * learner can work six stints at one tear back to back if they keep pressing
 * the key. It is a cap on how much happens **without a decision in between**.
 */

/** Items one arrival is worth. */
const ITEMS = 3;
/**
 * Seconds a tear stays settled after a stint. Long enough to walk off the dais
 * and mean it; short enough that a player who turns straight round and presses
 * the key is never refused — the key is never blocked at all, only the boots.
 */
const SETTLE = 9;

export function createStint(opts = {}) {
  const {
    items = ITEMS,
    settle = SETTLE,
    /**
     * Fired once, when a stint fills and the world is handed back.
     * `src/meta/relay.js` is on the other end of it: it decides where the
     * player is now pointed, and says the rhythm out loud the first time.
     */
    onEnd = () => {},
  } = opts;

  let riftId = null;      // the tear this stint belongs to
  let n = 0;              // items worked in it
  let ended = false;      // has this stint already handed the world back
  /** id -> seconds of settle left. */
  const cooling = new Map();

  /**
   * A rift is being opened. Called at the top of the one function that opens
   * one, so that every path — the plate, the key, the touch tag, the chain —
   * arrives here and nothing can start a stint behind this module's back.
   */
  function arrive(id) {
    if (id !== riftId || ended || n >= items) {
      riftId = id;
      n = 0;
      ended = false;
    }
    // Pressing the key on a settling tear is a choice, and a choice ends the
    // settle: the world should not go on telling you to leave a place you have
    // just decided to stay at.
    cooling.delete(id);
  }

  /**
   * One item was FINISHED at this tear.
   *
   * Called on a correct answer only, and that is not an accounting nicety. A
   * card stays on the surface until it comes out right — a wrong answer buys a
   * worked echo aimed at the misconception the learner just revealed and then
   * asks again — so counting attempts would eject a struggling cadet from the
   * one line they most need to stay on, after three misses, having sealed
   * nothing. The product brief is explicit that a learner who is struggling
   * "stays on that topic until it is mastered". A stint is three *pieces of
   * work done*, however many tries each of them took.
   */
  function sealed() {
    if (riftId) n++;
  }

  /**
   * May the loop open another card at this tear without being asked?
   *
   * This is the whole contract. `src/main.js` chains only while this is true.
   */
  function more() {
    return !!riftId && !ended && n < items;
  }

  /**
   * The stint is over: the panel has closed and the frame belongs to the world
   * again. Idempotent, because a panel can close for several reasons at once.
   */
  function end() {
    if (!riftId || ended) return;
    ended = true;
    if (settle > 0) cooling.set(riftId, settle);
    try { onEnd(riftId); } catch { /* a beat must never stop the loop */ }
  }

  /**
   * Is this tear settled? Asked by `src/world/beckon.js` before a walk-in
   * opens anything. Never asked about the interact key.
   */
  function settling(id) {
    return (cooling.get(id) || 0) > 0;
  }

  function update(dt) {
    if (!cooling.size) return;
    for (const [id, left] of cooling) {
      const v = left - dt;
      if (v <= 0) cooling.delete(id); else cooling.set(id, v);
    }
  }

  return {
    arrive, sealed, more, end, settling, update,
    /** Everything a critic needs, off one call. */
    state: () => ({ riftId, n, of: items, ended, settling: [...cooling.keys()] }),
    reset() { riftId = null; n = 0; ended = false; cooling.clear(); },
  };
}
