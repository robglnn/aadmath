import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4614', {waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(4500);
await p.evaluate(()=>window.__ascent.openRiftById('order-ops',{form:'oo-power',difficulty:5,scaffold:'full'}));
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(()=>{
  const out=[];
  const r=document.querySelector('.rift');
  for (const sel of ['.rift','.rf-frame','#rf-plate','.rf-stage','.rf-inner','#rf-work','.rf-head','.rf-foot','.rf-stmtwrap','.rf-pad','.rf-keys']) {
    const e=document.querySelector(sel); if(!e) continue;
    const b=e.getBoundingClientRect();
    out.push({sel, off:e.offsetHeight, client:e.clientHeight, scroll:e.scrollHeight, top:Math.round(b.top), bottom:Math.round(b.bottom), ov:getComputedStyle(e).overflowY});
  }
  return {vh:innerHeight, u:getComputedStyle(r).getPropertyValue('--rf-u'), cls:r.className, out};
}),null,1));
await b.close();
