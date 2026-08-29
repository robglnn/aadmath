import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const EE = 0.7;
const grad = (x, z) => { const h = heightAt(x, z); if (h === null) return null;
  const a = heightAt(x + EE, z) ?? h, b = heightAt(x - EE, z) ?? h, c = heightAt(x, z + EE) ?? h, d = heightAt(x, z - EE) ?? h;
  return Math.hypot((a - b) / (2 * EE), (c - d) / (2 * EE)); };
const R = [['plaza',0,0],['var-meaning',-1,-27],['eval-expr',-13,-57],['order-ops',-31,-93],['like-terms',-43,-45],
  ['distribute',-77,-46],['one-step-add',28,-28],['one-step-mul',54,-36],['two-step',-39,-119],['multi-step',6,-124],['both-sides',-4,-97]];
for (const step of [0.7, 0.35, 0.15]) {
  let total=0, over=0, worst=0, at=null, legs=0, badlegs=0;
  for (const [an,ax,az] of R) for (const [bn,bx,bz] of R) {
    if (an===bn) continue; legs++;
    const r = routeFrom(ax,az,bx,bz); if(!r) continue;
    let bad=false;
    for (let i=1;i<r.cells.length;i++){
      const [x0,,z0]=r.cells[i-1],[x1,,z1]=r.cells[i];
      const L=Math.hypot(x1-x0,z1-z0), n=Math.max(1,Math.ceil(L/step));
      for(let k=1;k<=n;k++){const t=k/n,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;total++;
        const g=grad(x,z); if(g!==null&&g>1.5){over++;bad=true;if(g>worst){worst=g;at=[+x.toFixed(1),+z.toFixed(1)];}}}
    }
    if(bad)badlegs++;
  }
  console.log(`sampled every ${step} m: ${over}/${total} over 1.5 (${(over/total*100).toFixed(3)}%), ${badlegs}/${legs} legs, worst ${worst.toFixed(2)} at ${(at||[]).join(',')}`);
}
