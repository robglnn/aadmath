import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL='http://127.0.0.1:4477', OUT='shots/rr-rift2';
await mkdir(OUT,{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit']});
const ctx=await b.newContext({viewport:{width:1440,height:810}});
const page=await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); page.on('pageerror',e=>errs.push('PE '+e.message));
// A returning cadet: one line already held. Written the way the game writes it.
await page.addInitScript(()=>{ try{ localStorage.clear();
  localStorage.setItem('ascent.save', JSON.stringify({shards:24, mastery:{skills:{'var-meaning':{pL:0.97,mastered:true,attempts:12,correct:11,assisted:0,lastSeen:Date.now(),n:12,streak:4}}}}));
}catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
let n=0; const shot=async(t)=>page.screenshot({path:`${OUT}/${String(++n).padStart(2,'0')}-${t}.png`});
const S=()=>page.evaluate(()=>{const A=window.__ascent,p=A.player.pos,o=A.afford.state();
 return {p:[+p.x.toFixed(1),+p.z.toFixed(1)],panel:A.panel.open,
  mastered:A.rifts.list.filter(r=>r.mastered).map(r=>r.id),
  unlocked:A.rifts.list.filter(r=>!r.locked&&!r.mastered).map(r=>r.id),
  objective:A.nextObjective()?.id, heading:o.heading, road:o.road,
  calls:o.calls.map(c=>`${c.id}:${c.verb}:${c.key||'-'}:${c.far}`),
  guide:(document.querySelector('.gd-card')?.innerText||'').replace(/\n/g,' / ')};});
console.log('start', JSON.stringify(await S()));
await shot('spawn-held-one');
await page.mouse.move(720,405); await page.mouse.click(720,405); await page.waitForTimeout(400);
const held=new Set();
const setKeys=async(w)=>{for(const k of [...held])if(!w.has(k)){await page.keyboard.up(k);held.delete(k);}for(const k of w)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}};
const walkTo=async(tx,tz,tol=1.5,max=90000)=>{const t0=Date.now();for(;;){
  const p=await page.evaluate(()=>{const A=window.__ascent,q=A.player.pos;return{x:q.x,z:q.z,panel:A.panel.open};});
  if(p.panel){await setKeys(new Set());return {panel:true,sec:(Date.now()-t0)/1000};}
  const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
  if(d<tol||Date.now()-t0>max){await setKeys(new Set());return {panel:false,d:+d.toFixed(1),to:Date.now()-t0>max,sec:(Date.now()-t0)/1000};}
  const w=new Set(); if(Math.abs(dz)>d*0.38)w.add(dz<0?'KeyW':'KeyS'); if(Math.abs(dx)>d*0.38)w.add(dx>0?'KeyD':'KeyA'); w.add('ShiftLeft');
  await setKeys(w); await page.waitForTimeout(140);}};
// The player follows the objective the game is showing him.
const tgt = await page.evaluate(()=>{const A=window.__ascent;const id=A.nextObjective()?.id;const r=A.rifts.list.find(x=>x.id===id);return r?{id:r.id,x:r.foot.x,z:r.foot.z}:null;});
console.log('objective rift', JSON.stringify(tgt));
const w1 = await walkTo(tgt.x,tgt.z);
console.log('walk to objective', JSON.stringify(w1));
await page.waitForTimeout(900);
await shot('objective-open');
console.log('arrived', JSON.stringify(await S()));
console.log('PERF', JSON.stringify(await page.evaluate(()=>window.__ascent.state().perf)));
console.log('ERRORS', errs.slice(0,6));
await b.close();
