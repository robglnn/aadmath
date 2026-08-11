/** Does the objective actually move as the player learns? Drives the real engine. */
import { chromium } from 'playwright';
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url')+1] : 'http://127.0.0.1:5173';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync']});
const c = await b.newContext({viewport:{width:1600,height:900}});
const p = await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(URL,{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(2500);
const seen=[];
for (let i=0;i<40;i++){
  const g = await p.evaluate(()=>window.__ascent.story.guide());
  const line = `${g.verb}/${g.kind} ${g.skill} · ${g.held}h ${g.open}o ${g.locked}l`;
  if (seen[seen.length-1]!==line) { seen.push(line); console.log(String(i).padStart(2),line); }
  await p.evaluate((id)=>window.__ascent.openRiftById(id), g.skill);
  await p.waitForTimeout(260);
  const ok = await p.evaluate(()=>{
    const it = window.__ascent.panel.item;
    if(!it) return false;
    window.__ascent.enter(it.answer);
    return true;
  });
  await p.waitForTimeout(300);
  await p.evaluate(()=>window.__ascent.panel.close());
  await p.waitForTimeout(220);
  if(!ok) break;
}
console.log('distinct objectives seen:', seen.length);
console.log('console errors:', errs.length, errs.slice(0,3));
await p.screenshot({path:'shots/onboard-v6/arc.png'});
await b.close();
