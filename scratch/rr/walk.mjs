import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = process.argv[2] || 'http://127.0.0.1:5173';
const OUT = process.argv[3] || 'shots/walk';
await mkdir(OUT,{recursive:true});
const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport:{width:1280,height:720}, deviceScaleFactor:1 });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
page.on('pageerror',e=>errs.push('PE '+e.message));
await page.addInitScript(()=>{ try{ localStorage.clear(); }catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3500);
const st = async()=>page.evaluate(()=>{
  const A=window.__ascent,p=A.player.pos;
  const near=A.rifts.nearest(p), any=A.rifts.nearestAny(p,7.5);
  const vm=A.rifts.list.find(r=>r.id==='var-meaning');
  return {p:[+p.x.toFixed(1),+p.y.toFixed(1),+p.z.toFixed(1)],
   dVM:+Math.hypot(p.x-vm.foot.x,p.z-vm.foot.z).toFixed(1),
   near:near&&near.id, any:any&&any.id, panel:A.panel.open,
   prompts:[...document.querySelectorAll('.afd-call')].filter(e=>e.style.display!=='none').map(e=>e.innerText.replace(/\n/g,'|')),
   hud:[...document.querySelectorAll('.hud-flash,.hud-say,.bk-tag')].map(e=>e.innerText).filter(Boolean).slice(0,4)};
});
console.log('t0', JSON.stringify(await st()));
await page.screenshot({path:OUT+'/01-spawn.png'});
// real click to lock, then hold W
await page.mouse.move(640,360); await page.mouse.click(640,360);
await page.waitForTimeout(600);
await page.keyboard.down('KeyW');
for(let i=0;i<14;i++){ await page.waitForTimeout(1000); const s=await st(); console.log('w'+i, JSON.stringify(s)); if(s.panel) break; }
await page.keyboard.up('KeyW');
await page.waitForTimeout(500);
console.log('after walk', JSON.stringify(await st()));
await page.screenshot({path:OUT+'/02-atrift.png'});
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
console.log('after E', JSON.stringify(await st()));
await page.screenshot({path:OUT+'/03-afterE.png'});
console.log('ERRORS', errs.slice(0,6));
await b.close();
