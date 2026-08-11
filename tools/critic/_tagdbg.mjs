/** One viewport, one instant: what did the ledger actually think was on screen? */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const W = Number(arg('w', 414)), H = Number(arg('h', 896));
const AT = Number(arg('at', 3500));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: W < 500, hasTouch: W < 500 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(AT);
const out = await page.evaluate(() => {
  const s = window.__ascent.afford.state();
  const plates = [...document.querySelectorAll('.afd-call')].map((el) => {
    const p = el.querySelector('.afd-plate').getBoundingClientRect();
    return { cls: el.className, disp: el.style.display, tf: el.style.transform,
      plate: [p.left, p.top, p.width, p.height].map(Math.round) };
  });
  const chrome = [];
  for (const sel of ['.meta-quest', '.hail', '.meta-comms', '.fc-card', '.hud-top', '.kit', '.buildbar']) {
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      chrome.push({ sel, op: cs.opacity, vis: cs.visibility, disp: cs.display,
        r: [r.left, r.top, r.width, r.height].map(Math.round) });
    }
  }
  return { space: s.space, plates, chrome };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(0);
