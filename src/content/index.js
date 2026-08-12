/**
 * The course loader.
 *
 * ONE JOB: turn "which course, which unit" into a knowledge graph the engine
 * can run, and register the generators that graph needs.
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
 * reads it, resolves the graph beside it, loads the generator pack the unit
 * asks for, and hands back a graph. Adding Algebra II, Geometry or Trigonometry
 * touches no file in `src/` except a new pack of item forms. See
 * `content/COURSES.md`.
 *
 * NOTHING ABOUT THE SHIPPED EXPERIENCE MOVES. With no query string the loader
 * resolves the manifest's `default` — Algebra I, Level 1 — and returns the same
 * parsed JSON object `main.js` used to import directly. Byte for byte the same
 * graph, the same ten nodes, the same generators.
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

const GRAPHS = import.meta.glob('../../content/graph/*.json', { eager: true, import: 'default' });
const PACKS = import.meta.glob('./packs/*.js', { eager: true, import: 'default' });

/** The manifest, as data. Nothing else in src/ may read the file. */
export const COURSES = manifest.courses;
export const DEFAULTS = manifest.default;

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
 * `?unit=` names one unit. `?course=` names a whole course and composes every
 * unit in it into one lattice. Neither is set in normal play, and with neither
 * set this returns the manifest default — which is the shipped game.
 */
export function requestedSelection(search = (typeof location !== 'undefined' ? location.search : '')) {
  const q = new URLSearchParams(search || '');
  const unit = q.get('unit');
  const course = q.get('course');
  if (unit && unitById(unit)) return { unit };
  if (course && courseById(course)) return { course };
  return { unit: DEFAULTS.unit };
}

/**
 * Load a selection and return the graph the mastery engine runs on.
 *
 * @param {{unit?:string, course?:string}} sel
 * @returns {{graph:object, courseId:string, unitIds:string[], packs:string[]}}
 */
export function loadContent(sel = requestedSelection()) {
  const chosen = sel.course ? unitsOfCourse(sel.course) : [unitById(sel.unit)].filter(Boolean);
  if (!chosen.length) throw new Error(`no content for ${JSON.stringify(sel)}`);
  for (const { unit } of chosen) loadPack(unit.pack);
  const graphs = chosen.map(({ unit }) => graphOf(unit));
  const graph = graphs.length === 1 ? pruneDangling(graphs[0]) : compose(graphs);
  return {
    graph,
    courseId: chosen[0].course.id,
    unitIds: chosen.map(({ unit }) => unit.id),
    packs: loadedPacks(),
  };
}

/** Every unit of one course, in manifest order. */
function unitsOfCourse(courseId) {
  const c = courseById(courseId);
  if (!c) return [];
  return (c.units || []).map((u) => ({ course: c, unit: u }));
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
function compose(graphs) {
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
    id: `${head.course || head.id}-composed`,
    nodes: nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => seen.has(p)) })),
    commonMisconceptions: [...common.values()],
    composedFrom: graphs.map((g) => g.unit || g.id),
  };
}
