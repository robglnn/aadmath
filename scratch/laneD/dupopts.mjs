/**
 * Lane D scratch audit: does any option set in a unit show the same NUMBER twice?
 * Mirrors the contract rule "an option set may not contain the key twice under
 * MATHEMATICAL equality, only textual", read over the three options the rig
 * actually mounts (item.distractors) plus the key.
 */
import { generate, SKILLS } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';
import { surdValue, parse, evalSurd, expandPm, splitTop } from '../../src/learn/parser.js';

const UNIT = process.argv.includes('--unit') ? process.argv[process.argv.indexOf('--unit') + 1] : 'algebra1-l5';
const SEEDS = Number(process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : 120);

for (const { unit } of await allUnits()) await loadUnit(unit);
const mod = await import(`../../src/content/packs/${UNIT}.js`);
const mine = Object.keys(mod.default.skills);

const sCmp = (a, b) => (a.p.n * b.p.d - b.p.n * a.p.d) || (a.q.n * b.q.d - b.q.n * a.q.d) || (a.k - b.k);

/** Exact value of one written answer, or null when it is outside the reader. */
function valueOf(src) {
  const t = String(src).trim();
  try {
    const parts = splitTop(t, ',');
    const out = [];
    for (const part of parts) {
      const at = part.indexOf('=');
      const lhs = at >= 0 ? part.slice(0, at).trim() : '';
      const rhs = at >= 0 ? part.slice(at + 1) : part;
      const vs = expandPm(parse(rhs)).map((x) => evalSurd(x, {})).sort(sCmp);
      out.push(`${lhs}|${vs.map((x) => `${x.p.n}/${x.p.d}+${x.q.n}/${x.q.d}r${x.k}`).join(';')}`);
    }
    return out.sort().join(' , ');
  } catch { return null; }
}

const hits = new Map();
let items = 0, unreadable = 0;
for (const skill of SKILLS) {
  if (!mine.includes(skill)) continue;
  for (let d = 1; d <= 5; d++) {
    for (let s = 0; s < SEEDS; s++) {
      let it;
      try { it = generate(skill, d, s * 7919 + d * 131, { locale: 'en', strict: true, record: false }); } catch { continue; }
      items++;
      const src = process.argv.includes('--pool') ? (it.diagnostics || []) : (it.distractors || []);
      const opts = [{ v: String(it.answer), key: true }, ...src.map((dd) => ({ v: String(dd.value), m: dd.misconception }))];
      const vals = opts.map((o) => ({ ...o, val: valueOf(o.v) }));
      if (vals.some((o) => o.val === null)) unreadable++;
      for (let i = 0; i < vals.length; i++) {
        for (let j = i + 1; j < vals.length; j++) {
          const a = vals[i], b = vals[j];
          if (a.val === null || b.val === null) continue;
          if (a.val !== b.val) continue;
          const tag = `${skill}/${it.form}: ${a.key ? 'KEY' : a.m} "${a.v}" == ${b.key ? 'KEY' : b.m} "${b.v}"`;
          hits.set(tag, (hits.get(tag) || 0) + 1);
        }
      }
    }
  }
}
console.log(`${items} items, ${unreadable} with at least one option outside the reader`);
const rows = [...hits.entries()].sort((x, y) => y[1] - x[1]);
for (const [k, n] of rows) console.log(`  x${String(n).padStart(4)}  ${k}`);
console.log(rows.length ? `FAIL — ${rows.length} distinct duplicate-value pairs` : 'PASS — no option set shows one number twice');
