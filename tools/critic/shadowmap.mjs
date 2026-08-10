import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const URL = process.argv[2] || 'http://127.0.0.1:4711';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const a = window.__ascent;
  const scene = a.engine.scene;
  let sun = null;
  scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
  const V3 = a.player.pos.constructor;
  const shadowMat = sun.shadow.matrix;
  const feet = new V3(a.player.pos.x, a.player.pos.y, a.player.pos.z).applyMatrix4(shadowMat);
  const head = new V3(a.player.pos.x, a.player.pos.y + 1.7, a.player.pos.z).applyMatrix4(shadowMat);
  const size = sun.shadow.mapSize.x;
  const rt = sun.shadow.map;
  const R = 40;
  const cx = Math.round(head.x * size), cy = Math.round(head.y * size);
  const w = R * 2;
  const buf = new Uint8Array(w * w * 4);
  a.engine.renderer.readRenderTargetPixels(rt, cx - R, cy - R, w, w, buf);
  const grid = [];
  for (let y = w - 1; y >= 0; y--) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = buf[i] / 255 * 0.99609375 + buf[i + 1] / 255 * 0.0038909912;
      if (d > 0.999) row += '.';
      else {
        // metres above the feet plane, in shadow-depth units
        const rel = (feet.z - d) / (feet.z - head.z) * 1.7;
        row += rel < -0.2 ? '_' : rel < 0.15 ? '0' : rel < 0.6 ? '1' : rel < 1.2 ? '2' : rel < 2.0 ? '3' : '#';
      }
    }
    grid.push(row);
  }
  return {
    feet: feet.toArray().map((v) => +v.toFixed(4)),
    head: head.toArray().map((v) => +v.toFixed(4)),
    centre: cx + ',' + cy, size,
    grid,
  };
});
console.log(out.feet, out.head, out.centre);
console.log(out.grid.join('\n'));
await browser.close();
