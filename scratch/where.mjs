/** Project each far land into the arrival frame and report screen coverage. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const a = window.__ascent;
  const g = a.player.groundAt(0, 26);
  a.player.pos.set(0, g + 0.4, 26); a.player.vel.set(0, 0, 0);
  a.player.yaw = Math.PI; a.player.pitch = 0.02;
  return new Promise((res) => setTimeout(() => {
    const cam = a.camera; const T = a.THREE;
    const rows = [];
    a.scene.traverse((o) => {
      if (!o.isMesh || !/farland-|range-/.test(o.name)) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      let minx = 9, maxx = -9, miny = 9, maxy = -9, anyFront = false;
      for (let i = 0; i < 8; i++) {
        const p = new T.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
        o.localToWorld(p); p.project(cam);
        if (p.z < 1) anyFront = true;
        minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
        miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
      }
      rows.push({ name: o.name, front: anyFront, px: [((minx + 1) / 2 * 1280) | 0, ((maxx + 1) / 2 * 1280) | 0], py: [((1 - maxy) / 2 * 720) | 0, ((1 - miny) / 2 * 720) | 0] });
    });
    res({ camY: cam.position.y, fov: cam.fov, rows });
  }, 900));
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
