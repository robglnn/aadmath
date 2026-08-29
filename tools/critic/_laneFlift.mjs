/**
 * HOW MUCH LIGHT DOES THE SHADOW NEED, AND WHAT DOES IT COST THE LIT SIDE?
 *
 *   tools/critic/rungate.sh tools/critic/_laneFlift.mjs --out shots/laneF-lift
 *
 * `_laneFprobe2.mjs` established the cause by switching one thing at a time:
 * turning the sun's cast shadow off takes the dead region from 57.9% of the
 * frame to 0.00%, so the dead region IS the cast shadow and the ambient that
 * survives inside it is too small to render.
 *
 * A fill that fixes a shadow by flattening the lit half of the frame is not a
 * fix, so every candidate here is measured at TWO framings at once: the worst
 * shadow the census found, and open lit ground on the plaza. The number that
 * matters is black-in-shadow going to zero while the plaza's mean luminance and
 * its own light-to-shade spread stay where they are.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { blackStats } from './_pngstat.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-lift'));
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
  window.__L = { lights: [], amb: null };
  a.scene.traverse((o) => { if (o.isLight) window.__L.lights.push(o); });
  for (const l of window.__L.lights) l.userData.__base = l.intensity;
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
    await page.waitForTimeout(650);
    const file = path.join(OUT, `${tag}-${name}.png`);
    await page.locator('canvas').first().screenshot({ path: file });
    const s = blackStats(file);
    row[name] = { black: s.black, crushed: s.crushed, lum: s.meanLum };
  }
  console.log(`  ${tag.padEnd(26)} `
    + FRAMES.map(([n]) => row[n]
      ? `${n} ${(row[n].black * 100).toFixed(1)}%/${(row[n].crushed * 100).toFixed(1)}%/L${row[n].lum}`
      : `${n} —`).join('   '));
  return row;
};

const apply = (spec) => page.evaluate((s) => {
  const a = window.__ascent, T = a.THREE;
  for (const l of window.__L.lights) l.intensity = l.userData.__base;
  if (window.__L.amb) { a.scene.remove(window.__L.amb); window.__L.amb = null; }
  for (const l of window.__L.lights) {
    if (l.isHemisphereLight && !l.userData.deck) l.intensity *= s.hemi ?? 1;
    if (l.isHemisphereLight && l.userData.deck) l.intensity *= s.deck ?? 1;
    if (l.isDirectionalLight && !l.castShadow && l.position.y < 100) l.intensity *= s.bounce ?? 1;
  }
  if (s.amb) {
    const q = new T.AmbientLight(new T.Color(s.ambColor || '#7f94bb'), s.amb);
    a.scene.add(q); window.__L.amb = q;
  }
  return true;
}, spec);

console.log('  (black% / crushed% / meanLum) at each framing\n');
const rows = [];
rows.push(await measure('00-as-shipped'));
for (const s of [
  { hemi: 1.5 }, { hemi: 2 }, { hemi: 3 },
  { amb: 0.12 }, { amb: 0.20 }, { amb: 0.30 }, { amb: 0.45 }, { amb: 0.70 },
  { bounce: 2 }, { bounce: 3 },
  { amb: 0.20, hemi: 1.4 }, { amb: 0.30, hemi: 1.3 },
]) {
  await apply(s);
  rows.push(await measure(Object.entries(s).map(([k, v]) => `${k}${v}`).join('-')));
}
await apply({});
await writeFile(path.join(OUT, 'lift.json'), JSON.stringify({ rows, errors }, null, 1));
console.log(`\n${errors.length} console error(s)`);
await browser.close();
