/**
 * HOW MUCH OF THE FRAME HAS NOTHING IN IT.
 *
 *   tools/critic/rungate.sh tools/critic/_laneFdark.mjs --out shots/laneF-dark --tag before
 *
 * Four framings, taken the same way twice so a change can be measured rather
 * than admired:
 *
 *   approach  the minute-1 walk in to the first objective the game names, on
 *             real keys from a fixed bearing
 *   slope     the most anti-sun steep ground on the island, found by scanning
 *             the real heightfield, looked into from up-sun
 *   shards    the undersides of the floating rocks, from under them
 *   keel      the island's own keel from off the coast
 *
 * The number reported for each is the share of the WORLD's pixels — the HUD is
 * hidden for the reading — that are RGB 0,0,0 (`black`) and the share under 5%
 * luminance (`crushed`). Both come from the bytes, not from an eye.
 *
 * The two placements are a starting condition, exactly as in
 * tools/critic/compose.mjs: the cadet is put on ground the world says exists
 * and the frame is then solved by the real camera. Nothing is opened, answered
 * or unlocked through the debug surface.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { blackStats } from './_pngstat.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-dark'));
const TAG = arg('tag', 'now');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3000);

const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
const handBack = async () => {
  for (let i = 0; i < 6; i++) {
    const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input.uiOpen));
    if (!busy) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
};
await clear();

// THE CANVAS, NOT THE PAGE. Screenshotting the page photographs the HUD, the
// companion's card and the boot veil along with the world, and those are DOM —
// so a change to the objective card moves the "black" number and a change to
// the lighting does not move it as far as it should. `locator('canvas')`
// captures the drawn frame and nothing else.
const shot = async (name) => {
  await handBack(); await clear();
  await page.waitForTimeout(500);
  const file = path.join(OUT, `${TAG}-${name}.png`);
  await page.locator('canvas').first().screenshot({ path: file });
  const s = blackStats(file);
  console.log(`  ${name.padEnd(9)} black ${(s.black * 100).toFixed(2)}%   `
    + `crushed ${(s.crushed * 100).toFixed(2)}%   meanLum ${s.meanLum}`);
  return { name, file, ...s };
};

const standAt = (x, z, dy = 0.15) => page.evaluate(([px, pz, d]) => {
  const a = window.__ascent;
  const h = a.islandAt(px, pz);
  if (h === null) return false;
  a.player.pos.set(px, h + d, pz);
  a.player.vel.set(0, 0, 0);
  a.player.cam?.refound?.();
  return true;
}, [x, z, dy]);

const faceYaw = async (want) => {
  for (let i = 0; i < 12; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2;
      return e;
    }, want);
    if (Math.abs(d) < 0.08) return true;
    const k = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k);
    await page.waitForTimeout(Math.min(380, Math.max(40, (Math.abs(d) / 2.6) * 1000)));
    await page.keyboard.up(k);
  }
  return false;
};

// ---------------------------------------------------------------------------
// Where the darkest ground on this island is, off the real heightfield.
// The sun is one vector (src/world/daylight.js) and a face's own lighting is
// dot(normal, sun): the most negative of those, on ground steep enough to fill
// a frame, is the shot this whole finding is about.
// ---------------------------------------------------------------------------
const sites = await page.evaluate(() => {
  const a = window.__ascent;
  const S = { x: -0.740, y: 0.375, z: -0.500 };
  const L = Math.hypot(S.x, S.y, S.z);
  S.x /= L; S.y /= L; S.z /= L;
  let best = null;
  for (let x = -85; x <= 85; x += 2) {
    for (let z = -85; z <= 85; z += 2) {
      const h = a.islandAt(x, z); if (h === null) continue;
      const e = 1.6;
      const hx1 = a.islandAt(x + e, z), hx0 = a.islandAt(x - e, z);
      const hz1 = a.islandAt(x, z + e), hz0 = a.islandAt(x, z - e);
      if (hx1 === null || hx0 === null || hz1 === null || hz0 === null) continue;
      const nx = -(hx1 - hx0) / (2 * e), nz = -(hz1 - hz0) / (2 * e);
      const nl = Math.hypot(nx, 1, nz);
      const ndl = (nx * S.x + 1 * S.y + nz * S.z) / nl;
      const slope = Math.atan(Math.hypot(nx, nz));
      if (slope < 0.55) continue;             // under ~32°: not a face, a field
      const score = -ndl + slope * 0.25;
      if (!best || score > best.score) best = { x, z, h, ndl: +ndl.toFixed(3), slope: +slope.toFixed(3), score };
    }
  }
  // Somewhere under the floating rocks: the biggest cluster of things drawn
  // above head height that are not the sky.
  const over = [];
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const p = new a.THREE.Vector3(); o.getWorldPosition(p);
    if (p.y > 24 && p.y < 140 && Math.hypot(p.x, p.z) < 220) over.push({ x: p.x, y: p.y, z: p.z });
  });
  over.sort((p, q) => p.y - q.y);
  const shard = over.length ? over[Math.floor(over.length / 2)] : null;
  return { slope: best, shard, overhead: over.length };
});
console.log(`  ..  darkest slope: (${sites.slope?.x}, ${sites.slope?.z}) `
  + `n·L=${sites.slope?.ndl} slope=${sites.slope?.slope}`);
console.log(`  ..  ${sites.overhead} meshes overhead; shard sample `
  + (sites.shard ? `(${sites.shard.x.toFixed(0)}, ${sites.shard.y.toFixed(0)}, ${sites.shard.z.toFixed(0)})` : 'none'));

const out = [];

// ---- 1. the minute-1 approach to the first objective ----------------------
const obj = await page.evaluate(() => window.__ascent.objective());
console.log(`  ..  first objective: ${obj ? `${obj.skill} at (${obj.x.toFixed(0)}, ${obj.z.toFixed(0)})` : 'none'}`);
if (obj) {
  const RING = 17;
  const sx = obj.x + Math.cos(0.9) * RING, sz = obj.z + Math.sin(0.9) * RING;
  if (await standAt(sx, sz)) {
    await page.waitForTimeout(600);
    await faceYaw(Math.atan2(obj.x - sx, obj.z - sz));
    await clear();
    out.push(await shot('approach-ring'));
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      await page.waitForTimeout(250);
      const p = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
      if (Math.hypot(p.x - obj.x, p.z - obj.z) < 6) break;
    }
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(900);
    out.push(await shot('approach-at'));
  }
}

// ---- 2. the shadowed slope ------------------------------------------------
if (sites.slope) {
  const S = { x: -0.740, z: -0.500 };
  const L = Math.hypot(S.x, S.z);
  // stand 14 m up-sun of the face and look down the sun's own bearing into it
  const px = sites.slope.x + (S.x / L) * 14, pz = sites.slope.z + (S.z / L) * 14;
  if (await standAt(px, pz)) {
    await page.waitForTimeout(700);
    await faceYaw(Math.atan2(sites.slope.x - px, sites.slope.z - pz));
    await clear();
    out.push(await shot('slope'));
  }
}

// ---- 3. the undersides of the floating rocks ------------------------------
//
// The framing the finding is actually about: standing under a shard and
// looking up at it. The lens is pitched by writing the same field the mouse
// writes — a framing, exactly as the placement above is a framing; the reading
// is the bytes of the capture.
const lookUp = (p) => page.evaluate((v) => {
  const c = window.__ascent.player.cam;
  if (!c) return false;
  c.pitch = v;
  return true;
}, p);
if (sites.shard) {
  if (await standAt(sites.shard.x, sites.shard.z)) {
    await page.waitForTimeout(700);
    await lookUp(0.92);
    await page.waitForTimeout(900);
    out.push(await shot('under-shard'));
    await lookUp(-0.14);
  }
}

// ---- 3b. every shard from under it, worst frame kept ----------------------
{
  const shards = await page.evaluate(() => {
    const a = window.__ascent, out2 = [];
    const p = new a.THREE.Vector3();
    a.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      o.getWorldPosition(p);
      const r = Math.hypot(p.x, p.z);
      if (p.y > 20 && p.y < 90 && r < 140 && r > 6) out2.push({ x: p.x, y: p.y, z: p.z, r });
    });
    out2.sort((q, w) => q.y - w.y);
    return out2.slice(0, 40).filter((_, i) => i % 5 === 0);
  });
  let worst = null;
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (!(await standAt(s.x, s.z))) continue;
    await page.waitForTimeout(450);
    await lookUp(0.92);
    await page.waitForTimeout(700);
    const r = await shot(`shardsweep-${i}`);
    if (!worst || r.black > worst.black) worst = r;
    await lookUp(-0.14);
  }
  if (worst) console.log(`  ..  worst shard frame: ${(worst.black * 100).toFixed(2)}% black (${worst.name})`);
}

// ---- 4. the keel, from off the coast --------------------------------------
{
  // the coast on the anti-sun side, looking back at the island
  if (await standAt(62, 42)) {
    await page.waitForTimeout(700);
    await faceYaw(Math.atan2(0 - 62, 0 - 42));
    await clear();
    out.push(await shot('coast'));
  }
}

await writeFile(path.join(OUT, `${TAG}.json`), JSON.stringify({ tag: TAG, url: URL, sites, obj, out, errors }, null, 1));
console.log(`\n${TAG}: ${out.length} frames — ${errors.length} console error(s)`);
if (errors.length) console.log(errors.slice(0, 4).join('\n'));
await browser.close();
