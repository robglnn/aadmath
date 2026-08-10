import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/tmp/critic-hero';
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
await page.waitForTimeout(18000); // let the intro title clear
const shot = async (n, ms = 600) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };

await page.evaluate(() => {
  const A = window.__ascent, p = A.player;
  p.pos.set(-30, A.islandAt(-30, 60) + 1, 60); p.vel.set(0, 0, 0); p.yaw = 0;
});
await page.waitForTimeout(800);
await page.keyboard.press('Digit2');
await page.waitForTimeout(300);
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.__ascent.build());
  await page.waitForTimeout(180);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1100); await page.keyboard.up('KeyW');
  await page.waitForTimeout(420);
}
// a landing at the top: three floors and two walls
await page.keyboard.press('Digit3');
await page.waitForTimeout(250);
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => window.__ascent.build());
  await page.waitForTimeout(200);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(650); await page.keyboard.up('KeyW');
  await page.waitForTimeout(400);
}
await page.keyboard.press('Digit1');
await page.waitForTimeout(250);
await page.evaluate(() => window.__ascent.build());
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const A = window.__ascent, THREE = A.THREE, B = A.builder;
  const ps = [];
  for (const k of Object.keys(B.lattice.live)) for (const p of B.lattice.live[k]) ps.push(p);
  const box = new THREE.Box3();
  const b = new THREE.Box3();
  for (const p of ps) { b.setFromCenterAndSize(new THREE.Vector3(p.x, p.y + 2, p.z), new THREE.Vector3(5, 5, 5)); box.union(b); }
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  return { n: ps.length, c: c.toArray(), s: s.toArray() };
});
console.log('STRUCT', JSON.stringify(info));

for (const [tag, dx, dz, dy] of [['front', 6, -34, 6], ['side', 34, -6, 8], ['low', 4, -20, -6]]) {
  await page.evaluate(({ c, dx, dz, dy }) => {
    const A = window.__ascent, B = A.builder, p = A.player;
    B._armT = 0;
    p.pos.set(c[0] + dx, c[1] + dy, c[2] + dz); p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(c[0] - p.pos.x, c[2] - p.pos.z);
  }, { c: info.c, dx, dz, dy });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__ascent.builder._armT = 0; document.querySelectorAll('.marlow,.dlg').forEach(n=>n.style.opacity=0); });
  await shot('hero-' + tag);
}
console.log('LOGS', logs.length, logs.join('\n'));
await browser.close();
