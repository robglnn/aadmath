import { warmRoutes, routeFrom, headingTo } from '../../src/world/paths.js';
let t = performance.now(); warmRoutes(); console.log(`warmRoutes ${(performance.now()-t).toFixed(0)} ms`);
const G = [[0,0],[0,26],[-13.25,-56.63],[30,104],[-108,-8],[-84,74],[62,-98],[-92,-66]];
// cold field per goal
for (const [gx,gz] of G) { t = performance.now(); routeFrom(1,1,gx,gz); console.log(`  field for ${gx},${gz}: ${(performance.now()-t).toFixed(1)} ms`); }
// cached
t = performance.now();
let n=0;
for (let i=0;i<2000;i++){ const g=G[i%G.length]; routeFrom((i%120)-60, ((i*7)%120)-60, g[0], g[1]); n++; }
console.log(`cached routeFrom x${n}: ${((performance.now()-t)/n).toFixed(3)} ms each`);
t = performance.now(); n=0;
for (let i=0;i<20000;i++){ const g=G[i%G.length]; headingTo((i%120)-60, ((i*7)%120)-60, g[0], g[1]); n++; }
console.log(`cached headingTo x${n}: ${((performance.now()-t)/n).toFixed(4)} ms each`);
// detour among real places only
const P=[['plaza',0,0],['var',0,26],['eval',-13.25,-56.63],['mesa',30,104],['grove',-108,-8],['henge',-84,74]];
const det=[];
for(const [an,ax,az] of P) for(const [bn,bx,bz] of P){ if(an===bn) continue; const r=routeFrom(ax,az,bx,bz); if(!r) continue;
  det.push([`${an}->${bn}`, +(r.metres/Math.hypot(bx-ax,bz-az)).toFixed(2), Math.round(r.metres), Math.round(Math.hypot(bx-ax,bz-az))]); }
det.sort((a,b)=>b[1]-a[1]);
console.log('detours (real places):', det.slice(0,6).map(d=>`${d[0]} ${d[1]}x (${d[2]}m/${d[3]}m)`).join('  '));
