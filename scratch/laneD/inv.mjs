/** LANE D DIAGNOSTIC: scene inventory + which instance encloses a point. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const X = Number(arg('x', 0)), Z = Number(arg('z', 0));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(([px, pz]) => {
  const a = window.__ascent, T = a.THREE;
  const rows = [];
  const path = (o) => { const parts = []; let q = o; while (q) { parts.unshift(q.name || q.type); q = q.parent; } return parts.join('/'); };
  const m4 = new T.Matrix4(), v = new T.Vector3(), sc = new T.Vector3();
  a.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry; if (!g) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const row = { path: path(o), inst: o.isInstancedMesh ? o.count : 0, tris, r: +g.boundingSphere.radius.toFixed(1),
      vis: o.visible, transparent: !!mat?.transparent, dw: mat?.depthWrite !== false, noCam: !!o.userData.noCamBlock };
    if (o.isInstancedMesh) {
      let near = Infinity, ni = -1, ns = 1;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4); v.setFromMatrixPosition(m4); v.applyMatrix4(o.matrixWorld);
        const d = Math.hypot(v.x - px, v.z - pz);
        if (d < near) { near = d; ni = i; sc.setFromMatrixScale(m4); ns = Math.max(sc.x, sc.y, sc.z); v.clone(); }
      }
      row.nearest = +near.toFixed(2); row.ni = ni; row.nscale = +ns.toFixed(2);
    }
    rows.push(row);
  });
  return rows;
}, [X, Z]);
out.sort((p, q) => (p.nearest ?? 1e9) - (q.nearest ?? 1e9));
for (const r of out) {
  if (r.inst && r.nearest < 30) console.log(`INST ${r.nearest.toFixed(1)}m  x${r.inst} tri${r.tris} r${r.r} scale${r.nscale} noCam=${r.noCam} T=${r.transparent} ${r.path}`);
}
console.log('--- all instanced ---');
for (const r of out) if (r.inst) console.log(`  x${String(r.inst).padStart(5)} tri${String(r.tris).padStart(6)} r${String(r.r).padStart(6)} nearest ${r.nearest} noCam=${r.noCam} T=${r.transparent} ${r.path}`);
console.log('--- non-instanced meshes over 2m radius ---');
for (const r of out) if (!r.inst && r.r > 2) console.log(`  tri${String(r.tris).padStart(6)} r${String(r.r).padStart(7)} noCam=${r.noCam} T=${r.transparent} ${r.path}`);
await browser.close();
