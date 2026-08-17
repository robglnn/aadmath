/**
 * WORLD ROAM PROBE — the "minute eight" question.
 *
 * Real keys only. Clears the opening beats, then walks away from the plaza on a
 * fixed bearing for a long time, photographing what a player who decides to go
 * *look at something* actually sees. No teleports, no debug camera: if the
 * mid-distance is a brown hillside, this is the file that says so.
 *
 *   node tools/critic/_w15roam.mjs --url http://127.0.0.1:4477 --out shots/x --bearing 0
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4477');
const OUT = path.resolve(arg('out', 'shots/w15-roam'));
const LEGS = Number(arg('legs', 4));
const SECS = Number(arg('secs', 22));
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
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('ascent.locale', 'en'); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await p.waitForTimeout(2200);
// dismiss any opening beat with a real click on its own button
for (const sel of ['.sc-go', '.op-go', '.ct-go', '.beat-go']) {
  const l = p.locator(sel);
  if (await l.count() && await l.first().isVisible().catch(() => false)) {
    await l.first().click().catch(() => {}); await p.waitForTimeout(600);
  }
}
await p.mouse.click(800, 450).catch(() => {});
await p.waitForTimeout(400);

const at = () => p.evaluate(() => {
  const A = window.__ascent; const q = A.player.pos;
  return { x: Math.round(q.x), y: Math.round(q.y), z: Math.round(q.z), yaw: A.player.yaw };
}).catch(() => null);

/** Turn to a bearing with the arrow keys the game itself tells you to use. */
async function face(yawWant) {
  for (let i = 0; i < 30; i++) {
    const s = await at(); if (!s) return;
    let d = ((yawWant - s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(d) < 0.06) return;
    const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await p.keyboard.down(key);
    await p.waitForTimeout(Math.min(400, Math.abs(d) * 220));
    await p.keyboard.up(key);
    await p.waitForTimeout(60);
  }
}

const log = [];
for (let leg = 0; leg < LEGS; leg++) {
  const yaw = (leg / LEGS) * Math.PI * 2;
  await face(yaw);
  await p.keyboard.down('ShiftLeft');
  await p.keyboard.down('KeyW');
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) {
    await p.keyboard.press('Space').catch(() => {});
    await p.waitForTimeout(1400);
  }
  await p.keyboard.up('KeyW');
  await p.keyboard.up('ShiftLeft');
  await p.waitForTimeout(700);
  const s = await at();
  // look back out along the way you were going: this is the roaming eye-line
  await p.screenshot({ path: path.join(OUT, `leg${leg}-ahead.png`) });
  await face(yaw + Math.PI * 0.5);
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, `leg${leg}-side.png`) });
  log.push({ leg, yaw: yaw.toFixed(2), at: s });
  console.log('leg', leg, JSON.stringify(s));
  // walk back toward the middle so the next leg starts near the centre
  await face(yaw + Math.PI);
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW');
  await p.waitForTimeout(SECS * 900);
  await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
  await p.waitForTimeout(500);
}
await writeFile(path.join(OUT, 'roam.json'), JSON.stringify({ log, errs }, null, 2));
console.log('errors:', errs.length, errs.slice(0, 5));
await b.close();
