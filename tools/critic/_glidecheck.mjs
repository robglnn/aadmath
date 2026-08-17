import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(4500);
const handBack=async()=>{for(let i=0;i<8;i++){if(!(await p.evaluate(()=>!!window.__ascent.input.uiOpen)))return;
 let hit=false;for(const s of ['.sc-go','.ses-charter button','.ses-rest button','.rf-x']){const el=await p.$(s);
 if(el&&await el.isVisible()){await el.click().catch(()=>{});hit=true;break;}}
 if(!hit)await p.keyboard.press('Escape');await p.waitForTimeout(600);}};
await handBack();
// walk left (the 44m cliff bearing) holding Space the whole way: a deliberate flight
await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyA');
let off=false, offAt=0, flew=0, caught=null; const trace=[];
const t0=Date.now();
while((Date.now()-t0)/1000 < 40){
  await p.waitForTimeout(100);
  const el=(Date.now()-t0)/1000;
  const f=await p.evaluate(()=>{const a=window.__ascent,q=a.player.pos;
    return {y:q.y,g:a.islandAt(q.x,q.z),gl:!!a.player.gliding,gr:!!a.player.grounded,c:a.player.caught|0,ui:!!a.input.uiOpen,r:Math.hypot(q.x,q.z)};});
  if(f.ui){await handBack();continue;}
  if(!off){ if(f.g===null){off=true;offAt=el;await p.keyboard.down('Space');} continue; }
  flew=el-offAt;
  trace.push(`${flew.toFixed(2)}s y=${f.y.toFixed(1)} r=${f.r.toFixed(0)} gliding=${f.gl} caught=${f.c}`);
  if(f.c>0 && caught===null){caught={t:flew,y:f.y,r:f.r,gliding:f.gl};break;}
  if(f.gr){break;}
}
await p.keyboard.up('KeyA');await p.keyboard.up('Space');await p.keyboard.up('ShiftLeft');
console.log(trace.join('\n'));
console.log('flight held for', flew.toFixed(2),'s; caught:', JSON.stringify(caught));
await b.close();
