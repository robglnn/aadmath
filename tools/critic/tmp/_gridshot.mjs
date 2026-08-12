import { chromium } from 'playwright';
import path from 'node:path';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport:{width:1600,height:900} });
const p = await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(process.argv[2], { waitUntil:'networkidle' });
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(4200);
// walk somewhere flat and open, keys only
for (let i=0;i<10;i++){ await p.keyboard.down('KeyW'); await p.waitForTimeout(300); await p.keyboard.up('KeyW'); await p.waitForTimeout(120); }
await p.keyboard.press('Digit1'); await p.waitForTimeout(600);
await p.evaluate(()=>{ document.getElementById('ui').style.display='none'; window.__ascent.player.pitch = -0.42; });
await p.waitForTimeout(500);
await p.screenshot({ path: path.join(process.argv[3],'grid-wall.png') });
await p.evaluate(()=>{ document.getElementById('ui').style.display=''; });
await p.keyboard.press('KeyF'); await p.waitForTimeout(700);
await p.screenshot({ path: path.join(process.argv[3],'grid-wall-turned.png') });
await p.evaluate(()=>{ document.getElementById('ui').style.display='none'; });
await p.keyboard.press('Digit3'); await p.waitForTimeout(700);
await p.screenshot({ path: path.join(process.argv[3],'grid-floor.png') });
console.log('errors', errs.length, errs.slice(0,3).join(' | '));
await b.close();
