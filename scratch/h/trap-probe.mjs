/**
 * LANE H — reproduction probe for the corridor trap.
 * Drives with REAL key events only (W + arrow keys). Reads facts back.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h-trap'));
const SECS = Number(arg('secs', 45));
const BEARINGS = Number(arg('bearings', 8));
const TARGET = arg('target', 'eval-expr');
const DIST = Number(arg('dist', 92));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
         '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
await clear();

// per-frame sampler inside the page
await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const S = { on: false, rows: [] };
  window.__H = S;
  const cam = new T.Vector3();
  const tick = () => {
    try {
      if (S.on) {
        const p = a.player.pos;
        a.camera.getWorldPosition(cam);
        const gh = a.islandAt(p.x, p.z);
        const cg = a.islandAt(cam.x, cam.z);
        S.rows.push([
          performance.now(), p.x, p.y, p.z, a.player.yaw,
          gh === null ? NaN : p.y - gh,
          cg === null ? NaN : cam.y - cg,
          a.player.grounded ? 1 : 0,
          Math.hypot(a.player.vel.x, a.player.vel.z),
          a.panel?.open ? 1 : 0,
        ]);
      }
    } catch {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const rifts = await page.evaluate(() => window.__ascent.rifts.list.map(
  (r) => ({ id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z, locked: !!r.locked })));
const spawn = await page.evaluate(() => { const p = window.__ascent.player.pos; return { x: p.x, y: p.y, z: p.z }; });
console.log('spawn', JSON.stringify(spawn));
console.log('rifts', JSON.stringify(rifts.map((r) => ({ id: r.id, x: +r.x.toFixed(1), z: +r.z.toFixed(1) }))));
const target = rifts.find((r) => r.id === TARGET) || rifts[0];
console.log('target', target.id, target.x.toFixed(1), target.z.toFixed(1));

const faceYaw = async (want) => {
  for (let i = 0; i < 16; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2;
      return e;
    }, want);
    if (Math.abs(d) < 0.12) return true;
    const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(400, Math.max(50, Math.abs(d) / 2.6 * 1000)));
    await page.keyboard.up(key);
  }
  return false;
};

const report = [];
for (let b = 0; b < BEARINGS; b++) {
  const th = (b / BEARINGS) * Math.PI * 2;
  const START = { x: target.x + Math.cos(th) * DIST, z: target.z + Math.sin(th) * DIST };
  const placed = await page.evaluate((s) => {
    const a = window.__ascent;
    const h = a.islandAt(s.x, s.z);
    if (h === null) return false;
    a.player.pos.set(s.x, h + 0.3, s.z);
    a.player.vel.set(0, 0, 0);
    return true;
  }, START);
  if (!placed) { console.log(`bearing ${(th * 180 / Math.PI).toFixed(0)}: off island, skipped`); continue; }
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__H.rows.length = 0; window.__H.on = true; });

  const t0 = Date.now();
  let held = false, reached = false, retarget = 0;
  while ((Date.now() - t0) / 1000 < SECS && !reached) {
    const err = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      return { want: Math.atan2(t.x - p.x, t.z - p.z), dist: Math.hypot(t.x - p.x, t.z - p.z),
               ui: !!a.input.uiOpen || !!a.panel?.open };
    }, target);
    if (err.dist < 7) { reached = true; break; }
    if (err.ui) { if (held) { await page.keyboard.up('KeyW'); held = false; } await page.keyboard.press('Escape'); await clear(); await page.waitForTimeout(250); continue; }
    if (held) { await page.keyboard.up('KeyW'); held = false; }
    await faceYaw(err.want);
    await page.keyboard.down('KeyW'); held = true;
    await page.waitForTimeout(1400);
    retarget++;
  }
  if (held) await page.keyboard.up('KeyW');
  const rows = await page.evaluate(() => { window.__H.on = false; return window.__H.rows; });
  // analysis
  let deepest = 0, camWorst = 0, stuck = 0, run = 0, prev = null, tPrev = null;
  let underFrames = 0;
  for (const r of rows) {
    const [t, x, y, z, yaw, under, camUnder, gnd, spd, ui] = r;
    if (Number.isFinite(under) && under < deepest) deepest = under;
    if (Number.isFinite(under) && under < -1.0) underFrames++;
    if (Number.isFinite(camUnder) && camUnder < camWorst) camWorst = camUnder;
    if (prev) {
      const moved = Math.hypot(x - prev[0], z - prev[1]);
      if (moved > 0.06) { run = 0; prev = [x, z]; tPrev = t; }
      else { run = (t - tPrev) / 1000; if (run > stuck) stuck = run; }
    } else { prev = [x, z]; tPrev = t; }
  }
  const last = rows[rows.length - 1];
  const endDist = last ? Math.hypot(last[1] - target.x, last[3] - target.z) : -1;
  const line = { bearing: +(th * 180 / Math.PI).toFixed(0), reached, endDist: +endDist.toFixed(1),
                 secs: +((Date.now() - t0) / 1000).toFixed(1), stuckS: +stuck.toFixed(1),
                 deepestUnder: +deepest.toFixed(2), underFrames, camWorstUnder: +camWorst.toFixed(2),
                 frames: rows.length };
  report.push(line);
  console.log(JSON.stringify(line));
  if (!reached || stuck > 2.5 || deepest < -1.0) {
    await page.screenshot({ path: path.join(OUT, `b${line.bearing}-fail.png`) });
    await writeFile(path.join(OUT, `b${line.bearing}.json`), JSON.stringify(rows.map((r) => r.map((v) => (typeof v === 'number' ? +v.toFixed(3) : v)))));
  }
}
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ target, report, errs }, null, 2));
console.log('errors', errs.length, errs.slice(0, 3));
await browser.close();
