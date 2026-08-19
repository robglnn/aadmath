/**
 * WHAT "ESCAPED" MEANS, WRITTEN DOWN ONCE.
 *
 * The Esc card promises: *"Recover puts you back on solid ground from anywhere —
 * off the edge of the shard, inside a hill."* For four rounds the code behind
 * that sentence, and the gate that certified it, both measured **displacement**.
 * A cold critic wrote the refutation for us: *"Moving 3.5 m inside a hill is
 * still inside the hill."* He pressed R three times from inside a landmark, was
 * set down 3.5 m along, and the frame stayed a black mush both times. The HUD
 * said BACK ON OPEN GROUND over the top of it.
 *
 * Displacement was never the promise. **Escape** is, and escape is five facts,
 * all of which have to be true at once:
 *
 *   1. THERE IS GROUND UNDER THE BOOTS. The heightfield or the built lattice
 *      answers at this column, the cadet's feet are on that surface, and the
 *      surface is walkable rather than a face he will slide off.
 *   2. HE IS NOT INSIDE IT. No terrain over his head, no built panel through
 *      his chest, and no drawn solid — a boulder, a hoodoo, an arch, the
 *      cathedral — containing his body. **This is the fact the old code never
 *      checked at all**: collision on this island is a heightfield plus the
 *      lattice, and every landmark and every scatter prop is drawn with no
 *      collider whatsoever. `heightAt` says "solid ground" from the middle of a
 *      forty-metre monolith, and it was the only question being asked.
 *   3. THE LENS IS NOT INSIDE ANYTHING EITHER. Being free with the camera still
 *      buried is, to the player, not being free.
 *   4. HE CAN SEE OUT. Not "the camera is technically in air" — **open sky or
 *      open country in a usable share of the directions around him**, which is
 *      the difference between standing on a hillside and standing in a cave of
 *      backfaces.
 *   5. THE LENS IS OFF HIS SHOULDER. The second half of the same report: "that
 *      time R moved me but jammed the camera into my own avatar's shoulder."
 *
 * This module answers 1–4 for any point in the world, and finds the nearest
 * point that satisfies all of them. Point 5 belongs to the lens and lives in
 * camera.js, which is handed the bearing this module found to be open.
 *
 * ---------------------------------------------------------------------------
 * HOW A DRAWN SOLID IS SEEN, GIVEN THAT NOTHING COLLIDES WITH IT
 *
 * By raycast, against the same scene the player is looking at — with one
 * correction that matters more than anything else here. A ray leaving the
 * inside of a closed shape hits only its BACK faces, and a front-side raycast
 * is blind to those. So a naive "how far can I see" probe stands in the middle
 * of the cathedral, looks straight through its own walls, and reports open
 * country. Every material on the probe list is therefore flipped to
 * `DoubleSide` for the duration of the measurement and put back before the
 * frame is drawn. Nothing is rendered in between, and `side` is not part of
 * the program cache key, so this costs nothing and changes no pixel.
 *
 * The island's own shell is deliberately NOT on that list. It is the one mesh
 * big enough for raycasting to show up in a frame budget, and the heightfield
 * is an exact, cheaper answer for the same geometry — so terrain is marched
 * analytically and everything else is cast.
 */
import * as THREE from 'three';
import { heightAt, slopeAt, solids } from './terrain.js';

/** Eye height up the cadet — the height the view is judged from. */
const EYE = 1.46;
/** How far a direction has to reach before it counts as "you can see out". */
const OPEN_M = 22;
/** …and how far the best of them has to reach before it counts as a horizon. */
const VISTA = 90;
/** The shortest sightline a recovery is allowed to hand back. */
const VISTA_MIN = 48;
/**
 * The share of the directions around him that a recovery site has to leave open.
 *
 * THE GATE FAILS AT 0.30, AND THIS IS HIGHER ON PURPOSE. A site accepted at
 * exactly the number the instrument rejects at is a site that passes or fails on
 * which of seventeen probe rays happens to clip a branch, and the first run
 * after this one duly came back with "only 29% of the directions around him are
 * open" — one ray. Scraping a bar is not clearing it, and a fix that lands on
 * the bar has to be re-fixed every time either side moves. Four sevenths of the
 * horizon is also simply what the promise sounds like.
 */
const OPEN_MIN = 0.36;
/** Directions probed around the cadet: 12 level, 4 raised, 1 straight up. */
const DIRS = [];
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  DIRS.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
}
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * Math.PI * 2 + 0.4;
  const c = Math.cos(0.5);
  DIRS.push(new THREE.Vector3(Math.cos(a) * c, Math.sin(0.5), Math.sin(a) * c));
}
DIRS.push(new THREE.Vector3(0, 1, 0));

/** The six ways out of a boulder, for the "is this point inside one" test. */
const AXES = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];

let _scene = null;
const _ray = new THREE.Raycaster();
const _o = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _c = new THREE.Vector3();
let _list = [];
let _listAt = new THREE.Vector3(1e9, 1e9, 1e9);
let _listT = -1e9;
const _sides = [];

/** Handed the scene once, from the controller. Optional by construction. */
export function attachScene(scene) { _scene = scene; }

/**
 * PLACES THE WORLD WILL NOT LET A CADET STAND STILL.
 *
 * Registered from main.js rather than imported, for the same reason `setSolids`
 * is: the player must not have to know the world team's modules exist, and a
 * world that has no such places must cost nothing.
 *
 * THIS EXISTS BECAUSE OF ONE MEASURED FAILURE, AND IT IS WORTH WRITING DOWN.
 * The cold-play gate reported *"the RECOVER button at −87.5, 67.3 left the
 * cadet walled in: only 29% of the directions around him are open"*, and, in
 * the same breath, *"the island carried him upward from the spot Recover chose
 * (39.6 m -> 46.7 m in 0.4 s with vel.y −0.9)"*. Both are true and only one of
 * them is about this module. There is a standing updraft on that ground
 * (src/world/drift.js writes `pos.y` directly, seventeen metres a second, which
 * is why the cadet's own velocity stays negative while he climbs). The search
 * had chosen a site that satisfies every clause of escape, and four tenths of a
 * second later the cadet was thirty feet up and still going.
 *
 * A thermal is a good thing and it is not a recovery. "Back on solid ground"
 * cannot mean "airborne again before you have let go of the key" — a player who
 * presses Recover and is immediately thrown into the sky has not been recovered,
 * he has been launched, and the next thing he does is press it again. So a
 * column of rising air is not a place to be put down, and the search steps
 * around it exactly as it steps around a boulder.
 */
let LIFTS = null;
export function setLifts(fn) { LIFTS = fn; }

/**
 * Every drawn solid near a point that a cadet or a lens could be inside of.
 *
 * Cached for a beat and for a place, because a recovery probes a few dozen
 * candidate sites in one press and they are all within a few metres of each
 * other. The island shell is excluded on triangle count — the heightfield is
 * the exact answer for it and a hundred times cheaper.
 */
function blockers(x, y, z) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (_scene && (now - _listT > 1500 || _listAt.distanceToSquared(_o.set(x, y, z)) > 900)) {
    _listT = now;
    _listAt.set(x, y, z);
    const out = [];
    _scene.traverse((ob) => {
      if (out.length >= 96) return;
      if (!ob.visible || !ob.isMesh || ob.userData.noCamBlock) return;
      const m = ob.material;
      if (!m) return;
      const mats = Array.isArray(m) ? m : [m];
      for (const q of mats) {
        if (!q || q.transparent || q.depthWrite === false || q.wireframe) return;
      }
      const g = ob.geometry;
      if (!g) return;
      const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
      // The island itself, the sky, the far worlds: answered analytically, or
      // not something anyone can be inside of.
      if (!tris || tris > 30000) return;
      if (ob.isInstancedMesh) { out.push(ob); return; }
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere;
      if (!bs) return;
      ob.updateWorldMatrix(true, false);
      _sc.setFromMatrixScale(ob.matrixWorld);
      const r = bs.radius * Math.max(_sc.x, _sc.y, _sc.z);
      if (r < 0.5 || r > 300) return;
      _c.copy(bs.center).applyMatrix4(ob.matrixWorld);
      if (_c.distanceToSquared(_listAt) > (90 + r) * (90 + r)) return;
      out.push(ob);
    });
    _list = out;
  }
  return _list;
}

/** Flip the probe list double-sided; see the header for why this is the whole
 *  difference between seeing a wall and looking through it. */
function twoSided(list) {
  _sides.length = 0;
  for (const ob of list) {
    const mats = Array.isArray(ob.material) ? ob.material : [ob.material];
    for (const q of mats) { _sides.push(q, q.side); q.side = THREE.DoubleSide; }
  }
}
function restore() {
  for (let i = 0; i < _sides.length; i += 2) _sides[i].side = _sides[i + 1];
  _sides.length = 0;
}

/** Distance to the first drawn solid along a ray, or `far`. Caller has already
 *  flipped the list; this is the inner loop of everything below. */
function castOne(x, y, z, d, list, far) {
  _ray.near = 0.02;
  _ray.far = far;
  _ray.set(_o.set(x, y, z), d);
  const h = _ray.intersectObjects(list, false);
  return h.length ? h[0].distance : far;
}

/**
 * Does the island itself rise above the line of sight within `far` metres?
 *
 * The heightfield's own version of "you cannot see out this way", marched
 * rather than cast because the terrain shell is the one mesh worth not casting.
 */
function terrainBlocks(x, y, z, d, far) {
  if (d.y > 0.35) return false;              // looking up out of a bowl
  for (let s = 2; s <= far; s += 2.5) {
    const h = heightAt(x + d.x * s, z + d.z * s);
    if (h === null) continue;
    if (h > y + d.y * s + 0.5) return true;
  }
  return false;
}

/**
 * How much of the world this point can see: 0 (a cave of backfaces) to 1.
 *
 * Both instruments have to agree that a direction is open — no drawn solid
 * within `OPEN_M`, and no hillside across the line either.
 */
export function openness(x, y, z) {
  const list = blockers(x, y, z);
  if (!list.length && !_scene) return 1;
  twoSided(list);
  let open = 0;
  try {
    for (const d of DIRS) {
      if (castOne(x, y, z, d, list, OPEN_M) < OPEN_M) continue;
      if (terrainBlocks(x, y, z, d, OPEN_M)) continue;
      open++;
    }
  } finally { restore(); }
  return open / DIRS.length;
}

/**
 * The longest thing this point can see, in metres, capped at `VISTA`.
 *
 * `openness` counts how MANY ways out there are; this asks how FAR the best one
 * goes, and the two are not the same question. A cadet in a shallow bowl with
 * hills at twenty metres on every side scores well on the first and has no
 * horizon at all — which on screen is a frame with nothing in it further away
 * than the next hummock, and is what a player means by "I cannot see where I
 * am". A recovery has to hand back a horizon, not just headroom.
 */
export function vista(x, y, z) {
  const list = blockers(x, y, z);
  twoSided(list);
  let best = 0;
  try {
    for (let i = 0; i < 12; i++) {
      const d = DIRS[i];
      let far = castOne(x, y, z, d, list, VISTA);
      for (let s = 4; s <= far; s += 4) {
        const h = heightAt(x + d.x * s, z + d.z * s);
        if (h !== null && h > y + 0.5) { far = s; break; }
      }
      if (far > best) best = far;
    }
  } finally { restore(); }
  return best;
}

/**
 * Is this point inside a drawn solid?
 *
 * Inside a boulder every way out is short. This is the close-range half of the
 * question; `openness` is the long-range half, and a cadet standing in the nave
 * of a cathedral fails the second while passing the first.
 */
export function insideSolid(x, y, z, r = 1.1) {
  const list = blockers(x, y, z);
  if (!list.length) return false;
  twoSided(list);
  try {
    for (const d of AXES) {
      if (castOne(x, y, z, d, list, r) >= r) return false;
    }
  } finally { restore(); }
  return true;
}

/**
 * Everything that has to be true about a place before a cadet may be put down
 * on it. Returns a verdict object rather than a boolean, so the gate, the HUD
 * and this module's own search all read the same reasons.
 *
 * `full` runs the two raycast tests. They cost about a millisecond each and a
 * ring search asks about thirty candidates, so the cheap analytic facts are
 * asked first and only the survivors are cast at.
 */
export function siteVerdict(x, z, full = true) {
  const h = heightAt(x, z);
  if (h === null) return { ok: false, why: 'no ground' };
  const y = h + 0.55;
  // 1 — walkable, not a face he slides off and back into whatever held him.
  const slope = slopeAt(x, z);
  if (slope > 0.85) return { ok: false, why: 'too steep', slope };
  // 1b — and the world will let him stand still on it. See `setLifts`.
  if (LIFTS && LIFTS(x, y, z)) return { ok: false, why: 'in a rising column', slope, y };
  // 2a — nothing of the island over his head, out to his own width.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = heightAt(x + Math.cos(a) * 0.5, z + Math.sin(a) * 0.5);
    if (g !== null && g > y + 1.9) return { ok: false, why: 'buried' };
  }
  // 2b — and none of his own lattice through him.
  const S = solids();
  if (S && S.count) {
    for (const dy of [0.25, 1.0, 1.7]) {
      if (S.contains(x, y + dy, z, 0.28)) return { ok: false, why: 'in a wall' };
    }
  }
  if (!full) return { ok: true, why: '', slope, y, open: null };
  // 2c — and he is not standing in the middle of a rock that has no collider.
  if (insideSolid(x, y + 0.9, z)) return { ok: false, why: 'in a solid', slope, y };
  // 3/4 — and the lens can be put somewhere he can see the world from.
  // …FROM WHERE HIS EYES WILL ACTUALLY BE. `y` above is the spawn height —
  // half a metre of clearance so he is not set down inside the ground — and the
  // collider drops him onto the surface on the next frame. Probing from the
  // spawn height put every sightline in this module 55 cm higher than the
  // camera ever sits, which is the difference between seeing over a bank and
  // seeing the bank. The eye is measured from the SURFACE.
  const eye = y - 0.55 + EYE;
  const open = openness(x, eye, z);
  if (open < OPEN_MIN) return { ok: false, why: 'walled in', slope, y, open };
  const far = vista(x, eye, z);
  if (far < VISTA_MIN) return { ok: false, why: 'no horizon', slope, y, open, far };
  return { ok: true, why: '', slope, y, open, far };
}

/**
 * The bearing, from a point, with the most world in front of it.
 *
 * A recovery that puts a cadet down facing a wall has technically escaped and
 * has not visibly escaped. The camera sits behind the cadet, so the bearing
 * returned here is the one the boom will have room in as well.
 */
export function openBearing(x, y, z) {
  const list = blockers(x, y, z);
  twoSided(list);
  const ranked = [];
  try {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = DIRS[i];
      // How far the cadet can see ahead, and how much room the boom has behind.
      let ahead = castOne(x, y, z, d, list, VISTA);
      for (let s = 4; s <= ahead; s += 4) {
        const h = heightAt(x + d.x * s, z + d.z * s);
        if (h !== null && h > y + 0.5) { ahead = s; break; }
      }
      const back = DIRS[(i + 6) % 12];
      const room = Math.min(castOne(x, y, z, back, list, 6),
        terrainBlocks(x, y, z, back, 6) ? 1 : 6);
      // World bearings in this game are `atan2(sin, cos)` on (x, z) with yaw
      // measured from +z, which is the controller's own forward vector.
      ranked.push({ yaw: Math.atan2(Math.cos(a), Math.sin(a)), ahead, room, score: ahead + room * 2.5 });
    }
  } finally { restore(); }
  ranked.sort((p, q) => q.score - p.score);
  // The best bearing that also leaves the LENS somewhere legal. Facing the
  // longest view is worth nothing if the boom behind it is inside a wreck: the
  // solver in camera.js will pull the lens in until it is off his shoulder,
  // which is the reported defect arriving by a different road.
  for (const r of ranked) if (lensClear(x, y, z, r.yaw)) return r;
  return ranked[0];
}

/**
 * The boom length camera.js will actually settle on, from here, facing this
 * way — computed with camera.js's own march rather than guessed at.
 *
 * Checking only that the far END of the boom is above ground is not enough and
 * was letting the jam straight through: the march keeps a running maximum of
 * how high the lens would have to sit to clear every metre of ground it has
 * passed over, and gives up when that climb outgrows its budget. Stand at the
 * foot of a bank facing away from it and the endpoint four metres back is in
 * clean air a long way up the slope, while the boom the solver can actually
 * reach is one metre seventy — which is a shot of a pauldron.
 */
function boomRoom(x, y, z, yaw) {
  const MIN_BOOM = 1.85, CLEAR = 0.72, REACH = 3.80, STEPS = 12;
  const pitch = -0.14, cp = Math.cos(pitch);
  const dx = Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = Math.cos(yaw) * cp;
  let hit = MIN_BOOM, run = 0;
  for (let i = 0; i <= STEPS; i++) {
    const f = MIN_BOOM + (i / STEPS) * (REACH - MIN_BOOM);
    const h = heightAt(x - dx * f, z - dz * f);
    if (h !== null) run = Math.max(run, (h + CLEAR) - (y - dy * f));
    if (run > 0.50 + f * 0.46) break;
    hit = f;
  }
  const list = blockers(x, y, z);
  twoSided(list);
  try {
    const solid = castOne(x, y, z, _fd.set(-dx, -dy, -dz), list, REACH);
    if (solid < REACH) hit = Math.min(hit, Math.max(1.05, solid - 0.34));
  } finally { restore(); }
  return hit;
}

/**
 * Where the lens ends up if the cadet stands here facing this way — and whether
 * that is anywhere it may be.
 *
 * The numbers are camera.js's own rest pose: a 3.80 m boom at the −0.14 rest
 * pitch, aimed at a point 1.46 m up the cadet — so from the aim point the lens
 * sits 3.85 m back and about half a metre up. `y` here is that aim point, the
 * same eye height every other probe in this module is taken from.
 *
 * This deliberately asks about the FULL boom rather than the one the solver
 * would settle on: the solver's answer to a blocked boom is to shorten it, and
 * a shortened boom is precisely the shot the player complained about.
 */
export function lensClear(x, y, z, yaw) {
  const lx = x - Math.sin(yaw) * 3.85;
  const lz = z - Math.cos(yaw) * 3.85;
  const ly = y + 0.53;
  const h = heightAt(lx, lz);
  if (h !== null && ly < h + 0.72) return false;
  const S = solids();
  if (S && S.count && S.contains(lx, ly, lz, 0.24)) return false;
  if (insideSolid(lx, ly, lz, 0.9)) return false;
  if (openness(lx, ly, lz) < 0.28) return false;
  // …and the solver has to be able to get the lens out that far in the first
  // place. 2.4 m is comfortably clear of the cadet's own silhouette; the gate
  // fails a shot at 2.2.
  if (boomRoom(x, y, z, yaw) < 2.4) return false;
  return frameClear(x, y, z, yaw);
}

const _fd = new THREE.Vector3();
/**
 * …AND THE LAST QUESTION IS THE ONLY ONE THE PLAYER ASKS: **what is in the
 * frame?**
 *
 * Every test above this one is about points — is the cadet inside something, is
 * the lens inside something, how many directions around him are open. A site
 * can pass all of them and still hand back a shot that is two-fifths hull
 * plating at arm's length, because the frame is not a point: it is a hundred
 * degrees wide, and the wreck the cadet just walked out of is still standing in
 * most of it. That is what a critic means by "I still could not see", and it
 * kept passing at the site called `60.6,81.4`.
 *
 * So this casts the actual shot. The lens goes where camera.js's rest pose puts
 * it, a five-by-four grid is cast across the real field of view — 70° vertical,
 * which at 16:9 is a hundred and two horizontal — and a ray counts against the
 * frame when it stops inside three metres AT OR ABOUT THE HEIGHT OF THE LENS.
 * Ground below knee height is the world he is standing on, not a wall; that
 * distinction is the difference between rejecting a cave and rejecting every
 * hillside on the island.
 */
/**
 * How much of the SHIPPED frame is a wall at arm's length — measured off the
 * lens that is actually drawing it.
 *
 * Everything else in this module predicts a camera. Predicting a camera turned
 * out to be its own small research project — the boom shortens against
 * geometry, the rig slides sideways over a shoulder that swaps on its own, the
 * lens climbs to clear a rise, and the cadet's own origin drops half a metre
 * onto the surface the frame after he is placed — and a prediction that is
 * wrong by any of those is a prediction that certifies a shot nobody can see
 * out of. So the site search still predicts (it has to: it is choosing between
 * places nobody is standing yet), and then the recovery CHECKS ITSELF against
 * this, on the real transform, a beat later, and goes again if the shot it
 * produced is not one. Closing the loop beats sharpening the guess.
 */
export function frameOccluded(cx, cy, cz, yaw, pitch) {
  const list = blockers(cx, cy, cz);
  twoSided(list);
  let blocked = 0, n = 0;
  try {
    for (let iy = 0; iy < 5; iy++) {
      const el = pitch + (iy / 4 - 0.5) * 1.16;
      const ce = Math.cos(el), se = Math.sin(el);
      for (let ix = 0; ix < 6; ix++) {
        const a = yaw + (ix / 5 - 0.5) * 1.78;
        const dx = Math.sin(a) * ce, dz = Math.cos(a) * ce;
        let d = castOne(cx, cy, cz, _fd.set(dx, se, dz), list, 3.0);
        for (let s = 0.4; s < d; s += 0.35) {
          const h = heightAt(cx + dx * s, cz + dz * s);
          if (h !== null && h > cy + se * s) { d = s; break; }
        }
        n++;
        if (d < 3.0 && se * d > -1.3) blocked++;
      }
    }
  } finally { restore(); }
  return blocked / n;
}

export function frameClear(x, y, z, yaw) {
  const lx = x - Math.sin(yaw) * 3.85;
  const lz = z - Math.cos(yaw) * 3.85;
  const ly = y + 0.53;
  const list = blockers(lx, ly, lz);
  twoSided(list);
  let blocked = 0, n = 0;
  // Three lens origins, not one. The whole rig — aim point and lens together —
  // is slid sideways by the over-the-shoulder offset, and the offset swaps
  // sides on its own when one flank is blocked, so the shot is taken from
  // somewhere inside a metre-wide band rather than from a point. A wall that
  // only fills the frame from the right shoulder is still a wall.
  const sx = Math.cos(yaw), sz = -Math.sin(yaw);
  try {
    for (const off of [0, 0.55, -0.55]) {
      const ox = lx + sx * off, oz = lz + sz * off;
      for (let iy = 0; iy < 4; iy++) {
        const el = -0.14 + (iy / 3 - 0.5) * 1.16;        // ±35° about the rest pitch
        const ce = Math.cos(el), se = Math.sin(el);
        for (let ix = 0; ix < 5; ix++) {
          const a = yaw + (ix / 4 - 0.5) * 1.78;         // ±51° — 16:9 of the above
          const dx = Math.sin(a) * ce, dz = Math.cos(a) * ce;
          let d = castOne(ox, ly, oz, _fd.set(dx, se, dz), list, 3.0);
          for (let s = 0.4; s < d; s += 0.35) {
            const h = heightAt(ox + dx * s, oz + dz * s);
            if (h !== null && h > ly + se * s) { d = s; break; }
          }
          n++;
          if (d < 3.0 && se * d > -1.3) blocked++;
        }
      }
    }
  } finally { restore(); }
  // A fifth, not the gate's two-fifths. The gate samples sixty-three rays off
  // the live lens with its real pitch, lift and shoulder; this samples sixty
  // off a predicted one. Predicting a camera is not the same as reading one, so
  // the site has to clear the bar by a margin rather than scrape it — a fix
  // tuned to land exactly on the gate's number is a fix that fails the next
  // time either of them moves a centimetre.
  return blocked / n < 0.24;
}

/**
 * The nearest place that satisfies every one of the five facts, searched
 * outward from `(x0, z0)`.
 *
 * `minR` pushes the first ring out, because a recovery a player asked for has
 * to be a step he can see himself take. Rings run out to sixty metres — far
 * enough to leave any single landmark on this island — and the search only
 * stops early when it finds a site that is both close and genuinely open, so a
 * merely-legal spot two metres outside the arch does not beat a good one eight
 * metres clear of it.
 */
export function escapeSite(x0, z0, minR = 0, home = null, want = 0, banned = null) {
  const RINGS = [0, 3.5, 7, 11, 16, 22, 30, 40, 52, 64].filter((r) => r >= minR);
  /** @type {Array<{x:number,z:number,r:number,slope:number}>} */
  const cheap = [];
  for (const r of RINGS) {
    const n = r === 0 ? 1 : Math.min(16, 6 + Math.round(r / 3));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r * 0.37;
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      const v = siteVerdict(x, z, false);
      if (v.ok) cheap.push({ x, z, r, slope: v.slope });
    }
  }
  // Cheapest-first, but never so greedy that the ring search stops at the first
  // legal-looking metre: the whole defect was a spot 3.5 m along being accepted
  // without anybody asking what was standing in it.
  cheap.sort((p, q) => (p.r + p.slope * 8) - (q.r + q.slope * 8));
  // Two bars, and the second one is a correction to this fix rather than to the
  // old code. `want` is how much of the world the cadet could see from where he
  // pressed the key. A recovery that satisfies the promise and hands him back a
  // *worse* view than he had is still a button he will not press twice — so the
  // search prefers any site at least as open as the one he left, and only drops
  // to the hard bar if the island has nothing better within sixty metres.
  const HARD = OPEN_MIN;
  const PREF = Math.max(HARD, Math.min(0.75, want));
  let best = null, pref = null;
  let cast = 0;
  for (const c of cheap) {
    if (cast >= 30) break;
    // Somewhere this cadet has already been put down once and found wanting.
    // The recovery checks the shot it produced against the real lens and comes
    // back here if it was not one (src/player/controller.js `_verifyRecovery`),
    // and a search that can return the same answer twice is not a second try.
    if (banned) {
      let seen = false;
      for (let i = 0; i < banned.length; i += 2) {
        if (Math.hypot(c.x - banned[i], c.z - banned[i + 1]) < 5) { seen = true; break; }
      }
      if (seen) continue;
    }
    cast++;
    const v = siteVerdict(c.x, c.z, true);
    if (!v.ok) continue;
    // …AND THE LENS HAS TO HAVE SOMEWHERE TO GO. The cadet's own eye point can
    // be open in every direction while the four metres behind whichever way he
    // faces is the inside of a wreck — and the lens lives in those four metres.
    // A site with nowhere to stand the camera is not an escape, it is the
    // shoulder shot with extra steps.
    const ey = v.y - 0.55 + EYE;
    const bb = openBearing(c.x, ey, c.z);
    const yaw = bb.yaw;
    // …AND HE HAS TO BE FACING SOMETHING. `vista` above proves there is a long
    // view SOMEWHERE from this spot; this proves the cadet is pointed down it.
    // A recovery that sets him down facing a bank twelve metres away has met
    // every other clause and handed back a frame with no world in it, which is
    // the complaint in its original words: "I still could not see."
    if (bb.ahead < 35) continue;
    if (!lensClear(c.x, ey, c.z, yaw)) continue;
    const score = c.r + c.slope * 8 - v.open * 30 - Math.min(v.far, VISTA) * 0.12;
    const site = { x: c.x, y: v.y, z: c.z, yaw, open: v.open, far: v.far, score };
    if (!best || score < best.score) best = site;
    if (v.open >= PREF && (!pref || score < pref.score)) pref = site;
    // Close AND open: nothing further out can beat this, so stop paying for it.
    if (pref && c.r <= 12 && v.open > 0.62) break;
  }
  if (pref || best) return pref || best;
  // Nothing on this island passed within sixty metres of him, which should not
  // happen and must still end with a cadet standing somewhere. The landing site
  // is flat, open, and the one place the game guarantees.
  if (home) {
    const v = siteVerdict(home.x, home.z, true);
    if (v.ok) return { x: home.x, y: v.y, z: home.z, open: v.open, score: 1e6 };
    const h = heightAt(home.x, home.z);
    if (h !== null) return { x: home.x, y: h + 0.55, z: home.z, open: 0, score: 1e6 };
  }
  return null;
}

export { EYE, OPEN_M };
