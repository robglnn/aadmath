import { chromium } from 'playwright';
const URL='http://127.0.0.1:4787';
const browser = await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit']});
const ctx = await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2});
const page = await ctx.newPage();
const logs=[]; page.on('console',m=>{if(m.type()==='error')logs.push(m.type()+': '+m.text())});
page.on('pageerror',e=>logs.push('pageerror: '+e.message));
await page.addInitScript(()=>{ try{localStorage.setItem('ascent.locale','pl')}catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(2600);
// open a rift, answer WRONG, capture scaffolding in Polish
await page.evaluate(()=>window.__ascent.openRiftById('var-meaning'));
await page.waitForTimeout(1400);
await page.screenshot({path:'/tmp/crit/pl-rift.png'});
// try to answer wrong: click numeric pad 9 then SET, or pick first choice
const clicked = await page.evaluate(()=>{
  const root=document.querySelector('.rift, #rift, [class*=rift]');
  return root ? root.className : 'none';
});
console.log('riftroot',clicked);
const btns = await page.evaluate(()=>[...document.querySelectorAll('button')].map(b=>({t:b.textContent.trim().slice(0,30), c:b.className})).filter(b=>b.t));
console.log(JSON.stringify(btns,null,0));
console.log('LOGS',JSON.stringify(logs));
await browser.close();
