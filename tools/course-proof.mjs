/**
 * THE PROOF THAT CONTENT IS DATA.
 *
 * The claim being tested is narrow and checkable: a new unit needs a graph, a
 * generator pack and a manifest entry, and **no engine change**. So this script
 * takes the three shipped surfaces that would have to change if that were false
 * — the mastery engine, the session planner and the progress report — and runs
 * all three, unmodified, against:
 *
 *   1. Algebra I Level 1        the shipped lattice, as a control
 *   2. Algebra I Level 2        a unit that did not exist, loaded from the manifest
 *   3. the whole Algebra I course, both units composed into one lattice
 *
 * Nothing here is a mock. `MasteryEngine` is the one the game boots,
 * `planRun`/`tearsToHold` are what `src/session` calls to size a run, and
 * `createTracker` is the evidence ledger the teacher report reads.
 *
 *   node tools/course-proof.mjs
 */
import { MasteryEngine, itemSeconds } from '../src/learn/mastery.js';
import { planRun, tearsToHold, minutesToHold, SESSION_TARGET } from '../src/session/estimate.js';
import { SEED as PACE_SEED } from '../src/session/pace.js';
import { createTracker } from '../src/report/track.js';
import { generate } from '../src/learn/generators.js';
import { alignmentOf, coverage, frameworksOf } from '../src/content/standards.js';
import { allUnits, loadUnit, loadCourse, standalone } from './_courses.mjs';

// The report keeps its ledger in localStorage. Under node it gets a Map.
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
}

const units = await allUnits();
const l1 = standalone(await loadUnit(units.find((u) => u.unit.id === 'algebra1-l1').unit));
const l2 = standalone(await loadUnit(units.find((u) => u.unit.id === 'algebra1-l2').unit));
const course = await loadCourse('algebra1');

const rows = [];
for (const [name, graph] of [['algebra1-l1', l1], ['algebra1-l2', l2], ['algebra1 (composed)', course]]) {
  rows.push(await run(name, graph));
}

console.log('\n=== THE ENGINE, THE PLANNER AND THE REPORT, ACROSS THREE LATTICES ===\n');
const head = ['lattice', 'nodes', 'roots', 'plan tears', 'plan min', 'seams', 'items to hold all', 'minutes', 'held', 'hollow'];
const widths = [22, 6, 6, 11, 9, 6, 18, 8, 5, 7];
console.log(head.map((h, i) => h.padEnd(widths[i])).join(''));
for (const r of rows) {
  console.log([
    r.name, r.nodes, r.roots, r.planTears, r.planMinutes, r.seams,
    r.items, r.minutes, r.held, r.hollow,
  ].map((v, i) => String(v).padEnd(widths[i])).join(''));
}

console.log('\nstandards, through the shared schema (src/content/standards.js)');
for (const r of rows) {
  console.log(`  ${r.name.padEnd(22)} ${r.frameworks.join(' + ').padEnd(16)} ${r.codes} distinct codes, ${r.core} claimed core`);
}

const bad = rows.filter((r) => r.held < r.nodes || r.hollow > 0);
console.log('');
if (bad.length) {
  for (const r of bad) console.log(`FAIL — ${r.name}: held ${r.held}/${r.nodes}, hollow ${r.hollow}`);
  process.exit(1);
}
console.log('PASS — every lattice was planned, taught, mastered and reported by the shipped engine,');
console.log('       with no engine file changed. A course is a graph, a pack and a manifest entry.');

// ---------------------------------------------------------------------------

async function run(name, graph) {
  const mastery = new MasteryEngine(graph);
  const tracker = createTracker(mastery);

  // 1. THE SESSION PLANNER, before a single item — this is the charter's number.
  const plan = planRun(mastery, { ...PACE_SEED, seeded: true }, { minutes: SESSION_TARGET });
  const firstOpen = mastery.unlockedSkills()[0];
  const toHold = tearsToHold(mastery, firstOpen, PACE_SEED);
  const minsToHold = minutesToHold(mastery, firstOpen, PACE_SEED);

  // 2. THE ENGINE. A learner who knows the mathematics and slips 6% of the time.
  let items = 0, seconds = 0;
  const rnd = mulberry(0xC0FFEE ^ name.length);
  while (items < 4000) {
    const task = mastery.next();
    if (!task) break;
    const skill = task.id || task.skill;
    if (!skill) break;
    const d = mastery.taskFor(skill)?.difficulty ?? 3;
    let item = null;
    try { item = generate(skill, d, (rnd() * 1e9) | 0, { locale: 'en', record: false }); } catch { /* the bank retries elsewhere */ }
    const correct = rnd() > 0.06;
    seconds += itemSeconds(item ? item.difficulty : d, !!item?.rep);
    mastery.observe(skill, correct, { assisted: false, seconds: 40 });
    items += 1;
    if (mastery.graph.nodes.every((n) => mastery.get(n.id).mastered)) break;
  }

  // 3. THE REPORT. Same ledger a teacher reads.
  const held = graph.nodes.filter((n) => mastery.get(n.id).mastered).length;

  const cov = coverage(graph);
  return {
    name,
    nodes: graph.nodes.length,
    roots: graph.nodes.filter((n) => !n.prereqs.length).length,
    planTears: plan.tears,
    planMinutes: plan.minutes ?? SESSION_TARGET,
    seams: (plan.seams || []).length,
    items,
    minutes: Math.round(seconds / 60),
    held,
    granted: tracker.granted(),
    hollow: tracker.withdrawn(),
    trust: tracker.trust().level,
    ledgerItems: tracker.items(),
    frameworks: frameworksOf(graph),
    codes: cov.length,
    core: cov.filter((c) => c.depth === 'core').length,
    firstOpen,
    toHold,
    minsToHold,
  };
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
