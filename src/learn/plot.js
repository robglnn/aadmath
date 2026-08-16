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
  const RANGE = Math.max(4, Math.round(fig.range || 10));

  // ---------------------------------------------------------------- geometry
  const S = 300, pad = 18;
  const k = (S - pad * 2) / (2 * RANGE);
  const X = (x) => pad + (x + RANGE) * k;
  const Y = (y) => pad + (RANGE - y) * k;
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

  const grid = el('g');
  const step = Math.max(1, Math.round(RANGE / 5));
  for (let i = -RANGE; i <= RANGE; i += step) {
    grid.appendChild(el('path', { d: `M${X(i)} ${pad} V${S - pad}`, class: 'gl' }));
    grid.appendChild(el('path', { d: `M${pad} ${Y(i)} H${S - pad}`, class: 'gl' }));
  }
  grid.appendChild(el('path', { d: `M${X(0)} ${pad} V${S - pad}`, class: 'ax' }));
  grid.appendChild(el('path', { d: `M${pad} ${Y(0)} H${S - pad}`, class: 'ax' }));
  const lab = Math.max(2, Math.round(RANGE / 3));
  for (let i = -RANGE + (RANGE % lab); i <= RANGE; i += lab) {
    if (i === 0 || Math.abs(i) > RANGE - 1) continue;
    const a = el('text', { x: X(i), y: Y(0) + 12, 'text-anchor': 'middle', fill: 'rgba(159,179,208,.8)', 'font-size': 9 });
    a.textContent = String(i);
    const c = el('text', { x: X(0) - 6, y: Y(i) + 3.2, 'text-anchor': 'end', fill: 'rgba(159,179,208,.8)', 'font-size': 9 });
    c.textContent = String(i);
    grid.appendChild(a);
    grid.appendChild(c);
  }
  const ax = el('text', { x: S - pad - 2, y: Y(0) - 7, 'text-anchor': 'end', fill: 'rgba(95,230,255,.85)', 'font-size': 11, 'font-style': 'italic' });
  ax.textContent = 'x';   // i18n-allow: the name of an axis in the notation the item renders
  const ay = el('text', { x: X(0) + 7, y: pad + 10, fill: 'rgba(95,230,255,.85)', 'font-size': 11, 'font-style': 'italic' });
  ay.textContent = 'y';   // i18n-allow: the name of an axis in the notation the item renders
  grid.appendChild(ax);
  grid.appendChild(ay);
  svg.appendChild(grid);

  // The readings the question is about, marked but not draggable.
  for (const [px, py] of fig.points || []) {
    if (Math.abs(px) > RANGE || Math.abs(py) > RANGE) continue;
    svg.appendChild(el('circle', { cx: X(px), cy: Y(py), r: 8.5, class: 'anchor-halo' }));
    svg.appendChild(el('circle', { cx: X(px), cy: Y(py), r: 3.6, class: 'anchor' }));
  }

  const drawn = el('path', { class: 'drawn' });
  svg.appendChild(drawn);

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
