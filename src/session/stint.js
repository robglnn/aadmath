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
 * WHAT HAPPENS BETWEEN THE ITEMS OF ONE STINT — the second correction.
 *
 * Three items per arrival fixed the twelve-item marathon and left a smaller
 * version of the same defect standing, which the next cold critic duly found:
 *
 *   "six items that opened with no travel at all (chained inside proving runs)"
 *
 * He is right, and the arithmetic is not survivable. If one arrival is one
 * decision and the two items after it arrive on a 460 ms timer, then two thirds
 * of every learning card in the game opened because the game decided it should.
 * No amount of tuning the number three inverts that ratio; only moving the
 * decision does.
 *
 * So the chain is now an OFFER rather than an action. When an item is finished
 * and the stint has more to give, the tear does not re-open itself — it stays
 * live, keeps the plate and the key it already carries (src/world/afford.js),
 * and waits. One press of the interact key, standing exactly where you are,
 * continues the stint: same tear, same run of items, no travel, no penalty,
 * and `arrive()` deliberately does not reset the count. Walk away instead and
 * the stint simply ends.
 *
 * The mathematics is untouched — the same three items on the same line, still
 * interleaved by the same scheduler. What changed is who says "again": the
 * cadet, three times, instead of a timer, twice.
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
/**
 * Seconds a cadet may be away from a held tear before the offer of the next
 * item lapses and the world moves on. Long enough to step back, look around and
 * change your mind; short enough that walking off really does mean leaving.
 */
const LEAVE = 2.5;

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
  /**
   * The stint has items left and is waiting for the cadet to ask for the next
   * one. Nothing happens while this is true: the world is theirs, the tear is
   * lit, and the only two things that can move are their key and their boots.
   */
  let holding = false;
  /** Seconds spent standing off the tear while holding, before it lets go. */
  let away = 0;
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
    // Continuing a held stint is the same stint, not a new one: the count
    // carries, which is what makes "three items per arrival" still true when
    // the cadet is the one asking for each of them.
    holding = false;
    away = 0;
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
  /**
   * An item finished and there are more in this stint. Hold the offer open.
   *
   * Called by `src/main.js` instead of the 460 ms chain timer it used to arm.
   * Nothing here opens anything — that is the entire point.
   */
  function hold() {
    if (!riftId || ended) return;
    holding = true;
    away = 0;
  }

  /**
   * Is this tear mid-stint, waiting to be asked for the next item? Read by the
   * affordance layer, so the plate on the tear can say CONTINUE rather than
   * OPEN — the same key, an honest verb.
   */
  function holdingAt(id) { return holding && !ended && id === riftId; }

  /**
   * Called every frame with the tear the cadet is standing at, or null.
   *
   * An offer nobody takes has to expire, or the world never hands back the
   * next destination and `src/meta/relay.js` never speaks. Walking off the
   * dais is the answer "no thanks", and it is read exactly that way: a couple
   * of seconds away from the tear and the stint closes itself out normally,
   * relay line and all. Standing on it costs nothing and waits forever.
   */
  function watch(nearId, dt) {
    if (!holding || ended) return;
    if (nearId === riftId) { away = 0; return; }
    away += dt;
    if (away >= LEAVE) end();
  }

  function end() {
    if (!riftId || ended) return;
    ended = true;
    holding = false;
    away = 0;
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
    arrive, sealed, more, end, settling, update, hold, holdingAt, watch,
    /** Everything a critic needs, off one call. */
    state: () => ({ riftId, n, of: items, ended, holding, settling: [...cooling.keys()] }),
    reset() { riftId = null; n = 0; ended = false; holding = false; away = 0; cooling.clear(); },
  };
}
