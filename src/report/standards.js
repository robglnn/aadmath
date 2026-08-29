/**
 * Standards, as the unit a teacher actually thinks in.
 *
 * Everything else in this folder reports a *skill*: `distribute`, `two-step`,
 * `both-sides`. Those are our names for our own graph. No teacher has them, no
 * district asks for them, and no evidence binder accepts them. A teacher asks
 * "what do I have on A.10(D)?" and "has this child touched 8.EE.C.7.B yet?",
 * and until this module existed the only answer the product could give was a
 * chip in a tooltip on a row named after a verb.
 *
 * So this file turns the report the other way up. A row is an expectation. The
 * skills are what sits underneath it as evidence.
 *
 * THREE RULES, EACH ONE A BUG WE ALREADY PAID FOR
 *
 * 1. THE FRAMEWORK IS A CHOICE, NOT A COLUMN. Texas does not read Common Core
 *    codes and a Common Core district does not read TEKS. Printing both at once
 *    means neither reader can scan the page. One is chosen, the whole view
 *    re-expresses itself, and the choice is remembered.
 *
 * 2. DEPTH IS NEVER IMPLIED. A screen that prints `TEKS 7.7, A.12(B)` beside
 *    HELD 100%, with nothing to say that one is *supporting* and the other is a
 *    deliberately partial first encounter, is making a stronger claim than the
 *    working papers make. Depth travels with every code, in words, in both
 *    frameworks, and the same standard may sit at a different depth on
 *    different lines — `A.5(A)` is core on `multi-step` and supporting on
 *    `two-step`, and both are shown.
 *
 * 3. EVIDENCE COMES FROM THE LEARNER, NOT FROM THE MAP. The standards files
 *    name the item forms that carry each expectation. Which of those forms this
 *    learner has actually met, and how many of them they solved with no help at
 *    all, is read out of `formsSeen` in the learner model — the same counter the
 *    mastery gate reads. A coverage figure that could be computed without the
 *    learner is a claim about our content, not about a child.
 */
import { t, getLocale } from '../i18n/index.js';
import { alignmentOf, practicesOf } from '../content/standards.js';
import { shippedUnits, graphOf } from '../content/index.js';
import { FORMS_BY_SKILL } from '../learn/generators.js';
import ccssMap from '../../content/standards/ccss-algebra1-l1.json';
import teksMap from '../../content/standards/teks-algebra1-l1.json';
import processMap from '../../content/standards/practices-algebra1.json';

/** The two frameworks this level is aligned to, in the order they are offered. */
export const FRAMEWORKS = ['ccss', 'teks'];

/**
 * THE FOURTH RULE, AND THE ONE THAT COST THE MOST.
 *
 * 4. THE MAP IS THE UNIT THAT IS OPEN, NOT THE UNIT THAT SHIPPED FIRST.
 *
 * This module used to `import` two files — the Level 1 Common Core map and the
 * Level 1 TEKS map — and print them whatever the learner had open. Measured in
 * the real build: `?unit=algebra1-l2` and `?unit=algebra1-l3` both rendered the
 * SAME twenty-three Level 1 Common Core rows, every one reading "lines proved:
 * 0 of 0", while the learner was working fourteen or eleven lines carrying
 * thirty-odd expectations that appeared nowhere on the screen. The TEKS view
 * listed seventeen expectations of which five were Algebra I codes. A Texas
 * department head, opening the product on the quadratics unit, was shown a
 * coverage sheet for a unit their student was not in.
 *
 * That is worse than no coverage sheet. It is a vendor alignment sheet: a
 * document about the product's first release, printed under a learner's name.
 *
 * So there is no imported map any more. THE MAP IS BUILT FROM THE GRAPH THAT IS
 * RUNNING, node by node, through `alignmentOf()` — the same reader the content
 * gate uses — and the two hand-written Level 1 files are demoted to what they
 * always were underneath: a CATALOGUE. They supply the wording of a standard,
 * its legal citation, the caveat that says where our claim stops, and the item
 * forms that carry it. They cannot add a row the running graph does not cite,
 * and they cannot hide one it does.
 *
 * 5. EVIDENCE IS EITHER NAMED OR IT SAYS IT IS NOT.
 *
 * Level 1's catalogue names, per expectation, the exact item forms that carry
 * it — which is what makes `indirect` (line proved, and not one of those forms
 * ever met) a state this product can report. Levels 2 to 5 do not name them
 * yet. Inventing a list for them would be the vendor sheet again, so their
 * evidence is counted AT THE LINE — every question type the citing lines ask —
 * and every row says which of the two it is, in `basis`. A row counted at the
 * line cannot reach `indirect`, and the screen and content/STANDARDS.md both
 * declare that in writing. A gap stated is a gap a reader can price.
 */

const CATALOGUE = { ccss: ccssMap, teks: teksMap };
/** How a framework is spelt in the graph, against how this folder keys it. */
const GRAPH_FRAMEWORK = { ccss: 'CCSS-M', teks: 'TEKS' };
const KEY = 'ascent.framework';
/** Strongest first. A standard's headline depth is the strongest it reaches. */
const RANK = { core: 3, supporting: 2, introduced: 1 };

// i18n-allow: a Common Core code prefix is a standards identifier, not language
const CCSS_PREFIX = 'CCSS.MATH.CONTENT.';
export const shortCode = (code) => String(code).replace(CCSS_PREFIX, '');

// ---------------------------------------------------------------------------
// The choice
// ---------------------------------------------------------------------------

let current = read();
const listeners = new Set();

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return FRAMEWORKS.includes(v) ? v : FRAMEWORKS[0];
  } catch { return FRAMEWORKS[0]; }
}

/** Which framework this device reports in. Common Core unless told otherwise. */
export function getFramework() { return current; }

/**
 * Switch framework. Everything that draws a standard listens, so one call
 * re-expresses the report, the record, the print sheet and the exports.
 */
export function setFramework(f) {
  if (!FRAMEWORKS.includes(f) || f === current) return current;
  current = f;
  try { localStorage.setItem(KEY, f); } catch { /* private mode */ }
  for (const fn of listeners) fn(current);
  return current;
}

export function onFrameworkChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The control itself, built once and shared by every screen that offers the
 * choice. Two buttons, both always on screen, the live one pressed — a select
 * would hide the alternative behind a tap, and the whole point is that a
 * teacher can see that the other framework is there.
 */
export function createFrameSwitch() {
  const el = document.createElement('div');
  el.className = 'rp-frame';
  el.setAttribute('role', 'group');
  const lab = document.createElement('span');
  lab.className = 'rp-frame-lab';
  el.appendChild(lab);
  const buttons = FRAMEWORKS.map((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rp-frame-b';
    b.dataset.frame = f;
    b.addEventListener('click', () => setFramework(f));
    el.appendChild(b);
    return b;
  });

  function relabel() {
    lab.textContent = t('report.std.frame.pick');
    el.title = t('report.std.frame.pickHint');
    for (const b of buttons) {
      const f = b.dataset.frame;
      b.textContent = t('report.std.frame.' + f);
      b.title = t('report.std.frame.hint.' + f);
      const on = f === current;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  relabel();
  const off = onFrameworkChange(relabel);
  return { el, relabel, dispose: off };
}

// ---------------------------------------------------------------------------
// Reading the maps
// ---------------------------------------------------------------------------

/**
 * TWO KINDS OF SENTENCE LIVE IN THESE FILES, AND THEY GET OPPOSITE TREATMENT.
 *
 * A QUOTATION — `text`, `statement`, `citation` — is the wording of a US state
 * or national standard. TEKS and Common Core have no official Spanish or Polish
 * text, so translating one would be inventing a legal instrument that does not
 * exist. Those stay English, are marked `lang="en"`, and every screen that
 * prints one prints `report.std.cover.textNote` beside it saying so.
 *
 * OUR OWN PROSE — the caveat under "What we claim, and what we do not", how a
 * process standard is met, and where the alignment stops — is this project
 * explaining itself. Nothing licenses that being English on a Spanish screen,
 * and for a while it was: seventeen caveat paragraphs sat under a correctly
 * translated heading in ES and PL, because the strings lived in `content/` and
 * the i18n gate only ever looked at `src/`. `tools/check-i18n.mjs` now walks
 * `content/` too and fails on a missing or untranslated locale, and this
 * function is the only way any screen is allowed to read one.
 *
 * The English field stays the source of truth and the fallback, so a locale
 * added tomorrow degrades to English rather than to an empty paragraph.
 */
export function prose(entry, field) {
  const loc = getLocale();
  const tr = entry?.i18n?.[loc]?.[field];
  return (typeof tr === 'string' && tr.trim()) ? tr : (entry?.[field] || '');
}

// ---------------------------------------------------------------------------
// The map of whatever is open
// ---------------------------------------------------------------------------

/**
 * The graph the report is drawn from, and the maps built off it.
 *
 * One report screen runs on one graph for the life of the page, so the maps are
 * built once and cached against that object. `useGraph` is called by
 * `createReport` before anything renders; every reader below falls back to the
 * last graph it was given, so a screen can never draw one unit's rows while
 * another unit's lines sit underneath them.
 */
let GRAPH = null;
let BUILT = null;

/** Point this module at the running lattice. Idempotent per graph object. */
export function useGraph(graph) {
  if (!graph || graph === GRAPH) return;
  GRAPH = graph;
  BUILT = null;
}

function maps() {
  if (!BUILT) BUILT = buildMaps(GRAPH);
  return BUILT;
}

/** Every item form the bank can serve on one line, as a set of ids. */
function formIdsOf(nodeId) {
  return (FORMS_BY_SKILL[nodeId] || []).map((f) => f.id);
}

/**
 * Both framework maps, derived from one graph.
 *
 * The row is the expectation. Its wording, citation, strand and caveat come
 * from the catalogue when the catalogue knows the code, and from the graph's
 * own alignment entry when it does not — Levels 2 to 5 quote the standard in
 * the graph, with the caveat translated in place beside it.
 *
 * DEPTH IS THE GRAPH'S, PER LINE. The catalogue carries a `nodeDepth` override
 * because `A.5(A)` really is core on `multi-step` and supporting on `two-step`;
 * the graph now states the same thing on the row itself, for every unit, and
 * the two are checked against each other by tools/check-record.mjs. Where the
 * graph is silent the catalogue answers; where both are silent the row reports
 * an unknown depth rather than inventing `core`.
 */
function buildMaps(graph) {
  const out = {};
  for (const fw of FRAMEWORKS) {
    const want = GRAPH_FRAMEWORK[fw];
    const cat = new Map((CATALOGUE[fw]?.standards || []).map((s) => [s.code, s]));
    const rows = new Map();
    for (const n of graph?.nodes || []) {
      for (const a of alignmentOf(n)) {
        if (a.framework !== want) continue;
        let row = rows.get(a.code);
        if (!row) {
          const c = cat.get(a.code);
          row = {
            code: a.code,
            text: c?.text || a.text || '',
            citation: c?.citation || a.citation || null,
            course: c?.course || null,
            domain: c?.domain || null,
            // Ours, not theirs. The catalogue's caveat is the curated one; a
            // graph row carries its own, translated in place beside it.
            caveat: c?.caveat || a.caveat || null,
            i18n: c?.caveat ? c.i18n : a.i18n,
            nodes: [],
            nodeDepth: {},
            named: c?.evidence || null,
          };
          rows.set(a.code, row);
        }
        if (!row.nodes.includes(n.id)) row.nodes.push(n.id);
        const c = cat.get(a.code);
        row.nodeDepth[n.id] = a.depth || c?.nodeDepth?.[n.id] || c?.depth || null;
      }
    }
    for (const row of rows.values()) {
      // The forms the citing lines of THIS graph can actually serve. A named
      // list is intersected with them: the catalogue names Level 1's forms for
      // `A.5(A)`, and printing those against a Level 2 line would declare
      // question types this learner can never be asked.
      const live = new Set(row.nodes.flatMap(formIdsOf));
      const named = (row.named || []).filter((f) => live.has(f));
      row.evidence = named.length ? named : [...live];
      row.basis = named.length ? 'named' : 'line';
      delete row.named;
      row.depth = [...new Set(Object.values(row.nodeDepth))]
        .reduce((best, d) => ((RANK[d] || 0) > (RANK[best] || 0) ? d : best), null);
    }
    out[fw] = [...rows.values()];
  }
  return out;
}

/** Every expectation in one framework, in the order the graph declares them. */
export function standardsOf(framework) {
  return maps()[framework] || [];
}

/**
 * The process standards (TEKS) or practice standards (CCSS) the running graph
 * claims, with the wording and the sentence beside it from the course
 * catalogue. Which lines claim a code is read off the graph, never off a file:
 * a fixed list is a claim about the product, and this one has to be a claim
 * about the units that are open.
 */
export function processOf(framework) {
  const want = GRAPH_FRAMEWORK[framework];
  const cat = new Map((processMap[framework] || []).map((p) => [p.code, p]));
  const rows = new Map();
  for (const n of GRAPH?.nodes || []) {
    for (const code of practicesOf(n)[want] || []) {
      let row = rows.get(code);
      if (!row) {
        const c = cat.get(code);
        row = {
          code,
          citation: c?.citation || null,
          text: c?.text || '',
          met: c?.met || null,
          how: c?.how || '',
          i18n: c?.i18n || null,
          nodes: [],
        };
        rows.set(code, row);
      }
      if (!row.nodes.includes(n.id)) row.nodes.push(n.id);
    }
  }
  return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

/**
 * The places the alignment could not be made cleanly, in our own words and in
 * the reader's own language. Two kinds sit here, because the working papers
 * record two kinds:
 *
 *   · a line with nothing at `core` in this framework — the catalogue's `gaps`;
 *   · an expectation a reader would expect to find and will not — a unit's
 *     `verification.declaredGaps`, which name the code and say why not.
 *
 * Both are only shown for units that are actually open. A gap declared about a
 * unit the learner is not in is the same lie as a coverage row about one.
 */
export function gapsOf(framework) {
  const out = [];
  const units = new Set(unitIdsOf(GRAPH));
  if (framework === 'teks' && units.has('algebra1-l1')) {
    for (const g of CATALOGUE.teks?.gaps || []) {
      out.push({
        node: g.node,
        finding: prose(g, 'finding'),
        why: prose(g, 'why'),
        resolution: prose(g, 'resolution'),
      });
    }
  }
  // A declared gap belongs to the framework whose code it names, and both
  // frameworks declare them. Filing every one of them under TEKS left the
  // Common Core reader with an empty "where this alignment stops" section on a
  // unit that declares six Common Core gaps in writing.
  for (const { unit } of shippedUnits()) {
    if (!units.has(unit.id)) continue;
    let g;
    try { g = graphOf(unit); } catch { continue; }
    for (const d of g?.verification?.declaredGaps || []) {
      const fw = String(d.code || '').startsWith(CCSS_PREFIX) ? 'ccss' : 'teks';
      if (fw !== framework) continue;
      out.push({
        node: null,
        finding: [shortCode(d.code), d.citation].filter(Boolean).join(' · '),
        why: prose(d, 'why'),
        resolution: null,
      });
    }
  }
  return out;
}

/**
 * Which units the running graph is made of.
 *
 * A composed course says so on itself, a single unit names its own id, and
 * Algebra I Level 1 — written before either field existed — is found by
 * matching its graph id against the manifest. Nothing here hardcodes a course.
 */
export function unitIdsOf(graph) {
  if (!graph) return [];
  // `compose()` stamps `g.unit || g.id`, and Algebra I Level 1 — written before
  // the `unit` field existed — has only an id. So every entry is resolved back
  // to a manifest unit rather than trusted as one, or the composed course drops
  // Level 1 out of its own title and out of its own declared gaps.
  const ids = Array.isArray(graph.composedFrom) && graph.composedFrom.length
    ? graph.composedFrom
    : [graph.unit || graph.id];
  const out = [];
  for (const id of ids) {
    const hit = shippedUnits().find(({ unit }) => {
      if (unit.id === id) return true;
      try { return graphOf(unit)?.id === id; } catch { return false; }
    });
    if (hit && !out.includes(hit.unit.id)) out.push(hit.unit.id);
  }
  return out;
}

/**
 * The course and unit this record is about, in the reader's language.
 *
 * THE RECORD USED TO NAME LEVEL 1 ON EVERY UNIT. The sheet head printed one
 * fixed bundle key — "Algebra I · Level 1 · The Cipher Worlds" — over Level 4's
 * quadratics, which is a filed document with the wrong course written on it.
 * The name now comes from the manifest keys of the units that are open, so it
 * is right by construction and translated like everything else on the sheet.
 */
export function unitTitle(graph) {
  const ids = unitIdsOf(graph);
  const all = shippedUnits();
  const parts = [];
  const course = all.find(({ unit }) => ids.includes(unit.id))?.course;
  if (course?.titleKey) parts.push(t(course.titleKey));
  for (const id of ids) {
    const hit = all.find(({ unit }) => unit.id === id);
    if (hit?.unit?.titleKey) parts.push(t(hit.unit.titleKey));
  }
  return parts.join(' · ');
}

/**
 * The depth one expectation is claimed at on one line.
 *
 * TEKS records a per-line override in `nodeDepth` because the same expectation
 * is genuinely core on one line and supporting on another. Common Core does
 * not, so its per-line depth is the standard's own.
 */
/** The caveat on one expectation, in the reader's language. Ours, so translated. */
export function caveatFor(framework, code) {
  const s = standardsOf(framework).find((x) => x.code === code);
  return s ? (prose(s, 'caveat') || null) : null;
}

export function depthFor(framework, nodeId, code) {
  const s = standardsOf(framework).find((x) => x.code === code);
  if (!s) return null;
  return s.nodeDepth?.[nodeId] || s.depth || null;
}

/** Is this expectation's evidence named per expectation, or counted at the line? */
export function basisFor(framework, code) {
  return standardsOf(framework).find((x) => x.code === code)?.basis || null;
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

/**
 * What this learner has, expectation by expectation.
 *
 * `stateOf` is injected so this module never has to re-derive the report's own
 * vocabulary for a skill's standing, and so one screen can never disagree with
 * another about whether a line is held.
 */
export function buildCoverage({ graph, mastery, framework, stateOf }) {
  useGraph(graph);
  const titles = new Map(graph.nodes.map((n) => [n.id, n.id]));
  const rows = standardsOf(framework).map((s) => {
    const forms = s.evidence || [];
    const nodeIds = (s.nodes || []).filter((id) => titles.has(id));

    // --- evidence, read out of the learner model ---------------------------
    //
    // The forms are counted as a SET, not as a tally.
    //
    // Two lines can both carry one expectation and both be asked the same item
    // form, and this loop used to add one to `formsMet` for each pair — so a
    // learner who had met one of the two declared forms, on two lines, read
    // "Question types met: 2 of 1". The screen prints that as `{n} of {of}` and
    // the record files it as `formsMet/formsDeclared`, and a share above one is
    // not a share. `answers` and `unaided` are genuine tallies and stay tallies:
    // two lines' worth of questions really are two lines' worth of questions.
    const metForms = new Set();
    const solvedForms = new Set();
    let answers = 0, unaided = 0;
    for (const id of nodeIds) {
      const seen = mastery.get(id)?.formsSeen || {};
      for (const f of forms) {
        const row = seen[f];
        if (!row || !row.seen) continue;
        metForms.add(f);
        answers += row.seen;
        unaided += row.correct;
        if (row.correct > 0) solvedForms.add(f);
      }
    }
    const formsMet = metForms.size;
    const formsSolved = solvedForms.size;

    const lines = nodeIds.map((id) => {
      const st = stateOf(id);
      const m = mastery.get(id);
      return {
        id,
        depth: s.nodeDepth?.[id] || s.depth || null,
        state: st,
        held: st === 'mastered' || st === 'provisional',
        road: m?.mastered ? (m.provenBy?.road || null) : null,
        receipt: m?.mastered ? !!m.provenBy : true,
      };
    });

    const heldLines = lines.filter((l) => l.held);
    // WHY A PROVED LINE IS NOT A COVERED EXPECTATION.
    //
    // The first version of this read coverage off the line: `one-step-add` is
    // held, therefore everything `one-step-add` carries is held. The audit
    // caught it on the first run — `6.EE.B.5` came back HELD for a learner who
    // had never once been shown either of the two item forms that carry it.
    // They tested out of the line in three items and neither of those items was
    // about deciding whether a value satisfies an equation, which is what
    // 6.EE.B.5 actually asks for. Filing that as covered is exactly the vendor
    // alignment sheet this product exists to not be.
    //
    // So a standard is only `held` when the line is proved AND this learner has
    // met at least one of the item forms the map names for it. A proved line
    // with none of them met is its own state — reported, not rounded up.
    // `indirect` is only reachable where the evidence is NAMED. Where it is
    // counted at the line, any question answered on a citing line is evidence,
    // so a proved line with no answers behind it cannot occur — and the row
    // says `basis: 'line'` so a reader is not left to infer that.
    const cover = !answers
      ? (heldLines.length ? 'indirect' : 'none')
      : heldLines.length === lines.length ? 'held'
        : heldLines.length ? 'part' : 'working';
    const depth = lines.reduce(
      (best, l) => ((RANK[l.depth] || 0) > (RANK[best] || 0) ? l.depth : best),
      lines[0]?.depth || s.depth || null,
    );

    return {
      code: s.code,
      short: shortCode(s.code),
      text: s.text || '',
      citation: s.citation || null,
      course: s.course || null,
      domain: s.domain || null,
      // Our own prose about the edge of the claim, in the reader's language.
      caveat: prose(s, 'caveat') || null,
      depth,
      lines,
      heldLines: heldLines.length,
      totalLines: lines.length,
      formsDeclared: forms.length,
      formsMet,
      formsSolved,
      // Where the question types came from: `named` — the working papers name
      // the forms that carry this expectation — or `line`, every form the
      // citing lines ask. See rule 5 at the head of this file.
      basis: s.basis || 'line',
      answers,
      unaided,
      cover,
      // Every proved line behind this expectation was granted on the cold
      // sight-read: true, and the thinnest evidence this engine accepts.
      thin: heldLines.length > 0 && heldLines.every((l) => l.road === 'sight'),
      // A proved line whose receipt an older build never wrote.
      unevidenced: heldLines.some((l) => !l.receipt),
    };
  });

  const core = rows.filter((r) => r.depth === 'core');
  return {
    framework,
    rows,
    totals: {
      total: rows.length,
      held: rows.filter((r) => r.cover === 'held').length,
      part: rows.filter((r) => r.cover === 'part').length,
      indirect: rows.filter((r) => r.cover === 'indirect').length,
      working: rows.filter((r) => r.cover === 'working').length,
      none: rows.filter((r) => r.cover === 'none').length,
      // Evidence means this learner answered a question the map names for this
      // expectation. A proved line does not make the number bigger.
      evidenced: rows.filter((r) => r.answers > 0).length,
      coreTotal: core.length,
      coreHeld: core.filter((r) => r.cover === 'held').length,
      thin: rows.filter((r) => r.thin).length,
      // How many rows rest on named evidence rather than on line evidence.
      // Printed rather than averaged away: it is the honest size of the gap.
      named: rows.filter((r) => r.basis === 'named').length,
    },
  };
}

/** Process standards (TEKS) or practices (CCSS), with the same held counting. */
export function buildProcess({ graph, mastery, framework, stateOf }) {
  useGraph(graph);
  const known = new Set(graph.nodes.map((n) => n.id));
  return processOf(framework).map((p) => {
    const ids = (p.nodes || []).filter((id) => known.has(id));
    const held = ids.filter((id) => {
      const st = stateOf(id);
      return st === 'mastered' || st === 'provisional';
    }).length;
    return {
      code: p.code,
      short: shortCode(p.code),
      text: p.text || '',
      citation: p.citation || null,
      met: p.met || null,
      // Ours, so translated. `text` above is the standard, so it is not.
      how: prose(p, 'how'),
      held,
      total: ids.length,
    };
  });
}
