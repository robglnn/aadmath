/**
 * PROBE 3: stand a cadet at the middle of each big landmark mesh and measure
 * the REAL FRAME, then press R and measure it again.
 *
 * Two independent instruments, neither of which asks the player module anything:
 *   pixels()  — the shipped frame, decoded by the browser, so "black mush" is
 *               measured as black mush and not inferred.
 *   rays()    — 5x5 raycasts from the real camera through the real scene: how
 *               far the eye can see before geometry stops it.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/_wedge3'));
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

/** Decode the shipped frame in the browser and report what it actually shows. */
async function pixels(name) {
  const buf = await page.screenshot({ path: name ? path.join(OUT, name + '.png') : undefined });
  const b64 = buf.toString('base64');
  return page.evaluate(async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await img.decode();
    const W = 160, H = 90;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    let sum = 0, n = W * H, dark = 0;
    const lum = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const L = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
      lum[i] = L; sum += L;
      if (L < 42) dark++;
    }
    const mean = sum / n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (lum[i] - mean) ** 2;
    return { mean: +mean.toFixed(1), sd: +Math.sqrt(v / n).toFixed(1), dark: +(dark / n).toFixed(3) };
  }, b64);
}

/** How far the eye actually sees, sampled across the frame. */
const rays = () => page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const cam = a.camera;
  const ray = new T.Raycaster();
  ray.near = 0.01; ray.far = 400;
  const list = [];
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const m = o.material;
    if (!m || m.transparent || m.depthWrite === false) return;
    if (o.userData.noCamBlock) return;
    if (o.userData.isPlayer || o.userData.avatar) return;
    list.push(o);
  });
  const d = [];
  for (let iy = 0; iy < 5; iy++) {
    for (let ix = 0; ix < 5; ix++) {
      const v = new T.Vector2((ix / 4) * 1.6 - 0.8, (iy / 4) * 1.6 - 0.8);
      ray.setFromCamera(v, cam);
      const h = ray.intersectObjects(list, false);
      d.push(h.length ? h[0].distance : 400);
    }
  }
  d.sort((p, q) => p - q);
  return { min: +d[0].toFixed(2), med: +d[12].toFixed(2), near: d.filter((x) => x < 3).length };
});

const facts = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos, T = a.THREE;
  const cp = new T.Vector3(); a.camera.getWorldPosition(cp);
  return {
    x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
    ground: a.islandAt(p.x, p.z),
    boom: +Math.hypot(cp.x - p.x, cp.y - (p.y + 1.46), cp.z - p.z).toFixed(2),
    rec: a.player.recoveries | 0,
  };
});

const sites = await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const out = [];
  const c = new T.Vector3(), s = new T.Vector3();
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const m = o.material;
    if (!m || m.transparent || m.depthWrite === false) return;
    const g = o.geometry;
    if (!g) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere; if (!bs) return;
    o.updateWorldMatrix(true, false);
    s.setFromMatrixScale(o.matrixWorld);
    const r = bs.radius * Math.max(s.x, s.y, s.z);
    if (r < 8 || r > 120) return;
    c.copy(bs.center).applyMatrix4(o.matrixWorld);
    if (Math.hypot(c.x, c.z) > 200) return;
    const h = a.islandAt(c.x, c.z);
    if (h === null) return;
    out.push({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: +r.toFixed(1), h: +h.toFixed(1) });
  });
  return out.slice(0, 10);
});
console.log('candidate landmark sites:', JSON.stringify(sites));

for (const s of sites) {
  await page.evaluate((t) => {
    const a = window.__ascent;
    a.player.pos.set(t.x, a.islandAt(t.x, t.z) + 0.55, t.z);
    a.player.vel.set(0, 0, 0);
  }, s);
  await page.waitForTimeout(900);
  const b = await facts();
  const bp = await pixels(`site-${s.x}_${s.z}-before`);
  const br = await rays();
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(1000);
  const af = await facts();
  const ap = await pixels(`site-${s.x}_${s.z}-after`);
  const ar = await rays();
  console.log(`\nsite r=${s.r} at ${s.x},${s.z}`);
  console.log('  before', JSON.stringify(b), JSON.stringify(bp), JSON.stringify(br));
  console.log('  after ', JSON.stringify(af), JSON.stringify(ap), JSON.stringify(ar));
}

await browser.close();
