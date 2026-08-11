/** The stopping point: does this make me want tomorrow? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('shots/close'); await mkdir(OUT,{recursive:true});
const W=1600,H=900;
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const page = await (await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2})).newPage();
const logs=[]; page.on('pageerror',e=>logs.push(e.message)); page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});
let n=0; const shot=async(s,ms=300)=>{await page.waitForTimeout(ms);await page.screenshot({path:path.join(OUT,`${String(++n).padStart(2,'0')}-${s}.png`)});};
await page.goto('http://127.0.0.1:4457',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.evaluate(()=>localStorage.removeItem('ascent.save'));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
// play a realistic run: mix of right and wrong on the first two skills
for (let i=0;i<14;i++){
  const open = await page.evaluate(()=>window.__ascent.panel.open);
  if(!open) await page.evaluate(()=>{const a=window.__ascent;const t=a.nextObjective();a.openRiftById(t?.id||'var-meaning');});
  await page.waitForTimeout(500);
  if(!await page.evaluate(()=>window.__ascent.panel.open)) break;
  await page.evaluate((wrong)=>{const a=window.__ascent;const ans=a.panel.item.answer;
    a.enter(wrong && Number.isFinite(Number(ans)) ? Number(ans)+2 : ans);}, i===3||i===8);
  await page.waitForTimeout(2600);
}
await page.evaluate(()=>window.__ascent.panel.open&&window.__ascent.panel.close());
await page.waitForTimeout(800);
console.log('pre-close', JSON.stringify(await page.evaluate(()=>{const s=window.__ascent.state();return{shards:s.shards,integrity:s.integrity,tears:s.session.run?.tears,target:s.session.run?.target};})));
await page.evaluate(()=>window.__ascent.session.skipToClose());
await shot('resolution',1600);
const txt = await page.evaluate(()=>document.querySelector('.ses-close')?.innerText.replace(/\n{2,}/g,'\n'));
console.log('--- RESOLUTION ---\n'+txt+'\n---');
// the rest beat
await page.evaluate(()=>{const btn=[...document.querySelectorAll('.ses-close button')][0];btn?.click();});
await shot('rest',1500);
console.log('--- REST ---\n'+await page.evaluate(()=>document.body.innerText.replace(/\n{2,}/g,'\n').slice(0,800)));
console.log('ERRORS',logs.length, logs.slice(0,3).join(' | '));
await b.close();
