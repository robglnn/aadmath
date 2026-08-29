/**
 * CLAIMS GRANTED AND THEN TAKEN AWAY.
 *
 *   ARM=shipping node design/tools/churn.mjs [n]
 *
 * `observe` can withdraw a claim for two reasons and reports both on the same
 * field: a missed cold re-probe that was already lapsing, and — the one nothing
 * counts — a shape that goes NEVER ONCE SOLVED on a line that was proved
 * honestly last week. The second is a correct rule with a consequence nobody has
 * measured: the endgame descent and the spaced re-probe both deliberately serve
 * forms this learner has never worked in, at the top of the bank, ON A HELD
 * LINE. A single miss there opens a hole, and a hole withdraws the claim.
 *
 * A progress screen that flips a line from HELD back to open is the most
 * expensive thing this product can do to a student's trust in it, so the rate
 * is measured here rather than argued about.
 */
import { buildWorld, runLearner, mean, q } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 300);
const arm = armOf();
const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;

const cohorts = [
  ['knower, one sitting (0.95, 220 items)', { knows: () => 0.95, budget: 220 }],
  ['cold start, one sitting (800 items)', { budget: 800 }],
  ['cold start, 25 daily 22-min sittings', { budget: 6000, sessions: 25, sessionMinutes: 22, gapHours: 24 }],
];
console.log(`CLAIMS WITHDRAWN — arm "${arm.name}", ${N} learners per cohort`);
for (const [label, opts] of cohorts) {
  const per = [], byWhy = new Map(), byKind = new Map(), byBand = new Map();
  let claims = 0, anyW = 0;
  for (let i = 0; i < N; i++) {
    const r = runLearner(world, (i * 2654435761 + 12345) >>> 0, { ...opts, ...arm });
    per.push(r.withdrawn.length);
    claims += r.claims.length;
    if (r.withdrawn.length) anyW++;
    for (const w of r.withdrawn) {
      byWhy.set(w.why, (byWhy.get(w.why) || 0) + 1);
      byKind.set(`${w.why}/${w.kind}`, (byKind.get(`${w.why}/${w.kind}`) || 0) + 1);
      byBand.set(w.band, (byBand.get(w.band) || 0) + 1);
    }
  }
  const tot = per.reduce((a, b) => a + b, 0);
  console.log(`\n  ${label}`);
  console.log(`    claims granted ${(claims / N).toFixed(2)} per learner;  withdrawn ${(tot / N).toFixed(2)} per learner  (${(100 * tot / Math.max(1, claims)).toFixed(1)}% of claims)`);
  console.log(`    learners who saw at least one line go from HELD back to open: ${(100 * anyW / N).toFixed(1)}%   worst learner ${Math.max(...per)}  p90 ${q(per, 0.9)}`);
  for (const [k, v] of [...byWhy].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(k).padEnd(12)} ${String(v).padStart(6)}  ${(100 * v / Math.max(1, tot)).toFixed(1)}%`);
  }
  console.log('      by the item that did it: ' + [...byKind].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  '));
  console.log('      by band: ' + [...byBand].sort((a, b) => a[0] - b[0]).map(([k, v]) => `d${k}:${v}`).join('  '));
}
