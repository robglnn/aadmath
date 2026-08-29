/**
 * Does the world's own advice send a cadet into ground he cannot walk off?
 * Pure geometry, offline, no browser: for every walkable cell, take headingTo
 * toward the target, step one cell along it, and ask whether he has landed on
 * ground that leads home.
 */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { escapable, wayOut, routeFrom, headingTo, routeStats, warmRoutes } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.25, z: -56.63 };   // eval-expr on the shipping lattice
const STEP = 3;
let ground = 0, home = 0, off = 0, cycle = 0;
const bad = [];
for (let z = -ISLAND_R; z <= ISLAND_R; z += STEP) {
  for (let x = -ISLAND_R; x <= ISLAND_R; x += STEP) {
    const h = heightAt(x, z);
    if (h === null || !Number.isFinite(h)) continue;
    ground++;
    if (!escapable(x, z)) continue;
    home++;
    if (Math.hypot(x - T.x, z - T.z) < 10) continue;
    const hd = headingTo(x, z, T.x, T.z);
    const nx = x + Math.sin(hd.yaw) * STEP, nz = z + Math.cos(hd.yaw) * STEP;
    if (heightAt(nx, nz) === null) continue;         // off the island: the fall catch owns it
    if (escapable(nx, nz)) continue;
    off++;
    // and does the way out from there point straight back where he came from?
    const w = wayOut(nx, nz);
    if (w) {
      let d = ((w.yaw - hd.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(d) > 2.2) { cycle++; bad.push([x, z, +hd.yaw.toFixed(2), +w.yaw.toFixed(2)]); }
    }
  }
}
console.log(`ground ${ground}  home ${home}`);
console.log(`advice steps onto one-way ground from ${off} cells`);
console.log(`…and of those, ${cycle} are a straight there-and-back cycle`);
console.log(bad.slice(0, 20).map((b) => b.join(',')).join('  |  '));
