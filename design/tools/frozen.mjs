/**
 * THE GATE AS A CLASSIFIER.
 *
 *   node design/tools/frozen.mjs [n]
 *   CFG=gateMissCost=1 node design/tools/frozen.mjs 800
 *   NODES=1 node design/tools/frozen.mjs 300      # every node, not only the root
 *
 * A learner frozen at a known hidden competence neither learns nor forgets, so
 * the only thing that moves is the gate. Given a student who genuinely sits at
 * 0.70, how often does this engine hand them a mastery claim, and how fast?
 *
 * TWO THINGS THIS PRINTS THAT THE SHIPPING TABLE DOES NOT
 *
 *   · a 95% Wilson interval on every rate. The shipping table is 200 learners a
 *     row, which is +/- 6 points at the middle of the scale, and several of the
 *     decisions written into src/learn/mastery.js were argued from differences
 *     smaller than that.
 *   · the same rows on EVERY node rather than only on the root. The shipping
 *     table reads the first skill each frozen learner meets, and with a cleared
 *     save that is always `var-meaning` — the shallowest skill in the level. A
 *     table about one node is not a table about the gate.
 */
import { buildWorld, runLearner, wilson } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 400);
const LEVELS = (process.env.LEVELS || '0.50,0.60,0.70,0.75,0.80,0.90,0.95').split(',').map(Number);
const arm = armOf();
const cfg = arm.cfg;

const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;

function row(c, unlock) {
  let seen = 0, three = 0, six = 0, ever = 0, inTime = 0, mins = [];
  for (let i = 0; i < N; i++) {
    const r = runLearner(world, (i * 2654435761 + 12345) >>> 0, {
      knows: () => c, frozen: true, budget: 40, ...arm, cfg, unlock,
    });
    const target = unlock || skills.find((s) => r.spent.get(s).items > 0);
    if (!target || !r.spent.get(target).items) continue;
    seen++;
    const cl = r.cleared.get(target);
    if (!cl) continue;
    ever++;
    if (cl.items <= 3) three++;
    if (cl.items <= 6) six++;
    if (cl.runElapsed <= 25 * 60) inTime++;
    mins.push(cl.contact / 60);
  }
  return { seen, three, six, ever, inTime, mins };
}

const fmt = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return `${(100 * k / n).toFixed(1).padStart(5)}% [${(100 * lo).toFixed(1).padStart(4)}–${(100 * hi).toFixed(1).padStart(5)}]`;
};

console.log(`THE GATE AS A CLASSIFIER — ${N} frozen learners per cell, 40 items each, 95% Wilson`);
console.log(`  arm "${arm.name}"   cfg ${JSON.stringify(cfg)}`);
console.log('\n  root node (a cleared save opens exactly one skill, so this is the shipping table)');
console.log('  true k    cleared in <= 3 items      in <= 6 items          ever (40 items)        inside 25 real min');
for (const c of LEVELS) {
  const r = row(c, null);
  console.log(`   ${c.toFixed(2)}    ${fmt(r.three, r.seen)}   ${fmt(r.six, r.seen)}   ${fmt(r.ever, r.seen)}   ${fmt(r.inTime, r.seen)}${c < 0.75 ? '  <- must stay low' : ''}`);
}

if (process.env.NODES) {
  console.log('\n  every node — the rest of the lattice is marked held and never due, so the router has one thing to serve');
  console.log('  node             ' + LEVELS.map((c) => `k=${c.toFixed(2)}`).join('   ') + '     (ever, inside 40 items)');
  for (const s of skills) {
    const cells = LEVELS.map((c) => { const r = row(c, s); return `${(100 * r.ever / Math.max(1, r.seen)).toFixed(1).padStart(6)}%`; });
    console.log(`  ${s.padEnd(14)} ` + cells.join('  '));
  }
}
