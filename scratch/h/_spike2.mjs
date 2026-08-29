/** Refusals vs drops on the routed lines, separated the way _blocked separates them. */
import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const EE = 0.7;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x + EE, z) ?? h, b = heightAt(x - EE, z) ?? h, c = heightAt(x, z + EE) ?? h, d = heightAt(x, z - EE) ?? h;
  return Math.hypot((a - b) / (2 * EE), (c - d) / (2 * EE)); };
const R = [['plaza',0,0],['var-meaning',-1,-27],['eval-expr',-13,-57],['order-ops',-31,-93],['like-terms',-43,-45],
  ['distribute',-77,-46],['one-step-add',28,-28],['one-step-mul',54,-36],['two-step',-39,-119],['multi-step',6,-124],['both-sides',-4,-97]];
let total=0, refuse=0, worstR=0, atR=null, legsR=new Set(), maxDrop=0, atD=null, legsD=new Set(), legs=0, metres=0;
for (const [an,ax,az] of R) for (const [bn,bx,bz] of R) {
  if (an===bn) continue; legs++;
  const r = routeFrom(ax,az,bx,bz); if(!r) continue;
  metres += r.metres;
  for (let i=1;i<r.cells.length;i++){
    const [x0,,z0]=r.cells[i-1],[x1,,z1]=r.cells[i];
    const L=Math.hypot(x1-x0,z1-z0), n=Math.max(1,Math.ceil(L/0.35));
    let ph = heightAt(x0,z0);
    // biggest single drop on this leg, cell to cell
    const dh = (heightAt(x0,z0) ?? 0) - (heightAt(x1,z1) ?? 0);
    if (dh > maxDrop) { maxDrop = dh; atD = [+x1.toFixed(1), +z1.toFixed(1)]; legsD.add(`${an}->${bn}`); }
    for(let k=1;k<=n;k++){
      const t=k/n,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;total++;
      const h = heightAt(x,z);
      const rise = (h===null||ph===null) ? 0 : h - ph;
      const g=grad(x,z);
      if (g!==null && g>1.5 && rise > 0.02) { refuse++; if(g>worstR){worstR=g;atR=[+x.toFixed(1),+z.toFixed(1)];} legsR.add(`${an}->${bn}`); }
      ph = h;
    }
  }
}
console.log(`${legs} legs, ${Math.round(metres)} m of routed line, ${total} samples at 0.35 m`);
console.log(`  RISING into a face the boots refuse: ${refuse} (${(refuse/total*100).toFixed(3)}%), ${legsR.size} legs, worst ${worstR.toFixed(2)} at ${(atR||[]).join(',')}`);
console.log(`  biggest single step DOWN on any routed line: ${maxDrop.toFixed(2)} m at ${(atD||[]).join(',')}`);
