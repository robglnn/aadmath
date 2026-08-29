/**
 * "No template may repeat inside a 20-item session."
 *
 * templatewalk.mjs walks the shipped Level 1 bank and has no unit flag, so this
 * asks the same question of Level 3: draw real 20-item sessions the way the
 * scheduler does — a mix of unlocked skills, resetting the situation ledger per
 * session — and count how often one SHAPE, one ACT and one SITUATION come back.
 */
import { generate, skeletonOf, actOf, resetSituations, FORMS_BY_SKILL } from '../src/learn/generators.js';
import { registerPack } from '../src/content/registry.js';
import pack from '../src/content/packs/algebra1-l3.js';
registerPack(pack);

const SKILLS = Object.keys(pack.skills);
const formById = new Map();
for (const sk of SKILLS) for (const f of pack.skills[sk]) formById.set(f.id, f);

const SESSIONS = 60, N = 20;
let worstShape = 0, worstAct = 0, worstScene = 0, adjacent = 0, worstWindow = 0;

for (let s = 0; s < SESSIONS; s++) {
  resetSituations();
  const shapes = [], acts = [], scenes = [];
  for (let i = 0; i < N; i++) {
    const skill = SKILLS[(s * 7 + i * 3) % SKILLS.length];
    const d = 1 + ((i + s) % 5);
    let it;
    try { it = generate(skill, d, s * 100003 + i * 7919, { locale: 'en' }); } catch { continue; }
    const f = formById.get(it.form);
    shapes.push(`${skill}:${skeletonOf(f)}`);
    acts.push(actOf(f, skill));
    if (it.scene) scenes.push(it.scene);
  }
  const top = (a) => { const m = new Map(); for (const x of a) m.set(x, (m.get(x) || 0) + 1); return Math.max(0, ...m.values()); };
  worstShape = Math.max(worstShape, top(shapes));
  worstAct = Math.max(worstAct, top(acts));
  worstScene = Math.max(worstScene, top(scenes));
  for (let i = 1; i < shapes.length; i++) if (shapes[i] === shapes[i - 1]) adjacent++;
  for (let i = 0; i + 6 <= shapes.length; i++) worstWindow = Math.max(worstWindow, top(shapes.slice(i, i + 6)));
}
console.log(`over ${SESSIONS} played sessions of ${N} items, Algebra I Level 3:`);
console.log(`  worst one SHAPE in a session      ${worstShape}/20`);
console.log(`  worst one ACT in a session        ${worstAct}/20`);
console.log(`  worst one SITUATION in a session  ${worstScene}/20`);
console.log(`  worst one shape in a 6-item window ${worstWindow}`);
console.log(`  back-to-back identical shapes      ${adjacent}  (must be 0)`);
