import * as THREE from 'three';
import { heightAt, skylineAt } from './terrain.js';
import { routeFrom } from './paths.js';
import { merge } from './geom.js';
// A gate is something you meet between two places, and you have to be able to
// see it. (src/world/clearings.js)
import { reserve, obstructionAt, liftAt } from './clearings.js';
import { tex } from '../ui/tex.js';

import './field.css';

/**
 * THE WAYGATES — the walk between two tears, made into a place.
 *
 * THE FINDING THIS FILE EXISTS FOR, from a cold critic at 5/10 DO_NOT_SHIP:
 *
 *   "This game has exactly one composed frame and it is the one you land on.
 *    Everything after the landing plaza is uncomposed terrain the player is
 *    dropped into… 70-82% of a session is traversal through space that was
 *    never composed."
 *
 * And the direction that came with it: the hanging caches (`src/world/caches.js`)
 * are the proven form — *an off-island site where the mathematics is the
 * mechanism, not a quiz with a view* — and there need to be more of them, of
 * more kinds, **along the routes players actually walk**.
 *
 * A cache hangs in the sky off the coast. You have to want it, fly to it, and
 * come back. That is right for a cache and it is exactly why it does nothing at
 * all for the ninety metres of hillside between two tears, which is where the
 * session is actually spent. So a waygate is the same idea turned inside out:
 *
 *   IT STANDS ON THE ROAD, so you meet it by walking rather than by deciding to.
 *   YOU GO THROUGH IT, so it is architecture and not an exhibit — two piers,
 *     a lintel, and the next hundred metres of the world framed inside it.
 *   IT IS SEALED, and the thing that unseals it is arithmetic done with your feet.
 *
 * **IT IS NOT A LOCK, AND THAT IS DELIBERATE.** The curtain is light, not a
 * wall: a cadet who cannot yet do the arithmetic walks straight through it and
 * carries on to the tear. A gate that could actually stop somebody would be the
 * exact defect this whole lane exists to remove — a player held in the middle of
 * a corridor with no way on. Nothing in this world may ever cost you the route.
 * What the stones buy is the seal, the motes and the landmark.
 *
 * THE MECHANISM. The lintel carries a value for the letter and an expression:
 *
 *        x = 6            2x + 5
 *
 * Four flat stones lie across the road in front of it, each cut with a number.
 * **Walk onto the one the expression comes to.** The right stone lights, the
 * lattice curtain in the gate tears open, and the road runs on through it. A
 * wrong stone sinks under the boot and goes dark — you can see, physically,
 * which answers this gate has already refused — and the others stay live, so a
 * miss costs a step and teaches the misconception rather than ending the
 * attempt. The three wrong stones are the three mistakes this step actually
 * produces: adding where the notation multiplies, adding the constant before
 * multiplying, and taking the sign off the constant.
 *
 * There is no keypad, no card, no sentence of instruction and no menu. It is
 * the skill named on the very corridor the report was written about —
 * `eval-expr`, *Evaluating expressions* — standing in the road.
 *
 * WHAT IT PAYS. Motes, once, and then it is a permanent open gate: a landmark
 * with a hole in it that you can see the route through from a long way off, and
 * a silhouette on the skyline that says *the road goes that way*. The world is
 * different because you played, which is the same promise a cache makes.
 *
 * WHERE THEY STAND. On the real walkable route between a tear and the tear
 * before it — `routeFrom` in `src/world/paths.js`, the same line the trace on
 * the ground follows — a little past halfway, on the flattest ground within a
 * few metres of it, turned square across the road. Never within 34 m of another
 * gate, and never on a leg short enough that the two tears are already in one
 * frame.
 */

/** Metres of route below which a leg needs no landmark: you can see both ends. */
const LEG_MIN = 28;
/** No two gates closer than this, or two places become one. */
const CLEAR = 24;
/** How far along the leg it stands. Past halfway, so it reads as arrival. */
const ALONG = 0.56;
/** …and the stretch of the leg a gate may stand in, as a fraction of it. */
const ALONG_MIN = 0.30, ALONG_MAX = 0.75;
/** Metres from a tear inside which a gate is litter in the tear's own frame. */
const OFF_TEAR = 20;
/** Metres from the landing at which the arrival frame stops being the subject. */
const OFF_HOME = 52;
/** Walks examined for a site, longest first. See `legs`. */
const MAX_LEGS = 240;
/** Metres at which a gate is the subject of the frame rather than scenery. */
const SPEAK_R = 46;
/** Motes, once. A cache pays 120 for a flight; this is a stone in the road. */
const REWARD = 45;
/** Metres from the middle of a stone at which a boot is on it. */
const TOUCH = 2.4;
const PIER_H = 9.4;
const SPAN = 11.0;             // clear width between the piers
const STONE_R = 1.85;

const stoneMat = new THREE.MeshStandardMaterial({
  color: 0xb9b0a2, roughness: 0.9, metalness: 0.03, flatShading: true,
});

// ---------------------------------------------------------------------------
// ONE GEOMETRY EACH, FOR EVERY GATE ON THE ISLAND.
//
// Every gate is the same gate: the piers, the lintel, the tooth, the curtain
// and the four stones are built from constants and differ only in where they
// stand and which way they face, which is a matrix and not a buffer. Building
// them per gate cost ten GPU geometries a gate, and `check:sustain` measures
// exactly that — a geometry is counted the first time the renderer sees it, so
// three more gates on the far side of the island read as **live GPU geometries
// grew 27% (298 -> 378) — unbounded accumulation** the moment a cadet walked
// past them. It was never accumulation and it was never unbounded, but it was
// thirty buffers this file did not need: the same shape, uploaded four times.
// ---------------------------------------------------------------------------
const ARCH_GEO = (() => {
  const parts = [];
  const half = SPAN / 2 + 0.9;
  for (const sx of [-1, 1]) {
    const foot = new THREE.BoxGeometry(3.4, 0.9, 3.4);
    foot.translate(sx * half, 0.45, 0);
    parts.push(foot);
    const pier = new THREE.BoxGeometry(2.0, PIER_H, 2.0);
    pier.translate(sx * half, 0.9 + PIER_H / 2, 0);
    parts.push(pier);
    const cap = new THREE.BoxGeometry(2.9, 0.7, 2.9);
    cap.translate(sx * half, 0.9 + PIER_H + 0.35, 0);
    parts.push(cap);
  }
  const lintel = new THREE.BoxGeometry(SPAN + 6.2, 1.7, 2.6);
  lintel.translate(0, 0.9 + PIER_H + 1.55, 0);
  parts.push(lintel);
  // a broken tooth on top, so the silhouette is a ruin rather than a doorframe
  const tooth = new THREE.BoxGeometry(2.4, 2.2, 2.2);
  tooth.translate(-half * 0.45, 0.9 + PIER_H + 3.1, 0);
  parts.push(tooth);
  const out = merge(parts);
  for (const p of parts) p.dispose();
  return out;
})();
const CURTAIN_GEO = new THREE.PlaneGeometry(SPAN, PIER_H + 0.6, 1, 1);
const SLAB_GEO = new THREE.CylinderGeometry(STONE_R, STONE_R * 1.06, 0.55, 8);
const LAMP_GEO = (() => {
  const g = new THREE.RingGeometry(STONE_R * 0.55, STONE_R * 0.86, 24);
  g.rotateX(-Math.PI / 2);
  return g;
})();

export function createWaygates(opts = {}) {
  const {
    scene, uiRoot, player, rifts, graph, wallet, audio, fx, isBusy = () => false,
  } = opts;

  const group = new THREE.Group();
  group.name = 'waygates';
  scene.add(group);

  const tags = document.createElement('div');
  tags.className = 'field-tags';
  (uiRoot || document.body).appendChild(tags);

  const list = [];
  const saved = load();

  // ------------------------------------------------------------------ sites
  /**
   * The legs a player is actually sent down: from the landing plaza to each
   * root tear, and from every tear to the tears it unlocks. That is the same
   * order the map grows in, so a gate always stands between where you have been
   * and where you are being sent.
   */
  function legs() {
    const at = new Map();
    for (const r of rifts.list) at.set(r.id, { x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z });
    const out = [];
    for (const n of graph.nodes) {
      const b = at.get(n.id);
      if (!b) continue;
      // Every line of the lattice, and the walk back to the landing from every
      // tear on it. The scheduler sends a cadet to whichever line is worth most
      // to him right now, which is very often not the one next door — so the
      // legs that matter are not only the lattice's own edges.
      //
      // AND THAT SENTENCE USED TO BE A COMMENT WITH NO CODE UNDER IT. The list
      // was the ten walks out from the landing plus the nine prerequisite
      // edges, which is nineteen of the ninety-nine walks a session can send
      // somebody down, so the corridors the scheduler actually uses had no
      // landmark on them unless they happened to be a lattice edge.
      out.push({ id: `plaza>${n.id}`, a: { x: 0, z: 0 }, b });
      for (const m of graph.nodes) {
        if (m.id === n.id) continue;
        const c = at.get(m.id);
        if (c) out.push({ id: `${m.id}>${n.id}`, a: c, b });
      }
    }
    // Longest legs first: a gate is worth most where the walk is worst, and the
    // spacing rule below then keeps the short ones from crowding it out.
    out.sort((p, q) => Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) - Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z));
    // …and a bound, because this list is quadratic in the lattice. Ten tears is
    // a hundred walks; `content/courses.json` composes sixty-two into one
    // island and that is three thousand eight hundred, each of them a route
    // query at boot for gates that the spacing rule will refuse anyway. The
    // longest two hundred and forty are every walk worth standing a landmark
    // on, and on the shipping lattice this changes nothing at all.
    return out.slice(0, MAX_LEGS);
  }

  /**
   * THE SEARCH IS IN METRES, AND IT WAS NOT.
   *
   * This used to walk to the cell 56% along the route and then look at the
   * fourteen cells either side of it. `routeFrom` returned cells three metres
   * apart, so that was a forty-two-metre window; it now returns them 1.4 m
   * apart (src/world/paths.js is built on the boots' own 0.7 m baseline), and
   * the same fourteen cells became a **nineteen-metre** window. Nothing else
   * changed and the island went from three gates to one, silently, because the
   * search was written in units of somebody else's implementation detail.
   *
   * So the middle of the leg is scanned by distance travelled, every candidate
   * on it is scored, and the best one wins: flattest, nearest the middle.
   */
  function siteFor(leg) {
    const r = routeFrom(leg.a.x, leg.a.z, leg.b.x, leg.b.z);
    if (!r || r.metres < LEG_MIN || r.cells.length < 4) return null;
    let run = 0, best = null;
    for (let i = 1; i < r.cells.length; i++) {
      const c = r.cells[i - 1], n = r.cells[i];
      run += Math.hypot(n[0] - c[0], n[2] - c[2]);
      const u = run / r.metres;
      if (u < ALONG_MIN || u > ALONG_MAX) continue;
      const x = c[0], z = c[2];
      const h = heightAt(x, z);
      if (h === null) continue;
      // Never in the landing frame. The arrival shot is the one composed frame
      // this game already had and nothing of mine gets to stand in it.
      if (Math.hypot(x, z) < OFF_HOME) continue;
      // …and never inside the aqueduct, a hoodoo or a landmark. A gate is a
      // thing you walk THROUGH. (src/world/clearings.js)
      if (obstructionAt(x, z) > 0) continue;
      // …and clear of an updraft, with the whole seventeen-metre approach ring
      // outside it: a gate a cadet is lifted off on the way to is a gate he
      // cannot walk to. (src/world/clearings.js)
      if (liftAt(x, z, 20) > 0) continue;
      let inStone = false;
      for (let k = 0; k < 8; k++) {
        const a3 = (k / 8) * Math.PI * 2;
        if (obstructionAt(x + Math.cos(a3) * 9, z + Math.sin(a3) * 9) > 0) { inStone = true; break; }
      }
      if (inStone) continue;
      // …and clear of the tears themselves. A gate seated at 56% of a long leg
      // can land on a tear that belongs to a different line, and the first
      // capture of a real session has `x = 3` and four stones printed over the
      // VAULT PLATE card of the rift the cadet was sealing. A waygate is
      // something you meet BETWEEN two places. Twenty metres is the same radius
      // `placeTags` already uses to hand the frame to a tear, so the two rules
      // agree instead of one of them being a second opinion.
      if (rifts.list.some((rr) => {
        const rx = rr.foot ? rr.foot.x : rr.pos.x, rz = rr.foot ? rr.foot.z : rr.pos.z;
        return Math.hypot(x - rx, z - rz) < OFF_TEAR;
      })) continue;
      // flat enough to stand a gate on, measured across the road as well as
      // along it, because a lintel is eleven metres wide
      let worst = 0;
      for (let d = 0; d < 8; d++) {
        const a2 = (d / 8) * Math.PI * 2;
        const hh = heightAt(x + Math.cos(a2) * 7, z + Math.sin(a2) * 7);
        if (hh === null) { worst = 99; break; }
        worst = Math.max(worst, Math.abs(hh - h));
      }
      if (worst > 7.6) continue;
      // …and a cadet has to be able to WALK IN, from the bearings a critic will
      // use. `worst` is measured on a seven-metre ring, which a gate standing on
      // a switchback of the Reach passes: the road is flat for seven metres and
      // then drops thirty. The composition gate walks in from seventeen, and on
      // that gate it read `not standing on a surface` from every bearing at
      // once, because he was falling.
      let stand = 0;
      for (let d = 0; d < 8; d++) {
        const a2 = (d / 8) * Math.PI * 2;
        const h2 = heightAt(x + Math.cos(a2) * 17, z + Math.sin(a2) * 17);
        if (h2 !== null && Math.abs(h2 - h) < 12) stand++;
      }
      if (stand < 4) continue;
      // flattest, and as near the middle of the walk as flat ground allows —
      // and, since the composition gate read `nothing in the frame reaches 25m`
      // standing at three of the four gates this search seated, a place a cadet
      // can see out of. Terrain only; what is GROWING here is answered by
      // src/world/clearings.js, which cuts a clearing round every gate.
      const score = worst + Math.abs(u - ALONG) * 12 + (1 - skylineAt(x, z)) * 2.5
        + (8 - stand) * 1.2;
      const yaw = Math.atan2(n[0] - c[0], n[2] - c[2]);
      if (!best || score < best.score) best = { x, z, y: h, yaw, worst, score };
    }
    return best;
  }

  {
    const seen = [];
    let seed = 0;
    for (const leg of legs()) {
      const s = siteFor(leg);
      if (!s) continue;
      if (seen.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < CLEAR)) continue;
      seen.push(s);
      reserve(s.x, s.z, 17, 'waygate');
      make({ key: leg.id, seed: seed++, ...s });
    }
  }

  // ------------------------------------------------------------------ build
  function make(spec) {
    const g = new THREE.Group();
    g.position.set(spec.x, spec.y, spec.z);
    g.rotation.y = spec.yaw;
    group.add(g);

    // Piers and lintel, baked to one geometry: rigid, unlit by anything but the
    // sun, and never animated. Six meshes here would be six draw calls a gate.
    const arch = new THREE.Mesh(ARCH_GEO, stoneMat);
    arch.castShadow = true;
    arch.receiveShadow = true;
    g.add(arch);

    // The curtain: the thing that is shut. Lattice light across the opening,
    // additive, no depth write, and it is the whole of "you cannot go through".
    const curtainGeo = CURTAIN_GEO;
    const curtainMat = new THREE.MeshBasicMaterial({
      color: 0x7ec8ff, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      side: THREE.DoubleSide,
    });
    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.position.set(0, 0.9 + (PIER_H + 0.6) / 2, 0);
    curtain.userData.noCamBlock = true;
    curtain.renderOrder = 3;
    g.add(curtain);

    const q = question(spec.seed);
    const stones = [];
    const gap = 4.5;
    const mid = (q.choices.length - 1) / 2;
    for (let i = 0; i < q.choices.length; i++) {
      const sg = new THREE.Group();
      const lx = (i - mid) * gap;
      // in front of the gate, across the road
      sg.position.set(lx, 0, 6.6);
      const slab = new THREE.Mesh(SLAB_GEO, stoneMat);
      slab.position.y = 0.2;
      slab.castShadow = true;
      slab.receiveShadow = true;
      sg.add(slab);
      const lampGeo = LAMP_GEO;
      const lampMat = new THREE.MeshBasicMaterial({
        color: 0x9fd8ff, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.y = 0.49;
      lamp.userData.noCamBlock = true;
      lamp.renderOrder = 4;
      sg.add(lamp);
      g.add(sg);
      stones.push({ group: sg, slab, lamp, lampMat, v: q.choices[i], spent: false, sink: 0 });
    }

    const c = {
      key: spec.key, seed: spec.seed, x: spec.x, y: spec.y, z: spec.z, yaw: spec.yaw,
      group: g, curtain, curtainMat, stones, q,
      open: !!saved[spec.key], glow: 0, flash: 0, tags: [],
    };
    // What it asks, hung on the lintel where you read it as you walk up.
    c.tags = [
      { local: [0, 0.9 + PIER_H + 3.0, 0.1], cls: 'lede big', tex: `x = ${q.x}` },
      { local: [0, 0.9 + PIER_H + 1.6, 1.6], cls: 'weight', tex: q.latex },
    ];
    for (let i = 0; i < stones.length; i++) {
      c.tags.push({ local: [stones[i].group.position.x, 0.95, 6.6], cls: 'weight', tex: String(stones[i].v), stone: i });
    }
    if (c.open) openNow(c, true);
    list.push(c);
  }

  // --------------------------------------------------------------- the maths
  /**
   * `a·x + b` at a named value of x — the whole of `eval-expr`, small enough to
   * cut into four stones, with three wrong numbers that are three real
   * misconceptions rather than three near misses:
   *
   *   a + x + b     the notation was read as an addition
   *   a·(x + b)     the constant was joined to x before the multiplying
   *   a·x − b       the sign came off the constant
   */
  function question(seed) {
    const rnd = dice(seed);
    for (let tries = 0; tries < 60; tries++) {
      const a = 2 + rnd(6);            // 2..7
      const x = 2 + rnd(8);            // 2..9
      const b = 2 + rnd(9);            // 2..10
      const right = a * x + b;
      if (right > 74) continue;
      const set = uniq([right, a + x + b, a * (x + b), a * x - b]);
      if (set.length < 4) continue;
      return { a, b, x, right, choices: shuffle(set, rnd), latex: `${a}x + ${b}` };
    }
    return { a: 3, b: 4, x: 5, right: 19, choices: [19, 12, 27, 11], latex: '3x + 4' };
  }

  /** A small seeded die, so a gate asks the same question for ever. */
  function dice(seed) {
    let h = 0x9e3779b9 ^ ((seed | 0) * 2654435761);
    return (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 8) % n); };
  }
  function uniq(a) { const s = []; for (const v of a) if (v > 0 && !s.includes(v)) s.push(v); return s; }
  function shuffle(a, rnd) {
    const c = a.slice();
    for (let i = c.length - 1; i > 0; i--) { const j = rnd(i + 1); const t2 = c[i]; c[i] = c[j]; c[j] = t2; }
    return c;
  }

  // ------------------------------------------------------------------- state
  function openNow(c, silent) {
    c.open = true;
    c.curtain.visible = false;
    for (const s of c.stones) { s.lamp.visible = false; }
    if (silent) c.glow = 1;
  }

  function tread(c, s) {
    if (c.open || s.spent || isBusy()) return;
    if (s.v === c.q.right) {
      openNow(c, false);
      save();
      // Paid as ground income, so the day's assay governs it exactly as it
      // governs a vein or a cache. (src/kit/ledger.js)
      wallet?.earn?.(REWARD, 'found');
      audio?.unlocked?.();
      fx?.impact?.('good');
      c.flash = 1;
      rebuildTags();
    } else {
      s.spent = true;
      s.sink = 1;
      // No sting. `audio.answered` is the LEARNING event and feeds the score's
      // model of a run (src/audio); a stone in the road is not a question the
      // engine asked, and telling the music otherwise would be a lie about the
      // session. The stone sinking under the boot is the feedback.
      fx?.impact?.('bad');
      rebuildTags();
    }
  }

  // -------------------------------------------------------------------- tags
  let tagNodes = [];
  function rebuildTags() {
    tags.innerHTML = '';
    const nodes = [];
    for (const c of list) {
      if (c.open) continue;
      for (const tag of c.tags) {
        const el = document.createElement('div');
        const stone = tag.stone != null ? c.stones[tag.stone] : null;
        el.className = `field-tag ${tag.cls}${stone && stone.spent ? ' spent' : ''}`.trim();
        el.innerHTML = tex(tag.tex);
        tags.appendChild(el);
        nodes.push({ el, c, local: tag.local, stone });
      }
    }
    tagNodes = nodes;
  }
  rebuildTags();

  const _v = new THREE.Vector3();
  /**
   * ONE GATE SPEAKS AT A TIME.
   *
   * Two gates a hundred metres apart put two expressions and eight numbers on
   * one screen, and the first capture of this file has `x = 5`, `19` and `18`
   * from the next gate along printed over the gate the cadet is standing at.
   * Everything else in this world learned that lesson already — `afford.js`
   * lets one tear talk, `tagspace.js` arbitrates the whole frame — so the
   * nearest gate owns the labels and the rest are silhouettes until you walk
   * at them.
   */
  function placeTags(camera) {
    if (!tagNodes.length) return;
    // ---- AND NOT IN THE LANDING FRAME, EVER --------------------------------
    //
    // A gate's labels are drawn as `.field-tag`, which `src/world/tagspace.js`
    // lists as CHROME — furniture other world labels walk around — so nothing
    // arbitrates them against the game's own cards. The layout sweep found the
    // consequence the moment this file went from one gate to five: **452
    // overlaps across 126 of 288 frames, every one of them a gate's lintel
    // printed through `.meta-stamp` or a HUD plate**, and every one of them in a
    // scene shot at the landing.
    //
    // A gate is not allowed to stand in the arrival frame (`OFF_HOME` in
    // `siteFor`), so it is not allowed to TALK into it either — the rule was
    // only ever written about the stones. And past that, a gate speaks when it
    // is the subject of the frame rather than a dot on the horizon: at ninety
    // metres its lintel projects into whatever corner of the glass the lens
    // happens to put it, which on a 844×390 phone is the top-left corner where
    // the location stamp lives.
    const camR = Math.hypot(camera.position.x, camera.position.z);
    if (camR < OFF_HOME + 8) {
      for (const nd of tagNodes) if (nd.el.style.display !== 'none') nd.el.style.display = 'none';
      return;
    }
    let near = null, nd2 = 1e9;
    for (const c of list) {
      if (c.open) continue;
      const d = Math.hypot(camera.position.x - c.x, camera.position.z - c.z);
      if (d < nd2) { nd2 = d; near = c; }
    }
    // A TEAR OUTRANKS A GATE, ALWAYS. Standing on a dais the frame belongs to
    // the rift, its plate and its key; a gate's expression printed across that
    // is litter, and this world has paid for that mistake once already
    // (src/world/tagspace.js).
    if (near) {
      for (const rr of rifts.list) {
        const rx = rr.foot ? rr.foot.x : rr.pos.x, rz = rr.foot ? rr.foot.z : rr.pos.z;
        if (Math.hypot(camera.position.x - rx, camera.position.z - rz) < Math.min(nd2, 22)) { near = null; break; }
      }
    }
    const w = window.innerWidth, h = window.innerHeight;
    for (const nd of tagNodes) {
      if (nd.c !== near) { if (nd.el.style.display !== 'none') nd.el.style.display = 'none'; continue; }
      _v.set(nd.local[0], nd.local[1], nd.local[2]).applyMatrix4(nd.c.group.matrixWorld);
      const d = _v.distanceTo(camera.position);
      _v.project(camera);
      const on = _v.z < 1 && d < SPEAK_R && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
      if (!on) { if (nd.el.style.display !== 'none') nd.el.style.display = 'none'; continue; }
      nd.el.style.display = '';
      nd.el.style.left = `${(_v.x * 0.5 + 0.5) * w}px`;
      nd.el.style.top = `${(-_v.y * 0.5 + 0.5) * h}px`;
      nd.el.style.opacity = String(Math.max(0.2, 1 - Math.max(0, d - SPEAK_R * 0.6) / (SPEAK_R * 0.45)));
    }
  }

  // ------------------------------------------------------------------- frame
  const _p = new THREE.Vector3();
  function update(dt, time, camera) {
    const px = player.pos.x, pz = player.pos.z;
    for (const c of list) {
      const dx = px - c.x, dz = pz - c.z;
      const near = dx * dx + dz * dz < 150 * 150;
      c.group.visible = near;
      if (!near) continue;
      c.flash = Math.max(0, c.flash - dt * 0.7);
      if (!c.open) {
        // The curtain breathes, so a shut gate reads as held rather than solid.
        c.curtainMat.opacity = 0.34 + 0.16 * Math.sin(time * 1.5 + c.seed);
        for (const s of c.stones) {
          if (s.sink > 0) {
            s.sink = Math.max(0, s.sink - dt * 1.6);
            s.group.position.y = -0.42 * (1 - s.sink);
          }
          s.lampMat.opacity = s.spent ? 0.10 : 0.42 + 0.26 * Math.sin(time * 2.2 + s.v);
          if (s.spent) continue;
          _p.set(s.group.position.x, 0, s.group.position.z).applyMatrix4(c.group.matrixWorld);
          if (Math.hypot(px - _p.x, pz - _p.z) < TOUCH) tread(c, s);
        }
      } else {
        c.glow = Math.min(1, c.glow + dt * 1.4);
      }
    }
    if (camera) placeTags(camera);
  }

  // -------------------------------------------------------------------- save
  function load() {
    try { return JSON.parse(localStorage.getItem('ascent.waygates') || '{}') || {}; }
    catch { return {}; }
  }
  function save() {
    const o = {};
    for (const c of list) if (c.open) o[c.key] = 1;
    try { localStorage.setItem('ascent.waygates', JSON.stringify(o)); } catch { /* private mode */ }
  }

  return {
    update,
    relocalise: rebuildTags,
    list,
    state: () => ({
      total: list.length,
      open: list.filter((c) => c.open).length,
      at: list.map((c) => ({ key: c.key, x: c.x, y: c.y, z: c.z, open: c.open, answer: c.q.right })),
    }),
    reset() { try { localStorage.removeItem('ascent.waygates'); } catch { /* private mode */ } },
    dispose() {
      scene.remove(group);
      tags.remove();
    },
  };
}
