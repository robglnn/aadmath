/**
 * THE ECONOMY PROBE — earn, spend, and how far the ladder actually reaches.
 *
 * Three questions, all answered against the real running game:
 *
 *   1. EARN   what sixty seconds of jogging pays, versus what the hardest
 *             content in the game pays. If a cache is not worth the trip, the
 *             number says so.
 *   2. SPEND  what the sinks cost, and how many minutes of each earn route buy
 *             one of them.
 *   3. LADDER at which item each kit grant lands, played as a knower well past
 *             the tenth line held — including the retention probes that only a
 *             player who came back a second and third time ever sees.
 *
 *   node tools/critic/econ.mjs --url http://127.0.0.1:5173
 *   SNAPSHOT_PORT=4555 tools/critic/econ.sh          # frozen build
 */
import { chromium } from 'playwright';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const JOG = Number(arg('jog', 60));
const ITEMS = Number(arg('items', 420));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

// ---------------------------------------------------------------------------
// 1. EARN — sixty seconds of jogging, from a cold wallet
// ---------------------------------------------------------------------------
await page.evaluate(() => {
  const A = window.__ascent;
  A.player.pos.set(0, (A.islandAt(0, 30) ?? 8) + 1.2, 30);
  A.player.vel.set(0, 0, 0);
});
await page.mouse.click(640, 400);
await page.waitForTimeout(600);

const before = await page.evaluate(() => ({
  shards: window.__ascent.state().shards,
  motes: window.__ascent.state().drift.motes,
  field: window.__ascent.drift.field(),
  pos: window.__ascent.player.pos.toArray(),
}));
let walked = 0;
let lastPos = before.pos;
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
const t0 = Date.now();
// steer, so the run is a run across the island rather than a straight line into
// the sea — a player jogging for a minute turns
// Steering. A headless page has no pointer lock, so `mouse.move` turns nothing;
// the heading is written straight onto the controller instead, which is the
// same number the mouse would have written. The route is a wide arc across the
// island — a player looking for shards, not a player running into a wall.
for (let i = 0; i < JOG * 2; i++) {
  await page.evaluate((k) => {
    const A = window.__ascent;
    A.player.yaw = k;
    if (A.player.cam) A.player.cam.yaw = k;
  }, (i / (JOG * 2)) * Math.PI * 2.4 + 0.6);
  await page.waitForTimeout(500);
  const p = await page.evaluate(() => window.__ascent.player.pos.toArray());
  walked += Math.hypot(p[0] - lastPos[0], p[2] - lastPos[2]);
  lastPos = p;
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
const jogSecs = (Date.now() - t0) / 1000;
const afterJog = await page.evaluate(() => ({
  shards: window.__ascent.state().shards,
  drift: window.__ascent.state().drift,
  field: window.__ascent.drift.field(),
}));
const jogEarn = afterJog.shards - before.shards;

// ---------------------------------------------------------------------------
// 2. EARN — one hanging cache, cracked correctly
// ---------------------------------------------------------------------------
const cache = await page.evaluate(async () => {
  const A = window.__ascent;
  const c = A.caches.list.find((x) => !x.opened);
  if (!c) return null;
  const shardsBefore = A.state().shards;
  const columnsBefore = A.drift.columns.length;
  // stand on the perch, then walk into the weight the beam will accept
  A.player.pos.set(c.x, c.y + 2, c.z);
  A.player.vel.set(0, 0, 0);
  const right = c.stones.find((s) => s.v === c.q.x);
  const p = new A.THREE.Vector3();
  right.group.getWorldPosition(p);
  await new Promise((r) => setTimeout(r, 260));
  A.player.pos.set(p.x, p.y, p.z);
  await new Promise((r) => setTimeout(r, 700));
  return {
    latex: c.q.latex,
    opened: c.opened,
    gained: A.state().shards - shardsBefore,
    columnPlanted: A.drift.columns.length - columnsBefore,
  };
});

// ---------------------------------------------------------------------------
// 2b. LEGIBILITY — is the statement in the same frame as the weights?
//
// The camera is driven straight to the approach line and the cache's own tag
// placement is run against it, so these are the pixels the game would put on
// the screen from that spot, not a model of them.
// ---------------------------------------------------------------------------
const legible = await page.evaluate(() => {
  const A = window.__ascent;
  const c = A.caches.list.find((x) => !x.opened) || A.caches.list[0];
  const out = [];
  const f = new A.THREE.Vector3(0, 0, 1).applyQuaternion(c.group.quaternion);
  for (const d of [6, 12, 20, 30, 45, 70]) {
    A.camera.position.set(c.x + f.x * d, c.y + 1.7, c.z + f.z * d);
    A.camera.lookAt(c.x, c.y + 3.2, c.z);
    A.camera.updateMatrixWorld(true);
    A.caches.update(0.016, performance.now() / 1000, A.camera);
    const rows = [...document.querySelectorAll('.field-tag')].map((e) => ({
      cls: e.className.replace('field-tag', '').trim(),
      on: e.style.display !== 'none',
      y: Math.round(parseFloat(e.style.top) || -1),
      x: Math.round(parseFloat(e.style.left) || -1),
      txt: e.textContent.slice(0, 12),
    })).filter((r) => r.on);
    // …and where the same two things sat before the label learned to come down
    // to meet you: statement pinned 7.3 m over the pivot, weights on the deck.
    const was = (lx, ly, lz) => {
      const v = new A.THREE.Vector3(lx, ly, lz).applyMatrix4(c.group.matrixWorld).project(A.camera);
      return Math.round((-v.y * 0.5 + 0.5) * window.innerHeight);
    };
    const eq = rows.find((r) => r.cls === 'big');
    const w = rows.filter((r) => r.cls.startsWith('weight'));
    out.push({
      d,
      equation: eq ? eq.y : null,
      weights: w.length,
      weightY: w.length ? Math.round(w.reduce((a, b) => a + b.y, 0) / w.length) : null,
      spread: eq && w.length ? Math.round(Math.abs(eq.y - w.reduce((a, b) => a + b.y, 0) / w.length)) : null,
      wasEquation: was(0, 7.3, -1.4),
      wasWeight: was(0, 2.5, 3.0),
      ...(() => {
        // The other gaze, and the one the complaint was about: a cadet standing
        // on the deck looking straight ahead, not craning at the rig. In frame
        // means |ndc.y| <= 1.
        A.camera.lookAt(c.x, c.y + 1.7, c.z);
        A.camera.updateMatrixWorld(true);
        const k = Math.max(0, Math.min(1, (52 - d) / (52 - 24)));
        const ndc = (lx, ly, lz) => new A.THREE.Vector3(lx, ly, lz)
          .applyMatrix4(c.group.matrixWorld).project(A.camera).y;
        const nowY = ndc(0, 7.3 + (3.4 - 7.3) * k, -1.4 + (2.8 + 1.4) * k);
        return {
          levelNow: +nowY.toFixed(2), levelWas: +ndc(0, 7.3, -1.4).toFixed(2),
          levelWeight: +ndc(0, 2.45, 2.8).toFixed(2),
        };
      })(),
    });
  }
  return { h: window.innerHeight, rows: out };
});

// ---------------------------------------------------------------------------
// 3. SPEND — what the sinks cost, live off the objects the game runs on
// ---------------------------------------------------------------------------
const sinks = await page.evaluate(() => window.__ascent.kit.prices?.() || null);

// ---------------------------------------------------------------------------
// 4. LADDER — a knower plays well past the tenth line held
// ---------------------------------------------------------------------------
async function ladderRun(wrongEvery) {
  return page.evaluate(async ({ n, wrongEvery }) => {
  const A = window.__ascent;
  localStorage.removeItem('ascent.save');
  const m = A.mastery;
  for (const s of m.state.values()) Object.assign(s, {
    pL: (m.node(s.id).bkt || {}).pInit ?? 0.25,
    mastered: false, everMastered: false, check: null, probe: null, placed: false,
    attempts: 0, correct: 0, cleanRun: 0, credit: 0, difficulty: 1,
    formsSeen: {}, scenesSeen: {}, recentScenes: [], repsCorrect: {},
    dueAt: null, lastSeenAt: null, masteredAt: null, reviewStage: 0,
    // The spacing schedule is wall-clock now (src/learn/mastery.js), so a reset
    // has to clear the clock fields too or a fresh learner inherits yesterday's
    // due dates.
    dueTime: null, provedTime: null, masteredTime: null, lastTime: null,
    durable: 0, lastDurableAt: null, longestGap: 0,
  });
  m.clock = 0; m.recent = []; m.recentReps = []; m.dry = 0; m.sceneLog = [];
  A.kit.reset();

  const at = [];
  let items = 0, seconds = 0, reviews = 0, missed = 0;
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const objective = m.next();
    if (!objective) break;
    const task = m.taskFor(objective.id);
    if (!task) break;
    const item = A.itemFor(task);
    if (!item) continue;
    items++;
    if (task.kind === 'review') reviews++;
    // A sitting is about thirty-five items. The retention ladder is measured in
    // real elapsed time now — that is the whole point of it — so the ladder run
    // has to *come back*, or it is measuring a player who never left and the
    // second half of the kit is unreachable by construction.
    if (i > 0 && i % 35 === 0) A.advanceDays(1);
    const correct = !wrongEvery || (items % wrongEvery !== 0);
    if (!correct) missed++;
    seconds += A.itemSeconds({ rep: item.rep, difficulty: task.difficulty, scaffold: task.scaffold });
    m.observe(task.skill, correct, {
      assisted: task.scaffold !== 'none', form: item.form, rep: item.rep,
      scene: item.scene, kind: task.kind, ms: 9000,
    });
    const st = A.kit.sync();
    for (const id of st.held) {
      if (seen.has(id)) continue;
      seen.add(id);
      at.push({
        id, item: items, minutes: +(seconds / 60).toFixed(1),
        depth: st.depth, lines: st.lines, temper: st.temper, reviews,
      });
    }
  }
  return {
    items, reviews, missed, minutes: +(seconds / 60).toFixed(1),
    at, final: A.kit.sync(), grants: A.kit.grants,
  };
  }, { n: ITEMS, wrongEvery });
}

const ladder = await ladderRun(0);
const struggler = await ladderRun(6);

const fps = await page.evaluate(() => window.__ascent.state().perf);

// ---------------------------------------------------------------------------
const round = (x) => Math.round(x * 10) / 10;
console.log('\n=== EARN ===');
console.log(`field          ${before.field.veins} veins, ${before.field.lit} lit, ${before.field.onIsland} shards standing on the island, ${before.field.recharge}s recharge`);
console.log(`jog            ${jogEarn} shards in ${round(jogSecs)}s over ${Math.round(walked)} m  (${round((jogEarn / jogSecs) * 60)}/min, ${afterJog.drift.motes - before.motes} motes, ${afterJog.field.spent} veins drained)`);
if (cache) {
  console.log(`cache          ${cache.gained} shards  [${cache.latex}]  opened=${cache.opened} column=${cache.columnPlanted}`);
  console.log(`cache/jog      ${round(cache.gained / Math.max(1, jogEarn / jogSecs * 60))} minutes of jogging per cache`);
}
console.log('\n=== CACHE LEGIBILITY === (screen y of tags, viewport height ' + legible.h + ')');
for (const r of legible.rows) {
  console.log(`  ${String(r.d).padStart(2)} m  aimed: equation y=${String(r.equation).padStart(4)} weights ${r.weights}/3 y=${String(r.weightY).padStart(4)} apart ${String(r.spread).padStart(3)}px (was ${String(Math.abs(r.wasEquation - r.wasWeight)).padStart(3)}px)   level gaze ndc.y: statement now ${String(r.levelNow).padStart(6)} / was ${String(r.levelWas).padStart(6)} / weights ${String(r.levelWeight).padStart(6)}  ${Math.abs(r.levelNow) <= 1 ? 'IN' : 'OFF'}-frame, was ${Math.abs(r.levelWas) <= 1 ? 'IN' : 'OFF'}`);
}
if (sinks) {
  console.log('\n=== SPEND ===');
  for (const [k, v] of Object.entries(sinks)) {
    console.log(`${k.padEnd(14)} ${String(v).padEnd(5)} = ${round(v / Math.max(0.01, (jogEarn / jogSecs) * 60))} min jogging / ${round(v / Math.max(1, cache?.gained || 1))} caches`);
  }
}
const SESSION = 20;   // minutes: the Pomodoro shape the product is built around
function report(label, r) {
  console.log(`\n=== LADDER · ${label} ===`);
  console.log(`${r.items} items played (${r.reviews} retention probes, ${r.missed} answered wrong), ${r.minutes} modelled minutes`);
  for (const g of r.at) {
    const ses = Math.max(1, Math.ceil(g.minutes / SESSION));
    console.log(`  ${g.id.padEnd(10)} item ${String(g.item).padStart(3)}  ${String(g.minutes).padStart(5)} min  session ${ses}  depth ${String(g.depth).padStart(2)} (${g.lines} lines + ${g.temper} held again)`);
  }
  const locked = r.grants.filter((g) => !r.final.held.includes(g.id));
  console.log(`held ${r.final.held.length}/${r.grants.length}  final depth ${r.final.depth}` + (locked.length ? `  still locked: ${locked.map((g) => g.id + '@' + (g.depth ?? g.lines)).join(' ')}` : ''));
}
report('knower, every answer right', ladder);
report('learner, one in six wrong', struggler);
console.log('\nconsole errors:', errors.length, errors.slice(0, 3).join('\n'));
console.log('fps median', fps?.median);

await browser.close();
process.exit(errors.length ? 1 : 0);
