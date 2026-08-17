import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT='/Users/harrison/dev/aadmath/shots/w14-fun/warden';
await mkdir(OUT,{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const p=await (await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1})).newPage();
await p.goto('http://127.0.0.1:4917',{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ascent.locale','en');});
await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});await p.waitForTimeout(2000);
for (let i=0;i<5;i++){
  await p.evaluate(()=>{const A=window.__ascent;const r=A.rifts.list.find(x=>!x.sealed)||A.rifts.list[0];A.teleportTo(r.id);});
  await p.waitForTimeout(600);
  for(let k=0;k<8;k++){await p.keyboard.press('KeyE');await p.waitForTimeout(300);if(await p.evaluate(()=>window.__ascent.panelInfo().open))break;}
  const c=await p.evaluate(()=>window.__ascent.panelInfo());
  if(c.open&&c.mode==='keypad'){for(const ch of String(c.answer??'')){await p.keyboard.press(ch==='-'?'Minus':ch);await p.waitForTimeout(40);}await p.keyboard.press('Enter');}
  else if(c.open&&c.mode==='choice'){const bt=p.locator('.rf-reading');const n=await bt.count();for(let j=0;j<n;j++){if(String(await bt.nth(j).getAttribute('data-value'))===String(c.answer)){await bt.nth(j).click().catch(()=>{});break;}}}
  await p.waitForTimeout(2200);
  await p.evaluate(()=>window.__ascent.advanceDays(1));
  await p.waitForTimeout(400);
  await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});await p.waitForTimeout(2200);
}
const w=await p.evaluate(()=>window.__ascent.wardens.state());
console.log(JSON.stringify(w));
for(let k=0;k<6;k++){const bt=p.locator('button:visible');const n=await bt.count();let hit=false;for(let j=0;j<n;j++){const t=((await bt.nth(j).innerText().catch(()=>''))||'').trim().toUpperCase();if(/^(BEGIN THE RUN|GOT IT|STEP BACK|CONTINUE|GO|STAND DOWN|BACK TO THE RUN)$/.test(t)){await bt.nth(j).click().catch(()=>{});hit=true;await p.waitForTimeout(700);break;}}if(!hit)break;}
await p.waitForTimeout(1200);
if(w.at.length){
  // stand a player's distance off and look at it, the way it would be seen
  await p.evaluate(()=>{const A=window.__ascent;const a=A.wardens.state().at[0];
    A.player.pos.set(a.x-55,a.y-14,a.z-55);A.player.vel.set(0,0,0);
    window.__lk=()=>{const b=A.wardens.state().at[0];const c=A.camera;c.position.set(b.x-58,b.y-10,b.z-58);c.lookAt(b.x,b.y,b.z);};
    A.engine.add(()=>window.__lk());});
  await p.waitForTimeout(3000);
  await p.screenshot({path:OUT+'/warden-far.png'});
  await p.evaluate(()=>{const A=window.__ascent;window.__lk=()=>{const b=A.wardens.state().at[0];const c=A.camera;c.position.set(b.x-16,b.y+3,b.z-16);c.lookAt(b.x,b.y,b.z);};});
  await p.waitForTimeout(2500);
  await p.screenshot({path:OUT+'/warden-near.png'});
}
await b.close();
