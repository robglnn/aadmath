/** Defect 6: click each HUD control with a REAL mouse and see if a piece drops. */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent?.builder, null, { timeout: 40000 });
await page.waitForTimeout(3000);
await page.keyboard.press('KeyW');
await page.waitForTimeout(800);
// dismiss the first-run card so the ? pill comes up
await page.keyboard.press('Slash');
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
// make the hand available: press 1 (a build slot)
await page.keyboard.press('Digit1');
await page.waitForTimeout(600);

const count = () => page.evaluate(() => { const L = window.__ascent.builder?.lattice?.live || {}; return Object.values(L).reduce((a, v) => a + (v?.length || 0), 0); });
const vis = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return { pe: cs.pointerEvents, op: cs.opacity, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
}, sel);

console.log('start pieces', await count());
for (const sel of ['.fc-pill', '.mnu-pill', '.rp-launch', '#langs button', '.buildbar .slot']) {
  const v = await vis(sel);
  if (!v || v.pe === 'none' || v.op === '0' || v.w === 0) { console.log(sel.padEnd(18), 'not clickable now', JSON.stringify(v)); continue; }
  const before = await count();
  await page.mouse.move(v.x, v.y);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(700);
  const after = await count();
  console.log(sel.padEnd(18), 'pieces', before, '->', after, after > before ? '   *** BUILT A PIECE ***' : '');
  // close anything the click opened
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
console.log('errors', errs.length, errs.slice(0, 4));
await b.close();
