import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const [W,H] of [[1024,768]]) for (const loc of ['es']) {
const c = await b.newContext({viewport:{width:W,height:H},hasTouch:true});
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate((l)=>window.__ascent.setLocale(l), loc);
await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
await p.waitForTimeout(2500);
console.log(loc, await p.evaluate(()=>[...document.querySelectorAll('#touchpad .btn')].map(e=>{
  const r=e.getBoundingClientRect(); const l=e.querySelector('b'); const lr=l.getBoundingClientRect();
  return `${e.dataset.a} btn[${Math.round(r.left)}..${Math.round(r.right)} x ${Math.round(r.top)}..${Math.round(r.bottom)}] lab"${l.textContent}"[${Math.round(lr.left)}..${Math.round(lr.right)} x ${Math.round(lr.top)}..${Math.round(lr.bottom)}]`;
})));
await c.close(); }
await b.close();
