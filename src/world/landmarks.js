import * as THREE from 'three';
import { merge, paint, paintY } from './geom.js';
import { rng, fbm } from './noise.js';
import { sampleH, heightAt, LAKE, GROVE, HENGE, MESA, PEAK2 } from './terrain.js';
import { stoneMaterial } from './stone.js';

/**
 * HERO SILHOUETTES.
 *
 * One per region, and not one of them is a chamfered pillar. Each is big
 * enough to be read from the far side of the island, distinct enough in
 * outline that you can name it from a hundred and fifty metres, and placed so
 * that turning on the spot at the plaza puts a different one on each quarter of
 * the horizon. This is the "see a thing, go to the thing" contract.
 *
 *   north  The Spine, and the broken Ring on its summit          (props.js)
 *   west   The Cathedral — crystal blades ninety metres tall
 *   south  The Ossuary — a colony ship, nose-first into the wastes
 *   east   The Glass Arch, straddling the spill where the lake leaves the world
 *   s/w    The Reckoning — a tilted ring of stone half-buried in the steppe
 */

const groundAt = (x, z, fb = 10) => {
  const h = sampleH(x, z);
  return h === null ? (heightAt(x, z) ?? fb) : h;
};

// ---------------------------------------------------------------------------
// THE OSSUARY — a colony ship that came down nose-first two centuries ago and
// has been weathering into the badlands ever since. The one piece of geometry
// in the world with a joke in it: it is still, technically, on schedule.
// ---------------------------------------------------------------------------
export const WRECK = { x: 16, z: 140 };

export function createWreck(scene) {
  const g = new THREE.Group();
  const base = groundAt(WRECK.x, WRECK.z);
  g.position.set(WRECK.x, base - 3, WRECK.z);
  g.rotation.y = 0.18;
  g.scale.setScalar(0.80);

  const rand = rng(90210);
  const parts = [];
  const BONE = [0.560, 0.530, 0.486];
  const PALE = [0.780, 0.748, 0.686];
  const RUST = [0.372, 0.196, 0.120];
  const DARK = [0.150, 0.140, 0.146];
  const TILT = 0.34;                        // nose down, stern in the air
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  const along = (d, r = 0, a = 0) => [
    ct * d - st * Math.sin(a) * r,
    19 + st * d + ct * Math.sin(a) * r,
    Math.cos(a) * r,
  ];

  // --- the hull: a long tapering body driven nose-first into the terraces ---
  const hull = new THREE.CylinderGeometry(5.6, 11.0, 78, 12, 1, false);
  hull.rotateZ(Math.PI / 2);
  hull.rotateZ(TILT);
  hull.translate(0, 19, 0);
  paintY(hull, RUST, PALE, 2, 36);
  parts.push(hull);

  // belly strakes, so the hull has plating rather than being one smooth tube
  for (let i = 0; i < 9; i++) {
    const d = -34 + i * 8.4;
    const band = new THREE.CylinderGeometry(11.15 - (d + 39) * 0.069, 11.05 - (d + 39) * 0.069, 1.5, 12, 1, true);
    band.rotateZ(Math.PI / 2);
    band.rotateZ(TILT);
    const p = along(d);
    band.translate(p[0], p[1], p[2]);
    paint(band, DARK[0] * 1.9, DARK[1] * 1.8, DARK[2] * 1.7);
    parts.push(band);
  }

  // --- the stern is open: pressure frames showing where the plating went ---
  for (let i = 0; i < 5; i++) {
    const d = 40 + i * 5.0;
    const r = new THREE.TorusGeometry(5.4 - i * 0.25, 0.55, 5, 14);
    r.rotateY(Math.PI / 2);
    r.rotateZ(TILT);
    const p = along(d);
    r.translate(p[0], p[1], p[2]);
    paint(r, 0.300, 0.276, 0.262);
    parts.push(r);
  }

  // --- a stepped dorsal sail: two fins, not one slab ---
  const sail = new THREE.BoxGeometry(34, 14, 2.2);
  sail.rotateZ(TILT);
  sail.translate(...along(-2, 12.5, Math.PI / 2));
  paintY(sail, BONE, PALE, 14, 46);
  parts.push(sail);
  const sail2 = new THREE.BoxGeometry(15, 22, 1.8);
  sail2.rotateZ(TILT + 0.10);
  sail2.translate(...along(20, 15, Math.PI / 2));
  paintY(sail2, BONE, PALE, 18, 56);
  parts.push(sail2);

  // --- one wing still attached, one sheared off and lying in the dirt ---
  const wing = new THREE.BoxGeometry(24, 1.6, 17);
  wing.rotateX(0.34);
  wing.rotateZ(TILT + 0.08);
  wing.translate(...along(6, 12, 0));
  paint(wing, BONE[0] * 1.05, BONE[1], BONE[2] * 0.94);
  parts.push(wing);

  // --- the engine cluster, still up in the air at the stern ---
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const bell = new THREE.CylinderGeometry(5.4, 3.0, 12, 9, 1, true);
    bell.rotateZ(Math.PI / 2);
    bell.rotateZ(TILT);
    bell.translate(...along(66, 5.0, a));
    paint(bell, DARK[0], DARK[1], DARK[2]);
    parts.push(bell);
    const collar = new THREE.TorusGeometry(5.5, 0.9, 5, 12);
    collar.rotateY(Math.PI / 2);
    collar.rotateZ(TILT);
    collar.translate(...along(60, 5.0, a));
    paint(collar, 0.360, 0.330, 0.300);
    parts.push(collar);
  }

  // --- the bow, sheared off and half-buried further down the gouge ---
  const bow = new THREE.ConeGeometry(9.2, 26, 10);
  bow.rotateZ(Math.PI / 2 - 0.50);
  bow.rotateY(0.30);
  bow.translate(-64, 6, 15);
  paintY(bow, RUST, BONE, -2, 16);
  parts.push(bow);

  // scattered plating in the gouge between the two
  for (let i = 0; i < 12; i++) {
    const t = rand();
    const px = -68 + t * 52 + (rand() - 0.5) * 8;
    const pz = (rand() - 0.5) * 30;
    const sc = 2.2 + rand() * 5.5;
    const pl = new THREE.BoxGeometry(sc * 1.7, 0.7, sc);
    pl.rotateX((rand() - 0.5) * 0.9);
    pl.rotateY(rand() * 6.28);
    pl.rotateZ((rand() - 0.5) * 0.9);
    pl.translate(px, 1.2 + rand() * 1.5, pz);
    const v = 0.7 + rand() * 0.5;
    paint(pl, BONE[0] * v, BONE[1] * v * 0.94, BONE[2] * v * 0.88);
    parts.push(pl);
  }

  const mesh = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.74, metalness: 0.26, flatShading: true,
    side: THREE.DoubleSide,
  }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);

  // --- the last lights still burning in the hull ---
  const win = [];
  for (let i = 0; i < 22; i++) {
    const t = rand();
    const d = -28 + t * 64;
    const a = rand() * Math.PI * 2;
    const r = (11.0 - (d + 39) * 0.069) * 0.99;
    const b = new THREE.BoxGeometry(2.4, 0.9, 0.4);
    b.rotateZ(TILT);
    b.rotateX(a);
    b.translate(...along(d, r, a));
    win.push(b);
  }
  const lights = new THREE.Mesh(merge(win), new THREE.MeshBasicMaterial({ color: 0xffc07a }));
  g.add(lights);

  const beacon = new THREE.PointLight(0xffab68, 40, 110, 2);
  beacon.position.set(...along(58, 14, Math.PI / 2));
  g.add(beacon);

  scene.add(g);
  return {
    group: g,
    update(t) { lights.material.color.setHSL(0.08, 0.85, 0.54 + Math.sin(t * 1.3) * 0.06); },
  };
}

// ---------------------------------------------------------------------------
// THE CATHEDRAL — the crystal that the grove is a seedling of. Blades of it
// lean into each other ninety metres up and ring when the wind gets into them.
// ---------------------------------------------------------------------------
export const CATHEDRAL = { x: GROVE.x - 8, z: GROVE.z - 22 };

export function createCathedral(scene) {
  const g = new THREE.Group();
  const base = groundAt(CATHEDRAL.x, CATHEDRAL.z);
  g.position.set(CATHEDRAL.x, base, CATHEDRAL.z);

  const rand = rng(31415);
  const parts = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rand() * 0.22;
    const hero = i % 3 === 0;
    const hgt = hero ? 66 + rand() * 34 : 26 + rand() * 30;
    const rad = hgt * (0.052 + rand() * 0.028);
    const foot = 12 + rand() * 13;
    const blade = new THREE.CylinderGeometry(rad * 0.16, rad, hgt, 6, 1);
    blade.translate(0, hgt * 0.5, 0);
    blade.rotateZ(-(0.10 + rand() * 0.13));
    blade.rotateY(-a);
    blade.translate(Math.cos(a) * foot, -2, Math.sin(a) * foot);
    const l = hero ? 0.62 : 0.48;
    paintY(blade, [0.16, 0.38, 0.50], [l * 0.72, l * 1.28, l * 1.5], 0, hgt);
    parts.push(blade);
  }
  // the floor slab they all grew out of
  const slab = new THREE.CylinderGeometry(26, 30, 4.5, 12);
  slab.translate(0, -1.6, 0);
  paint(slab, 0.34, 0.36, 0.40);
  parts.push(slab);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.18, metalness: 0.05, flatShading: true,
    transparent: true, opacity: 0.93, emissive: 0xffffff, emissiveIntensity: 1.0,
  });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb * 0.5;'
    );
  };
  const mesh = new THREE.Mesh(merge(parts), mat);
  mesh.castShadow = true;
  g.add(mesh);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(5.0, 0),
    new THREE.MeshStandardMaterial({
      color: 0xa8f0ff, emissive: 0x46c8ff, emissiveIntensity: 3.2, roughness: 0.2,
      transparent: true, opacity: 0.9, flatShading: true,
    })
  );
  core.position.y = 58;
  g.add(core);
  const l = new THREE.PointLight(0x63d4ff, 80, 150, 2);
  l.position.set(0, 52, 0);
  g.add(l);

  scene.add(g);
  return {
    group: g,
    update(t) {
      core.rotation.y = t * 0.22;
      core.rotation.z = Math.sin(t * 0.4) * 0.24;
      core.position.y = 58 + Math.sin(t * 0.55) * 1.8;
      l.intensity = 74 + Math.sin(t * 1.1) * 14;
    },
  };
}

// ---------------------------------------------------------------------------
// THE GLASS ARCH — where the lake leaves the island, something older than the
// lake stands over the drop. Best view on the map, and a thing to glide off.
// ---------------------------------------------------------------------------
const SPILL_ANG = Math.atan2(LAKE.z, LAKE.x);
export const ARCH = {
  x: LAKE.x + Math.cos(SPILL_ANG) * (LAKE.r + 4),
  z: LAKE.z + Math.sin(SPILL_ANG) * (LAKE.r + 4),
};

export function createArch(scene) {
  const g = new THREE.Group();
  const base = groundAt(ARCH.x, ARCH.z);
  g.position.set(ARCH.x, base - 4, ARCH.z);
  g.rotation.y = -SPILL_ANG;

  const parts = [];
  // the span: a broad crystalline arc, faceted, thickest at the haunches
  const arc = new THREE.TorusGeometry(38, 5.2, 6, 26, Math.PI);
  arc.scale(1.0, 1.22, 0.62);
  arc.translate(0, 2, 0);
  paintY(arc, [0.26, 0.44, 0.52], [0.52, 0.90, 1.00], 0, 50);
  parts.push(arc);

  // an inner ring of shards hanging from the crown
  const rand = rng(2718);
  for (let i = 0; i < 9; i++) {
    const t = 0.16 + (i / 8) * 0.68;
    const a = Math.PI * t;
    const len = 5 + rand() * 15;
    const sh = new THREE.ConeGeometry(1.5 + rand() * 1.4, len, 5);
    sh.rotateX(Math.PI);
    sh.translate(Math.cos(a) * 34, 2 + Math.sin(a) * 41 - len * 0.5, (rand() - 0.5) * 5);
    paintY(sh, [0.30, 0.62, 0.80], [0.60, 0.95, 1.05], -20, 50);
    parts.push(sh);
  }

  // footings
  for (const s of [-1, 1]) {
    const f = new THREE.CylinderGeometry(10, 14, 16, 8);
    f.translate(s * 37, 0, 0);
    paint(f, 0.30, 0.34, 0.36);
    parts.push(f);
  }

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.16, metalness: 0.06, flatShading: true,
    transparent: true, opacity: 0.9, emissive: 0xffffff, emissiveIntensity: 1.0,
  });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb * 0.34;'
    );
  };
  const mesh = new THREE.Mesh(merge(parts), mat);
  mesh.castShadow = true;
  g.add(mesh);

  const l = new THREE.PointLight(0x7fe0ff, 46, 120, 2);
  l.position.set(0, 44, 0);
  g.add(l);

  scene.add(g);
  return { group: g, update(t) { l.intensity = 42 + Math.sin(t * 0.9) * 10; } };
}

// ---------------------------------------------------------------------------
// THE RECKONING — a stone ring forty-six metres across, tipped on its side and
// driven into the steppe. Whatever it measured, it is still measuring.
// ---------------------------------------------------------------------------
export function createReckoning(scene) {
  const g = new THREE.Group();
  const base = groundAt(HENGE.x, HENGE.z);
  g.position.set(HENGE.x, base, HENGE.z);
  g.rotation.y = Math.atan2(-HENGE.x, -HENGE.z) + 0.5;

  const rand = rng(1618);
  const parts = [];
  const STONE = [0.470, 0.442, 0.398];
  const PALE = [0.660, 0.630, 0.566];

  // the great ring, tipped and sunk
  const ring = new THREE.TorusGeometry(23, 2.6, 6, 34);
  ring.rotateX(0.52);
  ring.rotateZ(0.18);
  ring.translate(0, 13, 0);
  paintY(ring, STONE, PALE, 0, 34);
  parts.push(ring);

  // an inner ring, thinner, tilted the other way — it reads as a mechanism
  const ring2 = new THREE.TorusGeometry(14.5, 1.2, 5, 26);
  ring2.rotateX(-0.34);
  ring2.rotateZ(0.62);
  ring2.translate(0, 14, 0);
  paintY(ring2, STONE, PALE, 0, 30);
  parts.push(ring2);

  // the gnomon: one blade of stone leaning through the middle
  const gn = new THREE.BoxGeometry(3.2, 40, 1.4);
  gn.rotateZ(-0.30);
  gn.rotateY(0.4);
  gn.translate(3, 17, 0);
  paintY(gn, STONE, PALE, 0, 38);
  parts.push(gn);

  // a spiral of markers running out from the foot — the thing has a scale
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const a = t * Math.PI * 2.6;
    const rr = 26 + t * 30;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const gy = groundAt(HENGE.x + x, HENGE.z + z) - base;
    const hgt = 2.2 + (1 - t) * 7 + rand() * 2.5;
    const st = new THREE.BoxGeometry(1.5 + rand() * 0.8, hgt, 0.9 + rand() * 0.5);
    st.rotateY(-a);
    st.rotateZ((rand() - 0.5) * 0.14);
    st.translate(x, gy + hgt * 0.44, z);
    paintY(st, STONE, PALE, gy, gy + hgt);
    parts.push(st);
  }

  const mesh = new THREE.Mesh(merge(parts), stoneMaterial({ course: 1.45, block: 2.20, mossAmt: 0.40 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);

  const glyph = new THREE.Mesh(
    new THREE.RingGeometry(3.0, 6.4, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffd79a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  glyph.rotation.x = -Math.PI / 2;
  glyph.position.y = 0.7;
  g.add(glyph);

  scene.add(g);
  return {
    group: g,
    update(t) { glyph.rotation.z = t * 0.16; glyph.material.opacity = 0.42 + Math.sin(t * 1.1) * 0.16; },
  };
}

// ---------------------------------------------------------------------------
// THE WATCHTOWER on the lesser summit — the mid-distance marker that gives the
// west something to read against the Cathedral behind it.
// ---------------------------------------------------------------------------
export function createWatchtower(scene) {
  const g = new THREE.Group();
  const base = groundAt(PEAK2.x + 14, PEAK2.z + 10);
  g.position.set(PEAK2.x + 14, base - 3, PEAK2.z + 10);
  g.rotation.y = 0.7;

  const parts = [];
  const STONE = [0.400, 0.382, 0.352];
  const PALE = [0.620, 0.596, 0.540];
  // a tapering drum with a cantilevered head that overhangs the drop
  const shaft = new THREE.CylinderGeometry(4.2, 7.6, 34, 9, 1);
  shaft.translate(0, 17, 0);
  paintY(shaft, STONE, PALE, 0, 34);
  parts.push(shaft);
  const head = new THREE.CylinderGeometry(9.5, 6.4, 7, 9, 1);
  head.translate(2.4, 36, 0);
  paintY(head, PALE, PALE, 0, 1);
  parts.push(head);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const t = new THREE.BoxGeometry(2.2, 4.4, 2.2);
    t.translate(2.4 + Math.cos(a) * 8.2, 41.6, Math.sin(a) * 8.2);
    paint(t, PALE[0], PALE[1], PALE[2]);
    parts.push(t);
  }
  // a broken buttress leaning against it
  const but = new THREE.BoxGeometry(3.0, 26, 3.0);
  but.rotateZ(0.34);
  but.translate(-8.5, 12, 2);
  paintY(but, STONE, PALE, 0, 26);
  parts.push(but);

  const mesh = new THREE.Mesh(merge(parts), stoneMaterial({ course: 1.15, block: 1.60, mossAmt: 0.26 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);

  const fire = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.1, 0),
    new THREE.MeshBasicMaterial({ color: 0xffb15c })
  );
  fire.position.set(2.4, 41.5, 0);
  g.add(fire);
  const l = new THREE.PointLight(0xffa050, 40, 110, 2);
  l.position.set(2.4, 42, 0);
  g.add(l);

  scene.add(g);
  return {
    group: g,
    update(t) {
      const f = 1 + Math.sin(t * 5.1) * 0.10 + Math.sin(t * 2.3) * 0.08;
      fire.scale.setScalar(f);
      l.intensity = 34 * f;
    },
  };
}
