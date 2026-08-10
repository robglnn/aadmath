import * as THREE from 'three';
import { heightAt, ISLAND_R, slopeAt } from './world.js';
import { merge } from './geom.js';
// fx owns the beacon: it is a volumetric lens phenomenon, not a piece of the
// world's geometry. Same uniforms (uCol / uPow / uTime), so `sync` and `update`
// below are unchanged.
import { createBeacon } from '../fx/beacon.js';

const daisStone = new THREE.MeshStandardMaterial({ color: 0xc0b7a8, roughness: 0.88, flatShading: true });
const daisGeo = new THREE.CylinderGeometry(5.4, 6.6, 2.2, 9);
const stepGeo = new THREE.CylinderGeometry(7.4, 8.4, 1.1, 9);
const pillarGeo = new THREE.BoxGeometry(0.9, 4.2, 0.9);

/**
 * Rifts are the learning sites. One per graph node, laid out so that
 * prerequisite lines run outward from the plaza — the map *is* the knowledge
 * graph, and you can read your own progress by looking at the sky.
 */
export class Rifts {
  constructor(scene, graph) {
    this.scene = scene;
    this.list = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    const ringGeo = new THREE.TorusGeometry(2.4, 0.13, 12, 64);
    const coreGeo = new THREE.CircleGeometry(2.3, 48);

    graph.nodes.forEach((node, i) => {
      const tier = depthOf(graph, node.id);
      const a = -Math.PI / 2 + i * 2.399963 + tier * 0.55;
      const rr = 30 + tier * 26 + ((i * 13) % 9);
      let x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      // nudge to a walkable spot
      for (let k = 0; k < 24 && (heightAt(x, z) === null || slopeAt(x, z) > 0.45); k++) {
        x *= 0.9; z *= 0.9;
      }
      const gh = heightAt(x, z) ?? 6;
      const y = gh + 4.4;

      // A built place: stepped dais, four broken pillars, and a light shaft.
      //
      // All six pieces are rigid, share one material and never move, so they
      // are baked to a single geometry at build time. As six separate meshes
      // the ten rifts were sixty draw calls in the main pass and sixty more in
      // the shadow pass — a quarter of the entire frame's submissions spent on
      // scenery that could not animate. One call each, same silhouette.
      const parts = [];
      const step = stepGeo.clone(); step.translate(0, -0.2, 0); parts.push(step);
      const top = daisGeo.clone(); top.translate(0, 1.0, 0); parts.push(top);
      for (let k = 0; k < 4; k++) {
        const a2 = (k / 4) * Math.PI * 2 + 0.4;
        const hh = 2.6 + ((i * 7 + k * 3) % 5) * 0.7;
        const p = pillarGeo.clone();
        p.scale(1, hh / 4.2, 1);
        p.rotateY(a2);
        p.translate(Math.cos(a2) * 4.4, 1.9 + hh * 0.5, Math.sin(a2) * 4.4);
        parts.push(p);
      }
      const dais = new THREE.Mesh(merge(parts), daisStone);
      for (const p of parts) p.dispose();
      dais.position.set(x, gh, z);
      dais.castShadow = true;
      dais.receiveShadow = true;
      this.group.add(dais);

      const beacon = createBeacon(i);
      beacon.position.set(x, gh + 1.8, z);
      beacon.renderOrder = 4;
      this.group.add(beacon);

      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.lookAt(0, y, 0);

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x9bd8ff, emissive: 0x2f9fd6, emissiveIntensity: 2.2,
        roughness: 0.25, metalness: 0.3,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      g.add(ring);

      const coreMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uMastered: { value: 0 } },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */`
          varying vec2 vUv; uniform float uTime,uOpen,uMastered;
          float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          void main(){
            vec2 c = vUv-0.5;
            float r = length(c)*2.0;
            float ang = atan(c.y,c.x);
            // swirling filaments pulled toward the centre
            float sw = n(vec2(ang*2.2 + uTime*0.5, r*4.0 - uTime*1.3));
            sw += 0.5*n(vec2(ang*5.0 - uTime*0.8, r*8.0 - uTime*2.1));
            float body = smoothstep(1.02,0.2,r) * (0.35 + sw*0.8);
            vec3 cool = vec3(0.28,0.78,1.0);
            vec3 warm = vec3(0.68,0.55,1.0);
            vec3 good = vec3(0.55,0.96,0.68);
            vec3 col = mix(cool, warm, sw*0.7);
            col = mix(col, good, uMastered);
            float edge = smoothstep(0.86,1.0,r)*smoothstep(1.12,0.98,r);
            col += vec3(1.0)*edge*0.7;
            float a = clamp(body*(0.35+0.65*uOpen), 0.0, 1.0);
            gl_FragColor = vec4(col*a*1.6, a);
          }`,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      g.add(core);

      const light = new THREE.PointLight(0x6fd0ff, 8, 26, 2);
      light.position.set(0, 0, 0.4);
      g.add(light);

      // a slow guardian ring of shards, one per prerequisite satisfied
      const shards = new THREE.Group();
      for (let s = 0; s < 5; s++) {
        const sh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22, 0),
          new THREE.MeshStandardMaterial({ color: 0xdff4ff, emissive: 0x59c7f5, emissiveIntensity: 1.4, roughness: 0.2 })
        );
        const t = (s / 5) * Math.PI * 2;
        sh.position.set(Math.cos(t) * 3.15, Math.sin(t) * 3.15, 0);
        shards.add(sh);
      }
      g.add(shards);

      this.group.add(g);
      this.list.push({
        id: node.id, node, group: g, ring, core, coreMat, light, shards, beacon, dais,
        pos: new THREE.Vector3(x, y, z), tier,
        locked: node.prereqs.length > 0, mastered: false, phase: Math.random() * 6.28,
      });
    });
  }

  /** Reflect mastery state into the world: locked rifts are dim and closed. */
  sync(engineState) {
    for (const r of this.list) {
      const st = engineState.get(r.id);
      const unlocked = engineState.isUnlocked(r.id);
      r.locked = !unlocked;
      r.mastered = !!st?.mastered;
      r.coreMat.uniforms.uMastered.value = r.mastered ? 1 : 0;
      const openTarget = r.locked ? 0.08 : 1;
      r.coreMat.uniforms.uOpen.value = openTarget;
      r.ring.material.emissiveIntensity = r.locked ? 0.25 : (r.mastered ? 3.0 : 2.2);
      r.ring.material.color.setHex(r.locked ? 0x54606e : (r.mastered ? 0x9bffc4 : 0x9bd8ff));
      r.light.intensity = r.locked ? 1.2 : (r.mastered ? 11 : 8);
      r.light.color.setHex(r.mastered ? 0x8effc0 : 0x6fd0ff);
      r.shards.visible = !r.locked;
      r.beacon.material.uniforms.uCol.value.setHex(r.locked ? 0x4a5a6a : (r.mastered ? 0x8effc0 : 0x6fd0ff));
      r.beacon.material.uniforms.uPow.value = r.locked ? 0.22 : (r.mastered ? 1.15 : 0.85);
    }
  }

  update(dt, t) {
    for (const r of this.list) {
      r.coreMat.uniforms.uTime.value = t;
      r.beacon.material.uniforms.uTime.value = t;
      r.ring.rotation.z = t * (r.mastered ? 0.5 : 0.22) + r.phase;
      r.shards.rotation.z = -t * 0.35 + r.phase;
      r.group.position.y = r.pos.y + Math.sin(t * 0.7 + r.phase) * 0.22;
      // fx: this used to be a *= on the live value, i.e. a per-frame random
      // walk with no fixed point; the pulse has to be applied to a base.
      const base = r.locked ? 1.2 : (r.mastered ? 11 : 8);
      r.light.intensity = base * (0.94 + 0.10 * (0.5 + 0.5 * Math.sin(t * 3 + r.phase)));
    }
  }

  /** Nearest interactable rift within range of a world position. */
  nearest(p, range = 6.2) {
    let best = null, bd = range;
    for (const r of this.list) {
      if (r.locked) continue;
      const d = p.distanceTo(r.group.position);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
}

function depthOf(graph, id, seen = new Set()) {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n || !n.prereqs.length || seen.has(id)) return 0;
  seen.add(id);
  return 1 + Math.max(...n.prereqs.map((p) => depthOf(graph, p, seen)));
}
