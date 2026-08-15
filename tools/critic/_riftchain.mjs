/**
 * Repro of the reported session: a player stands at ONE rift and chains.
 * This is the code path main.js:openRift actually runs — taskFor(rift.id),
 * random form out of formCandidates, observe — with NO use of next().
 */
import fs from 'node:fs';
import { MasteryEngine } from '../../src/learn/mastery.js';
import { safeGenerate } from '../../src/learn/generators.js';

const graph = JSON.parse(fs.readFileSync(new URL('../../content/graph/algebra1-l1.json', import.meta.url), 'utf8'));
const m = new MasteryEngine(graph);
let t = Date.now();
m.setClock(() => t);

const RIFT = process.argv[2] || 'var-meaning';
const N = Number(process.argv[3] || 12);
const rows = [];
for (let i = 0; i < N; i++) {
  const task = m.taskFor(RIFT);
  if (!task) break;
  const pool = task.formCandidates || [];
  const form = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
  let item;
  try {
    item = safeGenerate(task.skill, task.difficulty, (Math.random() * 1e9) | 0, {
      locale: 'en', form, reps: task.reps || undefined, avoidScenes: task.avoidScenes || undefined,
    });
  } catch { break; }
  const st = m.state.get(task.skill);
  rows.push({
    i: i + 1, skill: task.skill, kind: task.kind, d: task.difficulty,
    form: item.form, rep: item.rep, masteredBefore: !!st.mastered,
    prompt: (item.prompt || item.stem || item.tex || '').slice(0, 60),
  });
  m.observe(task.skill, true, {
    assisted: task.scaffold !== 'none', form: item.form, rep: item.rep, scene: item.scene, kind: task.kind,
  });
  t += 30000;
}
const served = {};
for (const r of rows) served[r.skill] = (served[r.skill] || 0) + 1;
const shapes = {};
for (const r of rows) shapes[r.form] = (shapes[r.form] || 0) + 1;
console.log(rows.map((r) => `${String(r.i).padStart(2)}  ${r.skill.padEnd(12)} ${String(r.kind).padEnd(8)} b${r.d} ${String(r.form).padEnd(12)} ${r.rep.padEnd(9)} ${r.masteredBefore ? 'MASTERED' : ''}  ${r.prompt}`).join('\n'));
console.log('\nskills served:', JSON.stringify(served));
console.log('shapes:', JSON.stringify(shapes));
console.log('items on already-mastered:', rows.filter((r) => r.masteredBefore).length, '/', rows.length);
const s = m.state.get(RIFT);
console.log('state:', JSON.stringify({ attempts: s.attempts, correct: s.correct, mastered: s.mastered, soundings: s.soundings }));
