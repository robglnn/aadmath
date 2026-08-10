import * as THREE from 'three';
import { WIND } from '../world/world.js';

/**
 * THE NEAR FIELD — pollen, spores and dust in the light around the cadet.
 *
 * This lives in `fx` rather than in the world because it is a lens phenomenon
 * as much as a world one: how much of it you see, how bright it burns and
 * whether it drifts at all are quality- and accessibility-scaled decisions.
 *
 * Four rules, each of them learned by shipping the opposite:
 *
 *  1. **Never draw an untextured point.** A bare `THREE.Points` is a hard
 *     opaque square and reads as a rendering bug. This computes its own
 *     falloff from `gl_PointCoord`, so it is a soft round mote at every quality
 *     level with no texture to load and nothing to lose when a tier changes.
 *  2. **Anchor the volume to the camera.** The motes live in a cube that
 *     follows you and wraps modulo its own size in the vertex shader, so the
 *     air is equally alive wherever you stand and the CPU never touches the
 *     buffer.
 *  3. **Fade at the faces of that cube, not at a sphere inside it.** This is
 *     the arithmetic that was quietly deleting the effect. A radial fade from
 *     0.30 to 0.48 of the box only ever draws the ball inside 0.30 — eleven per
 *     cent of the cube's volume — so of fifteen hundred motes about a hundred
 *     and sixty were drawn and the other thirteen hundred paid vertex cost to
 *     be invisible in the corners. Fading per axis instead, from 0.70 of the
 *     way to each face, uses thirty-seven per cent at full strength and the
 *     rest as the fade itself. Same pop-free wrap, three times the air.
 *  4. **Shadow them, but do not extinguish them.** Each mote samples the sun's
 *     own shadow map in the vertex shader — the same map the terrain and the
 *     volumetric march read — so dust drifting through a shaft between two
 *     monoliths lights up and dust in the monolith's shadow goes out. The
 *     floor matters: at 0.07 the near field simply switched off every time the
 *     cadet walked into shade, which is not what shaded dust does. Sky light
 *     still reaches it. A four-to-one swing reads as light; a fifteen-to-one
 *     swing reads as a bug.
 *
 * And they survive the sun being behind you. The old response was
 * `pow(back, 3)`, a pure forward-scatter lobe, so turning away from the star
 * deleted the entire field. Real dust keeps a diffuse term: quieter, cooler,
 * and no longer the brightest thing in the frame.
 */

/**
 * The cube of air that follows the camera. Twenty-six metres, which with the
 * face fade puts full-strength motes inside about nine metres and the last of
 * them at thirteen — the range over which a speck of pollen is a speck of
 * pollen rather than a pixel of noise.
 */
const BOX = 26;

export function createAtmosphere(scene, { count = 6000, sunDir } = {}) {
  const MAX = 9000;
  const pos = new Float32Array(MAX * 3);
  const seed = new Float32Array(MAX);
  const scale = new Float32Array(MAX);

  let s = 20250809;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;

  for (let i = 0; i < MAX; i++) {
    pos[i * 3] = rnd() * BOX;
    pos[i * 3 + 1] = rnd() * BOX;
    pos[i * 3 + 2] = rnd() * BOX;
    seed[i] = rnd();
    // No bokeh class. Eight per cent of the field used to be given a scale of
    // up to 6.2, which at the near clamp reached the forty-eight-pixel ceiling
    // and painted three or four fat white discs across open sky — read, twice,
    // as dirt on the lens rather than as air. Pollen is *small*: the whole
    // field spans a factor of three and the largest of them is a speck.
    scale[i] = rnd() < 0.16 ? 1.05 + rnd() * 0.60 : 0.42 + rnd() * 0.44;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setDrawRange(0, Math.min(MAX, count));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const uniforms = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uSun: { value: (sunDir ? sunDir.clone() : new THREE.Vector3(0, 1, 0)) },
    uWarm: { value: new THREE.Color(0xffd7a2) },
    uCool: { value: new THREE.Color(0xa9c8f2) },
    uBox: { value: BOX },
    uPixel: { value: 900 },
    uAmount: { value: 1 },
    uMotion: { value: 1 },
    tShadow: { value: null },
    uShadowMat: { value: new THREE.Matrix4() },
    uShadowOn: { value: 0 },
    // the same wind the grass bends to, so the air and the field agree
    uWind: { value: new THREE.Vector3(WIND.x, 0, WIND.y).normalize() },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aScale;
      uniform float uTime, uBox, uPixel, uAmount, uMotion, uShadowOn;
      uniform vec3 uCam, uSun, uWarm, uCool, uWind;
      uniform sampler2D tShadow;
      uniform mat4 uShadowMat;
      varying vec3 vCol;
      varying float vA;

      // three.js packs its shadow depth into RGBA; these are its constants.
      const vec4 UNPACK = vec4(0.99609375, 0.0038909912, 1.5199184e-5, 5.9604645e-8);
      float litAt(vec3 p){
        if (uShadowOn < 0.5) return 1.0;
        vec4 sc = uShadowMat * vec4(p, 1.0);
        vec3 s = sc.xyz / sc.w;
        if (s.z > 1.0 || s.z < 0.0) return 1.0;
        float d = dot(texture2D(tShadow, s.xy), UNPACK);
        float inLight = step(s.z - 0.0016, d);
        vec2 e = smoothstep(vec2(0.0), vec2(0.05), s.xy)
               * (1.0 - smoothstep(vec2(0.95), vec2(1.0), s.xy));
        return mix(1.0, inLight, e.x * e.y);
      }

      void main(){
        // Pollen rides the island's wind, in the same gusts the grass bends to:
        // a steady drift down the wind vector, a slow updraught, and a coherent
        // gust that passes through the whole volume at once rather than each
        // mote wandering on its own seed. Then the cube wraps around the camera
        // so the air never runs out and the CPU never touches the buffer.
        float gust = 0.72 + 0.42 * sin(uTime * 0.31 + dot(position.xz, uWind.xz) * 0.06);
        vec3 drift = (uWind * 1.15 * gust + vec3(0.0, 0.24, 0.0)) * uTime * uMotion
                   + vec3(sin(uTime * 0.5 + aSeed * 31.0), sin(uTime * 0.7 + aSeed * 12.0), 0.0) * 0.5 * uMotion;
        vec3 p = position + drift - uCam + uBox * 0.5;
        p = mod(p, uBox) - uBox * 0.5;
        vec3 world = uCam + p;

        vec4 mv = modelViewMatrix * vec4(world, 1.0);
        float dist = -mv.z;
        gl_Position = projectionMatrix * mv;

        // Two lobes, because one of them is a switch. The glow term is forward
        // scatter: a mote between you and the star burns warm and hard. The
        // side term is the diffuse component that keeps the air alive when you
        // turn your back on the sun, where the last version deleted it.
        vec3 toCam = normalize(uCam - world);
        float back = clamp(dot(-toCam, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);
        float glow = pow(back, 3.0);
        float side = back * back;

        // Is this speck of dust standing in the sun? Same map, same hour.
        float lit = litAt(world);
        vCol = mix(uCool * 0.66, uWarm, glow) * (0.40 + side * 0.55 + glow * 1.70);
        vCol *= mix(0.24, 1.0, lit);   // shaded dust keeps the sky's share

        float twinkle = 0.76 + 0.24 * sin(uTime * (1.1 + aSeed * 2.2) + aSeed * 40.0);

        // BANKS. A statistically uniform field of specks is a starfield, and
        // the eye names it as one instantly — evenly spaced points of light
        // that do not belong to anything. Real pollen travels in wisps: thick
        // where the air is going one way, thin a few metres over. One
        // low-frequency world-space modulation, drifting downwind, is the
        // whole difference between dust and static.
        vec3 w = world * 0.085 - uWind * uTime * 0.30;
        float bank = sin(w.x + sin(w.z * 1.7) * 0.8) * sin(w.z * 1.13 - w.y * 0.5);
        bank = clamp(0.54 + 0.86 * bank, 0.0, 1.30);

        // Fade at the FACES of the cube, per axis. A mote approaching any wall
        // of the volume dies before it wraps, which is what makes the wrap
        // invisible — and unlike a sphere inscribed in the cube it does not
        // throw away five sixths of the budget to do it.
        vec3 q = abs(p) / (uBox * 0.5);
        float edge = 1.0 - smoothstep(0.70, 1.0, max(q.x, max(q.y, q.z)));
        float near = smoothstep(0.50, 2.0, dist);
        // Pollen is a *ground* phenomenon: it hangs over the meadow and the
        // canopy, not in the open sky twenty metres up. Fading it out with
        // height above whatever the camera is standing on is what stops the
        // near field reading as sensor dust on a clear blue frame.
        float above = 1.0 - smoothstep(3.0, 10.0, world.y - uCam.y);
        vA = uAmount * twinkle * bank * edge * near * (0.27 + side * 0.38 + glow * 0.98)
           * above * mix(0.26, 1.0, lit);

        // Never smaller than a couple of pixels — a one-pixel additive dot
        // reads as noise, not as a mote. The ceiling used to be forty-eight
        // drawing-buffer pixels, which on a retina panel is a two-centimetre
        // disc floating in the sky; then it was fifteen, which made every mote
        // inside six metres exactly the same size as every mote at nine and
        // deleted the one cue that says a thing is close to the lens.
        float sz = clamp(aScale * uPixel / max(1.0, dist), 2.0, 22.0);
        gl_PointSize = sz;
        // A mote does not get brighter by being nearer, it gets *bigger*: the
        // same scattered energy over more pixels. Dividing the alpha by the
        // size keeps the total constant, which is what makes a big near speck
        // read as soft out-of-focus pollen drifting past the lens instead of
        // as a smear of dirt on the front element.
        vA *= clamp(8.0 / sz, 0.30, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;
        // soft round falloff with a hot little core — never a square
        float a = pow(1.0 - r, 2.6);
        a += pow(max(0.0, 1.0 - r * 2.6), 6.0) * 0.55;
        gl_FragColor = vec4(vCol * a * vA, a * vA);
      }`,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  return {
    points,
    setCount(n) { geo.setDrawRange(0, Math.max(0, Math.min(MAX, Math.round(n)))); },
    setAmount(a) { uniforms.uAmount.value = a; },
    setMotion(m) { uniforms.uMotion.value = m; },
    setSun(v) { uniforms.uSun.value.copy(v); },
    /**
     * Hand the motes the world's one directional light. Its shadow map does not
     * exist until the first frame has rendered, so this is asked every frame
     * and simply leaves the dust unshadowed until there is one.
     */
    setShadow(light) {
      const map = light && light.shadow && light.shadow.map;
      if (!map || !map.texture) { uniforms.uShadowOn.value = 0; return; }
      uniforms.tShadow.value = map.texture;
      uniforms.uShadowMat.value.copy(light.shadow.matrix);
      uniforms.uShadowOn.value = 1;
    },
    /**
     * The projected size of a mote is `aScale * uPixel / distance`. The scale
     * used to be nine tenths of the viewport height, which drove every speck
     * inside a hundred metres straight into the size ceiling — so the whole
     * field rendered at one size, the ceiling's, and none of it shrank with
     * distance. A tenth of the viewport height puts the interesting part of
     * the curve inside the thirteen metres the field is visible over.
     */
    setViewportHeight(h) { uniforms.uPixel.value = h * 0.10; },
    update(dt, time, camera) {
      uniforms.uTime.value = time;
      uniforms.uCam.value.copy(camera.position);
    },
    dispose() { scene.remove(points); geo.dispose(); mat.dispose(); },
  };
}
