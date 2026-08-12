/**
 * The printed record, in Spanish and in Polish, with the caveats in shot.
 *
 * WHY THIS EXISTS. A department head reading the bilingual rollout copy found
 * that the "What we claim, and what we do not" caveats — seventeen paragraphs,
 * and the most load-bearing prose in the whole alignment case — rendered as raw
 * English under a correctly translated Spanish heading. `npm run check:i18n`
 * reported a clean tree, because the strings lived in
 * `content/standards/teks-algebra1-l1.json` and the gate only read `src/`.
 *
 * The gate reads `content/` now. This script is the other half of that: the
 * pixels. It plays the real loop so the record has something to report, opens
 * the teacher's copy on the Standards tab in both frameworks, and photographs
 * the caveat block, the process table and the gap list in EN, ES and PL — so
 * the claim "no English prose remains" is something somebody can look at
 * rather than something a builder said.
 *
 * It also reads the DOM and fails if our own prose comes back English while the
 * page is Spanish or Polish. Quoted standards are exempt and are checked to be
 * exempt for the right reason: they must carry `lang="en"`, which is what tells
 * a screen reader to change voice and what the on-screen disclosure refers to.
 *
 *   node tools/critic/record-lang.mjs --url http://127.0.0.1:4321 --out shots/record-lang
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/record-lang'));
const W = 1500;
const H = 1000;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));

const shots = [];
const failures = [];
const fail = (what, why) => { failures.push({ what, why }); console.log(`  FAIL ${what} — ${why}`); };
async function shot(name, ms = 300) {
  await page.waitForTimeout(ms);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f, fullPage: false });
  shots.push(f);
  return f;
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
await page.waitForTimeout(2400);

/** Session beats own the whole screen; a record photographed under one is not a record. */
async function clearBeats() {
  await page.evaluate(() => {
    const s = window.__ascent?.session;
    s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
    for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
    document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
    document.getElementById('boot')?.classList.add('gone');
  });
}
await clearBeats();

// --- play the real loop, so the record has evidence in it --------------------
const played = await page.evaluate(async () => {
  const A = window.__ascent;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let answered = 0;
  for (let i = 0; i < 120; i++) {
    const nx = A.nextObjective();
    if (!nx) break;
    if (A.panel.open) A.panel.close();
    await sleep(20);
    if (!A.openRiftById(nx.id)) break;
    await sleep(45);
    const item = A.panel.item;
    if (!item) break;
    if (i % 9 === 8) A.panel.demo('wrong'); else A.enter(item.answer);
    answered++;
    await sleep(50);
    if (A.panel.open) A.panel.close();
    await sleep(25);
  }
  return { answered, snapshot: A.report.snapshot() };
});
console.log(`played ${played.answered} items · ${played.snapshot.mastered}/${played.snapshot.total} lines held`);

await page.evaluate(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
await clearBeats();

/**
 * Our own prose, as the DOM actually holds it.
 *
 * `.rp-def-caveat span` is the caveat body, the `MET` column is how a process
 * standard is met, and `.rp-gaps li span` is where the alignment stops. All
 * three are sentences this project wrote. The `dd` beside each `dt`, and the
 * EXPECTATION column, are quotations of a US standard and must carry lang="en".
 */
const readSheet = () => page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').trim();
  const rows = [...document.querySelectorAll('.rp-defs .rp-def-caveat')];
  // THE LAST TABLE ON THE SHEET, not every table on it. The coverage table
  // above the definitions has four columns too, and reading its fourth column
  // as "how this process standard is met" produced 180 findings about a cell
  // containing the number 9. The process table is the one that follows the
  // definition list.
  const tables = [...document.querySelectorAll('.rp-sheet table')];
  const proc = [...(tables[tables.length - 1]?.querySelectorAll('tbody tr') || [])];
  return {
    locale: window.__ascent.locale(),
    frame: document.querySelector('.rp-frame-b.on')?.dataset.frame || null,
    caveatHead: txt(document.querySelector('.rp-def-caveat b')),
    caveats: rows.map((r) => ({ text: txt(r.querySelector('span')), lang: r.querySelector('span')?.lang || '' })),
    quotes: [...document.querySelectorAll('.rp-defs dd:not(.rp-def-caveat)')]
      .map((d) => ({ text: txt(d).slice(0, 60), lang: d.lang })),
    hows: proc.map((tr) => {
      const td = [...tr.querySelectorAll('td')];
      return td.length >= 4 ? { text: txt(td[3]), lang: td[3].lang || '', quotedLang: td[2].lang || '' } : null;
    }).filter(Boolean),
    gaps: [...document.querySelectorAll('.rp-gaps li')].map((li) => ({
      text: txt(li).slice(0, 160), lang: li.lang || '',
    })),
    notes: [...document.querySelectorAll('.rp-sheet-note')].map(txt),
  };
});

/**
 * Words that can only be English.
 *
 * Deliberately small, and every entry checked against the other two languages
 * rather than assumed. The first version of this list carried `standard`, which
 * is an ordinary Polish noun, and it duly reported two correct Polish sentences
 * as English. `no` is Spanish, `to` and `ale` are Polish, `a` is both, `sol`
 * and `son` are Spanish — none of those are here either. What is left is
 * English function words with no cognate in ES or PL, so a hit is a hit.
 */
const ENGLISH_ONLY = /\b(the|and|which|that|with|this|these|those|are|was|were|only|from|what|when|where|because|inside|rather|than|both|each|every|claimed|learner|expectation|equations|itself)\b/i;

const results = [];
for (const frame of ['ccss', 'teks']) {
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate(({ f, l }) => {
      window.__ascent.setLocale(l);
      if (!window.__ascent.report.open) window.__ascent.report.show();
      if (!window.__ascent.report.teacher.open) window.__ascent.report.teacher.show();
      document.querySelector('.rp-tab[data-tab="std"]')?.click();
      document.querySelector(`.rp-frame-b[data-frame="${f}"]`)?.click();
    }, { f: frame, l: loc });
    await page.waitForTimeout(500);

    // Scroll to the caveat block, which is what the department head was reading.
    await page.evaluate(() => {
      const el = document.querySelector('.rp-def-caveat');
      if (el) el.scrollIntoView({ block: 'center' });
      else document.querySelector('.rp-doc,.rp-body')?.scrollTo(0, 99999);
    });
    await shot(`${frame}-${loc}-caveats`, 420);

    await page.evaluate(() => {
      const el = document.querySelector('.rp-gaps') || document.querySelector('.rp-sheet table');
      el?.scrollIntoView({ block: 'center' });
    });
    await shot(`${frame}-${loc}-process-and-gaps`, 420);

    const sheet = await readSheet();
    results.push(sheet);

    // --- the assertions ------------------------------------------------------
    const label = `${frame}/${loc}`;
    if (sheet.locale !== loc) fail(label, `the page is in ${sheet.locale}, not ${loc}`);
    if (frame === 'teks' && !sheet.caveats.length) fail(label, 'no caveat bodies rendered at all');

    for (const c of sheet.caveats) {
      if (c.lang === 'en' && loc !== 'en') {
        fail(label, `a caveat is still marked lang="en": ${JSON.stringify(c.text.slice(0, 60))}`);
      }
      if (loc !== 'en' && ENGLISH_ONLY.test(c.text)) {
        fail(label, `English prose in a ${loc} caveat: ${JSON.stringify(c.text.slice(0, 80))}`);
      }
    }
    for (const h of sheet.hows) {
      if (loc !== 'en' && ENGLISH_ONLY.test(h.text)) {
        fail(label, `English prose in a ${loc} "how it is met": ${JSON.stringify(h.text.slice(0, 80))}`);
      }
      if (h.quotedLang !== 'en') fail(label, 'the quoted process standard is not marked lang="en"');
    }
    for (const g of sheet.gaps) {
      if (loc !== 'en' && ENGLISH_ONLY.test(g.text)) {
        fail(label, `English prose in a ${loc} gap note: ${JSON.stringify(g.text.slice(0, 80))}`);
      }
      if (g.lang === 'en' && loc !== 'en') fail(label, 'a gap note is still marked lang="en"');
    }
    // The quotations must stay English AND stay labelled as quotations. A
    // translated standard would be a worse lie than the language mismatch.
    for (const q of sheet.quotes) {
      if (q.lang !== 'en') fail(label, `a quoted standard is not marked lang="en": ${JSON.stringify(q.text)}`);
    }
    console.log(`  ${label}: ${sheet.caveats.length} caveats · ${sheet.hows.length} process rows · ${sheet.gaps.length} gap notes`);
  }
}

await page.evaluate(() => window.__ascent.setLocale('en'));

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({
  url: URL, played: played.answered, shots, failures, results, errors,
}, null, 2));

console.log(`\n${shots.length} shots -> ${OUT}`);
console.log(`console errors: ${errors.length}`);
if (failures.length) {
  console.log(`\nRECORD FAILED — ${failures.length} finding(s):`);
  for (const f of failures) console.log(`  ${f.what}: ${f.why}`);
} else {
  console.log('every caveat, every "how it is met" and every gap note is in the reader\'s language.');
  console.log('every quoted standard is still English and still marked lang="en".');
}
await browser.close();
process.exit(failures.length ? 3 : errors.length ? 2 : 0);
