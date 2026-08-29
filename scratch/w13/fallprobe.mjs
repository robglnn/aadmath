/** Walk off the shard the way the cold-play gate does, and sample the catch. */
import { chromium } from 'playwright';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const b=await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
p.on('pageerror',(e)=>console.log('ERR',e.message));
await p.goto(arg('url','http://127.0.0.1:4996'),{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear();}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(4500);
await p.mouse.click(800,450);
const f=()=>p.evaluate(()=>{const a=window.__ascent,q=a.player.pos;return{
  x:q.x,y:q.y,z:q.z,ground:a.islandAt(q.x,q.z),surface:a.surfaceAt(q.x,q.z),
  grounded:!!a.player.grounded,rec:a.player.recoveries|0,falling:!!a.player.falling,
  outside:a.outside(q.x,q.y,q.z),deck:a.deck().deck,ui:!!a.input.uiOpen};});
const runs=[['KeyW'],['KeyW','KeyD'],['KeyW','KeyA'],['KeyA'],['KeyS']];
for (const r of runs) {
  await p.keyboard.press('KeyR'); await p.waitForTimeout(1000); await p.mouse.click(800,450);
  await p.keyboard.down('ShiftLeft'); for(const k of r) await p.keyboard.down(k);
  let off=0,done=false;
  const t0=Date.now();
  while((Date.now()-t0)/1000<52 && !done){
    await p.waitForTimeout(200);
    const g=await f();
    if(g.ui){ await p.keyboard.press('Escape'); await p.waitForTimeout(300); continue; }
    if(!off && g.ground===null && g.surface===null){ off=Date.now(); await p.keyboard.down('Space');
      console.log(`${r.join('+')}: left at y=${g.y.toFixed(1)} r=${Math.hypot(g.x,g.z).toFixed(0)} deck=${g.deck.toFixed(1)}`); }
    if(off){
      const el=(Date.now()-off)/1000;
      if((g.ground!==null||g.surface!==null)&&g.grounded){ console.log(`   caught after ${el.toFixed(2)}s`); done=true; }
      else if(el>9){ console.log(`   NOT CAUGHT after ${el.toFixed(1)}s — y=${g.y.toFixed(1)} outside=${g.outside} falling=${g.falling} rec=${g.rec}`); done=true; }
    }
  }
  await p.keyboard.up('Space').catch(()=>{}); for(const k of r) await p.keyboard.up(k); await p.keyboard.up('ShiftLeft');
  if(!off) console.log(`${r.join('+')}: never left the world`);
}
await b.close();
