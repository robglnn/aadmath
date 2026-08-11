/**
 * Play one whole session in the real game and photograph every beat of it.
 *
 * Nothing here is mocked. The synthetic learner walks into the rift the real
 * scheduler points at, reads the item the real bank generated, and answers it
 * through the same surface a hand does — so the run band, the close and the
 * break are all reacting to real mastery events.
 *
 *   node tools/session-shot.mjs --out shots/session --url http://127.0.0.1:4173
 *     [--acc 0.78] [--w 1600] [--h 900] [--loc en] [--fast]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const flag = (k) => process.argv.includes('--' + k);

const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/session'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
const ACC = Number(arg('acc', 0.78));
const LOC = arg('loc', 'en');

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: LOC,
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push({ type: m.type(), text: m.text() }); });
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));
// A twenty-shot run takes minutes, and several builders rebuild `dist/` in that
// window — which shows up as a bare "Failed to load resource" with no URL and
// nothing to do with the game. The URL is captured so the two can be told apart
// instead of one being reported as the other.
page.on('requestfailed', (r) => logs.push({ type: 'requestfailed', text: `${r.url()} ${r.failure()?.errorText || ''}` }));

const shots = [];
async function shot(name, ms = 300) {
  await page.waitForTimeout(ms);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
  console.log('  shot', name);
  return f;
}
const ax = (fn, a) => (a === undefined ? page.evaluate(fn) : page.evaluate(fn, a));

// A learner who has never played, so the run has to be planned from nothing.
await page.addInitScript((loc) => {
  try { localStorage.clear(); localStorage.setItem('ascent.locale', loc); } catch { /* ignore */ }
}, LOC);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2200);

// The one hand this harness lends the game: answering an item the way a keypad
// or a beam does, and reporting what the run believed afterwards.
await ax(() => {
  window.__drive = {
    async one(p) {
      const a = window.__ascent;
      const obj = a.nextObjective();
      if (!obj) return null;
      if (a.panel.open) a.panel.close();
      await new Promise((r) => setTimeout(r, 40));
      if (!a.openRiftById(obj.id)) return null;
      await new Promise((r) => setTimeout(r, 90));
      if (!a.panel.open) return null;
      const item = a.panel.item;
      const good = Math.random() < p;
      // A wrong answer has to be a *plausible* wrong answer: the keypad refuses
      // an unparseable entry outright, so typing "x" silently answers nothing
      // and the harness quietly reports a learner who never missed.
      const miss = (item.diagnostics || []).map((d) => d.value).find((v) => String(v) !== String(item.answer))
        ?? (item.distractors || []).find((v) => String(v) !== String(item.answer))
        ?? (Number.isFinite(Number(item.answer)) ? String(Number(item.answer) + 1) : 'nope');
      a.enter(good ? item.answer : miss);
      await new Promise((r) => setTimeout(r, 70));
      if (a.panel.open) a.panel.close();
      await new Promise((r) => setTimeout(r, 40));
      return { skill: obj.id, correct: good, ...a.session.state().run };
    },
  };
});

// --- 1. the opening: orders, before a single item is asked -----------------
console.log('waiting for the cold open to finish, then the orders…');
await page.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 60000 });
await shot('01-orders', 1400);
const plan = await ax(() => window.__ascent.session.state());
console.log('  plan:', JSON.stringify({
  target: plan.run.target, minutes: plan.run.minutes,
  seams: plan.run.seams.map((s) => `${s.id}${s.hold ? '*' : ''}`), pace: plan.pace,
}));

await page.click('.sc-go');
await shot('02-run-begins', 900);

// --- 2. the run ------------------------------------------------------------
const target = plan.run.target;
let answered = 0;
let mid = false;
let near = false;
for (let i = 0; i < 400; i++) {
  const r = await page.evaluate((p) => window.__drive.one(p), ACC);
  if (!r) break;
  answered++;
  const st = await ax(() => window.__ascent.session.state());
  if (!mid && st.run && st.run.tears >= Math.round(target * 0.45)) {
    mid = true;
    await ax(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
    await shot('03-mid-run', 700);
  }
  if (!near && st.run && st.run.tears >= Math.round(target * 0.78)) {
    near = true;
    await ax(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
    await shot('04-last-stretch', 900);
  }
  if (st.phase === 'close') break;
}
console.log(`  ${answered} items answered at ${ACC} accuracy`);

// --- 3. the close ----------------------------------------------------------
await page.waitForFunction(() => document.querySelector('.ses-close.show'), null, { timeout: 20000 });
await shot('05-close', 2200);
const report = await ax(() => window.__ascent.session.state().run.report);
console.log('  report:', JSON.stringify(report));

// --- 4. the break ----------------------------------------------------------
await page.click('.sx-rest');
await shot('06-break', 3000);
await page.waitForTimeout(2500);
await shot('06b-break-quiet', 12000);

// --- 5. the stopping point -------------------------------------------------
await ax(() => document.querySelector('.sr-skip')?.click());
await shot('07-stand-down', 1400);
await ax(() => document.querySelector('.sr-off')?.click());
await shot('08-channel-closed', 1400);

// --- 6. the same beats in the other two languages ---------------------------
for (const loc of ['es', 'pl']) {
  await ax((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(600);
  await ax(() => { document.querySelector('.sr-off-frame button')?.click(); });
  await page.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 20000 });
  await shot(`09-orders-${loc}`, 900);
  await ax(() => window.__ascent.session.close());
  await page.waitForTimeout(200);
  await ax(() => { window.__ascent.session.plan(); });
  await page.waitForTimeout(200);
  await ax(() => document.querySelector('.sc-go')?.click());
  await ax(() => window.__ascent.session.skipToClose());
  await shot(`10-close-${loc}`, 2200);
  await ax(() => document.querySelector('.sx-rest')?.click());
  await shot(`11-break-${loc}`, 1600);
  await ax(() => document.querySelector('.sr-skip')?.click());
  await page.waitForTimeout(400);
  await ax(() => document.querySelector('.sr-off')?.click());
  await page.waitForTimeout(300);
}
await ax(() => window.__ascent.setLocale('en'));

// --- 7. a phone ------------------------------------------------------------
await page.setViewportSize({ width: 414, height: 896 });
await page.waitForTimeout(500);
await ax(() => { document.querySelector('.sr-off-frame button')?.click(); });
await page.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 20000 });
await shot('12-phone-orders', 900);
await ax(() => document.querySelector('.sc-go')?.click());
await page.evaluate((p) => window.__drive.one(p), 1);
await page.evaluate((p) => window.__drive.one(p), 1);
await ax(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
await shot('13-phone-band', 900);
await ax(() => window.__ascent.session.skipToClose());
await shot('14-phone-close', 2400);
await ax(() => document.querySelector('.sx-rest')?.click());
await shot('15-phone-break', 2000);

// --- 8. what the console had to say, and how fast it ran -------------------
await page.setViewportSize({ width: W, height: H });
await ax(() => { document.querySelector('.sr-skip')?.click(); });
await page.waitForTimeout(300);
await ax(() => { document.querySelector('.sr-off')?.click(); document.querySelector('.sr-off-frame button')?.click(); });
await page.waitForTimeout(2500);
const perf = await ax(() => window.__ascent.state());

// Anything the *game* said. A transport failure against the frozen preview
// server is a build-farm artefact, not a defect, and is reported separately.
const transport = logs.filter((l) => l.type === 'requestfailed');
const errors = logs.filter((l) => (l.type === 'pageerror'
  || (l.type === 'error' && !/Failed to load resource/.test(l.text))));
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({
  plan: plan.run, report, perf: perf.perf, fps: perf.fps, session: perf.session,
  answered, logs, shots,
}, null, 2));

console.log('\nfps', perf.fps, 'perf', JSON.stringify(perf.perf));
console.log('console errors:', errors.length, '· transport failures (build farm):', transport.length);
for (const e of transport.slice(0, 4)) console.log('  ~', e.text.slice(0, 160));
for (const e of errors.slice(0, 10)) console.log('  !', e.type, e.text.slice(0, 300));
await browser.close();
process.exit(errors.length ? 1 : 0);
