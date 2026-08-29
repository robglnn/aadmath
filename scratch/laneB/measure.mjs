/** Lane B measurement: reproduce defects 1, 2, 3 offline over the real bank. */
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { registerPack } from '../../src/content/registry.js';
import l2 from '../../src/content/packs/algebra1-l2.js';
import l3 from '../../src/content/packs/algebra1-l3.js';
import l4 from '../../src/content/packs/algebra1-l4.js';
import l5 from '../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);
import { equivalent } from '../../src/learn/parser.js';

const CLEAN = (s) => String(s).replace(/\\left|\\right/g, '').replace(/\\[,;:!]/g, ' ').replace(/\\cdot/g, '*');
const norm = (s) => String(s).replace(/\s+/g, '').replace(/\\left|\\right/g, '');

/** verbatim copy of rift.js `_accepts` today */
function accepts(item, value) {
  const v = String(value).trim();
  if (!v) return false;
  if (norm(v) === norm(item.answer)) return true;
  for (const alt of item.accept || []) if (norm(v) === norm(alt)) return true;
  if (item.type === 'numeric') {
    const a = v.match(/^(-?\d+)(?:\/(\d+))?$/);
    const b = String(item.answer).match(/^(-?\d+)(?:\/(\d+))?$/);
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

/** verbatim routing of rift.js `_mount` (which modality would take it) */
function route(item) {
  if (item.type === 'special' || item.check?.kind === 'equationChoice'
    || (item.latex && /\\square/.test(item.latex))) return 'choice';
  if (item.figure?.kind === 'plot') return 'plot?';
  if (item.figure?.kind === 'balance' || item.check?.kind === 'solve') return 'balance?';
  if (item.figure?.kind === 'area' || item.skill === 'distribute') return 'area?';
  if (item.type === 'expression') {
    const src = CLEAN(item.check?.math || item.latex);
    const vm = src.match(/[a-zA-Z]/);
    if (vm && !/[\\^*()=]/.test(src)) return 'sort?';
    return 'keypad';
  }
  return 'keypad';
}

/** which characters the expression keypad can emit today */
const PAD_EXPR = (v) => new Set(['0','1','2','3','4','5','6','7','8','9', v, '+', '^', '2', '/', '-']);
function typeable(ans, v, expr) {
  const s = String(ans);
  // strip latex control words we could never type
  return !/[()=,{}]|\\/.test(s);
}

const N = Number(process.argv[2] || 6);
const rows = [];
for (const skill of SKILLS) {
  for (const f of FORMS_BY_SKILL[skill]) {
    for (let d = f.dMin; d <= f.dMax; d++) {
      for (let s = 0; s < N; s++) {
        let it = null;
        try { it = safeGenerate(skill, d, 5000 + s * 7919 + d * 13, { locale: 'en', form: f.id, record: false }); }
        catch { continue; }
        if (it.form !== f.id) continue;
        rows.push(it);
      }
    }
  }
}
const byForm = new Map();
for (const it of rows) {
  const k = `${it.skill}/${it.form}`;
  const b = byForm.get(k) || { n: 0, qback: 0, untypeable: 0, route: {}, kinds: new Set(), types: new Set(), sample: null, dupKey: 0 };
  b.n++;
  b.kinds.add(it.check?.kind || '-');
  b.types.add(it.type);
  const r = route(it);
  b.route[r] = (b.route[r] || 0) + 1;
  // question typed back
  const q = String(it.check?.math || it.latex || '');
  if (q && norm(q) !== norm(it.answer) && accepts(it, q)) { b.qback++; if (!b.sample) b.sample = { q, a: it.answer }; }
  const v = it.check?.variable || (String(it.answer).match(/[a-zA-Z]/) || [])[0] || 'x';
  if (!typeable(it.answer, v, it.type === 'expression')) b.untypeable++;
  // duplicate distractor under mathematical equality: the safety net
  for (const d of it.distractors || []) {
    const dv = String(d.value ?? d.v ?? '');
    if (!dv) continue;
    if (norm(dv) === norm(it.answer)) continue;
    let same = false;
    try { same = mathEq(dv, it.answer, v); } catch { same = false; }
    if (same) b.dupKey++;
  }
  byForm.set(k, b);
}

function mathEq(a, b, v) {
  // does NOT throw on '=' — the point of the exercise
  const strip = (s) => String(s).replace(/^[a-zA-Z]\s*=\s*/, '').trim();
  return equivalent(strip(a), strip(b), v) === true;
}

let tq = 0, tu = 0, td = 0, tn = 0;
const out = [];
for (const [k, b] of [...byForm].sort()) {
  tn += b.n; tq += b.qback; tu += b.untypeable; td += b.dupKey;
  if (b.qback || b.untypeable || b.dupKey) {
    out.push(`${k.padEnd(34)} n=${String(b.n).padStart(4)} qback=${String(b.qback).padStart(4)} untypeable=${String(b.untypeable).padStart(4)} dupkey=${String(b.dupKey).padStart(3)} routes=${JSON.stringify(b.route)} kinds=${[...b.kinds].join('|')}`);
  }
}
console.log(out.join('\n'));
console.log(`\nTOTAL items ${tn}: question-back accepted ${tq}, untypeable key ${tu}, duplicate-key distractors ${td}`);
