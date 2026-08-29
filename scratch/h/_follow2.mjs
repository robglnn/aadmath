/**
 * FOLLOW THE ADVICE, with the boots' own step. From every standable cell on the
 * island, walk toward the target by asking the world which way to go — 20 cm a
 * step, per-axis wall resolution, the same _blocked rule locomotion.js uses.
 */
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { headingTo, warmRoutes, escapable } from '../../src/world/paths.js';
warmRoutes();
const T = JSON.parse(process.env.T || '{"x":-13.25,"z":-56.63}');
const E = 0.7, SLOPE = 1.5, SCRAMBLE = 1e4, STEP_UP = 0.55, SLIDE = 1.3;
const D = 0.2, MAX = Number(process.env.MAX || 3000), GRID = Number(process.env.GRID || 6);
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return NaN;
  const a = heightAt(x + E, z) ?? h, b = heightAt(x - E, z) ?? h, c = heightAt(x, z + E) ?? h, d = heightAt(x, z - E) ?? h;
  return Math.hypot((a - b) / (2 * E), (c - d) / (2 * E)); };
const blocked = (x, z, py, scr) => {
  const h = heightAt(x, z); if (h === null) return true;
  const rise = h - py; if (rise <= 0.03) return false;
  if (rise > (scr ? 1.35 : STEP_UP)) return true;
  return grad(x, z) > (scr ? SCRAMBLE : SLOPE);
};
let starts = 0, arrived = 0;
const stuck = [];
for (let z = -ISLAND_R; z <= ISLAND_R; z += GRID) for (let x = -ISLAND_R; x <= ISLAND_R; x += GRID) {
  const h0 = heightAt(x, z); if (h0 === null) continue;
  if (grad(x, z) > SLIDE) continue;         // he could not be standing still here
  starts++;
  let px = x, pz = z, py = h0, i = 0;
  for (; i < MAX; i++) {
    if (Math.hypot(px - T.x, pz - T.z) < 8) break;
    const hd = headingTo(px, pz, T.x, T.z);
    const scr = !escapable(px, pz);
    const dx = Math.sin(hd.yaw) * D, dz = Math.cos(hd.yaw) * D;
    let nx = px + dx, nz = pz + dz;
    if (blocked(nx, nz, py, scr)) {
      if (Math.abs(dx) > 0.02 && !blocked(px + dx, pz, py, scr)) { nx = px + dx; nz = pz; }
      else if (Math.abs(dz) > 0.02 && !blocked(px, pz + dz, py, scr)) { nx = px; nz = pz + dz; }
      else { nx = px; nz = pz; }
    }
    px = nx; pz = nz;
    // the ground sheds him: locomotion.js pushes down the fall line above
    // P.slideLimit, unless the world has hold of him and he is scrambling
    const gg = grad(px, pz);
    if (!scr && gg > SLIDE) {
      const h = heightAt(px, pz);
      const gx = ((heightAt(px + E, pz) ?? h) - (heightAt(px - E, pz) ?? h)) / (2 * E);
      const gz2 = ((heightAt(px, pz + E) ?? h) - (heightAt(px, pz - E) ?? h)) / (2 * E);
      const m = Math.hypot(gx, gz2) || 1;
      // the slide is a force (vel -= g*15*dt) against P.accel = 46, not a veto
      const k = Math.min(1, (gg * 15) / 46);
      px -= (gx / m) * D * k; pz -= (gz2 / m) * D * k;
    }
    const hh = heightAt(px, pz); if (hh !== null) py = hh;
  }
  if (Math.hypot(px - T.x, pz - T.z) < 8) arrived++;
  else stuck.push({ x, z, at: [+px.toFixed(1), +pz.toFixed(1)], d: +Math.hypot(px - T.x, pz - T.z).toFixed(1), i });
}
console.log(`standable starts ${starts}  arrived ${arrived} (${(arrived / starts * 100).toFixed(1)}%)  never ${stuck.length}`);
const cl = {};
for (const s of stuck) { const k = `${Math.round(s.at[0] / 10) * 10},${Math.round(s.at[1] / 10) * 10}`; cl[k] = (cl[k] || 0) + 1; }
console.log('ends at:', Object.entries(cl).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}x${v}`).join('  '));
for (const s2 of stuck.slice(0, 14)) console.log(`  start ${s2.x},${s2.z} -> ended ${s2.at.join(",")} ${s2.d} m short after ${s2.i} steps`);
