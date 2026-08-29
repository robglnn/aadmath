import { heightAt, PEAK, ISLAND_R } from '../../src/world/terrain.js';
const E = 0.7;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return NaN;
  const a = heightAt(x + E, z) ?? h, b = heightAt(x - E, z) ?? h, c = heightAt(x, z + E) ?? h, d = heightAt(x, z - E) ?? h;
  return Math.hypot((a - b) / (2 * E), (c - d) / (2 * E)); };
const a0 = Math.atan2(-PEAK.z, -PEAK.x);
const TURNS = 1.95;
console.log(' t     x       z       h      grad   h(+3m out)  h(-3m in)');
for (let i = 0; i <= 60; i++) {
  const t = i / 60;
  const a = a0 + t * TURNS * Math.PI * 2;
  const rr = 66 - t * 49 + Math.sin(t * 11.0) * 2.2;
  const x = PEAK.x + Math.cos(a) * rr, z = PEAK.z + Math.sin(a) * rr;
  const h = heightAt(x, z);
  const ho = heightAt(PEAK.x + Math.cos(a) * (rr + 3), PEAK.z + Math.sin(a) * (rr + 3));
  const hi = heightAt(PEAK.x + Math.cos(a) * (rr - 3), PEAK.z + Math.sin(a) * (rr - 3));
  console.log(`${t.toFixed(2)}  ${x.toFixed(1).padStart(6)} ${z.toFixed(1).padStart(7)}  ${(h ?? NaN).toFixed(1).padStart(6)}  ${grad(x, z).toFixed(2).padStart(5)}   ${(ho ?? NaN).toFixed(1).padStart(6)}   ${(hi ?? NaN).toFixed(1).padStart(6)}`);
}
