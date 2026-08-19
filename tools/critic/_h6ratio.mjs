import { chromium } from 'playwright';
const URL='http://127.0.0.1:4777';
const b=await chromium.launch({headless:true,args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
await page.goto(URL,{waitUntil:'networkidle'});
await page.evaluate(()=>{try{localStorage.clear()}catch{}});
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(4000);
await page.evaluate(async()=>{const A=window.__ascent;for(let i=0;i<200;i++){const o=A.nextObjective();if(!o)break;if(!A.openRiftById(o.id))break;const inf=A.panelInfo();if(!inf.open)break;A.enter(inf.answer);await new Promise(r=>setTimeout(r,15));try{A.panel.close?.()}catch{}await new Promise(r=>setTimeout(r,8));}});
await page.evaluate(()=>window.__ascent.advanceDays(1));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
await page.evaluate(async()=>{const A=window.__ascent;for(let i=0;i<200;i++){const o=A.nextObjective();if(!o)break;if(!A.openRiftById(o.id))break;const inf=A.panelInfo();if(!inf.open)break;A.enter(inf.answer);await new Promise(r=>setTimeout(r,15));try{A.panel.close?.()}catch{}await new Promise(r=>setTimeout(r,8));}});
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(4000);
console.log('kit',JSON.stringify(await page.evaluate(()=>{const k=window.__ascent.kit.state();return {held:k.held,glideBase:k.move.glideBase,glideMax:k.move.glideMax}})));
for(let i=0;i<6;i++){await page.keyboard.press('Escape');await page.waitForTimeout(250);}
await page.evaluate(()=>document.activeElement?.blur?.());
await page.mouse.click(640,360);await page.waitForTimeout(400);
// put him high in free air by JUMPING off the highest terrain he can reach:
// instead, drop him from altitude using the game's own recovery-free physics:
// stand at PEAK via terrain sampling is not available; so measure ratio in the air after a fall start.
const start=await page.evaluate(()=>{const A=window.__ascent;A.player.pos.set(0,220,0);A.player.vel.set(0,0,0);return {...A.player.pos}});
console.log('start',JSON.stringify(start));
await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(700);
await page.keyboard.down('Space');   // ONE keydown, held — exactly what a hand does
const rows=[];
for(let i=0;i<90;i++){
  rows.push(await page.evaluate(()=>{const A=window.__ascent,p=A.player,L=p.loco;return {x:+p.pos.x.toFixed(1),y:+p.pos.y.toFixed(1),z:+p.pos.z.toFixed(1),vy:+(L.vel?.y??0).toFixed(1),gl:!!L.gliding}}));
  await page.waitForTimeout(120);
}
await page.keyboard.up('Space');await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
const g=rows.filter(r=>r.gl);
if(g.length>3){const a=g[2],z=g[g.length-1];
 const dh=Math.hypot(z.x-a.x,z.z-a.z), dv=a.y-z.y;
 console.log('glide samples',g.length,'horiz',dh.toFixed(1),'drop',dv.toFixed(1),'RATIO',(dh/dv).toFixed(2)+':1');}
console.log(JSON.stringify(rows.filter((_,i)=>i%6===0)));
await b.close();
