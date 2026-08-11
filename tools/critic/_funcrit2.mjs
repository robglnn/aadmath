/**
 * Probe 2 — the endgame verbs, in the world, with the keyboard.
 * Restores the far-end save from probe 1's shape by playing + advancing days,
 * then presses H to raise waystations, presses H again to travel, opens the
 * report, checks caches, and photographs everything at three viewports.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funcrit2'));
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
const out = [];
const say = (o) => { out.push(o); console.log(JSON.stringify(o)); };

const play = (n) => page.evaluate(async (count) => {
  const A = window.__ascent, m = A.mastery;
  let served = 0;
  for (let i = 0; i < count; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const item = A.itemFor(task); if (!item) continue;
    served++;
    m.observe(task.skill, true, { assisted: task.scaffold !== 'none', form: item.form, rep: item.rep, scene: item.scene, kind: task.kind });
  }
  A.kit.sync?.();
  return served;
}, n);

// --- get to the far end: hold everything, then eight days of returns ---
await play(300);
for (let d = 0; d < 8; d++) { await page.evaluate(() => window.__ascent.advanceDays(1)); await play(60); }
await page.waitForTimeout(2500);
// let every queued narrative beat drain before we judge any frame
await page.waitForTimeout(12000);
say({ at: 'far', kit: await page.evaluate(() => window.__ascent.kit.state()), shards: await page.evaluate(() => window.__ascent.state().shards) });

// --- press H: raise a waystation ---
await page.mouse.click(800, 450);
await page.waitForTimeout(300);
const before = await page.evaluate(() => ({ ...window.__ascent.kit.state(), shards: window.__ascent.state().shards, pos: [...window.__ascent.player.pos.toArray()] }));
await page.keyboard.press('KeyH');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'a-station-raised.png') });
const after = await page.evaluate(() => ({ ...window.__ascent.kit.state(), shards: window.__ascent.state().shards }));
say({ act: 'raise-station', beforeStations: before.stations, afterStations: after.stations,
  beforeCharters: before.charters, afterCharters: after.charters,
  beforeShards: before.shards, afterShards: after.shards, priceNext: after.prices?.station,
  flash: await page.evaluate(() => document.querySelector('.flash, .hud-flash, .toast')?.textContent?.trim() || null) });

// walk away and raise a second one
await page.evaluate(() => { const a = window.__ascent; a.player.pos.set(120, (a.player.groundAt?.(120, -80) ?? 30) + 1, -80); a.player.vel.set(0, 0, 0); });
await page.waitForTimeout(900);
await page.keyboard.press('KeyH');
await page.waitForTimeout(1200);
const after2 = await page.evaluate(() => ({ ...window.__ascent.kit.state(), shards: window.__ascent.state().shards, pos: [...window.__ascent.player.pos.toArray()] }));
say({ act: 'raise-station-2', stations: after2.stations, charters: after2.charters, shards: after2.shards, pos: after2.pos });
await page.screenshot({ path: path.join(OUT, 'b-station-2.png') });

// press H standing at it: does it travel?
await page.keyboard.press('KeyH');
await page.waitForTimeout(1400);
const travelled = await page.evaluate(() => [...window.__ascent.player.pos.toArray()]);
say({ act: 'travel', from: after2.pos, to: travelled, moved: Math.hypot(travelled[0] - after2.pos[0], travelled[2] - after2.pos[2]) });
await page.screenshot({ path: path.join(OUT, 'c-travel.png') });

// --- the report a teacher/student reads ---
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, [role=button]')].find((x) => /progress/i.test(x.textContent || ''));
  if (b) { b.click(); return b.textContent.trim(); } return null;
});
await page.waitForTimeout(1400);
await page.screenshot({ path: path.join(OUT, 'd-report.png'), fullPage: false });
say({ act: 'report', opened, hasPanel: await page.evaluate(() => !!document.querySelector('.report, .report-panel, #report')) });
// scroll the report
await page.mouse.wheel(0, 900); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'e-report-2.png') });
await page.mouse.wheel(0, 1200); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'f-report-3.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// --- caches: do they come back? ---
const cacheInfo = await page.evaluate(() => {
  const A = window.__ascent;
  return { state: A.caches.state?.(), keys: Object.keys(A.caches) };
});
say({ act: 'caches', cacheInfo });

// --- what does the world offer now? the objective + Marlow ---
const worldNow = await page.evaluate(() => ({
  objective: document.querySelector('.objective')?.innerText?.replace(/\n/g, ' | ') || null,
  chapter: document.querySelector('.standing, .chapter')?.innerText?.replace(/\n/g, ' | ') || null,
  comms: document.querySelector('.comms')?.innerText?.replace(/\n/g, ' | ') || null,
  hud: document.querySelector('.hud-top, .integrity')?.innerText?.replace(/\n/g, ' | ') || null,
}));
say({ act: 'world-now', worldNow });

// --- narrow + phone at the far end (clipping check) ---
for (const [w, h, name] of [[1280, 720, 'g-1280'], [1600, 900, 'h-1600'], [414, 896, 'i-414'], [390, 844, 'j-390']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  // open a rift at this size too
  await page.evaluate(() => window.__ascent.openRiftById('both-sides'));
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(OUT, name + '-rift.png') });
  await page.evaluate(() => window.__ascent.panel.close());
  await page.waitForTimeout(300);
}
await page.setViewportSize({ width: 1600, height: 900 });

// --- overflow audit at the far end ---
const clip = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
    if (!el.children.length && el.textContent.trim()) {
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.textOverflow !== 'clip') bad.push({ t: el.textContent.trim().slice(0, 40), c: el.className, sw: el.scrollWidth, cw: el.clientWidth });
      if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden') bad.push({ t: el.textContent.trim().slice(0, 40), c: el.className, sh: el.scrollHeight, ch: el.clientHeight });
    }
    const r = el.getBoundingClientRect();
    if (r.width > 4 && (r.right > innerWidth + 2 || r.left < -2)) bad.push({ t: (el.textContent || '').trim().slice(0, 30), c: el.className, left: Math.round(r.left), right: Math.round(r.right) });
  }
  return bad.slice(0, 20);
});
say({ act: 'clip', clip });

await writeFile(path.join(OUT, 'funcrit2.json'), JSON.stringify({ out, errors }, null, 2));
console.log('errors:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e.split('\n')[0]));
await browser.close();
process.exit(0);
