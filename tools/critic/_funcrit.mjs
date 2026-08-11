/**
 * Independent critic probe. Drives the shipping game.
 *   1. GRIND: one unbroken sitting, 400 items, no clock movement.
 *   2. RETURN: many simulated days, playing what falls due each morning.
 * Reports kit ladder, depth, rank, charters, stations, chapters, caches,
 * Marlow's line, and takes real screenshots at the far end.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funcrit'));
const DAYS = Number(arg('days', 60));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const play = (n, correct = true) => page.evaluate(async ([count, ok]) => {
  const A = window.__ascent, m = A.mastery;
  let served = 0;
  for (let i = 0; i < count; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const item = A.itemFor(task); if (!item) continue;
    served++;
    m.observe(task.skill, ok, { assisted: task.scaffold !== 'none', form: item.form, rep: item.rep, scene: item.scene, kind: task.kind });
  }
  A.kit.sync?.();
  return served;
}, [n, correct]);

const read = () => page.evaluate(() => {
  const A = window.__ascent, s = A.state();
  const k = A.kit.state ? A.kit.state() : {};
  return {
    kit: k,
    watch: A.mastery.watch(),
    durable: A.mastery.durableCount(),
    rank: s.rank ?? s.rankName ?? null,
    shards: s.shards, seals: s.seals ?? s.sealed ?? null,
    hud: { chapter: s.chapter, chapterTitle: s.chapterTitle },
    caches: s.caches, session: s.session,
    marlow: document.querySelector('.comms-body, .comms .body, .comms p')?.textContent?.trim() || null,
    kitChips: [...document.querySelectorAll('.kit-chip')].map((b) => ({ id: b.dataset.id, hidden: getComputedStyle(b).display === 'none', text: b.innerText.replace(/\n/g, ' | ') })).filter((c) => !c.hidden),
  };
});

const log = [];
const say = (o) => { log.push(o); console.log(JSON.stringify(o)); };

// ---- 1. GRIND: one unbroken sitting -------------------------------------
const grindServed = await play(400);
const afterGrind = await read();
say({ phase: 'grind', served: grindServed, depth: afterGrind.kit.depth, durable: afterGrind.durable,
  held: afterGrind.kit.held, next: afterGrind.kit.next, lines: afterGrind.kit.lines,
  charters: afterGrind.kit.charters, rank: afterGrind.rank, shards: afterGrind.shards });

// ---- 2. RETURN: day after day -------------------------------------------
const trail = [];
for (let d = 1; d <= DAYS; d++) {
  await page.evaluate(() => window.__ascent.advanceDays(1));
  const served = await play(60);
  const st = await read();
  trail.push({ day: d, served, depth: st.kit.depth, durable: st.durable, held: (st.kit.held || []).length,
    next: st.kit.next && (st.kit.next.id || st.kit.next), charters: st.kit.charters,
    toCharter: st.kit.toCharter, stations: st.kit.stations, shards: st.shards, rank: st.rank,
    due: st.watch.due, held_lines: st.kit.lines });
}
say({ phase: 'return', trail });

const far = await read();
say({ phase: 'far', kit: far.kit, rank: far.rank, shards: far.shards, durable: far.durable,
  chips: far.kitChips, marlow: far.marlow, caches: far.caches, seals: far.seals });

// full HUD state dump at the far end
const fullState = await page.evaluate(() => { const s = window.__ascent.state(); delete s.skills; return s; });
say({ phase: 'state', state: fullState });

// ---- 3. can a charter actually buy a waystation? ------------------------
const buy = await page.evaluate(() => {
  const A = window.__ascent, k = A.kit;
  const before = k.state();
  // give shards the way the game does, if there is a hook; else just try
  const out = { before: { charters: before.charters, stations: before.stations, shards: A.state().shards } };
  out.tryStation = typeof k.use === 'function' ? k.use('station') : 'no-use-fn';
  out.after = { ...k.state(), shards: A.state().shards };
  return out;
});
say({ phase: 'station-buy', buy });

// ---- 4. screenshots at the far end --------------------------------------
await page.evaluate(() => { const a = window.__ascent; a.player.pos.set(0, 60, 120); a.player.pitch = -0.35; a.player.yaw = Math.PI; });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'far-vista.png') });
await page.evaluate(() => { const a = window.__ascent; a.player.pos.set(0, (a.player.groundAt?.(0, 26) ?? 12) + 0.4, 26); a.player.yaw = Math.PI; a.player.pitch = -0.1; });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'far-hud.png') });
// open progress report
await page.evaluate(() => document.querySelector('.progress-btn, [data-progress], .hud-progress')?.click());
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'far-progress.png') });

await writeFile(path.join(OUT, 'funcrit.json'), JSON.stringify({ log, errors }, null, 2));
console.log('errors:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e.split('\n')[0]));
await browser.close();
process.exit(0);
