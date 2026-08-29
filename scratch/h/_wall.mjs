/**
 * THE ROUTE'S PROMISE AGAINST THE BOOTS' OWN RULE.
 *
 * The planner works on a 3 m lattice; the boots read the heightfield at
 * sub-metre scale and refuse anything whose gradient (measured over 0.7 m, the
 * way src/player/locomotion.js measures it) is over 1.5. So walk the routed
 * line at half a metre and count the places the game sends a cadet into a face
 * his boots will not take.
 */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { routeFrom, warmRoutes, escapable } from '../../src/world/paths.js';
warmRoutes();
const SLOPE = 1.5, E = 0.7;
function grad(x, z) {
  const h = heightAt(x, z); if (h === null) return 0;
  const a = heightAt(x + E, z) ?? h, b = heightAt(x - E, z) ?? h;
  const c = heightAt(x, z + E) ?? h, d = heightAt(x, z - E) ?? h;
  return Math.hypot((a - b) / (2 * E), (c - d) / (2 * E));
}
// the ten tears of the shipping lattice, read off the running game once
const RIFTS = JSON.parse(process.env.RIFTS || 'null') || [
  { id: 'plaza', x: 0, z: 0 },
];
const legs = [];
for (const a of RIFTS) for (const b of RIFTS) if (a.id !== b.id) legs.push([a, b]);
let walled = 0, total = 0;
const worst = [];
for (const [a, b] of legs) {
  const r = routeFrom(a.x, a.z, b.x, b.z);
  if (!r) { console.log(`NO ROUTE ${a.id}->${b.id}`); continue; }
  let runWall = 0, maxWall = 0, at = null;
  for (let i = 1; i < r.cells.length; i++) {
    const [x0, , z0] = r.cells[i - 1], [x1, , z1] = r.cells[i];
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(L / 0.5));
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      total++;
      if (grad(x, z) > SLOPE) {
        walled++; runWall += L / n;
        if (runWall > maxWall) { maxWall = runWall; at = [+x.toFixed(1), +z.toFixed(1), +grad(x, z).toFixed(2)]; }
      } else runWall = 0;
    }
  }
  if (maxWall > 0) worst.push({ leg: `${a.id}->${b.id}`, m: +maxWall.toFixed(1), at, route: Math.round(r.metres) });
}
worst.sort((p, q) => q.m - p.m);
console.log(`routed samples ${total}, over the boots' slope limit ${walled} (${(walled / total * 100).toFixed(2)}%)`);
console.log(`legs with a wall on them: ${worst.length}/${legs.length}`);
for (const w of worst.slice(0, 15)) console.log(`  ${w.leg.padEnd(30)} ${w.m} m of continuous wall at ${w.at.join(', ')} (route ${w.route} m)`);
