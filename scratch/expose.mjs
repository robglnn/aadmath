import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(process.argv[2], { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(2500);
await p.mouse.click(640,360);
await p.waitForFunction(()=>window.__ascent.audio?.built,null,{timeout:10000});
const spots=[['plaza',0,26],['spine summit',24,-114],['grove',40,-30],['vale hollow',-26,62],['wastes',58,-96],['fen',30,100]];
for (const [name,x,z] of spots){
  await p.evaluate(([x,z])=>{const a=window.__ascent;a.player.pos.set(x,(a.player.groundAt(x,z)??20)+0.4,z);a.player.vel.set(0,0,0);},[x,z]);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1400); await p.keyboard.up('KeyW');
  await p.waitForTimeout(400);
  const r = await p.evaluate(()=>{const a=window.__ascent.audio;return{ex:+(a._expose??-1).toFixed(2),tone:Math.round(a.amb.windTone.frequency.value),sfc:a._surface,mid:+a.amb.wMid.g.gain.value.toFixed(4)};});
  console.log(name.padEnd(13), 'expose',String(r.ex).padStart(5), ' wind top', String(r.tone).padStart(6)+'Hz', ' surface', r.sfc, ' mid', r.mid);
}
// the wing
await p.evaluate(()=>{const a=window.__ascent;a.player.pos.set(0,(a.player.groundAt(0,30)??12)+110,30);a.player.vel.set(0,0,0);});
await p.waitForTimeout(900); await p.keyboard.press('Space'); await p.waitForTimeout(1500);
const g = await p.evaluate(()=>{const a=window.__ascent.audio;return{glide:!!a.refs.player.loco.gliding,cloth:+a.amb.wCloth.g.gain.value.toFixed(4),edge:+a.amb.wEdge.g.gain.value.toFixed(4)};});
console.log('glide:', JSON.stringify(g));
console.log(errs.length?('ERRORS '+errs.slice(0,3).join(' | ')):'no console errors');
await b.close();
