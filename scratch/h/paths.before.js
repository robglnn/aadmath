import { heightAt, ISLAND_R } from './terrain.js';

/**
 * THE ROUTES — where a cadet can actually walk, and how to get there.
 *
 * WHY THIS FILE EXISTS, measured rather than argued.
 *
 * A walk toward the objective, driven with nothing but W and the mouse, ended
 * at x 35.2, y 36.0, z −91.1 and stayed there for the rest of the run: twenty-
 * three seconds of holding the key with the position changing by ten centimetres
 * and the card printing SEAL THE RIFT · 62 m · AHEAD, where "ahead" was a wall
 * that rises from 37 m to 105 m in six metres of run. A cold critic hit the same
 * thing twice, for 95 s and 85 s.
 *
 * The island was then swept at two metres on the boots' own rule — a cadet holds
 * ground up to a gradient of 1.3 and slides off anything steeper — and the
 * numbers are these:
 *
 *     20,796 cells of ground      every one of them can be walked TO
 *     20,001 can walk back home
 *        795 cannot        =  3.82% of this island is ONE-WAY GROUND
 *
 * You can get in. You cannot get out. It is concentrated in two clusters, both
 * of them lying across the line from the landing plaza to the northern tears:
 * 230 cells in the North Gate's east wall and 185 on the Spine's west flank.
 *
 * **That ground is not a defect.** A mountain has ledges you can drop onto and
 * cannot climb off; so does every good open world. The defect is that the game
 * *sends players into it* — the objective is a straight-line bearing through a
 * hundred metres of rock — and then has nothing to say when they arrive.
 *
 * So this file answers the two questions nobody could ask before:
 *
 *   `escapable(x, z)`   Can a cadet standing here walk home? Precomputed for
 *                       the whole island. The boots read it: on one-way ground
 *                       and only there, they are allowed to scramble.
 *   `routeFrom(...)`    The shortest line between two places THAT IS ACTUALLY
 *                       WALKABLE, as waypoints. The heading in the world and
 *                       the distance on the card can both stop lying.
 *
 * Everything is computed once, off the same heightfield the mesh is drawn from
 * (`terrain.js` — one surface), on a three-metre lattice: some thirteen thousand
 * cells and two flood fills, which is a few milliseconds at boot.
 */

/** Metres per cell. Three is under a stride and over the mesh's own detail. */
const STEP = 3;
const HALF = ISLAND_R + 6;
const N = Math.ceil((HALF * 2) / STEP) + 1;

/**
 * Gradient a cadet can hold. `P.slideLimit` is 1.3 — above that the ground
 * takes him back down (src/player/locomotion.js) — so a route planned at 1.15
 * is one he can walk up without fighting it.
 */
const CLIMB = 1.15;

const IDX = (i, j) => j * N + i;
const CX = (i) => -HALF + i * STEP;
const CZ = (j) => -HALF + j * STEP;
const CELL_I = (x) => Math.round((x + HALF) / STEP);
const CELL_J = (z) => Math.round((z + HALF) / STEP);

/** 8-connected: dx, dz, length in metres. */
const NB = [
  [1, 0, STEP], [-1, 0, STEP], [0, 1, STEP], [0, -1, STEP],
  [1, 1, STEP * Math.SQRT2], [1, -1, STEP * Math.SQRT2],
  [-1, 1, STEP * Math.SQRT2], [-1, -1, STEP * Math.SQRT2],
];

let H = null;          // ground height, NaN off the island
let HOME = null;       // cells a cadet can walk home from
let OUTD = null;       // metres to the nearest such cell, over ANY ground
let OUTB = null;       // …and which neighbour that route leaves by
let ready = false;

function build() {
  if (ready) return;
  ready = true;
  H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const h = heightAt(CX(i), CZ(j));
      H[IDX(i, j)] = (typeof h === 'number' && Number.isFinite(h)) ? h : NaN;
    }
  }

  // ---- HOME: the cells from which the landing plaza can be reached on foot.
  //
  // Walking is asymmetric — you may drop any distance and climb only a little —
  // so this is a fill on the REVERSED edges: expand from c to n when a cadet
  // standing at n could take the step up to c.
  HOME = new Uint8Array(N * N);
  const qi = new Int32Array(N * N), qj = new Int32Array(N * N);
  let head = 0, tail = 0;
  const seed = (i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const k = IDX(i, j);
    if (HOME[k] || Number.isNaN(H[k])) return;
    HOME[k] = 1; qi[tail] = i; qj[tail] = j; tail++;
  };
  seed(CELL_I(0), CELL_J(0));
  while (head < tail) {
    const ci = qi[head], cj = qj[head]; head++;
    const h0 = H[IDX(ci, cj)];
    for (let b = 0; b < NB.length; b++) {
      const ni = ci + NB[b][0], nj = cj + NB[b][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const k = IDX(ni, nj);
      if (HOME[k]) continue;
      const h1 = H[k];
      if (Number.isNaN(h1)) continue;
      // from n, the step up to c must be one he can hold
      if (h0 - h1 > CLIMB * NB[b][2]) continue;
      HOME[k] = 1; qi[tail] = ni; qj[tail] = nj; tail++;
    }
  }

  // ---- THE WAY OUT: from one-way ground, the shortest line back to ground
  // that leads home, ignoring how steep it is. This is what the boots are told
  // to scramble along, and it is a fact about the island, not a guess.
  OUTD = new Float32Array(N * N).fill(Infinity);
  OUTB = new Int8Array(N * N).fill(-1);
  head = 0; tail = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = IDX(i, j);
      if (!HOME[k] || Number.isNaN(H[k])) continue;
      OUTD[k] = 0; qi[tail] = i; qj[tail] = j; tail++;
    }
  }
  while (head < tail) {
    const ci = qi[head], cj = qj[head]; head++;
    const d0 = OUTD[IDX(ci, cj)];
    for (let b = 0; b < NB.length; b++) {
      const ni = ci + NB[b][0], nj = cj + NB[b][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const k = IDX(ni, nj);
      if (Number.isNaN(H[k])) continue;
      const d = d0 + NB[b][2];
      if (d >= OUTD[k]) continue;
      OUTD[k] = d;
      // WHICH WAY IS HOME, AND IT IS THE OPPOSITE OF THE WAY WE CAME.
      //
      // The fill expands OUTWARD from ground that leads home, so `NB[b]` is the
      // step from the parent INTO this cell. Walking home means walking back
      // along it. The first cut of this stored `b` and then handed `NB[b]`
      // straight to `atan2`, which is a bearing pointing directly away from the
      // way out — and the gate caught exactly that: a cadet on the Spine's west
      // flank spent forty-five seconds being told to climb further into the
      // ground he was trying to leave, with the heading flipping through 180°
      // every few metres as the fill's frontier changed direction under him.
      OUTB[k] = b;
      qi[tail] = ni; qj[tail] = nj; tail++;
    }
  }
}

/** Force the tables now, so nothing pays for them mid-frame. */
export function warmRoutes() { build(); }

/**
 * Can a cadet standing here walk home?
 *
 * False on one-way ground — a ledge he can drop onto and not climb off, a slot
 * whose head is a wall — and the ONE condition under which the boots are
 * allowed to climb something they could not otherwise climb.
 */
export function escapable(x, z) {
  build();
  const i = CELL_I(x), j = CELL_J(z);
  if (i < 0 || j < 0 || i >= N || j >= N) return true;
  const k = IDX(i, j);
  // Off the heightfield is not one-way ground, it is open air, and the fall
  // catch owns it (src/player/terrain.js). Never claim it here.
  if (Number.isNaN(H[k])) return true;
  return !!HOME[k];
}

/**
 * From one-way ground: the bearing of the shortest line back to ground that
 * leads home, and how far it is. `null` when this cadet is already fine.
 */
export function wayOut(x, z) {
  build();
  const i = CELL_I(x), j = CELL_J(z);
  if (i < 0 || j < 0 || i >= N || j >= N) return null;
  const k = IDX(i, j);
  if (Number.isNaN(H[k]) || HOME[k]) return null;
  const b = OUTB[k];
  if (b < 0) return null;
  return { yaw: Math.atan2(-NB[b][0] * STEP, -NB[b][1] * STEP), metres: OUTD[k] };
}

// ---------------------------------------------------------------------------
// A ROUTE, rather than a bearing.
//
// The card used to print the straight-line distance and one of four compass
// buckets. On this island those two numbers describe a line through the Spine
// about a third of the time. A route is the answer to the question the player
// is actually asking, and it costs one A* over thirteen thousand cells.
// ---------------------------------------------------------------------------

const _cache = new Map();
const CACHE_MAX = 64;

/** The nearest cell a cadet can both stand on and walk home from. */
function anchor(x, z) {
  build();
  let bi = CELL_I(x), bj = CELL_J(z);
  bi = Math.max(0, Math.min(N - 1, bi));
  bj = Math.max(0, Math.min(N - 1, bj));
  if (HOME[IDX(bi, bj)]) return [bi, bj];
  for (let r = 1; r <= 12; r++) {
    for (let d = -r; d <= r; d++) {
      const cand = [[bi + d, bj - r], [bi + d, bj + r], [bi - r, bj + d], [bi + r, bj + d]];
      for (const [i, j] of cand) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        if (HOME[IDX(i, j)]) return [i, j];
      }
    }
  }
  return null;
}

/**
 * A walkable line from here to there, as waypoints in world metres.
 *
 * Returns `null` only when one of the two ends is not on the island at all.
 * The path is A* on the same walk rule the fills above use, then thinned so
 * straight runs are one segment — a caller wants "the next place to aim at",
 * not four hundred cells.
 */
export function routeFrom(ax, az, bx, bz) {
  build();
  const a = anchor(ax, az), b = anchor(bx, bz);
  if (!a || !b) return null;
  const key = `${a[0]},${a[1]},${b[0]},${b[1]}`;
  const hit = _cache.get(key);
  if (hit) return hit;

  const start = IDX(a[0], a[1]), goal = IDX(b[0], b[1]);
  const g = new Float32Array(N * N).fill(Infinity);
  const prev = new Int32Array(N * N).fill(-1);
  const done = new Uint8Array(N * N);
  const hEst = (i, j) => Math.hypot(i - b[0], j - b[1]) * STEP;
  // A binary heap keyed on f. Thirteen thousand cells never needs more.
  const heap = [];
  const push = (k, f) => {
    heap.push([f, k]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m;
      }
    }
    return top;
  };
  g[start] = 0;
  push(start, hEst(a[0], a[1]));
  let found = false;
  while (heap.length) {
    const [, k] = pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === goal) { found = true; break; }
    const ci = k % N, cj = (k - ci) / N;
    const h0 = H[k], g0 = g[k];
    for (let bi2 = 0; bi2 < NB.length; bi2++) {
      const ni = ci + NB[bi2][0], nj = cj + NB[bi2][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = IDX(ni, nj);
      if (done[nk] || !HOME[nk]) continue;
      const h1 = H[nk];
      if (Number.isNaN(h1)) continue;
      const len = NB[bi2][2];
      if (h1 - h0 > CLIMB * len) continue;
      // A climb costs more than the flat it stands on, so a route round a
      // shoulder beats a route over it, which is what a person does.
      const rise = Math.max(0, h1 - h0);
      const cost = g0 + len + rise * 1.6;
      if (cost >= g[nk]) continue;
      g[nk] = cost; prev[nk] = k;
      push(nk, cost + hEst(ni, nj));
    }
  }
  if (!found) return null;

  const cells = [];
  for (let k = goal; k !== -1; k = prev[k]) {
    const i = k % N, j = (k - i) / N;
    cells.push([CX(i), H[k], CZ(j)]);
    if (k === start) break;
  }
  cells.reverse();
  // thin: keep a point only where the line actually turns
  const pts = [];
  for (let i = 0; i < cells.length; i++) {
    if (i === 0 || i === cells.length - 1) { pts.push(cells[i]); continue; }
    const p = cells[i - 1], c = cells[i], n = cells[i + 1];
    const a1 = Math.atan2(c[0] - p[0], c[2] - p[2]);
    const a2 = Math.atan2(n[0] - c[0], n[2] - c[2]);
    let d = ((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(d) > 0.24) pts.push(c);
  }
  let metres = 0;
  for (let i = 1; i < cells.length; i++) {
    metres += Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][2] - cells[i - 1][2]);
  }
  const out = { points: pts, cells, metres };
  if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value);
  _cache.set(key, out);
  return out;
}

/**
 * The bearing to walk RIGHT NOW to get to a place — round the hill rather than
 * into it — with the walked distance that goes with it.
 *
 * Falls back to the straight line when the two ends are not joined by anything
 * walkable at all, because a bearing that is wrong is still better than a card
 * that has gone blank. (src/world/afford.js, src/meta/guide.js)
 */
export function headingTo(fx, fz, tx, tz) {
  const straight = { yaw: Math.atan2(tx - fx, tz - fz), metres: Math.hypot(tx - fx, tz - fz), routed: false };
  // ---- FIRST, GET OFF THE LEDGE -----------------------------------------
  //
  // A cadet standing on one-way ground has no walkable route to anywhere: the
  // planner has to start from the nearest cell that IS joined to the island,
  // which can be twenty metres away in a direction that means nothing to him.
  // The gate caught the consequence — placed on the Spine's flank at 315°, the
  // routed heading pointed at that anchor, which was up the face, and he spent
  // forty-five seconds climbing two metres of it.
  //
  // So while the world has hold of him the answer is the way OUT, which is a
  // fact this file already holds, and only then the way on.
  const out = wayOut(fx, fz);
  if (out) return { yaw: out.yaw, metres: straight.metres, routed: true, escaping: true };
  const r = routeFrom(fx, fz, tx, tz);
  if (!r || !r.points.length) return straight;
  // Aim at the first waypoint that is a real distance away, so the heading does
  // not jitter between two cells three metres apart.
  let aim = null;
  for (const p of r.points) {
    if (Math.hypot(p[0] - fx, p[2] - fz) > 7) { aim = p; break; }
  }
  if (!aim) return straight;
  return { yaw: Math.atan2(aim[0] - fx, aim[2] - fz), metres: r.metres, routed: true };
}

/** How far it really is on foot. Straight-line when nothing joins them. */
export function walkMetres(ax, az, bx, bz) {
  const r = routeFrom(ax, az, bx, bz);
  return r ? r.metres : Math.hypot(bx - ax, bz - az);
}

/** Diagnostics for the gate: the shape of the island's walkability. */
export function routeStats() {
  build();
  let ground = 0, home = 0;
  for (let k = 0; k < N * N; k++) {
    if (Number.isNaN(H[k])) continue;
    ground++; if (HOME[k]) home++;
  }
  return { step: STEP, cells: N * N, ground, home, oneWay: ground - home, oneWayShare: (ground - home) / Math.max(1, ground) };
}
