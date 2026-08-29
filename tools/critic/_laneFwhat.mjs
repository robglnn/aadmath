/**
 * WHAT IS THE BLACK MADE OF?
 *
 *   tools/critic/rungate.sh tools/critic/_laneFwhat.mjs --out shots/laneF-what
 *
 * A frame that measures 30% RGB 0,0,0 is a finding; it is not yet a cause. This
 * walks the island on a fixed lattice of standing places and fixed lens angles,
 * captures each frame, and for the pixels that came back black it casts the
 * SAME ray through the SAME three.js camera and names what it hit: the object,
 * its material, its geometry's world normal, and whether the hit was the
 * heightfield or a drawn solid.
 *
 * Everything here is deterministic — fixed positions, fixed yaw and pitch
 * written straight onto the rig, a fixed settle — so the same frame is taken
 * before and after a change and the two numbers are about the change.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { blackStats, decodePNG } from './_pngstat.mjs';
import { readFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-what'));
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

// The HUD and the companion's card are DOM drawn over the canvas, and a
// clipped screenshot still photographs them. They are not the world, so they
// are hidden for the whole run: the number wanted here is the share of the
// RENDERED FRAME with nothing in it.
await page.addStyleTag({ content: '#ui, #hud, #boot { display: none !important; }' });
await page.evaluate(() => {
  for (const el of document.body.children) {
    if (el.tagName !== 'CANVAS' && el.id !== 'app') el.style.setProperty('display', 'none', 'important');
  }
  const app = document.getElementById('app');
  if (app) for (const el of app.children) if (el.tagName !== 'CANVAS') el.style.setProperty('display', 'none', 'important');
});

/** Put the cadet somewhere and aim the lens. A framing, not progress. */
const frame = (x, z, yaw, pitch) => page.evaluate(([px, pz, y, p]) => {
  const a = window.__ascent;
  const h = a.islandAt(px, pz);
  if (h === null) return false;
  a.player.pos.set(px, h + 0.15, pz);
  a.player.vel.set(0, 0, 0);
  a.player.yaw = y;
  if (a.player.cam) { a.player.cam.yaw = y; a.player.cam.pitch = p; a.player.cam.refound?.(); }
  return true;
}, [x, z, yaw, pitch]);

/**
 * For a list of NDC points, what does the real camera see there — and how dark
 * would the shading be? Names the object, the material, and the world normal,
 * so "which faces are black" is answered by the scene graph rather than by eye.
 */
const whatAt = (pts) => page.evaluate((list) => {
  const a = window.__ascent, T = a.THREE, cam = a.camera;
  const mine = new Set(); a.player.root.traverse((o) => mine.add(o));
  const meshes = [];
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible || mine.has(o)) return;
    const m = o.material; if (!m) return;
    meshes.push(o);
  });
  const ray = new T.Raycaster();
  ray.near = 0.05; ray.far = 3000;
  const v2 = new T.Vector2();
  const out = [];
  const eye = new T.Vector3(); cam.getWorldPosition(eye);
  for (const [nx, ny] of list) {
    v2.set(nx, ny);
    ray.setFromCamera(v2, cam);
    const hits = ray.intersectObjects(meshes, false);
    const h = hits.find((q) => q.face) || hits[0];
    let ground = null;
    const d = ray.ray.direction;
    for (let s = 1; s < 400; s += 1.0) {
      const hh = a.islandAt(eye.x + d.x * s, eye.z + d.z * s);
      if (hh !== null && hh > eye.y + d.y * s) { ground = s; break; }
    }
    if (!h && ground === null) { out.push({ what: 'sky' }); continue; }
    if (ground !== null && (!h || ground < h.distance)) {
      out.push({ what: 'terrain', dist: +ground.toFixed(1) });
      continue;
    }
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null;
    out.push({
      what: h.object.name || h.object.type,
      mat: h.object.material?.type + (h.object.material?.name ? `:${h.object.material.name}` : ''),
      inst: !!h.object.isInstancedMesh,
      dist: +h.distance.toFixed(1),
      ny: n ? +n.y.toFixed(2) : null,
      parent: h.object.parent?.name || '',
    });
  }
  return out;
}, pts);

const STANDS = [];
for (let r = 12; r <= 78; r += 11) {
  for (let b = 0; b < 6; b++) {
    const th = (b / 6) * Math.PI * 2 + r * 0.11;
    STANDS.push([Math.cos(th) * r, Math.sin(th) * r, th]);
  }
}
const PITCHES = [0.90, 0.35, -0.14];

const rows = [];
let worst = null;
let i = 0;
for (const [x, z, th] of STANDS) {
  for (const pitch of PITCHES) {
    const yaw = th + Math.PI;                    // look back over the island
    if (!(await frame(x, z, yaw, pitch))) continue;
    await page.waitForTimeout(700);
    const file = path.join(OUT, `${TAG}-${String(i).padStart(3, '0')}.png`);
    await page.locator('canvas').first().screenshot({ path: file });
    const s = blackStats(file);
    rows.push({ i, x: +x.toFixed(1), z: +z.toFixed(1), yaw: +yaw.toFixed(2), pitch, file, ...s, hist: undefined });
    if (!worst || s.black > worst.black) worst = { ...rows[rows.length - 1], file };
    i++;
  }
}
rows.sort((a, b) => b.black - a.black);
console.log(`\n${TAG}: ${rows.length} frames`);
const mean = rows.reduce((m, r) => m + r.black, 0) / rows.length;
const meanC = rows.reduce((m, r) => m + r.crushed, 0) / rows.length;
console.log(`  worst black ${(rows[0].black * 100).toFixed(2)}%   `
  + `mean black ${(mean * 100).toFixed(2)}%   mean crushed ${(meanC * 100).toFixed(2)}%   `
  + `frames over 5% black: ${rows.filter((r) => r.black > 0.05).length}`);
for (const r of rows.slice(0, 6)) {
  console.log(`  #${r.i} (${r.x}, ${r.z}) pitch ${r.pitch}: black ${(r.black * 100).toFixed(2)}% `
    + `crushed ${(r.crushed * 100).toFixed(2)}%  ${path.basename(r.file)}`);
}

// ---- and what the worst frame's black pixels actually are -----------------
if (worst) {
  await frame(worst.x, worst.z, worst.yaw, worst.pitch);
  await page.waitForTimeout(900);
  const { w, h, ch, data } = decodePNG(readFileSync(worst.file));
  const pts = [];
  for (let y = 4; y < h; y += 24) {
    for (let x = 4; x < w; x += 24) {
      const p = (y * w + x) * ch;
      if (data[p] <= 2 && data[p + 1] <= 2 && data[p + 2] <= 2) {
        pts.push([(x / w) * 2 - 1, -((y / h) * 2 - 1)]);
      }
    }
  }
  const named = pts.length ? await whatAt(pts.slice(0, 220)) : [];
  const tally = {};
  for (const q of named) {
    const k = `${q.what} · ${q.mat || ''} · ny=${q.ny}`;
    tally[k] = (tally[k] || 0) + 1;
  }
  console.log(`\n  the black in ${path.basename(worst.file)} (${pts.length} sampled black pixels):`);
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${String(n).padStart(4)}  ${k}`);
  }
  await writeFile(path.join(OUT, `${TAG}-what.json`), JSON.stringify({ worst, tally, named: named.slice(0, 60) }, null, 1));
}

await writeFile(path.join(OUT, `${TAG}.json`), JSON.stringify({ tag: TAG, rows, errors }, null, 1));
console.log(`\n${errors.length} console error(s)`);
await browser.close();
