/**
 * Does the pause menu's new "if you are stuck" section fit, in every language
 * and on the smallest frames this game claims to run on?
 *
 * landscape.mjs never opens the menu, so nothing else in the tool-chain looks
 * at this card on a phone. Polish and Spanish set the budget: "Zacznij od nowa"
 * against "Start over" is nearly twice the glyphs on a button that sits beside
 * another one.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p0menufit'));
await mkdir(OUT, { recursive: true });

const VPS = [
  { name: '390x844', w: 390, h: 844 },     // phone, held up
  { name: '844x390', w: 844, h: 390 },     // phone, on its side
  { name: '1024x768', w: 1024, h: 768 },   // school Chromebook / tablet
  { name: '1600x900', w: 1600, h: 900 },
];
const LOCS = ['en', 'es', 'pl'];

const browser = await chromium.launch({
  headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let bad = 0;
for (const vp of VPS) {
  for (const loc of LOCS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
    await page.waitForTimeout(1800);

    // Open it the way a player does.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const card = document.querySelector('.mnu-card');
      const sec = document.querySelector('.mnu-out');
      if (!card || !sec) return { fail: 'no card' };
      const cb = card.getBoundingClientRect();
      const els = [...sec.querySelectorAll('h3,p,button,span')];
      let overflowRight = 0, empty = 0;
      for (const e of els) {
        const b = e.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.right > cb.right + 0.5) overflowRight = Math.max(overflowRight, b.right - cb.right);
        if (!e.textContent.trim() && e.tagName !== 'SPAN') empty++;
      }
      return {
        open: !!window.__ascent.menu.open,
        // the card scrolls by design on a short frame; the row of buttons must not
        rowScrollX: sec.querySelector('.mnu-acts').scrollWidth - sec.querySelector('.mnu-acts').clientWidth,
        overflowRight: +overflowRight.toFixed(1),
        empty,
        docScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        recoverVisible: !!document.querySelector('.mnu-recover')?.getClientRects().length,
        restartVisible: !!document.querySelector('.mnu-restart')?.getClientRects().length,
      };
    });
    await page.screenshot({ path: path.join(OUT, `${vp.name}-${loc}.png`) });
    const ok = r.open && r.recoverVisible && r.restartVisible
      && r.overflowRight <= 0.5 && r.rowScrollX <= 0 && r.docScrollX <= 0 && !r.empty && !errs.length;
    if (!ok) bad++;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${vp.name} ${loc}  ${JSON.stringify(r)}${errs.length ? ' ERR ' + errs[0] : ''}`);
    await ctx.close();
  }
}
console.log(bad ? `\n${bad} frame(s) do not fit` : '\nthe way out fits in every frame and every language');
await browser.close();
process.exit(bad ? 1 : 0);
