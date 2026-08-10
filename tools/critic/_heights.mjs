import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const c = await b.newContext({ viewport: { width: 800, height: 500 } });
const p = await c.newPage();
await p.goto('http://127.0.0.1:4711', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(2000);
console.log(await p.evaluate(() => {
  const a = window.__ascent;
  const h = [];
  for (let i=0;i<400;i++){
    const x=(Math.random()*2-1)*160, z=(Math.random()*2-1)*160;
    const y=a.player.groundAt ? a.player.groundAt(x,z) : null;
    if (y!=null) h.push(y);
  }
  h.sort((x,y)=>x-y);
  return { n:h.length, min:h[0], p10:h[(h.length*0.1)|0], p50:h[(h.length*0.5)|0], p90:h[(h.length*0.9)|0], max:h[h.length-1] };
}));
await b.close();
