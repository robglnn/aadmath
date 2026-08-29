/**
 * THE ESCAPE INSTRUMENT, AS ONE MODULE.
 *
 * `ESCAPE_JS` and `notFree()` were written inside tools/critic/coldplay.mjs and
 * lived there alone. They are the only measurement in this repo that answers
 * "is this a frame a player can play out of" off the running build rather than
 * off a proxy, and a second gate needed exactly the same question asked of
 * every place the game routes a cadet to (tools/critic/compose.mjs).
 *
 * Copying it would have produced two predicates that drift apart, and the one
 * thing this instrument cannot afford is two versions of its own bars. So it
 * moved here verbatim, and coldplay.mjs imports it. Nothing about the
 * measurement changed in the move.
 *
 * `ESCAPE_JS` is a string on purpose: it is evaluated inside the page by
 * `page.evaluate`, against the real `window.__ascent`, the real three.js
 * camera, and the real scene graph.
 */

// ===========================================================================
// THE ESCAPE INSTRUMENT
//
// THIS EXISTS BECAUSE THE GATE CERTIFIED THE DEFECT.
//
// The old assertion under the Recover key read, in full:
//
//     'Recover always visibly moves you, onto ground you can stand on'
//     -> 3/3 moved (10m:3.5m, 9.5m:3.5m, 24m:3.6m)
//
// and it passed on every build, including the ones a cold player could not get
// out of. He wrote the refutation himself: *"Moving 3.5 m inside a hill is
// still inside the hill; the gate measures displacement, not escape."* It also
// measured "solid ground" as `islandAt(x, z) !== null`, which is the exact
// question the broken code was asking itself — so the gate and the defect
// agreed, and both were wrong about the same thing.
//
// Displacement is a proxy. Escape is the promise, and it is five facts:
//
//   1. THE BOOTS ARE ON A SURFACE. The heightfield or the built lattice answers
//      here, the cadet is standing on that surface, and `grounded` is true.
//   2. HE IS NOT INSIDE ANY COLLIDER. Not under the terrain, not through a
//      panel of his own lattice, and not in the middle of a drawn solid.
//   3. THE LENS IS NOT INSIDE GEOMETRY EITHER.
//   4. THE VIEW IS NOT OCCLUDED. Most of the frame is not a wall at arm's
//      length, and a real share of it reaches actual distance.
//   5. THE LENS IS NOT IN HIS SHOULDER.
//
// None of that is asked of the player module. It is measured off the world
// heightfield, the real three.js camera's world transform, and raycasts through
// the scene graph the player is looking at — plus, for the "black mush" the
// report is actually about, the shipped pixels.
//
// ONE THING IN HERE IS LOAD-BEARING AND EASY TO GET WRONG. A ray leaving the
// inside of a closed mesh hits only BACK faces, and a front-side raycast is
// blind to those, so a naive probe stands in the middle of the cathedral,
// looks straight through its own walls and reports open country. Every material
// on the probe list is flipped to `DoubleSide` for the measurement and put back
// before anything is drawn. Without that line this instrument is another proxy.
// ===========================================================================
export const ESCAPE_JS = `(() => {
  const a = window.__ascent, T = a.THREE, cam = a.camera;
  const p = a.player.pos;
  const eye = new T.Vector3(); cam.getWorldPosition(eye);
  const aim = new T.Vector3(p.x, p.y + 1.46, p.z);

  // Everything drawn and solid EXCEPT the cadet's own hardware and the island
  // shell. The shell is answered exactly, and far more cheaply, by marching the
  // heightfield; it is also the one mesh big enough for raycasting to matter.
  const mine = new Set(); a.player.root.traverse((o) => mine.add(o));
  const list = [];
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible || mine.has(o) || o.userData.noCamBlock) return;
    const m = o.material; if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    if (mats.some((q) => !q || q.transparent || q.depthWrite === false || q.wireframe)) return;
    const g = o.geometry; if (!g) return;
    const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
    if (!tris || tris > 30000) return;
    list.push(o);
  });
  const was = [];
  for (const o of list) {
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const q of ms) { was.push(q, q.side); q.side = T.DoubleSide; }
  }
  const ray = new T.Raycaster();
  const cast = (from, dir, far) => {
    ray.near = 0.02; ray.far = far; ray.set(from, dir);
    const h = ray.intersectObjects(list, false);
    return h.length ? h[0].distance : far;
  };
  // The island's own version of "you cannot see out this way".
  const wall = (x, y, z, d, far) => {
    if (d.y > 0.35) return false;
    for (let s = 2; s <= far; s += 2.5) {
      const h = a.islandAt(x + d.x * s, z + d.z * s);
      if (h !== null && h > y + d.y * s + 0.5) return true;
    }
    return false;
  };
  const DIRS = [];
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2;
    DIRS.push(new T.Vector3(Math.cos(t), 0, Math.sin(t))); }
  for (let i = 0; i < 4; i++) { const t = (i / 4) * Math.PI * 2 + 0.4, c = Math.cos(0.5);
    DIRS.push(new T.Vector3(Math.cos(t) * c, Math.sin(0.5), Math.sin(t) * c)); }
  DIRS.push(new T.Vector3(0, 1, 0));
  const AX = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]
    .map((v) => new T.Vector3(v[0], v[1], v[2]));

  const openness = (x, y, z) => {
    let n = 0;
    const from = new T.Vector3(x, y, z);
    for (const d of DIRS) {
      if (cast(from, d, 22) < 22) continue;
      if (wall(x, y, z, d, 22)) continue;
      n++;
    }
    return n / DIRS.length;
  };
  // Inside a boulder, every way out is short.
  const insideSolid = (x, y, z, r) => {
    const from = new T.Vector3(x, y, z);
    for (const d of AX) if (cast(from, d, r) >= r) return false;
    return true;
  };

  // What the frame is actually full of: a 9x7 grid through the real lens, each
  // ray stopped by whichever comes first — a drawn solid or the island.
  const v2 = new T.Vector2();
  let short = 0, far = 0, n = 0, minD = Infinity;
  for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 9; ix++) {
    v2.set((ix / 8) * 1.9 - 0.95, (iy / 6) * 1.9 - 0.95);
    ray.near = 0.02; ray.far = 900; ray.setFromCamera(v2, cam);
    const h = ray.intersectObjects(list, false);
    let d = h.length ? h[0].distance : 900;
    const dir = ray.ray.direction;
    for (let s = 1; s < Math.min(d, 220); s += 1.5) {
      const hh = a.islandAt(eye.x + dir.x * s, eye.z + dir.z * s);
      if (hh !== null && hh > eye.y + dir.y * s) { d = Math.min(d, s); break; }
    }
    n++;
    // A WALL IS NOT A FLOOR, and this line is the difference between a gate
    // that measures occlusion and one that fails every shot taken on a slope.
    // The ground under the cadet's own boots is three metres from the lens on
    // any real hillside and fills the bottom of the frame — that is what a
    // third-person camera looks like, not what being buried looks like. So a
    // ray only counts as a wall when it stops short AT OR NEAR THE HEIGHT OF
    // THE EYE. Everything below knee height is the world he is standing on.
    if (d < 3 && eye.y + dir.y * d > eye.y - 1.3) short++;
    if (d > 25) far++;
    if (d < minD) minD = d;
  }

  const camOpen = openness(eye.x, eye.y, eye.z);
  const bodyOpen = openness(p.x, p.y + 1.46, p.z);
  const inSolid = insideSolid(p.x, p.y + 0.9, p.z, 1.1);
  const camInSolid = insideSolid(eye.x, eye.y, eye.z, 0.8);
  for (let i = 0; i < was.length; i += 2) was[i].side = was[i + 1];

  const gh = a.islandAt(p.x, p.z);
  const sh = a.surfaceAt(p.x, p.z);
  const surf = sh !== null && (gh === null || sh > gh) ? sh : gh;
  const camG = a.islandAt(eye.x, eye.z);
  const S = a.builder && a.builder.solids;
  const inWall = !!(S && S.count && (S.contains(p.x, p.y + 0.3, p.z, 0.25)
    || S.contains(p.x, p.y + 1.0, p.z, 0.25) || S.contains(p.x, p.y + 1.7, p.z, 0.25)));
  const camInWall = !!(S && S.count && S.contains(eye.x, eye.y, eye.z, 0.2));

  return {
    x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
    ground: surf,
    // 1
    onGround: surf !== null && !!a.player.grounded && Math.abs(p.y - surf) < 0.7,
    // 2
    inTerrain: surf !== null && p.y < surf - 0.2,
    inWall, inSolid,
    // 3
    camInTerrain: camG !== null && eye.y < camG + 0.05,
    camInWall, camInSolid,
    // 4
    short: +(short / n).toFixed(3), seeFar: +(far / n).toFixed(3),
    minD: +minD.toFixed(2), open: +bodyOpen.toFixed(3), camOpen: +camOpen.toFixed(3),
    // 5
    boom: +eye.distanceTo(aim).toFixed(2),
    vy: +a.player.vel.y.toFixed(2),
    recoveries: a.player.recoveries | 0, caught: a.player.caught | 0,
    stuck: !!a.player.stuck, ui: !!a.input.uiOpen || !!a.panel.open,
  };
})()`;

/**
 * ESCAPE, as one predicate. Returns **the reason he has not escaped**, or the
 * empty string when he has — so the reason a run failed is always printed, and
 * a caller can never accidentally read a truthy explanation as a pass.
 *
 * Every bar here was set off measurements of this build at places that were
 * captured and looked at by eye — see shots/coldplay/wedge-*.png. The wedged
 * frames the critic reported sit at open 0.18, short 0.76, minD 1.3; open
 * ground on the plaza sits at open 0.88, short 0.00, minD 4.0; the tightest
 * legitimate standing place found anywhere on the island — the foot of a steep
 * bank under tree cover — sits at open 0.41, short 0.14. So the bars are drawn
 * between those two populations, not around one build's numbers.
 */
export const notFree = (f) => {
  if (!f.onGround) return `not standing on a surface (ground=${f.ground}, y=${f.y})`;
  if (f.inTerrain) return `inside the terrain (${(f.ground - f.y).toFixed(1)}m under the surface)`;
  if (f.inWall) return 'inside a panel of his own lattice';
  if (f.inSolid) return 'inside a drawn solid — a rock, a hoodoo, a landmark';
  if (f.camInTerrain) return 'the lens is under the heightfield';
  if (f.camInWall) return 'the lens is inside the built lattice';
  if (f.camInSolid) return 'the lens is inside a drawn solid';
  if (f.short > 0.40) return `the view is a wall: ${(f.short * 100) | 0}% of the frame stops inside 3m`;
  if (f.seeFar < 0.06) return `nothing in the frame reaches 25m (seeFar=${f.seeFar})`;
  if (f.open < 0.30) return `walled in: only ${(f.open * 100) | 0}% of the directions around him are open`;
  if (f.boom < 2.2) return `the lens is in his shoulder (boom ${f.boom}m)`;
  return '';
};
