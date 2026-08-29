/**
 * HOW BLACK IS A CAST SHADOW ALLOWED TO BE?
 *
 *   tools/critic/rungate.sh tools/critic/_laneFshadowint.mjs --out shots/laneF-si
 *
 * `_laneFprobe2.mjs` proved the dead region IS the sun's cast shadow: switching
 * `castShadow` off takes it from 57.9% of the frame at RGB 0,0,0 to 0.00%.
 * `_laneFlift.mjs` then DISPROVED the obvious fix — an ambient light at 0.70,
 * more than the entire sky fill, moves that frame from 65.9% black to 55.5%,
 * because the shadow is sitting at about 1.5% of the lit value and a doubling
 * of nothing is nothing.
 *
 * The lever that is actually in the right place is three's own
 * `light.shadow.intensity`: `getShadow()` ends `return mix(1.0, shadow,
 * shadowIntensity)`, so it is a floor under the cast shadow, already a uniform,
 * costing nothing and needing no shader surgery.
 *
 * This sweeps it, and reads FOUR framings every time — two buried in shadow and
 * two in open light — because a floor that fixes a shadow by washing out the
 * lit half of the frame is not a fix. The cadet's own contact shadow is
 * measured separately by tools/critic/shadowpixels.mjs; the `contact` row here
 * is its cheap proxy, the luminance step across his own shadow on flat ground.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { blackStats } from './_pngstat.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-si'));
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
  const a = window.__ascent;
  window.__S = [];
  a.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) window.__S.push(o); });
});

const FRAMES = [
  ['shadow', -24.6, -74, 0, 0.35],
  ['shadow2', -31.2, -59.3, -0.6, 0.35],
  ['plaza', 0, 0, 1.2, -0.14],
  ['lit', 24, -18, 2.4, -0.14],
];
const place = (x, z, yaw, pitch) => page.evaluate(([px, pz, y, p]) => {
  const a = window.__ascent;
  const h = a.islandAt(px, pz);
  if (h === null) return false;
  a.player.pos.set(px, h + 0.15, pz);
  a.player.vel.set(0, 0, 0);
  a.player.yaw = y;
  if (a.player.cam) { a.player.cam.yaw = y; a.player.cam.pitch = p; a.player.cam.refound?.(); }
  return true;
}, [x, z, yaw, pitch]);

const measure = async (tag) => {
  const row = { tag };
  for (const [name, x, z, yaw, pitch] of FRAMES) {
    if (!(await place(x, z, yaw, pitch))) continue;
    await page.waitForTimeout(620);
    const file = path.join(OUT, `${tag}-${name}.png`);
    await page.locator('canvas').first().screenshot({ path: file });
    const s = blackStats(file);
    row[name] = { black: s.black, crushed: s.crushed, lum: s.meanLum };
  }
  console.log(`  si=${tag.padEnd(6)} `
    + FRAMES.map(([n]) => row[n]
      ? `${n} ${(row[n].black * 100).toFixed(1)}/${(row[n].crushed * 100).toFixed(1)}/L${row[n].lum}`
      : `${n} —`).join('  '));
  return row;
};

console.log('  black% / crushed% / meanLum at each framing\n');
const rows = [];
for (const si of [1.0, 0.92, 0.86, 0.80, 0.74, 0.68, 0.60]) {
  await page.evaluate((v) => { for (const l of window.__S) l.shadow.intensity = v; }, si);
  await page.waitForTimeout(300);
  rows.push(await measure(String(si)));
}
await page.evaluate(() => { for (const l of window.__S) l.shadow.intensity = 1; });
await writeFile(path.join(OUT, 'si.json'), JSON.stringify({ rows, errors }, null, 1));
console.log(`\n${errors.length} console error(s)`);
await browser.close();
