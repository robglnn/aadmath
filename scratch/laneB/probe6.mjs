/** Reproduce defect 6: does clicking a HUD control also fire the world build? */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3500);
// dismiss any boot curtain by pressing a key
await page.keyboard.press('KeyW');
await page.waitForTimeout(1200);

const info = await page.evaluate(() => {
  const out = {};
  const a = window.__ascent;
  out.keys = Object.keys(a || {});
  return out;
});
console.log('ascent api:', JSON.stringify(info.keys));

async function pieceCount() {
  return page.evaluate(() => {
    const a = window.__ascent;
    const s = a.state?.();
    return { pieces: s?.pieces ?? s?.build?.pieces ?? null, raw: Object.keys(s || {}) };
  });
}
console.log('state keys', JSON.stringify(await pieceCount()));
const targets = ['.fc-pill', '.mnu-pill', '.rp-launch', '#langs button', '.buildbar .slot'];
for (const sel of targets) {
  const seen = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], pe: cs.pointerEvents, op: cs.opacity, cur: cs.cursor };
  }, sel);
  console.log(sel.padEnd(20), JSON.stringify(seen));
}
await b.close();
console.log('errors', errs.length, errs.slice(0, 4));
