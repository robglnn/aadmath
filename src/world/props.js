import * as THREE from 'three';
import { rng, clamp, sstep, fbm, GLSL_NOISE } from './noise.js';
import { merge, paint, paintY } from './geom.js';
import {
  heightAt, sampleH, sampleSlope, moistAt, pathAt, ISLAND_R, SNOW_Y,
  PEAK, PEAK2, MESA, GROVE, HENGE, LAKE, coastRadius, underWater,
} from './terrain.js';
import { zoneWeights, ZONE_INDEX } from './biomes.js';
import { stoneMaterial } from './stone.js';

/**
 * Landmarks.
 *
 * Every one of these exists so a player can point at the horizon and say
 * "there". The Spine's broken ring on the summit, the crystal cathedrals, the
 * grove, the standing stones, the ruined aqueduct — silhouettes you navigate
 * by, at three different distance bands so the island has depth.
 */

const up = new THREE.Vector3(0, 1, 0);

function place(x, z, fallback = 8) {
  const h = heightAt(x, z);
  return h === null ? fallback : h;
}

// ---------------------------------------------------------------------------
// crystal — a hexagonal prism with a pyramid cap, the Cipher Worlds' motif
// ---------------------------------------------------------------------------
function crystalGeometry() {
  const body = new THREE.CylinderGeometry(0.66, 1.0, 0.74, 6, 1, true);
  body.translate(0, 0.37, 0);
  const cap = new THREE.ConeGeometry(0.66, 0.34, 6);
  cap.translate(0, 0.91, 0);
  const base = new THREE.CircleGeometry(1.0, 6);
  base.rotateX(Math.PI / 2);
  const g = merge([body, cap, base]);
  paint(g, 1, 1, 1);   // instance colour needs something to multiply into
  return g;
}

// Four clusters, not eight, and each one belongs to a region and takes that
// region's colour. Thirty evenly-scattered shards read as noise; four cathedral
// groups on the skyline read as landmarks.
const CLUSTERS = [
  { x: -62, z: -76, s: 1.05, hue: 0.55 },  // between the plaza and the Spine
  { x: 26, z: -140, s: 1.25, hue: 0.52 },  // the far northern shore
  { x: -132, z: 52, s: 0.95, hue: 0.44 },  // over the steppe, amber-lilac
  { x: 112, z: 82, s: 1.00, hue: 0.06 },   // in the wastes: a burnt-orange spire
];

export function createCrystals(scene, quality) {
  const geo = crystalGeometry();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.22, metalness: 0.04, flatShading: true,
    transparent: true, opacity: 0.88, emissiveIntensity: 1.0,
    emissive: 0xffffff,
  });
  // emissive uses the same instance colour, so each shard glows its own hue
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb * 0.26;'
    );
  };

  const items = [];
  const rand = rng(7717);
  for (const c of CLUSTERS) {
    const n = 4 + Math.floor(rand() * 3);
    const hero = 44 + rand() * 26;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rr = i === 0 ? 0 : (3.5 + rand() * 9) * c.s;
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      const h = sampleH(x, z);
      if (h === null) continue;
      const hgt = (i === 0 ? hero : hero * (0.30 + rand() * 0.55)) * c.s;
      const wid = hgt * (0.09 + rand() * 0.06);
      items.push({
        x, y: h - hgt * 0.06, z, hgt, wid,
        tilt: (rand() - 0.5) * 0.4, yaw: rand() * 6.28,
        hue: c.hue + (rand() - 0.5) * 0.07,
        lig: 0.46 + rand() * 0.16,
      });
    }
  }

  const inst = new THREE.InstancedMesh(geo, mat, items.length);
  inst.castShadow = true;
  inst.receiveShadow = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    e.set(it.tilt, it.yaw, (Math.random() - 0.5) * 0.0);
    q.setFromEuler(e);
    inst.setMatrixAt(i, m4.compose(
      new THREE.Vector3(it.x, it.y, it.z), q,
      new THREE.Vector3(it.wid, it.hgt, it.wid)
    ));
    col.setHSL(it.hue, 0.52, it.lig);
    inst.setColorAt(i, col);
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);

  // a few of the cathedrals actually light their surroundings
  const lights = [];
  if (quality > 0.6) {
    for (const c of [CLUSTERS[0], CLUSTERS[1], CLUSTERS[3]]) {
      const h = sampleH(c.x, c.z);
      if (h === null) continue;
      const l = new THREE.PointLight(new THREE.Color().setHSL(c.hue, 0.8, 0.6), 60, 90, 2);
      l.position.set(c.x, h + 14, c.z);
      scene.add(l);
      lights.push(l);
    }
  }
  return { inst, lights, clusters: CLUSTERS };
}

// ---------------------------------------------------------------------------
// The grove — crystalline trees, west
// ---------------------------------------------------------------------------
function treeGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.42, 4.4, 6, 1);
  trunk.translate(0, 2.2, 0);
  paint(trunk, 0.34, 0.30, 0.34);
  parts.push(trunk);
  const rand = rng(4242);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
    const len = 2.6 + rand() * 2.4;
    const frond = new THREE.ConeGeometry(0.85 + rand() * 0.5, len, 5);
    frond.translate(0, len * 0.5, 0);
    frond.rotateX(0.5 + rand() * 0.5);
    frond.rotateY(a);
    frond.translate(Math.cos(a) * 0.7, 4.0 + rand() * 1.6, Math.sin(a) * 0.7);
    const t = rand();
    paint(frond, 0.220 + t * 0.14, 0.500 - t * 0.06, 0.470 + t * 0.14);
    parts.push(frond);
  }
  const crown = new THREE.IcosahedronGeometry(1.15, 0);
  crown.translate(0, 5.2, 0);
  paint(crown, 0.360, 0.560, 0.610);
  parts.push(crown);
  return merge(parts);
}

export function createGrove(scene, quality) {
  const geo = treeGeometry();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0.05,
    emissive: 0x1d5e78, emissiveIntensity: 0.42, flatShading: true,
  });
  const rand = rng(9182);
  const spots = [];
  const N = Math.round(78 * quality);
  for (let i = 0; i < N * 14 && spots.length < N; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.pow(rand(), 0.55) * 56;
    const x = GROVE.x + Math.cos(a) * rr, z = GROVE.z + Math.sin(a) * rr;
    const h = sampleH(x, z);
    if (h === null || sampleSlope(x, z) > 0.6) continue;
    if (pathAt(x, z) > 0.35) continue;
    if (moistAt(x, z) < 0.22 || underWater(x, z, 1.2)) continue;
    spots.push({ x, y: h - 0.2, z, s: 0.75 + rand() * 1.5, yaw: rand() * 6.28 });
  }
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  inst.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.yaw);
    inst.setMatrixAt(i, m4.compose(
      new THREE.Vector3(s.x, s.y, s.z), q,
      new THREE.Vector3(s.s, s.s * (0.85 + (i % 7) * 0.06), s.s)
    ));
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
  return inst;
}

// ---------------------------------------------------------------------------
// Flora, by region.
//
// Five species, and which one grows where is decided by `biomes.js`, not by a
// dice roll: dark spruce on the cold ground, broadleaf in the vale, flat-topped
// umbrella trees on the steppe, drowned skeletons in the fen, columnar succulents
// in the wastes. Walk a hundred metres and the plants change with the colour of
// the ground, which is what makes a place feel like several places.
// ---------------------------------------------------------------------------

/** Trunks are lathed, tapered and capped — never a box you can see the inside of. */
function trunk(r0, r1, h, seg = 6, lo = [0.150, 0.106, 0.078], hi = [0.250, 0.186, 0.130]) {
  const t = new THREE.CylinderGeometry(r0, r1, h, seg, 2);
  t.translate(0, h * 0.5, 0);
  return paintY(t, lo, hi, 0, h);
}

function spruceGeometry() {
  const parts = [trunk(0.13, 0.34, 3.4, 6, [0.130, 0.098, 0.086], [0.220, 0.176, 0.150])];
  const rand = rng(1201);
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const c = new THREE.ConeGeometry(1.76 - t * 1.06, 3.3 - t * 0.55, 6);
    c.translate((rand() - 0.5) * 0.16, 2.1 + i * 1.95, (rand() - 0.5) * 0.16);
    const s = 0.90 + t * 0.28;
    paint(c, 0.128 * s, 0.268 * s, 0.212 * s);
    parts.push(c);
  }
  const tip = new THREE.ConeGeometry(0.42, 1.7, 5);
  tip.translate(0, 10.1, 0);
  paint(tip, 0.150, 0.290, 0.232);
  parts.push(tip);
  return merge(parts);
}

function broadleafGeometry() {
  const parts = [trunk(0.22, 0.50, 3.6, 7)];
  const rand = rng(66);
  // three boughs, each one ending inside a canopy lobe
  const tips = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + 0.4;
    const len = 2.0 + rand() * 0.7;
    const b = new THREE.CylinderGeometry(0.07, 0.19, len, 4);
    b.translate(0, len * 0.5, 0);
    b.rotateZ(0.62 + rand() * 0.2);
    b.rotateY(a);
    b.translate(0, 3.0, 0);
    paint(b, 0.200, 0.156, 0.116);
    parts.push(b);
    const reach = Math.sin(0.72) * len * 0.85;
    tips.push([Math.cos(a) * reach, 3.0 + Math.cos(0.72) * len * 0.85, Math.sin(a) * reach]);
  }
  // a full round crown: one core over the trunk, one lobe per bough, and a
  // scatter of small ones to break the silhouette
  const lobes = [[0, 4.9, 0, 1.85], ...tips.map((t) => [t[0], t[1] + 0.9, t[2], 1.45])];
  for (let i = 0; i < 3; i++) {
    const a = rand() * 6.28, rr = 1.1 + rand() * 0.9;
    lobes.push([Math.cos(a) * rr, 5.2 + rand() * 1.1, Math.sin(a) * rr, 0.95 + rand() * 0.5]);
  }
  for (const [lx, ly, lz, lr] of lobes) {
    const bl = new THREE.IcosahedronGeometry(lr, 0);
    bl.scale(1.24, 0.90, 1.24);
    bl.translate(lx, ly, lz);
    const t = rand();
    paint(bl, 0.140 + t * 0.11, 0.344 + t * 0.14, 0.128 + t * 0.06);
    parts.push(bl);
  }
  return merge(parts);
}

/**
 * The steppe tree: an acacia. A thick tapered bole, three boughs that visibly
 * carry the crown, and a canopy built from five overlapping lobes rather than
 * one flattened disc — a single squashed sphere reads as a lily pad on a pole,
 * which is exactly the failure this replaces.
 */
function umbrellaGeometry() {
  const parts = [];
  const rand = rng(4004);
  const bole = new THREE.CylinderGeometry(0.34, 1.05, 4.0, 8, 3);
  bole.translate(0, 2.0, 0);
  bole.rotateZ(0.08);
  paintY(bole, [0.132, 0.098, 0.070], [0.256, 0.208, 0.150], 0, 4.0);
  parts.push(bole);
  // buttress roots: the foot of the tree meets the ground in something
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.28 + 0.5;
    const r0 = new THREE.ConeGeometry(0.30, 1.5, 4);
    r0.translate(0, 0.75, 0);
    r0.rotateZ(0.34);
    r0.rotateY(a);
    r0.translate(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
    paint(r0, 0.140, 0.106, 0.078);
    parts.push(r0);
  }
  const boughs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + 0.3;
    const len = 2.6 + rand() * 0.7;
    const b = new THREE.CylinderGeometry(0.09, 0.28, len, 5);
    b.translate(0, len * 0.5, 0);
    b.rotateZ(0.92 + rand() * 0.18);
    b.rotateY(a);
    b.translate(0, 3.4, 0);
    paint(b, 0.206, 0.164, 0.116);
    parts.push(b);
    // where this bough ends is where a canopy lobe has to sit
    const reach = Math.sin(1.0) * len * 0.9;
    boughs.push([Math.cos(a) * reach, 4.5 + Math.cos(1.0) * len * 0.5, Math.sin(a) * reach]);
  }
  // the crown: one central mass plus a lobe on the end of every bough, so the
  // canopy can never float free of the thing that is holding it up
  const lobes = [[0, 4.9, 0, 2.9], ...boughs.map((b) => [b[0] * 0.8, b[1], b[2] * 0.8, 2.15])];
  for (const [lx, ly, lz, lr] of lobes) {
    const rr = lr * (0.86 + rand() * 0.3);
    const c = new THREE.SphereGeometry(rr, 7, 4, 0, 6.28, 0, 1.55);
    c.scale(1, 0.50, 1);
    c.translate(lx, ly, lz);
    const t = rand();
    paint(c, 0.190 + t * 0.11, 0.268 + t * 0.11, 0.108 + t * 0.05);
    parts.push(c);
  }
  return merge(parts);
}

/** The fen tree: drowned, barkless, hung with pale weed. */
function fenTreeGeometry() {
  const parts = [];
  const rand = rng(5150);
  const bole = new THREE.CylinderGeometry(0.16, 0.58, 6.2, 6, 3);
  bole.translate(0, 3.1, 0);
  bole.rotateZ(0.10);
  paintY(bole, [0.106, 0.116, 0.104], [0.300, 0.310, 0.284], 0, 6.2);
  parts.push(bole);
  for (let i = 0; i < 6; i++) {
    const a = rand() * 6.28;
    const len = 2.0 + rand() * 2.6;
    const b = new THREE.CylinderGeometry(0.05, 0.14, len, 4);
    b.translate(0, len * 0.5, 0);
    b.rotateZ(0.6 + rand() * 0.7);
    b.rotateY(a);
    b.translate(0, 3.6 + rand() * 2.2, 0);
    paint(b, 0.230, 0.244, 0.220);
    parts.push(b);
    // weed hanging off the limb
    const w = new THREE.ConeGeometry(0.30, 2.2 + rand() * 1.6, 4);
    w.rotateX(Math.PI);
    w.translate(Math.cos(a) * (1.4 + rand()), 3.4 + rand() * 1.8, Math.sin(a) * (1.4 + rand()));
    const t = rand();
    paint(w, 0.150 + t * 0.08, 0.320 + t * 0.10, 0.226 + t * 0.06);
    parts.push(w);
  }
  return merge(parts);
}

/** The wastes: a columnar succulent, ribbed, with two raised arms. */
function columnarGeometry() {
  const parts = [];
  const rand = rng(777);
  const col = new THREE.CylinderGeometry(0.52, 0.66, 5.4, 9, 2);
  col.translate(0, 2.7, 0);
  paintY(col, [0.106, 0.150, 0.104], [0.176, 0.216, 0.132], 0, 5.4);
  parts.push(col);
  const cap = new THREE.SphereGeometry(0.52, 9, 5, 0, 6.28, 0, 1.57);
  cap.translate(0, 5.4, 0);
  paint(cap, 0.166, 0.206, 0.128);
  parts.push(cap);
  for (const s of [-1, 1]) {
    if (rand() < 0.25) continue;
    const armH = 2.0 + rand() * 1.4;
    const arm = new THREE.CylinderGeometry(0.30, 0.34, armH, 7);
    arm.translate(0, armH * 0.5, 0);
    arm.translate(s * 0.95, 2.5 + rand() * 1.0, 0);
    paintY(arm, [0.118, 0.160, 0.106], [0.174, 0.212, 0.130], 2.5, 5.5);
    parts.push(arm);
    const elbow = new THREE.CylinderGeometry(0.30, 0.30, 1.0, 7);
    elbow.rotateZ(Math.PI / 2);
    elbow.translate(s * 0.5, 2.6, 0);
    paint(elbow, 0.136, 0.176, 0.114);
    parts.push(elbow);
  }
  return merge(parts);
}

function shrubGeometry() {
  const parts = [];
  const rand = rng(77);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.IcosahedronGeometry(0.40 + rand() * 0.22, 0);
    b.scale(1.20, 0.72, 1.20);
    b.translate((rand() - 0.5) * 0.7, 0.26 + i * 0.20, (rand() - 0.5) * 0.7);
    const t = rand();
    paint(b, 0.170 + t * 0.11, 0.276 + t * 0.11, 0.132 + t * 0.05);
    parts.push(b);
  }
  for (let i = 0; i < 3; i++) {
    const c = new THREE.ConeGeometry(0.05, 0.70 + rand() * 0.5, 4);
    const a = rand() * 6.28, rr = rand() * 0.45;
    c.rotateX((rand() - 0.5) * 0.55);
    c.rotateZ((rand() - 0.5) * 0.55);
    c.translate(Math.cos(a) * rr, 0.66 + rand() * 0.2, Math.sin(a) * rr);
    paint(c, 0.235, 0.352, 0.162);
    parts.push(c);
  }
  return merge(parts);
}

/**
 * Foliage moves. A coherent gust rolls across the island and every canopy leans
 * into it, weighted by how far up the plant the vertex is — the same wind field
 * the grass uses, so the whole landscape breathes together. The canopy also
 * gets a translucency term, so leaves lit from behind glow instead of going
 * flat black.
 */
export function foliageMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.86, metalness: 0.0, flatShading: true,
  });
  mat.userData.uniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying float vLeaf;\nvarying vec3 vWP;`)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iOrigin = instanceMatrix[3].xyz;
        #else
          vec3 iOrigin = vec3(0.0);
        #endif
        float up = max(transformed.y, 0.0);
        vLeaf = smoothstep(1.2, 4.0, up);
        float ph = iOrigin.x * 0.21 + iOrigin.z * 0.17;
        float gust = sin(uTime * 0.62 + (iOrigin.x * 0.86 + iOrigin.z * 0.51) * 0.045);
        float amp = (0.030 + 0.048 * (gust * 0.5 + 0.5)) * up * up * 0.06;
        transformed.x += amp * (7.0 + sin(uTime * 1.9 + ph) * 3.0);
        transformed.z += amp * (4.0 + cos(uTime * 1.6 + ph * 1.3) * 3.0);
        vWP = iOrigin;
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_NOISE}\nuniform vec3 uSunDir;\nuniform float uTime;\nvarying float vLeaf;\nvarying vec3 vWP;`)
      .replace('#include <aomap_fragment>', /* glsl */`
        #include <aomap_fragment>
        // sky bounce plus a leaf-thin transmission term toward the sun
        vec3 vd = normalize(vViewPosition);
        float back = pow(clamp(dot(-vd, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0), 3.0);
        reflectedLight.indirectDiffuse += diffuseColor.rgb
          * (vec3(0.30, 0.40, 0.58) * 0.28 + vec3(1.10, 0.86, 0.52) * back * vLeaf * 0.85);
        vec2 cq = vWP.xz * 0.0042 + vec2(uTime * 0.0072, uTime * 0.0043);
        float cShade = mix(0.55, 1.0, smoothstep(0.30, 0.70, aa_n(cq)));
        reflectedLight.directDiffuse *= cShade;
        reflectedLight.directSpecular *= cShade;
      `);
  };
  return mat;
}

export function createVegetation(scene, quality) {
  const leafMat = foliageMaterial();
  const rand = rng(20260810);
  const lists = { spruce: [], broad: [], umbrella: [], fen: [], column: [], shrub: [] };
  const tries = Math.round(11000 * quality);
  for (let i = 0; i < tries; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * ISLAND_R * 0.99;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const h = sampleH(x, z);
    if (h === null) continue;
    if (rr < 38) continue;                       // the court and its approach stay open
    const sl = sampleSlope(x, z);
    if (sl > 0.70) continue;
    if (pathAt(x, z) > 0.4) continue;
    if (underWater(x, z, 1.2)) continue;
    if (h > SNOW_Y - 10) continue;
    if (rr < 74 && rand() > sstep(40, 74, rr)) continue;
    // The Southern Terrace is a lookout, and a lookout with a wood on it is a
    // wood. Thin the canopy hard over the shelf and clear its lip outright, so
    // walking south hands you the horizon instead of another tree.
    const terr = sstep(96, 116, z) * sstep(170, 74, Math.abs(x - 10));
    if (terr > 0.2 && rand() < 0.24 + terr * 0.62) continue;

    const w = zoneWeights(x, z);
    const m = moistAt(x, z);
    const clump = 0.30 + fbm(x * 0.026 + 3, z * 0.026 - 8, 3) * 1.45;

    /**
     * A HUNDRED TREES ARE NOT ONE TREE A HUNDRED TIMES.
     *
     * Every instance shares one mesh, so the only variables that exist are the
     * ones written here — and with a single uniform scale and a grey value
     * multiplier, a wood reads as wallpaper. Four things break that, and all
     * four are cheap:
     *
     *  - **Size, distributed rather than uniform.** A real stand is mostly
     *     mid-sized with a handful of giants and a scatter of saplings, which
     *     is a power curve, not a flat range. Height and girth vary
     *     independently, so a tall thin one and a squat broad one are the same
     *     mesh.
     *  - **Lean.** Nothing that grew in wind stands plumb. Every tree leans a
     *     few degrees, biased downwind of the island's one wind vector, so a
     *     whole hillside leans together and the outliers read as individuals.
     *  - **Hue, not just value.** The tint runs from deep cool green on wet
     *     ground to olive-gold on dry, with a per-tree jitter across it —
     *     because a canopy where every crown is the same green is the loudest
     *     "instanced mesh" tell there is.
     *  - **Age.** Bigger trees are darker and bluer; saplings are bright and
     *     yellow-green.
     */
    const size = 0.42 + Math.pow(rand(), 1.65) * 1.55;
    const dry = clamp(1 - m * 1.35, 0, 1);
    const jit = rand();
    const age = clamp((size - 0.42) / 1.55, 0, 1);
    const v = 0.74 + rand() * 0.46 - age * 0.14;
    const lean = 0.035 + Math.pow(rand(), 1.4) * 0.16;
    const leanA = Math.atan2(0.51, 0.86) + (rand() - 0.5) * 2.2;   // downwind, loosely
    const spot = {
      x, y: h - 0.3, z,
      s: size,
      w: size * (0.76 + rand() * 0.56),
      yaw: rand() * 6.28,
      lean, leanA,
      r: v * (0.80 + dry * 0.42 + jit * 0.20 - age * 0.05),
      g: v * (1.02 - dry * 0.14 + jit * 0.08),
      b: v * (0.62 + (1 - dry) * 0.40 - jit * 0.16 + age * 0.10),
    };

    // pick the species the region votes for, then let the clump field decide
    // whether anything grows here at all
    const r = rand();
    let acc = 0, pick = null;
    const votes = [
      ['spruce', w[ZONE_INDEX.alpine] * 1.15],
      ['broad', w[ZONE_INDEX.verdant] * 1.25],
      ['umbrella', w[ZONE_INDEX.steppe] * 0.62],
      ['fen', w[ZONE_INDEX.mire] * 0.80],
      ['column', w[ZONE_INDEX.badland] * 0.40],
    ];
    let total = 0;
    for (const v of votes) total += v[1];
    let pr = rand() * total;
    for (const v of votes) { acc += v[1]; if (pr <= acc) { pick = v[0]; break; } }
    pick = pick || 'spruce';

    const canopy = clamp(clump * (0.35 + m * 1.05), 0, 1) * total;
    if (r < canopy * 0.42) {
      lists[pick].push(spot);
    } else if (r < 0.13) {
      lists.shrub.push({ ...spot, y: h - 0.08, s: 0.55 + rand() * 1.05, w: 0.65 + rand() * 1.0 });
    }
  }

  const made = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const SPEC = [
    ['spruce', spruceGeometry, Math.round(330 * quality), true],
    ['broad', broadleafGeometry, Math.round(250 * quality), true],
    ['umbrella', umbrellaGeometry, Math.round(120 * quality), true],
    ['fen', fenTreeGeometry, Math.round(150 * quality), false],
    ['column', columnarGeometry, Math.round(110 * quality), false],
    ['shrub', shrubGeometry, Math.round(330 * quality), false],
  ];
  for (const [key, geoFn, cap, shadow] of SPEC) {
    const list = lists[key];
    const n = Math.min(list.length, cap);
    if (!n) continue;
    const inst = new THREE.InstancedMesh(geoFn(), leafMat, n);
    inst.castShadow = shadow;
    inst.receiveShadow = true;
    const col = new THREE.Color();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const qy = new THREE.Quaternion();
    const ql = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const s = list[i];
      qy.setFromAxisAngle(up, s.yaw);
      axis.set(Math.cos(s.leanA), 0, Math.sin(s.leanA));
      ql.setFromAxisAngle(axis, s.lean);
      q.copy(ql).multiply(qy);
      inst.setMatrixAt(i, m4.compose(
        pos.set(s.x, s.y, s.z), q,
        scl.set(s.w, s.s, s.w),
      ));
      col.setRGB(s.r, s.g, s.b);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
    made.push(inst);
  }
  made.material = leafMat;
  return made;
}

// ---------------------------------------------------------------------------
// Boulders, scree, slabs — the connective tissue that makes ground feel real
// ---------------------------------------------------------------------------
export function createRocks(scene, quality) {
  const g0 = new THREE.IcosahedronGeometry(1, 1);
  // squash it a bit and add noise so it is not a faceted ball
  const p = g0.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.72 + fbm(x * 2.1 + 10, z * 2.1 + y * 1.3, 3) * 0.6;
    p.setXYZ(i, x * n, y * n * 0.72, z * n);
  }
  g0.computeVertexNormals();
  paint(g0, 1, 1, 1);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a8278, roughness: 0.95, metalness: 0.0, flatShading: true, vertexColors: true,
  });
  const rand = rng(31337);
  const spots = [];
  const N = Math.round(320 * quality);
  for (let i = 0; i < N * 12 && spots.length < N; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.pow(rand(), 0.5) * ISLAND_R * 0.99;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const h = sampleH(x, z);
    if (h === null) continue;
    if (underWater(x, z, 0.4)) continue;
    if (Math.hypot(x, z) < 21) continue;
    const sl = sampleSlope(x, z);
    const road = pathAt(x, z);
    const dry = 1 - moistAt(x, z);
    const chance = 0.10 + sl * 0.8 + dry * 0.3 + sstep(82, 122, h) * 0.5;
    if (rand() > chance) continue;
    if (road > 0.6 && rand() > 0.15) continue;
    const s = (0.34 + Math.pow(rand(), 3.0) * 5.6) * (1 + sstep(60, 120, h) * 0.7);
    spots.push({ x, y: h - s * 0.28, z, s, yaw: rand() * 6.28, tint: 0.72 + rand() * 0.5 });
  }
  const inst = new THREE.InstancedMesh(g0, mat, spots.length);
  inst.castShadow = true; inst.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    e.set((rand() - 0.5) * 0.5, s.yaw, (rand() - 0.5) * 0.5);
    q.setFromEuler(e);
    inst.setMatrixAt(i, m4.compose(
      new THREE.Vector3(s.x, s.y, s.z), q,
      new THREE.Vector3(s.s, s.s * (0.72 + (i % 5) * 0.11), s.s * (0.86 + (i % 3) * 0.14))
    ));
    col.setRGB(1.05 * s.tint, 0.98 * s.tint, 0.87 * s.tint);
    inst.setColorAt(i, col);
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);
  return inst;
}

// ---------------------------------------------------------------------------
// The Ring of the Spine — a broken monument on the summit. The one silhouette
// visible from every point on the island.
// ---------------------------------------------------------------------------
export function createSummitRing(scene) {
  const g = new THREE.Group();
  const summit = place(PEAK.x, PEAK.z);
  g.position.set(PEAK.x, summit, PEAK.z);
  g.rotation.y = Math.atan2(-PEAK.x, -PEAK.z);

  const glow = new THREE.MeshStandardMaterial({
    color: 0x9fe8ff, emissive: 0x37b6ff, emissiveIntensity: 2.6, roughness: 0.3,
    transparent: true, opacity: 0.92,
  });

  // Scaled to be legible from the plaza a hundred and sixty metres away: the
  // ring is forty-eight metres across and stands on the highest ground there is.
  const parts = [];
  for (const s of [-1, 1]) {
    const plinth = new THREE.CylinderGeometry(5.0, 7.6, 20, 8);
    plinth.translate(s * 25, 8.0, 0);
    paintY(plinth, [0.440, 0.418, 0.384], [0.820, 0.788, 0.722], 0, 20);
    parts.push(plinth);
    // a buttress leaning off each plinth, so the base is not a plain drum
    const but = new THREE.BoxGeometry(3.6, 17, 3.6);
    but.rotateZ(-s * 0.30);
    but.translate(s * 32, 8, 0);
    paintY(but, [0.410, 0.388, 0.356], [0.760, 0.728, 0.666], 0, 18);
    parts.push(but);
  }
  // the broken ring: two great arcs, with the gap at the top
  for (const s of [-1, 1]) {
    const arc = new THREE.TorusGeometry(25.5, 3.1, 7, 40, Math.PI * 0.40);
    arc.scale(1, 1, 0.42);
    arc.rotateZ(s > 0 ? 0.10 : Math.PI * 0.60 - 0.10);
    arc.translate(0, 16, 0);
    paintY(arc, [0.470, 0.446, 0.408], [0.880, 0.846, 0.776], 6, 44);
    parts.push(arc);
  }
  const ringMesh = new THREE.Mesh(merge(parts), stoneMaterial({ course: 1.60, block: 2.40, mossAmt: 0.18 }));
  ringMesh.castShadow = true; ringMesh.receiveShadow = true;
  g.add(ringMesh);

  // the cipher itself, floating in the gap
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(5.4, 0), glow);
  core.position.set(0, 46.0, 0);
  g.add(core);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(9.4, 0.46, 6, 32), glow);
  halo.position.copy(core.position);
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  const l = new THREE.PointLight(0x6fd0ff, 120, 190, 2);
  l.position.copy(core.position);
  g.add(l);

  scene.add(g);
  return {
    group: g,
    update(t) {
      core.rotation.y = t * 0.35;
      core.rotation.x = Math.sin(t * 0.5) * 0.3;
      halo.rotation.z = t * 0.6;
      core.position.y = 46.0 + Math.sin(t * 0.8) * 1.4;
      l.intensity = 110 + Math.sin(t * 1.7) * 22;
    },
  };
}

// ---------------------------------------------------------------------------
// Hoodoos — wind-cut rock stacks standing over the badlands. Cheap landmarks
// that turn a dust bowl into somewhere you want to walk to.
// ---------------------------------------------------------------------------
/**
 * Twenty-eight of these stand in one bowl, and the previous version of this
 * function grew them all the same: same seven-sided drum, same taper, same tan,
 * all plumb. A field of that reads as fence posts, and a critic called it
 * exactly that.
 *
 * Four axes of difference, all cheap:
 *   - **the bed they were cut from.** Every stack picks a hue off the wastes'
 *     own palette — pale marl, iron red, bleached bone — and holds it, so the
 *     bowl reads as several beds eroding at different rates rather than one.
 *   - **lean.** A wind-cut stack topples toward the prevailing wind as its
 *     base wastes. These lean up to fifteen degrees, and the tall ones lean
 *     furthest, which is also the physics.
 *   - **profile.** Some are slender needles, some are squat toadstools with an
 *     overhanging cap three times the width of their neck, some are broken off
 *     with no cap at all.
 *   - **section.** Five, six and eight sides, and elliptical in plan, so no two
 *     silhouettes repeat.
 */
export function createHoodoos(scene, quality) {
  const parts = [];
  const rand = rng(3131);
  const N = Math.round(34 * quality);
  // the beds the wastes are cut out of: pale marl, iron, bone, rust
  const BEDS = [
    [0.72, 0.60, 0.44], [0.56, 0.26, 0.18],
    [0.82, 0.76, 0.62], [0.64, 0.38, 0.24],
  ];
  for (let i = 0; i < N * 20 && parts.length < N * 5; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.pow(rand(), 0.6) * 74;
    const x = MESA.x + Math.cos(a) * rr, z = MESA.z + Math.sin(a) * rr;
    const h = sampleH(x, z);
    if (h === null || sampleSlope(x, z) > 0.55) continue;
    if (pathAt(x, z) > 0.4) continue;

    const slender = rand();                       // 0 squat toadstool, 1 needle
    const tall = 5 + Math.pow(rand(), 1.4) * (10 + slender * 24);
    const girth = (1.35 - slender * 0.72) * (0.75 + rand() * 0.55);
    const lean = (0.02 + rand() * 0.13) * (0.4 + tall / 30);
    const leanA = rand() * 6.28;
    const lx = Math.cos(leanA) * lean, lz = Math.sin(leanA) * lean;
    const sides = [5, 6, 8][Math.floor(rand() * 3)];
    const ell = 0.66 + rand() * 0.5;              // elliptical in plan
    const spin = rand() * 6.28;
    const bed = BEDS[Math.floor(rand() * BEDS.length)];
    const tone = 0.82 + rand() * 0.36;
    const capped = rand() > 0.28;                 // some have lost their capstone

    let y = h - 0.6;
    const drums = 4 + Math.floor(rand() * 5);
    for (let k = 0; k < drums; k++) {
      const t = k / drums;
      const seg = tall / drums;
      // the waist: wind cuts hardest a third of the way up
      const waist = 1 - Math.exp(-Math.pow((t - 0.34) / 0.26, 2)) * (0.30 + slender * 0.34);
      const w = girth * (1.02 - t * 0.40) * waist * (0.84 + rand() * 0.32);
      const w2 = girth * (1.02 - (t + 1 / drums) * 0.40) * waist * (0.84 + rand() * 0.32);
      const d = new THREE.CylinderGeometry(w2 * 0.96, w, seg, sides);
      d.scale(1, 1, ell);
      d.rotateY(spin + t * 0.6);
      d.translate(x + lx * (y - h) + (rand() - 0.5) * 0.35,
                  y + seg * 0.5,
                  z + lz * (y - h) + (rand() - 0.5) * 0.35);
      // bedding: each drum is a visibly different band of the same cliff
      const sh = tone * (0.58 + t * 0.44 + rand() * 0.14);
      const alt = (k % 2) ? 1.0 : 0.86;
      paint(d, bed[0] * sh * alt, bed[1] * sh * alt, bed[2] * sh);
      parts.push(d);
      y += seg;
    }
    if (capped) {
      // the capstone that kept the column from eroding — a harder bed, and it
      // overhangs, which is the whole reason the column is still here
      const cw = girth * (0.86 + rand() * 0.62);
      const cap = new THREE.CylinderGeometry(cw * 0.78, cw, 0.6 + rand() * 1.1, sides);
      cap.scale(1, 1, ell);
      cap.rotateY(spin + 0.9);
      cap.translate(x + lx * (y - h), y + 0.5, z + lz * (y - h));
      paint(cap, bed[0] * 0.66, bed[1] * 0.62, bed[2] * 0.66);
      parts.push(cap);
    }
  }
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, flatShading: true,
  }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// The Cipher Court — the plaza you wake up on. A ring of survey pillars and a
// pedestal, so the first thing a cadet sees is a place someone built.
// ---------------------------------------------------------------------------
export function createPlaza(scene) {
  const g = new THREE.Group();
  const base = place(0, 0);
  g.position.set(0, base, 0);
  const stone = new THREE.MeshStandardMaterial({ color: 0xc3b9ab, roughness: 0.86, flatShading: true });
  const lit = new THREE.MeshStandardMaterial({
    color: 0x9fe8ff, emissive: 0x39b8ff, emissiveIntensity: 2.4, roughness: 0.3,
    transparent: true, opacity: 0.9,
  });
  const rand = rng(4711);
  const parts = [];
  const LO = [0.300, 0.286, 0.262], HI = [0.720, 0.690, 0.634];

  // A colonnade, not a picket fence: tall fluted markers at the cardinals, low
  // broken stumps between them, and the whole ring opening onto the north road.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    // The north-south road runs straight through the court, so the colonnade
    // opens on both ends of it. Without this a survey pillar stands eleven
    // metres in front of the camera you wake up behind and eats the frame.
    if (Math.abs(Math.cos(a)) < 0.56) continue;
    const major = i % 4 === 0;
    const broke = !major && rand() < 0.42;
    const hgt = (major ? 3.8 + rand() * 1.3 : 1.9 + rand() * 1.1) * (broke ? 0.42 : 1);
    const w = major ? 0.62 : 0.40;
    const shaft = new THREE.CylinderGeometry(w * 0.74, w, hgt, major ? 8 : 6, 2);
    shaft.rotateY(-a + 0.4);
    shaft.translate(Math.cos(a) * 20.4, hgt * 0.5, Math.sin(a) * 20.4);
    paintY(shaft, LO, HI, 0, hgt);
    parts.push(shaft);
    if (!broke) {
      const capG = new THREE.CylinderGeometry(w * 1.35, w * 0.95, 0.55, major ? 8 : 6);
      capG.rotateY(-a + 0.4);
      capG.translate(Math.cos(a) * 20.4, hgt + 0.27, Math.sin(a) * 20.4);
      paint(capG, HI[0], HI[1], HI[2]);
      parts.push(capG);
      if (major) {
        const fin = new THREE.OctahedronGeometry(0.9, 0);
        fin.scale(0.5, 1.5, 0.5);
        fin.translate(Math.cos(a) * 20.4, hgt + 1.5, Math.sin(a) * 20.4);
        paint(fin, HI[0], HI[1], HI[2]);
        parts.push(fin);
      }
    }
  }

  // The gate: a broken arch standing over the north road, which is what puts a
  // vertical on the centre axis of the very first frame the player ever sees.
  for (const s of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(2.2, 3.6, 40, 9, 2);
    leg.translate(s * 16, -0.6, -46);
    paintY(leg, LO, HI, -20, 18);
    parts.push(leg);
    const shoulder = new THREE.BoxGeometry(5.8, 2.6, 4.8);
    shoulder.rotateZ(-s * 0.05);
    shoulder.translate(s * 14.8, 18.6, -46);
    paint(shoulder, HI[0], HI[1], HI[2]);
    parts.push(shoulder);
  }
  const lint = new THREE.BoxGeometry(37, 3.6, 5.2);
  lint.rotateZ(0.022);
  lint.translate(0, 20.7, -46);
  paintY(lint, HI, HI, 0, 1);
  parts.push(lint);
  const crown = new THREE.BoxGeometry(12.0, 2.4, 3.6);
  crown.rotateZ(-0.08);
  crown.translate(-7.0, 23.4, -46);
  paint(crown, HI[0], HI[1], HI[2]);
  parts.push(crown);

  // a low pedestal, off to one side so it never blocks the road north
  const ped = new THREE.CylinderGeometry(2.6, 3.4, 1.5, 9);
  ped.translate(-9.5, 0.75, 6.5);
  paintY(ped, LO, HI, 0, 1.5);
  parts.push(ped);
  const merged = merge(parts);
  const m = new THREE.Mesh(merged, stoneMaterial({ course: 1.05, block: 1.55 }));
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);

  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), lit);
  shard.position.set(-9.5, 3.6, 6.5);
  g.add(shard);
  const l = new THREE.PointLight(0x6fd0ff, 26, 46, 2);
  l.position.set(-9.5, 4.2, 6.5);
  g.add(l);

  scene.add(g);
  return {
    group: g,
    update(t) {
      shard.rotation.y = t * 0.6;
      shard.rotation.x = Math.sin(t * 0.7) * 0.35;
      shard.position.y = 3.6 + Math.sin(t * 1.1) * 0.22;
      l.intensity = 24 + Math.sin(t * 2.2) * 5;
    },
  };
}

// ---------------------------------------------------------------------------
// The ruined aqueduct — arches marching across the badland approach. Pure
// scale-giving: you can see how big the island is by how small they get.
// ---------------------------------------------------------------------------
export function createAqueduct(scene) {
  const g = new THREE.Group();
  const stone = stoneMaterial({ course: 1.30, block: 2.10, mossAmt: 0.46 });
  const parts = [];
  const rand = rng(8080);
  // a straight run of piers marching south-east, deck riding at a constant
  // height so it steps clear of the ground and reads as engineering
  const a0 = Math.atan2(MESA.z, MESA.x) - 0.52;
  const nodes = [];
  for (let i = 0; i < 13; i++) {
    const rr = 50 + i * 11.5;
    const x = Math.cos(a0 + i * 0.024) * rr;
    const z = Math.sin(a0 + i * 0.024) * rr;
    const h = sampleH(x, z);
    if (h === null) break;
    nodes.push({ x, z, h });
  }
  if (nodes.length < 3) return { group: g, update() {} };
  const deckY = Math.max(...nodes.map((n) => n.h)) + 15;
  const yaw = -a0 + Math.PI / 2;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const standing = rand() > 0.16;
    if (!standing) continue;
    const pierH = deckY - n.h - 5.4;
    if (pierH < 3) continue;
    const pier = new THREE.BoxGeometry(3.4, pierH, 4.0);
    pier.rotateY(yaw);
    pier.translate(n.x, n.h + pierH * 0.5, n.z);
    paintY(pier, [0.520, 0.492, 0.446], [0.700, 0.664, 0.596], n.h, n.h + pierH);
    parts.push(pier);
    const cap = new THREE.BoxGeometry(5.0, 1.2, 5.4);
    cap.rotateY(yaw);
    cap.translate(n.x, n.h + pierH + 0.6, n.z);
    paint(cap, 0.700, 0.664, 0.596);
    parts.push(cap);

    const nx = nodes[i + 1];
    if (!nx || rand() < 0.22) continue;
    const mx = (n.x + nx.x) / 2, mz = (n.z + nx.z) / 2;
    const span = Math.hypot(nx.x - n.x, nx.z - n.z);
    const arch = new THREE.TorusGeometry(span * 0.46, 1.05, 5, 14, Math.PI);
    arch.rotateY(yaw);
    arch.translate(mx, deckY - 4.6, mz);
    paintY(arch, [0.560, 0.530, 0.478], [0.720, 0.684, 0.614], deckY - 10, deckY);
    parts.push(arch);
    const deck = new THREE.BoxGeometry(span + 0.6, 2.0, 4.6);
    deck.rotateY(yaw);
    deck.translate(mx, deckY - 1.0, mz);
    paint(deck, 0.660, 0.626, 0.562);
    parts.push(deck);
  }
  if (!parts.length) return { group: g, update() {} };
  const merged = merge(parts);
  const m = new THREE.Mesh(merged, stone);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  scene.add(g);
  return { group: g, update() {} };
}

// ---------------------------------------------------------------------------
// Sky islands — the middle and far distance. Depth is what makes a vista.
// ---------------------------------------------------------------------------
export function createSkyIslands(scene, quality) {
  const group = new THREE.Group();
  const rand = rng(1234567);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.98, flatShading: true, vertexColors: true, fog: false,
  });

  const parts = [];
  const N = Math.round(15 * clamp(quality * 1.4, 0.5, 1));
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const dist = 520 + Math.pow(rand(), 0.6) * 1150;
    const y = -30 + rand() * 190 - dist * 0.035;
    const s = 12 + Math.pow(rand(), 1.7) * 100 * (dist / 800);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    // aerial perspective: the further out, the more it dissolves into the sky
    const haze = clamp((dist - 420) / 1700, 0, 0.62);
    const lum = 0.34 + rand() * 0.16;
    const rockC = [
      lum * 1.02 + haze * 0.52, lum * 0.99 + haze * 0.54, lum * 1.06 + haze * 0.58,
    ];
    const grassC = [
      lum * 0.72 + haze * 0.50, lum * 1.55 + haze * 0.56, lum * 0.62 + haze * 0.60,
    ];

    // upper body: a squashed rock mass, so the silhouette is a landmass
    const body = new THREE.IcosahedronGeometry(1, 1);
    const bp = body.attributes.position;
    for (let k = 0; k < bp.count; k++) {
      const px = bp.getX(k), py = bp.getY(k), pz = bp.getZ(k);
      const n = 0.78 + fbm(px * 2.3 + i, pz * 2.3 + py) * 0.5;
      bp.setXYZ(k, px * n, py * n * (py > 0 ? 0.34 : 0.9), pz * n);
    }
    body.scale(s, s, s * 0.92);
    body.translate(x, y, z);
    paint(body, rockC[0], rockC[1], rockC[2]);
    parts.push(body);

    // keel: a long tapering root of rock
    const keel = new THREE.ConeGeometry(0.86, 2.6, 7);
    keel.scale(s, s, s * 0.9);
    keel.rotateX(Math.PI);
    keel.translate(x, y - s * 1.20, z);
    paint(keel, rockC[0] * 0.82, rockC[1] * 0.82, rockC[2] * 0.9);
    parts.push(keel);

    // a green table on top — the thing that makes it read as a *place*
    const cap = new THREE.CylinderGeometry(s * 0.80, s * 0.90, s * 0.16, 11);
    cap.translate(x, y + s * 0.30, z);
    paint(cap, grassC[0], grassC[1], grassC[2]);
    parts.push(cap);

    if (s > 40) {
      for (let k = 0; k < 4; k++) {
        const sp = new THREE.ConeGeometry(s * 0.045, s * (0.5 + rand() * 0.8), 5);
        const aa = rand() * 6.28, rr2 = rand() * s * 0.55;
        sp.translate(x + Math.cos(aa) * rr2, y + s * 0.62, z + Math.sin(aa) * rr2);
        paint(sp, 0.30 + haze * 0.55, 0.48 + haze * 0.52, 0.62 + haze * 0.58);
        parts.push(sp);
      }
      // a waterfall of its own, falling into nothing
      const fallG = new THREE.PlaneGeometry(s * 0.10, s * 1.5);
      fallG.translate(x + s * 0.4, y - s * 0.5, z + s * 0.2);
      paint(fallG, 0.80 + haze * 0.2, 0.88 + haze * 0.12, 0.96);
      parts.push(fallG);
    }
  }
  const merged = merge(parts);
  const mesh = new THREE.Mesh(merged, rockMat);
  mesh.frustumCulled = false;
  group.add(mesh);
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------
// Near floating rocks — parallax you can almost touch.
//
// NOT landable: they are an InstancedMesh that nothing registers with the
// player's solid registry, so a cadet who aims a glide at one falls through it.
// The comment here used to promise the opposite, which is the same defect as an
// invisible wall pointed the other way. They are now kept inside the verge
// (below) so that at least nothing beyond the boundary looks like a target, and
// giving them real collision is a separate, larger job in src/player.
// ---------------------------------------------------------------------------
export function createFloatingRocks(scene, quality) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.7 + fbm(x * 1.7 + 3, z * 1.7 + y, 3) * 0.7;
    p.setXYZ(i, x * n, y * n * 0.62, z * n);
  }
  geo.computeVertexNormals();
  paint(geo, 1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a7686, roughness: 0.92, flatShading: true, vertexColors: true });
  const N = Math.round(46 * quality);
  const inst = new THREE.InstancedMesh(geo, mat, N);
  inst.castShadow = true;
  const rand = rng(24680);
  const data = [];
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const a = rand() * 6.28;
    // Inside the verge, all of them. These are the rocks a cadet reads as
    // "somewhere I could glide to", and they used to drift out to 2.56 × the
    // island radius — a hundred and sixty metres past the leash in
    // src/player/locomotion.js. Aiming a whole flight at one and hitting an
    // invisible wall is the world advertising a destination it will not
    // honour. Nothing near enough to look landable is out of reach any more.
    const rr = ISLAND_R * (1.06 + rand() * 0.44);
    const y = 6 + rand() * 120 - rr * 0.12;
    const s = 3 + Math.pow(rand(), 1.8) * 22;
    data.push({ a, rr, y, s, spin: (rand() - 0.5) * 0.09, phase: rand() * 6.28, tilt: (rand() - 0.5) * 0.6 });
    const g = 0.52 + rand() * 0.22;
    col.setRGB(g, g * 1.02, g * 1.16);
    inst.setColorAt(i, col);
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
  return {
    inst,
    update(dt, t) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        d.a += dt * 0.010;
        v.set(Math.cos(d.a) * d.rr, d.y + Math.sin(t * 0.35 + d.phase) * 2.4, Math.sin(d.a) * d.rr);
        e.set(d.tilt, d.a * 1.6 + t * d.spin, Math.sin(t * 0.2 + d.phase) * 0.1);
        q.setFromEuler(e);
        inst.setMatrixAt(i, m4.compose(v, q, sv.set(d.s, d.s * 0.8, d.s * 0.92)));
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}
