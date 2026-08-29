/**
 * Does the pipeline actually get people there?
 *
 * A mastery claim that rests on the engine's own posterior is circular: BKT will
 * happily call a learner mastered because BKT said so. This simulation is the
 * non-circular version. It runs synthetic learners of varying ability through
 * the *real* MasteryEngine — the real prerequisite gate, the real placement,
 * the real difficulty adaptation, the real worked-example fading, the real
 * interleaved retrieval schedule, the real transfer proving run — while
 * tracking a hidden competence value that the engine never sees and cannot
 * influence except by teaching.
 *
 * Then it asks the only question that matters: what fraction of learners end up
 * genuinely competent, and how often does the engine claim a mastery that the
 * hidden truth does not support?
 *
 *   node tools/simulate.mjs [learners] [budget]
 *
 * Four cohorts run, all on the same engine and the same bank:
 *
 *   · the ordinary population — cold starts, the headline mastery number;
 *   · learners who already know all ten skills (hidden competence 0.95, and
 *     their representations already familiar, because that is what knowing
 *     algebra means) — the test-out cohort, reported in minutes and in items;
 *   · learners who know only the first five — does the schedule notice, and
 *     where does the time go;
 *   · learners *frozen* at a known competence, who neither learn nor forget.
 *     That is not a model of a person; it is the only way to measure a gate.
 *     Ability is held fixed and the question becomes psychometric: given a
 *     student who genuinely sits at 0.70, how often does this engine hand them
 *     a mastery claim, and how fast? That table is the false-positive rate, and
 *     it is printed whether it flatters the design or not.
 *
 * Minutes come from `itemSeconds` in src/learn/mastery.js — the same clock the
 * router optimises against, because a schedule graded on a different clock from
 * the one it plans with is measuring nothing. That clock is an assumption about
 * reading and working time, so every minutes figure is printed beside an items
 * figure, which is assumption-free.
 *
 * Learner model (deliberately not generous):
 *   · ability theta ~ N(0,1), clipped, mapped to a learning rate of 0.12–0.30;
 *   · one learner in three carries a misconception that resists teaching: half
 *     learning rate and a standing accuracy penalty on one skill;
 *   · a 6% inattention slip is applied on top, whatever the learner knows;
 *   · response probability is a logistic in (competence − difficulty demand),
 *     floored by a guess rate that only rises as the surface narrows;
 *   · an unfamiliar representation costs real accuracy until it has been met,
 *     which is what makes the proving run a transfer test rather than a formality;
 *   · learning gains follow the effect ordering the literature reports — an error
 *     followed by targeted, elaborated feedback teaches more than a bare correct
 *     answer, and a studied worked example teaches more than an unsupported miss;
 *   · everything decays with time, and successful spaced retrieval slows the decay.
 *
 * THE CLOCK
 *
 * The engine's spacing schedule is measured in real elapsed time, so every
 * learner here carries a virtual wall clock that the engine reads through
 * `setClock`. It advances by exactly the seconds `itemSeconds` charges for the
 * item just served — the same clock the router plans against and the same one
 * the minutes columns are printed from — and, for the cohorts that come back
 * across days, it jumps by the gap between sittings. That is what makes the
 * question "does this knowledge survive a night?" answerable here at all:
 * under the old attempt-counted schedule the whole retention ladder could be
 * climbed inside one unbroken sitting, and the simulation could not tell the
 * difference because neither could the engine.
 *
 * Between sittings, and only between them, a second forgetting term applies:
 * a power law in the gap, slowed by every re-probe that line has already
 * survived (`GAP_POW`, `GAP_HOURS`). The within-sitting decay is untouched, so
 * every single-sitting figure below is still measured on the byte-identical
 * learner model that produced the numbers this build is held against.
 *
 * The one thing this file refuses to assume is the difficulty ladder. Older
 * versions hard-coded DEMAND(d) = 0.18 + 0.12d, which quietly *assumed* that a
 * band-5 item is harder than a band-3 one. Here the demand of every (skill,
 * band) pair is **measured off the real generated bank** with
 * `generators.demandOf()` before a single learner is run, and printed, so the
 * ladder the simulation believes in is the ladder the game actually ships.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MasteryEngine, itemSeconds, ITEM_SECONDS, MASTERY_DEFAULTS as DEFAULT_MASTERY } from '../src/learn/mastery.js';
import { FORMS_BY_SKILL, generate, demandOf } from '../src/learn/generators.js';
import { echoScript } from '../src/learn/echo.js';
// The REAL session planner, so the workload assertion below is about the plan
// the orders card is actually built from and not a restatement of it.
import { planRun } from '../src/session/estimate.js';
import enItems from '../content/lang/items.en.js';
import { allUnits, loadUnit, loadCourse, standalone } from './_courses.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * WHICH LATTICE IS BEING SIMULATED.
 *
 * The default is Algebra I Level 1 and nothing about it has changed: same
 * graph, same ten nodes, same numbers. `--unit <id>` runs any unit in
 * content/courses.json and `--course <id>` runs a whole course composed into
 * one lattice, so a new course is proved by the same simulation rather than by
 * a second one written to flatter it. Everything below reads the graph; nothing
 * below names a course.
 */
const argOf = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const WANT_UNIT = argOf('--unit');
const WANT_COURSE = argOf('--course');

/**
 * THE TWO POSITIONAL ARGUMENTS ARE POSITIONAL AMONG THEMSELVES, NOT IN argv.
 *
 * `LEARNERS` was `Number(process.argv[2])`, so `node tools/simulate.mjs --unit
 * algebra1-l4` read the flag itself as the cohort size, got NaN, ran zero
 * learners and then died in the quintile table on `slice[0].theta` of an empty
 * array. The published invocation in this file's own header — `node
 * tools/simulate.mjs [learners] [budget]` — put them first, so anyone who
 * reached for `--unit` the obvious way got a stack trace instead of a run, and
 * the quadratics unit had no mastery evidence at all for that reason.
 *
 * So the numbers are picked out of argv by being numbers, wherever they sit,
 * and the flags and their values are stepped over.
 */
const NUMS = (() => {
  const out = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { if (!/^--(self-test|verbose)$/.test(a)) i++; continue; }
    if (/^\d+$/.test(a)) out.push(Number(a));
  }
  return out;
})();

let graph;
let LATTICE = 'Algebra I Level 1';
/**
 * Skills the lattice under test STANDS ON but does not contain.
 *
 * A unit loaded on its own has its cross-unit prerequisites pruned — see
 * `pruneDangling` in src/content/index.js, which reads a dropped edge as "you
 * are starting here", i.e. the earlier units are already held. The invariants
 * below have to read it the same way, or every unit after Level 1 reports
 * thousands of false violations for using a rule its own manifest entry says
 * comes before it. `requires` in content/courses.json is that statement.
 */
let PRIOR = new Set();
/**
 * `--units a,b` composes exactly those units into one lattice.
 *
 * It exists because the shipped route composes a SUBSET of a course: a region
 * opens only once every line of the one before it is held
 * (src/content/route.js), so what a learner actually plays is never one unit
 * and rarely the whole course. Neither existing flag can express that, and the
 * difference is not cosmetic — Level 2 measured with `--unit` has its
 * cross-unit prerequisites pruned, which models a learner walking into it with
 * no Level 1 behind them, the one condition the route makes impossible. That
 * reading is 68.0% true mastery. The same lattice composed with Level 1 under
 * it reads 88.3%.
 */
const WANT_UNITS = argOf('--units');
if (WANT_UNITS) {
  const want = WANT_UNITS.split(',').map((x) => x.trim()).filter(Boolean);
  const units = await allUnits();
  const gs = [];
  for (const id of want) {
    const pick = units.find((u) => u.unit.id === id);
    if (!pick) throw new Error(`no unit "${id}"`);
    gs.push(await loadUnit(pick.unit));
  }
  const head = gs[0];
  const nodes = gs.flatMap((g) => g.nodes);
  const ids = new Set(nodes.map((n) => n.id));
  const common = new Map();
  for (const g of gs) for (const m of g.commonMisconceptions || []) common.set(m.id, m);
  graph = { ...head, id: want.join('+'), nodes: nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => ids.has(p)) })), commonMisconceptions: [...common.values()] };
  LATTICE = `units ${want.join(' + ')}`;
  // …and whatever these units stand on but do not contain, for the same reason
  // the single-unit branch below builds it: a pruned edge means "already held",
  // and without it every use of a prior rule reads as a violation.
  const byId = new Map(units.map((u) => [u.unit.id, u.unit]));
  const seen = new Set(want);
  const walk = async (id) => {
    for (const req of byId.get(id)?.requires || []) {
      if (seen.has(req)) continue;
      seen.add(req);
      const g = await loadUnit(byId.get(req));
      for (const n of g.nodes) PRIOR.add(n.id);
      await walk(req);
    }
  };
  for (const id of want) await walk(id);
} else if (WANT_COURSE) {
  graph = await loadCourse(WANT_COURSE);
  LATTICE = `course ${WANT_COURSE}`;
} else {
  const units = await allUnits();
  const pick = units.find((u) => u.unit.id === (WANT_UNIT || 'algebra1-l1'));
  if (!pick) throw new Error(`no unit "${WANT_UNIT}" in content/courses.json`);
  graph = standalone(await loadUnit(pick.unit));
  LATTICE = WANT_UNIT ? `unit ${WANT_UNIT}` : 'Algebra I Level 1';
  const byId = new Map(units.map((u) => [u.unit.id, u.unit]));
  const seen = new Set();
  const walkRequires = async (id) => {
    for (const req of byId.get(id)?.requires || []) {
      if (seen.has(req)) continue;
      seen.add(req);
      const g = await loadUnit(byId.get(req));
      for (const n of g.nodes) PRIOR.add(n.id);
      await walkRequires(req);
    }
  };
  await walkRequires(pick.unit.id);
}

/** The skills of the lattice under test — read off the graph, never hardcoded. */
const SKILLS = graph.nodes.map((n) => n.id);

const LEARNERS = NUMS[0] || 2000;
const BUDGET = NUMS[1] || 800;
/**
 * Where the growth-of-mastery table takes its readings.
 *
 * This was the fixed list below, filtered to the budget — so a 3,600-item run
 * reported growth at 150 … 1000 and stopped, and the shipped route's whole
 * growth table read `0.0 0.0 0.0 0.0 0.7 11.7` with the remaining 72% of the
 * run off the right-hand edge. A table whose last row is 11.7% under a headline
 * of 97.0% is not a table anybody can read. Level 1's budget is 800, so its
 * readings are byte-identical to the ones this build was judged on; anything
 * larger gets six evenly spaced readings across its own budget.
 */
const CHECKPOINTS = (BUDGET <= 1000
  ? [150, 300, 450, 600, 800, 1000]
  : [1, 2, 3, 4, 5, 6].map((i) => Math.round((i * BUDGET) / 6))
).filter((c) => c <= BUDGET);

// --- competence thresholds ------------------------------------------------
const TRUE_MASTERY = 0.85;   // hidden competence that counts as "really knows it"
// 9 of 10 on Level 1 — the level is mastered, not every atom perfect. Stated as
// a proportion so a lattice of a different size gets the same standard.
const SKILLS_NEEDED = Math.max(1, Math.round(0.9 * graph.nodes.length));
const HOLLOW = 0.75;         // engine says mastered but truth is below this

// ---------------------------------------------------------------------------
// THE INVARIANTS — asserted on every item and every claim of every cohort.
//
// Everything else in this file is a measurement. These four are not: they are
// statements the product makes about itself, and a run in which any of them is
// non-zero is a run that must not ship, whatever the headline says. They exist
// because all four were violated at once in one live session that a cold reader
// opened and read out:
//
//   HOLLOW-FORM    "Reading a variable — HELD — 99%" with
//                  formsSeen['vm-table'] = {seen: 3, correct: 0}. A line was
//                  certified on a question type it had asked and
//                  never once had answered. Every gate in the engine was an
//                  aggregate, so the strong types carried the weak one.
//   LOCKED-SERVE   item 12 of that session was the distributive property while
//                  the same session's report listed the distributive property
//                  as LOCKED. Prerequisite order is invariant 5 of the brief.
//   PREREQ-CONTENT the item that did it was `2(2m+13) + 2(6m+10)`, served on
//                  `like-terms`, whose own worked step read "double each side" —
//                  the distributive property, which stands DOWNSTREAM of
//                  like-terms in the graph. Routing was not the only way to
//                  break the order; the bank could break it from inside a
//                  legally-served item.
//   WORKLOAD       the orders card promised "seal 16 rifts" over a projection
//                  that had planned 24 items. Both numbers were right and only
//                  the flattering one was on screen.
//
// Each counts violations across every learner run below and prints the count.
// Zero is the only passing value and the file says so in those words.
// ---------------------------------------------------------------------------
const VIOLATIONS = {
  hollowForm: 0,   // a claim granted with a served form standing at 0-for-formFloor
  hollowServed: 0, // a claim granted with ANY served form standing at 0 clean solves
  lockedServe: 0,  // an item served from a skill whose prerequisites are not held
  prereqContent: 0, // an item needing a rule that sits above its own skill in the graph
  workload: 0,     // a goal quoted outside the workload the same projection planned
  confidence: 0,   // a reported confidence above the honest lower bound
  reloadGrant: 0,  // a save/load round trip that HANDED OUT a claim the file did not hold
};
const FIRST = {};
const violate = (kind, detail) => { VIOLATIONS[kind]++; FIRST[kind] ??= detail; };
/**
 * Items served on a line the learner HAS proved, whose ground has since reopened
 * under it. Legitimate — the claim was granted in order and this is retention on
 * work already done — but counted and printed rather than left invisible, because
 * "legitimate" is exactly the word the nine items in the original defect hid behind.
 */
let underReopened = 0;

/**
 * The form floor, read off the ENGINE'S OWN default rather than restated here.
 *
 * It used to be `(graph.mastery||{}).formFloor ?? 3` — a second copy of a
 * number that lives in `src/learn/mastery.js`, and the graph does not set it.
 * So the audit hardcoded 3 while the gate could have been anything, and the
 * printed line "must stay 0" was measuring a threshold the engine no longer
 * used. A gate and its audit may not keep separate copies of the same constant.
 */
const FORM_FLOOR = (graph.mastery || {}).formFloor ?? DEFAULT_MASTERY.formFloor;
const FORM_NEED = (graph.mastery || {}).formNeed ?? DEFAULT_MASTERY.formNeed;

/**
 * THE STRICTER FLOOR — the one the product actually promises.
 *
 * A cold critic photographed a single card that both made and refuted the
 * claim: `var-meaning` reading **HELD — 67%**, with HELD glossed in-world as
 * "proved for good, never opens again", and three lines further down the same
 * card admitting *"Your weakest so far is symbols: 0 right with no help, out of
 * 1 asked"* and *"No question has been asked on this line since the claim was
 * granted."*
 *
 * Every gate in this build passed that card. `FORM_FLOOR` was 3, the failed
 * shape had been asked **once**, and one is less than three — so the shape was
 * not a hole, the claim was granted, the line was sealed, and the one question
 * type the learner got wrong was never asked again. The audit could not see it
 * either, because the audit was measuring 0-of-3 as well.
 *
 * The honest statement is not "0 of 3". It is: **a claim may not be granted
 * while a question type this learner has actually been served stands at zero
 * clean unassisted solves.** One is the only defensible floor, because one
 * failed question that is never re-asked is exactly the evidence a hollow
 * claim is made of, and the sample size that makes it "thin" is the engine's
 * own choice of what to serve — the learner does not get to be certified on a
 * question the engine asked once, got wrong, and then declined to repeat.
 *
 * This constant is what the audit judges by, whatever the gate is set to, so
 * that loosening the gate can never quietly loosen the measurement of it.
 */
const SERVED_FLOOR = 1;

/**
 * Question types this learner has been ASKED `FORM_FLOOR` times and has never
 * once solved unaided — read straight off the engine's raw counters rather than
 * through `engine.weakForms`.
 *
 * The distinction is the whole point of the A/B. `weakForms` honours
 * `engine.cfg.formFloor`, so `CFG=formFloor=0` — the arm that restores the gate
 * exactly as it shipped when the defect was found — would make the engine's own
 * answer vacuously empty and the measurement would flatter the very build it is
 * supposed to indict. The audit has to be able to see a hole that the gate has
 * been told to ignore, or it is not an audit.
 *
 * `items` and not `seen`: a missed question is re-offered with the worked step
 * showing and reports again, so `seen` counts attempts. Older records that
 * predate `items` fall back to `seen`, which is the conservative reading.
 */
function holesOf(st, floor = FORM_FLOOR) {
  const out = [];
  for (const [fid, rec] of Object.entries(st?.formsSeen || {})) {
    const asked = rec?.items ?? rec?.seen ?? 0;
    if (asked >= floor && (rec?.correct || 0) < FORM_NEED) out.push(fid);
  }
  return out;
}

/**
 * The same question asked at the stricter floor: every question type this
 * learner was SERVED and has never once solved unaided, however few times it
 * came up. This is the list the critic's card was holding — one entry, `symbols`,
 * asked once, never got — and the list every gate in the build was blind to.
 */
const servedHoles = (st) => holesOf(st, SERVED_FLOOR);

/**
 * Every skill at or below `id` — what an item on `id` may use.
 *
 * `PRIOR` is in every cone. A unit loaded on its own drops the prerequisites
 * that live in the units it `requires`, so on the graph alone `distribute` —
 * a Level 1 line — sits nowhere at all, and the prerequisite-content invariant
 * below read that as "above". Measured: Level 4 standalone reported 4,919
 * violations, every one of them a product of two binomials on a factoring node,
 * and the composed course reported 96 of a completely different kind. A unit
 * standing on Level 1 is not using a rule it has not met; it is using a rule
 * the manifest says it starts after.
 */
const CONE = new Map();
{
  const prereqs = new Map(graph.nodes.map((n) => [n.id, n.prereqs || []]));
  const walk = (id, out) => {
    for (const p of prereqs.get(id) || []) if (!out.has(p)) { out.add(p); walk(p, out); }
    return out;
  };
  for (const n of graph.nodes) CONE.set(n.id, walk(n.id, new Set([n.id, ...PRIOR])));
}

/**
 * Does this expression require the learner to distribute?
 *
 * Not "does it contain a bracket" — `6(8 + 5 · 2)` is order of operations and
 * `7(4m)` is one multiplication. Distribution is specifically *something
 * multiplying a bracketed sum that contains a letter*, and that is what this
 * looks for: a bracket with a variable and a `+` or `-` in it, with a number, a
 * letter or a closing bracket immediately in front of it.
 *
 * LaTeX control words are stripped first, or `\cdot` reads as four variables.
 */
/**
 * The single letters this expression uses as a function name: defined by being
 * applied to a bracket on the left of an `=`, and applied at least twice.
 */
function fnNames(s) {
  const names = new Set();
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '(') continue;
    let j = i - 1;
    while (j >= 0 && /\s/.test(s[j])) j--;
    if (j < 0 || !/[a-zA-Z]/.test(s[j])) continue;          // no name in front
    let k = j - 1;
    while (k >= 0 && /\s/.test(s[k])) k--;
    if (k >= 0 && /[0-9a-zA-Z.)]/.test(s[k])) continue;     // a factor, not a name
    let depth = 0, end = -1;
    for (let m = i; m < s.length; m++) {
      if (s[m] === '(') depth++;
      else if (s[m] === ')') { depth--; if (!depth) { end = m; break; } }
    }
    if (end < 0) continue;
    let a = end + 1;
    while (a < s.length && /\s/.test(s[a])) a++;
    if (s[a] !== '=') continue;                             // not a definition
    const n = s[j];
    const applied = (s.match(new RegExp(`${n}\\s*\\(`, 'g')) || []).length;
    if (applied >= 2) names.add(n);                         // …and applied again
  }
  return names;
}

function needsDistribution(latex) {
  const s = String(latex || '')
    .replace(/\\left/g, '(').replace(/\\right/g, ')').replace(/\\[a-zA-Z]+/g, ' ');
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '(') continue;
    let j = i - 1;
    while (j >= 0 && /\s/.test(s[j])) j--;
    if (j < 0 || !/[0-9a-zA-Z)]/.test(s[j])) continue;   // nothing multiplies it
    // FUNCTION APPLICATION IS NOT AN IMPLIED PRODUCT, and reading it as one is
    // an assertion that is mathematically false. `f(n-1)` in a recursive rule —
    // `f(1) = 8; f(n) = f(n-1) + 5` — was reported as needing the distributive
    // property; "distributing" it would give `f·n − f`, which no function obeys.
    // Ninety-six of the ninety-six violations the composed Algebra I course
    // reported were that one expression.
    //
    // The test is deliberately narrow, because `x(2x + 5)` really is a product
    // and must stay caught. A name is read as a function only when the SAME
    // expression both DEFINES it — `f(…) =` — and APPLIES it more than once,
    // which is the shape a recursive rule cannot avoid and a coefficient cannot
    // reach: `x(2x + 5) = 20` defines nothing and applies `x(` exactly once.
    if (/[a-zA-Z]/.test(s[j]) && fnNames(s).has(s[j])) continue;
    let depth = 0, end = -1;
    for (let k = i; k < s.length; k++) {
      if (s[k] === '(') depth++;
      else if (s[k] === ')') { depth--; if (!depth) { end = k; break; } }
    }
    if (end < 0) continue;
    const inner = s.slice(i + 1, end);
    if (!/[a-zA-Z]/.test(inner)) continue;                // purely numeric
    if (!/[+\-]/.test(inner.replace(/^\s*-/, ''))) continue; // a single term
    return s.slice(Math.max(0, j), end + 1);
  }
  return null;
}

/**
 * The competence a learner actually has ON ONE SURFACE, which is the thing the
 * engine's aggregate could not see.
 *
 * The learner model already charges an unfamiliar representation real accuracy
 * (`novelty` in the item loop) and then relaxes that charge as exposures build.
 * That penalty is a fact about the simulated learner, not about the engine, so
 * it is exactly the right thing to judge a per-surface claim against: a learner
 * at hidden competence 0.90 who has never once solved a table reads 0.90 on the
 * aggregate and 0.765 on the surface they are being certified on.
 */
const surfaceTruth = (k, exposures) => k * (1 - 0.15 * Math.exp(-0.7 * exposures));

// ---------------------------------------------------------------------------
// The difficulty ladder, measured off the shipping item bank.
// ---------------------------------------------------------------------------
const SAMPLES = Number(process.env.LADDER_SAMPLES || 400);
const RAW = {};
let lo = Infinity, hi = -Infinity;
for (const s of SKILLS) {
  RAW[s] = [];
  for (let d = 1; d <= 5; d++) {
    let sum = 0, n = 0;
    for (let i = 0; i < SAMPLES; i++) {
      try { sum += demandOf(generate(s, d, (i * 104729 + d * 7919 + s.length * 31) >>> 0)); n++; } catch { /* skip */ }
    }
    const m = n ? sum / n : 0;
    RAW[s][d - 1] = m;
    lo = Math.min(lo, m); hi = Math.max(hi, m);
  }
}
// Map the measured spread onto the response scale. The *shape* is the bank's,
// not this file's: the only free parameters are the two endpoints.
const DEMAND_LO = 0.22, DEMAND_HI = 0.84;
const DEMAND = {};
for (const s of SKILLS) {
  DEMAND[s] = RAW[s].map((m) => DEMAND_LO + (DEMAND_HI - DEMAND_LO) * (m - lo) / Math.max(1e-9, hi - lo));
}
const ladderBroken = SKILLS.filter((s) => RAW[s].some((m, i) => i > 0 && m <= RAW[s][i - 1]));

// ---------------------------------------------------------------------------
// How often a miss is actually answered with mathematics.
//
// The literature's large effect for "error followed by elaborated feedback" is
// an effect of the *feedback*, not of the error. Assuming every wrong answer in
// this game earns it would be assuming the thing this project most needs to
// prove, so the rate is measured off the shipping bank instead: for every item
// form, the tagged wrong values that form can produce are pushed through the
// real `echoScript` at depth one, and the share that come back with a probe —
// a computed counterexample, an implied input, a rate that breaks, a claim
// refuted by a single number — rather than with the prompt restated is what the
// simulation uses as the probability of the elaborated-feedback gain. A miss
// that would only be handed the question back gets the weaker studied-example
// gain instead. Content quality therefore moves this file's headline number,
// which is the only arrangement under which the number means anything.
// ---------------------------------------------------------------------------
const restatement = enItems['echo.theTear'];
const nrm = (t) => String(t).replace(/\s+/g, '');
const FEEDBACK = {};
let fbHit = 0, fbAll = 0;
for (const s of SKILLS) {
  for (const f of FORMS_BY_SKILL[s]) {
    let hit = 0, all = 0;
    for (let d = f.dMin; d <= f.dMax; d++) {
      for (let i = 0; i < 3; i++) {
        let item;
        try { item = generate(s, d, (i * 2654435761 + d * 40503 + s.length * 7919) >>> 0, { form: f.id }); }
        catch { continue; }
        for (const dg of (item.diagnostics || []).slice(0, 4)) {
          const rows = echoScript({ item, analogue: null, entry: dg.value, tier: 1 }).rows.filter((r) => r.latex);
          all++;
          const bare = rows.length === 1 && nrm(rows[0].latex) === nrm(item.latex) && rows[0].why === restatement;
          if (!bare) hit++;
        }
      }
    }
    FEEDBACK[`${s}/${f.id}`] = all ? hit / all : 0;
    fbHit += hit; fbAll += all;
  }
}
const FEEDBACK_RATE = fbAll ? fbHit / fbAll : 0;

// --- learner model constants ---------------------------------------------
const SHARPNESS = 6.0;
const SLIP = 0.06;                          // inattention, independent of knowing
const STICKY_RATE = 0.35;                   // learners carrying one resistant misconception
const GAIN = {
  studyExample: 0.26,   // read a complete worked analogue
  completion: 0.30,     // finish a worked analogue whose last line is missing
  errorFeedback: 0.42,  // got it wrong, then saw the line that addresses the error
  assistedWin: 0.30,    // got there with support
  cleanWin: 0.24,       // got there alone
  retrieval: 0.26,      // successful spaced retrieval — the testing effect
};
const DECAY = 0.0018;
/**
 * Forgetting across a break, and only across a break.
 *
 * Two facts from the retention literature, and nothing else:
 *
 *   · forgetting of meaningful material is a **power law** in elapsed time, not
 *     the exponential that fits nonsense syllables, and successful spaced
 *     retrieval flattens it;
 *   · it does not run to zero. Skills learned to a criterion leave a floor
 *     behind them — Bahrick's permastore — which is why an adult who has not
 *     touched algebra in a decade is slow rather than helpless, and why
 *     relearning is far cheaper than learning.
 *
 * So a gap of `h` hours on a line of stability `S` whose competence ever
 * reached `peak` leaves
 *
 *      floor = PERMA * peak
 *      k  <-  floor + (k - floor) * (1 + h / (GAP_HOURS * S)) ^ -GAP_POW
 *
 * At stability 1 — a line proved once and never re-probed since — a night costs
 * about 9% of a 0.95 competence, a week about 20%, a month about 28%. After
 * three survived spaced re-probes (S = 3.1) the same night costs about 3%.
 * `stability` grows by 0.7 with each successful *spaced* retrieval and by
 * nothing else, which is the testing effect doing the only job it is credited
 * with here.
 *
 * These numbers move the day-spanning cohort a lot, so the sensitivity of the
 * headline to both constants is printed rather than argued: see the table under
 * "coming back across days".
 *
 * This term does not exist inside a sitting. The per-item `DECAY` above is an
 * interference cost of working, not a clock, and it is left untouched — so
 * every single-sitting figure in this file is still measured on the
 * byte-identical learner model that produced the numbers this build is held
 * against.
 */
const GAP_POW = Number(process.env.SIM_GAP_POW || 0.35);
const PERMA = Number(process.env.SIM_PERMA || 0.60);
const GAP_HOURS = 24;
/**
 * What one survived, genuinely spaced re-probe does to durable strength.
 *
 * 2.5, multiplicatively, which is the same order the engine's own ladder
 * expands by (10 minutes, a day, three days, eight days, three weeks). The two
 * have to grow together or the schedule is mis-specified by construction: a
 * memory whose strength grew by a constant while the intervals tripled would be
 * asked for less and less reliable recall at every rung, and the expanding
 * schedule — the thing every spaced-retrieval system in the world is built on —
 * would be a mistake rather than a design.
 */
const GAP_GROWTH = Number(process.env.SIM_GROWTH || 2.5);
/** A sitting, and the wait between two of them. Minutes / hours. */
const SESSION_MINUTES = Number(process.env.SIM_SESSION || 22);
const SESSION_GAP_HOURS = Number(process.env.SIM_GAP || 24);
const HOUR = 3600e3;

/** Monday, 09:00. Every simulated learner's first item lands here. */
const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);

const REP_OF = {};
for (const s of SKILLS) for (const f of FORMS_BY_SKILL[s]) REP_OF[`${s}/${f.id}`] = f.rep;

// ---------------------------------------------------------------------------
// The situations each form can be dressed in.
//
// The simulation does not render items, so it cannot read a scene off one. It
// reads the bank's *capacity* instead: every form is sampled until its deck of
// framings stops producing new ones, and a served item is then modelled as a
// uniform draw from that deck, honouring whatever the scheduler asked to avoid.
// That is the same distribution the running game produces, and it is what lets
// the transfer figures below be about situations rather than about templates.
// ---------------------------------------------------------------------------
const SCENES = {};
for (const s of SKILLS) {
  for (const f of FORMS_BY_SKILL[s]) {
    const found = new Set();
    for (let i = 0; i < 48; i++) {
      const d = f.dMin + (i % (f.dMax - f.dMin + 1));
      try {
        const it = generate(s, d, (i * 1103515245 + 12345 + s.length * 31) >>> 0, { form: f.id });
        if (it.scene) found.add(it.scene);
      } catch { /* a seed that will not build tells us nothing about framings */ }
    }
    SCENES[`${s}/${f.id}`] = [...found];
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd) => {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp = (x, lo2, hi2) => Math.max(lo2, Math.min(hi2, x));

/**
 * Is the proving run actually a transfer test?
 *
 * The gate claims three things about itself: that it draws item forms this
 * learner has *not* been drilled on, that it spans more than one
 * representation, and that at least one of its items asks the learner to walk
 * between a situation and the algebra. Those are claims about what happens to
 * real learners over a real run, not about the code that intends them, so they
 * are counted here on the shipping policy and printed with everything else. A
 * gate that quietly stopped meeting them would still produce a good mastery
 * number, which is exactly why it gets its own line.
 */
const XFER = { items: 0, unseen: 0, runs: 0, withUnseen: 0, twoReps: 0, modelled: 0,
  passed: 0, passedUnseen: 0, passedTwoReps: 0, passedModelled: 0 };
const MODELLING = new Set(['context', 'verbal']);
function closeRun(cur) {
  XFER.runs++;
  if (cur.unseen) XFER.withUnseen++;
  if (cur.reps.size >= 2) XFER.twoReps++;
  if (cur.model) XFER.modelled++;
  // Runs that *ended in a mastery claim*, counted separately. The rates above
  // are over every run the engine started, so they move with how many runs get
  // abandoned — which is a fact about how hard the gate is, not about whether
  // the claims it does make are transfer claims. These are the ones that
  // actually stand behind a claim, and they are the ones that must not slip.
  if (!cur.passed) return;
  XFER.passed++;
  if (cur.unseen) XFER.passedUnseen++;
  if (cur.reps.size >= 2) XFER.passedTwoReps++;
  if (cur.model) XFER.passedModelled++;
}

/**
 * @param {number} seed
 * @param {'engine'|'null'|'worst'} policy which scheduler chooses the next item
 *
 * The control arms exist because "94% reach mastery" is not, on its own, a
 * claim about the engine — it could be a claim about a generous learner model.
 * So the learner model is held byte-for-byte fixed and only the choosing
 * policy is swapped: `null` picks a random skill at a random band with no
 * prerequisite gate and no scaffold, `worst` serves the hardest band from the
 * first minute. Same seeds, same decay, same everything else. If those arms
 * also reached mastery, this file would be measuring nothing.
 */
/**
 * @param {object} [opts]
 * @param {(skill:string)=>number|null} [opts.knows] hidden competence to start a
 *   skill at, for the cohorts who already know some or all of this. Returning
 *   null leaves the ordinary cold start alone. A learner who *knows* algebra has
 *   also met tables, graphs and word problems before, so a seeded skill starts
 *   with its representations familiar too — otherwise the cohort would be
 *   measuring surface shock rather than knowledge.
 * @param {number} [opts.budget] items this learner is given
 * @param {boolean} [opts.record] whether this run feeds the transfer counters
 */
function runLearner(seed, policy = 'engine', opts = {}) {
  const budget = opts.budget || BUDGET;
  const record = opts.record ?? (policy === 'engine');
  const rnd = mulberry(seed);
  const theta = clamp(gauss(rnd), -2.5, 2.5);
  const lr = 0.12 + 0.18 * sigmoid(theta * 1.1);

  // A third of learners carry one misconception that genuinely resists teaching:
  // on that skill they learn at half rate and make errors they would not make
  // elsewhere. Without this, no simulation of this kind is honest.
  let sticky = rnd() < STICKY_RATE ? SKILLS[Math.floor(rnd() * SKILLS.length)] : null;
  const rateFor = (s) => (s === sticky ? lr * 0.5 : lr);

  /* THE ENGINE IS REBUILT BETWEEN SITTINGS, THE WAY THE PRODUCT REBUILDS IT.
     `let`, not `const`, and everything that configures it lives in `configure`
     below so a reloaded engine gets the identical treatment.

     This file kept ONE engine object across all twenty-five simulated sittings
     and never called `save()` or `load()`. The product does the opposite: it
     serialises to localStorage and constructs a new MasteryEngine from that
     file on EVERY visit. That is not a detail of plumbing — `load()` withdraws
     any claim standing over a question type never once solved unaided, so a
     line held at the end of one sitting can be open again at the start of the
     next. No number this file has ever printed included that effect, which
     means every retention figure was measured on an engine the learner does
     not have. See `reload()` at the sitting boundary. */
  // --- this learner's wall clock -------------------------------------------
  // Every learner starts on the same Monday morning and is offset by their own
  // seed, so two learners are never lock-stepped through the schedule. The
  // engine reads this and nothing else for anything to do with retention.
  let vnow = T0 + (seed % 977) * 37_000;
  /**
   * Everything that is done to an engine before it is played, in one place so
   * that the engine built at the start of sitting two is the same machine as
   * the one built at the start of sitting one. A dial applied only to the
   * first engine is an ablation that quietly stops half way through the run.
   */
  const configure = (e) => {
  e.setClock(() => vnow);
  if (opts.legacyRouter) e.policy = 'lowest-pL';
  // Ablation switches. Every claim this file makes about a mechanism was
  // arrived at by turning that mechanism off and running the identical seeds:
  //   AB_ROUTER=lowest-pL   the router this replaced
  //   AB_NOSIGHT=1          no sight-read: every skill is taught from scratch
  //   AB_NOFAST=1           only the long road (pL 0.95, three clean) opens a run
  //   AB_NOCREDIT=1         a clean solve credits nothing to its prerequisites
  //   AB_NOSEED=1           a new skill opens on BKT's constant pInit
  //   AB_SRBAND=4|5  AB_SREXTRA=0|1   the two dials on the fast route
  if (process.env.AB_ROUTER) e.policy = process.env.AB_ROUTER;
  if (process.env.AB_NOSIGHT) e.cfg.sightRead = false;
  if (process.env.AB_NOFAST) { e.cfg.fastPL = 9; e.cfg.fastRun = 99; }
  if (process.env.AB_NOCREDIT) e.creditParents = () => {};
  if (process.env.AB_NOSEED) e.seedPL = (id) => (e.node(id)?.bkt?.pInit ?? 0.25);
  if (process.env.AB_SRBAND) e.cfg.sightReadBand = Number(process.env.AB_SRBAND);
  if (process.env.AB_SREXTRA) e.cfg.sightReadExtra = Number(process.env.AB_SREXTRA);
  //   AB_NODEBT=1           the gate forgets: every run asks for the same three
  //   AB_NOCAP=1            the sight-read is pinned to the band ordinal again
  //   AB_SLOWCLIMB=1        three clean solves per band step, everywhere
  //
  // The three dials the test-out tail was cut with, all off in one line:
  //   CFG=gateDemandFloor=0,steadyFloor=0,gateMissLimit=1,gateRunCap=99
  // reproduces the engine as it stood before that work, to the decimal, on
  // every figure this file prints. Individually:
  //   gateDemandFloor=0   the gate floor is the band ordinal again, so the one
  //                       skill whose whole ladder sits above the level keeps a
  //                       gate no other skill in the level can match
  //   steadyFloor=0       a missed sight-read drops a knower back to the
  //                       placement band and the taught walk back up
  //   gateMissLimit=1,gateRunCap=99   a run ends on the second miss however
  //                       close to the bar it already was
  if (process.env.AB_NODEBT) e.cfg.gateDebtCap = 0;
  if (process.env.AB_NOCAP) {
    e.sightReadBandFor = () => Math.max(e.cfg.checkMinDifficulty, e.cfg.sightReadBand);
  }
  if (process.env.AB_SLOWCLIMB) e.cfg.fastClimb = false;
  //   CFG=k=v,k=v         drive any numeric dial in DEFAULT_MASTERY from
  //                       outside, so a candidate setting is graded by this
  //                       file before it is written into the e.
  if (process.env.CFG) {
    for (const pair of process.env.CFG.split(',')) {
      const [k2, v2] = pair.split('=');
      e.cfg[k2.trim()] = Number(v2);
    }
  }
  //   AB_ATTEMPTS=1         the schedule this replaced: spacing counted in
  //                         attempts of separation [3, 8, 20, 48] and nothing
  //                         else, so the whole retention ladder is climbable
  //                         inside one unbroken sitting. It is the arm that
  //                         says what the fix costs.
  //   SIM_MINUTES=a,b,c,..  drive the shipping spacing ladder from outside, so
  //                         a candidate schedule can be graded before it ships.
  if (process.env.SIM_MINUTES) {
    e.cfg.reviewMinutes = process.env.SIM_MINUTES.split(',').map(Number);
  }
  if (process.env.AB_ATTEMPTS) {
    e.cfg.reviewMinutes = [0, 0, 0, 0];
    e.cfg.reviewFloor = [3, 8, 20, 48];
    e.cfg.durableMinutes = 0;
  }
  };

  let engine = new MasteryEngine(graph);
  configure(engine);

  /**
   * SHUT THE LAPTOP AND OPEN IT AGAIN.
   *
   * The product's own round trip: `save()` writes the record, and the next
   * visit constructs a fresh MasteryEngine from that file. It is not a copy —
   * `load()` is where a claim granted over a shape never once solved unaided is
   * WITHDRAWN, and where a held line's next re-probe comes back due. Doing it
   * here is what makes every number below a statement about the engine a
   * learner actually reloads, rather than about one long-lived object no
   * player has ever had.
   *
   * `JSON.parse(JSON.stringify(...))` on purpose: the file really does go
   * through a string, so a field that does not survive serialisation must not
   * survive here either.
   */
  const reload = (e) => {
    const back = new MasteryEngine(graph, JSON.parse(JSON.stringify(e.save())));
    configure(back);
    return back;
  };
  const k = new Map();              // hidden competence, invisible to the engine
  const repSeen = new Map();        // skill -> rep -> successful exposures
  const stability = new Map();      // grows with each survived spaced review
  /**
   * Durable memory strength — how flat this line's forgetting curve has become.
   *
   * It is separate from `stability` above, which damps the per-item
   * interference cost of working, and it moves on exactly one event: a spaced
   * re-probe passed after a real walk away from the machine. It moves
   * *multiplicatively*, by `GAP_GROWTH`, because that is the assumption an
   * expanding schedule is built on and the one it must be graded against: if
   * strength grew by a constant while the intervals tripled, retention at the
   * moment of review would fall with every rung and the schedule would be
   * mis-specified by construction. Growing them together is what makes
   * retention-at-review roughly constant, which is what an expanding schedule
   * is *for*.
   */
  const strength = new Map();
  for (const s of SKILLS) {
    // The rnd() draw happens for every cohort, in the same order, so that a
    // seeded learner is the ordinary learner of that seed with some knowledge
    // already in place — not a different random walk.
    k.set(s, clamp(0.10 + 0.10 * sigmoid(theta) + 0.06 * rnd(), 0, 0.4));
    repSeen.set(s, {});
    stability.set(s, 1);
    strength.set(s, 1);
  }
  // A psychometric probe for ONE skill. The classifier table below can only
  // read the first skill a frozen learner meets — a root — so a change to a
  // gate deep in the lattice is invisible to it. This marks every other line
  // held and never due, so the router has exactly one thing to serve and the
  // same frozen-competence question can be asked of any node in the graph.
  // Diagnostic only; no shipping figure passes through it.
  if (opts.unlock) {
    for (const s of SKILLS) {
      if (s === opts.unlock) continue;
      const st = engine.get(s);
      engine.place(st);
      st.mastered = true; st.everMastered = true; st.probe = null;
      st.masteredAt = 0; st.masteredTime = vnow; st.provedTime = vnow;
      st.dueTime = vnow + 1e13; st.dueAt = 1e9;
    }
  }
  const knownSkills = new Set();
  if (opts.knows) {
    for (const s of SKILLS) {
      const known = opts.knows(s);
      if (known == null) continue;
      knownSkills.add(s);
      k.set(s, known);
      if (s === sticky) sticky = null;
      for (const f of FORMS_BY_SKILL[s]) repSeen.get(s)[f.rep] = 2;
      stability.set(s, 3);
      strength.set(s, 2.5);
    }
  }

  // --- what this run costs, and what it claims -----------------------------
  const spent = new Map(SKILLS.map((s) => [s, { items: 0, seconds: 0 }]));
  const cleared = new Map();        // skill -> {items, seconds} at the first claim
  const claims = [];                // every mastery claim, against the hidden truth
  let seconds = 0;
  // The promise that nothing is routed around: the longest a skill the engine
  // has *not* yet called mastered went without being served, counted from the
  // moment it became servable at all — a skill that has only just opened has not
  // been neglected, and one that is still locked cannot be served.
  const lastTouch = new Map();
  let starve = 0;

  // A frozen learner does not learn and does not forget. That is not a model of
  // a person; it is the only way to measure a *gate*. Ability is held at a known
  // value and the question becomes psychometric: given a student who genuinely
  // sits at 0.70, how often does this engine hand them a mastery claim?
  const frozen = !!opts.frozen;
  // The high-water mark of each skill. Forgetting across a break runs down
  // towards a fraction of it rather than towards zero — see PERMA.
  const peak = new Map(SKILLS.map((s) => [s, k.get(s)]));
  const learn = frozen ? () => {} : (s, weight) => {
    const v = clamp(k.get(s) + rateFor(s) * weight * (1 - k.get(s)), 0, 1);
    k.set(s, v);
    if (v > (peak.get(s) || 0)) peak.set(s, v);
  };
  const trace = [];
  // --- sittings -------------------------------------------------------------
  // Left unset, this learner is one unbroken sitting, which is what every
  // cohort here used to be. Set, they play `sessions` sittings of
  // `sessionMinutes` with `gapHours` between them, and the clock — and the
  // forgetting — knows the difference.
  const sessions = opts.sessions || 0;
  // The two forgetting constants, overridable per learner so the sensitivity of
  // every figure below to them can be printed rather than argued.
  const gpow = opts.gapPow ?? GAP_POW;
  const perma = opts.perma ?? PERMA;
  const sessionCap = (opts.sessionMinutes ?? SESSION_MINUTES) * 60;
  const gapHours = opts.gapHours ?? SESSION_GAP_HOURS;
  /**
   * THE FORGETTING CLOCK, SEPARATED FROM THE SCHEDULING CLOCK.
   *
   * `gapHours` used to be two different things wearing one name. It is how long
   * the learner is away — which the ENGINE reads, through `vnow`, to decide
   * which re-probe has come round, whether a pass counts as durable, and
   * whether a belief has gone stale — and it is also how much MEMORY is lost
   * across that wait, which nothing in the engine can see. Those are two
   * different mechanisms with two different fixes, and while they shared a name
   * the every-third-day figure could not be attributed to either of them: it
   * was the sum of "the scheduler meets a three-day cadence" and "the learner
   * forgets three nights' worth", and nobody could say how much was which.
   *
   * So they are separable now. `decayHours` defaults to `gapHours`, so every
   * figure this file has ever printed is byte-identical; setting it apart runs
   * the 2x2 that says which of the two owns the gap. See the CADENCE PROBE.
   */
  const decayHours = opts.decayHours ?? gapHours;
  /**
   * WHICH FORGETTING LAW, and why this is not a free parameter.
   *
   * `iterated` is what shipped: at every sitting boundary the power law is
   * applied AGAIN to whatever competence is left. Composing a power law with
   * itself is not a power law — `keep(h)^n` is exponential in the number of
   * boundaries — so a line untouched for ten sittings decays as
   * `(1 + h/24S)^(-0.35n)`, which is the exponential curve this file's own
   * header says fits nonsense syllables and does not fit meaningful material.
   *
   * `elapsed` is the law as written: the power law taken ONCE over the real
   * elapsed time since that line was last practised, from the competence it
   * held at that moment. It is the same constants, the same floor and the same
   * strength term; only the composition changes.
   *
   * Both are run and both are printed. `iterated` stays the default because it
   * is what every published figure in this repo was measured on, and because
   * changing the default would silently rewrite numbers other people are
   * holding this build against.
   */
  const decayMode = opts.decayMode || process.env.SIM_LAW || 'iterated';
  // The elapsed-law anchors: when this line was last practised, and what it was
  // worth then. Only read when `decayMode === 'elapsed'`.
  const restK = new Map(SKILLS.map((s) => [s, k.get(s)]));
  const restAt = new Map(SKILLS.map((s) => [s, vnow]));
  const touchedThisSitting = new Set();
  // Claims this learner held and then lost DURING a sitting — a missed re-probe
  // twice over (`lapse`), or a shape that went never-once-solved on a held line
  // (`formFloor`). Counted here rather than inferred from the end state, which
  // can only see the lines that were still down at the buzzer.
  let demotions = 0;
  /* AND WHAT TOOK THEM. Two mechanisms can pull a claim down mid-sitting and
     they have opposite fixes, so one counter for both is the same mistake this
     probe exists to correct one level up: `lapse` (a re-probe missed twice) is
     the SCHEDULE, and the form-floor withdrawal in `observe` (a shape that went
     never-once-solved on a line already held) is the BANK and the descent. */
  const demoBy = { lapse: 0, formFloor: 0 };
  // The re-probe ledger: how many the schedule served, and how many came back
  // right first try with no help — which is the only outcome that moves it.
  let reviewsServed = 0, reviewsClean = 0, lapsesOpened = 0;
  const sessionTrace = [];
  let sitting = 1;
  let sessionSeconds = 0;
  let reviewItems = 0, durableItems = 0, deepItems = 0;
  // Items served on a skill this learner had already mastered, and the worst
  // any single skill took. See the counting block in the loop below.
  let heldItems = 0, heldReview = 0, heldRetrieval = 0, heldDeep = 0, heldOther = 0;
  let heldWorst = 0;
  const heldBySkill = new Map();
  // The same count split by what served the item, so "eleven items on one held
  // skill in one sitting" is attributed to a mechanism rather than argued about.
  const heldByKind = new Map();
  const heldWorstKind = new Map();
  let items = 0;
  /* WHAT THE RELOADS TOOK BACK. Counted because the product does it on every
     visit and nothing here had ever measured it: a claim granted at the end of
     one sitting can be withdrawn at the start of the next, over a question type
     that was never once solved unaided. See `reload()`. */
  let withdrawnOnLoad = 0;
  const withdrawnLines = new Set();
  // Which forms this learner has actually practised, and the run being built.
  const practised = new Map(SKILLS.map((s) => [s, new Set()]));
  const worked = new Map(SKILLS.map((s) => [s, new Set()]));
  const run = new Map();
  let runOf = null;
  // Every surface this skill has actually been SERVED on, whether or not the
  // learner ever got one right. `repSeen` counts solves; the strict hollow test
  // has to know about the ones that were asked and missed, because those are
  // precisely the surfaces a hollow claim is made over.
  const repServed = new Map(SKILLS.map((s) => [s, new Set()]));

  for (let step = 0; step < budget; step++) {
    let task;
    if (policy === 'engine') {
      const objective = engine.next();
      if (!objective) break;
      task = engine.taskFor(objective.id) || {
        skill: objective.id, kind: 'learn', difficulty: 1, scaffold: 'none', formCandidates: [],
      };
    } else {
      task = {
        skill: SKILLS[Math.floor(rnd() * SKILLS.length)],
        kind: 'learn',
        difficulty: policy === 'worst' ? 5 : 1 + Math.floor(rnd() * 5),
        scaffold: 'none',
        formCandidates: [],
      };
    }
    const forms = FORMS_BY_SKILL[task.skill];
    const pool = (task.formCandidates && task.formCandidates.length)
      ? task.formCandidates
      : forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax).map((f) => f.id);
    const form = pool[Math.floor(rnd() * pool.length)] || forms[0].id;
    const rep = REP_OF[`${task.skill}/${form}`] || 'symbolic';
    repServed.get(task.skill).add(rep);
    // --- INVARIANT: nothing is served out of prerequisite order --------------
    // Asked of the REAL engine, on the skill it actually chose, on every item of
    // every cohort — the routing invariant that the scheduler used to enforce in
    // exactly one place (`next()`), which every other door walked past.
    // A line the learner has ALREADY PROVED, standing on ground that has since
    // reopened under it, is not a violation and is counted separately below: the
    // claim was granted in order and re-probing it is retention on work already
    // done. What is forbidden is teaching a line they have never proved and
    // whose prerequisites they do not hold — which is exactly what a cold reader
    // was served as item 12 of a session.
    // …and the standing form-floor invariant, asked of every line on every item
    // rather than only at the moment a claim is made. A hole can open on a line
    // that was proved honestly last week — the endgame descent keeps serving it
    // — and "a line cannot be HELD while a shape of it is never once solved" has
    // no clause about when the hole opened.
    if (policy === 'engine') {
      for (const sk of SKILLS) {
        const st2 = engine.get(sk);
        if (st2?.mastered && holesOf(st2).length) {
          violate('hollowForm', `${sk} standing HELD with ${holesOf(st2).join(', ')} at 0 of ${FORM_FLOOR}`);
        }
        if (st2?.mastered && servedHoles(st2).length) {
          violate('hollowServed', `${sk} standing HELD with ${servedHoles(st2).join(', ')} never once solved unaided`);
        }
      }
    }
    if (policy === 'engine' && !engine.isUnlocked(task.skill)) {
      if (engine.get(task.skill)?.mastered) underReopened++;
      else violate('lockedServe', `${task.skill} served at item ${items + 1}, never proved, prereqs unheld`);
    }
    // Which world the item arrives in. The engine names the framings it does
    // not want; a bank with nothing else to offer serves one anyway, exactly
    // as generate() does when its retry budget runs out.
    const bank = SCENES[`${task.skill}/${form}`] || [];
    let scene = '';
    if (bank.length) {
      const avoid = new Set(task.avoidScenes || []);
      const open = bank.filter((x) => !avoid.has(x));
      const from = open.length ? open : bank;
      scene = from[Math.floor(rnd() * from.length)];
    }

    if (record) {
      if (task.kind === 'check') {
        const fresh = !practised.get(task.skill).has(form)
          || (!!scene && !worked.get(task.skill).has(scene));
        XFER.items++;
        if (fresh) XFER.unseen++;
        // A run's `need` can grow while it is in flight, so it is closed by the
        // next run starting (done back at 0) or by the learner running out of
        // budget — never by guessing at its length.
        let cur = run.get(task.skill);
        if (!cur || task.check?.done === 0) {
          if (cur) closeRun(cur);
          cur = { unseen: false, reps: new Set(), model: false };
          run.set(task.skill, cur);
        }
        if (fresh) cur.unseen = true;
        cur.reps.add(rep);
        if (MODELLING.has(rep)) cur.model = true;
        runOf = cur;
      } else {
        practised.get(task.skill).add(form);
      }
      if (scene) worked.get(task.skill).add(scene);
    }

    // forgetting, everywhere, every item
    if (!frozen) for (const s of SKILLS) k.set(s, k.get(s) * (1 - DECAY / stability.get(s)));

    // Retrieval practice is what the re-probe and the interleaved prerequisite
    // item are for, and the testing effect is credited to exactly those two —
    // unchanged from the version of this file that produced the numbers this
    // build is being held against, so the comparison is like for like.
    const spaced = task.kind === 'review' || task.kind === 'retrieval';
    // A rung of the sounding is retrieval too — unassisted, unsupported, at the
    // top of the bank, on a line the learner is not being taught right now — so
    // it earns the testing effect. It does **not** earn the stability that a
    // spaced re-probe earns, because resistance to forgetting is what the
    // *spacing* buys, and a sounding is by definition unspaced. That asymmetry
    // is the whole distinction this build exists to make, and it is worth about
    // half a point of true mastery in the single-sitting cohort.
    const retrievalOnly = task.kind === 'deep';

    // --- items spent on a line this learner had already proved ---------------
    // The number a real 12-minute session was read by hand to discover, after
    // the scheduler served one held skill nine times in twelve while an
    // unmastered skill next door was never served at all. Nothing in this file
    // could see it: it counted reviews and soundings by *kind*, and a defect
    // whose whole shape is "too many items on a proved line" does not have a
    // kind of its own. So it is counted here, by state rather than by label —
    // was this skill already mastered at the moment it was served — and printed
    // below, split into the two spaced mechanisms that are meant to land on a
    // held line and everything else, which is not.
    if (engine.get(task.skill)?.mastered) {
      heldItems++;
      if (task.kind === 'review') heldReview++;
      else if (task.kind === 'retrieval') heldRetrieval++;
      else if (task.kind === 'deep') heldDeep++;
      else heldOther++;
      const h = (heldBySkill.get(task.skill) || 0) + 1;
      heldBySkill.set(task.skill, h);
      if (h > heldWorst) heldWorst = h;
      const kkey = `${task.skill}/${task.kind}`;
      const hk = (heldByKind.get(kkey) || 0) + 1;
      heldByKind.set(kkey, hk);
      if (hk > (heldWorstKind.get(task.kind) || 0)) heldWorstKind.set(task.kind, hk);
    }

    if (task.scaffold === 'full') learn(task.skill, GAIN.studyExample);
    else if (task.scaffold === 'partial') learn(task.skill, GAIN.completion);

    const exposures = repSeen.get(task.skill)[rep] || 0;
    const novelty = 0.15 * Math.exp(-0.7 * exposures);
    const support = task.scaffold === 'full' ? 0.13 : task.scaffold === 'partial' ? 0.06 : 0;
    const demand = DEMAND[task.skill][clamp(task.difficulty, 1, 5) - 1];

    // A scaffolded win is assisted evidence by construction: the answer was on
    // the card. Only unsupported, first-try solves can satisfy the gate.
    let assisted = task.scaffold !== 'none';
    let solved = false;
    // Right, first try, with no help on the card — the only outcome the engine
    // calls `clean`, and the only one that moves a spacing rung.
    let firstTryOK = false;

    // The engine's own count of re-probes this line has survived across a real
    // gap, read before and after the answer. It is the engine that decides what
    // "across a real gap" means, not this file, so what strengthens the memory
    // model here is exactly what the shipping schedule is prepared to call
    // durable retention.
    const durableBefore = engine.get(task.skill)?.durable || 0;
    // Was this line standing when the item was served? A claim can only be lost
    // on the line the item is about — `lapse` and the form-floor withdrawal in
    // `observe` both act on the skill just observed — so one read here and one
    // after the attempts is the whole ledger.
    const heldBeforeItem = !!engine.get(task.skill)?.mastered;
    const wasLapsingBefore = !!engine.get(task.skill)?.lapsePending;
    // Diagnostic only: what the engine believed about this learner *before* the
    // answer landed. Read here rather than in the watch hook below because the
    // observation changes both, and the question a tail probe asks is which
    // road the learner was on when the item was served.
    const before = opts.watch ? {
      steady: engine.steadyAtGate(),
      gateSeen: [...engine.state.values()].reduce((a, x) => a + (x.gateSeen || 0), 0),
      gateClean: [...engine.state.values()].reduce((a, x) => a + (x.gateClean || 0), 0),
      need: engine.get(task.skill).check?.need ?? 0,
      done: engine.get(task.skill).check?.done ?? 0,
    } : null;
    const events = [];
    let tries = 0;
    for (let attempt = 0; attempt < 3 && !solved; attempt++) {
      const eff = clamp(k.get(task.skill) * (1 - novelty) + support - (task.skill === sticky ? 0.10 : 0), 0, 1);
      const skill = sigmoid(SHARPNESS * (eff - demand));
      // Nothing is multiple-choice on the first try: the guess floor only
      // appears once the surface has narrowed after two misses.
      const guess = attempt >= 2 ? 1 / 3 : 0.02;
      const p = (1 - SLIP) * (guess + (1 - guess) * skill);
      items++;
      tries++;
      let res;
      if (rnd() < p) {
        res = engine.observe(task.skill, true, { assisted, form, rep, scene, kind: task.kind });
        learn(task.skill, assisted ? GAIN.assistedWin : GAIN.cleanWin);
        if (spaced) {
          learn(task.skill, GAIN.retrieval);
          stability.set(task.skill, stability.get(task.skill) + 0.7);
        } else if (retrievalOnly) {
          learn(task.skill, GAIN.retrieval);
        }
        if ((engine.get(task.skill)?.durable || 0) > durableBefore) {
          strength.set(task.skill, Math.min(60, strength.get(task.skill) * GAP_GROWTH));
        }
        repSeen.get(task.skill)[rep] = exposures + 1;
        if (attempt === 0 && !assisted) firstTryOK = true;
        solved = true;
      } else {
        res = engine.observe(task.skill, false, { assisted: true, form, rep, scene, kind: task.kind });
        // The wrong tap calls the echo. Whether that echo can say anything
        // about *this* slip is a property of the bank, measured above — and a
        // miss that only gets the question read back to it is worth no more
        // than having studied a worked example.
        const answered = rnd() < (FEEDBACK[`${task.skill}/${form}`] ?? 0);
        learn(task.skill, answered ? GAIN.errorFeedback : GAIN.studyExample);
        assisted = true;
      }
      if (opts.watch && res?.checkEvent) events.push(res.checkEvent);
      // The moment a claim is made, against the truth at that moment — not
      // against where the learner ends up after another two hundred items.
      if (res?.justMastered) {
        if (runOf) { runOf.passed = true; runOf = null; }
        // --- WHAT THE CLAIM LOOKS LIKE UNDER THE STRICTER DEFINITION --------
        // The old test was `k < HOLLOW`: one aggregate about the learner
        // compared with one aggregate about the engine. It could not see the
        // defect, because the defect IS an aggregate hiding a hole. Three
        // things are recorded here that it could not:
        //
        //   holes    question types the engine had served `formFloor` times and
        //            never once had answered unaided, at the instant of the
        //            claim. Read straight off the engine's own counter, so this
        //            is the same evidence the report prints, not a proxy.
        //   surface  the learner's TRUE competence on the weakest surface this
        //            skill was actually served on — see `surfaceTruth`. A
        //            learner may be genuinely at 0.90 in the aggregate and
        //            genuinely below the bar on tables, and only one of those
        //            two numbers used to be able to make a claim hollow.
        //   reps     how many surfaces this skill was served on at all, which is
        //            what makes `surface` a fair test rather than a hard one: a
        //            claim over one surface is judged on that one surface.
        const st = engine.get(task.skill);
        const holes = holesOf(st);
        if (holes.length) {
          violate('hollowForm', `${task.skill} claimed with ${holes.join(', ')} at 0 of ${FORM_FLOOR}`);
        }
        // …and the same question at the floor the product actually promises.
        // `holes` asks "0 of FORM_FLOOR"; this asks "0 of however many were
        // served", which is the card the critic photographed: one question type,
        // asked once, missed, never re-asked, line sealed.
        const served0 = servedHoles(st);
        if (served0.length) {
          violate('hollowServed', `${task.skill} claimed with ${served0.join(', ')} at 0 clean of every one served`);
        }
        const served = [...repServed.get(task.skill)];
        const surface = served.length
          ? Math.min(...served.map((rp) => surfaceTruth(k.get(task.skill), repSeen.get(task.skill)[rp] || 0)))
          : k.get(task.skill);
        claims.push({
          skill: task.skill,
          k: k.get(task.skill),
          holes: holes.length,
          served0: served0.length,
          surface,
          reps: served.length,
          sightRead: !!engine.get(task.skill).viaSightRead,
          items: spent.get(task.skill).items + 1,
          seconds: spent.get(task.skill).seconds
            + itemSeconds({ rep, difficulty: task.difficulty, scaffold: task.scaffold, attempts: tries }),
        });
      }
    }
    if (!solved) learn(task.skill, GAIN.studyExample);
    if (heldBeforeItem && !engine.get(task.skill).mastered) {
      demotions++;
      if (engine.get(task.skill).reopenedFor === 'formFloor') demoBy.formFloor++; else demoBy.lapse++;
    }
    if (task.kind === 'review') { reviewsServed++; if (firstTryOK) reviewsClean++; }
    if (heldBeforeItem && engine.get(task.skill).lapsePending && !wasLapsingBefore) lapsesOpened++;

    // --- the clock ----------------------------------------------------------
    const cost = itemSeconds({ rep, difficulty: task.difficulty, scaffold: task.scaffold, attempts: tries });
    seconds += cost;
    // The wall clock the engine reads. It moves at the speed of the work, which
    // is what makes "ten minutes later" and "tomorrow" different questions.
    vnow += cost * 1000;
    sessionSeconds += cost;
    if (task.kind === 'review') reviewItems++;
    if (task.kind === 'deep') deepItems++;
    const sp = spent.get(task.skill);
    sp.items += 1;
    sp.seconds += cost;
    if (!cleared.has(task.skill) && engine.get(task.skill).mastered) {
      cleared.set(task.skill, { items: sp.items, seconds: sp.seconds, at: step + 1, elapsed: seconds });
    }
    // A per-item hook for diagnostics that need to see the road and not just the
    // arrival time. Off unless a caller asks for it, so the shipping figures are
    // produced by byte-identical work.
    if (opts.watch) {
      opts.watch({
        step, skill: task.skill, kind: task.kind, band: task.difficulty,
        scaffold: task.scaffold, rep, form, tries, solved,
        cost, mastered: engine.get(task.skill).mastered,
        sightRead: engine.get(task.skill).sightRead,
        check: engine.get(task.skill).check
          ? { done: engine.get(task.skill).check.done, need: engine.get(task.skill).check.need }
          : null,
        // How far this run has been extended, and why. Diagnostic only.
        checkExt: engine.get(task.skill).check?.ext ?? null,
        checkFormExt: engine.get(task.skill).check?.formExt ?? null,
        // Where in the SITTING this item fell, and what standing the line had
        // when it was served. This is what makes "what does a returning learner
        // meet in the first ten minutes" a measurement rather than a reading of
        // the router's source.
        sitting, atSecond: sessionSeconds - cost, everHeld: !!engine.get(task.skill).everMastered,
        heldBeforeItem, lapsingBefore: wasLapsingBefore, firstTryOK,
        before, events,
      });
    }

    // --- nobody is routed around --------------------------------------------
    if (decayMode === 'elapsed') touchedThisSitting.add(task.skill);
    lastTouch.set(task.skill, step);
    for (const s of SKILLS) {
      // Mastered or locked means not servable, so the clock on it does not run:
      // a skill demoted by a lapse and re-locked has not been neglected.
      if (engine.get(s).mastered || !engine.isUnlocked(s) || !lastTouch.has(s)) {
        lastTouch.set(s, step);
        continue;
      }
      starve = Math.max(starve, step - lastTouch.get(s));
    }

    if (CHECKPOINTS.includes(step + 1)) trace.push({ at: step + 1, ...score(engine, k, { repServed, repSeen }) });

    // --- the end of a sitting ------------------------------------------------
    // The learner shuts the laptop. Time passes — the only thing in this file
    // that can pay out the engine's spacing ladder above its first rung — and
    // knowledge decays across it, slowed by every re-probe each line has
    // already survived.
    if (sessions && sessionSeconds >= sessionCap) {
      sessionTrace.push({
        n: sitting, items: items, seconds, reviews: reviewItems, deep: deepItems,
        durable: engine.durableCount(), ...score(engine, k, { repServed, repSeen }),
      });
      if (sitting >= sessions) break;
      sitting++;
      sessionSeconds = 0;
      // The held-line budget is a per-sitting promise, so the figure that grades
      // it has to be counted per sitting too. `heldWorst` above stays a
      // whole-run number and is reported as one; this is the one that maps onto
      // what a student actually sits through.
      heldBySkill.clear();
      heldByKind.clear();
      if (!frozen) {
        for (const s of SKILLS) {
          const floor = perma * (peak.get(s) || 0);
          if (decayMode === 'elapsed') {
            // A line practised in the sitting just closed restarts its curve
            // here, at what it is worth now. One that was not keeps the anchor
            // it already had, so the wait it is decayed over is the REAL wait
            // since it was last retrieved and not the wait since the last
            // boundary. That is the whole difference between the two laws.
            if (touchedThisSitting.has(s)) { restK.set(s, k.get(s)); restAt.set(s, vnow); }
            const hours = (vnow - restAt.get(s)) / HOUR + decayHours;
            const keep = Math.pow(1 + hours / (GAP_HOURS * strength.get(s)), -gpow);
            k.set(s, Math.max(floor, floor + (restK.get(s) - floor) * keep));
          } else {
            const keep = Math.pow(1 + decayHours / (GAP_HOURS * strength.get(s)), -gpow);
            k.set(s, Math.max(floor, floor + (k.get(s) - floor) * keep));
          }
        }
      }
      touchedThisSitting.clear();
      vnow += gapHours * HOUR;
      /* …AND THE RECORD IS RELOADED, because that is what happens next.
         The clock has moved first, so the engine that comes back reads the new
         time — which is the moment the withdrawal, if there is one, is made.
         Anything this takes back is taken back BEFORE the first item of the
         next sitting, exactly as it is in the product. */
      const heldBefore = SKILLS.filter((s2) => engine.get(s2).mastered).length;
      //   AB_NORELOAD=1   one engine object for the whole run and no save/load
      //                   between sittings — this file as it stood before the
      //                   round trip existed. It is the arm that says what the
      //                   reload costs, on identical seeds.
      if (!process.env.AB_NORELOAD) engine = reload(engine);
      const took = engine.withdrewOnLoad || [];
      if (took.length) {
        withdrawnOnLoad += took.length;
        for (const w of took) withdrawnLines.add(w.id);
      }
      // A reload may only ever take claims away, never hand them out: if the
      // round trip ever *adds* a held line the serialiser has invented one.
      if (SKILLS.filter((s2) => engine.get(s2).mastered).length > heldBefore) {
        violate('reloadGrant', 'a save/load round trip granted a claim that was not in the file');
      }
    }
  }
  if (sessions && sessionTrace.length < sitting) {
    sessionTrace.push({
      n: sitting, items, seconds, reviews: reviewItems, deep: deepItems,
      durable: engine.durableCount(), ...score(engine, k, { repServed, repSeen }),
    });
  }
  if (record) for (const cur of run.values()) closeRun(cur);

  return {
    theta, lr, items, trace, seconds, claims, cleared, spent, starve, knownSkills,
    withdrawnOnLoad, withdrawnLines: withdrawnLines.size, demotions, demoBy,
    reviewsServed, reviewsClean, lapsesOpened,
    sessionTrace, reviewItems, deepItems, durable: engine.durableCount(),
    heldItems, heldReview, heldRetrieval, heldDeep, heldOther, heldWorst,
    heldWorstKind: Object.fromEntries(heldWorstKind),
    // The hidden state at the buzzer, kept so the same learner can be asked
    // again a week later without being taught anything in between.
    k, peak, strength, gapPow: gpow, perma,
    lapsed: SKILLS.filter((s) => engine.get(s).everMastered && !engine.get(s).mastered).length,
    // The engine's own save, so the invariant block below can re-open this exact
    // learner and put the real session planner in front of the real state.
    save: engine.save(),
    ...score(engine, k, { repServed, repSeen }),
    // The surface ledger, kept so the retention test a week later can apply the
    // same strict definition rather than falling back to the aggregate.
    repServed, repSeen,
    engineMasteredSet: new Set(SKILLS.filter((s) => engine.get(s).mastered)),
    // Lines standing HELD at the buzzer over a question type that was served
    // and never once solved unaided — carried out so the retention test a week
    // later can apply the same rule without an engine to ask.
    servedHoleSet: new Set(SKILLS.filter((s) => servedHoles(engine.get(s)).length)),
    hollowAtEnd: SKILLS.filter((s) => engine.get(s).mastered && k.get(s) < HOLLOW),
    hollowAtEndStrict: SKILLS.filter((s) => engine.get(s).mastered
      && (strictTruth(k.get(s), s, { repServed, repSeen }) < HOLLOW
        || servedHoles(engine.get(s)).length)),
  };
}

/**
 * THE RETENTION TEST — the same learner, `days` later, taught nothing.
 *
 * Every "true mastery" figure this file has ever printed was read at the
 * buzzer, with the last item still warm. That is the crammer's own preferred
 * measurement, and under an attempt-counted spacing schedule it was the only
 * one available, because the simulation had no clock to wait on. It does now.
 * Nothing is taught here and nothing is re-probed: the forgetting curve is run
 * forward from wherever the learner finished, with whatever durable strength
 * their re-probes actually bought them, and the level is scored again.
 */
function scoreAfter(r, days) {
  let trueMastered = 0, hollow = 0, hollowStrict = 0, sum = 0;
  const ctx = { repServed: r.repServed, repSeen: r.repSeen };
  for (const s of SKILLS) {
    const floor = (r.perma ?? PERMA) * (r.peak.get(s) || 0);
    const keep = Math.pow(1 + (days * 24) / (GAP_HOURS * r.strength.get(s)), -(r.gapPow ?? GAP_POW));
    const kk = Math.max(floor, floor + (r.k.get(s) - floor) * keep);
    sum += kk;
    if (kk >= TRUE_MASTERY) trueMastered++;
    if (r.engineMasteredSet.has(s) && kk < HOLLOW) hollow++;
    if (r.engineMasteredSet.has(s)
      && (strictTruth(kk, s, ctx) < HOLLOW || r.servedHoleSet.has(s))) hollowStrict++;
  }
  return { trueMastered, hollow, hollowStrict, avg: sum / SKILLS.length };
}

/**
 * @param {MasteryEngine} engine
 * @param {Map<string,number>} k       hidden competence, per skill
 * @param {{repServed?:Map<string,Set<string>>, repSeen?:Map<string,object>}} [ctx]
 *
 * `hollow` is the definition this file has always used: the engine says
 * mastered and the aggregate hidden competence is below the bar. It is kept,
 * unchanged and still printed, because every figure this build has ever been
 * judged against was measured with it and a stricter number that quietly
 * replaced it would be unreadable.
 *
 * `hollowStrict` is the definition the defect requires. A claim is hollow if the
 * aggregate is below the bar OR the learner's true competence on the WEAKEST
 * SURFACE this skill was actually served on is below the bar. An aggregate that
 * a strong showing on symbols can carry is exactly the thing that certified a
 * learner who could not read a table, so the strict test refuses to average.
 * It is the harder number and it is the honest one; both are printed.
 */
function score(engine, k, ctx) {
  let trueMastered = 0, engineMastered = 0, hollow = 0, hollowStrict = 0;
  for (const s of SKILLS) {
    const kk = k.get(s);
    const m = engine.get(s).mastered;
    if (kk >= TRUE_MASTERY) trueMastered++;
    if (m) engineMastered++;
    if (m && kk < HOLLOW) hollow++;
    // A held line carrying a question type that was served and never once
    // solved unaided is hollow whatever the hidden competence says. This is
    // not an inference about the learner — it is the engine's own counter
    // contradicting the engine's own badge, which is what the critic read off
    // one card.
    if (m && (strictTruth(kk, s, ctx) < HOLLOW || servedHoles(engine.get(s)).length)) hollowStrict++;
  }
  const avg = SKILLS.reduce((a, s) => a + k.get(s), 0) / SKILLS.length;
  return { trueMastered, engineMastered, hollow, hollowStrict, avg };
}

/**
 * What this learner is really worth on the weakest surface this skill has
 * actually been served on. Falls back to the aggregate when the caller kept no
 * surface ledger, so every existing call site keeps its old meaning.
 */
function strictTruth(kk, skill, ctx) {
  const served = ctx?.repServed?.get(skill);
  if (!served || !served.size) return kk;
  let worst = kk;
  for (const rp of served) {
    const v = surfaceTruth(kk, ctx.repSeen?.get(skill)?.[rp] || 0);
    if (v < worst) worst = v;
  }
  return worst;
}

// ---------------------------------------------------------------------------
// SELF-TEST — `node tools/simulate.mjs --self-test`
//
// An assertion that has never failed has never been tested. Each invariant
// above is fed a state it must pass and a state it must catch, driven through
// the real engine, so the four sentences this file prints PASS beside are
// sentences it can also print FAIL beside.
//
// It runs in a second and it does not touch the cohorts below it.
// ---------------------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  const out = [];
  const ok = (name, pass, detail = '') => {
    out.push({ name, pass, detail });
    console.log(`  ${pass ? ' ok ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };
  const ROOT_SKILL = SKILLS[0];
  const rootForm = FORMS_BY_SKILL[ROOT_SKILL][0].id;
  const fresh = () => new MasteryEngine(graph, null);

  // 1a. A hole is a hole: three questions of one shape, none of them right.
  {
    const m = fresh();
    const st = m.get(ROOT_SKILL);
    st.formsSeen[rootForm] = { seen: 3, items: 3, correct: 0 };
    ok('a shape at 0 of 3 is named as a hole',
      m.weakForms(st).includes(rootForm) && holesOf(st).includes(rootForm));
  }
  /* 1b. …and ATTEMPTS at one question are not questions.
     THIS ASSERTION WAS STALE AND RED, and it had been red for as long as the
     floor it was written against. It read
         st.formsSeen[rootForm] = { seen: 3, items: 1, correct: 0 };
         ok('three tries at one question is not a hole', !m.weakForms(st).length)
     which is a statement about `formFloor` being 3. The floor is **1** now —
     the stricter one this file's own header describes, the card the critic
     photographed: one question type, asked once, missed, never re-asked. At a
     floor of 1 that record IS a hole and the engine is right to say so, so the
     honest case of this gate's own self-test printed FAIL and
     `node tools/simulate.mjs --self-test` exited 1. A self-test that fails on
     correct engine behaviour is the thing this repo switches gates off over.
     The distinction it exists for — `items` (questions asked) and not `seen`
     (taps) — is real at every floor, so it is now asserted at the floor the
     engine actually holds, in both directions, and it still fails if anything
     goes back to counting taps. */
  {
    const m = fresh();
    const floor = m.cfg.formFloor;
    // A record where the two readings DISAGREE at this floor: plenty of taps,
    // fewer questions than the floor. A `seen`-reader calls it a hole; an
    // `items`-reader does not, and the engine must not.
    const stA = m.get(ROOT_SKILL);
    stA.formsSeen[rootForm] = { seen: floor + 2, items: floor - 1, correct: 0 };
    const quietOnTaps = !m.weakForms(stA).length && !holesOf(stA).length;
    // …and the same shape with the questions really asked: that IS a hole, so
    // the rule above cannot be satisfied by never finding one.
    const m2 = fresh();
    const stB = m2.get(ROOT_SKILL);
    stB.formsSeen[rootForm] = { seen: floor + 2, items: floor, correct: 0 };
    const firesOnQuestions = m2.weakForms(stB).includes(rootForm) && holesOf(stB).includes(rootForm);
    ok(`a hole is counted in questions asked, not in taps (formFloor ${floor})`,
      quietOnTaps && firesOnQuestions,
      `${floor + 2} taps over ${floor - 1} questions: ${quietOnTaps ? 'not a hole' : 'WRONGLY a hole'}; `
      + `over ${floor} questions: ${firesOnQuestions ? 'a hole' : 'WRONGLY not a hole'}`);
  }
  // 1c. The gate refuses to close over one, however good everything else is.
  {
    const m = fresh();
    const st = m.get(ROOT_SKILL);
    st.pL = 0.999;
    st.check = {
      done: 9, need: 3, base: 3, missed: 0, ext: 9, forms: [], reps: ['symbolic', 'table'],
      nonSymbolic: true, modelled: true, novel: true, band: 5, road: 'long',
    };
    st.formsSeen[rootForm] = { seen: 3, items: 3, correct: 0 };
    const granted = m.promote(st);
    ok('a claim cannot be granted over a hole', granted === false && !st.mastered,
      `pL ${st.pL}, run 9 of 3, every transfer condition met`);
  }
  // 1d. Clear the hole and the same state promotes.
  {
    const m = fresh();
    const st = m.get(ROOT_SKILL);
    st.pL = 0.999;
    st.check = {
      done: 9, need: 3, base: 3, missed: 0, ext: 9, forms: [], reps: ['symbolic', 'table'],
      nonSymbolic: true, modelled: true, novel: true, band: 5, road: 'long',
    };
    st.formsSeen[rootForm] = { seen: 3, items: 3, correct: 1 };
    ok('the same claim is granted once the hole is filled',
      m.promote(st) === true && st.mastered);
  }
  // 1e. A record already holding a hollow claim is reopened, not hidden.
  {
    const m = fresh();
    const saved = m.save();
    saved.skills[ROOT_SKILL] = {
      ...saved.skills[ROOT_SKILL],
      mastered: true, everMastered: true, attempts: 12, pL: 0.999,
      formsSeen: { [rootForm]: { seen: 3, items: 3, correct: 0 } },
    };
    const back = new MasteryEngine(graph, saved);
    const st = back.get(ROOT_SKILL);
    ok('a saved hollow claim is withdrawn on load',
      st.mastered === false && st.reopenedFor === 'formFloor' && st.everMastered === true);
  }
  // 2. Nothing is taught out of prerequisite order.
  {
    const m = fresh();
    const locked = graph.nodes.find((n) => (n.prereqs || []).length)?.id;
    const t = locked ? m.taskFor(locked) : null;
    ok('a locked line is never taught',
      !!locked && (!t || m.isUnlocked(t.skill)),
      locked ? `asked for ${locked}, served ${t ? t.skill : 'nothing'}` : 'no locked node in this graph');
  }
  // 3. The content check can see the shape it was written for.
  {
    const caught = needsDistribution('2\\left(2m + 13\\right) + 2\\left(6m + 10\\right)');
    const spared = [
      '6\\left(8 + 5 \\cdot 2\\right)',           // order of operations, no letter
      '7\\left(4m\\right)',                        // one term, not a sum
      '\\left(2m + 13\\right) + \\left(6m + 10\\right)', // the fixed perimeter item
      // A recursive rule. `f(n-1)` is a function applied to n-1, not f times
      // (n-1), and 96 of these were reported as prerequisite violations.
      '\\begin{array}{l} f\\left(1\\right) = 8 \\\\ f\\left(n\\right) = f\\left(n-1\\right) + 5 \\end{array}',
    ].every((x) => !needsDistribution(x));
    // …and the near miss it must NOT spare: a single letter multiplying a sum,
    // in an equation, which is a product and does need distributing.
    const stillCaught = [
      'x\\left(2x + 5\\right) = 20',
      'n\\left(n + 4\\right)',
    ].every((x) => !!needsDistribution(x));
    ok('the distributive-property check catches it and only it', !!caught && spared && stillCaught,
      caught ? `caught ${caught}` : 'missed the expression it exists for');
  }
  // 4. The workload range is honest about the goal it is quoted beside.
  {
    const m = fresh();
    const p = planRun(m, { factor: 1, accuracy: 0.72, seeded: true }, { minutes: 20 });
    ok('the quoted workload contains the planned workload',
      p.itemsLow <= p.items && p.items <= p.itemsHigh && p.itemsLow >= p.tears,
      `goal ${p.tears} rifts, quoted ${p.itemsLow}-${p.itemsHigh} questions, planned ${p.items}`);
  }
  // 5. The reported figure is a floor and behaves like one.
  {
    const m = fresh();
    const st = m.get(ROOT_SKILL);
    st.attempts = 12;
    st.pL = 0.999;
    st.formsSeen[rootForm] = { seen: 3, items: 3, correct: 0 };
    const c = m.confidence(ROOT_SKILL, { plan: 0.6666 });
    ok('the reported figure is the lowest thing measured, not the posterior',
      c.floor <= c.pL && c.floor <= 0.6666 && c.floor < 0.5 && c.why === 'form',
      `pL ${c.pL.toFixed(3)}, plan 0.667, printed ${c.floor.toFixed(3)} (${c.why})`);
  }
  // 6. THE SPACING RUNG IS BOUGHT WITH ELAPSED TIME AND WITH NOTHING ELSE.
  //
  // `reviewCatchUp` lets a survived gap credit the rung it was actually long
  // enough to pay for, which is the change that makes the ladder able to outrun
  // a three-day cadence. The whole thing rests on ONE property: the credit is
  // read off the wall clock, so it cannot be ground out in a sitting. That was
  // a habit until this assertion existed, and a habit is what the attempt-
  // counted schedule this replaced turned out to be.
  //
  // Both directions, on the real engine, at the shipping ladder:
  //   a re-probe passed ten minutes after the claim earns rung 0 and advances
  //     to rung 1, exactly as it did before this rule existed;
  //   a re-probe passed seventy-two hours after the claim earns every rung the
  //     ladder prices under 72 h and advances one past it;
  //   and NO gap, however many re-probes are stacked on it, ever reaches a rung
  //     the wall clock has not paid for.
  {
    const MIN = 60000;
    const ladder = DEFAULT_MASTERY.reviewMinutes;
    // Where the rule says a wait of `mins` should land a line that starts at 0.
    const priced = (mins) => { let e = 0; while (e + 1 < ladder.length && mins >= ladder[e + 1]) e++; return Math.min(ladder.length - 1, e + 1); };
    const afterGap = (mins, catchUp) => {
      const m = fresh();
      m.cfg.reviewCatchUp = catchUp;
      let t = 1e12;
      m.setClock(() => t);
      const st = m.get(ROOT_SKILL);
      m.place(st);
      st.mastered = true; st.everMastered = true; st.probe = null; st.check = null;
      st.reviewStage = 0; st.provedTime = t; st.masteredTime = t;
      st.formsSeen[rootForm] = { seen: 2, items: 2, correct: 2 };
      t += mins * MIN;
      st.lastServed = { difficulty: 4, kind: 'review', seq: 1 };
      m.observe(ROOT_SKILL, true, { assisted: false, form: rootForm, rep: 'symbolic', kind: 'review' });
      return st.reviewStage;
    };
    const tenMin = afterGap(10, 1);
    const threeDays = afterGap(72 * 60, 1);
    const noWait = afterGap(0, 1);
    const off = afterGap(72 * 60, 0);
    ok('a spacing rung is bought with elapsed time and with nothing else',
      tenMin === 1 && noWait === 1 && threeDays === priced(72 * 60) && off === 1
      && threeDays <= ladder.length - 1,
      `10 min -> rung ${tenMin}; no wait at all -> rung ${noWait}; 72 h -> rung ${threeDays} `
      + `(the ladder prices ${priced(72 * 60)}); rule off -> rung ${off}`);
    // …and the same rule cannot be reached by repeating a short gap: ten
    // re-probes ten minutes apart must not arrive anywhere a single 72-hour
    // wait arrives, or the ladder is climbable inside one sitting again.
    {
      const m = fresh();
      m.cfg.reviewCatchUp = 1;
      let t = 1e12;
      m.setClock(() => t);
      const st = m.get(ROOT_SKILL);
      m.place(st);
      st.mastered = true; st.everMastered = true; st.probe = null; st.check = null;
      st.reviewStage = 0; st.provedTime = t; st.masteredTime = t;
      st.formsSeen[rootForm] = { seen: 2, items: 2, correct: 2 };
      const seen = [];
      for (let i = 0; i < 10; i++) {
        t += 10 * MIN;
        st.lastServed = { difficulty: 4, kind: 'review', seq: i + 2 };
        m.observe(ROOT_SKILL, true, { assisted: false, form: rootForm, rep: 'symbolic', kind: 'review' });
        seen.push(st.reviewStage);
      }
      // Every one of those ten waits prices rung 0, so the stage may climb by
      // one each time and may never jump: the ladder is climbed, not skipped.
      const climbedByOne = seen.every((v, i) => v === Math.min(ladder.length - 1, i + 1));
      ok('ten re-probes ten minutes apart climb the ladder one rung at a time and skip nothing',
        climbedByOne, `stages ${seen.join(' ')}`);
    }
    // …and the property the whole thing is FOR, asked of the routing rather
    // than of the arithmetic: above the first rung, `isDue` refuses a second
    // re-probe inside a sitting however long the learner sits there. The block
    // above deliberately bypasses `isDue` to test the ladder in isolation, so
    // without this assertion the two together would prove nothing about a
    // schedule that cannot be ground out before lunch — which is the one
    // promise this ladder exists to make.
    {
      const m = fresh();
      m.cfg.reviewCatchUp = 1;
      let t = 1e12;
      m.setClock(() => t);
      const st = m.get(ROOT_SKILL);
      m.place(st);
      st.mastered = true; st.everMastered = true; st.probe = null; st.check = null;
      st.reviewStage = 0; st.provedTime = t; st.masteredTime = t;
      st.dueTime = t + 10 * MIN; st.dueAt = 0;
      st.formsSeen[rootForm] = { seen: 2, items: 2, correct: 2 };
      t += 10 * MIN;
      const dueAtTen = m.isDue(st);
      st.lastServed = { difficulty: 4, kind: 'review', seq: 2 };
      m.observe(ROOT_SKILL, true, { assisted: false, form: rootForm, rep: 'symbolic', kind: 'review' });
      // Now sit there for eight hours less a minute — a sitting nobody has ever
      // played — and the line must still not be due.
      m.clock += 999;
      t += (ladder[1] - 1) * MIN;
      const dueLater = m.isDue(st);
      ok('above the first rung the ladder cannot be paid inside one sitting',
        dueAtTen === true && dueLater === false && st.durable === 0,
        `rung 0 came due after 10 min: ${dueAtTen}; rung 1 (${ladder[1]} min) still not due after ${ladder[1] - 1} more minutes: ${!dueLater}; durable credit earned: ${st.durable}`);
    }
  }
  // -------------------------------------------------------------------------
  // THE WORK-IN-PROGRESS CAP — `focusOpen`.
  //
  // It is the one dial in this wave that can decide which line a learner is
  // sent to, so it is asserted in four directions: it must refuse to OPEN
  // something new while the cap is full, it must still open it when the cap is
  // off (or a rule that does nothing would pass the first half), it must never
  // route a struggling line around — `starveLimit` is a promise and this sits
  // below it — and it must never delay a re-probe the wall clock has called
  // for, because a returning learner meeting recovery first is the whole point
  // of the schedule.
  // -------------------------------------------------------------------------
  {
    const MIN = 60000;
    /* A learner mid-lattice: four lines proved and quiet, two lines started and
       unproved, one line unlocked and never touched. Built by hand so the
       question the assertion asks is the only thing moving. */
    const build = (cap) => {
      const m = fresh();
      let t = 1e12;
      m.setClock(() => t);
      m.clock = 500;
      for (const id of ['var-meaning', 'eval-expr', 'like-terms', 'one-step-add']) {
        const st = m.get(id);
        m.place(st);
        st.mastered = true; st.everMastered = true; st.probe = null; st.check = null;
        st.pL = 0.97; st.difficulty = 4; st.attempts = 12; st.lastSeenAt = m.clock;
        st.reviewStage = 2; st.provedTime = t; st.masteredTime = t;
        st.dueTime = t + 10 * 24 * 60 * MIN; st.dueAt = 0;   // proved, quiet, not due
        for (const f of FORMS_BY_SKILL[id]) st.formsSeen[f.id] = { seen: 2, items: 2, correct: 2 };
      }
      for (const id of ['order-ops', 'distribute']) {
        const st = m.get(id);
        m.place(st);
        /* Started, and deliberately worth little: a high posterior, no
           sight-read outstanding and just seen, so the only thing that can beat
           them is the untouched line. */
        st.attempts = 6; st.pL = 0.985; st.probe = null; st.lastSeenAt = m.clock; st.difficulty = 3;
      }
      m.cfg.focusOpen = cap;
      return m;
    };
    const untouched = 'one-step-mul';
    const capped = build(2).next();
    const off = build(0).next();
    ok('the work-in-progress cap refuses to OPEN a new line, and only that',
      capped && capped.id !== untouched && off && off.id === untouched,
      `cap 2 -> ${capped && capped.id}; cap off -> ${off && off.id} (the untouched line)`);

    // …and it sits UNDER the starvation promise, not over it.
    const starved = build(2);
    const sv = starved.get('order-ops');
    sv.lastSeenAt = starved.clock - starved.cfg.starveLimit - 1;
    const spick = starved.next();
    // …and a line the cap has never let the router open cannot be starved into
    // existence either, because nothing has been taken from it: the promise is
    // about a learner being routed OFF a topic, and this one was never on it.
    ok('the cap never routes a started line around — starvation still outranks it',
      spick && spick.id === 'order-ops' && spick.reason === 'starved',
      `${spick && spick.id} (${spick && spick.reason})`);

    // …and a re-probe the clock called for still comes first, cap or no cap.
    const due = build(2);
    const dl = due.get('like-terms');
    dl.dueTime = 1e12 - 60 * MIN; dl.dueAt = 0;
    const dpick = due.next();
    ok('the cap never delays a re-probe the wall clock has called for',
      dpick && dpick.id === 'like-terms' && dpick.kind === 'review',
      `${dpick && dpick.id} (${dpick && dpick.kind})`);
  }

  // -------------------------------------------------------------------------
  // WHAT SURFACE A RE-PROBE IS READ OFF — `reviewSurface`.
  //
  // Cheaper must never mean easier, and it must never mean a surface quietly
  // dropping out of the retention schedule. Both directions are asserted, and
  // so is the fall-back, because a rule that can return an empty pool is a rule
  // that can leave the engine with nothing to say.
  // -------------------------------------------------------------------------
  {
    const band = 4;
    const at = (id) => (FORMS_BY_SKILL[id] || []).filter((f) => band >= f.dMin && band <= f.dMax);
    const skill = SKILLS.find((id) => {
      const f = at(id);
      return f.length > 1 && new Set(f.map((x) => x.rep)).size > 1;
    });
    const build = (on, provedOnly) => {
      const m = fresh();
      m.cfg.reviewSurface = on;
      const st = m.get(skill);
      m.place(st);
      st.mastered = true; st.everMastered = true; st.probe = null; st.check = null;
      st.difficulty = band; st.attempts = 20;
      const pool = at(skill);
      const dear = pool.slice().sort((a, b) => ITEM_SECONDS[b.rep] - ITEM_SECONDS[a.rep])[0];
      for (const f of pool) {
        /* Every shape has been ASKED. `provedOnly` decides which have been
           answered: in the first arm all of them, in the second only the
           dearest surface, which is the case the fall-back has to survive. */
        const solved = provedOnly ? (f.id === dear.id ? 2 : 0) : 2;
        st.formsSeen[f.id] = { seen: 2, items: 2, correct: solved };
      }
      return { m, st, pool, dear };
    };
    const secs = (fid, pool) => {
      const f = pool.find((x) => x.id === fid);
      return f ? ITEM_SECONDS[f.rep] : Infinity;
    };
    const onArm = build(1, false);
    const offArm = build(0, false);
    const onPick = onArm.m.task(onArm.st, 'review', { difficulty: band, scaffold: 'none' });
    const offPick = offArm.m.task(offArm.st, 'review', { difficulty: band, scaffold: 'none' });
    const cheapest = Math.min(...onArm.pool.map((f) => ITEM_SECONDS[f.rep]));
    const dearestOffered = Math.max(...offPick.formCandidates.map((fid) => secs(fid, offArm.pool)));
    ok('a re-probe is read off the cheapest surface this learner has already solved',
      onPick.formCandidates.length > 0
      && onPick.formCandidates.every((fid) => secs(fid, onArm.pool) === cheapest)
      && dearestOffered > cheapest,
      `${skill} d${band}: on -> ${cheapest}s surfaces only; off -> up to ${dearestOffered}s`);

    // The fall-back: the only surface with a clean solve behind it is the
    // dearest one, so the rule must serve THAT rather than reach for a cheaper
    // surface this learner has never once got right.
    const fb = build(1, true);
    const fbPick = fb.m.task(fb.st, 'review', { difficulty: band, scaffold: 'none' });
    ok('it never reaches for a surface the learner has never once solved',
      fbPick.formCandidates.length > 0
      && fbPick.formCandidates.every((fid) => fid === fb.dear.id),
      `only ${fb.dear.rep} has a clean solve behind it; served ${fbPick.formCandidates.join(', ')}`);

    // …and it cannot touch what the form floor calls a hole. Same record, both
    // settings: `weakForms` reads questions asked and clean solves, and this
    // dial changes neither.
    const holesOn = onArm.m.weakForms(onArm.st).join(',');
    const holesFb = fb.m.weakForms(fb.st).join(',');
    const holesOff = build(0, true).m.weakForms(build(0, true).st).join(',');
    ok('choosing the surface cannot change what the form floor calls a hole',
      holesOn === '' && holesFb === holesOff && holesFb !== '',
      `all solved -> "${holesOn}"; one solved, rule on -> "${holesFb}"; rule off -> "${holesOff}"`);
  }

  // -------------------------------------------------------------------------
  // THE DESCENT AS A COMPETITOR — `soundWeight`.
  //
  // A rung of the descent must be reachable when a held line has gone a long
  // time untouched, and it must lose to both of the things that outrank it: a
  // line the learner cannot do yet, and a re-probe the wall clock called for.
  // A maintenance rule that can beat teaching is not maintenance.
  // -------------------------------------------------------------------------
  {
    const MIN = 60000;
    const build = ({ weight, open }) => {
      const m = fresh();
      let t = 1e12;
      m.setClock(() => t);
      m.clock = 5000;
      /* EVERY line proved and quiet, so the shard really has nothing left to
         teach — the descent's own precondition. Mastering only some of them
         unlocks their children, and a newly-opened line with a sight-read
         outstanding outranks everything here, which is correct behaviour and
         not the question this block asks. */
      const OPEN = open ? ['order-ops', 'distribute', 'one-step-mul'] : [];
      for (const id of SKILLS) {
        const st = m.get(id);
        m.place(st);
        if (OPEN.includes(id)) {
          st.attempts = 4; st.pL = 0.4; st.lastSeenAt = m.clock; st.difficulty = 3;
          continue;
        }
        st.mastered = true; st.everMastered = true; st.probe = null; st.check = null;
        st.pL = 0.97; st.difficulty = 4; st.attempts = 12;
        st.reviewStage = 2; st.provedTime = t; st.masteredTime = t;
        st.dueTime = t + 10 * 24 * 60 * MIN; st.dueAt = 0;
        st.lastSeenAt = m.clock - 200;               // long untouched
        for (const f of FORMS_BY_SKILL[id]) st.formsSeen[f.id] = { seen: 2, items: 2, correct: 2 };
      }
      m.cfg.soundWeight = weight;
      return m;
    };
    /* Nothing open. Off, this is the descent by inheritance — `next()` finds
       nothing above zero and falls through — so both settings must produce a
       rung, and the assertion below is about the case that separates them. */
    const idleOn = build({ weight: 0.35, open: false }).next();
    const idleOff = build({ weight: 0, open: false }).next();
    ok('the descent is still the answer when a shard has nothing left to learn',
      idleOn && idleOn.kind === 'deep' && idleOff && idleOff.kind === 'deep',
      `weighted -> ${idleOn && idleOn.kind}; unweighted -> ${idleOff && idleOff.kind}`);

    /* …and the case that separates them: three lines the learner cannot do yet
       are on the table. The descent must lose to every one of them. */
    const busy = build({ weight: 0.35, open: true }).next();
    ok('a rung of the descent never beats a line the learner cannot do yet',
      busy && busy.kind !== 'deep',
      `${busy && busy.id} (${busy && busy.kind})`);

    /* …and it must lose to a re-probe the wall clock called for. */
    const dueM = build({ weight: 0.35, open: false });
    const dl = dueM.get('like-terms');
    dl.dueTime = 1e12 - 60 * MIN; dl.dueAt = 0;
    const duePick = dueM.next();
    ok('a rung of the descent never beats a re-probe that has come round',
      duePick && duePick.id === 'like-terms' && duePick.kind === 'review',
      `${duePick && duePick.id} (${duePick && duePick.kind})`);

    /* …and the per-sitting budget for held lines still bounds it: a line that
       has spent `heldReserveCap` rungs is not offered another. */
    const spentM = build({ weight: 0.35, open: false });
    for (const id of SKILLS) {
      const st = spentM.get(id);
      st.heldServed = spentM.cfg.heldReserveCap; st.heldServedClock = null;
    }
    const scores = ['var-meaning', 'like-terms'].map((id) => spentM.leverage(id));
    ok('the descent is still bounded by the held-line budget for a sitting',
      scores.every((v) => v === -1), `leverage over a spent line: ${scores.join(', ')}`);
  }

  const bad = out.filter((x) => !x.pass).length;
  console.log(bad ? `\nself-test FAILED — ${bad} of ${out.length}` : `\nself-test passed — ${out.length} assertions`);
  process.exit(bad ? 1 : 0);
}

// ---------------------------------------------------------------------------
// GATE LAB — `GATE_LAB=1 node tools/simulate.mjs` prints the two tables a gate
// change has to be judged on, and nothing else, so a candidate can be graded in
// seconds instead of half a minute. Diagnostic only.
if (process.env.GATE_LAB) {
  const N = Number(process.env.LAB_N || 400);
  const med = (xs) => { const v = [...xs].sort((a, b) => a - b); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const qq = (xs, p) => { const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
  const mins = [], its = [];
  const bySkill = new Map(SKILLS.map((s) => [s, []]));
  let allCleared = 0;
  for (let i = 0; i < N; i++) {
    const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', { knows: () => 0.95, budget: 220, record: false });
    let all = true;
    for (const s of SKILLS) {
      const c = r.cleared.get(s);
      if (!c) { all = false; continue; }
      mins.push(c.seconds / 60); its.push(c.items); bySkill.get(s).push(c.seconds / 60);
    }
    if (all) allCleared++;
  }
  console.log(`knower  median ${med(mins).toFixed(1)}  p75 ${qq(mins, 0.75).toFixed(1)}  p90 ${qq(mins, 0.90).toFixed(1)}  p99 ${qq(mins, 0.99).toFixed(1)}  max ${Math.max(...mins).toFixed(1)}  items med ${med(its).toFixed(1)} p75 ${qq(its, 0.75)} p90 ${qq(its, 0.90)}  min3 ${(100 * its.filter((x) => x <= 3).length / its.length).toFixed(1)}%  proved-all ${(100 * allCleared / N).toFixed(1)}%`);
  console.log('  per skill med: ' + SKILLS.map((s) => `${s} ${med(bySkill.get(s)).toFixed(1)}`).join('  '));
  const rows = [];
  for (const c of [0.50, 0.60, 0.70, 0.75, 0.80, 0.90, 0.95]) {
    let fast = 0, six = 0, ever = 0, seen = 0, inTime = 0;
    for (let i = 0; i < N; i++) {
      const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', { knows: () => c, frozen: true, budget: 40, record: false });
      const first = SKILLS.find((s) => r.spent.get(s).items > 0);
      if (!first) continue;
      seen++;
      const cl = r.cleared.get(first);
      if (cl) { ever++; if (cl.items <= 3) fast++; if (cl.items <= 6) six++; if (cl.elapsed <= 25 * 60) inTime++; }
    }
    rows.push(`  ${c.toFixed(2)}  <=3 ${(100 * fast / seen).toFixed(1).padStart(5)}%  <=6 ${(100 * six / seen).toFixed(1).padStart(5)}%  ever ${(100 * ever / seen).toFixed(1).padStart(5)}%  in25 ${(100 * inTime / seen).toFixed(1).padStart(5)}%`);
  }
  console.log(rows.join('\n'));
  if (process.env.LAB_SEQ) {
    const want = process.env.LAB_SEQ;
    const seqs = [];
    for (let i = 0; i < 60; i++) {
      const log = [];
      const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
        knows: () => 0.95, budget: 220, record: false, watch: (e) => { if (e.skill === want) log.push(e); },
      });
      const c = r.cleared.get(want);
      if (c) seqs.push(`${(c.seconds / 60).toFixed(1)}m ${c.items}i: ` + log.slice(0, c.items).map((e) => `${e.kind[0]}${e.band}${e.scaffold === 'none' ? '' : e.scaffold[0]}${e.solved ? (e.tries > 1 ? '~' : '') : 'X'}`).join(' '));
    }
    console.log(seqs.join('\n'));
    process.exit(0);
  }
  if (process.env.LAB_RUNS) {
    // HOW MANY SHOTS AT THE GATE DOES EACH COHORT GET, AND HOW LONG IS EACH?
    //
    // A gate that lets a below-bar learner through is almost never a gate that
    // is too easy on any one run — the per-run pass rate is fixed by item
    // accuracy and barely moves. It is a gate that hands out too many runs, or
    // too short a run, and the two are different repairs. Neither is visible in
    // the classifier table, which reports only whether a learner ever cleared,
    // so this reports the mechanism underneath it: runs opened per learner, the
    // mean length each one demanded, and how they ended.
    console.log(`  proving runs per learner (frozen cohorts, ${N} each, 40 items)`);
    console.log('    k      runs opened   mean length   passed   ended by a miss   misses absorbed   extended for a surface   for a hole');
    for (const c of [0.95, 0.80, 0.75, 0.70, 0.60, 0.50]) {
      let opened = 0, passed = 0, failed = 0, charged = 0, lenSum = 0, lenN = 0, learners = 0;
      // The two ways a run grows that are NOT a miss: waiting for a form that
      // settles its transfer debt (`ext`), and waiting for a shape this learner
      // has been served at all and never once solved unaided (`formExt`).
      // The first is the "rare form a knower has to wait for"; the second is
      // the form floor, which is not a wait at all — it is the run finally
      // asking the question the claim is about.
      let ext = 0, formExt = 0;
      for (let i = 0; i < N; i++) {
        learners++;
        let pending = null, pendingExt = 0, pendingFormExt = 0;
        runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
          knows: () => c, frozen: c !== 0.95, budget: c === 0.95 ? 220 : 40, record: false,
          watch: (e) => {
            // `check.need` is read after the observation, so the length a run
            // demanded is its need at the moment it closed or ended.
            if (e.check) pending = e.check.need;
            // Read at the end of the run, not summed per item: `ext` is a
            // running total on the run itself, so adding it up every item would
            // count the same extension once per item that followed it.
            if (e.checkExt != null) { pendingExt = e.checkExt; pendingFormExt = e.checkFormExt || 0; }
            for (const ev of e.events) {
              if (ev === 'opened') opened++;
              if (ev === 'charged') charged++;
              if (ev === 'passed' || ev === 'failed') {
                if (ev === 'passed') passed++; else failed++;
                if (pending) { lenSum += pending; lenN++; }
                ext += pendingExt; formExt += pendingFormExt;
                pendingExt = 0; pendingFormExt = 0;
              }
            }
          },
        });
      }
      console.log(`    ${c.toFixed(2)}  ${(opened / learners).toFixed(2).padStart(11)}   ${(lenN ? lenSum / lenN : 0).toFixed(2).padStart(11)}   ${(passed / learners).toFixed(2).padStart(6)}   ${(failed / learners).toFixed(2).padStart(15)}   ${(charged / learners).toFixed(2).padStart(15)}   ${(ext / Math.max(1, opened)).toFixed(2).padStart(22)}   ${(formExt / Math.max(1, opened)).toFixed(2).padStart(10)}`);
    }
  }
  if (process.env.LAB_GATE) {
    // Gate accuracy per cohort, measured off the served items: what fraction of
    // gate items each cohort answers cold. This is the only number a debt rule
    // can be calibrated against.
    for (const c of [0.95, 0.90, 0.80, 0.75, 0.70, 0.60, 0.50]) {
      let ck = 0, cl = 0, pr = 0, prc = 0;
      const bySk = new Map();
      for (let i = 0; i < N; i++) {
        runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
          knows: () => c, frozen: c !== 0.95, budget: c === 0.95 ? 220 : 40, record: false,
          watch: (e) => {
            if (e.kind === 'check') {
              ck++; if (e.tries === 1 && e.solved) cl++;
              const b = bySk.get(e.skill) || { n: 0, c: 0 }; b.n++; if (e.tries === 1 && e.solved) b.c++; bySk.set(e.skill, b);
            }
            if (e.kind === 'probe') { pr++; if (e.tries === 1 && e.solved) prc++; }
          },
        });
      }
      // By skill, for the two cohorts a gate has to separate. A gate floor that
      // is a level-wide ordinal rather than a level-wide demand shows up here
      // and nowhere else: one skill reading ten points below the others on the
      // knower row is a harder gate, not a stricter one, and the same skill
      // reading ten points below on the 0.70 row is what pays for it.
      console.log(`  k=${c.toFixed(2)}  gate items ${(ck / N).toFixed(1)}/learner  clean ${(100 * cl / ck).toFixed(1)}%   sight-read clean ${(100 * prc / Math.max(1, pr)).toFixed(1)}%`
        + (c === 0.95 || c === 0.70 ? '\n      by skill: ' + [...bySk].map(([k2, b]) => `${k2} ${(100 * b.c / b.n).toFixed(0)}%`).join(' ') : ''));
    }
  }
  if (process.env.LAB_NODE) {
    // The classifier table, asked of one named node instead of of whatever root
    // the router happens to serve first. Every other line is held and not due,
    // so this is the same psychometric question about a gate deep in the graph.
    console.log(`  the gate as a classifier, per skill (frozen learners, ${N} per cell, 40 items each)`);
    console.log('    skill            0.50   0.60   0.70   0.75   0.80   0.90   0.95   <- cleared it, ever, inside 40 items');
    for (const target of (process.env.LAB_NODE === '1' ? SKILLS : process.env.LAB_NODE.split(','))) {
      const cells = [];
      for (const c of [0.50, 0.60, 0.70, 0.75, 0.80, 0.90, 0.95]) {
        let ever = 0, seen = 0;
        for (let i = 0; i < N; i++) {
          const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
            knows: () => c, frozen: true, budget: 40, record: false, unlock: target,
          });
          if (!r.spent.get(target).items) continue;
          seen++;
          if (r.cleared.get(target)) ever++;
        }
        cells.push(`${(100 * ever / Math.max(1, seen)).toFixed(1)}%`.padStart(7));
      }
      console.log(`    ${target.padEnd(14)}${cells.join('')}`);
    }
  }
  if (process.env.LAB_MASTERY) {
    const M = Number(process.env.LAB_MASTERY);
    const rs = [];
    for (let i = 0; i < M; i++) rs.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', { record: false }));
    const sortedT = [...rs].sort((a, b) => a.theta - b.theta);
    const q1 = sortedT.slice(0, Math.floor(M / 5));
    console.log(`  true mastery ${(100 * rs.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / M).toFixed(1)}%  allten ${(100 * rs.filter((r) => r.trueMastered === SKILLS.length).length / M).toFixed(1)}%  Q1 ${(100 * q1.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / q1.length).toFixed(1)}%  anyHollow ${(100 * rs.filter((r) => r.hollow > 0).length / M).toFixed(1)}%`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// TAIL PROBE — `TAIL_PROBE=1 node tools/simulate.mjs` prints where a knower's
// slow clears actually go, item by item, and exits. Diagnostic only; it changes
// nothing the shipping run reads.
if (process.env.TAIL_PROBE) {
  const N = Number(process.env.TAIL_N || 400);
  const rows = [];
  for (let i = 0; i < N; i++) {
    const log = [];
    const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
      knows: () => 0.95, budget: 220, record: false, watch: (e) => log.push(e),
    });
    rows.push({ r, log, i });
  }
  const per = new Map(SKILLS.map((s) => [s, []]));
  for (const { r, log } of rows) {
    for (const s of SKILLS) {
      const c = r.cleared.get(s);
      if (!c) continue;
      const mine = log.filter((e) => e.skill === s).slice(0, c.items);
      per.get(s).push({ mins: c.seconds / 60, items: c.items, log: mine });
    }
  }
  const q = (xs, p) => { const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
  const all = [];
  for (const s of SKILLS) all.push(...per.get(s));
  const cut = q(all.map((x) => x.mins), 0.75);
  console.log(`TAIL PROBE — ${N} knowers, p75 cut = ${cut.toFixed(1)} min`);
  console.log('per skill: n, median min, p75, p90, share of all clears above the global p75');
  for (const s of SKILLS) {
    const xs = per.get(s);
    const m = xs.map((x) => x.mins);
    const slow = xs.filter((x) => x.mins > cut);
    console.log(`  ${s.padEnd(14)} n=${String(xs.length).padStart(4)} med ${q(m, 0.5).toFixed(1).padStart(5)} p75 ${q(m, 0.75).toFixed(1).padStart(5)} p90 ${q(m, 0.9).toFixed(1).padStart(5)}  slow ${String(slow.length).padStart(4)} (${(100 * slow.length / all.filter((x) => x.mins > cut).length).toFixed(1)}% of all slow clears)`);
  }
  // What the slow clears are made of.
  const slowAll = all.filter((x) => x.mins > cut);
  const kinds = new Map(); const bands = new Map(); const scaf = new Map();
  let missedSR = 0, srSeen = 0, checkAband = 0, checkItems = 0, secs = 0;
  for (const x of slowAll) {
    for (const e of x.log) {
      kinds.set(e.kind, (kinds.get(e.kind) || 0) + e.cost);
      bands.set(e.band, (bands.get(e.band) || 0) + 1);
      scaf.set(e.scaffold, (scaf.get(e.scaffold) || 0) + 1);
      secs += e.cost;
      if (e.kind === 'check') checkItems++;
    }
    if (x.log[0] && x.log[0].kind === 'probe') { srSeen++; if (x.log[0].tries > 1 || !x.log[0].solved) missedSR++; }
    // count how many times a run restarted: a check item with done===0 after
    // an earlier check item
    let sawCheck = false;
    for (const e of x.log) {
      if (e.kind === 'check') { if (sawCheck && e.check && e.check.done === 0) checkAband++; sawCheck = true; }
    }
  }
  console.log(`\nslow clears: ${slowAll.length} of ${all.length}, ${(secs / 60 / slowAll.length).toFixed(1)} min each on average`);
  console.log('  minutes by item kind:');
  for (const [k2, v] of [...kinds].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(k2).padEnd(10)} ${(v / 60 / slowAll.length).toFixed(2)} min/clear  (${(100 * v / secs).toFixed(1)}%)`);
  }
  console.log('  items by band: ' + [...bands].sort((a, b) => a[0] - b[0]).map(([b, n]) => `d${b}:${(n / slowAll.length).toFixed(1)}`).join('  '));
  console.log('  items by scaffold: ' + [...scaf].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b}:${(n / slowAll.length).toFixed(1)}`).join('  '));
  console.log(`  sight-read missed on ${missedSR} of ${srSeen} slow clears (${(100 * missedSR / Math.max(1, srSeen)).toFixed(1)}%)`);
  {
    // How the two roads split, over every clear and not just the slow ones: a
    // sight-read that lands, against one that does not and has to be climbed
    // back from.
    let a1 = 0, a1m = 0, b1 = 0, b1m = 0, a1i = 0, b1i = 0;
    for (const x of all) {
      const miss = x.log[0] && x.log[0].kind === 'probe' && (x.log[0].tries > 1 || !x.log[0].solved);
      if (miss) { b1++; b1m += x.mins; b1i += x.items; } else { a1++; a1m += x.mins; a1i += x.items; }
    }
    console.log(`  sight-read landed: ${a1} clears, ${(a1m / a1).toFixed(1)} min / ${(a1i / a1).toFixed(1)} items each`);
    {
      const miss = (x) => x.log[0] && x.log[0].kind === 'probe' && (x.log[0].tries > 1 || !x.log[0].solved);
      for (const [lab, set] of [['landed', all.filter((x) => !miss(x))], ['missed', all.filter(miss)]]) {
        const k2 = new Map(); let sec = 0;
        for (const x of set) for (const e of x.log) { k2.set(e.kind, (k2.get(e.kind) || 0) + e.cost); sec += e.cost; }
        console.log(`    ${lab}: ` + [...k2].sort((a2, b2) => b2[1] - a2[1]).map(([kk, v]) => `${kk} ${(v / 60 / set.length).toFixed(2)}min`).join('  '));
      }
      console.log('    missed-sight-read samples:');
      for (const x of all.filter(miss).sort((a2, b2) => b2.mins - a2.mins).slice(0, 6)) {
        console.log(`      ${x.mins.toFixed(1)}m ${x.items}i: ` + x.log.map((e) => `${e.kind[0]}${e.band}${e.scaffold === 'none' ? '' : e.scaffold[0]}${e.solved ? (e.tries > 1 ? '~' : '') : 'X'}`).join(' '));
      }
    }
    console.log(`  sight-read missed: ${b1} clears, ${(b1m / b1).toFixed(1)} min / ${(b1i / b1).toFixed(1)} items each  (${(100 * b1 / all.length).toFixed(1)}% of clears, ${(100 * b1m / (a1m + b1m)).toFixed(1)}% of all test-out minutes)`);
  }
  console.log(`  proving-run restarts after a miss: ${(checkAband / slowAll.length).toFixed(2)} per slow clear`);
  console.log(`  gate items per slow clear: ${(checkItems / slowAll.length).toFixed(1)}`);
  // Fast clears for contrast.
  const fastAll = all.filter((x) => x.mins <= cut);
  let fsecs = 0; const fkinds = new Map();
  for (const x of fastAll) for (const e of x.log) { fkinds.set(e.kind, (fkinds.get(e.kind) || 0) + e.cost); fsecs += e.cost; }
  console.log(`\nfast clears: ${fastAll.length}, ${(fsecs / 60 / fastAll.length).toFixed(1)} min each`);
  console.log('  minutes by item kind: ' + [...fkinds].sort((a, b) => b[1] - a[1]).map(([k2, v]) => `${k2} ${(v / 60 / fastAll.length).toFixed(2)}`).join('  '));
  // The first five items of a slow clear, for a handful of them.
  console.log('\nsample slow clears (kind/band/scaffold/solved):');
  for (const x of slowAll.slice(0, 8)) {
    console.log(`  ${x.mins.toFixed(1)} min, ${x.items} items: ` + x.log.map((e) => `${e.kind[0]}${e.band}${e.scaffold === 'none' ? '' : e.scaffold[0]}${e.solved ? '' : 'X'}`).join(' '));
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// TAIL WHY — `TAIL_WHY=1 node tools/simulate.mjs` answers one question and
// exits: for a learner who already knows the skill, where do the minutes above
// the median actually go, and which mechanism spent them. Diagnostic only.
//
// It reads the engine's own state before each item rather than inferring it
// from the trace, so "the run ended" and "the learner was re-taught ground they
// had already proved at the gate band" are counted, not guessed at.
if (process.env.TAIL_WHY) {
  const N = Number(process.env.TAIL_N || 300);
  const q = (xs, p) => { const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
  const med = (xs) => q(xs, 0.5);

  // --- 1. what the engine believes about each cohort at the gate ------------
  console.log('the gate record the engine actually reads (steadyAtGate), by hidden competence');
  console.log('  k      gate items/learner  miss per clean solve   items served while "steady"');
  for (const c of [0.95, 0.80, 0.75, 0.70, 0.60, 0.50]) {
    let seen = 0, clean = 0, steadyItems = 0, allItems = 0;
    for (let i = 0; i < Math.min(N, 200); i++) {
      let last = null;
      runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
        knows: () => c, frozen: c !== 0.95, budget: c === 0.95 ? 220 : 40, record: false,
        watch: (e) => { last = e.before; allItems++; if (e.before.steady) steadyItems++; },
      });
      if (last) { seen += last.gateSeen; clean += last.gateClean; }
    }
    const ratio = (seen - clean) / Math.max(1, clean);
    console.log(`  ${c.toFixed(2)}   ${(seen / Math.min(N, 200)).toFixed(1).padStart(8)}          ${ratio.toFixed(2).padStart(10)}            ${(100 * steadyItems / allItems).toFixed(1).padStart(6)}%`);
  }
  console.log('  (the engine calls a learner steady when that ratio is at or under gateFormTol)');

  // --- 2. where a knower's minutes go, item by item -------------------------
  const clears = [];
  for (let i = 0; i < N; i++) {
    const log = [];
    const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
      knows: () => 0.95, budget: 220, record: false, watch: (e) => log.push(e),
    });
    for (const s of SKILLS) {
      const c = r.cleared.get(s);
      if (!c) continue;
      clears.push({ skill: s, mins: c.seconds / 60, items: c.items, log: log.filter((e) => e.skill === s).slice(0, c.items) });
    }
  }
  const cut = q(clears.map((x) => x.mins), 0.75);
  const mins = clears.map((x) => x.mins);
  console.log(`\n${clears.length} clears by learners at hidden competence 0.95`);
  console.log(`  minutes  median ${med(mins).toFixed(1)}  p75 ${q(mins, 0.75).toFixed(1)}  p90 ${q(mins, 0.9).toFixed(1)}  mean ${(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(1)}`);
  const hist = new Map();
  for (const x of clears) hist.set(Math.min(15, x.items), (hist.get(Math.min(15, x.items)) || 0) + 1);
  console.log('  items to clear: ' + [...hist].sort((a, b) => a[0] - b[0]).map(([k2, v]) => `${k2 === 15 ? '15+' : k2}:${(100 * v / clears.length).toFixed(1)}%`).join('  '));

  // Every item of every clear, bucketed by what it was and what it cost.
  const bucket = new Map();
  const add = (name, secs) => { const b = bucket.get(name) || { n: 0, s: 0 }; b.n++; b.s += secs; bucket.set(name, b); };
  let ended = 0, charged = 0, opened = 0;
  for (const x of clears) {
    let provedGate = false;   // has this skill already produced a clean gate-band solve?
    for (const e of x.log) {
      const gate = e.kind === 'check' || e.kind === 'probe';
      const cleanItem = e.solved && e.tries === 1;
      if (gate) add(cleanItem ? `${e.kind} clean` : `${e.kind} missed`, e.cost);
      else add(`${e.kind} ${provedGate ? 'AFTER a clean gate solve' : 'before any gate evidence'}`, e.cost);
      if (gate && cleanItem && e.band >= 4) provedGate = true;
      for (const ev of e.events) { if (ev === 'failed') ended++; if (ev === 'charged') charged++; if (ev === 'opened') opened++; }
    }
  }
  const totalSecs = [...bucket.values()].reduce((a, b) => a + b.s, 0);
  console.log('\n  every item of every clear, by what it was:');
  for (const [k2, v] of [...bucket].sort((a, b) => b[1].s - a[1].s)) {
    console.log(`    ${k2.padEnd(42)} ${(v.n / clears.length).toFixed(2).padStart(5)} items/clear  ${(v.s / 60 / clears.length).toFixed(2).padStart(5)} min/clear  ${(100 * v.s / totalSecs).toFixed(1).padStart(5)}% of all test-out minutes`);
  }
  console.log(`\n  proving runs opened ${(opened / clears.length).toFixed(2)} per clear;  runs ended by a miss ${(ended / clears.length).toFixed(2)};  misses absorbed and charged ${(charged / clears.length).toFixed(2)}`);

  // The same split, but only over the clears above the p75 — the tail itself.
  const slow = clears.filter((x) => x.mins > cut);
  const sb = new Map();
  let sEnded = 0, sCharged = 0;
  for (const x of slow) {
    let provedGate = false;
    for (const e of x.log) {
      const gate = e.kind === 'check' || e.kind === 'probe';
      const cleanItem = e.solved && e.tries === 1;
      const name = gate ? `${e.kind} ${cleanItem ? 'clean' : 'missed'}`
        : `${e.kind} ${provedGate ? 'AFTER a clean gate solve' : 'before any gate evidence'}`;
      const b = sb.get(name) || { n: 0, s: 0 }; b.n++; b.s += e.cost; sb.set(name, b);
      if (gate && cleanItem && e.band >= 4) provedGate = true;
      for (const ev of e.events) { if (ev === 'failed') sEnded++; if (ev === 'charged') sCharged++; }
    }
  }
  const sSecs = [...sb.values()].reduce((a, b) => a + b.s, 0);
  console.log(`\n  the tail alone — ${slow.length} clears above ${cut.toFixed(1)} min, ${(sSecs / 60 / slow.length).toFixed(1)} min each:`);
  for (const [k2, v] of [...sb].sort((a, b) => b[1].s - a[1].s)) {
    console.log(`    ${k2.padEnd(42)} ${(v.n / slow.length).toFixed(2).padStart(5)} items/clear  ${(v.s / 60 / slow.length).toFixed(2).padStart(5)} min/clear  ${(100 * v.s / sSecs).toFixed(1).padStart(5)}%`);
  }
  console.log(`    runs ended by a miss ${(sEnded / slow.length).toFixed(2)} per tail clear;  misses charged ${(sCharged / slow.length).toFixed(2)}`);

  // How much of the tail is one skill.
  console.log('\n  by skill: median / p75 / p90 minutes, and share of the minutes above the p75');
  const slowSecs = new Map();
  for (const x of slow) slowSecs.set(x.skill, (slowSecs.get(x.skill) || 0) + x.mins);
  const slowTotal = [...slowSecs.values()].reduce((a, b) => a + b, 0);
  for (const s of SKILLS) {
    const xs = clears.filter((x) => x.skill === s).map((x) => x.mins);
    console.log(`    ${s.padEnd(14)} ${med(xs).toFixed(1).padStart(5)} ${q(xs, 0.75).toFixed(1).padStart(6)} ${q(xs, 0.9).toFixed(1).padStart(6)}    ${(100 * (slowSecs.get(s) || 0) / slowTotal).toFixed(1).padStart(5)}%`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// SITTINGS PROBE — `SITTINGS_PROBE=1 node tools/simulate.mjs [learners] [budget]`
//
// The across-days arm prints ONE number and it was believed for months. This
// prints the distribution under it, and the two facts the headline cannot
// carry: HOW MUCH WORK each arm actually got, and WHERE the run stopped.
//
// The reason it exists: `coming back across days` says "the same learners, the
// same N items, delivered in sittings" and then runs `sessions: 40` with no
// budget of its own. Whether that sentence is true is arithmetic — 40 sittings
// of 22 minutes buys about 1,000 items, and the single-sitting arm on the
// shipped route is handed 3,600 — so the two arms are matched on *neither*
// items nor minutes, and the comparison the file draws between them is a
// comparison of two different amounts of schooling. Diagnostic only; exits.
// ---------------------------------------------------------------------------
if (process.env.SITTINGS_PROBE) {
  const N = Number(process.env.PROBE_N || 120);
  const SESSIONS = Number(process.env.PROBE_SESSIONS || 40);
  const med = (xs) => { if (!xs.length) return NaN; const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const q = (xs, p) => { if (!xs.length) return NaN; const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  console.log(`SITTINGS PROBE — ${LATTICE}, ${SKILLS.length} skills, needs ${SKILLS_NEEDED} at true competence >= ${TRUE_MASTERY}`);
  console.log(`  ${N} learners per arm, item budget ${BUDGET}, sitting cap ${SESSIONS} x ${SESSION_MINUTES} min\n`);

  const arms = [];
  arms.push({ label: 'one unbroken sitting', opts: { record: false } });
  for (const gap of [24, 72]) {
    arms.push({ label: `sittings ${gap}h apart`, opts: { record: false, sessions: SESSIONS, sessionMinutes: SESSION_MINUTES, gapHours: gap } });
  }
  const big = Number(process.env.PROBE_SESSIONS_BIG || 0);
  if (big) for (const gap of [24, 72]) arms.push({ label: `sittings ${gap}h apart, cap ${big}`, opts: { record: false, sessions: big, sessionMinutes: SESSION_MINUTES, gapHours: gap } });
  if (process.env.PROBE_ARMS) {
    const want = process.env.PROBE_ARMS.split(',').map((x) => x.trim());
    for (let i = arms.length - 1; i >= 0; i--) if (!want.some((w) => arms[i].label.includes(w))) arms.splice(i, 1);
  }

  const rowsOf = (opts) => {
    const rs = [];
    for (let i = 0; i < N; i++) rs.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', opts));
    return rs;
  };

  console.log('  arm                                items     minutes  sittings  items/sitting   engine-held   TRUE >= bar');
  const store = {};
  for (const a of arms) {
    const rs = rowsOf(a.opts);
    store[a.label] = rs;
    const items = rs.map((r) => r.items);
    const mins = rs.map((r) => r.seconds / 60);
    const sit = rs.map((r) => r.sessionTrace.length || 1);
    const held = rs.map((r) => r.engineMastered);
    const got = rs.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rs.length;
    console.log(`  ${a.label.padEnd(34)} ${med(items).toFixed(0).padStart(5)} ${med(mins).toFixed(0).padStart(11)} ${med(sit).toFixed(0).padStart(9)} ${(med(items) / med(sit)).toFixed(1).padStart(14)} ${mean(held).toFixed(1).padStart(13)} ${(100 * got).toFixed(1).padStart(12)}%`);
  }

  console.log('\n  WHY EACH RUN STOPPED (the number the headline cannot carry)');
  for (const a of arms) {
    const rs = store[a.label];
    const budgetOut = rs.filter((r) => r.items >= BUDGET).length;
    const sitOut = rs.filter((r) => a.opts.sessions && r.sessionTrace.length >= a.opts.sessions).length;
    console.log(`  ${a.label.padEnd(34)} budget exhausted ${(100 * budgetOut / rs.length).toFixed(0).padStart(3)}%   sitting cap hit ${(100 * sitOut / rs.length).toFixed(0).padStart(3)}%`);
  }

  console.log('\n  DISTRIBUTION of skills truly mastered (not the >= bar headline)');
  for (const a of arms) {
    const rs = store[a.label];
    const t = rs.map((r) => r.trueMastered);
    console.log(`  ${a.label.padEnd(34)} min ${Math.min(...t)}  p10 ${q(t, 0.1)}  median ${med(t)}  p90 ${q(t, 0.9)}  max ${Math.max(...t)}   mean ${mean(t).toFixed(1)} of ${SKILLS.length}   (bar is ${SKILLS_NEEDED})`);
  }

  console.log('\n  THE SAME COHORT SCORED AT EVERY BAR, so "0.0%" can be read as a shortfall rather than a collapse');
  console.log('    arm                              >=' + [4, 8, 12, 16, 20, SKILLS_NEEDED, SKILLS.length].map((b) => String(b).padStart(7)).join('  >='));
  for (const a of arms) {
    const rs = store[a.label];
    const cells = [4, 8, 12, 16, 20, SKILLS_NEEDED, SKILLS.length]
      .map((b) => `${(100 * rs.filter((r) => r.trueMastered >= b).length / rs.length).toFixed(0)}%`.padStart(9));
    console.log(`    ${a.label.padEnd(32)}${cells.join('')}`);
  }

  console.log('\n  PER-SITTING TRACE (first sitting-based arm, median learner-wise): sitting -> items, engine-held, truly-held');
  if (arms.some((a) => a.opts.sessions)) {
    const rs = store[arms.find((a) => a.opts.sessions).label];
    const maxS = Math.max(...rs.map((r) => r.sessionTrace.length));
    for (let n = 1; n <= maxS; n++) {
      const at = rs.map((r) => r.sessionTrace[n - 1]).filter(Boolean);
      if (!at.length) continue;
      if (n % 4 && n !== maxS && n !== 1) continue;
      console.log(`    sitting ${String(n).padStart(2)}  items ${med(at.map((x) => x.items)).toFixed(0).padStart(5)}   engine-held ${mean(at.map((x) => x.engineMastered)).toFixed(1).padStart(5)}   truly-held ${mean(at.map((x) => x.trueMastered)).toFixed(1).padStart(5)}   durable ${mean(at.map((x) => x.durable)).toFixed(1).padStart(5)}`);
    }
  }

  console.log('\n  WHAT THE RELOAD COSTS (first sitting-based arm, identical seeds, AB_NORELOAD is the control)');
  if (arms.some((a) => a.opts.sessions)) {
    const rs = store[arms.find((a) => a.opts.sessions).label];
    console.log(`    claims withdrawn by a reload   ${(rs.reduce((a, r) => a + r.withdrawnOnLoad, 0) / rs.length).toFixed(2)} per learner   ${(100 * rs.filter((r) => r.withdrawnOnLoad > 0).length / rs.length).toFixed(1)}% of learners`);
    console.log(`    distinct lines it touched      ${(rs.reduce((a, r) => a + r.withdrawnLines, 0) / rs.length).toFixed(2)} per learner`);
  }

  console.log('\n  DURABLE STRENGTH AT THE BUZZER — the thing a longer gap has to be paid for out of');
  for (const a of arms) {
    const rs = store[a.label];
    const all = rs.flatMap((r) => SKILLS.map((s2) => r.strength.get(s2)));
    const atCap = all.filter((x) => x >= 60).length / all.length;
    const one = all.filter((x) => x < 2).length / all.length;
    const keepOf = (S, h) => Math.pow(1 + h / (24 * S), -GAP_POW);
    const h = a.opts.gapHours || 24;
    const cost = all.map((S) => 1 - keepOf(S, h));
    console.log(`  ${a.label.padEnd(34)} median S ${med(all).toFixed(1).padStart(5)}   at the cap(60) ${(100 * atCap).toFixed(0).padStart(3)}%   never re-probed across a gap ${(100 * one).toFixed(0).padStart(3)}%   this gap costs ${(100 * mean(cost)).toFixed(1)}% of the above-floor competence (median ${(100 * med(cost)).toFixed(1)}%)`);
  }

  console.log('\n  ITEMS-MATCHED CONTROL — the single sitting cut to the work the daily arm actually got');
  if (store['sittings 24h apart']) {
    const rs = store['sittings 24h apart'];
    const budget = Math.round(mean(rs.map((r) => r.items)));
    const one = [];
    for (let i = 0; i < N; i++) one.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', { record: false, budget }));
    const got = one.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / one.length;
    const daily = rs.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rs.length;
    console.log(`    one sitting of ${budget} items       ${(100 * got).toFixed(1)}%   mean truly-held ${mean(one.map((r) => r.trueMastered)).toFixed(1)} of ${SKILLS.length}`);
    console.log(`    ${SESSIONS} sittings, same ${budget} items    ${(100 * daily).toFixed(1)}%   mean truly-held ${mean(rs.map((r) => r.trueMastered)).toFixed(1)} of ${SKILLS.length}`);
    console.log('    (this is the ONLY like-for-like comparison of the two shapes. The headline pair is not one.)');
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// SCHEDULE A/B — `SCHED_AB=1 node tools/simulate.mjs [learners] [budget]`
//
// The scheduler half of the cadence question, graded. Every candidate below is
// a change to the SCHEDULE — which re-probe comes round when, and what a single
// missed one costs the ladder. None of them touches a gate: the proving run,
// the form floor, `durableMinutes` and the two-miss rule are byte-identical in
// every arm, and the classifier table is measured separately and must not move.
//
// Both cadences are run for every candidate, on identical seeds, because a
// ladder graded against a daily returner is a ladder graded against one
// customer. That is how the shipping one came to top out at 130 hours: at 24 h
// that is 5.4 nights and a proved line rests five sittings, and at 72 h it is
// 1.8 gaps and NOTHING EVER RESTS.
//
// Diagnostic only. It exits; no shipping figure passes through it.
// ---------------------------------------------------------------------------
if (process.env.SCHED_AB) {
  const N = Number(process.env.PROBE_N || 60);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const SHIP = DEFAULT_MASTERY.reviewMinutes.join(',');
  /* Each candidate is [label, reviewMinutes, CFG]. The environment is what
     `configure()` reads, so a candidate is applied by writing it and every arm
     of one process shares the expensive setup above. */
  const CANDIDATES = (process.env.SCHED_ONLY ? [] : [
    ['shipping                       ' + SHIP, SHIP, ''],
    ['+ one rung   ' + SHIP + ',19500', SHIP + ',19500', ''],
    ['+ two rungs  ' + SHIP + ',19500,48750', SHIP + ',19500,48750', ''],
    ['tighter early (design doc)     10,180,720,1800,4320,10080', '10,180,720,1800,4320,10080', ''],
    ['tighter early + two rungs      10,180,720,1800,4320,10080,25200,63000', '10,180,720,1800,4320,10080,25200,63000', ''],
    ['lapse steps the rung down, shipping ladder', SHIP, 'lapseStep=1'],
    ['+ two rungs AND the lapse step', SHIP + ',19500,48750', 'lapseStep=1'],
  ]).concat((process.env.SCHED_EXTRA || '').split(';').filter(Boolean).map((spec) => {
    const [label, mins, cfg] = spec.split('|');
    return [label, mins || SHIP, cfg || ''];
  }));

  console.log(`SCHEDULE A/B — ${LATTICE}, ${SKILLS.length} skills, needs ${SKILLS_NEEDED} at true competence >= ${TRUE_MASTERY}`);
  console.log(`  ${N} learners an arm, identical seeds, budget ${BUDGET}, ${SESSION_MINUTES}-minute sittings`);
  console.log('  every arm keeps the same gate: the proving run, the form floor, durableMinutes and the two-miss rule\n');
  console.log('  candidate                                                        cadence  true mastery    Q1     +7d    +30d  truly held  engine held  hollow/learner  of which k<bar  a hole  hollow lines  hollow/claim  re-probes  demotions  new ground');
  const envMins = process.env.SIM_MINUTES, envCfg = process.env.CFG;
  for (const [label, mins, cfg] of CANDIDATES) {
    for (const gap of [24, 72]) {
      process.env.SIM_MINUTES = mins;
      if (cfg) process.env.CFG = envCfg ? `${envCfg},${cfg}` : cfg; else if (envCfg) process.env.CFG = envCfg; else delete process.env.CFG;
      const rows = [];
      let newGround = 0, allItems = 0;
      for (let i = 0; i < N; i++) {
        rows.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
          /* SCHED_DAYS bounds the CALENDAR instead of the item budget — the
             regime a school actually buys, and the one where a longer terminal
             rung can cost what it buys elsewhere, because a line parked past
             the end of term is never re-probed at all. Unset, the arm is
             budget-matched exactly as the headline is. */
          record: false, sessions: Number(process.env.SCHED_DAYS) || BUDGET,
          sessionMinutes: SESSION_MINUTES, gapHours: gap,
          /* SCHED_DECAY pins the FORGETTING clock while the scheduling clock
             moves, so a scheduling change can be graded against a learner who
             forgets at a rate the model is not being asked to decide. See the
             2x2 under `coming back across days`. */
          decayHours: process.env.SCHED_DECAY ? Number(process.env.SCHED_DECAY) : undefined,
          watch: (e) => {
            allItems++;
            if (!e.everHeld && (e.kind === 'learn' || e.kind === 'check' || e.kind === 'probe')) newGround++;
          },
        }));
      }
      const got = 100 * rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rows.length;
      const byTheta = [...rows].sort((x, y) => x.theta - y.theta);
      const fifth = byTheta.slice(0, Math.max(1, Math.floor(byTheta.length / 5)));
      const q1 = 100 * fifth.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / fifth.length;
      const anyHS = 100 * rows.filter((r) => r.hollowStrict > 0).length / rows.length;
      /* A LONGER RUNG IS A CHEAPER SCHEDULE AND IT IS NOT FREE, so the two
         columns that catch it are here rather than in a follow-up: the same
         learners scored a week and a month after their last item, taught
         nothing in between. `design/MASTERY-TAIL-AND-RETENTION.md` §6e measured
         a slow ladder at 11.5% after thirty days against 48.0%, which is
         exactly the trade a longer terminal rung can buy without saying so. */
      const after = (d) => 100 * rows.map((r) => scoreAfter(r, d)).filter((x) => x.trueMastered >= SKILLS_NEEDED).length / rows.length;
      const cl = rows.flatMap((r) => r.claims);
      const clBad = cl.filter((c) => c.k < HOLLOW || c.holes > 0 || c.surface < HOLLOW).length;
      /* A HOLLOW CLAIM HAS TWO CAUSES AND THEY DO NOT HAVE THE SAME FIX.
         `hollowAtEnd` is the aggregate: the line is held and the learner is
         genuinely under the bar, which is ROT the schedule did not catch.
         The strict set adds a line held over a shape that was served and never
         once solved, and a line whose WEAKEST SURFACE is under the bar, which
         are bank and routing defects. A schedule change can only be judged on
         the first of them, so it is printed on its own. */
      const anyOld = 100 * rows.filter((r) => r.hollowAtEnd.length > 0).length / rows.length;
      const anyHole = 100 * rows.filter((r) => [...r.servedHoleSet].some((x) => r.engineMasteredSet.has(x))).length / rows.length;
      console.log(`  ${(gap === 24 ? label : '').padEnd(64)} ${String(gap + 'h').padStart(6)}  ${got.toFixed(1).padStart(11)}%  ${q1.toFixed(1).padStart(4)}%  ${after(7).toFixed(1).padStart(5)}%  ${after(30).toFixed(1).padStart(5)}%  ${mean(rows.map((r) => r.trueMastered)).toFixed(1).padStart(8)}/${SKILLS.length}  ${mean(rows.map((r) => r.engineMastered)).toFixed(1).padStart(7)}/${SKILLS.length}  ${anyHS.toFixed(1).padStart(13)}%  ${anyOld.toFixed(1).padStart(13)}%  ${anyHole.toFixed(1).padStart(5)}%  ${mean(rows.map((r) => r.hollowAtEndStrict.length)).toFixed(2).padStart(12)}  ${(100 * clBad / Math.max(1, cl.length)).toFixed(2).padStart(11)}%  ${mean(rows.map((r) => r.reviewsServed)).toFixed(0).padStart(9)}  ${mean(rows.map((r) => r.demotions)).toFixed(1).padStart(9)}  ${(100 * newGround / Math.max(1, allItems)).toFixed(1).padStart(9)}%`);
    }
  }
  if (envMins) process.env.SIM_MINUTES = envMins; else delete process.env.SIM_MINUTES;
  if (envCfg) process.env.CFG = envCfg; else delete process.env.CFG;
  console.log('\n  NEW GROUND is the share of every item served that went to a line this learner has never proved.');
  console.log('  A schedule that cannot rest a proved line spends the sitting re-asking questions it has already had answered.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CADENCE PROBE — `CADENCE_PROBE=1 node tools/simulate.mjs [learners] [budget]`
//
// IS THE EVERY-THIRD-DAY FIGURE THE FORGETTING MODEL, OR IS IT THE SCHEDULER?
//
// Those are different problems with different fixes and for as long as one
// number carried both, neither could be worked on. The block below is the
// experiment that separates them, and it is a 2x2 rather than an argument.
//
// `gapHours` was two mechanisms wearing one name:
//
//   the SCHEDULING clock   what the engine is told — which re-probe has come
//                          round, whether a pass crossed a real gap and counts
//                          as durable, whether a belief has gone stale, whether
//                          this is a new sitting at all.
//   the FORGETTING clock   how much memory the wait costs. Nothing in the
//                          engine can see this; it is the learner model.
//
// Cross them:
//
//   sched 24 / forget 24   the daily arm, as shipped
//   sched 72 / forget 72   the every-third-day arm, as shipped
//   sched 72 / forget 24   THE SCHEDULER ALONE. The engine meets a three-day
//                          cadence — its ladder, its durability rule, its
//                          staleness — while the learner forgets one night's
//                          worth. Whatever this arm loses against the daily
//                          arm is a scheduling defect and is fixable without
//                          touching a forgetting constant.
//   sched 24 / forget 72   THE MODEL ALONE. The engine sees a daily returner;
//                          the learner forgets as if three nights had passed.
//                          Whatever this arm loses is the forgetting model.
//
// A fifth arm changes the LAW rather than either clock: `decayMode: 'elapsed'`
// applies the power law once over the real time since a line was last
// practised, instead of applying it again at every sitting boundary. Composing
// a power law with itself is an exponential, which is the curve this file's own
// header says does not fit meaningful material. Same constants, same floor,
// same strength term.
//
// Diagnostic only. It exits; no shipping figure passes through it.
// ---------------------------------------------------------------------------
if (process.env.CADENCE_PROBE) {
  const N = Number(process.env.PROBE_N || 120);
  const med = (xs) => { if (!xs.length) return NaN; const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  console.log(`CADENCE PROBE — ${LATTICE}, ${SKILLS.length} skills, needs ${SKILLS_NEEDED} at true competence >= ${TRUE_MASTERY}`);
  console.log(`  ${N} learners an arm, identical seeds, item budget ${BUDGET}, ${SESSION_MINUTES}-minute sittings`);
  console.log(`  PERMA ${PERMA}   exponent ${GAP_POW}   growth ${GAP_GROWTH}   strength cap 60\n`);

  const LAW = process.env.SIM_LAW || 'iterated';
  /* PROBE_ARMS is a comma-separated list of substrings; only the arms whose
     label matches one of them are run. It exists so a sensitivity question —
     "what does this cadence read under a different pair of constants" — costs
     two arms rather than six. */
  const WANT = (process.env.PROBE_ARMS || '').split(',').map((x) => x.trim()).filter(Boolean);
  const ARMS = [
    ['daily — shipping', 24, 24, LAW],
    ['every third day — shipping', 72, 72, LAW],
    ['SCHEDULER ALONE  72h clock, 24h loss', 72, 24, LAW],
    ['MODEL ALONE      24h clock, 72h loss', 24, 72, LAW],
    ['every third day, elapsed-time law', 72, 72, 'elapsed'],
    ['every day, elapsed-time law', 24, 24, 'elapsed'],
  ].filter(([label]) => !WANT.length || WANT.some((w) => label.includes(w)));
  const EARLY = 600;  // the first ten minutes of a sitting, in seconds
  const store = [];
  for (const [label, sched, forget, mode] of ARMS) {
    const rows = [];
    // What the learner MET, bucketed by where in the sitting it fell. `early`
    // is the opening ten minutes of every sitting after the first — the frame
    // the question is actually about.
    const early = {}, late = {};
    let earlyN = 0, lateN = 0;
    /* WHERE THE ITEMS WENT, and what became of the line they went to.
       The re-entry table below says what a returning learner MEETS. This says
       what the whole run was SPENT ON, classified at the buzzer by whether the
       line it was spent on ever got there — which is the only reading that can
       tell a schedule that is maintaining knowledge apart from one that is
       paying twice for ground it keeps losing. Nothing here is a model
       assumption: it is items, seconds, and the hidden competence at the end. */
    const went = {};          // `${kind}|${outcome}` -> { n, sec }
    let warmDurable = 0, coldDurable = 0;
    for (let i = 0; i < N; i++) {
      const bump = (bag, kind) => { bag[kind] = (bag[kind] || 0) + 1; };
      const mine = new Map();  // skill -> Map(kind -> {n, sec})
      rows.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
        record: false, sessions: BUDGET, sessionMinutes: SESSION_MINUTES,
        gapHours: sched, decayHours: forget, decayMode: mode,
        watch: (e) => {
          let m = mine.get(e.skill);
          if (!m) { m = new Map(); mine.set(e.skill, m); }
          const cell = m.get(e.kind) || { n: 0, sec: 0 };
          cell.n += 1; cell.sec += e.cost;
          m.set(e.kind, cell);
          /* A re-probe that came back right ON THE FIRST ASK, cold, after a
             real gap, against one that only came back right on the lapse probe
             two minutes later — after the echo had just answered it. Both buy
             the same durable credit today. They are not the same evidence. */
          if (e.kind === 'review' && e.solved) {
            if (e.lapsingBefore) warmDurable++; else if (e.firstTryOK) coldDurable++;
          }
          if (e.sitting < 2) return;
          // A held line that is due, or one caught lapsing, is RECOVERY. A line
          // that has never been proved is NEW GROUND. The distinction is the
          // whole question.
          const bag = e.atSecond < EARLY ? early : late;
          if (e.atSecond < EARLY) earlyN++; else lateN++;
          if (e.kind === 'review') bump(bag, 'recovery: due re-probe');
          else if (e.kind === 'retrieval') bump(bag, 'recovery: interleaved');
          else if (e.kind === 'deep') bump(bag, 'sounding');
          else if (e.heldBeforeItem) bump(bag, 'recovery: other, held line');
          else if (e.everHeld) bump(bag, 're-proving a line that fell');
          else if (e.kind === 'check' || e.kind === 'probe') bump(bag, 'new ground: proving run');
          else bump(bag, 'new ground: teaching');
        },
      }));
      const r = rows[rows.length - 1];
      for (const [sk, m] of mine) {
        /* Three outcomes, and they are read off the hidden truth and the
           engine's own save, never off anything the schedule believes:
           ARRIVED  the learner really holds it at the buzzer;
           CLAIMED  the engine holds it and the learner does not;
           LOST     neither. */
        const truly = r.k.get(sk) >= TRUE_MASTERY;
        const claimed = r.engineMasteredSet.has(sk);
        const outcome = truly ? 'arrived' : claimed ? 'claimed only' : 'lost';
        for (const [kind, cell] of m) {
          const key = `${kind}|${outcome}`;
          const at = went[key] || { n: 0, sec: 0 };
          at.n += cell.n; at.sec += cell.sec;
          went[key] = at;
        }
      }
    }
    store.push({ label, sched, forget, mode, rows, early, late, earlyN, lateN, went, warmDurable, coldDurable });
  }

  console.log('  THE 2x2 — the same seeds, the same bank, the same budget; only the two clocks move');
  console.log('  arm                                     sched  loss   true mastery   Q1     truly held   engine held   hollow(NEW)');
  for (const a of store) {
    const got = 100 * a.rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / a.rows.length;
    const byTheta = [...a.rows].sort((x, y) => x.theta - y.theta);
    const fifth = byTheta.slice(0, Math.max(1, Math.floor(byTheta.length / 5)));
    const q1 = 100 * fifth.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / fifth.length;
    const anyHS = 100 * a.rows.filter((r) => r.hollowStrict > 0).length / a.rows.length;
    console.log(`  ${a.label.padEnd(38)} ${String(a.sched + 'h').padStart(4)}  ${String(a.forget + 'h').padStart(4)}${a.mode === 'elapsed' ? '*' : ' '} ${got.toFixed(1).padStart(11)}%  ${q1.toFixed(1).padStart(5)}%  ${mean(a.rows.map((r) => r.trueMastered)).toFixed(1).padStart(8)}/${SKILLS.length}  ${mean(a.rows.map((r) => r.engineMastered)).toFixed(1).padStart(9)}/${SKILLS.length}  ${anyHS.toFixed(1).padStart(9)}%`);
  }
  console.log('  (* = the power law taken ONCE over the elapsed time since the line was last practised,');
  console.log('   rather than applied again at every sitting boundary. Same constants.)');

  console.log('\n  WHAT IT COST, MECHANISM BY MECHANISM');
  console.log('  arm                                     mean k   k on held lines   demotions/learner   lapsed at buzzer   durable/learner');
  for (const a of store) {
    const kHeld = [];
    for (const r of a.rows) for (const s2 of r.engineMasteredSet) kHeld.push(r.k.get(s2));
    console.log(`  ${a.label.padEnd(38)} ${mean(a.rows.map((r) => r.avg)).toFixed(3).padStart(6)}   ${(kHeld.length ? mean(kHeld) : NaN).toFixed(3).padStart(15)}   ${mean(a.rows.map((r) => r.demotions)).toFixed(1).padStart(17)}   ${mean(a.rows.map((r) => r.lapsed)).toFixed(2).padStart(16)}   ${med(a.rows.map((r) => r.durable)).toFixed(0).padStart(15)}`);
  }

  console.log('\n  THE CHURN — a claim lost mid-sitting, by the mechanism that took it');
  console.log('  arm                                     re-probes served   right first try   lapses opened   demoted by a lapse   demoted by the form floor');
  for (const a of store) {
    const rs = mean(a.rows.map((r) => r.reviewsServed));
    const rc = mean(a.rows.map((r) => r.reviewsClean));
    console.log(`  ${a.label.padEnd(38)} ${rs.toFixed(0).padStart(16)}   ${(100 * rc / Math.max(1e-9, rs)).toFixed(1).padStart(14)}%   ${mean(a.rows.map((r) => r.lapsesOpened)).toFixed(1).padStart(13)}   ${mean(a.rows.map((r) => r.demoBy.lapse)).toFixed(1).padStart(18)}   ${mean(a.rows.map((r) => r.demoBy.formFloor)).toFixed(1).padStart(25)}`);
  }

  console.log('\n  DURABLE STRENGTH, AND WHAT ONE GAP IS THEREFORE WORTH');
  console.log('  arm                                     median S   at the cap   never crossed a gap   this gap costs   one line, ten sittings untouched');
  for (const a of store) {
    const all = a.rows.flatMap((r) => SKILLS.map((s2) => r.strength.get(s2)));
    const keepOf = (S, h) => Math.pow(1 + h / (GAP_HOURS * S), -GAP_POW);
    const cost = all.map((S) => 1 - keepOf(S, a.forget));
    // What the two LAWS say about the same line and the same wait, so the
    // difference between them is a number and not a claim about composition.
    const S = med(all);
    const ten = a.mode === 'elapsed'
      ? 1 - keepOf(S, a.forget * 10)
      : 1 - Math.pow(keepOf(S, a.forget), 10);
    console.log(`  ${a.label.padEnd(38)} ${med(all).toFixed(1).padStart(8)}   ${(100 * all.filter((x) => x >= 60).length / all.length).toFixed(0).padStart(9)}%   ${(100 * all.filter((x) => x < 2).length / all.length).toFixed(0).padStart(18)}%   ${(100 * mean(cost)).toFixed(1).padStart(13)}%   ${(100 * ten).toFixed(1).padStart(31)}%`);
  }
  console.log('  (the last column is the same line and the same wait under each arm\'s own law: what ten');
  console.log('   sittings of being left alone take off the competence a line holds above its floor.)');

  console.log('\n  WHAT A RETURNING LEARNER MEETS FIRST — every sitting after the first, opening 10 minutes');
  const KINDS = ['recovery: due re-probe', 'recovery: interleaved', 'recovery: other, held line',
    're-proving a line that fell', 'new ground: proving run', 'new ground: teaching', 'sounding'];
  console.log('  arm                                     ' + KINDS.map((k2) => k2.slice(0, 12).padStart(13)).join(''));
  for (const a of store) {
    console.log(`  ${a.label.padEnd(38)} ` + KINDS.map((k2) => `${(100 * (a.early[k2] || 0) / Math.max(1, a.earlyN)).toFixed(1)}%`.padStart(13)).join(''));
  }
  console.log('  …and the rest of the sitting, for comparison');
  for (const a of store) {
    console.log(`  ${a.label.padEnd(38)} ` + KINDS.map((k2) => `${(100 * (a.late[k2] || 0) / Math.max(1, a.lateN)).toFixed(1)}%`.padStart(13)).join(''));
  }
  console.log('\n  WHERE THE WHOLE RUN WENT — every item of every learner, by what the schedule called it');
  console.log('  and by what became of the line it was spent on. ARRIVED = the learner really holds it at');
  console.log('  the buzzer; CLAIMED ONLY = the engine holds it and the learner does not; LOST = neither.');
  {
    const KIND = ['learn', 'probe', 'check', 'review', 'retrieval', 'deep'];
    const OUT = ['arrived', 'claimed only', 'lost'];
    console.log('  arm                                     ' + KIND.map((k2) => k2.padStart(11)).join('') + '        total');
    for (const a of store) {
      const tot = Object.values(a.went).reduce((x, c) => x + c.n, 0);
      for (const o of OUT) {
        const cells = KIND.map((k2) => {
          const c = a.went[`${k2}|${o}`];
          return `${(100 * (c ? c.n : 0) / Math.max(1, tot)).toFixed(1)}%`.padStart(11);
        });
        const row = KIND.reduce((x, k2) => x + (a.went[`${k2}|${o}`]?.n || 0), 0);
        console.log(`  ${(o === 'arrived' ? a.label : '').padEnd(38)} ${o.padEnd(13)}`.slice(0, 39) + cells.join('') + `${(100 * row / Math.max(1, tot)).toFixed(1)}%`.padStart(13));
      }
      const lost = KIND.reduce((x, k2) => x + (a.went[`${k2}|lost`]?.n || 0), 0);
      const lostSec = KIND.reduce((x, k2) => x + (a.went[`${k2}|lost`]?.sec || 0), 0);
      const allSec = Object.values(a.went).reduce((x, c) => x + c.sec, 0);
      console.log(`    ${a.label.padEnd(38)} spent on lines that never arrived: ${(100 * lost / Math.max(1, tot)).toFixed(1)}% of items, ${(100 * lostSec / Math.max(1, allSec)).toFixed(1)}% of the seconds`);
    }
    console.log('\n  RE-PROBES PASSED COLD vs PASSED WARM — both buy the same durable credit today');
    console.log('  arm                                     passed cold, first ask   passed only on the lapse probe (2 min later, after the echo)');
    for (const a of store) {
      const t = a.warmDurable + a.coldDurable;
      console.log(`  ${a.label.padEnd(38)} ${`${(100 * a.coldDurable / Math.max(1, t)).toFixed(1)}%`.padStart(22)}   ${`${(100 * a.warmDurable / Math.max(1, t)).toFixed(1)}%`.padStart(22)}`);
    }
  }

  console.log('  RECOVERY is a line that already stands being re-proved before it lapses; NEW GROUND is a');
  console.log('  line that has never been proved. A returning learner who meets new ground first is a');
  console.log('  scheduling defect. A returning learner who meets recovery first and still loses the line');
  console.log('  is a forgetting-model finding, and no amount of re-ordering will fix it.');
  process.exit(0);
}

console.log(`ASCENT — mastery simulation`);
console.log(`${LEARNERS} synthetic learners, budget ${BUDGET} items each, ${SKILLS.length} skills\n`);

console.log('measured difficulty ladder (mean demandOf over the real bank, ' + SAMPLES + ' items per cell)');
console.log('  skill            d1     d2     d3     d4     d5');
for (const s of SKILLS) {
  console.log(`  ${s.padEnd(14)} ` + RAW[s].map((m) => m.toFixed(2).padStart(6)).join(' '));
}
console.log('  ' + (ladderBroken.length
  ? `LADDER NOT MONOTONE for: ${ladderBroken.join(', ')}`
  : 'every skill rises strictly d1 -> d5, so the bands mean something'));
{
  // Monotone *inside* a skill is not the same thing as comparable *across*
  // skills. Over this level a band-5 item runs from demandOf 6.9 to 10.1, so
  // "band 5" names ten different questions, and the gate caps the sight-read's
  // demand at the hardest one the rest of the level can actually offer. That
  // cap is a claim about the bank, so it is printed and checkable.
  const probe = new MasteryEngine(graph);
  const want = Math.max(probe.cfg.checkMinDifficulty, probe.cfg.sightReadBand);
  const bands = SKILLS.map((s) => probe.sightReadBandFor(s));
  const capped = SKILLS.filter((s, i) => bands[i] < want);
  console.log('  sight-read band: ' + SKILLS.map((s, i) => `${s} d${bands[i]}`).join(', '));
  console.log('  ' + (capped.length
    ? `demand-capped: ${capped.map((s) => `${s} (d${want} measures ${RAW[s][want - 1].toFixed(2)}, above every other skill's d${want}; served at d${bands[SKILLS.indexOf(s)]} = ${RAW[s][bands[SKILLS.indexOf(s)] - 1].toFixed(2)}, still the hardest gate in the level)`).join('; ')}`
    : `no skill is a demand outlier at band ${want}, so none is capped`));
}
console.log('  response demand runs ' + DEMAND_LO.toFixed(2) + ' .. ' + DEMAND_HI.toFixed(2) + ', shape taken from the bank');
console.log(`  ${(100 * FEEDBACK_RATE).toFixed(1)}% of ${fbAll} tagged slips are answered with computed mathematics, not the prompt restated;`);
console.log('  only those earn the elaborated-feedback gain — the rest are worth a studied example\n');

const results = [];
for (let i = 0; i < LEARNERS; i++) results.push(runLearner((i * 2654435761 + 12345) >>> 0));

// The falsification arms: identical learners, identical bank, identical decay,
// a different hand on the tiller.
const CONTROL_N = Math.min(LEARNERS, 400);
const arm = (policy, opts = {}) => {
  let reached = 0;
  for (let i = 0; i < CONTROL_N; i++) {
    const r = runLearner((i * 2654435761 + 12345) >>> 0, policy, { record: false, ...opts });
    if (r.trueMastered >= SKILLS_NEEDED) reached++;
  }
  return reached / CONTROL_N;
};
const armNull = arm('null');
const armWorst = arm('worst');
// The router this replaced, driving the same engine: due review first, then the
// unmastered skill with the lowest posterior. It is the arm that matters most,
// because it is the one a reader would otherwise assume the gain came free from.
const armLegacy = arm('engine', { legacyRouter: true });

const pct = (n) => `${(100 * n / LEARNERS).toFixed(1)}%`;
const reached = results.filter((r) => r.trueMastered >= SKILLS_NEEDED).length;
const allTen = results.filter((r) => r.trueMastered === SKILLS.length).length;
const engineAll = results.filter((r) => r.engineMastered === SKILLS.length).length;
const anyHollow = results.filter((r) => r.hollow > 0).length;
// The same count under the stricter definition — see `score`. It is expected to
// be the larger of the two and it is the one to believe.
const anyHollowStrict = results.filter((r) => r.hollowStrict > 0).length;

console.log('growth of true mastery (hidden competence >= ' + TRUE_MASTERY + ' on >= ' + SKILLS_NEEDED + '/' + SKILLS.length + ' skills)');
for (const c of CHECKPOINTS) {
  const at = results.map((r) => r.trace.find((t) => t.at === c)).filter(Boolean);
  if (!at.length) continue;
  const got = at.filter((t) => t.trueMastered >= SKILLS_NEEDED).length;
  const bar = '█'.repeat(Math.round(40 * got / at.length)).padEnd(40, '·');
  console.log(`  after ${String(c).padStart(4)} items  ${bar} ${(100 * got / at.length).toFixed(1)}%`);
}

console.log('\nby ability quintile (theta)');
const sorted = [...results].sort((a, b) => a.theta - b.theta);
const q = Math.floor(sorted.length / 5);
for (let i = 0; i < 5; i++) {
  const slice = sorted.slice(i * q, i === 4 ? sorted.length : (i + 1) * q);
  const got = slice.filter((r) => r.trueMastered >= SKILLS_NEEDED).length;
  const bar = '█'.repeat(Math.round(30 * got / slice.length)).padEnd(30, '·');
  console.log(`  Q${i + 1}  theta ${slice[0].theta.toFixed(2).padStart(5)} .. ${slice[slice.length - 1].theta.toFixed(2).padStart(5)}  ${bar} ${(100 * got / slice.length).toFixed(1)}%`);
}

console.log('\nis the proving run a transfer test? (measured over every run the engine served)');
{
  const p1 = (n, d) => (d ? (100 * n / d).toFixed(1) : '  n/a').padStart(5);
  const bar = (n, d) => '█'.repeat(Math.round(30 * (d ? n / d : 0))).padEnd(30, '·');
  console.log(`  gate items in a form or a situation never practised  ${bar(XFER.unseen, XFER.items)} ${p1(XFER.unseen, XFER.items)}%  (${XFER.unseen}/${XFER.items})`);
  console.log(`  runs containing at least one of those               ${bar(XFER.withUnseen, XFER.runs)} ${p1(XFER.withUnseen, XFER.runs)}%  (${XFER.withUnseen}/${XFER.runs})`);
  console.log(`  runs spanning two representations                  ${bar(XFER.twoReps, XFER.runs)} ${p1(XFER.twoReps, XFER.runs)}%`);
  console.log(`  runs including a modelling item                    ${bar(XFER.modelled, XFER.runs)} ${p1(XFER.modelled, XFER.runs)}%`);
  console.log(`  ...of the ${XFER.passed} runs that ended in a mastery claim:`);
  console.log(`  claim-bearing runs with an unpractised form/world  ${bar(XFER.passedUnseen, XFER.passed)} ${p1(XFER.passedUnseen, XFER.passed)}%`);
  console.log(`  claim-bearing runs spanning two representations    ${bar(XFER.passedTwoReps, XFER.passed)} ${p1(XFER.passedTwoReps, XFER.passed)}%`);
  console.log(`  claim-bearing runs including a modelling item      ${bar(XFER.passedModelled, XFER.passed)} ${p1(XFER.passedModelled, XFER.passed)}%`);
}

console.log('\nfalsification — the same learners, the same bank, a different chooser');
{
  const bar = (x) => '█'.repeat(Math.round(30 * x)).padEnd(30, '·');
  console.log(`  the shipping engine        ${bar(reached / LEARNERS)} ${(100 * reached / LEARNERS).toFixed(1)}%`);
  console.log(`  lowest posterior first     ${bar(armLegacy)} ${(100 * armLegacy).toFixed(1)}%   (the router this replaced)`);
  console.log(`  random skill, random band  ${bar(armNull)} ${(100 * armNull).toFixed(1)}%`);
  console.log(`  hardest band from item 1   ${bar(armWorst)} ${(100 * armWorst).toFixed(1)}%`);
  console.log(`  (${CONTROL_N} learners per control arm; identical seeds, decay and learner model)`);
}

// ---------------------------------------------------------------------------
// TESTING OUT — the learners who already know some or all of this
// ---------------------------------------------------------------------------
const COHORT_N = Math.max(120, Math.min(LEARNERS, 400));
const KNOWN_HEAD = ['var-meaning', 'one-step-add', 'one-step-mul', 'eval-expr', 'order-ops'];

const knowers = [];
for (let i = 0; i < COHORT_N; i++) {
  knowers.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
    knows: () => 0.95, budget: 220, record: false,
  }));
}
const halfKnowers = [];
for (let i = 0; i < COHORT_N; i++) {
  halfKnowers.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
    knows: (s) => (KNOWN_HEAD.includes(s) ? 0.95 : null), record: false,
  }));
}

const median = (xs) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const quantile = (xs, p) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
};

console.log('\ntesting out — learners who already know this, on the real scheduler');
{
  const mins = [], its = [];
  const bySkill = new Map(SKILLS.map((s) => [s, { mins: [], items: [] }]));
  let clearedAll = 0;
  const wholeSession = [];
  for (const r of knowers) {
    let all = true, last = 0;
    for (const s of SKILLS) {
      const c = r.cleared.get(s);
      if (!c) { all = false; continue; }
      mins.push(c.seconds / 60); its.push(c.items);
      last = Math.max(last, c.elapsed);
      bySkill.get(s).mins.push(c.seconds / 60);
      bySkill.get(s).items.push(c.items);
    }
    // Wall-clock to the last of the ten claims, not to the end of the budget:
    // the engine keeps a proved learner busy with retention afterwards, and
    // charging that to "how long did it take to test out" would be a lie.
    if (all) { clearedAll++; wholeSession.push(last / 60); }
  }
  console.log(`  a learner who already knows all ${SKILLS.length} skills, hidden competence 0.95`);
  console.log(`    minutes to clear one skill    median ${median(mins).toFixed(1)}   p25 ${quantile(mins, 0.25).toFixed(1)}   p75 ${quantile(mins, 0.75).toFixed(1)}   p90 ${quantile(mins, 0.90).toFixed(1)}`);
  console.log(`    items   to clear one skill    median ${median(its).toFixed(1)}   p75 ${quantile(its, 0.75).toFixed(0)}   p90 ${quantile(its, 0.90).toFixed(0)}`);
  console.log(`    cleared in the minimum 3 items ${(100 * its.filter((x) => x <= 3).length / its.length).toFixed(1)}%   in <= 4 min ${(100 * mins.filter((x) => x <= 4).length / mins.length).toFixed(1)}%`);
  console.log(`    proved the whole level         ${(100 * clearedAll / knowers.length).toFixed(1)}% of them, in ${median(wholeSession).toFixed(0)} min median (${(median(wholeSession) / 25).toFixed(1)} sessions of 25 min)`);
  // The other half of the client's sentence — "nobody spends time on what they
  // already know" — asked of the learner it is about, over the session shape the
  // product is built around. Every item of the first 25 minutes is attributed by
  // the state of the skill it landed on at the moment it was served.
  {
    const CAP = 25 * 60;
    let known = 0, fresh = 0, kn = 0, fn = 0;
    for (let i = 0; i < COHORT_N; i++) {
      let t = 0;
      runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
        knows: () => 0.95, budget: 220, record: false,
        watch: (e) => {
          if (t >= CAP) return;
          t += e.cost;
          if (e.mastered && e.kind !== 'check' && e.kind !== 'probe') { known += e.cost; kn++; } else { fresh += e.cost; fn++; }
        },
      });
    }
    console.log(`    of the first 25 minutes, the share spent on a line already proved  ${(100 * known / (known + fresh)).toFixed(1)}%   (${(kn / COHORT_N).toFixed(1)} items of ${((kn + fn) / COHORT_N).toFixed(1)})`);
  }
  console.log('    per skill   median min  median items');
  for (const s of SKILLS) {
    const b = bySkill.get(s);
    console.log(`      ${s.padEnd(14)} ${median(b.mins).toFixed(1).padStart(6)} ${median(b.items).toFixed(1).padStart(11)}`);
  }
}

console.log('\n  a learner who knows only the first five skills — where does the time go?');
{
  const known = [], unknown = [];
  for (const r of halfKnowers) {
    for (const s of SKILLS) {
      const mins = r.spent.get(s).seconds / 60;
      (KNOWN_HEAD.includes(s) ? known : unknown).push(mins);
    }
  }
  const kSum = known.reduce((a, b) => a + b, 0), uSum = unknown.reduce((a, b) => a + b, 0);
  console.log(`    minutes spent on the ${KNOWN_HEAD.length} they knew      ${(kSum / halfKnowers.length).toFixed(0)}  (${(100 * kSum / (kSum + uSum)).toFixed(1)}% of the session)`);
  console.log(`    minutes spent on the ${SKILLS.length - KNOWN_HEAD.length} they did not  ${(uSum / halfKnowers.length).toFixed(0)}  (${(100 * uSum / (kSum + uSum)).toFixed(1)}%)`);
  // That headline is over the whole ${BUDGET}-item budget, and this learner has
  // proved the level long before it runs out — so most of the time on what they
  // already knew is retention practice on a finished lattice, not test-out. The
  // split matters: only the first half is time the schedule could have spent
  // somewhere better.
  const proveIdx = [];
  for (const r of halfKnowers) {
    let last = 0, all = true;
    for (const s of SKILLS) { const c = r.cleared.get(s); if (!c) { all = false; break; } last = Math.max(last, c.at); }
    if (all) proveIdx.push(last);
  }
  const provedMed = Math.round(median(proveIdx));
  // Re-run the identical learners with the budget cut to that point, so the
  // pre-proof split is measured rather than apportioned.
  let kPre = 0, uPre = 0, kPreItems = 0;
  for (let i = 0; i < COHORT_N; i++) {
    const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
      knows: (sk) => (KNOWN_HEAD.includes(sk) ? 0.95 : null), budget: provedMed, record: false,
    });
    for (const sk of SKILLS) {
      const sp = r.spent.get(sk);
      if (KNOWN_HEAD.includes(sk)) { kPre += sp.seconds / 60; kPreItems += sp.items; } else uPre += sp.seconds / 60;
    }
  }
  console.log(`    the level is proved at item ${provedMed} of ${BUDGET}; up to that point the split is`);
  console.log(`      ${(100 * kPre / (kPre + uPre)).toFixed(1)}% on what they knew (${(kPreItems / COHORT_N).toFixed(0)} items) / ${(100 * uPre / (kPre + uPre)).toFixed(1)}% on what they did not`);
  const reachedHalf = halfKnowers.filter((r) => r.trueMastered >= SKILLS_NEEDED).length;
  console.log(`    true mastery of the level      ${(100 * reachedHalf / halfKnowers.length).toFixed(1)}%`);
}

// ---------------------------------------------------------------------------
// COMING BACK — the cohort the time-based schedule exists for
//
// Identical learners, identical bank, identical budget. The only difference is
// that the work arrives in 22-minute sittings with a real night between them,
// so the spacing ladder above its first rung is reachable at all — and so the
// forgetting across those nights is real too. This is the shape a class has,
// and it is the only shape in which the sentence "this knowledge survived a
// walk away from the machine" can be either true or false.
// ---------------------------------------------------------------------------
const RETURN_N = Math.max(200, Math.min(LEARNERS, 600));
/**
 * THE CAP THAT WAS DECIDING THIS ARM, AND WHY IT IS NOW DERIVED.
 *
 * This ran `sessions: 40`. Forty 22-minute sittings buy about 1,275 items.
 * Level 1's 800-item budget spends itself in 33 of them, so on Level 1 the
 * BUDGET bound, the two arms were matched on work, and the comparison meant
 * something. The SHIPPED ROUTE is 24 skills at a 3,600-item budget — 4,550
 * items, about 58 hours — so on the route the CAP bound, for 100% of learners,
 * and the daily arm was handed 28% of the schooling the single-sitting arm got
 * and then printed beside it under the sentence "the same items, delivered in
 * sittings". It read **0.0% true mastery at both gaps, Q1 0.0%, sittings to
 * mastery NaN**, and that was read for months as the daily shape destroying the
 * product. It is not a retention finding. It is the arm stopping the course a
 * third of the way through and scoring the learner at the bar for the whole of
 * it: `median([])` is NaN because nobody had finished, not because nobody could.
 *
 * Matched on work — same seeds, same budget, the cap raised until the budget is
 * what binds — the same cohort reads 95.0%. The daily shape costs about five
 * points against the single sitting, not ninety-seven.
 *
 * So the cap is no longer a literal. A sitting always consumes at least one
 * item (the boundary is tested after an item is served), so `BUDGET` sittings
 * can never be reached before `BUDGET` items are, and this bound provably
 * cannot bind. What it took is MEASURED and printed — which is also the number
 * the product needs and did not have: *how many school days is this route at
 * 22 minutes a day.*
 *
 * The calendar-bounded reading is not thrown away, because a school has a fixed
 * number of days and that is a real question. It is printed below, under its
 * own heading, at several calendars, with the number of sittings named — which
 * is what the old headline was, at an undisclosed 40 and called the answer.
 */
const RETURN_SESSIONS = BUDGET;
const returners = {};
for (const gap of [24, 72]) {
  const rows = [];
  for (let i = 0; i < RETURN_N; i++) {
    rows.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
      record: false, sessions: RETURN_SESSIONS, sessionMinutes: SESSION_MINUTES, gapHours: gap,
    }));
  }
  returners[gap] = rows;
}

console.log(`\ncoming back across days — the same learners, the same ${BUDGET}-item budget, delivered in sittings`);
console.log(`  ${SESSION_MINUTES}-minute sittings. Between them a line decays towards ${PERMA} of its own high-water mark,`);
console.log(`  by (1 + h/${GAP_HOURS}S)^-${GAP_POW}, where S starts at 1 and multiplies by ${GAP_GROWTH} for every re-probe survived across a real gap.`);
/* EVERY CONSTANT THIS ARM RESTS ON, BY NAME, WITH ITS VALUE AND WHERE IT CAME
   FROM. An adversarial reviewer found one of them undisclosed and the finding
   was withdrawn once it was printed — which fixed one line and left the rule
   unwritten. The rule: a number that moves this arm by a factor of five is
   evidence only if a reader can see it. So they are all here, and each says
   whether anything measured it or whether it was chosen. Three of them are
   choices, and the three-by-three sweep below is what the two biggest ones are
   worth. `sessions` is on this list because it was NOT on any list, and it was
   the one deciding the answer. */
console.log('  the constants this arm rests on — value, and whether anything calibrated it');
for (const [name, val, prov] of [
  ['SESSION_MINUTES', SESSION_MINUTES, 'PRODUCT SPEC — BRIEF.md goal 3 names 15-25 minutes; SIM_SESSION overrides'],
  ['SESSION_GAP_HOURS', SESSION_GAP_HOURS, 'PRODUCT SPEC — a night; both 24 and 72 are run below; SIM_GAP overrides'],
  ['sessions (the cap)', RETURN_SESSIONS, `DERIVED — = BUDGET, so it provably cannot bind before the item budget does; it was the literal 40, and on any lattice past Level 1 the literal was the answer`],
  ['GAP_POW', GAP_POW, 'CHOSEN — power-law forgetting is measured in the literature, this exponent is not measured here; swept below'],
  ['PERMA', PERMA, 'CHOSEN — Bahrick permastore is a real effect, this fraction is not measured here; swept below'],
  ['GAP_HOURS', GAP_HOURS, 'UNIT — the time scale the exponent is expressed in, not a free parameter'],
  ['GAP_GROWTH', GAP_GROWTH, 'CHOSEN — matched by argument, not by data, to the engine ladder\'s own expansion; NOT swept'],
  ['strength cap', 60, 'CHOSEN — the ceiling on durable strength; ~5 survived re-probes reach it; NOT swept'],
  ['stability step', 0.7, 'CHOSEN — what one spaced retrieval takes off the within-sitting interference cost; NOT swept'],
  ['DECAY', DECAY, 'CHOSEN — within-sitting interference per item; unchanged from the build these figures are held against'],
  /* THE ONE THAT WAS NOT ON THIS LIST AND DECIDES MORE THAN THE TWO THAT WERE.
     The law above is applied AGAIN at every sitting boundary, so a line left
     alone for n sittings decays by keep(h)^n — which is EXPONENTIAL in the
     number of boundaries, and the exponential is precisely the curve this
     file's own header says fits nonsense syllables and does not fit meaningful
     material. Composing a power law with itself is not a power law. Taken once
     over the real elapsed time since the line was last practised it is the law
     as written. Both are run; the row beneath the sweep prints the difference,
     and `decayMode` in `runLearner` is the arm. */
  ['the composition law', 'iterated', 'CHOSEN, AND UNTIL NOW UNNAMED — the power law is re-applied at EVERY sitting boundary, which composes to an exponential in the number of boundaries; \'elapsed\' takes it once over the real time since the line was last practised. Printed below.'],
]) console.log(`    ${String(name).padEnd(20)} ${String(val).padEnd(9)} ${prov}`);
for (const gap of [24, 72]) {
  const rows = returners[gap];
  const got = rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length;
  const all = rows.filter((r) => r.trueMastered === SKILLS.length).length;
  const byTheta = [...rows].sort((a, b) => a.theta - b.theta);
  const fifth = byTheta.slice(0, Math.max(1, Math.floor(byTheta.length / 5)));
  const q1 = fifth.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / fifth.length;
  const claims = rows.flatMap((r) => r.claims);
  const wrong = claims.filter((c) => c.k < HOLLOW).length;
  // …and the same claims under the stricter definition, on the cohort that
  // actually plays in sittings. See `score`: a hole, or the weakest surface
  // this skill was really served on, rather than the mean across all of them.
  const wrongStrict = claims.filter((c) => c.k < HOLLOW || c.holes > 0 || c.surface < HOLLOW).length;
  const anyH = rows.filter((r) => r.hollow > 0).length;
  const anyHS = rows.filter((r) => r.hollowStrict > 0).length;
  const sittings = rows.map((r) => r.sessionTrace.length);
  const toMastery = rows
    .map((r) => r.sessionTrace.findIndex((s2) => s2.trueMastered >= SKILLS_NEEDED) + 1)
    .filter((n) => n > 0);
  const label = gap === 24 ? 'every day' : 'every third day';
  console.log(`\n  ${label} (${gap} h between sittings, ${RETURN_N} learners)`);
  /* WHAT THIS ARM ACTUALLY GOT. Printed first and above the headline on
     purpose: a mastery figure read off an arm that was handed a quarter of the
     work is a statement about the budget, and for months nothing in this block
     said how much work it had been handed. `sittings` is measured, not asked
     for — see RETURN_SESSIONS. */
  const capBound = rows.filter((r) => r.sessionTrace.length >= RETURN_SESSIONS).length;
  console.log(`    work this arm was given            ${median(rows.map((r) => r.items)).toFixed(0)} items over ${median(sittings).toFixed(0)} sittings (${(median(rows.map((r) => r.seconds)) / 60).toFixed(0)} min), against ${median(results.map((r) => r.items)).toFixed(0)} in one sitting`);
  /* AND HOW LONG THAT IS ON A CALENDAR. Two arms with the same number of
     sittings do not cover the same amount of time, and the reader has to be
     able to see that before comparing them: at a three-day cadence the same
     course runs three times as long. Neither figure meant anything while the
     sitting count was a literal. */
  console.log(`      elapsed calendar                 ${(median(sittings) * gap / 24).toFixed(0)} days from the first item to the last (${((median(sittings) * gap / 24) / 7).toFixed(0)} weeks)`);
  console.log(`      the budget is what stopped it    ${(100 * (rows.length - capBound) / rows.length).toFixed(0)}% of learners   (a sitting cap that bound would make this number a statement about the cap)`);
  console.log(`    true mastery of the level          ${(100 * got / rows.length).toFixed(1)}%   (all ${SKILLS.length} skills ${(100 * all / rows.length).toFixed(1)}%)`);
  console.log(`    lowest ability quintile            ${(100 * q1).toFixed(1)}%`);
  console.log(`    hollow claims, judged when made    OLD ${(100 * wrong / Math.max(1, claims.length)).toFixed(2)}%   NEW ${(100 * wrongStrict / Math.max(1, claims.length)).toFixed(2)}%   (${wrong} / ${wrongStrict} of ${claims.length})`);
  console.log(`    learners with any hollow claim     OLD ${(100 * anyH / rows.length).toFixed(1)}%   NEW ${(100 * anyHS / rows.length).toFixed(1)}%`);
  /* NEVER PRINT NaN AS A MEASUREMENT. `median([])` is NaN, and this line printed
     it — "sittings to true mastery median NaN" — beside a 0.0% headline, which
     reads as a broken model and is in fact an empty set: nobody had reached the
     bar, so nothing was averaged. It says which of the two it is now. */
  console.log(toMastery.length
    ? `    sittings to true mastery           median ${median(toMastery).toFixed(0)}   p90 ${quantile(toMastery, 0.9)}   (of ${median(sittings).toFixed(0)} played)   ${(100 * toMastery.length / rows.length).toFixed(0)}% of learners got there`
    : `    sittings to true mastery           NOT REACHED by any of ${rows.length} learners inside ${median(sittings).toFixed(0)} sittings — no median exists, so none is printed`);
  console.log(`    re-probes that crossed a real gap  median ${median(rows.map((r) => r.durable)).toFixed(0)} per learner   (${(rows.reduce((a, r) => a + r.durable, 0) / rows.length).toFixed(1)} mean)`);
  console.log(`    lines caught lapsing and reopened  ${(rows.reduce((a, r) => a + r.lapsed, 0) / rows.length).toFixed(2)} per learner at the end`);
  /* CLAIMS THE RELOAD TOOK BACK. Between two sittings this cohort now does what
     the product does — `save()` to a string, and a NEW MasteryEngine built from
     it — and `load()` withdraws any claim standing over a question type never
     once solved unaided. Until this file round-tripped, no number it printed
     had ever included that, because one engine object lived for all 25
     sittings. Every one of these is a line a learner held when they shut the
     laptop and did not hold when they opened it, which is why the product says
     so out loud (src/meta/withdrawn.js). */
  const wl = rows.reduce((a, r) => a + r.withdrawnOnLoad, 0);
  const wlLearners = rows.filter((r) => r.withdrawnOnLoad > 0).length;
  console.log(`    claims withdrawn by a RELOAD       ${(wl / rows.length).toFixed(2)} per learner   ${(100 * wlLearners / rows.length).toFixed(1)}% of learners had one taken back between sittings`);
  console.log(`    items that were spaced re-probes   ${(rows.reduce((a, r) => a + r.reviewItems, 0) / rows.length).toFixed(0)} of ${(rows.reduce((a, r) => a + r.items, 0) / rows.length).toFixed(0)}   soundings ${(rows.reduce((a, r) => a + r.deepItems, 0) / rows.length).toFixed(0)}`);
  // The figure this build exists to hold down, on the cohort that actually
  // plays in sittings: how much of a session went to a line already proved, and
  // the most any single line took out of one sitting.
  const wk = {};
  for (const r of rows) for (const [k2, v2] of Object.entries(r.heldWorstKind)) wk[k2] = Math.max(wk[k2] || 0, v2);
  console.log(`    items on already-mastered skills   ${(rows.reduce((a, r) => a + r.heldItems, 0) / rows.length).toFixed(0)} per learner   worst one skill in a sitting ${Math.max(...rows.map((r) => r.heldWorst))}   unexplained ${rows.reduce((a, r) => a + r.heldOther, 0)}`);
  console.log(`      worst one skill one sitting by mechanism   ${Object.entries(wk).map(([k2, v2]) => `${k2} ${v2}`).join('   ')}`);
}
// ---------------------------------------------------------------------------
// THE SCHOOL CALENDAR — what a fixed number of days actually buys
//
// The arm above gives the learner as many nights as the item budget pays for
// and reports how many that took. A school does not work that way: it has a
// term, and the question a teacher asks is "what will they hold in six weeks".
//
// This is where the old headline belongs. It WAS this number — one row of this
// table, at an undisclosed calendar of 40 — printed as though it were the
// answer to "does the daily shape work". Those are different questions and only
// one of them is about the schedule. Read down the column: the shape is not
// failing, the term is short.
// ---------------------------------------------------------------------------
{
  const CAL_N = Math.min(150, RETURN_N);
  const CALENDARS = [20, 40, 60, 90];
  console.log(`\n  the school calendar — ${SESSION_MINUTES} minutes a day, every day, for a fixed number of days`);
  console.log(`  (${CAL_N} learners a row. The item budget can still stop a row early; when it does, the row says so.)`);
  console.log('    days   items   truly held / ' + SKILLS.length + '   >= ' + SKILLS_NEEDED + ' of ' + SKILLS.length + '   engine-held   reached the bar by day');
  for (const days of CALENDARS) {
    const rows = [];
    for (let i = 0; i < CAL_N; i++) {
      rows.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
        record: false, sessions: days, sessionMinutes: SESSION_MINUTES, gapHours: 24,
      }));
    }
    const got = rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rows.length;
    const arrive = rows
      .map((r) => r.sessionTrace.findIndex((s2) => s2.trueMastered >= SKILLS_NEEDED) + 1)
      .filter((n) => n > 0);
    const short = rows.filter((r) => r.sessionTrace.length < days).length;
    const held = rows.reduce((a, r) => a + r.engineMastered, 0) / rows.length;
    const truly = rows.reduce((a, r) => a + r.trueMastered, 0) / rows.length;
    console.log(`    ${String(days).padStart(4)}   ${median(rows.map((r) => r.items)).toFixed(0).padStart(5)}   ${truly.toFixed(1).padStart(13)}   ${(100 * got).toFixed(1).padStart(8)}%   ${held.toFixed(1).padStart(11)}   ${(arrive.length ? `median ${median(arrive).toFixed(0)}, p90 ${quantile(arrive, 0.9)}` : 'nobody, inside this many days').padEnd(28)}${short ? `  (${(100 * short / rows.length).toFixed(0)}% ran out of budget first)` : ''}`);
  }
  console.log('    A row that reads 0.0% is a term that is too short for this lattice, not a schedule that does not work.');
  console.log('    The row above this table — the budget-matched one — is the schedule\'s own number.');
}

// ---------------------------------------------------------------------------
// THE RETENTION TEST
//
// The comparison the whole fix rests on, and the only one that is not the
// crammer's preferred measurement: the same budget, one sitting against
// twenty-odd, both scored at the buzzer and both scored again a week later
// having been taught nothing in between.
// ---------------------------------------------------------------------------
console.log('\n  the retention test — the same learners asked again a week later, taught nothing in between');
{
  const row = (label, rows) => {
    const at = rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rows.length;
    const wk = rows.map((r) => scoreAfter(r, 7));
    const mo = rows.map((r) => scoreAfter(r, 30));
    const of = (xs) => xs.filter((x) => x.trueMastered >= SKILLS_NEEDED).length / xs.length;
    const hol = (xs) => xs.filter((x) => x.hollow > 0).length / xs.length;
    const holS = (xs) => xs.filter((x) => x.hollowStrict > 0).length / xs.length;
    const bar = (x) => '█'.repeat(Math.round(24 * x)).padEnd(24, '·');
    console.log(`    ${label.padEnd(30)} ${bar(at)} ${(100 * at).toFixed(1)}%  ->  a week later ${(100 * of(wk)).toFixed(1)}%   a month later ${(100 * of(mo)).toFixed(1)}%`);
    console.log(`    ${' '.repeat(30)} ${' '.repeat(24)}          hollow at a week  OLD ${(100 * hol(wk)).toFixed(1)}%  NEW ${(100 * holS(wk)).toFixed(1)}% of learners`);
  };
  row('one unbroken sitting', results.slice(0, RETURN_N));
  row('sittings a day apart', returners[24]);
  row('sittings three days apart', returners[72]);
  console.log('    (the first row is the cram: everything it knows was learned in the last eight hours,');
  console.log('     and none of its re-probes crossed a night, so nothing it holds is durable strength.)');
}

// ---------------------------------------------------------------------------
// MODEL OR SCHEDULE? — the 2x2 that separates two mechanisms one name was
// hiding, printed on every run because the answer decides who owns the defect.
//
// `gapHours` was two clocks:
//
//   the SCHEDULING clock   what the ENGINE is told the learner was away —
//                          which re-probe has come round, whether a pass
//                          crossed a real gap, whether a belief has gone stale.
//   the FORGETTING clock   how much MEMORY the wait costs. Nothing in the
//                          engine can see it; it is the learner model, and it
//                          rests on two constants nobody here has calibrated.
//
// While they shared a name the every-third-day figure was the sum of both and
// could be attributed to neither, so the argument about it could not end. Cross
// them and it can. Read the two middle rows: whatever the 72 h SCHEDULING clock
// loses on its own is a scheduling defect and is fixable without touching a
// forgetting constant; whatever the 72 h FORGETTING clock loses on its own is
// not, and no amount of re-ordering the session will move it.
// ---------------------------------------------------------------------------
{
  const N = Math.min(60, RETURN_N);
  console.log('\n  model or schedule? — the two clocks that used to be one, crossed');
  console.log('    scheduling clock  what the ENGINE is told the learner was away (the ladder, durability, staleness)');
  console.log('    forgetting clock  how much MEMORY the wait costs, which the engine cannot see');
  console.log('    arm                                              sched   loss   true mastery   Q1      truly held   engine held');
  const cells = [
    ['daily, as delivered', 24, 24],
    ['every third day, as delivered', 72, 72],
    ['THE SCHEDULER ALONE  72 h clock, 24 h loss', 72, 24],
    ['THE MODEL ALONE      24 h clock, 72 h loss', 24, 72],
  ];
  for (const [label, sched, forget] of cells) {
    const rows = [];
    for (let i = 0; i < N; i++) {
      rows.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
        record: false, sessions: RETURN_SESSIONS, sessionMinutes: SESSION_MINUTES,
        gapHours: sched, decayHours: forget,
      }));
    }
    const got = 100 * rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rows.length;
    const byTheta = [...rows].sort((a, b) => a.theta - b.theta);
    const fifth = byTheta.slice(0, Math.max(1, Math.floor(byTheta.length / 5)));
    const q1 = 100 * fifth.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / fifth.length;
    const mn = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`    ${label.padEnd(46)} ${String(sched + 'h').padStart(5)}  ${String(forget + 'h').padStart(5)}  ${got.toFixed(1).padStart(11)}%  ${q1.toFixed(1).padStart(5)}%  ${mn(rows.map((r) => r.trueMastered)).toFixed(1).padStart(10)}/${SKILLS.length}  ${mn(rows.map((r) => r.engineMastered)).toFixed(1).padStart(9)}/${SKILLS.length}`);
  }
  console.log(`    (${N} learners a cell against ${RETURN_N} above, identical seeds. READ THE MEAN LINES HELD as well as the`);
  console.log(`     headline: the bar is ${SKILLS_NEEDED} of ${SKILLS.length} truly held, so at a cadence where the mean sits several lines under it`);
  console.log('     the percentage is the tail of a distribution and moves in jumps, while the mean moves smoothly.)');
}

console.log('\n  how much of that is the forgetting model? (both cadences, both constants swept)');
{
  /* THE SWEEP HAS TO RUN THE SAME ARM AS THE HEADLINE, AND BOTH CADENCES.
     It ran 200 learners at `sessions: 40` while the rows above it were also at
     40 and also starved, so it was a sensitivity study of a different, broken
     experiment. It is budget-matched now — about four times the work per
     learner on the route, so the cell size drops and is printed.
     And it sweeps BOTH gaps, because the every-third-day row is the one that
     decides whether this lattice meets the promise, and a figure that rests on
     two constants nobody in this repo has calibrated is evidence only when the
     reader can see how far it moves when they do. The sweep's job is the
     RANKING and the SPREAD; the rows above are the estimates. */
  const N = Math.min(60, RETURN_N);
  const head = ['0.25', '0.35', '0.45'];
  for (const gap of [24, 72]) {
    console.log(`    ${gap === 24 ? 'every day (24 h)' : 'every third day (72 h)'}`);
    console.log('      permastore floor  forgetting exponent ' + head.map((h) => h.padStart(14)).join(''));
    for (const perma of [0.5, 0.6, 0.7]) {
      const cells = [];
      for (const pow of [0.25, 0.35, 0.45]) {
        const rows = [];
        for (let i = 0; i < N; i++) {
          rows.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
            record: false, sessions: RETURN_SESSIONS, sessionMinutes: SESSION_MINUTES, gapHours: gap,
            gapPow: pow, perma,
          }));
        }
        const at = rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rows.length;
        const wk = rows.map((r) => scoreAfter(r, 7)).filter((x) => x.trueMastered >= SKILLS_NEEDED).length / rows.length;
        cells.push(`${(100 * at).toFixed(0)}% / ${(100 * wk).toFixed(0)}%`.padStart(14));
      }
      console.log(`        ${perma.toFixed(2)}          ${' '.repeat(19)}${cells.join('')}`);
    }
  }
  console.log(`    (true mastery at the buzzer / a week later, ${N} learners a cell against ${RETURN_N} above, so the`);
  console.log(`     middle cell of each table is that cadence's row to within sampling noise. The engine is identical`);
  console.log(`     in all eighteen; only the forgetting model moves. The shipping figures use PERMA ${PERMA}, exponent ${GAP_POW}.`);
  console.log('     Read the SPREAD of each table before quoting either row: these two constants are chosen, not measured.)');

  /* …AND THE THIRD CHOICE, WHICH IS NOT A CONSTANT AT ALL. Same constants,
     same floor, same strength term, one composition: the power law taken ONCE
     over the elapsed time since the line was last practised, instead of again
     at every sitting boundary. It is a bigger lever than either constant on the
     cadence that matters, and it had no name until this line. */
  console.log('\n    the composition, at the shipping constants — the same nine-cell middle, both laws');
  for (const gap of [24, 72]) {
    const out = [];
    for (const mode of ['iterated', 'elapsed']) {
      const rows = [];
      for (let i = 0; i < N; i++) {
        rows.push(runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
          record: false, sessions: RETURN_SESSIONS, sessionMinutes: SESSION_MINUTES, gapHours: gap,
          decayMode: mode,
        }));
      }
      const at = 100 * rows.filter((r) => r.trueMastered >= SKILLS_NEEDED).length / rows.length;
      const wk = 100 * rows.map((r) => scoreAfter(r, 7)).filter((x) => x.trueMastered >= SKILLS_NEEDED).length / rows.length;
      const held = rows.reduce((a, r) => a + r.trueMastered, 0) / rows.length;
      out.push(`${mode.padEnd(9)} ${at.toFixed(0).padStart(3)}% / ${wk.toFixed(0)}% at a week, ${held.toFixed(1)} of ${SKILLS.length} lines truly held`);
    }
    console.log(`      ${(gap === 24 ? 'every day (24 h)' : 'every third day (72 h)').padEnd(24)} ${out.join('    ')}`);
  }
  console.log('      (a power law re-applied at every boundary is an exponential in the number of boundaries.');
  console.log('       Neither law is calibrated here. The point of the row is the SIZE of the choice.)');
}

{
  // Where the ladder actually pays out. The exploit this replaced let a player
  // climb the entire retention ladder without leaving the chair, so the number
  // that matters is not how many re-probes were served but how many of them
  // crossed a night — and in one unbroken sitting that number must be zero.
  /* BOTH SIDES THE SAME BUDGET. `one` was pinned at `budget: 800` while `many`
     was whatever the 40-sitting cap let it play, and the sentence between them
     said "the same 800 items". On the route that was 800 against 1,275 and the
     word "same" was carrying the whole comparison. Both take BUDGET now. */
  const one = runLearner(12345, 'engine', { record: false });
  const many = returners[24][0];
  console.log(`\n  the exploit, closed: ${one.items} items in one unbroken sitting earn ${one.durable} durable re-probes;`);
  console.log(`  the same budget across ${many.sessionTrace.length} sittings (${many.items} items) earns ${many.durable}. Under the schedule this replaced (AB_ATTEMPTS=1)`);
  console.log('  the two were the same number, and the whole endgame ladder was payable before lunch.');
}

// ---------------------------------------------------------------------------
// FALSE POSITIVES — what the fast route costs
// ---------------------------------------------------------------------------
console.log('\nfalse positives — how often a mastery claim is wrong');
{
  const all = [], viaSight = [];
  for (const r of [...results, ...knowers, ...halfKnowers]) {
    for (const c of r.claims) { all.push(c); if (c.sightRead) viaSight.push(c); }
  }
  const bad = (xs) => xs.filter((c) => c.k < HOLLOW).length;
  const rate = (n, d) => (d ? (100 * n / d).toFixed(2) : ' n/a');
  console.log(`  every mastery claim this run made, judged against the hidden truth at the moment it was made`);
  console.log(`    all claims                 ${String(all.length).padStart(7)}   wrong (competence < ${HOLLOW}) ${rate(bad(all), all.length)}%`);
  console.log(`    claims off the sight-read  ${String(viaSight.length).padStart(7)}   wrong (competence < ${HOLLOW}) ${rate(bad(viaSight), viaSight.length)}%`);
  // The same rate per skill. A gate that is stricter on one node than on the
  // rest of the level shows up here and in no other figure this file prints:
  // the pooled rate hides it, because one skill in ten moving five points moves
  // the pool by half a point.
  {
    const bySk = new Map(SKILLS.map((s2) => [s2, { n: 0, bad: 0 }]));
    for (const c of all) { const b = bySk.get(c.skill); if (b) { b.n++; if (c.k < HOLLOW) b.bad++; } }
    console.log('    by skill: ' + SKILLS.map((s2) => {
      const b = bySk.get(s2);
      return `${s2} ${b.n ? (100 * b.bad / b.n).toFixed(1) : ' n/a'}%`;
    }).join('  '));
  }
  const stillWrong = results.reduce((a, r) => a + r.hollowAtEnd.length, 0);
  const claimsMain = results.reduce((a, r) => a + r.claims.length, 0);
  console.log(`    of the ordinary population, claims still wrong at the end of the session ${rate(stillWrong, claimsMain)}%`);
  console.log(`    (a wrong claim is not permanent: the spacing schedule re-probes it, and a second miss demotes it)`);

  // --- THE SAME CLAIMS, UNDER THE STRICTER DEFINITION ----------------------
  // The rate above is the one this file has always printed and it is an
  // aggregate on both sides: engine-says-mastered against mean hidden
  // competence. It cannot see the defect that made this work necessary,
  // because the defect is an aggregate carrying a hole. The rate below adds
  // the two tests that can:
  //
  //   · a HOLE — a question type the engine served `formFloor` times and never
  //     once got right unaided, standing under the claim at the moment it was
  //     granted. The form floor in src/learn/mastery.js now makes this
  //     impossible, so this column is an assertion and not a measurement, and
  //     it is printed rather than merely checked so that the day it stops being
  //     zero, somebody sees it;
  //   · the WEAKEST SURFACE — the learner's true competence on the surface this
  //     skill was actually served on that they are worst at, rather than their
  //     mean across all of them. This is a genuinely harder bar and it is
  //     EXPECTED TO RAISE THE RATE. The number below is the true one.
  const badStrict = (xs) => xs.filter((c) => c.k < HOLLOW || c.holes > 0
    || c.served0 > 0 || c.surface < HOLLOW).length;
  const holed = all.filter((c) => c.holes > 0).length;
  const served0 = all.filter((c) => c.served0 > 0).length;
  const surfaced = all.filter((c) => c.k >= HOLLOW && c.surface < HOLLOW).length;
  console.log('');
  console.log(`  the same claims under the stricter definition — no aggregate may stand in for a surface`);
  console.log(`    all claims                 ${String(all.length).padStart(7)}   hollow (OLD: mean competence < ${HOLLOW})        ${rate(bad(all), all.length)}%`);
  console.log(`    all claims                 ${String(all.length).padStart(7)}   hollow (NEW: + hole, + weakest surface)  ${rate(badStrict(all), all.length)}%`);
  console.log(`    of which, granted over a question type standing at 0 of ${FORM_FLOOR}   ${holed}   <- must stay 0`);
  console.log(`    of which, granted over a question type SERVED and never once solved   ${served0}   <- must stay 0`);
  console.log(`    of which, granted over a surface the learner is below ${HOLLOW} on   ${surfaced}   (${rate(surfaced, all.length)}% of all claims)`);
  console.log(`    claims off the sight-read  ${String(viaSight.length).padStart(7)}   hollow (NEW)                             ${rate(badStrict(viaSight), viaSight.length)}%`);
  const strictEnd = results.reduce((a, r) => a + r.hollowAtEndStrict.length, 0);
  console.log(`    of the ordinary population, claims still hollow at the end of the session   OLD ${rate(stillWrong, claimsMain)}%   NEW ${rate(strictEnd, claimsMain)}%`);
}

console.log('\n  the gate as a classifier — learners frozen at a known competence, so only the gate moves');
{
  const LEVELS = [0.50, 0.60, 0.70, 0.75, 0.80, 0.90, 0.95];
  const N = Math.max(200, COHORT_N);
  console.log('    true competence   cleared a skill in <= 3 items   in <= 6 items   ever, in 25 min   (of which inside 25 real min)');
  for (const c of LEVELS) {
    let fast = 0, six = 0, ever = 0, seen = 0, inTime = 0;
    for (let i = 0; i < N; i++) {
      const r = runLearner((i * 2654435761 + 12345) >>> 0, 'engine', {
        knows: () => c, frozen: true, budget: 40, record: false,
      });
      // The first skill each frozen learner meets is the only clean read: after
      // that the prerequisite gate has already selected on having passed.
      const first = SKILLS.find((s) => r.spent.get(s).items > 0);
      if (!first) continue;
      seen++;
      const cl = r.cleared.get(first);
      // The "ever" column is bounded by the 40-item budget, which is what the
      // label has always meant and what every earlier run of this file reported;
      // the last column reads the same clears off the actual clock, because the
      // two only coincide while an item costs about 37 seconds.
      if (cl) { ever++; if (cl.items <= 3) fast++; if (cl.items <= 6) six++; if (cl.elapsed <= 25 * 60) inTime++; }
    }
    const flag = c < HOLLOW ? '  <- must stay low' : '';
    console.log(`      ${c.toFixed(2)}            ${(100 * fast / seen).toFixed(1).padStart(6)}%${' '.repeat(18)}${(100 * six / seen).toFixed(1).padStart(6)}%${' '.repeat(9)}${(100 * ever / seen).toFixed(1).padStart(6)}%${' '.repeat(12)}${(100 * inTime / seen).toFixed(1).padStart(6)}%${flag}`);
  }
  console.log(`    (${N} frozen learners per row, 40 items each — the sight-read is offered to every one of them)`);
}

// ---------------------------------------------------------------------------
// NOBODY SPENDS TIME ON WHAT THEY ALREADY KNOW
//
// The other half of the same promise, and the half that had no figure. A real
// session was read by hand and found one held skill served nine times in twelve
// while an unmastered skill next door was served none — so "items served on a
// skill this learner had already mastered" is printed here, permanently, split
// by what served them. `review` and `retrieval` are the two mechanisms that are
// *supposed* to land on a held line: a re-probe the wall clock called for, and
// an interleaved retrieval item drawn from the lattice beneath blocked practice.
// A sounding is the endgame answer to a proved shard. Anything in `other` is a
// held line being drilled for no reason anybody can name, and should be zero.
// ---------------------------------------------------------------------------
console.log('\nnobody spends time on what they already know — items served on already-mastered skills');
{
  const tot = (k) => results.reduce((a, r) => a + r[k], 0);
  const items = results.reduce((a, r) => a + r.items, 0);
  const held = tot('heldItems');
  const pct2 = (x, n) => `${(100 * x / Math.max(1, n)).toFixed(1)}%`;
  console.log(`  items on skills already mastered when served   ${(held / results.length).toFixed(0)} of ${(items / results.length).toFixed(0)} per learner  (${pct2(held, items)})`);
  console.log(`    spaced re-probes the clock called for        ${(tot('heldReview') / results.length).toFixed(0)}  (${pct2(tot('heldReview'), held)} of them)`);
  console.log(`    interleaved retrieval from the lattice       ${(tot('heldRetrieval') / results.length).toFixed(0)}  (${pct2(tot('heldRetrieval'), held)})`);
  console.log(`    soundings, once the shard is proved          ${(tot('heldDeep') / results.length).toFixed(0)}  (${pct2(tot('heldDeep'), held)})`);
  console.log(`    anything else                                ${(tot('heldOther') / results.length).toFixed(0)}  (${pct2(tot('heldOther'), held)})   <- must stay 0`);
  const worst = results.map((r) => r.heldWorst);
  console.log(`  most items any one held skill took in a sitting ${Math.max(...worst)} (median ${median(worst).toFixed(0)}, p99 ${quantile(worst, 0.99)})`);
  console.log('  (this cohort plays its whole 800-item budget as ONE unbroken sitting and has the level');
  console.log('   proved inside ~250 of them, so almost everything after that is endgame sounding and the');
  console.log("   per-sitting figure is a whole-run figure. The 22-minute sittings below are the real shape,");
  console.log('   and a re-probe that has genuinely come due is uncapped by design — see heldReserveCap.)');
}

// ---------------------------------------------------------------------------
// NEVER ABANDON A STRUGGLER
// ---------------------------------------------------------------------------
console.log('\nnever abandoned — is any learner ever routed off a topic they have not mastered?');
{
  const gaps = results.map((r) => r.starve);
  const worst = Math.max(...gaps);
  const over = gaps.filter((g) => g > 40).length;
  console.log(`  longest any unmastered, unlocked skill went unserved   ${worst} items (median ${median(gaps).toFixed(0)}, p99 ${quantile(gaps, 0.99)})`);
  console.log(`  learners where that ever exceeded the engine's floor   ${over} of ${results.length}`);
  const stuck = results.filter((r) => r.engineMastered < SKILLS.length);
  const lastItems = stuck.map((r) => {
    const un = SKILLS.filter((s) => !r.engineMasteredSet.has(s));
    return un.reduce((a, s) => a + r.spent.get(s).items, 0);
  });
  console.log(`  learners who did not finish inside the budget          ${stuck.length} of ${results.length}`);
  console.log(`  items those learners were still being given on the skills they had not mastered: median ${median(lastItems).toFixed(0)}, min ${Math.min(...lastItems, Infinity)}`);
  console.log('  no code path in mastery.js marks a skill done on a timer, an attempt count or a budget:');
  console.log('  the only ways out are the proving run and the sight-read, and both are the same bar.');
}

// ---------------------------------------------------------------------------
// THE INVARIANTS — the four things this build is not allowed to do.
//
// Not measurements. Each one is a sentence the product says about itself, each
// one was found false in one live session, and each is now checked on every
// item and every claim of every cohort above. Zero is the only passing value.
// ---------------------------------------------------------------------------
console.log('\nthe invariants — asserted on every item and every claim above, not sampled');
{
  // --- 3. PREREQUISITE ORDER, INSIDE THE ITEM ------------------------------
  // The routing invariant is checked in the item loop. This is the other half,
  // and the half that was actually broken: an item served legally on `like-terms`
  // whose own first worked step was the distributive property, which stands
  // DOWNSTREAM of like-terms in the graph. The whole bank is re-derived here —
  // every form, every band, every step — and asked whether it needs a rule that
  // sits above its own skill.
  let scanned = 0;
  for (const skill of SKILLS) {
    const cone = CONE.get(skill) || new Set([skill]);
    if (cone.has('distribute')) continue;   // the rule is at or below this line
    for (const f of FORMS_BY_SKILL[skill]) {
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (let i = 0; i < 24; i++) {
          let it;
          try { it = generate(skill, d, i * 7919 + d * 131, { locale: 'en', form: f.id }); }
          catch { continue; }
          scanned++;
          for (const tx of [it.latex, ...(it.steps || []).map((x) => x.latex)]) {
            const hit = needsDistribution(tx);
            if (hit) violate('prereqContent', `${skill}/${f.id} band ${d}: ${hit}`);
          }
        }
      }
    }
  }

  // --- 4. THE PROMISED WORKLOAD IS THE PLANNED WORKLOAD --------------------
  // `planRun` quotes a goal in TEARS — questions answered correctly — and plans
  // a workload in ITEMS. They are different numbers and only the smaller was on
  // the orders card, which is how a player came to be quoted two thirds of the
  // work. The plan now carries the workload as a range and the card states it,
  // so the assertion is that the range is honest: it must contain the same
  // projection's own median item count, and its floor may not be below the goal
  // (nobody seals sixteen rifts in fourteen questions).
  let plans = 0;
  for (let i = 0; i < 60; i++) {
    const r = runLearner((i * 2654435761 + 99991) >>> 0, 'engine', { budget: 40 + (i % 5) * 30, record: false });
    const eng = new MasteryEngine(graph, JSON.parse(JSON.stringify(r.save)));
    const p = planRun(eng, { factor: 1, accuracy: 0.72, seeded: false }, { minutes: 20, seed: 0x5eed + i });
    plans++;
    if (!(p.itemsLow <= p.items && p.items <= p.itemsHigh)) {
      violate('workload', `quoted ${p.itemsLow}-${p.itemsHigh} does not contain the planned ${p.items}`);
    }
    if (p.itemsLow < p.tears) {
      violate('workload', `quoted floor ${p.itemsLow} questions below the goal of ${p.tears} rifts`);
    }
    // --- 5. ONE FIGURE, THE LOWER BOUND -------------------------------------
    // pL, the planner's seam confidence and the number on the progress row used
    // to be three figures about one line that could disagree, and the screen
    // printed the largest. The report now prints `confidence().floor`, and the
    // assertion is that the floor is never above any of the things it is a
    // floor under.
    for (const sm of p.seams) {
      const c = eng.confidence(sm.id, { plan: sm.confidence });
      const st = eng.get(sm.id);
      // A held line's seam confidence is 0 by construction (it never closes
      // again inside a projection), so it is not a bound on anything and
      // `confidence` correctly ignores it. See the note there.
      if (!st.attempts || st.mastered) continue;
      if (c.floor > c.pL + 1e-9 || c.floor > sm.confidence + 1e-9) {
        violate('confidence', `${sm.id}: floor ${c.floor.toFixed(3)} above pL ${c.pL.toFixed(3)} / plan ${sm.confidence.toFixed(3)}`);
      }
      if (st.mastered && holesOf(st).length) {
        violate('hollowForm', `${sm.id} held at load with ${holesOf(st).join(', ')} at 0 of ${FORM_FLOOR}`);
      }
      if (st.mastered && servedHoles(st).length) {
        violate('hollowServed', `${sm.id} held at load with ${servedHoles(st).join(', ')} never once solved unaided`);
      }
    }
  }

  const line = (label, kind, note) => {
    const n = VIOLATIONS[kind];
    const mark = n === 0 ? 'PASS' : 'FAIL';
    console.log(`  ${mark}  ${label.padEnd(52)} ${String(n).padStart(6)}   ${note}`);
    if (n) console.log(`        first: ${FIRST[kind]}`);
  };
  line('a claim granted over a question type at 0 of ' + FORM_FLOOR, 'hollowForm', 'must be 0');
  line('a claim granted over a question type SERVED and never solved', 'hollowServed', 'must be 0');
  line('an item taught on an unproved skill with unheld prereqs', 'lockedServe', 'must be 0');
  console.log(`        (re-probes of an already-proved line whose ground reopened: ${underReopened} — in order when granted, counted here so it is not invisible)`);
  line('an item needing a rule above its own skill in the graph', 'prereqContent', `must be 0 (${scanned} items re-derived)`);
  line('a goal quoted outside the workload the plan produced', 'workload', `must be 0 (${plans} plans)`);
  line('a confidence printed above its own lower bound', 'confidence', 'must be 0');
  /* A reload may take a claim back. It may never grant one. `load()` clips a
     posterior and reopens a line; nothing in it is allowed to hand a learner a
     line the file it read did not already hold, and until the simulation
     round-tripped through save()/load() there was no run in this repo in which
     that could have been noticed at all. */
  line('a save/load round trip that granted a claim', 'reloadGrant', 'must be 0');
}

const meanAvg = results.reduce((a, r) => a + r.avg, 0) / results.length;
console.log('\ncalibration — is the engine telling the truth?');
console.log(`  engine declared all ${SKILLS.length} skills mastered   ${pct(engineAll)}`);
console.log(`  learners with any hollow mastery claim   ${pct(anyHollow)}  (OLD: engine says mastered, mean hidden competence < ${HOLLOW})`);
console.log(`  learners with any hollow claim, STRICT   ${pct(anyHollowStrict)}  (NEW: + a hole, + the weakest surface actually served)`);
console.log(`  mean hidden competence across all skills ${meanAvg.toFixed(3)}`);

console.log('\nRESULT');
console.log(`  true mastery of ${LATTICE}: ${pct(reached)} of learners`);
console.log(`  every one of the ${SKILLS.length} skills truly mastered: ${pct(allTen)}`);
console.log(`\n  >>> ${(100 * reached / LEARNERS).toFixed(1)}% of simulated learners reach true mastery <<<\n`);
/**
 * BOTH ARMS, TOGETHER, WHERE THE HEADLINE IS.
 *
 * The sentence above belongs to ONE UNBROKEN SITTING. For the shipped route
 * that is 4,550 items and about 58 hours of work with no night in it, which is
 * not a shape any student has, and it was the only number a reader saw without
 * scrolling. The across-days figures printed forty lines earlier under their own
 * heading, and every consumer of this file — including the build's own mastery
 * gate — read the headline. So the arms are printed side by side, here, and the
 * one the product is actually delivered in is named as the one that certifies.
 *
 * The bar is NOT re-tested here. `tools/simulate-all.mjs` owns the severity
 * rule — route hard, preview advisory — and applies the 80% bar to the
 * delivered arm. A second copy of that threshold in this file is the defect the
 * form-floor comment above names: a gate and its audit may not keep separate
 * copies of the same constant. This file's exit code stays what it has always
 * been: the invariants, the ladder, and its own cohort's bar.
 */
{
  const d24 = returners[24].filter((r) => r.trueMastered >= SKILLS_NEEDED).length / returners[24].length;
  const d72 = returners[72].filter((r) => r.trueMastered >= SKILLS_NEEDED).length / returners[72].length;
  const sit24 = median(returners[24].map((r) => r.sessionTrace.length));
  console.log('  the two delivery shapes, same lattice, same bank, same item budget:');
  console.log(`    ONE UNBROKEN SITTING (the cram)        ${(100 * reached / LEARNERS).toFixed(1).padStart(5)}%   ${median(results.map((r) => r.items)).toFixed(0)} items in one go — the headline above, and this file's exit code`);
  console.log(`    ACROSS DAYS, every day (24 h)          ${(100 * d24).toFixed(1).padStart(5)}%   the same budget over ${sit24.toFixed(0)} sittings of ${SESSION_MINUTES} min — the shape BRIEF.md mandates`);
  console.log(`    ACROSS DAYS, every third day (72 h)    ${(100 * d72).toFixed(1).padStart(5)}%   the same again at a three-day gap`);
  console.log('    tools/simulate-all.mjs certifies the 80% promise on the ACROSS-DAYS rows, not on the cram.');
  console.log('');
}

/**
 * THE INVARIANTS DECIDE THE EXIT CODE.
 *
 * They printed `PASS` and `FAIL` and `must be 0` for their whole life and then
 * did not touch what this process returned — so a build could violate every one
 * of them and still exit 0, and a script that ran this file as a gate was
 * reading a headline while the failures scrolled past above it. An invariant a
 * caller cannot fail on is a comment.
 *
 * That is not hypothetical here. `hollowServed` — a mastery claim granted over a
 * question type this learner was served and never once solved — stood at
 * 16,453 of 35,719 claims before this round's fix, and the file it is measured
 * in exited 0 the whole time.
 */
const broken = Object.entries(VIOLATIONS).filter(([, n]) => n > 0);
if (broken.length) {
  console.log('\n  INVARIANTS BROKEN — this build does not ship:');
  for (const [k, n] of broken) console.log(`    ${k}  ${n}   first: ${FIRST[k]}`);
}
process.exit(reached / LEARNERS >= 0.8 && ladderBroken.length === 0 && !broken.length ? 0 : 1);
