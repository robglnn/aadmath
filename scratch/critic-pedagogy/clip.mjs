import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4711');
const OUT = path.resolve('shots/crit-ped-clip');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const VIEWS = [[1280, 720], [1600, 900], [414, 896], [390, 844]];
for (const [W, H] of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${W}x${H} ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${W}x${H} ${e.message}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    for (const skill of ['var-meaning', 'two-step', 'multi-step', 'both-sides', 'distribute']) {
      for (const scaf of ['none', 'full']) {
        await page.evaluate(({ s, sc }) => {
          try { window.__ascent.showItem(s, { difficulty: 5, scaffold: sc, seed: 12345 }); } catch (e) {}
        }, { s: skill, sc: scaf });
        await page.waitForTimeout(320);
        const bad = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('.rift *, .rf *, [class^="rf-"] *, [class*="panel"] *')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            if (el.children.length || !el.textContent?.trim()) continue;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const hclip = el.scrollWidth > el.clientWidth + 2 && !/auto|scroll/.test(cs.overflowX);
            const vclip = el.scrollHeight > el.clientHeight + 2 && !/auto|scroll/.test(cs.overflowY);
            const off = r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1;
            if (hclip || vclip || off) out.push({ c: (el.className || '').toString().slice(0, 26), t: el.textContent.trim().slice(0, 34), hclip, vclip, off, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
          }
          return out.slice(0, 6);
        });
        if (bad.length) console.log(`${W}x${H} ${loc} ${skill} ${scaf}:`, JSON.stringify(bad));
      }
    }
  }
  // katex fallback check
  const katex = await page.evaluate(() => ({
    fallback: document.querySelectorAll('.katex-error, .katex-html .mord.text[style*="color"]').length,
    katexNodes: document.querySelectorAll('.katex').length,
  }));
  console.log(`${W}x${H} katex nodes=${katex.katexNodes} errors=${katex.fallback}`);
  await ctx.close();
}
console.log('console errors:', errors.length, errors.slice(0, 6));
await browser.close();
