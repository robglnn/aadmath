/** COHERENCE: the ink audit landscape.mjs uses, on the toast + prompt + hail
 *  all up at once, at both portrait sizes, in all three locales. */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { AUDIT_SRC, audit, PORTRAIT, PORTRAIT_INSETS, APPLY_INSET_SRC } from './_viewports.mjs';
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4919';
const OUT = '/tmp/cohplay/ink'; await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let bad = 0;
for (const vp of PORTRAIT) for (const ins of PORTRAIT_INSETS) for (const loc of ['en', 'es', 'pl']) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
  await page.waitForTimeout(3200);
  if (loc !== 'en') { await page.evaluate((l) => window.__ascent.setLocale(l), loc); await page.waitForTimeout(1100); }
  await page.evaluate(APPLY_INSET_SRC, ins);
  await page.evaluate(AUDIT_SRC);
  // put ALL THREE of the crosshair-axis slots up at once — the worst case the
  // portrait composition says it lays out for ("as though all three were").
  await page.evaluate(() => {
    const a = window.__ascent;
    a.hud.flash(a.t('firstrun.caught'), 'bad');
    for (const [sel, cls] of [['.gd-prompt', 'show'], ['.hail', 'show']]) {
      const e = document.querySelector(sel); if (e) { e.classList.add(cls); e.style.opacity = '1'; e.style.visibility = 'visible'; }
    }
  });
  await page.waitForTimeout(500);
  const r = await audit(page);
  const tag = `${vp.name}${ins.name}-${loc}`;
  const n = (r.clipped?.length || 0) + (r.offscreen?.length || 0) + (r.overlaps?.length || 0) + (r.scroll?.length || 0) + (r.unsafe?.length || 0);
  if (n) { bad += n; console.log(`FAIL ${tag}  clip:${r.clipped?.length || 0} out:${r.offscreen?.length || 0} lap:${r.overlaps?.length || 0} scr:${r.scroll?.length || 0} safe:${r.unsafe?.length || 0}`);
    for (const k of ['clipped', 'offscreen', 'overlaps', 'scroll', 'unsafe']) for (const f of (r[k] || [])) console.log('    ' + k + ': ' + JSON.stringify(f).slice(0, 240)); }
  else console.log(`ok   ${tag}  clean`);
  await page.screenshot({ path: path.join(OUT, tag + '.png') });
  await ctx.close();
}
console.log(bad ? `\nFAILED: ${bad} finding(s)` : '\nCLEAN: all three centre slots up at once, both handsets, three locales, three insets');
await browser.close();
process.exit(bad ? 1 : 0);
