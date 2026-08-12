import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport:{width:1600,height:900} });
const p = await c.newPage();
await p.goto(process.argv[2]||'http://127.0.0.1:5173', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(4000);
await p.mouse.click(800, 700);
await p.waitForTimeout(600);
const locked = await p.evaluate(()=>({ locked: !!document.pointerLockElement, el: document.pointerLockElement?.tagName }));
console.log('lock:', JSON.stringify(locked));
const y0 = await p.evaluate(()=>window.__ascent.player.yaw);
for (let i=0;i<20;i++){ await p.mouse.move(800+i*12, 450); await p.waitForTimeout(16); }
await p.waitForTimeout(400);
const y1 = await p.evaluate(()=>window.__ascent.player.yaw);
console.log('yaw', y0, '->', y1, 'delta', y1-y0);
await b.close();
