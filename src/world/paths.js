import { heightAt, ISLAND_R } from './terrain.js';

/**
 * THE ROUTES — where a cadet can actually walk, and how to get there.
 *
 * WHY THIS FILE EXISTS, measured rather than argued.
 *
 * A walk toward the objective, driven with nothing but W and the mouse, ended
 * at x 35.2, y 36.0, z −91.1 and stayed there for the rest of the run: twenty-
 * three seconds of holding the key with the position changing by ten centimetres
 * and the card printing SEAL THE RIFT · 62 m · AHEAD, where "ahead" was a wall.
 * A cold critic hit the same thing twice, for 95 s and 85 s.
 *
 * ---------------------------------------------------------------------------
 * THE SECOND TIME IT WAS MEASURED, AND WHAT WAS ACTUALLY WRONG
 * ---------------------------------------------------------------------------
 *
 * The first pass at this file answered "can a cadet walk from here to there"
 * on a THREE-METRE lattice with a rise rule — a step was walkable if the two
 * cell centres were within `1.15 × the distance` of each other in height. The
 * boots ask a completely different question, in `_blocked`
 * (src/player/locomotion.js): they refuse any point whose gradient, measured
 * with a central difference over ±0.7 m, is over `P.slopeLimit` = 1.5, and any
 * lip taller than `P.stepUp` = 0.55 m. Between two cell centres three metres
 * apart, a three-metre lattice looks at NOTHING.
 *
 * At x = 30, walking north from z = −93 to z = −90, the two cell centres stand
 * at 103.4 m and 105.0 m: a rise of 1.6 m over 3 m, comfortably inside 1.15,
 * so the planner called it a road. Sampled every 25 cm, the ground between them
 * goes 103.4 → **107.55** → 105.0. There is a four-metre lip two metres wide in
 * the middle of that "road", it runs at a gradient of 2.4, and the boots stop
 * dead on it. Walked over the legs a player is actually sent down, 643 of 5,457
 * routed samples — **11.8%** — stood over the boots' own slope limit, with up to
 * **15.7 metres of continuous wall** on one line, and EVERY ONE of those 643
 * samples was on ground the old rule called "leads home", so the scramble that
 * exists to free a stuck cadet was never offered on any of them.
 *
 * That is the whole defect, and it is not a phantom floor and not a collision
 * bug: **the planner's walk rule was not the boots' walk rule**, so the card
 * pointed AHEAD and ahead was a face.
 *
 * So the walk graph is now built at the boots' own resolution and on the boots'
 * own rule:
 *
 *   a FINE FIELD at 0.7 m — the exact baseline `gradientAt(x, z, 0.7)` uses —
 *     carrying the height and the gradient of every point on the island;
 *   a LATTICE at 1.4 m, which is every second fine node, so the midpoint of
 *     every lattice step (including the diagonals) IS a fine node and is tested
 *     exactly, not interpolated. A lip has to be under 70 cm wide to hide.
 *
 * and it answers three questions instead of one:
 *
 *   `escapable(x, z)`   Can a cadet standing here get home AT ALL — dropping
 *                       where he must, climbing only what the boots hold? False
 *                       on genuinely one-way ground, and the ONE condition
 *                       under which the boots may scramble.
 *   `headingTo(...)`    Which way to walk, right now. Read off a distance field
 *                       flooded out from the destination, so it cannot have a
 *                       local minimum: the old planner replanned from the
 *                       cadet's own cell every 45 cm and flipped between "this
 *                       way" and "back the other way" as he crossed a boundary,
 *                       which a gate caught as **forty seconds of ping-pong**
 *                       on the Spine's west flank with W held down the whole
 *                       time. A field has one sink and it is the destination.
 *   `routeFrom(...)`    The same field, walked, as waypoints in world metres —
 *                       for the trace on the ground and the distance on the card.
 *
 * Everything is computed once, off the same heightfield the mesh is drawn from
 * (`terrain.js` — one surface), at boot.
 */

// ---------------------------------------------------------------------------
// THE BOOTS' OWN NUMBERS. Every one of these is the value `src/player` uses,
// named here so the two files can be checked against each other by eye. They
// are not tuning knobs: change one in `P` and this file is wrong.
// ---------------------------------------------------------------------------

/**
 * `gradientAt(x, z, 0.7)` — the baseline `_blocked` measures the ground over.
 * It is the SPAN of the central difference, not the spacing of the samples.
 */
const BASE = 0.7;
/**
 * …and the spacing, which is HALF of it, because the boots do not stand on a
 * lattice. Sampling the gradient only every 70 cm left a residue of exactly the
 * defect this file is about, one level finer down: the gate walked 400 random
 * standing places toward the landing and found **17 of them** whose route rose,
 * inside its first ten metres, into a face the boots refuse — up to gradient
 * 2.25 at (40, −59) — with every lattice node and every midpoint on that step
 * measuring under 1.5. A central difference straddling the seam between two
 * mesh triangles is steeper than the same difference taken at either end of it,
 * and at 70 cm there was nowhere to see that from.
 */
const E = BASE / 2;
/** The lattice, in fine nodes. Every interior sample of a step is a node. */
const SUB = 4;
/**
 * How many places on a step are looked at.
 *
 * Six, not four, and the reason is the DIAGONALS. A straight step lands on the
 * fine nodes exactly; a diagonal one is 1.98 m long and its nodes sit 49.5 cm
 * apart along it, so testing "the nodes" leaves 15 cm gaps that a seam between
 * two mesh triangles fits inside. The gate walked 400 random standing places
 * and found one whose route rose into a gradient-1.7 face at (−98, −50) inside
 * its first ten metres, with every node on that step under the limit. Six
 * samples, rounded to the nearest node, closes it.
 */
const STEPS = 6;
const S = E * SUB;
/**
 * `P.slideLimit`. Above this the ground takes the cadet back down it, so a
 * route over it is not a route — it is a slide with a suggestion attached.
 * The planner's graph is the ground at or under this.
 */
const STAND = 1.30;
/**
 * `P.slopeLimit`. The face the boots refuse outright. A cadet may still be able
 * to get home over ground between STAND and FACE — slithering, at half speed —
 * so `escapable` uses this one and only this one. Being generous here is the
 * safe direction: it means the scramble is offered later, never earlier.
 */
const FACE = 1.50;
/**
 * Metres of rise per metre of run a walk may ask for. Under `STAND` by enough
 * that a route is a promise rather than a dare.
 */
const CLIMB = 1.15;
/**
 * The face limit the ADVICE keeps, as opposed to the one the boots have.
 *
 * Held at `FACE` — a margin was tried here and measured: dropping it to 1.32
 * did not remove a single one of the places the gate complained about (the
 * thing it was aimed at turned out to be a four-centimetre bump between two
 * samples, not a face), and it cost 0.6% of the island's simulated walks and
 * pushed the p90 detour from 2.04x to 2.28x. A margin that buys nothing is a
 * cost with a story attached.
 */
const FACE_SAFE = FACE;
/**
 * …and the lip the legs simply step over, `P.stepUp` = 0.55 m, kept a little
 * inside it.
 *
 * THIS IS NOT SLACK, IT IS THE OTHER HALF OF THE RULE. A pure `CLIMB × distance`
 * allowance applied at every 35 cm says the ground may never be steeper than
 * 1.15 ANYWHERE, which is a different and much harsher claim than "the climb
 * across this stride averages under 1.15" — real ground wobbles, and measured
 * at 35 cm it wobbles over 1.15 constantly. Sampling four times as often with
 * the linear allowance alone cost 3.4% of the island's walks in the simulator
 * for no defect at all. The gradient test (`FACE`) is what refuses a face; this
 * one exists to catch a LIP, so it is allowed a lip's worth of height.
 */
const STEP_UP = 0.5;
/** How steep ground is charged: per unit of gradient over `STAND`, and a cap. */
const ROUGH_K = 10, ROUGH_CAP = 2, ROUGH_MIN = 2;

/**
 * A ROUTE IS SYMMETRIC AND GETTING HOME IS NOT, and the two must not be muddled.
 *
 * `routable` below tests the same step both ways round, so the walkable island
 * is one undirected component and a cost-to-go field flooded out of any place
 * on it covers all of it. That is what makes "the cadet is somewhere the field
 * has no answer for" impossible rather than merely unlikely — the failure mode
 * of the first cut of this file, where a goal on a pocket of ground returned
 * `null` and every surface fell back to a straight line through a mountain.
 *
 * `HOME`, on the other hand, is deliberately one-way: a cadet may always fall,
 * so getting home is climbing-constrained only.
 */

const HALF = ISLAND_R + 6;
/** Fine grid: heights and gradients at the boots' own baseline. */
const FN = Math.ceil((HALF * 2) / E) + 1;
/** Lattice: every SUB-th fine node. */
const N = Math.floor((FN - 1) / SUB) + 1;

const FIDX = (i, j) => j * FN + i;
const IDX = (i, j) => j * N + i;
const CX = (i) => -HALF + i * S;
const CZ = (j) => -HALF + j * S;
const CELL_I = (x) => Math.round((x + HALF) / S);
const CELL_J = (z) => Math.round((z + HALF) / S);

/** 8-connected, in lattice steps, with the length of each in metres. */
const NB = [
  [1, 0, S], [-1, 0, S], [0, 1, S], [0, -1, S],
  [1, 1, S * Math.SQRT2], [1, -1, S * Math.SQRT2],
  [-1, 1, S * Math.SQRT2], [-1, -1, S * Math.SQRT2],
];

let FH = null;         // fine height, NaN off the island
let FG = null;         // fine gradient, the boots' own central difference
let H = null;          // lattice height, NaN off the island
let G = null;          // lattice gradient
let WALK = null;       // ground a route may cross: on the island and under STAND
let MAIN = null;       // …and joined to the landing plaza by steps a route may take
let HOME = null;       // …and from which the landing plaza can be reached
let OUTD = null;       // metres to the nearest such cell, over ANY ground
let OUTB = null;       // …and which neighbour that route leaves by
let ready = false;

function build() {
  if (ready) return;
  ready = true;

  // ---- THE FINE FIELD ---------------------------------------------------
  // Height first, then the gradient off it — the same central difference over
  // ±0.7 m that `_blocked` computes with `gradientAt(x, z, 0.7)`. Computing it
  // from the grid rather than with four more `heightAt` calls per node is four
  // times cheaper and gives the identical number, because the spacing IS the
  // baseline.
  FH = new Float32Array(FN * FN);
  const R2 = (ISLAND_R + 6) * (ISLAND_R + 6);
  for (let j = 0; j < FN; j++) {
    const z = -HALF + j * E;
    for (let i = 0; i < FN; i++) {
      const x = -HALF + i * E;
      // Off the square that could possibly hold island: no need to ask.
      if (x * x + z * z > R2) { FH[FIDX(i, j)] = NaN; continue; }
      const h = heightAt(x, z);
      FH[FIDX(i, j)] = (typeof h === 'number' && Number.isFinite(h)) ? h : NaN;
    }
  }
  FG = new Float32Array(FN * FN);
  for (let j = 0; j < FN; j++) {
    for (let i = 0; i < FN; i++) {
      const k = FIDX(i, j), h = FH[k];
      if (Number.isNaN(h)) { FG[k] = NaN; continue; }
      // The coastline is not a wall a cadet is standing on: a sample that falls
      // off the island reads as the height under his own boots, exactly as
      // `gradientAt` does with its `?? h`.
      // …over ±BASE, which is ±2 nodes at this spacing: the boots' own span,
      // sampled twice as often as the span itself.
      const q = 2;
      const rr = i + q < FN ? FH[k + q] : h, ll = i >= q ? FH[k - q] : h;
      const uu = j + q < FN ? FH[k + FN * q] : h, dd = j >= q ? FH[k - FN * q] : h;
      const gx = ((Number.isNaN(rr) ? h : rr) - (Number.isNaN(ll) ? h : ll)) / (2 * BASE);
      const gz = ((Number.isNaN(uu) ? h : uu) - (Number.isNaN(dd) ? h : dd)) / (2 * BASE);
      FG[k] = Math.hypot(gx, gz);
    }
  }

  // ---- THE LATTICE, which is every second fine node ---------------------
  H = new Float32Array(N * N);
  G = new Float32Array(N * N);
  WALK = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = FIDX(i * SUB, j * SUB), c = IDX(i, j);
      H[c] = FH[k]; G[c] = FG[k];
      WALK[c] = (!Number.isNaN(FH[k]) && FG[k] <= STAND) ? 1 : 0;
    }
  }

  // ---- THE WALKABLE ISLAND: every cell joined to the landing plaza by steps
  // a route may take. A cost-to-go field flooded out of any cell in here
  // reaches every other cell in here, which is the whole reason `routable` is
  // symmetric — so `anchor` can promise that the answer exists.
  MAIN = new Uint8Array(N * N);
  {
    const q = new Int32Array(N * N);
    let h2 = 0, t2 = 0;
    const i0 = CELL_I(0), j0 = CELL_J(0);
    const start = anchorRaw(i0, j0, WALK);
    if (start) { MAIN[IDX(start[0], start[1])] = 1; q[t2++] = IDX(start[0], start[1]); }
    while (h2 < t2) {
      const k = q[h2++];
      const ci = k % N, cj = (k - ci) / N;
      for (let b = 0; b < NB.length; b++) {
        const ni = ci + NB[b][0], nj = cj + NB[b][1];
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = IDX(ni, nj);
        if (MAIN[nk] || !routable(ci, cj, ni, nj, b)) continue;
        MAIN[nk] = 1; q[t2++] = nk;
      }
    }
  }

  // ---- HOME: the cells from which the landing plaza can be reached on foot.
  //
  // Walking is asymmetric — you may drop any distance and climb only a little —
  // so this is a fill on the REVERSED edges: expand from c to n when a cadet
  // standing at n could take the step to c. Climbing into c has to clear both
  // the boots' rise rule and the boots' face rule, at c AND at the midpoint
  // between them; dropping to c is free, because a cadet can always fall.
  HOME = new Uint8Array(N * N);
  const qi = new Int32Array(N * N), qj = new Int32Array(N * N);
  let head = 0, tail = 0;
  {
    const i0 = CELL_I(0), j0 = CELL_J(0);
    if (i0 >= 0 && j0 >= 0 && i0 < N && j0 < N && !Number.isNaN(H[IDX(i0, j0)])) {
      HOME[IDX(i0, j0)] = 1; qi[tail] = i0; qj[tail] = j0; tail++;
    }
  }
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
      if (!climbable(ni, nj, ci, cj, b, h1, h0, FACE)) continue;
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
      // ground he was trying to leave.
      OUTB[k] = b;
      qi[tail] = ni; qj[tail] = nj; tail++;
    }
  }
}

/**
 * Can the boots get from the lattice node (ai, aj) at height `ha` to (bi, bj)
 * at height `hb`, taking the step `b`?
 *
 * Climbing is the constrained direction, and it is constrained the way the
 * boots constrain it: a rise the legs can take, over a face they will stand on,
 * **at the midpoint as well as at the far end**. The midpoint of a 1.4 m step is
 * a fine node by construction, diagonals included, so this looks at the lip the
 * three-metre lattice used to step straight over. Dropping is free: a cadet can
 * always fall, which is exactly what makes ground one-way.
 */
function climbable(ai, aj, bi, bj, b, ha, hb, faceLimit) {
  const rise = hb - ha;
  if (rise <= 0.03) return true;
  if (rise > CLIMB * NB[b][2]) return false;
  if (G[IDX(bi, bj)] > faceLimit) return false;
  // EVERY point between the two is a fine node by construction — lattice cell
  // (i, j) IS fine node (SUB·i, SUB·j) — so the whole step is looked at, not
  // its ends. This is the ground the three-metre lattice used to step over.
  const di = (bi - ai) * SUB, dj = (bj - aj) * SUB;
  for (let k = 1; k < STEPS; k++) {
    const t = k / STEPS;
    const mk = FIDX(Math.round(ai * SUB + di * t), Math.round(aj * SUB + dj * t));
    const mh = FH[mk];
    if (Number.isNaN(mh)) return false;
    if (mh - ha > CLIMB * NB[b][2] * t + STEP_UP) return false;
    if (FG[mk] > faceLimit) return false;
  }
  return true;
}

/**
 * True when a ROUTE may take this step — walkable ground at both ends AND at
 * the point half way between them, and no rise either way that the boots would
 * refuse. Symmetric on purpose: see the note above.
 *
 * This is the ROAD rule, and it defines the walkable island (`MAIN`). It is
 * strictly inside `stepCost` below, which is the BOOTS' rule: everything a road
 * may cross, a cadet may cross.
 */
function routable(ai, aj, bi, bj, b) {
  const ka = IDX(ai, aj), kb = IDX(bi, bj);
  if (!WALK[ka] || !WALK[kb]) return false;
  const len = NB[b][2], lim = CLIMB * len;
  if (Math.abs(H[kb] - H[ka]) > lim) return false;
  const di = (bi - ai) * SUB, dj = (bj - aj) * SUB;
  for (let k = 1; k < STEPS; k++) {
    const t = k / STEPS;
    const mk = FIDX(Math.round(ai * SUB + di * t), Math.round(aj * SUB + dj * t));
    const mh = FH[mk];
    if (Number.isNaN(mh) || FG[mk] > STAND) return false;
    if (Math.abs(mh - H[ka]) > lim * t + STEP_UP) return false;
    if (Math.abs(mh - H[kb]) > lim * (1 - t) + STEP_UP) return false;
  }
  return true;
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
  return { yaw: Math.atan2(-NB[b][0] * S, -NB[b][1] * S), metres: OUTD[k] };
}

// ---------------------------------------------------------------------------
// A FIELD, rather than a plan.
//
// The card used to print the straight-line distance and one of four compass
// buckets. On this island those two numbers describe a line through the Spine
// about a third of the time. The pass after that ran an A* from the cadet's own
// cell to the tear, every 45 cm of walking, and re-derived a fresh plan each
// time — which is how a cadet ended up standing on a boundary where two
// adjacent cells planned two different ways round the same shoulder, holding W,
// turning 180° every few metres for forty seconds.
//
// A cost-to-go field cannot do that. It is flooded ONCE out of the destination
// over everything the boots can walk, so every cell's answer is consistent with every
// other cell's answer by construction, and there is exactly one minimum on the
// whole island and it is the destination. Reading it is an array lookup, so the
// heading no longer costs an A* per poll either.
// ---------------------------------------------------------------------------

const _fields = new Map();
const FIELD_MAX = 12;

/**
 * THE COST OF ONE STEP A CADET WOULD ACTUALLY TAKE, from (ni, nj) to (ci, cj),
 * or `Infinity` if the boots would refuse it.
 *
 * THE FIELD COVERS THE WHOLE ISLAND, NOT JUST THE ROADS, and that is the point.
 * The first cut of this flooded only ground a route may cross (`routable`), so
 * a cadet standing at the bottom of the North Gate's cut — ground the boots CAN
 * walk out of, over rough — had no answer at all, and the nearest cell with an
 * answer was 53 metres straight up. The trace pointed at the cliff.
 *
 * So the graph is the boots' own rule: a climb the legs take, over a face they
 * will stand on, checked at the far end and at the midpoint. Dropping is free,
 * because a cadet can always fall — but a drop is charged, because a road that
 * steps off a four-metre bank is not a road. Rough ground is charged six times
 * its length, so the field lays the line on the walkable ground wherever
 * walkable ground exists and only crosses the rough where there is nothing else
 * — which is exactly where a player needs telling.
 */
function stepCost(ni, nj, ci, cj, b) {
  const kn = IDX(ni, nj), kc = IDX(ci, cj);
  const hn = H[kn], hc = H[kc];
  if (Number.isNaN(hn) || Number.isNaN(hc)) return Infinity;
  const len = NB[b][2];
  const di = (ci - ni) * SUB, dj = (cj - nj) * SUB;
  const kc0 = FIDX(ci * SUB, cj * SUB);
  const rise = hc - hn;
  // Every point on the step, not its ends. `worstG` is what the rough charge
  // below reads, so a step is priced by the steepest ground on it.
  // ---- `_blocked`, WALKED ALONG THE STEP --------------------------------
  //
  // The rule is not "if this step climbs, is the ground steep" — it is the
  // boots' own rule at every point on it: *entering a point that is above you,
  // over a face they refuse, is a wall.* A step that descends four metres over
  // a bump that rises thirty centimetres at gradient 1.7 has a wall in the
  // middle of it, and a rule that only looks at climbing steps never sees it.
  // The gate found the consequence at (−97.7, −50.1): one point, gradient 1.70,
  // on a descending step, and **73 of the 80 standable places around
  // (−102, −57) were routed straight through it**.
  let worstG = G[kc];
  let ph = hn;
  for (let k = 1; k <= STEPS; k++) {
    const t = k / STEPS;
    const mk = k === STEPS ? kc0
      : FIDX(Math.round(ni * SUB + di * t), Math.round(nj * SUB + dj * t));
    const mh = k === STEPS ? hc : FH[mk];
    if (Number.isNaN(mh)) return Infinity;
    const fg = k === STEPS ? G[kc] : FG[mk];
    if (fg > worstG) worstG = fg;
    if (mh - ph > 0.03) {
      if (fg > FACE_SAFE) return Infinity;
      if (mh - hn > CLIMB * len * t + STEP_UP) return Infinity;
    }
    ph = mh;
  }
  if (rise > CLIMB * len) return Infinity;
  // ---- ROUGH GROUND IS CHARGED BY HOW ROUGH IT IS ------------------------
  //
  // The first cut of this charged a FLAT six times the length for any step off
  // road-grade ground, and the consequence was measured: a cadet on the Spine's
  // west flank, 78 m from the tear across the mountain, was routed **245 m**
  // round it when the shortest line his boots could actually take was 120 m.
  // Six times the length means a hundred metres of extra road is cheaper than
  // twenty-five metres of hillside, which is not a judgement a person makes —
  // and the gate's own bar for "the walk is not a hike" is 2.4x the line across
  // it, so the planner was failing the very rule the road preference exists to
  // serve.
  //
  // So the charge is proportional to how far over the walk limit the ground is,
  // and capped. Ground at 1.35 costs almost nothing and is crossed; a face at
  // 1.8 costs three times its length and is gone round. Ground the road rule
  // rejects for a reason other than steepness — a step the walk rule will not
  // take — keeps a floor under it.
  const over = worstG - STAND;
  let road = over > 0 ? Math.min(ROUGH_CAP, over * ROUGH_K) : 0;
  if (!WALK[kn] || !WALK[kc] || Math.abs(hc - hn) > CLIMB * len) road = Math.max(road, ROUGH_MIN);
  // ---- AND A ROAD DOES NOT STEP OFF A ROOF -------------------------------
  //
  // Dropping is free to the BOOTS — a cadet can always fall — so the rule above
  // constrains climbing and says nothing about descent, and a field built on
  // that alone will happily lay the line over the lip of a fifty-metre face
  // because the far side is three metres nearer the tear. Measured on the ten
  // legs of the shipping lattice: 111 of 16,657 samples on the routed lines
  // stood at a gradient over the boots' own limit, worst **11.78** at
  // (−6.5, −115.7), and every one of them was a descent.
  //
  // The charge is therefore four metres of road for every metre of drop past a
  // bank a road may honestly step down. Measured over the 110 legs of the
  // shipping lattice, that takes the biggest single step down on any routed
  // line from **20.05 m to 6.21 m** — a hop off a bank rather than a jump off a
  // ledge — and it is deliberately a charge and not a veto: on a shard with a
  // cut through it there are places where the drop IS the way, and a field that
  // refused them would have no answer at all for a cadet standing in one.
  //
  // FOUR, AND NOT MORE. A square charge takes the worst drop to 3.8 m and costs
  // more than it buys: routes bend onto ground between the slide limit and the
  // wall limit — walkable, but ground that sheds you — and a walk simulated at
  // the boots' own step size arrives from 95.3% of the island instead of 97.0%.
  // Every one of the three settings measured leaves ZERO places where a routed
  // line rises into a face the boots refuse, which is the defect this file is
  // about; this one is the best of them on the walk that follows it.
  const fall = Math.max(0, -rise - 1.8);
  return len * (1 + G[kc] * 0.22 + road)
    + Math.max(0, rise) * 1.6
    + fall * 4;
}

/**
 * The cost-to-go field for one destination, flooded over every cell the boots
 * can reach it from. Cached by the destination's own cell, so the ten tears of
 * a lattice cost ten floods for a whole session and a poll costs an array read.
 */
function fieldFor(tx, tz) {
  build();
  const a = anchor(tx, tz);
  if (!a) return null;
  const key = `${a[0]},${a[1]}`;
  const hit = _fields.get(key);
  if (hit) { _fields.delete(key); _fields.set(key, hit); return hit; }

  const D = new Float32Array(N * N).fill(Infinity);
  const goal = IDX(a[0], a[1]);
  D[goal] = 0;
  const done = new Uint8Array(N * N);
  const heap = [];
  const push = (k, f) => {
    heap.push(f, k);
    let c = (heap.length >> 1) - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p * 2] <= heap[c * 2]) break;
      const f0 = heap[p * 2], k0 = heap[p * 2 + 1];
      heap[p * 2] = heap[c * 2]; heap[p * 2 + 1] = heap[c * 2 + 1];
      heap[c * 2] = f0; heap[c * 2 + 1] = k0;
      c = p;
    }
  };
  const pop = () => {
    const k = heap[1];
    // Pairs are stored flat, cost then key, so the two pops come back in the
    // reverse of that order.
    const lastKey = heap.pop(), lastCost = heap.pop();
    if (heap.length) {
      heap[0] = lastCost; heap[1] = lastKey;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l * 2 < heap.length && heap[l * 2] < heap[m * 2]) m = l;
        if (r * 2 < heap.length && heap[r * 2] < heap[m * 2]) m = r;
        if (m === c) break;
        const f0 = heap[m * 2], k0 = heap[m * 2 + 1];
        heap[m * 2] = heap[c * 2]; heap[m * 2 + 1] = heap[c * 2 + 1];
        heap[c * 2] = f0; heap[c * 2 + 1] = k0;
        c = m;
      }
    }
    return k;
  };
  push(goal, 0);
  while (heap.length) {
    const k = pop();
    if (done[k]) continue;
    done[k] = 1;
    const ci = k % N, cj = (k - ci) / N;
    const d0 = D[k];
    for (let b = 0; b < NB.length; b++) {
      const ni = ci + NB[b][0], nj = cj + NB[b][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = IDX(ni, nj);
      if (done[nk] || Number.isNaN(H[nk])) continue;
      // The field is walked OUTWARD from the destination, so the step a cadet
      // would take is from n to c — and that is the one that has to be walkable.
      const c = stepCost(ni, nj, ci, cj, b);
      if (!Number.isFinite(c)) continue;
      const d = d0 + c;
      if (d >= D[nk]) continue;
      D[nk] = d;
      push(nk, d);
    }
  }
  const out = { D, goal, gi: a[0], gj: a[1], tx, tz };
  if (_fields.size >= FIELD_MAX) _fields.delete(_fields.keys().next().value);
  _fields.set(key, out);
  return out;
}

/** Nearest cell to (i, j) that the flag array marks. Rings outward, so it is nearest. */
function anchorRaw(i0, j0, flag) {
  const bi = Math.max(0, Math.min(N - 1, i0));
  const bj = Math.max(0, Math.min(N - 1, j0));
  if (flag[IDX(bi, bj)]) return [bi, bj];
  for (let r = 1; r < N; r++) {
    let any = false;
    for (let d = -r; d <= r; d++) {
      const cand = [[bi + d, bj - r], [bi + d, bj + r], [bi - r, bj + d], [bi + r, bj + d]];
      for (const [i, j] of cand) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        any = true;
        if (flag[IDX(i, j)]) return [i, j];
      }
    }
    if (!any) break;
  }
  return null;
}

/**
 * The nearest cell on the walkable island — the one joined to the plaza.
 *
 * Never `WALK` alone. A cadet standing on a shelf of gentle ground with cliffs
 * all round it is on WALK ground that no route reaches, and anchoring him there
 * is how a field ends up with no answer for the place he is standing.
 */
function anchor(x, z) {
  build();
  return anchorRaw(CELL_I(x), CELL_J(z), MAIN);
}

/**
 * WHERE A CADET READS HIS ANSWER FROM, and why it is not simply "his own cell".
 *
 * A cadet on ground right at the walk limit stands with one foot in a cell the
 * route graph accepts and one in a cell it does not, and a rule that says *use
 * your own cell if it has an answer, otherwise the nearest one that has* flips
 * between two different chains twice a second as he shuffles. Followed at the
 * boots' own step size, that is a cadet at (29.6, −33.7) turning through 180°
 * every few frames, on flat-enough ground, forty-nine metres from the tear, for
 * as long as the key is held: the exact symptom the report describes, arrived
 * at from a completely different direction than the one this file was rewritten
 * for.
 *
 * The cure was not a cleverer tie-break, it was removing the boundary: the
 * field is flooded over every cell the boots can reach the destination from,
 * not only over the ground a road may cross (see `stepCost`), so a cadet's own
 * cell has an answer wherever he can get there on foot at all — which is the
 * first branch below and, in play, the only one that ever runs.
 *
 * The second branch is now reachable in exactly one state: he cannot get there
 * on foot from here, i.e. he is on one-way ground. `headingTo` has already
 * handed him to `wayOut` by then; this only keeps the trace pointing somewhere
 * sane while the escape does the work, and it picks the cell that is cheapest
 * to reach AND cheapest to leave so that it moves smoothly as he does.
 */
/**
 * Metres inside which an aim is not a direction.
 *
 * The bearing to a point forty centimetres away swings through half a circle
 * while a cadet shuffles inside one cell, so the first stretch of the chain is
 * accepted unconditionally and the string-pull starts beyond it. Four metres is
 * under a second of running and wider than the cell he is standing in.
 */
const AIM_MIN = 4;

const REACH_CELLS = 3;
function standIn(F, x, z) {
  const bi = Math.max(0, Math.min(N - 1, CELL_I(x)));
  const bj = Math.max(0, Math.min(N - 1, CELL_J(z)));
  if (bi >= 0 && bj >= 0 && bi < N && bj < N && Number.isFinite(F.D[IDX(bi, bj)])) return [bi, bj];
  // The field has no answer where he is standing, which now means one thing
  // only: this cadet cannot reach the destination on foot from here at all —
  // he is on one-way ground and `wayOut` owns him. Answer with the nearest
  // cell that does have one, so the trace still points somewhere sane while
  // the escape heading does the work.
  let best = null, bd = Infinity;
  for (let j = bj - REACH_CELLS; j <= bj + REACH_CELLS; j++) {
    if (j < 0 || j >= N) continue;
    for (let i = bi - REACH_CELLS; i <= bi + REACH_CELLS; i++) {
      if (i < 0 || i >= N) continue;
      const d = F.D[IDX(i, j)];
      if (!Number.isFinite(d)) continue;
      const cost = d + Math.hypot(CX(i) - x, CZ(j) - z) * 2.2;
      if (cost < bd) { bd = cost; best = [i, j]; }
    }
  }
  return best || anchorRaw(bi, bj, MAIN);
}

/** One step down the field. Returns the next cell, or null at the sink. */
function downhill(F, i, j) {
  let best = null, bd = F.D[IDX(i, j)];
  for (let b = 0; b < NB.length; b++) {
    const ni = i + NB[b][0], nj = j + NB[b][1];
    if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
    const nk = IDX(ni, nj);
    if (!Number.isFinite(F.D[nk]) || F.D[nk] >= bd) continue;
    if (!Number.isFinite(stepCost(i, j, ni, nj, b))) continue;
    bd = F.D[nk]; best = [ni, nj];
  }
  return best;
}

/**
 * A walkable line from here to there, as waypoints in world metres.
 *
 * Returns `null` only when the island has no walkable ground at all to anchor
 * the destination on — i.e. before there is a world. The line is the field's
 * own descent, then thinned so straight runs are one segment: a caller wants
 * "the next place to aim at", not four hundred cells.
 */
export function routeFrom(ax, az, bx, bz) {
  build();
  const F = fieldFor(bx, bz);
  if (!F) return null;
  const st = standIn(F, ax, az);
  if (!st) return null;
  const cells = [];
  let [i, j] = st;
  let metres = 0;
  for (let n = 0; n < 4096; n++) {
    cells.push([CX(i), H[IDX(i, j)], CZ(j)]);
    const nx = downhill(F, i, j);
    if (!nx) break;
    metres += Math.hypot(CX(nx[0]) - CX(i), CZ(nx[1]) - CZ(j));
    i = nx[0]; j = nx[1];
  }
  if (!cells.length) return null;
  // thin: keep a point only where the line actually turns
  const pts = [];
  for (let k = 0; k < cells.length; k++) {
    if (k === 0 || k === cells.length - 1) { pts.push(cells[k]); continue; }
    const p = cells[k - 1], c = cells[k], nn = cells[k + 1];
    const a1 = Math.atan2(c[0] - p[0], c[2] - p[2]);
    const a2 = Math.atan2(nn[0] - c[0], nn[2] - c[2]);
    const d = ((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(d) > 0.24) pts.push(c);
  }
  return { points: pts, cells, metres };
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
  build();
  const straight = { yaw: Math.atan2(tx - fx, tz - fz), metres: Math.hypot(tx - fx, tz - fz), routed: false };
  const F = fieldFor(tx, tz);
  if (!F) {
    const o0 = wayOut(fx, fz);
    return o0 ? { yaw: o0.yaw, metres: straight.metres, routed: true, escaping: true } : straight;
  }
  // ---- THE ESCAPE IS THE LAST ANSWER, NOT THE FIRST ----------------------
  //
  // A cadet standing on one-way ground still has to be told which way to go,
  // and this used to ask `escapable` FIRST: on ground it called one-way the
  // answer was the way OUT, and everywhere else the way ON.
  //
  // That is a hard boundary through the middle of a walk, and a cadet standing
  // on it gets told both. Followed at the boots' own step size, a cadet at
  // (31, −82) turned through 180° every few frames for as long as the key was
  // held — `esc` flipping true/false under his boots as he shuffled — fifty-one
  // metres from the tear, on ground at gradient 0.4. Same symptom as the report,
  // third distinct cause.
  //
  // The cure is to ask the question that actually decides it. The cost-to-go
  // field covers every cell the boots can reach the destination FROM (see
  // `stepCost`), so `D` being finite where he stands IS "there is a way on from
  // here" — and where there is a way on, the way out is not the answer, whatever
  // `escapable` says about the plaza. One test, no boundary, no flip.
  const own = IDX(Math.max(0, Math.min(N - 1, CELL_I(fx))), Math.max(0, Math.min(N - 1, CELL_J(fz))));
  if (!Number.isFinite(F.D[own])) {
    const out = wayOut(fx, fz);
    if (out) return { yaw: out.yaw, metres: straight.metres, routed: true, escaping: true };
  }
  const st = standIn(F, fx, fz);
  if (!st) return straight;
  // ---- AIM AS FAR DOWN THE ROUTE AS THE GROUND ALLOWS -------------------
  //
  // The route is a chain of 1.4 m steps and every one of them is walkable, but
  // the STRAIGHT LINE from the cadet to a point eight metres along that chain
  // is not the chain: round the nose of a spur it cuts the corner, and the
  // corner is the spur. That is a heading that points at a wall while the route
  // under it is perfect, and it is the last way this file can lie.
  //
  // So the aim is string-pulled: walk the chain, and keep moving the aim
  // forward only while the direct line to it is ground a cadet can walk. The
  // result is the furthest point he can head straight for — long enough that
  // the arrow reads as a direction rather than a twitch, and never through
  // anything.
  let [i, j] = st;
  let metres = 0;
  let aim = null;
  const chain = [];
  for (let n = 0; n < 512; n++) {
    const nx = downhill(F, i, j);
    if (!nx) break;
    metres += Math.hypot(CX(nx[0]) - CX(i), CZ(nx[1]) - CZ(j));
    i = nx[0]; j = nx[1];
    if (chain.length < 40) chain.push([CX(i), CZ(j)]);
  }
  for (const c of chain) {
    if (!clearLine(fx, fz, c[0], c[1])) break;
    aim = c;
    if (Math.hypot(c[0] - fx, c[1] - fz) > 12) break;
  }
  // ---- AND NEVER AT SOMETHING A METRE AWAY -------------------------------
  //
  // If the string-pull cannot reach even the first cell — the cadet is standing
  // on ground the direct line rule refuses, which happens on the lip of a bank
  // — the fallback used to be `chain[0]`, the very next cell. That cell's
  // centre can be 40 cm from his boots, and the BEARING to a point 40 cm away
  // swings through a hundred and eighty degrees while he shuffles inside his
  // own cell. A cadet at (31, −82), on ground at gradient 0.4, fifty-one metres
  // from the tear, with a stable 118 m route under him, was handed 0.38, 0.35,
  // −3.14 and −0.79 rad in four consecutive samples for exactly this reason.
  //
  // An aim has to be far enough away to be a direction. Four metres is under a
  // second of running and over the width of the cell he is standing in.
  if (!aim) {
    for (const c of chain) {
      aim = c;
      if (Math.hypot(c[0] - fx, c[1] - fz) > AIM_MIN) break;
    }
  }
  const total = metres + Math.hypot(CX(i) - tx, CZ(j) - tz);
  if (!aim) return { yaw: straight.yaw, metres: Math.max(straight.metres, total), routed: true };
  return { yaw: Math.atan2(aim[0] - fx, aim[1] - fz), metres: Math.max(straight.metres, total), routed: true };
}

/**
 * Is the straight line between two points ground a cadet can simply walk?
 *
 * Sampled on the fine field at its own spacing, so nothing narrower than the
 * boots' own measuring baseline can hide in it: every sample has to be on the
 * island, under `STAND`, and within a stride's rise of the one before it.
 */
function clearLine(ax, az, bx, bz) {
  const L = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(L / E));
  // The first sample is the ground under his own boots. Whether THAT is over
  // the limit is not a fact about the line — he is on it either way, and a
  // cadet on a 1.35 slope who is refused every direction because of the slope
  // he is standing on is the trap this file exists to remove.
  let prev = null;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const i = Math.round((x + HALF) / E), j = Math.round((z + HALF) / E);
    if (i < 0 || j < 0 || i >= FN || j >= FN) return false;
    const f = FIDX(i, j);
    const h = FH[f];
    if (Number.isNaN(h) || FG[f] > STAND) return false;
    if (prev !== null && Math.abs(h - prev) > CLIMB * (L / n) + 0.35) return false;
    prev = h;
  }
  return true;
}

/** How far it really is on foot. Straight-line when nothing joins them. */
export function walkMetres(ax, az, bx, bz) {
  const r = routeFrom(ax, az, bx, bz);
  return r ? r.metres : Math.hypot(bx - ax, bz - az);
}

/** Diagnostics for the gate: the shape of the island's walkability. */
export function routeStats() {
  build();
  let ground = 0, home = 0, walk = 0, main = 0, stand = 0, trapped = 0;
  for (let k = 0; k < N * N; k++) {
    if (Number.isNaN(H[k])) continue;
    ground++;
    if (HOME[k]) home++;
    if (WALK[k]) walk++;
    if (MAIN[k]) main++;
    if (G[k] <= STAND) { stand++; if (!HOME[k]) trapped++; }
  }
  return {
    step: S, fine: E, cells: N * N, ground, home, walk, main, stand,
    oneWay: ground - home, oneWayShare: (ground - home) / Math.max(1, ground),
    // The number the report was really about: ground a cadet can stand still on
    // and cannot walk home from. A trap is flat; a cliff is not a trap.
    trapped, trappedShare: trapped / Math.max(1, stand),
    limits: { stand: STAND, face: FACE, climb: CLIMB },
  };
}
