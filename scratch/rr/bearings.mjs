import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:5173';
const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport:{width:1024,height:640} });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
page.on('pageerror',e=>errs.push('PE '+e.message));
await page.addInitScript(()=>{ try{ localStorage.clear(); }catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(2600);
await page.mouse.move(512,320); await page.mouse.click(512,320);
await page.waitForTimeout(400);

const P = ()=>page.evaluate(()=>{const A=window.__ascent,p=A.player.pos;return {x:p.x,z:p.z,y:p.y,panel:A.panel.open};});
const flash = ()=>page.evaluate(()=>[...document.querySelectorAll('.hud-flash,.hud-say')].map(e=>e.textContent).filter(Boolean).join(' | '));
const rift = await page.evaluate(()=>{const r=window.__ascent.rifts.list.find(x=>x.id==='var-meaning');return {x:r.foot.x,z:r.foot.z};});
console.log('rift', rift);

const held = new Set();
async function setKeys(want){
  for(const k of [...held]) if(!want.has(k)){ await page.keyboard.up(k); held.delete(k); }
  for(const k of want) if(!held.has(k)){ await page.keyboard.down(k); held.add(k); }
}
async function goto(tx,tz,{tol=2.5,max=40000}={}){
  const t0=Date.now();
  for(;;){
    const p=await P();
    if(p.panel) return {reached:false,panel:true,p};
    const dx=tx-p.x, dz=tz-p.z, d=Math.hypot(dx,dz);
    if(d<tol){ await setKeys(new Set()); return {reached:true,p}; }
    if(Date.now()-t0>max){ await setKeys(new Set()); return {reached:false,timeout:true,p}; }
    const want=new Set();
    // camera fixed facing -Z: W=-z, S=+z, D=+x, A=-x
    if(Math.abs(dz)>d*0.38) want.add(dz<0?'KeyW':'KeyS');
    if(Math.abs(dx)>d*0.38) want.add(dx>0?'KeyD':'KeyA');
    await setKeys(want);
    await page.waitForTimeout(160);
  }
}
const BEAR=[0,45,90,135,180,225,270,315];
const res=[];
for(const bdeg of BEAR){
  await page.evaluate(()=>window.__ascent.panel.open&&window.__ascent.panel.hide&&window.__ascent.panel.hide());
  const th=bdeg*Math.PI/180;
  const sx=rift.x+Math.cos(th)*24, sz=rift.z+Math.sin(th)*24;
  // stage: go somewhere 24m out on this bearing, via a waypoint well clear of the rift
  const wx=rift.x+Math.cos(th)*46, wz=rift.z+Math.sin(th)*46;
  await goto(wx,wz,{tol:4});
  const st=await goto(sx,sz,{tol:3});
  if(st.panel){ res.push([bdeg,'OPENED-EARLY']); continue; }
  const before=await P();
  const r=await goto(rift.x,rift.z,{tol:1.5,max:20000});
  const f=await flash();
  res.push([bdeg, r.panel?'OPENED':'no-open', 'from', [Math.round(before.x),Math.round(before.z)], 'flash:', f.slice(0,70)]);
  console.log(JSON.stringify(res[res.length-1]));
  if(r.panel){
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    // walk off so it re-arms
    await goto(rift.x+Math.cos(th)*30, rift.z+Math.sin(th)*30, {tol:5});
  }
}
await setKeys(new Set());
console.log('RESULTS'); for(const r of res) console.log(JSON.stringify(r));
console.log('ERRORS',errs.slice(0,5));
await b.close();
