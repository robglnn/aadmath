import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
await mkdir('shots/land-rift',{recursive:true});
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const skill of ['like-terms','var-meaning','two-step','distribute','one-step-add']) {
  const c = await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true});
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
  await p.waitForTimeout(1500);
  await p.evaluate((s)=>window.__ascent.openRiftById(s), skill);
  await p.waitForTimeout(1800);
  await p.screenshot({path:`shots/land-rift/${skill}.png`});
  console.log(skill, await p.evaluate(()=>window.__ascent.panel.mode));
  await c.close();
}
await b.close();
