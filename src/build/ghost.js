import * as THREE from 'three';
import { KINDS, SPEC } from './pieces.js';
import { buildGeometry } from './lattice.js';

/**
 * The preview.
 *
 * A build preview has exactly one job: before you commit, you must already know
 * the cell, the level, the facing, and whether it will take. The old ghost was
 * a 5% tinted box with no ground contact, so it answered none of those and the
 * verb felt like guessing. This one draws the piece itself in hard light, and
 * under it a **footprint** — a bracketed square lying on the level the piece
 * will be founded on. The footprint is the part you actually read: it tells you
 * the cell and the height at a glance, from any camera angle, and it turns red
 * the instant there is nothing to build from.
 */
export class Ghost {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'axiom-ghost';
    scene.add(this.group);

    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, fog: false,
      uniforms: {
        uTime: { value: 0 }, uBad: { value: 0 }, uPow: { value: 1 },
      },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          vL = position;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        uniform float uTime; uniform float uBad; uniform float uPow;
        void main(){
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
          // a slow band travelling up the piece: unbuilt, but alive
          float scan = 0.5 + 0.5 * sin((vL.y * 2.6) - uTime * 3.4);
          float a = (0.21 + fres * 0.58 + scan * 0.13) * uPow;
          vec3 good = mix(vec3(0.22, 0.72, 1.0), vec3(0.85, 0.98, 1.0), fres);
          vec3 bad  = mix(vec3(1.0, 0.24, 0.42), vec3(1.0, 0.74, 0.80), fres);
          gl_FragColor = vec4(mix(good, bad, uBad) * a, a);
        }`,
    });

    this.panelMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uBad: { value: 0 }, uPow: { value: 1 } },
      vertexShader: /* glsl */`
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        uniform float uTime; uniform float uBad; uniform float uPow;
        void main(){
          // travelling hatch — the universal "not committed yet" texture
          float h = fract((vUv.x + vUv.y) * 6.0 - uTime * 0.65);
          float band = smoothstep(0.46, 0.5, h) * smoothstep(0.94, 0.9, h);
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float a = (band * 0.055 + fres * 0.07 + 0.010) * uPow;
          vec3 good = vec3(0.30, 0.76, 1.0);
          vec3 bad = vec3(1.0, 0.30, 0.45);
          gl_FragColor = vec4(mix(good, bad, uBad) * a, a);
        }`,
    });

    // the footprint: a bracketed square on the level the piece founds on
    const fp = new THREE.PlaneGeometry(4.6, 4.6);
    fp.rotateX(-Math.PI / 2);
    this.padMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, fog: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uBad: { value: 0 }, uPow: { value: 1 } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv;
        uniform float uTime; uniform float uBad; uniform float uPow;
        void main(){
          vec2 p = abs(vUv - 0.5) * 2.0;      // 0 at centre, 1 at the rim
          float sq = max(p.x, p.y);
          // corner brackets: the shape a targeting reticle makes on the ground
          float arm = step(0.60, min(p.x, p.y));
          float edge = smoothstep(0.80, 0.845, sq) * smoothstep(0.90, 0.86, sq);
          float bracket = edge * arm;
          float thin = smoothstep(0.855, 0.87, sq) * smoothstep(0.885, 0.872, sq);
          float pulse = 0.72 + 0.28 * sin(uTime * 4.4);
          float a = (bracket * 0.95 * pulse + thin * 0.30 + (1.0 - smoothstep(0.0, 0.9, sq)) * 0.035) * uPow;
          vec3 good = vec3(0.55, 0.93, 1.0);
          vec3 bad = vec3(1.0, 0.32, 0.46);
          gl_FragColor = vec4(mix(good, bad, uBad) * a, a);
        }`,
    });
    this.pad = new THREE.Mesh(fp, this.padMat);
    this.pad.renderOrder = 5;
    this.pad.userData.noCamBlock = true;
    this.group.add(this.pad);

    this.parts = {};
    for (const kind of KINDS) {
      const g = buildGeometry(kind);
      const frame = new THREE.Mesh(g.frame, this.mat);
      frame.renderOrder = 4;
      frame.userData.noCamBlock = true;
      frame.visible = false;
      const panel = new THREE.Mesh(g.panel, this.panelMat);
      panel.renderOrder = 4;
      panel.userData.noCamBlock = true;
      panel.visible = false;
      this.group.add(frame, panel);
      this.parts[kind] = { frame, panel };
    }
    this.kind = 'wall';
    this.visible = true;
  }

  setKind(kind) {
    if (kind === this.kind) return;
    this.kind = kind;
  }

  /**
   * @param tg {kind,x,y,z,yaw,base,valid} — where the piece would land
   * @param camera used only to duck the solid preview when the lens is inside it
   */
  update(dt, time, tg, camera) {
    this.mat.uniforms.uTime.value = time;
    this.panelMat.uniforms.uTime.value = time;
    this.padMat.uniforms.uTime.value = time;
    const bad = tg && tg.valid ? 0 : 1;
    this.mat.uniforms.uBad.value = bad;
    this.panelMat.uniforms.uBad.value = bad;
    this.padMat.uniforms.uBad.value = bad;

    const on = !!tg && this.visible;
    for (const k of KINDS) {
      const p = this.parts[k];
      const show = on && k === tg.kind;
      p.frame.visible = show;
      p.panel.visible = show;
      if (!show) continue;
      p.frame.position.set(tg.x, tg.y, tg.z);
      p.frame.rotation.y = tg.yaw;
      p.panel.position.copy(p.frame.position);
      p.panel.rotation.y = tg.yaw;
    }
    this.pad.visible = on;
    if (!on) return;

    this.pad.position.set(tg.x, tg.base + 0.06, tg.z);
    this.pad.rotation.y = tg.yaw;

    // Never let the preview become a full-screen wash: if the lens is inside
    // the piece, keep the footprint and fade the body out.
    let pow = 1;
    if (camera) {
      const d = camera.position.distanceTo(this.parts[tg.kind].frame.position);
      pow = THREE.MathUtils.clamp((d - 1.1) / 1.8, 0, 1);
    }
    this.mat.uniforms.uPow.value = pow;
    this.panelMat.uniforms.uPow.value = pow;
    this.padMat.uniforms.uPow.value = 1;
  }
}

export { SPEC };
