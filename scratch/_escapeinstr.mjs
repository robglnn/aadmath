/**
 * Validate the ESCAPE INSTRUMENT before any gate is allowed to use it.
 *
 * A gate that measures escape is only worth having if the instrument can tell
 * the two states apart. So it is calibrated here against sites that were
 * photographed and looked at by eye:
 *   BURIED  (14.2,140.1) (30.4,87.5)  — frame is backfaces
 *   CLEAR   (0,-17.2) plaza, (-78.8,-55) under canopy (dark but legible)
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/_escapeinstr'));
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

const VIEW = `
(() => {
  const a = window.__ascent, T = a.THREE, cam = a.camera;
  const list = [];
  const mine = new Set();
  a.player.root.traverse((o) => mine.add(o));
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (mine.has(o) || o.userData.noCamBlock) return;
    const m = o.material;
    if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    if (mats.some((q) => q.transparent || q.depthWrite === false || q.wireframe)) return;
    list.push(o);
  });
  // A ray leaving the inside of a closed shape hits only BACK faces, which a
  // front-side raycast is blind to — the precise reason a "how far can I see"
  // test can stand inside an arch and report open country. Flip every material
  // to double-sided for the measurement and put it back.
  const was = [];
  for (const o of list) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const q of mats) { was.push([q, q.side]); q.side = T.DoubleSide; }
  }
  const ray = new T.Raycaster();
  ray.near = 0.02; ray.far = 900;
  const v = new T.Vector2();
  let near = 0, n = 0, minD = Infinity, far30 = 0, far15 = 0;
  const NX = 9, NY = 7;
  for (let iy = 0; iy < NY; iy++) {
    for (let ix = 0; ix < NX; ix++) {
      v.set((ix / (NX - 1)) * 1.9 - 0.95, (iy / (NY - 1)) * 1.9 - 0.95);
      ray.setFromCamera(v, cam);
      const h = ray.intersectObjects(list, false);
      const d = h.length ? h[0].distance : 900;
      n++;
      if (d < 2.5) near++;
      if (d > 30) far30++;
      if (d > 15) far15++;
      if (d < minD) minD = d;
    }
  }
  // ENCLOSURE. You are inside something when there is no direction at all in
  // which you can see out of it. Cast a star of rays over the whole sphere and
  // keep the FURTHEST one: that is how far this point can see, at best.
  const eye = new T.Vector3();
  cam.getWorldPosition(eye);
  ray.far = 900;
  let openest = 0;
  const dirs = [];
  for (let a2 = 0; a2 < 12; a2++) {
    for (const el of [-0.5, 0, 0.5, 1.1]) {
      const th = (a2 / 12) * Math.PI * 2;
      dirs.push(new T.Vector3(Math.cos(th) * Math.cos(el), Math.sin(el), Math.sin(th) * Math.cos(el)));
    }
  }
  dirs.push(new T.Vector3(0, 1, 0));
  for (const d of dirs) {
    ray.set(eye, d);
    const h = ray.intersectObjects(list, false);
    const q = h.length ? h[0].distance : 900;
    if (q > openest) openest = q;
  }
  for (const [q, s] of was) q.side = s;
  return {
    meshes: list.length,
    blocked: +(near / n).toFixed(3), minD: +minD.toFixed(2),
    far30: +(far30 / n).toFixed(3), far15: +(far15 / n).toFixed(3),
    open: +openest.toFixed(1),
  };
})()
`;

async function mush(name) {
  const buf = await page.screenshot({ path: name ? path.join(OUT, name + '.png') : undefined });
  return page.evaluate(async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await img.decode();
    const W = 192, H = 108;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const L = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) {
      L[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    }
    // 16x9 tiles: a tile is MUSH if it is dark AND has no detail in it at all.
    // Shade under a tree is dark and full of detail; the inside of an arch is
    // dark and perfectly flat, and that difference is the whole measurement.
    const TX = 16, TY = 9, tw = W / TX, th = H / TY;
    let mushy = 0;
    for (let ty = 0; ty < TY; ty++) {
      for (let tx = 0; tx < TX; tx++) {
        let s = 0, ss = 0, k = 0;
        for (let y = ty * th; y < (ty + 1) * th; y++) {
          for (let x = tx * tw; x < (tx + 1) * tw; x++) {
            const q = L[y * W + x]; s += q; ss += q * q; k++;
          }
        }
        const m = s / k, sd = Math.sqrt(Math.max(0, ss / k - m * m));
        if (m < 34 && sd < 7) mushy++;
      }
    }
    return { mush: +(mushy / (TX * TY)).toFixed(3) };
  }, buf.toString('base64'));
}

const sites = [
  { n: 'BURIED-arch', x: 14.2, z: 140.1 },
  { n: 'BURIED-big', x: 30.4, z: 87.5 },
  { n: 'CLEAR-plaza', x: 0, z: -17.2 },
  { n: 'CLEAR-canopy', x: -78.8, z: -55 },
  { n: 'CLEAR-spawn', x: 0, z: 0 },
];

for (const s of sites) {
  await page.evaluate((t) => {
    const a = window.__ascent;
    const h = a.islandAt(t.x, t.z);
    a.player.pos.set(t.x, h + 0.55, t.z);
    a.player.vel.set(0, 0, 0);
  }, s);
  await page.waitForTimeout(1000);
  // hand the frame back if anything took it
  for (let i = 0; i < 4; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  const v = await page.evaluate(VIEW);
  const m = await mush(s.n);
  console.log(`${s.n.padEnd(14)} ${JSON.stringify(v)} mush=${m.mush}`);
}

await browser.close();
