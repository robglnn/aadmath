import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { registerPack } from '../../src/content/registry.js';
import l2 from '../../src/content/packs/algebra1-l2.js';
import l3 from '../../src/content/packs/algebra1-l3.js';
import l4 from '../../src/content/packs/algebra1-l4.js';
import l5 from '../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);
const seen = new Map();
for (const skill of SKILLS) for (const f of FORMS_BY_SKILL[skill]) {
  let it = null;
  for (let d = f.dMin; d <= f.dMax && !it; d++) {
    try { it = safeGenerate(skill, d, 5000, { locale: 'en', form: f.id, record: false }); } catch {}
  }
  if (!it || it.form !== f.id) continue;
  const a = String(it.answer);
  if (/[=,]|\\pm|\\sqrt/.test(a)) {
    const k = `${it.type}/${it.check?.kind}`;
    const b = seen.get(k) || [];
    if (b.length < 3) b.push(`${skill}/${f.id}: ${a}`);
    seen.set(k, b);
  }
}
for (const [k, v] of [...seen].sort()) console.log(k.padEnd(28), v.join('  |  '));
