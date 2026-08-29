import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await page.goto('http://127.0.0.1:4390', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const sites = [];
  a.rifts.list.forEach((r) => sites.push({ k: 'rift ' + r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z }));
  const gates = a.waygates?.list || [];
  gates.forEach((g, i) => sites.push({ k: 'waygate' + i, x: g.x, z: g.z }));
  const batches = [];
  a.scene.traverse((o) => { if (o.isInstancedMesh && o.userData.carveable) batches.push(o); });
  const m4 = new T.Matrix4(), v = new T.Vector3();
  const rows = sites.map((s) => {
    let near = Infinity, who = '';
    for (const b of batches) for (let i = 0; i < b.count; i++) {
      b.getMatrixAt(i, m4); v.setFromMatrixPosition(m4);
      const d = Math.hypot(v.x - s.x, v.z - s.z);
      if (d < near) { near = d; who = b.name; }
    }
    return { ...s, near: +near.toFixed(1), who };
  });
  return { rows, batches: batches.map((b) => b.name + ':' + b.count), gateKeys: gates.length ? Object.keys(gates[0]).slice(0, 12) : [] };
});
console.log('carveable batches:', out.batches.join(', '));
console.log('waygate object keys:', out.gateKeys.join(','));
for (const r of out.rows) console.log(`  ${r.k.padEnd(22)} at ${r.x.toFixed(0)},${r.z.toFixed(0)}  nearest scatter ${r.near} m (${r.who})`);
await browser.close();
