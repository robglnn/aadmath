/**
 * PROBE (scratch, not a gate): can I reliably wedge the cadet inside terrain,
 * and does Recover actually get him out?
 *
 * Measures escape three ways that do not ask the player module anything:
 *   - the world heightfield, via __ascent.islandAt / surfaceAt
 *   - the real three.js camera's world position, via __ascent.camera
 *   - the real rendered pixels
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/_wedge'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.mouse.click(640, 360);

// Find the deepest hill near the plaza: the column with the most rock above
// the surrounding land.
const hill = await page.evaluate(() => {
  const a = window.__ascent;
  let best = null;
  for (let x = -110; x <= 110; x += 5) {
    for (let z = -110; z <= 110; z += 5) {
      const h = a.islandAt(x, z);
      if (h === null) continue;
      let lo = Infinity;
      for (let b = 0; b < 8; b++) {
        const ang = (b / 8) * Math.PI * 2;
        const g = a.islandAt(x + Math.cos(ang) * 9, z + Math.sin(ang) * 9);
        if (g !== null && g < lo) lo = g;
      }
      if (!Number.isFinite(lo)) continue;
      const rel = h - lo;
      if (!best || rel > best.rel) best = { x, z, h, rel };
    }
  }
  return best;
});
console.log('deepest hill', JSON.stringify(hill));

const facts = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos, c = a.camera;
  const cp = new a.THREE.Vector3();
  c.getWorldPosition(cp);
  const gh = a.islandAt(p.x, p.z);
  const camG = a.islandAt(cp.x, cp.z);
  return {
    x: p.x, y: p.y, z: p.z,
    ground: gh,
    burial: gh === null ? null : +(gh - p.y).toFixed(2),
    cam: { x: +cp.x.toFixed(1), y: +cp.y.toFixed(1), z: +cp.z.toFixed(1) },
    camBurial: camG === null ? null : +(camG - cp.y).toFixed(2),
    boom: +Math.hypot(cp.x - p.x, cp.y - (p.y + 1.46), cp.z - p.z).toFixed(2),
    grounded: !!a.player.grounded,
    stuck: !!a.player.stuck,
    recoveries: a.player.recoveries | 0,
  };
});

// Screen darkness / flatness: black mush has near-zero variance.
const frame = async (name) => {
  const buf = await page.screenshot({ path: path.join(OUT, name + '.png') });
  return buf.length;
};

const wedge = async (dy) => page.evaluate(({ h, dy }) => {
  const a = window.__ascent;
  a.player.pos.set(h.x, h.h - dy, h.z);
  a.player.vel.set(0, 0, 0);
}, { h: hill, dy });

for (const dy of [3, 6, 10]) {
  await wedge(dy);
  await page.waitForTimeout(120);
  const before = await facts();
  await frame(`wedge-${dy}-before`);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(900);
  const after = await facts();
  await frame(`wedge-${dy}-after`);
  console.log(`\n--- buried ${dy}m ---`);
  console.log('before', JSON.stringify(before));
  console.log('after ', JSON.stringify(after));
  await page.waitForTimeout(1500);
}

await browser.close();
