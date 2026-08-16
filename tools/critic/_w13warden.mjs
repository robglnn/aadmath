import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1600,height:900} })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:4777', { waitUntil:'networkidle' });
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:45000});
await p.waitForTimeout(4000);
for (let d=1; d<=8; d++) {
  // work a line so the day counts, then sleep
  await p.evaluate(async () => {
    const a = window.__ascent;
    for (let i=0;i<20;i++){
      const open = a.rifts.list.filter(r=>!r.locked);
      if(!open.length) break;
      a.openRiftById(open[i%open.length].id);
      await new Promise(r=>setTimeout(r,120));
      const inf=a.panelInfo(); if(!inf.open) break;
      a.enter(inf.answer); await new Promise(r=>setTimeout(r,180));
      try{a.panel.close?.()}catch{}
    }
  });
  await p.evaluate(()=>window.__ascent.advanceDays(1));
  await p.reload({waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:45000});
  await p.waitForTimeout(3500);
  const s = await p.evaluate(()=>{
    const a=window.__ascent, st=a.state();
    return { wardens: st.wardens, caches: {t:st.caches.total,o:st.caches.opened},
      mastered: Object.values(st.skills||{}).filter(x=>x.mastered).length,
      unlocked: a.rifts.list.filter(r=>!r.locked).length,
      objective: (document.querySelector('.obj, #objective, [class*=objective]')?.innerText||'').replace(/\s+/g,' ').slice(0,180),
      chapter: (document.body.innerText.match(/CHAPTER \d[\s\S]{0,80}/)||[''])[0].replace(/\s+/g,' ') };
  });
  console.log(`day ${d}: wardens=${JSON.stringify(s.wardens)} mastered=${s.mastered}/10 unlockedRifts=${s.unlocked} caches=${JSON.stringify(s.caches)} | ${s.chapter}`);
}
await p.screenshot({path:'shots/w13-play2/day8.png'});
await b.close();
