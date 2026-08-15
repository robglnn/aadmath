import * as THREE from 'three';
import {
  CELL, LEVEL, SPEC, CLASS, TURNS, turnOf, cellIndex, slotKey, surfaceAt, spanAt,
  fullSpan, gradOf, covers, boundsOf, baseOf, qLevel, inDoor, DOOR_HX,
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
/** Above this far below a face piece's top, you are standing on it, not in it. */
const STAND = 0.35;
/** How tall the cadet is, for the purpose of being inside a wall. */
const HEAD = 1.72;

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
   * `ranks`, if given, receives a 2 for the level that **carries a ramp's climb
   * onward**, a 1 for every other level offered by a piece that **shares a
   * lattice node with this slot**, and a 0 for the rest.
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
   *
   * -------------------------------------------------------------------------
   * WHY A RAMP'S HEAD IS NOT THE SAME KIND OF FACT AS ITS FOOT.
   *
   * A ramp offers three levels like everything else — its base, a storey up, a
   * storey down — and they all used to arrive with the same pull. That is right
   * for a wall, whose two ends are the same height, and wrong for a ramp, whose
   * whole purpose is that its two ends are a storey apart.
   *
   * The cost, photographed: a cadet holding the trigger and running forward laid
   * four ramps and gained eight metres instead of sixteen. Ramps one and two
   * came out on the *same* level, then three and four on the same level as each
   * other — a sawtooth, because each ramp was chosen while the cadet was still
   * near the FOOT of the one he was climbing, so his eye line sat nearer that
   * ramp's base than its head and the base won by a hair. Every second ramp was
   * a four-metre step down at the joint, and the staircase you meant to build
   * was half a staircase you kept falling off.
   *
   * So a ramp names one level as the level that *continues* it, chosen by which
   * side of the ramp the slot is on: past the head, the head; behind the foot,
   * the foot. That level outranks everything, and it is a fact about the
   * structure rather than about where the cadet's eyes happened to be.
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
          const joined = ranks && slotNodes ? shareNode(slotNodes, nodesOf(p, pn)) : 0;
          const add = (v, rank) => { out.push(v); if (ranks) ranks.push(rank); };
          // The level that carries this piece onward. Only a ramp has one that
          // is not simply its base: which end of it the slot is off decides
          // whether the climb continues from the head or from the foot. A slot
          // beside a ramp rather than in line with it gets no opinion.
          if (p.kind === 'ramp') {
            const [c, s] = TURNS[turnOf(p)];
            const along = (x - p.x) * s + (z - p.z) * c;   // + is past the head
            if (along > 0.5) add(b + LEVEL, 2);
            else if (along < -0.5) add(b, 2);
          }
          // a deck's own surface is its level; a wall's head is a storey up
          add(b, joined);
          add(b + LEVEL, joined);
          add(b - LEVEL, joined);
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
  /**
   * THE SHOVE — the collision the lattice never had.
   *
   * Everything the cadet knows about built structure arrives as a *heightfield*:
   * `top(x, z)` names a surface and the boots stand on it. That is exact for a
   * deck and for a ramp, and it is a hole in the world for a wall — because a
   * wall's top is four metres up, and a wall that appears around a person makes
   * `top()` at his own feet answer "four metres up". The controller obeyed, and
   * the cadet was lifted onto the wall he had just built.
   *
   * That single missing case is the whole of the cold critic's report. Lifted
   * onto his own wall, he was now standing *on the face he had built on*, so the
   * next wall went on that same face one storey higher; four walls later he had
   * a two-by-two slab in one plane instead of a room, the ninety degree turn
   * "did nothing" because turning on top of a wall picks the same face again,
   * and the shape he was trying to make was declared a trap.
   *
   * So a face piece now pushes *sideways*, which is the only direction a wall
   * has ever pushed anybody. The correction is the smallest translation along
   * the piece's own axes that puts the capsule outside it — for a wall, half a
   * thickness plus the capsule, straight out of its face.
   *
   * Standing on top is not a collision: above `hi - STAND` the piece is ground
   * and the heightfield already has the answer.
   *
   * @param {number} r capsule radius
   * @param {{x:number,y:number,z:number}} out written with the world correction
   * @param {number} h how tall the thing is — a cadet, or a lens
   * @param {number} standTop how far below a piece's top still counts as on it
   * @returns {boolean} true if `out` holds a shove
   */
  pushOut(x, y, z, r, out, h = HEAD, standTop = STAND) {
    out.x = 0; out.y = 0; out.z = 0;
    if (!this.count) return false;
    const cx = cellIndex(x), cz = cellIndex(z);
    let bestD = Infinity, bx = 0, bz = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.cells.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          if (p.dead || CLASS[p.kind] !== 'edge') continue;
          const sp = SPEC[p.kind];
          const lo = p.y + sp.lo, hi = p.y + sp.hi;
          // on top of it, or entirely clear of it vertically
          if (y >= hi - standTop || y + h <= lo + 0.10) continue;
          const [c, s] = TURNS[turnOf(p)];
          const ddx = x - p.x, ddz = z - p.z;
          const lx = c * ddx - s * ddz;
          const lz = s * ddx + c * ddz;
          const ox = sp.hx + r - Math.abs(lx);
          const oz = sp.hz + r - Math.abs(lz);
          if (ox <= 0 || oz <= 0) continue;                 // outside already
          if (inDoor(p, lx + (lx < 0 ? -r : r))) continue;  // through the door
          // The shove is the smaller of the two, and for a wall that is always
          // out of its face rather than off its end: a wall is four metres long
          // and half a metre thick, so the numbers are not close.
          let px, pz;
          if (oz <= ox) { px = 0; pz = lz < 0 ? -oz : oz; } else { px = lx < 0 ? -ox : ox; pz = 0; }
          const d = Math.hypot(px, pz);
          if (d < bestD) {
            bestD = d;
            // back to world: the inverse of a quarter turn is its transpose
            bx = c * px + s * pz;
            bz = -s * px + c * pz;
          }
        }
      }
    }
    if (bestD === Infinity) return false;
    out.x = bx; out.z = bz;
    return true;
  }

  /**
   * How far a ray from `ox,oy,oz` along a unit direction travels before it
   * enters built structure. Exact slab tests against the pieces near the line,
   * because the lens has to be kept out of a wall the cadet raised a frame ago
   * and a raycast against an instanced batch is both slower and, when the batch
   * is the translucent glaze, silently ignored.
   *
   * Face pieces only: a deck over the lens's head is a roof, not a blocker, and
   * shortening the boom for one would put the camera in the cadet's neck every
   * time he walked under his own bridge.
   */
  march(ox, oy, oz, dx, dy, dz, far, pad = 0.24) {
    if (!this.count) return Infinity;
    let best = Infinity;
    const cx = cellIndex(ox + dx * far * 0.5), cz = cellIndex(oz + dz * far * 0.5);
    const reach = Math.ceil(far / CELL) + 1;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const list = this.cells.get(`${cx + i},${cz + j}`);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const p = list[k];
          if (p.dead || CLASS[p.kind] !== 'edge' || seen.has(p)) continue;
          seen.add(p);
          const t = slabHit(p, ox, oy, oz, dx, dy, dz, far, pad);
          if (t !== null && t < best) best = t;
        }
      }
    }
    return best;
  }

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
/**
 * Where a ray enters a face piece's box, in the piece's own frame, or null.
 * A quarter turn, so the world ray becomes a local ray exactly and the test is
 * the ordinary slab test with no trigonometry left in it.
 */
function slabHit(p, ox, oy, oz, dx, dy, dz, far, pad) {
  const sp = SPEC[p.kind];
  const [c, s] = TURNS[turnOf(p)];
  const rx = ox - p.x, rz = oz - p.z;
  const lx = c * rx - s * rz, lz = s * rx + c * rz;
  const ux = c * dx - s * dz, uz = s * dx + c * dz;
  const hx = sp.hx + pad, hz = sp.hz + pad;
  let t0 = 0, t1 = far;
  const axis = (o, d, h) => {
    if (Math.abs(d) < 1e-6) return o >= -h && o <= h;
    const a = (-h - o) / d, b = (h - o) / d;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
    return t1 >= t0;
  };
  if (!axis(lx, ux, hx)) return null;
  if (!axis(lz, uz, hz)) return null;
  if (!axis(oy - (p.y + (sp.lo + sp.hi) / 2), dy, (sp.hi - sp.lo) / 2 + pad)) return null;
  // a doorway is not a blocker: the lens is allowed to look through it
  if (p.door) {
    const mid = lx + ux * ((t0 + t1) / 2);
    if (Math.abs(mid) <= DOOR_HX) return null;
  }
  return t0;
}

function wallCrosses(p, fx, fz, lo, hi) {
  if (!p || p.dead || p.kind !== 'wall') return false;
  // A wall with a doorway in it does not close the face it stands on. This one
  // line is what lets the anti-trap rule stop being a refusal: the fourth wall
  // of a room you are inside goes up like any other, and the flood fill walks
  // straight out through the opening, so nobody is ever "shut in" by it.
  if (p.door) return false;
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
