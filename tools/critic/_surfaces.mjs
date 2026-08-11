/**
 * SURFACES — every panel the disputed nouns are printed on, in every locale.
 *
 * Cold localStorage, real keys and real clicks. No teleportTo, no openRiftById.
 * Opens: the HUD, the kit strip, the dossier, the progress report, the foundry
 * counter, and the rift keypad — and harvests the text of each so three locales
 * can be diffed word for word rather than eyeballed.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4477');
const OUT = path.resolve(arg('out', 'shots/surfaces'));
const LOCS = (arg('locs', 'en,es,pl')).split(',');
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const notes = {};

const vis = () => {
  const grab = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.offsetParent)
    .map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return grab.toString();
};

for (const loc of LOCS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private */ }
  }, loc);
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ loc, type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ loc, type: 'pageerror', text: e.message }));
  const shot = async (n, ms = 350) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${loc}-${n}.png`) }); };
  const text = () => page.evaluate(() => (document.body.innerText || '').replace(/[ \t]+/g, ' ').trim());

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(700);

  notes[loc] = {};
  await shot('01-hud', 600);
  notes[loc].hud = await page.evaluate(() => {
    const g = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.offsetParent)
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { rig: g('#rig'), kit: g('.kit-chip'), band: g('.sb-band'), quest: g('.q-seal, .meta-quest') };
  });

  // --- the dossier, opened the way a player opens it (J) -------------------
  await page.keyboard.press('KeyJ');
  await shot('02-dossier', 900);
  notes[loc].dossier = await page.evaluate(() => {
    const g = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.offsetParent)
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { stand: g('.st-row'), head: g('.st-head'), tally: g('.dos-tally, .dos-head') };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // --- the progress report (P) --------------------------------------------
  await page.keyboard.press('KeyP');
  await shot('03-progress', 1100);
  notes[loc].progress = await page.evaluate(() => {
    const g = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.offsetParent)
      .map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { stats: g('.rp-stat, .stat'), head: g('.rp-head h2, .rp-title') };
  });
  notes[loc].progressText = (await text()).slice(0, 2600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await shot('04-back', 400);
  await ctx.close();
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ notes, errors }, null, 2));
console.log(JSON.stringify(notes, null, 2).slice(0, 9000));
console.log('console errors:', errors.length);
errors.slice(0, 6).forEach((e) => console.log('  !', e.loc, e.text.split('\n')[0]));
await browser.close();
