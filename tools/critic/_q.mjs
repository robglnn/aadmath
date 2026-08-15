import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1600,height:900} })).newPage();
await p.addInitScript(()=>{try{localStorage.clear()}catch{}});
await p.goto('http://127.0.0.1:4490',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
await p.waitForTimeout(3000);
await p.evaluate(async ()=>{ const A=window.__ascent,m=A.mastery;
  for(let i=0;i<320;i++){const o=m.next(); if(!o)break; const t=m.taskFor(o.id); if(!t)break;
    const it=A.itemFor(t); if(!it)continue;
    m.observe(t.skill,true,{assisted:t.scaffold!=='none',form:it.form,rep:it.rep,scene:it.scene,kind:t.kind});}});
await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const e=document.querySelector('.meta-quest');
  const r=e?.getBoundingClientRect();
  return {cls:e?.className, rect:r&&{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}, text:e?.textContent};
})));
await b.close();
