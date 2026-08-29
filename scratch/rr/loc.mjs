import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL='http://127.0.0.1:4488', OUT='shots/rr-loc';
await mkdir(OUT,{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit']});
const errs=[];
for(const loc of ['en','es','pl']){
  const ctx=await b.newContext({viewport:{width:1280,height:720}});
  const page=await ctx.newPage();
  page.on('console',m=>{if(m.type()==='error')errs.push(loc+':'+m.text())});
  page.on('pageerror',e=>errs.push(loc+':PE '+e.message));
  await page.addInitScript((l)=>{try{localStorage.clear();localStorage.setItem('ascent.locale',l)}catch{}},loc);
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await page.evaluate((l)=>window.__ascent.setLocale(l),loc);
  await page.waitForTimeout(2600);
  const st=await page.evaluate(()=>({calls:window.__ascent.afford.state().calls.map(c=>`${c.id}|${c.verb}|${c.key||'-'}|${c.far}`),
    controls:(document.querySelector('.fc-card')?.innerText||'').replace(/\n/g,' / ')}));
  console.log(loc, JSON.stringify(st));
  await page.screenshot({path:`${OUT}/${loc}.png`});
  await ctx.close();
}
console.log('ERRORS',errs.slice(0,6));
await b.close();
