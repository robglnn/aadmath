import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = process.argv[2] || 'http://127.0.0.1:4877';
await mkdir('shots/critic-look', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.evaluate(() => localStorage.removeItem('ascent.save'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(4000);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await page.mouse.move(800,450); await page.mouse.click(800,450); await page.waitForTimeout(300);

// approach cache 1 from the air, as a glider would
for (const [name, d, h, pitch] of [['cache-far', 40, 10, -0.16], ['cache-mid', 22, 6, -0.10], ['cache-near', 13, 3.5, 0.02]]) {
  await page.evaluate(({ d, h, pitch }) => {
    const a = window.__ascent, p = a.player;
    const c = a.caches.state().at[1];
    p.pos.set(c.x, c.y + h, c.z + d); p.vel.set(0,0,0); p.yaw = Math.PI; p.pitch = pitch;
    a.player.loco.state = 'air';
  }, { d, h, pitch });
  await page.waitForTimeout(250);
  await page.evaluate(({ d, h, pitch }) => { // hold it still: no gravity drift in the shot
    const a = window.__ascent, p = a.player;
    const c = a.caches.state().at[1];
    p.pos.set(c.x, c.y + h, c.z + d); p.vel.set(0,0,0); p.yaw = Math.PI; p.pitch = pitch;
  }, { d, h, pitch });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `shots/critic-look/${name}.png` });
}
// the drift field / mote vein, on the ground
await page.evaluate(() => { const a = window.__ascent, p = a.player; p.pos.set(0,(a.islandAt(0,40)||12)+2,40); p.vel.set(0,0,0); p.yaw=Math.PI; p.pitch=-0.12; });
await page.waitForTimeout(1400);
await page.screenshot({ path: 'shots/critic-look/motes.png' });
console.log('errors', errs.length, errs.slice(0,4));
await browser.close();
