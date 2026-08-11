import * as THREE from 'three';
import { CELL, SPEC, cellKey, surfaceAt, spanAt, gradOf, covers, boundsOf } from './pieces.js';

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
 */
const STEP = 0.82;

export class Solids {
  /** @param groundAt (x,z) => number|null — the island, never the patched one. */
  constructor(groundAt) {
    this.groundAt = groundAt;
    this.cells = new Map();       // cellKey -> piece[]
    this.count = 0;
    // Pieces the cadet actually set. The world registers structure of its own
    // here — the cache perches (src/world/caches.js) are real ground because
    // they are real solids — and that structure must not be counted as his.
    this.owned = 0;
    this.feet = () => 0;          // live reference height: the cadet's boots
    this._g = new THREE.Vector2();
    this._box = new THREE.Box3();
    this._hit = new THREE.Vector3();
  }

  add(p) {
    const k = cellKey(p.x, p.z);
    let list = this.cells.get(k);
    if (!list) this.cells.set(k, (list = []));
    list.push(p);
    this.count++;
    if (!p.fixed) this.owned++;
  }

  remove(p) {
    const k = cellKey(p.x, p.z);
    const list = this.cells.get(k);
    if (!list) return;
    const i = list.indexOf(p);
    if (i < 0) return;
    list.splice(i, 1);
    this.count--;
    if (!p.fixed) this.owned--;
    if (!list.length) this.cells.delete(k);
  }

  clear() { this.cells.clear(); this.count = 0; this.owned = 0; }

  /** Every piece whose cell contains this column. */
  at(x, z) {
    return this.cells.get(cellKey(x, z));
  }

  /**
   * The highest surface here that the cadet could be standing on, or null.
   * `null` means "not my business" — the island answers instead.
   */
  top(x, z) {
    if (!this.count) return null;
    const list = this.cells.get(cellKey(x, z));
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
    const list = this.cells.get(cellKey(x, z));
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
    const cx = Math.round(x / CELL), cz = Math.round(z / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.cells.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const p of list) {
          if (p.dead) continue;
          const s = spanAt(p, p.x, p.z);
          if (!s) continue;
          if (level >= s.lo - reach && level <= s.hi + reach) return true;
        }
      }
    }
    return false;
  }

  /** Tops of pieces in one cell, as candidate levels to found something on. */
  levelsIn(x, z, out) {
    const list = this.cells.get(cellKey(x, z));
    if (!list) return out;
    for (const p of list) {
      if (p.dead) continue;
      const s = surfaceAt(p, x, z);
      if (s) out.push(s.top);
    }
    return out;
  }

  /**
   * Would a piece of this kind, founded on `base`, run through one of its own
   * kind already in this cell?
   *
   * Only same-kind clashes count. A wall and a ramp sharing a cell is a normal
   * thing to build; two ramps whose four-metre spans overlap is not — they
   * interpenetrate, and the second one's entry edge becomes a half-metre kerb
   * standing in the middle of the first one's slope.
   */
  overlaps(kind, base, x, z) {
    const list = this.cells.get(cellKey(x, z));
    if (!list) return false;
    const sp = SPEC[kind];
    const lo = base + sp.drop + sp.lo;
    const hi = base + sp.drop + sp.hi;
    for (const p of list) {
      if (p.dead || p.kind !== kind) continue;
      const q = SPEC[p.kind];
      if (lo < p.y + q.hi - 0.3 && hi > p.y + q.lo + 0.3) return true;
    }
    return false;
  }

  /**
   * Nearest piece under a ray, for editing. Slab test against each piece's
   * world bounds — a hundred and sixty boxes is nothing next to one frame.
   */
  pick(origin, dir, far = 26) {
    let best = null, bd = far;
    for (const list of this.cells.values()) {
      for (const p of list) {
        if (p.dead) continue;
        const d = raySlab(origin, dir, boundsOf(p, this._box));
        if (d !== null && d < bd) { bd = d; best = p; }
      }
    }
    return best ? { piece: best, dist: bd } : null;
  }

  /** Any piece whose body contains this point (used to keep a build honest). */
  contains(x, y, z, pad = 0) {
    const list = this.cells.get(cellKey(x, z));
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
