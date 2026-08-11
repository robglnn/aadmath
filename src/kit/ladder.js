/**
 * THE LADDER — what a held line buys, and at what depth.
 *
 * Split out of `kit.js` so that it can be read by things that cannot load a
 * browser module: tools/simulate.mjs prints the sitting each of these lands on
 * for a learner who comes back daily, which is the only honest way to answer
 * "when does a player actually get the wing?" — and a table of thresholds that
 * only the game can read is a table nobody ever checks.
 *
 * DEPTH is lines held plus every spaced re-probe those lines have survived
 * **across a real walk away from the machine** (`mastery.durableCount()`). The
 * first six rungs are keyed to lines alone and land in the first sitting. The
 * six above them are keyed to depth, and since depth's second term cannot move
 * inside a sitting at all, they cannot be bought by grinding — only by coming
 * back and finding that what you knew is still there.
 */

/** Lines held → the first six. Nothing here can be earned twice. */
export const LINE_GRANTS = [
  { id: 'vault', lines: 1 },
  { id: 'flare', lines: 2 },
  { id: 'kite', lines: 3 },
  { id: 'reserve', lines: 4 },
  { id: 'legs', lines: 5 },
  { id: 'sight', lines: 6 },
];

/** Depth → the six that only a returning player reaches, and then the verb. */
export const DEPTH_GRANTS = [
  { id: 'beacon', depth: 13 },
  { id: 'windstep', depth: 18 },
  { id: 'span', depth: 26 },
  { id: 'array', depth: 33 },
  { id: 'squall', depth: 39 },
  { id: 'deepwell', depth: 44 },
  // The thirteenth rung is not a capability, it is a licence: the right to
  // raise a waystation, and with it the only part of this ladder that does not
  // end. See CHARTER_EVERY.
  { id: 'station', depth: 46 },
];

export const GRANT_LADDER = [...LINE_GRANTS, ...DEPTH_GRANTS];

/**
 * Past the last rung the ladder stops being a ladder and becomes a rate.
 *
 * Every `CHARTER_EVERY` further points of depth is one charter: the right to
 * raise one waystation, which costs `STATION_PRICE` shards on top and is the
 * only permanent, hand-placed, map-changing thing in the game. At the steady
 * state of a ten-line lattice — every line on the top rung of the spacing
 * ladder, so a couple falling due a day — five points of depth is about three
 * days of coming back. A player who keeps coming back is never more than a few
 * days from the next one, and a player who stops earns none, which is the
 * entire argument.
 */
export const CHARTER_EVERY = 5;
export const STATION_PRICE = 240;

/** Depth at which the first charter is granted. */
export const CHARTER_FROM = DEPTH_GRANTS[DEPTH_GRANTS.length - 1].depth;

/** How many charters a given depth has earned, total, ever. */
export function chartersAt(depth) {
  if (!(depth > CHARTER_FROM)) return 0;
  return Math.floor((depth - CHARTER_FROM) / CHARTER_EVERY);
}

/** Depth at which the nth charter (1-based) arrives. */
export function charterAt(n) {
  return CHARTER_FROM + CHARTER_EVERY * Math.max(1, n | 0);
}
