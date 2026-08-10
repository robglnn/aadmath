// Trace the horizon angle from a standing eye position, and compare it to the
// elevation angle of each far land. Positive margin = the far land is visible.
import { heightAt, coastRadius, PLAZA_Y, PEAK, PEAK2 } from '../src/world/terrain.js';
import { FARLANDS } from '../src/world/farlands.js';

const EYE = 1.7;

function horizonAt(ex, ey, ez, ang) {
  const cx = Math.cos(ang), cz = Math.sin(ang);
  let best = -1;
  for (let r = 2; r < 420; r += 1.5) {
    const x = ex + cx * r, z = ez + cz * r;
    const h = heightAt(x, z);
    if (h === null) continue;      // off the island: sea/air
    const t = (h - ey) / r;
    if (t > best) { best = t; }
  }
  return Math.atan(best) * 180 / Math.PI;
}

const spots = process.argv[2] ? JSON.parse(process.argv[2]) : [
  ['plaza', 0, 0],
  ['plaza-N', 0, -30],
  ['gate-lip', -4, -140],
  ['reach-top', PEAK.x, PEAK.z],
  ['peak2', PEAK2.x, PEAK2.z],
];

for (const [name, x, z] of spots) {
  const g = heightAt(x, z);
  if (g === null) { console.log(`${name}: OFF ISLAND`); continue; }
  const ey = g + EYE;
  console.log(`\n== ${name} (${x},${z})  ground ${g.toFixed(1)}  eye ${ey.toFixed(1)}`);
  for (const F of FARLANDS) {
    const dx = F.cx - x, dz = F.cz - z;
    const d = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const topY = F.cy + F.H;
    const elevTop = Math.atan((topY - ey) / d) * 180 / Math.PI;
    const elevBase = Math.atan((F.cy + F.H * 0.15 - ey) / d) * 180 / Math.PI;
    const hz = horizonAt(x, ey, z, ang);
    const bearing = (ang * 180 / Math.PI).toFixed(0);
    const vis = elevTop - hz;
    console.log(`  ${F.id.padEnd(8)} brg ${String(bearing).padStart(5)}  top ${elevTop.toFixed(1)}°  base ${elevBase.toFixed(1)}°  ridge ${hz.toFixed(1)}°  -> ${vis > 0 ? 'VISIBLE +' + vis.toFixed(1) : 'HIDDEN ' + vis.toFixed(1)}${elevBase - hz > 0 ? ' (full)' : ''}`);
  }
}
