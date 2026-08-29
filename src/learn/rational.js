/**
 * Exact rational arithmetic.
 *
 * Every answer in this game is checked exactly. Floating point is never allowed
 * to decide whether a learner was right: 0.1 + 0.2 is a bad thing to build a
 * mastery model on.
 */

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }

export function R(n, d = 1) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) throw new Error('bad rational');
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    // Only ever reached if a caller hands us a float; convert exactly via powers of ten.
    let s = 1;
    while (!Number.isInteger(n) || !Number.isInteger(d)) { n *= 10; d *= 10; s *= 10; if (s > 1e9) throw new Error('irrational input'); }
  }
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export const isR = (x) => x && typeof x === 'object' && typeof x.n === 'number' && typeof x.d === 'number';

export const add = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => R(a.n * b.n, a.d * b.d);
export const div = (a, b) => { if (b.n === 0) throw new Error('division by zero'); return R(a.n * b.d, a.d * b.n); };
export const neg = (a) => R(-a.n, a.d);
export const eq = (a, b) => a.n === b.n && a.d === b.d;
export const isZero = (a) => a.n === 0;
export const isInt = (a) => a.d === 1;
export const toNum = (a) => a.n / a.d;

/**
 * Order two exact rationals. Cross-multiplying keeps the comparison in whole
 * numbers, so nothing here is decided by a decimal. Denominators are always
 * positive after `R()`, so the cross-multiplication does not turn the sign.
 */
export const cmp = (a, b) => { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; };

/** -1, 0 or 1. */
export const sign = (a) => (a.n < 0 ? -1 : a.n > 0 ? 1 : 0);

/**
 * Is this value still held EXACTLY?
 *
 * Every operation above multiplies numerators and denominators, and a
 * JavaScript number stops being able to hold a whole number exactly above
 * 2^53. Past that point arithmetic silently rounds and an "exact" checker is
 * quietly deciding on approximations. Long chains — a least-squares fit over a
 * table of readings, say — must ask this and refuse rather than round.
 */
export const isSafe = (a) => Number.isSafeInteger(a.n) && Number.isSafeInteger(a.d);

export function pow(a, k) {
  if (!Number.isInteger(k)) throw new Error('non-integer exponent');
  if (k < 0) return pow(div(R(1), a), -k);
  let out = R(1);
  for (let i = 0; i < k; i++) out = mul(out, a);
  return out;
}

/** Canonical string: "5", "-5", "3/4", "-3/4". This is the answer key format. */
export function str(a) { return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`; }

/** Parse the canonical string form back to a rational. */
export function fromString(s) {
  const m = String(s).trim().match(/^(-?\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  return R(Number(m[1]), m[2] ? Number(m[2]) : 1);
}

/** Render a rational as strict KaTeX. */
export function texOf(a) {
  if (a.d === 1) return String(a.n);
  return a.n < 0 ? `-\\frac{${-a.n}}{${a.d}}` : `\\frac{${a.n}}{${a.d}}`;
}
