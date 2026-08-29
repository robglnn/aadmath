import * as THREE from 'three';
import { heightAt, ISLAND_R } from './world.js';
import { tex } from '../ui/tex.js';
import { t } from '../i18n/index.js';
import { CELL } from '../build/pieces.js';
import { merge } from './geom.js';
import './field.css';

/**
 * THE HANGING CACHES — the balance beam, taken out of the rift and hung in the
 * sky as the lock on a door.
 *
 * The one genuinely good idea this game already had was that a beam set beside a
 * rift becomes a balance: two pans, real tiles, dead level, captioned WHATEVER
 * YOU DO TO ONE SIDE, DO TO THE OTHER. It was a demonstration. Nobody had to do
 * anything with it.
 *
 * A cache is that same apparatus turned into a verb. Five of them hang in the
 * air off the island's coast, each one a stone perch you can stand on, a sealed
 * monolith, and a balance holding a true statement with one weight missing:
 *
 *      a·x + b  =  c
 *
 * Three counterweights float beside it. **Walking into one loads it.** The pans
 * then carry out the arithmetic in front of you — the unknown tiles are replaced
 * by that many unit tiles, one for one — and the beam does what a beam does. Get
 * it wrong and the heavy side slams down and that weight is spent; you can see,
 * physically, which way it was wrong and by how much. Get it right and it holds
 * level, the monolith opens, and the cache pays.
 *
 * There is no keypad, no multiple-choice card and no sentence of instruction in
 * any of that. The mathematics is something you do with your feet.
 *
 * WHAT IT PAYS, AND WHY IT IS WORTH THE CLIMB
 *   · 120 shards — five minutes of very good running, in one find, and the
 *     single largest payment in the game. It used to pay 45 while a minute of
 *     jogging on the spot paid 143, which is a game telling you not to bother
 *     leaving the meadow;
 *   · and a permanent updraft, planted at the perch — worth another 90 on its
 *     own, since that is what one costs to plant by hand. The hard place you
 *     reached once becomes a launch pad for ever, and the next cache out is
 *     reachable because you cracked this one. The world is different because
 *     you played.
 *
 * WHERE IT READS FROM
 *   The statement and the weights used to sit in different frames: from the
 *   perch the equation was seven metres overhead and off-screen, and from far
 *   enough back to read it the weights were chips. The label now *descends* as
 *   you close on the perch, so that the thing you read and the thing you walk
 *   into are the same frame at every distance you can act from.
 *
 * The perches are real collision — they are registered with the same solid
 * registry the build lattice uses, so a cadet stands on one exactly the way he
 * stands on a floor he set himself, and can build off it. They are flagged
 * `fixed` so that they cannot be cleared out from under him.
 *
 * ---------------------------------------------------------------------------
 * THE SECOND TIER — what a cache says on the fifth day.
 *
 * Five caches is five caches. A cadet who keeps coming back cracks the last one
 * somewhere in the second sitting, and from then on the best idea in the game
 * is a row of opened boxes. A critic put it exactly: *"by then I would hold all
 * six grants, shards would be confetti, and the island would still be scenery
 * with pickups on it."*
 *
 * So the apparatus is now a **kind of thing**, not five things. `hang()` builds
 * one anywhere, and `src/world/warden.js` calls it: bind a warden and it falls
 * out of the sky as a DEEP CACHE, on the spot where you caught it, for ever.
 * The island grows a new hard place every day you come back.
 *
 * A deep cache is the same apparatus with one part added, and that one part is
 * the whole of Algebra I Level 2's first hard idea:
 *
 *      a·x + b  =  c·x + d      — **there are unknown tiles on BOTH pans.**
 *
 * Everything the first tier taught still reads. The pans still carry out the
 * arithmetic in front of you, the beam still slams the heavy way, and you still
 * do it with your feet. The only new thing to see is that taking tiles off one
 * side now takes them off the other as well — which is the sentence the whole
 * unit is about, made physical, with no lecture attached.
 *
 * Four weights instead of three, because there is one more mistake available:
 * collecting the unknowns on the wrong side, adding when the sign says
 * subtract, and forgetting to divide at the end.
 */

const COUNT = 5;
/** Every tile of every cache near enough to read. 640 covers eight at once. */
const TILE_MAX = 640;
/** Past this, a cache is a silhouette and its pans are not laid out at all. */
const TILE_RANGE = 170;
const REWARD = 120;
/** What a cache the cadet put there himself pays. Ground income; see ledger. */
const DEEP_REWARD = 160;
/** How many deep caches the island will carry. Twelve is twelve days. */
const DEEP_MAX = 12;
/** No two perches closer than this, or two hard places become one. */
const DEEP_CLEAR = 46;
const TOUCH = 2.2;
const SPAN = 2;                 // perch half-width, in lattice cells (2 -> 20 m across)

/**
 * How high each perch hangs, relative to the highest ground on its own bearing.
 *
 * This is the access ladder, and it is deliberately tied to the kit:
 *   -16, -9   glide out from the ridge and you are there — no unlock needed;
 *    +3       above every hill on that line: a vault plate, or a column;
 *   +17, +34  only with the wing trimmed, a flare lit, or an updraft you
 *             earned from a cache further down the ladder.
 */
const LIFT = [-16, -9, 3, 17, 34];

export function createCaches(opts = {}) {
  const {
    scene, uiRoot, player, builder, hud, wallet, drift, audio, fx,
    isBusy = () => false,
  } = opts;

  const group = new THREE.Group();
  group.name = 'caches';
  scene.add(group);

  const tags = document.createElement('div');
  tags.className = 'field-tags';
  (uiRoot || document.body).appendChild(tags);

  // ------------------------------------------------------------- materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x9aa6b4, roughness: 0.92, metalness: 0.05, flatShading: true,
  });
  const rigMat = new THREE.MeshStandardMaterial({
    color: 0xcfe9f7, emissive: 0x2c7fa6, emissiveIntensity: 0.8,
    roughness: 0.36, metalness: 0.42,
  });
  // The sealed monolith: pale enough to read as stone-and-alloy in a low sun
  // rather than as a black hole punched in the frame.
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x7d8ba3, emissive: 0x1a2534, emissiveIntensity: 0.6,
    roughness: 0.62, metalness: 0.24, flatShading: true,
  });
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, fog: false });

  /**
   * A deep cache is the same apparatus in a warmer alloy. One glance says which
   * tier is hanging there, from far enough out to decide whether to fly at it:
   * cold blue is the island's own, amber is one you made.
   */
  const deepRigMat = new THREE.MeshStandardMaterial({
    color: 0xffe3bd, emissive: 0xb46a1c, emissiveIntensity: 0.9,
    roughness: 0.34, metalness: 0.46,
  });
  const deepBoxMat = new THREE.MeshStandardMaterial({
    color: 0x9a7f63, emissive: 0x33220e, emissiveIntensity: 0.7,
    roughness: 0.58, metalness: 0.3, flatShading: true,
  });

  const tileGeo = new THREE.BoxGeometry(1, 1, 1);
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x14203a, emissiveIntensity: 0.7,
    roughness: 0.4, metalness: 0.06,
  });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, TILE_MAX);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tiles.frustumCulled = false;
  tiles.castShadow = true;
  tiles.count = 0;
  tiles.userData.noCamBlock = true;
  group.add(tiles);

  const list = [];
  const saved = load();
  /** Deep caches the cadet made himself. Position, seed and whether it is open. */
  const deep = Array.isArray(saved.deep) ? saved.deep : [];

  for (let i = 0; i < COUNT; i++) make(siteFor(i));
  for (const d of deep) make({ ...d, tier: 2 });

  /** Where the fifth of the island's own caches hangs. Fixed, for ever. */
  function siteFor(i) {
    const ang = -Math.PI / 2 + i * 2.3999632 + 0.4;
    // the highest ground on this bearing — what the perch is measured against
    let hi = 6;
    for (let r = 24; r < ISLAND_R - 8; r += 6) {
      const h = heightAt(Math.cos(ang) * r, Math.sin(ang) * r);
      if (h !== null && h > hi) hi = h;
    }
    const rad = ISLAND_R + 22 + i * 7;
    // snapped to the build lattice, because the perch *is* build lattice
    return {
      key: String(i), tier: 1, seed: i, ang,
      x: Math.round((Math.cos(ang) * rad) / CELL) * CELL,
      z: Math.round((Math.sin(ang) * rad) / CELL) * CELL,
      y: Math.max(18, hi + LIFT[i]),
    };
  }

  // ------------------------------------------------------------------ build
  function make(spec) {
    const { x: cx, z: cz, y: top, tier = 1 } = spec;
    const ang = spec.ang != null ? spec.ang : Math.atan2(cz, cx);
    const slot = list.length;

    const c = {
      i: slot, slot, key: spec.key, tier, seed: spec.seed ?? slot,
      x: cx, z: cz, y: top, opened: !!(saved.opened && saved.opened[spec.key]),
      group: new THREE.Group(), roll: 0, rollV: 0, want: 0,
      load: [], stones: [], settle: 0,
    };
    c.group.position.set(cx, top, cz);
    c.group.rotation.y = ang + Math.PI / 2;
    group.add(c.group);

    // ---- the perch: a shard of the island, torn loose and left hanging, with
    // nine cells of real floor laid across the top of it
    // deck and keel are one rigid rock: one draw call, in the main pass and in
    // the shadow pass alike
    const deckGeo = new THREE.CylinderGeometry(13.2, 11.2, 2.4, 9);
    deckGeo.translate(0, -1.3, 0);
    const keelGeo = new THREE.CylinderGeometry(11.2, 0.8, 16, 9, 1);
    keelGeo.rotateY(0.35);
    keelGeo.translate(0, -10.5, 0);
    const rock = new THREE.Mesh(merge([deckGeo, keelGeo]), stoneMat);
    deckGeo.dispose(); keelGeo.dispose();
    rock.castShadow = true;
    rock.receiveShadow = true;
    c.group.add(rock);
    for (let gx = -SPAN; gx <= SPAN; gx++) {
      for (let gz = -SPAN; gz <= SPAN; gz++) {
        builder.solids.add({
          kind: 'floor', x: cx + gx * CELL, y: top, z: cz + gz * CELL, yaw: 0,
          base: top, onGround: false, dead: false, fixed: true, grow: 1, fade: 0,
          sel: 0, want: 0, tone: 0, id: -1 - (slot * 64 + (gx + SPAN) * 8 + (gz + SPAN)),
        });
      }
    }

    // ---- the monolith the balance is the lock on
    const alloy = tier === 2 ? deepRigMat : rigMat;
    const shell = tier === 2 ? deepBoxMat : boxMat;
    const bodyGeo = new THREE.BoxGeometry(1.6, 3.2, 1.7);
    const seamGeo = new THREE.BoxGeometry(0.09, 2.8, 1.76);
    c.half = [];
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(bodyGeo, shell.clone());
      h.position.set(s * 0.83, 1.7, -7.6);
      h.castShadow = true;
      h.receiveShadow = true;
      const seam = new THREE.Mesh(seamGeo, seamMat);
      seam.position.set(-s * 0.79, 0, 0);
      h.add(seam);
      c.group.add(h);
      c.half.push(h);
    }
    const heartMat = new THREE.MeshBasicMaterial({
      color: 0xffd08a, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    c.heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), heartMat);
    c.heart.position.set(0, 1.8, -7.6);
    c.heart.userData.noCamBlock = true;
    c.group.add(c.heart);

    // ---- the mark that says there is something out here at all
    c.markMat = new THREE.MeshBasicMaterial({
      color: tier === 2 ? 0xffb057 : 0xffc98a,
      transparent: true, opacity: 0.3, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    // It starts above the apparatus, not through it: a mark you can see from
    // the far coast must not be a fog bank standing on the thing you came for.
    const shaftGeo = new THREE.CylinderGeometry(0.85, 1.7, 120, 8, 1, true);
    shaftGeo.translate(0, 68, 0);
    c.mark = new THREE.Mesh(shaftGeo, c.markMat);
    c.mark.userData.noCamBlock = true;
    c.mark.renderOrder = 2;
    c.group.add(c.mark);

    // ---- the balance
    const beam = new THREE.Group();
    beam.position.set(0, 5.4, -1.4);
    c.group.add(beam);
    c.beam = beam;

    // The whole balance — arm, risers and both pans — is rigid about the pivot,
    // so it is one geometry and one draw rather than five.
    const rigParts = [new THREE.BoxGeometry(7.0, 0.30, 0.42)];
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.62, 5.3, 4), alloy);
    post.position.set(0, 2.65, -1.4);
    c.group.add(post);

    for (const side of [-1, 1]) {
      const hang = new THREE.CylinderGeometry(0.045, 0.045, 1.5, 6);
      hang.translate(side * 2.8, -0.82, 0);
      rigParts.push(hang);
      const pan = new THREE.CylinderGeometry(1.24, 1.12, 0.12, 20);
      pan.translate(side * 2.8, -1.6, 0);
      rigParts.push(pan);
    }
    const rig = new THREE.Mesh(merge(rigParts), alloy);
    for (const g of rigParts) g.dispose();
    rig.castShadow = true;
    beam.add(rig);

    // ---- the statement, and the weights: three on the island's own caches,
    // four on a deep one, because a second unknown adds a fourth mistake
    const q = tier === 2 ? deepQuestion(c.seed) : question(c.seed);
    c.q = q;
    layout(c, null);

    // Four weights on one rank is nine metres of counterweights, which is wider
    // than the deck. They spread to the width they need and no wider.
    // ---- HOW FAR APART TWO ANSWERS HAVE TO STAND -------------------------
    //
    // POSITION IS THE ONLY INPUT HERE, AND POSITION IS A COMMITMENT YOU CANNOT
    // TAKE BACK. `design/ARCHIPELAGO-PATTERN.md` measured what that costs at
    // these spacings, twice, by walking it: `TOUCH = 2.2 m` is a 3-D radius
    // from the boots to a stone that hovers at 1.46-1.94 m, so the HORIZONTAL
    // capture disc is 1.04-1.65 m wide as the stone bobs. At 3.6 m the three
    // discs just miss each other (2 x 1.65 = 3.3), and crossing the deck from
    // one weight toward another still passed within 1.0-1.7 m of the middle one
    // and committed an answer the player never chose. On a deep cache at 2.9 m
    // THE DISCS OVERLAP by up to 0.4 m, and which of two overlapping answers
    // fires depends on the phase of the bob and on array order.
    //
    // So the rank is now wider than twice the worst capture disc, with a
    // margin: 4.4 m for three weights, 4.0 m for the four a deep cache carries
    // — 12 m of rank on a 20 m deck, which fits with room to walk round.
    const gap = q.choices.length > 3 ? 4.0 : 4.4;
    const mid = (q.choices.length - 1) / 2;
    for (let k = 0; k < q.choices.length; k++) {
      const v = q.choices[k];
      const s = new THREE.Group();
      s.position.set((k - mid) * gap, 1.7, 2.8);
      // A counterweight has to read as a thing you can walk into from as far
      // out as the statement reads. At 0.62 it was a chip at twenty metres.
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.92, 0), new THREE.MeshStandardMaterial({
        color: 0xe6dcff, emissive: 0x7a5bff, emissiveIntensity: 2.0,
        roughness: 0.24, metalness: 0.2,
      }));
      s.add(body);
      const halo = new THREE.Mesh(new THREE.OctahedronGeometry(1.55, 0), new THREE.MeshBasicMaterial({
        color: 0x9a7bff, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      halo.userData.noCamBlock = true;
      s.add(halo);
      c.group.add(s);
      c.stones.push({ v, group: s, body, halo, spent: false, ph: k * 1.7 });
    }

    // Two anchors each, and the label rides between them: high over the rig
    // when you are still flying at it, and down on the weights by the time you
    // are standing on the deck. The read-band and the act-band are the same
    // band at every distance a cadet can actually do something from.
    c.tags = [
      { local: [0, 8.2, -1.4], near: [0, 4.2, 2.8], cls: 'lede', key: 'field.balanceLock' },
      { local: [0, 7.3, -1.4], near: [0, 3.4, 2.8], cls: 'big', tex: q.latex },
    ];
    for (let k = 0; k < c.stones.length; k++) {
      c.tags.push({ local: [(k - mid) * gap, 2.45, 2.8], cls: 'weight', tex: String(c.stones[k].v), stone: k });
    }

    if (c.opened) openNow(c, true);
    list.push(c);
  }

  // --------------------------------------------------------------- the maths
  /**
   * A true statement with one weight missing, small enough to lay out as
   * physical tiles, and two wrong answers that are the two mistakes a learner
   * actually makes here: dividing before undoing the addition, and undoing the
   * addition and then forgetting to divide.
   */
  function question(seed) {
    const rnd = dice(seed);
    for (let tries = 0; tries < 40; tries++) {
      const a = 2 + rnd(3);           // 2..4
      const x = 2 + rnd(6);           // 2..7
      const b = 1 + rnd(8);           // 1..8
      const c = a * x + b;
      if (c > 30) continue;
      const wrongA = c - b;                       // never divided
      const wrongB = Math.round(c / a);           // never subtracted
      const set = uniq([x, wrongA, wrongB]);
      if (set.length < 3) continue;
      return {
        a, b, rc: 0, rd: c, x,
        choices: shuffle(set, rnd),
        latex: `${a}x + ${b} = ${c}`,
      };
    }
    return { a: 2, b: 3, rc: 0, rd: 11, x: 4, choices: [4, 8, 6], latex: '2x + 3 = 11' };
  }

  /**
   * THE SECOND TIER: unknown tiles on both pans.
   *
   *      a·x + b  =  c·x + d,   a > c,   x whole and small enough to lay out
   *
   * The three wrong weights are the three mistakes this step actually produces:
   * adding the constants when the sign says subtract, adding the unknowns when
   * the sign says subtract, and doing both steps right and then not dividing.
   */
  function deepQuestion(seed) {
    const rnd = dice(seed ^ 0x5bf03635);
    for (let tries = 0; tries < 80; tries++) {
      const rc = 1 + rnd(3);              // 1..3 unknown tiles on the right
      const a = rc + 1 + rnd(3);          // strictly more on the left
      const x = 2 + rnd(6);               // 2..7
      const b = 1 + rnd(9);               // 1..9
      const d = (a - rc) * x + b;         // keeps the statement true
      if (d < 1 || d > 34) continue;
      if (a * x + b > 34) continue;
      const wrongSign = (d + b) % (a - rc) === 0 ? (d + b) / (a - rc) : -1;
      const wrongSide = (d - b) % (a + rc) === 0 ? (d - b) / (a + rc) : -1;
      const wrongDiv = d - b;
      const set = uniq([x, wrongSign, wrongSide, wrongDiv]);
      if (set.length < 4) continue;
      return {
        a, b, rc, rd: d, x,
        choices: shuffle(set, rnd),
        latex: `${a}x + ${b} = ${rc === 1 ? '' : rc}x + ${d}`,
      };
    }
    return {
      a: 5, b: 2, rc: 2, rd: 11, x: 3, choices: [3, 5, 9, 1],
      latex: '5x + 2 = 2x + 11',
    };
  }

  /** A small seeded die, so a cache asks the same question for ever. */
  function dice(seed) {
    let h = 0x9e3779b9 ^ ((seed | 0) * 2654435761);
    return (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 8) % n); };
  }

  /** Whole, positive, small enough to lay out as tiles, and no repeats. */
  function uniq(vs) {
    return vs.filter((v, k, arr) => v > 0 && v <= 34 && arr.indexOf(v) === k);
  }

  /** A fixed, seeded order, so the answer is not always in the same place. */
  function shuffle(set, rnd) {
    const out = set.slice();
    for (let k = out.length - 1; k > 0; k--) {
      const j = rnd(k + 1);
      const tmp = out[k]; out[k] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /**
   * Lay the pans out. With no weight loaded each pan carries its own unknown
   * tiles and its own units; once a weight is chosen every unknown tile becomes
   * that many units, one for one, on BOTH pans — which is the whole argument
   * made physical, and the only new thing a deep cache has to say.
   */
  function layout(c, v) {
    const { a, b, rc, rd } = c.q;
    c.load.length = 0;
    if (v === null) {
      lay(c.load, -2.8, -1.5, a, 'x');
      lay(c.load, -2.8, -1.5, b, 'unit', a);
      if (rc) lay(c.load, 2.8, -1.5, rc, 'x');
      lay(c.load, 2.8, -1.5, rd, 'unit', rc);
    } else {
      lay(c.load, -2.8, -1.5, a * v + b, 'unit');
      lay(c.load, 2.8, -1.5, rc * v + rd, 'unit');
    }
    c.left = v === null ? null : a * v + b;
    c.right = v === null ? null : rc * v + rd;
  }

  function lay(out, px, py, count, kind, skipRows = 0) {
    const size = kind === 'x' ? 0.66 : 0.34;
    const cols = kind === 'x' ? 3 : 5;
    const n = Math.min(count, kind === 'x' ? 6 : 34);
    for (let k = 0; k < n; k++) {
      const col = k % cols, row = Math.floor(k / cols) + skipRows;
      out.push({
        kind,
        x: px + (col - (cols - 1) / 2) * size * 1.1,
        y: py + row * size * 1.06 + (kind === 'x' ? 0.34 : 0.18),
        z: kind === 'x' ? -0.34 : 0.32,
      });
    }
  }

  // ------------------------------------------------------------- the verdict
  function choose(c, stone) {
    if (c.opened || stone.spent || c.settle > 0) return;
    layout(c, stone.v);
    c.settle = 1.1;
    const diff = c.left - c.right;
    if (diff === 0) {
      c.rollV = 0;
      c.want = 0;
      for (const s of c.stones) if (s !== stone) s.spent = true;
      stone.won = true;
      open(c);
    } else {
      // the heavy side goes down, and how far says how wrong
      c.want = Math.max(-0.46, Math.min(0.46, diff * 0.055));
      c.rollV += (c.want - c.roll) * 4;
      stone.spent = true;
      fx?.impact?.('bad');
      hud?.flash?.(t('field.balanceNo'), 'bad');
      // the beam swings back to waiting, and the statement is intact again
      setTimeout(() => { if (!c.opened) { c.want = 0; layout(c, null); } }, 1500);
      if (c.stones.every((s) => s.spent)) {
        setTimeout(() => {
          if (c.opened) return;
          for (const s of c.stones) s.spent = false;
          hud?.flash?.(t('field.balanceReset'), '');
          rebuildTags();
        }, 3200);
      }
    }
    rebuildTags();
  }

  function open(c) {
    // ---- THE RESOLUTION BEAT --------------------------------------------
    //
    // The site is open, and for the next four and a half seconds it still
    // LOOKS like the site: the level beam is holding the statement it has just
    // been made to satisfy, the winning weight is still on its plinth with a
    // green frame round it, and the two that were spent are still struck
    // through beside it. Only after that does the apparatus put itself away.
    // Everything about this cache teaches through what is on screen between
    // committing and being told; throwing the screen away at the exact instant
    // the answer lands is the one moment where that stops being true.
    c.showWon = true;
    openNow(c, false);
    c.opened = true;
    setTimeout(() => {
      c.showWon = false;
      c.mark.visible = false;
      for (const st of c.stones) st.group.visible = false;
      rebuildTags();
    }, 4500);
    save();
    // What the wallet actually took, which is the sticker price until the day's
    // assay runs thin (src/kit/ledger.js). The caption prints the paid number,
    // never the sticker price: the ledger strip is right beside it.
    const sticker = c.tier === 2 ? DEEP_REWARD : REWARD;
    const paid = wallet?.earn?.(sticker, c.tier === 2 ? 'deepcache' : 'cache') ?? sticker;
    // ---- THE REWARD, PLANTED BESIDE THE MOMENT AND NOT ON TOP OF IT -------
    //
    // The reward that changes the map: a standing updraft, here, for ever.
    // `design/ARCHIPELAGO-PATTERN.md` measured what it used to do, in two
    // independent runs: planted at `(c.x, c.z)` — under the cadet's own boots —
    // it picked him up within a second or two of the win and carried him back
    // over the island before he could look at the level beam. *The resolution
    // beat of the best mechanic in the game was being cut off by its own
    // payment.*
    //
    // Two things fix it and both are the rule's own words — "plant the reward
    // with a delay, or offset, or a lead-in the player triggers". It is planted
    // 11 m out along the bearing back toward the island, so it stands BESIDE
    // the deck rather than through it — a launch pad you step into when you
    // choose — and it is planted four and a half seconds late, which is long
    // enough to watch the pans hold and the monolith open.
    const back = Math.hypot(c.x, c.z) || 1;
    const ux = -c.x / back, uz = -c.z / back;
    setTimeout(() => {
      drift?.addColumn?.(c.x + ux * 11, c.z + uz * 11,
        c.tier === 2 ? 96 : 78, c.tier === 2 ? 9.2 : 8.4, true);
    }, 4500);
    audio?.unlocked?.();
    fx?.impact?.('good');
    hud?.flash?.(t(c.tier === 2 ? 'field.deepOpen' : 'field.cacheOpen', { n: paid }), 'good');
  }

  function openNow(c, silent) {
    c.opened = true;
    c.heart.material.opacity = 0.9;
    // an opened cache stops advertising itself; the updraft it planted is the
    // landmark now. `showWon` holds that off for the resolution beat above —
    // a cache restored from a save has no beat to hold and puts itself away at
    // once, which is what `silent` already meant.
    if (!c.showWon) {
      c.mark.visible = false;
      for (const s of c.stones) s.group.visible = false;
    }
    if (silent) { c.roll = 0; c.want = 0; }
  }

  // -------------------------------------------------------------------- tags
  let sight = false;
  function rebuildTags() {
    tags.innerHTML = '';
    const nodes = [];
    for (const c of list) {
      if (c.opened && !c.showWon) continue;
      for (const tag of c.tags) {
        const el = document.createElement('div');
        const stone = tag.stone != null ? c.stones[tag.stone] : null;
        // `won` as well as `spent`. Both files set `stone.won` on the weight
        // that made the statement true and neither ever wrote the class, so
        // `.field-tag.won` in src/world/field.css was a rule that could not
        // fire and the right answer was the only one on the rank with no
        // frame at all. (design/ARCHIPELAGO-PATTERN.md §7g)
        const mark = stone && (stone.won ? ' won' : (stone.spent ? ' spent' : ''));
        el.className = `field-tag ${tag.cls}${mark || ''}`.trim();
        if (tag.tex) el.innerHTML = tex(tag.tex);
        else el.textContent = t(tag.key);
        tags.appendChild(el);
        nodes.push({ el, c, local: tag.local, near: tag.near || tag.local, stone });
      }
    }
    tagNodes = nodes;
  }
  let tagNodes = [];
  rebuildTags();

  const _v = new THREE.Vector3();
  const _c = new THREE.Vector3();
  /** How far the label has come down to meet you: 0 far out, 1 on the deck. */
  const DESCEND_FAR = 52, DESCEND_NEAR = 24;
  function placeTags(camera) {
    if (!tagNodes.length) return;
    const w = window.innerWidth, h = window.innerHeight;
    for (const c of list) {
      _c.setFromMatrixPosition(c.group.matrixWorld);
      const dc = _c.distanceTo(camera.position);
      c.descend = Math.max(0, Math.min(1, (DESCEND_FAR - dc) / (DESCEND_FAR - DESCEND_NEAR)));
    }
    for (const nd of tagNodes) {
      const k = nd.c.descend || 0;
      _v.set(
        nd.local[0] + (nd.near[0] - nd.local[0]) * k,
        nd.local[1] + (nd.near[1] - nd.local[1]) * k,
        nd.local[2] + (nd.near[2] - nd.local[2]) * k,
      ).applyMatrix4(nd.c.group.matrixWorld);
      const d = _v.distanceTo(camera.position);
      _v.project(camera);
      const reach = sight ? 140 : 74;
      const on = _v.z < 1 && d < reach && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
      if (!on) { if (nd.el.style.display !== 'none') nd.el.style.display = 'none'; continue; }
      nd.el.style.display = '';
      nd.el.style.left = `${(_v.x * 0.5 + 0.5) * w}px`;
      nd.el.style.top = `${(-_v.y * 0.5 + 0.5) * h}px`;
      nd.el.style.opacity = String(Math.max(0.12, 1 - Math.max(0, d - reach * 0.55) / (reach * 0.45)));
    }
  }

  // ------------------------------------------------------------------- frame
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q2 = new THREE.Quaternion();
  const _s = new THREE.Vector3();

  function update(dt, time, camera) {
    const busy = isBusy();
    let n = 0;
    for (const c of list) {
      c.settle = Math.max(0, c.settle - dt);
      // a balance settles toward what it is holding: level when the sides are
      // equal, hard over when they are not
      c.rollV += (c.want - c.roll) * 30 * dt;
      c.rollV *= Math.exp(-6 * dt);
      c.roll += c.rollV * dt;
      c.beam.rotation.z = c.roll;

      if (c.opened) {
        c.half[0].position.x = THREE.MathUtils.damp(c.half[0].position.x, -2.1, 3, dt);
        c.half[1].position.x = THREE.MathUtils.damp(c.half[1].position.x, 2.1, 3, dt);
        c.heart.rotation.y = time * 0.7;
        c.heart.position.y = 1.8 + Math.sin(time * 1.1) * 0.18;
        // …AND THE PANS STAY UP FOR THE RESOLUTION BEAT.
        //
        // `continue` here threw the substituted tiles off the beam on the very
        // frame the beam went level — so the one thing the win is a picture OF,
        // thirteen cubes against seven becoming seven against seven, was gone
        // before anybody could look at it. That is the same defect
        // `design/ARCHIPELAGO-PATTERN.md` measured on the updraft, arriving
        // from the other side: the payment cutting off the moment it pays for.
        // While `showWon` holds, this frame falls through and the pans are laid
        // exactly as they were.
        if (!c.showWon) continue;
      }

      if (!c.opened) c.markMat.opacity = 0.20 + 0.08 * Math.sin(time * 1.3 + c.i);
      for (const s of c.stones) {
        s.group.position.y = 1.7 + Math.sin(time * 1.2 + s.ph) * 0.24;
        s.body.rotation.y = time * 0.8 + s.ph;
        s.body.rotation.x = time * 0.4;
        s.body.material.emissiveIntensity = s.spent ? 0.25 : 2.0;
        s.body.material.color.setHex(s.spent ? 0x6b7385 : 0xe6dcff);
        s.halo.material.opacity = s.spent ? 0.04 : 0.13 + 0.05 * Math.sin(time * 2 + s.ph);
        if (busy || s.spent) continue;
        s.group.getWorldPosition(_p);
        if (_p.distanceTo(player.pos) < TOUCH) choose(c, s);
      }

      // tiles. A cache the cadet cannot read is a silhouette: past TILE_RANGE
      // its pans are not composed at all, so the island may carry a dozen of
      // these without the instanced buffer or the frame paying for them.
      if (camera && camera.position.distanceTo(c.group.position) > TILE_RANGE) continue;
      c.group.updateMatrixWorld(true);
      c.beam.updateMatrixWorld(true);
      for (const tl of c.load) {
        if (n >= TILE_MAX) break;
        const sz = tl.kind === 'x' ? 0.62 : 0.32;
        _p.set(tl.x, tl.y, tl.z).applyMatrix4(c.beam.matrixWorld);
        _q2.setFromRotationMatrix(c.beam.matrixWorld);
        _s.setScalar(sz);
        _m.compose(_p, _q2, _s);
        tiles.setMatrixAt(n, _m);
        tiles.setColorAt(n, tl.kind === 'x' ? XCOL : UCOL);
        n++;
      }
    }
    tiles.count = n;
    tiles.instanceMatrix.needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    if (camera) placeTags(camera);
  }

  // ------------------------------------------------------------------- hang
  /**
   * HANG A DEEP CACHE HERE, FOR EVER.
   *
   * Called by `src/world/warden.js` when a warden is bound: the construct falls
   * apart and this is what is left standing in the air where it fell. The perch
   * is real floor in the same solid registry the build lattice uses, so it is a
   * place before it is a puzzle — somewhere to land, build from, and fly on.
   *
   * @param {number} x
   * @param {number} z
   * @param {number} y  where it should hang; clamped to somewhere reachable
   * @param {number} seed  what statement it holds, for ever
   * @returns {object|null} the cache, or null if the island will carry no more
   */
  function hang(x, z, y, seed) {
    if (deep.length >= DEEP_MAX) return null;
    // Two hard places on top of each other is one hard place. Push the new one
    // out along its own bearing until it stands clear of every other perch.
    let px = Math.round(x / CELL) * CELL;
    let pz = Math.round(z / CELL) * CELL;
    for (let guard = 0; guard < 24; guard++) {
      const near = list.find((c) => Math.hypot(c.x - px, c.z - pz) < DEEP_CLEAR);
      if (!near) break;
      const k = Math.max(0.001, Math.hypot(px, pz));
      px = Math.round((px + (px / k) * DEEP_CLEAR) / CELL) * CELL;
      pz = Math.round((pz + (pz / k) * DEEP_CLEAR) / CELL) * CELL;
    }
    // …and never past the point where the leash would stop a cadet flying at it.
    const out = Math.hypot(px, pz);
    if (out > ISLAND_R * 1.4) {
      px = Math.round(((px / out) * ISLAND_R * 1.4) / CELL) * CELL;
      pz = Math.round(((pz / out) * ISLAND_R * 1.4) / CELL) * CELL;
    }
    // The perch is a torn shard of island with a sixteen-metre keel under it, so
    // it has to hang clear of the hill it is over or the keel grows out of the
    // grass and it reads as scenery rather than as somewhere you have to reach.
    const ground = heightAt(px, pz);
    const floor = (ground === null ? 8 : ground) + 24;
    const spec = {
      key: `d${seed}`, tier: 2, seed: seed | 0,
      x: px, z: pz, y: Math.max(floor, Math.round(y || 0)),
      ang: Math.atan2(pz, px),
    };
    deep.push({ key: spec.key, seed: spec.seed, x: spec.x, y: spec.y, z: spec.z, ang: spec.ang });
    make(spec);
    save();
    rebuildTags();
    return list[list.length - 1];
  }

  // -------------------------------------------------------------------- save
  function load() {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem('ascent.caches') || '{}') || {}; }
    catch { return { opened: {}, deep: [] }; }
    // A save written before deep caches existed is a bare map of open indices.
    if (!raw.opened && !raw.deep) return { opened: raw, deep: [] };
    return { opened: raw.opened || {}, deep: Array.isArray(raw.deep) ? raw.deep : [] };
  }
  function save() {
    const o = {};
    for (const c of list) if (c.opened) o[c.key] = 1;
    const payload = { opened: o, deep };
    try { localStorage.setItem('ascent.caches', JSON.stringify(payload)); } catch { /* private mode */ }
  }

  return {
    update,
    relocalise: rebuildTags,
    /** RESONANT SIGHT: read a cache's statement from twice as far out. */
    setSight(on) { sight = !!on; },
    list,
    hang,
    /** How many more the island will carry, so a warden knows what to pay. */
    room: () => Math.max(0, DEEP_MAX - deep.length),
    state: () => ({
      total: list.length,
      opened: list.filter((c) => c.opened).length,
      deep: deep.length,
      deepOpen: list.filter((c) => c.tier === 2 && c.opened).length,
      at: list.map((c) => ({
        i: c.i, tier: c.tier, x: c.x, y: c.y, z: c.z, opened: c.opened,
      })),
    }),
    reset() {
      try { localStorage.removeItem('ascent.caches'); } catch { /* private mode */ }
    },
  };
}

const XCOL = new THREE.Color(0xb489ff);
const UCOL = new THREE.Color(0x74e2ff);
