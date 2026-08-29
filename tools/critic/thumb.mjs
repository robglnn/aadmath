#!/usr/bin/env node
/**
 * THE PHONE'S REACH — is the control big enough for a thumb, and is the
 * MATHEMATICS bigger than the machinery around it?
 *
 * WHY THIS FILE EXISTS.
 *
 * The client plays this game on a phone. Three separate things were true of
 * that phone at once, and every gate in the build was green through all three:
 *
 *   1. THREE OF THE FOUR TOUCH VERBS WERE UNDER THE PUBLISHED MINIMUM. Apple's
 *      Human Interface Guidelines and Google's Material guidance both name the
 *      same floor for a touch target — 44 x 44 CSS px — and DASH, GLIDE and
 *      INTERACT were 38 x 38 sideways and 40 x 40 held up. Only JUMP cleared
 *      it. `tools/critic/touch.mjs` had measured all four buttons and printed
 *      their sizes in its own output on every run, and asserted nothing about
 *      them: it asked whether the button could be HIT, never whether a thumb
 *      could hit it.
 *
 *   2. CALL THE ECHO — `#rf-hint`, the only route in this entire game to the
 *      faded worked echo that BRIEF.md's fourth invariant is about, the thing
 *      a stuck learner reaches for — was 111 x 22 CSS px. It was the SMALLEST
 *      CONTROL ON THE CARD. The close cross was 25 x 25, and 18 x 18 on a
 *      phone held sideways.
 *
 *   3. THE COORDINATE CHART, WHICH IS THE QUESTION, WAS SMALLER THAN THE
 *      KEYPAD. 305 x 305 against a 366 px keypad at 1600x900 — 17% narrower —
 *      and 296 against 372 on a 390 px handset, 19% narrower. Reported in
 *      three consecutive rounds, unchanged to the decimal each time, because
 *      nothing measured the two things against each other. Every gate that
 *      looks at a figure asks whether it is legible ON ITS OWN: `check:figures
 *      --charts` measures a grid square in CSS px and passes at 4. None of
 *      them asks the question a learner asks, which is *which of the things on
 *      this screen is the important one*.
 *
 * And a fourth, which is what a size gate finds when it is pointed at a phone:
 *
 *   4. THE KEYPAD LOST ITS KEYPAD SHAPE SIDEWAYS. src/ui/landscape.css laid the
 *      keys out in SIX columns to buy back two rows of height, and the keys are
 *      built in the DOM as 7 8 9 ⌫ / 4 5 6 ± / 1 2 3 ÷ / 0 CLEAR, so the grid
 *      reflowed them into 7 8 9 ⌫ 4 5 / 6 ± 1 2 3 ÷ / 0 0 0 CLEAR. Four and
 *      five sat on the top row beside nine. Every phone, calculator and cash
 *      machine a student has ever touched puts 4 under 7; a keypad that does
 *      not is a keypad nobody can use without looking at it.
 *
 * WHAT IT ASSERTS.
 *
 *   REACH   Every interactive control on screen, on a COARSE pointer, is at
 *           least 44 x 44 CSS px. Coarse, not "small screen": the thing that
 *           needs 44 px is a finger, so a touchscreen Chromebook at 1366 px is
 *           in and a 390 px window on a desktop is not.
 *   SCALE   Wherever a coordinate chart and a keypad stand on the same card,
 *           the chart is not narrower than the keypad.
 *   SHAPE   The digits are where a phone puts them: 7 8 9 across the top, 4 5 6
 *           under them, 1 2 3 under that, 0 below, each column aligned.
 *
 * WHERE IT LOOKS. Two surfaces, both real:
 *
 *   · the world frame at rest, in the shipped build, on a real phone profile —
 *     the on-screen pad's four verbs and the band's own controls;
 *   · the rift card, in the real `RiftPanel` with the real stylesheets and a
 *     real generated item, over 6 phone profiles x 3 locales. It is the same
 *     harness `tools/check-figures.mjs --charts` uses (`serveFrozen`), so the
 *     panel being measured is the panel that ships.
 *
 * WHAT IT DOES NOT LOOK AT, said out loud: a surface it does not raise. The
 * build hotbar's slots, the foundry, the report and the menu are not opened
 * here, so this gate says nothing about them. `.slot` is 38 x 34 sideways and
 * 44 x 40 held up in src/ui/landscape.css and src/ui/portrait.css, which is
 * under the floor, and that is a finding this gate is not the one to make.
 *
 * SELF-TEST. `--self-test` plants three faults in the real panel and requires
 * the gate to catch each of them by name, and requires the honest panel beside
 * them to stay clean — a rule that fires on honest content gets switched off:
 *
 *   1. one control cut to 38 x 38, the exact size the pad's verbs were;
 *   2. the coordinate chart cut to 60% of the keypad's width, the shape of the
 *      defect three rounds of critics reported;
 *   3. the keypad's grid put back to six columns, so four and five climb onto
 *      the top row beside nine.
 *
 *   node tools/critic/thumb.mjs --self-test
 *   tools/critic/rungate.sh tools/critic/thumb.mjs --out shots/thumb
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serveFrozen } from '../check-figures.mjs';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);
const URL = arg('url', '');
const OUT = path.resolve(arg('out', 'shots/thumb'));
const LOCALES = arg('locales', 'en,es,pl').split(',').filter(Boolean);

/* ---- THE BAR. A floor is never lowered. -------------------------------- */
/** Apple HIG and Material both publish 44. Not 38, not 40, not "at this density". */
const TOUCH_PX = 44;
/** Sub-pixel slack on a comparison of two measured widths. Nothing else. */
const EPS = 0.5;
/** Two keys are on the same row if their tops are within this many px. */
const ROW_PX = 4;

/**
 * The phone profiles. Portrait, landscape, and a SHORT landscape — a phone on
 * its side with the browser's own chrome on screen has far less height than
 * its layout viewport claims, and a measurement taken only at the roomy sizes
 * is a measurement about a phone nobody is holding. Same list as
 * tools/critic/touch.mjs, plus the two larger handsets the layout matrix uses.
 */
const PROFILES = [
  { name: '390x844', w: 390, h: 844 },
  { name: '414x896', w: 414, h: 896 },
  { name: '844x390', w: 844, h: 390 },
  { name: '896x414', w: 896, h: 414 },
  { name: '926x428', w: 926, h: 428 },
  { name: '568x320', w: 568, h: 320 },
];

/** One item with a coordinate chart, and two with none — the card the keypad
 *  is composed on when it has the stage to itself. */
const SPECS = [
  { skill: 'eval-expr', d: 2, seed: 4242, tag: 'chart' },
  { skill: 'eval-expr', d: 4, seed: 16020, tag: 'chart' },
  { skill: 'like-terms', d: 3, seed: 4242, tag: 'plain' },
  { skill: 'multi-step', d: 3, seed: 4242, tag: 'plain' },
  /* THE SORTING BOARD, NAMED BY FORM AND AT ITS DENSEST — four bays and seven
     loose terms. The `like-terms` row above it names no form, so which surface
     it draws is the scheduler's choice and the sorter was measured only by
     luck; and the sorter is the card with the most controls on it in the whole
     rig. Its loose terms are `<button>`s, so this selector always covered them
     — and they were 22 x 22 CSS px at 844x390, because no profile in this list
     was ever handed a board with more than two bays on it. */
  { skill: 'like-terms', d: 5, seed: 4242, form: 'lt-bays', tag: 'bays' },
];

/* ======================================================== the page side == */

/**
 * Read every interactive control, the chart, and the keypad's geometry out of
 * one root. Written as a plain function so both surfaces — the world frame and
 * the rift harness — are measured by THE SAME CODE. A gate with one detector
 * per surface is two gates with one name.
 */
const PROBE = (rootSel) => {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return { missing: rootSel };
  const SEL = 'button, a[href], input, select, textarea, [role="button"], [role="tab"],'
    + ' [role="checkbox"], [tabindex]:not([tabindex="-1"]),'
    + ' .rf-key, .rf-reading, .rf-bay, .rf-move, .rf-cell, .slot, .place, .sound';
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) {
      s += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
    }
    return s;
  };
  const shown = (el) => {
    let n = el, op = 1;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      op *= parseFloat(cs.opacity || '1');
      if (op < 0.12) return false;
      n = n.parentElement;
    }
    return true;
  };

  const controls = [];
  for (const el of root.querySelectorAll(SEL)) {
    if (!shown(el)) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // A control scrolled out of the frame entirely is not on this screen.
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
    controls.push({
      sel: name(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22),
    });
  }

  const box = (sel) => {
    const e = root.querySelector(sel);
    if (!e || !shown(e)) return null;
    const r = e.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  };

  // The keypad's digits, as drawn. `data-g` is the glyph the cap emits and is
  // published by src/ui/rift.js for exactly this reason: the gate asks the
  // surface where its keys are rather than being told by a stylesheet.
  const digits = {};
  for (const el of root.querySelectorAll('.rf-key[data-g]')) {
    const g = el.dataset.g;
    if (!/^[0-9]$/.test(g) || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    digits[g] = { x: +r.left.toFixed(1), y: +r.top.toFixed(1) };
  }

  return {
    controls,
    coarse: matchMedia('(pointer: coarse)').matches,
    fig: box('.rf-fig.grid svg') || box('.rf-plot-stage svg'),
    pad: box('.rf-pad'),
    digits,
  };
};

/** The same probe, as a string, so a page can run it with no argument. */
const PROBE_SRC = `(${PROBE.toString()})(null)`;

/* ======================================================== the rules ====== */

/** REACH — every control clears the published floor. One finding per control. */
function ruleReach(p, where) {
  if (!p.coarse) return [`${where}: the page did not report a coarse pointer, so this reading is about a mouse and proves nothing`];
  const out = [];
  for (const c of p.controls) {
    if (c.w + EPS >= TOUCH_PX && c.h + EPS >= TOUCH_PX) continue;
    out.push(`${where}: ${c.sel} "${c.label}" is ${c.w}x${c.h} CSS px — under the published ${TOUCH_PX}x${TOUCH_PX} floor for a touch target`);
  }
  return out;
}

/** SCALE — the question is never narrower than the instrument answering it. */
function ruleScale(p, where) {
  if (!p.fig || !p.pad) return [];
  if (p.fig.w + EPS >= p.pad.w) return [];
  const pct = (100 * (1 - p.fig.w / p.pad.w)).toFixed(1);
  return [`${where}: THE CHART IS THE QUESTION AND IT IS ${pct}% NARROWER THAN THE KEYPAD ANSWERING IT`
    + ` — chart ${p.fig.w}x${p.fig.h}, keypad ${p.pad.w} CSS px wide`];
}

/** SHAPE — 7 8 9 / 4 5 6 / 1 2 3 / 0, the way every phone draws it. */
function ruleShape(p, where) {
  const d = p.digits;
  if (!d['7'] || !d['1']) return [];
  const out = [];
  const rowOf = (g) => (d[g] ? d[g].y : null);
  const rows = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']];
  for (const r of rows) {
    if (!r.every((g) => d[g])) return out;         // a pad that does not carry them all
    const ys = r.map(rowOf);
    if (Math.max(...ys) - Math.min(...ys) > ROW_PX) {
      out.push(`${where}: ${r.join(' ')} are not on one row — tops at ${ys.map((y) => Math.round(y)).join(', ')}.`
        + ` A keypad whose digits are not where a phone keypad puts them is a keypad nobody can use without looking at it`);
    }
    const xs = r.map((g) => d[g].x);
    if (!(xs[0] < xs[1] && xs[1] < xs[2])) {
      out.push(`${where}: ${r.join(' ')} do not run left to right — lefts at ${xs.map((x) => Math.round(x)).join(', ')}`);
    }
  }
  if (rowOf('4') <= rowOf('7') + ROW_PX) out.push(`${where}: 4 is not below 7 (tops ${Math.round(rowOf('4'))} and ${Math.round(rowOf('7'))})`);
  if (rowOf('1') <= rowOf('4') + ROW_PX) out.push(`${where}: 1 is not below 4 (tops ${Math.round(rowOf('1'))} and ${Math.round(rowOf('4'))})`);
  if (d['0'] && rowOf('0') <= rowOf('1') + ROW_PX) out.push(`${where}: 0 is not below 1 (tops ${Math.round(rowOf('0'))} and ${Math.round(rowOf('1'))})`);
  for (const col of [['7', '4', '1'], ['8', '5', '2'], ['9', '6', '3']]) {
    const xs = col.map((g) => d[g].x);
    if (Math.max(...xs) - Math.min(...xs) > ROW_PX) {
      out.push(`${where}: ${col.join(' ')} are not in one column — lefts at ${xs.map((x) => Math.round(x)).join(', ')}`);
    }
  }
  return out;
}

/* ==================================================== the rift surface === */

const settle = `(async () => {
  const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await f(); await new Promise((r) => setTimeout(r, 0)); await f();
})()`;

/**
 * @param {object} plant which fault to put in the real panel, if any.
 *        'control' 38x38, 'figure' 60% of the keypad, 'shape' six columns.
 */
async function riftSweep(page, { profiles, locales, specs, plant = null, shot = null }) {
  const problems = [];
  let measured = 0;
  const seen = [];
  for (const vp of profiles) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.evaluate(settle);
    for (const locale of locales) {
      for (const spec of specs) {
        await page.evaluate(async ({ spec, locale, plant }) => {
          document.getElementById('thumb-plant')?.remove();
          window.__show({ ...spec, locale });
          const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          await f(); await new Promise((r) => setTimeout(r, 0)); await f();
          if (plant) {
            const st = document.createElement('style');
            st.id = 'thumb-plant';
            // Exactly the three shapes this gate exists to refuse, put into the
            // REAL panel through the REAL stylesheet cascade.
            st.textContent = plant === 'control'
              ? '.rf-key[data-g="7"] { min-height: 38px !important; height: 38px !important; width: 38px !important; }'
              : plant === 'figure'
                ? '.rf-fig.grid { max-width: 60% !important; }'
                : '.rf-keys { grid-template-columns: repeat(6, 1fr) !important; }';
            document.head.appendChild(st);
            await f();
          }
        }, { spec, locale, plant });
        const p = await page.evaluate(PROBE_SRC);
        measured++;
        const where = `rift ${spec.skill}${spec.form ? '/' + spec.form : ''} d${spec.d} · ${vp.name} · ${locale}`;
        seen.push({ where, fig: p.fig, pad: p.pad, controls: p.controls.length });
        problems.push(...ruleReach(p, where), ...ruleScale(p, where), ...ruleShape(p, where));
        if (shot && locale === 'en' && spec.tag === 'chart' && spec.d === 2) {
          await page.screenshot({ path: path.join(shot, `rift-${vp.name}-${locale}.png`) });
        }
      }
    }
  }
  return { problems, measured, seen };
}

/* =================================================== the world surface === */

async function worldSweep(browser, { url, locales, out }) {
  const problems = [];
  const errors = [];
  let measured = 0;
  const seen = [];
  for (const locale of locales) {
    for (const vp of PROFILES.slice(0, 3)) {
      const ctx = await browser.newContext({
        ...devices['iPhone 13'],
        viewport: { width: vp.w, height: vp.h }, screen: { width: vp.w, height: vp.h },
        hasTouch: true, isMobile: true, deviceScaleFactor: 2,
        locale: locale === 'es' ? 'es-ES' : locale === 'pl' ? 'pl-PL' : 'en-US',
      });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${vp.name} ${locale}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${vp.name} ${locale}: ${m.text()}`); });
      await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private mode */ } }, locale);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
      await page.waitForTimeout(6000);
      const p = await page.evaluate(PROBE, null);
      measured++;
      const where = `world · ${vp.name} · ${locale}`;
      seen.push({ where, controls: p.controls.length });
      problems.push(...ruleReach(p, where));
      if (out && locale === 'en') await page.screenshot({ path: path.join(out, `world-${vp.name}-${locale}.png`) });
      await ctx.close();
    }
  }
  return { problems, measured, errors, seen };
}

/* ========================================================= self-test ===== */

async function selfTest() {
  console.log('ASCENT — the phone\'s reach · self-test');
  console.log('Three faults, planted in the REAL panel through the REAL cascade. The gate must');
  console.log('name each one, and must stay quiet on the honest panel beside it.\n');
  const server = await serveFrozen();
  const browser = await chromium.launch();
  let ok = true;
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false,
    });
    await page.goto(server.base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

    const profiles = [PROFILES[0], PROFILES[2]];
    const specs = [SPECS[0], SPECS[2]];

    const clean = await riftSweep(page, { profiles, locales: ['en'], specs });
    console.log(`  the honest panel, ${clean.measured} readings: ${clean.problems.length} problem(s)`);
    for (const p of clean.problems) console.log('     · ' + p);
    for (const s of clean.seen) {
      if (s.fig && s.pad) console.log(`     ${s.where}: chart ${s.fig.w}, keypad ${s.pad.w} — chart is ${(100 * (s.fig.w / s.pad.w - 1)).toFixed(1)}% wider`);
    }
    if (clean.problems.length) { console.log('  FAIL — the gate fires on honest content, so it would be switched off.'); ok = false; }

    for (const [plant, want, why] of [
      ['control', /under the published 44x44 floor/, 'one key cut to 38 x 38 — the size the pad\'s verbs were'],
      ['figure', /NARROWER THAN THE KEYPAD/, 'the chart cut to 60% of the keypad — the shape three critics reported'],
      ['shape', /not on one row|not below/, 'the keypad put back to six columns — 4 and 5 climb onto the top row'],
    ]) {
      const r = await riftSweep(page, { profiles, locales: ['en'], specs, plant });
      const caught = r.problems.filter((x) => want.test(x));
      console.log(`\n  PLANTED: ${why}`);
      console.log(`     ${caught.length ? 'CAUGHT' : 'MISSED'} — ${caught.length} matching finding(s) of ${r.problems.length}`);
      for (const c of caught.slice(0, 3)) console.log('       · ' + c);
      if (!caught.length) ok = false;
    }
    await page.evaluate(() => document.getElementById('thumb-plant')?.remove());
  } finally {
    await browser.close();
    await server.stop();
  }
  console.log(ok
    ? '\nself-test: PASS — every rule was watched to refuse its own defect, and none of them fired on the honest panel.'
    : '\nself-test: FAIL — a rule did not catch its planted defect, or fired on honest content.');
  return ok;
}

/* ============================================================== main ===== */

if (has('self-test')) {
  const ok = await selfTest();
  process.exit(ok ? 0 : 1);
}

await mkdir(OUT, { recursive: true });
console.log('ASCENT — the phone\'s reach (44 px targets, and the question bigger than the instrument)');

const problems = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });

/* ---- 1. the rift card, in the real panel ---- */
const server = await serveFrozen();
let riftMeasured = 0;
let widest = null;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(server.base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const r = await riftSweep(page, { profiles: PROFILES, locales: LOCALES, specs: SPECS, shot: OUT });
  riftMeasured = r.measured;
  problems.push(...r.problems);
  for (const s of r.seen) {
    if (!s.fig || !s.pad) continue;
    const ratio = s.fig.w / s.pad.w;
    if (!widest || ratio < widest.ratio) widest = { ratio, ...s };
  }
  if (errs.length) problems.push(`console errors in the rift harness: ${errs.slice(0, 3).join(' | ')}`);
} finally {
  await server.stop();
}
console.log(`  rift card: ${riftMeasured} reading(s) over ${PROFILES.length} phone profiles x ${LOCALES.length} locales`);
if (widest) {
  console.log(`     tightest chart-to-keypad ratio: ${widest.ratio.toFixed(2)}x  (${widest.where}: chart ${widest.fig.w}, keypad ${widest.pad.w})`);
}

/* ---- 2. the world frame, in the shipped build ---- */
if (URL) {
  const w = await worldSweep(browser, { url: URL, locales: LOCALES, out: OUT });
  problems.push(...w.problems);
  if (w.errors.length) problems.push(`console errors in the world frame: ${w.errors.slice(0, 3).join(' | ')}`);
  console.log(`  world frame: ${w.measured} reading(s), ${w.seen.reduce((a, b) => a + b.controls, 0)} control(s) measured`);
} else {
  problems.push('NOT MEASURED: no --url, so the world frame — the on-screen pad and the band\'s controls — was not read.'
    + ' Run this through tools/critic/rungate.sh, which builds the tree and hands it a URL.');
}

await browser.close();

console.log('\n──────────────────────────────────────────────');
if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const p of problems.slice(0, 60)) console.error('  · ' + p);
  if (problems.length > 60) console.error(`  … and ${problems.length - 60} more`);
} else {
  console.log('every control a thumb can reach is at least 44 x 44 CSS px,');
  console.log('the coordinate chart is never narrower than the keypad answering it, and the digits');
  console.log('are where a phone puts them, at every phone size, in all three languages.');
}
console.log(`shots in ${OUT}`);
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The phone is where the
   client plays, so a control a thumb cannot land on is in front of a learner
   today. THIS GATE WAS THE ONE THE ACCOUNTING NEARLY MISSED: it imports
   `serveFrozen` from tools/check-figures.mjs, and a transitive module walk read
   that as "its verdict goes through the collector" when the bottom of this file
   still said `process.exit(0)`. Borrowing a library is not borrowing a verdict.
   See `usesCollector` in tools/check-all.mjs. */
findings('check:reach', { scope: 'route' }).route(problems.map(String)).done();
