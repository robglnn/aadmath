import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(URL,{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
await p.waitForTimeout(5000);
const handBack=async()=>{for(let i=0;i<8;i++){if(!(await p.evaluate(()=>!!window.__ascent.input.uiOpen)))return;
 let hit=false;for(const s of ['.sc-go','.ses-charter button','.ses-rest button','.rf-x']){const el=await p.$(s);
 if(el&&await el.isVisible()){await el.click().catch(()=>{});hit=true;break;}}
 if(!hit)await p.keyboard.press('Escape');await p.waitForTimeout(600);}};
await handBack();
const rec = await p.evaluate(()=>{const a=window.__ascent;const r=a.rifts.list.find(x=>!x.locked)||a.rifts.list[0];return {x:r.foot.x,z:r.foot.z,id:r.id};});
console.log('objective rift', rec.id);
for (const rad of [9.0, 9.5, 10, 10.5, 11, 24]) {
  const ok = await p.evaluate(({c,d})=>{const a=window.__ascent;const x=c.x+d,z=c.z;const h=a.islandAt(x,z);
    if(h===null)return false;a.player.pos.set(x,h+0.55,z);a.player.vel.set(0,0,0);return true;},{c:rec,d:rad});
  if(!ok){console.log(rad,'no ground');continue;}
  await p.waitForTimeout(800); await handBack();
  const before = await p.evaluate(()=>{const a=window.__ascent,q=a.player;const g=a.story.guide();
    return {x:q.pos.x,y:q.pos.y,z:q.pos.z,vx:q.vel.x,vy:q.vel.y,vz:q.vel.z,n:q.recoveries|0,dir:g&&g.dir,offers:g&&g.offers,prompt:g&&g.prompt,m:g&&g.metres};});
  console.log('   before raw:', JSON.stringify(before));
  await p.keyboard.press('KeyR');
  await p.waitForTimeout(1200);
  const after = await p.evaluate(()=>{const a=window.__ascent,q=a.player;const g=a.story.guide();
    return {x:q.pos.x,z:q.pos.z,n:q.recoveries|0,ground:a.islandAt(q.pos.x,q.pos.z),grounded:!!q.grounded,
      dir:g&&g.dir,offers:g&&g.offers,m:g&&g.metres};});
  const moved = Math.hypot(after.x-before.x, after.z-before.z);
  console.log(`@${rad}m  before: "${before.dir}" offers=${before.offers} ${before.m}m` +
    `  -> R moved ${moved.toFixed(1)}m (recoveries ${before.n}->${after.n}), now "${after.dir}" offers=${after.offers} ${after.m}m, solid=${after.ground!==null} grounded=${after.grounded}`);
}
console.log('console errors:', errs.length ? errs.slice(0,3) : 'none');
await b.close();
