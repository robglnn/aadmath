#!/usr/bin/env node
/**
 * REGENERATE AND RE-VERIFY. 500+ items per skill per locale, every band, and
 * every one of them put through the independent checker:
 *
 *   verify()          the solver in src/learn/generators.js re-derives the
 *                     answer from the printed notation, never from how the
 *                     item was built
 *   katex             strict, throwOnError, the same settings the game uses
 *   simplestFaults    every root a learner is shown has its square out
 *   factorFaults      every factorisation key is carried all the way
 *   referenceFaults   the stem points at nothing the card does not carry
 *
 * Reports: generated, rejected, and why.
 */
import katex from 'katex';
import { generate, SKILLS, verify } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';
import { referenceFaults } from '../../tools/critic/determinate.mjs';

// The two form rules, written here from the mathematics rather than imported,
// so this run cannot agree with the gate by sharing its code.
const sqfree = (n) => { const v = Math.abs(n); for (let p = 2; p * p <= v; p++) if (v % (p * p) === 0) return false; return true; };
function simplestFaults(item) {
  const out = [];
  const shown = [item.answer, ...(item.distractors || []).map((d) => d.value)];
  for (const v of shown) {
    const src = String(v ?? '');
    if (/\\sqrt\s*\[/.test(src)) continue;
    for (const m of src.matchAll(/\\sqrt\s*\{\s*(\d+)\s*\}/g)) {
      if (!sqfree(Number(m[1]))) out.push(`"${src}" holds \\sqrt{${m[1]}}, which still has a square in it`);
    }
  }
  return out;
}
const gcd2 = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
function factorFaults(item) {
  const v = item.check?.variable || 'x';
  const src = String(item.answer ?? '').trim();
  if (!src || /[=<>,]|\\text|\\frac|\\pm|\\sqrt|\\ldots|\\begin/.test(src)) return [];
  const close = (at) => { let dep = 0; for (let i = at; i < src.length; i++) { if (src.startsWith('\\left(', i)) { dep++; i += 5; continue; } if (src.startsWith('\\right)', i)) { dep--; if (!dep) return i; i += 6; } } return -1; };
  const parts = []; let i = 0; let seen = false;
  while (i < src.length) {
    if (src.startsWith('\\left(', i)) { const j = close(i); if (j < 0) return []; parts.push(src.slice(i + 6, j)); seen = true; i = j + 7; const rep = /^\s*\^\{(\d+)\}/.exec(src.slice(i)); if (rep) { for (let t = 1; t < Number(rep[1]); t++) parts.push(parts[parts.length - 1]); i += rep[0].length; } continue; }
    if (seen) return [];
    i++;
  }
  if (!parts.length) return [];
  const out = [];
  for (const part of parts) {
    const t = String(part).replace(/\\left|\\right|\\cdot|\s/g, '');
    if (!new RegExp(`^[-+0-9^{}${v}]*$`).test(t) || !t) continue;
    const co = {};
    let ok = true;
    for (const term of t.replace(/-/g, '+-').split('+').filter(Boolean)) {
      const m = new RegExp(`^(-?\\d*)${v}(?:\\^\\{(\\d+)\\})?$`).exec(term);
      if (m) { const c = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]); const pw = m[2] ? Number(m[2]) : 1; co[pw] = (co[pw] || 0) + c; continue; }
      if (/^-?\d+$/.test(term)) { co[0] = (co[0] || 0) + Number(term); continue; }
      ok = false; break;
    }
    if (!ok || !Object.keys(co).length) continue;
    const content = Object.values(co).reduce((g, c) => gcd2(g, c), 0);
    if (content > 1) out.push(`"${src}" leaves a factor of ${content} inside (${part})`);
    const a = co[2] || 0, b = co[1] || 0, c0 = co[0] || 0;
    if (a) { const disc = b * b - 4 * a * c0; const rt = Math.round(Math.sqrt(Math.max(0, disc))); if (disc >= 0 && rt * rt === disc) out.push(`"${src}" leaves (${part}), which still comes apart`); }
  }
  return out;
}

const PER = Number(process.argv[2] || 500);
const LOCALES = ['en', 'es', 'pl'];
const units = await allUnits();
const unitOf = new Map();
for (const { unit } of units) {
  const graph = await loadUnit(unit);
  for (const n of graph.nodes) if (!unitOf.has(n.id)) unitOf.set(n.id, unit.id);
}

const rows = [];
let total = 0, bad = 0;
const reasons = new Map();
for (const skill of SKILLS) {
  for (const loc of LOCALES) {
    let made = 0, drew = 0, rejected = 0;
    for (let i = 0; made < PER && i < PER * 6; i++) {
      const d = (i % 5) + 1;
      drew++;
      let it;
      try { it = generate(skill, d, i * 7919 + d * 131, { locale: loc, strict: true, record: false }); }
      catch (e) { continue; }                     // a refused draw, not an item
      made++; total++;
      const why = [];
      try { verify(it); } catch (e) { why.push(`solver: ${e.message}`); }
      for (const src of [it.latex, it.answer, ...it.steps.map((s) => s.latex), ...it.distractors.map((x) => x.value)]) {
        if (src == null) continue;
        try { katex.renderToString(String(src), { throwOnError: true, strict: 'error' }); }
        catch (e) { why.push(`katex: ${String(e.message).split('\n')[0]}`); break; }
      }
      for (const p of simplestFaults(it)) why.push(`simplest: ${p}`);
      for (const p of factorFaults(it)) why.push(`factor: ${p}`);
      for (const f of referenceFaults({ ...it, loc })) why.push(`${f.rule}/${f.cls}: ${f.text}`);
      if (why.length) {
        rejected++; bad++;
        const key = `${unitOf.get(skill) || '?'} ${skill}/${it.form} ${loc} :: ${why[0].slice(0, 130)}`;
        reasons.set(key, (reasons.get(key) || 0) + 1);
      }
    }
    rows.push({ unit: unitOf.get(skill) || '?', skill, loc, drew, made, rejected });
  }
}

const byUnit = new Map();
for (const r of rows) {
  const u = byUnit.get(r.unit) || { made: 0, rejected: 0, skills: new Set() };
  u.made += r.made; u.rejected += r.rejected; u.skills.add(r.skill);
  byUnit.set(r.unit, u);
}
console.log(`regenerated ${total} items · ${PER} per skill per locale · ${SKILLS.length} skills · ${LOCALES.join('/')}`);
for (const [u, v] of byUnit) console.log(`  ${u.padEnd(14)} ${String(v.skills.size).padStart(2)} skills  ${String(v.made).padStart(7)} items  ${String(v.rejected).padStart(6)} rejected`);
const thin = rows.filter((r) => r.made < PER);
if (thin.length) for (const r of thin) console.log(`  THIN ${r.skill}/${r.loc}: only ${r.made} of ${PER} in ${r.drew} draws`);
console.log(`\nrejected by the independent checker: ${bad} of ${total}`);
for (const [k, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  x${n} ${k}`);
process.exit(bad ? 1 : 0);
