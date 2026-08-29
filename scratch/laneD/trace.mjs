/** LANE D DIAGNOSTIC: at one position, name what blocks each openness ray. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const X = Number(arg('x', 0)), Z = Number(arg('z', 0));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2400);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await page.evaluate(([px, pz]) => {
  const a = window.__ascent; const h = a.islandAt(px, pz);
  a.player.pos.set(px, h + 0.15, pz); a.player.vel.set(0, 0, 0); a.player.cam?.refound?.();
}, [X, Z]);
for (let i = 0; i < 6; i++) {
  const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input.uiOpen));
  if (!busy) break; await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE, cam = a.camera;
  const p = a.player.pos;
  const eye = new T.Vector3(); cam.getWorldPosition(eye);
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
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; DIRS.push(['h' + i, new T.Vector3(Math.cos(t), 0, Math.sin(t))]); }
  for (let i = 0; i < 4; i++) { const t = (i / 4) * Math.PI * 2 + 0.4, c = Math.cos(0.5);
    DIRS.push(['u' + i, new T.Vector3(Math.cos(t) * c, Math.sin(0.5), Math.sin(t) * c)]); }
  DIRS.push(['up', new T.Vector3(0, 1, 0)]);
  const name = (o) => {
    const parts = []; let q = o; while (q) { parts.unshift(q.name || q.type); q = q.parent; }
    const g = o.geometry; const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const c = g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    return parts.slice(-4).join('/') + ' [' + o.type + ' tri' + tris.toFixed(0)
      + ' inst' + (o.count || 0) + ' r' + g.boundingSphere.radius.toFixed(1)
      + ' c' + c.x.toFixed(0) + ',' + c.y.toFixed(0) + ',' + c.z.toFixed(0)
      + ' mat:' + (m?.name || m?.type) + ' col#' + (m?.color ? m.color.getHexString() : '?') + ']';
  };
  const probe = (from, tag) => DIRS.map(([lab, d]) => {
    ray.near = 0.02; ray.far = 22; ray.set(from, d);
    const h = ray.intersectObjects(list, false);
    let wallHit = null;
    if (d.y <= 0.35) for (let s = 2; s <= 22; s += 2.5) {
      const hh = a.islandAt(from.x + d.x * s, from.z + d.z * s);
      if (hh !== null && hh > from.y + d.y * s + 0.5) { wallHit = s; break; }
    }
    return { tag, lab, mesh: h.length ? name(h[0].object) + '@' + h[0].distance.toFixed(1) : null, wall: wallHit };
  });
  const body = probe(new T.Vector3(p.x, p.y + 1.46, p.z), 'body');
  const camv = probe(eye, 'cam');
  const meshCount = list.length;
  const big = list.filter((o) => { const g = o.geometry; const t = (g.index ? g.index.count : g.attributes.position.count) / 3; return t > 5000; }).map((o) => name(o));
  for (let i = 0; i < was.length; i += 2) was[i].side = was[i + 1];
  return { p: [p.x, p.y, p.z], eye: [eye.x, eye.y, eye.z], body, camv, meshCount, big: [...new Set(big)].slice(0, 20) };
});
console.log('player', out.p.map((v) => v.toFixed(1)).join(','), 'eye', out.eye.map((v) => v.toFixed(1)).join(','));
console.log('scene probe meshes:', out.meshCount);
console.log('big (>5k tris) in list:', JSON.stringify(out.big, null, 1));
for (const r of out.body) console.log(' BODY', r.lab.padEnd(4), (r.mesh || '-').padEnd(60), 'wall@', r.wall);
for (const r of out.camv) console.log(' CAM ', r.lab.padEnd(4), (r.mesh || '-').padEnd(60), 'wall@', r.wall);
await browser.close();
