import { chromium } from 'playwright';
const W=1600,H=900;
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync']});
const c = await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:1.5});
const p = await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://127.0.0.1:4395',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(3000);
await p.mouse.click(W/2,H/2);
// walk at the objective until the prompt shows, then stop and shoot
let shot=false;
for(let i=0;i<400;i++){
  const g = await p.evaluate(()=>window.__ascent.story.guide?.());
  if(g && !g.prompt){
    // steer: nudge the view until it says "ahead"
    if(g.where==='left') await p.mouse.move(W/2-160,H/2);
    else if(g.where==='right') await p.mouse.move(W/2+160,H/2);
    else if(g.where==='behind') await p.mouse.move(W/2+420,H/2);
    await p.keyboard.down('KeyW');
  }
  if(g && g.prompt && !shot){
    await p.keyboard.up('KeyW');
    await p.waitForTimeout(120);
    await p.screenshot({path:'shots/onboard-v6/prompt.png'});
    console.log('PROMPT at', JSON.stringify(g));
    shot=true; break;
  }
  await p.waitForTimeout(160);
}
await p.keyboard.up('KeyW');
if(!shot) console.log('no prompt seen');
console.log('errors',errs.length, errs.slice(0,3));
await b.close();
