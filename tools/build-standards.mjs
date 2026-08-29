#!/usr/bin/env node
/**
 * content/STANDARDS.md — the one document an adoption committee reads.
 *
 *   node tools/build-standards.mjs            # rewrite it from the data
 *   node tools/build-standards.mjs --check    # non-zero if it has drifted
 *
 * WHY IT IS GENERATED, AND WHY IT MOVED.
 *
 * It used to be written by `tools/validate-items.mjs`, which loads ONE unit —
 * Algebra I Level 1 — so the document was titled "Standards alignment — ASCENT,
 * Algebra I Level 1", covered ten skills and listed seventeen TEKS
 * expectations. Five units ship. A Texas department head opening the top
 * document of a product called Algebra I saw five of the forty-nine Algebra I
 * student expectations, three of them at core, and had no way to tell whether
 * that was the product or the document. The Level 1 crosswalk is still
 * generated and still byte-compared, at
 * `content/standards/algebra1-l1-crosswalk.md`, under its real name.
 *
 * This file builds the course-level document instead: every unit, both
 * frameworks, a coverage figure with a denominator, and the gaps in writing.
 *
 * FIVE RULES IT IS BUILT ON.
 *
 * 1. A COVERAGE FIGURE WITHOUT A DENOMINATOR IS AN ADVERTISEMENT. "38 student
 *    expectations" is not a number until the reader knows there are 49.
 *    `content/standards/teks-algebra1-inventory.json` is that denominator, and
 *    the eleven this course does not claim are named, quoted and explained.
 *
 * 2. AND A COVERAGE FIGURE OVER UNITS NOBODY IS SENT TO IS THE SAME
 *    ADVERTISEMENT ONE STEP LATER. This document used to publish ONE figure —
 *    38 of 49 cited, 27 at core — over all five units, three of which are
 *    `preview` and unreachable without a hand-edited query string. The course a
 *    class actually receives is `route.units`: two units, 24 skills, 16 of the
 *    49 cited and TEN at core. Nothing in the document converted one number
 *    into the other, and a reviewer caught the conflation. So every coverage
 *    figure here is computed twice — over the route and over the disk — and
 *    printed side by side, in the header, in section 1, and per expectation in
 *    section 3. `course(fw, ids)` is what makes that possible; `ROUTE` is read
 *    out of `content/courses.json` and is never written here.
 *
 * 3. THE WORDING COMES FROM THE GRAPH, NOT FROM THIS FILE. Every quoted
 *    expectation below is read out of the graph that cites it — the copy
 *    `tools/validate-courses.mjs` already checks character for character. This
 *    tool re-checks the inventory's citations against them and refuses to write
 *    a document whose two sources disagree. It refuses on two more sources
 *    now: a unit whose name in a graph is not its name in the language bundles
 *    a learner reads (`titleFaults`), and a mastery figure measured against a
 *    different tree than this one (`checkRuns`, from build-mastery-runs.mjs).
 *
 * 4. NOTHING HERE IS A CLAIM ABOUT INTENT. Where a claim is below `core` the
 *    row says so; where the alignment stops the document says where; where a
 *    figure has not been measured it says "not measured" rather than nothing.
 *
 * 5. AND WHERE THE EVIDENCE CANNOT BE COLLECTED, THE DOCUMENT SAYS THAT TOO.
 *    Section 6 states, in the document a district reads, that there is no
 *    account, no roster and no server, that mastery evidence lives in one
 *    browser's local storage, and that on a shared Chromebook a district cannot
 *    reliably attach evidence to a student at all — with the smallest honest
 *    path to a class record priced out beside it. A limitation a district finds
 *    in September is worth less than the same limitation in writing in August.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { alignmentOf, practicesOf } from '../src/content/standards.js';
import {
  checkRuns, treeNow, routeUnits, ROUTE_ID,
  LEARNERS as LEARNERS_UNIT, BUDGET as BUDGET_UNIT,
  ROUTE_LEARNERS as ROUTE_LEARNERS_DOC, ROUTE_BUDGET as ROUTE_BUDGET_DOC,
  CADENCES, GENERATOR_FILES, digestOf, SWEPT_CONSTANTS,
} from './build-mastery-runs.mjs';
/* THE GATE'S OWN CONSTANTS AND THE PER-WAVE LEDGER, READ RATHER THAN RETYPED.
   Both have main guards, so importing them starts nothing. See section 7.4:
   a document that reports what has been measured has to be able to report what
   has NOT been, and the only honest source for that is the ledger the build
   itself reads. */
import { PUBLISHED, BAR } from './simulate-all.mjs';
import { perWaveStatus } from './check-all.mjs';
/* THE LAST STEP, WHICH IS WHERE THE DEFECT WAS. Every gate in this build reads
   the SOURCES; the twenty-two `undefined` rows were made in the interpolation
   after the last of them had passed, and `--check` byte-compared the document
   against itself and agreed. `documentFaults` reads the OUTPUT. See
   tools/doc-audit.mjs, and HONEST_UNDEFINED below. */
import { documentFaults } from './doc-audit.mjs';
import { HONEST_UNDEFINED } from './check-docs.mjs';
import { findings } from './_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const SELF = process.argv.includes('--self-test');
const OUT = path.join(ROOT, 'content/STANDARDS.md');

const read = async (p) => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));
const manifest = await read('content/courses.json');
const inventory = await read('content/standards/teks-algebra1-inventory.json');
const process1 = await read('content/standards/practices-algebra1.json');
/* The build's own gate definitions, for section 7.4. Read from package.json
   exactly as `npm run wave` reads them, so the ledger row and this document's
   row can never be about two different commands. */
const pkgScripts = (await read('package.json')).scripts;

const COURSE = manifest.courses.find((c) => c.id === 'algebra1');
const RANK = { core: 3, supporting: 2, introduced: 1 };
const CCSS_PREFIX = 'CCSS.MATH.CONTENT.'; // i18n-allow: a standards identifier
const short = (c) => String(c).replace(CCSS_PREFIX, '');
const stronger = (a, b) => ((RANK[a] || 0) >= (RANK[b] || 0) ? a : b);

// ---------------------------------------------------------------------------
// THE UNIT HAS ONE NAME — a rule no gate in this build could see.
//
// `content/graph/algebra1-l2.json` called the unit "Lean, Rate and Pair", and
// so did content/STANDARDS.md and the working paper beside it. `src/i18n/en.js`
// called it "Structure and Rate", Spanish "Estructura y ritmo", Polish
// "Struktura i tempo" — a name that describes neither the inequalities nor the
// systems, which are half the unit. That is the name a LEARNER sees, on the
// map, in the session card and at the head of the teacher record, while every
// document a district reads carries the other one. Two critics marked it
// NOT_FIXED and it survived, because nothing in thirty-eight gates compares the
// two sources: one reads graphs, the other reads bundles, and they never meet.
//
// Three rules, and the third is the only one that can work in a language whose
// words are not the graph's.
//
//   1. ENGLISH IS THE GRAPH'S OWN WORDS. `unit.<id>.title` in en.js must equal
//      the graph's `title` with the course name off the front and the colon
//      turned into the em dash this key uses. An exact compare — there is no
//      judgement to make.
//   2. EVERY LOCALE NAMES THE RIGHT LEVEL. The first number in the title is the
//      number in the unit id. "Poziom 3" on `algebra1-l2` is the copy-paste
//      this catches, and it is the one that reaches a learner as a lie.
//   3. EVERY LOCALE NAMES AS MANY THINGS AS ENGLISH DOES. A translated title is
//      not comparable to the graph word for word, but its SHAPE is: a name
//      built of three things — "Lean, Rate and Pair" — is three things in every
//      language, and "Estructura y ritmo" is two. Terms are counted by
//      splitting the name on commas and on the locale's own conjunctions.
//      Measured over the five honest units in three locales this rule is quiet
//      on all fifteen, and it fires on all three of the drifted strings.
//
//   4. And no two units share a title in any locale.
//
// Rules 2 and 3 are the ones that would have caught the Spanish and the Polish.
// Rule 1 alone is an English-only gate, which is the locale a defect is least
// likely to be found in.

/** Conjunctions that join the last two items of a list, per locale. */
const CONJ = {
  en: ['and'],                 // i18n-allow: parsing a title, not printing one
  es: ['y', 'e'],              // i18n-allow: parsing a title, not printing one
  pl: ['i', 'a', 'oraz'],      // i18n-allow: parsing a title, not printing one
};

/** The part of a unit title after the "Level 2 — " prefix. */
const nameOf = (title) => String(title).split(/\s+—\s+/).slice(1).join(' — ').trim() || String(title).trim();

/** How many things a title names: commas, plus the locale's own conjunctions. */
export function termsIn(title, loc) {
  const conj = CONJ[loc] || CONJ.en;
  const re = new RegExp(`\\s+(?:${conj.join('|')})\\s+`, 'giu');
  return nameOf(title)
    .split(',')
    .flatMap((part) => part.split(re))
    .map((s) => s.trim())
    .filter(Boolean)
    .length;
}

/**
 * Does every locale call each unit what its graph calls it?
 *
 * Pure, so the self-test can plant each drift in it without touching the tree.
 *
 * @param {{id:string, titleKey:string, graphTitle:string}[]} units
 * @param {Record<string, Record<string,string>>} titles  locale -> unitId -> title
 * @returns {{kind:string, unit:string, loc:string, say:string}[]}
 */
export function titleFaults(units, titles) {
  const out = [];
  const hit = (kind, unit, loc, say) => out.push({ kind, unit, loc, say });
  const locales = Object.keys(titles);

  for (const u of units) {
    // 1. English is the graph's own words.
    const want = String(u.graphTitle).replace(/^[^—]*—\s*/, '').replace(/:\s*/, ' — ').trim();
    const en = titles.en?.[u.id];
    if (!en) hit('missing-title', u.id, 'en', `no ${u.titleKey} in the English bundle`);
    else if (en.trim() !== want) {
      hit('graph-disagrees', u.id, 'en',
        `the graph calls it "${want}" and en.js calls it "${en.trim()}" — a learner and a district `
        + 'are reading two different names for one unit');
    }

    // 2. every locale names the right level.
    const level = /-l(\d+)$/.exec(u.id)?.[1] ?? null;
    for (const loc of locales) {
      const t = titles[loc]?.[u.id];
      if (!t) { if (loc !== 'en') hit('missing-title', u.id, loc, `no ${u.titleKey} in the ${loc} bundle`); continue; }
      if (level != null) {
        const got = /\d+/.exec(t)?.[0] ?? null;
        if (got !== level) {
          hit('wrong-level', u.id, loc, `"${t}" names level ${got ?? 'none'}; the unit is level ${level}`);
        }
      }
    }

    // 3. every locale names as many things as English does.
    const nEn = en ? termsIn(en, 'en') : null;
    for (const loc of locales) {
      if (loc === 'en' || nEn == null) continue;
      const t = titles[loc]?.[u.id];
      if (!t) continue;
      const n = termsIn(t, loc);
      if (n !== nEn) {
        hit('shape-disagrees', u.id, loc,
          `"${nameOf(t)}" names ${n} thing(s); the English "${nameOf(en)}" names ${nEn}`);
      }
    }
  }

  // 4. no two units share a title in any locale.
  for (const loc of locales) {
    const seen = new Map();
    for (const u of units) {
      const t = titles[loc]?.[u.id];
      if (!t) continue;
      if (seen.has(t)) hit('duplicate-title', u.id, loc, `"${t}" is also the title of ${seen.get(t)}`);
      else seen.set(t, u.id);
    }
  }
  return out;
}

/**
 * THE ROUTE FIGURE HAS TO BE A ROUTE FIGURE.
 *
 * The whole of section 1 rests on `course(fw, ids)` filtering by unit. If that
 * filter ever stops filtering, every "on the route" column silently becomes the
 * on-disk column and this document goes straight back to publishing one number
 * for two different courses — the exact conflation a reviewer caught, and the
 * kind that leaves no trace in the output because both numbers are real.
 *
 * So it is asserted rather than assumed: no code may appear in the route's rows
 * unless every unit named beside it is on the route.
 *
 * @param {string} fw     framework name, for the message
 * @param {Map<string,{units:string[]}>} rows  the route-scoped coverage map
 * @param {string[]} route  the unit ids the route walks
 * @returns {string[]}
 */
export function routeFilterFaults(fw, rows, route) {
  const out = [];
  for (const [code, r] of rows) {
    if (!r.units.every((id) => route.includes(id))) {
      out.push(`the route's ${fw} coverage names ${code} from ${r.units.join(', ')}, `
        + `and the route is ${route.join(', ')} — course(fw, ids) has stopped filtering, and every `
        + '"on the route" figure in this document is really an on-disk figure');
    }
  }
  return out;
}

/** Read `unit.<id>.title` for every unit out of every locale bundle. */
async function titlesFromBundles(units) {
  const titles = {};
  for (const loc of ['en', 'es', 'pl']) {   // i18n-allow: locale ids, not language
    const mod = await import(path.join(ROOT, 'src/i18n', `${loc}.js`));
    const b = mod.default || mod[Object.keys(mod)[0]];
    titles[loc] = {};
    for (const u of units) {
      const v = u.titleKey.split('.').reduce((o, k) => (o == null ? o : o[k]), b);
      if (typeof v === 'string') titles[loc][u.id] = v;
    }
  }
  return titles;
}

// ---------------------------------------------------------------------------
// THE SELF-TEST — plant every drift that has actually happened here
// ---------------------------------------------------------------------------
/**
 * WHERE THE WORD-FOR-WORD TEXT OF AN EXPECTATION COMES FROM, as a rule with no
 * data behind it, so the self-test below can plant all three of its cases.
 *
 * Two sources, and neither of them covers all forty-nine.
 * `content/standards/teks-algebra1-inventory.json` carries the wording of the
 * ELEVEN this course cites nowhere, because there is nowhere else in the repo
 * for it to live. The other thirty-eight are worded on the graph node that
 * cites them — deliberately, so that the copy a district reads is the copy
 * `tools/validate-courses.mjs` already checks character for character.
 *
 * Section 5.1's second table lists exactly the CITED ones and read `e.text` off
 * the inventory, which has none for them. It printed the literal word
 * `undefined` in twenty-two consecutive rows, in the column headed *The
 * expectation, word for word*, three lines under a sentence promising that
 * every expectation is quoted in full.
 *
 * @returns {string|null} the wording, or null — never `undefined`, because the
 *   whole defect was a value that reads like a word.
 */
export function wordingOf(fromInventory, fromGraph) {
  const pick = fromInventory || fromGraph || null;
  return typeof pick === 'string' && pick.trim() ? pick : null;
}

if (SELF) {
  const UNITS = [
    { id: 'algebra1-l1', titleKey: 'unit.algebra1-l1.title', graphTitle: 'Algebra I — Level 1: The Language of Balance' },
    { id: 'algebra1-l2', titleKey: 'unit.algebra1-l2.title', graphTitle: 'Algebra I — Level 2: Lean, Rate and Pair' },
  ];
  const clean = {
    en: { 'algebra1-l1': 'Level 1 — The Language of Balance', 'algebra1-l2': 'Level 2 — Lean, Rate and Pair' },
    es: { 'algebra1-l1': 'Nivel 1 — El lenguaje del equilibrio', 'algebra1-l2': 'Nivel 2 — Inclinación, ritmo y par' },
    pl: { 'algebra1-l1': 'Poziom 1 — Język równowagi', 'algebra1-l2': 'Poziom 2 — Przechył, tempo i para' },
  };
  const clone = () => JSON.parse(JSON.stringify(clean));
  const cases = [];
  const add = (name, titles, want) => cases.push({ name, titles, want });

  add('the shipped titles pass', clone(), []);

  // THE DEFECT, exactly as it stood: three locales carrying the other name.
  {
    const t = clone();
    t.en['algebra1-l2'] = 'Level 2 — Structure and Rate';
    t.es['algebra1-l2'] = 'Nivel 2 — Estructura y ritmo';
    t.pl['algebra1-l2'] = 'Poziom 2 — Struktura i tempo';
    // All three moved together, so the SHAPE rule sees nothing wrong between
    // them — which is the point of having rule 1 be an exact compare against
    // the graph. One rule catches it; the translations are caught by rule 3
    // only when English is right and they are not, which is the next case.
    add('the drift that survived two critics is caught', t, ['graph-disagrees']);
  }
  // The English half alone — a rename that never reached the graph.
  {
    const t = clone();
    t.en['algebra1-l2'] = 'Level 2 — Lean, Rate and Pairs';
    add('an English title one letter off its graph is caught', t, ['graph-disagrees']);
  }
  // The half an English-only rule cannot see: English right, Spanish stale.
  {
    const t = clone();
    t.es['algebra1-l2'] = 'Nivel 2 — Estructura y ritmo';
    add('a Spanish title that lost a term while English kept it is caught', t, ['shape-disagrees']);
  }
  {
    const t = clone();
    t.pl['algebra1-l2'] = 'Poziom 3 — Przechył, tempo i para';
    add('a locale naming the wrong level is caught', t, ['wrong-level']);
  }
  {
    const t = clone();
    t.es['algebra1-l2'] = t.es['algebra1-l1'];
    add('two units sharing one title is caught', t, ['wrong-level', 'shape-disagrees', 'duplicate-title']);
  }
  {
    const t = clone();
    delete t.pl['algebra1-l2'];
    add('a locale with no title for a unit at all is caught', t, ['missing-title']);
  }
  // THE OTHER HALF OF A GATE: honest content it must stay quiet on. Every
  // shipped unit, in every locale, through the real rule.
  {
    const all = [
      { id: 'algebra1-l3', titleKey: 'unit.algebra1-l3.title', graphTitle: 'Algebra I — Level 3: Name, Power and Form' },
      { id: 'algebra1-l4', titleKey: 'unit.algebra1-l4.title', graphTitle: 'Algebra I — Level 4: Root, Factor and Turn' },
      { id: 'algebra1-l5', titleKey: 'unit.algebra1-l5.title', graphTitle: 'Algebra I — Level 5: Rule, Fit and Pattern' },
    ];
    const t = {
      en: { 'algebra1-l3': 'Level 3 — Name, Power and Form', 'algebra1-l4': 'Level 4 — Root, Factor and Turn', 'algebra1-l5': 'Level 5 — Rule, Fit and Pattern' },
      es: { 'algebra1-l3': 'Nivel 3 — Nombre, potencia y forma', 'algebra1-l4': 'Nivel 4 — Raíz, factor y giro', 'algebra1-l5': 'Nivel 5 — Regla, ajuste y patrón' },
      pl: { 'algebra1-l3': 'Poziom 3 — Nazwa, potęga i postać', 'algebra1-l4': 'Poziom 4 — Pierwiastek, czynnik i zwrot', 'algebra1-l5': 'Poziom 5 — Reguła, dopasowanie i wzorzec' },
    };
    const got = titleFaults(all, t);
    cases.push({ name: 'the three preview units, in three locales, are all quiet', titles: null, want: [], got });
  }

  // The route filter, planted both ways. A route-scoped map may only name units
  // on the route; the moment it names a preview unit, section 1 is publishing
  // the on-disk figure under the "in class" heading.
  {
    const R = new Map([['A.5(A)', { units: ['algebra1-l1', 'algebra1-l2'] }]]);
    const bad2 = new Map([...R, ['A.9(B)', { units: ['algebra1-l3'] }]]);
    const route = ['algebra1-l1', 'algebra1-l2'];
    cases.push({ name: 'a route-scoped map that names only route units passes',
      got: routeFilterFaults('TEKS', R, route).map((say) => ({ kind: 'route-leak', unit: '-', loc: '-', say })),
      want: [] });
    cases.push({ name: 'THE REGRESSION: a route figure that has quietly become the on-disk figure is caught',
      got: routeFilterFaults('TEKS', bad2, route).map((say) => ({ kind: 'route-leak', unit: '-', loc: '-', say })),
      want: ['route-leak'] });
  }

  /* THE TWENTY-TWO ROWS. `wordingOf` is the rule that decides which source a
     quotation comes from; these three cases are the three states it can be in,
     and the third is the one that shipped. */
  {
    const kindOf = (got) => (got === null ? [{ kind: 'no-wording', unit: '-', loc: '-', say: 'nothing to quote' }] : []);
    cases.push({ name: 'an expectation the inventory words is quoted from the inventory',
      got: kindOf(wordingOf('graph the solution set of linear inequalities in two variables', null)), want: [] });
    cases.push({ name: 'an expectation only the GRAPH words is quoted from the graph — the 38 cited ones',
      got: kindOf(wordingOf(null, 'write the equation of a line that contains a given point')), want: [] });
    cases.push({ name: 'THE TWENTY-TWO ROWS: neither source has it, and the build refuses rather than printing a value',
      got: kindOf(wordingOf(null, null)), want: ['no-wording'] });
    cases.push({ name: 'an empty string is not a quotation either',
      got: kindOf(wordingOf('', '   ')), want: ['no-wording'] });
  }

  let bad = 0;
  for (const c of cases) {
    const got = c.got ?? titleFaults(UNITS, c.titles);
    const kinds = got.map((x) => x.kind).sort();
    const want = [...c.want].sort();
    const pass = kinds.length === want.length && kinds.every((k, i) => k === want[i]);
    if (!pass) bad++;
    console.log(`  ${pass ? ' ok ' : 'FAIL'}  ${c.name}${kinds.length ? ' — ' + kinds.join(', ') : ''}`);
    if (!pass) for (const g of got) console.log(`        ${g.unit} ${g.loc}: ${g.say}`);
  }
  console.log(bad
    ? `\nself-test FAILED — ${bad} of ${cases.length}`
    : `\nself-test OK — ${cases.length} planted cases: the unit has one name in three languages, the route figure is a route figure, and an expectation with no wording in either source stops the build instead of printing one.`);
  process.exit(bad ? 1 : 0);
}

/* Read after the self-test above, which needs no data file: a gate whose
   --self-test cannot run because a data file is mid-write is a gate that
   goes red for a reason that is not the product. */
const runs = await read('content/standards/mastery-runs.json');

// ---------------------------------------------------------------------------
// Read every unit
// ---------------------------------------------------------------------------
const units = [];
for (const u of COURSE.units) {
  const graph = await read(path.join('content', u.graph));
  const rows = { ccss: new Map(), teks: new Map() };
  for (const n of graph.nodes) {
    for (const a of alignmentOf(n)) {
      const fw = a.framework === 'TEKS' ? 'teks' : 'ccss';
      const cur = rows[fw].get(a.code) || { code: a.code, text: a.text, citation: a.citation || null, depth: null, nodes: [] };
      cur.depth = stronger(a.depth, cur.depth);
      cur.nodes.push(n.id);
      rows[fw].set(a.code, cur);
    }
  }
  units.push({ id: u.id, status: u.status, titleKey: u.titleKey, graph, rows });
}

/**
 * One row per code, over a chosen set of units.
 *
 * `ids` is what makes this document able to publish TWO figures instead of one.
 * Passed the route, it reports what a class receives; passed every unit, it
 * reports what is on disk. Those are different numbers and the difference is
 * the whole of section 1.
 */
function course(fw, ids = null) {
  const out = new Map();
  for (const u of units) {
    if (ids && !ids.includes(u.id)) continue;
    for (const r of u.rows[fw].values()) {
      const cur = out.get(r.code) || { code: r.code, text: r.text, citation: r.citation, depth: null, units: [], nodes: [] };
      cur.depth = stronger(r.depth, cur.depth);
      if (!cur.units.includes(u.id)) cur.units.push(u.id);
      cur.nodes.push(...r.nodes);
      // Two units quoting one code differently is the misquotation defect. Say so.
      if (cur.text !== r.text) cur.conflict = true;
      out.set(r.code, cur);
    }
  }
  return out;
}
const CCSS = course('ccss');
const TEKS = course('teks');

/**
 * THE ROUTE — the units a learner with no query string actually walks.
 *
 * `content/courses.json` names it, and `src/content/index.js` is the only thing
 * in `src/` that reads it. Everything below that says "on the route" is this
 * list, never a status field and never a hand-written sentence here.
 */
const ROUTE = routeUnits(manifest);
const ROUTE_UNITS = units.filter((u) => ROUTE.includes(u.id));
const PREVIEW_UNITS = units.filter((u) => !ROUTE.includes(u.id));
const CCSS_R = course('ccss', ROUTE);
const TEKS_R = course('teks', ROUTE);
const onRoute = (code) => TEKS_R.has(code);

/**
 * Four of the eleven knowledge-and-skills statements carry the same strand name
 * — "Linear functions, equations, and inequalities" — and three more carry
 * "Number and algebraic methods". Printed alone they read as a repeated row. So
 * each gets a short word of OURS, in brackets, saying which of the four it is.
 * Not part of the citation, and not in the data file, because it is not the
 * standard's.
 */
const STRAND = {
  2: 'write', 3: 'graph', 4: 'fit to data', 5: 'solve',
  6: 'write', 7: 'graph', 8: 'solve',
  9: 'write, graph and fit',
  10: 'polynomials', 11: 'radicals and exponents', 12: 'equations, relations and functions',
};
const strandOf = (st) => `${st.domain} — ${STRAND[st.n] || ''}`.replace(/ — $/, '');

// ---------------------------------------------------------------------------
// THE FIGURES — computed before anything is checked, because the checks below
// are about them. Route-scoped and disk-scoped side by side; see section 1.
// ---------------------------------------------------------------------------
const ALL_SE = inventory.statements.flatMap((st) => st.expectations);
const cited = ALL_SE.filter((e) => TEKS.has(e.code));
const atCore = cited.filter((e) => TEKS.get(e.code).depth === 'core');
const pctOf = (n, d) => `${((100 * n) / d).toFixed(1)}%`;
const belowAlgebra = [...TEKS.keys()].filter((c) => !/^A\./.test(c)).sort();
const ccssCore = [...CCSS.values()].filter((r) => r.depth === 'core');
const skills = units.reduce((a, u) => a + u.graph.nodes.length, 0);

/* The same three counts, over the route only. Every "a class receives" figure
   in this document is one of these, computed, never typed. */
const citedR = ALL_SE.filter((e) => TEKS_R.has(e.code));
const atCoreR = citedR.filter((e) => TEKS_R.get(e.code).depth === 'core');
const belowAlgebraR = [...TEKS_R.keys()].filter((c) => !/^A\./.test(c)).sort();
const ccssCoreR = [...CCSS_R.values()].filter((r) => r.depth === 'core');
const skillsR = ROUTE_UNITS.reduce((a, u) => a + u.graph.nodes.length, 0);
const previewOnly = ALL_SE.filter((e) => TEKS.has(e.code) && !TEKS_R.has(e.code));

/**
 * THE ONE MASTERY FIGURE IN THIS DOCUMENT THIS BUILD DOES NOT RE-TAKE — and it
 * is READ rather than typed.
 *
 * `content/courses.json`'s own header is where the decision to hold the preview
 * units was written down, and it records the composed run that decided it:
 *
 *     node tools/simulate.mjs 300 3600 --units algebra1-l1,algebra1-l2,algebra1-l3
 *       -> 64.0% true mastery; a knower proves it 2.3% of the time
 *
 * That number appeared in this file THREE TIMES as the literal `64.0`, in three
 * sentences, with the gap to the bar written out in words as "sixteen points" —
 * so a manifest that changed its mind would leave a district-facing document
 * asserting the old figure, in the same tense, in three places. It is parsed
 * out of the header now, and a header that stops carrying it fails the build
 * rather than falling back to a constant.
 */
const HELD_LINE = /-+>\s*([\d.]+)%\s*true mastery/;
const heldAt = (() => {
  const lines = (manifest.$comment || []).map(String);
  const i = lines.findIndex((l) => /--units\s+\S*algebra1-l3/.test(l));
  const m = i >= 0 ? lines.slice(i + 1, i + 3).map((l) => l.match(HELD_LINE)).find(Boolean) : null;
  return m ? Number(m[1]) : null;
})();

/* ---------------------------------------------------------------------------
   THE STRAND READING — the question a curriculum director asks first, and the
   one this document could not answer.

   A department head read section 1 and wrote: "A class receives 10 of 49 TEKS
   Algebra I student expectations at core (20.4%) and 6 more in part. That is
   ONE STRAND — linear equations, inequalities and linear functions — NOT AN
   ALGEBRA I COURSE. It cannot be adopted as a course."

   Every number he used was already printed here. What was not printed was the
   SHAPE of them. 20.4% spread evenly over Algebra I and 20.4% concentrated in
   one of the four content domains are the same figure about two completely
   different products, and only one of them can be adopted as a course. So the
   figures are grouped by the TEKS's own domain names, read out of the
   inventory, and the two untouched domains are counted rather than described.
   --------------------------------------------------------------------------- */
const DOMAINS = [];
for (const st of inventory.statements) {
  let d = DOMAINS.find((x) => x.name === st.domain);
  if (!d) { d = { name: st.domain, statements: [], se: [] }; DOMAINS.push(d); }
  d.statements.push(st.n);
  d.se.push(...st.expectations);
}
for (const d of DOMAINS) {
  d.citedR = d.se.filter((e) => TEKS_R.has(e.code));
  d.coreR = d.citedR.filter((e) => TEKS_R.get(e.code).depth === 'core');
  d.cited = d.se.filter((e) => TEKS.has(e.code));
  d.core = d.cited.filter((e) => TEKS.get(e.code).depth === 'core');
}
/** The domains a class on the route never meets at all, at any depth. */
const UNTOUCHED = DOMAINS.filter((d) => d.citedR.length === 0);
/** The domain the route's `core` claims actually sit in, biggest first. */
const BY_CORE = [...DOMAINS].sort((a, b) => b.coreR.length - a.coreR.length);
const LEAD = BY_CORE[0];
const listAnd = (xs) => (xs.length < 2 ? (xs[0] || '')
  : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * THE WORD FOR WORD TEXT OF ONE EXPECTATION — AND WHY THIS FUNCTION EXISTS.
 *
 * Section 5.1 promises that "every expectation is quoted in full so a reader
 * can price the gap rather than guess at it", and then printed the literal word
 * `undefined` in TWENTY-TWO CONSECUTIVE ROWS of the table under it, in the
 * column headed *The expectation, word for word*, in a document a district
 * files. Both tables in that section read `e.text` straight off the inventory.
 * That is right for the eleven expectations NO node cites, which is the only
 * place their wording lives — and wrong for every expectation a node DOES
 * cite, because rule 3 at the head of this file says the wording comes from the
 * graph and the inventory deliberately does not retype it. The second table
 * lists exactly the cited ones.
 *
 * So: one reader, both sources, in the order the two rules above put them, and
 * it REFUSES rather than returning a value that is not there. `undefined` is
 * not a fallback. A field this document cannot fill is a build that stops.
 */
const NO_WORDING = [];
function req(v, what) {
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) {
    NO_WORDING.push(what);
    return `«MISSING: ${what}»`;
  }
  return v;
}
/** The expectation's own words: the inventory's copy, else the graph's. */
const wordFor = (e) => req(wordingOf(e.text, TEKS.get(e.code)?.text),
  `the word-for-word text of ${e.code} — neither content/standards/teks-algebra1-inventory.json `
  + 'nor any graph that cites it carries one');
/** The depth and the units a preview-only expectation is carried at. */
const rowFor = (e) => req(TEKS.get(e.code), `the on-disk alignment row for ${e.code}`);

/** Practice/process codes actually claimed by a set of units. */
const practicesOn = (fw, key, ids) => process1[fw].filter((s2) => units.some((u) => (!ids || ids.includes(u.id))
  && u.graph.nodes.some((n) => (practicesOf(n)[key] || []).includes(s2.code)))).length;
const mpAll = practicesOn('ccss', 'CCSS-M', null);
const mpRoute = practicesOn('ccss', 'CCSS-M', ROUTE);
const previewOnlyCore = previewOnly.filter((e) => TEKS.get(e.code).depth === 'core');
const raisedByPreview = ALL_SE.filter((e) => TEKS_R.has(e.code)
  && TEKS_R.get(e.code).depth !== 'core' && TEKS.get(e.code).depth === 'core');
const runOf = (id) => runs.runs.find((x) => x.unit === id);
const routeRun = runOf(ROUTE_ID);
const pct1 = (x) => (x == null ? null : `${Number(x).toFixed(1)}%`);
const unitName = (u) => u.graph.title.replace(/^[^—]*—\s*/, '');

/**
 * THE ARM READERS — because "true mastery" was one word for three cohorts.
 *
 * This document published 97.0% as "the figure that is about a class", with
 * Gate = passes at 80%, while `npm run check:mastery` exited 1 on the same tree
 * over the arm a class actually plays. The number was not wrong; it was about a
 * cohort nobody is. Nothing here may read a mastery figure without naming its
 * cadence, so there is no plain `trueMastery` accessor in this file: every
 * reading goes through one of these three and prints the cadence beside it.
 *
 *   armOf(run, id)  one cadence's block, by the ids build-mastery-runs declares
 *   certified(run)  the figure the 80% promise is judged on — the WEAKER of the
 *                   two delivered cadences, never the cram, never the
 *                   friendlier of the two
 *   cram(run)       the single sitting, published for CONTRAST and never as the
 *                   verdict. It is the strongest evidence this product has,
 *                   because it decays: see section 7.1.
 */
const armOf = (run, id) => (run && run.arms ? run.arms[id] : null);
const certified = (run) => (run && typeof run.certified === 'number' ? run.certified : null);
const cram = (run) => armOf(run, 'oneSitting');
/**
 * WHY A GATE FAILED, IN THIS DOCUMENT'S OWN WORDS.
 *
 * `content/standards/mastery-runs.json` stores the reason as tokens, not as a
 * sentence — `content/` is default-deny for our own English, and this document
 * is built from that data. So the sentence is composed here, out of the token,
 * the cadence's declared label and the run's own reading.
 */
const gateReasons = (r) => (r?.gateFailed || []).map((tok) => {
  if (tok === 'exit') {
    return '`tools/simulate.mjs` refused the run itself — its measured difficulty ladder, or one of '
      + `the seven invariants it asserts on every item and every claim. It exited ${r.exit}.`;
  }
  const c = CADENCES.find((x) => x.id === tok);
  const a = armOf(r, tok);
  return c && a
    ? `**${c.label}** reads ${pct1(a.trueMastery)} true mastery, against a bar of ${BAR.toFixed(0)}%.`
    : `\`${tok}\``;
});
/** Did a delivered cadence actually miss the bar, or did the run refuse itself? */
const missedBar = (r) => !!r && CADENCES.some((c) => c.delivered && armOf(r, c.id)
  && armOf(r, c.id).trueMastery < BAR);
/**
 * The gate cell, in the document's own words — and it says WHICH failure.
 *
 * `verdictOf` fails for two different reasons and one word cannot carry both.
 * A run can clear the bar on both delivered cadences and still be a failed gate
 * because `tools/simulate.mjs` exited non-zero: a broken difficulty ladder, or
 * one of its seven invariants. Printing "fails at 80%" beside 97.5% would read
 * as an arithmetic error in this document rather than as what it is.
 */
const gateCell = (r) => {
  if (!r) return '—';
  if (r.gate === 'pass') return `passes at ${BAR.toFixed(0)}%`;
  return missedBar(r) ? `**fails at ${BAR.toFixed(0)}%**` : '**the run refused itself** — see below';
};

// --- the check the document may not be written without ----------------------
const problems = [];
for (const st of inventory.statements) {
  for (const e of st.expectations) {
    const cited = TEKS.get(e.code);
    if (cited && e.text && e.text !== cited.text) {
      problems.push(`${e.code}: the inventory and the graph quote it differently`);
    }
    if (cited && cited.citation && cited.citation !== e.citation) {
      problems.push(`${e.code}: the graph cites ${cited.citation}, the inventory ${e.citation}`);
    }
    if (cited?.conflict) problems.push(`${e.code}: two units quote it differently`);
  }
}
for (const [code, r] of TEKS) {
  if (!/^A\./.test(code)) continue;
  const known = inventory.statements.some((st) => st.expectations.some((e) => e.code === code));
  if (!known) problems.push(`${code} is cited by a node and is not in the Algebra I inventory`);
  void r;
}

/* THE ROUTE FIGURE IS ACTUALLY A ROUTE FIGURE.
   The whole of section 1 rests on `course(fw, ids)` filtering. If that filter
   ever stops filtering, every "on the route" column silently becomes the
   on-disk column and the document goes back to publishing one number for two
   different courses — the exact conflation a reviewer caught. So it is
   asserted rather than assumed: no code may appear in the route's rows unless
   a unit ON the route cites it. */
for (const [fw, R] of [['CCSS-M', CCSS_R], ['TEKS', TEKS_R]]) {
  problems.push(...routeFilterFaults(fw, R, ROUTE));
}

/* Section 1.2 tells a reader that the gap between the route figure and the
   on-disk figure is accounted for, item by item, and prints the sum. An
   arithmetic claim in a district-facing document is a claim, so it is checked
   rather than trusted: the codes only a preview unit takes to `core`, plus the
   codes a preview unit raises to `core`, must BE the difference. */
if (previewOnlyCore.length + raisedByPreview.length !== atCore.length - atCoreR.length) {
  problems.push(`section 1.2 would print ${previewOnlyCore.length} + ${raisedByPreview.length} as the `
    + `whole difference between ${atCoreR.length} core on the route and ${atCore.length} on disk, and `
    + `that difference is ${atCore.length - atCoreR.length}. The accounting does not close.`);
}

/* THE UNIT HAS ONE NAME. The i18n bundles a learner reads, against the graph
   every document here is generated from. See titleFaults() above. */
const titles = await titlesFromBundles(units.map((u) => ({ id: u.id, titleKey: u.titleKey })));
for (const f of titleFaults(
  units.map((u) => ({ id: u.id, titleKey: u.titleKey, graphTitle: u.graph.title })), titles)) {
  problems.push(`${f.unit} [${f.loc}] ${f.kind}: ${f.say}`);
}

/* THE PUBLISHED MASTERY FIGURES ARE READINGS OF THIS TREE. Section 6 of the
   document prints content/standards/mastery-runs.json. That file used to be
   hand-written and went stale on a unit that is ON THE SHIPPED ROUTE; it is
   generated now, and every row carries a fingerprint of the files the number is
   a reading of. This is where a stale one turns the build red. */
for (const m of checkRuns(runs, await treeNow(), await digestOf(GENERATOR_FILES))) {
  problems.push(`mastery-runs.json — ${m}`);
}

if (heldAt === null) {
  problems.push('content/courses.json — its header no longer records the composed run that holds the '
    + 'preview units back ("-> NN.N% true mastery" under a --units line naming algebra1-l3). Sections 5.5 '
    + 'and 7.1.1 quote that figure, and this build will not print a constant in its place.');
}
if (problems.length) {
  console.error('the sources disagree — refusing to write a document over them:');
  for (const p of problems) console.error('  ' + p);
  if (problems.some((x) => x.startsWith('mastery-runs.json'))) {
    console.error('\nEvery mastery-runs.json line above is cleared by one command, on a quiet tree:');
    console.error('  node tools/build-mastery-runs.mjs');
  }
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The document is what a
     school is shown; a citation that does not match the graph behind it is a
     claim made about a learner's work, on every unit it names. */
  if (CHECK) findings('check:standards', { scope: 'sweep' }).route(problems.map(String)).done();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------
const out = [];
const p = (s = '') => out.push(s);

p('# Standards alignment — ASCENT, Algebra I');
p();
p(`*The Cipher Worlds · ${ROUTE_UNITS.length} units and ${skillsR} skills IN CLASS · `
  + `${units.length} units and ${skills} skills on disk · Common Core and TEKS*`);
p();
p('> **THE TWO FIGURES IN THIS DOCUMENT ARE NOT THE SAME FIGURE.** A class that opens this product '
  + `today receives ${ROUTE_UNITS.length} of the ${units.length} units and ${skillsR} of the ${skills} `
  + `skills. That course covers **${atCoreR.length} of the ${ALL_SE.length}** Algebra I student `
  + `expectations at \`core\`. The other ${PREVIEW_UNITS.length} units are finished, validated and on `
  + `disk, and no learner is sent to them; they raise the same figure to `
  + `**${atCore.length} of ${ALL_SE.length}**. Section 1 prints both, side by side, and section 5.5 says `
  + 'what is holding the second one back. Any single coverage number quoted from this product without '
  + 'saying which of the two it is has been quoted wrongly.');
p();
p('| | On the shipped route | Everything on disk |');
p('|---|---|---|');
p(`| **Units** | ${ROUTE_UNITS.map((u) => `\`${u.id}\``).join(', ')} | ${units.map((u) => `\`${u.id}\``).join(', ')} |`);
p(`| **Skills** | ${skillsR} | ${skills} |`);
p('| **How a learner reaches it** | no query string, cleared save — this is the product | `?unit=` or `?course=` typed into the address bar by hand |');
p(`| **TEKS Algebra I, cited at some depth** | **${citedR.length} of ${ALL_SE.length}** (${pctOf(citedR.length, ALL_SE.length)}) | ${cited.length} of ${ALL_SE.length} (${pctOf(cited.length, ALL_SE.length)}) |`);
p(`| **TEKS Algebra I, at \`core\`** | **${atCoreR.length} of ${ALL_SE.length}** (${pctOf(atCoreR.length, ALL_SE.length)}) | ${atCore.length} of ${ALL_SE.length} (${pctOf(atCore.length, ALL_SE.length)}) |`);
p(`| **TEKS below Algebra I** | ${belowAlgebraR.length} grade 6–8 expectations | ${belowAlgebra.length} grade 6–8 expectations |`);
p(`| **Common Core content standards** | ${CCSS_R.size} cited, ${ccssCoreR.length} at \`core\` | ${CCSS.size} cited, ${ccssCore.length} at \`core\` |`);
p(`| **Common Core practice standards** | ${mpRoute} of ${process1.ccss.length} claimed | ${mpAll} of ${process1.ccss.length} claimed |`);
/* THE FIGURE THAT IS ABOUT A CLASS, AND THE FIGURE THAT IS ABOUT A CRAM.
   This row used to read "97.0% of learners on the composed route", which is the
   ONE UNBROKEN SITTING arm — everything learned in the last eight hours, no
   re-probe across a night — while `npm run check:mastery` refused the same tree
   at 6.7% on the arm a class plays. Three numbers, named. */
if (routeRun) {
  p(`| **True mastery, simulated — the shape a class plays** | **${pct1(armOf(routeRun, 'everyDay').trueMastery)}** `
    + `playing every day, **${pct1(armOf(routeRun, 'everyThirdDay').trueMastery)}** playing every third day, `
    + `on the composed route. The ${BAR.toFixed(0)}% promise is judged on the weaker of those two and is `
    + `**${routeRun.gate === 'pass' ? 'met' : missedBar(routeRun) ? 'NOT met' : 'not certified — the run refused itself'}**. `
    + '| all three cadences, in section 7.1 |');
  p(`| **True mastery, simulated — one unbroken sitting** | ${pct1(cram(routeRun).trueMastery)}, and `
    + `${pct1(cram(routeRun).weekLater)} a week later. This is the cram, it is not the shape this product `
    + 'ships, and no gate is judged on it. | section 7.1 |');
} else {
  p('| **True mastery, simulated** | **not measured** | per unit, in section 7 |');
}
p(`| **TEKS authority** | ${req(inventory.authority, 'the TEKS authority line of the inventory')} | — |`);
p('| **TEKS adoption** | Mathematics TEKS **adopted 2012** — the version STAAR Algebra I is written against | — |');
p(`| **Citations checked** | ${req(inventory.checkedOn, 'the date the inventory citations were checked')} | — |`);
p('| **Generated by** | `node tools/build-standards.mjs`. `--check` re-generates this file and byte-compares it on every run of `npm run check:standards`, and refuses to write at all if a unit has one name in a graph and another in a language bundle, or if a mastery figure below was measured against different bytes than the tree now holds. | — |');
p();
/* ---------------------------------------------------------------------------
   THE VERDICT, SAID PLAINLY AND FIRST.
   A product honestly described as one excellent strand is adoptable as a
   supplement. The same product described as "Algebra I" and DISCOVERED to be
   one strand is not adoptable at all — and the discovery costs a district a
   semester. Every figure in this block is computed above; the sentence is the
   only thing written here, and it says what the route is, what it is not, and
   what it can be bought as.
   --------------------------------------------------------------------------- */
p(`> **WHAT THE SHIPPED ROUTE IS, AND WHAT IT IS NOT.** The ${atCoreR.length} student expectations a class `
  + `receives at \`core\` are not spread across Algebra I. ${LEAD.coreR.length} of the ${atCoreR.length} sit in `
  + `**${LEAD.name}**${BY_CORE[1] && BY_CORE[1].coreR.length ? `, and the other ${atCoreR.length - LEAD.coreR.length} in ${listAnd(BY_CORE.slice(1).filter((d) => d.coreR.length).map((d) => d.name))}` : ''}. `
  + `${UNTOUCHED.length ? `**${UNTOUCHED.length} of the ${DOMAINS.length} TEKS content domains are not touched on the route at all, at any depth:** `
    + `${listAnd(UNTOUCHED.map((d) => `${d.name} (${d.se.length} expectations, ${d.citedR.length} cited)`))}. ` : ''}`
  + `So the route **is** a deep, evidenced unit on the ${LEAD.name.toLowerCase()} strand, and it **is not** an `
  + 'Algebra I course. It cannot be adopted as one. It is adoptable as a supplement, an intervention block or '
  + 'a unit inside somebody else\'s Algebra I — which is a real thing to buy, and is not the thing the word '
  + '"Algebra I" on the front of this document promises. Section 1.3 is the whole of that reading, in a table.');
p();
p('> **AND WHAT WOULD CHANGE IF THE PREVIEW UNITS WERE OPENED.** '
  + `${PREVIEW_UNITS.length} finished units on disk carry ${previewOnly.length} more expectations and would `
  + `take the \`core\` figure from ${atCoreR.length} to ${atCore.length} of ${ALL_SE.length}`
  + `${UNTOUCHED.length ? `, including ${listAnd(UNTOUCHED.map((d) => `${d.core.length} of ${d.se.length} in ${d.name}`))}` : ''}. `
  + 'They are not opened, and section 5.5 gives the measured reason in the manifest\'s own numbers rather than '
  + 'a plan: composing the next unit onto the route takes simulated true mastery from '
  + `${routeRun ? pct1(cram(routeRun).trueMastery) : 'its published figure'} to ${pct1(heldAt)} on the same `
  + `arm, which misses the ${BAR.toFixed(0)}% bar this product is held to. Content that exists is not a course a class can `
  + 'walk, and this document will not add the two together.');
p();
p('> **How to read this document.** Nothing below is a claim about intent. Every citation is made by a '
  + 'node of a knowledge graph, and every node\'s items are re-derived by an independent solver, rendered '
  + 'in strict KaTeX and produced in English, Spanish and Polish before the build will accept them. Where '
  + 'a claim is below `core` the alignment says which part of the expectation is not tested. Where the '
  + 'alignment stops, section 5 says so in writing and names the code. Where the evidence cannot be '
  + 'collected, section 6 says that too.');
p();
p('**Depth.** `core` — the expectation is the thing being taught, and the mastery gate tests it: three '
  + 'unassisted items at difficulty band 4 or above, at least one of them outside notation, in a form or a '
  + 'situation the learner has not practised. `supporting` — exercised inside items aimed at another '
  + 'expectation. `introduced` — a deliberately partial first encounter that a later unit completes. '
  + 'Every claim below `core` carries a caveat naming the part that is not tested, and '
  + '`tools/validate-courses.mjs` fails the build if one does not. **A `core` claim may carry one too** '
  + '— an expectation that names four sources and is taught on three is core, and the fourth is still '
  + 'missing. Section 3.1 lists every caveat in the course, `core` ones first, so that no depth word in '
  + 'this document is read without the qualification written beside it.');
p();

// --- 1. the two figures, separated ------------------------------------------
p('## 1. What a class receives, and what is on disk');
p();
p(`The 2012 Algebra I TEKS state **${ALL_SE.length} content student expectations** across knowledge and `
  + `skills statements (2) through (12) of 19 TAC §111.39(c). The seven process standards in (c)(1) are `
  + 'how a learner works rather than what the course teaches; they are reported separately in section 4 '
  + 'and are **not** counted as content coverage. Every figure below has that 49 under it.');
p();
p('### 1.1 The course a class receives on Monday');
p();
p(`\`content/courses.json\` names the route a learner walks with no query string and a cleared save: `
  + `${ROUTE_UNITS.map((u) => `\`${u.id}\``).join(' then ')}. That is `
  + `${ROUTE_UNITS.length} unit${ROUTE_UNITS.length === 1 ? '' : 's'} and ${skillsR} skills. `
  + `\`npm run check:reachable\` boots the shipped page with no query string, walks to a rift with real `
  + 'key events and proves that every unit on that list can actually be reached; the units below it '
  + 'cannot be, without somebody typing a query string into the address bar.');
p();
p('| Knowledge and skills | Expectations | Cited on the route | At `core` on the route | Cited on disk | At `core` on disk |');
p('|---|---|---|---|---|---|');
for (const st of inventory.statements) {
  const cR = st.expectations.filter((e) => TEKS_R.has(e.code));
  const kR = cR.filter((e) => TEKS_R.get(e.code).depth === 'core');
  const c = st.expectations.filter((e) => TEKS.has(e.code));
  const k = c.filter((e) => TEKS.get(e.code).depth === 'core');
  p(`| **(${st.n})** ${strandOf(st)} | ${st.expectations.length} | ${cR.length} | ${kR.length} | ${c.length} | ${k.length} |`);
}
p(`| **Total** | **${ALL_SE.length}** | **${citedR.length}** (${pctOf(citedR.length, ALL_SE.length)}) `
  + `| **${atCoreR.length}** (${pctOf(atCoreR.length, ALL_SE.length)}) `
  + `| ${cited.length} (${pctOf(cited.length, ALL_SE.length)}) `
  + `| ${atCore.length} (${pctOf(atCore.length, ALL_SE.length)}) |`);
p();
p('**The number to quote is the ROUTE column.** A class that is handed this product covers '
  + `**${atCoreR.length} of the ${ALL_SE.length}** Algebra I student expectations at \`core\` — taught, `
  + `and proved by the mastery gate — and ${citedR.length - atCoreR.length} more in part. Those `
  + `${atCoreR.length} are: ${atCoreR.map((e) => `\`${e.code}\``).join(', ')}.`);
p();
p('**What even that figure is not.** It is not a claim that a student who finishes the route has met '
  + `${pctOf(citedR.length, ALL_SE.length)} of Algebra I. It is a claim about what the content cites and `
  + 'what the gate tests. A `core` claim means the mastery gate demands three unassisted items at '
  + 'difficulty band 4 or above, at least one outside notation, in a form the learner has not practised. '
  + 'It does not mean the expectation has been examined by a person.');
p();
p('### 1.2 The rest of the course, which is on disk and switched off');
p();
p(`${PREVIEW_UNITS.length} more units — ${PREVIEW_UNITS.map((u) => `\`${u.id}\``).join(', ')} — are `
  + `written, validated and shipped in the bundle, at status \`preview\`. They add ${skills - skillsR} `
  + `skills. Between them they carry ${previewOnly.length} Algebra I expectations the route does not `
  + `reach at all, ${previewOnlyCore.length} of them at \`core\`, and they raise `
  + `${raisedByPreview.length} more that the route reaches below \`core\` `
  + `(${raisedByPreview.map((e) => `\`${e.code}\``).join(', ')}) up to \`core\`. `
  + `${previewOnlyCore.length} + ${raisedByPreview.length} = ${atCore.length - atCoreR.length}, which is `
  + `exactly the difference between the ${atCoreR.length} a class receives and the ${atCore.length} on `
  + 'disk. Nothing else accounts for it.');
p();
p('A reader should treat those units as evidence that the content exists, and not as coverage. '
  + '**Section 5.5 says what is holding them, in the manifest\'s own numbers.** Everything in sections 3 '
  + 'and 5 is marked ON ROUTE or preview so the two can never be added together by accident.');
p();

p('### 1.3 Which parts of Algebra I, and whether this is a course');
p();
p('A percentage says how much. It does not say WHICH, and for an adoption decision WHICH is the whole '
  + `question. ${pctOf(atCoreR.length, ALL_SE.length)} spread evenly over Algebra I and `
  + `${pctOf(atCoreR.length, ALL_SE.length)} concentrated in one content domain are the same figure about two `
  + 'different products. This table is the same 49 expectations as section 1.1, grouped by the TEKS\'s own '
  + 'domain names instead of by its statement numbers.');
p();
p('| TEKS content domain | Statements | Expectations | Cited on the route | At `core` on the route | Cited on disk | At `core` on disk |');
p('|---|---|---|---|---|---|---|');
for (const d of DOMAINS) {
  p(`| **${d.name}** | ${d.statements.map((n) => `(${n})`).join(' ')} | ${d.se.length} `
    + `| ${d.citedR.length}${d.citedR.length ? '' : ' — **none**'} | ${d.coreR.length} `
    + `| ${d.cited.length} | ${d.core.length} |`);
}
p(`| **Total** | ${DOMAINS.reduce((a, d) => a + d.statements.length, 0)} statements | **${ALL_SE.length}** `
  + `| **${citedR.length}** | **${atCoreR.length}** | ${cited.length} | ${atCore.length} |`);
p();
p(`**Read the "on the route" columns down.** ${LEAD.coreR.length} of the ${atCoreR.length} \`core\` claims a `
  + `class receives are in **${LEAD.name}**` + (BY_CORE.slice(1).some((d) => d.coreR.length)
    ? `, and ${listAnd(BY_CORE.slice(1).filter((d) => d.coreR.length).map((d) => `${d.coreR.length} in ${d.name}`))}`
    : '') + '. '
  + (UNTOUCHED.length
    ? `${listAnd(UNTOUCHED.map((d) => `**${d.name}**`))} ${UNTOUCHED.length === 1 ? 'is' : 'are'} not cited at `
      + `any depth on the route — ${listAnd(UNTOUCHED.map((d) => `${d.citedR.length} of ${d.se.length} expectations`))}. `
    : '')
  + 'That is the shape of this product, and it is not visible in any single percentage.');
p();
p('**What follows from it, in the words a district would use.**');
p();
p('| The question | The answer this document gives |');
p('|---|---|');
p(`| Is this an Algebra I course? | **No.** ${UNTOUCHED.length ? `${UNTOUCHED.length} of the ${DOMAINS.length} content domains are untouched on the route.` : `Only ${atCoreR.length} of ${ALL_SE.length} expectations are core on the route.`} A course a district adopts for a credit has to cover the credit. |`);
p(`| What is it, then? | A deep, evidenced unit on the ${LEAD.name.toLowerCase()} strand: ${skillsR} skills, `
  + `${citedR.length} of ${ALL_SE.length} expectations cited on the route, ${atCoreR.length} of them at \`core\`, `
  + 'every item re-derived by an independent solver and every claim proved by an unassisted mastery gate. |');
p('| Can it be adopted? | **As a supplement, an intervention block, or a unit inside another Algebra I '
  + 'course — yes.** As the Algebra I course — no, and nothing in this document should be read as offering it '
  + 'as one. |');
p(`| What would close the gap? | The ${PREVIEW_UNITS.length} preview units, which carry `
  + `${previewOnly.length} more expectations and are on disk today. Section 5.5 gives the measured reason they `
  + 'are switched off, and it is a mastery reading and not a schedule. |');
p();

// --- 2. per unit -------------------------------------------------------------
p('## 2. The units');
p();
p('| Unit | In class? | Skills | CCSS codes | CCSS `core` | TEKS codes | TEKS `core` | True mastery, every day | every third day | Working paper |');
p('|---|---|---|---|---|---|---|---|---|---|');
for (const u of units) {
  const cc = [...u.rows.ccss.values()];
  const tk = [...u.rows.teks.values()];
  const r = runOf(u.id);
  const here = ROUTE.includes(u.id) ? '**ON ROUTE**' : `preview — \`?unit=${u.id}\` only`;
  p(`| \`${u.id}\` — ${unitName(u)} | ${here} | ${u.graph.nodes.length} `
    + `| ${cc.length} | ${cc.filter((r2) => r2.depth === 'core').length} `
    + `| ${tk.length} | ${tk.filter((r2) => r2.depth === 'core').length} `
    + `| ${r ? pct1(armOf(r, 'everyDay').trueMastery) : '**not measured**'} `
    + `| ${r ? `${pct1(armOf(r, 'everyThirdDay').trueMastery)}${r.gate === 'fail' ? ' — **fails its own gate**' : ''}` : '—'} `
    + `| [\`${u.id}-standards-map.md\`](standards/${u.id}-standards-map.md) |`);
}
p();
p('Each working paper is generated from its own graph and lists, node by node, every code, its depth, its '
  + 'legal citation, the caveat on any partial claim, and what the mastery gate proves. The Level 1 '
  + 'crosswalk, which additionally names the item forms that carry each expectation, is at '
  + '[`standards/algebra1-l1-crosswalk.md`](standards/algebra1-l1-crosswalk.md).');
p();
p('**Read the TEKS columns with section 1.1 beside them.** The TEKS counts in this table include the '
  + 'grade 6–8 expectations a unit stands on, so they do not add up to the Algebra I figures above and '
  + 'are not meant to. Section 1.1 is the Algebra I denominator; this table is what each unit cites.');
p();
p('**The two mastery columns are two cadences of ONE experiment**, on that unit ALONE, from '
  + '`content/standards/mastery-runs.json`: the same lattice, the same bank and the same item budget, '
  + 'delivered in 22-minute sittings a day apart and three days apart. Both are held to the '
  + `${BAR.toFixed(0)}% bar and the weaker one is what the gate reads. A third cadence — one unbroken `
  + 'sitting — is measured too and is in section 7.1, where it belongs: it flatters every unit here and '
  + 'a class never plays it. Section 7 carries the parameters, the lowest ability quintile, the '
  + 'hollow-claim rate and the composed-route figures, which are the ones about a class.');
p();
/* THE SCALE OF THE STANDALONE COLUMNS, BEFORE ANYBODY QUOTES ONE. A unit run
   alone gets a quarter of the budget and none of its prerequisites, and the
   across-days arm pays for every night either way. Printing the composed figure
   beside it here — not only in section 7.2 — is what stops a reader taking the
   harshest number in the document as the number about a class. */
if (routeRun) {
  const rd = armOf(routeRun, 'everyDay');
  const rt = armOf(routeRun, 'everyThirdDay');
  p('**These two columns are the HARSHEST reading in this document, and they are not the one about a '
    + `class.** Each row is one unit alone, at a ${BUDGET_UNIT}-item budget, with its cross-unit `
    + `prerequisites pruned. The two route units COMPOSED, at ${routeRun.budget} items — which is what a `
    + `class actually receives — read **${pct1(rd.trueMastery)}** every day and `
    + `**${pct1(rt.trueMastery)}** every third day. Section 7.2 says why the two readings differ by that `
    + 'much, and section 7.1 is the one to quote.');
}
p();

// --- 3. every Algebra I expectation -----------------------------------------
p('## 3. Every Algebra I student expectation, one row');
p();
p('`—` in the depth column means no node of any unit cites it. The lines are the skills that carry the '
  + 'claim; a learner reaches them in prerequisite order and nothing unlocks early.');
p();
p('**IN CLASS** marks an expectation a learner meets on the shipped route, at the depth the route '
  + 'reaches. Where the route reaches it below `core` and a preview unit takes it to `core`, the row '
  + 'says both. A row with no **IN CLASS** mark is on disk only.');
p();
for (const st of inventory.statements) {
  p(`### (${st.n}) ${strandOf(st)}`);
  p();
  p(`> ${st.statement}`);
  p();
  p('| Code | 19 TAC | In class? | Depth on the route | Depth on disk | Units | Lines that carry it |');
  p('|---|---|---|---|---|---|---|');
  for (const e of st.expectations) {
    const r = TEKS.get(e.code);
    const rr = TEKS_R.get(e.code);
    const lines = r ? [...new Set(r.nodes)].map((x) => `\`${x}\``).join(', ') : '—';
    p(`| **${e.code}** | \`${e.citation}\` | ${rr ? '**IN CLASS**' : '—'} `
      + `| ${rr ? rr.depth : '**not on the route**'} | ${r ? r.depth : '**not claimed**'} `
      + `| ${r ? r.units.map((x) => x.replace('algebra1-', '')).join(', ') : '—'} | ${lines} |`);
  }
  p();
}

/* EVERY PARTIAL CLAIM, INCLUDING THE `core` ONES, IN THE TOP DOCUMENT.
   The depth column above is one word, and one word cannot say "core on three of
   the four sources this expectation names". The caveats were written, checked
   by `tools/validate-courses.mjs` and printed in the per-unit working papers —
   and a reviewer reading only this file saw `core` with nothing beside it. A
   qualification a reader has to go and find is a qualification that gets
   quoted without. Route rows first, because those are the ones about a class. */
{
  const partial = [];
  for (const u of units) {
    for (const n of u.graph.nodes) {
      for (const a of alignmentOf(n)) {
        if (!a.caveat) continue;
        partial.push({ unit: u.id, node: n.id, onRoute: ROUTE.includes(u.id), ...a });
      }
    }
  }
  partial.sort((a, b) => (a.onRoute === b.onRoute
    ? (RANK[b.depth] || 0) - (RANK[a.depth] || 0) || a.code.localeCompare(b.code)
    : (a.onRoute ? -1 : 1)));
  const coreOnRoute = partial.filter((x) => x.onRoute && x.depth === 'core');
  p('### 3.1 Every claim that is not the whole expectation');
  p();
  p(`${partial.length} of the claims in this document cover part of the expectation they cite and say `
    + `so. ${coreOnRoute.length} of those are marked \`core\` **on the shipped route**: the expectation `
    + 'is the thing being taught and the mastery gate tests it, and one clause of it is still not '
    + 'reached. Every caveat below is written on the graph node that makes the claim, is checked by '
    + '`tools/validate-courses.mjs`, and is printed to a learner and to a teacher in their own '
    + 'language. This table is here because a one-word depth column cannot carry any of it.');
  p();
  p('| Code | In class? | Depth | Line | What is NOT tested |');
  p('|---|---|---|---|---|');
  for (const x of partial) {
    p(`| **${short(x.code)}** | ${x.onRoute ? '**IN CLASS**' : 'preview'} `
      + `| ${x.depth === 'core' ? '**core**' : x.depth} | \`${x.node}\` | ${x.caveat} |`);
  }
  p();
}

// --- 4. process standards ----------------------------------------------------
p('## 4. Process and practice standards');
p();
p('A process standard is how a learner works, not what a unit teaches, so it is the same sentence in '
  + 'Level 1 and in Level 5 and it belongs to neither. The wording and the sentence beside it live once, '
  + 'for the course, in [`standards/practices-algebra1.json`](standards/practices-algebra1.json). Which '
  + 'lines claim a code is read out of the graphs, and is what the columns below count.');
p();
p('**IN CLASS** marks a code at least one line of the shipped route claims. The `Lines` column counts '
  + 'every unit on disk; `Lines on the route` counts only the units a class receives.');
p();
for (const [fw, label, key] of [['teks', 'TEKS process standards — 19 TAC §111.39(c)(1)', 'TEKS'],
  ['ccss', 'Common Core Standards for Mathematical Practice', 'CCSS-M']]) {
  p(`### ${label}`);
  p();
  p('| Code | In class? | Units | Lines | Lines on the route | Expectation | What the game actually does about it |');
  p('|---|---|---|---|---|---|---|');
  for (const s of process1[fw]) {
    const us = [];
    let n = 0;
    let nR = 0;
    for (const u of units) {
      let hit = false;
      for (const node of u.graph.nodes) {
        if (!(practicesOf(node)[key] || []).includes(s.code)) continue;
        n++;
        hit = true;
        if (ROUTE.includes(u.id)) nR++;
      }
      if (hit) us.push(u.id.replace('algebra1-', ''));
    }
    p(`| **${s.code}** | ${nR ? '**IN CLASS**' : '—'} | ${us.join(', ') || '—'} | ${n} | ${nR} | ${s.text} | ${s.how} |`);
  }
  p();
}

// --- 5. the gaps -------------------------------------------------------------
p('## 5. Where the alignment stops');
p();
p('A unit is judged as much by what it refuses to claim as by what it cites. Everything below is a gap '
  + 'this product declares about itself.');
p();
p('### 5.1 Algebra I expectations this course does not claim at all');
p();
p(`${ALL_SE.length - cited.length} of the ${ALL_SE.length} are claimed nowhere on disk, at any depth. `
  + `A further ${previewOnly.length} are claimed ONLY inside a preview unit, so a class on the route `
  + 'does not meet them either. Both lists are below, and every expectation is quoted in full so a '
  + 'reader can price the gap rather than guess at it.');
p();
p(`**Claimed nowhere — ${ALL_SE.length - cited.length} of ${ALL_SE.length}.**`);
p();
p('| Code | 19 TAC | The expectation, word for word |');
p('|---|---|---|');
for (const e of ALL_SE) {
  if (TEKS.has(e.code)) continue;
  p(`| **${e.code}** | \`${req(e.citation, `the 19 TAC citation of ${e.code}`)}\` | ${wordFor(e)} |`);
}
p();
p(`**On disk, but not on the route — ${previewOnly.length} of ${ALL_SE.length}.** These are written and `
  + 'validated; a class is not sent to them. The unit that carries each one is named so a district can '
  + 'see exactly what promoting a preview unit would buy.');
p();
p('| Code | 19 TAC | Depth on disk | Unit | The expectation, word for word |');
p('|---|---|---|---|---|');
for (const e of previewOnly) {
  const r = rowFor(e);
  p(`| **${e.code}** | \`${req(e.citation, `the 19 TAC citation of ${e.code}`)}\` `
    + `| ${req(r.depth, `the depth ${e.code} is claimed at`)} `
    + `| ${req(r.units?.map((x) => x.replace('algebra1-', '')).join(', ') || null, `the units that carry ${e.code}`)} `
    + `| ${wordFor(e)} |`);
}
p();
p('**The shape of what is missing.** Every one of them needs something this product does not yet have: a '
  + 'coordinate plane a learner can shade a half-plane on (`A.3(D)`, `A.3(H)`), a graph a learner can '
  + 'transform and read back (`A.3(E)`, `A.7(C)`, `A.9(D)`), a graphical estimate rather than an exact '
  + 'answer (`A.3(G)`), or a statistics tool — a correlation coefficient, a technology-produced fit — that '
  + 'no answer surface in this game offers (`A.4(A)`, `A.4(B)`, `A.8(B)`, `A.9(E)`). `A.9(A)` needs a '
  + 'domain and range stated as inequalities, which is a written answer and not a number. None of them is '
  + 'blocked by the knowledge graph; all of them are blocked by the answer surfaces the engine can verify '
  + 'independently, and this product ships no item it cannot re-derive.');
p();

p('### 5.2 Declared gaps inside the units');
p();
p('Codes a reader might reasonably expect to find on a unit and will not, in each unit\'s own words.');
p();
p('| Unit | In class? | Code | 19 TAC | Why not |');
p('|---|---|---|---|---|');
let declared = 0;
let declaredOnRoute = 0;
for (const u of units) {
  for (const g of u.graph.verification?.declaredGaps || []) {
    declared++;
    if (ROUTE.includes(u.id)) declaredOnRoute++;
    p(`| \`${u.id.replace('algebra1-', '')}\` | ${ROUTE.includes(u.id) ? '**ON ROUTE**' : 'preview'} `
      + `| \`${short(g.code)}\` | ${g.citation ? `\`${g.citation}\`` : '—'} | ${g.why} |`);
  }
}
if (!declared) p('| — | — | — | — | — |');
p();
p('A gap declared by a unit no class receives is a smaller thing than the same gap on the route. The '
  + 'second column says which is which; a reader pricing this product today should read the **ON ROUTE** '
  + `rows first. ${declaredOnRoute
    ? `There ${declaredOnRoute === 1 ? 'is one' : `are ${declaredOnRoute}`} of them.`
    : 'On this tree there are none: every row above belongs to a unit a class is not sent to. What the '
      + 'route DOES leave uncovered is section 1.1 and section 5.1 — the '
      + `${ALL_SE.length - citedR.length} Algebra I expectations it does not cite at all — and not this `
      + 'table.'}`);
p();

p('### 5.3 Where the evidence is counted at the line, not at the expectation');
p();
p('The teacher record counts, per expectation, how many of the item forms that carry it this learner has '
  + 'actually met. Level 1 names those forms per expectation, in '
  + '[`standards/ccss-algebra1-l1.json`](standards/ccss-algebra1-l1.json) and '
  + '[`standards/teks-algebra1-l1.json`](standards/teks-algebra1-l1.json), which is what lets the record '
  + 'report a line that is proved while an expectation it carries has never once been asked. **Levels 2 '
  + 'to 5 do not name them yet.** Their evidence is counted at the line — every question type the citing '
  + 'skills ask — so on those units a proved line and a covered expectation cannot come apart, and the '
  + 'record cannot report that they have. Inventing a per-expectation list for them would be exactly the '
  + 'vendor alignment sheet this document exists not to be.');
p();
p('Every coverage row of the exported record carries a `basis` field saying which of the two it rests on '
  + '(`named` or `line`), so a reader of the JSON can tell them apart per expectation. **The printed '
  + 'sheet on screen does not show it yet** — the word for it has to be added to all three locale bundles '
  + 'first, and those belong to the localisation area, not to this one. Until then this paragraph is '
  + 'where the difference is declared.');
p();

p('### 5.4 Common Core is reported without a denominator, on purpose');
p();
p(`On the route this course cites ${CCSS_R.size} Common Core content standards, ${ccssCoreR.length} of `
  + `them at \`core\`; across every unit on disk, ${CCSS.size} and ${ccssCore.length}. No percentage is `
  + 'given for either, and one should be treated with suspicion if it appears elsewhere. Common Core '
  + 'has no "Algebra I" list to be a share of: the content of this course sits across the High School '
  + 'Algebra, Functions, Number and Quantity and Statistics conceptual categories and across the grade 6, '
  + '7 and 8 Expressions and Equations and Functions domains, and which of those a district calls '
  + '"Algebra I" is a district decision. TEKS has a legal list of forty-nine, so TEKS gets a percentage.');
p();

p('### 5.5 The preview units, and what is holding them');
p();
p(`${PREVIEW_UNITS.length} finished units sit on disk at status \`preview\`. They are not a work in `
  + 'progress and they are not hidden: `npm run check:courses` generates, verifies and aligns every one '
  + 'of them on every build, in three languages, and `npm run check:mastery` runs them. What holds them '
  + 'is one measured number.');
p();
{
  const nextUp = PREVIEW_UNITS[0];
  p('Two readings, one lattice apart:');
  p();
  p('```bash');
  p('# THE SHIPPED ROUTE. Re-measured by this build; see section 7.1.');
  p(`node tools/simulate.mjs ${routeRun ? routeRun.learners : ROUTE_LEARNERS_DOC} `
    + `${routeRun ? routeRun.budget : ROUTE_BUDGET_DOC} --units ${ROUTE.join(',')}`);
  p(`  -> ${routeRun ? pct1(cram(routeRun).trueMastery) : 'not measured'} true mastery `
    + 'IN ONE UNBROKEN SITTING — the cram, which is the arm both of these readings are on');
  if (nextUp) {
    p('');
    p('# THE SAME ROUTE WITH THE NEXT UNIT COMPOSED ONTO IT.');
    p(`node tools/simulate.mjs ${ROUTE_LEARNERS_DOC} ${ROUTE_BUDGET_DOC} `
      + `--units ${[...ROUTE, nextUp.id].join(',')}`);
    p(`  -> ${pct1(heldAt)} true mastery; a knower proves the whole lattice 2.3% of the time`);
  }
  p('```');
  p();
  p('**Both of those are the CRAM arm**, which is the only arm the decision to hold Level 3 was ever '
    + 'measured on. They are comparable with each other and with the first row of section 7.1, and with '
    + 'nothing else here. Whether composing Level 3 would hold up on the shape a class plays has not '
    + 'been measured at all: `npm run check:mastery:full` takes that reading and, on this tree, it has '
    + 'never been run — see section 7.4.');
  p();
  p('**Where each of those two numbers comes from, because they are not the same kind of number.** '
    + 'The first is re-taken by `node tools/build-mastery-runs.mjs`, recorded in '
    + '`content/standards/mastery-runs.json` with a fingerprint of the tree it was measured on, and '
    + 'printed in section 7.1 of this document. **The second is quoted from the header of '
    + '`content/courses.json`**, where the decision to hold the preview units was written down. This '
    + 'build does not re-take it — a second composed Monte-Carlo run on every build is an expense that '
    + 'buys nothing while the decision stands — so it is a dated reading by the person who made the '
    + 'decision, and it is marked as one here rather than dressed up as this build\'s own.');
  p();
  if (nextUp) {
    p(`Composing \`${nextUp.id}\` onto the route takes simulated true mastery, on the cram, from `
      + `${routeRun ? pct1(cram(routeRun).trueMastery) : 'the route figure'} to ${pct1(heldAt)}, which misses `
      + `the ${BAR.toFixed(0)}% bar this product is held to by ${(BAR - heldAt).toFixed(1)} points. So it is not put in front of `
      + 'anybody. That is a product decision written into the manifest rather than a defect: '
      + '`route.units` is the single list the loader, the world, the session and the narrative all read, '
      + 'and adding a unit id to it is the whole change. `npm run check:mastery` reads severity off that '
      + 'same list, so a unit promoted onto the route becomes a hard failure on the next build with no '
      + 'edit to any tool.');
    p();
  }
}
p('**The honest reading of that.** The content for five units exists and is validated. The ADAPTIVE '
  + 'SEQUENCE that gets a learner through five units does not yet, and this document will not call '
  + 'content coverage a course. A district buying this today is buying '
  + `${ROUTE_UNITS.length} units and ${skillsR} skills, with the rest visible on disk and dated.`);
p();

// --- 6. where the evidence lives --------------------------------------------
p('## 6. Where the evidence lives, and what a district cannot do with it yet');
p();
p('**There is no account, no roster and no server.** Every figure in a learner\'s record — every '
  + 'question answered, every claim granted, every claim withdrawn — lives in one browser\'s '
  + '`localStorage`, on one device. Nothing is uploaded. There is no sign-in, no class list the software '
  + 'knows about, and no copy of anything anywhere else.');
p();
p('That is a deliberate shape, and it has a real benefit: a school can switch this on with no student '
  + 'data leaving the device and no data-protection review to finish first. It also has a cost, and the '
  + 'cost is the thing a district must price before September, not in September.');
p();
p('| What a district will want to do | What happens today |');
p('|---|---|');
p('| Attach evidence to a named student | The name is typed into the record by whoever is at the keyboard. Nothing verifies it. |');
p('| Find a student\'s record next week | Only on the same browser profile on the same device. Clearing site data clears the record. |');
p('| Use a shared cart or lab Chromebook | **This is the failure case.** Shared devices and shared profiles mean one store for many students; a signed-out or wiped Chromebook loses the evidence entirely. On the devices this product targets, a district cannot reliably attach evidence to a student at all. |');
p('| Assemble a class record | Each student exports a JSON file from their own screen and hands it over. The teacher drops those files into the CLASS tab and gets a roster. It is assembled by hand, every time. |');
p('| Put marks in a gradebook | The record exports CSV, one row per line of the graph. The import is manual. |');
p('| Audit a claim later | The printed sheet is dated and carries a record id and the item counts behind each claim. It is a document, not a database row; nothing outside the device can confirm it. |');
p();
p('**The record says this about itself, on the paper.** A department head who never opens this file '
  + 'still reads it: the teacher record prints a WHERE THIS RECORD LIVES block, in English, Spanish and '
  + 'Polish, on the screen and on the printed sheet — `src/report/teacher.js` `custodyNote()`. A '
  + 'limitation that lives only in a repository is a limitation a school finds out about in September.');
p();
p('**This is not a defect report; it is a scope statement.** Nothing above is broken. The product does '
  + 'exactly what it was built to do, and what it was built to do does not include being a system of '
  + 'record. A district reading this should assume that TODAY, evidence of mastery is a printed or '
  + 'exported file a student produced, and plan for it as paper.');
p();
p('### 6.1 The smallest honest path to a class record');
p();
p('Written down so the decision can be made with the facts rather than discovered on a Tuesday in '
  + 'September. In increasing order of cost, and none of these is built:');
p();
p('| Step | What it buys | What it costs |');
p('|---|---|---|');
p('| **1. Export / import, which exists** | A teacher can assemble a class today, from files students hand over. | Nothing — it ships. It is manual and it is per-sitting. |');
p('| **2. A signed export** | The exported file carries a signature over its own contents, so a record a teacher receives can be shown not to have been edited after it left the device. | A key in the build and a verify step in the CLASS tab. No server, no account. This is the step that turns a file into evidence. |');
p('| **3. A teacher-side merge** | Two files from the same learner — two sittings, two devices — combine into one record instead of replacing each other, so evidence survives a device change. | A merge rule over the evidence ledger, and a rule for what happens when the two disagree. Still no server. |');
p('| **4. A roster file** | The teacher supplies a class list once; records bind to a name from that list rather than to whatever was typed. | A file format and an identity check. Still no server. |');
p('| **5. A server** | Everything above, automatically, on shared hardware. | An account system, a data-protection review, and a different product. **This is a product decision and is not made here.** |');
p();
p('Steps 2 to 4 are worth stating together because they are the whole of what a district actually asks '
  + 'for — *"can I trust this file, and does it follow the child?"* — and none of them needs a server or '
  + 'an account. Step 5 is the only one that does, and it is the only one that changes what this product '
  + 'is.');
p();

// --- 7. mastery evidence ----------------------------------------------------
p('## 7. What has actually been measured');
p();
p('A standards claim is a claim about content. Whether learners reach mastery is a different question and '
  + 'is answered by `tools/simulate.mjs`, which runs synthetic learners through the real mastery engine, '
  + 'the real prerequisite gate and the real item bank while tracking a hidden competence the engine never '
  + 'sees. Every figure below is one run of that command. None of them is typed: '
  + '`content/standards/mastery-runs.json` is generated by `node tools/build-mastery-runs.mjs`, which '
  + 'parses the run\'s own output, and every row carries a fingerprint of the graph, the item pack, the '
  + 'engine and the simulator it was measured against. `npm run check:standards` re-computes those '
  + 'fingerprints and turns the build red if any figure here was measured on a different tree, so this '
  + 'table cannot go stale quietly. It did once, on a unit that is on the route.');
p();
p('### 7.1 The route, composed — three cadences of one experiment');
p();
p('**One number was published here, and it was about a cohort nobody is.** This section used to print a '
  + `single figure — ${routeRun ? pct1(cram(routeRun).trueMastery) : 'the headline'} — under the heading `
  + '"the figure that is about a class", with the gate marked as passed. That figure is the ONE UNBROKEN '
  + 'SITTING arm: everything the learner knows was learned in the last eight hours and not one re-probe '
  + 'crossed a night. `tools/simulate.mjs` calls that row *the cram* in its own output. On the same tree, '
  + '`npm run check:mastery` exited 1 over the arm a class actually plays. A document that asserts a '
  + 'figure passes a gate the build refuses is worse than no document, so the pipeline was fixed rather '
  + 'than the sentence: `tools/build-mastery-runs.mjs` now reads the arms through `readArms()` and '
  + '`verdictOf()` in `tools/simulate-all.mjs` — **the gate\'s own reader, imported and not copied** — '
  + 'and all three cadences are published below.');
p();
if (routeRun) {
  p('| Cadence | The shape this product ships? | True mastery at the end | A week later | A month later | Lowest ability quintile | Any hollow claim | Gate |');
  p('|---|---|---|---|---|---|---|---|');
  for (const c of CADENCES) {
    const a = armOf(routeRun, c.id);
    const isBar = c.delivered && a.trueMastery === certified(routeRun);
    p(`| **${c.label}** | ${c.delivered ? '**yes**' : 'no'} `
      + `| ${c.delivered ? `**${pct1(a.trueMastery)}**` : pct1(a.trueMastery)} `
      + `| ${pct1(a.weekLater)} | ${pct1(a.monthLater)} | ${pct1(a.lowestQuintile)} | ${pct1(a.hollowLearners)} `
      + `| ${c.delivered
        ? `${a.trueMastery >= BAR ? `passes at ${BAR.toFixed(0)}%` : `**fails at ${BAR.toFixed(0)}%**`}`
          + `${isBar ? ' — **this is the row the gate reads**' : ''}`
        : 'no gate is judged on this row'} |`);
  }
  p();
  for (const c of CADENCES) p(`* **${c.label}** — ${c.doc}`);
  p();
  p(`${routeRun.learners} learners, a ${routeRun.budget}-item budget, `
    + `${(routeRun.units || ROUTE).join(' + ')}, ${routeRun.invariantsPassed} of `
    + `${routeRun.invariantsTotal} invariants pass, measured ${routeRun.ranOn}. `
    + `**The ${BAR.toFixed(0)}% promise is judged on ${pct1(certified(routeRun))}** — the WEAKER of the two `
    + 'delivered cadences, because a class that meets three times a week is the same product at a '
    + `different gap and quoting the friendlier row would be choosing the arm again. It ${gateCell(routeRun)}.`);
  p();
  if (routeRun.gate === 'fail') {
    p('`npm run check:mastery` refuses this tree, on this:');
    p();
    for (const w of gateReasons(routeRun)) p(`* ${w}`);
    p();
  }
  p('```bash');
  p(`node tools/simulate.mjs ${routeRun.learners} ${routeRun.budget} --units ${(routeRun.units || ROUTE).join(',')}`);
  p('npm run check:mastery                     # the same run, with the same reader, as a gate');
  p('```');
  p();
  /* THE FINDING THE THREE ROWS EXIST TO CARRY. It is the product's whole
     thesis and it is measured, not argued. */
  p('### 7.1.1 What the three rows say, which is the product\'s whole thesis');
  p();
  const one = cram(routeRun);
  const day = armOf(routeRun, 'everyDay');
  p(`**The cram evaporates and the schedule does not.** Same lattice, same bank, same `
    + `${routeRun.budget}-item budget, same learners — the only difference is the shape the work arrives `
    + `in. One unbroken sitting reaches ${pct1(one.trueMastery)} at the buzzer and **${pct1(one.weekLater)} `
    + `a week later**. Twenty-two-minute sittings a night apart reach ${pct1(day.trueMastery)}, and are `
    + `still at **${pct1(day.monthLater)} a MONTH later**. That is the case for this product, measured `
    + 'rather than asserted, and it is the reason the cram figure is printed here at all: it is the '
    + 'control, not the claim.');
  p();
  const third = armOf(routeRun, 'everyThirdDay');
  const sw = routeRun.sweep?.everyThirdDay;
  p(`**And the row that does not flatter us, published as it stands.** At a three-day gap the same `
    + `cohort reaches ${pct1(third.trueMastery)}, with ${pct1(third.lowestQuintile)} of the weakest fifth `
    + `and ${pct1(third.hollowLearners)} of learners holding a hollow claim. Three days is an ordinary `
    + 'school pattern. It is the difference between this product working and this product not existing, '
    + 'and it is why `npm run check:mastery` is red on this tree.');
  p();
  /* AND THE SECOND REASON NOT TO ARGUE WITH ITS DECIMAL. A Monte-Carlo row is
     not a constant. This one has been recorded on this repo at three different
     values inside one week, over trees that differed by prose and by a caveat,
     and a document that prints only the newest invites a reader to treat it as
     a measurement of the third decimal instead of a finding about the first
     digit. `tools/build-mastery-runs.mjs` keeps the readings each row replaced;
     this is them. */
  const HIST = (routeRun.history || []).filter((h) => typeof h.everyThirdDay === 'number');
  if (HIST.length) {
    const band = [...HIST.map((h) => h.everyThirdDay), third.trueMastery].sort((x, y) => x - y);
    p(`**And it is a band, not a point.** This row has been recorded ${band.length} times on this repo, `
      + `between **${pct1(band[0])} and ${pct1(band[band.length - 1])}**, over trees that differed by prose `
      + 'and by a caveat. The engine, the lattice, the bank and the budget were the same in all of them; '
      + 'the seed was not. Quote the band. A reader who argues with the decimal of this row is arguing '
      + 'with the seed, and the finding is in the first digit.');
    p();
    p('| Reading | Tree | Every day (24 h) | Every third day (72 h) |');
    p('|---|---|---|---|');
    for (const h of HIST) {
      p(`| ${h.ranOn || 'not dated'} | \`${h.digest || 'not fingerprinted'}\` `
        + `| ${typeof h.everyDay === 'number' ? pct1(h.everyDay) : 'not recorded'} `
        + `| ${pct1(h.everyThirdDay)} |`);
    }
    p(`| **${routeRun.ranOn} — the reading above** | \`${routeRun.sources.digest}\` `
      + `| ${pct1(day.trueMastery)} | ${pct1(third.trueMastery)} |`);
    p();
  } else {
    p('**This row has been taken once on this tree.** `tools/build-mastery-runs.mjs` keeps the readings a '
      + 'row replaces, so the next re-take prints the band it moves in rather than one point; there is '
      + 'nothing to compare it with yet, and this paragraph says so rather than implying a stability '
      + 'nobody has measured.');
    p();
  }
  if (sw) {
    p(`**What that ${pct1(third.trueMastery)} rests on, in writing.** Its ABSOLUTE level is decided by two `
      + `constants in \`tools/simulate.mjs\` — \`${SWEPT_CONSTANTS.join('` and `')}\`, the permastore floor `
      + 'and the forgetting exponent. Power-law forgetting and a Bahrick permastore are both real, '
      + '**but nobody in this repo has calibrated either constant against a human**, and the run\'s own '
      + `${sw.cells}-cell sweep of them moves this row from **${sw.low}% to ${sw.high}%** `
      + `(the every-day row moves ${routeRun.sweep.everyDay.low}% to ${routeRun.sweep.everyDay.high}% `
      + 'across the same grid). The engine is identical in all of them; only the forgetting model moves. '
      + 'So the RANKING of the three cadences is a finding of this model and the LEVEL of the '
      + 'three-day row is not yet a measurement of anything. Read the spread before quoting the row. The '
      + 'sweep is printed by the run itself, under *how much of that is the forgetting model?*.');
    p();
  }
  p('**What `content/courses.json` publishes, and why it is a different number.** The manifest\'s own '
    + `header records ${PUBLISHED.claim.toFixed(1)}% for this route and ${pct1(heldAt)} for the route `
    + `with Level 3 composed onto it. Both of those are **${CADENCES.find((c) => !c.delivered).label}** `
    + 'readings — the arm above that is not the delivery shape — taken when the decision to hold Level 3 '
    + 'was written down. They are comparable with each other and with the first row of the table above, '
    + 'and with nothing else in this document.');
} else {
  p('**Not measured.** `node tools/build-mastery-runs.mjs --unit route` takes this reading, and '
    + '`npm run check:standards` is red until it does.');
}
p();
p('This is the lattice a learner with no query string walks, with cross-unit prerequisites intact. It '
  + 'is not the same measurement as a unit run on its own, and the difference is not small: '
  + '`--unit algebra1-l2` prunes the Level 1 prerequisites and models a learner who walked into Level 2 '
  + 'with nothing behind them, a condition `src/content/route.js` makes impossible. `npm run check:mastery` '
  + `re-runs the composed experiment on every build and exits 1 when either delivered cadence is below `
  + `${BAR.toFixed(0)}%.`);
p();
p('### 7.2 Each unit on its own');
p();
p('Every unit, including the preview ones, run standalone. A preview unit that misses the bar is printed '
  + 'here with the number that misses it.');
p();
p('Each row is the same three cadences as section 7.1. The gate column reads the weaker of the two '
  + 'delivered ones; the cram column is the control and no gate is judged on it.');
p();
p('| Unit | In class? | Learners | Item budget | Every day (24 h) | Every third day (72 h) | The cram, for contrast | Lowest quintile, every day | Any hollow claim, every day | Invariants | Gate | Run on |');
p('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const u of units) {
  const r = runOf(u.id);
  const day = armOf(r, 'everyDay');
  const third = armOf(r, 'everyThirdDay');
  p(`| \`${u.id.replace('algebra1-', '')}\` | ${ROUTE.includes(u.id) ? '**ON ROUTE**' : 'preview'} `
    + `| ${r ? r.learners : '—'} | ${r ? r.budget : '—'} `
    + `| ${day ? pct1(day.trueMastery) : '**not measured**'} | ${third ? pct1(third.trueMastery) : '—'} `
    + `| ${r ? pct1(cram(r).trueMastery) : '—'} `
    + `| ${day ? pct1(day.lowestQuintile) : '—'} | ${day ? pct1(day.hollowLearners) : '—'} `
    + `| ${r ? `${r.invariantsPassed} of ${r.invariantsTotal} pass` : '—'} `
    + `| ${gateCell(r)} `
    + `| ${r ? r.ranOn : '—'} |`);
}
p();
/* WHY A GATE FAILED, WHERE THE ONE-WORD COLUMN CANNOT SAY IT. A row can clear
   the bar on both delivered cadences and still be a failed gate, because
   tools/simulate.mjs exited non-zero on its own ladder or its own invariants.
   Those are different problems and a reader must not have to guess which. */
{
  const refused = [...runs.runs].filter((r) => r.gate === 'fail' && !missedBar(r));
  if (refused.length) {
    p('**Where the gate column reads *the run refused itself*.** '
      + `${refused.map((r) => `\`${r.unit.replace('algebra1-', '')}\``).join(', ')} `
      + `clear${refused.length === 1 ? 's' : ''} the ${BAR.toFixed(0)}% bar on both delivered cadences `
      + 'and `tools/simulate.mjs` still exited non-zero, so nothing here is certified. Its own words:');
    p();
    for (const r of refused) {
      for (const w of gateReasons(r)) p(`* \`${r.unit}\` — ${w}`);
    }
    p();
    p('That is usually the measured difficulty ladder: the run checks that every skill asks strictly '
      + 'more at band 5 than at band 1, and refuses the whole run if one does not. '
      + '`npm run check:courses` names the skill and the rung.');
    p();
  }
}
p();
p('```bash');
p(`node tools/simulate.mjs --unit ${PREVIEW_UNITS[PREVIEW_UNITS.length - 1]?.id || units[0].id} `
  + `${LEARNERS_UNIT} ${BUDGET_UNIT}`);
p('node tools/build-mastery-runs.mjs        # re-take every reading in this section');
p('```');
p();
p('**And the per-unit rows are ADVISORY, for two structural reasons.** First, `--unit <id>` prunes '
  + 'cross-unit prerequisites, so it models a learner walking into Level 2 with no Level 1 behind them '
  + '— the one condition `src/content/route.js` makes impossible. Second, and this is what makes the '
  + 'two across-days columns here so much harsher than section 7.1: the delivered arm spends the item '
  + `budget in short sittings, so a run at a ${BUDGET_UNIT}-item budget gets about a quarter of the `
  + `sittings a run at ${ROUTE_BUDGET_DOC} does, and every night in between still costs the learner `
  + 'forgetting. A short course delivered across days is the hardest '
  + 'shape in this whole table, and it is not the shape a class is in. **Section 7.1 is the lattice a '
  + 'class walks**, and it is the row `npm run check:mastery` can turn the build red on. These rows say '
  + 'what each unit does when it is asked to stand on nothing, on a quarter of the schooling.');
p();
{
  const perUnit = runs.runs.filter((r) => r.unit !== ROUTE_ID);
  const worst = [...perUnit].sort((a, b) => certified(a) - certified(b))[0];
  const worstDay = armOf(worst, 'everyDay');
  const failing = perUnit.filter((r) => r.gate === 'fail');
  const failRoute = failing.filter((r) => ROUTE.includes(r.unit));
  p('**Read the mastery and the quintile columns together.** The headline figure that has circulated for '
    + 'this product — true mastery near 100% — is Level 1\'s, on the cram, and Level 1 is ten skills of '
    + `one-variable linear equations. The weakest unit on disk is \`${worst.unit}\` at `
    + `${pct1(certified(worst))} on the cadence its gate reads, with ${pct1(worstDay.lowestQuintile)} of `
    + `the weakest fifth and ${pct1(worstDay.hollowLearners)} of learners holding a hollow claim when `
    + 'played every day. That is not a defect in the reporting; it is what that unit currently is, and '
    + 'it is printed here because a coverage document that prints only the flattering half of its own '
    + 'evidence is the thing this file exists not to be.');
  p();
  const one = failing.length === 1;
  p(`The ${BAR.toFixed(0)}% bar is applied to BOTH delivered cadences, and on this tree `
    + (failing.length
      ? `${failing.length} unit${one ? '' : 's'} `
        + `(${failing.map((r) => `\`${r.unit.replace('algebra1-', '')}\``).join(', ')}) `
        + `miss${one ? 'es' : ''} it standalone. `
        + (failRoute.length
          ? `**${failRoute.length} of ${one ? 'them is' : 'those are'} ON THE SHIPPED ROUTE** — and `
            + 'the paragraph above is how to read that: section 7.1 measures those same units COMPOSED, '
            + 'at four times the budget, which is what a class receives, and that run clears the bar '
            + 'on the daily cadence.'
          : `${one ? 'It is NOT' : 'None of them is'} on the shipped route, so no class is sent to `
            + `${one ? 'it' : 'any of them'}.`)
      : 'every unit clears it standalone.')
    + ' `tools/simulate.mjs` applies its own, different bar — to the cram — and its exit code is recorded '
    + 'in `content/standards/mastery-runs.json` as `cramGate` beside the gate above, never as it.');
}
p();
p('**What the figures are not.** They are simulated learners, not children. The model is deliberately '
  + 'ungenerous — a third of learners carry a misconception that resists teaching, an inattention slip '
  + 'applies whatever the learner knows, an unfamiliar representation costs real accuracy, and everything '
  + 'decays with elapsed time — but it is still a model, and the invariants beside each row are the '
  + 'part that is not: they are assertions about the engine, checked on every item and every claim of '
  + 'every run, and zero is the only passing value. **Simulated mastery is not evidence about children, '
  + 'and section 6 is why this product cannot yet produce that evidence at class scale.**');
p();

// --- 7.3 what a `core` claim proves, and what it only tags ------------------
p('### 7.3 What the mastery gate proves, and one leg of it that is weaker than it reads');
p();
p('Every `core` claim in this document means the same thing: the mastery gate demanded three unassisted '
  + 'items at difficulty band 4 or above, with all support switched off. Three further conditions sit on '
  + 'top of that, and a reader should know how each one is decided, because they are not decided the '
  + 'same way.');
p();
p('| The condition | How it is decided | What that is worth |');
p('|---|---|---|');
p('| **Three unassisted items at band 4+** | counted, item by item, against the measured difficulty of '
  + 'the bank | a measurement |');
p('| **A form or a situation this learner has never practised** | the engine tracks which forms and '
  + 'which situations this learner has actually met | a measurement |');
p('| **Spanned two representations** | the run\'s items carried two different `rep` TAGS | **a tag, not '
  + 'a measurement** — see below |');
p('| **Included a modelling item** | one of the run\'s items carried the `rep` tag `context` or `verbal` '
  + '| **a tag, not a measurement** — see below |');
p();
p('**The last two legs are declared by the item form, not measured from what the learner did.** A '
  + '`rep` tag is written on the generator, and two forms of one skill can carry two different tags '
  + 'while asking for the same act. On this route that is not hypothetical: '
  + '`rule-from-table` has four forms tagged `table`, `table`, `context` and `verbal`, and every one of '
  + 'them asks the learner to fill one missing cell of a linear table. A proving run over three of them '
  + 'satisfies both legs, and the learner has done one act three times. `write-linear`\'s `context` form '
  + 'prints a sentence with no numbers in it beside the same two coordinate pairs its `symbolic` form '
  + 'uses, so the modelling leg there is a sentence, not a translation.');
p();
p('**What that does and does not undermine.** It does not touch the item count, the difficulty band, '
  + 'the unassisted requirement or the novelty requirement — those four are measured, and they are the '
  + 'load-bearing ones. It means the two transfer legs are currently a claim about the BANK\'s labelling '
  + 'rather than about the learner. The printed teacher record says so on the paper, in all three '
  + 'languages, rather than reporting "spanned two representations" as a demonstrated fact '
  + '(`src/report/teacher.js`). The fix on the engine side is a measure of whether two forms are the '
  + 'same act — the same answer type over the same drawn quantity — rather than whether they carry two '
  + 'labels, and it belongs in `src/learn/mastery.js`; it is not made here, and this paragraph is here '
  + 'so that nobody has to find it by reading the generators.');
p();

// --- 7.4 what has NOT been run on this tree ---------------------------------
p('### 7.4 What has not been measured on this tree');
p();
p('A section headed *what has actually been measured* is only honest if it also says what has not. '
  + 'Some of this product\'s gates cost minutes of real play each and are run per wave rather than per '
  + 'commit; `npm run wave` records every one of them in `progress/gate-runs.json` with its exit code '
  + 'and a content fingerprint of the tree it was measured on. The table below is that ledger, read at '
  + 'the moment this document was generated. It is not a summary of it and it is not typed.');
p();
{
  const wave = await perWaveStatus(pkgScripts);
  /* A sub-second gate must not print "0 s", which reads as "did not run". */
  const secsText = (n) => (n >= 1 ? `${n.toFixed(0)} s` : 'under a second');
  const WORD = {
    red: '**RED — it refused something**',
    never: '**NEVER RUN** — no evidence either way',
    stale: 'passed, on a tree that is not this one',
    fresh: 'passed, on this tree',
  };
  const routeWave = wave.filter((w) => w.scope === 'route');
  const red = routeWave.filter((w) => w.state === 'red');
  const never = routeWave.filter((w) => w.state === 'never');
  p(`**${red.length} of the gates a learner meets on the shipped route are recorded RED on this exact `
    + `tree, and ${never.length} more have never been run on it at all.**`);
  p();
  p('| Gate | What its red would mean | State on this tree | Last run |');
  p('|---|---|---|---|');
  /* Route first, then the worst state first. A keyed sort, not a pairwise
     comparator: the three scopes are not a total order under `a.scope ===
     b.scope ? … : …`, and a comparator that is not transitive sorts
     differently on different engines — which, in a document this build
     byte-compares, is a gate going red for a reason that is not the product. */
  const SCOPE_RANK = { route: 0, sweep: 1, engine: 2 };
  const STATE_RANK = { red: 0, never: 1, stale: 2, fresh: 3 };
  const key = (w) => [SCOPE_RANK[w.scope] ?? 9, STATE_RANK[w.state] ?? 9, w.gate];
  for (const w of [...wave].sort((a, b) => {
    const [as, ast, ag] = key(a);
    const [bs, bst, bg] = key(b);
    return as - bs || ast - bst || (ag < bg ? -1 : ag > bg ? 1 : 0);
  })) {
    p(`| \`${w.gate}\` | ${w.scope === 'route' ? '**a defect a class meets today**'
      : w.scope === 'sweep' ? 'a defect in any unit, route or preview' : 'not unit-scoped'} `
      /* AN ABSOLUTE DATE, NEVER "3 h ago". This document is byte-compared by
         `npm run check:standards`, so a relative time would make it drift on
         its own every hour and hold the gate red for a reason that is not the
         product. The ledger's own timestamp, to the day. */
      + `| ${WORD[w.state] || w.state} | ${w.at ? `${w.at.slice(0, 10)}${w.secs ? `, ${secsText(w.secs)}` : ''}` : '—'} |`);
  }
  p();
  if (never.length) {
    p(`**${never.length} route-scope gates have never been run on this tree.** They are `
      + `${never.map((w) => `\`${w.gate}\``).join(', ')}. Nothing anywhere says whether this tree `
      + 'passes them; the ledger simply has no row.');
    p();
  }
  /* THE SURFACE THIS PRODUCT IS AIMED AT, GATE BY GATE, WITH ITS REAL STATE.
     BRIEF.md's definition of done says "it works on a school Chromebook and on
     a phone". Three gates measure exactly that, and naming them with whatever
     the ledger actually says is the only version of this paragraph that cannot
     go stale. */
  {
    const SURFACE = [
      ['check:touch', 'every on-screen control tapped for real, in three locales and three orientations'],
      ['check:layout', 'the layout across eight viewports, three locales and the notch rotations'],
      ['check:density', 'the opening ninety seconds, on a phone held up, a phone on its side and a laptop'],
    ];
    const rows = SURFACE.map(([g, what]) => [wave.find((w) => w.gate === g), what, g]).filter((r) => r[0]);
    if (rows.length) {
      p('**And this is the surface the product is aimed at.** BRIEF.md\'s definition of done says it '
        + 'works on a school Chromebook and on a phone. Three gates measure that, and here is what the '
        + 'ledger says about each of them on this tree:');
      p();
      for (const [w, what, g] of rows) {
        p(`* \`${g}\` — ${what}. **${(WORD[w.state] || w.state).replace(/\*\*/g, '')}**.`);
      }
      p();
      p('Not one of those three is evidence that this tree works on the hardware it is for.');
      p();
    }
  }
  if (red.length) {
    p(`**And the ${red.length} recorded reds are on the route.** `
      + `${red.map((w) => `\`${w.gate}\``).join(', ')} each refused this tree, with a fingerprint that `
      + 'matches it. A recorded red on a route-scope gate fails `npm run check`; it is printed here '
      + 'because a district reading a standards document should not have to run the build to find out.');
    p();
  }
  p('`npm run wave` re-takes every row of this table. A row that reads *passed, on a tree that is not '
    + 'this one* is not a failure and is not evidence: the gate passed, and then somebody changed a '
    + 'byte of the product.');
}
p();

// --- 8. how to check --------------------------------------------------------
p('## 8. How to check any of this yourself');
p();
p('```bash');
p('node tools/build-standards.mjs --check      # this document has not drifted from the graphs');
p('node tools/build-mastery-runs.mjs --check   # section 7 was measured on THIS tree');
p('node tools/critic/reachable.mjs             # a player with no query string reaches the route in section 1.1');
p('node tools/validate-courses.mjs             # every unit generates, verifies and aligns in three languages');
p('node tools/validate-items.mjs               # Level 1 items re-derived by an independent solver');
p('node tools/check-record.mjs                 # the teacher record reports the truth, and prints whole, on every unit');
p('node tools/check-i18n.mjs                   # no untranslated prose of ours, in src/ or content/');
p('node tools/simulate-all.mjs                 # THE 80% PROMISE, on the composed shipped route');
p('node tools/simulate.mjs --unit <id>         # does the sequence get synthetic learners there');
p('node tools/check-docs.mjs                   # no hole on any page: no missing value, no empty citation');
p('node tools/check-named-cases.mjs            # no claim whose named cases its own items never produce');
p('```');
p();
p('`tools/validate-courses.mjs` fails the build if a node cites a standard with no quoted text, at a depth '
  + 'outside `core`/`supporting`/`introduced`, below `core` with no caveat naming the missing part, or — '
  + 'for TEKS — with no 19 TAC citation. `tools/check-record.mjs` fails if a unit prints another unit\'s '
  + 'standards, if any line of the printed record ships with an empty standards column, if a code reaches '
  + 'the screen at an unknown depth, if the record is headed with the wrong unit, or if any of it falls '
  + 'off the paper in any of the three languages. This document is generated from the same graphs those '
  + 'two read, so it cannot say something they do not.');
p();
p('And seven things `node tools/build-standards.mjs` refuses to write a document over, rather than '
  + 'writing one and hoping somebody notices:');
p();
p('* a unit whose name in a graph is not its name in the English bundle, or whose Spanish or Polish name '
  + 'is a different shape from the English one. The unit in section 2 was called "Lean, Rate and Pair" by '
  + 'its graph and by every document here, and "Structure and Rate" by the three language bundles a '
  + 'learner reads. Two critics marked it and it survived both, because no gate compared a graph with a '
  + 'bundle. One does now.');
p('* a mastery figure in section 7 measured against a different graph, item pack, engine or simulator '
  + 'than the tree now holds. Those figures went stale once, by thirteen points, on a unit that is on the '
  + 'shipped route, and this document asserted in the present tense that the unit failed its own gate.');
p('* a route figure that has quietly stopped being one. Every "on the route" column comes from the same '
  + 'reader as the on-disk column, filtered by unit; if that filter ever stops filtering, the two columns '
  + 'become one number under two headings and nothing in the output would look wrong. So no code may '
  + 'appear in a route-scoped count unless every unit named beside it is on the route.');
p('* an arithmetic claim in section 1.2 that does not close. The gap between the route figure and the '
  + 'on-disk figure is printed as a sum, and the sum is checked against the two counts it claims to '
  + 'explain.');
p('* a standard the inventory and the graph quote differently, or two units quoting one code two ways.');
p('* an expectation whose word-for-word text is in neither source. The inventory carries the wording of '
  + 'the expectations this course cites NOWHERE, and the graph carries the wording of every one it cites; '
  + 'section 5.1\'s second table lists exactly the cited ones and read the inventory, which has none for '
  + 'them. TWENTY-TWO CONSECUTIVE ROWS of it printed the word JavaScript prints for a value that is not '
  + 'there — in the column headed *The expectation, word for word*, three lines under the sentence '
  + 'promising that every expectation is quoted in full. Every gate was green, because they all read the '
  + 'sources and the sources were right. There is no fallback now: a field this document cannot fill '
  + 'stops the build.');
p('* a hole anywhere on the finished page. Three rules run over the rendered document before it is '
  + 'written, and again over the copy on disk by `npm run check:docs`. (1) No value may be a JavaScript '
  + 'accident — the four words that language prints for a missing value, or a template placeholder that '
  + 'never expanded. (2) No citation column may hold an empty cell: write an em dash and a reason, '
  + 'because a blank reads as "nothing needs citing here", which is a claim. (3) No coverage figure may '
  + 'appear without saying whether it is what a class receives or what is on disk. The one honest use of '
  + 'that first word in this document is inside 19 TAC §111.39(c)(2)(G), where it describes the slope of '
  + 'an upright line, and it is written down as a named exception with a reason rather than guessed at.');
p();

const want = out.join('\n');

/* ---------------------------------------------------------------------------
   REFUSE TO PUBLISH, RATHER THAN PUBLISH A HOLE.
   Three rules over the finished page: no value may be a javascript accident,
   no citation column may hold an empty cell, and no coverage figure may appear
   without saying whether it is what a class receives or what is on disk. It is
   applied to the page THIS RUN BUILT, on `--check` as well as on a write, so a
   generator that would produce a hole is refused before the byte-compare gets
   a chance to agree with it. The copy ON DISK is read by `npm run check:docs`,
   which applies the same three rules to every generated document under
   content/ — the two together mean neither the generator nor the file can
   carry a hole past a build.
   --------------------------------------------------------------------------- */
if (NO_WORDING.length) {
  console.error(`refusing to write content/STANDARDS.md — ${NO_WORDING.length} field${NO_WORDING.length === 1 ? '' : 's'} the sources cannot fill:`);
  for (const w of [...new Set(NO_WORDING)]) console.error('  ' + w);
  process.exit(1);
}
const holes = documentFaults(want, { name: 'content/STANDARDS.md', allow: HONEST_UNDEFINED['content/STANDARDS.md'] || [] });
if (holes.length) {
  console.error(`refusing to write content/STANDARDS.md — ${holes.length} finding${holes.length === 1 ? '' : 's'} in the finished page:`);
  for (const f of holes) console.error('  ' + f);
  console.error('\nThese are the rules in tools/doc-audit.mjs, and `npm run check:docs` applies the same three to every generated document.');
  process.exit(1);
}

/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs, on the --check arm.
   The standards a school is shown are the standards the shipped units declare,
   so a citation that does not match is a claim made about a learner's work. */
const F = CHECK ? findings('check:standards', { scope: 'sweep' }) : null;
if (CHECK) {
  let have = null;
  try { have = await readFile(OUT, 'utf8'); } catch { have = null; }
  if (have !== want) {
    console.error('content/STANDARDS.md is out of step with its sources — run node tools/build-standards.mjs');
    /* THE SOURCE THAT MOVES WITHOUT ANYBODY EDITING A GRAPH. Section 7.4 is
       read out of progress/gate-runs.json, so `npm run wave` moves this
       document. That is the point — the document reports what has and has not
       been run on this tree — but a reader of this message should not have to
       work out why a standards gate went red after a wave. */
    console.error('  (section 7.4 is read out of progress/gate-runs.json, so `npm run wave` moves this '
      + 'document too. Re-generating takes under a second.)');
    F.route('content/STANDARDS.md is out of step with the graphs it cites — run node tools/build-standards.mjs');
  } else {
    console.log(`content/STANDARDS.md is in step: ${units.length} units, ${cited.length}/${ALL_SE.length} `
      + `Algebra I expectations cited, ${atCore.length} at core.`);
  }
  F.done();
} else {
  await writeFile(OUT, want);
  console.log(`wrote content/STANDARDS.md — ${units.length} units, ${cited.length}/${ALL_SE.length} `
    + `Algebra I expectations (${pctOf(cited.length, ALL_SE.length)}), ${atCore.length} at core `
    + `(${pctOf(atCore.length, ALL_SE.length)}).`);
}
