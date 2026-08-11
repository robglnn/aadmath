import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4877';
const browser = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.evaluate(() => localStorage.removeItem('ascent.save'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(3000);
await page.mouse.move(800,450); await page.mouse.click(800, 450); await page.waitForTimeout(400);

async function best(label) {
  let peak = 0, bestYaw = 0;
  for (const yaw of [0, 1.05, 2.1, 3.14, 4.2, 5.24]) {
    await page.evaluate((y) => { const a = window.__ascent, p = a.player;
      p.pos.set(0, (a.islandAt(0,26)||12) + 1.2, 26); p.vel.set(0,0,0); p.yaw = y; p.pitch = 0; }, yaw);
    await page.waitForTimeout(500);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(1600);
    const v = await page.evaluate(async () => { const p = window.__ascent.player; let m=0;
      for(let i=0;i<25;i++){ m=Math.max(m, Math.hypot(p.vel.x,p.vel.z)); await new Promise(r=>setTimeout(r,45)); } return m; });
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    if (v > peak) { peak = v; bestYaw = yaw; }
  }
  const k = await page.evaluate(() => window.__ascent.kit.state());
  console.log(`${label} measured top ground speed ${peak.toFixed(2)} m/s (yaw ${bestYaw.toFixed(2)}) | P.sprint=${k.move.sprint} jumpV=${k.move.jumpV} dashCool=${k.move.dashCool} held=${JSON.stringify(k.held)}`);
  return peak;
}
const a = await best('BEFORE:');
await page.evaluate(async () => {
  const a = window.__ascent;
  for (let i=0;i<300;i++){
    if ([...a.mastery.state.values()].filter(x=>x.mastered).length >= 5) break;
    const o = a.nextObjective(); if(!o) break;
    if(!a.openRiftById(o.id)) break;
    await new Promise(r=>setTimeout(r,110));
    if(a.panel.open){ a.panel.demo('right'); await new Promise(r=>setTimeout(r,220)); try{a.panel.close();}catch{} }
    await new Promise(r=>setTimeout(r,90));
  }
});
await page.waitForTimeout(1500); await page.mouse.click(800,450); await page.waitForTimeout(300);
const b = await best('AFTER 5 seals:');
console.log(`\nDELTA: ${a.toFixed(2)} -> ${b.toFixed(2)} m/s  (+${(100*(b/a-1)).toFixed(0)}%)`);
console.log('errors:', errs.length);
await browser.close();
