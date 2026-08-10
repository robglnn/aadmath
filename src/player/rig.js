import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The cadet. Built as a real joint hierarchy — hips → spine → chest → head,
 * two-bone arms and legs with feet — so the animator can drive it with IK
 * instead of waggling two capsules.
 *
 * The rule this file is built to, and the one the previous version broke:
 * **a third-person character is a silhouette and a value pattern, nothing
 * else.** You see him from six metres behind for the whole game. So:
 *
 *  - The big forms are LIGHT and the connective forms are DARK, not the other
 *    way round. Bone-white pauldrons, chest, thigh plates, knees and boots over
 *    a near-black undersuit; that is what makes a shape read at distance in a
 *    sunset. The old rig was navy everywhere with small light chips on it and
 *    turned into one dark blob the instant the sun went behind him.
 *  - Nothing floats. A pauldron rides the *upper arm*, not the chest, so it can
 *    never open a gap over the deltoid however the arm swings.
 *  - The head is a helmet, not an egg: a hard brow, a wraparound visor that
 *    covers the whole face, a jaw guard, a dorsal fin and one raked antenna.
 *    Those last two are the read at a hundred metres.
 *  - The scarf is cloth: a rippled half-mantle worn off one shoulder, broad
 *    enough to be a shape at six metres and hung from a seven-link chain the
 *    animator actually simulates — not a stack of red bricks bolted through
 *    the neck, which is what it was.
 */

export const LIMB = {
  thigh: 0.45, shin: 0.43, ankle: 0.07,
  upperArm: 0.28, foreArm: 0.26,
  hipY: 0.94,
};

/**
 * Rim light, added to a standard material in the shader.
 *
 * A third-person character is a silhouette for 99% of the play session, and
 * this world is often exactly as dark as he is — at dusk, in grass shadow, or
 * against the plaza. A fresnel rim costs nothing and guarantees a lit edge no
 * matter what the sun is doing.
 */
function rimLit(mat, color = 0x8fdcff, strength = 0.9, power = 2.6) {
  const c = new THREE.Color(color);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: c };
    sh.uniforms.uRimK = { value: strength };
    sh.uniforms.uRimP = { value: power };
    sh.fragmentShader = `uniform vec3 uRim; uniform float uRimK; uniform float uRimP;\n` + sh.fragmentShader
      .replace('#include <tonemapping_fragment>', `
        float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uRimP);
        gl_FragColor.rgb += uRim * rimF * uRimK;
        #include <tonemapping_fragment>`);
  };
  mat.customProgramCacheKey = () => 'rim' + strength + '_' + power + '_' + color;
  return mat;
}

// ---------------------------------------------------------------------------
// Palette.
//
// Four values, in this order of area:
//   armour (lightest) · suit (mid) · undersuit (darkest) · one warm accent.
//
// They live in a seven-texel strip rather than in seven materials, and every
// mesh's UVs simply point at its own texel. That is not a stylistic choice: the
// cadet is a hierarchy of twenty joints, and every distinct material inside a
// joint is another draw call in the main pass *and* another in the shadow pass.
// With one material per colour the rig cost ninety-nine draws out of a frame
// budget of two hundred and twenty. With one shared material every joint
// collapses to a single mesh and the same cadet costs a third of that.
// ---------------------------------------------------------------------------
const PAL = [
  0xd6dfe9,   // 0 armour   — the shells
  0x8f9db4,   // 1 armourB  — the shells turned away
  0x3b4460,   // 2 suit     — the flightsuit
  0x1a2136,   // 3 dark     — joints, straps, the inside of everything
  0x9ff5ff,   // 4 trim     — lit piping
  0x7fe4ff,   // 5 glow     — the pack's cells
  0xffb066,   // 6 amber    — lattice light, the one warm accent
];

function paletteTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 1;
  const g = c.getContext('2d');
  for (let i = 0; i < PAL.length; i++) {
    g.fillStyle = '#' + PAL[i].toString(16).padStart(6, '0');
    g.fillRect(i, 0, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/** Point every vertex of a geometry at one palette texel. */
function paint(g, idx) {
  const n = g.attributes.position.count;
  const uv = new Float32Array(n * 2);
  const u = (idx + 0.5) / 16;
  for (let i = 0; i < n; i++) { uv[i * 2] = u; uv[i * 2 + 1] = 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const M = {
  /** everything that is not lit from inside: one material, seven colours */
  body: () => rimLit(new THREE.MeshStandardMaterial({
    roughness: 0.56, metalness: 0.16,
    // A floor of self-illumination. The sun in this world spends most of the
    // hour behind the cadet, and a character lit only by it goes to black
    // exactly when the player is looking straight at his back.
    emissive: 0x26314f, emissiveIntensity: 0.66,
  }), 0xbfe6ff, 0.85, 2.6),
  /** everything that is: same palette, read as emissive as well as diffuse */
  lamp: () => new THREE.MeshStandardMaterial({
    emissive: 0xffffff, emissiveIntensity: 2.0, roughness: 0.34, metalness: 0.1,
  }),
  visor: () => new THREE.MeshStandardMaterial({
    color: 0x07141f, emissive: 0x2ea8dd, emissiveIntensity: 0.85,
    roughness: 0.06, metalness: 1.0,
  }),
  // Smooth-shaded on purpose. Flat shading on a five-by-two rippled panel gives
  // ten hard facets, and ten hard facets on a moving sheet of cloth is not
  // stylisation, it is shrapnel — which is precisely what the mantle looked
  // like it was made of.
  scarf: () => rimLit(new THREE.MeshStandardMaterial({
    color: 0xc2512c, roughness: 0.99, metalness: 0.0,
    emissive: 0x35150c, emissiveIntensity: 0.45, side: THREE.DoubleSide,
  }), 0xe08a55, 0.28, 2.0),
};

/** `slot` is a {m, i} pair: which shared material, and which palette texel. */
function mesh(geo, slot, parent, x = 0, y = 0, z = 0) {
  paint(geo, slot.i);
  const m = new THREE.Mesh(geo, slot.m);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function box(w, h, d, r = 0.02) {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  if (r > 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) * (1 - r), p.getY(i), p.getZ(i) * (1 - r));
    }
    g.computeVertexNormals();
  }
  return g;
}

/**
 * A box whose top face is a different size from its bottom.
 *
 * Everything structural on this character is a frustum rather than a cube,
 * because a taper is what turns a primitive into armour: the chest narrows to
 * the waist, the pauldron sweeps out and down, the boot flares to the sole.
 */
function taper(wb, wt, h, db, dt, shear = 0) {
  const g = new THREE.BoxGeometry(1, h, 1, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const u = (y / h) + 0.5;                     // 0 at bottom, 1 at top
    p.setX(i, p.getX(i) * (wb + (wt - wb) * u));
    p.setZ(i, p.getZ(i) * (db + (dt - db) * u) + shear * (u - 0.5));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A rippled band, double sided: the unit cloth is made of.
 *
 * Deliberately *not* bowed into a shell. A parabolic cross-section closes the
 * band up and the whole scarf comes out as a cone — which is precisely what the
 * first attempt at this looked like from behind, an orange horn. A shallow S
 * across the width gives two light values on one flat ribbon, which is what
 * actually reads as fabric, and the twist lets successive links present a
 * slightly different face to the sun so the length of it never goes flat.
 */
function cloth(w0, w1, h, ripple, twist = 0, phase = 0) {
  const NX = 5, NY = 2;
  const g = new THREE.PlaneGeometry(1, h, NX, NY);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const v = 0.5 - y / h;                       // 0 at top, 1 at bottom
    const w = w0 + (w1 - w0) * v;
    const u = p.getX(i) * 2;                     // -1..1 across the width
    const a = u * w * 0.5;
    const tw = twist * v;
    const z = ripple * Math.sin(u * 2.6 + phase) * (0.55 + v * 0.45);
    p.setX(i, a * Math.cos(tw) - z * Math.sin(tw));
    p.setZ(i, z * Math.cos(tw) + a * Math.sin(tw));
  }
  g.computeVertexNormals();
  return g;
}

/** A hard-edged fin/blade: a triangle-ish sliver used for crests and vanes. */
function fin(len, hRoot, hTip, thick) {
  const g = new THREE.BoxGeometry(thick, 1, len, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const u = z / len + 0.5;
    p.setY(i, p.getY(i) * (hRoot + (hTip - hRoot) * u) + (hRoot + (hTip - hRoot) * u) * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Bake every joint's direct child meshes down to one mesh per material.
 * Anything rigid relative to its parent joint can be merged; the joint keeps
 * animating and the merged geometry rides it. Nothing that is itself a joint is
 * touched, so the skeleton and every rotation the animator drives survive.
 */
function collapse(root) {
  const nodes = [];
  root.traverse((o) => nodes.push(o));
  for (const node of nodes) {
    const meshes = node.children.filter((c) => c.isMesh && c.children.length === 0);
    if (meshes.length < 2) continue;
    const byMat = new Map();
    for (const m of meshes) {
      const key = m.material.uuid + '|' + (m.castShadow ? 1 : 0);
      if (!byMat.has(key)) byMat.set(key, []);
      byMat.get(key).push(m);
    }
    for (const group of byMat.values()) {
      if (group.length < 2) continue;
      const geos = group.map((m) => {
        m.updateMatrix();
        const g = m.geometry.clone().applyMatrix4(m.matrix);
        return normalise(g);
      });
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const out = new THREE.Mesh(merged, group[0].material);
      out.castShadow = group[0].castShadow;
      out.receiveShadow = false;
      for (const m of group) node.remove(m);
      node.add(out);
    }
  }
}

/** mergeGeometries needs identical attribute sets: position/normal/uv, indexed. */
function normalise(g) {
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  }
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

export function buildCadet() {
  // root scales (squash lives at the feet) → pivot rotates (flips live at the
  // hips) → body carries the skeleton back to root space.
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = LIMB.hipY;
  root.add(pivot);
  const body = new THREE.Group();
  body.position.y = -LIMB.hipY;
  pivot.add(body);

  // Only these cast. A shadow pass that redraws every vent, strap and light
  // strip costs a draw call each and changes the ground silhouette by nothing.
  const casters = new Set();
  const cast = (m) => { casters.add(m); return m; };
  // `soft` is the opposite: a shape that is part of the model but deliberately
  // left out of the shadow pass. A vambrace, an ear pod or a knee cap costs a
  // whole extra draw call there and changes the shadow on the ground by nothing.
  const soft = (m) => m;

  const pal = paletteTexture();
  const bodyMat = M.body(); bodyMat.map = pal;
  const lampMat = M.lamp(); lampMat.map = pal; lampMat.emissiveMap = pal;
  const visorMat = M.visor();
  const scarfMat = M.scarf();
  // Every part names a palette slot rather than a material of its own.
  const mats = {
    armour: { m: bodyMat, i: 0 }, armourB: { m: bodyMat, i: 1 },
    suit: { m: bodyMat, i: 2 }, dark: { m: bodyMat, i: 3 },
    trim: { m: lampMat, i: 4 }, glow: { m: lampMat, i: 5 }, amber: { m: lampMat, i: 6 },
    visor: { m: visorMat, i: 0 }, scarf: { m: scarfMat, i: 0 },
  };

  // ---------------- hips ----------------
  const hips = new THREE.Group();
  hips.position.y = LIMB.hipY;
  body.add(hips);
  // a belt block that is wider than it is deep, with armoured tassets hanging
  // off it — the waist is the pinch the whole silhouette is built around
  cast(mesh(taper(0.34, 0.30, 0.20, 0.24, 0.23), mats.dark, hips, 0, -0.03, 0));
  mesh(taper(0.36, 0.33, 0.055, 0.26, 0.25), mats.armourB, hips, 0, 0.055, 0);
  mesh(box(0.10, 0.05, 0.045, 0), mats.amber, hips, 0, 0.055, 0.125);
  for (const s of [-1, 1]) {
    // tassets: the plates over the hip joint. Angular, swept back.
    const t = soft(mesh(taper(0.145, 0.165, 0.21, 0.14, 0.16), mats.armourB, hips, 0.155 * s, -0.10, -0.005));
    t.rotation.z = -s * 0.16;
    mesh(box(0.055, 0.024, 0.12, 0), mats.trim, hips, 0.20 * s, -0.055, 0.02);
  }

  const spine = new THREE.Group();
  hips.add(spine);
  const chest = new THREE.Group();
  chest.position.y = 0.30;
  spine.add(chest);

  // ---------------- torso ----------------
  // the midriff: dark, narrow, and deliberately smaller than everything above
  // and below it, because the V is the whole read
  cast(mesh(taper(0.27, 0.33, 0.34, 0.21, 0.25), mats.dark, spine, 0, 0.15, 0));
  mesh(box(0.16, 0.20, 0.02, 0), mats.suit, spine, 0, 0.16, 0.125);

  // chest shell — broad at the collar, cut away at the waist, and shallow.
  // Depth is what turned the old torso into a fridge from the side; the width
  // is where a chest is allowed to be big.
  cast(mesh(taper(0.50, 0.42, 0.31, 0.25, 0.21, -0.015), mats.armour, chest, 0, 0.005, 0.012));
  // the sternum groove, in the second armour value, so the chest is not one flat card
  mesh(taper(0.15, 0.12, 0.29, 0.045, 0.04), mats.armourB, chest, 0, 0.010, 0.125);
  mesh(box(0.085, 0.085, 0.03, 0), mats.trim, chest, 0, 0.055, 0.138);
  // pectoral break: two shallow steps so the front is not one card
  for (const s of [-1, 1]) {
    const pec = mesh(taper(0.155, 0.135, 0.14, 0.045, 0.04), mats.armourB, chest, 0.135 * s, 0.085, 0.118);
    pec.rotation.z = s * 0.22;
  }
  // ab plates
  for (let i = 0; i < 2; i++) mesh(box(0.29 - i * 0.05, 0.026, 0.17, 0.1), mats.dark, chest, 0, -0.150 - i * 0.050, 0.012);
  // collar / gorget: the hard shelf the helmet sits over
  cast(mesh(taper(0.33, 0.25, 0.10, 0.22, 0.17), mats.armourB, chest, 0, 0.185, 0));
  mesh(box(0.18, 0.03, 0.16, 0.15), mats.trim, chest, 0, 0.222, 0);

  // pack — houses the glider. Two canted vanes give the back a hard V.
  // The pack is the lightest value on him, not the darkest. This game has
  // exactly one camera angle — behind — and a dark pack turned the whole
  // character back into the silhouette-free blob the armour was meant to fix.
  const pack = cast(mesh(taper(0.28, 0.32, 0.38, 0.12, 0.14), mats.armour, chest, 0, -0.01, -0.175));
  mesh(box(0.22, 0.05, 0.06, 0.1), mats.dark, chest, 0, 0.172, -0.178);
  for (const s of [-1, 1]) {
    const vane = cast(mesh(taper(0.07, 0.11, 0.30, 0.10, 0.13), mats.armourB, chest, 0.180 * s, 0.01, -0.180));
    vane.rotation.z = s * 0.28;
    vane.rotation.y = -s * 0.20;
    mesh(box(0.030, 0.17, 0.030, 0), mats.glow, chest, 0.125 * s, -0.02, -0.248);
  }
  mesh(box(0.16, 0.030, 0.045, 0.1), mats.trim, chest, 0, 0.135, -0.247);

  // Faction mark: an open chevron in lattice amber cut into the pack lid. A
  // third-person character is a back for the whole game, and a back with
  // nothing written on it is a mannequin.
  for (const s of [-1, 1]) {
    const v = mesh(box(0.135, 0.028, 0.026, 0), mats.amber, chest, 0.045 * s, -0.060, -0.247);
    v.rotation.z = -s * 0.58;
  }
  mesh(box(0.050, 0.050, 0.024, 0), mats.amber, chest, 0, -0.140, -0.247);
  // rank pips, on the strong shoulder where a uniform puts them
  for (let i = 0; i < 3; i++) {
    mesh(box(0.070, 0.014, 0.020, 0), i === 0 ? mats.amber : mats.trim,
      chest, 0.205, 0.075 - i * 0.032, -0.155);
  }

  // ---------------- head ----------------
  const neck = new THREE.Group();
  neck.position.y = 0.235;
  chest.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.135;
  neck.add(head);
  mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.11, 8), mats.dark, neck, 0, 0.045, 0);

  // The helmet. A crown that is flatter front-to-back than a sphere, a hard
  // brow, a visor that covers the whole face, a jaw guard under it, and — the
  // two things that make him identifiable in a lineup — a dorsal fin and one
  // antenna raked back off the left ear.
  const crown = cast(mesh(
    new THREE.SphereGeometry(0.152, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mats.armour, head, 0, 0.028, -0.012));
  crown.scale.set(1.0, 1.05, 1.12);
  // back of the skull, closing the crown off into a helmet rather than a bowl
  const occ = soft(mesh(taper(0.27, 0.26, 0.22, 0.20, 0.19), mats.armourB, head, 0, -0.048, -0.030));
  occ.rotation.x = -0.10;
  // brow: the hard line above the glass, and the one place the helmet reads
  // as *aimed* rather than as a ball
  const brow = mesh(taper(0.29, 0.25, 0.050, 0.22, 0.17), mats.dark, head, 0, 0.062, 0.020);
  brow.rotation.x = -0.10;
  // the visor: a wraparound of dark glass covering the entire face, from brow
  // to cheekbone. The old one was a stripe across the forehead.
  const visor = mesh(
    new THREE.SphereGeometry(0.156, 24, 14, Math.PI / 2 - 1.24, 2.48, 0.66, 0.86),
    mats.visor, head, 0, 0.024, 0.008);
  visor.scale.set(1.02, 1.08, 1.14);
  // jaw guard: a chin the egg never had, with a breather vent under it
  const jaw = soft(mesh(taper(0.21, 0.24, 0.115, 0.21, 0.21, 0.035), mats.armour, head, 0, -0.115, 0.026));
  jaw.rotation.x = 0.12;
  mesh(box(0.10, 0.030, 0.050, 0), mats.trim, head, 0, -0.140, 0.145);
  mesh(box(0.055, 0.045, 0.05, 0), mats.amber, head, 0.085, -0.130, 0.130);
  // dorsal fin, front to back over the crown — this and the antenna are what
  // has to be recognisable at a hundred metres
  const crest = cast(mesh(fin(0.40, 0.145, 0.045, 0.032), mats.amber, head, 0, 0.115, -0.055));
  crest.rotation.x = 0.15;
  const crestB = soft(mesh(fin(0.36, 0.085, 0.025, 0.052), mats.dark, head, 0, 0.115, -0.055));
  crestB.rotation.x = 0.15;
  // ear pods + one raked antenna: the asymmetry that makes a silhouette his
  for (const s of [-1, 1]) {
    const pod = soft(mesh(taper(0.055, 0.048, 0.135, 0.16, 0.13), mats.armourB, head, 0.145 * s, -0.010, -0.015));
    pod.rotation.z = s * 0.10;
    mesh(box(0.03, 0.055, 0.075, 0), mats.trim, head, 0.172 * s, 0.005, 0.015);
  }
  const ant = soft(mesh(taper(0.024, 0.011, 0.36, 0.032, 0.013), mats.armour, head, -0.150, 0.09, -0.06));
  ant.rotation.set(-0.62, 0, 0.44);
  mesh(new THREE.SphereGeometry(0.024, 8, 6), mats.amber, head, -0.288, 0.353, -0.262);

  // ---------------- arms ----------------
  function arm(side) {
    const shoulder = new THREE.Group();
    // Set wide. The whole silhouette is a V, and a V needs a top: with the arms
    // held out from the ribs (see the animator's abduction) the pauldrons are
    // the widest point on the body and the waist is the narrowest, which is the
    // read from six metres behind and the only read this game ever gets.
    shoulder.position.set(0.234 * side, 0.135, 0);
    chest.add(shoulder);

    const upper = new THREE.Group(); shoulder.add(upper);
    // The pauldron rides the ARM, not the chest. That is the whole fix for
    // "two shoulder spheres with a visible gap between them and the upper
    // arms" — hung off the chest it opened a hole the moment the arm swung.
    const pauld = cast(mesh(taper(0.225, 0.275, 0.215, 0.225, 0.250), mats.armour, upper, 0.028 * side, -0.048, 0));
    pauld.rotation.z = -side * 0.30;
    // a second, smaller lame under it: layered armour, not one lump
    const lame = soft(mesh(taper(0.205, 0.215, 0.090, 0.19, 0.21), mats.armourB, upper, 0.042 * side, -0.175, 0));
    lame.rotation.z = -side * 0.30;

    cast(mesh(new THREE.CapsuleGeometry(0.064, LIMB.upperArm - 0.10, 4, 10), mats.suit, upper, 0, -LIMB.upperArm / 2 - 0.01, 0));

    const fore = new THREE.Group(); fore.position.y = -LIMB.upperArm; upper.add(fore);
    mesh(new THREE.CapsuleGeometry(0.055, LIMB.foreArm - 0.11, 4, 10), mats.dark, fore, 0, -LIMB.foreArm / 2, 0);
    // vambrace: an angular sleeve, flaring at the wrist
    const vamb = soft(mesh(taper(0.115, 0.135, 0.19, 0.115, 0.135), mats.armour, fore, 0, -LIMB.foreArm + 0.075, 0.004));
    vamb.rotation.x = 0.03;
    mesh(box(0.12, 0.026, 0.12, 0.1), mats.trim, fore, 0, -LIMB.foreArm + 0.165, 0.004);

    // hand: a glove with a cuff, a tapered palm, fingers and a thumb.
    const hand = new THREE.Group(); hand.position.y = -LIMB.foreArm - 0.045; fore.add(hand);
    mesh(taper(0.095, 0.105, 0.075, 0.085, 0.095), mats.dark, hand, 0, -0.012, 0);
    const fing = soft(mesh(taper(0.088, 0.082, 0.075, 0.078, 0.062), mats.dark, hand, 0, -0.082, 0.012));
    fing.rotation.x = 0.30;
    const thumb = mesh(taper(0.032, 0.028, 0.06, 0.036, 0.03), mats.dark, hand, 0.052 * side, -0.048, 0.028);
    thumb.rotation.set(0.5, 0, -side * 0.55);
    mesh(box(0.10, 0.022, 0.09, 0.1), mats.armourB, hand, 0, 0.028, 0);
    return { shoulder, upper, fore, hand, pauld };
  }
  const armL = arm(-1), armR = arm(1);

  // ---------------- legs ----------------
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.108 * side, -0.09, 0);
    hips.add(hip);
    const thigh = new THREE.Group(); hip.add(thigh);
    cast(mesh(new THREE.CapsuleGeometry(0.088, LIMB.thigh - 0.15, 4, 10), mats.suit, thigh, 0, -LIMB.thigh / 2, 0));
    // thigh plate, swept out — this is what gives the legs any width at all,
    // and it is deliberately the dark value so the legs do not merge into the
    // white torso above them
    const tp = cast(mesh(taper(0.175, 0.16, 0.26, 0.175, 0.185), mats.suit, thigh, 0.012 * side, -LIMB.thigh * 0.52, 0.012));
    tp.rotation.z = -side * 0.05;

    const shin = new THREE.Group(); shin.position.y = -LIMB.thigh; thigh.add(shin);
    cast(mesh(new THREE.CapsuleGeometry(0.070, LIMB.shin - 0.16, 4, 10), mats.dark, shin, 0, -LIMB.shin / 2, 0));
    // knee cap: a hard angular pyramid, the joint you can see bend
    const knee = soft(mesh(taper(0.155, 0.135, 0.13, 0.175, 0.145), mats.armour, shin, 0, -0.055, 0.020));
    knee.rotation.x = -0.10;
    // greave down the front of the shin
    mesh(taper(0.135, 0.145, 0.26, 0.135, 0.155), mats.armour, shin, 0, -LIMB.shin + 0.165, 0.020);
    mesh(box(0.10, 0.024, 0.10, 0), mats.trim, shin, 0, -LIMB.shin + 0.235, 0.075);

    const foot = new THREE.Group(); foot.position.y = -LIMB.shin; shin.add(foot);
    // boot: ankle collar, flared toe box, and a sole that is a separate slab —
    // the sole is what reads as *contact* when the foot plants
    cast(mesh(taper(0.145, 0.155, 0.10, 0.19, 0.19), mats.armour, foot, 0, -0.028, 0.010));
    const toe = soft(mesh(taper(0.150, 0.140, 0.085, 0.30, 0.26, 0.02), mats.armour, foot, 0, -0.075, 0.055));
    toe.rotation.x = -0.06;
    const sole = cast(mesh(taper(0.165, 0.155, 0.036, 0.325, 0.31), mats.dark, foot, 0, -0.122, 0.058));
    sole.rotation.x = -0.05;
    mesh(box(0.12, 0.020, 0.12, 0), mats.trim, foot, 0, -0.103, -0.055);
    mesh(box(0.055, 0.045, 0.05, 0), mats.amber, foot, 0.070 * side, -0.070, -0.045);
    // heel spur
    const heel = soft(mesh(taper(0.10, 0.075, 0.075, 0.075, 0.045), mats.armourB, foot, 0, -0.070, -0.115));
    heel.rotation.x = 0.35;
    return { hip, thigh, shin, foot, boot: sole };
  }
  const legL = leg(-1), legR = leg(1);

  // ---------------- mantle ----------------
  //
  // Cloth, worn off the right shoulder, hanging down the back.
  //
  // What was here before did three separate things at the collar — a six-sided
  // torus around the neck, a knot, and a short front tail — and at any real
  // play distance they did not read as a scarf being worn. They read as red
  // debris embedded in his shoulders. Three small shapes in one place is
  // clutter; one big shape is a silhouette. So the collar is now a single clean
  // yoke that follows the line of the gorget, and everything the eye is meant
  // to catch has been spent on making the hanging part *wide*.
  const scarf = [];
  const anchor = new THREE.Group();
  // off the right shoulder blade, clear of the pack's chevron
  anchor.position.set(0.092, 0.172, -0.150);
  anchor.rotation.x = 0.10;
  anchor.rotation.z = -0.15;
  chest.add(anchor);
  let parent = anchor;
  // A metre of it, and a proper hand-and-a-half wide at the top: at six metres
  // a strip of ribbon is a scratch on the frame, and a mantle is a shape.
  const SEG = 7, SEG_H = 0.138;
  for (let i = 0; i < SEG; i++) {
    const seg = new THREE.Group();
    seg.position.y = i === 0 ? 0 : -SEG_H;
    // the rest-pose snake: alternating a few degrees per link is enough for the
    // eye to read cloth blowing rather than a plank hanging
    if (i > 0) seg.rotation.z = (i % 2 ? 1 : -1) * 0.13;
    if (i > 0) seg.rotation.y = (i % 3 === 1 ? 1 : -1) * 0.10;
    parent.add(seg);
    const u0 = i / SEG, u1 = (i + 1) / SEG;
    // Wide at the shoulder, narrowing to a trailing tail: a half-mantle rather
    // than a length of ribbon. On a 1.8 m character seen from six metres a thin
    // strip of cloth is not a silhouette feature; a mantle is.
    // Near-parallel sided. Tapering it to a point was what turned the mantle
    // into a spike sticking out of his shoulder blade the moment the sim gave it
    // any angle at all: a wedge reads as a blade, a slab reads as cloth.
    const wide = (u) => 0.425 - 0.115 * Math.pow(u, 0.70) - 0.145 * Math.pow(u, 5);
    // not a caster: seven links of thin cloth hanging inside the body's own
    // shadow cost seven extra draws in the shadow pass and change the shape on
    // the ground by almost nothing
    soft(mesh(cloth(wide(u0), wide(u1), SEG_H, 0.034 - 0.014 * u0, 0.07 * u0, i * 1.1),
      mats.scarf, seg, 0, -SEG_H / 2, 0));
    scarf.push(seg);
    parent = seg;
  }
  // The yoke: one flat panel lying over the right shoulder and the top of the
  // back, which is where the mantle is fastened. It follows the gorget's line
  // rather than ringing the neck, so the collar stays a hard armoured shelf and
  // the cloth is clearly a thing hung *on* him.
  const yoke = soft(mesh(cloth(0.34, 0.30, 0.155, 0.022, 0.0), mats.scarf, chest, 0.052, 0.196, -0.052));
  yoke.rotation.set(1.32, 0.0, -0.20);
  // and the fastening itself: one clasp on the shoulder, in armour, not cloth
  const clasp = soft(mesh(taper(0.085, 0.070, 0.055, 0.085, 0.070), mats.armour, chest, 0.168, 0.196, -0.030));
  clasp.rotation.set(0.10, 0, -0.30);

  // Only the silhouette casts. Trim, vents and piping are detail meshes: in the
  // shadow pass they cost a draw call each and contribute nothing.
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = casters.has(o);
    o.receiveShadow = false;
  });

  // Every joint's rigid meshes are baked down to one per material: same
  // silhouette, a fifth of the draw calls, skeleton untouched.
  collapse(root);

  // The animator drives emissive intensity on the lit surfaces; hand it the
  // real materials, not the slot table.
  return {
    root, pivot, body, hips, spine, chest, neck, head, armL, armR, legL, legR,
    scarf, pack, visor,
    mats: { trim: lampMat, visor: visorMat, body: bodyMat, scarf: scarfMat },
  };
}

/**
 * A silhouette copy of the cadet used for dash after-images: one additive
 * shell, so eight of them cost nothing.
 */
export function buildGhost() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x7fe6ff, transparent: true, opacity: 0.24,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.52, 4, 8), mat);
  body.position.y = 1.14;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), mat);
  head.position.y = 1.62;
  g.add(head);
  const l1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.52, 3, 6), mat);
  l1.position.set(-0.11, 0.48, 0); g.add(l1);
  const l2 = l1.clone(); l2.position.x = 0.11; g.add(l2);
  g.visible = false;
  return { group: g, mat };
}
