import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const p = await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
await p.goto('http://127.0.0.1:4482',{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(3000);
await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
await p.mouse.move(800,450); await p.mouse.click(800,450);
// draw the hand, then drain the charge and click again
await p.keyboard.press('Digit1');
await p.waitForTimeout(300);
await p.evaluate(()=>{ window.__ascent.builder.charge = 0; window.__ascent.builder._chargeHold = 99; });
await p.waitForTimeout(300);
await p.mouse.down(); await p.mouse.up();
await p.waitForTimeout(400);
console.log(await p.evaluate(()=>{
  const why = document.querySelector('.axiom-why');
  const strip = document.querySelector('.axiom');
  const toast = [...document.querySelectorAll('.toast, .hud-flash, .hud-toast')].map(e=>e.textContent.trim());
  return JSON.stringify({
    chargeLabel: strip ? strip.textContent.trim().replace(/\s+/g,' ') : null,
    whyText: why ? why.textContent.trim() : null,
    whyShown: why ? why.classList.contains('show') : null,
    whyVisible: why ? getComputedStyle(why).opacity : null,
    toast,
  }, null, 1);
}));
await p.screenshot({path:'/Users/harrison/dev/aadmath/shots/lang/zz-build-nocharge.png'});
await b.close();
