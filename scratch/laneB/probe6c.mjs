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
await page.keyboard.press('KeyW'); await page.waitForTimeout(700);
await page.keyboard.press('Slash'); await page.waitForTimeout(300);
await page.keyboard.press('Escape'); await page.waitForTimeout(600);
await page.keyboard.press('Digit1'); await page.waitForTimeout(700);
const count = () => page.evaluate(() => { const L = window.__ascent.builder?.lattice?.live || {}; return Object.values(L).reduce((a, v) => a + (v?.length || 0), 0); });
const diag = () => page.evaluate(() => ({
  handOut: window.__ascent.builder?.handOut,
  active: window.__ascent.builder?.active,
  uiOpen: window.__ascent.input?.uiOpen,
  locked: window.__ascent.input?.locked,
  grace: window.__ascent.input?._grace,
  wallet: window.__ascent.wallet?.motes ?? window.__ascent.state?.().shards,
}));
console.log('diag', JSON.stringify(await diag()), 'pieces', await count());
// click the middle of the world
await page.mouse.move(720, 500); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
await page.waitForTimeout(900);
console.log('after world click:', await count(), JSON.stringify(await diag()));
// now click the ? pill
const v = await page.evaluate(() => { const el = document.querySelector('.fc-pill'); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { pe: cs.pointerEvents, op: cs.opacity, x: r.x + r.width/2, y: r.y + r.height/2 }; });
console.log('pill', JSON.stringify(v));
const before = await count();
await page.mouse.move(v.x, v.y); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
await page.waitForTimeout(900);
console.log('after pill click:', before, '->', await count());
console.log('errors', errs.length, errs.slice(0,3));
await b.close();
