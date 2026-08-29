/**
 * The course loader — and the route through it.
 *
 * ONE JOB: turn "which course, and how much of it has this learner earned" into
 * a knowledge graph the engine can run, and register the generators that graph
 * needs.
 *
 * Before this file, `src/main.js` said:
 *
 *     import graph from '../content/graph/algebra1-l1.json';
 *
 * — which is a course name compiled into the engine. Four courses do not
 * survive that: every new unit is an edit to the file that boots the game, and
 * nothing can ship a second graph without a second build.
 *
 * Now the only thing that names content is `content/courses.json`. This file
 * reads it, resolves the graphs beside it, loads the generator packs the units
 * ask for, and hands back a graph. Adding Algebra II, Geometry or Trigonometry
 * touches no file in `src/` except a new pack of item forms. See
 * `content/COURSES.md`.
 *
 * ---------------------------------------------------------------------------
 * THE ROUTE — why this file now reads the save
 *
 * Sixty-two skill lines shipped on disk across five units. A learner in normal
 * play reached ten of them, for one reason: this file returned the manifest's
 * default unit and **nothing in `src/` ever advanced it**. Levels 2 to 5 were
 * reachable only by hand-editing the URL, and every gate drove a unit by URL,
 * so no gate ever saw it.
 *
 * The fix is not to hand a new learner all sixty-two at once. It is that the
 * COMPOSED COURSE IS THE GRAPH, and its units OPEN IN SEQUENCE:
 *
 *   · a unit is open when every line of every unit it `requires` is held;
 *   · opening is one-way. A held line that lapses on a re-probe reopens the
 *     line, never the region — `everMastered` is the flag, and nothing in the
 *     mastery engine ever sets it back to false;
 *   · a unit the save already has evidence in is open whatever the roll-call
 *     says. That is the migration: no record can be dropped out of the lattice
 *     it was written in, so no held line can be lost;
 *   · only open units are composed, so the engine, the world and the session
 *     planner all see exactly the lattice the learner has earned and nothing
 *     beyond it.
 *
 * For Algebra I Level 1 the roll-call is not an extra gate at all — it is the
 * lattice's own terminal condition. `both-sides` stands at the end of a chain
 * that transitively requires all nine lines beneath it, so "every line of
 * Level 1 held" and "the last line of Level 1 held" are the same sentence.
 *
 * NOTHING ABOUT A NEW LEARNER'S FIRST SHARD MOVES. With no query string and a
 * cleared save, exactly one unit is open, `compose()` is never called, and this
 * returns the same parsed JSON object `main.js` used to import directly. Byte
 * for byte the same graph, the same ten nodes, the same generators, the same
 * world.
 *
 * WHY GLOB AND NOT `await import`. Every graph and every pack is matched at
 * build time by `import.meta.glob`, so the bundler can see them and the boot
 * path stays synchronous. A top-level `await` in `main.js` would push the first
 * frame behind a network round trip on a school Chromebook, which is the one
 * machine this has to be fast on. The manifest is still the only source of
 * truth; the glob just says "and all of these files exist".
 *
 * Tools run under node, where `import.meta.glob` does not exist. They use
 * `tools/_courses.mjs`, which reads the same manifest off disk.
 */
import manifest from '../../content/courses.json';
import { registerPack, loadedPacks } from './registry.js';
import { openUnitIds, stateOf, recordOfSkills } from './route.js';

const GRAPHS = import.meta.glob('../../content/graph/*.json', { eager: true, import: 'default' });
const PACKS = import.meta.glob('./packs/*.js', { eager: true, import: 'default' });

/** The manifest, as data. Nothing else in src/ may read the file. */
export const COURSES = manifest.courses;
export const DEFAULTS = manifest.default;
/**
 * The shipped route: which course a player walks with no query string, and how
 * far along it the game is allowed to take them. `units` is a whitelist, not an
 * order — the order is the course's own — so a unit still under construction
 * can sit in the manifest without a learner ever falling into it.
 */
export const ROUTE = manifest.route || { course: DEFAULTS.course, units: null };

/** Where a learner's progress is kept. Read here; written by src/main.js. */
const SAVE_KEY = 'ascent.save';

/** One course block, by id. */
export function courseById(id) {
  return COURSES.find((c) => c.id === id) || null;
}

/** One unit block, by id, with the course it belongs to. */
export function unitById(id) {
  for (const c of COURSES) {
    const u = (c.units || []).find((x) => x.id === id);
    if (u) return { course: c, unit: u };
  }
  return null;
}

/** Every unit that has a graph on disk, in manifest order. */
export function shippedUnits() {
  const out = [];
  for (const c of COURSES) for (const u of c.units || []) out.push({ course: c, unit: u });
  return out;
}

/**
 * What the player asked for.
 *
 * `?unit=` names one unit and runs it alone. `?units=` names several and
 * composes exactly those. `?course=` names a whole course and composes every
 * unit in it, earned or not. None of the three is set in normal play, and with
 * none of them set this returns the ROUTE — the composed course, opened as far
 * as this learner has earned it.
 *
 * The three query forms are unchanged on purpose: every gate in tools/ drives a
 * unit by URL, and a route that broke them would be a route nothing could
 * check.
 */
export function requestedSelection(search = (typeof location !== 'undefined' ? location.search : '')) {
  const q = new URLSearchParams(search || '');
  const unit = q.get('unit');
  const units = q.get('units');
  const course = q.get('course');
  if (unit && unitById(unit)) return { unit };
  if (units) {
    const ids = units.split(',').map((x) => x.trim()).filter((x) => unitById(x));
    if (ids.length) return { units: ids };
  }
  if (course && courseById(course)) return { course };
  return { route: ROUTE.course, unit: DEFAULTS.unit };
}

/**
 * Load a selection and return the graph the mastery engine runs on.
 *
 * @param {{unit?:string, units?:string[], course?:string, route?:string}} sel
 * @param {{held?:Set<string>, evidence?:Set<string>, storage?:object}} [opts]
 *        the learner's own record, for the route. Omitted, it is read off the
 *        save — which is what `main.js` wants and what a tool overrides.
 * @returns {{graph:object, courseId:string, unitIds:string[], packs:string[],
 *            route:object|null}}
 */
export function loadContent(sel = requestedSelection(), opts = {}) {
  const record = readRecord(opts);
  const chosen = sel.route ? openUnits(sel.route, record)
    : sel.course ? unitsOfCourse(sel.course)
      : sel.units ? sel.units.map((id) => unitById(id)).filter(Boolean)
        : [unitById(sel.unit)].filter(Boolean);
  if (!chosen.length) throw new Error(`no content for ${JSON.stringify(sel)}`);
  for (const { unit } of chosen) loadPack(unit.pack);
  const graphs = chosen.map(({ unit }) => graphOf(unit));
  const courseId = chosen[0].course.id;
  const graph = graphs.length === 1 ? pruneDangling(graphs[0]) : compose(graphs, courseId);
  return {
    graph,
    courseId,
    unitIds: chosen.map(({ unit }) => unit.id),
    packs: loadedPacks(),
    route: sel.route ? routeState(sel.route, record, chosen.map(({ unit }) => unit.id)) : null,
  };
}

// ---------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------

/** Every unit of one course, in manifest order. */
function unitsOfCourse(courseId) {
  const c = courseById(courseId);
  if (!c) return [];
  return (c.units || []).map((u) => ({ course: c, unit: u }));
}

/**
 * The units a route is allowed to reach, in course order.
 *
 * `route.units` in the manifest names them outright. With `null` there the
 * route is every unit the manifest itself calls `shipped` — so a unit is put in
 * front of a learner by the same field that already says whether it is finished,
 * and nothing has to be listed twice. `?unit=` and `?course=` ignore this
 * entirely: a preview unit is still one query string away for anyone checking it.
 */
export function routeUnits(courseId) {
  const all = unitsOfCourse(courseId);
  const allow = ROUTE.course === courseId && Array.isArray(ROUTE.units) ? ROUTE.units : null;
  return allow
    ? all.filter(({ unit }) => allow.includes(unit.id))
    : all.filter(({ unit }) => (unit.status || 'shipped') === 'shipped');
}

/** Every skill id a unit's graph declares. */
export function nodeIdsOf(unitId) {
  const found = unitById(unitId);
  if (!found) return [];
  return graphOf(found.unit).nodes.map((n) => n.id);
}

/**
 * Every unit that may appear in this learner's lattice.
 *
 * The route, plus any unit the record has already stood in, plus whatever those
 * require. The second term is the migration and it is not optional: a record
 * written under `?unit=algebra1-l4` is dropped by `MasteryEngine.load()` if
 * Level 4 is not in the graph, and the next autosave writes only the survivors
 * back. A unit a learner has evidence in is part of their lattice for ever,
 * whatever the manifest calls its status.
 */
function latticeUnits(courseId, record) {
  const all = unitsOfCourse(courseId);
  const onRoute = new Set(routeUnits(courseId).map(({ unit }) => unit.id));
  const keep = new Set(onRoute);
  for (const { unit } of all) {
    if (nodeIdsOf(unit.id).some((n) => record.evidence.has(n))) {
      keep.add(unit.id);
      for (const id of unit.requires || []) keep.add(id);
    }
  }
  return all.filter(({ unit }) => keep.has(unit.id));
}

/**
 * Which units this learner has opened. The rule lives in `./route.js`, which is
 * pure and therefore checkable under node; this only supplies the graphs.
 *
 * @param {string} courseId
 * @param {{held:Set<string>, evidence:Set<string>}} record
 * @returns {{course:object, unit:object}[]} in manifest order
 */
export function openUnits(courseId, record = { held: new Set(), evidence: new Set() }) {
  const list = latticeUnits(courseId, record);
  const open = openUnitIds(list.map(({ unit }) => unit), nodeIdsOf, record);
  return list.filter(({ unit }) => open.includes(unit.id));
}

/**
 * Everything the route knows at one instant: what is open, what is on the
 * island, what has been earned and is not on it yet, and what the next region
 * costs — in lines, never in a lesson number.
 *
 * @returns {{course:string, open:string[], seated:string[], waiting:string[],
 *            next:{unit:string, owed:string[]}|null}}
 */
export function routeState(courseId, record = readRecord(), seated = null) {
  const open = openUnits(courseId, record).map(({ unit }) => unit.id);
  const on = seated || open;
  // The NEXT region is asked of the route, not of the lattice: a preview unit
  // dragged in by an old record is part of this learner's world, but it is not
  // where the road goes.
  const road = routeUnits(courseId).map(({ unit }) => unit);
  return {
    course: courseId,
    ...stateOf(road, nodeIdsOf, record, on.filter((id) => road.some((u) => u.id === id))),
    open,
    seated: on,
    waiting: open.filter((id) => !on.includes(id)),
  };
}

/**
 * Which route units are actually standing on the island right now, read off the
 * graph the engine is running rather than off anything that has to be told.
 *
 * A unit is seated when every line it declares is in the lattice. That is the
 * one honest reading: the world is built from `graph.nodes`, so if a node is
 * not there, neither is its tear.
 */
export function seatedUnits(graph, courseId = ROUTE.course) {
  const ids = new Set((graph?.nodes || []).map((n) => n.id));
  if (!ids.size) return [];
  return unitsOfCourse(courseId)
    .map(({ unit }) => unit.id)
    .filter((id) => { const ns = nodeIdsOf(id); return ns.length > 0 && ns.every((n) => ids.has(n)); });
}

/**
 * Has this learner earned a region that is not on the island yet?
 *
 * Answered off a live mastery engine rather than off the save, so the beat can
 * fire on the answer that bought it instead of on the next reload.
 *
 * @param {object} mastery the live MasteryEngine
 * @param {string[]} seated unit ids currently in the world
 * @param {string} courseId
 */
export function regionEarned(mastery, seated = null, courseId = ROUTE.course) {
  const on = seated || seatedUnits(mastery?.graph, courseId);
  const skills = {};
  for (const [id, s] of mastery?.state || []) skills[id] = s;
  const st = routeState(courseId, recordOfSkills(skills), on);
  return st.waiting.length ? { unit: st.waiting[0], route: st } : null;
}

/**
 * The learner's record, as the route reads it.
 *
 * `held` is what has been proved at least once (`everMastered`). `evidence` is
 * anything the record has ever been asked about, which is the wider net the
 * migration needs. Storage that cannot be read is a learner with nothing held,
 * never an exception — a private-mode tab still gets a game.
 */
function readRecord(opts = {}) {
  if (opts.held || opts.evidence) {
    return { held: asSet(opts.held), evidence: asSet(opts.evidence, asSet(opts.held)) };
  }
  try {
    const store = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const raw = store && store.getItem(SAVE_KEY);
    return recordOfSkills(raw ? (JSON.parse(raw)?.mastery?.skills || {}) : {});
  } catch { /* an unreadable save is a cold start, never a crash */ }
  return { held: new Set(), evidence: new Set() };
}

function asSet(v, fallback = null) {
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  return fallback || new Set();
}

/** The parsed graph a unit names. */
export function graphOf(unit) {
  const key = `../../content/${unit.graph}`;
  const g = GRAPHS[key];
  if (!g) throw new Error(`unit "${unit.id}" names a graph that is not there: ${unit.graph}`);
  return g;
}

/** Register a unit's generator pack. `null` means the core bank, already in. */
function loadPack(id) {
  if (!id) return;
  const pack = PACKS[`./packs/${id}.js`];
  if (!pack) throw new Error(`no generator pack "${id}"`);
  registerPack(pack);
}

/**
 * A unit loaded on its own may point at prerequisites that live in another
 * unit. Those nodes are not in the lattice, so the reference is dropped and the
 * node stands at the root — which is the correct reading of "you are starting
 * here". Composing the whole course instead keeps every edge.
 */
function pruneDangling(graph) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (graph.nodes.every((n) => n.prereqs.every((p) => ids.has(p)))) return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => ids.has(p)) })),
  };
}

/**
 * Several unit graphs, one lattice.
 *
 * Everything above `nodes` is taken from the first graph, because the mastery
 * configuration is the course's and not the unit's — a unit may not invent a
 * different kind of proof. Misconception vocabularies are unioned, since a
 * later unit is allowed to name errors the first one never saw.
 */
function compose(graphs, courseId) {
  const head = graphs[0];
  const nodes = [];
  const seen = new Set();
  for (const g of graphs) {
    for (const n of g.nodes) {
      if (seen.has(n.id)) throw new Error(`two units both define "${n.id}"`);
      seen.add(n.id);
      nodes.push(n);
    }
  }
  const common = new Map();
  for (const g of graphs) for (const m of g.commonMisconceptions || []) common.set(m.id, m);
  return {
    ...head,
    id: `${courseId || head.course || head.id}-composed`,
    nodes: nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => seen.has(p)) })),
    commonMisconceptions: [...common.values()],
    composedFrom: graphs.map((g) => g.unit || g.id),
  };
}
