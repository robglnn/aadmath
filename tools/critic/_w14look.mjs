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
// stand off from cache 0 and look at it
const info = await p.evaluate(()=>{
  const A=window.__ascent; const c=A.caches.state().at[0];
  const dx=40, dz=40;
  A.player.pos.set(c.x-dx, c.y+6, c.z-dz);
  A.player.vel.set(0,0,0);
  A.player.yaw = Math.atan2(dx,dz);
  A.player.pitch = -0.1;
  return c;
});
await p.waitForTimeout(2500);
await p.screenshot({path:OUT+'/cache-far.png'});
await p.evaluate(()=>{const A=window.__ascent;const c=A.caches.state().at[0];A.player.pos.set(c.x-14,c.y+3,c.z-14);A.player.vel.set(0,0,0);A.player.yaw=Math.atan2(14,14);});
await p.waitForTimeout(2000);
await p.screenshot({path:OUT+'/cache-near.png'});
// what a distant vista looks like from a high point
await p.evaluate(()=>{const A=window.__ascent;A.player.pos.set(0,190,0);A.player.vel.set(0,0,0);A.player.pitch=-0.25;});
await p.waitForTimeout(2500);
await p.screenshot({path:OUT+'/vista-high.png'});
console.log(JSON.stringify(info));
await b.close();
