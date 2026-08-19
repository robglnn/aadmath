/**
 * Can one long sitting buy the top rank, the last chapter and the coda?
 * Plays a very long UNBROKEN sitting with real answers through the real panel,
 * then walks the clock forward and plays again, and prints rank/chapter/coda
 * at each point. Nothing here asserts; it prints what the running game says.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4599/');

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 800 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const snap = async (label) => {
  const s = await page.evaluate(() => {
    const a = window.__ascent;
    const st = a.state();
    const story = a.story?.state ? a.story.state() : null;
    return {
      standing: st.standing ?? story?.standing ?? null,
      rank: st.rank ?? story?.rank ?? null,
      chapter: story?.chapter ?? st.chapter ?? null,
      coda: story?.coda ?? null,
      tears: story?.tears ?? null,
      nights: story?.nights ?? a.watch?.().nights ?? null,
      durable: a.watch ? a.watch().durable : null,
      watch: a.watch ? a.watch() : null,
      mastered: Object.entries(a.state().skills || {}).filter(([, v]) => v.mastered).length,
      raw: story,
    };
  });
  console.log(label, JSON.stringify(s));
  return s;
};

// Answer N items correctly, as fast as the panel allows, in ONE sitting.
async function grind(n) {
  return page.evaluate(async (n) => {
    const a = window.__ascent;
    let done = 0, skipped = 0;
    for (let i = 0; i < n; i++) {
      const obj = a.nextObjective();
      const id = obj && (obj.id || obj.skill);
      if (!id) { skipped++; continue; }
      a.openRiftById(id);
      await new Promise((r) => setTimeout(r, 8));
      const pi = a.panelInfo();
      if (!pi.open) { skipped++; continue; }
      a.enter(pi.answer);
      await new Promise((r) => setTimeout(r, 30));
      try { a.panel.close ? a.panel.close() : a.panel.hide(); } catch {}
      await new Promise((r) => setTimeout(r, 8));
      done++;
    }
    return { done, skipped };
  }, n);
}

await snap('start   ');
for (let k = 0; k < 8; k++) {
  const g = await grind(120);
  const s = await snap(`sitting1 +${(k + 1) * 120} items ${JSON.stringify(g)} `);
  if (s.mastered >= 10 && s.rank && String(s.rank).toLowerCase().includes('sover')) break;
}
console.log('--- ONE SITTING, NO NIGHTS: above is the ceiling a Sunday can buy ---');

for (let d = 1; d <= 8; d++) {
  await page.evaluate((d) => window.__ascent.advanceDays(1), d);
  await grind(80);
  await snap(`after day ${d} `);
}
console.log('errors', errs.length, errs.slice(0, 5).join(' | '));
await browser.close();
