import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = process.argv[2] || 'http://127.0.0.1:4616';
await mkdir('shots/truncation', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
for (const [name, w, h] of [['phone-portrait',390,844], ['phone-landscape',844,390]]) {
  for (const loc of ['en','pl']) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
    const p = await ctx.newPage();
    await p.goto(URL,{waitUntil:'networkidle'});
    await p.evaluate(()=>{try{localStorage.clear()}catch{}});
    await p.reload({waitUntil:'networkidle'});
    await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
    await p.waitForTimeout(4500);
    await p.evaluate((l)=>window.__ascent.setLocale(l), loc);
    await p.waitForTimeout(400);
    await p.evaluate(()=>window.__ascent.menu.show());
    await p.waitForTimeout(700);
    // scroll the card to its foot: the last words must be reachable AND whole
    const info = await p.evaluate(()=>{
      const c=document.querySelector('.mnu-card');
      c.scrollTop = c.scrollHeight;
      return {clientH:c.clientHeight, scrollH:c.scrollHeight, canScroll:c.scrollHeight>c.clientHeight+1};
    });
    await p.waitForTimeout(300);
    await p.screenshot({path:`shots/truncation/menu-${name}-${loc}-foot.png`});
    console.log(name, loc, JSON.stringify(info));
    await ctx.close();
  }
}
await b.close();
