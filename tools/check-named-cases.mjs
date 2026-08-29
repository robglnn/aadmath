#!/usr/bin/env node
/**
 * A NODE MAY NOT CLAIM AN EXPECTATION WHOSE NAMED CASES ITS FORMS NEVER PRODUCE.
 *
 *   node tools/check-named-cases.mjs             # every node, every unit
 *   node tools/check-named-cases.mjs --self-test # plant the defect, and its honest twin
 *
 * WHY IT EXISTS. `content/graph/algebra1-l2.json` had `compound-inequality`
 * claiming TEKS A.5(B) at **core, with no caveat**:
 *
 *     solve linear inequalities in one variable, INCLUDING THOSE FOR WHICH THE
 *     APPLICATION OF THE DISTRIBUTIVE PROPERTY IS NECESSARY and FOR WHICH
 *     VARIABLES ARE INCLUDED ON BOTH SIDES
 *
 * Its four forms are all `p REL ax + b REL q`: one bracket-free middle, the
 * unknown on one side. Neither named case is ever produced. Its own sibling
 * `inequality-multi-step` said so in writing on the same graph — *"this is the
 * only node in this course where both cases the expectation names by name are
 * met"* — and the two claims sat a hundred lines apart in one file, contradicting
 * each other, through every gate in the build.
 *
 * `tools/validate-courses.mjs` cannot catch this class, and neither can any of
 * the others, because they all ask whether a claim is WELL FORMED: is there a
 * code, is there a text, is the text the one in the inventory, is there a
 * caveat below `core`. Every one of those was true. Nothing in the build ever
 * GENERATED THE ITEMS AND READ THEM against the words of the expectation.
 *
 * WHAT IT DOES. `content/standards/named-cases.json` lists, per expectation,
 * the cases the standard names BY NAME — and each case carries the standard's
 * own words for it, which this tool checks are really in the expectation, so a
 * case cannot be invented in the data file. For every node claiming one of
 * those codes it generates items across all five bands, applies each case's
 * detector to what a learner is SHOWN and to what a learner WRITES, and then:
 *
 *   · a `core` claim missing a named case is a FAULT unless the claim's caveat
 *     names that case;
 *   · a claim at any depth missing a named case must carry a caveat that names
 *     it, or says plainly that the cases the expectation names are absent;
 *   · a case's detector must fire somewhere in the course, or it is measuring
 *     nothing and is reported as a broken instrument rather than as coverage.
 *
 * SEVERITY FOLLOWS THE ROUTE, and this gate does not decide it. Every finding
 * goes on the collector in `tools/_findings.mjs`, which reads
 * `content/courses.json`: a finding on a unit in `route.units` is a defect a
 * class meets today and is FATAL; the same finding in a preview unit is printed
 * in full, marked PREVIEW-ONLY and advisory. Promoting a unit makes the
 * identical finding fatal on the next build with no edit here. A fault in the
 * rule's OWN data or detectors is `engine` — not unit-scoped, red everywhere —
 * because an instrument that has stopped measuring is not coverage.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '../src/learn/generators.js';
import { allUnits, loadUnit, routeUnits } from './_courses.mjs';
/* THE COLLECTOR OWNS THE EXIT CODE. This gate declares findings and does not
   decide what they are worth; severity follows content/courses.json through
   forUnit(). See tools/_findings.mjs. */
import { findings } from './_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = process.argv.includes('--self-test');
/** Seeds per band. A case that needs one form in five is still a case. */
const SEEDS = Number(process.argv.find((a) => /^--seeds=\d+$/.test(a))?.split('=')[1] || 80);

// ---------------------------------------------------------------------------
// THE DETECTORS.
//
// Each one reads the mathematics a learner is actually shown or writes, as a
// string, and answers one question with no judgement in it. They live in code
// and not in the data file because a regular expression in a content file is a
// content file nobody can review.
//
// `side` decides WHERE a case counts, and it is not a detail: A.2(B)'s verb is
// WRITE, so a form that prints `Ax + By = C` and asks for `y = mx + b` has not
// produced the standard-form case — the learner read it. A.5(B)'s verb is
// SOLVE, so its two cases are properties of the statement the learner is given.
// ---------------------------------------------------------------------------
const REL = /(?:\\le|\\ge|\\lt|\\gt|\\neq|<=|>=|=|<|>)/g;
const hasVar = (s, v) => new RegExp(`(?<![A-Za-z\\\\])${v}(?![A-Za-z])`).test(s);

export const DETECTORS = {
  /** A number stands immediately in front of a bracket, so the bracket must be opened. */
  distributive: (t) => /(?:^|[^A-Za-z0-9_}\\])-?\d+\s*\\left\(/.test(t) || /(?:^|[^A-Za-z0-9_}\\])-?\d+\s*\(/.test(t),
  /** The unknown stands on two sides of one relation. Three-part bands do not count. */
  bothSides: (t, v) => t.split(REL).filter((s) => hasVar(s, v)).length >= 2,
  /** `y = mx + b`. */
  slopeIntercept: (t) => /(?:^|\s)[a-z]\s*=\s*-?(?:\\frac\{-?\d+\}\{-?\d+\}|\d*)\s*[a-z](?:\s*[-+]\s*\d+)?\s*$/.test(t.trim()),
  /** `y - y1 = m(x - x1)`. */
  pointSlope: (t) => /[a-z]\s*[-+]\s*\d+\s*=\s*-?\d*\s*\\left\(\s*[a-z]\s*[-+]/.test(t),
  /** `Ax + By = C`. */
  standardForm: (t) => /^\s*-?\d*[a-z]\s*[-+]\s*\d*[a-z]\s*=\s*-?\d+\s*$/.test(t.trim()),
  /** A count that is a whole number, positive or negative. */
  integralExp: (t) => /\^\s*\{?\s*-?\d+\s*\}?/.test(t),
  /** A count that is a fraction, or the root that is one written another way. */
  rationalExp: (t) => /\^\s*\{?\s*-?\\frac|\^\s*\{?-?\d+\s*\/\s*\d+|\\sqrt/.test(t),
  /** A factorisation that closes as one bracket squared. */
  perfectSquare: (t) => /\\right\)\s*\^\s*\{?\s*2\s*\}?/.test(t) || /\)\s*\^\s*2/.test(t),
};

/**
 * The strings a case may be looked for in, by side.
 *
 * THE WORKED STEPS ARE NOT READ, and that is deliberate. Reading them once
 * certified `rational-exponent` as producing the integral-exponent case A.11(B)
 * names, on the strength of `4^{1} = 4` appearing in the last line of a worked
 * echo for a question about a square root. A case is produced when a learner is
 * SHOWN it or WRITES it, not when it drifts through a demonstration.
 */
function textsOf(item, side) {
  const stem = [item.check?.math, item.latex].filter(Boolean).map(String);
  const written = [item.answer].filter(Boolean).map(String);
  if (side === 'stem') return stem;
  if (side === 'answer') return written;
  return [...stem, ...written];
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------
const readJson = async (p) => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));

/**
 * Which named cases a node's forms really produce.
 * @returns {Set<string>} case ids
 */
export function produced(skill, cases, gen = generate) {
  const seen = new Set();
  for (let d = 1; d <= 5; d++) {
    for (let s = 0; s < SEEDS; s++) {
      let item;
      try { item = gen(skill, d, 90000 + s * 13 + d); } catch { continue; }
      const v = item.check?.variable || 'x';
      for (const c of cases) {
        if (seen.has(c.id)) continue;
        const det = DETECTORS[c.detector];
        if (!det) continue;
        if (textsOf(item, c.side).some((t) => det(t, v))) seen.add(c.id);
      }
      if (seen.size === cases.length) return seen;
    }
  }
  return seen;
}

/**
 * NAMING EVERY CASE AT ONCE, WHICH IS HONEST WRITING AND NOT A LOOPHOLE.
 *
 * "The two cases A.5(B) names by name are still absent. They are tested at
 * inequality-multi-step." tells a reader exactly what is missing, and listing
 * the two clauses again after that sentence would be worse prose, not better
 * disclosure. So a caveat satisfies a missing case either by naming it (`says`)
 * or by this idiom. It is one pattern for every expectation, in the tool,
 * because it is a fact about English and not about any one standard.
 */
export const COLLECTIVE = /(?:the |both )?(?:two |three |all )?cases[^.]{0,90}names(?: by name)?|cases (?:the expectation|A\.\d+\([A-Z]\)) names|neither (?:half|shape|case)[^.]{0,60}(?:expectation|names)/i;

export function caveatNames(caveat, c) {
  if (!caveat) return false;
  if (new RegExp(c.says, 'i').test(caveat)) return true;
  return COLLECTIVE.test(caveat);
}

/**
 * THE WHOLE DECISION, IN ONE FUNCTION, so the self-test can plant the composed
 * rule and not only its two halves. A named case is a finding when the forms
 * never produce it AND the claim does not say so.
 *
 * @param {{depth:string, caveat?:string}} claim  the alignment row on the node
 * @param {{id:string, text:string, says:string}[]} cases  the expectation's named cases
 * @param {Set<string>} have  the case ids the node's forms really produce
 * @returns {object[]} the cases that are missing and undisclosed
 */
export function undisclosed(claim, cases, have) {
  return cases.filter((c) => !have.has(c.id) && !caveatNames(claim.caveat, c));
}

export async function run() {
  const spec = await readJson('content/standards/named-cases.json');
  const { onRoute } = await routeUnits();
  const units = await allUnits();
  const F = findings('check:cases', { scope: 'sweep', onRoute });
  const detectorFired = new Set();
  let claims = 0;
  let checkedNodes = 0;

  // The data file may not invent a case: every case's words must be the standard's.
  for (const [code, e] of Object.entries(spec.expectations)) {
    for (const c of e.cases) {
      if (!e.text.toLowerCase().includes(c.text.toLowerCase())) {
        F.engine(`named-cases.json — ${code} declares a case "${c.id}" whose words "${c.text}" are not in `
          + 'the expectation\'s own words. A case this document invents is worse than no case at all.');
      }
      if (!DETECTORS[c.detector]) {
        F.engine(`named-cases.json — ${code} case "${c.id}" names a detector "${c.detector}" that does not exist.`);
      }
    }
  }

  for (const { unit } of units) {
    const graph = await loadUnit(unit);
    for (const node of graph.nodes) {
      for (const a of node.alignment || []) {
        const e = spec.expectations[a.code];
        if (!e) continue;
        claims++;
        // The graph's own copy of the expectation must be the one the cases were read off.
        if (a.text && a.text.trim() !== e.text.trim()) {
          F.engine(`${unit.id}/${node.id} — ${a.code}: the graph quotes this expectation differently from `
            + 'content/standards/named-cases.json, so the cases below were read off another sentence.');
          continue;
        }
        checkedNodes++;
        const have = produced(node.id, e.cases);
        for (const id of have) detectorFired.add(`${a.code}:${id}`);
        for (const c of undisclosed(a, e.cases, have)) {
          F.forUnit(unit.id, `${unit.id}/${node.id} claims ${a.code} at \`${a.depth}\``
            + `${a.caveat ? ' with a caveat that does not mention it' : ' with NO caveat'}, and not one of its `
            + `forms ever produces the case the expectation names by name: "${c.text}". `
            + `${a.depth === 'core' ? 'A `core` claim means the mastery gate tests the expectation, and this half of it is never asked. ' : ''}`
            + 'Either the forms must produce it, or the claim must say in writing that they do not.');
        }
      }
    }
  }

  // A detector that never fires anywhere is an instrument, not a finding.
  for (const [code, e] of Object.entries(spec.expectations)) {
    for (const c of e.cases) {
      if (!detectorFired.has(`${code}:${c.id}`)) {
        F.engine(`named-cases.json — the detector for ${code} case "${c.id}" did not fire on ANY node in the `
          + 'course. Either no node in five units produces it, or the detector is broken; both are worth '
          + 'knowing, and neither is coverage.');
      }
    }
  }

  console.log(`check:cases — ${checkedNodes} claims over ${Object.keys(spec.expectations).length} expectations `
    + `that name cases by name, ${claims} claims read, ${SEEDS} seeds per band. Every named case is either `
    + 'produced by the claiming node\'s own forms, or is named as absent in the claim\'s caveat.');
  F.done();
}

// ---------------------------------------------------------------------------
// THE SELF-TEST. Both directions, on the real bank.
// ---------------------------------------------------------------------------
async function selfTest() {
  const spec = await readJson('content/standards/named-cases.json');
  for (const { unit } of await allUnits()) await loadUnit(unit);
  const a5 = spec.expectations['A.5(B)'];
  const a2 = spec.expectations['A.2(B)'];
  const a11 = spec.expectations['A.11(B)'];
  const cases = [];
  const add = (name, got, want) => cases.push({ name, ok: got === want, got, want });

  // THE DEFECT, on the real generators: the node that shipped the false claim.
  const cd = produced('compound-inequality', a5.cases);
  add('compound-inequality produces NEITHER case A.5(B) names', a5.cases.every((c) => !cd.has(c.id)), true);
  // THE HONEST TWIN, in the same skill family, one prerequisite away.
  const im = produced('inequality-multi-step', a5.cases);
  add('inequality-multi-step produces BOTH — the rule stays quiet on it', a5.cases.every((c) => im.has(c.id)), true);
  const bb = produced('bracket-both-sides', a5.cases);
  add('bracket-both-sides produces both cases of A.5(A)\'s twin wording', a5.cases.every((c) => bb.has(c.id)), true);

  // SIDE MATTERS. A form that PRINTS `Ax + By = C` and asks for `y = mx + b`
  // has not written the standard form, and the graph says so in its caveat.
  const wl = produced('write-linear', a2.cases);
  add('write-linear does not WRITE the standard form, though it prints one', wl.has('standardForm'), false);
  add('write-linear does write y = mx + b', wl.has('slopeIntercept'), true);
  const ps = produced('point-slope-form', a2.cases);
  add('point-slope-form writes all three forms A.2(B) names', a2.cases.every((c) => ps.has(c.id)), true);

  // The exponent family, where the caveats carry the missing half.
  const xp = produced('exponent-product', a11.cases);
  add('exponent-product produces integral counts and not rational ones',
    xp.has('integralExp') && !xp.has('rationalExp'), true);

  // THE CAVEAT READER, which is what stops the rule being a rule against honesty.
  const dist = a5.cases.find((c) => c.id === 'distributive');
  add('a caveat naming the case by name satisfies it',
    caveatNames('The distributive case is never asked here.', dist), true);
  add('a caveat naming all the cases collectively satisfies it',
    caveatNames('The two cases A.5(B) names by name are still absent.', dist), true);
  add('a caveat about something else does NOT satisfy it',
    caveatNames('Only the last clause is claimed: representing values using inequalities.', dist), false);
  add('no caveat at all does not satisfy it', caveatNames(null, dist), false);

  // THE COMPOSED RULE, which is what run() actually applies.
  add('THE DEFECT AS IT SHIPPED: core, no caveat, neither case produced — two findings',
    undisclosed({ depth: 'core' }, a5.cases, cd).length, 2);
  add('the same node with the caveat it carries now — no finding',
    undisclosed({ depth: 'supporting', caveat: 'The two cases A.5(B) names by name are still absent.' },
      a5.cases, cd).length, 0);
  add('the node that really does produce both — no finding, and no caveat needed',
    undisclosed({ depth: 'core' }, a5.cases, im).length, 0);
  add('a caveat that discloses ONE of two missing cases still leaves the other',
    undisclosed({ depth: 'core', caveat: 'No statement here carries a bracket, so the distributive case is absent.' },
      a5.cases, cd).length, 1);

  // THE PLANT: a detector that is quietly broken must be caught, not believed.
  add('a detector that answers no to everything finds nothing',
    produced('inequality-multi-step', [{ id: 'x', detector: 'perfectSquare', side: 'either' }]).size, 0);

  let bad = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? ' ok  ' : 'FAIL '} ${c.name}`);
    if (!c.ok) { bad++; console.log(`        got ${JSON.stringify(c.got)}, wanted ${JSON.stringify(c.want)}`); }
  }
  if (bad) { console.error(`\nself-test FAILED — ${bad} of ${cases.length}.`); return 1; }
  console.log(`\nself-test OK — ${cases.length} cases on the real bank: the node that shipped the false claim `
    + 'produces neither of A.5(B)\'s named cases, its prerequisite produces both, and a caveat that names a '
    + 'missing case is accepted while a caveat about something else is not.');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  /* run() ends the process through the collector, which owns the exit code. */
  if (SELF) process.exit(await selfTest());
  else await run();
}
