#!/usr/bin/env node
/**
 * `npm run check:mastery` — THE 80%-MASTERY PROMISE, AND IT CAN TURN THE BUILD RED.
 *
 *   node tools/simulate-all.mjs                 # the gate
 *   node tools/simulate-all.mjs --self-test     # prove the severity rule AND the arm rule bite
 *   node tools/simulate-all.mjs --route-only    # the shipped route alone (the hard half)
 *   node tools/simulate-all.mjs --prefixes      # + every preview prefix, not just the next one
 *   node tools/simulate-all.mjs --full          # + every unit standalone (the per-wave evidence run)
 *   node tools/simulate-all.mjs --quiet         # per-run verdict only
 *
 * WHY THIS FILE EXISTS, THREE TIMES OVER
 *
 * 1. `simulate.mjs` is the only tool in this repo that takes `--unit`, and its
 *    default is Level 1. So the 80%-mastery promise — the one number the client
 *    bought — was evidence about ten skills, and the other fifty-two had never
 *    been simulated at all. A flag with a default is not coverage.
 *
 * 2. And then this file, which fixed that, was left OUT OF `npm run check`,
 *    with the reason written into `tools/check-all.mjs` as
 *
 *        'It currently fails on Levels 2 and 4.'
 *
 *    A gate excluded because it fails is not a decision; it is the defect,
 *    written down in the tree as though it were a decision.
 *
 * 3. AND THEN, IN THE BUILD, IT CERTIFIED THE WRONG ARM. This is the one that
 *    matters, because it is the one that printed green.
 *
 *    `simulate.mjs` runs two cohorts over the same lattice, the same bank and
 *    the same budget, and the ONLY difference between them is the shape the
 *    work arrives in:
 *
 *      · ONE UNBROKEN SITTING — everything learned in the last eight hours,
 *        nothing carried across a night. simulate.mjs's own header calls this
 *        row "the cram". Its number is the file's headline and its exit code.
 *      · ACROSS DAYS — 22-minute sittings with a real night between them, the
 *        record saved and reloaded at every boundary, forgetting applied over
 *        the gap. This is the delivery shape BRIEF.md mandates in as many
 *        words: "Sessions are Pomodoro-shaped: 15-25 minutes… Progress must
 *        survive the break… they come back tomorrow."
 *
 *    The gate read pass/fail off
 *
 *        /(\d+(?:\.\d+)?)% of simulated learners reach true mastery/
 *
 *    matched against the WHOLE captured tail. That sentence belongs to the
 *    single-sitting arm. The across-days arm prints its own numbers forty lines
 *    earlier, under its own heading, and the regex never reached them. So on
 *    the shipped route this gate passed at 97.0% while the same output said
 *
 *        every day (24 h between sittings, 300 learners)
 *          true mastery of the level          0.0%
 *          learners with any hollow claim     OLD 98.3%   NEW 98.7%
 *
 *    — 0.0% true mastery for the shape a real student experiences, certified
 *    as 97.0% by a gate reading the first number in the output that looked like
 *    the right number.
 *
 * HOW THE PREDICATE IS BUILT SO THAT CANNOT HAPPEN AGAIN
 *
 * The number is no longer scraped out of prose. `readArms()` CUTS THE OUTPUT
 * INTO ITS SECTIONS first — simulate.mjs writes every heading at column 0 and
 * indents everything a heading owns, so the structure is real and not guessed —
 * then reads each arm's figure only from inside that arm's own block. Three
 * rules make it fail closed rather than fail quiet:
 *
 *   · A READING MAY ONLY COME FROM ITS OWN SECTION. `true mastery of the level`
 *     appears in the testing-out block as well; a match there can never be
 *     mistaken for the delivered arm, because the parser is never looking at
 *     the whole text.
 *   · A MISSING OR AMBIGUOUS SECTION IS A RED GATE, NOT A FALLBACK. If the
 *     arm's heading is gone, or its cadence block is gone, or its figure
 *     appears twice inside one block, this gate refuses to certify anything and
 *     says the output shape moved. It never drops back to the headline.
 *   · THE CHILD'S OWN EXIT CODE IS NOT ENOUGH. simulate.mjs exits 0 today on
 *     the strength of the cram arm. A hard run passes only if the child exited
 *     0 AND every cadence of the delivered arm clears the bar.
 *
 * AND THE HONEST VERSION OF THIS FIX, SAID OUT LOUD: the durable answer is for
 * `tools/simulate.mjs` to emit a machine-readable block — `--json` with one
 * object per arm — so that no consumer parses English at all. That file belongs
 * to the pedagogy lane and this lane may not rewrite it, so what is here is the
 * strongest thing a reader can do from outside: parse the STRUCTURE rather than
 * the prose, and turn "the shape I expected is not there" into a failure
 * instead of into a wrong number. When `--json` lands, `readArms()` is the only
 * function in this file that has to change, and its self-test is the contract.
 *
 * THE SEVERITY RULE, AND WHY IT IS NOT A WAY OUT
 *
 * `content/courses.json` says which units a learner is actually handed:
 * `route.units` is `["algebra1-l1","algebra1-l2"]`, and Levels 3 to 5 are
 * `status: preview` — on disk, validated, reachable with `?unit=`, and never
 * put in front of anybody who did not ask. So:
 *
 *   · THE SHIPPED ROUTE, COMPOSED, IS HARD. If it misses 80%, this exits 1 and
 *     `npm run check` goes red. There is no list of excuses it can be added to.
 *   · A PREVIEW UNIT IS ADVISORY. It is reported, loudly, with its number — but
 *     it does not turn the build red, because "preview" means nobody is looking
 *     at it, and a build that is permanently red teaches everyone to ignore it.
 *   · SEVERITY IS READ OFF THE MANIFEST, NOT WRITTEN HERE. Move a unit into
 *     `route.units` and it becomes hard on the next run with no edit to this
 *     file. That is asserted by `--self-test` against a planted manifest.
 *
 * WHICH LATTICE THE HARD RUN MEASURES, AND WHY IT IS THE COMPOSED ONE
 *
 * `--unit algebra1-l2` prunes the unit's cross-unit prerequisites, which models
 * a learner walking into Level 2 with NO LEVEL 1 BEHIND THEM — the one
 * condition `src/content/route.js` makes impossible. simulate.mjs says so in
 * its own header. So the hard run is `--units l1,l2`: the lattice a learner
 * actually stands on. It is also the STRICTER test, because it demands true
 * mastery of all 24 lines rather than of 14.
 *
 * The parameters are not chosen here either. `content/courses.json` publishes
 *
 *     node tools/simulate.mjs 300 3600 --units algebra1-l1,algebra1-l2
 *       -> 98.0% true mastery
 *
 * as the evidence the route ships on. This gate RE-RUNS THAT PUBLISHED
 * EXPERIMENT on every build. Note what the published number is, though: it is a
 * SINGLE-SITTING figure, so it is reported here as drift on the cram arm and it
 * is explicitly NOT the thing that certifies the promise. Picking a friendlier
 * cohort or a bigger item budget would be exactly the gate-weakening this file
 * is a response to, so the numbers are quoted from the manifest and named in
 * the output.
 */
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allUnits, routeUnits } from './_courses.mjs';
import { findings } from './_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* RUN AS A GATE, OR IMPORTED FOR ITS RULES.
   This file exports ARMS, readArms(), verdictOf() and planRuns(), and the
   moment it had anything worth importing, importing it STARTED A FOUR-MINUTE
   MONTE-CARLO as a side effect of the `import` statement — the identical defect
   tools/check-all.mjs's header describes and fixed. `realpathSync` rather than
   a string compare, because this repo is reached through a symlink on more than
   one machine. */
const IS_MAIN = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const SELF_TEST = argv.includes('--self-test');
const ROUTE_ONLY = argv.includes('--route-only');
const ALL_PREFIXES = argv.includes('--prefixes') || argv.includes('--full');
const STANDALONE = argv.includes('--units-too') || argv.includes('--full');
const positional = argv.filter((a) => !a.startsWith('--'));

/** The bar the product is sold on. It is a floor; it may not be lowered here. */
export const BAR = 80.0;

/**
 * The published route experiment, quoted from `content/courses.json`'s own
 * `$comment`. Kept here as two numbers AND as the text they were read out of,
 * so that if somebody rewrites the manifest's evidence the gate notices it is
 * measuring something the manifest no longer claims.
 *
 * `claimArm` records WHICH ARM that published number is about. It is the
 * single-sitting one, and the day this file stopped noticing that is the day it
 * certified a cram as a course.
 */
export const PUBLISHED = {
  learners: 300,
  budget: 3600,
  claim: 98.0,
  claimArm: 'one-sitting',
  quotedAs: 'node tools/simulate.mjs 300 3600 --units algebra1-l1,algebra1-l2',
};

// ===========================================================================
// THE READER — structure first, prose second.
// ===========================================================================

const ANSI = /\[[0-9;]*m/g;

/**
 * Cut simulate.mjs's output into its top-level sections.
 *
 * The structure is real, not inferred: every heading that tool prints sits at
 * column 0 and everything the heading owns is indented under it. Anything
 * before the first heading is dropped — it is the run's own banner.
 *
 * @param {string} text
 * @returns {{head:string, body:string[]}[]}
 */
export function sectionsOf(text) {
  const out = [];
  let cur = null;
  for (const raw of String(text || '').replace(ANSI, '').split('\n')) {
    if (raw.trim() && !/^\s/.test(raw)) { cur = { head: raw.trim(), body: [] }; out.push(cur); }
    else if (cur) cur.body.push(raw);
  }
  return out;
}

/**
 * Cut one section's body into its sub-blocks — the cadence blocks inside
 * `coming back across days`, for instance. A sub-heading is indented two
 * spaces; its own rows are indented further.
 *
 * @param {string[]} body
 * @returns {{head:string, body:string[]}[]}
 */
export function blocksOf(body) {
  const out = [];
  let cur = null;
  for (const raw of body || []) {
    if (!raw.trim()) { if (cur) cur.body.push(raw); continue; }
    if (/^ {1,3}\S/.test(raw)) { cur = { head: raw.trim(), body: [] }; out.push(cur); }
    else if (cur) cur.body.push(raw);
  }
  return out;
}

/**
 * THE ARMS, declared rather than hunted for.
 *
 * Each one names the section it lives in, the blocks inside it, and the row
 * that carries its figure. `certifies` is the whole point of the file: exactly
 * one arm is the delivery shape BRIEF.md mandates, and it is the one the build
 * hangs on.
 */
export const ARMS = [
  {
    id: 'one-sitting',
    label: 'ONE UNBROKEN SITTING (the cram)',
    certifies: false,
    /* simulate.mjs's own headline and its own exit code. Reported here for
       contrast and for drift against the manifest, never as the verdict:
       "everything it knows was learned in the last eight hours, and none of
       its re-probes crossed a night" — its own words. */
    section: /^RESULT$/,
    rows: [{ id: 'buzzer', label: 'at the buzzer', row: /^true mastery of .*?:\s*(\d+(?:\.\d+)?)% of learners/ }],
    why: 'not the delivery shape: one sitting, nothing carried across a night',
  },
  {
    id: 'across-days',
    label: 'ACROSS DAYS — 22-minute sittings, saved and reloaded, a real night between',
    certifies: true,
    section: /^coming back across days\b/,
    /* Both cadences, and the bar is applied to BOTH. The promise is not "80% if
       you play every single day"; a class that meets three times a week is the
       same delivery shape at a different gap, and letting the gate quote the
       friendlier of the two would be choosing the arm again one level down. */
    rows: [
      { id: 'daily', label: 'every day (24 h)', block: /^every day \(/, row: /^true mastery of the level\s+(\d+(?:\.\d+)?)%/ },
      { id: 'third-day', label: 'every third day (72 h)', block: /^every third day \(/, row: /^true mastery of the level\s+(\d+(?:\.\d+)?)%/ },
    ],
    /* Reported, not asserted. The claim-level hollow figures ARE asserted, by
       simulate.mjs's own `hollowForm` / `hollowServed` invariants, which decide
       its exit code and therefore this gate's. This learner-level rate has no
       measured threshold in this repo, and inventing one here is the other half
       of the same disease — a bar picked to catch today's number. It is printed
       on every run so it cannot be lost. */
    extra: [{ id: 'hollow', label: 'learners with any hollow claim (NEW)', block: /^every day \(/, row: /^learners with any hollow claim\s+OLD\s+\d+(?:\.\d+)?%\s+NEW\s+(\d+(?:\.\d+)?)%/ }],
    why: 'the shape BRIEF.md mandates: 15-25 minute sittings, progress surviving the break',
  },
];

/**
 * Read every arm out of one captured run.
 *
 * FAILS CLOSED. Anything it cannot find, or finds twice, is a `problem`, and a
 * run with problems certifies nothing. There is no path in this function that
 * returns a number taken from outside the section it was asked for.
 *
 * @param {string} text the child's captured stdout
 * @returns {{readings:Record<string,Record<string,number>>, problems:string[]}}
 */
export function readArms(text) {
  const problems = [];   // a figure the VERDICT rests on, missing or ambiguous. Fatal.
  const notes = [];      // a figure that is only reported. Missing is worth saying, not worth a red build.
  const readings = {};
  const sections = sectionsOf(text);
  /* A BAR ROW MISSING IS FATAL; A REPORTED ROW MISSING IS A NOTE.
     Fail-closed is the rule for anything that decides pass/fail — the whole
     defect here was a predicate that carried on with the wrong number. But
     escalating a REPORTED figure would make an unrelated edit to simulate.mjs's
     prose turn check:mastery red on the shipped route, which is a gate going
     red for a reason that is not the product, and that is how gates stop being
     read. See tools/_freeport.mjs's row in RESUME.md for the last time that
     happened. */
  const only = (list, re, what, sink) => {
    const hit = list.filter((s) => re.test(s.head));
    if (!hit.length) { sink.push(`${what}: not in the output at all — the shape this gate reads has moved`); return null; }
    if (hit.length > 1) { sink.push(`${what}: ${hit.length} of them in one run, so no reading from it is unambiguous`); return null; }
    return hit[0];
  };
  const number = (lines, re, what, sink) => {
    const hits = [];
    for (const raw of lines) { const m = re.exec(raw.trim()); if (m) hits.push(Number(m[1])); }
    if (!hits.length) { sink.push(`${what}: the row this gate reads is not in that block`); return null; }
    if (hits.length > 1) { sink.push(`${what}: ${hits.length} rows in one block match, and a gate may not pick one of them`); return null; }
    return hits[0];
  };

  for (const arm of ARMS) {
    const armSink = arm.certifies ? problems : notes;
    const sec = only(sections, arm.section, `${arm.id}: the section "${arm.section.source}"`, armSink);
    if (!sec) continue;
    const blocks = blocksOf(sec.body);
    const got = {};
    for (const r of [...arm.rows, ...(arm.extra || [])]) {
      const sink = (arm.certifies && arm.rows.includes(r)) ? problems : notes;
      let lines = sec.body;
      if (r.block) {
        const b = only(blocks, r.block, `${arm.id}/${r.id}: the block "${r.block.source}"`, sink);
        if (!b) continue;
        lines = b.body;
      }
      const n = number(lines, r.row, `${arm.id}/${r.id}`, sink);
      if (n != null) got[r.id] = n;
    }
    readings[arm.id] = got;
  }
  return { readings, problems, notes };
}

/**
 * THE VERDICT, as a pure function so the self-test can plant a run at it.
 *
 * @param {{code:number}} run     what the child process did
 * @param {{readings:object, problems:string[]}} read what readArms made of it
 * @param {boolean} hard          is this run on the shipped route
 * @returns {{ok:boolean, why:string[], certified:number|null, cram:number|null}}
 */
export function verdictOf(run, read, hard = true) {
  const why = [];
  const arm = ARMS.find((a) => a.certifies);
  const got = read.readings[arm.id] || {};
  const cram = read.readings['one-sitting']?.buzzer ?? null;
  const values = arm.rows.map((r) => got[r.id]).filter((n) => typeof n === 'number');
  const certified = values.length === arm.rows.length ? Math.min(...values) : null;

  for (const p of read.problems) why.push(`OUTPUT SHAPE: ${p}`);
  if (run.code !== 0) why.push(`tools/simulate.mjs exited ${run.code} — its own invariants or its own bar refused this run`);
  if (certified == null) {
    why.push(`the delivered arm (${arm.label}) could not be read, so nothing certifies the ${BAR}% promise. `
      + 'This gate does NOT fall back to the headline: that fallback is the defect it exists for.');
  } else {
    for (const r of arm.rows) {
      if (got[r.id] < BAR) why.push(`${arm.label} · ${r.label}: ${got[r.id].toFixed(1)}% true mastery, bar ${BAR.toFixed(0)}%`);
    }
  }
  return { ok: why.length === 0, why: hard ? why : [], certified, cram, note: why };
}

/**
 * THE SEVERITY RULE, as a pure function so the self-test can plant a manifest.
 *
 * @param {object} manifest content/courses.json
 * @returns {{runs:{id:string,label:string,args:string[],hard:boolean,why:string}[], road:string[]}}
 */
export function planRuns(manifest, road, off, forcePrefixes = false) {
  const roadIds = road.map((u) => u.id);
  const runs = [];
  if (roadIds.length) {
    runs.push({
      id: 'route',
      label: `THE SHIPPED ROUTE — ${roadIds.join(' + ')}`,
      args: [String(PUBLISHED.learners), String(PUBLISHED.budget), '--units', roadIds.join(',')],
      hard: true,
      why: 'the lattice a learner with no query string actually walks, judged on the ACROSS-DAYS arm — '
         + '15-25 minute sittings with a real night between them, which is the delivery shape BRIEF.md mandates',
    });
  }
  for (const u of (STANDALONE ? road : [])) {
    runs.push({
      id: `unit:${u.id}`,
      label: `${u.id} on its own`,
      args: ['--unit', u.id],
      hard: false,
      why: 'ADVISORY: --unit prunes cross-unit prerequisites, so it models a learner entering this '
         + 'unit with nothing behind them — the one condition src/content/route.js makes impossible. '
         + 'The composed route run above is the hard one, and it is stricter.',
    });
  }
  for (const u of (STANDALONE ? off : [])) {
    runs.push({
      id: `unit:${u.id}`,
      label: `${u.id} (${u.status || 'off-route'}) on its own`,
      args: ['--unit', u.id],
      hard: false,
      why: `ADVISORY: status "${u.status || 'off-route'}" — not on route.units, so no learner is handed `
         + 'it without asking for it by name. Put its id in route.units and this run becomes hard, '
         + 'with no edit to this file.',
    });
  }
  /* What composing a preview unit onto the route would cost — the number that
     keeps Level 3 off it. Measured, never remembered, but NOT on every commit:
     the Level 3 prefix is a 38-skill lattice and takes about thirteen minutes,
     and the route does not change on most commits. It is a per-wave question,
     and the run below prints the flag that answers it. */
  let prefix = [...roadIds];
  for (const u of ((ALL_PREFIXES || forcePrefixes) ? off : [])) {
    prefix = [...prefix, u.id];
    runs.push({
      id: `prefix:${u.id}`,
      label: `the route WITH ${u.id} composed onto it`,
      args: [String(PUBLISHED.learners), String(PUBLISHED.budget), '--units', prefix.join(',')],
      hard: false,
      why: 'ADVISORY: what promoting this unit to the route would do to the promise. '
         + 'content/courses.json records 64.0% for the first of these, which is why the route stops where it does.',
    });
  }
  return { runs: ROUTE_ONLY ? runs.filter((r) => r.hard) : runs, road: roadIds };
}

// ---------------------------------------------------------------------------
// --self-test: the severity rule on planted manifests, AND the arm rule on
// planted output. Cheap: no simulation runs here.
//
// A gate nobody has watched refuse anything is not a gate — and the two rules
// that decide WHETHER this gate refuses anything are the ones that were
// missing, so they are the ones that get planted against.
// ---------------------------------------------------------------------------

/**
 * A captured run, in simulate.mjs's real line shapes, cut to the rows this gate
 * reads. The numbers are the ones measured on this tree with
 * `node tools/simulate.mjs 300 3600 --units algebra1-l1,algebra1-l2`.
 */
function fixture({ cram = 97.0, daily = 0.0, third = 0.0, hollow = 98.7, halfKnower = 91.4 } = {}) {
  return [
    'ASCENT — mastery simulation',
    '300 synthetic learners, budget 3600 items each, 24 skills',
    '',
    'testing out — learners who already know this, on the real scheduler',
    '  a learner who knows only the first five skills — where does the time go?',
    `    true mastery of the level      ${halfKnower.toFixed(1)}%`,
    '',
    'coming back across days — the same learners, the same 800 items, delivered in sittings',
    '  22-minute sittings. Between them a line decays towards 0.6 of its own high-water mark,',
    '',
    '  every day (24 h between sittings, 300 learners)',
    `    true mastery of the level          ${daily.toFixed(1)}%   (all ten skills 0.0%)`,
    '    lowest ability quintile            0.0%',
    '    hollow claims, judged when made    OLD 13.35%   NEW 16.65%   (1056 / 1317 of 7910)',
    `    learners with any hollow claim     OLD 98.3%   NEW ${hollow.toFixed(1)}%`,
    '',
    '  every third day (72 h between sittings, 300 learners)',
    `    true mastery of the level          ${third.toFixed(1)}%   (all ten skills 0.0%)`,
    '    lowest ability quintile            0.0%',
    '',
    '  the retention test — the same learners asked again a week later, taught nothing in between',
    '    one unbroken sitting           ████ 97.0%  ->  a week later 70.0%',
    '',
    'RESULT',
    `  true mastery of units algebra1-l1 + algebra1-l2: ${cram.toFixed(1)}% of learners`,
    '  every one of the 24 skills truly mastered: 87.3%',
    '',
    `  >>> ${cram.toFixed(1)}% of simulated learners reach true mastery <<<`,
    '',
  ].join('\n');
}

if (IS_MAIN && SELF_TEST) {
  let bad = 0;
  const flag = (m) => { console.error(` FAIL ${m}`); bad++; };
  const ok = (m) => console.log(`  ok   ${m}`);
  console.log('check:mastery self-test — WHICH ARM the gate reads, and WHICH UNITS it is hard on\n');

  // =========================================================================
  // A. THE ARM RULE. This is the defect: the gate certified the cram.
  // =========================================================================
  console.log('  A. the arm — a gate may not pass by matching the first number that looks like the right number');
  {
    // A1. THE EXACT SHAPE THAT SHIPPED: headline 97.0%, delivered arm 0.0%.
    const text = fixture({ cram: 97.0, daily: 0.0, third: 0.0 });
    const read = readArms(text);
    if (read.problems.length) flag(`the honest output shape was rejected: ${read.problems.join('; ')}`);
    else ok('a complete run parses with no complaints');
    const v = verdictOf({ code: 0 }, read);
    if (v.certified !== 0.0) flag(`the gate certified ${v.certified}% — it is still reading the cram arm`);
    else ok('the certified number is 0.0% — the ACROSS-DAYS arm, not the 97.0% headline six lines below it');
    if (v.cram !== 97.0) flag(`the cram arm was not read for contrast (got ${v.cram})`);
    else ok('the single-sitting arm is still read, and reported as contrast (97.0%)');
    if (v.ok) flag('THE DEFECT IS BACK: a run reporting 0.0% true mastery across days was passed');
    else ok('and the run is REFUSED, even though tools/simulate.mjs exited 0 on the strength of the cram');

    // A2. …and the old predicate, run over the same text, to name what changed.
    const oldWay = /(\d+(?:\.\d+)?)% of simulated learners reach true mastery/.exec(text);
    if (!oldWay || Number(oldWay[1]) !== 97.0) flag('the fixture no longer reproduces the old predicate, so this comparison proves nothing');
    else ok(`the predicate this replaced reads ${oldWay[1]}% off the same bytes — that is the whole defect, in one line`);
  }
  {
    // A3. THE TRAP THE OLD REGEX WOULD HAVE FALLEN INTO ONE LEVEL DOWN:
    // `true mastery of the level` also appears in the testing-out block, ABOVE
    // the delivered section, with a healthy number in it.
    const read = readArms(fixture({ daily: 0.0, third: 0.0, halfKnower: 91.4 }));
    const v = verdictOf({ code: 0 }, read);
    if (v.certified !== 0.0) flag(`a row with the same words in another section was read instead (${v.certified}%)`);
    else ok('the identical row in the testing-out block (91.4%) cannot be mistaken for the delivered arm');
  }
  {
    // A4. FAIL CLOSED. The delivered section is gone; the headline is still
    // there and still says 97.0%. The gate must refuse, not fall back.
    const text = fixture({ cram: 97.0 }).split('\n').filter((l) => !/coming back across days|every day \(|every third day \(|true mastery of the level\s+0/.test(l)).join('\n');
    const read = readArms(text);
    const v = verdictOf({ code: 0 }, read);
    if (!read.problems.length) flag('a run with no delivered arm in it was parsed as complete');
    else ok(`a missing delivered arm is an OUTPUT SHAPE problem: "${read.problems[0].slice(0, 74)}…"`);
    if (v.ok) flag('THE FALLBACK IS BACK: with the delivered arm missing, the gate certified the headline');
    else if (v.certified != null) flag(`it certified ${v.certified}% out of an output that does not contain the arm`);
    else ok('with the arm missing the gate certifies NOTHING and goes red — it never drops back to the headline');
  }
  {
    // A5. One cadence missing is the same kind of hole.
    const text = fixture().split('\n').filter((l) => !/every third day \(/.test(l)).join('\n');
    const v = verdictOf({ code: 0 }, readArms(text));
    if (v.certified != null) flag('a run missing one cadence still produced a certified number');
    else ok('one missing cadence block is enough to refuse the whole run');
  }
  {
    // A6. AND THE OTHER DIRECTION, which is the half that matters: an honest
    // run that clears the bar on both cadences has to PASS. A gate that is
    // always red is a gate somebody switches off.
    const v = verdictOf({ code: 0 }, readArms(fixture({ cram: 97.0, daily: 91.4, third: 86.0 })));
    if (!v.ok) flag(`an honest run above the bar was refused: ${v.why.join(' | ')}`);
    else ok('a run at 91.4% / 86.0% across days passes — the bar fires on the defect and stays quiet beside it');
    if (v.certified !== 86.0) flag(`the certified number is not the weaker cadence (${v.certified})`);
    else ok('and the number it certifies is the WEAKER cadence (86.0%), so the friendlier one cannot be quoted');
  }
  {
    // A7. The child's exit code is still respected on its own.
    const v = verdictOf({ code: 1 }, readArms(fixture({ daily: 91.4, third: 86.0 })));
    if (v.ok) flag('a child that exited 1 was passed because the arm looked fine');
    else ok('a child that exits 1 — a broken invariant — is red whatever the arm says');
  }
  {
    // A8. Two copies of the section (a run pasted twice) is ambiguity, not evidence.
    const v = verdictOf({ code: 0 }, readArms(`${fixture()}\n${fixture()}`));
    if (v.certified != null) flag('output containing the delivered section twice still produced one number');
    else ok('two copies of the arm in one capture is refused as ambiguous, not averaged or first-matched');
  }
  {
    // A9. The hollow rate is read and carried, so it cannot be lost.
    const read = readArms(fixture({ hollow: 98.7 }));
    if (read.readings['across-days']?.hollow !== 98.7) flag('the hollow-claim rate was not read off the delivered arm');
    else ok('the delivered arm\'s hollow-claim rate (98.7%) is read and printed on every run — reported, not asserted');
  }
  {
    // A10. …and a REPORTED figure going missing is a note, not a red build. A
    // gate that goes red because somebody reworded a line it only prints is a
    // gate going red for a reason that is not the product.
    const text = fixture({ daily: 91.4, third: 86.0 }).split('\n').filter((l) => !/learners with any hollow claim/.test(l)).join('\n');
    const read = readArms(text);
    const v = verdictOf({ code: 0 }, read);
    if (read.problems.length) flag(`a missing REPORTED row was treated as fatal: ${read.problems.join('; ')}`);
    else if (!read.notes.some((n) => /hollow/.test(n))) flag('a missing reported row vanished silently instead of being said out loud');
    else ok('a missing REPORTED row is a note, printed, and the run still certifies — only bar rows fail closed');
    if (!v.ok) flag('the run was refused over a figure it only reports');
    else ok('…and the honest run above the bar still passes');
  }
  {
    // A11. …while a missing BAR row is still fatal, in the same output.
    const text = fixture({ daily: 91.4, third: 86.0 }).split('\n')
      .filter((l) => !/^    true mastery of the level          91/.test(l)).join('\n');
    const v = verdictOf({ code: 0 }, readArms(text));
    if (v.ok || v.certified != null) flag('a missing BAR row did not stop the run certifying');
    else ok('a missing BAR row in the very same output is still fatal — the two are not treated alike');
  }

  // =========================================================================
  // B. THE SEVERITY RULE, on planted manifests.
  // =========================================================================
  console.log('\n  B. the severity — which units can turn the build red');
  const U = (id, status) => ({ id, status, requires: [] });
  const plan = (roadIds, allUnitsList) => planRuns(
    null,
    allUnitsList.filter((u) => roadIds.includes(u.id)),
    allUnitsList.filter((u) => !roadIds.includes(u.id)),
  );

  // 1. The shipped shape: two on the route, three preview.
  {
    const p = plan(['l1', 'l2'], [U('l1', 'shipped'), U('l2', 'shipped'), U('l3', 'preview'), U('l4', 'preview')]);
    const hard = p.runs.filter((r) => r.hard);
    if (hard.length !== 1 || hard[0].id !== 'route') flag(`the composed route is not the hard run (hard: ${hard.map((r) => r.id).join(',') || 'none'})`);
    else ok('the composed shipped route is the hard run, and the only one');
    if (!hard[0].args.includes('l1,l2')) flag(`the hard run does not compose the route (${hard[0].args.join(' ')})`);
    else ok('the hard run composes exactly the units route.units names, in order');
    if (p.runs.some((r) => r.hard && r.id.includes('l3'))) flag('a preview unit can turn the build red');
    else ok('a preview unit is advisory — reported with its number, never red');
    const withPrefixes = planRuns(null,
      [U('l1', 'shipped'), U('l2', 'shipped')], [U('l3', 'preview'), U('l4', 'preview')], true);
    if (!withPrefixes.runs.some((r) => r.id === 'prefix:l3')) flag('--prefixes does not measure what promoting a preview unit would cost');
    else ok('--prefixes measures what promoting each preview unit would cost the promise — measured, not remembered');
  }

  // 2. THE DEFECT THIS RULE EXISTS FOR: a unit is promoted to the route and the
  //    gate's severity has to follow the manifest with no edit to this file.
  {
    const p = plan(['l1', 'l2', 'l3'], [U('l1', 'shipped'), U('l2', 'shipped'), U('l3', 'shipped'), U('l4', 'preview')]);
    const hard = p.runs.filter((r) => r.hard);
    if (!hard.length || !hard[0].args.includes('l1,l2,l3')) flag('promoting a unit into route.units did not make it hard');
    else ok('a unit moved into route.units becomes hard on the next run, with no edit to this file');
  }

  // 3. …and the other direction: dropping a unit off the route must NOT leave a
  //    stale hard run behind, or the gate goes red for a unit nobody ships.
  {
    const p = plan(['l1'], [U('l1', 'shipped'), U('l2', 'preview')]);
    const hard = p.runs.filter((r) => r.hard);
    if (hard.length !== 1 || hard[0].args.includes('l2')) flag('a unit taken off the route is still in the hard run');
    else ok('a unit taken off the route leaves the hard run, so the gate never goes red for something nobody ships');
  }

  // 4. An empty route is not a green build: it is a manifest with nothing on it.
  {
    const p = plan([], [U('l1', 'preview')]);
    if (p.runs.some((r) => r.hard)) flag('an empty route produced a hard run out of nowhere');
    else ok('an empty route produces no hard run — and the gate below refuses to pass on one');
  }

  // 5. The build default may drop advisory runs; it may NEVER drop the hard one.
  {
    const p = plan(['l1', 'l2'], [U('l1', 'shipped'), U('l2', 'shipped'), U('l3', 'preview')]);
    if (!p.runs.some((r) => r.hard)) flag('the build default dropped the hard route run');
    else ok('the build default always carries the hard composed-route run, whatever else it skips');
    if (p.runs.some((r) => r.id.startsWith('prefix:'))) flag('the build default runs a preview prefix; those are per-wave, not per-commit');
    else ok('the build default runs the hard route and nothing else — the advisory runs are named, with the flag that brings them back');
  }

  // 6. An advisory run may never turn the build red, whatever its arm says.
  {
    const v = verdictOf({ code: 1 }, readArms(fixture({ daily: 0.0, third: 0.0 })), false);
    if (v.why.length) flag('a preview run was allowed to turn the build red');
    else ok('the same catastrophic reading on a PREVIEW unit is reported with its number and stays advisory');
  }

  // 7. The manifest still publishes the experiment this gate re-runs.
  {
    const raw = await readFile(path.join(ROOT, 'content/courses.json'), 'utf8');
    if (!raw.includes(PUBLISHED.quotedAs)) {
      flag(`content/courses.json no longer publishes "${PUBLISHED.quotedAs}". This gate re-runs the manifest's `
        + 'own experiment; if the manifest\'s evidence has been rewritten, the parameters here are measuring a claim nobody makes.');
    } else ok(`content/courses.json still publishes the experiment this gate re-runs (${PUBLISHED.quotedAs})`);
    const { road } = await routeUnits();
    const composed = road.map((u) => u.id).join(',');
    if (!PUBLISHED.quotedAs.includes(composed)) {
      flag(`the published experiment composes a different lattice (${PUBLISHED.quotedAs}) from route.units (${composed}); `
        + 'one of the two has moved and the gate would be quoting a number about the wrong thing');
    } else ok(`the published experiment and route.units name the same lattice (${composed})`);
  }

  // 8. The bar is a floor, and it is the number in BRIEF.md.
  if (BAR !== 80.0) flag(`the bar has been moved to ${BAR}%. It is the number this product is sold on and it may not be lowered here.`);
  else ok('the bar is 80.0% — the number BRIEF.md promises, not a number chosen to fit today\'s reading');

  console.log('');
  if (bad) { console.error(`self-test: ${bad} failure(s)\n`); process.exit(1); }
  console.log('self-test: ok — the gate reads the ACROSS-DAYS arm, refuses rather than falling back when it cannot,\n'
    + '                and severity still follows content/courses.json\n');
  process.exit(0);
}

/* Everything above is definition; everything below RUNS FOUR MINUTES OF
   MONTE-CARLO, so it hangs off a function only IS_MAIN calls. See IS_MAIN. */
async function main() {
const { road, off } = await routeUnits();
const every = await allUnits();
const { runs, road: roadIds } = planRuns(null, road, off);
const DELIVERED = ARMS.find((a) => a.certifies);

console.log('THE 80%-MASTERY PROMISE — Monte-Carlo over synthetic learners\n');
console.log(`route (content/courses.json)  ${roadIds.join(' -> ') || '(nothing on the route)'}`);
console.log(`off the route                 ${off.map((u) => `${u.id} (${u.status || 'off-route'})`).join(', ') || 'none'}`);
console.log(`units on disk                 ${every.length}`);
console.log(`hard runs                     ${runs.filter((r) => r.hard).length}  — a red one turns npm run check red`);
console.log(`advisory runs                 ${runs.filter((r) => !r.hard).length}  — reported with their numbers, never red`);
console.log(`the arm that decides          ${DELIVERED.label}`);
console.log(`                              ${DELIVERED.why}`);
console.log('                              read by section, not scraped: a missing or doubled section is a RED gate,');
console.log('                              never a fall-back to the headline. See readArms() in this file.');
/* WHAT THIS RUN IS NOT DOING, and why — the same discipline as NOT_IN_BUILD in
   tools/check-all.mjs. A Monte-Carlo minute is real; an omission nobody wrote
   down is how check:mastery ended up outside the build in the first place. */
if (!STANDALONE || !ALL_PREFIXES) {
  console.log('\nnot run here, on purpose:');
  if (!STANDALONE) {
    console.log(`  ${every.length} per-unit standalone run(s) — about a minute each, and the composed route run above is`);
    console.log('    STRICTLY HARDER for the units on the route (it demands true mastery of every line in the whole');
    console.log('    lattice, not of one unit\'s share). They add information only about the preview units, which no');
    console.log('    learner is handed.                        ->  node tools/simulate-all.mjs --units-too');
  }
  if (!ALL_PREFIXES) {
    console.log(`  ${off.length} preview prefix run(s) — what promoting each preview unit onto the route would cost the`);
    console.log('    promise. The first of them is a 38-skill lattice and about thirteen minutes, and the route does');
    console.log('    not change on most commits, so it is a per-wave question. Measured, not remembered: run it before');
    console.log('    moving anything into route.units.          ->  node tools/simulate-all.mjs --prefixes');
    console.log('    Last measured on this tree: route + algebra1-l3 = 59.7% (the manifest records 64.0%).');
  }
}
console.log('');

if (!roadIds.length) {
  console.error('content/courses.json puts NO unit on the route. There is nothing to promise 80% about.');
  process.exit(1);
}

const rows = [];
for (const r of runs) {
  console.log(`\n\x1b[1m── ${r.label} ──\x1b[0m ${r.hard ? '\x1b[31mHARD\x1b[0m' : 'advisory'}`);
  console.log(`   ${r.why}`);
  /* The command PRINTED is the command RUN, overrides included. A tool that
     prints one invocation and executes another is the same class of thing as a
     gate that reads one arm and names the other. */
  console.log(`   node tools/simulate.mjs ${[...positional, ...r.args].join(' ')}`    + `${positional.length ? '   (the leading numbers override the published cohort — this is not the published experiment)' : ''}`);
  const t0 = Date.now();
  let tail = '';
  const code = await new Promise((resolve) => {
    const child = spawn('node', [path.join(ROOT, 'tools/simulate.mjs'), ...positional, ...r.args], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'],
    });
    child.stdout.on('data', (b) => {
      const s = String(b);
      tail += s;
      if (!QUIET) process.stdout.write(s);
    });
    child.on('exit', (c, sig) => resolve(sig ? 1 : (c ?? 1)));
    child.on('error', () => resolve(127));
  });
  const read = readArms(tail);
  const v = verdictOf({ code }, read, r.hard);

  /* EVERY ARM, SIDE BY SIDE, ON EVERY RUN. The defect was invisible because
     one number was printed and the other one was forty lines up in somebody
     else's prose. Both are printed here, in one place, with the bar beside the
     one that is a bar. */
  console.log('\n   \x1b[1marms\x1b[0m');
  for (const arm of ARMS) {
    const got = read.readings[arm.id] || {};
    for (const rr of [...arm.rows, ...(arm.extra || [])]) {
      const n = got[rr.id];
      const isBar = arm.certifies && arm.rows.includes(rr);
      const mark = !isBar ? '      ' : (typeof n === 'number' && n >= BAR ? '\x1b[32m  ok  \x1b[0m' : '\x1b[31m FAIL \x1b[0m');
      console.log(`  ${mark} ${(`${arm.certifies ? 'DELIVERED' : 'contrast '} · ${rr.label}`).padEnd(46)} `
        + `${typeof n === 'number' ? `${n.toFixed(1)}%`.padStart(7) : '   —   '}  ${isBar ? `bar ${BAR.toFixed(0)}%` : arm.certifies ? 'reported, not asserted' : arm.why}`);
    }
  }
  for (const p of read.problems) console.log(`   \x1b[31mOUTPUT SHAPE\x1b[0m ${p}   — a figure the verdict rests on; this run certifies nothing`);
  for (const n of (read.notes || [])) console.log(`   \x1b[33mnot read\x1b[0m ${n}   — reported only, so it is said out loud and does not turn the build red`);

  rows.push({
    ...r,
    code,
    secs: (Date.now() - t0) / 1000,
    pct: v.certified,
    cram: v.cram,
    hollow: read.readings['across-days']?.hollow ?? null,
    bad: v.note,
    ok: v.ok,
  });
}

// ---------------------------------------------------------------------------
// THE TABLE. Route first, severity in the row, and the one line at the bottom
// that says what a reader has to do about it.
// ---------------------------------------------------------------------------
console.log(`\n\x1b[1mmastery\x1b[0m   (HARD = on the shipped route; advisory = preview or a lattice no learner is handed)`);
console.log(`          the number in the column is the DELIVERED arm — ${DELIVERED.label}`);
for (const r of rows) {
  const mark = r.ok ? '\x1b[32m  ok  \x1b[0m' : (r.hard ? '\x1b[31m FAIL \x1b[0m' : '\x1b[33m warn \x1b[0m');
  const num = r.pct == null ? '   —  ' : `${r.pct.toFixed(1)}%`.padStart(6);
  const cram = r.cram == null ? '  —  ' : `${r.cram.toFixed(1)}%`.padStart(6);
  console.log(`${mark} ${r.hard ? 'HARD    ' : 'advisory'} ${r.label.padEnd(46)} ${num}  (cram ${cram})  exit=${String(r.code).padEnd(3)} ${r.secs.toFixed(1).padStart(7)}s`);
}

const hardBad = rows.filter((r) => r.hard && !r.ok);
/* An advisory run is judged by exactly the same predicate as a hard one — same
   arm, same bar, same fail-closed parse. The ONLY difference is what happens
   next. Judging preview by a softer rule would make promoting a unit a
   surprise, and the whole point of reading severity off the manifest is that
   it is not one. */
const softBad = rows.filter((r) => !r.hard && !r.ok);
const routeRow = rows.find((r) => r.id === 'route');

console.log('');
if (routeRow && routeRow.cram != null) {
  const drift = routeRow.cram - PUBLISHED.claim;
  console.log(`the published claim: content/courses.json says ${PUBLISHED.claim.toFixed(1)}% for this lattice. That is a `
    + `${PUBLISHED.claimArm.toUpperCase()} number; this run's single-sitting reading is `
    + `${routeRow.cram.toFixed(1)}% (${drift >= 0 ? '+' : ''}${drift.toFixed(1)}).`);
  console.log('  It is printed for drift, and it is NOT what certifies the promise. The manifest publishes a figure');
  console.log('  about a cohort that learned everything in one sitting; the product is sold as 15-25 minute sittings');
  console.log('  with the progress surviving the break, and that arm is the one in the column above.');
}
if (routeRow && routeRow.hollow != null) {
  console.log(`hollow claims on the delivered arm: ${routeRow.hollow.toFixed(1)}% of learners hold at least one mastery `
    + 'claim their hidden competence does not support (reported, not a bar here — the claim-level version is an');
  console.log('  invariant inside tools/simulate.mjs and it decides that process\'s exit code, which this gate reads).');
}
if (softBad.length) {
  console.log(`\x1b[33m${softBad.length} advisory run(s) red — NOT on the shipped route, so the build stays green: `
    + `${softBad.map((r) => r.label).join('; ')}\x1b[0m`);
  console.log('  These are real numbers about real content. They are advisory only because no learner is handed');
  console.log('  that lattice today. Promoting any of these units into content/courses.json route.units makes its');
  console.log('  run HARD on the next build, automatically.');
}
if (hardBad.length) {
  console.log(`\n\x1b[31mMASTERY RED ON THE SHIPPED ROUTE: ${hardBad.map((r) => r.label).join('; ')}\x1b[0m`);
  for (const r of hardBad) for (const w of r.bad) console.log(`  · ${w}`);
  console.log('The 80%-mastery promise is what this product is sold on, and it is not being met on the lattice a');
  console.log('learner with no query string walks, in the shape the product is delivered in. This may not be excused');
  console.log('by moving the gate out of the build, and it may not be excused by quoting the single-sitting number.');
}
if (!hardBad.length) {
  console.log(`\n\x1b[32mthe shipped route meets the ${BAR}% promise in the shape it is delivered in\x1b[0m`);
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. Severity here has always
   been read off content/courses.json rather than written in this tool, and the
   ledger is where that rule now lives for every gate: a run on route.units is a
   route finding, a preview run is advisory and printed in full, and promoting a
   unit makes its run hard on the next build with no edit here. */
{
  const say = routeRow && routeRow.pct != null
    ? ` (${routeRow.pct.toFixed(1)}% across days, against ${routeRow.cram == null ? '—' : `${routeRow.cram.toFixed(1)}%`} in one unbroken sitting)`
    : ' (the delivered arm could not be read out of the output)';
  /* The gate name follows the ARM, because `--full` is a different gate
     (check:mastery:full, recorded per wave) and a ledger that lied about which
     one it came from would put a per-wave run's findings on a per-commit
     gate's row in the build summary. */
  const F = findings((ALL_PREFIXES || STANDALONE) ? 'check:mastery:full' : 'check:mastery', { scope: 'route' });
  for (const r of hardBad) {
    F.route(`the ${BAR}% promise is not met on ${roadIds.join(' + ')} in the delivered shape — ${r.label}${say}: `
      + `${r.bad.join('; ')}`);
  }
  for (const r of softBad) F.preview(`${r.label}: ${r.bad.join('; ')}`);
  F.done();
}
}

if (IS_MAIN) await main();
