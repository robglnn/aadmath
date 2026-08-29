/**
 * BLIND CRITIC · the shape lab.
 *
 * Written from scratch for this audit. It mounts the REAL RiftPanel, puts a
 * real item on it, and then plays a cadet WHO DOES NO MATHEMATICS: every move
 * it makes is chosen from what is printed on the glass — order, position,
 * length, digit count, size, sign, which button exists, words versus numerals.
 *
 * The verdict is not read off a model of the surface. It is read off the
 * panel's own two flags after real clicks:
 *
 *     panel._settled   the rift sealed
 *     panel.assisted   at least one miss was recorded
 *
 * `_settled && !assisted` is exactly the condition `mastery.observe` advances a
 * proving run on. A shape rule that reaches it has mastered the node without
 * the mathematics.
 */
import 'katex/dist/katex.min.css';
import { RiftPanel } from '../../../src/ui/rift.js';
import { generate, SKILLS } from '../../../src/learn/generators.js';
import { registerPack } from '../../../src/content/registry.js';
import manifest from '../../../content/courses.json';
import { ITEM_BUNDLES } from '../../../src/learn/strings.js';
import { setLocale } from '../../../src/i18n/index.js';

const PACKS = import.meta.glob('../../../src/content/packs/*.js', { eager: true, import: 'default' });
for (const course of manifest.courses) {
  for (const unit of course.units || []) {
    if (!unit.pack) continue;
    const pack = PACKS[`../../../src/content/packs/${unit.pack}.js`];
    if (!pack) throw new Error(`manifest names a missing pack: ${unit.pack}`);
    registerPack(pack);
  }
}

const root = document.getElementById('app');
const panel = new RiftPanel(root);

function show(item) {
  deferred = [];
  panel.show(item, {
    title: '', skillId: item.skill, tier: 0, kind: 'learn',
    scaffold: 'none', example: null, streak: 0,
    onAnswer() { return { gained: 1, pL: 1, prev: 0.5 }; },
    onClose() {},
  });
  flush();
}

// ---------------------------------------------------------------- reading it
const SKIP = ['katex-mathml', 'pstrut', 'vlist-s', 'frac-line', 'key', 'hintmark', 'strut', 'sizing-reset'];
function readNode(node, out) {
  if (node.nodeType === 3) { out.push(node.nodeValue); return; }
  if (node.nodeType !== 1) return;
  for (const c of SKIP) if (node.classList.contains(c)) return;
  if (node.classList.contains('mfrac')) {
    const vlist = node.querySelector('.vlist');
    if (vlist) {
      const parts = [...vlist.children].map((c) => { const o = []; readNode(c, o); return o.join('').trim(); }).filter((s) => s.length);
      out.push(`(${parts.reverse().join(')/(')})`);
      return;
    }
  }
  if (node.classList.contains('sqrt')) {
    const inner = []; for (const c of node.childNodes) readNode(c, inner);
    out.push(`√(${inner.join('').trim()})`); return;
  }
  for (const c of node.childNodes) readNode(c, out);
}
const seen = (el) => { const o = []; readNode(el, o); return o.join('').normalize('NFD').replace(/[̀-ͯʰ-˿]/g, '').replace(/[−‒–—‐‑]/g, '-').replace(/[\s   ​⁡]/g, '').trim(); };

/**
 * DEFERRED WORK, RUN NOW.
 *
 * Three of the six surfaces seal on a timer — the bays after 560 ms, the field
 * after 600, the beam after 640 — and the beam refuses a second move while its
 * own 460 ms settle is outstanding. A harness that does not flush those is a
 * harness that reads every sorting board as unsealed and every beam as one move
 * long, which is the shape of instrument this project has already been burned
 * by twice. Nothing about the seal changes: `_solve()` is the same function and
 * the same flags come out of it. Only the wait is skipped, and `--slow` re-runs
 * a sample with the real clock to prove the two agree.
 */
const realTimeout = window.setTimeout.bind(window);
let deferred = null;
window.setTimeout = (fn, ms, ...a) => {
  if (deferred && typeof fn === 'function' && (ms || 0) <= 1200) { deferred.push(fn); return 0; }
  return realTimeout(fn, ms, ...a);
};
function flush() {
  // Bounded, and then EMPTIED. The rig's own drifting motes re-arm themselves on
  // a timer, so an unbounded flush is an infinite loop with a growing queue
  // behind it; four generations is more than the deepest seal chain the game
  // schedules (place -> _solve -> sealing) and anything still pending after
  // that is decoration.
  for (let i = 0; i < 4 && deferred && deferred.length; i++) {
    const q = deferred.splice(0, 400);
    for (const f of q) { try { f(); } catch { /* the game's own animation */ } }
  }
  if (deferred && deferred.length > 400) deferred.length = 0;
}

/**
 * A tap, the way a hand makes one. `pointerdown` + `pointerup` drives the
 * draggable chips and moves; the `click` carries `detail: 1` so the document's
 * keyboard-only handler (`detail === 0`) does not fire onTap a SECOND time and
 * un-pick the chip that was just picked.
 */
function click(el) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 1, clientY: 1, button: 0 }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 1, clientY: 1, button: 0 }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  flush();
}

// ------------------------------------------------- what a shape cadet can see
/** Printed length, digit count, sign, numerals-versus-words, numeric size. */
function shapeOf(text) {
  const s = String(text);
  const digits = (s.match(/[0-9]/g) || []).length;
  const num = (() => { const m = s.match(/-?\d+(?:\.\d+)?/g); if (!m) return null; return Number(m[0]); })();
  return {
    text: s, len: s.length, digits,
    minus: /-/.test(s) ? 1 : 0,
    letters: (s.match(/[A-Za-zÀ-ɏ]/g) || []).length,
    words: /[A-Za-zÀ-ɏ]{3,}/.test(s) ? 1 : 0,
    num, absNum: num == null ? null : Math.abs(num),
  };
}

// ----------------------------------------------------------------- the rules
/** Every rule picks an INDEX out of a list of shapes. Ties break to the first. */
const pickers = {
  first: (a) => 0,
  second: (a) => (a.length > 1 ? 1 : 0),
  third: (a) => (a.length > 2 ? 2 : 0),
  last: (a) => a.length - 1,
  longest: (a) => argmax(a, (x) => x.len),
  shortest: (a) => argmin(a, (x) => x.len),
  mostDigits: (a) => argmax(a, (x) => x.digits),
  fewestDigits: (a) => argmin(a, (x) => x.digits),
  noMinus: (a) => { const i = a.findIndex((x) => !x.minus); return i < 0 ? 0 : i; },
  hasMinus: (a) => { const i = a.findIndex((x) => x.minus); return i < 0 ? 0 : i; },
  biggest: (a) => argmax(a, (x) => (x.num == null ? -Infinity : x.num)),
  smallest: (a) => argmin(a, (x) => (x.num == null ? Infinity : x.num)),
  biggestAbs: (a) => argmax(a, (x) => (x.absNum == null ? -Infinity : x.absNum)),
  smallestAbs: (a) => argmin(a, (x) => (x.absNum == null ? Infinity : x.absNum)),
  middleAbs: (a) => middleBy(a, (x) => (x.absNum == null ? 0 : x.absNum)),
  middleLen: (a) => middleBy(a, (x) => x.len),
  hasLetter: (a) => { const i = a.findIndex((x) => x.letters > 0); return i < 0 ? 0 : i; },
  noLetter: (a) => { const i = a.findIndex((x) => x.letters === 0); return i < 0 ? 0 : i; },
  oddOneOut: (a) => {
    // furthest from the set's mean on (len, digits, minus, letters)
    const f = (x) => [x.len, x.digits, x.minus * 3, x.letters];
    const mean = [0, 1, 2, 3].map((k) => a.reduce((s, x) => s + f(x)[k], 0) / a.length);
    return argmax(a, (x) => f(x).reduce((s, val, k) => s + Math.abs(val - mean[k]), 0));
  },
};
function argmax(a, f) { let b = 0; for (let i = 1; i < a.length; i++) if (f(a[i]) > f(a[b])) b = i; return b; }
function argmin(a, f) { let b = 0; for (let i = 1; i < a.length; i++) if (f(a[i]) < f(a[b])) b = i; return b; }
function middleBy(a, f) {
  const ix = a.map((x, i) => i).sort((i, j) => f(a[i]) - f(a[j]) || i - j);
  return ix[Math.floor((ix.length - 1) / 2)];
}

// ---------------------------------------------------------------- the surfaces
function surfaceOf() {
  const el = panel.el;
  if (el.querySelector('.rf-readings')) return 'choice';
  if (el.querySelector('.rf-plot')) return 'plot';
  if (el.querySelector('.rf-bal')) return 'balance';
  if (el.querySelector('.rf-field')) return 'area';
  if (el.querySelector('.rf-bays')) return 'sort';
  return 'keypad';
}

/** One card, one rule, played to the end. Returns the panel's own two flags. */
function playChoice(rule) {
  const opts = [...panel.el.querySelectorAll('.rf-readings .rf-reading')];
  if (opts.length < 2) return null;
  const shapes = opts.map((b) => shapeOf(seen(b)));
  const i = pickers[rule](shapes);
  click(opts[i]);
  return { sealed: !!panel._settled, assisted: !!panel.assisted, n: opts.length, pick: i };
}

/**
 * The sorting bays. A rule says which bay each loose chip goes into, IN THE
 * ORDER THE CHIPS ARE PRINTED. `alternate` is the rule the last round named.
 */
function playSort(rule) {
  const bays = [...panel.el.querySelectorAll('.rf-bay')];
  if (bays.length !== 2) return null;
  const bayText = bays.map((b) => seen(b.querySelector('.name')));
  // The unknown's letter, as PRINTED on the bay header — never read off the item.
  const letter = (bayText[0].match(/[A-Za-zÀ-ɏ]/) || [''])[0];
  let guard = 0;
  const order = [];
  while (guard++ < 40) {
    const chips = [...panel.el.querySelectorAll('.rf-tray .rf-chip:not([disabled])')];
    if (!chips.length) break;
    const chip = chips[0];
    const txt = seen(chip);
    let side;
    if (rule === 'alternate') side = order.length % 2;
    else if (rule === 'alternateRight') side = 1 - (order.length % 2);
    else if (rule === 'allLeft') side = 0;
    else if (rule === 'allRight') side = 1;
    else if (rule === 'letterMatch') side = letter && txt.includes(letter) ? 0 : 1;
    else if (rule === 'anyLetter') side = /[A-Za-zÀ-ɏ]/.test(txt) ? 0 : 1;
    else if (rule === 'longToLeft') side = txt.length >= 3 ? 0 : 1;
    else if (rule === 'minusToLeft') side = /-/.test(txt) ? 0 : 1;
    else side = 0;
    order.push(side);
    click(chip);
    click(bays[side]);
    if (panel._settled) break;
    // a refused drop leaves the chip loose; guard advances so we cannot spin
    if (!chip.disabled && panel.assisted && rule !== 'probe') {
      // the rule is wrong about this chip; a shape cadet has already paid the
      // miss, and would then try the other bay. Do that, so the run terminates.
      click(chip); click(bays[1 - side]);
      if (panel._settled) break;
      if (!chip.disabled) break;
    }
  }
  return { sealed: !!panel._settled, assisted: !!panel.assisted, wrong: panel.wrongCount, chips: order.length };
}

/** The area field: one chip into the left cell, one into the right. */
function playArea(rule) {
  const cells = [...panel.el.querySelectorAll('.rf-cell')];
  if (cells.length !== 2) return null;
  const wl = [...panel.el.querySelectorAll('.fld-widths .wlab')].map((e) => seen(e));
  const letter = ((wl[0] || '').match(/[A-Za-zÀ-ɏ]/) || [''])[0];
  const cellOk = [];
  for (let ci = 0; ci < 2; ci++) {
    const chips = [...panel.el.querySelectorAll('.rf-tray .rf-chip:not([disabled])')];
    if (!chips.length) break;
    // The cadet knows only that the left cell stands under a width with a
    // letter in it and the right one under a width without: a glyph match.
    const kinded = chips.filter((c) => (ci === 0
      ? (letter && seen(c).includes(letter))
      : !/[A-Za-zÀ-ɏ]/.test(seen(c))));
    const use = kinded.length ? kinded : chips;
    const shapes = use.map((c) => shapeOf(seen(c)));
    const i = pickers[rule] ? pickers[rule](shapes) : 0;
    const before = panel.wrongCount;
    click(use[i]);
    click(cells[ci]);
    cellOk.push(panel.wrongCount === before);
    if (panel._settled) break;
  }
  return { sealed: !!panel._settled, assisted: !!panel.assisted, wrong: panel.wrongCount, cellOk };
}

/** The move tray, played move after move until the beam settles or stalls. */
function playBalance(rule) {
  let guard = 0;
  const picks = [];
  while (guard++ < 12 && !panel._settled) {
    const tray = [...panel.el.querySelectorAll('.rf-move')];
    if (!tray.length) break;
    const texts = tray.map((b) => seen(b));
    const shapes = texts.map((tx) => shapeOf(tx));
    let i;
    if (rule === 'divideIfPresent') {
      // "÷" in EN, ":" in es/pl — the operator, whatever it is drawn as.
      const d = shapes.findIndex((s) => /[÷:\/]/.test(s.text));
      i = d < 0 ? 0 : d;
    } else i = pickers[rule](shapes);
    const good = goodMoves(panel._modality.stateTex(), texts);
    picks.push({ i, n: tray.length, good: good ? !!good[i] : null,
      nGood: good ? good.filter(Boolean).length : null,
      nDiv: shapes.filter((s) => /[÷:\/]/.test(s.text)).length });
    click(tray[i]);
    // the tray re-renders after ~460ms in play; in the lab it is synchronous
    // enough that a re-read is honest, but a stalled tray must not spin.
    if (panel.el.querySelectorAll('.rf-move').length === 0 && !panel._settled) break;
  }
  return { sealed: !!panel._settled, assisted: !!panel.assisted, wrong: panel.wrongCount, moves: picks };
}

/** The plot: put each knob on a marked reading, then press SET. */
function oraclePlot(item) {
  const svg = panel.el.querySelector('.rf-plot svg');
  const fig = item.figure;
  if (!svg || !fig?.target) return { ok: false, why: 'no plot' };
  const m = fig.target.m, b = fig.target.b;
  const mv = typeof m === 'object' ? m.n / m.d : Number(m);
  const bv = typeof b === 'object' ? b.n / b.d : Number(b);
  const R = (fig.range && (fig.range.max ?? fig.range)) || 10;
  const pts = [];
  for (let x = -R; x <= R && pts.length < 2; x++) {
    const y = mv * x + bv;
    if (Number.isInteger(y) && Math.abs(y) <= R) pts.push({ x, y });
  }
  if (pts.length < 2) return { ok: false, why: 'the line has under two lattice points on the chart' };
  return placeKnobs(pts.map((p) => ({ x: p.x, y: p.y })), true);
}
/** Put the two knobs on two chart positions given in LATTICE coordinates. */
function placeKnobs(latticePts, commitIt) {
  const svg = panel.el.querySelector('.rf-plot svg');
  const knobs = [...svg.querySelectorAll('circle.knob-hit')];
  const commit = panel.el.querySelector('.rf-plot-bar .commit');
  // The chart's own transform, measured off a marked reading rather than assumed.
  const anchors = [...svg.querySelectorAll('circle.anchor')];
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  // Two lattice lines give the scale: read the gridline spacing off the labels.
  const labels = [...svg.querySelectorAll('text')];
  const nums = labels.map((tn) => ({ v: Number(tn.textContent), x: +tn.getAttribute('x'), y: +tn.getAttribute('y') }))
    .filter((o) => Number.isFinite(o.v) && o.v !== 0);
  if (nums.length < 2) return { ok: false, why: 'no numbered ticks' };
  // x-axis labels share a y; y-axis labels share an x.
  const byY = {}; for (const o of nums) (byY[Math.round(o.y)] = byY[Math.round(o.y)] || []).push(o);
  const row = Object.values(byY).sort((a, b2) => b2.length - a.length)[0];
  if (!row || row.length < 2) return { ok: false, why: 'cannot read the x scale' };
  row.sort((a, b2) => a.v - b2.v);
  const k = (row[row.length - 1].x - row[0].x) / (row[row.length - 1].v - row[0].v);
  const x0 = row[0].x - k * row[0].v;
  const byX = {}; for (const o of nums) (byX[Math.round(o.x)] = byX[Math.round(o.x)] || []).push(o);
  const col = Object.values(byX).sort((a, b2) => b2.length - a.length)[0];
  if (!col || col.length < 2) return { ok: false, why: 'cannot read the y scale' };
  col.sort((a, b2) => a.v - b2.v);
  const ky = (col[col.length - 1].y - col[0].y) / (col[col.length - 1].v - col[0].v);
  const y0 = col[0].y - ky * col[0].v;
  const toClient = (p) => ({
    x: box.left + ((x0 + k * p.x) / vb.width) * box.width,
    y: box.top + ((y0 + ky * p.y) / vb.height) * box.height,
  });
  for (let i = 0; i < 2 && i < latticePts.length; i++) {
    const kb = knobs[i]; const c = toClient(latticePts[i]);
    kb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: c.x, clientY: c.y, button: 0 }));
    kb.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: c.x + 20, clientY: c.y + 20 }));
    kb.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: c.x, clientY: c.y }));
    kb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: c.x, clientY: c.y, button: 0 }));
    flush();
  }
  const reads = seen(panel.el.querySelector('.rf-plot-read .val'));
  if (commitIt && commit && !commit.disabled) { click(commit); }
  return { ok: !!panel._settled && !panel.assisted, sealed: !!panel._settled, assisted: !!panel.assisted, reads };
}

function playPlot(rule) {
  const svg = panel.el.querySelector('.rf-plot svg');
  if (!svg) return null;
  const anchors = [...svg.querySelectorAll('circle.anchor')].map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }));
  const knobs = [...svg.querySelectorAll('circle.knob-hit')];
  const commit = panel.el.querySelector('.rf-plot-bar .commit');
  if (!knobs.length || !commit) return null;
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const toClient = (p) => ({
    x: box.left + (p.x / vb.width) * box.width,
    y: box.top + (p.y / vb.height) * box.height,
  });
  const use = anchors.slice(0, 2);
  if (use.length < 2) return { sealed: false, assisted: !!panel.assisted, anchors: anchors.length, why: 'under two marked readings' };
  for (let i = 0; i < 2; i++) {
    const k = knobs[i];
    const c = toClient(use[i]);
    k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: c.x, clientY: c.y, button: 0 }));
    k.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: c.x + 20, clientY: c.y + 20 }));
    k.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: c.x, clientY: c.y }));
    k.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: c.x, clientY: c.y, button: 0 }));
    flush();
  }
  click(commit);
  return { sealed: !!panel._settled, assisted: !!panel.assisted, anchors: anchors.length };
}

/** Two honest misses, then the narrowed field the keypad falls back on. */
function forceNarrow() {
  for (const w of ['987654', '765432', '654321']) {
    if (panel._settled) return false;
    if (!panel._modality?.set) return false;
    panel._modality.set(w);
    panel._modality.submit();
    if (panel._settled) return false;
    if (panel.el.querySelector('.rf-narrow')) return true;
  }
  return !!panel.el.querySelector('.rf-narrow');
}
function playNarrow(rule) {
  const opts = [...panel.el.querySelectorAll('.rf-narrow .rf-reading')];
  if (opts.length < 2) return null;
  const shapes = opts.map((b) => shapeOf(seen(b)));
  const i = pickers[rule](shapes);
  const before = panel.wrongCount;
  click(opts[i]);
  // The field only exists after two honest misses, so `assisted` is already
  // true and can never be the test here. What it buys is a SEAL — motes, a
  // rift closed, the session advanced — on no mathematics.
  return { sealed: !!panel._settled, n: opts.length, pick: i, firstPick: panel.wrongCount === before };
}

// ------------------------------------------ a SECOND reading of the beam
/**
 * The balance, re-derived. Nothing here is cut from src/ui/rift.js: it reads
 * the LIVE statement the rig prints at the head of the card, solves it with its
 * own arithmetic, and decides for itself which of the printed moves is the one
 * that gains ground. It exists so that "the shape rule found the ideal move"
 * is a claim two independent implementations agree on.
 */
function readStatement(txt) {
  // `stateTex()` hands back notation, so the fractions are unstacked first.
  const s2 = String(txt)
    .replace(/\\left|\\right/g, '')
    .replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, (m0, n0, d0) => `(${n0})/(${d0})`)
    .replace(/\s/g, '');
  const parts = s2.split('=');
  if (parts.length !== 2) return null;
  const side = (str) => {
    let a = 0, b = 0;
    const toks = str.match(/[+-]?[^+-]+/g);
    if (!toks) return null;
    for (const tk of toks) {
      const m = tk.match(/^([+-]?)(\d*)(?:\((-?\d+)\)\/\((\d+)\))?([A-Za-z])?$/);
      if (!m) return null;
      const sg = m[1] === '-' ? -1 : 1;
      let val;
      if (m[3]) val = Number(m[3]) / Number(m[4]);
      else if (m[2] === '') val = 1;
      else val = Number(m[2]);
      if (m[5]) a += sg * val; else b += sg * val;
    }
    return { a, b };
  };
  const L = side(parts[0]); const R = side(parts[1]);
  if (!L || !R) return null;
  return { L, R };
}
/** How many honest moves this statement is still from `x = k`. */
function stepsLeft(st) {
  let { L, R } = { L: { ...st.L }, R: { ...st.R } };
  for (let i = 0; i < 8; i++) {
    if (L.a !== 0 && R.a !== 0) { const s3 = Math.abs(L.a) <= Math.abs(R.a) ? L.a : R.a; L.a -= s3; R.a -= s3; continue; }
    const V = L.a === 0 ? R : L;
    if (V.a === 0) return i;
    if (V.b !== 0) { const c = V.b; L.b -= c; R.b -= c; continue; }
    if (V.a !== 1) { L.a /= V.a; L.b /= V.a; R.a /= V.a; R.b /= V.a; continue; }
    return i;
  }
  return 9;
}
/** A printed move, as an operation. `÷`/`:` is a division in every locale. */
function readMove(txt) {
  const s2 = String(txt).replace(/\s/g, '');
  const div = s2.match(/^[÷:\/](-?)(?:(\d+)|\((\d+)\)\/\((\d+)\))$/);
  if (div) return { kind: 'div', f: (div[1] ? -1 : 1) * (div[2] ? Number(div[2]) : Number(div[3]) / Number(div[4])) };
  const m = s2.match(/^([+-])(?:(\d+)|\((\d+)\)\/\((\d+)\))?([A-Za-z])?$/);
  if (!m) return null;
  const sg = m[1] === '-' ? -1 : 1;
  let val;
  if (m[3]) val = Number(m[3]) / Number(m[4]);
  else if (m[2] == null || m[2] === '') val = 1;
  else val = Number(m[2]);
  return { kind: m[5] ? 'var' : 'const', f: sg * val };
}
function applyMove(st, op) {
  const o = { L: { ...st.L }, R: { ...st.R } };
  if (op.kind === 'const') { o.L.b += op.f; o.R.b += op.f; }
  else if (op.kind === 'var') { o.L.a += op.f; o.R.a += op.f; }
  else { if (!op.f) return null; for (const sd of [o.L, o.R]) { sd.a /= op.f; sd.b /= op.f; } }
  return o;
}
/** Which of the printed moves gain ground, decided independently. */
function goodMoves(stateTex, trayTexts) {
  const st = readStatement(stateTex);
  if (!st) return null;
  const before = stepsLeft(st);
  return trayTexts.map((tx) => {
    const op = readMove(tx);
    if (!op) return null;
    const nx = applyMove(st, op);
    if (!nx) return false;
    return stepsLeft(nx) < before;
  });
}

// ------------------------------------------------------- the oracles
/**
 * THE HARNESS'S OWN SELF-TEST, run on every card.
 *
 * A cadet who KNOWS the answer plays the surface. If the harness cannot seal
 * it unassisted, then every "the shape rule did not seal it" below is a reading
 * about the harness and not about the game, which is exactly the failure this
 * project has already shipped twice.
 */
function oracleChoice(item) {
  const opts = [...panel.el.querySelectorAll('.rf-readings .rf-reading, .rf-narrow .rf-reading')];
  const i = opts.findIndex((b) => b.dataset.value === String(item.answer));
  if (i < 0) return { ok: false, why: 'no option carries the key' };
  click(opts[i]);
  return { ok: !!panel._settled && !panel.assisted, sealed: !!panel._settled, assisted: !!panel.assisted };
}
function oracleArea() {
  const wants = panel._modality?.wants?.();
  if (!wants) return { ok: false, why: 'no wants()' };
  const cells = [...panel.el.querySelectorAll('.rf-cell')];
  for (let i = 0; i < 2; i++) {
    const chip = [...panel.el.querySelectorAll('.rf-tray .rf-chip:not([disabled])')].find((c) => c.dataset.value === wants[i]);
    if (!chip) return { ok: false, why: `no chip for ${wants[i]}` };
    click(chip); click(cells[i]);
  }
  return { ok: !!panel._settled && !panel.assisted, sealed: !!panel._settled, assisted: !!panel.assisted };
}
function oracleSort() {
  // The bays publish their kind; a cadet does not see it, an oracle may.
  const bays = [...panel.el.querySelectorAll('.rf-bay')];
  let guard = 0;
  while (guard++ < 40) {
    const chips = [...panel.el.querySelectorAll('.rf-tray .rf-chip:not([disabled])')];
    if (!chips.length) break;
    const chip = chips[0];
    let done2 = false;
    for (const bay of bays) {
      click(chip); click(bay);
      if (chip.disabled) { done2 = true; break; }
    }
    if (!done2) return { ok: false, why: 'no bay took the chip' };
    if (panel._settled) break;
  }
  return { ok: !!panel._settled, sealed: !!panel._settled, assisted: !!panel.assisted };
}
function oracleBalance() {
  let guard = 0;
  while (guard++ < 10 && !panel._settled) {
    const tray = [...panel.el.querySelectorAll('.rf-move')];
    if (!tray.length) break;
    const good = goodMoves(panel._modality.stateTex(), tray.map((b) => seen(b)));
    if (!good) return { ok: false, why: 'cannot read the statement' };
    const i = good.indexOf(true);
    if (i < 0) return { ok: false, why: 'no move gains ground' };
    click(tray[i]);
  }
  return { ok: !!panel._settled && !panel.assisted, sealed: !!panel._settled, assisted: !!panel.assisted };
}

/**
 * THE KIND OF EVERY LOOSE CHIP, asked of the surface rather than of the item.
 *
 * A cadet cannot see it — that was the colour fix — but this audit has to know
 * it to score a filing rule, and reading it off `item.check` would be reading
 * the builder's own claim. So it is MEASURED: each chip is offered to the left
 * bay in turn, and the bay's answer is the chip's kind. It costs one mount and
 * leaves the card assisted, which is why it is never the card a rule is played
 * on.
 */
function probeSortKinds() {
  const bays = [...panel.el.querySelectorAll('.rf-bay')];
  const chips = [...panel.el.querySelectorAll('.rf-tray .rf-chip')];
  const kinds = [];
  for (const chip of chips) {
    click(chip); click(bays[0]);
    if (chip.disabled) { kinds.push(0); continue; }
    kinds.push(1);
    click(chip); click(bays[1]);
    if (!chip.disabled) kinds.push(-1);
  }
  return kinds;
}

// ------------------------------------------------------------------ the plan
const RULES = {
  choice: ['first', 'second', 'third', 'last', 'longest', 'shortest', 'mostDigits', 'fewestDigits',
    'noMinus', 'hasMinus', 'biggestAbs', 'smallestAbs', 'middleAbs', 'middleLen', 'oddOneOut', 'hasLetter', 'noLetter'],
  narrow: ['first', 'second', 'last', 'longest', 'shortest', 'mostDigits', 'fewestDigits',
    'noMinus', 'biggestAbs', 'smallestAbs', 'middleLen', 'oddOneOut'],
  sort: ['alternate', 'alternateRight', 'allLeft', 'allRight', 'letterMatch', 'anyLetter', 'longToLeft', 'minusToLeft'],
  area: ['first', 'last', 'biggestAbs', 'smallestAbs', 'middleAbs', 'longest', 'shortest', 'mostDigits', 'fewestDigits'],
  balance: ['divideIfPresent', 'first', 'last', 'shortest', 'fewestDigits', 'smallestAbs', 'biggestAbs', 'oddOneOut'],
  plot: ['onAnchors'],
};

/**
 * SELF-TEST. A planted cue in each surface, and the harness has to catch it.
 * `plant` rigs the surface AFTER it is mounted, exactly as a defect would.
 */
function plantCue(surface, item) {
  const el = panel.el;
  if (surface === 'choice' || surface === 'narrow') {
    // THE KEY MOVED INTO SLOT 1 — "always take the first reading" must fire.
    const box = el.querySelector('.rf-readings') || el.querySelector('.rf-narrow');
    if (!box) return false;
    const opts = [...box.children];
    const key = opts.find((b) => b.dataset.value === String(panel.item.answer));
    if (!key) return false;
    box.insertBefore(key, box.firstChild);
    return true;
  }
  if (surface === 'sort') {
    // THE CHIPS RE-LAID IN THE PRINTED TERM ORDER, unknown first — exactly the
    // board the last round measured at 95.5%. "alternate" must then fire.
    const tray = el.querySelector('.rf-tray');
    const bays = [...el.querySelectorAll('.rf-bay')];
    if (!tray || bays.length !== 2) return false;
    const letter = (seen(bays[0].querySelector('.name')).match(/[A-Za-z]/) || [''])[0];
    const chips = [...tray.querySelectorAll('.rf-chip')];
    const vs = chips.filter((c) => letter && seen(c).includes(letter));
    const ks = chips.filter((c) => !(letter && seen(c).includes(letter)));
    if (!vs.length || !ks.length) return false;
    const out = [];
    while (vs.length || ks.length) { if (vs.length) out.push(vs.shift()); if (ks.length) out.push(ks.shift()); }
    for (const c of out) tray.appendChild(c);
    return true;
  }
  if (surface === 'area') {
    // THE TWO RIGHT SHARDS MADE THE BIGGEST OF THEIR KIND — the defect the last
    // round measured at 58.4%. Only what is PRINTED on a chip is changed; the
    // value the cell grades against is the closure's and is untouched.
    const tray = el.querySelector('.rf-tray');
    const wants = panel._modality?.wants?.();
    if (!tray || !wants) return false;
    const wl = [...el.querySelectorAll('.fld-widths .wlab')].map((e) => seen(e));
    const letter = ((wl[0] || '').match(/[A-Za-z]/) || [''])[0];
    let small = 1;
    for (const c of [...tray.querySelectorAll('.rf-chip')]) {
      if (c.dataset.value === wants[0] || c.dataset.value === wants[1]) continue;
      const isVar = letter && seen(c).includes(letter);
      c.innerHTML = isVar ? `${small}${letter}` : `${small}`;
      small++;
    }
    // and the two right ones printed as the biggest of their kind
    for (const c of [...tray.querySelectorAll('.rf-chip')]) {
      if (c.dataset.value === wants[0]) c.innerHTML = `999${letter}`;
      if (c.dataset.value === wants[1]) c.innerHTML = '999';
    }
    return true;
  }
  if (surface === 'balance') {
    // ONE DIVISION AMONG FOUR ADDITIONS, and the division is the ideal move —
    // "if there is a divide button, press it" must then name it.
    const tray = [...el.querySelectorAll('.rf-move')];
    if (tray.length < 2) return false;
    const good = goodMoves(panel._modality.stateTex(), tray.map((b) => seen(b)));
    if (!good) return false;
    const i = good.indexOf(true);
    if (i < 0) return false;
    tray.forEach((b, j) => { b.innerHTML = j === i ? '÷ 7' : '+ 3'; });
    return { plantIdx: i };
  }
  if (surface === 'plot') {
    // THE MARKED READINGS MOVED ONTO THE ANSWER — "put the knobs on the dots"
    // must then seal.
    const svg = el.querySelector('.rf-plot svg');
    const fig = item?.figure;
    if (!svg || !fig?.target) return false;
    const m = fig.target.m, b = fig.target.b;
    const mv = typeof m === 'object' ? m.n / m.d : Number(m);
    const bv = typeof b === 'object' ? b.n / b.d : Number(b);
    const labels = [...svg.querySelectorAll('text')]
      .map((tn) => ({ v: Number(tn.textContent), x: +tn.getAttribute('x'), y: +tn.getAttribute('y') }))
      .filter((o) => Number.isFinite(o.v) && o.v !== 0);
    if (labels.length < 4) return false;
    const byY = {}; for (const o of labels) (byY[Math.round(o.y)] = byY[Math.round(o.y)] || []).push(o);
    const row = Object.values(byY).sort((p, q) => q.length - p.length)[0];
    const byX = {}; for (const o of labels) (byX[Math.round(o.x)] = byX[Math.round(o.x)] || []).push(o);
    const col = Object.values(byX).sort((p, q) => q.length - p.length)[0];
    if (!row || !col || row.length < 2 || col.length < 2) return false;
    row.sort((p, q) => p.v - q.v); col.sort((p, q) => p.v - q.v);
    const kx = (row[row.length - 1].x - row[0].x) / (row[row.length - 1].v - row[0].v);
    const x0 = row[0].x - kx * row[0].v;
    const ky = (col[col.length - 1].y - col[0].y) / (col[col.length - 1].v - col[0].v);
    const y0 = col[0].y - ky * col[0].v;
    const R = Math.max(...row.map((o) => Math.abs(o.v)));
    const pts = [];
    for (let x = -R; x <= R && pts.length < 2; x++) { const y = mv * x + bv; if (Number.isInteger(y) && Math.abs(y) <= R) pts.push({ x, y }); }
    if (pts.length < 2) return false;
    /* THE PLOT'S PLANT RUNS THE OTHER WAY, because the honest chart already
       marks readings ON the answer and "put the knobs on the dots" already
       seals it. So the plant moves every marked reading OFF the line by one
       square, and the harness has to STOP firing. A harness that seals either
       way is not reading the chart at all. */
    const marks = [...svg.querySelectorAll('circle.anchor, circle.anchor-halo')];
    if (marks.length < 2) return false;
    marks.forEach((c, i) => { const p = pts[i % 2]; c.setAttribute('cx', x0 + kx * p.x); c.setAttribute('cy', y0 + ky * (p.y + 3)); });
    return { inverted: true };
  }
  return false;
}

window.__blind = {
  skills: () => SKILLS.slice(),
  /**
   * One item, mounted once per rule. Returns the surface it reached and, for
   * every rule, the panel's own two flags after the rule has played the card.
   */
  probe(spec) {
    const { skill, band, seed, locale } = spec;
    setLocale(locale, ITEM_BUNDLES[locale]);
    let item;
    try { item = generate(skill, band, seed, { locale, record: false }); }
    catch (e) { return { error: String(e.message || e) }; }
    show(item);
    const surface = surfaceOf();
    const out = { skill, form: item.form, band, seed, locale, surface, answer: String(item.answer), rules: {} };

    /* THE NARROWED FIELD lives under the keypad, after two honest misses. */
    if (surface === 'keypad') {
      if (!forceNarrow()) return out;
      out.surface = 'narrow';
      const first = [...panel.el.querySelectorAll('.rf-narrow .rf-reading')];
      out.n = first.length;
      out.opts = first.map((b) => seen(b));
      out.keyAt = first.findIndex((b) => b.dataset.value === String(item.answer));
      // two real plays, so the map from "this rule picks slot i" to
      // "the panel sealed" is proved and not assumed
      for (const rule of ['first', 'oddOneOut']) {
        show(item); if (!forceNarrow()) break;
        const r = playNarrow(rule); if (r) out.rules[rule] = r;
      }
      show(item);
      if (forceNarrow()) { try { out.oracle = oracleChoice(item); } catch (e) { out.oracle = { ok: false, why: String(e.message || e) }; } }
      return out;
    }

    if (surface === 'choice') {
      out.special = item.type === 'special';
      const opts = [...panel.el.querySelectorAll('.rf-readings .rf-reading')];
      out.n = opts.length;
      out.opts = opts.map((b) => seen(b));
      out.keyAt = opts.findIndex((b) => b.dataset.value === String(item.answer));
      out.values = opts.map((b) => b.dataset.value);
      for (const rule of ['first', 'oddOneOut']) {
        show(item); const r = playChoice(rule); if (r) out.rules[rule] = r;
      }
      show(item);
      try { out.oracle = oracleChoice(item); } catch (e) { out.oracle = { ok: false, why: String(e.message || e) }; }
      return out;
    }

    if (surface === 'sort') {
      out.chips = [...panel.el.querySelectorAll('.rf-tray .rf-chip')].map((c) => seen(c));
      out.bays = [...panel.el.querySelectorAll('.rf-bay')].map((b) => seen(b.querySelector('.name')));
      out.printed = seen(panel.el.querySelector('#rf-prompt'));
      show(item);
      out.kinds = probeSortKinds();
      for (const rule of ['alternate', 'letterMatch', 'anyLetter', 'allLeft']) {
        show(item); const r = playSort(rule); if (r) out.rules[rule] = r;
      }
      /* WHAT THE BOARD SHOWS ONCE IT IS FILED. The card's answer is a sum; if
         the bays print that sum themselves, the cadet was never asked for it. */
      show(item);
      const rr = playSort('anyLetter');
      out.filedClean = !!(rr && rr.sealed && !rr.assisted);
      out.bayTotals = [...panel.el.querySelectorAll('.rf-bay .sum')].map((e) => seen(e));
      out.askedFor = String(item.answer);
      show(item);
      try { out.oracle = oracleSort(); } catch (e) { out.oracle = { ok: false, why: String(e.message || e) }; }
      return out;
    }

    if (surface === 'area') {
      out.chips = [...panel.el.querySelectorAll('.rf-tray .rf-chip')].map((c) => seen(c));
      out.values = [...panel.el.querySelectorAll('.rf-tray .rf-chip')].map((c) => c.dataset.value);
      out.widths = [...panel.el.querySelectorAll('.fld-widths .wlab')].map((e) => seen(e));
      out.wants = panel._modality?.wants?.() || null;
      for (const rule of ['biggestAbs', 'smallestAbs', 'middleAbs', 'last', 'first']) {
        show(item); const r = playArea(rule); if (r) out.rules[rule] = r;
      }
      show(item);
      try { out.oracle = oracleArea(); } catch (e) { out.oracle = { ok: false, why: String(e.message || e) }; }
      return out;
    }

    if (surface === 'balance') {
      out.tray = [...panel.el.querySelectorAll('.rf-move')].map((b) => seen(b));
      out.state0 = panel._modality?.stateTex?.();
      for (const rule of RULES.balance) {
        show(item);
        let r = null;
        try { r = playBalance(rule); } catch (e) { r = { error: String(e.message || e) }; }
        if (r) out.rules[rule] = r;
      }
      show(item);
      try { out.oracle = oracleBalance(); } catch (e) { out.oracle = { ok: false, why: String(e.message || e) }; }
      return out;
    }

    if (surface === 'plot') {
      out.anchors = panel.el.querySelectorAll('.rf-plot circle.anchor').length;
      show(item);
      try { out.rules.onAnchors = playPlot('onAnchors'); } catch (e) { out.rules.onAnchors = { error: String(e.message || e) }; }
      show(item);
      try { out.oracle = oraclePlot(item); } catch (e) { out.oracle = { ok: false, why: String(e.message || e) }; }
      return out;
    }
    return out;
  },

  /** The same item and rule with NO plant — the control the plant is measured against. */
  control(spec, surfaceWanted, rule) {
    const { skill, band, seed, locale } = spec;
    setLocale(locale, ITEM_BUNDLES[locale]);
    let item;
    try { item = generate(skill, band, seed, { locale, record: false }); } catch { return null; }
    show(item);
    let surface = surfaceOf();
    if (surface === 'keypad' && surfaceWanted === 'narrow') { if (!forceNarrow()) return null; surface = 'narrow'; }
    if (surface !== surfaceWanted) return null;
    const play = { choice: playChoice, narrow: playNarrow, sort: playSort, area: playArea, balance: playBalance, plot: playPlot }[surface];
    const r = play(rule);
    if (surface === 'balance') return { surface, rule, firstGood: !!r?.moves?.[0]?.good, ...r };
    return { surface, rule, ...r };
  },

  /** The same item, with a cue PLANTED after mount. The rule named must fire. */
  planted(spec, surfaceWanted, rule) {
    const { skill, band, seed, locale } = spec;
    setLocale(locale, ITEM_BUNDLES[locale]);
    let item;
    try { item = generate(skill, band, seed, { locale, record: false }); } catch { return null; }
    show(item);
    let surface = surfaceOf();
    if (surface === 'keypad' && surfaceWanted === 'narrow') { if (!forceNarrow()) return null; surface = 'narrow'; }
    if (surface !== surfaceWanted) return null;
    const plant = plantCue(surface, item);
    if (!plant) return null;
    const play = { choice: playChoice, narrow: playNarrow, sort: playSort, area: playArea, balance: playBalance, plot: playPlot }[surface];
    const r = play(rule);
    if (plant && plant.plantIdx != null) return { surface, rule, plantIdx: plant.plantIdx, tookPlant: r?.moves?.[0]?.i === plant.plantIdx, ...r };
    if (plant && plant.inverted) return { surface, rule, inverted: true, ...r };
    // the beam re-renders after the first move, so only the FIRST pick can carry
    // a planted cue; that is the one the plant is about.
    if (surface === 'balance') return { surface, rule, firstGood: !!r?.moves?.[0]?.good, ...r };
    return { surface, rule, ...r };
  },
};
