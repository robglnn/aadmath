import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || '/tmp/critic-rig');
await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2});
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());}); page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2000);
// clear the story caption so it stops covering the cadet's feet
await page.evaluate(()=>{ try{ window.__ascent.story?.skip?.(); }catch(e){} });
await page.waitForTimeout(400);
await page.addStyleTag({content:'.dlg,.dialogue,[class*="dialog"],[class*="marlow"],[class*="caption"]{opacity:0 !important}'});

await page.mouse.move(W/2,H/2);
await page.mouse.click(W/2,H/2);
await page.waitForTimeout(300);
await page.keyboard.press('KeyQ');

// go to the plaza around the distribute rift: hard flat stone, no grass to hide contact
await page.evaluate(()=>{ const a=window.__ascent; a.teleportTo('distribute'); });
await page.waitForTimeout(1500);
const info = await page.evaluate(()=>{ const a=window.__ascent; return {pos:a.player.pos.toArray(), yaw:a.player.yaw}; });
console.log('pos', info);

const yaws = [0, Math.PI*0.5, Math.PI, Math.PI*1.5];
for (let i=0;i<yaws.length;i++){
  await page.evaluate((y)=>{ const a=window.__ascent; a.player.yaw=y; a.player.cam.yaw=y; }, yaws[i]);
  await page.waitForTimeout(900);
  await page.screenshot({path: path.join(OUT, `yaw${i}.png`)});
}
console.log('errs',errs);
await browser.close();
