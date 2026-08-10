import { heightAt } from '../src/world/terrain.js';
const [ex, ez, degs] = [Number(process.argv[2] || 0), Number(process.argv[3] || 0), process.argv[4]];
const ang = Number(degs) * Math.PI / 180;
const ey = heightAt(ex, ez) + 1.7;
console.log(`eye ${ey.toFixed(1)} at (${ex},${ez}) bearing ${degs}`);
const c = Math.cos(ang), s = Math.sin(ang);
let best = -9, bestR = 0;
for (let r = 2; r < 400; r += 2) {
  const x = ex + c * r, z = ez + s * r;
  const h = heightAt(x, z);
  if (h === null) { console.log(`  r=${r} OFF`); break; }
  const t = Math.atan((h - ey) / r) * 180 / Math.PI;
  if (t > best) { best = t; bestR = r; }
  if (r % 10 === 0) console.log(`  r=${String(r).padStart(3)} (${x.toFixed(0)},${z.toFixed(0)}) h=${h.toFixed(1)} ang=${t.toFixed(1)}`);
}
console.log(`horizon ${best.toFixed(1)}° at r=${bestR}`);
