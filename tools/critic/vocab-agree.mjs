/**
 * DO THE SURFACES AGREE? — one cold save per locale, every screen the disputed
 * nouns are printed on, harvested as text so three languages can be diffed
 * rather than eyeballed.
 *
 * The words under audit, and where each must land exactly once:
 *   RIFT      the ring, the only thing counted. "Tear" is the process, never a
 *             countable noun, and must not appear as one anywhere.
 *   MOTE      the currency. The island is a SHARD; the two must never collide.
 *   PLACE     the build verb. SEAL is the maths verb. Neither may be "set".
 *   LINES HELD "0 of 10" in the report; the dossier prints standing points and
 *             must therefore not use the same phrase for 0/90.
 *
 * Real keys, real clicks, cold localStorage. No teleportTo, no openRiftById.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4479');
const OUT = path.resolve(arg('out', 'shots/vocab-agree'));
const LOCS = (arg('locs', 'en,es,pl')).split(',');
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const notes = {};

const TEXT = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.offsetParent)
  .map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);

for (const loc of LOCS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private */ }
  }, loc);
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ loc, type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ loc, type: 'pageerror', text: e.message }));
  const shot = async (n, ms = 350) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${loc}-${n}.png`) }); };
  const grab = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((n) => n.offsetParent)
    .map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean), sel);

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(700);
  notes[loc] = {};

  // --- 1. the HUD, the build bar, and the kit strip ------------------------
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(400);
  notes[loc].hud = await grab('#rig');
  notes[loc].buildbar = await grab('#buildbar');
  notes[loc].kit = await grab('.kit-chip');
  await shot('01-hud', 400);

  // --- 2. the ledger strip: earn on foot, then take a levy ----------------
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
  for (let pass = 0; pass < 16 && (await motes()) < 14; pass++) {
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
    await walkTo(at, 22);
  }
  await page.evaluate(() => { if (window.__ascent.panel?.open) window.__ascent.panel.close(); });
  // close anything the wander opened, without Escape (which opens the menu)
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.offsetParent && /step back|paso atrás|krok wstecz/i.test(b.textContent))
    .forEach((b) => b.click()));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__ascent.levy(9));
  notes[loc].ledger = await grab('.led-row');
  notes[loc].motesAfterLevy = await motes();
  await shot('02-ledger', 260);

  // --- 3. the rift panel ---------------------------------------------------
  const first = await page.evaluate(() => {
    const r = (window.__ascent.rifts.list || []).find((x) => !x.locked && !x.mastered);
    return r ? [r.pos.x, r.pos.y, r.pos.z] : null;
  });
  if (first) {
    await walkTo([first[0], first[1], first[2] + 3], 190);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1400);
  }
  notes[loc].panel = await grab('.rf-badge, .rf-kind, #rf-gauge-label, .rf-socket .cap, .rf-key.commit, .rf-help');
  notes[loc].panelOpen = await page.evaluate(() => !!window.__ascent.panel?.open);
  await shot('03-rift', 500);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__ascent.panel?.close?.());
    await page.waitForTimeout(700);
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
  }

  // --- 4. the dossier (J) and the progress report (P) ---------------------
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(1200);
  notes[loc].standing = await grab('.st-row');
  await shot('04-dossier', 400);
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.offsetParent && /dossier|expediente|akta/i.test(b.textContent)).forEach((b) => b.click()));
  await page.waitForTimeout(700);

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(1200);
  notes[loc].report = (await page.evaluate(() => (document.body.innerText || '')
    .replace(/[ \t]+/g, ' '))).split('\n').filter(Boolean).slice(0, 26);
  await shot('05-progress', 400);
  await ctx.close();
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ notes, errors }, null, 2));
console.log(JSON.stringify(notes, null, 2));
console.log('console errors:', errors.length);
errors.slice(0, 8).forEach((e) => console.log('  !', e.loc, e.text.split('\n')[0]));
await browser.close();
process.exit(errors.length ? 2 : 0);
