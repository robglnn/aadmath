/** LANE H — 3 minutes of real walking, watching only for console noise. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const MIN = Number(arg('minutes', 3));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = new Map();
const add = (t) => errs.set(t.slice(0, 120), (errs.get(t.slice(0, 120)) || 0) + 1);
page.on('pageerror', (e) => add('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') add(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2200);
const t0 = Date.now();
await page.keyboard.down('KeyW');
while ((Date.now() - t0) / 1000 < MIN * 60) {
  await page.waitForTimeout(1200);
  await page.keyboard.press('KeyE');
  await page.keyboard.down(Math.random() > 0.5 ? 'ArrowLeft' : 'ArrowRight');
  await page.waitForTimeout(220 + Math.random() * 400);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight');
  if (await page.evaluate(() => !!window.__ascent.panel?.open)) { await page.keyboard.press('Escape'); }
}
await page.keyboard.up('KeyW');
const st = await page.evaluate(() => ({
  wg: window.__ascent.waygates.state(), pos: { ...window.__ascent.player.pos },
  routes: window.__ascent.world.routeStats(), fps: window.__ascent.engine.fps,
}));
console.log('waygates', st.wg.total, 'open', st.wg.open);
console.log('routes', JSON.stringify(st.routes));
console.log('fps', st.fps);
console.log('distinct errors', errs.size);
for (const [k, v] of errs) console.log(' ', v, 'x', k);
await browser.close();
process.exit(errs.size ? 1 : 0);
