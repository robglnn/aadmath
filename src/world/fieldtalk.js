/**
 * ONE OFF-ISLAND SITE TALKS AT A TIME — across the three families, not inside
 * each of them.
 *
 * THE DEFECT, PHOTOGRAPHED. `shots/laneC-crack/05-level-beam.png`: a cadet is
 * standing on a hanging cache's pier at the instant it opens — the resolution
 * beat `src/world/caches.js` spent a whole wave building — and the left of the
 * glass carries **CROSSING LOCK · 2x + 2y = 22**, which is MEET 2's statement,
 * sixty-nine metres away. Two off-island sites are talking, and one of them is
 * putting a different equation beside the balance the cadet has just made
 * level. Nothing anywhere decided which of them owned the frame.
 *
 * Each of the three files had already fixed this INSIDE itself and written
 * down that it had:
 *
 *   · `src/world/caches.js`  — *"only the NEAREST unopened cache says anything
 *     at all"*;
 *   · `src/world/span.js`    — *"ONE PLOT TALKS"*, and its own header already
 *     names the case it could not fix from inside: *"a hanging cache that
 *     stands 59 m from span 1"*;
 *   · `src/world/meet.js`    — the same rule again, for meets.
 *
 * Three arbiters, each authoritative over one family, is the same thing as no
 * arbiter — which is exactly what `design/ARCHIPELAGO-PATTERN.md` Build Note 3
 * says, and it says it about the whole class: *".field-tag is CHROME to
 * src/world/tagspace.js — nothing arbitrates it. You must arbitrate it
 * yourself."* `src/world/waygate.js` paid 452 label overlaps across 126 of 288
 * layout frames before anybody wrote that down.
 *
 * WHAT THIS IS NOT. It is not a second tag ledger. `tagspace.js` still decides
 * where a label goes and still drops one rather than print it through another;
 * this decides, one step earlier, WHICH SITE IS ALLOWED TO ASK. The two answer
 * different questions and neither can be expressed in the other.
 *
 * HOW IT DECIDES, AND WHY IT IS THE PREVIOUS FRAME'S ANSWER.
 *
 * `src/main.js` runs the three families in a row inside one frame — `caches`,
 * `spans`, `meets`, all handed the same `time` — and each one draws
 * immediately after it decides. So the first family to run cannot know what
 * the third is about to bid, and any answer computed inside one frame is
 * either a lag or a second pass over the DOM. `tagspace.js` settled this shape
 * already with `servedLast`: use the frame that has just finished. A site does
 * not move, the camera moves about a centimetre a frame, and the only frame
 * where the two answers differ is the single one where the ranking flips —
 * which is one sixtieth of a second, at a distance where both labels are
 * fading anyway.
 *
 * THE FAMILIES THIS ARBITRATES, AND THE ONES IT DELIBERATELY DOES NOT.
 * The three places that hang off the coast: a hanging cache, a span, a meet.
 * `src/world/waygate.js` stands ON the road and `src/world/warden.js` runs a
 * circuit across the island — neither is off-island, both are somewhere a
 * cadet is already going, and both already own their own rule. Widening this
 * to them is a decision somebody should take by walking the road, not a line
 * somebody adds because the module was there.
 */

/** The frame the bids below belong to. */
let frame = -1;
/** The best bid so far in THIS frame: who, and how far off the camera. */
let bestId = null;
let bestD = Infinity;
/** Who won the frame that has just finished. This is who may talk. */
let speaker = null;

/**
 * Bid for the frame, and be told whether this family owns the glass.
 *
 * @param {number} time    the engine's own clock, identical for every family
 *                         inside one frame
 * @param {string} id      'cache' | 'span' | 'meet' — the family, not the site
 * @param {number} dist    metres from the camera to the nearest instance of
 *                         this family that still has something to say
 * @returns {boolean} true if this family may print its labels this frame
 */
export function bidField(time, id, dist) {
  if (time !== frame) {
    frame = time;
    speaker = bestId;
    bestId = null;
    bestD = Infinity;
  }
  if (dist < bestD) { bestD = dist; bestId = id; }
  /* NOBODY WON THE LAST FRAME — the first frame after boot, or a frame in
     which not one site anywhere had something to say. Fall back to the best
     bid SO FAR in this frame: that can over-serve by one label for one frame,
     and never for two, whereas refusing everybody would mean the very first
     frame a site is close enough to read is a frame it says nothing in.
     THE HANDOVER COSTS ONE FRAME AND IT IS SAID OUT LOUD: when the family
     holding the mic stops bidding — its last site solved — the next family is
     refused for that one frame and speaks on the next. One frame is sixteen
     milliseconds; a caption that flickers between two owners every frame is
     the defect this module exists to remove, and it is the more expensive of
     the two. */
  return speaker === null ? id === bestId : speaker === id;
}

/** For a harness that tears the page down and builds a second one. */
export function resetFieldTalk() {
  frame = -1;
  bestId = null;
  bestD = Infinity;
  speaker = null;
}

/** What a critic may read, and it makes nothing happen. */
export const fieldTalkState = () => ({ speaker, bestId, bestD, frame });
