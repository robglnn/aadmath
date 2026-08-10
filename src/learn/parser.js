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
 */
import { R, add, sub, mul, div, neg, pow, isZero, eq } from './rational.js';

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
  if (tok.t === 'num' || tok.t === 'var' || tok.t === 'frac') return true;
  if (tok.t === 'delim' && tok.v === '(') return true;
  return false;
}

function parseUnary(p) {
  const tok = p.peek();
  if (tok && tok.t === 'op' && tok.v === '-') { p.next(); return { k: 'neg', a: parseUnary(p) }; }
  if (tok && tok.t === 'op' && tok.v === '+') { p.next(); return parseUnary(p); }
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
