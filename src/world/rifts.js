import * as THREE from 'three';
import { heightAt, ISLAND_R, slopeAt } from './world.js';
import { merge } from './geom.js';
// fx owns the beacon: it is a volumetric lens phenomenon, not a piece of the
// world's geometry. Same uniforms (uCol / uPow / uTime), so `sync` and `update`
// below are unchanged.
import { createBeacon } from '../fx/beacon.js';

const daisStone = new THREE.MeshStandardMaterial({ color: 0xc0b7a8, roughness: 0.88, flatShading: true });
// ---- A DOORWAY, NOT A PEDESTAL -------------------------------------------
// The dais used to stand 2.1 m proud of the ground with the ring floating a
// further 2.3 m over that, and a cold critic wrote the consequence down: *"I
// walked bodily into the first glowing ring five separate times, stood inside
// its footprint… every natural walking line from the spawn plaza runs into the
// plinth face instead of onto it."* He was reading the silhouette correctly.
// A waist-high stone wall around a ring hung over head height is a monument you
// look at, and the whole game asks you to walk into it.
//
// So the podium is now two courses of stone that top out 62 cm above the
// ground — a kerb you step over without noticing — and the ring stands *on*
// it, at head height, aperture open to the grass. Walking into a rift is now
// walking through a door, which is what every player tried to do first.
const DAIS_TOP = 0.62;    // metres of stone above the ground at the crown
const RING_Y = 2.72;      // ring centre: a 2.4 m aperture standing on the podium
const daisGeo = new THREE.CylinderGeometry(5.4, 6.0, 1.0, 9);
const stepGeo = new THREE.CylinderGeometry(7.4, 8.4, 1.1, 9);
const pillarGeo = new THREE.BoxGeometry(0.9, 4.2, 0.9);
// the standing pad on the dais, and the bars that shut a rift the cadet has
// not earned yet — one geometry each, ten rifts
const padGeo = new THREE.RingGeometry(2.5, 3.4, 44);
padGeo.rotateX(-Math.PI / 2);
const barGeo = new THREE.BoxGeometry(5.0, 0.42, 0.42);
// ---- THE KEYSTONE ---------------------------------------------------------
// What a *sealed* tear looks like. A live tear is a hole with a vortex turning
// in it; a sealed one is a hole that has been filled — a solid nonagonal plate
// of set lattice with the seal cut across it. Nine faces, so it reads as
// masonry rather than as a disc, and the same nine as the dais under it.
const keyGeo = new THREE.CylinderGeometry(2.34, 2.34, 0.34, 9);
keyGeo.rotateX(Math.PI / 2);
const seamGeo = new THREE.BoxGeometry(4.34, 0.26, 0.42);

// ---- HOW FAR AWAY A TEAR IS STILL IN HAND ---------------------------------
//
// ONE NUMBER, EXPORTED, BECAUSE TWO SURFACES DISAGREEING ABOUT IT COST A
// PLAYER FOUR MINUTES.
//
// A cold critic walked to within ten metres of the first rift and the game
// stopped having an opinion. The objective card printed YOU ARE STANDING IN IT
// — no distance, no bearing, no waypoint — while the interact key did nothing,
// because the card believed a tear was in hand inside eleven metres and the key
// knew it was in hand inside nine. Between those two numbers lay a two-metre
// ring around every rift on the island in which the game offered a player
// neither a direction to walk nor an action to take. He reproduced it three
// times and could not get out of it: Recover put him back down in the same
// ring, and every compass direction from it read either "standing in it" or the
// distance to a different tear entirely.
//
// A reach is a property of the built place, so it lives with the built place,
// it is exported, and everything that draws a conclusion about "near a rift"
// asks the same function. `src/meta/guide.js` (the objective card and its
// waypoint) and `src/world/afford.js` (the plate and the key printed on it)
// both read these; neither is allowed a threshold of its own ever again.
/** Metres, horizontal, from the plate you stand on. The dais and its skirt. */
export const REACH = 9.0;
/** Metres of height difference above which you are on a different storey. */
export const REACH_Y = 9;

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

    // ---- WHERE THE TEARS STAND ------------------------------------------
    // The old placement was an ideal point on a spiral followed by *"nudge to
    // a walkable spot"* — `x *= 0.9; z *= 0.9` up to twenty-four times, which
    // is not a nudge, it is a slide down the funnel toward the plaza. Every
    // node whose ideal site was off the walkable island slid down the same
    // funnel, and on the shipping graph two of them landed **87 centimetres
    // apart**: `var-meaning`, the very first tear, and `one-step-add`, which is
    // locked behind it.
    //
    // A cold critic met the result and could not name it, only suffer it: two
    // labels on one ring in the sky, one reading OPEN THE RIFT and one reading
    // SEALED SHUT, and — because contact takes the *nearest* dais and half of
    // all approach bearings put the locked twin nearer — a red "Rift surge"
    // refusal for walking into the first objective in the game. That is the P0.
    //
    // Placement is now a search rather than a slide. A site must (a) have
    // ground under the whole dais, (b) stand clear of every tear already
    // placed, and (c) be joined to its own prerequisite — or to the plaza, for
    // a root — by a line a cadet can actually walk. Candidates are tried
    // outward from the ideal point, nearest first, so the spiral the map is
    // read by survives intact.
    const MIN_SEP = 26;      // metres between two daises: no two ever overlap
    const PAD_R = 7.2;       // the dais needs ground under all of it
    // Metres of rise per 2.5 m of walking. The boots stop at a gradient of 1.5
    // and mantle a 2.7 m ledge, so 2.6 is a steep hill a cadet can run up and
    // anything above it is a face he cannot. (src/player/locomotion.js)
    const STEP_MAX = 2.6;
    const sites = new Map();

    const padOk = (x, z) => {
      if (heightAt(x, z) === null || slopeAt(x, z) > 0.40) return false;
      for (let k = 0; k < 6; k++) {
        const a2 = (k / 6) * Math.PI * 2;
        if (heightAt(x + Math.cos(a2) * PAD_R, z + Math.sin(a2) * PAD_R) === null) return false;
      }
      return true;
    };

    /** Is there a walk from (ax,az) to (bx,bz) with no hole and no cliff in it? */
    const walkable = (ax, az, bx, bz) => {
      const d = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.ceil(d / 2.5));
      let prev = heightAt(ax, az);
      if (prev === null) return false;
      for (let k = 1; k <= n; k++) {
        const x = ax + (bx - ax) * (k / n), z = az + (bz - az) * (k / n);
        const h = heightAt(x, z);
        if (h === null || Math.abs(h - prev) > STEP_MAX) return false;
        prev = h;
      }
      return true;
    };

    /**
     * The nearest site to an ideal point that a cadet can actually use.
     *
     * Searched in rings *around the ideal point*, not around the island's
     * centre: a tear belongs thirty-odd metres beyond the line that unlocks it,
     * and a polar search around the origin answers "somewhere on this
     * hundred-metre circle", which is how `order-ops` ended up a hundred and
     * eight metres from its own prerequisite on the far side of a basin.
     */
    const siteFor = (ix, iz, from) => {
      const fromH = heightAt(from.x, from.z);
      let best = null, bestCost = Infinity, loose = null;
      for (let ring = 0; ring < 15; ring++) {
        const rad = ring * 5;
        const steps = ring === 0 ? 1 : ring * 8;
        for (let k = 0; k < steps; k++) {
          const th = (k / steps) * Math.PI * 2 + ring * 0.19;
          const x = ix + Math.cos(th) * rad, z = iz + Math.sin(th) * rad;
          if (Math.hypot(x, z) > ISLAND_R - 20) continue;
          if (!padOk(x, z)) continue;
          let clear = true;
          for (const s of sites.values()) {
            if (Math.hypot(x - s.x, z - s.z) < MIN_SEP) { clear = false; break; }
          }
          if (!clear) continue;
          if (!walkable(from.x, from.z, x, z)) {
            // separated and solid, but the approach is a cliff — keep it as the
            // answer of last resort and go on looking for a road.
            if (!loose) loose = { x, z };
            continue;
          }
          // Of the sites that work, take the one that costs the player least:
          // drift from where the lattice says the tear lives, how far he now
          // has to walk, and how much of that walk is climbing. A session is
          // twenty minutes long and a hundred-metre hike between two rifts
          // spends a quarter of it.
          const gh2 = heightAt(x, z);
          const climb = (fromH === null || gh2 === null) ? 0 : Math.abs(gh2 - fromH);
          const cost = rad
            + Math.max(0, Math.hypot(x - from.x, z - from.z) - 36) * 1.5
            + climb * 0.7;
          if (cost < bestCost) { bestCost = cost; best = { x, z }; }
        }
        if (best && rad >= bestCost) break;
      }
      return best || loose || { x: ix, z: iz };
    };

    // ---- THE IDEAL MAP: the lattice, laid on the ground ------------------
    // Ideal bearings used to come off a golden-angle spiral keyed to the node's
    // *index*, which scatters a prerequisite chain to opposite sides of the
    // island — `distribute` two hundred metres from the line that unlocks it.
    // A tear now stands thirty-two metres beyond its own prerequisite, on the
    // bearing that leads away from the plaza, with siblings fanned either side.
    // Walk outward from the landing and you are walking up the knowledge graph:
    // the branches on the ground are the branches in the lattice.
    const OUT = 32;          // metres a tear stands beyond its prerequisite
    const kids = new Map();
    for (const n of graph.nodes) {
      for (const p of n.prereqs || []) {
        if (!kids.has(p)) kids.set(p, []);
        if (!kids.get(p).includes(n.id)) kids.get(p).push(n.id);
      }
    }
    const plan = new Map();
    const queue = [];
    graph.nodes.filter((n) => !n.prereqs?.length).forEach((n, k) => {
      // A root tear stands straight ahead of where the cadet makes planetfall.
      plan.set(n.id, { a: -Math.PI / 2 + k * 2.2, from: null });
      queue.push(n.id);
    });
    while (queue.length) {
      const id = queue.shift();
      const base = plan.get(id);
      const cs = (kids.get(id) || []).filter((c) => !plan.has(c));
      cs.forEach((c, k) => {
        plan.set(c, { fan: (k - (cs.length - 1) / 2) * 0.72, from: id });
        queue.push(c);
      });
    }

    graph.nodes.forEach((node, i) => {
      const tier = depthOf(graph, node.id);
      const want = plan.get(node.id) || { fan: i * 0.9, from: node.prereqs?.[0] || null };
      // A tear is reached *from the line beneath it*, so that is the walk the
      // search has to guarantee. A root tear is reached from the landing plaza.
      const from = sites.get(want.from) || { x: 0, z: 0 };
      // …and it stands further out than that line does, so the map grows away
      // from the plaza in the same order the lattice does.
      const bear = want.from
        ? Math.atan2(from.z, from.x) + (want.fan || 0)
        : (want.a ?? -Math.PI / 2);
      const site = siteFor(from.x + Math.cos(bear) * OUT, from.z + Math.sin(bear) * OUT, from);
      const x = site.x, z = site.z;
      sites.set(node.id, site);
      const gh = heightAt(x, z) ?? 6;
      const y = gh + RING_Y;

      // A built place: stepped dais, four broken pillars, and a light shaft.
      //
      // All six pieces are rigid, share one material and never move, so they
      // are baked to a single geometry at build time. As six separate meshes
      // the ten rifts were sixty draw calls in the main pass and sixty more in
      // the shadow pass — a quarter of the entire frame's submissions spent on
      // scenery that could not animate. One call each, same silhouette.
      const parts = [];
      // Two courses, and most of their mass is under the turf: the outer kerb
      // tops out 28 cm up and the crown 62 cm. You step onto a rift the way you
      // step onto a kerb — which is to say, without noticing that you did.
      const step = stepGeo.clone(); step.translate(0, -0.27, 0); parts.push(step);
      const top = daisGeo.clone(); top.translate(0, DAIS_TOP - 0.5, 0); parts.push(top);
      // The pillars are pushed out past the aperture so that the doorway itself
      // is clear from every bearing: a stone standing in the walking line of a
      // door is the same defect as the plinth, one metre to the left.
      for (let k = 0; k < 4; k++) {
        const a2 = (k / 4) * Math.PI * 2 + 0.4;
        const hh = 2.6 + ((i * 7 + k * 3) % 5) * 0.7;
        const p = pillarGeo.clone();
        p.scale(1, hh / 4.2, 1);
        p.rotateY(a2);
        p.translate(Math.cos(a2) * 6.4, DAIS_TOP + hh * 0.5 - 0.3, Math.sin(a2) * 6.4);
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
      // The aperture now stands at head height, so the lens can end up behind
      // it: a doorway you can walk through must not be a wall the camera
      // shoves against. Same for the gate and the keystone below.
      ring.userData.noCamBlock = true;
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
        bar.userData.noCamBlock = true;
        seal.add(bar);
      }
      g.add(seal);

      // ---- THE KEYSTONE ---------------------------------------------------
      // A critic played this cold and reported the single worst thing an
      // interactable can do twice over: *"a spent ring looks pixel-identical to
      // a live one"*. It did. A sealed tear differed from a live one by a hue
      // shift on a torus — invisible at ten metres, let alone fifty — so a
      // player who had sealed four tears was standing in a field of glowing
      // rings with no way to tell which of them still wanted anything from him.
      //
      // Now the difference is *geometry*, and geometry survives distance, fog,
      // bloom and colour-blindness. Sealed: the aperture is filled with a solid
      // plate and the seal is cut across it, the ring stops turning, the shard
      // crown stops orbiting, the column of light drops to a thread. Live: a
      // hole, a vortex, a spinning ring and a hundred-metre beam. You can read
      // the whole lattice off the skyline without a word of UI, which was the
      // promise the seal bars already made for *locked* and nothing kept for
      // *held*.
      const keystone = new THREE.Group();
      const keyMat = new THREE.MeshStandardMaterial({
        color: 0x7fb499, emissive: 0x1d5a41, emissiveIntensity: 0.28,
        roughness: 0.52, metalness: 0.3, flatShading: true,
      });
      const plate = new THREE.Mesh(keyGeo, keyMat);
      plate.castShadow = true;
      plate.userData.noCamBlock = true;
      keystone.add(plate);
      const seamMat = new THREE.MeshStandardMaterial({
        color: 0xd6f6e4, emissive: 0x63d79a, emissiveIntensity: 1.1,
        roughness: 0.35, metalness: 0.1, flatShading: true,
      });
      // A saltire, not a cross. Two bars at right angles read as a first-aid
      // sign the moment they are green, which is a meaning this game has no
      // use for; turned forty-five degrees the same two bars are the mark a
      // surveyor cuts when a claim is closed.
      for (let s = 0; s < 2; s++) {
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.rotation.z = Math.PI / 4 + s * Math.PI / 2;
        seam.position.z = 0.13;
        keystone.add(seam);
      }
      keystone.visible = false;
      keystone.scale.setScalar(0.001);
      g.add(keystone);

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
      pad.position.set(x, gh + DAIS_TOP + 0.06, z);
      pad.userData.noCamBlock = true;
      pad.renderOrder = 3;
      this.group.add(pad);

      this.group.add(g);
      this.list.push({
        id: node.id, node, group: g, ring, core, coreMat, light, shards, beacon, dais,
        seal, pad, padMat, keystone,
        pos: new THREE.Vector3(x, y, z), foot: new THREE.Vector3(x, gh + DAIS_TOP, z), tier,
        locked: node.prereqs.length > 0, mastered: false, phase: Math.random() * 6.28,
        // what is standing between the cadet and this tear, filled in by sync()
        blockers: node.prereqs.slice(), sealT: 0, hitT: 0, keyT: 0, spin: 0,
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
      // A sealed aperture is *filled*, so the vortex behind the plate is all
      // but shut down: what little is left is the glow in the seam, not a
      // second live tear peeping round the keystone.
      const openTarget = r.locked ? 0.08 : (r.mastered ? 0.14 : 1);
      r.coreMat.uniforms.uOpen.value = openTarget;
      r.ring.material.emissiveIntensity = r.locked ? 0.25 : (r.mastered ? 1.1 : 2.6);
      r.ring.material.color.setHex(r.locked ? 0x54606e : (r.mastered ? 0x6fbf90 : 0x9bd8ff));
      r.light.intensity = r.locked ? 1.2 : (r.mastered ? 4 : 9);
      r.light.color.setHex(r.mastered ? 0x8effc0 : 0x6fd0ff);
      r.shards.visible = !r.locked;
      r.beacon.material.uniforms.uCol.value.setHex(r.locked ? 0x4a5a6a : (r.mastered ? 0x8effc0 : 0x6fd0ff));
      // The column of light is the thing you navigate by from four hundred
      // metres, so it is the loudest carrier of "this one still wants you".
      // Live: a full beam. Held: a thread. Shut: embers.
      r.basePow = r.locked ? 0.20 : (r.mastered ? 0.30 : 1.25);
      r.baseCol = r.locked ? 0x4a5a6a : (r.mastered ? 0x8effc0 : 0x6fd0ff);
      r.beacon.material.uniforms.uPow.value = r.basePow;
      // What is actually standing in the way — named, so the world can say it
      // out loud instead of leaving the cadet to guess.
      r.blockers = r.node.prereqs.filter((p) => !engineState.get(p)?.mastered);
      r.padMat.color.setHex(r.locked ? 0xff9a6b : (r.mastered ? 0x8effc0 : 0x8fe4ff));
      r.padMat.opacity = r.locked ? 0.24 : 0.5;
    }
  }

  /**
   * Which tear the scheduler is currently asking for.
   *
   * The first cut of this stood a second, gold column beside the rift's own
   * cyan one. Two additive columns on the same axis sum to white: the marker
   * and the thing it marked cancelled each other out and produced a third
   * colour that meant nothing. The answer was not a brighter marker — it was to
   * stop building one. **The lead tear's own beacon turns gold.** It is already
   * the most legible object in the game, readable as a thread of light from
   * four hundred metres through fog and bloom, and it is already standing in
   * exactly the right place. `src/world/afford.js` adds the chevrons falling
   * down it and the ring on the stone; the colour does the rest.
   */
  setLead(id) { this.leadId = id || null; }

  update(dt, t) {
    for (const r of this.list) {
      r.coreMat.uniforms.uTime.value = t;
      r.beacon.material.uniforms.uTime.value = t;
      if (r.basePow !== undefined) {
        const lead = r.id === this.leadId;
        r.beacon.material.uniforms.uPow.value = lead ? 1.5 : r.basePow;
        r.beacon.material.uniforms.uCol.value.setHex(lead ? 0xffb347 : r.baseCol);
      }
      // MOTION IS THE SECOND TELL. A live tear turns; a held one has stopped.
      // Colour can be lost to bloom, to a grade, to colour-blindness or to a
      // cheap laptop panel — movement cannot. `spin` is integrated rather than
      // read off `t`, so the ring eases to a halt when the seal lands instead
      // of snapping to a new phase.
      r.spin += dt * (r.locked ? 0.06 : (r.mastered ? 0.02 : 0.34));
      r.ring.rotation.z = r.spin + r.phase;
      r.shards.rotation.z = -(r.spin * 1.6) + r.phase;
      r.group.position.y = r.pos.y + Math.sin(t * 0.7 + r.phase) * (r.mastered ? 0.05 : 0.22);
      // fx: this used to be a *= on the live value, i.e. a per-frame random
      // walk with no fixed point; the pulse has to be applied to a base.
      const base = r.locked ? 1.2 : (r.mastered ? 4 : 9);
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

      // the keystone: swings in when the line is held, and it is the one part
      // of a rift that is opaque, still and lit from inside
      r.keyT += ((r.mastered ? 1 : 0) - r.keyT) * Math.min(1, dt * 2.6);
      r.keystone.visible = r.keyT > 0.02;
      if (r.keystone.visible) {
        const k = r.keyT * r.keyT * (3 - 2 * r.keyT);
        r.keystone.scale.setScalar(0.02 + k * 0.98);
        r.keystone.rotation.z = (1 - k) * 1.2;
        // it breathes once every four seconds, barely — a held line is asleep,
        // not dead
        r.keystone.children[1].material.emissiveIntensity = 0.9 + Math.sin(t * 1.5 + r.phase) * 0.35;
      }

      // the pad: a standing-here invitation that breathes, and it only breathes
      // for a door that is actually open
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + r.phase);
      r.pad.scale.setScalar(r.locked ? 0.9 : (r.mastered ? 0.92 : 0.98 + pulse * 0.07));
      r.padMat.opacity = r.locked ? 0.20 + pulse * 0.05 : (r.mastered ? 0.22 : 0.42 + pulse * 0.26);
    }
  }

  /** Rap on a shut door: the bars shudder, so the refusal is visible. */
  refuse(r) { r.hitT = 0.55; }

  /**
   * Nearest interactable rift within range of a world position.
   *
   * Measured **horizontally, to the dais** — not in three dimensions to a ring
   * hanging four and a half metres over the cadet's head. That distinction is
   * not pedantry: with a 3-D radius of 6.2 m to the ring, a player standing on
   * the stone *beside* the dais was 4.4 m up-and-away before he had moved a
   * step sideways, so the interact key silently did nothing for most of the
   * platform the game had just invited him to stand on. A critic played it cold
   * and "pressed E eight times at every distance" with no prompt and no answer.
   * The reach is now the built place itself: stand anywhere on the dais or its
   * skirt and the tear is in hand.
   */
  nearest(p, range = REACH) {
    let best = null, bd = range;
    for (const r of this.list) {
      if (r.locked) continue;
      const d = this.reachTo(p, r);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  /**
   * Metres from a world point to the plate of one tear — the distance every
   * surface in this game is required to quote, and the distance every surface
   * is required to draw its conclusions from.
   *
   * Horizontal, to the dais, exactly as `nearest()` measures. A cadet standing
   * beside a rift on sloping ground is not further from it because the ground
   * fell away, and a card that measures the straight line to the plate while
   * the key measures the walk to it will print one number and honour another.
   * A different storey is a different place, so an unreachable height
   * difference answers Infinity rather than a small number that is a lie.
   */
  plateDist(p, r) { return Math.hypot(p.x - r.foot.x, p.z - r.foot.z); }

  /**
   * The same distance, but answering Infinity across a storey — which is what
   * "how near am I to using this" means and what `nearest()` sorts on. A cadet
   * standing on a ridge forty metres above a dais is two metres from it on a
   * map and cannot touch it, so the two questions get two functions rather than
   * one function and a footnote nobody reads.
   */
  reachTo(p, r) {
    if (!r) return Infinity;
    if (Math.abs(p.y - r.foot.y) >= REACH_Y) return Infinity;
    return this.plateDist(p, r);
  }

  /**
   * Is this exact tear in hand from this exact point?
   *
   * THE SINGLE SOURCE OF TRUTH FOR "YOU ARE STANDING IN IT", and the reason it
   * is a question about `nearest()` rather than about a distance: `main.js`
   * opens `nearest()` on the interact key, so a tear is in hand precisely when
   * it is the tear `nearest()` would return. Being ten metres from the
   * objective while standing on somebody else's plate is not being in the
   * objective — and a surface that decided otherwise, off a threshold of its
   * own, is how the objective card came to claim a rift the key could not open
   * and to say so instead of saying which way to walk.
   */
  inHand(p, r) { return !!r && !r.locked && this.nearest(p) === r; }

  /**
   * Nearest tear that is *live* — open, and not yet held.
   *
   * The one a walk-in is allowed to trigger. `nearest()` also returns a sealed
   * tear, which is right for "what does the key open" and wrong for "what does
   * walking into it open": a held tear stands between the plaza and the next
   * objective more often than not, and a cadet crossing his own finished work
   * on the way to the line the game just told him to go and seal should not be
   * pulled into a deep sounding he did not ask for. Sounding a held line is a
   * deliberate act, and it has a key printed on the ring.
   */
  nearestLive(p, range = REACH) {
    let best = null, bd = range;
    for (const r of this.list) {
      if (r.locked || r.mastered) continue;
      const d = this.reachTo(p, r);
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
      const d = this.reachTo(p, r);
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
