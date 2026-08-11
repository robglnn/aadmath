import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
const t0 = Date.now();
const seen = [];
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => ({
    charter: !!document.querySelector('.ses-charter.show'),
    uiOpen: window.__ascent.input.uiOpen,
    placed: window.__ascent.builder.solids.owned,
    overlays: [...document.querySelectorAll('#ui > *, #ui .show')].filter((e) => e.offsetParent && getComputedStyle(e).pointerEvents !== 'none').map((e) => e.className).slice(0, 12),
  }));
  seen.push({ t: ((Date.now() - t0) / 1000).toFixed(1), ...s });
  await page.waitForTimeout(500);
}
console.log(JSON.stringify(seen.filter((x, i) => i === 0 || JSON.stringify(x).replace(/"t":"[^"]*",/, '') !== JSON.stringify(seen[i - 1]).replace(/"t":"[^"]*",/, '')), null, 1));
await browser.close();
