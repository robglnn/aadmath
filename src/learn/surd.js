/**
 * Exact arithmetic in Q(sqrt k) — the field the quadratics strand lives in.
 *
 * WHY THIS EXISTS
 *
 * `rational.js` decides every Level 1 and Level 2 answer exactly, and that is
 * the whole reason the bank can be trusted. The quadratics strand breaks that
 * for the first time: the roots of `x^2 - 2x - 4 = 0` are `1 - \sqrt{5}` and
 * `1 + \sqrt{5}`, and neither of them is a rational number. A checker that
 * reached for `Math.sqrt` at that point would be deciding a mastery claim on a
 * float comparison, which is exactly the thing this project refuses to do.
 *
 * So the field is widened instead of the arithmetic being weakened. A value
 * here is
 *
 *     { p, q, k }   meaning   p + q * sqrt(k)
 *
 * with `p` and `q` exact rationals from `rational.js` and `k` a positive
 * SQUAREFREE integer. `k === 1` means the value is an ordinary rational, and in
 * that case `q` is folded into `p` and set to zero, so every value has exactly
 * one spelling in memory.
 *
 * Every claim this module makes is checkable by squaring back in exact integer
 * arithmetic. `simplifySqrt(72)` does not merely believe its own factoring: it
 * multiplies `6 * 6 * 2` and refuses to return unless that is 72. Comparison
 * (`sCmp`) never subtracts floats — it squares both sides and compares exact
 * integers. `toNum` exists only for error messages and for a cheap pre-filter,
 * and nothing in this file decides anything with it.
 *
 * WHAT IT REFUSES, ON PURPOSE
 *
 *   - a negative radicand              (`\sqrt{-3}` is not a real number)
 *   - a radicand that is not a whole number
 *   - a radicand that is still not squarefree after reduction
 *   - two different radicals combined:  `\sqrt{2} + \sqrt{3}` does not live in
 *     Q(sqrt 2) or in Q(sqrt 3), and a checker that silently picked one would
 *     be wrong in a way that is invisible to itself
 *   - a whole number too large to hold exactly in a JavaScript number
 *
 * A letter under a radical is refused too, but that check needs the syntax
 * tree, so it lives in `parser.js` where the tree is.
 */
import {
  R, isR, add, sub, mul, div, neg, pow, eq, isZero, cmp, isSafe, toNum as rToNum, texOf,
} from './rational.js';

// ---------------------------------------------------------------------------
// Whole-number square work. Everything here proves itself by squaring back.
// ---------------------------------------------------------------------------

/** The largest whole number this module will factor. Beyond it, refuse. */
export const MAX_RADICAND = 1e12;

function wholeAbove(n, what) {
  if (!Number.isSafeInteger(n)) throw new Error(`${what} must be a whole number`);
  if (n > MAX_RADICAND) throw new Error(`${what} ${n} is too large to factor exactly`);
  return n;
}

/**
 * The exact whole square root of `n`, or null when `n` is not a perfect square.
 * The floating-point square root only proposes a candidate; the integer
 * multiplication decides.
 */
export function isqrt(n) {
  wholeAbove(n, 'a radicand');
  if (n < 0) return null;
  if (n === 0) return 0;
  const guess = Math.round(Math.sqrt(n));
  for (let t = Math.max(0, guess - 2); t <= guess + 2; t++) {
    if (t * t === n) return t;
  }
  return null;
}

/** Is `k` free of any square factor above 1? Decided by trial division. */
export function isSquarefree(k) {
  wholeAbove(k, 'a radicand');
  if (k < 1) return false;
  for (let d = 2; d * d <= k; d++) if (k % (d * d) === 0) return false;
  return true;
}

/**
 * `sqrt(n) = m * sqrt(k)` with `k` squarefree, for a whole `n` that is not
 * negative. The factoring is never taken on its own word: `m * m * k` is
 * multiplied back out and must equal `n` exactly, or nothing is returned.
 */
export function simplifySqrt(n) {
  wholeAbove(n, 'a radicand');
  if (n < 0) throw new Error(`a radicand must not be negative, and ${n} is`);
  if (n === 0) return { m: 0, k: 1 };
  let m = 1;
  let k = n;
  for (let d = 2; d * d <= k; d++) {
    while (k % (d * d) === 0) { m *= d; k /= d * d; }
  }
  if (!Number.isSafeInteger(m * m * k) || m * m * k !== n) {
    throw new Error(`the square factor of ${n} does not multiply back`);
  }
  if (!isSquarefree(k)) throw new Error(`\\sqrt{${k}} still holds a square factor`);
  return { m, k };
}

/**
 * The exact rational square root of a rational that is not negative, or null.
 * `n/d` is a square exactly when `n` and `d` both are, because the fraction is
 * already in lowest terms.
 */
export function rationalSqrt(r) {
  if (!isR(r)) throw new Error('rationalSqrt wants an exact rational');
  if (r.n < 0) return null;
  const sn = isqrt(r.n);
  const sd = isqrt(r.d);
  if (sn === null || sd === null) return null;
  const out = R(sn, sd);
  if (!eq(mul(out, out), r)) throw new Error('a claimed rational square root does not square back');
  return out;
}

/** Is this exact rational the square of an exact rational? */
export const isPerfectSquareR = (r) => rationalSqrt(r) !== null;

// ---------------------------------------------------------------------------
// Values in Q(sqrt k)
// ---------------------------------------------------------------------------

/** Is this a value of this module? */
export const isSurd = (x) => !!x && typeof x === 'object' && isR(x.p) && isR(x.q) && typeof x.k === 'number';

/**
 * Build `p + q * sqrt(k)`, canonically. `k = 1` and `q = 0` are the same fact
 * stated twice, so both are folded into one spelling: a rational value always
 * arrives as `{ p, q: 0, k: 1 }`.
 */
export function S(p, q, k) {
  if (!isR(p) || !isR(q)) throw new Error('a surd is built from two exact rationals');
  if (!Number.isSafeInteger(k) || k < 1) throw new Error(`a radicand must be a whole number above zero, and ${k} is not`);
  if (!isSquarefree(k)) throw new Error(`\\sqrt{${k}} is not in lowest terms`);
  if (!isSafe(p) || !isSafe(q)) throw new Error('this value has grown too large to hold exactly');
  if (k === 1) return { p: add(p, q), q: R(0), k: 1 };
  if (isZero(q)) return { p, q: R(0), k: 1 };
  return { p, q, k };
}

/** An exact rational, seen as a value of this module. */
export const SR = (r) => S(isR(r) ? r : R(r), R(0), 1);

/** `sqrt(n)` for a whole `n` that is not negative, reduced. */
export function surdSqrt(n) {
  const { m, k } = simplifySqrt(n);
  return S(R(0), R(m), k);
}

export const S_ZERO = SR(R(0));
export const S_ONE = SR(R(1));

/** Is this value an ordinary rational? */
export const sIsRational = (x) => x.k === 1;
export const sIsZero = (x) => isZero(x.p) && isZero(x.q);
/** The rational part, when there is nothing else. Throws otherwise. */
export function sRational(x) {
  if (x.k !== 1) throw new Error(`${sTex(x)} is not a rational number`);
  return x.p;
}

/**
 * Which radical do these two values share? A rational value has no radical of
 * its own and joins whichever the other one carries. Two DIFFERENT radicals are
 * refused: their sum leaves the field and no honest answer can be given here.
 */
function align(x, y) {
  if (x.k === y.k) return x.k;
  if (isZero(x.q)) return y.k;
  if (isZero(y.q)) return x.k;
  throw new Error(`\\sqrt{${x.k}} and \\sqrt{${y.k}} are different radicals and cannot be combined`);
}

export const sNeg = (x) => S(neg(x.p), neg(x.q), x.k);
export const sAdd = (x, y) => S(add(x.p, y.p), add(x.q, y.q), align(x, y));
export const sSub = (x, y) => S(sub(x.p, y.p), sub(x.q, y.q), align(x, y));

/** `(p1 + q1 r)(p2 + q2 r) = p1p2 + q1q2 k + (p1q2 + q1p2) r`, with `r*r = k`. */
export function sMul(x, y) {
  const k = align(x, y);
  const p = add(mul(x.p, y.p), mul(mul(x.q, y.q), R(k)));
  const q = add(mul(x.p, y.q), mul(x.q, y.p));
  return S(p, q, k);
}

/** Division, by rationalising with the conjugate. Exact, never approximated. */
export function sDiv(x, y) {
  if (sIsZero(y)) throw new Error('division by zero');
  if (isZero(y.q)) return S(div(x.p, y.p), div(x.q, y.p), x.k);
  const k = align(x, y);
  const den = sub(mul(y.p, y.p), mul(mul(y.q, y.q), R(k)));
  if (isZero(den)) throw new Error('division by zero');
  const num = sMul(x, S(y.p, neg(y.q), k));
  return S(div(num.p, den), div(num.q, den), k);
}

/** A whole-number power. Negative powers go through `sDiv`, so still exact. */
export function sPow(x, e) {
  if (!Number.isInteger(e)) throw new Error('a surd can only be raised to a whole power');
  if (e < 0) return sDiv(S_ONE, sPow(x, -e));
  if (e > 64) throw new Error('that power is too large to work out exactly');
  let out = S_ONE;
  for (let i = 0; i < e; i++) out = sMul(out, x);
  return out;
}

export const sEq = (x, y) => x.k === y.k && eq(x.p, y.p) && eq(x.q, y.q);

/**
 * Order two values exactly. Nothing is subtracted as a decimal: where the two
 * halves pull opposite ways the comparison is settled by squaring, which turns
 * it back into a comparison of exact rationals.
 */
export function sCmp(x, y) {
  const k = align(x, y);
  const P = sub(x.p, y.p);
  const Q = sub(x.q, y.q);
  if (isZero(Q)) return cmp(P, R(0));
  if (isZero(P)) return Q.n < 0 ? -1 : 1;
  const sp = P.n < 0 ? -1 : 1;
  const sq = Q.n < 0 ? -1 : 1;
  if (sp === sq) return sp;
  // Opposite signs: P + Q*sqrt(k) has the sign of P exactly when P*P > Q*Q*k.
  const t = sub(mul(P, P), mul(mul(Q, Q), R(k)));
  return sp * cmp(t, R(0));
}

/** A decimal, for error messages and for a cheap pre-filter. Never decisive. */
export const sToNum = (x) => rToNum(x.p) + rToNum(x.q) * Math.sqrt(x.k);

// ---------------------------------------------------------------------------
// Spelling
// ---------------------------------------------------------------------------

/** `\sqrt{5}`, `3\sqrt{5}`, `\frac{3\sqrt{5}}{2}` — the radical half alone. */
function radicalTex(q, k) {
  const n = Math.abs(q.n);
  const d = q.d;
  const head = n === 1 ? '' : String(n);
  if (d === 1) return `${head}\\sqrt{${k}}`;
  return `\\frac{${head}\\sqrt{${k}}}{${d}}`;
}

/**
 * The canonical spelling: `p` then the radical, each in lowest terms.
 * `-\frac{3}{2} + \frac{\sqrt{17}}{2}`.
 */
export function sTex(x) {
  if (x.k === 1) return texOf(x.p);
  const body = radicalTex(x.q, x.k);
  if (isZero(x.p)) return x.q.n < 0 ? `-${body}` : body;
  return `${texOf(x.p)} ${x.q.n < 0 ? '-' : '+'} ${body}`;
}

/**
 * The same value written over one denominator: `\frac{-3 + \sqrt{17}}{2}`.
 * This is the spelling the quadratic formula produces, so it is admissible
 * wherever `sTex` is.
 */
export function sTexOverOne(x) {
  if (x.k === 1) return texOf(x.p);
  const d = (x.p.d * x.q.d) / gcdInt(x.p.d, x.q.d);
  if (d === 1) return sTex(x);
  const pn = x.p.n * (d / x.p.d);
  const qn = x.q.n * (d / x.q.d);
  const head = Math.abs(qn) === 1 ? '' : String(Math.abs(qn));
  const rad = `${head}\\sqrt{${x.k}}`;
  const lead = isZero(x.p) ? (qn < 0 ? `-${rad}` : rad) : `${pn} ${qn < 0 ? '-' : '+'} ${rad}`;
  return `\\frac{${lead}}{${d}}`;
}

function gcdInt(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }

/**
 * Every spelling of this value a generator may print. The set is CLOSED: an
 * answer spelled any other way is thrown out with the item, which is the safe
 * direction — a rejected item is re-drawn, and a learner never sees it.
 */
export function surdSpellings(x) {
  const out = new Set([sTex(x), sTexOverOne(x)]);
  if (x.k !== 1 && isZero(x.p) && x.q.d === 1 && Math.abs(x.q.n) === 1) {
    out.add(x.q.n < 0 ? `- \\sqrt{${x.k}}` : `\\sqrt{${x.k}}`);
  }
  return [...out];
}
