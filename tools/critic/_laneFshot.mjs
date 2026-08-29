import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4173');
const TAG = arg('tag', 'before');
await mkdir('shots/laneF', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [W, H, name] of [[1600, 1000, 'desk'], [414, 896, 'phone']]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  await page.goto(`${URL}/?unit=algebra1-l2`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1800);
  for (let i = 0; i < 8; i++) {
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
    await page.keyboard.press('KeyP'); await page.waitForTimeout(650);
  }
  await page.locator('.rp-teacher').first().click({ timeout: 20000 });
  await page.waitForTimeout(800);
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(700);
    const el = await page.$('.rp-sum');
    if (el) await el.screenshot({ path: `shots/laneF/${TAG}-sum-${name}-${loc}.png` });
  }
  await ctx.close();
}
await browser.close();
