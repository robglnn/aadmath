/**
 * THE SCREEN THAT ENDS A SESSION, IN EVERY STATE IT HAS.
 *
 * A blind critic: *"the three things that actually keep going — the next
 * charter, the waystation, the sounding — are never named by the screen that
 * ends a session."* They were written, and printed only after the tenth line
 * was held. This drives the real session to its real close in four states and
 * photographs the card, in all three locales, so what the block says is read
 * off pixels rather than off a promise.
 *
 *   first     a first sitting: a line still open, nothing held overnight
 *   returning a second morning, with re-probes fallen due
 *   charter   a line still open AND a charter in hand — the case that used to
 *             print nothing about the charter at all
 *   whole     every line held: the descent, the charter and the waystation
 *
 *   node tools/critic/closecard.mjs --url http://127.0.0.1:4488 --out shots/close
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/close'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);

/** Get the session into its work phase, the way the charter card does. */
async function work() {
  const phase = await page.evaluate(() => window.__ascent.session.state().phase);
  if (phase === 'work') return;
  await page.evaluate(() => window.__ascent.session.plan());
  await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.locator('.sc-go').click();
  await page.waitForTimeout(700);
}

const play = (n) => page.evaluate(async (count) => {
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
  A.kit.sync();
}, n);

/** Close the run for real, photograph the card, and read the NEXT block back. */
async function card(name) {
  await page.evaluate(() => window.__ascent.session.skipToClose());
  await page.waitForTimeout(2600);
  const rows = await page.evaluate(() => {
    const sec = document.querySelector('.sx-next');
    const on = document.querySelector('.ses-close.show');
    return {
      shown: !!on,
      label: sec?.querySelector('h3')?.textContent || '',
      rows: [...(sec?.querySelectorAll('li') || [])].map((li) => ({
        strong: li.querySelector('b')?.textContent || '', note: li.querySelector('span')?.textContent || '',
      })),
    };
  });
  console.log(`\n${name}: ${rows.label}${rows.shown ? '' : '   (CARD NOT ON SCREEN)'}`);
  for (const r of rows.rows) console.log(`   · ${r.strong} — ${r.note}`);
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${name}-${loc}.png`) });
  }
  await page.evaluate(() => window.__ascent.setLocale('en'));
  // Stand down, so the next state starts from a live run rather than a card.
  /* Stand down for real: the close card hands over to the rest beat, the rest
     beat has a skip and then an "again" button, and the next state has to start
     from a live run rather than from a dialog nobody dismissed. */
  await page.evaluate(() => document.querySelector('.sx-rest')?.click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('.sr-skip')?.click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('.sr-again')?.click());
  await page.waitForTimeout(1600);
  return rows;
}

// 1. a first sitting
await work();
await play(14);
await card('first');

// 2. a second morning, with re-probes due
await page.evaluate(() => window.__ascent.advanceDays(1));
await work();
await play(10);
await card('returning');

// 3. a charter in hand with a line still open — depth is lines plus durable
//    re-probes, so this is a real state and it used to print nothing.
await work();
for (let d = 0; d < 14; d++) {
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await play(26);
}
await page.waitForTimeout(1500);
await card('whole');

// 4. a charter in hand. The row that says a waystation is waiting to be placed
//    only exists when one actually is.
await work();
for (let d = 0; d < 12; d++) {
  const c = await page.evaluate(() => window.__ascent.kit.sync().charters);
  if (c > 0) break;
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await play(26);
}
await page.waitForTimeout(1200);
await card('charter');

console.log(`\nkit at the end: ${JSON.stringify(await page.evaluate(() => {
  const k = window.__ascent.kit.sync();
  return { lines: k.lines, depth: k.depth, charters: k.charters, stations: k.stations, sounding: k.sounding.best, affordable: k.affordable, shards: window.__ascent.state().shards };
}))}`);
console.log(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 6)) console.log('   ' + e);
console.log(`shots in ${OUT}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
