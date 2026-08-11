/** Probe 6 — the first phone frame: do the two world tags collide? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funcrit6'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h, tag] of [[414, 896, 'p414'], [390, 844, 'p390'], [1280, 720, 'd1280']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  for (const t of [3500, 8000, 14000]) {
    await page.waitForTimeout(t === 3500 ? 3500 : 4500);
    const tags = await page.evaluate(() => {
      const list = [];
      for (const el of document.querySelectorAll('.bk-tag, .bk, [class*="bk-"], .beckon, [class*="beacon"]')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || Number(cs.opacity) < 0.2) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4) continue;
        list.push({ t: el.innerText.replace(/\n/g, ' / ').trim().slice(0, 60), cls: el.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), op: cs.opacity });
      }
      const hits = [];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 8 && oy > 6) hits.push({ a: a.t, b: b.t, ox, oy, ay: a.y, by: b.y });
      }
      return { list, hits };
    });
    console.log(JSON.stringify({ tag, at: t, hits: tags.hits, tags: tags.list }));
    await page.screenshot({ path: path.join(OUT, `${tag}-t${t}.png`) });
  }
  await ctx.close();
}
console.log('errors:', errors.length);
await browser.close();
process.exit(0);
