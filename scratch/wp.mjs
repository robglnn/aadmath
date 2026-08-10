/**
 * World-builder probe. Parks the camera at named vantages, screenshots, and
 * reports where each far land lands on screen and whether the island occludes it.
 *
 *   node scratch/wp.mjs --url http://127.0.0.1:PORT --out scratch/wp1
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'scratch/wp'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
const HIDEUI = arg('ui', '0') !== '1';

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(2800);
await page.evaluate((hide) => {
  document.getElementById('boot')?.classList.add('gone');
  if (hide) document.getElementById('ui')?.style.setProperty('display', 'none');
}, HIDEUI);

async function park(x, y, z, yaw, pitch) {
  await page.evaluate(([x, y, z, yaw, pitch]) => {
    const a = window.__ascent;
    a.player.pos.set(x, y, z);
    a.player.vel.set(0, 0, 0);
    a.player.yaw = yaw; a.player.pitch = pitch;
    a.player.cam?.snap?.();
  }, [x, y, z, yaw, pitch]);
  await page.waitForTimeout(700);
}

const views = JSON.parse(arg('views', 'null')) || [
  ['arrival', 0, null, 26, Math.PI, -0.14],
];

const report = [];
for (const v of views) {
  const [name, x, y0, z, yaw, pitch] = v;
  const y = y0 === null ? await page.evaluate(([x, z]) => (window.__ascent.world.heightAt(x, z) ?? 12) + 0.4, [x, z]) : y0;
  await park(x, y, z, yaw, pitch);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  const info = await page.evaluate(() => {
    const a = window.__ascent;
    const cam = a.camera;
    const THREE = a.THREE;
    const out = [];
    const scene = a.scene;
    const island = scene.getObjectByName('island');
    const rc = new THREE.Raycaster();
    for (const F of (a.world.FARLANDS || [])) {
      const apex = new THREE.Vector3(F.cx, F.cy + F.H * 1.4, F.cz);
      const p = apex.clone().project(cam);
      const dir = apex.clone().sub(cam.position).normalize();
      rc.set(cam.position, dir);
      rc.far = 3000;
      const hit = island ? rc.intersectObject(island, false) : [];
      out.push({
        id: F.id, ndcx: +p.x.toFixed(3), ndcy: +p.y.toFixed(3),
        infront: p.z < 1,
        occludedBy: hit.length ? +hit[0].distance.toFixed(1) : null,
        dist: +apex.distanceTo(cam.position).toFixed(0),
      });
    }
    return { cam: cam.position.toArray().map((n) => +n.toFixed(1)), far: out };
  });
  report.push({ name, ...info });
}

const state = await page.evaluate(() => window.__ascent.state());
await writeFile(path.join(OUT, 'wp.json'), JSON.stringify({ report, logs, perf: state.perf }, null, 2));
console.log(JSON.stringify(report, null, 1));
console.log('logs:', logs.length ? logs.slice(0, 6) : 'clean');
console.log('perf:', JSON.stringify(state.perf));
await browser.close();
