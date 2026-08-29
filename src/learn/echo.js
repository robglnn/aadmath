/**
 * The echo: what a cadet is shown after a slip, and in what order.
 *
 * This module owns the *content* of the faded worked example. The surface owns
 * only its pixels. Three things had to be true for it to be worth anything:
 *
 *   1. **The first layer carries mathematics, and it is aimed.** A sentence
 *      naming a misconception is a diagnosis, not a lesson. So layer one is
 *      always something computed from the learner's own move, and which thing
 *      depends on what the move was — a teacher does not answer "you squared
 *      the minus" the way they answer "you read the log one row down". The
 *      probes, in the order they are tried:
 *
 *        · a number set beside another instead of multiplied  ->  the product
 *          and the two-digit number, side by side;
 *        · a minus read into the base of a power  ->  both readings expanded;
 *        · a power read as a multiplication  ->  the copies written out;
 *        · an expression read strictly left to right  ->  the brackets they
 *          drew in without noticing, with their own value beside them;
 *        · any other wrong evaluation  ->  the input that *would* have given
 *          their number, because their answer is the answer to some question
 *          and naming that question takes it seriously;
 *        · a value handed to an equation  ->  both pans reweighed, and which
 *          way the beam tipped, so they know whether to aim higher or lower;
 *        · an equation with no unique answer  ->  two substitutions, showing a
 *          gap that never closes or a statement that never fails;
 *        · a burned log line  ->  the rate between surviving rows and the rate
 *          their number implies, left unworked, because working them out is
 *          the lesson;
 *        · a point off a trace  ->  the same, in fractions;
 *        · a log line whose *input* burned  ->  their number run through the
 *          rule at the head of the column;
 *        · a rewrite  ->  the invariance test: put a number in, and whatever
 *          you write has to come to what this comes to;
 *        · a legal-but-useless move on the beam  ->  what is still standing in
 *          the way, counted, not gestured at;
 *        · a move that changed the solution set  ->  proof that it did;
 *
 *      and, from Levels 4 and 5, on the eight kinds those units introduced:
 *
 *        · a root  ->  both sides squared back, because squaring back is what
 *          a root IS; a root split over a sum gets the split spelled out and
 *          the two values side by side, one of them as a decimal, because the
 *          whole misconception is that they are "about the same size";
 *        · a fractional count above a number  ->  the cadet's value raised by
 *          the count on the bottom, which takes no root at all;
 *        · a squared statement  ->  their value put back on the beam; or, when
 *          every value they named holds, the part under the root and how many
 *          values it says there are;
 *        · a product of brackets, and a completed square  ->  their own
 *          brackets multiplied back out, and the leftover printed;
 *        · a division  ->  multiplied back, which needs no excluded value;
 *        · a curve  ->  the rule read at an input: at zero, one step each side
 *          of a claimed turn, or anywhere it beats a claimed greatest value;
 *        · a list  ->  the step or the factor their number would need against
 *          the one the list makes, both left unworked;
 *        · a set of pairs  ->  the column their number was read from;
 *        · a second line  ->  the marked reading put into their own rule, and
 *          the two rates multiplied;
 *        · a region  ->  the marked reading and the printed edge readings put
 *          into the lean they wrote;
 *        · a pair of rules  ->  the two tables' rates, which differ;
 *        · a fitted line  ->  a reading they copied, two pairs whose rates
 *          disagree, a gap worked out at a different row, or the total of the
 *          squared gaps their own answer implies against the closest line's;
 *        · a frequency table  ->  the row added up, and which heading their
 *          reading sits under;
 *        · a list that multiplies  ->  their factor or their start run forward
 *          onto a printed reading.
 *
 *      Nothing is asserted that the rig has not just computed, and any probe
 *      it cannot compute is a probe it does not show. `tools/validate-items.mjs`
 *      pushes every tagged wrong value of every Level 1 form through layer one,
 *      and `tools/check-echo.mjs` does the same for EVERY node of EVERY unit in
 *      three languages; both fail the build if one comes back with the prompt
 *      restated. That gate exists because for a year they did: sixteen skills
 *      answered every tagged slip by reading the question back.
 *
 *   2. **Every layer differs from the one above it.** The ladder is a real
 *      fading sequence — complete, partial, none, run backwards. A row can be
 *      `full` (notation and reason), `open` (its left side and its reason, the
 *      right side burned to a box — a completion problem), or `hidden` (reason
 *      only). Layer 2 opens one move; layer 3 opens every move but the landing;
 *      layer 4 gives the landing away. Because a row's *reason* survives at
 *      every level, the cadet always has something to think with.
 *
 *   3. **Nothing here leaks the live answer.** The worked trace comes from a
 *      different tear (`./scaffold.js` guarantees the analogue shares no digits
 *      with the live answer), and the counterexample never prints the value the
 *      live rift wants — only the value the cadet handed in, and the fact that
 *      the statement rejects it.
 *
 * Everything a learner reads comes from `content/lang/items.*.js`, so the whole
 * ladder exists in EN, ES and PL.
 */
import {
  evaluate, varsOf, solveLinear, parse, parseEquation, linearize, parseArrayCells, parseArrayBlocks,
  evalAst, evalSurd, answerValues, polyCoeffs, polyDegree, polyTex, solveQuadratic, splitTop,
  radicandsOf,
} from './parser.js';
import {
  R, str as rstr, texOf, fromString, eq as reqq, sub, add, mul, div, neg, pow as rpow,
  isZero, toNum, isR, cmp as rcmp, sign as rsign, isSafe,
} from './rational.js';
import {
  SR, sAdd, sSub, sMul, sPow, sEq, sCmp, sToNum, sTex, sIsRational, sIsZero, simplifySqrt,
} from './surd.js';
import { diagnose, padToTex } from './diagnose.js';
import { makeT } from './strings.js';

export const MAX_TIER = 4;

const BOX = '\\square';
/** A subtracted negative needs its brackets: "7 - -3" is notation nobody writes. */
const par = (n) => (n < 0 ? `\\left(${n}\\right)` : String(n));
const HIDDEN = '\\square \\;\\; \\square \\;\\; \\square';

/** Replace a variable with a value, without touching letters inside \commands. */
function substitute(latex, v, valueTex) {
  let out = '';
  for (let i = 0; i < latex.length;) {
    if (latex[i] === '\\') {
      const m = /^\\[a-zA-Z]+|^\\./.exec(latex.slice(i));
      const tok = m ? m[0] : '\\';
      out += tok; i += tok.length; continue;
    }
    if (latex[i] === v) { out += valueTex; i++; continue; }
    out += latex[i]; i++;
  }
  return out;
}

/**
 * Write a value in for a letter, and check by evaluation that the notation
 * still means what it meant.
 *
 * Textual replacement is a trap: putting 4 into "5t + 12" gives "54 + 12",
 * which is a different and false statement rendered in exactly the same font
 * as a true one. Brackets always fix it and sometimes clutter it, so both
 * renderings are built and the unbracketed one is used only when parsing it
 * back gives the same value the substitution was supposed to have. Nothing is
 * shown on the strength of looking right.
 *
 * @returns {string|null} notation that is verified to carry the same value
 */
function substituteVerified(latex, v, val, env = {}) {
  let want;
  try { want = evaluate(latex, { ...env, [v]: val }); } catch { return null; }
  // A NEGATIVE value is written in brackets first, not second. Bare, it lands
  // against whatever sign is already there and prints "--3 + 1 = 4", which
  // parses to the right number and reads like a typing accident. Level 2 runs
  // a cadet's own rule at a negative reading, so this is now a common row.
  const bare = rstr(val);
  const wrapped = `\\left(${bare}\\right)`;
  for (const written of (toNum(val) < 0 ? [wrapped, bare] : [bare, wrapped])) {
    const out = substitute(latex, v, written);
    try { if (reqq(evaluate(out, env), want)) return out; } catch { /* try the next */ }
  }
  return null;
}

/** Write every known value into an expression at once, or give up. */
function substituteAll(latex, env) {
  let out = latex;
  const left = { ...env };
  for (const name of Object.keys(env)) {
    delete left[name];
    out = substituteVerified(out, name, env[name], left);
    if (!out) return null;
  }
  return out;
}

/** Top-level split of "a = b" into its two sides, or null. */
function sides(latex) {
  if (/\\square|\\Rightarrow|\\begin/.test(latex)) return null;
  const parts = String(latex).split('=').map((p) => p.trim()).filter(Boolean);
  return parts.length === 2 ? parts : null;
}

/**
 * The side of the displayed prompt that carries the situation.
 *
 * "m + m + m + m = \square" holds its truth on the left and a gap on the
 * right. Substituting into that side gives a counterexample built from what is
 * already on the learner's screen — the strongest kind, because there is
 * nothing to take on trust.
 */
function promptTruth(item, v, allowed = null) {
  const raw = String(item.latex || '');
  if (/\\begin|\\Rightarrow/.test(raw)) return null;
  const parts = raw.split('=').map((p) => p.trim());
  // `allowed` is the set of letters the caller is prepared to write a number
  // in for. With none given the rule is what it always was — one letter, and it
  // must be this one — so every existing caller reads exactly as before. The
  // value probe passes the whole letter set now, because `like-terms` prints
  // boards carrying two of them and a prompt with `x` and `y` on it is still a
  // prompt a number can be put into, once both get one.
  const usable = parts.filter((p) => {
    if (!p || /\\square/.test(p)) return false;
    const vs = varsOf(p);
    if (!vs.includes(v)) return false;
    return allowed ? vs.every((x) => allowed.has(x)) : vs.length === 1;
  });
  if (usable.length !== 1) return null;
  return usable[0];
}

/** The variable this item is about. */
function varOf(item) {
  if (item.check?.variable) return item.check.variable;
  const m = String(item.answer).match(/[a-zA-Z]/) || String(item.latex).match(/(?<!\\)[a-zA-Z](?![a-zA-Z])/);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// Instruments the probes are built from.
//
// Every one of these either computes an exact fact or returns null. Nothing in
// the echo is ever asserted because it is probably true.
// ---------------------------------------------------------------------------

/** Bind every known value except `v`, so what is left is a function of `v` alone. */
function holdOthers(latex, v, env = {}) {
  let out = latex;
  const rest = { ...env };
  delete rest[v];
  const left = { ...rest };
  for (const name of Object.keys(rest)) {
    delete left[name];
    const bound = typeof rest[name] === 'number' ? R(rest[name]) : rest[name];
    out = substituteVerified(out, name, bound, left);
    if (!out) return null;
  }
  return out;
}

/**
 * "Your number would be right if the letter were …"
 *
 * The single most useful sentence a teacher has for a wrong evaluation, because
 * it treats the learner's answer as the answer to *some* question and then shows
 * which question that was. It never prints the value this item wants: it prints
 * the input that would have produced theirs.
 *
 * @returns {import('./rational.js').Rational|null}
 */
function inputThatGives(latex, v, target, env = {}) {
  const f = holdOthers(latex, v, env);
  if (!f) return null;
  try {
    const sol = solveLinear(`${f} = ${rstr(target)}`, v);
    return sol.kind === 'unique' ? sol.value : null;
  } catch { return null; }
}

/**
 * Rebuild the expression the way a strict left-to-right reader would have
 * grouped it, and show the brackets they invisibly inserted.
 *
 * Only attempted on a flat chain of numbers and binary operators, because that
 * is the only shape where "read it as it comes" is unambiguous — and it is
 * exactly the shape where order of operations bites.
 */
const FLAT_CHAIN = /^\s*-?\d+(?:\s*(?:\+|-|\\cdot|\\div)\s*-?\d+)+\s*$/;
function leftToRightTex(latex) {
  if (!FLAT_CHAIN.test(latex)) return null;
  // Rebuild as ((a op b) op c) …, bracketing every join the notation does not.
  const parts = String(latex).trim().split(/(\\cdot|\\div|\+|(?<=\d)\s-)/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 5 || parts.length % 2 === 0) return null;
  let tex = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    // The outermost pair would wrap the whole line and say nothing: the
    // brackets worth drawing are the ones inside, where the reading went wrong.
    tex = i + 2 < parts.length ? `\\left(${tex} ${parts[i]} ${parts[i + 1]}\\right)` : `${tex} ${parts[i]} ${parts[i + 1]}`;
  }
  return tex;
}

/**
 * A power read as a multiplication. `3^{2}` handed in as 6 is not an arithmetic
 * slip, it is a reading of the notation, and the answer to it is the notation
 * written out in full: three, twice, multiplied.
 *
 * @returns {{tex:string, base:number, k:number}|null}
 */
function powerAsCopies(latex, env, target) {
  const m = /(?:\\left\()?\s*(-?\d+)\s*(?:\\right\))?\s*\^\s*\{?\s*(\d+)\s*\}?/.exec(latex);
  if (!m) return null;
  const base = Number(m[1]);
  const k = Number(m[2]);
  if (!(k >= 2 && k <= 4)) return null;
  const mis = latex.slice(0, m.index) + `\\left(${base} \\cdot ${k}\\right)` + latex.slice(m.index + m[0].length);
  try { if (!reqq(evaluate(mis, env), target)) return null; } catch { return null; }
  return { tex: `${m[0].trim()} = ${Array.from({ length: k }, () => base).join(' \\cdot ')}`, base, k };
}

/**
 * A minus sign that belongs to the base, and one that does not.
 *
 * `-3^{2}` is minus nine and `\left(-3\right)^{2}` is nine, and the whole
 * difference is a pair of brackets. A cadet who hands in the second value has
 * not made an arithmetic error; they have read a bracket that is not there. So
 * the answer is both readings, spelled out in full, side by side.
 *
 * @returns {{tex:string}|null}
 */
function negativeBaseRead(latex, env, target) {
  const m = /(^|[^\d\w}])-\s*(\d+)\s*\^\s*\{?\s*(\d+)\s*\}?/.exec(latex);
  if (!m) return null;
  const base = Number(m[2]);
  const k = Number(m[3]);
  if (!(k >= 2 && k <= 4)) return null;
  const bracketed = `\\left(-${base}\\right)^{${k}}`;
  const mis = latex.slice(0, m.index) + m[1] + bracketed + latex.slice(m.index + m[0].length);
  try { if (!reqq(evaluate(mis, env), target)) return null; } catch { return null; }
  const copies = (x) => Array.from({ length: k }, () => x).join(' \\cdot ');
  return {
    tex: `${bracketed} = ${copies(`\\left(-${base}\\right)`)} \\qquad -${base}^{${k}} = -\\left(${copies(base)}\\right)`,
  };
}

/** A number written where a product belongs: "2" beside "11" read as 211. */
function juxtaposedDigits(raw, parts) {
  const want = String(raw).trim();
  for (const a of parts) {
    for (const b of parts) {
      if (a === b) continue;
      if (`${a}${b}` === want) return { a, b };
    }
  }
  return null;
}

/**
 * The rule written at the head of a log's second column.
 *
 * It is read back out of the notation the learner is looking at rather than out
 * of the item's internals, so what the probe runs a number through is provably
 * the rule on screen and not a private copy of it.
 *
 * @returns {{tex:string, v:string}|null}
 */
function headerRule(latex) {
  let cells;
  try { cells = parseArrayCells(latex); } catch { return null; }
  const head = cells[0];
  if (!head || head.length !== 2) return null;
  const v = String(head[0]).trim();
  if (!/^[a-zA-Z]$/.test(v)) return null;
  const tex = String(head[1]).trim();
  const vars = varsOf(tex);
  if (vars.length !== 1 || vars[0] !== v) return null;
  return { tex, v };
}

/** The two sides of a linear equation as a single (a·v + b) difference. */
function slopeOf(latex, v) {
  try {
    const { left, right } = parseEquation(latex);
    const L = linearize(left, v), Rt = linearize(right, v);
    return { a: sub(L.a, Rt.a), b: sub(L.b, Rt.b) };
  } catch { return null; }
}

/**
 * What is still standing between the unknown and its value.
 *
 * A learner mid-solve who has just made a legal but useless move needs to be
 * told what is left in the way, not that they were wrong — they were not wrong.
 * So the state is read structurally: is the unknown on both pans, is something
 * multiplying it, is something added to it.
 */
function whatBlocks(stateTex, v) {
  const parts = sides(stateTex);
  if (!parts) return null;
  let L, Rt;
  try {
    L = linearize(parse(parts[0]), v);
    Rt = linearize(parse(parts[1]), v);
  } catch { return null; }
  const bothSides = !isZero(L.a) && !isZero(Rt.a);
  const a = sub(L.a, Rt.a);
  const b = sub(L.b, Rt.b);
  if (isZero(a)) return null;
  const coef = !reqq(a, R(1)) && !reqq(a, R(-1));
  const konst = !isZero(b);
  return { bothSides, coef, konst, a, b };
}

// ---------------------------------------------------------------------------
// Layer one: the learner's own entry, put back into the statement.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Level 2 instruments. Same contract as everything above: each computes an
// exact fact or returns nothing, and none of them prints the live answer.
// ---------------------------------------------------------------------------
/** `\le` and `\ge` must not be read out of `\left` and `\gets`. */
const REL_TOKENS = /\\le(?![a-zA-Z])|\\ge(?![a-zA-Z])|<|>/g;

/** "a < b \le c" -> { parts: [a, b, c], rels: ['<', '\\le'] }. */
function relationsOf(src) {
  const parts = [];
  const rels = [];
  let last = 0;
  let m;
  REL_TOKENS.lastIndex = 0;
  while ((m = REL_TOKENS.exec(String(src)))) {
    rels.push(m[0]);
    parts.push(String(src).slice(last, m.index));
    last = m.index + m[0].length;
  }
  parts.push(String(src).slice(last));
  return { parts, rels };
}

/**
 * A trial value, whether it arrived as a whole number or as an exact fraction.
 *
 * Every trial used to be an integer, and on a lean that was wrong. A cadet who
 * divides before subtracting hands in a boundary that is a FRACTION less than
 * one step from the true one — `t \le 8/3` against `t \le 2` — so no integer
 * anywhere separates the two sets, the probe found nothing to say, and the
 * echo fell through to reprinting the question. Eight forms did that.
 */
const asR = (t) => (isR(t) ? t : R(t));

/** Is this statement true when the unknown takes this value? `null` if unreadable. */
function holdsAt(src, v, t) {
  const { parts, rels } = relationsOf(src);
  if (!rels.length) return null;
  let vals;
  try { vals = parts.map((p) => evaluate(p, { [v]: asR(t) })); } catch { return null; }
  for (let i = 0; i < rels.length; i++) {
    const d = toNum(sub(vals[i], vals[i + 1]));
    const ok = rels[i] === '<' ? d < 0 : rels[i] === '>' ? d > 0 : rels[i] === '\\le' ? d <= 0 : d >= 0;
    if (!ok) return false;
  }
  return true;
}

/** The whole statement, evaluated part by part: "21 > 25". */
function relationAt(src, v, t) {
  const { parts, rels } = relationsOf(src);
  if (!rels.length) return null;
  let vals;
  try { vals = parts.map((p) => evaluate(p, { [v]: asR(t) })); } catch { return null; }
  let out = rstr(vals[0]);
  for (let i = 0; i < rels.length; i++) out += ` ${rels[i]} ${rstr(vals[i + 1])}`;
  return out;
}

/** Whole numbers worth trying: the ones the two statements are written around. */
function trialValues(...written) {
  const seen = new Set([0, 1, -1]);
  for (const src of written) {
    for (const n of String(src).match(/-?\d+/g) || []) {
      const k = Number(n);
      if (!Number.isFinite(k) || Math.abs(k) > 400) continue;
      for (const d of [-2, -1, 0, 1, 2]) seen.add(k + d);
    }
  }
  // …and a plain sweep, because a band can sit a long way from any number
  // printed on the page, and a probe that cannot find its own boundary is a
  // probe that hands the question back.
  for (let n = -48; n <= 48; n++) seen.add(n);
  return [...seen].sort((a, b) => Math.abs(a) - Math.abs(b));
}

/**
 * A lean, refuted by one number.
 *
 * Two shapes of entry arrive here. A *statement* is refuted by a value one of
 * them admits and the other does not. A *whole number*, handed to "what is the
 * first value that works?", is refuted either because it does not work at all,
 * or because the number one step further in also works — which is what makes
 * it not the first.
 */
function leanProbe(item, raw, v, T) {
  const math = String(item.check.math);
  const want = item.check.want;
  const val = fromString(raw);

  if (val && val.d === 1 && (want === 'least' || want === 'greatest')) {
    const n = val.n;
    if (holdsAt(math, v, n) === false) {
      const put = substituteVerified(relationsOf(math).parts[0], v, R(n));
      const read = relationAt(math, v, n);
      if (put && read) {
        return [
          { cls: 'rf-echo-probe', latex: `${substituteRelation(math, v, n)}`, why: T('echo.tryYourReading', { v, t: n }) },
          { cls: 'rf-echo-probe verdict', latex: read, why: T('echo.thatIsNotTrue') },
        ];
      }
    }
    const step = want === 'least' ? n - 1 : n + 1;
    if (holdsAt(math, v, n) === true && holdsAt(math, v, step) === true) {
      const read = relationAt(math, v, step);
      if (read) {
        return [
          { cls: 'rf-echo-probe', latex: `${substituteRelation(math, v, step)}`, why: T('echo.tryOneStepFurther', { v, t: step }) },
          { cls: 'rf-echo-probe verdict', latex: read, why: T(want === 'least' ? 'echo.oneLowerAlsoWorks' : 'echo.oneHigherAlsoWorks') },
        ];
      }
    }
    return [];
  }

  // A count. There is no value to argue with, but there is a lesson: the two
  // whole numbers either side of an end, one in and one out.
  if (val && want === 'count') {
    const ins = [];
    for (const t of trialValues(math)) {
      if (holdsAt(math, v, t) !== true) continue;
      ins.push(t);
    }
    if (!ins.length) return [];
    const lo = Math.min(...ins);
    const outside = lo - 1;
    const inside = substituteRelation(math, v, lo);
    const beyond = substituteRelation(math, v, outside);
    const readIn = relationAt(math, v, lo);
    const readOut = relationAt(math, v, outside);
    if (!inside || !beyond || !readIn || !readOut) return [];
    return [
      { cls: 'rf-echo-probe', latex: `${beyond} \\qquad ${readOut}`, why: T('echo.justOutsideTheBand', { v, t: outside }) },
      { cls: 'rf-echo-probe verdict', latex: `${inside} \\qquad ${readIn}`, why: T('echo.justInsideTheBand', { v, t: lo }) },
    ];
  }

  // A statement against a statement.
  if (!relationsOf(raw).rels.length) return [];
  // The cadet's OWN boundary goes in the hat first, exactly as written. It is
  // the value their statement argues about, so it is the value most likely to
  // separate their set from this one — and when their boundary is a fraction a
  // whole number never will.
  for (const t of [...ownBoundaries(raw, v), ...trialValues(math, raw)]) {
    const mine = holdsAt(raw, v, t);
    const theirs = holdsAt(math, v, t);
    if (mine == null || theirs == null || mine === theirs) continue;
    const read = relationAt(math, v, t);
    const shown = substituteRelation(math, v, t);
    if (!read || !shown) continue;
    return [
      {
        cls: 'rf-echo-probe',
        latex: shown,
        why: T(mine ? 'echo.yourSetLetsThrough' : 'echo.yourSetShutsOut', { v, t: rstr(asR(t)) }),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: read,
        why: T(mine ? 'echo.thatIsNotTrue' : 'echo.thatIsTrue'),
      },
    ];
  }
  return [];
}

/**
 * The ends of the set the cadet wrote down, as exact rationals — the boundary
 * itself, and one small step either side of it so a strict end and a closed
 * end can be told apart.
 */
function ownBoundaries(raw, v) {
  const { parts, rels } = relationsOf(raw);
  if (!rels.length) return [];
  const out = [];
  for (const part of parts) {
    const p = String(part).trim();
    if (!p || varsOf(p).includes(v)) continue;
    let val;
    try { val = evaluate(p, {}); } catch { continue; }
    if (!val || !Number.isFinite(toNum(val))) continue;
    const step = R(1, Math.max(1, val.d) * 4);
    out.push(val, sub(val, step), add(val, step));
  }
  return out;
}

/** The statement with a number written in for the unknown, verified part by part. */
function substituteRelation(src, v, t) {
  const { parts, rels } = relationsOf(src);
  const put = parts.map((p) => (varsOf(p).includes(v) ? substituteVerified(p, v, asR(t)) : p.trim()));
  if (put.some((p) => !p)) return null;
  let out = put[0];
  for (let i = 0; i < rels.length; i++) out += ` ${rels[i]} ${put[i + 1]}`;
  return out;
}

/** Two ratios agree exactly when their cross products do. */
function proportionProbe(item, raw, v, T) {
  const val = fromString(raw);
  if (!val) return [];
  let left, right;
  try { ({ left, right } = parseEquation(String(item.check.math))); } catch { return []; }
  if (left.k !== 'div' || right.k !== 'div') return [];
  let p, q;
  try {
    p = mulR(evalNode(left.a, v, val), evalNode(right.b, v, val));
    q = mulR(evalNode(left.b, v, val), evalNode(right.a, v, val));
  } catch { return []; }
  if (reqq(p, q)) return [];
  const src = String(item.check.math);
  const shown = substituteRelationLike(src, v, val);
  return [
    {
      cls: 'rf-echo-probe',
      latex: shown || src,
      why: T('echo.crossProductsMatch'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `${rstr(p)} \\ne ${rstr(q)}`,
      why: T('echo.yourNumberBreaksTheRatio'),
    },
  ];
}

/** An equation with a value written in for one letter, both sides verified. */
function substituteRelationLike(src, v, val) {
  const two = String(src).split('=').map((s) => s.trim());
  if (two.length !== 2) return null;
  const put = two.map((s) => (varsOf(s).includes(v) ? substituteVerified(s, v, val) : s));
  return put.every(Boolean) ? `${put[0]} = ${put[1]}` : null;
}

const mulR = (a, b) => R(a.n * b.n, a.d * b.d);
function evalNode(node, v, val) { return evaluate(texOfNode(node), { [v]: val }); }
/** Print back the part of a fraction the parser gave us, as notation. */
function texOfNode(node) {
  switch (node.k) {
    case 'num': return String(node.v);
    case 'var': return node.v;
    case 'neg': return `-\\left(${texOfNode(node.a)}\\right)`;
    case 'add': return `\\left(${texOfNode(node.a)} + ${texOfNode(node.b)}\\right)`;
    case 'sub': return `\\left(${texOfNode(node.a)} - ${texOfNode(node.b)}\\right)`;
    case 'mul': return `\\left(${texOfNode(node.a)}\\right)\\left(${texOfNode(node.b)}\\right)`;
    case 'div': return `\\frac{${texOfNode(node.a)}}{${texOfNode(node.b)}}`;
    default: throw new Error('cannot print this node');
  }
}

/**
 * A pair of statements: if one letter were what they said, the first statement
 * forces the other, and the second statement refuses the pair.
 */
function systemProbe(item, raw, T) {
  const [e1, e2] = item.check.eqs;
  const [vx, vy] = item.check.vars || ['x', 'y'];
  const want = item.check.want;
  let px = null, py = null;
  // EITHER SPELLING OF THE BRACKETS.
  //
  // The bank writes a reading `\left(4, 3\right)`; a hand on the keypad writes
  // `(4,3)`, because a backslash cannot be typed. Requiring the bank's spelling
  // meant every pair a cadet actually entered fell past this probe and out the
  // bottom of the echo. (see `padToTex`)
  const pair = /^\s*(?:\\left)?\(\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:\\right)?\)\s*$/.exec(raw);
  if (pair) { px = R(Number(pair[1])); py = R(Number(pair[2])); }
  else {
    const val = fromString(raw);
    if (!val) return [];
    const known = want === 'y' ? vy : vx;
    const other = known === vx ? vy : vx;
    // What the first statement forces the other letter to be.
    const f = (t) => {
      const env = { [known]: val, [other]: R(t) };
      const two = String(e1).split('=').map((s) => s.trim());
      return sub(evaluate(two[0], env), evaluate(two[1], env));
    };
    let f0, f1;
    try { f0 = f(0); f1 = f(1); } catch { return []; }
    const a = sub(f1, f0);
    if (isZero(a)) return [];
    const forced = R(-f0.n * a.d, f0.d * a.n);
    px = known === vx ? val : forced;
    py = known === vx ? forced : val;
  }
  if (!px || !py) return [];
  for (const eq of [e2, e1]) {
    const two = String(eq).split('=').map((s) => s.trim());
    if (two.length !== 2) continue;
    let l, r;
    try { l = evaluate(two[0], { [vx]: px, [vy]: py }); r = evaluate(two[1], { [vx]: px, [vy]: py }); } catch { continue; }
    if (reqq(l, r)) continue;
    const shown = two.map((s) => {
      let out = s;
      for (const [name, val] of [[vx, px], [vy, py]]) {
        if (!varsOf(out).includes(name)) continue;
        const next = substituteVerified(out, name, val, { [name === vx ? vy : vx]: name === vx ? py : px });
        if (!next) return null;
        out = next;
      }
      return out;
    });
    if (shown.some((s) => !s)) continue;
    return [
      {
        cls: 'rf-echo-probe',
        latex: `${shown[0]} = ${shown[1]}`,
        why: T('echo.putYourPairIn', { x: rstr(px), y: rstr(py) }),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${rstr(l)} \\ne ${rstr(r)}`,
        why: T('echo.oneStatementRefusesIt'),
      },
    ];
  }
  return [];
}

/**
 * A rearranged formula, checked the way a rearranged formula is checked: pin
 * every other letter to a number, and the two forms have to agree.
 */
function rearrangeProbe(item, raw, T) {
  const v = item.check.variable;
  const names = item.check.vars || [];
  if (!names.length) return [];
  for (const set of [[2, 3, 5, 7], [3, 5, 2, 11], [5, 2, 7, 3]]) {
    const env = {};
    names.forEach((name, i) => { env[name] = R(set[i % set.length]); });
    let truth, theirs;
    const two = String(item.check.math).split('=').map((s) => s.trim());
    if (two.length !== 2) return [];
    const f = (t) => sub(evaluate(two[0], { ...env, [v]: t }), evaluate(two[1], { ...env, [v]: t }));
    try {
      const f0 = f(R(0));
      const a = sub(f(R(1)), f0);
      if (isZero(a)) continue;
      truth = R(-f0.n * a.d, f0.d * a.n);
      theirs = evaluate(raw, env);
    } catch { continue; }
    if (reqq(truth, theirs)) continue;
    // The formula is an equation, so each side is pinned on its own: an equals
    // sign is not something `evaluate` can weigh. The letter being solved for
    // stays a letter — that is the whole point of the picture.
    const pinned = two.map((side) => pinKnown(side, env, v));
    const yours = substituteAll(raw, env);
    if (pinned.some((x) => !x) || !yours) continue;
    return [
      { cls: 'rf-echo-probe', latex: `${pinned[0]} = ${pinned[1]}`, why: T('echo.pinTheOtherLetters', { v }) },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${yours} = ${rstr(theirs)}`,
        why: T('echo.yourFormDisagrees', { v }),
      },
    ];
  }
  return [];
}

/**
 * Write the known letters in and leave one standing.
 *
 * `substituteAll` needs every letter bound, because it verifies each rewrite by
 * evaluating it — and a formula being solved still has one letter in it. So the
 * free letter is bound to two different probe values for the *check* only, and
 * a rewrite is accepted only if it carries the same value at both.
 */
function pinKnown(latex, env, free) {
  let out = latex;
  const rest = { ...env };
  for (const name of Object.keys(env)) {
    delete rest[name];
    let next = null;
    for (const probe of [R(2), R(5)]) {
      const candidate = substituteVerified(out, name, env[name], { ...rest, [free]: probe });
      if (!candidate) { next = null; break; }
      if (next && next !== candidate) { next = null; break; }
      next = candidate;
    }
    if (!next) return null;
    out = next;
  }
  return out;
}

/**
 * A statement in two unknowns, refused by the point their answer implies.
 *
 * Every answer this family asks for names a point on the line — an intercept
 * is a point, a rate is the step from one point to the next, a rule is all of
 * them. So the probe is always the same: build the point, write it into the
 * statement on screen, and let the two sides disagree.
 */
function statementProbe(item, raw, T) {
  const c = item.check;
  const two = String(c.math).split('=').map((x) => x.trim());
  if (two.length !== 2) return [];
  const at = (x, y) => {
    const env = { x, y };
    return [evaluate(two[0], env), evaluate(two[1], env)];
  };
  const point = (() => {
    const side = String(raw).split('=').slice(1).join('=').trim();
    if (c.want === 'equation' && side) {
      // The first reading their rule gives that the statement refuses. A wrong
      // rule can still be right at one point, and that point proves nothing.
      for (const px of [1, 2, 0, -1, 3, -2, 4]) {
        try {
          const py = evaluate(side, { x: R(px) });
          const [l, r] = at(R(px), py);
          if (!reqq(l, r)) return [R(px), py];
        } catch { /* next */ }
      }
      return null;
    }
    const val = fromString(raw);
    if (!val) return null;
    if (c.want === 'xintercept') return [val, R(0)];
    if (c.want === 'intercept') return [R(0), val];
    if (c.want === 'slope') {
      // Their rate, stepped one across from a point the statement really holds.
      try {
        const f = (t) => sub(...at(R(0), R(t)));
        const f0 = f(0);
        const a = sub(f(1), f0);
        if (isZero(a)) return null;
        const y0 = R(-f0.n * a.d, f0.d * a.n);
        return [R(1), R(y0.n * val.d + val.n * y0.d, y0.d * val.d)];
      } catch { return null; }
    }
    return null;
  })();
  if (!point) return [];
  let l, r;
  try { [l, r] = at(point[0], point[1]); } catch { return []; }
  if (reqq(l, r)) return [];
  const shown = two.map((side) => {
    let out = side;
    for (const [name, val] of [['x', point[0]], ['y', point[1]]]) {
      if (!varsOf(out).includes(name)) continue;
      const next = substituteVerified(out, name, val, { [name === 'x' ? 'y' : 'x']: name === 'x' ? point[1] : point[0] });
      if (!next) return null;
      out = next;
    }
    return out;
  });
  if (shown.some((x) => !x)) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: `${shown[0]} = ${shown[1]}`,
      why: T('echo.putYourPairIn', { x: rstr(point[0]), y: rstr(point[1]) }),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `${rstr(l)} \\ne ${rstr(r)}`,
      why: T('echo.thePointIsNotOnIt'),
    },
  ];
}

/** A rule that has to pass through the readings it was written from. */
function ruleProbe(item, raw, T) {
  const c = item.check;
  if (c.kind === 'lineEquation') return statementProbe(item, raw, T);
  const side = String(raw).split('=').slice(1).join('=').trim();
  if (side && Array.isArray(c.points) && c.points.length >= 2) {
    // Every reading the item shows, not only the two the checker used: a wrong
    // rule that happens to pass through the first one is still a wrong rule.
    const shownPts = [...c.points, ...(item.figure?.points || [])];
    for (const [px, py] of shownPts) {
      let got;
      try { got = evaluate(side, { x: R(px) }); } catch { return []; }
      if (reqq(got, R(py))) continue;
      const put = substituteVerified(side, 'x', R(px));
      if (!put) continue;
      return [
        { cls: 'rf-echo-probe', latex: `${put} = ${rstr(got)}`, why: T('echo.yourRuleAt', { t: px }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(got)} \\ne ${py}`,
          why: T('echo.yourRuleMissesReading', { t: px }),
        },
      ];
    }
    return [];
  }
  // A rate handed in as a value: the two fractions, side by side, unworked.
  const val = fromString(raw);
  if (val && c.want === 'slope' && Array.isArray(c.points) && c.points.length >= 2) {
    const [p, q] = c.points;
    if (p[0] === q[0]) return [];
    return [
      {
        cls: 'rf-echo-probe',
        latex: `\\frac{${q[1]} - ${par(p[1])}}{${q[0]} - ${par(p[0])}}`,
        why: T('echo.rateBetweenTheReadings'),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${q[1]} - ${par(p[1])} \\ne ${texOf(val)} \\cdot \\left(${q[0]} - ${par(p[0])}\\right)`,
        why: T('echo.yourRateWouldNeed'),
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// LEVEL 4 AND LEVEL 5 INSTRUMENTS.
//
// Everything above this line was written for a line: a beam that stays level,
// a lean, a rule that climbs at one rate. Levels 4 and 5 introduced eight check
// kinds that none of it reads — a root, a product of brackets, a squared
// statement, a division, a fitted line, a frequency table, a list with a step,
// a fractional count above a number — and for a year a cadet who missed one of
// those was handed their own question back with the sentence "this is what the
// rift is asking". Sixteen skills answered every tagged slip that way.
//
// The contract is unchanged and is the only thing that matters here: each probe
// either COMPUTES the contradiction and returns it, or returns nothing. Nothing
// is asserted. Nothing prints the value the live rift wants. And each probe is
// aimed: the tag the learner's entry carries (`./diagnose.js`, which answers
// only on evidence) selects the sentence, so a cadet who split a root over a
// sum is not answered the way a cadet who left a square under the bar is.
// ---------------------------------------------------------------------------

/** Whitespace, and the brackets that are only ever typography, taken out. */
const norm = (t) => String(t).replace(/\s+/g, '').replace(/\\left|\\right/g, '');

/** Every exact value a written entry stands for. `[]` when it is not a value. */
function entryValues(raw) {
  try {
    const out = answerValues(String(raw), null);
    return out.length ? out : [];
  } catch { return []; }
}

/** One exact value, or null. `\pm` and a list of roots both give up here. */
function oneValue(raw) {
  const vals = entryValues(raw);
  return vals.length === 1 ? vals[0] : null;
}

/**
 * Write an exact value in for a letter, in surd arithmetic, and check by
 * evaluation that the notation still carries what it carried.
 *
 * `substituteVerified` is the same idea one field down: it evaluates in Q, so
 * it cannot write `2\sqrt{2}` into anything. Level 4 hands roots to statements
 * routinely, so the same guard is repeated here over Q(sqrt k).
 */
function putSurd(latex, v, val) {
  let want;
  try { want = evalSurd(parse(latex), { [v]: val }); } catch { return null; }
  const bare = sTex(val);
  const wrapped = `\\left(${bare}\\right)`;
  const order = (sIsRational(val) && toNum(val.p) >= 0) ? [bare, wrapped] : [wrapped, bare];
  for (const written of order) {
    const out = substitute(latex, v, written);
    try { if (sEq(evalSurd(parse(out), {}), want)) return out; } catch { /* try the next */ }
  }
  return null;
}

/** The two sides of a printed statement, or null. */
function twoSides(src) {
  const parts = String(src).split('=').map((p) => p.trim());
  return parts.length === 2 && parts[0] && parts[1] ? parts : null;
}

/** A short decimal reading of an exact value, for the one place it helps. */
function about(x, places = 1) {
  const n = sToNum(x);
  if (!Number.isFinite(n)) return null;
  const s = n.toFixed(places);
  return /^-?\d+(\.\d+)?$/.test(s) ? s : null;
}

/** Rows of a printed table, read off the notation the cadet is looking at. */
function tableRows(item) {
  const c = item.check || {};
  if (Array.isArray(c.rows) && c.rows.length) {
    return c.rows.map((row) => row.map((cell) => (String(cell).trim() === '?' ? null : Number(cell))));
  }
  let cells;
  try { cells = parseArrayCells(String(item.latex)); } catch { return []; }
  const out = [];
  for (const row of cells) {
    if (row.length !== 2) continue;
    const pair = row.map((cell) => {
      const t = String(cell).trim();
      if (t === '?' || t === '\\square') return null;
      try { const r = evaluate(t); return r.d === 1 ? r.n : toNum(r); } catch { return undefined; }
    });
    if (pair.some((x) => x === undefined)) continue;
    out.push(pair);
  }
  return out;
}

/**
 * A burned log, in the shape the probes below expect: rows of two, the burned
 * cell written `?`, and the index of the row it sits in.
 *
 * The item's own descriptor wins when it has one. Otherwise the rows are read
 * off the notation on screen, which is where a learner reads them.
 */
function tableSource(item) {
  const c = item.check || {};
  if (Array.isArray(c.rows) && c.rows.length) {
    return { rows: c.rows, miss: c.missing, solveFor: c.solveFor };
  }
  let cells;
  try { cells = parseArrayCells(String(item.latex)); } catch { return { rows: [], miss: -1 }; }
  const rows = [];
  for (const row of cells) {
    if (row.length !== 2) continue;
    const pair = row.map((cell) => {
      const t = String(cell).trim();
      if (t === '?' || t === '\\square') return '?';
      try { const r = evaluate(t); return r.d === 1 ? r.n : null; } catch { return null; }
    });
    if (pair.some((x) => x === null)) continue;          // a column heading
    rows.push(pair);
  }
  return { rows, miss: rows.findIndex((r) => r.includes('?')) };
}

/** Readings printed as exact pairs: a plot, a wide table, or a tall one. */
function readingsShown(item) {
  const c = item.check || {};
  if (Array.isArray(item.figure?.points) && item.figure.points.length) {
    return item.figure.points.map((p) => [R(p[0]), R(p[1])]);
  }
  let cells;
  try { cells = parseArrayCells(String(item.latex)); } catch { return []; }
  const num = (row) => {
    const got = [];
    for (const cell of row) { try { got.push(evaluate(cell)); } catch { /* a label */ } }
    return got;
  };
  if (c.layout === 'rows') {
    const rows = cells.map(num).filter((r) => r.length);
    if (rows.length !== 2 || rows[0].length !== rows[1].length) return [];
    return rows[0].map((x, i) => [x, rows[1][i]]);
  }
  const out = [];
  for (const row of cells) {
    const nums = num(row);
    if (nums.length === 2) out.push(nums);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Roots.
// ---------------------------------------------------------------------------
/**
 * A root, refused by the one test that defines it: square it back.
 *
 * Every slip this skill carries — a square left under the bar, half the
 * radicand, a coefficient pulled under without being squared, a root split over
 * a sum — is a claim that two different numbers are the same root, and squaring
 * both settles it exactly, in whole numbers, with no decimal anywhere.
 *
 * The one place a decimal earns its keep is the split over a sum, because the
 * whole misconception is that the two are "about the same size". They are not:
 * the rig prints both, and the gap is the lesson.
 */
function radicalProbe(item, raw, tag, T) {
  const src = String(item.check?.math || item.latex || '');
  let theirs;
  try { theirs = evalSurd(parse(src), {}); } catch { return []; }
  let mine;
  try { mine = evalSurd(parse(String(raw)), {}); } catch { mine = null; }
  const rows = [];

  // A root taken part by part over a sum. Only shown when the split really is
  // what produced their number.
  const node = (() => { try { return parse(src); } catch { return null; } })();
  if (node && node.k === 'sqrt' && node.a && node.a.k === 'add') {
    let a; let b;
    try { a = evalAst(node.a.a, {}); b = evalAst(node.a.b, {}); } catch { a = null; }
    if (a && b && a.d === 1 && b.d === 1 && a.n > 0 && b.n > 0) {
      let split;
      try { split = sAdd(evalSurd(parse(`\\sqrt{${a.n}}`), {}), evalSurd(parse(`\\sqrt{${b.n}}`), {})); } catch { split = null; }
      if (split && mine && sEq(split, mine) && sIsRational(split)) {
        const whole = add(a, b);
        const dec = about(theirs);
        if (dec) {
          rows.push({
            cls: 'rf-echo-probe',
            latex: `\\sqrt{${a.n}} + \\sqrt{${b.n}} = ${sTex(split)}`,
            why: T('echo.youSplitTheRoot'),
          });
          rows.push({
            cls: 'rf-echo-probe verdict',
            latex: `\\sqrt{${a.n} + ${b.n}} = \\sqrt{${rstr(whole)}} \\approx ${dec}`,
            why: T('echo.addFirstThenRoot'),
          });
          return rows;
        }
      }
    }
  }

  if (!mine) return [];
  const mineSq = sPow(mine, 2);
  const theirsSq = sPow(theirs, 2);

  // The same square, the other sign. The bar names one value and it is the one
  // that is not below zero, so the refusal is a comparison with zero.
  if (sEq(mineSq, theirsSq) && sCmp(mine, SR(R(0))) < 0 && sCmp(theirs, SR(R(0))) >= 0) {
    return [
      {
        cls: 'rf-echo-probe',
        latex: `\\left(${String(raw).trim()}\\right)^{2} = ${sTex(mineSq)} = \\left(${src}\\right)^{2}`,
        why: T('echo.bothSquareToTheSame'),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${String(raw).trim()} < 0`,
        why: T('echo.aRootIsNeverBelowZero'),
      },
    ];
  }

  // Worth the same, and not finished: a square is still sitting under the bar.
  if (sEq(mine, theirs)) return unsimplifiedRows(raw, T);

  if (sEq(mineSq, theirsSq)) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: `\\left(${String(raw).trim()}\\right)^{2} = ${sTex(mineSq)}`,
      why: T('echo.squareYoursBack'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `\\left(${src}\\right)^{2} = ${sTex(theirsSq)}`,
      why: T('echo.squaresDisagree', { got: sTex(mineSq), want: sTex(theirsSq) }),
    },
  ];
}

/**
 * A value that is RIGHT and not finished, because a square is still under the
 * bar.
 *
 * `\sqrt{8}` and `2\sqrt{2}` are the same number, so no substitution and no
 * squaring can tell them apart — and a cadet who writes the first has made a
 * real, named error all the same. The refusal is the factorisation, printed
 * and left unworked: the largest square that divides the radicand, and the two
 * roots it splits into. The last step stays the cadet's.
 */
function unsimplifiedRows(raw, T) {
  // The radicands are read off the NOTATION rather than off a syntax tree: an
  // answer to a squared statement arrives as "n = \pm \sqrt{8}", which names
  // the unknown, holds a plus-or-minus and is not an expression at all.
  const rads = (String(raw).match(/\\sqrt\{\s*(\d+)\s*\}/g) || [])
    .map((t) => Number(/\d+/.exec(t)[0]));
  for (const n of rads) {
    if (!n || n < 4) continue;
    let m; let k;
    try { ({ m, k } = simplifySqrt(n)); } catch { continue; }
    if (m <= 1) continue;
    return [
      {
        cls: 'rf-echo-probe',
        latex: `${n} = ${m * m} \\cdot ${k}`,
        why: T('echo.squareFactorInside', { n }),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `\\sqrt{${n}} = \\sqrt{${m * m}} \\cdot \\sqrt{${k}}`,
        why: T('echo.squareComesOutOfTheBar'),
      },
    ];
  }
  return [];
}

/**
 * A fractional count above a number, refused WITHOUT TAKING A ROOT.
 *
 * The checker's own proof is used, because it is the honest one: raise the
 * cadet's value to the count on the bottom and it has to come back to the base
 * raised to the count on the top. Nothing here approximates and nothing here
 * needs to know what the root is.
 */
function rationalExponentProbe(item, raw, tag, T) {
  const src = String(item.check?.math || item.latex || '');
  let node;
  try { node = parse(src); } catch { return []; }
  if (node.k !== 'pow') return [];
  let base; let ex;
  try { base = evalAst(node.a, {}); ex = evalAst(node.b, {}); } catch { return []; }
  const q = ex.d; const p = ex.n;
  if (!q) return [];
  let target;
  try { target = rpow(base, p); } catch { return []; }
  const mine = oneValue(raw);
  if (!mine) return [];
  let back;
  try { back = sPow(mine, q); } catch { return []; }
  if (sEq(back, SR(target))) {
    // It does come back, and it is still not the value the notation names: an
    // even root is the reading that is not below zero, and there are two
    // numbers that come back.
    if (q % 2 === 0 && sCmp(mine, SR(R(0))) < 0) {
      return [
        {
          cls: 'rf-echo-probe',
          latex: `\\left(${String(raw).trim()}\\right)^{${q}} = ${sTex(back)}`,
          why: T('echo.yoursDoesComeBack', { q }),
        },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${String(raw).trim()} < 0`,
          why: T('echo.anEvenRootIsNotBelowZero'),
        },
      ];
    }
    return unsimplifiedRows(raw, T);
  }
  return [
    {
      cls: 'rf-echo-probe',
      latex: `\\left(${String(raw).trim()}\\right)^{${q}} = ${sTex(back)}`,
      why: T('echo.raiseYoursBack', { q }),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `${rstr(base)}^{${p}} = ${rstr(target)}`,
      why: T('echo.powersDisagree', { got: sTex(back), want: rstr(target) }),
    },
  ];
}

// ---------------------------------------------------------------------------
// Squared statements.
// ---------------------------------------------------------------------------
/**
 * A squared statement, and a value handed to it.
 *
 * Three refusals, tried in order, and no fourth:
 *
 *   · a value the statement rejects  ->  both sides reweighed at that value;
 *   · every named value holds, but too few were named  ->  the part under the
 *     root, worked out from the printed coefficients, and its sign;
 *   · no value at all could be read (a root of a negative number, handed in on
 *     a statement that has no solution)  ->  the statement rewritten as a
 *     square plus a number, which never reaches zero.
 */
function quadraticProbe(item, raw, tag, T) {
  const c = item.check || {};
  const v = c.variable;
  const src = String(c.math || item.latex || '');
  if (!v) return [];
  const two = twoSides(src);
  if (!two) return [];
  let sol;
  try { sol = solveQuadratic(src, v); } catch { return []; }
  // The SAME value named twice is one value, not two. A cadet who writes
  // "x = 3, x = 3" has named one root and believes it is the whole set, which
  // is the count error below and not two correct values.
  const vals = [];
  for (const t of entryValues(raw)) if (!vals.some((u) => sEq(u, t))) vals.push(t);

  // 1. Any value they named that the statement refuses.
  for (const t of vals) {
    let l; let r;
    try { l = evalSurd(parse(two[0]), { [v]: t }); r = evalSurd(parse(two[1]), { [v]: t }); } catch { continue; }
    if (sEq(l, r)) continue;
    const shown = two.map((s) => (varsOf(s).includes(v) ? putSurd(s, v, t) : s));
    if (shown.some((s) => !s)) continue;
    return [
      {
        cls: 'rf-echo-probe',
        latex: `${shown[0]} = ${shown[1]}`,
        why: T('echo.substituteYours', { v, val: sTex(t) }),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${sTex(l)} \\ne ${sTex(r)}`,
        why: T('echo.sidesDisagree'),
      },
    ];
  }

  // 2. Every value they named holds, and the SET is still wrong: too few
  //    different values, or the same value written down twice.
  const roots = Array.isArray(sol.roots) ? sol.roots.length : 0;
  const written = entryValues(raw).length;
  const tooFew = roots > vals.length;
  const repeated = written > vals.length;
  if (vals.length && (tooFew || repeated) && sol.disc && !isZero(sol.disc)) {
    return [
      {
        cls: 'rf-echo-probe',
        latex: `\\left(${rstr(sol.b)}\\right)^{2} - 4\\left(${rstr(sol.a)}\\right)\\left(${rstr(sol.c)}\\right) = ${rstr(sol.disc)}`,
        why: T('echo.underTheRootIs'),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${rstr(sol.disc)} > 0`,
        why: tooFew
          ? T('echo.aboveZeroMeansTwo', { k: vals.length })
          : T('echo.youWroteOneTwice', { k: written }),
      },
    ];
  }

  // 3. Nothing readable came in, and the statement has no real value at all.
  if (sol.kind === 'noReal') {
    const h = div(neg(sol.b), mul(R(2), sol.a));
    const k = sub(sol.c, div(mul(sol.b, sol.b), mul(R(4), sol.a)));
    if (isSafe(h) && isSafe(k)) {
      const bracket = isZero(h) ? v : `\\left(${v} ${rsign(h) < 0 ? '+' : '-'} ${rstr(rsign(h) < 0 ? neg(h) : h)}\\right)`;
      const lead = reqq(sol.a, R(1)) ? '' : `${rstr(sol.a)}`;
      return [
        {
          cls: 'rf-echo-probe',
          latex: `${two[0]} = ${lead}${bracket}^{2} ${rsign(k) < 0 ? '-' : '+'} ${rstr(rsign(k) < 0 ? neg(k) : k)}`,
          why: T('echo.rewriteAsASquare'),
        },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${bracket}^{2} \\ge 0`,
          why: T('echo.aSquareIsNeverBelowZero'),
        },
      ];
    }
  }
  // Every value they named holds, and the count is right. What is left is a
  // spelling: a square still sitting under the bar, or a formula stopped one
  // move early with the plus-or-minus still standing in it.
  const rows = unsimplifiedRows(raw, T);
  if (rows.length) return rows;
  return plusOrMinusRows(raw, T);
}

/**
 * A quadratic formula stopped one move early: `\frac{7 \pm 1}{2}`.
 *
 * The value is right and the notation is not an answer — a plus-or-minus
 * standing in one fraction is two numbers written once. Both readings are
 * printed and DELIBERATELY LEFT UNWORKED, because working them out is the move
 * that was skipped and is the whole of what is left to learn here.
 */
function plusOrMinusRows(raw, T) {
  const body = String(raw).split('=').slice(-1)[0].trim();
  if (!/\\pm/.test(body)) return [];
  const plus = body.replace(/\\pm/, '+');
  const minus = body.replace(/\\pm/, '-');
  for (const side of [plus, minus]) {
    try { evaluate(side, {}); } catch { return []; }
  }
  return [{
    cls: 'rf-echo-probe verdict',
    latex: `${plus} \\qquad ${minus}`,
    why: T('echo.plusOrMinusIsTwoValues'),
  }];
}

// ---------------------------------------------------------------------------
// Products, quotients and completed squares — all one move: multiply back.
// ---------------------------------------------------------------------------
/** Coefficients, or null. Never throws at a caller. */
function coeffsOf(src, v, maxDeg = 4) {
  try { return polyCoeffs(String(src), v, maxDeg); } catch { return null; }
}

/** a - b, coefficient by coefficient. */
function coeffDiff(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(sub(a[i] || R(0), b[i] || R(0)));
  return out;
}

/**
 * A rewrite of a polynomial — a factorisation, a completed square — refused by
 * multiplying it back out and printing what is left over.
 *
 * This is the answer to `sum-of-squares-factored` and to every one of its
 * relatives. A cadet who writes `\left(x + 3\right)\left(x + 3\right)` for
 * `x^{2} + 9` is not told they are wrong: they are shown their own brackets
 * multiplied out, `x^{2} + 6x + 9`, and then the `6x` that is left over when
 * the rift is taken away from it. The leftover IS the misconception, printed.
 */
function expandProbe(item, raw, tag, T) {
  const c = item.check || {};
  const v = c.variable;
  const src = String(c.math || '');
  if (!v || !src) return [];
  const mine = coeffsOf(raw, v);
  const theirs = coeffsOf(src, v);
  if (!mine) return zerosNotFactorsRows(item, raw, src, v, T);
  if (!theirs) return [];
  const gap = coeffDiff(mine, theirs);
  if (gap.every(isZero)) return [];
  const opened = polyTex(mine, v);
  // NOTHING TO MULTIPLY OUT IS A FACT ABOUT THE ENTRY, NOT ABOUT ITS SPELLING.
  //
  // This used to compare the multiplied-out line with the entry as a string,
  // so `z^{2} + 9` was correctly left alone and the same value typed on the
  // keypad as `z^2+9` was not: the cadet was told to "multiply your brackets
  // out" over an entry that has no brackets in it. What decides it is whether
  // there is a bracket to open at all.
  if (!String(raw).includes('(')) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: `${String(raw).trim()} = ${opened}`,
      why: T('echo.multiplyYoursOut'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `\\left(${opened}\\right) - \\left(${src}\\right) = ${polyTex(gap, v)}`,
      why: T('echo.theyDifferBy'),
    },
  ];
}

/**
 * "-2, -3" handed to "write this as a product".
 *
 * The numbers are not nonsense: they are exactly the inputs where the rule
 * reads zero, which is a real and well-attested confusion between a
 * factorisation and the solutions it leads to. So they are taken seriously —
 * both are put back into the printed rule and both come out zero — and the
 * distinction is drawn where it actually sits: a product still holds the
 * letter, and a pair of numbers does not.
 */
function zerosNotFactorsRows(item, raw, src, v, T) {
  const vals = [];
  for (const part of splitTop(String(raw), ',')) {
    const t = fromString(String(part).trim());
    if (t && !vals.some((u) => reqq(u, t))) vals.push(t);
  }
  if (!vals.length) return [];
  const shown = [];
  for (const t of vals) {
    let got;
    try { got = evaluate(src, { [v]: t }); } catch { return []; }
    const put = substituteVerified(src, v, t);
    if (!put) return [];
    // NOT EVEN A ZERO. The bracket constants copied out with their signs left
    // as they were printed — `(z + 2)(z + 3)` handed in as "2, 3" — are not the
    // inputs where the rule reads zero either, and the rule says so at once.
    if (!isZero(got)) {
      return [
        { cls: 'rf-echo-probe', latex: `${put} = ${rstr(got)}`, why: T('echo.readTheRuleAt', { v, t: rstr(t) }) },
        { cls: 'rf-echo-probe verdict', latex: `${rstr(got)} \\ne 0`, why: T('echo.aListIsNotAProduct') },
      ];
    }
    shown.push(`${put} = 0`);
  }
  if (shown.length < 2) {
    return [{ cls: 'rf-echo-probe verdict', latex: shown[0], why: T('echo.aProductStillHasTheLetter') }];
  }
  return [
    { cls: 'rf-echo-probe', latex: shown[0], why: T('echo.thoseAreTheZeros') },
    { cls: 'rf-echo-probe verdict', latex: shown[1], why: T('echo.aProductStillHasTheLetter') },
  ];
}

/**
 * A division, refused the way a division is always refused: multiply back.
 *
 * The checker for this kind never divides either, for the same reason — no
 * excluded value is ever needed — so the echo shows the cadet exactly the test
 * the rig itself uses.
 */
function polyQuotientProbe(item, raw, tag, T) {
  const c = item.check || {};
  const v = c.variable;
  if (!v || !c.dividend || !c.divisor) return [];
  const wantRem = c.want === 'remainder';
  const qSrc = wantRem ? String(c.quotient || '') : String(raw).trim();
  const rSrc = wantRem ? String(raw).trim() : (c.remainder ? String(c.remainder) : null);
  if (wantRem && !qSrc) return [];
  const B = coeffsOf(c.divisor, v, 6);
  const Q = coeffsOf(qSrc, v, 6);
  const D = coeffsOf(c.dividend, v, 6);
  const Rem = rSrc ? coeffsOf(rSrc, v, 6) : [R(0)];
  if (!B || !Q || !D || !Rem) return [];
  const product = [];
  for (let i = 0; i < B.length; i++) {
    for (let j = 0; j < Q.length; j++) product[i + j] = add(product[i + j] || R(0), mul(B[i], Q[j]));
  }
  for (let i = 0; i < Rem.length; i++) product[i] = add(product[i] || R(0), Rem[i]);
  for (let i = 0; i < product.length; i++) product[i] = product[i] || R(0);
  const gap = coeffDiff(product, D);
  if (gap.every(isZero)) return [];
  const back = `\\left(${c.divisor}\\right)\\left(${qSrc}\\right)${rSrc ? ` + \\left(${rSrc}\\right)` : ''}`;
  return [
    {
      cls: 'rf-echo-probe',
      latex: `${back} = ${polyTex(product, v)}`,
      why: T('echo.multiplyBack'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `\\left(${polyTex(product, v)}\\right) - \\left(${c.dividend}\\right) = ${polyTex(gap, v)}`,
      why: T('echo.theyDifferBy'),
    },
  ];
}

// ---------------------------------------------------------------------------
// The curve, read.
// ---------------------------------------------------------------------------
/** a, b, c of a printed rule of degree one or two, or null. */
function ruleABC(src, v) {
  const cs = coeffsOf(src, v, 2);
  if (!cs) return null;
  const deg = polyDegree(cs);
  if (deg < 1 || deg > 2) return null;
  return { a: cs[2] || R(0), b: cs[1] || R(0), c: cs[0] || R(0), quadratic: deg === 2 };
}

/** A printed rule, worked out at a whole input. */
function ruleAt(src, v, t) {
  try { return evaluate(src, { [v]: R(t) }); } catch { return null; }
}

/** An exact value, bracketed only where a bare minus would run into a sign. */
const parR = (r) => (rsign(r) < 0 ? `\\left(${rstr(r)}\\right)` : rstr(r));

/** The part under the root of `a v^{2} + b v + c = target`, printed and worked. */
function underTheRoot(abc, target, T) {
  const disc = sub(mul(abc.b, abc.b), mul(R(4), mul(abc.a, sub(abc.c, target))));
  if (!isSafe(disc)) return null;
  const tail = isZero(target) ? `\\left(${rstr(abc.c)}\\right)`
    : `\\left(${rstr(abc.c)} - ${par(toNum(target))}\\right)`;
  return {
    disc,
    row: {
      cls: 'rf-echo-probe',
      latex: `\\left(${rstr(abc.b)}\\right)^{2} - 4\\left(${rstr(abc.a)}\\right)${tail} = ${rstr(disc)}`,
      why: T('echo.underTheRootIs'),
    },
  };
}

/**
 * A named feature of a curve, refused by reading the rule itself.
 *
 * Each ask has one honest refusal, and every one of them is a READING rather
 * than a rule about turning points:
 *
 *   · the reading at zero, against a claimed crossing;
 *   · the readings one step each side of a claimed turn, which a real turn
 *     makes equal and a wrong one does not;
 *   · a reading that beats a claimed greatest or least value outright;
 *   · a claimed zero, put back into the rule;
 *   · and, where nothing else is available, the part under the root of
 *     "the rule reads your value", which settles whether it ever does.
 */
function featuresProbe(item, raw, tag, T) {
  const c = item.check || {};
  const v = c.variable;
  const src = String(c.math || '');
  if (!v || !src) return [];
  const abc = ruleABC(src, v);
  if (!abc) return [];
  const readingAt = (t) => {
    const got = ruleAt(src, v, t);
    if (!got) return null;
    const put = substituteVerified(src, v, R(t));
    return put ? { got, put } : null;
  };
  const say = (t, r) => ({
    cls: 'rf-echo-probe',
    latex: `${r.put} = ${rstr(r.got)}`,
    why: T('echo.readTheRuleAt', { v, t }),
  });

  // The reading at zero. One substitution, and it is the whole question.
  if (c.want === 'yIntercept') {
    const val = fromString(String(raw).trim());
    const r = readingAt(0);
    if (val && r && !reqq(r.got, val)) {
      return [say(0, r), {
        cls: 'rf-echo-probe verdict',
        latex: `${rstr(r.got)} \\ne ${rstr(val)}`,
        why: T('echo.ruleReadsDifferently', { v, t: 0 }),
      }];
    }
    return [];
  }

  // A claimed turn — as a pair, or as the line through it. Two tests, and the
  // second is the definition of a turn: the rule reads the same one step
  // either side of it.
  if (c.want === 'vertex' || c.want === 'axis') {
    let px = null; let py = null;
    if (c.want === 'vertex') {
      // Either spelling of the brackets — see the note on `pair` above.
      const m = /^\s*(?:\\left)?\(\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:\\right)?\)\s*$/.exec(String(raw));
      if (m) { px = Number(m[1]); py = Number(m[2]); }
    } else {
      const at = String(raw).indexOf('=');
      const rhs = at >= 0 ? String(raw).slice(at + 1).trim() : String(raw).trim();
      const val = fromString(rhs);
      if (val && val.d === 1) px = val.n;
    }
    // A line through the turn is a statement about the INPUT. Written about the
    // output it names a level line, and the rule reads other values.
    if (c.want === 'axis') {
      const at = String(raw).indexOf('=');
      const lhs = at >= 0 ? String(raw).slice(0, at).trim() : '';
      const claimed = fromString(at >= 0 ? String(raw).slice(at + 1).trim() : '');
      if (lhs && lhs !== v && /^[a-zA-Z]$/.test(lhs) && claimed) {
        for (let t = -12; t <= 12; t++) {
          const r = readingAt(t);
          if (!r || reqq(r.got, claimed)) continue;
          return [say(t, r), {
            cls: 'rf-echo-probe verdict',
            latex: `${rstr(r.got)} \\ne ${rstr(claimed)}`,
            why: T('echo.thatIsAboutTheOutput'),
          }];
        }
      }
    }
    if (px === null || !Number.isInteger(px)) return [];
    const here = readingAt(px);
    if (py !== null && here && !reqq(here.got, R(py))) {
      return [say(px, here), {
        cls: 'rf-echo-probe verdict',
        latex: `${rstr(here.got)} \\ne ${py}`,
        why: T('echo.ruleReadsDifferently', { v, t: px }),
      }];
    }
    const lo = readingAt(px - 1);
    const hi = readingAt(px + 1);
    if (lo && hi && !reqq(lo.got, hi.got)) {
      return [
        {
          cls: 'rf-echo-probe',
          latex: `${lo.put} = ${rstr(lo.got)} \\qquad ${hi.put} = ${rstr(hi.got)}`,
          why: T('echo.turnIsSymmetric'),
        },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(lo.got)} \\ne ${rstr(hi.got)}`,
          why: T('echo.notSymmetricHere', { v, t: px }),
        },
      ];
    }
    return [];
  }

  // A claimed greatest or least value, and a claimed band, are one question:
  // does the rule ever read outside it?
  if (c.want === 'extremeValue' || c.want === 'range') {
    let bound = null; let above = null;
    if (c.want === 'extremeValue') {
      bound = fromString(String(raw).trim());
      if (!bound) return [];
      above = abc.a.n > 0;                 // a least value: readings sit above it
    } else {
      const { parts, rels } = relationsOf(String(raw));
      if (rels.length !== 1) return [];
      const side = parts[1] == null ? null : String(parts[1]).trim();
      bound = side ? fromString(side) : null;
      if (!bound) return [];
      above = rels[0] === '\\ge' || rels[0] === '>';
      // A band is a claim about the READINGS. Written about the input it shuts
      // out inputs the rule reads perfectly well, and one of them says so.
      const named = String(parts[0] || '').trim();
      if (named === v && c.outputVariable && c.outputVariable !== v) {
        // One step outside the band the cadet wrote, whatever it says. A sweep
        // of small inputs can sit entirely inside a band, and then the probe
        // finds nothing to say about a band that is plainly about the wrong
        // letter.
        const t = above ? Math.floor(toNum(bound)) - 1 : Math.ceil(toNum(bound)) + 1;
        const r = Number.isFinite(t) ? readingAt(t) : null;
        if (r) {
          return [say(t, r), {
            cls: 'rf-echo-probe verdict',
            latex: `${t} ${above ? '<' : '>'} ${rstr(bound)}`,
            why: T('echo.thatIsAboutTheInput'),
          }];
        }
      }
    }
    // A GREATEST OR LEAST VALUE IS SETTLED BY THE PART UNDER THE ROOT.
    //
    // A sweep of inputs can miss: a rule that turns at twenty is beaten by no
    // reading between minus fourteen and fourteen, and the one input that
    // would settle it is the one whose reading IS the answer. So the claim is
    // asked the other way round — how many inputs read the cadet's value —
    // and the answer to that never names an input at all. Two means the rule
    // passes straight through it, so it is neither the greatest nor the least.
    if (c.want === 'extremeValue' && abc.quadratic) {
      const u = underTheRoot(abc, bound, T);
      if (u && !isZero(u.disc)) {
        const over = rsign(u.disc) > 0;
        return [u.row, {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(u.disc)} ${over ? '>' : '<'} 0`,
          why: T(over ? 'echo.reachedTwiceNotExtreme' : 'echo.neverReachesIt', { val: rstr(bound) }),
        }];
      }
    }
    // A straight rule has a band only on a stated closed interval, so the
    // sweep must not step outside the interval the item printed.
    const span = Array.isArray(c.interval) && c.interval.length === 2
      ? [Math.ceil(Number(c.interval[0])), Math.floor(Number(c.interval[1]))]
      : [-14, 14];
    for (let t = span[0]; t <= span[1]; t++) {
      const r = readingAt(t);
      if (!r) continue;
      const outside = above ? rcmp(r.got, bound) < 0 : rcmp(r.got, bound) > 0;
      if (!outside) continue;
      return [say(t, r), {
        cls: 'rf-echo-probe verdict',
        latex: `${rstr(r.got)} ${above ? '<' : '>'} ${rstr(bound)}`,
        why: T('echo.readingBeatsYourClaim', { got: rstr(r.got), val: rstr(bound) }),
      }];
    }
    // Never read outside it. Then the question is whether it is read AT ALL.
    if (abc.quadratic) {
      const u = underTheRoot(abc, bound, T);
      if (u && rsign(u.disc) < 0) {
        return [u.row, {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(u.disc)} < 0`,
          why: T('echo.neverReachesIt', { val: rstr(bound) }),
        }];
      }
    }
    return [];
  }

  // A claimed zero, put back into the rule.
  if (c.want === 'zeros') {
    const named = [];
    for (const t of entryValues(raw)) if (!named.some((u) => sEq(u, t))) named.push(t);
    for (const t of named) {
      let got;
      try { got = evalSurd(parse(src), { [v]: t }); } catch { continue; }
      if (sIsZero(got)) continue;
      const put = putSurd(src, v, t);
      if (!put) continue;
      return [
        {
          cls: 'rf-echo-probe',
          latex: `${put} = ${sTex(got)}`,
          why: T('echo.readTheRuleAt', { v, t: sTex(t) }),
        },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${sTex(got)} \\ne 0`,
          why: T('echo.notAZeroThere', { v, t: sTex(t) }),
        },
      ];
    }
    if (abc.quadratic) {
      const u = underTheRoot(abc, R(0), T);
      // Nothing readable came in, and the rule never reads zero.
      if (u && rsign(u.disc) < 0) {
        return [u.row, {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(u.disc)} < 0`,
          why: T('echo.neverReachesIt', { val: '0' }),
        }];
      }
      // Every crossing they named is a real crossing, and they named too few.
      if (u && rsign(u.disc) > 0 && named.length === 1) {
        return [u.row, {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(u.disc)} > 0`,
          why: T('echo.aboveZeroMeansTwo', { k: named.length }),
        }];
      }
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Lists with a step, and lists with a factor.
// ---------------------------------------------------------------------------
/** The step or the factor a printed list moves by, in exact arithmetic. */
function listMove(rows) {
  const clean = rows.filter((r) => r[0] !== null && r[1] !== null).map((r) => [R(r[0]), R(r[1])]);
  if (clean.length < 3) return null;
  for (let i = 1; i < clean.length; i++) if (!reqq(sub(clean[i][0], clean[i - 1][0]), R(1))) return null;
  const last = clean[clean.length - 1];
  const prev = clean[clean.length - 2];
  const step = sub(clean[1][1], clean[0][1]);
  if (!isZero(step) && clean.every((r, i) => i === 0 || reqq(sub(r[1], clean[i - 1][1]), step))) {
    return {
      kind: 'add',
      step,
      last,
      tex: `\\frac{${rstr(last[1])} - ${parR(prev[1])}}{${rstr(last[0])} - ${parR(prev[0])}}`,
    };
  }
  if (clean.some((r) => isZero(r[1]))) return null;
  const q = div(clean[1][1], clean[0][1]);
  if (isZero(q) || reqq(q, R(1))) return null;
  for (let i = 1; i < clean.length; i++) if (!reqq(div(clean[i][1], clean[i - 1][1]), q)) return null;
  return { kind: 'mul', factor: q, last, tex: `\\frac{${rstr(last[1])}}{${parR(prev[1])}}` };
}

/** The two printed statements of a recursion, read back as a first term and a move. */
function recursionMove(statements) {
  const stmts = (statements || []).map((s) => norm(s));
  const start = stmts.map((s) => /\(1\)=(-?\d+)/.exec(s)).find(Boolean);
  if (!start) return null;
  const anchor = [R(1), R(Number(start[1]))];
  const plus = stmts.map((s) => /-1\)([+-])(\d+)$/.exec(s)).find(Boolean);
  if (plus) {
    const step = R((plus[1] === '-' ? -1 : 1) * Number(plus[2]));
    return { kind: 'add', step, last: anchor, tex: rstr(step) };
  }
  const times = stmts.map((s) => /=(-?\d+)\\cdot/.exec(s)).find(Boolean);
  if (times) {
    const factor = R(Number(times[1]));
    return { kind: 'mul', factor, last: anchor, tex: rstr(factor) };
  }
  return null;
}

/**
 * A term of a printed list, refused by the move the list itself makes.
 *
 * Both sides are left UNWORKED, exactly as the log and the chart do above: the
 * arithmetic that settles it is the arithmetic worth doing, and handing over
 * the total would hand over the test.
 */
function sequenceProbe(item, raw, tag, T) {
  const c = item.check || {};
  const v = c.variable || 'n';

  // A rule written for the whole list: run it at a position the list prints.
  if (c.form === 'explicit') {
    const rows = tableRows(item).filter((r) => r[0] !== null && r[1] !== null);
    // A RULE THAT NAMES THE VALUE BEFORE IT IS NOT AN EXPLICIT RULE.
    //
    // `f\left(n-1\right) + 4` cannot be worked out at any position, because
    // working it out needs the position before, and before position one there
    // is nothing printed. That is the misconception, and it is shown rather
    // than named: the rule written at the first position, and the line the
    // list actually starts on.
    let stray = [];
    try { stray = varsOf(String(raw)).filter((name) => name !== v); } catch { stray = []; }
    if (stray.length && rows.length) {
      const put = substitute(String(raw), v, String(rows[0][0]));
      return [
        { cls: 'rf-echo-probe', latex: put, why: T('echo.yourRuleAtPosition', { t: rows[0][0] }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: arrow(R(rows[0][0]), R(rows[0][1])),
          why: T('echo.needsTheOneBefore', { t: rows[0][0] }),
        },
      ];
    }
    for (const [pos, val] of rows) {
      let got;
      try { got = evaluate(String(raw), { [v]: R(pos) }); } catch { return []; }
      if (reqq(got, R(val))) continue;
      const put = substituteVerified(String(raw), v, R(pos));
      if (!put) continue;
      return [
        { cls: 'rf-echo-probe', latex: `${put} = ${rstr(got)}`, why: T('echo.yourRuleAtPosition', { t: pos }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(got)} \\ne ${val}`,
          why: T('echo.listReadsThere', { t: pos, y: val }),
        },
      ];
    }
    return [];
  }

  const at = Number(c.at);
  const val = fromString(String(raw).trim());
  if (!val || !Number.isInteger(at)) return [];
  const move = c.form === 'recursive' ? recursionMove(c.statements) : listMove(tableRows(item));
  if (!move) return [];
  const [pos0, val0] = move.last;
  const gap = at - toNum(pos0);
  if (gap <= 0) return [];

  if (move.kind === 'add') {
    const implied = div(sub(val, val0), R(gap));
    if (reqq(implied, move.step)) return [];
    return [
      {
        cls: 'rf-echo-probe',
        latex: `\\frac{${rstr(val)} - ${parR(val0)}}{${at} - ${parR(pos0)}}`,
        why: T('echo.stepFromYourValue'),
      },
      { cls: 'rf-echo-probe verdict', latex: move.tex, why: T('echo.stepTheListMakes') },
    ];
  }
  if (isZero(val0)) return [];
  const implied = div(val, val0);
  let want;
  try { want = rpow(move.factor, gap); } catch { return []; }
  if (reqq(implied, want)) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: `\\frac{${rstr(val)}}{${parR(val0)}}`,
      why: T('echo.factorFromYourValue'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `\\left(${move.tex}\\right)^{${gap}}`,
      why: T('echo.factorTheListMakes', { k: gap }),
    },
  ];
}

// ---------------------------------------------------------------------------
// A set of pairs, and whether one input carries two readings.
// ---------------------------------------------------------------------------
/** `6 \to 4`, the one spelling this module uses for a reading. */
const arrow = (x, y) => `${rstr(x)} \\;\\to\\; ${rstr(y)}`;

/**
 * The input that breaks a relation, refused by the column it was read from.
 *
 * Three shapes of wrong answer, and each gets the rows it deserves: an input
 * that appears once carries one reading and breaks nothing; a number read off
 * the output column is not an input at all; and an input that appears twice
 * with the SAME reading is a repeat, not a break.
 */
function relationPairsProbe(item, raw, tag, T) {
  if ((item.check || {}).want !== 'breakingInput') return [];
  const pairs = readingsShown(item);
  if (pairs.length < 3) return [];
  const val = fromString(String(raw).trim());
  if (!val) return [];
  const mine = pairs.filter(([x]) => reqq(x, val));
  if (mine.length >= 2) {
    if (new Set(mine.map(([, y]) => rstr(y))).size > 1) return [];
    return [{
      cls: 'rf-echo-probe verdict',
      latex: mine.map(([x, y]) => arrow(x, y)).join(' \\qquad '),
      why: T('echo.sameReadingTwice', { t: rstr(val) }),
    }];
  }
  if (mine.length === 1) {
    return [{
      cls: 'rf-echo-probe verdict',
      latex: arrow(mine[0][0], mine[0][1]),
      why: T('echo.yourInputOnce', { t: rstr(val) }),
    }];
  }
  const asOutput = pairs.filter(([, y]) => reqq(y, val));
  if (asOutput.length) {
    return [{
      cls: 'rf-echo-probe verdict',
      latex: asOutput.map(([x, y]) => arrow(x, y)).join(' \\qquad '),
      why: T('echo.yoursIsAnOutput', { t: rstr(val) }),
    }];
  }
  return [{
    cls: 'rf-echo-probe verdict',
    latex: pairs.map(([x]) => rstr(x)).join(' \\quad '),
    why: T('echo.notAnInputAtAll', { t: rstr(val) }),
  }];
}

// ---------------------------------------------------------------------------
// A second line, beside a printed one.
// ---------------------------------------------------------------------------
/**
 * The rate of a printed straight rule in TWO letters. `null` when upright.
 *
 * `linearize()` cannot read this: it throws on any letter that is not the one
 * it was asked about, so on `y = 3x + 5` it refuses both readings. The rule is
 * probed as a function of two readings instead, and confirmed at a third point
 * so that nothing above degree one can hide inside a bracket.
 */
function rateOfLine(src, vx, vy) {
  const two = twoSides(String(src));
  if (!two) return null;
  const f = (x, y) => {
    const env = { [vx]: R(x), [vy]: R(y) };
    return sub(evaluate(two[0], env), evaluate(two[1], env));
  };
  let a; let b; let c0;
  try {
    c0 = f(0, 0);
    a = sub(f(1, 0), c0);
    b = sub(f(0, 1), c0);
    const want = add(add(c0, mul(a, R(2))), mul(b, R(3)));
    if (!reqq(f(2, 3), want)) return null;
  } catch { return null; }
  if (isZero(b)) return null;
  return neg(div(a, b));
}

/** `a x + b y = c` read off a printed rule in two letters, or null. */
function lineCoeffs(src, vx, vy) {
  const two = twoSides(String(src));
  if (!two) return null;
  const f = (x, y) => {
    const env = { [vx]: R(x), [vy]: R(y) };
    return sub(evaluate(two[0], env), evaluate(two[1], env));
  };
  try {
    const c0 = f(0, 0);
    const a = sub(f(1, 0), c0);
    const b = sub(f(0, 1), c0);
    if (!reqq(f(2, 3), add(add(c0, mul(a, R(2))), mul(b, R(3))))) return null;
    return { a, b, c: neg(c0) };
  } catch { return null; }
}

const gcdInt = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; };

/**
 * The one shape error this family carries that is not a wrong line: a rule
 * that names the right line and still holds a fraction where the ask wants
 * whole numbers.
 *
 * There is real arithmetic to show, so it is shown: the number every part has
 * to be multiplied by, and what the first part becomes. Only the first, so the
 * cadet does the rest.
 */
function wholeNumbersRows(raw, vx, vy, T) {
  const co = lineCoeffs(raw, vx, vy);
  if (!co) return [];
  let den = 1;
  for (const q of [co.a, co.b, co.c]) den = (den * q.d) / gcdInt(den, q.d);
  if (den === 1 || den > 400) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: `${texOf(co.a)} \\quad ${texOf(co.b)} \\quad ${texOf(co.c)}`,
      why: T('echo.yourPartsHaveFractions'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `${den} \\cdot \\left(${texOf(co.a)}\\right) = ${rstr(mul(R(den), co.a))}`,
      why: T('echo.clearTheFractions', { d: den }),
    },
  ];
}

/**
 * Two readings of a printed straight rule, which is how "this line is not
 * upright" is shown rather than said: an upright line reads at ONE input, and
 * a rule that answers at two different inputs is not one.
 */
function twoReadings(src, vx, vy, T, key) {
  const co = lineCoeffs(src, vx, vy);
  if (!co || isZero(co.b)) return [];
  const at = (x) => div(sub(co.c, mul(co.a, R(x))), co.b);
  try {
    return [{
      cls: 'rf-echo-probe verdict',
      latex: `\\left(0, ${texOf(at(0))}\\right) \\quad \\left(1, ${texOf(at(1))}\\right)`,
      why: T(key),
    }];
  } catch { return []; }
}

/** The two rates, multiplied, against the minus one a right angle needs. */
function rightAngleRows(mine, given, T) {
  const prod = mul(mine, given);
  if (reqq(prod, R(-1))) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: `\\left(${texOf(mine)}\\right)\\left(${texOf(given)}\\right) = ${texOf(prod)}`,
      why: T('echo.ratesMultiply'),
    },
    { cls: 'rf-echo-probe verdict', latex: `${texOf(prod)} \\ne -1`, why: T('echo.yourRatesGive', { got: rstr(prod) }) },
  ];
}

/** The rate a line beside a printed one has to carry. */
function sameRateRows(mine, given, T) {
  if (reqq(mine, given)) return [];
  return [
    { cls: 'rf-echo-probe', latex: `${texOf(given)}`, why: T('echo.parallelRatesMatch') },
    {
      cls: 'rf-echo-probe verdict',
      latex: `${texOf(mine)} \\ne ${texOf(given)}`,
      why: T('echo.yourRateDiffers', { want: rstr(given), got: rstr(mine) }),
    },
  ];
}

/**
 * A line written beside another one, refused by the reading it must pass
 * through and by the rate it must carry.
 *
 * Two facts, and both are arithmetic a cadet can do in their head: the marked
 * reading written into the rule they wrote, and the two rates multiplied —
 * which comes to minus one for a right angle, and to nothing at all for two
 * lines that never meet, because those two rates are simply the same number.
 */
function relatedLineProbe(item, raw, tag, T) {
  const c = item.check || {};
  const vx = c.vars?.[0] || 'x';
  const vy = c.vars?.[1] || 'y';
  const given = rateOfLine(c.math, vx, vy);
  const [x0, y0] = c.point || [];
  const right = c.relation === 'perpendicular';

  // A rate on its own.
  if (c.want === 'slope') {
    const mine = fromString(String(raw).trim());
    if (!mine) return [];
    if (given === null) {
      // The printed line stands upright. A line at a right angle to it is
      // level, and a level line has rate zero.
      if (right && !isZero(mine)) {
        return [
          { cls: 'rf-echo-probe', latex: `${texOf(mine)} \\ne 0`, why: T('echo.rightAngleToUpright') },
        ];
      }
      return [];
    }
    return right ? rightAngleRows(mine, given, T) : sameRateRows(mine, given, T);
  }

  // A whole rule. First: does it pass through the reading it was written from?
  if (x0 != null && y0 != null && String(raw).includes('=')) {
    const two = twoSides(String(raw));
    if (two) {
      const env = { [vx]: R(Number(x0)), [vy]: R(Number(y0)) };
      let l; let r;
      try { l = evaluate(two[0], env); r = evaluate(two[1], env); } catch { l = null; }
      if (l && r && !reqq(l, r)) {
        const shown = putBoth(String(raw), vx, vy, env[vx], env[vy]);
        return [
          {
            cls: 'rf-echo-probe',
            latex: shown || String(raw).trim(),
            why: T('echo.throughThePoint', { x: Number(x0), y: Number(y0) }),
          },
          { cls: 'rf-echo-probe verdict', latex: `${rstr(l)} \\ne ${rstr(r)}`, why: T('echo.missesThePoint') },
        ];
      }
    }
  }
  // Then: the rate.
  const mine = rateOfLine(String(raw), vx, vy);
  // Their line stands upright and the printed one does not. The printed line
  // answers at two different inputs, and that is shown, not asserted.
  if (mine === null) {
    if (given === null) return [];
    return twoReadings(String(c.math), vx, vy, T, 'echo.printedLineIsNotUpright');
  }
  // The printed line stands upright and theirs does not.
  if (given === null) {
    if (right && !isZero(mine)) {
      return [{ cls: 'rf-echo-probe', latex: `${texOf(mine)} \\ne 0`, why: T('echo.rightAngleToUpright') }];
    }
    if (!right) return twoReadings(String(raw), vx, vy, T, 'echo.parallelToUprightIsUpright');
    return [];
  }
  const rows = right ? rightAngleRows(mine, given, T) : sameRateRows(mine, given, T);
  if (rows.length) return rows;
  // The right line, spelled a way the ask does not accept.
  if (c.form === 'standard') return wholeNumbersRows(String(raw), vx, vy, T);
  if (c.form === 'pointSlope' && x0 != null && y0 != null) {
    return namedReadingRows(String(raw), vx, vy, R(Number(x0)), R(Number(y0)), T);
  }
  return [];
}

/**
 * The reading a point-slope form NAMES, read back out of the cadet's own
 * notation.
 *
 * `y - 3 = -\left(x + 7\right)` draws exactly the line the rift wants, so no
 * substitution and no rate can argue with it — and it is still the wrong
 * answer, because this form is a way of writing a reading down and the reading
 * it writes down is the marked one with its two numbers swapped and their signs
 * kept. So the probe reads the pair back off the two sides: the value that
 * empties the left, and the value that empties the right.
 */
function namedReadingRows(raw, vx, vy, x0, y0, T) {
  const two = twoSides(raw);
  if (!two) return [];
  let px; let py;
  try {
    if (varsOf(two[0]).join('') !== vy || varsOf(two[1]).join('') !== vx) return [];
    const ly = solveLinear(`${two[0]} = 0`, vy);
    const lx = solveLinear(`${two[1]} = 0`, vx);
    if (ly.kind !== 'unique' || lx.kind !== 'unique') return [];
    py = ly.value; px = lx.value;
  } catch { return []; }
  if (reqq(px, x0) && reqq(py, y0)) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: `\\left(${texOf(px)}, ${texOf(py)}\\right)`,
      why: T('echo.yourFormNamesThisReading'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: `\\left(${texOf(px)}, ${texOf(py)}\\right) \\ne \\left(${texOf(x0)}, ${texOf(y0)}\\right)`,
      why: T('echo.notTheMarkedReading'),
    },
  ];
}

// ---------------------------------------------------------------------------
// A lean in two letters, with no shading anywhere.
// ---------------------------------------------------------------------------
/** Is a two-letter statement true at this reading? `null` when unreadable. */
function holdsAt2(src, env) {
  const { parts, rels } = relationsOf(String(src));
  if (!rels.length) {
    const two = twoSides(String(src));
    if (!two) return null;
    try { return reqq(evaluate(two[0], env), evaluate(two[1], env)); } catch { return null; }
  }
  let vals;
  try { vals = parts.map((p) => evaluate(p, env)); } catch { return null; }
  for (let i = 0; i < rels.length; i++) {
    const d = toNum(sub(vals[i], vals[i + 1]));
    const ok = rels[i] === '<' ? d < 0 : rels[i] === '>' ? d > 0 : rels[i] === '\\le' ? d <= 0 : d >= 0;
    if (!ok) return false;
  }
  return true;
}

/** A two-letter statement with both readings written in, verified part by part. */
function putBoth(src, vx, vy, x, y) {
  const { parts, rels } = relationsOf(String(src));
  const bodies = rels.length ? parts : (twoSides(String(src)) || []);
  if (!bodies.length) return null;
  const put = bodies.map((p) => {
    let out = String(p).trim();
    for (const [name, val] of [[vx, x], [vy, y]]) {
      if (!varsOf(out).includes(name)) continue;
      const next = substituteVerified(out, name, val, { [name === vx ? vy : vx]: name === vx ? y : x });
      if (!next) return null;
      out = next;
    }
    return out;
  });
  if (put.some((p) => !p)) return null;
  if (!rels.length) return `${put[0]} = ${put[1]}`;
  let out = put[0];
  for (let i = 0; i < rels.length; i++) out += ` ${rels[i]} ${put[i + 1]}`;
  return out;
}

/** The same statement, worked out part by part: "7 < 4". */
function readAt2(src, env) {
  const { parts, rels } = relationsOf(String(src));
  const bodies = rels.length ? parts : (twoSides(String(src)) || []);
  if (!bodies.length) return null;
  let vals;
  try { vals = bodies.map((p) => evaluate(p, env)); } catch { return null; }
  let out = rstr(vals[0]);
  const joins = rels.length ? rels : ['='];
  for (let i = 0; i < joins.length; i++) out += ` ${joins[i]} ${rstr(vals[i + 1])}`;
  return out;
}

/**
 * A lean over a region, refused by the reading the item itself marks.
 *
 * The item says of exactly two readings whether they belong to the region — one
 * ON the boundary and one off it. Those two statements are the whole of the
 * evidence, so they are the whole of the refusal: put the reading into the lean
 * the cadet wrote, work it out, and see whether it agrees with what the card
 * said about that reading.
 */
function halfPlaneProbe(item, raw, tag, T) {
  const c = item.check || {};
  const vx = c.vars?.[0] || 'x';
  const vy = c.vars?.[1] || 'y';
  let cells;
  try { cells = parseArrayCells(String(item.latex)); } catch { return []; }
  let test = null; let edge = null;
  const boundary = [];
  /* WHICH MARKED READING IS THE BOUNDARY ONE IS GEOMETRY, NOT VOCABULARY.
     These cards used to carry four glyphs the card never defined — `+` in, `-`
     out, a filled circle included, an open circle excluded — and the role of a
     row was read off which glyph it was. They now carry ONE statement, `\in R`
     or `\notin R`, in both roles, so the role is decided the way a learner
     decides it: the readings that carry no statement are the ones that fit a
     straight line, and the marked reading that lands on that line is the
     boundary one. The four old glyphs are still read — `tools/check-solver.mjs`
     still plants them — so a checker that once accepted them keeps doing so. */
  const marks = [];
  for (const row of cells) {
    const nums = [];
    for (const cell of row) { try { nums.push(evaluate(cell)); } catch { /* a label, or a mark */ } }
    if (nums.length !== 2) continue;
    let say = null; let role = null;
    for (const cell of row) {
      const t = String(cell).replace(/\s+/g, '');
      if (t === '+') { say = true; role = 'test'; break; }
      if (t === '-') { say = false; role = 'test'; break; }
      if (t === '\\bullet') { say = true; role = 'edge'; break; }
      if (t === '\\circ') { say = false; role = 'edge'; break; }
      if (t === '\\inR') { say = true; break; }
      if (t === '\\notinR') { say = false; break; }
    }
    if (say === null) { boundary.push(nums); continue; }
    if (role === 'test') { test = { at: nums, want: say }; continue; }
    if (role === 'edge') { edge = { at: nums, want: say }; boundary.push(nums); continue; }
    marks.push({ at: nums, want: say });
  }
  if (marks.length === 2 && boundary.length >= 2) {
    let fit = null;
    for (let i = 1; i < boundary.length && !fit; i++) {
      if (reqq(boundary[i][0], boundary[0][0])) continue;
      const m = div(sub(boundary[i][1], boundary[0][1]), sub(boundary[i][0], boundary[0][0]));
      fit = { m, b: sub(boundary[0][1], mul(m, boundary[0][0])) };
    }
    if (fit) {
      for (const k of marks) {
        const on = reqq(k.at[1], add(mul(fit.m, k.at[0]), fit.b));
        if (on && !edge) { edge = k; boundary.push(k.at); } else if (!on && !test) test = k;
      }
    }
  }
  const isLean = relationsOf(String(raw)).rels.length > 0;

  // FIRST, THE EDGE ITSELF. Every unmarked reading in the table sits ON the
  // boundary, so the two sides of the cadet's own lean have to come out equal
  // at each of them. A rate that was flipped, or a number moved to the wrong
  // side, breaks that at the first reading and never touches the marks at all.
  const { parts, rels } = relationsOf(String(raw));
  const bodies = rels.length ? parts : (twoSides(String(raw)) || []);
  if (bodies.length === 2) {
    for (const [x, y] of boundary) {
      const env = { [vx]: x, [vy]: y };
      let l; let r;
      try { l = evaluate(bodies[0], env); r = evaluate(bodies[1], env); } catch { continue; }
      if (reqq(l, r)) continue;
      const shown = putBoth(String(raw), vx, vy, x, y);
      if (!shown) continue;
      return [
        { cls: 'rf-echo-probe', latex: shown, why: T('echo.putAnEdgeReading', { x: rstr(x), y: rstr(y) }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(l)} \\ne ${rstr(r)}`,
          why: T('echo.edgeDoesNotRunThrough'),
        },
      ];
    }
  }
  for (const probe of [test, edge]) {
    if (!probe) continue;
    const [x, y] = probe.at;
    const env = { [vx]: x, [vy]: y };
    const holds = holdsAt2(String(raw), env);
    if (holds === null) continue;
    // A rule with an equals sign names a line, not a region. It is refused by
    // any marked reading it does not run through.
    if (!isLean && holds) continue;
    if (isLean && holds === probe.want) continue;
    const shown = putBoth(String(raw), vx, vy, x, y);
    const read = readAt2(String(raw), env);
    if (!shown || !read) continue;
    return [
      {
        cls: 'rf-echo-probe',
        latex: shown,
        why: T(probe === test ? 'echo.putTheMarkedReading' : 'echo.putTheBoundaryReading', { x: rstr(x), y: rstr(y) }),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: read,
        why: T(!isLean ? 'echo.thatIsALineNotARegion' : holds ? 'echo.yourLeanLetsItIn' : 'echo.yourLeanShutsItOut'),
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Two rules, written from two sets of readings.
// ---------------------------------------------------------------------------
/**
 * A pair of rules, refused by the readings they were written from.
 *
 * A rule that does not run through its own table is refused by one reading. A
 * PAIR that is really one rule, or a pair that is really a crossing point, is
 * refused by the same input read in both tables: the two answers differ, so no
 * single rule and no single reading can describe them both.
 */
function systemWriteProbe(item, raw, tag, T) {
  const c = item.check || {};
  const vx = c.vars?.[0] || 'x';
  const vy = c.vars?.[1] || 'y';
  let blocks;
  try { blocks = parseArrayBlocks(String(item.latex)); } catch { return []; }
  if (blocks.length !== 2) return [];
  const tableOf = (cells) => {
    const out = [];
    for (const row of cells) {
      const nums = [];
      for (const cell of row) { try { nums.push(evaluate(cell)); } catch { /* a label */ } }
      if (nums.length === 2) out.push(nums);
    }
    return out;
  };
  const tables = blocks.map(tableOf);
  if (tables.some((t) => t.length < 2)) return [];
  const written = splitTop(String(raw), ',').map((t) => t.trim()).filter(Boolean);
  const rules = written.filter((w) => w.includes('='));

  // Every rule they wrote has to run through one of the two tables.
  for (const rule of rules) {
    const two = twoSides(rule);
    if (!two) continue;
    const misses = tables.map((pts) => pts.filter(([x, y]) => {
      const holds = holdsAt2(rule, { [vx]: x, [vy]: y });
      return holds === false;
    }).length);
    if (Math.min(...misses) === 0) continue;          // it fits one table exactly
    const table = tables[misses[0] <= misses[1] ? 0 : 1];
    for (const [x, y] of table) {
      if (holdsAt2(rule, { [vx]: x, [vy]: y }) !== false) continue;
      const shown = putBoth(rule, vx, vy, x, y);
      const read = readAt2(rule, { [vx]: x, [vy]: y });
      if (!shown || !read) continue;
      return [
        { cls: 'rf-echo-probe', latex: shown, why: T('echo.runYourRuleOnTheTable', { t: rstr(x) }) },
        { cls: 'rf-echo-probe verdict', latex: read, why: T('echo.tableDisagrees', { t: rstr(x), y: rstr(y) }) },
      ];
    }
  }

  // One rule where two were asked for, or a crossing where rules were asked
  // for. The two tables climb at two different rates, and one rule has one
  // rate. Both fractions are left unworked, as everywhere else in this module.
  const rateOf = (pts) => {
    const [A, B] = pts;
    if (!A || !B || reqq(A[0], B[0])) return null;
    return { tex: `\\frac{${rstr(B[1])} - ${parR(A[1])}}{${rstr(B[0])} - ${parR(A[0])}}`, q: div(sub(B[1], A[1]), sub(B[0], A[0])) };
  };
  const r0 = rateOf(tables[0]);
  const r1 = rateOf(tables[1]);
  if (r0 && r1 && !reqq(r0.q, r1.q)) {
    return [
      { cls: 'rf-echo-probe', latex: r0.tex, why: T('echo.rateOfEachTable') },
      { cls: 'rf-echo-probe verdict', latex: r1.tex, why: T('echo.twoRatesTwoRules') },
    ];
  }
  for (const [x, y] of tables[0]) {
    const other = tables[1].find(([x2]) => reqq(x2, x));
    if (!other || reqq(other[1], y)) continue;
    return [
      {
        cls: 'rf-echo-probe',
        latex: `${arrow(x, y)} \\qquad ${arrow(other[0], other[1])}`,
        why: T('echo.sameInputTwoTables', { t: rstr(x) }),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${rstr(y)} \\ne ${rstr(other[1])}`,
        why: T('echo.twoTablesTwoRules'),
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// The closest line through a cloud of readings.
// ---------------------------------------------------------------------------
/** The sums an exact least-squares fit is built from, or null. */
function fitOf(pts) {
  if (pts.length < 3) return null;
  const n = R(pts.length);
  let sx = R(0); let sy = R(0);
  for (const [x, y] of pts) { sx = add(sx, x); sy = add(sy, y); }
  const xbar = div(sx, n); const ybar = div(sy, n);
  let sxx = R(0); let sxy = R(0);
  for (const [x, y] of pts) {
    const dx = sub(x, xbar); const dy = sub(y, ybar);
    sxx = add(sxx, mul(dx, dx));
    sxy = add(sxy, mul(dx, dy));
  }
  if (isZero(sxx)) return null;
  const m = div(sxy, sxx);
  const b = sub(ybar, mul(m, xbar));
  for (const q of [xbar, ybar, m, b]) if (!isSafe(q)) return null;
  return { xbar, ybar, m, b, at: (x) => add(mul(m, x), b) };
}

/** The total of the squared gaps a straight rule leaves on a set of readings. */
function squaredGaps(pts, m, b) {
  let total = R(0);
  for (const [x, y] of pts) {
    const g = sub(y, add(mul(m, x), b));
    total = add(total, mul(g, g));
    if (!isSafe(total)) return null;
  }
  return total;
}

/**
 * The closest line through a cloud, refused four ways — and never by printing
 * the rate the rift wants.
 *
 *   · a number that is simply one of the printed readings  ->  the reading it
 *     was copied from, and the input it belongs to;
 *   · a rate taken off one pair  ->  two pairs, side by side, that disagree,
 *     which is why no one pair fixes anything;
 *   · a gap taken the wrong way round  ->  the same gap worked out at a
 *     DIFFERENT row, so the order is shown without the asked value being said;
 *   · anything else  ->  the total of the squared gaps the cadet's own answer
 *     implies, against the total the closest line leaves. The closest line is
 *     the one with the smallest total; that is what "closest" means, and the
 *     two totals name no rate at all.
 */
function regressionProbe(item, raw, tag, T) {
  const c = item.check || {};
  if (c.model === 'quadratic') return curvedFitProbe(item, raw, tag, T);
  const pts = readingsShown(item);
  const fit = fitOf(pts);
  if (!fit) return [];
  const val = fromString(String(raw).trim());

  // Their number is a reading off the table, handed in as a prediction.
  if (val && ['predict', 'intercept', 'slope'].includes(c.want)) {
    const hit = pts.find(([, y]) => reqq(y, val));
    if (hit && (c.want !== 'predict' || !reqq(hit[0], R(Number(c.at))))) {
      const asked = c.want === 'predict' ? rstr(R(Number(c.at))) : '0';
      return [
        { cls: 'rf-echo-probe', latex: arrow(hit[0], hit[1]), why: T('echo.thatIsAReading', { t: rstr(hit[0]) }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(hit[0])} \\ne ${asked}`,
          why: T('echo.notTheAskedInput', { k: asked }),
        },
      ];
    }
  }

  // A gap taken the wrong way round, or off the wrong row. The order is shown
  // at a row the question did not ask about, so nothing about the asked row is
  // given away.
  if (c.want === 'residual') {
    const asked = R(Number(c.at));
    // THEIR NUMBER IS A GAP — AT THE WRONG ROW.
    //
    // That is a named error of its own, and the honest answer is to agree with
    // the arithmetic and disagree with the row: the gap they worked out, worked
    // out again in full, beside the input the question actually named.
    if (val) {
      const hit = pts.find(([x, y]) => !reqq(x, asked) && reqq(sub(y, fit.at(x)), val));
      if (hit) {
        return [
          {
            cls: 'rf-echo-probe',
            latex: `${rstr(hit[1])} - ${parR(fit.at(hit[0]))} = ${rstr(val)}`,
            why: T('echo.thatGapIsAtAnotherRow', { t: rstr(hit[0]) }),
          },
          {
            cls: 'rf-echo-probe verdict',
            latex: `${rstr(hit[0])} \\ne ${rstr(asked)}`,
            why: T('echo.notTheAskedRow', { k: rstr(asked) }),
          },
        ];
      }
    }
    for (const [x, y] of pts) {
      if (reqq(x, asked)) continue;
      const line = fit.at(x);
      const gap = sub(y, line);
      if (isZero(gap) || reqq(gap, val || R(0))) continue;
      return [
        {
          cls: 'rf-echo-probe',
          latex: `${rstr(y)} - ${parR(line)} = ${rstr(gap)}`,
          why: T('echo.gapAtAnotherRow', { t: rstr(x) }),
        },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(gap)} ${rsign(gap) < 0 ? '<' : '>'} 0`,
          why: T(rsign(gap) < 0 ? 'echo.gapBelowMeansUnder' : 'echo.gapAboveMeansOver', { t: rstr(x) }),
        },
      ];
    }
  }

  // The rate a single pair gives, twice, disagreeing with itself.
  if (['slope', 'intercept', 'predict'].includes(c.want) || tag === 'rate-from-one-pair' || tag === 'first-and-last-joined') {
    const rate = (A, B) => (reqq(A[0], B[0]) ? null
      : { tex: `\\frac{${rstr(B[1])} - ${parR(A[1])}}{${rstr(B[0])} - ${parR(A[0])}}`, q: div(sub(B[1], A[1]), sub(B[0], A[0])) });
    const first = rate(pts[0], pts[1]);
    const other = pts.slice(2).map((p, i) => rate(pts[i + 1], p)).find((r) => r && !reqq(r.q, first ? first.q : R(0)));
    if (first && other) {
      return [
        { cls: 'rf-echo-probe', latex: first.tex, why: T('echo.rateBetweenTwoReadings') },
        { cls: 'rf-echo-probe verdict', latex: other.tex, why: T('echo.ratesDoNotAgree') },
      ];
    }
  }

  // Last: the total of the squared gaps, theirs against the closest line's.
  if (!val) return [];
  let m = null;
  if (c.want === 'slope') m = val;
  else if (c.want === 'intercept') m = isZero(fit.xbar) ? null : div(sub(fit.ybar, val), fit.xbar);
  else if (c.want === 'predict') {
    const at = R(Number(c.at));
    m = reqq(at, fit.xbar) ? null : div(sub(val, fit.ybar), sub(at, fit.xbar));
  } else if (c.want === 'residual') {
    const at = R(Number(c.at));
    const seen = pts.find(([x]) => reqq(x, at));
    if (seen && !reqq(at, fit.xbar)) m = div(sub(sub(seen[1], val), fit.ybar), sub(at, fit.xbar));
  }
  if (!m || !isSafe(m) || reqq(m, fit.m)) return [];
  const b = sub(fit.ybar, mul(m, fit.xbar));
  const mine = squaredGaps(pts, m, b);
  const best = squaredGaps(pts, fit.m, fit.b);
  if (!mine || !best || rcmp(mine, best) <= 0) return [];
  return [
    { cls: 'rf-echo-probe', latex: `${rstr(mine)}`, why: T('echo.squaredGapsOfYours') },
    {
      cls: 'rf-echo-probe verdict',
      latex: `${rstr(best)} < ${rstr(mine)}`,
      why: T('echo.closestLineIsSmaller'),
    },
  ];
}

/**
 * A curved set of readings, and a number handed to it.
 *
 * There is no rate to argue about, because there is no one rate: that is the
 * whole point of the shape. So the probe prints the steps between the printed
 * readings, and then the steps BETWEEN THE STEPS, which for a curve of this
 * family are all the same number. A cadet who carried one rate forward sees
 * their assumption come apart on the first line, and the second line is the
 * pattern that actually governs the log.
 *
 * Where the cadet's number is simply a reading off the table, that is said
 * instead, because it is the more exact thing to say.
 */
function curvedFitProbe(item, raw, tag, T) {
  const c = item.check || {};
  const pts = readingsShown(item);
  if (pts.length < 4) return [];
  const val = fromString(String(raw).trim());
  if (val) {
    const hit = pts.find(([, y]) => reqq(y, val));
    if (hit && !reqq(hit[0], R(Number(c.at)))) {
      return [
        { cls: 'rf-echo-probe', latex: arrow(hit[0], hit[1]), why: T('echo.thatIsAReading', { t: rstr(hit[0]) }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(hit[0])} \\ne ${rstr(R(Number(c.at)))}`,
          why: T('echo.notTheAskedInput', { k: rstr(R(Number(c.at))) }),
        },
      ];
    }
  }
  for (let i = 1; i < pts.length; i++) if (!reqq(sub(pts[i][0], pts[i - 1][0]), R(1))) return [];
  const first = [];
  for (let i = 1; i < pts.length; i++) first.push(sub(pts[i][1], pts[i - 1][1]));
  if (first.length < 3) return [];
  const second = [];
  for (let i = 1; i < first.length; i++) second.push(sub(first[i], first[i - 1]));
  if (!second.every((d) => reqq(d, second[0])) || isZero(second[0])) return [];
  if (first.every((d) => reqq(d, first[0]))) return [];
  return [
    {
      cls: 'rf-echo-probe',
      latex: first.map((d) => rstr(d)).join(' \\quad '),
      why: T('echo.stepsBetweenReadings'),
    },
    {
      cls: 'rf-echo-probe verdict',
      latex: second.map((d) => rstr(d)).join(' \\quad '),
      why: T('echo.stepsOfTheStepsAreEqual'),
    },
  ];
}

// ---------------------------------------------------------------------------
// A two-way table of counts.
// ---------------------------------------------------------------------------
/**
 * A frequency, refused by the table's own totals.
 *
 * Three refusals, all read straight off the printed counts:
 *
 *   · a frequency above one, which no part of a whole can be;
 *   · a bottom number that is a DIFFERENT total from the one this ask names,
 *     shown by adding the row up;
 *   · a top number that is not a reading of the named row at all.
 */
/**
 * `\boxed{S}` -> `S`. A card that MARKS the row and the column its question is
 * about draws the mark round the heading, and that heading is then read out
 * loud in a sentence — "the reading under {h}" — where a control sequence is
 * not a heading, it is raw notation printed at a learner. The mark comes off
 * before the letter is spoken; on an unmarked table this changes nothing.
 */
const bareHeading = (t) => String(t).trim()
  .replace(/^\\(?:boxed|fbox|underline|mathbf|bm)\{([^{}]*)\}$/, '$1').trim();

function twoWayTableProbe(item, raw, tag, T) {
  const c = item.check || {};
  let cells;
  try { cells = parseArrayCells(String(item.latex)); } catch { return []; }
  const grid = [];
  let heads = [];
  for (const row of cells) {
    const nums = [];
    for (const cell of row) { try { nums.push(evaluate(cell)); } catch { /* a label */ } }
    if (nums.length) { grid.push(nums); continue; }
    // The row of column headings. It is what lets the probe say WHICH reading
    // the cadet took, in the table's own letters, without naming the one the
    // question wants.
    if (!heads.length) heads = row.map(bareHeading).filter((t) => t && t !== '{}');
  }
  if (grid.length < 2) return [];
  const width = grid[0].length;
  if (!grid.every((row) => row.length === width) || width < 2) return [];
  const bodyRows = grid.length - 1;
  const bodyCols = width - 1;
  const val = fromString(String(raw).trim());
  if (!val) return [];

  // A part of a whole is never bigger than the whole.
  if (!c.asPercent && rcmp(val, R(1)) > 0) {
    return [
      { cls: 'rf-echo-probe', latex: `${texOf(val)} > 1`, why: T('echo.yoursIsAboveOne') },
      { cls: 'rf-echo-probe verdict', latex: `0 \\le \\frac{${grid[0][0].n}}{${grid[bodyRows][bodyCols].n}} \\le 1`, why: T('echo.aPartIsNeverBigger') },
    ];
  }

  const ri = Number(c.row); const ci = Number(c.col);
  const rowOk = Number.isInteger(ri) && ri >= 0 && ri < bodyRows;
  const colOk = Number.isInteger(ci) && ci >= 0 && ci < bodyCols;
  const whole = c.want === 'conditionalRow' && rowOk ? { at: grid[ri][bodyCols], key: 'echo.rowAddsTo', parts: grid[ri].slice(0, bodyCols) }
    : c.want === 'conditionalCol' && colOk ? { at: grid[bodyRows][ci], key: 'echo.columnAddsTo', parts: grid.slice(0, bodyRows).map((r) => r[ci]) }
      : { at: grid[bodyRows][bodyCols], key: 'echo.wholeTableAddsTo', parts: grid.slice(0, bodyRows).map((r) => r[bodyCols]) };
  if (!whole.at || !whole.parts.length || whole.parts.some((p) => !p)) return [];
  let sum = R(0);
  for (const p of whole.parts) sum = add(sum, p);
  if (!reqq(sum, whole.at)) return [];

  // The bottom of their fraction is not the whole this ask is about.
  if (val.d !== 1 && !reqq(R(val.d), whole.at)) {
    return [
      {
        cls: 'rf-echo-probe',
        latex: `${whole.parts.map((p) => rstr(p)).join(' + ')} = ${rstr(sum)}`,
        why: T(whole.key),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${val.d} \\ne ${rstr(sum)}`,
        why: T('echo.thatIsADifferentWhole', { got: val.d, want: rstr(sum) }),
      },
    ];
  }

  // The top of their fraction, read back off the whole this ask names.
  const top = mul(val, whole.at);
  const cellsOfInterest = (c.want === 'conditionalRow' || c.want === 'joint') && rowOk ? grid[ri].slice(0, bodyCols)
    : c.want === 'conditionalCol' && colOk ? grid.slice(0, bodyRows).map((r) => r[ci])
      : null;

  // THE RIGHT ROW, THE WRONG READING IN IT.
  //
  // Their top number IS one of the readings the question is about — just not
  // the one under the heading it names. There is no contradiction to compute
  // here, because their fraction is a true frequency of a different question,
  // so the probe does the only honest thing: it prints the row back with its
  // headings, and says which heading their reading sits under. Every numeral
  // in those two lines is already on the cadet's screen.
  const wantedIndex = c.want === 'conditionalCol' ? ri : ci;
  if (cellsOfInterest && heads.length >= cellsOfInterest.length) {
    const at = cellsOfInterest.findIndex((p) => reqq(top, p));
    if (at >= 0 && at !== wantedIndex && heads[at]) {
      return [
        {
          cls: 'rf-echo-probe',
          latex: cellsOfInterest.map((p, i) => `${heads[i] || '?'} \\;\\to\\; ${rstr(p)}`).join(' \\qquad '),
          why: T(c.want === 'conditionalCol' ? 'echo.readingsOfThatColumn' : 'echo.readingsOfThatRow'),
        },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${heads[at]} \\;\\to\\; ${rstr(top)}`,
          why: T('echo.yourReadingIsUnder', { h: heads[at] }),
        },
      ];
    }
  }
  if (cellsOfInterest && !cellsOfInterest.some((p) => reqq(top, p))) {
    return [
      {
        cls: 'rf-echo-probe',
        latex: cellsOfInterest.map((p) => rstr(p)).join(' \\quad '),
        why: T(c.want === 'conditionalCol' ? 'echo.readingsOfThatColumn' : 'echo.readingsOfThatRow'),
      },
      {
        cls: 'rf-echo-probe verdict',
        latex: `${texOf(val)} \\cdot ${rstr(whole.at)} = ${texOf(top)}`,
        why: T('echo.notAReadingOfThatRow'),
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// A list that multiplies.
// ---------------------------------------------------------------------------
/**
 * A growth factor, a starting amount, a percentage or a whole rule, refused by
 * running it at the readings the item prints.
 *
 * Nothing here divides one reading by another and prints the answer: the
 * cadet's own number is run FORWARD onto a printed reading, and the reading
 * refuses it.
 */
function exponentialFitProbe(item, raw, tag, T) {
  const c = item.check || {};
  const v = c.variable || 'x';

  // Two printed rules, and the position where the first passes the second.
  if (c.form === 'overtake') {
    const [ruleA, ruleB] = c.rules || [];
    const val = fromString(String(raw).trim());
    if (!ruleA || !ruleB || !val || val.d !== 1) return [];
    for (const n of [val.n, val.n - 1]) {
      let A; let B;
      try { A = evaluate(ruleA, { [v]: R(n) }); B = evaluate(ruleB, { [v]: R(n) }); } catch { continue; }
      const leads = rcmp(A, B) > 0;
      if (leads === (n === val.n)) continue;
      return [
        {
          cls: 'rf-echo-probe',
          latex: `${rstr(A)} \\qquad ${rstr(B)}`,
          why: T('echo.bothRulesAt', { v, t: n }),
        },
        {
          cls: 'rf-echo-probe verdict',
          latex: `${rstr(A)} ${leads ? '>' : '\\le'} ${rstr(B)}`,
          why: T(leads ? 'echo.alreadyAheadThere' : 'echo.notAheadYet', { v, t: n }),
        },
      ];
    }
    return [];
  }

  const pts = readingsShown(item);
  if (pts.length < 2) return [];
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[1];
  if (isZero(y0)) return [];

  // A whole rule: run it at a printed input.
  if (c.form === 'fit') {
    for (const [x, y] of pts) {
      if (x.d !== 1) continue;
      let got;
      try { got = evaluate(String(raw), { [v]: x }); } catch { return []; }
      if (reqq(got, y)) continue;
      const put = substituteVerified(String(raw), v, x);
      if (!put) continue;
      return [
        { cls: 'rf-echo-probe', latex: `${put} = ${rstr(got)}`, why: T('echo.yourRuleAtPosition', { t: rstr(x) }) },
        { cls: 'rf-echo-probe verdict', latex: `${rstr(got)} \\ne ${rstr(y)}`, why: T('echo.listReadsThere', { t: rstr(x), y: rstr(y) }) },
      ];
    }
    return [];
  }

  const val = fromString(String(raw).trim());
  if (!val) return [];
  // A factor, or a percentage, is checked forward across ONE printed step.
  if (c.form === 'factor' || c.form === 'percent') {
    const f = c.form === 'factor' ? val : add(R(1), div(val, R(100)));
    const got = mul(y0, f);
    if (reqq(got, y1)) return [];
    const shown = c.form === 'factor'
      ? `${rstr(y0)} \\cdot ${parR(f)} = ${texOf(got)}`
      : `${rstr(y0)} \\cdot \\left(1 + \\frac{${texOf(val)}}{100}\\right) = ${texOf(got)}`;
    return [
      { cls: 'rf-echo-probe', latex: shown, why: T('echo.multiplyByYourFactor') },
      { cls: 'rf-echo-probe verdict', latex: `${texOf(got)} \\ne ${rstr(y1)}`, why: T('echo.nextReadingIs', { y: rstr(y1) }) },
    ];
  }
  // A starting amount, run forward to the first printed reading.
  if (c.form === 'start') {
    if (x0.d !== 1 || x0.n < 0 || x0.n > 12) return [];
    const ratio = div(y1, y0);
    if (isZero(ratio)) return [];
    let got;
    try { got = mul(val, rpow(ratio, x0.n)); } catch { return []; }
    if (!isSafe(got) || reqq(got, y0)) return [];
    return [
      {
        cls: 'rf-echo-probe',
        latex: `${texOf(val)} \\cdot \\left(\\frac{${rstr(y1)}}{${parR(y0)}}\\right)^{${x0.n}} = ${texOf(got)}`,
        why: T('echo.runYourStartForward', { t: rstr(x0) }),
      },
      { cls: 'rf-echo-probe verdict', latex: `${texOf(got)} \\ne ${rstr(y0)}`, why: T('echo.firstReadingIs', { y: rstr(y0) }) },
    ];
  }
  return [];
}

/**
 * Which probe reads which check kind.
 *
 * A kind with no entry here is a kind whose slips are answered by the older
 * probes below — and a kind that is in neither place is the defect this table
 * was written to end, so `tools/check-echo.mjs` walks every node of every unit
 * and fails on any tagged wrong answer that comes back with the prompt
 * restated.
 */
const KIND_PROBES = {
  radical: radicalProbe,
  rationalExponent: rationalExponentProbe,
  quadratic: quadraticProbe,
  factored: expandProbe,
  vertexForm: expandProbe,
  polyQuotient: polyQuotientProbe,
  features: featuresProbe,
  sequence: sequenceProbe,
  relationPairs: relationPairsProbe,
  relatedLine: relatedLineProbe,
  halfPlane: halfPlaneProbe,
  systemWrite: systemWriteProbe,
  regression: regressionProbe,
  twoWayTable: twoWayTableProbe,
  exponentialFit: exponentialFitProbe,
};

/**
 * Build a counterexample from what the cadet actually entered.
 *
 * Every branch either computes the contradiction and returns it, or returns
 * nothing. It never guesses. The value the live rift wants is never printed.
 *
 * @returns {Array<{cls:string, latex:string, why:string}>}
 */
export function counterexample(item, entry, T) {
  const raw = padToTex(entry == null ? '' : String(entry).trim());
  if (!raw) return [];
  const v = varOf(item);
  const kind = item.check?.kind;
  // WHICH SLIP THIS IS, ON EVIDENCE ONLY.
  //
  // `./diagnose.js` answers with a misconception only when the entry is one of
  // the values this item's generator computed for it, or a structural
  // certainty. Everywhere else it answers null, and a probe that is handed null
  // simply does not use it. Nothing here ever guesses at a learner's mind: the
  // tag chooses BETWEEN computed refusals, it never manufactures one.
  let tag = null;
  try { tag = diagnose(item, raw); } catch { tag = null; }

  try {
    // --- LEVELS 4 AND 5 ----------------------------------------------------
    //
    // Eight kinds arrived with roots, brackets, curves, lists, regions and
    // fitted lines, and none of the probes below reads any of them. Each of
    // these computes the contradiction from the notation on the cadet's own
    // screen and their own entry, or returns nothing and lets the older probes
    // have their turn.
    const aimed = KIND_PROBES[kind];
    if (aimed) {
      const rows = aimed(item, raw, tag, T);
      if (rows.length) return rows;
    }

    // --- LEVEL 2: one number the two statements disagree about -------------
    //
    // A lean is a claim about a *set*, so the honest refusal is a member of
    // one set that the other refuses. The rig finds it by trial, writes it
    // into the statement on screen, and works nothing out: the arithmetic is
    // the lesson, exactly as on the beam.
    if ((kind === 'inequality' || kind === 'compound') && v && item.check.math) {
      const rows = leanProbe(item, raw, v, T);
      if (rows.length) return rows;
    }
    // --- LEVEL 2: two ratios agree only when the cross products match ------
    if (kind === 'proportion' && v) {
      const rows = proportionProbe(item, raw, v, T);
      if (rows.length) return rows;
    }
    // --- LEVEL 2: a pair of statements — one of them refuses their reading -
    if (kind === 'system' && Array.isArray(item.check.eqs)) {
      const rows = systemProbe(item, raw, T);
      if (rows.length) return rows;
    }
    // --- LEVEL 2: a rearranged formula, pinned to numbers ------------------
    if (kind === 'rearrange' && item.check.math) {
      const rows = rearrangeProbe(item, raw, T);
      if (rows.length) return rows;
    }
    // --- LEVEL 2: a rule that has to pass through the readings -------------
    if ((kind === 'line' || kind === 'lineEquation') && item.check) {
      const rows = ruleProbe(item, raw, T);
      if (rows.length) return rows;
    }

    // --- an equation with no unique answer at all --------------------------
    //
    // "No solution" and "every value works" are not values, so there is no
    // number to argue with — but there is something far better to show. A
    // contradiction differs by the same amount whatever you put in; an identity
    // agrees whatever you put in. Two substitutions make each of those visible,
    // and two substitutions is a thing a cadet can do for themselves for ever
    // after.
    // It runs whatever the cadet typed, including a number: on an identity a
    // number is not false, it is merely one of infinitely many, and being shown
    // a second one that also works is the only way to see that.
    if (kind === 'solve' && v && sides(item.latex)) {
      let shape = null;
      try { shape = solveLinear(item.latex, v).kind; } catch { shape = null; }
      /* THE THIRD SHAPE, AND WHY IT BELONGS HERE.
         A card that asks which reading of a statement is true has three
         answers, not two: no value works, every value does, and EXACTLY ONE
         does. The third one used to be unreachable — `both-sides` only ever
         wrote identities and contradictions — and when it became reachable
         this branch had nothing for it and the echo fell through to reprinting
         the prompt with "this is what the rift is asking", which is the one
         failure this whole module exists to prevent. `tools/validate-items.mjs`
         caught it on the first run: 93 items, all of them here.
         The instrument does not change. Two substitutions make a unique
         solution visible in exactly the way they make an identity visible —
         one number holds it, the next one does not — and two substitutions is
         still a thing a cadet can do for themselves for ever after. */
      const one = shape === 'unique' ? (() => { try { return solveLinear(item.latex, v).value; } catch { return null; } })() : null;
      if (shape === 'none' || shape === 'all' || (shape === 'unique' && one && one.d === 1)) {
        const eq = sides(item.latex);
        const trials = [];
        // For a unique solution the FIRST number tried is the one that works,
        // and the second is any other; for the other two shapes any two do.
        const probe = shape === 'unique' ? [one.n, one.n + 1, one.n + 2, one.n - 1] : [2, 5, 3, 4, 7];
        for (const t of probe) {
          if (trials.length === 2) break;
          const put = eq.map((s) => substituteVerified(s, v, R(t)));
          if (!put.every(Boolean)) continue;
          let got;
          try { got = eq.map((s) => evaluate(s, { [v]: R(t) })); } catch { continue; }
          const holds = shape === 'all' || (shape === 'unique' && trials.length === 0);
          trials.push({ t, tex: `${rstr(got[0])} ${holds ? '=' : '\\ne'} ${rstr(got[1])}`, put, holds });
        }
        if (trials.length === 2) {
          return [
            {
              cls: 'rf-echo-probe',
              latex: `${trials[0].put[0]} \\;\\;${trials[0].holds ? '=' : '\\ne'}\\;\\; ${trials[0].put[1]}`,
              why: T(shape === 'none' ? 'echo.tryOneNumber' : 'echo.tryOneNumberHolds', { v, t: trials[0].t }),
            },
            {
              cls: 'rf-echo-probe verdict',
              latex: `${trials[1].tex} \\qquad \\left(${v} = ${trials[1].t}\\right)`,
              // Both of these sentences are written about the unknown by name,
              // and for as long as this call passed no name a cadet read the
              // literal characters "${v}$" on the card.
              why: T(shape === 'none' ? 'echo.gapNeverCloses'
                : shape === 'all' ? 'echo.holdsEverywhere' : 'echo.onlyThisOneHolds', { v, t: trials[0].t }),
            },
          ];
        }
      }
    }

    // --- a chart is a log you can see --------------------------------------
    //
    // A straight trace climbs at one rate along its whole length, so the point
    // a cadet hands in either sits on that rate or it does not, and the check
    // is two fractions written side by side. Left unworked, as ever: the
    // arithmetic is the lesson.
    if (kind === 'graph' && Array.isArray(item.check.points) && item.check.points.length >= 2) {
      const val = fromString(raw);
      const [p, q] = item.check.points;
      if (val && val.d === 1) {
        const mine = item.check.mode === 'x' ? [val.n, item.check.at] : [item.check.at, val.n];
        const frac = (A, B) => (A[0] === B[0] ? null
          : `\\frac{${B[1]} - ${par(A[1])}}{${B[0]} - ${par(A[0])}}`);
        const rate = (A, B) => (A[0] === B[0] ? null : (B[1] - A[1]) / (B[0] - A[0]));
        const known = frac(p, q);
        const ours = frac(p, mine) || frac(q, mine);
        const oursRate = rate(p, mine) ?? rate(q, mine);
        if (known && ours && Math.abs(oursRate - rate(p, q)) > 1e-9) {
          return [
            { cls: 'rf-echo-probe', latex: known, why: T('echo.traceOneRate') },
            { cls: 'rf-echo-probe verdict', latex: ours, why: T('echo.yourPointBreaksIt') },
          ];
        }
      }
    }

    // --- solving: put the proposed value back on the beam ------------------
    if (kind === 'solve' && v) {
      const val = fromString(raw);
      const eq = sides(item.latex);
      if (val && eq) {
        const got = eq.map((s) => evaluate(s, { [v]: val }));
        if (!reqq(got[0], got[1])) {
          // Only a side that actually contains the unknown is worth rewriting;
          // printing "18 = 18" beside it teaches nothing.
          const shown = eq.map((s, i) => {
            if (!varsOf(s).includes(v)) return null;
            const put = substituteVerified(s, v, val);
            return put ? `${put} = ${rstr(got[i])}` : null;
          });
          if (!shown.some(Boolean)) return [];
          const rows = [
            {
              cls: 'rf-echo-probe',
              latex: shown.filter(Boolean).join(' \\qquad '),
              why: T('echo.substituteYours', { v, val: rstr(val) }),
            },
            {
              cls: 'rf-echo-probe verdict',
              latex: `${rstr(got[0])} \\ne ${rstr(got[1])}`,
              why: T('echo.sidesDisagree'),
            },
          ];
          // Which way it tipped is a fact, and it is the fact that tells them
          // what to do next. A linear beam is monotone in the unknown, so the
          // sign of the mismatch against the sign of the coefficient settles
          // whether they aimed high or low — without naming the value.
          const lin = slopeOf(item.latex, v);
          if (lin && !isZero(lin.a)) {
            const gap = sub(got[0], got[1]);
            const high = (toNum(gap) > 0) === (toNum(lin.a) > 0);
            rows.push({
              cls: 'rf-echo-probe aim',
              latex: `${v} ${high ? '<' : '>'} ${texOf(val)}`,
              why: T(high ? 'echo.aimedHigh' : 'echo.aimedLow', { v, val: rstr(val) }),
            });
          }
          return rows;
        }
      }
    }

    // --- evaluating: the statement itself refuses their number -------------
    if (kind === 'evaluate' && item.check.math) {
      const val = fromString(raw);
      const env = item.check.env || {};
      if (val) {
        const got = evaluate(item.check.math, env);
        if (!reqq(got, val)) {
          const bound = Object.fromEntries(Object.entries(env).map(([n, x]) => [n, typeof x === 'number' ? R(x) : x]));
          const put = substituteAll(item.check.math, bound);
          const rows = [];
          if (put) {
            rows.push({
              cls: 'rf-echo-probe verdict',
              latex: `${put} \\ne ${rstr(val)}`,
              why: T('echo.notThatNumber', { val: rstr(val) }),
            });
          }

          // The oldest slip on the graph: the number beside the letter read as
          // a digit rather than a multiplier, so 2 and 11 come back as 211.
          // Nothing to compute — just the two readings written out, one of
          // which is a product and one of which is a two-digit number.
          const onScreen = [
            ...(String(item.check.math).match(/\d+/g) || []),
            ...Object.values(bound).map((x) => rstr(x)),
          ];
          const jx = juxtaposedDigits(raw, [...new Set(onScreen)]);
          if (jx) {
            rows.push({
              cls: 'rf-echo-probe',
              latex: `${jx.a} \\cdot ${jx.b} \\ne ${jx.a}${jx.b}`,
              why: T('echo.sideBySideIsNotTimes', { a: jx.a, b: jx.b }),
            });
            return rows;
          }

          // A minus that was read as belonging to the base.
          const nb = negativeBaseRead(item.check.math, bound, val);
          if (nb) {
            rows.push({ cls: 'rf-echo-probe', latex: nb.tex, why: T('echo.minusOutsideThePower') });
            return rows;
          }

          // A power read as a repeated multiplication of base by exponent. The
          // answer to that is the notation spelled out, and nothing else.
          const pw = powerAsCopies(item.check.math, bound, val);
          if (pw) {
            rows.push({
              cls: 'rf-echo-probe',
              latex: pw.tex,
              why: T('echo.powerIsCopies', { base: pw.base, k: pw.k }),
            });
            return rows;
          }

          // Straight left to right. If that reading reproduces their number
          // exactly, the brackets they were reading are drawn in for them —
          // which is a far better answer than being told about precedence.
          const ltr = leftToRightTex(item.check.math);
          if (ltr) {
            let same = false;
            try { same = reqq(evaluate(ltr, bound), val); } catch { same = false; }
            if (same) {
              rows.push({
                cls: 'rf-echo-probe',
                latex: `${ltr} = ${rstr(val)}`,
                why: T('echo.bracketsYouAdded'),
              });
              return rows;
            }
          }

          // Otherwise: their number is the reading this expression gives at
          // some other input. Naming that input is the teacher's move — it
          // takes the answer seriously instead of only refusing it.
          if (bound[v] !== undefined) {
            const need = inputThatGives(item.check.math, v, val, bound);
            if (need && !reqq(need, bound[v])) {
              rows.push({
                cls: 'rf-echo-probe',
                latex: `${holdOthers(item.check.math, v, bound)} = ${texOf(val)} \\;\\Rightarrow\\; ${v} = ${texOf(need)}`,
                why: T('echo.yoursNeeds', { v, need: rstr(need), val: rstr(bound[v]) }),
              });
            }
          }
          if (rows.length) return rows;
        }
      }
    }

    // --- a reading of a situation: try their reading on a real number ------
    //
    // EVERY LETTER GETS A NUMBER, not only the one the item is "about".
    //
    // This bound `v` alone, so a second letter left `evaluate` with an unbound
    // name, which throws, which broke the loop — and the whole probe was lost.
    // Every wrong entry on such an item then fell through to the last resort,
    // which reprints the prompt: the cadet pressed for help and was handed back
    // the question. That was invisible while Level 1 was single-unknown
    // throughout, and it is not any more — the sorting bays draw boards of
    // several unlike variable parts, because two bays that are "carries a
    // letter" and "carries no letter" are a glyph match and not a question
    // about like terms.
    //
    // The held letters are written into the SENTENCE as well as the notation,
    // and they need no new string in any locale: the binding lives inside the
    // mathematics span the line already has, so "Take $m = 3$" becomes
    // "Take $m = 3,\; y = 4$" and reads correctly in en, es and pl.
    if ((kind === 'equivalent' || item.type === 'expression') && v) {
      const target = item.check?.math || item.answer;
      const letters = [...new Set([...varsOf(raw), ...varsOf(target)])];
      const others = letters.filter((x) => x !== v);
      const truth = promptTruth(item, v, new Set(letters));
      for (const t of [3, 4, 5, 2, 6, 7]) {
        // Distinct from `t` and from each other, so two letters can never
        // stand in for one another and make two different lines agree.
        const env = { [v]: t };
        let clash = false;
        others.forEach((name, k) => {
          const pool = [2, 5, 7, 4, 9, 6, 8, 3].filter((n) => n !== t && !Object.values(env).includes(n));
          if (!pool.length) clash = true; else env[name] = pool[k % pool.length];
        });
        if (clash) break;
        let mine, theirs;
        try { mine = evaluate(raw, env); } catch { break; }
        try { theirs = evaluate(target, env); } catch { break; }
        if (reqq(mine, theirs)) continue;
        // The statement the rift is holding open, with a number in it. It is
        // already on the learner's screen, so nothing is given away by writing
        // it out — and the arithmetic that settles the argument is theirs.
        const put = truth ? substituteAll(truth, Object.fromEntries(letters.map((n) => [n, R(env[n])]))) : null;
        // Everything up to the last `=`, and the value after it: the two slots
        // `echo.yourReadingAt` already has, filled so that one letter reads
        // exactly as it always did.
        const bind = letters.map((n) => `${n} = ${env[n]}`).join(',\\; ');
        const head = bind.slice(0, bind.lastIndexOf(' = '));
        const tail = env[letters[letters.length - 1]];
        return [
          {
            cls: 'rf-echo-probe',
            latex: `\\left. ${raw} \\right|_{${bind}} = ${rstr(mine)}`,
            why: T('echo.yourReadingAt', { v: head, t: tail, val: rstr(mine) }),
          },
          {
            cls: 'rf-echo-probe verdict',
            latex: put ? `${put} \\ne ${rstr(mine)}` : `\\left. ${BOX} \\right|_{${bind}} \\ne ${rstr(mine)}`,
            why: T('echo.countItByHand', { v: head, t: tail, val: rstr(mine) }),
          },
        ];
      }
    }

    // --- a burned row of a log ---------------------------------------------
    //
    // One rule made every line of the log, so between any two lines the reading
    // climbs at the same rate. That is the whole content of a linear table, and
    // it is checkable by hand from what is already on screen. The probe writes
    // the rate between each surviving pair of rows, and the rate their number
    // would imply, as unevaluated fractions — deliberately unevaluated, because
    // the arithmetic that settles it is the arithmetic worth doing.
    if (kind === 'table') {
      const val = fromString(raw);
      // A LOG IS READ OFF THE SCREEN WHEN NOTHING ELSE DESCRIBES IT.
      //
      // Level 1 tables hand the verifier their own rows. Level 3 tables do not:
      // their descriptor is `{ kind: 'table' }` and nothing else, so this whole
      // branch used to be skipped and three skills — function notation, domain
      // and range, and telling a list that adds from a list that multiplies —
      // answered a quarter of their tagged slips by reprinting the question.
      // The rows are printed on the card, which is the better source anyway:
      // what the probe argues about is then provably what the cadet is looking
      // at, and not a private copy of it.
      const read = tableSource(item);
      const src = read.rows;
      const miss = read.miss;
      if (!src.length || miss < 0) return [];
      // Which cell burned. A descriptor may say so outright; a table that hands
      // the verifier a "?" in the input column has already said so, and reading
      // it off the rows is what stops an input-gap table from falling through
      // every probe below and being answered with the question restated.
      const solvingForX = read.solveFor === 'x' || String(src[miss]?.[0]) === '?';
      const known = src.filter((row, i) => i !== miss && row.every((cell) => cell !== '?')).map((row) => [Number(row[0]), Number(row[1])]);

      // The rule is written at the head of the column, in full, where the cadet
      // can see it. When the burned cell is an *input*, running their number
      // through that rule is the whole check — and it never touches the value
      // the line actually wants.
      if (val && solvingForX && src[miss]) {
        const rule = headerRule(item.latex);
        if (rule) {
          const put = substituteVerified(rule.tex, rule.v, val);
          let got = null;
          try { got = evaluate(rule.tex, { [rule.v]: val }); } catch { got = null; }
          if (put && got && !reqq(got, R(src[miss][1]))) {
            return [
              { cls: 'rf-echo-probe', latex: put, why: T('echo.runItThroughTheRule', { val: rstr(val) }) },
              {
                cls: 'rf-echo-probe verdict',
                latex: `${rstr(got)} \\ne ${src[miss][1]}`,
                why: T('echo.ruleRefusesYours', { y: src[miss][1] }),
              },
            ];
          }
        }
      }

      if (val && val.d === 1 && src.length >= 3 && src[miss] && known.length >= 2) {
        const mine = src.map((row, i) => (i === miss
          ? (solvingForX ? [val.n, Number(row[1])] : [Number(row[0]), val.n])
          : [Number(row[0]), Number(row[1])]));

        // Their number repeats a reading the log already gives at another
        // input, on a log that plainly does not stand still.
        const twin = src.findIndex((row, i) => i !== miss && Number(solvingForX ? row[0] : row[1]) === val.n);
        const flat = solvingForX
          ? known.every((row) => row[0] === known[0][0])
          : known.every((row) => row[1] === known[0][1]);
        if (twin >= 0 && !flat) {
          const col = solvingForX ? 0 : 1;
          const other = solvingForX ? 1 : 0;
          return [{
            cls: 'rf-echo-probe verdict',
            latex: `${src[twin][other]} \\;\\to\\; ${src[twin][col]} \\qquad ${mine[miss][other]} \\;\\to\\; ${mine[miss][col]}`,
            why: T(solvingForX ? 'echo.sameOutputTwice' : 'echo.sameInputTwice'),
          }];
        }

        const rate = (rows, i) => {
          const dx = rows[i + 1][0] - rows[i][0];
          const dy = rows[i + 1][1] - rows[i][1];
          if (!dx) return null;
          return { tex: `\\frac{${rows[i + 1][1]} - ${par(rows[i][1])}}{${rows[i + 1][0]} - ${par(rows[i][0])}}`, q: dy / dx };
        };
        const truth = known.slice(0, -1).map((_, i) => rate(known, i));
        const ours = mine.slice(0, -1).map((_, i) => rate(mine, i));
        if (truth.every(Boolean) && ours.every(Boolean)
          && truth.every((g) => Math.abs(g.q - truth[0].q) < 1e-9)
          && ours.some((g) => Math.abs(g.q - truth[0].q) > 1e-9)) {
          const clean = truth.slice(0, Math.max(1, truth.length - 1));
          const dirty = ours.filter((_, i) => i === miss || i === miss - 1);
          return [
            {
              cls: 'rf-echo-probe',
              latex: clean.map((g) => g.tex).join(' \\qquad '),
              why: T('echo.everyPairSameRate'),
            },
            {
              cls: 'rf-echo-probe verdict',
              latex: dirty.map((g) => g.tex).join(' \\qquad '),
              why: T('echo.yourRateBreaksIt'),
            },
          ];
        }
      }
    }

    // --- a chosen equation: solve theirs and read the number back ----------
    //
    // A model is not wrong the way arithmetic is wrong. It is wrong about the
    // world, and the only way to see that is to follow it to the number it
    // names and hold that number up against the story. So the echo does the
    // following: it solves the equation the cadet signed.
    if (kind === 'equationChoice' && v) {
      const mine = varsOf(raw).length === 1 ? raw : null;
      if (mine) {
        let named = null;
        try {
          const sol = solveLinear(mine, v);
          if (sol.kind === 'unique') named = rstr(sol.value);
        } catch { named = null; }
        if (named) {
          return [
            { cls: 'rf-echo-probe', latex: mine, why: T('echo.yourModelSays', { v }) },
            {
              cls: 'rf-echo-probe verdict',
              latex: `${v} = ${named}`,
              why: T('echo.yourModelNames', { v, val: named }),
            },
          ];
        }
        return [{ cls: 'rf-echo-probe verdict', latex: mine, why: T('echo.yourModelSays', { v }) }];
      }
    }
  } catch { /* a probe we cannot compute is a probe we do not show */ }

  return [];
}

/**
 * The rule that governs every rewrite: an expression may be rewritten, but not
 * changed.
 *
 * When a cadet is rearranging notation — collecting terms, opening a bracket,
 * pulling a factor out — there is often no numeric entry to argue with, only a
 * chip in the wrong bay. The honest answer is not the rule they broke, it is
 * the test that would have caught them: put a number in, and whatever you write
 * has to come to what this comes to.
 *
 * The substituted expression is printed *unevaluated* on purpose. Working it
 * out is the work, and handing over the total would hand over the test.
 *
 * @returns {Array<{cls:string, latex:string, why:string}>}
 */
export function invarianceProbe(item, T) {
  const v = varOf(item);
  const src = item?.check?.math || item?.latex;
  // The probe is about an EXPRESSION being rewritten. Anything carrying a
  // relation — an equals sign, a lean, a band — is a statement, and "put a
  // number in and it must still come to this" is not what it asserts. The
  // parser refuses those symbols outright, so the guard has to name them.
  if (!v || !src || /\\square|\\begin|\\Rightarrow|=|<|>|\\le(?![a-zA-Z])|\\ge(?![a-zA-Z])/.test(String(src))) return [];
  let vars;
  try { vars = varsOf(src); } catch { return []; }
  if (!vars.includes(v)) return [];
  const onScreen = new Set(String(item.latex).match(/\d+/g) || []);
  for (const t of [3, 4, 5, 2, 6, 10, 7]) {
    if (onScreen.has(String(t))) continue;
    const put = substituteVerified(src, v, R(t));
    if (!put) continue;
    try { evaluate(put, {}); } catch { continue; }
    return [{
      cls: 'rf-echo-probe verdict',
      latex: put,
      why: T('echo.mustAgreeAt', { v, t }),
    }];
  }
  return [];
}

/**
 * A move on the beam that was legal but got nowhere, or illegal and quietly
 * changed the question.
 *
 * The surface hands us the statement the cadet's move left standing. Comparing
 * it with the statement they started from is a fact, not an opinion: either the
 * two are about the same number or they are not, and either way there is a real
 * sentence to say about it.
 *
 * @returns {Array<{cls:string, latex:string, why:string}>}
 */
export function stateProbe(item, stateTex, T, fallbackKey) {
  const v = varOf(item);
  const say = (why, latex = stateTex) => [{ cls: 'rf-echo-probe verdict', latex, why }];
  if (!v || !stateTex || !sides(stateTex)) return say(T(fallbackKey || 'echo.whereItStands'));

  // A move made while *rewriting* an expression asserts an identity: "3x + 5"
  // and "8x" are the same thing. An identity is refuted by one number, and one
  // number is what the cadet gets — chosen, substituted and evaluated here so
  // that nothing is claimed the rig has not just watched come apart.
  if (!sides(item?.latex || '')) {
    const two = sides(stateTex);
    for (const t of [2, 3, 4, 5, 6]) {
      let l, rr;
      try { l = evaluate(two[0], { [v]: R(t) }); rr = evaluate(two[1], { [v]: R(t) }); } catch { break; }
      if (reqq(l, rr)) continue;
      const put = two.map((s) => substituteVerified(s, v, R(t)));
      return [
        { cls: 'rf-echo-probe', latex: stateTex, why: T(fallbackKey || 'echo.thatMergeSays') },
        {
          cls: 'rf-echo-probe verdict',
          latex: put.every(Boolean) ? `${put[0]} \\ne ${put[1]}` : `${rstr(l)} \\ne ${rstr(rr)}`,
          why: T('echo.oneNumberBreaksIt', { v, t }),
        },
      ];
    }
    return say(T(fallbackKey || 'echo.whereItStands'));
  }
  let was, now;
  try { was = solveLinear(item.latex, v); now = solveLinear(stateTex, v); } catch { return say(T(fallbackKey || 'echo.whereItStands')); }

  // The move changed which number the beam is about. That is provable: take the
  // number the new line names, put it back into the tear as it was given, and
  // watch the pans come apart.
  if (was.kind === 'unique' && now.kind === 'unique' && !reqq(was.value, now.value)) {
    const eq = sides(item.latex);
    const got = eq.map((s) => { try { return evaluate(s, { [v]: now.value }); } catch { return null; } });
    if (got.every(Boolean) && !reqq(got[0], got[1])) {
      const shown = eq.map((s, i) => {
        if (!varsOf(s).includes(v)) return null;
        const put = substituteVerified(s, v, now.value);
        return put ? `${put} = ${rstr(got[i])}` : null;
      }).filter(Boolean);
      return [
        { cls: 'rf-echo-probe', latex: stateTex, why: T('echo.moveNames', { v, val: rstr(now.value) }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: shown.length ? shown.join(' \\qquad ') : `${rstr(got[0])} \\ne ${rstr(got[1])}`,
          why: T('echo.moveChangedIt'),
        },
      ];
    }
    return say(T('echo.moveChangedIt'));
  }

  // The move was legal. It simply did not get anywhere, and the useful thing to
  // say is what is still standing in the way — counted, not gestured at.
  const blk = whatBlocks(stateTex, v);
  if (blk) {
    if (blk.bothSides) return say(T('echo.stillBothSides', { v }));
    if (blk.coef && blk.konst) return say(T('echo.stillTwoThings', { v }));
    if (blk.coef) return say(T('echo.stillMultiplied', { v, a: rstr(blk.a) }));
    if (blk.konst) return say(T('echo.stillAdded', { v }));
  }
  return say(T(fallbackKey || 'echo.whereItStands'));
}

// ---------------------------------------------------------------------------
// Layers two to four: a worked trace, faded.
// ---------------------------------------------------------------------------
/** LHS shown, RHS burned to a box — a completion problem, not a blank. */
function openTex(latex) {
  if (/\\Rightarrow/.test(latex)) return latex.replace(/\\Rightarrow[\s\S]*$/, `\\Rightarrow ${BOX}`);
  const i = String(latex).indexOf('=');
  if (i < 0) return HIDDEN;
  return `${latex.slice(0, i).trim()} = ${BOX}`;
}

/**
 * The rows of a worked trace at a given depth.
 *
 * @param {Array<{latex:string, why:string}>} steps
 * @param {number} tier 2..4
 * @param {boolean} live true when this is the learner's own item (no analogue
 *        was available), in which case the landing line is never given away.
 */
function tracedRows(steps, tier, live) {
  const n = steps.length;
  const rows = [];
  const last = n - 1;
  for (let i = 0; i < n; i++) {
    const s = steps[i];
    let level;
    if (live) {
      // The cadet's own tear, shown only when the bank held no other rift of
      // this shape. Every line is opened rather than printed: the left-hand
      // side and the reason, with the value boxed. A trace of the LIVE item
      // printed in full is the one scaffold that is guaranteed to contain the
      // live answer — on a rule written from a table, the first worked line is
      // the rate, and the rate is half the answer. Opened, the same line is a
      // completion problem, which is what the ladder is for.
      if (i < last) level = tier >= 3 ? 'open' : (i === 0 ? 'open' : 'hidden');
      else level = tier >= 4 ? 'open' : 'hidden';
    } else if (tier === 2) {
      level = i === 0 ? 'full' : 'open';
    } else {
      level = 'full';
    }
    rows.push({
      cls: 'rf-echo-step' + (level === 'full' ? '' : level === 'open' ? ' masked' : ' burned'),
      latex: level === 'full' ? s.latex : level === 'open' ? openTex(s.latex) : HIDDEN,
      why: s.why,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The whole script for one depth.
// ---------------------------------------------------------------------------
/**
 * @param {object} o
 * @param {object} o.item      the live item
 * @param {object|null} o.analogue a verified worked analogue (see scaffold.js)
 * @param {string|null} o.entry what the learner actually entered
 * @param {number} o.tier      1..4
 * @param {string} o.locale
 * @returns {{rows:Array, sealed:string|null}}
 */
export function echoScript({
  item, analogue = null, entry = null, tier = 1, locale = 'en',
  state = null, stateKey = 'echo.whereItStands',
}) {
  const T = makeT(locale);
  const rows = [];

  // ---- layer 1: aimed at the entry, and carrying real notation -----------
  // On the beam, on the bays and on the field, what the cadet "entered" is a
  // move rather than a value, and the honest thing to read back to them is the
  // statement their move left standing.
  const probe = counterexample(item, entry, T);
  if (probe.length) rows.push(...probe);
  else if (state) rows.push(...stateProbe(item, state, T, stateKey));
  else {
    // No value to argue with and no move to read back. There is still one
    // thing to say that is mathematics rather than a restatement of the
    // question: whatever you write in its place has to agree with it.
    const inv = invarianceProbe(item, T);
    if (inv.length) rows.push(...inv);
    else if (item?.latex) rows.push({ cls: 'rf-echo-probe', latex: item.latex, why: T('echo.theTear') });
  }
  if (tier <= 1) return { rows, sealed: null };

  // ---- layers 2-4: a trace, faded --------------------------------------
  const ex = analogue && analogue.steps?.length ? analogue : null;
  const steps = (ex ? ex.steps : item?.steps) || [];
  if (!steps.length) return { rows, sealed: null };
  const live = !ex;

  rows.push({ rule: true });
  rows.push({
    cls: 'rf-echo-lead alt',
    text: live ? T('echo.ownTraceOnly') : T('echo.differentTear'),
  });
  let shown = steps;
  if (ex) {
    // A "which reading is it?" tear carries no notation of its own — only a
    // gap — so the situation itself is the seed.
    const bare = !ex.latex || /^\s*(\\square|\\;|\\,|\s)+$/.test(ex.latex);
    if (bare) rows.push({ cls: 'rf-echo-step seed prose', text: ex.stem || T('echo.theTear') });
    else rows.push({ cls: 'rf-echo-step seed', latex: ex.latex, why: ex.stem || T('echo.theTear') });
    // Some forms open by restating the prompt. Printing it twice, once as the
    // tear and once as the first move, wastes the rung.
    if (!bare && shown.length > 2 && shown[0].latex.replace(/\s+/g, '') === ex.latex.replace(/\s+/g, '')) {
      shown = shown.slice(1);
    }
  }
  rows.push(...tracedRows(shown, tier, live));

  if (!live) {
    rows.push({
      cls: 'rf-echo-step landing' + (tier >= 4 ? '' : ' burned'),
      latex: tier >= 4 ? String(ex.answer) : HIDDEN,
      why: tier >= 4 ? T('echo.landsAt') : T('echo.landingBurned'),
    });
  }
  return { rows, sealed: !live && tier >= 4 ? String(ex.answer) : null };
}

/**
 * Do the four depths actually differ?  Used by tools/validate-items.mjs: a
 * ladder whose rungs render the same thing is a dead scaffold, and that is the
 * exact failure this module exists to prevent.
 */
export function ladderOf(item, analogue, entry, locale = 'en') {
  const out = [];
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const { rows } = echoScript({ item, analogue, entry, tier, locale });
    out.push(rows.map((r) => (r.rule ? '—' : `${r.cls}|${r.latex || ''}|${r.why || r.text || ''}`)).join('\n'));
  }
  return out;
}

/**
 * The notation of the *trace* at full depth — the worked lines only.
 *
 * The counterexample is deliberately excluded: it is assembled out of the
 * statement already on the learner's screen and the value they themselves just
 * entered, so digits it shares with the live answer are not something the
 * learner could have copied from anywhere. The trace is the part that must
 * stay clean, and the gate measures it here.
 */
export function ladderNotation(item, analogue, entry, locale = 'en') {
  const { rows } = echoScript({ item, analogue, entry, tier: MAX_TIER, locale });
  return rows.filter((r) => r.latex && !/rf-echo-probe/.test(r.cls || '')).map((r) => r.latex);
}
