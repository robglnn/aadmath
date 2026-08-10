import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/toggle'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const a = window.__ascent;
  const g = a.player.groundAt(0, 26);
  a.player.pos.set(0, g + 0.4, 26); a.player.vel.set(0, 0, 0);
  a.player.yaw = Math.PI; a.player.pitch = -0.02;
  document.getElementById('boot')?.classList.add('gone');
});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'all.png') });
for (const n of ['farland-ashen', 'ranges']) {
  await page.evaluate((nm) => { const o = window.__ascent.scene.getObjectByName(nm); if (o) o.visible = false; }, n);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `no-${n}.png`) });
  await page.evaluate((nm) => { const o = window.__ascent.scene.getObjectByName(nm); if (o) o.visible = true; }, n);
}
await browser.close();
