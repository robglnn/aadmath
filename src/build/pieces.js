/**
 * The shape of an axiom piece, as pure numbers.
 *
 * Both halves of the build system read this file and nothing else: the renderer
 * turns a spec into geometry, the collider turns the same spec into a surface
 * the cadet's boots can find. Keeping them on one description is the only way a
 * ramp you can see is guaranteed to be a ramp you can climb — the previous
 * builder drew slabs that the player's heightfield knew nothing about, which is
 * why you fell through everything you made.
 *
 * Local frame: +z is the direction the cadet was facing when the piece was set,
 * +x is to his right, and the piece's *base* is the level it was founded on.
 */

export const CELL = 4;                 // metres per lattice cell
/**
 * The fifth kind, `vault`, is not in the cadet's hands at the start of the game.
 * It is the first thing a sealed line buys (src/kit/kit.js), and it is the
 * reason the hotbar grows: a plate you stand on that throws you twenty metres
 * straight up. Everything in this file treats it as an ordinary deck — it is
 * founded, collided and stood on exactly like a floor — because the *capability*
 * is what the unlock hands over, not a new set of rules to learn.
 */
export const KINDS = ['wall', 'ramp', 'floor', 'beam', 'vault'];

/**
 * `lo`/`hi` are the vertical span relative to the piece origin; `hx`/`hz` the
 * footprint half-extents. Collision footprints are a little fatter than the
 * drawn metal so a sprint cannot thread a 30 cm wall between two frames.
 */
export const SPEC = {
  wall:  { hx: 2.0, hz: 0.36, lo: -2.0,  hi: 2.0,  cost: 9,  drop: 2.0 },
  floor: { hx: 2.0, hz: 2.0,  lo: -0.18, hi: 0.18, cost: 9,  drop: 0.0 },
  beam:  { hx: 2.0, hz: 0.34, lo: -0.24, hi: 0.24, cost: 7,  drop: 2.2 },
  ramp:  { hx: 2.0, hz: 2.0,  lo: 0.0,   hi: 4.0,  cost: 11, drop: 0.0 },
  // The vault plate. A deck by every rule the collider knows, plus a launch it
  // spends shards on — see SHARD_COST and src/kit/kit.js.
  vault: { hx: 2.0, hz: 2.0,  lo: -0.18, hi: 0.22, cost: 10, drop: 0.0 },
};

/**
 * What a piece costs in *shards* on top of lattice charge.
 *
 * Charge is the rhythm of building; shards are the mathematics. A kit piece is
 * paid for out of the same ledger correct answers fill, which is what stops the
 * best tool in the game from being free.
 *
 * The number is a *starting* price and the kit rewrites it: eighteen when the
 * plate is first held, six once PLATE ARRAY is (src/kit/kit.js). Read it, never
 * cache it — a price that changes is the point.
 */
export const SHARD_COST = { vault: 18 };

/** Pieces the cadet has before he has proved anything. */
export const BASE_KINDS = ['wall', 'ramp', 'floor', 'beam'];

/** Where a piece origin goes, given the level its base sits on. */
export function originY(kind, base) {
  return base + SPEC[kind].drop;
}

/** Cell key for a world column. Every footprint lives inside exactly one cell. */
export function cellKey(x, z) {
  return `${Math.round(x / CELL)},${Math.round(z / CELL)}`;
}

/** World delta -> piece-local. Yaw is always a multiple of 90°, so this is exact. */
export function toLocal(p, x, z, out) {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  const dx = x - p.x, dz = z - p.z;
  out.lx = c * dx - s * dz;
  out.lz = s * dx + c * dz;
  return out;
}

const _l = { lx: 0, lz: 0 };

/** Does this column fall inside the piece's footprint? */
export function covers(p, x, z, pad = 0) {
  const sp = SPEC[p.kind];
  toLocal(p, x, z, _l);
  return Math.abs(_l.lx) <= sp.hx + pad && Math.abs(_l.lz) <= sp.hz + pad;
}

/**
 * The walkable surface of a piece at a column, or null if the column misses it.
 * A ramp is the only piece whose top varies across its footprint: it climbs one
 * full cell over one full cell, a 45° stair — steep enough to gain height fast,
 * shallow enough that the locomotion's slope limit lets you run up it.
 */
export function surfaceAt(p, x, z) {
  const sp = SPEC[p.kind];
  toLocal(p, x, z, _l);
  if (Math.abs(_l.lx) > sp.hx || Math.abs(_l.lz) > sp.hz) return null;
  if (p.kind === 'ramp') {
    const t = p.y + clamp(_l.lz + sp.hz, 0, sp.hi);
    return { top: t, bottom: t - 0.42 };
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

/**
 * dH/dx, dH/dz of the piece's top surface. Flat for everything but a ramp,
 * whose fall line points back down the way you came.
 */
export function gradOf(p, out) {
  if (p.kind !== 'ramp') return out.set(0, 0);
  return out.set(Math.sin(p.yaw), Math.cos(p.yaw));
}

/** Axis-aligned bounds in world space, for picking and for the camera. */
export function boundsOf(p, out) {
  const sp = SPEC[p.kind];
  const c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
  const ex = sp.hx * c + sp.hz * s;
  const ez = sp.hx * s + sp.hz * c;
  out.min.set(p.x - ex, p.y + sp.lo, p.z - ez);
  out.max.set(p.x + ex, p.y + sp.hi, p.z + ez);
  return out;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
