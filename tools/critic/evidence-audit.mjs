/**
 * Does the evidence card tell the truth about how a claim was earned?
 *
 * The defect this exists to catch: the report used to render the clean-run and
 * proving-run rows out of the mastery *configuration*, so every mastered skill
 * printed "3/3 ✓ · 3/3 ✓" no matter what the learner had actually done —
 * including a learner who tested out cold in three items, whose card claimed
 * six items of evidence over four answered questions.
 *
 * So this drives the REAL game twice, through the real rift panel:
 *
 *   THE SIGHT-READ ROAD  answer every item correctly from the first contact.
 *                        The cold item opens the proving run, and the claim is
 *                        granted on three unassisted items with no practice.
 *
 *   THE LONG ROAD        miss the cold item on purpose, then work up. The claim
 *                        is granted after practice, on a different count.
 *
 * and then asserts that the two cards report DIFFERENT numbers, that each
 * number matches the receipt `promote()` froze, and that the items claimed as
 * evidence never exceed the questions actually answered on that line.
 *
 *   node tools/critic/evidence-audit.mjs --url http://127.0.0.1:PORT --out shots/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/evidence'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const shots = [];
const fails = [];

async function session(w, h, tag, work) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({
    tag, type: m.type(), text: m.text(), at: m.location?.()?.url || null,
  }));
  page.on('pageerror', (e) => logs.push({ tag, type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));
  // A bare "404 (Not Found)" in the console names nothing; the URL is the whole
  // finding, so it is captured beside it.
  page.on('response', (r) => { if (r.status() >= 400) logs.push({ tag, type: 'http', text: `${r.status()} ${r.url()}` }); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1400);
  const r = await work(page, ctx);
  await ctx.close();
  return r;
}

/**
 * Play one skill through the real panel until it is mastered.
 * `missFirst` deliberately fails the cold sight-read, which is the fork in the
 * road: pass it and the claim comes off first contact, miss it and the learner
 * is taught and has to earn the run.
 */
const PLAY_SKILL = async (page, skill, missFirst, maxItems = 40) => page.evaluate(
  async ({ skill, missFirst, maxItems }) => {
    const A = window.__ascent;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    let n = 0;
    let first = true;
    let idle = 0;
    // One answer per rift, the way a player gives one: the panel will not take a
    // second value until the seal has played and the tear has closed, and a
    // harness that keeps typing into a sealed rift is answering nothing.
    while (n < maxItems && !A.mastery.get(skill).mastered && idle < 12) {
      if (!A.panel?.open && !A.openRiftById(skill)) break;
      await sleep(160);
      const p = A.panel;
      if (!p?.open || !p.item) { idle += 1; continue; }
      const it = p.item;
      const wrong = missFirst && first;
      const val = wrong ? (it.distractors?.[0]?.v ?? `${it.answer}9`) : it.answer;
      const clock = A.mastery.clock;
      A.enter(val);
      await sleep(240);
      if (A.mastery.clock === clock) { idle += 1; } else { idle = 0; n += 1; first = false; }
      const s = A.mastery.get(skill);
      log.push({ n, wrong, band: s.difficulty, check: s.check ? `${s.check.done}/${s.check.need}` : null, mastered: s.mastered });
      if (A.panel?.open) A.panel.close?.();
      await sleep(160);
    }
    const s = A.mastery.get(skill);
    return { items: n, mastered: s.mastered, provenBy: s.provenBy, log };
  }, { skill, missFirst, maxItems },
);

const OPEN_REPORT = async (page) => {
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => { window.__ascent.panel?.close?.(); });
    await page.click('.rp-launch', { force: true }).catch(() => {});
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) return;
  }
  throw new Error('report never opened');
};

/** Everything the card says about one skill, read off the rendered DOM. */
const CARD = async (page, skill) => page.evaluate((id) => {
  const rows = [...document.querySelectorAll('.rp-skill')];
  const art = rows.find((a) => a.querySelector('.rp-name')?.textContent
    === window.__ascent.t('skills.' + id));
  if (!art) return null;
  if (art.querySelector('.rp-detail')?.hidden) art.querySelector('.rp-row').click();
  const ev = [...art.querySelectorAll('.rp-ev-row')].map((li) => ({
    lab: li.querySelector('.rp-ev-lab').textContent,
    val: li.querySelector('.rp-ev-val').textContent,
    met: [...li.classList].find((c) => c.startsWith('m-')),
  }));
  return {
    name: art.querySelector('.rp-name').textContent,
    tag: art.querySelector('.rp-tag').textContent,
    road: art.querySelector('.rp-road')?.textContent || null,
    evidence: ev,
    sum: art.querySelector('.rp-ev-sum')?.textContent || null,
    facts: [...art.querySelectorAll('.rp-facts dt')].map((dt, i) => [
      dt.textContent, art.querySelectorAll('.rp-facts dd')[i]?.textContent,
    ]),
    standards: [...art.querySelectorAll('.rp-chip')].map((c) => c.textContent),
    stdSum: art.querySelector('.rp-std-sum')?.textContent || null,
  };
}, skill);

// ---------------------------------------------------------------------------
const result = await session(1600, 900, 'desktop', async (page) => {
  await page.evaluate(() => {
    localStorage.removeItem('ascent.save');
    localStorage.removeItem('ascent.report');
    localStorage.removeItem('ascent.learner');
    localStorage.removeItem('ascent.class');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1400);

  // 1. the sight-read road, on the first line
  const sight = await PLAY_SKILL(page, 'var-meaning', false);
  // 2. the long road, on the next line: the cold item is missed on purpose
  const long = await PLAY_SKILL(page, 'eval-expr', true);
  // 3. a third line, played straight, so the card has company
  const third = await PLAY_SKILL(page, 'order-ops', false);

  await OPEN_REPORT(page);
  await page.screenshot({ path: path.join(OUT, '01-report-1600-en.png') });
  shots.push('01-report-1600-en.png');

  const cardSight = await CARD(page, 'var-meaning');
  await page.waitForTimeout(200);
  const cardLong = await CARD(page, 'eval-expr');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '02-evidence-1600-en.png') });
  shots.push('02-evidence-1600-en.png');

  // the record section at the foot of the card
  await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '03-record-1600-en.png') });
  shots.push('03-record-1600-en.png');

  // the teacher's copy
  await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 0; });
  await page.click('.rp-teacher');
  await page.waitForTimeout(500);
  await page.fill('.rp-field input', 'Ada Wiśniewska');
  await page.fill('.rp-ident label:nth-child(2) input', 'Period 3');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '04-teacher-1600-en.png') });
  shots.push('04-teacher-1600-en.png');
  await page.evaluate(() => { const b = document.querySelector('.rp-doc-body'); if (b) b.scrollTop = 420; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '05-teacher-sheet-1600-en.png') });
  shots.push('05-teacher-sheet-1600-en.png');

  // what the printer would actually put on paper
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '05b-print-sheet.png'), fullPage: true });
  shots.push('05b-print-sheet.png');
  await page.emulateMedia({ media: 'screen' });
  await page.waitForTimeout(300);

  // the class view, built from this device's own record
  await page.click('.rp-tab[data-tab="class"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.rp-acts-class .rp-btn')]
      .find((x) => x.textContent && !x.querySelector('input'));
    b?.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '06-teacher-class-1600-en.png') });
  shots.push('06-teacher-class-1600-en.png');

  const exported = await page.evaluate(() => JSON.stringify(window.__ascent.report.record({ name: 'Ada Wiśniewska', group: 'Period 3' })));
  const csv = await page.evaluate(() => {
    const r = window.__ascent.report.record({ name: 'Ada Wiśniewska', group: 'Period 3' });
    return window.__ascent.reportCsv ? window.__ascent.reportCsv(r) : null;
  });

  // the two other locales, on the same state
  for (const loc of ['es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `07-teacher-1600-${loc}.png`) });
    shots.push(`07-teacher-1600-${loc}.png`);
  }
  await page.evaluate(() => window.__ascent.setLocale('en'));
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  for (const loc of ['es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `08-report-1600-${loc}.png`) });
    shots.push(`08-report-1600-${loc}.png`);
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rp-skill .rp-row')];
      rows.slice(0, 2).forEach((r) => { if (r.getAttribute('aria-expanded') !== 'true') r.click(); });
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `09-evidence-1600-${loc}.png`) });
    shots.push(`09-evidence-1600-${loc}.png`);
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rp-skill .rp-row')];
      rows.slice(0, 2).forEach((r) => { if (r.getAttribute('aria-expanded') === 'true') r.click(); });
    });
  }
  await page.evaluate(() => window.__ascent.setLocale('en'));
  await page.waitForTimeout(400);

  const snap = await page.evaluate(() => window.__ascent.report.snapshot());
  const save = await page.evaluate(() => JSON.stringify({
    'ascent.save': localStorage.getItem('ascent.save'),
    'ascent.report': localStorage.getItem('ascent.report'),
    'ascent.learner': localStorage.getItem('ascent.learner'),
    'ascent.class': localStorage.getItem('ascent.class'),
  }));
  return { sight, long, third, cardSight, cardLong, snap, save, exported, csv };
});

// ------------------------------------------------------------------ the phone
await session(414, 896, 'phone', async (page) => {
  await page.evaluate((s) => {
    for (const [k, v] of Object.entries(JSON.parse(s))) if (v != null) localStorage.setItem(k, v);
  }, result.save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await OPEN_REPORT(page);
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(600);
    await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 0; });
    await page.screenshot({ path: path.join(OUT, `10-report-414-${loc}.png`) });
    shots.push(`10-report-414-${loc}.png`);
  }
  await page.evaluate(() => window.__ascent.setLocale('en'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.rp-skill .rp-row')];
    rows[0]?.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 340; });
  await page.screenshot({ path: path.join(OUT, '11-evidence-414-en.png') });
  shots.push('11-evidence-414-en.png');
  await page.click('.rp-teacher');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '12-teacher-414-en.png') });
  shots.push('12-teacher-414-en.png');
  return null;
});

// ------------------------------------------- half a record, restored on its own
// The reported failure, reproduced: the learner model comes back and the
// evidence ledger does not — a shared Chromebook profile, a half-answered
// "clear site data". It used to print LINES HELD 3 beside QUESTIONS ANSWERED 0
// and say nothing.
const restored = await session(1600, 900, 'restore', async (page) => {
  await page.evaluate((s) => {
    const all = JSON.parse(s);
    localStorage.clear();
    if (all['ascent.save']) localStorage.setItem('ascent.save', all['ascent.save']);
  }, result.save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1400);
  await OPEN_REPORT(page);
  await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '13-restored-ledger-lost.png') });
  shots.push('13-restored-ledger-lost.png');
  return page.evaluate(() => {
    const tile = (lab) => [...document.querySelectorAll('.rp-tile')]
      .find((d) => d.querySelector('.rp-t-lab').textContent === window.__ascent.t(lab));
    const val = (lab) => tile(lab)?.querySelector('.rp-t-val b').textContent;
    return {
      warn: document.querySelector('.rp-warn')?.innerText || null,
      items: val('report.stat.items'),
      held: val('report.stat.mastered'),
      time: val('report.stat.time'),
      accuracy: val('report.stat.accuracy'),
      snapshot: window.__ascent.report.snapshot(),
    };
  });
});

// -------------------------------------------------------------- the assertions
const say = (ok, line) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${line}`); if (!ok) fails.push(line); };

console.log('\nASCENT — evidence audit, driven through the running game\n');
for (const [tag, run] of [['sight-read road (var-meaning)', result.sight], ['long road (eval-expr)', result.long]]) {
  const p = run.provenBy || {};
  console.log(`${tag}: ${run.items} questions answered, mastered=${run.mastered}`);
  console.log(`   receipt: road=${p.road} entry=${p.entryRun}/${p.entryNeed} run=${p.checkDone}/${p.checkNeed} band=${p.band} items=${p.items}`);
}
console.log('\ncard, sight-read road:', JSON.stringify(result.cardSight, null, 1));
console.log('\ncard, long road:', JSON.stringify(result.cardLong, null, 1));

const s = result.sight, l = result.long;
say(s.mastered && l.mastered, 'both roads reached mastery');
say(s.provenBy?.road === 'sight', `the cold road is recorded as a sight-read (got ${s.provenBy?.road})`);
say(l.provenBy?.road !== 'sight', `the missed-first road is not recorded as a sight-read (got ${l.provenBy?.road})`);
say(s.provenBy?.items <= s.items, `sight-read claim rests on ${s.provenBy?.items} items out of ${s.items} answered`);
say(l.provenBy?.items <= l.items, `long-road claim rests on ${l.provenBy?.items} items out of ${l.items} answered`);

const evOf = (card, i) => card?.evidence?.[i]?.val;
say(evOf(result.cardSight, 1) !== evOf(result.cardLong, 1) || evOf(result.cardSight, 2) !== evOf(result.cardLong, 2),
  `the two cards report different evidence (${evOf(result.cardSight, 1)} / ${evOf(result.cardSight, 2)} vs ${evOf(result.cardLong, 1)} / ${evOf(result.cardLong, 2)})`);
say(!!result.cardSight?.road, 'the sight-read claim is badged on the closed row');
say(/\b3\b/.test(result.cardSight?.evidence?.[2]?.val || ''), 'the proving-run row shows a real count');
say(!!result.cardSight?.sum && !!result.cardLong?.sum, 'both cards state what the claim rests on');
say(result.cardSight?.standards?.some((x) => /core|supporting|introduced/i.test(x)),
  'standards chips carry their coverage depth');

// the receipt and the card must agree
const snapSight = result.snap.skills.find((x) => x.id === 'var-meaning');
say(snapSight?.claim?.road === 'sight', 'the snapshot exposes the receipt');
const anyOverclaim = result.snap.skills.some((x) => x.claim && x.claim.items > x.items);
say(!anyOverclaim, 'no line claims more evidence items than it has questions answered');

console.log('\nrestored with the ledger missing:', JSON.stringify({
  held: restored.held, items: restored.items, time: restored.time, accuracy: restored.accuracy,
  trust: restored.snapshot.trust.level, reasons: restored.snapshot.trust.reasons,
}));
say(!!restored.warn, 'a half-restored record says so on its face');
say(Number(restored.items) >= Number(restored.held), `questions answered (${restored.items}) is not zero beside lines held (${restored.held})`);
say(restored.time === '—', 'time on task from before the break is reported as unknown, not as zero');
say(restored.snapshot.granted >= 3, `claims were rebuilt from the model (granted ${restored.snapshot.granted})`);
say(restored.snapshot.trust.level !== 'verified', 'the record refuses to call itself verified');

const rec = JSON.parse(result.exported);
say(rec.learner.name === 'Ada Wiśniewska' && !!rec.generatedAt, 'the exported record carries a name and a date');
say(rec.skills.every((x) => !x.claim || x.claim.items <= x.items), 'the exported record never over-claims');

const errors = logs.filter((x) => x.type === 'error' || x.type === 'pageerror');
console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('  ! ' + e.text.split('\n')[0]);

await writeFile(path.join(OUT, 'evidence.json'), JSON.stringify({ ...result, shots, errors }, null, 2));
await browser.close();
console.log(fails.length || errors.length ? '\nFAIL' : '\nPASS');
process.exit(fails.length || errors.length ? 1 : 0);
