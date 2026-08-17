/**
 * THE TAKEOVER GATE — chosen versus imposed, counted off the real running game.
 *
 * A cold critic played forty-one minutes and came back with one number that no
 * screenshot gate in this repo could have produced:
 *
 *   "7 times I CHOSE where to go … ~16 times I was auto-advanced or taken over:
 *    the boot veil, the establishing shot, the Controls card, ORDERS, ORDERS
 *    re-issued mid-run and auto-dismissed before I could click BEGIN THE RUN,
 *    the Bronze ceremony, the Chapter 3 title card, the LINE SEALED card, six
 *    items that opened with no travel at all, a rift that opened on contact
 *    while I was placing walls, and the Foundry shop which opened full-screen
 *    three times with no input from me — once mid-sprint, once mid-build."
 *
 * That is an agency defect, and agency is not visible in a photograph. It is
 * only visible in the JOIN of two timelines: what the player's hands did, and
 * what the screen took. So this script records both off the real page and
 * joins them.
 *
 * WHAT IT RECORDS
 *   · every trusted input event the browser delivers — the recorder is
 *     installed by `addInitScript` before a line of the game has run, and it
 *     listens in the capture phase, so nothing the game does can hide a key
 *     from it. `isTrusted` is asserted on every event: a synthetic click the
 *     page dispatched to itself is not a player asking for anything.
 *   · every transition of every surface that can hold the frame, hidden →
 *     visible and visible → hidden, sampled every animation frame.
 *
 * HOW IT DECIDES  (one rule, applied to every open)
 *   An open is CHOSEN when the player asked for it. Asking is:
 *     — an interact key (E / F), a menu key (Esc / Tab), or Enter; or
 *     — a real mouse click; or
 *     — for a RIFT only: walking into it under their own steam while not
 *       otherwise engaged. Contact-to-open is a deliberate discoverability
 *       feature and the cold-play gate depends on it, so a player who held W
 *       across a meadow and arrived at a ring got what they were walking
 *       toward. That is a choice, and it is scored as one.
 *   Everything else is a TAKEOVER: the screen took the frame and the player
 *   was not asking.
 *
 *   Two further things score as takeovers even though nothing opened:
 *     — a surface that DISMISSES ITSELF with no input, which is the ORDERS
 *       complaint exactly ("auto-dismissed before I could click BEGIN");
 *     — a chained item: a learning card that opens while the player is still
 *       standing where the last one closed, having travelled nowhere.
 *
 * THE OPENING BEAT IS ALLOWED ONE. The brief permits a deliberate opening —
 * boot veil, establishing shot, first ORDERS. Those three are collapsed into a
 * single scored event, `opening-beat`, and reported separately from the count,
 * because a game is allowed to begin.
 *
 *   node tools/critic/takeover.mjs --minutes 15
 *   node tools/critic/takeover.mjs --minutes 15 --url http://127.0.0.1:5173
 *   node tools/critic/takeover.mjs --self-test
 *
 * Exit 0 = the player chose more often than they were taken over.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const URL = arg('url', 'http://127.0.0.1:5173');
const MINUTES = Number(arg('minutes', 15));
const OUT = path.resolve(arg('out', 'shots/takeover'));
const LOC = arg('loc', 'en');
const W = 1600;
const H = 900;
const SELFTEST = flag('self-test');

/** How long after an ask an open may still be attributed to it. */
const ASK_WINDOW = 1800;
/** m/s above which the cadet is unambiguously under way rather than standing. */
const MOVING = 0.6;
/** m/s above which they are sprinting somewhere — matches src/world/beckon.js. */
const SPRINT_SPEED = 9.4;

await mkdir(OUT, { recursive: true });

// ---------------------------------------------------------------- the recorder
// Everything in this string runs in the page, before the game boots.
const RECORDER = `(() => {
  const R = { input: [], surf: [], t0: performance.now() };
  window.__take = R;

  const ASK_KEYS = new Set(['KeyE', 'KeyF', 'Escape', 'Tab', 'Enter', 'Space']);
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  const held = new Set();
  const push = (kind, what, where) => R.input.push({ t: performance.now(), kind, what, where });

  addEventListener('keydown', (e) => {
    if (!e.isTrusted || e.repeat) return;
    held.add(e.code);
    if (ASK_KEYS.has(e.code)) push('ask', e.code);
    else if (MOVE_KEYS.has(e.code)) push('move', e.code);
    else push('key', e.code);
  }, true);
  addEventListener('keyup', (e) => { if (e.isTrusted) held.delete(e.code); }, true);

  /**
   * WHERE a click landed decides what it was asking for. A click on a reading
   * inside the learning card is an ANSWER; if the next card opens 900 ms later
   * that is the chain, not a request. Only a click that lands on the world or
   * on an affordance outside a modal is a request for something new.
   */
  // ONLY the learning card. A click on BEGIN THE RUN, on STEP BACK, or on
  // ONE MORE LINE is a decision the player made and must score as one; the
  // single place a click means "here is my answer to a question" is the rift
  // panel. Casting the net wider than that scored the player's own click on
  // ORDERS as an in-modal answer and then reported the card as having
  // dismissed itself, which is the opposite of what happened.
  const inModal = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.classList && n.classList.contains('rift')) return true;
    }
    return false;
  };
  const tagOf = (el) => {
    if (!el || !el.classList) return 'world';
    if (inModal(el)) return 'inside-modal';
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.classList && n.classList.length) return n.classList[0];
    }
    return 'world';
  };
  addEventListener('mousedown', (e) => {
    if (!e.isTrusted) return;
    const w = tagOf(e.target);
    push(w === 'inside-modal' ? 'answer' : 'ask', 'mouse' + e.button, w);
  }, true);
  addEventListener('wheel', (e) => { if (e.isTrusted) push('move', 'wheel'); }, true);

  // ---- what the harness itself declares it is doing, so a shop that opens
  // mid-build can be told apart from one that opens while standing still.
  R.phase = 'idle';
  R.setPhase = (p) => { R.phase = p; R.input.push({ t: performance.now(), kind: 'phase', what: p }); };

  // ---- surfaces that can hold the frame -------------------------------------
  const SURFACES = [
    ['boot',      '#boot:not(.gone)'],
    ['cold-open', '.meta-open.on'],
    ['controls',  '.fc.show'],
    ['orders',    '.ses-charter.show'],
    ['rift',      '.rift.show'],
    ['foundry',   '.fdy.show'],
    ['rite',      '.meta-rite.show'],
    ['chapter',   '.meta-turn.show'],
    ['close',     '.ses-close.show'],
    ['rest',      '.ses-rest.show'],
    ['dossier',   '.meta-dossier.show'],
    ['menu',      '.mnu.show'],
  ];
  const was = new Map(SURFACES.map(([n]) => [n, false]));

  /** Does the game currently consider the player's input to belong to a panel? */
  const modalNow = () => {
    try { return !!window.__ascent?.input?.uiOpen; } catch { return false; }
  };
  /**
   * How much of the frame this surface actually covers.
   *
   * The difference between "a card appeared" and "the screen was taken" is not
   * a matter of opinion, and it should not be a list of names in this file
   * either. A corner card teaching the movement keys and a full-bleed rank
   * ceremony are different events; measuring the rectangle is how the script
   * tells them apart without being told.
   */
  const coverOf = (el) => {
    try {
      const r = el.getBoundingClientRect();
      return (r.width * r.height) / (innerWidth * innerHeight);
    } catch { return 0; }
  };

  // Where the boots are, so "opened with no travel at all" is metres and not
  // a feeling. Read off the game's own state, which is observation only.
  const where = () => {
    try { const p = window.__ascent && window.__ascent.player && window.__ascent.player.pos;
      return p ? { x: p.x, z: p.z } : null; } catch { return null; }
  };

  /**
   * WHAT THE CADET WAS ACTUALLY DOING, off the physics rather than off the keys.
   *
   * Reading held keys at the instant a surface appears is not the same question
   * and gives the wrong answer: a player crossing a meadow releases W to turn,
   * to look, to let a slope carry them, and a rift that opened during one of
   * those coasting frames sampled as "nobody was moving" when in fact somebody
   * was walking at five metres a second. Speed, the wing and the build hand are
   * the ground truth for "was I in the middle of something", and they are the
   * exact three states src/world/beckon.js now tests before letting a tear open
   * on contact — so this measures the fix in the same terms the fix is written.
   */
  const doing = () => {
    try {
      const a = window.__ascent;
      return {
        speed: a?.player?.speed ?? 0,
        gliding: !!a?.player?.gliding,
        building: !!a?.builder?.busyBuilding,
      };
    } catch { return { speed: 0, gliding: false, building: false }; }
  };

  const tick = () => {
    for (const [name, sel] of SURFACES) {
      let el = null;
      try { el = document.querySelector(sel); } catch { el = null; }
      const on = !!el;
      if (on !== was.get(name)) {
        was.set(name, on);
        // The keys being HELD at this instant, not the edges. A player who has
        // held W across a meadow for twenty seconds fires one keydown and is
        // still, unmistakably, walking.
        const walking = [...held].some((c) => MOVE_KEYS.has(c));
        R.surf.push({
          t: performance.now(), name, on, phase: R.phase, at: where(), walking,
          held: [...held], modal: modalNow(), cover: on ? coverOf(el) : 0, ...doing(),
          /* Turning on the spot is driving, and it reads as speed zero: a cadet
             holding ArrowRight to look around, standing on a dais, is steering.
             A timer is the case where NOTHING is held and NOTHING is moving. */
          steering: walking,
        });
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript(RECORDER);
const page = await ctx.newPage();

const errors = [];
/* Console errors, stamped, because WHEN one arrived decides whether it is the
   game's. The preview server this runs against is torn down the moment the run
   ends, and the page notices: a handful of ERR_CONNECTION_REFUSED lines arrive
   from the dying socket after the last frame the player ever sees. Those are
   this harness's own exhaust. Anything logged while the game is actually being
   played is the game's, and is counted. */
const stamp = (text) => errors.push({ t: Date.now(), text });
page.on('console', (m) => { if (m.type() === 'error') stamp(m.text()); });
page.on('pageerror', (e) => stamp('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate((l) => {
  localStorage.clear();
  localStorage.setItem('ascent.locale', l);
}, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

const phase = (p) => page.evaluate((x) => window.__take.setPhase(x), p);

// ------------------------------------------------------------------- helpers
const panelOpen = () => page.evaluate(() => { try { return !!window.__ascent.panelInfo().open; } catch { return false; } });
const card = async () => {
  const c = await page.evaluate(() => { try { return window.__ascent.panelInfo(); } catch { return null; } });
  return c && c.open ? c : null;
};
const cx = Math.round(W / 2);
const cy = Math.round(H / 2);
let mx = cx;

async function hold(code, ms) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

/** Answer whatever is on the card, with real keys and real clicks. */
async function answer(c) {
  // A READING SURFACE. Prefer the option that matches the answer the rig is
  // holding; where the answer is an expression the rendered value need not
  // match it literally, so fall back to the first reading NOT already crossed
  // out. The card stays up until it comes out right, and every wrong press
  // marks one — so cycling always terminates. Without this the script pressed
  // the same wrong reading for twelve minutes and the run died inside one card.
  const readings = page.locator('.rf-reading');
  if (await readings.count()) {
    const n = await readings.count();
    let want = -1;
    for (let i = 0; i < n; i++) {
      const v = await readings.nth(i).getAttribute('data-value');
      if (String(v) === String(c.answer)) { want = i; break; }
    }
    if (want < 0) {
      for (let i = 0; i < n; i++) {
        const b = readings.nth(i);
        const bad = await b.evaluate((el) => el.classList.contains('wrong') || el.disabled)
          .catch(() => true);
        if (!bad) { want = i; break; }
      }
    }
    if (want < 0) return false;
    await readings.nth(want).click({ timeout: 5000 }).catch(() => {});
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

/** Work the card that is up until it closes or the budget runs out. */
async function workCard(budget = 40000) {
  const t0 = Date.now();
  let stuck = 0;
  while (Date.now() - t0 < budget) {
    const c = await card();
    if (!c) return true;
    const ok = await answer(c);
    if (!ok && ++stuck > 3) break;
    await page.waitForTimeout(850);
    // A settled card wants one more press to let go of the frame.
    const s = await page.evaluate(() => { try { return !!window.__ascent.panelInfo().settled; } catch { return false; } });
    if (s) { await page.keyboard.press('Enter'); await page.waitForTimeout(450); }
  }
  /* WALK AWAY FROM A CARD YOU CANNOT ANSWER. A player who cannot get one out
     leaves; a script that cannot must do the same, or the whole session is
     spent inside a single question with `uiOpen` true and every movement key
     going nowhere. The rig prints its own close control and this presses it. */
  if (await panelOpen()) {
    await page.locator('#rf-close').click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
    if (await panelOpen()) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  }
  return false;
}

/**
 * The boots get wedged in this terrain and the game says so, in its own card,
 * with the key on it. A player reads that card and presses R; a harness that
 * does not spends the rest of the run standing in a hole reporting that nothing
 * ever takes the frame, which is a pass for the wrong reason.
 */
async function recoverIfStuck() {
  const stuck = await page.evaluate(() => !!document.querySelector('.fcs.show'));
  if (!stuck) return false;
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(1400);
  return true;
}

/**
 * Hand the frame back, the way a player would, whatever is holding it.
 *
 * The first fifteen-minute run spent thirteen and a half of its minutes
 * looking at the shop, because the script pressed E next to the counter,
 * opened it, and had no idea how to leave. `input.uiOpen` was true for the
 * rest of the run, so every WASD press went nowhere and the audit truthfully
 * reported that almost nothing ever took the frame. That is a harness that
 * passes by not playing, which is worse than one that fails.
 */
async function handBackFrame() {
  for (const sel of ['.sc-go', '.sx-more', '.sr-again', '.sr-skip']) {
    const el = page.locator(sel);
    if (await el.count() && await el.first().isVisible().catch(() => false)) {
      await el.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  // Anything else modal — the counter, the menu, the dossier — leaves on the
  // key the game prints on it.
  for (let i = 0; i < 3; i++) {
    const held = await page.evaluate(() => {
      const sel = ['.fdy.show', '.mnu.show', '.meta-dossier.show'];
      return sel.some((s) => !!document.querySelector(s));
    });
    if (!held) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  // Last resort: the game says the frame is a panel's and no panel is on
  // screen. Never seen, but a fifteen-minute run must not be able to end here.
  const wedgedModal = await page.evaluate(() => {
    try {
      return !!window.__ascent.input.uiOpen && !document.querySelector('.rift.show');
    } catch { return false; }
  });
  if (wedgedModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
}

/**
 * Walk where the game says to go, with real keys and real mouse look, and
 * press the interact key on arrival. Nothing here teleports.
 */
/**
 * Turn the view with the ARROW KEYS.
 *
 * Not with `mouse.move`, which is what the first two runs of this script used
 * and is why they were worthless: a headless browser does not grant pointer
 * lock, the game notices and says so on the controls card — "the mouse cannot
 * turn the view here, turn with the arrow keys" — and every mouse-move steering
 * correction went into a void. The run walked in whatever direction it happened
 * to be facing for twelve minutes and then reported, quite truthfully, that
 * almost nothing had taken the frame.
 *
 * The arrows are a real binding that works with a lock and without one
 * (src/core/input.js), they are printed on the card, and `coldplay.mjs` proves
 * a whole rift can be reached with them. So this is a player's hands, not a
 * workaround.
 */
async function turn(code, ms) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

/**
 * Where the game wants the cadet to go, and where that is on screen right now.
 *
 * Observation only, and the same two facts a player has: the gold column the
 * affordance layer stands over the next tear, and where it is relative to the
 * middle of the frame. Projecting the target through the real camera is how
 * `coldplay.mjs` aims too — it is the script's equivalent of looking.
 */
async function bearing() {
  return page.evaluate(() => {
    const a = window.__ascent;
    if (!a) return null;
    const live = (a.rifts?.list || []).filter((r) => !r.locked && !r.mastered);
    if (!live.length) return null;
    // The one the scheduler actually wants, when it names one; otherwise the
    // nearest thing that is still worth opening.
    let want = null;
    try {
      const id = a.nextObjective?.()?.skill;
      want = live.find((r) => r.id === id) || null;
    } catch { want = null; }
    if (!want) {
      let best = Infinity;
      for (const r of live) {
        const d = Math.hypot(r.pos.x - a.player.pos.x, r.pos.z - a.player.pos.z);
        if (d < best) { best = d; want = r; }
      }
    }
    if (!want) return null;
    const v = new a.THREE.Vector3(want.pos.x, want.pos.y + 1.5, want.pos.z).project(a.camera);
    return {
      id: want.id,
      d: Math.hypot(want.pos.x - a.player.pos.x, want.pos.z - a.player.pos.z),
      x: (v.x * 0.5 + 0.5) * innerWidth,
      behind: v.z > 1,
    };
  });
}

/**
 * Walk to the tear the game is pointing at, with real keys, in a closed loop.
 *
 * TURN UNTIL IT IS IN FRONT OF YOU, THEN WALK. The first three runs of this
 * script steered with `mouse.move`, which does nothing at all without pointer
 * lock — and a headless browser never grants it, which the game itself says on
 * the controls card. Those runs walked in whatever direction they happened to
 * be facing and reported, truthfully and uselessly, that nothing had taken the
 * frame. The arrows are a real binding the game prints and `coldplay.mjs`
 * proves; the loop below is the compass a player reads, closed.
 */
async function travel(budget = 40000) {
  const t0 = Date.now();
  let walking = false;
  const go = async (on) => {
    if (on === walking) return;
    walking = on;
    if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
  };
  try {
    while (Date.now() - t0 < budget) {
      const b = await bearing();
      if (!b) {
        await go(false);
        await turn('ArrowRight', 420);
      } else if (b.behind || Math.abs(b.x - cx) > 70) {
        // Face it first. Turning while sprinting forward describes an arc that
        // never arrives.
        await go(false);
        const dir = b.behind ? 'ArrowRight' : (b.x > cx ? 'ArrowRight' : 'ArrowLeft');
        await turn(dir, b.behind ? 300 : Math.min(280, 50 + Math.abs(b.x - cx) * 0.22));
      } else {
        await go(true);
        await page.waitForTimeout(320);
        // Close enough to knock: the interact key works inside nine metres.
        if (b.d < 8) {
          await go(false);
          await page.keyboard.press('KeyE');
          await page.waitForTimeout(650);
        }
      }

      await page.waitForTimeout(120);
      if (await panelOpen()) return true;
      if (await recoverIfStuck()) await go(false);
      // Something that is not the learning card has taken the frame — the
      // counter, most often, since the interact key is pressed on arrival and
      // the shop stands on the way to everywhere. Read it and step back out,
      // exactly as a player does, instead of walking into a wall for the rest
      // of the run.
      if (await page.evaluate(() => !!document.querySelector('.fdy.show'))) {
        await go(false);
        await page.waitForTimeout(1400);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      }
    }
  } finally { await go(false); }
  return await panelOpen();
}

// ------------------------------------------------------------------- the play
// A player who does the things the critic did: reads the opening, walks, works
// tears, sprints across the plateau, and stops to build.
const t0 = Date.now();
const deadline = t0 + MINUTES * 60000;
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + '.png') }).catch(() => {}); };

await page.waitForTimeout(4000);
await shot('00-arrival');

/* The opening beat: read it, then dismiss it ON PURPOSE, with a real click on
   the real button.
   The wait is generous because the orders now follow the cold open rather than
   a stopwatch, and the cold open retracts when the cadet takes a step — which
   a script sitting still has not done. A player who reads the establishing
   shot for fifteen seconds gets their orders fifteen seconds in, and this is
   that player. Clicking BEGIN THE RUN rather than mashing a key is the point:
   it proves the button is still there to be clicked, which is the entire
   complaint that removed the auto-begin. */
phase('opening');
let ordersProof = 'orders never appeared';
try {
  await page.waitForSelector('.ses-charter.show .sc-go', { timeout: 30000 });
  await shot('01-orders');
  /* SIT ON IT FOR LONGER THAN THE OLD TIMER. The card used to begin the run by
     itself after sixteen seconds, which is the defect in one sentence: "ORDERS
     … auto-dismissed before I could click BEGIN THE RUN". Twenty-two seconds
     of doing nothing at all is the evidence that it no longer does. */
  await page.waitForTimeout(22000);
  const stillUp = await page.evaluate(() => !!document.querySelector('.ses-charter.show'));
  ordersProof = stillUp
    ? 'ORDERS still on screen and still clickable after 22s of no input'
    : 'ORDERS DISMISSED ITSELF within 22s';
  if (stillUp) await page.locator('.sc-go').click({ timeout: 5000 });
} catch { /* no orders on this path */ }
console.log('  ' + ordersProof);
await page.waitForTimeout(1200);

/** One reading of the engine's own median every lap, across the whole run. */
const fpsSeen = [];
const sampleFps = async () => {
  const v = await page.evaluate(() => {
    try { return window.__ascent.state().perf?.fps ?? null; } catch { return null; }
  });
  if (Number.isFinite(v) && v > 0) fpsSeen.push(v);
};

let laps = 0;
while (Date.now() < deadline) {
  laps++;
  await sampleFps();
  const left = () => Math.max(1000, deadline - Date.now());
  process.stdout.write(`\r  lap ${laps}  ${Math.round((deadline - Date.now()) / 1000)}s left    `);

  await handBackFrame();
  await recoverIfStuck();

  // --- travel to whatever the world is pointing at, then knock ---
  phase('travel');
  const arrived = await travel(Math.min(40000, left()));
  if (Date.now() >= deadline) break;

  if (!arrived) {
    phase('travel');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
  }

  // --- work whatever opened, and take the tear up on the rest of the stint ---
  if (await panelOpen()) {
    phase('working');
    await workCard(Math.min(60000, left()));

    /* The tear no longer serves the second and third items of an arrival on a
       timer — it offers them, and the plate on the ring says so. A player who
       wants them presses the key they are already standing in front of, so
       that is what this does. Each press is a real keydown and is scored as
       what it is: the player asking. */
    for (let more = 0; more < 2 && Date.now() < deadline; more++) {
      // Read off the plate the player reads: does any visible ring say the
      // CONTINUE verb right now? The expected wording comes from the game's own
      // bundle rather than being spelled out here, so this works in ES and PL.
      const offered = await page.evaluate(() => {
        const want = window.__ascent.t('afford.again');
        return [...document.querySelectorAll('.afd-call')].some((n) => n.style.display !== 'none'
          && (n.querySelector('.afd-verb')?.textContent || '') === want);
      });
      if (!offered) break;
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(700);
      if (!(await panelOpen())) break;
      await workCard(Math.min(45000, left()));
    }
  }
  if (Date.now() >= deadline) break;
  await handBackFrame();

  // --- stand still: does anything take the frame while I do nothing? ---
  phase('idle');
  await page.waitForTimeout(3500);
  if (Date.now() >= deadline) break;

  // --- sprint across the plateau, which is where the shop stands ---
  phase('sprint');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4200);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  if (Date.now() >= deadline) break;

  // --- build: the one thing that must never be interrupted ---
  if (laps % 2 === 0) {
    phase('build');
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(cx + (i - 2) * 60, cy + 40);
      await page.mouse.down();
      await page.waitForTimeout(260);
      await page.mouse.up();
      await page.waitForTimeout(420);
    }
    await page.waitForTimeout(1500);
  }
  if (Date.now() >= deadline) break;

  // --- walk back, at a stroll, with nothing asked for ---
  phase('stroll');
  await hold('KeyS', 2200);
  await page.waitForTimeout(1800);

  if (laps % 3 === 0) await shot('lap-' + laps);
}
phase('done');
/** The last instant that counts as "the game being played". See the error filter. */
const playEndedAt = Date.now();
await shot('99-end');

// ------------------------------------------------------------------ the join
const rec = await page.evaluate(() => ({
  input: window.__take.input, surf: window.__take.surf, t0: window.__take.t0,
}));

// The engine keeps frame-time percentiles over a rolling window, so the median
// is read off the same log the quality scaler steers by rather than off an
// average, which hides exactly the stalls a player notices. `fpsSeen` is the
// harness's own sampling across the whole run, because a rolling window at the
// final frame only describes the final four seconds.
const fps = await page.evaluate(() => {
  const s = window.__ascent?.state?.();
  return { now: s?.fps ?? null, p50: s?.perf?.fps ?? null, low1: s?.perf?.fps1Low ?? null };
});
const sorted = fpsSeen.slice().sort((a, b) => a - b);
const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
const worst = sorted.length ? sorted[Math.floor(sorted.length * 0.05)] : null;

await browser.close();

// ---- classify -------------------------------------------------------------
/**
 * An ASK is an input that requests something new. Answering an item is not one:
 * Enter and Space submit, and a click inside a modal is an answer. If those
 * counted, every chained card in the game would score as a player's choice —
 * which is precisely the illusion this script exists to strip away.
 */
const SUBMIT = new Set(['Enter', 'Space']);
const asks = rec.input.filter((e) => e.kind === 'ask' && !SUBMIT.has(e.what));
const lastBefore = (list, t) => {
  let best = null;
  for (const e of list) { if (e.t <= t && (!best || e.t > best.t)) best = e; }
  return best;
};

const OPENING = new Set(['boot', 'cold-open']);
/**
 * Cards the player is meant to ACT on. When one of these lets go with nobody
 * touching it, the decision was taken for them — the critic's sentence word for
 * word: "ORDERS … auto-dismissed before I could click BEGIN THE RUN".
 *
 * Ceremonies are deliberately not in here. A rank plate that clears itself
 * after five seconds has stolen nothing; its ARRIVAL is already scored, and
 * counting its exit as well would charge one promotion twice.
 */
const DECISION = new Set(['orders', 'close', 'rest', 'foundry']);

const events = [];
let openingBeatCounted = false;
let firstOrdersDone = false;
let lastCardClosedWhere = null;

/* ONE PASS, IN TIME ORDER — opens and closes together.
   This used to be two loops, all the opens and then all the closes, and it
   quietly disabled the most important test in the file: "did this card open
   where the last one closed, having travelled nowhere?" is answered against
   `lastCardClosedWhere`, which the second loop did not fill in until every
   open had already been judged. Every chained item in the game would have
   scored as a walk-in worth infinity metres. Chronological order is not a
   tidiness preference here; it is the difference between measuring the chain
   and not measuring it. */
for (const s of rec.surf) {
  if (!s.on) {
    // A learning card closing is where the next "no travel at all" is measured
    // from. It is not itself scored: the panel shutting after an answer is the
    // answer being accepted, not the game advancing past the player.
    if (s.name === 'rift') { lastCardClosedWhere = s.at; continue; }
    if (!DECISION.has(s.name)) continue;
    const a = lastBefore(asks, s.t);
    if ((a ? s.t - a.t : Infinity) > ASK_WINDOW) {
      events.push({ ...s, verdict: 'taken', why: 'a decision card that answered itself' });
    }
    continue;
  }

  const ask = lastBefore(asks, s.t);
  const askAge = ask ? s.t - ask.t : Infinity;

  // The deliberate opening beat: boot, establishing shot and the first ORDERS
  // are one event, and the brief allows it.
  if (OPENING.has(s.name) || (s.name === 'orders' && !firstOrdersDone)) {
    if (s.name === 'orders') firstOrdersDone = true;
    if (!openingBeatCounted) {
      openingBeatCounted = true;
      events.push({ ...s, verdict: 'opening-beat', why: 'the deliberate opening' });
    }
    continue;
  }

  /* A CORNER CARD IS NOT A TAKEOVER, AND THE RECTANGLE SAYS SO.
     The critic's list included "the Controls card", and he was right to notice
     it — but a surface that never claims the input and covers a twentieth of
     the frame is a HUD element, not the screen being taken. The distinction is
     measured, not asserted: `modal` is the game's own `input.uiOpen`, and
     `cover` is the fraction of the viewport the element's own rectangle
     occupies. Anything that fails BOTH tests is reported on its own line and
     kept out of both counts, so nothing is hidden and nothing is inflated. */
  if (!s.modal && s.cover < 0.28) {
    events.push({ ...s, verdict: 'corner-card', why: `non-modal, covers ${(s.cover * 100).toFixed(0)}% of frame` });
    continue;
  }

  let verdict, why;
  if (askAge <= ASK_WINDOW) {
    verdict = 'chose';
    why = `asked ${Math.round(askAge)}ms earlier (${ask.what})`;
  } else if (s.name === 'rift') {
    /* A TEAR CAN NOW ONLY OPEN TWO WAYS: somebody asked, or somebody walked
       into it. There is no third path left — the 460 ms chain timer that used
       to open the next card by itself is gone (src/session/stint.js). So the
       question here is not "how far did they travel", it is "was this a walk-in
       or did the screen move on its own", and the physics answers it:

         MOVING, hands free        they walked into a ring. That is the
                                   discoverability feature the brief keeps, and
                                   the cold-play gate depends on it. CHOSEN.
         BUILDING / GLIDING /      the tear interrupted something. This is the
         SPRINTING                 defect the brief names, and it must be zero.
         STANDING STILL, no ask    nothing moved and nobody asked, so a timer
                                   did it. This is the chain signature, and it
                                   must be zero too.

       Distance is still printed, because "opened two metres from where the last
       one closed" is worth seeing — but it is no longer the test, because it
       was measuring a mechanism that no longer exists and it read a genuine
       walk-in across a small clearing as a chained card. */
    const travelled = (lastCardClosedWhere && s.at)
      ? Math.hypot(s.at.x - lastCardClosedWhere.x, s.at.z - lastCardClosedWhere.z)
      : Infinity;
    const near = Number.isFinite(travelled) ? `, ${Math.round(travelled)}m from the last card` : '';
    if (s.building || s.gliding || s.speed > SPRINT_SPEED) {
      verdict = 'taken';
      why = s.building ? 'opened mid-build, nothing asked'
        : s.gliding ? 'opened mid-glide, nothing asked'
          : `opened at a sprint (${s.speed.toFixed(1)} m/s), nothing asked`;
    } else if (s.speed > MOVING || s.steering) {
      verdict = 'chose';
      why = s.speed > MOVING
        ? `walked into it at ${s.speed.toFixed(1)} m/s${near}`
        : `walked into it while steering (${s.held.join(', ')})${near}`;
    } else {
      /* Hands still, boots still, nothing asked. There is no longer any code
         path in the game that can do this — the chain timer is gone — so if
         this ever prints again, something has grown one back. */
      verdict = 'taken';
      why = `opened with nobody moving and nothing asked${near} — a timer did this`;
    }
  } else {
    verdict = 'taken';
    why = s.phase === 'build' ? 'opened mid-build, nothing asked'
      : s.phase === 'sprint' ? 'opened mid-sprint, nothing asked'
        : `nothing asked for it (last ask ${Number.isFinite(askAge) ? Math.round(askAge) + 'ms' : 'never'} earlier)`;
  }
  events.push({ ...s, verdict, why });
}

events.sort((a, b) => a.t - b.t);

const chose = events.filter((e) => e.verdict === 'chose');
const taken = events.filter((e) => e.verdict === 'taken');
const beat = events.filter((e) => e.verdict === 'opening-beat');
const corner = events.filter((e) => e.verdict === 'corner-card');

// ---- report ---------------------------------------------------------------
const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\nTAKEOVER AUDIT — ${mins} min of real key and mouse input, cleared save, ${LOC}\n`);
console.log('  when     surface     verdict      why');
console.log('  ' + '-'.repeat(86));
for (const e of events) {
  const at = ((e.t - rec.t0) / 1000).toFixed(0).padStart(4) + 's';
  const mark = e.verdict === 'chose' ? ' + ' : e.verdict === 'taken' ? ' ! ' : ' . ';
  console.log(`  ${at} ${mark}${e.name.padEnd(11)} ${e.verdict.padEnd(12)} ${e.why}`);
}

const byName = {};
for (const e of taken) byName[e.name] = (byName[e.name] || 0) + 1;

console.log(`\n  CHOSE       ${chose.length}`);
console.log(`  TAKEN OVER  ${taken.length}`);
if (beat.length) console.log(`  (plus ${beat.length} deliberate opening beat, which the brief allows)`);
if (corner.length) {
  console.log(`  (plus ${corner.length} non-modal corner card(s), counted as neither: `
    + [...new Set(corner.map((e) => e.name))].join(', ') + ')');
}
if (taken.length) {
  console.log('\n  takeovers by surface: ' + Object.entries(byName)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(', '));
}
/* THE TWO NUMBERS THE BRIEF ASKS FOR BY NAME, stated separately from the
   ratio because they are absolutes rather than comparisons: a tear must never
   interrupt a build or a glide or a sprint, and no card may ever appear on a
   timer. Both must read zero. */
const interrupted = events.filter((e) => e.name === 'rift' && e.on && e.verdict === 'taken'
  && /mid-build|mid-glide|at a sprint/.test(e.why));
const onATimer = events.filter((e) => e.name === 'rift' && e.on && /a timer did this/.test(e.why));
console.log(`\n  tears that interrupted a build, a glide or a sprint:  ${interrupted.length}`);
console.log(`  learning cards that opened on a timer, unasked:      ${onATimer.length}`);
console.log(`\n  fps — median ${median ? median.toFixed(0) : '?'}, 5th percentile ${worst ? worst.toFixed(0) : '?'} (${fpsSeen.length} readings)`);
/* Only what the game logged while it was being PLAYED. `playEndedAt` is the
   last frame of the session; everything after it is the preview server being
   shut down under a page that is still open, which is this script's exhaust
   and not a defect in the game. */
const live = errors.filter((e) => e.t <= playEndedAt);
const afterwards = errors.length - live.length;
if (live.length) {
  console.log(`\n  console errors ×${live.length}`);
  live.slice(0, 6).forEach((e) => console.log('   ! ' + e.text));
}
if (afterwards) console.log(`  (${afterwards} more after the run ended, as the test server was torn down)`);

/* DID THIS RUN ACTUALLY PLAY THE GAME?
   A script that gets wedged, loses the objective, or sits inside a panel it
   does not know how to leave will report a beautiful ratio: nothing took the
   frame, because nothing happened at all. Two earlier runs of this file did
   exactly that and "passed" 2–0. So the audit states its own floor: a
   fifteen-minute session that never reached four learning cards is not
   evidence about agency, it is evidence about the harness, and it fails. */
/* A fifteen-minute session that reaches fewer cards than it has minutes has
   not played the game. The good runs of this script reach about two a minute;
   this floor is deliberately well under that, and exists only to make a wedged
   or lost harness fail loudly instead of reporting a flattering ratio it earned
   by standing still. */
const MIN_CARDS = Math.max(4, Math.round(MINUTES * 0.8));
const cards = events.filter((e) => e.name === 'rift' && e.on).length;
const reallyPlayed = cards >= MIN_CARDS;
if (!reallyPlayed) {
  console.log(`\n  the run only reached ${cards} learning card(s) in ${mins} min `
    + `(needs ${MIN_CARDS}). The counts above describe the harness, not the game.`);
}

await writeFile(path.join(OUT, 'takeover.json'), JSON.stringify({
  minutes: Number(mins), locale: LOC, chose: chose.length, taken: taken.length,
  openingBeat: beat.length, cornerCards: corner.length, cards, reallyPlayed, byName, events, ordersProof,
  interrupted: interrupted.length, onATimer: onATimer.length,
  errors: errors.map((e) => ({ ...e, duringPlay: e.t <= playEndedAt })),
  fps: { ...fps, median, low5: worst, readings: fpsSeen },
  // The raw tape, so a reader can re-derive every verdict above by hand.
  raw: { surf: rec.surf, input: rec.input },
}, null, 2));

const ok = reallyPlayed && chose.length > taken.length && live.length === 0;
console.log(`\n${ok ? 'PASS' : 'FAIL'} — chosen ${chose.length} vs imposed ${taken.length}`
  + `, ${cards} learning cards`
  + (live.length ? `, ${live.length} console errors` : '')
  + `  ->  ${OUT}\n`);
process.exit(ok ? 0 : 1);
