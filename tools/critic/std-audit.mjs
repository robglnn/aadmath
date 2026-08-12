/**
 * Critic capture + audit for STANDARDS REPORTING.
 *
 * It plays the real learning loop — real rifts, real generated items, real
 * answers typed through the same `enter()` a hand would use, and a fixed share
 * of them deliberately wrong — until the record is genuinely part-mastered.
 * Then it does three things nothing else in this repo does:
 *
 *   1. Photographs the standards coverage in BOTH frameworks, at 1600x900 and
 *      414x896, in EN, ES and PL, with a row open in each.
 *   2. Photographs the teacher's printable standards sheet in both frameworks.
 *   3. RE-DERIVES the coverage independently. It reads `formsSeen` straight out
 *      of the learner model in the page, reads the standards maps off disk, and
 *      recomputes every figure the screen printed. A coverage number that came
 *      from the content map rather than from the child would survive every
 *      screenshot in this file and die here.
 *
 * It also proves the choice persists: it flips to TEKS, reloads the page, and
 * checks the report comes back in TEKS.
 *
 *   node tools/critic/std-audit.mjs --url http://127.0.0.1:PORT --out shots/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/std-audit'));
await mkdir(OUT, { recursive: true });

const MAPS = {
  ccss: JSON.parse(await readFile(path.join(ROOT, 'content/standards/ccss-algebra1-l1.json'), 'utf8')),
  teks: JSON.parse(await readFile(path.join(ROOT, 'content/standards/teks-algebra1-l1.json'), 'utf8')),
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const shots = [];
const findings = [];
const fail = (m) => { findings.push(m); console.log('  FAIL  ' + m); };
const ok = (m) => console.log('  ok    ' + m);

async function session(w, h, tag, work) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ tag, type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ tag, type: 'pageerror', text: e.message }));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const r = await work(page, ctx);
  await ctx.close();
  return r;
}

/** Play the real learning loop. `wrongEvery` injects genuine errors. */
const PLAY = async (page, maxItems, wrongEvery) => page.evaluate(async ({ maxItems, wrongEvery }) => {
  const A = window.__ascent;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let n = 0, opened = 0;
  while (n < maxItems) {
    const nx = A.nextObjective();
    if (!nx) break;
    if (!A.openRiftById(nx.id)) break;
    opened++;
    for (let k = 0; k < 12 && n < maxItems; k++) {
      const p = A.panel;
      if (!p || !p.open || !p.item) break;
      const ans = p.item.answer;
      const wrong = wrongEvery > 0 && n % wrongEvery === (wrongEvery - 1);
      const val = wrong ? (p.item.distractors?.[0]?.v ?? String(ans) + '9') : ans;
      A.enter(val);
      n++;
      await sleep(60);
    }
    if (A.panel?.open) A.panel.close?.();
    await sleep(60);
  }
  const st = A.state();
  return { items: n, opened, fps: st.fps, perf: st.perf };
}, { maxItems, wrongEvery });

const OPEN_REPORT = async (page) => {
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => { window.__ascent.panel?.close?.(); });
    await page.click('.rp-launch', { force: true }).catch(() => {});
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
  }
  await page.waitForTimeout(600);
  if (!await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) throw new Error('report never opened');
};

/** Scroll the report body so the coverage section is at the top of the card. */
const TO_COVER = async (page) => {
  await page.evaluate(() => {
    const head = document.querySelector('.rp-cover-head');
    const body = document.querySelector('.rp-body');
    if (head && body) body.scrollTop += head.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
  });
  await page.waitForTimeout(300);
};

/**
 * Press the framework switch. `scope` matters: the report screen and the
 * teacher's document each carry their own copy of the control, and a bare
 * selector hits the report's — which is underneath the document modal — so the
 * click lands on the overlay and the framework never changes. That silently
 * photographed the same framework twice.
 */
const PICK = async (page, fw, scope = '.rp-card') => {
  await page.click(`${scope} .rp-frame-b[data-frame="${fw}"]`);
  await page.waitForTimeout(350);
  const live = await page.evaluate((s2) => document
    .querySelector(`${s2} .rp-frame-b.on`)?.dataset.frame, scope);
  if (live !== fw) throw new Error(`the ${scope} switch stayed on ${live}, not ${fw}`);
};

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  shots.push(name + '.png');
};

// ---------------------------------------------------------------- desktop run
const summary = await session(1600, 900, 'desktop', async (page) => {
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1000);

  const played = await PLAY(page, 170, 7);
  const save = await page.evaluate(() => JSON.stringify({
    'ascent.save': localStorage.getItem('ascent.save'),
    'ascent.report': localStorage.getItem('ascent.report'),
    'ascent.run': localStorage.getItem('ascent.run'),
    'ascent.pace': localStorage.getItem('ascent.pace'),
  }));

  await OPEN_REPORT(page);
  await TO_COVER(page);

  // --- both frameworks, three languages, a row open in each ----------------
  const snaps = {};
  const models = {};
  for (const fw of ['ccss', 'teks']) {
    await PICK(page, fw);
    await TO_COVER(page);
    await shot(page, `cover-1600-en-${fw}`);
    // open the first row that has evidence, then the first with none
    await page.evaluate(() => {
      const held = document.querySelector('.rp-cgrp.c-held .rp-crow, .rp-cgrp.c-part .rp-crow, .rp-cgrp.c-working .rp-crow');
      if (held) held.click();
    });
    await page.waitForTimeout(350);
    await TO_COVER(page);
    await shot(page, `cover-1600-en-${fw}-open`);
    // the tail of the list: the groups a coverage sheet is tempted to hide
    await page.evaluate(() => {
      const g = document.querySelector('.rp-cgrp.c-indirect') || document.querySelector('.rp-cgrp.c-none');
      const body = document.querySelector('.rp-body');
      if (g && body) body.scrollTop += g.getBoundingClientRect().top - body.getBoundingClientRect().top - 20;
    });
    await page.waitForTimeout(300);
    await shot(page, `cover-1600-en-${fw}-tail`);
    snaps[fw] = await page.evaluate(() => window.__ascent.report.snapshot());
    models[fw] = await page.evaluate(() => {
      const out = {};
      for (const [id, s] of window.__ascent.mastery.state) {
        out[id] = { formsSeen: s.formsSeen || {}, mastered: !!s.mastered, road: s.provenBy?.road || null };
      }
      return out;
    });
    for (const loc of ['es', 'pl']) {
      await page.evaluate((l) => window.__ascent.setLocale(l), loc);
      await page.waitForTimeout(450);
      await TO_COVER(page);
      await shot(page, `cover-1600-${loc}-${fw}`);
    }
    await page.evaluate(() => window.__ascent.setLocale('en'));
    await page.waitForTimeout(400);
  }

  // --- the skill list re-expressed ----------------------------------------
  await page.evaluate(() => {
    for (const r of document.querySelectorAll('.rp-crow[aria-expanded="true"]')) r.click();
    document.querySelector('.rp-skill .rp-row')?.click();
  });
  await page.waitForTimeout(350);
  const TO_SKILL = async () => {
    await page.evaluate(() => {
      const d = document.querySelector('.rp-skill .rp-detail:not([hidden])');
      const body = document.querySelector('.rp-body');
      if (d && body) body.scrollTop += d.getBoundingClientRect().top - body.getBoundingClientRect().top - 90;
    });
    await page.waitForTimeout(250);
  };
  for (const fw of ['ccss', 'teks']) {
    await PICK(page, fw);
    await page.evaluate(() => {
      const r = document.querySelector('.rp-skill .rp-row[aria-expanded="false"]');
      if (r) r.click();
    });
    await page.waitForTimeout(300);
    await TO_SKILL();
    await shot(page, `skill-1600-en-${fw}`);
  }

  // --- the teacher's printable standards sheet -----------------------------
  await page.click('.rp-teacher');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const i = document.querySelector('.rp-ident input');
    if (i) { i.value = 'Ada Wiśniewska'; i.dispatchEvent(new Event('input', { bubbles: true })); }
    const g = document.querySelectorAll('.rp-ident input')[1];
    if (g) { g.value = 'Period 3'; g.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.waitForTimeout(300);
  await page.click('.rp-tab[data-tab="std"]');
  await page.waitForTimeout(500);
  const docShots = {};
  for (const fw of ['teks', 'ccss']) {
    await PICK(page, fw, '.rp-doc');
    await page.waitForTimeout(350);
    await page.evaluate(() => { const b = document.querySelector('.rp-doc-body'); if (b) b.scrollTop = 0; });
    await shot(page, `doc-1600-en-${fw}`);
    await page.evaluate(() => { const b = document.querySelector('.rp-doc-body'); if (b) b.scrollTop = 700; });
    await page.waitForTimeout(250);
    await shot(page, `doc-1600-en-${fw}-mid`);
    for (const loc of ['es', 'pl']) {
      await page.evaluate((l) => window.__ascent.setLocale(l), loc);
      await page.waitForTimeout(500);
      await page.evaluate(() => { const b = document.querySelector('.rp-doc-body'); if (b) b.scrollTop = 0; });
      await shot(page, `doc-1600-${loc}-${fw}`);
    }
    await page.evaluate(() => window.__ascent.setLocale('en'));
    await page.waitForTimeout(350);
    docShots[fw] = await page.evaluate(() => document.querySelector('.rp-std-sheet')?.innerText || '');
  }

  // Two copies of the control, one setting. If they can disagree, a teacher can
  // print a sheet in a framework the screen behind it is not showing.
  const inSync = await page.evaluate(() => {
    const a = document.querySelector('.rp-card .rp-frame-b.on')?.dataset.frame;
    const b = document.querySelector('.rp-doc .rp-frame-b.on')?.dataset.frame;
    return { a, b };
  });

  // --- what comes out of the printer --------------------------------------
  // The sheet only counts as an artifact if it survives @media print, so it is
  // photographed the way a department head would receive it: paper media, full
  // page, with the WebGL canvas and the whole HUD gone.
  await PICK(page, 'teks', '.rp-doc');
  await page.waitForTimeout(300);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'print-en-teks.png'), fullPage: true });
  shots.push('print-en-teks.png');
  const printOk = await page.evaluate(() => {
    const doc = document.querySelector('.rp-std-sheet');
    const canvas = document.querySelector('canvas');
    return {
      sheet: !!doc && doc.getBoundingClientRect().height > 300,
      canvasHidden: !canvas || getComputedStyle(canvas).display === 'none'
        || canvas.getBoundingClientRect().height === 0,
      otherPanes: [...document.querySelectorAll('.rp-pane')]
        .filter((p) => !p.classList.contains('p-std'))
        .every((p) => getComputedStyle(p).display === 'none'),
    };
  });
  await page.emulateMedia({ media: 'screen' });
  await page.waitForTimeout(300);

  // exports, in the framework now chosen
  const exported = await page.evaluate(() => {
    const rec = window.__ascent.report.record({ name: 'Ada Wiśniewska', group: 'Period 3' });
    return { framework: rec.framework, standards: rec.standards, learner: rec.learner };
  });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // --- persistence ---------------------------------------------------------
  await OPEN_REPORT(page);
  await PICK(page, 'teks');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const persisted = await page.evaluate(() => window.__ascent.report.snapshot().framework);

  return { played, save, snaps, models, docShots, exported, persisted, printOk, inSync };
});

// ------------------------------------------------------------------ phone run
await session(414, 896, 'phone', async (page) => {
  await page.evaluate((s) => {
    for (const [k, v] of Object.entries(JSON.parse(s))) if (v != null) localStorage.setItem(k, v);
  }, summary.save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1400);
  await OPEN_REPORT(page);
  for (const fw of ['ccss', 'teks']) {
    await PICK(page, fw);
    await TO_COVER(page);
    await shot(page, `cover-414-en-${fw}`);
    await page.evaluate(() => {
      const r = document.querySelector('.rp-cgrp.c-held .rp-crow, .rp-cgrp.c-part .rp-crow, .rp-cgrp.c-working .rp-crow');
      if (r) r.click();
    });
    await page.waitForTimeout(350);
    await TO_COVER(page);
    await shot(page, `cover-414-en-${fw}-open`);
    for (const loc of ['es', 'pl']) {
      await page.evaluate((l) => window.__ascent.setLocale(l), loc);
      await page.waitForTimeout(450);
      await TO_COVER(page);
      await shot(page, `cover-414-${loc}-${fw}`);
    }
    await page.evaluate(() => window.__ascent.setLocale('en'));
    await page.waitForTimeout(400);
  }
  await page.click('.rp-teacher');
  await page.waitForTimeout(500);
  await page.click('.rp-tab[data-tab="std"]');
  await page.waitForTimeout(500);
  await shot(page, 'doc-414-en-std');
  await page.evaluate(() => window.__ascent.setLocale('pl'));
  await page.waitForTimeout(500);
  await shot(page, 'doc-414-pl-std');
  return null;
});

// ---------------------------------------------------------------------- audit
console.log('\nAUDIT');
for (const fw of ['ccss', 'teks']) {
  const snap = summary.snaps[fw];
  const model = summary.models[fw];
  if (snap.framework !== fw) fail(`snapshot framework is ${snap.framework}, expected ${fw}`);
  const byCode = new Map(snap.coverage.rows.map((r) => [r.code, r]));
  const std = MAPS[fw].standards;
  if (byCode.size !== std.length) fail(`${fw}: screen shows ${byCode.size} expectations, the map has ${std.length}`);

  let checked = 0;
  for (const s of std) {
    const code = s.code.replace('CCSS.MATH.CONTENT.', '');
    const row = byCode.get(code);
    if (!row) { fail(`${fw}: ${code} is missing from the report`); continue; }
    // Re-derive from the learner model, with no help from the report.
    let answers = 0, unaided = 0, formsMet = 0;
    for (const id of s.nodes || []) {
      const seen = model[id]?.formsSeen || {};
      for (const f of s.evidence || []) {
        const r = seen[f];
        if (!r || !r.seen) continue;
        formsMet += 1; answers += r.seen; unaided += r.correct;
      }
    }
    if (row.answers !== answers) fail(`${fw} ${code}: report says ${row.answers} answers, the learner model says ${answers}`);
    if (row.unaided !== unaided) fail(`${fw} ${code}: report says ${unaided} unaided, the learner model says ${unaided}`);
    if (row.formsMet !== formsMet) fail(`${fw} ${code}: report says ${row.formsMet} question types met, the model says ${formsMet}`);
    if (row.formsDeclared !== (s.evidence || []).length) fail(`${fw} ${code}: declared question types disagree with the map`);
    // Coverage may never be derivable from the content map alone. With no
    // answers against this expectation's own item forms, the only two honest
    // states are "untouched" and "the line is proved but nothing here is".
    const heldNow = (s.nodes || []).filter((id) => model[id]?.mastered).length;
    if (!answers && !['none', 'indirect'].includes(row.cover)) {
      fail(`${fw} ${code}: no answers on its own item forms, but the screen calls it "${row.cover}"`);
    }
    if (!answers && heldNow && row.cover !== 'indirect') fail(`${fw} ${code}: a proved line with no direct evidence must read as indirect`);
    if (!answers && !heldNow && row.cover !== 'none') fail(`${fw} ${code}: nothing at all, but the screen calls it "${row.cover}"`);
    if (answers && row.cover === 'none') fail(`${fw} ${code}: ${answers} answers, but the screen calls it untouched`);
    if (row.cover === 'held' && (!answers || row.heldLines !== row.totalLines)) {
      fail(`${fw} ${code}: called held on ${answers} answers and ${row.heldLines}/${row.totalLines} lines`);
    }
    // depth must be present and must match the map
    const depths = new Set((s.nodes || []).map((id) => s.nodeDepth?.[id] || s.depth));
    if (!depths.has(row.depth)) fail(`${fw} ${code}: depth ${row.depth} is not one of ${[...depths].join('/')}`);
    if (!row.depth) fail(`${fw} ${code}: no depth on screen`);
    const held = (s.nodes || []).filter((id) => model[id]?.mastered).length;
    if (row.heldLines !== held) fail(`${fw} ${code}: says ${row.heldLines} lines proved, the model says ${held}`);
    checked += 1;
  }
  ok(`${fw}: ${checked} expectations re-derived from the learner model`);
  const t = snap.coverage.totals;
  ok(`${fw}: ${t.evidenced}/${t.total} with evidence · core ${t.coreHeld}/${t.coreTotal} · untouched ${t.none}`);
  if (t.total !== t.held + t.part + t.indirect + t.working + t.none) fail(`${fw}: the coverage groups do not add up to ${t.total}`);
  if (t.evidenced !== snap.coverage.rows.filter((r) => r.answers > 0).length) fail(`${fw}: the "with evidence" figure counts rows with no answers`);
  if (!t.none) fail(`${fw}: nothing is untouched — this run did not produce a partial state`);
  if (!t.held && !t.part) fail(`${fw}: nothing is held — this run did not produce a partial state`);
}

if (summary.persisted !== 'teks') fail(`the framework choice did not survive a reload (came back "${summary.persisted}")`);
else ok('the framework choice survives a reload');

if (!summary.exported.standards) fail('the exported record carries no standards coverage');
else ok(`the exported record carries ${summary.exported.standards.rows.length} expectations in ${summary.exported.framework}`);

if (summary.inSync.a !== summary.inSync.b) fail(`the two framework switches disagree: report ${summary.inSync.a}, record ${summary.inSync.b}`);
else ok('both framework switches read the same choice');

if (!summary.printOk.sheet) fail('the standards sheet is empty when the page is printed');
if (!summary.printOk.canvasHidden) fail('the game canvas is still on the page when it is printed');
if (!summary.printOk.otherPanes) fail('printing the standards tab also prints the other tabs');
if (summary.printOk.sheet && summary.printOk.canvasHidden && summary.printOk.otherPanes) ok('the standards sheet prints on its own, with the game gone');

for (const fw of ['ccss', 'teks']) {
  const txt = summary.docShots[fw] || '';
  if (!txt.includes('Ada Wiśniewska')) fail(`${fw}: the printable standards sheet has no student name on it`);
  if (!/\d{4}/.test(txt)) fail(`${fw}: the printable standards sheet has no date on it`);
}
ok('the printable standards sheet carries a name and a date');

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'audit.json'), JSON.stringify({
  shots, findings, errors, played: summary.played,
  totals: { ccss: summary.snaps.ccss.coverage.totals, teks: summary.snaps.teks.coverage.totals },
}, null, 2));

console.log(`\nitems played: ${summary.played.items} · fps ${JSON.stringify(summary.played.fps)}`);
console.log(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('  !', e.tag, e.type, e.text.slice(0, 220));
console.log(`${findings.length ? findings.length + ' FINDINGS' : 'no findings'} · ${shots.length} frames -> ${OUT}`);
await browser.close();
process.exit(findings.length || errors.length ? 1 : 0);
