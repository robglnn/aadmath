import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:1600,height:900} });
await p.goto(url, {waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent);
await p.waitForTimeout(4000);
await p.evaluate(()=>window.__ascent.story.seal(400));
await p.waitForTimeout(9000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const el=document.querySelector('.meta-quest');
  const cs=getComputedStyle(el);
  return {ui:document.getElementById('ui').className, body:document.body.className, cls:el.className, op:cs.opacity, vis:cs.visibility, disp:cs.display, tf:cs.transform, rect:el.getBoundingClientRect().toJSON(), text:el.innerText};
}),null,1));
await p.screenshot({path:'shots/narr-pacing/probe.png'});
await b.close();
