/**
 * The gold diamonds: a vein that has grown beside an open tear pays three times
 * as much, and until now nothing said so. Seal one line so that more tears open,
 * then stand in a charged vein and read the frame.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/gold'));
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForTimeout(2600);
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
const go = p.locator('.sc-go');
if (await go.count()) await go.first().click({ timeout: 3000 }).catch(() => {});

// Seal the opening line — state setup only; the walk-in path is tested in
// tools/critic/_afford.mjs with a real keyboard.
for (let i = 0; i < 14; i++) {
  await p.evaluate(() => { if (!window.__ascent.panel.open) window.__ascent.openRiftById('var-meaning'); });
  await p.waitForTimeout(320);
  await p.evaluate(() => window.__ascent.panel.open && window.__ascent.panel.demo('right'));
  await p.waitForTimeout(900);
  await p.evaluate(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
  await p.waitForTimeout(220);
  const done = await p.evaluate(() => !!window.__ascent.mastery.get('var-meaning')?.mastered);
  if (done) break;
}
await p.waitForTimeout(1200);
const field = await p.evaluate(() => {
  const A = window.__ascent;
  const rich = A.drift.veins.filter((v) => v.rich).map((v) => ({ x: Math.round(v.x), z: Math.round(v.z) }));
  return { rich, locked: A.rifts.list.filter((r) => r.locked).length, f: A.drift.field() };
});
console.log('after one line sealed:', JSON.stringify(field));

if (field.rich.length) {
  const v = field.rich[0];
  await p.evaluate(([x, z]) => {
    const A = window.__ascent;
    const r = Math.hypot(x, z) || 1;
    const px = x - (x / r) * 11, pz = z - (z / r) * 11;
    A.player.pos.set(px, (A.islandAt(px, pz) ?? 20) + 0.4, pz);
    A.player.vel.set(0, 0, 0);
    A.player.yaw = Math.atan2(x, z); A.player.pitch = -0.02;
  }, [v.x, v.z]);
  await p.waitForTimeout(1100);
  await p.screenshot({ path: path.join(OUT, '01-charged-vein.png') });
  console.log('gold tags', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.bk-tag')].filter((e) => e.style.display !== 'none').map((e) => e.textContent))));
}
console.log(errs.length ? 'ERRORS ' + errs.slice(0, 4).join(' | ') : 'ERRORS: none');
await b.close();
