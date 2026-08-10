import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/tmp/critic-tower';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('E: ' + m.text()); });
page.on('pageerror', (e) => logs.push('PE: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3500);
await page.mouse.click(800, 450);
await page.waitForTimeout(19000);
const shot = async (n, ms = 700) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };

// spiral tower: ramp, walk up, turn 90°, repeat — the way a player builds a keep
const base = await page.evaluate(() => {
  const A = window.__ascent, p = A.player;
  const x = -20, z = 70;
  p.pos.set(x, A.islandAt(x, z) + 1, z); p.vel.set(0, 0, 0); p.yaw = 0;
  return { x, z, y: A.islandAt(x, z) };
});
await page.keyboard.press('Digit2');
await page.waitForTimeout(300);
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.__ascent.build());
  await page.waitForTimeout(190);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1150); await page.keyboard.up('KeyW');
  await page.waitForTimeout(380);
  await page.evaluate(() => { window.__ascent.player.yaw += Math.PI / 2; });
  await page.waitForTimeout(220);
}
await page.keyboard.press('Digit3');
await page.waitForTimeout(250);
await page.evaluate(() => window.__ascent.build());
await page.waitForTimeout(500);
await page.keyboard.press('Digit1');
await page.waitForTimeout(250);
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => window.__ascent.build());
  await page.evaluate(() => { window.__ascent.player.yaw += Math.PI / 2; });
  await page.waitForTimeout(400);
}

const info = await page.evaluate(() => {
  const A = window.__ascent, B = A.builder;
  const ps = [];
  for (const k of Object.keys(B.lattice.live)) for (const p of B.lattice.live[k]) ps.push({ k, x: p.x, y: p.y, z: p.z });
  const xs = ps.map(p => p.x), ys = ps.map(p => p.y), zs = ps.map(p => p.z);
  return { n: ps.length, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, cz: (Math.min(...zs) + Math.max(...zs)) / 2,
    h: Math.max(...ys) - Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) };
});
console.log('TOWER', JSON.stringify(info));

for (const [tag, dist, dy] of [['near', 22, 2], ['mid', 40, 8], ['far', 70, 14]]) {
  await page.evaluate(({ info, dist, dy }) => {
    const A = window.__ascent, B = A.builder, p = A.player;
    B._armT = 0;
    const ang = Math.PI * 0.75;
    p.pos.set(info.cx + Math.sin(ang) * dist, info.cy + dy, info.cz + Math.cos(ang) * dist);
    p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(info.cx - p.pos.x, info.cz - p.pos.z);
  }, { info, dist, dy });
  await page.waitForTimeout(1100);
  await page.evaluate(() => { window.__ascent.builder._armT = 0; });
  await shot('tower-' + tag);
}
console.log('LOGS', logs.length, logs.join('\n'));
await browser.close();
