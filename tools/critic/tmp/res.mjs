import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader'] });
const page = await (await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('http://127.0.0.1:4457',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.evaluate(()=>localStorage.removeItem('ascent.save'));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(4000);
await page.mouse.move(800,450); await page.mouse.click(800,450); await page.keyboard.press('KeyQ');
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
await page.waitForTimeout(600);
// answer 8 items properly, waiting for the panel each time
let sealed=0;
for(let i=0;i<10;i++){
  await page.evaluate(()=>{const a=window.__ascent; if(!a.panel.open){const t=a.nextObjective(); a.openRiftById(t?.id||'var-meaning');}});
  await page.waitForFunction(()=>window.__ascent.panel.open,null,{timeout:8000}).catch(()=>{});
  const ok = await page.evaluate(()=>window.__ascent.panel.open);
  if(!ok){console.log('panel would not open at',i);break;}
  await page.evaluate(()=>window.__ascent.enter(window.__ascent.panel.item.answer));
  sealed++;
  await page.waitForTimeout(2200);
}
console.log('answered', sealed, JSON.stringify(await page.evaluate(()=>{const s=window.__ascent.state();return{phase:s.session.phase,tears:s.session.run?.tears,target:s.session.run?.target,shards:s.shards};})));
await page.evaluate(()=>window.__ascent.panel.open&&window.__ascent.panel.close());
await page.waitForTimeout(900);
await page.evaluate(()=>window.__ascent.session.skipToClose());
await page.waitForTimeout(2500);
console.log('phase now', await page.evaluate(()=>window.__ascent.session.state().phase));
console.log('ses-close present:', await page.evaluate(()=>{const e=document.querySelector('.ses-close'); if(!e)return 'MISSING'; const cs=getComputedStyle(e); return JSON.stringify({cls:e.className,opacity:cs.opacity,display:cs.display,visibility:cs.visibility,textLen:e.innerText.length});}));
await page.screenshot({path:'shots/close/03-resolution-real.png'});
console.log('TEXT:\n'+await page.evaluate(()=>document.querySelector('.ses-close')?.innerText));
console.log('ERRORS',errs.length,errs.slice(0,3).join('|'));
await b.close();
