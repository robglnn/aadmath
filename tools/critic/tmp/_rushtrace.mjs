/** Read-only: record every placement the real rush makes, with its candidates. */
import { chromium } from 'playwright';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const br = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const p = await (await br.newContext({viewport:{width:1000,height:600}})).newPage();
p.on('pageerror',(e)=>console.log('ERR',e.message));
await p.goto(arg('url','http://127.0.0.1:5173'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(3800);
await p.evaluate(()=>{
  const a=window.__ascent,b=a.builder;
  b.drawHand(); b.clearAll();
  a.player.pos.set(-11, a.islandAt(-11,20.8)+0.02, 20.8);
  a.player.vel.set(0,0,0); a.player.yaw=Math.PI; a.player.pitch=0;
  window.__log=[];
  const orig=b.place.bind(b);
  b.place=function(){
    const tg=b.target();
    const cands=b._cands.map((c,i)=>[+c.toFixed(2), +b._cw[i].toFixed(1), b._cr[i]??-1]);
    const r=orig();
    window.__log.push({
      z:+a.player.pos.z.toFixed(2), y:+a.player.pos.y.toFixed(2),
      grounded:!!a.player.grounded, aim:`${tg.x},${tg.z}`, base:+tg.base.toFixed(2),
      ok:r.ok, why:r.reason||'', cands,
    });
    return r;
  };
});
await p.keyboard.press('Digit2');
await p.waitForTimeout(400);
console.log('slot', await p.evaluate(()=>window.__ascent.builder.slot));
await p.mouse.move(500,300);
await p.keyboard.down('KeyW'); await p.mouse.down();
await p.waitForTimeout(3400);
await p.mouse.up(); await p.keyboard.up('KeyW');
const log = await p.evaluate(()=>window.__log.filter((l)=>l.ok));
for (const l of log) {
  const aimY=l.y+1.62;
  const best=[...new Map(l.cands.map((c)=>[c[0]+'|'+c[2],c])).values()]
    .map(([c,w,r])=>({c,w,r,s:+(Math.abs(c-aimY)+w).toFixed(2)}))
    .sort((u,v)=>u.s-v.s).slice(0,4);
  console.log(`placed at z=${l.z} y=${l.y} grounded=${l.grounded} aim=${l.aim} -> base ${l.base}`);
  for (const b2 of best) console.log(`     cand ${String(b2.c).padStart(7)} w ${String(b2.w).padStart(5)} rank ${b2.r} score ${b2.s}`);
}
await br.close();
