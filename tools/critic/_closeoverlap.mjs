import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const [W,H] of [[390,844],[414,896],[1600,900]]) {
 for (const loc of ['en','es','pl']) {
  const p = await (await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,hasTouch:W<700,isMobile:W<700})).newPage();
  await p.goto('http://127.0.0.1:4791',{waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent);
  await p.evaluate((l)=>{window.__ascent.session.reset();localStorage.removeItem('ascent.save');localStorage.setItem('ascent.locale',l);},loc);
  await p.reload({waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent);
  await p.waitForFunction(()=>window.__ascent.session.state().phase==='charter',null,{timeout:60000});
  await p.locator('.sc-go').click(); await p.waitForTimeout(400);
  await p.evaluate(()=>window.__ascent.openRiftById('var-meaning')); await p.waitForTimeout(700);
  await p.evaluate(()=>window.__ascent.panel.demo('wrong')); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__ascent.panel.close()); await p.waitForTimeout(300);
  await p.evaluate(()=>window.__ascent.session.skipToClose());
  await p.waitForTimeout(5000); // long past any entry animation
  const r = await p.evaluate(()=>{
    const card=document.querySelector('.ses-close'); if(!card) return null;
    const btns=[...card.querySelectorAll('button')];
    const texts=[...card.querySelectorAll('p,li,h2,div')].filter(e=>e.children.length===0&&e.textContent.trim().length>10);
    const hits=[];
    for(const btn of btns){const A=btn.getBoundingClientRect();
      for(const t of texts){const B=t.getBoundingClientRect();
        const ox=Math.min(A.right,B.right)-Math.max(A.left,B.left);
        const oy=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);
        if(ox>4&&oy>4) hits.push({btn:btn.textContent.trim(),txt:t.textContent.trim().slice(0,50),ox:Math.round(ox),oy:Math.round(oy),ta:getComputedStyle(t).opacity});
      }}
    const scroll = card.scrollHeight>card.clientHeight+4 ? `cardScroll ${card.scrollHeight}>${card.clientHeight} overflowY=${getComputedStyle(card).overflowY}`:'';
    return {hits,scroll};
  });
  console.log(`${W}x${H} ${loc}: overlaps=${r.hits.length} ${r.scroll}`);
  r.hits.slice(0,3).forEach(h=>console.log('   ',JSON.stringify(h)));
  await p.close();
 }
}
await b.close();
