import { Scene, Camera, Mesh, PlaneGeometry, ShaderMaterial, AdditiveBlending, LessEqualDepth, Vector2, Vector3 } from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * The star itself.
 *
 * The sky shader paints a disc, but a disc alone is not what a camera sees when
 * it points at a sun: it sees a small, *hard-edged* core that is orders of
 * magnitude brighter than anything else, a tight aureole around it, and — on
 * any anamorphic front element — a long horizontal streak. Last round the only
 * thing standing in for all of that was the bloom's top mip, which is why the
 * sun photographed as a white square.
 *
 * So we draw it, additively, into the HDR buffer **before** the bloom pyramid
 * runs. Two consequences, both of them the point:
 *
 *  - the core is a real circle at full frame resolution, so it stays a circle
 *    however far the render scale is governed down;
 *  - it is the brightest thing in the buffer by a wide margin, so the bloom
 *    threshold picks it and *only* it out of the sky, and the glow you see is
 *    the pyramid's, correctly shaped, instead of a bilinear quad.
 *
 * It is occluded by the world for free. The quad is drawn just inside the far
 * plane with the depth test on, so a fragment survives only where nothing was
 * written — which is exactly where the sky is. Walk behind a pillar and the
 * star is cut by the pillar's own silhouette, per pixel, with no depth fetch,
 * no readback and no framebuffer feedback loop.
 *
 * Drawn as a small screen-space quad rather than a fullscreen pass, so it costs
 * a fraction of the frame even at the moment it is most visible.
 */
export class SunPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;

    this.material = new ShaderMaterial({
      name: 'AscentSun',
      uniforms: {
        uCenter: { value: new Vector2(0, 0) },   // NDC
        uHalf: { value: new Vector2(0.92, 0.34) }, // half extents, NDC-y units
        uAspect: { value: 1.78 },
        uIntensity: { value: 1 },
        uCore: { value: new Vector3(1.0, 0.94, 0.86) },
        uWarm: { value: new Vector3(1.0, 0.72, 0.42) },
        uStreak: { value: new Vector3(0.72, 0.86, 1.0) },
        uDiscR: { value: 0.052 },
      },
      transparent: true,
      blending: AdditiveBlending,
      // The star is *depth tested*, not depth sampled. Sampling the depth
      // attachment of the buffer we are drawing into is a framebuffer feedback
      // loop — ANGLE answers one with a dropped draw call — and the hardware
      // test is both free and per-pixel exact: a fragment survives only where
      // nothing was written, which is precisely where the sky is.
      depthTest: true,
      depthWrite: false,
      depthFunc: LessEqualDepth,
      vertexShader: /* glsl */`
        uniform vec2 uCenter, uHalf;
        uniform float uAspect;
        varying vec2 vOff;      // offset from the sun, NDC-y units (circular)
        void main(){
          vOff = position.xy * uHalf;
          vec2 ndc = vec2(vOff.x / uAspect, vOff.y) + uCenter;
          // just inside the far plane: behind every piece of geometry in the
          // world and in front of the cleared depth the sky leaves behind
          gl_Position = vec4(ndc, 0.999995, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vOff;
        uniform float uIntensity, uDiscR;
        uniform vec3 uCore, uWarm, uStreak;

        void main(){
          float r = length(vOff);

          // hard-edged core — a couple of pixels of transition, so it reads as a
          // star with an edge rather than as the middle of a glow
          float disc = smoothstep(uDiscR, uDiscR * 0.86, r);
          // tight aureole, deliberately dim: the edge of the disc has to survive
          float halo = exp(-r * 30.0) * 0.30 + exp(-r * 9.0) * 0.09;
          // anamorphic streak: long, thin, cool
          float streak = exp(-abs(vOff.x) * 5.2) * exp(-abs(vOff.y) * 110.0);
          streak += exp(-abs(vOff.x) * 2.4) * exp(-abs(vOff.y) * 30.0) * 0.34;

          vec3 col = uCore * disc * 44.0
                   + mix(uWarm, uCore, 0.4) * halo * 2.4
                   + uStreak * streak * 7.0;

          gl_FragColor = vec4(col * uIntensity, 1.0);
        }`,
    });

    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene = new Scene();
    this.scene.add(this.mesh);
    this.camera = new Camera();
  }

  setAspect(a) { this.material.uniforms.uAspect.value = a; }
  setSun(ndcX, ndcY) { this.material.uniforms.uCenter.value.set(ndcX, ndcY); }
  setIntensity(v) { this.material.uniforms.uIntensity.value = v; }

  /** Draws additively into whatever buffer is handed in. */
  render(renderer, writeBuffer, readBuffer) {
    const target = this.target || readBuffer;
    const prev = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prevAuto;
    renderer.setRenderTarget(prev);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
