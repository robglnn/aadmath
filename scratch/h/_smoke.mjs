import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const t0 = Date.now();
await page.goto('http://127.0.0.1:4802', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
console.log('boot to __ascent:', Date.now() - t0, 'ms');
await page.waitForTimeout(3000);
const s = await page.evaluate(() => {
  const a = window.__ascent, W = a.world;
  const st = W.routeStats();
  const r = W.routeFrom(0, 0, -13.25, -56.63);
  const h = W.headingTo(0, 0, -13.25, -56.63);
  return { st, route: r ? { m: r.metres, cells: r.cells.length, pts: r.points.length } : null, h,
    waygates: a.waygates?.list?.length ?? 'n/a', rifts: a.rifts.list.map(x => x.id) };
});
console.log(JSON.stringify(s, null, 1));
await page.screenshot({ path: 'shots/h-smoke.png' });
console.log('errors:', errs.length, errs.slice(0, 4).join(' | '));
await browser.close();
