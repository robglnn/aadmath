/**
 * The affordance sweep: every class of interactable, approached with real
 * hands, in all three locales, with the frame rate the whole thing costs.
 *   tools/critic/frozen.sh tools/critic/_sweep.mjs --out shots/sweep
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/sweep'));
await mkdir(OUT, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForTimeout(2800);
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
const go = p.locator('.sc-go');
if (await go.count()) await go.first().click({ timeout: 3000 }).catch(() => {});
await p.waitForTimeout(400);

const shot = async (n, ms = 850) => { await p.waitForTimeout(ms); await p.screenshot({ path: path.join(OUT, n + '.png') }); };
const tags = () => p.evaluate(() => [...document.querySelectorAll('.bk-tag')]
  .filter((e) => e.style.display !== 'none').map((e) => e.textContent));
const toast = () => p.evaluate(() => document.querySelector('.toast')?.textContent || '');

async function stand(x, z, back, pitch = 0.02) {
  await p.evaluate(([x, z, back, pitch]) => {
    const A = window.__ascent;
    const r = Math.hypot(x, z) || 1;
    const yaw = Math.atan2(x, z);
    const px = x - (x / r) * back, pz = z - (z / r) * back;
    const g = A.islandAt(px, pz);
    A.player.pos.set(px, (g === null ? 20 : g) + 0.4, pz);
    A.player.vel.set(0, 0, 0);
    A.player.yaw = yaw; A.player.pitch = pitch;
  }, [x, z, back, pitch]);
}

const list = await p.evaluate(() => window.__ascent.rifts.list.map((r) => ({ id: r.id, locked: r.locked, x: r.foot.x, z: r.foot.z })));
const shut = list.find((r) => r.locked);
const live = list.find((r) => !r.locked);

// 1. a shut ring, dead on, from where you would walk at it
await stand(shut.x, shut.z, 13, 0.10);
await shot('01-shut-13m');
console.log('shut@13   ', JSON.stringify(await tags()));
await stand(shut.x, shut.z, 26, 0.10);
await shot('02-shut-26m');

// 2. the live ring and its plate
await stand(live.x, live.z, 12, 0.10);
await shot('03-live-12m');
console.log('live@12   ', JSON.stringify(await tags()));

// 3. an updraft column, walked into
const col = await p.evaluate(() => { const c = window.__ascent.drift.columns[0]; return { x: c.x, z: c.z }; });
await stand(col.x, col.z, 15);
await p.keyboard.down('KeyW');
for (let i = 0; i < 14; i++) {
  await p.waitForTimeout(300);
  const d = await p.evaluate(([x, z]) => Math.hypot(window.__ascent.player.pos.x - x, window.__ascent.player.pos.z - z), [col.x, col.z]);
  if (d < 3) break;
}
await p.keyboard.up('KeyW');
await shot('04-updraft', 700);
console.log('updraft   ', JSON.stringify(await toast()));

// 4. a hanging cache, from the air
const cache = await p.evaluate(() => window.__ascent.caches.state().at[0]);
await p.evaluate(([x, y, z]) => {
  const A = window.__ascent;
  const r = Math.hypot(x, z);
  A.player.pos.set(x * (1 - 34 / r), y + 4, z * (1 - 34 / r));
  A.player.vel.set(0, 0, 0);
  A.player.yaw = Math.atan2(x, z); A.player.pitch = 0;
}, [cache.x, cache.y, cache.z]);
await shot('05-cache', 1100);

// 5. the same live ring, in Spanish and in Polish
for (const loc of ['es', 'pl']) {
  await p.evaluate((l) => document.querySelector(`.langs [data-loc="${l}"]`)?.click(), loc);
  await p.waitForTimeout(600);
  await p.waitForFunction(() => !!window.__ascent);
  await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  const g2 = p.locator('.sc-go');
  if (await g2.count()) await g2.first().click({ timeout: 2500 }).catch(() => {});
  await stand(shut.x, shut.z, 13, 0.10);
  await shot('06-shut-' + loc, 1100);
  console.log('shut@' + loc + '   ', JSON.stringify(await tags()));
  await stand(live.x, live.z, 12, 0.10);
  await shot('07-live-' + loc, 900);
  console.log('live@' + loc + '   ', JSON.stringify(await tags()));
}

// 6. frame rate, measured while standing in the busiest place we made
await p.evaluate((l) => document.querySelector(`.langs [data-loc="${l}"]`)?.click(), 'en');
await p.waitForTimeout(800);
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await stand(live.x, live.z, 14, 0.08);
await p.waitForTimeout(4000);
console.log('perf      ', JSON.stringify(await p.evaluate(() => {
  const s = window.__ascent.state();
  return { fps: Math.round(s.fps), perf: s.perf };
})));

console.log(errs.length ? 'ERRORS\n' + errs.slice(0, 8).join('\n') : 'ERRORS: none');
await b.close();
