import { chromium } from 'playwright';
const browser = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const page = await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2200);
console.log('rig parts', await page.evaluate(()=>{
  const names=[]; window.__ascent.player.root.traverse(o=>names.push(o.name||o.type));
  return names.slice(0,80);
}));
// find foot objects
console.log('feetKeys', await page.evaluate(()=>{
  const r=window.__ascent.player.rig; return Object.keys(r);
}));
await browser.close();
