/**
 * Fast fx iteration probe. Not part of the judged capture — a scratch tool that
 * parks the camera at a handful of deliberately chosen vantages and photographs
 * them, so a change to the air can be checked in twenty seconds instead of a
 * full harness run.
 *
 *   node tools/critic/probe.mjs --url http://127.0.0.1:PORT --out scratch/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'scratch/probe'));
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2600);
await page.evaluate(() => {
  document.getElementById('boot')?.classList.add('gone');
  document.getElementById('ui')?.style.setProperty('display', 'none');
  window.__ascent.engine.quality.enabled = false;
});

async function stand(x, y, z, pitch) {
  await page.evaluate(([x, y, z, pitch]) => {
    const a = window.__ascent;
    a.player.pos.set(x, y, z); a.player.vel.set(0, 0, 0); a.player.pitch = pitch;
  }, [x, y, z, pitch]);
}

/** Turn the boom until the camera is looking `off` radians from the sun bearing. */
async function faceSun(off = 0) {
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(200);
    const d = await page.evaluate((o) => {
      const a = window.__ascent;
      const THREE = a.player.pos.constructor;
      const f = new THREE(); a.engine.camera.getWorldDirection(f);
      const s = a.world.sunDir;
      const cur = Math.atan2(f.x, f.z);
      const want = Math.atan2(s.x, s.z) + o;
      let d = want - cur;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      a.player.yaw += d;
      return d;
    }, off);
    if (Math.abs(d) < 0.01) break;
  }
  await page.waitForTimeout(600);
}

async function shot(name) { await page.screenshot({ path: path.join(OUT, name + '.png') }); }

const HERE = [0, 60, 26];

await stand(...HERE, 0.06); await faceSun(0); await shot('a-into-sun');
await stand(...HERE, -0.05); await faceSun(Math.PI); await shot('b-sun-behind');
await stand(...HERE, -0.08); await faceSun(Math.PI / 2); await shot('c-cross');
await stand(2, 60, 8, -0.45); await faceSun(Math.PI / 2); await shot('d-plaza-cross');
await stand(2, 60, 8, -0.80); await faceSun(2.2); await shot('e-plaza-down');

// under the crystal spires, looking into the low sun: the textbook shaft setup
await page.evaluate(() => { window.__ascent.teleportTo('var-meaning'); });
await page.waitForTimeout(500);
await page.evaluate(() => { window.__ascent.player.pitch = 0.05; });
await faceSun(0.35); await shot('f-rift-into-sun');

// altitude: the five worlds on the horizon
await stand(0, 175, 26, -0.12); await faceSun(Math.PI * 0.75); await shot('g-vista');
await page.waitForTimeout(400); await shot('g-vista2');

// the volumetric buffer on its own
await page.evaluate(() => window.__ascent.fx.debug(1));
await stand(...HERE, 0.06); await faceSun(0); await shot('vol-into-sun');
await stand(2, 60, 8, -0.45); await faceSun(Math.PI / 2); await shot('vol-cross');
await page.evaluate(() => window.__ascent.fx.debug(0));

const state = await page.evaluate(() => window.__ascent.state());
await writeFile(path.join(OUT, 'probe.json'), JSON.stringify({ state, logs }, null, 2));
console.log('logs:', logs.length ? logs.slice(0, 8) : 'clean');
console.log('perf:', JSON.stringify(state.perf));
await browser.close();
