/**
 * Lane D scratch audit #2: does any option set show the same LINE twice?
 * `3x + 4y = -28` and `-3/4 x - y = 7` are one line in two costumes; the
 * value-equality reader cannot see that, because neither side is a number.
 */
import { generate, SKILLS } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';
import { parse, polyCoeffs, evalAst } from '../../src/learn/parser.js';

const UNIT = 'algebra1-l5';
const SEEDS = Number(process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : 200);
for (const { unit } of await allUnits()) await loadUnit(unit);
const mod = await import(`../../src/content/packs/${UNIT}.js`);
const mine = Object.keys(mod.default.skills);

/** [a, b, c] with a x + b y = c, normalised so two spellings of one line match. */
function lineOf(src) {
  const t = String(src);
  const at = t.indexOf('=');
  if (at < 0) return null;
  try {
    const L = parse(t.slice(0, at));
    const R = parse(t.slice(at + 1));
    const at0 = (n, x, y) => evalAst(n, { x, y });
    const num = (n) => { const v = at0(n, 0, 0); return typeof v === 'object' ? v.n / v.d : v; };
    const dx = (n) => { const a = at0(n, 1, 0), b = at0(n, 0, 0); const f = (v) => (typeof v === 'object' ? v.n / v.d : v); return f(a) - f(b); };
    const dy = (n) => { const a = at0(n, 0, 1), b = at0(n, 0, 0); const f = (v) => (typeof v === 'object' ? v.n / v.d : v); return f(a) - f(b); };
    const a = dx(L) - dx(R);
    const b = dy(L) - dy(R);
    const c = num(R) - num(L);
    if (![a, b, c].every(Number.isFinite)) return null;
    if (a === 0 && b === 0) return null;
    const s = Math.hypot(a, b) * (a !== 0 ? Math.sign(a) : Math.sign(b));
    return [a / s, b / s, c / s].map((v) => v.toFixed(9)).join('|');
  } catch { return null; }
}

const hits = new Map();
let items = 0;
for (const skill of SKILLS) {
  if (!mine.includes(skill)) continue;
  for (let d = 1; d <= 5; d++) {
    for (let s = 0; s < SEEDS; s++) {
      let it;
      try { it = generate(skill, d, s * 7919 + d * 131, { locale: 'en', strict: true, record: false }); } catch { continue; }
      items++;
      const src = process.argv.includes('--pool') ? (it.diagnostics || []) : (it.distractors || []);
      const opts = [{ v: String(it.answer), key: true }, ...src.map((dd) => ({ v: String(dd.value), m: dd.misconception }))];
      const vals = opts.map((o) => ({ ...o, L: lineOf(o.v) }));
      for (let i = 0; i < vals.length; i++) {
        for (let j = i + 1; j < vals.length; j++) {
          const a = vals[i], b = vals[j];
          if (!a.L || !b.L || a.L !== b.L) continue;
          const tag = `${skill}/${it.form}: ${a.key ? 'KEY' : a.m} "${a.v}" is the same line as ${b.key ? 'KEY' : b.m} "${b.v}"`;
          hits.set(tag, (hits.get(tag) || 0) + 1);
        }
      }
    }
  }
}
console.log(`${items} items`);
const rows = [...hits.entries()].sort((x, y) => y[1] - x[1]);
for (const [k, n] of rows.slice(0, 25)) console.log(`  x${String(n).padStart(4)}  ${k}`);
console.log(rows.length ? `FAIL — ${rows.length} distinct duplicate-line pairs` : 'PASS — no option set shows one line twice');
