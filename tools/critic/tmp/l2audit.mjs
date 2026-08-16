/**
 * L2 audit harness — applies the Level 1 gate (tools/validate-items.mjs) to
 * every unit in the manifest, not just the hardcoded L1 graph.
 * Scratch tool. Not a gate.
 */
import { generate, SKILLS, FORMS_BY_SKILL, verify, demandOf, literalsOf } from '../../../src/learn/generators.js';
import { formsFor, registeredSkills } from '../../../src/content/registry.js';
import { analogueFor } from '../../../src/learn/scaffold.js';
import { ladderOf, ladderNotation, echoScript } from '../../../src/learn/echo.js';
import { diagnose } from '../../../src/learn/diagnose.js';
import { allUnits, loadUnit } from '../../_courses.mjs';
import EN from '../../../content/lang/items.en.js';
import ES from '../../../content/lang/items.es.js';
import PL from '../../../content/lang/items.pl.js';
import L2EN from '../../../content/lang/packs/algebra1-l2.en.js';
import L2ES from '../../../content/lang/packs/algebra1-l2.es.js';
import L2PL from '../../../content/lang/packs/algebra1-l2.pl.js';

const BUNDLES = { en: { ...EN, ...L2EN }, es: { ...ES, ...L2ES }, pl: { ...PL, ...L2PL } };
const LOCALES = ['en', 'es', 'pl'];
const WANT = process.argv[2] || 'algebra1-l2';

const units = await allUnits();
const target = units.find((u) => u.unit.id === WANT);
const graph = await loadUnit(target.unit);
// register the other units too so cross-unit prereqs resolve
for (const u of units) if (u.unit.id !== WANT) await loadUnit(u.unit).catch(() => {});

const NODE_IDS = graph.nodes.map((n) => n.id);
const out = [];
const fail = (m) => out.push(m);
const note = [];

// ---------------------------------------------------------------- form shape
console.log('=== 1. form shape per skill (L1 bar: >=5 forms, >=4 reps, >=3 forms/band, non-symbolic each band) ===');
for (const n of graph.nodes) {
  const forms = formsFor(n.id) || [];
  const reps = new Set(forms.map((f) => f.rep));
  const perBand = [];
  for (let d = 1; d <= 5; d++) {
    const at = forms.filter((f) => d >= f.dMin && d <= f.dMax);
    perBand.push(at.length);
    if (at.length < 3) fail(`FORMS ${n.id}: only ${at.length} form(s) eligible at band ${d} (L1 bar 3)`);
    if (!at.some((f) => f.rep !== 'symbolic')) fail(`FORMS ${n.id}: no non-symbolic form at band ${d}`);
  }
  if (forms.length < 5) fail(`FORMS ${n.id}: ${forms.length} item forms (L1 bar 5)`);
  if (reps.size < 4) fail(`FORMS ${n.id}: ${reps.size} representation(s) (L1 bar 4): ${[...reps].join(',')}`);
  for (const r of n.requiredReps || []) if (!reps.has(r)) fail(`FORMS ${n.id}: requiredRep "${r}" not produced`);
  console.log(`  ${n.id.padEnd(24)} forms=${String(forms.length).padStart(2)} reps=${[...reps].join(',').padEnd(34)} band=${perBand.join('/')}`);
}

// ------------------------------------------------- misconception producibility
console.log('\n=== 2. misconception producibility ===');
const producible = new Set();
const bySkill = new Map();
for (const n of graph.nodes) {
  const seen = new Set();
  for (const f of formsFor(n.id) || []) {
    for (let d = f.dMin; d <= f.dMax; d++) {
      for (let i = 0; i < 24; i++) {
        let it;
        try { it = generate(n.id, d, (i * 2654435761 + d * 40503 + f.id.length * 7919) >>> 0, { form: f.id, strict: true }); } catch { continue; }
        for (const dd of it.diagnostics || []) { producible.add(dd.misconception); seen.add(dd.misconception); }
      }
    }
  }
  bySkill.set(n.id, seen);
  const declared = (n.misconceptions || []).map((m) => m.id);
  const dead = declared.filter((m) => !seen.has(m));
  const undeclared = [...seen].filter((m) => !declared.includes(m)
    && !(graph.commonMisconceptions || []).some((c) => c.id === m));
  for (const m of dead) fail(`MISCONCEPTION ${n.id}: declares "${m}" that no item form can produce`);
  for (const m of undeclared) fail(`MISCONCEPTION ${n.id}: produces "${m}" that the graph never declares`);
  console.log(`  ${n.id.padEnd(24)} declared=${declared.length} producible=${seen.size}${dead.length ? '  DEAD: ' + dead.join(',') : ''}`);
}
for (const m of producible) for (const loc of LOCALES) {
  if (!BUNDLES[loc][`mis.${m}`] && !BUNDLES[loc][m]) note.push(`i18n: misconception "${m}" line missing in ${loc}?`);
}

// ------------------------------------------------------------- diagnosis honesty
console.log('\n=== 3. diagnosis: off-list responses must not be named ===');
let offList = 0, named = 0;
for (const n of graph.nodes) {
  for (const f of formsFor(n.id) || []) {
    for (let d = f.dMin; d <= f.dMax; d++) {
      let it;
      try { it = generate(n.id, d, (d * 7919 + f.id.length * 104729) >>> 0, { form: f.id, strict: true }); } catch { continue; }
      const known = new Set((it.diagnostics || []).map((x) => String(x.value)));
      for (const junk of ['999', '-7/3', '0', '1000000', 'x = 41']) {
        if (known.has(junk) || String(it.answer) === junk) continue;
        offList++;
        const dg = diagnose(it, junk);
        if (dg && dg.misconception) { named++; fail(`DIAGNOSIS ${n.id}/${f.id}/d${d}: named "${dg.misconception}" for off-list response "${junk}"`); }
      }
    }
  }
}
console.log(`  ${offList} off-list responses, ${named} were given a name (must be 0)`);

// ----------------------------------------------------------------- scaffolds
console.log('\n=== 4. scaffold analogues ===');
let pairs = 0, leaked = 0, missing = 0;
for (const n of graph.nodes) {
  for (let d = 1; d <= 5; d++) {
    for (let i = 0; i < 12; i++) {
      let item;
      try { item = generate(n.id, d, (i * 2654435761 + d * 40503) >>> 0); } catch { continue; }
      const ex = analogueFor(item, { difficulty: d, seed: item.seed });
      pairs++;
      if (!ex) { missing++; continue; }
      if (ex.answer === item.answer) { leaked++; fail(`SCAFFOLD ${n.id}/d${d} analogue shares the live answer`); continue; }
      const vals = (t) => (String(t).replace(/\^\s*\{?-?\d+\}?/g, '').match(/\d+/g) || []);
      const live = new Set(vals(item.answer));
      const shown = [ex.latex, ex.answer, ...ex.steps.map((s) => s.latex)].join(' ');
      for (const nmb of vals(shown)) if (live.has(nmb)) { leaked++; fail(`SCAFFOLD ${n.id}/d${d} analogue shows the live answer "${nmb}"`); break; }
    }
  }
}
console.log(`  ${pairs} pairs, ${leaked} leaked, ${missing} unavailable (${(100 * missing / pairs).toFixed(1)}%; L1 bar <2%)`);
if (missing / Math.max(1, pairs) > 0.02) fail(`SCAFFOLD: no clean analogue for ${missing}/${pairs} items`);

// --------------------------------------------------------------------- echo
console.log('\n=== 5. echo ladder ===');
const norm = (t) => String(t).replace(/\s+/g, '');
let ladders = 0, flat = 0, thin = 0, leakyEcho = 0;
for (const n of graph.nodes) {
  for (const form of formsFor(n.id) || []) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let i = 0; i < 6; i++) {
        let item;
        try { item = generate(n.id, d, (i * 15485863 + d * 6151 + n.id.length * 97) >>> 0, { form: form.id, strict: true }); } catch { continue; }
        const ex = analogueFor(item, { difficulty: d, seed: item.seed });
        const entry = (item.diagnostics || [])[0]?.value ?? null;
        const rungs = ladderOf(item, ex, entry);
        ladders++;
        if (new Set(rungs).size !== rungs.length) { flat++; fail(`ECHO ${n.id}/${form.id}/d${d} renders two identical layers`); }
        for (const dg of (item.diagnostics || []).slice(0, 3)) {
          const first = echoScript({ item, analogue: ex, entry: dg.value, tier: 1 }).rows;
          const math = first.filter((r) => r.latex);
          if (!math.length) { thin++; fail(`ECHO ${n.id}/${form.id}/d${d} answers a slip with no mathematics at all`); continue; }
          const restates = math.length === 1 && norm(math[0].latex) === norm(item.latex) && math[0].why === EN['echo.theTear'];
          if (restates) { thin++; fail(`ECHO ${n.id}/${form.id}/d${d} answers "${dg.value}" by restating the prompt`); }
        }
        const digits = (s) => (String(s).replace(/\^\s*\{?-?\d+\}?/g, '').match(/\d+/g) || []);
        const live = new Set(digits(item.answer));
        for (const nmb of digits(ladderNotation(item, ex, entry).join(' '))) {
          if (live.has(nmb)) { leakyEcho++; fail(`ECHO ${n.id}/${form.id}/d${d} prints the live answer "${nmb}" inside the trace`); break; }
        }
      }
    }
  }
}
console.log(`  ${ladders} ladders, ${flat} flat, ${thin} no-maths/restate, ${leakyEcho} leaky (all must be 0)`);

// ------------------------------------------------------- typography per locale
console.log('\n=== 6. typography ===');
const GLYPHS = /[×÷≤≥≠−–—⋅∙]/;
let glyphHits = 0, opHits = 0;
for (const n of graph.nodes) {
  for (const form of formsFor(n.id) || []) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      const shown = {};
      for (const loc of LOCALES) {
        let it;
        try { it = generate(n.id, d, (d * 31 + form.id.length * 17) >>> 0, { form: form.id, locale: loc, strict: true }); } catch { continue; }
        shown[loc] = it;
        if (GLYPHS.test(it.latex)) { glyphHits++; fail(`TYPOGRAPHY ${n.id}/${form.id}/d${d} unicode maths glyph in notation (${loc})`); }
        if (GLYPHS.test(String(it.stem))) { glyphHits++; fail(`TYPOGRAPHY ${n.id}/${form.id}/d${d} unicode maths glyph in ${loc} stem: ${it.stem}`); }
        const outside = String(it.stem);
        if (/\\[a-zA-Z]+/.test(outside)) fail(`TYPOGRAPHY ${n.id}/${form.id}/d${d} leaks a LaTeX command into ${loc} prose :: ${outside}`);
      }
      const ls = LOCALES.filter((l) => shown[l]);
      if (ls.length === 3) {
        const sigs = ls.map((l) => String(shown[l].latex).replace(/[\d.]/g, '#'));
        if (new Set(sigs).size !== 1) { opHits++; fail(`TYPOGRAPHY ${n.id}/${form.id}/d${d} notation differs by locale: ${JSON.stringify(sigs)}`); }
      }
    }
  }
}
console.log(`  ${glyphHits} glyph hits, ${opHits} locale-divergent notations (must be 0)`);

// ---------------------------------------------------- contextual stem length
console.log('\n=== 7. contextual stems (one situation sentence, one question, no decoy numerals) ===');
const WORDS = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const stemStats = [];
let longStems = 0, manySent = 0, decoys = 0;
for (const n of graph.nodes) {
  for (const form of (formsFor(n.id) || []).filter((f) => f.rep === 'context' || f.rep === 'verbal')) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let i = 0; i < 10; i++) {
        for (const loc of LOCALES) {
          let it;
          try { it = generate(n.id, d, (i * 99991 + d * 787) >>> 0, { form: form.id, locale: loc, strict: true }); } catch { continue; }
          const stem = String(it.stem || '');
          if (!stem) continue;
          const w = WORDS(stem);
          stemStats.push(w);
          const sentences = stem.split(/(?<=[.!?¿?])\s+/).filter((s) => s.trim().length > 1);
          if (w > 25) { longStems++; fail(`STEM ${n.id}/${form.id}/d${d}/${loc}: ${w} words :: ${stem}`); }
          if (sentences.length > 2) { manySent++; fail(`STEM ${n.id}/${form.id}/d${d}/${loc}: ${sentences.length} sentences :: ${stem}`); }
          // decoy numerals: a numeral in the prose that the notation never uses
          const inProse = (stem.match(/-?\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(/[.,]/g, ''));
          const inMath = new Set([...(String(it.latex).match(/\d+/g) || []),
            ...(String(it.answer).match(/\d+/g) || []),
            ...(it.figure ? (JSON.stringify(it.figure).match(/\d+/g) || []) : []),
            ...(it.distractors || []).flatMap((dd) => String(dd.value).match(/\d+/g) || [])]);
          for (const num of inProse) {
            if (!inMath.has(num)) { decoys++; fail(`STEM-DECOY ${n.id}/${form.id}/d${d}/${loc}: prose numeral "${num}" appears in no mathematics :: ${stem}`); break; }
          }
        }
      }
    }
  }
}
stemStats.sort((a, b) => a - b);
console.log(`  ${stemStats.length} context/verbal stems · mean ${(stemStats.reduce((a, b) => a + b, 0) / stemStats.length).toFixed(1)} · p95 ${stemStats[Math.floor(stemStats.length * 0.95)]} · longest ${stemStats[stemStats.length - 1]}`);
console.log(`  ${longStems} over 25 words, ${manySent} over two sentences, ${decoys} with decoy numerals`);

// ------------------------------------------------------------------- verdict
console.log('\n=== FINDINGS ===');
const grouped = new Map();
for (const f of out) {
  const k = f.split(' ')[0];
  grouped.set(k, (grouped.get(k) || []).concat(f));
}
for (const [k, list] of grouped) {
  console.log(`\n## ${k} — ${list.length}`);
  for (const f of list.slice(0, 14)) console.log('   ' + f);
  if (list.length > 14) console.log(`   ... and ${list.length - 14} more`);
}
if (note.length) { console.log('\n## notes'); for (const nn of note.slice(0, 10)) console.log('   ' + nn); }
console.log(`\n${out.length} finding(s)`);
