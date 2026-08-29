/** Walk the routed bearing the way the boots walk it, from the gate's own ring. */
import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, headingTo, escapable } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.253536854049788, z: -56.62779445202755 };
const E = 0.7, LIMIT = 1.5;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x+E,z) ?? h, b = heightAt(x-E,z) ?? h, c = heightAt(x,z+E) ?? h, d = heightAt(x,z-E) ?? h;
  return Math.hypot((a-b)/(2*E), (c-d)/(2*E)); };
const blocked = (x, z, py, scr) => { const h = heightAt(x, z); if (h === null) return false;
  if (h - py <= 0.03) return false; if (h - py > (scr ? 1.35 : 0.55)) return true;
  if (scr) return false;
  const g = grad(x, z); return g !== null && g > LIMIT; };
let bad = 0, n = 0;
for (let b = 0; b < 12; b++) {
  const th = (b/12)*Math.PI*2;
  const sx = T.x + Math.cos(th)*62, sz = T.z + Math.sin(th)*62;
  if (heightAt(sx,sz) === null) continue;
  n++;
  const yaw = headingTo(sx, sz, T.x, T.z).yaw;
  const scr = !escapable(sx, sz);
  let px = sx, pz = sz, py = heightAt(sx,sz);
  const dx = Math.sin(yaw)*0.05, dz = Math.cos(yaw)*0.05;
  for (let k = 0; k < 280; k++) {
    let nx = px+dx, nz = pz+dz;
    if (blocked(nx,nz,py,scr)) {
      if (!blocked(px+dx,pz,py,scr)) { nx = px+dx; nz = pz; }
      else if (!blocked(px,pz+dz,py,scr)) { nx = px; nz = pz+dz; }
      else { nx = px; nz = pz; }
    }
    px = nx; pz = nz; const h = heightAt(px,pz); if (h !== null) py = h;
  }
  const got = Math.hypot(px-sx, pz-sz);
  if (got < 3) { bad++; console.log(`  ${Math.round(th*180/Math.PI)}deg from ${sx.toFixed(0)},${sz.toFixed(0)} -> only ${got.toFixed(1)} m in 14 m of walking`); }
}
console.log(`${n} bearings, ${bad} go nowhere`);
