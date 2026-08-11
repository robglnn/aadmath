import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4877');
const OUT = path.resolve(arg('out', 'shots/dir-play'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const logs = [];
const out = {};
for (const [w, h, tag] of [[1280, 720, 'w1280'], [390, 844, 'p390']]) {
  for (const loc of ['en', 'es', 'pl']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
    const page = await ctx.newPage();
    page.on('console', (m) => logs.push({ tag, loc, type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => logs.push({ tag, loc, type: 'pageerror', text: e.message }));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
    await page.waitForTimeout(2200);
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(700);
    // real hands: click to capture pointer, run, look, jump
    await page.mouse.click(w / 2, h / 2);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(900);
    await page.mouse.move(w / 2 + 220, h / 2);
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyW');
    await page.screenshot({ path: path.join(OUT, `world-${tag}-${loc}.png`) });
    // open a rift for real
    await page.evaluate(() => window.__ascent.openRiftById(window.__ascent.skillIds[0]));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `rift-${tag}-${loc}.png`) });
    const overflow = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!hasText) continue;
        const clipX = el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll';
        const clipY = el.scrollHeight > el.clientHeight + 2 && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll';
        if (clipX || clipY) bad.push({ cls: String(el.className).slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, txt: el.textContent.trim().slice(0, 40) });
      }
      return bad.slice(0, 10);
    });
    out[`${tag}-${loc}`] = overflow;
    // fps sample
    out[`fps-${tag}-${loc}`] = await page.evaluate(() => window.__ascent.state().perf || window.__ascent.state().fps);
    await ctx.close();
  }
}
out.logs = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'play.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 5000));
await browser.close();
