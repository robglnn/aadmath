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

export function heightAt(x, z) {
  const h = World.heightAt?.(x, z);
  const g = typeof h === 'number' && Number.isFinite(h) ? h : null;
  if (SOLIDS) {
    const s = SOLIDS.top(x, z);
    if (s !== null && (g === null || s > g)) return s;
  }
  return g;
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
  for (let x = -R; x <= R; x += 4) {
    for (let z = -R; z <= R; z += 4) {
      const h = World.heightAt?.(x, z);
      if (typeof h === 'number' && Number.isFinite(h) && h < lo) lo = h;
    }
  }
  // No world yet: answer safely and do NOT cache, so the real island is
  // measured on a later frame instead of a default being frozen in.
  if (!Number.isFinite(lo)) return 0;
  _low = lo;
  return _low;
}

/** Below this, over open air, no cadet can ever get back. */
export function deck() { return lowestGround() - DECK_MARGIN; }

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
  if (h === null) return y < deck() ? 'fell' : null;
  // A whole body-height under the surface of the column you are in is not a
  // cave — this world has none — it is the inside of the terrain.
  if (y < h - 2.2) return 'under';
  return null;
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
