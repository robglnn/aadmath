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
    const out=[];
    document.querySelectorAll('body *').forEach(el=>{
      if(el.children.length)return;
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden')return;
      const txt=(el.textContent||'').trim(); if(!txt)return;
      if(el.scrollWidth>el.clientWidth+1) out.push({cls:String(el.className).slice(0,24),txt:txt.slice(0,40),sw:el.scrollWidth,cw:el.clientWidth,ov:cs.overflow+'/'+cs.textOverflow});
    });
    // also overlaps between the location stamp and touch buttons
    const stamp=document.querySelector('.meta-stamp');
    const rects=[...document.querySelectorAll('.touch button, .tc-btn, [class*=touch] button')].map(b=>({c:b.className,r:b.getBoundingClientRect()}));
    let overlap=[];
    if(stamp){ const s=stamp.getBoundingClientRect();
      for(const b of rects){ const o=!(b.r.right<s.left||b.r.left>s.right||b.r.bottom<s.top||b.r.top>s.bottom); if(o) overlap.push(b.c); } }
    return {out, overlap, stamp: stamp? stamp.getBoundingClientRect().toJSON():null};
  });
  console.log(loc, JSON.stringify(r,null,1));
  await ctx.close();
}
await browser.close();
