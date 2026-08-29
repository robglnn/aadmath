import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:5173';
const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport:{width:1280,height:720} });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
page.on('pageerror',e=>errs.push('PE '+e.message));
await page.addInitScript(()=>{ try{ localStorage.clear(); }catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(2800);
const out = await page.evaluate(()=>{
  const A=window.__ascent, p=A.player.pos, L=A.rifts.list;
  const G={'var-meaning':[], 'eval-expr':['var-meaning'],'order-ops':['eval-expr'],'like-terms':['eval-expr'],'distribute':['like-terms'],'one-step-add':['var-meaning'],'one-step-mul':['one-step-add'],'two-step':['one-step-mul','order-ops'],'multi-step':['two-step','distribute'],'both-sides':['multi-step']};
  const by={}; L.forEach(r=>by[r.id]=r);
  const walk=(ax,az,bx,bz)=>{const d=Math.hypot(bx-ax,bz-az);const n=Math.max(2,Math.ceil(d/2.5));let prev=A.islandAt(ax,az);if(prev===null)return 'VOID';let worst=0;
    for(let k=1;k<=n;k++){const x=ax+(bx-ax)*k/n,z=az+(bz-az)*k/n;const h=A.islandAt(x,z);if(h===null)return 'VOID';worst=Math.max(worst,Math.abs(h-prev));prev=h;}return worst.toFixed(2);};
  const pairs=[];
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
    const d=Math.hypot(L[i].foot.x-L[j].foot.x,L[i].foot.z-L[j].foot.z);
    if(d<26) pairs.push([L[i].id,L[j].id,+d.toFixed(1)]);
  }
  return {
    spawn:[+p.x.toFixed(1),+p.y.toFixed(1),+p.z.toFixed(1)],
    minSepViolations: pairs,
    rifts: L.map(r=>({id:r.id, foot:[+r.foot.x.toFixed(1),+r.foot.y.toFixed(1),+r.foot.z.toFixed(1)],
      ringY:+r.pos.y.toFixed(1),
      dSpawn:+Math.hypot(p.x-r.foot.x,p.z-r.foot.z).toFixed(1),
      approach: (G[r.id].length?G[r.id]:['@plaza']).map(pr=>{
        const f = pr==='@plaza'?{x:0,z:0}:{x:by[pr].foot.x,z:by[pr].foot.z};
        return pr+':'+walk(f.x,f.z,r.foot.x,r.foot.z)+' ('+Math.hypot(f.x-r.foot.x,f.z-r.foot.z).toFixed(0)+'m)';
      }),
    })),
    walkSpawnToVM: walk(p.x,p.z,by['var-meaning'].foot.x,by['var-meaning'].foot.z),
  };
});
console.log(JSON.stringify(out,null,1));
console.log('ERRORS',errs.slice(0,5));
await b.close();
