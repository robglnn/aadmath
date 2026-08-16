import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
p.on('pageerror', e=>console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:4939', { waitUntil:'networkidle' });
await p.evaluate(()=>localStorage.clear()); await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent); await p.waitForTimeout(4000);
await p.evaluate(()=>window.__ascent.openRiftById('var-meaning'));
await p.waitForTimeout(1500);
for (let i=0;i<30;i++){
  const st = await p.evaluate(()=>{
    const a=window.__ascent; const s=a.mastery.save().skills;
    return { open:!!a.panel.open, settled:!!a.panel._settled, mode:a.panel.mode,
             info:a.panelInfo(), skills:JSON.parse(JSON.stringify(s)) };
  });
  if (i<3 || i%7===0) console.log(i, 'open',st.open,'settled',st.settled,'mode',st.mode, JSON.stringify(st.skills).slice(0,300));
  const r = await p.evaluate(()=>{ try { return window.__ascent.panel.demo('right'); } catch(e){ return 'ERR '+e; } });
  if (i<3) console.log('   demo->',r);
  await p.waitForTimeout(1200);
}
const fin = await p.evaluate(()=>({ skills: window.__ascent.mastery.save().skills,
  rifts:(window.__ascent.rifts.list||[]).map(r=>({id:r.id,locked:!!r.locked,sealed:!!r.sealed})),
  watch: window.__ascent.watch(), next: window.__ascent.nextObjective() }));
console.log('FINAL skills', JSON.stringify(fin.skills));
console.log('FINAL rifts', JSON.stringify(fin.rifts));
console.log('FINAL watch', JSON.stringify(fin.watch));
await b.close();
