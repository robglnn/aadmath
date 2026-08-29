import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { registerPack } from '../../src/content/registry.js';
import l2 from '../../src/content/packs/algebra1-l2.js';
import l3 from '../../src/content/packs/algebra1-l3.js';
import l4 from '../../src/content/packs/algebra1-l4.js';
import l5 from '../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);
import { parse, expandPm, evalSurd, splitTop, radicalInDenominator, radicandsOf, polynomialise, equivalent } from '../../src/learn/parser.js';
import { sCmp, isSquarefree } from '../../src/learn/surd.js';
import * as C from '/tmp/contract.mjs';

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
function variableOf(item) {
  return item.check?.variable
    || (String(item.answer ?? '').replace(/\\[a-zA-Z]+/g, ' ').match(/[a-zA-Z]/) || [])[0]
    || (CLEAN(item.latex || '').match(/[a-zA-Z]/) || [])[0] || 'x';
}
function taskKey(item) {
  if (item.type !== 'expression') return 'keypad';
  const ans = String(item.answer ?? '');
  if (/\\le(?![a-zA-Z])|\\ge(?![a-zA-Z])|[<>]/.test(ans)) return 'bound';
  if (/^\s*\\left\(/.test(ans) && ans.includes(',') && !ans.includes('=')) return 'point';
  if (ans.includes('=')) {
    const first = splitTop(ans, ',')[0];
    const rhs = first.slice(first.indexOf('=') + 1).replace(/\\[a-zA-Z]+/g, ' ');
    return /[a-zA-Z]/.test(rhs) ? 'rule' : 'roots';
  }
  const forms = C.demandsOf(item, variableOf(item));
  if (forms.includes('factored') || (forms.includes('openProduct') && C.inForm(String(item.answer ?? ''), 'factored', variableOf(item)) === true)) return 'factor';
  if (forms.includes('vertex')) return 'vertex';
  if (forms.includes('expanded')) return 'expand';
  if (forms.includes('simplest') || forms.includes('rootsSimplified')) return 'simplify';
  return 'keypadExpression';
}

const N = Number(process.argv[2] || 3);
const tasks = new Map(); const glyphs = new Map(); let maxLen = 0, maxKey = '';
const demandTally = new Map();
for (const skill of SKILLS) for (const f of FORMS_BY_SKILL[skill]) for (let d = f.dMin; d <= f.dMax; d++) for (let s = 0; s < N; s++) {
  let it = null;
  try { it = safeGenerate(skill, d, 5000 + s * 7919 + d * 13, { locale: 'en', form: f.id, record: false }); } catch { continue; }
  if (it.form !== f.id) continue;
  if (route(it) !== 'keypad') continue;
  const tk = taskKey(it);
  const b = tasks.get(tk) || { n: 0, ex: [] };
  b.n++; (b.forms ||= new Set()).add(`${skill}/${f.id}`); if (b.ex.length < 3) b.ex.push(`${skill}/${f.id}:${it.answer}`);
  tasks.set(tk, b);
  const pad = C.toPad(String(it.answer));
  if (pad.length > maxLen) { maxLen = pad.length; maxKey = `${skill}/${f.id} ${it.answer} -> ${pad}`; }
  for (const g of C.padGlyphs(pad)) glyphs.set(g, (glyphs.get(g) || 0) + 1);
  for (const dm of C.demandsOf(it, variableOf(it))) demandTally.set(dm, (demandTally.get(dm) || 0) + 1);
}
console.log('--- keypad task keys');
for (const [k, b] of [...tasks].sort((a,b)=>b[1].n-a[1].n)) console.log(String(b.n).padStart(5), k.padEnd(18), [...b.forms].join(' ').slice(0,900));
console.log('\n--- glyphs used by keypad-routed KEYS');
for (const [g, n] of [...glyphs].sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(5), JSON.stringify(g));
console.log('\n--- demands derived');
for (const [g, n] of [...demandTally].sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(5), g);
console.log('\nlongest pad spelling:', maxLen, maxKey);
