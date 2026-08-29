/**
 * WHAT IS IN THE FRAME THE COMPOSITION GATE REFUSED?
 *
 *   tools/critic/_laneFfrozen.sh tools/critic/_laneFwedge.mjs \
 *      --json shots/laneF-compose-before/compose.json --out shots/laneF-wedge
 *
 * `compose.mjs` reports a position and a clause. That is enough to know a frame
 * is bad and not enough to know what to change: "walled in: only 23% of the
 * directions around him are open" is true of a cadet in a wood, of a cadet in a
 * bowl, and of a cadet inside a landmark, and those three have three different
 * fixes in three different files.
 *
 * So this re-stands the cadet at every position that gate refused, lets the
 * real camera solve, and NAMES the occluder for every blocked probe: the
 * heightfield, an instanced scatter batch (and which one), a merged landmark
 * (and which), or the cadet's own lattice. It also reads what the camera rig
 * did — boom, lift, the elevation it is looking along, and how much climb it
 * asked for versus how much it was allowed.
 *
 * Nothing here is a verdict. It is the census that decides which of the two
 * halves — the camera, or the world — owns each finding.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ESCAPE_JS, notFree } from './_escape.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-wedge'));
const JSONF = arg('json', 'shots/compose/compose.json');
const SHOTS = process.argv.includes('--shots');
await mkdir(OUT, { recursive: true });

const src = JSON.parse(await readFile(path.resolve(JSONF), 'utf8'));
const bad = src.bad || [];
console.log(`${bad.length} refused frames from ${JSONF}`);

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
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);
const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
await clear();

/** Name every occluder around a standing place, and read the rig. */
const DIAG_JS = `(() => {
  const a = window.__ascent, T = a.THREE, cam = a.camera;
  const p = a.player.pos;
  const eye = new T.Vector3(); cam.getWorldPosition(eye);
  const mine = new Set(); a.player.root.traverse((o) => mine.add(o));
  const list = [];
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible || mine.has(o) || o.userData.noCamBlock) return;
    const m = o.material; if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    if (mats.some((q) => !q || q.transparent || q.depthWrite === false || q.wireframe)) return;
    const g = o.geometry; if (!g) return;
    const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
    if (!tris || tris > 30000) return;
    list.push(o);
  });
  const was = [];
  for (const o of list) {
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const q of ms) { was.push(q, q.side); q.side = T.DoubleSide; }
  }
  const ray = new T.Raycaster();
  const nameOf = (o) => (o.name || o.parent?.name || o.type) + (o.isInstancedMesh ? '[inst]' : '');
  const castName = (from, dir, far) => {
    ray.near = 0.02; ray.far = far; ray.set(from, dir);
    const h = ray.intersectObjects(list, false);
    return h.length ? { d: h[0].distance, what: nameOf(h[0].object) } : { d: far, what: null };
  };
  const terrHit = (ox, oy, oz, d, far) => {
    for (let s = 1.5; s <= far; s += 1.5) {
      const h = a.islandAt(ox + d.x * s, oz + d.z * s);
      if (h !== null && h > oy + d.y * s + 0.4) return s;
    }
    return null;
  };
  // ---- the 17 openness directions, named ----
  const DIRS = [];
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2;
    DIRS.push(new T.Vector3(Math.cos(t), 0, Math.sin(t))); }
  for (let i = 0; i < 4; i++) { const t = (i / 4) * Math.PI * 2 + 0.4, c = Math.cos(0.5);
    DIRS.push(new T.Vector3(Math.cos(t) * c, Math.sin(0.5), Math.sin(t) * c)); }
  DIRS.push(new T.Vector3(0, 1, 0));
  const ey = p.y + 1.46;
  const openWhy = [];
  let openN = 0;
  for (const d of DIRS) {
    const c = castName(new T.Vector3(p.x, ey, p.z), d, 22);
    const t = d.y > 0.35 ? null : terrHit(p.x, ey, p.z, d, 22);
    if (c.what === null && t === null) { openN++; openWhy.push('open'); }
    else if (t !== null && (c.what === null || t < c.d)) openWhy.push('terrain@' + t.toFixed(0));
    else openWhy.push(c.what + '@' + c.d.toFixed(0));
  }
  // ---- the 63 frame rays, named ----
  const v2 = new T.Vector2();
  const frameWhy = {};
  let short = 0, far = 0, n = 0;
  for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 9; ix++) {
    v2.set((ix / 8) * 1.9 - 0.95, (iy / 6) * 1.9 - 0.95);
    ray.near = 0.02; ray.far = 900; ray.setFromCamera(v2, cam);
    const h = ray.intersectObjects(list, false);
    let d = h.length ? h[0].distance : 900;
    let what = h.length ? nameOf(h[0].object) : 'sky';
    const dir = ray.ray.direction;
    for (let s = 1; s < Math.min(d, 220); s += 1.5) {
      const hh = a.islandAt(eye.x + dir.x * s, eye.z + dir.z * s);
      if (hh !== null && hh > eye.y + dir.y * s) { d = Math.min(d, s); what = 'terrain'; break; }
    }
    n++;
    if (d > 25) far++; else { const k = what + (iy === 6 ? ' (TOP ROW)' : ''); frameWhy[k] = (frameWhy[k] || 0) + 1; }
    if (d < 3 && eye.y + dir.y * d > eye.y - 1.3) short++;
  }
  for (let i = 0; i < was.length; i += 2) was[i].side = was[i + 1];
  const rig = a.player.cam || {};
  return {
    open: +(openN / DIRS.length).toFixed(3), openWhy,
    seeFar: +(far / n).toFixed(3), short: +(short / n).toFixed(3), frameWhy,
    boom: +(rig._hit ?? rig.boom ?? 0).toFixed(2), lift: +(rig.lift ?? 0).toFixed(2),
    axisEl: +(rig._axisEl ?? 0).toFixed(3), pitch: +(rig.pitch ?? 0).toFixed(3),
    fov: +(rig.fov ?? 0).toFixed(1),
    eye: [+eye.x.toFixed(1), +eye.y.toFixed(1), +eye.z.toFixed(1)],
    pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
  };
})()`;

const standAt = (x, z) => page.evaluate(([px, pz]) => {
  const a = window.__ascent;
  const h = a.islandAt(px, pz);
  if (h === null) return false;
  a.player.pos.set(px, h + 0.15, pz);
  a.player.vel.set(0, 0, 0);
  a.player.cam?.refound?.();
  return true;
}, [x, z]);

const rows = [];
const tally = { open: {}, frame: {} };
let i = 0;
for (const b of bad) {
  const [x, y, z] = b.at;
  if (!(await standAt(x, z))) continue;
  await page.waitForTimeout(700);
  await clear();
  const f = await page.evaluate(ESCAPE_JS);
  const why = notFree(f);
  const d = await page.evaluate(DIAG_JS);
  rows.push({ where: b.where, tag: b.tag, at: b.at, wasWhy: b.why, nowWhy: why, ...d });
  for (const w of d.openWhy) {
    const k = w === 'open' ? 'open' : w.split('@')[0];
    tally.open[k] = (tally.open[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(d.frameWhy)) tally.frame[k] = (tally.frame[k] || 0) + v;
  if (SHOTS && i < 14) await page.locator('canvas').first().screenshot({ path: path.join(OUT, `wedge-${String(i).padStart(2, '0')}.png`) });
  i++;
}

console.log(`\nre-stood at ${rows.length} of ${bad.length}; ${rows.filter((r) => r.nowWhy).length} still refused`);
console.log('\nWHAT BLOCKS THE 17 OPENNESS DIRECTIONS (all sites pooled):');
for (const [k, v] of Object.entries(tally.open).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
console.log('\nWHAT STOPS THE FRAME RAYS INSIDE 25 m:');
for (const [k, v] of Object.entries(tally.frame).sort((a, b) => b[1] - a[1]).slice(0, 16)) console.log(`  ${String(v).padStart(5)}  ${k}`);
console.log('\nTHE RIG, at the refused frames:');
const num = (k) => rows.map((r) => r[k]).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
for (const k of ['boom', 'lift', 'axisEl', 'open', 'seeFar', 'short']) {
  const s = num(k);
  if (s.length) console.log(`  ${k.padEnd(7)} min ${s[0]}  median ${s[s.length >> 1]}  max ${s[s.length - 1]}`);
}
console.log('\nSTILL REFUSED, by clause:');
const cl = {};
for (const r of rows) if (r.nowWhy) { const k = r.nowWhy.replace(/[0-9.]+/g, 'N'); cl[k] = (cl[k] || 0) + 1; }
for (const [k, v] of Object.entries(cl).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

await writeFile(path.join(OUT, 'wedge.json'), JSON.stringify({ src: JSONF, rows, tally, errors }, null, 1));
console.log(`\n${errors.length} console error(s)`);
await browser.close();
