import * as THREE from 'three';
import { fbm, clamp, sstep, GLSL_NOISE } from './noise.js';
import {
  sampleH, sampleSlope, moistAt, underWater, grassDensityAt, ISLAND_R, LAKE,
} from './terrain.js';
import { zoneWeights, blendSlot } from './biomes.js';

/**
 * Wind-blown ground cover.
 *
 * Real blades — tapered, curved, lit with a wrap term and a translucent
 * back-light so the field lights up when the sun is behind it — not textured
 * cards.
 *
 * Density, colour and height are baked once into a coarse field. Every time
 * the camera moves far enough, the blades in range are re-generated straight
 * into the instance buffers from that field, so the meadow is thick where you
 * are standing and costs nothing anywhere else.
 */

const DCELL = 2.2;

function bladeGeometry() {
  const rows = [0, 0.42, 0.74];
  const pos = [];
  const tv = [];
  for (const t of rows) {
    const w = Math.pow(1 - t, 0.75) * 0.5;
    pos.push(-w, t, 0, w, t, 0);
    tv.push(t, t);
  }
  pos.push(0, 1, 0); tv.push(1);
  const idx = [];
  for (let r = 0; r < rows.length - 1; r++) {
    const a = r * 2, b = a + 2;
    idx.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const last = (rows.length - 1) * 2;
  idx.push(last, last + 1, rows.length * 2);

  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tv, 1));
  g.setIndex(idx);
  return g;
}

function hashf(a, b) {
  let h = (Math.imul(a | 0, 668265263) ^ Math.imul(b | 0, 374761393)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function createGrass(scene, sunDir, quality) {
  const hi = quality > 0.6;
  const MAX = hi ? 20000 : 6200;
  const REACH = hi ? 44 : 30;
  const PERCELL = hi ? 26 : 10;      // blades per 2.2 x 2.2 m cell at full density

  // ------------------------------------------------------------ the field
  const DN = Math.ceil((ISLAND_R * 2) / DCELL) + 1;
  const dens = new Uint8Array(DN * DN);
  const tint = new Uint8Array(DN * DN * 3);
  const hgtF = new Uint8Array(DN * DN);
  const bladeA = [0, 0, 0], bladeB = [0, 0, 0];

  for (let j = 0; j < DN; j++) {
    const z = -ISLAND_R + j * DCELL;
    for (let i = 0; i < DN; i++) {
      const x = -ISLAND_R + i * DCELL;
      const c = j * DN + i;
      const h = sampleH(x, z);
      if (h === null) continue;
      const sl = sampleSlope(x, z);
      if (sl > 0.86) continue;
      if (underWater(x, z, 0.2)) continue;
      const m = moistAt(x, z);
      const dLake = Math.hypot(x - LAKE.x, z - LAKE.z);

      // The blades and the ground under them read the *same* density field, so
      // the meadow never stops at the edge of the instancing radius.
      const d = grassDensityAt(x, z, h, sl);
      if (d < 0.02) continue;

      const reed = dLake < LAKE.r * 1.4 && h < LAKE.y + 3.0;
      // colour comes from the region, so a blade is always the colour of the
      // ground it grows out of
      const w = zoneWeights(x, z);
      blendSlot(w, 'blade', bladeA);
      blendSlot(w, 'blade2', bladeB);
      const t1 = sstep(0.35, 0.80, fbm(x * 0.017 + 61, z * 0.017 - 23, 3));
      const dry = clamp(1 - m * 1.25, 0, 1) * 0.45;
      let cr = bladeA[0] + (bladeB[0] - bladeA[0]) * t1;
      let cg = bladeA[1] + (bladeB[1] - bladeA[1]) * t1;
      let cb = bladeA[2] + (bladeB[2] - bladeA[2]) * t1;
      cr += (0.66 - cr) * dry; cg += (0.56 - cg) * dry; cb += (0.26 - cb) * dry;

      dens[c] = Math.round(d * 255);
      tint[c * 3] = Math.round(clamp(cr, 0, 1) * 255);
      tint[c * 3 + 1] = Math.round(clamp(cg, 0, 1) * 255);
      tint[c * 3 + 2] = Math.round(clamp(cb, 0, 1) * 255);
      // 0..255 maps to 0..2.4 m; reeds by the water are the tall ones
      const hh = (reed ? 1.15 : 0.34) * (1 + m * 0.5);
      hgtF[c] = Math.min(255, Math.round((hh / 2.4) * 255));
    }
  }

  // ------------------------------------------------------------ gpu buffers
  const geo = bladeGeometry();
  const aOff = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  const aPar = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  const aCol = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  for (const a of [aOff, aPar, aCol]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aOffset', aOff);
  geo.setAttribute('aParam', aPar);
  geo.setAttribute('aColor', aCol);
  geo.instanceCount = 0;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSun: { value: sunDir.clone() },
      uSunCol: { value: new THREE.Color(0xffd9a8) },
      uSkyCol: { value: new THREE.Color(0x7fa8e0) },
      uCam: { value: new THREE.Vector3() },
      uReach: { value: REACH },
      uWind: { value: new THREE.Vector2(0.86, 0.51) },
      // The sun's own shadow map. The meadow is the surface the cadet actually
      // stands on for most of the game, and a hand-written blade shader is
      // outside three's lighting entirely — so until this existed his shadow
      // stopped dead at the edge of the grass, which is to say everywhere.
      uShadowMap: { value: null },
      uShadowMat: { value: new THREE.Matrix4() },
      uShadowTexel: { value: 1 / 2048 },
      uShadowOn: { value: 0 },
    },
  ]);

  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute float aT;
      attribute vec3 aOffset;
      attribute vec4 aParam;   // rot, height, width, phase
      attribute vec3 aColor;
      uniform float uTime;
      uniform vec3 uCam;
      uniform float uReach;
      uniform vec2 uWind;
      varying vec3 vCol;
      varying float vT;
      varying float vFlower;
      varying vec3 vNrm;
      varying vec3 vView;
      varying vec3 vWP;
      #include <fog_pars_vertex>
      void main(){
        float rot = aParam.x, hgt = aParam.y, wid = aParam.z;
        // a negative phase flags a flower head; the magnitude is still the phase
        vFlower = step(aParam.w, 0.0);
        float ph = abs(aParam.w);
        float t = aT;

        float d = distance(uCam.xz, aOffset.xz);
        // fx: fade width with height. Shrinking only the height leaves a flat
        // horizontal sliver lying on the ground, which from a high camera is a
        // field of one-pixel coloured specks — it reads as confetti, not grass.
        float lod = 1.0 - smoothstep(uReach * 0.72, uReach, d);
        hgt *= lod;
        wid *= lod;

        // a coherent gust rolling across the whole meadow, plus per-blade flutter
        float gust = sin(uTime * 0.55 + (aOffset.x * uWind.x + aOffset.z * uWind.y) * 0.045);
        float flut = sin(uTime * 2.7 + ph * 6.28 + aOffset.x * 0.35);
        float bend = (0.26 + 0.40 * (gust * 0.5 + 0.5)) + flut * 0.11;
        float k = pow(t, 1.7) * bend;

        float cr = cos(rot), sr = sin(rot);
        vec3 w = vec3(position.x * wid * cr, t * hgt, position.x * wid * sr);
        w.xz += uWind * (k * hgt);
        w.y -= k * k * hgt * 0.42;

        vec3 world = aOffset + w;
        vec4 mvPosition = modelViewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        vCol = aColor;
        vT = t;
        vNrm = normalize(vec3(-sr, 0.62, cr));
        vView = normalize(cameraPosition - world);
        vWP = world;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      uniform vec3 uSun, uSunCol, uSkyCol;
      uniform float uTime;
      uniform sampler2D uShadowMap;
      uniform mat4 uShadowMat;
      uniform float uShadowTexel, uShadowOn;
      varying vec3 vCol;
      varying float vT;
      varying float vFlower;
      varying vec3 vNrm;
      varying vec3 vView;
      varying vec3 vWP;
      #include <packing>
      #include <fog_pars_fragment>

      /**
       * One tap of the sun's own shadow map, unpacked the way three packs it.
       *
       * Deliberately not a PCF kernel. There are twenty thousand double-sided
       * blades in front of this camera and the field is nearly all overdraw,
       * so every extra tap here is measured in whole milliseconds — four of
       * them cost the frame a third of its headroom. One tap is enough
       * because the *field* is the filter: neighbouring blades resolve the
       * edge far more convincingly than a filtered lookup on a single one.
       * Outside the volume it returns 1 — lit — so the far meadow never goes
       * black when the box is drawn tight around the player.
       */
      float sunShadow(vec3 wp) {
        if (uShadowOn < 0.5) return 1.0;
        vec4 c = uShadowMat * vec4(wp, 1.0);
        vec3 s = c.xyz / c.w;
        if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
        return step(s.z - 0.0016, unpackRGBAToDepth(texture2D(uShadowMap, s.xy)));
      }

      void main(){
        vec3 n = normalize(vNrm);
        if (!gl_FrontFacing) n = -n;
        // a flower is a coloured head on a green stem, never a coloured blade
        vec3 base = mix(vCol, mix(vec3(0.17, 0.31, 0.13), vCol, smoothstep(0.58, 0.90, vT)), vFlower);
        float wrap = clamp(dot(n, uSun) * 0.5 + 0.5, 0.0, 1.0);
        vec2 cq = vWP.xz * 0.0042 + vec2(uTime * 0.0072, uTime * 0.0043);
        float cShade = mix(0.55, 1.0, smoothstep(0.30, 0.70, aa_n(cq)));
        // A blade is sampled a little above its own root, or the ground it
        // grows out of shadows it at every step of the bias.
        float sun = sunShadow(vWP + vec3(0.0, 0.03, 0.0));
        // Same rule the ground obeys: what blocks the sun also blocks its share
        // of the sky, so a blade inside a shadow loses fill as well as key.
        float amb = mix(0.44, 1.0, sun);
        vec3 col = base * (uSkyCol * (0.34 + 0.22 * vT) * amb + uSunCol * wrap * 1.15 * cShade * sun);
        float back = pow(clamp(dot(vView, -uSun) * 0.5 + 0.5, 0.0, 1.0), 3.0);
        col += base * uSunCol * back * 0.95 * vT * cShade * sun;
        col *= mix(0.40, 1.08, smoothstep(0.0, 0.55, vT));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ------------------------------------------------------------ generation
  const offA = aOff.array, parA = aPar.array, colA = aCol.array;
  const last = new THREE.Vector3(1e9, 0, 1e9);
  let lastCount = 0;

  function pack(cam) {
    const span = Math.ceil(REACH / DCELL);
    const ci = Math.floor((cam.x + ISLAND_R) / DCELL);
    const cj = Math.floor((cam.z + ISLAND_R) / DCELL);
    const r2 = REACH * REACH;
    let n = 0;
    for (let j = cj - span; j <= cj + span && n < MAX; j++) {
      if (j < 0 || j >= DN) continue;
      for (let i = ci - span; i <= ci + span && n < MAX; i++) {
        if (i < 0 || i >= DN) continue;
        const c = j * DN + i;
        const d = dens[c];
        if (!d) continue;
        const bx = -ISLAND_R + i * DCELL, bz = -ISLAND_R + j * DCELL;
        const ddx = bx - cam.x, ddz = bz - cam.z;
        const dd2 = ddx * ddx + ddz * ddz;
        if (dd2 > r2) continue;
        // Thin the field out with distance instead of running out of budget
        // half way through the loop — which used to leave the far half of the
        // meadow bald because the packer simply hit MAX and stopped.
        const thin = 1 - 0.62 * sstep(0.30, 1.0, Math.sqrt(dd2) / REACH);
        const cnt = Math.round((d / 255) * PERCELL * thin);
        if (cnt < 1) continue;
        const cr = tint[c * 3] / 255, cg = tint[c * 3 + 1] / 255, cb = tint[c * 3 + 2] / 255;
        const hbase = (hgtF[c] / 255) * 2.4;
        for (let k = 0; k < cnt && n < MAX; k++) {
          const r1 = hashf(c * 31 + k, 7717);
          const r2b = hashf(c * 17 + k, 9931);
          const r3 = hashf(c * 53 + k, 4421);
          const x = bx + r1 * DCELL, z = bz + r2b * DCELL;
          const h = sampleH(x, z);
          if (h === null) continue;
          const o = n * 3, q = n * 4;
          offA[o] = x; offA[o + 1] = h - 0.05; offA[o + 2] = z;
          parA[q] = r3 * 6.2832;
          parA[q + 1] = hbase * (0.6 + r1 * 0.8);
          parA[q + 2] = 0.034 + r2b * 0.034;
          parA[q + 3] = r3;
          const v = 0.76 + r2b * 0.46;
          if (r3 > 0.9945) {
            // A wildflower. Rare (half a percent, not three), two species only,
            // and the colour is carried on the *head* — the negative phase flags
            // the blade so the shader keeps a green stem under it. Recolouring
            // a whole blade at random reads as a vertex-colour bug, not flora.
            const warm = r1 < 0.62;
            colA[o] = warm ? 1.00 : 0.82;
            colA[o + 1] = warm ? 0.86 : 0.76;
            colA[o + 2] = warm ? 0.44 : 1.00;
            parA[q + 2] *= 2.1;
            parA[q + 1] *= 0.92;
            parA[q + 3] = -Math.max(0.02, r3);
          } else {
            colA[o] = cr * v; colA[o + 1] = cg * v; colA[o + 2] = cb * v;
          }
          n++;
        }
      }
    }
    geo.instanceCount = n;
    lastCount = n;
    aOff.needsUpdate = aPar.needsUpdate = aCol.needsUpdate = true;
  }

  return {
    mesh,
    update(dt, t, cam) {
      uniforms.uTime.value = t;
      uniforms.uCam.value.copy(cam);
      if (cam.distanceToSquared(last) > 16) { last.copy(cam); pack(cam); }
    },
    setSunColors(sunCol, skyCol) {
      uniforms.uSunCol.value.copy(sunCol);
      uniforms.uSkyCol.value.copy(skyCol);
    },
    /**
     * Hand the field the world's one shadow-casting light, every frame. Its
     * map does not exist until the first frame has been rendered and its
     * matrix moves with the player, so this is asked rather than cached — and
     * the field simply stays lit until there is a map to read.
     */
    setSunShadow(light) {
      const map = light && light.shadow && light.shadow.map;
      if (!map || !map.texture) { uniforms.uShadowOn.value = 0; return; }
      uniforms.uShadowOn.value = 1;
      uniforms.uShadowMap.value = map.texture;
      uniforms.uShadowMat.value.copy(light.shadow.matrix);
      uniforms.uShadowTexel.value = 1 / Math.max(256, light.shadow.mapSize.x);
    },
    get count() { return lastCount; },
  };
}
