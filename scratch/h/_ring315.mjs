import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, routeFrom, escapable } from '../../src/world/paths.js';
warmRoutes();
const T = { x: -13.253536854049788, z: -56.62779445202755 };
const th = (315/180)*Math.PI;
let x = T.x + Math.cos(th)*78, z = T.z + Math.sin(th)*78;
console.log('ring point', x.toFixed(1), z.toFixed(1), 'h', heightAt(x,z), 'esc', escapable(x,z));
if (heightAt(x,z) !== null && !escapable(x,z)) {
  let best = null;
  for (let r = 4; r <= 40 && !best; r += 4) for (let k = 0; k < 16; k++) {
    const t = (k/16)*Math.PI*2, cx = x + Math.cos(t)*r, cz = z + Math.sin(t)*r;
    if (heightAt(cx,cz) !== null && escapable(cx,cz)) { best = [cx,cz]; break; }
  }
  if (best) { x = best[0]; z = best[1]; }
}
console.log('placed at', x.toFixed(1), z.toFixed(1), 'h', (heightAt(x,z)??NaN).toFixed(1), 'esc', escapable(x,z));
const r = routeFrom(x, z, T.x, T.z);
const straight = Math.hypot(T.x-x, T.z-z);
console.log(`route ${r?r.metres.toFixed(0):'none'} m for ${straight.toFixed(0)} m = ${r?(r.metres/straight).toFixed(2):'-'}x`);
