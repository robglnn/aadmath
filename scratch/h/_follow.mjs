/**
 * FOLLOW THE ADVICE. From every walkable cell on the island, walk toward the
 * target by repeatedly asking the world which way to go — the same call the
 * objective card and the trace on the ground both use — and see whether the
 * cadet ever arrives. Continuous position, one metre a step, 900 steps.
 * Blocked steps (a face steeper than the boots hold, and no scramble because
 * the ground leads home) stay put, which is what actually happens.
 */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { escapable, wayOut, headingTo, warmRoutes } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.25, z: -56.63 };
const CLIMB = 1.15;      // paths.js walk rule
const SCRAMBLE = 1e4;    // boots on one-way ground: no slope limit
const D = 1.0;
const MAX = 900;
const GRID = 6;
let starts = 0, arrived = 0;
const stuck = [];
for (let z = -ISLAND_R; z <= ISLAND_R; z += GRID) {
  for (let x = -ISLAND_R; x <= ISLAND_R; x += GRID) {
    if (heightAt(x, z) === null) continue;
    starts++;
    let px = x, pz = z, blocked = 0, worstBlock = 0;
    let i = 0;
    for (; i < MAX; i++) {
      if (Math.hypot(px - T.x, pz - T.z) < 8) break;
      const hd = headingTo(px, pz, T.x, T.z);
      const nx = px + Math.sin(hd.yaw) * D, nz = pz + Math.cos(hd.yaw) * D;
      const h0 = heightAt(px, pz), h1 = heightAt(nx, nz);
      if (h1 === null) { blocked++; worstBlock = Math.max(worstBlock, blocked); continue; }
      const lim = escapable(px, pz) ? CLIMB : SCRAMBLE;
      if (h1 - h0 > lim * D) { blocked++; worstBlock = Math.max(worstBlock, blocked); continue; }
      px = nx; pz = nz; blocked = 0;
    }
    if (Math.hypot(px - T.x, pz - T.z) < 8) arrived++;
    else stuck.push({ x, z, at: [+px.toFixed(1), +pz.toFixed(1)], steps: i, d: +Math.hypot(px - T.x, pz - T.z).toFixed(1) });
  }
}
console.log(`starts ${starts}  arrived ${arrived}  never ${stuck.length}`);
for (const s of stuck.slice(0, 30)) console.log(`  from ${s.x},${s.z} -> ended ${s.at} ${s.d} m short`);
