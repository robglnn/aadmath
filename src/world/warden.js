import * as THREE from 'three';
import { heightAt, ISLAND_R } from './world.js';
import { tex } from '../ui/tex.js';
import { t } from '../i18n/index.js';
import './field.css';
import './warden.css';

/**
 * THE WARDENS — the first thing on this island that wants something.
 *
 * THE COMPLAINT THIS FILE EXISTS FOR
 *
 * A critic played to the fourth sitting and stopped: *"by then I would hold all
 * six grants, shards would be confetti, and the island would still be scenery
 * with pickups on it."* Another counted the verbs: *"ASCENT gives one verb (run
 * over a glowing diamond) fired 29 times plus one scripted shockwave, so it now
 * matches Fortnite on density but loses badly on variety and on anything in the
 * world having intent."*
 *
 * Both are the same fault. Everything in the world **waits**. A vein waits, a
 * cache waits, an anchor waits, a rift waits. Nothing in nine centuries of
 * Shard Nine has ever moved toward the cadet, moved away from him, or changed
 * what it was doing because of something he did. A world made only of things
 * that wait is a warehouse.
 *
 * A WARDEN IS A THING THAT DOES NOT WAIT.
 *
 * It is a lattice construct the size of a person: two rings turning about a
 * bright core, running a slow circuit of the island a dozen metres off the
 * ground, with a statement sealed inside it and a light standing over it that
 * you can see from the far coast. It has four behaviours, and every one of them
 * is a response to the cadet rather than a loop on a timer.
 *
 *   IT NOTICES.  Come within seventy-eight metres and the rings snap open, the
 *                core goes amber, and the statement it is carrying appears in
 *                the air in front of it. Until then it is a light in the
 *                distance.
 *
 *   IT RUNS.     Out past that it runs, at better than twice its patrol pace,
 *                and chasing it along its own circle does not work: cutting
 *                across the circle does. Nobody has to be told that, because
 *                the light standing over it shows you the whole route from a
 *                long way off. Once you are inside the distance at which it
 *                noticed you it stops running and *coasts* — it is not trying
 *                to escape, it is trying to see what you know.
 *
 *   IT SHEDS.    Get within twenty-six metres and it throws four counterweights
 *                out behind it, spread across the line you are coming in on,
 *                and they fall and settle just off the grass. Those are the
 *                answers, and running into one is the same verb the hanging
 *                caches taught: the mathematics is a thing you do with your
 *                feet. The fan fades after sixteen seconds, and then it puts
 *                another one down.
 *
 *   IT PUSHES BACK. Take the wrong weight and it throws a ring of pressure and
 *                puts on speed. It costs you no motes — a wallet must never
 *                empty for a reason the player did not choose (see
 *                src/kit/ledger.js) — it costs you the ground you gained, and
 *                it tells you exactly how wrong you were: TOO SMALL BY EIGHT.
 *                That is the balance beam's own diagnostic, carried out here.
 *                And that weight is SPENT: the next fan brings it back dark and
 *                inert, exactly as a hanging cache does, so a miss narrows the
 *                field instead of resetting it. Spend all four and they re-form
 *                — nobody is ever locked out of a question.
 *
 * WHAT BINDING ONE IS WORTH — AND WHY IT IS THE POINT
 *
 * The best thing in this build, in a critic's words, is the hanging cache: *"a
 * genuinely Breath-of-the-Wild-shaped idea and the best thing in this build"*.
 * There were five of them and a returning cadet had cracked the last one in his
 * second sitting. From then on the best idea in the game was five opened boxes.
 *
 * **A bound warden falls apart into a new hanging cache, on the spot where you
 * caught it, for ever.** A DEEP CACHE: the same apparatus with unknown tiles on
 * *both* pans, which is Algebra I Level 2's first hard idea and the reason this
 * exists on the fifth day rather than the first. The island grows one new hard
 * place, in a place you chose, every day you come back — and the updraft it
 * plants when you crack it makes the next one reachable.
 *
 * WHEN
 *
 * The first warden wakes on the **fifth day worked** (`src/meta/days.js` — days
 * worked, not days elapsed, and a day needs one real answer in it). One more
 * wakes every returning day after that, and three is the most that are ever
 * awake at once, so a fifth session opens on something that was not there and a
 * sixtieth still has one out there somewhere.
 *
 * Nothing about learning is gated behind this. No item, no skill, no rift and
 * no capability. It is the world getting more interesting for the cadet who
 * kept coming back, which is the only thing a fifth session can be paid in.
 */

/** Days worked before the lattice puts one out. The third clock, not a total. */
export const WAKE_DAY = 5;
/** Never more than this awake at once. Three is a horizon, four is a chore. */
const MAX_ALIVE = 3;
/** Motes for binding one. Answered work, so the day's assay never taints it. */
const BIND_PAY = 55;
/** …and what it pays instead once the island will carry no more deep caches. */
const DEEP_INSTEAD = 140;
/**
 * Binds per charter. A charter plus motes raises a waystation (src/kit).
 *
 * Four, not three. Modelled over sixty returning days: at three the cadet ends
 * with seven licences he has no motes to use, and a licence you cannot spend is
 * the same failure as a wallet you cannot spend — a number that goes up. At
 * four the money stays the scarce thing and the licence stays worth having, and
 * the first one still lands on about the eighth day rather than the fiftieth.
 */
const CHARTER_EVERY_BIND = 4;

/**
 * Metres: it notices you from here.
 *
 * Seventy-eight, not sixty, and the circuit below is smaller than it was, for
 * the same measured reason. A warden on a hundred-and-thirty-metre circuit that
 * only wakes at sixty is a two-minute walk before anything happens, and this
 * game is built around a fifteen-to-twenty-five minute sitting. An encounter
 * whose first beat costs a tenth of the session is not an encounter, it is a
 * commute.
 */
const ROUSE = 78;
/**
 * …and it only sheds a fan once you are THIS close.
 *
 * Measured, on a real chase: roused at sixty metres, a warden that sheds at
 * once puts its answers down sixty metres away and then outruns you to them.
 * The fan expired untaken every single time, which is a mechanic that exists
 * only in the source. It shows you the answers when you have got close enough
 * for taking one to be a real choice, and not before.
 */
const SHED_NEAR = 26;
const CALM = 150;             // …and forgets you out here
const SPEED_IDLE = 6;         // m/s along its circuit
const SPEED_ROUSED = 14.5;    // …and this once it has seen you
/**
 * …and this while its fan is on the ground behind it.
 *
 * A construct that runs flat out for ever is a chase nobody wins, and a chase
 * nobody wins is a wall with a light on it. It sheds the answers and then
 * *coasts*, which reads as exactly what it is — it is waiting to see which one
 * you take — and which makes the encounter winnable at walking pace by a cadet
 * who has not bought STORM LEGS yet, and quick by one who has.
 */
const SPEED_WAIT = 8.5;
const SPOOK_MUL = 1.5;        // …and this much again for five seconds after a miss
const SPOOK_FOR = 3.5;
const ALT_HOLD = 15;          // metres over the ground it prefers to run at
const ALT_DIVE = 11;          // …and it drops to this if you get above it
const ALT_LIFT = 21;          // …and lifts to this if you are right underneath
const FAN = 4;                // counterweights in one fan
const FAN_SPREAD = 5.4;       // metres between them, abreast
const FAN_BACK = 9;           // …dropped this far behind the warden
/**
 * Where a shed weight comes to rest: just off the ground, at the height a
 * cipher mote sits at, because it is the same verb and must be reachable by the
 * same means. They are thrown out at the warden's own altitude and *fall*, so
 * the fan reads as something dropped rather than something placed — and a cadet
 * who is running one down does not also have to solve a platforming problem to
 * answer a question.
 */
const FAN_REST = 1.6;
const FAN_SINK = 9;           // metres a second they settle at
const FAN_LIFE = 16;          // seconds before the fan fades
const FAN_AGAIN = 2.6;        // …and this long before a new one is thrown
const TOUCH = 3.6;            // how close a boot has to pass
const SURGE_R = 26;           // the ring it throws on a wrong weight
const SURGE_SPEED = 30;
const TAG_REACH = 150;        // how far out its statement is legible
const KEY = 'ascent.wardens';
/**
 * The widest circuit one will run. Kept inside the leash in
 * src/player/locomotion.js on purpose: a warden patrolling outside it would be
 * an objective nobody can reach, which is the one thing this island already got
 * wrong once (see src/world/verge.js).
 */
const MAX_R = ISLAND_R * 0.62;
const MIN_R = ISLAND_R * 0.24;

export function createWardens(opts = {}) {
  const {
    scene, uiRoot, player, hud, wallet, caches, audio, fx, story, kit,
    isBusy = () => false,
  } = opts;

  const group = new THREE.Group();
  group.name = 'wardens';
  scene.add(group);

  const tags = document.createElement('div');
  tags.className = 'field-tags warden-tags';
  (uiRoot || document.body).appendChild(tags);

  // ------------------------------------------------------------- materials
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffe6c4, emissive: 0xff9a3c, emissiveIntensity: 2.2,
    roughness: 0.22, metalness: 0.3,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xd8e8ff, emissive: 0x3f7fd0, emissiveIntensity: 1.0,
    roughness: 0.3, metalness: 0.5,
  });
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffb057, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffc98a, transparent: true, opacity: 0.14,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xe6dcff, emissive: 0x7a5bff, emissiveIntensity: 2.0,
    roughness: 0.24, metalness: 0.2,
  });
  const stoneHaloMat = new THREE.MeshBasicMaterial({
    color: 0x9a7bff, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const surgeGeo = new THREE.RingGeometry(0.965, 1, 96);
  surgeGeo.rotateX(-Math.PI / 2);
  const surgeMat = new THREE.MeshBasicMaterial({
    color: 0xffa76b, transparent: true, opacity: 0.42, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });

  const coreGeo = new THREE.OctahedronGeometry(1.25, 0);
  const ringGeo = new THREE.TorusGeometry(2.5, 0.13, 6, 34);
  const haloGeo = new THREE.OctahedronGeometry(2.4, 0);
  const shaftGeo = new THREE.CylinderGeometry(0.7, 1.5, 96, 8, 1, true);
  shaftGeo.translate(0, 56, 0);
  const stoneGeo = new THREE.OctahedronGeometry(0.92, 0);
  const stoneHaloGeo = new THREE.OctahedronGeometry(1.55, 0);

  // ------------------------------------------------------------------ state
  const live = [];
  const surges = [];
  const rec = loadRec();
  let poll = 0;
  let tagNodes = [];
  /** Has the one instruction been said this session? See `shed`. */
  let saidFan = false;

  for (const s of rec.live) spawn(s.seed, s.ang);
  rebuildTags();

  // ------------------------------------------------------------------ maths
  /**
   * What a warden is carrying: a two-step statement with a **subtraction** in
   * it, which is the step Level 1 never asks for and the one that produces the
   * sign mistake this whole encounter is built around.
   *
   *      a·x − b  =  c,     b = a·m,   so every wrong weight is a whole number
   *
   * The three wrong weights are three real slips, and they are deliberately all
   * *near* the answer:
   *
   *      x − 2m   subtracted b when the step says add it
   *      x − m    divided before undoing the subtraction at all
   *      x + m    undid the subtraction twice
   *
   * The obvious fourth candidate — a·x, "never divided" — is not used, and that
   * is a measured decision rather than a taste. It is far from the answer, so
   * the refusal it earns is far from zero: on `5x − 10 = 35` a cadet taking 45
   * was told TOO BIG BY 180, which is a true number and a useless one. Every
   * weight here refuses by at most 2b, and 2b is a number a person can hold in
   * their head while they work out which way they went wrong.
   */
  function question(seed) {
    let h = 0x2545f491 ^ ((seed | 0) * 2654435761);
    const rnd = (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 8) % n); };
    for (let tries = 0; tries < 60; tries++) {
      const a = 2 + rnd(4);            // 2..5
      const x = 4 + rnd(6);            // 4..9
      const m = 1 + rnd(3);            // 1..3
      const b = a * m;
      if (x - 2 * m < 1) continue;
      const c = a * x - b;
      // Everything on this construct has to stay small enough to say out loud.
      if (c < 2 || c > 30) continue;
      const set = [x, x - 2 * m, x - m, x + m]
        .filter((v, k, arr) => v > 0 && v <= 40 && arr.indexOf(v) === k);
      if (set.length < FAN) continue;
      for (let k = set.length - 1; k > 0; k--) {
        const j = rnd(k + 1);
        const tmp = set[k]; set[k] = set[j]; set[j] = tmp;
      }
      return { a, b, c, x, choices: set.slice(0, FAN), latex: `${a}x - ${b} = ${c}` };
    }
    return { a: 3, b: 6, c: 15, x: 7, choices: [7, 3, 5, 9], latex: '3x - 6 = 15' };
  }

  // ------------------------------------------------------------------ spawn
  function spawn(seed, ang) {
    const r = MIN_R + (Math.abs(seed) % 5) * ((MAX_R - MIN_R) / 4);
    const dir = (seed & 1) ? 1 : -1;
    const w = {
      seed, r, dir, ang: ang == null ? (seed % 628) / 100 : ang,
      state: 'idle', spook: 0, alt: 16, y: 20,
      fan: [], fanT: 0, hold: 0,
      /** Values the beam has already refused. They come back dark. */
      spent: new Set(),
      q: question(seed),
      group: new THREE.Group(),
    };
    const g0 = heightAt(Math.cos(w.ang) * r, Math.sin(w.ang) * r);
    w.group.position.set(
      Math.cos(w.ang) * r, (g0 === null ? 4 : g0) + w.alt, Math.sin(w.ang) * r,
    );
    const core = new THREE.Mesh(coreGeo, coreMat.clone());
    core.castShadow = true;
    w.core = core;
    w.group.add(core);

    w.rings = [];
    for (let k = 0; k < 2; k++) {
      const ring = new THREE.Mesh(ringGeo, ringMat.clone());
      ring.rotation.x = k ? 1.1 : 0.2;
      ring.rotation.z = k ? 0.6 : -0.5;
      w.rings.push(ring);
      w.group.add(ring);
    }
    w.halo = new THREE.Mesh(haloGeo, haloMat.clone());
    w.halo.userData.noCamBlock = true;
    w.group.add(w.halo);

    // The light that says there is something out here at all. It stands ABOVE
    // the construct, never through it, so a mark you read from the far coast is
    // not a fog bank standing on the thing you came for.
    w.shaft = new THREE.Mesh(shaftGeo, shaftMat.clone());
    w.shaft.userData.noCamBlock = true;
    w.shaft.renderOrder = 2;
    w.group.add(w.shaft);

    group.add(w.group);
    live.push(w);
    return w;
  }

  /**
   * One more goes out. Marlow says so, and says what the word means.
   *
   * It comes up on a bearing near the cadet's own — about a quadrant away, so
   * it is a thing that appears over the ridge rather than a rumour on the far
   * coast. Marlow's line says exactly that, and a line the world does not
   * honour is worse than no line.
   */
  function wake() {
    const seed = (Date.now() ^ (rec.woke * 7919)) & 0x7fffffff;
    const mine = Math.atan2(player.pos.z, player.pos.x);
    const off = (0.5 + ((seed >>> 3) % 60) / 100) * ((seed & 2) ? 1 : -1);
    const w = spawn(seed, mine + off);
    rec.woke += 1;
    saveRec();
    rebuildTags();
    const first = rec.woke === 1;
    setTimeout(() => {
      if (first) story?.comms?.sayKeys?.(['story.warden.first.a', 'story.warden.first.b']);
      else story?.comms?.sayKey?.('story.warden.wake', { force: true });
    }, 2600);
    return w;
  }

  // ------------------------------------------------------------------- fan
  /**
   * Throw the answers out behind it.
   *
   * The fan is centred nine metres back along its own track — they are thrown
   * backward, so they land between the construct and whoever is chasing it —
   * and it is spread ACROSS THE LINE THE CADET IS COMING IN ON, not across the
   * warden's own heading. Measured on real chases: spread the other way and a
   * cadet arriving from the side meets the four of them nose-to-tail, runs
   * through the first one he touches and never sees a choice. Abreast of the
   * approach, four weights are a rank you cross and pick from, which is the
   * entire encounter.
   */
  function shed(w) {
    clearFan(w);
    const tx = -Math.sin(w.ang) * w.dir;      // unit vector along travel
    const tz = Math.cos(w.ang) * w.dir;
    const cx = w.group.position.x - tx * FAN_BACK;
    const cz = w.group.position.z - tz * FAN_BACK;
    let ax = cx - player.pos.x, az = cz - player.pos.z;
    const al = Math.hypot(ax, az);
    if (al < 0.001) { ax = tx; az = tz; } else { ax /= al; az /= al; }
    const px = -az, pz = ax;                  // across the approach
    const mid = (FAN - 1) / 2;
    for (let k = 0; k < FAN; k++) {
      const off = (k - mid) * FAN_SPREAD;
      const g = new THREE.Group();
      g.position.set(cx + px * off, w.group.position.y - 3, cz + pz * off);
      const body = new THREE.Mesh(stoneGeo, stoneMat.clone());
      g.add(body);
      const halo = new THREE.Mesh(stoneHaloGeo, stoneHaloMat.clone());
      halo.userData.noCamBlock = true;
      g.add(halo);
      group.add(g);
      const gr = heightAt(g.position.x, g.position.z);
      const v = w.q.choices[k];
      w.fan.push({
        v, group: g, body, halo, ph: k * 1.4, life: FAN_LIFE,
        spent: w.spent.has(v),
        rest: (gr === null ? -40 : gr) + FAN_REST,
      });
    }
    w.fanT = 0;
    // The one instruction, said once a session, the first time a cadet is ever
    // standing in front of a fan. The name plate over the construct is a name
    // and nothing else — a sentence on a world label does not fit a phone held
    // sideways, and a sentence repeated every fourteen seconds is signage.
    if (!saidFan) { saidFan = true; hud?.flash?.(t('field.wardenFan'), ''); }
    rebuildTags();
  }

  function clearFan(w) {
    for (const s of w.fan) {
      group.remove(s.group);
      s.body.material.dispose();
      s.halo.material.dispose();
    }
    w.fan.length = 0;
  }

  // --------------------------------------------------------------- verdict
  function take(w, stone) {
    if (w.state === 'bound' || stone.spent) return;
    // (a·v − b) against c: the same reading the balance beam gives, in words.
    const diff = w.q.a * stone.v - w.q.b - w.q.c;
    if (diff === 0) return bind(w);

    w.spent.add(stone.v);
    clearFan(w);
    w.fanT = FAN_AGAIN;
    w.spook = SPOOK_FOR;
    emitSurge(w);
    fx?.impact?.('bad');
    hud?.flash?.(t(diff > 0 ? 'field.wardenOver' : 'field.wardenUnder', { n: Math.abs(diff) }), 'bad');
    // All four refused and the answer is still out there somewhere: the field
    // re-forms. Nobody is ever locked out of a question they have not answered.
    if (w.spent.size >= FAN) {
      w.spent.clear();
      setTimeout(() => { if (w.state !== 'bound') hud?.flash?.(t('field.balanceReset'), ''); }, 1200);
    }
    rebuildTags();
  }

  function bind(w) {
    w.state = 'bound';
    w.hold = 1.6;
    clearFan(w);
    w.shaft.visible = false;
    w.core.material.emissive.setHex(0xffd166);
    w.core.material.emissiveIntensity = 3.4;
    rec.bound += 1;
    saveRec();
    rebuildTags();

    // The island carries twelve deep caches and no more, which is about a
    // fortnight of coming back. Past that a warden is still worth running down:
    // what it would have left standing is paid out instead, at the same
    // untapered rate a question pays, so the loop does not go flat on day sixty.
    const room = (caches?.room?.() ?? 1) > 0;
    const owed = room ? BIND_PAY : BIND_PAY + DEEP_INSTEAD;
    const paid = wallet?.earn?.(owed, 'bind') ?? owed;
    audio?.unlocked?.();
    fx?.impact?.('good');
    hud?.flash?.(t('field.wardenBound', { n: paid }), 'good');
    // Every third one is a charter: the licence a waystation needs, which
    // otherwise only ever comes from the far end of the ladder. This is what
    // makes two hundred and forty motes a decision on the fifth day instead of
    // on the fiftieth. See src/kit/kit.js.
    if (rec.bound % CHARTER_EVERY_BIND === 0) kit?.grantCharter?.(1);
  }

  /** The construct comes apart, and what it was holding stays hanging there. */
  function collapse(w) {
    const made = caches?.hang?.(
      w.group.position.x, w.group.position.z, w.group.position.y + 4, w.seed,
    );
    setTimeout(() => {
      story?.comms?.sayKey?.(made ? 'story.warden.left' : 'story.warden.full', { force: true });
    }, 900);
    remove(w);
  }

  function remove(w) {
    clearFan(w);
    group.remove(w.group);
    w.core.material.dispose();
    for (const r of w.rings) r.material.dispose();
    w.halo.material.dispose();
    w.shaft.material.dispose();
    const i = live.indexOf(w);
    if (i >= 0) live.splice(i, 1);
    saveRec();
    rebuildTags();
  }

  /**
   * The ring it throws. It lies on the GROUND under the construct, not in the
   * air at its own altitude: a ring of pressure is something you see coming
   * across the grass and jump, which is the reading the rift surge already
   * taught (src/world/drift.js). One language for one kind of event.
   */
  function emitSurge(w) {
    const m = new THREE.Mesh(surgeGeo, surgeMat.clone());
    m.userData.noCamBlock = true;
    m.renderOrder = 3;
    const g = heightAt(w.group.position.x, w.group.position.z);
    const y = (g === null ? w.group.position.y - 14 : g) + 0.6;
    m.position.set(w.group.position.x, y, w.group.position.z);
    group.add(m);
    surges.push({ mesh: m, r: 2, hit: false, x: m.position.x, y, z: m.position.z });
  }

  // -------------------------------------------------------------------- tags
  function rebuildTags() {
    tags.innerHTML = '';
    const nodes = [];
    for (const w of live) {
      if (w.state === 'bound') continue;
      // Two plates, one over the other, and each has a range of its own. Two
      // metres of world separation is twenty screen pixels at a hundred metres,
      // which is two labels sitting on each other — so the name retires first
      // and the statement, which is the thing worth flying at, stands alone.
      const lede = document.createElement('div');
      lede.className = 'field-tag lede warden-lede';
      lede.textContent = t('field.wardenTag');
      tags.appendChild(lede);
      nodes.push({ el: lede, w, off: [0, 6.6, 0], max: 86 });

      const big = document.createElement('div');
      big.className = 'field-tag big';
      big.innerHTML = tex(w.q.latex);
      tags.appendChild(big);
      nodes.push({ el: big, w, off: [0, 4.4, 0], max: TAG_REACH });

      for (const s of w.fan) {
        const el = document.createElement('div');
        el.className = `field-tag weight${s.spent ? ' spent' : ''}`;
        el.innerHTML = tex(String(s.v));
        tags.appendChild(el);
        nodes.push({ el, w, stone: s, off: [0, 1.5, 0], max: 110 });
      }
    }
    tagNodes = nodes;
  }

  const _v = new THREE.Vector3();
  function placeTags(camera) {
    if (!tagNodes.length) return;
    const W = window.innerWidth, H = window.innerHeight;
    for (const nd of tagNodes) {
      const base = nd.stone ? nd.stone.group.position : nd.w.group.position;
      _v.set(base.x + nd.off[0], base.y + nd.off[1], base.z + nd.off[2]);
      const d = _v.distanceTo(camera.position);
      _v.project(camera);
      const on = _v.z < 1 && d < (nd.max || TAG_REACH) && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1;
      if (!on) { if (nd.el.style.display !== 'none') nd.el.style.display = 'none'; continue; }
      nd.el.style.display = '';
      nd.el.style.left = `${(_v.x * 0.5 + 0.5) * W}px`;
      nd.el.style.top = `${(-_v.y * 0.5 + 0.5) * H}px`;
      nd.el.style.opacity = String(Math.max(0.14, 1 - Math.max(0, d - 70) / 90));
    }
  }

  // ------------------------------------------------------------------- frame
  function update(dt, time, camera) {
    const busy = isBusy();

    // ---- does the lattice put another one out? Asked once a second, off the
    // same day ledger the story and the spacing schedule read.
    //
    // Deliberately NOT conditioned on `busy`. The first version was, and a
    // returning cadet's day opens on the first answer of a run — which is,
    // by construction, a moment when a rift has the frame. The warden then
    // waited for a quiet frame that a busy session never gave it, and the whole
    // fifth day did not happen. Waking is a fact about the world; the line
    // Marlow says about it is queued on his own channel and takes its turn.
    poll -= dt;
    if (poll <= 0) {
      poll = 1;
      const ds = safeDays();
      if (ds && ds.count >= WAKE_DAY && ds.last && ds.last !== rec.day
          && live.length < MAX_ALIVE) {
        rec.day = ds.last;
        wake();
      }
    }

    for (let i = live.length - 1; i >= 0; i--) {
      const w = live[i];

      if (w.state === 'bound') {
        w.hold -= dt;
        w.group.scale.setScalar(Math.max(0.05, w.hold / 1.6));
        for (const r of w.rings) r.rotation.y += dt * 6;
        if (w.hold <= 0) collapse(w);
        continue;
      }

      const px = player.pos.x, pz = player.pos.z;
      const flat = Math.hypot(w.group.position.x - px, w.group.position.z - pz);
      if (!busy) {
        if (w.state === 'idle' && flat < ROUSE) { w.state = 'roused'; w.fanT = 0.4; }
        else if (w.state === 'roused' && flat > CALM) {
          w.state = 'idle';
          clearFan(w);
          rebuildTags();
        }
      }

      // ---- the circuit
      w.spook = Math.max(0, w.spook - dt);
      // Flat out only at RANGE. Inside the distance at which it noticed you it
      // holds the waiting pace, whether or not its fan is down.
      //
      // Measured on real chases, and it was the one thing that made the whole
      // encounter unwinnable: a miss cleared the fan, the construct went back
      // to fourteen and a half metres a second, and a cadet who has not bought
      // STORM LEGS never got inside shedding range again for the rest of the
      // session. A machine that runs away for ever after one wrong answer is
      // not pressure; it is a door closing on somebody who has just made the
      // mistake the door was built to teach.
      const onIt = flat < ROUSE;
      const cruise = w.state !== 'roused' ? SPEED_IDLE
        : (w.fan.length || onIt ? SPEED_WAIT : SPEED_ROUSED);
      const speed = busy ? 0 : cruise * (w.spook > 0 ? SPOOK_MUL : 1);
      w.ang += (w.dir * speed * dt) / w.r;
      const x = Math.cos(w.ang) * w.r;
      const z = Math.sin(w.ang) * w.r;

      // ---- and the intent: it keeps its distance in the one axis a cadet
      // cannot sprint. Stand under it and it climbs; get above it and it dives.
      let want = ALT_HOLD;
      if (w.state === 'roused' && flat < 34) {
        want = player.pos.y > w.group.position.y + 4 ? ALT_DIVE : ALT_LIFT;
      }
      w.alt += (want - w.alt) * Math.min(1, dt * 0.7);
      const g = heightAt(x, z);
      const y = (g === null ? 4 : g) + w.alt;
      w.group.position.set(x, THREE.MathUtils.damp(w.group.position.y, y, 2.4, dt), z);

      // ---- the look
      const hot = w.state === 'roused';
      w.core.material.emissiveIntensity = hot ? 3.0 : 1.5;
      w.core.material.emissive.setHex(hot ? 0xff9a3c : 0x6f8fd8);
      w.core.rotation.y = time * (hot ? 1.6 : 0.6);
      w.core.rotation.x = time * 0.4;
      w.rings[0].rotation.y += dt * (hot ? 2.6 : 0.8);
      w.rings[1].rotation.x += dt * (hot ? 2.0 : 0.6);
      const open = hot ? 1.5 : 1;
      w.rings[0].scale.setScalar(THREE.MathUtils.damp(w.rings[0].scale.x, open, 3, dt));
      w.rings[1].scale.setScalar(w.rings[0].scale.x);
      w.halo.material.opacity = (hot ? 0.2 : 0.1) + 0.04 * Math.sin(time * 2 + w.seed);
      w.shaft.material.opacity = 0.16 + 0.07 * Math.sin(time * 1.2 + w.seed);

      // ---- the fan it leaves behind
      if (w.state === 'roused' && !busy) {
        if (!w.fan.length) {
          w.fanT -= dt;
          if (w.fanT <= 0 && flat < SHED_NEAR) shed(w);
        } else {
          let gone = false;
          for (const s of w.fan) {
            s.life -= dt;
            // it was dropped, so it falls, and then it hangs where a mote hangs
            if (s.group.position.y > s.rest) {
              s.group.position.y = Math.max(s.rest, s.group.position.y - FAN_SINK * dt);
            } else {
              s.group.position.y = s.rest + Math.sin(time * 1.6 + s.ph) * 0.22;
            }
            s.body.rotation.y = time * 0.9 + s.ph;
            s.body.rotation.x = time * 0.5;
            const fade = Math.min(1, s.life / 2.4);
            // A weight the beam has already refused comes back dark and inert,
            // the way a spent counterweight does on a hanging cache.
            s.body.material.emissiveIntensity = (s.spent ? 0.25 : 2.0) * fade;
            s.body.material.color.setHex(s.spent ? 0x6b7385 : 0xe6dcff);
            s.halo.material.opacity = (s.spent ? 0.04 : 0.14) * fade;
            if (s.life <= 0) gone = true;
          }
          if (gone) { clearFan(w); w.fanT = FAN_AGAIN; rebuildTags(); }
          else {
            for (const s of w.fan) {
              if (s.spent) continue;
              if (s.group.position.distanceTo(player.pos) < TOUCH) { take(w, s); break; }
            }
          }
        }
      }
    }

    // ---- the rings it throws
    for (let i = surges.length - 1; i >= 0; i--) {
      const s = surges[i];
      s.r += SURGE_SPEED * dt;
      s.mesh.scale.setScalar(s.r);
      s.mesh.material.opacity = 0.5 * (1 - s.r / SURGE_R) + 0.05;
      if (!s.hit && !busy) {
        const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z);
        if (Math.abs(d - s.r) < 3.6 && player.pos.y - s.y < 9) {
          s.hit = true;
          const k = Math.max(0.001, d);
          player.vel.x += ((player.pos.x - s.x) / k) * 11;
          player.vel.z += ((player.pos.z - s.z) / k) * 11;
          player.vel.y = Math.max(player.vel.y, 5);
          if (player.loco) player.loco.grounded = false;
        }
      }
      if (s.r >= SURGE_R) {
        group.remove(s.mesh);
        s.mesh.material.dispose();
        surges.splice(i, 1);
      }
    }

    if (camera) placeTags(camera);
  }

  // -------------------------------------------------------------------- save
  function safeDays() {
    try { return story?.daysState?.() || null; } catch { return null; }
  }
  function loadRec() {
    const blank = { day: 0, woke: 0, bound: 0, live: [] };
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object') return blank;
      return {
        day: raw.day | 0, woke: raw.woke | 0, bound: raw.bound | 0,
        live: Array.isArray(raw.live) ? raw.live.slice(0, MAX_ALIVE) : [],
      };
    } catch { return blank; }
  }
  function saveRec() {
    rec.live = live.filter((w) => w.state !== 'bound').map((w) => ({ seed: w.seed, ang: w.ang }));
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* private mode */ }
  }

  return {
    update,
    relocalise: rebuildTags,
    /** The live constructs, so a critic walks the real encounter, not a mock. */
    list: live,
    state: () => ({
      wakeDay: WAKE_DAY,
      alive: live.length,
      woke: rec.woke,
      bound: rec.bound,
      at: live.map((w) => ({
        seed: w.seed, state: w.state,
        x: Math.round(w.group.position.x), y: Math.round(w.group.position.y),
        z: Math.round(w.group.position.z),
        latex: w.q.latex, answer: w.q.x,
        weights: w.fan.filter((s) => !s.spent).map((s) => s.v),
        refused: [...w.spent],
      })),
    }),
    /**
     * Metres to the nearest awake warden, and where it is. A critic hook: it
     * lets a harness walk at the real encounter without being handed a scene
     * graph, and it is the one call this module offers that nothing inside it
     * uses, so it can never quietly become the thing the game runs on.
     */
    nearest() {
      let best = null, bd = Infinity;
      for (const w of live) {
        if (w.state === 'bound') continue;
        const d = Math.hypot(w.group.position.x - player.pos.x, w.group.position.z - player.pos.z);
        if (d < bd) { bd = d; best = w; }
      }
      return best ? { d: Math.round(bd), pos: best.group.position.clone(), state: best.state } : null;
    },
    reset() {
      for (let i = live.length - 1; i >= 0; i--) remove(live[i]);
      rec.day = 0; rec.woke = 0; rec.bound = 0; rec.live = [];
      try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    },
  };
}
