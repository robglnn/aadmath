import {
  WebGLRenderTarget, ShaderMaterial, HalfFloatType, LinearFilter,
  ClampToEdgeWrapping, Vector3, Matrix4,
} from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * VOLUMETRIC LIGHT — the air, integrated along the view ray.
 *
 * What this replaces, three times over:
 *
 *  1. Round one radially blurred the frame's own bright pixels toward the sun.
 *     The emitter was a smooth bright sky, so the integral along every ray came
 *     out nearly equal and the result was an even milk wash.
 *  2. Round two marched an *occlusion mask* — "is this screen pixel sky, and is
 *     it near the sun" — which fixed the wash but inherited the fatal property
 *     of every screen-space radial method: **the emitter has to be on screen.**
 *  3. Round three marched the real frustum against the real shadow map, which
 *     is the right algorithm, and then pooled the scattering medium at
 *     `y = 10` — *forty metres below the island*. The whole playable world
 *     stands between y = 30 and y = 110, so with a thirty-metre e-folding
 *     height there was between four and eight per cent of a medium anywhere a
 *     player could stand. A correct integral through almost no air is a smooth
 *     warm gradient with no beams in it, which is exactly what shipped, and no
 *     amount of tuning the phase function was ever going to fix it.
 *  4. Round four moved the pool up to the coastline and gave it a *sixty-four
 *     metre* scale height, which fixed the vacuum and created the opposite
 *     failure. Read the volumetric buffer on its own and it was a flat cream
 *     rectangle: with that scale height there is still a third of a medium two
 *     hundred metres above the island, so every sky ray in the frame
 *     integrated almost exactly the same amount of almost entirely unoccluded
 *     air. The march was correct and the answer was a constant, and a constant
 *     added to a frame is — by definition — a screen-space overlay.
 *
 * What separates a shaft from a wash is not the integral, it is **where the
 * medium is**. Beams exist where the air and the occluders occupy the same
 * cubic metres. So the medium now lives in the thirty-odd metres above the
 * land, where the trees, the monoliths, the arches and the cadet all stand,
 * thins fast above it, and carries real three-dimensional structure of its own
 * so no two shafts have the same body. Everything else here is the same
 * physics, which was never the problem:
 *
 *     L(p) = Σ  T(p→cam) · σ(p) · shadow(p) · phase(ω·ωsun) · Lsun · dt
 *
 * Consequences, all of them the point:
 *
 *  - Shafts exist because a monolith, an arch, a hoodoo or the cadet's own body
 *    is standing in the light. They are cast by the same occluders that cast
 *    the ground shadows, from the same sun, at the same hour — so a beam and
 *    the shadow it belongs to always agree. Nothing screen-space can do that.
 *  - They work with the sun off screen, behind you, or hidden by a ridge. The
 *    Henyey–Greenstein phase term makes them blaze into the light and go quiet
 *    with it at your back, which is exactly how real air behaves.
 *  - The same integral, with the sky's own colour instead of the sun's, *is*
 *    near-field aerial perspective: air with depth in it inside the fifty-five
 *    metres where the grade's distance ramp deliberately does nothing.
 *
 * Cost control: the march runs at roughly a third of frame resolution with a
 * per-pixel interleaved-gradient jitter on the first step, so the classic
 * marching banding becomes noise and then dies under the grade's depth-aware
 * upsample. The shadow fetch is a two-tap rotated pair rather than one point
 * sample — a beam's edge crossing a 5 cm texel at a fifth of frame resolution
 * is otherwise a staircase that the bilateral upsample happily preserves.
 * The march distance is capped at the far edge of the shadow volume, because
 * past that there is no occlusion data and every extra sample would be paying
 * for a constant.
 *
 * The steps are **not evenly spaced**. Uniform stepping over a hundred and
 * fifty metres spends the same forty samples on the six metres of air the
 * player's eye is actually inside as it does on the last sixty metres, where
 * the medium has already decayed. A quadratic-ish warp puts the first step a
 * metre out and the last one six metres long, which is worth roughly a
 * doubling of the step count for nothing — and it is what lets the near-field
 * mist have visible body instead of shimmering.
 */
export class VolumetricPass extends Pass {
  constructor({ steps = 32, scale = 0.34 } = {}) {
    super();
    this.needsSwap = false;
    this.renderScale = scale;
    /** Set false when the sun has no shadow map yet — the pass then draws nothing. */
    this.ready = false;

    this.renderTarget = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.renderTarget.texture.name = 'ascent.volume';
    this.renderTarget.texture.generateMipmaps = false;

    this.material = new ShaderMaterial({
      name: 'AscentVolumetrics',
      /**
       * MAX_STEPS is a CEILING, not the step count.
       *
       * The step count used to be a `#define`, and `setSteps` used to set it
       * and ask for a recompile. Three keeps a compiled program per material
       * per cache key and only ever releases them when the *material* is
       * disposed, so every distinct step count the effect tier ever selected
       * left a program alive for the rest of the session — and, far worse,
       * compiled it in the middle of play.
       *
       * That closed a loop. A tier change compiled a shader; the compile is a
       * multi-millisecond stall on the main thread; the stall lands in the p95
       * the quality controller is reading; the controller reads the stall as
       * the frame being late and changes the tier again. Degrading the picture
       * was itself producing the hitch that justified degrading it further.
       * The reported session's `programs 147 -> 153` is that loop, counted.
       *
       * The march already carries a dynamic `break` for spent transmittance,
       * so one more costs nothing and the loop was never fully unrolled. The
       * count is a uniform now and nothing recompiles during play.
       */
      defines: { MAX_STEPS: 38 },
      uniforms: {
        uSteps: { value: Math.max(4, Math.min(38, steps)) },
        tDepth: { value: null },
        tShadow: { value: null },
        uShadowMat: { value: new Matrix4() },
        uInvVP: { value: new Matrix4() },
        uCamPos: { value: new Vector3() },
        uCamFwd: { value: new Vector3(0, 0, -1) },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunCol: { value: new Vector3(1.0, 0.78, 0.52) },
        uSkyCol: { value: new Vector3(0.42, 0.55, 0.86) },
        uNear: { value: 0.1 },
        uFar: { value: 4000 },
        uTime: { value: 0 },
        uShadowTexel: { value: 1 / 2048 },
        // medium
        uDensity: { value: 0.0210 },  // extinction per metre at the reference height
        uHeightFall: { value: 30.0 }, // e-folding height of the haze, metres
        uBaseY: { value: 34.0 },      // the altitude the island's air pools at
        uMistY: { value: 26.0 },      // the shelf the heavy mist lies on
        uMistFall: { value: 15.0 },   // and how fast it gives up with height
        uMistAmt: { value: 1.30 },    // how much heavier than the haze it is
        uMaxDist: { value: 150.0 },   // no shadow data past the shadow volume
        uG: { value: 0.62 },          // forward-scattering anisotropy
        uPhaseFloor: { value: 0.17 }, // in-scatter with the sun at your back
        uAmbient: { value: 0.080 },   // sky in-scatter, i.e. near-field aerial
        uGain: { value: 1.35 },       // radiance of the shafts against the frame
        uBias: { value: 0.0011 },
      },
      depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDepth, tShadow;
        uniform mat4 uShadowMat, uInvVP;
        uniform vec3 uCamPos, uCamFwd, uSunDir, uSunCol, uSkyCol;
        uniform float uNear, uFar, uTime, uShadowTexel;
        uniform float uDensity, uHeightFall, uBaseY, uMaxDist, uG, uAmbient, uGain, uBias;
        uniform float uSteps;
        uniform float uMistY, uMistFall, uMistAmt, uPhaseFloor;

        // three.js packs shadow depth into RGBA; these are its own constants.
        const vec4 UNPACK = vec4(0.99609375, 0.0038909912, 1.5199184e-5, 5.9604645e-8);
        float shadowDepth(vec2 uv){ return dot(texture2D(tShadow, uv), UNPACK); }

        /**
         * The body of the air.
         *
         * Two octaves of drifting three-axis wave, at 110 m and 34 m, riding
         * downwind. This is the difference between a medium and a number: a
         * shaft passing through it thickens and thins along its length, two
         * shafts a few metres apart do not look like siblings, and the mist
         * lying in the low ground has visible banks in it instead of being a
         * flat sheet of grey. The wavelengths matter — anything much longer
         * than the march is a constant, anything much shorter than a march
         * step is noise the jitter cannot hide.
         */
        float body(vec3 p){
          float a = sin(p.x * 0.057 + p.y * 0.044 + uTime * 0.085)
                  * sin(p.z * 0.049 - p.y * 0.031 - uTime * 0.062);
          float b = sin(p.x * 0.186 - uTime * 0.150) * sin(p.z * 0.163 + uTime * 0.121);
          return clamp(0.58 + 0.34 * a + 0.20 * b, 0.06, 1.30);
        }

        void main(){
          float raw = texture2D(tDepth, vUv).x;

          // the view ray, reconstructed from the frame's own depth attachment
          vec4 clip = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
          vec4 wp = uInvVP * clip;
          vec3 far = wp.xyz / wp.w;
          vec3 rd = normalize(far - uCamPos);

          // how far the air actually extends in front of this pixel: to the
          // surface it hit, or to the edge of the shadow volume for sky
          float end = uMaxDist;
          if (raw < 1.0) {
            float z = 2.0 * raw - 1.0;
            float eye = (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
            // eye distance is measured along the view axis; the ray is not the
            // view axis anywhere but the centre of the frame
            end = min(uMaxDist, eye / max(0.15, dot(rd, uCamFwd)));
          }
          end = max(end, 1.0);

          // interleaved gradient noise: turns the marching staircase into noise
          float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));

          float cosT = dot(rd, uSunDir);
          // Henyey-Greenstein, normalised against the isotropic case so the
          // number below is a *ratio*, not a physical radiance. Left raw it
          // peaks near thirteen looking into the sun and washes the whole
          // windward half of the island to white — which is the exact failure
          // the screen-space version had, arrived at from the other direction.
          // Clamped at three and a half it is a five-to-one swing: full blaze
          // within thirty degrees of the star, a third of that across the
          // light, a fifth with the light behind you. Beams that vanish the
          // moment you turn your head are a lens effect; beams that merely
          // quieten are air.
          float g2 = uG * uG;
          float hg = (1.0 - g2) / pow(max(1e-3, 1.0 + g2 - 2.0 * uG * cosT), 1.5);
          float phase = uPhaseFloor + (1.0 - uPhaseFloor) * min(hg, 3.5) / 3.5;

          // a per-pixel rotation for the two shadow taps, so the softening is
          // noise rather than a directional smear
          float ang = jit * 6.2831853;
          vec2 rot = vec2(cos(ang), sin(ang)) * uShadowTexel * 0.85;

          float trans = 1.0;
          float sun = 0.0;
          float amb = 0.0;
          float t = 0.0;
          float INV = 1.0 / uSteps;

          for (int i = 0; i < MAX_STEPS; i++) {
            if (float(i) >= uSteps) break;
            // Warped stepping: fine where the eye is, coarse where the medium
            // has already given up. u is the jittered fraction along the
            // ray; the blend of a linear and a quadratic term keeps the first
            // step about a metre long and the last about six.
            float u = (float(i) + jit) * INV;
            float tn = end * u * (0.34 + 0.66 * u);
            float dt = tn - t;
            t = tn;
            if (dt <= 0.0) continue;
            vec3 p = uCamPos + rd * t;

            // THE MEDIUM.
            //
            // Two layers, and the split is the whole reason this reads as
            // shafts. The haze is the air the island breathes — it clings to
            // the land within about thirty metres of it, which is exactly the
            // band the trees, the monoliths, the arches and the cadet stand
            // in, so the occluders and the medium share the same cubic metres
            // and their shadows are *carved through* something. The mist is
            // heavier and lower, lying on the coastal shelf, and gives the
            // gulf below the plaza depth without touching the sky.
            //
            // Above that band the density falls away fast. That is deliberate:
            // air a hundred metres over an island is unoccluded, and an
            // unoccluded integral is a constant, and a constant added to every
            // pixel of sky is the flat cream rectangle this pass used to be.
            float haze = exp(-max(0.0, p.y - uBaseY) / uHeightFall);
            float mist = exp(-max(0.0, p.y - uMistY) / uMistFall) * uMistAmt;
            // Past the shadow volume there is no occlusion data at all, so
            // rather than integrating fully-lit air out to the horizon — a
            // constant again — the medium simply runs out.
            float reach = 1.0 - smoothstep(0.62, 1.0, t / uMaxDist);
            float sigma = uDensity * (haze + mist) * body(p) * reach;
            if (sigma < 1e-5) continue;

            // is this cubic metre of air standing in the sun?
            vec4 sc = uShadowMat * vec4(p, 1.0);
            vec3 sp = sc.xyz / sc.w;
            float lit = 1.0;
            if (sp.z <= 1.0 && sp.z >= 0.0) {
              float d0 = shadowDepth(sp.xy + rot);
              float d1 = shadowDepth(sp.xy - rot);
              float inLight = 0.5 * (step(sp.z - uBias, d0) + step(sp.z - uBias, d1));
              // Outside the shadow volume there is no occlusion information, so
              // fade back to lit rather than cutting a rectangle into the air.
              vec2 e = smoothstep(vec2(0.0), vec2(0.06), sp.xy)
                     * (1.0 - smoothstep(vec2(0.94), vec2(1.0), sp.xy));
              lit = mix(1.0, inLight, e.x * e.y);
            }

            float seg = sigma * dt;
            sun += trans * lit * seg;
            amb += trans * seg;
            trans *= exp(-seg * 1.15);
            if (trans < 0.010) break;
          }

          vec3 col = uSunCol * (sun * phase * uGain) + uSkyCol * (amb * uAmbient);
          // alpha carries the ray length so the grade can upsample this buffer
          // without haloing every silhouette in the frame
          gl_FragColor = vec4(col, end);
        }`,
    });

    this.fsQuad = new FullScreenQuad(this.material);
    this._invVP = new Matrix4();
  }

  get texture() { return this.renderTarget.texture; }

  setDepth(texture) { this.material.uniforms.tDepth.value = texture || null; }

  /** How many steps the march takes. A uniform: it never recompiles. */
  setSteps(n) {
    this.material.uniforms.uSteps.value = Math.max(4, Math.min(38, n | 0));
  }

  /** Pull the live camera and the live sun shadow every frame. */
  setCamera(camera) {
    const u = this.material.uniforms;
    this._invVP.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    u.uInvVP.value.copy(this._invVP);
    u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    camera.getWorldDirection(u.uCamFwd.value);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
  }

  /**
   * `light` is the world's one DirectionalLight. Its shadow map does not exist
   * until the first frame has been rendered, so this is asked every frame and
   * the pass simply stands down until there is one.
   *
   * The march is capped at the far corner of that light's own shadow volume:
   * past it there is no occlusion data, so every further sample would be
   * integrating a constant and the beams would end in a straight line.
   */
  setLight(light) {
    const map = light && light.shadow && light.shadow.map;
    this.ready = !!(map && map.texture);
    if (!this.ready) return;
    const u = this.material.uniforms;
    u.tShadow.value = map.texture;
    u.uShadowMat.value.copy(light.shadow.matrix);
    const cam = light.shadow.camera;
    if (cam && cam.isOrthographicCamera) {
      const half = Math.max(cam.right - cam.left, cam.top - cam.bottom) * 0.5;
      u.uMaxDist.value = Math.min(220, half * 1.9);
      u.uShadowTexel.value = 1 / Math.max(256, light.shadow.mapSize.x);
    }
  }

  setSun(dir) { this.material.uniforms.uSunDir.value.copy(dir); }

  setSize(width, height) {
    const s = this.renderScale;
    this.renderTarget.setSize(
      Math.max(2, Math.round(width * s)),
      Math.max(2, Math.round(height * s)),
    );
  }

  render(renderer) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.clear(true, false, false);
    this.fsQuad.render(renderer);
    renderer.setRenderTarget(prev);
  }

  dispose() {
    this.renderTarget.dispose();
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
