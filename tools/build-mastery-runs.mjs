#!/usr/bin/env node
/**
 * content/standards/mastery-runs.json — THE MEASURED MASTERY FIGURES, GENERATED.
 *
 *   node tools/build-mastery-runs.mjs              # re-run every unit, rewrite the file
 *   node tools/build-mastery-runs.mjs --unit <id>  # re-run one unit, keep the other rows
 *   node tools/build-mastery-runs.mjs --check      # no simulation: is every row still this tree's?
 *   node tools/build-mastery-runs.mjs --self-test  # plant staleness, prove --check refuses it
 *
 * WHY THIS FILE EXISTS.
 *
 * `content/standards/mastery-runs.json` feeds section 6 of `content/STANDARDS.md`
 * — the table an adoption committee reads to find out whether learners actually
 * get there. It was HAND-WRITTEN. Its own header said the figures came from
 * `node tools/simulate.mjs --unit <id> <learners> <budget>`, named a date, and
 * asked the reader to believe that somebody had re-run it.
 *
 * Nobody had. Measured on this tree, `algebra1-l2` — a unit ON THE SHIPPED
 * ROUTE — reads 91.5% true mastery, 65.0% in the lowest ability quintile and
 * 2.0% of learners holding any hollow claim. The file said 78.5% and 30.0%, and
 * the document built from it asserted in the present tense that Level 2 "fails
 * its own gate today". A district reading that would have been reading a
 * sentence about a unit that had not been that way for some time, about the
 * second of the two units its class actually receives.
 *
 * It also said `6 of 6` invariants for every unit. The simulation asserts SEVEN.
 *
 * So the figures are no longer typed. They are parsed out of the run.
 *
 * AND THEN THE PARSE READ THE WRONG COHORT.
 *
 * `tools/simulate.mjs` runs the same lattice, the same bank and the same item
 * budget in two SHAPES. One is a single unbroken sitting — its own header calls
 * that row *the cram*. The other is 22-minute sittings with a real night
 * between them, the record saved and reloaded at every boundary, which is the
 * delivery shape BRIEF.md mandates in as many words.
 *
 * This file read the first one. The predicate was
 *
 *     /^ {2}true mastery of [^\n:]+: ([\d.]+)% of learners$/m
 *
 * which is the RESULT block, and the RESULT block is the single sitting BY
 * CONSTRUCTION. So `content/STANDARDS.md` published **97.0%** as "the figure
 * that is about a class", with `Gate = passes at 80%`, while `npm run
 * check:mastery` on the same tree exited 1 and its own arms table read
 *
 *     ONE UNBROKEN SITTING (the cram)      97.0%
 *     ACROSS DAYS, every day               90.7%
 *     ACROSS DAYS, every third day          6.7%   bar 80%
 *
 * A district curriculum director ran that command and got a build refusing the
 * number the document asserts. A document that passes a gate the build refuses
 * is worse than no document.
 *
 * SO THE DOCUMENT AND THE GATE NOW READ ONE FUNCTION.
 *
 * `readArms()` and `verdictOf()` live in `tools/simulate-all.mjs` — the gate —
 * and are IMPORTED here rather than re-implemented. `readArms` cuts the output
 * into its sections first and reads each arm's figure only from inside that
 * arm's own block; a missing, doubled or ambiguous section is an error and
 * never a fall-back to the headline. `verdictOf` holds BOTH cadences of the
 * delivered arm to the 80% bar and takes the weaker one. There is no second
 * copy of that rule to drift, and a change to the gate's reader is a change to
 * this file's reader on the same commit.
 *
 * ALL THREE ARMS ARE PUBLISHED, WITH THEIR CADENCES NAMED. Hiding the cram
 * would be the same disease pointed the other way: the cram is the strongest
 * evidence this product has, because it DECAYS. Measured on the composed route,
 * 97.0% at the buzzer is 0.0% a week later, while the every-day arm's 90.7% is
 * still 89.0% a MONTH later. That is the product's whole thesis, measured, and
 * it can only be read when the two rows sit beside each other. So each row
 * carries `arms`, and each arm carries what it held a week and a month after
 * the last item.
 *
 * AND THE ROW THAT DOES NOT FLATTER US IS PUBLISHED AS IT STANDS. The
 * every-third-day cadence reads 6.7%. Its ABSOLUTE level rests on two constants
 * nobody in this repo has calibrated against a human — `GAP_POW` and `PERMA` in
 * `tools/simulate.mjs` — and the run's own nine-cell sweep of them is read here
 * and published beside the figure, because a reader has to see how far the
 * number moves before quoting it. A limitation stated in writing is a strength;
 * a limitation a reviewer discovers is why they stop reading.
 *
 * HOW STALENESS IS MADE IMPOSSIBLE TO MISS.
 *
 * A generated file still goes stale the moment the thing it measures changes —
 * that is the same defect one step further back. So every row carries a
 * `sources` fingerprint: a SHA-256 over the bytes of every file that decides
 * what that number IS.
 *
 *   content/graph/<unit>.json      the skills, the prerequisites, the ladder
 *   the unit's item bank           its own pack, or src/learn/generators.js for
 *                                  a unit with `pack: null`
 *   src/learn/mastery.js           the engine whose claims are being judged
 *   tools/simulate.mjs             the instrument that takes the reading
 *   tools/build-mastery-runs.mjs   the pipeline that decides WHICH ARM is read
 *   tools/simulate-all.mjs         the reader it reads it with
 *
 * The last two are in the list because of the defect above: the number was
 * right and it was about a cohort nobody is, and NOTHING IN THE FILE RECORDED
 * WHICH READER HAD PRODUCED IT. A figure taken by a pipeline that no longer
 * exists is stale in exactly the way a figure taken off a graph that no longer
 * exists is stale, and it is the shape that cost the most here. The file also
 * NAMES its generator in its own header, and `--check` refuses a row whose
 * header names a different one — see `GENERATOR` and `checkRuns`.
 *
 * `sourcesFor()` says what is in that list and what is deliberately left out.
 *
 * Each row is digested immediately before its own run and again immediately
 * after, so the fingerprint it carries is the one the reading actually used —
 * on a tree several people edit at once, digesting everything once at process
 * start records the name of a tree that stopped existing mid-measurement.
 *
 * `--check` re-computes those digests and fails if any row was measured against
 * different bytes. It runs no simulation and takes milliseconds, so it is inside
 * `npm run check:standards` — `tools/build-standards.mjs` calls `checkRuns()`
 * before it will write or verify a document. Change a graph and the build says
 * so, names the unit, and prints the one command that fixes it.
 *
 * A row may not be edited into freshness: the digest is over the tree, not over
 * the row, so the only way to make this file green is to take the reading again.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
/* THE GATE'S OWN READER, IMPORTED RATHER THAN RE-IMPLEMENTED. See the arm
   defect at the top of this file: the document and `npm run check:mastery`
   disagreed about the shipped route because each had its own predicate. There
   is one now. `tools/simulate-all.mjs` has a main guard, so importing it starts
   no simulation. */
import { readArms, verdictOf, sectionsOf, blocksOf, ARMS, BAR } from './simulate-all.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'content/standards/mastery-runs.json');

/**
 * THE PIPELINE THAT WROTE A ROW, NAMED IN THE FILE AND GATED ON.
 *
 * `mastery-runs.json` is generated, and its header has always said so in
 * English. English in a header is not a gate: the file went on being a true
 * reading of the tree while the CODE that read it was reading the wrong cohort,
 * and nothing in the file could have told anybody. So the generator is a
 * machine-readable block now — `checkRuns` refuses a file whose header names a
 * different tool, a different reader, or a digest that is not this tree's.
 */
export const GENERATOR = {
  tool: 'tools/build-mastery-runs.mjs',      // i18n-allow: a file path, not prose
  reader: 'tools/simulate-all.mjs',          // i18n-allow: a file path, not prose
  instrument: 'tools/simulate.mjs',          // i18n-allow: a file path, not prose
  command: 'node tools/build-mastery-runs.mjs',       // i18n-allow: a command line
  check: 'node tools/build-mastery-runs.mjs --check', // i18n-allow: a command line
};

/** The files the generator itself is made of — the digest its header carries. */
export const GENERATOR_FILES = [GENERATOR.tool, GENERATOR.reader];

/** Every unit is measured on its own at these parameters. */
export const LEARNERS = 200;
export const BUDGET = 900;

/**
 * THE ROUTE IS A ROW TOO, and it is the row that is about a class.
 *
 * A per-unit run prunes cross-unit prerequisites: it models a learner walking
 * into Level 2 with no Level 1 behind them, which `src/content/route.js` makes
 * impossible. The lattice a learner with no query string actually walks is the
 * units of `route.units` COMPOSED, and that is a different number — it is the
 * one `npm run check:mastery` can turn the build red on, and the one
 * `content/courses.json` publishes in its own header. So it is measured here
 * too, at the parameters the manifest names, and carries the same fingerprint
 * as every other row.
 */
export const ROUTE_ID = 'route';   // i18n-allow: a row key, not prose
export const ROUTE_LEARNERS = 300;
export const ROUTE_BUDGET = 3600;

/**
 * The files a unit's mastery figure is a reading OF. Order is part of the digest.
 *
 *   the graph                the skills, the prerequisites, the ladder
 *   the unit's item bank     its own pack, or `src/learn/generators.js` for a
 *                            unit with `pack: null`, whose bank IS that file
 *   src/learn/mastery.js     the engine whose claims are being judged
 *   tools/simulate.mjs       the instrument that takes the reading
 *
 * WHAT IS DELIBERATELY NOT IN HERE, and why. `src/learn/generators.js` is not
 * in the digest of a unit that carries its own pack. That file is the shared
 * dispatch and the core Level 1 bank, and it is edited constantly for reasons
 * that cannot move another unit's number — a Polish string, a new Level 1 form,
 * a comment. Digesting it everywhere would turn this gate red on work that
 * changed nothing it measures, and a gate that fires on honest content gets
 * switched off. The one thing in that file which COULD move a packed unit's
 * number is `demandOf()`, the difficulty measurement itself; that is covered
 * instead by `npm run check:mastery`, which re-runs the composed shipped route
 * on every build and exits 1 under 80%. The route row below carries the broad
 * digest anyway, because the route includes a unit with no pack.
 */
export function sourcesFor(unit) {
  const files = [`content/${unit.graph}`];
  files.push(unit.pack ? `src/content/packs/${unit.pack}.js` : 'src/learn/generators.js');
  /* THE WORDS THE BANK IS MADE OF, WHICH ARE NOT IN THE PACK.
     `generate()` composes every stem out of the English item bundle, and it
     THROWS when a key is not there. A reading taken while that file is
     mid-write is a reading against an item bank of nothing: measured on this
     tree, one such run printed a difficulty ladder of 0.00 in all fifty cells,
     flattened DEMAND to its floor for every band, and reported 100.0% true
     mastery — and `--check` called it fresh, because the bundle was in no row's
     fingerprint. Only the ENGLISH bundle is digested: `tools/simulate.mjs`
     imports that one and no other, and digesting the translations would turn
     this gate red on work that provably cannot move the number.
     `degenerateBank()` below is the second half of the same fix, and it is the
     half that does not depend on guessing which file moved. */
  files.push('content/lang/items.en.js');
  if (unit.pack) files.push(`content/lang/packs/${unit.pack}.en.js`);
  files.push('src/learn/mastery.js', GENERATOR.instrument);
  /* AND THE PIPELINE ITSELF. A number is a reading of the thing that read it as
     much as of the thing it read: this file published the cram as the class
     figure for as long as its own regex matched the RESULT block, and no
     fingerprint anywhere would have moved when that regex was fixed. */
  files.push(...GENERATOR_FILES);
  return files;
}

/**
 * What a file contributes to the digest — its MEANING, not its bytes.
 *
 * A byte digest turns this gate red on work that cannot move the number: a
 * doc-block rewritten, a graph reindented, a blank line. This tree is edited by
 * several people at once and its files carry more prose than most codebases
 * carry code, so a byte digest would have this gate refusing an honest tree
 * most of the day — and a gate that fires on honest content gets switched off.
 *
 * Two canonicalisations, both deliberately CONSERVATIVE, because the failure
 * that matters is missing a real change, not reporting an inert one:
 *
 *   JSON   parsed and re-stringified. Whitespace and indentation go; key order,
 *          every key and every value stay.
 *   code   whole-line comments and blank lines go. A line whose trimmed form
 *          starts with `//`, `/*`, `*` or `*​/` is documentation and nothing
 *          else. NOTHING on a line that carries code is touched — a trailing
 *          comment still counts, a string containing a slash is never parsed.
 *          It cannot delete executable text, so two trees that differ in what
 *          they DO cannot collapse to one digest.
 */
export function canonical(file, bytes) {
  const text = bytes.toString('utf8');
  if (file.endsWith('.json')) {
    try { return JSON.stringify(JSON.parse(text)); } catch { return text; }
  }
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t !== '' && !/^(?:\/\/|\/\*|\*)/.test(t);
    })
    .join('\n');
}

/** SHA-256 over what those files MEAN, truncated to 16 hex — enough to name a tree. */
export async function digestOf(files) {
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update('\0');
    h.update(canonical(f, await readFile(path.join(ROOT, f))));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// THE RULE — pure, so the self-test can plant staleness in it
// ---------------------------------------------------------------------------

/**
 * Is every published figure a reading of THIS tree?
 *
 * @param {{runs:{unit:string,sources:{digest:string,files:string[]}}[]}} file
 *        the parsed contents of content/standards/mastery-runs.json
 * @param {{id:string, digest:string, files:string[]}[]} tree
 *        one entry per unit the manifest declares, digested from disk now
 * @returns {string[]} one sentence per problem; empty means every row is fresh
 */
export function checkRuns(file, tree, generatorDigest = null) {
  const problems = [];
  /* THE HEADER NAMES THE GENERATOR, AND THE NAME IS CHECKED.
     A generated file whose header is prose is a file that can be produced by
     anything. This one says which tool wrote it and which reader took the
     figures off the run, and a row produced by a different pipeline — or by
     this pipeline before it was fixed — is refused rather than trusted. */
  const g = file.generator;
  if (!g || typeof g !== 'object') {
    problems.push('the file does not name the generator that wrote it, so nothing can tell which '
      + 'pipeline took these readings — run node tools/build-mastery-runs.mjs');
  } else if (g.tool !== GENERATOR.tool || g.reader !== GENERATOR.reader) {
    problems.push(`the file says it was written by ${g.tool || 'nothing'} reading with `
      + `${g.reader || 'nothing'}; this tree's generator is ${GENERATOR.tool} reading with `
      + `${GENERATOR.reader} — run node tools/build-mastery-runs.mjs`);
  } else if (generatorDigest && g.digest !== generatorDigest) {
    problems.push(`the figures were taken by a generator at ${g.digest || 'no digest'} and this tree's `
      + `is ${generatorDigest}. The pipeline that decides WHICH ARM is published has changed since `
      + 'these readings — run node tools/build-mastery-runs.mjs');
  }
  const rows = new Map((file.runs || []).map((r) => [r.unit, r]));
  for (const u of tree) {
    const r = rows.get(u.id);
    if (!r) {
      problems.push(`${u.id} has no measured mastery figure at all — run `
        + `node tools/build-mastery-runs.mjs --unit ${u.id}`);
      continue;
    }
    if (!r.sources || !r.sources.digest) {
      problems.push(`${u.id} publishes a figure with no fingerprint, so nothing can tell whether it `
        + `is a reading of this tree — run node tools/build-mastery-runs.mjs --unit ${u.id}`);
      continue;
    }
    const want = (u.files || []).join(' ');
    const have = (r.sources.files || []).join(' ');
    if (want !== have) {
      problems.push(`${u.id} was measured over a different set of files (${have || 'none named'}), `
        + `and this tree's are ${want} — run node tools/build-mastery-runs.mjs --unit ${u.id}`);
      continue;
    }
    if (r.sources.digest !== u.digest) {
      problems.push(`${u.id} publishes ${r.certified}% true mastery on the delivered arm, measured on `
        + `${r.ranOn} against sources ${r.sources.digest}; this tree is ${u.digest}. The figure is `
        + `STALE — run node tools/build-mastery-runs.mjs --unit ${u.id}`);
    }
  }
  for (const r of file.runs || []) {
    if (!tree.some((u) => u.id === r.unit)) {
      problems.push(`${r.unit} has a published figure and the manifest no longer declares it — `
        + 'a number about a unit that is gone. Run node tools/build-mastery-runs.mjs');
    }
  }
  return problems;
}

/**
 * Read the manifest and digest every unit it declares.
 * @returns {Promise<{id:string, graph:string, pack:string|null, digest:string, files:string[]}[]>}
 */
export async function treeNow() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'content/courses.json'), 'utf8'));
  const out = [];
  const byId = new Map();
  for (const c of manifest.courses) {
    for (const u of c.units) {
      const files = sourcesFor(u);
      byId.set(u.id, u);
      out.push({ id: u.id, graph: u.graph, pack: u.pack, files, digest: await digestOf(files) });
    }
  }
  // The composed route, last, so the per-unit rows read first.
  const ids = routeUnits(manifest);
  if (ids.length) {
    const files = [...new Set(ids.flatMap((id) => sourcesFor(byId.get(id))))];
    out.push({ id: ROUTE_ID, route: ids, files, digest: await digestOf(files) });
  }
  return out;
}

/** The units a learner with no query string walks. Read, never written here. */
export function routeUnits(manifest) {
  const course = manifest.courses.find((c) => c.id === (manifest.route?.course || manifest.default?.course));
  const named = manifest.route?.units;
  if (named && named.length) return named;
  return (course?.units || []).filter((u) => u.status === 'shipped').map((u) => u.id);
}

// ---------------------------------------------------------------------------
// READING THE RUN — parse the instrument's own output, do not restate it
// ---------------------------------------------------------------------------

/**
 * THE THREE CADENCES, DECLARED — the same lattice, the same bank, the same
 * budget, differing only in the shape the work arrives in.
 *
 * `arm` and `row` address `readArms()`'s readings, so the figure this file
 * publishes and the figure `npm run check:mastery` refuses on come off one
 * function. `block` addresses the cadence's own block inside the across-days
 * section, for the two figures the arm declaration does not carry (the lowest
 * quintile and this cadence's own hollow rate). `retention` addresses its row
 * of the retention table — what it still held a week and a month later, which
 * is the comparison the whole product rests on.
 */
export const CADENCES = [
  {
    id: 'oneSitting',
    arm: 'one-sitting',
    row: 'buzzer',
    delivered: false,
    label: 'ONE UNBROKEN SITTING (the cram)',
    doc: 'one unbroken sitting — everything learned in the last eight hours, no re-probe across a night',
    block: null,
    retention: /^one unbroken sitting\b/,
  },
  {
    id: 'everyDay',
    arm: 'across-days',
    row: 'daily',
    delivered: true,
    label: 'ACROSS DAYS, every day (24 h)',
    doc: '22-minute sittings, saved and reloaded, one night between them',
    block: /^every day \(/,
    retention: /^sittings a day apart\b/,
  },
  {
    id: 'everyThirdDay',
    arm: 'across-days',
    row: 'third-day',
    delivered: true,
    label: 'ACROSS DAYS, every third day (72 h)',
    doc: '22-minute sittings, saved and reloaded, three nights between them — an ordinary school pattern',
    block: /^every third day \(/,
    retention: /^sittings three days apart\b/,
  },
];

/** The one section every across-days figure is read from. Never prose-matched. */
const ACROSS_DAYS = /^coming back across days\b/;
const RETENTION = /^the retention test\b/;
const SWEEP = /^how much of that is the forgetting model\?/;
/** The two constants the every-third-day figure's absolute level rests on. */
export const SWEPT_CONSTANTS = ['GAP_POW', 'PERMA']; // i18n-allow: identifiers in tools/simulate.mjs

/**
 * Pull the published figures out of one `tools/simulate.mjs` run.
 *
 * FAILS CLOSED, EVERYWHERE. Every field is taken from the line the tool prints,
 * inside the block that owns that line, so a change to what the simulation
 * reports shows up here as a thrown error rather than as a number this file
 * made up out of the nearest sentence that looked right. A field that cannot be
 * found is an error, not a zero — and above all it is never the headline: the
 * headline is the cram, and reaching for it when the delivered arm cannot be
 * read is the defect this whole file is a correction of.
 *
 * @param {string} out   the whole stdout of one run
 * @param {string} unit  the unit id it was asked for
 * @param {number} exit  what tools/simulate.mjs itself returned
 */
export function parseRun(out, unit, exit = 0) {
  const grab = (re, what) => {
    const m = out.match(re);
    if (!m) throw new Error(`could not read ${what} out of the run for ${unit}`);
    return m;
  };
  const sections = sectionsOf(out);
  const only = (list, re, what) => {
    const hit = list.filter((s) => re.test(s.head));
    if (hit.length !== 1) {
      throw new Error(`${unit}: ${what} appears ${hit.length} times in this run, so no reading from `
        + 'it is unambiguous — the output shape this file reads has moved');
    }
    return hit[0];
  };
  const number = (lines, re, what) => {
    const hits = [];
    for (const raw of lines) { const m = re.exec(raw.trim()); if (m) hits.push(m); }
    if (hits.length !== 1) {
      throw new Error(`${unit}: ${what} matched ${hits.length} rows in its own block, and this file `
        + 'may not pick one of them');
    }
    return hits[0];
  };

  // --- WAS THERE A BANK? ----------------------------------------------------
  // Before any figure is taken off this run, the run has to have had something
  // to ask. See degenerateBank().
  const dead = degenerateBank(sections, only);
  if (dead.length) {
    throw new Error(`${unit}: the run measured a difficulty of 0.00 at every band of `
      + `${dead.length} skill(s) (${dead.slice(0, 4).join(', ')}${dead.length > 4 ? ', …' : ''}). `
      + 'Every generate() call for those skills threw, so this run asked a bank that was not there '
      + 'and every figure in it is about nothing. Nothing is published from it. This happens when a '
      + 'file the bank is built out of is mid-write; take the reading again on a quiet tree.');
  }

  // --- the parameters and the invariants, which belong to the whole run -----
  const skills = Number(grab(/^\d+ synthetic learners, budget \d+ items each, (\d+) skills/m,
    'the skill count')[1]);
  const learners = Number(grab(/^(\d+) synthetic learners, budget (\d+) items each/m, 'the parameters')[1]);
  const budget = Number(grab(/^\d+ synthetic learners, budget (\d+) items each/m, 'the parameters')[1]);
  const invBlock = grab(/the invariants — asserted[^\n]*\n([\s\S]*?)\n\ncalibration/, 'the invariant block')[1];
  const marks = [...invBlock.matchAll(/^ {2}(PASS|FAIL) {2}/gm)].map((m) => m[1]);
  if (!marks.length) throw new Error(`the run for ${unit} printed no invariants`);

  // --- THE ARMS, through the gate's own reader ------------------------------
  const read = readArms(out);
  const verdict = verdictOf({ code: exit }, read, true);

  // --- the cadence detail the arm declaration does not carry ----------------
  const acrossBlocks = blocksOf(only(sections, ACROSS_DAYS, 'the across-days section').body);
  const retentionRows = only(acrossBlocks, RETENTION, 'the retention test block').body;

  const arms = {};
  for (const c of CADENCES) {
    const trueMastery = read.readings[c.arm]?.[c.row];
    if (typeof trueMastery !== 'number') {
      throw new Error(`${unit}: the ${c.label} figure could not be read out of this run `
        + `(${read.problems.concat(read.notes)[0] || 'no reason given'}). Nothing is published from a `
        + 'run whose arms cannot be told apart, and this file never falls back to the headline.');
    }
    let lowestQuintile;
    let hollowLearners;
    if (c.block) {
      const b = only(acrossBlocks, c.block, `the "${c.label}" cadence block`);
      lowestQuintile = Number(number(b.body, /^lowest ability quintile\s+([\d.]+)%$/,
        'the lowest ability quintile')[1]);
      hollowLearners = Number(number(b.body,
        /^learners with any hollow claim\s+OLD\s+[\d.]+%\s+NEW\s+([\d.]+)%$/,
        'the strict hollow-claim rate')[1]);
    } else {
      // The single sitting is the run's own headline cohort, so its quintile and
      // its hollow rate are the top-level ones. Read from their own sections.
      lowestQuintile = Number(number(only(sections, /^by ability quintile\b/, 'the quintile table').body,
        /^Q1\s+theta[^%]*?([\d.]+)%$/, 'the lowest ability quintile')[1]);
      hollowLearners = Number(number(only(sections, /^calibration\b/, 'the calibration section').body,
        /^learners with any hollow claim, STRICT\s+([\d.]+)%/, 'the strict hollow-claim rate')[1]);
    }
    const ret = number(retentionRows,
      new RegExp(`${c.retention.source}\\s+[█·]+\\s+([\\d.]+)%\\s+->\\s+a week later ([\\d.]+)%\\s+`
        + 'a month later ([\\d.]+)%$'),
      `the retention row for "${c.label}"`);
    arms[c.id] = {
      /* NO LABEL IS STORED HERE. `content/` is default-deny for English prose —
         `tools/check-i18n.mjs` refused this file the first time a cadence name
         was written into it, and it was right: a learner-facing document is
         built from this data in three languages, so the WORDS belong to the
         builder and only the READINGS belong here. The cadence's identity is
         its key, and `CADENCES` above carries its name. */
      delivered: c.delivered,
      trueMastery,
      lowestQuintile,
      hollowLearners,
      weekLater: Number(ret[2]),
      monthLater: Number(ret[3]),
    };
    // The retention table re-prints the buzzer figure. If it disagrees with the
    // arm's own row, two blocks of one run are describing two different cohorts
    // and neither can be published.
    if (Math.abs(Number(ret[1]) - trueMastery) > 0.05) {
      throw new Error(`${unit}: the "${c.label}" arm reads ${trueMastery}% in its own block and `
        + `${ret[1]}% in the retention table. One run may not print two figures for one cohort.`);
    }
  }

  return {
    unit,
    learners,
    budget,
    skills,
    /* THE ARM THAT DECIDES, NAMED IN THE ROW. Never inferred by a reader of
       this file, and never the headline. */
    certifiedArm: ARMS.find((a) => a.certifies).id,
    certified: verdict.certified,
    bar: BAR,
    gate: verdict.ok ? 'pass' : 'fail',
    /* WHY IT FAILED, AS TOKENS RATHER THAN AS A SENTENCE. `verdictOf` returns
       English; storing that English in content/ is the defect check-i18n exists
       for, and re-rendering it from these tokens is how the reason reaches a
       reader in their own language. `exit` means simulate.mjs refused the run
       itself — a broken difficulty ladder or one of its seven invariants —
       which is a different failure from missing the bar and must not be printed
       as the same one. */
    gateFailed: [
      ...(exit === 0 ? [] : ['exit']),
      ...CADENCES.filter((c) => c.delivered && arms[c.id] && arms[c.id].trueMastery < BAR)
        .map((c) => c.id),
    ],
    /* What tools/simulate.mjs itself returned. Its own bar is the cram, so this
       is REPORTED beside the gate above and is never the gate. */
    exit,
    cramGate: exit === 0 ? 'pass' : 'fail',
    arms,
    sweep: readSweep(acrossBlocks, only, unit),
    invariantsPassed: marks.filter((m) => m === 'PASS').length,
    invariantsTotal: marks.length,
  };
}

/**
 * DID THIS RUN HAVE AN ITEM BANK AT ALL?
 *
 * `tools/simulate.mjs` opens by measuring the real bank: 400 generated items
 * per skill per band, averaged through `demandOf`, printed as a five-column
 * ladder. Every `generate()` call is inside a `try {} catch { skip }`, and a
 * cell with nothing in it is recorded as **0.00** rather than as an error. So a
 * run in which the bank could not be built at all does not crash. It prints a
 * ladder of zeros, flattens the response model to its floor for every band, and
 * reports a very high mastery figure — because every simulated item is as easy
 * as the model can make one.
 *
 * That happened here, on a tree several people edit at once: `algebra1-l1`
 * published 100.0% / 100.0% / 97.5% off a run whose fifty ladder cells were all
 * 0.00 and whose own words were `0.0% of 0 tagged slips`. The fingerprint said
 * the row was a reading of this tree, and it was — of a tree in which the bank
 * momentarily did not build.
 *
 * A digest can only cover the files somebody thought of. This rule covers the
 * outcome instead: if a skill measures 0.00 at all five bands, the run had no
 * items for it, and no figure taken from that run is about anything. It is
 * cheap, it needs no list of files, and it cannot be defeated by a dependency
 * nobody added to `sourcesFor()`.
 *
 * @returns {string[]} the skills whose whole ladder row is zero
 */
export function degenerateBank(sections, only) {
  const sec = only(sections, /^measured difficulty ladder\b/, 'the measured difficulty ladder');
  const dead = [];
  let rows = 0;
  for (const raw of sec.body) {
    const m = /^\s{2}(\S+)((?:\s+\d+\.\d\d){5})\s*$/.exec(raw);
    if (!m) continue;
    rows++;
    const cells = m[2].trim().split(/\s+/).map(Number);
    if (cells.every((c) => c === 0)) dead.push(m[1]);
  }
  if (!rows) {
    throw new Error('the run printed no difficulty ladder at all, so nothing can say whether it had '
      + 'a bank to ask — the output shape this file reads has moved');
  }
  return dead;
}

/**
 * THE SWEEP, because the every-third-day figure is not a constant of nature.
 *
 * `tools/simulate.mjs` prints a nine-cell table per cadence: the permastore
 * floor against the forgetting exponent, both of them CHOSEN rather than
 * measured, with the shipping figures in the middle cell. The spread of that
 * table is how far the published number moves if somebody ever calibrates the
 * two constants against a human, and a reader has to see it before quoting the
 * number. So the low and the high of each cadence's table are published beside
 * the figure they qualify.
 */
export function readSweep(acrossBlocks, only, unit) {
  const body = only(acrossBlocks, SWEEP, 'the forgetting-model sweep block').body;
  const out = {};
  let cadence = null;
  for (const raw of body) {
    const line = raw.trim();
    if (/^every day \(/.test(line)) { cadence = 'everyDay'; out[cadence] = { at: [], week: [] }; continue; }
    if (/^every third day \(/.test(line)) { cadence = 'everyThirdDay'; out[cadence] = { at: [], week: [] }; continue; }
    if (!cadence) continue;
    const cells = [...line.matchAll(/(\d+)% \/ (\d+)%/g)];
    for (const m of cells) { out[cadence].at.push(Number(m[1])); out[cadence].week.push(Number(m[2])); }
  }
  for (const c of ['everyDay', 'everyThirdDay']) {
    if (!out[c] || out[c].at.length !== 9) {
      throw new Error(`${unit}: the forgetting sweep for "${c}" printed `
        + `${out[c]?.at.length ?? 0} cells, not the 9 this file publishes the spread of`);
    }
    out[c] = {
      cells: out[c].at.length,
      low: Math.min(...out[c].at),
      high: Math.max(...out[c].at),
      weekLow: Math.min(...out[c].week),
      weekHigh: Math.max(...out[c].week),
    };
  }
  out.constants = SWEPT_CONSTANTS;
  return out;
}

/** Run the simulation for one row — a unit on its own, or the composed route. */
function simulate(u) {
  const unit = u.id;
  return new Promise((resolve, reject) => {
    const args = u.route
      ? [GENERATOR.instrument, String(ROUTE_LEARNERS), String(ROUTE_BUDGET), '--units', u.route.join(',')]
      : [GENERATOR.instrument, '--unit', unit, String(LEARNERS), String(BUDGET)];
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (b) => { out += b; });
    child.on('error', reject);
    child.on('exit', (code) => {
      // A non-zero exit is the gate the SIMULATION applies, and its own bar is
      // the cram. It is not a reason to refuse to publish the number —
      // publishing the unflattering number is the whole point of the table this
      // feeds — so the exit code is RECORDED, not swallowed, and the gate this
      // file publishes is `verdictOf`'s, on the delivered arm.
      try { resolve(parseRun(out, unit, code ?? 1)); } catch (e) { reject(e); }
    });
  });
}

// ---------------------------------------------------------------------------
// THE FILE
// ---------------------------------------------------------------------------

const HEADER = (tree) => [
  'MEASURED MASTERY, ONE ROW PER UNIT — the figures content/STANDARDS.md prints.',
  '',
  'GENERATED. Do not edit this file by hand.',
  '',
  '  node tools/build-mastery-runs.mjs              re-run every unit, rewrite this file',
  '  node tools/build-mastery-runs.mjs --unit <id>  re-run one unit, keep the other rows',
  '  node tools/build-mastery-runs.mjs --check      is every row still a reading of this tree?',
  '',
  'This file used to be hand-written, and it went stale in the one place it',
  'could do the most damage: algebra1-l2 is ON THE SHIPPED ROUTE, and the row',
  'for it published 78.5% true mastery and 30.0% in the lowest quintile long',
  'after the unit measured 91.5% and 65.0%. content/STANDARDS.md printed those',
  'numbers and told a reader, in the present tense, that Level 2 fails its own',
  'gate. It also said "6 of 6" invariants for every unit; the simulation',
  'asserts seven.',
  '',
  'AND THEN IT READ THE WRONG COHORT. simulate.mjs runs the same lattice, the',
  'same bank and the same budget in TWO SHAPES: one unbroken sitting (its own',
  'header calls that row the cram), and 22-minute sittings with a real night',
  'between them, saved and reloaded — which is the shape BRIEF.md mandates.',
  'This file matched the RESULT block, and the RESULT block is the single',
  'sitting by construction. So content/STANDARDS.md published 97.0% as "the',
  'figure that is about a class", with Gate = passes at 80%, while',
  '`npm run check:mastery` on the same tree exited 1 over the delivered arm.',
  'The figures below now come from readArms()/verdictOf() in',
  'tools/simulate-all.mjs — the gate\'s own reader, imported and not copied —',
  'so the document and the build cannot disagree about which cohort is which.',
  'ALL THREE cadences are published, because the comparison IS the evidence.',
  '',
  'Each row is one run of',
  '  node tools/simulate.mjs --unit <id> ' + LEARNERS + ' ' + BUDGET,
  'against the real mastery engine and the real item bank, parsed out of that',
  "run's own output rather than typed. A unit the manifest declares and this",
  'file does not carry is an error, not a blank.',
  '',
  'FIELDS',
  '  generator        the pipeline that LAST WROTE this file, by name, with a',
  '                   digest of its own bytes. `--check` refuses a file written',
  '                   by a different tool, a different reader, or an older',
  '                   version of this one. A generated file whose header is only',
  '                   prose can be produced by anything. What binds one ROW is',
  '                   its own sources.digest, and the generator\'s bytes are IN',
  '                   that digest — so a row carried over from an older pipeline',
  '                   by `--unit` is caught as stale even while this block reads',
  '                   current.',
  '  arms             one entry per CADENCE, each with the figure at the end of',
  '                   the run and what was still held a week and a month later:',
  '                     oneSitting     the cram. NOT the delivery shape.',
  '                     everyDay       22-minute sittings, one night between',
  '                     everyThirdDay  the same, three nights between',
  '  arms[].trueMastery   percentage of learners at hidden competence >= 0.85 on',
  '                   >= 90% of the skills, within the item budget',
  '  arms[].lowestQuintile  the same figure for the weakest fifth by ability',
  '  arms[].hollowLearners  percentage of learners holding ANY hollow claim at',
  '                   the end, on the strict definition — the honesty figure',
  '  certified        the figure the 80% promise is judged on: the WEAKER of the',
  '                   two delivered cadences. The friendlier one may not be',
  '                   quoted, and the cram is not a candidate at all.',
  '  gate             pass/fail on `certified` at `bar`, by verdictOf() — the',
  '                   same function `npm run check:mastery` fails the build on.',
  '  cramGate         what simulate.mjs itself returned. Its own bar is the',
  '                   cram, so this is reported and is never the gate.',
  '  gateFailed       why the gate failed, as TOKENS and never as a sentence:',
  '                   a cadence key means that cadence is under the bar, and',
  '                   `exit` means simulate.mjs refused the run itself (a broken',
  '                   difficulty ladder, or one of its seven invariants). Those',
  '                   are different failures. No English is stored in this file:',
  '                   content/ is default-deny for our own prose, and the',
  '                   document is built in three languages from these readings.',
  '  sweep            the run\'s own nine-cell sweep of GAP_POW and PERMA, per',
  '                   cadence: low and high true mastery across the grid. Those',
  '                   two constants are CHOSEN, not measured against a human,',
  '                   and the every-third-day figure\'s absolute level rests on',
  '                   them. Quote the figure with the spread beside it.',
  '  invariantsPassed the assertions the run makes on every item and every claim',
  '  sources.digest   SHA-256 (16 hex) over the bytes of the files below, in',
  '                   order. This is what makes staleness loud: `--check`',
  '                   re-computes it and refuses a figure measured against',
  '                   different bytes. tools/build-standards.mjs runs that check',
  '                   before it will write or verify content/STANDARDS.md, so',
  '                   `npm run check:standards` is red while a figure is stale.',
  '',
  'THE FILES A FIGURE IS A READING OF',
  ...tree.map((u) => `  ${u.id.padEnd(12)} ${u.files.join(', ')}`),
];

/**
 * HOW MANY READINGS DEEP THIS ROW IS, AND WHAT THEY SAID.
 *
 * A Monte-Carlo row is not a constant. The three-day cadence has been recorded
 * on this repo at 6.7%, at 6.3% and at 5.3% inside one week, over trees that
 * differed by prose and by a caveat — and a document that prints the newest of
 * those as though it were a measurement invites a reader to argue with the
 * third decimal of a number whose first digit is the finding. So each row keeps
 * the readings it replaced, with the date and the fingerprint of the tree each
 * was taken on, and section 7.1 of content/STANDARDS.md prints the band.
 *
 * It keeps six. A row nobody has re-taken has an empty history and the document
 * says so rather than inventing a spread from one point.
 */
export const HISTORY_MAX = 6;
export function historyAfter(prior) {
  if (!prior) return [];
  const one = { ranOn: prior.ranOn || null, digest: prior.sources?.digest || null };
  for (const c of CADENCES) {
    const v = prior.arms?.[c.id]?.trueMastery;
    if (typeof v === 'number') one[c.id] = v;
  }
  if (typeof prior.certified === 'number') one.certified = prior.certified;
  return [...(prior.history || []), one].slice(-HISTORY_MAX);
}

/** Serialise with one run per line — a diff of this file should be readable. */
function serialise(comment, generator, runs) {
  const rows = runs.map((r) => '    ' + JSON.stringify(r));
  return '{\n  "$comment": [\n'
    + comment.map((l) => '    ' + JSON.stringify(l)).join(',\n')
    + '\n  ],\n  "generator": ' + JSON.stringify(generator)
    + ',\n  "runs": [\n' + rows.join(',\n') + '\n  ]\n}\n';
}

const IS_MAIN = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

  // --- the self-test ------------------------------------------------------
  if (has('--self-test')) {
    const tree = [
      { id: 'algebra1-l1', files: ['a', 'b'], digest: 'aaaaaaaaaaaaaaaa' },
      { id: 'algebra1-l2', files: ['a', 'c'], digest: 'bbbbbbbbbbbbbbbb' },
    ];
    const GEN = 'dddddddddddddddd';
    const fresh = {
      generator: { ...GENERATOR, digest: GEN },
      runs: [
        { unit: 'algebra1-l1', certified: 100, sources: { digest: 'aaaaaaaaaaaaaaaa', files: ['a', 'b'] } },
        { unit: 'algebra1-l2', certified: 91.5, sources: { digest: 'bbbbbbbbbbbbbbbb', files: ['a', 'c'] } },
      ],
    };
    const clone = () => JSON.parse(JSON.stringify(fresh));
    const cases = [];
    const add = (name, file, wantHit) => cases.push({ name, file, wantHit });

    add('a file measured on this tree passes', clone(), null);
    {
      // THE DEFECT: the graph moved under a published figure.
      const f = clone();
      f.runs[1].sources.digest = 'cccccccccccccccc';
      add('a figure measured on a different tree is caught', f, /algebra1-l2 publishes 91\.5% true mastery.*STALE/s);
    }
    // --- THE GENERATOR IS NAMED IN THE HEADER, AND THE NAME IS CHECKED ------
    // The figures were right and the PIPELINE was reading the wrong cohort, and
    // nothing in the file recorded which pipeline had read it. These three are
    // that hole.
    {
      const f = clone();
      delete f.generator;
      add('a file that does not name the generator that wrote it is caught', f, /does not name the generator/);
    }
    {
      const f = clone();
      f.generator.reader = 'tools/somebody-elses-parser.mjs';
      add('a file whose figures were taken by a different reader is caught', f, /this tree's generator is/);
    }
    {
      const f = clone();
      f.generator.digest = 'eeeeeeeeeeeeeeee';
      add('a file written by an OLDER version of this generator is caught', f,
        /pipeline that decides WHICH ARM is published has changed/);
    }
    {
      // The hand-written shape: a number with nothing binding it to anything.
      const f = clone();
      delete f.runs[1].sources;
      add('a figure with no fingerprint at all is caught', f, /no fingerprint/);
    }
    {
      const f = clone();
      f.runs.splice(1, 1);
      add('a unit the manifest declares and this file skips is caught', f, /no measured mastery figure/);
    }
    {
      const f = clone();
      f.runs.push({ unit: 'algebra1-l9', certified: 12, sources: { digest: 'x', files: [] } });
      add('a figure about a unit the manifest dropped is caught', f, /algebra1-l9 has a published figure/);
    }
    {
      // The pack was added to the unit and the figure was taken before it.
      const f = clone();
      f.runs[1].sources.files = ['a'];
      add('a figure measured over a different set of files is caught', f, /a different set of files/);
    }
    {
      // THE OTHER HALF: honest content it must stay quiet on. A unit whose
      // figure is BELOW the 80% bar is not stale — it is a true reading of a
      // unit that is not there yet, and this rule may not fire on it.
      const f = clone();
      f.runs[1].certified = 56;
      f.runs[1].gate = 'fail';
      add('an honest figure that fails its own gate is not staleness', f, null);
    }

    /**
     * A CAPTURED RUN, IN simulate.mjs's REAL LINE SHAPES.
     *
     * The defaults are the figures measured on this tree by
     * `node tools/simulate.mjs 300 3600 --units algebra1-l1,algebra1-l2` — the
     * exact shape that shipped: a 97.0% headline over a 6.7% delivered arm.
     */
    const fixture = ({ cram = 97.0, daily = 90.7, third = 6.7,
      cramWeek = 0.0, dailyWeek = 90.7, thirdWeek = 6.3,
      cramMonth = 0.0, dailyMonth = 89.0, thirdMonth = 3.0, halfKnower = 99.0,
      ladder = [['var-meaning', [4.78, 5.40, 5.86, 7.55, 8.16]],
        ['two-step', [6.51, 6.97, 7.38, 7.83, 8.12]]] } = {}) => {
      const bar = (x) => '█'.repeat(Math.round(24 * x / 100)).padEnd(24, '·');
      const ret = (label, at, wk, mo) => [
        `    ${label.padEnd(30)} ${bar(at)} ${at.toFixed(1)}%  ->  a week later ${wk.toFixed(1)}%   `
          + `a month later ${mo.toFixed(1)}%`,
        `    ${' '.repeat(54)}          hollow at a week  OLD 3.7%  NEW 3.7% of learners`,
      ];
      const sweepRows = (cells) => cells.map(([perma, row]) => `        ${perma}          ${' '.repeat(19)}`
        + row.map((c) => c.padStart(14)).join(''));
      return [
        'ASCENT — mastery simulation',
        '300 synthetic learners, budget 3600 items each, 24 skills',
        '',
        'measured difficulty ladder (mean demandOf over the real bank, 400 items per cell)',
        '  skill            d1     d2     d3     d4     d5',
        ...ladder.map(([s, c]) => `  ${s.padEnd(14)} `
          + c.map((x) => x.toFixed(2).padStart(6)).join(' ')),
        '  every skill rises strictly d1 -> d5, so the bands mean something',
        '',
        'by ability quintile (theta)',
        '  Q1  theta -2.50 .. -0.92  ██████████████████████████···· 86.7%',
        '  Q2  theta -0.91 .. -0.20  ██████████████████████████████ 100.0%',
        '',
        'testing out — learners who already know this, on the real scheduler',
        '  a learner who knows only the first five skills — where does the time go?',
        `    true mastery of the level      ${halfKnower.toFixed(1)}%`,
        '',
        'coming back across days — the same learners, the same 3600-item budget, delivered in sittings',
        '  22-minute sittings. Between them a line decays towards 0.6 of its own high-water mark,',
        '',
        '  every day (24 h between sittings, 300 learners)',
        `    true mastery of the level          ${daily.toFixed(1)}%   (all 24 skills 89.7%)`,
        '    lowest ability quintile            63.3%',
        '    hollow claims, judged when made    OLD 7.87%   NEW 9.40%   (1580 / 1888 of 20083)',
        '    learners with any hollow claim     OLD 5.7%   NEW 5.7%',
        '',
        '  every third day (72 h between sittings, 300 learners)',
        `    true mastery of the level          ${third.toFixed(1)}%   (all 24 skills 0.7%)`,
        '    lowest ability quintile            0.0%',
        '    hollow claims, judged when made    OLD 13.12%   NEW 13.96%   (2717 / 2889 of 20701)',
        '    learners with any hollow claim     OLD 16.3%   NEW 16.3%',
        '',
        '  the retention test — the same learners asked again a week later, taught nothing in between',
        ...ret('one unbroken sitting', cram, cramWeek, cramMonth),
        ...ret('sittings a day apart', daily, dailyWeek, dailyMonth),
        ...ret('sittings three days apart', third, thirdWeek, thirdMonth),
        '',
        '  how much of that is the forgetting model? (both cadences, both constants swept)',
        '    every day (24 h)',
        '      permastore floor  forgetting exponent           0.25          0.35          0.45',
        ...sweepRows([['0.50', ['97% / 95%', '78% / 77%', '65% / 65%']],
          ['0.60', ['98% / 98%', '95% / 95%', '87% / 85%']],
          ['0.70', ['97% / 97%', '98% / 98%', '97% / 97%']]]),
        '    every third day (72 h)',
        '      permastore floor  forgetting exponent           0.25          0.35          0.45',
        ...sweepRows([['0.50', ['8% / 8%', '0% / 0%', '0% / 0%']],
          ['0.60', ['25% / 22%', '10% / 10%', '0% / 0%']],
          ['0.70', ['43% / 43%', '23% / 23%', '12% / 8%']]]),
        '',
        'the invariants — asserted on every item and every claim above, not sampled',
        '  PASS  a claim granted over a question type at 0 of 1            0   must be 0',
        '  FAIL  a claim granted over a question type SERVED and never solved      3   must be 0',
        '',
        'calibration — is the engine telling the truth?',
        '  learners with any hollow claim, STRICT   0.0%  (NEW: + a hole)',
        '',
        'RESULT',
        `  true mastery of units algebra1-l1 + algebra1-l2: ${cram.toFixed(1)}% of learners`,
        '',
        `  >>> ${cram.toFixed(1)}% of simulated learners reach true mastery <<<`,
      ].join('\n');
    };
    const RUN = fixture();
    let bad = 0;
    const say = (pass, name, extra = '') => {
      if (!pass) bad++;
      console.log(`  ${pass ? ' ok ' : 'FAIL'}  ${name}${extra}`);
    };
    for (const c of cases) {
      const hits = checkRuns(c.file, tree, GEN);
      const pass = c.wantHit ? hits.some((h) => c.wantHit.test(h)) : hits.length === 0;
      say(pass, c.name, hits.length ? ` — ${hits[0].slice(0, 90)}` : '');
    }

    // =====================================================================
    // THE ARM RULE — the defect this file shipped. A document may not publish
    // the cram as the figure that is about a class.
    // =====================================================================
    let armCases = 0;
    const arm = (pass, name, extra = '') => { armCases++; say(pass, name, extra); };
    try {
      const r = parseRun(RUN, 'route', 0);
      arm(r.certified === 6.7 && r.gate === 'fail',
        'THE DEFECT: a run whose headline is 97.0% and whose delivered arm is 6.7% certifies 6.7% and FAILS',
        ` — certified ${r.certified}%, gate ${r.gate}`);
      arm(r.arms.oneSitting.trueMastery === 97 && r.arms.everyDay.trueMastery === 90.7
        && r.arms.everyThirdDay.trueMastery === 6.7,
      'all three cadences are published, with their cadences named',
      ` — ${CADENCES.map((c) => `${c.id} ${r.arms[c.id].trueMastery}%`).join(', ')}`);
      arm(r.arms.oneSitting.weekLater === 0 && r.arms.everyDay.monthLater === 89,
        'the decay finding is read: the cram is 0.0% a week later, the daily arm 89.0% a MONTH later',
        ` — cram week ${r.arms.oneSitting.weekLater}%, daily month ${r.arms.everyDay.monthLater}%`);
      arm(r.arms.everyDay.lowestQuintile === 63.3 && r.arms.everyThirdDay.hollowLearners === 16.3,
        'each cadence carries its OWN quintile and hollow rate, not the headline cohort\'s');
      arm(r.sweep.everyThirdDay.low === 0 && r.sweep.everyThirdDay.high === 43,
        'the sweep of the two uncalibrated constants is published beside the figure it qualifies',
        ` — every third day moves ${r.sweep.everyThirdDay.low}%..${r.sweep.everyThirdDay.high}%`);
      arm(r.cramGate === 'pass' && r.gate === 'fail',
        'simulate.mjs\'s own exit code is RECORDED beside the gate and is never the gate',
        ` — cramGate ${r.cramGate}, gate ${r.gate}`);
      arm(r.invariantsPassed === 1 && r.invariantsTotal === 2 && r.skills === 24,
        'the run\'s own parameters are read, and a FAILED invariant is counted as failed');
    } catch (e) { arm(false, 'the reader takes every arm off the run', ` — ${e.message}`); }
    // The friendlier cadence may not be quoted over the weaker one.
    try {
      const r = parseRun(fixture({ daily: 91.4, third: 86.0 }), 'route', 0);
      arm(r.certified === 86.0 && r.gate === 'pass',
        'with both cadences over the bar the WEAKER one is what is certified',
        ` — certified ${r.certified}%`);
    } catch (e) { arm(false, 'with both cadences over the bar the weaker one is certified', ` — ${e.message}`); }
    // A run whose delivered arm is missing publishes NOTHING. It never falls
    // back to the headline — that fall-back is the whole defect.
    try {
      parseRun(RUN.replace(/^coming back across days.*$/m, 'coming back across days — REMOVED')
        .replace(/^ {4}true mastery of the level.*$/gm, ''), 'route', 0);
      arm(false, 'a run with no delivered arm is refused, and never falls back to the 97.0% headline');
    } catch (e) {
      arm(/could not be read|appears 0 times|matched 0 rows/.test(e.message),
        'a run with no delivered arm is refused, and never falls back to the 97.0% headline',
        ` — "${e.message.slice(0, 70)}…"`);
    }
    // The identical row in the testing-out block may not be mistaken for it.
    try {
      const r = parseRun(fixture({ daily: 91.4, third: 86.0, halfKnower: 91.4 }), 'route', 0);
      arm(r.arms.everyDay.trueMastery === 91.4 && r.certified === 86.0,
        'the identical "true mastery of the level" row in the testing-out block is not read as an arm');
    } catch (e) { arm(false, 'the testing-out row is not read as an arm', ` — ${e.message}`); }
    // Two runs concatenated: ambiguous, never averaged or first-matched.
    try {
      parseRun(`${RUN}\n${RUN}`, 'route', 0);
      arm(false, 'two copies of the arms in one capture are refused as ambiguous');
    } catch (e) {
      arm(/appears 2 times|matched 2 rows|could not be read/.test(e.message),
        'two copies of the arms in one capture are refused as ambiguous', ` — "${e.message.slice(0, 60)}…"`);
    }
    // A retention table that disagrees with the arm's own block: two cohorts.
    try {
      parseRun(fixture().replace('sittings a day apart', 'sittings a day apart')
        .replace(/(sittings a day apart\s+[█·]+ )90\.7%/, '$155.5%'), 'route', 0);
      arm(false, 'a retention row that disagrees with its own arm block is refused');
    } catch (e) {
      arm(/may not print two figures for one cohort/.test(e.message),
        'a retention row that disagrees with its own arm block is refused', ` — "${e.message.slice(0, 60)}…"`);
    }
    // A non-zero child exit is red whatever the arms say — its invariants broke.
    try {
      const r = parseRun(fixture({ daily: 91.4, third: 86.0 }), 'route', 1);
      arm(r.gate === 'fail' && r.cramGate === 'fail',
        'a child that exits 1 is a failed gate even with both cadences over the bar');
    } catch (e) { arm(false, 'a child that exits 1 is a failed gate', ` — ${e.message}`); }

    // =====================================================================
    // THE BANK THAT WAS NOT THERE — the shape that published 100.0% off a
    // difficulty ladder of fifty zeros. See degenerateBank().
    // =====================================================================
    {
      /* THE DEFECT, exactly as it was published: every ladder cell 0.00, a
         flattened response model, and a very high mastery figure. */
      const dead = fixture({
        cram: 100.0, daily: 100.0, third: 97.5, cramWeek: 0.0, dailyWeek: 100.0, thirdWeek: 97.5,
        cramMonth: 0.0, dailyMonth: 99.5, thirdMonth: 97.5,
        ladder: [['var-meaning', [0, 0, 0, 0, 0]], ['two-step', [0, 0, 0, 0, 0]]],
      });
      try {
        parseRun(dead, 'algebra1-l1', 1);
        arm(false, 'THE DEFECT: a 100% figure measured against a bank that did not build is refused');
      } catch (e) {
        arm(/difficulty of 0\.00 at every band/.test(e.message),
          'THE DEFECT: a 100% figure measured against a bank that did not build is refused',
          ` — "${e.message.slice(0, 64)}…"`);
      }
      // One dead skill among healthy ones is still a dead run.
      const partly = fixture({ ladder: [['var-meaning', [4.78, 5.4, 5.86, 7.55, 8.16]],
        ['two-step', [0, 0, 0, 0, 0]]] });
      try {
        parseRun(partly, 'route', 0);
        arm(false, 'ONE skill with no bank is enough to refuse the whole run');
      } catch (e) {
        arm(/two-step/.test(e.message), 'ONE skill with no bank is enough to refuse the whole run');
      }
      // AND THE OTHER HALF: an honest hard skill sits low, not at zero, and
      // this rule may never fire on it. A flat-but-nonzero ladder is a
      // check:courses finding, not a missing bank, and it is not this rule's.
      try {
        const r = parseRun(fixture({ ladder: [['fraction-solve', [4.72, 4.72, 4.72, 4.72, 4.72]],
          ['var-meaning', [0.01, 0.02, 0.03, 0.04, 0.05]]] }), 'route', 0);
        arm(r.certified === 6.7, 'a flat but non-zero ladder is NOT a missing bank — the rule stays quiet');
      } catch (e) {
        arm(false, 'a flat but non-zero ladder is NOT a missing bank', ` — ${e.message}`);
      }
      // And a run with no ladder printed at all is refused, not assumed fine.
      try {
        parseRun(fixture().replace(/^measured difficulty ladder.*$/m, 'the bank was not measured'),
          'route', 0);
        arm(false, 'a run that prints no ladder is refused rather than assumed healthy');
      } catch (e) {
        arm(/no difficulty ladder|appears 0 times/.test(e.message),
          'a run that prints no ladder is refused rather than assumed healthy');
      }
    }

    // The canonicalisation, both ways. It must ignore prose and it must not
    // ignore one character of anything that runs.
    {
      const c = (f, t) => canonical(f, Buffer.from(t));
      const codeA = '/**\n * a doc block\n */\n\nconst k = 3;\n';
      const codeB = '/** a completely different doc block, rewritten */\nconst k = 3;\n';
      const codeC = 'const k = 4;\n';
      say(c('a.js', codeA) === c('a.js', codeB),
        'a rewritten doc block is not a change to the engine');
      say(c('a.js', codeA) !== c('a.js', codeC),
        'one changed digit IS a change to the engine');
      say(c('a.js', 'const k = 3; // why\n') !== c('a.js', 'const k = 3; // other\n'),
        'a trailing comment is left alone rather than parsed for — conservative on purpose');
      say(c('g.json', '{ "a" : 1 }') === c('g.json', '{"a":1}'),
        'a reindented graph is not a changed graph');
      say(c('g.json', '{"a":1}') !== c('g.json', '{"a":2}'),
        'a changed graph value IS a changed graph');
      say(c('g.json', 'not json at all') === 'not json at all',
        'an unparseable graph falls back to its own text rather than to nothing');
    }

    const total = cases.length + armCases + 6;
    console.log(bad
      ? `\nself-test FAILED — ${bad} of ${total}`
      : `\nself-test OK — ${total} planted cases: ${cases.length} ways this file went stale, `
        + `${armCases} ways it could publish the cram as the class figure, 6 on the canonicalisation.`);
    process.exit(bad ? 1 : 0);
  }

  const tree = await treeNow();

  // --- --check: no simulation, just the fingerprints ----------------------
  if (has('--check')) {
    let file;
    try { file = JSON.parse(await readFile(OUT, 'utf8')); } catch {
      console.error('content/standards/mastery-runs.json is missing or unreadable — '
        + 'run node tools/build-mastery-runs.mjs');
      process.exit(1);
    }
    const problems = checkRuns(file, tree, await digestOf(GENERATOR_FILES));
    if (problems.length) {
      console.error('the published mastery figures are not readings of this tree:');
      for (const p of problems) console.error('  ' + p);
      console.error(`\n${problems.length} stale figure(s). ONE command re-takes every reading:`);
      console.error('  node tools/build-mastery-runs.mjs');
      console.error('It is about twenty-five minutes of Monte Carlo, and it must run on a tree nobody '
        + 'is editing: each row is digested before and after its own run and a reading the tree moved '
        + 'under is thrown away.');
      process.exit(1);
    }
    console.log(`content/standards/mastery-runs.json is a reading of this tree: ${tree.length} units, `
      + `each fingerprinted over ${tree[0].files.length}-${tree[tree.length - 1].files.length} files.`);
    process.exit(0);
  }

  // --- the run -------------------------------------------------------------
  const only = opt('unit');
  const wanted = only ? tree.filter((u) => u.id === only) : tree;
  if (!wanted.length) {
    console.error(`no unit "${only}" in content/courses.json`);
    process.exit(1);
  }
  let previous = { runs: [] };
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first write */ }
  const kept = new Map((previous.runs || []).map((r) => [r.unit, r]));

  /**
   * THE TREE MUST NOT MOVE UNDER A READING.
   *
   * A whole regeneration is twenty-five minutes of Monte Carlo, and this repo is
   * edited by several people at once — so digesting every unit ONCE at process
   * start records a fingerprint the run did not use. The reading would carry the
   * name of a tree that stopped existing while it was being taken, which is a
   * subtler version of exactly the staleness this file exists to stop.
   *
   * So each row is digested immediately BEFORE its run — those are the bytes
   * node is about to load — and again immediately after. If they differ, the
   * tree moved mid-reading; the run is void and is taken again. Twice is not a
   * flake, it is a tree nobody can measure, and it says so and stops rather than
   * publishing a number nothing stands behind.
   */
  const ranOn = new Date().toISOString().slice(0, 10);
  for (const u of wanted) {
    const L = u.route ? ROUTE_LEARNERS : LEARNERS;
    const B = u.route ? ROUTE_BUDGET : BUDGET;
    let row = null;
    let digest = null;
    for (let attempt = 1; attempt <= 2 && !row; attempt++) {
      digest = await digestOf(u.files);
      process.stdout.write(`  simulating ${u.route ? u.route.join(' + ') : u.id} — ${L} learners, `
        + `${B} items${attempt > 1 ? ' (again)' : ''} … `);
      const got = await simulate(u);
      const after = await digestOf(u.files);
      if (after === digest) { row = got; break; }
      console.log(`VOID — the tree moved while this was being measured (${digest} -> ${after}).`);
    }
    if (!row) {
      console.error(`\n${u.id}: the tree moved under two consecutive readings. A number measured on a `
        + 'tree that no longer exists is the defect this file was written to stop, so nothing is '
        + `written. The files it is a reading of are:\n  ${u.files.join('\n  ')}\nTake this reading `
        + 'when they are not being edited.');
      process.exit(1);
    }
    kept.set(u.id, { ...row, ...(u.route ? { units: u.route } : {}), ranOn,
      sources: { digest, files: u.files }, history: historyAfter(kept.get(u.id)) });
    /* EVERY ARM ON THE LINE, EVERY RUN. The defect was invisible for months
       because one number was printed where three had been measured. */
    console.log(`certified ${row.certified.toFixed(1)}% on ${row.certifiedArm}, gate ${row.gate}`);
    for (const c of CADENCES) {
      const a = row.arms[c.id];
      console.log(`      ${c.label.padEnd(36)} ${a.trueMastery.toFixed(1).padStart(5)}%   `
        + `Q1 ${a.lowestQuintile.toFixed(1)}%   hollow ${a.hollowLearners.toFixed(1)}%   `
        + `a week later ${a.weekLater.toFixed(1)}%   a month later ${a.monthLater.toFixed(1)}%`
        + (c.delivered ? '' : '   NOT the delivery shape'));
    }
  }
  const runs = tree.map((u) => kept.get(u.id)).filter(Boolean);
  await writeFile(OUT, serialise(HEADER(tree),
    { ...GENERATOR, digest: await digestOf(GENERATOR_FILES) }, runs));
  console.log(`\nwrote content/standards/mastery-runs.json — ${runs.length} units`
    + (only ? ` (${only} re-measured, the rest kept)` : ''));
}
