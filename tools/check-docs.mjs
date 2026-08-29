#!/usr/bin/env node
/**
 * THE GATE OVER THE DOCUMENTS, NOT OVER THE SOURCES.
 *
 *   node tools/check-docs.mjs              # every generated document in content/
 *   node tools/check-docs.mjs --self-test  # plant each defect, and its honest twin
 *
 * WHY IT EXISTS. `content/STANDARDS.md` is the one file an adoption committee
 * reads, and it printed the literal word `undefined` in TWENTY-TWO CONSECUTIVE
 * ROWS, in the column headed *The expectation, word for word*, three lines
 * under a sentence promising that "every expectation is quoted in full so a
 * reader can price the gap rather than guess at it". Thirty-odd gates were
 * green while it did, and one of them — `check:standards` — regenerated that
 * exact file and byte-compared it and said it was in step.
 *
 * That is the whole lesson: every gate in this build reads the SOURCES. The
 * graphs were right, the inventory was right, the citations were right, the
 * KaTeX was strict and the sentences were short. The hole was made in the last
 * step, interpolating a field that lives in one source into a table fed by the
 * other, and a document is not its sources.
 *
 * So this gate reads the OUTPUT, as a district reads it, and asks the three
 * questions in tools/doc-audit.mjs:
 *
 *   1. no value on the page may be a javascript accident;
 *   2. no citation column may hold an empty cell;
 *   3. no coverage figure may appear without saying whether it is what a class
 *      receives or what is on disk.
 *
 * ACCOUNTING. Every markdown file under `content/` is either in `DOCS`, with
 * the command that regenerates it, or in `NOT_GENERATED`, with a reason. A new
 * document cannot join the tree unaudited: the gate refuses to start.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentFaults } from './doc-audit.mjs';
/* THE COLLECTOR OWNS THE EXIT CODE — tools/_findings.mjs. Every finding here
   is `engine`: a district-facing document with a hole in it is not scoped to a
   unit, so there is no preview version of it and no advisory reading. */
import { findings } from './_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Documents this build generates, and the one command that rewrites each. */
export const DOCS = {
  'content/STANDARDS.md': 'node tools/build-standards.mjs',
  'content/standards/algebra1-l1-standards-map.md': 'node tools/validate-items.mjs --write-map',
  'content/standards/algebra1-l1-crosswalk.md': 'node tools/validate-items.mjs --write-map',
  'content/standards/algebra1-l2-standards-map.md': 'node tools/build-l2-map.mjs --unit algebra1-l2',
  'content/standards/algebra1-l3-standards-map.md': 'node tools/build-l2-map.mjs --unit algebra1-l3',
  'content/standards/algebra1-l4-standards-map.md': 'node tools/build-l2-map.mjs --unit algebra1-l4',
  'content/standards/algebra1-l5-standards-map.md': 'node tools/build-l2-map.mjs --unit algebra1-l5',
};

/** Markdown under content/ that nothing generates, and why it is still read. */
export const NOT_GENERATED = {
  'content/COURSES.md': 'A hand-written note on how to add a course. It is not a district-facing '
    + 'document and no figure in it is computed — but it is audited anyway, by the same three rules, '
    + 'because a hole reads the same to a reader either way.',
};

/**
 * WHERE `undefined` IS AN HONEST ENGLISH WORD.
 *
 * 19 TAC §111.39(c)(2)(G) says "...and determine whether the slope of the line
 * is zero or undefined". This course quotes that expectation word for word and
 * writes a caveat about it, so the word appears on the page as mathematics and
 * not as a hole. A rule that fires on that sentence is a rule somebody switches
 * off, so the honest occurrences are WRITTEN DOWN rather than guessed at — and
 * an allowance that stops matching anything is itself a fault, so this list
 * cannot outlive the sentence it was written for.
 */
export const HONEST_UNDEFINED = {
  'content/STANDARDS.md': [{
    phrase: 'zero or undefined',
    why: '19 TAC §111.39(c)(2)(G) — the slope of a vertical line. The word is a mathematical '
      + 'predicate here, quoted from the expectation and repeated in its caveat.',
  }],
  'content/standards/algebra1-l5-standards-map.md': [{
    phrase: 'zero or undefined',
    why: 'The same expectation, quoted in the unit\'s own working paper.',
  }, {
    phrase: 'the words "zero" and "undefined" are not asked for',
    why: 'The alignment note on `parallel-perpendicular` in content/graph/algebra1-l5.json, saying which '
      + 'half of A.2(G) this unit does not test. The word is named as a word here, in quotation marks.',
  }],
};

/** Every markdown file under content/, repo-relative, sorted. */
async function everyDoc(dir = 'content') {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await everyDoc(rel));
    else if (e.name.endsWith('.md')) out.push(rel);
  }
  return out.sort();
}

export async function run() {
  const found = await everyDoc();
  const known = new Set([...Object.keys(DOCS), ...Object.keys(NOT_GENERATED)]);
  const F = findings('check:docs', { scope: 'sweep' });

  for (const f of found) {
    if (!known.has(f)) {
      F.engine(`${f} is a document under content/ that is in neither DOCS nor NOT_GENERATED. Name the `
        + 'command that writes it, or write down why nothing does. A document nobody has accounted for is '
        + 'a document nobody reads until a district does.');
    }
  }
  for (const f of known) {
    if (!found.includes(f)) F.engine(`${f} is accounted for in tools/check-docs.mjs and is not on disk any more.`);
  }
  for (const f of Object.keys(HONEST_UNDEFINED)) {
    if (!known.has(f)) {
      F.engine(`HONEST_UNDEFINED writes down an allowance for ${f}, which is not a document this gate reads. `
        + 'An allowance pointing at nothing is an allowance nobody will ever have to justify again.');
    }
  }

  let clean = 0;
  for (const f of found) {
    if (!known.has(f)) continue;
    const text = await readFile(path.join(ROOT, f), 'utf8');
    const faults = documentFaults(text, { name: f, allow: HONEST_UNDEFINED[f] || [] });
    if (!faults.length) { clean++; continue; }
    for (const x of faults) {
      F.engine(DOCS[f] ? `${x}  [${f} is written by \`${DOCS[f]}\` — fixing the page by hand does nothing; the generator is the defect]` : x);
    }
  }

  console.log(`check:docs — ${clean} of ${found.length} documents under content/ read as a district reads `
    + 'them: no value is a javascript accident, no citation column has an empty cell, every coverage figure '
    + `names its scope. ${Object.keys(DOCS).length} generated, ${Object.keys(NOT_GENERATED).length} `
    + 'hand-written and accounted for. The three rules are in tools/doc-audit.mjs, and none of them may be '
    + 'relaxed to go green.');
  F.done();
}

// ---------------------------------------------------------------------------
// THE SELF-TEST — a gate that has never refused anything is not a gate.
//
// Each rule is planted on the REAL document, and the same rule is then shown to
// stay quiet on the nearest honest content in the same file. The second half is
// the half that matters: a rule against the word `undefined` that also fires on
// "the slope is zero or undefined" is a rule that gets switched off within a
// week, and this build has a written history of exactly that.
// ---------------------------------------------------------------------------
async function selfTest() {
  const real = await readFile(path.join(ROOT, 'content/STANDARDS.md'), 'utf8');
  const allow = HONEST_UNDEFINED['content/STANDARDS.md'];
  const cases = [];
  const add = (name, text, want, opt = {}) => cases.push({ name, text, want, opt });

  // The honest controls, first.
  add('the shipped document passes', real, false, { allow });
  add('a quoted expectation may say a slope is "zero or undefined"',
    ['| Code | 19 TAC | The expectation, word for word |', '|---|---|---|',
      '| **A.2(G)** | `19 TAC §111.39(c)(2)(G)` | write an equation of a line that is parallel or '
      + 'perpendicular to the X or Y axis and determine whether the slope of the line is zero or undefined; |',
    ].join('\n'), false, { allow });
  add('a coverage figure WITH its scope is left alone',
    'A class that is handed this product covers **10 of the 49** Algebra I student expectations at `core`.', false);
  add('a coverage figure scoped by its column header is left alone',
    ['| | On the shipped route | Everything on disk |', '|---|---|---|',
      '| **TEKS Algebra I, at `core`** | **10 of 49** | 27 of 49 |'].join('\n'), false);
  add('an em dash where there is nothing to cite is left alone',
    ['| Unit | Code | 19 TAC | Why not |', '|---|---|---|---|',
      '| `l3` | `HSF.LE.A.2` | — | The exponential half is not taught here. |'].join('\n'), false);
  add('a fraction that is not a coverage figure is left alone',
    'Three of the run\'s items, 2 of 3 of them unassisted, were re-derived.', false);

  // THE DEFECT ITSELF: the twenty-two rows, exactly as they shipped.
  add('THE REGRESSION — the twenty-two rows print `undefined` where the expectation belongs',
    real.replace(/\| \*\*A\.2\(E\)\*\*[^\n]*\n/, '| **A.2(E)** | `19 TAC §111.39(c)(2)(E)` | core | l5 | undefined |\n'),
    'undefined', { allow });
  add('one `undefined` in a sentence, not in a table, is still caught',
    'The unit that carries each one is undefined, so a district can see what promoting a preview unit would buy.',
    'undefined');
  add('`NaN` where a percentage belongs', '| **Total** | **49** | NaN% |', 'NaN');
  add('`[object Object]` where a row belongs', '| `l1` | [object Object] | 24 |', '[object Object]');
  add('an unexpanded template placeholder', 'A class receives ${citedR.length} of 49 expectations.', 'placeholder');
  add('an EMPTY CELL where a citation belongs',
    ['| Unit | Code | 19 TAC | Why not |', '|---|---|---|---|',
      '| `l3` | `A.12(A)` |  | Nothing in the checker reads a set of pairs. |'].join('\n'), 'EMPTY CELL');
  add('an empty cell anywhere else in a table',
    ['| Unit | Skills | True mastery |', '|---|---|---|', '| `l2` | 14 |  |'].join('\n'), 'empty cell');
  add('a coverage figure with NO scope beside it',
    'This product covers 27 of 49 Algebra I student expectations.', 'no scope');
  add('THE HEADLINE DEFECT — an on-disk figure printed as if it were the course',
    ['| | |', '|---|---|', '| **TEKS Algebra I, at `core`** | 27 of 49 student expectations |'].join('\n'), 'no scope');
  add('an allowance that has stopped matching anything is itself a fault',
    'A document with no mathematical use of the word in it at all.', 'matches nothing', { allow });

  let bad = 0;
  for (const c of cases) {
    const faults = documentFaults(c.text, { name: 'planted', allow: c.opt.allow || [] });
    const hit = c.want === false ? faults.length === 0 : faults.some((f) => f.includes(c.want));
    console.log(`  ${hit ? ' ok  ' : 'FAIL '} ${c.name}`);
    if (!hit) {
      bad++;
      for (const f of faults.slice(0, 4)) console.log('        ' + f.slice(0, 200));
      if (!faults.length) console.log('        (the rule stayed quiet, and it should not have)');
    }
  }
  if (bad) {
    console.error(`\nself-test FAILED — ${bad} of ${cases.length} planted cases.`);
    return 1;
  }
  console.log(`\nself-test OK — ${cases.length} planted cases: six honest documents stay quiet, `
    + 'and every rule refuses the defect it exists for, including the twenty-two rows as they shipped.');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  /* run() ends the process through the collector, which owns the exit code. */
  if (process.argv.includes('--self-test')) process.exit(await selfTest());
  else await run();
}
