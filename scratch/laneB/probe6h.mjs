/** Defect 6, under a GRANTED pointer lock (scripted the way lockstates.mjs does). */
import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  let el = null;
  Object.defineProperty(document, 'pointerLockElement', { get: () => el, configurable: true });
  Element.prototype.requestPointerLock = function () { el = this; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); return Promise.resolve(); };
  document.exitPointerLock = function () { if (!el) return; el = null; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); };
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent?.builder, null, { timeout: 40000 });
await page.waitForTimeout(3500);
await page.keyboard.press('KeyW'); await page.waitForTimeout(600);
await page.mouse.move(720, 500); await page.mouse.wheel(0, 120); await page.waitForTimeout(500);
await page.mouse.click(700, 520); await page.waitForTimeout(900);
const count = () => page.evaluate(() => { const L = window.__ascent.builder?.lattice?.live || {}; return Object.values(L).reduce((a, v) => a + (v?.length || 0), 0); });
console.log('locked =', await page.evaluate(() => window.__ascent.input.locked), '| pieces after a world click =', await count());
const box = (s) => page.evaluate((q) => { const el = document.querySelector(q); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { pe: cs.pointerEvents, op: cs.opacity, x: r.x + r.width/2, y: r.y + r.height/2, w: r.width }; }, s);
await page.keyboard.press('Slash'); await page.waitForTimeout(600);
const g = await box('.fc-x'); if (g?.w && g.pe !== 'none') { await page.mouse.click(g.x, g.y); await page.waitForTimeout(900); }
for (const sel of ['.fc-pill', '#langs button', '.rp-launch', '.buildbar .slot']) {
  const v = await box(sel);
  if (!v || !v.w || v.pe === 'none' || v.op === '0') { console.log(sel.padEnd(18), 'not live', JSON.stringify(v)); continue; }
  const before = await count();
  await page.mouse.move(v.x, v.y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(900);
  const after = await count();
  console.log(sel.padEnd(18), 'locked', await page.evaluate(() => window.__ascent.input.locked), '| pieces', before, '->', after, after > before ? '  *** BUILT A PIECE ***' : '  (ui ate it)');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
}
console.log('errors', errs.length);
await b.close();
