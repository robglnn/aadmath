/**
 * SURGE + RUN BAND — the two vocabulary surfaces the first drive cannot reach.
 *
 * A surge only lands on somebody who is standing inside 34 m of a rift he has
 * NOT sealed, so this walks there on WASD and then simply stands still, which
 * is exactly the state the player was in when he went from nine motes to nought
 * with no idea why. Nothing here warps and nothing opens a rift by id.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/vocab-surge'));
const LOCS = (arg('locs', 'en,es,pl')).split(',');
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const notes = {};

for (const loc of LOCS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private */ }
  }, loc);
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ loc, type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ loc, type: 'pageerror', text: e.message }));
  const shot = async (n, ms = 300) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${loc}-${n}.png`) }); };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.click(W / 2, H / 2);

  // walk in on real keys
  for (let i = 0; i < 200; i++) {
    const g = await page.evaluate(() => window.__ascent.story?.guide?.() || null);
    if (g && g.metres <= 14) break;
    const turn = { ahead: 0, left: -190, right: 190, behind: 320 }[g?.where] ?? 0;
    if (turn) { await page.mouse.move(W / 2 + turn, H / 2, { steps: 3 }); await page.waitForTimeout(80); }
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(340);
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  }

  // Stand still and let the world push back. Harvest every toast the HUD flashes
  // and every line Marlow says, so the words can be read rather than guessed at.
  const seen = { flashes: new Set(), marlow: new Set() };
  let surgeShot = false;
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(700);
    const now = await page.evaluate(() => {
      const txt = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.offsetParent)
        .map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return {
        flash: txt('.hud-flash, .flash, .hud-toast, .toast, [class*="flash"]'),
        marlow: txt('.mw-line, .marlow .line, [class*="mw-"] p, .mw-body'),
        taught: window.__ascent.story?.guide?.()?.taught || [],
        motes: window.__ascent.state?.()?.shards ?? null,
      };
    });
    now.flash.forEach((f) => seen.flashes.add(f));
    now.marlow.forEach((m) => seen.marlow.add(m));
    if (!surgeShot && (now.taught.includes('surge') || now.flash.join(' ').match(/surge|sacudida|wyładowanie/i))) {
      surgeShot = true;
      await shot('surge', 60);
    }
    if (surgeShot && now.taught.includes('surge')) break;
  }
  await shot('stand', 200);
  notes[loc] = {
    taught: await page.evaluate(() => window.__ascent.story?.guide?.()?.taught || []),
    flashes: [...seen.flashes],
    marlow: [...seen.marlow],
  };
  await ctx.close();
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ notes, errors }, null, 2));
console.log(JSON.stringify(notes, null, 2));
console.log('console errors:', errors.length);
await browser.close();
process.exit(errors.length ? 2 : 0);
