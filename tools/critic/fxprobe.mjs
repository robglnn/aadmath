/**
 * FX probe — the shots that judge the *atmosphere* specifically.
 *
 * The main harness photographs the game. This one photographs the air: the
 * volumetric buffer on its own, a beacon from three distances, and the near
 * field with the sun in front of and behind the lens. Those are the four
 * pictures that decide whether the atmosphere reads as light in a place or as
 * a wash laid over a frame.
 *
 *   node tools/critic/fxprobe.mjs --out shots/fxprobe --url http://127.0.0.1:5173
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/fxprobe'));
const W = Number(arg('w', 1600)), H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2200);
// the HUD and the boot curtain are somebody else's work; hide them so these
// frames are only ever about the air
await page.addStyleTag({ content: '#boot,.hud,#hud,.langs,.audio,.chapter,.marlow,.subtitle,.toast{opacity:0!important}' });

async function look(o) {
  await page.evaluate((s) => {
    const a = window.__ascent;
    a.player.pos.set(s.x, s.y, s.z);
    a.player.vel.set(0, 0, 0);
    a.player.yaw = s.yaw; a.player.pitch = s.pitch;
    if (a.player.cam) { a.player.cam.yaw = s.yaw; a.player.cam.pitch = s.pitch; }
  }, o);
  await page.waitForTimeout(o.settle ?? 700);
}
async function shot(name, ms = 260) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

// where are the rifts?
const rifts = await page.evaluate(() => (window.__ascent.rifts?.list || []).map((r) => ({
  id: r.id, x: r.pos.x, y: r.pos.y, z: r.pos.z,
})));
await writeFile(path.join(OUT, 'rifts.json'), JSON.stringify(rifts, null, 2));

const TO_SUN = { yaw: -2.166, pitch: 0.20 };
const OFF_SUN = { yaw: 0.976, pitch: 0.02 };

// 1 — into the light from the plaza: this is where shafts have to exist
await look({ x: 6, y: 62, z: 30, ...TO_SUN, settle: 900 });
await shot('a-into-sun');
await page.evaluate(() => window.__ascent.fx.debug(1));
await shot('b-volume-buffer', 500);
await page.evaluate(() => window.__ascent.fx.debug(0));

// 2 — sun at your back: the air must still have body, not go flat
await look({ x: 6, y: 62, z: 30, ...OFF_SUN });
await shot('c-off-sun');

// 3 — a beacon at three ranges
// `pos.y` is the rift ring, 4.4 m over the dais it stands on.
const r0 = rifts[0] || { x: 0, y: 60, z: 0 };
for (const [name, d, dy, aim] of [
  ['d-beacon-near', 13, 1.2, 1.0],   // eye level, the stone in frame
  ['e-beacon-mid', 34, 3.0, 2.0],
  ['f-beacon-far', 95, 8.0, 6.0],
]) {
  const camY = r0.y + dy;
  await look({ x: r0.x, y: camY, z: r0.z + d, yaw: Math.PI, pitch: Math.atan2((r0.y - 2.4 + aim) - camY, d) });
  await shot(name);
}

// 3b — standing on the dais: does the light touch the stone it stands on?
await look({ x: r0.x + 1.0, y: r0.y - 2.4, z: r0.z + 15, yaw: Math.PI, pitch: -0.14 });
await shot('h-beacon-pool');

// 4 — the near field, low to the ground, looking across the light
await look({ x: 6, y: 60.6, z: 30, yaw: -2.166, pitch: -0.05 });
await shot('g-nearfield');

// 5 — diagnostics: the near field with the rest of the stack stood down, so a
// missing mote field cannot hide behind a bright frame
if (process.argv.includes('--diag')) {
  await page.evaluate(() => {
    const a = window.__ascent;
    a.fx.atmosphere.setAmount(1);
    a.fx.passes.shafts.allowed = false;
    a.fx.passes.bloom.enabled = false;
  });
  await shot('i-motes-only', 600);
  await page.evaluate(() => window.__ascent.fx.atmosphere.setAmount(5));
  await shot('j-motes-x5', 400);
  await page.evaluate(() => {
    const a = window.__ascent;
    a.fx.atmosphere.setAmount(1);
    a.fx.passes.shafts.allowed = true;
    a.fx.passes.bloom.enabled = true;
  });
}

const perf = await page.evaluate(async () => {
  const dts = []; let last = performance.now();
  await new Promise((res) => { let n = 0; const s = () => { const t = performance.now(); dts.push(t - last); last = t; if (++n < 120) requestAnimationFrame(s); else res(); }; requestAnimationFrame(s); });
  const s = dts.slice(24).sort((a, b) => a - b);
  return { fps: 1000 / s[Math.floor(s.length / 2)] };
});
const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
console.log(`fxprobe -> ${OUT}   fps ${perf.fps.toFixed(1)}   errors ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ! ' + e.text.split('\n')[0]));
await browser.close();
process.exit(errors.length ? 2 : 0);
