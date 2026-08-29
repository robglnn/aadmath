#!/usr/bin/env node
/**
 * THE MODAL GATE — can the player get out of every surface that takes the frame?
 *
 *   node tools/critic/modal.mjs --url http://127.0.0.1:4173
 *   node tools/critic/modal.mjs --self-test
 *
 * Exit 0 = every surface that owns the frame hands it back on the key the HUD
 * prints, on a control that is on the glass, and never holds `input.uiOpen` for
 * one second longer than it is on screen.
 *
 * THE FINDING THIS GATE EXISTS FOR, measured on the frozen build with real key
 * events from a cleared save:
 *
 *   `.ses-close` — the RUN CLOSED card — took 100% of a 1600x900 frame,
 *   `pointer-events: auto` across the whole of it, `input.uiOpen` held. Three
 *   real Escapes and an F1 were refused. Held W for 1.6 s moved the cadet
 *   **0.00 m**. There was no key handler on the file at all: the menu hands
 *   Escape straight back whenever `uiOpen` is true (by design, so it can never
 *   steal a rift's key), so nothing downstream of that card was ever going to
 *   close it. The only exits were two aimed clicks — and `uiOpen` sets
 *   `#touchpad` to `display: none`, so on a phone there was no third option.
 *   The break beat behind it was the same shape for another 165 seconds, with
 *   its one early exit drawn at `opacity: 0` for the first forty of them.
 *
 * AND IT WAS BENDING ANOTHER GATE'S NUMBERS. `tools/critic/motion.mjs` — *does
 * the loop still need the world?* — has reported for three rounds that the
 * sitting is a worksheet: 3.6-3.8% of the time moving against a 10% bar, and
 * 805, then 828, then 971 CONSECUTIVE SECONDS inside one 2 m circle. Its own
 * 18-minute sitting was instrumented per second against this card, on the same
 * frozen build:
 *
 *   the card came up at t=116 s, the instant a seal took the run to its target,
 *   and STAYED UP FOR 967 OF THE SITTING'S 1082 SECONDS — 89.4% of it — with
 *   `uiOpen` true and no panel behind it. `handBack()` pressed Escape at it,
 *   five times per pass, for sixteen minutes.
 *
 *   WHOLE SITTING   moving 39/1082 s (3.6%), 231 m, stillest 974 s
 *   FREE SECONDS    moving 39/114 s (34.2%), 231 m, stillest 16 s
 *
 * Over the seconds the cadet was free to move, that sitting clears the 10% bar
 * three times over and its longest park is 16 s against a 210 s bar. The card
 * is not the whole of the motion finding — one verb of six is real — but the
 * headline number of three rounds was substantially an instrument reading a
 * blocked player as an idle one. That is why this gate exists and why it is in
 * the build: a modal defect does not stay inside its own module.
 *
 * THIS IS THE THIRD TIME. A closed full-screen rift dialog ate every click for
 * months. The ORDERS card put BEGIN below the fold, and because that card holds
 * `uiOpen` and `uiOpen` hides the touch pad, it killed every control on the
 * device. Both were found by a human. So the four rules below are the shape of
 * all three defects, and each is planted in `--self-test`.
 *
 *   1. ESCAPE CLOSES IT. Every surface that holds the frame goes away on real
 *      Escape key events — inside `ESC_PRESSES` presses, so a grace window is
 *      allowed and a wall is not.
 *   2. IT NEVER HOLDS THE FRAME LONGER THAN IT IS DISMISSIBLE. A card may sit
 *      there all afternoon; what it may not do is sit there while the answer to
 *      "how do I leave" is nothing. Measured as: the frame comes back within
 *      `ESC_PRESSES * ESC_GAP` ms of the first press, and the cadet can move
 *      again afterwards — real held W, real metres.
 *   3. `uiOpen` IS NEVER TRUE WHILE NO SURFACE IS SHOWN. `uiOpen` deafens every
 *      verb the player owns and hides the touch pad entirely; a flag left
 *      standing by a beat that lost track of its own card takes the whole game
 *      with it and puts nothing on screen to say why.
 *   4. A SURFACE THAT TAKES THE FRAME HAS A CONTROL ON THE GLASS. At least one
 *      visible, enabled, hit-testable control whose box is wholly inside the
 *      viewport — which is the ORDERS defect, exactly, and it is free to check
 *      once the harness is already standing in front of every surface.
 *
 * WHAT IS REAL AND WHAT IS NOT. Every dismissal is a real `keydown` on the real
 * build. Every verdict is read off the real DOM and off the real player
 * position. `window.__ascent` is used for exactly two things and both are
 * written here so nobody has to take it on trust: `session.chargeTo(25)` winds
 * the work clock, because twenty-five minutes is twenty-five minutes and the
 * game then closes the run itself on its own frame loop; and `input.uiOpen` is
 * READ, because that flag is the subject of rule 3 and has no other honest
 * proxy. Nothing here opens a card, dismisses a card or answers an item through
 * the debug surface.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findings } from '../_findings.mjs';

/**
 * A MAIN GUARD, BECAUSE `verdict` IS WORTH IMPORTING AND A SITTING IS NOT.
 *
 * `tools/check-all.mjs` used to run the entire twenty-minute build as a side
 * effect of an `import` statement, and `tools/simulate-all.mjs` started a
 * four-minute Monte-Carlo the same way. Both have a guard now; this file gets
 * one before it can grow the same defect, so that anything wanting the rule can
 * take the rule without standing up a browser.
 */
const IS_MAIN = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/modal'));
const SELFTEST = process.argv.includes('--self-test');
/**
 * PLANT A CARD THAT IGNORES ESCAPE, ON EVERY REAL RUN.
 *
 * `--self-test` is the RULE, and it answers in a tenth of a second with no
 * browser, so it belongs in front of the gate behind an `&&` — three gates in
 * this repo fuse their plant into the whole run instead, and RESUME.md names
 * that as the single cheapest thing anybody could do to keep the gate table
 * true. The plant needs the browser that is already standing, so it runs here,
 * inside the same process and against the same frozen server, before the
 * honest walk: about thirty seconds, and the gate refuses to report on the
 * game until it has proved it can refuse.
 */
const PLANT = process.argv.includes('--plant');
const HEADED = process.argv.includes('--headed');

/**
 * THE BARS.
 *
 * `ESC_PRESSES` — how many real Escapes a surface may survive. Every session
 * beat in this game deliberately ignores input for a moment after it opens (the
 * keystroke that sealed the last tear is still in the queue and was aimed at
 * the tear), so one press is not the bar. Four presses at `ESC_GAP` covers the
 * longest of those windows twice over — and the card as it shipped refused
 * five.
 *
 * `SETTLE` — how long the harness looks at a surface before it tries to leave.
 * Longer than every grace window in src/session, so a refusal here is a refusal
 * and not a race.
 *
 * `ORPHAN_MAX` — seconds `uiOpen` may be true with nothing on screen. It is not
 * zero because a card's fade-out is 400 ms and the flag is handed back at the
 * start of it, which is the safe direction; one second is well past that and
 * far under anything a player could feel.
 *
 * `MOVE_MIN` — metres of held W that count as the frame having genuinely come
 * back. The cadet walks at about 3.4 m/s, so a second of held W is metres; this
 * is set low enough that a cadet standing against a wall still clears it.
 */
const ESC_PRESSES = Number(arg('presses', 4));
const ESC_GAP = 350;
const SETTLE = 900;
const ORPHAN_MAX = Number(arg('orphan', 1.0));
const MOVE_MIN = Number(arg('move', 0.6));
/** A surface counts as owning the frame at or above this share of the viewport. */
const FRAME_SHARE = 0.25;

const fails = [];
const note = (ok, label, detail = '') => {
  if (!ok) fails.push(`${label}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

/**
 * THE VERDICT, as a pure function over what the walk saw, so the four rules can
 * be planted with no browser at all and so the bars cannot drift without this
 * file's own self-test noticing.
 *
 * @param {{surfaces: {name:string, heldMs:number, frameShare:number,
 *          uiHeld:boolean, presses:number, escaped:boolean,
 *          escapedAfterMs:number|null, movedWhileUp:number|null,
 *          movedAfter:number, controlsOnGlass:number, controlsTotal:number,
 *          handedTo:string|null}[],
 *          orphanSecs:number, orphanAt:string|null,
 *          freeAtEnd:number|null, loopReturned:boolean|undefined,
 *          loopWaitedMs:number|undefined}} m
 * @returns {string[]} one sentence per finding; empty means the surfaces let go
 */
export function verdict(m) {
  const out = [];
  for (const s of m.surfaces || []) {
    if (!s.escaped) {
      out.push(`${s.name} took ${(s.frameShare * 100).toFixed(0)}% of the frame for `
        + `${(s.heldMs / 1000).toFixed(0)} s and ${s.presses} real Escape press(es) did not dismiss it`
        + `${s.uiHeld ? ', with input.uiOpen held the whole time' : ''}`
        + `${s.movedWhileUp != null && s.movedWhileUp < MOVE_MIN
          ? `, and 1.2 s of held W moved the cadet ${s.movedWhileUp.toFixed(2)} m` : ''}`);
    } else if (s.escapedAfterMs != null && s.escapedAfterMs > ESC_PRESSES * ESC_GAP) {
      out.push(`${s.name} held the frame for ${(s.escapedAfterMs / 1000).toFixed(1)} s after the first `
        + `Escape (bar ${(ESC_PRESSES * ESC_GAP / 1000).toFixed(1)} s) — longer than it was dismissible`);
    }
    /* THE FRAME HAS TO COME BACK — but a beat is allowed to hand it to the NEXT
       beat. Standing the run down IS the break; that is the loop, not a defect.
       So this only asks the question when the surface let go into an EMPTY
       frame, and the sitting as a whole is asked once at the end (`freeAtEnd`),
       which is the reading that actually matters. */
    if (s.escaped && !s.handedTo && s.movedAfter < MOVE_MIN) {
      out.push(`${s.name} went off screen with nothing behind it and the cadet still could not move: `
        + `${s.movedAfter.toFixed(2)} m of held W (bar ${MOVE_MIN} m) — the surface let go and the frame did not`);
    }
    if (s.frameShare >= FRAME_SHARE && s.controlsOnGlass < 1) {
      out.push(`${s.name} takes ${(s.frameShare * 100).toFixed(0)}% of the frame and has `
        + `${s.controlsTotal} control(s), none of them wholly on the glass — the ORDERS defect, `
        + 'and uiOpen hides the touch pad, so on a phone that is every control in the game');
    }
  }
  /* AND A CARD YOU CAN ESCAPE INTO A DEAD GAME IS NOT A FIX. Escaping a beat
     hands the world back; the session then owes the cadet the next set of
     orders, and if it never comes the Escape has quietly ended the product. */
  if (m.loopReturned === false) {
    out.push(`every beat was escaped and the session never came back: no orders in ${(m.loopWaitedMs / 1000).toFixed(0)} s `
      + '— dismissing a card must hand the world back, not end the sitting');
  }
  if (m.freeAtEnd != null && m.freeAtEnd < MOVE_MIN) {
    out.push(`the sitting ended with every surface dismissed and the cadet still could not move: `
      + `${m.freeAtEnd.toFixed(2)} m of held W (bar ${MOVE_MIN} m)`);
  }
  if ((m.orphanSecs || 0) > ORPHAN_MAX) {
    out.push(`input.uiOpen was true for ${m.orphanSecs.toFixed(1)} consecutive seconds with no surface `
      + `on screen (bar ${ORPHAN_MAX} s)${m.orphanAt ? ` — from ${m.orphanAt}` : ''}: `
      + 'every verb deaf and the touch pad hidden, with nothing drawn to say why');
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE SELF-TEST — the rule first, with no browser, then a REAL PLANT in the
// REAL BUILD: a card that ignores Escape, put back the way it was.
// ---------------------------------------------------------------------------
const S = (o) => ({
  name: 'a surface', heldMs: 4000, frameShare: 1, uiHeld: true, presses: 1,
  escaped: true, escapedAfterMs: 350, movedWhileUp: null, movedAfter: 4.2,
  controlsOnGlass: 2, controlsTotal: 2, handedTo: null, ...o,
});

async function selfTest() {
  console.log('the rule, over fabricated sittings:\n');
  const healthy = { surfaces: [S({ name: '.ses-close' }), S({ name: '.ses-rest', presses: 2, escapedAfterMs: 700 })], orphanSecs: 0.3, freeAtEnd: 4.1 };
  note(verdict(healthy).length === 0, 'a sitting whose surfaces let go passes',
    verdict(healthy).join(' | ') || 'two cards, dismissed on the 1st and 2nd press, the cadet walks after each');

  // THE CARD AS IT SHIPPED. Every number here was measured on the frozen build.
  const shipped = {
    surfaces: [S({
      name: '.ses-close', heldMs: 900000, presses: 5, escaped: false,
      escapedAfterMs: null, movedWhileUp: 0, movedAfter: 0,
    })],
    orphanSecs: 0, freeAtEnd: 4.1,
  };
  const sh = verdict(shipped);
  note(sh.length >= 1 && /did not dismiss it/.test(sh[0]),
    'the RUN CLOSED card as it shipped — full frame, five Escapes refused — fails', sh.join(' | '));

  // A card that DOES go, but only after the player has stood there for a while.
  const slowToLetGo = { surfaces: [S({ escapedAfterMs: 9000, presses: 4 })], orphanSecs: 0, freeAtEnd: 4.1 };
  const sl = verdict(slowToLetGo);
  note(sl.length === 1 && /longer than it was dismissible/.test(sl[0]),
    'a surface that only lets go after nine seconds of pressing fails on that alone', sl.join(' | '));

  // THE FLAG LEFT STANDING — a beat that lost track of its own card.
  const orphan = { surfaces: [S()], orphanSecs: 12.5, orphanAt: 't=430s', freeAtEnd: 4.1 };
  const or = verdict(orphan);
  note(or.length === 1 && /uiOpen was true/.test(or[0]),
    'uiOpen held for twelve seconds with nothing on screen fails on the flag alone', or.join(' | '));

  // THE ORDERS DEFECT: a full-frame card whose only button is off the glass.
  const offGlass = { surfaces: [S({ name: '.ses-charter', controlsOnGlass: 0, controlsTotal: 1 })], orphanSecs: 0, freeAtEnd: 4.1 };
  const og = verdict(offGlass);
  note(og.length === 1 && /none of them wholly on the glass/.test(og[0]),
    'a full-frame card whose one button is below the fold fails on that alone', og.join(' | '));

  // …AND THE HONEST CASE ON THE OTHER SIDE OF EVERY BAR. A learner reads the
  // résumé for five minutes, then leaves on the second press. Nothing fires.
  const slowReader = {
    surfaces: [S({ name: '.ses-close', heldMs: 300000, presses: 2, escapedAfterMs: 700 })],
    orphanSecs: 0.9, freeAtEnd: 4.1,
  };
  note(verdict(slowReader).length === 0,
    'and a learner who reads the card for five minutes and leaves on the 2nd press still passes',
    verdict(slowReader).join(' | ') || 'held 300 s, dismissed 0.7 s after the first press, orphan 0.9 s under the 1.0 s bar');

  // A BEAT THAT HANDS THE FRAME TO THE NEXT BEAT is the loop, not a defect:
  // standing the run down IS the break. It must not fire.
  const handOff = {
    surfaces: [S({ name: '.ses-close', handedTo: '.ses-rest.show', movedAfter: 0 }),
      S({ name: '.ses-rest' })],
    orphanSecs: 0, freeAtEnd: 4.1,
  };
  note(verdict(handOff).length === 0, 'a beat that hands the frame to the next beat is the loop, not a wall',
    verdict(handOff).join(' | ') || 'the close card lets go into the break, and the break lets go into the world');

  // THE ESCAPE THAT ENDS THE PRODUCT: every card dismissed, world back, and the
  // session never speaks again.
  const deadLoop = { surfaces: [S()], orphanSecs: 0, freeAtEnd: 4.1, loopReturned: false, loopWaitedMs: 75000 };
  const dl = verdict(deadLoop);
  note(dl.length === 1 && /never came back/.test(dl[0]),
    'a sitting whose session never re-plans after a beat was escaped fails on that alone', dl.join(' | '));

  // …and the sitting that ends with every card gone and the cadet still deaf.
  const deafAtEnd = { surfaces: [S()], orphanSecs: 0, freeAtEnd: 0.02 };
  const de = verdict(deafAtEnd);
  note(de.length === 1 && /the sitting ended/.test(de[0]),
    'a sitting that ends with every surface dismissed and the cadet still unable to move fails', de.join(' | '));

  // A small surface (a toast, a corner card) with no control on the glass is
  // not this defect, and the bar must not catch it.
  const small = { surfaces: [S({ name: '.kit-toast', frameShare: 0.04, controlsOnGlass: 0, controlsTotal: 0 })], orphanSecs: 0, freeAtEnd: 4.1 };
  note(verdict(small).length === 0, 'a corner card that owns no frame is not held to the frame rule',
    verdict(small).join(' | ') || '4% of the frame, no controls, and that is fine');

  if (fails.length) {
    console.error(`\nself-test: ${fails.length} bar(s) do not separate`);
    process.exit(1);
  }
  console.log('\nself-test: ok — every bar fires on the defect it names and stays quiet on the '
    + 'honest case beside it. The plant runs with the browser: see --plant.');
  process.exit(0);
}

/**
 * THE PLANT — a card that ignores Escape, put back exactly the way it was.
 *
 * A capture listener on `window`, installed BEFORE any app script runs, which
 * swallows Escape whenever the close card is on screen. That is not a mock of
 * the defect: the shipped card had no handler at all, and the menu hands Escape
 * straight back whenever `uiOpen` is true, so the key reached nothing. This
 * puts the key back in the same place — nowhere.
 */
async function plantAndProve() {
  const planted = await walk({ plant: 'swallow-escape', label: 'PLANTED', short: true });
  const pv = verdict(planted);
  note(pv.some((l) => /did not dismiss it/.test(l)),
    'PLANT: a card that ignores Escape is refused, in this build',
    pv.join(' | ') || 'the walk saw nothing wrong, which means the plant did not land — '
      + 'nothing below this line is evidence');
  if (fails.length) {
    console.error('\nthe plant was not caught. Nothing below is evidence.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// THE WALK
// ---------------------------------------------------------------------------

/** Every surface this walk stands in front of, in the order a sitting meets them. */
const BEATS = [
  ['.ses-charter', 'the orders'],
  ['.ses-close', 'the run closed card'],
  ['.ses-rest', 'the break'],
  ['.mnu', 'the pause menu'],
];

/**
 * Is anything at all on screen that owns the frame?
 *
 * Deliberately GEOMETRIC AND ROLE-BASED rather than a hand-written list of
 * class names. This repo's own history is that hand-written lists of surfaces
 * go stale and the gate then measures a smaller game than the one that ships:
 * the choice-set lab's pack list stopped at Level 2 and covered 24 of 62 skills
 * while printing PASS in the same words. So: anything carrying `aria-modal`, or
 * anything hit-testable that covers a quarter of the glass. A surface added
 * next month is covered with no edit here.
 */
const ON_SCREEN = (share) => {
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (+cs.opacity <= 0.05 || cs.pointerEvents === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  };
  for (const el of document.querySelectorAll('[aria-modal="true"]')) if (vis(el)) return true;
  /* THE SCAN IS OVER `#ui`'s OWN CHILDREN, AND THAT LINE IS LOAD-BEARING.
     The first cut of this scanned `#app` and `<body>` as well, and `#app` and
     the `#stage` canvas are both `pointer-events: auto` at 100% of the frame —
     they are THE WORLD. So the predicate answered "a surface is on screen" on
     every frame of the game, which made `handedTo` always true and made the
     uiOpen rule below UNABLE TO FIRE AT ALL. A gate that cannot refuse is not a
     gate, and this one would have printed the same PASS either way. Every
     surface in this game is a child of `#ui` (see src/ui/layers.css); the
     layers that are not surfaces — the beckon tags, the afford layer, the guide
     layer — are all `pointer-events: none` and drop out on their own. */
  const A = innerWidth * innerHeight;
  for (const el of document.querySelectorAll('#ui > *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.width * r.height) / A >= share) return true;
  }
  return false;
};

/**
 * @param {{plant?:string|null, label?:string, short?:boolean}} o
 *   `short` is the planted run: it stands in front of ONE surface — the card
 *   the plant is about — and skips the orders, the walk to a tear and the
 *   second set of orders. A self-test that costs as much as the gate is a
 *   self-test somebody moves behind a flag and then never runs.
 */
async function walk({ plant = null, label = 'WALK', short = false } = {}) {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  if (plant === 'swallow-escape') {
    // Before any app script: first listener on the capture path, so the card's
    // own handler never runs. This is the shipped state, restored.
    await page.addInitScript(() => {
      addEventListener('keydown', (e) => {
        if (e.code !== 'Escape') return;
        if (!document.querySelector('.ses-close.show')) return;
        e.stopImmediatePropagation();
      }, true);
    });
  }

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2600);

  // ---- the flag sampler, on the real frame loop, at 4 Hz -------------------
  await page.evaluate(([share, src]) => {
    // eslint-disable-next-line no-new-func
    const onScreen = new Function('share', `return (${src})(share);`);
    const F = { on: true, run: 0, worst: 0, worstAt: null, t0: performance.now() / 1000, samples: 0 };
    window.__MODAL = F;
    F.timer = setInterval(() => {
      try {
        F.samples++;
        const ui = !!window.__ascent.input.uiOpen;
        const shown = onScreen(share);
        if (ui && !shown) {
          F.run += 0.25;
          if (F.run > F.worst) {
            F.worst = F.run;
            F.worstAt = `t=${(performance.now() / 1000 - F.t0).toFixed(0)}s`;
          }
        } else F.run = 0;
      } catch { /* a frame mid-teardown is not evidence */ }
    }, 250);
  }, [FRAME_SHARE, ON_SCREEN.toString()]);

  const facts = () => page.evaluate(() => ({
    ui: !!window.__ascent.input.uiOpen,
    x: window.__ascent.player.pos.x,
    z: window.__ascent.player.pos.z,
    phase: window.__ascent.session.state().phase,
  }));

  /** Real held W, real metres. The one honest answer to "can they move?". */
  const heldW = async (ms = 1200) => {
    const a = await facts();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(ms);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(200);
    const b = await facts();
    return Math.hypot(b.x - a.x, b.z - a.z);
  };

  const seen = async (sel) => page.evaluate((s) => {
    const el = document.querySelector(s + '.show');
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity <= 0.05) return null;
    const r = el.getBoundingClientRect();
    const controls = [...el.querySelectorAll('button:not([hidden]):not([disabled])')].filter((b) => {
      const bs = getComputedStyle(b);
      if (bs.display === 'none' || bs.visibility === 'hidden' || +bs.opacity <= 0.05) return false;
      if (bs.pointerEvents === 'none') return false;
      const br = b.getBoundingClientRect();
      return br.width > 4 && br.height > 4;
    }).map((b) => {
      const br = b.getBoundingClientRect();
      return {
        onGlass: br.top >= 0 && br.left >= 0 && br.bottom <= innerHeight && br.right <= innerWidth,
        w: Math.round(br.width), h: Math.round(br.height), y: Math.round(br.top),
      };
    });
    return {
      frameShare: +((r.width * r.height) / (innerWidth * innerHeight)).toFixed(3),
      controlsTotal: controls.length,
      controlsOnGlass: controls.filter((c) => c.onGlass).length,
    };
  }, sel);

  const waitFor = async (sel, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await seen(sel);
      if (s) return s;
      await page.waitForTimeout(200);
    }
    return null;
  };

  const surfaces = [];
  /** Stand in front of one surface and try, with real keys, to leave it. */
  const probe = async (sel, name, waitMs) => {
    const s = await waitFor(sel, waitMs);
    if (!s) { console.log(`  ..    ${sel} never appeared in ${(waitMs / 1000).toFixed(0)} s — not measured`); return null; }
    const shownAt = Date.now();
    const uiHeld = (await facts()).ui;
    await page.waitForTimeout(SETTLE);
    /* ESCAPE FIRST, AND MOVEMENT AFTERWARDS.
       The orders card dismisses on ANY key, deliberately — it is a wall-breaker
       and it is right — so a held W aimed at "can the cadet move behind this?"
       DISMISSES IT, and the Escape that followed was then credited with a
       dismissal it did not make. The first cut of this gate read exactly that,
       and it is the same class of error as a harness that clicks a class name
       the rig does not draw: an instrument measuring itself. So the key under
       test goes first, and movement is measured where each answer means
       something — behind a surface that refused to go, or in front of an empty
       frame. */
    let presses = 0;
    let escaped = false;
    let firstPress = null;
    for (let i = 0; i < ESC_PRESSES; i++) {
      if (firstPress == null) firstPress = Date.now();
      await page.keyboard.press('Escape');
      presses++;
      await page.waitForTimeout(ESC_GAP);
      if (!(await seen(sel))) { escaped = true; break; }
    }
    const escapedAfterMs = escaped ? Date.now() - firstPress : null;
    const heldMs = Date.now() - shownAt;
    // Behind a wall, this is the whole finding: real held W, real metres.
    const movedWhileUp = escaped ? null : await heldW();
    await page.waitForTimeout(700);
    /* Did it hand the frame straight to the next beat? Standing the run down IS
       the break, so this is the loop rather than a defect — but it has to be
       recorded, because "the card went away" and "the player got the world
       back" are two different claims and only one of them was ever checked. */
    const handedTo = escaped ? await page.evaluate(
      ([share, src]) => {
        // eslint-disable-next-line no-new-func
        const on = new Function('share', `return (${src})(share);`);
        if (!on(share)) return null;
        for (const q of ['.ses-charter.show', '.ses-close.show', '.ses-rest.show', '.mnu.show', '.rift.show']) {
          if (document.querySelector(q)) return q;
        }
        return 'something';
      }, [FRAME_SHARE, ON_SCREEN.toString()],
    ) : null;
    const movedAfter = escaped && !handedTo ? await heldW() : 0;
    const row = {
      name: `${sel} (${name})`,
      heldMs,
      frameShare: s.frameShare,
      uiHeld,
      presses,
      escaped,
      escapedAfterMs,
      movedWhileUp,
      movedAfter,
      controlsOnGlass: s.controlsOnGlass,
      controlsTotal: s.controlsTotal,
      handedTo,
    };
    surfaces.push(row);
    console.log(`  ${escaped ? 'gone ' : 'STUCK'} ${sel.padEnd(14)} ${(s.frameShare * 100).toFixed(0)}% of frame`
      + `  uiOpen ${uiHeld}  ${presses} Escape(s)`
      + `  ${escaped ? `out in ${(escapedAfterMs / 1000).toFixed(1)} s` : 'NOT DISMISSED'}`
      + `  ${handedTo ? `handed the frame to ${handedTo}`
        : escaped ? `moved ${movedAfter.toFixed(2)} m once it was gone`
          : `moved ${movedWhileUp.toFixed(2)} m of held W WHILE IT WAS UP`}`
      + `  controls ${s.controlsOnGlass}/${s.controlsTotal} on the glass`);
    if (!escaped) {
      // Take the aimed click the player would have to take, so the rest of the
      // sitting is still measured rather than lost behind the wall.
      const btn = await page.$(`${sel}.show button:not([hidden]):not([disabled])`);
      if (btn) await btn.click().catch(() => {});
      await page.waitForTimeout(900);
    }
    return row;
  };

  console.log(`\n${label}: a sitting at ${URL}\n`);
  await page.mouse.click(800, 450);

  if (short) {
    // Straight to the card the plant is about: press until the run is under
    // way, exactly as a player who does not wait for their orders does.
    for (let i = 0; i < 40; i++) {
      if ((await facts()).phase === 'work') break;
      await page.keyboard.press('KeyW');
      await page.waitForTimeout(700);
    }
    await page.evaluate(() => window.__ascent.session.chargeTo(25));
    await probe(BEATS[1][0], BEATS[1][1], 25000);
    await page.screenshot({ path: path.join(OUT, 'planted.png') }).catch(() => {});
    const f = await page.evaluate(() => {
      const F = window.__MODAL; clearInterval(F.timer);
      return { worst: F.worst, worstAt: F.worstAt, samples: F.samples };
    });
    await browser.close();
    return { surfaces, orphanSecs: f.worst, orphanAt: f.worstAt, samples: f.samples, errors };  // short: the loop and freeAtEnd are the long walk's business
  }

  // 1. THE ORDERS. It arrives on its own, before any mathematics is asked for.
  //    Nothing is pressed until it does — a key in the air is read by `plan()`
  //    as hands on the controls, and the card then correctly never opens.
  await probe(BEATS[0][0], BEATS[0][1], 42000);

  // 2. A little real play, so the sitting is a sitting: walk at the objective
  //    the world is pointing at, on real keys.
  const target = await page.evaluate(() => {
    const o = window.__ascent.objective?.();
    return o ? { x: o.x, z: o.z } : null;
  });
  if (target) {
    const t0 = Date.now();
    await page.keyboard.down('KeyW');
    while (Date.now() - t0 < 12000) {
      const f = await facts();
      if (Math.hypot(target.x - f.x, target.z - f.z) < 6) break;
      let d = ((Math.atan2(target.x - f.x, target.z - f.z) - (await page.evaluate(() => window.__ascent.player.yaw))
        + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) > 0.12) {
        const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(320, Math.max(50, Math.abs(d) / 2.6 * 1000)));
        await page.keyboard.up(key);
      } else await page.waitForTimeout(180);
    }
    await page.keyboard.up('KeyW');
  }
  await page.waitForTimeout(400);

  // 3. THE CLOSE. The work clock is wound — see the header — and the game
  //    closes the run itself, on its own frame loop, through `shouldClose()`.
  await page.evaluate(() => { try { window.__ascent.panel?.close?.(); } catch { /* not open */ } });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__ascent.session.chargeTo(25));
  await probe(BEATS[1][0], BEATS[1][1], 25000);

  // 4. THE BREAK, which is where standing the run down lands.
  await probe(BEATS[2][0], BEATS[2][1], 20000);

  /* 5. …AND THE LOOP HAS TO COME BACK. A card that can be escaped into a dead
        game is not a fix. `DISMISS_WAIT` in src/session/index.js is 20 s, and
        `resume()` then defers again for the cold open and for anything src/meta
        has in flight, so the orders land at about forty seconds on this build.
        The budget is generous on purpose: this measures THAT the loop returns,
        not how fast, and a gate that fails on a slow machine is a gate people
        switch off. */
  await page.waitForTimeout(1200);
  const loopWaitedMs = 75000;
  const again = await probe(BEATS[0][0], 'the orders, second time', loopWaitedMs);
  const loopReturned = !!again;

  /* 6. AND THE ONE SURFACE THE HUD ACTUALLY ADVERTISES. `MENU · ESC · F1` is
        printed on the glass from the first frame, so the card behind it is held
        to the same contract as the beats: it opens on a real Escape from the
        world, and the next real Escape has to give the world back. */
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await probe(BEATS[3][0], BEATS[3][1], 6000);

  /* AND THE SITTING ENDS WITH THE PLAYER IN THE WORLD. Every surface has been
     dismissed by now; if the cadet still cannot walk, something is holding the
     frame that nothing is drawing. */
  await page.waitForTimeout(900);
  const freeAtEnd = await heldW();
  console.log(`  free   after every surface was dismissed the cadet walked ${freeAtEnd.toFixed(2)} m on held W`);
  await page.screenshot({ path: path.join(OUT, `${plant ? 'planted' : 'final'}.png`) }).catch(() => {});
  const flag = await page.evaluate(() => {
    const F = window.__MODAL;
    clearInterval(F.timer);
    return { worst: F.worst, worstAt: F.worstAt, samples: F.samples };
  });
  await browser.close();
  return { surfaces, freeAtEnd, loopReturned, loopWaitedMs, orphanSecs: flag.worst, orphanAt: flag.worstAt, samples: flag.samples, errors };
}

if (IS_MAIN && SELFTEST) {
  await selfTest();
}
if (!IS_MAIN) {
  // Imported for `verdict`. Nothing below this line may run.
} else {
  await main();
}

async function main() {
if (PLANT) await plantAndProve();
const m = await walk({});
console.log(`\n  flag sampler   ${m.samples} samples at 4 Hz; `
  + `longest run of uiOpen with nothing on screen: ${m.orphanSecs.toFixed(2)} s`
  + `${m.orphanAt ? ` (${m.orphanAt})` : ''}`);
console.log(`  bars: <= ${ESC_PRESSES} Escapes, out within ${(ESC_PRESSES * ESC_GAP / 1000).toFixed(1)} s, `
  + `orphan flag <= ${ORPHAN_MAX} s, >= ${MOVE_MIN} m of held W once the surface is gone\n`);

const v = verdict(m);
for (const line of v) console.log(`  FAIL  ${line}`);
note(v.length === 0, 'every surface that took the frame handed it back');
note(m.surfaces.length >= 4, 'the walk stood in front of every surface in the lane',
  `${m.surfaces.length} surface(s): ${m.surfaces.map((s) => s.name).join(', ')}`);
note(m.errors.length === 0, 'no console errors during the sitting',
  m.errors.length ? m.errors.slice(0, 3).join(' | ') : `${m.samples} samples`);

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'modal.json'), JSON.stringify({ url: URL, ...m }, null, 1));
console.log(fails.length ? `\nFAILED: ${fails.length}` : '\nPASS');
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. A surface that takes the frame and will not hand it back takes it from a
   learner on the shipped build — three cards have done it, all three found by a
   human. */
findings('check:modal', { scope: 'route' }).route(fails.map(String)).done();
}
