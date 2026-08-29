import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4173');
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [W, H] of [[320, 640], [390, 844], [844, 390]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${URL}/?unit=algebra1-l2`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1600);
  for (let i = 0; i < 8; i++) {
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
    await page.keyboard.press('KeyP'); await page.waitForTimeout(600);
  }
  const teacher = await page.$('.rp-teacher');
  if (!teacher) { console.log(`${W}x${H}: no teacher button`); await ctx.close(); continue; }
  await teacher.click({ timeout: 20000 });
  await page.waitForTimeout(800);
  const line = [];
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const dl = document.querySelector('.rp-sheet .rp-sum');
      if (!dl) return null;
      const box = dl.getBoundingClientRect();
      const rng = document.createRange();
      let past = 0;
      const w = document.createTreeWalker(dl, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.nodeValue.trim()) continue;
        rng.selectNodeContents(n);
        past = Math.max(past, rng.getBoundingClientRect().right - box.right);
      }
      return { cells: dl.children.length, cut: dl.scrollWidth - dl.clientWidth, past: Math.round(past),
        ox: getComputedStyle(dl).overflowX };
    });
    line.push(r ? `${loc} cells ${r.cells} cut ${r.cut} ink-past ${r.past > 1 ? r.past : 0} ox ${r.ox}` : `${loc} —`);
  }
  console.log(`${W}x${H}  ${line.join(' | ')}`);
  await ctx.close();
}
await b.close();
