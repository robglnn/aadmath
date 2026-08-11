/**
 * VOCABULARY DRIVE — fresh save, real keyboard and mouse only.
 *
 * The one thing this file must never do is call `openRiftById` or `teleportTo`.
 * The words under test ("rift", "cipher mote", the surge, the locked kit chip)
 * are the words a cold player meets by walking at the world, and a harness that
 * warps past the walk photographs a game nobody plays.
 *
 *   node tools/critic/vocab.mjs --url http://127.0.0.1:PORT --out shots/vocab
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/vocab'));
const LOCS = (arg('locs', 'en,es,pl')).split(',');
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const logs = [];
const shots = [];
const notes = {};

for (const loc of LOCS) {
  // A whole new context per locale: no cookies, no localStorage, no save.
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private */ }
  }, loc);
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ loc, type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ loc, type: 'pageerror', text: e.message }));

  const shot = async (name, ms = 350) => {
    await page.waitForTimeout(ms);
    const f = path.join(OUT, `${loc}-${name}.png`);
    await page.screenshot({ path: f });
    shots.push(f);
    return f;
  };
  const st = () => page.evaluate(() => window.__ascent.state());

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2600);

  // Real hands: click to take the pointer, dismiss whatever the opening shows.
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(600);
  await shot('01-first-frame', 700);

  // The orders card, if the session opened one: press its button like a player.
  const begun = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => x.offsetParent && /begin|comenzar|empez|zaczyn|rozpocz/i.test(x.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    return null;
  });
  notes[loc] = { begun };
  await page.waitForTimeout(700);
  await shot('02-hud', 500);

  // ---- walk to the rift the objective card is pointing at, on WASD only ----
  let reached = false;
  for (let i = 0; i < 260 && !reached; i++) {
    const g = await page.evaluate(() => window.__ascent.story?.guide?.() || null);
    if (!g) { await page.waitForTimeout(120); continue; }
    if (g.metres <= 10) { reached = true; break; }
    // Turn toward it with the mouse, exactly as a hand would.
    const turn = { ahead: 0, left: -190, right: 190, behind: 320 }[g.where] ?? 0;
    if (turn) { await page.mouse.move(W / 2 + turn, H / 2, { steps: 3 }); await page.waitForTimeout(90); }
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(360);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    if (i % 9 === 8) await page.keyboard.press('Space');
  }
  const g1 = await page.evaluate(() => window.__ascent.story?.guide?.() || null);
  notes[loc].walk = { reached, guide: g1 };
  await shot('03-at-rift', 600);

  // ---- open it on the interact key, not on an API --------------------------
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  const opened = await page.evaluate(() => !!document.querySelector('.rf-wrap, .rift, .rf-panel'));
  notes[loc].opened = opened;
  await shot('04-rift-panel', 800);

  // A deliberately wrong answer — the echo must survive untouched.
  await page.evaluate(() => {
    const p = window.__ascent.panel;
    const btns = [...document.querySelectorAll('.ans')].filter((b) => b.offsetParent);
    const bad = btns.find((b) => !b.textContent.trim().startsWith(String(p?.item?.answer ?? '')));
    if (bad) bad.click(); else p?.demo?.('wrong');
  });
  await shot('05-echo', 1100);

  const s = await st();
  notes[loc].state = { tears: s?.tears, lines: s?.lines, chapter: s?.chapter };

  // Everything the words live on, harvested as text so a diff can be read.
  notes[loc].text = await page.evaluate(() => {
    const grab = (sel) => [...document.querySelectorAll(sel)]
      .filter((n) => n.offsetParent).map((n) => n.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return {
      hud: grab('.hud, .rig, .q-seal, .sb-band, .gd-card, .kit-strip, .kit, .meta-quest'),
      body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000),
    };
  });

  await page.evaluate(() => window.__ascent.panel?.close?.());
  await page.waitForTimeout(500);
  await shot('06-after-close', 700);
  await ctx.close();
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ notes, errors, shots }, null, 2));
console.log(JSON.stringify(notes, null, 2).slice(0, 6000));
console.log('console errors:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  !', e.loc, e.text.split('\n')[0]));
await browser.close();
process.exit(errors.length ? 2 : 0);
