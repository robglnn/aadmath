import { heightAt } from '../src/world/terrain.js';
const spots = JSON.parse(process.argv[2] || '[["spawn",0,26],["plaza",0,0],["plaza-w",-18,4],["plaza-e",16,-8]]');
const N = 144;
const prof = [];
for (let i = 0; i < N; i++) {
  const ang = (i / N) * Math.PI * 2 - Math.PI;
  let worst = -99;
  for (const [, ex, ez] of spots) {
    const ey = heightAt(ex, ez) + 1.7;
    const c = Math.cos(ang), s = Math.sin(ang);
    let best = -99;
    for (let r = 3; r < 400; r += 2) {
      const h = heightAt(ex + c * r, ez + s * r);
      if (h === null) continue;
      const t = Math.atan((h - ey) / r) * 180 / Math.PI;
      if (t > best) best = t;
    }
    if (best > worst) worst = best;
  }
  prof.push([(ang * 180 / Math.PI).toFixed(0), worst]);
}
for (const [a, v] of prof) {
  const n = Math.max(0, Math.round(v));
  console.log(String(a).padStart(5), v.toFixed(1).padStart(6), '#'.repeat(Math.min(n, 60)));
}
