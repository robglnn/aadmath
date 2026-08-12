import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const c = await b.newContext({viewport:{width:844,height:390},hasTouch:true});
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
  const els=[...document.querySelectorAll('.kit')];
  return els.map(e=>{const cs=getComputedStyle(e);const r=e.getBoundingClientRect();
    return {cls:e.className, parent:e.parentElement.id||e.parentElement.className,
      pos:cs.position, left:cs.left, top:cs.top, bottom:cs.bottom, tr:cs.transform, mw:cs.maxWidth, disp:cs.display, fw:cs.flexWrap,
      rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      kids:[...e.children].map(k=>{const kr=k.getBoundingClientRect();return [k.className,Math.round(kr.left),Math.round(kr.top),Math.round(kr.width),Math.round(kr.height)];})};});
}));
await b.close();
