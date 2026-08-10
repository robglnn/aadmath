import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';
import { SKY as PALETTE, STARS, GALACTIC, FOG } from './daylight.js';

/**
 * The composed horizon.
 *
 * A golden-hour sky whose warmth follows the sun's bearing, a banded gas giant
 * and its moon anchoring the scale, and a sea of cloud a hundred and twenty
 * metres below the island so the world reads as *floating* rather than as a
 * mesh ending in nothing.
 *
 * Every colour in here comes from `daylight.js`, including how many stars the
 * hour is allowed to have — which, at golden hour, is almost none. A navy
 * zenith full of stars over terrain lit by a warm low sun is two times of day
 * in one frame, and it is the single loudest way a render says "engine" rather
 * than "place".
 */

export { PALETTE };

export function createSky(scene, sunDir) {
  const uniforms = {
    uSun: { value: sunDir.clone() },
    uZenith: { value: PALETTE.zenith.clone() },
    uMid: { value: PALETTE.mid.clone() },
    uWarm: { value: PALETTE.horizonWarm.clone() },
    uCool: { value: PALETTE.horizonCool.clone() },
    uStars: { value: STARS },
    uGalactic: { value: GALACTIC },
    uTime: { value: 0 },
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: /* glsl */`
        ${GLSL_NOISE}
        varying vec3 vDir;
        uniform vec3 uSun,uZenith,uMid,uWarm,uCool;
        uniform float uTime,uStars,uGalactic;
        float hash3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }

        void main(){
          vec3 d = normalize(vDir);
          vec3 S = normalize(uSun);
          float h = clamp(d.y, -0.2, 1.0);
          float sunAz = clamp(dot(normalize(vec3(d.x,0.0,d.z)), normalize(vec3(S.x,0.0,S.z))), -1.0, 1.0);

          // the horizon is warm where the sun is and cool opposite it
          vec3 horizon = mix(uCool, uWarm, smoothstep(-0.55, 0.95, sunAz));
          vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.30, h));
          col = mix(col, uZenith, smoothstep(0.22, 0.85, h));

          // a low band of haze that lifts the whole thing off the terrain
          col = mix(col, horizon * 1.06, smoothstep(0.10, -0.06, h) * 0.85);

          // sun disc, aureole and broad forward scatter
          float sd = max(dot(d, S), 0.0);
          col += vec3(1.0,0.90,0.74) * pow(sd, 2200.0) * 12.0;
          col += vec3(1.0,0.80,0.55) * pow(sd, 26.0) * 0.55;
          col += vec3(1.0,0.66,0.42) * pow(sd, 4.0) * 0.22;
          col += vec3(0.86,0.60,0.86) * pow(sd, 1.4) * 0.045;

          // Stratus decks, thin and stretched, only in the lower third — and
          // *only* evaluated there. The band mask is two smoothsteps; the four
          // noise taps behind it used to run on every pixel of the dome,
          // including the two thirds of it where the mask was already zero.
          float band = smoothstep(0.62, 0.05, d.y) * smoothstep(-0.02, 0.06, d.y);
          if (band > 0.004) {
            float dz = max(d.y, 0.012);
            vec2 pl = d.xz / dz;
            float c1 = aa_fbm3(pl * vec2(0.055, 0.10) + vec2(uTime*0.0035, 0.0));
            float c2 = aa_n(pl * vec2(0.030, 0.052) + vec2(-uTime*0.0022, 5.0));
            float cl = (smoothstep(0.44, 0.76, c1) * 0.8 + smoothstep(0.50, 0.84, c2) * 0.5) * band;
            vec3 cloudLit = mix(vec3(0.42,0.40,0.55), vec3(1.0,0.86,0.72), smoothstep(-0.3, 0.9, sunAz));
            col = mix(col, cloudLit, clamp(cl, 0.0, 0.9));
          }

          // Stars and the galactic band. At golden hour the sky is far too
          // bright for either, so both live in the top half of the dome and
          // neither is worth a hash, a floor and two transcendentals anywhere
          // else. How many there are at all is daylight.js's decision.
          float up = smoothstep(0.46, 0.86, d.y);
          if (up > 0.004) {
            vec3 g = floor(d*420.0);
            float st = step(0.99955, hash3(g));
            float tw = 0.6 + 0.4*sin(uTime*2.0 + hash3(g)*30.0);
            col += vec3(0.80,0.88,1.0) * st * up * tw * (1.0 - pow(sd,2.0)) * uStars;
            float gb = exp(-pow((d.y - 0.42 + d.x*0.22)*4.0, 2.0));
            col += vec3(0.34,0.36,0.66) * gb * up * uGalactic;
          }

          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  sky.frustumCulled = false;
  // Drawn LAST among the opaque queue, not first. The sky shader is the most
  // expensive per-pixel thing in the frame (fbm cloud decks, stars, three sun
  // lobes) and at renderOrder -10 every one of those pixels was shaded and then
  // painted over by terrain. Last + depth-test means the hardware throws the
  // hidden ones away before the shader ever runs.
  sky.renderOrder = 60;
  scene.add(sky);

  // ------------------------------------------------ the gas giant and a moon
  const giantMat = new THREE.ShaderMaterial({
    transparent: false, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir.clone() }, uSeed: { value: 0.0 } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vP;
      void main(){ vN=normalize(normalMatrix*normal); vP=normalize(position);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      varying vec3 vN; varying vec3 vP; uniform vec3 uSun; uniform float uSeed;
      void main(){
        float y = vP.y;
        float turb = aa_fbm3(vec2(vP.x*3.0 + uSeed, y*7.0)) * 0.30;
        float bands = sin((y + turb*0.25) * 15.0)*0.5+0.5;
        bands = mix(bands, sin((y+turb*0.4)*37.0+1.7)*0.5+0.5, 0.35);
        vec3 warm = vec3(0.92,0.72,0.52), cool = vec3(0.46,0.36,0.56), pale = vec3(0.96,0.90,0.80);
        vec3 base = mix(cool, warm, bands);
        base = mix(base, pale, smoothstep(0.55,0.95,bands)*0.5);
        // a great storm
        float storm = smoothstep(0.30, 0.02, length(vec2(vP.x*1.3 - 0.34, y + 0.18)));
        base = mix(base, vec3(0.86,0.42,0.34), storm*0.8);
        float lam = clamp(dot(normalize(vN), normalize(uSun))*0.5+0.5, 0.0, 1.0);
        base *= mix(0.24, 1.0, pow(lam,1.6));
        float rim = pow(1.0-abs(dot(normalize(vN), vec3(0.0,0.0,1.0))), 2.4);
        base += vec3(0.55,0.72,1.0)*rim*0.34;
        // it is behind the same air everything else is behind
        base = mix(base, vec3(0.62,0.68,0.84), 0.42);
        gl_FragColor = vec4(base, 1.0);
      }`,
  });
  const giant = new THREE.Mesh(new THREE.SphereGeometry(340, 48, 36), giantMat);
  giant.position.set(1720, 470, 1900);
  giant.renderOrder = 50;
  scene.add(giant);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(410, 610, 96),
    new THREE.MeshBasicMaterial({
      color: 0xe0cbae, transparent: true, opacity: 0.30,
      side: THREE.DoubleSide, depthWrite: false, fog: false,
    })
  );
  ring.position.copy(giant.position);
  ring.rotation.set(-1.18, 0.22, 0.28);
  ring.renderOrder = 50;
  scene.add(ring);

  // A *daytime* moon: lit from the same star everything else is, and sitting
  // behind the same depth of air. A flat white disc reads as night; a pale
  // gibbous one with a terminator and a little haze on it reads as afternoon,
  // and it is the same object either way.
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(52, 24, 18),
    new THREE.ShaderMaterial({
      fog: false, depthWrite: false,
      uniforms: { uSun: { value: sunDir.clone() }, uHaze: { value: PALETTE.mid.clone() } },
      vertexShader: /* glsl */`
        varying vec3 vN;
        void main(){ vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        varying vec3 vN; uniform vec3 uSun, uHaze;
        void main(){
          float lam = clamp(dot(normalize(vN), normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = mix(vec3(0.26,0.30,0.40), vec3(1.02,0.99,0.94), pow(lam, 1.9));
          gl_FragColor = vec4(mix(c, uHaze * 1.5, 0.34), 1.0);
        }`,
    })
  );
  moon.position.set(-980, 760, -1420);
  moon.renderOrder = 50;
  scene.add(moon);

  // ------------------------------------------------------------- cloud sea
  const seaU = {
    uTime: { value: 0 },
    uSun: { value: sunDir.clone() },
    uHorizon: { value: PALETTE.horizonCool.clone() },
    uWarm: { value: PALETTE.horizonWarm.clone() },
  };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: seaU, fog: false, side: THREE.DoubleSide, depthWrite: true,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main(){
        vW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      varying vec3 vW;
      uniform float uTime; uniform vec3 uSun, uHorizon, uWarm;
      void main(){
        vec2 p = vW.xz * 0.0075;
        float w = aa_n(p * 0.7 + vec2(uTime*0.010, 0.0));
        float f = aa_fbm3(p + vec2(w, 1.0 - w) * 1.1 + vec2(uTime * 0.005, 0.0));
        float tops = smoothstep(0.40, 0.64, f);
        float crest = smoothstep(0.62, 0.88, f);
        float deep = smoothstep(0.46, 0.12, f);

        vec3 lit = mix(vec3(1.00,0.96,0.92), uWarm, 0.30);
        vec3 shade = vec3(0.34,0.37,0.60);
        vec3 col = mix(shade, lit, tops);
        col = mix(col, lit * 1.10, crest * 0.85);
        col = mix(col, shade * 0.52, deep * 0.85);

        // sun glint running across the deck toward the light
        vec3 V = normalize(vW - cameraPosition);
        float gl = pow(max(dot(normalize(-V), normalize(uSun)), 0.0), 6.0);
        col += uWarm * gl * 0.35 * tops;

        // dissolve into the horizon with distance
        float d = length(vW.xz - cameraPosition.xz);
        col = mix(col, mix(uHorizon, vec3(0.62,0.62,0.78), 0.45), smoothstep(700.0, 2600.0, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(3400, 96), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -125;
  sea.renderOrder = 40;
  sea.frustumCulled = false;
  scene.add(sea);

  // torn wisps between the island and the deck, for parallax
  const wispMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false,
    fog: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW;
      void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      varying vec2 vUv; varying vec3 vW; uniform float uTime;
      void main(){
        vec2 p = vW.xz * 0.010 + vec2(uTime*0.01, uTime*0.006);
        float f = aa_fbm3(p);
        float a = smoothstep(0.46, 0.78, f) * 0.55;
        float r = length(vUv - 0.5) * 2.0;
        a *= smoothstep(1.0, 0.25, r);
        gl_FragColor = vec4(vec3(0.94,0.93,0.98), a);
      }`,
  });
  const wisps = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(820, 820, 1, 1), wispMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((i - 1) * 150, -36 - i * 16, (i % 2 ? 1 : -1) * 90);
    m.renderOrder = -6;
    wisps.add(m);
  }
  scene.add(wisps);

  // The one and only place `scene.fog` is created. `air.js` has replaced the
  // fog chunks with real aerial perspective, so what this object actually does
  // is switch `USE_FOG` on for every material in the game; the colour and
  // density are the honest fallback for anything the replacement misses.
  scene.fog = new THREE.FogExp2(FOG.color.getHex(), FOG.density);

  return {
    update(t) {
      uniforms.uTime.value = t;
      seaU.uTime.value = t;
      wispMat.uniforms.uTime.value = t;
    },
    uniforms, giant, sea, palette: PALETTE,
  };
}
