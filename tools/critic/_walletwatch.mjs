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
  /**
   * Walk, on WASD, exactly as a pair of hands does.
   *
   * NOT on the mouse. Headless Chromium refuses `requestPointerLock`, so
   * `Input.locked` is false and `src/core/input.js` drops every mousemove on
   * the floor — a harness that "turns" with the mouse here is turning nothing
   * and walking in whatever direction the camera started in. The camera yaw is
   * therefore fixed, which makes the mapping exact and measurable, and it was
   * measured against the running game: W is −z, S is +z, D is +x, A is −x.
   */
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

  // Chase the nearest live crystal, re-aiming every leg — a cluster is a
  // scatter, not a point, and running at its centre of mass misses all of it.
  for (let pass = 0; pass < 26; pass++) {
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
    await walkTo(at, 26);
    if ((await motes()) >= 16) break;
  }
  const earned = await motes();
  await shot('01-earned', 400);

  /* ---- seal one rift, on foot and on the real keypad. src/world/drift.js
     holds every surge back until the cadet has sealed something, so a wallet
     test that never seals never meets the thing that empties it. ---- */
  const first = await page.evaluate(() => {
    const r = (window.__ascent.rifts.list || []).find((x) => !x.locked && !x.mastered);
    return r ? [r.pos.x, r.pos.y, r.pos.z] : null;
  });
  let sealed = false;
  let answers = 0;
  if (first) {
    await walkTo([first[0], first[1], first[2] + 3], 200);
    /* A surge only fires once a line is actually HELD (src/world/drift.js keeps
       the world calm until then), so this answers the real rift, on the real
       keypad, over and over, until the mastery engine grants the line. That is
       the shortest honest road to the state the wallet complaint came from. */
    for (let a = 0; a < 34 && !sealed; a++) {
      const open = await page.evaluate(() => !!window.__ascent.panel?.open);
      if (!open) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(900);
        if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) {
          const nr = await page.evaluate(() => {
            const r = (window.__ascent.rifts.list || []).find((x) => !x.locked && !x.mastered);
            return r ? [r.pos.x, r.pos.y, r.pos.z] : null;
          });
          if (!nr) break;
          await walkTo([nr[0], nr[1], nr[2] + 3], 90);
          continue;
        }
      }
      if (a === 0) await shot('02-panel', 300);
      // Real clicks on the real keypad; on the other modalities, the panel's
      // own demo path, which is the same code a correct click runs.
      const typed = await page.evaluate(async () => {
        const p = window.__ascent.panel;
        const ans = String(p?.item?.answer ?? '');
        const pad = [...document.querySelectorAll('.rf-key')].filter((x) => x.offsetParent);
        if (!pad.length) return false;
        for (const ch of ans) {
          const b = pad.find((x) => x.textContent.trim() === ch);
          if (!b) return false;
          b.click();
        }
        return true;
      });
      if (typed) {
        if (a === 0) await shot('03-typed', 260);
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('.rf-key')]
            .filter((x) => x.offsetParent && /commit/.test(x.className))[0];
          b?.click();
        });
      } else {
        await page.evaluate(() => window.__ascent.panel?.demo?.('right'));
      }
      answers++;
      await page.waitForTimeout(a === 0 ? 3800 : 2600);
      if (a === 0) await shot('04-sealed', 400);
      sealed = await page.evaluate(() => (window.__ascent.rifts.list || []).some((r) => r.mastered));
      await page.evaluate(() => { if (window.__ascent.panel?.open) window.__ascent.panel.close(); });
      await page.waitForTimeout(500);
    }
  }

  /* ---- now stand where the world pushes back.
     A ring is born at ground level under the rift and only catches a cadet
     whose boots are within nine metres of it (src/world/drift.js), so the
     stand point is chosen off the real terrain: a ring twenty to thirty metres
     out — past the fifteen-metre door, inside the thirty-four-metre reach —
     whose ground is level with the rift's own. Then the harness does nothing
     whatsoever, which is what the player was doing. ---- */
  const spot = await page.evaluate(() => {
    const r = (window.__ascent.rifts.list || []).find((x) => !x.locked && !x.mastered);
    if (!r) return null;
    const base = window.__ascent.islandAt(r.pos.x, r.pos.z);
    let best = null, bg = 1e9;
    for (let a = 0; a < 48; a++) {
      for (const rad of [19, 22, 25, 28, 31]) {
        const th = (a / 48) * Math.PI * 2;
        const x = r.pos.x + Math.cos(th) * rad, z = r.pos.z + Math.sin(th) * rad;
        const g = window.__ascent.islandAt(x, z);
        if (g === null) continue;
        const gap = Math.abs(g - (base ?? r.pos.y));
        if (gap < bg) { bg = gap; best = [x, g, z]; }
      }
    }
    return best && bg < 7 ? best : null;
  });
  if (spot) await walkTo(spot, 220);

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
    earned, sealed, answers, final: last, lowest: low.min,
    dist: await page.evaluate(() => {
      const p = window.__ascent.player.pos;
      const r = (window.__ascent.rifts.list || []).find((x) => !x.locked && !x.mastered);
      return r ? Math.round(Math.hypot(p.x - r.pos.x, p.z - r.pos.z)) : null;
    }),
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
