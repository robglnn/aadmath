/** Does the advice reverse under a single stride? */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { headingTo, warmRoutes } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.25, z: -56.63 };
const E = 0.7;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x + E, z) ?? h, b = heightAt(x - E, z) ?? h, c = heightAt(x, z + E) ?? h, d = heightAt(x, z - E) ?? h;
  return Math.hypot((a - b) / (2 * E), (c - d) / (2 * E)); };
let n = 0, flips = 0, worst = 0, at = null;
for (let z = -ISLAND_R; z <= ISLAND_R; z += 4) for (let x = -ISLAND_R; x <= ISLAND_R; x += 4) {
  const g = grad(x, z); if (g === null || g > 1.3) continue;
  if (Math.hypot(x - T.x, z - T.z) < 12) continue;
  const y0 = headingTo(x, z, T.x, T.z).yaw;
  for (let b = 0; b < 8; b++) {
    const a2 = (b / 8) * Math.PI * 2;
    const nx = x + Math.cos(a2) * 1.0, nz = z + Math.sin(a2) * 1.0;
    const g2 = grad(nx, nz); if (g2 === null || g2 > 1.3) continue;
    n++;
    const y1 = headingTo(nx, nz, T.x, T.z).yaw;
    let d = Math.abs(((y1 - y0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d > worst) { worst = d; at = [x, z]; }
    if (d > 2.09) flips++;   // 120 degrees
  }
}
console.log(`${n} one-metre steps sampled: ${flips} reverse the advice by over 120 deg (${(flips / n * 100).toFixed(3)}%), worst ${(worst * 180 / Math.PI).toFixed(0)} deg at ${(at || []).join(',')}`);
