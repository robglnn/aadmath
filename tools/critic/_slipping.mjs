/**
 * "Reading a variable — SLIPPING — TESTED OUT — 95%", and what it says now.
 *
 *   node tools/critic/_slipping.mjs [--url …]
 *
 * A cold critic photographed one Progress row making two claims that cannot
 * both be true of the same moment: SLIPPING is where the claim stands today,
 * TESTED OUT is how it was granted weeks ago, and a badge with no tense reads
 * as present tense. This drives the real report through both states and prints
 * what each row actually says, plus the legend under them.
 *
 * The mastery record is shaped directly, because the alternative is four days
 * of real re-test schedule. Nothing about the RENDERING is faked: the report
 * builds every row from `mastery` the way it does in play, and the assertion is
 * read off the live DOM.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
await mkdir('shots/slip', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

/** A whole sight-read receipt, the shape `promote()` freezes at the grant. */
const RECEIPT = {
  road: 'sight', at: Date.now() - 86400000 * 3, firstContact: true,
  band: 4, entryBand: 4, entryRun: 1, entryNeed: 1,
  checkDone: 3, checkNeed: 3, checkBase: 3, missed: 0, items: 3, unaided: 3,
};

const errs = [];
let bad = 0;

for (const lapse of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await p.waitForTimeout(4000);

  await p.evaluate(({ receipt, lapsePending }) => {
    const s = window.__ascent.mastery.state.get('var-meaning');
    Object.assign(s, {
      mastered: true, everMastered: true, lapsePending,
      pL: 0.95, attempts: 3, correct: 3, difficulty: 4, provenBy: receipt,
    });
  }, { receipt: RECEIPT, lapsePending: lapse });

  await p.keyboard.press('KeyP');
  await p.waitForTimeout(1200);
  const row = await p.evaluate(() => {
    const a = document.querySelector('.rp-skill');
    const legend = document.querySelector('.rp-legend');
    return {
      state: a.dataset.state,
      flags: [...a.querySelectorAll('.rp-flags > *')].map((e) => e.textContent.trim()),
      text: a.querySelector('.rp-row').innerText.replace(/\n/g, ' · '),
      legend: legend && !legend.hidden ? [...legend.children].map((c) => c.innerText.replace(/\n/g, ' — ')) : [],
    };
  });
  console.log(`\n--- ${lapse ? 'HELD, AND SLIPPING' : 'HELD, AND STANDING'} ---`);
  console.log('row    ', row.text);
  console.log('flags  ', JSON.stringify(row.flags));
  row.legend.forEach((l) => console.log('legend ', l));

  const slipping = row.flags.some((f) => /slip|cedi|osuwa/i.test(f));
  const road = row.flags.length > 1;
  if (lapse && slipping && road) { console.log('  FAIL — the row is slipping AND wears a road badge'); bad++; }
  if (!lapse && !road) { console.log('  FAIL — a standing claim lost its road badge'); bad++; }
  if (!row.legend.length) { console.log('  FAIL — no legend under the rows'); bad++; }

  // The road is not hidden — it moves into the detail, in the past tense.
  await p.click('.rp-skill .rp-row');
  await p.waitForTimeout(700);
  const detail = await p.evaluate(() => document.querySelector('.rp-skill .rp-detail')?.innerText || '');
  const dated = /granted|concedid|przyzna/i.test(detail);
  console.log('detail ', dated ? 'reports the grant and its date' : 'DOES NOT report the grant');
  if (!dated) bad++;
  if (/NaN/.test(detail)) { console.log('  FAIL — NaN on the evidence card'); bad++; }

  // …and the band, with the one line that says what a band is.
  const band = await p.evaluate(() => {
    const dl = document.querySelector('.rp-skill .rp-facts');
    const dts = [...dl.querySelectorAll('dt')];
    const i = dts.findIndex((d) => /band|banda|poziom/i.test(d.textContent));
    const dd = i >= 0 ? dl.querySelectorAll('dd')[i] : null;
    return dd ? dd.innerText.replace(/\n/g, ' — ') : null;
  });
  console.log('band   ', band);
  if (!band || band.split(' — ').length < 2) { console.log('  FAIL — the band figure has no unit beside it'); bad++; }

  await p.screenshot({ path: `shots/slip/${lapse ? 'slipping' : 'standing'}.png` });
  await ctx.close();
}

console.log('\nconsole errors:', errs.length ? errs.slice(0, 3) : 'none');
if (errs.length) bad++;
console.log(bad ? `\n${bad} problem(s)` : '\nclean — a line is never both slipping and tested out');
await browser.close();
process.exit(bad ? 1 : 0);
