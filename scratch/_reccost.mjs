/** What does the new Recover cost, in milliseconds, on a software rasteriser? */
import { chromium } from 'playwright';
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4399';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
const r = await page.evaluate(() => {
  const a = window.__ascent, out = [];
  for (let i = 0; i < 12; i++) {
    const t = performance.now();
    a.player.recover('asked');
    out.push(+(performance.now() - t).toFixed(1));
  }
  return out;
});
console.log('recover() ms:', r.join(', '), ' median', r.sort((x, y) => x - y)[6]);
await browser.close();
