import { chromium } from 'playwright';
import { AUDIT_SRC } from '../_viewports.mjs';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const [W,H] of [[844,390],[926,428]]) for (const loc of ['en','pl']) {
const c = await b.newContext({viewport:{width:W,height:H},hasTouch:true});
const p = await c.newPage();
p.on('pageerror',e=>console.log('ERR',e.message.split('\n')[0]));
await p.addInitScript(AUDIT_SRC);
await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate((l)=>window.__ascent.setLocale(l), loc);
await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
await p.waitForTimeout(2000);
const go = await p.waitForSelector('.ses-charter.show .sc-go',{timeout:60000}).catch(()=>null);
if (go) { await go.click(); await p.waitForTimeout(900); }
// force the wallet to move three times, the stuck card up, and a long line
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate(()=>{ window.__ascent.builder.wallet.earn(60,'anchor'); });
await p.waitForTimeout(250);
await p.evaluate(()=>{ window.__ascent.levy(9); });
await p.waitForTimeout(250);
await p.evaluate(()=>{ window.__ascent.builder.wallet.earn(24,'drift'); });
await p.evaluate(()=>{window.__ascent.story.comms.clear();window.__ascent.story.comms.say('Nothing in your kit reaches one from flat ground, and that is the entire idea. Place a ramp, place another off the top of it, and touch the thing. Sixty motes apiece, and there are three of them on this island before the road bends north.',{force:true});});
await p.waitForTimeout(2600);
const r = await p.evaluate(()=>{const a=window.__landAudit();
  const l=document.querySelector('.ledger').getBoundingClientRect();
  return {lap:a.overlaps.map(x=>`${x.a} X ${x.b} ${x.w}x${x.h}`), clip:a.clipped.length,
    ledger:[Math.round(l.left),Math.round(l.top),Math.round(l.width),Math.round(l.height)]};});
console.log(W+'x'+H, loc, JSON.stringify(r));
await c.close(); }
await b.close();
