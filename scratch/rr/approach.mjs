import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4477';
const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const errs=[];
const out=[];
for (const bdeg of [0,45,90,135,180,225,270,315]) {
  const ctx = await b.newContext({ viewport:{width:960,height:600} });
  const page = await ctx.newPage();
  page.on('console',m=>{if(m.type()==='error')errs.push(bdeg+':'+m.text())});
  page.on('pageerror',e=>errs.push(bdeg+':PE '+e.message));
  await page.addInitScript(()=>{try{localStorage.clear()}catch{}});
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await page.waitForTimeout(2600);
  await page.mouse.move(480,300); await page.mouse.click(480,300); await page.waitForTimeout(300);
  const r = await page.evaluate(()=>{const x=window.__ascent.rifts.list.find(v=>!v.locked);return {id:x.id,x:x.foot.x,z:x.foot.z};});
  const held=new Set();
  const setKeys=async(w)=>{for(const k of [...held])if(!w.has(k)){await page.keyboard.up(k);held.delete(k);}for(const k of w)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}};
  const walkTo=async(tx,tz,tol,max)=>{const t0=Date.now();for(;;){
    const p=await page.evaluate(()=>{const A=window.__ascent,q=A.player.pos;return {x:q.x,z:q.z,panel:A.panel.open};});
    if(p.panel){await setKeys(new Set());return {panel:true};}
    const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
    if(d<tol||Date.now()-t0>max){await setKeys(new Set());return {panel:false,d:+d.toFixed(1),to:Date.now()-t0>max};}
    const w=new Set(); if(Math.abs(dz)>d*0.38)w.add(dz<0?'KeyW':'KeyS'); if(Math.abs(dx)>d*0.38)w.add(dx>0?'KeyD':'KeyA'); w.add('ShiftLeft');
    await setKeys(w); await page.waitForTimeout(140);}};
  const th=bdeg*Math.PI/180;
  // stage 26 m out on the bearing, approaching by a route that stays clear of the ring
  const st = await walkTo(r.x+Math.cos(th)*26, r.z+Math.sin(th)*26, 3.5, 45000);
  const approach = st.panel ? {panel:true,note:'opened while staging'} : await walkTo(r.x, r.z, 1.5, 25000);
  const flash = await page.evaluate(()=>[...document.querySelectorAll('.hud-flash')].map(e=>e.textContent.trim()).filter(Boolean).join('|'));
  const shards = await page.evaluate(()=>window.__ascent.state().shards);
  out.push({bearing:bdeg, staged:!st.panel, opened:!!approach.panel, d:approach.d, flash, shards});
  console.log(JSON.stringify(out[out.length-1]));
  await ctx.close();
}
console.log('SUMMARY opened', out.filter(o=>o.opened).length, '/', out.length);
console.log('ERRORS', errs.slice(0,6));
await b.close();
