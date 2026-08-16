import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1600,height:900}, deviceScaleFactor:2 })).newPage();
p.on('pageerror', e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:4777',{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:45000});
await p.waitForTimeout(4000);
for (let d=1; d<=6; d++){
  await p.evaluate(async()=>{const a=window.__ascent;
    for(let i=0;i<20;i++){const o=a.rifts.list.filter(r=>!r.locked); if(!o.length)break;
      a.openRiftById(o[i%o.length].id); await new Promise(r=>setTimeout(r,110));
      const inf=a.panelInfo(); if(!inf.open)break; a.enter(inf.answer);
      await new Promise(r=>setTimeout(r,160)); try{a.panel.close?.()}catch{}}});
  await p.evaluate(()=>window.__ascent.advanceDays(1));
  await p.reload({waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:45000});
  await p.waitForTimeout(3000);
}
// walk toward the nearest warden with real keys
await p.mouse.click(800,450); await p.waitForTimeout(400);
for (let step=0; step<300; step++){
  const e = await p.evaluate(()=>{const a=window.__ascent,pl=a.player.pos;
    const w=a.wardens.state().at; if(!w.length) return null;
    let best=w[0],bd=1e9; for(const x of w){const dd=Math.hypot(x.x-pl.x,x.z-pl.z); if(dd<bd){bd=dd;best=x;}}
    const want=Math.atan2(best.x-pl.x,best.z-pl.z);
    let dd=((want-a.player.yaw+Math.PI)%(Math.PI*2))-Math.PI; if(dd<-Math.PI)dd+=Math.PI*2;
    return {d:dd,dist:bd,state:best.state,latex:best.latex,weights:best.weights.length};});
  if(!e) break;
  // the foundry opens itself on proximity; hand the frame back the way a player does
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&/STEP BACK|GOT IT|BACK TO/i.test(x.innerText||'')); if(b)b.click();});
  if(step%40===0) console.log(`step ${step}: dist=${e.dist.toFixed(0)}m state=${e.state} weights=${e.weights}`);
  if(e.dist<70 && step%3===0){ await p.screenshot({path:`shots/w13-play2/warden-${Math.round(e.dist)}m.png`}); }
  if(e.dist<14) break;
  if(Math.abs(e.d)>0.12){ await p.keyboard.up('KeyW');
    await p.keyboard.down(e.d>0?'ArrowLeft':'ArrowRight');
    await p.waitForTimeout(Math.min(700,Math.abs(e.d)*830));
    await p.keyboard.up('ArrowLeft'); await p.keyboard.up('ArrowRight'); }
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await p.waitForTimeout(400);
}
await p.keyboard.up('KeyW');
await p.waitForTimeout(1200);
await p.screenshot({path:'shots/w13-play2/warden-close.png'});
console.log('final', JSON.stringify(await p.evaluate(()=>window.__ascent.wardens.state())));
await b.close();
