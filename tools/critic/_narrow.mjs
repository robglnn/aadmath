import { chromium } from 'playwright';
const URL='http://127.0.0.1:4397';
const b=await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync']});
for (const [w,h,name] of [[860,540,'narrow'],[430,932,'phone']]){
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:w<600,hasTouch:w<600});
  const p=await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.goto(URL,{waitUntil:'domcontentloaded'});
  await p.evaluate(()=>localStorage.clear());
  await p.reload({waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await p.waitForTimeout(3500);
  await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
  // walk a little so the objective has a distance
  await p.mouse.click(w/2,h/2);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(5000); await p.keyboard.up('KeyW');
  await p.waitForTimeout(800);
  const g=await p.evaluate(()=>window.__ascent.story.guide());
  const overflow = await p.evaluate(()=>{
    const c=document.querySelector('.gd-card');
    return c ? {w:c.offsetWidth,h:c.offsetHeight,right:c.getBoundingClientRect().right} : null;
  });
  console.log(name,w+'x'+h,JSON.stringify(g),JSON.stringify(overflow),'errors',errs.length);
  await p.screenshot({path:`shots/guide-final/${name}.png`});
  await c.close();
}
await b.close();
