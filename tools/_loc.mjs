import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT = 'shots/fc-loc';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const out = {};
for (const loc of ['en', 'es', 'pl']) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch {} }, loc);
  await page.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent);
  await page.waitForTimeout(5000);
  // show the stuck prompt the way the game does, then photograph both surfaces
  await page.evaluate(() => window.__ascent.controls.setStuck(true));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${loc}.png` });
  out[loc] = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.fc li')].map((li) =>
      li.querySelector('.fc-verb').textContent + ' = ' + [...li.querySelectorAll('kbd')].map((k) => k.textContent).join(' | ')),
    head: document.querySelector('.fc-head h3').textContent,
    got: document.querySelector('.fc-x').textContent,
    stuck: [document.querySelector('.fcs h3').textContent, document.querySelector('.fcs p').textContent, document.querySelector('.fcs button').textContent],
    overflow: [...document.querySelectorAll('.fc li')].some((li) => li.scrollWidth > li.clientWidth + 1),
  }));
  out[loc].console = errs;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
