import * as THREE from 'three';
import { rng, fbm, clamp } from './noise.js';
import { merge } from './geom.js';

/**
 * THE HORIZON.
 *
 * An island a hundred and seventy metres across cannot produce a vista on its
 * own — there is simply not enough distance in it for distance to *read*. The
 * Great Plateau works because when you turn around there are four more ranges
 * behind the one you are looking at, each one a step paler than the last, and
 * the furthest is barely separable from the sky.
 *
 * So the world does not end at the coast. Three grounded ranges stand out
 * beyond it at seven hundred, sixteen hundred and twenty-eight hundred metres,
 * their feet drowned in the cloud sea, their tops progressively snowed. They
 * are lit but not shaded — the light is baked per face from the sun bearing —
 * and they carry the scene's real fog, so `air.js` does all the value and
 * chroma grading for free and the bands can never drift out of agreement with
 * the air the island itself is standing in.
 *
 * The whole horizon is three draw calls and about two thousand triangles.
 */

/** Lean a geometry sideways in proportion to height. */
function shearX(geo, k, h) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + p.getY(i) * k);
  return geo;
}

/**
 * One massif: a chain of overlapping peaks sharing a ridge line, seen
 * broadside. Mountains at this distance are *wide* — a range subtends far more
 * horizontally than vertically, and the single fastest way to make a horizon
 * look like a toy is to build it out of tall thin cones. Every peak here is at
 * least as wide at the base as it is tall, the shoulders of neighbours
 * interpenetrate, and a low apron ties the whole chain into one landmass.
 */
function massif(out, rand, opts) {
  const { cx, cy, cz, w, h, snowAt, rock, snow, sunB, seed, tangent } = opts;
  const tx = tangent.x, tz = tangent.y;
  const peaks = 4 + Math.floor(rand() * 4);
  const span = w * (1.9 + rand() * 1.3);

  // the apron: a very wide, very low mass the peaks stand out of, so the range
  // has a continuous foot instead of a row of separate tents
  {
    const ah = h * (0.24 + rand() * 0.12);
    const g = new THREE.ConeGeometry(span * 0.86, ah, 7, 1, true);
    g.translate(0, ah * 0.5, 0);
    g.rotateY(rand() * 6.2832);
    g.scale(1.0, 1.0, 0.34);
    g.rotateY(Math.atan2(tx, tz) + Math.PI / 2);
    g.translate(cx, cy, cz);
    const ni = g.toNonIndexed();
    bakeLight(ni, sunB, rock, snow, cy, h, snowAt);
    out.push(ni);
  }

  for (let p = 0; p < peaks; p++) {
    const t = peaks === 1 ? 0.5 : p / (peaks - 1);
    // the tallest peak is off-centre and the shoulders fall away unevenly
    const prof = Math.pow(Math.sin((0.14 + t * 0.72) * Math.PI), 0.55);
    const jitter = 0.58 + fbm(seed + p * 3.7, t * 5.1, 3) * 0.84;
    const ph = h * prof * jitter;
    // base at least as wide as the peak is tall — this is the whole read
    const pw = ph * (0.78 + rand() * 0.62);
    const along = (t - 0.5) * span + (rand() - 0.5) * span * 0.12;
    const off = (rand() - 0.5) * w * 0.7;

    const sides = 5 + (p % 3);
    const g = new THREE.ConeGeometry(pw, ph, sides, 1, true);
    g.translate(0, ph * 0.5, 0);
    g.rotateY(rand() * 6.2832);
    // Shear the summit off centre. A cone is symmetric and a mountain is not:
    // one shoulder always runs longer than the other, and that asymmetry is
    // most of what separates a ridge line from a row of tents.
    shearX(g, (rand() - 0.5) * 0.9, ph);
    // flatten across the line of sight: a ridge, not a party hat
    g.scale(1.0, 1.0, 0.42 + rand() * 0.22);
    g.rotateY(Math.atan2(tx, tz) + Math.PI / 2);
    g.translate(cx + tx * along - tz * off, cy - ph * 0.06, cz + tz * along + tx * off);
    const ni = g.toNonIndexed();
    bakeLight(ni, sunB, rock, snow, cy, ph, snowAt);
    out.push(ni);
  }
}

/**
 * Bake the sun into vertex colour. Nothing out here is lit by the scene: a
 * directional light aimed at a range twenty-eight hundred metres away would
 * either be outside the shadow volume or drag it to uselessness. Facing the
 * light is all the shading a silhouette that far out ever needed.
 */
/**
 * The colour of the air the ranges stand in, at valley level.
 *
 * This used to be a near-white at 0.62 strength, which — on top of the scene's
 * own aerial perspective — bleached every range in the world to the same sheet
 * of paper. A mountain has to keep a dark ridge or it is not a mountain, it is
 * a cone cut out of card. The mist is now cooler, darker, and pools only into
 * the bottom third.
 */
const MIST = [0.44, 0.50, 0.66];

function bakeLight(geo, sunB, rock, snow, footY, height, snowAt) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    e1.subVectors(b, a); e2.subVectors(c, a);
    nrm.crossVectors(e1, e2).normalize();
    const nd = clamp(nrm.x * sunB.x + nrm.z * sunB.y, -1, 1);
    // a hard terminator with a bright sunward face and a cool sky-lit back
    const lit = 0.30 + 0.80 * Math.pow(clamp(nd * 0.5 + 0.62, 0, 1), 1.45);
    for (let k = 0; k < 3; k++) {
      const vy = pos.getY(i + k);
      const alt = (vy - footY) / Math.max(height, 1);
      const s = clamp((alt - snowAt) / 0.30, 0, 1);
      const sn = s * s * (3 - 2 * s);
      // Mist pools in the valleys. Every range in the world is palest at its
      // foot and darkest at its ridge, and baking that gradient in is what
      // stops a band of mountains reading as a row of flat paper triangles.
      const pl = clamp(1 - alt / 0.38, 0, 1);
      const pool = pl * pl * 0.46;
      for (let j = 0; j < 3; j++) {
        const base = rock[j] * (1 - sn) + snow[j] * sn;
        // snow keeps more of the light and less of the shadow than rock does
        const l = lit * (1 - sn) + (0.62 + lit * 0.52) * sn;
        col[(i + k) * 3 + j] = base * l * (1 - pool) + MIST[j] * pool;
      }
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * Four bands, and the numbers matter more than anything else in this file.
 *
 * Each band is authored a step lighter and a step less blue than the one in
 * front of it *before* the air touches it, because aerial perspective on its
 * own compresses everything past a kilometre into the same value. Author the
 * separation, then let the air widen it: that is how you get four readable
 * layers rather than one pale wall.
 */
const BANDS = [
  // radius, spread, count, foot Y, height, width, snow line, rock, snow, seed
  //
  // There used to be four bands and the near two stood at four hundred and
  // eight hundred metres. From any height at all that read as a stadium: the
  // island in the middle of a continuous ring of pale cones, all the same size,
  // all the same value, and every one of them standing in front of anything
  // worth looking at. A horizon is what you see *past* the world, not a wall
  // around it — so the near two are gone, the far world is now the five
  // floating landmasses in `farlands.js`, and these two are what stands behind
  // even those.
  {
    r: 1500, jitter: 380, n: 13, foot: -270, h: 600, w: 340, snowAt: 0.76,
    rock: [0.085, 0.105, 0.185], snow: [0.50, 0.57, 0.78], seed: 47,
  },
  {
    r: 2600, jitter: 520, n: 12, foot: -330, h: 980, w: 560, snowAt: 0.58,
    rock: [0.180, 0.205, 0.310], snow: [0.72, 0.78, 0.96], seed: 91,
  },
];

export function createRanges(scene, sunDir) {
  const sunB = new THREE.Vector2(sunDir.x, sunDir.z).normalize();
  const group = new THREE.Group();
  group.name = 'ranges';
  const made = [];

  BANDS.forEach((band, bi) => {
    const rand = rng(9001 + bi * 137);
    const parts = [];
    for (let i = 0; i < band.n; i++) {
      const a = (i / band.n) * Math.PI * 2 + (rand() - 0.5) * 0.22;
      const rr = band.r + (rand() - 0.5) * band.jitter;
      massif(parts, rand, {
        cx: Math.cos(a) * rr,
        cy: band.foot + (rand() - 0.5) * band.h * 0.22,
        cz: Math.sin(a) * rr,
        // the chain runs along the ring, so every range is seen broadside
        tangent: new THREE.Vector2(-Math.sin(a), Math.cos(a)),
        w: band.w * (0.72 + rand() * 0.7),
        h: band.h * (0.58 + rand() * 0.80),
        snowAt: band.snowAt,
        rock: band.rock, snow: band.snow, sunB,
        seed: band.seed + i * 13.1,
      });
    }
    const geo = merge(parts);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, fog: true, side: THREE.DoubleSide,
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 30 + bi;
    mesh.name = `range-${bi}`;
    group.add(mesh);
    made.push(mesh);
  });

  scene.add(group);
  return { group, meshes: made };
}

/**
 * The inversion layer.
 *
 * Two thin decks of cloud lying between the island and the ranges. They are
 * what actually *separates* the depth bands: the second range does not touch
 * the first, it rises out of a sheet of white a hundred metres in front of it,
 * and that single occlusion cue is worth more than any amount of desaturation.
 */
export function createInversion(scene, sunDir, quality = 1) {
  const group = new THREE.Group();
  const uni = {
    uTime: { value: 0 },
    uSun: { value: new THREE.Vector2(sunDir.x, sunDir.z).normalize() },
    uWarm: { value: new THREE.Color(1.16, 0.92, 0.76) },
    uCool: { value: new THREE.Color(0.62, 0.68, 0.86) },
    uScale: { value: 1.0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, fog: false,
    side: THREE.DoubleSide, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main(){
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying vec3 vW;
      uniform float uTime, uScale;
      uniform vec2 uSun;
      uniform vec3 uWarm, uCool;
      float h2(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      float fbm3(vec2 p){ return (n2(p)*0.5 + n2(p*2.07)*0.25 + n2(p*4.13)*0.125) * 1.143; }
      void main(){
        // This deck covers most of the lower half of the screen whenever the
        // camera looks outward, so its per-pixel budget is the strictest in the
        // world. The window where it is visible at all is decided *first*, out
        // of two cheap distance ramps, and every noise tap sits behind that
        // branch: a full domain-warped fBm used to run on every pixel of a
        // three-kilometre disc, including the nine tenths of it that were
        // multiplied by an alpha of zero one line later.
        float d = length(vW.xz - cameraPosition.xz);
        float win = smoothstep(340.0, 900.0, d) * (1.0 - smoothstep(2300.0, 3200.0, d));
        if (win < 0.01) discard;

        vec2 p = vW.xz * 0.0016 * uScale;
        // one warp octave instead of two whole fBms
        vec2 q = vec2(n2(p * 0.8 + vec2(uTime * 0.0035, 0.0)),
                      n2(p * 0.8 + vec2(4.3, -uTime * 0.0028)));
        float f = fbm3(p + q * 1.4);
        float a = smoothstep(0.46, 0.80, f) * win;
        vec2 dir = normalize(vW.xz - cameraPosition.xz + vec2(1e-4));
        float sun = clamp(dot(dir, uSun) * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uCool, uWarm, pow(sun, 1.6));
        col = mix(col * 0.86, col * 1.10, smoothstep(0.45, 0.85, f));
        gl_FragColor = vec4(col, a * 0.56);
      }`,
  });

  // One deck, not two. The second was a second full-screen transparent pass for
  // a parallax cue nobody could name, and it cost the same as the first.
  const decks = [
    { y: -62, r: 3100, s: 1.0 },
  ];
  for (const d of decks) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(d.r, quality > 0.6 ? 72 : 40), mat.clone());
    m.material.uniforms = THREE.UniformsUtils.clone(uni);
    m.material.uniforms.uScale.value = d.s;
    m.rotation.x = -Math.PI / 2;
    m.position.y = d.y;
    m.renderOrder = 34;
    m.frustumCulled = false;
    group.add(m);
  }
  scene.add(group);

  return {
    group,
    update(t) {
      for (const m of group.children) m.material.uniforms.uTime.value = t;
    },
  };
}
