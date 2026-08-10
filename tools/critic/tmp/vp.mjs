import { chromium } from 'playwright';
const URL='http://127.0.0.1:4787';
const VPS=[[1280,720],[1600,900],[414,896]];
const LOCS=['es','pl'];
const SKILLS=['solve-two-step','var-meaning','dist-prop','combine-like'];
const browser = await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit']});
const allLogs=[];
for (const loc of LOCS) for (const [w,h] of VPS) {
  const ctx = await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:2, hasTouch:w<500, isMobile:w<500});
  const page = await ctx.newPage();
  page.on('console',m=>{if(m.type()==='error')allLogs.push(`${loc} ${w}x${h} ${m.text()}`)});
  page.on('pageerror',e=>allLogs.push(`${loc} ${w}x${h} pageerror ${e.message}`));
  await page.addInitScript((l)=>{try{localStorage.setItem('ascent.locale',l)}catch{}},loc);
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await page.waitForTimeout(2600);
  await page.screenshot({path:`/tmp/crit/vp-${loc}-${w}x${h}-world.png`});
  for (const sk of SKILLS) {
    await page.evaluate(s=>window.__ascent.openRiftById(s), sk).catch(()=>{});
    await page.waitForTimeout(900);
    await page.screenshot({path:`/tmp/crit/vp-${loc}-${w}x${h}-${sk}.png`});
    // clipping check inside rift
    const clip = await page.evaluate(()=>{
      const bad=[];
      document.querySelectorAll('.rift *, .hud *, .meta-quest *, .rig *').forEach(el=>{
        if(el.children.length) return;
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden')return;
        const r=el.getBoundingClientRect(); if(!r.width&&!r.height)return;
        const clipped = (el.scrollWidth>el.clientWidth+1 && (cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.textOverflow==='ellipsis'))
                     || (el.scrollHeight>el.clientHeight+1 && (cs.overflow==='hidden'||cs.overflowY==='hidden'));
        const offscreen = r.right>window.innerWidth+1 || r.left<-1;
        if(clipped||offscreen) bad.push({cls:String(el.className).slice(0,30),sw:el.scrollWidth,cw:el.clientWidth,sh:el.scrollHeight,ch:el.clientHeight,l:Math.round(r.left),r:Math.round(r.right),txt:(el.textContent||'').trim().slice(0,60),why:clipped?'clip':'offscreen'});
      });
      return bad;
    });
    if (clip.length) console.log(`CLIP ${loc} ${w}x${h} ${sk}:`, JSON.stringify(clip));
    const bodyScroll = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    if (bodyScroll) console.log(`HSCROLL ${loc} ${w}x${h} ${sk}`);
  }
  await ctx.close();
}
console.log('ERRORS', JSON.stringify(allLogs,null,1));
await browser.close();
