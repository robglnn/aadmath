/**
 * DIAGNOSIS ONLY — what is materially different on day N?
 *
 * This is not a gate and it is not evidence. It uses the debug API to move a
 * save forward quickly, so that a builder can see the SHAPE of fifteen days
 * before deciding what to build. Every claim this wave makes is proved
 * afterwards by tools/critic/week.mjs, which presses real keys.
 *
 *   node tools/critic/_w16diag.mjs --url http://127.0.0.1:4488 --days 15
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4488');
const DAYS = Number(arg('days', 15));
const PER = Number(arg('items', 30));
const FIRST = Number(arg('first', 150));
const DAY = 86400000;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const errors = [];
const rows = [];

for (let d = 0; d < DAYS; d++) {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`d${d + 1}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`d${d + 1}: ${e.message}`));
  await page.addInitScript((ms) => { const real = Date.now; Date.now = () => real() + ms; }, d * DAY);
  if (d === 0) await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(3200);

  const earned = await page.evaluate(async (count) => {
    const A = window.__ascent, m = A.mastery;
    const before = A.state().shards;
    for (let i = 0; i < count; i++) {
      const o = m.next(); if (!o) break;
      const task = m.taskFor(o.id); if (!task) break;
      const it = A.itemFor(task); if (!it) continue;
      m.observe(task.skill, true, {
        assisted: task.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: task.kind,
      });
      A.earn(task.scaffold !== 'none' ? 1 : 2, task.scaffold !== 'none' ? 'assist' : 'seal');
    }
    // a full sweep of the island's free income, to exercise the day's assay
    A.earn(140, 'cache');
    for (let i = 0; i < 90; i++) A.earn(6, 'vein');
    A.kit.sync();
    return A.state().shards - before;
  }, d === 0 ? FIRST : PER);

  // The orders card owns the frame for the first few seconds of a returning
  // morning, and every verb the kit owns is deliberately as quiet under it as
  // it is under a rift. So the card is dismissed the way a player dismisses it
  // before anything is bought — otherwise `station()` refuses and the table
  // reports an economy that was never asked a question.
  await page.locator('.ses-charter.show .sc-go').click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);

  // …and the cadet buys what they can, the way a player who wants the network
  // does: press the kit's own H path whenever a charter and the price are both
  // in hand. Nothing is granted; `station()` refuses if either is short.
  const buy = await page.evaluate(() => {
    const A = window.__ascent;
    const log = [];
    for (let i = 0; i < 4; i++) {
      const k = A.kit.state();
      if (!(k.held || []).includes('station')) { log.push('no licence yet'); break; }
      if (k.charters <= 0) { log.push('no charter'); break; }
      if (A.state().shards < k.prices.station) { log.push(`short: ${A.state().shards} < ${k.prices.station}`); break; }
      A.player.pos.set(40 + i * 34, A.player.pos.y, 40 + i * 26);
      const ok = A.kit.station();
      log.push(ok ? `raised @${k.prices.station}` : 'refused (a beat owns the frame)');
      if (!ok) break;
    }
    return log;
  });
  await page.waitForTimeout(400);
  if (buy.length) console.log(`      wallet: ${buy.join(' · ')}`);

  // …and the run closes, the way a session does, so an order is laid.
  await page.evaluate(() => { try { window.__ascent.session.plan(); } catch {} });
  await page.waitForTimeout(500);
  await page.evaluate(() => { try { window.__ascent.session.close(); } catch {} });
  await page.waitForTimeout(2000);

  // What the close card would say, off the real session report.
  const s = await page.evaluate(() => {
    const A = window.__ascent, st = A.story.state(), k = A.kit.sync();
    const ses = A.session?.state?.() || {};
    let watch = null; try { watch = A.mastery.watch?.() || null; } catch { /* */ }
    return {
      rank: st.rank, chapter: st.chapter, nights: st.nights, days: st.days,
      depth: k.depth, lines: k.lines, charters: k.charters, stations: k.stations,
      toCharter: k.toCharter, price: k.prices?.station ?? null,
      shards: A.state().shards,
      grants: (k.held || []).slice(),
      sounding: watch?.sounding?.best || 0,
      due: watch?.due || 0,
      phase: ses.phase,
      order: st.order,
      mark: k.mark,
      said: A.story.said().map((x) => x.tag).filter(Boolean).slice(-6),
    };
  });
  rows.push({ day: d + 1, earned, ...s });
  console.log(`day ${String(d + 1).padStart(2)}  rank ${String(s.rank).padEnd(9)} ch${s.chapter}  nights ${String(s.nights).padStart(2)}  depth ${String(s.depth).padStart(3)}  lines ${String(s.lines).padStart(2)}  chart ${s.charters}  stn ${s.stations}  toChart ${String(s.toCharter).padStart(2)}  price ${String(s.price).padStart(4)}  shards ${String(s.shards).padStart(6)} (+${String(earned).padStart(4)})  sound ${s.sounding}  mark ${s.mark ? 'UP' : '--'}  kept ${s.order?.kept ?? 0}  grants ${s.grants.length}`);
  await page.close();
}

console.log('\n--- what is NEW on each day (vs the day before) ---');
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], b = rows[i];
  const diff = [];
  if (b.rank !== a.rank) diff.push(`rank -> ${b.rank}`);
  if (b.chapter !== a.chapter) diff.push(`chapter -> ${b.chapter}`);
  if (b.grants.length !== a.grants.length) diff.push(`new grant(s): ${b.grants.filter((g) => !a.grants.includes(g)).join(',')}`);
  if (b.charters !== a.charters) diff.push(`charters ${a.charters} -> ${b.charters}`);
  if (b.price !== a.price) diff.push(`station price ${a.price} -> ${b.price}`);
  if (b.lines !== a.lines) diff.push(`lines ${a.lines} -> ${b.lines}`);
  if ((b.order?.kept ?? 0) !== (a.order?.kept ?? 0)) diff.push(`mark cleared (${a.order?.kept ?? 0} -> ${b.order?.kept ?? 0})`);
  if (b.stations !== a.stations) diff.push(`waystations ${a.stations} -> ${b.stations}`);
  console.log(`  day ${String(b.day).padStart(2)}: ${diff.length ? diff.join(' · ') : 'NOTHING — same lattice, same ladder, same price'}`);
}
console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('   ' + e);
await browser.close();
