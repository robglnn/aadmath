/** The watch card while the proof is whole and the coda is still waiting. */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4490';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1600,height:900}, deviceScaleFactor:2 })).newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear()}catch{}});
await p.goto(URL,{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
await p.waitForTimeout(3000);
await p.evaluate(async ()=>{ const A=window.__ascent,m=A.mastery;
  for(let i=0;i<320;i++){const o=m.next(); if(!o)break; const t=m.taskFor(o.id); if(!t)break;
    const it=A.itemFor(t); if(!it)continue;
    m.observe(t.skill,true,{assisted:t.scaffold!=='none',form:it.form,rep:it.rep,scene:it.scene,kind:t.kind});}});
await p.waitForTimeout(52000);
for (const loc of ['en','es','pl']) {
  await p.evaluate(l=>window.__ascent.setLocale(l), loc);
  await p.waitForTimeout(900);
  const txt = await p.evaluate(()=>{
    const c=document.querySelector('.meta-quest');
    return c ? c.textContent.replace(/\s+/g,' ').trim() : null;
  });
  console.log(`${loc}: ${txt}`);
  await p.evaluate(()=>{ const c=document.querySelector('.meta-quest'); if(c) c.scrollIntoView(); });
  const r = await p.evaluate(()=>{const e=document.querySelector('.meta-quest');const b=e.getBoundingClientRect();
    return {x:Math.max(0,b.x-14),y:Math.max(0,b.y-14),width:b.width+28,height:b.height+28,hush:e.className.includes('hush')};});
  console.log(`   hushed: ${r.hush}`);
  await p.screenshot({ path: `shots/close/watch-${loc}.png` });
}
console.log(`coda gate: ${JSON.stringify(await p.evaluate(()=>({codaIn: window.__ascent.story.state().codaIn, nights: window.__ascent.story.state().nights, chapter: window.__ascent.story.state().chapter})))}`);
console.log(`errors ${errs.length}`);
await b.close();
