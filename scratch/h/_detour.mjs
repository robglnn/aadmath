import { warmRoutes, routeFrom } from '../../src/world/paths.js';
warmRoutes();
const R = [['plaza',0,0],['var-meaning',-1,-27],['eval-expr',-13,-57],['order-ops',-31,-93],['like-terms',-43,-45],
  ['distribute',-77,-46],['one-step-add',28,-28],['one-step-mul',54,-36],['two-step',-39,-119],['multi-step',6,-124],['both-sides',-4,-97]];
const d=[];
for (const [an,ax,az] of R) for (const [bn,bx,bz] of R) { if(an===bn)continue;
  const r=routeFrom(ax,az,bx,bz); if(!r)continue;
  const s=Math.hypot(bx-ax,bz-az); d.push([`${an}->${bn}`, r.metres/s, r.metres, s]); }
d.sort((a,b)=>a[1]-b[1]);
console.log(`${d.length} legs. detour median ${d[d.length>>1][1].toFixed(2)}x  p90 ${d[Math.floor(d.length*0.9)][1].toFixed(2)}x  worst ${d[d.length-1][1].toFixed(2)}x (${d[d.length-1][0]} ${Math.round(d[d.length-1][2])}m for ${Math.round(d[d.length-1][3])}m)`);
const m=d.map(x=>x[2]).sort((a,b)=>a-b);
console.log(`routed metres: median ${Math.round(m[m.length>>1])} m, min ${Math.round(m[0])} m, max ${Math.round(m[m.length-1])} m`);
