#!/usr/bin/env node
/**
 * DOES THE LOOP STILL NEED THE WORLD? — a sitting, measured at 1 Hz.
 *
 *   node tools/critic/motion.mjs --url http://127.0.0.1:4173 --minutes 18
 *   node tools/critic/motion.mjs --self-test
 *   tools/critic/rungate.sh tools/critic/motion.mjs --out shots/motion --minutes 18
 *
 * Exit 0 = the sitting moved.
 *
 * THE FINDING THIS GATE EXISTS FOR, measured by a critic across 23 minutes:
 *
 *   "The cadet moved horizontally for 35 SECONDS and covered 128 m of ground.
 *    The first 12.7 minutes contained 13 seconds of motion — one 11-second walk
 *    of 52 m — after which he stood on the same square metre at
 *    (-0.5, 57.7, -26.3) for 614 CONSECUTIVE SECONDS while a ring fed him 17
 *    questions in place."
 *
 * It is the exact mirror of the finding `tools/critic/traffic.mjs` was written
 * for — *70-82% of a session is traversal through space that was never
 * composed* — and that matters more than either number on its own. THE FIX FOR
 * THE FIRST ONE REMOVED TRAVERSAL INSTEAD OF COMPOSING IT. A gate with a
 * ceiling and no floor will certify that trade every time, so this is the
 * floor, and the two are meant to be read together: traffic says *the walk must
 * not be through nothing*, this says *there must be a walk*.
 *
 * WHAT IT MEASURES, on the frame loop, in the words the report used:
 *
 *   MOVING     seconds in which the cadet's feet actually went somewhere
 *   METRES     ground covered, horizontally
 *   STILLEST   the longest unbroken run of seconds inside one 2 m circle,
 *              WHATEVER IS ON SCREEN. A card is not an excuse: the reported
 *              614 seconds were spent with a ring feeding questions, and a loop
 *              that can feed seventeen questions to a body that never moves has
 *              stopped needing the world whether or not the questions are good.
 *   VERBS      how many times the sitting used each thing the game owns —
 *              sprint, dash, glide, updraft, vault, build. The complaint is
 *              specifically that "the flying, gliding, dashing game is a menu
 *              that appears when you touch a ring", so the verbs are counted
 *              one by one and named when they are never used at all.
 *
 * Every input is a real key or a real mouse press from a cleared save.
 * `window.__ascent` is read for facts — where the objective is, what is on the
 * card — and never used to make the game do anything.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { answerCard } from './_play.mjs';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/motion'));
const MINUTES = Number(arg('minutes', 18));
const SELFTEST = process.argv.includes('--self-test');

/**
 * THE THREE BARS, and where each number comes from.
 *
 * `MOVING_MIN` — the share of a sitting the cadet is going somewhere. The
 * reported sitting was 35 s of 1,380 = **2.5%**. A player walking between ten
 * tears at six metres a second over an island a hundred and fifty metres across
 * cannot get under this without the loop having taken the world away from him.
 * It is deliberately well under `traffic.mjs`'s 34% ceiling on the walk through
 * nothing: the two bars leave a wide band between them and do not squeeze.
 *
 * `STILL_MAX` — the longest a sitting may park. 614 s was the report. Three
 * items is what one arrival at a tear buys (src/session/stint.js), an item
 * costs about 25 s of a learner's time (src/learn/mastery.js `itemSeconds`),
 * and a cadet reading a worked echo after a miss can honestly spend twice that
 * on one — so about 150 s is one full stint worked slowly without moving, and
 * the bar is set past it at 210 so that a slow learner is never the thing that
 * fails. Two stints in a row from one square metre is not a slow learner, it is
 * a menu.
 *
 * `VERB_MIN` — how many of the six verbs a sitting has to touch at least once.
 * The game owns sprint, dash, glide, updraft, vault and the build hand. Zero is
 * the reported number.
 */
const MOVING_MIN = Number(arg('moving', 0.10));
const STILL_MAX = Number(arg('still', 210));
const VERB_MIN = Number(arg('verbs', 3));
/** Metres the feet have to leave to count as having gone somewhere. */
const STEP_M = 0.55;
/** Radius of the circle a cadet has to leave to break a stationary run. */
const PARK_M = 2.0;

const fails = [];
const note = (ok, label, detail = '') => {
  if (!ok) fails.push(`${label}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

/**
 * THE SELF-TEST runs the verdict over fabricated sittings, with no browser, in
 * a second — a healthy one, the sitting the report describes, one that moves
 * but never uses a verb, and one that moves plenty and still parks for eleven
 * minutes in the middle. It has to say the right thing about each, and it has
 * to stay quiet on the honest one.
 */
const verdict = (m) => {
  const out = [];
  const share = m.seconds ? m.moving / m.seconds : 0;
  if (share < MOVING_MIN) {
    out.push(`the cadet went somewhere for ${m.moving}s of ${m.seconds}s `
      + `(${(share * 100).toFixed(1)}%, bar ${(MOVING_MIN * 100).toFixed(0)}%) and covered ${m.metres.toFixed(0)} m`);
  }
  if (m.stillest > STILL_MAX) {
    out.push(`he stood inside one ${PARK_M} m circle for ${m.stillest.toFixed(0)} consecutive seconds `
      + `(bar ${STILL_MAX})${m.stillestAt ? ` at ${m.stillestAt.join(', ')}` : ''}`
      + `${m.stillestItems ? `, and a ring fed him ${m.stillestItems} questions while he was there` : ''}`);
  }
  const used = Object.entries(m.verbs).filter(([, n]) => n > 0);
  if (used.length < VERB_MIN) {
    const never = Object.entries(m.verbs).filter(([, n]) => !n).map(([k]) => k);
    out.push(`the sitting used ${used.length} of the ${Object.keys(m.verbs).length} verbs the game owns `
      + `(bar ${VERB_MIN}); never used: ${never.join(', ')}`);
  }
  return out;
};

if (SELFTEST) {
  const V = (o) => ({ sprint: 0, dash: 0, glide: 0, updraft: 0, vault: 0, build: 0, ...o });
  const healthy = { seconds: 1080, moving: 260, metres: 1420, stillest: 96, verbs: V({ sprint: 41, glide: 3, build: 9, dash: 2 }) };
  const reported = { seconds: 1380, moving: 35, metres: 128, stillest: 614, stillestAt: [-0.5, 57.7, -26.3], stillestItems: 17, verbs: V({}) };
  const noVerbs = { seconds: 1080, moving: 300, metres: 1600, stillest: 90, verbs: V({ sprint: 12 }) };
  const parked = { seconds: 1380, moving: 300, metres: 1700, stillest: 660, verbs: V({ sprint: 30, glide: 2, build: 4 }) };
  // …and a slow learner who really did work one whole stint from one spot:
  // three items, a miss and a worked echo on each. He must pass.
  const slow = { seconds: 1080, moving: 190, metres: 980, stillest: 178, verbs: V({ sprint: 22, build: 3, glide: 1 }) };

  note(verdict(healthy).length === 0, 'a sitting that moves passes', verdict(healthy).join(' | ') || '24% moving, 1420 m, parks 96 s, four verbs');
  const r = verdict(reported);
  note(r.length === 3, 'the sitting the report describes fails on all three counts', `${r.length}/3: ${r.join(' | ')}`);
  const nv = verdict(noVerbs);
  note(nv.length === 1 && /verbs/.test(nv[0]), 'a sitting that walks and never uses a verb fails on the verbs alone', nv.join(' | '));
  const pk = verdict(parked);
  note(pk.length === 1 && /circle/.test(pk[0]), 'a sitting that moves plenty and still parks for eleven minutes fails on the park alone', pk.join(' | '));
  note(verdict(slow).length === 0, 'and a slow learner who works one whole stint without moving still passes',
    verdict(slow).join(' | ') || 'parks 178 s, under the 210 s bar');
  if (fails.length) { console.error(`\nself-test: ${fails.length} bar(s) do not separate`); process.exit(1); }
  console.log('\nself-test: ok — every bar fires on the sitting it names and stays quiet on the one beside it');
  process.exit(0);
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2400);

/**
 * PROVE THE INSTRUMENT CAN PLAY, ON THE REAL BUILD, BEFORE MEASURING ANYTHING.
 *
 * This gate has been red for four rounds on a number its own JSON contradicts,
 * and the largest single reason was that its `answer()` could not press the
 * buttons three of the six surfaces draw. A moving-share of 3.6% measured by a
 * harness that cannot answer a sorting board is not a reading about the game;
 * it is a reading about the harness. So before the sitting starts, one card of
 * every surface `src/ui/rift.js` `_mount()` can build is put up and ANSWERED,
 * and the gate refuses to report a sitting if any of them could not be.
 *
 * `showItem` is used to PUT THE CARD UP — that is the debug API arranging a
 * test of this harness, not this harness making the game do anything. Every
 * press that answers it is a real click or a real key on the mounted surface,
 * exactly as during the sitting, through the same `answerCard`.
 *
 * AND IT PLANTS THE FAULT IT EXISTS TO CATCH, on every ordinary run: the old
 * strategy — "one honest click on `.rf-move, .rf-cell, .ans`" — is run against
 * the real area field and REQUIRED to leave the card unsettled. If a change to
 * the rig ever made that blind click work, this leg would say so instead of
 * quietly agreeing with a harness that presses nothing.
 */
const SURFACE_CASES = [
  ['choice', 'var-meaning', 'vm-share', null],
  ['keypad', 'eval-expr', 'ee-linear', null],
  // `lt-bays`, not `lt-collect`: the sorting bays are one bay per LIKE-CLASS
  // now, and `src/ui/rift.js` refuses a board that does not carry two
  // different letters — a two-bay board of "has a letter" and "has no
  // letter" is a glyph match, not a question about like terms — so
  // `lt-collect` goes to the keypad and this leg would prove nothing.
  ['sort', 'like-terms', 'lt-bays', null],
  ['balance', 'two-step', 'ts-symbolic', null],
  ['area', 'distribute', 'ds-area', null],
  /* THE COORDINATE PLOT IS IN LEVEL 2, and a boot with no query string
     registers the manifest default — one unit — so `graph-linear` is not in
     the registry and `showItem` returns null. It is still ON THE SHIPPED ROUTE
     (`content/courses.json` route.units names both levels), which is exactly
     why the harness has to be able to play it: a cadet who clears Level 1
     walks into it. So this one case is proved on a boot that HAS it, and the
     clean boot is restored afterwards, before a single second of the sitting
     is measured. */
  ['plot', 'graph-linear', 'gl-plot-points', 'algebra1-l2'],
];

const shutCard = async () => {
  for (let i = 0; i < 6; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(240);
  }
  return false;
};

const bootAt = async (query) => {
  await page.goto(query ? `${URL}/?unit=${query}` : URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1800);
};

async function proveSurfaces() {
  const rows = [];
  let booted = null;
  for (const [want, skill, form, unit] of SURFACE_CASES) {
    if (unit !== booted) { await bootAt(unit); booted = unit; }
    const shown = await page.evaluate(([s, f]) => {
      try { return window.__ascent.showItem(s, { form: f, difficulty: 3, seed: 4242 }); }
      catch (e) { return { error: String(e && e.message ? e.message : e) }; }
    }, [skill, form]);
    await page.waitForTimeout(700);
    const mode = await page.evaluate(() => window.__ascent.panelInfo().mode || null);
    let r = { acted: false, settled: false, how: `the card never opened (${shown && shown.error ? shown.error : 'showItem returned nothing'})` };
    if (mode) r = await answerCard(page);
    rows.push({ want, skill, form, unit, mode, shown, ...r });
    await shutCard();
  }
  /* The plant: the strategy that pressed nothing, on the surface it pressed
     nothing on, required to still press nothing. */
  if (booted !== null) { await bootAt(null); booted = null; }
  await page.evaluate(() => { try { window.__ascent.showItem('distribute', { form: 'ds-area', difficulty: 3, seed: 4242 }); } catch { /* reported below */ } });
  await page.waitForTimeout(700);
  const hadField = await page.evaluate(() => !!document.querySelector('.rf-cell'));
  const blind = await page.$('.rf-move, .rf-cell, .ans');
  if (blind) await blind.click().catch(() => {});
  await page.waitForTimeout(900);
  const blindSettled = await page.evaluate(() => !!window.__ascent.panelInfo().settled);
  await shutCard();

  console.log('the instrument, before the sitting — one card of every surface the rig can build:');
  for (const r of rows) {
    console.log(`  ${r.settled ? '  ok  ' : ' FAIL '} ${r.want.padEnd(8)} ${`${r.skill}/${r.form}`.padEnd(28)} `
      + `mounted as ${String(r.mode).padEnd(8)} ${r.how}${r.unit ? `   [booted ?unit=${r.unit}]` : ''}`);
  }
  console.log(`  ${hadField && !blindSettled ? '  ok  ' : ' FAIL '} the plant — one blind click on \`.rf-move, .rf-cell, .ans\` at the real area field `
    + `${hadField ? (blindSettled ? 'SETTLED IT, so this gate is no longer testing anything' : 'settles nothing, as src/ui/rift.js:3949 says') : 'found no field to click at all'}`);
  console.log('');
  return {
    rows,
    blindOk: hadField && !blindSettled,
    bad: rows.filter((r) => !r.settled),
  };
}

const instrument = await proveSurfaces();

/* THE CLEAN BOOT, RESTORED. Every reading below has to be about a cadet with no
   query string and no save, which is what this gate has always claimed to
   measure — so the proving above ends by putting that boot back, and the
   instrument is not installed until it is. */
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2400);
errors.length = 0;

// ---------------------------------------------------------------------------
// THE INSTRUMENT. It rides the frame loop, because a poll over the wire is
// both too coarse to see a stationary run break and heavy enough to change it.
// Sampled at 1 Hz — the critic's own rate — off the real player position and
// the real locomotion state.
// ---------------------------------------------------------------------------
await page.evaluate(([stepM, parkM]) => {
  const a = window.__ascent;
  const S = {
    on: true, t0: performance.now() / 1000, last: performance.now() / 1000,
    seconds: 0, moving: 0, metres: 0,
    px: a.player.pos.x, pz: a.player.pos.z,
    parkX: a.player.pos.x, parkZ: a.player.pos.z, park: 0, stillest: 0,
    stillestAt: null, stillestItems: 0, parkItems: 0, items: 0,
    verbs: { sprint: 0, dash: 0, glide: 0, updraft: 0, vault: 0, build: 0 },
    wasSprint: false, wasDash: false, wasGlide: false, wasVault: false, lifts: 0,
    pieces: 0, track: [],
  };
  window.__MOT = S;
  const tick = () => {
    try {
      const now = performance.now() / 1000;
      if (now - S.last >= 1) {
        const dt = now - S.last; S.last = now;
        const p = a.player.pos, L = a.player.loco || a.player;
        const d = Math.hypot(p.x - S.px, p.z - S.pz);
        S.seconds += dt;
        S.metres += d;
        if (d > stepM) S.moving += dt;
        S.px = p.x; S.pz = p.z;
        if (Math.hypot(p.x - S.parkX, p.z - S.parkZ) > parkM) {
          S.parkX = p.x; S.parkZ = p.z; S.park = 0; S.parkItems = 0;
        } else {
          S.park += dt;
          if (S.park > S.stillest) {
            S.stillest = S.park;
            S.stillestAt = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)];
            S.stillestItems = S.parkItems;
          }
        }
        S.track.push([Math.round(now - S.t0), +p.x.toFixed(1), +p.z.toFixed(1), +d.toFixed(2)]);
      }
      // The verbs, edge-triggered, off the locomotion state the game runs on.
      //
      // EVERY NAME HERE IS THE ONE src/player/locomotion.js REALLY USES, and
      // that sentence is in this file because the first cut of it was not: it
      // read `L.sprinting`, which does not exist, and `player.speedN`, which
      // lives on the locomotion and not on the controller. Both are `undefined`,
      // both compare false, and the gate duly reported a sitting that held
      // Shift for minutes as having sprinted ZERO times. An instrument that
      // measures nothing says the same thing as a game that does nothing.
      const L = a.player.loco || {};
      const sp = (L.speedN ?? 0) > 0.82;
      if (sp && !S.wasSprint) S.verbs.sprint++;
      S.wasSprint = sp;
      const dsh = (L.dashT || 0) > 0;
      if (dsh && !S.wasDash) S.verbs.dash++;
      S.wasDash = dsh;
      const gl = !!L.gliding;
      if (gl && !S.wasGlide) S.verbs.glide++;
      S.wasGlide = gl;
      const mt = (L.mantleT || 0) > 0;
      if (mt && !S.wasVault) S.verbs.vault++;
      S.wasVault = mt;
      // The drift counts its own lifts (src/world/drift.js `stats.lifts`), so
      // this is a delta on the world's own counter rather than a guess at a
      // flag that may not exist.
      const lifts = a.drift?.stats?.lifts | 0;
      if (lifts > S.lifts) { S.verbs.updraft += lifts - S.lifts; S.lifts = lifts; }
      const pc = a.builder?.solids?.owned ?? a.builder?.pieces?.size ?? 0;
      if (pc > S.pieces) { S.verbs.build += pc - S.pieces; S.pieces = pc; }
    } catch { /* a frame mid-teardown is not evidence */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, [STEP_M, PARK_M]);

const facts = () => page.evaluate(() => {
  const a = window.__ascent;
  const p = a.player.pos;
  const pi = a.panelInfo();
  return {
    x: p.x, y: p.y, z: p.z, yaw: a.player.yaw,
    panel: !!pi.open, answer: pi.open ? String(pi.answer) : null,
    ui: !!a.input.uiOpen, stuck: !!a.player.stuck,
  };
});
const release = async () => {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ArrowLeft', 'ArrowRight', 'Space']) {
    await page.keyboard.up(k).catch(() => {});
  }
};
const handBack = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  return false;
};

/** What the objective card is actually pointing at. A player steers by this. */
const objective = () => page.evaluate(() => {
  const a = window.__ascent;
  const g = a.mastery.next?.();
  const id = g && (g.skill || g.id || g.skillId);
  const r = id ? a.rifts.list.find((x) => x.id === id) : null;
  const pick = r || a.rifts.list.find((x) => !x.locked && !x.mastered) || a.rifts.list[0];
  if (!pick) return null;
  return { id: pick.id, x: pick.foot ? pick.foot.x : pick.pos.x, z: pick.foot ? pick.foot.z : pick.pos.z };
});

/**
 * ANSWER THE CARD — on all six surfaces, through `tools/critic/_play.mjs`.
 *
 * WHAT WAS HERE, AND WHY IT MADE THIS GATE'S NUMBER MEANINGLESS.
 *
 * Two rounds ago this function looked for `.rf-opt`, `.rf-choice button` and
 * `.rf-choices button`, none of which exist anywhere in `src/`; that was fixed
 * and the sort was added. WHAT WAS STILL LEFT was one line:
 *
 *     } else if (await page.$('.rf-move, .rf-cell, .ans')) {
 *       await (await page.$('.rf-move, .rf-cell, .ans')).click();
 *
 * — "the balance, the plate and the area grid, one honest click". It is not an
 * answer on any of the three:
 *
 *  · `src/ui/rift.js:3949` — the area field's cells run
 *    `self._click(cell, () => { if (!picked) return; … })`. A click with no
 *    chip picked IS A NO-OP. Worse, the area field's chips are `.rf-chip`,
 *    the same class the sorting bays use, so an area card never even reached
 *    this branch: it fell into the sorter above, looked for a `.rf-bay` the
 *    area surface does not have, broke out of the loop having placed nothing,
 *    and then counted an item as answered.
 *  · the balance beam needs three to five moves; it got one blind click on
 *    whichever button was first in the DOM.
 *  · the coordinate plot has no `.rf-reading`, no `.rf-chip` and no `.rf-move`,
 *    so it fell all the way through to the typing branch, which typed
 *    `y = 3x + 1` at a surface with no socket to type into.
 *
 * A card that is never answered never settles; the scheduler has no reason to
 * move; the cadet stands on that plate for the rest of the sitting. The park
 * this gate reports is partly the game and was partly this function.
 *
 * NOTHING ABOUT THE BARS HAS CHANGED — 10%, 210 s and three verbs are what
 * they were, and the self-test above still separates every fabricated sitting.
 * What changed is that the cadet can now answer the question in front of him,
 * and that `S.items` counts an item ONLY when something was actually pressed:
 * a harness that counts a no-op as an answer is how 336 items got served to a
 * body that never moved.
 */
const unpressed = new Map();
async function answer() {
  const f = await facts();
  if (!f.panel) return false;
  const r = await answerCard(page);
  /* A CARD THAT IS ALREADY SEALED IS NOT AN UNPRESSABLE CARD. The rig keeps the
     panel up through the seal beat, so the loop's next pass finds `open` true
     and `settled` true; counting that as "nothing could be pressed" made the
     first cut of this leg report six unpressable keypads in a sitting where
     every keypad had in fact been answered. */
  if (r.done) return false;
  if (!r.acted) {
    unpressed.set(r.mode || '?', (unpressed.get(r.mode || '?') || 0) + 1);
    return false;
  }
  await page.evaluate(() => { const S = window.__MOT; S.items++; S.parkItems++; });
  await page.waitForTimeout(900);
  return true;
}

async function walkTo(target, budgetMs) {
  const t0 = Date.now();
  let held = false;
  while (Date.now() - t0 < budgetMs) {
    const f = await facts();
    if (f.panel) { if (held) await page.keyboard.up('KeyW'); return 'panel'; }
    if (f.ui) { if (held) { await page.keyboard.up('KeyW'); held = false; } await handBack(); continue; }
    if (f.stuck) { await release(); await page.keyboard.press('KeyR'); await page.waitForTimeout(700); held = false; continue; }
    const dx = target.x - f.x, dz = target.z - f.z;
    if (Math.hypot(dx, dz) < 5) { if (held) await page.keyboard.up('KeyW'); return 'arrived'; }
    let d = ((Math.atan2(dx, dz) - f.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    if (Math.abs(d) > 0.10) {
      const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(360, Math.max(50, Math.abs(d) / 2.6 * 1000)));
      await page.keyboard.up(key);
    } else {
      await page.keyboard.down('ShiftLeft');
      await page.waitForTimeout(150);
    }
  }
  if (held) await page.keyboard.up('KeyW');
  return 'timeout';
}



console.log(`playing for ${MINUTES} minutes at ${URL}\n`);
await page.mouse.click(800, 450);
await handBack();
const t0 = Date.now();
/* A BROWSER THAT DIES MID-SITTING IS NOT A FINDING ABOUT THE GAME.
   An eighteen-minute run outlives a lot, and on 2026-08-29 this gate ended with
   an uncaught `Target page, context or browser has been closed` at minute
   twelve — which npm reports as a red gate with no numbers in it at all, and a
   red gate that says nothing about the product is how gates stop being read.
   The loss is recorded as an ENGINE finding, with the minute it happened at, so
   the run is refused for the honest reason: this harness stopped measuring. */
let lost = null; 
let shots = 0;
const shotAt = [1, 8, 18].filter((m) => m <= MINUTES + 1);
try {
while (Date.now() - t0 < MINUTES * 60000) {
  const mins = (Date.now() - t0) / 60000;
  if (shots < shotAt.length && mins >= shotAt[shots]) {
    await page.screenshot({ path: path.join(OUT, `min-${shotAt[shots]}.png`) }).catch(() => {});
    shots++;
  }
  await handBack();
  const target = await objective();
  if (!target) { await page.waitForTimeout(400); continue; }
  const got = await walkTo(target, 60000);
  if (got === 'arrived') {
    for (const k of ['KeyE', 'Enter']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(420);
      if (await page.evaluate(() => !!window.__ascent.panel?.open)) break;
    }
  }
  await release();
  // A player answers until the card stops coming back, exactly as a player does.
  for (let n = 0; n < 8; n++) {
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
    if (!(await answer())) break;
    await page.waitForTimeout(400);
    // the stint's offer: one press continues it, standing where you are
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(500);
    }
  }
  await handBack();
}
} catch (e) {
  lost = { at: Math.round((Date.now() - t0) / 1000), why: String(e && e.message ? e.message : e).split('\n')[0] };
  console.log(`\n  the sitting ended early at ${lost.at}s — ${lost.why}`);
}
await release();
for (const k of shotAt.slice(shots)) await page.screenshot({ path: path.join(OUT, `min-${k}.png`) }).catch(() => {});

const m = await page.evaluate(() => {
  const S = window.__MOT;
  return {
    seconds: Math.round(S.seconds), moving: Math.round(S.moving), metres: S.metres,
    stillest: S.stillest, stillestAt: S.stillestAt, stillestItems: S.stillestItems,
    items: S.items, verbs: S.verbs, track: S.track,
  };
});
await page.screenshot({ path: path.join(OUT, 'final.png') }).catch(() => {});

console.log(`\nsat for ${(m.seconds / 60).toFixed(1)} min, ${m.items} items answered`);
console.log(`  moving        ${m.moving} s of ${m.seconds} s (${(m.moving / m.seconds * 100).toFixed(1)}%)`);
console.log(`  ground        ${m.metres.toFixed(0)} m`);
console.log(`  stillest      ${m.stillest.toFixed(0)} s inside one ${PARK_M} m circle`
  + `${m.stillestAt ? ` at ${m.stillestAt.join(', ')}` : ''}, ${m.stillestItems} items served there`);
console.log(`  verbs         ${Object.entries(m.verbs).map(([k, n]) => `${k} ${n}`).join('  ')}`);

const v = verdict(m);
for (const line of v) console.log(`  FAIL  ${line}`);
note(v.length === 0, 'the sitting needed the world');
note(errors.length === 0, 'no console errors during the sitting',
  errors.length ? errors.slice(0, 3).join(' | ') : `${m.items} items`);
const blindTotal = [...unpressed.values()].reduce((a, b) => a + b, 0);
note(blindTotal === 0, 'every card the sitting met could be pressed',
  blindTotal ? [...unpressed.entries()].map(([k, n]) => `${k} x${n}`).join(', ')
    : `${m.items} items answered on the surfaces the rig built`);

await writeFile(path.join(OUT, 'motion.json'), JSON.stringify({
  url: URL, minutes: MINUTES, ...m, errors,
  instrument: { rows: instrument.rows, blindOk: instrument.blindOk },
  unpressed: [...unpressed.entries()],
}, null, 1));
await browser.close();

/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs.
   The sitting IS the shipped route, so a bar that fires is a route finding. An
   instrument that could not press a surface is an ENGINE finding: it is not a
   defect in a unit, it is this gate being unable to measure, and a gate that
   reports a movement number it could not have measured is the disease this
   whole wave is about. */
const F = findings('check:motion', { scope: 'route' });
F.route(v);
if (errors.length) F.route(`the sitting logged ${errors.length} console error(s): ${errors.slice(0, 3).join(' | ')}`);
for (const r of instrument.bad) {
  F.engine(`THE INSTRUMENT CANNOT PLAY the ${r.want} surface (${r.skill}/${r.form}, mounted as ${r.mode}): ${r.how}. `
    + 'Every number below is a reading about this harness, not about the game.');
}
if (!instrument.blindOk) {
  F.engine('the planted fault did not fire: one blind click on `.rf-move, .rf-cell, .ans` at the real area field '
    + 'settled it, so this gate is no longer proving that the old strategy pressed nothing');
}
for (const [mode, n] of unpressed) {
  F.engine(`${n} card(s) on the ${mode} surface were met during the sitting and nothing could be pressed on them — `
    + 'the park below is partly this harness');
}
if (lost) {
  F.engine(`THE HARNESS STOPPED MEASURING at ${lost.at}s of ${MINUTES * 60}s — ${lost.why}. `
    + 'The numbers above are a partial sitting and are not evidence about the game.');
}
F.done();
