import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, headingTo, escapable, wayOut, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.25, z: -56.63 };
const E = 0.7;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x+E,z) ?? h, b = heightAt(x-E,z) ?? h, c = heightAt(x,z+E) ?? h, d = heightAt(x,z-E) ?? h;
  return Math.hypot((a-b)/(2*E), (c-d)/(2*E)); };
const P = [[40.7,-88.2],[40,-88],[41,-89],[39,-87]];
for (const [x,z] of P) {
  const hd = headingTo(x,z,T.x,T.z);
  const r = routeFrom(x,z,T.x,T.z);
  console.log(`(${x},${z}) h=${(heightAt(x,z)??NaN).toFixed(1)} grad=${(grad(x,z)??NaN).toFixed(2)} esc=${escapable(x,z)} yaw=${hd.yaw.toFixed(2)} escaping=${!!hd.escaping} route=${r?r.metres.toFixed(0)+'m':'none'}`);
  if (r) console.log('   first cells:', r.cells.slice(0,5).map(c=>`${c[0].toFixed(1)},${c[2].toFixed(1)}(h${c[1].toFixed(1)})`).join(' -> '));
  for (const d of [0.35,0.7,1.4,3,6]) {
    const nx = x + Math.sin(hd.yaw)*d, nz = z + Math.cos(hd.yaw)*d;
    console.log(`   +${d}m h=${(heightAt(nx,nz)??NaN).toFixed(1)} grad=${(grad(nx,nz)??NaN).toFixed(2)}`);
  }
}
