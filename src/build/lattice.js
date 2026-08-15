import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  KINDS, SPEC, LEVEL, WALL_T, DECK_T, NODE_T, endNodes, baseOf,
  DOOR_HX, DOOR_H,
} from './pieces.js';

/**
 * The batches the renderer keeps, which is the five kinds plus one.
 *
 * `door` is not a kind the cadet can pick and it is not a class the collider
 * knows: it is a *wall*, everywhere except here. A wall that has had a doorway
 * cut into it draws from its own instanced batch because instancing draws one
 * geometry many times and a hole is a different geometry — `bin()` is the only
 * place in the system that has to care.
 */
const RENDER_KINDS = [...KINDS, 'door'];
/** Which batch a piece draws from. */
const bin = (p) => (p.kind === 'wall' && p.door ? 'door' : p.kind);
/** Which kind's dimensions a batch uses. */
const specOf = (k) => SPEC[k === 'door' ? 'wall' : k];

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

    for (const kind of RENDER_KINDS) {
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

    // THE POST THAT CLOSES A CORNER.
    //
    // A wall spans one whole cell edge and is centred on it, so where two walls
    // meet at right angles their outer faces stop half a thickness short of the
    // corner and leave a slot you can see daylight through. Every modular kit
    // that has ever shipped answers this the same way: the wall is the panel,
    // and the *node* is a post.
    //
    // So the renderer draws one post at every lattice node a wall ends on, and
    // — this is the part that matters — it draws it exactly **once**, however
    // many walls arrive there. Letting each wall carry its own end cap would
    // put two identical boxes in the same cubic half-metre at every corner and
    // in the middle of every straight run, which is a z-fighting shimmer rather
    // than a joint.
    this.nodeGeo = nodeGeometry();
    const nodeState = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
    const nodeTint = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.nodeGeo.setAttribute('aState', nodeState);
    this.nodeGeo.setAttribute('aTint', nodeTint);
    this.nodes = new THREE.InstancedMesh(this.nodeGeo, this.frameMat, MAX);
    this.nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.nodes.castShadow = true;
    this.nodes.receiveShadow = true;
    this.nodes.frustumCulled = false;
    this.nodes.count = 0;
    this.group.add(this.nodes);
    this.nodeAttrs = { state: nodeState, tint: nodeTint };
    this._nodeMap = new Map();
    this._ends = [0, 0, 0, 0];

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
    const list = this.live[bin(p)];
    if (list.length >= MAX) return false;
    list.push(p);
    this._dirty = true;
    return true;
  }

  /**
   * A wall has just had a doorway cut into it. Same piece, same slot, same
   * collider entry — a different geometry, so it changes batch.
   *
   * Its grow-in is carried across rather than restarted: the door is decided in
   * the same frame the wall is placed, and a piece that visibly re-materialised
   * would read as two pieces where the player set one.
   */
  reface(p) {
    for (const k of RENDER_KINDS) {
      const list = this.live[k];
      const i = list.indexOf(p);
      if (i < 0) continue;
      if (k === bin(p)) return true;
      list.splice(i, 1);
      const next = this.live[bin(p)];
      if (next.length >= MAX) { list.push(p); return false; }
      next.push(p);
      this._dirty = true;
      return true;
    }
    return false;
  }

  /** Start the dissolve. The piece stops being solid immediately. */
  kill(p) {
    p.dead = true;
    p.fade = 1;
    this._dirty = true;
  }

  /**
   * One post per lattice node that a wall ends on, carrying the strongest
   * grow-in of the walls that meet there so a corner rises with its walls.
   */
  _nodePass() {
    const map = this._nodeMap;
    map.clear();
    for (const p of [...this.live.wall, ...this.live.door]) {
      const u = p.dead ? p.fade : p.grow;
      if (u <= 0.001) continue;
      endNodes(p, this._ends);
      const base = baseOf(p);
      for (let i = 0; i < 2; i++) {
        const x = this._ends[i * 2], z = this._ends[i * 2 + 1];
        const k = `${Math.round(x * 2)},${Math.round(z * 2)},${Math.round(base * 64)}`;
        const had = map.get(k);
        if (had) {
          if (u > had.u) { had.u = u; had.sel = p.sel; }
        } else {
          map.set(k, { x, z, y: base + LEVEL / 2, u, sel: p.sel });
        }
      }
    }
    let i = 0;
    for (const n of map.values()) {
      if (i >= MAX) break;
      const s = Math.max(0.0001, ease(Math.min(1, n.u)));
      this._p.set(n.x, n.y - (LEVEL / 2) * (1 - s), n.z);
      this._q.set(0, 0, 0, 1);
      this._s.set(1, s, 1);
      this._m.compose(this._p, this._q, this._s);
      this.nodes.setMatrixAt(i, this._m);
      this.nodeAttrs.state.array[i * 2 + 0] = n.u;
      this.nodeAttrs.state.array[i * 2 + 1] = n.sel;
      const flash = (1 - Math.min(1, n.u)) * 1.5;
      this.nodeAttrs.tint.array[i * 3 + 0] = 0.012 + flash * 1.10;
      this.nodeAttrs.tint.array[i * 3 + 1] = 0.048 + flash * 1.30;
      this.nodeAttrs.tint.array[i * 3 + 2] = 0.082 + flash * 1.45;
      i++;
    }
    this.nodes.count = i;
    this.nodes.instanceMatrix.needsUpdate = true;
    this.nodes.boundingSphere = null;
    this.nodeAttrs.state.needsUpdate = true;
    this.nodeAttrs.tint.needsUpdate = true;
  }

  update(dt, time) {
    this.time = time;
    this.glazeMat.uniforms.uTime.value = time;
    let nodesMoved = this._dirty;

    for (const kind of RENDER_KINDS) {
      let moving = false;
      const list = this.live[kind];
      const b = this.batches[kind];
      const lo = specOf(kind).lo;

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

      if ((kind === 'wall' || kind === 'door') && moving) nodesMoved = true;
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
    if (nodesMoved) this._nodePass();
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

/**
 * A member lying flat on the ramp's deck, `up` metres proud of it.
 * The deck surface passes through local (z = s, y = s + 2) and its unit normal
 * is (0, cos45, -sin45), so "proud" means up *and* back.
 */
function onSlope(w, h, d, along, up, tone, acc = 0, grip = 0) {
  return bar(w, h, d, 0, along + 2 + up * SLOPE, along - up * SLOPE, -Math.PI / 4,
    tone, acc, grip);
}

/**
 * An extruded profile — the honest way to draw a wedge.
 *
 * The ramp's deck is a plane, `y = z + 2`, and the collider believes that
 * exactly. Drawing it as a rotated box meant the box's *ends* were cut square
 * across the slope, so the drawn surface stopped fourteen centimetres short of
 * the cell at the head and overhung it at the foot: the ramp you could walk on
 * and the ramp you could see were two different objects, and the head never met
 * a floor. A profile extruded along x lands on the cell boundary exactly.
 *
 * `profile` is a closed polygon in (z, y), wound so that edge 0 is the deck.
 */
function prism(profile, hx, faces) {
  const pos = [], col = [], acc = [], grip = [];
  const push = (x, y, z, f) => {
    pos.push(x, y, z);
    col.push(f.tone[0], f.tone[1], f.tone[2]);
    acc.push(f.acc || 0);
    grip.push(f.grip || 0);
  };
  const tri = (a, b, c, f) => { push(...a, f); push(...b, f); push(...c, f); };

  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const [z0, y0] = profile[i];
    const [z1, y1] = profile[(i + 1) % n];
    const f = faces[i] || faces[0];
    const A = [-hx, y0, z0], B = [-hx, y1, z1], C = [hx, y1, z1], D = [hx, y0, z0];
    tri(A, B, C, f); tri(A, C, D, f);
  }
  const cap = faces[n] || faces[0];
  for (let i = 1; i < n - 1; i++) {
    const P0 = profile[0], Pi = profile[i], Pj = profile[i + 1];
    tri([hx, P0[1], P0[0]], [hx, Pi[1], Pi[0]], [hx, Pj[1], Pj[0]], cap);
    tri([-hx, P0[1], P0[0]], [-hx, Pj[1], Pj[0]], [-hx, Pi[1], Pi[0]], cap);
  }

  const g = new THREE.BufferGeometry();
  const v = pos.length / 3;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('acc', new THREE.BufferAttribute(new Float32Array(acc), 1));
  g.setAttribute('grip', new THREE.BufferAttribute(new Float32Array(grip), 1));
  // the merge below insists every part carry the same attributes; the alloy
  // shader projects its plate pattern from object space and never reads uv
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(v * 2), 2));
  g.computeVertexNormals();
  return g;
}

/**
 * THE POST AT A LATTICE NODE.
 *
 * Four metres tall, `NODE_T` square, and a shade proud of a wall's face on all
 * four sides so it reads as a stanchion the panels are hung between rather than
 * as a lump. It is drawn once per node by `Lattice._nodePass`, which is what
 * lets it close a corner without two walls fighting over the same half-metre.
 */
function nodeGeometry() {
  const H = LEVEL / 2;
  const w = NODE_T;
  const parts = [
    bar(w, LEVEL, w, 0, 0, 0, 0, RAIL),
    bar(w + 0.06, 0.32, w + 0.06, 0, H - 0.17, 0, 0, DARK),
    bar(w + 0.06, 0.32, w + 0.06, 0, -H + 0.17, 0, 0, DARK),
    bar(w + 0.05, 0.20, w + 0.05, 0, 0, 0, 0, DARK),
    bar(0.10, LEVEL - 0.90, w + 0.036, 0, 0, 0, 0, GLOW, 1),
    bar(w + 0.036, LEVEL - 0.90, 0.10, 0, 0, 0, 0, GLOW, 1),
  ];
  return frameOf(parts);
}

/**
 * EVERY KIND, AUTHORED TO THE LATTICE RATHER THAN TO THE EYE.
 *
 * The silhouette still has to say what a piece is from any angle — a wall is a
 * closed mullioned panel, a ramp a solid stair, a floor a plated deck, a beam an
 * open truss — but every dimension now comes off `pieces.js`, so the metal lands
 * exactly on the slot boundary:
 *
 *  - a **wall** is 4.00 long and `WALL_T` thick, centred on its face, so a run
 *    of them butts end to end with no seam and the node posts fill the corners;
 *  - a **floor** is 4.00 square with a **dead flat top at local y = 0**. The
 *    kerb that used to stand seven centimetres proud of the deck is now a fascia
 *    hanging *below* it: two adjacent decks with kerbs show a double ridge along
 *    every seam, and no floor anybody has ever walked on does that;
 *  - a **ramp** is a true extruded wedge whose upper face is the plane the
 *    collider walks, from the cell's near edge at `y = 0` to its far edge at
 *    `y = LEVEL` — which is a deck's level, so its head meets a floor flush;
 *  - a **beam** is a rail whose top is its level, at half a storey;
 *  - a **vault** is a floor with a coil sunk into it, tiling with floors exactly.
 */
/**
 * A WALL, AND WHY EVERY MEMBER OF IT NOW STOPS AT 1.74.
 *
 * A wall spans a whole cell edge, so where two of them meet at a right angle
 * their volumes overlap in the last quarter-metre of each. The kit's answer to
 * that has always been the node post: `NODE_T` square, drawn once per lattice
 * node, straddling the corner from 1.74 to 2.26 out along both edges.
 *
 * The wall was built to 2.00. Every horizontal rail, every end stile and — the
 * loud one — the four dark 0.52 corner blocks at local y = ±1.74 therefore ran
 * a clear 0.15 m *past* the plane of the perpendicular wall's face plate, which
 * starts at 1.85. From outside a corner you saw the far wall's frame poking
 * through the near wall's panel as two black stubs, one high, one low. That is
 * the butt joint a cold critic photographed, and it is arithmetic, not shading.
 *
 * So the panel now ends where the post begins: **nothing on a wall reaches past
 * ±1.74.** The post covers 1.74 → 2.26 on both edges, which is more than the
 * 0.22 half-thickness a neighbour needs, so a straight run has no seam and a
 * corner is a mitre closed by a stanchion — with no member of either wall ever
 * entering the other's volume.
 *
 * The lit inlay stops at ±1.45 and the panel glaze at ±1.70, so neither the
 * accent nor the hard light can run off the end of the wall into open air. The
 * only lit thing at a node is the post's own strip, which is on the post.
 *
 * `door` cuts the opening the anti-trap rule needs (see `pieces.js`): the two
 * jambs and a header, same frame, same light, with the middle taken out.
 */
function wallGeometry(door) {
  const D = WALL_T;              // 0.44 — the frame's full thickness
  const F = 0.30;                // the closed face is a little thinner
  const E = 1.74;                // where the wall stops and the node post starts
  const S = 0.28;                // frame member
  const parts = [
    // frame: the head, stopping at the post
    bar(E * 2, S, D, 0, 1.86, 0),
    // end stiles, inboard of the post rather than buried in it
    bar(S, 3.44, D, -(E - S / 2), 0, 0),
    bar(S, 3.44, D, E - S / 2, 0, 0),
  ];
  // THE SILL, AND WHY A DOOR DOES NOT GET ONE ACROSS ITS OPENING.
  //
  // The collider takes the whole opening out of the wall, floor to header, so a
  // full-width sill would be a lit twenty-eight centimetre bar lying across the
  // threshold that the cadet's boots pass straight through. A drawn thing you
  // walk through is worse than no doorway at all: it says the hole is a texture.
  // So on a door the sill is two pieces, each running from its jamb to its post.
  if (!door) parts.push(bar(E * 2, S, D, 0, -1.86, 0));
  else {
    const w = E - DOOR_HX;
    for (const sx of [-1, 1]) parts.push(bar(w, S, D, sx * (E + DOOR_HX) / 2, -1.86, 0));
  }
  if (!door) {
    parts.push(
      // the closed face — this is the difference between a wall and a window
      bar(E * 2 - 0.10, 3.86, F, 0, 0, 0, 0, PLATE),
      // mullions
      bar(E * 2 - S, 0.18, D - 0.03, 0, 0, 0, 0, DARK),
      bar(0.18, 3.44, D - 0.03, 0, 0, 0, 0, DARK),
      // the inlay square: the piece's own light, kept well inboard of the joint
      bar(2.90, 0.07, D + 0.02, 0, 1.30, 0, 0, GLOW, 1),
      bar(2.90, 0.07, D + 0.02, 0, -1.30, 0, 0, GLOW, 1),
      bar(0.07, 2.54, D + 0.02, -1.30, 0, 0, 0, GLOW, 1),
      bar(0.07, 2.54, D + 0.02, 1.30, 0, 0, 0, GLOW, 1),
    );
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        parts.push(bar(0.48, 0.48, D + 0.01, sx * (E - 0.24), sy * 1.50, 0, 0, DARK));
      }
    }
  } else {
    // THE DOORWAY. Local y runs -2 … +2 about the wall's middle, so the opening
    // reaches from the sill to `DOOR_H` above the base — local y = DOOR_H - 2.
    const head = DOOR_H - 2.0;
    const jamb = (E - DOOR_HX);           // width of the panel each side
    const jx = (E + DOOR_HX) / 2;         // its centre
    for (const sx of [-1, 1]) {
      parts.push(
        bar(jamb - 0.10, 3.86, F, sx * jx, 0, 0, 0, PLATE),
        // the reveal: a lit edge down the opening, so a door reads as a door
        // from across the plaza rather than as a wall somebody failed to finish
        bar(0.07, DOOR_H - 0.24, D + 0.02, sx * (DOOR_HX + 0.06),
          (head + (-2 + 0.12)) / 2, 0, 0, GLOW, 1),
        bar(S, DOOR_H - 0.10, D + 0.005, sx * (DOOR_HX + S / 2), (head - 2) / 2, 0, 0, DARK),
      );
    }
    parts.push(
      // header over the opening, and its own lit line under it
      bar(DOOR_HX * 2, 2.0 - head - 0.14, F, 0, (head + 1.86) / 2, 0, 0, PLATE),
      bar(DOOR_HX * 2 + 0.4, 0.20, D + 0.005, 0, head, 0, 0, DARK),
      bar(DOOR_HX * 2 - 0.10, 0.07, D + 0.02, 0, head - 0.16, 0, 0, GLOW, 1),
    );
  }

  // The hard-light glaze. On a door it is the two side panels only — a glaze
  // across the opening would be a pane of light in a hole you walk through.
  const glaze = [];
  const pane = (w, h, x, y) => {
    for (const s of [1, -1]) {
      const g = new THREE.PlaneGeometry(w, h);
      if (s < 0) g.rotateY(Math.PI);
      g.translate(x, y, s * (F / 2 + 0.01));
      glaze.push(g);
    }
  };
  if (!door) pane(3.40, 3.40, 0, 0);
  else {
    const jw = (E - DOOR_HX) - 0.22;
    if (jw > 0.05) for (const sx of [-1, 1]) pane(jw, 3.40, sx * (E + DOOR_HX) / 2, 0);
  }
  return { frame: frameOf(parts), panel: mergeGeometries(glaze, false) };
}

function buildGeometry(kind) {
  if (kind === 'wall' || kind === 'door') return wallGeometry(kind === 'door');

  if (kind === 'floor') {
    const T = DECK_T;              // the deck hangs entirely below y = 0
    const parts = [
      // structure, all of it under the walking plane
      bar(4.00, 0.12, 4.00, 0, -T + 0.06, 0, 0, PLATE),
      bar(4.00, 0.10, 4.00, 0, -0.09, 0, 0, PLATE),
      bar(3.90, 0.15, 0.26, 0, -T + 0.15, -1.05, 0, DARK),
      bar(3.90, 0.15, 0.26, 0, -T + 0.15, 1.05, 0, DARK),
      bar(0.26, 0.15, 3.90, 0, -T + 0.15, 0, 0, DARK),
      // the fascia: what a deck shows to the air on an edge nobody built onto.
      // It stops at ±2.00, so two decks side by side hide each other's fascia
      // and read as one continuous floor rather than as two trays.
      bar(4.00, 0.22, 0.28, 0, -0.24, -1.86),
      bar(4.00, 0.22, 0.28, 0, -0.24, 1.86),
      bar(0.28, 0.22, 3.44, -1.86, -0.24, 0),
      bar(0.28, 0.22, 3.44, 1.86, -0.24, 0),
      // …with a lit line along it, so a deck seen from below or from across the
      // plaza is a place to put your feet rather than a dark rectangle
      bar(3.50, 0.05, 0.06, 0, -0.18, -1.97, 0, GLOW, 1),
      bar(3.50, 0.05, 0.06, 0, -0.18, 1.97, 0, GLOW, 1),
      bar(0.06, 0.05, 3.50, -1.97, -0.18, 0, 0, GLOW, 1),
      bar(0.06, 0.05, 3.50, 1.97, -0.18, 0, 0, GLOW, 1),
      // the walking surface: four knurled panels whose tops are EXACTLY y = 0
      bar(1.86, 0.05, 1.86, -1.03, -0.025, -1.03, 0, TREAD, 0, 1),
      bar(1.86, 0.05, 1.86, 1.03, -0.025, -1.03, 0, TREAD, 0, 1),
      bar(1.86, 0.05, 1.86, -1.03, -0.025, 1.03, 0, TREAD, 0, 1),
      bar(1.86, 0.05, 1.86, 1.03, -0.025, 1.03, 0, TREAD, 0, 1),
      // and the light, sunk into the seams between them rather than standing
      // proud, so nothing on this piece is higher than the level it defines
      bar(3.92, 0.04, 0.12, 0, -0.045, 0, 0, GLOW, 1),
      bar(0.12, 0.04, 3.92, 0, -0.045, 0, 0, GLOW, 1),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(bar(0.50, 0.24, 0.50, sx * 1.74, -0.25, sz * 1.74, 0, DARK));
      }
    }
    const panel = new THREE.PlaneGeometry(3.86, 3.86);
    panel.rotateX(-Math.PI / 2);
    panel.translate(0, 0.004, 0);
    return { frame: frameOf(parts), panel };
  }

  if (kind === 'ramp') {
    // The profile, in (z, y), wound so the first edge is the deck:
    //   A(-2, 0) → B(2, LEVEL)   the plane the collider walks, corner to corner
    //   B → C(2, LEVEL - 0.44)   the head's vertical face
    //   C → D(-1.48, 0)          the underside
    //   D → A                    the foot, flat on the level it was founded on
    const deck = { tone: TREAD, grip: 1 };
    const side = { tone: PLATE };
    const under = { tone: DARK };
    const parts = [
      prism([[-2, 0], [2, LEVEL], [2, LEVEL - 0.44], [-1.48, 0]], 2.0,
        [deck, under, under, under, side]),
      // the lit nosing at the foot: the one line that says "start here", and
      // what makes a ramp legible as a way up from across the plaza
      onSlope(3.30, 0.05, 0.12, -1.80, 0.025, GLOW, 1),
    ];
    // treads — eight of them, sunk into the deck rather than standing on it, so
    // the surface you see is within four millimetres of the surface you walk
    for (let i = 0; i < 8; i++) {
      parts.push(onSlope(3.40, 0.10, 0.30, -1.75 + i * 0.5, -0.046,
        i % 2 ? RAIL : DARK, 0, 1));
    }
    // kerbs down both edges, each with a lit inlay running up its top
    for (const sx of [-1, 1]) {
      const kerb = onSlope(0.30, 0.34, 4.90, 0, 0.17, RAIL);
      kerb.translate(sx * 1.85, 0, 0);
      const lamp = onSlope(0.12, 0.05, 4.70, 0, 0.365, GLOW, 1);
      lamp.translate(sx * 1.85, 0, 0);
      parts.push(kerb, lamp);
    }
    const panel = new THREE.PlaneGeometry(3.40, 5.30);
    panel.rotateX(-Math.PI / 2);
    panel.rotateX(-Math.PI / 4);
    panel.translate(0, 2 + 0.02 * SLOPE, -0.02 * SLOPE);
    return { frame: frameOf(parts), panel };
  }

  if (kind === 'vault') {
    // The vault plate: a deck with a coil in it. It tiles with a floor exactly —
    // same 4.00 square, same flat top at y = 0, same fascia — because it *is* a
    // deck. What makes it read as a machine from thirty metres is the sunken
    // dish and the four lit chevrons, and both of those sit inboard of the rim.
    const T = DECK_T;
    const parts = [
      bar(4.00, 0.12, 4.00, 0, -T + 0.06, 0, 0, PLATE),
      bar(4.00, 0.10, 4.00, 0, -0.11, 0, 0, PLATE),
      bar(3.90, 0.15, 0.26, 0, -T + 0.15, -1.05, 0, DARK),
      bar(3.90, 0.15, 0.26, 0, -T + 0.15, 1.05, 0, DARK),
      // the ring: heavier than a floor's fascia, because this one is a machine
      bar(4.00, 0.26, 0.30, 0, -0.22, -1.85),
      bar(4.00, 0.26, 0.30, 0, -0.22, 1.85),
      bar(0.30, 0.26, 3.40, -1.85, -0.22, 0),
      bar(0.30, 0.26, 3.40, 1.85, -0.22, 0),
      // the deck itself: four plates whose tops are exactly y = 0
      bar(1.86, 0.06, 1.86, -1.03, -0.03, -1.03, 0, TREAD, 0, 1),
      bar(1.86, 0.06, 1.86, 1.03, -0.03, -1.03, 0, TREAD, 0, 1),
      bar(1.86, 0.06, 1.86, -1.03, -0.03, 1.03, 0, TREAD, 0, 1),
      bar(1.86, 0.06, 1.86, 1.03, -0.03, 1.03, 0, TREAD, 0, 1),
      // the coil — three concentric lit rails sunk into the dish between them
      bar(1.90, 0.04, 1.90, 0, -0.05, 0, 0, GLOW, 1),
      bar(1.10, 0.05, 1.10, 0, -0.04, 0, 0, TREAD, 0, 1),
      bar(0.46, 0.06, 0.46, 0, -0.03, 0, 0, GLOW, 1),
    ];
    // four chevrons standing proud, well inboard of the rim: the way it sends you
    for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      parts.push(bar(sz ? 1.10 : 0.16, 0.26, sz ? 0.16 : 1.10,
        sx * 1.40, 0.10, sz * 1.40, 0, GLOW, 1));
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(bar(0.50, 0.24, 0.50, sx * 1.74, -0.25, sz * 1.74, 0, DARK));
      }
    }
    const panel = new THREE.PlaneGeometry(3.00, 3.00);
    panel.rotateX(-Math.PI / 2);
    panel.translate(0, 0.006, 0);
    return { frame: frameOf(parts), panel };
  }

  // beam — a truss, and the piece that becomes a balance at a rift. This one is
  // supposed to read as an open member: it is a lever, not a floor. Its top is
  // its level, half a storey up, so two rails on neighbouring faces meet in one
  // plane and a rail set from a deck lands where a handrail belongs.
  const parts = [
    bar(4.00, 0.12, WALL_T, 0, -0.06, 0),
    bar(4.00, 0.12, WALL_T, 0, -0.30, 0),
    bar(3.60, 0.09, 0.20, 0, -0.18, 0, 0, GLOW, 1),
  ];
  for (let i = -2; i <= 2; i++) parts.push(bar(0.14, 0.24, 0.26, i * 0.8, -0.18, 0, 0, DARK));
  for (const sx of [-1, 1]) {
    parts.push(bar(0.30, 0.36, WALL_T + 0.02, sx * 1.85, -0.18, 0, 0, DARK));
  }
  const panel = new THREE.PlaneGeometry(3.70, 0.30);
  panel.translate(0, -0.18, 0);
  return { frame: frameOf(parts), panel };
}

export { buildGeometry };
