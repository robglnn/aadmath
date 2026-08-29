import { coastRadius, PEAK, ISLAND_R } from '../../src/world/terrain.js';
const TURNS = 1.95, N = 72;
const a0 = Math.atan2(-PEAK.z, -PEAK.x);
let kmin = 1, at = null;
for (let i = 0; i <= N * 4; i++) {
  const t = i / (N * 4);
  const a = a0 + t * TURNS * Math.PI * 2;
  const rr = 66 - t * 49 + Math.sin(t * 11.0) * 2.2;
  // largest k with |PEAK + k*rr*(cos a, sin a)| <= coast(bearing) - margin
  for (const MARGIN of [16]) {
    let lo = 0, hi = 1;
    const ok = (k) => {
      const x = PEAK.x + Math.cos(a) * rr * k, z = PEAK.z + Math.sin(a) * rr * k;
      return Math.hypot(x, z) <= coastRadius(Math.atan2(z, x)) - MARGIN;
    };
    if (ok(1)) continue;
    for (let s = 0; s < 30; s++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    if (lo < kmin) { kmin = lo; at = { t: +t.toFixed(3), a: +a.toFixed(2), rr: +rr.toFixed(1) }; }
  }
}
console.log('kmin', kmin.toFixed(3), JSON.stringify(at));
// with that k, the extreme radius
let maxR = 0;
for (let i = 0; i <= N * 4; i++) {
  const t = i / (N * 4);
  const a = a0 + t * TURNS * Math.PI * 2;
  const rr = (66 - t * 49 + Math.sin(t * 11.0) * 2.2) * kmin;
  const x = PEAK.x + Math.cos(a) * rr, z = PEAK.z + Math.sin(a) * rr;
  const R = Math.hypot(x, z), C = coastRadius(Math.atan2(z, x));
  if (R - (C - 16) > maxR - 0) maxR = Math.max(maxR, R - (C - 16));
}
console.log('worst overshoot past (coast-16) after scaling:', maxR.toFixed(2));
