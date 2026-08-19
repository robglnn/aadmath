import * as THREE from 'three';
import { heightAt, ISLAND_R } from './world.js';
import { tex } from '../ui/tex.js';
import { t } from '../i18n/index.js';
import { CELL } from '../build/pieces.js';
import { merge } from './geom.js';
import './field.css';

/**
 * THE SPANS — the second kind of place in the archipelago.
 *
 * A hanging cache (src/world/caches.js) is a balance: two pans, real tiles, and
 * a beam that slams the heavy way. It is the best idea in this build and a
 * critic said so. Its problem was never quality. Its problem was that it was
 * ONE idea with five instances, so the whole world off the island said exactly
 * one sentence, five times.
 *
 * This is the second sentence, and it is deliberately a different one:
 *
 *      a(b + c)  is the AREA OF A RECTANGLE, split in two.
 *
 * That is not a metaphor somebody chose. It is the course's own words — read
 * `bigIdea` on the `distribute` node in content/graph/algebra1-l1.json. So the
 * site is a rectangle of ground, hung in the sky, with nothing under it:
 *
 *   · the plot is `a` rows deep and `b + c` columns wide, marked out in light,
 *     with a bright seam standing where the `b` block ends and the `c` block
 *     begins. You can see the gulf through every empty square of it;
 *   · three stacks of slabs float at the near edge. Each stack is a real,
 *     countable pile laid out in the shape its own expression describes: the
 *     true one is two blocks, `a × b` beside `a × c`, which is the plot cut
 *     along its own seam. The false ones are the shapes the two commonest
 *     mistakes actually make — a block with a thin line stuck on the end
 *     (multiplied only the first term), and one long block (multiplied the two
 *     inside terms together);
 *   · **walking into a stack lays it.** The slabs fly out and cover the ground
 *     one square at a time, in front of you. Too few and the holes stay open
 *     and go red, and you can count them. Too many and the surplus piles up on
 *     top and slides off into the gulf. Exactly enough and the plot goes solid.
 *
 * There is no keypad and no multiple-choice card. A cadet who cannot read
 * `3\cdot4 + 3\cdot2` can still count slabs against squares and win, and will
 * have done the mathematics with his feet either way.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT LEAVES BEHIND, AND WHY THAT IS THE POINT
 *
 * A cache pays motes and plants a standing updraft: it changes how HIGH you can
 * get. A span pays motes and lays **a road**: it changes where you can WALK.
 *
 * The road is real floor, in the same solid registry the build lattice uses, so
 * a cadet runs along it exactly the way he runs along a floor he set himself.
 * It is laid one link at a time, from the island outwards:
 *
 *      solve the FIRST span   → a road from the island's own ridge out to it
 *      solve the SECOND       → the road carries on, first span to second
 *      solve the THIRD        → and on again, out to the edge of the world
 *
 * So the first span has to be FLOWN to — it hangs above every hill on its
 * bearing, which is a wing, or an updraft a cache paid you, or a column you
 * built. Every span after it is walkable, because you did the mathematics. That
 * is the whole game in one sentence: traversal buys the first one, and
 * mathematics buys the rest.
 *
 * And it is the most legible permanent mark the world can carry. An updraft is
 * a column of light out at sea. A road is a road: it grows off your own coast,
 * you can see it from the ridge you launched from, and it was not there
 * yesterday.
 */

/** How many spans hang off the island. Three is a chain you can see. */
const COUNT = 3;
/**
 * The chain, in metres from the island's centre. The island stops at 168 and
 * the leash at 272, so this marches from just past the coast to very nearly the
 * edge of the world — and the third one is the furthest place a cadet can
 * stand.
 */
const RING = [214, 238, 262];
/**
 * The bearings. Not a straight line out, but a SWEEP: three sites arcing across
 * a quarter of the horizon, so that from the coast they read as three places
 * rather than as one place with two hidden behind it.
 *
 * Straight out was the first try and the road killed it. Consecutive spans were
 * forty metres apart with twenty-four metres of climb between them, which is
 * not a road, it is a ladder with the rungs two metres up. Swept, each link is
 * about a hundred metres long and rises about a metre a plate, and a cadet
 * walks it.
 *
 * The FIRST one's bearing was chosen by walking, not by looking. The obvious
 * line is the Spine's — the island's signature summit is on it, and a summit is
 * where you launch from. The Spine's shoulder climbs from 72 m to 99 m in eight
 * metres of run: nothing on legs gets up it, so the first span was hung off a
 * launch pad no cadet could reach, and the chain was decorative. This line
 * climbs 55 · 63 · 68 · 85 · 94 and levels off, all the way to a coast at about
 * 96. You can run it. That is the only property the first bearing needs.
 */
const ARC = [-0.62, -1.02, -1.42];
/**
 * How far each span hangs above or below the launch coast (see `datum`).
 *
 * This is the access ladder, and it is the point of the whole chain:
 *
 *   -26   THE FIRST ONE IS A GLIDE, and it needs nothing bought. Run to the
 *         coast on its own bearing, jump, open the wing. Seventy metres of gulf
 *         at the wing a cadet lands with costs about ten metres of height, and
 *         there are twenty-six in hand — so it is a comfortable first flight
 *         rather than a frame-perfect one, and a cadet who has bought nothing
 *         at all can make it on day one. It cannot be walked to: there is
 *         nothing under it.
 *    -2   THE SECOND IS AT COAST HEIGHT, and a hundred and twenty metres of
 *         gulf out from the launch. A wing only ever goes down, so that flight
 *         arrives fifteen metres under the deck. It is walked to, on the road
 *         the first span laid.
 *   +22   AND THE THIRD IS TWENTY-FOUR METRES HIGHER AGAIN, on the road the
 *         second one laid.
 *
 * Traversal buys the first, and mathematics buys the rest. One honest caveat,
 * kept because it is better design than the thing it would replace: a cadet who
 * gets himself high — onto the Spine's mesa, up a column he built, off an
 * updraft a cache paid him — and flies a clean line can beat the road to the
 * second or the third. That is not a leak. That is the game paying out for
 * being good at it. The road is the route that always works.
 */
const LIFT = [-26, -2, 22];

const REWARD = 140;
/** Perch half-width in lattice cells. 2 -> 20 m of real floor across. */
const SPAN_CELLS = 2;
/** One square of the plot, in metres. */
const SQ = 1.5;
/**
 * …and the pitch a waiting stack is laid out at, which is smaller.
 *
 * A stack of forty at full size is nine metres of slabs and the deck is
 * twenty-two across: three of those side by side is a wall, and the first
 * frame of this site was exactly that. A waiting stack is therefore a scale
 * model of what it will lay. The two things a cadet has to read off it — how
 * MANY, and what SHAPE — both survive the scale; the third, how big one slab
 * is, is answered the moment he lays it.
 */
const STACK_PITCH = 0.72;
/** How close a boot has to pass a stack to lay it. */
const TOUCH = 2.4;
/** Seconds a cadet must have been standing on the deck before a stack is live. */
const ARM = 1.1;
/** Every slab of every span near enough to read. */
const SLAB_MAX = 900;
/** Past this a span is a silhouette and its slabs are not composed at all. */
const SLAB_RANGE = 190;
/** Road plates are one lattice cell each, laid end to end. */
const ROAD_STEP = CELL;
/** No road plate ever rises more than this above the one before it. */
const ROAD_RISE = 1.9;
/** How far a deck reaches from its own centre. A road begins outside this. */
const DECK_EDGE = 11;

export function createSpans(opts = {}) {
  const {
    scene, uiRoot, player, builder, hud, wallet, audio, fx,
    isBusy = () => false,
  } = opts;

  const group = new THREE.Group();
  group.name = 'spans';
  scene.add(group);

  const tags = document.createElement('div');
  tags.className = 'field-tags';
  (uiRoot || document.body).appendChild(tags);

  // ------------------------------------------------------------- materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8d98a2, roughness: 0.94, metalness: 0.04, flatShading: true,
  });
  /**
   * A span is warm stone and green light; a cache is cold blue alloy. One
   * glance from the coast says which kind of place is hanging out there, and
   * therefore which kind of thing it will ask.
   */
  const rigMat = new THREE.MeshStandardMaterial({
    color: 0xdff5e2, emissive: 0x2f8f5e, emissiveIntensity: 0.85,
    roughness: 0.34, metalness: 0.44,
  });
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x8b9a86, emissive: 0x1b2a1e, emissiveIntensity: 0.6,
    roughness: 0.62, metalness: 0.22, flatShading: true,
  });
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xc6ffd8, fog: false });
  const barMat = new THREE.MeshBasicMaterial({
    color: 0x9dffc4, transparent: true, opacity: 0.26,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xb9c4ae, emissive: 0x16301f, emissiveIntensity: 0.7,
    roughness: 0.78, metalness: 0.1, flatShading: true,
  });

  // Every empty square of every plot: a dim pane you can see the gulf through.
  const holeGeo = new THREE.PlaneGeometry(SQ * 0.94, SQ * 0.94);
  holeGeo.rotateX(-Math.PI / 2);
  const holeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const holes = new THREE.InstancedMesh(holeGeo, holeMat, SLAB_MAX);
  holes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  holes.frustumCulled = false;
  holes.count = 0;
  holes.renderOrder = 2;
  holes.userData.noCamBlock = true;
  group.add(holes);

  // …and every slab, laid or still waiting in a stack.
  const slabGeo = new THREE.BoxGeometry(SQ * 0.84, SQ * 0.3, SQ * 0.84);
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x123324, emissiveIntensity: 0.8,
    roughness: 0.42, metalness: 0.08,
  });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, SLAB_MAX);
  slabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  slabs.frustumCulled = false;
  slabs.castShadow = true;
  slabs.count = 0;
  slabs.userData.noCamBlock = true;
  group.add(slabs);

  // the roads, once they exist: one instanced plate, every span's road at once
  const plateGeo = new THREE.BoxGeometry(CELL, 0.7, CELL);
  const plates = new THREE.InstancedMesh(plateGeo, roadMat, 640);
  plates.frustumCulled = false;
  plates.castShadow = true;
  plates.receiveShadow = true;
  plates.count = 0;
  group.add(plates);
  /** Every road plate in the world, in the order it was laid. */
  const road = [];

  const list = [];
  const saved = load();

  /**
   * ONE datum for the whole chain, and it is THE COAST YOU JUMP OFF.
   *
   * Measured per bearing, the third span came out thirty metres lower than the
   * first and the road out of the island ran downhill: three unrelated rocks,
   * not a chain. Measured off the island's highest ground it came out above a
   * mesa nothing on legs can climb, so the launch pad was imaginary.
   *
   * So it is neither. It is the highest ground on the FIRST span's own bearing,
   * in the last thirty-four metres before the island stops — the lip a cadet is
   * standing on at the moment he runs out of island. Everything in the chain is
   * measured from there, so the ladder means what its comment says it means.
   */
  const datum = (() => {
    let hi = 6, hiR = ISLAND_R - 20;
    const ang = ARC[0];
    for (let r = ISLAND_R - 40; r < ISLAND_R - 6; r += 4) {
      const h = heightAt(Math.cos(ang) * r, Math.sin(ang) * r);
      if (h !== null && h > hi) { hi = h; hiR = r; }
    }
    return { hi, hiR, hiA: ang };
  })();

  for (let i = 0; i < COUNT; i++) make(siteFor(i));

  /** Where the nth span hangs. Fixed, for ever, and always above the one before. */
  function siteFor(i) {
    const ang = ARC[i];
    return {
      key: String(i), seed: i * 977 + 13, i, ang,
      x: Math.round((Math.cos(ang) * RING[i]) / CELL) * CELL,
      z: Math.round((Math.sin(ang) * RING[i]) / CELL) * CELL,
      y: Math.max(26, Math.round(datum.hi + LIFT[i])),
    };
  }

  /**
   * A point in a span's own frame, as an offset in world axes. The yaw is
   * always a quarter turn, so this is exact and there is never a half-cell of
   * drift between the hole you can see and the hole you can fall through.
   */
  function local(c, x, z) {
    const s0 = Math.round(Math.sin(c.yaw)), c0 = Math.round(Math.cos(c.yaw));
    return { x: x * c0 + z * s0, z: -x * s0 + z * c0 };
  }

  // ------------------------------------------------------------------ build
  function make(spec) {
    const slot = list.length;
    const c = {
      ...spec, slot,
      opened: !!(saved.opened && saved.opened[spec.key]),
      group: new THREE.Group(),
      laid: [], stacks: [], settle: 0, spill: 0, roadFrom: null, arm: 0,
    };
    c.group.position.set(spec.x, spec.y, spec.z);
    /**
     * QUARTER TURNS ONLY, and that is not a shortcut.
     *
     * The floor a cadet stands on is registered cell by cell on the build
     * lattice's own axis-aligned grid, which never rotates. A cache hides the
     * disagreement by being round. A span cannot: it has a rectangular hole in
     * the middle of it, and a hole drawn at 54° over solids laid at 0° is a
     * place where the picture and the collision are two different rooms. So the
     * whole site is snapped to the nearest quarter turn, the drawing and the
     * standing agree exactly, and the site reads as something BUILT — which is
     * what it is. A cache is a rock somebody hung a balance on. A span is
     * architecture.
     */
    const QT = Math.PI / 2;
    c.yaw = Math.round((spec.ang + QT) / QT) * QT;
    c.group.rotation.y = c.yaw;
    group.add(c.group);

    // ---- THE DECK, AND THE HOLE IN IT.
    //
    // Not a platform with a picture of a rectangle painted on it. A frame, with
    // twelve metres by eight of NOTHING in the middle, and the gulf underneath.
    // That is what makes "cover the ground" a true sentence rather than a
    // figure of speech: until the plot is covered there is no ground there, and
    // a cadet who walks into it falls through it.
    const parts = [];
    const slab = (w, d, px, pz) => {
      const g = new THREE.BoxGeometry(w, 2.4, d);
      g.translate(px, -1.3, pz);
      parts.push(g);
    };
    /**
     * WHERE THE HOLE IS NOT: THE PLACE YOU LAND.
     *
     * The hole was in the middle of the deck for one build, and every arrival
     * ended the same way — glide in, touch down on the centre of the site, take
     * one step, and fall seventy metres into the gulf while Marlow said
     * "everybody falls". A hazard nobody can avoid is not a hazard, it is a
     * door that shuts on you.
     *
     * So the deck is a broken causeway, and that is what the word span means.
     * Twelve metres of unbroken floor across the whole front, which is where a
     * wing puts you down and where the stacks stand; then eight metres of
     * NOTHING, the full width of the site; then the far ledge with the monolith
     * on it. There is no ledge down the sides, and that is deliberate: with one
     * there, a cadet lands beside the hole, takes a step toward the stacks and
     * drops through it, which is the same unavoidable trap in a thinner shape.
     *
     * What is left says the whole thing without a word of instruction. The
     * monolith is on the other side. The gap is between you and it. Cover the
     * gap and you can walk over; get it wrong and you cannot. The plot is not a
     * picture of a rectangle on a platform — it is the missing piece of the
     * causeway, and the arithmetic is what puts it back.
     */
    slab(20, 12, 0, 4);      // the dock: where a cadet lands, and the stacks
    slab(20, 4, 0, -12);     // the far ledge: the monolith stands on this
    // The underside. Two neat legs under the two rails made this read as a
    // table, which is the last thing a torn-off piece of a world should read
    // as: it wants mass, and it wants that mass nowhere near the middle, where
    // the hole is. So it is one broad wedge under the front deck and a second
    // under the back, both wider than they are deep, and the gulf shows
    // straight through between them.
    for (const [kx, kz, kr, kd] of [[0, 4, 7.8, 12], [0, -12, 4.4, 6]]) {
      const k = new THREE.CylinderGeometry(kr, 1.1, kd, 5, 1);
      k.rotateY(0.4);
      k.scale(1.35, 1, 0.62);
      k.translate(kx, -2.4 - kd / 2, kz);
      parts.push(k);
    }
    const rock = new THREE.Mesh(merge(parts), stoneMat);
    for (const g of parts) g.dispose();
    rock.castShadow = true;
    rock.receiveShadow = true;
    c.group.add(rock);

    // …and the same shape again in real floor. VOID is the six cells the hole
    // takes out; they are handed back, as floor, the moment the plot is covered.
    c.void = [];
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = -3; gz <= 2; gz++) {
        const w = local(c, gx * CELL, gz * CELL);
        const cell = {
          kind: 'floor', x: spec.x + w.x, y: spec.y, z: spec.z + w.z,
          yaw: 0, base: spec.y, onGround: false, dead: false, fixed: true,
          grow: 1, fade: 0, sel: 0, want: 0, tone: 0,
          id: SOLID_BASE - (slot * 64 + (gx + 2) * 8 + (gz + 3)),
        };
        if (gz >= -2 && gz <= -1) c.void.push(cell);
        else builder.solids.add(cell);
      }
    }

    // ---- the sealed monolith the plot is the lock on
    const bodyGeo = new THREE.BoxGeometry(1.6, 3.2, 1.7);
    const seamGeo = new THREE.BoxGeometry(0.09, 2.8, 1.76);
    c.half = [];
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(bodyGeo, boxMat.clone());
      h.position.set(s * 0.83, 1.7, -12.4);
      h.castShadow = true;
      h.receiveShadow = true;
      const sm = new THREE.Mesh(seamGeo, seamMat);
      sm.position.set(-s * 0.79, 0, 0);
      h.add(sm);
      c.group.add(h);
      c.half.push(h);
    }
    c.heart = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshBasicMaterial({
        color: 0xa8ffd0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }),
    );
    c.heart.position.set(0, 1.8, -12.4);
    c.heart.userData.noCamBlock = true;
    c.group.add(c.heart);

    // ---- THE MARK. A cache stands a shaft of light on end. A span raises a
    // frame: two pylons and a bar of light across the top, which from the coast
    // is a gate standing in the sky rather than another column of light. The
    // two kinds of place are told apart at a distance, which is the whole
    // reason a player picks one to fly at.
    c.markMat = barMat.clone();
    const pylon = new THREE.CylinderGeometry(0.34, 0.9, 26, 5);
    pylon.translate(0, 13, 0);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(pylon.clone(), rigMat);
      p.position.set(s * 8, 0, -10);
      p.castShadow = true;
      c.group.add(p);
    }
    pylon.dispose();
    const barGeo = new THREE.BoxGeometry(16.6, 0.6, 0.6);
    barGeo.translate(0, 25.4, -10);
    c.mark = new THREE.Mesh(barGeo, c.markMat);
    c.mark.userData.noCamBlock = true;
    c.mark.renderOrder = 2;
    c.group.add(c.mark);
    // …and a soft sheet hanging under the bar, so the frame still reads as a
    // frame when it is a hundred metres away and two pixels wide. Kept faint:
    // with the lit hole under it as well, anything stronger turned the whole
    // site into one green wash and buried the thing it was pointing at.
    const veilGeo = new THREE.PlaneGeometry(16.6, 24);
    veilGeo.translate(0, 12.8, -10);
    c.veil = new THREE.Mesh(veilGeo, new THREE.MeshBasicMaterial({
      color: 0x9dffc4, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    c.veil.userData.noCamBlock = true;
    c.veil.renderOrder = 1;
    c.group.add(c.veil);

    // ---- the plot, and the stacks
    const q = question(c.seed);
    c.q = q;
    c.plot = plotCells(q);
    markOut(c);
    buildStacks(c);

    // Two anchors each, exactly as the caches do it: the statement rides high
    // over the frame while a cadet is still flying at it, and comes down onto
    // the stacks by the time he is standing on the deck. The band he reads from
    // and the band he acts from are the same band at every distance he can act
    // from — which is the one legibility defect the caches had, and there is no
    // reason to ship it twice.
    c.tags = [
      { local: [0, 14.4, -8], near: [0, 5.6, 4], cls: 'lede', key: 'field.spanLock' },
      { local: [0, 13.2, -8], near: [0, 4.6, 4], cls: 'big', tex: q.latex },
    ];
    for (let k = 0; k < c.stacks.length; k++) {
      const s = c.stacks[k];
      c.tags.push({ local: [s.px, 0.9, 4], cls: 'slab', tex: s.latex, stack: k });
    }

    if (c.opened) openNow(c, true);
    list.push(c);
  }

  /**
   * THE PLOT: `a` rows by `b + c` columns, laid out on the deck in front of the
   * monolith, with the seam standing where the two blocks meet.
   */
  function plotCells(q) {
    const cols = q.b + q.c, rows = q.a;
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        out.push({
          x: (k - (cols - 1) / 2) * SQ + (k >= q.b ? 0.5 : -0.5),
          z: -6 + (r - (rows - 1) / 2) * SQ,
        });
      }
    }
    return out;
  }

  /**
   * MARK THE GROUND OUT.
   *
   * A rail around the whole plot, and a standing seam of light exactly where
   * the `b` block ends and the `c` block begins. The seam is the entire idea:
   * without it the plot is one rectangle of `b + c` and the bracket has
   * nothing to do with anything you can see. With it, the ground in front of
   * you is visibly `a` rows of `b`, next to `a` rows of `c`, and the true
   * stack is the only one shaped like both of them at once.
   */
  function markOut(c) {
    const q = c.q;
    const cols = q.b + q.c, rows = q.a;
    const w = cols * SQ + 1.0, d = rows * SQ;
    const parts = [];
    for (const sz of [-1, 1]) {
      const a = new THREE.BoxGeometry(w, 0.42, 0.3);
      a.translate(0, 0.2, -6 + sz * d / 2);
      parts.push(a);
      const b = new THREE.BoxGeometry(0.3, 0.42, d);
      b.translate(sz * w / 2, 0.2, -6);
      parts.push(b);
    }
    const rail = new THREE.Mesh(merge(parts), seamMat);
    for (const g of parts) g.dispose();
    rail.userData.noCamBlock = true;
    c.group.add(rail);
    c.rail = rail;

    /**
     * THE HOLE HAS TO BE VISIBLE FROM THE AIR.
     *
     * A cadet arrives at a span by flying at it, from above and in front, and
     * from there a rectangle of missing floor is a dark patch on a dark deck —
     * the one thing the whole site is about, invisible in the one frame it is
     * first seen in.
     *
     * The first attempt stood a twenty-metre box of light in the gap and it
     * read as a block of green glass sitting ON the deck, which is the exact
     * opposite of a hole. A hole is FLAT. So it is two flat panels, one at the
     * lip and one a little under it, and the parallax between them at any angle
     * off vertical says depth. Both go out the moment the ground is real.
     */
    c.well = new THREE.Group();
    for (const [dy, op] of [[0.06, 0.5], [-2.6, 0.26]]) {
      const g = new THREE.PlaneGeometry(20, 8);
      g.rotateX(-Math.PI / 2);
      g.translate(0, dy, -6);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: 0x9dffc4, transparent: true, opacity: op, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      m.userData.noCamBlock = true;
      m.renderOrder = 1;
      c.well.add(m);
    }
    c.group.add(c.well);

    const sx = (q.b - 0.5 - (cols - 1) / 2) * SQ;
    const seamGeo = new THREE.BoxGeometry(0.22, 1.5, d);
    seamGeo.translate(sx, 0.75, -6);
    const seam = new THREE.Mesh(seamGeo, c.markMat);
    seam.userData.noCamBlock = true;
    seam.renderOrder = 2;
    c.group.add(seam);
    c.seam = seam;
  }

  /**
   * Each stack is laid out in the shape its own expression describes, because
   * the shape is the argument. The true one is two blocks side by side — the
   * plot cut along its own seam. `a\cdot b + c` is a block with a thin line
   * stuck on the end. `a\cdot b\cdot c` is one long block. A cadet who reads
   * no notation at all can still see which of the three is the same shape as
   * the ground he is standing on.
   */
  function buildStacks(c) {
    const q = c.q;
    const wide = 7.4;
    const mid = (q.choices.length - 1) / 2;
    for (let k = 0; k < q.choices.length; k++) {
      const ch = q.choices[k];
      const px = (k - mid) * wide;
      const g = new THREE.Group();
      g.position.set(px, 1.5, 4);
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.8, 0),
        new THREE.MeshStandardMaterial({
          color: 0xe4ffe9, emissive: 0x3ad486, emissiveIntensity: 2.0,
          roughness: 0.26, metalness: 0.2,
        }),
      );
      g.add(core);
      const halo = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.5, 0),
        new THREE.MeshBasicMaterial({
          color: 0x6bffb0, transparent: true, opacity: 0.16,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        }),
      );
      halo.userData.noCamBlock = true;
      g.add(halo);
      c.group.add(g);
      c.stacks.push({
        n: ch.n, latex: ch.latex, shape: shapeOf(ch, q), px,
        group: g, core, halo, spent: false, ph: k * 1.9,
      });
    }
  }

  /**
   * Where every slab of a stack sits, relative to its own marker.
   *
   * Centred on the marker, so three stacks in a row never grow into each other
   * however lopsided their counts are, and stacked upwards from just above it,
   * so the marker a cadet walks into is always the lowest thing in the pile and
   * is never buried by its own slabs.
   */
  function shapeOf(ch, q) {
    const out = [];
    const P = STACK_PITCH;
    const push = (col, row, cols, gap) => out.push({
      x: (col - (cols - 1) / 2) * P + gap, y: 1.5 + row * P, z: 0,
    });
    if (ch.form === 'true') {
      // two blocks, a x b beside a x c: the plot cut along its own seam
      const cols = q.b + q.c;
      for (let r = 0; r < q.a; r++) {
        for (let k = 0; k < q.b; k++) push(k, r, cols, -P * 0.34);
        for (let k = 0; k < q.c; k++) push(q.b + k, r, cols, P * 0.34);
      }
    } else if (ch.form === 'partial') {
      // a block, with a thin line stuck on the end
      const cols = q.b + q.c;
      for (let r = 0; r < q.a; r++) for (let k = 0; k < q.b; k++) push(k, r, cols, -P * 0.34);
      for (let k = 0; k < q.c; k++) push(q.b + k, 0, cols, P * 0.34);
    } else {
      // one solid block, and a taller one than either of the others
      const cols = Math.min(6, Math.max(2, q.b));
      for (let k = 0; k < ch.n; k++) push(k % cols, Math.floor(k / cols), cols, 0);
    }
    return out;
  }

  // --------------------------------------------------------------- the maths
  /**
   * A rectangle small enough to lay out as squares, and two wrong stacks that
   * are the two mistakes the course itself names on this node: multiplying
   * only the first term inside the bracket (`partial-distribute`), and
   * multiplying the two inside terms together instead of distributing over
   * them (`combine-unlike`).
   */
  function question(seed) {
    const rnd = dice(seed);
    for (let tries = 0; tries < 200; tries++) {
      const a = 2 + rnd(2);           // 2..3 rows: the hole is eight metres deep
      const b = 2 + rnd(4);           // 2..5
      const c = 2 + rnd(4);           // 2..5
      if (b === c) continue;
      const total = a * (b + c);
      const partial = a * b + c;
      const inner = a * b * c;
      if (total < 12 || total > 21) continue;
      if (b + c > 7) continue;        // …and twelve across
      if (inner > 36) continue;
      if (total === partial || total === inner || partial === inner) continue;
      const set = [
        { n: total, form: 'true', latex: `${a}\\cdot ${b} + ${a}\\cdot ${c}` },
        { n: partial, form: 'partial', latex: `${a}\\cdot ${b} + ${c}` },
        { n: inner, form: 'inner', latex: `${a}\\cdot ${b}\\cdot ${c}` },
      ];
      return { a, b, c, total, latex: `${a}(${b} + ${c})`, choices: shuffle(set, rnd) };
    }
    return {
      a: 3, b: 2, c: 4, total: 18, latex: '3(2 + 4)',
      choices: [
        { n: 18, form: 'true', latex: '3\\cdot 2 + 3\\cdot 4' },
        { n: 10, form: 'partial', latex: '3\\cdot 2 + 4' },
        { n: 24, form: 'inner', latex: '3\\cdot 2\\cdot 4' },
      ],
    };
  }

  /** A small seeded die, so a span asks the same question for ever. */
  function dice(seed) {
    let h = 0x9e3779b9 ^ ((seed | 0) * 2654435761);
    return (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 8) % n); };
  }

  function shuffle(set, rnd) {
    const out = set.slice();
    for (let k = out.length - 1; k > 0; k--) {
      const j = rnd(k + 1);
      const tmp = out[k]; out[k] = out[j]; out[j] = tmp;
    }
    return out;
  }

  // ------------------------------------------------------------- the verdict
  /**
   * LAY A STACK. The slabs leave the marker and cover the ground one square at
   * a time. What happens next is arithmetic carried out in front of you and
   * nothing else: exactly enough covers it, too few leaves holes you can count,
   * and too many piles up and slides off the edge.
   */
  function lay(c, stack) {
    if (c.opened || stack.spent || c.settle > 0) return;
    c.laid.length = 0;
    const n = stack.n, need = c.plot.length;
    for (let k = 0; k < Math.min(n, need); k++) {
      c.laid.push({ x: c.plot[k].x, y: 0.42, z: c.plot[k].z, over: false });
    }
    for (let k = need; k < n; k++) {
      const cell = c.plot[k % need];
      c.laid.push({ x: cell.x, y: 0.42 + SQ * 0.42 * (1 + Math.floor((k - need) / need)), z: cell.z, over: true });
    }
    c.filled = Math.min(n, need);
    c.over = Math.max(0, n - need);
    c.settle = 1.2;

    if (n === need) {
      stack.won = true;
      for (const s of c.stacks) if (s !== stack) s.spent = true;
      open(c);
    } else {
      stack.spent = true;
      c.spill = c.over > 0 ? 2.2 : 0;
      fx?.impact?.('bad');
      hud?.flash?.(t(c.over > 0 ? 'field.spanOver' : 'field.spanShort',
        { n: c.over > 0 ? c.over : need - n }), 'bad');
      /**
       * ONE TIMER PER ATTEMPT, AND ONLY ITS OWN.
       *
       * The stacks are seven metres apart and a cadet crossing the deck to the
       * far one walks straight through the near one. That is fine — it costs
       * him a guess and he can see why. What is not fine is what the timers
       * then did: the first attempt's two-second clear fired half a second
       * AFTER the second attempt had laid its slabs, and wiped them. The plot
       * went blank with no explanation, a cadet saw his answer erased, and the
       * flight harness read a covered plot as empty. Each attempt now carries a
       * ticket, and a clear that is not holding the current ticket does nothing.
       */
      const ticket = (c.try = (c.try || 0) + 1);
      setTimeout(() => {
        if (c.opened || c.try !== ticket) return;
        c.laid.length = 0; c.filled = 0; c.over = 0;
      }, 1900);
      if (c.stacks.every((s) => s.spent)) {
        setTimeout(() => {
          if (c.opened || c.try !== ticket) return;
          for (const s of c.stacks) s.spent = false;
          hud?.flash?.(t('field.spanReset'), '');
          rebuildTags();
        }, 3400);
      }
    }
    rebuildTags();
  }

  function open(c) {
    openNow(c, false);
    c.opened = true;
    layRoad(c, false);
    save();
    const paid = wallet?.earn?.(REWARD, 'span') ?? REWARD;
    audio?.unlocked?.();
    fx?.impact?.('good');
    hud?.flash?.(t('field.spanOpen', { n: paid }), 'good');
  }

  function openNow(c, silent) {
    c.opened = true;
    // The hole is ground now, and stays ground. This is the one thing in this
    // game that makes floor out of nothing, and a cadet did it by covering a
    // rectangle exactly.
    if (c.void && c.void.length) {
      for (const cell of c.void) builder.solids.add(cell);
      c.void.length = 0;
    }
    c.heart.material.opacity = 0.9;
    c.mark.visible = false;
    c.veil.visible = false;
    c.well.visible = false;
    for (const s of c.stacks) s.group.visible = false;
    // The ground stays covered, for ever. It is the floor of the place now.
    c.laid.length = 0;
    for (const cell of c.plot) c.laid.push({ x: cell.x, y: 0.42, z: cell.z, over: false });
    c.filled = c.plot.length;
    c.over = 0;
    if (silent) c.settle = 0;
  }

  // ---------------------------------------------------------------- the road
  /**
   * LAY THE ROAD, FOR EVER — AND LAY IT IN FRONT OF THE CADET.
   *
   * The first build ran every road BACKWARDS: solving a span laid the link from
   * the place you had just come from to the place you were already standing on.
   * It was permanent, it was real floor, and it opened nothing whatsoever. A
   * reward you can only use by first going somewhere you have already been is
   * scenery with a receipt attached.
   *
   * So a road runs OUTWARD, to the next site in the chain:
   *
   *    solve the FIRST   → a road from it to the SECOND, which no glide reaches
   *    solve the SECOND  → a road on to the THIRD, higher again
   *    solve the THIRD   → and the road home, coast to first span, so that
   *                        tomorrow the whole archipelago is walkable from the
   *                        island and the flight never has to be flown again
   *
   * Every plate is one lattice cell of real floor in the same registry the
   * build lattice uses, flagged `fixed` so it cannot be cleared out from under
   * anybody, and no plate ever stands more than `ROAD_RISE` above the one
   * before it, so the whole run can be walked in both directions.
   */
  function layRoad(c, silent) {
    if (c.roadFrom) return;
    const next = list.find((o) => o.i === c.i + 1);
    let ax, az, ay;
    if (next) {
      ax = next.x; az = next.z; ay = next.y;
    } else {
      // the last span pays the road home: the coast the first flight left from
      ax = Math.round((Math.cos(datum.hiA) * datum.hiR) / CELL) * CELL;
      az = Math.round((Math.sin(datum.hiA) * datum.hiR) / CELL) * CELL;
      const g = heightAt(ax, az);
      ay = (g === null ? datum.hi : g) + 1.2;
      if (list.some((o) => o.i === 0)) {
        // …and it runs to the FIRST span, not to this one: the road home is the
        // way back onto the chain, and the chain's own links are already laid.
        c.homeTo = true;
      }
    }
    /**
     * A ROAD MEETS A DECK AT ITS DOCK, AND NOWHERE ELSE.
     *
     * Two things went wrong when the line simply joined one span's centre to
     * the next's, and both of them dropped a cadet into the gulf.
     *
     *   1. The first twelve metres of the line lay OVER the deck he was
     *      standing on, and climbing — so the road arrived on the deck as a
     *      two-and-a-half-metre step. A wall, at the exact spot he steps onto
     *      the thing he was just paid.
     *   2. Worse: the far end came in on whatever side of the next span the
     *      bearing happened to point at, and one of those sides is the HOLE. He
     *      walked ninety metres of new road, uphill, and fell through the plot
     *      at the end of it. Every run of the flight harness ended that way and
     *      it took four of them to see it, because the numbers said he had
     *      arrived: he was within a metre of the deck, and thirty metres under
     *      it.
     *
     * So each end of a road is a span's DOCK — the unbroken twelve metres of
     * floor a wing lands on, at that deck's own height. You step off a dock and
     * you step onto a dock, both ends level, and every metre of climb is spent
     * over the gulf where there is nothing to climb over.
     */
    const dockOf = (o) => {
      const d = local(o, 0, DECK_EDGE);
      return { x: o.x + d.x, y: o.y, z: o.z + d.z };
    };
    if (next) { const d = dockOf(next); ax = d.x; az = d.z; ay = d.y; }
    const to = c.homeTo
      ? dockOf(list.find((o) => o.i === 0))
      : dockOf(c);
    const run = Math.hypot(to.x - ax, to.z - az);
    // Enough plates that the rise per plate is walkable, and never fewer than
    // the run itself needs to be continuous floor.
    /**
     * A ROAD HAS TO BE FOUR-CONNECTED, OR IT IS A LINE OF STEPPING STONES.
     *
     * The plates are four-metre lattice cells and the chain runs on a diagonal.
     * Sampled at one plate per four metres, consecutive cells came out offset by
     * about two metres in x AND three in z — so they met corner to corner, with
     * half a metre of overlap at the join, and a cadet walking it dropped
     * through the first diagonal gap he came to and fell forty metres.
     *
     * So the line is walked at half a cell, and wherever the cell index changes
     * in both axes at once the corner cell is laid as well. Every plate on a
     * finished road shares a full edge with the next one. `addPlate` throws away
     * the repeats, so this costs plates only where the road actually turns.
     */
    const fine = Math.max(
      Math.ceil((run / ROAD_STEP) * 2),
      Math.ceil(Math.abs(to.y - ay) / ROAD_RISE),
    );
    /**
     * …AND IT IS TWO CELLS WIDE, because one is not a road.
     *
     * Four metres of ribbon a hundred metres long, on a diagonal, ninety metres
     * above the gulf: a cadet walking it steps off it. Not at a defect, not at a
     * gap — just off the side, the way anybody walks off a plank. Eight metres
     * is a road. It is also what makes the thing legible from the island, which
     * a single file of plates was never going to be.
     */
    const dx = to.x - ax, dz = to.z - az;
    const wideX = Math.abs(dz) > Math.abs(dx) ? CELL : 0;
    const wideZ = wideX ? 0 : CELL;
    let px = null, pz = null, laidN = 0;
    const put = (x, y, z) => {
      addPlate(x, y, z, c.slot, laidN++);
      addPlate(x + wideX, y, z + wideZ, c.slot, laidN++);
    };
    for (let k = 1; k < fine; k++) {
      const u = k / fine;
      const y = ay + (to.y - ay) * u;
      const x = Math.round((ax + dx * u) / CELL) * CELL;
      const z = Math.round((az + dz * u) / CELL) * CELL;
      if (px !== null && x !== px && z !== pz) put(px, y, z);  // the corner
      put(x, y, z);
      px = x; pz = z;
    }
    c.roadFrom = { x: ax, y: ay, z: az, steps: laidN };
    rebuildRoad();
    if (!silent) hud?.flash?.(t('field.spanRoad'), 'good');
  }

  const _seen = new Set();
  /**
   * ONE PLATE PER CELL. NOT ONE PER SAMPLE.
   *
   * The line is walked at half a cell so that the road turns cleanly, which
   * means two or three samples land in the same lattice cell — at heights half
   * a metre apart. Keyed on height as well as position, all of them were laid,
   * and the road became a hundred metres of doubled and trebled floor with
   * half-metre lips in it. A cadet walking it caught on the lips, was pushed
   * out sideways, and went off the edge every single run.
   *
   * The road climbs monotonically along its own path, so the first plate to
   * claim a cell is the right one and every later one is a duplicate.
   */
  function addPlate(x, y, z, slot, k) {
    const key = `${x}|${z}`;
    if (_seen.has(key)) return;
    _seen.add(key);
    const p = {
      kind: 'floor', x, y, z, yaw: 0, base: y, onGround: false, dead: false,
      fixed: true, grow: 1, fade: 0, sel: 0, want: 0, tone: 0,
      id: ROAD_BASE - (slot * 256 + k),
    };
    builder.solids.add(p);
    road.push(p);
  }

  const _rm = new THREE.Matrix4();
  const _rp = new THREE.Vector3();
  const _rq = new THREE.Quaternion();
  const _rs = new THREE.Vector3(1, 1, 1);
  function rebuildRoad() {
    const n = Math.min(road.length, 640);
    for (let k = 0; k < n; k++) {
      _rp.set(road[k].x, road[k].y - 0.35, road[k].z);
      plates.setMatrixAt(k, _rm.compose(_rp, _rq, _rs));
    }
    plates.count = n;
    plates.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------------------------- tags
  let sight = false;
  function rebuildTags() {
    tags.innerHTML = '';
    const nodes = [];
    for (const c of list) {
      if (c.opened) continue;
      for (const tag of c.tags) {
        const el = document.createElement('div');
        const stack = tag.stack != null ? c.stacks[tag.stack] : null;
        el.className = `field-tag ${tag.cls}${stack && stack.spent ? ' spent' : ''}`.trim();
        if (tag.tex) el.innerHTML = tex(tag.tex);
        else el.textContent = t(tag.key);
        tags.appendChild(el);
        nodes.push({ el, c, local: tag.local, near: tag.near || tag.local, stack });
      }
    }
    tagNodes = nodes;
  }
  let tagNodes = [];
  rebuildTags();

  const _v = new THREE.Vector3();
  const _c = new THREE.Vector3();
  /** How far the label has come down to meet you: 0 far out, 1 on the deck. */
  const DESCEND_FAR = 60, DESCEND_NEAR = 26;
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
      const reach = sight ? 150 : 84;
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
  const _s = new THREE.Vector3(1, 1, 1);
  /**
   * A slab waiting in a stack is drawn at the stack's own pitch. Laid out at
   * full plot size and stacked at 0.72 m they overlapped each other by half and
   * three separate piles read as three sets of venetian blinds. Nobody can
   * count blinds.
   */
  const _ss = new THREE.Vector3().setScalar(STACK_PITCH / SQ * 0.94);
  const OKCOL = new THREE.Color(0xdff7e6);
  const BADCOL = new THREE.Color(0xff9a7a);
  const HOLECOL = new THREE.Color(0xbfe9ff);
  const SHORTCOL = new THREE.Color(0xff8a6a);

  function update(dt, time, camera) {
    const busy = isBusy();
    let ns = 0, nh = 0;
    for (const c of list) {
      c.settle = Math.max(0, c.settle - dt);
      c.spill = Math.max(0, c.spill - dt);
      /**
       * ARRIVING IS NOT ANSWERING.
       *
       * A cadet reaches a span by flying at it, and the front deck is where he
       * lands. Without this, a landing that happens to touch a stack spends a
       * guess before he has read a single thing — the world taking a turn on
       * his behalf, which is the one complaint this game has heard most. So a
       * stack is only live once his boots have been on that deck for `ARM`
       * seconds. Land, look, then walk into one.
       */
      c.arm = (player.grounded !== false
        && Math.abs(player.pos.y - c.y) < 4
        && Math.hypot(player.pos.x - c.x, player.pos.z - c.z) < 18)
        ? c.arm + dt : 0;

      if (c.opened) {
        c.half[0].position.x = THREE.MathUtils.damp(c.half[0].position.x, -2.1, 3, dt);
        c.half[1].position.x = THREE.MathUtils.damp(c.half[1].position.x, 2.1, 3, dt);
        c.heart.rotation.y = time * 0.7;
        c.heart.position.y = 1.8 + Math.sin(time * 1.1) * 0.18;
      } else {
        c.markMat.opacity = 0.34 + 0.12 * Math.sin(time * 1.2 + c.i);
        for (const s of c.stacks) {
          s.group.position.y = 1.6 + Math.sin(time * 1.1 + s.ph) * 0.22;
          s.core.rotation.y = time * 0.8 + s.ph;
          s.core.rotation.x = time * 0.4;
          s.core.material.emissiveIntensity = s.spent ? 0.25 : 2.0;
          s.core.material.color.setHex(s.spent ? 0x77826f : 0xe4ffe9);
          s.halo.material.opacity = s.spent ? 0.04 : 0.13 + 0.05 * Math.sin(time * 2 + s.ph);
          if (busy || s.spent || c.settle > 0 || c.arm < ARM) continue;
          s.group.getWorldPosition(_p);
          if (_p.distanceTo(player.pos) < TOUCH) lay(c, s);
        }
      }

      if (camera && camera.position.distanceTo(c.group.position) > SLAB_RANGE) continue;
      c.group.updateMatrixWorld(true);
      _q2.setFromRotationMatrix(c.group.matrixWorld);

      // the ground still showing through: dim while nothing is laid, hot when
      // a stack has come up short, so the shortfall is a thing you can count
      const short = !c.opened && c.filled > 0 && c.filled < c.plot.length;
      for (let k = 0; k < c.plot.length; k++) {
        if (k < (c.filled || 0)) continue;
        if (nh >= SLAB_MAX) break;
        _p.set(c.plot[k].x, 0.16, c.plot[k].z).applyMatrix4(c.group.matrixWorld);
        holes.setMatrixAt(nh, _m.compose(_p, _q2, _s));
        holes.setColorAt(nh, short ? SHORTCOL : HOLECOL);
        nh++;
      }

      // the slabs already down…
      for (const tl of c.laid) {
        if (ns >= SLAB_MAX) break;
        const drop = tl.over ? c.spill * 0 : 0;
        _p.set(tl.x, tl.y + drop - (tl.over ? (2.2 - c.spill) * 3 : 0), tl.z)
          .applyMatrix4(c.group.matrixWorld);
        slabs.setMatrixAt(ns, _m.compose(_p, _q2, _s));
        slabs.setColorAt(ns, tl.over ? BADCOL : OKCOL);
        ns++;
      }
      // …and the ones still waiting in a stack
      if (!c.opened) {
        for (const s of c.stacks) {
          if (s.spent || c.settle > 0) continue;
          for (const cell of s.shape) {
            if (ns >= SLAB_MAX) break;
            _p.set(s.px + cell.x, cell.y, 4 + cell.z).applyMatrix4(c.group.matrixWorld);
            slabs.setMatrixAt(ns, _m.compose(_p, _q2, _ss));
            slabs.setColorAt(ns, OKCOL);
            ns++;
          }
        }
      }
    }
    slabs.count = ns;
    holes.count = nh;
    slabs.instanceMatrix.needsUpdate = true;
    holes.instanceMatrix.needsUpdate = true;
    if (slabs.instanceColor) slabs.instanceColor.needsUpdate = true;
    if (holes.instanceColor) holes.instanceColor.needsUpdate = true;
    if (camera) placeTags(camera);
  }

  // -------------------------------------------------------------------- save
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem('ascent.spans') || '{}') || {};
      return { opened: raw.opened || {} };
    } catch { return { opened: {} }; }
  }
  function save() {
    const o = {};
    for (const c of list) if (c.opened) o[c.key] = 1;
    try { localStorage.setItem('ascent.spans', JSON.stringify({ opened: o })); }
    catch { /* private mode */ }
  }

  /**
   * THE ROADS A PREVIOUS SITTING PAID FOR — LAID LAST, AND THAT IS LOAD-BEARING.
   *
   * A road runs between two spans, so it cannot be laid until both ends are
   * standing; that much was obvious and was handled. What was not is that
   * `addPlate` closes over a `Set` and `rebuildRoad` over four scratch vectors,
   * all declared further down this factory — so restoring a saved road from up
   * there ran `addPlate` before its own `const` had been reached and threw
   * "Cannot access before initialization" from inside module setup.
   *
   * The cost of that was the whole game. Not the spans: the GAME. It threw
   * during `createSpans`, main.js never finished booting, and every cadet who
   * had ever covered a plot came back the next day to a black page. It only
   * happened on the second sitting, so nothing that starts from a cleared save
   * — which is every gate in tools/critic — could ever have seen it.
   *
   * So the restore happens here, at the bottom, after every binding this
   * factory owns exists.
   */
  for (const c of list) if (c.opened) layRoad(c, true);

  return {
    update,
    relocalise: rebuildTags,
    /** RESONANT SIGHT: read a span's statement from further out. */
    setSight(on) { sight = !!on; },
    list,
    /** Every road plate standing in the world right now. */
    get road() { return road; },
    state: () => ({
      total: list.length,
      opened: list.filter((c) => c.opened).length,
      roadPlates: road.length,
      at: list.map((c) => ({
        i: c.i, x: c.x, y: c.y, z: c.z, opened: c.opened,
        need: c.plot.length, road: c.roadFrom ? c.roadFrom.steps : 0,
      })),
    }),
    reset() {
      try { localStorage.removeItem('ascent.spans'); } catch { /* private mode */ }
    },
  };
}

/**
 * Where this module's solid ids live. The caches take -1 downwards and the
 * build lattice takes 0 upwards, so both bands here are parked well clear of
 * either: nothing the cadet builds can ever collide with a deck or a road.
 */
const SOLID_BASE = -100000;
const ROAD_BASE = -200000;
