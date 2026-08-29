import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const OUT = path.resolve(arg('out', 'shots/laneD/sawtooth'));
const TAG = arg('tag', 'x');
const X = Number(arg('x', 0)), Z = Number(arg('z', 0)), YAW = Number(arg('yaw', 0)), PITCH = Number(arg('pitch', 0));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.waitForTimeout(2600);
await page.evaluate(() => { document.getElementById('boot')?.classList.add('gone'); document.getElementById('ui')?.style.setProperty('display', 'none'); });
await page.evaluate(([px, pz, yaw, pitch]) => {
  const a = window.__ascent; const h = a.islandAt(px, pz);
  a.player.pos.set(px, h + 0.2, pz); a.player.vel.set(0, 0, 0);
  a.player.yaw = yaw; if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
  a.player.cam?.refound?.();
}, [X, Z, YAW, PITCH]);
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, TAG + '.png') });
console.log('shot', TAG);
await browser.close();
