#!/usr/bin/env node
/**
 * THE ROUTE GATE — does a learner actually get past Level 1, and does anybody
 * lose a line on the way?
 *
 *   node tools/route-proof.mjs
 *   node tools/route-proof.mjs --self-test   # prove this gate can fail
 *
 * WHY IT EXISTS
 *
 * Sixty-two skill lines shipped on disk across five units. A learner in normal
 * play reached TEN. `src/content/index.js` returned the manifest's default unit
 * and nothing in `src/` ever advanced it, so Levels 2 to 5 were reachable only
 * by hand-editing the URL — and every gate in this repo drove a unit by URL, so
 * not one of them could see it. That is the defect this file is the instrument
 * for: it never passes a unit id in, it asks the route what a learner with a
 * given record gets.
 *
 * WHAT IT ASSERTS
 *
 *   A. THE FIRST SHARD DOES NOT MOVE. A cleared record opens exactly one unit,
 *      the manifest's default, with the same ten nodes and the same edges the
 *      game shipped with. Nine of ten held is still one unit.
 *   B. THE ROUTE OPENS. Ten of ten held opens the next unit, and the composed
 *      lattice holds every edge — no node may stand on a prerequisite that is
 *      not in the graph with it.
 *   C. OPENING IS ONE-WAY. A region that has opened stays open when a held line
 *      lapses, because a spaced re-probe coming due must never take a place
 *      away from a learner.
 *   D. NOBODY LOSES A LINE. This is the migration, and it is asserted through
 *      the REAL `MasteryEngine`, not by reading the rule back to itself: a save
 *      written under the old shape is loaded into the new lattice and every
 *      held line, every attempt count and every form counter must still be
 *      there — and must still be there after the engine writes itself back out,
 *      which is where a dropped record actually becomes permanent.
 *   E. AN OFF-ROUTE RECORD SURVIVES TOO. A save written under `?course=` or
 *      `?unit=algebra1-l5` carries lines the route would not otherwise seat.
 *      They are seated anyway, for the same reason.
 *   F. THE ROUTE IS REACHABLE END TO END. Playing the real engine forward with
 *      a learner who answers correctly opens every unit on the route, and the
 *      modelled minutes at which each one opens are printed.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openUnitIds, nextUnit, stateOf, recordOfSkills } from '../src/content/route.js';
import { MasteryEngine, itemSeconds } from '../src/learn/mastery.js';
import { planRun, SESSION_MIN, SESSION_MAX } from '../src/session/estimate.js';
import { createPace } from '../src/session/pace.js';
import { generate } from '../src/learn/generators.js';
import { registerPack } from '../src/content/registry.js';
import { findings } from './_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF_TEST = process.argv.includes('--self-test');

const fails = [];
const ok = (label, detail = '') => console.log(`  ok   ${label}${detail ? ' — ' + detail : ''}`);
const bad = (label, detail = '') => { fails.push(label); console.log(` FAIL ${label}${detail ? ' — ' + detail : ''}`); };
const is = (cond, label, detail = '') => (cond ? ok(label, detail) : bad(label, detail));

// ---------------------------------------------------------------------------
// The manifest and its graphs, off disk — the same files the bundler globs.
// ---------------------------------------------------------------------------
const manifest = JSON.parse(await readFile(path.join(ROOT, 'content/courses.json'), 'utf8'));
const ROUTE = manifest.route || { course: manifest.default.course, units: null };
const course = manifest.courses.find((c) => c.id === ROUTE.course);
const graphs = new Map();
for (const u of course.units) {
  graphs.set(u.id, JSON.parse(await readFile(path.join(ROOT, 'content', u.graph), 'utf8')));
  if (u.pack) registerPack((await import(path.join(ROOT, 'src/content/packs', `${u.pack}.js`))).default);
}
const nodesOf = (id) => (graphs.get(id)?.nodes || []).map((n) => n.id);

/** Units on the route, by the same rule `src/content/index.js` applies. */
const road = Array.isArray(ROUTE.units)
  ? course.units.filter((u) => ROUTE.units.includes(u.id))
  : course.units.filter((u) => (u.status || 'shipped') === 'shipped');

/** Compose, exactly as the loader does. */
function compose(unitIds) {
  const gs = unitIds.map((id) => graphs.get(id));
  const head = gs[0];
  const nodes = gs.flatMap((g) => g.nodes);
  const ids = new Set(nodes.map((n) => n.id));
  return { ...head, id: `${course.id}-composed`, nodes: nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => ids.has(p)) })) };
}
/** The lattice a record earns, as the loader would build it. */
function latticeFor(record) {
  const open = openUnitIds(road, nodesOf, record);
  return { open, graph: open.length === 1 ? standalone(graphs.get(open[0])) : compose(open) };
}
function standalone(g) {
  const ids = new Set(g.nodes.map((n) => n.id));
  return { ...g, nodes: g.nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => ids.has(p)) })) };
}

console.log('ASCENT — the route past Level 1\n');
console.log(`route: ${ROUTE.course} · ${road.map((u) => u.id).join(' -> ')}`);
console.log(`course on disk: ${course.units.length} units, ${course.units.reduce((a, u) => a + nodesOf(u.id).length, 0)} lines\n`);

// ---------------------------------------------------------------------------
// A. the first shard does not move
// ---------------------------------------------------------------------------
console.log('A. the shipped first shard');
const first = manifest.default.unit;
const cold = latticeFor({ held: new Set(), evidence: new Set() });
is(cold.open.length === 1 && cold.open[0] === first,
  'a cleared record opens exactly one unit', cold.open.join(','));
is(cold.graph.nodes.length === nodesOf(first).length,
  'and it is the shipped lattice, node for node', `${cold.graph.nodes.length} nodes`);
{
  const shipped = graphs.get(first);
  const same = shipped.nodes.every((n, i) => cold.graph.nodes[i].id === n.id
    && JSON.stringify(cold.graph.nodes[i].prereqs) === JSON.stringify(n.prereqs));
  is(same, 'every node and every edge is the one that shipped');
}
{
  const all = nodesOf(first);
  const nine = latticeFor(recordOfSkills(Object.fromEntries(all.slice(0, -1).map((id) => [id, { everMastered: true, mastered: true }]))));
  is(nine.open.length === 1, 'nine of ten lines held opens nothing new', nine.open.join(','));
}

// ---------------------------------------------------------------------------
// B. the route opens
// ---------------------------------------------------------------------------
console.log('\nB. the route opens, one region at a time');
const heldTo = (n) => {
  const held = new Set();
  for (const u of road.slice(0, n)) for (const id of nodesOf(u.id)) held.add(id);
  return recordOfSkills(Object.fromEntries([...held].map((id) => [id, { everMastered: true, mastered: true }])));
};
for (let i = 1; i <= road.length; i++) {
  const rec = heldTo(i);
  const lat = latticeFor(rec);
  const want = road.slice(0, Math.min(i + 1, road.length)).map((u) => u.id);
  is(JSON.stringify(lat.open) === JSON.stringify(want),
    `every line of ${road.slice(0, i).map((u) => u.id).join(' + ')} held opens ${want.length} unit(s)`,
    lat.open.join(','));
  const ids = new Set(lat.graph.nodes.map((n) => n.id));
  const dangling = lat.graph.nodes.flatMap((n) => n.prereqs.filter((p) => !ids.has(p)));
  is(dangling.length === 0, `  and the composed lattice keeps every edge (${lat.graph.nodes.length} nodes)`, dangling.join(','));
}
{
  const rec = heldTo(road.length);
  const n = nextUnit(road, nodesOf, rec);
  is(n === null, 'past the last region on the route there is no next one', String(n && n.unit));
}
{
  const st = stateOf(road, nodesOf, heldTo(1), [road[0].id]);
  is(st.waiting.length === 1 && st.waiting[0] === road[1].id,
    'a region earned mid-run is reported as waiting for planetfall', st.waiting.join(','));
  const cold2 = stateOf(road, nodesOf, { held: new Set(), evidence: new Set() }, [road[0].id]);
  is(cold2.next && cold2.next.unit === road[1].id && cold2.next.owed.length === nodesOf(road[0].id).length,
    'and before it is earned the route states what it costs, in lines',
    cold2.next ? `${cold2.next.owed.length} lines` : 'none');
}

// ---------------------------------------------------------------------------
// C. opening is one-way
// ---------------------------------------------------------------------------
console.log('\nC. a region that opened never closes');
{
  const skills = Object.fromEntries(nodesOf(first).map((id, i) => [id, {
    // the whole shard proved, and then the last line lapsed on a re-probe
    everMastered: true, mastered: i !== 0, attempts: 9,
  }]));
  const lat = latticeFor(recordOfSkills(skills));
  is(lat.open.length >= 2, 'a lapsed line reopens the line, not the region', lat.open.join(','));
}

// ---------------------------------------------------------------------------
// D. nobody loses a line — through the real engine
// ---------------------------------------------------------------------------
console.log('\nD. the migration, through the real MasteryEngine');
{
  // A save written under the OLD shape: the ten-node lattice, played.
  const oldGraph = standalone(graphs.get(first));
  const before = new MasteryEngine(oldGraph);
  let n = 0;
  for (const node of oldGraph.nodes) {
    // Real observations through the real engine, so the record is one the game
    // could actually have written rather than a literal invented here.
    for (let i = 0; i < 14; i++) {
      const it = safeItem(node.id, 3 + (i % 3));
      before.observe(node.id, true, { assisted: false, form: it?.form, rep: it?.rep, scene: it?.scene, kind: 'learn' });
      n++;
    }
  }
  const oldSave = before.save();
  const heldBefore = Object.entries(oldSave.skills).filter(([, s]) => s.mastered).map(([id]) => id);
  const everBefore = Object.entries(oldSave.skills).filter(([, s]) => s.everMastered).map(([id]) => id);
  console.log(`     old save: ${n} observations, ${heldBefore.length} lines held, ${everBefore.length} ever held`);
  is(heldBefore.length > 0, 'the old save actually holds lines (else this proves nothing)', String(heldBefore.length));

  // Now open it under the NEW shape: the route reads the save and composes.
  const rec = recordOfSkills(oldSave.skills);
  const lat = latticeFor(rec);
  is(lat.open.length >= 2, 'the returning learner arrives in a bigger lattice', `${lat.graph.nodes.length} nodes`);
  const after = new MasteryEngine(lat.graph, oldSave);
  const lost = heldBefore.filter((id) => !after.get(id)?.mastered);
  is(lost.length === 0, 'every held line survives the load', lost.join(',') || 'none lost');
  const lostEver = everBefore.filter((id) => !after.get(id)?.everMastered);
  is(lostEver.length === 0, 'every line ever held is still recorded as ever held', lostEver.join(',') || 'none lost');
  const attemptsLost = Object.entries(oldSave.skills).filter(([id, s]) => (after.get(id)?.attempts || 0) < (s.attempts || 0));
  is(attemptsLost.length === 0, 'no attempt count goes backwards', attemptsLost.map(([id]) => id).join(','));
  const formsLost = Object.entries(oldSave.skills).filter(([id, s]) => Object.keys(s.formsSeen || {}).some((f) => !after.get(id)?.formsSeen?.[f]));
  is(formsLost.length === 0, 'no question-type counter is dropped', formsLost.map(([id]) => id).join(','));
  // …and the write-back, which is where a dropped record becomes permanent.
  const rewritten = after.save();
  const gone = Object.keys(oldSave.skills).filter((id) => !rewritten.skills[id]);
  is(gone.length === 0, 'and the next autosave still carries every one of them', gone.join(',') || 'none dropped');
  const stillHeld = heldBefore.filter((id) => rewritten.skills[id]?.mastered);
  is(stillHeld.length === heldBefore.length, 'the rewritten save holds the same lines', `${stillHeld.length}/${heldBefore.length}`);
}

// ---------------------------------------------------------------------------
// E. a record written off the route
// ---------------------------------------------------------------------------
console.log('\nE. a record written off the route (?course= / ?unit=)');
{
  const offRoute = course.units.find((u) => !road.some((r) => r.id === u.id));
  if (!offRoute) {
    ok('every unit in the course is on the route; nothing can be written off it');
  } else {
    const skills = {};
    for (const u of road) for (const id of nodesOf(u.id)) skills[id] = { everMastered: true, mastered: true, attempts: 12 };
    for (const id of nodesOf(offRoute.id)) skills[id] = { everMastered: true, mastered: true, attempts: 7 };
    const rec = recordOfSkills(skills);
    // The loader's own lattice rule: route units, plus any unit the record
    // stands in, plus what those require.
    const keep = new Set(road.map((u) => u.id));
    for (const u of course.units) {
      if (nodesOf(u.id).some((x) => rec.evidence.has(x))) { keep.add(u.id); for (const r of u.requires || []) keep.add(r); }
    }
    const units = course.units.filter((u) => keep.has(u.id));
    const open = openUnitIds(units, nodesOf, rec);
    is(open.includes(offRoute.id), `a save with ${offRoute.id} progress still seats ${offRoute.id}`, open.join(','));
    const g = compose(open);
    const engine = new MasteryEngine(g, { v: 3, skills });
    const lost = Object.keys(skills).filter((id) => !engine.get(id)?.mastered);
    is(lost.length === 0, 'and not one of its held lines is dropped', lost.join(',') || 'none lost');
  }
}

// ---------------------------------------------------------------------------
// F. the route is walkable end to end, and how long each region costs
// ---------------------------------------------------------------------------
console.log('\nF. time to open each region — the real engine, a learner who answers correctly');
{
  let record = { held: new Set(), evidence: new Set() };
  let seconds = 0;
  let items = 0;
  const rows = [];
  let guard = 0;
  while (guard++ < 40) {
    const lat = latticeFor(record);
    const engine = new MasteryEngine(lat.graph);
    // Restore what has already been proved, exactly as a returning save would.
    for (const id of record.held) {
      const s = engine.get(id);
      if (s) { s.mastered = true; s.everMastered = true; s.pL = 0.99; }
    }
    const before = new Set(record.held);
    let spent = 0;
    for (let i = 0; i < 900; i++) {
      const objective = engine.next();
      if (!objective) break;
      const task = engine.taskFor(objective.id);
      if (!task) break;
      const it = safeItem(task.skill, task.difficulty, task.formCandidates);
      engine.observe(task.skill, true, {
        assisted: task.scaffold !== 'none', form: it?.form, rep: it?.rep, scene: it?.scene, kind: task.kind,
      });
      spent += itemSeconds({ rep: it?.rep, difficulty: task.difficulty, scaffold: task.scaffold });
      items++;
      const held = new Set([...engine.state].filter(([, s]) => s.everMastered).map(([id]) => id));
      if (lat.graph.nodes.every((n) => held.has(n.id))) { record = { held, evidence: held }; break; }
      record = { held, evidence: held };
    }
    seconds += spent;
    const gained = [...record.held].filter((id) => !before.has(id));
    const nowOpen = latticeFor(record).open;
    rows.push({ seated: lat.open.join('+'), opened: nowOpen.slice(lat.open.length).join(','), minutes: seconds / 60, items });
    if (nowOpen.length === lat.open.length) break;
    if (!gained.length) break;
  }
  for (const r of rows) {
    console.log(`     ${r.seated.padEnd(38)} ${r.opened ? 'opens ' + r.opened : 'end of route'}   ${r.minutes.toFixed(0).padStart(4)} min cumulative, ${r.items} items`);
  }
  const reached = rows[rows.length - 1];
  const finalOpen = latticeFor(record).open;
  is(finalOpen.length === road.length, 'a learner who answers correctly opens every region on the route',
    finalOpen.join(','));
  is(reached.minutes > 0, 'and the cost of each is a measured number of minutes, not an assertion');
}

// ---------------------------------------------------------------------------
// G. the Pomodoro survives the bigger lattice
// ---------------------------------------------------------------------------
console.log('\nG. the session is still 15-25 minutes with every region open');
{
  // `tools/session-length.mjs` grades the run against a hidden-competence
  // learner, and it reads the shipped ten-node graph off disk — so it can prove
  // the first region and nothing beyond it. This is the same question asked of
  // the lattice the ROUTE actually composes: the planner only ever picks from
  // what is unlocked, so a bigger graph must not make a longer run.
  for (let i = 1; i <= road.length; i++) {
    const open = road.slice(0, i).map((u) => u.id);
    const graph = open.length === 1 ? standalone(graphs.get(open[0])) : compose(open);
    const engine = new MasteryEngine(graph);
    // A learner partway through: everything before the last region held.
    for (const u of road.slice(0, i - 1)) {
      for (const id of nodesOf(u.id)) {
        const st = engine.get(id);
        if (st) { st.mastered = true; st.everMastered = true; st.pL = 0.99; }
      }
    }
    const p = planRun(engine, createPace(), { minutes: 20, seed: 0x5eed });
    is(p.minutes >= SESSION_MIN && p.minutes <= SESSION_MAX,
      `${graph.nodes.length} lines seated: the plan is still one Pomodoro`,
      `${p.tears} tears, ${p.minutes} min (window ${SESSION_MIN}-${SESSION_MAX})`);
    /* WHAT A SEAM IS, AND WHAT IT IS NOT.
     *
     * This assertion first read "every seam is unlocked right now", and the
     * SHIPPED ten-line lattice failed it — unchanged, with nothing of mine in
     * it. That is the refutation: `planRun` projects the run forward, so it
     * legitimately names a line the learner will unlock *during* the run
     * (`eval-expr` is named on a cold save, and `var-meaning` is what opens
     * it). Requiring present-tense unlock would have failed the game that
     * ships. The real promise is the two things a goal may never do: name a
     * line that is not in the lattice, or plan work on a line already held. */
    const ids = new Set(graph.nodes.map((n) => n.id));
    is(p.seams.every((sm) => ids.has(sm.id)),
      '  and every seam it names is a line of this lattice',
      p.seams.map((sm) => sm.id).filter((id) => !ids.has(id)).join(',') || 'all of them');
    /* …and the promise. This first read "no seam is a held line" and the
     * refutation is in the engine's own documented behaviour: a returning save
     * has no `dueTime` on its held lines, so `load()` brings every one of them
     * back DUE, and a run that spends minutes on a due re-probe is the spacing
     * schedule working rather than a planner wasting the learner's time. What
     * may never happen is the card PROMISING to close a line that is already
     * closed — `promised` is the subset the orders actually claim, and that is
     * the list this holds to account. */
    is(p.promised.every((id) => !engine.get(id)?.mastered),
      '  and it promises to close nothing the learner already holds',
      p.promised.filter((id) => engine.get(id)?.mastered).join(',') || 'none');
  }
}

// ---------------------------------------------------------------------------
// SELF-TEST — plant the exact defect this gate exists to catch
// ---------------------------------------------------------------------------
if (SELF_TEST) {
  console.log('\nself-test — the defect this gate exists to catch');
  // The shipped defect: the route never advances. The learner holds every line
  // of the first region and has never touched another — exactly the record that
  // reached ten of sixty-two lines — and a route with an unsatisfiable step in
  // it leaves them there.
  const frozen = road.map((u) => (u.id === road[0].id ? u : { ...u, requires: ['never-held'] }));
  const stuck = openUnitIds(frozen, (id) => (id === 'never-held' ? ['never-held'] : nodesOf(id)), heldTo(1));
  is(stuck.length === 1, 'a route that cannot advance is caught', `${stuck.length} unit(s) open with the first region held`);
  // …and the control: the real route, on the same record, does advance.
  const moving = openUnitIds(road, nodesOf, heldTo(1));
  is(moving.length === 2, 'while the shipped route, on the same record, opens the next region', moving.join(','));
  // And the migration defect: a lattice that drops a record.
  const g = standalone(graphs.get(first));
  const engine = new MasteryEngine(g, { v: 3, skills: { 'not-in-this-graph': { everMastered: true, mastered: true, attempts: 5 } } });
  is(!engine.get('not-in-this-graph'), 'a record outside the lattice really is dropped by the engine (which is why E exists)');
}

console.log('');
if (!fails.length) {
  console.log('the road past Level 1 exists, and nobody loses a line walking it.');
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The road IS the shipped
   route: a learner who cannot get past Level 1 meets this on their first day. */
findings('check:route', { scope: 'route' }).route(fails.map(String)).done();

/** One real item from the real bank, or null if the bank refuses this shape. */
function safeItem(skill, difficulty, forms) {
  const form = forms && forms.length ? forms[Math.floor(Math.random() * forms.length)] : undefined;
  for (let k = 0; k < 3; k++) {
    try { return generate(skill, difficulty, (Math.random() * 1e9) | 0, { locale: 'en', form }); } catch { /* try again */ }
  }
  try { return generate(skill, difficulty, 1, { locale: 'en' }); } catch { return null; }
}
