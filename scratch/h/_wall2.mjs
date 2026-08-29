import { heightAt } from '../../src/world/terrain.js';
import { routeFrom, warmRoutes, escapable } from '../../src/world/paths.js';
warmRoutes();
const SLOPE = 1.5, E = 0.7;
function grad(x, z) {
  const h = heightAt(x, z); if (h === null) return 0;
  const a = heightAt(x + E, z) ?? h, b = heightAt(x - E, z) ?? h;
  const c = heightAt(x, z + E) ?? h, d = heightAt(x, z - E) ?? h;
  return Math.hypot((a - b) / (2 * E), (c - d) / (2 * E));
}
const P = [[29.4, -93.5], [44.4, -122.3], [15.1, -110.1], [0, 0], [-13.25, -56.63]];
let walled = 0, walledHome = 0, total = 0;
for (const a of P) for (const b of P) {
  if (a === b) continue;
  const r = routeFrom(a[0], a[1], b[0], b[1]); if (!r) continue;
  for (let i = 1; i < r.cells.length; i++) {
    const [x0, , z0] = r.cells[i - 1], [x1, , z1] = r.cells[i];
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.5));
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      total++;
      if (grad(x, z) > SLOPE) { walled++; if (escapable(x, z)) walledHome++; }
    }
  }
}
console.log(`walled ${walled}/${total}; of those ${walledHome} are on ground that leads home, i.e. NO scramble is offered`);
