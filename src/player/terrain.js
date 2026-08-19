import * as THREE from 'three';
import * as World from '../world/world.js';

/**
 * Thin, defensive wrapper over the world heightfield. The player must never be
 * the thing that explodes when the world team reshapes the island, so every
 * query is null-safe and the gradient is computed here rather than imported.
 */
const VOID = -100000;

/**
 * Solid surfaces that are not the island — today, the build lattice.
 *
 * Registered from outside (main.js) rather than imported, so the player never
 * has to know the builder exists. Everything the cadet does about the ground —
 * standing, landing, stepping up, running up a slope, being stopped by a face,
 * crossing a void — is derived from these two functions, so plugging in here is
 * what makes a piece you built behave exactly like ground you found.
 */
let SOLIDS = null;
export function setSolids(s) { SOLIDS = s; }
/**
 * The lattice itself, for the one question `heightAt` cannot answer: not *what
 * is the surface here* but *is this point inside a panel*. Recovery has to ask
 * it — a cadet shut in his own room is standing on a floor his own walls pass
 * through. (src/player/escape.js)
 */
export function solids() { return SOLIDS; }

export function heightAt(x, z) {
  const h = World.heightAt?.(x, z);
  const g = typeof h === 'number' && Number.isFinite(h) ? h : null;
  if (SOLIDS) {
    const s = SOLIDS.top(x, z);
    if (s !== null && (g === null || s > g)) return s;
  }
  return g;
}

/**
 * Is the surface under this point something a player BUILT, rather than
 * something the island happens to be doing?
 *
 * The boots ask this for one reason, and it is the reason building is worth
 * doing at all: **a lattice ramp is engineered ground and a hillside is not.**
 * A hill charges you nearly half your speed to climb it. A ramp you set down
 * yourself is a machined surface with a lip on the end of it, so it charges
 * you almost nothing and it throws you off the top — which is what makes
 * "build a ramp" the fast answer to a climb instead of a slower one.
 */
export function onBuilt(x, z) {
  if (!SOLIDS) return false;
  const s = SOLIDS.top(x, z);
  if (s === null) return false;
  const g = World.heightAt?.(x, z);
  return !(typeof g === 'number' && Number.isFinite(g) && g > s);
}

export const RIM = () => (typeof World.ISLAND_R === 'number' ? World.ISLAND_R : 130);

// ---------------------------------------------------------------------------
// THE PLAYABLE VOLUME
//
// There was already a fall-catch here — `pos.y < -180` in the controller — and
// it had never once saved anybody, for a reason that is worth writing down
// because it is the reason three rounds of "fixes" bounced off it.
//
// **It was a depth test on a system that has a mode with no depth budget.**
// Freefall reaches -180 m in about four seconds. Under the wing the sink rate
// is two metres a second, and the leash in locomotion.js pins you at
// `RIM() * 1.62` while you fly — so a cadet who walks off the north gate at
// nine metres and then does the one thing a panicking player always does (holds
// jump, which opens the wing) needs **ninety-five seconds** to fall far enough
// for the catch to notice. That is the whole of the reported failure: not a
// missing catch, a catch measuring the wrong quantity. A cold critic burned
// ninety seconds of movement, jumps, dash and glide inside that window and
// concluded, correctly, that the session was over.
//
// So the boundary is not a depth. It is the point of no return, and it is
// *provable*: nothing in this game manufactures height. The wing trades height
// for speed and clamps `vel.y` at +0.35 (see `_glide`), every updraft column
// stands on the island, and there is no ground outside the coastline. Therefore
// a cadet who is over open air and **below the lowest ground the island has**
// can never reach the island again, whatever they press.
//
// That is the test. It fires within a second or two of a real mistake, it can
// be reasoned about rather than tuned, and — the reason it is written this way
// rather than as a timer — it never touches a legitimate flight. Gliding out
// over the gulf from the Spine or off an updraft is an invited act and stays
// one, all the way to the verge, because you are still above ground you can
// still reach.
// ---------------------------------------------------------------------------

/**
 * Metres below the lowest reachable ground at which return becomes impossible.
 *
 * This was 8, and 8 was too generous by exactly the amount that made the promise
 * untrue. The lowest ground on this island IS the coast — 6.9 m — so a cadet who
 * walks off the shard starts falling from the very height the margin is measured
 * from, and under the wing he sinks at two metres a second. Eight metres of
 * margin is therefore four seconds of beige void before the catch will even
 * look, and the cold-play gate allows six seconds between leaving the world and
 * standing in it again. It was failing at 6.1 s, at y = −2, with the catch about
 * to fire: the fix was never a bigger catch, it was a margin that is not four
 * seconds of nothing.
 *
 * Three metres is still unarguably the point of no return. Nothing in this game
 * manufactures height outside an updraft column, every column stands on the
 * island, and there is no ground at all outside the coastline — so a cadet three
 * metres under the lowest ground he could possibly land on, over open air, is
 * exactly as unable to get back as one eight metres under it. The margin was
 * only ever there to keep the test off a legitimate low pass along the coast,
 * and that pass is over *ground*, where `heightAt` answers and this branch is
 * never reached. (world — smallest possible edit outside src/world; see report.)
 */
const DECK_MARGIN = 3;
/** Absolute backstop, far under everything, for states nobody has thought of. */
export const FLOOR = -420;

let _low = null;
let _lowAt = -1e9;
/**
 * Landing candidates: flat x, h, z triples on an 8 m lattice, built by the same
 * sweep that finds the lowest ground so the island is only ever walked once.
 * Declared here, beside the sweep that fills it, rather than beside the
 * function that reads it — see `reachFloor` for what it is for.
 */
let _pads = null;

/**
 * The lowest ground on the island, measured off the live heightfield rather
 * than written down. The world team reshapes this island regularly; a number
 * typed into the player would be wrong the first time they did, and wrong
 * silently. Sampled once, on the first frame that has a world to sample.
 *
 * IT IS NEVER FROZEN TO A DEFAULT, and that is the whole of a bug that made the
 * cold-play gate's edge-recovery step flaky for as long as it has existed.
 *
 * This used to allow eight attempts and then cache `0` for the rest of the
 * session. The eight attempts are spent during boot — `outsideWorld` reaches
 * here only when the heightfield answers null, which on the first few frames it
 * does because the island has not been built yet — so on any load slow enough
 * to burn them, `lowestGround()` was 0 for ever instead of 6.9, the point of no
 * return sat at −3 instead of +3.9, and a cadet under the wing needed five
 * extra seconds of sinking before the catch would even look at him. The gate
 * timed out at 6.1 s "at 166 m out, y = −3", which is that cached zero to the
 * metre. It passed or failed on how quickly the machine happened to boot.
 *
 * A time throttle costs the same handful of sweeps and cannot lie: while there
 * is no world the answer is the safe one and nothing is remembered, and the
 * first frame that has an island measures it and keeps it.
 * (world — second and last small edit outside src/world; see report.)
 */
export function lowestGround() {
  if (_low !== null) return _low;
  // Eight thousand probes is nothing twice a second and a disaster sixty times
  // a second, so a world that has not answered yet is asked again on a clock.
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - _lowAt < 500) return 0;
  _lowAt = now;
  const R = RIM() + 10;
  let lo = Infinity;
  const pads = [];
  let ix = 0;
  for (let x = -R; x <= R; x += 4, ix++) {
    let iz = 0;
    for (let z = -R; z <= R; z += 4, iz++) {
      const h = World.heightAt?.(x, z);
      if (typeof h === 'number' && Number.isFinite(h)) {
        if (h < lo) lo = h;
        // Every other sample on each axis: an 8 m lattice of places a cadet
        // could put his boots down. See `reachFloor` below for what it is for.
        if ((ix & 1) === 0 && (iz & 1) === 0) pads.push(x, h, z);
      }
    }
  }
  // No world yet: answer safely and do NOT cache, so the real island is
  // measured on a later frame instead of a default being frozen in.
  if (!Number.isFinite(lo)) return 0;
  _low = lo;
  _pads = new Float32Array(pads);
  return _low;
}

/** Below this, over open air, no cadet can ever get back. */
export function deck() { return lowestGround() - DECK_MARGIN; }

// ---------------------------------------------------------------------------
// HOW LONG A FALL IS ALLOWED TO LAST
//
// The catch above is correct and it is slow, and the slowness was costing the
// promise. `deck()` says *you can never get back from below the island's lowest
// ground*, which is true, and which a cadet who steps off a nine-metre coast
// with the wing open reaches after six seconds of sinking. The cold-play gate
// allows six. It was passing at 6.0 s and 5.99 s on the two runs that hold the
// jump button, which is to say it was passing on the coin toss, and a child who
// falls off the edge of a shard spent six seconds in a beige void wondering
// whether the game had ended.
//
// Six seconds is not a tuning problem. It is the same category of error the
// depth test was: **measuring something that only becomes true long after the
// thing it stands for.** Falling below the lowest ground on the island is
// *sufficient* proof that you cannot return. It was never *necessary*. A cadet
// forty metres out and two metres above the coast he just left cannot return
// either, and the game can know that immediately.
//
// So the test is now the actual question, asked directly: **is there anywhere
// left that this cadet could put his boots down?** The wing is the only thing
// in this game that converts height into distance, and it does so at a fixed,
// published rate — `glideBase` holds a steady sink against a steady airspeed
// (src/player/locomotion.js), about seven and a half metres of run per metre of
// drop. So a landing site at horizontal distance `d` and height `h` is reachable
// from `y` only while `y - h` exceeds `d / RUN`. Take the best site on the
// island and you have the floor beneath which no input can save you.
//
// This fires in about a second instead of six, it fires the same second every
// time — it is a fact about geometry, not a race against a sink rate — and it
// is *more* permissive than the old rule where being permissive matters: a
// cadet gliding down the outside of a sixty-metre cliff, whom a "below the
// lowest ground" rule would happily let float and a "toward the island" ray
// would wrongly condemn, is holding three hundred metres of glide and is left
// alone to use it.
// ---------------------------------------------------------------------------

/**
 * Metres of run per metre of drop under the wing.
 *
 * The real wing does about seven and a half to one — `glideBase` holds a −0.13
 * pitch, which is a steady sink of roughly 1.8 m/s against 14 m/s of airspeed
 * (src/player/locomotion.js). Nine is deliberately generous: this number decides
 * when the game overrules a player, and it should overrule him late rather than
 * early, so it credits him with a better wing than he is flying.
 */
const GLIDE_RUN = 9;

/**
 * …and the height a cadet spends turning round, which the ratio above does not
 * charge him for.
 *
 * A cadet over open air is, almost by definition, pointed AWAY from the island —
 * he just walked off it. Before any of that glide ratio is any use to him he has
 * to reverse course, and the wing turns at about 1.1–1.9 rad/s once the speed
 * penalty is taken (`glideTurn`, damped by airspeed): call it two seconds for a
 * half circle, at 1.8 m/s of sink, and the turn alone costs him some four metres
 * of height before he is even pointed home — plus the width of the turn itself,
 * which is more distance to cover.
 *
 * Six metres, and it is not a fudge factor. Without it the test says "reachable"
 * about a cadet who is drifting over the gulf a metre above a line he could only
 * hold by flying a perfect course he is not flying, which is exactly the state
 * the cold-play gate caught at 3.0 s and 148 m out: technically still airborne,
 * and to the child holding the jump button, lost.
 */
const GLIDE_MARGIN = 6;
let _floor = { x: 1e9, z: 1e9, at: -1e9, v: -Infinity };

/**
 * The lowest altitude from which this cadet can still reach ground, from here.
 *
 * Recomputed on a clock and only while he is over open air, because it is a few
 * hundred distance sums and the answer cannot change meaningfully inside a
 * fifth of a second at any speed this game can produce.
 */
export function reachFloor(x, z) {
  lowestGround();
  if (!_pads || !_pads.length) return deck();
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - _floor.at < 180 && Math.hypot(x - _floor.x, z - _floor.z) < 6) return _floor.v;
  let best = Infinity;
  for (let i = 0; i < _pads.length; i += 3) {
    const dx = _pads[i] - x, dz = _pads[i + 2] - z;
    const need = _pads[i + 1] + Math.sqrt(dx * dx + dz * dz) / GLIDE_RUN;
    if (need < best) best = need;
  }
  // …and whatever the cadet has BUILT, which the island's own lattice above
  // knows nothing about. A player who has run a deck out over the gulf has
  // manufactured ground, and being caught while his own platform is under his
  // wing would read as the game taking the shard's side. Local, because a piece
  // you can reach is a piece near you, and `heightAt` — unlike the sweep — sees
  // the build lattice (src/build).
  for (let b = 0; b < 8; b++) {
    const a = (b / 8) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    for (let d = 4; d <= 44; d += 8) {
      const hh = heightAt(x + cx * d, z + cz * d);
      if (hh === null) continue;
      const need = hh + d / GLIDE_RUN;
      if (need < best) best = need;
    }
  }
  const v = best + GLIDE_MARGIN;
  _floor = { x, z, at: now, v };
  return v;
}

/**
 * Is this point outside the playable volume?
 *
 * Returns the reason, or null. Two facts and a backstop:
 *   'fell'  — over open air, below the point of no return.
 *   'under' — inside the island's footprint but below its surface, i.e. through
 *             the world rather than off it. The critic's "beige void" was this:
 *             wedged against the untextured underside of the terrain.
 *   'void'  — under the absolute floor.
 */
export function outsideWorld(x, y, z) {
  if (y < FLOOR) return 'void';
  const h = heightAt(x, z);
  // Over open air. Two ways of being gone, and the cadet is gone on the first
  // of them to be true: nothing on the island is inside the wing's reach any
  // more (fast, and the one that fires in a real fall), or he is under the
  // lowest ground there is (the old proof, kept as a backstop that needs no
  // model of the wing at all).
  if (h === null) return (y < reachFloor(x, z) || y < deck()) ? 'fell' : null;
  // A whole body-height under the surface of the column you are in is not a
  // cave — this world has none — it is the inside of the terrain.
  if (y < h - 2.2) return 'under';
  return null;
}

/**
 * Is there anything under this cadet he could simply drop onto — within one
 * short hop sideways, and below him?
 *
 * This island has no holes in it. Sampled at two metres over the whole
 * playable square, every cell where the heightfield answers nothing is joined
 * to the open air outside the coastline: there is no interior gap, no crevasse
 * and no channel, so "over open air" means "off the shard" and never "between
 * two bits of it". That is what makes the fall test above it safe to make
 * aggressive.
 *
 * The one exception is ground the cadet MADE. A player who has run two decks
 * out over the gulf and hops from one to the other is over open air with the
 * wing shut and is not falling off anything, and `heightAt` — unlike the
 * island's own sweep — sees the build lattice. So the exception asks it.
 */
export function landingNear(x, y, z, r = 10) {
  for (let b = 0; b < 8; b++) {
    const a = (b / 8) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    for (let k = 1; k <= 2; k++) {
      const d = (r * k) / 2;
      const h = heightAt(x + cx * d, z + cz * d);
      if (h !== null && h < y + 1.5) return true;
    }
  }
  return false;
}

/** Ground height under a capsule of radius r — takes the highest nearby sample
 *  so you stand on top of a ridge instead of sinking into its side. */
export function groundUnder(x, z, r = 0) {
  if (r <= 0) return heightAt(x, z);
  let best = null;
  const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
  for (const [dx, dz] of pts) {
    const h = heightAt(x + dx, z + dz);
    if (h !== null && (best === null || h > best)) best = h;
  }
  return best;
}

const _g = new THREE.Vector2();
/** dH/dx, dH/dz — the fall line, used for slope gait and sliding. */
export function gradientAt(x, z, e = 0.9) {
  // A built deck is flat, and its lip is a cliff only to a finite-difference
  // probe. Sampling the heightfield across the edge of your own platform
  // reports a gradient of four metres over ninety centimetres, and the slide
  // response then shoves you off it — so a piece answers for its own fall line.
  if (SOLIDS) {
    const sg = SOLIDS.grad(x, z);
    if (sg) return _g.set(sg.x, sg.y);
  }
  const h = heightAt(x, z);
  if (h === null) return _g.set(0, 0);
  const hx = heightAt(x + e, z), hxn = heightAt(x - e, z);
  const hz = heightAt(x, z + e), hzn = heightAt(x, z - e);
  return _g.set(
    ((hx ?? h) - (hxn ?? h)) / (2 * e),
    ((hz ?? h) - (hzn ?? h)) / (2 * e),
  );
}

const _n = new THREE.Vector3();
export function normalAt(x, z, e = 0.9) {
  const g = gradientAt(x, z, e);
  return _n.set(-g.x, 1, -g.y).normalize();
}

export function slopeAt(x, z, e = 0.9) {
  const g = gradientAt(x, z, e);
  return Math.hypot(g.x, g.y);
}

export { VOID };
