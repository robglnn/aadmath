// World-only vista probe: park the camera high over the plaza and look out on
// four bearings, so the horizon can be judged without the island in the way.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4477');
const OUT = path.resolve(arg('out', 'shots/vista'));
const Y = Number(arg('y', 120));
const X = Number(arg('x', 0));
const Z = Number(arg('z', 0));
const PITCH = Number(arg('pitch', -0.06));
await mkdir(OUT, { recursive: true });

const b = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().split('\n')[0]); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelectorAll('.hud, #hud, .boot, #boot').forEach((e) => (e.style.display = 'none')));

const report = await p.evaluate(() => {
  const a = window.__ascent;
  const names = [];
  a.engine.scene.traverse((o) => { if (o.name) names.push(o.name); });
  return names;
});
console.log('scene:', report.join(', '));

for (const [name, yaw] of [['n', Math.PI], ['e', Math.PI * 0.5], ['s', 0], ['w', -Math.PI * 0.5]]) {
  await p.evaluate(([xx, yy, zz, yaw, pitch]) => {
    const a = window.__ascent;
    clearInterval(window.__pin);
    window.__pin = setInterval(() => {
      a.player.pos.set(xx, yy, zz);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = yaw; a.player.pitch = pitch;
    }, 8);
  }, [X, Y, Z, yaw, PITCH]);
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, `look-${name}.png`) });
}
console.log('errors:', errs.length, errs.slice(0, 6).join(' | '));
await b.close();
