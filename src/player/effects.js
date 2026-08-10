import * as THREE from 'three';
import { gradientAt } from './terrain.js';

/**
 * Movement effects that belong to the body.
 *
 * The thing these exist for is the *impact frame*: the single rendered instant
 * that tells you how much force a movement just cost. A jump without one is a
 * position change; a jump with one is a jump.
 *
 * Two things were previously wrong and both are fixed here. Point sprites sized
 * themselves with a hardcoded 360 constant, so on any high-DPR capture the dust
 * came out a quarter of its intended size and read as bokeh — sizes are now
 * derived from the real projection matrix and drawing buffer. And the dust went
 * *up*: a landing throws a ring outward along the ground, so the velocities are
 * now radial and flat with the vertical component reserved for the small
 * secondary puff that rises through it.
 */

function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.34, 'rgba(255,255,255,0.66)');
  grd.addColorStop(0.72, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath(); g.arc(32, 32, 32, 0, 6.284); g.fill();
  return new THREE.CanvasTexture(c);
}

/** A soft shockwave ring: bright inner lip, long feathered outer fade. */
function ringSprite() {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1;
      const r = Math.hypot(dx, dy);
      // ring profile: hard-ish leading lip at r=0.94, trailing dust to r=0.55
      let a = 0;
      if (r < 1) {
        const lip = Math.exp(-Math.pow((r - 0.93) / 0.055, 2));
        const tail = Math.max(0, (r - 0.5) / 0.45);
        a = Math.min(1, lip * 0.95 + tail * tail * 0.5);
        a *= 1 - Math.pow(Math.max(0, (r - 0.9) / 0.1), 2);
      }
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

/**
 * The mark atlas: 2×2 cells the ground decals index into.
 *
 *   0 boot print   1 soft scuff   2 skid streak   3 impact star
 *
 * Everything the feet leave behind on the world is one of these four, which is
 * what lets the whole system be a single draw call.
 */
function markAtlas() {
  const N = 256, H = N / 2;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.clearRect(0, 0, N, N);

  // --- 0,0  boot print: a sole with a heel, cut across by tread bars ---
  g.save(); g.translate(0, 0);
  g.fillStyle = '#fff';
  const sole = (x, y, w, h, r) => {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
  };
  g.globalAlpha = 1;
  sole(38, 16, 52, 62, 22);        // ball of the foot
  sole(44, 82, 40, 32, 14);        // heel
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 0.85;
  for (let i = 0; i < 4; i++) { g.fillRect(34, 26 + i * 14, 60, 5); }
  g.fillRect(34, 92, 60, 5);
  g.globalCompositeOperation = 'source-over';
  g.restore();

  // --- 1,0  soft scuff: a lopsided smear of disturbed ground ---
  {
    const grd = g.createRadialGradient(H + 64, 60, 4, H + 64, 60, 60);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.42)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(H + 64, 62, 56, 40, 0.35, 0, 6.284); g.fill();
  }

  // --- 0,1  skid streak: soft ploughed lines, fading at both ends ---
  {
    g.save();
    g.filter = 'blur(3px)';
    const grd = g.createLinearGradient(0, H, 0, N);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.30, 'rgba(255,255,255,0.62)');
    grd.addColorStop(0.85, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    for (let i = 0; i < 4; i++) {
      const x = 32 + i * 20 + (i % 2) * 6;
      g.globalAlpha = 0.45 + (i % 2) * 0.25;
      g.fillRect(x, H + 10, 11 - (i % 2) * 4, 106);
    }
    g.globalAlpha = 1;
    g.restore();
  }

  // --- 1,1  impact splash: a soft blown ring, no hard cracks ---
  {
    const cx = H + H / 2, cy = H + H / 2;
    g.save();
    g.filter = 'blur(4px)';
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 6.284 + 0.3;
      const r0 = 10, r1 = 30 + (i % 3) * 16;
      g.strokeStyle = `rgba(255,255,255,${0.30 + (i % 2) * 0.16})`;
      g.lineWidth = 9 - (i % 3) * 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.stroke();
    }
    const grd = g.createRadialGradient(cx, cy, 2, cx, cy, 46);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(cx, cy, 46, 0, 6.284); g.fill();
    g.restore();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MARK_VERT = /* glsl */`
  attribute float aFade;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vUv = uv; vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const MARK_FRAG = /* glsl */`
  uniform sampler2D map;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    float a = texture2D(map, vUv).a * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Ground marks: everything the cadet leaves behind.
 *
 * The single loudest thing missing from this game was that a body moving at
 * eleven metres a second across a plaza left the plaza exactly as it found it.
 * Dust that vanishes in half a second is not contact — contact is a mark that
 * is still there when you look back.
 *
 * One buffer of N quads, written on the CPU when a mark is laid and faded on
 * the GPU: one draw call for every footprint, skid and crater on the island.
 */
class Marks {
  constructor(scene, n = 96) {
    this.n = n;
    this.pos = new Float32Array(n * 4 * 3);
    this.uv = new Float32Array(n * 4 * 2);
    this.fade = new Float32Array(n * 4);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.head = 0;

    const idx = new Uint16Array(n * 6);
    for (let i = 0; i < n; i++) {
      const v = i * 4, o = i * 6;
      idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2;
      idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setAttribute('aFade', new THREE.BufferAttribute(this.fade, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;

    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: markAtlas() }, uColor: { value: new THREE.Color(0x40352a) } },
      vertexShader: MARK_VERT, fragmentShader: MARK_FRAG,
      transparent: true, depthWrite: false, depthTest: true,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, this.mat);
    m.frustumCulled = false;
    m.renderOrder = 2;
    m.userData.noCamBlock = true;
    scene.add(m);
    this.mesh = m;
  }

  /**
   * Lay one mark, flat on the ground and tilted into the slope under it.
   * `cell` indexes the atlas, `ang` is the world yaw the mark points along.
   */
  add(x, y, z, ang, w, l, cell, life, alpha) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    const g = gradientAt(x, z);
    // the quad's own basis: forward along `ang`, right across it, both lying in
    // the tangent plane of the terrain so a print on a hillside is on the hill.
    // The slope is clamped: on a cliff face the unclamped tangent turns a
    // 30cm print into a two-metre black spike shooting out of the hill.
    const gx = Math.max(-0.7, Math.min(0.7, g.x));
    const gz = Math.max(-0.7, Math.min(0.7, g.y));
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const fx = sa, fz = ca;
    const rx = ca, rz = -sa;
    const fy = -(gx * fx + gz * fz);
    const ry = -(gx * rx + gz * rz);
    const hw = w * 0.5, hl = l * 0.5;
    const p = this.pos, base = i * 12;
    const corners = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
    for (let k = 0; k < 4; k++) {
      const [cw, cl] = corners[k];
      p[base + k * 3] = x + rx * cw + fx * cl;
      p[base + k * 3 + 1] = y + ry * cw + fy * cl + 0.025;
      p[base + k * 3 + 2] = z + rz * cw + fz * cl;
    }
    const cu = (cell % 2) * 0.5, cv = (cell < 2 ? 0.5 : 0.0);
    const uv = this.uv, ub = i * 8;
    uv[ub] = cu; uv[ub + 1] = cv;
    uv[ub + 2] = cu + 0.5; uv[ub + 3] = cv;
    uv[ub + 4] = cu + 0.5; uv[ub + 5] = cv + 0.5;
    uv[ub + 6] = cu; uv[ub + 7] = cv + 0.5;
    this.life[i] = life; this.maxLife[i] = life; this.a0[i] = alpha;
    for (let k = 0; k < 4; k++) this.fade[i * 4 + k] = alpha;
    this._dirty = true;
  }

  update(dt) {
    let live = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      live = true;
      this.life[i] -= dt;
      const u = Math.max(0, this.life[i]) / this.maxLife[i];
      // holds its value, then goes: a print should look permanent until it isn't
      const a = this.a0[i] * Math.min(1, u * 3.2) * (0.35 + 0.65 * u);
      for (let k = 0; k < 4; k++) this.fade[i * 4 + k] = a;
    }
    if (live || this._dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.uv.needsUpdate = true;
      this.geo.attributes.aFade.needsUpdate = true;
      this._dirty = false;
    }
  }
}

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(0.25, -mv.z);
    // A puff that swallows the lens is not an effect, it is a bug. Sprites fade
    // out as they approach the near plane and their screen size is capped, so
    // an impact ring the camera happens to be standing in stays an impact ring.
    vAlpha = aAlpha * smoothstep(1.1, 3.0, d);
    gl_PointSize = clamp(aSize * uScale / d, 1.0, 190.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(map, gl_PointCoord).a * vAlpha;
    if (a < 0.006) discard;
    gl_FragColor = vec4(vColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class Pool {
  constructor(scene, tex, n, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.head = 0;
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -9999;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    // 900 is a placeholder; PlayerFX rewrites it from the real framebuffer every
    // frame, which is the whole point — a constant here is a DPR bug waiting.
    this.uScale = { value: 900 };
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: this.uScale },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = additive ? 4 : 3;
    scene.add(pts);
    this.geo = g;
  }

  emit(x, y, z, n, o) {
    const ring = o.ring || 0;         // 0 = puff, 1 = flat radial ring
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % this.n;
      const a = ring ? (k / n) * Math.PI * 2 + Math.random() * 0.5 : Math.random() * Math.PI * 2;
      const r = (ring ? 0.6 + Math.random() * 0.5 : Math.sqrt(Math.random())) * o.spread;
      const ca = Math.cos(a), sa = Math.sin(a);
      this.pos[i * 3] = x + ca * r;
      this.pos[i * 3 + 1] = y + (o.rise || 0) * Math.random();
      this.pos[i * 3 + 2] = z + sa * r;
      const outv = o.out * (ring ? 0.7 + Math.random() * 0.6 : 0.35 + Math.random());
      this.vel[i * 3] = ca * outv + (o.dx || 0);
      this.vel[i * 3 + 1] = o.up * (ring ? 0.15 + Math.random() * 0.5 : 0.3 + Math.random());
      this.vel[i * 3 + 2] = sa * outv + (o.dz || 0);
      this.size[i] = o.size * (0.6 + Math.random() * 0.8);
      this.col[i * 3] = o.c[0]; this.col[i * 3 + 1] = o.c[1]; this.col[i * 3 + 2] = o.c[2];
      this.alpha[i] = o.alpha ?? 0.8;
      this.life[i] = o.life * (0.7 + Math.random() * 0.6);
      this.maxLife[i] = this.life[i];
      this.grav[i] = o.grav ?? 1.8;
      this.grow[i] = o.growth ?? 1.5;
    }
  }

  update(dt) {
    const { pos, vel, life, maxLife, alpha, size, grow } = this;
    let live = false;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      live = true;
      life[i] -= dt;
      if (life[i] <= 0) { pos[i * 3 + 1] = -9999; alpha[i] = 0; continue; }
      const k = life[i] / maxLife[i];
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const drag = 1 - Math.min(0.9, 3.1 * dt);
      vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
      vel[i * 3 + 1] -= this.grav[i] * dt;
      // dust holds its body, then goes quickly at the end — k^0.6 fade-in of
      // transparency, not a linear ramp that makes everything look like smoke
      alpha[i] = Math.min(1, k * 1.9) * k * 0.95;
      size[i] *= 1 + dt * grow[i];
    }
    if (live || this._wasLive) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
    }
    this._wasLive = live;
  }
}

export class PlayerFX {
  constructor(scene, renderer = null, camera = null) {
    const tex = softSprite();
    this.renderer = renderer;
    this.camera = camera;
    this.dust = new Pool(scene, tex, 300, false);
    this.spark = new Pool(scene, tex, 200, true);
    // grit: hard little chips of ground, thrown and *not* grown. Dust says the
    // air moved; grit says the ground did.
    this.grit = new Pool(scene, tex, 160, false);
    this.marks = new Marks(scene, 96);
    this._skidGap = 0;

    // ---- shockwaves: soft textured discs laid flat on the ground ----
    const ringTex = ringSprite();
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({
        map: ringTex, color: 0xf2e7d2, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.NormalBlending,
      }));
      m.visible = false; m.renderOrder = 3;
      scene.add(m);
      this.rings.push({ m, t: 0, dur: 1, s0: 1, s1: 4, add: false, a0: 0.85 });
    }
    this._ringTex = ringTex;
    this._quad = quad;

    // ---- landing marker ----
    // Falling out of the sky with no idea where you are going to hit is the one
    // thing that makes altitude feel like a cutscene instead of a decision. This
    // is the ballistic answer, drawn flat on the ground where the boots will
    // land, and it is what turns a glide into something you *aim*.
    this.markMat = new THREE.MeshBasicMaterial({
      map: ringTex, color: 0x9ff0ff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mark = new THREE.Mesh(quad, this.markMat);
    this.mark.visible = false;
    this.mark.renderOrder = 5;
    this.mark.userData.noCamBlock = true;
    scene.add(this.mark);
    this._markA = 0;
    this._markT = 0;

    // ---- contact patch ----
    //
    // The cadet has a real cast shadow now (see world.js and terrain.js) and
    // this is emphatically not a replacement for it: at a 22° sun that shadow
    // is thrown two and a half body-lengths *down-sun*, which is the correct
    // place for it and the wrong place to read your own altitude from. So this
    // is the second half of the same instrument — a soft occlusion patch
    // directly under the boots, which is where the ground contact actually is.
    //
    // Grounded it is a tight dark contact, the ambient occlusion a body makes
    // against the ground it is standing on. Leaving the ground it widens and
    // pales with height, so the gap between the patch's softness and the cast
    // shadow's distance is a continuous altimeter from nought to six metres —
    // under the 4.5 m at which the ballistic landing ring takes over.
    this.contactMat = new THREE.MeshBasicMaterial({
      map: tex, color: 0x0a1220, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.contact = new THREE.Mesh(quad, this.contactMat);
    this.contact.visible = false;
    this.contact.renderOrder = 1;
    this.contact.userData.noCamBlock = true;
    scene.add(this.contact);
    this._contactA = 0;
  }

  /**
   * The occlusion patch under his boots.
   *
   * @param {number} x,z   where he is
   * @param {number} gy    the ground height under him, or null off the island
   * @param {number} agl   metres between his soles and that ground
   */
  contactPatch(x, gy, z, agl, dt) {
    if (gy === null || gy === undefined || agl > 6.5) {
      this._contactA += (0 - this._contactA) * Math.min(1, dt * 8);
    } else {
      // full weight on contact, a third of it at head height, gone by six metres
      const want = 1 - Math.min(1, Math.max(0, agl) / 6.5) ** 0.7;
      this._contactA += (want - this._contactA) * Math.min(1, dt * 14);
    }
    if (this._contactA < 0.01) {
      if (this.contact.visible) { this.contact.visible = false; this.contactMat.opacity = 0; }
      return;
    }
    this.contact.visible = true;
    this.contact.position.set(x, gy + 0.045, z);
    // it spreads as he climbs, exactly the way a real contact shadow's penumbra
    // does, so width alone reads as height
    const s = 0.86 + Math.min(6.5, Math.max(0, agl)) * 0.30;
    this.contact.scale.set(s, 1, s * 0.92);
    this.contactMat.opacity = this._contactA * 0.5;
  }

  /** Show (or fade out) the predicted touchdown ring. */
  landingMark(hit, strength, dt) {
    this._markT += dt;
    this._markA += ((hit ? strength : 0) - this._markA) * Math.min(1, dt * 6);
    if (this._markA < 0.008) {
      if (this.mark.visible) { this.mark.visible = false; this.markMat.opacity = 0; }
      return;
    }
    if (hit) this.mark.position.set(hit.x, hit.y + 0.09, hit.z);
    this.mark.visible = true;
    const pulse = 1 + Math.sin(this._markT * 5.2) * 0.06;
    const s = (2.6 + this._markA * 1.6) * pulse;
    this.mark.scale.set(s, 1, s);
    this.markMat.opacity = this._markA * 0.85;
  }

  /** Point sprites must be sized from the *real* framebuffer, not a constant. */
  _sync() {
    const r = this.renderer, c = this.camera;
    if (!r || !c) return;
    const h = r.getDrawingBufferSize ? r.getDrawingBufferSize(_sz).y : 900;
    // proj[1][1] = 1/tan(fov/2); a sphere of world radius R at distance d covers
    // R * proj11 * h / d pixels. That is exactly the point size we want.
    const s = c.projectionMatrix.elements[5] * h * 0.5;
    this.dust.uScale.value = s;
    this.spark.uScale.value = s;
    this.grit.uScale.value = s;
  }

  /**
   * A footfall.
   *
   * Four things happen at once and they are all necessary: a print pressed into
   * the ground that stays there, a flat scuff of dust thrown *backwards* out
   * from under the sole, a handful of grit that arcs and falls, and — above a
   * walk — a thin shock ring at the point of contact. A step that only emits
   * three dust sprites is the thing the critic saw and correctly called nothing.
   */
  step(x, y, z, power, dx, dz, ang = 0) {
    const p = Math.max(0, Math.min(1, power));
    // the print. Sprint prints are deeper and last longer than a walk's.
    this.marks.add(x, y, z, ang, 0.30, 0.44, 0, 7.0 + p * 7.0, 0.26 + p * 0.26);
    // The scuff: thrown backwards out from under the sole, and — the thing this
    // got wrong for three rounds — thrown *up*. The island's meadow stands a
    // metre tall. Dust emitted at ankle height with 0.4 m/s of lift never
    // reaches the top of a blade of grass, so a sprint across the whole island
    // produced, on screen, exactly nothing. It has to clear the canopy or it
    // does not exist.
    this.dust.emit(x - dx * 0.10, y + 0.12, z - dz * 0.10, 5 + Math.round(p * 8), {
      spread: 0.14, out: 0.9 + p * 1.6, up: 0.85 + p * 1.35,
      size: 0.13 + p * 0.15, life: 0.34 + p * 0.30,
      c: [0.87, 0.82, 0.72], alpha: 0.24 + p * 0.28,
      dx: -dx * (1.6 + p * 3.4), dz: -dz * (1.6 + p * 3.4), grav: 1.0, growth: 1.5, ring: 0,
    });
    if (p > 0.28) {
      // grit: small, dark, heavy, thrown back along the run
      this.grit.emit(x, y + 0.05, z, 2 + Math.round(p * 5), {
        spread: 0.09, out: 0.8 + p * 1.6, up: 1.4 + p * 2.4,
        size: 0.045 + p * 0.030, life: 0.42 + p * 0.24,
        c: [0.44, 0.38, 0.30], alpha: 0.95,
        dx: -dx * (2.4 + p * 4.5), dz: -dz * (2.4 + p * 4.5), grav: 9.5, growth: 0,
      });
    }
    if (p > 0.45) {
      // the contact itself: a fast, small, low ring under the sole
      this.ring(x, y, z, {
        s0: 0.25, s1: 0.85 + p * 0.75, dur: 0.20 + p * 0.10,
        color: 0xf3ead9, a0: 0.14 + p * 0.20,
      });
    }
  }

  /**
   * Touchdown. `power` 0..1 by fall height. This is the money frame: a flat
   * ring of dust racing outward along the ground, a slower column of it rising
   * through the middle, a hard bright shock lip and a soft trailing one.
   */
  land(x, y, z, power, ang = 0) {
    // More sprites, each fainter and larger, so the ring overlaps into one cloud
    // instead of resolving into a necklace of separate white beads.
    const n = 26 + Math.round(power * 48);
    // the crater stays. Two boot prints under an impact star, scaled by how
    // hard he arrived — this is the evidence that a landing happened here.
    this.marks.add(x, y, z, ang, 1.4 + power * 2.4, 1.4 + power * 2.4, 3,
      7 + power * 9, 0.20 + power * 0.30);
    for (const s of [-1, 1]) {
      this.marks.add(x + Math.cos(ang) * 0.13 * s, y, z - Math.sin(ang) * 0.13 * s,
        ang, 0.32, 0.46, 0, 8 + power * 8, 0.30 + power * 0.24);
    }
    this.grit.emit(x, y + 0.10, z, 6 + Math.round(power * 22), {
      ring: 1, spread: 0.3, out: 2.4 + power * 7.5, up: 2.6 + power * 5.2,
      size: 0.05 + power * 0.04, life: 0.5 + power * 0.4,
      c: [0.45, 0.39, 0.31], alpha: 0.95, grav: 10, growth: 0,
    });
    // The ring: outward along the ground, but with enough lift to climb out of
    // the grass. A flat ring in a metre-tall meadow is an effect nobody sees.
    this.dust.emit(x, y + 0.16, z, n, {
      ring: 1, spread: 0.32 + power * 0.45, out: 3.6 + power * 7.0, up: 1.25 + power * 1.7,
      size: 0.23 + power * 0.26, life: 0.58 + power * 0.52,
      c: [0.88, 0.84, 0.75], alpha: 0.26 + power * 0.15, grav: 1.25, growth: 2.0,
    });
    // the column: slower, taller, catches the light. This is the part that is
    // still standing a second later and tells you how hard he arrived. It has to
    // clear a metre of grass and stop — a plume that reaches the top of the
    // frame is not weight, it is a fog machine, and it hides the world.
    this.dust.emit(x, y + 0.26, z, 7 + Math.round(power * 10), {
      spread: 0.28, out: 0.9, up: 2.5 + power * 2.6,
      size: 0.22 + power * 0.24, life: 0.80 + power * 0.55,
      c: [0.93, 0.90, 0.82], alpha: 0.28 + power * 0.16, grav: 1.35, growth: 1.7,
    });
    if (power > 0.25) {
      // a slow billow that outlives everything else — the thing that makes a
      // two-storey drop read as a two-storey drop from six metres away
      this.dust.emit(x, y + 0.45, z, 3 + Math.round(power * 6), {
        spread: 0.55 + power * 0.7, out: 1.4 + power * 2.0, up: 1.4 + power * 1.7,
        size: 0.30 + power * 0.30, life: 1.1 + power * 0.8,
        c: [0.95, 0.92, 0.85], alpha: 0.13 + power * 0.10, grav: 0.75, growth: 1.1,
      });
      this.spark.emit(x, y + 0.16, z, 4 + Math.round(power * 10), {
        ring: 1, spread: 0.3, out: 3.4 + power * 6, up: 2.2 + power * 2.8,
        size: 0.11, life: 0.3 + power * 0.28, c: [1.0, 0.86, 0.6], alpha: 0.9,
        grav: 7, growth: 0.2,
      });
    }
    this.ring(x, y, z, { s0: 0.9, s1: 3.4 + power * 7.5, dur: 0.44 + power * 0.34, color: 0xf6ecd8, a0: 0.55, lift: 0.11 + power * 0.13 });
    this.ring(x, y, z, { s0: 0.6, s1: 2.2 + power * 4.0, dur: 0.30 + power * 0.2, color: 0xd8f0ff, add: true, a0: 0.30 + power * 0.30, lift: 0.15 + power * 0.15 });
  }

  jump(x, y, z, power = 1, ang = 0) {
    // the push-off is scored into the ground too: two prints and a scuff
    for (const s of [-1, 1]) {
      this.marks.add(x + Math.cos(ang) * 0.12 * s, y, z - Math.sin(ang) * 0.12 * s,
        ang, 0.32, 0.46, 0, 8, 0.26);
    }
    this.marks.add(x, y, z, ang, 0.95, 0.95, 1, 5, 0.16);
    this.grit.emit(x, y + 0.08, z, 8, {
      ring: 1, spread: 0.2, out: 2.0, up: 3.2, size: 0.05, life: 0.45,
      c: [0.45, 0.39, 0.31], alpha: 0.9, grav: 10, growth: 0,
    });
    this.dust.emit(x, y + 0.14, z, 9 + Math.round(power * 8), {
      ring: 1, spread: 0.22, out: 2.6, up: 1.9, size: 0.28, life: 0.52,
      c: [0.87, 0.83, 0.74], alpha: 0.5, grav: 1.1, growth: 2.0,
    });
    this.ring(x, y, z, { s0: 0.5, s1: 3.0, dur: 0.34, color: 0xeee6d6, a0: 0.6, lift: 0.16 });
  }

  /** Air jump: a cyan disc of pushed-off nothing. */
  airJump(x, y, z) {
    this.spark.emit(x, y + 0.9, z, 22, {
      ring: 1, spread: 0.45, out: 5.2, up: -0.5, size: 0.24, life: 0.42,
      c: [0.6, 0.94, 1.0], alpha: 0.95, grav: 0.5, growth: 1.0,
    });
    this.ring(x, y + 0.85, z, { s0: 0.4, s1: 3.8, dur: 0.4, color: 0x8fe9ff, add: true, a0: 0.75 });
  }

  dash(x, y, z, dx, dz) {
    this.spark.emit(x, y + 0.9, z, 26, {
      spread: 0.32, out: 1.2, up: 0.25, size: 0.22, life: 0.32,
      c: [0.66, 0.95, 1.0], alpha: 0.95, dx: -dx * 8, dz: -dz * 8, grav: 0.2, growth: 0.6,
    });
    this.dust.emit(x, y + 0.06, z, 8, {
      ring: 1, spread: 0.2, out: 2.2, up: 0.4, size: 0.24, life: 0.36,
      c: [0.86, 0.82, 0.74], alpha: 0.5, grav: 1.4, growth: 2.4,
    });
  }

  /** The wing catching air: a burst of pressure off the trailing edge. */
  glideOpen(x, y, z) {
    // pressure off the trailing edge, not a smoke machine: a thin bright ring
    // that flashes and is gone before the canopy has finished filling
    this.spark.emit(x, y + 2.4, z, 20, {
      ring: 1, spread: 1.9, out: 6.0, up: 0.25, size: 0.13, life: 0.30,
      c: [1.0, 0.86, 0.62], alpha: 0.75, grav: 0.3, growth: 0.8,
    });
  }

  /**
   * Feet ploughing: a continuous plume behind the boots, grit flicking out of
   * it, and a pair of streaks scored into the ground that outlive the stop.
   */
  slide(x, y, z, dx, dz, power, dt = 0, ang = 0) {
    // A plume, not a smudge: it has to stand above the grass behind him, which
    // is the whole reason a stop reads as a stop and not as a state change.
    this.dust.emit(x, y + 0.14, z, 3, {
      spread: 0.20, out: 1.1, up: 1.5 + power * 1.7, size: 0.20 + power * 0.16, life: 0.55,
      c: [0.87, 0.82, 0.73], alpha: 0.26 + power * 0.30,
      dx: -dx * 3.4, dz: -dz * 3.4, grav: 0.95, growth: 2.0,
    });
    if (power > 0.35 && Math.random() < 0.55) {
      this.grit.emit(x, y + 0.06, z, 2, {
        spread: 0.12, out: 1.2, up: 2.0 + power * 2.4,
        size: 0.05, life: 0.4, c: [0.44, 0.38, 0.30], alpha: 0.9,
        dx: -dx * (3 + power * 4), dz: -dz * (3 + power * 4), grav: 10, growth: 0,
      });
    }
    // streaks are laid at a fixed spacing along the ground, not per frame, so
    // the trail is the same length whatever the frame rate is
    this._skidGap -= dt;
    if (dt > 0 && this._skidGap <= 0) {
      this._skidGap = 0.055;
      for (const s of [-1, 1]) {
        this.marks.add(x + Math.cos(ang) * 0.12 * s, y, z - Math.sin(ang) * 0.12 * s,
          ang, 0.24, 0.75, 2, 6 + power * 6, 0.20 + power * 0.26);
      }
    }
  }

  /** `lift` floats the disc above the ground — enough to clear tall grass. */
  ring(x, y, z, opt = {}) {
    const { color = 0xf0e6d4, s0 = 0.6, s1 = 4.2, dur = 0.5, add = false, a0 = 0.8, lift = 0 } = opt;
    let best = this.rings[0], bt = best.t;
    for (const r of this.rings) if (r.t < bt) { best = r; bt = r.t; }
    best.t = dur; best.dur = dur; best.s0 = s0; best.s1 = s1; best.a0 = a0;
    best.m.position.set(x, y + 0.055 + lift, z);
    best.m.rotation.y = Math.random() * 6.28;
    best.m.material.color.setHex(color);
    best.m.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
    best.m.material.needsUpdate = true;
    best.m.visible = true;
  }

  update(dt) {
    this._sync();
    this.dust.update(dt);
    this.spark.update(dt);
    this.grit.update(dt);
    this.marks.update(dt);
    for (const r of this.rings) {
      if (r.t <= 0) { if (r.m.visible) r.m.visible = false; continue; }
      r.t -= dt;
      const u = 1 - Math.max(0, r.t) / r.dur;
      const e = 1 - Math.pow(1 - u, 2.8);
      const sc = r.s0 + (r.s1 - r.s0) * e;
      r.m.scale.set(sc, 1, sc);
      r.m.material.opacity = Math.max(0, r.a0 * (1 - u) * (1 - u * 0.55));
      if (r.t <= 0) r.m.visible = false;
    }
  }
}

const _sz = new THREE.Vector2();
