/**
 * The portrait states the eight gate scenes do not reach.
 *
 * `tools/critic/landscape.mjs` drives arrival, the companion, the rift, the
 * report, the orders, the full HUD and the close. It never opens the menu, never
 * enters build mode, and never spends a mote — which is exactly where the
 * portrait floor's three reserves (the companion, the chip strip, the ledger)
 * are actually tested. Same audit, same assertions, four more states.
 *
 *   tools/critic/frozen.sh tools/critic/tmp/portrait-states.mjs
 */
import { chromium } from 'playwright';
import { AUDIT_SRC } from '../_viewports.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const SIZES = arg('sizes', '414x896,390x844').split(',').map((s) => {
  const [w, h] = s.split('x').map(Number); return { w, h, name: s };
});
const LOCALES = arg('locales', 'en,es,pl').split(',');
const LONG = 'Nothing in your kit reaches one from flat ground, and that is the entire idea. '
  + 'Place a ramp, place another off the top of it, and touch the thing. Sixty motes apiece, '
  + 'and there are three of them on this island before the road bends north.';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
let bad = 0, n = 0;

for (const vp of SIZES) {
  for (const loc of LOCALES) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2,
      hasTouch: true, isMobile: false,
      locale: loc === 'pl' ? 'pl-PL' : loc === 'es' ? 'es-ES' : 'en-US',
    });
    const page = await ctx.newPage();
    await page.addInitScript(AUDIT_SRC);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
    await page.waitForTimeout(3200);

    const check = async (scene) => {
      n++;
      const r = await page.evaluate(() => window.__landAudit());
      const b = r.clipped.length + r.outside.length + r.overlaps.length;
      if (b) bad++;
      console.log(`  ${b ? 'FAIL' : ' ok '}  ${vp.name} ${loc} ${scene.padEnd(18)} `
        + `clip:${r.clipped.length} out:${r.outside.length} lap:${r.overlaps.length}`);
      for (const c of r.clipped.slice(0, 3)) console.log(`        clip ${c.sel} ${c.what} "${c.text}"`);
      for (const o of r.outside.slice(0, 3)) console.log(`        out  ${o.sel} ${o.edge} ${o.by}px "${o.text}"`);
      for (const o of r.overlaps.slice(0, 6)) console.log(`        lap  ${o.a} x ${o.b} ${o.w}x${o.h} @${o.at}`);
      await page.screenshot({ path: `shots/portrait-states/${vp.name}-${loc}-${scene}.png` });
    };

    /* Motes in the wallet, verbs on the chip strip, the build charge armed and
       the ledger printing — the four things this pass moved on the floor. */
    await page.evaluate(() => {
      const a = window.__ascent;
      const w = a.builder?.wallet;
      w?.earn?.(400, 'seal');
      for (const row of (a.kit?.stock?.() || [])) a.kit?.buy?.(row.id);
      w?.earn?.(60, 'anchor');
      w?.spend?.(60, 'ramp');
      a.builder?.arm?.();
    });
    await page.waitForTimeout(1000);
    await check('build-kit-ledger');

    await page.evaluate((text) => {
      window.__ascent.story.comms.clear();
      window.__ascent.story.comms.say(text, { force: true });
    }, LONG);
    await page.waitForTimeout(2600);
    await check('build-marlow');

    await page.evaluate(() => window.__ascent.controls?.setStuck?.(true));
    await page.waitForTimeout(800);
    await check('stuck');
    await page.evaluate(() => window.__ascent.controls?.setStuck?.(false));
    await page.waitForTimeout(500);

    await page.evaluate(() => document.querySelector('.mnu-pill')?.click());
    await page.waitForTimeout(800);
    await check('menu');

    await ctx.close();
  }
}
console.log(`\n${n - bad}/${n} states clean`);
await browser.close();
process.exit(bad ? 1 : 0);
