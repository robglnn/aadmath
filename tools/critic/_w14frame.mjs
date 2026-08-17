import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT='/Users/harrison/dev/aadmath/shots/w14-fun/look';
await mkdir(OUT,{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const p=await (await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1})).newPage();
await p.goto('http://127.0.0.1:4917',{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ascent.locale','en');});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(2500);
for (const l of ['.sc-go','.op-go','.ct-go']) { const e=p.locator(l); if(await e.count()&&await e.first().isVisible().catch(()=>0)){await e.first().click().catch(()=>{});await p.waitForTimeout(600);} }
// Freeze the player far away, then drive the CAMERA itself to look at the cache.
await p.evaluate(()=>{
  const A=window.__ascent; const c=A.caches.state().at[0];
  A.player.pos.set(c.x-30, c.y+8, c.z-30); A.player.vel.set(0,0,0);
  window.__lock = () => { const cam=A.camera; cam.position.set(c.x-34, c.y+12, c.z-34); cam.lookAt(c.x, c.y+2, c.z); };
  A.engine.add(()=>window.__lock());
});
await p.waitForTimeout(2500);
await p.screenshot({path:OUT+'/cache-framed.png'});
// and a mid-distance look back at the island from the same altitude
await p.evaluate(()=>{
  const A=window.__ascent; const c=A.caches.state().at[0];
  window.__lock = () => { const cam=A.camera; cam.position.set(c.x-6, c.y+20, c.z-6); cam.lookAt(0, 60, 0); };
});
await p.waitForTimeout(2000);
await p.screenshot({path:OUT+'/from-cache-back.png'});
await b.close();
