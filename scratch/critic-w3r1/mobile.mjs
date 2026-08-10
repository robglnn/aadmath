import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = '/tmp/critic-mobile';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';
const W = Number(process.argv[2] || 414), H = Number(process.argv[3] || 896);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('E:' + m.text()); });
page.on('pageerror', (e) => logs.push('PE:' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3000);
await page.touchscreen.tap(W / 2, H / 2);
await page.waitForTimeout(22000);   // intro over
const shot = async (n, ms = 500) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${W}-${n}.png`) }); };
await shot('idle');

const ui = await page.evaluate(() => {
  const rows = [];
  document.querySelectorAll('[class*="axiom"], [class*="build"], [class*="slot"], [class*="tool"], [class*="touch"], [class*="pad"]').forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    rows.push({ cls: el.className.toString().slice(0, 50), op: cs.opacity, disp: cs.display, vis: cs.visibility, pe: cs.pointerEvents,
      box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], txt: (el.textContent || '').trim().slice(0, 30) });
  });
  return rows;
});
console.log('BUILD UI', JSON.stringify(ui, null, 1));

// try to build by touch: tap the slot chips if any, then tap-and-hold in the world
const before = await page.evaluate(() => window.__ascent.buildTarget().placed);
// tap the ramp chip location if visible
for (const el of ui) {
  if (/rampa|ramp/i.test(el.txt) && el.box[2] > 8) {
    await page.touchscreen.tap(el.box[0] + el.box[2] / 2, el.box[1] + el.box[3] / 2);
    await page.waitForTimeout(500);
  }
}
await shot('armed');
// long-press in the middle of the world
await page.touchscreen.tap(W * 0.6, H * 0.45);
await page.waitForTimeout(700);
await shot('after-tap');
const after = await page.evaluate(() => window.__ascent.buildTarget());
console.log('placed before', before, 'after', JSON.stringify(after));
console.log('LOGS', logs.length, logs.join(' | '));
await browser.close();
