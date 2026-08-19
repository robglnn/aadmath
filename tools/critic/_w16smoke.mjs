/**
 * Smoke: does a standing order get laid, raised, survive a reload, and settle
 * only on a LATER day? Diagnosis only — the real proof is week.mjs, with keys.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4488');
const DAY = 86400000;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const errors = [];
const open = async (shift, clear = false) => {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((ms) => { const real = Date.now; Date.now = () => real() + ms; }, shift);
  if (clear) await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  return page;
};

// ---- day 1: hold some lines, close a run, and look for a mark ---------------
let page = await open(0, true);
await page.evaluate(async () => {
  const A = window.__ascent, m = A.mastery;
  for (let i = 0; i < 90; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const it = A.itemFor(task); if (!it) continue;
    m.observe(task.skill, true, { assisted: task.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: task.kind });
  }
});
await page.waitForTimeout(500);
const before = await page.evaluate(() => window.__ascent.story.state().order);
console.log('day1 before close:', JSON.stringify(before));
// A run has to exist before it can end. `plan` and `close` are the session's
// own critic hooks and neither of them fakes an answer.
await page.evaluate(() => { window.__ascent.session.plan(); });
await page.waitForTimeout(600);
await page.evaluate(() => window.__ascent.session.close());
await page.waitForTimeout(2500);
const laid = await page.evaluate(() => ({
  order: window.__ascent.story.state().order,
  mark: window.__ascent.kit.state().mark,
  cardRows: [...document.querySelectorAll('.ses-close.show .sx-next li')].map((li) => li.innerText.replace(/\n/g, ' | ')),
}));
console.log('day1 after close: ', JSON.stringify(laid, null, 1));

// ---- same day: answering the line must NOT settle it -----------------------
const sameDay = await page.evaluate(() => {
  const A = window.__ascent, o = A.story.state().order.order;
  A.mastery.observe(o.skill, true, { assisted: false });
  return A.story.state().order;
});
console.log('same-day answer (must still stand):', JSON.stringify(sameDay.order && sameDay.order.skill), 'kept =', sameDay.kept);
await page.close();

// ---- day 2: the mark is standing at boot, and one clean answer clears it ----
page = await open(DAY);
const arrived = await page.evaluate(() => ({
  order: window.__ascent.story.state().order,
  mark: window.__ascent.kit.state().mark,
}));
console.log('day2 at boot:      ', JSON.stringify(arrived));
const cleared = await page.evaluate(() => {
  const A = window.__ascent, o = A.story.state().order.order;
  const purse = A.state().shards, ch = A.kit.state().charters;
  A.mastery.observe(o.skill, true, { assisted: false });
  return {
    order: A.story.state().order,
    paid: A.state().shards - purse,
    charters: A.kit.state().charters - ch,
  };
});
await page.waitForTimeout(1200);
const gone = await page.evaluate(() => window.__ascent.kit.state().mark);
console.log('day2 after answer: ', JSON.stringify(cleared), 'mark now:', JSON.stringify(gone));

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('   ' + e);
await browser.close();
process.exit(errors.length ? 1 : 0);
