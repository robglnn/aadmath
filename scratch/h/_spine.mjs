import { heightAt, PEAK, ISLAND_R } from '../../src/world/terrain.js';
import { warmRoutes, escapable } from '../../src/world/paths.js';
warmRoutes();
const zones = { spine: 0, spineOne: 0, rest: 0, restOne: 0, high: 0, highOne: 0 };
for (let z = -ISLAND_R; z <= ISLAND_R; z += 2) for (let x = -ISLAND_R; x <= ISLAND_R; x += 2) {
  const h = heightAt(x, z); if (h === null) continue;
  const dp = Math.hypot(x - PEAK.x, z - PEAK.z);
  const e = escapable(x, z);
  if (dp < 60) { zones.spine++; if (!e) zones.spineOne++; }
  else { zones.rest++; if (!e) zones.restOne++; }
  if (h > 100) { zones.high++; if (!e) zones.highOne++; }
}
console.log(`Spine (within 60 m of the peak): ${zones.spineOne}/${zones.spine} one-way (${(zones.spineOne/zones.spine*100).toFixed(1)}%)`);
console.log(`everywhere else:                 ${zones.restOne}/${zones.rest} one-way (${(zones.restOne/zones.rest*100).toFixed(1)}%)`);
console.log(`above 100 m:                     ${zones.highOne}/${zones.high} one-way (${(zones.highOne/zones.high*100).toFixed(1)}%)`);
