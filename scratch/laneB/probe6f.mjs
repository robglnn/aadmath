import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent?.builder, null, { timeout: 40000 });
await page.waitForTimeout(3200);
await page.keyboard.press('KeyW'); await page.waitForTimeout(700);
await page.mouse.move(720, 500);
await page.mouse.wheel(0, 120); await page.waitForTimeout(500);
const count = () => page.evaluate(() => { const L = window.__ascent.builder?.lattice?.live || {}; return Object.values(L).reduce((a, v) => a + (v?.length || 0), 0); });
const box = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { pe: cs.pointerEvents, op: cs.opacity, x: r.x + r.width/2, y: r.y + r.height/2, w: r.width }; }, sel);
const clickAt = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(800); };
// dismiss the card by hand so the ? pill appears
await page.keyboard.press('Slash'); await page.waitForTimeout(600);
const got = await box('.fc-x'); if (got?.w) await clickAt(got.x, got.y);
await page.waitForTimeout(700);
// a click in the world asks for the pointer lock
await clickAt(700, 520);
const locked = await page.evaluate(() => window.__ascent.input?.locked);
console.log('locked after world click:', locked, 'pieces', await count());
if (!locked) { console.log('the browser refused the lock; cannot test the locked path here'); }
for (const sel of ['.fc-pill', '#langs button', '.rp-launch', '.mnu-pill']) {
  const v = await box(sel);
  if (!v || !v.w) { console.log(sel, 'missing'); continue; }
  const before = await count();
  await clickAt(v.x, v.y);
  const after = await count();
  console.log(sel.padEnd(18), 'pe', v.pe, 'op', v.op, '| pieces', before, '->', after, after > before ? '  *** BUILT A PIECE ***' : '');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
}
console.log('errors', errs.length, errs.slice(0,3));
await b.close();
