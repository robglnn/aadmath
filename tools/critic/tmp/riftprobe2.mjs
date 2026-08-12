import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const [W,H] of [[844,390],[896,414],[1024,768]]) {
  const c = await b.newContext({viewport:{width:W,height:H},hasTouch:true});
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
  await p.waitForTimeout(1500);
  await p.evaluate(()=>window.__ascent.openRiftById('one-step-add'));
  await p.waitForTimeout(1600);
  const r = await p.evaluate(()=>{
    const pl=document.querySelector('.rf-plate');
    const cs=getComputedStyle(pl);
    const kids=[...pl.children].map(k=>{const rr=k.getBoundingClientRect();return {
      sel:k.className, t:Math.round(rr.top), b:Math.round(rr.bottom), h:Math.round(rr.height)};});
    const fr=document.querySelector('.rf-frame').getBoundingClientRect();
    return {u:getComputedStyle(document.querySelector('.rift')).getPropertyValue('--rf-u'),
      plate:{sw:pl.scrollWidth,cw:pl.clientWidth,sh:pl.scrollHeight,ch:pl.clientHeight,minH:cs.minHeight,maxH:cs.maxHeight,ovf:cs.overflow},
      frame:{t:Math.round(fr.top),b:Math.round(fr.bottom),h:Math.round(fr.height),w:Math.round(fr.width)},
      kids, mode: window.__ascent.panel.mode};
  });
  console.log('---',W,'x',H, JSON.stringify(r));
  await c.close();
}
await b.close();
