import { chromium } from 'playwright';
import { AUDIT_SRC } from '../_viewports.mjs';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const [W,H] of [[844,390],[896,414],[926,428]]) {
  for (const skill of ['one-step-add','two-step','like-terms','distribute','var-meaning']) {
  const c = await b.newContext({viewport:{width:W,height:H},hasTouch:true});
  const p = await c.newPage();
  await p.addInitScript(AUDIT_SRC);
  await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
  await p.waitForTimeout(1500);
  await p.evaluate((s)=>window.__ascent.openRiftById(s), skill);
  await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const a=window.__landAudit(); const pl=document.querySelector('.rf-plate');
    const fo=document.querySelector('.rf-foot'); const fr=fo?.getBoundingClientRect();
    return {mode:window.__ascent.panel.mode, u:getComputedStyle(document.querySelector('.rift')).getPropertyValue('--rf-u'),
      plate:[pl.scrollHeight,pl.clientHeight], foot: fr?[Math.round(fr.top),Math.round(fr.bottom)]:null,
      clip:a.clipped.map(x=>x.sel+' '+x.what), out:a.outside.length, lap:a.overlaps.length};
  });
  console.log(W+'x'+H, skill.padEnd(14), JSON.stringify(r));
  await c.close();
  }
}
await b.close();
