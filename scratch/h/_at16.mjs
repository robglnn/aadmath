import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, headingTo, escapable, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.253536854049788, z: -56.62779445202755 };
const E = 0.7, LIMIT = 1.5;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x+E,z) ?? h, b = heightAt(x-E,z) ?? h, c = heightAt(x,z+E) ?? h, d = heightAt(x,z-E) ?? h;
  return Math.hypot((a-b)/(2*E), (c-d)/(2*E)); };
for (const [x,z] of [[16,-111],[16.5,-111.5],[15,-110],[17,-112]]) {
  const scr = !escapable(x,z);
  const hd = headingTo(x,z,T.x,T.z);
  const r = routeFrom(x,z,T.x,T.z);
  const blocked = (bx,bz,py) => { const h = heightAt(bx,bz); if (h===null) return false;
    if (h-py <= 0.03) return false; if (h-py > (scr?1.35:0.55)) return true;
    if (scr) return false; const g = grad(bx,bz); return g!==null && g>LIMIT; };
  let px=x, pz=z, py=heightAt(x,z);
  const dx=Math.sin(hd.yaw)*0.05, dz=Math.cos(hd.yaw)*0.05;
  for (let k=0;k<280;k++){ let nx=px+dx,nz=pz+dz;
    if (blocked(nx,nz,py)) { if(!blocked(px+dx,pz,py)){nx=px+dx;nz=pz;} else if(!blocked(px,pz+dz,py)){nx=px;nz=pz+dz;} else {nx=px;nz=pz;} }
    px=nx;pz=nz;const h=heightAt(px,pz); if(h!==null)py=h; }
  console.log(`(${x},${z}) h=${(heightAt(x,z)??NaN).toFixed(1)} grad=${(grad(x,z)??NaN).toFixed(2)} esc=${!scr} yaw=${hd.yaw.toFixed(2)} escaping=${!!hd.escaping} route=${r?r.metres.toFixed(0)+'m':'none'} -> covered ${Math.hypot(px-x,pz-z).toFixed(1)} m in 14 m of walking`);
}
