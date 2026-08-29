/**
 * LANE H — does the island you SEE stand where the island you WALK ON stands?
 *
 * The collision surface is `heightAt`, exact and analytic. The drawn island is a
 * 200-sector polar mesh sampled from it. Anywhere the two disagree by more than
 * a body, a cadet standing on the collision surface is drawn inside the visible
 * hillside — which is what "the camera went inside the terrain" looks like.
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h-mesh'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  let island = null;
  a.scene.traverse((o) => { if (o.name === 'island') island = o; });
  if (!island) return { error: 'no island mesh' };
  const ray = new T.Raycaster();
  ray.near = 0.01; ray.far = 900;
  const down = new T.Vector3(0, -1, 0);
  const from = new T.Vector3();
  const probe = (x, z) => {
    const h = a.islandAt(x, z);
    if (h === null) return null;
    from.set(x, 320, z);
    ray.set(from, down);
    const hits = ray.intersectObject(island, false);
    if (!hits.length) return null;
    return { x, z, h, mesh: hits[0].point.y, d: hits[0].point.y - h };
  };
  const rows = [];
  for (let i = 0; i < 9000; i++) {
    const t = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 155;
    const p = probe(Math.cos(t) * r, Math.sin(t) * r);
    if (p) rows.push(p);
  }
  const ds = rows.map((r) => r.d).sort((p, q) => p - q);
  const q = (f) => ds[Math.min(ds.length - 1, Math.max(0, Math.round(f * (ds.length - 1))))];
  const worst = rows.slice().sort((p, r) => Math.abs(r.d) - Math.abs(p.d)).slice(0, 12)
    .map((r) => ({ x: +r.x.toFixed(1), z: +r.z.toFixed(1), h: +r.h.toFixed(1), mesh: +r.mesh.toFixed(1), d: +r.d.toFixed(1) }));
  // the reported corridor and the point the walk wedged at
  const spots = [[36, -88.3], [35, -95], [0, 26], [0, 0], [-10.4, -52.5], [-0.9, -27.1], [-20, -98], [-26, -129]]
    .map(([x, z]) => { const p = probe(x, z); return p ? { x, z, h: +p.h.toFixed(1), mesh: +p.mesh.toFixed(1), d: +p.d.toFixed(2) } : { x, z, miss: true }; });
  const above = rows.filter((r) => r.d > 1.4).length;   // mesh a body ABOVE the walk surface
  return {
    n: rows.length,
    p01: +q(0.01).toFixed(2), p50: +q(0.5).toFixed(2), p99: +q(0.99).toFixed(2),
    min: +ds[0].toFixed(2), max: +ds[ds.length - 1].toFixed(2),
    meshAboveBody: above, meshAboveBodyShare: +(above / rows.length).toFixed(4),
    worst, spots,
  };
});
console.log(JSON.stringify(res, null, 1));
await writeFile(path.join(OUT, 'mesh.json'), JSON.stringify(res, null, 1));
await browser.close();
