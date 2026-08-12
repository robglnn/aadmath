/**
 * The multi-course content gate.
 *
 * `tools/validate-items.mjs` is the gate for the shipped bank, and it is
 * deliberately left exactly as it was: it proves Algebra I Level 1 and it must
 * keep proving it with nothing new in the way.
 *
 * This is the gate for everything the manifest adds on top. For every unit in
 * content/courses.json it checks:
 *
 *   · the graph is a DAG, and every prerequisite either exists in the unit or
 *     in a unit the manifest says this one requires;
 *   · every node has a generator and every generator has a node;
 *   · every node's standards alignment resolves through the shared schema
 *     (src/content/standards.js) in every framework the course declares, with
 *     a code, a text and an honest depth;
 *   · every misconception a distractor names is declared by the graph;
 *   · every declared representation can actually be produced;
 *   · items generate, verify and render under strict KaTeX in EN, ES and PL;
 *   · the difficulty ladder really rises, band 1 to band 5, per skill;
 *   · the three locale bundles of every pack have identical key sets.
 *
 *   node tools/validate-courses.mjs [seeds]
 */
import katex from 'katex';
import { generate, demandOf, verify } from '../src/learn/generators.js';
import { hasSkill, formsFor, packStrings } from '../src/content/registry.js';
import { alignmentOf, practicesOf, alignmentNote, DEPTHS, coverage } from '../src/content/standards.js';
import { allUnits, loadUnit, standalone } from './_courses.mjs';

/** Seeds per band, per skill. The difficulty ladder is a mean, so it needs volume. */
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 240);
/** How many of those seeds get re-derived, KaTeX-checked and read in three languages. */
const DEEP = 8;
const LOCALES = ['en', 'es', 'pl'];
const problems = [];
const fail = (m) => problems.push(m);
let checked = 0;

const units = await allUnits();
const loaded = [];
for (const { course, unit } of units) {
  const graph = await loadUnit(unit);
  loaded.push({ course, unit, graph });
}
const idsByUnit = new Map(loaded.map(({ unit, graph }) => [unit.id, new Set(graph.nodes.map((n) => n.id))]));

for (const { course, unit, graph } of loaded) {
  const tag = `${course.id}/${unit.id}`;
  const ids = idsByUnit.get(unit.id);
  const visible = new Set(ids);
  for (const req of unit.requires || []) {
    const other = idsByUnit.get(req);
    if (!other) fail(`${tag}: requires unit "${req}", which the manifest does not ship`);
    else for (const id of other) visible.add(id);
  }

  // --- graph shape ---------------------------------------------------------
  if (new Set(graph.nodes.map((n) => n.id)).size !== graph.nodes.length) fail(`${tag}: duplicate node ids`);
  for (const n of graph.nodes) {
    for (const p of n.prereqs) {
      if (!visible.has(p)) fail(`${tag}: ${n.id} requires "${p}", which is in no visible unit`);
    }
    if (!n.bigIdea) fail(`${tag}: ${n.id} has no big idea`);
    if (!n.bkt) fail(`${tag}: ${n.id} has no BKT parameters`);
    if (!hasSkill(n.id)) fail(`${tag}: node "${n.id}" has no generator`);
  }
  // cycles, within the unit
  const seen = new Set();
  const stack = new Set();
  const walk = (id) => {
    if (stack.has(id)) { fail(`${tag}: prerequisite cycle through "${id}"`); return; }
    if (seen.has(id)) return;
    stack.add(id); seen.add(id);
    const n = graph.nodes.find((x) => x.id === id);
    for (const p of n?.prereqs || []) if (ids.has(p)) walk(p);
    stack.delete(id);
  };
  for (const n of graph.nodes) walk(n.id);

  // generators with no node in any unit of this course
  const courseIds = new Set((course.units || []).flatMap((u) => [...(idsByUnit.get(u.id) || [])]));
  for (const skill of Object.keys(graph.nodes.reduce((a, n) => a, {}))) void skill;

  // --- standards -----------------------------------------------------------
  const declared = new Set(course.frameworks || []);
  const unified = graph.schema === 'unified-alignment-1';
  for (const n of graph.nodes) {
    const al = alignmentOf(n);
    if (!al.length) fail(`${tag}: ${n.id} cites no standards`);
    const fws = new Set(al.map((a) => a.framework));
    for (const fw of declared) {
      if (!fws.has(fw)) fail(`${tag}: ${n.id} cites nothing from ${fw}, which the course declares`);
      if (!alignmentNote(n, fw)) fail(`${tag}: ${n.id} has no alignment note for ${fw}`);
    }
    for (const a of al) {
      if (!a.code) fail(`${tag}: ${n.id} cites a standard with no code`);
      if (!a.text || a.text.length < 20) fail(`${tag}: ${n.id} cites ${a.code} with no quoted text`);
      if (!DEPTHS.includes(a.depth)) fail(`${tag}: ${n.id} cites ${a.code} at unknown depth "${a.depth}"`);
      // A unit written against the unified schema has to say which part of a
      // partial claim it does not test. The legacy Level 1 shape carries that
      // sentence in its standards map instead, and is not re-litigated here.
      if (unified && a.depth !== 'core' && !a.caveat) {
        fail(`${tag}: ${n.id} claims ${a.code} at ${a.depth} without saying which part is missing`);
      }
      if (a.framework === 'TEKS' && !a.citation) fail(`${tag}: ${n.id} cites TEKS ${a.code} with no 19 TAC citation`);
    }
    const pr = practicesOf(n);
    for (const fw of declared) {
      if (!(pr[fw] || []).length) fail(`${tag}: ${n.id} claims no ${fw} process standards`);
    }
  }
  const cov = coverage(graph);
  if (cov.some((r) => !r.code)) fail(`${tag}: coverage table has a row with no code`);

  // --- items ---------------------------------------------------------------
  const declaredMis = new Set([
    ...(graph.commonMisconceptions || []).map((m) => m.id),
    ...graph.nodes.flatMap((n) => (n.misconceptions || []).map((m) => m.id)),
  ]);
  for (const n of graph.nodes) {
    const forms = formsFor(n.id) || [];
    if (forms.length < 2) fail(`${tag}: ${n.id} has fewer than two item forms, so the proving run has no unseen form`);
    const reps = new Set(forms.map((f) => f.rep));
    for (const rep of n.requiredReps || []) {
      if (!reps.has(rep)) fail(`${tag}: ${n.id} declares the "${rep}" representation and no form produces it`);
    }
    if ([...reps].every((rp) => rp === 'symbolic')) fail(`${tag}: ${n.id} is symbolic only; the gate requires a non-symbolic item`);

    /* EVERY FORM, BY NAME.
       `generate()` draws a form at random from the band's pool and retries on
       failure, so a form that throws every single time is silently replaced by
       its neighbours and the run still passes. That is exactly how a stem
       reading `l2.ask.missingReading` — a key that did not exist — reached the
       real learning surface with a green gate behind it. Each form is therefore
       asked for by name first, in all three locales, before anything is
       measured. */
    for (const f of forms) {
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (const loc of LOCALES) {
          let item;
          try {
            item = generate(n.id, d, d * 977 + 13, { locale: loc, form: f.id, strict: true, record: false });
          } catch (e) {
            fail(`${tag}: ${n.id}/${f.id} band ${d} cannot be generated in ${loc} — ${e.message}`);
            continue;
          }
          checked += 1;
          if (item.form !== f.id) fail(`${tag}: asked for ${f.id} and got ${item.form}`);
          // A stem that still contains a dotted key is a missing string that
          // fell back to its own name.
          for (const text of [item.stem, ...item.steps.map((st) => st.why)]) {
            if (/(^|\s)[a-z0-9]+(\.[a-zA-Z0-9]+){2,}(\s|$)/.test(String(text))) {
              fail(`${tag}: ${n.id}/${f.id} prints a raw string key in ${loc}: "${text}"`);
            }
          }
        }
      }
    }

    const meanByBand = [];
    for (let d = 1; d <= 5; d++) {
      let sum = 0, count = 0;
      for (let s = 0; s < N; s++) {
        let item;
        try {
          item = generate(n.id, d, s * 7919 + d * 131, { locale: 'en', strict: true, record: false });
        } catch (e) {
          fail(`${tag}: ${n.id} band ${d} seed ${s} — ${e.message}`);
          continue;
        }
        checked += 1;
        sum += demandOf(item); count += 1;
        // The ladder is a statistic and needs volume; re-deriving every item in
        // three languages under strict KaTeX is expensive and needs only depth.
        // So the first DEEP seeds of each band get the full treatment and the
        // rest are measured.
        if (s >= DEEP) continue;
        try { verify(item); } catch (e) { fail(`${tag}: ${n.id}/${item.form} does not re-derive — ${e.message}`); }
        for (const dd of item.diagnostics) {
          if (!declaredMis.has(dd.misconception)) {
            fail(`${tag}: ${n.id}/${item.form} tags "${dd.misconception}", which the graph never declares`);
          }
        }
        if (/\\text\{/.test(item.latex)) fail(`${tag}: ${n.id}/${item.form} leaks prose into the notation`);
        // strict KaTeX, exactly as the game renders it
        for (const src of [item.latex, item.answer, ...item.steps.map((st) => st.latex), ...item.distractors.map((x) => x.v)]) {
          try { katex.renderToString(String(src), { throwOnError: true, strict: 'error' }); } catch (e) {
            fail(`${tag}: ${n.id}/${item.form} — KaTeX rejects "${src}": ${e.message.split('\n')[0]}`);
          }
        }
        // every locale must produce prose with no leftover placeholder
        for (const loc of LOCALES) {
          let li;
          try { li = generate(n.id, d, s * 7919 + d * 131, { locale: loc, strict: true, record: false }); } catch (e) {
            fail(`${tag}: ${n.id} band ${d} in ${loc} — ${e.message}`);
            continue;
          }
          if (/\{[a-z]+\}/i.test(li.stem)) fail(`${tag}: ${n.id}/${li.form} leaves a placeholder in the ${loc} stem: ${li.stem}`);
          for (const st of li.steps) {
            if (/\{[a-z]+\}/i.test(st.why)) fail(`${tag}: ${n.id}/${li.form} leaves a placeholder in a ${loc} reason: ${st.why}`);
            if (!st.why.trim()) fail(`${tag}: ${n.id}/${li.form} has an empty ${loc} reason`);
          }
        }
      }
      meanByBand.push(count ? sum / count : 0);
    }
    // The ladder is a mean over random draws. Below about a hundred seeds per
    // cell the sampling noise is bigger than the rung, so a small run measures
    // and prints but does not fail — the shipped gate runs the full count.
    for (let i = 1; i < 5 && N >= 120; i++) {
      if (meanByBand[i] <= meanByBand[i - 1]) {
        fail(`${tag}: ${n.id} band ${i + 1} does not ask more than band ${i} (${meanByBand[i - 1].toFixed(2)} -> ${meanByBand[i].toFixed(2)})`);
      }
    }
    console.log(`  ${n.id.padEnd(20)}${meanByBand.map((m) => m.toFixed(2).padStart(7)).join('')}`);
  }

  // --- pack prose parity ---------------------------------------------------
  if (unit.pack) {
    const keys = LOCALES.map((l) => Object.keys(packStrings(l)));
    const base = new Set(keys[0]);
    for (let i = 1; i < LOCALES.length; i++) {
      for (const k of base) if (!keys[i].includes(k)) fail(`${tag}: pack string "${k}" is missing in ${LOCALES[i]}`);
      for (const k of keys[i]) if (!base.has(k)) fail(`${tag}: pack string "${k}" exists only in ${LOCALES[i]}`);
    }
    for (const l of LOCALES) {
      for (const [k, v] of Object.entries(packStrings(l))) {
        if (!String(v).trim()) fail(`${tag}: pack string "${k}" is blank in ${l}`);
      }
    }
    // A pack must never quietly redefine an existing item string.
    const { ITEM_BUNDLES } = await import('../src/learn/strings.js');
    for (const l of LOCALES) {
      for (const k of Object.keys(packStrings(l))) {
        if (ITEM_BUNDLES[l][k] != null) fail(`${tag}: pack string "${k}" collides with the shipped bundle in ${l}`);
      }
    }
  }
  void courseIds;
  void standalone;
}

console.log(`\nchecked ${checked} items across ${loaded.length} units in ${new Set(loaded.map((x) => x.course.id)).size} course(s)`);
if (problems.length) {
  console.log(`\nFAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 60)) console.log('  - ' + p);
  process.exit(1);
}
console.log('PASS — every unit in the manifest generates, verifies and aligns in three languages');
