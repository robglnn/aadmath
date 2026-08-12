import { chromium } from 'playwright';
const SEL = ['#rig','.ses-band','.gd-card','.meta-quest','.kit','.axiom','.axiom-clear','.fc','.buildbar','.langs','.rp-launch','.mnu-pill','.meta-comms','#touchpad .home','#touchpad .pads','.hail','.toast','.gd-prompt','.fc-pill'];
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const s of (process.argv[2]||'844x390').split(',')) {
  const [W,H]=s.split('x').map(Number);
  const c = await b.newContext({viewport:{width:W,height:H},hasTouch:true});
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await p.evaluate(()=>{try{localStorage.clear()}catch{}});
  await p.reload({waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
  await p.waitForTimeout(2000);
  const go = await p.waitForSelector('.ses-charter.show .sc-go',{timeout:60000}).catch(()=>null);
  if (go) { await go.click(); await p.waitForTimeout(900); }
  await p.evaluate(()=>{window.__ascent.story.comms.clear();window.__ascent.story.comms.say('Nothing in your kit reaches one from flat ground, and that is the entire idea. Place a ramp, place another off the top of it, and touch the thing. Sixty motes apiece, and there are three of them on this island before the road bends north.',{force:true});});
  await p.waitForTimeout(2800);
  const r = await p.evaluate((SEL)=>SEL.map(s=>{const e=document.querySelector(s); if(!e) return [s,'—'];
    const cs=getComputedStyle(e); const rr=e.getBoundingClientRect();
    return [s, `${Math.round(rr.left)},${Math.round(rr.top)} ${Math.round(rr.width)}x${Math.round(rr.height)} → r${Math.round(rr.right)} b${Math.round(rr.bottom)}  vis=${cs.visibility} op=${cs.opacity}`];}), SEL);
  console.log('=====', s);
  for (const [k,v] of r) console.log('  ', k.padEnd(20), v);
  await c.close();
}
await b.close();
