import { chromium } from 'playwright';
const URL='http://127.0.0.1:4787';
const EN_WORDS=/\b(the|and|your|with|from|this|that|you|press|hold|jump|glide|wall|ramp|floor|beam|rank|shards?|mastery|correct|wrong|answer|continue|close|settings|sound|next|back|start|level|score|move|moves|step|both|sides|available|call|echo|charge|set|tear|rift|pressure|lattice|integrity|chapter|question|open|cadet|landing|light|day|tearing)\b/i;
const browser = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync']});
for (const loc of ['es','pl']) {
  const ctx = await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const page = await ctx.newPage();
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); page.on('pageerror',e=>errs.push('pageerror '+e.message));
  await page.addInitScript(l=>{try{localStorage.setItem('ascent.locale',l)}catch{}},loc);
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await page.waitForTimeout(2600);
  const seen=new Set();
  const collect=async(tag)=>{
    const txt=await page.evaluate(()=>{const o=[];document.querySelectorAll('body *').forEach(el=>{if(el.children.length)return;const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return;const s=(el.textContent||'').trim();if(s)o.push(s);});return o;});
    for(const s of txt){ if(seen.has(s))continue; seen.add(s);
      if(EN_WORDS.test(s) && !/katex/i.test(s)) console.log(`[${loc}] ${tag}: ${JSON.stringify(s.slice(0,110))}`); }
  };
  await collect('world');
  for (const k of ['KeyJ','Escape','KeyM','Tab','KeyP']) { await page.keyboard.press(k); await page.waitForTimeout(700); await collect('key:'+k); await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(400);}
  for (const sk of ['var-meaning','eval-expr','order-ops','like-terms','distribute','one-step-add','one-step-mul','two-step','multi-step','both-sides']) {
    await page.evaluate(s=>window.__ascent.openRiftById(s),sk).catch(()=>{});
    await page.waitForTimeout(700); await collect('rift:'+sk);
    // wrong answer
    await page.click('.rf-key.commit').catch(()=>{}); await page.waitForTimeout(900); await collect('wrong:'+sk);
    await page.click('.rf-btn.ghosty').catch(()=>{}); await page.waitForTimeout(1000); await collect('echo:'+sk);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
  console.log(`[${loc}] ERRORS`, JSON.stringify(errs));
  await ctx.close();
}
await browser.close();
