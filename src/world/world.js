import * as THREE from 'three';
import { SUN_DIR, KEY, HEMI, BOUNCE, RIM, AIR, COVER } from './daylight.js';
import { createSky, PALETTE } from './sky.js';
import { buildIsland, ISLAND_R, heightAt, onGround, slopeAt, LAKE, PEAK } from './terrain.js';
import { createGrass } from './grass.js';
import { createWater } from './water.js';
import {
  createCrystals, createGrove, createRocks, createSummitRing, createVegetation,
  createAqueduct, createSkyIslands, createFloatingRocks, createPlaza, createHoodoos,
} from './props.js';
import {
  createWreck, createCathedral, createArch, createReckoning, createWatchtower,
} from './landmarks.js';
import { rng } from './noise.js';
import { installAir } from './air.js';
import { createRanges, createInversion } from './ranges.js';
import { createFarlands, FARLANDS } from './farlands.js';

export { ISLAND_R, heightAt, onGround, slopeAt, LAKE, PEAK, FARLANDS };

/** The wind that everything on the island agrees about. */
export const WIND = new THREE.Vector2(0.86, 0.51);

/**
 * Assembles the island: sky, light, ground, five regions of cover, water, the
 * hero silhouettes you navigate by, and the living air between them. Everything
 * reads the one heightfield in terrain.js and the one region field in
 * biomes.js, so collision, colour, scattering and silhouette never disagree.
 */
export function createWorld(scene, quality = 1, camera = null) {
  // There is one hour of the day in this game and it lives in daylight.js.
  const sunDir = SUN_DIR.clone();

  // The air, before anything compiles. Every material in the game inherits it.
  installAir(sunDir);

  const sky = createSky(scene, sunDir);
  const ranges = createRanges(scene, sunDir);
  // The other worlds. Five of them, at eight hundred to eleven hundred metres,
  // each a different colour and a different silhouette — so that whichever way
  // you turn on the plaza, something on the horizon is visibly not this island.
  const farlands = createFarlands(scene, sunDir, quality);
  const inversion = createInversion(scene, sunDir, quality);

  // ---------------- light ----------------
  const sun = new THREE.DirectionalLight(KEY.color, KEY.intensity);
  sun.position.copy(sunDir).multiplyScalar(240);
  sun.castShadow = true;
  const sm = quality > 0.6 ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  /**
   * THE CADET'S SHADOW — what was actually wrong with it.
   *
   * It was never missing. Read the shadow map back and the cadet is *in* it,
   * head, pack, arms and boots, at the right depth; read the ground back and
   * the terrain is sampling him and finding him. Three rounds were spent
   * hunting a flag, a layer mask and a frustum that were all already correct,
   * because "no shadow" was read as "no occluder". It was neither.
   *
   * What was wrong is that the shadow was *delivered too weakly to see*, for
   * two compounding reasons:
   *
   *  1. **It was spent at the wrong scale.** One 116 m box, centred on the
   *     camera and shoved a further twelve metres down-sun, so the thing the
   *     player looks at 100% of the time sat off-centre in a volume sized for
   *     the island. 5.7 cm texels; a forearm is two of them.
   *  2. **A cast shadow only removed the sun.** Everything else on the
   *     ground — hemisphere, bounce, and the terrain's own large sky-bounce
   *     term — kept arriving at full strength inside the shadow, so at a 22°
   *     sun (where the direct term on flat ground is already only sin 22° of
   *     itself) a person-sized occluder moved the ground by about 8% of an
   *     8-bit step. Forty-metre monoliths cleared that bar on area alone.
   *     Nothing person-sized could. See `terrain.js` and `grass.js`: what
   *     blocks the sun now also blocks its share of the sky.
   *
   * So this light is anchored to **the player**, not the camera, and its box
   * is only as big as the shot needs — tight on the ground where he is looked
   * at, opening out as the camera pulls back for a vista, and never larger
   * than the island's own silhouettes need.
   *
   * Without a shadow there is no altimeter: at jump apex the ground under you
   * is unmarked and you cannot read your own height or your landing.
   */
  const SHADOW_NEAR = 22;              // half-width on foot: a 1.1 cm texel
  const SHADOW_FAR = 58;               // half-width from a vista
  const SHADOW_D = 200;                // how far up the sun ray the lens sits
  let shadowS = 0;
  /** Resize the shadow volume, and *tell the camera* — the sole reason a box
   *  assigned by `Object.assign` can look applied and never be. */
  function setShadowSpan(s) {
    if (Math.abs(s - shadowS) < shadowS * 0.06) return;
    shadowS = s;
    const c = sun.shadow.camera;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s;
    c.near = SHADOW_D - 130; c.far = SHADOW_D + 150;
    c.updateProjectionMatrix();
  }
  setShadowSpan(SHADOW_NEAR);
  // A 1.1 cm texel needs a proportionally smaller slope bias than a 6 cm one,
  // or the shadow lifts off the boots it belongs to.
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.018;
  scene.add(sun);
  scene.add(sun.target);

  // Fill, at roughly a third of the key — the ratio *is* the hour. It used to
  // run near 1.5:1 with a bright neutral directional coming almost straight
  // down, which is an overcast afternoon with a warm gel on it: no modelling,
  // grey contact shadows, and no rim on anything.
  const hemi = new THREE.HemisphereLight(HEMI.sky, HEMI.ground, HEMI.intensity);
  scene.add(hemi);

  // The light the lit ground throws back. Without it every east-facing slope
  // on the island collapses to black and you cannot tell a cliff from a chasm.
  const bounce = new THREE.DirectionalLight(BOUNCE.color, BOUNCE.intensity);
  bounce.position.set(sunDir.x * -220, 70, sunDir.z * -220);
  scene.add(bounce);

  // The kicker. It is parked *behind whatever the lens is looking at* and
  // updated with the camera, so grass tips, rock edges, monolith corners and
  // the cadet's shoulders all carry a hot warm contour against the shade. This
  // is the single cue that says the sun is low rather than merely orange, and
  // it replaced a near-overhead neutral fill that was saying the opposite.
  const rim = new THREE.DirectionalLight(RIM.color, RIM.intensity);
  rim.position.set(0, 60, -200);
  scene.add(rim);
  scene.add(rim.target);

  // ---------------- ground ----------------
  const ground = buildIsland(quality);
  scene.add(ground);
  const groundU = ground.material.userData.uniforms;

  // ---------------- cover, water, landmarks ----------------
  const grass = createGrass(scene, sunDir, quality);
  grass.setSunColors(COVER.grassSun.clone(), COVER.grassSky.clone());

  const water = createWater(scene, sunDir, quality);
  water.setSky(COVER.waterSky.clone(), COVER.waterSun.clone());

  const crystals = createCrystals(scene, quality);
  createGrove(scene, quality);
  const veg = createVegetation(scene, quality);
  const vegU = veg.material.userData.uniforms;
  vegU.uSunDir.value.copy(sunDir);
  createRocks(scene, quality);
  createHoodoos(scene, quality);
  createAqueduct(scene);
  createSkyIslands(scene, quality);

  // one hero silhouette per region — see landmarks.js
  const summit = createSummitRing(scene);
  const plaza = createPlaza(scene);
  const wreck = createWreck(scene);
  const cathedral = createCathedral(scene);
  const arch = createArch(scene);
  const reckoning = createReckoning(scene);
  const tower = createWatchtower(scene);

  const floaters = createFloatingRocks(scene, quality);
  const flock = makeFlock(scene, quality);

  const camPos = new THREE.Vector3(0, 14, 26);
  const camFwd = new THREE.Vector3(0, 0, -1);
  // The point the shadow volume is built around. Defaults to the camera; the
  // player hands us his own feet through `focusOn`, and his feet are the thing
  // whose shadow anybody is ever looking for.
  const focus = new THREE.Vector3(0, 14, 26);
  let focusFn = null;

  function update(dt, t) {
    if (camera) camPos.copy(camera.position);
    sky.update(t);
    inversion.update(t);
    farlands.update(t);

    // ---------------- the shadow volume ----------------
    //
    // Anchored on the player and only as wide as the shot: on foot the camera
    // is six metres out and a 44 m box gives an 1.1 cm texel, which is a
    // finger; from a glide or a vista it opens toward 116 m so the island's own
    // silhouettes keep theirs. It is nudged a little down-sun so its width is
    // spent on the ground the shadows fall across rather than behind the
    // caster, and it rides the ground height under the focus rather than y = 0.
    if (focusFn) { const p = focusFn(); if (p) focus.copy(p); } else focus.copy(camPos);
    const reach = camera ? camPos.distanceTo(focus) : 6;
    setShadowSpan(Math.min(SHADOW_FAR, SHADOW_NEAR + reach * 1.35));
    const lead = Math.min(10, shadowS * 0.28);
    const cx = focus.x - sunDir.x * lead, cz = focus.z - sunDir.z * lead;
    const gy = heightAt(cx, cz);
    // In the air the box climbs at half rate, so it holds both the cadet and
    // the ground he is about to land on at the top of a jump.
    const cy = gy === null ? focus.y - 2
      : gy + Math.min(26, Math.max(0, focus.y - gy) * 0.5);
    sun.target.position.set(cx, cy, cz);
    sun.position.set(cx + sunDir.x * SHADOW_D, cy + sunDir.y * SHADOW_D, cz + sunDir.z * SHADOW_D);
    grass.setSunShadow(sun);

    // The kicker sits behind the shot: everything the lens can see is rimmed.
    if (camera) {
      camera.getWorldDirection(camFwd);
      rim.target.position.copy(camPos);
      rim.position.set(
        camPos.x + camFwd.x * 300,
        camPos.y + camFwd.y * 300 + 90,
        camPos.z + camFwd.z * 300,
      );
    }

    groundU.uTime.value = t;
    vegU.uTime.value = t;

    grass.update(dt, t, camPos);
    water.update(dt, t);
    summit.update(t);
    plaza.update(t);
    wreck.update(t);
    cathedral.update(t);
    arch.update(t);
    reckoning.update(t);
    tower.update(t);
    floaters.update(dt, t);
    flock.update(dt, t);
  }

  /**
   * Hand the post stack the air this world actually has.
   *
   * The default aerial perspective dissolves everything past two hundred metres
   * into one flat lavender wash, which is exactly how a five-region island ends
   * up reading as a single beige pancake from altitude. Real air lightens the
   * distance and cools it; it does not grey it out. So: a much longer haze
   * scale, a ceiling well under one, and far less desaturation carried per unit
   * of distance — silhouettes stay separated in layers all the way to the coast.
   */
  function tuneAtmosphere(fx) {
    const gu = fx && fx.passes && fx.passes.grade && fx.passes.grade.uniforms;
    if (!gu) return;
    // The post stack is owned by another area and its uniform set moves; touch
    // only what is actually there, and never take the world down with it.
    const set = (k, v) => { if (gu[k]) gu[k].value = v; };
    const set3 = (k, r, g, b) => {
      const u = gu[k];
      if (!u || !u.value) return;
      if (u.value.isColor) u.value.setRGB(r, g, b);
      else { u.value[0] = r; u.value[1] = g; u.value[2] = b; }
    };
    // `air.js` owns aerial perspective outright, in-scene, per material, with
    // the sun's bearing and an altitude scale height. The post stack's depth
    // haze is a flat screen-space ramp that cannot know any of that, so it is
    // kept to a whisper — enough to soften the very far plane and to catch the
    // handful of unfogged shader materials out there, not enough to fight the
    // air or double-count it. Both are driven off the same AIR palette.
    set('uHazeStart', 240.0);
    set('uHazeScale', 1 / 2200);
    set('uHazeMax', 0.09);
    set('uSkyAt', 2600.0);
    set3('uHazeCool', AIR.cool[0] * 1.18, AIR.cool[1] * 1.18, AIR.cool[2] * 1.10);
    set3('uHazeWarm', AIR.warm[0] * 1.14, AIR.warm[1] * 1.16, AIR.warm[2] * 1.18);
    // distance eats chroma; put it back globally so five regions stay five
    set('uSaturation', 1.34);
    set('uContrast', 0.40);
    // `scene.fog` belongs to sky.js. Nothing here gets to have a second opinion
    // about what colour the air is — that was three modules disagreeing.
  }

  return {
    update, tuneAtmosphere, sun, ground, sky, sunDir, water, crystals, grass,
    ranges, farlands,
    /**
     * Tell the world where the shadow volume should be built. `fn` returns a
     * world-space point — the player's feet. Without it the volume falls back
     * to the camera, which is six metres behind the one thing that matters.
     */
    focusOn(fn) { focusFn = fn; },
    /** What the volume currently spans, in metres. For the critics. */
    get shadowSpan() { return shadowS * 2; },
    // the far world, and the one heightfield, reachable from the critic surface
    FARLANDS, heightAt, ISLAND_R,
    landmarks: { summit, plaza, wreck, cathedral, arch, reckoning, tower },
  };
}

// ---------------------------------------------------------------------------
function makeFlock(scene, quality) {
  const g = new THREE.BufferGeometry();
  // a simple delta silhouette — at this distance it is all silhouette anyway
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 1.6, -1.5, 0.1, -0.9, 0, 0, -0.3,
    0, 0, 1.6, 0, 0, -0.3, 1.5, 0.1, -0.9,
  ], 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2b2f45, roughness: 0.9, side: THREE.DoubleSide, flatShading: true,
  });
  const N = Math.round(30 * quality);
  const inst = new THREE.InstancedMesh(g, mat, N);
  inst.frustumCulled = false;
  scene.add(inst);
  const rand = rng(606);
  const d = [];
  for (let i = 0; i < N; i++) {
    d.push({
      r: 130 + rand() * 260, a: rand() * 6.28, y: 40 + rand() * 90,
      sp: 0.05 + rand() * 0.05, s: 2.0 + rand() * 3.2, ph: rand() * 6.28,
    });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
  return {
    update(dt, t) {
      for (let i = 0; i < N; i++) {
        const b = d[i];
        b.a += dt * b.sp;
        v.set(Math.cos(b.a) * b.r, b.y + Math.sin(t * 0.6 + b.ph) * 6, Math.sin(b.a) * b.r);
        e.set(Math.sin(t * 3 + b.ph) * 0.35, -b.a + Math.PI / 2, Math.sin(t * 1.2 + b.ph) * 0.25);
        q.setFromEuler(e);
        inst.setMatrixAt(i, m4.compose(v, q, sv.set(b.s, b.s, b.s)));
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}

export { PALETTE };
