/** What characters do the keys the banks ship actually need? */
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { registerPack } from '../../src/content/registry.js';
import l2 from '../../src/content/packs/algebra1-l2.js';
import l3 from '../../src/content/packs/algebra1-l3.js';
import l4 from '../../src/content/packs/algebra1-l4.js';
import l5 from '../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);

const CLEAN = (s) => String(s).replace(/\\left|\\right/g, '').replace(/\\[,;:!]/g, ' ').replace(/\\cdot/g, '*');
function route(item) {
  if (item.type === 'special' || item.check?.kind === 'equationChoice' || (item.latex && /\\square/.test(item.latex))) return 'choice';
  if (item.figure?.kind === 'plot') return 'plot';
  if (item.figure?.kind === 'balance' || item.check?.kind === 'solve') return 'balance';
  if (item.figure?.kind === 'area' || item.skill === 'distribute') return 'area';
  if (item.type === 'expression') {
    const src = CLEAN(item.check?.math || item.latex);
    const vm = src.match(/[a-zA-Z]/);
    if (vm && !/[\\^*()=]/.test(src)) return 'sort';
    return 'keypad';
  }
  return 'keypad';
}
const N = Number(process.argv[2] || 4);
const toks = new Map();
const perForm = new Map();
for (const skill of SKILLS) for (const f of FORMS_BY_SKILL[skill]) for (let d = f.dMin; d <= f.dMax; d++) for (let s = 0; s < N; s++) {
  let it = null;
  try { it = safeGenerate(skill, d, 5000 + s * 7919 + d * 13, { locale: 'en', form: f.id, record: false }); } catch { continue; }
  if (it.form !== f.id) continue;
  const r = route(it);
  if (r !== 'keypad') continue;
  const a = String(it.answer);
  const sig = a.replace(/\d+/g, '#').replace(/[a-zA-Z](?![a-zA-Z])/g, (m) => (/\\/.test(a.slice(Math.max(0,a.indexOf(m)-1), a.indexOf(m))) ? m : 'V'));
  for (const m of a.match(/\\[a-zA-Z]+|[^\sa-zA-Z0-9]/g) || []) toks.set(m, (toks.get(m) || 0) + 1);
  const k = `${skill}/${f.id}`;
  const p = perForm.get(k) || new Set();
  if (p.size < 3) p.add(a);
  perForm.set(k, p);
}
console.log('--- non-alphanumeric tokens in keypad-routed keys, by frequency');
for (const [k, n] of [...toks].sort((a,b)=>b[1]-a[1])) console.log(`${String(n).padStart(5)}  ${JSON.stringify(k)}`);
console.log('\n--- sample keys per keypad-routed form');
for (const [k, set] of [...perForm].sort()) console.log(`${k.padEnd(34)} ${[...set].join('   |   ')}`);
