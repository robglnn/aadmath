import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
await p.goto('http://127.0.0.1:4777',{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:45000});
await p.waitForTimeout(3500);
const r = await p.evaluate(()=>{
  const a=window.__ascent; const out=[];
  for(const s of a.skillIds){ const t=a.task(s)||{skill:s,difficulty:3};
    const it=a.itemFor({skill:s,difficulty:3,formCandidates:(a.formsBySkill[s]||[])});
    out.push({skill:s, forms:(a.formsBySkill[s]||[]).length, secs: it?a.itemSeconds(it):null, form: it&&it.form, rep: it&&it.rep}); }
  return { out, plan: a.state().session };
});
console.log('per-skill item cost seconds:');
for(const o of r.out) console.log(` ${o.skill.padEnd(14)} forms=${String(o.forms).padStart(2)} secs=${o.secs} sampleForm=${o.form} rep=${o.rep}`);
const s=r.out.map(o=>o.secs).filter(Number); 
console.log('median item seconds', s.sort((a,b)=>a-b)[Math.floor(s.length/2)]);
console.log('session plan', JSON.stringify(r.plan.run&&{minutes:r.plan.run.minutes,plannedItems:r.plan.run.plannedItems,target:r.plan.run.target}));
await b.close();
