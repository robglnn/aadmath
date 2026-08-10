import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = '/tmp/critic-mobloc';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [W, H] of [[414, 896], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
  await page.waitForTimeout(3000);
  await page.touchscreen.tap(W / 2, H / 2);
  await page.waitForTimeout(21000);
  for (const loc of ['es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__ascent.builder.arm());
    await page.waitForTimeout(600);
    const bar = await page.evaluate(() => {
      const el = document.querySelector('.buildbar');
      const r = el.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
    });
    await page.screenshot({ path: path.join(OUT, `${W}-${loc}.png`), clip: { x: bar[0] - 6, y: bar[1] - 6, width: bar[2] + 12, height: bar[3] + 12 } });
    console.log(W, loc, bar);
  }
  await ctx.close();
}
await browser.close();
