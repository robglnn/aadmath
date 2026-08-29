import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{try{localStorage.clear()}catch{}});
await page.goto('http://127.0.0.1:4711',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
for (let i=1;i<=12;i++){
  await page.waitForTimeout(10000);
  const s = await page.evaluate(()=>{
    const A=window.__ascent; const st=A.session.state();
    return {phase:st.phase, run:st.run, boot:document.getElementById('boot')?.className, modal:document.querySelector('.ses-band')?.className};
  });
  console.log(i*10+'s', JSON.stringify(s));
  if (s.phase!=='idle') { await page.screenshot({path:`shots/crit-ped-session-${s.phase}.png`}); break; }
}
console.log('errors',errs.length,errs.slice(0,3));
await browser.close();
