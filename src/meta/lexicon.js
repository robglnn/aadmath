/**
 * THE NOUNS, DEFINED ONCE, IN THE ONE VOICE THIS GAME HAS.
 *
 * After a full session the player could not define a single word the game runs
 * on: *"not sure what to do about rifts, shards, and other things… i see black
 * diamonds and golden or orange diamonds too, nothing happening maybe just
 * aesthetics."* Every one of those was a real mechanic with real numbers behind
 * it, and none of them had ever been explained where he was standing.
 *
 * WHO DOES WHAT. `src/world/beckon.js` now labels every interactable in the
 * world at range — the rift's skill and whether it is shut, the vein's value
 * and how long a spent one has left, the anchor. That answers *what is this
 * called and what is it worth right now*, live, on the object, for ever. This
 * file answers the other half, which a live label can never carry without
 * becoming a wall of text: *what is this, why does it exist, and why do you
 * care* — said once, ever, the first time the player is actually looking at
 * one, in Marlow's voice.
 *
 * Deliberately no DOM. Two labels on the same object is a HUD, not a world, and
 * the world already has the label. This is the sentence underneath it.
 *
 * Rules that keep it from becoming a notification system:
 *
 *   ONCE, FOR EVER. Each entry is written into the arc's own `seen` set the
 *     moment it fires — the same set that stops Marlow re-explaining a rift to
 *     a Sovereign. Nothing here can fire twice, in this session or any other.
 *   ONLY WHAT HE IS LOOKING AT. In the camera frustum, inside its own range,
 *     held for `DWELL` seconds. Sprinting past something at forty metres does
 *     not spend its one chance to teach.
 *   ONE AT A TIME, WITH AIR. `GAP` seconds between two of them, and never
 *     while a rift, a ceremony or a session beat holds the frame.
 *   IN THE ORDER HE MEETS THEM. Priority only breaks a tie between two things
 *     he has walked up to in the same breath.
 */
import * as THREE from 'three';

/** Seconds a thing has to stay in view before it is allowed to name itself. */
const DWELL = 0.75;
/** Seconds between two nouns naming themselves, so they never queue up. */
const GAP = 11;

const tmp = new THREE.Vector3();
const _sph = new THREE.Sphere();

/**
 * The table. An entry is an id (which is also its i18n key and its save key),
 * a priority, and a `find` that returns the world point of the nearest
 * instance, or null. Anything the world grows later is one row.
 *
 * @param {{rifts:object, drift:object|null, caches:object|null,
 *          builder:object|null, vergeR:number}} w
 */
export function lexiconOf(w) {
  const { rifts, drift, caches, builder, vergeR = 0 } = w;
  const veins = () => drift?.veins || [];

  /** The nearest rift that is open to him and not yet sealed, within `range`. */
  const nearestOpenRift = (p, range) => {
    let best = null, bd = range;
    for (const r of rifts.list || []) {
      if (r.locked || r.mastered) continue;
      const d = p.distanceTo(r.foot || r.group.position);
      if (d < bd) { bd = d; best = r; }
    }
    return best ? (best.foot || best.group.position).clone() : null;
  };

  return [
    // --- the rift. The single most important word in the game. --------------
    // ONE NOUN, ONE MEANING. This used to be a "tear" here, a "rift" on the
    // chapter card and a "tear" again in the panel header, which left the
    // player counting two things that were one thing. Now: the world *tears*
    // (a verb, the process, four days old); where it tears, a *rift* opens
    // (the noun, the ring, the only thing anybody counts).
    /* 62 m, not 40. (i18n/ui — smallest possible edit, and here is why.)
       The cadet lands 53 metres from the first rift and cannot move for the
       whole cold open, so at 40 m this line — the definition of the noun the
       entire game is built on — could not fire until the opening had finished
       AND he had walked twenty metres. A cold critic measured the result: RIFT
       is on the objective card from the fourth second and the first thing that
       says what one is arrives about thirty-five seconds later, out of the
       story channel. 62 puts the landing site inside range, so the word is
       defined while he is looking at the thing, which is the whole point of
       this file. Nothing else changes: it is still once, ever, in view, and
       behind the same dwell and gap as every other noun. */
    {
      id: 'rift', pri: 0,
      find: (p) => nearestOpenRift(p, 62),
    },
    // --- a cipher mote: the thing he had eight hundred of --------------------
    // Formerly "cipher shard", which collided head-on with Shard Nine, the
    // island he is standing on. A shard is a piece of world; a mote is money.
    { id: 'mote', pri: 1, find: (p) => moteOf(veins(), p, 22, (v) => v.cool <= 0 && !v.rich) },
    // --- a charged vein: the gold diamonds, and why they are gold ------------
    { id: 'charged', pri: 2, find: (p) => moteOf(veins(), p, 26, (v) => v.cool <= 0 && v.rich) },
    /* --- the surge. A player went from nine motes to nought in two rings and
       reported no idea why: "Rift surge — 2 shards knocked loose" names the
       event and nothing else. The cause (an unsealed rift, every fifteen
       seconds) and the two ways out (jump the ring; seal the rift) have to
       arrive while he is standing in the blast radius, so `anywhere` drops the
       look test — a ring that comes from behind is exactly the case that needs
       explaining, and `SURGE_R` in src/world/drift.js is 34 m. */
    {
      // 46 m, not `SURGE_R`: a ring that lands throws you fifteen metres back,
      // and the explanation must survive the very knock it is explaining.
      id: 'surge', pri: 3, anywhere: true,
      find: (p) => nearestOpenRift(p, 46),
    },
    // --- a spent vein: the black diamonds, and why they are black ------------
    { id: 'husk', pri: 4, find: (p) => moteOf(veins(), p, 20, (v) => v.cool > 0) },
    // --- a lattice anchor: the three diamond things he found -----------------
    {
      id: 'anchor', pri: 5,
      find: (p) => {
        let best = null, bd = 46;
        for (const a of builder?.anchors?.list || []) {
          if (a.done) continue;
          const d = p.distanceTo(a.pos);
          if (d < bd) { bd = d; best = a; }
        }
        return best ? best.pos.clone() : null;
      },
    },
    // --- a cache: the balance hanging out over the coast ---------------------
    {
      id: 'cache', pri: 6,
      find: (p) => {
        let best = null, bd = 110;
        for (const c of caches?.list || []) {
          if (c.opened) continue;
          const d = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
          if (d < bd) { bd = d; best = c; }
        }
        return best ? new THREE.Vector3(best.x, best.y + 6, best.z) : null;
      },
    },
    // --- an updraft: the columns he found by accident ------------------------
    {
      id: 'updraft', pri: 7,
      find: (p) => {
        let best = null, bd = 80;
        for (const c of drift?.columns || []) {
          const d = Math.hypot(c.x - p.x, c.z - p.z);
          if (d < bd) { bd = d; best = c; }
        }
        return best ? new THREE.Vector3(best.x, best.y0 + 16, best.z) : null;
      },
    },
    /* --- the verge. He flew at a far island and slid along a wall.
       `src/world/verge.js` now makes that wall a place you can see and
       `src/world/beckon.js` names it. Neither of them can say the thing that
       turns a refusal into a promise — that the far shards are where this goes
       when the lattice holds — and that is a line, not a label. */
    {
      id: 'verge', pri: 8,
      find: (p) => {
        if (!vergeR) return null;
        const out = Math.hypot(p.x, p.z);
        if (out < vergeR - 110) return null;
        // the point on the curtain straight ahead of him
        const k = vergeR / Math.max(1e-3, out);
        return new THREE.Vector3(p.x * k, p.y + 40, p.z * k);
      },
    },
  ];
}

/**
 * The watcher. Owns nothing but its own dwell timers and the `seen` set it is
 * handed — which is the arc's save, so a noun learned is learned for good, in
 * the same file as everything else that is.
 */
export function createLexicon({ entries, seen, mark, camera, player, say, isBusy }) {
  const dwell = new Map();
  let cool = 0;
  const frustum = new THREE.Frustum();
  const mat = new THREE.Matrix4();

  function update(dt) {
    cool -= dt;
    if (isBusy?.()) { dwell.clear(); return; }

    mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(mat);

    let fire = null;
    for (const e of entries) {
      if (seen.has(key(e.id))) continue;
      const at = e.find(player.pos);
      // `containsPoint` is exact for a point, but a rift is five metres across
      // and a cache is twenty: a thing whose centre is one pixel off the edge
      // of the screen is still a thing he is looking at.
      //
      // `anywhere` is for the one entry that is not a thing you look at but a
      // thing that happens to you (the surge). Requiring line of sight there
      // would withhold the explanation from precisely the player it is for.
      const looking = at && (e.anywhere || frustum.intersectsSphere(sphere(at, 5)));
      if (!looking) { dwell.delete(e.id); continue; }
      const held = (dwell.get(e.id) || 0) + dt;
      dwell.set(e.id, held);
      if (held < DWELL) continue;
      if (!fire || e.pri < fire.pri) fire = e;
    }

    if (!fire || cool > 0) return;
    /* SPEND THE ONE SHOT ONLY IF IT WAS HEARD. `comms.push` caps its queue at
       five and silently drops the tail, so a noun pushed behind a long opening
       speech used to be marked learned-for-ever and never said — which is how a
       Polish cadet (longer lines, slower drain) could be told what a surge is
       exactly never. `say` now reports whether the channel took the line, and a
       refusal costs nothing but this frame. */
    if (say(fire.id) === false) return;
    cool = GAP;
    dwell.delete(fire.id);
    mark(key(fire.id));
  }

  return {
    update,
    /** Which nouns this cadet has been told, for the harness. */
    known: () => entries.filter((e) => seen.has(key(e.id))).map((e) => e.id),
    reset() { dwell.clear(); cool = 0; },
  };
}

const key = (id) => 'lex.' + id;

function sphere(at, r) { _sph.center.copy(at); _sph.radius = r; return _sph; }

/** The world point of the nearest crystal in a vein matching `ok`. */
function moteOf(veins, p, range, ok) {
  let best = null, bd = range;
  for (const v of veins) {
    if (!ok(v)) continue;
    for (const m of v.motes) {
      const d = tmp.set(m.x, m.y, m.z).distanceTo(p);
      if (d < bd) { bd = d; best = m; }
    }
  }
  return best ? new THREE.Vector3(best.x, best.y, best.z) : null;
}
