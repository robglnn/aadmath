#!/usr/bin/env node
/**
 * THE PHONE GATE — every on-screen control, tapped for real, in every language
 * and both orientations.
 *
 * WHY THIS FILE EXISTS.
 *
 * The client played the shipping build on a phone and asked: "why does the jump
 * button not work anymore?" It did not work. It had never worked. The pad's four
 * buttons are real `<button>` elements, so the capture-phase `pointerdown` in
 * src/core/input.js classified a thumb on JUMP as a press on *the interface* and
 * bought the world 0.16 s of deafness — and the `touchstart` that carries the
 * verb arrives a few milliseconds later and was thrown away by `_press()` on the
 * `_grace > 0` line. Every button on the pad was dead on every touch device,
 * always, and nothing in this repository noticed, because nothing in this
 * repository had ever put a finger on one.
 *
 * WHAT IT ASSERTS, per locale × orientation, from a cleared save on a frozen
 * build, using real touch events and nothing else:
 *
 *   runcard     the card that opens a run can be dismissed with a thumb. It holds
 *               `uiOpen` and `uiOpen` hides the pad, so a BEGIN button below the
 *               fold does not cost a card — it costs every control in the game
 *   pad         the control exists, is displayed, and is not hidden
 *   hit:<a>     each button is fully on screen, hit-testable, and ON TOP —
 *               `elementFromPoint` at its centre returns the button itself.
 *               A transparent div laid over it fails here, by name.
 *   reach:world EVERY interactive control on the frame is at least 44 x 44
 *   menu:handle the pause handle is 44 x 44 AND `elementFromPoint` at its
 *               centre returns the handle — see THE INVISIBLE LID, below
 *   menu:open   a real tap on that handle opens the pause card
 *   reach:menu  EVERY interactive control inside the pause card and its
 *               settings panel is at least 44 x 44 — the card is scrolled to
 *               its end so a control below the fold is measured too
 *   lang:seen   the three language buttons are wholly on screen the moment the
 *               card opens, with no scrolling
 *   lang:switch a real tap on another language's button changes the language of
 *               the running game, and a real tap back returns it
 *   menu:close  a real tap on RESUME hands the frame back
 *   jump        a real tap raises the cadet at least JUMP_M metres
 *   dash        a real tap moves him at least DASH_M metres across the ground
 *   glide       a real tap deploys the wing (`player.gliding`)
 *   interact    walked to a live tear ON THE PAD'S OWN STICK, a real tap opens
 *               the rift panel
 *   reach:rift  EVERY control on the rift card that tap opened is 44 x 44, has
 *               its own name inside it, and is ON THE GLASS — CALL THE ECHO
 *               included. This panel forbids itself an overflow, so a control
 *               below the fold is a control no gesture reaches
 *   echo:rift   CALL THE ECHO is not one key among fifteen. See THE DOOR,
 *               below — 44 px is where a control stops being a defect, and it
 *               is not where the one that carries the teaching belongs
 *   scale:*     wherever a coordinate chart and a keypad stand on one card, the
 *               chart is not narrower than the keypad. See THE QUESTION, below
 *   console     no console error anywhere in the case
 *
 * THE 44 px FLOOR. Apple's Human Interface Guidelines and Google's Material
 * guidance both publish 44 x 44 CSS px as the minimum touch target, and on this
 * surface a mis-tap is not cosmetic: it is a wrong answer recorded against a
 * student, a misconception tagged they do not hold, and a proving run burned.
 * This gate had measured the four pad buttons since the day it was written and
 * asserted nothing about them; then it asserted them and nothing else. THE
 * WHOLE PAUSE MENU WAS UNDER THE FLOOR — RESUME 145 x 26.4, each screen row
 * 289 x 32, the sound button 66 x 32, LOOK SPEED 116 x 3, INVERT 101 x 19.4,
 * and English / Espanol / Polski at 79 / 82 / 69 x 32. The locale switcher had
 * been moved off the glass into this card and given a globe on its handle, so
 * it was findable without reading English — and not reliably tappable. An ES or
 * PL student on a phone could not get the game into their own language.
 *
 * THE INVISIBLE LID. `#ui .mnu` is `opacity: 0; pointer-events: none` when the
 * pause card is shut, and `pointer-events` inherits — so everything inside a
 * shut card is untouchable, until a rule with `!important` hands some of it
 * back. src/ui/menu.css had exactly that, to keep the language row alive under
 * the cold open's own `!important` rules, and it was not scoped to `.show`. So
 * the three language buttons and the sound button stayed hit-testable, at full
 * size, in their laid-out positions, over the world, for the whole run — and
 * invisible, because opacity is composited on the parent and cannot be undone
 * from a child. In POLISH, held up at 390x844, that shut row landed exactly
 * over the pause handle: `elementFromPoint` at the centre of the globe returned
 * `button < div.langs < div.mnu-row.mnu-lang`. A thumb on the one control that
 * leads out of English hit a language button nobody can see, and the card never
 * opened. English and Spanish wrap that row to a different height and missed
 * it. `menu:handle` and `menu:open` are the two claims that catch it.
 *
 * THE QUESTION. A coordinate chart IS the question; the keypad is only the
 * instrument that answers it. Three consecutive rounds of critics reported the
 * chart drawing narrower than the keypad — 305 against 366 on a laptop, 296
 * against 372 on a handset — unchanged to the decimal each time, because
 * nothing measured the two against each other. `scale:` measures them against
 * each other, on the real `RiftPanel` with the real stylesheets, over three
 * phone frames x three locales, and again on whatever card the live game's own
 * interact button opens.
 *
 * Nothing here drives the game through `window.__ascent`. Every verb under test
 * is delivered as a real touch event to real pixels; `__ascent` is read, never
 * called, except for `--self-test`, which plants the fault it is checking for.
 *
 * THE DOOR. CALL THE ECHO (`#rf-hint`) is the only route in this whole game to
 * the faded worked echo BRIEF.md's fourth invariant is about. It shipped at
 * 111 x 22 CSS px, the smallest control on the card; it was raised to the
 * published 44 px floor; and a FOURTH consecutive round of critics reported the
 * same thing about it — *still among the smallest controls on the card*. Both
 * readings were true at once, because a floor says where a control stops being
 * a defect and nothing at all about where the one that carries the teaching
 * belongs. `echoFinding()` measures it against THE MEDIAN KEYCAP ON THE SAME
 * CARD and requires twice the area: a comparison rather than a number, so the
 * fit pass may still cut the whole rig down and the proportion holds at every
 * unit it lands on.
 *
 * SELF-TEST. `--self-test` plants five faults and requires the gate to catch
 * every one of them before the real run starts, and requires the honest tree
 * beside them to stay clean — a rule that fires on honest content gets switched
 * off.
 *
 *   1. A transparent, pointer-eating div laid exactly over the jump button — the
 *      shape of the bug this project has already shipped once at scale (see the
 *      header of src/build/build.css). `hit:jump` must name the covering element
 *      AND `jump` must measure no rise, while the other three controls still
 *      pass, so the gate is shown to localise the fault rather than blaming the
 *      whole pad.
 *   2. The shipped fault itself, put back: a capture-phase `pointerdown` that
 *      buys the world 0.16 s of deafness on every press, exactly as
 *      src/core/input.js used to. All four verbs must fail while all four
 *      geometry checks still pass — the two detectors are independent, and the
 *      gate would have caught the regression it was written for.
 *   3. One control in the pause menu's settings cut to 38 x 38 — the exact size
 *      the pad's own verbs shipped at. `reach:menu` must name it, and
 *      `menu:open`, `lang:switch` and `reach:world` must all still pass in the
 *      same run, so the gate is shown to localise the fault rather than
 *      condemning the card. A clean short case runs beside it and must produce
 *      no findings at all.
 *   4. Two faults on the rift card, and both must be refused in EVERY reading:
 *      the coordinate chart cut to 60% of the keypad's width — the shape three
 *      rounds of critics reported — and a key label stretched past the box that
 *      clips it, which is the shape of the Polish CLEAR key. Both must stay
 *      silent on the honest panel beside them.
 *   5. CALL THE ECHO put back on the 44 px floor and no further — a key-sized
 *      door to the teaching. Refused in every reading, silent on the honest
 *      panel. This one is not hypothetical: it is what the tree shipped for
 *      four rounds while every 44 px reading on the same card said "ok".
 *
 *   node tools/critic/touch.mjs --url http://127.0.0.1:4477 --out shots/touch
 *   tools/critic/rungate.sh tools/critic/touch.mjs --out shots/touch --self-test
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
/* The REAL RiftPanel, its own stylesheet, both orientation sheets and every
   generator pack the manifest names, built once and served on its own port.
   `tools/check-figures.mjs` has a main guard, so importing it starts nothing. */
import { serveFrozen } from '../check-figures.mjs';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/touch'));
const LOCALES = arg('locales', 'en,es,pl').split(',').filter(Boolean);

/* ---- the bar. Every one of these is a floor, and a floor is never lowered. */
const JUMP_M = 1.0;      // a single jump clears 2.3 m; half of that is still a jump
const DASH_M = 2.0;      // a dash is 22 m/s for a fifth of a second
const NAV_S = 90;        // seconds allowed to walk to the first tear on the stick
/* Apple HIG and Material both publish 44 x 44 CSS px as the minimum touch
   target. It is a floor, and a floor is never lowered — and it is not traded
   against a device scale factor: a thumb is the same size on every phone.
   `npm run check:reach` (tools/critic/thumb.mjs) applies the same number to
   every other control the game puts on a coarse pointer. */
const TOUCH_PX = 44;
/* src/world/beckon.js:47 opens a tear on contact inside 5.8 m, and
   src/world/rifts.js:99 lets the interact verb reach 9.0 m. The gate has to be
   in the band between them, or "the button opened it" is a claim about a boot. */
const STEP_M = 5.8;
const REACH_M = 9.0;

/**
 * Portrait, landscape, and a SHORT landscape.
 *
 * The third one is not padding. A phone held sideways with the browser's own
 * toolbars on screen has far less height than its layout viewport claims — an
 * iPhone 13 is 844x390 on paper and about 844x320 in the hand — and 568x320 is
 * an iPhone SE on its side with no chrome at all. Every measurement this gate
 * makes about "a phone" that is taken only at the two roomy sizes is a
 * measurement about a phone nobody is holding.
 */
const ORIENTATIONS = [
  { name: 'portrait', w: 390, h: 844 },
  { name: 'landscape', w: 844, h: 390 },
  { name: 'landscape-short', w: 568, h: 320 },
];

/**
 * Two items that always draw a coordinate chart above a keypad, so the one
 * comparison three rounds of critics kept making by eye is made by the gate on
 * every run instead of whenever the adaptive draw happens to hand one over.
 */
const CHART_SPECS = [
  { skill: 'eval-expr', d: 2, seed: 4242 },
  { skill: 'eval-expr', d: 4, seed: 16020 },
];

/* ---------------------------------------------------------------- page side */

/** What is on the pad right now, and is anything sitting on top of it. */
const PROBE = () => {
  const pad = document.getElementById('touchpad');
  if (!pad) return { pad: null };
  const cs = getComputedStyle(pad);
  const name = (el) => {
    if (!el) return 'nothing (the point is off the viewport)';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    return s;
  };
  const out = {
    pad: { cls: pad.className, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, z: cs.zIndex },
    buttons: [],
  };
  for (const b of pad.querySelectorAll('.btn')) {
    const r = b.getBoundingClientRect();
    const bcs = getComputedStyle(b);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const chain = [];
    for (let e = hit; e && chain.length < 5; e = e.parentElement) chain.push(name(e));
    out.buttons.push({
      a: b.dataset.a, cx, cy,
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.left), y: Math.round(r.top),
      onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      pe: bcs.pointerEvents, visibility: bcs.visibility, opacity: +bcs.opacity,
      label: (b.querySelector('b')?.textContent || '').trim(),
      isSelf: hit === b || b.contains(hit),
      hit: name(hit),
      chain: chain.join(' inside '),
    });
  }
  return out;
};

/**
 * EVERY INTERACTIVE CONTROL UNDER ONE ROOT, as a learner's thumb meets it.
 *
 * Written once and used on all three surfaces — the world frame, the pause
 * card, the rift card — because a gate with one detector per surface is three
 * gates wearing one name, and the two that nobody looks at go quietly wrong.
 *
 * `.rf-key` and its neighbours are named explicitly: the rift's keys, readings,
 * bays, movers and cells are real controls that carry no `role`, and a selector
 * that only knows about `<button>` would call that card empty.
 */
const REACH = (rootSel) => {
  const SEL = 'button, a[href], input, select, textarea, [role="button"], [role="tab"],'
    + ' [role="checkbox"], [tabindex]:not([tabindex="-1"]),'
    + ' .rf-key, .rf-reading, .rf-bay, .rf-move, .rf-cell, .slot, .place, .sound';
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return { missing: rootSel, controls: [], coarse: matchMedia('(pointer: coarse)').matches };
  /* Opacity is composited on the ancestor, so a control inside a faded panel is
     not on this screen however solid its own computed style is. */
  const shown = (el) => {
    let n = el, op = 1;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      op *= parseFloat(cs.opacity || '1');
      if (op < 0.12) return false;
      n = n.parentElement;
    }
    return true;
  };
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) {
      s += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
    }
    return s;
  };
  const controls = [];
  /* CONTROLS THAT ARE NOT ON THE SCREEN AT ALL.
     A panel that is allowed to scroll answers this by scrolling, and this list
     is meaningless there. A panel that is NOT — `src/ui/rift.css` forbids the
     rift an overflow of its own on purpose, because "a hidden overflow is a
     stratum of teaching nobody can reach" — has no answer at all: a key below
     the fold of that card is a key that does not exist. */
  const offGlass = [];
  for (const el of root.querySelectorAll(SEL)) {
    if (!shown(el)) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.top < 0 || r.left < 0 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5) {
      let s2 = el.tagName.toLowerCase();
      if (el.id) s2 += '#' + el.id;
      if (typeof el.className === 'string' && el.className.trim()) s2 += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
      offGlass.push({
        sel: s2,
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26),
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        left: Math.round(r.left), right: Math.round(r.right),
        vw: innerWidth, vh: innerHeight,
        wholly: r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight,
      });
    }
    // Scrolled entirely out of the frame: measured on another pass, not here.
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
    controls.push({
      sel: name(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      /* A CONTROL WHOSE OWN NAME DOES NOT FIT IN IT. `scrollWidth` past
         `clientWidth` on a box that clips is a word with letters cut off — and
         it is a per-LANGUAGE defect, because CLEAR is five letters, BORRAR is
         six and WYCZYSC is seven in the same key. */
      over: Math.max(0, el.scrollWidth - el.clientWidth),
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26),
    });
  }
  return {
    controls,
    offGlass,
    coarse: matchMedia('(pointer: coarse)').matches,
    fig: (() => { const e = root.querySelector('.rf-fig.grid svg') || root.querySelector('.rf-plot-stage svg');
      if (!e || !shown(e)) return null; const r = e.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })(),
    pad: (() => { const e = root.querySelector('.rf-pad');
      if (!e || !shown(e)) return null; const r = e.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })(),
  };
};

/**
 * WHICH SURFACE TOOK THE FRAME.
 *
 * `input.uiOpen` is one boolean shared by every panel in this game, so "a
 * surface took the frame" is true and useless: the next person has to reproduce
 * it by hand to find out whose surface it was. This names it — every visible
 * box inside the interface layer that covers at least a fifth of the glass,
 * biggest first — so the report is an address instead of a complaint.
 */
const WHO_TOOK_IT = () => {
  const out = [];
  const area = innerWidth * innerHeight;
  for (const el of document.querySelectorAll('#ui *, #app > *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.12) continue;
    if (cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0) continue;
    const frac = (w * h) / area;
    if (frac < 0.2) continue;
    let n = el.tagName.toLowerCase();
    if (el.id) n += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) n += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
    out.push({ n, frac: +frac.toFixed(2), z: cs.zIndex });
  }
  out.sort((a, b) => b.frac - a.frac);
  return out.slice(0, 4).map((x) => `${x.n} (${Math.round(x.frac * 100)}% of the glass, z ${x.z})`);
};

/** Read-only. Positions, flags and the tear the interact verb would open. */
const READ = () => {
  const a = window.__ascent;
  const p = a.player.pos;
  let near = null;
  for (const r of a.rifts.list) {
    if (r.locked || r.mastered) continue;
    const dd = a.rifts.plateDist(p, r);
    if (!near || dd < near.d) near = { id: r.id, d: dd, fx: r.foot.x, fz: r.foot.z };
  }
  return {
    x: p.x, y: p.y, z: p.z, vy: a.player.vel.y, yaw: a.player.yaw, speed: a.player.speed,
    grounded: a.player.loco.grounded, gliding: a.player.gliding,
    uiOpen: a.input.uiOpen, grace: a.input._grace, panel: a.panel.open,
    inHand: !!a.rifts.nearest(p), near,
  };
};

/* ---------------------------------------------------------------- host side */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sub-pixel slack, and nothing else. A floor is never lowered. */
const EPS = 0.5;

/** Which of these controls a thumb cannot reliably hit. */
function underFloor(controls) {
  return controls.filter((c) => c.w + EPS < TOUCH_PX || c.h + EPS < TOUCH_PX);
}

/**
 * Measure every control under one root, scrolling the panel to its end so a
 * control below the fold is measured too.
 *
 * The pause card is a scroller by design — `overflow: auto` on `.mnu-card` —
 * and a 44 px floor makes it a taller one. A control a thumb has to scroll to
 * is still a control a thumb has to hit, so it is measured; a reading is only
 * ever taken while the control is genuinely on the glass, because a box read
 * off-screen is a box the layout has not finished with.
 */
async function reachSweep(page, rootSel, scrollSel = null) {
  const seen = new Map();
  let coarse = null, missing = null, last = null;
  for (let pass = 0; pass < 10; pass++) {
    const p = await page.evaluate(REACH, rootSel);
    last = p;
    if (coarse === null) coarse = p.coarse;
    if (p.missing) { missing = p.missing; break; }
    for (const c of p.controls) {
      const k = `${c.sel}|${c.label}`;
      const was = seen.get(k);
      // The SMALLEST reading of a control is the one that decides it — and the
      // WORST overflow, which is not always the same pass.
      const over = Math.max(c.over || 0, was ? was.over || 0 : 0);
      if (!was || c.w * c.h < was.w * was.h) seen.set(k, { ...c, over });
      else seen.set(k, { ...was, over });
    }
    if (!scrollSel) break;
    const moved = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTop = Math.min(el.scrollHeight, before + Math.max(80, el.clientHeight * 0.8));
      return el.scrollTop > before + 1;
    }, scrollSel);
    if (!moved) break;
    await sleep(180);
  }
  if (scrollSel) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.scrollTop = 0; }, scrollSel);
    await sleep(180);
  }
  return { controls: [...seen.values()], coarse, missing, fig: last?.fig || null, pad: last?.pad || null };
}

/** Which of these controls has its own name cut off inside it. */
function clipped(controls) {
  return controls.filter((c) => c.over > 1);
}

/**
 * THE QUESTION IS NEVER NARROWER THAN THE INSTRUMENT THAT ANSWERS IT.
 * Returns a sentence when it is, and nothing when it is not.
 */
function scaleFinding(fig, pad, where) {
  if (!fig || !pad || pad.w < 1 || fig.w < 1) return null;
  if (fig.w + EPS >= pad.w) return null;
  const pct = (100 * (1 - fig.w / pad.w)).toFixed(1);
  return `${where}: THE CHART IS THE QUESTION AND IT IS ${pct}% NARROWER THAN THE KEYPAD`
    + ` ANSWERING IT — chart ${fig.w}x${fig.h}, keypad ${pad.w} CSS px wide`;
}

/**
 * THE DOOR TO THE TEACHING IS NOT ONE KEY AMONG FIFTEEN.
 *
 * `#rf-hint` is CALL THE ECHO, and it is the only route in this game to the
 * faded worked trace BRIEF.md's fourth invariant is about. It shipped at
 * 111 x 22 CSS px — the smallest control on the card. It was raised to the
 * published 44 px floor, and a FOURTH consecutive round of critics reported
 * the same thing about it: *still among the smallest controls on the card*.
 * Both readings were true at once, because 44 x 44 is where a control stops
 * being a defect and says nothing at all about where the one control that
 * carries the teaching belongs.
 *
 * So this is a second rule, over the first and never instead of it: measured
 * against THE MEDIAN KEY ON THE SAME CARD — the thing the learner presses to
 * answer — the door to the teaching may not be smaller than twice it. A
 * comparison and not a number, so the fit pass can still cut the whole rig
 * down and the proportion holds at every unit it lands on, exactly as the
 * chart-against-keypad rule above does.
 *
 * It answers only where there is a keypad to compare against, and says so
 * rather than passing quietly on a card that has none.
 */
const ECHO_OVER_KEY = 2.0;

function echoMeasure(controls) {
  const keys = controls.filter((c) => /\.rf-key\b/.test(c.sel) && !/\bcommit\b/.test(c.sel));
  if (keys.length < 4) return null;          // no keypad on this card to compare against
  const hint = controls.find((c) => /#rf-hint\b/.test(c.sel));
  const areas = keys.map((c) => c.w * c.h).sort((a, b) => a - b);
  const mid = areas.length >> 1;
  const med = areas.length % 2 ? areas[mid] : (areas[mid - 1] + areas[mid]) / 2;
  return { hint, keys: keys.length, med, a: hint ? hint.w * hint.h : 0,
    ratio: hint && med ? (hint.w * hint.h) / med : 0 };
}

function echoFinding(controls, where) {
  const m = echoMeasure(controls);
  if (!m) return null;
  const { hint, med, a, keys } = m;
  if (!hint) {
    return `${where}: THERE IS NO CALL THE ECHO ON THIS CARD — #rf-hint is not on the glass,`
      + ' and it is the only route in this game to the faded worked trace a stuck learner reaches for.';
  }
  if (a + 1 >= ECHO_OVER_KEY * med) {
    return null;
  }
  return `${where}: CALL THE ECHO IS ONE KEY AMONG FIFTEEN — #rf-hint is ${hint.w}x${hint.h}`
    + ` (${Math.round(a)} px2) against a median keycap of ${Math.round(med)} px2 over ${keys} keys,`
    + ` which is ${(a / med).toFixed(2)}x it and not the ${ECHO_OVER_KEY.toFixed(1)}x this rule publishes.`
    + ' It is the only route in this game to the faded worked echo, and 44 px is where a control stops'
    + ' being a defect, not where the one that carries the teaching belongs.';
}

/** A held touch. Playwright's touchscreen only taps; the stick needs a finger. */
class Finger {
  constructor(cdp) { this.cdp = cdp; this.down = false; }
  async start(x, y) { await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); this.down = true; this.x = x; this.y = y; }
  async move(x, y) { await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); this.x = x; this.y = y; }
  async end() { if (!this.down) return; await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); this.down = false; }
}

/** The y the cadet reaches in `ms` after a real tap on one pad button. */
async function tapAndWatch(page, btn, ms = 900, step = 55) {
  const series = [];
  await page.touchscreen.tap(btn.cx, btn.cy);
  const n = Math.max(1, Math.round(ms / step));
  for (let i = 0; i < n; i++) { await sleep(step); series.push(await page.evaluate(READ)); }
  return series;
}

/**
 * Walk to the nearest live tear on the pad's own stick, and stop in the band
 * where the boot will not open it but the button will.
 *
 * THE BAND IS 3.2 METRES WIDE AND THE CADET DOES NOT STOP DEAD.
 *
 * `src/world/beckon.js` opens a tear on contact inside RIFT_STEP (5.8 m) and
 * `src/world/rifts.js` lets the interact verb reach 9.0 m, so the only frame
 * from which "the BUTTON opened it" is a claim about the button and not about
 * the boot is the 3.2 m ring between them. This walk used to hold the stick
 * until a reading came back under 8.4 m and then let go — and a reading is
 * taken every ~150 ms of round trip, at ~6 m/s, on a cadet who then coasts.
 * Measured on this tree, nine phone profiles: it arrived at 5.6, 5.7 and 4.5 m
 * and the tear opened on contact in every case, so nine of nine runs proved
 * nothing about the interact button and the gate said so nine times.
 *
 * TWO THINGS ARE WRONG AND BOTH ARE THE HARNESS.
 *
 *   1. THE CADET IS ALREADY THERE. `dash` carries him 7 m and the gate runs it
 *      immediately before this, so the walk begins 6.4 m from a live tear with
 *      nothing to walk. `walked to 5.8 m (closest 6.4 m) in 0.7s` is the log
 *      line: 0.7 s, and the 0.6 m he moved was the settle. So he BACKS OFF
 *      first, on the same stick, past `RIFT_REARM` (8.5 m) and out to 14 m,
 *      which is what re-arms the tear, and then walks in — which is a truer
 *      account of the control anyway, because backing away from a thing is
 *      something the left thumb has to be able to do.
 *   2. HE COASTS. The last stretch is walked in PULSES with the stick let go
 *      between them, and the reading that decides is taken after he has
 *      actually stopped (`player.speed`, off `src/player/locomotion.js:728`) —
 *      never while he is still carrying momentum into the plate.
 *
 * NOTHING THE GATE ASSERTS MOVES. The button must still open a tear from
 * inside 5.8-9.0 m, on one real tap, and `--self-test` still requires the
 * shipped 0.16 s of deafness to kill it. This is the same rule, reached from a
 * frame the rule can be asked in.
 */
async function walkToRift(page, cdp, vp, log) {
  const sens = await page.evaluate(() => window.__ascent.input.sensitivity);
  const finger = new Finger(cdp);
  const sx = Math.round(vp.w * 0.20), sy = Math.round(vp.h * 0.74);
  const t0 = Date.now();
  let lastAim = 0;
  let best = Infinity;

  /* The ring the button owns, with a little air inside each edge so a reading
     taken while he rocks on his heels cannot fall out of it. */
  const BAND_LO = STEP_M + 0.15;   // 5.95 m — clear of the boot's contact radius
  const BAND_HI = REACH_M - 0.4;   // 8.6 m — inside the interact verb's reach
  const AIM_M = (STEP_M + REACH_M) / 2;  // 7.4 m — the middle of the ring to stop in
  /* src/world/beckon.js:RIFT_REARM. A tear that has just opened will not open
     again until he has been this far off it, so backing off past it is what
     makes the next approach a real approach. */
  const REARM_M = 8.5;

  const bearing = (s) => {
    let e = Math.atan2(s.near.fx - s.x, s.near.fz - s.z) - s.yaw;
    while (e > Math.PI) e -= 2 * Math.PI;
    while (e < -Math.PI) e += 2 * Math.PI;
    return e;
  };

  // aim: a real look-drag on the free half of the glass. src/player/touch.js
  // turns Δpx into Δlook at 0.0052 · sensitivity, and controller.js:734
  // subtracts it from yaw.
  /* THE OTHER WAY ROUND, when `away` is set. `bearing` is the angle from where
     he is looking to where the tear is; the angle to its opposite is that ± π,
     taken on the short side so the turn is a turn and not a spin. */
  const bearingTo = (s, away) => {
    const e = bearing(s);
    if (!away) return e;
    return e > 0 ? e - Math.PI : e + Math.PI;
  };
  const aim = async (away = false) => {
    const s = await page.evaluate(READ);
    if (!s.near) return false;
    const e = bearingTo(s, away);
    if (Math.abs(e) < 0.06) return true;
    const dx = Math.max(-320, Math.min(320, -e / (0.0052 * sens)));
    const ax = Math.round(vp.w * 0.62), ay = Math.round(vp.h * 0.28);
    const look = new Finger(cdp);
    await look.start(ax, ay);
    for (let i = 1; i <= 8; i++) { await look.move(ax + (dx * i) / 8, ay); await sleep(16); }
    await look.end();
    await sleep(80);
    return false;
  };

  /** Why a surface owning the frame is fatal here, said as an address. */
  const tookIt = async (s) => {
    const who = await page.evaluate(WHO_TOOK_IT);
    const d = s.near ? s.near.d.toFixed(1) : '?';
    if (who.some((x) => /\.rift\b/.test(x))) {
      return { ok: false, why: `the tear opened ON CONTACT at ${d} m, before the button was pressed —`
        + ` src/world/beckon.js opens one inside ${STEP_M} m and the walk did not stop in the`
        + ` ${STEP_M}-${REACH_M} m band where the BUTTON is the only thing that can open it,`
        + ` so this run proves nothing about the interact button. Surfaces holding the frame:`
        + ` ${who.join(' over ')}` };
    }
    return { ok: false, why: `a surface took the frame mid-walk (uiOpen) at ${d} m`
      + ` — ${who.length ? who.join(' over ') : 'and nothing on the glass is big enough to name, which is its own defect'}` };
  };

  for (let i = 0; i < 6; i++) if (await aim()) break;
  lastAim = Date.now();

  /* ---- 0. BACK OFF, IF THE DASH LEFT HIM STANDING ON THE PLATE ----
     Backwards on the same stick — the finger goes DOWN the glass, which
     src/player/touch.js turns into `input.move.y < 0` — so he keeps facing the
     tear and the approach below needs no second aim.

     AND FIRST, HAND THE FRAME BACK IF THE BOOT HAS ALREADY TAKEN IT. `dash` is
     the claim immediately before this one and it carries him about 6.5 m, so on
     this tree it regularly ends INSIDE the 5.8 m contact radius — measured at
     2.3, 2.8, 3.3 and 4.1 m across the nine profiles — and the tear is open
     before the interact button has been looked at. That is not the button
     failing and it is not the world failing: it is the gate walking its own
     cadet onto the plate and then asking whether the plate was reached by
     button. The card is shut with A REAL TAP ON ITS OWN CLOSE CONTROL — no
     debug call, no key — and the walk starts from there. If the tap does not
     shut it, THAT is a finding and it is made, because a card a thumb cannot
     dismiss is the same defect as a button a thumb cannot press. */
  {
    let s0 = await page.evaluate(READ);
    if (s0.uiOpen && s0.panel) {
      const x = await page.evaluate(() => {
        const b = document.querySelector('.rift.show .rf-x');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
      });
      if (!x) {
        return { ok: false, why: `the boot opened the tear at ${s0.near ? s0.near.d.toFixed(1) : '?'} m and the card`
          + ' carries no .rf-x to shut it with a thumb' };
      }
      await page.touchscreen.tap(x.cx, x.cy);
      await page.waitForFunction(() => window.__ascent.input.uiOpen === false, null, { timeout: 8000 }).catch(() => {});
      await sleep(500);
      s0 = await page.evaluate(READ);
      if (s0.uiOpen) {
        return { ok: false, why: `the boot opened the tear at ${s0.near ? s0.near.d.toFixed(1) : '?'} m and a real tap`
          + ` on its close control (${x.w}x${x.h} at ${Math.round(x.cx)},${Math.round(x.cy)}) did not hand the frame back` };
      }
      log(`      the boot had opened a tear on contact; shut it with a real tap on .rf-x and backed off`);
    }
    if (s0.uiOpen) return tookIt(s0);
    if (s0.near && s0.near.d < REARM_M + 5) {
      const want = Math.max(14, REARM_M + 5);
      const tb = Date.now();
      let awayAt = 0;
      /* HE TURNS ROUND AND WALKS. He does NOT backpedal.
         `src/player/controller.js:740` slews the camera yaw towards
         `loco.facing`, and the stick is read in the camera's basis — so a
         sustained backwards push rotates the frame it is measured in and the
         cadet walks a CIRCLE. Measured: 22 s of full backwards stick with the
         distance to `var-meaning` reading 1.4, 3.4, 3.0, 2.3, 2.6, 3.2, 1.6,
         3.1 m at a flat 5.6 m/s — six laps of a 3 m orbit, and the gate then
         blamed the interact button for it. Facing away and walking forward is
         a straight line, and it is also what a player does. */
      for (let i = 0; i < 8; i++) if (await aim(true)) break;
      awayAt = Date.now();
      await finger.start(sx, sy);
      while (Date.now() - tb < 25000) {
        const s = await page.evaluate(READ);
        if (s.uiOpen) { await finger.end(); return tookIt(s); }
        if (!s.near) { await finger.end(); return { ok: false, why: 'no live tear in the world to walk to' }; }
        if (s.near.d >= want) break;
        if (Date.now() - awayAt > 2200 && Math.abs(bearingTo(s, true)) > 0.16) {
          await finger.end();
          for (let i = 0; i < 4; i++) if (await aim(true)) break;
          awayAt = Date.now();
        }
        if (!finger.down) await finger.start(sx, sy);
        await finger.move(sx, sy - 70);
        await sleep(110);
      }
      await finger.end();
      // he is still carrying momentum backwards; let it die before turning round
      for (let i = 0; i < 14; i++) { await sleep(70); if ((await page.evaluate(READ)).speed < 0.6) break; }
      const s1 = await page.evaluate(READ);
      log(`      backed off to ${s1.near ? s1.near.d.toFixed(1) : '?'} m so the tear re-arms (${REARM_M} m, src/world/beckon.js)`);
      for (let i = 0; i < 6; i++) if (await aim()) break;
      lastAim = Date.now();
    }
  }

  while (Date.now() - t0 < NAV_S * 1000) {
    const s = await page.evaluate(READ);
    if (s.uiOpen) { await finger.end(); return tookIt(s); }
    if (!s.near) { await finger.end(); return { ok: false, why: 'no live tear in the world to walk to' }; }
    best = Math.min(best, s.near.d);
    if (s.panel) { await finger.end(); return { ok: false, why: `the tear opened on contact at ${s.near.d.toFixed(1)} m — the boot got there before the button` }; }

    /* STOPPED, INSIDE THE BAND. That is the frame the claim is about, and
       there is nothing left to walk. */
    if (s.near.d <= BAND_HI && s.near.d >= BAND_LO && s.speed < 0.6) break;

    // re-aim on a timer, letting go of the stick to do it: a bearing that has
    // drifted twenty degrees walks past the tear and the gate blames the button
    if (Date.now() - lastAim > 2500 && s.near.d > 11) {
      if (Math.abs(bearing(s)) > 0.10) { await finger.end(); await aim(); }
      lastAim = Date.now();
    }

    if (s.near.d > 12) {
      /* GROSS APPROACH — full stick far out, a walk as it closes. */
      const pull = s.near.d > 18 ? 70 : 30;
      if (!finger.down) await finger.start(sx, sy);
      await finger.move(sx, sy - pull);
      await sleep(110);
      continue;
    }

    /* CREEP. The last four metres, in pulses, with the stick LET GO between
       them and the next reading taken only once he has stopped — because a
       reading taken at 6 m/s is a reading about where he was, and the band is
       3.2 m wide. */
    await finger.end();
    if (s.near.d < BAND_LO) {
      if (Math.abs(bearing(s)) < 2.6) {
        return { ok: false, why: `overshot into the contact radius (${s.near.d.toFixed(1)} m < ${BAND_LO} m)`
          + ' — the creep could not stop him inside the band' };
      }
      // facing away from it: a step forward opens the distance again
    }
    const ms = Math.max(55, Math.min(210, Math.round((s.near.d - AIM_M) * 55)));
    if (ms > 0) {
      await finger.start(sx, sy);
      await finger.move(sx, sy - 22);
      await sleep(ms);
      await finger.end();
    }
    for (let i = 0; i < 16; i++) { await sleep(70); if ((await page.evaluate(READ)).speed < 0.6) break; }
    if (Math.abs(bearing(await page.evaluate(READ))) > 0.10) { await aim(); lastAim = Date.now(); }
  }
  await finger.end();
  await sleep(500);
  const s = await page.evaluate(READ);
  log(`      walked to ${s.near ? s.near.d.toFixed(1) : '?'} m (closest ${best.toFixed(1)} m) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (s.panel) return { ok: false, why: 'the tear opened on contact before the button was pressed' };
  if (!s.near || s.near.d > REACH_M) return { ok: false, why: `the stick could not close the distance — stopped ${s.near ? s.near.d.toFixed(1) : '?'} m out, needs < ${REACH_M} m` };
  if (s.near.d < STEP_M) return { ok: false, why: `overshot into the contact radius (${s.near.d.toFixed(1)} m < ${STEP_M} m)` };
  if (!s.inHand) return { ok: false, why: 'no tear in hand at that distance' };
  return { ok: true, d: s.near.d };
}

/* ------------------------------------------------------------------ one case */

async function runCase(browser, { locale, vp, plantOverlay = false, plantDeafness = false,
  plantMenu = false, stopAfter = null, out, log }) {
  const tag = `${locale}-${vp.name}`;
  const errors = [];
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: vp.w, height: vp.h },
    screen: { width: vp.w, height: vp.h },
    hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    locale: locale === 'es' ? 'es-ES' : locale === 'pl' ? 'pl-PL' : 'en-US',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private mode */ } }, locale);

  const R = [];
  const claim = (name, ok, detail) => { R.push({ name, ok, detail }); log(`      ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };

  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });

    /* ---- 0. the run card must be dismissable with a thumb ----
       A run opens with a card that owns the frame and hides the pad on purpose
       (src/session) — correct, and the pad comes back when it closes. But the
       pad ONLY comes back when it closes, so a BEGIN button that renders below
       the fold does not cost the player a card: it costs them every control in
       the game, permanently, on that device. Measured, not assumed. */
    await page.waitForFunction(() => !!document.querySelector('.ses-charter.show'), null, { timeout: 90000 })
      .catch(() => {});
    const card = await page.evaluate(() => {
      const c = document.querySelector('.ses-charter.show');
      if (!c) return null;
      const go = c.querySelector('.sc-go');
      if (!go) return { go: null };
      const r = go.getBoundingClientRect();
      const box = c.querySelector('.sc-card');
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        go: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        below: Math.round(r.bottom - innerHeight),
        vh: innerHeight,
        reachable: !!(hit && (hit === go || go.contains(hit))),
        overflowY: box ? getComputedStyle(box).overflowY : null,
        scrollH: box ? box.scrollHeight : null,
        clientH: box ? box.clientHeight : null,
      };
    });
    if (card && card.go) {
      const ok = card.reachable && card.below <= 0;
      claim('runcard', ok, ok
        ? `BEGIN at ${card.go.y}..${card.go.y + card.go.h} in ${card.vh} px of glass`
        : `BEGIN ends ${card.below} px BELOW THE FOLD (${card.go.y}..${card.go.y + card.go.h} in ${card.vh} px)`
          + ` and cannot be tapped — the card holds uiOpen, so the whole pad stays hidden and every`
          + ` control in the game is dead from here. NOT THE PAD: src/session/session.css:225`
          + ` .ses-charter .sc-card caps height (max-height:calc(100dvh - 1rem)) with`
          + ` overflow-y:${card.overflowY} — content ${card.scrollH} px in a ${card.clientH} px box.`);
      if (ok) {
        await page.touchscreen.tap(card.go.x + card.go.w / 2, card.go.y + card.go.h / 2);
        await page.waitForTimeout(1400);
      }
    }
    await page.waitForFunction(() => window.__ascent.input.uiOpen === false, null, { timeout: 20000 })
      .catch(() => {});
    const pre = await page.evaluate(READ);
    if (pre.uiOpen) {
      claim('frame', false, 'a surface still owns the frame; the pad is hidden and nothing below it can be pressed');
      await ctx.close();
      return { tag, results: R, errors };
    }

    if (plantDeafness) {
      // THE SHIPPED FAULT, PUT BACK. This is byte-for-byte what src/core/input.js
      // used to do on every press that `worldPointer()` called "the interface" —
      // and the pad's own buttons are `<button>` elements, so that was every tap
      // on the pad. The verb arrives a few milliseconds later on `touchstart`
      // and `_press()` throws it away on the `_grace > 0` line. If the gate does
      // not fail here it would not have caught the bug it was written for.
      await page.evaluate(() => {
        addEventListener('pointerdown', () => { window.__ascent.input.eatPointer(0.16); }, true);
      });
    }

    if (plantOverlay) {
      // THE PLANTED FAULT. A transparent, pointer-eating div exactly over the
      // jump button — nothing else. The gate must catch it, by name.
      await page.evaluate(() => {
        const b = document.querySelector('#touchpad .btn[data-a="jump"]');
        const r = b.getBoundingClientRect();
        const o = document.createElement('div');
        o.id = 'selftest-lid';
        o.style.cssText = `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;`
          + `height:${r.height + 8}px;background:transparent;pointer-events:auto;z-index:2147483647`;
        document.body.appendChild(o);
      });
    }

    if (plantMenu) {
      // THE PLANTED FAULT, IN THE REAL CARD THROUGH THE REAL CASCADE: one
      // control in the settings cut to 38 x 38 — the exact size DASH, GLIDE and
      // INTERACT shipped at while nine green phone profiles said nothing.
      await page.addStyleTag({ content: '#ui .mnu-lang .langs button[data-loc="es"]'
        + ' { min-height: 38px !important; height: 38px !important; width: 38px !important;'
        + ' min-width: 38px !important; }' });
      await page.waitForTimeout(120);
    }

    /* ---- 0b. EVERY CONTROL ON THE FRAME IS BIG ENOUGH FOR A THUMB ----
       Not the pad's four buttons: every control the frame carries. The build
       rack's slots were 38 x 34 sideways and 44 x 40 held up, and GOT IT on the
       controls card was 50 x 16.8 — all three measured by an existing gate,
       none of them asserted by one. */
    {
      const w = await reachSweep(page, null);
      if (!w.coarse) {
        claim('reach:world', false, 'the page did not report a coarse pointer, so this reading is about a mouse and proves nothing');
      } else {
        const bad = underFloor(w.controls);
        claim('reach:world', bad.length === 0, bad.length
          ? bad.map((c) => `${c.sel} "${c.label}" ${c.w}x${c.h} — under the published ${TOUCH_PX}x${TOUCH_PX} floor`).join('; ')
          : `${w.controls.length} control(s), smallest ${(() => {
            const m = w.controls.slice().sort((a, b) => a.w * a.h - b.w * b.h)[0];
            return m ? `${m.sel} ${m.w}x${m.h}` : 'none';
          })()}`);
      }
    }

    /* ---- 0c. THE PAUSE MENU, AND THE ONLY ROUTE OUT OF ENGLISH ----
       The locale switcher lives in this card. A student who reads no English
       has to be able to: find the handle (a globe, in no language), PRESS it,
       see three languages each written in its own name, and hit one of them. */
    {
      const handle = await page.evaluate(() => {
        const b = document.querySelector('.mnu-pill');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        const nm = (el) => {
          if (!el) return 'nothing (the point is off the viewport)';
          let x = el.tagName.toLowerCase();
          if (el.id) x += '#' + el.id;
          if (typeof el.className === 'string' && el.className.trim()) x += '.' + el.className.trim().split(/\s+/).join('.');
          return x;
        };
        const chain = [];
        for (let e = hit; e && chain.length < 5; e = e.parentElement) chain.push(nm(e));
        return {
          cx, cy, w: +r.width.toFixed(1), h: +r.height.toFixed(1),
          x: Math.round(r.left), y: Math.round(r.top),
          onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          isSelf: !!(hit && (hit === b || b.contains(hit))),
          hit: nm(hit), chain: chain.join(' inside '),
        };
      });
      if (!handle) {
        claim('menu:handle', false, 'there is no .mnu-pill on the frame — the pause card has no handle, and on a phone a key is not an affordance');
      } else {
        const why = [];
        if (handle.w + EPS < TOUCH_PX || handle.h + EPS < TOUCH_PX) {
          why.push(`${handle.w}x${handle.h} CSS px — under the published ${TOUCH_PX}x${TOUCH_PX} floor`);
        }
        if (!handle.onScreen) why.push(`off the viewport at ${handle.x},${handle.y} in ${vp.w}x${vp.h}`);
        if (!handle.isSelf) {
          why.push(`covered by ${handle.hit} (${handle.chain}) — a thumb on the globe hits that instead,`
            + ' and the one control that leads out of English never opens');
        }
        claim('menu:handle', why.length === 0, why.length ? why.join('; ') : `${handle.w}x${handle.h} at ${handle.x},${handle.y}`);

        const before = await page.evaluate(() => document.querySelector('.mnu h2')?.textContent || '');
        await page.touchscreen.tap(handle.cx, handle.cy);
        await page.waitForTimeout(650);
        let open = await page.evaluate(() => !!document.querySelector('.mnu.show'));
        let note = 'the pause card came up on one tap';
        if (!open) {
          /* WHY IT DID NOT OPEN, AND WHETHER THAT IS THE HANDLE'S FAULT.
             `Menu.show()` refuses while any other surface owns the frame, which
             is correct — a pause that opens on top of a live keypad is not a
             pause — and the handle wears `.away` (opacity 0, pointer-events
             none) while that is true. So there are two completely different
             failures here and they must not be reported as one:

               the frame was FREE and the tap did nothing   → the handle is dead
               a beat had the frame for that instant        → wait for it and ask again

             Only the first is a defect in this control, and it fails with no
             retry. The second is retried ONCE, after the frame comes back, and
             the surface that had it is named in the result either way. */
          const st = await page.evaluate(() => ({ ui: window.__ascent.input.uiOpen }));
          const who = await page.evaluate(WHO_TOOK_IT);
          if (!st.ui) {
            claim('menu:open', false, 'THE FRAME WAS FREE AND A REAL TAP ON THE HANDLE DID NOTHING —'
              + ` uiOpen=false, nothing else owns the screen (${who.join(' over ') || 'nothing named'}).`
              + ' The pause card is the only door to the language switcher on a phone.');
          } else {
            await page.waitForFunction(() => window.__ascent.input.uiOpen === false, null, { timeout: 8000 }).catch(() => {});
            await page.waitForTimeout(400);
            const h2 = await page.evaluate(() => {
              const b = document.querySelector('.mnu-pill');
              if (!b) return null; const r = b.getBoundingClientRect();
              return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
            });
            if (h2) { await page.touchscreen.tap(h2.cx, h2.cy); await page.waitForTimeout(650); }
            open = await page.evaluate(() => !!document.querySelector('.mnu.show'));
            note = open
              ? `the first tap was refused because another surface held the frame (${who.join(' over ') || 'unnamed'});`
                + ' the handle stood down, as it should, and opened on the next tap once the frame came back'
              : `two real taps and no pause card — the frame was held by ${who.join(' over ') || 'something unnamed'}`
                + ' and never came back';
            claim('menu:open', open, note);
          }
        } else {
          claim('menu:open', open, note);
        }

        if (open) {
          /* Every control in the card and its settings panel, the card scrolled
             to its end so nothing below the fold is missed. */
          const m = await reachSweep(page, '.mnu', '.mnu-card');
          const bad = underFloor(m.controls);
          const cut = clipped(m.controls);
          claim('reach:menu', bad.length === 0 && cut.length === 0, (bad.length || cut.length)
            ? [...bad.map((c) => `${c.sel} "${c.label}" ${c.w}x${c.h} — under the published ${TOUCH_PX}x${TOUCH_PX} floor`),
              ...cut.map((c) => `${c.sel} "${c.label}" has ${c.over} px of its own name cut off`)].join('; ')
            : `${m.controls.length} control(s) in the pause card and its settings, all at least ${TOUCH_PX}x${TOUCH_PX}`);
          await page.screenshot({ path: path.join(out, `${tag}-00-menu.png`) });

          /* The three languages, wholly on the glass, with no scrolling: a
             control a student has to go looking for is the same defect as a
             control that is not there. */
          const langs = await page.evaluate(() => [...document.querySelectorAll('.mnu.show .langs button')].map((b) => {
            const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {
              loc: b.dataset.loc, name: (b.textContent || '').trim(),
              cx: r.left + r.width / 2, cy: r.top + r.height / 2,
              w: +r.width.toFixed(1), h: +r.height.toFixed(1),
              on: b.classList.contains('on'),
              onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
              isSelf: !!(hit && (hit === b || b.contains(hit))),
            };
          }));
          const seenBad = langs.filter((l) => !l.onScreen || !l.isSelf || l.w + EPS < TOUCH_PX || l.h + EPS < TOUCH_PX);
          claim('lang:seen', langs.length === 3 && seenBad.length === 0,
            langs.length !== 3 ? `${langs.length} language button(s) in the settings, not 3`
              : seenBad.length ? seenBad.map((l) => `${l.loc} "${l.name}" ${l.w}x${l.h}`
                + `${l.onScreen ? '' : ' OFF THE GLASS'}${l.isSelf ? '' : ' COVERED'}`).join('; ')
              : langs.map((l) => `${l.name} ${l.w}x${l.h}`).join(' · ') + ' — all on the glass with no scrolling');

          /* AND THE TAP HAS TO CHANGE THE LANGUAGE OF THE RUNNING GAME.
             Read off the card's own heading, which is what a student sees —
             not off a flag in the engine. */
          const target = langs.find((l) => !l.on && l.onScreen && l.isSelf);
          const home = langs.find((l) => l.on);
          if (!target) {
            claim('lang:switch', false, 'no language button other than the current one could be tapped');
          } else {
            await page.touchscreen.tap(target.cx, target.cy);
            await page.waitForTimeout(500);
            const mid = await page.evaluate(() => ({
              h2: document.querySelector('.mnu h2')?.textContent || '',
              saved: (() => { try { return localStorage.getItem('ascent.locale'); } catch { return null; } })(),
              on: document.querySelector('.mnu.show .langs button.on')?.dataset.loc || null,
            }));
            const moved = mid.saved === target.loc && mid.on === target.loc && mid.h2 !== before;
            let back = null;
            if (home) {
              const hb = await page.evaluate((loc) => {
                const b = document.querySelector(`.mnu.show .langs button[data-loc="${loc}"]`);
                if (!b) return null; const r = b.getBoundingClientRect();
                return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
              }, home.loc);
              if (hb) {
                await page.touchscreen.tap(hb.cx, hb.cy);
                await page.waitForTimeout(500);
                back = await page.evaluate(() => ({
                  h2: document.querySelector('.mnu h2')?.textContent || '',
                  on: document.querySelector('.mnu.show .langs button.on')?.dataset.loc || null,
                }));
              }
            }
            const returned = !home || (back && back.on === home.loc && back.h2 === before);
            claim('lang:switch', moved && returned, moved
              ? (returned ? `${home ? home.loc : '?'} -> ${target.loc} -> ${home ? home.loc : '?'} on real taps,`
                  + ` the card's own title changing with it ("${before}" -> "${mid.h2}")`
                : `the switch to ${target.loc} took, and the tap back to ${home.loc} did not`)
              : `a real tap on "${target.name}" did not change the language:`
                + ` saved=${mid.saved} pressed=${mid.on} title "${before}" -> "${mid.h2}"`);
          }

          /* …and the card hands the frame back on a thumb, not only on a key. */
          const res = await page.evaluate(() => {
            const b = document.querySelector('.mnu.show .mnu-resume');
            if (!b) return null; const r = b.getBoundingClientRect();
            return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
          });
          if (res) await page.touchscreen.tap(res.cx, res.cy);
          await page.waitForTimeout(600);
          const shut = await page.evaluate(() => !document.querySelector('.mnu.show') && window.__ascent.input.uiOpen === false);
          claim('menu:close', shut, shut
            ? 'RESUME gave the frame back on one tap'
            : 'the pause card did not close on a real tap on RESUME — the pad stays hidden and every control in the game is dead from here');
        }
      }
    }

    if (stopAfter === 'menu') { await ctx.close(); return { tag, results: R, errors }; }

    /* ---- 1. the pad is there ---- */
    const probe = await page.evaluate(PROBE);
    if (!probe.pad) {
      claim('pad', false, 'no #touchpad in the document on a coarse pointer');
      await ctx.close();
      return { tag, results: R, errors };
    }
    const padUp = probe.pad.display !== 'none' && probe.pad.visibility !== 'hidden' && +probe.pad.opacity > 0;
    claim('pad', padUp, `display:${probe.pad.display} class="${probe.pad.cls}"`);

    /* ---- 2. every button is on screen, and on top ---- */
    const WANT = ['jump', 'dash', 'glide', 'interact'];
    const byA = Object.fromEntries(probe.buttons.map((b) => [b.a, b]));
    for (const a of WANT) {
      const b = byA[a];
      if (!b) { claim(`hit:${a}`, false, 'the button is not in the pad'); continue; }
      const reasons = [];
      /* BIG ENOUGH FOR A THUMB, not merely present.
         Apple's Human Interface Guidelines and Google's Material guidance both
         publish the same floor for a touch target: 44 x 44 CSS px. This gate
         had measured every button's width and height since the day it was
         written, printed them in its own output on every run, and asserted
         NOTHING about them — so DASH, GLIDE and INTERACT shipped at 38 x 38
         sideways and 40 x 40 held up, with only JUMP over the line, and nine
         green phone profiles said so every time. `Can it be hit` is not the
         same question as `can a thumb hit it`. */
      if (b.w + 0.5 < TOUCH_PX || b.h + 0.5 < TOUCH_PX) {
        reasons.push(`${b.w}x${b.h} CSS px — under the published ${TOUCH_PX}x${TOUCH_PX} floor for a touch target`);
      }
      if (!b.onScreen) reasons.push(`off the viewport at ${b.x},${b.y} ${b.w}x${b.h} in ${vp.w}x${vp.h}`);
      if (b.pe !== 'auto') reasons.push(`pointer-events:${b.pe}`);
      if (b.visibility !== 'visible' || b.opacity <= 0) reasons.push(`${b.visibility}/${b.opacity}`);
      if (!b.isSelf) reasons.push(`covered by ${b.hit} (${b.chain})`);
      if (!b.label) reasons.push('no localised label');
      claim(`hit:${a}`, reasons.length === 0,
        reasons.length ? reasons.join('; ') : `${b.w}x${b.h} at ${b.x},${b.y} "${b.label}"`);
    }
    await page.screenshot({ path: path.join(out, `${tag}-01-pad.png`) });

    /* ---- 3. jump raises him ---- */
    {
      const s0 = await page.evaluate(READ);
      const s = await tapAndWatch(page, byA.jump, 950);
      const peak = Math.max(...s.map((r) => r.y));
      const rise = peak - s0.y;
      claim('jump', rise >= JUMP_M, `rose ${rise.toFixed(2)} m (needs ${JUMP_M}) · y ${s0.y.toFixed(2)} → ${peak.toFixed(2)}`);
      await page.waitForFunction(() => window.__ascent.player.loco.grounded, null, { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(400);
    }

    /* ---- 4. glide deploys ----
       Second, not last, and from the plaza he is standing on: the wing is
       refused below 3.2 m of ground clearance (`_openGlide`, src/player/
       locomotion.js), so a gate that asks for it after a dash has carried him
       over a lip is testing the terrain, not the button. One jump buys 2.3 m
       and is not enough; the double jump every player makes is. The wing press
       is buffered for 0.17 s (src/core/input.js), so the ask is repeated while
       he is still up there rather than being timed to a single frame. */
    {
      await page.touchscreen.tap(byA.jump.cx, byA.jump.cy);
      // the second jump goes in at the apex of the first, because `doubleV` is
      // a fresh upward velocity and buys the most height from the highest
      // point. Fired on a fixed timer instead, it lands anywhere on the arc and
      // the clearance the wing needs becomes a coin toss between orientations.
      for (let i = 0; i < 20; i++) { await sleep(40); const q = await page.evaluate(READ); if (!q.grounded && q.vy > 2) break; }
      for (let i = 0; i < 20; i++) { await sleep(40); if ((await page.evaluate(READ)).vy <= 1.2) break; }
      await page.touchscreen.tap(byA.jump.cx, byA.jump.cy);
      await sleep(180);
      const air = await page.evaluate(READ);
      let flew = false, at = null, asks = 0;
      for (let i = 0; i < 12 && !flew; i++) {
        const s = await page.evaluate(READ);
        if (s.grounded) break;
        await page.touchscreen.tap(byA.glide.cx, byA.glide.cy);
        asks++;
        for (let k = 0; k < 3; k++) {
          await sleep(70);
          const q = await page.evaluate(READ);
          if (q.gliding) { flew = true; at = q; break; }
        }
      }
      claim('glide', flew, flew
        ? `the wing opened at y ${at.y.toFixed(2)} after ${asks} ask(s)`
        : `no wing after a double jump and ${asks} ask(s) (y ${air.y.toFixed(2)}, vy ${air.vy.toFixed(2)}, grounded=${air.grounded})`);
      await page.screenshot({ path: path.join(out, `${tag}-02-glide.png`) });
      await page.waitForFunction(() => window.__ascent.player.loco.grounded, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(600);
    }

    /* ---- 5. dash moves him ---- */
    {
      const s0 = await page.evaluate(READ);
      const s = await tapAndWatch(page, byA.dash, 900);
      const far = Math.max(...s.map((r) => Math.hypot(r.x - s0.x, r.z - s0.z)));
      claim('dash', far >= DASH_M, `carried ${far.toFixed(2)} m across the ground (needs ${DASH_M})`);
      await page.waitForFunction(() => window.__ascent.player.loco.grounded, null, { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(700);
    }

    /* ---- 6. interact opens a tear ---- */
    {
      const cdp = await ctx.newCDPSession(page);
      const walk = await walkToRift(page, cdp, vp, log);
      if (!walk.ok) {
        claim('interact', false, walk.why);
      } else {
        const b2 = (await page.evaluate(PROBE)).buttons.find((x) => x.a === 'interact');
        await page.touchscreen.tap(b2.cx, b2.cy);
        let opened = false;
        for (let i = 0; i < 20; i++) { await sleep(70); if (await page.evaluate(() => window.__ascent.panel.open)) { opened = true; break; } }
        claim('interact', opened, opened
          ? `the tear opened from ${walk.d.toFixed(1)} m — outside the ${STEP_M} m boot radius`
          : `tapped at ${walk.d.toFixed(1)} m with a tear in hand and no panel opened`);
        await page.screenshot({ path: path.join(out, `${tag}-03-interact.png`) });

        /* ---- 6b. THE CARD THAT TAP OPENED ----
           CALL THE ECHO is `#rf-hint`, and it is the ONLY route in this whole
           game to the faded worked echo BRIEF.md's fourth invariant is about —
           the thing a stuck learner reaches for. It shipped at 111 x 22 CSS px:
           the smallest control on the card, next to a close cross at 25 x 25
           and 18 x 18 sideways. This reads the card the game itself just
           handed the player, not a harness copy of it. */
        if (opened) {
          await page.waitForTimeout(900);
          // No scroller: `src/ui/rift.css` forbids this panel an overflow of its
          // own on purpose ("a hidden overflow is a stratum of teaching nobody
          // can reach"), so everything it carries is on the glass at once.
          const r = await reachSweep(page, '.rift', null);
          const bad = underFloor(r.controls);
          const cut = clipped(r.controls);
          const off = r.offGlass || [];
          claim('reach:rift', bad.length === 0 && cut.length === 0 && off.length === 0,
            (bad.length || cut.length || off.length)
              ? [...bad.map((c) => `${c.sel} "${c.label}" ${c.w}x${c.h} — under the published ${TOUCH_PX}x${TOUCH_PX} floor`),
                ...cut.map((c) => `${c.sel} "${c.label}" has ${c.over} px of its own name cut off`),
                ...off.map((c) => `${c.sel} "${c.label}" is ${c.wholly ? 'wholly' : 'partly'} off the glass`
                  + ` (${c.left}..${c.right} x ${c.top}..${c.bottom} in ${c.vw}x${c.vh}) and this panel does not scroll`)].join('; ')
              : `${r.controls.length} control(s) on the rift card, all at least ${TOUCH_PX}x${TOUCH_PX},`
                + ' none with its name cut and none off the glass');
          const ec = echoFinding(r.controls, `the card the interact button opened · ${tag}`);
          claim('echo:rift', !ec, ec || 'CALL THE ECHO stands clear of the keys on this card,'
            + ' or this card carries no keypad to measure it against');
          const sc = scaleFinding(r.fig, r.pad, `the card the interact button opened · ${tag}`);
          claim('scale:rift', !sc, sc || (r.fig && r.pad
            ? `chart ${r.fig.w}, keypad ${r.pad.w} — the question is ${(100 * (r.fig.w / r.pad.w - 1)).toFixed(1)}% wider`
            : 'this card carries no coordinate chart beside a keypad — nothing to compare'));
          await page.screenshot({ path: path.join(out, `${tag}-04-rift.png`) });
        }
      }
      await cdp.detach().catch(() => {});
    }

    claim('console', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'clean');
  } catch (e) {
    claim('ran', false, String(e && e.message ? e.message : e));
  }
  await ctx.close();
  return { tag, results: R, errors };
}

/* ============================= the question, on the real rift card ======== */

/**
 * THE CHART IS THE QUESTION AND THE KEYPAD IS ONLY THE INSTRUMENT.
 *
 * Measured on the REAL `RiftPanel` — the shipping class, its own stylesheet,
 * both orientation sheets loaded last exactly as `src/main.js` loads them, and
 * every generator pack the manifest names — over the same three phone frames
 * this gate plays and all three locales. The live half of this gate reads
 * whatever card the interact button happened to open, which is honest and is
 * not deterministic; this half asks the question of a card that always carries
 * a coordinate chart, so a regression cannot hide behind the draw.
 *
 * It also re-reads the 44 px floor over that card, because CALL THE ECHO lives
 * there and is the only route in this game to the teaching.
 *
 * @param {'figure'|null} plant the fault to put in the real panel, if any
 */
async function figureSweep(browser, { plant = null, out = null, log = console.log,
  profiles = ORIENTATIONS } = {}) {
  const problems = [];
  const seen = [];
  const server = await serveFrozen();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(server.base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    /* ONE READING IS THROWN AWAY, ON PURPOSE, AND IT IS THE FIRST.
       The very first `__show` on a fresh page mounts the panel, loads KaTeX's
       fonts and runs the fit pass from cold, and it was the one reading in
       eighteen that came back with no chart on it — which this gate correctly
       reports as NOT MEASURED and which is a fact about the harness starting
       up, not about the card. Warming it is not the same as retrying a
       measurement: nothing measured here is discarded, because nothing has been
       measured yet. */
    await page.evaluate(async () => {
      window.__show({ skill: 'eval-expr', d: 2, seed: 4242, locale: 'en' });
      const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await f(); await new Promise((r) => setTimeout(r, 300)); await f();
    });
    await page.waitForFunction(() => {
      const e = document.querySelector('.rf-fig.grid svg');
      return !!e && e.getBoundingClientRect().width > 1;
    }, null, { timeout: 20000 }).catch(() => {});

    for (const vp of profiles) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      for (const locale of LOCALES) {
        for (const spec of CHART_SPECS) {
          await page.evaluate(async ({ spec, locale, plant }) => {
            document.getElementById('touch-plant')?.remove();
            window.__show({ ...spec, locale });
            const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await f(); await new Promise((r) => setTimeout(r, 0)); await f();
            if (plant === 'figure') {
              /* The shape three consecutive rounds of critics reported, put into
                 the REAL panel through the REAL cascade — and written against
                 `--rf-instr`, THE KEYPAD'S OWN WIDTH, rather than against the
                 chart's parent. `max-width: 60%` is 60% of whichever box the
                 composition happens to give the chart, so sideways — where the
                 chart and the keypad stand in separate columns — it left the
                 chart WIDER than the keypad and the plant bit in one of three
                 orientations. A plant that only fires where the defect is
                 easiest proves the gate on the easy case and nowhere else. */
              const st = document.createElement('style');
              st.id = 'touch-plant';
              st.textContent = '.rf-fig.grid { max-width: calc(var(--rf-instr) * .6) !important; }';
              document.head.appendChild(st);
              await f();
            }
            if (plant === 'echo') {
              /* CALL THE ECHO PUT BACK ON THE FLOOR AND NO FURTHER — which is
                 not a hypothetical: it is what this tree shipped for four
                 rounds while `reach:rift` said "all at least 44x44" every
                 time. A key-sized door to the teaching, level with a `7`. */
              const st = document.createElement('style');
              st.id = 'touch-plant';
              st.textContent = '#rf-hint { min-width: 44px !important; min-height: 44px !important;'
                + ' padding-inline: 0 !important; font-size: .4rem !important; letter-spacing: 0 !important; }';
              document.head.appendChild(st);
              await f();
            }
            if (plant === 'below') {
              /* A CONTROL PUSHED UNDER THE FOLD OF A PANEL THAT CANNOT SCROLL —
                 the shape of the SEAL slab on a sideways phone with a chart. */
              const st = document.createElement('style');
              st.id = 'touch-plant';
              st.textContent = '.rf-key.commit { margin-top: 400px !important; }';
              document.head.appendChild(st);
              await f();
            }
            if (plant === 'clip') {
              /* A LABEL TOO LONG FOR THE CONTROL THAT CARRIES IT. This is the
                 shape of a real, shipped defect: `.rf-key.wipe` clips, CLEAR is
                 five letters, BORRAR six and WYCZYSC seven, and at the tracking
                 the cap used to carry the Polish word measured 57 px of text in
                 a 52 px key on a 390x844 phone — so a Polish student's CLEAR
                 key read WYCZYS. Tracking is the cheapest way to make any label
                 too long for its box, so it is what the plant uses.

                 AND THE PLANT IS 2.4em, NOT THE .9em IT WAS, BECAUSE TRACKING
                 IS A MULTIPLE OF THE TYPE AND THE TYPE CHANGED UNDER IT.
                 `.rf-key.wipe` had been losing the cascade to `.rf-key.util`
                 since the day it was written — same specificity, three lines
                 later, `font-size: calc(1rem * var(--rf-u))` — so the cap this
                 gate was planting against was rendering at nearly TWICE the
                 size its own stylesheet asks for. When that was fixed the cap
                 got smaller, and .9em of a smaller em stopped overflowing it:
                 this plant went from 18 of 18 readings refused to 8, in one
                 commit, with the rule untouched. A plant calibrated against a
                 bug is a plant that stops proving anything the moment the bug
                 is fixed, so it is now sized to overflow the cap at every unit
                 the fit pass can land on rather than at one of them. The rule
                 itself — scrollWidth against clientWidth — is not touched, and
                 the honest panel beside it must still produce nothing. */
              const st = document.createElement('style');
              st.id = 'touch-plant';
              st.textContent = '.rf-key.wipe { letter-spacing: 2.4em !important; }';
              document.head.appendChild(st);
              await f();
            }
          }, { spec, locale, plant });
          /* THE PANEL FITS ITSELF ON A rAF CHAIN. `RiftPanel._fit()` re-runs
             itself on the next frame, so the first reading after a viewport
             change can catch a card that has not finished deciding how big it
             is — which reports as "this card carries no chart" and is a
             statement about the harness, not the game. Wait for both boxes to
             have a width, then read. If they never get one, THAT is a finding
             and it is made below. */
          await page.waitForFunction(() => {
            const f = document.querySelector('.rf-fig.grid svg') || document.querySelector('.rf-plot-stage svg');
            const d = document.querySelector('.rf-pad');
            return !!f && !!d && f.getBoundingClientRect().width > 1 && d.getBoundingClientRect().width > 1;
          }, null, { timeout: 4000 }).catch(() => {});
          const p = await page.evaluate(REACH, null);
          const where = `rift ${spec.skill} d${spec.d} · ${vp.name} · ${locale}`;
          if (!p.coarse) {
            problems.push(`${where}: the panel did not report a coarse pointer, so this reading is about a mouse and proves nothing`);
            continue;
          }
          if (!p.fig || !p.pad) {
            problems.push(`${where}: NOT MEASURED — this card was expected to carry a coordinate chart above a keypad`
              + ` and carries ${p.fig ? 'no keypad' : 'no chart'}. A gate that quietly measures nothing is not a gate.`);
            continue;
          }
          const em = echoMeasure(p.controls);
          seen.push({ where, ratio: p.fig.w / p.pad.w, fig: p.fig, pad: p.pad,
            echo: em && em.hint ? em.ratio : null,
            echoBox: em && em.hint ? `${em.hint.w}x${em.hint.h}` : null,
            echoMed: em ? Math.round(em.med) : null,
            /* Whether the one control the clip plant stretches was ON THE GLASS
               in this reading. `REACH` skips a control scrolled out of the
               frame — right for the 44 px question, and it means the number of
               readings is not the number of chances the clip rule had. The
               self-test compares like with like rather than quietly accepting
               a plant that only bit where it was easy. */
            wipe: p.controls.some((c) => /\bwipe\b/.test(c.sel)) });
          const sc = scaleFinding(p.fig, p.pad, where);
          if (sc) problems.push(sc);
          const ec = echoFinding(p.controls, where);
          if (ec) problems.push(ec);
          for (const c of underFloor(p.controls)) {
            problems.push(`${where}: ${c.sel} "${c.label}" is ${c.w}x${c.h} CSS px — under the published ${TOUCH_PX}x${TOUCH_PX} floor for a touch target`);
          }
          /* EVERY CONTROL ON THIS CARD IS ON THIS SCREEN.
             The rift panel forbids itself an overflow, so there is no scroll
             that reaches a control below the fold — it is simply not there.
             Measured on the real panel: at 844x390 with a coordinate chart the
             SEAL slab, the only way to commit an answer on the keypad, sat at
             410..458 in a 390 px frame. */
          for (const c of p.offGlass) {
            problems.push(`${where}: ${c.sel} "${c.label}" IS ${c.wholly ? 'WHOLLY' : 'PARTLY'} OFF THE GLASS —`
              + ` it is drawn at ${c.left}..${c.right} x ${c.top}..${c.bottom} in a ${c.vw}x${c.vh} frame, and this`
              + ` panel does not scroll, so there is no gesture that reaches it.`);
          }
          for (const c of clipped(p.controls)) {
            problems.push(`${where}: ${c.sel} "${c.label}" HAS ITS OWN NAME CUT OFF — ${c.over} px of the`
              + ` label is outside a box that clips. A control whose word is cut is a control in one language and`
              + ` a fragment in another.`);
          }
        }
      }
    }
    /* ---- THE ALBUM, AFTER EVERY MEASUREMENT AND NEVER BESIDE ONE ----
       Two frames per phone x locale: the coordinate chart against the keypad
       that answers it, and then the same card with CALL THE ECHO PRESSED, which
       is the only picture in this repository of the teaching arriving on a
       phone. It is a separate pass because pressing that button changes the
       composition of the card, and a measurement taken next to a screenshot
       that has changed the card is a measurement about the screenshot. */
    if (out) {
      for (const vp of profiles) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        for (const locale of LOCALES) {
          await page.evaluate(async ({ spec, locale }) => {
            document.getElementById('touch-plant')?.remove();
            window.__show({ ...spec, locale });
            const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await f(); await new Promise((r) => setTimeout(r, 0)); await f();
          }, { spec: CHART_SPECS[0], locale });
          await page.waitForFunction(() => {
            const e = document.querySelector('.rf-fig.grid svg');
            return !!e && e.getBoundingClientRect().width > 1;
          }, null, { timeout: 4000 }).catch(() => {});
          await page.screenshot({ path: path.join(out, `chart-${vp.name}-${locale}.png`) });
          const opened = await page.evaluate(async () => {
            const b = document.getElementById('rf-hint');
            if (!b || b.hidden || b.disabled) return false;
            b.click();
            const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await f(); await new Promise((r) => setTimeout(r, 420)); await f();
            return document.querySelector('.rift.echo-on') !== null;
          });
          if (opened) await page.screenshot({ path: path.join(out, `echo-${vp.name}-${locale}.png`) });
          else problems.push(`the teaching on ${vp.name} · ${locale}: CALL THE ECHO was pressed and no echo`
            + ' came up — #rf-hint is the only route in this game to the faded worked trace.');
        }
      }
    }
    if (errs.length) problems.push(`console errors on the rift card: ${errs.slice(0, 3).join(' | ')}`);
    await page.close();
  } finally {
    await server.stop();
  }
  const tightest = seen.slice().sort((a, b) => a.ratio - b.ratio)[0];
  if (tightest) {
    log(`      tightest chart-to-keypad ratio over ${seen.length} reading(s): ${tightest.ratio.toFixed(3)}x`
      + `  (${tightest.where}: chart ${tightest.fig.w}, keypad ${tightest.pad.w})`);
  }
  /* The same reading for the door to the teaching, printed on every run and not
     only when it is refused — a margin nobody can see is a margin that erodes. */
  const tightEcho = seen.filter((x) => x.echo != null).sort((a, b) => a.echo - b.echo)[0];
  if (tightEcho) {
    log(`      tightest CALL THE ECHO against the median keycap: ${tightEcho.echo.toFixed(2)}x`
      + ` (bar ${ECHO_OVER_KEY.toFixed(1)}x) — ${tightEcho.where}: #rf-hint ${tightEcho.echoBox},`
      + ` median keycap ${tightEcho.echoMed} px2`);
  }
  return { problems, seen };
}

/* ---------------------------------------------------------------------- main */

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
let bad = 0;


/**
 * THE FOUR PLANTS THAT LIVE ON THE RIFT CARD, AND THE HONEST CARD BESIDE THEM.
 *
 * Lifted out of the self-test verbatim so that `--figures-only` runs THIS and
 * not a second copy of it. A gate with one detector per entry point is two
 * gates wearing one name, and the one nobody looks at goes quietly wrong —
 * which is the whole argument of `tools/critic/_play.mjs`'s header.
 */
async function figurePlants() {
    console.log('\nSELF-TEST 4 — the coordinate chart cut to 60% of the keypad answering it, the');
    console.log('shape three consecutive rounds of critics reported. The gate must name it in');
    console.log('every locale and both orientations, and must stay silent on the honest panel.');
    const honest = await figureSweep(browser, { log: (s) => console.log(s) });
    const kind = (re) => honest.problems.filter((x) => re.test(x));
    const honestScale = kind(/NARROWER THAN THE KEYPAD/);
    const honestClip = kind(/HAS ITS OWN NAME CUT OFF/);
    const honestOff = kind(/OFF THE GLASS/);
    const honestOther = honest.problems.filter((x) => !/NARROWER THAN THE KEYPAD|HAS ITS OWN NAME CUT OFF|OFF THE GLASS|CALL THE ECHO/.test(x));
    console.log(`  the honest panel, ${honest.seen.length} reading(s): ${honestScale.length} scale,`
      + ` ${honestClip.length} clipped, ${honestOff.length} off-glass, ${honestOther.length} other`);
    for (const x of [...honestScale, ...honestClip, ...honestOther].slice(0, 4)) console.log('     · ' + x);
    /* THE OFF-GLASS RULE'S HONEST CONTROL IS THE PORTRAIT CARD, AND ONLY THAT —
       said out loud, because a self-test that quietly forgives a real finding is
       the same disease as a gate excluded for being red. On a phone held up the
       rift card fits and this rule must be silent, so that is the control it is
       held to. SIDEWAYS IT IS NOT SILENT, and that is not a fault in the rule: at
       844x390 and 568x320 with a coordinate chart the real panel puts the SEAL
       slab — the only way to commit an answer on the keypad — below the fold of a
       card that forbids itself a scrollbar. That finding is printed here and it
       is carried by the REAL RUN below, where it turns this gate red. It is not
       forgiven anywhere. */
    const offControl = await figureSweep(browser, { profiles: [ORIENTATIONS[0]], log: () => {} });
    const offQuiet = offControl.problems.filter((x) => /OFF THE GLASS/.test(x));
    console.log(`  the off-glass rule on the card that FITS (portrait, ${offControl.seen.length} readings):`
      + ` ${offQuiet.length} finding(s) — it must be silent here`);
    if (honestOff.length) {
      console.log(`  AND IT IS NOT SILENT SIDEWAYS — ${honestOff.length} finding(s), carried into the run below:`);
      for (const x of honestOff.slice(0, 2)) console.log('     · ' + x);
    }
    const planted = await figureSweep(browser, { plant: 'figure', log: () => {} });
    const caughtFig = planted.problems.filter((x) => /NARROWER THAN THE KEYPAD/.test(x));
    console.log(`  the shrunken chart: ${caughtFig.length === planted.seen.length && planted.seen.length ? 'CAUGHT' : 'MISSED'}`
      + ` — ${caughtFig.length} of ${planted.seen.length} reading(s) refused`);
    for (const x of caughtFig.slice(0, 2)) console.log('     · ' + x);

    console.log('\n  PLANTED as well: a key label stretched past the box that clips it — the shape of');
    console.log('  the Polish CLEAR key, which read WYCZYS in every phone frame while English and');
    console.log('  Spanish were fine.');
    const stretched = await figureSweep(browser, { plant: 'clip', log: () => {} });
    const caughtCut = stretched.problems.filter((x) => /HAS ITS OWN NAME CUT OFF/.test(x));
    const chances = stretched.seen.filter((x) => x.wipe).length;
    console.log(`     ${caughtCut.length === chances && chances >= ORIENTATIONS.length ? 'CAUGHT' : 'MISSED'}`
      + ` — ${caughtCut.length} of the ${chances} reading(s) that had the stretched control on the glass`
      + ` (of ${stretched.seen.length} readings in all)`);
    for (const x of caughtCut.slice(0, 2)) console.log('       · ' + x);
    /* EVERY reading must refuse it, not most of them: a chart cut to 60% of the
       instrument answering it is the defect in every frame it is drawn in, and a
       plant that only fires in portrait leaves the sideways composition — which
       is where this defect was actually reported — unproven. */
    console.log('\n  PLANTED as well: a control pushed under the fold of a panel that cannot scroll —');
    console.log('  the shape of the SEAL slab, the only way to commit an answer on the keypad.');
    const under = await figureSweep(browser, { plant: 'below', log: () => {} });
    const caughtUnder = under.problems.filter((x) => /OFF THE GLASS/.test(x));
    console.log(`     ${caughtUnder.length >= under.seen.length && under.seen.length ? 'CAUGHT' : 'MISSED'}`
      + ` — ${caughtUnder.length} finding(s) over ${under.seen.length} reading(s)`);
    for (const x of caughtUnder.slice(0, 2)) console.log('       · ' + x);

    console.log('\n  PLANTED as well: CALL THE ECHO put back on the 44 px floor and no further —');
    console.log('  a key-sized door to the teaching, which is what four consecutive rounds of');
    console.log('  critics reported while every 44 px reading on the same card said "ok".');
    const keyed = await figureSweep(browser, { plant: 'echo', log: () => {} });
    const caughtEcho = keyed.problems.filter((x) => /CALL THE ECHO IS ONE KEY AMONG FIFTEEN/.test(x));
    console.log(`     ${caughtEcho.length === keyed.seen.length && keyed.seen.length ? 'CAUGHT' : 'MISSED'}`
      + ` — ${caughtEcho.length} of ${keyed.seen.length} reading(s) refused`);
    for (const x of caughtEcho.slice(0, 2)) console.log('       · ' + x);
    const honestEcho = kind(/CALL THE ECHO IS ONE KEY AMONG FIFTEEN|THERE IS NO CALL THE ECHO/);
    console.log(`  the honest panel on the same rule, ${honest.seen.length} reading(s): ${honestEcho.length} finding(s)`
      + ' — it must be silent here');

    if (honestScale.length || honestClip.length || honestOther.length || offQuiet.length
      || honestEcho.length
      || caughtFig.length !== planted.seen.length || !planted.seen.length
      || caughtCut.length !== chances || chances < ORIENTATIONS.length
      || caughtEcho.length !== keyed.seen.length || !keyed.seen.length
      || caughtUnder.length < under.seen.length || !under.seen.length) {
      console.log('SELF-TEST FAILED: the chart-to-keypad rule, the clipped-label rule or the');
      console.log('door-to-the-teaching rule fired on the honest panel, or did not refuse its own');
      console.log('planted defect in every case.');
      await browser.close();
      process.exit(1);
    }
  return true;
}

/* ---------------------------------------------------------------------------
   THE CHEAP HALF, ON EVERY COMMIT — `npm run check:touch:rule`.

   The whole of this gate is forty minutes of real play, so it is recorded per
   wave rather than run per commit, and for four consecutive rounds the ONE
   finding it kept making — the coordinate chart drawing narrower than the
   keypad answering it, and then the keypad running off the bottom of a card
   with no scrollbar — was re-found by a human between waves. A gate whose
   finding a person has to re-find is a finding the schedule buried.

   `--figures-only` runs the half that needs no world, no session and no walk:
   the four plants on the real `RiftPanel` (`figurePlants`, which is the SAME
   function the full self-test calls — not a copy of it), and then the real
   sweep over three phone frames x three locales. About ninety seconds, and it
   is the same rule, the same plant and the same ledger.

   It is a STRICT SUBSET, never a substitute: it does not put a finger on the
   pad, does not open a tear, and does not touch the pause card. `check:touch`
   is still recorded per wave and its recorded red still fails the build.
   --------------------------------------------------------------------------- */
if (has('figures-only')) {
  if (has('self-test') && !await figurePlants()) { await browser.close(); process.exit(1); }
  if (has('self-test')) console.log('SELF-TEST PASSED.\n');
  console.log('=== the coordinate chart against the keypad answering it ===');
  const only = await figureSweep(browser, { out: OUT, log: (s) => console.log(s) });
  console.log(`      ${only.seen.length} reading(s) over ${ORIENTATIONS.length} phone frames x ${LOCALES.length} locales`);
  for (const x of only.problems) console.log(`      FAIL ${x}`);
  console.log(`\n${only.problems.length === 0 ? 'CHART-AGAINST-KEYPAD RULE PASSED'
    : `CHART-AGAINST-KEYPAD RULE FAILED — ${only.problems.length} finding(s)`}`);
  await browser.close();
  findings('check:touch:rule', { scope: 'route' })
    .route(only.problems.map((f) => `the chart against the keypad: ${f}`))
    .done();
  process.exit(0);
}

if (has('self-test')) {
  console.log('SELF-TEST — a transparent lid over the jump button. The gate must catch it.');
  const quiet = [];
  const r = await runCase(browser, {
    locale: 'en', vp: ORIENTATIONS[0], plantOverlay: true,
    out: OUT, log: (s) => quiet.push(s),
  });
  const hit = r.results.find((x) => x.name === 'hit:jump');
  const jump = r.results.find((x) => x.name === 'jump');
  const caughtByHit = hit && !hit.ok && /covered by/.test(hit.detail || '');
  const caughtByTap = jump && !jump.ok;
  console.log(`  hit:jump  ${caughtByHit ? 'CAUGHT' : 'MISSED'}  ${hit ? hit.detail : '(no result)'}`);
  console.log(`  jump      ${caughtByTap ? 'CAUGHT' : 'MISSED'}  ${jump ? jump.detail : '(no result)'}`);
  const others = r.results.filter((x) => ['hit:dash', 'hit:glide', 'hit:interact'].includes(x.name));
  const localised = others.every((x) => x.ok);
  console.log(`  the other three controls still pass: ${localised ? 'yes' : 'no'} — the gate names the covered one, not the pad`);
  if (!caughtByHit || !caughtByTap) {
    console.log('SELF-TEST FAILED: the gate did not notice a lid over its own button. It proves nothing.');
    await browser.close();
    process.exit(1);
  }

  console.log('\nSELF-TEST 2 — the shipped fault put back: every press buys the world 0.16 s of');
  console.log('deafness, so the pad eats its own verbs. The gate must fail all four buttons.');
  const quiet2 = [];
  const r2 = await runCase(browser, {
    locale: 'en', vp: ORIENTATIONS[0], plantDeafness: true,
    out: OUT, log: (s) => quiet2.push(s),
  });
  const verbs = ['jump', 'dash', 'glide', 'interact'];
  const dead = verbs.filter((v) => { const x = r2.results.find((y) => y.name === v); return x && !x.ok; });
  const geom = verbs.filter((v) => { const x = r2.results.find((y) => y.name === 'hit:' + v); return x && x.ok; });
  for (const v of verbs) {
    const x = r2.results.find((y) => y.name === v);
    console.log(`  ${v.padEnd(9)} ${x && !x.ok ? 'CAUGHT' : 'MISSED'}  ${x ? x.detail : '(no result)'}`);
  }
  console.log(`  geometry still passes for ${geom.length}/4 buttons — the two detectors are independent`);
  if (dead.length !== verbs.length) {
    console.log(`SELF-TEST FAILED: ${verbs.length - dead.length} verb(s) still passed with the shipped fault in place.`);
    await browser.close();
    process.exit(1);
  }
  console.log('\nSELF-TEST 3 — one control in the pause menu\'s settings cut to 38 x 38, the exact');
  console.log('size DASH, GLIDE and INTERACT shipped at. The gate must name it and must not');
  console.log('condemn the rest of the card — and the honest card beside it must be clean.');
  const quiet3 = [];
  const r3 = await runCase(browser, {
    locale: 'en', vp: ORIENTATIONS[0], plantMenu: true, stopAfter: 'menu',
    out: OUT, log: (s) => quiet3.push(s),
  });
  const reach = r3.results.find((x) => x.name === 'reach:menu');
  const caughtMenu = reach && !reach.ok && /under the published 44x44 floor/.test(reach.detail || '') && /38x38/.test(reach.detail || '');
  console.log(`  reach:menu  ${caughtMenu ? 'CAUGHT' : 'MISSED'}  ${reach ? reach.detail : '(no result)'}`);
  const untouched = ['menu:handle', 'menu:open', 'lang:switch', 'menu:close', 'reach:world'];
  const stillOk = untouched.filter((n) => { const x = r3.results.find((y) => y.name === n); return x && x.ok; });
  console.log(`  the rest of the card still passes: ${stillOk.length}/${untouched.length} (${stillOk.join(', ')})`);

  const quiet3b = [];
  const r3b = await runCase(browser, {
    locale: 'en', vp: ORIENTATIONS[0], stopAfter: 'menu',
    out: OUT, log: (s) => quiet3b.push(s),
  });
  const cleanFails = r3b.results.filter((x) => !x.ok);
  console.log(`  the honest card, ${r3b.results.length} claim(s): ${cleanFails.length} failure(s)`
    + `${cleanFails.length ? ' — ' + cleanFails.map((x) => `${x.name}: ${x.detail}`).join(' | ') : ''}`);
  if (!caughtMenu || stillOk.length !== untouched.length || cleanFails.length) {
    console.log('SELF-TEST FAILED: the 44 px rule did not catch a 38 px control in the pause menu,');
    console.log('or it condemned the honest card beside it. A rule that fires on honest content');
    console.log('gets switched off, and a rule that misses its own defect proves nothing.');
    await browser.close();
    process.exit(1);
  }

  if (!await figurePlants()) { await browser.close(); process.exit(1); }

  console.log('SELF-TEST PASSED.\n');
  /* THE PLANTS, WITHOUT THE FORTY MINUTES.
     `tools/gate-audit.mjs` answers "has this gate ever refused anything" by
     RUNNING the half of its command that carries `--self-test`, and this gate
     fuses its plants into the whole run — so for this row, and two others like
     it, "run the self-test" has meant "run the entire browser gate", and the
     audit table costs about eighty minutes and goes stale. This flag is the
     seam: the plants still need a built server (three of the four put their
     fault into the real running game), so the command is
       tools/critic/rungate.sh tools/critic/touch.mjs --self-test --self-test-only
     which is minutes rather than most of an hour. It changes nothing about
     what is planted or what is required of it. */
  if (has('self-test-only')) { await browser.close(); process.exit(0); }
}

const summary = [];
for (const locale of LOCALES) {
  for (const vp of ORIENTATIONS) {
    console.log(`\n=== ${locale} · ${vp.name} ${vp.w}x${vp.h} ===`);
    const r = await runCase(browser, { locale, vp, out: OUT, log: (s) => console.log(s) });
    const fails = r.results.filter((x) => !x.ok);
    bad += fails.length;
    summary.push({ tag: r.tag, fails: fails.map((f) => `${f.name}: ${f.detail}`) });
  }
}

/* The live half above reads whichever card the interact button opened, which is
   honest and is not deterministic. This half asks the same two questions of a
   card that ALWAYS carries a coordinate chart above a keypad, so a regression
   cannot hide behind the draw. */
console.log('\n=== the coordinate chart against the keypad answering it ===');
const fig = await figureSweep(browser, { out: OUT, log: (s) => console.log(s) });
console.log(`      ${fig.seen.length} reading(s) over ${ORIENTATIONS.length} phone frames x ${LOCALES.length} locales`);
for (const x of fig.problems) console.log(`      FAIL ${x}`);
bad += fig.problems.length;
summary.push({ tag: 'the chart against the keypad', fails: fig.problems });

await browser.close();

console.log('\n──────────────────────────────────────────────');
for (const s of summary) console.log(`${s.fails.length === 0 ? 'PASS' : 'FAIL'}  ${s.tag}${s.fails.length ? '\n      ' + s.fails.join('\n      ') : ''}`);
console.log(`\n${bad === 0 ? 'TOUCH GATE PASSED' : `TOUCH GATE FAILED — ${bad} assertion(s)`}  ·  shots in ${OUT}`);
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This gate is recorded
   per wave and its recorded RED fails `npm run check`, so what it holds has to
   be legible to the runner and not only to a reader. Every control this taps is one a thumb
   taps on the phone the client plays on. */
findings('check:touch', { scope: 'route' })
  .route(summary.flatMap((s) => s.fails.map((f) => `${s.tag}: ${f}`)))
  .done();
