/**
 * THE CADET'S SHADOW — real page pixels, no render-target arithmetic.
 *
 * `cadetshadow.mjs` proves the shadow exists by differencing two frames. That
 * answers "is it in the buffer" but not "would a human see it", which is the
 * only question a critic asks. This one takes ordinary `page.screenshot()`
 * captures of the running game — the same bytes a player's monitor gets — at:
 *
 *   01  top-down on the lit plaza, standing
 *   02  top-down, three metres along  (does it track him?)
 *   03  behind-and-low, standing      (contact shadow at the boots)
 *   04  behind-and-low, at jump apex  (does it separate → altimeter?)
 *
 * plus, for each, a same-framing capture with the rig's `castShadow` off, so a
 * human reading the pair can see the shadow appear and disappear.
 *
 *   tools/critic/frozen.sh tools/critic/shadowpixels.mjs --out shots/shadow-pixels
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4711');
const OUT = path.resolve(arg('out', 'shots/shadow-pixels'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'],
});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

await page.evaluate(() => {
  const a = window.__ascent;
  document.getElementById('boot')?.classList.add('gone');
  const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none';
  a.engine.stop();
  window.__sp = {
    place({ x, z, air = 0, camY = 14, top = true, look = null }) {
      const gy = a.player.groundAt(x, z);
      for (let i = 0; i < 5; i++) {
        a.player.pos.set(x, gy + 0.02 + air, z);
        a.player.vel.set(0, 0, 0);
        a.player.update(0.016, 3 + i * 0.016);
      }
      a.player.pos.set(x, gy + 0.02 + air, z);
      const cam = a.engine.camera;
      if (top) { cam.position.set(x, gy + camY, z); cam.up.set(0, 0, 1); cam.lookAt(x, gy, z); }
      else {
        const sd = a.world.sunDir;
        const L = Math.hypot(sd.x, sd.z);
        const run = (air + 0.9) / Math.tan(Math.asin(sd.y));
        const mx = x - sd.x / L * run * 0.5, mz = z - sd.z / L * run * 0.5;
        cam.position.set(look[0], look[1], look[2]);
        cam.up.set(0, 1, 0);
        cam.lookAt(mx, gy + 0.5, mz);
      }
      cam.fov = 50; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      a.world.update(0.016, 3.1);
      return { gy, span: a.world.shadowSpan };
    },
    draw() { a.fx.update(0.016, 3.1); a.fx.render(0.016); },
    setCast(on) {
      if (on) { for (const m of window.__spOff || []) m.castShadow = true; window.__spOff = []; return; }
      const list = [];
      a.player.rig.root.traverse((o) => { if (o.isMesh && o.castShadow) { list.push(o); o.castShadow = false; } });
      window.__spOff = list;
      return list.length;
    },
  };
});

async function frame(name, opts) {
  const placed = await page.evaluate((o) => window.__sp.place(o), opts);
  await page.evaluate(() => { window.__sp.draw(); window.__sp.draw(); });
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  const n = await page.evaluate(() => window.__sp.setCast(false));
  await page.evaluate(() => { window.__sp.draw(); window.__sp.draw(); });
  await page.screenshot({ path: path.join(OUT, name + '-NOCAST.png') });
  await page.evaluate(() => window.__sp.setCast(true));
  return { ...placed, casters: n };
}

const out = {};
out.a = await frame('01-plaza-topdown-a', { x: 10, z: 10, camY: 14 });
out.b = await frame('02-plaza-topdown-b', { x: 13, z: 12, camY: 14 });
const gy = out.a.gy;
out.g = await frame('03-grounded-behind', { x: 10, z: 10, air: 0, top: false, look: [10 - 6, gy + 5, 10 + 10] });
out.j = await frame('04-apex-behind', { x: 10, z: 10, air: 3.6, top: false, look: [10 - 6, gy + 5, 10 + 10] });
// The altimeter, framed so it cannot be argued with: identical top-down camera
// to 01, cadet at the same x/z, four metres up. He stays under the crosshair;
// the shadow has to walk out from under him.
out.jt = await frame('05-apex-topdown', { x: 10, z: 10, air: 4.0, camY: 18 });
out.gt = await frame('06-grounded-topdown', { x: 10, z: 10, air: 0, camY: 18 });
// And the frame a person would actually take: eye height, down-sun, so the
// shadow lies between the lens and his boots the way it does when you are
// playing rather than when you are proving something.
out.ds = await page.evaluate(() => {
  const a = window.__ascent, sd = a.world.sunDir;
  const L = Math.hypot(sd.x, sd.z);
  const gy = a.player.groundAt(10, 10);
  const cam = a.engine.camera;
  cam.position.set(10 - sd.x / L * 11, gy + 3.4, 10 - sd.z / L * 11);
  cam.up.set(0, 1, 0);
  cam.lookAt(10, gy + 0.9, 10);
  cam.fov = 50; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  a.world.update(0.016, 3.1);
  return { gy };
});
await page.evaluate(() => { window.__sp.draw(); window.__sp.draw(); });
await page.screenshot({ path: path.join(OUT, '07-plaza-downsun.png') });
await page.evaluate(() => window.__sp.setCast(false));
await page.evaluate(() => { window.__sp.draw(); window.__sp.draw(); });
await page.screenshot({ path: path.join(OUT, '07-plaza-downsun-NOCAST.png') });
await page.evaluate(() => window.__sp.setCast(true));
out.consoleErrors = errors.slice(0, 6);
console.log(JSON.stringify(out, null, 2));
await browser.close();
