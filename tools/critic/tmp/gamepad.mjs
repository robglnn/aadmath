import { chromium } from 'playwright';
const URL='http://127.0.0.1:4787';
const browser = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const ctx = await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2});
const page = await ctx.newPage();
const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await page.addInitScript(()=>{
  try{localStorage.setItem('ascent.locale','pl')}catch{}
  const pad={id:'Xbox Wireless Controller (STANDARD GAMEPAD)',index:0,connected:true,mapping:'standard',timestamp:0,
    axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  window.__pad=pad;
  navigator.getGamepads=()=>[pad,null,null,null];
  window.addEventListener('load',()=>{ setTimeout(()=>{ window.dispatchEvent(new CustomEvent('gamepadconnected',{detail:{}})); const ev=new Event('gamepadconnected'); ev.gamepad=pad; window.dispatchEvent(ev); },800); });
});
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
// push left stick forward + press A
await page.evaluate(()=>{ window.__pad.axes[1]=-1; window.__pad.buttons[0].pressed=true; window.__pad.buttons[0].value=1; window.__pad.timestamp=performance.now(); });
await page.waitForTimeout(1500);
await page.screenshot({path:'/tmp/crit/pad-pl.png'});
const glyphs = await page.evaluate(()=>{const o=[];document.querySelectorAll('body *').forEach(el=>{if(el.children.length)return;const s=(el.textContent||'').trim();if(s)o.push(s);});return o;});
console.log(JSON.stringify(glyphs));
console.log('ERR',JSON.stringify(errs));
await browser.close();
