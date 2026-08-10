import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT='/tmp/critic-reel'; await mkdir(OUT,{recursive:true});
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2500);
await page.addStyleTag({content:'.meta-open{opacity:0!important}'});

// idle breathing test before anything else
const idle = await page.evaluate(async ()=>{
  const a=window.__ascent, T=a.THREE;
  const c=a.player.rig.chest, h=a.player.rig.head;
  const out=[];
  for(let i=0;i<60;i++){ await new Promise(r=>requestAnimationFrame(r));
    c.updateWorldMatrix(true,false); h.updateWorldMatrix(true,false);
    const cv=new T.Vector3().setFromMatrixPosition(c.matrixWorld);
    const hv=new T.Vector3().setFromMatrixPosition(h.matrixWorld);
    out.push({cy:+cv.y.toFixed(4), hy:+hv.y.toFixed(4), hx:+hv.x.toFixed(4), py:+a.player.pos.y.toFixed(4)});
  }
  return out;
});
const cys=idle.map(d=>d.cy-d.py), hxs=idle.map(d=>d.hx);
console.log('IDLE chest bob range(cm)', ((Math.max(...cys)-Math.min(...cys))*100).toFixed(2),
            'head lateral(cm)', ((Math.max(...hxs)-Math.min(...hxs))*100).toFixed(2));

// pointer lock + clear build ghost
await page.keyboard.down('KeyW'); await page.waitForTimeout(250); await page.keyboard.up('KeyW');
await page.mouse.move(W/2,H/2); await page.mouse.click(W/2,H/2); await page.waitForTimeout(200);
await page.keyboard.press('KeyQ'); await page.waitForTimeout(400);
await page.evaluate(()=>{const a=window.__ascent; a.player.pos.set(0,58.6,22); a.player.vel.set(0,0,0);});
await page.waitForTimeout(600);

// --- twelve seconds of ordinary play, one frame every 500 ms ---
const script = [
  ['down','KeyW'], null, null,                  // 0.0-1.5 walk
  ['down','ShiftLeft'], null, null, null,       // sprint
  ['press','Space'], null,                      // jump
  ['look', 40], ['look', 40], null,             // turn while running
  ['up','KeyW'], null,                          // release: skid
  ['down','KeyA'], ['down','KeyW'], null,       // strafe run
  ['look',-40], null,
  ['up','KeyA'], ['up','KeyW'], ['up','ShiftLeft'],
  null, null,
];
let f=0;
for (const step of script){
  if (step){
    if (step[0]==='down') await page.keyboard.down(step[1]);
    else if (step[0]==='up') await page.keyboard.up(step[1]);
    else if (step[0]==='press') await page.keyboard.press(step[1]);
    else if (step[0]==='look') { for(let i=0;i<6;i++){ await page.mouse.move(W/2+step[1],H/2,{steps:1}); await page.waitForTimeout(20);} }
  }
  await page.waitForTimeout(480);
  await page.screenshot({path:path.join(OUT,`r${String(f).padStart(2,'0')}.png`)});
  f++;
}
for (const k of ['KeyW','KeyA','ShiftLeft']) await page.keyboard.up(k);
const perf = await page.evaluate(()=>window.__ascent.state().perf);
console.log('PERF', JSON.stringify(perf));
console.log('ERRORS', errs);
await browser.close();
