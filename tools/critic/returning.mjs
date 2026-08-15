/**
 * THE RETURNING CADET — twelve mornings, twelve real page loads.
 *
 * Every other probe in this directory moves the clock inside one page life with
 * `__ascent.advanceDays`, which is the right tool for the spacing schedule and
 * the wrong one for everything that is decided **at boot**: the day ledger, the
 * gap since the last session, the greeting, the nights-held beats, the day's
 * assay on ground income, and the descent's day record. All of those are read
 * out of localStorage when the page starts, and a harness that never restarts
 * the page never tests them.
 *
 * So this one shifts `Date.now` before the bundle runs and opens a fresh page
 * per morning, against the same origin and therefore the same save. It is the
 * closest thing to a real returning player that a machine can be.
 *
 * It reports, per morning: rank, chapter, nights held, what Marlow actually
 * said, and what the wallet took — so "a cadet should not reach Sovereign in
 * one afternoon" is answered by twelve mornings of evidence.
 *
 *   node tools/critic/returning.mjs --url http://127.0.0.1:4488 [--days 12]
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const DAYS = Number(arg('days', 12));
const FIRST = Number(arg('first', 120));
const PER = Number(arg('items', 26));
const DAY = 86400000;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const errors = [];

console.log('ASCENT — the returning cadet, one page load a morning');
console.log('  day  rank       ch  nights  depth  shards  said');

for (let d = 0; d < DAYS; d++) {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  // The whole page believes it is `d` days later. Everything that reads a clock
  // — the schedule, the day ledger, the assay — moves together, which is what
  // makes this a morning rather than a trick.
  await page.addInitScript((ms) => {
    const real = Date.now;
    Date.now = () => real() + ms;
  }, d * DAY);
  if (d === 0) await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(3000);

  await page.evaluate(async (count) => {
    const A = window.__ascent, m = A.mastery;
    for (let i = 0; i < count; i++) {
      const o = m.next(); if (!o) break;
      const task = m.taskFor(o.id); if (!task) break;
      const it = A.itemFor(task); if (!it) continue;
      m.observe(task.skill, true, {
        assisted: task.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: task.kind,
      });
      A.earn(task.scaffold !== 'none' ? 1 : 2, task.scaffold !== 'none' ? 'assist' : 'seal');
    }
    // …and a sweep of the island, paid through the real wallet with the real
    // reason on it, so the day's assay is exercised too.
    A.earn(120, 'cache');
    for (let i = 0; i < 60; i++) A.earn(6, 'vein');
    A.kit.sync();
  }, d === 0 ? FIRST : PER);

  // Let the channel talk: a beat queued on arrival is typed, not printed.
  await page.waitForTimeout(24000);
  const s = await page.evaluate(() => {
    const A = window.__ascent, st = A.story.state(), k = A.kit.sync();
    return {
      rank: st.rank, chapter: st.chapter, nights: st.nights, days: st.days,
      depth: k.depth, shards: A.state().shards, charters: k.charters,
      said: A.story.said().map((x) => x.tag).filter(Boolean),
      assay: A.ledger().length,
    };
  });
  const voice = s.said.filter((t) => /v\.night|v\.mile|story\.night|story\.day/.test(t));
  console.log(`  ${String(d + 1).padStart(3)}  ${s.rank.padEnd(9)}  ${s.chapter}   ${String(s.nights).padStart(6)}  ${String(s.depth).padStart(5)}  ${String(s.shards).padStart(6)}  ${voice.join(' ') || '—'}`);
  await page.close();
}

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 6)) console.log('   ' + e);
await browser.close();
process.exit(errors.length ? 1 : 0);
