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
