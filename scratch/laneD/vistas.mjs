/** LANE D DIAGNOSTIC: look off the island's edges and photograph what is there. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const OUT = path.resolve(arg('out', 'shots/laneD/vistas'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.waitForTimeout(2600);
await page.evaluate(() => {
  document.getElementById('boot')?.classList.add('gone');
  document.getElementById('ui')?.style.setProperty('display', 'none');
});
const spots = [];
for (let b = 0; b < 8; b++) {
  const th = (b / 8) * Math.PI * 2;
  spots.push({ tag: `coast${b}`, r: 168, th, pitch: -0.55 });
  spots.push({ tag: `coastlvl${b}`, r: 168, th, pitch: -0.10 });
}
spots.push({ tag: 'up-plaza', r: 20, th: 0.5, pitch: 0.55 });
spots.push({ tag: 'up-mid', r: 90, th: 2.0, pitch: 0.60 });
for (const s of spots) {
  const x = Math.cos(s.th) * s.r, z = Math.sin(s.th) * s.r;
  const ok = await page.evaluate(([px, pz, yaw, pitch]) => {
    const a = window.__ascent; const h = a.islandAt(px, pz);
    if (h === null) return false;
    a.player.pos.set(px, h + 0.2, pz); a.player.vel.set(0, 0, 0);
    a.player.yaw = yaw; if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
    a.player.cam?.refound?.();
    return true;
  }, [x, z, Math.atan2(-x, -z) + Math.PI, s.pitch]);
  if (!ok) { console.log(s.tag, 'off island'); continue; }
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, s.tag + '.png') });
  console.log('shot', s.tag);
}
await browser.close();
