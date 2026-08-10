import { chromium } from 'playwright';
const browser = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
await page.goto('http://127.0.0.1:4788/', { waitUntil:'networkidle' });
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2500);
console.log(await page.evaluate(()=>{
  const a=window.__ascent;
  const keys = o => o ? Object.keys(o) : null;
  return JSON.stringify({
    ascent: keys(a),
    player: keys(a.player),
    rifts: a.rifts?.list?.map(r=>r.id).slice(0,20),
    world: keys(a.world),
    fx: keys(a.fx),
    engine: keys(a.engine),
  }, null, 1);
}));
await browser.close();
