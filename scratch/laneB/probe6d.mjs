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
await page.waitForTimeout(3200);
await page.keyboard.press('KeyW'); await page.waitForTimeout(700);
// real input: the wheel draws the lattice hand
await page.mouse.move(720, 500);
await page.mouse.wheel(0, 120); await page.waitForTimeout(600);
await page.mouse.wheel(0, -120); await page.waitForTimeout(600);

const count = () => page.evaluate(() => { const L = window.__ascent.builder?.lattice?.live || {}; return Object.values(L).reduce((a, v) => a + (v?.length || 0), 0); });
const diag = () => page.evaluate(() => ({ handOut: window.__ascent.builder?.handOut, uiOpen: window.__ascent.input?.uiOpen, locked: window.__ascent.input?.locked }));
console.log('diag', JSON.stringify(await diag()), 'pieces', await count());

async function clickAt(x, y) {
  await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(750);
}
let before = await count();
await clickAt(700, 520);
console.log('WORLD click:', before, '->', await count());

for (const sel of ['.fc-pill', '.mnu-pill', '.rp-launch', '#langs button', '.buildbar .slot', '.buildbar .slot.place']) {
  const v = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { pe: cs.pointerEvents, op: cs.opacity, x: r.x + r.width/2, y: r.y + r.height/2, w: r.width }; }, sel);
  if (!v || v.pe === 'none' || v.op === '0' || !v.w) { console.log(sel.padEnd(22), 'not live', JSON.stringify(v)); continue; }
  before = await count();
  await clickAt(v.x, v.y);
  const after = await count();
  console.log(sel.padEnd(22), before, '->', after, after > before ? '  *** BUILT ***' : '');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
}
console.log('errors', errs.length, errs.slice(0,3));
await b.close();
