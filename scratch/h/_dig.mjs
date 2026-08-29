import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { warmRoutes, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const E = 0.7;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x+E,z) ?? h, b = heightAt(x-E,z) ?? h, c = heightAt(x,z+E) ?? h, d = heightAt(x,z-E) ?? h;
  return Math.hypot((a-b)/(2*E), (c-d)/(2*E)); };
const r = routeFrom(-102, -57, 0, 0);
console.log('route', r.metres.toFixed(0), 'm,', r.cells.length, 'cells');
for (let k = 1; k < Math.min(r.cells.length, 20); k++) {
  const [x0,,z0] = r.cells[k-1], [x1,,z1] = r.cells[k];
  const near = Math.hypot((x0+x1)/2 + 97.7, (z0+z1)/2 + 50.1);
  if (near > 4) continue;
  console.log(`step ${k}: (${x0.toFixed(2)},${z0.toFixed(2)}) h=${heightAt(x0,z0).toFixed(2)} -> (${x1.toFixed(2)},${z1.toFixed(2)}) h=${heightAt(x1,z1).toFixed(2)}`);
  const L = Math.hypot(x1-x0,z1-z0), n = Math.max(1, Math.ceil(L/0.175));
  for (let j = 0; j <= n; j++) { const t=j/n, x=x0+(x1-x0)*t, z=z0+(z1-z0)*t;
    console.log(`   t=${t.toFixed(2)} (${x.toFixed(2)},${z.toFixed(2)}) h=${heightAt(x,z).toFixed(2)} grad=${grad(x,z).toFixed(2)}`); }
}
