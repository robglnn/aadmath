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
import ccssMap from '../../content/standards/ccss-algebra1-l1.json';
import teksMap from '../../content/standards/teks-algebra1-l1.json';

/** The two frameworks this level is aligned to, in the order they are offered. */
export const FRAMEWORKS = ['ccss', 'teks'];

const MAPS = { ccss: ccssMap, teks: teksMap };
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

/** Every expectation in one framework, in curriculum order. */
export function standardsOf(framework) {
  return MAPS[framework]?.standards || [];
}

/** The process standards (TEKS) or practice standards (CCSS) of one framework. */
export function processOf(framework) {
  const m = MAPS[framework];
  return m?.processStandards || m?.practices || [];
}

/**
 * The places the alignment could not be made cleanly, in the map's own words —
 * and in the reader's own language. This is our prose, not a quotation.
 */
export function gapsOf(framework) {
  return (MAPS[framework]?.gaps || []).map((g) => ({
    node: g.node,
    finding: prose(g, 'finding'),
    why: prose(g, 'why'),
    resolution: prose(g, 'resolution'),
  }));
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
    },
  };
}

/** Process standards (TEKS) or practices (CCSS), with the same held counting. */
export function buildProcess({ graph, mastery, framework, stateOf }) {
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
