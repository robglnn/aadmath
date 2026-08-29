/** Put a cadet on ground the world says is fine, and try to walk out. Keys only. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const SPOTS = JSON.parse(arg('spots', '[[29.4,-93.5],[44.4,-122.3],[68,-93]]'));
const PER = Number(arg('per', 10));   // seconds per bearing
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
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
const faceYaw = async (want) => {
  for (let i = 0; i < 20; i++) {
    const d = await page.evaluate((w) => { let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI; if (e < -Math.PI) e += Math.PI * 2; return e; }, want);
    if (Math.abs(d) < 0.1) return;
    const k = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k); await page.waitForTimeout(Math.min(400, Math.max(40, (Math.abs(d) / 2.6) * 1000))); await page.keyboard.up(k);
  }
};
for (const [sx, sz] of SPOTS) {
  const ok = await page.evaluate(([x, z]) => {
    const a = window.__ascent; const h = a.islandAt(x, z); if (h === null) return null;
    a.player.pos.set(x, h + 0.4, z); a.player.vel.set(0, 0, 0);
    return { h, esc: a.world.escapable(x, z) };
  }, [sx, sz]);
  if (!ok) { console.log(`(${sx},${sz}) is not on the island`); continue; }
  await page.waitForTimeout(700);
  console.log(`\n=== (${sx},${sz}) h=${ok.h.toFixed(1)} the world says escapable=${ok.esc} ===`);
  let far = 0, best = null;
  for (let b = 0; b < 8; b++) {
    // return him to the spot before each bearing
    await page.evaluate(([x, z]) => { const a = window.__ascent; const h = a.islandAt(x, z); a.player.pos.set(x, h + 0.4, z); a.player.vel.set(0, 0, 0); }, [sx, sz]);
    await page.waitForTimeout(400);
    const th = (b / 8) * Math.PI * 2;
    await faceYaw(th);
    await page.keyboard.down('KeyW');
    const t0 = Date.now();
    let last = null;
    while ((Date.now() - t0) / 1000 < PER) {
      await page.waitForTimeout(600);
      last = await page.evaluate(([x, z]) => { const a = window.__ascent, p = a.player.pos;
        return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), d: +Math.hypot(p.x - x, p.z - z).toFixed(1),
          scr: !!a.player.loco?.scrambling, gnd: !!a.player.grounded, rec: a.player.recoveries | 0 }; }, [sx, sz]);
    }
    await page.keyboard.up('KeyW');
    console.log(`  ${String(Math.round(th * 180 / Math.PI)).padStart(3)}deg -> moved ${last.d} m to ${last.x},${last.y},${last.z} scrambling=${last.scr} rec=${last.rec}`);
    if (last.d > far) { far = last.d; best = last; }
  }
  console.log(`  BEST over 8 bearings x ${PER}s: ${far} m`);
}
await browser.close();
