import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/tmp/critic-rush';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('E: ' + m.text()); });
page.on('pageerror', (e) => logs.push('PE: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3500);
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);
const shot = async (n, ms = 400) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };

const locked = await page.evaluate(() => !!document.pointerLockElement);
console.log('pointerLock', locked);

// walk to open ground first
await page.evaluate(() => {
  const A = window.__ascent, p = A.player;
  p.pos.set(-30, A.islandAt(-30, 60) + 1, 60); p.vel.set(0, 0, 0); p.yaw = 0;
});
await page.waitForTimeout(800);

await page.keyboard.press('Digit2'); // ramp
await page.waitForTimeout(400);

const trail = [];
for (let i = 0; i < 9; i++) {
  const before = await page.evaluate(() => ({ y: window.__ascent.player.pos.y, z: window.__ascent.player.pos.z, tg: window.__ascent.buildTarget() }));
  const r = await page.evaluate(() => window.__ascent.build());
  await page.waitForTimeout(200);
  // run forward up the new ramp the way a player would
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1100);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const A = window.__ascent, p = A.player.pos;
    return { y: +p.y.toFixed(2), z: +p.z.toFixed(2), island: +A.islandAt(p.x, p.z).toFixed(2), surf: A.surfaceAt(p.x, p.z), vy: +A.player.vel.y.toFixed(2) };
  });
  trail.push({ i, ok: r.ok, reason: r.reason, beforeY: +before.y.toFixed(2), afterY: after.y, z: after.z, island: after.island, above: +(after.y - after.island).toFixed(2) });
  if (i === 3) await shot('mid');
}
console.log('RUSH', JSON.stringify(trail, null, 1));
await shot('after');

// pull the camera back to admire the tower
await page.evaluate(() => {
  const A = window.__ascent, B = A.builder;
  B._armT = 0;
  const ps = [];
  for (const k of Object.keys(B.lattice.live)) for (const p of B.lattice.live[k]) ps.push(p);
  if (!ps.length) return;
  let cx = 0, cy = 0, cz = 0;
  for (const p of ps) { cx += p.x; cy += p.y; cz += p.z; }
  cx /= ps.length; cy /= ps.length; cz /= ps.length;
  const pl = A.player;
  pl.pos.set(cx + 22, cy + 8, cz - 24);
  pl.vel.set(0, 0, 0);
  pl.yaw = Math.atan2(cx - pl.pos.x, cz - pl.pos.z);
  window.__n = ps.length;
});
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__ascent.builder._armT = 0; });
await shot('tower', 900);
console.log('pieces', await page.evaluate(() => window.__n));
console.log('LOGS', logs.length, logs.join('\n'));
await browser.close();
