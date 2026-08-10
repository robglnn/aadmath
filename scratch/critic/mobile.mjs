import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT='/tmp/critic-mobile'; await mkdir(OUT,{recursive:true});
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
for (const [w,h] of [[414,896],[390,844],[1280,720]]){
  const ctx = await browser.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2, hasTouch:true, isMobile:w<500});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__ascent);
  await page.waitForTimeout(2500);
  // drive with the touch stick if there is one
  if (w<500){
    await page.touchscreen.tap(w*0.2, h*0.8);
    await page.waitForTimeout(200);
  }
  const over = await page.evaluate(()=>{
    const bad=[];
    for (const el of document.querySelectorAll('body *')){
      const cs=getComputedStyle(el);
      if (cs.visibility==='hidden'||cs.display==='none'||cs.opacity==='0') continue;
      const r=el.getBoundingClientRect();
      if (r.width<2||r.height<2) continue;
      if (r.right>innerWidth+1 || r.left<-1 || r.bottom>innerHeight+1 || r.top<-1){
        if (el.textContent && el.textContent.trim().length)
          bad.push({cls:el.className&&el.className.baseVal===undefined?String(el.className).slice(0,40):el.tagName, r:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)], txt:el.textContent.trim().slice(0,40)});
      }
      if (el.scrollWidth>el.clientWidth+2 && cs.overflowX!=='auto' && cs.overflowX!=='scroll' && el.clientWidth>0)
        bad.push({clip:true, cls:String(el.className).slice(0,40), sw:el.scrollWidth, cw:el.clientWidth, txt:(el.textContent||'').trim().slice(0,40)});
    }
    return {bad: bad.slice(0,20), docW:document.documentElement.scrollWidth, innerW:innerWidth};
  });
  await page.screenshot({path:path.join(OUT,`v${w}x${h}.png`)});
  const perf = await page.evaluate(()=>window.__ascent.state().perf);
  console.log(w+'x'+h, 'overflow', JSON.stringify(over), 'p50', perf.p50, 'fps', Math.round(perf.fps), 'errs', errs.length, errs.slice(0,3));
  await ctx.close();
}
await browser.close();
