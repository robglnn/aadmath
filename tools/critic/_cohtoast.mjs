/** COHERENCE: the toast on a phone held up. Geometry only — no progress is made. */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4917';
const OUT = '/tmp/cohplay/toast'; await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const vp of [{ w: 390, h: 844, n: 'phone-portrait' }, { w: 414, h: 896, n: 'phone-portrait-large' }, { w: 844, h: 390, n: 'phone-landscape' }, { w: 1600, h: 900, n: 'laptop' }]) {
  for (const loc of ['en', 'es', 'pl']) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.h > vp.w, isMobile: vp.h > vp.w, deviceScaleFactor: vp.h > vp.w ? 3 : 1 });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
    await page.waitForTimeout(3500);
    if (loc !== 'en') { await page.evaluate((l) => window.__ascent.setLocale(l), loc); await page.waitForTimeout(1200); }
    const r = await page.evaluate(() => {
      // The longest line the toast is ever handed, from the bundle a learner reads.
      const s = window.__ascent.t('firstrun.caught');
      window.__ascent.hud.flash(s, 'bad');
      return s;
    });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const el = document.querySelector('.toast, #toast'); if (!el) return { none: true };
      const gp = document.querySelector('.gd-prompt'), hl = document.querySelector('.hail');
      const bx = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)]; };
      const b = el.getBoundingClientRect(); const c = getComputedStyle(el);
      return { text: el.textContent.trim(), rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
        scrollW: el.scrollWidth, clientW: el.clientWidth, lines: Math.round(b.height / parseFloat(c.lineHeight || '16')),
        offLeft: Math.round(-b.x), offRight: Math.round(b.x + b.width - innerWidth), whiteSpace: c.whiteSpace,
        gdPrompt: bx(gp), hail: bx(hl),
        clipped: el.scrollWidth > el.clientWidth + 1 || b.x < -0.5 || b.x + b.width > innerWidth + 0.5 };
    });
    console.log(`${vp.n.padEnd(20)} ${loc}  ${JSON.stringify(m)}`);
    await page.screenshot({ path: path.join(OUT, `${vp.n}-${loc}.png`) });
    await ctx.close();
  }
}
await browser.close();
