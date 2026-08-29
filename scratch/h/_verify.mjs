import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, routeStats, routeFrom, headingTo, escapable, wayOut } from '../../src/world/paths.js';
const EE = 0.7;
const worstGrade = (ax, az, bx, bz) => {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.35));
  let w = 0;
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const h = heightAt(x, z); if (h === null) continue;
    const a2 = heightAt(x + EE, z) ?? h, b2 = heightAt(x - EE, z) ?? h;
    const c2 = heightAt(x, z + EE) ?? h, d2 = heightAt(x, z - EE) ?? h;
    const g = Math.hypot((a2 - b2) / (2 * EE), (c2 - d2) / (2 * EE));
    if (g > w) w = g;
  }
  return w;
};
let t0 = performance.now();
warmRoutes();
console.log(`build ${(performance.now() - t0).toFixed(0)} ms`);
console.log(JSON.stringify(routeStats(), null, 1));
const P = [['plaza', 0, 0], ['var-meaning', 0, 26], ['eval-expr', -13.25, -56.63], ['A', 29.4, -93.5], ['B', 44.4, -122.3], ['C', 15.1, -110.1], ['mesa', 30, 104], ['grove', -108, -8], ['henge', -84, 74], ['summit', 68, -93]];
let worstAll = 0, legs = 0, none = 0, tField = 0;
for (const [an, ax, az] of P) for (const [bn, bx, bz] of P) {
  if (an === bn) continue;
  const t1 = performance.now();
  const r = routeFrom(ax, az, bx, bz);
  tField += performance.now() - t1;
  legs++;
  if (!r) { console.log(`NO ROUTE ${an}->${bn}`); none++; continue; }
  let w = 0;
  for (let i = 1; i < r.cells.length; i++) w = Math.max(w, worstGrade(r.cells[i-1][0], r.cells[i-1][2], r.cells[i][0], r.cells[i][2]));
  if (w > worstAll) worstAll = w;
  const straight = Math.hypot(bx-ax, bz-az);
  const endD = Math.hypot(r.cells[r.cells.length-1][0]-bx, r.cells[r.cells.length-1][2]-bz);
  if (w > 1.31 || endD > 6) console.log(`  ${an}->${bn}: ${r.metres.toFixed(0)}m (straight ${straight.toFixed(0)}) worst grade ${w.toFixed(2)} endsAt ${endD.toFixed(1)}m from goal`);
}
console.log(`\n${legs} legs, ${none} with no route, worst grade on any routed line ${worstAll.toFixed(2)} (bar ${1.30})`);
console.log(`route calls total ${tField.toFixed(0)} ms for ${legs}`);
// detour factor
let det = [];
for (const [an, ax, az] of P) for (const [bn, bx, bz] of P) {
  if (an === bn) continue;
  const r = routeFrom(ax, az, bx, bz); if (!r) continue;
  det.push(r.metres / Math.max(1, Math.hypot(bx-ax, bz-az)));
}
det.sort((a,b)=>a-b);
console.log(`detour: median ${det[det.length>>1].toFixed(2)}x  worst ${det[det.length-1].toFixed(2)}x`);
// escapable / summit
for (const [n, x, z] of P) console.log(`  ${n.padEnd(12)} escapable=${escapable(x,z)} wayOut=${JSON.stringify(wayOut(x,z))}`);
