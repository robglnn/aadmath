import { chromium } from 'playwright';
const URL='http://127.0.0.1:4787';
const browser = await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit']});
const ctx = await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2});
const page = await ctx.newPage();
const logs=[]; page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.type()+': '+m.text())});
page.on('pageerror',e=>logs.push('pageerror: '+e.message));
// boot directly in Spanish
await page.addInitScript(()=>{ try{localStorage.setItem('ascent.locale','es')}catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
await page.screenshot({path:'/tmp/crit/es-boot.png'});
// Now switch to PL at runtime and back
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button,[role=button]')].find(e=>e.textContent.trim()==='PL'); if(b)b.click(); });
await page.waitForTimeout(1200);
await page.screenshot({path:'/tmp/crit/pl-switch.png'});
console.log('LOGS', JSON.stringify(logs,null,1));
// dump all visible text
const txt = await page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('body *').forEach(el=>{
    if(el.children.length===0){ const s=(el.textContent||'').trim(); if(s) out.push(s); }
  });
  return out;
});
console.log('TEXT-PL', JSON.stringify(txt));
await browser.close();
