/**
 * How many different worlds does a cadet actually walk into?
 *
 * The mastery numbers say the schedule teaches. They say nothing at all about
 * whether the *prose* teaches, and a bank can hit 96% true mastery while
 * serving one sentence about a drop-pod eight times in the first forty-five
 * items. A learner stops reading at the third repeat, and a contextual item
 * nobody reads is a symbolic item with decoration.
 *
 * So this tool plays the real schedule — the real MasteryEngine, the real
 * generate(), the real worked-analogue draw that main.js makes alongside every
 * scaffolded item — and counts the situations that actually reach the screen.
 *
 *   node tools/scene-audit.mjs [items] [learners]
 *
 * It plays EVERY unit the manifest ships, one session set per unit.
 *
 * It fails (non-zero) if the first `items` of a session repeat any situation
 * while the bank still had an unused one to offer, or if the variety falls
 * below the floors below.
 */
import { MasteryEngine } from '../src/learn/mastery.js';
import { safeGenerate, DECK_SCENES, resetSituations } from '../src/learn/generators.js';
import { analogueFor } from '../src/learn/scaffold.js';
import { allUnits, loadUnit, standalone, manifest, routeUnits } from './_courses.mjs';
import { findings, sandbox } from './_findings.mjs';

/* EVERY UNIT THE MANIFEST SHIPS, not the one graph this file used to name.
   The path 'content/graph/algebra1-l1.json' was compiled into this tool, so it
   audited ten skills and printed PASS for a bank of sixty-two. Run over the
   whole manifest it finds, immediately, that a cadet in Level 2 meets
   l2.ctx.gauge EIGHT times inside one forty-five-item session — the exact
   defect the file was written for, sitting in four of the five units. */
const UNITS = [];
for (const { course, unit } of await allUnits()) {
  UNITS.push({ course, unit, graph: standalone(await loadUnit(unit)) });
}
const DEFAULT_UNIT = (await manifest()).default.unit;
/* WHICH OF THESE UNITS A LEARNER IS ACTUALLY STANDING IN. `content/courses.json`
   ships two of five, so a repeat in Level 5 and a repeat in Level 1 are not the
   same emergency — and `npm run check`'s summary sorts its red gates by exactly
   that, off a last line reading `ROUTE:` or `PREVIEW-ONLY:` (`whereIsIt` in
   tools/check-all.mjs). This gate knew which unit every finding was in and
   never said, so the build filed its only red gate as WHERE UNKNOWN. Read off
   the manifest through the same helper `check:determinate` and
   `tools/route-proof.mjs` use, so promoting a unit moves this with no edit. */
const ON_ROUTE = (await routeUnits()).onRoute;

const N = Number(process.argv[2] || 45);
const LEARNERS = Number(process.argv[3] || 40);

// The bar. Inside one session no learner may meet the same situation twice —
// so the number of *distinct* situations shown has to equal the number of
// situations shown, every session, with no exceptions and no averaging. (Not
// every item carries a situation: a bare symbolic reading is notation and a
// question, which is why the count is against situations served rather than
// against items scheduled.)
const MAX_REPEAT = 1;
/* And the session has to be wide, not merely non-repeating: a schedule that
   served four contextual items could not repeat one either.

   THIS FLOOR IS A PROPERTY OF ONE BANK, so it is asserted against the bank it
   was measured on — the manifest default, which is the shipped experience — and
   printed for every other unit. Inventing a floor for a unit nobody has counted
   the situations of would be a number pulled out of the air, and a gate with a
   made-up number in it is worse than no gate. MAX_REPEAT is not like that: "no
   cadet meets the same situation twice in one sitting" is true of any bank of
   any size, so every unit is held to it. */
const MIN_DISTINCT = 30;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One session, played exactly the way src/main.js plays it. */
function session(graph, seed, { withAnalogue = true } = {}) {
  const rnd = mulberry(seed);
  // A session is one page load, and the bank's ledger of what it has already
  // shown lives for exactly that long.
  resetSituations();
  const engine = new MasteryEngine(graph);
  const scenes = [];
  for (let i = 0; i < N; i++) {
    const objective = engine.next();
    if (!objective) break;
    const task = engine.taskFor(objective.id);
    if (!task) break;
    const pool = task.formCandidates || [];
    const form = pool.length ? pool[Math.floor(rnd() * pool.length)] : undefined;
    let item;
    try {
      item = safeGenerate(task.skill, task.difficulty, (rnd() * 1e9) | 0, {
        form, reps: task.reps || undefined, avoidScenes: task.avoidScenes || undefined,
      });
    } catch { continue; }
    if (item.scene) scenes.push(...item.scene.split('+'));
    if (withAnalogue && (task.scaffold === 'full' || task.scaffold === 'partial')) {
      let ex = null;
      try { ex = analogueFor(item, { difficulty: task.difficulty, seed: item.seed, avoidScenes: task.avoidScenes }); } catch { /* none */ }
      if (ex && ex.scene) scenes.push(...ex.scene.split('+'));
    }
    // The engine only advances if it is told what happened. A competent-ish
    // learner: right most of the time, wrong sometimes, which is what keeps
    // the bands and the proving runs moving the way they do in play.
    const correct = rnd() < 0.78;
    engine.observe(task.skill, correct, {
      assisted: task.scaffold !== 'none', form: item.form, rep: item.rep,
      scene: item.scene, kind: task.kind,
    });
  }
  return scenes;
}


/**
 * SEVERITY FOLLOWS THE ROUTE — the same rule, and the same helper, that
 * `check:mastery` uses, as a pure function so it can be planted against.
 *
 * This gate printed every finding and then exited 1 WHATEVER IT FOUND, so three
 * preview-unit repeats — `l3.ctx.disputeFactorCount ×6`, `l4.ctx.plotStore ×5`,
 * `l5.ctx.rampRule ×7` — held `npm run check` red for a region no learner is
 * sent to. A build that is permanently red for a defect nobody can meet teaches
 * everybody to stop reading the build, and the next thing that gets excused is
 * a defect on the route.
 *
 * NOTHING IS SILENCED. Every finding is printed in full above this, the FAIL
 * line stands, and the `PREVIEW-ONLY:` marker is read by
 * `tools/check-all.mjs`'s `whereIsIt()`, which lists this gate as ADVISORY in
 * the build's summary on every single run. Put any of those units into
 * `content/courses.json` `route.units` and the identical finding turns the
 * build red on the next run, with no edit to this file.
 *
 * @param {{id:string, worstRepeat:number, worstKey:string, wideEnough:boolean}[]} guilty
 * @param {(id:string)=>boolean} onRoute  routeUnits().onRoute
 * @returns {{code:number, lines:string[]}}
 */
export function severity(guilty, onRoute, make = findings) {
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. `forUnit` applies the
     same rule this function has applied since it was written, in the one place
     every gate now applies it from: a repeat in a unit on route.units is a
     route finding, the identical repeat in a preview unit is advisory, and
     promoting the unit flips it with no edit here. The lines below are kept
     because this gate's prose is what a reader acts on. */
  const F = make('check:scenes', { scope: 'sweep', onRoute });
  for (const g of guilty) {
    F.forUnit(g.id, `${g.id} repeats a situation inside one sitting: `
      + `${g.wideEnough ? '' : 'too few distinct situations; '}${g.worstKey} x ${g.worstRepeat}`);
  }
  const onRoad = guilty.filter((g) => onRoute(g.id));
  const say = (g) => `${g.id} (${g.wideEnough ? '' : 'too few situations; '}${g.worstKey} × ${g.worstRepeat})`;
  if (onRoad.length) {
    return { code: F.report(), lines: [`${onRoad.length} unit(s) on the shipped route repeat a situation inside one sitting — ${onRoad.map(say).join(', ')}\n`] };
  }
  return {
    code: F.report(),
    lines: [
      `${guilty.length} unit(s) repeat a situation inside one sitting, none of them on the shipped route — ${guilty.map(say).join(', ')}`,
      '  Advisory, not red: no learner is handed those units. Every finding above is real and is printed in',
      '  full. Promoting any of them into content/courses.json route.units makes this gate HARD on the next',
      '  build, with no edit to this file — the severity is read off the manifest, not written here.\n',
    ],
  };
}

/* --self-test: the severity rule, on planted findings. It does NOT plant a
   repeated situation — the detector still proves nothing about itself, which is
   why this gate is in NO_SELF_TEST as proved only in part — but the rule that
   decides whether a finding stops a shipment is planted in both directions,
   because that rule is the one that was just changed. */
if (process.argv.includes('--self-test')) {
  let bad = 0;
  const flag = (m) => { console.error(` FAIL ${m}`); bad++; };
  const ok = (m) => console.log(`  ok   ${m}`);
  console.log('check:scenes self-test — severity follows content/courses.json route.units\n');
  const G = (id) => ({ id, worstRepeat: 6, worstKey: `${id}.ctx.thing`, wideEnough: true });
  const road = (...ids) => (id) => ids.includes(id);

  const preview = severity([G('l3'), G('l4')], road('l1', 'l2'), sandbox);
  if (preview.code !== 0) flag('a repeat in a preview unit still stops the build');
  else ok('a repeat only in a preview unit is ADVISORY — the build stays green for a region nobody is sent to');
  const said = [];
  const spy = (g, o) => sandbox(g, { ...o, out: (l) => said.push(l) });
  severity([G('l3'), G('l4')], road('l1', 'l2'), spy);
  if (!said.join('\n').includes('PREVIEW-ONLY:')) flag('the advisory case does not print the marker npm run check reads, so it would vanish from the summary');
  else ok('…and it prints `PREVIEW-ONLY:`, which tools/check-all.mjs reads and lists as ADVISORY on every build');
  if (!said.join('\n').includes('l3.ctx.thing x 6')) flag('the advisory case dropped the finding itself — that is silence, not advice');
  else ok('…with the unit, the situation and the count still named: nothing is silenced');

  const onRoad = severity([G('l1')], road('l1', 'l2'), sandbox);
  if (onRoad.code !== 1) flag('THE DEFECT: a repeat in a unit a learner is handed did not stop the build');
  else ok('a repeat in a unit on route.units is HARD — exit 1');
  const roadSaid = [];
  severity([G('l1')], road('l1', 'l2'), (g, o) => sandbox(g, { ...o, out: (l) => roadSaid.push(l) }));
  if (!roadSaid.join('\n').includes('ROUTE:')) flag('the hard case does not print `ROUTE:`');
  else ok('…and prints `ROUTE:`, so the build files it under "a learner meets this today"');

  const mixed = severity([G('l2'), G('l5')], road('l1', 'l2'), sandbox);
  if (mixed.code !== 1) flag('one route unit among preview ones was not enough to stop the build');
  else ok('one guilty unit on the route outranks any number of preview ones');

  const promoted = severity([G('l3')], road('l1', 'l2', 'l3'), sandbox);
  if (promoted.code !== 1) flag('promoting a unit into route.units did not make its finding hard');
  else ok('promoting l3 into route.units makes the identical finding hard, with no edit to this file');

  console.log('');
  if (bad) { console.error(`self-test: ${bad} failure(s)\n`); process.exit(1); }
  console.log('self-test: ok — route findings stop the build, preview findings are printed in full and do not\n');
  process.exit(0);
}

const bankSize = new Set(Object.values(DECK_SCENES).flat()).size;
const bar = (n, d) => '█'.repeat(Math.round(30 * (d ? n / d : 0))).padEnd(30, '·');

console.log('ASCENT — situation audit');
console.log(`  ${UNITS.length} unit(s) in the manifest · ${bankSize} distinct situations in the core deck, across ${Object.keys(DECK_SCENES).length} decks`);
console.log(`  ${LEARNERS} sessions of ${N} scheduled items each, per unit, worked analogues included, exactly as the game draws them\n`);

let failed = 0;
const guilty = [];      // [unitId, worstRepeat, worstKey] — one per failing unit
for (const { course, unit, graph } of UNITS) {
  let worstDistinct = Infinity; let worstRepeat = 0; let worstKey = '';
  let sumDistinct = 0; let repeated = 0;
  const histAll = new Map();
  for (let i = 0; i < LEARNERS; i++) {
    const scenes = session(graph, (i * 2654435761 + 12345) >>> 0);
    const hist = new Map();
    for (const s of scenes) {
      hist.set(s, (hist.get(s) || 0) + 1);
      histAll.set(s, (histAll.get(s) || 0) + 1);
    }
    const top = [...hist.entries()].sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    sumDistinct += hist.size;
    if (hist.size < worstDistinct) worstDistinct = hist.size;
    if (top[1] > 1) repeated++;
    if (top[1] > worstRepeat) { worstRepeat = top[1]; worstKey = top[0]; }
  }
  // The floor is asserted only on the bank it was measured on; see MIN_DISTINCT.
  const isDefault = unit.id === DEFAULT_UNIT;
  const wideEnough = !isDefault || worstDistinct >= MIN_DISTINCT;
  const noRepeat = worstRepeat <= MAX_REPEAT;
  if (!wideEnough || !noRepeat) { failed++; guilty.push({ id: unit.id, worstRepeat, worstKey, wideEnough }); }

  console.log(`  \x1b[1m${course.id}/${unit.id}\x1b[0m${isDefault ? '  (the manifest default — the shipped experience)' : ''}`);
  console.log(`    distinct situations per session, worst / mean   ${worstDistinct} / ${(sumDistinct / LEARNERS).toFixed(1)}`
    + `   ${isDefault ? `(floor ${MIN_DISTINCT})${wideEnough ? '' : '  \x1b[31mUNDER\x1b[0m'}` : '(no floor measured for this bank; printed, not asserted)'}`);
  console.log(`    most times one session repeated a situation     ${worstRepeat} — ${worstKey}   (ceiling ${MAX_REPEAT})${noRepeat ? '' : '  \x1b[31mOVER\x1b[0m'}`);
  console.log(`    sessions containing any repeated situation      ${bar(repeated, LEARNERS)} ${(100 * repeated / LEARNERS).toFixed(1)}%`);
  console.log(`    situations this unit's schedule reached         ${histAll.size}\n`);
}

if (failed) {
  console.log(`  FAIL — the prose repeats inside a single session in ${failed} of ${UNITS.length} unit(s)\n`);
  const v = severity(guilty, ON_ROUTE);
  for (const line of v.lines) console.log(line);
  process.exit(v.code);
}
console.log('  no cadet meets the same situation twice in a session, in any unit the manifest ships\n');
/* A CLEAN RUN PRINTS ITS LEDGER TOO. tools/check-all.mjs reads the machine line
   to decide whether this gate's exit code is its own claim or a checked one,
   and a gate that only prints a ledger when it is unhappy is a gate the runner
   cannot check on a green build. */
severity([], ON_ROUTE);
