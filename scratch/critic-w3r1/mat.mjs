// Material identity test: one ramp, three light hours, several ambients.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/tmp/critic-mat';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4000);

// Skip intro / get control
await page.mouse.click(640, 400);
await page.waitForTimeout(1200);

// Place a ramp on flat open ground and park the camera on it.
const info = await page.evaluate(async () => {
  const A = window.__ascent;
  const B = A.builder;
  // find flat ground near spawn
  const p = A.player;
  p.pos.set(0, 0, 0);
  // drop to ground
  const gy = A.islandAt(0, 0);
  p.pos.set(0, gy + 1, 0);
  p.vel.set(0, 0, 0);
  p.yaw = 0;
  B.setSlot(2); // floor
  B.arm();
  const res = [];
  // build a ramp and a floor side by side
  B.setSlot(1); // ramp
  res.push(B.place());
  await new Promise(r => setTimeout(r, 400));
  return { res, gy, pos: p.pos.toArray(), kinds: B.kinds };
});
console.log('BUILD', JSON.stringify(info));

await page.waitForTimeout(1500);

// Position the free camera to frame the ramp
async function frameRamp() {
  return await page.evaluate(() => {
    const A = window.__ascent;
    const list = A.builder.lattice.live.ramp;
    if (!list.length) return null;
    const p = list[0];
    return { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
  });
}
const ramp = await frameRamp();
console.log('RAMP', JSON.stringify(ramp));

// Sample colours of the ramp deck. Use raycast to identify pixels belonging to lattice.
async function sample(tag) {
  const f = path.join(OUT, tag + '.png');
  await page.screenshot({ path: f });
  const px = await page.evaluate(() => {
    const A = window.__ascent, THREE = A.THREE;
    // Render pass is done; read pixels straight from the canvas by re-rendering
    // into a readback. Easier: raycast from camera to find screen coords of ramp deck.
    const list = A.builder.lattice.live.ramp;
    if (!list.length) return null;
    const p = list[0];
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const t = -1.6 + i * 0.8; // along local z
      const w = new THREE.Vector3(p.x + Math.sin(p.yaw + Math.PI / 2) * 0, p.y + Math.max(0, t + 2) - 0.1, p.z + t);
      const v = w.clone().project(A.camera);
      pts.push({ x: (v.x * 0.5 + 0.5), y: (-v.y * 0.5 + 0.5), z: v.z });
    }
    return pts;
  });
  return { file: f, px };
}

// Screenshot the default hour
await page.evaluate(() => {
  const A = window.__ascent;
  // point the camera at the ramp
  const list = A.builder.lattice.live.ramp;
  if (!list.length) return;
  const p = list[0];
  A.player.pos.set(p.x + 6, p.y + 3, p.z - 7);
  A.player.yaw = Math.atan2(p.x - (p.x + 6), p.z - (p.z - 7));
});
await page.waitForTimeout(800);
await sample('00-default');

// Now drive the key light through three hours by mutating the DirectionalLight.
async function setLight(name, color, intensity, hemiSky, hemiGround, ambientMul) {
  await page.evaluate(({ color, intensity, hemiSky, hemiGround, ambientMul }) => {
    const A = window.__ascent;
    A.scene.traverse((o) => {
      if (o.isDirectionalLight) { o.color.set(color); o.intensity = intensity * (o.userData._base ?? 1); }
      if (o.isHemisphereLight) { o.color.set(hemiSky); o.groundColor.set(hemiGround); o.intensity = 0.6 * ambientMul; }
      if (o.isAmbientLight) { o.intensity *= 1; }
    });
  }, { color, intensity, hemiSky, hemiGround, ambientMul });
  await page.waitForTimeout(600);
  return await sample(name);
}

// record original intensities first
await page.evaluate(() => {
  window.__ascent.scene.traverse((o) => { if (o.isDirectionalLight) o.userData._base = o.intensity; });
});

const r1 = await setLight('01-dawn-cold', '#9fc4ff', 0.55, '#7fa8ff', '#3a4a66', 0.9);
const r2 = await setLight('02-noon-white', '#ffffff', 1.35, '#cfe4ff', '#8f8f8f', 1.4);
const r3 = await setLight('03-dusk-orange', '#ff8a3c', 1.1, '#3a3a6a', '#5a2a10', 0.5);
const r4 = await setLight('04-night-dark', '#20304a', 0.12, '#101830', '#0a0a12', 0.25);

console.log('SAMPLES', JSON.stringify({ r1: r1.px, r2: r2.px, r3: r3.px, r4: r4.px }, null, 1));
await writeFile(path.join(OUT, 'logs.txt'), logs.join('\n'));
console.log('LOGS', logs.length, logs.slice(0, 10).join('\n'));
await browser.close();
