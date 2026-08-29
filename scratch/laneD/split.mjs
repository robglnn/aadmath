/** LANE D DIAGNOSTIC: is a wedge made of terrain or of scatter? */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);
const res = await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const mine = new Set(); a.player.root.traverse((o) => mine.add(o));
  const list = [];
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible || mine.has(o) || o.userData.noCamBlock) return;
    const m = o.material; if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    if (mats.some((q) => !q || q.transparent || q.depthWrite === false || q.wireframe)) return;
    const g = o.geometry; if (!g) return;
    const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
    if (!tris || tris > 30000) return;
    list.push(o);
  });
  const was = [];
  for (const o of list) { const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const q of ms) { was.push(q, q.side); q.side = T.DoubleSide; } }
  const ray = new T.Raycaster();
  const DIRS = [];
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; DIRS.push(new T.Vector3(Math.cos(t), 0, Math.sin(t))); }
  for (let i = 0; i < 4; i++) { const t = (i / 4) * Math.PI * 2 + 0.4, c = Math.cos(0.5);
    DIRS.push(new T.Vector3(Math.cos(t) * c, Math.sin(0.5), Math.sin(t) * c)); }
  DIRS.push(new T.Vector3(0, 1, 0));
  const wall = (x, y, z, d, far) => {
    if (d.y > 0.35) return false;
    for (let s = 2; s <= far; s += 2.5) { const h = a.islandAt(x + d.x * s, z + d.z * s);
      if (h !== null && h > y + d.y * s + 0.5) return true; } return false;
  };
  const sig = (o) => { const g = o.geometry; const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (!g.boundingSphere) g.computeBoundingSphere();
    let nm = o.name; let q = o.parent; while (!nm && q) { nm = q.name; q = q.parent; }
    return (nm || '?') + ' ' + (o.isInstancedMesh ? 'inst' + o.count : 'mesh') + ' tri' + t.toFixed(0) + ' r' + g.boundingSphere.radius.toFixed(1); };
  const blame = {};
  const at = (x, z) => {
    const h = a.islandAt(x, z); if (h === null) return null;
    const y = h + 1.46 + 0.15;
    const from = new T.Vector3(x, y, z);
    let all = 0, terr = 0, meshBlock = 0;
    for (const d of DIRS) {
      ray.near = 0.02; ray.far = 22; ray.set(from, d);
      const hit = ray.intersectObjects(list, false);
      const m = hit.length > 0;
      const w = wall(x, y, z, d, 22);
      if (!m && !w) all++;
      if (!w) terr++;
      if (m && !w) { meshBlock++; const k = sig(hit[0].object); blame[k] = (blame[k] || 0) + 1; }
    }
    return { open: +(all / DIRS.length).toFixed(3), openTerr: +(terr / DIRS.length).toFixed(3), meshOnly: meshBlock };
  };
  // sites
  const sites = [];
  const push = (kind, id, x, z) => sites.push({ kind, id, x, z });
  push('plaza', 'landing', 0, 0);
  a.rifts.list.forEach((r) => push('rift', r.id, r.foot ? r.foot.x : r.pos.x, r.foot ? r.foot.z : r.pos.z));
  const gates = a.waygates?.list || a.waygates?.gates || [];
  gates.forEach((g, i) => { if (g && g.x !== undefined) push('waygate', 'gate' + i, g.x, g.z); });
  const sp = a.spans?.state?.() || null;
  if (sp && Array.isArray(sp.sites)) sp.sites.forEach((s, i) => push('span', 'span' + i, s.x, s.z));
  const er = a.errand?.state?.() || a.errand?.mark || null;
  if (er && Number.isFinite(er.x)) push('errand', 'mark', er.x, er.z);
  const rows = [];
  for (const s of sites) for (const R of [0, 8, 17, 26]) {
    const n = R === 0 ? 1 : 8;
    for (let b = 0; b < n; b++) {
      const th = (b / n) * Math.PI * 2;
      const x = s.x + Math.cos(th) * R, z = s.z + Math.sin(th) * R;
      const q = at(x, z);
      rows.push({ site: `${s.kind} ${s.id}`, R, b, x: +x.toFixed(1), z: +z.toFixed(1), ...(q || { off: true }) });
    }
  }
  // island-wide sample
  const grid = [];
  for (let i = 0; i < 900; i++) {
    const t = i * 2.399963, rr = Math.sqrt(i / 900) * 190;
    const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
    const q = at(x, z); if (q) grid.push(q);
  }
  for (let i = 0; i < was.length; i += 2) was[i].side = was[i + 1];
  return { rows, grid, sites, blame };
});
await writeFile('scratch/laneD/split.json', JSON.stringify(res, null, 1));
const R = res.rows.filter((r) => !r.off);
const bad = R.filter((r) => r.open < 0.30);
const badTerr = bad.filter((r) => r.openTerr < 0.30);
console.log(`sites ${res.sites.length}  samples ${R.length}`);
console.log(`open<0.30: ${bad.length}  of which terrain alone would also fail: ${badTerr.length}  (so scatter-caused: ${bad.length - badTerr.length})`);
for (const r of R.filter((q) => q.open < 0.30)) console.log(`   FAIL ${r.site} R${r.R} b${r.b} at ${r.x},${r.z} open ${r.open} openTerr ${r.openTerr}`);
for (const Rr of [0, 8, 17, 26]) {
  const s = R.filter((r) => r.R === Rr);
  console.log(`  R${Rr}: ${s.filter((r) => r.open < 0.3).length}/${s.length} open<0.30   terrain-only ${s.filter((r) => r.openTerr < 0.3).length}/${s.length}`);
}
const med = (a2) => a2.slice().sort((p, q) => p - q)[Math.floor(a2.length / 2)];
console.log(`island grid n=${res.grid.length} median open ${med(res.grid.map((g) => g.open))} median openTerr ${med(res.grid.map((g) => g.openTerr))}  open<0.30 ${res.grid.filter((g) => g.open < 0.3).length}`);
console.log('what blocked a direction that terrain did not:');
for (const [k, v] of Object.entries(res.blame).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log('   ', String(v).padStart(6), k);
await browser.close();
