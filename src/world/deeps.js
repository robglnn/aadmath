import * as THREE from 'three';
import { merge, paint, paintY } from './geom.js';
import { rng, fbm } from './noise.js';
import { thinAir } from './air.js';
import { ISLAND_R } from './terrain.js';

/**
 * THE DEEPS — the layer under the horizon that was not there.
 *
 * THE COMPLAINT, three critics running: "the one time I did roam there was
 * nothing out there: brown hillside, no landmarks, no reason to move", "five
 * minutes later it is a worksheet with a wallpaper", "a beautiful empty park".
 *
 * WHY THAT WAS TRUE, in one number. Shard Nine's coast is at 168 m. The leash
 * stands at 272 m. The far worlds are at 800 to 1100 m. Between 272 and 800
 * there was **one flat cream cloud deck and nothing else**, and that band is
 * the whole lower half of the screen from anywhere on the island's rim. A
 * player who walks twenty seconds in any direction — which is every player,
 * because the island is that small — spends the rest of the session looking at
 * it. The far worlds sit *above* the horizon line, so turning to look at the
 * gulf you have just walked to the edge of showed a blank.
 *
 * A floating island whose underside shows nothing is not a floating island. It
 * is a diorama on a table. So this file puts the missing layer in:
 *
 *   - **SUNK SHARDS.** Fifteen landmasses at 330 to 820 m, hanging from −55 to
 *     −330 m — that is, *below the horizon line*, in the exact band the eye
 *     sweeps when it looks down over the coast. Each has a lit top you can see
 *     ground on and a long dark keel, so it reads as rock hanging in air rather
 *     than a decal on the fog.
 *   - **THE STAIR.** Five of them are not scattered. They step down and out on
 *     one bearing, each a little further and a little lower than the last, at
 *     spacings that visibly shorten with depth. A rank of things in an order is
 *     a *route*, and a route is a question — which is the entire difference
 *     between scenery and a landmark. It is the one silhouette in this game you
 *     can read as an instruction from a hundred and fifty metres.
 *   - **THE RISE.** Motes of lattice light drifting *up* out of the gulf and
 *     past the coast. Two hundred metres of empty air between you and the
 *     nearest shard is what sells the drop, and empty air with nothing crossing
 *     it has no scale at all. These are the only thing in the frame that says
 *     how far down "down" is.
 *
 * REACHABILITY IS NOT LIED ABOUT. Nothing here is inside the leash at 272 m
 * (see `verge.js`, which was written after a client flew at a landmass and slid
 * along an invisible sphere). The nearest keel starts at 330. These are, and
 * plainly look like, other pieces of the shard — the same status the far worlds
 * have, at a distance where you can still see rock on them.
 *
 * COST. Two draw calls of baked geometry plus one instanced point sprite. No
 * shadows, no lights, no per-frame geometry work: the shards bob on a single
 * group transform and the motes advance one float each. Lighting is baked from
 * the sun's bearing at build time exactly as `farlands.js` bakes it, so they can
 * never drift out of agreement with the hour of the day.
 */

// The leash is ISLAND_R * 1.62 = 272 m. Nothing here starts before this.
const INNER = ISLAND_R * 1.97;          // 331 m — the nearest keel
const OUTER = ISLAND_R * 4.9;           // 823 m — where the far worlds begin

/**
 * Bake the sun into the palette a geometry is already painted with.
 *
 * It **multiplies** the existing vertex colours rather than replacing them —
 * the first cut of this assigned a fresh attribute and silently threw away
 * every `paint`/`paintY` call above it, which turns four colour families into
 * one grey one at exactly the distance where hue separation is the only thing
 * keeping the shards apart.
 */
function bakeLight(geo, sunDir, opts = {}) {
  const { sunAmt = 0.62, skyAmt = 0.34, ambient = 0.30 } = opts;
  const nor = geo.attributes.normal;
  const col = geo.attributes.color;
  if (!col) return geo;
  const s = sunDir.clone().normalize();
  for (let i = 0; i < col.count; i++) {
    const ny = nor.getY(i);
    const d = Math.max(0, nor.getX(i) * s.x + ny * s.y + nor.getZ(i) * s.z);
    // Sky light arrives from above; a keel's underside gets almost none, which
    // is the whole reason a keel reads as mass rather than as a paper cutout.
    const sky = 0.5 + 0.5 * ny;
    const k = ambient + sunAmt * d + skyAmt * sky * sky;
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  col.needsUpdate = true;
  return geo;
}

/**
 * One sunk shard: a broken plateau with ground on it and a long keel under it.
 * `w` is the plateau half-width, `keel` how far the rock hangs below it.
 */
function shardGeo(rand, w, keel, palette) {
  const parts = [];
  const SIDES = 7 + Math.floor(rand() * 4);

  // --- the plateau. An irregular prism, not a disc: a disc at this distance
  // is a coin, and a coin does not read as land.
  const ring = [];
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2 + rand() * 0.24;
    const r = w * (0.66 + rand() * 0.34);
    ring.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const shape = new THREE.Shape(ring);
  const top = new THREE.ExtrudeGeometry(shape, { depth: w * 0.30, bevelEnabled: false });
  top.rotateX(-Math.PI / 2);
  top.translate(0, 0, 0);
  paintY(top, palette.rock, palette.grass, -w * 0.30, 0.0);
  parts.push(top);

  // --- terraces: two narrower shelves under the rim, so the silhouette has
  // steps in it. A single slab has one edge; a stepped one reads as strata.
  for (let s = 0; s < 2; s++) {
    const rr = w * (0.80 - s * 0.20);
    const shelf = new THREE.CylinderGeometry(rr, rr * 0.92, w * 0.16, SIDES, 1, false);
    shelf.translate(0, -w * (0.34 + s * 0.20), 0);
    paint(shelf, palette.rock[0] * 0.86, palette.rock[1] * 0.86, palette.rock[2] * 0.88);
    parts.push(shelf);
  }

  // --- the keel. Long, tapered, and *off-axis*, because a symmetrical cone
  // hanging straight down is a spinning top. Rock that tore free hangs crooked.
  const kx = (rand() - 0.5) * w * 0.5, kz = (rand() - 0.5) * w * 0.5;
  const root = new THREE.CylinderGeometry(w * 0.62, w * 0.05, keel, SIDES, 3, false);
  root.translate(0, -w * 0.55 - keel * 0.5, 0);
  const rp = root.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const y = rp.getY(i);
    const f = Math.min(1, Math.max(0, (-y - w * 0.55) / keel));
    rp.setX(i, rp.getX(i) + kx * f * f + fbm(rp.getX(i) * 0.12, y * 0.05) * w * 0.10);
    rp.setZ(i, rp.getZ(i) + kz * f * f + fbm(rp.getZ(i) * 0.12, y * 0.05 + 9) * w * 0.10);
  }
  root.computeVertexNormals();
  paintY(root, palette.deep, palette.rock, -w * 0.55 - keel, -w * 0.55);
  parts.push(root);

  // --- shed rock: a few blocks trailing off the keel, so the shard is visibly
  // *coming apart* rather than parked. Intent, at silhouette scale.
  for (let i = 0; i < 4; i++) {
    const b = new THREE.BoxGeometry(w * 0.18, w * 0.14, w * 0.16);
    b.rotateY(rand() * 3.1); b.rotateZ(rand() * 0.8 - 0.4);
    b.translate(
      kx * 1.4 + (rand() - 0.5) * w * 1.5,
      -w * 0.55 - keel * (0.35 + rand() * 0.7),
      kz * 1.4 + (rand() - 0.5) * w * 1.5,
    );
    paint(b, palette.deep[0], palette.deep[1], palette.deep[2]);
    parts.push(b);
  }

  return merge(parts);
}

/**
 * Build the deeps.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} sunDir
 * @param {number} quality
 */
export function createDeeps(scene, sunDir, quality = 1) {
  const group = new THREE.Group();
  group.name = 'deeps';
  scene.add(group);

  const rand = rng(4711);

  // Colour families, authored *before* the air touches them, so half a
  // kilometre of aerial perspective still leaves separable hues down there.
  const PALETTES = [
    { grass: [0.34, 0.44, 0.30], rock: [0.40, 0.36, 0.33], deep: [0.13, 0.13, 0.17] },
    { grass: [0.46, 0.42, 0.28], rock: [0.46, 0.38, 0.29], deep: [0.16, 0.13, 0.13] },
    { grass: [0.30, 0.40, 0.46], rock: [0.33, 0.35, 0.42], deep: [0.11, 0.12, 0.18] },
    { grass: [0.44, 0.34, 0.36], rock: [0.42, 0.33, 0.31], deep: [0.15, 0.11, 0.13] },
  ];

  const parts = [];
  const place = (ang, r, y, w, keel, pi) => {
    const g = shardGeo(rand, w, keel, PALETTES[pi % PALETTES.length]);
    g.rotateY(rand() * 6.28);
    g.translate(Math.cos(ang) * r, y, Math.sin(ang) * r);
    parts.push(g);
  };

  // ---- THE STAIR ------------------------------------------------------
  //
  // Five shards stepping down and out on one bearing, each further and lower
  // than the last, with the gaps *shortening* as they fall away. Scattered
  // rocks are weather. Rocks in an order are a road, and the eye reads the
  // order before it reads any one of them. This is the landmark: it is the
  // thing that makes a player walk to the coast to look at it properly.
  //
  // It is laid on the south-east bearing, which is the quarter the plaza faces
  // and the one the opening shot already looks down — so it is in frame on
  // arrival as a promise, and it is still there in minute eight as an answer.
  const STAIR_ANG = -0.62;
  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    place(
      STAIR_ANG + (i - 2) * 0.085,
      INNER + f * 330,
      -58 - f * f * 190 - i * 16,
      30 + i * 13,
      70 + i * 46,
      i === 4 ? 2 : 0,
    );
  }

  // ---- THE SCATTER ----------------------------------------------------
  // Everything else, spread round the compass so that whichever way a player
  // walks off the plaza, the gulf under the coast has something in it.
  const N = Math.max(7, Math.round(11 * quality));
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + rand() * 0.7;
    // deliberately skip the stair's quarter — two ideas on one bearing is one
    // idea nobody can see
    if (Math.abs(((ang - STAIR_ANG + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.55) continue;
    const f = rand();
    const r = INNER + 40 + f * (OUTER - INNER - 60);
    place(
      ang, r,
      -62 - f * 240 - rand() * 60,
      26 + f * 78 + rand() * 22,
      64 + f * 220,
      1 + Math.floor(rand() * 3),
    );
  }

  const geo = merge(parts);
  // Baked, unlit, and given only a fraction of the air — the same lever
  // `farlands.js` needed. These exist to be dark mass against a bright cloud
  // deck, and at five hundred metres the full haze is brighter than any rock
  // colour in the palette, so without this they arrive as pale grey cards.
  const mat = thinAir(new THREE.MeshBasicMaterial({
    vertexColors: true, fog: true,
  }), 0.72);
  bakeLight(geo, sunDir, { sunAmt: 0.66, skyAmt: 0.30, ambient: 0.30 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'deeps-shards';
  mesh.frustumCulled = false;
  mesh.renderOrder = -4;
  mesh.matrixAutoUpdate = true;
  group.add(mesh);

  // ---- THE RISE -------------------------------------------------------
  //
  // Motes of lattice light coming *up* out of the gulf. Two hundred metres of
  // clear air is what sells a drop, and clear air with nothing crossing it has
  // no scale — the eye cannot tell fifty metres of haze from five hundred. A
  // slow rising particle is the cheapest true depth cue there is, and it is the
  // only moving thing in that half of the frame.
  const M = Math.round(220 * quality);
  const pgeo = new THREE.BufferGeometry();
  const pp = new Float32Array(M * 3);
  const pd = [];
  for (let i = 0; i < M; i++) {
    const a = rand() * 6.28;
    const r = ISLAND_R * 1.15 + rand() * 330;
    pd.push({ a, r, y: -260 + rand() * 300, sp: 3.4 + rand() * 5.2, ph: rand() * 6.28 });
    pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = pd[i].y; pp[i * 3 + 2] = Math.sin(a) * r;
  }
  pgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pmat = new THREE.PointsMaterial({
    color: 0xbcd9ff, size: 1.5, sizeAttenuation: true,
    transparent: true, opacity: 0.55, depthWrite: false, fog: false,
  });
  const motes = new THREE.Points(pgeo, pmat);
  motes.name = 'deeps-rise';
  motes.frustumCulled = false;
  motes.renderOrder = -3;
  group.add(motes);

  const bob = group.position.clone();
  return {
    group, mesh, motes,
    update(dt, t) {
      // The whole layer breathes on one transform — fifteen landmasses for the
      // cost of one matrix. Slow enough to be felt rather than watched.
      group.position.y = bob.y + Math.sin(t * 0.085) * 1.9;
      group.rotation.y = Math.sin(t * 0.021) * 0.010;
      for (let i = 0; i < M; i++) {
        const d = pd[i];
        d.y += dt * d.sp;
        if (d.y > 46) { d.y = -300 - Math.random() * 60; }
        pp[i * 3] = Math.cos(d.a) * d.r + Math.sin(t * 0.4 + d.ph) * 3.0;
        pp[i * 3 + 1] = d.y;
        pp[i * 3 + 2] = Math.sin(d.a) * d.r + Math.cos(t * 0.33 + d.ph) * 3.0;
      }
      pgeo.attributes.position.needsUpdate = true;
    },
  };
}
