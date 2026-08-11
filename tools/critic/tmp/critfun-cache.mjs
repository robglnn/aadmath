/** Can you see the hardest content in the game from the air? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = 'http://127.0.0.1:4788';
const OUT = 'shots/critfun-cache';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);

const list = await page.evaluate(() => window.__ascent.caches.list.map((c) => ({ i: c.i, x: c.x, y: c.y, z: c.z })));
const shots = [];
for (const c of list) {
  for (const [tag, d, dy, pitch] of [['near', 34, 6, -0.10], ['far', 90, 22, -0.16]]) {
    await page.evaluate(({ c, d, dy, pitch }) => {
      const A = window.__ascent;
      const ang = Math.atan2(c.z, c.x);
      const px = c.x + Math.cos(ang) * d, pz = c.z + Math.sin(ang) * d;
      A.player.pos.set(px, c.y + dy, pz);
      A.player.vel.set(0, 0, 0);
      const yaw = Math.atan2(-(c.x - px), -(c.z - pz));
      A.player.yaw = yaw;
      A.player.pitch = pitch;
      if (A.player.cam) { A.player.cam.yaw = yaw; A.player.cam.pitch = pitch; }
    }, { c, d, dy, pitch });
    await page.waitForTimeout(900);
    const f = `${OUT}/cache${c.i}-${tag}.png`;
    await page.screenshot({ path: f });
    shots.push(f);
  }
}
console.log(JSON.stringify({ errors, list, shots }, null, 1));
await browser.close();
