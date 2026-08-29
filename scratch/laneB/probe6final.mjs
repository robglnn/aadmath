/** The routing contract, with a control that proves the harness can see a build. */
import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent?.builder, null, { timeout: 40000 });
await page.waitForTimeout(3200);
await page.keyboard.press('KeyW'); await page.waitForTimeout(600);
await page.mouse.move(720, 500);
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(400); }
await page.waitForTimeout(600);
console.log('handOut =', await page.evaluate(() => window.__ascent.builder?.handOut));
const count = () => page.evaluate(() => { const L = window.__ascent.builder?.lattice?.live || {}; return Object.values(L).reduce((a, v) => a + (v?.length || 0), 0); });
const box = (s) => page.evaluate((q) => { const el = document.querySelector(q); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { pe: cs.pointerEvents, op: cs.opacity, x: r.x + r.width/2, y: r.y + r.height/2, w: r.width }; }, s);
const clickAt = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(800); };
let before = await count();
let after = before;
for (const [x, y] of [[700, 520], [720, 560], [640, 600], [800, 640], [720, 470]]) {
  await clickAt(x, y);
  after = await count();
  if (after > before) { console.log('  built from', x, y); break; }
}
console.log(`CONTROL — a press on the WORLD: pieces ${before} -> ${after} ${after > before ? '(built, as it must)' : '!! THE HARNESS CANNOT SEE A BUILD; nothing below is evidence'}`);
if (after <= before) { await b.close(); process.exit(1); }
// bring the ? pill up the way a player does: open the card, dismiss it by hand
await page.keyboard.press('Slash'); await page.waitForTimeout(600);
const g = await box('.fc-x'); if (g?.w && g.pe !== 'none') { await clickAt(g.x, g.y); }
await page.waitForTimeout(800);
let bad = 0;
for (const sel of ['.fc-pill', '#langs button', '.buildbar .slot', '.rp-launch', '.mnu-pill']) {
  const v = await box(sel);
  if (!v || !v.w || v.pe === 'none' || v.op === '0') { console.log(sel.padEnd(20), 'not on screen in this state'); continue; }
  const n0 = await count();
  await clickAt(v.x, v.y);
  const n1 = await count();
  if (n1 > n0) bad++;
  console.log(sel.padEnd(20), `pieces ${n0} -> ${n1}`, n1 > n0 ? '  *** THE WORLD TOOK THE CLICK ***' : '  the interface ate it');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
}
console.log(bad ? `FAIL — ${bad} HUD controls also built` : 'PASS — no HUD control fired the build verb');
console.log('console errors', errs.length);
await b.close();
