/** Does the coordinate surface fit a phone on its side, and a phone held up? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4323');
const OUT = path.resolve(arg('out', 'shots/l2-plotfit'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const bad = [];
for (const [w, h, name] of [[844, 390, 'phone-landscape'], [390, 844, 'phone-portrait'], [1280, 720, 'chromebook'], [1600, 900, 'desktop']]) {
  for (const loc of ['en', 'pl']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 900 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => bad.push(`${name}/${loc} pageerror ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') bad.push(`${name}/${loc} console ${m.text()}`); });
    await page.goto(`${URL}/?unit=algebra1-l2`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(1600);
    await page.evaluate(() => window.__ascent.openRiftById('graph-linear', { difficulty: 3, form: 'gl-plot-points' }));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const el = document.querySelector('.rift');
      const stage = document.querySelector('.rf-plot-stage');
      const seal = document.querySelector('.rf-plot-bar .rf-key');
      const out = [];
      for (const n of document.querySelectorAll('#rf-work *')) {
        const b = n.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        // MathML is KaTeX's screen-reader copy — it carries no pixels — and
        // `rf-spill` is the rig's own light, which is meant to leave the frame.
        if (n.closest('.katex-mathml') || /rf-spill/.test(String(n.className))) continue;
        if (b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1 || b.top < -1) {
          if (getComputedStyle(n).visibility === 'hidden' || getComputedStyle(n).opacity === '0') continue;
          out.push(n.className && typeof n.className === 'string' ? n.className : n.tagName);
        }
      }
      const work = document.querySelector('#rf-work');
      return {
        mode: window.__ascent.panel?.mode,
        stage: stage ? Math.round(stage.getBoundingClientRect().width) : 0,
        sealVisible: !!seal && seal.getBoundingClientRect().bottom <= innerHeight + 1,
        scrolls: work ? work.scrollHeight > work.clientHeight + 1 : false,
        offscreen: [...new Set(out)].slice(0, 6),
        katexErr: el ? el.querySelectorAll('.katex-error').length : -1,
      };
    });
    await page.screenshot({ path: path.join(OUT, `${name}-${loc}.png`) });
    console.log(`${name}/${loc}  mode=${r.mode} stage=${r.stage}px seal=${r.sealVisible} scrolls=${r.scrolls} katexErr=${r.katexErr} offscreen=${JSON.stringify(r.offscreen)}`);
    if (r.mode !== 'plot' || !r.sealVisible || r.scrolls || r.offscreen.length || r.katexErr) bad.push(`${name}/${loc}`);
    await ctx.close();
  }
}
await browser.close();
console.log(bad.length ? 'FAIL ' + JSON.stringify(bad) : 'the coordinate surface fits every viewport, in both locales');
process.exit(bad.length ? 1 : 0);
