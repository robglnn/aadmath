import { heightAt } from '../../src/world/terrain.js';
import { escapable, wayOut, routeFrom, headingTo, warmRoutes } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.25, z: -56.63 };
for (const [x, z] of [[29.4, -93.5], [44.4, -122.3], [15.1, -110.1], [29.4, -93.6], [30, -93], [28, -94]]) {
  const h = heightAt(x, z);
  const e = escapable(x, z);
  const hd = headingTo(x, z, T.x, T.z);
  const r = routeFrom(x, z, T.x, T.z);
  const w = wayOut(x, z);
  console.log(`(${x},${z}) h=${h === null ? 'null' : h.toFixed(1)} esc=${e} yaw=${hd.yaw.toFixed(2)} routed=${hd.routed} escaping=${!!hd.escaping} route=${r ? r.metres.toFixed(0) + 'm pts=' + r.points.length : 'NONE'} wayOut=${w ? w.yaw.toFixed(2) + '/' + w.metres.toFixed(0) : 'null'}`);
  if (r) console.log('   first pts:', r.points.slice(0, 5).map((p) => `${p[0].toFixed(0)},${p[2].toFixed(0)}`).join(' -> '));
  // what is the ground doing one metre along the advised bearing?
  for (const d of [1, 2, 3, 5]) {
    const nx = x + Math.sin(hd.yaw) * d, nz = z + Math.cos(hd.yaw) * d;
    const nh = heightAt(nx, nz);
    console.log(`   +${d}m -> (${nx.toFixed(1)},${nz.toFixed(1)}) h=${nh === null ? 'null' : nh.toFixed(1)} rise=${nh === null ? '-' : (nh - h).toFixed(2)} esc=${escapable(nx, nz)}`);
  }
}
