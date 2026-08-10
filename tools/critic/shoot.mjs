/**
 * Visual + behavioural capture harness.
 *
 * Drives the REAL running game in Chromium, captures real pixels, and reports
 * anything the console complained about. Critics read this output; nobody's
 * summary of the game is accepted as evidence of the game.
 *
 *   node tools/critic/shoot.mjs --out shots/round1 --url http://127.0.0.1:5173
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};

const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/latest'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    // Headless Chromium's default presentation path stalls a WebGL canvas hard:
    // with them off this game measured 20 fps with a 118 ms p95 while the GPU
    // was finishing every frame in 12 ms, and *lowering* the device scale
    // factor made it worse, which no GPU-bound workload does. Those flags are
    // what makes the harness's frame times mean the same thing an interactive
    // browser's do. The software rasteriser is still allowed as a last resort
    // so a GPU-less box gets pictures rather than a black screen — but the
    // report now names the renderer, so nobody mistakes SwiftShader's frame
    // rate for the game's.
    '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit',
  ],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));

const shots = [];
/** Evaluate against the live game, tolerating a dev-server reload mid-run. */
async function ax(fn, arg) {
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  return arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg);
}
async function shot(name, ms = 300) {
  await page.waitForTimeout(ms);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
  return f;
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2500); // let the boot beat play out

// --- 1. the opening frame, the one that has to earn the next ten minutes ---
await shot('01-arrival', 900);

// --- 2. movement: run, jump, glide, look around ---
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1400);
await shot('02-sprint', 100);
await page.keyboard.press('Space');
await page.waitForTimeout(320);
await page.keyboard.press('Space');
await page.waitForTimeout(220);
await page.keyboard.press('Space'); // glider
await shot('03-glide', 500);
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('KeyW');
await page.waitForTimeout(900);

// --- 3. building ---
await ax(() => { window.__ascent.player.pos.set(0, 12, 20); window.__ascent.player.vel.set(0, 0, 0); });
await page.waitForTimeout(400);
for (const slot of ['Digit2', 'Digit2', 'Digit1']) {
  await page.keyboard.press(slot);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(160);
}
await shot('04-build', 400);

// --- 4. the learning surface, in all three languages ---
await ax(() => window.__ascent.openRiftById('var-meaning'));
await shot('05-rift-en', 800);

// wrong answer -> the echo should appear, targeted at the misconception
await page.evaluate(() => {
  const panel = window.__ascent.panel;
  const btns = [...document.querySelectorAll('.ans')];
  const bad = btns.find((b) => !b.textContent.trim().startsWith(panel.item.answer));
  if (bad) bad.click();
  else panel.demo?.('wrong');   // the surface is not multiple choice — drive it like a hand
});
await shot('06-echo-scaffold', 900);

for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => { document.querySelector(`.langs [data-loc="${l}"]`)?.click(); }, loc);
  await page.waitForTimeout(300);
  // Switching language reloads the page, which brings the boot curtain back.
  // Photographing it and calling the result "the rift in Polish" is how a
  // capture harness lies to a critic.
  await ax(() => true);
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  await page.waitForTimeout(400);
  await ax(() => window.__ascent.panel.close());
  await ax(() => window.__ascent.openRiftById('one-step-add'));
  await shot(`07-rift-${loc}`, 700);
  await ax(() => window.__ascent.panel.close());
}
await page.evaluate(() => document.querySelector('.langs [data-loc="en"]')?.click());

// --- 5. a wide establishing shot of the whole lattice ---
await page.evaluate(() => {
  const a = window.__ascent;
  a.player.pos.set(0, 60, 120);
  a.player.pitch = -0.35; a.player.yaw = Math.PI;
});
await shot('08-vista', 1000);

// --- 5b. the other learning modalities: balance beam, term bays, area model ---
for (const [name, skill] of [['10-balance', 'two-step'], ['11-sort', 'like-terms'], ['12-area', 'distribute']]) {
  await ax(() => window.__ascent.panel.close());
  await ax((s) => window.__ascent.openRiftById(s), skill);
  await shot(name, 700);
}
// the resolution beat, mid-seal
await ax(() => window.__ascent.panel.demo('right'));
await shot('13-seal', 700);
await ax(() => window.__ascent.panel.close());

// --- telemetry ---------------------------------------------------------
// Measured HERE, before the mobile page exists. A second WebGL context running
// the same game in the same browser competes for the same GPU, and measuring
// through it was reporting roughly half the real frame rate — a number about
// the harness, not about the game.
const state = await ax(() => window.__ascent.state());
const perf = await page.evaluate(async () => {
  const a = window.__ascent;
  a.player.pos.set(0, (a.player.groundAt(0, 26) ?? 12) + 0.4, 26);
  a.player.vel.set(0, 0, 0); a.player.yaw = Math.PI; a.player.pitch = -0.14;
  await new Promise((r) => setTimeout(r, 900));
  const dts = []; let last = performance.now();
  await new Promise((res) => {
    let n = 0;
    const step = () => {
      const t = performance.now(); dts.push(t - last); last = t;
      if (++n < 140) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const s = dts.slice(30).sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const r = a.engine.renderer.info.render;
  return {
    fps: 1000 / q(0.5), fpsLow: 1000 / q(0.99), frameMs: q(0.5), p95Ms: q(0.95),
    draws: r.calls, tris: r.triangles,
    pixelRatio: a.engine.renderer.getPixelRatio(), renderScale: a.fx.renderScale,
    renderer: (() => {
      const gl = a.engine.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    })(),
  };
});

// --- 6. mobile portrait ---
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 414, height: 896 });
await mob.goto(URL, { waitUntil: 'networkidle' });
await mob.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await mob.waitForTimeout(3000);
await mob.screenshot({ path: path.join(OUT, '09-mobile.png') });
shots.push(path.join(OUT, '09-mobile.png'));

// the learning surface on a phone — it has to be playable with a thumb
for (let i = 0; i < 20; i++) {
  await mob.evaluate(() => window.__ascent.panel.close());
  await mob.evaluate(() => window.__ascent.openRiftById('two-step'));
  await mob.waitForTimeout(120);
  if (await mob.evaluate(() => window.__ascent.panel.mode) === 'balance') break;
}
await mob.waitForTimeout(1100);
await mob.screenshot({ path: path.join(OUT, '14-mobile-rift.png') });
shots.push(path.join(OUT, '14-mobile-rift.png'));
await mob.evaluate(() => window.__ascent.panel.close());

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
const report = { url: URL, shots, state, perf, errors, warnings: logs.filter((l) => l.type === 'warning') };
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log(`\nshots -> ${OUT}`);
console.log(`fps ${perf.fps.toFixed(1)} median (${perf.frameMs.toFixed(2)}ms), 1% low ${perf.fpsLow.toFixed(1)}, p95 ${perf.p95Ms.toFixed(1)}ms`);
console.log(`draws ${perf.draws}  tris ${perf.tris.toLocaleString()}  pixelRatio ${perf.pixelRatio.toFixed(2)}  renderScale ${perf.renderScale.toFixed(2)}`);
console.log(`gpu ${perf.renderer}`);
console.log(`console errors: ${errors.length}`);
errors.slice(0, 12).forEach((e) => console.log('  ! ' + e.text.split('\n')[0]));

await browser.close();
process.exit(errors.length ? 2 : 0);
