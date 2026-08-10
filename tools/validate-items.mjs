/**
 * Content gate.
 *
 * Nothing ships that this file cannot prove. It checks, for every generator,
 * every item form, every difficulty band, many seeds and all three locales:
 *
 *   · strict KaTeX accepts the prompt, every worked line, the answer and every
 *     distractor — the same strict settings the running game uses;
 *   · the answer survives an *independent* re-derivation: the displayed LaTeX is
 *     parsed and evaluated or solved from scratch in exact rational arithmetic;
 *   · every line of every worked solution is true — chained equalities really
 *     are equal, and each equation in a solve has the same solution set as the
 *     one above it;
 *   · no distractor is mathematically equal (not merely textually equal) to the
 *     answer, and every distractor is tagged with a misconception that the
 *     knowledge graph actually declares;
 *   · prose and notation stay separated: no language leaks into item.latex, and
 *     no interpolation placeholder survives into a learner-visible string;
 *   · the three locale bundles have identical key sets, no blanks, and no
 *     untranslated copies;
 *   · the knowledge graph is a DAG whose nodes match the generators exactly,
 *     whose standards all exist in the CCSS mapping file and vice versa, and
 *     whose declared representations its item forms can actually produce.
 */
import katex from 'katex';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, SKILLS, FORMS_BY_SKILL, verify, demandOf, literalsOf } from '../src/learn/generators.js';
import { ITEM_BUNDLES, ITEM_LOCALES } from '../src/learn/strings.js';
import { fromString, eq as req } from '../src/learn/rational.js';
import { equivalent, solveLinear } from '../src/learn/parser.js';
import { diagnose } from '../src/learn/diagnose.js';
import { analogueFor } from '../src/learn/scaffold.js';
import { echoScript, ladderOf, ladderNotation } from '../src/learn/echo.js';
import enUI from '../src/i18n/en.js';
import esUI from '../src/i18n/es.js';
import plUI from '../src/i18n/pl.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(await readFile(path.join(ROOT, 'content/graph/algebra1-l1.json'), 'utf8'));
const ccss = JSON.parse(await readFile(path.join(ROOT, 'content/standards/ccss-algebra1-l1.json'), 'utf8'));

const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 24);
const problems = [];
let checked = 0;
const fail = (m) => problems.push(m);

// ---------------------------------------------------------------------------
// 1. knowledge graph
// ---------------------------------------------------------------------------
const nodeIds = graph.nodes.map((n) => n.id);
if (new Set(nodeIds).size !== nodeIds.length) fail('graph: duplicate node ids');
for (const extra of SKILLS.filter((s) => !nodeIds.includes(s))) fail(`graph: generator "${extra}" has no node`);
for (const missing of nodeIds.filter((id) => !SKILLS.includes(id))) fail(`graph: node "${missing}" has no generator`);

const declared = new Map();
for (const n of graph.nodes) {
  for (const p of n.prereqs) if (!nodeIds.includes(p)) fail(`graph: ${n.id} requires unknown "${p}"`);
  if (!n.bigIdea) fail(`graph: ${n.id} has no big idea`);
  if (!n.standardsNote) fail(`graph: ${n.id} has no standards mapping note`);
  if (!Array.isArray(n.standards) || !n.standards.length) fail(`graph: ${n.id} cites no standards`);
  for (const st of n.standards || []) {
    if (!st.code || !st.text) fail(`graph: ${n.id} cites a standard with no code or no text`);
  }
  if (!Array.isArray(n.practices) || !n.practices.length) fail(`graph: ${n.id} cites no practice standards`);
  const ids = new Set([...(n.misconceptions || []).map((m) => m.id), ...(graph.commonMisconceptions || []).map((m) => m.id)]);
  declared.set(n.id, ids);
  for (const m of n.misconceptions || []) if (!m.text) fail(`graph: ${n.id}/${m.id} has no description`);
  const reps = new Set((FORMS_BY_SKILL[n.id] || []).map((f) => f.rep));
  for (const r of n.requiredReps || []) {
    if (!reps.has(r)) fail(`graph: ${n.id} requires representation "${r}" that no item form produces`);
  }
  if (reps.size < 4) fail(`graph: ${n.id} offers only ${reps.size} representation(s); at least 4 required`);
  if ((FORMS_BY_SKILL[n.id] || []).length < 5) fail(`graph: ${n.id} has fewer than 5 item forms`);
  // Every band from 3 up must offer more than one form, or the "unseen form"
  // requirement of the proving run has nothing to draw on.
  for (let d = 3; d <= 5; d++) {
    const at = (FORMS_BY_SKILL[n.id] || []).filter((f) => d >= f.dMin && d <= f.dMax);
    if (at.length < 3) fail(`graph: ${n.id} has only ${at.length} form(s) eligible at band ${d}`);
    if (!at.some((f) => f.rep !== 'symbolic')) fail(`graph: ${n.id} has no non-symbolic form at band ${d}`);
  }
}
// acyclicity
(() => {
  const seen = new Map();
  const walk = (id, stack) => {
    if (stack.has(id)) { fail(`graph: cycle through ${id}`); return; }
    if (seen.get(id)) return;
    seen.set(id, true);
    stack.add(id);
    for (const p of graph.nodes.find((n) => n.id === id).prereqs) walk(p, stack);
    stack.delete(id);
  };
  for (const id of nodeIds) walk(id, new Set());
})();

// ---------------------------------------------------------------------------
// 2. standards alignment must be complete in both directions
// ---------------------------------------------------------------------------
const mapCodes = new Set(ccss.standards.map((s) => s.code));
const graphCodes = new Set(graph.nodes.flatMap((n) => n.standards.map((s) => s.code)));
for (const c of graphCodes) if (!mapCodes.has(c)) fail(`standards: ${c} is cited by the graph but missing from the mapping note`);
for (const c of mapCodes) if (!graphCodes.has(c)) fail(`standards: ${c} is in the mapping note but no node claims it`);
for (const s of ccss.standards) {
  if (!s.text || s.text.length < 40) fail(`standards: ${s.code} has no usable statement text`);
  if (!['core', 'supporting', 'introduced'].includes(s.depth)) fail(`standards: ${s.code} has no coverage depth`);
  for (const n of s.nodes || []) if (!nodeIds.includes(n)) fail(`standards: ${s.code} names unknown node ${n}`);
  const allForms = new Set(Object.values(FORMS_BY_SKILL).flat().map((f) => f.id));
  for (const e of s.evidence || []) {
    if (!allForms.has(e)) { fail(`standards: ${s.code} cites unknown item form ${e}`); continue; }
    const owner = SKILLS.find((sk) => FORMS_BY_SKILL[sk].some((f) => f.id === e));
    if (!(s.nodes || []).includes(owner)) {
      fail(`standards: ${s.code} cites ${e}, which belongs to "${owner}" — a skill this standard does not claim`);
    }
  }
  if (!(s.evidence || []).length) fail(`standards: ${s.code} cites no item forms as evidence`);
}
// Alignment has to be complete downwards as well: an item form that no standard
// claims as evidence is content nobody has justified shipping.
{
  const cited = new Set(ccss.standards.flatMap((s) => s.evidence || []));
  for (const skill of SKILLS) {
    for (const f of FORMS_BY_SKILL[skill]) {
      if (!cited.has(f.id)) fail(`standards: item form ${skill}/${f.id} is evidence for no standard`);
    }
  }
}
if (!Array.isArray(ccss.mappingNote) || ccss.mappingNote.length < 3) fail('standards: mapping note is too thin');
if (!Array.isArray(ccss.practices) || ccss.practices.length < 5) fail('standards: mathematical practices are not mapped');
const practiceCodes = new Set(ccss.practices.map((p) => p.code));
for (const n of graph.nodes) for (const p of n.practices || []) {
  if (!practiceCodes.has(p)) fail(`standards: ${n.id} cites practice ${p} that the mapping note does not define`);
}

// ---------------------------------------------------------------------------
// 3. locale bundles
// ---------------------------------------------------------------------------
const enKeys = Object.keys(ITEM_BUNDLES.en).sort();
for (const loc of ITEM_LOCALES) {
  const keys = Object.keys(ITEM_BUNDLES[loc]).sort();
  for (const k of enKeys) if (!keys.includes(k)) fail(`i18n: ${loc} is missing "${k}"`);
  for (const k of keys) if (!enKeys.includes(k)) fail(`i18n: ${loc} has stray key "${k}"`);
  for (const [k, v] of Object.entries(ITEM_BUNDLES[loc])) {
    if (typeof v !== 'string' || !v.trim()) fail(`i18n: ${loc}/${k} is empty`);
    if (/\{\s*\}/.test(v)) fail(`i18n: ${loc}/${k} has an empty placeholder`);
    if (loc !== 'en' && v === ITEM_BUNDLES.en[k] && v.replace(/\{\w+\}/g, '').trim().length > 12) {
      fail(`i18n: ${loc}/${k} is still the English string`);
    }
    const slots = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
    if (slots(v) !== slots(ITEM_BUNDLES.en[k] || '')) fail(`i18n: ${loc}/${k} placeholders differ from English`);
  }
}

// ---------------------------------------------------------------------------
// 4. the items themselves
// ---------------------------------------------------------------------------
const K = (src, label, where, display) => {
  try {
    katex.renderToString(src, { throwOnError: true, strict: 'error', displayMode: !!display, trust: false });
  } catch (e) {
    fail(`${where}: KaTeX rejected ${label} :: ${src} :: ${e.message.split('\n')[0]}`);
  }
};

const repsSeen = {};
for (const locale of ITEM_LOCALES) {
  for (const skill of SKILLS) {
    repsSeen[skill] ||= new Set();
    for (const form of FORMS_BY_SKILL[skill]) {
      for (let d = form.dMin; d <= form.dMax; d++) {
        for (let i = 0; i < N; i++) {
          const seed = (skill.length * 1000003 + d * 7919 + i * 104729 + locale.charCodeAt(0) * 31) >>> 0;
          let item;
          try {
            item = generate(skill, d, seed, { form: form.id, locale, strict: true });
          } catch (e) {
            fail(`${locale}/${skill}/${form.id}/d${d}/#${i}: ${e.message}`);
            continue;
          }
          checked++;
          repsSeen[skill].add(item.rep);
          const where = `${locale}/${skill}/${item.form}/d${d}/seed${item.seed}`;

          if (item.form !== form.id) fail(`${where}: generator ignored the requested form`);
          for (const bad of ['NaN', 'undefined', 'Infinity']) {
            if (item.latex.includes(bad)) fail(`${where}: prompt contains ${bad}`);
            if (item.answer.includes(bad)) fail(`${where}: answer contains ${bad}`);
            if (item.stem.includes(bad)) fail(`${where}: stem contains ${bad}`);
          }
          if (item.latex.includes('\\text{')) fail(`${where}: prose leaked into the notation`);
          // A control sequence that lost its backslash is still valid LaTeX —
          // "2left(7x + 5ight)" renders without complaint — so KaTeX cannot
          // catch it and this has to.
          for (const src of [item.latex, item.answer, ...item.steps.map((s) => s.latex)]) {
            if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(src)) fail(`${where}: control character in notation :: ${JSON.stringify(src)}`);
            if (/(?<![\\a-zA-Z])(?:left|right|cdot|frac|Rightarrow|begin|end|hline|sqrt)(?![a-zA-Z])/.test(src)) {
              fail(`${where}: a control sequence lost its backslash :: ${src}`);
            }
          }
          if (/\{[a-z]\w*\}/.test(item.stem)) fail(`${where}: stem has an unsubstituted placeholder :: ${item.stem}`);
          // A generator that can put "1" into a counted-noun slot writes
          // "1 counterweights" in English and worse in Polish. Catch it here
          // rather than in a screenshot.
          if (locale === 'en' && /(^|\s)1\s+[a-z]+s(\s|[.,?])/.test(item.stem)) {
            fail(`${where}: stem reads a singular quantity as a plural :: ${item.stem}`);
          }
          if (item.rep !== 'symbolic' && !item.stem) fail(`${where}: ${item.rep} item has no situation text`);

          // Prose carries inline mathematics between dollar signs — the letter
          // a situation talks about renders in the same italic as the letter in
          // the notation below it, instead of in the UI's sans. Those spans go
          // through the same strict KaTeX as the notation, so a broken one
          // fails the build rather than silently degrading to escaped text.
          for (const [label, prose] of [['stem', item.stem], ...item.steps.map((s, k) => [`why${k}`, s.why])]) {
            const parts = String(prose || '').split('$');
            if (parts.length % 2 === 0) fail(`${where}: unbalanced inline-maths delimiter in ${label} :: ${prose}`);
            for (let p = 1; p < parts.length; p += 2) K(parts[p], `inline maths in ${label}`, where, false);
          }

          K(item.latex, 'prompt', where, true);
          K(item.answer, 'answer', where, false);
          item.steps.forEach((s, k) => K(s.latex, `step${k}`, where, true));
          for (const dd of item.distractors) K(dd.value, `distractor ${dd.value}`, where, false);

          // independent re-derivation, a second time and from a clean slate
          try { verify(item); } catch (e) { fail(`${where}: verification failed :: ${e.message}`); }

          if (item.type === 'numeric' && !/^-?\d+(\/\d+)?$/.test(item.answer)) {
            fail(`${where}: non-exact numeric answer "${item.answer}"`);
          }
          if (!item.steps.length) fail(`${where}: no worked steps`);
          for (const s of item.steps) if (!s.why || !s.why.trim()) fail(`${where}: worked line with no reason`);
          // The echo fades a derivation one rung at a time (see learn/echo.js).
          // A derivation with fewer than two moves cannot be faded — layers
          // three and four would render the same thing — and a line that
          // repeats the one above it spends a rung on nothing.
          if (item.steps.length < 2) fail(`${where}: a single-move derivation cannot be faded into an echo ladder`);
          for (let s = 1; s < item.steps.length; s++) {
            const a = item.steps[s - 1].latex.replace(/\s+/g, '');
            const b = item.steps[s].latex.replace(/\s+/g, '');
            if (a === b) fail(`${where}: worked line ${s} repeats the line above it :: ${b}`);
          }
          if (item.distractors.length !== 3) fail(`${where}: ${item.distractors.length} distractors, expected 3`);

          const values = new Set();
          for (const dd of item.distractors) {
            if (values.has(dd.value)) fail(`${where}: duplicate distractor ${dd.value}`);
            values.add(dd.value);
            if (dd.value === item.answer) fail(`${where}: distractor equals answer (${dd.value})`);
            if (!dd.misconception) fail(`${where}: untagged distractor ${dd.value}`);
            else if (!declared.get(skill).has(dd.misconception)) {
              fail(`${where}: distractor tagged "${dd.misconception}", which ${skill} does not declare`);
            }
            if (item.type === 'numeric') {
              const a = fromString(dd.value), b = fromString(item.answer);
              if (a && b && req(a, b)) fail(`${where}: distractor ${dd.value} is numerically the answer`);
            }
            if (item.type === 'expression' && item.check.kind === 'equivalent') {
              let same = false;
              try { same = equivalent(dd.value, item.answer, item.check.variable); } catch { same = false; }
              if (same) fail(`${where}: distractor ${dd.value} is equivalent to the answer`);
            }
            if (item.check.kind === 'equationChoice') {
              let s2 = null;
              try { s2 = solveLinear(dd.value, item.check.variable); } catch { s2 = null; }
              if (s2 && s2.kind === 'unique' && String(s2.value.n / s2.value.d) === item.check.expect) {
                fail(`${where}: distractor equation has the right solution`);
              }
            }
          }

          if (item.figure) {
            const f = item.figure;
            if (!['line', 'lines', 'balance', 'area', 'rect'].includes(f.kind)) fail(`${where}: unknown figure kind ${f.kind}`);
            const span = f.range || 7;
            for (const [x, y] of f.points || []) {
              if (!Number.isFinite(x) || !Number.isFinite(y)) fail(`${where}: figure has a non-finite point`);
              if (Math.abs(x) > span || Math.abs(y) > span) fail(`${where}: figure point (${x}, ${y}) falls off the chart`);
            }
          }
        }
      }
    }
  }
}

for (const skill of SKILLS) {
  const node = graph.nodes.find((n) => n.id === skill);
  for (const r of node.requiredReps || []) {
    if (!repsSeen[skill].has(r)) fail(`coverage: ${skill} never produced a "${r}" item`);
  }
}

// ---------------------------------------------------------------------------
// 5. The difficulty ladder is measured, not asserted.
//
// "Band 4" is a claim about how much an item asks of a learner. If band 3, 4
// and 5 all produce the same thing, then the mastery gate — which is served at
// band 4 — proves less than it says it does. So the bank is scored and the
// build fails unless mean demand rises strictly, within every skill.
// ---------------------------------------------------------------------------
const LADDER_N = Number(process.env.LADDER_SAMPLES || 400);
const LADDER_MARGIN = 0.15;
const ladder = {};
for (const skill of SKILLS) {
  ladder[skill] = [];
  for (let d = 1; d <= 5; d++) {
    let sum = 0, n = 0;
    for (let i = 0; i < LADDER_N; i++) {
      try { sum += demandOf(generate(skill, d, (i * 104729 + d * 7919 + skill.length * 37) >>> 0)); n++; } catch { /* skip */ }
    }
    if (!n) { fail(`ladder: ${skill} produced no items at band ${d}`); ladder[skill][d - 1] = 0; continue; }
    ladder[skill][d - 1] = sum / n;
  }
  for (let d = 1; d < 5; d++) {
    const a = ladder[skill][d - 1], b = ladder[skill][d];
    if (!(b > a + LADDER_MARGIN)) {
      fail(`ladder: ${skill} band ${d + 1} (${b.toFixed(2)}) is not meaningfully harder than band ${d} (${a.toFixed(2)})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Diagnosis is honest.
//
// The rig tells a learner things about their own thinking. It may only do that
// on evidence. These checks are the guard rail: an entry the bank cannot
// explain must come back as `null`, and every tag the bank *can* produce must
// have a line to say in all three languages.
// ---------------------------------------------------------------------------
const MIS_UI = { en: enUI.rift.mis, es: esUI.rift.mis, pl: plUI.rift.mis };
const producible = new Set();
const OFF_LIST = ['9999', '-9999', '123456', '0', '4242', '77777', '1000000'];
let offListChecked = 0, offListNamed = 0;

for (const skill of SKILLS) {
  for (const form of FORMS_BY_SKILL[skill]) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let i = 0; i < 8; i++) {
        let item;
        try { item = generate(skill, d, (i * 7907 + d * 104729 + skill.length * 13) >>> 0, { form: form.id, strict: true }); }
        catch { continue; }

        const diags = item.diagnostics || [];
        const closed = item.type === 'special' || item.check.kind === 'equationChoice';
        if (diags.length < (closed ? 3 : 5)) {
          fail(`diagnose: ${skill}/${form.id}/d${d} carries only ${diags.length} recognisable errors`);
        }
        for (const dd of diags) {
          producible.add(dd.misconception);
          if (!declared.get(skill).has(dd.misconception)) {
            fail(`diagnose: ${skill}/${form.id} tags "${dd.misconception}", which ${skill} does not declare`);
          }
          // every tagged wrong value must actually be diagnosed as itself
          const got = diagnose(item, dd.value);
          if (!got) fail(`diagnose: ${skill}/${form.id} cannot recognise its own tagged error ${dd.value}`);
        }
        // ...and the answer must never be mistaken for an error
        if (diagnose(item, item.answer) && item.type === 'numeric') {
          fail(`diagnose: ${skill}/${form.id} diagnoses the correct answer as a misconception`);
        }
        // A response the item cannot explain must not be given a name.
        for (const junk of OFF_LIST) {
          if (item.type !== 'numeric') continue;
          if ((item.diagnostics || []).some((dd) => dd.value === junk)) continue;
          const a = fromString(item.answer);
          const j = fromString(junk);
          if (a && j && Math.abs(j.n / j.d - a.n / a.d) <= 2) continue;  // a real arithmetic slip
          offListChecked++;
          const named = diagnose(item, junk);
          if (named) {
            offListNamed++;
            fail(`diagnose: ${skill}/${form.id} invents "${named}" for the off-list response ${junk}`);
          }
        }

        if (form.distinctNums) {
          const lits = literalsOf(String(item.latex).replace(/\^\s*\{?-?\d+\}?/g, ''));
          if (new Set(lits).size !== lits.length) {
            fail(`provenance: ${skill}/${form.id}/d${d} repeats a number in a worked-example-critical prompt`);
          }
        }
      }
    }
  }
}
for (const tag of producible) {
  for (const loc of ITEM_LOCALES) {
    if (!MIS_UI[loc] || !MIS_UI[loc][tag]) fail(`i18n: misconception "${tag}" has no line in ${loc}`);
  }
}
for (const n of graph.nodes) {
  for (const m of n.misconceptions || []) {
    if (!producible.has(m.id)) fail(`graph: ${n.id} declares misconception "${m.id}" that no item form can produce`);
  }
}

// ---------------------------------------------------------------------------
// 7. A worked example must not be an answer key.
//
// The faded analogue appears exactly when the learner is weakest, which is when
// copying is cheapest. If the live answer is legible anywhere on the example —
// its prompt, its own answer, or any of its worked lines — the scaffold has
// stopped teaching and started leaking.
// ---------------------------------------------------------------------------
let pairs = 0, leaked = 0, missing = 0;
for (const skill of SKILLS) {
  for (let d = 1; d <= 5; d++) {
    for (let i = 0; i < 12; i++) {
      let item;
      try { item = generate(skill, d, (i * 2654435761 + d * 40503) >>> 0); } catch { continue; }
      const ex = analogueFor(item, { difficulty: d, seed: item.seed });
      pairs++;
      if (!ex) { missing++; continue; }
      if (ex.answer === item.answer) { leaked++; fail(`scaffold: ${skill}/d${d} analogue shares the live answer`); continue; }
      // Exponents are notation, not copyable values: the 2 in x^{2} is not an answer.
      const vals = (t) => (String(t).replace(/\^\s*\{?-?\d+\}?/g, '').match(/\d+/g) || []);
      const live = new Set(vals(item.answer));
      const shown = [ex.latex, ex.answer, ...ex.steps.map((s) => s.latex)].join(' ');
      let bad = false;
      for (const nmb of vals(shown)) {
        if (live.has(nmb)) { leaked++; fail(`scaffold: ${skill}/d${d} analogue shows the live answer "${nmb}"`); bad = true; break; }
      }
      if (bad) continue;
      // and the example's own answer must not already be visible in the live prompt
      const onScreen = new Set(vals(item.latex));
      for (const nmb of vals(ex.answer)) {
        if (onScreen.has(nmb)) { leaked++; fail(`scaffold: ${skill}/d${d} analogue is sealed at "${nmb}", a value already on the live prompt`); break; }
      }
    }
  }
}
if (missing / Math.max(1, pairs) > 0.02) fail(`scaffold: no clean analogue found for ${missing}/${pairs} items`);

// ---------------------------------------------------------------------------
// 8. The echo actually fades.
//
// The echo is the whole of the "explicit instruction, invisibly delivered"
// claim, and it is a ladder: whisper, first move, the shape, whole trace. A
// ladder whose rungs render the same thing is a dead control — the learner
// presses for more help and receives, byte for byte, what they already had.
// So every depth is built for real items and the four are compared as strings.
//
// The same pass re-checks the leak rule against what is *rendered* rather than
// against what the analogue contains: no digit of the live answer may appear in
// any notation the ladder puts on screen, at any depth.
// ---------------------------------------------------------------------------
const norm = (t) => String(t).replace(/\s+/g, '');
let typographyAnglo = 0;
let ladders = 0, flat = 0, thin = 0, leakyEcho = 0;
for (const skill of SKILLS) {
  for (const form of FORMS_BY_SKILL[skill]) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let i = 0; i < 6; i++) {
        let item;
        try { item = generate(skill, d, (i * 15485863 + d * 6151 + skill.length * 97) >>> 0, { form: form.id, strict: true }); }
        catch { continue; }
        const ex = analogueFor(item, { difficulty: d, seed: item.seed });
        const entry = (item.diagnostics || [])[0]?.value ?? null;
        const rungs = ladderOf(item, ex, entry);
        ladders++;
        if (new Set(rungs).size !== rungs.length) {
          flat++;
          fail(`echo: ${skill}/${form.id}/d${d} renders two identical layers — the ladder does not fade`);
        }
        // Layer one must carry notation, not only a sentence about the learner.
        //
        // And it must carry notation that *moves*. Re-printing the prompt with
        // "this is what the rift is asking" satisfies the letter of the rule
        // and none of its point: the cadet pressed for help and was handed
        // back the question. That is the one failure this whole module exists
        // to prevent, so every tagged wrong entry the item can produce is put
        // through layer one and the restatement is counted as a miss.
        for (const dg of (item.diagnostics || []).slice(0, 3)) {
          const first = echoScript({ item, analogue: ex, entry: dg.value, tier: 1 }).rows;
          const math = first.filter((r) => r.latex);
          if (!math.length) {
            thin++;
            fail(`echo: ${skill}/${form.id}/d${d} answers a slip with no mathematics at all`);
            continue;
          }
          const restates = math.length === 1
            && norm(math[0].latex) === norm(item.latex)
            && math[0].why === ITEM_BUNDLES.en['echo.theTear'];
          if (restates) {
            thin++;
            fail(`echo: ${skill}/${form.id}/d${d} answers "${dg.value}" by restating the prompt`);
          }
        }
        const digits = (s) => (String(s).replace(/\^\s*\{?-?\d+\}?/g, '').match(/\d+/g) || []);
        const live = new Set(digits(item.answer));
        for (const nmb of digits(ladderNotation(item, ex, entry).join(' '))) {
          if (live.has(nmb)) {
            leakyEcho++;
            fail(`echo: ${skill}/${form.id}/d${d} prints the live answer "${nmb}" inside the trace`);
            break;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 9. A choice item must be answerable only by doing the mathematics.
//
// Where the surface narrows to a set of readings, the cheapest strategy in the
// room is a surface strategy: pick the one whose shape echoes the prompt, or
// the odd one out, or the longest. Every one of those is measured here across
// the whole bank, and each is allowed no more than a whisker over the 1-in-4
// baseline. A distractor set that lets a test-wise learner past without
// algebra inflates mastery on a skill everything downstream is gated behind.
// ---------------------------------------------------------------------------
const opSig = (s) => {
  const t = String(s).replace(/\\left|\\right|\\;|\\,|\\square|\s+/g, '');
  const ops = [];
  if (/\\frac|\//.test(t)) ops.push('/');
  if (/\+/.test(t)) ops.push('+');
  if (/(?!^)-/.test(t.slice(1))) ops.push('-');
  if (/\\cdot|\\times/.test(t)) ops.push('*');
  return ops.sort().join('') || '.';
};
const STRATS = {
  'echoes the prompt': (opts, prompt) => {
    const want = opSig(prompt);
    const hit = opts.filter((o) => opSig(o.v) === want);
    return hit.length === 1 ? hit[0] : null;
  },
  'odd one out': (opts) => {
    const counts = {};
    for (const o of opts) counts[opSig(o.v)] = (counts[opSig(o.v)] || 0) + 1;
    const uniq = opts.filter((o) => counts[opSig(o.v)] === 1);
    return uniq.length === 1 ? uniq[0] : null;
  },
  'the longest': (opts) => {
    const max = Math.max(...opts.map((o) => o.v.length));
    const hit = opts.filter((o) => o.v.length === max);
    return hit.length === 1 ? hit[0] : null;
  },
  'the shortest': (opts) => {
    const min = Math.min(...opts.map((o) => o.v.length));
    const hit = opts.filter((o) => o.v.length === min);
    return hit.length === 1 ? hit[0] : null;
  },
};
const strat = Object.fromEntries(Object.keys(STRATS).map((k) => [k, { decisive: 0, right: 0 }]));
let choiceItems = 0;
for (const skill of SKILLS) {
  for (const form of FORMS_BY_SKILL[skill]) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let i = 0; i < 12; i++) {
        let item;
        try { item = generate(skill, d, (i * 22695477 + d * 2749 + skill.length * 61) >>> 0, { form: form.id, strict: true }); }
        catch { continue; }
        // Every item in the bank can end up as a set of readings: the "which
        // reading?" forms start that way, and the keypad narrows to the same
        // four after two honest attempts. So the audit covers all of them.
        if (item.type === 'special') continue;
        choiceItems++;
        const opts = [{ v: String(item.answer), key: true }, ...item.distractors.map((dd) => ({ v: String(dd.value), key: false }))];
        for (const [name, fn] of Object.entries(STRATS)) {
          const picked = fn(opts, item.latex);
          if (!picked) continue;
          strat[name].decisive++;
          if (picked.key) strat[name].right++;
        }
      }
    }
  }
}
// The bar used to be 0.5, which is not a bar: a strategy that involves no
// algebra and wins half the time has doubled the 1-in-4 baseline and the gate
// still passes. It is now a whisker over the baseline itself, because that is
// the actual claim — "answerable only by doing the mathematics".
const SURFACE_MAX = 0.32;
for (const [name, s] of Object.entries(strat)) {
  if (s.decisive < 20) continue;
  const rate = s.right / s.decisive;
  if (rate > SURFACE_MAX) {
    fail(`surface: "${name}" picks the correct reading ${(rate * 100).toFixed(1)}% of the time `
      + `(${s.right}/${s.decisive}) — above the ${(SURFACE_MAX * 100).toFixed(0)}% ceiling: the item can be answered without algebra`);
  }
}


// ---------------------------------------------------------------------------
// 9b. Mathematical typography, per locale.
//
// The brief forbids unicode maths glyphs standing in for real notation, and
// nothing until now measured it: a "−" pasted into a stem, a "×" in a Polish
// reason line or a "½" in an answer all render, all look almost right, and all
// break the moment the surrounding notation is set in KaTeX's metrics beside
// them. They are also the exact things a translator adds without thinking.
//
// The operator set is checked from the other side too. `\cdot` and `\frac`
// carry the same meaning and the same shape in English, Spanish and Polish
// classrooms, so notation can stay identical across the three locales and
// remain correct in all of them. `\times` and `\div` do not: Poland writes
// division with a colon and multiplication with a dot, and a bank that emitted
// either would owe every locale its own rendering. Keeping them out of the
// generators is what makes "one notation, three languages" an honest claim
// rather than an Anglophone default, so the gate holds the line.
// ---------------------------------------------------------------------------
{
  const GLYPHS = /[\u2212\u00d7\u00f7\u2260\u2264\u2265\u22c5\u00b7\u221a\u221e\u00bd\u00bc\u00be\u00b2\u00b3\u03c0\u2219\u2022\u00b1\u2264]/;
  for (const loc of ITEM_LOCALES) {
    for (const [k, v] of Object.entries(ITEM_BUNDLES[loc])) {
      const m = GLYPHS.exec(v);
      if (m) fail(`typography: ${loc}/${k} uses the unicode glyph "${m[0]}" where the notation belongs`);
    }
  }
  let anglo = 0;
  for (const skill of SKILLS) {
    for (const form of FORMS_BY_SKILL[skill]) {
      for (let d = form.dMin; d <= form.dMax; d++) {
        let item;
        try { item = generate(skill, d, (d * 7919 + skill.length * 31) >>> 0, { form: form.id }); } catch { continue; }
        const shown = [item.latex, item.answer, ...item.steps.map((x) => x.latex), ...item.distractors.map((x) => x.value)].join(' ');
        if (GLYPHS.test(shown)) fail(`typography: ${skill}/${form.id}/d${d} puts a unicode maths glyph in the notation`);
        if (/\\times|\\div/.test(shown)) {
          anglo++;
          fail(`typography: ${skill}/${form.id}/d${d} uses an operator that is not written the same way in all three locales`);
        }
        // Prose may carry inline notation, but never bare notation loose in a
        // sentence: a stray backslash command outside $…$ reaches the learner
        // as literal LaTeX in whichever language they are reading.
        for (const prose of [item.stem, ...item.steps.map((x) => x.why)]) {
          const outside = String(prose || '').split('$').filter((_, i) => i % 2 === 0).join(' ');
          if (/\\[a-zA-Z]+/.test(outside)) fail(`typography: ${skill}/${form.id}/d${d} leaks a LaTeX command into prose :: ${prose}`);
        }
      }
    }
  }
  typographyAnglo = anglo;
}

// ---------------------------------------------------------------------------
// 10. The standards map document is generated here, so it cannot drift.
//
// A standards alignment that lives in a hand-maintained markdown file is a
// promise about the content that nothing checks. So the document is *built*
// from the same JSON the graph is checked against, and the checked-in copy is
// compared byte for byte. Editing the alignment means editing the data; the
// prose that surrounds it lives here, next to the checks it describes.
//
//   node tools/validate-items.mjs --write-map    # regenerate after a data change
// ---------------------------------------------------------------------------
const MAP_PATH = path.join(ROOT, 'content/standards/algebra1-l1-standards-map.md');
function standardsMap() {
  const short = (c) => c.replace('CCSS.MATH.CONTENT.', '');
  const forms = Object.values(FORMS_BY_SKILL).flat();
  const REPNAME = {
    symbolic: 'symbolic', table: 'table', graph: 'graph', verbal: 'verbal', context: 'contextual', figure: 'figure',
  };
  const out = [];
  const p = (s = '') => out.push(s);

p('# Algebra I, Level 1 — standards map');
p();
p(`*${ccss.title}*`);
p();
p(`Framework: **${ccss.framework}**. Level **${ccss.level}**. `
  + `${graph.nodes.length} skills, ${forms.length} item forms, ${ccss.standards.length} content standards, `
  + `${ccss.practices.length} practice standards.`);
p();
for (const line of ccss.mappingNote) { p(line); p(); }

p('## 1. The skills, in prerequisite order');
p();
p('Nothing unlocks before everything above it in this table is mastered. `content/graph/algebra1-l1.json` is the machine-readable source; `tools/validate-items.mjs` fails the build if the two disagree.');
p();
p('| Skill | Requires | Big idea | Standards | Practices | Representations the gate demands |');
p('|---|---|---|---|---|---|');
for (const n of graph.nodes) {
  p(`| \`${n.id}\` | ${(n.prereqs || []).map((x) => `\`${x}\``).join(', ') || '—' } | ${n.bigIdea} | ${n.standards.map((s) => short(s.code)).join('<br>')} | ${(n.practices || []).join(' ')} | ${(n.requiredReps || []).map((r) => REPNAME[r] || r).join(', ')} |`);
}
p();

p('## 2. Content standards, and what proves each one');
p();
p('**Depth** is a claim about the role the standard plays here. `core` — the standard is the thing being taught, and it is what the mastery gate tests. `supporting` — the standard is exercised inside items whose primary target is another standard. `introduced` — a first, deliberately partial encounter that a later level completes.');
p();
p('**Evidence** names the generated item forms that carry the standard. Every one is re-derived by an independent parser and solver, rendered in strict KaTeX, and produced in EN, ES and PL before it can appear here.');
p();
for (const depth of ['core', 'supporting', 'introduced']) {
  const rows = ccss.standards.filter((s) => s.depth === depth);
  if (!rows.length) continue;
  p(`### ${depth.toUpperCase()} (${rows.length})`);
  p();
  for (const s of rows) {
    p(`#### ${short(s.code)}`);
    p();
    p(`> ${s.text}`);
    p();
    p(`Taught in: ${s.nodes.map((x) => `\`${x}\``).join(', ')}`);
    p();
    p(`Evidence: ${s.evidence.map((e) => `\`${e}\``).join(', ')}`);
    p();
  }
}

p('## 3. Standards for Mathematical Practice');
p();
p('| Practice | Statement | Where it lives | How it is actually asked for |');
p('|---|---|---|---|');
for (const mp of ccss.practices) {
  p(`| **${mp.code}** | ${mp.text} | ${mp.nodes.map((x) => `\`${x}\``).join(', ')} | ${mp.how} |`);
}
p();

p('## 4. Every item form, and the standard it answers to');
p();
p('An item form that no standard claims is content nobody has justified shipping, so the gate rejects it. This table is the full inventory.');
p();
p('| Skill | Form | Representation | Bands | Standards it is evidence for |');
p('|---|---|---|---|---|');
for (const skill of SKILLS) {
  for (const f of FORMS_BY_SKILL[skill]) {
    const cites = ccss.standards.filter((s) => (s.evidence || []).includes(f.id)).map((s) => short(s.code));
    p(`| \`${skill}\` | \`${f.id}\` | ${REPNAME[f.rep] || f.rep} | ${f.dMin}–${f.dMax} | ${cites.join(', ') || '—'} |`);
  }
}
p();

p('## 5. Misconceptions the bank can recognise');
p();
p('A misconception is only ever named to a learner when the value they entered is one this item is able to produce from that misconception. Anything else is answered without a diagnosis. These are the ones the graph declares and the generators can actually produce.');
p();
p('| Skill | Misconception | What the learner is doing |');
p('|---|---|---|');
for (const n of graph.nodes) {
  for (const m of n.misconceptions || []) p(`| \`${n.id}\` | \`${m.id}\` | ${m.text} |`);
}
for (const m of graph.commonMisconceptions || []) p(`| *(any)* | \`${m.id}\` | ${m.text} |`);
p();

p('## 6. What Level 1 deliberately does not cover');
p();
p('Each of these belongs to a later level, and none of them is silently half-taught here.');
p();
p('- Linear **inequalities** — the inequality half of HSA.REI.B.3.');
p('- **Literal equations** and rearranging formulas — HSA.CED.A.4.');
p('- **Systems** solved algebraically — HSA.REI.C.6. The two-trace graph item reads a crossing point; it does not solve a system, which is why 8.EE.C.8.A is claimed only at INTRODUCED depth.');
p('- **Functions** as objects with domain and range — 8.F and HSF.IF.');
p();

p('## 7. How to check any of this');
p();
p('```bash');
p('node tools/validate-items.mjs   # alignment, both directions, plus every item re-derived');
p('node tools/simulate.mjs         # does the sequence actually get learners there');
p('```');
p();
p('`validate-items.mjs` fails the build if a skill cites a standard this document does not list, if a listed standard is claimed by no skill, if an item form is evidence for nothing, if a standard cites a form belonging to a skill it does not claim, or if this document falls out of step with the JSON it was written from.');
p();


  return out.join('\n');
}
{
  const want = standardsMap();
  if (process.argv.includes('--write-map')) {
    await writeFile(MAP_PATH, want);
    console.log(`standards map rewritten -> ${path.relative(ROOT, MAP_PATH)}`);
  } else {
    let have = null;
    try { have = await readFile(MAP_PATH, 'utf8'); } catch { have = null; }
    if (have == null) fail('standards: the standards map document is missing (run with --write-map)');
    else if (have !== want) fail('standards: the standards map document is out of step with the data it is generated from (run with --write-map)');
  }
}

// ---------------------------------------------------------------------------
console.log(`checked ${checked} items across ${SKILLS.length} skills, ${Object.values(FORMS_BY_SKILL).flat().length} item forms and ${ITEM_LOCALES.length} locales`);
console.log(`standards: ${ccss.standards.length} content standards, ${ccss.practices.length} practices, all cross-referenced`);
console.log('measured difficulty ladder (mean demand per band, ' + LADDER_N + ' items per cell):');
for (const skill of SKILLS) {
  console.log(`  ${skill.padEnd(14)} ` + ladder[skill].map((m) => m.toFixed(2).padStart(6)).join(' '));
}
console.log(`diagnosis: ${producible.size} misconceptions producible and translated in ${ITEM_LOCALES.length} locales; `
  + `${offListNamed}/${offListChecked} off-list responses were given a name (must be 0)`);
console.log(`scaffolds: ${pairs - missing - leaked}/${pairs} analogues clean, ${leaked} leaked the live answer, ${missing} unavailable`);
console.log(`echo: ${ladders - flat}/${ladders} four-layer ladders strictly deepen, ${thin} answer a slip with no mathematics or by restating the prompt, ${leakyEcho} print the live answer`);
console.log(`typography: 0 unicode maths glyphs in ${ITEM_LOCALES.length} locales; ${typographyAnglo} locale-specific operators in the notation (both must be 0)`);
console.log(`surface strategies over ${choiceItems} choice items (1-in-4 baseline):`);
for (const [name, s] of Object.entries(strat)) {
  const rate = s.decisive ? (s.right / s.decisive * 100).toFixed(1) : '  n/a';
  console.log(`  ${name.padEnd(18)} decisive on ${String(s.decisive).padStart(4)} items, correct ${String(rate).padStart(5)}%`);
}
if (problems.length) {
  const shown = problems.slice(0, 40);
  console.error(`\nFAIL — ${problems.length} problems (showing ${shown.length}):`);
  shown.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('PASS — every item independently re-derived, strict-KaTeX clean, misconception-tagged, and standards-aligned in all three languages');
