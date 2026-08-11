/** Can a player actually climb to an anchor with the build verb? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('shots/climb'); await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:2 })).newPage();
const logs=[]; page.on('pageerror',e=>logs.push(e.message)); page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});
let n=0; const shot=async(s,ms=250)=>{await page.waitForTimeout(ms);await page.screenshot({path:path.join(OUT,`${String(++n).padStart(2,'0')}-${s}.png`)});};
await page.goto('http://127.0.0.1:4457',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.evaluate(()=>localStorage.removeItem('ascent.save'));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);

const a = await page.evaluate(()=>window.__ascent.anchors());
const A = a.at[0];
console.log('anchor', A.map(v=>+v.toFixed(1)), 'total', a.total);

// stand a run-up away from the anchor column, facing it
await page.evaluate((p)=>{const g=window.__ascent;g.player.pos.set(p[0],g.islandAt(p[0],p[2]+10)+1.5,p[2]+10);g.player.vel.set(0,0,0);g.player.yaw=Math.PI;g.player.pitch=-0.05;},A);
await page.waitForTimeout(800);
await shot('start',600);
console.log('start y', await page.evaluate(()=>+window.__ascent.player.pos.y.toFixed(1)), 'anchor y', A[1].toFixed(1));

// select RAMP and walk-and-place, the way a Fortnite player ramps up
await page.mouse.move(W/2,H/2); await page.mouse.click(W/2,H/2); await page.waitForTimeout(200);
await page.keyboard.press('Digit2');
await page.keyboard.down('KeyW');
for (let i=0;i<20;i++){
  const t = await page.evaluate(()=>{const b=window.__ascent.buildTarget();const r=window.__ascent.build();return {ok:!!r&&r!==false, valid:b.valid, reason:b.reason, y:+b.y.toFixed(1), py:+window.__ascent.player.pos.y.toFixed(1)};});
  if(i%5===0) console.log('step',i,JSON.stringify(t));
  await page.waitForTimeout(420);
  if(i===6) await shot('ramp-7',100);
}
await page.keyboard.up('KeyW');
await page.waitForTimeout(1200);
await shot('ramped',600);
const py = await page.evaluate(()=>+window.__ascent.player.pos.y.toFixed(1));
console.log('after ramping: player y', py, 'need', A[1].toFixed(1), 'anchors', JSON.stringify(await page.evaluate(()=>window.__ascent.anchors())));

// straight-up pillar with jump-place (no glider: single jump only)
await page.evaluate((p)=>{const g=window.__ascent;g.player.pos.set(p[0],g.islandAt(p[0],p[2])+1.5,p[2]);g.player.vel.set(0,0,0);g.player.pitch=-1.3;},A);
await page.keyboard.press('Digit3'); // FLOOR under my feet
await page.waitForTimeout(600);
const y0 = await page.evaluate(()=>+window.__ascent.player.pos.y.toFixed(1));
for(let i=0;i<12;i++){
  await page.keyboard.press('Space');
  await page.waitForTimeout(130);
  const r = await page.evaluate(()=>{const b=window.__ascent.buildTarget();const ok=window.__ascent.build();return {ok:ok!==false&&ok!=null,valid:b.valid,reason:b.reason,by:+b.y.toFixed(1),py:+window.__ascent.player.pos.y.toFixed(1)};});
  if(i%3===0) console.log('pillar',i,JSON.stringify(r));
  await page.waitForTimeout(420);
}
await page.waitForTimeout(900);
await page.evaluate(()=>{window.__ascent.player.pitch=-0.15;});
await shot('pillar',700);
const y1 = await page.evaluate(()=>+window.__ascent.player.pos.y.toFixed(1));
console.log(`pillar: ${y0} -> ${y1} (gain ${(y1-y0).toFixed(1)}), anchor at ${A[1].toFixed(1)}`);
console.log('anchors', JSON.stringify(await page.evaluate(()=>window.__ascent.anchors())));

// and just fly there to see what securing an anchor gives you
await page.evaluate((p)=>{const g=window.__ascent;g.player.pos.set(p[0],p[1]+0.5,p[2]);g.player.vel.set(0,0,0);},A);
await page.waitForTimeout(1600);
await shot('at-anchor',800);
console.log('anchors at anchor', JSON.stringify(await page.evaluate(()=>window.__ascent.anchors())));
const dom = await page.evaluate(()=>document.body.innerText.replace(/\n{2,}/g,'\n').slice(0,600));
console.log('--- HUD ---\n'+dom);
console.log('ERRORS', logs.length, logs.slice(0,3).join('|'));
await browser.close();
