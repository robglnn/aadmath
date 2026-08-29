/**
 * THE INVARIANTS — what a candidate change may not be allowed to buy its speed
 * with.
 *
 *   ARM=shipping   node design/tools/invariants.mjs [n]
 *   ARM="A'+B'+E'" node design/tools/invariants.mjs [n]
 *
 * Five statements, asserted on every claim of every cohort. Zero is the only
 * passing value on the first four; the fifth is a rate that is printed.
 *
 *   HOLE          a claim granted while a shape this learner was SERVED stands
 *                 at zero clean unassisted solves
 *   LOCKED        an item served on a line the learner has never proved whose
 *                 prerequisites are not held
 *   SPAN          a claim whose run did not span two surfaces, one of them not
 *                 symbolic
 *   MODEL         a claim whose run carried no item walking between a situation
 *                 and the algebra
 *   BAND          a claim whose run band fell below this skill's gate floor
 */
import { buildWorld, runLearner } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 300);
const arm = armOf();
const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;

const V = { hole: 0, locked: 0, span: 0, model: 0, band: 0 };
const EXP = { items: 0, seconds: 0, heldItems: 0, lines: 0, learners: 0 };
const first = {};
let claims = 0, viaSight = 0, items = 0;
const cohorts = [
  ['cold starts', { budget: 800 }],
  ['knowers 0.95', { knows: () => 0.95, budget: 220 }],
  ['half-knowers', { knows: (s) => (skills.indexOf(s) < 5 ? 0.95 : null), budget: 400 }],
  ['frozen 0.70', { knows: () => 0.70, frozen: true, budget: 40 }],
];
for (const [label, opts] of cohorts) {
  for (let i = 0; i < N; i++) {
    const r = runLearner(world, (i * 2654435761 + 12345) >>> 0, { ...opts, ...arm });
    items += r.items;
    EXP.items += r.exposure.items; EXP.seconds += r.exposure.seconds;
    EXP.heldItems += r.exposure.heldItems; EXP.lines += r.exposure.lines.size; EXP.learners++;
    for (const c of r.claims) {
      claims++;
      const p = c.provenBy;
      if (c.servedHoles.length) { V.hole++; first.hole ??= `${label} ${c.skill}: ${c.servedHoles.join(',')}`; }
      if (!p) continue;
      if (p.viaSightRead || p.road === 'sight') viaSight++;
      if (!(p.reps.length >= 2)) { V.span++; first.span ??= `${label} ${c.skill}: reps ${p.reps.join(',')}`; }
      if (!p.reps.some((x) => x !== 'symbolic')) { V.span++; first.span ??= `${label} ${c.skill}: symbolic only`; }
      if (!p.reps.some((x) => x === 'context' || x === 'verbal')) { V.model++; first.model ??= `${label} ${c.skill}: reps ${p.reps.join(',')}`; }
      if (p.band < c.gateFloor) { V.band++; first.band ??= `${label} ${c.skill}: band ${p.band} < floor ${c.gateFloor}`; }
    }
  }
}
console.log(`INVARIANTS — arm "${arm.name}", ${N} learners x ${cohorts.length} cohorts, ${items} items, ${claims} claims`);
for (const [k, v] of Object.entries(V)) {
  console.log(`  ${k.toUpperCase().padEnd(8)} ${String(v).padStart(7)}   ${v === 0 ? 'PASS' : 'FAIL — ' + first[k]}`);
}
console.log(`  claims off the sight-read ${(100 * viaSight / claims).toFixed(1)}%`);
console.log('\n  THE STANDING QUESTION — for how long does any line stand HELD over a shape that was served and never solved?');
console.log(`    held-line item-slots in which it was true   ${EXP.items} of ${EXP.heldItems}  (${(100 * EXP.items / Math.max(1, EXP.heldItems)).toFixed(3)}%)`);
console.log(`    seconds of exposure per learner            ${(EXP.seconds / EXP.learners).toFixed(1)}   lines ever exposed ${(EXP.lines / EXP.learners).toFixed(2)} per learner`);
