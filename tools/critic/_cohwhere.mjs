import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1280,height:720} })).newPage();
await p.goto('http://127.0.0.1:4917', { waitUntil: 'networkidle' });
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
await p.waitForTimeout(3500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const a=window.__ascent;
  const near=(x,z)=>a.rifts.list.map(r=>({id:r.id,x:+(r.foot?r.foot.x:r.pos.x).toFixed(1),y:+r.pos.y.toFixed(1),z:+(r.foot?r.foot.z:r.pos.z).toFixed(1),locked:!!r.locked,mastered:!!r.mastered,d:+Math.hypot((r.foot?r.foot.x:r.pos.x)-x,(r.foot?r.foot.z:r.pos.z)-z).toFixed(1)})).sort((u,v)=>u.d-v.d);
  return { at42: near(-42.6,32.5).slice(0,4), at8: near(-8.8,-20.9).slice(0,4), all: a.rifts.list.length, spawn: [+a.player.pos.x.toFixed(1),+a.player.pos.z.toFixed(1)] };
}),null,1));
await b.close();
