/** Phone. Real touch only — no keyboard anywhere in this file. */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/affordtouch'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['Pixel 7'], hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);
const shot = async (n, ms = 400) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };
await shot('01-phone-arrival');
console.log('INPUT', await page.evaluate(() => document.documentElement.dataset.input + '/' + document.documentElement.dataset.touch));
console.log('STATE', JSON.stringify(await page.evaluate(() => window.__ascent.afford.state())));

// Drive the thumbstick toward the objective, real touch drags.
const box = await page.evaluate(() => {
  const el = document.querySelector('.touch-stick, .tc-stick, .pad-stick, [class*="stick"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
});
console.log('STICK', JSON.stringify(box));

// Tap the affordance plate directly — the phone's equivalent of E.
const plate = await page.$('.afd-call:not([style*="display: none"]) .afd-plate');
if (plate) {
  const r = await plate.boundingBox();
  console.log('PLATE BOX', JSON.stringify(r));
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(1400);
  console.log('AFTER TAP panel=', await page.evaluate(() => window.__ascent.panel.open));
  await shot('02-after-tap');
} else {
  console.log('NO PLATE ON SCREEN');
}
console.log('CONSOLE', logs.slice(0, 8));
await browser.close();
