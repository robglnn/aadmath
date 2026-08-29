/** Diagnose the 315 degree approach to eval-expr: log the trail. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const DEG = Number(arg('deg', 315));
const RING = Number(arg('ring', 78));
const SECS = Number(arg('secs', 75));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
});

const target = await page.evaluate(() => {
  const a = window.__ascent;
  const r = a.rifts.list.find((q) => q.id === 'eval-expr') || a.rifts.list[1];
  return { id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z };
});
const th = (DEG / 180) * Math.PI;
const start = { x: target.x + Math.cos(th) * RING, z: target.z + Math.sin(th) * RING };
const placed = await page.evaluate((s) => {
  const a = window.__ascent, W = a.world;
  let x = s.x, z = s.z, oneWay = false;
  if (a.islandAt(x, z) === null) return null;
  if (W && typeof W.escapable === 'function' && !W.escapable(x, z)) {
    oneWay = true;
    let best = null;
    for (let r = 4; r <= 40 && !best; r += 4) {
      for (let k = 0; k < 16; k++) {
        const t = (k / 16) * Math.PI * 2;
        const cx = x + Math.cos(t) * r, cz = z + Math.sin(t) * r;
        if (a.islandAt(cx, cz) !== null && W.escapable(cx, cz)) { best = [cx, cz]; break; }
      }
    }
    if (best) { x = best[0]; z = best[1]; }
  }
  const h = a.islandAt(x, z);
  if (h === null) return null;
  a.player.pos.set(x, h + 0.3, z);
  a.player.vel.set(0, 0, 0);
  return { x, z, oneWay, h };
}, start);
console.log('target', JSON.stringify(target), 'ringpt', JSON.stringify(start), 'placed', JSON.stringify(placed));
await page.waitForTimeout(600);

const faceYaw = async (want) => {
  for (let i = 0; i < 16; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2;
      return e;
    }, want);
    if (Math.abs(d) < 0.12) return true;
    const k = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k);
    await page.waitForTimeout(Math.min(400, Math.max(50, (Math.abs(d) / 2.6) * 1000)));
    await page.keyboard.up(k);
  }
  return false;
};

await page.keyboard.down('KeyW');
const t0 = Date.now();
let last = null;
while ((Date.now() - t0) / 1000 < SECS) {
  const f = await page.evaluate((tt) => {
    const a = window.__ascent, W = a.world, p = a.player.pos;
    const hd = W.headingTo(p.x, p.z, tt.x, tt.z);
    return {
      x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
      yaw: +a.player.yaw.toFixed(2), wantYaw: +hd.yaw.toFixed(2), escaping: !!hd.escaping,
      esc: W.escapable(p.x, p.z), grounded: !!a.player.grounded, stuck: !!a.player.stuck,
      recoveries: a.player.recoveries | 0, ui: !!(a.panel?.open || a.input.uiOpen),
      speed: +Math.hypot(a.player.vel.x, a.player.vel.z).toFixed(2),
      d: +Math.hypot(tt.x - p.x, tt.z - p.z).toFixed(1),
      mode: a.player.mode || (a.player.gliding ? 'glide' : ''),
    };
  }, target);
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${t.padStart(5)}s d=${String(f.d).padStart(6)} at ${String(f.x).padStart(7)},${String(f.y).padStart(6)},${String(f.z).padStart(7)} yaw=${f.yaw}/${f.wantYaw}${f.escaping ? ' ESCAPING' : ''} esc=${f.esc} gnd=${f.grounded} spd=${f.speed} rec=${f.recoveries} ui=${f.ui} ${f.mode}`);
  await faceYaw(f.wantYaw);
  await page.waitForTimeout(900);
  last = f;
}
await page.keyboard.up('KeyW');
await page.screenshot({ path: `/Users/harrison/dev/aadmath/shots/h-b${DEG}.png` });
console.log('END', JSON.stringify(last));
await browser.close();
