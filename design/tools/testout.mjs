/**
 * TEST-OUT — how long does a learner who already knows this spend proving it?
 *
 *   node design/tools/testout.mjs [n]
 *   CFG=gateMissCost=1,holeSpacing=3 node design/tools/testout.mjs 400
 *
 * Two clocks are printed for every figure and they are not the same number:
 *
 *   CONTACT   seconds of items served ON that skill until the claim. This is
 *             what tools/simulate.mjs reports and what every published test-out
 *             figure in this project has meant.
 *   ELAPSED   wall clock from the first item on that skill to the claim. The
 *             router interleaves, so a skill can be opened, left for four items
 *             on something else, and come back — and the learner sitting in the
 *             chair is watching the second clock, not the first.
 */
import { buildWorld, runLearner, q, med, mean, wilson } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 400);
const arm = armOf();
const cfg = arm.cfg;

const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;

console.log(`TEST-OUT — ${N} learners at hidden competence 0.95, real engine, real bank`);
console.log(`  lattice ${skills.length} skills   feedback rate ${(100 * world.feedbackRate).toFixed(1)}%${world.feedbackPinned ? ' (pinned)' : ''}   arm "${arm.name}" cfg ${JSON.stringify(cfg)}`);

const contact = [], elapsed = [], its = [];
const bySkill = new Map(skills.map((s) => [s, { c: [], e: [], i: [] }]));
const byOrder = new Map();   // how many skills this learner had already cleared
let all = 0;
const whole = [];
for (let i = 0; i < N; i++) {
  const r = runLearner(world, (i * 2654435761 + 12345) >>> 0, {
    knows: () => 0.95, budget: 220, ...arm, cfg,
  });
  const order = [...r.cleared.entries()].sort((a, b) => a[1].at - b[1].at);
  order.forEach(([s, c], idx) => {
    contact.push(c.contact / 60); elapsed.push(c.elapsed / 60); its.push(c.items);
    const b = bySkill.get(s); b.c.push(c.contact / 60); b.e.push(c.elapsed / 60); b.i.push(c.items);
    const o = byOrder.get(idx) || { c: [], i: [] };
    o.c.push(c.contact / 60); o.i.push(c.items);
    byOrder.set(idx, o);
  });
  if (order.length === skills.length) { all++; whole.push(order[order.length - 1][1].runElapsed / 60); }
}

const line = (label, xs) => console.log(`  ${label.padEnd(26)} median ${med(xs).toFixed(1).padStart(5)}  p75 ${q(xs, 0.75).toFixed(1).padStart(5)}  p90 ${q(xs, 0.9).toFixed(1).padStart(5)}  p95 ${q(xs, 0.95).toFixed(1).padStart(5)}  p99 ${q(xs, 0.99).toFixed(1).padStart(5)}  max ${Math.max(...xs).toFixed(1).padStart(5)}  mean ${mean(xs).toFixed(1)}`);

console.log(`\n  ${contact.length} clears`);
line('minutes CONTACT', contact);
line('minutes ELAPSED', elapsed);
line('items', its);
const pc = (x) => `${(100 * x).toFixed(1)}%`;
console.log(`  cleared in 3 items ${pc(its.filter((x) => x <= 3).length / its.length)}   contact <= 2 min ${pc(contact.filter((x) => x <= 2).length / contact.length)}   <= 4 min ${pc(contact.filter((x) => x <= 4).length / contact.length)}`);
console.log(`  proved the whole level ${pc(all / N)}, ${med(whole).toFixed(0)} min median wall clock`);

console.log('\n  by skill                n   contact med / p75 / p90     elapsed med / p90    items med   share of minutes above the global p75');
const cut = q(contact, 0.75);
let tailTotal = 0;
const tailBy = new Map();
for (const s of skills) {
  const b = bySkill.get(s);
  const over = b.c.filter((x) => x > cut);
  tailBy.set(s, over.reduce((a, x) => a + x, 0));
  tailTotal += tailBy.get(s);
}
for (const s of skills) {
  const b = bySkill.get(s);
  console.log(`    ${s.padEnd(14)} ${String(b.c.length).padStart(5)}   ${med(b.c).toFixed(1).padStart(5)} ${q(b.c, 0.75).toFixed(1).padStart(6)} ${q(b.c, 0.9).toFixed(1).padStart(6)}      ${med(b.e).toFixed(1).padStart(5)} ${q(b.e, 0.9).toFixed(1).padStart(6)}       ${med(b.i).toFixed(0).padStart(3)}        ${(100 * tailBy.get(s) / tailTotal).toFixed(1).padStart(5)}%`);
}

console.log('\n  by position in the run (how many skills this learner had already cleared)');
console.log('    nth skill    n   contact med / p90   items med / p90');
for (const [idx, o] of [...byOrder].sort((a, b) => a[0] - b[0])) {
  console.log(`      ${String(idx + 1).padStart(2)}      ${String(o.c.length).padStart(5)}   ${med(o.c).toFixed(1).padStart(5)} ${q(o.c, 0.9).toFixed(1).padStart(7)}      ${med(o.i).toFixed(0).padStart(4)} ${q(o.i, 0.9).toFixed(0).padStart(6)}`);
}

// The client's sentence, scored as a proportion rather than as a quantile.
const within = (xs, m) => { const k = xs.filter((x) => x <= m).length; const [lo, hi] = wilson(k, xs.length); return `${(100 * k / xs.length).toFixed(1)}%  [${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}]`; };
console.log('\n  share of test-outs finished inside a stated budget (contact minutes, 95% Wilson)');
for (const m of [2, 3, 5, 8, 10, 15, 25]) console.log(`    <= ${String(m).padStart(2)} min   ${within(contact, m)}`);
