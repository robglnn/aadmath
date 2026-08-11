/**
 * Capture the progress report against the REAL running game.
 *
 * The report is only worth looking at when it has something to report, so this
 * harness plays the actual learning loop first — it opens real rifts, reads the
 * real generated item off the real panel, and types the real answer through the
 * same `enter()` path a hand would. Nothing is stubbed and the mastery engine is
 * never poked directly, so what the report then prints is what a learner would
 * have earned.
 *
 * It deliberately answers a handful of items *wrong* as well. A progress screen
 * that has only ever been photographed on a perfect run has not been tested: the
 * interesting states — a claim slipping, a claim withdrawn, a proving run that
 * failed — only exist after a miss.
 *
 *   node tools/critic/report-shots.mjs --url http://127.0.0.1:4321 --out shots/report
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};

const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/report'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));

const shots = [];
async function shot(name, ms = 260) {
  await page.waitForTimeout(ms);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
  return f;
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2600);

/**
 * Take whatever another area has put on the glass back off it.
 *
 * Several builders own overlays in this tree — the session charter, the rest
 * beat, the cold open — and a report photographed underneath one proves nothing
 * about the report. They are hidden through their own `hide()`, not by clicking
 * their buttons: as of this writing the session's own begin button leads to a
 * throw inside `rest._finish()` (`this.again` is null), which would fill this
 * harness's console log with somebody else's defect and hide any of our own.
 */
async function clearOverlays() {
  await page.evaluate(() => {
    window.__ascent.session?.charter?.hide?.();
    for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) {
      el.classList.remove('show');
    }
    // `.ses-cine` is what steps the rest of the HUD back while a session beat
    // owns the frame — including this report's own launcher, correctly. Hiding
    // the beat without clearing it would photograph a HUD that a player never
    // sees in that state.
    document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  });
  await page.waitForTimeout(320);
}
await clearOverlays();

// ---------------------------------------------------------------------------
// Play the real loop.
// ---------------------------------------------------------------------------
/**
 * Answer `n` items on whatever the scheduler thinks is most useful right now.
 * `wrongEvery` makes every k-th answer a deliberate miss, so the report gets to
 * show a slip, a failed proving run and a withdrawn claim rather than only the
 * happy path.
 */
async function play(n, wrongEvery = 0) {
  return page.evaluate(async ({ n, wrongEvery }) => {
    const A = window.__ascent;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let answered = 0, wrong = 0;
    for (let i = 0; i < n; i++) {
      const nx = A.nextObjective();
      if (!nx) break;
      if (A.panel.open) A.panel.close();
      await sleep(30);
      if (!A.openRiftById(nx.id)) break;
      await sleep(60);
      const item = A.panel.item;
      if (!item) break;
      const miss = wrongEvery && (i % wrongEvery === wrongEvery - 1);
      if (miss) { A.panel.demo('wrong'); wrong++; } else { A.enter(item.answer); }
      answered++;
      await sleep(70);
      if (A.panel.open) A.panel.close();
      await sleep(40);
    }
    return { answered, wrong, state: A.report.snapshot() };
  }, { n, wrongEvery });
}

/**
 * Forget something.
 *
 * A progress screen photographed only on a perfect run is not evidence that the
 * screen works — the states that matter to a teacher (a claim slipping, a claim
 * withdrawn) exist only after a learner misses a cold re-probe twice. So this
 * pass answers scheduled re-probes wrong until the engine takes a claim back,
 * which is a thing real learners do and the report has to survive.
 */
async function forget(maxItems) {
  return page.evaluate(async (max) => {
    const A = window.__ascent;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let missed = 0;
    for (let i = 0; i < max; i++) {
      const nx = A.nextObjective();
      if (!nx) break;
      if (A.panel.open) A.panel.close();
      await sleep(30);
      if (!A.openRiftById(nx.id)) break;
      await sleep(60);
      if (!A.panel.item) break;
      A.panel.demo('wrong');
      missed++;
      await sleep(70);
      if (A.panel.open) A.panel.close();
      await sleep(40);
      if (A.report.snapshot().withdrawn >= 2) break;
    }
    return { missed, state: A.report.snapshot() };
  }, maxItems);
}

const first = await play(150, 7);
const second = await play(150, 11);
const third = await forget(40);
const played = {
  answered: first.answered + second.answered + third.missed,
  wrong: first.wrong + second.wrong + third.missed,
};
const snap = third.state;

// ---------------------------------------------------------------------------
// Desktop
// ---------------------------------------------------------------------------
await page.evaluate(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
await clearOverlays();
await shot('00-world-with-launcher', 600);

await page.evaluate(() => window.__ascent.report.show());
await shot('01-report-en', 700);

// expand the three most interesting lines
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.rp-skill')];
  const pick = (state) => rows.find((r) => r.dataset.state === state);
  for (const st of ['mastered', 'withdrawn', 'provisional', 'practising', 'locked']) {
    pick(st)?.querySelector('.rp-row')?.click();
  }
});
await shot('02-report-en-evidence', 500);

await page.evaluate(() => document.querySelector('.rp-body').scrollTo(0, 99999));
await shot('03-report-en-foot', 400);

for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => {
    window.__ascent.setLocale(l);
    document.querySelector('.rp-body').scrollTo(0, 0);
  }, loc);
  await shot(`04-report-${loc}`, 600);
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.rp-skill')];
    rows.find((r) => r.dataset.state === 'mastered')?.querySelector('.rp-row')?.click();
  });
  await shot(`05-report-${loc}-evidence`, 500);
}
await page.evaluate(() => window.__ascent.setLocale('en'));

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(700);
await page.evaluate(() => {
  document.documentElement.dataset.touch = '1';
  if (!window.__ascent.report.open) window.__ascent.report.show();
  document.querySelector('.rp-body')?.scrollTo(0, 0);
});
await shot('06-phone-en', 800);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.rp-skill')];
  rows.find((r) => r.dataset.state === 'mastered')?.querySelector('.rp-row')?.click();
  document.querySelector('.rp-body')?.scrollTo(0, 320);
});
await shot('07-phone-en-evidence', 500);
await page.evaluate(() => window.__ascent.setLocale('pl'));
await shot('08-phone-pl', 600);
await page.evaluate(() => {
  window.__ascent.setLocale('en');
  window.__ascent.report.close();
});
await clearOverlays();
await shot('09-phone-launcher', 700);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
await page.setViewportSize({ width: W, height: H });
const perf = await page.evaluate(() => window.__ascent.state());
const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');

await writeFile(path.join(OUT, 'report.json'), JSON.stringify({
  url: URL, played, perf: { fps: perf.fps, ...perf.perf }, snapshot: snap, errors, shots,
}, null, 2));

console.log(`played ${played.answered} items (${played.wrong} deliberate misses)`);
console.log(`mastered ${snap.mastered}/${snap.total} · granted ${snap.granted} · withdrawn ${snap.withdrawn}`
  + ` · hollow ${snap.hollowRate == null ? 'n/a' : (snap.hollowRate * 100).toFixed(1) + '%'}`);
console.log(`fps ${perf.fps} · ${shots.length} shots -> ${path.relative(process.cwd(), OUT)}`);
if (errors.length) {
  console.error(`\n${errors.length} console error(s):`);
  for (const e of errors.slice(0, 12)) console.error('  ' + e.text.slice(0, 400));
}
await browser.close();
process.exit(errors.length ? 1 : 0);
