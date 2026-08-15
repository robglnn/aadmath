/**
 * Diagnostic 3: walk off the north gate, then do what a panicking player does —
 * hold jump (which opens the wing) and press R. Real keys only.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const GLIDE = !process.argv.includes('--noglide');

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
await page.waitForTimeout(300);

const snap = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos, L = a.player.loco;
  return {
    x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
    r: +Math.hypot(p.x, p.z).toFixed(1), st: L.state, vy: +a.player.vel.y.toFixed(1),
    stuck: a.player.stuck, ui: a.input.uiOpen,
    isl: (() => { const h = a.islandAt(p.x, p.z); return h === null ? null : +h.toFixed(1); })(),
  };
});
const clear = async () => {
  for (let i = 0; i < 4; i++) {
    const s = await page.evaluate(() => ({ ui: window.__ascent.input.uiOpen }));
    if (!s.ui) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
};

// run north off the gate
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
let off = false;
for (let i = 0; i < 130 && !off; i++) {
  await page.waitForTimeout(500);
  const s = await snap();
  if (s.ui) { await page.keyboard.up('KeyW'); await clear(); await page.mouse.click(640, 360); await page.keyboard.down('KeyW'); }
  if (s.isl === null && s.y < 0) off = true;
}
console.log('left the world:', JSON.stringify(await snap()));

if (GLIDE) {
  // the instinct: hold jump. Coyote gives a jump, the hold opens the wing.
  await page.keyboard.down('Space');
  console.log('holding Space (wing)');
}

const t0 = Date.now();
let rP = 0;
while ((Date.now() - t0) / 1000 < 100) {
  await page.waitForTimeout(1000);
  const s = await snap();
  const el = +((Date.now() - t0) / 1000).toFixed(1);
  console.log(el, JSON.stringify(s));
  if (s.isl !== null && s.y > 0) { console.log('   >>> BACK ON GROUND at', el); break; }
  if (el > 8 && rP < 3) { rP++; await page.keyboard.press('KeyR'); console.log('   >>> pressed R (#' + rP + ')'); }
}
await page.keyboard.up('Space');
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
console.log('final', JSON.stringify(await snap()));
await browser.close();
