import * as THREE from 'three';
import {
  CELL, LEVEL, SPEC, CLASS, TURNS, turnOf, cellIndex, slotKey, surfaceAt, spanAt,
  fullSpan, gradOf, covers, boundsOf, baseOf, qLevel,
} from './pieces.js';

/**
 * The lattice, as far as the cadet's boots are concerned.
 *
 * The player moves over a heightfield, so the cheapest honest way to make built
 * pieces real is to *become part of that heightfield*: `src/player/terrain.js`
 * asks this registry for a surface before it falls back to the island, and the
 * answer is exact rather than raycast. Standing, landing, stepping up, running
 * up a ramp, being stopped by a wall and bridging a void all come out of that
 * one query, which is why they agree with each other.
 *
 * The rule that makes it work: a piece is *floor* only if its underside is at
 * or below the cadet's feet plus a step. So you stand on a deck, you walk under
 * a deck three metres over your head, and you jump up through it from below and
 * land on top — the forgiving one-way behaviour every building game has.
 *
 * TWO THINGS THIS REGISTRY DOES THAT THE OLD ONE DID NOT
 *
 * 1. **A piece is indexed into every cell it touches, not the one its centre
 *    is in.** A four-metre wall reaches into two cells and a wall on a face
 *    straddles two by definition; indexing by centre meant that from one side
 *    the boots asked a cell the wall was not in, found nothing, and walked
 *    straight through it.
 * 2. **It knows what a slot is.** Occupancy, the levels a neighbour offers, and
 *    whether there is anything to build off are all answered against the lattice
 *    rather than against a fuzzy distance, which is what makes the snap feel
 *    magnetic instead of approximate.
 */
const STEP = 0.82;

export class Solids {
  /** @param groundAt (x,z) => number|null — the island, never the patched one. */
  constructor(groundAt) {
    this.groundAt = groundAt;
    this.cells = new Map();       // cellKey -> piece[]
    this.slots = new Map();       // slotKey -> piece
    this.all = [];
    this.count = 0;
    // Pieces the cadet actually set. The world registers structure of its own
    // here — the cache perches (src/world/caches.js) are real ground because
    // they are real solids — and that structure must not be counted as his.
    this.owned = 0;
    this.feet = () => 0;          // live reference height: the cadet's boots
    this._g = new THREE.Vector2();
    this._box = new THREE.Box3();
  }

  /** Every cell key a piece's footprint reaches into. */
  _keys(p, out) {
    boundsOf(p, this._box);
    const x0 = cellIndex(this._box.min.x), x1 = cellIndex(this._box.max.x);
    const z0 = cellIndex(this._box.min.z), z1 = cellIndex(this._box.max.z);
    out.length = 0;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) out.push(`${cx},${cz}`);
    }
    return out;
  }

  add(p) {
    p.slot = slotKey(p.kind, p.x, p.z, baseOf(p));
    p.cellKeys = this._keys(p, []);
    for (const k of p.cellKeys) {
      let list = this.cells.get(k);
      if (!list) this.cells.set(k, (list = []));
      list.push(p);
    }
    this.slots.set(p.slot, p);
    this.all.push(p);
    this.count++;
    if (!p.fixed) this.owned++;
  }

  remove(p) {
    for (const k of p.cellKeys || []) {
      const list = this.cells.get(k);
      if (!list) continue;
      const i = list.indexOf(p);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) this.cells.delete(k);
    }
    const i = this.all.indexOf(p);
    if (i < 0) return;
    this.all.splice(i, 1);
    if (this.slots.get(p.slot) === p) this.slots.delete(p.slot);
    this.count--;
    if (!p.fixed) this.owned--;
  }

  clear() {
    this.cells.clear(); this.slots.clear();
    this.all.length = 0; this.count = 0; this.owned = 0;
  }

  /** Every piece whose footprint reaches this column's cell. */
  at(x, z) {
    return this.cells.get(`${cellIndex(x)},${cellIndex(z)}`);
  }

  /**
   * The highest surface here that the cadet could be standing on, or null.
   * `null` means "not my business" — the island answers instead.
   */
  top(x, z) {
    if (!this.count) return null;
    const list = this.at(x, z);
    if (!list) return null;
    const ref = this.feet() + STEP;
    let best = null;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.dead) continue;
      const s = surfaceAt(p, x, z);
      if (!s) continue;
      // A wall standing on the island is solid from any height. Anything else
      // has to have its underside at or below the boots, which is what lets you
      // walk beneath a raised deck and jump up through it from underneath.
      if (s.bottom > ref && !(p.onGround && p.kind === 'wall')) continue;
      if (best === null || s.top > best) best = s.top;
    }
    return best;
  }

  /**
   * Fall line of the piece the cadet is on, or null if the island wins here.
   * Without this, the heightfield gradient across the lip of a platform is a
   * four-metre cliff over a 90 cm sample and the locomotion's slide response
   * shoves you off your own deck.
   */
  grad(x, z) {
    if (!this.count) return null;
    const t = this.top(x, z);
    if (t === null) return null;
    const g = this.groundAt(x, z);
    if (g !== null && g > t) return null;
    const list = this.at(x, z);
    if (!list) return null;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.dead) continue;
      const s = surfaceAt(p, x, z);
      if (s && Math.abs(s.top - t) < 1e-3) return gradOf(p, this._g);
    }
    return this._g.set(0, 0);
  }

  /** Is there structure near this level in this cell or the ones around it? */
  supportNear(x, z, level, reach = 2.6) {
    if (!this.count) return false;
    const cx = cellIndex(x), cz = cellIndex(z);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.cells.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const p of list) {
          if (p.dead) continue;
          const s = fullSpan(p);
          if (level >= s.lo - reach && level <= s.hi + reach) return true;
        }
      }
    }
    return false;
  }

  /**
   * THE MAGNET.
   *
   * Every level a piece already standing near this slot is willing to hand over:
   * its own level, the storey above it, and the storey below. Those are exact
   * numbers off an existing piece, never a fresh sample of the terrain, which is
   * the whole reason a second wall meets the first one edge to edge instead of
   * a centimetre proud of it.
   *
   * `reach` is a little over one cell, so a wall on the face in front offers its
   * level to the face beside it — that is what closes a corner.
   */
  /**
   * `ranks`, if given, receives a 1 for every level offered by a piece that
   * **shares a lattice node with this slot** and a 0 for the rest.
   *
   * That distinction is the difference between a corner and a near miss, and it
   * is not academic. The plaza registers a hundred and thirty fixed decks with
   * this collider, they sit on their own grid 62 cm above the terrain, and any
   * one of them within a cell of the slot used to pull exactly as hard as the
   * wall the cadet was trying to meet. Building a square by hand on the plaza,
   * three walls came out on the terrain and the fourth — the one that happened
   * to pass within 3.2 m of a plaza deck — came out 61 cm higher, with a ledge
   * you can see at the corner. Which is, verbatim, the complaint this work
   * started from.
   *
   * A piece sharing a node is the piece whose corner post this piece will stand
   * in. Its level is not a suggestion, it is the joint.
   *
   * `slotNodes` is a flat [x, z, x, z, …] of the slot's own lattice nodes.
   */
  slotLevels(x, z, out, ranks = null, slotNodes = null, reach = CELL * 1.05) {
    if (!this.count) return out;
    const cx = cellIndex(x), cz = cellIndex(z);
    const r2 = reach * reach;
    const pn = this._pn || (this._pn = []);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.cells.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const p of list) {
          if (p.dead) continue;
          const ddx = p.x - x, ddz = p.z - z;
          if (ddx * ddx + ddz * ddz > r2) continue;
          const b = qLevel(baseOf(p));
          const n0 = out.length;
          out.push(b, b + LEVEL, b - LEVEL);
          // a deck's own surface is its level; a wall's head is a storey up —
          // both already covered, but a ramp also offers the level it lands on
          if (p.kind === 'ramp') out.push(b + LEVEL);
          if (!ranks) continue;
          const joined = slotNodes ? shareNode(slotNodes, nodesOf(p, pn)) : 0;
          while (ranks.length < out.length) ranks.push(joined);
          void n0;
        }
      }
    }
    return out;
  }

  /** Is this exact slot already taken by a piece of the same class? */
  occupied(kind, x, z, base) {
    const p = this.slots.get(slotKey(kind, x, z, base));
    return !!p && !p.dead;
  }

  /**
   * Would a piece of this kind, founded on `base`, run *through* something?
   *
   * Exact slot collision covers same-class clashes. This adds the one cross-class
   * case that is genuinely a mistake: a deck laid inside the body of a ramp that
   * is climbing through the same cell.
   */
  blocked(kind, x, z, base) {
    if (this.occupied(kind, x, z, base)) return true;
    const cls = CLASS[kind];
    if (cls === 'edge') return false;
    const list = this.at(x, z);
    if (!list) return false;
    const sp = SPEC[kind];
    const lo = base + sp.drop + sp.lo, hi = base + sp.drop + sp.hi;
    for (const p of list) {
      if (p.dead || CLASS[p.kind] === 'edge') continue;
      if (Math.abs(p.x - x) > 0.01 || Math.abs(p.z - z) > 0.01) continue;
      if (p.kind !== 'ramp' && kind !== 'ramp') continue;
      const s = fullSpan(p);
      if (lo < s.hi - 0.3 && hi > s.lo + 0.3) return true;
    }
    return false;
  }

  /**
   * Nearest piece under a ray, for editing. Slab test against each piece's
   * world bounds — a hundred and sixty boxes is nothing next to one frame.
   */
  pick(origin, dir, far = 26) {
    let best = null, bd = far;
    for (const p of this.all) {
      if (p.dead) continue;
      const d = raySlab(origin, dir, boundsOf(p, this._box));
      if (d !== null && d < bd) { bd = d; best = p; }
    }
    return best ? { piece: best, dist: bd } : null;
  }

  /**
   * IS THE CADET IN A BOX OF HIS OWN MAKING?
   *
   * A player who cannot get out of the thing he just built has not been given a
   * building verb, he has been given a trap. Two players in three attempts shut
   * themselves inside a square of four walls and had to reload the page, and no
   * amount of "the geometry is correct" answers that.
   *
   * So the lattice can be asked the question directly, and it is asked *before*
   * the click rather than after: flood-fill the cell graph outward from the cell
   * the cadet stands in, refusing to cross a face that carries a wall tall
   * enough to be at his chest. `extra` is a piece that does not exist yet — the
   * one under the crosshair — so `target()` can ask "if I set this, am I shut
   * in?" and colour the ghost accordingly.
   *
   * Returns `null` when the fill runs past `limit` cells, which is the answer
   * "there is plenty of room"; otherwise the bounded region, which is a room
   * with no door. Walls are the only blocker: a deck is something you walk
   * under, a beam is a rail at knee height, and a ramp is a way *out* — which
   * is why `Builder` looks for one inside the region before it refuses.
   */
  enclosure(px, pz, py, extra = null, limit = 56) {
    if (!this.count && !extra) return null;
    const lo = py + 0.18, hi = py + 1.70;
    const cx0 = cellIndex(px), cz0 = cellIndex(pz);
    const seen = new Set([`${cx0},${cz0}`]);
    const stack = [[cx0, cz0]];
    const region = [];
    while (stack.length) {
      if (region.length >= limit) return null;      // open ground; no room here
      const [cx, cz] = stack.pop();
      region.push([cx, cz]);
      for (let i = 0; i < NEIGH.length; i++) {
        const [dx, dz] = NEIGH[i];
        const k = `${cx + dx},${cz + dz}`;
        if (seen.has(k)) continue;
        // the face between this cell and that one, on the half-grid
        if (this.faceWall((cx + dx * 0.5) * CELL, (cz + dz * 0.5) * CELL, lo, hi, extra)) continue;
        seen.add(k);
        stack.push([cx + dx, cz + dz]);
      }
    }
    return region;
  }

  /**
   * Is there a wall standing on exactly this face, crossing this height band?
   * A face's world position determines its orientation — faces perpendicular to
   * x sit on half-integer x — so matching the position is matching the wall.
   */
  faceWall(fx, fz, lo, hi, extra = null) {
    if (extra && wallCrosses(extra, fx, fz, lo, hi)) return true;
    const list = this.at(fx, fz);
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      if (wallCrosses(list[i], fx, fz, lo, hi)) return true;
    }
    return false;
  }

  /** Every piece standing in this exact cell, for the region walk. */
  inCell(cx, cz) { return this.cells.get(`${cx},${cz}`) || null; }

  /** Any piece whose body contains this point (used to keep a build honest). */
  contains(x, y, z, pad = 0) {
    const list = this.at(x, z);
    if (!list) return false;
    for (const p of list) {
      if (p.dead) continue;
      if (!covers(p, x, z, pad)) continue;
      const s = spanAt(p, x, z);
      if (s && y >= s.lo - pad && y <= s.hi + pad) return true;
    }
    return false;
  }
}

/** The four cell neighbours the flood fill walks. */
const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * The lattice nodes a piece ends on — the points at which a corner post can
 * stand. A face piece has two, at its ends; a cell piece has four, at the
 * corners of its cell.
 */
export function nodesOf(p, out) {
  out.length = 0;
  if (CLASS[p.kind] === 'edge') {
    const [c, s] = TURNS[turnOf(p)];
    const hx = SPEC[p.kind].hx;
    out.push(p.x + c * hx, p.z - s * hx, p.x - c * hx, p.z + s * hx);
    return out;
  }
  const hx = SPEC[p.kind].hx, hz = SPEC[p.kind].hz;
  out.push(p.x - hx, p.z - hz, p.x + hx, p.z - hz, p.x - hx, p.z + hz, p.x + hx, p.z + hz);
  return out;
}

/** Do these two flat [x,z,…] node lists have a point in common? */
export function shareNode(a, b, eps = 0.02) {
  for (let i = 0; i < a.length; i += 2) {
    for (let j = 0; j < b.length; j += 2) {
      if (Math.abs(a[i] - b[j]) <= eps && Math.abs(a[i + 1] - b[j + 1]) <= eps) return 1;
    }
  }
  return 0;
}

/** Does this piece stand on that face, tall enough to stop a person? */
function wallCrosses(p, fx, fz, lo, hi) {
  if (!p || p.dead || p.kind !== 'wall') return false;
  if (Math.abs(p.x - fx) > 0.01 || Math.abs(p.z - fz) > 0.01) return false;
  const sp = SPEC.wall;
  return p.y + sp.lo < hi && p.y + sp.hi > lo;
}

function raySlab(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    const inv = 1 / (d[ax] || 1e-9);
    let a = (b.min[ax] - o[ax]) * inv;
    let c = (b.max[ax] - o[ax]) * inv;
    if (a > c) { const t = a; a = c; c = t; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t1 < t0) return null;
  }
  return t0;
}
