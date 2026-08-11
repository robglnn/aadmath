import * as THREE from 'three';
import { heightAt, ISLAND_R } from './world.js';
import { t } from '../i18n/index.js';
import './field.css';

/**
 * THE DRIFT — what happens in the world when nobody is asking you a question.
 *
 * The island used to produce, in sixty seconds of running, exactly nothing: no
 * find, no threat, no reason to go left instead of right. Scenery is not a game.
 * This file is the answer, and it is three systems that share one idea — *the
 * island is charged, and the charge moves.*
 *
 *   MOTES     Shards of the same stuff the rifts are made of, lying in veins
 *             across the ground. Run through one and it is yours.
 *
 *             **A vein is a place, not a spawner.** The previous field followed
 *             the cadet: motes were re-seeded in a ring around wherever he
 *             happened to be, for ever, which meant sixty seconds of jogging on
 *             the spot paid 143 shards while the hardest content in the game
 *             paid 45. Nothing was worth crossing the map for, because the map
 *             came to you.
 *
 *             So the veins are now twenty-six fixed sites on the island, laid
 *             once. Harvest one and it is *spent*: the crystals go dark, they
 *             stay dark for five minutes, and you can see them re-lighting from
 *             a distance as they come back. You cannot farm a hillside. You can
 *             only range further, which is the whole point of a kit that buys
 *             range, and it is what makes a cache — 120 shards, roughly five
 *             minutes of good running — worth the flight out to it.
 *
 *   COLUMNS   Standing updrafts. A pillar of rising air you can see from a
 *             kilometre away; fly into one and it takes you three hundred feet
 *             up for free. Four of them are simply in the world. The rest are
 *             *earned* — every cache you crack plants one where you cracked it,
 *             which is how a hard place you reached once becomes a place you can
 *             use for ever. The world visibly changes because you played.
 *
 *   SURGES    The one thing that pushes back. A rift that is open and unsealed
 *             is unstable: every fifteen seconds or so it throws a ring of
 *             pressure out across the ground, and being caught by one costs you
 *             shards and your footing. It is telegraphed, it is survivable, and
 *             it is the reason the richest mote veins — the ones that grow
 *             right up against an open rift — are not free money.
 *
 *             **Seal the line and the surges stop.** For ever, at that rift.
 *             That is the whole design in one sentence: the mathematics is the
 *             only thing in the game that calms the world down.
 */

const VEINS = 26;               // fixed sites on the island
const CLUSTER = 4;              // crystals per vein
const MOTES = VEINS * CLUSTER;  // every crystal is drawn, lit or spent
const MOTE_R = 4.2;             // how close a boot has to pass
const MOTE_VALUE = 2;           // shards
const RICH_VALUE = 6;           // …and what a vein grown against an open rift pays
const VEIN_GAP = 30;            // minimum metres between two veins
const VEIN_TIGHT = 5.5;         // how far a crystal scatters from its vein
const RECHARGE = 300;           // seconds a spent vein stays dark
const RICH_R = 34;              // a vein this close to an unsealed rift is charged

/**
 * Two veins are placed by hand, in the plaza the cadet lands in and inside the
 * first frame of the game. A field that is only ever *somewhere else* is a
 * mechanic nobody stumbles into, and the first thing a player should learn
 * about the drift is that running through it pays — before they learn that it
 * runs out.
 */
const LANDING = [[-17, 5], [16, 11]];

const SURGE_EVERY = 15.5;       // seconds between rings at an unsealed rift
const SURGE_R = 34;             // how far a ring reaches
const SURGE_SPEED = 26;         // metres a second
const SURGE_COST = 9;           // shards knocked loose

export function createDrift(opts = {}) {
  const { scene, player, rifts, hud, wallet, fx, isBusy = () => false } = opts;

  const group = new THREE.Group();
  group.name = 'drift';
  scene.add(group);

  // ------------------------------------------------------------------ motes
  const coreGeo = new THREE.OctahedronGeometry(0.46, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xe8f8ff, emissive: 0x64d8ff, emissiveIntensity: 3.4,
    roughness: 0.2, metalness: 0.1,
  });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, MOTES);
  cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cores.frustumCulled = false;
  cores.userData.noCamBlock = true;
  group.add(cores);

  const shellGeo = new THREE.OctahedronGeometry(1.1, 0);
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x5ec8ff, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const shells = new THREE.InstancedMesh(shellGeo, shellMat, MOTES);
  shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shells.frustumCulled = false;
  shells.userData.noCamBlock = true;
  group.add(shells);

  // ------------------------------------------------------------------ veins
  //
  // Laid once, off a fixed seed, so that the island is the same island every
  // time you open it: a vein you remember is still where you left it, which is
  // the difference between a place and a spawner. Everything after this point
  // treats a mote as furniture that can be spent and comes back.
  // A spent crystal is drawn by a mesh of its own rather than by a colour on
  // the live one: the lit core carries a 3.4 emissive, and no per-instance
  // colour can talk a glowing material out of glowing. A husk has to be dark,
  // or "this vein is spent" is a fact only the wallet knows.
  const huskMat = new THREE.MeshStandardMaterial({
    color: 0x3a5471, emissive: 0x0e2130, emissiveIntensity: 0.55,
    roughness: 0.85, metalness: 0.05,
  });
  const husks = new THREE.InstancedMesh(coreGeo, huskMat, MOTES);
  husks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  husks.frustumCulled = false;
  husks.userData.noCamBlock = true;
  husks.count = 0;
  group.add(husks);

  const motes = [];
  const veins = [];
  layVeins();

  /** A seeded generator — the field must not be different on every reload. */
  function rnd(seed) {
    let h = 0x9e3779b9 ^ (seed * 2654435761);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h ^= h >>> 13;
      return ((h >>> 0) % 100000) / 100000;
    };
  }

  function layVeins() {
    const r = rnd(20260810);
    for (const [lx, lz] of LANDING) lay(lx, lz, r);
    let guard = 0;
    while (veins.length < VEINS && guard++ < 4000) {
      // A disc-uniform draw would crowd the middle; sqrt spreads them, and the
      // far ring is where the kit's range is supposed to take you.
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(0.05 + r() * 0.95) * (ISLAND_R - 12);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const h = heightAt(x, z);
      if (h === null) continue;
      let clash = false;
      for (const v of veins) if (Math.hypot(v.x - x, v.z - z) < VEIN_GAP) { clash = true; break; }
      if (clash) continue;
      lay(x, z, r, h);
    }
    chargeVeins();
  }

  /** One vein and its four crystals, scattered off the ground it stands on. */
  function lay(x, z, r, known) {
    const h = known === undefined ? heightAt(x, z) : known;
    if (h === null) return null;
    const v = { x, z, left: CLUSTER, cool: 0, rich: false, motes: [] };
    for (let k = 0; k < CLUSTER; k++) {
      const aa = r() * Math.PI * 2;
      const rr = 1.4 + r() * VEIN_TIGHT;
      const mx = x + Math.cos(aa) * rr, mz = z + Math.sin(aa) * rr;
      const mh = heightAt(mx, mz);
      const m = {
        x: mx, z: mz, hx: mx, hz: mz, y: (mh === null ? h : mh) + 1.25 + r() * 0.7,
        ph: r() * 6.28, pop: 0, live: true, rich: false, v,
      };
      motes.push(m);
      v.motes.push(m);
    }
    veins.push(v);
    return v;
  }

  /**
   * Which veins are *charged*: a vein grown inside a rift that is open and
   * unsealed is worth three times as much, and it is exactly where the surges
   * are. That is the whole risk-and-reward argument, and it disappears the
   * moment you seal the line, because a sealed rift stops surging.
   */
  function chargeVeins() {
    const open = (rifts?.list || []).filter((r) => !r.locked && !r.mastered);
    for (const v of veins) {
      v.rich = open.some((r) => Math.hypot(r.pos.x - v.x, r.pos.z - v.z) < RICH_R);
      for (const m of v.motes) m.rich = v.rich;
    }
  }

  /** A spent vein comes back lit, and re-reads the rift it grew beside. */
  function relight(v) {
    v.left = CLUSTER;
    v.cool = 0;
    const open = (rifts?.list || []).filter((r) => !r.locked && !r.mastered);
    v.rich = open.some((r) => Math.hypot(r.pos.x - v.x, r.pos.z - v.z) < RICH_R);
    for (const m of v.motes) { m.live = true; m.rich = v.rich; m.pop = 0; }
  }

  // --------------------------------------------------------------- columns
  const colGeo = new THREE.CylinderGeometry(1, 1, 1, 22, 1, true);
  colGeo.translate(0, 0.5, 0);
  const colMat = new THREE.ShaderMaterial({
    // BackSide only: an additive tube drawn on both faces doubles its own
    // brightness from every angle, and at eight metres of radius that is a
    // white wall standing in the middle of the frame rather than a column of
    // air. One wall, seen through the near one, reads as volume.
    transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      void main(){
        // Rising bands. A column you cannot see is not a landmark, and this one
        // has to read against a low sun from four hundred metres away, so the
        // bands are hard-edged and the whole shaft carries real alpha.
        float ph = vUv.y * 9.0 - uTime * 1.6;
        float band = smoothstep(0.35, 0.62, 0.5 + 0.5 * sin(ph * 3.14159));
        float body = smoothstep(1.0, 0.06, vUv.y) * (0.34 + 0.66 * band);
        float edge = smoothstep(0.0, 0.10, vUv.y);
        float a = body * edge * 0.40;
        vec3 col = mix(vec3(0.34, 0.82, 1.0), vec3(0.86, 0.98, 1.0), band);
        gl_FragColor = vec4(col * a * 1.5, a);
      }`,
  });

  // The footprint: a lit ring on the ground, so the column names the exact spot
  // you have to be standing to be taken up.
  const padGeo = new THREE.RingGeometry(0.92, 1, 44);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshBasicMaterial({
    color: 0x8fe4ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });

  const columns = [];
  /** Plant an updraft. `earned` ones came out of a cache and are warmer. */
  function addColumn(x, z, height = 62, radius = 7.5, earned = false) {
    const base = heightAt(x, z);
    const y0 = base === null ? 6 : base;
    const m = new THREE.Mesh(colGeo, colMat);
    m.position.set(x, y0, z);
    m.scale.set(radius, height, radius);
    m.renderOrder = 3;
    m.userData.noCamBlock = true;
    group.add(m);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(x, y0 + 0.14, z);
    pad.scale.setScalar(radius);
    pad.userData.noCamBlock = true;
    pad.renderOrder = 3;
    group.add(pad);
    m.userData.pad = pad;
    const c = { x, z, y0, top: y0 + height, r: radius, mesh: m, earned, born: 0, life: 0 };
    columns.push(c);
    return c;
  }

  /**
   * A bought updraft: same physics, six seconds of life, tight and violent —
   * or, once SQUALL FLARE is held, seventy-four metres of it for eleven.
   */
  function flare(x, z, opt) {
    const c = addColumn(x, z, opt?.height || 46, opt?.radius || 5.6, true);
    c.life = opt?.life || 6.5;
    return c;
  }

  // ---------------------------------------------------------------- surges
  // A hairline ring, not a wall. The band is 3% of the radius, so a surge at
  // full reach is a metre of light lying on the ground rather than a
  // thirty-metre additive sheet standing between the player and the frame —
  // which is exactly what a 14%-wide band became when it was scaled to 34 m.
  const ringGeo = new THREE.RingGeometry(0.968, 1, 96);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff8f6b, transparent: true, opacity: 0.42, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const surges = [];
  const timers = new Map();

  function emit(rift) {
    const m = new THREE.Mesh(ringGeo, ringMat.clone());
    m.userData.noCamBlock = true;
    m.renderOrder = 3;
    const h = heightAt(rift.pos.x, rift.pos.z);
    m.position.set(rift.pos.x, (h === null ? rift.pos.y - 4 : h) + 0.6, rift.pos.z);
    group.add(m);
    surges.push({ mesh: m, r: 2, hit: false, x: rift.pos.x, z: rift.pos.z });
  }

  // ------------------------------------------------------------------ frame
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  let inColumn = 0;
  // How far a mote will lean toward a passing cadet. Five metres from the
  // start — a near miss should feel like a catch, not like a miss — and
  // fourteen once RESONANT SIGHT is held.
  let magnet = 5;
  let took = 0;
  let tookT = 0;
  let recharge = 4;
  const stats = { motes: 0, surges: 0, lifts: 0, events: 0, spent: 0 };

  function update(dt, time) {
    const p = player.pos;
    const busy = isBusy();

    // ---- veins: recharge, and re-read the rifts they grew beside ----
    recharge -= dt;
    if (recharge <= 0) { recharge = 4; chargeVeins(); }
    for (const v of veins) {
      if (v.cool <= 0) continue;
      v.cool -= dt;
      if (v.cool <= 0) relight(v);
    }

    // ---- motes: bob, collect ----
    let n = 0;
    let hk = 0;
    for (const m of motes) {
      if (m.pop > 0) m.pop = Math.max(0, m.pop - dt * 2.6);
      if (!m.live) {
        // A spent crystal is still there — dark, small, and visibly swelling
        // back as its vein recharges. Scarcity you cannot see is an empty field.
        if (m.pop <= 0 && hk < MOTES) {
          const back = 1 - Math.max(0, Math.min(1, m.v.cool / RECHARGE));
          _p.set(m.hx, m.y - 0.55, m.hz);
          _q.setFromAxisAngle(UP, time * 0.25 + m.ph);
          _s.setScalar(0.26 + back * 0.5);
          _m.compose(_p, _q, _s);
          husks.setMatrixAt(hk, _m);
          hk++;
        }
        if (m.pop <= 0) continue;
      } else if (!busy) {
        const dx = m.x - p.x, dz = m.z - p.z, dy = m.y - (p.y + 0.9);
        const flat = Math.hypot(dx, dz);
        if (flat < magnet && Math.abs(dy) < 6) {
          // RESONANT SIGHT: motes lean toward a cadet who has earned the sight
          const k = (1 - flat / magnet) * 26 * dt;
          m.x -= dx * Math.min(1, k / Math.max(flat, 0.001));
          m.z -= dz * Math.min(1, k / Math.max(flat, 0.001));
        } else if (m.x !== m.hx || m.z !== m.hz) {
          // …and a crystal that leaned and was not taken settles back onto its
          // vein, because a vein is a place and has to stay where it was.
          const k = Math.min(1, dt * 1.6);
          m.x += (m.hx - m.x) * k;
          m.z += (m.hz - m.z) * k;
        }
        if (flat < MOTE_R && Math.abs(dy) < 3.4) {
          const worth = m.rich ? RICH_VALUE : MOTE_VALUE;
          m.live = false;
          m.pop = 1;
          wallet?.earn?.(worth);
          stats.motes++; stats.events++;
          took += worth;
          tookT = 1.6;
          // The vein, not the crystal, is the thing that runs out.
          if (--m.v.left <= 0) {
            m.v.cool = RECHARGE;
            stats.spent++;
            for (const o of m.v.motes) o.live = false;
          }
        }
      }
      if (n >= MOTES) break;
      const pop = m.pop;
      const sc = (m.rich ? 1.5 : 1) * (m.live ? 1 : 1 + (1 - pop) * 2.4);
      const y = m.y + Math.sin(time * 1.6 + m.ph) * 0.22 + (m.live ? 0 : (1 - pop) * 2.2);
      _p.set(m.x, y, m.z);
      _q.setFromAxisAngle(UP, time * 0.9 + m.ph);
      _s.setScalar(sc * (m.live ? 1 : pop));
      _m.compose(_p, _q, _s);
      cores.setMatrixAt(n, _m);
      cores.setColorAt(n, m.rich ? RICHCOL : PLAINCOL);
      _s.multiplyScalar(1.05);
      _m.compose(_p, _q, _s);
      shells.setMatrixAt(n, _m);
      shells.setColorAt(n, m.rich ? RICHCOL : PLAINCOL);
      n++;
    }
    cores.count = n; shells.count = n; husks.count = hk;
    cores.instanceMatrix.needsUpdate = true;
    shells.instanceMatrix.needsUpdate = true;
    husks.instanceMatrix.needsUpdate = true;
    if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
    if (shells.instanceColor) shells.instanceColor.needsUpdate = true;

    // ---- the take counter: a quiet running total, not a toast per pickup ----
    if (tookT > 0) {
      tookT -= dt;
      if (tookT <= 0 && took > 0) {
        hud?.flash?.(t('field.moteTake', { n: took }), 'good');
        took = 0;
      }
    }

    // ---- columns ----
    colMat.uniforms.uTime.value = time;
    let lifting = false;
    for (let i = columns.length - 1; i >= 0; i--) {
      const c = columns[i];
      c.born += dt;
      if (c.life > 0) {
        c.life -= dt;
        const fade = Math.min(1, Math.max(0, c.life / 1.2));
        c.mesh.scale.x = c.mesh.scale.z = c.r * (0.4 + 0.6 * fade);
        if (c.mesh.userData.pad) c.mesh.userData.pad.scale.setScalar(c.mesh.scale.x);
        if (c.life <= 0) {
          group.remove(c.mesh);
          if (c.mesh.userData.pad) group.remove(c.mesh.userData.pad);
          columns.splice(i, 1);
          continue;
        }
      }
      if (busy) continue;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d < c.r + 1.6 && p.y > c.y0 - 3 && p.y < c.top) {
        // lift is applied to the position, not the velocity: the wing rewrites
        // its own vertical speed every frame, so a thermal that pushed on
        // velocity would do nothing at all to a gliding cadet — which is the
        // one player it is for.
        const soft = 1 - Math.max(0, (p.y - (c.top - 12)) / 12);
        const lift = (c.earned ? 17 : 13) * Math.max(0.15, Math.min(1, soft));
        p.y += lift * dt;
        if (player.vel.y < 0) player.vel.y *= 0.55;
        player.loco.airTime = Math.max(player.loco.airTime, 0.3);
        player.loco.grounded = false;
        lifting = true;
      }
    }
    if (lifting && inColumn <= 0) {
      inColumn = 1;
      stats.lifts++; stats.events++;
      hud?.flash?.(t('field.updraft'), 'good');
    }
    if (!lifting) inColumn = Math.max(0, inColumn - dt);

    // ---- surges ----
    if (rifts && !busy) {
      for (const r of rifts.list) {
        // Locked rifts are dormant and sealed ones are calm. The only thing
        // that throws pressure at you is a line you have been asked to close
        // and have not closed.
        if (r.locked || r.mastered) { timers.set(r.id, 0); continue; }
        const t0 = (timers.get(r.id) || 0) + dt;
        if (t0 > SURGE_EVERY) {
          timers.set(r.id, 0);
          if (Math.hypot(p.x - r.pos.x, p.z - r.pos.z) < SURGE_R * 2.2) emit(r);
        } else timers.set(r.id, t0);
      }
    }
    for (let i = surges.length - 1; i >= 0; i--) {
      const s = surges[i];
      s.r += SURGE_SPEED * dt;
      s.mesh.scale.setScalar(s.r);
      s.mesh.material.opacity = 0.5 * (1 - s.r / SURGE_R) + 0.06;
      if (!s.hit && !busy) {
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        const high = p.y - s.mesh.position.y;
        if (Math.abs(d - s.r) < 3.4 && high < 9) {
          s.hit = true;
          const k = Math.max(0.001, d);
          player.vel.x += ((p.x - s.x) / k) * 15;
          player.vel.z += ((p.z - s.z) / k) * 15;
          player.vel.y = Math.max(player.vel.y, 7);
          player.loco.grounded = false;
          const lost = wallet?.take?.(SURGE_COST) || 0;
          stats.surges++; stats.events++;
          fx?.impact?.('bad');
          hud?.flash?.(lost ? t('field.surgeHit', { n: lost }) : t('field.surge'), 'bad');
        }
      }
      if (s.r >= SURGE_R) { group.remove(s.mesh); s.mesh.material.dispose(); surges.splice(i, 1); }
    }
  }

  return {
    update,
    addColumn,
    flare,
    /** RESONANT SIGHT: how far a mote will lean toward the cadet. */
    setMagnet(r) { magnet = r; },
    get columns() { return columns; },
    /** One vein, by index — critics walk the real field, not a mock of it. */
    veinAt: (i) => veins[Math.max(0, Math.min(veins.length - 1, i | 0))],
    /** The island's standing charge: what is out there to be found right now. */
    field: () => ({
      veins: veins.length,
      lit: veins.filter((v) => v.cool <= 0).length,
      spent: veins.filter((v) => v.cool > 0).length,
      charged: veins.filter((v) => v.cool <= 0 && v.rich).length,
      onIsland: veins.reduce((a, v) => a + (v.cool > 0 ? 0 : v.left * (v.rich ? RICH_VALUE : MOTE_VALUE)), 0),
      recharge: RECHARGE,
    }),
    stats,
  };
}

const UP = new THREE.Vector3(0, 1, 0);
// a plain mote is the colour of the lattice; a rich one is the colour of the
// tear it grew out of, so a vein worth crossing the map for reads at distance.
// (A spent one is not a colour at all — it is the husk mesh above, because a
// glowing material cannot be talked out of glowing by an instance colour.)
const PLAINCOL = new THREE.Color(0xdff4ff);
const RICHCOL = new THREE.Color(0xffbf6a);
