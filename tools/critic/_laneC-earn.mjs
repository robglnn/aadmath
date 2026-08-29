#!/usr/bin/env node
/**
 * WHAT PAYS BETTER — running, or answering? (lane C, P1: the inverted economy)
 *
 * Two arms, each from a cleared save, each on real keys, each reading nothing
 * but facts off `window.__ascent`:
 *
 *   --mode run    the cadet sprints and never answers a single question. What
 *                 the island hands over for nothing.
 *   --mode play   the cadet walks to the objective the game itself paints
 *                 (`__ascent.objective()`, the read-only fact) and answers.
 *
 * The figure both arms report is `wallet.count()` — the balance a player
 * actually holds — plus the day's ground yield (`wallet.assay().took`) so the
 * two halves of the income can be told apart.
 *
 *   node tools/critic/_laneC-earn.mjs --url http://127.0.0.1:4173 --mode run --minutes 7
 *
 * This is an instrument, not a gate. It has no bar and it refuses nothing.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const MODE = arg('mode', 'run');
const MINUTES = Number(arg('minutes', 7));
const OUT = path.resolve(arg('out', 'shots/laneC-earn-' + MODE));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2400);
await page.mouse.click(640, 360);

const purse = () => page.evaluate(() => {
  const a = window.__ascent;
  const w = a.wallet || a.kit?.wallet || null;
  let assay = null, hist = [];
  try { assay = w.assay(); } catch { assay = null; }
  try { hist = w.history(); } catch { hist = []; }
  return { motes: w ? w.count() : 0, assay, hist };
});
const facts = () => page.evaluate(() => {
  const a = window.__ascent;
  const p = a.player.pos;
  const pi = a.panelInfo();
  return { x: p.x, y: p.y, z: p.z, yaw: a.player.yaw, panel: !!pi.open,
    answer: pi.open ? String(pi.answer) : null, ui: !!a.input.uiOpen, stuck: !!a.player.stuck };
});
const release = async () => {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ArrowLeft', 'ArrowRight', 'Space']) {
    await page.keyboard.up(k).catch(() => {});
  }
};
const handBack = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(280);
  }
  return false;
};

// -------------------------------------------------------------- the tally
// Every movement the ledger recorded, merged out of its rolling log. The log
// holds 24 rows, so it is polled fast enough that a run through a lit vein
// cannot overflow it between two reads.
const seen = new Map();
async function drain() {
  const { hist } = await purse();
  for (const h of hist) {
    const k = `${h.at}|${h.why}|${h.delta}|${h.left}`;
    if (!seen.has(k)) seen.set(k, h);
  }
}
const bySource = () => {
  const by = {};
  for (const h of seen.values()) {
    if (h.delta <= 0) continue;
    by[h.why] = (by[h.why] || 0) + h.delta;
  }
  return by;
};

const t0 = Date.now();
let items = 0;
/* A MARK AT SEVEN MINUTES, so the same run answers both questions: what the
   island hands over in the first seven minutes (which is mostly one-off finds
   — a waygate, a survey mark, a first sweep of the veins) and what a whole
   sitting of it is worth once the day's assay has had its say. */
const marks = [];
let markedAt = 0;
async function mark() {
  const mins = Math.floor((Date.now() - t0) / 60000);
  if (mins <= markedAt) return;
  markedAt = mins;
  if (mins !== 7 && mins !== 15) return;
  const p = await purse();
  marks.push({ minutes: mins, motes: p.motes, items });
}

if (MODE === 'run') {
  // A LAP. Hold sprint, sweep the yaw so the route is a loop over the island
  // rather than a line off the coast, and never touch the interact key.
  let leg = 0;
  await page.keyboard.down('ShiftLeft');
  while (Date.now() - t0 < MINUTES * 60000) {
    await handBack();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1200);
    await drain();
    await mark();
    const f = await facts();
    // Turn back in when the coast is near, and otherwise wander.
    const r = Math.hypot(f.x, f.z);
    const turnBack = r > 130;
    const k = turnBack ? (leg % 2 ? 'ArrowLeft' : 'ArrowRight') : (leg % 3 === 0 ? 'ArrowRight' : 'ArrowLeft');
    await page.keyboard.down(k);
    await page.waitForTimeout(turnBack ? 640 : 210);
    await page.keyboard.up(k);
    if (leg % 5 === 2) { await page.keyboard.press('Space'); }
    if (f.stuck) { await release(); await page.keyboard.press('KeyR'); await page.waitForTimeout(600); await page.keyboard.down('ShiftLeft'); }
    leg++;
  }
  await release();
} else {
  // THE OBJECTIVE THE GAME PAINTS. `__ascent.objective()` is the same answer
  // src/meta/guide.js draws the card from — read for a fact, walked on keys.
  const objective = () => page.evaluate(() => {
    const a = window.__ascent;
    const o = a.objective?.();
    if (o) return { id: o.id, x: o.x, z: o.z, verb: o.verb };
    const pick = a.rifts.list.find((x) => !x.locked && !x.mastered) || a.rifts.list[0];
    return pick ? { id: pick.id, x: (pick.foot || pick.pos).x, z: (pick.foot || pick.pos).z, verb: 'seal' } : null;
  });
  async function walkTo(target, budgetMs) {
    const s0 = Date.now();
    let held = false;
    while (Date.now() - s0 < budgetMs) {
      await drain();
      const f = await facts();
      if (f.panel) { if (held) await page.keyboard.up('KeyW'); return 'panel'; }
      if (f.ui) { if (held) { await page.keyboard.up('KeyW'); held = false; } await handBack(); continue; }
      if (f.stuck) { await release(); await page.keyboard.press('KeyR'); await page.waitForTimeout(700); held = false; continue; }
      const dx = target.x - f.x, dz = target.z - f.z;
      if (Math.hypot(dx, dz) < 5) { if (held) await page.keyboard.up('KeyW'); return 'arrived'; }
      let d = ((Math.atan2(dx, dz) - f.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      if (!held) { await page.keyboard.down('KeyW'); held = true; }
      if (Math.abs(d) > 0.10) {
        const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(360, Math.max(50, Math.abs(d) / 2.6 * 1000)));
        await page.keyboard.up(key);
      } else { await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(150); }
    }
    if (held) await page.keyboard.up('KeyW');
    return 'timeout';
  }
  async function answer() {
    const f = await facts();
    if (!f.panel || !f.answer) return false;
    const opts = await page.$$('.rf-reading');
    if (opts.length) {
      const want = f.answer.replace(/\s+/g, '');
      let pick = null;
      for (const o of opts) {
        const v = await o.getAttribute('data-value');
        if (v != null && String(v).replace(/\s+/g, '') === want) { pick = o; break; }
      }
      await (pick || opts[0]).click().catch(() => {});
    } else if (await page.$('.rf-chip:not([disabled])')) {
      for (let k = 0; k < 12; k++) {
        const chip = await page.$('.rf-chip:not([disabled]):not(.placed)');
        if (!chip) break;
        const txt = ((await chip.innerText().catch(() => '')) || '').trim();
        const wantVar = /[A-Za-z]/.test(txt);
        await chip.click().catch(() => {});
        await page.waitForTimeout(90);
        const bay = await page.$(`.rf-bay[data-kind="${wantVar ? 'var' : 'num'}"]`)
          || (await page.$$('.rf-bay'))[wantVar ? 0 : 1] || (await page.$$('.rf-bay'))[0];
        if (!bay) break;
        await bay.click().catch(() => {});
        await page.waitForTimeout(160);
        if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
      }
    } else if (await page.$('.rf-move, .rf-cell, .ans')) {
      await (await page.$('.rf-move, .rf-cell, .ans')).click().catch(() => {});
    } else {
      for (const ch of f.answer) {
        if (ch === '-') await page.keyboard.press('Minus');
        else if (ch === '/') await page.keyboard.press('Slash');
        else if (ch === '.') await page.keyboard.press('Period');
        else await page.keyboard.press(ch).catch(() => {});
        await page.waitForTimeout(35);
      }
      await page.keyboard.press('Enter');
    }
    items++;
    await page.waitForTimeout(1200);
    return true;
  }
  while (Date.now() - t0 < MINUTES * 60000) {
    await handBack();
    await drain();
    await mark();
    const target = await objective();
    if (!target) { await page.waitForTimeout(400); continue; }
    const got = await walkTo(target, 60000);
    if (got === 'arrived') {
      for (const k of ['KeyE', 'Enter']) {
        await page.keyboard.press(k);
        await page.waitForTimeout(420);
        if (await page.evaluate(() => !!window.__ascent.panel?.open)) break;
      }
    }
    await release();
    for (let n = 0; n < 8; n++) {
      if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
      if (!(await answer())) break;
      await drain();
      await page.waitForTimeout(400);
      if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(500);
      }
    }
    await handBack();
  }
}

await drain();
const end = await purse();
const by = bySource();
const secs = Math.round((Date.now() - t0) / 1000);
const total = Object.values(by).reduce((a, b) => a + b, 0);
const out = {
  url: URL, mode: MODE, minutes: MINUTES, seconds: secs,
  motes: end.motes, itemsAnswered: items, marks,
  groundTakenToday: end.assay ? end.assay.took : null,
  assayRate: end.assay ? end.assay.rate : null,
  bySource: by, loggedTotal: total, movements: seen.size, errors: errors.slice(0, 5),
};
console.log(JSON.stringify(out, null, 1));
console.log(`\n  ${MODE.toUpperCase()}  ${secs}s -> ${end.motes} motes  (${(end.motes / Math.max(1, secs / 60)).toFixed(1)} a minute)`
  + `${items ? `, ${items} items answered` : ', no questions answered'}`);
console.log(`  by source: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join('  ') || 'none logged'}`);
for (const m of marks) console.log(`  at ${m.minutes} min: ${m.motes} motes, ${m.items} items answered`);
await writeFile(path.join(OUT, 'earn.json'), JSON.stringify(out, null, 1));
await browser.close();
process.exit(0);
