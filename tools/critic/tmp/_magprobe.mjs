import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport:{width:1280,height:720} });
const p = await c.newPage();
await p.goto(process.argv[2], { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(4000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const a = window.__ascent, s = a.builder.solids;
  const near = s.all.filter(q => Math.hypot(q.x-0, q.z-14) < 8)
    .map(q => ({ kind:q.kind, x:q.x, z:q.z, y:q.y, base:q.base, fixed:!!q.fixed,
                 d:+Math.hypot(q.x-0,q.z-14).toFixed(2) }));
  return { count:s.count, owned:s.owned, near,
    ground14: a.islandAt(0,14), ground12: a.islandAt(0,12),
    slotLevels: s.slotLevels(0,14,[]) };
}), null, 1));
await b.close();
