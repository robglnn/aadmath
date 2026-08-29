import { heightAt } from '../../src/world/terrain.js';
import { headingTo, warmRoutes, escapable, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.25, z: -56.63 };
const E = 0.7;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return NaN;
  const a = heightAt(x + E, z) ?? h, b = heightAt(x - E, z) ?? h, c = heightAt(x, z + E) ?? h, d = heightAt(x, z - E) ?? h;
  return Math.hypot((a - b) / (2 * E), (c - d) / (2 * E)); };
const blocked = (x, z, py, scr) => { const h = heightAt(x, z); if (h === null) return true;
  const rise = h - py; if (rise <= 0.03) return false; if (rise > (scr ? 1.35 : 0.55)) return true;
  return grad(x, z) > (scr ? 1e4 : 1.5); };
const start = JSON.parse(process.env.S || '[36,-30]');
let px = start[0], pz = start[1], py = heightAt(px, pz);
const D = 0.2;
for (let i = 0; i < 2000; i++) {
  if (Math.hypot(px - T.x, pz - T.z) < 8) { console.log('ARRIVED at step', i); break; }
  const hd = headingTo(px, pz, T.x, T.z);
  const scr = !escapable(px, pz);
  const dx = Math.sin(hd.yaw) * D, dz = Math.cos(hd.yaw) * D;
  let nx = px + dx, nz = pz + dz, how = 'full';
  if (blocked(nx, nz, py, scr)) {
    if (!blocked(px + dx, pz, py, scr)) { nx = px + dx; nz = pz; how = 'x'; }
    else if (!blocked(px, pz + dz, py, scr)) { nx = px; nz = pz + dz; how = 'z'; }
    else { nx = px; nz = pz; how = 'STUCK'; }
  }
  if (i % 50 === 0 || how === 'STUCK') {
    const r = routeFrom(px, pz, T.x, T.z);
    console.log(`${String(i).padStart(4)} at ${px.toFixed(1)},${pz.toFixed(1)} h=${py.toFixed(1)} grad=${grad(px,pz).toFixed(2)} yaw=${hd.yaw.toFixed(2)} routed=${hd.routed} esc=${!scr} ${how} route=${r? r.metres.toFixed(0)+'m cells='+r.cells.length : 'none'} d=${Math.hypot(px-T.x,pz-T.z).toFixed(1)}`);
    if (how === 'STUCK' && r) console.log('    next cells:', r.cells.slice(0,6).map(c=>`${c[0].toFixed(1)},${c[2].toFixed(1)}(h${c[1].toFixed(1)})`).join(' -> '));
    if (how === 'STUCK') break;
  }
  px = nx; pz = nz;
  const hh = heightAt(px, pz); if (hh !== null) py = hh;
}
