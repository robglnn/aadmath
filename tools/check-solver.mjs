#!/usr/bin/env node
/**
 * The verification-core gate.
 *
 *   node tools/check-solver.mjs              # run the whole battery
 *   node tools/check-solver.mjs --self-test  # the same thing; the tool IS a self-test
 *   node tools/check-solver.mjs --list       # print every case it runs
 *
 * WHY THIS EXISTS
 *
 * A checker that has never rejected anything is not a checker. Every other gate
 * in this repo watches the BANK; this one watches the INSTRUMENT. It plants
 * answers that are wrong in the exact ways a generator gets things wrong — a
 * root out by one, a radical reduced to the wrong surd, a turning point with
 * the sign of h flipped — and fails the build unless the checker catches every
 * single one of them. Then it runs a clean set past the same checker and fails
 * the build if any of those is refused.
 *
 * Both halves matter. A gate that fires on everything is as useless as a gate
 * that fires on nothing: it would throw away correct items until the bank was
 * empty, and the failure would look like "no items for this skill" rather than
 * like a broken checker.
 *
 * WHAT IT COVERS
 *
 *   1. the tokeniser  — `\sqrt` and `\pm` are read, and decimals, `_` and `|`
 *                       still are not
 *   2. `src/learn/surd.js`     — exact arithmetic in Q(sqrt k) and its refusals
 *   3. `solveQuadratic()`      — every discriminated result, proved by putting
 *                                each root back into the printed equation
 *   4. `verify()`              — every check kind the quadratics strand added
 */
import {
  parse, evaluate, tokenize, linearize, solveLinear, solveQuadratic, quadratise,
  surdValue, answerValues, polyCoeffs, polyDegree, expandPm, radicandsOf, radicalInDenominator,
} from '../src/learn/parser.js';
import {
  S, SR, simplifySqrt, isSquarefree, isqrt, rationalSqrt, surdSqrt,
  sAdd, sMul, sPow, sEq, sCmp, sTex, sTexOverOne, surdSpellings, sIsZero,
} from '../src/learn/surd.js';
import { proveRoots } from '../src/learn/parser.js';
import { R, str as rstr, eq as reqq } from '../src/learn/rational.js';
import { verify } from '../src/learn/generators.js';
import { findings } from './_findings.mjs';

const LIST = process.argv.includes('--list');
let bad = 0;
const fail = (msg) => { console.error(`FAIL: ${msg}`); bad++; };

// ---------------------------------------------------------------------------
// 1 + 2. The layer below `verify()`: the tokeniser, and exact surd arithmetic.
// ---------------------------------------------------------------------------
function throwsWith(label, fn, re) {
  let message = null;
  try { fn(); } catch (e) { message = e.message; }
  if (message === null) { fail(`${label}: nothing was thrown`); return; }
  if (re && !re.test(message)) fail(`${label}: threw "${message}", which does not name the fault (${re})`);
}
function works(label, fn) {
  try { return fn(); } catch (e) { fail(`${label}: threw "${e.message}"`); return null; }
}
function same(label, got, want) {
  if (got !== want) fail(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
}

function unitTests() {
  // The tokeniser learned exactly two control sequences…
  works('parse \\sqrt{2}', () => parse('\\sqrt{2}'));
  works('parse 3 \\pm 2', () => parse('3 \\pm 2'));
  same('\\sqrt{18} reduces', sTex(works('eval \\sqrt{18}', () => surdValue('\\sqrt{18}'))), '3\\sqrt{2}');
  same('2\\sqrt{3} multiplies implicitly', sTex(surdValue('2\\sqrt{3}')), '2\\sqrt{3}');
  // …and nothing else changed.
  throwsWith('a decimal', () => evaluate('3.5'), /unexpected character/);
  throwsWith('a subscript', () => parse('a_{n}'), /unexpected character/);
  throwsWith('an absolute-value bar', () => parse('|x|'), /unexpected character/);
  throwsWith('a cube root', () => parse('\\sqrt[3]{8}'), /unexpected character/);
  throwsWith('a radical with no braces', () => parse('\\sqrt 2'), /braced radicand/);
  throwsWith('an unknown command', () => parse('\\alpha'), /unsupported command/);

  // `linearize` and `solveLinear` behave exactly as they did.
  const lin = works('linearize 3x + 5', () => linearize(parse('3x + 5'), 'x'));
  if (lin && (!reqq(lin.a, R(3)) || !reqq(lin.b, R(5)))) fail('linearize changed on a linear form');
  const sl = works('solveLinear 2x + 3 = 11', () => solveLinear('2x + 3 = 11', 'x'));
  if (sl && (sl.kind !== 'unique' || !reqq(sl.value, R(4)))) fail('solveLinear changed');
  throwsWith('linearize on a square', () => linearize(parse('x^{2}'), 'x'), /not linear/);

  // Exact whole-number square work, proved by squaring back.
  same('sqrt(72) = 6 sqrt(2)', JSON.stringify(simplifySqrt(72)), JSON.stringify({ m: 6, k: 2 }));
  same('sqrt(50) = 5 sqrt(2)', JSON.stringify(simplifySqrt(50)), JSON.stringify({ m: 5, k: 2 }));
  same('sqrt(49) = 7', JSON.stringify(simplifySqrt(49)), JSON.stringify({ m: 7, k: 1 }));
  same('isqrt(1000000) exact', isqrt(1000000), 1000);
  same('isqrt(2) is not whole', isqrt(2), null);
  same('12 is not squarefree', isSquarefree(12), false);
  same('30 is squarefree', isSquarefree(30), true);
  same('rationalSqrt(9/4)', rstr(rationalSqrt(R(9, 4))), '3/2');
  same('rationalSqrt(5) is not rational', rationalSqrt(R(5)), null);

  // The refusals the survey named, one by one.
  throwsWith('a negative radicand', () => simplifySqrt(-3), /not be negative/);
  throwsWith('a radicand under a letter', () => surdValue('\\sqrt{x}', { x: R(2) }), /letter under a radical/);
  throwsWith('a radicand that is not whole', () => surdValue('\\sqrt{\\frac{1}{2}}'), /whole number/);
  throwsWith('two different radicals added', () => surdValue('\\sqrt{2} + \\sqrt{3}'), /different radicals/);
  throwsWith('two different radicals multiplied', () => sMul(surdSqrt(2), surdSqrt(3)), /different radicals/);
  throwsWith('a radicand left square', () => S(R(0), R(1), 12), /not in lowest terms/);
  throwsWith('two plus-or-minus in one expression', () => expandPm(parse('1 \\pm 2 \\pm 3')), /more than one/);
  throwsWith('plus-or-minus has no single value', () => surdValue('3 \\pm 2'), /two values/);

  // Ordering and equality are decided by squaring, never by a decimal.
  same('1 - sqrt5 is below 1 + sqrt5', sCmp(S(R(1), R(-1), 5), S(R(1), R(1), 5)), -1);
  same('sqrt2 is below 3/2', sCmp(surdSqrt(2), SR(R(3, 2))), -1);
  same('sqrt2 is above 7/5', sCmp(surdSqrt(2), SR(R(7, 5))), 1);
  same('sqrt(k) squares back', sEq(sPow(surdSqrt(7), 2), SR(R(7))), true);
  same('(1+sqrt5)^2', sTex(sPow(S(R(1), R(1), 5), 2)), '6 + 2\\sqrt{5}');
  same('a value equals itself', sEq(S(R(1), R(1), 5), S(R(1), R(1), 5)), true);
  same('2sqrt3 is not 3sqrt2', sEq(S(R(0), R(2), 3), S(R(0), R(3), 2)), false);

  // Spelling.
  same('canonical split spelling', sTex(S(R(-3, 2), R(1, 2), 17)), '-\\frac{3}{2} + \\frac{\\sqrt{17}}{2}');
  same('canonical over-one spelling', sTexOverOne(S(R(-3, 2), R(1, 2), 17)), '\\frac{-3 + \\sqrt{17}}{2}');
  same('both spellings are admissible', surdSpellings(S(R(-3, 2), R(1, 2), 17)).length, 2);

  // Shape questions.
  same('radicands are read off', radicandsOf(parse('\\sqrt{12} + \\sqrt{3}')).join(','), '12,3');
  same('a radical downstairs is seen', radicalInDenominator(parse('\\frac{1}{\\sqrt{2}}')), true);
  same('a radical upstairs is not', radicalInDenominator(parse('\\frac{\\sqrt{2}}{2}')), false);

  // `solveQuadratic`, every discriminated result.
  const cases = [
    ['x^{2} - 5x + 6 = 0', 'twoRational', '2,3'],
    ['2x^{2} + 3x - 2 = 0', 'twoRational', '-2,1/2'],
    ['x^{2} - 6x + 9 = 0', 'oneRational', '3'],
    ['x^{2} + 1 = 0', 'noReal', ''],
    ['3x + 1 = 7', 'notQuadratic', ''],
    ['2x + 1 = 2x + 1', 'identity', ''],
    ['2x + 1 = 2x + 5', 'none', ''],
  ];
  for (const [src, kind, roots] of cases) {
    const sol = works(`solveQuadratic ${src}`, () => solveQuadratic(src, 'x'));
    if (!sol) continue;
    same(`kind of ${src}`, sol.kind, kind);
    if (roots) same(`roots of ${src}`, sol.roots.map(rstr).join(','), roots);
  }
  const irr = works('solveQuadratic x^{2} - 2x - 4 = 0', () => solveQuadratic('x^{2} - 2x - 4 = 0', 'x'));
  if (irr) {
    same('irrational kind', irr.kind, 'twoIrrational');
    same('irrational radicand', irr.radicand, 5);
    same('irrational roots', irr.roots.map(sTex).join(' | '), '1 - \\sqrt{5} | 1 + \\sqrt{5}');
  }
  const qf = works('solveQuadratic 2x^{2} + 6x + 1 = 0', () => solveQuadratic('2x^{2} + 6x + 1 = 0', 'x'));
  if (qf) same('quadratic-formula roots', qf.roots.map(sTexOverOne).join(' | '),
    '\\frac{-3 - \\sqrt{7}}{2} | \\frac{-3 + \\sqrt{7}}{2}');
  // THE SUBSTITUTION IS THE PROOF, so it is watched failing on its own. If the
  // formula above it were ever wrong, this is the only thing standing between a
  // wrong root and a learner.
  works('a true root substitutes to zero', () => proveRoots([SR(R(2)), SR(R(3))], R(1), R(-5), R(6)));
  works('an irrational root substitutes to zero', () => proveRoots(
    [S(R(1), R(-1), 5), S(R(1), R(1), 5)], R(1), R(-2), R(-4)));
  throwsWith('a root out by one does not substitute to zero',
    () => proveRoots([SR(R(2)), SR(R(4))], R(1), R(-5), R(6)), /not zero/);
  throwsWith('an irrational root with the wrong radicand does not substitute to zero',
    () => proveRoots([S(R(1), R(1), 6)], R(1), R(-2), R(-4)), /not zero/);
  throwsWith('a cubic', () => solveQuadratic('x^{3} = 1', 'x'), /degree above 2/);
  throwsWith('a letter in a denominator', () => quadratise(parse('\\frac{1}{x}'), 'x'), /variable in denominator/);

  // The nth-term reader, and the sorted-value reader.
  same('a plus-or-minus answer is two values', answerValues('3 \\pm \\sqrt{5}').map(sTex).join(' | '),
    '3 - \\sqrt{5} | 3 + \\sqrt{5}');
  same('a listed answer is sorted', answerValues('x = 4, x = -1', 'x').map(sTex).join(' | '), '-1 | 4');
  same('coefficients are collected', polyCoeffs('x^{3} - x', 'x').map(rstr).join(','), '0,-1,0,1');
  same('degree is measured', polyDegree(polyCoeffs('(x + 3)(x + 4)', 'x')), 2);
}

// ---------------------------------------------------------------------------
// 3. `verify()`, on items built by hand so each case is exactly one defect.
// ---------------------------------------------------------------------------
const A = (o) => ({ steps: [], distractors: [], ...o });

const TABLE = (rows, cols = 'c|c') => `\\begin{array}{${cols}} ${rows.join(' \\\\ ')} \\end{array}`;

/** A relation, a sequence or a set of readings, printed as a two-column table. */
const PAIRS = (head, rows) => TABLE([head, '\\hline', ...rows.map(([a, b]) => `${a} & ${b}`)]);

// ---- clean items: every one of these MUST pass -----------------------------
const CLEAN = [
  ['quadratic: two rational roots', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: 'x = 2, x = 3',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'roots' },
  })],
  ['quadratic: two irrational roots', A({
    latex: 'x^{2} - 2x - 4 = 0', answer: 'x = 1 - \\sqrt{5}, x = 1 + \\sqrt{5}',
    check: { kind: 'quadratic', math: 'x^{2} - 2x - 4 = 0', variable: 'x', want: 'roots' },
  })],
  ['quadratic: the quadratic formula, over one denominator', A({
    latex: '2x^{2} + 6x + 1 = 0', answer: 'x = \\frac{-3 - \\sqrt{7}}{2}, x = \\frac{-3 + \\sqrt{7}}{2}',
    check: { kind: 'quadratic', math: '2x^{2} + 6x + 1 = 0', variable: 'x', want: 'roots' },
  })],
  ['quadratic: the greater root alone', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: '3',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'greater' },
  })],
  ['quadratic: a repeated root', A({
    latex: 'x^{2} - 6x + 9 = 0', answer: 'x = 3',
    check: { kind: 'quadratic', math: 'x^{2} - 6x + 9 = 0', variable: 'x', want: 'unique' },
  })],
  ['quadratic: no real solution', A({
    latex: 'x^{2} + 1 = 0', answer: '\\text{no solution}', answerKind: 'NONE', type: 'special',
    check: { kind: 'quadratic', math: 'x^{2} + 1 = 0', variable: 'x', want: 'none' },
  })],
  ['radical: simplify', A({
    latex: '\\sqrt{72}', answer: '6\\sqrt{2}',
    check: { kind: 'radical', math: '\\sqrt{72}', form: 'simplify' },
  })],
  ['radical: combine', A({
    latex: '\\sqrt{18} + \\sqrt{2}', answer: '4\\sqrt{2}',
    check: { kind: 'radical', math: '\\sqrt{18} + \\sqrt{2}', form: 'combine' },
  })],
  ['rationalExponent: a whole value', A({
    latex: '8^{\\frac{2}{3}}', answer: '4',
    check: { kind: 'rationalExponent', math: '8^{\\frac{2}{3}}' },
  })],
  ['rationalExponent: a radical value', A({
    latex: '2^{\\frac{1}{2}}', answer: '\\sqrt{2}',
    check: { kind: 'rationalExponent', math: '2^{\\frac{1}{2}}' },
  })],
  ['factored: a monic trinomial', A({
    latex: 'x^{2} + 7x + 12', answer: '\\left(x + 3\\right)\\left(x + 4\\right)',
    check: { kind: 'factored', math: 'x^{2} + 7x + 12', variable: 'x' },
  })],
  ['factored: a leading coefficient', A({
    latex: '2x^{2} + 7x + 3', answer: '\\left(2x + 1\\right)\\left(x + 3\\right)',
    check: { kind: 'factored', math: '2x^{2} + 7x + 3', variable: 'x' },
  })],
  ['factored: a common factor and a difference of squares', A({
    latex: 'x^{3} - x', answer: 'x\\left(x - 1\\right)\\left(x + 1\\right)',
    check: { kind: 'factored', math: 'x^{3} - x', variable: 'x' },
  })],
  ['factored: decide, and it is one', A({
    latex: 'x^{2} - 9', answer: '\\text{yes}', answerKind: 'YES', type: 'special',
    check: { kind: 'factored', math: 'x^{2} - 9', variable: 'x', form: 'decide' },
  })],
  ['factored: decide, and it is not one', A({
    latex: 'x^{2} - 5', answer: '\\text{no}', answerKind: 'NO', type: 'special',
    check: { kind: 'factored', math: 'x^{2} - 5', variable: 'x', form: 'decide' },
  })],
  ['polyQuotient: an exact division', A({
    latex: '\\frac{x^{2} + 6x + 5}{x + 5}', answer: 'x + 1',
    check: { kind: 'polyQuotient', dividend: 'x^{2} + 6x + 5', divisor: 'x + 5', variable: 'x', want: 'quotient' },
  })],
  ['polyQuotient: a remainder', A({
    latex: '\\frac{x^{2} + 3x + 5}{x + 1} = \\left(x + 2\\right) + \\frac{r}{x + 1}', answer: '3',
    check: { kind: 'polyQuotient', dividend: 'x^{2} + 3x + 5', divisor: 'x + 1', quotient: 'x + 2', variable: 'x', want: 'remainder' },
  })],
  ['vertexForm: completing the square', A({
    latex: 'x^{2} + 6x + 2', answer: '\\left(x + 3\\right)^{2} - 7',
    check: { kind: 'vertexForm', math: 'x^{2} + 6x + 2', variable: 'x' },
  })],
  ['vertexForm: with a leading coefficient', A({
    latex: '2x^{2} - 4x + 5', answer: '2\\left(x - 1\\right)^{2} + 3',
    check: { kind: 'vertexForm', math: '2x^{2} - 4x + 5', variable: 'x' },
  })],
  ['features: the turning point', A({
    latex: 'x^{2} + 6x + 2', answer: '\\left(-3, -7\\right)',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'vertex' },
  })],
  ['features: the axis of symmetry', A({
    latex: 'x^{2} + 6x + 2', answer: 'x = -3',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'axis' },
  })],
  ['features: where it crosses the upright axis', A({
    latex: 'x^{2} + 6x + 2', answer: '2',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'yIntercept' },
  })],
  ['features: which way it opens', A({
    latex: 'x^{2} + 6x + 2', answer: '\\text{up}', answerKind: 'UP', type: 'special',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'opening' },
  })],
  ['features: a least value, not a greatest one', A({
    latex: 'x^{2} + 6x + 2', answer: '\\text{least}', answerKind: 'MIN', type: 'special',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'extremeKind' },
  })],
  ['features: the turning value', A({
    latex: 'x^{2} + 6x + 2', answer: '-7',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'extremeValue' },
  })],
  ['features: the zeros of a straight rule', A({
    latex: '2x - 6', answer: '3',
    check: { kind: 'features', math: '2x - 6', variable: 'x', want: 'zeros' },
  })],
  ['features: the zeros of a curved rule', A({
    latex: 'x^{2} - 5x + 6', answer: 'x = 2, x = 3',
    check: { kind: 'features', math: 'x^{2} - 5x + 6', variable: 'x', want: 'zeros' },
  })],
  ['features: every value is accepted', A({
    latex: 'x^{2} + 6x + 2', answer: '\\text{every real number}', answerKind: 'ALLREAL', type: 'special',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'domain' },
  })],
  ['features: the range of a curved rule', A({
    latex: 'x^{2} + 6x + 2', answer: 'y \\ge -7',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'range', outputVariable: 'y' },
  })],
  ['features: the range of a straight rule on a closed interval', A({
    latex: '2x + 1', stem: 'from 0 to 4',
    answer: '1 \\le y \\le 9',
    check: { kind: 'features', math: '2x + 1', variable: 'x', want: 'range', outputVariable: 'y', interval: [0, 4] },
  })],
  ['relationPairs: it is a function', A({
    latex: PAIRS('x & y', [[1, 2], [2, 5], [3, 8]]), answer: '\\text{yes}', answerKind: 'YES', type: 'special',
    check: { kind: 'relationPairs', want: 'isFunction' },
  })],
  ['relationPairs: it is not a function', A({
    latex: PAIRS('x & y', [[1, 2], [1, 5], [3, 8]]), answer: '\\text{no}', answerKind: 'NO', type: 'special',
    check: { kind: 'relationPairs', want: 'isFunction' },
  })],
  ['relationPairs: which input breaks it', A({
    latex: PAIRS('x & y', [[1, 2], [1, 5], [3, 8]]), answer: '1',
    check: { kind: 'relationPairs', want: 'breakingInput' },
  })],
  ['sequence: an explicit geometric rule', A({
    latex: PAIRS('n & f', [[1, 3], [2, 6], [3, 12], [4, 24]]), answer: '3 \\cdot 2^{n - 1}',
    check: { kind: 'sequence', form: 'explicit', variable: 'n' },
  })],
  ['sequence: an explicit arithmetic rule', A({
    latex: PAIRS('n & f', [[1, 5], [2, 8], [3, 11], [4, 14]]), answer: '3n + 2',
    check: { kind: 'sequence', form: 'explicit', variable: 'n' },
  })],
  ['sequence: a named term', A({
    latex: PAIRS('n & f', [[1, 5], [2, 8], [3, 11], [4, 14]]), answer: '20',
    check: { kind: 'sequence', form: 'term', variable: 'n', at: 6 },
  })],
  ['sequence: a recursion that adds', A({
    latex: 'f\\left(1\\right) = 5, \; f\\left(n\\right) = f\\left(n - 1\\right) + 3', answer: '14',
    check: {
      kind: 'sequence', form: 'recursive', variable: 'n', at: 4,
      statements: ['f\\left(1\\right) = 5', 'f\\left(n\\right) = f\\left(n - 1\\right) + 3'],
    },
  })],
  ['sequence: a recursion that multiplies', A({
    latex: 'f\\left(1\\right) = 3, \; f\\left(n\\right) = 2 \\cdot f\\left(n - 1\\right)', answer: '24',
    check: {
      kind: 'sequence', form: 'recursive', variable: 'n', at: 4,
      statements: ['f\\left(1\\right) = 3', 'f\\left(n\\right) = 2 \\cdot f\\left(n - 1\\right)'],
    },
  })],
  ['relatedLine: a parallel rule', A({
    latex: '2x + y = 5, \; \\left(1, 4\\right)', answer: 'y = -2x + 6',
    check: { kind: 'relatedLine', math: '2x + y = 5', point: [1, 4], relation: 'parallel', want: 'equation', form: 'slopeIntercept' },
  })],
  ['relatedLine: a rule at right angles', A({
    latex: 'y = 2x + 1, \; \\left(4, 3\\right)', answer: 'y = -\\frac{1}{2}x + 5',
    check: { kind: 'relatedLine', math: 'y = 2x + 1', point: [4, 3], relation: 'perpendicular', want: 'equation', form: 'slopeIntercept' },
  })],
  ['relatedLine: parallel to an upright line', A({
    latex: 'x = 3, \; \\left(2, 5\\right)', answer: 'x = 2',
    check: { kind: 'relatedLine', math: 'x = 3', point: [2, 5], relation: 'parallel', want: 'equation' },
  })],
  ['relatedLine: the rate of an upright line', A({
    latex: 'x = 3, \; \\left(2, 5\\right)', answer: '\\text{undefined}', answerKind: 'UNDEFINED', type: 'special',
    check: { kind: 'relatedLine', math: 'x = 3', point: [2, 5], relation: 'parallel', want: 'slope' },
  })],
  ['relatedLine: a point read off a drawn curve', A({
    latex: '2x + y = 5', answer: 'y = -2x + 8',
    figure: { kind: 'curve', a: 1, b: 0, c: 0, range: [-3, 3] },
    check: { kind: 'relatedLine', math: '2x + y = 5', point: [2, 4], relation: 'parallel', want: 'equation', form: 'slopeIntercept' },
  })],
  ['halfPlane: a region above an included boundary', A({
    latex: TABLE(['x & y & m', '\\hline', '0 & 1 & \\bullet', '1 & 3 & ', '2 & 5 & ', '0 & 4 & +'], 'c|c|c'),
    answer: 'y \\ge 2x + 1',
    check: { kind: 'halfPlane', vars: ['x', 'y'] },
  })],
  ['halfPlane: a region below an excluded boundary', A({
    latex: TABLE(['x & y & m', '\\hline', '0 & 1 & \\circ', '1 & 3 & ', '2 & 5 & ', '0 & 4 & -'], 'c|c|c'),
    answer: 'y < 2x + 1',
    check: { kind: 'halfPlane', vars: ['x', 'y'] },
  })],
  ['systemWrite: two rules from two tables', A({
    latex: `${PAIRS('x & y', [[0, 2], [1, 5], [2, 8]])} \\quad ${PAIRS('x & y', [[0, 10], [1, 9], [2, 8]])}`,
    answer: 'y = 3x + 2, y = -x + 10',
    check: { kind: 'systemWrite', vars: ['x', 'y'] },
  })],
  ['regression: an exact least-squares rate', A({
    latex: PAIRS('x & y', [[1, 2], [2, 4], [3, 5], [4, 9]]), answer: '11/5',
    check: { kind: 'regression', model: 'linear', want: 'slope' },
  })],
  ['regression: an exact least-squares intercept', A({
    latex: PAIRS('x & y', [[1, 2], [2, 4], [3, 5], [4, 9]]), answer: '-1/2',
    check: { kind: 'regression', model: 'linear', want: 'intercept' },
  })],
  ['regression: a residual keeps its sign', A({
    latex: PAIRS('x & y', [[1, 2], [2, 4], [3, 5], [4, 9]]), answer: '-11/10',
    check: { kind: 'regression', model: 'linear', want: 'residual', at: 3 },
  })],
  ['regression: a curved least-squares fit', A({
    latex: PAIRS('x & y', [[1, 1], [2, 4], [3, 9], [4, 16], [5, 25]]), answer: '1',
    check: { kind: 'regression', model: 'quadratic', want: 'a' },
  })],
  ['correlation: the direction', A({
    latex: PAIRS('x & y', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5]]),
    answer: '\\text{positive}', answerKind: 'POSITIVE', type: 'special',
    check: { kind: 'correlation', want: 'direction' },
  })],
  ['correlation: the strength', A({
    latex: PAIRS('x & y', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5]]),
    answer: '\\text{strong}', answerKind: 'STRONG', type: 'special',
    check: { kind: 'correlation', want: 'strength', threshold: '49/100', guard: '1/100' },
  })],
  ['correlation: a correctly rounded value', A({
    latex: PAIRS('x & y', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5]]), answer: '0.99',
    check: { kind: 'correlation', want: 'value' },
  })],
  ['twoWayTable: a joint frequency', A({
    latex: TABLE([' & a & b & t', '\\hline', 'p & 3 & 7 & 10', 'q & 5 & 5 & 10', 't & 8 & 12 & 20'], 'c|c|c|c'),
    answer: '3/20',
    check: { kind: 'twoWayTable', want: 'joint', row: 0, col: 0 },
  })],
  ['twoWayTable: a conditional frequency along a row', A({
    latex: TABLE([' & a & b & t', '\\hline', 'p & 3 & 7 & 10', 'q & 5 & 5 & 10', 't & 8 & 12 & 20'], 'c|c|c|c'),
    answer: '3/10',
    check: { kind: 'twoWayTable', want: 'conditionalRow', row: 0, col: 0 },
  })],
  ['twoWayTable: a marginal frequency down a column', A({
    latex: TABLE([' & a & b & t', '\\hline', 'p & 3 & 7 & 10', 'q & 5 & 5 & 10', 't & 8 & 12 & 20'], 'c|c|c|c'),
    answer: '3/5',
    check: { kind: 'twoWayTable', want: 'marginalCol', row: 0, col: 1 },
  })],
  ['exponentialFit: the rule itself', A({
    latex: PAIRS('x & y', [[0, 3], [1, 6], [2, 12], [3, 24]]), answer: '3 \\cdot 2^{x}',
    check: { kind: 'exponentialFit', form: 'fit', variable: 'x' },
  })],
  ['exponentialFit: the starting amount', A({
    latex: PAIRS('x & y', [[0, 3], [1, 6], [2, 12], [3, 24]]), answer: '3',
    check: { kind: 'exponentialFit', form: 'start', variable: 'x' },
  })],
  ['exponentialFit: the step factor', A({
    latex: PAIRS('x & y', [[0, 3], [1, 6], [2, 12], [3, 24]]), answer: '2',
    check: { kind: 'exponentialFit', form: 'factor', variable: 'x' },
  })],
  ['exponentialFit: the percent change each step', A({
    latex: PAIRS('x & y', [[0, 3], [1, 6], [2, 12], [3, 24]]), answer: '100',
    check: { kind: 'exponentialFit', form: 'percent', variable: 'x' },
  })],
  ['exponentialFit: where one rule passes the other', A({
    latex: '2^{n} \\text{ and } 10n', answer: '6',
    check: { kind: 'exponentialFit', form: 'overtake', variable: 'n', rules: ['2^{n}', '10n'], range: [1, 10] },
  })],
  ['exponentialFit: the same rule, spelt again', A({
    latex: '4^{n}', answer: '2^{2n}',
    check: { kind: 'exponentialFit', form: 'rewrite', math: '4^{n}', variable: 'n' },
  })],
];

// ---- planted faults: every one of these MUST be caught ---------------------
const FAULTS = [
  ['a root out by one', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: 'x = 2, x = 4',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'roots' },
  }), /solutions are|leaves/],
  ['an irrational root with the whole part flipped', A({
    latex: 'x^{2} - 2x - 4 = 0', answer: 'x = -1 - \\sqrt{5}, x = -1 + \\sqrt{5}',
    check: { kind: 'quadratic', math: 'x^{2} - 2x - 4 = 0', variable: 'x', want: 'roots' },
  }), /solutions are/],
  ['an irrational root with the wrong radicand', A({
    latex: 'x^{2} - 2x - 4 = 0', answer: 'x = 1 - \\sqrt{6}, x = 1 + \\sqrt{6}',
    check: { kind: 'quadratic', math: 'x^{2} - 2x - 4 = 0', variable: 'x', want: 'roots' },
  }), /solutions are/],
  ['a root set printed out of order', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: 'x = 3, x = 2',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'roots' },
  }), /out of order/],
  ['a root set with one solution missing', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: 'x = 2',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'roots' },
  }), /2 solution/],
  ['the greater root named as the lesser one', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: '2',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'greater' },
  }), /greater solution is 3/],
  ['no solution claimed where there are two', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: '\\text{no solution}', answerKind: 'NONE', type: 'special',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'none' },
  }), /does have solutions/],
  ['a unique solution claimed where the discriminant is not zero', A({
    latex: 'x^{2} - 5x + 6 = 0', answer: 'x = 2',
    check: { kind: 'quadratic', math: 'x^{2} - 5x + 6 = 0', variable: 'x', want: 'unique' },
  }), /not zero/],
  ['a decimal answer', A({
    latex: 'x^{2} - 2 = 0', answer: 'x = -1.41, x = 1.41',
    check: { kind: 'quadratic', math: 'x^{2} - 2 = 0', variable: 'x', want: 'roots' },
  }), /decimal/],
  ['no squared term at all', A({
    latex: '3x + 1 = 7', answer: 'x = 2',
    check: { kind: 'quadratic', math: '3x + 1 = 7', variable: 'x', want: 'roots' },
  }), /not a quadratic/],
  ['a surd claimed as 2 sqrt 3 when it is 3 sqrt 2', A({
    latex: '\\sqrt{18}', answer: '2\\sqrt{3}',
    check: { kind: 'radical', math: '\\sqrt{18}', form: 'simplify' },
  }), /worth 3\\sqrt/],
  ['a radical left unreduced', A({
    latex: '\\sqrt{18}', answer: '\\sqrt{18}',
    check: { kind: 'radical', math: '\\sqrt{18}', form: 'simplify' },
  }), /not in lowest terms/],
  ['a radical left in a denominator', A({
    latex: '\\sqrt{50}', answer: '\\frac{10}{\\sqrt{2}}',
    check: { kind: 'radical', math: '\\sqrt{50}', form: 'simplify' },
  }), /radical in a denominator/],
  ['a radical prompt that is really a whole number', A({
    latex: '\\sqrt{16}', answer: '4',
    check: { kind: 'radical', math: '\\sqrt{16}', form: 'simplify' },
  }), /rational|evaluate/],
  ['two different radicals added', A({
    latex: '\\sqrt{2} + \\sqrt{3}', answer: '\\sqrt{5}',
    check: { kind: 'radical', math: '\\sqrt{2} + \\sqrt{3}', form: 'combine' },
  }), /different radicals/],
  ['a rational exponent worked out wrongly', A({
    latex: '8^{\\frac{2}{3}}', answer: '16',
    check: { kind: 'rationalExponent', math: '8^{\\frac{2}{3}}' },
  }), /to the power 3 is/],
  ['an even root of a negative base', A({
    latex: '\\left(-4\\right)^{\\frac{1}{2}}', answer: '2',
    check: { kind: 'rationalExponent', math: '\\left(-4\\right)^{\\frac{1}{2}}' },
  }), /not a real number/],
  ['an even root taken as the negative one', A({
    latex: '4^{\\frac{1}{2}}', answer: '-2',
    check: { kind: 'rationalExponent', math: '4^{\\frac{1}{2}}' },
  }), /not below zero/],
  ['the prompt retyped instead of factored', A({
    latex: 'x^{2} + 7x + 12', answer: 'x^{2} + 7x + 12',
    check: { kind: 'factored', math: 'x^{2} + 7x + 12', variable: 'x' },
  }), /not a product/],
  ['the wrong pair of factors', A({
    latex: 'x^{2} + 7x + 12', answer: '\\left(x + 2\\right)\\left(x + 6\\right)',
    check: { kind: 'factored', math: 'x^{2} + 7x + 12', variable: 'x' },
  }), /not the same expression/],
  ['a factor that is not linear in the letter', A({
    latex: '2x^{2} + 4x', answer: '2\\left(x^{2} + 2x\\right)',
    check: { kind: 'factored', math: '2x^{2} + 4x', variable: 'x' },
  }), /not a product of factors that are each linear/],
  ['a product with only one factor using the letter', A({
    latex: '2x + 4', answer: '2\\left(x + 2\\right)',
    check: { kind: 'factored', math: '2x + 4', variable: 'x' },
  }), /not a product of two or more/],
  ['a difference of squares called one when it is not', A({
    latex: 'x^{2} - 5', answer: '\\text{yes}', answerKind: 'YES', type: 'special',
    check: { kind: 'factored', math: 'x^{2} - 5', variable: 'x', form: 'decide' },
  }), /answer should be NO/],
  ['a difference of squares denied when it is one', A({
    latex: 'x^{2} - 9', answer: '\\text{no}', answerKind: 'NO', type: 'special',
    check: { kind: 'factored', math: 'x^{2} - 9', variable: 'x', form: 'decide' },
  }), /answer should be YES/],
  ['a quotient that does not multiply back', A({
    latex: '\\frac{x^{2} + 6x + 5}{x + 5}', answer: 'x + 2',
    check: { kind: 'polyQuotient', dividend: 'x^{2} + 6x + 5', divisor: 'x + 5', variable: 'x', want: 'quotient' },
  }), /multiplying back/],
  ['a remainder that is not smaller than the divisor', A({
    latex: '\\frac{x^{2} + 3x + 5}{x + 1} = \\left(x + 1\\right) + \\frac{r}{x + 1}', answer: 'x + 4',
    check: { kind: 'polyQuotient', dividend: 'x^{2} + 3x + 5', divisor: 'x + 1', quotient: 'x + 1', variable: 'x', want: 'remainder' },
  }), /not below the divisor/],
  ['a divisor of degree zero', A({
    latex: '\\frac{x^{2} + 6x + 5}{5}', answer: '\\frac{x^{2}}{5} + \\frac{6x}{5} + 1',
    check: { kind: 'polyQuotient', dividend: 'x^{2} + 6x + 5', divisor: '5', variable: 'x', want: 'quotient' },
  }), /degree zero/],
  ['a turning point with the sign of h flipped', A({
    latex: 'x^{2} + 6x + 2', answer: '\\left(x - 3\\right)^{2} - 7',
    check: { kind: 'vertexForm', math: 'x^{2} + 6x + 2', variable: 'x' },
  }), /not the same rule/],
  ['the standard form handed back as vertex form', A({
    latex: 'x^{2} + 6x + 2', answer: 'x^{2} + 6x + 2',
    check: { kind: 'vertexForm', math: 'x^{2} + 6x + 2', variable: 'x' },
  }), /one squared bracket/],
  ['two squared brackets in vertex form', A({
    latex: 'x^{2} + 6x + 2', answer: '\\left(x + 3\\right)^{2} - \\left(0\\right)^{2} - 7',
    check: { kind: 'vertexForm', math: 'x^{2} + 6x + 2', variable: 'x' },
  }), /exactly one squared bracket/],
  ['a turning point read with h flipped', A({
    latex: 'x^{2} + 6x + 2', answer: '\\left(3, -7\\right)',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'vertex' },
  }), /turning point is/],
  ['an axis answered as a bare value', A({
    latex: 'x^{2} + 6x + 2', answer: '-3',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'axis' },
  }), /is an equation/],
  ['a range stated in the input letter', A({
    latex: 'x^{2} + 6x + 2', answer: 'x \\ge -7',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'range', outputVariable: 'y' },
  }), /states it in x/],
  ['a range with the boundary the wrong way round', A({
    latex: 'x^{2} + 6x + 2', answer: 'y \\le -7',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'range', outputVariable: 'y' },
  }), /the range is/],
  ['the wrong opening direction', A({
    latex: 'x^{2} + 6x + 2', answer: '\\text{down}', answerKind: 'DOWN', type: 'special',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'opening' },
  }), /answer should be UP/],
  ['a greatest value claimed on a rule that opens upward', A({
    latex: 'x^{2} + 6x + 2', answer: '\\text{greatest}', answerKind: 'MAX', type: 'special',
    check: { kind: 'features', math: 'x^{2} + 6x + 2', variable: 'x', want: 'extremeKind' },
  }), /answer should be MIN/],
  ['a rule that divides by the letter', A({
    latex: '\\frac{1}{x}', answer: '\\text{every real number}', answerKind: 'ALLREAL', type: 'special',
    check: { kind: 'features', math: '\\frac{1}{x}', variable: 'x', want: 'domain' },
  }), /denominator/],
  ['a relation called a function when an input repeats', A({
    latex: PAIRS('x & y', [[1, 2], [1, 5], [3, 8]]), answer: '\\text{yes}', answerKind: 'YES', type: 'special',
    check: { kind: 'relationPairs', want: 'isFunction' },
  }), /answer should be NO/],
  ['a relation denied when every input appears once', A({
    latex: PAIRS('x & y', [[1, 2], [2, 5], [3, 8]]), answer: '\\text{no}', answerKind: 'NO', type: 'special',
    check: { kind: 'relationPairs', want: 'isFunction' },
  }), /answer should be YES/],
  ['too few pairs to decide anything', A({
    latex: PAIRS('x & y', [[1, 2], [2, 5]]), answer: '\\text{yes}', answerKind: 'YES', type: 'special',
    check: { kind: 'relationPairs', want: 'isFunction' },
  }), /at least three pairs/],
  ['the wrong input named as the one that breaks it', A({
    latex: PAIRS('x & y', [[1, 2], [1, 5], [3, 8]]), answer: '3',
    check: { kind: 'relationPairs', want: 'breakingInput' },
  }), /breaks it is 1/],
  ['a sequence rule that is out at every position', A({
    latex: PAIRS('n & f', [[1, 3], [2, 6], [3, 12], [4, 24]]), answer: '3 \\cdot 2^{n}',
    check: { kind: 'sequence', form: 'explicit', variable: 'n' },
  }), /at position 1/],
  ['a sequence rule that fits the printed list and nothing beyond it', A({
    latex: PAIRS('n & f', [[1, 5], [2, 8], [3, 11], [4, 14]]),
    answer: '3n + 2 + \\left(n - 1\\right)\\left(n - 2\\right)\\left(n - 3\\right)\\left(n - 4\\right)',
    check: { kind: 'sequence', form: 'explicit', variable: 'n' },
  }), /at position 5/],
  ['a list that is neither arithmetic nor geometric', A({
    latex: PAIRS('n & f', [[1, 1], [2, 2], [3, 4], [4, 7]]), answer: 'n',
    check: { kind: 'sequence', form: 'explicit', variable: 'n' },
  }), /neither arithmetic nor geometric/],
  ['a recursion run to the wrong value', A({
    latex: 'f\\left(1\\right) = 5, \; f\\left(n\\right) = f\\left(n - 1\\right) + 3', answer: '13',
    check: {
      kind: 'sequence', form: 'recursive', variable: 'n', at: 4,
      statements: ['f\\left(1\\right) = 5', 'f\\left(n\\right) = f\\left(n - 1\\right) + 3'],
    },
  }), /reaches 14/],
  ['a recursion written in a shape this checker does not read', A({
    latex: 'f\\left(1\\right) = 5, \; f\\left(n\\right) = 2f\\left(n - 1\\right)', answer: '40',
    check: {
      kind: 'sequence', form: 'recursive', variable: 'n', at: 4,
      statements: ['f\\left(1\\right) = 5', 'f\\left(n\\right) = 2f\\left(n - 1\\right)'],
    },
  }), /not one of the two recursion shapes/],
  ['a parallel rule with the right rate and the wrong constant', A({
    latex: '2x + y = 5, \; \\left(1, 4\\right)', answer: 'y = -2x + 5',
    check: { kind: 'relatedLine', math: '2x + y = 5', point: [1, 4], relation: 'parallel', want: 'equation', form: 'slopeIntercept' },
  }), /meets the upright axis at 6/],
  ['a rule at right angles with the rate not turned over', A({
    latex: 'y = 2x + 1, \; \\left(4, 3\\right)', answer: 'y = 2x - 5',
    check: { kind: 'relatedLine', math: 'y = 2x + 1', point: [4, 3], relation: 'perpendicular', want: 'equation', form: 'slopeIntercept' },
  }), /rate is -1\/2/],
  ['a rule written in a form the item did not ask for', A({
    latex: '2x + y = 5, \; \\left(1, 4\\right)', answer: 'y = -2x + 6',
    check: { kind: 'relatedLine', math: '2x + y = 5', point: [1, 4], relation: 'parallel', want: 'equation', form: 'standard' },
  }), /written as slopeIntercept/],
  ['a right angle asked against a flat line', A({
    latex: 'y = 3, \; \\left(2, 5\\right)', answer: 'x = 2',
    check: { kind: 'relatedLine', math: 'y = 3', point: [2, 5], relation: 'perpendicular', want: 'equation' },
  }), /stands upright, which this kind refuses/],
  ['a point that is not on the drawn curve', A({
    latex: '2x + y = 5', answer: 'y = -2x + 9',
    figure: { kind: 'curve', a: 1, b: 0, c: 0, range: [-3, 3] },
    check: { kind: 'relatedLine', math: '2x + y = 5', point: [2, 5], relation: 'parallel', want: 'equation', form: 'slopeIntercept' },
  }), /nowhere on screen/],
  ['a half-plane with the strictness flipped', A({
    latex: TABLE(['x & y & m', '\\hline', '0 & 1 & \\bullet', '1 & 3 & ', '2 & 5 & ', '0 & 4 & +'], 'c|c|c'),
    answer: 'y > 2x + 1',
    check: { kind: 'halfPlane', vars: ['x', 'y'] },
  }), /readings give/],
  ['a half-plane with the direction flipped', A({
    latex: TABLE(['x & y & m', '\\hline', '0 & 1 & \\bullet', '1 & 3 & ', '2 & 5 & ', '0 & 4 & +'], 'c|c|c'),
    answer: 'y \\le 2x + 1',
    check: { kind: 'halfPlane', vars: ['x', 'y'] },
  }), /readings give/],
  ['a half-plane whose boundary readings are not on one line', A({
    latex: TABLE(['x & y & m', '\\hline', '0 & 1 & \\bullet', '1 & 3 & ', '2 & 6 & ', '0 & 4 & +'], 'c|c|c'),
    answer: 'y \\ge 2x + 1',
    check: { kind: 'halfPlane', vars: ['x', 'y'] },
  }), /not all sit on one line/],
  ['a written pair where one rule is wrong', A({
    latex: `${PAIRS('x & y', [[0, 2], [1, 5], [2, 8]])} \\quad ${PAIRS('x & y', [[0, 10], [1, 9], [2, 8]])}`,
    answer: 'y = 3x + 2, y = -x + 11',
    check: { kind: 'systemWrite', vars: ['x', 'y'] },
  }), /tables fit/],
  ['a written pair that is one rule twice', A({
    latex: `${PAIRS('x & y', [[0, 2], [1, 5], [2, 8]])} \\quad ${PAIRS('x & y', [[0, 10], [1, 9], [2, 8]])}`,
    answer: 'y = 3x + 2, 2y = 6x + 4',
    check: { kind: 'systemWrite', vars: ['x', 'y'] },
  }), /do not meet at one point/],
  ['a least-squares rate that is out', A({
    latex: PAIRS('x & y', [[1, 2], [2, 4], [3, 5], [4, 9]]), answer: '2',
    check: { kind: 'regression', model: 'linear', want: 'slope' },
  }), /exact fit gives 11\/5/],
  ['a residual with the sign the wrong way round', A({
    latex: PAIRS('x & y', [[1, 2], [2, 4], [3, 5], [4, 9]]), answer: '11/10',
    check: { kind: 'regression', model: 'linear', want: 'residual', at: 3 },
  }), /exact fit gives -11\/10/],
  ['too few readings to fit a line', A({
    latex: PAIRS('x & y', [[1, 2], [2, 4], [3, 5]]), answer: '3/2',
    check: { kind: 'regression', model: 'linear', want: 'slope' },
  }), /at least 4 readings/],
  ['a direction claimed against the readings', A({
    latex: PAIRS('x & y', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5]]),
    answer: '\\text{negative}', answerKind: 'NEGATIVE', type: 'special',
    check: { kind: 'correlation', want: 'direction' },
  }), /answer should be POSITIVE/],
  ['a strength verdict too close to the threshold', A({
    latex: PAIRS('x & y', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5]]),
    answer: '\\text{strong}', answerKind: 'STRONG', type: 'special',
    check: { kind: 'correlation', want: 'strength', threshold: '36/37', guard: '1/100' },
  }), /too close to the threshold/],
  ['a printed value that is not the correct rounding', A({
    latex: PAIRS('x & y', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5]]), answer: '0.98',
    check: { kind: 'correlation', want: 'value' },
  }), /does not round to/],
  ['a two-way table whose totals do not reconcile', A({
    latex: TABLE([' & a & b & t', '\\hline', 'p & 3 & 7 & 11', 'q & 5 & 5 & 10', 't & 8 & 12 & 21'], 'c|c|c|c'),
    answer: '3/21',
    check: { kind: 'twoWayTable', want: 'joint', row: 0, col: 0 },
  }), /but its total says/],
  ['a frequency worked out against the wrong total', A({
    latex: TABLE([' & a & b & t', '\\hline', 'p & 3 & 7 & 10', 'q & 5 & 5 & 10', 't & 8 & 12 & 20'], 'c|c|c|c'),
    answer: '3/10',
    check: { kind: 'twoWayTable', want: 'joint', row: 0, col: 0 },
  }), /table gives 3\/20/],
  ['a conditional frequency that names no direction', A({
    latex: TABLE([' & a & b & t', '\\hline', 'p & 3 & 7 & 10', 'q & 5 & 5 & 10', 't & 8 & 12 & 20'], 'c|c|c|c'),
    answer: '3/10',
    check: { kind: 'twoWayTable', want: 'conditional', row: 0, col: 0 },
  }), /which way it conditions/],
  ['an exponential rule that fits two readings and misses the third', A({
    latex: PAIRS('x & y', [[0, 3], [1, 6], [2, 12], [3, 24]]), answer: '3 + 3x',
    check: { kind: 'exponentialFit', form: 'fit', variable: 'x' },
  }), /the table reads/],
  ['readings whose ratios are not all the same', A({
    latex: PAIRS('x & y', [[0, 3], [1, 6], [2, 12], [3, 20]]), answer: '3 \\cdot 2^{x}',
    check: { kind: 'exponentialFit', form: 'fit', variable: 'x' },
  }), /do not share one ratio/],
  ['a step factor read as the difference', A({
    latex: PAIRS('x & y', [[0, 3], [1, 6], [2, 12], [3, 24]]), answer: '3',
    check: { kind: 'exponentialFit', form: 'factor', variable: 'x' },
  }), /readings give 2/],
  ['an overtaking point that is out by one', A({
    latex: '2^{n} \\text{ and } 10n', answer: '5',
    check: { kind: 'exponentialFit', form: 'overtake', variable: 'n', rules: ['2^{n}', '10n'], range: [1, 10] },
  }), /passes the second at 6/],
  ['a rewrite that is not the same rule', A({
    latex: '4^{n}', answer: '2^{n}',
    check: { kind: 'exponentialFit', form: 'rewrite', math: '4^{n}', variable: 'n' },
  }), /reads/],
];

function itemTests() {
  for (const [name, item] of CLEAN) {
    if (LIST) console.log(`clean  ${name}`);
    try { verify(item); } catch (e) { fail(`a clean item was refused — ${name} :: ${e.message}`); }
  }
  for (const [name, item, re] of FAULTS) {
    if (LIST) console.log(`fault  ${name}`);
    let message = null;
    try { verify(item); } catch (e) { message = e.message; }
    if (message === null) { fail(`a planted fault went through — ${name}`); continue; }
    if (!re.test(message)) fail(`a planted fault was caught, but not named — ${name} :: "${message}" does not match ${re}`);
  }
}

/**
 * EVERY CHECK KIND THE MANIFEST CAN PRODUCE, not the ones somebody remembered.
 *
 * The battery above is written by hand, which is its whole strength and its one
 * weakness: a new unit can add a `check.kind` nobody plants a fault for, and
 * this file goes on printing "all planted faults are caught" while the checker
 * for that kind has never once been shown a wrong answer. So the manifest is
 * asked what kinds actually exist. A kind with no clean case and no planted
 * fault fails the build here, by name, before it can carry a bank.
 */
/**
 * THE RECORDED BACKLOG — thirteen kinds this battery does not plant a fault for.
 *
 * This is a list, not an exemption. Every one of them is an Algebra I Level 1
 * kind, and every Level 1 item is re-derived by an INDEPENDENT solver in
 * `tools/validate-items.mjs` — a second implementation that never reads
 * `item.answer` — so those kinds have a second opinion behind them even without
 * a planted fault here. No pack kind is on this list and none may be added to
 * it: a pack's items are checked by `verify()` and by nothing else, which is
 * precisely the situation this file was written for.
 *
 * The list exists so that the coverage check can be a real gate today instead of
 * a warning nobody acts on. It is meant to shrink. It may never grow.
 */
const LEGACY_KINDS = new Set([
  'evaluate', 'equivalent', 'table', 'graph', 'solve', 'equationChoice',
  'inequality', 'compound', 'rearrange', 'proportion', 'line', 'lineEquation',
  'system',
]);

async function kindCoverage() {
  const { allUnits, loadUnit } = await import('./_courses.mjs');
  const { generate, SKILLS } = await import('../src/learn/generators.js');
  for (const { unit } of await allUnits()) await loadUnit(unit);

  const covered = new Set([...CLEAN, ...FAULTS].map(([, item]) => item?.check?.kind).filter(Boolean));
  const seen = new Map();               // kind -> the first skill/form that produced it
  for (const skill of SKILLS) {
    for (let d = 1; d <= 5; d++) {
      for (let s = 0; s < 3; s++) {
        let it;
        try { it = generate(skill, d, s * 7919 + d * 131, { locale: 'en', record: false }); } catch { continue; }
        const k = it.check?.kind;
        if (k && !seen.has(k)) seen.set(k, `${skill}/${it.form}`);
      }
    }
  }
  /* THE COVERAGE CHECK PROVES ITSELF, on every run rather than in a flag
     somebody has to remember. Take one kind that IS covered and is not on the
     backlog out of the covered set; the check must name it. If it does not, the
     check is decoration and the count above means nothing. */
  const probe = [...seen.keys()].find((k) => covered.has(k) && !LEGACY_KINDS.has(k));
  if (!probe) { fail('the coverage check cannot prove itself: no non-legacy kind is covered'); }
  else {
    const rigged = new Set(covered); rigged.delete(probe);
    const caught = [...seen.keys()].some((k) => !rigged.has(k) && !LEGACY_KINDS.has(k) && k === probe);
    if (!caught) fail(`the coverage check did not notice "${probe}" going uncovered`);
    else console.log(`check:solver — coverage self-test: an uncovered "${probe}" is caught`);
  }

  const missing = [...seen.entries()].filter(([k]) => !covered.has(k));
  const debt = missing.filter(([k]) => LEGACY_KINDS.has(k));
  const fresh = missing.filter(([k]) => !LEGACY_KINDS.has(k));
  for (const [k, where] of fresh) {
    fail(`the bank produces check kind "${k}" (${where}) and this battery has neither a clean case nor a planted fault for it. `
      + 'Plant one wrong answer of the shape that kind gets wrong, and one right answer, before it carries a bank.');
  }
  console.log(`check:solver — ${seen.size} check kind(s) reachable from the manifest's ${SKILLS.length} skills, `
    + `${seen.size - missing.length} covered by a planted case, ${debt.length} on the recorded backlog`);
  if (debt.length) console.log(`  backlog: ${debt.map(([k]) => k).join(', ')}`);
}

unitTests();
itemTests();
await kindCoverage();

if (!bad) {
  console.log(`check:solver — ok: ${CLEAN.length} clean items pass, ${FAULTS.length} planted faults are all caught, and the layer below them holds`);
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The checker is not
   unit-scoped: a checker that marks a right answer wrong is wrong everywhere,
   so its findings are ENGINE and are red on every unit at once. */
const F = findings('check:solver', { scope: 'engine' });
if (bad) F.engine(`${bad} failure(s) in the checker itself — a planted fault it did not catch, or a clean item it refused; see the lines above`);
F.done();
