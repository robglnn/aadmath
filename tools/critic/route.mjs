/**
 * THE ROUTE, PLAYED — can a learner with no query string get past Level 1?
 *
 *   node tools/critic/route.mjs --url http://127.0.0.1:4791 [--minutes 25]
 *
 * WHY THIS IS A SEPARATE GATE FROM `tools/route-proof.mjs`
 *
 * That one proves the RULE. This one proves the GAME, and the two are not the
 * same claim — the defect it exists for was invisible to every gate in this
 * repo for several waves for exactly one reason: **every gate drove a unit by
 * URL.** `?unit=algebra1-l3` produced a perfectly good Level 3 session and told
 * nobody that no learner could ever reach one. So the first rule here is that
 * this script never puts a unit, a course or a units list in the address bar,
 * and the second is that it makes no progress through `window.__ascent`.
 *
 * WHAT IT DOES
 *
 *   1. Clears the save and reloads. No query string, ever.
 *   2. Asserts the shipped first region is exactly what shipped: one unit, the
 *      manifest's default, ten lines.
 *   3. Plays. Real WASD, real mouse look, a real KeyE on the tear, real
 *      keystrokes and real clicks on the card. `panelInfo()` is read for the
 *      expected answer — a hand needs to know which key to press, and every one
 *      of those answers still goes through the game's own checker on the game's
 *      own input path (the idiom in tools/critic/realsession.mjs).
 *   4. Photographs the moment the lattice opens — the plate, live, in frame.
 *   5. Comes back the way a learner comes back: it opens the page again. Then
 *      it WALKS to a tear in the new region and opens it with a real key, and
 *      the item that arrives has to be on a line that did not exist in the
 *      first region.
 *
 * Exit 0 = a player with no URL reached the second region. Exit 1 = they did
 * not, or the console logged an error on the way.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/route'));
const MINUTES = Number(arg('minutes', 25));
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });

const steps = [];
/* Written straight to the descriptor rather than through console.log: node
   block-buffers stdout to a file, and a forty-five minute run that only reports
   when its buffer fills is a run nobody can watch. */
const say = (line) => { try { writeSync(1, line + '\n'); } catch { console.log(line); } };
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  say(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let page = await ctx.newPage();
const errors = [];
const listen = (pg) => {
  pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
};
listen(page);

/**
 * A FRESH TAB, SAME SAVE — what "come back later" is, mechanically.
 *
 * A renderer that has been running this scene for four minutes in a headless
 * software-GL context slows to a crawl: the cadet covers fourteen metres in
 * forty-five seconds, the walk times out, and the run reports "no tear
 * reached" while the game is working perfectly and simply running at a few
 * frames a second. (The sustained-frame slope is a known open defect —
 * RESUME.md — and this environment is its worst case.) A page reload does not
 * clear it; a new page does.
 *
 * The browser CONTEXT is kept, so `localStorage` is kept, so the learner's
 * record is kept. This is a learner shutting the tab and opening it again,
 * which is the shape the whole session is designed around.
 */
async function renew(url) {
  const old = page;
  const fresh = await ctx.newPage();
  listen(fresh);
  page = fresh;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3200);
  await old.close().catch(() => {});
}

/* THE ADDRESS BAR IS PART OF THE TEST. Anything with a query string on it is a
   gate that cannot see the defect this file exists for. */
if (/[?&](unit|units|course)=/.test(URL)) {
  console.log('FAIL — this gate may not be given a unit in the URL');
  process.exit(1);
}

// --------------------------------------------------------------- read-only
/**
 * Every read here survives the page going away underneath it.
 *
 * The game itself can make the crossing while this script is playing — taking
 * ANOTHER RUN off the rest beat is a new planetfall, and `src/session/index.js`
 * raises the island for it — so a `page.evaluate` in flight will land in a
 * destroyed execution context. That is the game working, not the game failing,
 * and a harness that dies on it cannot watch the one event it exists for.
 */
async function read(fn, fallback = null) {
  for (let k = 0; k < 3; k++) {
    try { return await page.evaluate(fn); } catch {
      await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  return fallback;
}
const info = () => read(() => window.__ascent.panelInfo(), null);
const panelOpen = () => read(() => window.__ascent.panelInfo().open, false);
const content = () => read(() => window.__ascent.content(), null);
const heldNow = () => read(() => {
  const out = [];
  for (const [id, s] of window.__ascent.mastery.state) if (s.everMastered) out.push(id);
  return out;
}, []);

async function boot() {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
}

/**
 * Dismiss whatever full-frame card is standing, with a real click.
 *
 * `.fdy-close` is first on purpose. The shop is documented as opening
 * unprompted (RESUME.md, player agency), and when it does it lays a dialog over
 * the learning card and swallows the click that would have answered it. That is
 * somebody else's defect; this gate has to be able to keep playing through it.
 */
async function clearFrame() {
  /* Scoped to the DIALOG's own shown state, never to the button alone. A hidden
     card keeps its button in the DOM with a real bounding box, so
     `.fdy-close` on its own reports visible on the very first frame of the
     game — and a walk loop that clears the frame before every step then spends
     the whole session clicking a button nobody can see. Measured: thirty
     minutes, zero items. */
  for (const sel of ['.fdy.show .fdy-close', '.ses-close.show .sx-rest',
    '.ses-charter.show .sc-go', '.ses-rest.show .sr-again', '.ses-rest.show .sr-skip']) {
    const el = page.locator(sel).first();
    if (await el.count() && await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 4000, force: true }).catch(() => {});
      await page.waitForTimeout(600);
      return true;
    }
  }
  return false;
}

/**
 * Walk to the objective with real keys, and open it with a real key.
 *
 * STEERED OFF THE WORLD, TURNED WITH THE KEYBOARD.
 *
 * The first version of this steered by the objective marker's x position on
 * screen and turned with the mouse, which is how `realsession.mjs` does it and
 * is fine for twelve minutes. Over forty-five it does not hold: once the marker
 * goes to the frame edge the sign of the offset stops meaning anything, the
 * cadet circles, and the run reports "no tear reached" with the objective
 * getting steadily further away — measured, twice, at 140-190 m out and zero
 * items answered.
 *
 * So the bearing is read out of the world — the objective the game itself
 * names, and the camera's own forward vector — and the turn is made with
 * ArrowLeft/ArrowRight, which `src/core/input.js` binds for exactly this and
 * which the controls card prints. Reading where a thing is is the same class of
 * fact as reading what the answer is; every key below is a real key, and
 * nothing here moves the cadet except the keys.
 */
async function walkAndKnock(budgetMs = 45000) {
  const t0 = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  const held = new Set();
  const hold = async (code, on) => {
    if (on === held.has(code)) return;
    if (on) { held.add(code); await page.keyboard.down(code); }
    else { held.delete(code); await page.keyboard.up(code); }
  };
  const release = async () => { for (const c of [...held]) await hold(c, false); };
  let stuck = 0;
  let lastDist = Infinity;
  try {
    while (Date.now() - t0 < budgetMs) {
      if (await clearFrame()) continue;
      /* ESCAPE IS NOT A DISMISS KEY, IT IS THE PAUSE MENU. Pressing it to
         "clear a stray overlay" opens the menu, which takes the input and stops
         the cadet walking. So it is pressed only when something really is
         holding the input, and then exactly once. */
      if (await read(() => !!window.__ascent.input.uiOpen, false)) {
        await release();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        continue;
      }
      const b = await read(() => {
        const A = window.__ascent;
        const p = A.player.pos;
        const want = A.nextObjective?.();
        const list = A.rifts.list;
        let target = want && list.find((r) => r.id === want.id);
        if (!target) {
          const open = list
            .filter((r) => A.mastery.isUnlocked(r.id) && !A.mastery.get(r.id)?.mastered)
            .map((r) => ({ r, d: Math.hypot(r.pos.x - p.x, r.pos.z - p.z) }))
            .sort((x, y) => x.d - y.d);
          target = open[0]?.r || list[0];
        }
        if (!target) return null;
        const dx = target.pos.x - p.x;
        const dz = target.pos.z - p.z;
        const f = new A.THREE.Vector3();
        A.camera.getWorldDirection(f);
        let err = Math.atan2(dx, dz) - Math.atan2(f.x, f.z);
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        return { err, dist: Math.hypot(dx, dz), y: p.y };
      }, null);
      if (!b) { await page.waitForTimeout(300); continue; }

      /* A DEADBAND, AND CORRECTIONS MADE WHILE RUNNING.
       *
       * The first controller stopped dead whenever the bearing was more than
       * 0.10 rad off and turned until it was inside it. Six degrees is tighter
       * than a keyboard turn can settle on: it overshoots, turns back,
       * overshoots again, and the cadet stands on the landing plaza pirouetting
       * fifty-three metres from the first tear. Measured: four reloads, zero
       * tears reached, the objective never closer than eighty metres.
       *
       * So: face roughly the right way before setting off (0.7 rad, forty
       * degrees), and after that correct with short taps WITHOUT letting go of
       * the run key, which is what a hand does.
       *
       * WHICH WAY IS RIGHT. `err` is the bearing to the tear MINUS the camera's
       * own heading, both from `atan2(x, z)`, and in that frame ArrowRight
       * moves the heading the same way `err` counts — so pressing Right on a
       * positive error steers AWAY from the tear. This read Right, and the
       * measured consequence was the pirouette this deadband was added to stop:
       *
       *   err  0.544 -> 0.716 -> 1.129 -> 1.326 -> 2.108 -> 2.991 -> -2.834 …
       *   the cadet parked at x=1.0 z=18.6 and did not move again in 45 s,
       *   with the tear 77.2 m away and the run key released on every pass.
       *
       * With the sign corrected, the same loop on the same build closes:
       *   82.9 m -> 77.6 -> 73.2 -> 68.8 -> 63.7 -> … -> 21.8 m, err inside
       *   0.17 rad the whole way. */
      if (Math.abs(b.err) > 0.7) {
        await hold('KeyW', false);
        const code = b.err > 0 ? 'ArrowLeft' : 'ArrowRight';
        await hold(code === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight', false);
        await hold(code, true);
        await page.waitForTimeout(Math.min(360, 110 + Math.abs(b.err) * 150));
        await hold(code, false);
        continue;
      }
      await hold('ShiftLeft', b.dist > 24);
      await hold('KeyW', true);
      if (Math.abs(b.err) > 0.16) {
        // Same frame, same sign as the coarse turn above.
        const code = b.err > 0 ? 'ArrowLeft' : 'ArrowRight';
        await hold(code === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight', false);
        await hold(code, true);
        await page.waitForTimeout(Math.min(200, 70 + Math.abs(b.err) * 110));
        await hold(code, false);
      } else {
        await hold('ArrowLeft', false);
        await hold('ArrowRight', false);
      }
      for (let j = 0; j < 3; j++) {
        await page.waitForTimeout(170);
        await page.keyboard.press('KeyE');
        if (await panelOpen()) { await release(); return true; }
      }
      // No ground gained in a while, or below the deck: take the way out the
      // controls card prints.
      if (b.dist > lastDist - 1 || b.y < 0) stuck++; else stuck = 0;
      lastDist = b.dist;
      /* GETTING OFF A LEDGE, IN ESCALATING ORDER.
       *
       * Recover is the documented way out and it is tried first. It is not
       * always enough: this run photographed the cadet parked at y = 154.5,
       * 7.7 m from a tear he could not open — the ring is more than REACH_Y
       * above or below him, so the key is a silent no-op — with R pressed six
       * times and his height not moving by a centimetre. That is the world's
       * defect, not the route's, and it is in RESUME.md already ("edge
       * recovery is marginal", "a dead zone where E is a silent no-op"). A
       * gate that stops there measures that defect instead of the one it is
       * for, so it climbs down the way a player would: jump, back off, turn
       * away and run.
       */
      if (stuck >= 5) {
        await release();
        const step = Math.min(3, Math.floor(stuck / 5));
        if (step === 1) {
          await page.keyboard.press('KeyR');
          await page.waitForTimeout(1100);
        } else if (step === 2) {
          await page.keyboard.down('KeyW');
          await page.keyboard.press('Space');
          await page.waitForTimeout(900);
          await page.keyboard.up('KeyW');
        } else {
          await page.keyboard.down('KeyS');
          await page.waitForTimeout(1000);
          await page.keyboard.up('KeyS');
          await page.keyboard.down('ArrowRight');
          await page.waitForTimeout(700);
          await page.keyboard.up('ArrowRight');
          await page.keyboard.down('KeyW');
          await page.waitForTimeout(1600);
          await page.keyboard.up('KeyW');
          stuck = 0;
        }
      }
    }
  } finally { await release(); }
  return false;
}

/** Answer the open card with real input, correctly. Never fatal. */
async function answer(c) {
  /* One item may never eat the run. Everything below is bounded by this. */
  const until = Date.now() + 22000;
  // A dialog standing over the card eats the click. Take it off first.
  if (await page.locator('.fdy.show').count()) { await clearFrame(); await page.waitForTimeout(300); }
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    if (!n) return false;
    for (let i = 0; i < n; i++) {
      const v = await btns.nth(i).getAttribute('data-value').catch(() => null);
      if (String(v) === String(c.answer)) {
        const done = await btns.nth(i).click({ timeout: 4000 }).then(() => true).catch(() => false);
        if (done) return true;
        await clearFrame();
        return btns.nth(i).click({ timeout: 4000, force: true }).then(() => true).catch(() => false);
      }
    }
    await btns.nth(0).click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (c.mode === 'keypad') {
    const s = String(c.answer ?? '');
    if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else if (ch === '.') await page.keyboard.press('Period');
      else if (ch === ',') await page.keyboard.press('Comma');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(30);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  /* THE THREE SURFACES THAT ARE NOT A NUMBER AND NOT A READING.
   *
   * A harness that clicks "the first control" on these answers them wrongly,
   * which breaks the proving run every time one comes up — measured, on the
   * first attempt at this drive: eighty items answered, three lines held, the
   * count flat for fifty-six of them. A route gate that cannot get past the
   * third line cannot say anything about the fourth region.
   *
   * So each surface is driven the way a hand drives it, and the only thing read
   * out of the game is the same class of fact `panelInfo().answer` already is:
   * WHICH control, never a shortcut past it. Every placement below is a real
   * Playwright click on a real button, and every one of them goes through the
   * surface's own `place`/`drop`/`commit` and the game's own checker.
   */
  if (c.mode === 'balance') {
    // A move on the beam is not an answer — the item settles when the beam
    // solves — so the loop is "make progress until it does". `pickBad()`
    // identifies the move that would bury the unknown deeper; it clicks
    // nothing. Anything else is progress, and `undo` is on the surface.
    /* `force` on purpose: the beam is a live animation, so Playwright's
       "element is stable" check never passes and every click waits out its own
       timeout. Measured: forty-three minutes of budget spent on click timeouts,
       four lines held. A forced click is still a real mouse event at the
       element's own centre — the actionability wait is what is skipped, not the
       input. */
    for (let k = 0; k < 14 && Date.now() < until; k++) {
      const moves = page.locator('.rf-move');
      const n = await moves.count();
      if (!n) break;
      /* WHICH MOVE, AND WHY NOT "ANY MOVE BUT THAT ONE".
       *
       * `pickBad()` is a `.find` over the tray, so it names ONE bad move — and
       * the beam offers a move and its own inverse, so there is usually more
       * than one. Taking "the first index that is not the bad one" therefore
       * lands on a second bad move about a third of the time, and a balance
       * item takes three or four moves in a row: measured, on this build, the
       * hand answered 118 items and could not close `two-step` in twenty-two
       * minutes, with the beam served over and over.
       *
       * The bad SET is still readable off the surface's own accessor without
       * touching the game: `pickBad` skips a button whose `__op` is not set, so
       * nulling the ones already known bad and asking again walks the whole
       * tray. Every `__op` is put back inside the same synchronous evaluate, so
       * nothing about the surface has changed by the time a key is pressed —
       * the click that follows is a real click on an unmodified button. */
      const want = await read(() => {
        const m = window.__ascent.panel._modality;
        const first = m?.pickBad?.();
        if (!first) return 0;                       // nothing is bad: any move is progress
        const tray = first.parentElement;
        const kids = [...tray.children];
        const saved = kids.map((b) => b.__op);
        const bad = new Set();
        try {
          let hit = first;
          while (hit) {
            bad.add(kids.indexOf(hit));
            hit.__op = undefined;
            hit = m.pickBad();
          }
        } finally { kids.forEach((b, i) => { b.__op = saved[i]; }); }
        for (let i = 0; i < kids.length; i++) if (kids[i].__op && !bad.has(i)) return i;
        return -1;                                  // every move loses ground: none of them is right
      }, 0);
      if (want < 0) break;
      await moves.nth(want).click({ timeout: 2500, force: true }).catch(() => {});
      await page.waitForTimeout(280);
      if (await read(() => !!window.__ascent.panelInfo().settled, false)) return true;
      if (!(await panelOpen())) return true;
    }
    return true;
  }
  if (c.mode === 'sort') {
    // Two bays: terms carrying the letter, and plain numbers. The bay says
    // which kind it takes (`data-kind`); the chip says what it is by being
    // printed. Nothing on the surface pairs them — that was removed on purpose
    // because it was a giveaway — so this reads the chip the way a learner
    // does, off its own face.
    for (let k = 0; k < 10 && Date.now() < until; k++) {
      const chips = page.locator('.rf-chip:not(.placed):not([disabled])');
      const n = await chips.count();
      if (!n) break;
      const chip = chips.nth(0);
      const text = (await chip.textContent().catch(() => '')) || '';
      const isVar = /[a-zA-Z]/.test(text);
      await chip.click({ timeout: 2500, force: true }).catch(() => {});
      await page.waitForTimeout(140);
      /* THE BAY'S HEADER, NOT THE BAY.
       *
       * A filed chip is a DISABLED button, and it is appended inside the bay —
       * so once two or three are in, the bay's own centre is a disabled button
       * and a click aimed there is swallowed before it reaches the bay's
       * handler. The chip stays picked, the next pass unpicks it, and the two
       * alternate for ever. Measured, on this build: 222 items answered, six
       * lines held, `like-terms` served 90 times and never held, because its
       * `sort` form could not be completed once a bay had four chips in it.
       * The header is part of the bay, is never covered, and the click bubbles
       * to the same handler a drop lands on. */
      await page.locator(`.rf-bay[data-kind="${isVar ? 'var' : 'num'}"] > header`).first()
        .click({ timeout: 2500, force: true }).catch(() => {});
      await page.waitForTimeout(240);
      /* The surface settles 560 ms after the last chip is filed, so a run that
         asks immediately reads its own correct answer as unfinished. */
      if (!(await page.locator('.rf-chip:not(.placed):not([disabled])').count())) await page.waitForTimeout(900);
      if (await read(() => !!window.__ascent.panelInfo().settled, false)) return true;
      if (!(await panelOpen())) return true;
    }
    return true;
  }
  if (c.mode === 'area') {
    // Two parts of a field to cover. `wants()` is the surface's own read-only
    // accessor — it exists for the answer-integrity audit — and it says what
    // each part is worth; the chips carry their values in the DOM.
    const wants = await read(() => window.__ascent.panel._modality?.wants?.() || [], []);
    for (const [i, cls] of [[0, 'a'], [1, 'b']]) {
      const want = String(wants[i] ?? '');
      if (!want) continue;
      const chip = page.locator(`.rf-chip:not(.placed):not([disabled])[data-value="${want.replace(/"/g, '\\"')}"]`).first();
      if (!(await chip.count())) continue;
      await chip.click({ timeout: 2500, force: true }).catch(() => {});
      await page.waitForTimeout(140);
      await page.locator(`.rf-cell.${cls}`).first().click({ timeout: 2500, force: true }).catch(() => {});
      await page.waitForTimeout(240);
    }
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

/** Everything above, with nothing allowed to end the run. */
async function tryAnswer(c) {
  try { return await answer(c); } catch { return false; }
}

// ===========================================================================
await boot();
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 });
await page.waitForTimeout(3000);

// 1. the shipped first region, unmoved
const cold = await content();
note(cold.units.length === 1, 'a cleared save opens exactly one region', cold.units.join(','));
note(cold.nodes.length === 10, 'and it is the shipped ten-line lattice', `${cold.nodes.length} lines`);
note(!!cold.route, 'the loader reports a route at all', cold.route ? JSON.stringify(cold.route.open) : 'none');
const firstRegion = new Set(cold.nodes);
await page.screenshot({ path: path.join(OUT, '01-first-region.png') });

/**
 * `--warm` — START THE RUN ONE LINE SHORT OF THE OPENING.
 *
 * OFF BY DEFAULT, and the default is the claim: a cleared save, every line
 * earned by playing. The flag exists because of a measured ceiling in the only
 * environment this can run in. A headless software-GL browser answers about one
 * item every eight seconds, and `tools/route-proof.mjs` measures the road at 30
 * items for a learner who answers everything correctly — a hand that is right
 * perhaps four times in five needs two to three times that, and this run has
 * twice reached 160-220 items and five or six lines before the renderer or the
 * budget gave out. A gate nobody can finish is a gate nobody runs.
 *
 * So `--warm` seeds every line of the first region EXCEPT THE LAST one, and the
 * run then plays the last one with the same keys, on the same surfaces, through
 * the same checker — which is the answer that buys the region and therefore the
 * only answer the OPENING BEAT can be photographed on. The seed is not progress
 * awarded by the harness: it is the record `route-proof.mjs` proves the real
 * MasteryEngine reaches, and every assertion below still has to be earned by
 * the item that follows it.
 */
if (process.argv.includes('--warm')) {
  const short = cold.nodes.slice(0, -1);
  await page.evaluate((ids) => {
    const raw = JSON.parse(localStorage.getItem('ascent.save') || '{}');
    const sk = {};
    for (const id of ids) sk[id] = { mastered: true, everMastered: true, pL: 0.99, attempts: 6, correct: 6, cleanRun: 3, placed: true };
    localStorage.setItem('ascent.save', JSON.stringify({
      ...raw, mastery: { ...(raw.mastery || {}), skills: { ...((raw.mastery || {}).skills || {}), ...sk } },
    }));
  }, short);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  const warmed = await heldNow();
  note(warmed.length === cold.nodes.length - 1,
    '--warm: the run starts one line short of the opening, and that line is still unheld',
    `${warmed.length} of ${cold.nodes.length} held, owed ${cold.nodes.filter((n) => !warmed.includes(n)).join(',')}`);
}

// 2. play, with real input, until the lattice opens
const t0 = Date.now();
const deadline = t0 + MINUTES * 60000;
let items = 0, plateShot = false, crossedInGame = false, stranded = 0;
let lastRenew = Date.now();
let waiting = null;

while (Date.now() < deadline) {
 try {
  if (!(await panelOpen())) {
    await clearFrame();
    // A sealed tear offers the next one where the player is standing.
    const chained = await (async () => {
      const t1 = Date.now();
      while (Date.now() - t1 < 4000) { if (await panelOpen()) return true; await page.waitForTimeout(180); }
      return false;
    })();
    if (!chained) {
      const got = await walkAndKnock(45000);
      if (!got) {
        /* STRANDED. Twice in a row and the cadet is not walking anywhere: the
         * probe below has photographed him parked at y = 154.5 with a tear
         * 7.7 m away that E will not open, Recover pressed six times and his
         * height not moving by a centimetre. That is the world's defect and it
         * is on RESUME.md's list already; this gate is about the road past
         * Level 1 and may not be stopped by it.
         *
         * So it does what a stuck player does: it opens the page again. The
         * record is on disk — src/main.js writes it on every answer — so the
         * cadet comes back on the landing plaza with every line he has held,
         * which is a thing this route has to survive anyway. */
        stranded++;
        if (stranded >= 1) {
          stranded = 0;
          say(`     [renew] a fresh tab, same save — ${Math.round((Date.now() - t0) / 1000)}s`);
          await renew(URL);
        }
      } else stranded = 0;
      if (!got) {
        const d = await read(() => {
          const A = window.__ascent;
          const p = A.player.pos;
          const near = A.rifts.list.map((r) => Math.hypot(r.pos.x - p.x, r.pos.z - p.z)).sort((a, b) => a - b)[0];
          return { y: +p.y.toFixed(1), near: +near.toFixed(1), ui: !!A.input.uiOpen, dist: document.querySelector('.gd-dist')?.textContent || null };
        }, null);
        say(`     [walk] no tear reached — ${Math.round((Date.now() - t0) / 1000)}s ${JSON.stringify(d)}`);
      }
    }
    if (!(await panelOpen())) continue;
  }
  const c = await info();
  if (!c || !c.open) { await page.waitForTimeout(200); continue; }
  if (c.settled) {
    const t1 = Date.now();
    while ((await panelOpen()) && Date.now() - t1 < 4000) await page.waitForTimeout(200);
    continue;
  }
  items++;
  say(`     [item ${items}] ${c.skill} · ${c.mode} · ${Math.round((Date.now() - t0) / 1000)}s`);
  await tryAnswer(c);
  await page.waitForTimeout(850);
  if (await panelOpen()) {
    if (await read(() => !!window.__ascent.panelInfo().settled, false)) {
      const t1 = Date.now();
      while ((await panelOpen()) && Date.now() - t1 < 3600) await page.waitForTimeout(200);
    } else {
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  // THE MOMENT. The plate is live in the frame — photograph it there.
  if (!plateShot) {
    const live = await read(() => {
      const el = document.querySelector('.meta-turn.show');
      if (!el) return null;
      return { kick: el.querySelector('.tn-kick')?.textContent || '', title: el.querySelector('.tn-title')?.textContent || '' };
    }, null);
    if (live && /lattice|red|sieć/i.test(live.kick)) {
      plateShot = true;
      await page.screenshot({ path: path.join(OUT, '02-lattice-opens.png') });
      note(true, 'the lattice opening takes the frame, with its own words on it', `${live.kick} · ${live.title}`);
    }
  }

  /* `content().route` is what the island was BUILT from and cannot move while
     the tab is open. The live answer is `road`, off the learner model. */
  const st = await content();
  if (st?.road?.waiting) { waiting = st.road.waiting; break; }
  /* The game may have made the crossing itself: taking ANOTHER RUN off the rest
     beat is a new planetfall, and `src/session/index.js` raises the island for
     it. If that has happened the island is already bigger and there is nothing
     left to wait for. */
  if (st && st.units.length > cold.units.length) { crossedInGame = true; break; }
  /* …and before it degrades, not only after. Four minutes is comfortably
     inside the point where this environment's frame rate falls away. */
  if (Date.now() - lastRenew > 4 * 60000) {
    lastRenew = Date.now();
    say(`     [renew] a fresh tab, same save — ${Math.round((Date.now() - t0) / 1000)}s`);
    await renew(URL);
  }
  if (items % 8 === 0) {
    const h = await heldNow();
    say(`     …${items} items, ${h.length} lines held, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
 } catch (e) {
  // The island may have been raised under us. Wait for the game to come back
  // and carry on playing; nothing here is allowed to end the run.
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);
 }
}

note(!!waiting || crossedInGame, 'a region beyond the first was earned by playing',
  waiting || (crossedInGame ? 'the game crossed to it on its own' : `none after ${items} items`));
const held = await heldNow();
note(held.length >= 10, 'and it was earned by holding lines, not by a timer', `${held.length} lines held`);
if (!plateShot) {
  // The beat may have queued behind the tear the answer was given in; catch it
  // on the next few frames rather than calling it missing.
  for (let k = 0; k < 40 && !plateShot; k++) {
    await page.waitForTimeout(400);
    const live = await read(() => {
      const el = document.querySelector('.meta-turn.show');
      return el ? { kick: el.querySelector('.tn-kick')?.textContent || '', title: el.querySelector('.tn-title')?.textContent || '' } : null;
    }, null);
    if (live && /lattice|red|sieć/i.test(live.kick)) {
      plateShot = true;
      await page.screenshot({ path: path.join(OUT, '02-lattice-opens.png') });
      note(true, 'the lattice opening takes the frame, with its own words on it', `${live.kick} · ${live.title}`);
    }
  }
}
await page.screenshot({ path: path.join(OUT, '03-earned.png') });

// 3. come back, the way a learner comes back: open the page again.
// (Unless the game already did it: taking another run off the rest beat is a
// planetfall, and `crossIfWaiting` raises the island for it.)
if (!crossedInGame) await page.reload({ waitUntil: 'domcontentloaded' });
else await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 });
await page.waitForTimeout(3500);
const after = await content();
note(after.units.length >= 2, 'the island is raised with the new region on it', after.units.join(','));
note(after.nodes.length > cold.nodes.length, 'and it holds more lines than the first', `${cold.nodes.length} -> ${after.nodes.length}`);
const newLines = after.nodes.filter((id) => !firstRegion.has(id));
await page.screenshot({ path: path.join(OUT, '04-planetfall.png') });

// 4. WALK to a tear in the new region and open it with a real key
let reached = null;
const t2 = Date.now();
while (Date.now() - t2 < 8 * 60000 && !reached) {
  if (!(await panelOpen())) {
    await clearFrame();
    if (!(await walkAndKnock(60000))) continue;
  }
  const c = await info();
  if (!c || !c.open) { await page.waitForTimeout(200); continue; }
  if (c.settled) { await page.waitForTimeout(600); continue; }
  if (newLines.includes(c.skill)) {
    reached = c.skill;
    await page.screenshot({ path: path.join(OUT, '05-level-2-item.png') });
    break;
  }
  await tryAnswer(c);
  await page.waitForTimeout(900);
  if (await panelOpen()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}
note(!!reached, 'a tear in the new region opens on a real key, on a line the first region did not have', reached || 'not reached');

// ---------------------------------------------------------------- the read
note(errors.length === 0, 'no console errors on the way', errors.slice(0, 3).join(' | '));
const report = {
  url: URL,
  itemsAnsweredWithRealInput: items,
  firstRegion: cold.units,
  firstRegionLines: cold.nodes.length,
  earned: waiting,
  afterReload: { units: after.units, lines: after.nodes.length },
  linesHeldWhenEarned: held.length,
  reachedInNewRegion: reached,
  crossedInGame,
  plateShot,
  errors,
  steps,
};
await writeFile(path.join(OUT, 'route.json'), JSON.stringify(report, null, 2));
console.log('\n' + JSON.stringify({ ...report, steps: undefined }, null, 2));
await browser.close();
const ok = steps.every((s) => s.ok);
console.log(ok ? '\nPASS — a player with no query string reached the second region.' : '\nFAIL');
process.exit(ok ? 0 : 1);
