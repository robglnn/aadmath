import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [w,h,tag] of [[390,844,'p390'],[1600,900,'d1600']]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:w<500, hasTouch:w<500 });
  const p = await ctx.newPage();
  await p.addInitScript(()=>{try{localStorage.clear();}catch{}});
  await p.goto('http://127.0.0.1:4761',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
  await p.waitForTimeout(2500);
  // stand on the foundry deck: the hail is up, and the tear is straight past it
  await p.evaluate(()=>{const a=window.__ascent;a.player.pos.set(0,(a.player.groundAt(0,16)??12)+0.6,16);a.player.vel.set(0,0,0);a.player.yaw=Math.PI;a.player.pitch=-0.05;});
  await p.waitForTimeout(1500);
  const st = await p.evaluate(()=>{const s=window.__ascent.afford.state();return {calls:s.calls,dropped:s.space.dropped,stems:[...document.querySelectorAll('.afd-call')].map(e=>({cls:e.className,stem:e.querySelector('.afd-stem').style.height,disp:e.style.display}))};});
  console.log(tag, JSON.stringify(st));
  await p.screenshot({path:`shots/tagdodge/${tag}-foundry.png`});
  await ctx.close();
}
await b.close(); process.exit(0);
