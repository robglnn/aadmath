/**
 * Is the landscape rail's fixed estimate of the session band's height right?
 *
 * `src/ui/landscape.css` positions the objective card with
 *   top: calc(--pad-t + --lsc-band + --lsc-sb + --lsc-step*2)
 * where `--lsc-sb: 52px` is a CONSTANT standing in for the height of
 * `.ses-band`. The same file then makes the band's goal row wrap onto a line of
 * its own. This measures the band that is actually painted.
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:4791';
const browser = await chromium.launch();
const rows = [];
for (const vp of [{ w: 844, h: 390 }, { w: 896, h: 414 }]) {
  for (const loc of ['en', 'es', 'pl']) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.evaluate((l) => { localStorage.removeItem('ascent.save'); localStorage.setItem('ascent.locale', l); }, loc);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    try { await page.locator('.sc-go').click({ timeout: 6000 }); } catch { /* no charter */ }
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const band = document.querySelector('.ses-band');
      const card = document.querySelector('.gd-card');
      const cap = document.querySelector('.gd-cap');
      const cs = getComputedStyle(document.documentElement);
      const r = (e) => (e ? e.getBoundingClientRect() : null);
      const b = r(band); const c = r(card); const p = r(cap);
      return {
        sbToken: cs.getPropertyValue('--lsc-sb').trim(),
        bandShown: band ? band.classList.contains('show') : false,
        bandTop: b ? Math.round(b.top) : null,
        bandHeight: b ? Math.round(b.height) : null,
        bandBottom: b ? Math.round(b.bottom) : null,
        cardTop: c ? Math.round(c.top) : null,
        capTop: p ? Math.round(p.top) : null,
        goal: document.querySelector('.sb-goal')?.textContent?.trim().slice(0, 48) || null,
      };
    });
    rows.push({ vp: `${vp.w}x${vp.h}`, loc, ...m, overlapPx: (m.bandBottom != null && m.capTop != null) ? m.bandBottom - m.capTop : null });
    await ctx.close();
  }
}
console.table(rows);
await browser.close();
