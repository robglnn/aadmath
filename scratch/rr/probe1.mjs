import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:5173';
const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport:{width:1280,height:720} });
const page = await ctx.newPage();
const logs=[]; page.on('console',m=>{ if(m.type()==='error') logs.push(m.text()); });
page.on('pageerror',e=>logs.push('PE '+e.message));
await page.addInitScript(()=>{ try{ localStorage.clear(); }catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
const out = await page.evaluate(()=>{
  const A=window.__ascent;
  const p=A.player.pos;
  const rifts=A.rifts.list.map(r=>({id:r.id,locked:r.locked,tier:r.tier,
    foot:[+r.foot.x.toFixed(2),+r.foot.y.toFixed(2),+r.foot.z.toFixed(2)],
    d:+Math.hypot(p.x-r.foot.x,p.z-r.foot.z).toFixed(1)}));
  rifts.sort((a,b)=>a.d-b.d);
  return { spawn:[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)],
    islandAtSpawn:A.islandAt(p.x,p.z), surfaceAtSpawn:A.surfaceAt(p.x,p.z),
    rifts, next:A.nextObjective&&A.nextObjective() };
});
console.log(JSON.stringify(out,null,1));
console.log('ERRORS',logs.slice(0,5));
await b.close();
