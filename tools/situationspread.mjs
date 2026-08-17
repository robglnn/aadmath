/**
 * WHAT A CADET ACTUALLY MET, COUNTED THE WAY A CADET COUNTS IT.
 *
 * Two cold critics in a row wrote down the same number: "8 of 14 items were two
 * templates", "6 of 14 were substitute-a-value", "the drop-pod sentence served 8
 * times in 45". `tools/validate-items.mjs` gates the SHAPE and the ACT of a
 * session. Neither of them counts the SENTENCE — the situation a learner reads
 * before the mathematics — and the sentence is what the critic was counting.
 *
 * So this drives the real MasteryEngine through whole sessions, generates the
 * real item at every step, and reports three distributions:
 *
 *   ACT        what the learner physically does
 *   SKELETON   the notation it is dressed in
 *   SITUATION  the ctx.* sentence it is wrapped in
 *
 * plus, per deck, how many distinct situations the bank holds against how many
 * one run of sessions actually demanded — which is the number that says whether
 * a deck is wide enough to deal without repeating.
 *
 *   node tools/situationspread.mjs [--sessions 24] [--items 20]
 */
import { generate, FORMS_BY_SKILL, resetSituations, situationsServed, skeletonOf, actOf, DECK_SCENES } from '../src/learn/generators.js';
import { MasteryEngine } from '../src/learn/mastery.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './_courses.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const SESSIONS = arg('sessions', 24);
const ITEMS = arg('items', 20);
const ABILITIES = [0.45, 0.55, 0.65, 0.78, 0.85, 0.92];

const graph = JSON.parse(await readFile(path.join(ROOT, 'content/graph/algebra1-l1.json'), 'utf8'));

const rand = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const top = (m, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

const actAll = new Map(), skelAll = new Map(), sceneAll = new Map();
const worst = { act: 0, actName: '', skel: 0, skelName: '', scene: 0, sceneName: '' };
let items = 0;

for (let s = 0; s < SESSIONS; s++) {
  const acc = ABILITIES[s % ABILITIES.length];
  const rnd = rand((s * 2654435761 + 12345) >>> 0);
  const engine = new MasteryEngine(graph);
  resetSituations();
  const act1 = new Map(), skel1 = new Map(), scene1 = new Map();
  for (let i = 0; i < ITEMS; i++) {
    const objective = engine.next();
    if (!objective) break;
    const task = engine.taskFor(objective.id);
    if (!task) break;
    const pool = task.formCandidates || [];
    const forms = FORMS_BY_SKILL[task.skill] || [];
    const formId = pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
    const summary = forms.find((f) => f.id === formId)
      || forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax)[0] || forms[0];
    if (!summary) break;
    const item = generate(task.skill, task.difficulty, Math.floor(rnd() * 1e9), { form: summary.id });
    items++;
    const a = summary.act || actOf(summary, task.skill);
    const k = summary.skeleton || skeletonOf(summary);
    bump(actAll, a); bump(act1, a);
    bump(skelAll, k); bump(skel1, k);
    for (const key of String(item?.scene || '').split('+').filter(Boolean)) { bump(sceneAll, key); bump(scene1, key); }
    engine.observe(task.skill, rnd() < acc, {
      assisted: task.scaffold !== 'none', form: summary.id, rep: summary.rep,
      scene: item?.scene || '', kind: task.kind,
    });
  }
  for (const [k, v] of act1) if (v > worst.act) { worst.act = v; worst.actName = k; }
  for (const [k, v] of skel1) if (v > worst.skel) { worst.skel = v; worst.skelName = k; }
  for (const [k, v] of scene1) if (v > worst.scene) { worst.scene = v; worst.sceneName = k; }
}

const pct = (n) => `${((n / items) * 100).toFixed(1)}%`;
console.log(`${SESSIONS} sessions x ${ITEMS} items = ${items} items generated\n`);
console.log(`worst single session: act "${worst.actName}" ${worst.act}/${ITEMS}`
  + ` · skeleton "${worst.skelName}" ${worst.skel}/${ITEMS}`
  + ` · situation "${worst.sceneName}" ${worst.scene}/${ITEMS}`);
console.log(`\ndistinct across the run: ${actAll.size} acts, ${skelAll.size} skeletons, ${sceneAll.size} situations`);
console.log('\ntop acts:');
for (const [k, v] of top(actAll)) console.log(`  ${k.padEnd(34)} ${String(v).padStart(4)}  ${pct(v)}`);
console.log('\ntop skeletons:');
for (const [k, v] of top(skelAll)) console.log(`  ${k.padEnd(34)} ${String(v).padStart(4)}  ${pct(v)}`);
console.log('\ntop situations:');
for (const [k, v] of top(sceneAll, 12)) console.log(`  ${k.padEnd(34)} ${String(v).padStart(4)}  ${pct(v)}`);

console.log('\nper deck — situations held vs situations the run demanded:');
const rows = [];
for (const [name, keys] of Object.entries(DECK_SCENES)) {
  const used = keys.filter((k) => sceneAll.has(k));
  const draws = used.reduce((n, k) => n + sceneAll.get(k), 0);
  if (!draws) continue;
  rows.push([name, keys.length, used.length, draws, (draws / keys.length)]);
}
rows.sort((a, b) => b[4] - a[4]);
console.log(`  ${'deck'.padEnd(16)} ${'held'.padStart(5)} ${'seen'.padStart(5)} ${'draws'.padStart(6)} ${'draws/held'.padStart(11)}`);
for (const [n, held, seen, draws, load] of rows) {
  console.log(`  ${n.padEnd(16)} ${String(held).padStart(5)} ${String(seen).padStart(5)} ${String(draws).padStart(6)} ${load.toFixed(2).padStart(11)}`);
}
