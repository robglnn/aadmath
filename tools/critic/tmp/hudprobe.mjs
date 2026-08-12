import { chromium } from 'playwright';
import { AUDIT_SRC } from '../_viewports.mjs';
const SIZES = (process.argv[2]||'844x390').split(',').map(s=>s.split('x').map(Number));
const LOCS = (process.argv[3]||'en').split(',');
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const [W,H] of SIZES) for (const loc of LOCS) {
  const c = await b.newContext({viewport:{width:W,height:H},hasTouch:true});
  const p = await c.newPage();
  await p.addInitScript(AUDIT_SRC);
  await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await p.evaluate(()=>{try{localStorage.clear()}catch{}});
  await p.reload({waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  if (process.env.NOTCH) await p.evaluate((side)=>{const st=document.documentElement.style;
    st.setProperty('--sa-l',side==='R'?'0px':'44px');st.setProperty('--sa-r',side==='R'?'44px':'0px');st.setProperty('--sa-b','21px');st.setProperty('--sa-t','0px');}, process.env.NOTCH);
  await p.evaluate((l)=>window.__ascent.setLocale(l), loc);
  await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
  await p.waitForTimeout(2000);
  const go = await p.waitForSelector('.ses-charter.show .sc-go',{timeout:60000}).catch(()=>null);
  if (go) { await go.click(); await p.waitForTimeout(800); }
  await p.evaluate(()=>{window.__ascent.story.comms.clear();
    window.__ascent.story.comms.say('Nothing in your kit reaches one from flat ground, and that is the entire idea. Place a ramp, place another off the top of it, and touch the thing. Sixty motes apiece, and there are three of them on this island before the road bends north.',{force:true});});
  await p.waitForTimeout(2800);
  const r = await p.evaluate(()=>window.__landAudit());
  console.log(`\n===== ${W}x${H} ${loc}  clip:${r.clipped.length} out:${r.outside.length} lap:${r.overlaps.length}`);
  for (const x of r.clipped) console.log('  CLIP', x.sel, x.what, '|', x.text);
  for (const x of r.outside) console.log('  OUT ', x.sel, x.edge, x.by, '|', x.text);
  for (const x of r.overlaps) console.log('  LAP ', x.a, 'X', x.b, `${x.w}x${x.h}@${x.at}`, '|', x.ta, '/', x.tb);
  await c.close();
}
await b.close();
