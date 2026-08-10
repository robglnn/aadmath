import * as THREE from 'three';

/**
 * Why you build.
 *
 * A build verb with no destination is a toy. The lattice anchors are three
 * points of unfinished structure hanging over the plaza, at thirteen, twenty-one
 * and thirty-two metres — above a double jump, above the wing's reach from flat
 * ground, and deliberately over open air so the only way up is a ramp you set
 * yourself. Each one drops a plumb line to the ground so the question it asks is
 * legible from the first frame: *get up here*.
 *
 * They are also the reason collision has to be real. You cannot cheat this with
 * a decoration you walk through.
 */
/**
 * Height above the ground, and how far out from the landing.
 *
 * Ten metres is the number that matters: a jump gets you two and a half, the
 * double jump another two, and the wing only ever trades height for distance.
 * Nothing in the cadet's kit reaches ten metres of still air. The distances are
 * set so all three sit inside the opening frame rather than above it — an
 * objective you have to look up to find is an objective nobody finds.
 */
const PLAN = [
  { h: 10.5, r: 23, a: -0.55 },
  { h: 18.5, r: 31, a: 0.55 },
  { h: 28.0, r: 40, a: -1.5 },
];

/** A soft radial glow, drawn once into a 64px canvas and shared by every halo. */
let HALO_TEX = null;
function haloMat() {
  if (!HALO_TEX) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.22, 'rgba(190,236,255,0.55)');
    grad.addColorStop(0.55, 'rgba(120,200,255,0.13)');
    grad.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    HALO_TEX = new THREE.CanvasTexture(c);
    HALO_TEX.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.SpriteMaterial({
    map: HALO_TEX, color: 0x9fdcff, transparent: true, opacity: 0.34,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
}

export class Anchors {
  constructor(scene, groundAt, origin = new THREE.Vector3(0, 0, 20)) {
    this.group = new THREE.Group();
    this.group.name = 'lattice-anchors';
    scene.add(this.group);
    this.list = [];
    this.secured = 0;

    const coreGeo = new THREE.OctahedronGeometry(0.95, 0);
    const ringGeo = new THREE.TorusGeometry(2.05, 0.075, 8, 40);
    const padGeo = new THREE.RingGeometry(2.2, 2.55, 40);
    padGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < PLAN.length; i++) {
      const plan = PLAN[i];
      // the landing faces -z, so the anchors are laid out ahead of it
      let x = origin.x + Math.sin(plan.a) * plan.r;
      let z = origin.z - Math.cos(plan.a) * plan.r;
      let g = groundAt(x, z);
      // an anchor over open air has nothing to build up from: walk it back in
      for (let k = 0; k < 12 && g === null; k++) {
        x = origin.x + (x - origin.x) * 0.85;
        z = origin.z + (z - origin.z) * 0.85;
        g = groundAt(x, z);
      }
      const gy = g === null ? origin.y : g;
      const y = gy + plan.h;

      const node = new THREE.Group();
      node.position.set(x, y, z);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xdff4ff, emissive: 0x4fc3f0, emissiveIntensity: 2.4,
        roughness: 0.22, metalness: 0.4,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      node.add(core);

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xbfe9ff, emissive: 0x3aa8dd, emissiveIntensity: 2.0,
        roughness: 0.3, metalness: 0.5,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.6;
      node.add(ring);

      // No point light. Ten rifts already carry one each, and a forward
      // renderer charges every lit fragment in the frame for each extra one —
      // three more cost several milliseconds to light three metres of air.
      // Emissive plus the HDR bloom does the same job for nothing.
      const halo = new THREE.Sprite(haloMat());
      halo.scale.setScalar(7.5);
      halo.userData.noCamBlock = true;
      node.add(halo);
      this.group.add(node);

      // the plumb line: a hairline of light straight down to the ground, so the
      // anchor names the column you have to build in
      const h = y - gy;
      const lineGeo = new THREE.CylinderGeometry(0.055, 0.055, h, 6, 1, true);
      lineGeo.translate(0, -h / 2, 0);
      const lineMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0x7fd6ff) }, uPow: { value: 1 } },
        vertexShader: /* glsl */`
          varying vec2 vUv; varying float vY;
          void main(){ vUv = uv; vY = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
          precision highp float;
          varying vec2 vUv; varying float vY;
          uniform float uTime; uniform vec3 uCol; uniform float uPow;
          void main(){
            float dash = step(0.42, fract(vY * 0.42 + uTime * 0.25));
            float a = dash * 0.24 * uPow * (0.5 + 0.5 * vUv.y);
            gl_FragColor = vec4(uCol * a * 1.6, a);
          }`,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.copy(node.position);
      line.userData.noCamBlock = true;
      line.renderOrder = 2;
      this.group.add(line);

      const padMat = new THREE.MeshBasicMaterial({
        color: 0x6fd0ff, transparent: true, opacity: 0.34,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(x, gy + 0.12, z);
      pad.userData.noCamBlock = true;
      this.group.add(pad);

      this.list.push({
        i, node, core, coreMat, ring, ringMat, halo, line, lineMat, pad, padMat,
        pos: node.position.clone(), base: gy, done: false, pop: 0, phase: i * 2.1,
      });
    }
  }

  /** @returns the anchor just secured, or null */
  update(dt, time, playerPos) {
    let hit = null;
    for (const a of this.list) {
      a.lineMat.uniforms.uTime.value = time;
      const bob = Math.sin(time * 0.9 + a.phase) * 0.34;
      a.node.position.y = a.pos.y + bob;
      a.core.rotation.y = time * 0.6 + a.phase;
      a.core.rotation.x = time * 0.33;
      a.ring.rotation.z = -time * (a.done ? 1.5 : 0.55) + a.phase;

      if (!a.done && playerPos && playerPos.distanceTo(a.node.position) < 3.4) {
        a.done = true;
        a.pop = 1;
        this.secured++;
        a.coreMat.color.setHex(0xe8fff2);
        a.coreMat.emissive.setHex(0x64e6a0);
        a.ringMat.emissive.setHex(0x64e6a0);
        a.ringMat.color.setHex(0xd8ffe8);
        a.halo.material.color.setHex(0x9effc8);
        a.lineMat.uniforms.uCol.value.setHex(0x8effc0);
        a.padMat.color.setHex(0x8effc0);
        hit = a;
      }
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + a.phase);
      if (a.pop > 0) {
        a.pop = Math.max(0, a.pop - dt * 1.6);
        const s = 1 + a.pop * a.pop * 1.5;
        a.core.scale.setScalar(s);
        a.ring.scale.setScalar(1 + a.pop * 0.6);
        a.halo.scale.setScalar(7.5 + a.pop * 22);
        a.halo.material.opacity = 0.5 + a.pop * 0.5;
        a.lineMat.uniforms.uPow.value = 1 + a.pop * 2;
      } else if (a.done) {
        a.halo.material.opacity = 0.34 + pulse * 0.08;
        a.lineMat.uniforms.uPow.value = 0.45;
      } else {
        a.halo.scale.setScalar(7.5 + pulse * 0.9);
        a.halo.material.opacity = 0.30 + pulse * 0.12;
      }
    }
    return hit;
  }

  get total() { return this.list.length; }
}
