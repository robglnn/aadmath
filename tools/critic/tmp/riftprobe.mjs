import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const [W,H] of [[844,390],[1024,768]]) {
  const c = await b.newContext({viewport:{width:W,height:H},hasTouch:true});
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
  await p.waitForTimeout(1500);
  await p.evaluate(()=>window.__ascent.openRiftById('one-step-add'));
  await p.waitForTimeout(1200);
  const r = await p.evaluate(()=>{
    const rift = document.querySelector('.rift');
    const out=[];
    const walk=(el,d)=>{
      const rr=el.getBoundingClientRect();
      if (rr.left < -1 || rr.top < -1 || rr.right > innerWidth+1 || rr.bottom > innerHeight+1) {
        out.push({d, sel: el.tagName.toLowerCase()+'.'+(typeof el.className==='string'?el.className.split(' ').slice(0,2).join('.'):''),
          l:Math.round(rr.left),t:Math.round(rr.top),r:Math.round(rr.right),b:Math.round(rr.bottom),w:Math.round(rr.width),h:Math.round(rr.height)});
      }
      if(d<4) for(const k of el.children) walk(k,d+1);
    };
    walk(rift,0);
    const pl=document.querySelector('.rf-plate');
    return {out: out.slice(0,20), plate: pl?{sw:pl.scrollWidth,cw:pl.clientWidth,sh:pl.scrollHeight,ch:pl.clientHeight}:null,
      riftCS: getComputedStyle(rift).overflow};
  });
  console.log('---',W,'x',H, JSON.stringify(r,null,1));
  await c.close();
}
await b.close();
