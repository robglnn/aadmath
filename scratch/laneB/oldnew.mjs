/** Would the OLD grader have accepted what the NEW one refuses (and vice versa)? */
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { registerPack } from '../../src/content/registry.js';
import l2 from '../../src/content/packs/algebra1-l2.js';
import l3 from '../../src/content/packs/algebra1-l3.js';
import l4 from '../../src/content/packs/algebra1-l4.js';
import l5 from '../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);
import { equivalent } from '../../src/learn/parser.js';
import * as C from '/tmp/contract.mjs';

const norm = (s) => String(s).replace(/\s+/g, '').replace(/\\left|\\right/g, '');
function oldAccepts(item, value) {
  const v = String(value).trim();
  if (!v) return false;
  if (norm(v) === norm(item.answer)) return true;
  for (const alt of item.accept || []) if (norm(v) === norm(alt)) return true;
  if (item.type === 'numeric') {
    const a = v.match(/^(-?\d+)(?:\/(\d+))?$/); const b = String(item.answer).match(/^(-?\d+)(?:\/(\d+))?$/);
    if (a && b) return Number(a[1]) * Number(b[2] || 1) === Number(b[1]) * Number(a[2] || 1);
    return false;
  }
  if (item.type === 'expression') {
    const variable = item.check?.variable || (String(item.answer).match(/[a-zA-Z]/) || [])[0];
    if (!variable) return false;
    try { return equivalent(v, item.answer, variable) === true; } catch { return false; }
  }
  return false;
}
function ratioOf(src) {
  const s = String(src ?? '').replace(/\s+/g, '').replace(/\\left|\\right/g, '');
  let m = /^([+-]?)(\d+)(?:\/(\d+))?$/.exec(s);
  if (m) return { n: (m[1] === '-' ? -1 : 1) * Number(m[2]), d: Number(m[3] || 1) };
  m = /^([+-]?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (m) return { n: (m[1] === '-' ? -1 : 1) * Number(m[2]), d: Number(m[3]) };
  return null;
}
function variableOf(item) {
  const CLEAN = (s) => String(s).replace(/\\left|\\right/g, '').replace(/\\[,;:!]/g, ' ').replace(/\\cdot/g, '*');
  return item.check?.variable
    || (String(item.answer ?? '').replace(/\\[a-zA-Z]+/g, ' ').match(/[a-zA-Z]/) || [])[0]
    || (CLEAN(item.latex || '').replace(/\\[a-zA-Z]+/g, ' ').match(/[a-zA-Z]/) || [])[0] || '';
}
function newAccepts(item, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const src = C.toTex(raw);
  const key = String(item.answer);
  if (norm(raw) === norm(key) || norm(src) === norm(key)) return true;
  for (const alt of item.accept || []) { const a = String(alt); if (norm(raw) === norm(a) || norm(src) === norm(C.toTex(a))) return true; }
  const v = variableOf(item);
  if (item.type === 'numeric') {
    const a = ratioOf(raw) || ratioOf(src); const b = ratioOf(key);
    if (a && b) return a.n * b.d === b.n * a.d;
    return false;
  }
  if (C.sameAnswer(src, key, v) !== true) return false;
  const promptRestated = [item.check?.math, item.latex].some((p) => p && norm(String(p)) !== norm(key) && norm(src) === norm(String(p)));
  if (promptRestated) return false;
  for (const f of C.demandsOf(item, v)) if (C.inForm(src, f, v) === false) return false;
  return true;
}

/** Spellings a learner might legitimately hand in for this key. */
function honestForms(item) {
  const a = String(item.answer);
  const out = new Set([a, C.toPad(a)]);
  const r = ratioOf(a);
  if (r) { out.add(`${r.n}/${r.d}`); out.add(`${r.n * 2}/${r.d * 2}`); out.add(`${r.n * 3}/${r.d * 3}`); }
  // a two-term sum written the other way round
  const parts = a.match(/^\s*(-?[^+\-]+?)\s*\+\s*([^+\-]+?)\s*$/);
  if (parts && !/\\/.test(a)) out.add(`${parts[2]} + ${parts[1]}`);
  // roots in the other order
  if (/^[a-zA-Z] = /.test(a) && a.includes(',')) {
    const ps = a.split(',').map((x) => x.trim());
    if (ps.length === 2) out.add(`${ps[1]}, ${ps[0]}`);
  }
  return [...out];
}

const N = Number(process.argv[2] || 3);
let lost = 0, gained = 0, n = 0;
const lostEx = [], gainedEx = [];
for (const skill of SKILLS) for (const f of FORMS_BY_SKILL[skill]) for (let d = f.dMin; d <= f.dMax; d++) for (let s = 0; s < N; s++) {
  let it = null;
  try { it = safeGenerate(skill, d, 4000 + s * 7919 + d * 13, { locale: 'en', form: f.id, record: false }); } catch { continue; }
  if (it.form !== f.id) continue;
  for (const form of honestForms(it)) {
    n++;
    const o = oldAccepts(it, form), w = newAccepts(it, form);
    if (o && !w) { lost++; if (lostEx.length < 12) lostEx.push(`${skill}/${f.id}: "${form}" vs key "${it.answer}"`); }
    if (!o && w) { gained++; if (gainedEx.length < 8) gainedEx.push(`${skill}/${f.id}: "${form}" vs key "${it.answer}"`); }
  }
}
console.log(`${n} honest spellings tried`);
console.log(`ACCEPTED BEFORE, REFUSED NOW: ${lost}`);
lostEx.forEach((x) => console.log('   ' + x));
console.log(`REFUSED BEFORE, ACCEPTED NOW: ${gained}`);
gainedEx.forEach((x) => console.log('   ' + x));
