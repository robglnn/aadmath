import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/tmp/critic-mat2';
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
await page.waitForTimeout(14000); // let intro title and first dialogue clear

// Build a ramp + floor + wall on flat ground
const built = await page.evaluate(async () => {
  const A = window.__ascent, B = A.builder, p = A.player;
  const out = [];
  const put = async (slot, x, z, yaw) => {
    p.pos.set(x, A.islandAt(x, z) + 1.2, z); p.vel.set(0, 0, 0); p.yaw = yaw;
    A.input.slot = slot; B.setSlot(slot); A.hud.setSlot(slot);
    await new Promise(r => setTimeout(r, 200));
    out.push(B.place());
    await new Promise(r => setTimeout(r, 200));
  };
  await put(1, 6, 26, 0);     // ramp
  await put(2, 14, 26, 0);    // floor
  await put(0, 22, 26, 0);    // wall
  return out;
});
console.log('BUILT', JSON.stringify(built));
await page.waitForTimeout(1500);

// Camera: park the player away and look at the ramp, disarm the ghost
async function park() {
  await page.evaluate(() => {
    const A = window.__ascent, B = A.builder;
    B._armT = 0; B._held = false;
    const r = B.lattice.live.ramp[0];
    const p = A.player;
    const cx = r.x - 9, cz = r.z - 11;
    p.pos.set(cx, A.islandAt(cx, cz) + 2.0, cz);
    p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(r.x - cx, r.z - cz);
    p.pitch = -0.08;
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__ascent.builder._armT = 0; });
  await page.waitForTimeout(400);
}

// read back the average colour of the deck region straight from the canvas
async function deckColour() {
  return await page.evaluate(() => {
    const A = window.__ascent, THREE = A.THREE;
    const r = A.builder.lattice.live.ramp[0];
    const cvs = A.engine.renderer.domElement;
    // sample world points on the ramp deck, project, read pixels off a 2D copy
    const c2 = document.createElement('canvas');
    c2.width = cvs.width; c2.height = cvs.height;
    const g = c2.getContext('2d');
    g.drawImage(cvs, 0, 0);
    const samples = [];
    for (let i = 0; i < 7; i++) {
      const t = -1.7 + i * 0.55;
      const localUp = Math.max(0, t + 2.0);
      const w = new THREE.Vector3(r.x, r.y + localUp + 0.05, r.z + t);
      const v = w.clone().project(A.camera);
      const px = Math.round((v.x * 0.5 + 0.5) * c2.width);
      const py = Math.round((-v.y * 0.5 + 0.5) * c2.height);
      if (px < 2 || py < 2 || px > c2.width - 3 || py > c2.height - 3) continue;
      const d = g.getImageData(px - 2, py - 2, 5, 5).data;
      let R = 0, G = 0, Bl = 0, n = 0;
      for (let k = 0; k < d.length; k += 4) { R += d[k]; G += d[k + 1]; Bl += d[k + 2]; n++; }
      samples.push({ px, py, r: Math.round(R / n), g: Math.round(G / n), b: Math.round(Bl / n) });
    }
    return samples;
  });
}

async function shot(tag) {
  await page.screenshot({ path: path.join(OUT, tag + '.png') });
  const s = await deckColour();
  console.log(tag, JSON.stringify(s));
  return s;
}

await page.evaluate(() => {
  window.__ascent.scene.traverse((o) => { if (o.isDirectionalLight) o.userData._base = o.intensity; if (o.isHemisphereLight) o.userData._base = o.intensity; });
});

await park();
await shot('00-golden-default');

async function setLight(color, mul, hemiSky, hemiGround, hemiMul) {
  await page.evaluate(({ color, mul, hemiSky, hemiGround, hemiMul }) => {
    window.__ascent.scene.traverse((o) => {
      if (o.isDirectionalLight) { o.color.set(color); o.intensity = (o.userData._base ?? 1) * mul; }
      if (o.isHemisphereLight) { o.color.set(hemiSky); o.groundColor.set(hemiGround); o.intensity = (o.userData._base ?? 0.6) * hemiMul; }
    });
  }, { color, mul, hemiSky, hemiGround, hemiMul });
  await page.waitForTimeout(700);
}

await setLight('#a8c8ff', 0.45, '#7fa8ff', '#33445e', 1.1); await shot('01-dawn-cold');
await setLight('#ffffff', 1.5, '#dfeaff', '#9a9a9a', 1.6); await shot('02-noon-white');
await setLight('#ff7a28', 1.2, '#40305a', '#5a2a10', 0.6); await shot('03-dusk-orange');
await setLight('#1a2440', 0.10, '#0e1428', '#080810', 0.3); await shot('04-night');
await setLight('#33ff66', 1.2, '#22ff88', '#0a2a10', 1.0); await shot('05-alien-green');

console.log('LOGS', logs.length, logs.join('\n'));
await browser.close();
