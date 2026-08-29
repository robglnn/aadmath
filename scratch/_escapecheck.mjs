/**
 * Does Recover ESCAPE, from the places that were photographed failing?
 *
 * Measures with instruments the player module does not own:
 *   - the world heightfield (__ascent.islandAt / surfaceAt)
 *   - the real three.js camera's world position
 *   - raycasts through the real scene graph, double-sided
 *   - the real shipped frame
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', 'shots/_escapecheck'));
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

const FREE = `
(() => {
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
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const q of mats) { was.push(q, q.side); q.side = T.DoubleSide; }
  }
  const ray = new T.Raycaster();
  const cast = (o2, d, far) => { ray.near = 0.02; ray.far = far; ray.set(o2, d);
    const h = ray.intersectObjects(list, false); return h.length ? h[0].distance : far; };
  const dirs = [];
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2;
    dirs.push(new T.Vector3(Math.cos(t), 0, Math.sin(t))); }
  for (let i = 0; i < 4; i++) { const t = (i / 4) * Math.PI * 2 + 0.4, c = Math.cos(0.5);
    dirs.push(new T.Vector3(Math.cos(t) * c, Math.sin(0.5), Math.sin(t) * c)); }
  dirs.push(new T.Vector3(0, 1, 0));
  const terrainBlocks = (x, y, z, d, far) => {
    if (d.y > 0.35) return false;
    for (let s = 2; s <= far; s += 2.5) {
      const h = a.islandAt(x + d.x * s, z + d.z * s);
      if (h === null) continue;
      if (h > y + d.y * s + 0.5) return true;
    }
    return false;
  };
  const openness = (x, y, z) => {
    let open = 0;
    const o2 = new T.Vector3(x, y, z);
    for (const d of dirs) {
      if (cast(o2, d, 22) < 22) continue;
      if (terrainBlocks(x, y, z, d, 22)) continue;
      open++;
    }
    return open / dirs.length;
  };
  const insideSolid = (x, y, z, r) => {
    const o2 = new T.Vector3(x, y, z);
    const ax = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of ax) {
      if (cast(o2, new T.Vector3(dx, dy, dz), r) >= r) return false;
    }
    return true;
  };
  // frustum: how much of the frame is stopped short, and how much reaches out
  const v2 = new T.Vector2();
  let short = 0, far = 0, n = 0, minD = Infinity;
  for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 9; ix++) {
    v2.set((ix / 8) * 1.9 - 0.95, (iy / 6) * 1.9 - 0.95);
    ray.near = 0.02; ray.far = 900; ray.setFromCamera(v2, cam);
    const h = ray.intersectObjects(list, false);
    let d = h.length ? h[0].distance : 900;
    // the island shell is not on the list; march it
    const dir = ray.ray.direction;
    for (let s = 1; s < Math.min(d, 200); s += 1.5) {
      const hh = a.islandAt(eye.x + dir.x * s, eye.z + dir.z * s);
      if (hh !== null && hh > eye.y + dir.y * s) { d = Math.min(d, s); break; }
    }
    n++; if (d < 3) short++; if (d > 25) far++; if (d < minD) minD = d;
  }
  for (let i = 0; i < was.length; i += 2) was[i].side = was[i + 1];

  const gh = a.islandAt(p.x, p.z), sh = a.surfaceAt(p.x, p.z);
  const surf = sh !== null && (gh === null || sh > gh) ? sh : gh;
  const camG = a.islandAt(eye.x, eye.z);
  return {
    pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
    onGround: surf !== null && Math.abs(p.y - surf) < 0.6 && !!a.player.grounded,
    inTerrain: surf !== null && p.y < surf - 0.15,
    inSolid: insideSolid(p.x, p.y + 0.9, p.z, 1.1),
    camInTerrain: camG !== null && eye.y < camG + 0.05,
    camInSolid: insideSolid(eye.x, eye.y, eye.z, 0.8),
    open: +openness(p.x, p.y + 1.46, p.z).toFixed(3),
    short: +(short / n).toFixed(3),
    seeFar: +(far / n).toFixed(3),
    minD: +minD.toFixed(2),
    boom: +eye.distanceTo(new T.Vector3(p.x, p.y + 1.46, p.z)).toFixed(2),
    rec: a.player.recoveries | 0,
    stuck: !!a.player.stuck,
  };
})()
`;

async function mush(name) {
  const buf = await page.screenshot({ path: name ? path.join(OUT, name + '.png') : undefined });
  return page.evaluate(async (d) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode();
    const W = 192, H = 108;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const L = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    const TX = 16, TY = 9, tw = W / TX, th = H / TY;
    let mushy = 0;
    for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) {
      let s = 0, ss = 0, k = 0;
      for (let y = ty * th; y < (ty + 1) * th; y++) for (let x = tx * tw; x < (tx + 1) * tw; x++) {
        const q = L[y * W + x]; s += q; ss += q * q; k++;
      }
      const m = s / k, sd = Math.sqrt(Math.max(0, ss / k - m * m));
      if (m < 34 && sd < 7) mushy++;
    }
    return +(mushy / (TX * TY)).toFixed(3);
  }, buf.toString('base64'));
}

const handBack = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
};

const sites = [
  { n: 'arch', x: 14.2, z: 140.1 },
  { n: 'big', x: 30.4, z: 87.5 },
  { n: 'wreck', x: 60.6, z: 81.4 },
  { n: 'hood', x: -78.8, z: -55 },
  { n: 'plaza', x: 0, z: -17.2 },
  { n: 'small', x: -0.9, z: -26.8 },
];

for (const s of sites) {
  await handBack();
  await page.evaluate((t) => {
    const a = window.__ascent;
    a.player.pos.set(t.x, a.islandAt(t.x, t.z) + 0.55, t.z);
    a.player.vel.set(0, 0, 0);
  }, s);
  await page.waitForTimeout(900);
  await handBack();
  const b = await page.evaluate(FREE);
  const bm = await mush(`${s.n}-before`);
  const t0 = Date.now();
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(1100);
  await handBack();
  const a2 = await page.evaluate(FREE);
  const am = await mush(`${s.n}-after`);
  console.log(`\n== ${s.n} ==`);
  console.log('  before', JSON.stringify(b), 'mush=' + bm);
  console.log('  after ', JSON.stringify(a2), 'mush=' + am, `(${Date.now() - t0}ms)`);
}

await browser.close();
