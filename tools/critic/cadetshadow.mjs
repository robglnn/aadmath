/**
 * THE CADET'S SHADOW — a proof, in pixels, not in claims.
 *
 * Three rounds were lost to "I set castShadow and it still looks wrong", so
 * this asks the running game three questions that a screenshot alone cannot
 * answer, and answers them with numbers off the real graded frame:
 *
 *   1. Standing on the lit plaza, does the ground actually get darker where his
 *      shadow should fall, and by how much?
 *   2. If he moves three metres, does the shadow move with him?
 *   3. At jump apex, does the shadow *separate* from his feet — i.e. is there
 *      an altimeter?
 *
 * Every measurement is a difference between two otherwise identical frames:
 * one with the rig casting, one with `castShadow` off on the same 13 meshes.
 * Nothing else in the frame changes, so any luminance difference IS the shadow.
 *
 *   node tools/critic/cadetshadow.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:4711';
const OUT = path.resolve(process.argv[3] || 'shots/cadet-shadow');
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

// ---------------------------------------------------------------- harness
await page.evaluate(() => {
  const a = window.__ascent;
  document.getElementById('boot')?.classList.add('gone');
  const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none';
  a.engine.stop();                       // we drive the frame by hand

  const THREE = a.THREE;
  const R = a.engine.renderer, fx = a.fx;
  fx.passes.fxaa.enabled = true;         // grade lands in ldrRT, which we read

  window.__shadowProbe = {
    /** Put him somewhere, settle the rig, and aim the camera. */
    place({ x, z, air = 0, camY = 14, top = true, look = null }) {
      const gy = a.player.groundAt(x, z);
      a.player.pos.set(x, gy + 0.02 + air, z);
      a.player.vel.set(0, 0, 0);
      for (let i = 0; i < 4; i++) {
        a.player.pos.set(x, gy + 0.02 + air, z);
        a.player.vel.set(0, 0, 0);
        a.player.update(0.016, 3 + i * 0.016);
      }
      a.player.pos.set(x, gy + 0.02 + air, z);
      const cam = a.engine.camera;
      if (top) {
        cam.position.set(x, gy + camY, z);
        cam.up.set(0, 0, 1);
        cam.lookAt(x, gy, z);
      } else {
        // A shadow at height h lands h/tan(22.8°) down-sun, so at apex it is
        // eight metres from his boots. Frame the pair, not the cadet, or the
        // altimeter this is here to measure falls off the side of the picture.
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
      return { gy, feet: [x, gy + air, z], span: a.world.shadowSpan };
    },

    /**
     * Two frames, identical but for the rig's `castShadow`, differenced.
     * Returns the shadow's own footprint: its area, its mean and peak
     * darkening, and its centroid in world metres on the ground plane.
     */
    measure(groundY) {
      const R2 = a.engine.renderer;
      const rt = fx.composer.renderTarget1;
      const W = rt.width, H = rt.height;
      const grab = () => {
        fx.update(0.016, 3.1); fx.render(0.016);
        const b = new Uint8Array(W * H * 4);
        R2.readRenderTargetPixels(rt, 0, 0, W, H, b);
        R2.setRenderTarget(null);
        return b;
      };
      const casters = [];
      a.player.rig.root.traverse((o) => { if (o.isMesh && o.castShadow) casters.push(o); });
      const A = grab();
      for (const m of casters) m.castShadow = false;
      const B = grab();
      for (const m of casters) m.castShadow = true;

      // unproject each shadowed pixel onto the ground plane, so the answer is
      // in metres of world rather than in pixels of a particular framing
      const cam = a.engine.camera;
      const inv = new THREE.Matrix4().multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
      const eye = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
      const v = new THREE.Vector3();
      let sum = 0, n = 0, max = 0, wx = 0, wz = 0, wn = 0;
      const c = document.createElement('canvas');
      c.width = W; c.height = H * 2;
      const g = c.getContext('2d');
      const img = g.createImageData(W, H * 2);
      for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) {
        const s = ((H - 1 - y) * W + px) * 4, d = (y * W + px) * 4;
        img.data[d] = A[s]; img.data[d + 1] = A[s + 1]; img.data[d + 2] = A[s + 2]; img.data[d + 3] = 255;
        const la = 0.2126 * A[s] + 0.7152 * A[s + 1] + 0.0722 * A[s + 2];
        const lb = 0.2126 * B[s] + 0.7152 * B[s + 1] + 0.0722 * B[s + 2];
        const dd = lb - la;
        if (dd > 8) {
          sum += dd; n++;
          v.set((px / W) * 2 - 1, ((H - 1 - y) / H) * 2 - 1, 0.5).applyMatrix4(inv);
          v.sub(eye).normalize();
          if (Math.abs(v.y) > 1e-4) {
            const t = (groundY - eye.y) / v.y;
            if (t > 0 && t < 400) { wx += eye.x + v.x * t; wz += eye.z + v.z * t; wn++; }
          }
        }
        max = Math.max(max, dd);
        const q = Math.max(0, Math.min(255, dd * 3));
        const d2 = ((H + y) * W + px) * 4;
        img.data[d2] = q; img.data[d2 + 1] = q; img.data[d2 + 2] = q; img.data[d2 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return {
        png: c.toDataURL('image/png'),
        pixels: n,
        meanDrop: n ? +(sum / n).toFixed(1) : 0,
        peakDrop: +max.toFixed(1),
        centroid: wn ? [+(wx / wn).toFixed(2), +(wz / wn).toFixed(2)] : null,
      };
    },
  };
});

async function shot(name, opts) {
  const placed = await page.evaluate((o) => window.__shadowProbe.place(o), opts);
  const m = await page.evaluate((gy) => window.__shadowProbe.measure(gy), placed.gy);
  await writeFile(path.join(OUT, name + '.png'), Buffer.from(m.png.split(',')[1], 'base64'));
  delete m.png;
  return { ...m, ...placed };
}

const report = {};
// ---- 1 & 2: on the lit plaza, top-down, and again three metres along -----
report.plazaA = await shot('01-plaza-topdown-a', { x: 10, z: 10, camY: 14 });
report.plazaB = await shot('02-plaza-topdown-b', { x: 13, z: 12, camY: 14 });
// ---- 3: the same ground, at jump apex, from behind and low ---------------
const gyj = report.plazaA.gy;
report.grounded = await shot('03-grounded-behind', {
  x: 10, z: 10, air: 0, top: false, look: [10 - 6.0, gyj + 5.0, 10 + 10.0],
});
report.apex = await shot('04-apex-behind', {
  x: 10, z: 10, air: 3.6, top: false, look: [10 - 6.0, gyj + 5.0, 10 + 10.0],
});

if (process.env.SHADOW_DEBUG) console.log(JSON.stringify(report, null, 1));
const moved = Math.hypot(
  report.plazaB.centroid[0] - report.plazaA.centroid[0],
  report.plazaB.centroid[1] - report.plazaA.centroid[1],
);
// how far the shadow's centre of mass sits from the point under his feet
const gap = (r) => Math.hypot(r.centroid[0] - r.feet[0], r.centroid[1] - r.feet[2]);

const verdict = {
  shadowSpan_m: report.plazaA.span,
  plaza: { pixels: report.plazaA.pixels, meanDrop: report.plazaA.meanDrop, peakDrop: report.plazaA.peakDrop },
  movedWithHim_m: +moved.toFixed(2),
  groundedOffset_m: +gap(report.grounded).toFixed(2),
  apexOffset_m: +gap(report.apex).toFixed(2),
  separationAtApex_m: +(gap(report.apex) - gap(report.grounded)).toFixed(2),
  consoleErrors: errors.length,
};
const pass =
  report.plazaA.pixels > 1200 && report.plazaA.meanDrop > 18 && report.plazaA.peakDrop > 60
  && moved > 2.0 && moved < 6.0
  && verdict.separationAtApex_m > 1.5
  && errors.length === 0;
verdict.PASS = pass;
console.log(JSON.stringify(verdict, null, 2));
if (errors.length) console.log('errors:', errors.slice(0, 5));
await browser.close();
process.exit(pass ? 0 : 1);
