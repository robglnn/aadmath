import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = '/tmp/critic-clip';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });

for (const [W, H, tag, mob] of [[1280, 720, 'w1280'], [1600, 900, 'w1600'], [414, 896, 'p414', true], [390, 844, 'p390', true]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: !!mob, isMobile: !!mob,
    userAgent: mob ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push('E:' + m.text()); });
  page.on('pageerror', (e) => logs.push('PE:' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
  await page.waitForTimeout(3000);
  if (mob) await page.touchscreen.tap(W / 2, H / 2); else await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(2500);
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(500);
    // make sure the build palette is up
    await page.evaluate(() => { window.__ascent.builder.arm(); window.__ascent.hud.setSlot?.(0); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${tag}-${loc}.png`) });
    const clip = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('body *').forEach((el) => {
        if (el.children.length) return;                    // leaves only
        const t = el.textContent.trim(); if (!t) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return;
        const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
        const rangeH = (() => { const rg = document.createRange(); rg.selectNodeContents(el); const b = rg.getBoundingClientRect(); return { w: b.width, h: b.height, top: b.top, bottom: b.bottom, left: b.left, right: b.right }; })();
        const overflowsBox = rangeH.bottom > r.bottom + 0.6 || rangeH.top < r.top - 0.6 || rangeH.right > r.right + 0.6 || rangeH.left < r.left - 0.6;
        const hidden = ['hidden', 'clip'].includes(cs.overflow) || ['hidden', 'clip'].includes(cs.overflowY) || ['hidden', 'clip'].includes(cs.overflowX);
        const offscreen = r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1;
        const scrollClip = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        if ((overflowsBox && hidden) || offscreen || scrollClip)
          out.push({ cls: (el.className || '').toString().slice(0, 40), txt: t.slice(0, 40), overflowsBox, hidden, offscreen, scrollClip,
            box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
            text: [Math.round(rangeH.left), Math.round(rangeH.top), Math.round(rangeH.right), Math.round(rangeH.bottom)] });
      });
      return out;
    });
    console.log(tag, loc, JSON.stringify(clip));
  }
  console.log(tag, 'LOGS', logs.length, logs.join(' | '));
  await ctx.close();
}
await browser.close();
