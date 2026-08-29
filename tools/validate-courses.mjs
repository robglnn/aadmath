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
 *   · the difficulty ladder really rises, band 1 to band 5, per skill — and is
 *     a ladder rather than a flat floor or a wall (tools/critic/ladder.mjs);
 *   · EVERY OPTION A LEARNER IS SHOWN IS IN THE FORM THE BANK DEMANDS — a root
 *     with the largest square already out, a factorisation carried all the way
 *     (`simplestFaults`, `factorFaults` below);
 *   · the three locale bundles of every pack have identical key sets.
 *
 *   node tools/validate-courses.mjs [seeds]
 */
import katex from 'katex';
import { generate, demandOf, verify } from '../src/learn/generators.js';
import { hasSkill, formsFor, packStrings } from '../src/content/registry.js';
import { alignmentOf, practicesOf, alignmentNote, DEPTHS, coverage } from '../src/content/standards.js';
import { allUnits, loadUnit, standalone } from './_courses.mjs';
import { ladderFaults } from './critic/ladder.mjs';
import { findings } from './_findings.mjs';

/** Seeds per band, per skill. The difficulty ladder is a mean, so it needs volume. */
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 240);
/** How many of those seeds get re-derived, KaTeX-checked and read in three languages. */
const DEEP = 8;
const LOCALES = ['en', 'es', 'pl'];
const problems = [];
const fail = (m) => problems.push(m);
let checked = 0;

// ---------------------------------------------------------------------------
// THE FORM AN OPTION IS WRITTEN IN.
//
// Two families of defect that every other gate passed, because every other
// gate asks whether the mathematics is RIGHT and these options are wrong in a
// way that has nothing to do with their value.
//
//  1. `re-radical` and `re-surd` — the two forms in `rational-exponent` whose
//     whole subject is simplest form — offered `3\sqrt{9}`, which is secretly
//     the whole number nine, and `3\sqrt{12}`, which is `6\sqrt{3}`. A cadet
//     who simplifies every option finds one that stops being a root and picks
//     the odd one out. That is a shape cue, not mathematics, and it was in a
//     skill about the very thing being cued. Fifteen more forms across
//     `radical-simplify`, `radical-arith`, `complete-the-square`,
//     `square-root-method` and `quadratic-formula` did the same. Note that the
//     old hand-written guards tested `isWholeSquare` — "is what is left under
//     the bar a perfect square" — which catches `2\sqrt{4}` and lets
//     `3\sqrt{12}` through. Squarefree is the test; being a square is not.
//
//  2. `ds-factor` in the SHIPPED unit keyed `12y + 8` as `2\left(6y + 4\right)`
//     — a product, but not a factorisation — with a worked echo that read
//     "Pull the 2 out in front." CCSS A-SSE.3a and TEKS A.10(E) both say
//     factor completely, so the bank was teaching the habit of stopping early,
//     in three languages, in the unit a class would be given on Monday.
//
// Both rules read only what a learner is SHOWN: the key and the options. Both
// are proved against a planted defect and its honest twin on every run, at the
// bottom of this file — see `proveFormRules`.
// ---------------------------------------------------------------------------

/** Is `n` free of every square factor above one? */
export function squarefree(n) {
  const v = Math.abs(n);
  for (let p = 2; p * p <= v; p++) if (v % (p * p) === 0) return false;
  return v >= 1;
}

/**
 * Every plain whole-number radicand printed in `tex`, for SQUARE roots only.
 *
 * A root with a written index — `\sqrt[3]{8}` — is a different question with a
 * different notion of simplest, and this pattern steps over it by construction:
 * an index puts a `[` where the brace has to be, so the match fails there and
 * nowhere else in the same string.
 */
export function radicandsOf(tex) {
  return [...String(tex ?? '').matchAll(/\\sqrt\s*\{\s*(\d+)\s*\}/g)].map((m) => Number(m[1]));
}

/**
 * Options that are not written the way this bank writes an answer.
 * @param {{answer:string, distractors:{value:string}[]}} item
 */
export function simplestFaults(item) {
  const out = [];
  const shown = [
    { what: 'the key', v: item.answer },
    ...(item.distractors || []).map((dd) => ({ what: 'an option', v: dd.value })),
  ];
  for (const { what, v } of shown) {
    for (const rad of radicandsOf(v)) {
      if (squarefree(rad)) continue;
      out.push(`${what} is written "${v}", and ${rad} still holds a square — this bank writes every root with the largest square already out`);
    }
  }
  return out;
}

const gcdOf = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

/**
 * A key that is a plain product of brackets, split into its parts.
 * `4x\left(x + 3\right)\left(x - 3\right)` -> { lead: '4x', parts: [...] }.
 * `null` for anything that is not that shape — a sum, a fraction, a pair of
 * roots, a phrase — which is most of the bank and is not this rule's business.
 */
export function bracketFactors(tex) {
  const src = String(tex ?? '').trim();
  if (!src || /[=<>,]|\\text|\\frac|\\pm|\\sqrt|\\ldots|\\begin/.test(src)) return null;
  const close = (at) => {
    let depth = 0;
    for (let i = at; i < src.length; i++) {
      if (src.startsWith('\\left(', i)) { depth++; i += 5; continue; }
      if (src.startsWith('\\right)', i)) { depth--; if (!depth) return i; i += 6; continue; }
    }
    return -1;
  };
  const parts = [];
  let lead = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('\\left(', i)) {
      const j = close(i);
      if (j < 0) return null;
      parts.push(src.slice(i + 6, j));
      i = j + 7;
      const rep = /^\s*\^\{(\d+)\}/.exec(src.slice(i));
      if (rep) { for (let t = 1; t < Number(rep[1]); t++) parts.push(parts[parts.length - 1]); i += rep[0].length; }
      continue;
    }
    if (parts.length) return null;          // a term AFTER a bracket: this is a sum
    lead += src[i]; i++;
  }
  return parts.length ? { lead: lead.trim(), parts } : null;
}

/** Integer coefficients of one bracket, by power of `v`, or null if unreadable. */
export function intCoeffs(src, v) {
  const t = String(src).replace(/\\left|\\right|\\cdot|\s/g, '');
  if (!new RegExp(`^[-+0-9^{}${v}]*$`).test(t) || !t) return null;
  const out = {};
  for (const term of t.replace(/-/g, '+-').split('+').filter(Boolean)) {
    const m = new RegExp(`^(-?\\d*)${v}(?:\\^\\{(\\d+)\\})?$`).exec(term);
    if (m) {
      const c = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
      const p = m[2] ? Number(m[2]) : 1;
      out[p] = (out[p] || 0) + c;
      continue;
    }
    if (/^-?\d+$/.test(term)) { out[0] = (out[0] || 0) + Number(term); continue; }
    return null;
  }
  return Object.keys(out).length ? out : null;
}

/** Is a factorisation carried all the way? */
export function factorFaults(item) {
  const v = item.check?.variable || 'x';
  const f = bracketFactors(item.answer);
  if (!f) return [];
  const out = [];
  for (const part of f.parts) {
    const co = intCoeffs(part, v);
    if (!co) continue;
    const content = Object.values(co).reduce((g, c) => gcdOf(g, c), 0);
    if (content > 1) {
      out.push(`the key "${item.answer}" leaves a factor of ${content} inside \\left(${part}\\right); a factorisation is carried all the way or it teaches stopping early`);
    }
    // …and a bracket that is still a quadratic which comes apart over Z.
    const a = co[2] || 0, b = co[1] || 0, c = co[0] || 0;
    if (a) {
      const disc = b * b - 4 * a * c;
      const rt = Math.round(Math.sqrt(Math.max(0, disc)));
      if (disc >= 0 && rt * rt === disc) {
        out.push(`the key "${item.answer}" leaves \\left(${part}\\right), which still comes apart over the whole numbers`);
      }
    }
  }
  return out;
}

/**
 * A GATE NOBODY HAS WATCHED REFUSE ANYTHING IS NOT A GATE.
 *
 * Both rules above are pointed at the exact defect they exist to catch and at
 * the nearest honest content in the same bank, on every run, before the bank
 * is read at all. If a later edit makes either rule silent, or makes it fire
 * on honest content, this run stops here and says so.
 */
function proveFormRules() {
  const D = (answer, distractors = [], check = {}) => ({ answer, check, distractors: distractors.map((v) => ({ value: v })) });
  const bad = [];
  const fires = (got, why) => { if (!got.length) bad.push(`the rule stayed silent on ${why}`); };
  const quiet = (got, why) => { if (got.length) bad.push(`the rule fired on ${why}: ${got[0]}`); };

  // simplest form — the two real defects, and the honest twin of each.
  fires(simplestFaults(D('3\\sqrt{5}', ['3\\sqrt{9}'])), 'an option of 3\\sqrt{9}, which is the whole number nine');
  fires(simplestFaults(D('3\\sqrt{5}', ['3\\sqrt{12}'])), 'an option of 3\\sqrt{12}, which is 6\\sqrt{3}');
  fires(simplestFaults(D('2\\sqrt{8}')), 'a KEY that still holds a square');
  quiet(simplestFaults(D('\\sqrt[3]{8}', ['\\sqrt[3]{27}'])), 'cube roots, which this rule steps over');
  quiet(simplestFaults(D('2\\sqrt{5}', ['\\sqrt[3]{8} + \\sqrt{6}'])), 'an option that mixes a cube root with a square root in simplest form');
  fires(simplestFaults(D('2\\sqrt{5}', ['\\sqrt[3]{8} + \\sqrt{12}'])), 'the same shape with the SQUARE root left unfinished');
  quiet(simplestFaults(D('4\\sqrt{6}', ['16\\sqrt{6}', '6\\sqrt{15}', '\\sqrt{10}', '48'])), 'four options that are each as far in as they go');
  quiet(simplestFaults(D('n = 2 \\pm 2\\sqrt{5}', ['n = 2 \\pm \\sqrt{5}'])), 'a pair of roots written with the square out');

  // complete factorisation — the shipped defect, and the honest twin.
  fires(factorFaults(D('2\\left(6y + 4\\right)', [], { variable: 'y' })), '12y + 8 keyed as 2(6y + 4)');
  fires(factorFaults(D('\\left(2x + 4\\right)\\left(2x - 4\\right)', [], { variable: 'x' })), '4x^2 - 16 keyed as (2x + 4)(2x - 4)');
  fires(factorFaults(D('\\left(x^{2} - 9\\right)\\left(x + 1\\right)', [], { variable: 'x' })), 'a bracket that still comes apart');
  quiet(factorFaults(D('4\\left(3y + 2\\right)', [], { variable: 'y' })), 'the same 12y + 8, factored all the way');
  quiet(factorFaults(D('4x\\left(x + 3\\right)\\left(x - 3\\right)', [], { variable: 'x' })), 'a common factor and a difference of squares, both taken');
  quiet(factorFaults(D('\\left(2x + 5\\right)\\left(x + 9\\right)', [], { variable: 'x' })), 'a trinomial with a lead coefficient, factored');
  quiet(factorFaults(D('\\left(x + 3\\right)^{2}', [], { variable: 'x' })), 'a perfect square');
  quiet(factorFaults(D('x = -6, x = -2', [], { variable: 'x' })), 'a pair of roots, which is not a product at all');
  quiet(factorFaults(D('3z^{2} + z + 12', [], { variable: 'z' })), 'a plain sum');

  if (bad.length) {
    console.error('the form rules cannot prove themselves:');
    for (const b of bad) console.error(`  - ${b}`);
    process.exit(2);
  }
  console.log('form rules: proved on the planted defect and quiet on its honest twin (19 cases)');
}
proveFormRules();

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
        // …AND THE FORM THE KEY AND THE OPTIONS ARE WRITTEN IN, on every seed
        // rather than on the first DEEP of them. See the block above
        // `allUnits`: strict KaTeX proves a string renders, and these two rules
        // prove it is the string this bank should be printing. They are a regex
        // and a little integer arithmetic, so they cost what `demandOf` costs
        // and can afford the whole sample — which matters, because the defects
        // they catch are rare draws: one `factor-common` seed in about 250 left
        // a difference of two squares inside the bracket.
        for (const p of simplestFaults(item)) fail(`${tag}: ${n.id}/${item.form} d${d} seed ${s} — ${p}`);
        for (const p of factorFaults(item)) fail(`${tag}: ${n.id}/${item.form} d${d} seed ${s} — ${p}`);
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
        /* strict KaTeX, exactly as the game renders it.
           `x.v` is what a form WRITES; `x.value` is what `finalize` hands the
           learner. Reading the raw name off a finished item gave `undefined`
           for every distractor, and `String(undefined)` is nine letters that
           KaTeX renders without complaint — so this loop listed the options a
           learner is shown and checked none of them, on every unit past Level
           1, which is 42% of the notation strings it claims to cover. */
        for (const src of [item.latex, item.answer, ...item.steps.map((st) => st.latex), ...item.distractors.map((x) => x.value)]) {
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
    /* THE LADDER.
       Four rules, not one — see tools/critic/ladder.mjs for where each number
       comes from and for the self-test that fires every one of them on the real
       defect and keeps every one of them quiet on the nearest honest skill.
       This file used to ask only "does each band ask more than the one under
       it", which certified `system-substitution` (five bands spanning 0.99) and
       `exponent-power` (68% of the whole climb at one boundary).
       The ladder is a mean over random draws; below about a hundred seeds per
       cell the sampling noise is bigger than a rung, so a small run measures and
       prints but does not fail. The shipped gate runs the full count. */
    const faults = ladderFaults(meanByBand, { seeds: N });
    for (const f of faults) fail(`${tag}: ${n.id} ${f.text}`);
    const flag = faults.length ? `  <- ${[...new Set(faults.map((f) => f.rule))].join(', ')}` : '';
    console.log(`  ${n.id.padEnd(20)}${meanByBand.map((m) => m.toFixed(2).padStart(7)).join('')}${flag}`);
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
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 60)) console.log('  - ' + p);
} else {
  console.log('every unit in the manifest generates, verifies and aligns in three languages');
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This is the only gate
   over the WHOLE course, and it has always been strict about every unit: a
   generator that will not generate, or a ladder that does not climb, is a
   defect wherever it is. The ledger is a floor on severity and never a
   ceiling, so the strictness stands and what the ledger adds is that the
   route half cannot be printed under a zero exit code. */
findings('check:courses', { scope: 'sweep' }).route(problems.map(String)).done();
