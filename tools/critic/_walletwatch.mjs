/**
 * WALLET WATCH — does the currency vanish, and does the game say why?
 *
 * Cold localStorage, real keys and real mouse. Nothing here calls teleportTo or
 * openRiftById: the wipe under test happened to a cadet who walked, so this
 * walks. It harvests motes off the real drift veins by running through them,
 * then stands inside an unsealed rift's surge radius and lets the world hit it
 * over and over, logging every movement of the wallet against the ledger line
 * the game printed for it.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4478');
const OUT = path.resolve(arg('out', 'shots/walletwatch'));
const LOCS = (arg('locs', 'en')).split(',');
const STAND = Number(arg('stand', 150));
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const out = {};

for (const loc of LOCS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private */ }
  }, loc);
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ loc, type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ loc, type: 'pageerror', text: e.message }));
  const shot = async (n, ms = 200) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${loc}-${n}.png`) }); };
  const motes = () => page.evaluate(() => window.__ascent.state().shards);

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(500);

  /* ---- earn, on foot: run through live crystals until the wallet is worth
     taking from. The bearing comes from the real vein positions the drift
     field publishes, and the legs are real W presses. ---- */
  const walkTo = async (target, tries) => {
    for (let i = 0; i < tries; i++) {
      const nav = await page.evaluate((tg) => {
        const p = window.__ascent.player.pos;
        const cam = window.__ascent.camera;
        const dx = tg[0] - p.x, dz = tg[2] - p.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        const dir = new window.__ascent.THREE.Vector3();
        cam.getWorldDirection(dir);
        const have = Math.atan2(dir.x, dir.z);
        let turn = want - have;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        return { d, turn };
      }, target);
      if (nav.d < 4) return true;
      if (Math.abs(nav.turn) > 0.09) {
        await page.mouse.move(W / 2 + Math.max(-320, Math.min(320, nav.turn * 300)), H / 2, { steps: 2 });
        await page.waitForTimeout(60);
      }
      await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
      await page.waitForTimeout(240);
      await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    }
    return false;
  };

  const veins = await page.evaluate(() => (window.__ascent.drift.veins || [])
    .map((v) => [v.x ?? v.motes?.[0]?.x, v.y ?? v.motes?.[0]?.y, v.z ?? v.motes?.[0]?.z]));
  for (const v of veins.slice(0, 6)) {
    if (!Number.isFinite(v[0])) continue;
    await walkTo(v, 70);
    if ((await motes()) >= 12) break;
  }
  const earned = await motes();
  await shot('01-earned', 400);

  /* ---- now stand where the world pushes back: inside the surge radius of an
     unsealed rift, on foot, and do nothing at all. ---- */
  const rift = await page.evaluate(() => {
    const r = (window.__ascent.rifts.list || []).find((x) => !x.locked && !x.mastered);
    return r ? [r.pos.x, r.pos.y, r.pos.z] : null;
  });
  if (rift) await walkTo([rift[0], rift[1], rift[2] + 12], 140);

  const events = [];
  let last = await motes();
  const low = { min: last };
  for (let i = 0; i < STAND * 2; i++) {
    await page.waitForTimeout(500);
    const now = await page.evaluate(() => ({
      n: window.__ascent.state().shards,
      strip: [...document.querySelectorAll('.led-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    }));
    low.min = Math.min(low.min, now.n);
    if (now.n !== last) {
      events.push({ t: (i * 0.5).toFixed(1), from: last, to: now.n, strip: now.strip });
      if (now.n < last) await shot(`drop-${events.length}`, 40);
      last = now.n;
    }
  }
  await shot('02-stood', 200);

  out[loc] = {
    earned, final: last, lowest: low.min,
    zeroed: low.min === 0 && earned > 0,
    events,
    ledger: await page.evaluate(() => window.__ascent.ledger()),
  };
  await ctx.close();
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ out, errors }, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('console errors:', errors.length, JSON.stringify(errors.slice(0, 4)));
await browser.close();
process.exit(errors.length ? 2 : 0);
