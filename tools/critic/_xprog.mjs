/** Open the real progress report and audit it for overlap/clipping. */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/critX/progress'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [W, H, LOC] of [[390, 844, 'pl'], [1280, 720, 'en'], [1600, 900, 'es']]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: W < 700, isMobile: W < 700 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent);
  await page.evaluate((l) => { localStorage.removeItem('ascent.save'); localStorage.setItem('ascent.locale', l); }, LOC);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent);
  await page.waitForTimeout(2500);
  // seal a couple of skills so the report has content
  for (const id of ['var-meaning', 'evaluate']) {
    await page.evaluate((s) => window.__ascent.openRiftById(s), id).catch(() => {});
    for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__ascent.panel.demo('right')); await page.waitForTimeout(1200); }
    await page.evaluate(() => window.__ascent.panel.close());
  }
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, [role=button], .rp-launch, [class*=progress]')]
      .find((x) => /progress|postęp|progreso/i.test(x.textContent || '') || /rp-launch/.test(x.className));
    if (b) { b.click(); return String(b.className); } return null;
  });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, `prog-${W}-${LOC}.png`) });
  console.log(`${W}x${H} ${LOC}: opened via ${opened} errors=${errs.length}`);
  await page.close();
}
await browser.close();
