/**
 * THE ITEM-FORM AUDIT — is the picture doing any work?
 *
 * A cold critic counted: *"Six of eleven items are answerable without ever
 * looking at the figure… restate the whole computation in the prose above the
 * box."* That is a different defect from a wrong label. A figure whose every
 * quantity is already written in the sentence above it is not a second
 * representation, it is decoration — and it makes an item look like transfer
 * work when it is a one-surface item with a picture on it.
 *
 * So for every figure-bearing form in the bank this asks one mechanical
 * question: are ALL the numbers the drawing carries also printed in the prose?
 * If they are, a learner never has to look at the drawing. If at least one is
 * not, the drawing is load-bearing.
 *
 *   node tools/critic/_p0formaudit.mjs
 */
import { FORMS_BY_SKILL, generate } from '../../src/learn/generators.js';
import { FIGURE_KINDS } from '../check-figures.mjs';

/* A figure is either DRAWN — an SVG plate above the answer box, which a learner
   reads and could in principle ignore — or WORKED, which is the surface they
   actually manipulate (the balance beam, the area model, the coordinate plane).
   Only a drawn figure can be "decoration"; a worked one is the item. Counting
   them together was the first version of this audit and it was wrong in the
   flattering direction for the balance and in the harsh direction for nothing. */

const nums = (s) => new Set((String(s ?? '').replace(/\^\s*\{?-?\d+\}?/g, '').match(/-?\d+/g) || []));
const figNums = (fig) => {
  const out = new Set();
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'number') { out.add(String(v)); return; }
    if (typeof v === 'string') { for (const n of nums(v)) out.add(n); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { for (const [k, x] of Object.entries(v)) { if (k !== 'kind') walk(x); } }
  };
  walk(fig);
  return out;
};

const rows = [];
let boxy = 0, noDisp = 0, figForms = 0;
for (const [skill, forms] of Object.entries(FORMS_BY_SKILL)) {
  for (const f of forms) {
    let seen = 0, redundant = 0, bearing = 0, hasFig = 0, boxes = 0, nod = 0, worked = 0, drawn = 0;
    for (let d = f.dMin; d <= f.dMax; d++) {
      for (let s = 0; s < 6; s++) {
        let it; try { it = generate(skill, d, (s * 7919 + d * 131) >>> 0, { form: f.id, locale: 'en' }); } catch { continue; }
        seen++;
        if (it.noDisplay) nod++;
        boxes += ((it.latex || '').match(/\\square/g) || []).length > 1 ? 1 : 0;
        if (!it.figure) continue;
        hasFig++;
        if (FIGURE_KINDS[it.figure.kind] !== 'svg') { worked++; continue; }
        drawn++;
        const inProse = nums(`${it.stem} ${it.latex || ''}`);
        const need = [...figNums(it.figure)].filter((n) => Math.abs(Number(n)) > 1);
        if (need.length && need.every((n) => inProse.has(n))) redundant++; else bearing++;
      }
    }
    if (!seen) continue;
    if (boxes) boxy++;
    if (nod) noDisp++;
    if (hasFig) { figForms++; rows.push({ id: `${skill}/${f.id}`, rep: f.rep, kind: 'x', hasFig, worked, drawn, redundant, bearing }); }
  }
}
console.log('ASCENT — item-form audit');
console.log(`  ${figForms} figure-bearing forms; ${noDisp} forms declare no display; ${boxy} forms print a display of two or more empty boxes (must be 0)\n`);
console.log('  form                              rep        figures  worked  drawn  prose has every number  drawing load-bearing');
for (const r of rows.sort((a, b) => b.redundant - a.redundant)) {
  console.log(`  ${r.id.padEnd(33)} ${r.rep.padEnd(9)} ${String(r.hasFig).padStart(7)} ${String(r.worked).padStart(7)} ${String(r.drawn).padStart(6)} ${String(r.redundant).padStart(23)} ${String(r.bearing).padStart(21)}`);
}
const tot = rows.reduce((a, r) => a + r.drawn, 0);
const red = rows.reduce((a, r) => a + r.redundant, 0);
const wk = rows.reduce((a, r) => a + r.worked, 0);
console.log(`\n  ${wk} figure items are WORKED surfaces — the balance, the area model, the plane. The learner cannot ignore those.`);
console.log(`  ${red} of ${tot} DRAWN figures (${(100 * red / Math.max(1, tot)).toFixed(1)}%) print no number the prose has not already printed.`);
process.exit(boxy ? 1 : 0);
