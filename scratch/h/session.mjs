/**
 * LANE H — a real 15-25 min session, driven by real keys/mouse, that measures
 * what the cold critic measured: TIME ON TASK against session length, plus the
 * world facts behind it — metres walked, seconds wedged, and what the player
 * had to look at while walking.
 *
 * Derived from tools/critic/realsession.mjs. Nothing here makes progress
 * through __ascent: walking is KeyW + mouse, opening is KeyE, answering is real
 * clicks/keystrokes. __ascent is read only.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const MINUTES = Number(arg('minutes', 20));
const OUT = path.resolve(arg('out', 'shots/h-session'));
const LOC = arg('loc', 'en');
const MODE = arg('mode', 'learner');
const W = 1600, H = 900;
const SHOT_MIN = (arg('shots', '1,8,18')).split(',').map(Number);

await mkdir(OUT, { recursive: true });
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
await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('ascent.locale', l); }, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1800);
try { await page.waitForSelector('.sc-go', { timeout: 8000 }); await page.locator('.sc-go').click(); await page.waitForTimeout(700); } catch {}

// ---- the in-page sampler: everything the world did to the player -----------
await page.evaluate(() => {
  const a = window.__ascent;
  const S = {
    lastT: performance.now(), walked: 0, wedgeS: 0, worstWedge: 0, runWedge: 0,
    frames: 0, panelS: 0, freeS: 0, blindS: 0, stuckS: 0,
    cardS: 0, stallS: 0, worldS: 0, stalls: [], offIsland: 0, recoveries0: 0,
    lastX: a.player.pos.x, lastZ: a.player.pos.z,
    markX: a.player.pos.x, markZ: a.player.pos.z, markT: performance.now(),
    wedges: [], trail: [], fps: [],
  };
  window.__H = S;
  const tick = (now) => {
    const dt = Math.min(0.25, (now - S.lastT) / 1000); S.lastT = now; S.frames++;
    if (dt > 0) S.fps.push(1 / dt);
    try {
      const p = a.player.pos;
      const card = !!a.panel?.open;
      const ui = !!(card || a.input.uiOpen);
      // THE HONEST DECOMPOSITION. A session is three things and they must never
      // be confused: time on a QUESTION, time on some other surface the game
      // put up, and time IN THE WORLD. The claim under test is about the third.
      if (card) S.cardS += dt;
      else if (ui) S.stallS += dt;
      else S.worldS += dt;
      if (ui) S.panelS += dt; else S.freeS += dt;
      const d = Math.hypot(p.x - S.lastX, p.z - S.lastZ);
      if (!ui) S.walked += d;
      S.lastX = p.x; S.lastZ = p.z;
      // WEDGED: asked to move, got nowhere. The clock is only ever advanced
      // by FREE-ROAM time — a minute spent on a card is not a minute spent
      // wedged, and attributing it as one is the instrument bug that has cost
      // this project a wave before.
      if (ui) { S.markX = p.x; S.markZ = p.z; S.markT = now; S.runWedge = 0; }
      else {
        const moving = Math.hypot(p.x - S.markX, p.z - S.markZ) > 1.5;
        if (moving) { S.markX = p.x; S.markZ = p.z; S.markT = now; S.runWedge = 0; }
        else {
          S.runWedge += dt;
          if (S.runWedge > S.worstWedge) S.worstWedge = S.runWedge;
        }
        if (a.player.stuck) S.stuckS += dt;
        if (a.islandAt(p.x, p.z) === null) S.offIsland += dt;
      }
      if (S.frames % 30 === 0) S.trail.push([Math.round(now / 100) / 10, +p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), ui ? 1 : 0]);
    } catch {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
const panelOpen = () => page.evaluate(() => window.__ascent.panelInfo().open).catch(() => false);
/**
 * SOMETHING THAT IS NOT A QUESTION HAS THE SCREEN. Dismiss it the way a player
 * would and write down what it was — a stall counted as "time in the world" is
 * how a traversal figure starts lying.
 */
const breakStall = async () => {
  const st = await page.evaluate(() => {
    const a = window.__ascent;
    if (a.panel?.open || !a.input.uiOpen) return null;
    const vis = [...document.querySelectorAll('div,section,aside')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 380 && r.height > 240 && getComputedStyle(e).opacity > 0.5
          && getComputedStyle(e).visibility !== 'hidden' && e.className;
      })
      .map((e) => String(e.className)).slice(0, 4);
    return { what: vis.join(' | ').slice(0, 160) };
  }).catch(() => null);
  if (!st) return false;
  await page.evaluate((w) => { window.__H.stalls.push(w); }, st.what);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(220);
  await clear();
  for (const sel of ['.fdy-close', '.sc-go', '.ses-close button', '.ses-rest button', '.rf-close', 'button.primary']) {
    const el = page.locator(sel).first();
    if (await el.count() && await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(250);
      break;
    }
  }
  // …and if the flag is STILL set with nothing on the glass, it is stuck, and
  // the harness hands the controls back itself. THIS IS PLUMBING, NOT PROGRESS:
  // it opens nothing, answers nothing and moves nobody. It is here because a
  // beat whose own `hide()` does not clear `input.uiOpen` froze one before-run
  // for 911 seconds and one for 1,006, and a traversal figure measured through
  // that is a figure about a stuck flag. Counted, and reported.
  const still = await page.evaluate(() => {
    const a = window.__ascent;
    if (a.panel?.open || !a.input.uiOpen) return false;
    a.input.uiOpen = false;
    return true;
  }).catch(() => false);
  if (still) await page.evaluate(() => { window.__H.forced = (window.__H.forced || 0) + 1; });
  return true;
};
const panelSettled = () => page.evaluate(() => !!window.__ascent.panelInfo().settled).catch(() => false);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()).catch(() => null); return c && c.open ? c : null; };

const cx = Math.round(W / 2), cy = Math.round(H / 2);
let mx = cx;
async function walkAndKnock(budgetMs = 60000) {
  const t0 = Date.now();
  let held = false;
  const forward = async (on) => { if (on === held) return; held = on; if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW'); };
  try {
    while (Date.now() - t0 < budgetMs) {
      // WHERE THE GAME IS SENDING HIM.
      //
      // The first cut of this steered off the `.gd-mark` marker alone and, on
      // the frames where the marker is not up, fell back to sweeping the mouse
      // while holding W. That is not a player, it is a random walk: one run
      // stood on one square metre for sixteen minutes and the next ran eleven
      // kilometres off the east coast and back. Neither measures the game.
      //
      // So the aim is the objective's real bearing — the STRAIGHT one if the
      // build has nothing better, the ROUTED one if the world can plan a walk
      // (src/world/paths.js), which is exactly the difference under test — and
      // the marker is only used to break ties. Reading a bearing is a read.
      const aim = await page.evaluate(() => {
        const a = window.__ascent, p = a.player.pos;
        const g = a.story?.guide?.();
        let tx = null, tz = null;
        if (g && g.skill) {
          const r = a.rifts.list.find((x) => x.id === g.skill);
          if (r) { tx = r.foot ? r.foot.x : r.pos.x; tz = r.foot ? r.foot.z : r.pos.z; }
        }
        if (tx === null) {
          const r = a.rifts.list.find((x) => !x.locked) || a.rifts.list[0];
          if (r) { tx = r.foot ? r.foot.x : r.pos.x; tz = r.foot ? r.foot.z : r.pos.z; }
        }
        if (tx === null) return null;
        const W2 = a.world;
        const h = (W2 && typeof W2.headingTo === 'function')
          ? W2.headingTo(p.x, p.z, tx, tz)
          : { yaw: Math.atan2(tx - p.x, tz - p.z), metres: Math.hypot(tx - p.x, tz - p.z) };
        let e = ((h.yaw - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (e < -Math.PI) e += Math.PI * 2;
        return { err: e, metres: h.metres, straight: Math.hypot(tx - p.x, tz - p.z) };
      }).catch(() => null);
      if (aim && Math.abs(aim.err) > 0.14) {
        // turn with the arrow keys, which need no pointer lock and cannot spin
        const key = aim.err > 0 ? 'ArrowLeft' : 'ArrowRight';
        await forward(true);
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(420, Math.max(60, (Math.abs(aim.err) / 2.6) * 1000)));
        await page.keyboard.up(key);
      }
      await forward(true);
      // E ONLY WHERE A TEAR IS. Mashing the interact key while running is what
      // a player does, and on this build it is also what opens the FOUNDRY —
      // `src/kit/foundry.js` takes the whole screen off KeyE inside 6.4 m and
      // sets `input.uiOpen`, so a harness that presses E four times a second
      // while standing near it spends the rest of the session reopening a shop.
      // One before-run lost 1,006 seconds that way. The key is pressed where
      // the ring is, which is where a hand presses it.
      const close = aim && aim.straight < 14;
      for (let j = 0; j < 4; j++) {
        await page.waitForTimeout(150);
        if (close) await page.keyboard.press('KeyE');
        if (await panelOpen()) { await forward(false); return true; }
      }
      await breakStall();
      // A real player who has been going nowhere for five seconds presses the
      // key the game itself is offering.
      const wedged = await page.evaluate(() => window.__H.runWedge).catch(() => 0);
      if (wedged > 5) {
        await page.evaluate(() => { window.__H.wedges.push(window.__H.runWedge); });
        await forward(false);
        await page.keyboard.press('KeyR');
        await page.waitForTimeout(900);
        await page.evaluate(() => { const a = window.__ascent, S = window.__H; S.markX = a.player.pos.x; S.markZ = a.player.pos.z; S.markT = performance.now(); S.runWedge = 0; });
      }
    }
  } finally { await forward(false); }
  return false;
}

async function answer(c, wrong) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count(); if (!n) return false;
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
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

const t0 = Date.now();
const deadline = t0 + MINUTES * 60000;
const shotsDue = SHOT_MIN.slice();
const marks = [];
let n = 0, openedByHand = 0;

const tickShots = async () => {
  const mins = (Date.now() - t0) / 60000;
  while (shotsDue.length && mins >= shotsDue[0]) {
    const m = shotsDue.shift();
    const inPanel = await panelOpen();
    if (!inPanel) await page.screenshot({ path: path.join(OUT, `min-${m}.png`) });
    else { // photograph the WORLD at that minute, not the card
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `min-${m}.png`) });
    }
    const s = await page.evaluate(() => {
      const r = window.__ascent.report.snapshot();
      return { sessionMs: r.sessionMs, sessionTaskMs: r.sessionTaskMs, items: r.items, mastered: r.mastered, ...window.__H, trail: undefined, fps: undefined };
    }).catch(() => null);
    marks.push({ minute: m, ...s });
    console.log(`min ${m}:`, JSON.stringify({ sessionMs: s?.sessionMs, taskMs: s?.sessionTaskMs, walked: Math.round(s?.walked || 0), worstWedge: +(s?.worstWedge || 0).toFixed(1) }));
  }
};

await walkAndKnock(60000);
while (Date.now() < deadline) {
  await tickShots();
  if (!(await panelOpen())) {
    await breakStall();
    const t1 = Date.now();
    let got = false;
    while (Date.now() - t1 < 5200) { if (await panelOpen()) { got = true; break; } await page.waitForTimeout(180); }
    if (!got) { openedByHand++; await walkAndKnock(60000); }
    if (!(await panelOpen())) continue;
  }
  const c = await card();
  if (!c) { await page.waitForTimeout(200); continue; }
  if (c.settled) { const t1 = Date.now(); while ((await panelOpen()) && Date.now() - t1 < 4000) await page.waitForTimeout(200); continue; }
  n++;
  const wrong = MODE === 'struggler' ? n <= 12 : (n % 7 === 3);
  await answer(c, wrong);
  await page.waitForTimeout(900);
  if (await panelOpen()) {
    if (await panelSettled()) { const t1 = Date.now(); while (await panelOpen() && Date.now() - t1 < 3600) await page.waitForTimeout(200); }
    else { await page.waitForTimeout(700); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }
}
await tickShots();

const final = await page.evaluate(() => {
  const r = window.__ascent.report.snapshot();
  const S = window.__H;
  const f = S.fps.slice(120).sort((a, b) => a - b);
  return {
    sessionMs: r.sessionMs, sessionTaskMs: r.sessionTaskMs, items: r.items,
    mastered: r.mastered, total: r.total, accuracy: r.accuracy,
    walked: S.walked, worstWedge: S.worstWedge, wedges: S.wedges,
    panelS: S.panelS, freeS: S.freeS, stuckS: S.stuckS,
    cardS: S.cardS, stallS: S.stallS, worldS: S.worldS, stalls: S.stalls.slice(0, 6),
    forced: S.forced || 0,
    offIsland: S.offIsland, recoveries: window.__ascent.player.recoveries | 0,
    fpsMedian: f.length ? f[Math.floor(f.length / 2)] : 0,
    trail: S.trail,
  };
});
await page.screenshot({ path: path.join(OUT, 'last-frame.png') });
const wall = (Date.now() - t0) / 1000;
const out = {
  wallSecs: +wall.toFixed(1), itemsAnswered: n, openedByHand,
  sessionMin: +(final.sessionMs / 60000).toFixed(1),
  taskMin: +(final.sessionTaskMs / 60000).toFixed(1),
  traversalFraction: +(1 - final.sessionTaskMs / Math.max(1, final.sessionMs)).toFixed(3),
  metresWalked: Math.round(final.walked),
  freeSecs: Math.round(final.freeS), panelSecs: Math.round(final.panelS),
  cardSecs: Math.round(final.cardS), stallSecs: Math.round(final.stallS),
  worldSecs: Math.round(final.worldS),
  worldShare: +(final.worldS / Math.max(1, final.worldS + final.cardS + final.stallS)).toFixed(3),
  offIslandSecs: Math.round(final.offIsland), recoveries: final.recoveries,
  uiFlagForcedClear: final.forced,
  stalls: final.stalls,
  stuckSecs: Math.round(final.stuckS),
  worstWedgeSecs: +final.worstWedge.toFixed(1), wedgeEvents: final.wedges.length,
  mastered: final.mastered, total: final.total, items: final.items,
  fpsMedian: +final.fpsMedian.toFixed(1), errors: errors.length,
};
console.log('\n=== SESSION ===');
console.log(JSON.stringify(out, null, 2));
if (errors.length) console.log('errors:', errors.slice(0, 5));
await writeFile(path.join(OUT, 'session.json'), JSON.stringify({ ...out, marks, trail: final.trail, errors }, null, 1));
await browser.close();
