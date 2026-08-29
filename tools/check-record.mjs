#!/usr/bin/env node
/**
 * THE TEACHER RECORD GATE.
 *
 *   node tools/check-record.mjs --self-test     # the gate proves it can fail
 *   node tools/check-record.mjs                 # builds, serves, plays, judges
 *   node tools/check-record.mjs --url http://127.0.0.1:5173
 *   node tools/check-record.mjs --out shots/record
 *
 * WHY IT EXISTS. Measured in the shipped build, on 2026-08-19, driven with real
 * key events:
 *
 *   · `?unit=algebra1-l2` and `?unit=algebra1-l3` both rendered the SAME 23
 *     Level 1 Common Core rows, every one reading "lines proved: 0 of 0", while
 *     the learner was working 14 or 11 lines carrying 30-odd expectations that
 *     appeared nowhere.
 *   · the STANDARDS column of the printed teacher record was blank on every
 *     line of every unit after the first: 14/14 on Level 2, 11/11 on Level 3,
 *     14/14 on Level 4, and 0/10 on Level 1.
 *   · the record was titled "Algebra I · Level 1 · The Cipher Worlds" on every
 *     unit, including the quadratics unit.
 *
 * Every one of those is a document a teacher would file about a child, saying
 * something that is not true of that child. None of them was caught by any
 * gate, because every gate ran on the default unit.
 *
 * SO THIS ONE RUNS ON EVERY UNIT THE MANIFEST SHIPS, and it judges the RENDERED
 * DOCUMENT, not the model behind it. Seven assertions, the first five of them
 * a defect above and the last two the class of defect that produced them:
 *
 *   1. NO UNIT RENDERS ANOTHER UNIT'S STANDARDS. Every code on screen is cited
 *      by a node of the graph that unit actually loads, in that framework.
 *   2. NO UNIT HIDES ITS OWN. Every code the graph cites is on screen.
 *   3. NO LINE SHIPS WITH A BLANK STANDARDS COLUMN.
 *   4. THE RECORD NAMES THE UNIT IT IS ABOUT.
 *   5. NO CODE SHIPS AT AN UNKNOWN DEPTH, in either framework.
 *   6. NO EXPECTATION IS EVIDENCED BY NOTHING. Every row of the coverage sheet
 *      names at least one line of the running graph, and no row claims more
 *      lines held than it has. "Lines held 0 of 0" was the printed shape of the
 *      whole defect: rows from an imported file, lines from the running unit.
 *   8. THE DOCUMENT COMES OUT OF THE PRINTER WHOLE, IN EVERY LANGUAGE. Ink,
 *      not boxes: every rendered text run inside the printed sheet, against the
 *      right edge of the sheet, at the four widths a print engine hands the
 *      document, in EN, ES and PL. The headline strip was a column-flow grid
 *      with `overflow-x:auto` under it — a strip a reader can push on glass,
 *      and a guillotine on paper — and the statistic it cut was CLAIMS
 *      WITHDRAWN, the last one. Measured: 978px needed in English, 1141 in
 *      Polish, 1180 in Spanish; US Letter landscape gives 965 and A4 landscape
 *      1032, so English printed whole and the other two lost their last column.
 *      This rule PLANTS THAT STRIP BACK in the real page on every ordinary run
 *      and refuses to report on anything unless it caught it and then let the
 *      honest page through.
 *
 *   7. NO PRINTED DEPTH DIFFERS FROM THE GRAPH'S. Every `CODE (depth)` on the
 *      record, per line and in the headline, is the depth that line's node
 *      declares in the graph file. `alignmentOf()` used to default a missing
 *      depth to `core` — the strongest claim the schema can make, handed out
 *      for free — while the hand-written map said `supporting` for nine Level 1
 *      standards. The screen happened to read the map, so nothing on screen was
 *      wrong and nothing would have been until a course read the graph. A rule
 *      that only fires when the two disagree is the only thing that keeps them
 *      from drifting apart again.
 *
 * HOW IT DRIVES. Real key events and real clicks: `P` opens the report, the
 * framework switch is clicked, the teacher button is clicked. `window.__ascent`
 * is read for facts — is the report on screen — and never used to put anything
 * there. See the rule at the head of RESUME.md.
 *
 * THE EXPECTATION IT CHECKS AGAINST is read off `content/courses.json` and the
 * graph files. The code lists come through `alignmentOf()` — the same reader
 * the content gate uses, on the node side rather than the screen side. THE
 * DEPTHS DO NOT: they are read straight out of the JSON by `rawDepths()` below,
 * which knows both graph shapes and defaults nothing, because the defect rule 7
 * exists for lived inside a reader's default. A gate that asks the suspect
 * reader what the answer is has not checked anything.
 *
 * WHAT IT DOES NOT COVER, said here rather than left to be discovered. Each
 * unit is opened on its own with `?unit=`. A learner walking the route has more
 * than one unit open at once and the report is drawn on the composed lattice;
 * that composition is not driven here, because reaching it honestly means
 * proving every line of Level 1 with real keys first, and a gate that takes an
 * hour is a gate that gets switched off. The per-unit reading is what this
 * proves.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort } from './_freeport.mjs';
import { alignmentOf } from '../src/content/standards.js';
import { findings as ledger } from './_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const SELF = process.argv.includes('--self-test');
const OUT = path.resolve(arg('out', 'shots/record'));
const ITEMS = Number(arg('items', 4));

// i18n-allow: framework keys, not language
const FRAMEWORKS = ['ccss', 'teks'];
// i18n-allow: locale ids, not language
const LOCALES = ['en', 'es', 'pl'];
const GRAPH_FRAMEWORK = { ccss: 'CCSS-M', teks: 'TEKS' };
const DEPTHS = ['core', 'supporting', 'introduced'];
/** Strongest first — the headline depth of a code is the strongest it reaches. */
const RANK = { core: 3, supporting: 2, introduced: 1 };
const CCSS_PREFIX = 'CCSS.MATH.CONTENT.'; // i18n-allow: a standards identifier
const short = (c) => String(c).replace(CCSS_PREFIX, '');

/**
 * Every depth one node declares, straight out of the graph JSON, keyed by short
 * code. This deliberately does NOT call `alignmentOf()`: the defect rule 7
 * exists for was a default inside that reader, and a check that asks the reader
 * under suspicion for the answer has checked nothing. It knows both graph
 * shapes — the legacy `standards` / `teks` arrays Level 1 uses, and the unified
 * `alignment` array every unit after it uses — and it defaults nothing.
 */
function rawDepths(node, framework) {
  const want = GRAPH_FRAMEWORK[framework];
  const out = {};
  const take = (rows, fw) => {
    for (const a of rows || []) {
      if ((a.framework || fw) !== want) continue;
      out[short(a.code)] = a.depth ?? null;
    }
  };
  if (Array.isArray(node.alignment)) take(node.alignment, 'CCSS-M');
  take(node.standards, 'CCSS-M');
  take(node.teks, 'TEKS');
  return out;
}

// ---------------------------------------------------------------------------
// THE JUDGEMENT — pure, so the self-test can plant the real defect in it
// ---------------------------------------------------------------------------

/**
 * Judge one reading of one unit against what that unit's graph actually cites.
 *
 * A READING is what came off the screen:
 *   { unit, frameworks: { ccss: { codes, depths, lines, held, title, rows }, … } }
 * where `lines` and `held` are the two numbers each coverage row prints in
 * words, and `rows` is one entry per line of the printed record, carrying the
 * skill's name, its node id, the text of its standards cell, and that same cell
 * as `code:depth` pairs in the graph's words rather than the locale's.
 *
 * An EXPECTATION is what the graph says:
 *   { unit, titles, frameworks: { ccss: { codes: [...], depthByNode: {…} }, … } }
 *
 * @returns {Array<{unit:string, framework:string, kind:string, detail:string}>}
 */
export function judge(reading, expect) {
  const bad = [];
  const fail = (framework, kind, detail) => bad.push({ unit: reading.unit, framework, kind, detail });

  for (const fw of FRAMEWORKS) {
    const got = reading.frameworks?.[fw];
    const want = expect.frameworks?.[fw];
    if (!got) { fail(fw, 'no-view', 'the report never rendered this framework'); continue; }

    const onScreen = new Set(got.codes || []);
    const inGraph = new Set(want?.codes || []);

    // 1. no unit renders another unit's standards
    const alien = [...onScreen].filter((c) => !inGraph.has(c));
    if (alien.length) {
      fail(fw, 'foreign-standards',
        `${alien.length} code(s) on screen that no node of ${reading.unit} cites: ${alien.slice(0, 6).join(', ')}`);
    }
    // 2. …and none of its own are missing
    const absent = [...inGraph].filter((c) => !onScreen.has(c));
    if (absent.length) {
      fail(fw, 'missing-standards',
        `${absent.length} code(s) the graph cites and the screen does not: ${absent.slice(0, 6).join(', ')}`);
    }
    // 5. nothing ships at an unknown depth
    const murky = Object.entries(got.depths || {}).filter(([, d]) => !DEPTHS.includes(d));
    if (murky.length) {
      fail(fw, 'unknown-depth',
        `${murky.length} code(s) printed with no depth: ${murky.slice(0, 6).map(([c]) => c).join(', ')}`);
    }
    // 6. no expectation is evidenced by nothing
    const orphan = [...onScreen].filter((c) => Number(got.lines?.[c] ?? 0) <= 0);
    if (orphan.length) {
      fail(fw, 'orphan-standard',
        `${orphan.length} row(s) whose evidence is 0 of 0 — no line of ${reading.unit} carries them: ${orphan.slice(0, 6).join(', ')}`);
    }
    const overHeld = [...onScreen].filter((c) => Number(got.held?.[c] ?? 0) > Number(got.lines?.[c] ?? 0));
    if (overHeld.length) {
      fail(fw, 'impossible-evidence',
        `${overHeld.length} row(s) holding more lines than they have: ${overHeld.slice(0, 6)
          .map((c) => `${c} ${got.held[c]}/${got.lines[c]}`).join(', ')}`);
    }
    // 3. no line ships with a blank standards column
    const rows = got.rows || [];
    if (!rows.length) fail(fw, 'no-lines', 'the printed record listed no lines at all');
    const blank = rows.filter((r) => !String(r.standards || '').trim());
    if (blank.length) {
      fail(fw, 'blank-standards',
        `${blank.length}/${rows.length} line(s) with an empty standards column: ${blank.slice(0, 4).map((r) => r.skill).join(', ')}`);
    }
    // 7. no printed depth differs from the graph's — per line, then headline
    const byNode = want?.depthByNode || {};
    const wrong = [];
    for (const r of rows) {
      // A line the running unit does not have is a stronger fault than a depth
      // on it, and is reported as what it is.
      if (r.id && !Object.prototype.hasOwnProperty.call(byNode, r.id)) {
        fail(fw, 'foreign-line', `the record lists a line no node of ${reading.unit} declares: ${r.id}`);
        continue;
      }
      for (const pair of String(r.std || '').split(/\s+/).filter(Boolean)) {
        const at = pair.lastIndexOf(':');
        const code = short(pair.slice(0, at));
        const printed = pair.slice(at + 1);
        const declared = byNode[r.id]?.[code] ?? null;
        if (printed !== (declared ?? 'unknown')) {
          wrong.push(`${r.id} ${code} printed ${printed}, graph says ${declared ?? 'nothing'}`);
        }
      }
    }
    for (const code of onScreen) {
      // The headline depth on the coverage row is the STRONGEST the code
      // reaches across the lines that cite it, and nothing else.
      const reached = Object.values(byNode).map((m) => m[code]).filter(Boolean);
      if (!reached.length) continue;
      const strongest = reached.reduce((b, d) => ((RANK[d] || 0) > (RANK[b] || 0) ? d : b), reached[0]);
      const printed = got.depths?.[code];
      if (printed && DEPTHS.includes(printed) && printed !== strongest) {
        wrong.push(`headline ${code} printed ${printed}, graph reaches ${strongest}`);
      }
    }
    if (wrong.length) {
      fail(fw, 'depth-mismatch',
        `${wrong.length} depth(s) on screen that the graph does not state: ${wrong.slice(0, 6).join('; ')}`);
    }
    // 4. the record names the unit it is about
    // The COURSE name is not enough. "Algebra I · Level 1 · The Cipher Worlds"
    // over Level 4's quadratics carries the right course and the wrong unit,
    // which is the defect that was measured, so the unit's own name is what is
    // required here.
    const title = String(got.title || '');
    if (!title.trim()) fail(fw, 'no-title', 'the record head names no course and no unit');
    else if (!expect.titles.some((x) => x && title.includes(x))) {
      fail(fw, 'wrong-unit-title',
        `the record is headed ${JSON.stringify(title)}, which does not name ${JSON.stringify(expect.titles)}`);
    }
  }
  return bad;
}

// ---------------------------------------------------------------------------
// What the graph says — the independent side
// ---------------------------------------------------------------------------

async function expectations() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'content/courses.json'), 'utf8'));
  const bundles = {};
  for (const loc of ['en']) {
    const mod = await import(path.join(ROOT, 'src/i18n', `${loc}.js`));
    bundles[loc] = mod.default || mod[Object.keys(mod)[0]];
  }
  const key = (b, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), b);

  const out = [];
  for (const course of manifest.courses) {
    for (const unit of course.units || []) {
      const graph = JSON.parse(await readFile(path.join(ROOT, 'content', unit.graph), 'utf8'));
      const frameworks = {};
      for (const fw of FRAMEWORKS) {
        const want = GRAPH_FRAMEWORK[fw];
        const codes = new Set();
        const depthByNode = {};
        for (const n of graph.nodes) {
          for (const a of alignmentOf(n)) if (a.framework === want) codes.add(short(a.code));
          // The second path. `codes` comes through the shared reader; the
          // depths come off the JSON, so the two can catch each other.
          depthByNode[n.id] = rawDepths(n, fw);
        }
        frameworks[fw] = { codes: [...codes], depthByNode };
      }
      out.push({
        unit: unit.id,
        nodes: graph.nodes.map((n) => n.id),
        // The title the record must name: the UNIT's own manifest key, in the
        // locale the harness reads the screen in. Not the course's — a record
        // headed with the right course and the wrong unit is the defect.
        titles: [key(bundles.en, unit.titleKey)].filter(Boolean),
        frameworks,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE SELF-TEST — plant the measured defect and require the gate to see it
// ---------------------------------------------------------------------------

if (SELF) {
  const cases = [];
  let printBad = 0;
  const add = (name, bad, want) => cases.push({ name, bad, want });

  // Two lines of a Level 2 graph, cut down to the shape the readers use. The
  // depths are the graph's, per line, and A.5(A) is deliberately core on one
  // line and supporting on the other — that really happens, and a rule that
  // could not tell the two apart would fire on honest content.
  const expect = {
    unit: 'algebra1-l2',
    titles: ['Level 2 — Lean, Rate and Pair'],
    frameworks: {
      ccss: {
        codes: ['HSA.REI.B.3', 'HSA.SSE.A.1.B'],
        depthByNode: {
          'both-sides': { 'HSA.REI.B.3': 'core', 'HSA.SSE.A.1.B': 'supporting' },
          'one-step-ineq': { 'HSA.REI.B.3': 'core' },
        },
      },
      teks: {
        codes: ['A.5(A)', 'A.5(B)'],
        depthByNode: {
          'both-sides': { 'A.5(A)': 'core' },
          'one-step-ineq': { 'A.5(B)': 'core', 'A.5(A)': 'supporting' },
        },
      },
    },
  };
  const clean = {
    unit: 'algebra1-l2',
    frameworks: {
      ccss: {
        codes: ['HSA.REI.B.3', 'HSA.SSE.A.1.B'],
        depths: { 'HSA.REI.B.3': 'core', 'HSA.SSE.A.1.B': 'supporting' },
        lines: { 'HSA.REI.B.3': 2, 'HSA.SSE.A.1.B': 1 },
        held: { 'HSA.REI.B.3': 1, 'HSA.SSE.A.1.B': 0 },
        title: 'Algebra I · Level 2 — Lean, Rate and Pair · Generated August 19, 2026',
        rows: [
          {
            skill: 'Brackets on both sides', id: 'both-sides',
            standards: 'HSA.REI.B.3 (core), HSA.SSE.A.1.B (supporting)',
            std: 'CCSS.MATH.CONTENT.HSA.REI.B.3:core CCSS.MATH.CONTENT.HSA.SSE.A.1.B:supporting',
          },
          {
            skill: 'One-step inequalities', id: 'one-step-ineq',
            standards: 'HSA.REI.B.3 (core)',
            std: 'CCSS.MATH.CONTENT.HSA.REI.B.3:core',
          },
        ],
      },
      teks: {
        codes: ['A.5(A)', 'A.5(B)'],
        depths: { 'A.5(A)': 'core', 'A.5(B)': 'core' },
        lines: { 'A.5(A)': 2, 'A.5(B)': 1 },
        held: { 'A.5(A)': 1, 'A.5(B)': 0 },
        title: 'Algebra I · Level 2 — Lean, Rate and Pair · Generated August 19, 2026',
        rows: [
          {
            skill: 'Brackets on both sides', id: 'both-sides',
            standards: 'A.5(A) (core)', std: 'A.5(A):core',
          },
          {
            skill: 'One-step inequalities', id: 'one-step-ineq',
            standards: 'A.5(B) (core), A.5(A) (supporting)', std: 'A.5(B):core A.5(A):supporting',
          },
        ],
      },
    },
  };
  const clone = () => JSON.parse(JSON.stringify(clean));

  add('a clean reading passes', clean, []);

  // THE OTHER HALF OF A GATE: honest content it must stay quiet on. A code
  // nobody has reached yet is 0 of 1 — zero evidence, one line — and is the
  // ordinary state of a fresh save. Only a zero DENOMINATOR is a defect.
  {
    const r = clone();
    for (const fw of FRAMEWORKS) for (const c of r.frameworks[fw].codes) r.frameworks[fw].held[c] = 0;
    add('a standard nobody has reached yet stays quiet', r, []);
  }

  // The measured defect: Level 2 rendering Level 1's Common Core rows.
  {
    const r = clone();
    r.frameworks.ccss.codes = ['6.EE.A.1', '6.EE.A.2.A', '8.EE.C.7.B'];
    r.frameworks.ccss.depths = { '6.EE.A.1': 'core', '6.EE.A.2.A': 'core', '8.EE.C.7.B': 'core' };
    r.frameworks.ccss.lines = { '6.EE.A.1': 3, '6.EE.A.2.A': 2, '8.EE.C.7.B': 1 };
    r.frameworks.ccss.held = { '6.EE.A.1': 0, '6.EE.A.2.A': 0, '8.EE.C.7.B': 0 };
    add('another unit\'s standards are caught', r, ['foreign-standards', 'missing-standards']);
  }
  // The measured defect WHOLE, as it was printed: Level 1's rows over Level 2's
  // lines, so every one of them reads "lines held 0 of 0".
  {
    const r = clone();
    r.frameworks.ccss.codes = ['6.EE.A.1', '6.EE.A.2.A', '8.EE.C.7.B'];
    r.frameworks.ccss.depths = { '6.EE.A.1': 'core', '6.EE.A.2.A': 'core', '8.EE.C.7.B': 'core' };
    r.frameworks.ccss.lines = { '6.EE.A.1': 0, '6.EE.A.2.A': 0, '8.EE.C.7.B': 0 };
    r.frameworks.ccss.held = { '6.EE.A.1': 0, '6.EE.A.2.A': 0, '8.EE.C.7.B': 0 };
    add('an expectation evidenced by nothing is caught',
      r, ['foreign-standards', 'missing-standards', 'orphan-standard']);
  }
  // A row whose evidence is 0 of 0 on its own, with nothing else wrong.
  {
    const r = clone();
    r.frameworks.teks.lines['A.5(B)'] = 0;
    add('a row that names no line at all is caught', r, ['orphan-standard']);
  }
  // More lines held than the expectation has.
  {
    const r = clone();
    r.frameworks.teks.held['A.5(B)'] = 4;
    add('an expectation holding more lines than it has is caught', r, ['impossible-evidence']);
  }
  // The silent upgrade: a supporting claim printed as core on the line.
  {
    const r = clone();
    r.frameworks.ccss.rows[0].std = 'CCSS.MATH.CONTENT.HSA.REI.B.3:core CCSS.MATH.CONTENT.HSA.SSE.A.1.B:core';
    add('a depth the graph does not state is caught on the line', r, ['depth-mismatch']);
  }
  // The same upgrade on the coverage row, where a district reads it.
  {
    const r = clone();
    r.frameworks.ccss.depths['HSA.SSE.A.1.B'] = 'core';
    add('a headline depth stronger than any line is caught', r, ['depth-mismatch']);
  }
  // A line from another unit on the record.
  {
    const r = clone();
    r.frameworks.teks.rows[1].id = 'order-of-operations';
    add('a line no node of this unit declares is caught', r, ['foreign-line']);
  }
  // The measured defect: 14 of 14 lines with a blank standards column.
  {
    const r = clone();
    for (const fw of FRAMEWORKS) r.frameworks[fw].rows = [{ skill: 'Brackets on both sides', standards: '' }];
    add('a blank standards column is caught', r, ['blank-standards']);
  }
  // The measured defect: every unit titled with Level 1's name.
  {
    const r = clone();
    for (const fw of FRAMEWORKS) r.frameworks[fw].title = 'Algebra I · Level 1 · The Cipher Worlds · Generated August 19, 2026';
    add('a record headed with the wrong unit is caught', r, ['wrong-unit-title']);
  }
  // A code the graph cites and the screen drops.
  {
    const r = clone();
    r.frameworks.teks.codes = ['A.5(A)'];
    delete r.frameworks.teks.depths['A.5(B)'];
    add('a standard the graph cites and the screen drops is caught', r, ['missing-standards']);
  }
  // A depth the screen could not resolve at all. Not the same fault as a
  // depth that disagrees with the graph, and reported as a different one.
  {
    const r = clone();
    r.frameworks.ccss.depths['HSA.SSE.A.1.B'] = 'unknown';
    add('a code printed at an unknown depth is caught', r, ['unknown-depth']);
  }
  // A framework that never rendered at all.
  {
    const r = clone();
    delete r.frameworks.teks;
    add('a framework the report never drew is caught', r, ['no-view']);
  }

  // THE PRINTED DOCUMENT. The rule that measures ink on paper, planted both
  // ways. Its other half — the real strip put back in the real page — runs on
  // every ordinary run and is not a fixture; see printReading().
  {
    const clean = { unit: 'algebra1-l2', loc: 'es', paper: 'Letter landscape', clipped: [], scrolls: [] };
    const say = (name, r, want) => {
      const kinds = judgePrint(r).map((x) => x.kind).sort();
      const w = [...want].sort();
      const pass = kinds.length === w.length && kinds.every((k, i) => k === w[i]);
      if (!pass) printBad++;
      console.log(`  ${pass ? ' ok ' : 'FAIL'}  ${name}${kinds.length ? ' — ' + kinds.join(', ') : ''}`);
    };
    say('a printed sheet with nothing past its edge passes', clean, []);
    say('THE MEASURED DEFECT: the last statistic 148px off the paper in Spanish',
      { ...clean, clipped: [{ text: 'Sellos retirados', past: 148, sel: 'rp-sum' }] }, ['print-clipped']);
    say('a box still betting on a scrollbar is caught before the ink is',
      { ...clean, scrolls: [{ sel: 'rp-sum', overflowX: 'auto', cut: 215, text: 'Sellos retirados' }] },
      ['print-scrolls']);
    say('a sub-pixel rounding of one pixel is not a finding',
      { ...clean, clipped: [] }, []);
  }

  let bad = printBad;
  for (const c of cases) {
    const got = judge(c.bad, expect);
    const kinds = [...new Set(got.map((x) => x.kind))].sort();
    const want = [...new Set(c.want)].sort();
    const pass = kinds.length === want.length && kinds.every((k, i) => k === want[i]);
    if (!pass) bad++;
    console.log(`  ${pass ? ' ok ' : 'FAIL'}  ${c.name}${kinds.length ? ' — ' + kinds.join(', ') : ''}`);
  }
  console.log(bad
    ? `\nself-test FAILED — ${bad} of ${cases.length + 4}`
    : `\nself-test OK — ${cases.length + 4} planted cases, each one a defect this gate was written for.`);
  process.exit(bad ? 1 : 0);
}

// ---------------------------------------------------------------------------
// THE DOCUMENT HAS TO COME OUT OF THE PRINTER WHOLE
// ---------------------------------------------------------------------------
/**
 * Paper cannot be scrolled, and the record was betting that it could.
 *
 * The headline strip of `.rp-sheet` was a two-row column-flow grid with
 * `overflow-x:auto` under it. On glass that is a strip a reader can push. On
 * paper the same declaration is a guillotine: whatever sits past `clientWidth`
 * is never inked, and what sat last was CLAIMS WITHDRAWN — the figure that says
 * how often this record took a claim back.
 *
 * Measured on the shipped build, `?unit=algebra1-l2`, @media print: the seven
 * columns needed 978px in English, 1141px in Polish and 1180px in Spanish. The
 * print engine gets 965px on US Letter landscape and 1032px on A4 landscape, so
 * ENGLISH CAME OUT WHOLE and Spanish lost its last column by 148px and Polish
 * by 109px. A record that loses its last statistic in two of three languages is
 * not a document a district can file, and no gate could see it: check:truncate
 * allows `overflow:auto` by design (text that scrolls is a decision), and
 * check:layout never opens the teacher's copy at all.
 *
 * So this rule measures INK ON PAPER: the right edge of every rendered text run
 * inside the printed sheet against the right edge of the sheet, at the four
 * layout widths a print engine actually hands the document, in three locales.
 * Two rules:
 *
 *   print-clipped   a text run whose ink crosses the edge of the sheet
 *   print-scrolls   a box inside the sheet that is still betting on a scrollbar
 *                   (`overflow-x` auto/scroll/hidden/clip with more content
 *                   than box). On glass that is legal. On paper it is the
 *                   defect above, one step before it shows.
 *
 * AND IT PLANTS THE REAL DEFECT ON EVERY RUN. Before it measures anything it
 * puts the old strip back — a stylesheet, in the real page, restoring exactly
 * `grid-auto-flow:column` + `overflow-x:auto` + nowrap — and requires itself to
 * catch the cut in Spanish. Then it takes it away and requires itself to go
 * quiet. A gate nobody has watched refuse anything is not a gate, and this half
 * needs no flag to remember.
 */

/** The layout widths a print engine hands the document, in CSS px at 96dpi. */
const PAPER = [
  { w: 703, name: 'A4 portrait' },        // i18n-allow: a paper size, not prose
  { w: 770, name: 'Letter portrait' },    // i18n-allow: a paper size, not prose
  { w: 965, name: 'Letter landscape' },   // i18n-allow: a paper size, not prose
  { w: 1032, name: 'A4 landscape' },      // i18n-allow: a paper size, not prose
];

/** Put the pre-fix strip back, in the running page, as a real stylesheet. */
const PLANT = `(() => {
  const s = document.createElement('style');
  s.id = 'record-print-plant';
  s.textContent = '@media print{'
    + '.rp-sum{grid-auto-flow:column !important;grid-template-rows:auto auto !important;'
    + 'grid-template-columns:none !important;overflow-x:auto !important;justify-content:start !important}'
    + '.rp-sum-cell{display:contents !important}'
    + '.rp-sum dt,.rp-sum dd{white-space:nowrap !important}}';
  document.head.appendChild(s);
})()`;
const UNPLANT = `document.getElementById('record-print-plant')?.remove()`;

/** Ink and scroll faults inside the printed sheet, read out of the browser. */
const INK = `(() => {
  const sheets = [...document.querySelectorAll('.rp-sheet')].filter((s) => {
    const cs = getComputedStyle(s);
    return cs.display !== 'none' && s.getBoundingClientRect().width > 40;
  });
  const out = { clipped: [], scrolls: [], sheets: sheets.length };
  const rng = document.createRange();
  for (const sheet of sheets) {
    const R = sheet.getBoundingClientRect();
    const walk = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      const el = n.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      rng.selectNodeContents(n);
      const r = rng.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const past = r.right - R.right;
      if (past > 1) {
        out.clipped.push({ text: n.nodeValue.trim().slice(0, 44), past: Math.round(past),
          sel: (el.className && String(el.className)) || el.tagName });
      }
    }
    for (const el of [sheet, ...sheet.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      if (!/auto|scroll|hidden|clip/.test(cs.overflowX)) continue;
      const cut = el.scrollWidth - el.clientWidth;
      if (cut > 1) {
        out.scrolls.push({ sel: (el.className && String(el.className)) || el.tagName,
          overflowX: cs.overflowX, cut,
          text: (el.textContent || '').trim().slice(0, 44) });
      }
    }
  }
  return out;
})()`;

/**
 * Judge one print reading. Pure, so the plant above and the fixture below run
 * through the same rule.
 * @param {{unit:string, loc:string, paper:string, clipped:object[], scrolls:object[]}} r
 */
export function judgePrint(r) {
  const out = [];
  for (const c of r.clipped) {
    out.push({ unit: r.unit, framework: `${r.loc}/${r.paper}`, kind: 'print-clipped',
      detail: `"${c.text}" is ${c.past}px past the edge of the sheet — it is on the page and not on the paper` });
  }
  for (const s of r.scrolls) {
    out.push({ unit: r.unit, framework: `${r.loc}/${r.paper}`, kind: 'print-scrolls',
      detail: `.${s.sel} still expects a scrollbar on paper (overflow-x:${s.overflowX}, ${s.cut}px of content past the box): "${s.text}"` });
  }
  return out;
}

/**
 * Open the teacher's copy on one unit and read the ink off the paper, in three
 * locales, on four paper widths, with the old defect planted and then removed.
 */
async function printReading(brow, unit) {
  const findings = [];
  const proof = { caught: 0, quiet: 0 };
  for (const paper of PAPER) {
    const ctx = await brow.newContext({ viewport: { width: paper.w, height: 1100 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${URL}/?unit=${unit}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
      await page.waitForTimeout(1800);
      await quiet(page);
      for (let i = 0; i < 8; i++) {
        if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
        await quiet(page);
        await page.keyboard.press('KeyP');
        await page.waitForTimeout(650);
      }
      await page.locator('.rp-teacher').first().click({ timeout: 20000 });
      await page.waitForTimeout(700);
      for (const loc of LOCALES) {
        await page.evaluate((l) => window.__ascent.setLocale(l), loc);
        await page.waitForTimeout(650);
        await page.emulateMedia({ media: 'print' });
        await page.waitForTimeout(300);

        // THE PLANT, on every run: put the old strip back and require the cut.
        // Spanish on Letter landscape is the exact frame the defect was
        // measured in, so that is where the proof is taken.
        if (loc === 'es' && paper.w === 965) {
          await page.evaluate(PLANT);
          await page.waitForTimeout(250);
          const bad = await page.evaluate(INK);
          if (judgePrint({ unit, loc, paper: paper.name, ...bad }).length) proof.caught++;
          await page.evaluate(UNPLANT);
          await page.waitForTimeout(250);
          const good = await page.evaluate(INK);
          if (!judgePrint({ unit, loc, paper: paper.name, ...good }).length) proof.quiet++;
        }

        const r = await page.evaluate(INK);
        if (!r.sheets) {
          findings.push({ unit, framework: `${loc}/${paper.name}`, kind: 'no-printed-sheet',
            detail: 'the printed document had no sheet on it at all' });
        }
        findings.push(...judgePrint({ unit, loc, paper: paper.name, ...r }));
        await page.emulateMedia({ media: 'screen' });
      }
    } finally {
      await ctx.close();
    }
  }
  return { findings, proof };
}

// ---------------------------------------------------------------------------
// THE RUN — a frozen build, every unit, real keys
// ---------------------------------------------------------------------------

await mkdir(OUT, { recursive: true });

let server = null;
let URL = arg('url', null);
if (!URL) {
  // A frozen build, on its own port, immune to whatever else is editing the
  // tree. tools/critic/snapshot.sh does the same thing for screenshots.
  await run('npm', ['run', 'build']);
  // A port the kernel says is free, not a random number in a range. Several
  // critics run at once here; `--strictPort` on a taken port means vite never
  // comes up, the wait below quietly runs out, and every reading afterwards
  // fails against a dead URL — a gate reporting content defects that are really
  // a port clash. See tools/_freeport.mjs --self-test.
  const port = await freePort();
  URL = `http://127.0.0.1:${port}`;
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 60; i++) {
    try { await fetch(URL + '/'); up = true; break; } catch { await sleep(500); }
  }
  // And say so, rather than judging the game through a server that never came
  // up. A gate must not report on a page it never loaded.
  if (!up) {
    console.error(`FAIL — the preview server never answered on ${URL} after 30s. `
      + 'Nothing below would be a reading of the game, so this run stops here.');
    try { server.kill(); } catch { /* already gone */ }
    process.exit(2);
  }
}

const units = await expectations();
/* The units a class actually receives. `route.units` when the manifest names
   one; otherwise every unit it calls `shipped`. Read, never written here — see
   the header of content/courses.json. */
const ROUTE_UNITS = await (async () => {
  const m = JSON.parse(await readFile(path.join(ROOT, 'content/courses.json'), 'utf8'));
  const course = m.courses.find((c) => c.id === (m.route?.course || m.default?.course));
  const named = m.route?.units;
  return named && named.length
    ? named
    : (course?.units || []).filter((u) => u.status === 'shipped').map((u) => u.id);
})();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const findings = [];
const readings = [];
const printProof = { caught: 0, quiet: 0, want: 0 };
try {
  for (const expect of units) {
    const reading = await readUnit(browser, expect.unit);
    readings.push(reading);
    findings.push(...judge(reading, expect));
  }
  /* THE PRINTED DOCUMENT, on the units a class actually receives. The route is
     read off content/courses.json rather than written here, so promoting a unit
     puts its printed sheet under this rule on the next run with no edit. */
  for (const u of ROUTE_UNITS) {
    printProof.want++;
    const r = await printReading(browser, u);
    findings.push(...r.findings);
    printProof.caught += r.proof.caught;
    printProof.quiet += r.proof.quiet;
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

/* The plant has to have been caught, and the honest page has to have been let
   through, or nothing above is evidence. */
if (printProof.caught !== printProof.want || printProof.quiet !== printProof.want) {
  console.error(`\nTHE PRINT RULE DID NOT PROVE ITSELF — the old strip was planted in the real page `
    + `${printProof.want} time(s); it was caught ${printProof.caught} time(s) and the honest page was `
    + `passed ${printProof.quiet} time(s). Nothing below is evidence.`);
  process.exit(1);
}

await writeFile(path.join(OUT, 'record.json'), JSON.stringify({ url: URL, readings, findings }, null, 2));

for (const r of readings) {
  const bits = FRAMEWORKS.map((fw) => {
    const g = r.frameworks[fw];
    return g ? `${fw} ${g.codes.length} codes, ${g.rows.length} lines` : `${fw} MISSING`;
  });
  console.log(`  ${r.unit.padEnd(14)} ${bits.join(' · ')}`);
}
if (findings.length) {
  console.log('\nTHE TEACHER RECORD IS NOT TELLING THE TRUTH:');
  for (const f of findings) console.log(`  ${f.unit} · ${f.framework} · ${f.kind}: ${f.detail}`);
  console.log(`\n${findings.length} finding(s) across ${units.length} unit(s).`);
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. Severity follows the
   route off content/courses.json, in the one place every gate reads it from: a
   record that misstates a unit a class is in today is a claim about a real
   learner's work; the same defect in a preview unit is advisory and printed. */
{
  const { routeUnits } = await import('./_courses.mjs');
  const { onRoute } = await routeUnits();
  const F = ledger('check:record', { scope: 'sweep', onRoute });
  for (const f of findings) F.forUnit(f.unit, `${f.unit} · ${f.framework} · ${f.kind}: ${f.detail}`);
  /* The ledger is a floor on severity and never a ceiling: this gate has always
     refused a misstated record in ANY unit, and it still does. What the ledger
     adds is that the route half can no longer be printed under a zero exit
     code, and that the build's summary can say which half it is. */
  F.report();
}
if (findings.length) process.exit(1);
console.log(`\nrecord OK — ${units.length} units, both frameworks, every line carries its standards `
  + 'and no unit prints another unit\'s.');
console.log(`printed whole — ${ROUTE_UNITS.length} route unit(s) x ${LOCALES.length} locales x `
  + `${PAPER.length} paper widths, no ink past the edge and no box betting on a scrollbar. `
  + `The old strip was planted back in the real page ${printProof.want} time(s) and refused `
  + `${printProof.caught} time(s); the honest page passed ${printProof.quiet} time(s).`);

// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

/**
 * Open one unit, play a few items with the keyboard, open the report with `P`,
 * open the teacher record with a click, and read both frameworks off the DOM.
 */
async function readUnit(brow, unit) {
  const ctx = await brow.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const reading = { unit, frameworks: {}, errors: [] };
  page.on('pageerror', (e) => reading.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') reading.errors.push(m.text()); });
  try {
    await page.goto(`${URL}/?unit=${unit}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
    await page.waitForTimeout(2400);
    await quiet(page);
    await playSome(page, ITEMS);

    // P, the key a learner presses.
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
      if (await page.evaluate(() => !!window.__ascent.panel?.open)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(280);
      }
      await quiet(page);
      await page.keyboard.press('KeyP');
      await page.waitForTimeout(650);
    }
    // The teacher's copy, opened the way a teacher opens it.
    await page.locator('.rp-teacher').first().click({ timeout: 20000 });
    await page.waitForTimeout(800);

    for (const fw of FRAMEWORKS) {
      const btn = page.locator(`.rp-frame-b[data-frame="${fw}"]`).last();
      if (await btn.count()) { await btn.click({ timeout: 15000 }); await page.waitForTimeout(500); }
      await page.screenshot({ path: path.join(OUT, `${unit}-${fw}.png`) });
      reading.frameworks[fw] = await page.evaluate(() => {
        const sheet = document.querySelector('.rp-sheet');
        const rows = [...(sheet?.querySelectorAll('.rp-table tbody tr') || [])].map((tr) => {
          const td = [...tr.querySelectorAll('td')].map((x) => x.textContent.trim());
          return {
            skill: td[0],
            standards: td[td.length - 1],
            // What the last cell says, in the graph's words rather than this
            // locale's, so the depth check is not an English-only check.
            id: tr.dataset.skill || '',
            std: tr.dataset.std || '',
          };
        });
        const codes = [];
        const depths = {};
        const lines = {};
        const held = {};
        for (const art of document.querySelectorAll('.rp-cover .rp-cstd')) {
          const code = art.querySelector('.rp-ccode')?.textContent.trim();
          if (!code) continue;
          codes.push(code);
          depths[code] = art.dataset.depth || 'unknown';
          lines[code] = Number(art.dataset.lines ?? -1);
          held[code] = Number(art.dataset.held ?? -1);
        }
        return {
          codes,
          depths,
          lines,
          held,
          title: sheet?.querySelector('.rp-sheet-sub')?.textContent?.trim() || '',
          rows,
        };
      });
    }
  } finally {
    await ctx.close();
  }
  return reading;
}

/** Take other people's overlays off the glass without clicking their buttons. */
async function quiet(page) {
  await page.evaluate(() => {
    window.__ascent.session?.charter?.hide?.();
    for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
    document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  });
  await page.waitForTimeout(220);
}

/**
 * Walk to a rift with W, open it, and type the answer on the keypad. Nothing
 * here calls `openRiftById` or touches the mastery engine: a record built over
 * a state no key press produced is not a record of anything.
 */
async function playSome(page, n) {
  await page.mouse.move(800, 500);
  await page.mouse.click(800, 500);
  await page.waitForTimeout(260);
  for (let round = 0; round < n; round++) {
    const target = await page.evaluate(() => {
      const a = window.__ascent, p = a.player.pos;
      let best = null, bd = 1e9;
      for (const r of a.rifts.list) {
        if (r.locked || r.mastered) continue;
        const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
        if (d < bd) { bd = d; best = r; }
      }
      return best ? { x: best.pos.x, z: best.pos.z } : null;
    }).catch(() => null);
    if (!target) return;
    let opened = false;
    for (let step = 0; step < 200 && !opened; step++) {
      const err = await page.evaluate((tt) => {
        const a = window.__ascent, p = a.player.pos;
        const want = Math.atan2(tt.x - p.x, tt.z - p.z);
        let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return { d, dist: Math.hypot(tt.x - p.x, tt.z - p.z) };
      }, target);
      if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 500, { steps: 2 });
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(105);
      opened = await page.evaluate(() => !!window.__ascent.panel?.open);
      if (err.dist < 4.2) break;
    }
    await page.keyboard.up('KeyW');
    if (!opened) {
      for (const key of ['KeyE', 'KeyF', 'Enter']) {
        await page.keyboard.press(key);
        await page.waitForTimeout(340);
        opened = await page.evaluate(() => !!window.__ascent.panel?.open);
        if (opened) break;
      }
    }
    if (!opened) return;
    await page.waitForTimeout(220);
    const ans = await page.evaluate(() => {
      const it = window.__ascent.panel?.item;
      return it ? String(it.answer ?? '') : null;
    });
    if (ans != null && /^-?[0-9./]+$/.test(ans)) {
      for (const ch of ans) {
        const key = ch === '-' ? 'Minus' : ch === '.' ? 'Period' : ch === '/' ? 'Slash' : `Digit${ch}`;
        await page.keyboard.press(key);
        await page.waitForTimeout(30);
      }
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!window.__ascent.panel?.open)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    await quiet(page);
  }
}
