import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4321');
const OUT = arg('out', 'shots/fc3');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
const R = {};
const placed = () => page.evaluate(() => window.__ascent.builder.solids.owned);

// wait for the ORDERS card, without touching anything
await page.waitForSelector('.ses-charter.show', { timeout: 60000 });
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/A-orders.png' });
R.placedBefore = await placed();
const b = await (await page.$('.sc-go')).boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
await page.waitForTimeout(900);
R.placedAfterOrdersClick = (await placed()) - R.placedBefore;
await page.screenshot({ path: OUT + '/B-after-orders.png' });

// now the very first world click
await page.waitForTimeout(600);
const p0 = await placed();
await page.mouse.move(800, 450);
await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
await page.waitForTimeout(700);
R.firstWorldClick = (await placed()) - p0;
await page.screenshot({ path: OUT + '/C-first-click.png' });
R.console = logs;
console.log(JSON.stringify(R, null, 1));
await browser.close();
