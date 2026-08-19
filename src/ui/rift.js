import './rift.css';
import '../learn/echo.css';   // the echo's own rows, owned with the echo's content
import { tex, texOk, texFirst, texProse } from './tex.js';
import { t, getLocale, mathOp, pct as pctOf } from '../i18n/index.js';
import { equivalent } from '../learn/parser.js';
import { diagnose } from '../learn/diagnose.js';
import { analogueFor } from '../learn/scaffold.js';
import { echoScript, MAX_TIER } from '../learn/echo.js';
import { mountPlot } from '../learn/plot.js';   // the coordinate surface, owned with its mathematics

/**
 * The rift stabiliser — where the learning actually happens.
 *
 * A rift is held open by a statement that is not true yet. The cadet's job is
 * to make it true, and the rig hands them a different pair of hands for each
 * kind of truth rather than four buttons for all of them:
 *
 *   keypad   — charge a value or build an expression, glyph by glyph. Nothing
 *              to pick between, so a wrong entry reports the learner's actual
 *              thinking instead of a guess.
 *   balance  — a beam that applies every move to both sides. The invariant is
 *              enforced by the world; the cadet chooses which move frees the
 *              unknown. Nothing they can do here makes the statement false.
 *   bays     — terms are physical things that have to be sent somewhere. A
 *              number will not fit in the x-bay, so "3x + 2 = 5x" never forms.
 *   field    — the distributive property as the rectangle it actually is.
 *   readings — for the items that really are a choice: which statement is true.
 *
 * When they slip, an echo of a previous cadet fades in beside them — the same
 * mistake, one line at a time, aimed at the misconception just displayed. When
 * they finish, the original statement is rebuilt around their value and shown
 * to be true, and then the tear closes.
 */

/**
 * Every box in the rig that has any say over its own height, and therefore
 * every box that could cut something off. The fit pass below measures all of
 * them, not just the three columns: the moment one inner box was allowed to
 * absorb an overflow, the columns above it stopped reporting one and the rig
 * happily swore that a clipped trace fitted.
 *
 * rift.css now goes further and takes the *ability* to absorb one away — no box
 * in here clips, so an overflow anywhere travels all the way out to `.rf-plate`
 * and is answered by shrinking the whole rig. This list is the belt to that
 * pair of braces: if a new box ever does start hiding something, it is caught
 * here on the pass it happens rather than in a screenshot a fortnight later.
 *
 * `.rf-echo-tail` is deliberately absent. It is the only box in the rig that
 * carries no teaching — it is the room the trace did not need, dressed — and it
 * is size-contained, so its contents cannot make it taller and it cannot make
 * the surface not fit.
 */
const FIT_BOXES = [
  '.rf-frame', '#rf-plate', '.rf-head', '.rf-foot', '.rf-stmtwrap', '.rf-statement', '.rf-stmt-in',
  '.rf-stage', '.rf-inner', '.rf-work', '.rf-figbox', '.rf-fig',
  '.rf-pad', '.rf-socket', '.rf-keys', '.rf-key',
  '.rf-readings', '.rf-reading', '.rf-narrow',
  '.rf-bal', '.rf-yoke', '.rf-moves', '.rf-tray', '.rf-bays', '.rf-bay', '.rf-bay > header',
  '.rf-field', '.rf-cell', '.rf-assemble', '.rf-totalrow',
  '.rf-echo', '.rf-echo-head', '.rf-echo-body', '.rf-strata',
].join(',');

// ---------------------------------------------------------------------------
// Exact rational arithmetic. Dividing a balance by 3 must not give 0.333…
// ---------------------------------------------------------------------------
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
function fr(n, d = 1) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const fAdd = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fDiv = (a, b) => (b.n === 0 ? null : fr(a.n * b.d, a.d * b.n));
const fNeg = (a) => ({ n: -a.n, d: a.d });
const fZero = (a) => a.n === 0;
const fOne = (a) => a.n === a.d;
const fAbs = (a) => ({ n: Math.abs(a.n), d: a.d });
const fBig = (a) => Math.abs(a.n) > 9999 || a.d > 9999;
const fNum = (a) => a.n / a.d;
function fTex(f) {
  if (f.d === 1) return String(f.n);
  return `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n)}}{${f.d}}`;
}
function fTerm(f, v) {
  if (fZero(f)) return '0';
  if (f.d === 1 && f.n === 1) return v;
  if (f.d === 1 && f.n === -1) return `-${v}`;
  return `${fTex(f)}${v}`;
}
function sideTex(side, v) {
  if (fZero(side.a)) return fTex(side.b);
  const head = fTerm(side.a, v);
  if (fZero(side.b)) return head;
  return `${head} ${side.b.n < 0 ? '-' : '+'} ${fTex(fAbs(side.b))}`;
}

// ---------------------------------------------------------------------------
// Reading generated notation back into structure.
// ---------------------------------------------------------------------------
const CLEAN = (s) => String(s).replace(/\\left|\\right/g, '').replace(/\\[,;:!]/g, ' ').replace(/\\cdot/g, '*');

/** Replace one variable inside LaTeX without touching command names. */
function substVar(src, v, valTex) {
  return String(src).replace(/\\[a-zA-Z]+|[a-zA-Z]/g, (m) => (m === v ? `\\left(${valTex}\\right)` : m));
}

/** "3x + 4" -> { a, b } as rationals, or null when it is not linear. */
function parseSide(str, v) {
  const toks = str.replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
  if (!toks) return null;
  let a = 0, b = 0;
  for (const tk of toks) {
    const m = tk.match(/^([+-]?)(\d*)([a-zA-Z]?)$/);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) {
      if (m[3] !== v) return null;
      a += sign * (m[2] === '' ? 1 : Number(m[2]));
    } else {
      if (m[2] === '') return null;
      b += sign * Number(m[2]);
    }
  }
  return { a: fr(a), b: fr(b) };
}

/** "3x + 4 = 19" -> a balance state, or null. */
function parseLinear(src) {
  const s = CLEAN(src);
  if (/\\|\^|[()*]/.test(s)) return null;
  const parts = s.split('=');
  if (parts.length !== 2) return null;
  const vm = s.match(/[a-zA-Z]/);
  if (!vm) return null;
  const v = vm[0];
  const L = parseSide(parts[0], v);
  const R = parseSide(parts[1], v);
  if (!L || !R) return null;
  if (fZero(L.a) && fZero(R.a)) return null;
  return { v, L, R };
}

/** "3x + 5 - 2x - 9" -> individual signed terms. */
function parseTerms(str, v) {
  const toks = String(str).replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
  if (!toks) return null;
  const out = [];
  for (const tk of toks) {
    const m = tk.match(/^([+-]?)(\d*)([a-zA-Z]?)$/);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) {
      if (m[3] !== v) return null;
      out.push({ kind: 'var', c: sign * (m[2] === '' ? 1 : Number(m[2])) });
    } else {
      if (m[2] === '') return null;
      out.push({ kind: 'num', c: sign * Number(m[2]) });
    }
  }
  return out;
}

function coefStr(c, v) { return c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`; }
function linStr(a, v, b) {
  if (a === 0 && b === 0) return '0';
  if (a === 0) return String(b);
  if (b === 0) return coefStr(a, v);
  return `${coefStr(a, v)} ${b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`}`;
}

/** Wrap a plain answer string as safe, strict KaTeX. */
function texify(value) {
  const s = String(value).trim();
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac) return `${Number(frac[1]) < 0 ? '-' : ''}\\frac{${Math.abs(Number(frac[1]))}}{${frac[2]}}`;
  return s;
}

const norm = (s) => String(s).replace(/\s+/g, '').replace(/\\left|\\right/g, '');

// ---------------------------------------------------------------------------
// The sealing statement: the prompt rebuilt around the cadet's value, true.
// ---------------------------------------------------------------------------
function sealCandidates(item) {
  const A = texify(item.answer);
  const out = [];
  const c = item.check || {};
  if (c.kind === 'evaluate' && c.math && c.env) {
    let m = c.math;
    for (const [k, val] of Object.entries(c.env)) m = substVar(m, k, String(val));
    out.push(`${m} = ${A}`);
  }
  if (c.kind === 'solve' && c.math && c.variable && item.type === 'numeric') {
    out.push(substVar(c.math, c.variable, A));
  }
  if (c.kind === 'equivalent' && c.math) out.push(`${c.math} = ${A}`);
  if (item.type === 'expression' && item.latex
    && !/\\square/.test(item.latex) && !item.latex.includes('=')) {
    out.push(`${item.latex} = ${A}`);
  }
  const last = item.steps?.[item.steps.length - 1]?.latex;
  if (last) out.push(last.replace(/^\s*=\s*/, ''));
  out.push(A);
  return out;
}

/**
 * What a side of the beam physically *is*.
 *
 * A picture of a scale teaches nothing, because nothing about it is at stake:
 * subtract twelve from both sides and a caption changes. So each pan carries
 * the side as objects — one sealed crystal per unknown, ten-bars and unit
 * ingots for the constant — and a move removes the objects it removes. The
 * beam stays level throughout, and that is the whole lesson: it is level
 * because the statement is true, not because the piles match, so five crystals
 * and one ingot balancing thirty-one ingots *is* the equation, stated in
 * mass. Negative quantities are voids of the same size: they annihilate.
 *
 * Anything the rig cannot honestly count — a fractional coefficient, a
 * constant past two digits — is carried as one labelled slab rather than
 * faked with a pile of the wrong size.
 */
function panLoad(side) {
  const out = { xs: 0, xNeg: false, tens: 0, ones: 0, uNeg: false, xLab: false, uLab: false };
  const A = side.a, B = side.b;
  if (!fZero(A)) {
    if (A.d === 1 && Math.abs(A.n) <= 9) { out.xs = Math.abs(A.n); out.xNeg = A.n < 0; }
    else out.xLab = true;
  }
  if (!fZero(B)) {
    if (B.d === 1 && Math.abs(B.n) <= 99) {
      const n = Math.abs(B.n);
      out.tens = Math.floor(n / 10);
      out.ones = n % 10;
      out.uNeg = B.n < 0;
    } else out.uLab = true;
  }
  return out;
}
const loadCount = (L) => L.xs + L.tens + L.ones + (L.xLab ? 1 : 0) + (L.uLab ? 1 : 0);

// ---------------------------------------------------------------------------
// The eight of them are meant to sound like eight different places, and they
// read the same in en, es and pl on purpose.
// i18n-allow: surnames of the cadets who came before; a person's name is not translated
const CADETS = ['Varen', 'Okonkwo', 'Sable', 'Ito', 'Nyx', 'Halloran', 'Reyes', 'Marek'];

/**
 * A cadet's suit sigil, half-recovered: a visor with the signal still running
 * across it. Not a cartoon ghost — the cadet who left this trace was real and
 * stood where you are standing.
 */
const SVG_SIGIL = `<svg class="sig" viewBox="0 0 32 34" aria-hidden="true">
  <path d="M16 1.6 29 8.3v11.1c0 6.4-5.4 10.6-13 13-7.6-2.4-13-6.6-13-13V8.3Z"
        fill="rgba(179,155,255,.14)" stroke="#c3b1ff" stroke-width="1.3"/>
  <path d="M7.6 12.4h16.8v6.2a3 3 0 0 1-1.6 2.7l-6.8 3.4-6.8-3.4a3 3 0 0 1-1.6-2.7Z"
        fill="rgba(179,155,255,.3)" stroke="#e2d9ff" stroke-width="1"/>
  <path d="M8.8 16.4h4.4l1.4-2.4 2.2 5 1.5-2.6h4.9" fill="none" stroke="#fff" stroke-width="1.1"
        stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>
</svg>`;

function mulberry(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
function shuffled(arr, seed) {
  const r = mulberry(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** A 32-bit avalanche over a seed and a string, so `% n` reads mixed bits. */
function mixed(seed, salt) {
  let h = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
  const s = String(salt ?? '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Where the key sits among the readings.
 *
 * `_readings` builds every option set with the key FIRST, because that is the
 * only order it can build it in. So the single property the arrangement has to
 * carry is that it forgets that order completely — and it has to carry it on
 * every set the rig has ever drawn, not on average.
 *
 * A plain shuffle only *usually* does. Where the answer lands is then a
 * property of how well one particular seed happened to mix, which is a thing
 * nobody measures and nobody can state. That is not good enough for the one
 * scaffold that appears when a learner is weakest: a cadet needs to notice the
 * answer sitting first exactly once to stop reading the options at all, and
 * from that moment the surface is teaching guessing.
 *
 * So the key's slot is not left to fall out of a shuffle. It is CHOSEN — from
 * an avalanched hash of what makes this option set this option set — and the
 * distractors are shuffled into the slots left over. The distribution of the
 * answer's position is then exactly the distribution of that hash modulo the
 * option count, which is a claim that can be measured on its own and is
 * measured on every build (`tools/critic/choiceaudit.mjs`, code
 * `answer-position-biased`).
 *
 * @param {Array} pool the readings, KEY FIRST.
 * @param {number} seed this rift's seed.
 * @param {string} salt whatever else separates this set from the next one —
 *                      the answer, and which drawing of the field this is.
 */
function arranged(pool, seed, salt) {
  const n = pool.length;
  if (n < 2) return pool.slice();
  const h = mixed(seed, salt);
  const slot = h % n;
  const rest = shuffled(pool.slice(1), (h ^ 0x5bd1e995) >>> 0);
  const out = new Array(n);
  out[slot] = pool[0];
  for (let i = 0, j = 0; i < n; i++) if (i !== slot) out[i] = rest[j++];
  return out;
}

/**
 * The aperture itself.
 *
 * The rig is not a rounded rectangle floating over a photograph of the world.
 * It is the hole the tear has opened in the air, and its outline is that
 * fracture: a torn top and bottom lip, sheared corners, spalled sides. The
 * same outline is used twice — as the clip of the plate, and as the stroked,
 * glowing edge drawn over it — so the light lands exactly on the break.
 *
 * Vertices carry an offset as well as a position. Scaling those offsets by the
 * rift's remaining pressure lets the tear visibly knit shut as the statement
 * becomes true, without ever redrawing a different fracture.
 *
 * Coordinates are per-mille of the plate, so one description drives both the
 * CSS polygon (percentages) and the SVG path (a 0-1000 viewBox).
 */
function shardOutline(seed) {
  const r = mulberry(seed ^ 0x5bf03635);
  const V = [];
  const at = (x, y, ox = 0, oy = 0) => V.push([x, y, ox, oy]);
  const TOP = 9, BOT = 7, SIDE = 3;

  at(0, 40); at(34, 0);
  for (let i = 1; i < TOP; i++) at(34 + (932 * i) / TOP, 0, 0, 6 + r() * 26);
  at(966, 0); at(1000, 40);
  for (let i = 1; i < SIDE; i++) at(1000, 40 + (920 * i) / SIDE, -(3 + r() * 13), 0);
  at(1000, 960); at(966, 1000);
  for (let i = 1; i < BOT; i++) at(966 - (932 * i) / BOT, 1000, 0, -(6 + r() * 22));
  at(34, 1000); at(0, 960);
  for (let i = 1; i < SIDE; i++) at(0, 960 - (920 * i) / SIDE, 3 + r() * 13, 0);
  return V;
}

/** @param {number} open 1 = torn wide, 0 = knitted almost shut. */
function shardPoints(outline, open) {
  return outline.map(([x, y, ox, oy]) => [x + ox * open, y + oy * open]);
}
const shardCss = (pts) => `polygon(${pts.map(([x, y]) => `${(x / 10).toFixed(2)}% ${(y / 10).toFixed(2)}%`).join(',')})`;
const shardPath = (pts) => `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')}Z`;

/**
 * A panel inside the rig is a piece of the same broken lattice, not a card.
 * Its lip is torn on the same terms as the aperture — x in per-cent so it
 * tracks any width, y in pixels so a short readout and a tall one break by the
 * same amount rather than one of them growing teeth.
 */
function tornBox(seed, top = 8, bot = 6) {
  const r = mulberry(seed ^ 0x1d3f77);
  const N = 11;
  const up = [];
  const dn = [];
  for (let i = 0; i <= N; i++) {
    const x = ((100 * i) / N).toFixed(2);
    up.push(`${x}% ${(0.5 + r() * top).toFixed(1)}px`);
  }
  for (let i = N; i >= 0; i--) {
    const x = ((100 * i) / N).toFixed(2);
    dn.push(`${x}% calc(100% - ${(0.5 + r() * bot).toFixed(1)}px)`);
  }
  return `polygon(${up.concat(dn).join(',')})`;
}

/**
 * Filaments of lattice still hanging off the torn lips, inside the rig.
 *
 * They are what makes the interior belong to the aperture rather than sit
 * behind it: the light that breaks the top edge does not stop at the edge, it
 * runs down into the cavity and frays out.
 */
function veinPaths(seed) {
  const r = mulberry(seed ^ 0x77a1c3);
  const strand = (x0, from, dir, len) => {
    let y = from;
    let x = x0;
    let d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
    const end = from + dir * len;
    while (dir > 0 ? y < end : y > end) {
      y += dir * (26 + r() * 52);
      x += (r() - 0.5) * 38;
      d += `L${x.toFixed(0)} ${(dir > 0 ? Math.min(y, end) : Math.max(y, end)).toFixed(0)}`;
    }
    return d;
  };
  const out = [];
  for (let i = 0; i < 15; i++) out.push(strand(24 + r() * 952, 0, 1, 60 + r() * 210));
  for (let i = 0; i < 9; i++) out.push(strand(24 + r() * 952, 1000, -1, 50 + r() * 160));
  return out;
}

// ---------------------------------------------------------------------------
// Figures. Some items come with a diagram spec; it is part of the question.
// ---------------------------------------------------------------------------
export function figureHtml(fig) {
  if (!fig) return '';
  if (fig.kind === 'rect') return rectSvg(fig);
  if (fig.kind === 'line' || fig.kind === 'lines') return gridSvg(fig);
  return '';
}

/**
 * A rectangle whose two sides are expressions.
 *
 * THE LABEL BOXES LIVE INSIDE THE VIEWBOX. An SVG clips at its viewBox, so a
 * label box that hangs over the edge is not "slightly cropped" — it is a
 * different label. This drawing used to put the height label in a 90-unit box
 * starting at unit 362 of a 396-unit viewBox: 56 of those 90 units were outside
 * the picture. `m + 15` rendered, centred, and then had 72% of its ink cut off,
 * so the side of a hatch that the prose called `m + 15` was drawn as `m`. A
 * learner who trusted the drawing summed 2(3m + 6) + 2(m) and was marked wrong
 * for reading the picture we gave them. That is the worst failure this product
 * has, because nothing about it looks broken.
 *
 * So the plate is drawn narrower than the viewBox and every label box is
 * budgeted out of the remainder, with slack to spare for the widest side the
 * bank can print. `tools/check-figures.mjs --render` measures the real ink of
 * every label the bank can produce against this clip edge, so the budget is a
 * checked claim rather than a comment.
 */
const RECT_LABEL_W = 96;   // the height label's own box, inside the viewBox
const RECT_GUTTER = 8;     // between the plate and that box

function rectSvg(fig) {
  const VW = 396, VH = 212;                                   // the viewBox, unchanged
  const x = 24, y = 34, h = 150;                              // the plate
  const w = VW - x - RECT_GUTTER - RECT_LABEL_W - 4;          // 264
  const lx = x + w + RECT_GUTTER;                             // the label box, fully inside VW
  return `<div class="rf-fig">
    <svg viewBox="0 0 ${VW} ${VH}" role="img">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(95,230,255,.07)" stroke="#5fe6ff" stroke-width="1.4"/>
      <path d="M${x} ${y - 12} h${w}" stroke="rgba(95,230,255,.5)" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="M${x + w + 4} ${y} v${h}" stroke="rgba(95,230,255,.5)" stroke-width="1" stroke-dasharray="3 3"/>
      <foreignObject x="${x}" y="0" width="${w}" height="22">
        <div class="figlabel" data-fig="w" xmlns="http://www.w3.org/1999/xhtml">${texFirst([fig.wLabel]) || ''}</div>
      </foreignObject>
      <foreignObject x="${lx}" y="${y + h / 2 - 14}" width="${RECT_LABEL_W}" height="28">
        <div class="figlabel" data-fig="h" xmlns="http://www.w3.org/1999/xhtml">${texFirst([fig.hLabel]) || ''}</div>
      </foreignObject>
    </svg></div>`;
}

function gridSvg(fig) {
  const R = fig.range || 10;
  const S = 300, pad = 16, k = (S - pad * 2) / (2 * R);
  const X = (x) => pad + (x + R) * k;
  const Y = (y) => pad + (R - y) * k;
  const clip = (m, b) => {
    const pts = [];
    for (const [x, y] of [[-R, m * -R + b], [R, m * R + b]]) pts.push([x, y]);
    return pts;
  };
  let g = '';
  for (let i = -R; i <= R; i += Math.max(1, Math.round(R / 5))) {
    g += `<path d="M${X(i)} ${pad} V${S - pad}" class="gl"/><path d="M${pad} ${Y(i)} H${S - pad}" class="gl"/>`;
  }
  g += `<path d="M${X(0)} ${pad} V${S - pad}" class="ax"/><path d="M${pad} ${Y(0)} H${S - pad}" class="ax"/>`;
  // Scale numerals: a trace you cannot read a value off is a decoration.
  const lab = Math.max(2, Math.round(R / 3));
  for (let i = -R + (R % lab); i <= R; i += lab) {
    if (i === 0 || Math.abs(i) > R - 1) continue;
    g += `<text x="${X(i)}" y="${Y(0) + 12}" text-anchor="middle" fill="rgba(159,179,208,.8)" font-size="9">${i}</text>`;
    g += `<text x="${X(0) - 6}" y="${Y(i) + 3.2}" text-anchor="end" fill="rgba(159,179,208,.8)" font-size="9">${i}</text>`;
  }
  g += `<text x="${S - pad - 2}" y="${Y(0) - 7}" text-anchor="end" fill="rgba(95,230,255,.85)" font-size="11" font-style="italic">x</text>`;
  g += `<text x="${X(0) + 7}" y="${pad + 10}" fill="rgba(95,230,255,.85)" font-size="11" font-style="italic">y</text>`;
  if (fig.at != null) g += `<path d="M${X(fig.at)} ${pad} V${S - pad}" class="tg"/>`;

  const lines = fig.kind === 'lines' ? fig.lines : [{ m: fig.m, b: fig.b }];
  const hues = ['#5fe6ff', '#ffc25f'];
  lines.forEach((ln, i) => {
    const p = clip(ln.m, ln.b);
    g += `<path d="M${X(p[0][0])} ${Y(p[0][1])} L${X(p[1][0])} ${Y(p[1][1])}" class="ln" stroke="${hues[i % 2]}"/>`;
  });
  for (const [x, y] of fig.points || []) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="3.4" class="pt"/>`;
  if (fig.target != null) {
    g += `<path d="M${pad} ${Y(fig.target)} H${S - pad}" class="tg"/>`;
  }
  if (fig.showMark && fig.mark) g += `<circle cx="${X(fig.mark[0])}" cy="${Y(fig.mark[1])}" r="5" class="mk"/>`;
  return `<div class="rf-fig grid"><svg viewBox="0 0 ${S} ${S}" role="img">${g}</svg></div>`;
}

// ---------------------------------------------------------------------------
// Drag that works with a mouse, a finger and a keyboard.
// ---------------------------------------------------------------------------
function hitTest(x, y, targets) {
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
  }
  return null;
}

/**
 * ONE POINTER LISTENER FOR EVERY DRAGGABLE CONTROL IN THE RIG.
 *
 * The balance rebuilds its tray of moves after every step a learner takes, the
 * sorting bays rebuild their chips, and each of those controls used to be
 * handed a `pointerdown` and a `click` listener of its own. Over a real
 * fifteen-minute session (`tools/critic/sustain.mjs`) that is hundreds of
 * registrations a minute on nodes that live for one interaction — and the
 * measurement that matters is not the listener count, it is that the frame's
 * 1% low was 6.9 fps by minute fifteen while the median said 74. That is a
 * garbage collector, and this is some of what it was collecting.
 *
 * So the document listens once and the controls carry only their options. The
 * registry is a WeakMap keyed on the element: a control that is thrown away
 * takes its entry with it, and nothing has to remember to unregister anything.
 */
const DRAGGABLE = new WeakMap();
let dragListening = false;

function draggable(el, opts) {
  if (!dragListening) {
    dragListening = true;
    document.addEventListener('pointerdown', (e) => {
      const hit = e.target?.closest?.('[data-rf-drag]');
      const o = hit && DRAGGABLE.get(hit);
      if (o) beginDrag(hit, o, e);
    });
    // keyboard-generated clicks only (detail === 0); pointer taps arrive via `up`
    document.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      const hit = e.target?.closest?.('[data-rf-drag]');
      if (hit) DRAGGABLE.get(hit)?.onTap?.();
    });
  }
  el.dataset.rfDrag = '1';
  DRAGGABLE.set(el, opts);
}

function beginDrag(el, { targets, onDrop, onTap }, e) {
  if (el.disabled || (e.button != null && e.button > 0)) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  let dragging = false, ghost = null, hot = null;
  try { el.setPointerCapture(e.pointerId); } catch { /* not capturable */ }

  const move = (ev) => {
    if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 7) {
      dragging = true;
      el.classList.add('dragging');
      ghost = document.createElement('div');
      ghost.className = 'rf-drag-ghost';
      ghost.innerHTML = el.innerHTML;
      document.body.appendChild(ghost);
    }
    if (!dragging) return;
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    const under = hitTest(ev.clientX, ev.clientY, targets());
    if (under !== hot) { hot?.classList.remove('drop-hot'); hot = under; hot?.classList.add('drop-hot'); }
  };
  const up = (ev) => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.classList.remove('dragging');
    ghost?.remove();
    hot?.classList.remove('drop-hot');
    if (dragging) {
      const target = hitTest(ev.clientX, ev.clientY, targets());
      if (target) onDrop?.(target);
    } else {
      onTap?.();
    }
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

// ===========================================================================
export class RiftPanel {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'rift';
    this.el.innerHTML = `
      <div class="rf-spill"></div>
      <div class="rf-motes" id="rf-motes"></div>
      <div class="rf-frame" role="dialog" aria-modal="true">
        <div class="rf-plate" id="rf-plate">
          <div class="rf-sweep"></div>
          <svg class="rf-veins" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"></svg>
          <svg class="rf-edge" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <path class="e-glow" /><path class="e-hot" /><path class="e-core" />
          </svg>
          <header class="rf-head">
            <span class="rf-ident" id="rf-ident"></span>
            <span class="rf-kind" id="rf-kind"></span>
            <span class="rf-streak" id="rf-streak"></span>
            <div class="rf-gauge" id="rf-gauge-box"><label id="rf-gauge-label"></label>
              <div class="track"><i id="rf-gauge"></i></div>
              <b id="rf-gauge-num">100</b></div>
            <button class="rf-x" id="rf-close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="rf-stmtwrap">
            <div class="rf-statement" id="rf-statement">
              <div class="rf-stmt-in" id="rf-statement-in">
                <p class="rf-ask" id="rf-stem"></p>
                <div class="rf-prompt" id="rf-prompt"></div>
              </div>
            </div>
          </div>
          <section class="rf-stage">
            <div class="rf-inner">
              <div class="rf-figbox" id="rf-figure"></div>
              <div class="rf-work" id="rf-work"></div>
            </div>
          </section>
          <aside class="rf-echo">
            <div class="rf-echo-head">
              ${SVG_SIGIL}
              <span class="who"><span id="rf-echo-who"></span><b id="rf-echo-label"></b></span>
              <span class="depth" id="rf-echo-depth"></span>
            </div>
            <div class="rf-echo-body" id="rf-echo"></div>
            <div class="rf-echo-tail" id="rf-echo-tail"></div>
            <div class="rf-strata" id="rf-echo-rail"></div>
          </aside>
          <footer class="rf-foot">
            <button class="rf-btn ghosty" id="rf-hint"></button>
            <button class="rf-btn rf-return" id="rf-back"></button>
            <div class="rf-help" id="rf-help"></div>
          </footer>
        </div>
      </div>
      <div class="rf-weld" aria-hidden="true">
        <div class="wd-heat"></div>
        <div class="wd-seam"><i class="bloom"></i><i class="core"></i></div>
        <div class="rf-shards" id="rf-shards"></div>
        <div class="wd-stack">
          <div class="wd-eq" id="rf-stamp-eq"></div>
          <div class="wd-read">
            <span class="wd-mark" id="rf-stamp"></span>
            <span class="wd-grip">
              <i id="rf-seal-lab"></i>
              <span class="bar"><b id="rf-seal-bar"></b></span>
              <em id="rf-seal-pct"></em>
            </span>
            <span class="wd-shards" id="rf-stamp-sub"></span>
          </div>
        </div>
      </div>`;
    root.appendChild(this.el);

    this.$ = (s) => this.el.querySelector(s);

    /**
     * ONE CLICK LISTENER FOR EVERY CONTROL THE MODALITIES BUILD.
     *
     * `_mount` rebuilds the whole instrument for every item — a keypad is
     * seventeen buttons, a balance is four movers and an undo, a narrowed field
     * is four readings — and each of those buttons used to carry a listener and
     * a closure of its own. Over a real fifteen-minute session that is four and
     * a half thousand registrations on nodes that are thrown away a minute
     * later, and `tools/critic/sustain.mjs` measured what it costs: the frame's
     * 1% low fell to 6.9 fps by minute fifteen, which is a garbage collector
     * doing the work, not a renderer.
     *
     * So the panel listens once, here, and the controls carry only a function.
     * The registry is a WeakMap keyed on the element, so a control that is
     * thrown away takes its handler with it and nothing has to remember to
     * unregister anything — which is the failure mode a manual registry has.
     */
    this._clicks = new WeakMap();
    this.el.addEventListener('click', (e) => {
      for (let n = e.target; n && n !== this.el; n = n.parentElement) {
        const fn = this._clicks.get(n);
        if (fn) { fn(e); return; }
      }
    });

    this.$('#rf-close').addEventListener('click', () => this.close());
    this._motes();
    this.$('#rf-hint').addEventListener('click', () => this.revealStep(true));
    // Narrow surfaces cannot hold the tear and the trace at once, so the rig
    // re-tunes between them rather than shrinking both into unreadability. The
    // statement never leaves the screen; only the instrument stands down.
    this.$('#rf-back').addEventListener('click', () => this._setEchoOpen(!this.echoOpen));
    this.open = false;
    this.mode = null;
    this._collapse = 1;
    this._onKey = (e) => this._key(e);

    // The rig has no scroller, so the only thing standing between a long word
    // problem and a clipped one is this: whenever the room changes, the rig is
    // re-cut to the room. A resize, a language with longer sentences, the echo
    // column opening — all of them land here.
    this._onResize = () => { this._syncLayout(); this._fit(); };
    window.addEventListener('resize', this._onResize);
    // Belt and braces on the one failure this surface exists not to have. If a
    // box in the rig ever does become a scroller, the browser will scroll a
    // focused control into view inside it and carry everything above that
    // control off the top edge, silently and unrecoverably. Any scroll in here
    // is therefore snapped straight back — the fit pass is what is supposed to
    // make it unnecessary, and this is what makes a failure of it visible
    // rather than invisible.
    this.el.addEventListener('scroll', (e) => {
      const el = e.target;
      if (el && el.nodeType === 1) { el.scrollTop = 0; el.scrollLeft = 0; }
    }, true);
    if (typeof ResizeObserver !== 'undefined') {
      let queued = false;
      this._ro = new ResizeObserver(() => {
        if (queued || !this.open || this._fitting) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; this._fit(); });
      });
      this._ro.observe(this.$('.rf-inner'));
      this._ro.observe(this.$('#rf-echo'));
      this._ro.observe(this.$('.rf-echo'));
    }
    this._narrowMq = typeof matchMedia === 'function' ? matchMedia('(max-width: 1040px)') : null;
    this._narrowMq?.addEventListener?.('change', () => { this._syncLayout(); this._fit(); });
  }

  /**
   * The height a box's content genuinely needs.
   *
   * `scrollHeight` on its own is not just insufficient here, it is actively
   * misleading: once a *descendant* is allowed to absorb an overflow, every
   * ancestor reports a scrollHeight equal to its own client height and swears
   * the surface fits while a stratum of the trace sits above the top edge. So
   * the need is taken off the children's own rectangles — which no amount of
   * clipping can lie about — and scrollHeight is only ever used to raise it.
   *
   * Absolutely positioned children are skipped on purpose: the balance's arm,
   * its hanging pans and the plate's own light are drawn out of flow and are
   * meant to hang past their box.
   */
  _need(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    let need = -1;
    for (const c of el.children) {
      const ccs = getComputedStyle(c);
      if (ccs.position === 'absolute' || ccs.position === 'fixed' || ccs.display === 'none') continue;
      const cr = c.getBoundingClientRect();
      if (cr.height <= 0) continue;
      need = Math.max(need, cr.bottom + (parseFloat(ccs.marginBottom) || 0) - r.top - bt + pb);
    }
    // `scrollHeight` catches what the children's rectangles cannot: a bare line
    // of text in a keycap, a katex strut, a box with nothing in flow at all.
    // It is only ever allowed to raise the number, never to be the whole of it,
    // because it also counts decoration drawn deliberately past the edge.
    return Math.max(need, el.scrollHeight);
  }

  /**
   * True the instant anything in the rig is holding more than it can show.
   *
   * Deliberately a yes/no with an early exit rather than a magnitude: the fit
   * pass searches for the largest unit that fits instead of extrapolating one
   * from how badly it does not, so the size of the overflow buys nothing and
   * measuring every box to find it costs a full layout each time.
   */
  _clipped() {
    for (const el of this.el.querySelectorAll(FIT_BOXES)) {
      if (!el.clientHeight || !el.offsetParent) continue;
      if (this._need(el) - el.clientHeight > 1) return true;
    }
    return false;
  }

  /**
   * Cut the rig down until it fits the tear.
   *
   * A learning surface that scrolls has already failed: the cadet has to
   * discover that there is more, and the thing that ends the turn can be below
   * the fold at the exact moment they want it. Worse, a box that scrolls
   * *itself* will quietly carry earlier scaffolding above its own top edge and
   * leave a hairline thumb as the only evidence it ever existed. So nothing in
   * this panel scrolls, no box in it has a height of its own, and every box
   * that could still clip is measured on every pass.
   *
   * Every physical dimension in the rig — key travel, socket depth, the beam's
   * headroom, the air between instruments, the type in the echo — is a multiple
   * of one unit, and the rig is set at the LARGEST unit that fits. That word is
   * the whole of the difference: an earlier version only ever stepped the unit
   * downward, extrapolating each step from the size of the overflow, so one
   * bad guess left the rig at half size for the rest of the turn with two
   * hundred pixels of unused window above and below it. This bisects instead —
   * so the surface is as big as the window will allow, and the echo opening
   * *grows* the stage rather than eating rows off it.
   *
   * The order in which things give is the rest of it. Air goes first. Then,
   * only if the surface still does not fit at a size worth reading, the prose
   * the cadet can most afford to lose: the coaching line, then the reasons hung
   * off the trace. The unit is only driven down into illegibility as a last
   * resort, and a step of the mathematics is never dropped and never cut off.
   */
  _search() {
    const set = (x) => { this.el.style.setProperty('--rf-u', x.toFixed(4)); return !this._clipped(); };
    this.el.classList.remove('thin', 'thinner');
    // Full size first, and again at every later stage: dropping the coaching
    // line may be all it takes to hold the rig at its proper scale.
    for (const [floor, cls] of [[0.82, null], [0.82, 'thin'], [0.82, 'thinner'], [0.54, 'thinner']]) {
      if (cls) this.el.classList.add(cls);
      if (set(1)) return true;
      if (!set(floor)) continue;          // this stage cannot hold it even at its floor
      let lo = floor;
      let hi = 1;
      for (let i = 0; i < 5; i++) {       // ~1.5% resolution: finer than an eye can see
        const mid = (lo + hi) / 2;
        if (set(mid)) lo = mid; else hi = mid;
      }
      set(lo);
      return true;
    }
    set(0.54);
    return false;
  }

  /**
   * The ladder the rig climbs down when the room runs out, in order of cost.
   *
   *   1  as the room allows      — side by side on a wide surface, stacked on a
   *                                narrow one, at the largest unit that fits.
   *   2  stacked                 — the trace stops being a column beside the
   *                                tear and becomes a band above it, across the
   *                                full width. It reflows; it does not clip.
   *   3  the instrument stands down — the last resort, one labelled press from
   *                                coming back.
   *
   * Stage 2 used to be reachable only under a width test, which meant a short
   * WIDE window — 1280x720 with the trace dug to depth four is the everyday
   * case — had exactly one thing left to give when the column ran out of room,
   * and that was the plate's `overflow: hidden`. The plate cannot be allowed to
   * be the answer to anything: it is the one clipper in the rig and what it
   * clips off the bottom of the stage is the key that ends the turn. So the
   * reflow is now available at every width, on the evidence of a measurement.
   */
  _fit() {
    if (!this.open || this._settled) return;
    const plate = this.$('#rf-plate');
    if (!plate) return;
    this._fitting = true;
    const rungs = [[false, false], [true, false], [true, true]];
    for (const [stack, stood] of rungs) {
      this._forceStack = stack;
      this._stood = stood;
      this._syncLayout();
      if (this._search()) break;
      // Neither reflow means anything with no trace on the surface, and neither
      // is worth a second full bisect to prove it.
      if (!this.echoOpen) break;
    }
    this._fitWide();
    this._dressTail();
    this._fitting = false;
    this._drawAperture();
  }

  /**
   * The substrate under the trace carries a line of legend, and it is the only
   * thing in the panel that is allowed to simply not be printed: it is dressing
   * on the room the trace did not need. Whether there is room for it is decided
   * here, off the box's real measured height, because the alternative — a
   * container query — would have meant declaring the box size-contained, and a
   * size-contained box is a fixed-height box with a licence to hide things.
   */
  _dressTail() {
    const tail = this.$('#rf-echo-tail');
    if (!tail) return;
    tail.classList.toggle('roomy', tail.clientHeight >= 74 && !!tail.textContent.trim());
  }

  /**
   * Wide surfaces hold the tear and the trace side by side; narrow ones do not.
   * Measured off the rig's own box rather than a media query, so a window that
   * changes size without firing one still lands in the right layout.
   */
  _isNarrow() {
    const w = this.el?.clientWidth || window.innerWidth;
    return w <= 1040 || !!this._narrowMq?.matches;
  }

  /**
   * On a narrow surface the echo takes the body of the rig and the instrument
   * stands down — because the alternative is two half-height panes, and a
   * half-height keypad is a keypad with the SET key cut off it.
   */
  _setEchoOpen(on) {
    this.echoOpen = !!on && this.echoTier > 0;
    this.el.classList.toggle('echo-on', this.echoOpen);
    this._syncLayout();
    this._fit();
    requestAnimationFrame(() => this._fit());
  }

  _syncLayout() {
    const narrow = this._isNarrow();
    const both = (narrow || !!this._forceStack) && this.echoOpen;
    this.el.classList.toggle('stack', both && !this._stood);
    this.el.classList.toggle('solo', both && !!this._stood);
    const back = this.$('#rf-back');
    // The way back to the instrument has to be on screen in every layout that
    // can stand it down, not merely in the narrow ones.
    back.style.display = (narrow || both) && this.echoTier > 0 ? 'inline-block' : 'none';
    back.textContent = this.echoOpen ? t('rift.echo.backToTear') : t('rift.echo.backToTrace');
  }

  /**
   * A designation, not an index. Rifts are not numbered lessons — this is the
   * tear's own catalogue mark in the lattice survey, and it says nothing about
   * how far through a syllabus anybody is.
   */
  _ident() {
    const r = mulberry(this.seed + 991);
    const glyph = 'ΔΘΛΞΣΨΩΦ'[Math.floor(r() * 8)];
    return `${1 + Math.floor(r() * 8)}${glyph}-${100 + Math.floor(r() * 899)}`;
  }

  // -------------------------------------------------------------- lifecycle
  /**
   * @param {object} item generated item
   * @param {object} opts { title, skillId, tier, streak, onAnswer(correct, meta), onClose() }
   */
  show(item, opts = {}) {
    this.item = item;
    this.opts = opts;
    this._token = (this._token || 0) + 1;
    this.revealed = 0;
    this.assisted = false;
    this.wrongCount = 0;
    this.reported = 0;
    this._settled = false;
    this._hadExample = false;
    // The echo is not on the card. It is at depth 0 — absent — until the cadet
    // calls it or until the rig has something concrete to say about their
    // thinking. A heavy scaffold only means it comes back one layer deeper.
    this.echoTier = 0;
    this.echoView = 0;
    this.echoOpen = false;
    this.echoMis = null;
    this.lastEntry = null;
    this._an = undefined;
    this._anMis = undefined;
    this._stood = false;
    this._forceStack = false;
    this.el.classList.remove('sealing', 'stable', 'echo-on', 'narrowed', 'solo', 'stack', 'thin', 'thinner');

    const seed = (item.seed || 1) >>> 0;
    this.seed = seed;
    this.cadet = CADETS[seed % CADETS.length];
    this.arc = 3 + (seed % 47);

    this.$('#rf-ident').textContent = t('rift.ident', { code: this._ident() });
    this.$('#rf-gauge-label').textContent = t('rift.pressure');
    this.$('#rf-close').setAttribute('aria-label', t('rift.close'));
    this.$('#rf-close').title = t('rift.close');

    // Why this item, not the next one. The scheduler's reason, stated in world
    // terms — a proving run reads as a proving run, never as "quiz mode".
    const kindEl = this.$('#rf-kind');
    const kind = opts.kind;
    kindEl.className = `rf-kind is-${kind || 'learn'}`;
    if (kind === 'check') {
      kindEl.textContent = t('rift.kind.check', { n: (opts.check?.done ?? 0) + 1, m: opts.check?.need ?? 3 });
    } else if (kind === 'deep') {
      // endgame (one branch, additive): a rung of a sounding. Carries its own
      // number because the depth of the descent is the whole point of it.
      kindEl.textContent = t('rift.kind.deep', { n: opts.sounding?.rung ?? 1 });
    } else if (kind === 'review' || kind === 'interleave' || kind === 'probe' || kind === 'retrieval') {
      // pedagogy (one line, additive): 'probe' is the sight-read — the item a
      // new skill opens with, before it teaches anything.
      //
      // 'retrieval' is the scheduler's name for the interleaved item it draws
      // from a mastered prerequisite when practice has gone blocked. The string
      // for it has existed in all three locales as `interleave` ("From memory")
      // since it was written, and never once reached the screen, because the
      // engine has always called that kind `retrieval` and this line did not.
      // So an item on a line the learner had already proved arrived wearing no
      // label at all — which is exactly the thing a re-served held skill must
      // never do. Mapped rather than renamed: the kind name is read by
      // tools/simulate.mjs, src/report and src/session too.
      kindEl.textContent = t('rift.kind.' + (kind === 'retrieval' ? 'interleave' : kind));
    } else {
      kindEl.textContent = '';
    }
    kindEl.style.display = kindEl.textContent ? '' : 'none';
    this.$('#rf-streak').textContent = opts.streak > 1 ? t('rift.streak', { n: opts.streak }) : '';
    // A live proving run withholds every scaffold this rig has. See `_proving`.
    this._proving = kind === 'check';
    this.$('#rf-hint').textContent = t('rift.echo.call');
    this.$('#rf-hint').disabled = false;
    this.$('#rf-hint').hidden = this._proving;
    this.$('#rf-echo-rail').innerHTML = '';
    this.$('#rf-echo-depth').textContent = '';
    // …and the trace itself. The rail and the depth badge were cleared here;
    // the COLUMN was not, so a fresh rift carried the previous rift's worked
    // echo in its markup until something dug a new one over the top. CSS keeps
    // `.rf-echo` at `display: none` until a layer is cut, so no cadet has read
    // it — but a card that says PROVING RUN is a card that must not be holding
    // an old cadet's solve anywhere, visible or not, and a screen reader does
    // not consult the stylesheet before it reads. Found by
    // tools/critic/scaffoldhonesty.mjs, which counts the rows.
    this.$('#rf-echo').innerHTML = '';
    this.$('#rf-echo-tail').innerHTML = '';
    this._syncLayout();

    const stem = this.$('#rf-stem');
    stem.innerHTML = texProse(item.stem || '');
    stem.style.display = item.stem ? '' : 'none';

    // AN ITEM MAY HAVE NOTHING TO DISPLAY, AND THEN IT DISPLAYS NOTHING.
    // The plate used to be printed unconditionally, so a form with no useful
    // display had to invent one — which is how "which equation says what
    // happened in the butt?" came to draw `x □ □ = □`, three empty boxes in
    // the same glyph as an unfilled answer socket. The stem two lines above
    // already hides itself when it is empty; the display now does the same.
    const prompt = this.$('#rf-prompt');
    prompt.classList.remove('flash');
    prompt.innerHTML = item.latex
      ? (texFirst([item.latex], { display: true }) || tex(item.latex, { display: true }))
      : '';
    prompt.style.display = item.latex ? '' : 'none';

    const consumed = item.figure && (item.figure.kind === 'balance' || item.figure.kind === 'area');
    this.$('#rf-figure').innerHTML = consumed ? '' : figureHtml(item.figure);

    this.$('#rf-echo-label').textContent = t('rift.echo.label');
    this.$('#rf-echo-who').textContent = t('rift.echo.cadet', { name: this.cadet, n: this.arc });
    this._outline = shardOutline(seed);
    this._collapse = 1;

    // Same fracture, three places: the aperture, the filaments hanging inside
    // it, and the lip of the readout the statement is printed on.
    this.$('.rf-veins').innerHTML = veinPaths(seed)
      .map((d) => `<path d="${d}"/>`).join('');
    const torn = tornBox(seed);
    this.$('#rf-statement').style.clipPath = torn;
    this.$('#rf-statement-in').style.clipPath = torn;

    for (const s of ['#rf-work', '#rf-figure', '#rf-prompt', '#rf-stem']) this.$(s).classList.remove('dimmed');
    this.$('#rf-stamp-eq').innerHTML = '';
    this.$('#rf-shards').innerHTML = '';
    this.$('#rf-seal-bar').style.width = '0%';
    this.pressure = 1;
    this.setPressure(1, true);
    this._mount();

    this.el.classList.add('show');
    this.open = true;
    window.addEventListener('keydown', this._onKey);
    // Twice: once now, and once after KaTeX has settled the line heights, or
    // the rig is cut to a size the mathematics has not finished asking for.
    this._fit();
    requestAnimationFrame(() => this._fit());
  }

  /**
   * Give one control a click handler, without giving it a listener.
   * See the WeakMap in the constructor for why.
   */
  _click(el, fn) { this._clicks.set(el, fn); return el; }

  close() {
    if (!this.open) return;
    this.el.classList.remove('show', 'sealing');
    window.removeEventListener('keydown', this._onKey);
    this.open = false;
    this._settled = false;
    this.echoOpen = false;
    this.$('#rf-hint').disabled = false;
    this.opts?.onClose?.();
  }

  _key(e) {
    if (!this.open || this._settled) return;
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    this._modality?.key?.(e);
  }

  // ------------------------------------------------------------ instruments
  /**
   * How much of the tear is still open.
   *
   * One rule, so the number means something: it only ever falls, and only when
   * the cadet has actually taken ground off the tear. A slip does not move it —
   * a meter that drops for a wrong answer and drops for a right one is telling
   * the learner nothing. Slips flare the gauge instead and leave the reading be.
   *
   * WHERE IT IS SHOWN AT ALL is decided in `_mount`, and that is the harder
   * half. Three of the six surfaces take a statement apart into countable
   * pieces — terms to file, parts of a field to cover, a distance the unknown
   * still has to travel — and on those the number falls, piece by piece, in
   * front of the cadet. The other three ask for one action. On those the meter
   * read `STILL OPEN ▮▮▮▮▮ 100` from the moment the rift opened, sat at 100
   * through every attempt, and dropped to 0 on the seal: a two-state flag
   * wearing a hundred graduations, which is a lie about precision the rig does
   * not have and does not need. So it is not drawn there. A gauge that is
   * absent claims nothing; a gauge that is present is counting.
   *
   * The aperture is a separate matter and still tracks `pressure` everywhere:
   * the tear knitting shut as the statement comes true is a picture of the
   * world, not a readout, and it is honest on every surface.
   *
   * @param {number} p 1 = torn wide open, 0 = the statement is true.
   * @param {boolean} reset re-arm the meter for a fresh rift.
   */
  setPressure(p, reset = false) {
    const want = Math.max(0, Math.min(1, p));
    const prev = this.pressure ?? 1;
    this.pressure = reset ? want : Math.min(prev, want);
    const pc = Math.round(this.pressure * 100);
    this.$('#rf-gauge').style.width = `${pc}%`;
    this.$('#rf-gauge-num').textContent = String(pc);
    this.el.classList.toggle('stable', this.pressure <= 0.34);
    if (!reset && this.pressure < prev - 0.001) this._pulseGauge('drop');
    this._drawAperture();
  }

  /**
   * The tear knits shut as its pressure falls: same fracture, less of it.
   *
   * `_collapse` is the closing beat and runs on the same outline — the rift
   * does not dissolve into a reward screen, it shuts, and what shuts is the
   * fracture the cadet has been looking at for the last two minutes.
   */
  _drawAperture() {
    if (!this._outline) return;
    const open = 0.14 + 0.86 * (this.pressure ?? 1);
    let pts = shardPoints(this._outline, open);
    const c = this._collapse ?? 1;
    if (c < 1) {
      const k = 0.88 + 0.12 * c;
      pts = pts.map(([x, y]) => [500 + (x - 500) * k, 500 + (y - 500) * c]);
    }
    this.$('#rf-plate').style.clipPath = shardCss(pts);
    const d = shardPath(pts);
    for (const path of this.el.querySelectorAll('.rf-edge path')) path.setAttribute('d', d);
  }

  _pulseGauge(cls) {
    const g = this.$('#rf-gauge-box');
    g.classList.remove('hit', 'drop');
    void g.offsetWidth;
    g.classList.add(cls);
  }

  /** Lattice dust caught in the draught around the tear. */
  _motes() {
    const box = this.$('#rf-motes');
    const r = mulberry(20260809);
    for (let i = 0; i < 26; i++) {
      const m = document.createElement('i');
      // Kept inside the frame on purpose: a mote that drifts past the right
      // edge leaves scrollable overflow behind it, which reads to any
      // measurement exactly like content that does not fit.
      m.style.left = `${10 + r() * 66}%`;
      m.style.top = `${10 + r() * 80}%`;
      m.style.setProperty('--mx', `${(r() - 0.5) * 170}px`);
      m.style.setProperty('--my', `${-90 - r() * 240}px`);
      m.style.animationDuration = `${7 + r() * 9}s`;
      m.style.animationDelay = `${-r() * 12}s`;
      box.appendChild(m);
    }
  }

  _say(msg, warn = false) {
    const help = this.$('#rf-help');
    help.innerHTML = texProse(msg);
    help.classList.toggle('warn', !!warn);
  }

  // --------------------------------------------------------------- outcomes
  /**
   * A slip. Never a penalty, and never a score: it buys a layer of the echo and
   * nothing is taken away. The gauge flares and holds its reading, because a
   * wrong entry has not opened the tear any wider — it has just not closed it.
   */
  _miss(misconception, message, entry) {
    if (this._settled) return;
    // What they actually handed in. The echo's first layer is built out of it:
    // their own value, put back into the statement, refusing to fit.
    if (entry != null && String(entry).trim()) this.lastEntry = String(entry).trim();
    this.wrongCount++;
    this.assisted = true;
    if (this.reported < 2) {
      this.reported++;
      this.opts?.onAnswer?.(false, { assisted: true, misconception: misconception || null });
    }
    // The run's claim was on the attempt that has just been spent. It is spent
    // for this item whatever happens next, so the ladder comes back and the
    // chip stops calling this a proving run. (see `_endProving`)
    const wasProving = this._proving;
    this._endProving();
    const note = message || t('marlow.encourage');
    this._say(wasProving ? `${t('rift.provingOff')} ${note}` : note, true);
    this._pulseGauge('hit');
    this._pushEcho(misconception);
  }

  /**
   * The statement is true, so the tear has nothing left to hold it open.
   *
   * There is no prize screen here. A gold shield with a tick on it is a thing
   * that happens to an app; what has to happen is a thing in the world. So the
   * rig goes dark, the fracture the cadet has been staring at for two minutes
   * *shuts* — the same outline, driven to a line — and the statement they made
   * true is welded along the seam, because the statement is what closes it.
   *
   * The instrumentation that survives is instrumentation: how much of this
   * line the lattice now grips, and what the tear gave up. Read off the weld,
   * in the rig's own monospace, at the size of a readout and not a headline.
   */
  _solve() {
    if (this._settled) return;
    this._settled = true;
    const assisted = this.assisted;
    const n = assisted ? 1 : 3;
    this.setPressure(0);
    const res = this.opts?.onAnswer?.(true, { assisted, misconception: null }) || null;
    const token = this._token;

    this.$('#rf-work').classList.add('dimmed');
    this.$('#rf-figure').classList.add('dimmed');
    this.$('#rf-prompt').classList.add('dimmed');
    this.$('#rf-stem').classList.add('dimmed');
    this.$('#rf-hint').disabled = true;
    this.el.classList.add('sealing');
    this._say(t('rift.trueNow'));

    this.$('#rf-stamp').textContent = res?.justMastered ? t('rift.seal.line') : t('rift.sealed');
    this.$('#rf-stamp-sub').textContent = t('rift.shards', { n: res?.gained ?? n });
    this.$('#rf-stamp-eq').innerHTML = texFirst(sealCandidates(this.item), { display: true }) || '';

    // The meter that actually means something: how much of this line the rig
    // now trusts. It ticks up from where the cadet was before this answer, so
    // the gain is a thing you watch happen rather than a number you are told.
    const to = Math.round(Math.max(0, Math.min(1, res?.pL ?? 1)) * 100);
    const from = Math.round(Math.max(0, Math.min(1, res?.prev ?? Math.max(0, (res?.pL ?? 1) - 0.12))) * 100);
    this.$('#rf-seal-lab').textContent = t('rift.seal.grip');
    const bar = this.$('#rf-seal-bar');
    const pct = this.$('#rf-seal-pct');
    bar.style.transition = 'none';
    bar.style.width = `${from}%`;
    // `${n}%` is an English percentage. Spanish sets a space before the sign
    // (RAE: "60 %"), Polish does not, and the HUD's own readout already went
    // through `pct()` — so the seal meter printed "60%" two inches under a
    // rig printing "0 %" in the same language. The CSS width above stays a
    // raw percentage: that one is a length, not a number anybody reads.
    pct.textContent = pctOf(from / 100);
    requestAnimationFrame(() => {
      bar.style.transition = '';
      bar.style.width = `${to}%`;
      const t0 = performance.now();
      const tick = () => {
        if (this._token !== token) return;
        const k = Math.min(1, (performance.now() - t0) / 900);
        pct.textContent = pctOf(Math.round(from + (to - from) * (1 - (1 - k) ** 3)) / 100);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // What the tear throws off as it shuts: lattice flung along the closing
    // line, not confetti out of a chest. Mostly lateral, because that is the
    // direction the seam is travelling.
    const box = this.$('#rf-shards');
    box.innerHTML = '';
    const r = mulberry(this.seed + 4201);
    for (let i = 0; i < 40; i++) {
      const side = r() > 0.5 ? 1 : -1;
      const long = r() > 0.5;
      const s = document.createElement('i');
      s.style.setProperty('--dx', `${side * (140 + r() * 900)}px`);
      s.style.setProperty('--dy', `${(r() - 0.5) * 190}px`);
      s.style.setProperty('--rot', `${(r() - 0.5) * 220}deg`);
      s.style.width = `${long ? 34 + r() * 88 : 6 + r() * 10}px`;
      s.style.height = `${long ? 2 : 6 + r() * 10}px`;
      s.style.left = `${(r() - 0.5) * 220}px`;
      s.style.animationDelay = `${180 + r() * 260}ms`;
      box.appendChild(s);
    }

    // The world comes back up to meet it: the rack-focus the rift pulled when
    // it opened is released the instant the seam lights, so what the cadet is
    // looking at when the statement goes true is the place they are standing.
    setTimeout(() => { if (this._token === token) this.opts?.onSeal?.(); }, 150);

    // The fracture closes. Sixty per cent of a second, on the real outline, so
    // what shuts is unmistakably the thing that was open.
    const t0 = performance.now();
    const zip = () => {
      if (this._token !== token || !this.open) return;
      const k = Math.min(1, Math.max(0, (performance.now() - t0 - 150) / 520));
      this._collapse = 1 - k * k * (3 - 2 * k);
      this._drawAperture();
      if (k < 1) requestAnimationFrame(zip);
    };
    requestAnimationFrame(zip);

    // Tied to this seal only: a chained rift opening underneath must never be
    // shut by the previous one's timer.
    setTimeout(() => { if (this._token === token) this.close(); }, 2900);
  }

  // ---------------------------------------------------------------- the echo
  /**
   * The trace of a cadet who stood in a *different* tear of the same shape.
   *
   * It is never on the card when the rift opens: there is no worked solution
   * sitting beside a problem nobody has attempted yet, because that is a
   * lecture with extra steps, and it teaches copying. The echo is dug out of
   * the tear a layer at a time, and it never contains the live answer:
   *
   *   1  whisper      — the cadet's own value put back into the statement, and
   *                     the statement refusing it. Mathematics from the first
   *                     press: a diagnosis on its own teaches nobody anything.
   *   2  first move   — the opening move of a different, already-sealed tear;
   *                     every later move present but burned back to its
   *                     left-hand side, reason intact. A completion problem.
   *   3  the shape    — every move of that solve except the value it lands on
   *   4  whole trace  — that cadet's solve in full, answer and all. A different
   *                     tear, a different number: nothing to copy across.
   *
   * What each layer *says* is decided in `learn/echo.js`, so the fading
   * sequence is content the item bank owns and the content gate can measure.
   * The live item's own steps are used only when the rig can find no analogue,
   * and even then the final line is withheld.
   */
  _analogue() {
    // THE EXAMPLE IS RE-DRAWN THE MOMENT THE RIG LEARNS WHAT WENT WRONG.
    //
    // This was memoised on the first call, which happens before the learner has
    // answered anything — so the example was always chosen with no knowledge of
    // the slip, and the deepest layer went on captioning it "a different rift,
    // the same shape" over a worked example that could not go wrong the way the
    // learner's answer went wrong. A cold critic read exactly that: the slip was
    // a negative sign and every number in the example was positive.
    //
    // So the cache is keyed on the misconception. While none is known the
    // structural analogue stands, which is the right example for a scaffold;
    // the first time a miss is named, the example is drawn again with the slip
    // in hand (see `analogueFor`, which prefers a candidate the mistake is
    // actually available on and gives way rather than return nothing).
    const mis = this.echoMis || null;
    if (this._an !== undefined && this._anMis === mis) return this._an;
    this._anMis = mis;
    this._an = this.opts?.example || null;
    if (!this._an) {
      try {
        this._an = analogueFor(this.item, {
          locale: getLocale(), difficulty: this.item?.difficulty, seed: this.seed,
          misconception: mis,
        });
      } catch { this._an = null; }
    }
    if (this._an) this._hadExample = true;
    return this._an;
  }

  /** Escalate the echo by one layer. `mis` targets it at a named misconception. */
  _pushEcho(mis) {
    if (mis) this.echoMis = mis;
    this._digTo(this.echoTier + 1);
  }

  /** Dig one rung deeper. Cutting a new stratum always brings it into view. */
  _digTo(tier) {
    const want = Math.max(1, Math.min(MAX_TIER, tier | 0));
    if (want <= this.echoTier) { this._showTier(want); return; }
    this.echoTier = want;
    this.echoView = want;
    this.assisted = true;
    this._setEchoOpen(true);
    this._renderEcho();
  }

  /** Read a stratum that has already been cut. Nothing is spent going back up. */
  _showTier(tier) {
    const want = Math.max(1, Math.min(this.echoTier, tier | 0));
    if (!this.echoTier) return;
    this.echoView = want;
    this._setEchoOpen(true);
    this._renderEcho();
  }

  /** Re-read the current stratum against the state the rig is in *now*. */
  _refreshEcho() {
    if (this.echoTier > 0) this._renderEcho(true);
  }

  /**
   * One stratum at a time.
   *
   * The trace used to accumulate into a single column and then scroll, which
   * meant the whisper a cadet was still working from would silently travel off
   * the top of its own box the moment they asked for more. A core sample is not
   * read that way: you pick a depth and you look at that depth. So the column
   * shows exactly one layer, the rail holds every layer that has been cut, and
   * going back up costs nothing.
   *
   * @param {boolean} quiet re-render in place after a state change — no
   *                        dig animation, because nothing was dug.
   */
  _renderEcho(quiet = false) {
    const tier = this.echoView || this.echoTier;
    const box = this.$('#rf-echo');
    const btn = this.$('#rf-hint');
    const tail = this.$('#rf-echo-tail');
    box.innerHTML = '';
    if (tier <= 0) { this.el.classList.remove('echo-on'); return; }

    this.$('#rf-echo-who').textContent = t('rift.echo.cadet', { name: this.cadet, n: this.arc });
    // The badge says WHERE you are in the trace; the rail below says WHAT is
    // at this layer. They used to say the identical four words twice, which is
    // one surface too many and told a first-time reader nothing about what the
    // numbered chips were counting. i18n, additive.
    this.$('#rf-echo-depth').textContent = t('rift.echo.tier', { n: tier, of: MAX_TIER });
    btn.textContent = this.echoTier >= MAX_TIER ? t('rift.echo.spent') : t('rift.echo.more');
    btn.disabled = this.echoTier >= MAX_TIER;
    if (!quiet) {
      box.classList.remove('deepen');
      void box.offsetWidth;
      box.classList.add('deepen');
    }

    let d = 0;
    const add = (cls, html) => {
      const row = document.createElement('div');
      row.className = cls + (quiet ? ' still' : '');
      row.style.animationDelay = `${d}ms`;
      if (html) d += 60;
      row.innerHTML = html;
      box.appendChild(row);
      return row;
    };

    /** The core sample, as strata: every depth cut so far is pressable. */
    const rail = this.$('#rf-echo-rail');
    rail.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'rf-strata-bar';
    for (let k = 1; k <= MAX_TIER; k++) {
      const seg = document.createElement('button');
      seg.type = 'button';
      const cut = k <= this.echoTier;
      seg.className = 'rf-stratum' + (cut ? ' cut' : '') + (k === tier ? ' here' : '')
        + (k === this.echoTier + 1 ? ' next' : '');
      seg.textContent = String(k);
      seg.title = t('rift.echo.depth' + k);
      seg.setAttribute('aria-label', t('rift.echo.depth' + k));
      seg.disabled = k > this.echoTier + 1;
      this._click(seg, () => (k <= this.echoTier ? this._showTier(k) : this._digTo(k)));
      bar.appendChild(seg);
    }
    rail.appendChild(bar);
    const name = document.createElement('span');
    name.className = 'rf-strata-name';
    name.textContent = t('rift.echo.depth' + tier);
    rail.appendChild(name);

    // ---- the lead: what the rig believes it just saw ---------------------
    // Only on the whisper. Deeper strata are a different cadet's solve and
    // carry their own opening line from learn/echo.js.
    if (tier === 1) {
      const mis = this.echoMis;
      let lead = t('rift.echo.' + (mis ? 'slip' : 'trace'), { name: this.cadet });
      if (mis) {
        const key = 'rift.mis.' + mis;
        const line = t(key);
        lead += ' ' + (line === key ? t('rift.mis.unknown') : line);
      }
      add('rf-echo-lead', texProse(lead));
    }

    // ---- the mathematics, faded to this depth ----------------------------
    // Decided in learn/echo.js: layer 1 is the cadet's own entry, refused by
    // the statement; layers 2-4 are a different tear opened one rung at a time.
    const ex = this._analogue();
    let script = { rows: [] };
    try {
      script = echoScript({
        item: this.item, analogue: ex, entry: this.lastEntry, tier, locale: getLocale(),
        state: this._modality?.stateTex?.() || null,
        stateKey: this._modality?.stateKey || undefined,
      });
    } catch { script = { rows: [] }; }

    // Above depth 1 the counterexample is not repeated: it lives at depth 1,
    // one press away, and reprinting it is what made this column unreadable.
    let rows = script.rows;
    if (tier > 1) {
      const cut = rows.findIndex((r) => r.rule);
      if (cut >= 0) rows = rows.slice(cut + 1);
    }

    for (const row of rows) {
      if (row.rule) { add('rf-echo-rule', ''); continue; }
      if (row.text != null && row.latex == null) { add(row.cls, texProse(row.text)); continue; }
      const math = texFirst([row.latex]);
      if (!math) continue;                       // never print raw LaTeX at a learner
      add(row.cls, `<div class="rf-echo-math">${math}</div>` +
        (row.why ? `<div class="rf-echo-why">${texProse(row.why)}</div>` : ''));
    }

    // The first whisper is an instruction, so it obeys the same rule the footer
    // does: it must describe THIS task. It used to tell a cadet rewriting
    // `2(6n + 9) + 2(7n + 2)` that "the value you want is the one that makes it
    // true" — there is no value, and nothing on that card is true or false.
    if (tier === 1) add('rf-echo-nudge', texProse(t('rift.echo.nudge.' + (this._helpKey() || 'keypad'))));
    else {
      const live = !ex || !ex.steps?.length;
      let closer;
      if (tier === 2) closer = t('rift.echo.firstMove');
      else if (tier === 3) closer = t('rift.echo.shape');
      else if (live) closer = t('rift.echo.blank');
      else closer = t('rift.echo.sealedIt', { name: this.cadet, answer: String(ex.answer) });
      add('rf-echo-done', texProse(closer));
    }
    // Where the recovered signal stops. The column ends on a burn line rather
    // than on a column of nothing: the trace ran out, it was not left blank.
    // Below the recovered signal, the substrate the rig has not cut yet. It is
    // shown at every depth, because at every depth there is more down there —
    // and a column that simply stops leaves a void where the fiction should be.
    // Only when nothing further can be recovered does it say so.
    tail.innerHTML = tier >= MAX_TIER
      ? `<span>${t('rift.echo.fades', { name: this.cadet })}</span>` : '';
    tail.classList.toggle('spent', tier >= MAX_TIER);

    this.revealed = this.echoTier;
    const land = () => { this._fitWide(); this._fit(); };
    land();
    requestAnimationFrame(land);
  }

  /**
   * How wide a readout's contents actually are.
   *
   * Off the children's own rectangles, for the same reason `_need` is: these
   * boxes clip across but not down, and a box that clips is not a scrolling box,
   * so `scrollWidth` on one dutifully reports the width of its own padding edge
   * and swears every equation fits. Measured this way it cannot: KaTeX renders
   * into real elements, and an element that runs off the right-hand rail says so
   * in its own rect.
   */
  _wide(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pr = parseFloat(cs.paddingRight) || 0;
    let w = 0;
    for (const c of el.children) {
      const ccs = getComputedStyle(c);
      if (ccs.display === 'none') continue;
      const cr = c.getBoundingClientRect();
      if (cr.width <= 0) continue;
      w = Math.max(w, cr.right - r.left + pr);
    }
    return Math.max(w, el.scrollWidth);
  }

  /**
   * A line of mathematics that runs off the edge of its rail is a line nobody
   * reads, and a sideways scrollbar is not an answer — it hides the right-hand
   * end of an equation, which is usually the part that matters. Every wide
   * readout in the rig is set instead at the largest size that still fits.
   */
  _fitWide() {
    const sel = '.rf-echo-math, #rf-prompt, .rf-socket .val, .bal-pan .plate, .pan-read, .rf-assemble';
    for (const row of this.el.querySelectorAll(sel)) {
      row.style.fontSize = '';
      const w = row.clientWidth;
      if (!w) continue;
      const need = this._wide(row);
      if (need <= w + 1) continue;
      const k = Math.max(0.5, (w - 2) / need);
      row.style.fontSize = `${(k * 100).toFixed(1)}%`;
    }
  }

  /**
   * THE PROVING RUN'S CONTRACT WITH THE GLOSSARY.
   *
   * ESC WORDS says, in three languages: "A proving run is the run that seals a
   * line. While it is live you get no help." That sentence was not true. Inside
   * `PROVING RUN · 2 OF 3` the rig handed over the whole ladder — a whisper on
   * the first miss, four strata of a worked analogue on request, and a drop to
   * three readings after two attempts. `scaffold: 'none'` on the task only ever
   * withheld the example printed on the card BEFORE the first attempt; every
   * other support was live. A glossary that describes a stricter game than the
   * one being played is worse than no glossary: it is the rig telling a cadet
   * that a claim about them means something it does not.
   *
   * Of the two ways to make them agree — soften the words, or harden the run —
   * only one of them leaves a gate worth passing, so the run is hardened. While
   * `_proving` is true: no hint button, no echo, no narrowing to a choice. The
   * cadet answers it or does not.
   *
   * That cannot be the whole rule, though, because the card does not close
   * until the statement is true. A run that withheld help for ever would be a
   * wall, and a wall is the failure this product exists to avoid. So the run's
   * claim is on the FIRST attempt, which is the only attempt that was ever
   * evidence: any miss sets `assisted`, and `mastery.observe` only advances a
   * run on `correct && !meta.assisted`. Once the cadet has missed, this item
   * can no longer count toward the run whatever happens next — so there is
   * nothing left to protect, and the full ladder comes back at once.
   *
   * And the label goes with it. The chip stops saying PROVING RUN the instant
   * the help arrives, because that is the whole complaint: not that support
   * exists, but that support arrived under a banner promising there would be
   * none. What the glossary describes is now exactly what a cadet gets.
   */
  _endProving() {
    if (!this._proving) return;
    this._proving = false;
    this.$('#rf-hint').hidden = false;
    const kindEl = this.$('#rf-kind');
    kindEl.className = 'rf-kind is-checkoff';
    kindEl.textContent = t('rift.kind.checkOff');
    kindEl.style.display = '';
  }

  /** The footer button, and the path a miss takes into the echo. */
  revealStep(manual, misconception) {
    void manual;
    // Nothing is dug on a live run. The button is hidden, and this is the
    // second lock on the same door: `_key` and any other caller reach here too.
    if (this._proving) return;
    if (this.echoTier >= MAX_TIER && !misconception) {
      if (this.echoTier) this._setEchoOpen(true);
      return;
    }
    this._pushEcho(misconception);
  }

  // -------------------------------------------------------------- modalities
  _mount() {
    const work = this.$('#rf-work');
    work.innerHTML = '';
    this._modality = null;
    const item = this.item;

    let built = null;
    // The choice modality is selected by what the item IS — `equationChoice` —
    // and only then, as a legacy fallback, by the box glyph. It used to be
    // chosen by `/\\square/` alone, so a modality depended on a rendering
    // character: the only way to get a choice item was to draw a box on the
    // screen, whether or not the box said anything. Two forms drew a display
    // made entirely of boxes for exactly that reason.
    if (item.type === 'special' || item.check?.kind === 'equationChoice'
      || (item.latex && /\\square/.test(item.latex))) built = this._choice(work);
    // A coordinate surface, for the items whose answer is a line. Owned with
    // the mathematics that needs it (src/learn/plot.js); returns null for
    // anything it cannot draw, and the rig falls through as usual.
    if (!built && item.figure?.kind === 'plot') built = this._plot(work);
    if (!built && (item.figure?.kind === 'balance' || item.check?.kind === 'solve')) built = this._balance(work);
    if (!built && (item.figure?.kind === 'area' || item.skill === 'distribute')) built = this._area(work);
    if (!built && item.type === 'expression') built = this._sort(work);
    if (!built) built = this._keypad(work);

    this._modality = built;
    this.mode = built.name;
    // A meter is drawn only where it counts something. See `setPressure`.
    this.$('#rf-gauge-box').hidden = !built.gauge;
    // The footer says what to do, so it has to know WHAT is being asked for.
    // One keypad serves two different tasks — charge a value, or build an
    // expression — and it used to tell every cadet to "type the value that
    // makes the statement true" even when the statement was `2(3m + 6) + 2(m + 15)`
    // and the thing wanted was an expression. An instruction that describes a
    // different task than the one on screen is worse than no instruction.
    this._say(t('rift.help.' + this._helpKey()));
    requestAnimationFrame(() => this._fit());
  }

  /**
   * Which instruction this card's footer should carry.
   *
   * The modality alone does not decide it. The keypad takes a value in a solve
   * and an expression in a rewrite, and those are two different instructions;
   * the sorting bays and the choice rig ask for a placement and a selection.
   * Anything a locale has not written a task-specific line for falls back to
   * the modality's own, so adding a modality cannot leave a card silent.
   */
  _helpKey() {
    if (this.mode === 'keypad' && this.item?.type === 'expression') return 'keypadExpression';
    return this.mode;
  }

  /**
   * What, if anything, this entry tells us about the learner's thinking.
   *
   * Only ever a tag the item can actually justify (see learn/diagnose.js).
   * `null` is a real and common answer, and it is the honest one: the echo then
   * shows the trace without claiming to know why the cadet slipped.
   */
  _mis(value) {
    return diagnose(this.item, value);
  }

  /** Does this entry make the statement true? */
  _accepts(value) {
    const item = this.item;
    const v = String(value).trim();
    if (!v) return false;
    if (norm(v) === norm(item.answer)) return true;
    for (const alt of item.accept || []) if (norm(v) === norm(alt)) return true;
    if (item.type === 'numeric') {
      const a = v.match(/^(-?\d+)(?:\/(\d+))?$/);
      const b = String(item.answer).match(/^(-?\d+)(?:\/(\d+))?$/);
      if (a && b) return Number(a[1]) * Number(b[2] || 1) === Number(b[1]) * Number(a[2] || 1);
      return false;
    }
    if (item.type === 'expression') {
      const variable = item.check?.variable || (String(item.answer).match(/[a-zA-Z]/) || [])[0];
      if (!variable) return false;
      try { return equivalent(v, item.answer, variable) === true; } catch { return false; }
    }
    return false;
  }

  // -------------------------------------------------------- modality: plot
  /** The coordinate surface. Same contract as every other modality. */
  _plot(work) {
    const self = this;
    return mountPlot(work, {
      item: this.item,
      tex: (src) => texFirst([src]) || '',
      t,
      settled: () => !!self._settled,
      solve: () => self._solve(),
      miss: (mis, msg, entry) => self._miss(mis, msg, entry),
      pressure: (p) => self.setPressure(p),
    });
  }

  // ------------------------------------------------------- modality: keypad
  _keypad(work) {
    const self = this;
    const item = this.item;
    const expr = item.type === 'expression';
    const variable = item.check?.variable
      || (String(item.answer).match(/[a-zA-Z]/) || [])[0]
      || (CLEAN(item.latex).match(/[a-zA-Z]/) || [])[0]
      || 'x';
    let entry = '';
    let narrowed = false;

    const pad = document.createElement('div');
    pad.className = 'rf-pad';

    // The socket is a slot cut into the rig, not a form field: shallow, lit
    // from beneath, and it names what it is waiting for.
    const charge = document.createElement('div');
    charge.className = 'rf-socket';
    charge.innerHTML = `<span class="cap">${t('rift.keypad.charge')}</span>
      <div class="val empty"></div><span class="caret"></span>`;
    const val = charge.querySelector('.val');

    const keys = document.createElement('div');
    keys.className = `rf-keys${expr ? ' expr' : ''}`;
    const extra = document.createElement('div');
    extra.className = 'rf-extra';

    const paint = () => {
      const empty = entry === '';
      val.classList.toggle('empty', empty);
      val.innerHTML = empty ? tex('\\square') : (texFirst([texify(entry), entry, '\\square']) || tex('\\square'));
      commit.disabled = empty || /[-+^/]$/.test(entry);
      charge.classList.toggle('live', !empty);
    };

    const push = (ch) => {
      if (self._settled || ch == null || entry.length > 14) return;
      if (/^[-+^/]/.test(ch) && (entry === '' ? ch !== '-' : /[-+^/]$/.test(entry))) return;
      if (ch === '/' && entry.includes('/')) return;
      entry += ch;
      charge.classList.remove('bad');
      paint();
    };
    // A dedicated sign key, not a minus glyph: it flips the value it is looking
    // at. "5/2" becomes "-5/2", never the dangling "5/2-" a bare operator gives.
    const negate = () => {
      if (self._settled) return;
      entry = entry.startsWith('-') ? entry.slice(1) : '-' + entry;
      charge.classList.remove('bad');
      paint();
    };
    const back = () => { entry = entry.slice(0, -1); charge.classList.remove('bad'); paint(); };

    // Which drawing of the narrowed field this is. A field that has been spent
    // comes back arranged differently, so nothing a cadet learned by guessing
    // at the last one survives into the next.
    let round = 0;

    /** The field is spent. The keypad is the instrument again. */
    const standDown = () => {
      extra.innerHTML = '';
      narrowed = false;
      self.el.classList.remove('narrowed');
      self._syncLayout();
      paint();
    };

    const tryNarrow = () => {
      if (narrowed || self.wrongCount < 2) return;
      // A live proving run withholds every scaffold, and dropping to a choice
      // is the heaviest one there is. See `_proving`.
      if (self._proving) return;
      const took = self._narrow(extra, round, (p, btn) => {
        if (self._settled) return;
        // `p.ok` is the key and is never anything else; `_accepts` is the
        // second opinion. Either is enough, so a blind spot in one of them
        // can never be the thing that tells a right cadet they are wrong.
        if (p.ok || self._accepts(p.v)) { btn.classList.add('right'); self._solve(); return; }
        btn.classList.add('wrong');
        // Every reading closes, not just the one that was wrong: the field is
        // spent, and a spent field cannot be walked down to the answer.
        for (const b of extra.querySelectorAll('.rf-reading')) b.disabled = true;
        self._miss(p.m || self._mis(p.v), t('rift.keypad.spent'), p.v);
        setTimeout(() => { if (!self._settled && narrowed) standDown(); }, 900);
      });
      if (took) {
        narrowed = true;
        round++;
        entry = '';
        paint();
        self.el.classList.add('narrowed');
      }
    };

    const submit = () => {
      if (self._settled || !entry) return;
      if (self._accepts(entry)) { self._solve(); return; }
      charge.classList.remove('bad');
      void charge.offsetWidth;
      charge.classList.add('bad');
      self._miss(self._mis(entry), null, entry);
      // Two honest attempts in and the rig stops asking for a value it cannot
      // help with: the noise clears, a few readings remain, and the keypad
      // stands down rather than competing with them.
      tryNarrow();
    };

    const KEY = (label, fn, cls = '', aria = '') => {
      const b = document.createElement('button');
      b.className = `rf-key ${cls}`;
      b.type = 'button';
      b.innerHTML = label;
      if (aria) b.setAttribute('aria-label', aria);
      b.dataset.k = aria || b.textContent.trim();
      self._click(b, fn);
      return b;
    };
    const BACK = '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9L2 12z"/><path d="M17 9l-5 6M12 9l5 6"/></svg>';
    const SIGN = { s: 'sign' };
    const OVER = { s: '/', t: '/', label: tex('\\square/\\square'), aria: t('rift.keypad.over') };

    const rows = expr
      ? [['7', '8', '9', { s: variable, t: variable }],
        ['4', '5', '6', { s: '+', t: '+', label: tex('+') }],
        ['1', '2', '3', { s: '^2', t: '^2', label: tex('\\square^{2}') }],
        ['0', SIGN, OVER, { s: 'back' }]]
      : [['7', '8', '9', { s: 'back' }],
        ['4', '5', '6', SIGN],
        ['1', '2', '3', OVER],
        [{ s: '0', t: '0', wide: 4 }]];

    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell === 'string') { keys.appendChild(KEY(cell, () => push(cell))); continue; }
        if (cell.s === 'back') { keys.appendChild(KEY(BACK, back, 'util', t('rift.keypad.back'))); continue; }
        if (cell.s === 'sign') { keys.appendChild(KEY(tex('\\pm'), negate, 'util', t('rift.keypad.minus'))); continue; }
        const ch = cell.t ?? cell.s;
        const label = cell.label || cell.s;
        const cls = cell.wide ? 'widest' : (/^[0-9a-zA-Z]+$/.test(ch) ? '' : 'util');
        keys.appendChild(KEY(label, () => push(ch), cls, cell.aria || ch));
      }
    }
    const commit = KEY(t('rift.keypad.set'), submit, 'commit');
    keys.appendChild(commit);

    pad.appendChild(charge);
    pad.appendChild(keys);
    work.appendChild(pad);
    work.appendChild(extra);
    paint();

    return {
      name: 'keypad',
      key(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (/^[0-9]$/.test(e.key)) push(e.key);
        else if (e.key === '-') negate();
        else if (e.key === '/') push('/');
        else if (expr && (e.key === '+' || e.key === variable)) push(e.key);
        else if (expr && e.key === '^') push('^2');
        else if (e.key === 'Backspace') back();
        else if (e.key === 'Enter') submit();
        else return;
        e.preventDefault();
      },
      set(v) { entry = String(v); paint(); },
      submit,
    };
  }

  /**
   * The readings a cadet chooses between — built once, here, for every surface
   * that offers a choice.
   *
   * A student who is right and is told they are wrong stops believing the
   * thing that told them, and there is no way back from that. Two properties
   * therefore have to hold on every set of options this rig has ever drawn,
   * and neither can be left to the generator to remember:
   *
   *   1. the key is in the set, and it is the ONLY option the rig would accept.
   *      Any distractor `_accepts()` says yes to is silently dropped, because
   *      it is not a distractor — it is a second correct answer that would be
   *      marked wrong the moment a cadet reached for it;
   *   2. no two options draw the same glyphs. Two readings that look identical
   *      are one reading and a trap, and a cadet who picks the one on the right
   *      has been failed by the surface, not by the mathematics.
   *
   * The rendered HTML is built here too, so what is compared is exactly what
   * is mounted — not a second guess at it.
   */
  _readings(ds) {
    const key = String(this.item.answer);
    const draw = (v) => texFirst([texify(v), v]) || v;
    const pool = [{ v: key, ok: true, html: draw(key) }];
    for (const d of ds) {
      const v = String(d.value ?? '');
      if (!v.trim() || this._accepts(v)) continue;
      const html = draw(v);
      if (pool.some((p) => p.html === html)) continue;
      pool.push({ v, m: d.misconception, html });
    }
    return pool;
  }

  /**
   * The scaffold of last resort. Two real attempts have been spent, so the rig
   * stops asking the cadet to conjure a value out of nothing and clears the
   * noise down to a few readings instead. The keypad goes dark: one instrument
   * on the surface at a time.
   *
   * Two things this field must never be, and both of them are ways to seal a
   * rift with no mathematics in it:
   *
   *   · the answer is never in a place a cadet could learn. The set is built
   *     key-first and is then ARRANGED, not shuffled — see `arranged`;
   *   · the field is never a free run down the list. A wrong reading used to
   *     grey itself out and leave the rest live, which made three readings a
   *     guaranteed seal in at most three clicks and no algebra at all. The
   *     field now costs a wrong pick: it stands down, the keypad comes back,
   *     and the next miss draws it again — in a different arrangement, with
   *     nothing crossed off. Guessing therefore buys nothing it can keep.
   *
   * `round` is which drawing of the field this is; it goes into the
   * arrangement so a second drawing is not the first one again.
   *
   * Returns false when there is no honest choice to offer — a single reading is
   * not a narrowed field, it is the answer handed over — and the keypad stays.
   */
  _narrow(host, round, onPick) {
    const pool = this._readings((this.item.distractors || []).slice(0, 2));
    if (pool.length < 2) return false;
    host.innerHTML = '';
    const lab = document.createElement('div');
    lab.className = 'rf-narrow-lead';
    // The lead says what is on the surface. It used to say "three readings"
    // whatever was drawn, and a distractor the rig had refused (a second
    // correct answer, or one that renders the same glyphs) left it counting
    // two things and naming three.
    lab.textContent = t('rift.keypad.narrowed', { n: pool.length });
    host.appendChild(lab);
    const box = document.createElement('div');
    box.className = 'rf-narrow';
    for (const p of arranged(pool, this.seed + 17, `${this.item.answer}|${round}`)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ans rf-reading';
      b.innerHTML = p.html;
      b.dataset.value = p.v;
      this._click(b, () => onPick(p, b));
      box.appendChild(b);
    }
    host.appendChild(box);
    return true;
  }

  // ------------------------------------------------------- modality: choice
  /**
   * Some statements really are a choice: which reading is the true one.
   *
   * A NOTE ON GUESSING, because the obvious "fix" here is the wrong one.
   *
   * The narrowed keypad field (`_narrow`) spends itself on a wrong pick,
   * precisely so that three readings cannot be walked down to the answer. This
   * surface deliberately does NOT, and the difference is that this one is the
   * QUESTION, not a scaffold offered after it. Closing every reading here
   * would leave a cadet with a card they cannot answer and cannot leave, which
   * is the wall this whole product exists to avoid; the keypad field can close
   * because the keypad is still underneath it.
   *
   * What stops guessing here is not the surface, it is the ledger. Every wrong
   * pick goes through `_miss`, which sets `assisted` — and an assisted seal is
   * reported as assisted for ever after. `mastery.observe` advances a proving
   * run only on `correct && !meta.assisted`, so a rift guessed through moves no
   * gate, closes no line and pays one mote instead of two or four. The
   * distractors themselves are the second lock: `tools/validate-items.mjs`
   * measures the surface strategies over the whole bank, and answering by
   * "the odd one out" or "the longest" scores 5.7% and 0.6% against a 1-in-4
   * baseline. There is no shape to read here, only the mathematics.
   */
  _choice(work) {
    const self = this;
    const item = this.item;
    const pool = this._readings(item.distractors || []);
    if (pool.length < 2) return null;

    const box = document.createElement('div');
    box.className = 'rf-readings';
    const picks = [];
    // Arranged, not shuffled: where the true reading lands is a stated,
    // measured property of this rig, not an accident of one seed. See
    // `arranged`.
    for (const p of arranged(pool, this.seed + 5, String(item.answer))) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ans rf-reading';
      b.dataset.value = p.v;
      // A keyed channel, not an anonymous slab: the rig numbers its readings so
      // a hand on a keyboard can take one without going looking for a cursor.
      b.innerHTML = `<span class="key">${picks.length + 1}</span>${p.html}`;
      const take = () => {
        if (self._settled || b.disabled) return;
        // Same two opinions as the narrowed field: the key, and anything the
        // checker would have accepted had it been typed.
        if (p.ok || self._accepts(p.v)) { b.classList.add('right'); self._solve(); return; }
        b.classList.add('wrong');
        b.disabled = true;
        self._miss(p.m || self._mis(p.v), null, p.v);
      };
      self._click(b, take);
      picks.push(take);
      box.appendChild(b);
    }
    work.appendChild(box);
    return {
      name: 'choice',
      key(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const i = Number(e.key) - 1;
        if (!Number.isInteger(i) || i < 0 || i >= picks.length) return;
        e.preventDefault();
        picks[i]();
      },
    };
  }

  // ------------------------------------------------------ modality: balance
  _balance(work) {
    const self = this;
    const item = this.item;
    let parsed = null;

    const figure = item.figure;
    if (figure?.kind === 'balance') {
      const v = figure.left?.v || figure.right?.v || 'x';
      parsed = {
        v,
        L: { a: fr(figure.left?.coef ?? 0), b: fr(figure.left?.konst ?? 0) },
        R: { a: fr(figure.right?.coef ?? 0), b: fr(figure.right?.konst ?? 0) },
      };
    }
    if (!parsed) parsed = parseLinear(item.check?.math || item.latex);
    if (!parsed) return null;
    const v = parsed.v;
    let S = { L: { ...parsed.L }, R: { ...parsed.R } };
    const history = [];

    const opConst = (f) => ({ kind: 'const', f, tex: `${f.n < 0 ? '-' : '+'}\\; ${fTex(fAbs(f))}` });
    const opVar = (f) => ({ kind: 'var', f, tex: `${f.n < 0 ? '-' : '+'}\\; ${fTerm(fAbs(f), v)}` });
    // i18n: `÷` is English notation. pl/es write division with a colon.
    const opDiv = (f) => ({ kind: 'div', f, tex: `${mathOp('div')}\\; ${fTex(f)}` });

    function apply(st, op) {
      const out = { L: { ...st.L }, R: { ...st.R } };
      if (op.kind === 'const') { out.L.b = fAdd(out.L.b, op.f); out.R.b = fAdd(out.R.b, op.f); }
      else if (op.kind === 'var') { out.L.a = fAdd(out.L.a, op.f); out.R.a = fAdd(out.R.a, op.f); }
      else {
        if (fZero(op.f)) return null;
        for (const side of [out.L, out.R]) { side.a = fDiv(side.a, op.f); side.b = fDiv(side.b, op.f); }
      }
      for (const side of [out.L, out.R]) if (!side.a || !side.b || fBig(side.a) || fBig(side.b)) return null;
      return out;
    }

    function ideal(st) {
      if (!fZero(st.L.a) && !fZero(st.R.a)) {
        const smaller = Math.abs(fNum(st.L.a)) <= Math.abs(fNum(st.R.a)) ? st.L.a : st.R.a;
        return opVar(fNeg(smaller));
      }
      const V = fZero(st.L.a) ? st.R : st.L;
      if (fZero(V.a)) return null;
      if (!fZero(V.b)) return opConst(fNeg(V.b));
      if (!fOne(V.a)) return opDiv(V.a);
      return null;
    }

    const distance = (st) => {
      let s = { L: { ...st.L }, R: { ...st.R } };
      for (let i = 0; i < 6; i++) {
        const op = ideal(s);
        if (!op) return i;
        s = apply(s, op);
        if (!s) return 9;
      }
      return 9;
    };
    const start = distance(S);
    if (!start || start > 4) return null;

    function solvedValue(st) {
      const V = fZero(st.L.a) ? st.R : st.L;
      const K = fZero(st.L.a) ? st.L : st.R;
      if (!fOne(V.a) || !fZero(V.b) || !fZero(K.a)) return null;
      return K.b;
    }
    // The beam must be able to reach the item's own answer, or it is the
    // wrong instrument for this question.
    {
      let s = { L: { ...S.L }, R: { ...S.R } };
      for (let i = 0; i < 6 && solvedValue(s) == null; i++) {
        const op = ideal(s);
        if (!op) break;
        s = apply(s, op);
        if (!s) return null;
      }
      const got = solvedValue(s);
      if (got == null) return null;
      const want = String(item.answer).match(/^(-?\d+)(?:\/(\d+))?$/);
      if (!want) return null;
      if (got.n * Number(want[2] || 1) !== Number(want[1]) * got.d) return null;
    }

    function candidates(st) {
      const list = [];
      const push = (op) => { if (op && apply(st, op) && !list.some((o) => o.tex === op.tex)) list.push(op); };
      const best = ideal(st);
      push(best);
      if (!fZero(st.L.b)) { push(opConst(fNeg(st.L.b))); push(opConst(st.L.b)); }
      if (!fZero(st.R.b)) { push(opConst(fNeg(st.R.b))); push(opConst(st.R.b)); }
      if (!fZero(st.R.a)) { push(opVar(fNeg(st.R.a))); push(opVar(st.R.a)); }
      if (!fZero(st.L.a) && !fZero(st.R.a)) push(opVar(fNeg(st.L.a)));
      if (!fZero(st.L.a) && !fOne(st.L.a)) push(opDiv(st.L.a));
      if (!fZero(st.R.a) && !fOne(st.R.a)) push(opDiv(st.R.a));
      const mixed = shuffled(list, self.seed + list.length * 31 + history.length);
      const keep = mixed.slice(0, 5);
      if (best && !keep.some((o) => o.tex === best.tex)) keep[keep.length - 1] = best;
      return keep;
    }

    function misFor(op, st) {
      const V = fZero(st.L.a) ? st.R : st.L;
      if (op.kind === 'div' && !fZero(V.b)) return 'wrong-unwrap-order';
      if (op.kind === 'const') return item.skill === 'two-step' ? 'sign-on-constant' : 'same-op-both';
      if (op.kind === 'var') return 'collect-wrong-side';
      return null;
    }

    // A machine with weight: a forged beam on a stone plinth, lit from the tear,
    // with pans that hang off it and swing. Not a diagram of a scale.
    const rig = document.createElement('div');
    rig.className = 'rf-bal';
    rig.innerHTML = `
      <div class="bal-stage">
        <div class="bal-glow"></div>
        <div class="bal-shadow"></div>
        <div class="bal-base"></div>
        <div class="bal-col"></div>
        <div class="bal-arm">
          <div class="bal-beam"><i></i><i></i></div>
          <div class="bal-pivot"></div>
          <div class="bal-hang l"><div class="cord"><i></i><i></i></div>
            <div class="bal-pan"><div class="pan-rim"></div><div class="plate"></div></div></div>
          <div class="bal-hang r"><div class="cord"><i></i><i></i></div>
            <div class="bal-pan"><div class="pan-rim"></div><div class="plate"></div></div></div>
        </div>
      </div>`;
    const stage = rig.querySelector('.bal-stage');
    const panL = rig.querySelector('.bal-hang.l');
    const panR = rig.querySelector('.bal-hang.r');

    const yoke = document.createElement('div');
    yoke.className = 'rf-yoke';
    yoke.innerHTML = `<span>${t('rift.balance.both')}</span>`;

    /** The move visibly travels from the yoke out to both pans. */
    function flyToPans(op) {
      const bb = stage.getBoundingClientRect();
      const yb = yoke.getBoundingClientRect();
      for (const pan of [panL, panR]) {
        const pb = pan.querySelector('.plate').getBoundingClientRect();
        const f = document.createElement('div');
        f.className = 'rf-fly';
        f.innerHTML = texFirst([op.tex]) || '';
        f.style.left = `${yb.left + yb.width / 2 - bb.left}px`;
        f.style.top = `${yb.top + yb.height / 2 - bb.top}px`;
        f.style.setProperty('--dx', `${pb.left + pb.width / 2 - (yb.left + yb.width / 2)}px`);
        f.style.setProperty('--dy', `${pb.bottom - 10 - (yb.top + yb.height / 2)}px`);
        stage.appendChild(f);
        setTimeout(() => f.remove(), 700);
      }
    }

    const trayLabel = document.createElement('div');
    trayLabel.className = 'rf-label';
    trayLabel.textContent = t('rift.balance.tray');
    const tray = document.createElement('div');
    tray.className = 'rf-moves';

    const bar = document.createElement('div');
    bar.className = 'rf-barrow';
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'rf-btn';
    undo.textContent = t('rift.balance.undo');
    undo.disabled = true;
    self._click(undo, () => {
      if (!history.length || self._settled) return;
      S = history.pop();
      undo.disabled = !history.length;
      render();
      // Everything the rig said about the state it just left is now a lie.
      // The footer line goes back to the standing instruction and the echo
      // re-reads the beam, or the cadet is looking at a verdict on a move
      // that no longer exists.
      self._say(t('rift.help.balance'));
      self._refreshEcho();
    });
    const moves = document.createElement('span');
    moves.className = 'rf-label';
    bar.appendChild(undo);
    bar.appendChild(moves);

    rig.appendChild(yoke);
    rig.appendChild(trayLabel);
    rig.appendChild(tray);
    rig.appendChild(bar);
    work.appendChild(rig);

    const dropTargets = () => [yoke, panL, panR];

    /**
     * The move lands on the objects, not on a caption.
     *
     * Whatever the pans are about to lose is marked before the state changes,
     * so the cadet watches twelve ingots burn off each side rather than
     * watching a number change. A division regroups every token on the pan
     * first — the pile is cut into equal parts and all but one slides off.
     */
    function markMove(op, before, after) {
      for (const [pan, from, to] of [[panL, before.L, after.L], [panR, before.R, after.R]]) {
        const a = panLoad(from), b = panLoad(to);
        if (op.kind === 'div') {
          for (const el of pan.querySelectorAll('.tok')) el.classList.add('regroup');
          continue;
        }
        const shed = (sel, n) => {
          if (n <= 0) return;
          const list = [...pan.querySelectorAll(sel)];
          for (let i = list.length - 1; i >= 0 && n > 0; i--, n--) list[i].classList.add('leaving');
        };
        // A sign flip is not a removal of some: the whole pile is annihilated
        // and rebuilt on the other polarity.
        if (a.xNeg !== b.xNeg) shed('.tok.x', a.xs); else shed('.tok.x', a.xs - b.xs);
        if (a.uNeg !== b.uNeg) { shed('.tok.ten', a.tens); shed('.tok.one', a.ones); }
        else { shed('.tok.ten', a.tens - b.tens); shed('.tok.one', a.ones - b.ones); }
      }
      arrivals = {
        L: deltaOf(panLoad(before.L), panLoad(after.L)),
        R: deltaOf(panLoad(before.R), panLoad(after.R)),
      };
    }
    const deltaOf = (a, b) => ({
      xs: a.xNeg !== b.xNeg ? b.xs : Math.max(0, b.xs - a.xs),
      tens: a.uNeg !== b.uNeg ? b.tens : Math.max(0, b.tens - a.tens),
      ones: a.uNeg !== b.uNeg ? b.ones : Math.max(0, b.ones - a.ones),
    });
    let arrivals = null;

    let busy = false;
    function commit(op) {
      if (self._settled || busy) return;
      const next = apply(S, op);
      if (!next) return;
      busy = true;
      const before = distance(S);
      const prev = { L: { ...S.L }, R: { ...S.R } };
      history.push(prev);
      undo.disabled = false;
      const better = before > distance(next);
      markMove(op, prev, next);
      S = next;
      flyToPans(op);
      stage.classList.remove('settle');
      void stage.offsetWidth;
      stage.classList.add('settle');
      yoke.classList.add('pulse');
      setTimeout(() => yoke.classList.remove('pulse'), 420);
      tray.classList.add('spent');
      setTimeout(() => { busy = false; render(); }, 460);
      if (solvedValue(S) != null) return;
      if (better) self._say(t('rift.balance.closer'));
      else self._miss(misFor(op, prev), t('rift.balance.further'));
      // The echo is reading the beam. If it is open, it now says something
      // about a state that no longer exists unless it is re-read.
      self._refreshEcho();
    }

    function tip(side) {
      if (self._settled) return;
      stage.style.setProperty('--tilt', side === 'l' ? '-11deg' : '11deg');
      (side === 'l' ? panL : panR).classList.add('hot');
      self._miss('one-side-only', t('marlow.balance'));
      setTimeout(() => {
        stage.style.setProperty('--tilt', '0deg');
        panL.classList.remove('hot');
        panR.classList.remove('hot');
      }, 950);
    }

    const XGLYPH = texFirst([v]) || v;
    /** Build a pan out of objects: crystals for the unknown, ingots for units. */
    function paintPan(pan, side, arrived) {
      const plate = pan.querySelector('.plate');
      const L = panLoad(side);
      const n = loadCount(L);
      // A heap of thirty ingots and a heap of three are the same heap if they
      // are drawn at the same size, so the tokens shrink as the pile grows —
      // and the pile is still countable, because ten-bars carry the tens.
      const sc = n > 9 ? Math.max(0.5, 9 / n) : 1;
      const a = arrived || { xs: 0, tens: 0, ones: 0 };
      const tok = (cls, i, from, inner = '') =>
        `<span class="tok ${cls}${i >= from ? ' arrive' : ''}" style="--i:${i}">${inner}</span>`;
      let h = '';
      for (let i = 0; i < L.xs; i++) h += tok(`x${L.xNeg ? ' void' : ''}`, i, L.xs - a.xs, `<em>${XGLYPH}</em>`);
      if (L.xLab) h += tok('x lab', 0, 1, `<em>${texFirst([fTerm(side.a, v)]) || ''}</em>`);
      for (let i = 0; i < L.tens; i++) h += tok(`ten${L.uNeg ? ' void' : ''}`, i, L.tens - a.tens);
      for (let i = 0; i < L.ones; i++) h += tok(`one${L.uNeg ? ' void' : ''}`, i, L.ones - a.ones);
      if (L.uLab) h += tok('one lab wide', 0, 1, `<em>${texFirst([fTex(side.b)]) || ''}</em>`);
      plate.innerHTML = `<span class="pan-load${n ? '' : ' bare'}" style="--tk:${sc.toFixed(2)}">${h}</span>`
        + `<span class="pan-read">${texFirst([sideTex(side, v)]) || ''}</span>`;
    }

    function render() {
      for (const [pan, side, key] of [[panL, S.L, 'L'], [panR, S.R, 'R']]) {
        paintPan(pan, side, arrivals?.[key]);
        const plate = pan.querySelector('.plate');
        plate.classList.remove('bump');
        void plate.offsetWidth;
        plate.classList.add('bump');
      }
      arrivals = null;
      // The statement at the head of the rig is the *live* one. The beam is not
      // a picture beside an equation; it is the equation, and when a move lands
      // the line the cadet is reading changes with the pans.
      const live = `${sideTex(S.L, v)} = ${sideTex(S.R, v)}`;
      const head = self.$('#rf-prompt');
      const shown = texFirst([live], { display: true });
      if (shown) {
        head.innerHTML = shown;
        head.classList.remove('flash');
        void head.offsetWidth;
        head.classList.add('flash');
      }
      self.setPressure(Math.max(0, Math.min(1, distance(S) / Math.max(1, start))));
      moves.textContent = `${t('rift.balance.moves')} · ${history.length}`;
      tray.classList.remove('spent');
      tray.innerHTML = '';
      if (solvedValue(S) != null) {
        stage.classList.add('solved');
        self._say(t('rift.balance.solved'));
        setTimeout(() => self._solve(), 640);
        return;
      }
      for (const op of candidates(S)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rf-move';
        b.innerHTML = texFirst([op.tex]) || '';
        b.__op = op;
        draggable(b, {
          targets: dropTargets,
          onTap: () => commit(op),
          onDrop: (target) => (target === yoke ? commit(op) : tip(target === panL ? 'l' : 'r')),
        });
        tray.appendChild(b);
      }
    }

    render();
    // Where the beam stands right now. The echo opens on it after a move that
    // did not free the unknown: on this surface the cadet's "entry" is a move,
    // and the state it left behind is the thing worth reading back to them.
    return {
      name: 'balance',
      owns: true,
      // The beam measures how far the unknown still has to travel, and that
      // distance is real, continuous and falls only when a move actually gains
      // ground. The gauge reads it. (see setPressure)
      gauge: true,
      stateTex: () => `${sideTex(S.L, v)} = ${sideTex(S.R, v)}`,
      /**
       * A move that is legal but buries the unknown deeper. The scripted hand
       * needs this to be a genuine slip: half the beam's moves are progress,
       * so "take the last chip" is as likely to solve the thing as to fumble
       * it, and a harness that cannot tell the difference reports the gauge as
       * meaningless when it is not.
       */
      pickBad: () => [...tray.children].find((b) => b.__op && distance(apply(S, b.__op)) >= distance(S)) || null,
    };
  }

  // --------------------------------------------------------- modality: bays
  _sort(work) {
    const self = this;
    const item = this.item;
    const src = CLEAN(item.check?.math || item.latex);
    const vm = src.match(/[a-zA-Z]/);
    if (!vm) return null;
    const v = item.check?.variable || vm[0];
    if (/[\\^*()=]/.test(src)) return null;
    const terms = parseTerms(src, v);
    if (!terms || terms.length < 3) return null;

    const sumV = terms.filter((x) => x.kind === 'var').reduce((a, x) => a + x.c, 0);
    const sumK = terms.filter((x) => x.kind === 'num').reduce((a, x) => a + x.c, 0);
    if (norm(linStr(sumV, v, sumK)) !== norm(item.answer)) return null;

    const bays = document.createElement('div');
    bays.className = 'rf-bays';
    const mkBay = (kind, nameHtml) => {
      const el = document.createElement('div');
      el.className = 'rf-bay';
      el.dataset.kind = kind;
      el.innerHTML = `<header><span class="name">${nameHtml}</span>
        <span class="sum none">${t('rift.sort.empty')}</span></header><div class="hold"></div>`;
      return el;
    };
    const bayV = mkBay('var', texProse(t('rift.sort.vars', { v })));
    const bayK = mkBay('num', texProse(t('rift.sort.nums')));
    bays.appendChild(bayV);
    bays.appendChild(bayK);

    const trayLabel = document.createElement('div');
    trayLabel.className = 'rf-label';
    trayLabel.textContent = t('rift.sort.tray');
    const tray = document.createElement('div');
    tray.className = 'rf-tray';

    work.appendChild(bays);
    work.appendChild(trayLabel);
    work.appendChild(tray);

    let placed = 0, vAcc = 0, kAcc = 0;
    const targets = () => [bayV, bayK];

    const updateBay = (bay, acc, kind) => {
      const sum = bay.querySelector('.sum');
      if (!bay.querySelector('.rf-chip')) { sum.className = 'sum none'; sum.textContent = t('rift.sort.empty'); return; }
      sum.className = 'sum';
      const s = kind === 'var' ? (acc === 0 ? '0' : coefStr(acc, v)) : String(acc);
      sum.innerHTML = texFirst([s]) || s;
    };

    // The false identity a rejected drop would have asserted, kept so the echo
    // can print it back: "3x + 5 = 8x" is the whole misconception in one line,
    // and it is far more use than being told the bay refused the chip.
    let illegal = null;
    const place = (chip, term, bay) => {
      if (self._settled || chip.disabled) return;
      if (bay.dataset.kind !== term.kind) {
        for (const e of [bay, chip]) { e.classList.remove('reject'); void e.offsetWidth; e.classList.add('reject'); }
        setTimeout(() => { bay.classList.remove('reject'); chip.classList.remove('reject'); }, 460);
        const into = bay.dataset.kind === 'var' ? vAcc : kAcc;
        const held = bay.dataset.kind === 'var' ? coefStr(into, v) : String(into);
        const dropped = term.kind === 'var' ? coefStr(term.c, v) : String(term.c);
        const merged = bay.dataset.kind === 'var'
          ? (into + term.c === 0 ? '0' : coefStr(into + term.c, v))
          : String(into + term.c);
        illegal = bay.querySelector('.rf-chip')
          ? `${held} ${term.c < 0 ? '-' : '+'} ${dropped.replace(/^-/, '')} = ${merged}`
          : null;
        self._miss('combine-unlike', t('rift.sort.rejected'));
        return;
      }
      chip.classList.remove('picked');
      chip.classList.add('placed');
      chip.disabled = true;
      bay.querySelector('.hold').appendChild(chip);
      if (term.kind === 'var') { vAcc += term.c; updateBay(bayV, vAcc, 'var'); }
      else { kAcc += term.c; updateBay(bayK, kAcc, 'num'); }
      placed++;
      self.setPressure(1 - placed / terms.length);
      if (placed === terms.length) setTimeout(() => self._solve(), 560);
    };

    let picked = null;
    for (const bay of [bayV, bayK]) {
      self._click(bay, () => {
        if (!picked) return;
        const { chip, term } = picked;
        picked = null;
        place(chip, term, bay);
      });
    }

    // Kept here, in the closure, and NOWHERE on the surface.
    //
    // Each chip used to carry `data-kind="var"` or `data-kind="num"`, and the
    // stylesheet painted the two kinds two different colours — the same two
    // colours the two bay headers were painted. `14a`, `17a` and `-7a` came up
    // cyan beside a cyan `a TERMS` header; `30` and `18` came up amber beside
    // an amber `PURE NUMBERS` header. Every chip could be filed by matching a
    // hue, and a cadet who has never met a like term could clear the board.
    // A sorter solvable by colour is not a sorter; it is a colour-matching toy
    // with algebra printed on it.
    //
    // So the chips are now one material. Nothing on a loose chip says which
    // bay it belongs in — not its colour, not an attribute, not a class. The
    // only way to file `-7a` is to know that `-7a` is a multiple of the
    // unknown, which is the whole of what this surface teaches. Colour still
    // does a job here, but it encodes STATE and never kind: loose chips are
    // one colour, a chip that has been filed goes green, a refused drop flares
    // red. All three are things the cadet has already done, never a hint about
    // what to do next.
    const loose = [];

    for (const term of terms) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'rf-chip';
      const s = term.kind === 'var' ? coefStr(term.c, v) : String(term.c);
      chip.innerHTML = texFirst([s]) || s;
      draggable(chip, {
        targets,
        onDrop: (bay) => place(chip, term, bay),
        onTap: () => {
          if (chip.disabled) return;
          if (picked?.chip === chip) { chip.classList.remove('picked'); picked = null; return; }
          picked?.chip.classList.remove('picked');
          chip.classList.add('picked');
          picked = { chip, term };
        },
      });
      loose.push({ chip, term });
      tray.appendChild(chip);
    }

    return {
      name: 'sort',
      owns: true,
      // This surface takes the statement apart into a countable number of
      // things, so "how much of the tear is still open" counts something a
      // cadet can point at: the terms still loose in the tray. (see setPressure)
      gauge: true,
      stateTex: () => illegal,
      stateKey: 'echo.thatMergeSays',
      /**
       * File one term in the wrong bay — a real slip, made through the same
       * `place` a hand makes it through. It lives in the closure because the
       * surface no longer tells the DOM which bay a chip belongs in: the fact a
       * harness needs is the same fact a cadet must not be given.
       */
      pickBad() {
        const next = loose.find((x) => !x.chip.disabled);
        if (!next) return false;
        place(next.chip, next.term, next.term.kind === 'var' ? bayK : bayV);
        return true;
      },
    };
  }

  // -------------------------------------------------------- modality: field
  _area(work) {
    const self = this;
    const item = this.item;
    let k, a, b, v;

    const fig = item.figure;
    if (fig?.kind === 'area') {
      k = fig.k;
      const am = String(fig.aLabel).match(/^(-?\d*)([a-zA-Z])$/);
      if (!am) return null;
      v = am[2];
      a = am[1] === '' ? 1 : am[1] === '-' ? -1 : Number(am[1]);
      b = Number(fig.bLabel);
    } else {
      const m = CLEAN(item.check?.math || item.latex).match(/^(-?\d*)\((.+)\)$/);
      if (!m) return null;
      k = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
      const inner = m[2];
      const vm = inner.match(/[a-zA-Z]/);
      if (!vm) return null;
      v = vm[0];
      const parts = parseTerms(inner, v);
      if (!parts || parts.length !== 2) return null;
      a = parts.find((p) => p.kind === 'var')?.c;
      b = parts.find((p) => p.kind === 'num')?.c;
    }
    if (![k, a, b].every(Number.isFinite) || k === 0) return null;
    if (norm(linStr(k * a, v, k * b)) !== norm(item.answer)) return null;

    const wantA = coefStr(k * a, v);
    const wantB = String(k * b);

    // Drawn to scale, because scale is the entire argument the model makes: the
    // strip carrying `a` lengths of the unknown has to be visibly longer than
    // the strip carrying `b` ones, or it is a two-box diagram, not an area.
    // The unknown is surveyed at three units — a reading, not a claim.
    const spanA = Math.abs(a) * 3;
    const spanB = Math.abs(b);
    const fa = Math.max(0.26, Math.min(0.74, spanA / Math.max(1e-6, spanA + spanB)));

    const field = document.createElement('div');
    field.className = 'rf-field';
    field.innerHTML = `<div class="fld-corner"><span>${t('rift.area.depth')}</span></div>
      <div class="fld-widths"></div>
      <div class="fld-depth"><b></b><i></i><i></i><i></i></div><div class="fld-cells"></div>`;
    const wl = field.querySelector('.fld-widths');
    const cells = field.querySelector('.fld-cells');
    field.querySelector('.fld-depth b').innerHTML = texFirst([String(k)]) || String(k);
    const mkW = (s, cls, grow) => {
      const e = document.createElement('span');
      e.className = `wlab ${cls}`;
      e.style.flex = `${grow} 1 0`;
      e.innerHTML = texFirst([s]) || s;
      wl.appendChild(e);
    };
    mkW(coefStr(a, v), 'a', fa);
    mkW(b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`, 'b', 1 - fa);

    // WHAT EACH PART OF THE FIELD IS WORTH LIVES HERE, NOT IN THE MARKUP.
    //
    // Each cell used to carry `data-want="6x"`. That is the answer, written on
    // the surface in full, for both halves of the field — a learner with the
    // inspector open could fill the field without reading the rectangle at all.
    // It is the same defect as a chip that tells you its bay by its colour,
    // one layer down: a support that lets a cadet succeed with no mathematics
    // in it. The value a cell wants is now closed over, and the DOM says only
    // that a cell is empty or filled.
    const wantOf = new Map();
    const mkCell = (want, cls, grow) => {
      const c = document.createElement('div');
      c.className = `rf-cell ${cls}`;
      c.style.flex = `${grow} 1 0`;
      c.innerHTML = `<span class="hintmark">${t('rift.area.slot')}</span>`;
      wantOf.set(c, want);
      cells.appendChild(c);
      return c;
    };
    const cellA = mkCell(wantA, 'a', fa);
    const cellB = mkCell(wantB, 'b', 1 - fa);

    // The running total sits on the field's own readout rail, not on a row of
    // its own: an instrument, not a form summary.
    const totalRow = document.createElement('div');
    totalRow.className = 'rf-totalrow';
    const totalLabel = document.createElement('span');
    totalLabel.className = 'rf-label';
    totalLabel.textContent = t('rift.area.total');
    const total = document.createElement('div');
    total.className = 'rf-assemble none';
    total.textContent = t('rift.area.none');
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(total);
    const trayLabel = document.createElement('div');
    trayLabel.className = 'rf-label';
    trayLabel.textContent = t('rift.area.tray');
    const tray = document.createElement('div');
    tray.className = 'rf-tray';

    work.appendChild(field);
    work.appendChild(totalRow);
    work.appendChild(trayLabel);
    work.appendChild(tray);

    // Every shard that is not the answer is a real slip: the term left
    // undistributed, the sign carried onto only one term, the factor added
    // instead of multiplied.
    const bag = [wantA, wantB, coefStr(a, v), String(b), String(-k * b), coefStr(a + k, v), String(b + k)];
    const chips = shuffled([...new Set(bag)].filter(Boolean).slice(0, 6), this.seed + 3);

    let filled = 0;
    const targets = () => [cellA, cellB].filter((c) => !c.classList.contains('filled'));

    const paintTotal = () => {
      const got = [cellA, cellB].filter((c) => c.classList.contains('filled'));
      if (!got.length) { total.className = 'rf-assemble none'; total.textContent = t('rift.area.none'); return; }
      total.className = 'rf-assemble';
      const s = got.length === 2 ? linStr(k * a, v, k * b) : wantOf.get(got[0]);
      total.innerHTML = texFirst([s]) || s;
    };

    const drop = (chip, value, cell) => {
      if (self._settled || chip.disabled || cell.classList.contains('filled')) return;
      if (value !== wantOf.get(cell)) {
        for (const e of [cell, chip]) { e.classList.remove('reject'); void e.offsetWidth; e.classList.add('reject'); }
        setTimeout(() => { cell.classList.remove('reject'); chip.classList.remove('reject'); }, 460);
        const mis = value === coefStr(a, v) || value === String(b) ? 'partial-distribute'
          : value === String(-k * b) ? 'neg-distribute'
          : value === coefStr(a + k, v) || value === String(b + k) ? 'combine-unlike' : null;
        self._miss(mis, t('rift.area.rejected'));
        return;
      }
      cell.classList.add('filled');
      cell.innerHTML = texFirst([value]) || value;
      chip.classList.add('placed');
      chip.disabled = true;
      filled++;
      paintTotal();
      self.setPressure(1 - filled / 2);
      if (filled === 2) setTimeout(() => self._solve(), 600);
    };

    let picked = null;
    for (const cell of [cellA, cellB]) {
      self._click(cell, () => {
        if (!picked) return;
        const { chip, value } = picked;
        chip.classList.remove('picked');
        picked = null;
        drop(chip, value, cell);
      });
    }

    for (const value of chips) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'rf-chip';
      chip.dataset.value = value;
      chip.innerHTML = texFirst([value]) || value;
      draggable(chip, {
        targets,
        onDrop: (cell) => drop(chip, value, cell),
        onTap: () => {
          if (chip.disabled) return;
          if (picked?.chip === chip) { chip.classList.remove('picked'); picked = null; return; }
          picked?.chip.classList.remove('picked');
          chip.classList.add('picked');
          picked = { chip, value };
        },
      });
      tray.appendChild(chip);
    }

    paintTotal();
    return {
      name: 'area',
      owns: true,
      // Two parts of the field to cover, and the gauge counts the ones still
      // bare. (see setPressure)
      gauge: true,
      /**
       * What the two parts of the field are worth — for the answer-integrity
       * audit, which has to know whether the tray holds a chip for each of
       * them. It reads the closure because the surface no longer publishes it;
       * a harness may know the answer, a learner's DOM may not.
       * (tools/critic/choicelab/lab.js)
       */
      wants: () => [wantA, wantB],
      /** Cover a part of the field with an area it does not carry. */
      pickBad() {
        const cell = [cellA, cellB].find((c) => !c.classList.contains('filled'));
        if (!cell) return false;
        const want = wantOf.get(cell);
        const chip = [...tray.querySelectorAll('.rf-chip:not(.placed)')].find((c) => c.dataset.value !== want);
        if (!chip) return false;
        drop(chip, chip.dataset.value, cell);
        return true;
      },
    };
  }

  // ------------------------------------------------------------ critic hook
  /**
   * Drive the surface the way a hand would, from a script.
   * `demo('wrong')` commits a plausible wrong move; `demo('right')` solves it.
   */
  demo(kind = 'wrong') {
    if (!this.open || this._settled) return false;
    if (kind === 'right') { this._solve(); return true; }
    const click = (el) => el?.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));

    if (this.mode === 'keypad') {
      const bad = (this.item.distractors || [])[0]?.value;
      if (bad == null) return false;
      this._modality.set(String(bad));
      this._modality.submit();
      return true;
    }
    if (this.mode === 'choice') {
      const btns = [...this.el.querySelectorAll('.rf-reading')];
      const bad = btns.find((b) => b.dataset.value !== String(this.item.answer));
      bad?.click();
      return !!bad;
    }
    if (this.mode === 'plot') {
      // The surface places a trace with the right rate through the wrong start
      // and seals it — a real slip, not a random line.
      this._modality.pickBad?.();
      return true;
    }
    if (this.mode === 'balance') {
      const btns = [...this.el.querySelectorAll('.rf-move')];
      click(this._modality.pickBad?.() || btns[btns.length - 1] || btns[0]);
      return true;
    }
    // The surface no longer publishes which bay a chip belongs in — that was a
    // giveaway with or without the colour — so the slip is made through the
    // modality's own closure. (see `_sort`)
    if (this.mode === 'sort') return !!this._modality?.pickBad?.();
    // Same reason as the sorting bays: what a cell is worth is no longer
    // written on the cell, so the slip is made through the modality's closure.
    if (this.mode === 'area') return !!this._modality?.pickBad?.();
    return false;
  }
}
