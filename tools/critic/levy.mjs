/**
 * THE LEVY — can anything but a purchase empty the wallet, and does it say so?
 *
 * The motes are earned the only way a player earns them: by running through
 * real crystals on WASD. Then the harness fires the exact call a rift surge
 * fires — `wallet.take(9)`, via `__ascent.levy`, the same function object
 * src/world/drift.js holds — over and over, and records the balance after each
 * one together with the line the game printed on screen for it.
 *
 * The old wallet's `take` was `Math.min(count, 9)`: from four motes it printed
 * zero, which is what a cold player reported as "silently reset to zero".
 *
 *   node tools/critic/levy.mjs --url http://127.0.0.1:PORT --out shots/levy
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4478');
const OUT = path.resolve(arg('out', 'shots/levy'));
const LOCS = (arg('locs', 'en,es,pl')).split(',');
const SURGE_COST = 9; // src/world/drift.js
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
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(500);

  // --- earn on foot. W is −z, S is +z, D is +x, A is −x (headless refuses
  //     pointer lock, so the camera yaw never moves and the mapping is exact).
  const walkTo = async (target, tries) => {
    for (let i = 0; i < tries; i++) {
      const nav = await page.evaluate((tg) => {
        const p = window.__ascent.player.pos;
        return { dx: tg[0] - p.x, dz: tg[2] - p.z };
      }, target);
      const d = Math.hypot(nav.dx, nav.dz);
      if (d < 3.5) return true;
      const keys = [];
      if (Math.abs(nav.dz) > 1.4) keys.push(nav.dz < 0 ? 'KeyW' : 'KeyS');
      if (Math.abs(nav.dx) > 1.4) keys.push(nav.dx > 0 ? 'KeyD' : 'KeyA');
      if (!keys.length) return true;
      for (const k of keys) await page.keyboard.down(k);
      if (d > 14) await page.keyboard.down('ShiftLeft');
      await page.waitForTimeout(d > 14 ? 260 : 130);
      await page.keyboard.up('ShiftLeft');
      for (const k of keys) await page.keyboard.up(k);
    }
    return false;
  };
  const motes = () => page.evaluate(() => window.__ascent.state().shards);

  for (let pass = 0; pass < 30 && (await motes()) < 24; pass++) {
    const at = await page.evaluate(() => {
      const p = window.__ascent.player.pos;
      let best = null, bd = 1e9;
      for (const v of window.__ascent.drift.veins || []) {
        if (v.cool > 0) continue;
        for (const m of v.motes) {
          if (!m.live) continue;
          const d = Math.hypot(m.x - p.x, m.z - p.z);
          if (d < bd) { bd = d; best = [m.x, m.y, m.z]; }
        }
      }
      return best;
    });
    if (!at) break;
    await walkTo(at, 24);
  }
  const earned = await motes();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${loc}-01-earned.png`) });

  // Step out of anything the wander walked into — the ledger strip lives in the
  // world layer, and a modal is meant to cover it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);

  // --- levy, and levy, and levy ------------------------------------------
  const steps = [];
  for (let i = 0; i < 22; i++) {
    const r = await page.evaluate((cost) => {
      const before = window.__ascent.state().shards;
      const lost = window.__ascent.levy(cost);
      return { before, lost, after: window.__ascent.state().shards };
    }, SURGE_COST);
    await page.waitForTimeout(220);
    r.strip = await page.evaluate(() => [...document.querySelectorAll('.led-row')]
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
    steps.push(r);
    if (i === 0) await page.screenshot({ path: path.join(OUT, `${loc}-02-levied.png`) });
  }
  await page.screenshot({ path: path.join(OUT, `${loc}-03-floor.png`) });

  out[loc] = {
    earned,
    floor: steps[steps.length - 1].after,
    everZero: steps.some((s) => s.after === 0 && s.before > 0),
    // The old rule for the same run, for comparison: min(balance, 9).
    oldWouldZeroAt: steps.filter((s) => s.before > 0 && s.before <= SURGE_COST).length,
    steps: steps.map((s) => `${s.before} −${s.lost} → ${s.after}`),
    lines: steps.map((s) => s.strip[s.strip.length - 1]).filter(Boolean).slice(0, 4),
  };
  await ctx.close();
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ out, errors }, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('console errors:', errors.length);
errors.slice(0, 6).forEach((e) => console.log('  !', e.loc, e.text.split('\n')[0]));
await browser.close();
process.exit(errors.length ? 2 : 0);
