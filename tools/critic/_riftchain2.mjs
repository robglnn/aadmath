/**
 * The rift-chain path (src/main.js openRift -> chainNext -> same rift), driven
 * against a learner of a known hidden competence, for a fixed number of REAL
 * minutes off the engine's own cost model. Reports what the critic reported:
 * distinct skills, items on already-held lines, and the shape distribution.
 */
import fs from 'node:fs';
import { MasteryEngine, itemSeconds } from '../../src/learn/mastery.js';
import { safeGenerate, FORMS_BY_SKILL } from '../../src/learn/generators.js';

const graph = JSON.parse(fs.readFileSync(new URL('../../content/graph/algebra1-l1.json', import.meta.url), 'utf8'));
const COMP = Number(process.env.COMP ?? 0.97);
const MINUTES = Number(process.env.MINUTES ?? 12);
const RIFT = process.env.RIFT || 'var-meaning';
const SEED = Number(process.env.SEED ?? 1);
// stick=1 -> the player never walks away from the rift they opened, which is
// the behaviour the reported session had.
const STICK = process.env.STICK !== '0';

let z = SEED >>> 0 || 1;
const rnd = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296);

const m = new MasteryEngine(graph);
let t = Date.now();
m.setClock(() => t);

let rift = RIFT;
let seconds = 0;
const rows = [];
while (seconds < MINUTES * 60) {
  const task = m.taskFor(rift);
  if (!task) break;
  const pool = task.formCandidates || [];
  const form = pool.length ? pool[Math.floor(rnd() * pool.length)] : undefined;
  let item;
  try {
    item = safeGenerate(task.skill, task.difficulty, (rnd() * 1e9) | 0, {
      locale: 'en', form, reps: task.reps || undefined, avoidScenes: task.avoidScenes || undefined,
    });
  } catch { break; }
  const st = m.state.get(task.skill);
  const heldBefore = !!st.mastered;
  const assisted = task.scaffold !== 'none';
  // A harder item on a weaker learner fails more often; assistance helps.
  const pCorrect = Math.min(0.99, Math.max(0.02,
    COMP ** (0.6 + 0.28 * task.difficulty) + (assisted ? 0.2 : 0)));
  const correct = rnd() < pCorrect;
  rows.push({
    skill: task.skill, kind: task.kind, form: item.form, rep: item.rep,
    held: heldBefore, correct, divertedFrom: task.divertedFrom || null,
    reprobe: !!task.reprobe,
  });
  m.observe(task.skill, correct, {
    assisted, form: item.form, rep: item.rep, scene: item.scene, kind: task.kind,
  });
  const secs = itemSeconds({ rep: item.rep, difficulty: task.difficulty, scaffold: task.scaffold });
  seconds += secs;
  t += secs * 1000;
  // The chain: solve and the same rift opens again. Miss and the player has to
  // walk, which in the reported session they did not.
  if (!STICK && !correct) rift = task.skill;
  else rift = STICK ? RIFT : task.skill;
}

const count = (key) => rows.reduce((a, r) => { a[r[key]] = (a[r[key]] || 0) + 1; return a; }, {});
const skills = count('skill');
const shapes = count('form');
const held = rows.filter((r) => r.held).length;
const perSkillHeld = {};
for (const r of rows) if (r.held) perSkillHeld[r.skill] = (perSkillHeld[r.skill] || 0) + 1;
const mastered = [...m.state.values()].filter((s) => s.mastered).map((s) => s.id);
const shapeTop = Math.max(0, ...Object.values(shapes));

console.log(JSON.stringify({
  competence: COMP, minutes: MINUTES, stick: STICK, rift: RIFT,
  items: rows.length,
  distinctSkills: Object.keys(skills).length,
  skills,
  itemsOnHeldSkills: held,
  worstHeldSkill: Math.max(0, ...Object.values(perSkillHeld)),
  perSkillHeld,
  distinctShapes: Object.keys(shapes).length,
  mostCommonShape: shapeTop,
  mostCommonShapeShare: rows.length ? +(shapeTop / rows.length).toFixed(3) : 0,
  shapes,
  kinds: count('kind'),
  diverts: rows.filter((r) => r.divertedFrom).length,
  mastered,
  unmasteredUnlocked: m.unlockedSkills().filter((id) => !m.state.get(id).mastered),
}, null, 2));
