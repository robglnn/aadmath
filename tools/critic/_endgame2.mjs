/** The endgame: every line held, nothing due. Does the descent still walk the
 *  shard, and can any one held line be asked more than its budget? */
import fs from 'node:fs';
import { MasteryEngine } from '../../src/learn/mastery.js';
import { safeGenerate } from '../../src/learn/generators.js';

const graph = JSON.parse(fs.readFileSync(new URL('../../content/graph/algebra1-l1.json', import.meta.url), 'utf8'));
const m = new MasteryEngine(graph);
let t = Date.now();
m.setClock(() => t);
// Force the endgame the honest way is expensive; force it directly.
for (const s of m.state.values()) {
  s.mastered = true; s.everMastered = true; s.placed = true; s.pL = 0.99;
  s.difficulty = 5; s.masteredTime = t; s.provedTime = t;
  s.dueTime = t + 10 * 60000; s.dueAt = 99999; s.probe = null;
}
const RIFT = process.argv[2] || 'var-meaning';
const rows = [];
for (let i = 0; i < 24; i++) {
  const task = m.taskFor(RIFT);
  if (!task) { rows.push({ skill: null }); break; }
  const pool = task.formCandidates || [];
  const form = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
  let item;
  try { item = safeGenerate(task.skill, task.difficulty, (Math.random() * 1e9) | 0, { locale: 'en', form }); }
  catch { break; }
  rows.push({ skill: task.skill, kind: task.kind, form: item.form, labelled: !!task.reprobe });
  m.observe(task.skill, true, { form: item.form, rep: item.rep, scene: item.scene, kind: task.kind });
  t += 30000;
}
const per = {}; for (const r of rows) per[r.skill] = (per[r.skill] || 0) + 1;
const shapes = {}; for (const r of rows) shapes[r.form] = (shapes[r.form] || 0) + 1;
let maxRun = 1, run = 1;
for (let i = 1; i < rows.length; i++) { run = rows[i].skill === rows[i - 1].skill ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
console.log(JSON.stringify({
  items: rows.length, distinctSkills: Object.keys(per).length, perSkill: per,
  worstSkill: Math.max(...Object.values(per)), longestSameSkillRun: maxRun,
  allLabelledAsReprobe: rows.every((r) => r.labelled),
  distinctShapes: Object.keys(shapes).length, mostCommonShape: Math.max(...Object.values(shapes)),
  soundingBest: m.sounding.best, heldItems: m.heldItems,
}, null, 2));
