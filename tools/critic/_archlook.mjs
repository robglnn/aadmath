/**
 * ARCHIPELAGO — a look at the off-island sites from the bands a cadet reads
 * them from. Camera placement only; no progress is made through the debug API.
 *
 *   node tools/critic/_archlook.mjs --url http://127.0.0.1:5173 --out shots/arch
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/arch'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

const shot = async (n, wait = 900) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };

// stand off a cache at `dist` metres along its own facing, `up` above the deck
const aim = (dist, up, pitch = 0.0) => page.evaluate(({ dist, up, pitch }) => {
  const A = window.__ascent;
  const c = A.caches.list.find((x) => !x.opened);
  const f = new A.THREE.Vector3(0, 0, 1).applyQuaternion(c.group.quaternion);
  A.player.pos.set(c.x + f.x * dist, c.y + up, c.z + f.z * dist);
  A.player.vel.set(0, 0, 0);
  const yaw = Math.atan2(-f.x, -f.z);
  A.player.yaw = yaw;
  if (A.player.cam) { A.player.cam.yaw = yaw; A.player.cam.pitch = pitch; }
  return { x: c.x, y: c.y, z: c.z, latex: c.q.latex };
}, { dist, up, pitch });

console.log('cache', JSON.stringify(await aim(5, 1.4)));
await shot('01-perch-5m');
await aim(12, 1.6); await shot('02-perch-12m');
await aim(24, 2.5); await shot('03-back-24m');
await aim(45, 4); await shot('04-back-45m');
await aim(90, 10); await shot('05-back-90m');

// from the island looking out: what does a cadet see that makes him go?
await page.evaluate(() => {
  const A = window.__ascent;
  const c = A.caches.list.find((x) => !x.opened);
  const k = Math.hypot(c.x, c.z);
  A.player.pos.set(c.x / k * 60, 40, c.z / k * 60);
  A.player.vel.set(0, 0, 0);
  const yaw = Math.atan2(-(c.x - c.x / k * 60), -(c.z - c.z / k * 60));
  A.player.yaw = yaw;
  if (A.player.cam) { A.player.cam.yaw = yaw; A.player.cam.pitch = 0.0; }
});
await shot('06-from-island');

console.log('errors:', errors.length, errors.slice(0, 6));
await browser.close();
