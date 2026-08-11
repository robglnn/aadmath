/**
 * THE ENDGAME PROBE — does coming back actually buy anything?
 *
 * Two claims are checked against the real running game, never a model of it:
 *
 *   1. SPACING IS TIME, NOT ATTEMPTS. A player who sits down and answers three
 *      hundred items without leaving must earn *zero* durable re-probes, and
 *      therefore must not be able to reach a single depth-keyed kit grant. The
 *      same player who comes back the next day must earn them. This is the
 *      exploit the last critic found, driven through the shipping engine.
 *
 *   2. THE LADDER DOES NOT END. Past the twelfth grant `kit.next` must never be
 *      null, there must always be a next charter, and a charter plus two
 *      hundred and forty shards must buy something that changes the island.
 *
 * It plays the real scheduler at speed — the same way tools/critic/testout.mjs
 * does — and moves the wall clock with `__ascent.advanceDays`, which is the
 * only clock the retention schedule reads.
 *
 *   node tools/critic/endgame.mjs --url http://127.0.0.1:5173 [--shots shots/endgame]
 *   SNAPSHOT_PORT=4567 tools/critic/snapshot.sh shots/endgame --script endgame
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = arg('shots', 'shots/endgame');
const SITTINGS = Number(arg('sittings', 20));
const PER = Number(arg('items', 34));

await mkdir(path.resolve(OUT), { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

/** Play `n` items through the real scheduler, answering everything correctly. */
async function play(n) {
  return page.evaluate(async (count) => {
    const A = window.__ascent;
    const m = A.mastery;
    const kinds = {};
    let served = 0;
    for (let i = 0; i < count; i++) {
      const objective = m.next();
      if (!objective) break;
      const task = m.taskFor(objective.id);
      if (!task) break;
      const item = A.itemFor(task);
      if (!item) continue;
      kinds[task.kind] = (kinds[task.kind] || 0) + 1;
      served++;
      m.observe(task.skill, true, {
        assisted: task.scaffold !== 'none', form: item.form, rep: item.rep,
        scene: item.scene, kind: task.kind,
      });
    }
    A.kit.sync();
    return { served, kinds };
  }, n);
}

const read = () => page.evaluate(() => {
  const A = window.__ascent;
  const k = A.kit.sync();
  return {
    lines: k.lines, temper: k.temper, depth: k.depth, held: k.held, next: k.next,
    charters: k.charters, stations: k.stations, toCharter: k.toCharter,
    sounding: k.sounding, shards: A.state().shards, watch: A.watch(),
  };
});

// ---------------------------------------------------------------------------
// 1. THE EXPLOIT: one unbroken sitting, three hundred items, no leaving
// ---------------------------------------------------------------------------
const cram = await play(300);
const afterCram = await read();

console.log('ASCENT — endgame probe');
console.log(`\n1. one unbroken sitting, ${cram.served} items answered correctly, clock never moved`);
console.log(`   item kinds served        ${JSON.stringify(cram.kinds)}`);
console.log(`   lines held               ${afterCram.lines}`);
console.log(`   durable re-probes        ${afterCram.temper}   <- must be 0: nothing survived a night`);
console.log(`   kit depth                ${afterCram.depth}`);
console.log(`   kit grants held          ${afterCram.held.length}  ${afterCram.held.join(' ')}`);
console.log(`   deepest sounding         ${afterCram.sounding.best}`);
console.log(`   shards earned            ${afterCram.shards}`);

// ---------------------------------------------------------------------------
// 2. COMING BACK: the same player, a day at a time
// ---------------------------------------------------------------------------
console.log(`\n2. coming back — ${SITTINGS} further sittings of ${PER} items, one day apart`);
console.log('   sitting  reviews  durable  depth  grants  charters  stations  sounding  shards');
const landed = new Map(afterCram.held.map((h) => [h, 0]));
for (let s = 1; s <= SITTINGS; s++) {
  await page.evaluate(() => window.__ascent.advanceDays(1));
  const r = await play(PER);
  const st = await read();
  for (const h of st.held) if (!landed.has(h)) landed.set(h, s);
  console.log(`   ${String(s).padStart(7)}  ${String(r.kinds.review || 0).padStart(7)}  ${String(st.temper).padStart(7)}  ${String(st.depth).padStart(5)}  ${String(st.held.length).padStart(6)}  ${String(st.charters).padStart(8)}  ${String(st.stations).padStart(8)}  ${String(st.sounding.best).padStart(8)}  ${String(st.shards).padStart(6)}`);
}
const end = await read();
console.log('\n   kit grant landed on sitting:');
for (const [id, n] of landed) console.log(`     ${id.padEnd(10)} ${n === 0 ? 'first sitting' : `sitting ${n}`}`);

// ---------------------------------------------------------------------------
// 3. THE LADDER DOES NOT END: spend a charter, raise a waystation, travel
// ---------------------------------------------------------------------------
const spendable = await page.evaluate(() => {
  const A = window.__ascent;
  const before = A.kit.sync();
  const purse = A.state().shards;
  if (before.charters < 1) return { skipped: true, charters: before.charters, toCharter: before.toCharter };
  // Two of them, far apart, so the second one has somewhere to travel to.
  A.player.pos.set(-40, (A.islandAt?.(-40, -14) ?? 12) + 1.2, -14);
  const one = A.kit.station();
  A.player.pos.set(58, (A.islandAt?.(58, -92) ?? 12) + 1.2, -92);
  const two = A.kit.station();
  if (!two) return { skipped: true, charters: A.kit.sync().charters, toCharter: A.kit.sync().toCharter, one };
  const at = { ...A.player.pos };
  const moved = A.kit.station();
  const now = A.kit.sync();
  return {
    one, two, moved, charters: now.charters, stations: now.stations,
    travelled: Math.hypot(A.player.pos.x - at.x, A.player.pos.z - at.z),
    next: now.next, toCharter: now.toCharter, shards: A.state().shards,
    spentShards: purse - A.state().shards, prices: A.kit.prices(),
    columns: A.drift.columns.length,
  };
});
console.log('\n3. the rung that is a rate');
console.log(`   charters in hand         ${end.charters}   next charter ${end.toCharter} depth away`);
console.log(`   kit.next                 ${end.next}   <- must never be null`);
if (spendable.skipped) console.log(`   (no charter yet — ${spendable.toCharter} depth short, so nothing was spent)`);
else {
  console.log(`   raised waystations       ${spendable.stations}  (spent ${spendable.spentShards} shards and ${end.charters - spendable.charters} charters; the next one costs ${spendable.prices.station})`);
  console.log(`   travelled between them   ${spendable.travelled.toFixed(0)} m on one keypress`);
  console.log(`   standing updraft columns ${spendable.columns}`);
  console.log(`   charters still to come   next in ${spendable.toCharter} depth — there is no last one`);
}

// ---------------------------------------------------------------------------
// 4. PIXELS
// ---------------------------------------------------------------------------
// Twenty sittings were just compressed into ten seconds, so every ceremony the
// game queues — twelve kit grants, four chapter plates, a rank rite — is still
// draining. Let it, or the pictures are of the queue rather than of the game.
await page.evaluate(() => {
  const A = window.__ascent;
  A.player.pos.set(-30, (A.islandAt?.(-30, 20) ?? 14) + 1.4, 20);
  A.player.vel.set(0, 0, 0);
  A.kit.sync();
});
await page.waitForTimeout(14000);
await page.screenshot({ path: path.join(OUT, 'watch.png') });
// The endgame card and the kit strip in all three languages — a surface that
// only exists in English is not a surface this game is allowed to ship.
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(OUT, `watch-${loc}.png`) });
}
await page.evaluate(() => window.__ascent.setLocale('en'));
await page.waitForTimeout(700);
await page.evaluate(() => {
  const A = window.__ascent;
  const m = A.mastery;
  const o = m.next();
  A.openRiftById(o.id);
});
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(OUT, 'sounding.png') });

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 6)) console.log('   ' + e);
console.log(`shots: ${OUT}/watch.png, ${OUT}/sounding.png`);
await browser.close();
process.exit(errors.length ? 1 : 0);
