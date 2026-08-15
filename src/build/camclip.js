/**
 * THE LENS AND THE CADET'S OWN WALLS.
 *
 * The camera keeps itself out of the world in two ways, and a wall the player
 * built defeated both.
 *
 *  - **The boom sweep** raycasts a list of scene meshes gathered every 0.35 s.
 *    A lattice wall is an `InstancedMesh`, so it survives that filter — but the
 *    sweep runs from the cadet *outward along the boom*, and a wall standing
 *    beside him is not on that line at all. Stand with your shoulder against a
 *    panel and the boom points down the street, hits nothing, and puts the lens
 *    a metre and a half sideways: inside the wall.
 *  - **The de-penetration** asks `heightAt`, which for a wall answers "the top
 *    of it, four metres up". So it did not push the lens *out of* the wall, it
 *    tried to lift it *onto* it — and the hard floor a few lines earlier had
 *    already done the same to the target. The frame filled with the black
 *    inside of a panel and no input got you out of it, which is exactly the
 *    failure the island's rocks were fixed for and the built lattice was not.
 *
 * A wall is not a heightfield. It is a box on an exact grid, and the builder
 * already holds every one of them, so both answers here are analytic: a slab
 * march for the boom, and a smallest-translation shove for the pixel that
 * ships. Neither allocates and neither touches the renderer.
 *
 * Only *face* pieces block. A deck over the lens is a roof, and shortening the
 * boom for one would jam the camera into the cadet's neck every time he walked
 * under his own bridge.
 */

/** @type {import('./solids.js').Solids|null} */
let S = null;

/** Registered once by main.js, the same way the boots get their surfaces. */
export function setCamSolids(s) { S = s; }

/**
 * How far the boom may travel from `rig` along `dir` before it enters built
 * structure, or `Infinity`. `pad` is the lens's own girth.
 */
export function camMarch(ox, oy, oz, dx, dy, dz, far, pad = 0.26) {
  if (!S || !S.count) return Infinity;
  return S.march(ox, oy, oz, dx, dy, dz, far, pad);
}

/**
 * Move `p` out of any built structure it is inside, preferring to slide along
 * the wall's normal — the shortest way out of a panel is always through its
 * face, and pulling the lens all the way back to the cadet for a wall it is
 * two centimetres inside of would be a visible jolt on every brush past one.
 *
 * `rig` is the cadet, which is by construction a place the lens may be, so the
 * fallback of walking in toward him always terminates.
 *
 * @returns {boolean} true if `p` was moved
 */
export function camClear(p, rig, r = 0.24) {
  if (!S || !S.count) return false;
  let moved = false;
  for (let i = 0; i < 3; i++) {
    if (!S.pushOut(p.x, p.y, p.z, r, _out, 0.30, 0)) break;
    p.x += _out.x; p.z += _out.z;
    moved = true;
  }
  // Still buried — a lens wedged between two panels of a corner has no sideways
  // way out. Walk it in toward the cadet, who is standing somewhere legal.
  if (S.contains(p.x, p.y, p.z, r * 0.6)) {
    const dx = rig.x - p.x, dy = rig.y - p.y, dz = rig.z - p.z;
    for (let i = 1; i <= 6; i++) {
      const u = i / 6;
      const x = p.x + dx * u, y = p.y + dy * u, z = p.z + dz * u;
      if (!S.contains(x, y, z, r * 0.6)) { p.set(x, y, z); return true; }
    }
    p.set(rig.x, rig.y, rig.z);
    return true;
  }
  return moved;
}

const _out = { x: 0, y: 0, z: 0 };
