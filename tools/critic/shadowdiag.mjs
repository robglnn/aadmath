import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const URL = process.argv[2] || 'http://127.0.0.1:4711';
const OUT = path.resolve(process.argv[3] || 'scratch/diag');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
await page.evaluate(() => { document.getElementById('boot')?.classList.add('gone'); document.getElementById('ui').style.display = 'none'; window.__ascent.engine.quality.enabled = false; });

async function diag(name, pitch) {
  await page.evaluate((p) => {
    const a = window.__ascent;
    a.player.pos.set(2, 60, 8); a.player.vel.set(0, 0, 0);
    a.player.yaw = 2.3; a.player.pitch = p;
  }, pitch);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  const info = await page.evaluate(() => {
    const a = window.__ascent;
    let sun = null; a.engine.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
    const V3 = a.player.pos.constructor;
    const feet = new V3(a.player.pos.x, a.player.pos.y, a.player.pos.z).applyMatrix4(sun.shadow.matrix);
    const head = new V3(a.player.pos.x, a.player.pos.y + 1.7, a.player.pos.z).applyMatrix4(sun.shadow.matrix);
    const size = sun.shadow.mapSize.x;
    const R = 30, w = R * 2;
    const cx = Math.round(head.x * size), cy = Math.round(head.y * size);
    const buf = new Uint8Array(w * w * 4);
    a.engine.renderer.readRenderTargetPixels(sun.shadow.map, cx - R, cy - R, w, w, buf);
    let hits = 0;
    for (let i = 0; i < w * w; i++) { const d = buf[i * 4] / 255 * 0.99609375 + buf[i * 4 + 1] / 255 * 0.0039; if (d < 0.999) hits++; }
    return {
      camPos: a.engine.camera.position.toArray().map((v) => +v.toFixed(2)),
      lightPos: sun.position.toArray().map((v) => +v.toFixed(2)),
      target: sun.target.position.toArray().map((v) => +v.toFixed(2)),
      headUV: head.toArray().map((v) => +v.toFixed(4)),
      feetUV: feet.toArray().map((v) => +v.toFixed(4)),
      casterTexels: hits, of: w * w,
      distLightToPlayer: +sun.position.distanceTo(a.player.pos).toFixed(1),
    };
  });
  console.log(name, JSON.stringify(info));
}
await diag('pitch-085', -0.85);
await diag('pitch-035', -0.35);
await diag('pitch-014', -0.14);
await browser.close();
