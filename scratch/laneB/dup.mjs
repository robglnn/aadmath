/** Defect 3: duplicate keys among distractors, using an oracle that survives '='. */
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { registerPack } from '../../src/content/registry.js';
import l2 from '../../src/content/packs/algebra1-l2.js';
import l3 from '../../src/content/packs/algebra1-l3.js';
import l4 from '../../src/content/packs/algebra1-l4.js';
import l5 from '../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);
import { equivalent, answerValues } from '../../src/learn/parser.js';
import { sCmp } from '../../src/learn/surd.js';

const norm = (s) => String(s).replace(/\s+/g, '').replace(/\\left|\\right/g, '');

/** today's _accepts */
function accepts(item, value) {
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
function sameValueSet(a, b, v) {
  const A = answerValues(a, null), B = answerValues(b, null);
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (sCmp(A[i], B[i]) !== 0) return false;
  return true;
}

const N = Number(process.argv[2] || 4);
const byForm = new Map();
let total = 0, dupTotal = 0;
for (const skill of SKILLS) for (const f of FORMS_BY_SKILL[skill]) for (let d = f.dMin; d <= f.dMax; d++) for (let s = 0; s < N; s++) {
  let it = null;
  try { it = safeGenerate(skill, d, 5000 + s * 7919 + d * 13, { locale: 'en', form: f.id, record: false }); } catch { continue; }
  if (it.form !== f.id) continue;
  total++;
  const key = `${skill}/${f.id}`;
  const b = byForm.get(key) || { n: 0, dup: 0, ex: null };
  b.n++;
  const v = it.check?.variable || 'x';
  for (const d2 of it.distractors || []) {
    const dv = String(d2.value ?? '');
    if (!dv.trim()) continue;
    if (norm(dv) === norm(it.answer)) continue;        // textual dupes already dropped by _readings
    if (accepts(it, dv)) continue;                      // the net that DOES fire
    let same = false;
    try { same = sameValueSet(dv, it.answer, v); } catch { same = false; }
    if (same) { b.dup++; dupTotal++; if (!b.ex) b.ex = `${dv}   ||key||   ${it.answer}`; }
  }
  byForm.set(key, b);
}
const rows = [...byForm].filter(([, b]) => b.dup).sort((a, b) => b[1].dup - a[1].dup);
for (const [k, b] of rows) console.log(`${k.padEnd(34)} ${String(b.dup).padStart(4)}/${String(b.n).padStart(4)}   ${b.ex}`);
console.log(`\n${dupTotal} duplicate-key distractors over ${total} items in ${rows.length} forms`);
