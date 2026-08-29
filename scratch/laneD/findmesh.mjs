import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await page.goto('http://127.0.0.1:4390', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.waitForTimeout(2600);
const out = await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE; const rows = [];
  const v = new T.Vector3();
  a.scene.traverse((o) => {
    if (!o.isMesh) return; const g = o.geometry; if (!g) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (Math.abs(g.boundingSphere.radius - 9.15) > 0.3) return;
    let nm = o.name, q = o.parent; while (!nm && q) { nm = q.name; q = q.parent; }
    v.setFromMatrixPosition(o.matrixWorld);
    const anc = []; let p = o; while (p) { anc.push(p.name || p.type); p = p.parent; }
    rows.push({ tris, r: +g.boundingSphere.radius.toFixed(2), name: nm || '(none)', at: [v.x | 0, v.y | 0, v.z | 0], anc: anc.join('<'), uuidChildren: o.parent ? o.parent.children.length : 0 });
  });
  return rows;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
