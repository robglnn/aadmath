import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4173');
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 965, height: 1000 } });
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
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(700);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  const el = await page.$('.rp-sheet .rp-sum');
  if (el) await el.screenshot({ path: `shots/laneF/after-print965-sum-${loc}.png` });
  await page.emulateMedia({ media: 'screen' });
}
await b.close();
