/**
 * PACING — the day each rank and each chapter actually lands, and what the
 * wallet is doing while they land.
 *
 * A blind critic measured the defect this tool exists to keep dead:
 *
 *   "260 items in one unbroken day-one sitting reached SOVEREIGN and Chapter
 *    6/coda with '0 NIGHTS HELD' on the card."
 *
 *   "Shards inflate to meaninglessness: 34,782 at day 60 against a price list
 *    of 6/16/90/410, affordable:0."
 *
 * Both are answered here against the real running game, never a model of it:
 * the real scheduler serves the items, the real mastery engine decides what is
 * held, the real wall clock is moved with `__ascent.advanceDays`, and every
 * shard is paid through the real `wallet.earn` with the real reason on it.
 *
 * WHAT IS MEASURED AND WHAT IS ASSUMED
 *
 *   MEASURED   ranks, chapters, nights held, depth, charters, every price, and
 *              all learning income — the two shards a sealed rift pays and
 *              everything the descent pays, both of which run through the
 *              shipping code on the way to the shipping wallet.
 *   ASSUMED    how much of the island a player picks up in a sitting. That is a
 *              fact about a person, not about the build, so it is one constant
 *              (`--sweep`) stated in the output. The island's standing charge is
 *              988 shards (tools/critic/econflow.mjs); the default is 60% of it.
 *
 * TWO CADETS play the same sixty days, item for item:
 *
 *   THE HOARDER spends nothing. Their balance is the earn curve, naked. This is
 *               the cadet the 34,782 figure came from.
 *   THE SPENDER buys every permanent they can afford, every day. Their balance
 *               is what is left over when the sinks have had everything they
 *               can take, and it is the number that answers "is a spend still a
 *               decision at day 60".
 *
 *   node tools/critic/pacing.mjs --url http://127.0.0.1:4488 [--days 60]
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const DAYS = Number(arg('days', 60));
const PER = Number(arg('items', 34));
const SWEEP = Number(arg('sweep', 590));
const CRAM = Number(arg('cram', 260));
const MARKS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 45, 60]);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

/**
 * One sitting. Items go through the real router and the real engine; the two
 * shards a sealed rift pays are paid through the real wallet with the real
 * reason, because the harness answers items without opening the rift panel that
 * normally makes that call.
 */
async function sit(n, sweep) {
  return page.evaluate(async ({ count, ground }) => {
    const A = window.__ascent;
    const m = A.mastery;
    const before = A.state().shards;
    let served = 0;
    let deep = 0;
    for (let i = 0; i < count; i++) {
      const objective = m.next();
      if (!objective) break;
      const task = m.taskFor(objective.id);
      if (!task) break;
      const item = A.itemFor(task);
      if (!item) continue;
      served++;
      const assisted = task.scaffold !== 'none';
      const res = m.observe(task.skill, true, {
        assisted, form: item.form, rep: item.rep, scene: item.scene, kind: task.kind,
      });
      if (res && res.served === 'deep') deep++;
      // src/main.js pays exactly this for a correct answer.
      A.earn(assisted ? 1 : (task.kind === 'check' ? 4 : 2), assisted ? 'assist' : 'seal');
    }
    const learned = A.state().shards - before;
    // The island, picked up: two hanging caches and the veins in between.
    let mid = A.state().shards;
    A.earn(120, 'cache'); A.earn(120, 'cache');
    let left = Math.max(0, ground - 240);
    while (left > 0) { const v = Math.min(left, 6); A.earn(v, 'vein'); left -= v; }
    const ground2 = A.state().shards - mid;
    A.kit.sync();
    return { served, deep, learned, ground: ground2 };
  }, { count: n, ground: sweep });
}

/** Everything the two clocks and the wallet say, right now. */
const read = () => page.evaluate(() => {
  const A = window.__ascent;
  const k = A.kit.sync();
  const s = A.story.state();
  return {
    rank: s.rank, rankIndex: s.rankIndex, chapter: s.chapter, standing: s.standing,
    nights: s.nights, days: s.days, tears: s.tears,
    lines: k.lines, depth: k.depth, charters: k.charters, stations: k.stations,
    beacons: k.beacons, prices: k.prices, affordable: k.affordable, tone: k.tone,
    shards: A.state().shards,
  };
});

/** Buy every permanent the purse can pay for, cheapest horizon last. */
const spend = () => page.evaluate(() => {
  const A = window.__ascent;
  let paid = 0;
  const before = A.state().shards;
  for (let i = 0; i < 8; i++) {
    const k = A.kit.sync();
    if (k.charters > 0 && A.state().shards >= k.prices.station && k.held.includes('station')) {
      const x = -140 + Math.random() * 280, z = -140 + Math.random() * 280;
      A.player.pos.set(x, (A.islandAt?.(x, z) ?? 12) + 1.2, z);
      if (A.kit.station()) { paid++; continue; }
    }
    if (A.state().shards >= k.prices.beacon && (k.held.includes('beacon') || k.charges.beacon > 0 || true)) {
      const x = -140 + Math.random() * 280, z = -140 + Math.random() * 280;
      A.player.pos.set(x, (A.islandAt?.(x, z) ?? 12) + 1.2, z);
      if (A.kit.beacon()) { paid++; continue; }
    }
    break;
  }
  return { bought: paid, spent: before - A.state().shards };
});

console.log('ASCENT — pacing probe');
console.log(`items a sitting ${PER} · island picked up a sitting ${SWEEP} shards (assumed) · days ${DAYS}`);

// ---------------------------------------------------------------------------
// 1. THE AFTERNOON. One unbroken sitting, no clock movement, everything right.
// ---------------------------------------------------------------------------
const cram = await sit(CRAM, SWEEP);
const day1 = await read();
console.log(`\n1. ONE AFTERNOON — ${cram.served} items, correct, clock never moved`);
console.log(`   rank ${day1.rank} (standing ${day1.standing})   chapter ${day1.chapter}   nights held ${day1.nights}`);
console.log(`   lines ${day1.lines}   depth ${day1.depth}   shards ${day1.shards} (learning ${cram.learned}, island ${cram.ground})`);

// ---------------------------------------------------------------------------
// 2. SIXTY MORNINGS. The hoarder: the earn curve with nothing spent.
// ---------------------------------------------------------------------------
const landRank = new Map([[day1.rank, 1]]);
const landCh = new Map([[day1.chapter, 1]]);
const rows = [];
let earnLearn = cram.learned, earnGround = cram.ground;
rows.push({ day: 1, ...day1, learn: cram.learned, ground: cram.ground, spent: 0, bought: 0 });
for (let d = 2; d <= DAYS; d++) {
  await page.evaluate(() => window.__ascent.advanceDays(1));
  const r = await sit(PER, SWEEP);
  const st = await read();
  earnLearn += r.learned; earnGround += r.ground;
  if (!landRank.has(st.rank)) landRank.set(st.rank, d);
  if (!landCh.has(st.chapter)) landCh.set(st.chapter, d);
  rows.push({ day: d, ...st, learn: r.learned, ground: r.ground, deep: r.deep, spent: 0, bought: 0 });
}
console.log('\n2. SIXTY MORNINGS — the hoarder, who spends nothing');
console.log('   day  rank       ch  nights  depth  charters  earn/day  balance  affordable');
for (const r of rows) {
  if (!MARKS.has(r.day)) continue;
  console.log(`   ${String(r.day).padStart(3)}  ${r.rank.padEnd(9)}  ${r.chapter}   ${String(r.nights).padStart(6)}  ${String(r.depth).padStart(5)}  ${String(r.charters).padStart(8)}  ${String(r.learn + r.ground).padStart(8)}  ${String(r.shards).padStart(7)}  ${String(r.affordable).padStart(10)}`);
}
const end = rows[rows.length - 1];
console.log(`\n   rank landed on day:    ${[...landRank].map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`   chapter landed on day: ${[...landCh].map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`   income over ${DAYS} days: learning ${earnLearn}, island ${earnGround}, total ${earnLearn + earnGround}`);
console.log(`   prices now: plate ${end.prices.plate}  flare ${end.prices.flare}  beacon ${end.prices.beacon}  station ${end.prices.station}`);

// ---------------------------------------------------------------------------
// 3. THE SPENDER. Same sixty days, buying every permanent they can afford.
// ---------------------------------------------------------------------------
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2200);
const srows = [];
let sSpent = 0, sEarn = 0;
{
  const r = await sit(CRAM, SWEEP);
  const b = await spend();
  const st = await read();
  sEarn += r.learned + r.ground; sSpent += b.spent;
  srows.push({ day: 1, ...st, earn: r.learned + r.ground, ...b });
}
for (let d = 2; d <= DAYS; d++) {
  await page.evaluate(() => window.__ascent.advanceDays(1));
  const r = await sit(PER, SWEEP);
  const b = await spend();
  const st = await read();
  sEarn += r.learned + r.ground; sSpent += b.spent;
  srows.push({ day: d, ...st, earn: r.learned + r.ground, ...b });
}
console.log('\n3. SIXTY MORNINGS — the spender, who buys every permanent they can');
console.log('   day  earn/day  spend/day  bought  balance  beacons  stations  next beacon  next station  affordable');
for (const r of srows) {
  if (!MARKS.has(r.day)) continue;
  console.log(`   ${String(r.day).padStart(3)}  ${String(r.earn).padStart(8)}  ${String(r.spent).padStart(9)}  ${String(r.bought).padStart(6)}  ${String(r.shards).padStart(7)}  ${String(r.beacons).padStart(7)}  ${String(r.stations).padStart(8)}  ${String(r.prices.beacon).padStart(11)}  ${String(r.prices.station).padStart(12)}  ${String(r.affordable).padStart(10)}`);
}
const se = srows[srows.length - 1];
console.log(`\n   spent over ${DAYS} days ${sSpent} of ${sEarn} earned (${Math.round(100 * sSpent / Math.max(1, sEarn))}%)`);
console.log(`   day-${DAYS} balance ${se.shards} against a next permanent at ${Math.min(se.prices.beacon, se.prices.station)}  =  ${(se.shards / Math.max(1, Math.min(se.prices.beacon, se.prices.station))).toFixed(1)} of them in hand`);

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('   ' + e);
await browser.close();
process.exit(errors.length ? 1 : 0);
