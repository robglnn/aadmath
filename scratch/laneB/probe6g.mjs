import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent?.builder, null, { timeout: 40000 });
await page.waitForTimeout(3200);
await page.keyboard.press('KeyW'); await page.waitForTimeout(600);
await page.mouse.move(720, 500); await page.mouse.wheel(0, 120); await page.waitForTimeout(500);
await page.keyboard.press('Slash'); await page.waitForTimeout(600);
const box = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { pe: cs.pointerEvents, op: cs.opacity, x: r.x + r.width/2, y: r.y + r.height/2, w: r.width }; }, sel);
const g = await box('.fc-x'); if (g?.w) { await page.mouse.click(g.x, g.y); await page.waitForTimeout(800); }
// after each press read the ONE fact the routing contract is about
async function probe(sel) {
  const v = await box(sel);
  if (!v || !v.w || v.pe === 'none' || v.op === '0') return console.log(sel.padEnd(20), 'not live', JSON.stringify(v));
  await page.mouse.move(v.x, v.y);
  await page.mouse.down();
  const r = await page.evaluate(() => ({ onUI: window.__ascent.input?.pointerOnUI, grace: +(window.__ascent.input?._grace || 0).toFixed(2), held: window.__ascent.builder?._held }));
  await page.mouse.up(); await page.waitForTimeout(400);
  console.log(sel.padEnd(20), 'pointerOnUI', String(r.onUI).padEnd(6), 'grace', String(r.grace).padEnd(5), 'builder._held', r.held, r.onUI === false ? '   *** THE WORLD TOOK IT ***' : '');
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
}
for (const s of ['.fc-pill', '#langs button', '.buildbar .slot', '.rp-launch', '.mnu-pill']) await probe(s);
// control: a press on the world itself must NOT be seen as UI
await page.mouse.move(700, 520); await page.mouse.down();
console.log('WORLD               pointerOnUI', await page.evaluate(() => window.__ascent.input?.pointerOnUI), '(must be false)');
await page.mouse.up();
await b.close();
