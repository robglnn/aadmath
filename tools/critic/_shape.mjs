/** What a learner actually meets, at every grain, over simulated sessions. */
import { MasteryEngine } from '../../src/learn/mastery.js';
import { FORMS_BY_SKILL, resetSituations } from '../../src/learn/generators.js';
import { readFileSync } from 'node:fs';

const graph = JSON.parse(readFileSync(new URL('../../content/graph/algebra1-l1.json', import.meta.url), 'utf8'));
const ITEMS = Number(process.argv[2] || 20);
const SESSIONS = Number(process.argv[3] || 5);
const ABILITIES = [0.45, 0.55, 0.65, 0.78, 0.92];

const rand = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const byId = new Map();
for (const [sk, forms] of Object.entries(FORMS_BY_SKILL)) for (const f of forms) byId.set(`${sk}/${f.id}`, f);

for (let s = 0; s < SESSIONS; s++) {
  const acc = ABILITIES[s % ABILITIES.length];
  const rnd = rand((s * 2654435761 + 12345) >>> 0);
  const engine = new MasteryEngine(graph);
  resetSituations();
  const seq = [];
  for (let i = 0; i < ITEMS; i++) {
    const o = engine.next(); if (!o) break;
    const task = engine.taskFor(o.id); if (!task) break;
    const pool = task.formCandidates || [];
    const formId = pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
    const forms = FORMS_BY_SKILL[task.skill] || [];
    const form = forms.find((f) => f.id === formId)
      || forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax)[0] || forms[0];
    if (!form) break;
    seq.push({ skill: task.skill, form: form.id, rep: form.rep, skel: form.skeleton, act: form.act, d: task.difficulty, kind: task.kind });
    engine.observe(task.skill, rnd() < acc, { assisted: task.scaffold !== 'none', form: form.id, rep: form.rep, scene: (form.sceneKeys || [])[0] || '', kind: task.kind });
  }
  console.log(`\n=== session ${s} acc ${acc} — ${seq.length} items`);
  seq.forEach((x, i) => console.log(`  ${String(i + 1).padStart(2)} ${x.skill.padEnd(14)} d${x.d} ${String(x.kind).padEnd(7)} ${String(x.rep).padEnd(9)} ${String(x.form).padEnd(20)} ${x.skel}`));
  const grain = (f) => ({
    act: (x) => x.act,
    skeleton: (x) => x.skel,
    'skill+rep': (x) => x.skill + '/' + x.rep,
    rep: (x) => x.rep,
    form: (x) => x.form,
  })[f];
  for (const g of ['act', 'skeleton', 'form', 'rep']) {
    const c = new Map();
    for (const x of seq) { const k = grain(g)(x); c.set(k, (c.get(k) || 0) + 1); }
    const top = [...c.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`  ${g.padEnd(10)} ${c.size} distinct | worst ${top[0][1]}/${seq.length} = ${top[0][0]}` +
      `  [${top.slice(0, 4).map(([k, v]) => k + '×' + v).join('  ')}]`);
  }
}
