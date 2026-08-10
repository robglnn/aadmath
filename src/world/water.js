import * as THREE from 'three';
import { GLSL_NOISE, rng } from './noise.js';
import { dotTexture } from './sprites.js';
import { heightAt, coastRadius, LAKE } from './terrain.js';

/**
 * The Mirror and the Fall.
 *
 * A lake sits in a bowl near the eastern rim and spills straight off the edge
 * of the world. The shoreline is not drawn — it emerges where the water plane
 * meets the terrain, so it is as irregular as the ground under it.
 */

const LAKE_ANG = Math.atan2(LAKE.z, LAKE.x);

export function createWater(scene, sunDir, quality) {
  const group = new THREE.Group();
  scene.add(group);

  // ------------------------------------------------------------------ lake
  const SEG = quality > 0.6 ? 96 : 48;
  const size = LAKE.r * 3.1;
  const geo = new THREE.PlaneGeometry(size, size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + LAKE.x, z = pos.getZ(i) + LAKE.z;
    const h = heightAt(x, z);
    depth[i] = h === null ? -3 : LAKE.y - h;
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  const mask = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i), dz = pos.getZ(i);
    const d = Math.hypot(dx, dz);
    mask[i] = 1 - Math.min(1, Math.max(0, (d - LAKE.r * 1.20) / (LAKE.r * 0.30)));
  }
  geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSun: { value: sunDir.clone() },
      uDeep: { value: new THREE.Color(0x08283f) },
      uShallow: { value: new THREE.Color(0x2f9ea8) },
      uSky: { value: new THREE.Color(0x7ea6dc) },
      uSunCol: { value: new THREE.Color(0xffe3bd) },
    },
  ]);

  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, fog: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute float aDepth;
      attribute float aMask;
      varying float vDepth;
      varying float vMask;
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vDepth = aDepth; vMask = aMask;
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      uniform float uTime;
      uniform vec3 uSun, uDeep, uShallow, uSky, uSunCol;
      varying float vDepth;
      varying float vMask;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        if (vDepth <= 0.02 || vMask <= 0.01) discard;
        vec2 p = vW.xz;

        // three crossing ripple fields at different scales — one field gives a
        // plastic sheet, three give a surface with weather on it
        float r1 = aa_n(p * 0.17 + vec2(uTime * 0.09, uTime * 0.045));
        float r2 = aa_n(p * 0.41 - vec2(uTime * 0.06, uTime * 0.115));
        float r3 = aa_n(p * 1.05 + vec2(-uTime * 0.20, uTime * 0.14));
        vec3 n = normalize(vec3((r1 - r2) * 0.17 + (r2 - r3) * 0.10, 1.0,
                                (r2 - r1) * 0.17 + (r3 - r1) * 0.10));

        // ---- body colour: a real depth ramp, not one flat blue ----
        vec3 shallowSand = vec3(0.360, 0.470, 0.398);
        vec3 col = mix(shallowSand, uShallow, smoothstep(0.0, 2.6, vDepth));
        col = mix(col, uDeep, smoothstep(1.8, 9.5, vDepth));
        // light scattering back up through the shallows
        col += vec3(0.09, 0.21, 0.15) * (1.0 - smoothstep(1.0, 7.0, vDepth)) * (0.4 + 0.6 * r3);

        // ---- reflection: a sky gradient mirrored off the wave normal ----
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, n);
        float up = clamp(R.y, 0.0, 1.0);
        vec3 skyRefl = mix(mix(vec3(1.00, 0.86, 0.68), uSky, 0.6), uSky * 0.70, up);
        skyRefl = mix(skyRefl, uSky * vec3(0.60, 0.72, 1.06), smoothstep(0.08, 0.55, up));
        float fres = 0.03 + 0.97 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 4.0);
        col = mix(col, skyRefl, clamp(fres, 0.0, 0.88));

        // ---- the sun's road across the water ----
        vec3 H = normalize(normalize(uSun) + V);
        float nh = max(dot(n, H), 0.0);
        col += uSunCol * pow(nh, 320.0) * 1.20;
        col += uSunCol * pow(nh, 14.0) * 0.14;

        // ---- shoreline: foam that follows the ripple, not a painted ring ----
        float edge = smoothstep(1.45, 0.0, vDepth);
        float foam = edge * (0.30 + 0.70 * aa_n(p * 0.85 + vec2(uTime * 0.24, r1 * 2.0)));
        col = mix(col, vec3(0.90, 0.96, 1.0), smoothstep(0.22, 0.85, foam) * 0.85);

        float a = max(smoothstep(0.0, 0.42, vDepth) * 0.96, smoothstep(0.3, 0.9, foam)) * vMask;
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });

  const lake = new THREE.Mesh(geo, mat);
  lake.position.set(LAKE.x, LAKE.y, LAKE.z);
  lake.renderOrder = 2;
  group.add(lake);

  // ------------------------------------------------------- the spill & fall
  const dirx = Math.cos(LAKE_ANG), dirz = Math.sin(LAKE_ANG);
  const centre = [];
  let r = Math.hypot(LAKE.x, LAKE.z) + LAKE.r * 0.55;
  const Rc = coastRadius(LAKE_ANG);
  let fell = 0;
  for (let i = 0; i < 130; i++) {
    const x = dirx * r, z = dirz * r;
    const h = heightAt(x, z);
    if (h !== null && fell === 0) {
      centre.push(new THREE.Vector3(x, Math.min(h + 0.25, LAKE.y), z));
      r += 1.6;
      if (r > Rc) fell = 1;
    } else {
      // over the edge: accelerate down and drift a little outward
      const last = centre[centre.length - 1] || new THREE.Vector3(dirx * r, LAKE.y, dirz * r);
      fell++;
      const t = fell * 0.9;
      centre.push(new THREE.Vector3(
        last.x + dirx * 0.55,
        last.y - (2.2 + t * 0.5),
        last.z + dirz * 0.55
      ));
      if (centre[centre.length - 1].y < -170) break;
    }
  }

  const fallGeo = buildRibbon(centre, dirx, dirz);
  const fallU = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uTime: { value: 0 }, uTint: { value: new THREE.Color(0xdff0ff) } },
  ]);
  const fallMat = new THREE.ShaderMaterial({
    uniforms: fallU, transparent: true, fog: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying float vY;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv; vY = position.y;
        vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      uniform float uTime; uniform vec3 uTint;
      varying vec2 vUv; varying float vY;
      #include <fog_pars_fragment>
      void main(){
        float v = vUv.y * 9.0 - uTime * 1.35;
        float streak = aa_fbm3(vec2(vUv.x * 7.0, v)) * 0.9 + aa_n(vec2(vUv.x * 26.0, v * 2.4)) * 0.5;
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        float body = edge * (0.42 + streak * 0.75);
        vec3 col = uTint * (0.72 + streak * 0.6);
        float a = clamp(body, 0.0, 1.0) * smoothstep(0.0, 0.05, vUv.y) * (0.28 + 0.72 * smoothstep(-190.0, -30.0, -abs(vY)));
        gl_FragColor = vec4(col, a * 0.92);
        #include <fog_fragment>
      }`,
  });
  const fall = new THREE.Mesh(fallGeo, fallMat);
  fall.renderOrder = 3;
  group.add(fall);

  // mist where the water leaves the world
  const lip = centre.find((p) => p.y < LAKE.y - 3) || centre[centre.length - 1];
  const mist = makeMist(quality, lip);
  group.add(mist.points);

  return {
    group, lake, fall,
    update(dt, t) {
      uniforms.uTime.value = t;
      fallU.uTime.value = t;
      mist.update(dt, t);
    },
    setSky(skyCol, sunCol) {
      uniforms.uSky.value.copy(skyCol);
      uniforms.uSunCol.value.copy(sunCol);
    },
  };
}

function buildRibbon(pts, dirx, dirz) {
  const px = -dirz, pz = dirx;
  const v = [], uv = [], idx = [];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0) len += p.distanceTo(pts[i - 1]);
    const drop = Math.max(0, pts[0].y - p.y);
    const w = 5.0 + Math.min(drop * 0.10, 7.0);
    v.push(p.x - px * w, p.y, p.z - pz * w);
    v.push(p.x + px * w, p.y, p.z + pz * w);
    const t = i / (pts.length - 1);
    uv.push(0, t, 1, t);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeMist(quality, lip) {
  const N = Math.round(340 * quality);
  const arr = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  const rand = rng(999);
  for (let i = 0; i < N; i++) {
    arr[i * 3] = lip.x + (rand() - 0.5) * 26;
    arr[i * 3 + 1] = lip.y - rand() * 60;
    arr[i * 3 + 2] = lip.z + (rand() - 0.5) * 26;
    seed[i] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const m = new THREE.PointsMaterial({
    color: 0xdcefff, size: 12, map: dotTexture(), transparent: true, opacity: 0.22,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return {
    points,
    update(dt) {
      for (let i = 0; i < N; i++) {
        arr[i * 3 + 1] += dt * (2.6 + seed[i] * 5.0);
        arr[i * 3] += dt * (seed[i] - 0.5) * 1.6;
        if (arr[i * 3 + 1] > lip.y + 12) {
          arr[i * 3 + 1] = lip.y - 55 - seed[i] * 12;
          arr[i * 3] = lip.x + (seed[i] - 0.5) * 26;
        }
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}
