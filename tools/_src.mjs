import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT = 'shots/fc-src';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const out = {};
// pad, on a desktop frame
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent);
  await page.waitForTimeout(4500);
  await page.evaluate(() => { window.__ascent.input.source = 'pad'; });
  await page.waitForTimeout(600);
  out.pad = await page.evaluate(() => [...document.querySelectorAll('.fc li')].map((li) =>
    li.querySelector('.fc-verb').textContent + ' = ' + [...li.querySelectorAll('kbd')].map((k) => k.textContent).join(' | ')));
  await page.screenshot({ path: `${OUT}/pad.png` });
  await ctx.close();
}
// touch, on a phone frame
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent);
  await page.waitForTimeout(5000);
  out.touch = await page.evaluate(() => [...document.querySelectorAll('.fc li')].map((li) =>
    li.querySelector('.fc-verb').textContent + ' = ' + [...li.querySelectorAll('kbd')].map((k) => k.textContent).join(' | ')));
  out.touchCardUp = await page.evaluate(() => !!document.querySelector('.fc.show'));
  out.bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await page.screenshot({ path: `${OUT}/touch.png` });
  await page.evaluate(() => window.__ascent.controls.setStuck(true));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/touch-stuck.png` });
  out.touchConsole = errs;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
