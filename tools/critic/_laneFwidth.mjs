import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const WIDTHS = [830, 900, 965, 1000, 1032, 1100, 1200, 1280];
for (const W of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${URL}/?unit=algebra1-l2`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1600);
  for (let i = 0; i < 8; i++) {
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
    await page.keyboard.press('KeyP'); await page.waitForTimeout(600);
  }
  await page.locator('.rp-teacher').first().click({ timeout: 20000 });
  await page.waitForTimeout(700);
  const line = [];
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(600);
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const dl = document.querySelector('.rp-sum');
      const cs = getComputedStyle(dl);
      const box = dl.getBoundingClientRect();
      const rng = document.createRange();
      let worst = null;
      for (const el of dl.children) {
        const n = el.firstChild; if (!n) continue;
        rng.selectNodeContents(n);
        const b = rng.getBoundingClientRect();
        const past = b.right - box.right;
        if (past > 0.5 && (!worst || past > worst.past)) worst = { text: el.textContent.slice(0, 26), past: +past.toFixed(0) };
      }
      return { need: dl.scrollWidth, have: dl.clientWidth, flow: cs.gridAutoFlow, ox: cs.overflowX, worst };
    });
    await page.emulateMedia({ media: 'screen' });
    line.push(`${loc} need ${r.need}/${r.have}${r.need > r.have + 1 ? ` CUT ${r.need - r.have}px` : ''}`
      + (r.worst ? ` ink "${r.worst.text}" past ${r.worst.past}px` : ''));
  }
  console.log(`w=${String(W).padEnd(5)} ${line.join(' | ')}`);
  await ctx.close();
}
await browser.close();
