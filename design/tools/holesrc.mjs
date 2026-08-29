/**
 * WHERE HOLES COME FROM.
 *
 *   node design/tools/holesrc.mjs [n]
 *
 * A hole is a shape this learner has been served and has never once solved
 * unaided. This counts every hole a knower opens, by the item that opened it:
 * which scheduler kind served it, at which band, on which surface, and whether
 * the shape was one the learner had never met before.
 */
import { buildWorld, runLearner, q, med } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 400);
const arm = armOf();
const cfg = arm.cfg;
const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;

const byKind = new Map(), byBand = new Map(), byRep = new Map(), byForm = new Map();
let opened = 0, items = 0, clears = 0;
const kindItems = new Map();
for (let i = 0; i < N; i++) {
  runLearner(world, (i * 2654435761 + 12345) >>> 0, {
    knows: () => 0.95, budget: 220, ...arm, cfg,
    watch: (e) => {
      items++;
      kindItems.set(e.kind, (kindItems.get(e.kind) || 0) + 1);
      const fresh = e.holesAfter.filter((h) => !e.before.holes.includes(h));
      if (!fresh.length) return;
      opened += fresh.length;
      byKind.set(e.kind, (byKind.get(e.kind) || 0) + fresh.length);
      byBand.set(e.band, (byBand.get(e.band) || 0) + fresh.length);
      byRep.set(e.rep, (byRep.get(e.rep) || 0) + fresh.length);
      for (const f of fresh) byForm.set(f, (byForm.get(f) || 0) + 1);
    },
  });
}
console.log(`WHERE HOLES COME FROM — ${N} knowers at 0.95, ${items} items, ${opened} holes opened   arm "${arm.name}" cfg ${JSON.stringify(cfg)}`);
const show = (label, m, denom) => {
  console.log(`\n  by ${label}`);
  for (const [k, v] of [...m].sort((a, b) => b[1] - a[1])) {
    const d = denom ? denom.get(k) : null;
    console.log(`    ${String(k).padEnd(14)} ${String(v).padStart(6)}  ${(100 * v / opened).toFixed(1).padStart(5)}% of holes` + (d ? `   ${(v / d).toFixed(3)} per item served (${d} items)` : ''));
  }
};
show('scheduler kind', byKind, kindItems);
show('band', byBand);
show('surface', byRep);
console.log('\n  the ten shapes that most often go never-once-solved');
for (const [f, v] of [...byForm].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`    ${f.padEnd(16)} ${String(v).padStart(6)}  ${(100 * v / opened).toFixed(1)}%`);
}
