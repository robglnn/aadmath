/**
 * Does the world produce anything, and does mastery buy anything?
 *
 * Two claims, both measured against the real running game:
 *
 *   1. SIXTY SECONDS OF PURE TRAVERSAL. Six legs of run / sprint / jump / glide
 *      with no rift opened and no harness cheating, counting the events the
 *      game itself reports: motes taken, updrafts ridden, rift surges caught.
 *      The bar this replaces produced zero.
 *   2. AN UNLOCK CHANGES WHAT THE PLAYER CAN DO. Lines are sealed through the
 *      real mastery engine, and after each one the capability numbers are read
 *      back off the shipping objects — the build kinds the cadet is allowed to
 *      set, the lattice reserve, the wing's trim, the sprint. Then the vault
 *      plate is actually set and actually stood on, and the height it throws
 *      the cadet to is measured.
 *   3. A HANGING CACHE IS OPENED BY BALANCING A BEAM, with feet, and the reward
 *      (shards, and a permanent updraft) is read back.
 *
 *   node tools/critic/tmp/kitplay.mjs --url http://127.0.0.1:4477 --out shots/kitplay
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/kitplay'));
const SECONDS = Number(arg('seconds', 60));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));

const shot = async (n, ms = 260) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);
// No click: a click is `fire`, and `fire` sets a wall down half a metre in
// front of the cadet, which he then runs into. This is a traversal test, so
// the cadet only ever runs, jumps and flies.

// ---------------------------------------------------------------------------
// 1. sixty seconds of pure traversal
// ---------------------------------------------------------------------------
const before = await page.evaluate(() => ({ ...window.__ascent.state().drift, shards: window.__ascent.state().shards }));
const t0 = Date.now();
const legs = 6;
const look = (a) => page.evaluate((yaw) => { window.__ascent.player.yaw = yaw; }, a);
for (let leg = 0; leg < legs; leg++) {
  await look(3.14 - leg * 1.04);
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(4200);
  await page.keyboard.press('Space');
  await page.waitForTimeout(240);
  await page.keyboard.press('Space');
  await page.waitForTimeout(900);
  await page.keyboard.press('KeyG');           // the wing
  await page.waitForTimeout(3200);
  if (leg === 2) await shot('t-glide');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);
}
while (Date.now() - t0 < SECONDS * 1000) {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
}
await page.keyboard.up('KeyW');
const after = await page.evaluate(() => ({ ...window.__ascent.state().drift, shards: window.__ascent.state().shards }));
const secs = (Date.now() - t0) / 1000;
await shot('t-run');

// --- an updraft: fly into one and it takes you up ---------------------------
const lift = await page.evaluate(async () => {
  const A = window.__ascent;
  const c = A.drift.columns[0];
  A.player.pos.set(c.x, c.y0 + 2, c.z);
  A.player.vel.set(0, 0, 0);
  const y0 = A.player.pos.y;
  for (let i = 0; i < 180; i++) await new Promise((r) => requestAnimationFrame(r));
  return { gained: +(A.player.pos.y - y0).toFixed(1), top: +(c.top - c.y0).toFixed(0) };
});
await shot('t-updraft');

// ---------------------------------------------------------------------------
// 2. a hanging cache, opened by balancing the beam with your feet
// ---------------------------------------------------------------------------
const cache = await page.evaluate(async () => {
  const A = window.__ascent;
  const c = A.caches.list.find((x) => !x.opened);
  if (!c) return { ok: false, why: 'none left' };
  const shardsBefore = A.state().shards;
  const cols = A.drift.columns.length;
  // stand on the perch, then walk into a weight — first a wrong one, so the
  // beam has to show it is wrong, then the right one
  A.player.pos.set(c.x, c.y + 0.4, c.z);
  A.player.vel.set(0, 0, 0);
  await new Promise((r) => setTimeout(r, 500));
  const onPerch = A.player.pos.y > c.y - 1.5;
  const V = new A.THREE.Vector3();
  const wrong = c.stones.find((s) => s.v !== c.q.x);
  wrong.group.getWorldPosition(V);
  A.player.pos.copy(V);
  await new Promise((r) => setTimeout(r, 700));
  const refused = wrong.spent && !c.opened;
  const roll = c.roll;
  A.player.pos.set(c.x, c.y + 0.4, c.z);
  await new Promise((r) => setTimeout(r, 1900));
  const right = c.stones.find((s) => s.v === c.q.x);
  right.group.getWorldPosition(V);
  A.player.pos.copy(V);
  await new Promise((r) => setTimeout(r, 900));
  return {
    ok: true, onPerch, refused, rollAfterWrong: +roll.toFixed(3),
    statement: c.q.latex, answer: c.q.x, opened: c.opened,
    paid: A.state().shards - shardsBefore,
    columnsBefore: cols, columnsAfter: A.drift.columns.length,
    height: Math.round(c.y),
  };
});
await shot('k-cache');

// ---------------------------------------------------------------------------
// 3. seal lines, one at a time, and read the capability back
// ---------------------------------------------------------------------------
const caps = () => page.evaluate(() => {
  const A = window.__ascent;
  return {
    seals: A.kit.state().seals,
    held: A.kit.state().held,
    kinds: [...A.builder.allowed],
    reserve: A.builder.maxCharge,
    regen: A.builder.regen,
    move: A.kit.state().move,
    shards: A.state().shards,
  };
});
const capsBefore = await caps();

/** Seal `n` lines through the real engine, by answering real items correctly. */
async function seal(n) {
  return page.evaluate((want) => {
    const A = window.__ascent;
    const m = A.mastery;
    let done = 0;
    for (let i = 0; i < 400 && done < want; i++) {
      const obj = m.next();
      if (!obj) break;
      const task = m.taskFor(obj.id);
      const item = A.itemFor(task);
      if (!item) continue;
      const res = m.observe(task.skill, true, {
        assisted: task.scaffold !== 'none',
        form: item.form, rep: item.rep, scene: item.scene, kind: task.kind,
      });
      if (res.justMastered) done++;
    }
    return [...m.state.values()].filter((s) => s.mastered).length;
  }, n);
}

const capsAt = [];
for (const step of [1, 2, 3, 4, 5, 6]) {
  await seal(1);
  await page.waitForTimeout(700);              // the kit polls at 0.4 s
  if (step === 1) await shot('k-grant-1');
  if (step === 3) await shot('k-grant-3');
  capsAt.push({ step, ...(await caps()) });
}
// The seals raise the rank rite and the session's close card. A player would
// dismiss them; so does the harness, before photographing what the kit did.
for (const label of ['STAND DOWN', 'Stand down', 'ONE MORE LINE']) {
  const b = page.locator(`button:has-text("${label}")`).first();
  if (await b.count() && await b.isVisible()) { await b.click(); break; }
}
await page.waitForTimeout(1200);
await shot('k-strip');

// ---------------------------------------------------------------------------
// 4. the vault plate: set one, stand on it, measure the throw
// ---------------------------------------------------------------------------
const vault = await page.evaluate(async () => {
  const A = window.__ascent;
  A.kit.vault();                                    // slot 5
  const tg = A.buildTarget();
  const r = A.build();
  if (!r.ok) return { ok: false, why: r.reason, tg };
  const p = r.piece;
  const y0 = p.y + 0.22;
  A.player.pos.set(p.x, y0 + 0.3, p.z);
  A.player.vel.set(0, 0, 0);
  const start = A.player.pos.y;
  let peak = start;
  for (let i = 0; i < 130; i++) {
    await new Promise((res) => requestAnimationFrame(res));
    peak = Math.max(peak, A.player.pos.y);
  }
  return { ok: true, kind: p.kind, start, peak, gain: peak - start, shards: A.state().shards };
});
await shot('k-vault');

const state = await page.evaluate(() => {
  const A = window.__ascent;
  return { ...A.state(), fps: A.engine.fps, perf: A.engine.stats() };
});

console.log('\n=== 60 SECONDS OF PURE TRAVERSAL, NO RIFT OPENED ===');
console.log(`  seconds played      ${secs.toFixed(1)}`);
console.log(`  motes taken         ${after.motes - before.motes}`);
console.log(`  updrafts ridden     ${after.lifts - before.lifts}`);
console.log(`  rift surges caught  ${after.surges - before.surges}`);
console.log(`  TOTAL EVENTS        ${after.events - before.events}`);
console.log(`  shards              ${before.shards} -> ${after.shards}`);

console.log('\n=== AN UPDRAFT ===');
console.log('  metres gained in three seconds of standing in one:', lift.gained, 'of', lift.top);

console.log('\n=== WHAT A SEALED LINE BUYS ===');
console.log('  before      kinds', capsBefore.kinds.join(','), ' reserve', capsBefore.reserve,
  ' sprint', capsBefore.move?.sprint, ' glideMax', capsBefore.move?.glideMax);
for (const c of capsAt) {
  console.log(`  ${c.seals} sealed   kinds ${c.kinds.join(',')}  reserve ${c.reserve}/${c.regen}` +
    `  sprint ${c.move?.sprint}  glide ${c.move?.glideBase}/${c.move?.glideMax}  held [${c.held.join(' ')}]`);
}

console.log('\n=== THE VAULT PLATE ===');
console.log(' ', JSON.stringify(vault));

console.log('\n=== A HANGING CACHE ===');
console.log(' ', JSON.stringify(cache));

console.log('\nfps', state.fps, 'p50', state.perf?.p50, 'caches', JSON.stringify(state.caches?.opened),
  'console errors', logs.length);
for (const l of logs.slice(0, 6)) console.log('  !', l);

await browser.close();
const events = after.events - before.events;
const ok = logs.length === 0 && events >= 8 && vault.ok && vault.gain > 8 && cache.opened;
console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
