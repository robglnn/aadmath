/**
 * FIRST CONTACT probe — real keyboard and mouse, fresh save, no __ascent cheats
 * for anything that is being tested.
 *
 *   node tools/_fc.mjs --url http://127.0.0.1:4321 --out shots/fc
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4321');
const OUT = path.resolve(arg('out', 'shots/fc'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

// FRESH SAVE
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

const shot = async (n, ms = 250) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };
const placed = () => page.evaluate(() => window.__ascent.builder.solids.owned);
const report = {};

// --- T0: what a cold player sees in the first seconds -----------------------
await page.waitForTimeout(3000);
await shot('01-t3s', 0);
report.visibleText3s = await page.evaluate(() =>
  [...document.querySelectorAll('#ui *')].filter((e) => e.offsetParent !== null && e.children.length === 0 && e.textContent.trim())
    .map((e) => e.textContent.trim().slice(0, 60)));

// --- T1: the ORDERS modal button. A UI click must not reach the world -------
report.placedBeforeOrders = await placed();
const go = await page.$('.sc-go');
report.ordersVisible = !!go && await go.isVisible();
if (go) {
  const b = await go.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
}
await page.waitForTimeout(600);
report.placedAfterOrdersClick = await placed();
await shot('02-after-orders', 400);

// --- T2: the very first click on the world ----------------------------------
await page.waitForTimeout(1500);
await shot('03-t30s-controls', 0);
report.visibleText30s = await page.evaluate(() =>
  [...document.querySelectorAll('#ui *')].filter((e) => e.offsetParent !== null && e.children.length === 0 && e.textContent.trim())
    .map((e) => e.textContent.trim().slice(0, 60)));
const before = await placed();
await page.mouse.move(W / 2, H / 2);
await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
await page.waitForTimeout(500);
report.firstWorldClickPlaced = (await placed()) - before;
await shot('04-first-click', 400);

// --- T3: getting stuck -------------------------------------------------------
report.stuck = await page.evaluate(() => {
  const a = window.__ascent;
  return { pos: a.player.pos.toArray().map((n) => +n.toFixed(1)) };
});

await page.evaluate(() => { window.__ascent.hud.say(''); });
report.console = logs.slice(0, 20);
console.log(JSON.stringify(report, null, 2));
await browser.close();
