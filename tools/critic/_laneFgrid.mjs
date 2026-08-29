/**
 * THE TWO LEVERS, SWEPT TOGETHER, WITH THE LIT SIDE HELD.
 *
 *   tools/critic/rungate.sh tools/critic/_laneFgrid.mjs --out shots/laneF-grid
 *
 * A cast shadow floor (`light.shadow.intensity`) fixes the shadows the sun's
 * own geometry throws. It does not fix a hillside that simply faces away from a
 * 22-degree sun, because that hillside is not in shadow at all — it is lit by a
 * fill running about twenty times under the key.
 *
 * So both are swept together, and the LIT half of the frame is held: every row
 * prints the plaza's and the open-ground framing's mean luminance beside the
 * shadow numbers, and a row that lifts the shadow by washing those out is not a
 * candidate. `key` scales the sun back down to pay for the fill.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { blackStats } from './_pngstat.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-grid'));
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
  window.__G = { sun: [], hemi: [], deck: [], bounce: [] };
  a.scene.traverse((o) => {
    if (o.isDirectionalLight && o.castShadow) window.__G.sun.push(o);
    else if (o.isHemisphereLight && o.userData.deck) window.__G.deck.push(o);
    else if (o.isHemisphereLight) window.__G.hemi.push(o);
    else if (o.isDirectionalLight && o.position.y < 100) window.__G.bounce.push(o);
  });
  for (const k of Object.keys(window.__G)) for (const l of window.__G[k]) l.userData.__b = l.intensity;
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
    await page.waitForTimeout(600);
    const file = path.join(OUT, `${tag}-${name}.png`);
    await page.locator('canvas').first().screenshot({ path: file });
    const s = blackStats(file);
    row[name] = { black: s.black, crushed: s.crushed, lum: s.meanLum };
  }
  console.log(`  ${tag.padEnd(30)}`
    + FRAMES.map(([n]) => row[n]
      ? `${n} ${(row[n].black * 100).toFixed(1)}/${(row[n].crushed * 100).toFixed(1)}/L${String(row[n].lum).padStart(6)}`
      : `${n} —`).join('  '));
  return row;
};

const apply = (s) => page.evaluate((q) => {
  const G = window.__G;
  for (const k of Object.keys(G)) for (const l of G[k]) l.intensity = l.userData.__b * (q[k] ?? 1);
  for (const l of G.sun) l.shadow.intensity = q.si ?? 1;
  return true;
}, s);

console.log('  black% / crushed% / meanLum\n');
const rows = [];
for (const s of [
  {},
  { si: 0.78 },
  { si: 0.78, hemi: 1.55, sun: 0.92 },
  { si: 0.72, hemi: 1.55, deck: 1.4, bounce: 1.25, sun: 0.90 },
  { si: 0.66, hemi: 2.0, deck: 1.6, bounce: 1.4, sun: 0.86 },
  { si: 0.60, hemi: 2.4, deck: 1.8, bounce: 1.5, sun: 0.82 },
  {},
]) {
  await apply(s);
  await page.waitForTimeout(280);
  rows.push(await measure(Object.entries(s).map(([k, v]) => `${k}=${v}`).join(' ') || 'as-shipped'));
}
await apply({});
await writeFile(path.join(OUT, 'grid.json'), JSON.stringify({ rows, errors }, null, 1));
console.log(`\n${errors.length} console error(s)`);
await browser.close();
