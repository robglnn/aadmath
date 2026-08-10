/**
 * Stand the player on real ground at named spots, look at a real bearing,
 * screenshot. This is the "can a player actually see it" probe.
 *
 *   node scratch/look.mjs --url http://127.0.0.1:PORT --out shots/look
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/look'));
const W = 1280, H = 720;
await mkdir(OUT, { recursive: true });

// name, x, z, yawDeg (0 = looking -Z north), pitch
const SPOTS = JSON.parse(arg('spots', JSON.stringify([
  ['a-spawn', 0, 26, 0, -0.05],
  ['b-plaza-n', 0, -20, 0, -0.02],
  ['c-vale', -4, -80, 0, -0.02],
  ['d-lip', -4, -132, 0, -0.05],
  ['e-reach', 62, -98, -45, -0.03],
  ['f-peak2', -92, -66, 0, -0.02],
  ['g-terrace', 10, 118, 180, -0.03],
  ['h-plaza-ne', 0, 0, -50, 0.0],
  ['i-plaza-e', 0, 0, -90, 0.0],
])));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  document.getElementById('boot')?.classList.add('gone');
  for (const s of ['.hud', '#hud', '.story', '.dialog', '.marlow', '.chapter', '.langs', '.toast', '.hotbar', '.lattice']) {
    document.querySelectorAll(s).forEach((e) => (e.style.opacity = '0'));
  }
});

for (const [name, x, z, yawDeg, pitch, fov] of SPOTS) {
  const ok = await page.evaluate(([x, z, yawDeg, pitch, fov]) => {
    const a = window.__ascent;
    const g = a.player.groundAt(x, z);
    if (!a.player.cam.__patched) {
      const rig = a.player.cam; const orig = rig.update.bind(rig); rig.__patched = true;
      rig.update = (...args) => {
        orig(...args);
        if (rig.__lock) { a.camera.fov = rig.__lock; a.camera.updateProjectionMatrix(); }
      };
    }
    a.player.cam.__lock = fov || 0;
    if (g === null || g === undefined || g < -100) return false;
    a.player.pos.set(x, g + 0.4, z);
    a.player.vel.set(0, 0, 0);
    a.player.yaw = Math.PI + (yawDeg * Math.PI) / 180;
    a.player.pitch = pitch;
    return true;
  }, [x, z, yawDeg, pitch, fov]);
  // the boom lerps and the exposure adapts; pose twice and let both settle
  await page.waitForTimeout(500);
  await page.evaluate(([x, z, yawDeg, pitch]) => {
    const a = window.__ascent;
    const g = a.player.groundAt(x, z);
    if (g === null || g === undefined) return;
    a.player.pos.set(x, g + 0.4, z); a.player.vel.set(0, 0, 0);
    a.player.yaw = Math.PI + (yawDeg * Math.PI) / 180; a.player.pitch = pitch;
  }, [x, z, yawDeg, pitch]);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  if (!ok) console.log(`${name}: not standable`);
}
console.log('errors', errs.length, errs.slice(0, 5));
await browser.close();
