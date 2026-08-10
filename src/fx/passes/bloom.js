import { WebGLRenderTarget, ShaderMaterial, HalfFloatType, LinearFilter, ClampToEdgeWrapping, AdditiveBlending, Vector2, Vector4 } from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Bloom, as a filtered pyramid rather than a stack of gaussians.
 *
 * `UnrealBloomPass` builds five separable gaussians and then bilinearly
 * upsamples the smallest of them straight across the frame. At retina
 * resolution the top mip of a 1600-wide frame is fifty pixels across, and a sun
 * that sits at HDR 12 in a single one of those texels comes back as a visible
 * **square** — which is exactly what the last round shipped, and exactly why
 * the sun read as a polygon with a halo instead of as a star.
 *
 * This is the standard dual-filter pyramid used by every modern engine:
 *
 *   prefilter (soft-knee threshold, Karis average)  →  half res
 *   13-tap box downsample                           →  ×N
 *   9-tap tent upsample, added back into each level ←  ×N
 *
 * The tent upsample is the part that matters: it reconstructs a smooth, round
 * falloff from a tiny mip instead of a bilinear quad, so a one-texel sun turns
 * into a soft circular glow with no visible geometry at any resolution.
 *
 * The threshold has a soft knee so the transition into bloom is gradual — the
 * scene's own histogram puts terrain around 0.35 and the only things past 1.05
 * are the rifts, the crystals, the water glints and the sun. That is what
 * "selective" means here: not a layer mask, a correct exposure.
 */

const PREFILTER = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tSource;
  uniform vec4 uCurve;      // x: threshold, y: threshold-knee, z: 2*knee, w: 0.25/knee
  uniform float uClamp;
  uniform vec2 uTexel;

  vec3 tap(vec2 uv){ return min(texture2D(tSource, uv).rgb, vec3(uClamp)); }

  void main(){
    // 2x2 box with a Karis average: weight each sample by 1/(1+luma) so one
    // blown pixel cannot dominate its neighbourhood and flicker.
    vec3 a = tap(vUv + uTexel * vec2(-1.0, -1.0));
    vec3 b = tap(vUv + uTexel * vec2( 1.0, -1.0));
    vec3 c = tap(vUv + uTexel * vec2(-1.0,  1.0));
    vec3 d = tap(vUv + uTexel * vec2( 1.0,  1.0));
    float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b)));
    float wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
    float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
    float wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
    vec3 col = (a * wa + b * wb + c * wc + d * wd) / max(wa + wb + wc + wd, 1e-4);

    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uCurve.y, 0.0, uCurve.z);
    soft = soft * soft * uCurve.w;
    float contrib = max(soft, br - uCurve.x) / max(br, 1e-4);
    gl_FragColor = vec4(col * contrib, 1.0);
  }`;

const DOWNSAMPLE = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tSource;
  uniform vec2 uTexel;
  void main(){
    vec2 t = uTexel;
    vec3 a = texture2D(tSource, vUv + t * vec2(-2.0,  2.0)).rgb;
    vec3 b = texture2D(tSource, vUv + t * vec2( 0.0,  2.0)).rgb;
    vec3 c = texture2D(tSource, vUv + t * vec2( 2.0,  2.0)).rgb;
    vec3 d = texture2D(tSource, vUv + t * vec2(-2.0,  0.0)).rgb;
    vec3 e = texture2D(tSource, vUv).rgb;
    vec3 f = texture2D(tSource, vUv + t * vec2( 2.0,  0.0)).rgb;
    vec3 g = texture2D(tSource, vUv + t * vec2(-2.0, -2.0)).rgb;
    vec3 h = texture2D(tSource, vUv + t * vec2( 0.0, -2.0)).rgb;
    vec3 i = texture2D(tSource, vUv + t * vec2( 2.0, -2.0)).rgb;
    vec3 j = texture2D(tSource, vUv + t * vec2(-1.0,  1.0)).rgb;
    vec3 k = texture2D(tSource, vUv + t * vec2( 1.0,  1.0)).rgb;
    vec3 l = texture2D(tSource, vUv + t * vec2(-1.0, -1.0)).rgb;
    vec3 m = texture2D(tSource, vUv + t * vec2( 1.0, -1.0)).rgb;
    vec3 col = e * 0.125;
    col += (a + c + g + i) * 0.03125;
    col += (b + d + f + h) * 0.0625;
    col += (j + k + l + m) * 0.125;
    gl_FragColor = vec4(col, 1.0);
  }`;

const UPSAMPLE = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tSource;
  uniform vec2 uTexel;
  uniform float uRadius;
  void main(){
    vec2 t = uTexel * uRadius;
    vec3 a = texture2D(tSource, vUv + t * vec2(-1.0,  1.0)).rgb;
    vec3 b = texture2D(tSource, vUv + t * vec2( 0.0,  1.0)).rgb;
    vec3 c = texture2D(tSource, vUv + t * vec2( 1.0,  1.0)).rgb;
    vec3 d = texture2D(tSource, vUv + t * vec2(-1.0,  0.0)).rgb;
    vec3 e = texture2D(tSource, vUv).rgb;
    vec3 f = texture2D(tSource, vUv + t * vec2( 1.0,  0.0)).rgb;
    vec3 g = texture2D(tSource, vUv + t * vec2(-1.0, -1.0)).rgb;
    vec3 h = texture2D(tSource, vUv + t * vec2( 0.0, -1.0)).rgb;
    vec3 i = texture2D(tSource, vUv + t * vec2( 1.0, -1.0)).rgb;
    vec3 col = e * 4.0 + (b + d + f + h) * 2.0 + (a + c + g + i);
    gl_FragColor = vec4(col * (1.0 / 16.0), 1.0);
  }`;

const VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function makeRT() {
  const rt = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}

export class BloomPass extends Pass {
  constructor({ scale = 0.5, levels = 5, threshold = 1.05, knee = 0.55, radius = 1.0 } = {}) {
    super();
    this.needsSwap = false;          // the grade composites us, not the chain
    this.renderScale = scale;
    this.maxLevels = levels;
    this.levels = levels;
    this.radius = radius;

    this.targets = [];
    for (let i = 0; i < 6; i++) this.targets.push(makeRT());

    this.prefilter = new ShaderMaterial({
      name: 'AscentBloomPrefilter',
      uniforms: {
        tSource: { value: null },
        uCurve: { value: new Vector4() },
        uClamp: { value: 24.0 },
        uTexel: { value: new Vector2() },
      },
      vertexShader: VERT, fragmentShader: PREFILTER, depthTest: false, depthWrite: false,
    });
    this.down = new ShaderMaterial({
      name: 'AscentBloomDown',
      uniforms: { tSource: { value: null }, uTexel: { value: new Vector2() } },
      vertexShader: VERT, fragmentShader: DOWNSAMPLE, depthTest: false, depthWrite: false,
    });
    this.up = new ShaderMaterial({
      name: 'AscentBloomUp',
      uniforms: { tSource: { value: null }, uTexel: { value: new Vector2() }, uRadius: { value: radius } },
      vertexShader: VERT, fragmentShader: UPSAMPLE, depthTest: false, depthWrite: false,
      blending: AdditiveBlending, transparent: true,
    });

    this.quad = new FullScreenQuad(this.prefilter);
    this.setThreshold(threshold, knee);
  }

  get texture() { return this.targets[0].texture; }

  setThreshold(threshold, knee) {
    const k = Math.max(1e-4, knee);
    this.prefilter.uniforms.uCurve.value.set(threshold, threshold - k, 2 * k, 0.25 / k);
  }

  setSize(width, height) {
    let w = Math.max(2, Math.round(width * this.renderScale));
    let h = Math.max(2, Math.round(height * this.renderScale));
    let n = 0;
    for (let i = 0; i < this.maxLevels; i++) {
      if (w < 6 || h < 6) break;
      this.targets[i].setSize(w, h);
      n++;
      w = Math.max(2, w >> 1);
      h = Math.max(2, h >> 1);
    }
    this.levels = Math.max(1, n);
  }

  render(renderer, writeBuffer, readBuffer) {
    const src = this.source || readBuffer.texture;
    const prev = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;

    // prefilter into level 0
    this.prefilter.uniforms.tSource.value = src;
    this.prefilter.uniforms.uTexel.value.set(1 / this.targets[0].width, 1 / this.targets[0].height);
    this.quad.material = this.prefilter;
    renderer.setRenderTarget(this.targets[0]);
    renderer.clear(true, false, false);
    this.quad.render(renderer);

    // downsample chain
    this.quad.material = this.down;
    for (let i = 1; i < this.levels; i++) {
      const s = this.targets[i - 1], d = this.targets[i];
      this.down.uniforms.tSource.value = s.texture;
      this.down.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      renderer.setRenderTarget(d);
      renderer.clear(true, false, false);
      this.quad.render(renderer);
    }

    // upsample chain, added back in
    this.quad.material = this.up;
    this.up.uniforms.uRadius.value = this.radius;
    for (let i = this.levels - 1; i > 0; i--) {
      const s = this.targets[i], d = this.targets[i - 1];
      this.up.uniforms.tSource.value = s.texture;
      this.up.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      renderer.setRenderTarget(d);
      this.quad.render(renderer);
    }

    renderer.autoClear = prevAuto;
    renderer.setRenderTarget(prev);
  }

  setSource(texture) { this.source = texture || null; }

  dispose() {
    for (const t of this.targets) t.dispose();
    this.prefilter.dispose(); this.down.dispose(); this.up.dispose();
    this.quad.dispose();
  }
}
