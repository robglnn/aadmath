/** Can a cadet WALK himself into the wedged state, with nothing but keys? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', 'shots/_walkin'));
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

const VIEW = `(() => {
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
  const v2 = new T.Vector2();
  let short = 0, far = 0, n = 0;
  for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 9; ix++) {
    v2.set((ix / 8) * 1.9 - 0.95, (iy / 6) * 1.9 - 0.95);
    ray.near = 0.02; ray.far = 900; ray.setFromCamera(v2, cam);
    const h = ray.intersectObjects(list, false);
    let d = h.length ? h[0].distance : 900;
    const dir = ray.ray.direction;
    for (let s = 1; s < Math.min(d, 200); s += 1.5) {
      const hh = a.islandAt(eye.x + dir.x * s, eye.z + dir.z * s);
      if (hh !== null && hh > eye.y + dir.y * s) { d = Math.min(d, s); break; }
    }
    n++; if (d < 3) short++; if (d > 25) far++;
  }
  for (let i = 0; i < was.length; i += 2) was[i].side = was[i + 1];
  return { short: +(short / n).toFixed(3), seeFar: +(far / n).toFixed(3),
           x: +p.x.toFixed(1), z: +p.z.toFixed(1), rec: a.player.recoveries | 0,
           stuck: !!a.player.stuck, ui: !!a.input.uiOpen };
})()`;

const sites = await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const out = []; const c = new T.Vector3(), s = new T.Vector3();
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.noCamBlock || o.isInstancedMesh) return;
    const m = o.material; if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    if (mats.some((q) => !q || q.transparent || q.depthWrite === false)) return;
    const g = o.geometry; if (!g) return;
    const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
    if (!tris || tris > 30000) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere; if (!bs) return;
    o.updateWorldMatrix(true, false);
    s.setFromMatrixScale(o.matrixWorld);
    const r = bs.radius * Math.max(s.x, s.y, s.z);
    if (r < 10 || r > 120) return;
    c.copy(bs.center).applyMatrix4(o.matrixWorld);
    if (Math.hypot(c.x, c.z) > 190) return;
    if (a.islandAt(c.x, c.z) === null) return;
    out.push({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: +r.toFixed(1) });
  });
  return out;
});
console.log('sites', JSON.stringify(sites));

const handBack = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
};

for (const s of sites.slice(0, 6)) {
  await handBack();
  // START OUTSIDE. Set down on the ground 16 m from the middle of the thing,
  // then walk in with the key. The teleport is the walk to the site; the wedge
  // has to be earned.
  const ok = await page.evaluate((t) => {
    const a = window.__ascent;
    for (const b of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const ang = (b / 8) * Math.PI * 2;
      const x = t.x + Math.cos(ang) * 16, z = t.z + Math.sin(ang) * 16;
      const h = a.islandAt(x, z);
      if (h === null) continue;
      a.player.pos.set(x, h + 0.55, z);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = Math.atan2(t.x - x, t.z - z);
      return { x, z };
    }
    return null;
  }, s);
  if (!ok) { console.log('no start for', s.x, s.z); continue; }
  await page.waitForTimeout(700);
  await handBack();
  await page.mouse.click(640, 360);
  await page.keyboard.down('KeyW');
  let wedged = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(160);
    const v = await page.evaluate(VIEW);
    if (v.ui) { await page.keyboard.up('KeyW'); await handBack(); await page.keyboard.down('KeyW'); continue; }
    if (v.short > 0.45 && v.seeFar < 0.12) { wedged = { ...v, i }; break; }
  }
  await page.keyboard.up('KeyW');
  const fin = await page.evaluate(VIEW);
  await page.screenshot({ path: path.join(OUT, `walk-${s.x}_${s.z}.png`) });
  console.log(`site r=${s.r} @${s.x},${s.z}: wedged=${wedged ? 'YES @' + wedged.i : 'no'} final=${JSON.stringify(fin)}`);
}

await browser.close();
