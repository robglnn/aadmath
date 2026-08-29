import './rift.css';
import '../learn/echo.css';   // the echo's own rows, owned with the echo's content
import { tex, texOk, texFirst, texProse } from './tex.js';
import { t, getLocale, mathOp, pct as pctOf } from '../i18n/index.js';
import {
  equivalent, parse, expandPm, evalSurd, splitTop,
  radicalInDenominator, radicandsOf, polynomialise,
} from '../learn/parser.js';
import { sCmp, isSquarefree } from '../learn/surd.js';
import { diagnose } from '../learn/diagnose.js';
import { analogueFor } from '../learn/scaffold.js';
import { echoScript, MAX_TIER } from '../learn/echo.js';
import { mountPlot, chartLattice, chartMarkup } from '../learn/plot.js';   // the coordinate surface, owned with its mathematics — and the one lattice both charts are drawn on
import { balancedPick } from '../learn/shape.js';   // the beam's move tray is an answer surface too — see the note on `candidates`

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

/**
 * A written number as an exact fraction, whichever way it is spelled.
 * `-3/4`, `-\frac{3}{4}` and `12` all read; anything else comes back null.
 */
function ratioOf(src) {
  const s = String(src ?? '').replace(/\s+/g, '').replace(/\\left|\\right/g, '');
  let m = /^([+-]?)(\d+)(?:\/(\d+))?$/.exec(s);
  if (m) return { n: (m[1] === '-' ? -1 : 1) * Number(m[2]), d: Number(m[3] || 1) };
  m = /^([+-]?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (m) return { n: (m[1] === '-' ? -1 : 1) * Number(m[2]), d: Number(m[3]) };
  return null;
}

/** Wrap a plain answer string as safe, strict KaTeX. */
function texify(value) {
  const s = String(value).trim();
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac) return `${Number(frac[1]) < 0 ? '-' : ''}\\frac{${Math.abs(Number(frac[1]))}}{${frac[2]}}`;
  return s;
}

const norm = (s) => String(s).replace(/\s+/g, '').replace(/\\left|\\right/g, '');

/**
 * How many glyphs the socket will take.
 *
 * It was fourteen, which is shorter than several keys the bank ships:
 * `5\left(17n^{2} + 13n + 21\right)` is fifteen glyphs in the pad's alphabet
 * and `\left(6n + 19\right)\left(3n + 17\right)` is fourteen exactly. A cap
 * below the longest answer is the same defect as a missing key — the entry
 * simply stops accepting glyphs part-way through a correct answer, with no
 * message. Measured over every unit by tools/critic/answerable.mjs.
 */
const MAX_ENTRY = 40;

// ===========================================================================
// THE PAD ALPHABET — one spelling of an answer that a hand can actually produce
//
// The keys the banks ship contain brackets, radicals, equals signs, commas,
// plus-or-minus and fraction bars. The pad could emit none of them, so every
// factoring, complete-the-square, vertex-form and surd-root item routed to it
// was an item whose answer could not be entered at all: the learner's only
// path to the seal was to miss twice and take the narrowed scaffold. That is a
// rift with no way through it that does not go through being wrong.
//
// The fix is not a LaTeX editor on a keypad. It is one small plain alphabet —
// what a person writes on paper, and what a calculator takes — with a total
// translation to and from the notation the rest of the game speaks:
//
//   brackets, a radical sign, a power mark, a fraction bar, an equals sign,
//   a comma for "and also", a plus-or-minus, and the two order marks.
//
// `toTex` is the only thing that turns that into notation, and `toPad` is its
// inverse. Both are total: anything they cannot read comes back unchanged
// rather than half-converted, so a caller never gets a mangled string.
// ===========================================================================

/** The glyphs that only ever appear in the pad's own spelling. */
const PAD_ROOT = '√';   // the radical sign
const PAD_PM = '±';     // plus or minus
const PAD_LE = '≤';
const PAD_GE = '≥';

/**
 * One atom: a bracketed group, a root, a number, or a letter with its power.
 * `i` is where to start reading; the caller gets the raw text and where it ends.
 */
function atomAt(s, i) {
  if (i >= s.length) return null;
  if (s[i] === PAD_ROOT) {
    const inner = atomAt(s, i + 1);
    if (!inner) return null;
    return { body: s.slice(i, inner.end), end: inner.end };
  }
  if (s[i] === '(') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') { depth--; if (!depth) return { body: s.slice(i + 1, j), end: j + 1 }; }
    }
    return { body: s.slice(i + 1), end: s.length };
  }
  const m = /^(?:\d+|[a-zA-Z](?:\^\d+)?)/.exec(s.slice(i));
  return m ? { body: m[0], end: i + m[0].length } : null;
}

/** The atom that ENDS at `i` — what sits above a fraction bar. */
function atomBefore(s, i) {
  if (i <= 0) return null;
  let start = -1;
  if (s[i - 1] === ')') {
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (s[j] === ')') depth++;
      else if (s[j] === '(') { depth--; if (!depth) { start = j; break; } }
    }
    if (start < 0) return null;
    const inner = s.slice(start + 1, i - 1);
    if (start > 0 && s[start - 1] === PAD_ROOT) return { body: s.slice(start - 1, i), start: start - 1 };
    return { body: inner, start };
  }
  const m = /(?:\d+|[a-zA-Z](?:\^\d+)?)$/.exec(s.slice(0, i));
  if (!m) return null;
  start = i - m[0].length;
  if (start > 0 && s[start - 1] === PAD_ROOT) return { body: s.slice(start - 1, i), start: start - 1 };
  return { body: m[0], start };
}

/**
 * The pad's spelling, as strict KaTeX. Also the string the checker reads, so
 * there is exactly one translation and never two that could disagree.
 */
function toTex(src) {
  let s = String(src ?? '');
  if (!s) return '';
  // Already notation: leave it alone. A backslash cannot be typed on the pad,
  // so its presence says this string came out of the bank, not off a hand.
  if (s.includes('\\')) return s;
  s = s.replace(/\s+/g, '');
  if (!s) return '';
  // fraction bars first, so a root above one keeps its own group
  for (let guard = 0; guard < 16 && s.includes('/'); guard++) {
    const i = s.indexOf('/');
    const num = atomBefore(s, i);
    const den = atomAt(s, i + 1);
    if (!num || !den) { s = s.slice(0, i) + s.slice(i + 1); continue; }
    s = `${s.slice(0, num.start)}\\frac{${num.body}}{${den.body}}${s.slice(den.end)}`;
  }
  for (let guard = 0; guard < 16 && s.includes(PAD_ROOT); guard++) {
    const i = s.indexOf(PAD_ROOT);
    const a = atomAt(s, i + 1);
    if (!a) { s = s.slice(0, i) + s.slice(i + 1); continue; }
    s = `${s.slice(0, i)}\\sqrt{${a.body}}${s.slice(a.end)}`;
  }
  s = s.replace(/\(/g, '\\left(').replace(/\)/g, '\\right)');
  // Powers last. `t^2` has to still read as one atom while the bar above it is
  // being found; braced, it reads as `t` and the fraction loses its exponent.
  s = s.replace(/\^(\d+)/g, '^{$1}');
  s = s.split(PAD_PM).join(' \\pm ');
  s = s.split(PAD_LE).join(' \\le ');
  s = s.split(PAD_GE).join(' \\ge ');
  s = s.replace(/\*/g, ' \\cdot ');
  return s;
}

/**
 * …and back. Given a key out of the bank, what would a hand have to press?
 *
 * This is what makes "every key the bank ships is typeable" a testable claim
 * rather than a hope: the key goes through here, and what comes out is a list
 * of glyphs that either are all on the pad or are not.
 */
function toPad(src) {
  let s = String(src ?? '');
  if (!s) return '';
  s = s.replace(/\\left|\\right|\\!|\\,|\;|\\ /g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pm/g, PAD_PM)
    .replace(/\\le(?![a-zA-Z])/g, PAD_LE)
    .replace(/\\ge(?![a-zA-Z])/g, PAD_GE);
  for (let guard = 0; guard < 16; guard++) {
    const before = s;
    // Powers first, innermost outward: a brace group inside a fraction stops
    // the fraction from being read at all, so `\\frac{1}{t^{2}}` has to lose its
    // `{2}` before the bar above it can be seen.
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^$1');
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `${wrapPad(a)}/${wrapPad(b)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => PAD_ROOT + wrapPad(a));
    if (s === before) break;
  }
  return s.replace(/\s+/g, '');
}
/** A fraction part or a radicand needs brackets unless it is a single atom. */
function wrapPad(body) {
  const b = String(body).trim();
  return /^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(b) ? b : `(${b})`;
}

/** Every distinct glyph a pad entry is built from — the keys it would need. */
function padGlyphs(padStr) {
  const out = new Set();
  for (const ch of String(padStr)) {
    if (/\s/.test(ch)) continue;
    out.add(/[0-9]/.test(ch) ? '0' : ch);
  }
  return out;
}


// ===========================================================================
// THE ANSWER-SURFACE CONTRACT
//
// A grader that only asks "is this the same number?" is not grading the task.
// Sixteen thousand sampled Level 4 items were measured against the old one:
// 1,763 of them were sealed by typing THE QUESTION ITSELF back into the pad.
// "Write this as a product of brackets" was satisfied by the unfactored
// original, on 100% of eight item forms — no misconception flagged, no assist
// recorded, and full unassisted mastery credit for factoring nothing. A
// mastery claim manufactured that way is worse than no claim.
//
// So an answer now has to be right in TWO ways, and both are checked here:
//
//   VALUE   it denotes the same mathematics as the key. `sameAnswer` decides
//           that, and it handles the shapes the old checker could not read at
//           all — an equals sign, a comma-separated pair of roots, a ±, a
//           radical — instead of throwing and quietly answering "no".
//   FORM    it is written in the form the task demands. `inForm` decides that.
//
// An item names its own demand with `check.form`:
//
//   'factored'  a product of brackets — the top-level operation multiplies
//   'simplest'  a radical with a squarefree radicand, a fraction in lowest terms
//   'vertex'    the a(x-h)^2+k shape
//   'standard'  integer coefficients, leading coefficient positive
//   'expanded'  a sum of terms, no bracket left
//   (absent)    the demand is DERIVED — see `demandsOf`
//
// The derivation matters as much as the declaration, because a bank that has
// not declared a form yet must not be gradeable by retyping its own prompt.
// It is drawn from the item's own two strings and nothing else, so it cannot
// smuggle in an opinion about pedagogy: if the key is a product and the prompt
// is not, then producing a product is the task. See `demandsOf`.
//
// WHAT THIS MUST NEVER DO. A learner who is right and is told they are wrong
// stops believing the thing that told them, and there is no way back from
// that. So every predicate here is STRUCTURAL and coarse: it asks what shape a
// line is, never whether it is spelled the way the generator happened to spell
// it. `(x+3)(x+2)` and `(x+2)(x+3)` are one answer. So are `x = 3, x = -8` and
// `x = -8, x = 3`, and `2(x+1)(x+4)` and `(2x+2)(x+4)`. An unreduced fraction
// stays correct unless an item explicitly demands lowest terms.
// ===========================================================================

/** The five forms an item may demand of its answer, plus the derived pair. */
const FORMS = ['factored', 'simplest', 'vertex', 'standard', 'expanded'];

/**
 * Reading a written answer back as an abstract syntax tree.
 *
 * Never throws. `null` means "this notation is outside the checker", which is
 * a real and common answer — an inequality, a coordinate pair, a phrase — and
 * every caller here treats it as "cannot tell" rather than as "wrong".
 */
function astOf(src) {
  try { return parse(toTex(src)); } catch { return null; }
}

/**
 * Does anything in here MULTIPLY two things that are not both plain numbers,
 * or divide by something with a letter in it, or raise a bracket to a power?
 *
 * This one predicate is the whole difference between `x^{2} + 5x + 6` and
 * `(x + 2)(x + 3)`, between `x^{7}` and `x^{3} \cdot x^{4}`, between `6x + 15`
 * and `3(2x + 5)`, and between `x^{-2}` and `\frac{1}{x^{2}}`. In every one of
 * those pairs one side has an unresolved product in it and the other does not,
 * and in every one of them the task is to get from the first to the second.
 */
function hasOpenProduct(node) {
  let found = false;
  const rec = (n) => {
    if (!n || found) return;
    switch (n.k) {
      case 'mul':
        // A number times a BRACKET is unresolved too: `3(2x + 5)` has not been
        // multiplied out, and reading only "are both sides letters?" said it
        // had been.
        if (isSum(stripNeg(n.a)) || isSum(stripNeg(n.b))) { found = true; return; }
        if (!isConstant(n.a) && !isConstant(n.b)) { found = true; return; }
        break;
      case 'div':
        if (!isConstant(n.b)) { found = true; return; }
        break;
      case 'pow':
        if (!isAtom(n.a)) { found = true; return; }
        break;
      default: break;
    }
    for (const k of ['a', 'b']) if (n[k] && typeof n[k] === 'object') rec(n[k]);
  };
  rec(node);
  return found;
}

/** A number, or an arithmetic of numbers. No letter anywhere in it. */
function isConstant(n) {
  if (!n) return true;
  if (n.k === 'var') return false;
  if (n.k === 'num') return true;
  return isConstant(n.a) && (n.b === undefined || isConstant(n.b));
}
/** A single symbol: a number or a letter. Not a sum, not a product. */
function isAtom(n) { return !!n && (n.k === 'num' || n.k === 'var'); }

/** Every multiplicative factor at the top of an expression, flattened. */
function factorsOf(node) {
  const out = [];
  const rec = (n) => {
    if (!n) return;
    if (n.k === 'mul') { rec(n.a); rec(n.b); return; }
    if (n.k === 'neg') { rec(n.a); return; }
    if (n.k === 'div' && isConstant(n.b)) { rec(n.a); return; }
    out.push(n);
  };
  rec(node);
  return out;
}

/** A sum: something the eye reads as several terms added or taken away. */
const isSum = (n) => !!n && (n.k === 'add' || n.k === 'sub');

/**
 * FACTORED — the top-level operation is multiplication, and at least one of
 * the things being multiplied is itself a sum (a bracket) or a bracket raised
 * to a power.
 *
 * `(x+2)(x+3)`, `2(x+1)(x+4)`, `(x+3)^{2}`, `4x(x+3)(x-3)`, `5x(8x^{4}+7)` are
 * all in this form. `x^{2}+5x+6` and `6x^{2}` are not, and neither is a
 * product of two plain numbers, which multiplies nothing worth calling a
 * factorisation.
 */
function isFactored(node) {
  if (!node) return false;
  let n = node;
  while (n.k === 'neg') n = n.a;
  if (isSum(n)) return false;
  if (n.k === 'pow') return isSum(stripNeg(n.a)) && !isSum(node);
  const fs = factorsOf(n);
  if (fs.length < 2 && !(fs.length === 1 && fs[0].k === 'pow' && isSum(stripNeg(fs[0].a)))) return false;
  return fs.some((f) => isSum(stripNeg(f)) || (f.k === 'pow' && isSum(stripNeg(f.a))));
}
function stripNeg(n) { let x = n; while (x && x.k === 'neg') x = x.a; return x; }

/** EXPANDED — a sum of terms with nothing left to multiply out. */
const isExpanded = (node) => !!node && !hasOpenProduct(node);

/**
 * VERTEX — `a(x - h)^{2} + k`: a square of a linear expression, optionally
 * scaled, optionally with a number added.
 *
 * `(n+2)(n+2) + 1` counts. A cadet who wrote the bracket twice instead of
 * squaring it has completed the square; refusing them would be refusing the
 * work, and the whole point of this file is that we do not do that.
 */
function isVertex(node, v) {
  if (!node) return false;
  let body = node;
  if (isSum(body)) {
    if (!isConstant(body.b)) return false;
    body = body.a;
  }
  const fs = factorsOf(stripNeg(body)).filter((f) => !isConstant(f));
  if (fs.length === 1) {
    const f = fs[0];
    if (f.k !== 'pow') return false;
    if (!isSum(stripNeg(f.a)) && stripNeg(f.a).k !== 'var') return false;
    return isLinear(stripNeg(f.a), v) && f.b?.k === 'num' && f.b.v === 2;
  }
  if (fs.length === 2) {
    return isLinear(stripNeg(fs[0]), v) && isLinear(stripNeg(fs[1]), v)
      && texOfNode(fs[0]) === texOfNode(fs[1]);
  }
  return false;
}
/** Degree one in the letter, and no letter anywhere else. */
function isLinear(n, v) {
  try {
    const cs = polynomialise(n, v || 'x', 2);
    return cs.length === 2;
  } catch { return false; }
}
/** A stable spelling of a subtree, so two of them can be compared. */
function texOfNode(n) {
  if (!n) return '';
  if (n.k === 'num') return String(n.v);
  if (n.k === 'var') return n.v;
  return `${n.k}(${texOfNode(n.a)},${texOfNode(n.b)})`;
}

/**
 * STANDARD — integer coefficients, and the leading one is positive.
 */
function isStandard(node, v) {
  try {
    const cs = polynomialise(node, v || 'x');
    if (!cs.length) return false;
    for (const c of cs) if (c.d !== 1) return false;
    return cs[cs.length - 1].n > 0;
  } catch { return false; }
}

/**
 * SIMPLEST — for a radical: every whole square is out of the root, and no root
 * is left underneath a fraction bar.
 *
 * A fraction in lowest terms is the other half of this form, and it is checked
 * ONLY when an item declares it. An unreduced fraction is a correct answer
 * everywhere else in this game — `tools/critic/choiceaudit.mjs` hands the rig
 * `6/8` for a key of `3/4` and requires it to be accepted — so deriving a
 * lowest-terms demand would turn a passing gate into a lie about the learner.
 */
function isSimplestRadical(node) {
  if (!node) return false;
  try {
    if (radicalInDenominator(node)) return false;
    for (const r of radicandsOf(node)) {
      // `radicandsOf` hands back a plain whole number, or null for a radicand
      // it could not reduce to one — a letter under the root, a fraction. That
      // is not a form this predicate can rule on, so it does not rule on it.
      if (r == null) continue;
      if (r < 0) return false;
      if (!isSquarefree(r)) return false;
    }
    return true;
  } catch { return false; }
}
/** Every fraction written in it is already in lowest terms. */
function isLowestTerms(node) {
  let ok = true;
  const rec = (n) => {
    if (!n || !ok) return;
    if (n.k === 'div' && n.a?.k === 'num' && n.b?.k === 'num') {
      if (gcd(n.a.v, n.b.v) !== 1) ok = false;
    }
    for (const k of ['a', 'b']) if (n[k] && typeof n[k] === 'object') rec(n[k]);
  };
  rec(node);
  return ok;
}

// ------------------------------------------------- what the CARD is asking
// A form tells the grader what to accept. It does not tell the cadet what to
// do, and the two are not the same question: `n^{8} \cdot n^{2}` and
// `\left(t - 1\right)\left(t + 6\right)` both want an entry with no unresolved
// product left in it, and only one of them is about brackets.
//
// Reading the task off the demanded form alone left thirty-three of the 341
// forms standing under a line about something that is not on the card:
//
//   · 20 under "Multiply it out. Leave no bracket", with "every part of the
//     first bracket meets every part of the second one" whispered beneath it —
//     over `\frac{n^{8}}{n^{1}}`, `\left(n^{3}\right)^{3}` and
//     `\frac{6x^{2} + 24x}{3x}`, none of which has a pair of brackets to
//     multiply together;
//   · 5 under "Take every whole square out of the root" — over
//     `5\sqrt{3} + 4\sqrt{3}`, whose radicand is already square-free, and over
//     `\frac{15}{\sqrt{3}}`, where the job is to get the root off the bottom;
//   · 6 under the trinomial pair, over `6n + 12`, where one shared factor comes
//     out and no such pair exists;
//   · 2 under the level-1 like-terms line, over `-8n^{0}`.
//
// So the shapes below are read off the item's own two strings first, and each
// one names a task rather than a form. Every predicate is structural and
// narrow: it fires only where the notation itself settles what is being asked.
// tools/critic/answerable.mjs holds each of them to its own rule, and
// `--footers` prints the line every form actually lands under.

/** Nothing anywhere in here is added or taken away. */
function hasNoSum(node) {
  let clean = true;
  const rec = (n) => {
    if (!n || !clean) return;
    if (n.k === 'add' || n.k === 'sub' || n.k === 'pm') { clean = false; return; }
    for (const k of ['a', 'b']) if (n[k] && typeof n[k] === 'object') rec(n[k]);
  };
  rec(node);
  return clean;
}

/** A power whose base is not a plain number: `n^{8}`, `\left(8t^{3}\right)^{2}`. */
function hasLetterPower(node) {
  let found = false;
  const rec = (n) => {
    if (!n || found) return;
    if (n.k === 'pow' && !isConstant(n.a)) { found = true; return; }
    for (const k of ['a', 'b']) if (n[k] && typeof n[k] === 'object') rec(n[k]);
  };
  rec(node);
  return found;
}

/**
 * THE POWER RULES. Powers of a letter are multiplied, divided or raised again,
 * and there is nothing to add or take away on either side — so the card is
 * about what happens to the two little numbers, and no line about brackets or
 * about collecting terms belongs under it.
 */
function isPowerTask(pNode, kNode) {
  if (!pNode || !kNode) return false;
  if (!hasLetterPower(pNode)) return false;
  return hasNoSum(pNode) && hasNoSum(kNode);
}

/** A root under a fraction bar: the job is to get it off the bottom. */
function isRootOnBottom(pNode) {
  try { return !!pNode && radicalInDenominator(pNode); } catch { return false; }
}

/** Roots added or taken away: the job is to collect the ones that match. */
function isRootSum(pNode, promptSrc) {
  if (!pNode) return false;
  if (pNode.k !== 'add' && pNode.k !== 'sub') return false;
  return /\\sqrt/.test(String(promptSrc));
}

/**
 * A quotient the cadet has to carry out. The bottom has a letter in it, so
 * nothing here is a fraction that merely needs reducing.
 */
function isDivideTask(pNode, kNode) {
  if (!pNode || pNode.k !== 'div') return false;
  if (isConstant(pNode.b)) return false;
  return !!kNode && !hasOpenProduct(kNode);
}

/**
 * ONE bracket, with a shared factor pulled out in front of it — `3(2n + 4)`,
 * `x^{2}(-4x + 7)` — as opposed to a trinomial taken apart into two brackets.
 * Both are "write it as brackets multiplied together", and they are not the
 * same job: the pair of numbers that multiply to the last term and add to the
 * middle one does not exist for a common factor, and saying so under one is
 * telling a cadet to look for something that is not there.
 */
function isCommonFactorKey(kNode) {
  if (!kNode) return false;
  const fs = factorsOf(stripNeg(kNode));
  const brackets = fs.filter((f) => isSum(stripNeg(f)));
  const squares = fs.filter((f) => f.k === 'pow' && isSum(stripNeg(f.a)));
  return brackets.length === 1 && squares.length === 0 && fs.length > 1;
}

/** Is this written answer in the demanded form? `null` = cannot tell. */
function inForm(src, form, v) {
  const node = astOf(src);
  if (!node) return null;
  switch (form) {
    case 'factored': return isFactored(node);
    case 'expanded': return isExpanded(node);
    // The derived pair. `openProduct` is deliberately WEAKER than 'factored':
    // it asks only that the entry has not been flattened, because the derived
    // rule can prove the prompt was flattened and the key was not, and cannot
    // prove that what the key holds is a factorisation. Demanding the strict
    // form off that evidence would refuse `\frac{1}{x^{2}}` — a correct answer,
    // written correctly — for not being a product of brackets.
    case 'openProduct': return hasOpenProduct(node);
    case 'vertex': return isVertex(node, v);
    case 'standard': return isStandard(node, v);
    case 'simplest': return isSimplestRadical(node) && isLowestTerms(node);
    // The derived radical demand: the roots are simplified, and nothing is
    // said about fractions. See `isSimplestRadical`.
    case 'rootsSimplified': return isSimplestRadical(node);
    default: return true;
  }
}

// ------------------------------------------------------- what an answer says
/**
 * One written answer, taken apart into the statements it makes.
 *
 * `x = -8, x = 7` is two statements about x. `n = 2 \pm 2\sqrt{3}` is one
 * statement carrying two values. `2\sqrt{3}` is a bare value and names no
 * unknown at all. All three are read the same way here, and the reading never
 * throws — which is the point. The old checker called `equivalent()`, which
 * throws on any string with an "=" in it, and every caller answered the throw
 * with `false`. That is not a check; it is a hole with a catch block over it.
 *
 * The cost was measurable: `_readings` drops any distractor the checker would
 * accept, so a distractor equal to the key is supposed to be impossible. On
 * 586 sampled surd-root items it was not, because the checker could not read
 * either string — `n = 2 \pm \sqrt{20}` sat beside the key `n = 2 \pm 2\sqrt{5}`
 * and was scored as an error with a misconception tag on it.
 *
 * @returns {null|Array<{lhs:string|null, values:Array}>} null when the notation
 *          is outside the checker (an inequality, a coordinate pair, a phrase).
 */
function statementsOf(src) {
  const text = toTex(src);
  if (!text.trim()) return null;
  try {
    const out = [];
    for (const part of splitTop(text, ',')) {
      const body = part.trim();
      if (!body) return null;
      const at = body.indexOf('=');
      const lhs = at >= 0 ? norm(body.slice(0, at)) : null;
      const rhs = at >= 0 ? body.slice(at + 1) : body;
      const values = expandPm(parse(rhs)).map((tree) => evalSurd(tree, {}));
      values.sort(sCmp);
      out.push({ lhs, values });
    }
    return out;
  } catch { return null; }
}

/** A stable spelling of one statement, so two lists can be compared as sets. */
function stmtKey(s) {
  return `${s.lhs ?? ''}|${s.values.map((x) => `${x.p.n}/${x.p.d}+${x.q.n}/${x.q.d}r${x.k}`).join(';')}`;
}

/** The one letter two expressions are both written in, if there is one. */
function soleLetter(...srcs) {
  const set = new Set();
  for (const src of srcs) {
    for (const m of String(src).replace(/\\[a-zA-Z]+/g, ' ').matchAll(/[a-zA-Z]/g)) set.add(m[0]);
  }
  return set.size === 1 ? [...set][0] : null;
}

/**
 * Do two sides of a statement carry the same mathematics?
 * `null` when this checker cannot read one of them.
 */
function sameSide(a, b, v) {
  const A = String(a).trim(), B = String(b).trim();
  if (norm(A) === norm(B)) return true;
  let na, nb;
  try { na = parse(A); nb = parse(B); } catch { return null; }
  // Two exact values — surds and plus-or-minus included.
  try {
    const va = expandPm(na).map((x) => evalSurd(x, {})).sort(sCmp);
    const vb = expandPm(nb).map((x) => evalSurd(x, {})).sort(sCmp);
    if (va.length !== vb.length) return false;
    return va.every((x, i) => sCmp(x, vb[i]) === 0);
  } catch { /* it has a letter in it — compare it as an expression instead */ }
  const letter = soleLetter(A, B) || v;
  if (!letter) return null;
  try { return equivalent(A, B, letter) === true; } catch { return null; }
}

/** One `lhs = rhs`, or a bare expression, compared with its opposite number. */
function samePart(a, b, v) {
  const A = String(a).trim(), B = String(b).trim();
  const ia = A.indexOf('='), ib = B.indexOf('=');
  if ((ia >= 0) !== (ib >= 0)) return false;
  if (ia < 0) return sameSide(A, B, v);
  // A statement that names an unknown is a statement ABOUT that unknown:
  // `y = 2` and `z = 2` are not the same answer, and comparing the two
  // right-hand sides alone would say that they were.
  const ls = sameSide(A.slice(0, ia), B.slice(0, ib), v);
  if (ls !== true) return ls === null ? null : false;
  return sameSide(A.slice(ia + 1), B.slice(ib + 1), v);
}

/**
 * Do two written answers SAY THE SAME THING?
 *
 * `true`, `false`, or `null` for "this checker cannot read them" — and a
 * caller that treats `null` as either verdict is making a claim it has not
 * earned, so every caller here keeps the three cases apart.
 *
 * Order carries no meaning across a comma: `x = 3, x = -8` and `x = -8, x = 3`
 * are one answer, and a learner who wrote the roots the other way round has
 * not made a mistake.
 */
function sameAnswer(a, b, v) {
  const A = String(a ?? '').trim(), B = String(b ?? '').trim();
  if (!A || !B) return false;
  const ta = toTex(A), tb = toTex(B);
  if (norm(ta) === norm(tb)) return true;

  const sa = statementsOf(ta), sb = statementsOf(tb);
  if (sa && sb) {
    if (sa.length !== sb.length) return false;
    const ka = sa.map(stmtKey).sort();
    const kb = sb.map(stmtKey).sort();
    return ka.every((k, i) => k === kb[i]);
  }

  const pa = splitTop(ta, ','), pb = splitTop(tb, ',');
  if (pa.length !== pb.length) return false;
  const spare = pb.slice();
  let unreadable = false;
  for (const part of pa) {
    let hit = -1;
    for (let i = 0; i < spare.length && hit < 0; i++) {
      const r = samePart(part, spare[i], v);
      if (r === true) hit = i;
      else if (r === null) unreadable = true;
    }
    if (hit < 0) return unreadable ? null : false;
    spare.splice(hit, 1);
  }
  return true;
}

/**
 * WHAT FORM THIS ITEM DEMANDS OF ITS ANSWER.
 *
 * `check.form` first, always: an item that states its own demand is believed.
 * Everything below is the derivation for a bank that has not declared one yet,
 * and every step of it reads the item's own two strings — the prompt it shows
 * and the key it holds — and nothing else.
 *
 *   1. `check.kind` already names the task on two kinds. A form built as
 *      `kind: 'factored'` asks for a factorisation and a `vertexForm` asks for
 *      a completed square; those are the bank's own words, not an inference.
 *   2. Otherwise: if the KEY has an unresolved product in it and the PROMPT
 *      does not, then producing that product is the work, and an entry without
 *      one has not done it. And symmetrically — if the PROMPT has one and the
 *      key does not, then resolving it is the work. That is the whole of
 *      "factor this" and "multiply this out", read off the item rather than
 *      guessed at. When both sides agree there is nothing to demand.
 *   3. And a radical key is always demanded in simplified roots, because
 *      \sqrt{20} and 2\sqrt{5} are the same number and only one of them is an
 *      answer to "simplify". Fractions are deliberately not included here —
 *      see `isSimplestRadical`.
 *
 * @returns {string[]} zero or more form names the entry must satisfy.
 */
function demandsOf(item, v) {
  const key = String(item.answer ?? '');
  const declared = item.check?.form;
  let out = [];
  if (FORMS.includes(declared)) out.push(declared);
  else {
    // `check.form` is not ours alone: several check kinds already use it as
    // their own discriminator — `form: 'term'` on a sequence, `form: 'simplify'`
    // on a radical, `form: 'slopeIntercept'` on a related line. A word this
    // contract does not speak must not switch the derivation off, or an item
    // would be graded on value alone for having said something about itself in
    // a different vocabulary.
    const kind = item.check?.kind;
    if (kind === 'factored') out.push('factored');
    else if (kind === 'vertexForm') out.push('vertex');

    const prompt = String(item.check?.math || item.latex || '');
    if (!out.length && key && prompt) {
      const kNode = astOf(key), pNode = astOf(prompt);
      if (kNode && pNode) {
        const kOpen = hasOpenProduct(kNode), pOpen = hasOpenProduct(pNode);
        if (kOpen && !pOpen) out.push('openProduct');
        else if (!kOpen && pOpen) out.push('expanded');
      }
    }
    if (/\\sqrt/.test(key)) out.push('rootsSimplified');
  }
  // THE LAST GUARD, AND THE ONE THAT MAKES THE REST OF THIS SAFE.
  //
  // A demand the KEY ITSELF does not satisfy is a demand this grader has
  // misread — a form name borrowed by another kind, a derivation drawn off
  // notation the checker cannot read, a predicate that does not fit the
  // mathematics. Every one of those would end with a cadet who wrote the
  // bank's own answer being told it is wrong, which is the single worst thing
  // this surface can do. So a demand has to survive being pointed at the key
  // before it is ever pointed at a learner.
  return out.filter((f) => inForm(key, f, v || 'x') === true);
}


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
 * WHAT THE SALT HAS TO CARRY, AND WHY IT USED TO CARRY TOO LITTLE.
 *
 * It was the answer and the seed, and nothing else. So two DIFFERENT cards
 * that happened to end on the same answer under the same seed put the key in
 * the same slot — always, in every language. Over the bank the choice audit
 * sweeps that is not a rare coincidence: 6,756 drawn cards sit on 3,005
 * distinct (seed, answer) pairs, so 4,804 of them share their placement with
 * another card. The positions then arrive in clumps rather than one per card,
 * and the run of them tilts: 26.5 / 24.0 / 24.1 / 25.5 over the whole bank,
 * and 30.4% in the first slot over the 981 four-option sets the audit read —
 * enough for `answer-position-biased` to fire, which is the gate saying a
 * learner could start reading the layout instead of the mathematics.
 *
 * The placement is therefore a property of THE CARD: its answer, and the
 * skill, form and band that card came from. The option count goes in as well
 * as into the modulus, so the same card drawn with three readings and with
 * four does not agree about where the key goes — the count is a tell too. The
 * same measurement over the same bank afterwards: chi-square 11.21 -> 0.75 on
 * four options and 1.68 -> 0.14 on three.
 *
 * @param {Array} pool the readings, KEY FIRST.
 * @param {number} seed this rift's seed.
 * @param {string} salt what makes this set THIS set — see `_cardSalt`, plus
 *                      which drawing of the narrowed field this is.
 */
function arranged(pool, seed, salt) {
  const n = pool.length;
  if (n < 2) return pool.slice();
  const h = mixed(seed, `${salt}|${n}`);
  const slot = h % n;
  const rest = shuffled(pool.slice(1), (h ^ 0x5bd1e995) >>> 0);
  const out = new Array(n);
  out[slot] = pool[0];
  for (let i = 0, j = 0; i < n; i++) if (i !== slot) out[i] = rest[j++];
  return out;
}

/**
 * THE AREA FIELD'S TRAY — six shards, and why neither right one may be the
 * biggest of its kind.
 *
 * The field has two cells: the part of the rectangle under the unknown's
 * width, and the part under the constant's. The tray used to be written out in
 * one line —
 *
 *     [wantA, wantB, a·v, b, -k·b, (a+k)·v, b+k]
 *
 * — and every wrong shard in it was BUILT OUT OF a and b, while the two right
 * ones were built out of k·a and k·b. Multiplying by k makes a number bigger,
 * so the two right shards came out the biggest of their kind: "take the
 * biggest chip that carries the letter, and the biggest that does not" covered
 * both cells with no miss on 58.4% of route cards against an 11.1% baseline —
 * a cadet who has never opened a bracket, sealing three cards out of five.
 *
 * The repair is not to make the right shard small. That is the mistake this
 * repository has already made once, on the option card: forcing the key never
 * to be the extreme turned a weak cue into a PERFECT elimination rule. The
 * repair is that the key's place in the order MUST BE DRAWN — first, middle or
 * last of its kind, from this card's own hash — and that the two companions
 * beside it are then chosen by `balancedPick`, the same instrument the beam's
 * move tray and the generator's readings use, so that length, digits and the
 * written features say nothing either.
 *
 * The catalogue is deep for that reason. Three shards of each kind is a
 * 1-in-9 board; the freedom to put the key anywhere in the size order needs
 * more wrong shards than the three that used to exist, and every one of these
 * is a slip a learner really makes and this surface can name.
 *
 * @param {object} f the field: the factor `k`, the two inside terms `a` and
 *        `b`, the unknown `v`, the two right shards, and the card's seed.
 * @returns {Array<{v:string, m:string}>} the tray, in the order it is laid out.
 */
function areaTray({ k, a, b, v, wantA, wantB, seed }) {
  const salt = `area|${k}|${a}|${b}|${v}`;
  const h = mixed(seed, salt);

  /* Every shard, as a coefficient and the slip it is. A zero coefficient is
     not a shard — `0x` is not something anybody writes. */
  const lettered = [
    [a, 'partial-distribute'],          // the bracket left unopened
    [a + k, 'combine-unlike'],          // the factor added instead of multiplied
    [-k * a, 'neg-distribute'],         // the sign taken onto one term only
    [k * a + k * b, 'combine-unlike'],  // both products gathered onto the unknown
    [k * a + b, 'combine-unlike'],      // the constant added to the product
    [a * b, 'partial-rule'],            // the two inside terms multiplied together
    [k * a + 1, 'arith-slip'],
    [k * a - 1, 'arith-slip'],
  ];
  const plain = [
    [b, 'partial-distribute'],
    [b + k, 'combine-unlike'],
    [-k * b, 'neg-distribute'],
    [k * a, 'partial-rule'],            // the other product, put in the wrong cell
    [k * b + k * a, 'combine-unlike'],
    [a * b, 'partial-rule'],
    [k * b + 1, 'arith-slip'],
    [k * b - 1, 'arith-slip'],
  ];

  /**
   * Two companions for one key, with the key's place in the SIZE order drawn.
   *
   * The size order is the cue `balancedPick` cannot see — it reads printed
   * length, digit count and six written features, and `-8` is shorter than
   * `12` while being the smaller number. So the place is drawn here, the
   * candidate pairs that cannot give it are dropped, and `balancedPick` spends
   * what is left on everything it can see.
   */
  const two = (key, keyVal, cat, tag) => {
    const seen = new Set([String(key)]);
    const pool = [];
    for (const [c, m] of cat) {
      if (!Number.isFinite(c) || c === 0) continue;
      const shown = tag === 'var' ? coefStr(c, v) : String(c);
      if (seen.has(shown)) continue;
      seen.add(shown);
      pool.push({ shown, m, size: c });
    }
    if (pool.length < 2) return pool.slice(0, 2);
    const pairs = [];
    for (let i = 0; i < pool.length - 1; i++) {
      for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
    }
    const placeOf = (p) => (keyVal > p[0].size ? 1 : 0) + (keyVal > p[1].size ? 1 : 0);
    const want = Math.floor((mixed(h, `${tag}|place`) / 4294967296) * 3);
    const live = pairs.filter((p) => placeOf(p) === want);
    const use = live.length ? live : pairs;
    const at = balancedPick(String(key),
      use.map((p, i) => ({ show: [p[0].shown, p[1].shown], rank: i })), `${salt}|${tag}`);
    return use[at];
  };

  const out = [
    { v: wantA, m: null },
    ...two(wantA, k * a, lettered, 'var').map((p) => ({ v: p.shown, m: p.m })),
    { v: wantB, m: null },
    ...two(wantB, k * b, plain, 'num').map((p) => ({ v: p.shown, m: p.m })),
  ];
  return shuffled(out, mixed(h, 'lay'));
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

/**
 * The chart a cadet only READS — the same lattice the coordinate surface is
 * drawn on, from the same one computation.
 *
 * The lines and the numerals used to be stepped on two different expressions
 * here, `round(R/5)` and `round(R/3)`, so the numbers were not on the lines and
 * counting squares from a numbered tick gave the wrong reading. The whole of
 * that geometry now comes out of `chartLattice` in src/learn/plot.js, which the
 * coordinate surface also draws from, so the two charts in this product cannot
 * drift apart again. `tools/check-figures.mjs --charts` measures the result off
 * the rendered DOM.
 */
function gridSvg(fig) {
  const P = chartLattice(fig.range);
  const { R, S, pad, X, Y } = P;   // R normalised by the lattice, not beside it
  const clip = (m, b) => {
    const pts = [];
    for (const [x, y] of [[-R, m * -R + b], [R, m * R + b]]) pts.push([x, y]);
    return pts;
  };
  let g = chartMarkup(P, { only: 'lines' });
  if (fig.at != null) g += `<path d="M${X(fig.at)} ${pad} V${S - pad}" class="tg"/>`;

  const lines = fig.kind === 'lines' ? fig.lines : [{ m: fig.m, b: fig.b }];
  const hues = ['#5fe6ff', '#ffc25f'];
  lines.forEach((ln, i) => {
    const p = clip(ln.m, ln.b);
    g += `<path d="M${X(p[0][0])} ${Y(p[0][1])} L${X(p[1][0])} ${Y(p[1][1])}" class="ln" stroke="${hues[i % 2]}"/>`;
  });
  for (const [x, y] of fig.points || []) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="4.2" class="pt"/>`;
  if (fig.target != null) {
    g += `<path d="M${pad} ${Y(fig.target)} H${S - pad}" class="tg"/>`;
  }
  if (fig.showMark && fig.mark) g += `<circle cx="${X(fig.mark[0])}" cy="${Y(fig.mark[1])}" r="5" class="mk"/>`;
  // Last, over the traces: a numeral under a 2.4px glowing line is a numeral
  // nobody reads, and these cluster on the axes, which is exactly where a trace
  // through the origin crosses.
  g += chartMarkup(P, { only: 'labels' });
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
  _helpKey() { return this._taskKey(); }

  /**
   * WHAT THIS CARD IS ACTUALLY ASKING FOR.
   *
   * The modality does not know, and neither does the item's `type`. Both the
   * footer instruction and the first whisper of the echo were chosen by
   * `type === 'expression'` alone, so 179 of 341 item forms — 73 of the 87 in
   * Level 4 — carried the same line: "You do not solve anything here. Write
   * the same amount in fewer terms, and the shorter line must still hold for
   * every value of the letter." It appeared under a card asking for the square
   * root of 244, which has no letter in it and no terms to shorten. Translated
   * verbatim into Spanish and Polish.
   *
   * An instruction that describes a different task than the one on screen is
   * worse than no instruction, so the task is read off the item: the form its
   * answer must take (`demandsOf`), and the shape the answer is written in.
   * Anything a locale has no line for falls back to the modality's own, so a
   * new task can never leave a card silent.
   */
  _taskKey() {
    if (this.mode !== 'keypad') return this.mode;
    const item = this.item || {};
    /* AND THE HALF OF THIS RULE THAT WAS NEVER WRITTEN: a numeric item is not
       automatically an equation. `keypad` says "type the value that makes the
       statement TRUE", which is the right line for `one-step-add` and is the
       wrong line for every card that hands over an expression and a value for
       its letter — there is no statement on the card and nothing is being made
       true. Measured on the shipped route (algebra1-l1 + algebra1-l2): 17 of
       128 forms declare `check.kind === 'evaluate'`, including all of
       `eval-expr` and five forms of `var-meaning`, which is the first skill a
       new cadet is ever handed. The item already says which task it is — the
       checker's own `kind` — so it is read rather than guessed at, exactly as
       the note above says for `type === 'expression'`. */
    if (item.type !== 'expression') {
      return item.check?.kind === 'evaluate' ? 'keypadValue' : 'keypad';
    }
    const ans = String(item.answer ?? '');
    if (/\\le(?![a-zA-Z])|\\ge(?![a-zA-Z])|[<>]/.test(ans)) return 'bound';
    if (/^\s*\\left\(/.test(ans) && ans.includes(',') && !ans.includes('=')) return 'point';
    if (ans.includes('=')) {
      // `n = 1, n = 3` is two statements about one unknown, so only the first
      // one is read: joining them would find the second `n` on the right of the
      // first equals sign and call a pair of roots a rule.
      const first = splitTop(ans, ',')[0];
      const rhs = first.slice(first.indexOf('=') + 1).replace(/\\[a-zA-Z]+/g, ' ');
      return /[a-zA-Z]/.test(rhs) ? 'rule' : 'roots';
    }
    const forms = this._demands();
    const promptSrc = String(item.check?.math || item.latex || '');
    const pNode = astOf(promptSrc);
    const kNode = astOf(ans);
    // A derived open-product demand only names the task when what the key
    // holds really is a factorisation; otherwise the rig knows the entry must
    // stay unresolved without knowing what it is being resolved INTO, and
    // guessing at that in three languages is how the wrong nudge got printed
    // 179 times in the first place.
    if (forms.includes('factored')
      || (forms.includes('openProduct') && inForm(ans, 'factored', this._variable()) === true)) {
      return isCommonFactorKey(kNode) ? 'common' : 'factor';
    }
    if (forms.includes('vertex')) return 'vertex';
    // THE FOUR TASKS THE FORM CANNOT NAME, read off the notation itself.
    // Every one of them used to fall into `expand` or `simplify` and be given
    // a line about a bracket that was not on the card, or about a whole square
    // that was not inside the root. See the note above `isPowerTask`.
    if (isPowerTask(pNode, kNode)) return 'power';
    if (isRootOnBottom(pNode)) return 'rationalise';
    if (isRootSum(pNode, promptSrc)) return 'radsum';
    if (isDivideTask(pNode, kNode)) return 'divide';
    if (forms.includes('expanded')) return 'expand';
    if (forms.includes('simplest') || forms.includes('rootsSimplified')) return 'simplify';
    return 'keypadExpression';
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

  /** The letter this item's mathematics is written in. */
  _variable() {
    const item = this.item || {};
    return item.check?.variable
      || (String(item.answer ?? '').replace(/\\[a-zA-Z]+/g, ' ').match(/[a-zA-Z]/) || [])[0]
      // Control sequences are not unknowns. `\\sqrt{63}` has no letter in it, and
      // reading one out of the word "sqrt" gave the pad an `s` key and the
      // grader an `s` to test against.
      || (CLEAN(item.latex || '').replace(/\\[a-zA-Z]+/g, ' ').match(/[a-zA-Z]/) || [])[0]
      || '';
  }

  /**
   * WHAT MAKES THIS OPTION SET THIS OPTION SET.
   *
   * The answer alone is not enough, and that is not a detail: several cards in
   * a band end on the same answer, and a placement drawn off the answer put
   * the key in the same slot on every one of them. See `arranged`.
   */
  _cardSalt() {
    const it = this.item || {};
    return `${it.answer}|${it.skill ?? ''}|${it.form ?? ''}|${it.difficulty ?? ''}`;
  }

  /** The forms this item demands of an answer. See `demandsOf`. */
  _demands() {
    if (this._demandCache?.item !== this.item) {
      this._demandCache = { item: this.item, forms: demandsOf(this.item || {}, this._variable()) };
    }
    return this._demandCache.forms;
  }

  /**
   * Is this entry the QUESTION, handed straight back?
   *
   * The last lock, and the one that needs no opinion about the mathematics at
   * all. Whatever the task is, the line already printed at the top of the card
   * is not the answer to it — unless the bank says it is, which is why the key
   * itself is checked first and wins.
   */
  _isPromptRestated(src) {
    const item = this.item || {};
    const key = norm(String(item.answer ?? ''));
    for (const p of [item.check?.math, item.latex]) {
      if (!p) continue;
      const prompt = norm(String(p));
      if (!prompt || prompt === key) continue;
      if (norm(src) === prompt) return true;
    }
    return false;
  }

  /**
   * DOES THIS ENTRY SEAL THE RIFT?
   *
   * Two questions, and both of them have to answer yes.
   *
   *   1. does it say the same thing as the key (`sameAnswer`), and
   *   2. is it written in the form the task demands (`inForm`, `demandsOf`).
   *
   * Only the first of those used to be asked, and the consequence was measured
   * over 16,720 sampled Level 4 items: 1,763 of them sealed for a cadet who
   * typed the QUESTION back into the pad. `x^{2} + 5x + 6` is the same amount
   * as `(x + 2)(x + 3)`, so "write this as a product of brackets" was satisfied
   * by the unfactored original — no misconception flagged, no assist recorded,
   * and full unassisted mastery credit for factoring nothing.
   *
   * The key and anything the bank listed under `accept` still pass on sight,
   * before any of this runs: an item is always allowed to say what it will take.
   */
  _accepts(value) {
    const item = this.item;
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    const src = toTex(raw);
    const key = String(item.answer);
    if (norm(raw) === norm(key) || norm(src) === norm(key)) return true;
    for (const alt of item.accept || []) {
      const a = String(alt);
      if (norm(raw) === norm(a) || norm(src) === norm(toTex(a))) return true;
    }

    const v = this._variable();
    // A plain value keeps the checker it has always had. `12/4` is `3` and an
    // unreduced fraction is still a correct number, which several gates
    // measure and this pass is not entitled to change. Both spellings of a
    // fraction count: the pad stacks `3/2` into `\frac{3}{2}` on the way in,
    // and reading only one of the two told a cadet who typed the key that the
    // key was wrong.
    if (item.type === 'numeric') {
      const a = ratioOf(raw) || ratioOf(src);
      const b = ratioOf(key);
      if (a && b) return a.n * b.d === b.n * a.d;
      return false;
    }

    if (sameAnswer(src, String(item.answer), v) !== true) return false;
    if (this._isPromptRestated(src)) return false;
    for (const form of this._demands()) {
      if (inForm(src, form, v) === false) return false;
    }
    return true;
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
  /**
   * THE PAD, AND WHAT IT CAN SAY.
   *
   * A pad that cannot spell the answer is a rift with no way through it. This
   * one used to carry ten digits, a plus, a squared box, a fraction bar and a
   * sign flip, and that was the whole of it — no bracket, no radical, no equals
   * sign, no comma, no plus-or-minus. Every factoring, complete-the-square,
   * vertex-form and surd-root item in the bank routes here, and the key of
   * every one of them was literally impossible to enter. The only path to a
   * seal was to be wrong twice and take the narrowed scaffold.
   *
   * So the pad now carries the notation THIS item's answer space is written in,
   * and nothing else. The set is the union over the key, the alternatives the
   * bank accepts and every distractor — never the key alone, because a lone
   * plus-or-minus key on a card whose distractors have no plus-or-minus in them
   * would be the answer's shape, printed on the instrument. Brackets come as a
   * pair and the two order marks come as a pair, for the same reason.
   *
   * The keys write a plain alphabet — the thing a person writes on paper — and
   * `toTex` is the single translation from that into notation. See THE PAD
   * ALPHABET at the top of this file.
   */
  _keypad(work) {
    const self = this;
    const item = this.item;
    const expr = item.type === 'expression';
    const variable = this._variable();
    let entry = '';
    let narrowed = false;

    // ---- what this card is written in ------------------------------------
    //
    // TWO SOURCES, AND THEY ARE NOT THE SAME KIND OF THING.
    //
    // The ANSWER SPACE — the key, everything the bank also accepts, and every
    // distractor — decides which glyphs the pad must be able to write, letters
    // and relations included. Drawing it from the key alone would print the
    // answer's shape on the instrument: a lone plus-or-minus cap on a card
    // whose distractors carry none is a hint. The distractors are answer-shaped
    // by construction, so the union of all of them gives nothing away.
    //
    // The QUESTION contributes NOTATION ONLY — brackets, a power mark, a bar, a
    // root, plus-or-minus, the order marks — and never a letter and never an
    // equals sign. Its notation has to be in, or the pad would grow a power key
    // for `x^{2} + 6x + 9` and lose it for `x^{2} + 5x + 6`, and a cadet who
    // noticed that would know which of two cards of the SAME skill holds a
    // squared bracket without reading either. Its letters must stay out: a
    // prompt written `f\left(n\right) = ...` would otherwise put an `f` and an
    // equals sign on a pad whose answer is `(n + 3)^{2} + 2`.
    const readable = (x) => x != null && x !== ''
      && !/\\text|\\begin|\\square/.test(String(x));
    const spell = (x) => toPad(String(x));
    // Notation the pad's alphabet does not cover comes back with its control
    // sequences still in it. Letting that through would put the letters of
    // `\\ne` on the glass as if they were unknowns.
    const clean = (arr) => arr.filter(readable).map(spell).filter((x) => !x.includes('\\'));

    const answerSpellings = clean([item.answer, ...(item.accept || []),
      ...(item.distractors || []).map((d) => d.value)]);
    const promptSpellings = clean([item.check?.math, item.latex]);
    const NOTATION_ONLY = new Set(['(', ')', '^', '/', PAD_ROOT, PAD_PM, PAD_LE, PAD_GE]);

    const need = new Set();
    for (const sp of answerSpellings) for (const g of padGlyphs(sp)) need.add(g);
    for (const sp of promptSpellings) for (const g of padGlyphs(sp)) if (NOTATION_ONLY.has(g)) need.add(g);
    // Brackets are a pair, and so are the two order marks: half of either is a
    // hint about the answer rather than an instrument.
    if (need.has('(') || need.has(')')) { need.add('('); need.add(')'); }
    if (need.has(PAD_LE) || need.has(PAD_GE)) { need.add(PAD_LE); need.add(PAD_GE); }

    // Every letter the ANSWERS are written in, the item's own first.
    const letters = [];
    const answerLetters = new Set();
    for (const sp of answerSpellings) for (const g of padGlyphs(sp)) if (/^[a-zA-Z]$/.test(g)) answerLetters.add(g);
    for (const l of [variable, ...answerLetters]) {
      if (/^[a-zA-Z]$/.test(l) && !letters.includes(l) && letters.length < 3) letters.push(l);
    }

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

    /** How many brackets are still open, so a preview can close them. */
    const openCount = (s) => {
      let n = 0;
      for (const c of s) { if (c === '(') n++; else if (c === ')') n--; }
      return Math.max(0, n);
    };
    /** Is this entry a finished thing the rig could be asked to read? */
    const ready = (s) => {
      if (!s) return false;
      if (openCount(s)) return false;
      if (new RegExp(`[-+^/=,(${PAD_ROOT}${PAD_PM}${PAD_LE}${PAD_GE}]$`).test(s)) return false;
      return texOk(toTex(s));
    };

    const paint = () => {
      const empty = entry === '';
      val.classList.toggle('empty', empty);
      // The value is drawn as the cadet builds it, brackets closed for the
      // preview only — an unfinished line still has to be legible.
      const preview = entry + ')'.repeat(openCount(entry));
      val.innerHTML = empty
        ? tex('\\square')
        : (texFirst([toTex(entry), toTex(preview), texify(entry), entry, '\\square']) || tex('\\square'));
      // Long answers exist — `5(17n^2 + 13n + 21)` is fifteen glyphs — so the
      // socket steps its type down rather than cropping what was typed into it.
      val.classList.toggle('long', entry.length > 11);
      val.classList.toggle('longer', entry.length > 18);
      val.classList.toggle('longest', entry.length > 26);
      commit.disabled = !ready(entry);
      clear.disabled = empty;
      charge.classList.toggle('live', !empty);
    };

    /** Two operators in a row is not a thing a hand meant to type. */
    const OPEN_OK = new RegExp(`[-+^/=,(${PAD_PM}${PAD_LE}${PAD_GE}]$`);
    const push = (ch) => {
      if (self._settled || ch == null || entry.length + String(ch).length > MAX_ENTRY) return;
      if (/^[+^/=,]$/.test(ch) && (entry === '' || OPEN_OK.test(entry))) return;
      if (ch === '-' && /-$/.test(entry)) return;
      if (ch === ')' && !openCount(entry)) return;
      entry += ch;
      charge.classList.remove('bad');
      paint();
    };
    // A dedicated sign key, not a minus glyph: it flips the value it is looking
    // at. "5/2" becomes "-5/2", never the dangling "5/2-" a bare operator gives.
    // It stays on the pad that charges a VALUE. An expression pad gets a real
    // minus instead, because `x^2 - 6x + 11` needs one in the middle of a line
    // and no amount of flipping the whole entry will put it there.
    const negate = () => {
      if (self._settled) return;
      entry = entry.startsWith('-') ? entry.slice(1) : '-' + entry;
      charge.classList.remove('bad');
      paint();
    };
    const back = () => { entry = entry.slice(0, -1); charge.classList.remove('bad'); paint(); };
    /** Empty the socket. See `submit` for why this is not only a convenience. */
    const wipe = () => { entry = ''; charge.classList.remove('bad'); paint(); };

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
      const spent = entry;
      // THE SOCKET IS EMPTIED, AND THAT IS NOT A CONVENIENCE.
      //
      // It used to keep the refused entry, and the next glyph a cadet pressed
      // landed on the END of it. Their corrected answer was therefore submitted
      // as the wrong one with the right one stuck to it — a second miss, off one
      // real mistake, which burns the proving run and drives the scaffold down
      // a rung the cadet never earned. The refused line is not lost: it is
      // printed back to them in the first layer of the echo, which is where a
      // wrong answer belongs.
      entry = '';
      paint();
      self._miss(self._mis(spent), null, spent);
      // Two honest attempts in and the rig stops asking for a value it cannot
      // help with: the noise clears, a few readings remain, and the keypad
      // stands down rather than competing with them.
      tryNarrow();
    };

    /**
     * @param {string} glyph what this key writes into the socket, if anything.
     *        Published as `data-g` so a gate can ask the surface which glyphs it
     *        can emit rather than being told. It is the character already
     *        printed on the cap, so it gives a learner nothing they cannot see.
     */
    const KEY = (label, fn, cls = '', aria = '', glyph = '') => {
      const b = document.createElement('button');
      b.className = `rf-key ${cls}`;
      b.type = 'button';
      b.innerHTML = label;
      if (aria) b.setAttribute('aria-label', aria);
      b.dataset.k = aria || b.textContent.trim();
      if (glyph) b.dataset.g = glyph;
      self._click(b, fn);
      return b;
    };
    const BACK = '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9L2 12z"/><path d="M17 9l-5 6M12 9l5 6"/></svg>';
    // A WAY TO START AGAIN, ON THE GLASS.
    //
    // The socket is emptied on a refusal (see `submit`), and a cadet who has
    // simply mistyped needs the same thing on purpose. Backspace alone is not
    // that: fourteen glyphs of a wrong bracket is fourteen presses, and a
    // learner who cannot see a way to clear a field starts submitting rubbish
    // to get rid of it.
    const clear = KEY(t('rift.keypad.clear'), wipe, 'util wipe', t('rift.keypad.clear'), 'clear');
    const SIGN = { s: 'sign' };
    const OVER = { s: '/', t: '/', label: tex('\\square/\\square'), aria: t('rift.keypad.over') };
    const MINUS = { s: '-', t: '-', label: tex('-'), aria: t('rift.keypad.take') };

    /**
     * The notation this item needs, in the order a hand meets it. Each entry is
     * a key the pad draws only when one of this card's own answers is spelled
     * with it — see the note above `_keypad`.
     */
    const NOTATION = [
      { g: '(', t: '(', label: tex('\\left(\\square\\right.'), aria: t('rift.keypad.open') },
      { g: ')', t: ')', label: tex('\\left.\\square\\right)'), aria: t('rift.keypad.close') },
      { g: PAD_ROOT, t: PAD_ROOT, label: tex('\\sqrt{\\square}'), aria: t('rift.keypad.root') },
      { g: '^', t: '^', label: tex('\\square^{\\square}'), aria: t('rift.keypad.power') },
      { g: '=', t: '=', label: tex('='), aria: t('rift.keypad.equals') },
      { g: ',', t: ',', label: tex(','), aria: t('rift.keypad.also') },
      { g: PAD_PM, t: PAD_PM, label: tex('\\pm'), aria: t('rift.keypad.plusMinus') },
      { g: PAD_LE, t: PAD_LE, label: tex('\\le'), aria: t('rift.keypad.atMost') },
      { g: PAD_GE, t: PAD_GE, label: tex('\\ge'), aria: t('rift.keypad.atLeast') },
    ];

    // The four columns nearest the thumb carry what every answer of this kind
    // uses. Anything rarer is on the notation rows underneath.
    const PLUS = { s: '+', t: '+', label: tex('+') };
    // Three layouts, and the difference between them is what the card is FOR.
    //
    //  · charging a value      — the sign cap flips the whole entry, so a
    //                            negative number is never a dangling operator
    //  · writing an expression — a real minus, because `x^{2} - 6x + 11` needs
    //                            one in the middle of a line and no amount of
    //                            flipping the entry will put it there
    //  · an expression with no letter in it (a radical, a plain arithmetic) —
    //                            the same, with the letter cap's slot given
    //                            back to the operators
    const inBase = new Set(expr ? ['+', '-', '/'] : ['/']);
    if (expr && letters.length) inBase.add(letters[0]);
    const rows = !expr
      ? [['7', '8', '9', { s: 'back' }],
        ['4', '5', '6', SIGN],
        ['1', '2', '3', OVER],
        [{ s: '0', t: '0', wide: 3 }, { s: 'clear' }]]
      : letters.length
        ? [['7', '8', '9', { s: letters[0], t: letters[0] }],
          ['4', '5', '6', PLUS],
          ['1', '2', '3', MINUS],
          ['0', OVER, { s: 'back' }, { s: 'clear' }]]
        : [['7', '8', '9', PLUS],
          ['4', '5', '6', MINUS],
          ['1', '2', '3', OVER],
          [{ s: '0', t: '0', wide: 2 }, { s: 'back' }, { s: 'clear' }]];

    const wanted = NOTATION.filter((k) => need.has(k.g) && !inBase.has(k.g));
    // The letters the answers use, past the first — a second unknown is a real
    // part of some of these answers and there was no way to write one.
    for (const l of letters.slice(1)) wanted.push({ g: l, t: l, label: tex(l), aria: l });
    for (let i = 0; i < wanted.length; i += 4) rows.splice(rows.length, 0, wanted.slice(i, i + 4));

    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell === 'string') { keys.appendChild(KEY(cell, () => push(cell), '', '', cell)); continue; }
        if (cell.s === 'back') { keys.appendChild(KEY(BACK, back, 'util', t('rift.keypad.back'), 'back')); continue; }
        if (cell.s === 'clear') { keys.appendChild(clear); continue; }
        if (cell.s === 'sign') { keys.appendChild(KEY(tex('-'), negate, 'util', t('rift.keypad.minus'), 'sign')); continue; }
        const ch = cell.t ?? cell.s;
        const label = cell.label || cell.s;
        const cls = (cell.wide ? `wide${cell.wide}` : '') + (/^[0-9a-zA-Z]+$/.test(ch) ? '' : ' util');
        keys.appendChild(KEY(label, () => push(ch), cls, cell.aria || ch, ch));
      }
    }
    const commit = KEY(t('rift.keypad.set'), submit, 'commit', '', 'seal');
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
        // A CAP THAT HAS THE FOCUS ANSWERS ITS OWN KEY.
        //
        // Every cap is a real button, so a hand with no mouse reaches the
        // radical and the plus-or-minus by tabbing to them. Enter on a focused
        // cap already presses it; reading that same Enter here as "commit"
        // would type a glyph and submit the entry in one keystroke.
        if (e.target instanceof Element && e.target.closest('.rf-key')) return;
        if (/^[0-9]$/.test(e.key)) push(e.key);
        else if (e.key === '-') (expr ? push('-') : negate());
        else if (e.key === '/') push('/');
        else if (letters.includes(e.key)) push(e.key);
        else if (e.key === '+' || e.key === '^' || e.key === '(' || e.key === ')'
          || e.key === '=' || e.key === ',') push(e.key);
        else if (e.key === 'Backspace') back();
        else if (e.key === 'Delete') wipe();
        else if (e.key === 'Enter') submit();
        else return;
        e.preventDefault();
      },
      /**
       * Put a written answer in the socket. Takes the bank's notation as
       * readily as the pad's own alphabet, so a harness and a hand reach the
       * same place: `\left(x + 2\right)\left(x + 3\right)` becomes `(x+2)(x+3)`.
       */
      set(v) { entry = toPad(String(v)); paint(); },
      /** Which glyphs this pad can emit. The gate reads it; nothing else does. */
      glyphs: () => [...new Set([...'0123456789', ...letters,
        ...(expr ? ['+', '-', '/'] : ['/', '-']),
        ...wanted.map((k) => k.g)])],
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
  /**
   * Is this option the KEY'S OWN VALUE, whatever it is written to look like?
   *
   * `_accepts` cannot answer that on its own any more, and must not: it now
   * refuses a right value in the wrong form, which is the whole point of it.
   * An option set has a stricter rule than the grader — the key may not appear
   * in it twice under MATHEMATICAL equality, not merely under textual equality
   * — because two buttons carrying the same number with one of them marked
   * wrong is the surface calling a correct cadet wrong.
   *
   * This is where the old net had its hole. It ran `_accepts`, `_accepts` ran
   * `equivalent()`, and `equivalent()` throws on any string containing an "=".
   * Every surd-root item therefore listed its own answer twice: over a sample
   * of 586 of them, `n = 2 \pm \sqrt{20}` sat beside the key `n = 2 \pm 2\sqrt{5}`
   * and was scored as an error with a misconception tag on it.
   */
  _sameValue(v) {
    return sameAnswer(String(v), String(this.item?.answer ?? ''), this._variable()) === true;
  }

  _readings(ds) {
    const key = String(this.item.answer);
    const draw = (v) => texFirst([texify(v), v]) || v;
    const pool = [{ v: key, ok: true, html: draw(key) }];
    for (const d of ds) {
      const v = String(d.value ?? '');
      if (!v.trim() || this._accepts(v) || this._sameValue(v)) continue;
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
    for (const p of arranged(pool, this.seed + 17, `${this._cardSalt()}|${round}`)) {
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
    for (const p of arranged(pool, this.seed + 5, this._cardSalt())) {
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

    /**
     * THE MOVES ON OFFER, AND WHY NEITHER THEIR ORDER NOR THEIR SHAPE MAY SAY
     * WHICH ONE IS THE IDEAL.
     *
     * This tray is an answer surface exactly like a set of readings, and until
     * `tools/critic/choiceshape.mjs` learned to read it, nothing had ever
     * measured it. Two things were wrong at once, and both were one line.
     *
     *  · POSITION. The list was shuffled, cut to five, and then — when the
     *    shuffle had dropped the ideal move — the ideal was written into the
     *    LAST slot. So over 6,525 five-button trays the ideal sat last 30.0% of
     *    the time against 20%, and 47.1% of the time on `both-sides`, which is
     *    on the shipped route. It is now placed at a DRAWN slot, from the same
     *    kind of avalanched hash `arranged()` uses for the key of a reading.
     *
     *  · SHAPE. Nothing chose WHICH four wrong moves stood beside the ideal, so
     *    the ideal was the one an eye could pick out: "take the option with the
     *    fewest digits" named it 42.0% of the time against 24.6%, "take the one
     *    with a letter in it" 33.2%, and on a three-button tray the ideal was
     *    the longest move 95.9% of the time — `\div\; 2` beside `+\; 10` and
     *    `-\; 10`. The four companions are now chosen by `balancedPick`, the
     *    same instrument `src/learn/generators.js` uses on a card's readings.
     *
     * A thin tray cannot be balanced, so the catalogue of legal-but-wrong moves
     * is deeper than it was: dividing by a constant that is on screen, undoing
     * the coefficient with the wrong sign, and adding the two constants
     * together are all moves a learner really makes, they are all legal
     * algebra, and they give the choice above something to choose between.
     *
     *  · AND THE THIRD ONE, WHICH NEITHER OF THOSE COULD SEE: THE OPERATOR.
     *    `balancedPick` reads printed length, digit count and six written
     *    features, and a move's KIND is in none of them — `\div\; 4` and
     *    `+\; 8` are the same length, carry the same digit count and share
     *    every feature. But the closing move of every beam is the DIVISION,
     *    and a mixed tray usually carried exactly one, so "if there is a
     *    divide button, press it" was a rule with no algebra in it.
     *
     *    The repair is not another cue. Adding the division glyph to
     *    `src/learn/shape.js` was tried and measured WORSE — 24.31% -> 35.59%
     *    — because a one-sided cue asked for a silence the catalogue could not
     *    reach, and then spent the freedom failing to reach it.
     *
     *    THE TRAY IS ONE KIND OF MOVE. Every button on it collects, or every
     *    one unwraps a constant, or every one divides. A cue over the operator
     *    then never fires at all, on any tray, which is the one arrangement
     *    that is worth exactly chance rather than close to it — and the cadet
     *    is left with the question the beam is actually for: not WHICH
     *    OPERATION (the beam's own state says that, and it was never the tray
     *    that tested it) but WHICH NUMBER. Being handed five divisions and
     *    having to pick the coefficient out of them is strictly more of this
     *    skill than being handed one division among four additions.
     *
     *    So the catalogue is deeper again, and deeper in one direction: every
     *    number ON THE BOARD, its negative, the sums and differences of the
     *    pairs, and — for a division — the whole factors of those, because
     *    "divide by the number that goes into the one I can see" is a slip
     *    people really make. `deepen` only ever adds moves of the ideal's own
     *    kind, and `apply` still refuses anything illegal.
     */
    const TRAY = 5;
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
      // The deeper catalogue. Every one of these is legal and every one of them
      // is a move somebody makes: unwrap by a number you can see rather than
      // the one attached to the unknown, take the coefficient off the wrong
      // way round, gather the two constants together.
      if (!fZero(st.L.a)) push(opVar(st.L.a));
      if (st.L.b.n > 0 && !fOne(st.L.b)) push(opDiv(st.L.b));
      if (st.R.b.n > 0 && !fOne(st.R.b)) push(opDiv(st.R.b));
      const bothB = fAdd(st.L.b, st.R.b);
      if (bothB && !fZero(bothB)) { push(opConst(fNeg(bothB))); push(opConst(bothB)); }
      const bothA = fAdd(st.L.a, st.R.a);
      if (bothA && !fZero(bothA)) push(opVar(fNeg(bothA)));
      const gapB = fAdd(st.L.b, fNeg(st.R.b));
      if (gapB && !fZero(gapB)) { push(opConst(fNeg(gapB))); push(opConst(gapB)); }
      const gapA = fAdd(st.L.a, fNeg(st.R.a));
      if (gapA && !fZero(gapA)) push(opVar(fNeg(gapA)));
      // Unwrapping by the negative of a coefficient is legal and is the move a
      // learner makes when the sign has already gone wrong. It also gives the
      // choice above a move whose digit count matches the ideal's, which is
      // what a five-move tray needs if the ideal is not to be the thinnest
      // thing on it.
      if (!fZero(st.L.a) && !fOne(fAbs(st.L.a))) push(opDiv(fNeg(st.L.a)));
      if (!fZero(st.R.a) && !fOne(fAbs(st.R.a))) push(opDiv(fNeg(st.R.a)));
      // Taking the coefficient off as though it were a constant, and moving a
      // single unknown across. Both are moves this rig already names as
      // misconceptions when a learner makes them, and `-\; x` is the only move
      // on the beam that carries no digit at all — without it a five-move tray
      // has nothing for the ideal move to stand ABOVE, and the ideal is the
      // thinnest thing on screen whatever else is offered.
      if (!fZero(st.L.a)) { push(opConst(fNeg(st.L.a))); push(opConst(st.L.a)); }
      if (!fZero(st.R.a)) { push(opConst(fNeg(st.R.a))); push(opConst(st.R.a)); }
      push(opVar(fr(-1)));
      push(opVar(fr(1)));

      const salt = `${self.seed}|${history.length}|${sideTex(st.L, v)}=${sideTex(st.R, v)}`;
      if (!best) return shuffled(list, mixed(self.seed, salt)).slice(0, TRAY);

      /* EVERY OTHER MOVE OF THE IDEAL'S OWN KIND THAT THE BOARD CAN JUSTIFY.
         The tray is one kind of move (see the note above), and four companions
         of one kind need a deeper catalogue than the mixed list above can
         always give. Everything here is drawn off the numbers a learner can
         see: the four parts of the two sides, their negatives, and the sums
         and differences of the pairs — plus, for a division, the whole factors
         of those, which is the move somebody makes when they divide by a
         number that "goes into" one on the board rather than by the one
         attached to the unknown. `push` still refuses an illegal move and a
         duplicate. */
      const mk = best.kind === 'div' ? opDiv : best.kind === 'var' ? opVar : opConst;
      const board = [];
      const feed = (f) => { if (f && !fZero(f) && !fBig(f)) { board.push(f); board.push(fNeg(f)); } };
      for (const f of [st.L.a, st.L.b, st.R.a, st.R.b]) feed(f);
      feed(fAdd(st.L.a, st.R.a)); feed(fAdd(st.L.b, st.R.b));
      feed(fAdd(st.L.a, fNeg(st.R.a))); feed(fAdd(st.L.b, fNeg(st.R.b)));
      feed(fAdd(st.L.a, st.L.b)); feed(fAdd(st.R.a, st.R.b));
      if (best.kind === 'div') {
        for (const f of board.slice()) {
          const n = fNum(f);
          if (!Number.isInteger(n)) continue;
          for (let q = 2; q <= Math.min(12, Math.abs(n)); q++) if (n % q === 0) feed(fr(q));
        }
      } else {
        feed(fr(1)); feed(fr(2));
      }
      for (const f of board) push(mk(f));
      // A deeper catalogue means more subsets, and the count of them is a
      // binomial: twenty legal moves would be 4,845 sets to cost, and this runs
      // on every move of every beam. Twelve is 495, which is plenty of choice,
      // and the twelve are DRAWN rather than truncated, so no move is
      // systematically the one that never appears.
      /* ONE KIND ONLY. Where the board cannot supply four companions of the
         ideal's kind the tray falls back on the mixed list rather than showing
         three buttons — a thin tray is a worse leak than a mixed one — and
         `tools/critic/choiceshape.mjs` reads how often that happens off the
         real `candidates()` and prints it. */
      const kin = list.filter((o) => o.kind === best.kind && o.tex !== best.tex);
      const rest = kin.length >= TRAY - 1 ? kin : list.filter((o) => o.tex !== best.tex);
      const alts = shuffled(rest, mixed(self.seed, `${salt}|pool`)).slice(0, 12);
      const room = Math.min(TRAY - 1, alts.length);
      // Every set of `room` companions the beam can legally offer, in a stable
      // order, so `balancedPick` chooses the one whose shape says least.
      const sets = [];
      (function choose(from, taken) {
        if (taken.length === room) { sets.push(taken.slice()); return; }
        for (let i = from; i < alts.length; i++) { taken.push(i); choose(i + 1, taken); taken.pop(); }
      })(0, []);
      const at = balancedPick(best.tex,
        sets.map((ix, i) => ({ show: ix.map((j) => alts[j].tex), rank: i })), salt);
      const keep = sets[at].map((j) => alts[j]);
      // WHERE the ideal sits is drawn, never appended. See the note above.
      // Taken off the TOP bits of the avalanche, not `% n`: over 1,632 real
      // trays the low bits of this mixer put the ideal in the last slot 25.2%
      // of the time against 20%.
      const draw = mixed(self.seed ^ 0x5bd1e995, salt) / 4294967296;
      keep.splice(Math.floor(draw * (keep.length + 1)), 0, best);
      return keep;
    }

    function misFor(op, st) {
      const V = fZero(st.L.a) ? st.R : st.L;
      if (op.kind === 'div' && !fZero(V.b)) return 'wrong-unwrap-order';
      /* A tray of five divisions needs every one of its wrong moves named, or
         the echo has nothing to answer a miss with — and before the tray was
         one kind, a wrong division at the closing step was the one move on the
         beam that carried no diagnosis at all. */
      if (op.kind === 'div') return fZero(fAdd(op.f, V.a)) ? 'sign-slip' : 'arith-slip';
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

    /**
     * THE ORDER THE CHIPS LIE IN, AND WHY IT IS DRAWN RATHER THAN COPIED.
     *
     * The tray used to be built straight out of `parseTerms`, which reads the
     * printed statement left to right. So the chips arrived in the statement's
     * own term order — and a statement like `14a + 30 - 7a + 18` alternates
     * variable, number, variable, number, because that is how a collect-like-
     * terms prompt is written. Measured over the shipped route: 95.5% of 3,279
     * boards alternated strictly, and the FIRST chip carried the unknown on
     * 3,279 of 3,279. The unknown's bay is always the left one. So "tap the
     * first loose chip into the left bay, the next into the right, and keep
     * alternating" filed every chip of every board with no miss — an
     * UNASSISTED seal, which is the only kind that advances a proving run — on
     * a node of the FIRST shipped unit, with no idea what a like term is.
     *
     * It is the colour defect one layer along. Nothing on a loose chip may say
     * which bay it belongs in, and WHERE IT LIES is something a chip says.
     *
     * So the tray is drawn from the card's own hash. Not equalised: a rule
     * that guaranteed the chips never alternate would be a cue of its own, and
     * this repository has already turned one weak cue into a perfect
     * elimination rule exactly that way. Drawn means the order carries nothing
     * about the kinds, and the best fixed positional rule is then worth
     * 1 / C(n, p) — what a cadet who knows only how many chips of each kind a
     * board holds gets by guessing, and no more.
     *
     * `tools/critic/choiceshape.mjs` plays every positional rule over every
     * route board and reports the best of them against that number.
     */
    const chipOrder = shuffled(terms, mixed(self.seed, `sort|${src}`));

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

    for (const term of chipOrder) {
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

    // Every shard that is not the answer is a real slip: the term left
    // undistributed, the sign carried onto only one term, the factor added
    // instead of multiplied.
    //
    // THE TRAY IS BUILT HERE, ABOVE THE FIRST LINE OF DOM, so that
    // `tools/critic/riftsurfaces.mjs` can cut it out of this file and execute
    // it. A surface whose option set is assembled halfway down a DOM builder is
    // a surface no gate can read, and this one went unmeasured for that reason
    // alone while it was the second-worst leak in the game.
    const chips = areaTray({ k, a, b, v, wantA, wantB, seed: self.seed });
    const misOf = new Map(chips.filter((c) => c.m).map((c) => [c.v, c.m]));

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
        // Every shard the tray carries is tagged where it is BUILT, so a
        // deeper catalogue cannot quietly add an untagged one and leave the
        // echo with nothing to say. (see `areaTray`)
        self._miss(misOf.get(value) || null, t('rift.area.rejected'));
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

    for (const { v: value } of chips) {
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
