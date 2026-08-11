/**
 * Pictures of the three new things, taken off the real game.
 *   node tools/critic/tmp/kitshots.mjs --url http://127.0.0.1:4488 --out shots/kitshots
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4488');
const OUT = path.resolve(arg('out', 'shots/kitshots'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));
const shot = async (n, ms = 500) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(11000);   // let the cold open finish
// a player reads the orders card and starts the run; so does the harness
for (const label of ['BEGIN THE RUN', 'Begin the run']) {
  const b = page.locator(`button:has-text("${label}")`).first();
  if (await b.count() && await b.isVisible()) { await b.click(); break; }
}
await page.waitForTimeout(1200);

/** Stand somewhere, looking at something. */
const stand = (x, y, z, yaw, pitch = -0.05) => page.evaluate(([px, py, pz, ya, pi]) => {
  const A = window.__ascent;
  A.player.pos.set(px, py, pz);
  A.player.vel.set(0, 0, 0);
  A.player.yaw = ya; A.player.pitch = pi;
  A.player.loco.facing = ya;
}, [x, y, z, yaw, pitch]);

// --- 1. a hanging cache, locked: the balance and its three counterweights ---
const c0 = await page.evaluate(() => {
  const c = window.__ascent.caches.list[0];
  return { x: c.x, y: c.y, z: c.z, rot: c.group.rotation.y, q: c.q.latex };
});
// stand on the near lip of the perch, looking across the weights at the beam
const back = 8.6;
await stand(c0.x + Math.sin(c0.rot) * back, c0.y + 0.5, c0.z + Math.cos(c0.rot) * back,
  c0.rot + Math.PI, 0.06);
await shot('cache-locked', 1800);
await page.evaluate(() => { window.__ascent.player.pitch = 0.16; });
await shot('cache-balance', 900);

// --- 2. the drift, from the plaza: veins of motes and the near updraft ------
await stand(0, 60, 40, 3.0, -0.10);
await shot('drift', 1600);
// the standing updraft within sight of the landing
await page.evaluate(() => {
  const A = window.__ascent;
  const c = A.drift.columns[0];
  A.player.pos.set(c.x + 44, A.islandAt(c.x + 44, c.z + 38) + 0.4, c.z + 38);
  A.player.vel.set(0, 0, 0);
  A.player.yaw = Math.atan2(-44, -38);
  A.player.pitch = 0.14;
});
await shot('updraft', 1400);

// --- 3. the vault plate, set and standing ----------------------------------
await page.evaluate(async () => {
  const A = window.__ascent;
  // seal one line the honest way, so the plate is unlocked and paid for
  const m = A.mastery;
  for (let i = 0; i < 200; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); const item = A.itemFor(task);
    if (!item) continue;
    const r = m.observe(task.skill, true, { assisted: task.scaffold !== 'none', form: item.form, rep: item.rep, scene: item.scene, kind: task.kind });
    if (r.justMastered) break;
  }
});
await page.waitForTimeout(2200);
await shot('kit-grant', 900);
await page.evaluate(async () => {
  const A = window.__ascent;
  A.builder.wallet.earn(60);          // a morning's worth of drift motes
  A.player.pos.set(0, 60, 40); A.player.vel.set(0, 0, 0); A.player.yaw = 3.14;
  A.kit.vault();
  await new Promise((r) => setTimeout(r, 250));
  const r = A.build();
  if (r.ok) {
    // …and stand on it, which is the whole point of it
    await new Promise((res) => setTimeout(res, 400));
    A.player.pos.set(r.piece.x, r.piece.y + 0.6, r.piece.z);
    A.player.vel.set(0, 0, 0);
  }
  return r;
});
await page.waitForTimeout(320);
await shot('vault-launch', 60);
await page.waitForTimeout(9000);            // let the rank rite clear the frame
await page.evaluate(() => {
  const A = window.__ascent;
  A.player.pos.set(0, 60, 46); A.player.vel.set(0, 0, 0); A.player.pitch = 0.02;
});
await shot('vault-plate', 1200);

console.log('statement on cache 0:', c0.q, '| console errors', logs.length);
for (const l of logs.slice(0, 5)) console.log(' !', l);
await browser.close();
