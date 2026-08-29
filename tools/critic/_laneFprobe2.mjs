/**
 * WHY IS IT BLACK? A controlled experiment, not a hypothesis.
 *
 *   tools/critic/rungate.sh tools/critic/_laneFprobe2.mjs --out shots/laneF-probe
 *
 * Stands the lens in the worst frame the census found and then changes ONE
 * thing at a time in the running build — the sun's shadow, each fill light in
 * turn, the post grade — capturing and measuring after each. Whatever makes the
 * dead region come back to life is the cause of it.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { blackStats } from './_pngstat.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-probe'));
const X = Number(arg('x', -24.6)), Z = Number(arg('z', -74));
const YAW = Number(arg('yaw', 0)), PITCH = Number(arg('pitch', 0.35));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  for (const el of document.body.querySelectorAll('*')) {
    if (el.tagName !== 'CANVAS' && el.id !== 'app') el.style.setProperty('display', 'none', 'important');
  }
});

await page.evaluate(([x, z, yaw, pitch]) => {
  const a = window.__ascent;
  const h = a.islandAt(x, z);
  a.player.pos.set(x, h + 0.15, z);
  a.player.vel.set(0, 0, 0);
  a.player.yaw = yaw;
  if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; a.player.cam.refound?.(); }
  window.__probe = { lights: [] };
  a.scene.traverse((o) => {
    if (o.isLight) window.__probe.lights.push(o);
  });
  return true;
}, [X, Z, YAW, PITCH]);
await page.waitForTimeout(1200);

const inventory = await page.evaluate(() => window.__probe.lights.map((l, i) => ({
  i, type: l.type, intensity: l.intensity, castShadow: !!l.castShadow,
  color: l.color?.getHexString?.() || '', ground: l.groundColor?.getHexString?.() || '',
  pos: [l.position.x.toFixed(1), l.position.y.toFixed(1), l.position.z.toFixed(1)],
})));
console.log('lights in the scene:');
for (const l of inventory) console.log(`  ${l.i}  ${l.type.padEnd(20)} i=${l.intensity} shadow=${l.castShadow} col=#${l.color} gnd=#${l.ground} pos=${l.pos.join(',')}`);

const shot = async (name) => {
  await page.waitForTimeout(700);
  const file = path.join(OUT, `${name}.png`);
  await page.locator('canvas').first().screenshot({ path: file });
  const s = blackStats(file);
  console.log(`  ${name.padEnd(26)} black ${(s.black * 100).toFixed(2)}%  crushed ${(s.crushed * 100).toFixed(2)}%  meanLum ${s.meanLum}`);
  return { name, ...s, hist: undefined };
};

const rows = [];
rows.push(await shot('00-as-shipped'));

// ---- one thing at a time -------------------------------------------------
const set = (js, arg2) => page.evaluate(js, arg2);

await set(() => { for (const l of window.__probe.lights) if (l.castShadow) { l.userData.__cs = true; l.castShadow = false; } });
rows.push(await shot('01-no-sun-shadow'));
await set(() => { for (const l of window.__probe.lights) if (l.userData.__cs) l.castShadow = true; });

for (const idx of inventory.map((l) => l.i)) {
  await set((i) => {
    const l = window.__probe.lights[i];
    l.userData.__was = l.intensity; l.intensity = l.intensity * 6;
  }, idx);
  const r = await shot(`02-x6-light${idx}-${inventory[idx].type}`);
  rows.push(r);
  await set((i) => { const l = window.__probe.lights[i]; l.intensity = l.userData.__was; }, idx);
}

// the post chain: is the black coming out of the grade rather than the scene?
await set(() => { const f = window.__ascent.fx; if (f && f.setEnabled) f.setEnabled(false); if (f) f.enabled = false; });
rows.push(await shot('03-fx-off-if-possible'));

await writeFile(path.join(OUT, 'probe.json'), JSON.stringify({ x: X, z: Z, yaw: YAW, pitch: PITCH, inventory, rows, errors }, null, 1));
console.log(`\n${errors.length} console error(s)`);
await browser.close();
