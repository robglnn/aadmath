/** Does the island push back, and is the hardest content worth the flight out? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = 'http://127.0.0.1:4788';
const OUT = 'shots/critfun-risk';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

// give the cadet something to lose
await page.evaluate(async () => {
  const A = window.__ascent;
  for (let i = 0; i < 24; i++) {
    try { A.panel.close(); } catch { /* */ }
    const t = A.nextObjective(); if (!t) break;
    if (!A.openRiftById(t.id)) continue;
    await new Promise((r) => setTimeout(r, 30));
    if (!A.panel.open) continue;
    A.enter(A.panel.item.answer);
    await new Promise((r) => setTimeout(r, 50));
  }
  try { A.panel.close(); } catch { /* */ }
});
await page.waitForTimeout(1000);

// ---- SURGE: stand beside an unsealed rift and wait to be hit
const surge = await page.evaluate(async () => {
  const A = window.__ascent;
  const r = A.rifts.list.find((x) => !x.locked && !x.mastered);
  if (!r) return null;
  A.player.pos.set(r.pos.x + 6, r.pos.y + 1, r.pos.z + 6);
  A.player.vel.set(0, 0, 0);
  const s0 = A.state().shards;
  const seen = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 42000) {
    await new Promise((res) => setTimeout(res, 250));
    const rings = A.drift.rings ? A.drift.rings.length : (A.drift.stats?.surges ?? 0);
    seen.push(rings);
    A.player.pos.set(r.pos.x + 6, r.pos.y + 1, r.pos.z + 6);
  }
  return { rift: r.id, shardsLost: s0 - A.state().shards, stats: { ...A.drift.stats } };
});
await page.screenshot({ path: `${OUT}/surge.png` });

// ---- CACHE: fly out to the far one and read it from the approach
await page.evaluate(async () => {
  const A = window.__ascent;
  const c = A.caches.list.filter((x) => !x.opened).sort((a, b) => b.y - a.y)[0];
  A.player.pos.set(c.x, c.y + 3.4, c.z + 26);
  A.player.vel.set(0, 0, 0);
  A.player.yaw = Math.PI; A.player.pitch = -0.02;
  await new Promise((r) => setTimeout(r, 1400));
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/cache-approach.png` });

const cache = await page.evaluate(async () => {
  const A = window.__ascent;
  const c = A.caches.list.filter((x) => !x.opened).sort((a, b) => b.y - a.y)[0];
  A.player.pos.set(c.x, c.y + 2, c.z);
  await new Promise((r) => setTimeout(r, 600));
  const wrong = c.stones.find((s) => s.v !== c.q.x);
  const p = new A.THREE.Vector3(); wrong.group.getWorldPosition(p);
  const s0 = A.state().shards;
  A.player.pos.set(p.x, p.y, p.z);            // load the WRONG weight first
  await new Promise((r) => setTimeout(r, 1200));
  return { wrongValue: wrong.v, right: c.q.x, opened: c.opened, delta: A.state().shards - s0 };
});
await page.screenshot({ path: `${OUT}/cache-wrong.png` });

const crack = await page.evaluate(async () => {
  const A = window.__ascent;
  const c = A.caches.list.filter((x) => !x.opened).sort((a, b) => b.y - a.y)[0];
  A.player.pos.set(c.x, c.y + 2, c.z);
  await new Promise((r) => setTimeout(r, 500));
  const right = c.stones.find((s) => s.v === c.q.x);
  const p = new A.THREE.Vector3(); right.group.getWorldPosition(p);
  const s0 = A.state().shards; const col0 = A.drift.columns.length;
  A.player.pos.set(p.x, p.y, p.z);
  await new Promise((r) => setTimeout(r, 1400));
  return { opened: c.opened, gained: A.state().shards - s0, columns: A.drift.columns.length - col0, latex: c.q.latex };
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/cache-open.png` });

console.log(JSON.stringify({ errors, surge, cache, crack }, null, 1));
await browser.close();
