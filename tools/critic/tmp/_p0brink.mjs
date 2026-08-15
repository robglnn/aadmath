/**
 * What the edge of the world looks like BEFORE you cross it.
 * Walks north out of the plaza and photographs the coast as it comes up.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p0brink'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.mouse.click(800, 450);

const gap = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  // distance from the boots to the coastline on their own bearing
  let lo = 0, hi = 400, r = Math.hypot(p.x, p.z);
  const ux = r ? p.x / r : 0, uz = r ? p.z / r : -1;
  for (let d = 0; d < 400; d += 1) {
    if (a.islandAt(ux * d, uz * d) === null) { hi = d; break; }
  }
  return { gap: +(hi - r).toFixed(1), r: +r.toFixed(1), y: +p.y.toFixed(1),
    brink: (() => { let r = null; a.scene.traverse(o => { if (o.isMesh && o.material?.uniforms?.uNear && o.geometry.attributes.position.count > 3000) r = { vis: o.visible, uNear: +o.material.uniforms.uNear.value.toFixed(3) }; }); return r; })() };
});

const marks = [70, 40, 22, 10, 3];
let next = 0;
await page.keyboard.down('KeyW');
for (let i = 0; i < 400 && next < marks.length; i++) {
  await page.waitForTimeout(200);
  const g = await gap();
  if (await page.evaluate(() => window.__ascent.input.uiOpen)) {
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.mouse.click(800, 450); await page.keyboard.down('KeyW');
    continue;
  }
  while (next < marks.length && g.gap <= marks[next]) {
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `brink-${String(marks[next]).padStart(2, '0')}m.png`) });
    console.log(`  ${marks[next]}m from the coast:`, JSON.stringify(await gap()));
    next++;
    if (next < marks.length) await page.keyboard.down('KeyW');
  }
}
await page.keyboard.up('KeyW');
console.log('console errors:', errors.length, errors.slice(0, 3).join(' | '));
await browser.close();
