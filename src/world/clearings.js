import * as THREE from 'three';

/**
 * THE CLEARINGS — a monument stands in a clearing, and the game says so.
 *
 * WHY THIS FILE EXISTS
 *
 * The composition gate (tools/critic/compose.mjs) walks to every objective the
 * world seats, from eight bearings, on real keys, and asks the project's own
 * escape predicate whether the frame is a frame. On the build this file was
 * written against it answered no for **202 of 391 frames** — and 65 of those
 * were taken standing *on* the objective.
 *
 * The reason was not the terrain. Measured, with the heightfield and the
 * scatter separated: of 111 readings of *walled in* around the seated
 * objectives, the heightfield alone would have failed **four**. The other 107
 * were scatter — trees, boles and boulders, standing where the world had just
 * put a monument. One spruce stood 1.4 m from the centre of the `one-step-mul`
 * dais, and a cadet who walked to the objective the game had sent him to was
 * standing inside it.
 *
 * That is an ordering problem with no fix inside either module. `props.js`
 * scatters eleven thousand plants before `rifts.js` has laid the knowledge
 * lattice on the ground, before a waygate has picked a shore and before the
 * errand has chosen a mark — so no placement rule in the scatter can know
 * where the objectives will be, and no seating rule in the lattice can know
 * which trees are already there.
 *
 * So the clearing is cut afterwards, which is also how it works on a real
 * site: you put the monument where the monument belongs and then you clear
 * around it. Every system that seats something the game *sends a cadet to*
 * calls `reserve()`; every scatter batch that is scenery rather than furniture
 * calls `carveable()`; and `carve()` — run once from the world's first frame,
 * when everything has finished seating — takes the trees out of the room.
 *
 * WHAT IT IS NOT. It is not a bulldozer. `R_OPEN` is the radius that is
 * actually cleared and it is small: eleven metres, which is the dais, its four
 * pillars and one pace beyond them. Out to `R_EDGE` the wood *thins* rather
 * than stops, on a per-instance hash so the edge is ragged instead of a
 * circle, and beyond `R_EDGE` nothing is touched at all. The island keeps its
 * cover; what it loses is the cover that was standing on the furniture.
 *
 * COMPACTION, NOT ZEROING. An instance is removed by moving the survivors down
 * over it and lowering `InstancedMesh.count`. Scaling an instance to zero
 * leaves a singular matrix in the buffer, which `Mesh.raycast` inverts — every
 * camera probe and every escape reading in the project would then be casting
 * against NaN. Lowering the count is what three.js documents for this and it
 * costs nothing per frame.
 */

/**
 * Cleared outright.
 *
 * ELEVEN METRES WAS NOT ENOUGH AND THE GATE SAID SO. A dais is 7.2 m of stone
 * with pillars at 6.4, so eleven cleared the furniture — and the composition
 * gate does not read the frame on the plate alone. It walks in from a ring
 * SEVENTEEN metres out, reads the frame there, twice more on the way in, and
 * again standing on it. At eleven, three of those four readings were taken from
 * inside the wood. The room the game hands a cadet has to be the whole approach
 * or the approach is a corridor with a photograph at the end of it.
 */
const R_OPEN = 18;
/** Thinned between `R_OPEN` and here, on a ragged edge. */
const R_EDGE = 30;

/** Every batch that has said it is scenery. */
const batches = [];
/** Every place the game routes a cadet to. */
const sites = [];
/** How many of `sites` the carve has already spent. */
let spent = 0;

/**
 * This batch is scenery and may be thinned around an objective.
 *
 * Furniture — a rift's own dais, a waygate's frame, a cache, anything a player
 * is meant to walk up to — must NOT call this, or the clearing would eat the
 * thing it is being cut for.
 */
export function carveable(mesh) {
  if (!mesh || !mesh.isInstancedMesh) return mesh;
  mesh.userData.carveable = true;
  batches.push(mesh);
  return mesh;
}

/**
 * A place the game sends a cadet to. `r` is how much of the clearing this site
 * needs cleared outright — the default is the size of a tear's plate.
 */
export function reserve(x, z, r = R_OPEN, kind = 'site') {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  // the same site twice is one site
  for (const s of sites) {
    if (Math.hypot(s.x - x, s.z - z) < 1.5) { s.r = Math.max(s.r, r); return; }
  }
  sites.push({ x, z, r, kind });
}

/** What the world has reserved, for anything that wants to read it. */
export function reserved() { return sites.slice(); }

/**
 * 0 where the wood is untouched, 1 in the open ground at the middle of a
 * clearing. Read by the carve, and available to anything else that wants to
 * know whether it is standing in a room or in a wood.
 */
export function clearingAt(x, z) {
  let m = 0;
  for (const s of sites) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d >= R_EDGE) continue;
    const t = d <= s.r ? 1 : 1 - (d - s.r) / Math.max(0.001, R_EDGE - s.r);
    if (t > m) m = t;
  }
  return m;
}

// A stable per-position hash, so the ragged edge of a clearing is the same
// ragged edge on every boot and does not crawl when the carve runs again.
const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();

/**
 * Take the scenery out of the rooms. Idempotent: only reservations that have
 * not been carved yet are spent, so a site that moves mid-session (an errand
 * mark, a relocalised span) cuts its own clearing and nothing else moves.
 */
export function carve() {
  if (spent >= sites.length || !batches.length) return 0;
  const fresh = sites.slice(spent);
  spent = sites.length;
  let cut = 0;
  for (const mesh of batches) {
    let keep = 0;
    const n = mesh.count;
    for (let i = 0; i < n; i++) {
      mesh.getMatrixAt(i, _m);
      _p.setFromMatrixPosition(_m);
      let drop = false;
      for (const s of fresh) {
        const d = Math.hypot(_p.x - s.x, _p.z - s.z);
        if (d >= R_EDGE) continue;
        if (d <= s.r) { drop = true; break; }
        // Ragged, not circular: the further out, the likelier it stays. The
        // curve is LINEAR rather than squared, which keeps about twice as much
        // of the wood in the band — the clearing got wider, so the edge is
        // allowed to be softer, and the island keeps its cover.
        const t = (d - s.r) / (R_EDGE - s.r);
        if (hash(_p.x, _p.z) > t) { drop = true; break; }
      }
      if (drop) { cut++; continue; }
      if (keep !== i) mesh.setMatrixAt(keep, _m);
      keep++;
    }
    if (keep !== n) {
      mesh.count = keep;
      mesh.instanceMatrix.needsUpdate = true;
      // the batch is smaller than the sphere three.js computed for it
      mesh.computeBoundingSphere?.();
    }
  }
  return cut;
}

// ---------------------------------------------------------------------------
// GROUND THAT DOES NOT HOLD YOU
//
// An updraft is a column of rising air with a lit ring on the ground naming the
// spot (src/world/drift.js). Stand in one and it takes you sixty metres up,
// which is the point of it — and which means that for as long as you are in it
// you are not standing on anything.
//
// The composition gate walks to every objective from eight bearings, and it
// walked into two of these: `y 92, ground 55.9`, a cadet thirty-seven metres in
// the air at the ring of a waygate, reading `not standing on a surface` at
// fourteen separate samples. He was not stuck. He was flying, at the exact spot
// the game had told him to walk to.
//
// So a column registers itself here, the seating searches keep clear of it, and
// `pushOutOfRooms` moves a column that would otherwise be planted inside a room
// that was reserved before it.
// ---------------------------------------------------------------------------

const lifts = [];

/** A column of rising air. `r` is its own radius; the margin is the caller's. */
export function lift(x, z, r) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !(r > 0)) return;
  lifts.push({ x, z, r });
}

/** Metres a point lies inside the nearest column, widened by `margin`. */
export function liftAt(x, z, margin = 0) {
  let m = 0;
  for (const l of lifts) {
    const d = (l.r + margin) - Math.hypot(x - l.x, z - l.z);
    if (d > m) m = d;
  }
  return m;
}

/**
 * Move a point out of any room that has already been reserved, along the
 * bearing away from that room's middle. `pad` is how much clear ground the
 * thing being planted needs beyond the room itself.
 *
 * Written for the updrafts, which are planted from `src/main.js` at fixed
 * coordinates chosen for the flying, and which have to yield when the lattice
 * happens to seat a tear on top of one.
 */
export function pushOutOfRooms(x, z, pad = 0) {
  let out = { x, z };
  for (let pass = 0; pass < 4; pass++) {
    let worst = null, worstD = 0;
    for (const s of sites) {
      const dx = out.x - s.x, dz = out.z - s.z;
      const d = Math.hypot(dx, dz);
      const need = s.r + pad - d;
      if (need > worstD) { worstD = need; worst = { s, dx, dz, d }; }
    }
    if (!worst) return out;
    const { s, dx, dz, d } = worst;
    const ux = d > 0.01 ? dx / d : 1, uz = d > 0.01 ? dz / d : 0;
    out = { x: s.x + ux * (s.r + pad + 0.5), z: s.z + uz * (s.r + pad + 0.5) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE OTHER HALF: WHERE A MONUMENT MAY NOT BE PUT
//
// A clearing takes the scenery out of a room. It cannot take an AQUEDUCT out of
// one — merged stonework is one mesh with no instances to drop, and it should
// not be dropped anyway; it is a landmark, and a landmark is the reason to walk
// somewhere. What has to move is the objective.
//
// This registry is the standing structure, declared by the module that builds
// it, so the seating searches in src/world/rifts.js and src/world/waygate.js
// can refuse to put a tear or a gate inside it. It runs the right way round in
// time: every one of these is built inside `createWorld`, and every objective
// is seated after it returns.
//
// The composition gate found the case that made this necessary. `like-terms`
// seated eight metres from a pier of the aqueduct, and a cadet walking in on
// that bearing ended up INSIDE the pier: every one of the escape instrument's
// seventeen probe directions blocked between 0.5 m and 6.5 m, straight up
// included.
// ---------------------------------------------------------------------------

const built = [];

/** A piece of standing structure an objective may not be seated in. */
export function obstruct(x, z, r) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !(r > 0)) return;
  built.push({ x, z, r });
}

/**
 * Metres a point lies inside the nearest registered structure, 0 if it is
 * outside all of them. Callers use it as a veto AND as a cost, because "just
 * outside the pier" is barely better than "in it".
 */
export function obstructionAt(x, z) {
  let m = 0;
  for (const b of built) {
    const d = b.r - Math.hypot(x - b.x, z - b.z);
    if (d > m) m = d;
  }
  return m;
}

/** For tests and for a world that is rebuilt inside one page. */
export function resetClearings() {
  batches.length = 0; sites.length = 0; built.length = 0; lifts.length = 0; spent = 0;
}
