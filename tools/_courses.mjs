/**
 * The course loader, node side.
 *
 * `src/content/index.js` resolves content for the browser with Vite's
 * `import.meta.glob`, which does not exist under node. Tools read the same
 * `content/courses.json` off disk instead. The manifest stays the single source
 * of truth; only the file-finding differs.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerPack } from '../src/content/registry.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function manifest() {
  return JSON.parse(await readFile(path.join(ROOT, 'content/courses.json'), 'utf8'));
}

/** Every unit that has a graph, newest course last, in manifest order. */
export async function allUnits() {
  const m = await manifest();
  const out = [];
  for (const c of m.courses) for (const u of c.units || []) out.push({ course: c, unit: u });
  return out;
}

/** Parse one unit's graph and register its generator pack. */
export async function loadUnit(unit) {
  const graph = JSON.parse(await readFile(path.join(ROOT, 'content', unit.graph), 'utf8'));
  if (unit.pack) {
    const mod = await import(path.join(ROOT, 'src/content/packs', `${unit.pack}.js`));
    registerPack(mod.default);
  }
  return graph;
}

/** Load a whole course as one lattice, the way `?course=` does in the browser. */
export async function loadCourse(courseId) {
  const m = await manifest();
  const c = m.courses.find((x) => x.id === courseId);
  if (!c) throw new Error(`no course "${courseId}"`);
  const graphs = [];
  for (const u of c.units || []) graphs.push(await loadUnit(u));
  if (!graphs.length) throw new Error(`course "${courseId}" ships no units`);
  const head = graphs[0];
  const nodes = graphs.flatMap((g) => g.nodes);
  const ids = new Set(nodes.map((n) => n.id));
  const common = new Map();
  for (const g of graphs) for (const mm of g.commonMisconceptions || []) common.set(mm.id, mm);
  return {
    ...head,
    id: `${courseId}-composed`,
    nodes: nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => ids.has(p)) })),
    commonMisconceptions: [...common.values()],
  };
}

/** A single unit graph with cross-unit prerequisites dropped. */
export function standalone(graph) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  return { ...graph, nodes: graph.nodes.map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => ids.has(p)) })) };
}

/**
 * THE SHIPPED ROUTE, by the same rule `src/content/index.js` and
 * `tools/route-proof.mjs` apply: `route.units` names it outright, and when it
 * is null every unit the manifest itself calls `shipped` is on it.
 *
 * Tools that have to know the difference between "in front of a learner" and
 * "on disk" read this. A unit that is not on the route is still generated,
 * validated and simulated — it is simply never handed to somebody who did not
 * ask for it with `?unit=` — so a defect in it is worth less than the same
 * defect on the route, and the severity of a gate may follow that.
 *
 * @returns {{course:object, road:object[], off:object[], onRoute:(id:string)=>boolean}}
 */
export async function routeUnits(m = null) {
  const man = m || await manifest();
  const ROUTE = man.route || { course: man.default.course, units: null };
  const course = man.courses.find((c) => c.id === ROUTE.course);
  if (!course) throw new Error(`content/courses.json names route.course "${ROUTE.course}", which is not a course`);
  const units = course.units || [];
  const road = Array.isArray(ROUTE.units)
    ? units.filter((u) => ROUTE.units.includes(u.id))
    : units.filter((u) => (u.status || 'shipped') === 'shipped');
  if (Array.isArray(ROUTE.units)) {
    for (const id of ROUTE.units) {
      if (!units.some((u) => u.id === id)) throw new Error(`route.units names "${id}", which course "${course.id}" does not define`);
    }
  }
  const on = new Set(road.map((u) => u.id));
  return { course, road, off: units.filter((u) => !on.has(u.id)), onRoute: (id) => on.has(id) };
}
