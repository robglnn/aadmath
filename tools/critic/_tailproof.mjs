/**
 * A REAL session, driven by real key and mouse input, from a cleared save.
 *
 * This exists because tools/critic/session-drive.mjs answers items with
 * `window.__ascent.panel.demo('right')`, which calls the panel's `_solve()`
 * directly. That path never touches the input surface, never runs the checker,
 * and — the reason this file exists — never runs the world's own chain
 * condition, which is where a scheduler defect that only a standing player can
 * reach was hiding. Three rounds of "fixed" were signed off against it.
 *
 * So nothing here makes progress through `__ascent`:
 *   · the save is cleared and the page reloaded, then the player WALKS with
 *     real KeyW/KeyA/KeyS/KeyD and opens the tear with a real KeyE;
 *   · answers go in as real key presses on the keypad or real mouse clicks on
 *     a reading, dispatched by the browser, not by the page;
 *   · `__ascent` is read ONLY to observe — which skill an item was on, whether
 *     the skill was already mastered when it was served, and what the item's
 *     expected answer is so the script knows which real key to press. Reading
 *     the answer key is not the same as being given the point: every one of
 *     these answers is checked by the game's own checker on the game's own
 *     input path.
 *
 *   node tools/critic/realsession.mjs --url http://127.0.0.1:4791 --minutes 12
 *
 * ---------------------------------------------------------------------------
 * _tailproof.mjs — the same harness, with the WALKING taken out.
 *
 * This copy exists to answer one question the original cannot answer inside a
 * sitting: does a learner who already knows the *deepest* skill in the lattice
 * prove it fast, in the real game, with real keys? Reaching that node by foot
 * takes over two hours, because walking is most of a real session's clock.
 *
 * So locomotion — and only locomotion — is done with `teleportTo`, which the
 * brief names as a harness API for exactly this. Every other rule of the
 * original still holds and is what the answer rests on:
 *
 *   · the save is cleared and the page reloaded before the first item;
 *   · every rift is opened with a real KeyE press while standing at it;
 *   · every answer is typed or clicked as a real browser input event and is
 *     judged by the game's own checker;
 *   · nothing is marked mastered, unlocked, or advanced by `__ascent`. The
 *     lattice is opened by answering it, in prerequisite order, exactly as a
 *     player opens it. `__ascent` is read to observe and to look up which key
 *     the item wants, never to grant anything.
 *
 *   node tools/critic/_tailproof.mjs --url http://127.0.0.1:4788 --minutes 40
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const MINUTES = Number(arg('minutes', 12));
const OUT = path.resolve(arg('out', 'shots/realsession'));
const LOC = arg('loc', 'en');
const MODE = arg('mode', 'knower');   // knower | struggler
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));

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
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
// A cleared save. This is the starting condition, not progress.
await page.evaluate((l) => {
  localStorage.removeItem('ascent.save');
  localStorage.setItem('ascent.locale', l);
}, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1500);

// Dismiss the orders card with a real mouse click if it is up.
try {
  await page.waitForSelector('.sc-go', { timeout: 8000 });
  await page.locator('.sc-go').click();
  await page.waitForTimeout(800);
} catch { /* no charter in this build path */ }

// ---------------------------------------------------------------- fps meter
await page.evaluate(() => {
  window.__fps = [];
  let last = performance.now();
  const tick = (now) => { window.__fps.push(1000 / Math.max(1, now - last)); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

// -------------------------------------------------------------- real walking
/**
 * Walk with real keys, pressing the real interact key as we go.
 *
 * Nothing here calls `teleportTo` or `openRiftById`. The player moves because
 * KeyW is held down and a tear opens because KeyE was pressed while standing in
 * front of one — which is the only way the chain condition in `openRift` is
 * ever exercised, and the reason a defect reachable only by a standing player
 * survived three rounds of review.
 */
async function walkAndKnock(budgetMs = 45000) {
  const t0 = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  let held = false;
  const forward = async (on) => {
    if (on === held) return;
    held = on;
    if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
  };
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  let mx = cx;
  try {
    while (Date.now() - t0 < budgetMs) {
      // Where the game itself says the next objective is. `src/meta/guide.js`
      // paints a marker at its screen position and prints its distance; both
      // are read off the DOM, exactly as a player reads them off the screen.
      const w = await page.evaluate(() => {
        const mark = document.querySelector('.gd-mark');
        if (!mark || !mark.classList.contains('show')) return null;
        const r = mark.getBoundingClientRect();
        const m = document.querySelector('.gd-dist')?.textContent || '';
        return { x: r.left + r.width / 2, edge: mark.classList.contains('edge'), dist: parseInt(m.replace(/[^0-9]/g, ''), 10) || null };
      });
      if (w) {
        // Turn towards it with real mouse movement — the same `mousemove` the
        // player's own look control reads (src/core/input.js).
        const off = w.x - cx;
        if (Math.abs(off) > 40 || w.edge) {
          const step = Math.max(-160, Math.min(160, off * (w.edge ? 1.6 : 0.7))) || 120;
          mx = Math.max(4, Math.min(W - 4, mx + step));
          await page.mouse.move(mx, cy);
          if (mx <= 8 || mx >= W - 8) mx = cx;
        }
      }
      await forward(true);
      for (let j = 0; j < 4; j++) {
        await page.waitForTimeout(150);
        await page.keyboard.press('KeyE');
        if (await panelOpen()) { await forward(false); return true; }
      }
      // Nothing in sight and no marker: sweep, so a wedge cannot hold the run.
      if (!w) { mx = mx > cx ? cx - 150 : cx + 150; await page.mouse.move(mx, cy); }
    }
  } finally { await forward(false); }
  return false;
}

/** Stand still and let the world hand over the next tear, as it does for a player. */
async function awaitChain(ms = 5200) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await panelOpen()) return true;
    await page.waitForTimeout(180);
  }
  return false;
}

// ------------------------------------------------------------ real answering
/**
 * What is on the card right now. Read-only observation: which skill, whether it
 * was already mastered when served, which surface, and the expected answer so
 * the script knows which real key to press.
 */
const card = async () => {
  const c = await page.evaluate(() => window.__ascent.panelInfo());
  return c && c.open ? c : null;
};
const panelOpen = () => page.evaluate(() => window.__ascent.panelInfo().open);
const panelSettled = () => page.evaluate(() => !!window.__ascent.panelInfo().settled);

/** Answer the open card with real input. Returns true if input was delivered. */
async function answer(c, deliberatelyWrong) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) {
      const v = await btns.nth(i).getAttribute('data-value');
      const right = String(v) === String(c.answer);
      if (right !== deliberatelyWrong) { want = i; break; }
    }
    // A real mouse click on the real button.
    await btns.nth(want).click({ timeout: 5000 });
    return true;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? '');
    if (deliberatelyWrong) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : (s + '1');
    if (!s) return false;
    // Real keystrokes, one at a time, exactly as a hand would.
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(40);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  // Any other surface (balance, sort, plot, area): click the first real
  // control the surface offers, so the run keeps moving on real input.
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

// ------------------------------------------------------------------ the play
const served = [];
const t0 = Date.now();
const deadline = t0 + MINUTES * 60000;
let openedByHand = 0;
let n = 0;

/**
 * Stand in front of the rift the engine says is next, and knock on it.
 *
 * `teleportTo` moves the player and nothing else — it grants no standing, opens
 * no panel and answers no item. The tear still has to be opened with a real
 * KeyE press from where the player is now standing, which is the code path this
 * harness exists to exercise.
 */
async function travelAndKnock(budgetMs = 30000) {
  const t1 = Date.now();
  while (Date.now() - t1 < budgetMs) {
    const want = await page.evaluate(() => window.__ascent.mastery.next()?.id || null);
    if (!want) return false;
    await page.evaluate((id) => window.__ascent.teleportTo(id), want);
    await page.waitForTimeout(700);
    for (let j = 0; j < 12; j++) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      if (await panelOpen()) return true;
    }
    // Not close enough to knock on: step forward with a real key and try again.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    for (let j = 0; j < 6; j++) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      if (await panelOpen()) return true;
    }
  }
  return false;
}

await travelAndKnock(30000);

while (Date.now() < deadline) {
  if (!(await panelOpen())) {
    // A solved tear hands over the next one where the player is standing. Wait
    // for that first — moving is what breaks the chain — and only go looking if
    // nothing arrives.
    if (!(await awaitChain(2500))) { openedByHand++; await travelAndKnock(30000); }
    if (!(await panelOpen())) continue;
  }
  const c = await card();
  if (!c) { await page.waitForTimeout(200); continue; }
  // A card that has already been answered is still on screen while it seals.
  // Counting it again is how a harness invents items the engine never served —
  // and, because `observe` has already run by then, invents them on a skill the
  // engine had just marked mastered. Wait it out instead.
  if (c.settled) {
    const t1 = Date.now();
    while ((await panelOpen()) && Date.now() - t1 < 4000) await page.waitForTimeout(200);
    continue;
  }
  n++;
  // A knower answers; a struggler misses the first dozen. One honest slip in
  // the knower's run so the miss path is exercised too.
  const wrong = MODE === 'struggler' ? n <= 12 : n === 4;
  const at = Math.round((Date.now() - t0) / 1000);
  const delivered = await answer(c, wrong);
  served.push({ n, at, ...c, wrong, delivered });
  if (n === 1) await page.screenshot({ path: path.join(OUT, 'first-item.png') });
  await page.waitForTimeout(900);
  // A sealed card shuts itself; a missed one waits for the player. Escape is a
  // real key and it is the one the panel binds.
  if (await panelOpen()) {
    if (await panelSettled()) {
      const t1 = Date.now();
      while (await panelOpen() && Date.now() - t1 < 3600) await page.waitForTimeout(200);
    } else {
      await page.waitForTimeout(700);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
}

await page.screenshot({ path: path.join(OUT, 'last-frame.png') });
const fps = await page.evaluate(() => {
  const a = window.__fps.slice(60).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
});
const finalState = await page.evaluate(() => {
  const A = window.__ascent;
  const out = {};
  for (const id of A.skillIds) {
    const s = A.mastery.state.get(id);
    out[id] = {
      attempts: s.attempts, correct: s.correct, mastered: s.mastered,
      soundings: s.soundings || 0, heldServed: s.heldServed || 0,
      // The receipt the engine froze when it granted the claim — read, never
      // written. This is the whole point of the run: what band each line was
      // actually proved at, and off how many unassisted items.
      provenBy: s.provenBy ? {
        road: s.provenBy.road, band: s.provenBy.band, bandFloor: s.provenBy.bandFloor,
        bandCapped: s.provenBy.bandCapped, items: s.provenBy.items,
        checkDone: s.provenBy.checkDone, missed: s.provenBy.missed,
        reps: s.provenBy.reps, firstContact: s.provenBy.firstContact,
        attemptsAt: s.provenBy.attemptsAt,
      } : null,
    };
  }
  return out;
});

// ------------------------------------------------------------------ the read
const skills = {};
for (const r of served) skills[r.skill] = (skills[r.skill] || 0) + 1;
const shapes = {};
for (const r of served) shapes[r.form] = (shapes[r.form] || 0) + 1;
const held = served.filter((r) => r.masteredWhenServed);
const heldPerSkill = {};
for (const r of held) heldPerSkill[r.skill] = (heldPerSkill[r.skill] || 0) + 1;
const shapeCounts = Object.values(shapes);
const report = {
  mode: MODE, minutes: MINUTES, itemsServed: served.length,
  distinctSkills: Object.keys(skills).length,
  skills,
  itemsOnAlreadyMasteredSkills: held.length,
  worstHeldSkillInSession: Math.max(0, ...Object.values(heldPerSkill)),
  heldPerSkill,
  heldByKind: held.reduce((a, r) => { a[r.kind || '?'] = (a[r.kind || '?'] || 0) + 1; return a; }, {}),
  distinctShapes: Object.keys(shapes).length,
  mostCommonShape: Math.max(0, ...shapeCounts),
  mostCommonShapeShare: served.length ? +(Math.max(0, ...shapeCounts) / served.length).toFixed(3) : 0,
  shapes,
  inputDelivered: served.filter((r) => r.delivered).length,
  openedByHand,
  consoleErrors: errors.length,
  errors: errors.slice(0, 8),
  fpsMedian: +fps.toFixed(1),
  finalState,
  provenBy: null,
  timeline: served.map((r) => `${r.at}s ${r.skill} ${r.kind || '-'} ${r.form} ${r.masteredWhenServed ? 'HELD' : ''}`),
};
await writeFile(path.join(OUT, 'realsession.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
