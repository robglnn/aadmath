import * as THREE from 'three';

/**
 * The Kite — a deployable wing with actual fabric.
 *
 * The previous version was a flat plane with two struts, which from the game's
 * default camera (level with the wing, directly behind) presented exactly zero
 * cross-section and read on screen as a glowing horizontal line. This one is
 * built as a *surface*: swept, cambered, with anhedral tips that drop below the
 * camera line and a visible underside, sewn into cells by real ribs, with a
 * thick leading-edge spar, riser lines under tension, and a control bar the
 * cadet's hands are IK'd onto.
 *
 *   - `setOpen(0..1)`  unfurls it from the pack: the panels roll outward from
 *     the keel, the risers snap taut, and the canopy overshoots and settles.
 *   - `update(dt, {speed, pitch, roll, load})` runs the cloth: a travelling
 *     ripple across the trailing edge whose amplitude rides airspeed, plus a
 *     billow that deepens under load.
 */

const HALF = 2.62;        // semi-span
const ROOT_C = 1.34;      // root chord
const TIP_C = 0.46;       // tip chord
const SWEEP = 0.86;       // how far the tip trails the root
const ANHED = 0.88;       // how far the tips hang below the root
const CAMBER = 0.34;      // billow depth at mid-chord

const NU = 14;            // spanwise segments per panel
const NV = 7;             // chordwise segments

/**
 * Canopy surface for one half-wing.  u: 0 root → 1 tip.  v: 0 leading → 1 trailing.
 * Returns the local position; also used for the ribs so they lie exactly on the
 * cloth rather than floating near it.
 */
function surf(u, v, sign, out) {
  const chord = ROOT_C * (1 - u) + TIP_C * u;
  const x = HALF * u * sign;
  // leading edge sweeps back slightly and the whole tip droops (anhedral)
  const le = -SWEEP * u * u * 0.34;
  const z = le - chord * v;
  // camber: a billow across the chord, strongest at the root, plus the droop
  const bell = Math.sin(Math.PI * Math.min(1, v * 1.06)) * (1 - u * 0.55);
  const y = -ANHED * u * u - CAMBER * bell * 0.62 + CAMBER * 0.2 * (1 - v);
  return out.set(x, y, z);
}

function canopyGeometry(sign) {
  const pos = [], nor = [], uvs = [], idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= NU; i++) {
    for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = j / NV;
      surf(u, v, sign, p);
      pos.push(p.x, p.y, p.z);
      nor.push(0, 1, 0);
      uvs.push(u, v);
    }
  }
  const at = (i, j) => i * (NV + 1) + j;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if (sign > 0) idx.push(a, b, c, a, c, d);
      else idx.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rib tubes lying on the cloth, one per cell seam. */
function ribGeometry(sign) {
  const parts = [];
  const p = new THREE.Vector3();
  for (let k = 1; k <= 4; k++) {
    const u = k / 5;
    const pts = [];
    for (let j = 0; j <= NV; j++) pts.push(surf(u, j / NV, sign, p).clone());
    const curve = new THREE.CatmullRomCurve3(pts);
    parts.push(new THREE.TubeGeometry(curve, 8, 0.013, 4, false));
  }
  // trailing edge hem
  const hem = [];
  for (let i = 0; i <= NU; i++) hem.push(surf(i / NU, 1, sign, p).clone());
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem), 14, 0.016, 4, false));
  return mergeSimple(parts);
}

/** Minimal geometry merge (position+normal+uv, indexed) — avoids an extra import. */
function mergeSimple(list) {
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += g.index.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const idx = new Uint16Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    const gp = g.attributes.position.array, gn = g.attributes.normal.array, gu = g.attributes.uv.array;
    pos.set(gp, vo * 3); nor.set(gn, vo * 3); uv.set(gu, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/** Fabric: cloth that ripples down-span, with woven panel banding baked in. */
function fabricMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({
    // A canopy is lit from above and seen from below, so its underside would be
    // a black arc without a warm ambient floor standing in for sky bounce.
    color: 0xe98a49, roughness: 0.82, metalness: 0.0,
    emissive: 0x8a3a12, emissiveIntensity: 0.95,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uniforms.uT;
    sh.uniforms.uFlap = uniforms.uFlap;
    sh.uniforms.uLoad = uniforms.uLoad;
    sh.vertexShader = `uniform float uT; uniform float uFlap; uniform float uLoad;\nvarying vec2 vSpan;\n` + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sp = abs(uv.x);
        float ripple = sin(sp * 7.2 - uT * 9.0) * 0.5 + sin(sp * 13.1 - uT * 14.0 + 1.7) * 0.28;
        transformed.y += ripple * uFlap * (0.035 + 0.10 * uv.y) * (0.25 + sp);
        transformed.y -= uLoad * 0.30 * sin(3.14159 * uv.y) * (1.0 - sp * 0.4);
        vSpan = uv;`);
    sh.fragmentShader = `varying vec2 vSpan;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float band = smoothstep(0.44, 0.5, abs(fract(vSpan.x * 5.0) - 0.5));
        diffuseColor.rgb *= 1.0 - band * 0.16;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.86, 0.62), smoothstep(0.72, 1.0, vSpan.y) * 0.5);`);
  };
  return m;
}

export function buildGlider() {
  const group = new THREE.Group();
  group.visible = false;

  const uniforms = {
    uT: { value: 0 }, uFlap: { value: 0.4 }, uLoad: { value: 0 },
  };

  const skin = fabricMaterial(uniforms);
  const rib = new THREE.MeshStandardMaterial({
    color: 0x59688c, roughness: 0.55, metalness: 0.35,
    emissive: 0x243550, emissiveIntensity: 0.9,
  });
  const spar = new THREE.MeshStandardMaterial({
    color: 0xd8e6f4, roughness: 0.3, metalness: 0.75,
    emissive: 0x1c3d55, emissiveIntensity: 0.7,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: 0x9ff2ff, emissive: 0x46d6ff, emissiveIntensity: 2.2, roughness: 0.3,
  });
  const line = new THREE.MeshStandardMaterial({ color: 0x1b2338, roughness: 0.8, metalness: 0.1 });

  // wing pivots as one unit so it can fly the flight path
  const wing = new THREE.Group();
  wing.position.y = 3.02;
  group.add(wing);

  const panels = [];
  const p = new THREE.Vector3();
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    wing.add(hinge);

    const cloth = new THREE.Mesh(canopyGeometry(s), skin);
    cloth.castShadow = true;
    hinge.add(cloth);

    const ribs = new THREE.Mesh(ribGeometry(s), rib);
    hinge.add(ribs);

    // leading-edge spar: a real tube following the swept, drooping leading edge
    const lePts = [];
    for (let i = 0; i <= 8; i++) lePts.push(surf(i / 8, 0, s, p).clone());
    const le = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lePts), 16, 0.042, 6, false), spar);
    le.castShadow = true;
    hinge.add(le);

    // wingtip winglet + nav light
    const tipRoot = surf(1, 0, s, p).clone();
    const tipBack = surf(1, 1, s, p).clone();
    const winglet = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        tipRoot, tipRoot.clone().lerp(tipBack, 0.5).add(new THREE.Vector3(0.09 * s, -0.12, 0)),
        tipBack,
      ]), 8, 0.024, 5, false), spar);
    hinge.add(winglet);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshBasicMaterial({ color: s > 0 ? 0xffdca8 : 0xa8e6ff }));
    lamp.position.copy(tipRoot);
    hinge.add(lamp);

    panels.push(hinge);
  }

  // keel spine + a lit spine strip so the wing reads from directly below
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.026, ROOT_C + 0.18, 7), spar);
  keel.rotation.x = Math.PI / 2;
  keel.position.set(0, 0.02, -ROOT_C * 0.46);
  keel.castShadow = true;
  wing.add(keel);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.02, ROOT_C * 0.86), edge);
  spine.position.set(0, -0.03, -ROOT_C * 0.44);
  wing.add(spine);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), spar);
  nose.position.set(0, 0.01, 0.06);
  wing.add(nose);

  // ---- harness: four risers under tension down to the control bar ----
  // The bar sits exactly one arm's length above the cadet's shoulders, which is
  // what lets the animator put both hands on it with a straight two-bone solve.
  const bar = new THREE.Group();
  bar.position.set(0, -1.15, 0.06);
  wing.add(bar);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.14, 9), spar);
  grip.rotation.z = Math.PI / 2;
  grip.castShadow = true;
  bar.add(grip);
  for (const s of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x24304a, roughness: 0.95 }));
    pad.rotation.z = Math.PI / 2;
    pad.position.x = 0.42 * s;
    bar.add(pad);
  }
  const risers = [];
  for (const s of [-1, 1]) {
    for (const back of [0.12, -0.62]) {
      const a = new THREE.Vector3(0.62 * s, -0.17, back);        // on the wing
      const b = new THREE.Vector3(0.30 * s, -1.13, 0.06);        // at the bar
      const d = new THREE.Vector3().subVectors(b, a);
      const len = d.length();
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 4), line);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      r.position.copy(a).addScaledVector(d, len * 0.5);
      wing.add(r);
      risers.push(r);
    }
  }

  // ---- packed state: the folded wing riding on the cadet's back ----
  const pack = new THREE.Group();
  pack.position.set(0, 1.32, -0.30);
  group.add(pack);
  const packBody = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.62, 8), spar);
  packBody.rotation.z = Math.PI / 2;
  pack.add(packBody);
  const packGlow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), edge);
  pack.add(packGlow);

  let open = 0;
  /** 0 = stowed on the back, 1 = fully deployed overhead. */
  function setOpen(v) {
    open = THREE.MathUtils.clamp(v, 0, 1);
    group.visible = open > 0.004;
    // the canopy rolls out from the keel: span first, then chord fills
    const roll = THREE.MathUtils.smoothstep(open, 0.0, 0.72);
    const fill = THREE.MathUtils.smoothstep(open, 0.30, 1.0);
    const snap = Math.sin(Math.min(1, open) * Math.PI) * 0.13;   // overshoot on the way out
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      panels[i].scale.set(roll + snap * 0.6, 1, 1);
      panels[i].rotation.y = (1 - roll) * 1.25 * s;
      panels[i].rotation.z = (1 - roll) * 0.85 * -s;
      panels[i].position.y = (1 - fill) * 0.22;
    }
    wing.scale.setScalar(0.42 + 0.58 * fill + snap * 0.10);
    wing.position.y = 1.46 + 1.56 * fill;
    bar.position.y = -1.15 * fill;
    bar.visible = fill > 0.06;
    for (const r of risers) r.visible = fill > 0.2;
    skin.opacity = 1;
    pack.visible = open < 0.5;
    pack.scale.setScalar(1 - fill);
  }

  /** Cloth + attitude, driven every frame while the wing is out. */
  function update(dt, s) {
    uniforms.uT.value += dt * (0.6 + (s?.speed || 0) * 0.055);
    const flapWant = 0.35 + THREE.MathUtils.clamp((s?.speed || 0) / 26, 0, 1) * 1.15 + (s?.deploy || 0) * 2.4;
    uniforms.uFlap.value += (flapWant - uniforms.uFlap.value) * Math.min(1, dt * 6);
    const loadWant = THREE.MathUtils.clamp(s?.load ?? 0.4, 0, 1.4);
    uniforms.uLoad.value += (loadWant - uniforms.uLoad.value) * Math.min(1, dt * 5);
  }

  setOpen(0);

  return {
    group, wing, bar, panels, setOpen, update,
    /** World-space grip point for one hand. Matrices must already be current. */
    gripAt(side, out) {
      return bar.localToWorld(out.set(0.34 * side, 0.02, 0.02));
    },
    get open() { return open; },
  };
}
