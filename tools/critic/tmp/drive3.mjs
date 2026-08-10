import { chromium } from 'playwright';
const URL='http://127.0.0.1:4787';
const loc = process.argv[2] || 'pl';
const browser = await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit']});
const ctx = await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2});
const page = await ctx.newPage();
const logs=[]; page.on('console',m=>{if(m.type()==='error')logs.push(m.type()+': '+m.text())});
page.on('pageerror',e=>logs.push('pageerror: '+e.message));
await page.addInitScript((l)=>{ try{localStorage.setItem('ascent.locale',l)}catch{} }, loc);
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(2600);
await page.evaluate(()=>window.__ascent.openRiftById('var-meaning'));
await page.waitForTimeout(1400);
// wrong answer: type a deliberately wrong big number
for (const k of ['9','9']) await page.click(`.rf-key:text-is("${k}")`).catch(()=>{});
await page.waitForTimeout(200);
await page.click('.rf-key.commit');
await page.waitForTimeout(1800);
await page.screenshot({path:`/tmp/crit/${loc}-wrong1.png`});
// second wrong -> scaffolding / echo
await page.click('.rf-key.commit').catch(()=>{});
await page.waitForTimeout(1600);
await page.screenshot({path:`/tmp/crit/${loc}-wrong2.png`});
// call the echo
await page.click('.rf-btn.ghosty').catch(()=>{});
await page.waitForTimeout(2200);
await page.screenshot({path:`/tmp/crit/${loc}-echo.png`});
console.log('LOGS',JSON.stringify(logs));
// overflow check
const of = await page.evaluate(()=>{
  const bad=[];
  document.querySelectorAll('body *').forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||!el.offsetParent&&cs.position!=='fixed')return;
    if(el.scrollWidth>el.clientWidth+2 && cs.overflowX!=='auto' && cs.overflowX!=='scroll') bad.push({cls:el.className&&el.className.toString().slice(0,40),tag:el.tagName,sw:el.scrollWidth,cw:el.clientWidth,txt:(el.textContent||'').trim().slice(0,50)});
    if(el.scrollHeight>el.clientHeight+2 && cs.overflowY!=='auto' && cs.overflowY!=='scroll' && el.children.length===0) bad.push({cls:el.className&&el.className.toString().slice(0,40),tag:el.tagName,sh:el.scrollHeight,ch:el.clientHeight,txt:(el.textContent||'').trim().slice(0,50)});
  });
  return bad;
});
console.log('OVERFLOW',JSON.stringify(of,null,1));
await browser.close();
