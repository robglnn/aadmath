/**
 * A small, strict parser for the LaTeX subset this game emits.
 *
 * Its whole reason to exist: **items are never trusted because of how they were
 * built.** A generator that computes an answer while assembling a prompt can be
 * wrong in exactly the way that is invisible to itself. So every item is checked
 * a second time by reading back the LaTeX that the learner will actually see,
 * parsing it, and evaluating or solving it from scratch with exact rational
 * arithmetic. If the two disagree, the item is thrown away before anyone sees it.
 *
 * Supported: integers, single-letter variables, + - unary minus, implicit and
 * explicit multiplication (\cdot, \times), division (/ and \div), \frac{}{},
 * integer exponents, \left( \right) and plain parentheses, and a single "=" for
 * equations. Everything else is a parse error, on purpose.
 *
 * Two control sequences were added for the quadratics strand and nothing else
 * was widened: `\sqrt` followed by a braced group, and `\pm`. Decimals, `_`
 * and `|` still throw, because an item that needs them is an item this checker
 * cannot prove.
 */
import { R, add, sub, mul, div, neg, pow, isZero, eq, cmp } from './rational.js';
import {
  S, SR, S_ONE, surdSqrt, sAdd, sSub, sMul, sDiv, sNeg, sPow, sCmp, sIsZero, sTex,
  isSurd, simplifySqrt, rationalSqrt,
} from './surd.js';

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------
const CMD = {
  '\\cdot': '*', '\\times': '*', '\\div': '/',
  '\\left': null, '\\right': null, '\\!': null, '\\,': null, '\\;': null, '\\ ': null,
};

export function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '\\') {
      const m = /^\\[a-zA-Z]+|^\\[!,;: ]/.exec(src.slice(i));
      if (!m) throw new Error(`bad control sequence at ${i}`);
      const cmd = m[0];
      i += cmd.length;
      if (cmd === '\\frac') { out.push({ t: 'frac' }); continue; }
      // The quadratics strand, and nothing else. A radical takes a braced
      // radicand — `\sqrt[3]{8}` throws on the "[" it cannot read — and `\pm`
      // is one operator standing for two values, expanded by `expandPm`.
      if (cmd === '\\sqrt') { out.push({ t: 'sqrt' }); continue; }
      if (cmd === '\\pm') { out.push({ t: 'pm' }); continue; }
      if (cmd === '\\text') { // skip a balanced {...} of prose
        i = skipGroup(src, i);
        continue;
      }
      if (!(cmd in CMD)) throw new Error(`unsupported command ${cmd}`);
      const mapped = CMD[cmd];
      if (mapped) out.push({ t: 'op', v: mapped });
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9]+/.exec(src.slice(i));
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) { out.push({ t: 'var', v: c }); i++; continue; }
    if ('+-*/^=(){}'.includes(c)) {
      out.push({ t: c === '(' || c === ')' || c === '{' || c === '}' ? 'delim' : (c === '=' ? 'eq' : (c === '^' ? 'pow' : 'op')), v: c });
      i++;
      continue;
    }
    throw new Error(`unexpected character "${c}"`);
  }
  return out;
}

function skipGroup(src, i) {
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '{') return i;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return i + 1; }
  }
  throw new Error('unbalanced \\text{}');
}

// ---------------------------------------------------------------------------
// Parser -> AST
// ---------------------------------------------------------------------------
class P {
  constructor(toks) { this.k = toks; this.i = 0; }
  peek(n = 0) { return this.k[this.i + n]; }
  next() { return this.k[this.i++]; }
  expect(t, v) {
    const tok = this.next();
    if (!tok || tok.t !== t || (v != null && tok.v !== v)) throw new Error(`expected ${v || t}`);
    return tok;
  }
  atEnd() { return this.i >= this.k.length; }
}

function parseExpr(p) {
  let node = parseTerm(p);
  for (;;) {
    const tok = p.peek();
    if (tok && tok.t === 'op' && (tok.v === '+' || tok.v === '-')) {
      p.next();
      node = { k: tok.v === '+' ? 'add' : 'sub', a: node, b: parseTerm(p) };
    } else if (tok && tok.t === 'pm') {
      p.next();
      node = { k: 'pm', a: node, b: parseTerm(p) };
    } else break;
  }
  return node;
}

function parseTerm(p) {
  let node = parseUnary(p);
  for (;;) {
    const tok = p.peek();
    if (tok && tok.t === 'op' && (tok.v === '*' || tok.v === '/')) {
      p.next();
      node = { k: tok.v === '*' ? 'mul' : 'div', a: node, b: parseUnary(p) };
    } else if (startsAtom(tok)) {
      // implicit multiplication: 3x, 2(x+1), x(x+1)
      node = { k: 'mul', a: node, b: parseUnary(p) };
    } else break;
  }
  return node;
}

function startsAtom(tok) {
  if (!tok) return false;
  if (tok.t === 'num' || tok.t === 'var' || tok.t === 'frac' || tok.t === 'sqrt') return true;
  if (tok.t === 'delim' && tok.v === '(') return true;
  return false;
}

function parseUnary(p) {
  const tok = p.peek();
  if (tok && tok.t === 'op' && tok.v === '-') { p.next(); return { k: 'neg', a: parseUnary(p) }; }
  if (tok && tok.t === 'op' && tok.v === '+') { p.next(); return parseUnary(p); }
  // A leading `\pm` is "nothing, plus or minus this" — exactly `0 \pm x`.
  if (tok && tok.t === 'pm') { p.next(); return { k: 'pm', a: { k: 'num', v: 0 }, b: parseUnary(p) }; }
  return parsePower(p);
}

function parsePower(p) {
  const base = parseAtom(p);
  const tok = p.peek();
  if (tok && tok.t === 'pow') {
    p.next();
    return { k: 'pow', a: base, b: parseAtomOrGroup(p) };
  }
  return base;
}

function parseAtomOrGroup(p) {
  const tok = p.peek();
  if (tok && tok.t === 'delim' && tok.v === '{') {
    p.next();
    const e = parseExpr(p);
    p.expect('delim', '}');
    return e;
  }
  return parseAtom(p);
}

function parseAtom(p) {
  const tok = p.next();
  if (!tok) throw new Error('unexpected end of expression');
  if (tok.t === 'sqrt') {
    const nx = p.peek();
    if (!nx || nx.t !== 'delim' || nx.v !== '{') throw new Error('\\sqrt needs a braced radicand');
    p.next();
    const e = parseExpr(p);
    p.expect('delim', '}');
    return { k: 'sqrt', a: e };
  }
  if (tok.t === 'num') return { k: 'num', v: tok.v };
  if (tok.t === 'var') return { k: 'var', v: tok.v };
  if (tok.t === 'frac') {
    const a = parseAtomOrGroup(p);
    const b = parseAtomOrGroup(p);
    return { k: 'div', a, b };
  }
  if (tok.t === 'delim' && tok.v === '(') {
    const e = parseExpr(p);
    p.expect('delim', ')');
    return e;
  }
  if (tok.t === 'delim' && tok.v === '{') {
    const e = parseExpr(p);
    p.expect('delim', '}');
    return e;
  }
  throw new Error(`unexpected token ${tok.v ?? tok.t}`);
}

/** Parse a LaTeX expression string into an AST. Throws on anything unsupported. */
export function parse(src) {
  const p = new P(tokenize(src));
  const e = parseExpr(p);
  if (!p.atEnd()) throw new Error('trailing input in expression');
  return e;
}

/** Parse "lhs = rhs". */
export function parseEquation(src) {
  const toks = tokenize(src);
  const at = toks.findIndex((t) => t.t === 'eq');
  if (at < 0) throw new Error('no "=" in equation');
  if (toks.slice(at + 1).some((t) => t.t === 'eq')) throw new Error('more than one "="');
  const lp = new P(toks.slice(0, at));
  const rp = new P(toks.slice(at + 1));
  const left = parseExpr(lp);
  const right = parseExpr(rp);
  if (!lp.atEnd() || !rp.atEnd()) throw new Error('trailing input in equation');
  return { left, right };
}

// ---------------------------------------------------------------------------
// Exact evaluation
// ---------------------------------------------------------------------------
export function evalAst(node, env = {}) {
  switch (node.k) {
    case 'num': return R(node.v);
    case 'var': {
      const v = env[node.v];
      if (v == null) throw new Error(`unbound variable ${node.v}`);
      return typeof v === 'number' ? R(v) : v;
    }
    case 'add': return add(evalAst(node.a, env), evalAst(node.b, env));
    case 'sub': return sub(evalAst(node.a, env), evalAst(node.b, env));
    case 'mul': return mul(evalAst(node.a, env), evalAst(node.b, env));
    case 'div': return div(evalAst(node.a, env), evalAst(node.b, env));
    case 'neg': return neg(evalAst(node.a, env));
    case 'pow': {
      const e = evalAst(node.b, env);
      if (e.d !== 1) throw new Error('non-integer exponent');
      return pow(evalAst(node.a, env), e.n);
    }
    // A radical is not a rational number and `\pm` is not one number, so
    // neither has a value here. `evalSurd` is where those two are answered.
    case 'sqrt': throw new Error('a radical is not a rational value');
    case 'pm': throw new Error('plus-or-minus stands for two values, not one');
    default: throw new Error(`bad node ${node.k}`);
  }
}

/** Evaluate a LaTeX expression string exactly. */
export function evaluate(src, env = {}) { return evalAst(parse(src), env); }

// ---------------------------------------------------------------------------
// Linear form  a*x + b  — the machinery that lets us *solve* rather than check
// ---------------------------------------------------------------------------
const LIN = (a, b) => ({ a, b });

export function linearize(node, v) {
  switch (node.k) {
    case 'num': return LIN(R(0), R(node.v));
    case 'var': return node.v === v ? LIN(R(1), R(0)) : (() => { throw new Error(`free variable ${node.v}`); })();
    case 'add': { const x = linearize(node.a, v), y = linearize(node.b, v); return LIN(add(x.a, y.a), add(x.b, y.b)); }
    case 'sub': { const x = linearize(node.a, v), y = linearize(node.b, v); return LIN(sub(x.a, y.a), sub(x.b, y.b)); }
    case 'neg': { const x = linearize(node.a, v); return LIN(neg(x.a), neg(x.b)); }
    case 'mul': {
      const x = linearize(node.a, v), y = linearize(node.b, v);
      if (!isZero(x.a) && !isZero(y.a)) throw new Error('not linear');
      if (isZero(x.a)) return LIN(mul(x.b, y.a), mul(x.b, y.b));
      return LIN(mul(y.b, x.a), mul(y.b, x.b));
    }
    case 'div': {
      const x = linearize(node.a, v), y = linearize(node.b, v);
      if (!isZero(y.a)) throw new Error('variable in denominator');
      return LIN(div(x.a, y.b), div(x.b, y.b));
    }
    case 'pow': {
      const e = linearize(node.b, v);
      if (!isZero(e.a) || e.b.d !== 1) throw new Error('bad exponent');
      const k = e.b.n;
      const base = linearize(node.a, v);
      if (isZero(base.a)) return LIN(R(0), pow(base.b, k));
      if (k === 1) return base;
      throw new Error('not linear');
    }
    case 'sqrt': throw new Error('not linear');
    case 'pm': throw new Error('plus-or-minus stands for two values, not one');
    default: throw new Error(`bad node ${node.k}`);
  }
}

/**
 * Solve a linear equation given as LaTeX. Returns one of
 *   { kind: 'unique', value: Rational }
 *   { kind: 'none' }        (contradiction: 0 = 5)
 *   { kind: 'all' }         (identity: 0 = 0)
 */
export function solveLinear(src, v) {
  const { left, right } = parseEquation(src);
  const L = linearize(left, v), Rt = linearize(right, v);
  const a = sub(L.a, Rt.a);
  const b = sub(L.b, Rt.b);
  if (isZero(a)) return isZero(b) ? { kind: 'all' } : { kind: 'none' };
  return { kind: 'unique', value: div(neg(b), a) };
}

// ---------------------------------------------------------------------------
// Syntax-tree questions the checkers ask
//
// These read the SHAPE of what the learner is shown. A shape question is not a
// value question: "is there a letter under this radical" and "is there a
// radical in this denominator" cannot be answered by evaluating anything, and
// both decide whether an item is admissible at all.
// ---------------------------------------------------------------------------

/** Every child node, in order. */
function kidsOf(node) {
  const out = [];
  for (const f of ['a', 'b']) if (node[f] && typeof node[f] === 'object') out.push(node[f]);
  return out;
}

/** Walk the whole tree, deepest last. */
export function walkAst(node, fn) {
  fn(node);
  for (const kid of kidsOf(node)) walkAst(kid, fn);
}

/** Does any letter appear anywhere in here? A named one, or any at all. */
export function mentionsVar(node, v = null) {
  let found = false;
  walkAst(node, (n) => { if (n.k === 'var' && (v === null || n.v === v)) found = true; });
  return found;
}

/** How many `\pm` are in here? More than one is two questions at once. */
export function countPm(node) {
  let n = 0;
  walkAst(node, (x) => { if (x.k === 'pm') n++; });
  return n;
}

/** Is there a radical anywhere in here? */
export function containsSqrt(node) {
  let found = false;
  walkAst(node, (n) => { if (n.k === 'sqrt') found = true; });
  return found;
}

/**
 * Is a radical sitting in a denominator? An answer like `\frac{1}{\sqrt{2}}`
 * is a correct value written in a form the strand exists to teach away from,
 * so it is refused rather than credited.
 */
export function radicalInDenominator(node) {
  let found = false;
  walkAst(node, (n) => { if (n.k === 'div' && containsSqrt(n.b)) found = true; });
  return found;
}

/**
 * Every radicand in here as an exact whole number, in the order they are
 * written. A radicand that is not a plain whole number arrives as null, so the
 * caller can name that as the fault rather than crash on it.
 */
export function radicandsOf(node) {
  const out = [];
  walkAst(node, (n) => {
    if (n.k !== 'sqrt') return;
    if (mentionsVar(n.a)) { out.push(null); return; }
    let r;
    try { r = evalAst(n.a, {}); } catch { out.push(null); return; }
    out.push(r.d === 1 ? r.n : null);
  });
  return out;
}

/**
 * `3 \pm \sqrt{5}` is two values written once. This returns both trees, the
 * plus reading first. More than one `\pm` in one expression is refused: the
 * signs would have to be read as correlated or independent and the notation
 * does not say which.
 */
export function expandPm(node) {
  const n = countPm(node);
  if (n === 0) return [node];
  if (n > 1) throw new Error('more than one plus-or-minus in one expression');
  const build = (x, plus) => {
    if (x.k === 'pm') return { k: plus ? 'add' : 'sub', a: build(x.a, plus), b: build(x.b, plus) };
    const out = { ...x };
    for (const f of ['a', 'b']) if (x[f] && typeof x[f] === 'object') out[f] = build(x[f], plus);
    return out;
  };
  return [build(node, true), build(node, false)];
}

// ---------------------------------------------------------------------------
// Exact evaluation in Q(sqrt k)
// ---------------------------------------------------------------------------

/**
 * Work out an expression exactly, allowing ONE radical.
 *
 * This is `evalAst` widened by exactly the amount the quadratics strand needs
 * and no more. `\sqrt{18}` reduces to `3\sqrt{2}`; `\sqrt{2} + \sqrt{3}` is
 * refused, because that value lives in neither Q(sqrt 2) nor Q(sqrt 3) and any
 * answer this function gave for it would be wrong in a way it could not see.
 * A letter under a radical is refused for the same reason.
 */
export function evalSurd(node, env = {}) {
  switch (node.k) {
    case 'num': return SR(R(node.v));
    case 'var': {
      const v = env[node.v];
      if (v == null) throw new Error(`unbound variable ${node.v}`);
      if (isSurd(v)) return v;
      return SR(typeof v === 'number' ? R(v) : v);
    }
    case 'add': return sAdd(evalSurd(node.a, env), evalSurd(node.b, env));
    case 'sub': return sSub(evalSurd(node.a, env), evalSurd(node.b, env));
    case 'mul': return sMul(evalSurd(node.a, env), evalSurd(node.b, env));
    case 'div': return sDiv(evalSurd(node.a, env), evalSurd(node.b, env));
    case 'neg': return sNeg(evalSurd(node.a, env));
    case 'pow': {
      // The exponent is a plain whole number even when the base is not.
      const e = evalAst(node.b, {});
      if (e.d !== 1) throw new Error('non-integer exponent');
      return sPow(evalSurd(node.a, env), e.n);
    }
    case 'sqrt': {
      if (mentionsVar(node.a)) throw new Error('a letter under a radical is not supported');
      const r = evalAst(node.a, {});
      if (r.d !== 1) throw new Error('a radicand must be a whole number');
      if (r.n < 0) throw new Error(`a radicand must not be negative, and ${r.n} is`);
      return surdSqrt(r.n);
    }
    case 'pm': throw new Error('plus-or-minus stands for two values, not one');
    default: throw new Error(`bad node ${node.k}`);
  }
}

/** Work out a LaTeX expression exactly in Q(sqrt k). */
export function surdValue(src, env = {}) { return evalSurd(parse(src), env); }

/**
 * Every exact value a written answer stands for, smallest first.
 *
 * One answer string may hold several: `3 \pm \sqrt{5}` is two, and
 * `x = -1, x = 4` is two. Each part may name the unknown or not.
 */
export function answerValues(src, v = null) {
  const text = String(src);
  const parts = splitTop(text, ',');
  const out = [];
  for (const part of parts) {
    let body = part.trim();
    if (!body) throw new Error('an empty value in the answer');
    const at = body.indexOf('=');
    if (at >= 0) {
      const lhs = body.slice(0, at).trim();
      if (v !== null && lhs !== v) throw new Error(`"${lhs}" is not the unknown ${v}`);
      body = body.slice(at + 1).trim();
    }
    for (const tree of expandPm(parse(body))) out.push(evalSurd(tree, {}));
  }
  out.sort(sCmp);
  return out;
}

/** Split on a separator that is not inside brackets or a braced group. */
export function splitTop(src, sep) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    else if (ch === sep && depth === 0) { out.push(src.slice(start, i)); start = i + 1; }
  }
  out.push(src.slice(start));
  return out;
}

// ---------------------------------------------------------------------------
// Polynomial form — the machinery that lets us solve a quadratic
//
// `linearize()` above stops at degree one, and fourteen shipped check kinds
// depend on it stopping there, so it is untouched. This is the same idea one
// degree further up and generalised: a coefficient list, index = power.
// ---------------------------------------------------------------------------

const POLY_MAX = 8;

function polyTrim(cs) {
  let i = cs.length - 1;
  while (i > 0 && isZero(cs[i])) i--;
  return cs.slice(0, i + 1);
}

function polyAdd(x, y) {
  const out = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) out.push(add(x[i] || R(0), y[i] || R(0)));
  return polyTrim(out);
}
function polySub(x, y) {
  const out = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) out.push(sub(x[i] || R(0), y[i] || R(0)));
  return polyTrim(out);
}
function polyMul(x, y, maxDeg) {
  const out = new Array(x.length + y.length - 1).fill(null).map(() => R(0));
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < y.length; j++) out[i + j] = add(out[i + j], mul(x[i], y[j]));
  }
  const t = polyTrim(out);
  if (t.length - 1 > maxDeg) throw new Error(`degree above ${maxDeg}`);
  return t;
}

/**
 * Collect an expression into coefficients of one letter, exactly.
 *
 * Returns `[c0, c1, c2, …]`, so `polynomialise(parse('2x^{2} - 3'), 'x')` is
 * `[-3, 0, 2]`. This reads the STRUCTURE of the notation, so a degree it
 * refuses is a degree that is genuinely written there — unlike probing at
 * sample points, which can only ever confirm a degree it already guessed.
 */
export function polynomialise(node, v, maxDeg = POLY_MAX) {
  const rec = (n) => {
    switch (n.k) {
      case 'num': return [R(n.v)];
      case 'var':
        if (n.v !== v) throw new Error(`free variable ${n.v}`);
        return [R(0), R(1)];
      case 'add': return polyAdd(rec(n.a), rec(n.b));
      case 'sub': return polySub(rec(n.a), rec(n.b));
      case 'neg': return rec(n.a).map(neg);
      case 'mul': return polyMul(rec(n.a), rec(n.b), maxDeg);
      case 'div': {
        const den = rec(n.b);
        if (den.length > 1) throw new Error('variable in denominator');
        if (isZero(den[0])) throw new Error('division by zero');
        return polyTrim(rec(n.a).map((c) => div(c, den[0])));
      }
      case 'pow': {
        const e = rec(n.b);
        if (e.length > 1) throw new Error('a letter in an exponent is not a polynomial');
        if (e[0].d !== 1 || e[0].n < 0) throw new Error('bad exponent');
        const k = e[0].n;
        if (k > maxDeg + 1) throw new Error(`degree above ${maxDeg}`);
        let out = [R(1)];
        const base = rec(n.a);
        for (let i = 0; i < k; i++) out = polyMul(out, base, maxDeg);
        return out;
      }
      case 'sqrt': throw new Error('a radical is not a polynomial');
      case 'pm': throw new Error('plus-or-minus stands for two values, not one');
      default: throw new Error(`bad node ${n.k}`);
    }
  };
  const cs = rec(node);
  if (cs.length - 1 > maxDeg) throw new Error(`degree above ${maxDeg}`);
  return cs;
}

/** Coefficients of one letter, read straight off a LaTeX string. */
export function polyCoeffs(src, v, maxDeg = POLY_MAX) {
  return polynomialise(parse(src), v, maxDeg);
}

/** The degree of a coefficient list. A list of one zero has degree -1. */
export function polyDegree(cs) {
  const t = polyTrim(cs);
  if (t.length === 1 && isZero(t[0])) return -1;
  return t.length - 1;
}

/** `a x^{2} + b x + c` written back out, so an identity can be checked. */
export function polyTex(cs, v) {
  const parts = [];
  for (let i = cs.length - 1; i >= 0; i--) {
    const c = cs[i];
    if (isZero(c)) continue;
    const mag = c.n < 0 ? neg(c) : c;
    const body = i === 0 ? texOfLocal(mag)
      : `${eq(mag, R(1)) ? '' : texOfLocal(mag)}${v}${i === 1 ? '' : `^{${i}}`}`;
    parts.push((parts.length ? (c.n < 0 ? ' - ' : ' + ') : (c.n < 0 ? '-' : '')) + body);
  }
  return parts.length ? parts.join('') : '0';
}
function texOfLocal(a) { return a.d === 1 ? String(a.n) : `\\frac{${a.n}}{${a.d}}`; }

/**
 * `a x^{2} + b x + c`, beside `linearize()` rather than inside it.
 *
 * `linearize()` is load bearing for fourteen shipped check kinds and behaves
 * today exactly as it did on the day they were written. Squared terms are a
 * new question, so they get a new function.
 */
export function quadratise(node, v) {
  const cs = polynomialise(node, v, 2);
  return { a: cs[2] || R(0), b: cs[1] || R(0), c: cs[0] || R(0) };
}

/**
 * Solve a quadratic given as the LaTeX the learner is SHOWN.
 *
 *   { kind: 'twoRational',   roots: [R, R] }
 *   { kind: 'oneRational',   root: R, roots: [R] }
 *   { kind: 'twoIrrational', roots: [Surd, Surd], radicand, p, q }
 *   { kind: 'noReal',        disc }
 *   { kind: 'notQuadratic',  root: R }      a = 0, b != 0
 *   { kind: 'identity' }                    every value works
 *   { kind: 'none' }                        no value works
 *
 * Every result carries the exact a, b, c it was built from.
 *
 * THE COEFFICIENTS ARE READ TWICE, BY TWO DIFFERENT ROUTES, AND MUST AGREE.
 *
 * Route one collects the syntax tree with `quadratise()`, which PROVES the
 * degree is at most two because a third power cannot survive the collection.
 * Route two probes the printed equation as a function — f(0) gives c, then
 * f(1) and f(-1) give a and b — and confirms with f(2) and f(3), which is what
 * rules out a higher power hiding behind a bracket. Neither route is allowed
 * to take a number from the generator, and a disagreement between them throws.
 */
export function solveQuadratic(src, v) {
  const { left, right } = parseEquation(src);

  // Route one: structure. Refuses anything above degree two outright.
  const L = quadratise(left, v);
  const Rt = quadratise(right, v);
  const a = sub(L.a, Rt.a);
  const b = sub(L.b, Rt.b);
  const c = sub(L.c, Rt.c);

  // Route two: probing. Independent of the collection above.
  const f = (t) => sub(evalAst(left, { [v]: t }), evalAst(right, { [v]: t }));
  const p0 = f(R(0));
  const sum = sub(f(R(1)), p0);        // a + b
  const dif = sub(f(R(-1)), p0);       // a - b
  const a2 = div(add(sum, dif), R(2));
  const b2 = div(sub(sum, dif), R(2));
  if (!eq(a, a2) || !eq(b, b2) || !eq(c, p0)) {
    throw new Error('the two readings of this equation disagree about its coefficients');
  }
  for (const t of [2, 3]) {
    const want = add(add(mul(a, R(t * t)), mul(b, R(t))), c);
    if (!eq(f(R(t)), want)) throw new Error('a higher power is hiding in the notation');
  }

  if (isZero(a)) {
    if (isZero(b)) return isZero(c) ? { kind: 'identity', a, b, c } : { kind: 'none', a, b, c };
    return { kind: 'notQuadratic', a, b, c, root: div(neg(c), b) };
  }

  const disc = sub(mul(b, b), mul(R(4), mul(a, c)));
  if (disc.n < 0) return { kind: 'noReal', a, b, c, disc };

  const den = mul(R(2), a);
  if (isZero(disc)) {
    const r = div(neg(b), den);
    return { kind: 'oneRational', a, b, c, disc, root: r, roots: [r] };
  }

  const exact = rationalSqrt(disc);
  if (exact) {
    const r1 = div(sub(neg(b), exact), den);
    const r2 = div(add(neg(b), exact), den);
    const roots = cmp(r1, r2) <= 0 ? [r1, r2] : [r2, r1];
    proveRoots(roots.map(SR), a, b, c);
    return { kind: 'twoRational', a, b, c, disc, roots };
  }

  // sqrt(n/d) = sqrt(n*d)/d, so the radicand handed to the factoriser is whole.
  const N = disc.n * disc.d;
  if (!Number.isSafeInteger(N)) throw new Error('this discriminant is too large to reduce exactly');
  const { m, k } = simplifySqrt(N);
  const rootPart = div(R(m), R(disc.d));      // sqrt(disc) = rootPart * sqrt(k)
  const p = div(neg(b), den);
  const q = div(rootPart, den);
  const r1 = S(p, neg(q), k);
  const r2 = S(p, q, k);
  const roots = sCmp(r1, r2) <= 0 ? [r1, r2] : [r2, r1];
  proveRoots(roots, a, b, c);
  return { kind: 'twoIrrational', a, b, c, disc, radicand: k, p, q, roots };
}

/**
 * Put each root back into `a x^{2} + b x + c` and require exactly zero.
 *
 * The formula is a derivation; the substitution is the PROOF. A slip anywhere
 * above — a sign, a reduced radical, a denominator — stops here.
 */
export function proveRoots(roots, a, b, c) {
  for (const r of roots) {
    const out = sAdd(sAdd(sMul(SR(a), sPow(r, 2)), sMul(SR(b), r)), SR(c));
    if (!sIsZero(out)) throw new Error(`putting ${sTex(r)} back leaves ${sTex(out)}, not zero`);
  }
  return true;
}

/** Which single-letter variables does this expression mention? */
export function varsOf(src) {
  const seen = new Set();
  for (const tok of tokenize(src)) if (tok.t === 'var') seen.add(tok.v);
  return [...seen];
}

/**
 * Are two expressions the same function of one variable? For the linear and
 * quadratic forms this bank produces, agreement on enough sample points is a
 * proof, not a heuristic — but we sample generously anyway.
 */
export function equivalent(srcA, srcB, v, samples = 14) {
  const A = parse(srcA), B = parse(srcB);
  for (let i = 0; i < samples; i++) {
    const x = R(i * 2 - samples + 1, i % 3 === 2 ? 2 : 1);
    let ea, eb;
    try { ea = evalAst(A, { [v]: x }); } catch { return false; }
    try { eb = evalAst(B, { [v]: x }); } catch { return false; }
    if (!eq(ea, eb)) return false;
  }
  return true;
}

/**
 * Read the cells out of a \begin{array}...\end{array}. Table items are verified
 * by parsing the table the learner is shown and re-deriving the rule from it.
 */
export function parseArrayCells(src) {
  const m = /\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/.exec(src);
  if (!m) throw new Error('no array found');
  return m[1]
    .split('\\\\')
    .map((row) => row.replace(/\\hline/g, '').trim())
    .filter((row) => row.length)
    .map((row) => row.split('&').map((c) => c.trim()));
}

/**
 * EVERY array in a display, in the order they are printed.
 *
 * `parseArrayCells` reads the first one and is left exactly as it was, because
 * every shipped check kind expects that. Two items — writing a pair of rules
 * from two data sets, and a two-way frequency table beside a second table —
 * need all of them, so they ask here instead.
 */
export function parseArrayBlocks(src) {
  const out = [];
  const re = /\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g;
  let m;
  while ((m = re.exec(String(src)))) {
    out.push(m[1]
      .split('\\\\')
      .map((row) => row.replace(/\\hline/g, '').trim())
      .filter((row) => row.length)
      .map((row) => row.split('&').map((cell) => cell.trim())));
  }
  if (!out.length) throw new Error('no array found');
  return out;
}
