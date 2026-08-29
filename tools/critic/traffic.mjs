#!/usr/bin/env node
/**
 * WHERE THE SESSION ACTUALLY GOES.
 *
 * THE FINDING THIS GATE EXISTS FOR, from a cold critic at 5/10 DO_NOT_SHIP:
 *
 *   "This game has exactly one composed frame and it is the one you land on.
 *    Everything after the landing plaza is uncomposed terrain the player is
 *    dropped into, and the game's own instrument says so: the Learner Record
 *    reads TIME ON TASK 4 min against 22 min this session, and 11 min against
 *    ~40 min by the end — 70-82% of a session is traversal through space that
 *    was never composed."
 *
 * That number was read off `report.snapshot()`, so the first thing this gate
 * does is read the same two figures the critic read. But TIME ON TASK is
 * measured *between answers* (src/report/track.js), which means the 70-82% is
 * not all walking: reading a worked echo, building, opening a cache and the
 * seal ceremony are all outside it too. Blaming the world for a beat that
 * belongs to the learning surface is the same instrument error that cost this
 * project a wave, so this gate measures the split ITSELF, on the frame loop:
 *
 *   WORK       a learning card owns the screen
 *   PLACE      no card, and the cadet is at a composed site — inside the
 *              landing plaza, at a waygate, a cache, a span, a warden or a
 *              tear's own plate. Walking here is *the game*, not the gap in it.
 *   TRAVERSE   no card, no site, and he is moving. This is the number the
 *              report is about: the walk through nothing.
 *   IDLE       no card, no site, standing still — lost, reading the card, or
 *              deciding.
 *
 * Every input is a real key or a real mouse press from a cleared save, and
 * `__ascent` is read only for facts — where the sites are, what is on the card,
 * what the two session clocks say. Nothing here makes progress through it.
 *
 *   node tools/critic/traffic.mjs --url http://127.0.0.1:4173 --minutes 18
 *   node tools/critic/traffic.mjs --self-test
 *
 * Exit 0 = less than --bar of the session is the walk through nothing.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findings } from '../_findings.mjs';
import { answerCard } from './_play.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/traffic'));
const MINUTES = Number(arg('minutes', 18));
const LOC = arg('loc', 'en');
const SELFTEST = process.argv.includes('--self-test');
/** Share of a sitting that may be the walk through nothing. */
const BAR = Number(arg('bar', 0.34));
/**
 * WHICH INSTRUMENT THE CADET STEERS BY.
 *
 *   mark   (default) the waypoint the objective card paints — `.gd-mark`, at
 *          the tear's own position. This is what a player sees, so it is what
 *          the sitting is measured through.
 *   route  the world's own routed heading, `world.headingTo`, read for a fact
 *          and then walked on real keys. This is not a player's session — it is
 *          the EXPERIMENT that says what the sitting would cost if the card
 *          pointed down the road instead of through the hill. The road itself
 *          already exists on the ground (the chevrons in src/world/afford.js);
 *          only the card's bearing is straight-line, and that file is another
 *          lane's. This flag is how the value of moving it is quoted in metres.
 */
const STEER = arg('steer', 'mark');
/** Metres a cadet may be asked to walk per item answered. */
const METRES_BAR = Number(arg('metres', 150));
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const fails = [];
const note = (ok, label, detail = '') => {
  if (!ok) fails.push(`${label}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

// ---------------------------------------------------------------------------
// THE SELF-TEST, and it runs before anything opens a browser.
//
// A gate that has never rejected anything is not a gate. What this one can
// prove without a session is that its three bars SEPARATE — that each fires on
// the shape of sitting it exists to name and stays quiet on the shape beside
// it. The instrument behind them has already rejected a real build: the first
// eighteen minutes it ever measured came back 0 items, 0 metres and
// `input.uiOpen` for 1,109 of 1,109 seconds, which is the row it prints as
// "no overlay owned the sitting".
// ---------------------------------------------------------------------------
if (SELFTEST) {
  let bad = 0;
  const shareOf = (o, k) => o[k] / (o.work + o.place + o.traverse + o.idle + o.ui);
  const walkedSitting = { work: 60, place: 20, traverse: 900, idle: 20, ui: 0 };
  const playedSitting = { work: 600, place: 300, traverse: 150, idle: 30, ui: 0 };
  const behindAModal = { work: 0, place: 0, traverse: 0, idle: 0, ui: 1109 };
  const cases = [
    ['a sitting that is 90% walk fails the traversal bar', shareOf(walkedSitting, 'traverse') >= BAR],
    ['a sitting that is 15% walk passes it', shareOf(playedSitting, 'traverse') < BAR],
    ['a sitting spent entirely behind an overlay fails the overlay bar', shareOf(behindAModal, 'ui') >= 0.15],
    ['a sitting with an overlay for one beat passes it', shareOf({ ...playedSitting, ui: 30 }, 'ui') < 0.15],
    ['160 m of uncomposed ground per question fails the walk bar', 160 >= METRES_BAR],
    ['40 m of it passes', 40 < METRES_BAR],
  ];
  for (const [label, ok] of cases) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) bad++;
  }
  if (bad) { console.error(`\nself-test: ${bad} bar(s) do not separate`); process.exit(1); }
  console.log('\nself-test: ok — every bar fires on the sitting it names and stays quiet on the one beside it');
  process.exit(0);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate((l) => {
  try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private mode */ }
}, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2000);
try {
  await page.waitForSelector('.sc-go', { timeout: 8000 });
  await page.locator('.sc-go').click();
  await page.waitForTimeout(700);
} catch { /* no charter in this build path */ }

// ---------------------------------------------------------------------------
// THE INSTRUMENT. On the frame loop, in the page: a poll over the wire is both
// too coarse to see a two-second beat and heavy enough to change the thing it
// is measuring.
//
// The site list is read ONCE, from the world's own objects, and it is the list
// of places this game composed on purpose. Everything else is the gap.
// ---------------------------------------------------------------------------
await page.evaluate(() => {
  const a = window.__ascent;
  const sites = [];
  const add = (x, z, r, kind) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    sites.push({ x, z, r2: r * r, kind });
  };
  // A COMPOSED PLACE IS A PLACE, NOT A POSTCODE. Every radius here is about
  // the distance at which the thing in front of you is the subject of the
  // frame rather than a dot on the horizon — so they are deliberately tight.
  // Widen one and this gate flatters the build.
  add(0, 0, 45, 'plaza');
  for (const r of (a.rifts?.list || [])) add(r.foot ? r.foot.x : r.pos.x, r.foot ? r.foot.z : r.pos.z, 18, 'rift');
  for (const g of (a.waygates?.list || [])) add(g.x, g.z, 18, 'waygate');
  for (const c of (a.caches?.list || [])) add(c.x ?? c.pos?.x, c.z ?? c.pos?.z, 20, 'cache');
  for (const s of (a.spans?.list || [])) add(s.x ?? s.pos?.x, s.z ?? s.pos?.z, 20, 'span');
  for (const w of (a.wardens?.list || [])) add(w.x ?? w.pos?.x, w.z ?? w.pos?.z, 18, 'warden');
  for (const l of Object.values(a.world?.landmarks || {})) {
    const p = l?.group?.position || l?.position;
    if (p) add(p.x, p.z, 22, 'landmark');
  }
  const S = {
    on: true, last: performance.now(),
    work: 0, place: 0, traverse: 0, idle: 0, ui: 0, air: 0,
    metres: 0, metresAtSite: 0, kinds: {}, uiWhy: {}, marks: [],
    px: a.player.pos.x, pz: a.player.pos.z,
  };
  window.__TRAF = S;
  S.sites = sites;
  const tick = (now) => {
    const dt = Math.min(0.25, (now - S.last) / 1000); S.last = now;
    try {
      if (S.on) {
        const p = a.player.pos;
        const step = Math.hypot(p.x - S.px, p.z - S.pz);
        S.px = p.x; S.pz = p.z;
        const card = !!(a.panel && a.panel.open);
        const ui = !card && !!(a.input && a.input.uiOpen);
        if (ui) {
          const why = (a.menu && a.menu.open ? 'menu ' : '')
            + (a.report && a.report.open ? 'report ' : '')
            + (document.querySelector('.ses-charter.show') ? 'charter ' : '')
            + (document.querySelector('.ses-close.show') ? 'close ' : '')
            + (document.querySelector('.ses-rest.show') ? 'rest ' : '')
            + (document.querySelector('.rf.show, .rf-panel.show') ? 'rift ' : '')
            + (document.querySelector('.fdy') && getComputedStyle(document.querySelector('.fdy')).display !== 'none' ? 'foundry ' : '');
          const k = why || 'flag-only';
          S.uiWhy[k] = (S.uiWhy[k] || 0) + dt;
        }
        let at = null;
        for (const s of sites) {
          const dx = p.x - s.x, dz = p.z - s.z;
          if (dx * dx + dz * dz <= s.r2) { at = s.kind; break; }
        }
        const moving = step / Math.max(dt, 1e-3) > 0.6;
        if (card) S.work += dt;
        else if (ui) S.ui += dt;
        else if (at) { S.place += dt; S.kinds[at] = (S.kinds[at] || 0) + dt; S.metresAtSite += step; }
        else if (moving) { S.traverse += dt; S.metres += step; }
        else S.idle += dt;
        if (!card && !ui && !a.player.grounded) S.air += dt;
      }
    } catch { /* a frame mid-teardown is not evidence */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const readTraffic = () => page.evaluate(() => {
  const S = window.__TRAF, a = window.__ascent;
  const snap = (() => { try { return a.report.snapshot(); } catch { return {}; } })();
  return {
    work: S.work, place: S.place, traverse: S.traverse, idle: S.idle, ui: S.ui, air: S.air,
    metres: S.metres, metresAtSite: S.metresAtSite, kinds: { ...S.kinds }, uiWhy: { ...S.uiWhy }, sites: S.sites.length,
    sessionMs: snap.sessionMs || 0, sessionTaskMs: snap.sessionTaskMs || 0, items: snap.items || 0,
    // How often the world picked the cadet up and put him somewhere else. Not
    // a bar here — `tools/critic/takeover.mjs` owns that judgement — but the
    // number belongs beside the split, because a world that is easier to walk
    // should need to do it less, and a world that is harder should show it.
    recoveries: a.player.recoveries | 0, caught: a.player.caught | 0,
  };
});

// ------------------------------------------------------------- real playing
const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo().open);
const panelSettled = () => page.evaluate(() => !!window.__ascent.panelInfo().settled);
const card = async () => {
  const c = await page.evaluate(() => window.__ascent.panelInfo());
  return c && c.open ? c : null;
};

/**
 * The cards the SITTING puts up — charter, resolution, rest — dismissed with a
 * real mouse click on their own button, because a player dismisses them.
 *
 * A harness that does not is not measuring the game: the first cut of this gate
 * reported 79% of an eighteen-minute sitting as "an overlay owned the screen",
 * and 872 of those seconds were the session's own resolution card standing up
 * untouched while nothing else could happen. That is the harness, not the world.
 */
async function dismissSessionCards() {
  for (const sel of ['.ses-close.show .sx-more', '.ses-close.show .sx-rest',
    '.ses-rest.show .sr-skip', '.ses-rest.show .sr-e-acts button', '.ses-charter.show .sc-go',
    // THE FOUNDRY. It opens itself, full screen, and it is modal — `busy()` in
    // src/kit/kit.js gates every verb the kit owns on it. The first eighteen
    // minutes this gate ever measured were spent behind it: the minute-1 and
    // minute-8 captures are the same shop panel over the same frame, seven
    // minutes apart. A player presses STEP BACK; so does this.
    '.fdy .fdy-close']) {
    const el = page.locator(sel).first();
    if (await el.count() && await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function walkAndKnock(budgetMs = 45000) {
  const t0 = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  let held = false;
  const forward = async (on) => { if (on === held) return; held = on; if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW'); };
  const cx = Math.round(W / 2);
  try {
    while (Date.now() - t0 < budgetMs) {
      let w = null;
      if (STEER === 'route') {
        // The world's own answer, turned into a screen offset the same way the
        // marker gives one, so the steering loop below is unchanged.
        w = await page.evaluate((half) => {
          const a = window.__ascent, W = a.world, T = a.THREE;
          const o = a.nextObjective && a.nextObjective();
          const r = o && a.rifts.list.find((q) => q.id === (o.skill || o.id));
          if (!r) return null;
          const t = r.foot || r.pos;
          const p = a.player.pos;
          const hd = W.headingTo(p.x, p.z, t.x, t.z);
          const fwd = new T.Vector3();
          a.camera.getWorldDirection(fwd);
          fwd.y = 0; fwd.normalize();
          const dir = new T.Vector3(Math.sin(hd.yaw), 0, Math.cos(hd.yaw));
          const ang = Math.atan2(fwd.x * dir.z - fwd.z * dir.x, fwd.dot(dir));
          // …as an x offset from the middle of the glass, saturating off screen
          return { x: half + Math.max(-1, Math.min(1, ang / 0.8)) * half * 0.9,
            edge: Math.abs(ang) > 0.8 };
        }, Math.round(W / 2));
      } else {
        w = await page.evaluate(() => {
          const mark = document.querySelector('.gd-mark');
          if (!mark || !mark.classList.contains('show')) return null;
          const r = mark.getBoundingClientRect();
          return { x: r.left + r.width / 2, edge: mark.classList.contains('edge') };
        });
      }
      if (w) {
        // ---- TURNING IS DONE ON THE ARROW KEYS, AND IT WAS NOT ------------
        //
        // This steered with `page.mouse.move`, walking the pointer across the
        // glass and then snapping it back to the middle when it reached the
        // edge — and the snap is a mouse movement too. The game reads deltas
        // (there is no pointer lock in a headless browser), so every turn was
        // immediately undone by the reset: the harness could not turn round.
        //
        // The consequence is measured. An eighteen-minute sitting driven this
        // way reported 215 fall-catches and 230 takeovers — one every five
        // seconds — because the objective sat BEHIND the cadet, the marker
        // pinned itself to the edge of the glass, and the cadet walked forward
        // off the coast, was caught, was set down, and walked off again. The
        // captures at minute 8 and minute 18 are both "THE VERGE · EDGE OF
        // SHARD NINE" with the card reading BEHIND YOU. None of that is the
        // game; all of it is this loop.
        //
        // Arrow keys have no wrap-around and no reset. They are also what
        // tools/critic/traverse.mjs has always used.
        const off = w.x - cx;
        if (Math.abs(off) > 50 || w.edge) {
          const k = off > 0 ? 'ArrowRight' : 'ArrowLeft';
          await page.keyboard.down(k);
          await page.waitForTimeout(Math.min(320, Math.max(45, (Math.abs(off) / cx) * 340)));
          await page.keyboard.up(k);
        }
      }
      await forward(true);
      for (let j = 0; j < 4; j++) {
        await page.waitForTimeout(150);
        await page.keyboard.press('KeyE');
        if (await panelOpen()) { await forward(false); return true; }
      }
      if (await dismissSessionCards()) { await forward(false); await forward(true); }
      // Nothing in sight and no marker: sweep on the keys, so a wedge cannot
      // hold the run and the pointer never has to move at all.
      if (!w) {
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(260);
        await page.keyboard.up('ArrowRight');
      }
    }
  } finally { await forward(false); }
  return false;
}

async function answer(c, wrong) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) {
      const v = await btns.nth(i).getAttribute('data-value');
      if ((String(v) === String(c.answer)) !== wrong) { want = i; break; }
    }
    await btns.nth(want).click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? '');
    if (wrong) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : (s + '1');
    if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(35);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  /* THE OTHER FOUR SURFACES, PRESSED FOR REAL — tools/critic/_play.mjs.
     What stood here was `page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first().click()`,
     which is not an answer on any of them: a `.rf-chip` click only PICKS the
     chip, `src/ui/rift.js:3949` ignores a cell click with nothing picked, the
     balance beam needs three to five moves, and the coordinate plot has none of
     those classes at all. This gate is the mirror of `check:motion` and the same
     defect biases both: a card that is never answered never settles, so the
     sitting stays where it is and the walk this gate measures is not the walk a
     player takes. */
  const r = await answerCard(page, { wrong });
  return !!(r.acted || r.done);
}

const t0 = Date.now();
const deadline = t0 + MINUTES * 60000;
const shotsAt = [60, 8 * 60, 18 * 60].filter((s) => s <= MINUTES * 60);
const taken = new Set();
const marks = [];
let n = 0;
let walks = 0;
await walkAndKnock(45000);
while (Date.now() < deadline) {
  const secs = Math.round((Date.now() - t0) / 1000);
  for (const s of shotsAt) {
    if (secs >= s && !taken.has(s)) {
      taken.add(s);
      // A MINUTE SHOT IS A SHOT OF THE WORLD. Photographing the frame while a
      // card or the shop owns it produces two identical pictures of a modal and
      // says nothing at all about whether minute eight is composed.
      await dismissSessionCards();
      const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input?.uiOpen
        || document.querySelector('.fdy.show, .fdy[style*="display: block"]')));
      if (!busy) await page.screenshot({ path: path.join(OUT, `minute-${Math.round(s / 60)}.png`) });
      else shotsAt.push(s + 20);      // something owns the frame; take the world one shortly
    }
  }
  await dismissSessionCards();
  if (!(await panelOpen())) {
    // A solved tear OFFERS the next one where the cadet stands. Wait for that
    // — briefly — and then go and find it, which is what a player does.
    const t1 = Date.now();
    let got = false;
    while (Date.now() - t1 < 2600) { if (await panelOpen()) { got = true; break; } await page.waitForTimeout(180); }
    if (!got) { walks++; await walkAndKnock(45000); }
    if (!(await panelOpen())) continue;
  }
  const c = await card();
  if (!c) { await page.waitForTimeout(200); continue; }
  if (c.settled) {
    const t1 = Date.now();
    while ((await panelOpen()) && Date.now() - t1 < 4000) await page.waitForTimeout(200);
    continue;
  }
  n++;
  await answer(c, n === 4);
  marks.push({ n, at: secs, skill: c.skill });
  await page.waitForTimeout(900);
  if (await panelOpen()) {
    if (await panelSettled()) {
      const t1 = Date.now();
      while (await panelOpen() && Date.now() - t1 < 3600) await page.waitForTimeout(200);
    } else { await page.waitForTimeout(700); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }
}
// The last one is taken after the sitting, on a frame nothing owns — a picture
// of a modal is not an answer to "does minute eighteen still look composed".
for (const s of shotsAt) {
  if (taken.has(s)) continue;
  taken.add(s);
  for (let k = 0; k < 14; k++) {
    await dismissSessionCards();
    const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input?.uiOpen
      || document.querySelector('.fdy.show')));
    if (!busy) break;
    if (await panelOpen()) await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(OUT, `minute-${Math.round(s / 60)}.png`) });
}
await page.screenshot({ path: path.join(OUT, 'last-frame.png') });

const T = await readTraffic();
const wall = (Date.now() - t0) / 1000;
const acc = T.work + T.place + T.traverse + T.idle + T.ui;
const share = (v) => (acc > 0 ? v / acc : 0);
const pc = (v) => (share(v) * 100).toFixed(1) + '%';
console.log(`\n  ..    ${MINUTES} min of real play, ${n} items answered, ${walks} walks to a new objective, `
  + `${T.sites} composed sites on the island, steered by ${STEER === 'route' ? "the world's routed heading" : 'the card\'s waypoint'}`);
console.log(`  ..    WORK ${T.work.toFixed(0)}s ${pc(T.work)}   PLACE ${T.place.toFixed(0)}s ${pc(T.place)}   `
  + `TRAVERSE ${T.traverse.toFixed(0)}s ${pc(T.traverse)}   IDLE ${T.idle.toFixed(0)}s ${pc(T.idle)}   UI ${T.ui.toFixed(0)}s ${pc(T.ui)}`);
console.log(`  ..    at a site: ${Object.entries(T.kinds).map(([k, v]) => `${k} ${v.toFixed(0)}s`).join(', ') || 'none'}`);
console.log(`  ..    overlay time by cause: ${Object.entries(T.uiWhy).map(([k, v]) => `${k}=${v.toFixed(0)}s`).join(', ') || 'none'}`);
console.log(`  ..    walked ${T.metres.toFixed(0)} m through nothing, ${T.metresAtSite.toFixed(0)} m inside a composed place`);
console.log(`  ..    the world picked him up ${T.recoveries} time(s), and caught him falling ${T.caught}`);
console.log(`  ..    the game's own two figures: TIME ON TASK ${(T.sessionTaskMs / 60000).toFixed(1)} min `
  + `against THIS SESSION ${(T.sessionMs / 60000).toFixed(1)} min `
  + `(${((1 - T.sessionTaskMs / Math.max(1, T.sessionMs)) * 100).toFixed(0)}% outside it — the figure the report was written from)`);

note(n > 0, 'the session answered something', `${n} items`);
note(share(T.traverse) < BAR, 'less than a third of the sitting is the walk through nothing',
  `${pc(T.traverse)} (bar ${(BAR * 100).toFixed(0)}%)`);
note(n === 0 || T.metres / n < METRES_BAR, 'the walk between two questions is not a hike',
  `${(T.metres / Math.max(1, n)).toFixed(0)} m of uncomposed ground per item (bar ${METRES_BAR} m)`);
// THE ONE THAT CAUGHT A DEAD SESSION. The first eighteen minutes this gate
// measured came back WORK 0s, PLACE 0s, TRAVERSE 0s, 0 items, 0 metres and
// `input.uiOpen` true for 1,109 of 1,109 seconds: the foundry had opened itself
// over the frame at minute one and nothing in the game closed it again. A
// player presses STEP BACK and the harness now does too — but an overlay that
// can own a whole sitting is exactly the failure this line exists to name, and
// the traversal share above reads 0% while it happens.
note(share(T.ui) < 0.15, 'no overlay owned the sitting',
  `${pc(T.ui)} of it was behind one${Object.keys(T.uiWhy).length ? ' (' + Object.entries(T.uiWhy).map(([k, v]) => `${k}${v.toFixed(0)}s`).join(', ') + ')' : ''} (bar 15%)`);
note(errors.length === 0, 'the running game logged nothing', errors.slice(0, 2).join(' | '));

await writeFile(path.join(OUT, 'traffic.json'), JSON.stringify({
  minutes: MINUTES, steer: STEER, wall, items: n, walks, marks, ...T,
  shares: { work: share(T.work), place: share(T.place), traverse: share(T.traverse), idle: share(T.idle), ui: share(T.ui) },
  metresPerItem: T.metres / Math.max(1, n), errors,
}, null, 1));
await browser.close();
console.log(fails.length ? `\nFAILED (${fails.length})` : '\nPASSED');
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This gate is recorded
   per wave and its recorded RED fails `npm run check`, so what it holds has to
   be legible to the runner and not only to a reader. A sitting walked from a cleared save
   with no query string is the shipped route. */
findings('check:traffic', { scope: 'route' }).route(fails.map(String)).done();
