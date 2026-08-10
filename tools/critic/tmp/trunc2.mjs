import { chromium } from 'playwright';
const URL='http://127.0.0.1:4787';
const browser = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const loc of ['en','es','pl']) {
  const ctx = await browser.newContext({viewport:{width:414,height:896},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const page = await ctx.newPage();
  await page.addInitScript(l=>{try{localStorage.setItem('ascent.locale',l)}catch{}},loc);
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await page.waitForTimeout(2600);
  const r = await page.evaluate(()=>{
    const slots=[...document.querySelectorAll('.slot')].map(s=>{
      const lab=[...s.querySelectorAll('*')].find(e=>e.children.length===0 && /\D/.test(e.textContent||''));
      const el = lab||s;
      const cs=getComputedStyle(el);
      return {txt:el.textContent.trim(), sw:el.scrollWidth, cw:el.clientWidth, ov:cs.overflow, to:cs.textOverflow, ws:cs.whiteSpace, w:el.getBoundingClientRect().width};
    });
    // Every element with ellipsis applied
    const ell=[];
    document.querySelectorAll('body *').forEach(el=>{
      const cs=getComputedStyle(el);
      if(cs.textOverflow==='ellipsis' && el.scrollWidth>el.clientWidth+0.5 && (el.textContent||'').trim())
        ell.push({cls:String(el.className).slice(0,30),txt:el.textContent.trim().slice(0,40),sw:el.scrollWidth,cw:el.clientWidth});
    });
    // overlapping visible text boxes
    const stamp=document.querySelector('.meta-stamp');
    const touch=[...document.querySelectorAll('[class*=tc-],[class*=touch],[id*=touch]')].map(e=>String(e.className)+':'+JSON.stringify(e.getBoundingClientRect().toJSON()));
    return {slots, ell, touch:touch.slice(0,12), stampTxt: stamp?stamp.textContent.replace(/\s+/g,' ').trim():null};
  });
  console.log(loc, JSON.stringify(r,null,1));
  await ctx.close();
}
await browser.close();
