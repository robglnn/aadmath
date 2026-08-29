import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const E = 0.7, LIMIT = 1.5;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x+E,z) ?? h, b = heightAt(x-E,z) ?? h, c = heightAt(x,z+E) ?? h, d = heightAt(x,z-E) ?? h;
  return Math.hypot((a-b)/(2*E), (c-d)/(2*E)); };
let bad = 0, n = 0;
for (let dx = -2; dx <= 2; dx += 0.5) for (let dz = -2; dz <= 2; dz += 0.5) {
  const x = -102 + dx, z = -57 + dz;
  if (heightAt(x,z) === null) continue;
  const g = grad(x,z); if (g === null || g > 1.3) continue;
  n++;
  const r = routeFrom(x, z, 0, 0); if (!r) { bad++; continue; }
  let run = 0, hit = null;
  for (let k = 1; k < r.cells.length && run < 10; k++) {
    const [x0,,z0]=r.cells[k-1], [x1,,z1]=r.cells[k];
    const L = Math.hypot(x1-x0,z1-z0), m = Math.max(1, Math.ceil(L/0.35));
    let ph = heightAt(x0,z0);
    for (let j = 1; j <= m; j++) { const u=j/m, px=x0+(x1-x0)*u, pz=z0+(z1-z0)*u;
      const h=heightAt(px,pz), gg=grad(px,pz);
      if (ph!==null&&h!==null&&h-ph>0.02&&gg!==null&&gg>LIMIT){hit=[px.toFixed(1),pz.toFixed(1),gg.toFixed(2)];break;} ph=h; }
    run += L; if (hit) break;
  }
  if (hit) { bad++; console.log(`  (${x.toFixed(1)},${z.toFixed(1)}) -> into ${hit.join('/')}`); }
}
console.log(`${n} standable places round (-102,-57): ${bad} whose first 10 m rises into a refused face`);
