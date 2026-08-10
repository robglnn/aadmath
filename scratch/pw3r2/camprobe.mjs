/**
 * Camera-burial probe.
 *
 * Drives the real game with organic input (W, Shift, mouse look) from spawn,
 * and every animation frame measures how far the *rendered* lens is below the
 * heightfield it is flying over. Screenshots the worst offenders.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/camprobe'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(2600);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));

// instrument: a per-frame clearance sampler installed into the real engine
await page.evaluate(() => {
  const a = window.__ascent;
  const W = a.world;
  window.__cam = { worst: [], n: 0, below: 0, dark: 0 };
  const hAt = (x, z) => {
    const h = a.islandAt(x, z);
    const s = a.surfaceAt(x, z);
    if (s !== null && (h === null || s > h)) return s;
    return h;
  };
  a.engine.add(() => {
    const c = a.camera;
    const rec = window.__cam;
    rec.n++;
    // deepest penetration in a small disc around the lens (the near plane has volume)
    let pen = -99;
    for (const [dx, dz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
      const h = hAt(c.position.x + dx, c.position.z + dz);
      if (h === null) continue;
      pen = Math.max(pen, h - c.position.y);
    }
    if (pen > -0.20) {
      rec.below++;
      rec.worst.push({ t: +performance.now().toFixed(0), pen: +pen.toFixed(3),
        px: +a.player.pos.x.toFixed(1), pz: +a.player.pos.z.toFixed(1),
        cx: +c.position.x.toFixed(1), cy: +c.position.y.toFixed(2), cz: +c.position.z.toFixed(1) });
      if (rec.worst.length > 400) rec.worst.shift();
    }
  });
});

const W = 1280, H = 720;
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);

const shots = [];
async function leg(name, keys, mouseDx, ms) {
  for (const k of keys) await page.keyboard.down(k);
  const steps = Math.round(ms / 100);
  for (let i = 0; i < steps; i++) {
    if (mouseDx) await page.mouse.move(W / 2 + mouseDx, H / 2, { steps: 2 });
    await page.waitForTimeout(100);
    if (i % 6 === 5) {
      const f = path.join(OUT, `${name}-${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: f });
      shots.push(f);
    }
  }
  for (const k of keys) await page.keyboard.up(k);
}

// twelve seconds of ordinary running out of spawn, in several directions
await leg('a', ['KeyW', 'ShiftLeft'], 0, 2600);
await leg('b', ['KeyW', 'ShiftLeft'], 26, 2600);
await leg('c', ['KeyW', 'ShiftLeft'], -34, 2600);
await leg('d', ['KeyW', 'KeyD', 'ShiftLeft'], 12, 2200);
await leg('e', ['KeyS', 'ShiftLeft'], -20, 2000);

const rec = await page.evaluate(() => window.__cam);
console.log(JSON.stringify({
  frames: rec.n, below: rec.below, pct: +(100 * rec.below / rec.n).toFixed(2),
  worstPen: rec.worst.length ? Math.max(...rec.worst.map((w) => w.pen)) : null,
  sample: rec.worst.slice(-25),
  errs,
}, null, 1));
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(rec, null, 1));
await browser.close();
