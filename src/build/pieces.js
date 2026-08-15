/**
 * THE LATTICE CONTRACT — the shape of an axiom piece, as pure numbers.
 *
 * Both halves of the build system read this file and nothing else: the renderer
 * turns a spec into geometry, the collider turns the same spec into a surface
 * the cadet's boots can find. Keeping them on one description is the only way a
 * ramp you can see is guaranteed to be a ramp you can climb.
 *
 * ---------------------------------------------------------------------------
 * WHY THE OLD LATTICE COULD NOT CLOSE A CORNER
 *
 * A player asked why walls never meet corner to corner. They could not: every
 * kind was placed at a *cell centre*. Two walls at right angles therefore either
 * crossed in the middle of one cell (a plus sign, not a corner) or sat in two
 * different cells four metres apart with nothing between them. There was no such
 * thing as a cell *face*, so there was no such thing as a corner to close.
 *
 * Three further things broke every other joint:
 *
 *  - **Levels were raw terrain floats.** `groundAt` is a smooth heightfield, so
 *    two neighbouring cells founded pieces at heights that differed by whatever
 *    the noise happened to say. Adjacent walls stepped; nothing was ever flush.
 *  - **Decks straddled their level.** A floor ran from `base - 0.18` to
 *    `base + 0.18`, so a floor capping a wall buried a quarter of a metre of
 *    itself in the wall's head, and a wall standing on a floor started a fifth
 *    of a metre below the surface you were walking on.
 *  - **The collider indexed a piece by the single cell its centre fell in.** A
 *    four-metre wall reaches into two cells; from one side of it the boots asked
 *    the wrong cell and found nothing, and you walked through your own wall.
 *
 * ---------------------------------------------------------------------------
 * WHAT REPLACES IT
 *
 * One three-dimensional lattice that every piece is a citizen of.
 *
 *  - **Cells** are `CELL` metres square, centred on multiples of `CELL`.
 *    Floors, ramps and vault plates fill a cell: their footprint is exactly the
 *    cell, so two neighbours butt along a shared edge with nothing between them
 *    and nothing on top of each other.
 *  - **Faces** are the lines between cells, at odd multiples of `CELL / 2`.
 *    Walls and beams live on faces, spanning one full cell edge, thin across it.
 *    Four walls therefore close a square around one cell — and, because a wall
 *    ends exactly on the lattice *node*, the corner is filled by a post that the
 *    renderer draws once per node however many walls arrive at it.
 *  - **Levels** are the walking planes, quantised to `Q` (a power of two, so the
 *    arithmetic is exact and repeatable). A storey is `LEVEL` metres — the same
 *    number as `CELL`, which is what lets a wall's head be a floor's deck.
 *  - **A deck's top IS its level** (`hi = 0`). A wall runs from its level to one
 *    storey above (`lo = -LEVEL/2, hi = +LEVEL/2` about a centred origin). A
 *    ramp climbs one full storey across one full cell. So: floor at L, wall
 *    founded at L stands on it; wall founded at L, floor at L + LEVEL caps it;
 *    ramp founded at L arrives at exactly L + LEVEL, which is a floor's level.
 *
 * Local frame: +z is the direction the cadet was facing when the piece was set,
 * +x is to his right, and the piece's *base* is the level it was founded on.
 */

/** Metres per lattice cell — and, deliberately, metres per storey. */
export const CELL = 4;
/** One storey. A wall is this tall; a ramp climbs exactly this much. */
export const LEVEL = 4;
/**
 * Level quantum. A power of two, so `Math.round(v * Q) / Q` is exact in binary
 * and two pieces founded from the same terrain height get the *same* float, not
 * two floats that differ in the last bit and leave a hairline you can see.
 */
export const Q = 64;
/** Wall / beam thickness across the face, total. */
export const WALL_T = 0.44;
/** How thick a deck hangs below the surface you walk on. */
export const DECK_T = 0.375;
/** Cross-section of the post that closes a lattice node. Proud of a wall. */
export const NODE_T = 0.52;

/**
 * The fifth kind, `vault`, is not in the cadet's hands at the start of the game.
 * It is the first thing a sealed line buys (src/kit/kit.js). Everything here
 * treats it as an ordinary deck — founded, collided and stood on exactly like a
 * floor — because the *capability* is what the unlock hands over, not a new set
 * of rules to learn.
 */
export const KINDS = ['wall', 'ramp', 'floor', 'beam', 'vault'];

/** Pieces the cadet has before he has proved anything. */
export const BASE_KINDS = ['wall', 'ramp', 'floor', 'beam'];

/**
 * Which lattice slot a kind occupies.
 *   `edge` — a cell face: position is on the half-grid across one axis.
 *   `deck` — a whole cell, walking surface on top.
 *   `ramp` — a whole cell, climbing one storey across it.
 * Two pieces of the same class may never share a slot; different classes may,
 * because a ramp resting on a deck is a thing people build on purpose.
 */
export const CLASS = {
  wall: 'edge', beam: 'edge', floor: 'deck', vault: 'deck', ramp: 'ramp',
};

export const isEdge = (kind) => CLASS[kind] === 'edge';

/**
 * `lo`/`hi` are the vertical span relative to the piece origin; `hx`/`hz` the
 * footprint half-extents in the piece's own frame. `drop` lifts the origin off
 * the level the piece was founded on, so that `lo` lands where the piece's own
 * geometry starts.
 *
 * Read the vertical column of this table as the promise the joints depend on:
 *
 *   wall   base … base + 4      (drop 2, span ±2 about a centred origin)
 *   ramp   base … base + 4      (climbs; top at the far edge is base + 4)
 *   floor  base - 0.375 … base  (the deck's TOP is the level)
 *   vault  base - 0.375 … base  (a deck by every rule the collider knows)
 *   beam   base + 1.64 … base+2 (a rail at half a storey, top on the half-line)
 *
 * Footprints are exact — hx is half a cell, hz is half a cell or half a wall —
 * except for a hair of pad across a wall, so a sprint cannot thread a
 * thirty-centimetre wall between two frames.
 */
export const SPEC = {
  wall:  { hx: 2.0, hz: 0.26, lo: -2.0, hi: 2.0, drop: 2.0, cost: 9, rise: 0 },
  floor: { hx: 2.0, hz: 2.0, lo: -DECK_T, hi: 0, drop: 0, cost: 9, rise: DECK_T },
  beam:  { hx: 2.0, hz: 0.26, lo: -0.36, hi: 0, drop: 2.0, cost: 7, rise: 0 },
  ramp:  { hx: 2.0, hz: 2.0, lo: 0, hi: 4.0, drop: 0, cost: 11, rise: 0 },
  vault: { hx: 2.0, hz: 2.0, lo: -DECK_T, hi: 0, drop: 0, cost: 10, rise: DECK_T },
};

/**
 * What a piece costs in *shards* on top of lattice charge.
 *
 * Charge is the rhythm of building; shards are the mathematics. The number is a
 * *starting* price and the kit rewrites it: eighteen when the plate is first
 * held, six once PLATE ARRAY is (src/kit/kit.js). Read it, never cache it.
 */
export const SHARD_COST = { vault: 18 };

// ---------------------------------------------------------------------------
// the lattice arithmetic
// ---------------------------------------------------------------------------

/** Snap a level onto the vertical lattice. Exact: Q is a power of two. */
export function qLevel(v) { return Math.round(v * Q) / Q; }

/** Quarter turns, as exact cosines and sines. `Math.cos(Math.PI/2)` is not 0. */
export const TURNS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Fold any yaw onto one of the four quarter turns. */
export function snapTurn(yaw) {
  return ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
}

export function turnOf(p) {
  return p.turn === undefined ? snapTurn(p.yaw || 0) : (((p.turn % 4) + 4) % 4);
}

/** Which cell index a world coordinate falls in. Cell k spans [4k-2, 4k+2). */
export function cellIndex(v) { return Math.floor(v / CELL + 0.5); }

/**
 * The slot a piece would occupy — class, position on the half-grid, level.
 * Two pieces with the same key are the same piece of structure, which is the
 * only occupancy test the builder needs and the reason "already built there"
 * now means something exact.
 */
export function slotKey(kind, x, z, base) {
  return `${CLASS[kind]}:${Math.round(x * 2)}:${Math.round(z * 2)}:${Math.round(base * Q)}`;
}

/** Where a piece origin goes, given the level its base sits on. */
export function originY(kind, base) {
  return base + SPEC[kind].drop;
}

/** World delta -> piece-local. Quarter turns only, so this is exact. */
export function toLocal(p, x, z, out) {
  const [c, s] = TURNS[turnOf(p)];
  const dx = x - p.x, dz = z - p.z;
  out.lx = c * dx - s * dz;
  out.lz = s * dx + c * dz;
  return out;
}

const _l = { lx: 0, lz: 0 };

/**
 * THE DOORWAY.
 *
 * A wall carrying `door` has an opening cut through the middle of it. It is the
 * whole answer to being shut in: the last wall of a room you are standing in is
 * still placed — the square closes, the corners meet, the shape is the shape you
 * asked for — and it arrives with a way out already in it.
 *
 * The opening is the full height of the wall to the collider, not just to head
 * height. A lintel you can stand on is a ledge eighteen centimetres deep at the
 * top of a doorway, which nobody has ever wanted and which would need its own
 * step-up rule; the header above the opening is therefore drawn and not
 * collided. From inside the room, the only thing that changes is that you can
 * walk out.
 */
/**
 * Half-width of the opening. The cadet's capsule is 0.42 m in radius, so a
 * 0.90 m half-width leaves him 0.96 m of clear floor to thread — under a metre,
 * for a door he is walking at under pressure, having just closed the room. He
 * gets shoved back out by the jamb as often as he gets through. 1.15 leaves
 * 1.46 m, which is a doorway rather than a gap between two pieces of furniture,
 * and still leaves a 0.59 m panel each side so it reads as a wall with a door
 * in it rather than as two posts.
 */
export const DOOR_HX = 1.15;
/** Where the drawn header starts, measured up from the wall's own base. */
export const DOOR_H = 2.60;

/** Is this column inside the doorway of a door wall? */
export function inDoor(p, lx) {
  return !!p.door && Math.abs(lx) <= DOOR_HX;
}

/** Does this column fall inside the piece's footprint? */
export function covers(p, x, z, pad = 0) {
  const sp = SPEC[p.kind];
  toLocal(p, x, z, _l);
  if (Math.abs(_l.lx) > sp.hx + pad || Math.abs(_l.lz) > sp.hz + pad) return false;
  // The doorway is a hole, so the piece does not cover the column at all. `pad`
  // grows the footprint, and the same growth has to shrink the opening, or a
  // capsule half inside the jamb would report itself clear and walk through it.
  return !inDoor(p, _l.lx + (_l.lx < 0 ? -pad : pad));
}

/**
 * The walkable surface of a piece at a column, or null if the column misses it.
 * A ramp is the only piece whose top varies across its footprint: it climbs one
 * full storey over one full cell, a 45° stair — steep enough to gain height
 * fast, shallow enough that the locomotion's slope limit lets you run up it.
 * At the far edge its top is `base + LEVEL` exactly, which is a deck's level.
 */
export function surfaceAt(p, x, z) {
  const sp = SPEC[p.kind];
  toLocal(p, x, z, _l);
  if (Math.abs(_l.lx) > sp.hx || Math.abs(_l.lz) > sp.hz) return null;
  if (inDoor(p, _l.lx)) return null;
  if (p.kind === 'ramp') {
    const t = p.y + clamp(_l.lz + sp.hz, 0, sp.hi);
    return { top: t, bottom: t - 0.48 };
  }
  return { top: p.y + sp.hi, bottom: p.y + sp.lo };
}

/** Full vertical span of a piece at a column — used for support tests. */
export function spanAt(p, x, z) {
  const sp = SPEC[p.kind];
  if (!covers(p, x, z)) return null;
  if (p.kind === 'ramp') {
    const s = surfaceAt(p, x, z);
    return s && { lo: s.bottom, hi: s.top };
  }
  return { lo: p.y + sp.lo, hi: p.y + sp.hi };
}

/** The whole piece's vertical extent, regardless of column. */
export function fullSpan(p) {
  const sp = SPEC[p.kind];
  return { lo: p.y + sp.lo, hi: p.y + sp.hi };
}

/** The level a piece was founded on, recovered from its origin. */
export function baseOf(p) {
  return p.base !== undefined ? p.base : p.y - SPEC[p.kind].drop;
}

/**
 * dH/dx, dH/dz of the piece's top surface. Flat for everything but a ramp,
 * whose fall line points back down the way you came.
 */
export function gradOf(p, out) {
  if (p.kind !== 'ramp') return out.set(0, 0);
  const [c, s] = TURNS[turnOf(p)];
  return out.set(s, c);
}

/** Axis-aligned bounds in world space, for picking and for the camera. */
export function boundsOf(p, out) {
  const sp = SPEC[p.kind];
  const [c0, s0] = TURNS[turnOf(p)];
  const c = Math.abs(c0), s = Math.abs(s0);
  const ex = sp.hx * c + sp.hz * s;
  const ez = sp.hx * s + sp.hz * c;
  out.min.set(p.x - ex, p.y + sp.lo, p.z - ez);
  out.max.set(p.x + ex, p.y + sp.hi, p.z + ez);
  return out;
}

/** The two lattice nodes a face piece ends on — where a corner has to close. */
export function endNodes(p, out) {
  const [c, s] = TURNS[turnOf(p)];
  const hx = SPEC[p.kind].hx;
  out[0] = p.x + c * hx; out[1] = p.z - s * hx;
  out[2] = p.x - c * hx; out[3] = p.z + s * hx;
  return out;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
