import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KINDS, SPEC } from './pieces.js';

/**
 * WHAT A SET AXIOM IS MADE OF.
 *
 * A build piece has to answer one question in one glance: *can I stand on that?*
 * Two earlier passes at this failed it for the same underlying reason — the
 * pieces had no material.
 *
 * The first drew each piece as a 0.68-opacity tinted slab, which darkened
 * everything behind it and read as smoked glass. The second replaced it with an
 * open rail frame in near-white alloy. That looked machined in a still frame and
 * was wrong in every other way: a near-white, half-metal surface is a *mirror of
 * whatever light it is standing in*, so one ramp photographed gold-brown in the
 * sun, salmon on a phone and cyan in shade — four colour families for one
 * object. And you could see straight through all four kinds, so a ramp read as a
 * builder's ladder and a floor read as nothing at all.
 *
 * So the lattice now has a **material identity that survives any light**:
 *
 *  - **Slate-blue alloy plate.** One swatch book, authored in sRGB and
 *    converted once (see the swatch book below): every entry sits between
 *    0.20 and 0.58 in value, and every entry is blue. Nothing here is white, so nothing here has to borrow a
 *    colour from the sun. A tread is separated from a rib by *value*, never by
 *    whiteness — which is why the whole piece still reads as one substance.
 *  - **The light scales the material; it does not add to it.** The outgoing
 *    colour is the albedo times a saturating function of the incident light
 *    (0.58 … 1.54), plus a quarter of the lamp's hue so the piece sits in the
 *    scene. Sun, shade, sky bounce and shadow move that number. None of them
 *    can move the hue. Drive the key light from cold dawn through white noon to
 *    orange dusk and the plaza turns salmon while the ramp stays slate.
 *  - **A procedural plate pattern** — seams on a half-metre lattice, rivets on
 *    the seam nodes, a diamond knurl wherever a boot goes — projected triplanar
 *    from the piece's own object space, so every bar of every piece is plainly
 *    the same stock cut to different lengths. Its contrast dissolves as it
 *    approaches one pixel, so distance gives clean plate rather than static.
 *  - **A constant accent.** The inlay strips bypass the lighting entirely and
 *    are written at a fixed cyan, so the piece keeps a hard-light signature in
 *    full sun and in deep shade alike. That is the one colour a viewer will
 *    name, and it is the same colour at every hour.
 *  - **Solid decks.** Floor and ramp are closed plates with knurled treads,
 *    kerbs and a lit nosing — opaque, shadow-casting, unmistakably standable.
 *    The hard-light glaze that used to *be* the surface now lies on top of it
 *    as a ruled sheen, capped so it can never bleach a deck to white.
 *
 * Everything is instanced: four frame batches and four glaze batches, whatever
 * you build. A hundred and seventy-six pieces cost eight draw calls.
 */

const MAX = 176;
const ACCENT = 0x4fd8ff;     // the piece's own light — constant, in any sun
const WARM = 0xffc25f;       // …and what it turns when the crosshair holds it

export class Lattice {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'axiom-lattice';
    scene.add(this.group);

    this.geo = {};
    this.batches = {};
    this.live = {};
    this.time = 0;

    this.frameMat = makeFrameMaterial();
    this.glazeMat = makeGlazeMaterial();

    for (const kind of KINDS) {
      const g = buildGeometry(kind);
      this.geo[kind] = g;

      const tint = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
      const state = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
      const fg = g.frame.clone();
      const pg = g.panel ? g.panel.clone() : null;
      fg.setAttribute('aTint', tint);
      fg.setAttribute('aState', state);
      if (pg) { pg.setAttribute('aTint', tint); pg.setAttribute('aState', state); }

      const frame = new THREE.InstancedMesh(fg, this.frameMat, MAX);
      frame.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      frame.castShadow = true;
      frame.receiveShadow = true;
      frame.frustumCulled = false;
      frame.count = 0;
      this.group.add(frame);

      let panel = null;
      if (pg) {
        panel = new THREE.InstancedMesh(pg, this.glazeMat, MAX);
        panel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        panel.frustumCulled = false;
        panel.renderOrder = 3;
        panel.count = 0;
        panel.userData.noCamBlock = true;
        this.group.add(panel);
      }

      this.batches[kind] = { frame, panel, tint, state };
      this.live[kind] = [];
    }

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  /** Register a piece object (the same object the collider holds). */
  add(p) {
    p.grow = 0;
    p.fade = 0;
    p.sel = 0;
    p.dead = false;
    const list = this.live[p.kind];
    if (list.length >= MAX) return false;
    list.push(p);
    this._dirty = true;
    return true;
  }

  /** Start the dissolve. The piece stops being solid immediately. */
  kill(p) {
    p.dead = true;
    p.fade = 1;
    this._dirty = true;
  }

  update(dt, time) {
    this.time = time;
    this.glazeMat.uniforms.uTime.value = time;

    for (const kind of KINDS) {
      let moving = false;
      const list = this.live[kind];
      const b = this.batches[kind];
      const lo = SPEC[kind].lo;

      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (p.dead) {
          p.fade = Math.max(0, p.fade - dt * 3.4);
          if (p.fade <= 0) { list.splice(i, 1); this._dirty = true; }
          moving = true;
        } else if (p.grow < 1) {
          p.grow = Math.min(1, p.grow + dt * 3.6);
          moving = true;
        }
        if (p.roll) moving = true;
        const want = p.want || 0;
        if (Math.abs(p.sel - want) > 0.002) {
          p.sel += (want - p.sel) * Math.min(1, dt * 14);
          moving = true;
        }
      }

      if (!moving && !this._dirty) continue;

      const n = list.length;
      for (let i = 0; i < n; i++) {
        const p = list[i];
        // grow-in with a little overshoot, pivoting on the piece's own base so
        // a wall rises out of the ground instead of inflating around its middle
        const u = p.dead ? p.fade : ease(p.grow);
        const s = Math.max(0.0001, u);
        this._p.set(p.x, p.y + lo * (1 - s), p.z);
        // roll is only ever non-zero on a beam that has become a balance
        this._e.set(0, p.yaw, p.roll || 0, 'YZX');
        this._q.setFromEuler(this._e);
        this._s.set(s, s, s);
        this._m.compose(this._p, this._q, this._s);
        b.frame.setMatrixAt(i, this._m);
        if (b.panel) b.panel.setMatrixAt(i, this._m);

        const g = p.dead ? p.fade : p.grow;
        b.state.array[i * 2 + 0] = g;
        b.state.array[i * 2 + 1] = p.sel;
        // The emissive is written absolutely, not as a multiplier. Multiplying
        // a blue emissive by an amber highlight gives green — which is exactly
        // what a targeted piece used to turn, and it read as a bug rather than
        // as a selection.
        const flash = p.dead ? p.fade * 1.4 : (1 - p.grow) * 1.7;
        const tone = p.tone || 0;                 // 1 = it is doing mathematics
        // The body of the piece glows only faintly; the accent inlays carry the
        // identity, and they are handled in the shader so that they cannot be
        // washed out by whatever the body is doing.
        let r = 0.012, gg = 0.048, bb = 0.082;
        if (tone) { r += tone * 0.05; gg += tone * 0.05; bb += tone * 0.09; }
        b.tint.array[i * 3 + 0] = r + flash * 1.10;
        b.tint.array[i * 3 + 1] = gg + flash * 1.30;
        b.tint.array[i * 3 + 2] = bb + flash * 1.45;
      }

      b.frame.count = n;
      b.frame.instanceMatrix.needsUpdate = true;
      b.frame.boundingSphere = null;
      if (b.panel) {
        b.panel.count = n;
        b.panel.instanceMatrix.needsUpdate = true;
        b.panel.boundingSphere = null;
      }
      b.tint.needsUpdate = true;
      b.state.needsUpdate = true;
    }
    this._dirty = false;
  }
}

function ease(u) {
  // ease-out-back: the piece snaps into place and settles
  const c = 1.9;
  const t = u - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
}

// ---------------------------------------------------------------------------
// materials
// ---------------------------------------------------------------------------
/**
 * The alloy.
 *
 * Standard PBR, so it takes the scene's shadows, fog and tone map like
 * everything else — but with four surgeries, each of which exists because a
 * critic photographed the same ramp as four different substances in one
 * session.
 *
 * 1. **A mid-dark, genuinely blue albedo, authored in sRGB** (see the swatch book).
 *    The previous pass wrote its palette as raw linear floats, so a number
 *    that was meant to read as graphite arrived on screen at 0.6 sRGB — a
 *    pale ice-blue with no colour left to defend, which ACES then finished off
 *    by desaturating it towards white at every bright angle. Everything here
 *    now sits between 0.20 and 0.55 sRGB. Nothing in the piece is white.
 * 2. **Flattened lighting.** Just over half the outgoing colour is the
 *    surface's own albedo, taken straight, before any lamp gets a vote. The
 *    light models the form; it never renames the material.
 * 3. **A triplanar plate pattern** cut into the albedo from object space —
 *    seams on a 0.5 m lattice, rivets at the crossings, a diamond knurl on the
 *    surfaces you actually stand on. No UVs, so a 4 m deck plate and a 20 cm
 *    kerb are visibly the same stock. Its contrast fades out as the pattern
 *    approaches one pixel, which is what stops it boiling into dotted noise at
 *    twenty metres.
 * 4. **A restrained emissive.** The inlays are the one colour a viewer will
 *    name, so they are held well under the bloom knee: a cyan line, not a
 *    white one. Bright enough to be the signature at dusk, dim enough to still
 *    be cyan in full sun.
 */
function makeFrameMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.62, metalness: 0.08, vertexColors: true,
  });
  m.userData.uniforms = {
    uAccent: { value: new THREE.Color(ACCENT) },
    uWarm: { value: new THREE.Color(WARM) },
  };
  m.onBeforeCompile = (s) => {
    s.uniforms.uAccent = m.userData.uniforms.uAccent;
    s.uniforms.uWarm = m.userData.uniforms.uWarm;

    s.vertexShader = `
      attribute float acc;
      attribute float grip;
      attribute vec3 aTint;
      attribute vec2 aState;
      varying vec3 vTint; varying float vAcc; varying float vGrip;
      varying float vSel; varying float vGrow;
      varying vec3 vLocalP; varying vec3 vLocalN;
      ${s.vertexShader}`
      .replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\n  vLocalN = objectNormal;')
      .replace('#include <begin_vertex>',
        `#include <begin_vertex>
         vLocalP = transformed;
         vTint = aTint; vAcc = acc; vGrip = grip; vGrow = aState.x; vSel = aState.y;`);

    s.fragmentShader = `
      uniform vec3 uAccent; uniform vec3 uWarm;
      varying vec3 vTint; varying float vAcc; varying float vGrip;
      varying float vSel; varying float vGrow;
      varying vec3 vLocalP; varying vec3 vLocalN;
      vec3 axiomAccent; float axiomAcc;
      ${s.fragmentShader}`
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        {
          // triplanar: pick the plane the surface most faces, in object space
          // The y bias is what makes a 45° ramp deck take the same projection
          // a floor deck takes: without it the slope sits exactly on the tie
          // and the knurl runs up the piece instead of across it.
          vec3 an = abs(normalize(vLocalN));
          vec2 tp = an.y * 1.08 > max(an.x, an.z) ? vLocalP.xz
                  : (an.x > an.z ? vLocalP.zy : vLocalP.xy);
          // plate seams every 0.5 m
          vec2 sg = abs(fract(tp * 2.0) - 0.5);
          float sd = min(sg.x, sg.y);
          float fw = fwidth(sd);
          // as the pattern shrinks towards a pixel, dissolve it rather than
          // letting it alias — a lattice seen from the far side of the plaza
          // should read as clean plate, not as static
          float lod = 1.0 - smoothstep(0.030, 0.115, fw);
          float sw = fw + 0.004;
          float seam = (1.0 - smoothstep(0.0, sw * 2.4, sd)) * lod;
          // a rivet on every seam crossing
          vec2 rv = fract(tp * 2.0 + 0.5) - 0.5;
          float rd = length(rv);
          float riv = (1.0 - smoothstep(0.052, 0.052 + fwidth(rd) * 2.0 + 0.012, rd)) * lod;
          // brushed grain along the longer axis of the plate
          float grain = sin(tp.x * 47.0) * sin(tp.y * 3.1) * 0.5 + 0.5;
          // the surfaces you put a boot on get a diamond knurl, which is what
          // a walkable plate looks like everywhere a person has ever walked
          vec2 kq = tp * 4.6;
          float dia = abs(fract(kq.x + kq.y) - 0.5) + abs(fract(kq.x - kq.y) - 0.5);
          float knurl = (1.0 - smoothstep(0.30, 0.30 + fwidth(dia) * 1.6 + 0.05, dia))
                      * vGrip * lod;
          diffuseColor.rgb *= (1.0 - seam * 0.46) * (1.0 + riv * 0.24)
                            * (0.95 + grain * 0.10) * (1.0 - knurl * 0.20);
        }`)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        {
          // The inlay's colour is decided here and applied at the very end, so
          // no lamp, shadow or bounce ever gets between the accent and the
          // frame buffer. It warms — it does not change hue family — when the
          // crosshair is holding this piece.
          axiomAccent = mix(uAccent, uWarm, clamp(vSel, 0.0, 1.0));
          axiomAcc = vAcc * smoothstep(0.02, 0.45, vGrow);
          totalEmissiveRadiance = vec3(0.0);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          #ifdef OPAQUE
            diffuseColor.a = 1.0;
          #endif
          // THE LINE THAT MAKES A RAMP ONE SUBSTANCE.
          //
          // A mix between "lit" and "albedo" was not enough: in bright bounce
          // the lit term alone ran past 1.5, and half of 1.5 is still white
          // once the tone map has had it. So the light no longer *adds* to the
          // material at all — it *scales* it, through a saturating curve. The
          // outgoing colour is the piece's own albedo times a number between
          // 0.52 and 1.52, plus a quarter of the lamp's hue so the piece still
          // sits in the scene rather than on top of it. Sun, shade, sky bounce
          // and shadow move that number. None of them can move the hue.
          vec3 lit = outgoingLight;
          vec3 own = diffuseColor.rgb;
          const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
          float lum = dot(lit, LUMA);
          float alb = max(dot(own, LUMA), 1e-4);
          float g = lum / alb;
          g = 0.58 + 0.96 * (g / (g + 1.10));
          vec3 lampHue = lit / max(lum, 1e-4);
          vec3 body = own * g * mix(vec3(1.0), lampHue, 0.24) + lit * 0.05;
          // the inlay does not take the light: it is the light
          vec3 inlay = axiomAccent * (1.10 + 0.55 * vSel);
          outgoingLight = mix(body, inlay, clamp(axiomAcc, 0.0, 1.0))
                        + vTint * (0.30 + axiomAcc * 0.5);
          gl_FragColor = vec4(outgoingLight, diffuseColor.a);
        }`);
  };
  m.customProgramCacheKey = () => 'axiom-alloy-v5';
  return m;
}

/**
 * The hard-light glaze that lies *on* the deck rather than instead of it.
 *
 * Additive, ruled like graph paper, brightest along the rim. Over an opaque
 * plate it reads as an energised surface; on its own it would read as a
 * hologram of a surface, which is the mistake this replaces.
 *
 * Its amplitudes are a third of what they were, and that is the point. An
 * additive sheet with a grazing-angle term is a machine for turning a deck
 * white: catch a floor plate from a low angle and the fresnel lobe alone used
 * to put it over 1.0, the tone map flattened the hue out of it, and the piece
 * that had just been graphite-blue photographed as a slab of white plastic.
 * The glaze may now say "energised". It may not say "white".
 */
function makeGlazeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCol: { value: new THREE.Color(0x4bb6e4) },
      uHot: { value: new THREE.Color(0x9fe0fb) },
    },
    vertexShader: /* glsl */`
      attribute vec3 aTint;
      attribute vec2 aState;
      varying vec2 vUv; varying vec3 vTint; varying float vGrow; varying float vSel;
      varying vec3 vN; varying vec3 vV; varying float vDist;
      void main(){
        vUv = uv; vTint = aTint; vGrow = aState.x; vSel = aState.y;
        #ifdef USE_INSTANCING
          mat4 im = instanceMatrix;
        #else
          mat4 im = mat4(1.0);
        #endif
        vec4 wp = modelMatrix * im * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vec3 toEye = cameraPosition - wp.xyz;
        vDist = length(toEye);
        vV = toEye / max(vDist, 0.001);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv; varying vec3 vTint; varying float vGrow; varying float vSel;
      varying vec3 vN; varying vec3 vV; varying float vDist;
      uniform float uTime; uniform vec3 uCol; uniform vec3 uHot;

      float rule(vec2 p, float n){
        vec2 q = p * n;
        vec2 d = abs(fract(q + 0.5) - 0.5);
        vec2 w = fwidth(q) * 1.1 + 0.0015;
        vec2 l = vec2(1.0) - smoothstep(vec2(0.0), w, d);
        return max(l.x, l.y);
      }

      void main(){
        vec2 p = vUv;
        float minor = rule(p, 8.0);
        float major = rule(p, 2.0);
        vec2 e = abs(p - 0.5) * 2.0;
        float rim = smoothstep(0.90, 1.0, max(e.x, e.y));
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);

        // the build wipe: hard light floods the plate from the base upward
        float wipe = smoothstep(vGrow + 0.06, vGrow - 0.16, p.y);
        float front = exp(-abs(p.y - vGrow) * 22.0) * step(0.02, vGrow) * step(vGrow, 0.995);

        float a = 0.004 + minor * 0.008 + major * 0.024 + rim * 0.062 + fres * 0.024;
        a = a * wipe + front * 0.30;
        a *= 1.0 - smoothstep(110.0, 260.0, vDist);
        a *= 0.90 + 0.10 * sin(uTime * 1.7 + p.y * 5.0 + p.x * 2.0);
        a *= 1.0 + vSel * 0.7;
        a = min(a, 0.20);              // the ceiling that keeps a deck a deck

        vec3 col = mix(uCol, uHot, clamp(rim * 0.45 + front, 0.0, 1.0));
        col = mix(col, vec3(1.0, 0.78, 0.42), clamp(vSel, 0.0, 1.0) * 0.75);
        col += vTint * 0.4;
        gl_FragColor = vec4(col * a, a);
        if (gl_FragColor.a < 0.002) discard;
      }`,
  });
}

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------
/**
 * ONE SWATCH BOOK, WRITTEN THE WAY A PAINTER WOULD WRITE IT.
 *
 * These are sRGB hex — what you would sample off the screenshot — and they are
 * converted to the renderer's linear working space exactly once, here. The
 * previous pass wrote the same intent as raw linear floats and lost the
 * argument by a factor of two: `0.7` meant "light grey", arrived as 0.87 sRGB,
 * and the treads photographed as white plastic.
 *
 * The whole family lives in a narrow band — 0.20 to 0.58 in value, every one of
 * them blue of hue. That band is the identity. A surface that dark cannot be
 * repainted by a warm sun, and a surface that saturated cannot be bleached to
 * neutral by the tone map. What separates a tread from a rib is *value*, not
 * whiteness, which is why all of it still reads as one substance.
 */
const swatch = (hex) => {
  const c = new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
};
const PLATE = swatch(0x4b5c73);   // the closed deck / panel face — slate blue
const RAIL = swatch(0x6b8199);    // rails, kerbs, frame members
const DARK = swatch(0x222b3a);    // nodes, shadow lines, undersides
const TREAD = swatch(0x8798ae);   // the bit you put your boot on
const GLOW = swatch(0x8fcde3);    // the inlay — carries the emissive accent

/**
 * One member of the structure.
 *
 * `acc` marks it as an emissive inlay strip: a constant, light-independent
 * signature that no sun can repaint. `grip` marks it as a surface a boot goes
 * on, which the shader answers with a diamond knurl.
 */
function bar(w, h, d, x = 0, y = 0, z = 0, rx = 0, tone = RAIL, acc = 0, grip = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  const a = new Float32Array(n);
  const k = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    c[i * 3] = tone[0]; c[i * 3 + 1] = tone[1]; c[i * 3 + 2] = tone[2];
    a[i] = acc;
    k[i] = grip;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('acc', new THREE.BufferAttribute(a, 1));
  g.setAttribute('grip', new THREE.BufferAttribute(k, 1));
  return g;
}

function frameOf(parts) {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  for (const p of parts) p.dispose();
  g.computeVertexNormals();
  return g;
}

const SLOPE = Math.SQRT1_2;              // cos 45° = sin 45°
const RAMP_L = Math.SQRT2 * 4;           // the slope length of one cell of climb

/** A member lying flat on the ramp's deck, `up` metres proud of it. */
function onSlope(w, h, d, along, up, tone, acc = 0, grip = 0) {
  // deck surface passes through local (z = s, y = s + 2); its normal is
  // (0, cos45, -sin45), so "proud" means up *and* back
  return bar(w, h, d, 0, along + 2 + up * SLOPE, along - up * SLOPE, -Math.PI / 4,
    tone, acc, grip);
}

/**
 * Each kind is authored so its base sits at local y = SPEC.lo, and so the
 * silhouette says what it is from any angle *and* says you can stand on it: a
 * wall is a closed mullioned panel, a ramp is a solid stair with raised treads
 * and kerbs, a floor is a closed deck plate with a rim, a beam is an open truss
 * with a lit core — the one piece that is *meant* to read as a bar.
 */
function buildGeometry(kind) {
  if (kind === 'wall') {
    const D = 0.34;
    const parts = [
      // the closed face — this is the difference between a wall and a window
      bar(3.86, 3.86, D, 0, 0, 0, 0, PLATE),
      // frame
      bar(4.0, 0.30, 0.46, 0, 1.85, 0),
      bar(4.0, 0.30, 0.46, 0, -1.85, 0),
      bar(0.30, 3.40, 0.46, -1.85, 0, 0),
      bar(0.30, 3.40, 0.46, 1.85, 0, 0),
      // mullions
      bar(3.4, 0.20, 0.44, 0, 0, 0, 0, DARK),
      bar(0.20, 3.4, 0.44, 0, 0, 0, 0, DARK),
      // the inlay square: the piece's own light
      bar(2.9, 0.07, 0.48, 0, 1.30, 0, 0, GLOW, 1),
      bar(2.9, 0.07, 0.48, 0, -1.30, 0, 0, GLOW, 1),
      bar(0.07, 2.54, 0.48, -1.30, 0, 0, 0, GLOW, 1),
      bar(0.07, 2.54, 0.48, 1.30, 0, 0, 0, GLOW, 1),
    ];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) parts.push(bar(0.58, 0.58, 0.54, sx * 1.72, sy * 1.72, 0, 0, DARK));
    }
    const a = new THREE.PlaneGeometry(3.4, 3.4);
    a.translate(0, 0, 0.24);
    const b = new THREE.PlaneGeometry(3.4, 3.4);
    b.rotateY(Math.PI);
    b.translate(0, 0, -0.24);
    return { frame: frameOf(parts), panel: mergeGeometries([a, b], false) };
  }

  if (kind === 'floor') {
    const parts = [
      // closed deck: top face lands exactly on SPEC.floor.hi
      bar(3.92, 0.30, 3.92, 0, 0.03, 0, 0, PLATE),
      // ribs, so the underside is a structure rather than a blank
      bar(3.9, 0.14, 0.30, 0, -0.17, -1.1, 0, DARK),
      bar(3.9, 0.14, 0.30, 0, -0.17, 1.1, 0, DARK),
      bar(0.30, 0.14, 3.9, 0, -0.17, 0, 0, DARK),
      // rim kerb — a low nosing rather than the wall of a tray. It stands
      // 7 cm proud of the tread, which is a kerb; at 15 cm the deck read as a
      // sunken bath and you would not have guessed it was for standing on.
      bar(4.0, 0.18, 0.30, 0, 0.18, -1.85),
      bar(4.0, 0.18, 0.30, 0, 0.18, 1.85),
      bar(0.30, 0.18, 3.4, -1.85, 0.18, 0),
      bar(0.30, 0.18, 3.4, 1.85, 0.18, 0),
      // …and a lit line laid into the top of that nosing, all the way round.
      // A deck seen from thirty metres away in flat light is a dark rectangle
      // on dark stone; a deck with a lit outline is a place to put your feet,
      // and the outline is the same colour at every hour.
      bar(3.5, 0.045, 0.09, 0, 0.275, -1.85, 0, GLOW, 1),
      bar(3.5, 0.045, 0.09, 0, 0.275, 1.85, 0, GLOW, 1),
      bar(0.09, 0.045, 3.5, -1.85, 0.275, 0, 0, GLOW, 1),
      bar(0.09, 0.045, 3.5, 1.85, 0.275, 0, 0, GLOW, 1),
      // walking surface: four knurled tread panels split by a lit seam cross
      bar(1.62, 0.06, 1.62, -0.87, 0.20, -0.87, 0, TREAD, 0, 1),
      bar(1.62, 0.06, 1.62, 0.87, 0.20, -0.87, 0, TREAD, 0, 1),
      bar(1.62, 0.06, 1.62, -0.87, 0.20, 0.87, 0, TREAD, 0, 1),
      bar(1.62, 0.06, 1.62, 0.87, 0.20, 0.87, 0, TREAD, 0, 1),
      bar(3.5, 0.05, 0.10, 0, 0.215, 0, 0, GLOW, 1),
      bar(0.10, 0.05, 3.5, 0, 0.215, 0, 0, GLOW, 1),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) parts.push(bar(0.52, 0.52, 0.52, sx * 1.78, 0.10, sz * 1.78, 0, DARK));
    }
    const panel = new THREE.PlaneGeometry(3.4, 3.4);
    panel.rotateX(-Math.PI / 2);
    panel.translate(0, 0.245, 0);
    return { frame: frameOf(parts), panel };
  }

  if (kind === 'ramp') {
    const parts = [
      // the solid wedge: a 40 cm slab whose upper face IS the collision surface
      bar(3.86, 0.40, RAMP_L, 0, 2 - 0.20 / SLOPE, 0, -Math.PI / 4, PLATE, 0, 1),
      // kick plate at the foot and a closing plate at the head
      bar(3.9, 0.70, 0.34, 0, -0.30, -1.83, 0, DARK),
      bar(3.9, 0.90, 0.34, 0, 3.52, 1.83, 0, DARK),
      // the lit nosing on the bottom step: the one line that says "start here",
      // and the thing that makes a ramp legible as a way up from across the
      // plaza rather than as a wedge lying on the ground
      bar(3.30, 0.06, 0.10, 0, 0.08, -1.72, 0, GLOW, 1),
    ];
    // treads — eight of them, alternating, so the climb is legible from below
    for (let i = 0; i < 8; i++) {
      const s = -1.75 + i * 0.5;
      parts.push(onSlope(3.42, 0.13, 0.30, s, 0.065, i % 2 ? TREAD : RAIL, 0, 1));
    }
    // kerbs down both edges, each with a lit inlay running up its top
    for (const sx of [-1, 1]) {
      parts.push(bar(0.30, 0.46, RAMP_L, sx * 1.85, 2 + 0.23 * SLOPE, -0.23 * SLOPE, -Math.PI / 4));
      parts.push(bar(0.12, 0.06, RAMP_L * 0.96, sx * 1.85, 2 + 0.49 * SLOPE, -0.49 * SLOPE,
        -Math.PI / 4, GLOW, 1));
      parts.push(bar(0.52, 0.62, 0.52, sx * 1.80, 0.05, -1.80, 0, DARK));
      parts.push(bar(0.52, 0.62, 0.52, sx * 1.80, 3.72, 1.80, 0, DARK));
    }
    const panel = new THREE.PlaneGeometry(3.4, RAMP_L * 0.94);
    panel.rotateX(-Math.PI / 2);
    panel.rotateX(-Math.PI / 4);
    panel.translate(0, 2 + 0.07 * SLOPE, -0.07 * SLOPE);
    return { frame: frameOf(parts), panel };
  }

  // beam — a truss, and the piece that becomes a balance at a rift. This one is
  // supposed to read as an open member: it is a lever, not a floor.
  const parts = [
    bar(4, 0.17, 0.34, 0, 0.16, 0),
    bar(4, 0.17, 0.34, 0, -0.16, 0),
    bar(3.6, 0.10, 0.16, 0, 0, 0, 0, GLOW, 1),
  ];
  for (let i = -2; i <= 2; i++) parts.push(bar(0.14, 0.36, 0.22, i * 0.8, 0, 0, 0, DARK));
  for (const sx of [-1, 1]) parts.push(bar(0.34, 0.58, 0.44, sx * 1.9, 0, 0, 0, DARK));
  const panel = new THREE.PlaneGeometry(3.7, 0.30);
  return { frame: frameOf(parts), panel };
}

export { buildGeometry };
