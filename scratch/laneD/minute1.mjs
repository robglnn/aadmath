/**
 * LANE D: the minute-1 approach to the first objective, on real keys, from a
 * cleared save. Cold boot, no debug driving: the only thing read off
 * window.__ascent is WHERE the first objective is, so the walk can be aimed;
 * every metre is W + Shift + arrow keys.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const OUT = path.resolve(arg('out', 'shots/laneD-minute1'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.waitForTimeout(3000);
const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
await clear();
await page.mouse.click(800, 450).catch(() => {});
await clear();
// WHERE, only. The walking is on the keys.
const target = await page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  let best = null, bd = Infinity;
  // THE FIRST OBJECTIVE IS THE ONE THE GAME HAS OPENED, not the nearest ring:
  // nine of the ten are sealed on a fresh save and walking to one of those is
  // not the walk a cadet takes in his first minute.
  for (const r of a.rifts.list) {
    if (r.locked) continue;
    const f = r.foot || r.pos;
    const d = Math.hypot(f.x - p.x, f.z - p.z);
    if (d < bd) { bd = d; best = { id: r.id, x: f.x, z: f.z, d }; }
  }
  return best;
});
console.log('first objective:', JSON.stringify(target));
const faceYaw = async (want) => {
  for (let i = 0; i < 14; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2; return e;
    }, want);
    if (Math.abs(d) < 0.08) return true;
    const k = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k);
    await page.waitForTimeout(Math.min(360, Math.max(40, (Math.abs(d) / 2.6) * 1000)));
    await page.keyboard.up(k);
  }
  return false;
};
const here = () => page.evaluate(() => {
  const p = window.__ascent.player.pos; return { x: p.x, z: p.z };
});
let shot = 0;
const snap = async (tag) => {
  const p = await here();
  const d = Math.hypot(p.x - target.x, p.z - target.z);
  await page.screenshot({ path: path.join(OUT, `${String(shot).padStart(2, '0')}-${tag}-${d.toFixed(0)}m.png`) });
  console.log(`  shot ${shot} ${tag} at ${d.toFixed(1)} m`);
  shot++;
};
// The world has to be solving and the keys have to be reaching it before the
// walk means anything: a run where the boot overlay still had the focus reads
// as a cadet who did not move, and that is the harness, not the game.
for (let i = 0; i < 12; i++) {
  const a = await page.evaluate(() => window.__ascent.engine.frame | 0);
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => window.__ascent.engine.frame | 0);
  if (b > a) break;
  await page.bringToFront().catch(() => {});
  await page.mouse.click(640, 380).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await clear();
}
{
  const p0 = await here();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  const p1 = await here();
  if (Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.4) {
    await page.mouse.click(640, 380).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await clear();
    await page.waitForTimeout(500);
  }
}
await snap('boot');
// Shot at DISTANCES, not at times, so a before and an after taken on builds
// that walk at different speeds are the same frames of the same approach.
const MARKS = [49, 40, 30, 20, 11, 6];
let mi = 0;
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
const t0 = Date.now();
while (Date.now() - t0 < 75000) {
  await page.waitForTimeout(320);
  const p = await here();
  const d = Math.hypot(p.x - target.x, p.z - target.z);
  await faceYaw(Math.atan2(target.x - p.x, target.z - p.z));
  while (mi < MARKS.length && d <= MARKS[mi]) {
    await snap('walk');
    mi++;
  }
  if (d < 3.0) break;
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(900);
await snap('arrive');
// Hand the world back: walking onto a tear's plate opens the card, and the
// frame under judgement is the world, not the card.
for (let i = 0; i < 6; i++) {
  const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input.uiOpen));
  if (!busy) break;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(340);
}
await clear();
await page.waitForTimeout(1500);
await snap('stand');
console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
await browser.close();
