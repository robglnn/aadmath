/**
 * EARN vs SPEND — the curve, measured against the running game.
 *
 * The complaint this answers is one number: a real player finished a session
 * holding **800 cipher shards and having spent none of them**. Two hypotheses
 * fit that: the island pays too much, or there was nothing to buy. This tool
 * measures both sides against the real build so the answer is not an opinion.
 *
 *   1. STANDING CHARGE   everything on the island a player can pick up without
 *                        answering a single question: the drift's lit veins, the
 *                        five hanging caches, the three lattice anchors.
 *   2. EARN RATE         a directed run — the cadet actually sprints between the
 *                        real veins, at real speed, collecting real motes.
 *   3. SHELF             what the foundry quotes at each point on its own price
 *                        curve, and how many minutes of running each one costs.
 *   4. THE SESSION       how many purchases a 20-minute Pomodoro session can
 *                        actually afford, which is the number that says whether
 *                        a player is regularly making a real choice.
 *
 *   node tools/critic/econflow.mjs --url http://127.0.0.1:4173 [--minutes 3]
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const MINUTES = Number(arg('minutes', 3));
const SESSION = 20;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3200);

// --- 1. what is lying about on the island, before anybody answers anything ---
const standing = await page.evaluate(() => {
  const A = window.__ascent;
  const f = A.drift.field();
  return {
    motes: f.onIsland, veins: f.veins, recharge: f.recharge,
    caches: A.caches.state().total, cacheEach: 120,
    anchors: A.anchors().total, anchorEach: 60,
  };
});
standing.total = standing.motes + standing.caches * standing.cacheEach
  + standing.anchors * standing.anchorEach;

// --- 2. a directed run: sprint the real cadet between the real veins ---
await page.mouse.click(640, 400);
await page.waitForTimeout(400);
await page.evaluate(() => {
  const A = window.__ascent;
  A.player.pos.set(0, (A.islandAt(0, 26) ?? 8) + 1.2, 26);
  A.player.vel.set(0, 0, 0);
});
const before = await page.evaluate(() => window.__ascent.state().shards);
const t0 = Date.now();
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
let dist = 0;
let last = await page.evaluate(() => window.__ascent.player.pos.toArray());
const steps = Math.round((MINUTES * 60) / 0.4);
for (let i = 0; i < steps; i++) {
  // steer at the nearest lit vein the cadet has not just drained — a player who
  // has learned what the crystals are does exactly this
  await page.evaluate(() => {
    const A = window.__ascent;
    const p = A.player.pos;
    let best = null, bd = 1e9;
    for (let k = 0; k < 26; k++) {
      const v = A.drift.veinAt(k);
      if (!v || v.cool > 0 || v.left <= 0) continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      // commit to a target rather than jittering between two crystals at
      // arm's length: a player runs at a vein, not around one
      if (d > 9 && d < bd) { bd = d; best = v; }
    }
    if (!best) return;
    const yaw = Math.atan2(best.x - p.x, best.z - p.z);
    A.player.yaw = yaw;
    if (A.player.cam) A.player.cam.yaw = yaw;
  });
  await page.waitForTimeout(400);
  const p = await page.evaluate(() => {
    const A = window.__ascent;
    // a real run gets stuck on real rocks; a real player jumps
    if (A.player.vel.lengthSq() < 4) A.input._press('jump');
    return A.player.pos.toArray();
  });
  dist += Math.hypot(p[0] - last[0], p[2] - last[2]);
  last = p;
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
const secs = (Date.now() - t0) / 1000;
const after = await page.evaluate(() => ({
  shards: window.__ascent.state().shards,
  field: window.__ascent.drift.field(),
  motes: window.__ascent.state().drift.motes,
}));
const earned = after.shards - before;
const perMin = (earned / secs) * 60;

// --- 3. the shelf, at every step of its own curve ---
const shelf = await page.evaluate(() => {
  const A = window.__ascent;
  const rows = [];
  // walk the beacon's price curve by buying five of them against a fat wallet
  const start = A.kit.state().stock.map((s) => ({ id: s.id, price: s.price, state: s.state }));
  return { start, prices: A.kit.prices() };
});
const beaconCurve = await page.evaluate(() => window.__ascent.kit.curve('beacon', 6));

// --- 4. what a session of running can afford ---
const sessionEarn = Math.round(perMin * SESSION);

const r = (x) => Math.round(x * 10) / 10;
console.log('\n=== 1. STANDING CHARGE (no question answered) ===');
console.log(`drift motes    ${standing.motes} across ${standing.veins} veins, relighting every ${standing.recharge}s`);
console.log(`hanging caches ${standing.caches} x ${standing.cacheEach} = ${standing.caches * standing.cacheEach}`);
console.log(`lattice anchors ${standing.anchors} x ${standing.anchorEach} = ${standing.anchors * standing.anchorEach}`);
console.log(`TOTAL          ${standing.total} shards a sweep`);

console.log('\n=== 2. EARN, directed run (real sprint, real veins) ===');
console.log(`${earned} shards in ${r(secs)}s over ${Math.round(dist)} m  =  ${r(perMin)} / min`);
console.log(`veins drained ${after.field.spent}/${after.field.veins}, motes taken ${after.motes}`);
console.log(`a ${SESSION}-minute session of pure running: ~${sessionEarn} shards`);

console.log('\n=== 3. THE SHELF ===');
for (const s of shelf.start) {
  console.log(`${s.id.padEnd(9)} ${String(s.price).padStart(4)}  ${s.state.padEnd(7)}` +
    (perMin > 0 ? ` = ${r(s.price / perMin)} min of running` : ''));
}
console.log(`beacon curve   ${beaconCurve.join(' → ')}`);

console.log('\n=== 4. THE CHOICE ===');
let purse = sessionEarn, bought = 0;
for (const p of beaconCurve) { if (purse >= p) { purse -= p; bought++; } }
console.log(`one session of running buys ${bought} standing beacons (${beaconCurve.slice(0, bought).join('+')}), ${purse} left over`);
console.log(`the island's whole standing charge buys ${(() => {
  let q = standing.total, n = 0;
  for (const p of beaconCurve) { if (q >= p) { q -= p; n++; } }
  return `${n} beacons with ${q} left`;
})()}`);
console.log('\nconsole errors:', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(errs.length ? 1 : 0);
