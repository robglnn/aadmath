/** How many duplicate-key distractors the new net removes from option sets. */
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
function oldDropped(item, v) {
  try { return equivalent(v, item.answer, item.check?.variable || 'x') === true; } catch { return false; }
}
const N = Number(process.argv[2] || 3);
let items = 0, dropped = 0;
const byForm = new Map();
for (const skill of SKILLS) for (const f of FORMS_BY_SKILL[skill]) for (let d = f.dMin; d <= f.dMax; d++) for (let s = 0; s < N; s++) {
  let it = null;
  try { it = safeGenerate(skill, d, 6000 + s * 7919 + d * 13, { locale: 'en', form: f.id, record: false }); } catch { continue; }
  if (it.form !== f.id) continue;
  items++;
  const v = it.check?.variable || (String(it.answer).replace(/\\[a-zA-Z]+/g, ' ').match(/[a-zA-Z]/) || [])[0] || 'x';
  for (const dd of it.distractors || []) {
    const val = String(dd.value ?? '');
    if (!val.trim() || norm(val) === norm(it.answer)) continue;
    const wasDropped = oldDropped(it, val);
    const nowDropped = C.sameAnswer(val, String(it.answer), v) === true;
    if (nowDropped && !wasDropped) {
      dropped++;
      const k = `${skill}/${f.id}`;
      const b = byForm.get(k) || { n: 0, ex: null };
      b.n++; if (!b.ex) b.ex = `${val}   ||key||   ${it.answer}`;
      byForm.set(k, b);
    }
  }
}
for (const [k, b] of [...byForm].sort((a, b2) => b2[1].n - a[1].n)) console.log(String(b.n).padStart(4), k.padEnd(34), b.ex);
console.log(`\n${dropped} duplicate-key distractors newly removed from option sets, over ${items} items`);
