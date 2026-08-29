import * as THREE from 'three';
import { heightAt, ISLAND_R } from './world.js';
import { tex } from '../ui/tex.js';
import { t } from '../i18n/index.js';
import { CELL } from '../build/pieces.js';
import { merge } from './geom.js';
import { beginTagFrame, submitTag } from './tagspace.js';
import { bidField } from './fieldtalk.js';
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
const SPAN = 2;                 // perch half-width, in lattice cells (2 -> 20 m across)

/* ===========================================================================
 * HOW AN ANSWER IS GIVEN, AND WHY IT IS NO LONGER A DISC YOU CAN BRUSH PAST
 *
 * `design/ARCHIPELAGO-PATTERN.md` Rule 1 says position is the only input, and
 * then states the corollary that costs: *position is a commitment you cannot
 * take back, and the player must never be able to answer by walking past.*
 * This site failed that, reproduced twice by playing it: the three weights
 * stood on ONE RANK across the middle of the deck, `TOUCH = 2.2 m` was a 3-D
 * radius to a stone bobbing at 1.46-1.94 m, so the horizontal capture disc was
 * 1.04-1.65 m wide and CROSSING THE DECK committed an answer nobody chose —
 * and on a deep cache, at a 2.9 m gap, two discs overlapped.
 *
 * Widening the rank does not fix it and the first attempt at this proved it:
 * whatever the gap, a straight walk from the left weight to the right one goes
 * THROUGH THE MIDDLE ONE, because three points on a line always do. Nor is a
 * dwell allowed — Rule 1 forbids hovering, and `src/world/meet.js` records why
 * in full: making hesitation an answer and then charging for it is the exact
 * opposite of ADHD-aware.
 *
 * So the geometry changed instead, and it is `meet.js`'s own answer:
 *
 *   A CLAIM REGION IS A LATTICE CELL, AND YOU HAVE TO BE STANDING ON IT.
 *
 * Every counterweight now floats over the end of ITS OWN PIER — one `fixed`
 * floor cell jutting off the deck, with OPEN AIR between one pier and the
 * next. The commit region is that cell and nothing else: cells
 * tile the plane exactly, no two of them overlap at any radius, and there is no
 * spacing left to get wrong. Crossing the deck cannot answer, because the deck
 * is not a pier. Walking from one weight to another cannot answer either, since
 * there is no floor between two piers — you go back onto the deck, where no
 * claim region exists, and out again.
 *
 * The act is now what the mathematics is: you leave the rock and stand under
 * the weight you mean.
 *
 * `tools/critic/archipelago.mjs` rule `commit` re-derives this from the tables
 * below on every run — every pair of piers non-adjacent, every claim cell
 * inside its own pier, and no claim cell touching the deck.
 * ========================================================================= */
/**
 * The piers, in lattice cells of the perch's own frame, by how many weights
 * the statement carries. `+gz` is the deck's near side; the last cell of each
 * pier is the one the weight hangs over and the one the claim is made on.
 *
 * EVERY PIER IS ONE CELL, and that is a second thing found by walking it. The
 * first cut had a two-cell pier out front, so the middle weight stood sixteen
 * metres off the deck down a four-metre catwalk with a fifty-metre drop either
 * side — and the flight harness fell off it three times out of three. A site
 * whose answer is a tightrope is a site that costs a cadet the trip, which is
 * exactly what `design/ARCHIPELAGO-PATTERN.md` Rule 6 forbids. So the piers are
 * a single step off the deck's own edge, and the spread that keeps them apart
 * comes from the EDGE each one leaves by rather than from how far it reaches.
 *
 * AND THEY ALL LEAVE BY THE SAME EDGE, which is a third thing found by
 * walking it. Photographed standing on a corner pier: the cadet had committed,
 * the pans were doing the arithmetic — and the balance was forty degrees behind
 * his shoulder, because the camera follows the way he walked and he had walked
 * sideways. Rule 3 is about the interval between committing and being told, and
 * a verdict out of frame is not one. So the three piers of a tier-1 cache all
 * jut off the FRONT edge, eight metres apart with four metres of air between
 * them, and the balance hangs straight ahead of every one of them.
 *
 * A deep cache carries four and only three fit on that edge, so its outer pair
 * leaves by the flanks and sits about thirty-seven degrees off the rig. That is
 * a compromise and it is written down rather than hidden: the fifth-day object
 * pays it, and the one every learner meets does not.
 */
const PIERS = {
  3: [[[-2, 3]], [[0, 3]], [[2, 3]]],
  4: [[[-3, 2]], [[-1, 3]], [[1, 3]], [[3, 2]]],
};
/**
 * The most objects a pan may be asked to hold.
 *
 * Past about thirty a pan stops being countable and becomes a texture, and
 * `lay()` below caps the tiles it composes at exactly this — so a candidate
 * whose arithmetic goes over it would show a pan that is not what the pan is
 * worth. `question()` refuses those candidates rather than drawing them.
 */
const CAP = 34;
/** Boots this far below the deck, or this far above it, are still on it. */
const CLAIM_DOWN = 1.4, CLAIM_UP = 3.2;
/** How high a counterweight floats over the end of its own pier. */
const STONE_Y = 1.7;
/**
 * How far out the balance hangs, in the perch's own frame.
 *
 * Eighteen metres past the end of every pier, over open water, so that a cadet
 * walking out to a weight is walking TOWARD the thing that is about to answer
 * him. See the block in `make()`.
 *
 * The distance is set by the WIDEST pier and not by the nearest: the outer two
 * stand eight metres off the centre line, and a rig at 24 sat thirty-four
 * degrees off their approach — photographed, out of frame, with the pans doing
 * the arithmetic behind the cadet's shoulder. At 30 the worst approach is
 * twenty-two degrees off and nineteen up, which is inside the frame from all
 * three, and the pans are still nearer than the forty metres at which this
 * apparatus was measured legible.
 */
const RIG_Z = 30;

/* ===========================================================================
 * THE ACCESS LADDER — AND THE MEASUREMENT THAT SHOWED IT WAS IMAGINARY
 *
 * It used to read `LIFT = [-16, -9, 3, 17, 34]`, metres above THE HIGHEST
 * GROUND ON EACH SITE'S OWN BEARING, sampled straight off `heightAt`. Two
 * things are wrong with that datum and both of them were already written down
 * in this repo, by two other files, about themselves:
 *
 *   · `src/world/span.js`: the obvious launch on its first bearing climbs 27 m
 *     in 8 m of run, so *"the first span was hung off a launch pad no cadet
 *     could reach"*. `heightAt` answers for spires nobody can stand on.
 *   · `src/world/meet.js`: a ceiling computed as `launch - gulf / ratio` is a
 *     lie if the island is in the way. Flown at exactly that number, a cadet
 *     landed two hundred metres short, on the hill the ceiling was measured
 *     from.
 *
 * Recomputed here the way `meet.js` computes its own — flood-fill the ground a
 * cadet can WALK to from the spawn under the game's own slope rule, solve the
 * wing at each trim (`dv/dt = -g sin y - k v^2`, g = 26) for 1:7.7 base,
 * 1:18.2 KITE TRIM, 1:23.8 LONG SPAN, and require the descent line to clear
 * `heightAt` by three metres for the whole flight — the five decks stood at:
 *
 *   cache 0 (72,-176)   deck 120   base 68.6   kite 82.7   long span 85.4
 *   cache 1 (64,184)    deck  56   base 64.1   kite 78.5   long span 82.3
 *   cache 2 (-180,-96)  deck  78   base 76.1   kite 87.5   long span 88.5
 *   cache 3 (204,-52)   deck  85   base 70.7   kite 76.0   long span 76.9
 *   cache 4 (-120,184)  deck  92   base 62.8   kite 81.3   long span 84.5
 *
 * THREE OF THE FIVE STOOD ABOVE WHAT THE BEST WING IN THE GAME CAN REACH FROM
 * ANY LAUNCH A CADET CAN WALK TO — cache 0 by thirty-five metres. That is the
 * measured reason nobody has ever opened one: the objective card CAN name a
 * cache (`src/meta/objective.js` `FIELD_VERB`), it names the nearest one, and
 * from most tears the nearest one was a place the wing could not get to. The
 * leg ran out its clock over open water.
 *
 * So the decks are stated here as absolute heights with the ceiling they were
 * chosen against, and the ladder is denominated in a kit grant, as Rule 9
 * requires:
 *
 *   i  deck   reached by                                    margin in hand
 *   0    62   THE BASE WING, from a cleared save              6.6 m
 *   1    56   THE BASE WING, from a cleared save              8.1 m
 *   2    82   KITE TRIM (three held lines)                    5.5 m
 *   3    96   THE COLUMN CACHE 0 PAID — 140 m of standing    21.6 m
 *             air, then any wing at all
 *   4   104   THE COLUMN CACHE 1 PAID                         7.3 m (base)
 *
 * Two of them are day-one flights, one is bought with mathematics, and the two
 * furthest out are bought by CRACKING THE TWO NEAREST — which is the promise
 * this file's own header already made and could not keep: *"the next cache out
 * is reachable because you cracked this one."*
 *
 * Between KITE TRIM and LONG SPAN there is nothing to tier with at these
 * distances: over a 245 m gulf the two wings differ by 3.2 m, which is inside
 * the margin, so the top of the ladder is a column and not a trim. That is
 * stated rather than hidden — Rule 9's test is that the requirement is a
 * number in the same units as a kit grant, and "the updraft cache 1 pays" is
 * one.
 *
 * `tools/critic/archipelago.mjs` recomputes every number above from
 * `src/world/terrain.js`, `src/player/locomotion.js` and `src/kit/kit.js` on
 * every run, so this comment can be checked instead of believed.
 * ========================================================================= */
const DECK = [62, 56, 82, 96, 104];
/**
 * What each site's access is DENOMINATED IN, read by `src/kit/kit.js` when it
 * tells `src/meta/objective.js` what this cadet may be pointed at. `null` is
 * the wing every cadet has from boot; `'kite'` is a grant id from
 * `src/kit/ladder.js`; a number is the index of the cache whose standing column
 * is the way in, and until that one is open this one is not offered at all.
 *
 * An errand you cannot physically complete teaches the player that the marker
 * lies (`src/world/errand.js`). This is that rule, applied to the best object
 * in the game.
 */
const ACCESS = [null, null, 'kite', 0, 1];

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
    const rad = ISLAND_R + 22 + i * 7;
    // snapped to the build lattice, because the perch *is* build lattice
    return {
      key: String(i), tier: 1, seed: i, ang, access: ACCESS[i],
      x: Math.round((Math.cos(ang) * rad) / CELL) * CELL,
      z: Math.round((Math.sin(ang) * rad) / CELL) * CELL,
      y: DECK[i],
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
      access: spec.access !== undefined ? spec.access : 'kite',
      group: new THREE.Group(), roll: 0, rollV: 0, want: 0,
      load: [], stones: [], settle: 0,
    };
    c.group.position.set(cx, top, cz);
    /* A QUARTER TURN, AND IT FACES OUT TO SEA.
       The deck is 25 axis-aligned `floor` solids and the piers are more of the
       same, while everything you can see is a child of this group. At an
       arbitrary yaw those two frames disagree and there is half a cell of drift
       between the stone you can see and the cell you can stand on.
       `src/world/span.js` settled that already — *"the yaw is always a quarter
       turn, so this is exact and there is never a half-cell of drift between
       the hole you can see and the hole you can fall through"* — and a 5 x 5
       block maps onto itself under a quarter turn, so no deck moves.
       WHICH quarter turn is the second half, and it is not arbitrary either:
       local +z is laid as close to RADIALLY OUTWARD as a quarter turn allows,
       so the piers and the balance hang further out to sea and the cadet
       arrives on the island side and walks away from the island to answer.
       A balance hung over a hillside is a prop; `design/ARCHIPELAGO-PATTERN.md`
       5.3 — *"a silhouette against sky is a composable frame; a hillside is
       not"*. */
    c.turn = ((Math.round((Math.PI / 2 - ang) / (Math.PI / 2)) % 4) + 4) % 4;
    c.group.rotation.y = c.turn * (Math.PI / 2);
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
    // ---- the piers. Real floor, in the same registry, with air between them:
    // the whole of the commit rule is that you have to leave the deck.
    const piers = PIERS[tier === 2 ? 4 : 3];
    const pierParts = [];
    c.claims = [];
    for (let k = 0; k < piers.length; k++) {
      let end = null;
      for (let n = 0; n < piers[k].length; n++) {
        const [gx, gz] = piers[k][n];
        const w = toWorld(c, gx * CELL, gz * CELL);
        builder.solids.add({
          kind: 'floor', x: w.x, y: top, z: w.z, yaw: 0,
          base: top, onGround: false, dead: false, fixed: true, grow: 1, fade: 0,
          sel: 0, want: 0, tone: 0, id: -4096 - (slot * 64 + k * 8 + n),
        });
        const slab = new THREE.BoxGeometry(CELL - 0.24, 1.5, CELL - 0.24);
        slab.translate(gx * CELL, -0.75, gz * CELL);
        pierParts.push(slab);
        end = { gx, gz, w };
      }
      c.claims.push(end);
    }
    const pierMesh = new THREE.Mesh(merge(pierParts), stoneMat);
    for (const g of pierParts) g.dispose();
    pierMesh.castShadow = true;
    pierMesh.receiveShadow = true;
    c.group.add(pierMesh);

    // ---- the monolith the balance is the lock on
    const alloy = tier === 2 ? deepRigMat : rigMat;
    const shell = tier === 2 ? deepBoxMat : boxMat;
    const bodyGeo = new THREE.BoxGeometry(1.6, 3.2, 1.7);
    const seamGeo = new THREE.BoxGeometry(0.09, 2.8, 1.76);
    /* ---- WHERE THE APPARATUS STANDS, AND WHY IT IS OUT PAST THE PIERS ----
       The balance used to sit between the deck and the weights, which was right
       when the weights were a rank three metres from it. It is wrong now: a
       cadet walks OUT along a pier to commit, so anything behind him at that
       moment is a thing he does not see. `design/ARCHIPELAGO-PATTERN.md` Rule 3
       is exactly about that interval — *"between commitment and verdict there
       is a visible, held state… that interval is the only place the teaching
       can happen without text"* — and a verdict over your shoulder is not one.
       So the whole apparatus hangs on a mast at local z = 24, four to twelve
       metres BEYOND the end of every pier and out over open water. Land on the
       island side, read the statement and all three weights in one frame, walk
       out at the one you mean, and the pans do the arithmetic straight ahead of
       you with the monolith under them. */
    c.half = [];
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(bodyGeo, shell.clone());
      h.position.set(s * 0.83, 1.7, RIG_Z);
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
    c.heart.position.set(0, 1.8, RIG_Z);
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
    beam.position.set(0, 8.2, RIG_Z);
    c.group.add(beam);
    c.beam = beam;

    // The whole balance — arm, risers and both pans — is rigid about the pivot,
    // so it is one geometry and one draw rather than five.
    const rigParts = [new THREE.BoxGeometry(7.0, 0.30, 0.42)];
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.55, 5.0, 4), alloy);
    post.position.set(0, 5.7, RIG_Z);
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

    // ---- one weight, at the end of one pier ------------------------------
    // See PIERS at the top of the file. The claim is the pier's outer CELL and
    // the boots have to be on it, so the answer cannot be given by walking
    // across the deck and two answers cannot overlap at any radius.
    for (let k = 0; k < q.choices.length; k++) {
      const v = q.choices[k];
      const end = c.claims[k];
      const s = new THREE.Group();
      s.position.set(end.gx * CELL, STONE_Y, end.gz * CELL);
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
      c.stones.push({
        v, group: s, body, halo, spent: false, ph: k * 1.7,
        // The claim cell, in world metres, computed once: a quarter-turn yaw
        // makes the lattice and the scene graph the same frame.
        cx: end.w.x, cz: end.w.z,
      });
    }

    // Two anchors each, and the label rides between them: high over the rig
    // when you are still flying at it, and down on the weights by the time you
    // are standing on the deck. The read-band and the act-band are the same
    // band at every distance a cadet can actually do something from.
    /* Two anchors each, and the label rides between them on `descend`: high
       over the mast while you are still flying at it, down beside the pans by
       the time you are standing on the deck reading it. The read-band and the
       act-band are the same band at every distance a cadet can act from — and
       the act now happens fourteen metres nearer the label than it used to,
       because the weights come to the apparatus rather than sitting under it. */
    c.tags = [
      { local: [0, 12.4, RIG_Z], near: [0, 10.8, RIG_Z - 2], cls: 'lede', key: 'field.balanceLock', pri: 30 },
      { local: [0, 11.0, RIG_Z], near: [0, 9.4, RIG_Z - 2], cls: 'big', tex: q.latex, pri: 31 },
    ];
    for (let k = 0; k < c.stones.length; k++) {
      const end = c.claims[k];
      c.tags.push({
        local: [end.gx * CELL, STONE_Y + 0.75, end.gz * CELL],
        cls: 'weight', tex: String(c.stones[k].v), stone: k, pri: 32 + k,
      });
    }

    if (c.opened) openNow(c, true);
    list.push(c);
  }

  /**
   * A point in a perch's own frame, as an offset in world axes. The yaw is
   * always a quarter turn (see `make`), so this is exact — there is never a
   * half-cell between the stone you can see and the cell you can stand on.
   */
  function toWorld(c, lx, lz) {
    const sn = QSIN[c.turn], cs = QCOS[c.turn];
    return { x: c.x + lx * cs + lz * sn, z: c.z - lx * sn + lz * cs };
  }

  // --------------------------------------------------------------- the maths
  /**
   * A true statement with one weight missing, small enough to lay out as
   * physical tiles, and two wrong answers that are two named mistakes.
   *
   * ---- BOTH SIGNS, FROM THE FIRST ENCOUNTER ------------------------------
   *
   * `design/ARCHIPELAGO-PATTERN.md` Rule 4 says wrong must carry DIRECTION and
   * MAGNITUDE, and then names where this site failed its own rule: both of the
   * old distractors were arithmetically `>= x` — `c - b = a*x > x` for a >= 2,
   * and `round(c/a) = round(x + b/a) >= x` — so the left pan was ALWAYS the
   * heavy one and a tier-1 cache could only ever say TOO BIG. Half the channel
   * was dead until a learner reached a deep cache, which almost nobody does.
   * `src/world/warden.js` gets this right from the first encounter ("TOO SMALL
   * BY EIGHT") and `src/world/meet.js` refuses any pose whose residual does not
   * change sign under the player's boots.
   *
   * So the constant is a multiple of the coefficient — which makes `c / a`
   * exact, with no rounding anywhere — and the two weights beside the answer
   * are ONE ON EACH SIDE OF IT:
   *
   *   HIGH, and it is the canonical error: `c - b`, never divided (the pan is
   *        heavy by the whole coefficient you failed to remove, standing there
   *        as cubes you can count); or `c / a`, never subtracted, when the
   *        first one would put more on a pan than a pan can be counted at.
   *   LOW: `c / a - b` — divided FIRST and then took the whole constant off
   *        instead of a share of it. It is strictly under `x`, always
   *        (`x - b(a-1)/a`), so the RIGHT pan goes down and the beam falls the
   *        other way. Nothing else in this file had ever made it do that.
   *
   * Both pans of every candidate are held under the countability cap, because
   * Rule 2's whole claim is that a learner who cannot read the notation can
   * still count nine cubes against seven. A pan showing 34 when the arithmetic
   * says 66 is a picture that lies.
   */
  function question(seed) {
    const rnd = dice(seed);
    for (let tries = 0; tries < 80; tries++) {
      const a = 2 + rnd(3);           // 2..4
      const x = 2 + rnd(6);           // 2..7
      const b = (1 + rnd(4)) * a;     // a multiple of a, so c / a is exact
      const c = a * x + b;
      if (b > 12 || c > CAP) continue;
      const low = c / a - b;                        // undid it in the wrong order
      if (low < 1 || a * low + b > CAP) continue;
      const high = [c - b, c / a].find((v) => v > x && a * v + b <= CAP);
      if (high === undefined) continue;
      const set = uniq([x, high, low]);
      if (set.length < 3) continue;
      return {
        a, b, rc: 0, rd: c, x,
        choices: shuffle(set, rnd),
        latex: `${a}x + ${b} = ${c}`,
      };
    }
    return { a: 2, b: 4, rc: 0, rd: 14, x: 5, choices: [10, 5, 3], latex: '2x + 4 = 14' };
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
    for (let tries = 0; tries < 200; tries++) {
      const rc = 1 + rnd(3);              // 1..3 unknown tiles on the right
      const a = rc + 1 + rnd(3);          // strictly more on the left
      const x = 2 + rnd(6);               // 2..7
      const b = 1 + rnd(9);               // 1..9
      const d = (a - rc) * x + b;         // keeps the statement true
      if (d < 1 || d > CAP) continue;
      if (a * x + b > CAP) continue;
      const wrongSign = (d + b) % (a - rc) === 0 ? (d + b) / (a - rc) : -1;
      const wrongSide = (d - b) % (a + rc) === 0 ? (d - b) / (a + rc) : -1;
      const wrongDiv = d - b;
      const set = uniq([x, wrongSign, wrongSide, wrongDiv]);
      if (set.length < 4) continue;
      // …and every one of them leaves both pans countable. See CAP.
      if (set.some((v) => a * v + b > CAP || rc * v + d > CAP)) continue;
      return {
        a, b, rc, rd: d, x,
        choices: shuffle(set, rnd),
        latex: `${a}x + ${b} = ${rc === 1 ? '' : rc}x + ${d}`,
      };
    }
    /* The one every seed falls back to, and it is held to the same bars as the
       eighty it tried: true at x, four distinct positive weights, one of them
       UNDER the answer, and no pan over the countability cap (3v + 2 reaches
       26 and v + 10 reaches 18). The statement it used to carry — `5x + 2 =
       2x + 11` with the weight 9 — asks the left pan for 47 cubes and draws 34
       of them, which is a picture that lies. */
    return {
      a: 3, b: 2, rc: 1, rd: 10, x: 4, choices: [6, 4, 8, 2],
      latex: '3x + 2 = x + 10',
    };
  }

  /** A small seeded die, so a cache asks the same question for ever. */
  function dice(seed) {
    let h = 0x9e3779b9 ^ ((seed | 0) * 2654435761);
    return (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 8) % n); };
  }

  /** Whole, positive, small enough to lay out as tiles, and no repeats. */
  function uniq(vs) {
    return vs.filter((v, k, arr) => v > 0 && v <= CAP && arr.indexOf(v) === k);
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
    const n = Math.min(count, kind === 'x' ? 6 : CAP);
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
    // with a delay, or offset, or a lead-in the player triggers".
    //
    // It is planted four and a half seconds late, which is long enough to watch
    // the pans hold and the monolith open; and it is planted BEHIND THE
    // MONOLITH, sixteen metres out along the perch's own -z, which is the one
    // direction that carries no pier and therefore no claim cell. The first cut
    // of this offset was eleven metres along the bearing back toward the island
    // and that is not a fixed direction in the perch's frame at all: on some
    // bearings an 8.4 m column centred there still stood over half the deck. A
    // launch pad you step into when you choose has to be somewhere you are not
    // standing, and "somewhere" has to be a place and not an average.
    const back = toWorld(c, 0, -16);
    setTimeout(() => {
      drift?.addColumn?.(back.x, back.z,
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
        nodes.push({ el, c, local: tag.local, near: tag.near || tag.local, stone, pri: tag.pri || 34 });
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
  /**
   * ONE CACHE TALKS, AND IT ASKS FOR ITS ROOM LIKE EVERYTHING ELSE.
   *
   * `.field-tag` is CHROME to `src/world/tagspace.js` — a box every OTHER
   * layer walks around, arbitrated by nothing among itself — and this file
   * printed every unopened cache inside 74 m, or 140 m with RESONANT SIGHT,
   * against a `DEEP_CLEAR` of 46 m. Two perches inside each other's reach is
   * two statements and six or eight numerals on the glass at once, and the
   * comment on `TILE_MAX` ("640 covers eight at once") is the same admission
   * from the other side. `src/world/waygate.js` has already paid for exactly
   * this: 452 label overlaps across 126 of 288 layout frames, every one a
   * lintel printed through a HUD plate.
   *
   * Two rules, both of them `src/world/meet.js`'s:
   *   · only the NEAREST unopened cache says anything at all;
   *   · and its labels go through the one ledger, which claims room against
   *     Marlow's card, the objective plate and every other world label — and
   *     DROPS one rather than print it through another.
   */
  function placeTags(camera, time) {
    if (!tagNodes.length) return;
    beginTagFrame(time);
    const w = window.innerWidth, h = window.innerHeight;
    let near = null, nd0 = Infinity;
    for (const c of list) {
      _c.setFromMatrixPosition(c.group.matrixWorld);
      const dc = _c.distanceTo(camera.position);
      c.descend = Math.max(0, Math.min(1, (DESCEND_FAR - dc) / (DESCEND_FAR - DESCEND_NEAR)));
      if ((c.opened && !c.showWon) || dc >= nd0) continue;
      nd0 = dc; near = c;
    }
    const reach = sight ? 140 : 74;
    /* …AND ONE FAMILY TALKS, WHICH THE RULE ABOVE CANNOT DECIDE FROM IN HERE.
       Only the nearest unopened cache says anything — and a span and a meet
       are each saying the same thing about themselves in the same frame, out
       of two other files. Photographed: standing on cache 1's pier at the
       instant it opened, MEET 2's statement was on the glass beside the
       balance. See src/world/fieldtalk.js. */
    if (!bidField(time, 'cache', nd0)) {
      for (const nd of tagNodes) hideTag(nd);
      return;
    }
    for (const nd of tagNodes) {
      if (nd.c !== near) { hideTag(nd); continue; }
      const k = nd.c.descend || 0;
      _v.set(
        nd.local[0] + (nd.near[0] - nd.local[0]) * k,
        nd.local[1] + (nd.near[1] - nd.local[1]) * k,
        nd.local[2] + (nd.near[2] - nd.local[2]) * k,
      ).applyMatrix4(nd.c.group.matrixWorld);
      const d = _v.distanceTo(camera.position);
      _v.project(camera);
      const on = _v.z < 1 && d < reach && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
      if (!on) { hideTag(nd); continue; }
      nd.el.style.display = '';
      nd.el.style.opacity = String(Math.max(0.12, 1 - Math.max(0, d - reach * 0.55) / (reach * 0.45)));
      submitTag({
        measure: nd.el,
        x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h,
        gap: 6, dir: 'mid', pri: nd.pri, dist: d,
        place: (cx, top) => {
          nd.el.style.left = `${Math.round(cx)}px`;
          nd.el.style.top = `${Math.round(top)}px`;
          nd.el.style.transform = 'translate(-50%, 0)';
        },
        hide: () => hideTag(nd),
      });
    }
  }
  function hideTag(nd) {
    if (nd.el.style.display !== 'none') nd.el.style.display = 'none';
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
        /* THE CLAIM IS A CELL YOU ARE STANDING ON, not a sphere you brushed.
           See PIERS at the top of the file: crossing the deck cannot answer,
           because the deck is not a pier, and two claim cells cannot overlap
           at any radius, because cells tile the plane exactly. */
        const dy = player.pos.y - c.y;
        if (dy < -CLAIM_DOWN || dy > CLAIM_UP) continue;
        if (Math.abs(player.pos.x - s.cx) > CELL / 2) continue;
        if (Math.abs(player.pos.z - s.cz) > CELL / 2) continue;
        choose(c, s);
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
    if (camera) placeTags(camera, time);
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
    /**
     * IS THIS PERCH SOMEWHERE THIS CADET CAN GET TO, RIGHT NOW.
     *
     * `src/kit/kit.js` asks before it tells `src/meta/objective.js` that a site
     * may be named. `ACCESS` above is the whole of the answer: the base wing,
     * a kit grant, or the standing column another cache has already paid — and
     * a column that is not standing yet is not an access route, it is a lie.
     * See `src/world/errand.js`: an errand you cannot physically complete
     * teaches the player that the marker lies.
     *
     * @param {(id:string)=>boolean} has  `kit.has`
     */
    canReach(has) {
      const open = new Set(list.filter((c) => c.opened).map((c) => c.key));
      return (c) => {
        const a = c.access;
        if (a === null || a === undefined) return true;
        if (typeof a === 'number') return open.has(String(a));
        try { return !!has?.(a); } catch { return false; }
      };
    },
    state: () => ({
      total: list.length,
      opened: list.filter((c) => c.opened).length,
      deep: deep.length,
      deepOpen: list.filter((c) => c.tier === 2 && c.opened).length,
      at: list.map((c) => ({
        i: c.i, tier: c.tier, x: c.x, y: c.y, z: c.z, opened: c.opened,
        access: c.access === null ? 'base' : c.access,
        /* Where an answer can be GIVEN, so a critic can walk the deck and prove
           that crossing it gives none. Read-only facts, never a way in. */
        claims: (c.claims || []).map((e, k) => ({
          v: c.stones[k] ? c.stones[k].v : null,
          spent: !!(c.stones[k] && c.stones[k].spent),
          won: !!(c.stones[k] && c.stones[k].won),
          x: toWorld(c, e.gx * CELL, e.gz * CELL).x,
          z: toWorld(c, e.gx * CELL, e.gz * CELL).z,
        })),
        roll: Number((c.roll || 0).toFixed(4)),
        left: c.left, right: c.right,
      })),
    }),
    reset() {
      try { localStorage.removeItem('ascent.caches'); } catch { /* private mode */ }
    },
  };
}

const XCOL = new THREE.Color(0xb489ff);
const UCOL = new THREE.Color(0x74e2ff);
/** The four quarter turns, exactly, so a lattice cell is never a float away. */
const QSIN = [0, 1, 0, -1];
const QCOS = [1, 0, -1, 0];
