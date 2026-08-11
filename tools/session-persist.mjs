/**
 * Does a run survive the break, the bell and a flat battery?
 *
 * Answers three items, reloads the page from scratch, and checks that the run
 * comes back with the same goal, the same tear count and the same learner
 * model — because "progress persists across the break" is a claim about a cold
 * start, not about a variable staying in memory.
 *
 *   node tools/session-persist.mjs --url http://127.0.0.1:4173
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });

// Cleared once, on the first navigation only — an init script runs on every
// navigation, and clearing it on the reload would be testing nothing.
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('ascent.persistTest')) {
      localStorage.clear();
      sessionStorage.setItem('ascent.persistTest', '1');
    }
  } catch { /* ignore */ }
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2000);
await page.evaluate(() => window.__ascent.session.plan());
await page.evaluate(() => document.querySelector('.sc-go')?.click());

for (let i = 0; i < 3; i++) {
  await page.evaluate(async () => {
    const a = window.__ascent;
    const o = a.nextObjective();
    if (a.panel.open) a.panel.close();
    await new Promise((r) => setTimeout(r, 60));
    a.openRiftById(o.id);
    await new Promise((r) => setTimeout(r, 120));
    a.enter(a.panel.item.answer);
    await new Promise((r) => setTimeout(r, 90));
    if (a.panel.open) a.panel.close();
  });
}
const before = await page.evaluate(() => {
  const s = window.__ascent.state();
  return { tears: s.session.run.tears, target: s.session.run.target, index: s.session.run.index, integrity: s.integrity, soft: s.soft };
});

// the break, the bell, the bus home
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__ascent.session.state());
await page.waitForFunction(() => window.__ascent.session.state().phase === 'work', null, { timeout: 20000 });
const after = await page.evaluate(() => {
  const s = window.__ascent.state();
  return {
    tears: s.session.run.tears, target: s.session.run.target, index: s.session.run.index,
    integrity: s.integrity, soft: s.soft,
    bandVisible: !!document.querySelector('.ses-band.show'),
    bandCount: document.querySelector('.sb-n')?.textContent,
  };
});
await browser.close();

const ok = before.tears === after.tears && before.target === after.target
  && before.index === after.index && Math.abs(before.soft - after.soft) < 1e-9
  && after.bandVisible && after.bandCount === String(before.tears);
console.log('before reload', JSON.stringify(before));
console.log('after  reload', JSON.stringify(after));
console.log('console errors', errs.length, errs.slice(0, 3));
console.log(ok && !errs.length ? 'PASS — the run survived a cold start' : 'FAIL');
process.exit(ok && !errs.length ? 0 : 1);
