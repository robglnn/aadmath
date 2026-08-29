/**
 * The coordinate surface — a fifth way to answer.
 *
 * WHY IT EXISTS
 *
 * The rig can already take a value on a keypad, a move on a balance, a term
 * into a bay, a piece of area into a field, and a choice between readings.
 * None of those is what "draw the trace" means. Asking a learner to *type* the
 * line they can see is the moment a graphing question stops being a graphing
 * question, and Level 2 is largely about the line.
 *
 * So this is the same idea as the balance: an instrument the cadet acts on,
 * whose state is the answer. Two knobs sit on the lattice. Drag them, or move
 * them with the arrow keys, and the trace between them follows. The rig reads
 * the line off the two knobs in exact rational arithmetic and compares it with
 * the rule the readings describe — never with a screen position, never with a
 * tolerance in pixels.
 *
 * IT IS A MODALITY, NOT A PARALLEL SYSTEM. It returns exactly what
 * `_keypad`, `_balance`, `_sort`, `_area` and `_choice` return, is mounted by
 * the same `_mount`, reports through the same `solve`/`miss` callbacks, and
 * takes its colours from the rig's own tokens. `mountPlot` returns `null` for
 * anything it cannot draw, and the rift falls through to the next surface, so
 * a plot item can never be an item nobody can answer.
 */
import './plot.css';
import { R, add, sub, mul, div, eq as reqq, isZero, texOf } from './rational.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

// ---------------------------------------------------------------------------
// THE LATTICE — one computation, every rendering.
//
// The gridlines used to be stepped on `round(R/5)` and the numerals on
// `round(R/3)`, in two expressions written apart from one another — and in two
// files, because `gridSvg` in src/ui/rift.js draws the same chart for the items
// a cadet only reads. Two steps with no common multiple means the numbers are
// not on the lines: over the 36 (kind, range) pairs this bank draws, 30 had a
// numeral off every gridline, and at ±10 — the default range, the commonest of
// all — not one of the six numerals sat on a line. At ±9 the lattice was not
// even anchored on the origin: the axes crossed at zero and the nearest lines
// stood at ±1, so counting squares out from the origin was wrong for every
// reading on the chart.
//
// A cadet who counts squares from a numbered tick then reads the point wrong,
// and is marked wrong for trusting the picture we drew. That is the graph half
// of the defect `tools/check-figures.mjs` was written for, and the rule
// `src/learn/generators.js` states for notation says the same thing about it:
// THE MATHEMATICS WE CHECK MUST BE THE MATHEMATICS WE DISPLAY.
//
// So there is one lattice. The lines come out of it, the numbers come out of
// it, and the map from a reading to a pixel comes out of it. Nothing downstream
// may compute a second one. `tools/check-figures.mjs --charts` asserts the
// result off the rendered DOM — every numeral on a line, every line a whole
// square, every plotted reading at the pixel the numerals name — so this is a
// checked claim and not a comment.
// ---------------------------------------------------------------------------

/** The drawing's own units. Every chart in the product is 300 of them square. */
export const CHART_S = 300;
/** Room outside the lattice for the numerals and the axis names. */
export const CHART_PAD = 26;
/** The numerals, in those same units. Nine was unreadable — see plot.css. */
export const CHART_TICK = 15;

/** The steps an axis may be numbered on. Anything else reads as arbitrary. */
const TICK_LADDER = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 100];

/**
 * The lattice for a chart of ±`range`.
 *
 * @returns {{R:number,k:number,step:number,labelStep:number,lines:number[],
 *            labels:number[],X:(n:number)=>number,Y:(n:number)=>number,
 *            S:number,pad:number,tick:number}}
 */
export function chartLattice(range, { S = CHART_S, pad = CHART_PAD, tick = CHART_TICK } = {}) {
  const R = Math.max(4, Math.round(Number(range) || 10));
  const k = (S - pad * 2) / (2 * R);
  const X = (x) => pad + (x + R) * k;
  const Y = (y) => pad + (R - y) * k;

  // A LINE AT EVERY WHOLE NUMBER, while a whole number is worth drawing. The
  // bank plots its readings on whole numbers, so a unit lattice is what puts
  // every one of them on a crossing and makes one counted square worth exactly
  // one — which is the whole of how a cadet reads a point off a chart.
  //
  // It cannot hold at every range. A ±21 chart is 43 unit squares a side, and
  // on a 844x390 phone the panel gives the drawing 179 CSS px: 3.5 px a square,
  // one of which is the line. That is a wash, not a lattice — measured, by
  // `tools/check-figures.mjs --charts`, which is why the number below is 16 and
  // not a preference. Past it the squares double up and the numbering doubles
  // with them, because the numbering is a multiple of THIS step and is never
  // computed beside it.
  const step = R <= 16 ? 1 : Math.ceil(R / 16);
  const lines = [];
  for (let i = 0; i <= R; i += step) { lines.push(i); if (i) lines.push(-i); }
  lines.sort((a, b) => a - b);

  // THE NUMBERED TICKS ARE A WHOLE MULTIPLE OF THAT STEP. That is the whole of
  // the fix. Which multiple is decided by the widest numeral the choice will
  // actually draw, so two numerals can never touch — and it is decided against
  // the same `k` the lines are drawn on rather than a second guess at the size.
  let labelStep = step;
  for (const n of TICK_LADDER) {
    const L = step * n;
    labelStep = L;
    const top = Math.floor(R / L) * L;
    if (!top) continue;
    const chars = String(top).length + 1;                 // room for the sign
    if (L * k >= chars * tick * 0.62 * 1.4) break;
  }
  const labels = [];
  for (let i = labelStep; i <= R; i += labelStep) { labels.push(i); labels.push(-i); }
  labels.sort((a, b) => a - b);

  return { R, k, step, labelStep, lines, labels, X, Y, S, pad, tick };
}

/** A gridline that is also a numbered one is drawn brighter, so the eye has
 *  something to count FROM. Inline, not a class, because the same nodes are
 *  drawn into two panels with two stylesheets and only one of them is ours. */
const MAJOR_STYLE = 'stroke:rgba(126,190,255,.36);stroke-width:1.4';
const TICK_FILL = 'rgba(203,220,244,.94)';
/** A dark rim under a numeral, so a number sitting on a line stays a number. */
const TICK_HALO = { stroke: '#0a1018', 'stroke-width': 2.6, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };
const AXIS_FILL = 'rgba(120,235,255,.95)';

/**
 * The lattice as drawing instructions: `{ t, a, text }` per node.
 *
 * Returned as data rather than as markup or as DOM because the two renderers
 * that need it build in different worlds — `mountPlot` in real SVG elements,
 * `gridSvg` in a string — and neither may be allowed to re-derive a position.
 */
export function chartNodes(P, { only = 'all' } = {}) {
  if (only === 'labels') return tickNodes(P);
  const { S, pad, X, Y, lines, labelStep } = P;
  const out = [];
  const major = (v) => v !== 0 && Math.abs(v) % labelStep === 0;
  for (const i of lines) {
    const a = major(i) ? { class: 'gl', style: MAJOR_STYLE } : { class: 'gl' };
    out.push({ t: 'path', a: { d: `M${X(i)} ${pad} V${S - pad}`, ...a } });
    out.push({ t: 'path', a: { d: `M${pad} ${Y(i)} H${S - pad}`, ...a } });
  }
  // The axes ride ON the lattice — they are the i = 0 lines drawn again, in the
  // brighter hand. Drawn apart from it, the origin can drift off the squares,
  // and at ±9 it did.
  out.push({ t: 'path', a: { d: `M${X(0)} ${pad} V${S - pad}`, class: 'ax' } });
  out.push({ t: 'path', a: { d: `M${pad} ${Y(0)} H${S - pad}`, class: 'ax' } });
  return only === 'lines' ? out : out.concat(tickNodes(P));
}

/**
 * The numbers, on their own, so a renderer can put them ON TOP of the trace.
 *
 * They cluster along the axes, which is exactly where a trace through the
 * origin crosses, and a numeral with a 2.4px glowing line drawn over it is a
 * numeral nobody reads. Same one computation either way — this is an order of
 * painting, not a second lattice.
 */
function tickNodes(P) {
  const { S, pad, tick, X, Y, labels } = P;
  const out = [];
  for (const i of labels) {
    out.push({ t: 'text', text: String(i), a: {
      x: X(i), y: Y(0) + tick * 0.92, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'data-axis': 'x', fill: TICK_FILL, 'font-size': tick, ...TICK_HALO } });
    out.push({ t: 'text', text: String(i), a: {
      x: X(0) - tick * 0.6, y: Y(i), 'text-anchor': 'end', 'dominant-baseline': 'central',
      'data-axis': 'y', fill: TICK_FILL, 'font-size': tick, ...TICK_HALO } });
  }
  // i18n-allow: the names of the axes, in the notation the item itself renders.
  out.push({ t: 'text', text: 'x', a: {
    x: S - pad - 2, y: Y(0) - tick * 0.72, 'text-anchor': 'end',
    fill: AXIS_FILL, 'font-size': tick, 'font-style': 'italic', ...TICK_HALO } });
  out.push({ t: 'text', text: 'y', a: {
    x: X(0) + tick * 0.5, y: pad + tick * 0.55, 'dominant-baseline': 'central',
    fill: AXIS_FILL, 'font-size': tick, 'font-style': 'italic', ...TICK_HALO } });
  return out;
}

/* Written by code point, not by the glyph: a bare double quote inside a
   character class reads to tools/check-i18n.mjs as the opening of a prose
   string, and the finding it raises is a false one nobody can act on. */
const XML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\u0022': '&quot;' };
const esc = (v) => String(v).replace(/[&<>\u0022]/g, (c) => XML_ESC[c]);

/** The same nodes as a string, for a renderer that builds markup. */
export function chartMarkup(P, opts) {
  return chartNodes(P, opts)
    .map((n) => `<${n.t} ${Object.entries(n.a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}`
      + (n.text == null ? '/>' : `>${esc(n.text)}</${n.t}>`))
    .join('');
}

/** "y = 3x - 2", "y = -x", "y = 4" — the one spelling both sides compare. */
export function lineTex(m, b) {
  const slope = isZero(m) ? '' : reqq(m, R(1)) ? 'x' : reqq(m, R(-1)) ? '-x' : `${texOf(m)}x`;
  if (!slope) return texOf(b);
  if (isZero(b)) return slope;
  return `${slope} ${b.n < 0 ? '-' : '+'} ${texOf(b.n < 0 ? R(-b.n, b.d) : b)}`;
}

/**
 * Mount the surface.
 *
 * @param {HTMLElement} work        where the instrument goes
 * @param {object} ctx
 * @param {object} ctx.item         the live item; needs figure.kind === 'plot'
 * @param {(s:string)=>string} ctx.tex        strict-KaTeX renderer
 * @param {(k:string,p?:object)=>string} ctx.t  the bundle
 * @param {()=>boolean} ctx.settled  has the rig already closed?
 * @param {()=>void} ctx.solve       the statement is true
 * @param {(mis:string|null, msg?:string, entry?:string)=>void} ctx.miss
 * @param {(p:number)=>void} [ctx.pressure]
 * @returns {object|null} a modality, or null if this item cannot be drawn
 */
export function mountPlot(work, ctx) {
  const { item, tex, t } = ctx;
  const fig = item?.figure;
  if (!fig || fig.kind !== 'plot' || !fig.target) return null;
  const target = { m: R(fig.target.m), b: R(fig.target.b) };

  // ---------------------------------------------------------------- geometry
  // One lattice, shared with the numbering and with `gridSvg` in src/ui/rift.js
  // — see `chartLattice` above. Nothing here recomputes a step, a pixel, or
  // even the range: `RANGE` is the lattice's own, so the surface a knob can
  // reach and the surface that is drawn are the same surface by construction.
  const P = chartLattice(fig.range);
  const { R: RANGE, S, pad, k, X, Y } = P;
  const unX = (px) => Math.round((px - pad) / k - RANGE);
  const unY = (py) => Math.round(RANGE - (py - pad) / k);
  const clamp = (n) => Math.max(-RANGE, Math.min(RANGE, n));

  // The two knobs start on the axis, wide apart so neither hides the other,
  // and never start on the answer: a surface that opens already solved has
  // asked nothing.
  const reach = Math.max(2, Math.round(RANGE * 0.55));
  const knobs = [{ x: -reach, y: 0 }, { x: reach, y: 0 }];
  if (fitsTarget(knobs)) { knobs[0].y = 1; knobs[1].y = -1; }
  if (fitsTarget(knobs)) { knobs[0] = { x: -reach, y: 2 }; knobs[1] = { x: reach, y: -2 }; }

  function fitsTarget(kn) {
    const line = lineOf(kn);
    return !!line && reqq(line.m, target.m) && reqq(line.b, target.b);
  }

  /** The exact line through the two knobs, or null when they share an input. */
  function lineOf(kn) {
    const [p, q] = kn;
    if (p.x === q.x) return null;
    const m = div(sub(R(q.y), R(p.y)), sub(R(q.x), R(p.x)));
    return { m, b: sub(R(p.y), mul(m, R(p.x))) };
  }

  // ------------------------------------------------------------------ chrome
  const host = document.createElement('div');
  host.className = 'rf-plot';

  const stage = document.createElement('div');
  stage.className = 'rf-plot-stage';
  const svg = el('svg', { viewBox: `0 0 ${S} ${S}`, role: 'application', 'aria-label': t('rift.plot.aria') });
  stage.appendChild(svg);

  const draw = (nodes, into) => {
    for (const n of nodes) {
      const node = el(n.t, n.a);
      if (n.text != null) node.textContent = n.text;
      into.appendChild(node);
    }
  };
  const grid = el('g');
  draw(chartNodes(P, { only: 'lines' }), grid);
  svg.appendChild(grid);

  // The readings the question is about, marked but not draggable.
  for (const [px, py] of fig.points || []) {
    if (Math.abs(px) > RANGE || Math.abs(py) > RANGE) continue;
    svg.appendChild(el('circle', { cx: X(px), cy: Y(py), r: 8.5, class: 'anchor-halo' }));
    svg.appendChild(el('circle', { cx: X(px), cy: Y(py), r: 3.6, class: 'anchor' }));
  }

  const drawn = el('path', { class: 'drawn' });
  svg.appendChild(drawn);

  // The numbers go on LAST, over the trace. The cadet drags a glowing line
  // straight through the origin, which is where the numerals are, and a number
  // under that line is a number nobody reads.
  const numerals = el('g');
  draw(chartNodes(P, { only: 'labels' }), numerals);
  svg.appendChild(numerals);

  // A KNOB IS TWO CIRCLES: one you can see, and one you can hit.
  //
  // The visible knob is 8 units in a 300-unit box, which is 13.7 CSS px on a
  // 390-wide phone and 10.8 on the same phone turned sideways. The smallest
  // target a thumb lands on reliably is 44. Growing the drawn circle to 44
  // would cover two grid squares and hide the very readings it sits between,
  // so the target grows instead of the mark: an invisible circle, wide enough
  // to catch a thumb, centred on the same point.
  const handles = knobs.map((_, i) => {
    const g = el('g', { class: 'knob-grp' });
    const hit = el('circle', { r: 26, class: 'knob-hit', tabindex: 0, role: 'slider' });
    hit.setAttribute('aria-label', t('rift.plot.knob', { n: i + 1 }));
    const c = el('circle', { r: 8, class: 'knob' });
    g.appendChild(hit);
    g.appendChild(c);
    svg.appendChild(g);
    return Object.assign(hit, { _dot: c });
  });

  const read = document.createElement('div');
  read.className = 'rf-plot-read';
  read.innerHTML = `<span>${t('rift.plot.reads')}</span><span class="val"></span>`;
  const readVal = read.querySelector('.val');

  const bar = document.createElement('div');
  bar.className = 'rf-plot-bar';
  const commit = document.createElement('button');
  commit.type = 'button';
  commit.className = 'rf-key commit';
  commit.textContent = t('rift.keypad.set');
  bar.appendChild(commit);

  host.appendChild(stage);
  host.appendChild(read);
  host.appendChild(bar);
  work.appendChild(host);

  // ------------------------------------------------------------------- paint
  let live = 0;
  function paint() {
    handles.forEach((h, i) => {
      for (const c of [h, h._dot]) {
        c.setAttribute('cx', X(knobs[i].x));
        c.setAttribute('cy', Y(knobs[i].y));
      }
      h._dot.classList.toggle('live', i === live);
      h.classList.toggle('live', i === live);
    });
    const line = lineOf(knobs);
    if (!line) {
      drawn.setAttribute('d', `M${X(knobs[0].x)} ${Y(-RANGE)} V${Y(RANGE)}`);
      readVal.innerHTML = '';
      read.classList.add('bad');
      commit.disabled = true;
      return;
    }
    read.classList.remove('bad');
    commit.disabled = false;
    const seg = clipToChart(line.m.n / line.m.d, line.b.n / line.b.d);
    drawn.setAttribute('d', seg
      ? `M${X(seg[0][0])} ${Y(seg[0][1])} L${X(seg[1][0])} ${Y(seg[1][1])}`
      : '');
    readVal.innerHTML = tex(`y = ${lineTex(line.m, line.b)}`) || '';
  }

  /**
   * The visible part of the trace, and only the visible part.
   *
   * A steep line taken from one side of the chart to the other leaves the box
   * by the top and the bottom, and an SVG that does not clip it draws a bright
   * diagonal straight across the prompt and out through the Seal key. So the
   * segment is cut against all four edges before it is drawn.
   */
  function clipToChart(m, b) {
    const E = 1e-9;
    const found = [];
    const add2 = (x, y) => {
      if (found.some((p) => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6)) return;
      found.push([x, y]);
    };
    for (const x of [-RANGE, RANGE]) {
      const y = m * x + b;
      if (y >= -RANGE - E && y <= RANGE + E) add2(x, y);
    }
    if (Math.abs(m) > E) {
      for (const y of [-RANGE, RANGE]) {
        const x = (y - b) / m;
        if (x >= -RANGE - E && x <= RANGE + E) add2(x, y);
      }
    }
    if (found.length < 2) return null;
    found.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    return [found[0], found[found.length - 1]];
  }

  function move(i, dx, dy) {
    if (ctx.settled()) return;
    knobs[i] = { x: clamp(knobs[i].x + dx), y: clamp(knobs[i].y + dy) };
    paint();
  }

  function placeAt(i, clientX, clientY) {
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const px = ((clientX - box.left) / box.width) * S;
    const py = ((clientY - box.top) / box.height) * S;
    const x = clamp(unX(px));
    const y = clamp(unY(py));
    if (knobs[i].x === x && knobs[i].y === y) return;
    knobs[i] = { x, y };
    paint();
  }

  handles.forEach((h, i) => {
    h.addEventListener('pointerdown', (e) => {
      if (ctx.settled()) return;
      e.preventDefault();
      live = i;
      h.classList.add('dragging');
      try { h.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      const onMove = (ev) => placeAt(i, ev.clientX, ev.clientY);
      const onUp = () => {
        h.classList.remove('dragging');
        h.removeEventListener('pointermove', onMove);
        h.removeEventListener('pointerup', onUp);
        h.removeEventListener('pointercancel', onUp);
      };
      h.addEventListener('pointermove', onMove);
      h.addEventListener('pointerup', onUp);
      h.addEventListener('pointercancel', onUp);
      paint();
    });
    h.addEventListener('focus', () => { live = i; paint(); });
  });

  // A TAP ANYWHERE ON THE GRID MOVES THE NEAREST KNOB, and then keeps
  // following the finger.
  //
  // This used to require `e.target === svg`, so a tap that happened to land on
  // the trace the cadet was drawing, or on an axis, hit a `<path>` instead of
  // the canvas and was dropped on the floor. Measured on a 390x844 phone, 17
  // taps in every 81 across the grid did nothing at all — and the one line a
  // learner aims at most is the one they are trying to move. Nothing on this
  // surface is a target now except the surface: press anywhere, the nearer
  // knob comes to you, and dragging carries on from there. Precision is not
  // the question this rift is asking.
  stage.addEventListener('pointerdown', (e) => {
    if (ctx.settled()) return;
    if (handles.some((h) => h === e.target)) return;   // the knob handles its own drag
    e.preventDefault();
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const px = ((e.clientX - box.left) / box.width) * S;
    const py = ((e.clientY - box.top) / box.height) * S;
    let best = live;
    let bestD = Infinity;
    knobs.forEach((k, i) => {
      const dx = X(k.x) - px;
      const dy = Y(k.y) - py;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = i; }
    });
    live = best;
    placeAt(live, e.clientX, e.clientY);
    try { stage.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const onMove = (ev) => placeAt(live, ev.clientX, ev.clientY);
    const onUp = () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
  });

  // ------------------------------------------------------------------ commit
  /**
   * What the drawn line says about the thinking behind it. Only ever a tag the
   * graph declares for this node, and `null` — the honest answer — whenever the
   * line is simply somewhere else.
   */
  function readSlip(line) {
    const mOk = reqq(line.m, target.m);
    const bOk = reqq(line.b, target.b);
    if (reqq(line.m, target.b) && reqq(line.b, target.m)) return 'slope-intercept-swap';
    if (mOk && !bOk) return 'partial-rule';
    if (bOk && reqq(line.m, mul(target.m, R(-1)))) return 'sign-slip';
    if (mOk && reqq(line.b, mul(target.b, R(-1)))) return 'sign-slip';
    if (!isZero(target.m) && reqq(line.m, div(R(1), target.m))) return 'div-direction';
    return null;
  }

  function submit() {
    if (ctx.settled()) return;
    const line = lineOf(knobs);
    if (!line) return;
    if (reqq(line.m, target.m) && reqq(line.b, target.b)) { ctx.solve(); return; }
    read.classList.remove('bad');
    void read.offsetWidth;
    read.classList.add('bad');
    ctx.miss(readSlip(line), t('rift.plot.notYet'), `y = ${lineTex(line.m, line.b)}`);
  }
  commit.addEventListener('click', submit);

  paint();
  ctx.pressure?.(1);

  return {
    name: 'plot',
    owns: true,
    stateTex: () => {
      const line = lineOf(knobs);
      return line ? `y = ${lineTex(line.m, line.b)}` : null;
    },
    key(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const K = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (K[e.key]) { move(live, K[e.key][0], K[e.key][1]); }
      else if (e.key === 'Tab' || e.key === '1' || e.key === '2') {
        live = e.key === 'Tab' ? (live + 1) % knobs.length : Number(e.key) - 1;
        handles[live].focus?.();
        paint();
      } else if (e.key === 'Enter') submit();
      else return;
      e.preventDefault();
    },
    /** The scripted hand: put the trace somewhere, then seal it. */
    set(v) {
      const mm = /^y\s*=\s*(-?\d+)x\s*([+-])\s*(\d+)$/.exec(String(v).replace(/\s+/g, ' ').trim());
      if (!mm) return;
      const m = Number(mm[1]);
      const b = (mm[2] === '-' ? -1 : 1) * Number(mm[3]);
      knobs[0] = { x: 0, y: clamp(b) };
      knobs[1] = { x: 1, y: clamp(m + b) };
      paint();
    },
    submit,
    /** A wrong but honest placing: the right rate through the wrong start. */
    pickBad() {
      knobs[0] = { x: 0, y: clamp(fig.target.b + 1) };
      knobs[1] = { x: 1, y: clamp(fig.target.m + fig.target.b + 1) };
      paint();
      submit();
      return null;
    },
  };
}
