/**
 * Live-vs-sealed read test, and does the prompt come back.
 * Mastery is set through the real engine; every metre walked is a real key.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/afford4'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3200);
const shot = async (n, ms = 300) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(1000);

// Seal the first tear through the real mastery engine (visual test, not an
// interaction test) — then the interaction test below uses real keys only.
await page.evaluate(() => {
  const a = window.__ascent;
  for (let i = 0; i < 14; i++) a.mastery.observe('var-meaning', true, { ms: 4200, assisted: false, kind: 'check' });
  a.rifts.sync(a.mastery);
});
await page.waitForTimeout(2200);
console.log('MASTERED?', await page.evaluate(() => window.__ascent.rifts.list.filter(r => r.mastered).map(r => r.id)));
await shot('01-sealed-far');

const AIM = (mode) => {
  const a = window.__ascent;
  const p = a.player.pos;
  let best = null, bd = 1e9;
  for (const r of a.rifts.list) {
    if (mode === 'sealed' && !r.mastered) continue;
    if (mode === 'live' && (r.mastered || r.locked)) continue;
    const d = Math.hypot(p.x - r.foot.x, p.z - r.foot.z);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best) return null;
  const f = new a.THREE.Vector3(); a.camera.getWorldDirection(f); f.y = 0; f.normalize();
  const v = new a.THREE.Vector3(best.foot.x - p.x, 0, best.foot.z - p.z).normalize();
  return { d: bd, id: best.id, bearing: -Math.atan2(f.x * v.z - f.z * v.x, f.dot(v)) / Math.PI };
};
async function walk(mode, stopAt, seconds = 70) {
  const t0 = Date.now();
  await page.keyboard.down('KeyW');
  while (Date.now() - t0 < seconds * 1000) {
    const r = await page.evaluate(AIM, mode);
    if (!r || r.d < stopAt) break;
    const dx = Math.max(-300, Math.min(300, r.bearing * 300));
    if (Math.abs(dx) > 3) await page.mouse.move(W / 2 + dx, H / 2, { steps: 2 });
    await page.waitForTimeout(110);
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(300);
}
const probe = () => page.evaluate(() => {
  const a = window.__ascent;
  const p = a.player.pos;
  return {
    panel: a.panel.open,
    nearestE: a.rifts.nearest(p)?.id || null,
    afford: a.afford.state(),
  };
});

// turn to face the sealed tear from range and photograph it beside a live one
await page.evaluate(() => { const a = window.__ascent; a.player.pos.set(a.player.pos.x, a.player.pos.y, a.player.pos.z); });
await walk('sealed', 26);
await shot('02-sealed-26m');
console.log('26m', JSON.stringify(await probe()));
await walk('sealed', 6);
await shot('03-sealed-on-plate');
console.log('ON PLATE', JSON.stringify(await probe()));
await page.keyboard.press('KeyE');
await page.waitForTimeout(1200);
console.log('AFTER E', JSON.stringify(await probe()));
await shot('04-sealed-after-E');
await page.keyboard.press('Escape');
await page.waitForTimeout(800);

// back off the plate, still facing it: what does a sealed rift read like at range
await page.keyboard.down('KeyS');
await page.waitForTimeout(4200);
await page.keyboard.up('KeyS');
await shot('04b-sealed-from-range', 600);
console.log('FROM RANGE', JSON.stringify(await probe()));

// now walk to a live one and confirm the plate reads differently
await walk('live', 8);
await shot('05-live-on-plate');
console.log('LIVE PLATE', JSON.stringify(await probe()));
const perf = await page.evaluate(() => window.__ascent.state().perf);
console.log('PERF', JSON.stringify(perf));
console.log('CONSOLE', logs.slice(0, 10));
await browser.close();
