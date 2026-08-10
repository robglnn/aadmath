import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/tmp/critic-mat3';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3000);
await page.mouse.click(640, 400);
await page.waitForTimeout(20000); // clear intro title + dialogue

await page.evaluate(() => { document.querySelectorAll('.dlg,.marlow,.subtitle').forEach(n => n.style.display = 'none'); });

const built = await page.evaluate(async () => {
  const A = window.__ascent, B = A.builder, p = A.player;
  const out = [];
  const put = async (slot, x, z, yaw) => {
    p.pos.set(x, A.islandAt(x, z) + 1.2, z); p.vel.set(0, 0, 0); p.yaw = yaw;
    A.input.slot = slot; B.setSlot(slot); A.hud.setSlot(slot);
    await new Promise(r => setTimeout(r, 250));
    out.push(B.place());
    await new Promise(r => setTimeout(r, 250));
  };
  await put(1, 8, 30, 0);     // ramp
  await put(1, 8, 34, 0);     // ramp 2
  await put(2, 16, 30, 0);    // floor
  return out.map(o => o.ok ? { k: o.kind, x: o.piece.x, y: o.piece.y, z: o.piece.z } : o);
});
console.log('BUILT', JSON.stringify(built));
await page.waitForTimeout(1500);

async function park(dist = 15, side = 6, up = 5) {
  await page.evaluate(({ dist, side, up }) => {
    const A = window.__ascent, B = A.builder;
    B._armT = 0; B._held = false;
    const r = B.lattice.live.ramp[0];
    const p = A.player;
    // stand back along -z and to the side, so the cadet does not eclipse the piece
    const cx = r.x + side, cz = r.z - dist;
    p.pos.set(cx, A.islandAt(cx, cz) + up, cz);
    p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(r.x - cx, r.z - cz);
    window.__rampScreen = () => {
      const THREE = A.THREE;
      const v = new THREE.Vector3(r.x, r.y + 2, r.z).project(A.camera);
      return [(v.x * .5 + .5).toFixed(3), (-v.y * .5 + .5).toFixed(3)];
    };
  }, { dist, side, up });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__ascent.builder._armT = 0; });
  await page.waitForTimeout(500);
  return await page.evaluate(() => window.__rampScreen());
}

async function shot(tag) {
  await page.screenshot({ path: path.join(OUT, tag + '.png') });
}

await page.evaluate(() => {
  window.__ascent.scene.traverse((o) => { if (o.isDirectionalLight || o.isHemisphereLight) o.userData._base = o.intensity; });
});

const at = await park();
console.log('ramp at screen', at);
await shot('00-golden-default');

async function setLight(color, mul, hemiSky, hemiGround, hemiMul) {
  await page.evaluate(({ color, mul, hemiSky, hemiGround, hemiMul }) => {
    window.__ascent.scene.traverse((o) => {
      if (o.isDirectionalLight) { o.color.set(color); o.intensity = (o.userData._base ?? 1) * mul; }
      if (o.isHemisphereLight) { o.color.set(hemiSky); o.groundColor.set(hemiGround); o.intensity = (o.userData._base ?? 0.6) * hemiMul; }
    });
  }, { color, mul, hemiSky, hemiGround, hemiMul });
  await page.waitForTimeout(800);
}

await setLight('#a8c8ff', 0.40, '#7fa8ff', '#33445e', 1.1); await shot('01-dawn-cold');
await setLight('#ffffff', 1.6, '#dfeaff', '#a8a8a8', 1.7); await shot('02-noon-white');
await setLight('#ff7a28', 1.3, '#40305a', '#5a2a10', 0.6); await shot('03-dusk-orange');
await setLight('#141c30', 0.08, '#0e1428', '#080810', 0.3); await shot('04-night');

console.log('LOGS', logs.length, logs.join('\n'));
await browser.close();
