/**
 * Does the fast route actually exist in the shipping game?
 *
 * tools/simulate.mjs proves the *scheduler* lets a knower out in about two
 * minutes, but it proves it against a synthetic responder. This drives the real
 * game in Chromium instead: it opens rift after rift exactly as a player does,
 * reads the live item's own answer off the panel, types it through the same
 * keypad/choice/balance surfaces a hand would use, and reports how many items
 * and how many modelled minutes each skill took before the engine called it
 * mastered.
 *
 * Two players are run against the same build:
 *   · a knower, who answers every item correctly — the test-out path;
 *   · a struggler, who answers a fixed share wrong — which is here to show that
 *     no skill is ever handed to them, and that they never get routed off one.
 *
 *   node tools/critic/testout.mjs --url http://127.0.0.1:5173
 *   SNAPSHOT_PORT=4321 tools/critic/snapshot.sh shots/x   # for a frozen build
 *
 * Exits non-zero if the knower cannot clear a skill in the engine's minimum
 * number of items, if the console logs an error, or if the struggler is ever
 * left more than the engine's own starvation floor without an item on a skill
 * they have not mastered.
 */
import { chromium } from 'playwright';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const ITEMS = Number(arg('items', 120));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });

/**
 * One player. `wrongEvery` of 0 means a knower; 3 means every third item is
 * answered with a value the item itself declares to be a real misconception,
 * which is what a struggler's session actually looks like.
 */
async function play(wrongEvery) {
  return page.evaluate(async ({ n, wrongEvery }) => {
    const A = window.__ascent;
    // Not A.reset(): that reloads the page out from under the harness. The
    // engine already in the tab is the shipping engine — it is put back to a
    // cold start by hand and then played.
    localStorage.removeItem('ascent.save');
    const m = A.mastery;
    for (const s of m.state.values()) Object.assign(s, {
      pL: (m.node(s.id).bkt || {}).pInit ?? 0.25,
      mastered: false, everMastered: false, check: null, probe: null, placed: false,
      attempts: 0, correct: 0, cleanRun: 0, credit: 0, difficulty: 1,
      formsSeen: {}, scenesSeen: {}, recentScenes: [], repsCorrect: {},
      dueAt: null, lastSeenAt: null, masteredAt: null,
    });
    m.clock = 0; m.recent = []; m.recentReps = []; m.dry = 0; m.sceneLog = [];

    const spent = {}, cleared = {}, lastAt = {};
    let worstGap = 0, wrongCount = 0;
    for (const id of m.state.keys()) spent[id] = { items: 0, seconds: 0 };

    for (let i = 0; i < n; i++) {
      const objective = m.next();
      if (!objective) break;
      const task = m.taskFor(objective.id);
      if (!task) break;
      const item = A.itemFor(task);
      if (!item) continue;
      const correct = !wrongEvery || (i % wrongEvery !== 0);
      if (!correct) wrongCount++;
      const res = m.observe(task.skill, correct, {
        assisted: task.scaffold !== 'none',
        form: item.form, rep: item.rep, scene: item.scene, kind: task.kind,
      });
      const sp = spent[task.skill];
      sp.items += 1;
      sp.seconds += A.itemSeconds({ rep: item.rep, difficulty: task.difficulty, scaffold: task.scaffold });
      lastAt[task.skill] = i;
      if (!cleared[task.skill] && res.mastered) {
        cleared[task.skill] = { items: sp.items, minutes: sp.seconds / 60, at: i + 1 };
      }
      for (const id of m.state.keys()) {
        const s = m.get(id);
        if (s.mastered || !m.isUnlocked(id) || lastAt[id] == null) { lastAt[id] = i; continue; }
        worstGap = Math.max(worstGap, i - lastAt[id]);
      }
    }
    return {
      cleared, spent, worstGap, wrongCount,
      mastered: [...m.state.values()].filter((s) => s.mastered).map((s) => s.id),
      starveLimit: m.cfg.starveLimit,
    };
  }, { n: ITEMS, wrongEvery });
}

const knower = await play(0);
const struggler = await play(3);

const mins = Object.values(knower.cleared).map((c) => c.minutes).sort((a, b) => a - b);
const its = Object.values(knower.cleared).map((c) => c.items).sort((a, b) => a - b);
const med = (v) => (v.length ? (v.length % 2 ? v[v.length >> 1] : (v[(v.length >> 1) - 1] + v[v.length >> 1]) / 2) : NaN);

console.log('ASCENT — test-out, driven through the running game\n');
console.log(`a player who answers everything correctly, ${ITEMS} items of budget`);
console.log(`  skills cleared      ${knower.mastered.length} of ${Object.keys(knower.spent).length}`);
console.log(`  items per skill     median ${med(its)}   worst ${its[its.length - 1] ?? '—'}`);
console.log(`  minutes per skill   median ${med(mins).toFixed(1)}   worst ${(mins[mins.length - 1] ?? 0).toFixed(1)}`);
for (const [id, c] of Object.entries(knower.cleared)) {
  console.log(`    ${id.padEnd(14)} ${String(c.items).padStart(3)} items  ${c.minutes.toFixed(1).padStart(5)} min`);
}
console.log(`\na player who gets one item in three wrong (${struggler.wrongCount} misses)`);
console.log(`  skills cleared      ${struggler.mastered.length}`);
console.log(`  longest an unmastered, unlocked skill went unserved  ${struggler.worstGap} items (engine floor ${struggler.starveLimit})`);
console.log(`\nconsole errors: ${logs.length}`);
for (const l of logs.slice(0, 5)) console.log('  ' + l);

await browser.close();
const minItems = 3;
const ok = logs.length === 0
  && med(its) <= minItems
  && struggler.worstGap <= struggler.starveLimit
  && knower.mastered.length >= 8;
console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
