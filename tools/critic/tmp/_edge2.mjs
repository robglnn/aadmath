/**
 * Diagnostic 2: get the cadet off the edge with nothing but WASD, and watch.
 * No __ascent call makes any progress; every metre is a real key.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const KEY = arg('key', 'KeyW');
const SECS = Number(arg('secs', '45'));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR', m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.mouse.click(640, 360);
await page.waitForTimeout(400);

console.log('pointerlock granted:', await page.evaluate(() => window.__ascent.input.locked));

const snap = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos, L = a.player.loco;
  return {
    x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
    r: +Math.hypot(p.x, p.z).toFixed(1),
    st: L.state, gr: L.grounded, vy: +a.player.vel.y.toFixed(1),
    stuck: a.player.stuck, panel: !!a.panel?.open, menu: !!a.menu?.open,
    ui: a.input.uiOpen,
    isl: (() => { const h = a.islandAt(p.x, p.z); return h === null ? null : +h.toFixed(1); })(),
  };
});

const clear = async () => {
  // close whatever owns the frame, the way a player would
  for (let i = 0; i < 4; i++) {
    const s = await page.evaluate(() => ({
      panel: !!window.__ascent.panel?.open, menu: !!window.__ascent.menu?.open,
      ui: window.__ascent.input.uiOpen,
    }));
    if (!s.panel && !s.menu && !s.ui) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  return false;
};

console.log('start', JSON.stringify(await snap()));
await page.keyboard.down('ShiftLeft');
await page.keyboard.down(KEY);
const t0 = Date.now();
let rP = 0;
let offAt = null;
while ((Date.now() - t0) / 1000 < SECS) {
  await page.waitForTimeout(500);
  const s = await snap();
  const el = +((Date.now() - t0) / 1000).toFixed(1);
  console.log(el, JSON.stringify(s));
  if (s.panel || s.menu || s.ui) {
    await page.keyboard.up(KEY);
    await clear();
    await page.mouse.click(640, 360);
    await page.keyboard.down(KEY);
    console.log('   >>> frame handed back');
  }
  if ((s.isl === null || s.stuck) && offAt === null) { offAt = el; console.log('   >>> OFF/STUCK at', el); }
  if (offAt !== null && el - offAt > 4 && rP < 3) {
    rP++; await page.keyboard.press('KeyR');
    console.log('   >>> pressed R (#' + rP + ')');
  }
}
await page.keyboard.up(KEY);
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(2000);
console.log('final', JSON.stringify(await snap()));
await browser.close();
