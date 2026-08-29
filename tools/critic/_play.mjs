#!/usr/bin/env node
/**
 * PRESS THE BUTTONS THE GAME ACTUALLY DRAWS — the six answer surfaces, played
 * the way a hand plays them.
 *
 *   import { answerCard, describeSurfaces } from './_play.mjs';
 *   node tools/critic/_play.mjs --self-test              # the readers, no browser
 *
 * WHY THIS FILE EXISTS
 *
 * A GATE THAT CANNOT PLAY THE GAME CANNOT MEASURE HOW THE GAME IS PLAYED.
 *
 * `tools/critic/motion.mjs` has been red for four rounds on a number its own
 * JSON contradicts. Its `answer()` knew about a list of readings and a keypad,
 * and dealt with everything else — the balance beam, the sorting bays, the area
 * field, the coordinate plot — by clicking the first `.rf-move, .rf-cell, .ans`
 * it could find. `src/ui/rift.js` says what that is worth:
 *
 *   · `.rf-cell` (the area field) runs `self._click(cell, () => { if (!picked)
 *     return; … })`. With no chip picked, THE CLICK IS A NO-OP.
 *   · the sorting bays are one bay per LIKE-CLASS now, so "a chip with a
 *     letter goes in the `var` bay" files three kinds of chip into one bay;
 *   · the area field's chips are `.rf-chip`, the same class the sorting bays
 *     use, so an area card fell into the sorter branch, looked for a `.rf-bay`
 *     that surface does not have, and broke out of the loop having placed
 *     nothing — and then counted an item as answered.
 *   · the coordinate plot has no `.rf-reading`, no `.rf-chip` and no `.rf-move`,
 *     so it fell through to the typing branch, which typed a line equation at a
 *     surface with no socket to type into.
 *   · the balance beam takes three to five moves to solve and got one blind
 *     click on whichever button happened to be first in the DOM.
 *
 * A card that is never answered never settles, the scheduler has no reason to
 * move, and the cadet stands on that plate for the rest of the sitting. That is
 * the same defect one level up from the one motion.mjs already records about
 * `L.sprinting`: **an instrument that cannot press the button says the same
 * thing as a game that will not move.**
 *
 * WHAT THIS MODULE IS ALLOWED TO KNOW. The same contract every critic here
 * works under: `window.__ascent` is read for FACTS — which surface is up, what
 * the accepted answer is — and never used to make the game do anything. Every
 * action below is a real mouse click or a real key press on the element
 * `src/ui/rift.js` mounted. Where the surface publishes something a learner can
 * see (`data-value` on a reading, `data-g` on a keypad cap, the KaTeX
 * `<annotation>` that carries the exact source of what is drawn) that is what
 * is read; nothing reads a modality's closure.
 */

/* ===========================================================================
   THE READERS — pure, so they self-test in a second with no browser.
   =========================================================================== */

/** Strip the presentation out of a LaTeX answer, leaving the pad's alphabet. */
export function toPad(src) {
  let s = String(src ?? '');
  if (!s) return '';
  s = s.replace(/\\left|\\right|\\!|\\,|\;|\\ /g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pm/g, '±')
    .replace(/\\le(?![a-zA-Z])/g, '≤')
    .replace(/\\ge(?![a-zA-Z])/g, '≥');
  for (let guard = 0; guard < 16; guard++) {
    const before = s;
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^$1');
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `${wrap(a)}/${wrap(b)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => `√${wrap(a)}`);
    if (s === before) break;
  }
  return s.replace(/\s+/g, '');
}
const wrap = (body) => {
  const b = String(body).trim();
  return /^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(b) ? b : `(${b})`;
};

/**
 * An answer of the shape `10n + 30` split into the two things the area field's
 * two cells are worth — which is exactly how `src/ui/rift.js` `_area` builds
 * them: `coefStr(k*a, v)` and `String(k*b)`.
 *
 * @returns {{varTerm:string|null, numTerm:string|null}}
 */
export function splitArea(answer) {
  const s = String(answer ?? '').replace(/\\left|\\right/g, '').replace(/\s+/g, '');
  const toks = s.match(/[+-]?[^+-]+/g) || [];
  let varTerm = null; let numTerm = null;
  for (const tk of toks) {
    const m = /^([+-]?)(\d*)([a-zA-Z]?)$/.exec(tk);
    if (!m) continue;
    const sign = m[1] === '-' ? '-' : '';
    if (m[3]) { if (varTerm === null) varTerm = `${sign}${m[2]}${m[3]}`; }
    else if (m[2] !== '' && numTerm === null) numTerm = `${sign}${m[2]}`;
  }
  return { varTerm, numTerm };
}

/** `y = 3x + 1` -> `{ m, b }`, in the notation `src/learn/plot.js` accepts. */
export function parseLine(answer) {
  const s = String(answer ?? '').replace(/\\left|\\right|\s/g, '');
  const m = /^y=(-?\d*)([a-zA-Z])([+-]\d+)?$/.exec(s);
  if (m) {
    const slope = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    return { m: slope, b: m[3] ? Number(m[3]) : 0 };
  }
  const flat = /^y=(-?\d+)$/.exec(s);
  return flat ? { m: 0, b: Number(flat[1]) } : null;
}

/* --- exact rationals, the same arithmetic src/ui/rift.js runs the beam on --- */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const fr = (n, d = 1) => {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const fEq = (a, b) => !!a && !!b && a.n * b.d === b.n * a.d;
const fNeg = (a) => ({ n: -a.n, d: a.d });
const fZero = (a) => a.n === 0;
const fOne = (a) => a.n === a.d;
const fNum = (a) => a.n / a.d;

/** A LaTeX number — `7`, `-7`, `\frac{3}{4}`, `-\frac{3}{4}` — as an exact fraction. */
export function texNum(src) {
  const s = String(src ?? '').replace(/\\left|\\right|\s/g, '');
  const f = /^(-?)\\frac\{(-?\d+)\}\{(\d+)\}$/.exec(s);
  if (f) return fr((f[1] === '-' ? -1 : 1) * Number(f[2]), Number(f[3]));
  return /^-?\d+$/.test(s) ? fr(Number(s)) : null;
}

/**
 * One side of the beam — `3x + 4`, `\frac{3}{2}x - 5`, `19` — as `{a, b}`.
 *
 * Fractions are stashed before the split, because `\frac{-3}{4}` carries a
 * minus sign INSIDE a brace group and a naive split on `+-` cuts the term in
 * half. This module's own self-test caught exactly that on `\frac{3}{2}x - 5`,
 * which came back with `b = +5`.
 */
export function parseSide(src, v) {
  let s = String(src ?? '').replace(/\\left|\\right|\s/g, '');
  const stash = [];
  s = s.replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, (m, n, d) => { stash.push(fr(Number(n), Number(d))); return `#${stash.length - 1}#`; });
  if (/\\/.test(s)) return null;
  const toks = s.match(/[+-]?[^+-]+/g);
  if (!toks) return null;
  let a = fr(0); let b = fr(0);
  const add = (x, y) => fr(x.n * y.d + y.n * x.d, x.d * y.d);
  for (const raw of toks) {
    const m = /^([+-]?)(?:#(\d+)#|(\d+))?([a-zA-Z]?)$/.exec(raw);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    const mag = m[2] != null ? stash[Number(m[2])] : m[3] != null ? fr(Number(m[3])) : (m[4] ? fr(1) : null);
    if (!mag) return null;
    const val = fr(sign * mag.n, mag.d);
    if (m[4]) { if (v && m[4] !== v) return null; a = add(a, val); }
    else b = add(b, val);
  }
  return { a, b };
}

/** `3x + 4 = 19` -> the beam state, in the same shape `_balance` holds it. */
export function parseBeam(src) {
  const s = String(src ?? '').replace(/\\left|\\right/g, '');
  const parts = s.split('=');
  if (parts.length !== 2) return null;
  const vm = /[a-zA-Z]/.exec(s.replace(/\\[a-zA-Z]+/g, ''));
  if (!vm) return null;
  const v = vm[0];
  const L = parseSide(parts[0], v); const R = parseSide(parts[1], v);
  if (!L || !R) return null;
  if (fZero(L.a) && fZero(R.a)) return null;
  return { v, L, R };
}

/**
 * THE IDEAL MOVE, by the same rule `src/ui/rift.js` `_balance` `ideal()` uses.
 *
 * This is a PLAYER'S strategy, not a copy of a gate's rule: it is what a cadet
 * does — clear the constant, then take the coefficient off — and it is the only
 * way to press the right button on a tray of five without guessing. Every move
 * it names is read back off the tray's own buttons before it is clicked, so if
 * the game's catalogue changes, the click simply does not find a button and the
 * caller falls back to trying the tray in order.
 */
export function idealMove(st) {
  if (!fZero(st.L.a) && !fZero(st.R.a)) {
    const smaller = Math.abs(fNum(st.L.a)) <= Math.abs(fNum(st.R.a)) ? st.L.a : st.R.a;
    return { kind: 'var', f: fNeg(smaller) };
  }
  const V = fZero(st.L.a) ? st.R : st.L;
  if (fZero(V.a)) return null;
  if (!fZero(V.b)) return { kind: 'const', f: fNeg(V.b) };
  if (!fOne(V.a)) return { kind: 'div', f: V.a };
  return null;
}

/**
 * A move button's own LaTeX — `+\; 4`, `-\; 3x`, `\div\; 2`, `\mathbin{:}\; 2` —
 * read back into the operation it performs. The division sign is
 * locale-dependent (`mathOp('div')`), so every spelling of it is accepted.
 *
 * AND THE SPELLING THIS FILE DID NOT KNOW, which made every gate that presses
 * a beam an ENGLISH-ONLY gate without saying so. `src/i18n/index.js:144` is
 * the source of record: `div: { en: '\\div', es: '\\mathbin{:}', pl:
 * '\\mathbin{:}' }` — the colon is WRAPPED, so that TeX spaces it as an
 * operator, and the shipped tray prints `\mathbin{:}\; 7`, never a bare `:`.
 * The case in the self-test below was written by hand as `:\; 2` and passed,
 * so the rule looked proved in three locales while the real Spanish and Polish
 * trays parsed as `null` on every button. Measured on the frozen build, one
 * skill, ten seeds: every English beam solved in ONE move; the same ten in
 * Spanish and Polish took 1, 2, 3, 10, 12, 12 — the fallback that clicks the
 * tray in order — and two of them never settled at all. `src/learn/shape.js:156`
 * already reads all three spellings; this file is what was behind.
 * Every case below is now cut from a real tray.
 */
export function parseOp(tex, v) {
  let s = String(tex ?? '').replace(/\\left|\\right|\\;|\\,|\\!|\s/g, '');
  if (/^(\\div|\\mathbin\{:\}|:|÷)/.test(s)) {
    const f = texNum(s.replace(/^(\\div|\\mathbin\{:\}|:|÷)/, ''));
    return f ? { kind: 'div', f } : null;
  }
  const sign = s.startsWith('-') ? -1 : 1;
  s = s.replace(/^[+-]/, '');
  const m = /^(\\frac\{-?\d+\}\{\d+\}|\d+)?([a-zA-Z]?)$/.exec(s);
  if (!m) return null;
  const mag = m[1] ? texNum(m[1]) : (m[2] ? fr(1) : null);
  if (!mag) return null;
  const f = fr(sign * mag.n, mag.d);
  if (m[2]) return v && m[2] !== v ? null : { kind: 'var', f };
  return { kind: 'const', f };
}

/** Do these two operations do the same thing to the beam? */
export const sameOp = (a, b) => !!a && !!b && a.kind === b.kind && fEq(a.f, b.f);

/* ===========================================================================
   THE HAND — real clicks and real keys on the surface src/ui/rift.js mounted.
   =========================================================================== */

/** What is on the card, read off the DOM the way a learner reads it. */
function readSurface() {
  const A = (el) => (el ? (el.querySelector('annotation')?.textContent ?? el.textContent ?? '').trim() : '');
  const q = (sel) => [...document.querySelectorAll(sel)];
  return {
    readings: q('.rf-reading').map((b, i) => ({ i, v: b.getAttribute('data-value'), disabled: !!b.disabled })),
    chips: q('.rf-chip').map((c, i) => ({ i, tex: A(c), value: c.getAttribute('data-value'), placed: c.classList.contains('placed') || !!c.disabled })),
    bays: q('.rf-bay').map((b) => b.getAttribute('data-kind')),
    cells: q('.rf-cell').map((c, i) => ({ i, cls: c.className, filled: c.classList.contains('filled') })),
    moves: q('.rf-move').map((b, i) => ({ i, tex: A(b) })),
    caps: q('.rf-key').map((b) => b.getAttribute('data-g')).filter(Boolean),
    beam: A(document.querySelector('#rf-prompt')),
    plot: !!document.querySelector('.rf-plot'),
  };
}


const facts = (page) => page.evaluate(() => {
  const p = window.__ascent.panelInfo();
  return { open: !!p.open, settled: !!p.settled, mode: p.mode || null, answer: p.open ? String(p.answer) : null };
});
const surface = (page) => page.evaluate(readSurface);
const settled = (page) => page.evaluate(() => !!window.__ascent.panelInfo().settled || !window.__ascent.panelInfo().open);

/**
 * WAIT FOR THE SEAL, because the rig seals on a timer.
 *
 * `_sort` and `_area` call `setTimeout(() => self._solve(), 560)` when the last
 * chip lands, and `_balance` 640 ms after the last move. A harness that reads
 * `settled` the instant it finishes placing sees `false`, calls the surface
 * unanswerable, presses Escape — and the pending `_solve` then fires on
 * WHATEVER CARD IS UP NEXT, settling a card nobody answered. Both halves of
 * that were measured here on the frozen build: the sorter reported FAIL after
 * placing all four chips correctly, and the balance card that followed it
 * reported `nothing on the card` because the sorter's timer had sealed it.
 */
async function settleWithin(page, ms = 1400) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await settled(page)) return true;
    await page.waitForTimeout(120);
  }
  return settled(page);
}

/**
 * ANSWER THE CARD THAT IS UP, on whichever of the six surfaces it is on.
 *
 * @param {import('playwright').Page} page
 * @param {{wrong?:boolean, pause?:(ms:number)=>Promise<void>}} [opts]
 * @returns {Promise<{mode:string|null, how:string, acted:boolean, settled:boolean}>}
 *   `acted` is the honest half: FALSE means this harness could not press
 *   anything on that surface, and a caller that counts it as an answered item
 *   is the defect this module exists for.
 */
export async function answerCard(page, opts = {}) {
  const wait = opts.pause || ((ms) => page.waitForTimeout(ms));
  const f = await facts(page);
  if (!f.open || f.settled) return { mode: f.mode, how: 'nothing on the card', acted: false, settled: f.settled, done: true };
  const s = await surface(page);

  /* A narrowed keypad is a field of readings, whatever `mode` still says. */
  const live = s.readings.filter((r) => !r.disabled);
  if (live.length) {
    const want = String(f.answer).replace(/\s+/g, '');
    let pick = live.find((r) => r.v != null && String(r.v).replace(/\s+/g, '') === want);
    if (opts.wrong) pick = live.find((r) => !pick || r.i !== pick.i) || pick;
    await page.locator('.rf-reading').nth((pick || live[0]).i).click({ timeout: 5000 }).catch(() => {});
    await wait(220);
    return { mode: f.mode, how: 'reading', acted: true, settled: await settleWithin(page) };
  }

  if (s.plot) return withPlot(page, f, wait);
  if (s.moves.length) return withBeam(page, f, s, wait);
  if (s.cells.length) return withField(page, f, wait);
  if (s.chips.length && s.bays.length) return withBays(page, f, wait);
  if (s.caps.length) return withPad(page, f, s, wait, !!opts.wrong);
  return { mode: f.mode, how: 'NO SURFACE THIS HARNESS CAN PRESS', acted: false, settled: false };
}

/** The keypad: one click per glyph, on the cap that publishes it. */
async function withPad(page, f, s, wait, wrong = false) {
  const caps = new Set(s.caps);
  let padStr = toPad(f.answer);
  /* A HARNESS THAT MODELS A LEARNER NEEDS TO BE ABLE TO MISS.
     `tools/critic/traffic.mjs` has always asked for a deliberately wrong entry
     on some items — that is what puts an echo on the screen and what makes the
     scheduler behave like it does for a real cadet — so the wrong answer is
     built the same way it built it: one off a number, one glyph on anything
     else. */
  if (wrong && padStr) padStr = /^-?\d+$/.test(padStr) ? String(Number(padStr) + 1) : `${padStr}1`;
  let sign = false;
  if (padStr.startsWith('-') && !caps.has('-') && caps.has('sign')) { sign = true; padStr = padStr.slice(1); }
  const pressed = [];
  for (const ch of padStr) {
    if (caps.has(ch)) {
      await page.locator(`.rf-key[data-g="${ch}"]`).first().click({ timeout: 4000 }).catch(() => {});
      pressed.push(ch);
    } else {
      /* No cap for it: the pad's own key handler takes the same character. */
      await page.keyboard.press(keyFor(ch)).catch(() => {});
      pressed.push(`~${ch}`);
    }
    await wait(30);
  }
  if (sign) { await page.locator('.rf-key[data-g="sign"]').first().click({ timeout: 4000 }).catch(() => {}); pressed.push('±'); }
  await wait(60);
  if (caps.has('seal')) await page.locator('.rf-key[data-g="seal"]').first().click({ timeout: 4000 }).catch(() => {});
  else await page.keyboard.press('Enter');
  await wait(260);
  return { mode: f.mode, how: `keypad ${pressed.join('')}`, acted: pressed.length > 0, settled: await settleWithin(page) };
}
const KEYNAME = { '-': 'Minus', '/': 'Slash', '+': 'Shift+Equal', '^': 'Shift+Digit6', '(': 'Shift+Digit9', ')': 'Shift+Digit0', '=': 'Equal', ',': 'Comma', '*': 'Shift+Digit8' };
const keyFor = (ch) => KEYNAME[ch] || ch;

/**
 * A chip's VARIABLE PART, read off the KaTeX the way an eye reads it.
 * `3x` -> `x`, `-x` -> `x`, `4m^{2}` -> `m^{2}`, `12` -> `` (a bare number).
 */
export const partOfChip = (tex) => {
  const m = /([A-Za-z])(?:\s*\^\s*\{?\s*(\d+)\s*\}?)?\s*$/.exec(String(tex || ''));
  if (!m) return '';
  return m[2] && m[2] !== '1' ? `${m[1]}^{${m[2]}}` : m[1];
};

/**
 * The sorting bays: a chip goes in the bay whose header is its variable part.
 *
 * This used to read `/[A-Za-z]/.test(chip.tex)` and press the bay whose
 * `data-kind` was `var` or `num`, because the board had exactly two bays and
 * they were exactly those two glyph classes. `src/ui/rift.js` draws one bay per
 * LIKE-CLASS now — `x`, `x^{2}`, `y`, the numbers — so a chip with a letter on
 * it can belong in any of three of them, and the old rule would miss on most of
 * the board, leave the card unsettled, and count an item as answered. The bay
 * publishes its own variable part in `data-kind`, which is the header printed
 * on it; the chip publishes nothing, and this reads the part off the chip.
 */
async function withBays(page, f, wait) {
  let moved = 0;
  for (let k = 0; k < 14; k++) {
    const s = await surface(page);
    const chip = s.chips.find((c) => !c.placed);
    if (!chip) break;
    const bayAt = s.bays.indexOf(partOfChip(chip.tex));
    if (bayAt < 0) break;
    await page.locator('.rf-chip').nth(chip.i).click({ timeout: 4000 }).catch(() => {});
    await wait(70);
    await page.locator('.rf-bay').nth(bayAt).click({ timeout: 4000 }).catch(() => {});
    moved++;
    await wait(130);
    if (await settled(page)) break;
  }
  return { mode: f.mode, how: `bays ${moved} chip(s)`, acted: moved > 0, settled: await settleWithin(page) };
}

/**
 * The area field: the two parts of the rectangle are the two terms of the
 * answer. `_area` closes over which cell wants which — deliberately, because
 * writing it on the cell handed the answer away — so the chip is matched on the
 * value it PRINTS, which is what a cadet matches on too.
 */
async function withField(page, f, wait) {
  const { varTerm, numTerm } = splitArea(f.answer);
  let moved = 0;
  for (const [want, cls] of [[varTerm, 'a'], [numTerm, 'b']]) {
    if (want == null) continue;
    const s = await surface(page);
    const norm = (x) => String(x ?? '').replace(/\s+/g, '');
    const chip = s.chips.find((c) => !c.placed && (norm(c.value) === norm(want) || norm(c.tex) === norm(want)));
    const cell = s.cells.find((c) => !c.filled && new RegExp(`\\b${cls}\\b`).test(c.cls));
    if (!chip || !cell) continue;
    await page.locator('.rf-chip').nth(chip.i).click({ timeout: 4000 }).catch(() => {});
    await wait(80);
    await page.locator('.rf-cell').nth(cell.i).click({ timeout: 4000 }).catch(() => {});
    moved++;
    await wait(160);
    if (await settled(page)) break;
  }
  return { mode: f.mode, how: `field ${moved} part(s)`, acted: moved > 0, settled: await settleWithin(page) };
}

/**
 * The balance beam: read the live statement off the head of the rig — which is
 * the equation, not a caption — work out the move that takes ground off it, and
 * press the button that carries that move. Up to six moves, because
 * `_balance` refuses any beam more than four moves from solved.
 */
async function withBeam(page, f, s0, wait) {
  let moves = 0;
  let stuck = 0;
  let s = s0;
  for (let k = 0; k < 12; k++) {
    const before = s.beam;
    const st = parseBeam(s.beam);
    let at = -1;
    if (st) {
      const want = idealMove(st);
      if (want) at = s.moves.findIndex((mv) => sameOp(parseOp(mv.tex, st.v), want));
    }
    /* Nothing recognised: press the tray in order rather than stand still. A
       wrong move on this beam is legal algebra and is undoable, so a harness
       that cannot read the tray still gets the sitting moving. */
    if (at < 0) at = moves % Math.max(1, s.moves.length);
    await page.locator('.rf-move').nth(at).click({ timeout: 4000 }).catch(() => {});
    moves++;
    await wait(700);
    if (await settled(page)) break;
    s = await surface(page);
    if (!s.moves.length) break;
    /* A PRESS THAT DID NOT TAKE IS PRESSED AGAIN, which is what a hand does.
       The rig re-renders the whole tray 460 ms after a move and runs a settle
       animation over it, and a click that lands inside that window is swallowed:
       measured on the frozen build, one press in five on `two-step/ts-symbolic`
       left the beam at `7n = -21` with the identical tray. A harness that reads
       that as "the surface refuses me" reports a balance card it solved as
       unanswerable. */
    if (s.beam === before) { stuck++; if (stuck >= 4) break; } else stuck = 0;
  }
  return { mode: f.mode, how: `beam ${moves} move(s)`, acted: moves > 0, settled: await settleWithin(page) };
}

/**
 * The coordinate plot, on the keys the surface itself publishes: `1` and `2`
 * choose a knob, the arrows walk it one lattice square at a time, `Enter`
 * seals. The scale is MEASURED rather than assumed — one press of ArrowRight,
 * and the knob's own `cx` says how many SVG units a square is worth.
 */
async function withPlot(page, f, wait) {
  const line = parseLine(f.answer);
  const knobs = () => page.evaluate(() => {
    const svg = document.querySelector('.rf-plot-stage svg');
    const box = svg?.viewBox?.baseVal;
    return {
      S: box ? box.width : 0,
      at: [...document.querySelectorAll('.rf-plot-stage .knob-hit')].map((c) => ({
        cx: Number(c.getAttribute('cx')), cy: Number(c.getAttribute('cy')),
      })),
    };
  });
  const a0 = await knobs();
  if (!line || a0.at.length < 2 || !a0.S) {
    return { mode: f.mode, how: 'plot: could not read the chart', acted: false, settled: false };
  }
  await page.keyboard.press('Digit1');
  await wait(60);
  await page.keyboard.press('ArrowRight');
  await wait(90);
  const a1 = await knobs();
  const k = Math.abs(a1.at[0].cx - a0.at[0].cx);
  if (!k) return { mode: f.mode, how: 'plot: the chart did not answer a key press', acted: false, settled: false };
  await page.keyboard.press('ArrowLeft');
  await wait(90);
  const O = a0.S / 2;
  const dataOf = (c) => ({ x: Math.round((c.cx - O) / k), y: Math.round((O - c.cy) / k) });
  /* HOW WIDE THE CHART IS, READ OFF THE CHART. `chartLattice` puts the origin
     at S/2 and draws the axis from `pad` to `S - pad`, so the axis path itself
     carries the padding and the reach is (S/2 - pad) / k squares. Reading it
     rather than assuming a fixed range matters: the bank draws plus-or-minus
     6, 8 and 9 charts, and a knob walked past the wall is clamped, so the line
     never arrives and the card never settles. */
  const pad = await page.evaluate(() => {
    const d = document.querySelector('.rf-plot-stage path.ax')?.getAttribute('d') || '';
    const m = /^M[\d.]+\s+([\d.]+)\s+V/.exec(d);
    return m ? Number(m[1]) : null;
  });
  const R = pad == null ? 6 : Math.max(2, Math.round((O - pad) / k));
  const wantPair = plotPoints(line, R);
  let steps = 0;
  for (let i = 0; i < 2; i++) {
    const now = dataOf((await knobs()).at[i]);
    const want = wantPair[i];
    await page.keyboard.press(i === 0 ? 'Digit1' : 'Digit2');
    await wait(60);
    for (let n = 0; n < Math.abs(want.x - now.x) && n < 64; n++) { await page.keyboard.press(want.x > now.x ? 'ArrowRight' : 'ArrowLeft'); steps++; await wait(22); }
    for (let n = 0; n < Math.abs(want.y - now.y) && n < 64; n++) { await page.keyboard.press(want.y > now.y ? 'ArrowUp' : 'ArrowDown'); steps++; await wait(22); }
  }
  await page.keyboard.press('Enter');
  await wait(260);
  return { mode: f.mode, how: `plot ${steps} step(s) to y = ${line.m}x + ${line.b}`, acted: steps > 0, settled: await settleWithin(page) };
}

/**
 * Two lattice points on `y = mx + b` that both fit inside a chart of ±range.
 * @returns {{x:number,y:number}[]}
 */
export function plotPoints(line, range) {
  const on = [];
  for (let x = -range; x <= range; x++) {
    const y = line.m * x + line.b;
    if (Number.isInteger(y) && Math.abs(y) <= range) on.push({ x, y });
    if (on.length === 2 && on[1].x !== on[0].x) break;
  }
  if (on.length >= 2) return [on[0], on[on.length - 1]];
  return [{ x: 0, y: Math.max(-range, Math.min(range, line.b)) },
    { x: 1, y: Math.max(-range, Math.min(range, line.m + line.b)) }];
}

/* ===========================================================================
   --self-test: the readers, planted in both directions. No browser, ~0.2 s.
   The half that needs a browser is run by check:motion on every ordinary run,
   against the real build — see `proveSurfaces` there.
   =========================================================================== */
async function selfTest() {
  let bad = 0;
  const ok = (m) => console.log(`  ok   ${m}`);
  const flag = (m) => { console.error(` FAIL ${m}`); bad++; };
  const is = (got, want, why) => { if (JSON.stringify(got) !== JSON.stringify(want)) flag(`${why}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); else ok(why); };

  console.log('the readers a harness presses the buttons with\n');

  console.log('the keypad alphabet');
  is(toPad('10n + 30'), '10n+30', 'a plain expression loses only its spaces');
  is(toPad('\\frac{3}{4}'), '3/4', 'a fraction becomes the pad\'s own bar');
  is(toPad('5\\left(2n + 6\\right)'), '5(2n+6)', 'the bank\'s brackets become the pad\'s brackets');
  is(toPad('x^{2} - 6x + 11'), 'x^2-6x+11', 'a power loses its braces, which the pad has no key for');
  is(toPad('\\sqrt{244}'), '√244', 'a radical becomes the cap the pad draws');

  console.log('\nthe area field — which chip covers which part of the rectangle');
  is(splitArea('10n + 30'), { varTerm: '10n', numTerm: '30' }, 'the two terms of the answer are the two parts of the field');
  is(splitArea('10n - 30'), { varTerm: '10n', numTerm: '-30' }, 'A NEGATIVE CONSTANT KEEPS ITS SIGN — `_area` wants String(k*b), not the printed "- 30"');
  is(splitArea('-n + 4'), { varTerm: '-n', numTerm: '4' }, 'a bare negative unknown keeps its sign and its letter');

  console.log('\nthe coordinate plot');
  is(parseLine('y = 3x + 1'), { m: 3, b: 1 }, 'a line reads back as its rate and its start');
  is(parseLine('y = -2x - 5'), { m: -2, b: -5 }, 'both signs survive');
  is(parseLine('y = x'), { m: 1, b: 0 }, 'an implicit 1 and an absent constant');
  is(parseLine('7'), null, 'something that is not a line reads as nothing, rather than as a guess');
  for (const [ln, range, why] of [
    [{ m: 3, b: 1 }, 6, 'a small chart'], [{ m: 4, b: 2 }, 8, 'a steep line'],
    [{ m: -2, b: -5 }, 9, 'a falling line'], [{ m: 0, b: 3 }, 6, 'a level line'],
    [{ m: 1, b: 0 }, 4, 'a line through the origin']]) {
    const ps = plotPoints(ln, range);
    const onLine = ps.every((q) => ln.m * q.x + ln.b === q.y);
    const inChart = ps.every((q) => Math.abs(q.x) <= range && Math.abs(q.y) <= range);
    const distinct = ps[0].x !== ps[1].x;
    if (onLine && inChart && distinct) ok(`${why}: two distinct lattice points, both ON the line and both INSIDE the chart — ${JSON.stringify(ps)}`);
    else flag(`${why}: ${JSON.stringify(ps)} (on the line ${onLine}, inside ${inChart}, distinct ${distinct})`);
  }

  console.log('\nthe balance beam');
  is(parseBeam('3x + 4 = 19'), { v: 'x', L: { a: fr(3), b: fr(4) }, R: { a: fr(0), b: fr(19) } }, 'the live statement at the head of the rig reads back as the beam');
  is(parseBeam('\\frac{3}{2}x - 5 = 4x'), { v: 'x', L: { a: fr(3, 2), b: fr(-5) }, R: { a: fr(4), b: fr(0) } }, 'a fractional coefficient survives, exactly');
  is(idealMove(parseBeam('3x + 4 = 19')), { kind: 'const', f: fr(-4) }, 'the ideal first move on 3x + 4 = 19 is to take 4 off both pans');
  is(idealMove(parseBeam('3x = 12')), { kind: 'div', f: fr(3) }, '…and then to divide by 3');
  is(idealMove(parseBeam('5x + 2 = 2x + 11')), { kind: 'var', f: fr(-2) }, 'unknowns on both sides: the SMALLER one moves');
  is(parseOp('+\\; 4'), { kind: 'const', f: fr(4) }, 'a constant move reads off its own button');
  is(parseOp('-\\; 3x', 'x'), { kind: 'var', f: fr(-3) }, 'a variable move reads off its own button');
  is(parseOp('-\\; x', 'x'), { kind: 'var', f: fr(-1) }, 'the one move on the beam with no digit on it');
  is(parseOp('\\div\\; 2'), { kind: 'div', f: fr(2) }, 'division, in English notation');
  is(parseOp(':\\; 2'), { kind: 'div', f: fr(2) }, 'a bare colon, which nothing ships but every reader of this file expects');
  /* AND THE ONE THE SHIPPED TRAY ACTUALLY PRINTS IN TWO OF THE THREE LOCALES.
     The line above was written by hand and passed, so this rule read as proved
     in Spanish and Polish while `\\mathbin{:}\\; 7` — what `mathOp('div')`
     really is there (src/i18n/index.js:144) — parsed as null on every button
     of every beam. Cut off the frozen build, es and pl, one-step-mul. */
  is(parseOp('\\mathbin{:}\\; 7'), { kind: 'div', f: fr(7) }, 'AND IN POLISH AND SPANISH — the colon is WRAPPED, and a harness that only knows \\div and a bare colon cannot play a beam in two of the three shipped locales');
  is(parseOp('\\mathbin{:}\\; -11'), { kind: 'div', f: fr(-11) }, '…including the negative unwrap, off the same tray');
  /* THE EXACT STRINGS THE SHIPPED TRAY PRINTED, cut off the real build. The
     first cut of this reader wrote `\;` inside a JavaScript string literal,
     which is just a semicolon — so the regex that was meant to strip KaTeX's
     thin space stripped nothing, `-\; 6` parsed as null, EVERY move on EVERY
     beam came back unrecognised, and the harness fell back to clicking the
     tray in order for eight moves without solving anything. The self-test
     passed, because it had the same missing backslash in it. */
  for (const [raw, want, why] of [
    ['-\\; 6', { kind: 'const', f: fr(-6) }, 'take 6 off both pans'],
    ['\\div\\; -7', { kind: 'div', f: fr(-7) }, 'unwrap by a negative coefficient'],
    ['-\\; \\frac{7}{3}n', { kind: 'var', f: fr(-7, 3) }, 'move a fractional multiple of the unknown'],
    ['\\div\\; \\frac{7}{3}', { kind: 'div', f: fr(7, 3) }, 'unwrap by a fraction'],
    ['+\\; \\frac{7}{3}', { kind: 'const', f: fr(7, 3) }, 'add a fraction to both pans'],
  ]) is(parseOp(raw, 'n'), want, `off the real tray: ${raw} — ${why}`);
  if (sameOp(parseOp('+\\; 4'), { kind: 'const', f: fr(4) })) ok('a button and the ideal move are matched on what they DO, not on their spelling');
  else flag('the move matcher does not recognise its own parse');
  if (!sameOp(parseOp('+\\; 4'), { kind: 'const', f: fr(-4) })) ok('…and + 4 is not - 4, which is the sign slip this beam is full of');
  else flag('the move matcher cannot tell + 4 from - 4');

  console.log('\nAND THE FAULT THIS MODULE EXISTS FOR — a strategy that presses nothing');
  /* The old motion.mjs branch, as a predicate over the same DOM description:
     "click the first .rf-move, .rf-cell or .ans". Given an area field, it finds
     a `.rf-cell` and clicks it — and `src/ui/rift.js:3949` returns early when
     no chip is picked, so nothing happens and the card never settles. */
  const areaDom = { readings: [], chips: [{ i: 0, tex: '10n', value: '10n', placed: false }, { i: 1, tex: '30', value: '30', placed: false }], bays: [], cells: [{ i: 0, cls: 'rf-cell a', filled: false }, { i: 1, cls: 'rf-cell b', filled: false }], moves: [], caps: [], beam: '', plot: false };
  const oldWay = (dom) => (dom.chips.length && dom.bays.length ? 'bays' : dom.cells.length || dom.moves.length ? 'one blind click' : 'type');
  const newWay = (dom) => (dom.plot ? 'plot' : dom.moves.length ? 'beam' : dom.cells.length ? 'field' : dom.chips.length && dom.bays.length ? 'bays' : dom.caps.length ? 'keypad' : 'nothing');
  if (oldWay(areaDom) === 'one blind click') ok('the OLD strategy answers an area field with one blind click on a cell — which src/ui/rift.js ignores');
  else flag('the old strategy was mis-stated; this leg proves nothing');
  if (newWay(areaDom) === 'field') ok('…and the new one takes it to the field: pick the chip that prints the term, then cover that part of the rectangle');
  else flag('the new strategy does not route an area field to the field player');
  const plotDom = { ...areaDom, chips: [], cells: [], plot: true };
  if (oldWay(plotDom) === 'type') ok('the OLD strategy TYPES `y = 3x + 1` at a coordinate plot, which has no socket to type into');
  else flag('the old plot branch was mis-stated');
  if (newWay(plotDom) === 'plot') ok('…and the new one walks the knobs with the arrow keys the surface publishes');
  else flag('the new strategy does not route a plot to the plot player');

  console.log('');
  if (bad) { console.error(`self-test: ${bad} failure(s)`); process.exit(1); }
  console.log('self-test: ok — every surface reads back into an action, and the strategy that pressed nothing is named\n');
  return 0;
}

if (process.argv[1] && process.argv.includes('--self-test')) {
  const { realpathSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  if (realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) process.exit(await selfTest());
}
