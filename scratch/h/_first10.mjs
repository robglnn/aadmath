/** The gate's 1d assertion, offline: does the first 10 m of the line home rise into a wall? */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { warmRoutes, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const E = 0.7, LIMIT = 1.5, STAND = 1.3;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x + E, z) ?? h, b = heightAt(x - E, z) ?? h, c = heightAt(x, z + E) ?? h, d = heightAt(x, z - E) ?? h;
  return Math.hypot((a - b) / (2 * E), (c - d) / (2 * E)); };
let tried = 0, noLine = 0, intoWall = 0; const bad = [];
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = 0; i < 200000 && tried < 400; i++) {
  const t = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 156;
  const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
  const g = grad(x, z); if (g === null || g > STAND) continue;
  if (Math.hypot(x, z) < 24) continue;
  tried++;
  const r = routeFrom(x, z, 0, 0);
  if (!r || r.cells.length < 2) { noLine++; continue; }
  let run = 0, hit = null;
  for (let k = 1; k < r.cells.length && run < 10; k++) {
    const [x0,,z0] = r.cells[k-1], [x1,,z1] = r.cells[k];
    const L = Math.hypot(x1-x0, z1-z0), n = Math.max(1, Math.ceil(L/0.35));
    let ph = heightAt(x0, z0);
    for (let m = 1; m <= n; m++) {
      const u = m/n, px = x0+(x1-x0)*u, pz = z0+(z1-z0)*u;
      const h = heightAt(px, pz), gg = grad(px, pz);
      if (ph !== null && h !== null && h - ph > 0.02 && gg !== null && gg > LIMIT) { hit = [+px.toFixed(0), +pz.toFixed(0), +gg.toFixed(2)]; break; }
      ph = h;
    }
    run += L; if (hit) break;
  }
  if (hit) { intoWall++; bad.push([+x.toFixed(0), +z.toFixed(0), 'into ' + hit.join('/')]); }
}
console.log(`tried ${tried}: noLine ${noLine}, intoWall ${intoWall}`);
console.log(bad.slice(0,6).map(b=>b.join(' ')).join(' · '));
