/** Free roam with no maths at all: what is there to do? Plus camera behaviour. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('shots/roam'); await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:2 })).newPage();
const logs=[]; page.on('pageerror',e=>logs.push(e.message)); page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});
let n=0; const shot=async(s,ms=200)=>{await page.waitForTimeout(ms);await page.screenshot({path:path.join(OUT,`${String(++n).padStart(2,'0')}-${s}.png`)});};
const say=[]; const log=s=>{say.push(s);console.log(s);};
await page.goto('http://127.0.0.1:4457',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.evaluate(()=>localStorage.removeItem('ascent.save'));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3500);

// pointer lock via a click on an empty part of the screen, then immediately undo any build
await page.mouse.move(W/2,H/2); await page.mouse.click(W/2,H/2);
await page.keyboard.press('KeyQ');
await page.waitForTimeout(300);

// 60 seconds of pure traversal — run, look, jump, glide, land, repeat
const p0 = await page.evaluate(()=>window.__ascent.player.pos.toArray().map(v=>+v.toFixed(0)));
await page.keyboard.down('ShiftLeft');
for (let leg=0; leg<6; leg++) {
  await page.keyboard.down('KeyW');
  await page.mouse.move(W/2 + (leg%2?-1:1)*300, H/2 + 40, { steps: 25 });
  await page.waitForTimeout(2200);
  await page.keyboard.press('Space'); await page.waitForTimeout(260);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await shot(`leg${leg}-air`, 200);
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(2400);
  await shot(`leg${leg}-glide`, 100);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(2200);
  await shot(`leg${leg}-land`, 300);
  const s = await page.evaluate(()=>({ y:+window.__ascent.player.pos.y.toFixed(0), fps: Math.round(window.__ascent.state().fps), grounded: window.__ascent.player.grounded }));
  log(`leg${leg} ${JSON.stringify(s)}`);
}
await page.keyboard.up('ShiftLeft');
const p1 = await page.evaluate(()=>window.__ascent.player.pos.toArray().map(v=>+v.toFixed(0)));
log(`roamed ${JSON.stringify(p0)} -> ${JSON.stringify(p1)}`);
log('perf ' + JSON.stringify(await page.evaluate(()=>window.__ascent.state().perf)));
log('after 60s of pure movement, nothing solved: ' + JSON.stringify(await page.evaluate(()=>{const s=window.__ascent.state();return {shards:s.shards,integrity:s.integrity,tears:s.session.run?.tears};})));

// ONE clean floor next to a rift -> is the area model legible?
await page.evaluate(()=>{ const a=window.__ascent; const r=a.rifts.list.find(x=>x.id==='distribute')||a.rifts.list[0];
  a.player.pos.set(r.group.position.x+3, r.group.position.y+1, r.group.position.z+5); a.player.vel.set(0,0,0);
  a.player.yaw=Math.PI; a.player.pitch=-0.25; });
await page.waitForTimeout(900);
await page.keyboard.press('Digit3');
await page.evaluate(()=>window.__ascent.build());
await page.waitForTimeout(1400);
await shot('one-floor-areamodel', 900);
await page.keyboard.press('Digit4');
await page.evaluate(()=>{ window.__ascent.player.pos.x += 5; });
await page.waitForTimeout(500);
await page.evaluate(()=>window.__ascent.build());
await page.waitForTimeout(1600);
await shot('one-beam-balance', 900);

await writeFile(path.join(OUT,'notes.txt'), say.join('\n'));
console.log('ERRORS', logs.length, logs.slice(0,4).join(' | '));
await browser.close();
