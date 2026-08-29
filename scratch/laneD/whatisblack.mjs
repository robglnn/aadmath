/** LANE D DIAGNOSTIC: name the object behind the black pixels. */
import { chromium } from 'playwright';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.waitForTimeout(2600);
await page.evaluate(() => { document.getElementById('boot')?.classList.add('gone'); document.getElementById('ui')?.style.setProperty('display', 'none'); });
const poses = [
  { tag: 'coastlvl0', r: 168, th: 0, pitch: -0.10 },
  { tag: 'coast0', r: 168, th: 0, pitch: -0.55 },
  { tag: 'up-mid', r: 90, th: 2.0, pitch: 0.60 },
];
for (const s of poses) {
  const x = Math.cos(s.th) * s.r, z = Math.sin(s.th) * s.r;
  const ok = await page.evaluate(([px, pz, yaw, pitch]) => {
    const a = window.__ascent; const h = a.islandAt(px, pz); if (h === null) return false;
    a.player.pos.set(px, h + 0.2, pz); a.player.vel.set(0, 0, 0);
    a.player.yaw = yaw; if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
    a.player.cam?.refound?.(); return true;
  }, [x, z, Math.atan2(-x, -z) + Math.PI, s.pitch]);
  if (!ok) continue;
  await page.waitForTimeout(900);
  const shot = await page.screenshot({ type: 'png' });
  const b64 = shot.toString('base64');
  const r = await page.evaluate(async ([d]) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + d; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    const a = window.__ascent, T = a.THREE, cam = a.camera;
    const ray = new T.Raycaster(); const v2 = new T.Vector2();
    const list = []; a.scene.traverse((o) => { if (o.isMesh && o.visible) list.push(o); });
    const name = (o) => { let n = o.name, q = o.parent; while (!n && q) { n = q.name; q = q.parent; } return n || ('anon:' + o.geometry.attributes.position.count); };
    const tally = {}; const rgbs = {};
    for (let y = 4; y < H; y += 7) for (let xx = 4; xx < W; xx += 7) {
      const i = (y * W + xx) * 4;
      const l = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
      if (l > 0.015) continue;
      v2.set((xx / W) * 2 - 1, -((y / H) * 2 - 1));
      ray.setFromCamera(v2, cam); ray.near = 0.05; ray.far = 5000;
      const hit = ray.intersectObjects(list, false);
      const k = hit.length ? name(hit[0].object) : 'SKY';
      tally[k] = (tally[k] || 0) + 1;
      if (!rgbs[k]) rgbs[k] = [];
      if (rgbs[k].length < 6) rgbs[k].push([px[i], px[i + 1], px[i + 2], hit.length ? +hit[0].distance.toFixed(0) : 0]);
    }
    return { tally, rgbs };
  }, [b64]);
  console.log('==', s.tag);
  for (const [k, v] of Object.entries(r.tally).sort((p, q) => q[1] - p[1]).slice(0, 8)) {
    console.log('   ', String(v).padStart(5), k, JSON.stringify(r.rgbs[k]));
  }
}
await browser.close();
