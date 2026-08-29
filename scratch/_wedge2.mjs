/**
 * PROBE 2: where can a cadet stand with the frame full of geometry?
 *
 * Hypothesis: collision in this game is a heightfield plus the build lattice.
 * Every rock, hoodoo, crystal, arch, cathedral, wreck and watchtower is drawn
 * and has NO collider, so a cadet can walk straight into the middle of one.
 * The heightfield then says "you are on solid ground" and Recover, which asks
 * only the heightfield, moves him 3.5 m — still inside the same rock.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/_wedge2'));
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

// Every solid-looking mesh in the scene, with its world bounding sphere.
const meshes = await page.evaluate(() => {
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
    const bs = g.boundingSphere;
    if (!bs) return;
    o.updateWorldMatrix(true, false);
    s.setFromMatrixScale(o.matrixWorld);
    c.copy(bs.center).applyMatrix4(o.matrixWorld);
    const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
    out.push({
      name: o.name || o.type, inst: !!o.isInstancedMesh, n: o.count || 1,
      tris, r: +(bs.radius * Math.max(s.x, s.y, s.z)).toFixed(1),
      x: +c.x.toFixed(1), y: +c.y.toFixed(1), z: +c.z.toFixed(1),
    });
  });
  return out.sort((p, q) => q.r - p.r).slice(0, 30);
});
console.log('largest solid meshes:');
for (const m of meshes) console.log(' ', JSON.stringify(m));

await browser.close();
