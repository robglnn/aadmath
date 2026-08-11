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
// the standing pad on the dais, and the bars that shut a rift the cadet has
// not earned yet — one geometry each, ten rifts
const padGeo = new THREE.RingGeometry(2.5, 3.4, 44);
padGeo.rotateX(-Math.PI / 2);
const barGeo = new THREE.BoxGeometry(5.0, 0.42, 0.42);

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

      // ---- THE SEAL -------------------------------------------------------
      // Nine of the ten rings are shut on a fresh save, and until now the only
      // thing that said so was a slightly dimmer blue. A player walked into
      // ring after identical ring and nothing happened, which is the single
      // worst thing an interactable can do. A shut rift now wears its lock:
      // three stone bars across the aperture, and they swing away when the
      // prerequisite is held. You can read the whole knowledge graph off the
      // skyline from two hundred metres without a word of UI.
      const seal = new THREE.Group();
      const barMat = new THREE.MeshStandardMaterial({
        color: 0x8d9aab, emissive: 0x1b2836, emissiveIntensity: 0.8,
        roughness: 0.72, metalness: 0.3, flatShading: true,
      });
      for (let s = 0; s < 3; s++) {
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.rotation.z = (s - 1) * 0.62;
        bar.position.y = (s - 1) * 1.35;
        bar.castShadow = true;
        seal.add(bar);
      }
      g.add(seal);

      // ---- THE PAD --------------------------------------------------------
      // The ring floats four metres over the dais, so nobody can literally walk
      // *through* it: the thing you stand on is the dais. Say so. A lit ring on
      // the stone names the exact spot, exactly the way an updraft's footprint
      // does, and it is the only place in the world that looks like that.
      const padMat = new THREE.MeshBasicMaterial({
        color: 0x8fe4ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(x, gh + 2.2, z);
      pad.userData.noCamBlock = true;
      pad.renderOrder = 3;
      this.group.add(pad);

      this.group.add(g);
      this.list.push({
        id: node.id, node, group: g, ring, core, coreMat, light, shards, beacon, dais,
        seal, pad, padMat,
        pos: new THREE.Vector3(x, y, z), foot: new THREE.Vector3(x, gh + 2.2, z), tier,
        locked: node.prereqs.length > 0, mastered: false, phase: Math.random() * 6.28,
        // what is standing between the cadet and this tear, filled in by sync()
        blockers: node.prereqs.slice(), sealT: 0, hitT: 0,
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
      // What is actually standing in the way — named, so the world can say it
      // out loud instead of leaving the cadet to guess.
      r.blockers = r.node.prereqs.filter((p) => !engineState.get(p)?.mastered);
      r.padMat.color.setHex(r.locked ? 0xff9a6b : (r.mastered ? 0x8effc0 : 0x8fe4ff));
      r.padMat.opacity = r.locked ? 0.24 : 0.5;
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

      // the bars: shut when locked, swung open and gone when the line is yours
      r.sealT += ((r.locked ? 1 : 0) - r.sealT) * Math.min(1, dt * 3.2);
      r.seal.visible = r.sealT > 0.02;
      r.seal.scale.setScalar(0.02 + r.sealT * 0.98);
      for (let s = 0; s < r.seal.children.length; s++) {
        r.seal.children[s].rotation.z = (s - 1) * 0.62 + (1 - r.sealT) * 1.4;
      }
      // …and they shudder when someone tries the door
      if (r.hitT > 0) {
        r.hitT = Math.max(0, r.hitT - dt);
        const k = r.hitT * r.hitT;
        r.seal.position.x = Math.sin(t * 46) * k * 0.34;
        r.ring.material.emissiveIntensity = 0.25 + k * 5;
      } else if (r.seal.position.x) r.seal.position.x = 0;

      // the pad: a standing-here invitation that breathes, and it only breathes
      // for a door that is actually open
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + r.phase);
      r.pad.scale.setScalar(r.locked ? 0.9 : 0.98 + pulse * 0.07);
      r.padMat.opacity = r.locked ? 0.20 + pulse * 0.05 : (r.mastered ? 0.3 : 0.42 + pulse * 0.26);
    }
  }

  /** Rap on a shut door: the bars shudder, so the refusal is visible. */
  refuse(r) { r.hitT = 0.55; }

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

  /**
   * Nearest rift of ANY state, measured to the dais a cadet actually stands on
   * rather than to a ring hanging four metres over his head.
   *
   * `nearest()` skips locked rifts, which is right for "what does E open" and
   * catastrophic for "what is the player standing in": on a fresh save nine of
   * the ten rings are shut, so every one of them was invisible to the whole
   * game and walking into it produced, correctly and disastrously, nothing.
   */
  nearestAny(p, range = 7.5) {
    let best = null, bd = range;
    for (const r of this.list) {
      const d = Math.hypot(p.x - r.foot.x, p.z - r.foot.z);
      if (d < bd && Math.abs(p.y - r.foot.y) < 9) { bd = d; best = r; }
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
