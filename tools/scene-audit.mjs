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
 * It fails (non-zero) if the first `items` of a session repeat any situation
 * while the bank still had an unused one to offer, or if the variety falls
 * below the floors below.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MasteryEngine } from '../src/learn/mastery.js';
import { safeGenerate, DECK_SCENES, resetSituations } from '../src/learn/generators.js';
import { analogueFor } from '../src/learn/scaffold.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(await readFile(path.join(ROOT, 'content/graph/algebra1-l1.json'), 'utf8'));

const N = Number(process.argv[2] || 45);
const LEARNERS = Number(process.argv[3] || 40);

// The bar. Inside one session no learner may meet the same situation twice —
// so the number of *distinct* situations shown has to equal the number of
// situations shown, every session, with no exceptions and no averaging. (Not
// every item carries a situation: a bare symbolic reading is notation and a
// question, which is why the count is against situations served rather than
// against items scheduled.)
const MAX_REPEAT = 1;
// And the session has to be wide, not merely non-repeating: a schedule that
// served four contextual items could not repeat one either.
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
function session(seed, { withAnalogue = true } = {}) {
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

const bankSize = new Set(Object.values(DECK_SCENES).flat()).size;
let worstDistinct = Infinity, worstRepeat = 0, worstKey = '';
let sumDistinct = 0, repeated = 0;
const histAll = new Map();
for (let i = 0; i < LEARNERS; i++) {
  const scenes = session((i * 2654435761 + 12345) >>> 0);
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

const bar = (n, d) => '█'.repeat(Math.round(30 * (d ? n / d : 0))).padEnd(30, '·');
const unused = Object.values(DECK_SCENES).flat().filter((k) => !histAll.has(k));
console.log('ASCENT — situation audit');
console.log(`  ${bankSize} distinct situations in the bank, across ${Object.keys(DECK_SCENES).length} decks`);
console.log(`  ${LEARNERS} sessions of ${N} scheduled items each, worked analogues included, exactly as the game draws them\n`);
console.log(`  distinct situations per session, worst / mean   ${worstDistinct} / ${(sumDistinct / LEARNERS).toFixed(1)}   (floor ${MIN_DISTINCT})`);
console.log(`  most times one session repeated a situation     ${worstRepeat} — ${worstKey}   (ceiling ${MAX_REPEAT})`);
console.log(`  sessions containing any repeated situation      ${bar(repeated, LEARNERS)} ${(100 * repeated / LEARNERS).toFixed(1)}%`);
console.log(`  situations the schedule never reached           ${unused.length} of ${bankSize}`);

const ok = worstDistinct >= MIN_DISTINCT && worstRepeat <= MAX_REPEAT;
console.log(ok ? '\n  PASS — no cadet meets the same situation twice in a session\n'
  : '\n  FAIL — the prose repeats inside a single session\n');
process.exit(ok ? 0 : 1);
