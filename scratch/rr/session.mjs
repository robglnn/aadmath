import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = process.argv[2] || 'http://127.0.0.1:4488';
const OUT = process.argv[3] || 'shots/rr-session';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport:{width:1440,height:810} });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
page.on('pageerror',e=>errs.push('PE '+e.message));
await page.addInitScript(()=>{try{localStorage.clear()}catch{}});
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
let step=0;
const shot=async(n)=>{ await page.screenshot({path:`${OUT}/${String(++step).padStart(2,'0')}-${n}.png`}); };
const S=()=>page.evaluate(()=>{const A=window.__ascent,p=A.player.pos;const o=A.afford.state();
  return {p:[+p.x.toFixed(1),+p.z.toFixed(1)],panel:A.panel.open,
   sealed:Object.entries(A.mastery.save().skills).filter(([k,v])=>v.mastered).map(([k])=>k),
   heading:o.heading, road:o.road, calls:o.calls.map(c=>c.id+':'+c.verb+':'+(c.key||'-')+':'+c.far)};});

await shot('spawn');
console.log('spawn', JSON.stringify(await S()));
await page.mouse.move(720,405); await page.mouse.click(720,405); await page.waitForTimeout(400);

const held=new Set();
async function setKeys(w){ for(const k of [...held]) if(!w.has(k)){await page.keyboard.up(k);held.delete(k);} for(const k of w) if(!held.has(k)){await page.keyboard.down(k);held.add(k);} }
async function walkTo(tx,tz,{tol=2.0,max=90000}={}){
  const t0=Date.now();
  for(;;){
    const p=await page.evaluate(()=>{const A=window.__ascent,p=A.player.pos;return {x:p.x,z:p.z,panel:A.panel.open};});
    if(p.panel){await setKeys(new Set());return {panel:true,d:Math.hypot(tx-p.x,tz-p.z)};}
    const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
    if(d<tol||Date.now()-t0>max){await setKeys(new Set());return {panel:false,d,timeout:Date.now()-t0>max};}
    const w=new Set();
    if(Math.abs(dz)>d*0.38) w.add(dz<0?'KeyW':'KeyS');
    if(Math.abs(dx)>d*0.38) w.add(dx>0?'KeyD':'KeyA');
    w.add('ShiftLeft');
    await setKeys(w); await page.waitForTimeout(150);
  }
}
async function clickText(txts){
  const btns = await page.locator('.rf-pad button:visible, .rift button:visible, button:visible').all();
  for(const bn of btns){
    if(!(await bn.isEnabled().catch(()=>false))) continue;
    const tx=(await bn.textContent()||'').trim();
    if(txts.some(t=>tx===t||tx.toLowerCase()===String(t).toLowerCase())){
      try{ await bn.click({timeout:1500}); return true; }catch{ continue; } } }
  return false;
}
async function answerRealClicks(){
  const ans = await page.evaluate(()=>String(window.__ascent.panel.item?.answer ?? ''));
  const hasPad = await page.evaluate(()=>!!window.__ascent.panel._modality?.set);
  if(!hasPad || /[a-zA-Z/]/.test(ans)){
    await page.evaluate((a)=>window.__ascent.enter(a), ans);
    return {ok:true,ans,via:'non-keypad surface'};
  }
  const neg = ans.startsWith('-');
  const clicked=[];
  for(const ch of ans.replace('-','')){
    if(!await clickText([ch])){
      await page.evaluate((a)=>window.__ascent.enter(a), ans);
      return {ok:true,ans,clicked,via:'fallback keypad api'};
    }
    clicked.push(ch);
  }
  if(neg) await clickText(['±']);
  if(!await clickText(['Seal','Sellar','Zamknij','Set','Fijar','Ustaw'])) await page.keyboard.press('Enter');
  return {ok:true,ans,clicked};
}

// --- 1. walk to rift 1 with real keys, no building ---
const r1 = await page.evaluate(()=>{const r=window.__ascent.rifts.list.find(x=>!x.locked);return {id:r.id,x:r.foot.x,z:r.foot.z};});
console.log('rift1',r1);
const t0=Date.now();
const w = await walkTo(r1.x,r1.z,{tol:1.5});
console.log('walk result', JSON.stringify(w), 'seconds', ((Date.now()-t0)/1000).toFixed(1));
await page.waitForTimeout(900);
await shot('rift1-open');
console.log('after walk', JSON.stringify(await S()));

// --- 2. answer until sealed, with real clicks ---
for(let i=0;i<70;i++){
  const open = await page.evaluate(()=>window.__ascent.panel.open);
  if(!open){
    const s = await S();
    if(s.sealed.length) break;
    // step off the plate so the world re-arms, then walk back in — real keys
    await walkTo(r1.x+13, r1.z+6, {tol:2.5,max:20000});
    await walkTo(r1.x,r1.z,{tol:1.5,max:20000});
    await page.waitForTimeout(700);
    continue;
  }
  const idBefore = await page.evaluate(()=>window.__ascent.panel.item?.prompt||String(window.__ascent.panel.item?.answer));
  const a = await answerRealClicks();
  if(!a.ok){ console.log('ANSWER FAIL', JSON.stringify(a)); break; }
  if(a.via) console.log('  (via', a.via + ')');
  // wait for the surface to actually move on, not for a fixed guess
  for(let k=0;k<40;k++){
    const now = await page.evaluate(()=>window.__ascent.panel.open ? (window.__ascent.panel.item?.prompt||String(window.__ascent.panel.item?.answer)) : null);
    if(now===null || now!==idBefore) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
  const s=await S();
  console.log(' answered', a.ans, 'sealed:', s.sealed.join(','));
  if(s.sealed.length) { await shot('sealed'); break; }
}
await page.waitForTimeout(1500);
// close whatever is up
for(let i=0;i<4;i++){ if(await page.evaluate(()=>window.__ascent.panel.open)){ await page.keyboard.press('Escape'); await page.waitForTimeout(800);} }
await page.waitForTimeout(1200);
await shot('after-seal');
console.log('post-seal', JSON.stringify(await S()));

// --- 3. the game must now point at rift 2 ---
const nxt = await page.evaluate(()=>{const A=window.__ascent;const o=A.afford.state();
  const ob=A.nextObjective();const r=A.rifts.list.find(x=>x.id===ob?.id&&!x.locked);
  return {objective:ob?.id, heading:o.heading, road:o.road, target:r?{id:r.id,x:r.foot.x,z:r.foot.z}:null,
    calls:o.calls.map(c=>c.id+':'+c.verb+':'+c.far)};});
console.log('next', JSON.stringify(nxt));
if(nxt.target){
  const t1=Date.now();
  const w2 = await walkTo(nxt.target.x,nxt.target.z,{tol:1.5});
  console.log('walk to rift2', nxt.target.id, JSON.stringify(w2), 'seconds', ((Date.now()-t1)/1000).toFixed(1));
  await page.waitForTimeout(900);
  await shot('rift2-open');
  console.log('at rift2', JSON.stringify(await S()));
}
const perf = await page.evaluate(()=>window.__ascent.state().perf);
console.log('PERF', JSON.stringify(perf));
console.log('ERRORS', errs.slice(0,8));
await b.close();
