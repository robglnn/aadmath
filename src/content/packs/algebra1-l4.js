/**
 * Algebra I · Level 4 — the generator pack. Root, Factor and Turn.
 *
 * Level 1 taught a balance that stays level. Level 2 taught it to lean and to
 * be drawn. Level 3 gave a rule a name, a power three laws, and an expression
 * more than one term. Level 4 is where the straight line stops being the only
 * shape in the sky. Fourteen skills:
 *
 *   radical-simplify        the largest square comes out from under the bar
 *   radical-arith           roots joined, opened and moved off a denominator
 *   factor-trinomial-monic  three terms back into two brackets
 *   factor-trinomial-lead   the same, when the squared term carries a number
 *   difference-of-squares   a square take away a square
 *   poly-divide             what the bottom must be multiplied by
 *   quadratic-zero-product  two brackets that multiply to zero
 *   solve-by-factoring      everything on one side, then two easy statements
 *   square-root-method      a square undone, which gives two answers
 *   complete-the-square     half the middle count, squared
 *   quadratic-formula       one formula, and the part under the root
 *   parabola-features       the turn, the line through it, and the crossings
 *   quadratic-from-vertex   two spellings of one curve
 *   quadratic-model         a throw, a fence and a price
 *
 * IT IS STILL DATA. This file imports one toolkit from `src/learn/generators.js`
 * and three prose bundles from `content/lang/packs/`. It touches no engine file:
 * not the mastery model, not the scheduler, not the session planner, not the
 * report, not the rift surface, not the world, not `src/main.js`.
 *
 * EVERY ITEM RE-DERIVES THROUGH A CHECKER THAT ALREADY EXISTED. The solver lane
 * shipped the quadratics kinds before this pack was written, and nothing here
 * asked for a new one. Seven are used:
 *
 *   `radical`      reads the printed radical, works it out exactly in
 *                  Q(sqrt k), and proves the square factor by squaring back.
 *   `factored`     proves the answer is the same function at fourteen values
 *                  AND that it is a product of linear factors — retyping the
 *                  prompt passes the first test and fails the second.
 *   `polyQuotient` never divides: it MULTIPLIES BACK, so no excluded value is
 *                  ever needed.
 *   `quadratic`    solves the printed equation from scratch and then puts each
 *                  claimed root back in. The substitution is the proof.
 *   `vertexForm`   the identity plus a shape test, because standard form is
 *                  identically equal and must earn no credit.
 *   `features`     one named attribute, off coefficients probed at five inputs.
 *   `regression`   an exact least-squares parabola through a printed table.
 *
 * WHAT THAT COST, IN WRITING. Four things a full quadratics unit would like to
 * ask are NOT asked here, because the answer could not be re-derived or could
 * not be said in three languages, and an unverified item does not ship:
 *
 *   · no parabola is drawn. `figureHtml` in src/ui/rift.js draws a rectangle,
 *     straight segments and isolated points; a curve is not one of them, and
 *     `tools/check-figures.mjs` refuses a plotted reading that sits on no drawn
 *     trace. So the non-symbolic reading of a curve is a TABLE of readings,
 *     re-derived by exact least squares, and never a picture.
 *   · no YES / NO / MAXIMUM / MINIMUM verdict. `finalize` localises exactly two
 *     special answers, "no solution" and "every value works". A verdict token
 *     such as YES would reach a Spanish or Polish screen as the English word,
 *     which invariant 2 forbids. Every deciding item in this unit is therefore
 *     asked as "no solution", which IS localised, or as a choice between two
 *     printed expressions with a real answer.
 *   · no rule built from two bare readings. A checker reads the notation the
 *     learner is SHOWN, and a prompt that shows only a turning point and a
 *     second point shows no rule to read.
 *   · no rational exponent. `\sqrt{}` is the only new notation this unit
 *     prints, because a fractional count above a letter is a notation nothing
 *     below Level 4 defines, and no term is used before it is defined.
 *
 * WHAT AN ANSWER HAS TO BE, AND WHAT THE OPTIONS BESIDE IT MAY NOT BE.
 *
 * Two rules were added after 16,720 items of this unit were re-derived by an
 * independent solver, and both of them are about the SURFACE rather than the
 * mathematics — which is why every gate over the mathematics passed them:
 *
 *   1. AN ITEM STATES THE FORM IT WANTS. Every factoring form now carries
 *      `check.form: 'factored'` and every completed square carries
 *      `check.form: 'vertex'`. The grader in src/ui/rift.js can derive that
 *      from `check.kind` on its own, and does; declaring it means the demand is
 *      the bank's own word rather than an inference drawn off two strings.
 *      1,763 sampled items were sealed by typing the question back into the
 *      pad before that demand existed, with full unassisted mastery credit for
 *      factoring nothing.
 *   2. NO TWO OPTIONS ARE THE SAME NUMBER. `n = 2 \pm \sqrt{20}` sat beside
 *      the key `n = 2 \pm 2\sqrt{5}` on 586 sampled surd-root items and was
 *      scored an error with a misconception tag on it; 164 more offered one
 *      value under two spellings, so a four-way choice was really three-way.
 *      `oneReadingEach` below is the guard, and it compares VALUES — the
 *      textual dedupe that already existed cannot see that `\sqrt{28}` and
 *      `2\sqrt{7}` are one reading.
 *
 * The surd forms took the second rule rather than the first. A stem could have
 * demanded simplest radical form instead of dropping `\sqrt{20}` — but the
 * answers of those four forms are written `n = 2 \pm 2\sqrt{5}`, and the
 * checker cannot read a form off a line with an `=` in it. A stem that demands
 * a shape no grader enforces is worse than one that does not: it tells a cadet
 * their correct answer was wrong about a rule nothing applied. So the demand
 * stays where it can be kept, and the twin leaves the option set.
 *
 * PROSE LIVES UNDER content/lang. Not in this file, and nowhere in src/.
 */
import { kit } from '../../learn/generators.js';
// Read-only, and only for the guard below: an option set is checked against
// the same arithmetic the rest of the game reads answers with, rather than
// against a second opinion written here that could disagree with it.
import { parse, evalAst, evalSurd, expandPm, splitTop, equivalent } from '../../learn/parser.js';
import { sCmp } from '../../learn/surd.js';
import { R } from '../../learn/rational.js';
import en from '../../../content/lang/packs/algebra1-l4.en.js';
import es from '../../../content/lang/packs/algebra1-l4.es.js';
import pl from '../../../content/lang/packs/algebra1-l4.pl.js';

const {
  pick, int, nz, nzc, co, sg, sgc, lin, paren, distinct, gcd, arrayTex,
  // Every situation this pack shows is drawn through `scene`, never through
  // `pick`. `pick` chooses; `scene` chooses AND tells the engine what it chose,
  // which is what the session ledger, the worked analogue and the proving run's
  // transfer test all read.
  scene,
} = kit;

/**
 * The letters this unit uses for the unknown.
 *
 * `x` for a bare rule, `t` for a time, `w` for a width, `p` for a price. Never
 * `a`, `b` or `c`: those three are spent on the coefficients of a squared rule
 * and are named as such in the formula the learner is taught. Never `k` either,
 * which this unit uses for the number left under the bar.
 */
const VARS = ['x', 'n', 'z'];
const FN = 'f';
/** The letter a rule's OUTPUT is written in, wherever an item states one. */
const OUT = 'y';

// ---------------------------------------------------------------------------
// Notation. One spelling for each shape, everywhere.
// ---------------------------------------------------------------------------

/** `c v^{e}`, printed the one way this pack prints it. "3x^{2}", "-x", "5". */
function mono(c, v, e) {
  if (c === 0) return '0';
  if (e === 0) return String(c);
  const body = e === 1 ? v : `${v}^{${e}}`;
  if (c === 1) return body;
  if (c === -1) return `-${body}`;
  return `${c}${body}`;
}

/** The same monomial as a signed continuation: "+ 3x^{2}", "- x". */
function smono(c, v, e) {
  if (c === 0) return '';
  if (e === 0) return sg(c);
  const body = e === 1 ? v : `${v}^{${e}}`;
  const mag = Math.abs(c) === 1 ? body : `${Math.abs(c)}${body}`;
  return c < 0 ? `- ${mag}` : `+ ${mag}`;
}

/** A polynomial from [coefficient, power] pairs, highest power first. */
function poly(terms, v) {
  const live = terms.filter(([c]) => c !== 0);
  if (!live.length) return '0';
  return live
    .map(([c, e], i) => (i === 0 ? mono(c, v, e) : smono(c, v, e)))
    .join(' ');
}

/** `a v^{2} + b v + c`, the one spelling of a squared rule. */
const quad = (a, b, c, v) => poly([[a, 2], [b, 1], [c, 0]], v);
/** "\left(3x + 5\right)" — one bracketed quantity. */
const wrap = (inner) => `\\left(${inner}\\right)`;
/** "\left(3x + 5\right)" from a coefficient and a constant. */
const brk = (a, v, b) => wrap(lin(a, v, b));
/** A rule with its name on it: "f\left(x\right) = 3x + 5". */
const named = (v, body, name = FN) => `${name}\\left(${v}\\right) = ${body}`;
/**
 * THE SAME RULE, WITH ITS OUTPUT LETTER ON THE CARD: "y = 3x + 5".
 *
 * `pf-range` is keyed in the output letter — `y \le -3` — and printed the rule
 * as `f\left(z\right) = \ldots`, so the only letter on the card was `z` and
 * the only letter the answer would accept was one the card never introduced.
 * A cadet who typed the letter they could see was refused and had a
 * misconception written against them for it. Nothing else in this pack states
 * the range, so the fix is here rather than in the checker: name the output
 * where the question is asked.
 */
const outNamed = (body, out = OUT) => `${out} = ${body}`;
/** "6\sqrt{2}", "\sqrt{2}", "-\sqrt{2}", "6" — the checker's own spelling. */
function surd(m, k) {
  if (k === 1) return String(m);
  if (m === 1) return `\\sqrt{${k}}`;
  if (m === -1) return `-\\sqrt{${k}}`;
  return `${m}\\sqrt{${k}}`;
}
/** "5 + 6\sqrt{2}" — a whole number beside a root, in that order. */
function mixed(p, m, k) {
  if (m === 0) return String(p);
  if (p === 0) return surd(m, k);
  const body = Math.abs(m) === 1 ? `\\sqrt{${k}}` : `${Math.abs(m)}\\sqrt{${k}}`;
  return `${p} ${m < 0 ? '-' : '+'} ${body}`;
}
/** "\frac{3}{4}", "-\frac{3}{4}", "3" — an exact fraction in lowest terms. */
function frac(n, d) {
  if (d === 0) throw new Error('retry: a share with nothing to share between');
  let a = n; let b = d;
  if (b < 0) { a = -a; b = -b; }
  const g = gcd(Math.abs(a), b);
  a /= g; b /= g;
  if (b === 1) return String(a);
  return a < 0 ? `-\\frac{${-a}}{${b}}` : `\\frac{${a}}{${b}}`;
}
/** The same value as a bare exact rational, the spelling a numeric answer takes. */
function ratio(n, d) {
  if (d === 0) throw new Error('retry: a share with nothing to share between');
  let a = n; let b = d;
  if (b < 0) { a = -a; b = -b; }
  const g = gcd(Math.abs(a), b);
  a /= g; b /= g;
  return b === 1 ? String(a) : `${a}/${b}`;
}
/** "\left(3, -4\right)" — the one spelling a pair of readings takes. */
const pointTex = (x, y) => `\\left(${x}, ${y}\\right)`;
/** A root set, smallest first, in the spelling `proveRootSet` accepts. */
const rootsTex = (v, lo, hi) => `${v} = ${lo}, ${v} = ${hi}`;

// ---------------------------------------------------------------------------
// Difficulty.
//
// The gate measures the ladder rather than believing it, so every rung below
// moves something `demandOf` can see: the size of the numbers, whether a sign
// is in play, how many terms have to be held, and how long the derivation is.
// ---------------------------------------------------------------------------
const rung = (d) => Math.max(1, Math.min(5, d | 0)) - 1;
const from = (r, table, d) => { const [lo, hi] = table[rung(d)]; return int(r, lo, hi); };
const one = (r, table, d) => pick(r, table[rung(d)]);

/** The number left under the bar. Squarefree, and it grows with the band. */
const KSET = [
  [2, 3, 5],
  [2, 3, 5, 6],
  [2, 3, 5, 6, 7],
  [2, 3, 5, 6, 7, 10, 11],
  [2, 3, 5, 6, 7, 10, 11, 13, 14, 15],
];
/** The square factor that comes out from under the bar. */
const MSET = [[2, 2], [2, 3], [2, 4], [3, 5], [4, 6]];
/**
 * The same, for the two forms that print TWO roots and reduce both.
 *
 * It starts at one where `MSET` starts at two, because a root with no square
 * inside is a legitimate half of `\sqrt{2} + \sqrt{8}` — the item is still a
 * reduction, it is simply the other root that carries the square. `MSET` may
 * not do that: a simplify item whose radicand holds no square is an item with
 * nothing to take out.
 */
const RMS = [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6]];
/** Roots that carry a sign from band one, for the forms built on a minus. */
const SROOTS = [[-4, 4], [-6, 6], [-7, 7], [-10, 10], [-13, 13]];
/** A whole number standing in front of a root. */
const FRONT = [[2, 4], [3, 6], [4, 9], [5, 13], [6, 18]];
/** The two roots of a factored trinomial. */
const ROOTS = [[1, 4], [1, 6], [-11, 11], [-15, 15], [-19, 19]];
/**
 * The input a squared rule turns at.
 *
 * Separate from `ROOTS` and deliberately smaller, because a rule built from
 * its turn carries `a h^{2}` as its constant term: a turn at 16 with a front
 * number of 8 prints a constant above two thousand, which is a bigger number
 * than the mathematics is about.
 */
const TURNS = [[1, 3], [1, 4], [-5, 5], [-7, 7], [-9, 9]];
/** The number in front of the squared term. */
const LEAD = [[2, 2], [2, 3], [2, 4], [2, 6], [2, 8]];
/** A common factor taken out before anything else. */
const GCFS = [[2, 2], [2, 3], [2, 4], [2, 5], [2, 6]];
/** A loose constant. */
const KONST = [[1, 6], [2, 9], [-12, 12], [-16, 16], [-20, 20]];
/** A reading of the input a rule is worked out at. */
const INPUT = [[1, 4], [1, 6], [-6, 8], [-9, 11], [-12, 13]];

/** Is this whole number a square of a whole number? */
function isWholeSquare(n) {
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

/** Is this whole number free of every square factor above one? */
function squarefree(k) {
  for (let d = 2; d * d <= k; d++) if (k % (d * d) === 0) return false;
  return k >= 1;
}
/** The largest square inside `n`, as `m` with `n = m * m * k`. Proved by squaring back. */
function reduceRoot(n) {
  let m = 1; let k = n;
  for (let d = 2; d * d <= k; d++) while (k % (d * d) === 0) { m *= d; k /= d * d; }
  if (m * m * k !== n) throw new Error('retry: the square factor does not multiply back');
  return { m, k };
}
/**
 * A whole number in `[lo, hi]` that shares no factor with `p`.
 *
 * A difference of two squares whose two numbers share a factor comes apart
 * into two brackets that each still hold it, which is a factorisation stopped
 * one step early. Drawing from the numbers that cannot do that keeps the whole
 * spread of the band available; re-rolling would spend a retry budget on it.
 */
function coprimeTo(r, p, lo, hi) {
  const ok = [];
  for (let c = lo; c <= hi; c++) if (gcd(Math.abs(p), c) === 1) ok.push(c);
  if (!ok.length) throw new Error('retry: every second number shares a factor with the first');
  return pick(r, ok);
}

/**
 * `c\sqrt{n}`, WRITTEN THE WAY THIS UNIT DEMANDS ITS ANSWERS.
 *
 * A skill whose whole subject is simplest form cannot offer options that are
 * not in it. `3\sqrt{9}` is secretly the whole number nine and `3\sqrt{12}`
 * is `6\sqrt{3}`, so a cadet who simplifies every option lands on a shape —
 * one of these is not like the others — instead of on the mathematics. The
 * decoy is the VALUE a wrong reading produces; this prints that value the way
 * the skill demands, so the only difference between the options is which
 * number the cadet got, which is the whole point of a decoy.
 *
 * `null` means the value has no root left in it at all. A whole number
 * standing among radicals is a shape cue in the other direction, so those are
 * dropped rather than printed.
 */
function simplestSurd(c, n) {
  if (!Number.isInteger(c) || !Number.isInteger(n) || n < 1 || c === 0) return null;
  const { m, k } = reduceRoot(n);
  if (k === 1) return null;
  return surd(c * m, k);
}

/** A whole factor of `n` that is NOT a square — what a wrong reading takes out. */
function nonSquareFactor(n) {
  for (let f = 2; f * f <= n; f++) {
    if (n % f === 0 && Math.sqrt(f) % 1 !== 0) return f;
  }
  return 0;
}

/** A draw that is never zero and never plus or minus one. */
const coefOf = (r, table, d) => { const [lo, hi] = table[rung(d)]; return nzc(r, lo, hi); };
/** A signed draw that is never zero. */
const signed = (r, table, d) => { const [lo, hi] = table[rung(d)]; return nz(r, lo, hi); };

// ---------------------------------------------------------------------------
// Situations.
//
// A pack cannot reach the engine's deck of framings, so it keeps its own and
// draws on `sr`, the situation stream, exactly as the deck does. Every entry is
// ONE sentence, and no entry states a number the mathematics does not use.
// ---------------------------------------------------------------------------

/** A square whose side is asked for. */
const SQUARES = [
  { ctx: 'l4.ctx.squarePlate' },
  { ctx: 'l4.ctx.squareBay' },
  { ctx: 'l4.ctx.squarePad' },
  { ctx: 'l4.ctx.squareVat' },
];
/** A square whose area is known and whose side is the unknown. */
const SIDES = [
  { ctx: 'l4.ctx.sideDeck' },
  { ctx: 'l4.ctx.sideTile' },
  { ctx: 'l4.ctx.sideFrame' },
  { ctx: 'l4.ctx.sideHatch' },
];
/** Something thrown, asked about the moment it reaches the ground. */
const LANDINGS = [
  { ctx: 'l4.ctx.landFlare' },
  { ctx: 'l4.ctx.landPod' },
  { ctx: 'l4.ctx.landDrone' },
  { ctx: 'l4.ctx.landBuoy' },
];
/** Two sides at a right angle, and the brace across them. */
const BRACES = [
  { ctx: 'l4.ctx.braceStrut' },
  { ctx: 'l4.ctx.braceMast' },
  { ctx: 'l4.ctx.braceRamp' },
  { ctx: 'l4.ctx.braceHatch' },
];
/** Two lengths of the same kind, joined end to end. */
const MIXES = [
  { ctx: 'l4.ctx.mixRail' },
  { ctx: 'l4.ctx.mixCable' },
  { ctx: 'l4.ctx.mixSeam' },
  { ctx: 'l4.ctx.mixPipe' },
];
/** A rectangle whose area is known and whose sides are not. */
const PLOTS = [
  { ctx: 'l4.ctx.plotBay' },
  { ctx: 'l4.ctx.plotDeck' },
  { ctx: 'l4.ctx.plotField' },
  { ctx: 'l4.ctx.plotStore' },
];
/** A rectangle whose area and one side are known. */
const SHARES = [
  { ctx: 'l4.ctx.shareFloor' },
  { ctx: 'l4.ctx.shareRoll' },
  { ctx: 'l4.ctx.shareTrench' },
  { ctx: 'l4.ctx.shareGrid' },
];
/** Two gates that both have to be shut before a thing stops. */
const GATES = [
  { ctx: 'l4.ctx.gatePair' },
  { ctx: 'l4.ctx.gateValve' },
  { ctx: 'l4.ctx.gateLatch' },
  { ctx: 'l4.ctx.gateRelay' },
];
/** Something thrown, whose height is a squared rule of the time. */
const THROWS = [
  { ctx: 'l4.ctx.throwFlare' },
  { ctx: 'l4.ctx.throwPod' },
  { ctx: 'l4.ctx.throwDrone' },
  { ctx: 'l4.ctx.throwBuoy' },
];
/** A fence of fixed length, and the area it can enclose. */
const FENCES = [
  { ctx: 'l4.ctx.fencePen' },
  { ctx: 'l4.ctx.fenceYard' },
  { ctx: 'l4.ctx.fenceRun' },
  { ctx: 'l4.ctx.fenceLot' },
];
/** A price set against what it takes. */
const PRICES = [
  { ctx: 'l4.ctx.priceTicket' },
  { ctx: 'l4.ctx.pricePart' },
  { ctx: 'l4.ctx.priceRation' },
  { ctx: 'l4.ctx.pricePass' },
];
/** A curve drawn by a cable or an arch. */
const ARCHES = [
  { ctx: 'l4.ctx.archSpan' },
  { ctx: 'l4.ctx.archCable' },
  { ctx: 'l4.ctx.archRib' },
  { ctx: 'l4.ctx.archDome' },
];
/** Two cadets who disagree about one move. */
const DISPUTES = [
  { ctx: 'l4.ctx.disputeWatch' },
  { ctx: 'l4.ctx.disputeBench' },
  { ctx: 'l4.ctx.disputeCheck' },
  { ctx: 'l4.ctx.disputeBay' },
  { ctx: 'l4.ctx.disputeSurvey' },
  { ctx: 'l4.ctx.disputeConsole' },
];

// ===========================================================================
// radical-simplify  —  the largest square comes out from under the bar
//
// A square root asks which number, multiplied by itself, gives the one under
// the bar. When no whole number does, the largest square inside comes out and
// the rest stays under. Every wrong answer worth naming does arithmetic to the
// number under the bar that the factors do not justify: halving it, splitting
// it over a plus, or taking out a factor that is not a square.
//
// The checker proves the square factor by MULTIPLYING IT BACK, so no item here
// is trusted because of how it was built.
// ===========================================================================

/** A radicand that really does hold a square: `n = m * m * k`, `k` squarefree. */
function drawRadicand(r, d) {
  const m = from(r, MSET, d);
  const k = one(r, KSET, d);
  const n = m * m * k;
  const back = reduceRoot(n);
  if (back.m !== m || back.k !== k) throw new Error('retry: the reduction is not the largest square');
  return { m, k, n };
}

/**
 * The wrong readings every simplify item can offer.
 *
 * EVERY ONE OF THEM IS PRINTED IN SIMPLEST FORM. See `simplestSurd`: the decoy
 * is the value a wrong reading arrives at, and this skill's whole subject is
 * how that value is written, so an option carrying an unfinished root turns
 * "which of these is simplest" into a way of answering without doing any
 * mathematics. The guards this used to carry — `isWholeSquare` on what is left
 * under the bar — caught `2\sqrt{4}` and let `3\sqrt{12}` and `3\sqrt{9}`
 * through, because being free of square factors is not the same test as not
 * being a square.
 */
function simplifyDecoys(n, m, k, front = 1) {
  const raw = [
    { v: frac(front * n, 2), m: 'half-the-radicand' },
    { v: simplestSurd(front * m + 1, k), m: 'arith-slip' },
    { v: simplestSurd(Math.max(1, front * m - 1), k), m: 'arith-slip' },
    // Which number came out and which stayed under, the wrong way round.
    { v: simplestSurd(k, front * m), m: 'swapped-roles' },
    { v: simplestSurd(-front * m, k), m: 'sign-slip' },
    // The factor taken out is not a square.
    { v: (() => { const f = nonSquareFactor(n); return f ? simplestSurd(front * f, n / f) : null; })(), m: 'factor-not-a-square' },
    // One factor of the square came out and the other stayed under the bar.
    { v: simplestSurd(front * m, m * k), m: 'perfect-square-left-inside' },
    // The two numbers multiplied instead of one of them coming out.
    { v: simplestSurd(front * m * k, k), m: 'swapped-roles' },
    { v: simplestSurd(front * m + 2, k), m: 'arith-slip' },
  ];
  return raw.filter((o) => o.v != null);
}

const radicalSimplify = [
  {
    id: 'rs-root', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const { m, k, n } = drawRadicand(r, d);
      const math = `\\sqrt{${n}}`;
      return {
        stem: T('l4.ask.pullOutTheSquare'),
        latex: math,
        type: 'expression',
        answer: surd(m, k),
        check: { kind: 'radical', form: 'simplify', math },
        steps: [
          { latex: `\\sqrt{${n}} = \\sqrt{${m * m} \\cdot ${k}}`, why: T('l4.why.largestSquareInside', { sq: m * m }) },
          { latex: `\\sqrt{${m * m} \\cdot ${k}} = ${surd(m, k)}`, why: T('l4.why.squareComesOut', { m }) },
        ],
        distractors: simplifyDecoys(n, m, k),
      };
    },
  },
  {
    id: 'rs-coef', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const { m, k, n } = drawRadicand(r, d);
      const c = from(r, FRONT, d);
      if (!distinct(c, m, k)) throw new Error('retry: repeated number');
      const math = `${c}\\sqrt{${n}}`;
      return {
        stem: T('l4.ask.pullOutTheSquare'),
        latex: math,
        type: 'expression',
        answer: surd(c * m, k),
        check: { kind: 'radical', form: 'simplify', math },
        steps: [
          { latex: `${c}\\sqrt{${n}} = ${c}\\sqrt{${m * m} \\cdot ${k}}`, why: T('l4.why.largestSquareInside', { sq: m * m }) },
          { latex: `${c}\\sqrt{${m * m} \\cdot ${k}} = ${surd(c * m, k)}`, why: T('l4.why.frontTimesWhatCameOut', { c, m }) },
        ],
        distractors: [
          { v: simplestSurd(1, c * n), m: 'coefficient-pulled-under-unsquared' },
          { v: surd(m, k), m: 'partial-rule' },
          ...simplifyDecoys(n, m, k, c),
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'rs-frac', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const { m, k, n } = drawRadicand(r, d);
      const p = pick(r, [2, 3].filter((q) => m % q === 0 && m / q >= 1));
      if (!p) throw new Error('retry: nothing shares this square factor');
      const left = m / p;
      if (left < 1) throw new Error('retry: the share empties the front');
      if (!distinct(p, k, n)) throw new Error('retry: repeated number');
      const math = `\\frac{\\sqrt{${n}}}{${p}}`;
      return {
        stem: T('l4.ask.pullOutTheSquare'),
        latex: math,
        type: 'expression',
        answer: surd(left, k),
        check: { kind: 'radical', form: 'simplify', math },
        steps: [
          { latex: `\\frac{\\sqrt{${n}}}{${p}} = \\frac{${surd(m, k)}}{${p}}`, why: T('l4.why.largestSquareInside', { sq: m * m }) },
          { latex: `\\frac{${surd(m, k)}}{${p}} = ${surd(left, k)}`, why: T('l4.why.shareTheFront', { p }) },
        ],
        // Printed in simplest form, like every other option in this skill —
        // see `simplestSurd`. `\sqrt{n / p}` and `k\sqrt{left}` both held a
        // square whenever the numbers fell that way.
        distractors: [
          { v: n % p === 0 ? simplestSurd(1, n / p) : `\\sqrt{${frac(n, p)}}`, m: 'coefficient-pulled-under-unsquared' },
          { v: surd(m, k), m: 'partial-rule' },
          { v: surd(left + 1, k), m: 'arith-slip' },
          // Only where it is not the partial-rule reading above:
          // `left\sqrt{mk}` is `m\sqrt{k}` exactly when the square that came
          // out is `left` squared.
          ...(left * left === m ? [] : [{ v: simplestSurd(left, m * k), m: 'perfect-square-left-inside' }]),
          { v: frac(n, 2 * p), m: 'half-the-radicand' },
          { v: simplestSurd(k, left), m: 'swapped-roles' },
          { v: surd(p, k), m: 'arith-slip' },
          { v: surd(left + 2, k), m: 'arith-slip' },
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'rs-side', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SQUARES);
      const { m, k, n } = drawRadicand(r, d);
      const heavy = d >= 4;
      const c = heavy ? from(r, FRONT, d) : 1;
      if (heavy && !distinct(c, m, k)) throw new Error('retry: repeated number');
      const math = c === 1 ? `\\sqrt{${n}}` : `${c}\\sqrt{${n}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.pullOutTheSquare')}`,
        latex: math,
        type: 'expression',
        answer: surd(c * m, k),
        check: { kind: 'radical', form: 'simplify', math },
        steps: [
          { latex: `${math} = ${c === 1 ? '' : c}\\sqrt{${m * m} \\cdot ${k}}`, why: T('l4.why.largestSquareInside', { sq: m * m }) },
          { latex: `${c === 1 ? '' : c}\\sqrt{${m * m} \\cdot ${k}} = ${surd(c * m, k)}`, why: T('l4.why.squareComesOut', { m }) },
        ],
        distractors: [
          // ONLY WHERE THERE IS A FRONT NUMBER TO PULL UNDER THE BAR.
          //
          // Below band four this form prints `\sqrt{n}` with nothing in front
          // of it, and `\sqrt{1 \cdot n}` is then the PRINTED QUESTION — the
          // same number as the key, offered as a wrong answer with a
          // misconception tag on it, on 152 of 253 sampled items.
          ...(c === 1 ? [] : [{ v: simplestSurd(1, c * n), m: 'coefficient-pulled-under-unsquared' }]),
          ...simplifyDecoys(n, m, k, c),
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'rs-diagonal', rep: 'context', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, BRACES);
      const lim = [4, 5, 7, 9, 12][rung(d)];
      const a = int(r, 1 + rung(d), lim);
      const b = int(r, 1 + rung(d), lim);
      const n = a * a + b * b;
      const { m, k } = reduceRoot(n);
      if (k === 1) throw new Error('retry: this brace is a whole number');
      if (m === 1) throw new Error('retry: there is no square to take out');
      if (!distinct(a, b, n)) throw new Error('retry: repeated number');
      const math = `\\sqrt{${a * a} + ${b * b}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.pullOutTheSquare')}`,
        latex: math,
        type: 'expression',
        answer: surd(m, k),
        check: { kind: 'radical', form: 'simplify', math },
        steps: [
          { latex: `\\sqrt{${a * a} + ${b * b}} = \\sqrt{${n}}`, why: T('l4.why.addUnderTheBarFirst') },
          { latex: `\\sqrt{${n}} = ${surd(m, k)}`, why: T('l4.why.largestSquareInside', { sq: m * m }) },
        ],
        distractors: [
          { v: String(a + b), m: 'root-splits-over-sum' },
          ...simplifyDecoys(n, m, k),
        ],
      };
    },
  },
  {
    id: 'rs-dispute', rep: 'verbal', dMin: 1, dMax: 4,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const { m, k, n } = drawRadicand(r, d);
      const math = `\\sqrt{${n}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.pullOutTheSquare')}`,
        latex: math,
        type: 'expression',
        answer: surd(m, k),
        check: { kind: 'radical', form: 'simplify', math },
        steps: [
          { latex: `\\sqrt{${n}} = \\sqrt{${m * m} \\cdot ${k}}`, why: T('l4.why.largestSquareInside', { sq: m * m }) },
          { latex: `\\sqrt{${m * m} \\cdot ${k}} = ${surd(m, k)}`, why: T('l4.why.squareComesOut', { m }) },
        ],
        distractors: simplifyDecoys(n, m, k),
      };
    },
  },
];

// ===========================================================================
// radical-arith  —  roots joined, opened, and moved off a denominator
//
// Two roots add only when the number under the bar is the same. Two roots
// always multiply, and a root times itself is the number under the bar. The
// checker works the whole printed expression out in Q(sqrt k), so a wrong join
// is caught by arithmetic rather than by a rule about arithmetic.
// ===========================================================================

const radicalArith = [
  {
    id: 'ra-like', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const k = one(r, KSET, d);
      const p = from(r, FRONT, d);
      const q = from(r, FRONT, d);
      const minus = d >= 3 && r() < 0.5;
      const total = minus ? p - q : p + q;
      if (total <= 0) throw new Error('retry: this take-away empties the root');
      if (!distinct(p, q, total)) throw new Error('retry: repeated number');
      const math = `${p}\\sqrt{${k}} ${minus ? '-' : '+'} ${q}\\sqrt{${k}}`;
      return {
        stem: T('l4.ask.joinTheRoots'),
        latex: math,
        type: 'expression',
        answer: surd(total, k),
        check: { kind: 'radical', form: 'combine', math },
        steps: [
          { latex: `${math} = \\left(${p} ${minus ? '-' : '+'} ${q}\\right)\\sqrt{${k}}`, why: T('l4.why.sameUnderTheBar', { k }) },
          { latex: `\\left(${p} ${minus ? '-' : '+'} ${q}\\right)\\sqrt{${k}} = ${surd(total, k)}`, why: T('l4.why.countTheRoots') },
        ],
        // Every option is printed in simplest form — see `simplestSurd`. The
        // key of a radical item is demanded in simplified roots, so an option
        // that still holds a square is one a cadet could not hand in even if
        // they meant it, and it is a shape they can pick without reading.
        distractors: [
          { v: simplestSurd(total, 2 * k), m: 'both-parts-added' },
          { v: simplestSurd(1, p + q + k), m: 'whole-number-absorbed' },
          { v: surd(p, k), m: 'partial-rule' },
          { v: surd(total + 1, k), m: 'arith-slip' },
          { v: surd(Math.max(1, total - 1), k), m: 'arith-slip' },
          { v: simplestSurd(k, total), m: 'swapped-roles' },
          { v: surd(p * q, k), m: 'unlike-radicands-added' },
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'ra-reduce', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const k = one(r, KSET, d);
      const [lo, hi] = RMS[rung(d)];
      const m1 = int(r, lo, hi);
      const m2 = int(r, lo, hi);
      if (m1 === m2) throw new Error('retry: two equal squares hide which one moved');
      const n1 = m1 * m1 * k;
      const n2 = m2 * m2 * k;
      if (!distinct(n1, n2)) throw new Error('retry: repeated number');
      const math = `\\sqrt{${n1}} + \\sqrt{${n2}}`;
      return {
        stem: T('l4.ask.joinTheRoots'),
        latex: math,
        type: 'expression',
        answer: surd(m1 + m2, k),
        check: { kind: 'radical', form: 'combine', math },
        steps: [
          { latex: `\\sqrt{${n1}} + \\sqrt{${n2}} = ${surd(m1, k)} + ${surd(m2, k)}`, why: T('l4.why.takeEachSquareOut') },
          { latex: `${surd(m1, k)} + ${surd(m2, k)} = ${surd(m1 + m2, k)}`, why: T('l4.why.countTheRoots') },
        ],
        distractors: [
          { v: simplestSurd(1, n1 + n2), m: 'unlike-radicands-added' },
          { v: simplestSurd(m1 + m2, 2 * k), m: 'both-parts-added' },
          { v: surd(m1 * m2, k), m: 'product-of-roots-added' },
          { v: surd(m1, k), m: 'partial-rule' },
          { v: surd(m1 + m2 + 1, k), m: 'arith-slip' },
          { v: simplestSurd(k, m1 + m2), m: 'swapped-roles' },
          // The first root is left as it stands and the second is read as a
          // whole number. Printed the way this unit writes a root, so the
          // option is a wrong VALUE and not an unfinished spelling.
          { v: `${surd(m1, k)} + ${m2}`, m: 'whole-number-absorbed' },
          { v: surd(m1 + m2 + 2, k), m: 'arith-slip' },
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'ra-share', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const k = one(r, KSET, d);
      const t = from(r, FRONT, d);
      const c = t * k;
      if (!distinct(t, k, c)) throw new Error('retry: repeated number');
      const math = `\\frac{${c}}{\\sqrt{${k}}}`;
      return {
        stem: T('l4.ask.clearTheBottom'),
        latex: math,
        type: 'expression',
        answer: surd(t, k),
        check: { kind: 'radical', form: 'combine', math },
        steps: [
          { latex: `\\frac{${c}}{\\sqrt{${k}}} = \\frac{${c}\\sqrt{${k}}}{${k}}`, why: T('l4.why.timesTheSameRoot', { k }) },
          { latex: `\\frac{${c}\\sqrt{${k}}}{${k}} = ${surd(t, k)}`, why: T('l4.why.shareTheFront', { p: k }) },
        ],
        distractors: [
          { v: frac(c, k * k), m: 'denominator-radical-left' },
          { v: String(c), m: 'partial-rule' },
          // `\sqrt{ck}` IS `k\sqrt{t}` — the swapped-roles reading below —
          // because the top of this fraction is `t` lots of `k`. It was the
          // same number under two spellings on 141 of 148 sampled items, so a
          // four-way choice was a three-way choice. The whole number goes under
          // the bar by being ADDED to what is there, which is the shape the
          // other two forms of this skill already use for the same reading.
          { v: simplestSurd(1, c + k), m: 'whole-number-absorbed' },
          { v: surd(c, k), m: 'arith-slip' },
          { v: surd(t + 1, k), m: 'arith-slip' },
          { v: simplestSurd(k, t), m: 'swapped-roles' },
          { v: simplestSurd(1, t), m: 'product-of-roots-added' },
          { v: surd(t + 2, k), m: 'arith-slip' },
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'ra-open', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const k = one(r, KSET, d);
      const c = from(r, FRONT, d);
      if (!distinct(c, k)) throw new Error('retry: repeated number');
      const math = `\\sqrt{${k}}\\left(${c} + \\sqrt{${k}}\\right)`;
      return {
        stem: T('l4.ask.openAndTidy'),
        latex: math,
        type: 'expression',
        answer: mixed(k, c, k),
        check: { kind: 'radical', form: 'combine', math },
        steps: [
          { latex: `${math} = ${c}\\sqrt{${k}} + \\sqrt{${k}} \\cdot \\sqrt{${k}}`, why: T('l4.why.shareTheRootOver') },
          { latex: `${c}\\sqrt{${k}} + \\sqrt{${k}} \\cdot \\sqrt{${k}} = ${mixed(k, c, k)}`, why: T('l4.why.rootTimesItself', { k }) },
        ],
        distractors: [
          { v: `${c}\\sqrt{${k}} + \\sqrt{${k}}`, m: 'square-of-a-root-not-cancelled' },
          { v: simplestSurd(1, k + c), m: 'whole-number-absorbed' },
          { v: surd(c, k), m: 'partial-rule' },
          { v: mixed(k + 1, c, k), m: 'arith-slip' },
          { v: mixed(k, c + 1, k), m: 'arith-slip' },
          { v: mixed(-k, c, k), m: 'sign-slip' },
          { v: surd(c + k, k), m: 'both-parts-added' },
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'ra-mix', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, MIXES);
      const k = one(r, KSET, d);
      const [lo, hi] = RMS[rung(d)];
      const m1 = int(r, lo, hi);
      const m2 = int(r, lo, hi);
      if (m1 === m2) throw new Error('retry: two equal squares hide which one moved');
      const n1 = m1 * m1 * k;
      const n2 = m2 * m2 * k;
      if (!distinct(n1, n2)) throw new Error('retry: repeated number');
      const math = `\\sqrt{${n1}} + \\sqrt{${n2}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.joinTheRoots')}`,
        latex: math,
        type: 'expression',
        answer: surd(m1 + m2, k),
        check: { kind: 'radical', form: 'combine', math },
        steps: [
          { latex: `\\sqrt{${n1}} + \\sqrt{${n2}} = ${surd(m1, k)} + ${surd(m2, k)}`, why: T('l4.why.takeEachSquareOut') },
          { latex: `${surd(m1, k)} + ${surd(m2, k)} = ${surd(m1 + m2, k)}`, why: T('l4.why.countTheRoots') },
        ],
        distractors: [
          { v: simplestSurd(1, n1 + n2), m: 'unlike-radicands-added' },
          { v: simplestSurd(m1 + m2, 2 * k), m: 'both-parts-added' },
          { v: surd(m1 * m2, k), m: 'product-of-roots-added' },
          { v: surd(m1, k), m: 'partial-rule' },
          { v: surd(m1 + m2 + 1, k), m: 'arith-slip' },
          { v: simplestSurd(k, m1 + m2), m: 'swapped-roles' },
          { v: `${surd(m1, k)} + ${m2}`, m: 'whole-number-absorbed' },
          { v: surd(m1 + m2 + 2, k), m: 'arith-slip' },
        ].filter((o) => o.v != null),
      };
    },
  },
  {
    id: 'ra-dispute', rep: 'verbal', dMin: 1, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const k = one(r, KSET, d);
      const p = from(r, FRONT, d);
      const q = from(r, FRONT, d);
      const total = p + q;
      if (!distinct(p, q, total)) throw new Error('retry: repeated number');
      const math = `${p}\\sqrt{${k}} + ${q}\\sqrt{${k}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.joinTheRoots')}`,
        latex: math,
        type: 'expression',
        answer: surd(total, k),
        check: { kind: 'radical', form: 'combine', math },
        steps: [
          { latex: `${math} = \\left(${p} + ${q}\\right)\\sqrt{${k}}`, why: T('l4.why.sameUnderTheBar', { k }) },
          { latex: `\\left(${p} + ${q}\\right)\\sqrt{${k}} = ${surd(total, k)}`, why: T('l4.why.countTheRoots') },
        ],
        distractors: [
          { v: simplestSurd(total, 2 * k), m: 'both-parts-added' },
          { v: surd(p * q, k), m: 'product-of-roots-added' },
          { v: simplestSurd(1, p + q + k), m: 'whole-number-absorbed' },
          { v: surd(p, k), m: 'partial-rule' },
          { v: surd(total + 1, k), m: 'arith-slip' },
          { v: simplestSurd(k, total), m: 'swapped-roles' },
          { v: simplestSurd(total, k + 1), m: 'unlike-radicands-added' },
          { v: surd(total + 2, k), m: 'arith-slip' },
        ].filter((o) => o.v != null),
      };
    },
  },
];

// ===========================================================================
// factor-trinomial-monic  —  three terms back into two brackets
//
// Multiplying two brackets makes a three-term expression. Factoring runs that
// backwards: find the pair of numbers that multiplies to the last term and
// adds to the middle one. The checker proves the answer at fourteen values AND
// proves it is a product, so retyping the prompt earns nothing.
// ===========================================================================

/** Every whole pair that multiplies to `c`, smaller first. Signs included. */
function factorPairs(c) {
  const out = [];
  const a = Math.abs(c);
  for (let s = 1; s * s <= a; s++) {
    if (a % s) continue;
    const t = a / s;
    if (c > 0) { out.push([s, t]); out.push([-s, -t]); }
    else { out.push([-s, t]); out.push([s, -t]); }
  }
  return out;
}

/** A pair that multiplies to `c` but does NOT add to `b` — a real wrong split. */
function wrongSplit(c, b) {
  for (const [s, t] of factorPairs(c)) if (s + t !== b) return [s, t];
  return null;
}

/** Two brackets, smaller constant first, in this pack's one spelling. */
const twoBrackets = (v, p, q, a1 = 1, a2 = 1) => (a1 === a2 && p > q
  ? `${wrap(lin(a1, v, q))}${wrap(lin(a2, v, p))}`
  : `${wrap(lin(a1, v, p))}${wrap(lin(a2, v, q))}`);

const factorTrinomialMonic = [
  {
    id: 'fm-plus', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = int(r, 1, Math.max(2, hi));
      const q = int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: two equal roots are a squared bracket');
      void lo;
      const b = p + q; const c = p * q;
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = twoBrackets(v, p, q);
      const bad = wrongSplit(c, b);
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${v}^{2} + \\left(${p} + ${q}\\right)${v} + ${p} \\cdot ${q}`, why: T('l4.why.pairMultipliesAndAdds', { c, b }) },
          { latex: `${v}^{2} + \\left(${p} + ${q}\\right)${v} + ${p} \\cdot ${q} = ${ans}`, why: T('l4.why.eachNumberItsBracket') },
        ],
        distractors: [
          { v: twoBrackets(v, c, 1), m: 'product-and-sum-swapped' },
          bad ? { v: twoBrackets(v, bad[0], bad[1]), m: 'constant-split-only' } : null,
          { v: `${-p}, ${-q}`, m: 'answer-given-as-roots' },
          { v: twoBrackets(v, -p, -q), m: 'sign-both-positive' },
          { v: twoBrackets(v, p + 1, q), m: 'arith-slip' },
          { v: wrap(lin(1, v, p)), m: 'partial-rule' },
          { v: twoBrackets(v, b, c), m: 'product-and-sum-swapped' },
        ].filter(Boolean),
      };
    },
  },
  {
    id: 'fm-signs', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = SROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: two equal roots are a squared bracket');
      if (p > 0 && q > 0) throw new Error('retry: this form carries at least one minus');
      const b = p + q; const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a difference of squares, not a trinomial');
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = twoBrackets(v, p, q);
      const bad = wrongSplit(c, b);
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${v}^{2} + \\left(${p} + ${q}\\right)${v} + \\left(${p}\\right)\\left(${q}\\right)`, why: T('l4.why.pairMultipliesAndAdds', { c, b }) },
          { latex: `${v}^{2} + \\left(${p} + ${q}\\right)${v} + \\left(${p}\\right)\\left(${q}\\right) = ${ans}`, why: T('l4.why.eachNumberItsBracket') },
        ],
        distractors: [
          { v: twoBrackets(v, Math.abs(p), Math.abs(q)), m: 'sign-both-positive' },
          bad ? { v: twoBrackets(v, bad[0], bad[1]), m: 'constant-split-only' } : null,
          { v: `${-p}, ${-q}`, m: 'answer-given-as-roots' },
          { v: twoBrackets(v, c, 1), m: 'product-and-sum-swapped' },
          { v: twoBrackets(v, -p, -q), m: 'sign-both-positive' },
          { v: twoBrackets(v, p + 1, q), m: 'arith-slip' },
          { v: wrap(lin(1, v, p)), m: 'partial-rule' },
        ].filter(Boolean),
      };
    },
  },
  {
    id: 'fm-square', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, Math.max(2, lo), hi);
      if (Math.abs(p) < 2) throw new Error('retry: too small to read');
      const b = 2 * p; const c = p * p;
      if (!distinct(p, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = `${wrap(lin(1, v, p))}^{2}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${v}^{2} + ${b}${v} + ${p} \\cdot ${p}`, why: T('l4.why.constantIsASquare', { p: Math.abs(p) }) },
          { latex: `${v}^{2} + ${b}${v} + ${p} \\cdot ${p} = ${ans}`, why: T('l4.why.sameBracketTwice') },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, c))}^{2}`, m: 'perfect-square-constant-copied' },
          { v: twoBrackets(v, 1, c), m: 'constant-split-only' },
          { v: `${wrap(lin(1, v, -p))}^{2}`, m: 'sign-both-positive' },
          { v: String(-p), m: 'answer-given-as-roots' },
          { v: twoBrackets(v, p, b), m: 'product-and-sum-swapped' },
          { v: `${wrap(lin(1, v, p + 1))}^{2}`, m: 'arith-slip' },
          { v: wrap(lin(1, v, p)), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'fm-gcf', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const g = from(r, GCFS, d);
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: two equal roots are a squared bracket');
      const b = p + q; const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: nothing to split');
      if (!distinct(g, p, q, g * b, g * c)) throw new Error('retry: repeated number');
      const math = quad(g, g * b, g * c, v);
      const ans = `${g}${twoBrackets(v, p, q)}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${g}\\left(${quad(1, b, c, v)}\\right)`, why: T('l4.why.commonFactorFirst', { g }) },
          { latex: `${g}\\left(${quad(1, b, c, v)}\\right) = ${ans}`, why: T('l4.why.pairMultipliesAndAdds', { c, b }) },
        ],
        distractors: [
          { v: twoBrackets(v, p, q), m: 'gcf-not-taken-first' },
          { v: `${g}${twoBrackets(v, g * p, q)}`, m: 'gcf-not-taken-first' },
          { v: twoBrackets(v, g * c, 1), m: 'product-and-sum-swapped' },
          { v: `${g}${twoBrackets(v, -p, -q)}`, m: 'sign-both-positive' },
          { v: `${-p}, ${-q}`, m: 'answer-given-as-roots' },
          { v: `${g}${twoBrackets(v, p + 1, q)}`, m: 'arith-slip' },
          { v: `${g}${wrap(lin(1, v, p))}`, m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'fm-area', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, PLOTS);
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const p = int(r, 1, Math.max(2, Math.abs(hi)));
      const q = int(r, 1, Math.max(2, Math.abs(hi)));
      if (p === q) throw new Error('retry: two equal sides make a square');
      const b = p + q; const c = p * q;
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = twoBrackets(v, p, q);
      const bad = wrongSplit(c, b);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.areaAsProduct')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${v}^{2} + \\left(${p} + ${q}\\right)${v} + ${p} \\cdot ${q}`, why: T('l4.why.pairMultipliesAndAdds', { c, b }) },
          { latex: `${v}^{2} + \\left(${p} + ${q}\\right)${v} + ${p} \\cdot ${q} = ${ans}`, why: T('l4.why.eachNumberItsBracket') },
        ],
        distractors: [
          { v: twoBrackets(v, c, 1), m: 'product-and-sum-swapped' },
          bad ? { v: twoBrackets(v, bad[0], bad[1]), m: 'constant-split-only' } : null,
          { v: `${p}, ${q}`, m: 'answer-given-as-roots' },
          { v: twoBrackets(v, -p, -q), m: 'sign-both-positive' },
          { v: twoBrackets(v, p + 1, q), m: 'arith-slip' },
          { v: wrap(lin(1, v, p)), m: 'partial-rule' },
          { v: twoBrackets(v, b, c), m: 'product-and-sum-swapped' },
        ].filter(Boolean),
      };
    },
  },
  {
    id: 'fm-dispute', rep: 'verbal', dMin: 1, dMax: 4,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const p = int(r, 1, Math.max(2, Math.abs(hi)));
      const q = int(r, 1, Math.max(2, Math.abs(hi)));
      if (p === q) throw new Error('retry: two equal roots are a squared bracket');
      const b = p + q; const c = p * q;
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = twoBrackets(v, p, q);
      const bad = wrongSplit(c, b);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.writeAsProduct')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${v}^{2} + \\left(${p} + ${q}\\right)${v} + ${p} \\cdot ${q}`, why: T('l4.why.pairMultipliesAndAdds', { c, b }) },
          { latex: `${v}^{2} + \\left(${p} + ${q}\\right)${v} + ${p} \\cdot ${q} = ${ans}`, why: T('l4.why.eachNumberItsBracket') },
        ],
        distractors: [
          bad ? { v: twoBrackets(v, bad[0], bad[1]), m: 'constant-split-only' } : null,
          { v: twoBrackets(v, c, 1), m: 'product-and-sum-swapped' },
          { v: `${-p}, ${-q}`, m: 'answer-given-as-roots' },
          { v: twoBrackets(v, -p, -q), m: 'sign-both-positive' },
          { v: twoBrackets(v, p, q + 1), m: 'arith-slip' },
          { v: wrap(lin(1, v, q)), m: 'partial-rule' },
          { v: twoBrackets(v, b, c), m: 'product-and-sum-swapped' },
        ].filter(Boolean),
      };
    },
  },
];

// ===========================================================================
// factor-trinomial-lead  —  the squared term carries a number
//
// The number in front of the squared term has to be SHARED between the two
// brackets, so the pair of numbers now has to multiply to the first
// coefficient times the last one. Every item guards that the three
// coefficients share no common factor, because a trinomial that still holds a
// common factor is a different question asked by accident.
// ===========================================================================

/** `(a1 v + c1)(a2 v + c2)` expanded, as [a, b, c]. */
const expandTwo = (a1, c1, a2, c2) => [a1 * a2, a1 * c2 + a2 * c1, c1 * c2];

const factorTrinomialLead = [
  {
    id: 'fl-simple', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [, hi] = ROOTS[rung(d)];
      const c1 = int(r, 1, Math.max(2, Math.abs(hi)));
      const c2 = int(r, 1, Math.max(2, Math.abs(hi)));
      const [a, b, c] = expandTwo(a1, c1, 1, c2);
      if (gcd(gcd(a, b), c) !== 1) throw new Error('retry: a common factor comes out first');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${a} \\cdot ${c} = ${a * c}`, why: T('l4.why.firstTimesLast', { a, c }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.shareTheFrontNumber', { a }) },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, c1))}${wrap(lin(1, v, c2))}`, m: 'leading-coefficient-ignored' },
          { v: `${wrap(lin(a1, v, c1))}${wrap(lin(a1, v, c2))}`, m: 'leading-coefficient-in-both' },
          { v: `${wrap(lin(a1, v, c2))}${wrap(lin(1, v, c1))}`, m: 'outer-inner-swapped' },
          { v: `${wrap(lin(a1, v, -c1))}${wrap(lin(1, v, -c2))}`, m: 'sign-both-positive' },
          { v: `${wrap(lin(a1, v, c1 + 1))}${wrap(lin(1, v, c2))}`, m: 'arith-slip' },
          { v: wrap(lin(a1, v, c1)), m: 'partial-rule' },
          { v: `${-c1}, ${-c2}`, m: 'answer-given-as-roots' },
        ],
      };
    },
  },
  {
    id: 'fl-signs', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [lo, hi] = SROOTS[rung(d)];
      const c1 = nz(r, lo, hi);
      const c2 = nz(r, lo, hi);
      if (c1 > 0 && c2 > 0) throw new Error('retry: this form carries at least one minus');
      const [a, b, c] = expandTwo(a1, c1, 1, c2);
      if (b === 0 || c === 0) throw new Error('retry: nothing to split');
      if (gcd(gcd(a, Math.abs(b)), Math.abs(c)) !== 1) throw new Error('retry: a common factor comes out first');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${a} \\cdot \\left(${c}\\right) = ${a * c}`, why: T('l4.why.firstTimesLast', { a, c }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.shareTheFrontNumber', { a }) },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, c1))}${wrap(lin(1, v, c2))}`, m: 'leading-coefficient-ignored' },
          { v: `${wrap(lin(a1, v, c1))}${wrap(lin(a1, v, c2))}`, m: 'leading-coefficient-in-both' },
          { v: `${wrap(lin(a1, v, c2))}${wrap(lin(1, v, c1))}`, m: 'outer-inner-swapped' },
          { v: `${wrap(lin(a1, v, Math.abs(c1)))}${wrap(lin(1, v, Math.abs(c2)))}`, m: 'sign-both-positive' },
          { v: `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2 + 1))}`, m: 'arith-slip' },
          { v: wrap(lin(1, v, c2)), m: 'partial-rule' },
          { v: `${-c1}, ${-c2}`, m: 'answer-given-as-roots' },
        ],
      };
    },
  },
  {
    id: 'fl-square', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const p = from(r, LEAD, d);
      const [lo, hi] = ROOTS[rung(d)];
      const q = nz(r, Math.max(2, lo), hi);
      if (Math.abs(q) < 2) throw new Error('retry: too small to read');
      const [a, b, c] = expandTwo(p, q, p, q);
      if (gcd(gcd(a, Math.abs(b)), Math.abs(c)) !== 1) throw new Error('retry: a common factor comes out first');
      if (!distinct(a, b, c, p, q)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = `${wrap(lin(p, v, q))}^{2}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${a}${v}^{2} = \\left(${p}${v}\\right)^{2}`, why: T('l4.why.frontIsASquare', { p }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.sameBracketTwice') },
        ],
        distractors: [
          { v: `${wrap(lin(p, v, c))}^{2}`, m: 'perfect-square-constant-copied' },
          { v: `${wrap(lin(1, v, q))}^{2}`, m: 'leading-coefficient-ignored' },
          { v: `${wrap(lin(a, v, q))}^{2}`, m: 'leading-coefficient-in-both' },
          { v: `${wrap(lin(p, v, -q))}^{2}`, m: 'sign-both-positive' },
          { v: `${wrap(lin(p, v, q + 1))}^{2}`, m: 'arith-slip' },
          { v: wrap(lin(p, v, q)), m: 'partial-rule' },
          { v: `${wrap(lin(p, v, q))}${wrap(lin(1, v, q))}`, m: 'outer-inner-swapped' },
        ],
      };
    },
  },
  {
    id: 'fl-both', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a1 = int(r, 2, 2 + rung(d));
      const a2 = int(r, 2, 2 + rung(d));
      // TWO EQUAL FRONT NUMBERS MAKE THE OUTER/INNER SWAP THE SAME PRODUCT.
      // `(2x + 3)(2x + 9)` and `(2x + 9)(2x + 3)` are one answer written twice,
      // so the swap this form exists to name would be offered as a wrong option
      // that is in fact right — and `_accepts` in the rig would mark a cadet who
      // reached for it CORRECT while the option set called it a distractor.
      if (a1 === a2) throw new Error('retry: equal front numbers make the swap the same product');
      const [lo, hi] = ROOTS[rung(d)];
      const c1 = nz(r, lo, hi);
      const c2 = nz(r, lo, hi);
      const [a, b, c] = expandTwo(a1, c1, a2, c2);
      if (b === 0 || c === 0) throw new Error('retry: nothing to split');
      if (gcd(gcd(a, Math.abs(b)), Math.abs(c)) !== 1) throw new Error('retry: a common factor comes out first');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = `${wrap(lin(a1, v, c1))}${wrap(lin(a2, v, c2))}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${a} \\cdot \\left(${c}\\right) = ${a * c}`, why: T('l4.why.firstTimesLast', { a, c }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.shareTheFrontNumber', { a }) },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, c1))}${wrap(lin(1, v, c2))}`, m: 'leading-coefficient-ignored' },
          { v: `${wrap(lin(a, v, c1))}${wrap(lin(a, v, c2))}`, m: 'leading-coefficient-in-both' },
          { v: `${wrap(lin(a1, v, c2))}${wrap(lin(a2, v, c1))}`, m: 'outer-inner-swapped' },
          { v: `${wrap(lin(a1, v, Math.abs(c1)))}${wrap(lin(a2, v, Math.abs(c2)))}`, m: 'sign-both-positive' },
          { v: `${wrap(lin(a1, v, c1 + 1))}${wrap(lin(a2, v, c2))}`, m: 'arith-slip' },
          { v: wrap(lin(a1, v, c1)), m: 'partial-rule' },
          { v: `${-c1}, ${-c2}`, m: 'answer-given-as-roots' },
        ],
      };
    },
  },
  {
    id: 'fl-area', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, PLOTS);
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [, hi] = ROOTS[rung(d)];
      const c1 = int(r, 1, Math.max(2, Math.abs(hi)));
      const c2 = int(r, 1, Math.max(2, Math.abs(hi)));
      const [a, b, c] = expandTwo(a1, c1, 1, c2);
      if (gcd(gcd(a, b), c) !== 1) throw new Error('retry: a common factor comes out first');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.areaAsProduct')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${a} \\cdot ${c} = ${a * c}`, why: T('l4.why.firstTimesLast', { a, c }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.shareTheFrontNumber', { a }) },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, c1))}${wrap(lin(1, v, c2))}`, m: 'leading-coefficient-ignored' },
          { v: `${wrap(lin(a1, v, c1))}${wrap(lin(a1, v, c2))}`, m: 'leading-coefficient-in-both' },
          { v: `${wrap(lin(a1, v, c2))}${wrap(lin(1, v, c1))}`, m: 'outer-inner-swapped' },
          { v: `${wrap(lin(a1, v, c1 + 1))}${wrap(lin(1, v, c2))}`, m: 'arith-slip' },
          { v: wrap(lin(a1, v, c1)), m: 'partial-rule' },
          { v: `${c1}, ${c2}`, m: 'answer-given-as-roots' },
          { v: `${wrap(lin(a1, v, -c1))}${wrap(lin(1, v, -c2))}`, m: 'sign-both-positive' },
        ],
      };
    },
  },
  {
    id: 'fl-dispute', rep: 'verbal', dMin: 1, dMax: 4,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [, hi] = ROOTS[rung(d)];
      const c1 = int(r, 1, Math.max(2, Math.abs(hi)));
      const c2 = int(r, 1, Math.max(2, Math.abs(hi)));
      const [a, b, c] = expandTwo(a1, c1, 1, c2);
      if (gcd(gcd(a, b), c) !== 1) throw new Error('retry: a common factor comes out first');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.writeAsProduct')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${a} \\cdot ${c} = ${a * c}`, why: T('l4.why.firstTimesLast', { a, c }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.shareTheFrontNumber', { a }) },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, c1))}${wrap(lin(1, v, c2))}`, m: 'leading-coefficient-ignored' },
          { v: `${wrap(lin(a1, v, c1))}${wrap(lin(a1, v, c2))}`, m: 'leading-coefficient-in-both' },
          { v: `${wrap(lin(a1, v, c2))}${wrap(lin(1, v, c1))}`, m: 'outer-inner-swapped' },
          { v: `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2 + 1))}`, m: 'arith-slip' },
          { v: wrap(lin(1, v, c2)), m: 'partial-rule' },
          { v: `${c1}, ${c2}`, m: 'answer-given-as-roots' },
          { v: `${wrap(lin(a1, v, -c1))}${wrap(lin(1, v, -c2))}`, m: 'sign-both-positive' },
        ],
      };
    },
  },
];

// ===========================================================================
// difference-of-squares  —  a square take away a square
//
// Two squares with a minus between them come apart into a sum bracket and a
// difference bracket. Two squares with a PLUS between them do not come apart
// at all, and the only honest way to say so in three languages is to ask where
// the rule is zero: "no solution" is a localised answer, a bare "no" is not.
// ===========================================================================

const differenceOfSquares = [
  {
    id: 'dq-plain', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const c = int(r, 2, Math.max(3, Math.abs(hi)));
      const math = poly([[1, 2], [-c * c, 0]], v);
      const ans = `${wrap(lin(1, v, c))}${wrap(lin(1, v, -c))}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${v}^{2} - ${c}^{2}`, why: T('l4.why.bothPartsAreSquares', { c }) },
          { latex: `${v}^{2} - ${c}^{2} = ${ans}`, why: T('l4.why.onePlusOneMinus') },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, -c))}${wrap(lin(1, v, -c))}`, m: 'both-signs-same' },
          { v: `${wrap(lin(1, v, c * c))}${wrap(lin(1, v, -c * c))}`, m: 'coefficient-root-skipped' },
          { v: `${wrap(lin(1, v, c))}^{2}`, m: 'both-signs-same' },
          { v: `${-c}, ${c}`, m: 'answer-given-as-roots' },
          { v: wrap(lin(1, v, c)), m: 'partial-rule' },
          { v: `${wrap(lin(1, v, c))}${wrap(lin(1, v, -c - 1))}`, m: 'arith-slip' },
          { v: poly([[1, 2], [c * c, 0]], v), m: 'sum-of-squares-factored' },
        ],
      };
    },
  },
  {
    id: 'dq-coef', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const p = from(r, LEAD, d);
      const [, hi] = ROOTS[rung(d)];
      // THE SECOND NUMBER SHARES NOTHING WITH THE FIRST.
      //
      // `4x^{2} - 16` is `\left(2x + 4\right)\left(2x - 4\right)`, and that is
      // not finished: a two is still inside each bracket. The same skill's
      // dq-gcf takes a common factor out before it does anything else, so
      // shipping this would be the bank contradicting itself and marking a
      // cadet who wrote the complete factorisation wrong. It is drawn from the
      // numbers that cannot do that rather than re-rolled, so a retry budget
      // can never be what decides it.
      const c = coprimeTo(r, p, 2, Math.max(3, Math.abs(hi)));
      if (!distinct(p, c, p * p, c * c)) throw new Error('retry: repeated number');
      const math = poly([[p * p, 2], [-c * c, 0]], v);
      const ans = `${wrap(lin(p, v, c))}${wrap(lin(p, v, -c))}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = \\left(${p}${v}\\right)^{2} - ${c}^{2}`, why: T('l4.why.bothPartsAreSquares', { c }) },
          { latex: `\\left(${p}${v}\\right)^{2} - ${c}^{2} = ${ans}`, why: T('l4.why.onePlusOneMinus') },
        ],
        distractors: [
          { v: `${wrap(lin(p * p, v, c))}${wrap(lin(p * p, v, -c))}`, m: 'coefficient-root-skipped' },
          { v: `${wrap(lin(p, v, -c))}${wrap(lin(p, v, -c))}`, m: 'both-signs-same' },
          { v: `${wrap(lin(p, v, c * c))}${wrap(lin(p, v, -c * c))}`, m: 'coefficient-root-skipped' },
          { v: `${wrap(lin(1, v, c))}${wrap(lin(1, v, -c))}`, m: 'coefficient-root-skipped' },
          { v: wrap(lin(p, v, c)), m: 'partial-rule' },
          { v: `${wrap(lin(p, v, c))}${wrap(lin(p, v, -c - 1))}`, m: 'arith-slip' },
          { v: poly([[p * p, 2], [c * c, 0]], v), m: 'sum-of-squares-factored' },
        ],
      };
    },
  },
  {
    id: 'dq-gcf', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const g = from(r, GCFS, d);
      const [, hi] = ROOTS[rung(d)];
      const c = int(r, 2, Math.max(3, Math.abs(hi)));
      if (!distinct(g, c, c * c, g * c * c)) throw new Error('retry: repeated number');
      const math = poly([[g, 3], [-g * c * c, 1]], v);
      const ans = `${g}${v}${wrap(lin(1, v, c))}${wrap(lin(1, v, -c))}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = ${g}${v}\\left(${poly([[1, 2], [-c * c, 0]], v)}\\right)`, why: T('l4.why.commonFactorFirst', { g }) },
          { latex: `${g}${v}\\left(${poly([[1, 2], [-c * c, 0]], v)}\\right) = ${ans}`, why: T('l4.why.onePlusOneMinus') },
        ],
        distractors: [
          { v: `${g}${wrap(lin(1, v, c))}${wrap(lin(1, v, -c))}`, m: 'gcf-not-taken-first' },
          { v: `${g}${v}${wrap(lin(1, v, -c))}${wrap(lin(1, v, -c))}`, m: 'both-signs-same' },
          { v: `${g}${v}${wrap(lin(1, v, c * c))}${wrap(lin(1, v, -c * c))}`, m: 'coefficient-root-skipped' },
          { v: `${v}${wrap(lin(1, v, c))}${wrap(lin(1, v, -c))}`, m: 'gcf-not-taken-first' },
          { v: `${g}${v}${wrap(lin(1, v, c))}`, m: 'partial-rule' },
          { v: `${g}${v}${wrap(lin(1, v, c))}${wrap(lin(1, v, -c - 1))}`, m: 'arith-slip' },
          { v: `${-c}, 0, ${c}`, m: 'answer-given-as-roots' },
        ],
      };
    },
  },
  {
    id: 'dq-pick', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const c = int(r, 2, Math.max(3, Math.abs(hi)));
      const e = int(r, 2, Math.max(3, Math.abs(hi)));
      if (c === e) throw new Error('retry: the two binomials share a number');
      // From band 3 the other binomial is a CUBE taken away rather than a sum
      // of two squares. Both are honest, and they name two different errors: a
      // sum of squares does not come apart at all, while a cube taken away does
      // come apart — just not into two squares. The ask changes with it, so the
      // sentence on the card is true either way.
      const cubed = d >= 3;
      const target = poly([[1, 2], [-c * c, 0]], v);
      const other = cubed ? poly([[1, 3], [-e * e * e, 0]], v) : poly([[1, 2], [e * e, 0]], v);
      const ans = `${wrap(lin(1, v, c))}${wrap(lin(1, v, -c))}`;
      return {
        stem: T(cubed ? 'l4.ask.whichIsSquareMinusSquare' : 'l4.ask.whichComesApart'),
        latex: `${other} \\;\\; ${target}`,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math: target },
        steps: cubed ? [
          { latex: `${other} = ${v}^{3} - ${e}^{3}`, why: T('l4.why.aCubeIsNotASquare') },
          { latex: `${target} = ${ans}`, why: T('l4.why.onePlusOneMinus') },
        ] : [
          { latex: `${other} = ${v}^{2} + ${e}^{2}`, why: T('l4.why.plusDoesNotComeApart') },
          { latex: `${target} = ${ans}`, why: T('l4.why.onePlusOneMinus') },
        ],
        distractors: [
          { v: `${wrap(lin(1, v, e))}${wrap(lin(1, v, -e))}`, m: cubed ? 'any-subtraction-called-a-difference-of-squares' : 'sum-of-squares-factored' },
          { v: `${wrap(lin(1, v, c))}${wrap(lin(1, v, -e))}`, m: cubed ? 'any-subtraction-called-a-difference-of-squares' : 'sum-of-squares-factored' },
          { v: `${wrap(lin(1, v, -c))}${wrap(lin(1, v, -c))}`, m: 'both-signs-same' },
          { v: `${wrap(lin(1, v, c * c))}${wrap(lin(1, v, -c * c))}`, m: 'coefficient-root-skipped' },
          { v: `${-c}, ${c}`, m: 'answer-given-as-roots' },
          { v: wrap(lin(1, v, c)), m: 'partial-rule' },
          { v: `${wrap(lin(1, v, c))}${wrap(lin(1, v, -c - 1))}`, m: 'arith-slip' },
          { v: `${wrap(lin(1, v, e))}${wrap(lin(1, v, -c))}`, m: 'non-square-constant-accepted' },
        ],
      };
    },
  },
  {
    id: 'dq-plate', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, PLOTS);
      const v = pick(r, VARS);
      const heavy = d >= 3;
      const p = heavy ? from(r, LEAD, d) : 1;
      const [, hi] = ROOTS[rung(d)];
      // See dq-coef: a factor shared with the front number is a factorisation
      // this form would leave half done.
      const c = coprimeTo(r, p, 2, Math.max(3, Math.abs(hi)));
      if (heavy && !distinct(p, c, p * p, c * c)) throw new Error('retry: repeated number');
      const math = poly([[p * p, 2], [-c * c, 0]], v);
      const ans = `${wrap(lin(p, v, c))}${wrap(lin(p, v, -c))}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.areaAsProduct')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${math} = \\left(${p === 1 ? v : `${p}${v}`}\\right)^{2} - ${c}^{2}`, why: T('l4.why.bothPartsAreSquares', { c }) },
          { latex: `\\left(${p === 1 ? v : `${p}${v}`}\\right)^{2} - ${c}^{2} = ${ans}`, why: T('l4.why.onePlusOneMinus') },
        ],
        distractors: [
          { v: `${wrap(lin(p * p, v, c))}${wrap(lin(p * p, v, -c))}`, m: 'coefficient-root-skipped' },
          { v: `${wrap(lin(p, v, -c))}${wrap(lin(p, v, -c))}`, m: 'both-signs-same' },
          { v: `${wrap(lin(p, v, c * c))}${wrap(lin(p, v, -c * c))}`, m: 'coefficient-root-skipped' },
          { v: `${wrap(lin(p, v, c))}^{2}`, m: 'both-signs-same' },
          { v: wrap(lin(p, v, c)), m: 'partial-rule' },
          { v: `${wrap(lin(p, v, c))}${wrap(lin(p, v, -c - 1))}`, m: 'arith-slip' },
          { v: poly([[p * p, 2], [c * c, 0]], v), m: 'sum-of-squares-factored' },
        ],
      };
    },
  },
  {
    id: 'dq-nosplit', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const c = int(r, 2, Math.max(3, Math.abs(hi)));
      const p = d >= 4 ? from(r, LEAD, d) : 1;
      if (!distinct(p, c, c * c)) throw new Error('retry: repeated number');
      const math = poly([[p * p, 2], [c * c, 0]], v);
      return {
        stem: T('l4.ask.whereIsItZero'),
        latex: named(v, math),
        type: 'special',
        answer: 'NONE',
        check: { kind: 'features', variable: v, want: 'zeros', math },
        steps: [
          { latex: `${math} = 0`, why: T('l4.why.zeroMeansTheRuleReadsZero') },
          { latex: `${mono(p * p, v, 2)} = ${-c * c}`, why: T('l4.why.noSquareIsBelowZero') },
        ],
        distractors: [
          { v: `${v} = ${-c}, ${v} = ${c}`, m: 'sum-of-squares-factored' },
          { v: `${v} = ${c}`, m: 'sum-of-squares-factored' },
          { v: `${v} = 0`, m: 'zero-always-a-zero' },
          { v: `${v} = ${-c * c}`, m: 'coefficient-root-skipped' },
          { v: `${v} = ${c * c}`, m: 'coefficient-root-skipped' },
        ],
      };
    },
  },
];

// ===========================================================================
// poly-divide  —  what the bottom must be multiplied by
//
// Dividing one expression by another asks what the second must be multiplied
// by to give the first. THE CHECKER NEVER DIVIDES: it multiplies back, which
// needs no excluded value at all, and that is also the answer to "how do I
// know I am right".
// ===========================================================================

const polyDivide = [
  {
    id: 'pd-mono', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const g = from(r, GCFS, d);
      const s = int(r, 2, 3 + 2 * rung(d));
      const t = from(r, KONST, d);
      if (t <= 0) throw new Error('retry: this share empties a term');
      const a = g * s; const b = g * t;
      if (!distinct(g, s, t)) throw new Error('retry: repeated number');
      const dividend = poly([[a, 2], [b, 1]], v);
      const divisor = mono(g, v, 1);
      const math = `\\frac{${dividend}}{${divisor}}`;
      return {
        stem: T('l4.ask.writeTheQuotient'),
        latex: math,
        type: 'expression',
        answer: lin(s, v, t),
        check: { kind: 'polyQuotient', variable: v, dividend, divisor },
        steps: [
          { latex: `${math} = \\frac{${mono(a, v, 2)}}{${divisor}} + \\frac{${mono(b, v, 1)}}{${divisor}}`, why: T('l4.why.oneBarOverEachTerm') },
          { latex: `\\frac{${mono(a, v, 2)}}{${divisor}} + \\frac{${mono(b, v, 1)}}{${divisor}} = ${lin(s, v, t)}`, why: T('l4.why.multiplyBackToCheck') },
        ],
        distractors: [
          { v: mono(s, v, 1), m: 'term-by-term-cancel' },
          { v: `${mono(s, v, 1)} + ${mono(b, v, 1)}`, m: 'one-term-divided-only' },
          { v: `${mono(s, v, 2)} + ${t}`, m: 'exponents-divided-not-subtracted' },
          { v: lin(s, v, t + 1), m: 'never-multiplied-back' },
          { v: lin(s + 1, v, t), m: 'arith-slip' },
          { v: lin(a, v, b), m: 'partial-rule' },
          { v: lin(s, v, -t), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'pd-exact', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: two equal sides make a square');
      const b = p + q; const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: nothing to divide');
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const dividend = quad(1, b, c, v);
      const divisor = lin(1, v, p);
      const math = `\\frac{${dividend}}{${divisor}}`;
      return {
        stem: T('l4.ask.writeTheQuotient'),
        latex: math,
        type: 'expression',
        answer: lin(1, v, q),
        check: { kind: 'polyQuotient', variable: v, dividend, divisor },
        steps: [
          { latex: `${dividend} = ${wrap(lin(1, v, p))}${wrap(lin(1, v, q))}`, why: T('l4.why.factorTheTopFirst') },
          { latex: `\\frac{${wrap(lin(1, v, p))}${wrap(lin(1, v, q))}}{${divisor}} = ${lin(1, v, q)}`, why: T('l4.why.multiplyBackToCheck') },
        ],
        distractors: [
          { v: lin(1, v, c), m: 'one-term-divided-only' },
          { v: lin(1, v, b), m: 'never-multiplied-back' },
          { v: mono(1, v, 1), m: 'term-by-term-cancel' },
          { v: lin(1, v, q + 1), m: 'arith-slip' },
          { v: lin(1, v, -q), m: 'sign-slip' },
          { v: quad(1, b - 1, c, v), m: 'partial-rule' },
          { v: mono(1, v, 2), m: 'exponents-divided-not-subtracted' },
        ],
      };
    },
  },
  {
    id: 'pd-lead', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [lo, hi] = ROOTS[rung(d)];
      const c1 = nz(r, lo, hi);
      const c2 = nz(r, lo, hi);
      const [a, b, c] = expandTwo(a1, c1, 1, c2);
      if (b === 0 || c === 0) throw new Error('retry: nothing to divide');
      if (gcd(gcd(a, Math.abs(b)), Math.abs(c)) !== 1) throw new Error('retry: a common factor comes out first');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const dividend = quad(a, b, c, v);
      const divisor = lin(a1, v, c1);
      const math = `\\frac{${dividend}}{${divisor}}`;
      return {
        stem: T('l4.ask.writeTheQuotient'),
        latex: math,
        type: 'expression',
        answer: lin(1, v, c2),
        check: { kind: 'polyQuotient', variable: v, dividend, divisor },
        steps: [
          { latex: `${dividend} = ${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))}`, why: T('l4.why.factorTheTopFirst') },
          { latex: `\\frac{${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))}}{${divisor}} = ${lin(1, v, c2)}`, why: T('l4.why.multiplyBackToCheck') },
        ],
        distractors: [
          { v: lin(a1, v, c2), m: 'never-multiplied-back' },
          { v: lin(1, v, c), m: 'one-term-divided-only' },
          { v: mono(1, v, 1), m: 'term-by-term-cancel' },
          { v: lin(1, v, c2 + 1), m: 'arith-slip' },
          { v: lin(1, v, -c2), m: 'sign-slip' },
          { v: mono(a, v, 2), m: 'exponents-divided-not-subtracted' },
          { v: quad(1, b, c, v), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'pd-rem', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      const rem = nz(r, lo, hi);
      if (p === q) throw new Error('retry: two equal sides make a square');
      const b = p + q; const c = p * q + rem;
      if (b === 0 || c === 0) throw new Error('retry: nothing to divide');
      if (!distinct(p, q, rem, b, c)) throw new Error('retry: repeated number');
      const dividend = quad(1, b, c, v);
      const divisor = lin(1, v, p);
      const quotient = lin(1, v, q);
      return {
        stem: T('l4.ask.writeTheRemainder'),
        latex: `\\frac{${dividend}}{${divisor}} = ${quotient} + \\frac{\\square}{${divisor}}`,
        type: 'numeric',
        answer: String(rem),
        check: { kind: 'polyQuotient', variable: v, want: 'remainder', dividend, divisor, quotient },
        steps: [
          { latex: `${wrap(divisor)}${wrap(quotient)} = ${quad(1, b, p * q, v)}`, why: T('l4.why.multiplyBackToCheck') },
          { latex: `${c} - ${p * q} = ${rem}`, why: T('l4.why.whatIsLeftOver') },
        ],
        distractors: [
          { v: String(c), m: 'remainder-written-as-a-term' },
          { v: String(p * q), m: 'one-term-divided-only' },
          { v: String(-rem), m: 'sign-slip' },
          { v: String(rem + 1), m: 'arith-slip' },
          { v: String(rem - 1), m: 'arith-slip' },
          { v: '0', m: 'never-multiplied-back' },
          { v: String(b), m: 'term-by-term-cancel' },
        ],
      };
    },
  },
  {
    /**
     * THE CASE A.10(C) NAMES LAST: a divisor of degree two, whose degree
     * equals the dividend's. The quotient is then a whole number and the
     * question is what is left over, which is the half of the expectation the
     * other forms never reach.
     */
    id: 'pd-square', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: two equal sides make a square');
      const b = p + q; const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: nothing to divide');
      const m = from(r, LEAD, d);
      const r1 = nz(r, lo, hi);
      const r0 = nz(r, lo, hi);
      if (!distinct(m, r1, r0, b, c)) throw new Error('retry: repeated number');
      const divisor = quad(1, b, c, v);
      const dividend = quad(m, m * b + r1, m * c + r0, v);
      if (m * b + r1 === 0 || m * c + r0 === 0) throw new Error('retry: a term of the top goes out');
      return {
        stem: T('l4.ask.writeTheRemainder'),
        latex: `\\frac{${dividend}}{${divisor}} = ${m} + \\frac{\\square}{${divisor}}`,
        type: 'expression',
        answer: lin(r1, v, r0),
        check: { kind: 'polyQuotient', variable: v, want: 'remainder', dividend, divisor, quotient: String(m) },
        steps: [
          { latex: `${m}\\left(${divisor}\\right) = ${quad(m, m * b, m * c, v)}`, why: T('l4.why.multiplyBackToCheck') },
          { latex: `${dividend} - \\left(${quad(m, m * b, m * c, v)}\\right) = ${lin(r1, v, r0)}`, why: T('l4.why.whatIsLeftOver') },
        ],
        distractors: [
          { v: lin(r1, v, r0 + 1), m: 'arith-slip' },
          { v: lin(-r1, v, -r0), m: 'sign-slip' },
          { v: lin(r1 + m, v, r0), m: 'remainder-written-as-a-term' },
          { v: quad(m, m * b + r1, m * c + r0, v), m: 'remainder-written-as-a-term' },
          { v: lin(m * b + r1, v, m * c + r0), m: 'one-term-divided-only' },
          { v: String(m), m: 'never-multiplied-back' },
          { v: mono(1, v, 1), m: 'term-by-term-cancel' },
          { v: lin(r1, v, 0), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'pd-side', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SHARES);
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: two equal sides make a square');
      const b = p + q; const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: nothing to divide');
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const dividend = quad(1, b, c, v);
      const divisor = lin(1, v, p);
      const math = `\\frac{${dividend}}{${divisor}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.otherSide')}`,
        latex: math,
        type: 'expression',
        answer: lin(1, v, q),
        check: { kind: 'polyQuotient', variable: v, dividend, divisor },
        steps: [
          { latex: `${dividend} = ${wrap(lin(1, v, p))}${wrap(lin(1, v, q))}`, why: T('l4.why.factorTheTopFirst') },
          { latex: `\\frac{${wrap(lin(1, v, p))}${wrap(lin(1, v, q))}}{${divisor}} = ${lin(1, v, q)}`, why: T('l4.why.multiplyBackToCheck') },
        ],
        distractors: [
          { v: lin(1, v, c), m: 'one-term-divided-only' },
          { v: lin(1, v, b), m: 'never-multiplied-back' },
          { v: mono(1, v, 1), m: 'term-by-term-cancel' },
          { v: lin(1, v, q + 1), m: 'arith-slip' },
          { v: lin(1, v, -q), m: 'sign-slip' },
          { v: mono(1, v, 2), m: 'exponents-divided-not-subtracted' },
          { v: quad(1, b, c - 1, v), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'pd-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const g = from(r, GCFS, d);
      const s = int(r, 2, 3 + 2 * rung(d));
      const t = from(r, KONST, d);
      if (t <= 0) throw new Error('retry: this share empties a term');
      const a = g * s; const b = g * t;
      if (!distinct(g, s, t)) throw new Error('retry: repeated number');
      const dividend = poly([[a, 2], [b, 1]], v);
      const divisor = mono(g, v, 1);
      const math = `\\frac{${dividend}}{${divisor}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.writeTheQuotient')}`,
        latex: math,
        type: 'expression',
        answer: lin(s, v, t),
        check: { kind: 'polyQuotient', variable: v, dividend, divisor },
        steps: [
          { latex: `${divisor}\\left(${lin(s, v, t)}\\right) = ${dividend}`, why: T('l4.why.multiplyBackToCheck') },
          { latex: `${math} = ${lin(s, v, t)}`, why: T('l4.why.thatIsWhatTheBottomNeeds') },
        ],
        distractors: [
          { v: mono(s, v, 1), m: 'term-by-term-cancel' },
          { v: `${mono(s, v, 1)} + ${mono(b, v, 1)}`, m: 'one-term-divided-only' },
          { v: `${mono(s, v, 2)} + ${t}`, m: 'exponents-divided-not-subtracted' },
          { v: lin(s, v, t + 1), m: 'never-multiplied-back' },
          { v: lin(s + 1, v, t), m: 'arith-slip' },
          { v: lin(a, v, b), m: 'partial-rule' },
          { v: lin(s, v, -t), m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// quadratic-zero-product  —  two brackets that multiply to zero
//
// When two quantities multiply to zero, at least one of them is zero. So a
// rule written as two brackets is zero exactly where one bracket is zero.
// `zp-nonzero` is the form that says why the zero matters: the same two
// brackets set equal to a number that is NOT zero have different answers, and
// the rule does not reach them.
// ===========================================================================

/** A reading, with the number it is worth and the one spelling it is printed in. */
const RI = (n) => ({ num: n, tex: String(n) });
const RF = (n, dd) => ({ num: n / dd, tex: frac(n, dd) });
/** Two readings, smallest first — the order `proveRootSet` requires. */
function pairTex(v, u, w) {
  const [lo, hi] = u.num <= w.num ? [u, w] : [w, u];
  return `${v} = ${lo.tex}, ${v} = ${hi.tex}`;
}

const quadraticZeroProduct = [
  {
    id: 'zp-roots', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: one bracket twice is a different question');
      if (!distinct(p, q)) throw new Error('retry: repeated number');
      const math = `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = 0`;
      return {
        stem: T('l4.ask.whereIsItZero'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: d >= 4 ? [
          { latex: `${quad(1, -(p + q), p * q, v)} = 0`, why: T('l4.why.sameStatementOpenedOut') },
          { latex: `${lin(1, v, -p)} = 0 \\Rightarrow ${v} = ${p}`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -q)} = 0 \\Rightarrow ${v} = ${q}`, why: T('l4.why.andTheOtherBracket') },
        ] : [
          { latex: `${lin(1, v, -p)} = 0 \\Rightarrow ${v} = ${p}`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -q)} = 0 \\Rightarrow ${v} = ${q}`, why: T('l4.why.andTheOtherBracket') },
        ],
        distractors: [
          { v: pairTex(v, RI(-p), RI(-q)), m: 'sign-of-zero-copied' },
          { v: `${v} = ${p}`, m: 'one-zero-only' },
          { v: `${v} = 0, ${pairTex(v, RI(p), RI(q))}`, m: 'zero-always-a-zero' },
          { v: `${v} = ${p * q}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, RI(p + 1), RI(q)), m: 'arith-slip' },
          { v: `${v} = ${p + q}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, RI(-p), RI(q)), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'zp-onezero', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === 0) throw new Error('retry: both brackets are the same');
      const math = `${v}${wrap(lin(1, v, -p))} = 0`;
      return {
        stem: T('l4.ask.whereIsItZero'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(0), RI(p)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${v} = 0`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -p)} = 0 \\Rightarrow ${v} = ${p}`, why: T('l4.why.andTheOtherBracket') },
        ],
        distractors: [
          { v: `${v} = ${p}`, m: 'one-zero-only' },
          { v: `${v} = 0`, m: 'one-zero-only' },
          { v: pairTex(v, RI(0), RI(-p)), m: 'sign-of-zero-copied' },
          { v: pairTex(v, RI(1), RI(p)), m: 'zero-always-a-zero' },
          { v: pairTex(v, RI(0), RI(p + 1)), m: 'arith-slip' },
          { v: `${v} = ${-p}`, m: 'sign-of-zero-copied' },
          { v: pairTex(v, RI(0), RI(p * p)), m: 'brackets-expanded-first-then-guessed' },
        ],
      };
    },
  },
  {
    id: 'zp-lead', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [lo, hi] = ROOTS[rung(d)];
      const c1 = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (c1 % a1 === 0) throw new Error('retry: the front number cancels and the item is easier than its band');
      const first = RF(-c1, a1);
      const second = RI(q);
      if (first.num === second.num) throw new Error('retry: one reading twice');
      const math = `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, -q))} = 0`;
      return {
        stem: T('l4.ask.whereIsItZero'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, first, second),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${lin(a1, v, c1)} = 0 \\Rightarrow ${v} = ${first.tex}`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -q)} = 0 \\Rightarrow ${v} = ${q}`, why: T('l4.why.andTheOtherBracket') },
        ],
        distractors: [
          { v: pairTex(v, RI(-c1), second), m: 'sign-of-zero-copied' },
          { v: pairTex(v, RI(c1), RI(-q)), m: 'sign-of-zero-copied' },
          { v: `${v} = ${q}`, m: 'one-zero-only' },
          { v: `${v} = 0, ${pairTex(v, first, second)}`, m: 'zero-always-a-zero' },
          { v: pairTex(v, RF(c1, a1), second), m: 'sign-slip' },
          { v: `${v} = ${-c1 * q}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, first, RI(q + 1)), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'zp-nonzero', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: one bracket twice is a different question');
      const shift = pick(r, [1, 2]);
      const r1 = p + shift; const r2 = q - shift;
      if (r1 === r2) throw new Error('retry: the two readings meet');
      const k = p * q - r1 * r2;
      if (k === 0) throw new Error('retry: the right-hand side is zero after all');
      if (!distinct(p, q, r1, r2, k)) throw new Error('retry: repeated number');
      const math = `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = ${k}`;
      return {
        stem: T('l4.ask.whereIsItZero'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(r1), RI(r2)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${quad(1, -(p + q), p * q - k, v)} = 0`, why: T('l4.why.everythingOnOneSide') },
          { latex: `${wrap(lin(1, v, -r1))}${wrap(lin(1, v, -r2))} = 0`, why: T('l4.why.nowTheBracketsCanBeZero') },
        ],
        distractors: [
          { v: pairTex(v, RI(p + k), RI(q + k)), m: 'zero-product-used-on-a-non-zero' },
          { v: pairTex(v, RI(p), RI(q)), m: 'zero-product-used-on-a-non-zero' },
          { v: pairTex(v, RI(-r1), RI(-r2)), m: 'sign-of-zero-copied' },
          { v: `${v} = ${r1}`, m: 'one-zero-only' },
          { v: `${v} = ${k}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, RI(r1 + 1), RI(r2)), m: 'arith-slip' },
          { v: `${v} = 0, ${pairTex(v, RI(r1), RI(r2))}`, m: 'zero-always-a-zero' },
        ],
      };
    },
  },
  {
    id: 'zp-gate', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, GATES);
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: one bracket twice is a different question');
      const math = `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = 0`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.whichInputsShutIt')}`,
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: d >= 4 ? [
          { latex: `${quad(1, -(p + q), p * q, v)} = 0`, why: T('l4.why.sameStatementOpenedOut') },
          { latex: `${lin(1, v, -p)} = 0 \\Rightarrow ${v} = ${p}`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -q)} = 0 \\Rightarrow ${v} = ${q}`, why: T('l4.why.andTheOtherBracket') },
        ] : [
          { latex: `${lin(1, v, -p)} = 0 \\Rightarrow ${v} = ${p}`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -q)} = 0 \\Rightarrow ${v} = ${q}`, why: T('l4.why.andTheOtherBracket') },
        ],
        distractors: [
          { v: pairTex(v, RI(-p), RI(-q)), m: 'sign-of-zero-copied' },
          { v: `${v} = ${q}`, m: 'one-zero-only' },
          { v: `${v} = 0, ${pairTex(v, RI(p), RI(q))}`, m: 'zero-always-a-zero' },
          { v: `${v} = ${p * q}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, RI(p), RI(q + 1)), m: 'arith-slip' },
          { v: `${v} = ${p + q}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, RI(p), RI(-q)), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'zp-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: one bracket twice is a different question');
      if (!distinct(p, q)) throw new Error('retry: repeated number');
      const math = `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = 0`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.whereIsItZero')}`,
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: d >= 4 ? [
          { latex: `${quad(1, -(p + q), p * q, v)} = 0`, why: T('l4.why.sameStatementOpenedOut') },
          { latex: `${lin(1, v, -p)} = 0 \\Rightarrow ${v} = ${p}`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -q)} = 0 \\Rightarrow ${v} = ${q}`, why: T('l4.why.andTheOtherBracket') },
        ] : [
          { latex: `${lin(1, v, -p)} = 0 \\Rightarrow ${v} = ${p}`, why: T('l4.why.oneBracketIsZero') },
          { latex: `${lin(1, v, -q)} = 0 \\Rightarrow ${v} = ${q}`, why: T('l4.why.andTheOtherBracket') },
        ],
        distractors: [
          { v: pairTex(v, RI(-p), RI(-q)), m: 'sign-of-zero-copied' },
          { v: `${v} = ${p}`, m: 'one-zero-only' },
          { v: `${v} = 0, ${pairTex(v, RI(p), RI(q))}`, m: 'zero-always-a-zero' },
          { v: `${v} = ${p * q}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, RI(p), RI(q + 1)), m: 'arith-slip' },
          { v: `${v} = ${p + q}`, m: 'brackets-expanded-first-then-guessed' },
          { v: pairTex(v, RI(-p), RI(q)), m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// solve-by-factoring  —  one hard statement into two easy ones
//
// Before the two-bracket rule can be used, everything has to be on one side
// and zero on the other. The checker puts every claimed value back into the
// equation the learner is SHOWN, so a solution that came from an unbalanced
// step fails at the substitution rather than at the reasoning.
// ===========================================================================

const solveByFactoring = [
  {
    id: 'sf-standard', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: one reading twice');
      const b = -(p + q); const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = `${quad(1, b, c, v)} = 0`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${quad(1, b, c, v)} = ${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))}`, why: T('l4.why.pairMultipliesAndAdds', { c, b }) },
          { latex: `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = 0 \\Rightarrow ${pairTex(v, RI(p), RI(q))}`, why: T('l4.why.oneBracketIsZero') },
        ],
        distractors: [
          { v: pairTex(v, RI(-p), RI(-q)), m: 'bracket-constants-copied' },
          { v: `${v} = ${c}`, m: 'constant-read-as-a-solution' },
          { v: `${v} = ${p > 0 ? p : q}`, m: 'negative-solution-discarded' },
          { v: pairTex(v, RI(p + 1), RI(q)), m: 'arith-slip' },
          { v: `${v} = ${b}`, m: 'constant-read-as-a-solution' },
          { v: `${v} = 0, ${pairTex(v, RI(p), RI(q))}`, m: 'divides-by-the-letter' },
          { v: pairTex(v, RI(-p), RI(q)), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'sf-rearr', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: one reading twice');
      const b = -(p + q); const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = `${poly([[1, 2], [b, 1]], v)} = ${-c}`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${quad(1, b, c, v)} = 0`, why: T('l4.why.everythingOnOneSide') },
          { latex: `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = 0 \\Rightarrow ${pairTex(v, RI(p), RI(q))}`, why: T('l4.why.oneBracketIsZero') },
        ],
        distractors: [
          { v: pairTex(v, RI(-c), RI(-c - b)), m: 'not-set-to-zero' },
          { v: `${v} = ${-c}`, m: 'not-set-to-zero' },
          { v: pairTex(v, RI(-p), RI(-q)), m: 'bracket-constants-copied' },
          { v: `${v} = ${c}`, m: 'constant-read-as-a-solution' },
          { v: `${v} = ${p > 0 ? p : q}`, m: 'negative-solution-discarded' },
          { v: pairTex(v, RI(p), RI(q + 1)), m: 'arith-slip' },
          { v: `${v} = 0, ${pairTex(v, RI(p), RI(q))}`, m: 'divides-by-the-letter' },
        ],
      };
    },
  },
  {
    id: 'sf-nolinear', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const k = d >= 3 ? nz(r, lo, hi) : int(r, 2, Math.max(3, hi));
      if (k === 0) throw new Error('retry: nothing to take out');
      const math = `${v}^{2} = ${mono(k, v, 1)}`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(0), RI(k)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${poly([[1, 2], [-k, 1]], v)} = 0`, why: T('l4.why.everythingOnOneSide') },
          { latex: `${v}${wrap(lin(1, v, -k))} = 0 \\Rightarrow ${pairTex(v, RI(0), RI(k))}`, why: T('l4.why.oneBracketIsZero') },
        ],
        distractors: [
          { v: `${v} = ${k}`, m: 'divides-by-the-letter' },
          { v: `${v} = 0`, m: 'divides-by-the-letter' },
          { v: pairTex(v, RI(0), RI(-k)), m: 'bracket-constants-copied' },
          { v: pairTex(v, RI(0), RI(k * k)), m: 'constant-read-as-a-solution' },
          { v: pairTex(v, RI(0), RI(k + 1)), m: 'arith-slip' },
          { v: `${v} = ${k > 0 ? k : 0}`, m: 'negative-solution-discarded' },
          { v: pairTex(v, RI(1), RI(k)), m: 'not-set-to-zero' },
        ],
      };
    },
  },
  {
    id: 'sf-lead', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [lo, hi] = ROOTS[rung(d)];
      const c1 = nz(r, lo, hi);
      const c2 = nz(r, lo, hi);
      if (c1 % a1 === 0) throw new Error('retry: the front number cancels');
      const [a, b, c] = expandTwo(a1, c1, 1, c2);
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      if (gcd(gcd(a, Math.abs(b)), Math.abs(c)) !== 1) throw new Error('retry: a common factor comes out first');
      const first = RF(-c1, a1);
      const second = RI(-c2);
      if (first.num === second.num) throw new Error('retry: one reading twice');
      const math = `${quad(a, b, c, v)} = 0`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, first, second),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${quad(a, b, c, v)} = ${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))}`, why: T('l4.why.shareTheFrontNumber', { a }) },
          { latex: `${wrap(lin(a1, v, c1))}${wrap(lin(1, v, c2))} = 0 \\Rightarrow ${pairTex(v, first, second)}`, why: T('l4.why.oneBracketIsZero') },
        ],
        distractors: [
          { v: pairTex(v, RI(c1), RI(c2)), m: 'bracket-constants-copied' },
          { v: pairTex(v, RI(-c1), second), m: 'bracket-constants-copied' },
          { v: `${v} = ${c}`, m: 'constant-read-as-a-solution' },
          { v: `${v} = ${second.num > 0 ? second.tex : first.tex}`, m: 'negative-solution-discarded' },
          { v: pairTex(v, first, RI(-c2 + 1)), m: 'arith-slip' },
          { v: `${v} = 0, ${pairTex(v, first, second)}`, m: 'divides-by-the-letter' },
          { v: pairTex(v, RF(c1, a1), second), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'sf-story', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, PLOTS);
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const w = int(r, 2, Math.max(3, Math.abs(hi)));
      const k = int(r, 1, Math.max(2, Math.abs(hi)));
      const area = w * (w + k);
      if (!distinct(w, k, area, w + k)) throw new Error('retry: repeated number');
      const math = `${poly([[1, 2], [k, 1]], v)} = ${area}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.howWideIsIt')}`,
        latex: math,
        type: 'numeric',
        answer: String(w),
        check: { kind: 'quadratic', variable: v, want: 'positive', math },
        steps: [
          { latex: `${quad(1, k, -area, v)} = 0`, why: T('l4.why.everythingOnOneSide') },
          { latex: `${wrap(lin(1, v, -w))}${wrap(lin(1, v, w + k))} = 0 \\Rightarrow ${v} = ${w}`, why: T('l4.why.onlyOneWidthCanBeReal') },
        ],
        distractors: [
          { v: String(-w - k), m: 'negative-solution-discarded' },
          { v: String(area), m: 'constant-read-as-a-solution' },
          { v: String(-w), m: 'bracket-constants-copied' },
          { v: String(w + k), m: 'not-set-to-zero' },
          { v: String(w + 1), m: 'arith-slip' },
          { v: String(w - 1), m: 'arith-slip' },
          { v: String(k), m: 'constant-read-as-a-solution' },
        ],
      };
    },
  },
  {
    id: 'sf-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: one reading twice');
      const b = -(p + q); const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = `${poly([[1, 2], [b, 1]], v)} = ${-c}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.solveIt')}`,
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${quad(1, b, c, v)} = 0`, why: T('l4.why.everythingOnOneSide') },
          { latex: `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = 0 \\Rightarrow ${pairTex(v, RI(p), RI(q))}`, why: T('l4.why.oneBracketIsZero') },
        ],
        distractors: [
          { v: pairTex(v, RI(-c), RI(-c - b)), m: 'not-set-to-zero' },
          { v: pairTex(v, RI(-p), RI(-q)), m: 'bracket-constants-copied' },
          { v: `${v} = ${c}`, m: 'constant-read-as-a-solution' },
          { v: `${v} = ${p > 0 ? p : q}`, m: 'negative-solution-discarded' },
          { v: pairTex(v, RI(p), RI(q + 1)), m: 'arith-slip' },
          { v: `${v} = 0, ${pairTex(v, RI(p), RI(q))}`, m: 'divides-by-the-letter' },
          { v: `${v} = ${-c}`, m: 'not-set-to-zero' },
        ],
      };
    },
  },
];

// ===========================================================================
// square-root-method  —  a square undone gives two answers
//
// When a squared quantity equals a number, taking the root of both sides
// undoes the square. A square has two roots, one above zero and one below, so
// this gives two answers — and when the number is below zero it gives none,
// which is the one deciding answer this unit can say in three languages.
// ===========================================================================

const squareRootMethod = [
  {
    id: 'sq-plain', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const s = int(r, 2, Math.max(3, Math.abs(hi)));
      const c = s * s;
      if (!distinct(s, c)) throw new Error('retry: repeated number');
      const math = `${v}^{2} = ${c}`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(-s), RI(s)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${v} = \\pm \\sqrt{${c}}`, why: T('l4.why.rootBothSides') },
          { latex: `${v} = \\pm ${s}`, why: T('l4.why.twoRootsOneEach', { s }) },
        ],
        distractors: [
          { v: `${v} = ${s}`, m: 'plus-only' },
          { v: `${v} = ${frac(c, 2)}`, m: 'halves-instead-of-roots' },
          { v: pairTex(v, RI(-c), RI(c)), m: 'root-taken-term-by-term' },
          { v: pairTex(v, RI(-s - 1), RI(s + 1)), m: 'arith-slip' },
          { v: `${v} = ${-s}`, m: 'plus-only' },
          { v: `${v} = 0, ${pairTex(v, RI(-s), RI(s))}`, m: 'zero-always-a-zero' },
          { v: `${v} = ${frac(c, 4)}`, m: 'halves-instead-of-roots' },
        ],
      };
    },
  },
  {
    id: 'sq-shift', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const s = int(r, 2, Math.max(3, Math.abs(hi)));
      const c = s * s;
      if (!distinct(h, s, c)) throw new Error('retry: repeated number');
      const math = `${wrap(lin(1, v, -h))}^{2} = ${c}`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(h - s), RI(h + s)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${lin(1, v, -h)} = \\pm ${s}`, why: T('l4.why.rootBothSides') },
          { latex: `${v} = ${h} \\pm ${s}`, why: T('l4.why.undoTheShiftLast', { h }) },
        ],
        distractors: [
          { v: `${v} = \\pm ${s}`, m: 'shift-undone-before-rooting' },
          { v: `${v} = ${h + s}`, m: 'plus-only' },
          { v: `${v} = ${c + h * h}`, m: 'root-taken-term-by-term' },
          { v: `${v} = ${frac(c, 2)}`, m: 'halves-instead-of-roots' },
          { v: pairTex(v, RI(-h - s), RI(-h + s)), m: 'sign-slip' },
          { v: pairTex(v, RI(h - s - 1), RI(h + s)), m: 'arith-slip' },
          { v: `${v} = ${h}`, m: 'plus-only' },
        ],
      };
    },
  },
  {
    id: 'sq-surd', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const { m, k, n } = drawRadicand(r, d);
      const math = `${v}^{2} = ${n}`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: `${v} = \\pm ${surd(m, k)}`,
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${v} = \\pm \\sqrt{${n}}`, why: T('l4.why.rootBothSides') },
          { latex: `${v} = \\pm ${surd(m, k)}`, why: T('l4.why.largestSquareInside', { sq: m * m }) },
        ],
        distractors: [
          { v: `${v} = ${surd(m, k)}`, m: 'plus-only' },
          { v: `${v} = ${frac(n, 2)}`, m: 'halves-instead-of-roots' },
          // `\pm\sqrt{n}` is NOT here, and that is deliberate: it is the key
          // spelled with the square still inside, so it is the same number and
          // was scored an error with a misconception tag on it. See the note at
          // the head of this file.
          ...(simplestSurd(m, m * k) ? [{ v: `${v} = \\pm ${simplestSurd(m, m * k)}`, m: 'perfect-square-left-inside' }] : []),
          { v: `${v} = \\pm ${m}`, m: 'root-taken-term-by-term' },
          { v: `${v} = \\pm ${surd(m + 1, k)}`, m: 'arith-slip' },
          { v: `${v} = \\pm ${surd(m - 1, k)}`, m: 'arith-slip' },
          { v: `${v} = \\pm ${k}`, m: 'swapped-roles' },
          { v: `${v} = \\pm ${surd(m + 2, k)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'sq-none', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const s = int(r, 2, Math.max(3, Math.abs(hi)));
      const c = s * s;
      const a = d >= 4 ? from(r, LEAD, d) : 1;
      if (!distinct(a, s, c)) throw new Error('retry: repeated number');
      const math = `${mono(a, v, 2)} = ${-c}`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'special',
        answer: 'NONE',
        check: { kind: 'quadratic', variable: v, want: 'none', math },
        steps: [
          { latex: `${v}^{2} = ${frac(-c, a)}`, why: T('l4.why.freeTheSquare') },
          { latex: `${v}^{2} \\ge 0`, why: T('l4.why.noSquareIsBelowZero') },
        ],
        distractors: [
          { v: `${v} = \\pm ${s}`, m: 'negative-radicand-forced' },
          { v: `${v} = ${s}`, m: 'negative-radicand-forced' },
          { v: `${v} = ${-s}`, m: 'plus-only' },
          { v: `${v} = 0`, m: 'zero-always-a-zero' },
          { v: `${v} = ${frac(-c, 2)}`, m: 'halves-instead-of-roots' },
        ],
      };
    },
  },
  {
    /**
     * A SIDE OF A SQUARE IS A LENGTH, AND A LENGTH IS NEVER BELOW ZERO.
     *
     * This form used to answer "How long is one side?" with `n = -2, n = 2`,
     * on all 244 of the items an independent solver drew from it: half of every
     * key was a length below zero, and a cadet who correctly threw that half
     * away had no option to pick. The very same situation is asked by
     * solve-by-factoring/sf-story, which has always used `want: 'positive'`, so
     * the bank was contradicting itself inside one unit.
     *
     * It now asks the same way sf-story does, and the derivation carries the
     * rejection as its own line rather than leaving it unsaid.
     *
     * The band climbs on the size of the area alone. It used to climb by
     * handing back a surd — `n = \pm 4\sqrt{11}` — and a surd cannot be asked
     * for here any more: a single positive length is written without an equals
     * sign, and `rift.js` reads "take every whole square out of the root" off
     * that shape, which is not what a card asking for the side of a deck is
     * about. square-root-method/sq-surd still teaches the surd root, where the
     * ask really is "find every value that works".
     */
    id: 'sq-area', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SIDES);
      const v = pick(r, VARS);
      const [, hi] = ROOTS[rung(d)];
      const s = int(r, 2, Math.max(3, Math.abs(hi)));
      const c = s * s;
      if (!distinct(s, c)) throw new Error('retry: repeated number');
      const math = `${v}^{2} = ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.howLongIsTheSide')}`,
        latex: math,
        type: 'numeric',
        answer: String(s),
        check: { kind: 'quadratic', variable: v, want: 'positive', math },
        steps: [
          { latex: `${v} = \\pm \\sqrt{${c}}`, why: T('l4.why.rootBothSides') },
          { latex: `${v} = \\pm ${s}`, why: T('l4.why.twoRootsOneEach', { s }) },
          { latex: `${v} = ${s}`, why: T('l4.why.onlyOneLengthCanBeReal') },
        ],
        distractors: [
          { v: String(-s), m: 'negative-solution-discarded' },
          { v: String(c), m: 'root-taken-term-by-term' },
          { v: ratio(c, 2), m: 'halves-instead-of-roots' },
          { v: ratio(c, 4), m: 'halves-instead-of-roots' },
          { v: String(s + 1), m: 'arith-slip' },
          { v: String(s - 1), m: 'arith-slip' },
          { v: String(-c), m: 'sign-slip' },
          { v: '0', m: 'zero-always-a-zero' },
        ],
      };
    },
  },
  {
    id: 'sq-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const h = nz(r, lo, hi);
      const s = int(r, 2, Math.max(3, Math.abs(hi)));
      const c = s * s;
      if (!distinct(h, s, c)) throw new Error('retry: repeated number');
      const math = `${wrap(lin(1, v, -h))}^{2} = ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.solveIt')}`,
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(h - s), RI(h + s)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${lin(1, v, -h)} = \\pm ${s}`, why: T('l4.why.rootBothSides') },
          { latex: `${v} = ${h} \\pm ${s}`, why: T('l4.why.undoTheShiftLast', { h }) },
        ],
        distractors: [
          { v: `${v} = \\pm ${s}`, m: 'shift-undone-before-rooting' },
          { v: `${v} = ${h + s}`, m: 'plus-only' },
          { v: `${v} = ${c + h * h}`, m: 'root-taken-term-by-term' },
          { v: `${v} = ${frac(c, 2)}`, m: 'halves-instead-of-roots' },
          { v: pairTex(v, RI(-h - s), RI(-h + s)), m: 'sign-slip' },
          { v: pairTex(v, RI(h - s), RI(h + s + 1)), m: 'arith-slip' },
          { v: `${v} = ${h}`, m: 'plus-only' },
        ],
      };
    },
  },
];

// ===========================================================================
// complete-the-square  —  half the middle count, squared
//
// Half the middle coefficient, squared, is the number that turns a two-term
// start into a perfect square. `vertexForm` proves the identity at fourteen
// values AND refuses an answer that is not one squared bracket, so standard
// form — which is identically equal — earns nothing.
// ===========================================================================

/** `a(v + h)^{2} + k`, with h and k written as exact fractions. */
function sqForm(a, hn, hd, kn, kd, v) {
  const inner = hn === 0 ? v : `${v} ${hn > 0 ? '+' : '-'} ${frac(Math.abs(hn), hd)}`;
  const head = a === 1 ? '' : a === -1 ? '-' : String(a);
  const core = `${head}${wrap(inner)}^{2}`;
  if (kn === 0) return core;
  return `${core} ${kn > 0 ? '+' : '-'} ${frac(Math.abs(kn), kd)}`;
}

const completeTheSquare = [
  {
    id: 'cs-monic', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const b = 2 * h; const c = h * h + k;
      if (!distinct(h, k, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = sqForm(1, h, 1, k, 1, v);
      return {
        stem: T('l4.ask.showTheTurn'),
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `\\left(\\frac{${b}}{2}\\right)^{2} = ${h * h}`, why: T('l4.why.halfTheMiddleSquared', { b }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.addItAndTakeItBack', { sq: h * h }) },
        ],
        distractors: [
          { v: sqForm(1, b, 1, k, 1, v), m: 'half-b-not-squared' },
          { v: sqForm(1, h, 1, c, 1, v), m: 'constant-dropped' },
          { v: sqForm(1, -h, 1, k, 1, v), m: 'bracket-sign-copied' },
          { v: sqForm(1, h, 1, 0, 1, v), m: 'constant-dropped' },
          { v: sqForm(1, h, 1, k + 1, 1, v), m: 'arith-slip' },
          { v: sqForm(1, h, 1, h * h + c, 1, v), m: 'added-one-side-only' },
          { v: sqForm(1, h + 1, 1, k, 1, v), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'cs-odd', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      let b = nz(r, lo, hi);
      if (b % 2 === 0) b += 1;
      if (b === 0) throw new Error('retry: no middle term to halve');
      const c = signed(r, KONST, d);
      const kn = 4 * c - b * b;
      if (kn === 0) throw new Error('retry: the leftover is nothing');
      if (!distinct(b, c, kn)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = sqForm(1, b, 2, kn, 4, v);
      return {
        stem: T('l4.ask.showTheTurn'),
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `\\left(\\frac{${b}}{2}\\right)^{2} = \\frac{${b * b}}{4}`, why: T('l4.why.halfTheMiddleSquared', { b }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.addItAndTakeItBack', { sq: frac(b * b, 4) }) },
        ],
        distractors: [
          { v: sqForm(1, b, 1, kn, 4, v), m: 'half-b-not-squared' },
          { v: sqForm(1, b, 2, c, 1, v), m: 'constant-dropped' },
          { v: sqForm(1, -b, 2, kn, 4, v), m: 'bracket-sign-copied' },
          { v: sqForm(1, b, 2, 0, 1, v), m: 'constant-dropped' },
          { v: sqForm(1, b, 2, kn + 4, 4, v), m: 'arith-slip' },
          { v: sqForm(1, b, 2, 4 * c + b * b, 4, v), m: 'added-one-side-only' },
          { v: sqForm(1, b, 2, b * b - 4 * c, 4, v), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'cs-lead', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = coefOf(r, LEAD, d);
      const [lo, hi] = TURNS[rung(d)];
      const h = nz(r, lo, hi);
      const k = signed(r, KONST, d);
      const b = 2 * a * h; const c = a * h * h + k;
      if (!distinct(a, h, k, b, c)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = sqForm(a, h, 1, k, 1, v);
      return {
        stem: T('l4.ask.showTheTurn'),
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `${math} = ${a}\\left(${quad(1, 2 * h, h * h, v)}\\right) ${sg(k)}`, why: T('l4.why.divideTheFrontOutFirst', { a }) },
          { latex: `${a}\\left(${quad(1, 2 * h, h * h, v)}\\right) ${sg(k)} = ${ans}`, why: T('l4.why.halfTheMiddleSquared', { b: 2 * h }) },
        ],
        distractors: [
          { v: sqForm(a, b, 1, k, 1, v), m: 'leading-coefficient-not-divided-out' },
          { v: sqForm(1, h, 1, k, 1, v), m: 'leading-coefficient-not-divided-out' },
          { v: sqForm(a, -h, 1, k, 1, v), m: 'bracket-sign-copied' },
          { v: sqForm(a, h, 1, c, 1, v), m: 'constant-dropped' },
          { v: sqForm(a, h, 1, 0, 1, v), m: 'constant-dropped' },
          { v: sqForm(a, h, 1, k + 1, 1, v), m: 'arith-slip' },
          { v: sqForm(a, h, 1, k + a * h * h, 1, v), m: 'added-one-side-only' },
        ],
      };
    },
  },
  {
    id: 'cs-solve', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const { m, k, n } = drawRadicand(r, d);
      const b = -2 * h; const c = h * h - n;
      if (!distinct(h, n, b, c)) throw new Error('retry: repeated number');
      const math = `${quad(1, b, c, v)} = 0`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: `${v} = ${h} \\pm ${surd(m, k)}`,
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${wrap(lin(1, v, -h))}^{2} = ${n}`, why: T('l4.why.halfTheMiddleSquared', { b }) },
          { latex: `${v} = ${h} \\pm ${surd(m, k)}`, why: T('l4.why.rootBothSides') },
        ],
        // Every root a cadet is shown is printed with its square already out —
        // see `simplestSurd`. `m\sqrt{mk}` was here as the reading of a cadet
        // who left one factor under the bar, and when `m k` still held a square
        // it printed `2\sqrt{4}` and `3\sqrt{12}`: options that are not in the
        // form this bank demands, in a family whose keys are all in it.
        distractors: [
          { v: `${v} = ${h} + ${surd(m, k)}`, m: 'plus-only' },
          { v: `${v} = ${-h} \\pm ${surd(m, k)}`, m: 'bracket-sign-copied' },
          ...(simplestSurd(m, m * k) ? [{ v: `${v} = ${h} \\pm ${simplestSurd(m, m * k)}`, m: 'perfect-square-left-inside' }] : []),
          { v: `${v} = ${h} \\pm ${surd(m - 1, k)}`, m: 'arith-slip' },
          { v: `${v} = ${h} \\pm ${frac(b, 2)}`, m: 'half-b-not-squared' },
          { v: `${v} = ${h} \\pm ${surd(m + 1, k)}`, m: 'arith-slip' },
          { v: `${v} = ${h}`, m: 'constant-dropped' },
          { v: `${v} = ${h} \\pm ${surd(m + 2, k)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'cs-arch', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, ARCHES);
      const v = pick(r, VARS);
      const a = d >= 3 ? coefOf(r, LEAD, d) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const b = 2 * a * h; const c = a * h * h + k;
      if (!distinct(a, h, k, b, c)) throw new Error('retry: repeated number');
      const math = quad(a, b, c, v);
      const ans = sqForm(a, h, 1, k, 1, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.showTheTurn')}`,
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `\\left(\\frac{${2 * h}}{2}\\right)^{2} = ${h * h}`, why: T('l4.why.halfTheMiddleSquared', { b: 2 * h }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.addItAndTakeItBack', { sq: h * h }) },
        ],
        distractors: [
          { v: sqForm(a, b, 1, k, 1, v), m: 'half-b-not-squared' },
          { v: sqForm(a, h, 1, c, 1, v), m: 'constant-dropped' },
          { v: sqForm(a, -h, 1, k, 1, v), m: 'bracket-sign-copied' },
          { v: sqForm(a, h, 1, 0, 1, v), m: 'constant-dropped' },
          { v: sqForm(1, h, 1, k, 1, v), m: 'leading-coefficient-not-divided-out' },
          { v: sqForm(a, h, 1, k + 1, 1, v), m: 'arith-slip' },
          { v: sqForm(a, h, 1, k + a * h * h, 1, v), m: 'added-one-side-only' },
        ],
      };
    },
  },
  {
    id: 'cs-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const [lo, hi] = TURNS[rung(d)];
      const h = nz(r, lo, hi);
      const k = signed(r, KONST, d);
      const b = 2 * h; const c = h * h + k;
      if (!distinct(h, k, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      const ans = sqForm(1, h, 1, k, 1, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.showTheTurn')}`,
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `\\left(\\frac{${b}}{2}\\right)^{2} = ${h * h}`, why: T('l4.why.halfTheMiddleSquared', { b }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.addItAndTakeItBack', { sq: h * h }) },
        ],
        distractors: [
          { v: sqForm(1, b, 1, k, 1, v), m: 'half-b-not-squared' },
          { v: sqForm(1, h, 1, c, 1, v), m: 'constant-dropped' },
          { v: sqForm(1, -h, 1, k, 1, v), m: 'bracket-sign-copied' },
          { v: sqForm(1, h, 1, 0, 1, v), m: 'constant-dropped' },
          { v: sqForm(1, h, 1, k + 1, 1, v), m: 'arith-slip' },
          { v: sqForm(1, h, 1, k + h * h, 1, v), m: 'added-one-side-only' },
          { v: sqForm(1, h + 1, 1, k, 1, v), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// quadratic-formula  —  one formula, and the part under the root
//
// Completing the square on a general squared rule gives one formula that works
// every time, and the part under the root says how many real answers there
// are. Nothing here trusts the formula: `solveQuadratic` reads the printed
// equation, works the roots out again, and then puts each one back in.
// ===========================================================================

/** `\left(-3\right)` when a number is below zero, `3` when it is not. */
const safe = (n) => (n < 0 ? `\\left(${n}\\right)` : String(n));

const quadraticFormula = [
  {
    id: 'qf-rational', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: one reading twice');
      const b = -(p + q); const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      const disc = b * b - 4 * c;
      if (!distinct(p, q, b, c, disc)) throw new Error('retry: repeated number');
      const math = `${quad(1, b, c, v)} = 0`;
      const root = Math.round(Math.sqrt(disc));
      if (root * root !== disc) throw new Error('retry: this form wants a whole root');
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(b)} \\pm \\sqrt{${safe(b)}^{2} - 4 \\cdot 1 \\cdot ${safe(c)}}}{2}`, why: T('l4.why.putTheThreeNumbersIn') },
          { latex: `${v} = \\frac{${-b} \\pm \\sqrt{${disc}}}{2}`, why: T('l4.why.workOutUnderTheRoot', { disc }) },
          { latex: `${v} = \\frac{${-b} \\pm ${root}}{2}`, why: T('l4.why.thenTakeTheRoot', { root }) },
        ],
        distractors: [
          { v: pairTex(v, RI(-p), RI(-q)), m: 'minus-b-forgotten' },
          // `\frac{-b \pm root}{2}` is NOT here. It is the last worked line,
          // and the last worked line is the answer: it names the same two
          // numbers as the key and would be a right reading marked wrong.
          { v: `${v} = ${-b + root}, ${v} = ${frac(-b - root, 2)}`, m: 'denominator-under-one-term-only' },
          { v: `${v} = \\pm ${root}`, m: 'discriminant-sign-slip' },
          { v: pairTex(v, RI(p + 1), RI(q)), m: 'arith-slip' },
          { v: pairTex(v, RI(p), RI(q + 1)), m: 'arith-slip' },
          { v: `${v} = ${frac(-b, 2)}`, m: 'partial-rule' },
          { v: `${v} = ${b * b + 4 * c}`, m: 'discriminant-sign-slip' },
        ],
      };
    },
  },
  {
    id: 'qf-lead', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a1 = from(r, LEAD, d);
      const [lo, hi] = ROOTS[rung(d)];
      const c1 = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const c2 = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (c1 % a1 === 0) throw new Error('retry: the front number cancels');
      const [a, b, c] = expandTwo(a1, c1, 1, c2);
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      if (gcd(gcd(a, Math.abs(b)), Math.abs(c)) !== 1) throw new Error('retry: a common factor comes out first');
      const disc = b * b - 4 * a * c;
      const root = Math.round(Math.sqrt(disc));
      if (root * root !== disc) throw new Error('retry: this form wants a whole root');
      const first = RF(-c1, a1);
      const second = RI(-c2);
      if (first.num === second.num) throw new Error('retry: one reading twice');
      if (!distinct(a, b, c, disc)) throw new Error('retry: repeated number');
      const math = `${quad(a, b, c, v)} = 0`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: pairTex(v, first, second),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(b)} \\pm \\sqrt{${safe(b)}^{2} - 4 \\cdot ${a} \\cdot ${safe(c)}}}{2 \\cdot ${a}}`, why: T('l4.why.putTheThreeNumbersIn') },
          { latex: `${v} = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}}`, why: T('l4.why.workOutUnderTheRoot', { disc }) },
          { latex: `${v} = \\frac{${-b} \\pm ${root}}{${2 * a}}`, why: T('l4.why.thenTakeTheRoot', { root }) },
        ],
        distractors: [
          { v: pairTex(v, RF(c1, a1), RI(c2)), m: 'minus-b-forgotten' },
          { v: pairTex(v, RF(-c1, 1), second), m: 'a-read-as-one' },
          { v: `${v} = ${-b + root}, ${v} = ${frac(-b - root, 2 * a)}`, m: 'denominator-under-one-term-only' },
          { v: `${v} = ${b * b + 4 * a * c}`, m: 'discriminant-sign-slip' },
          { v: pairTex(v, first, RI(-c2 + 1)), m: 'arith-slip' },
          { v: `${v} = ${frac(-b, 2 * a)}`, m: 'partial-rule' },
          { v: `${v} = \\pm ${root}`, m: 'discriminant-sign-slip' },
        ],
      };
    },
  },
  {
    id: 'qf-surd', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const h = nz(r, lo, hi);
      const { m, k, n } = drawRadicand(r, d);
      const b = -2 * h; const c = h * h - n;
      const disc = b * b - 4 * c;
      if (disc !== 4 * n) throw new Error('retry: the part under the root does not agree');
      if (!distinct(h, n, b, c)) throw new Error('retry: repeated number');
      const math = `${quad(1, b, c, v)} = 0`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'expression',
        answer: `${v} = ${h} \\pm ${surd(m, k)}`,
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(b)} \\pm \\sqrt{${safe(b)}^{2} - 4 \\cdot 1 \\cdot ${safe(c)}}}{2}`, why: T('l4.why.putTheThreeNumbersIn') },
          { latex: `${v} = \\frac{${-b} \\pm \\sqrt{${disc}}}{2}`, why: T('l4.why.workOutUnderTheRoot', { disc }) },
          { latex: `${v} = \\frac{${-b} \\pm ${surd(2 * m, k)}}{2}`, why: T('l4.why.largestSquareInside', { sq: 4 * m * m }) },
        ],
        distractors: [
          { v: `${v} = ${-h} \\pm ${surd(m, k)}`, m: 'minus-b-forgotten' },
          { v: `${v} = ${h} + ${surd(m, k)}`, m: 'partial-rule' },
          // `h \pm \sqrt{n}` is the key with the square left inside the bar —
          // the same number, so it is not a distractor. See the head of file.
          ...(simplestSurd(m, m * k) ? [{ v: `${v} = ${h} \\pm ${simplestSurd(m, m * k)}`, m: 'perfect-square-left-inside' }] : []),
          { v: `${v} = ${-b} \\pm ${surd(m, k)}`, m: 'denominator-under-one-term-only' },
          // `2m\sqrt{k}` used to sit here as a second reading of the same
          // misconception, and `m\sqrt{mk}` above is exactly that number
          // whenever the square that came out is four.
          { v: `${v} = ${h} \\pm ${surd(m + 1, k)}`, m: 'arith-slip' },
          { v: `${v} = ${h} \\pm ${surd(m - 1, k)}`, m: 'arith-slip' },
          { v: `${v} = ${frac(b * b + 4 * c, 2)}`, m: 'discriminant-sign-slip' },
          { v: `${v} = ${h} \\pm ${surd(m + 2, k)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'qf-none', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = d >= 4 ? from(r, LEAD, d) : 1;
      const [lo, hi] = ROOTS[rung(d)];
      const b = nz(r, lo, hi);
      const c = Math.floor((b * b) / (4 * a)) + int(r, 1, 5 + 6 * rung(d));
      const disc = b * b - 4 * a * c;
      if (disc >= 0) throw new Error('retry: this equation does have real answers');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = `${quad(a, b, c, v)} = 0`;
      return {
        stem: T('l4.ask.solveIt'),
        latex: math,
        type: 'special',
        answer: 'NONE',
        check: { kind: 'quadratic', variable: v, want: 'none', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(b)} \\pm \\sqrt{${safe(b)}^{2} - 4 \\cdot ${a} \\cdot ${c}}}{2 \\cdot ${a}}`, why: T('l4.why.putTheThreeNumbersIn') },
          { latex: `${safe(b)}^{2} - 4 \\cdot ${a} \\cdot ${c} = ${disc}`, why: T('l4.why.workOutUnderTheRoot', { disc }) },
          { latex: `\\sqrt{${disc}}`, why: T('l4.why.noRootBelowZero') },
        ],
        distractors: [
          { v: `${v} = \\pm \\sqrt{${disc}}`, m: 'negative-discriminant-rooted' },
          { v: `${v} = ${frac(-b, 2 * a)}`, m: 'negative-discriminant-rooted' },
          { v: `${v} = ${frac(-b, 2)}`, m: 'a-read-as-one' },
          { v: `${v} = 0`, m: 'partial-rule' },
          { v: `${v} = ${-disc}`, m: 'discriminant-sign-slip' },
        ],
      };
    },
  },
  {
    id: 'qf-story', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, LANDINGS);
      const v = 't';
      const [, hi] = ROOTS[rung(d)];
      const w = int(r, 2, Math.max(3, Math.abs(hi)));
      const u = int(r, 1, Math.max(2, Math.abs(hi)));
      const b = w - u; const c = u * w;
      if (b === 0) throw new Error('retry: the middle term goes out');
      if (!distinct(u, w, b, c)) throw new Error('retry: repeated number');
      const math = `${quad(-1, b, c, v)} = 0`;
      const disc = b * b + 4 * c;
      const root = Math.round(Math.sqrt(disc));
      if (root * root !== disc) throw new Error('retry: this form wants a whole root');
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.whenDoesItLand')}`,
        latex: math,
        type: 'numeric',
        answer: String(w),
        check: { kind: 'quadratic', variable: v, want: 'positive', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(b)} \\pm \\sqrt{${safe(b)}^{2} - 4 \\cdot \\left(-1\\right) \\cdot ${c}}}{2 \\cdot \\left(-1\\right)}`, why: T('l4.why.putTheThreeNumbersIn') },
          { latex: `${v} = \\frac{${-b} \\pm ${root}}{-2}`, why: T('l4.why.workOutUnderTheRoot', { disc }) },
          { latex: `${v} = ${w}`, why: T('l4.why.onlyTheTimeAfterLaunch') },
        ],
        distractors: [
          { v: String(-u), m: 'minus-b-forgotten' },
          { v: String(c), m: 'partial-rule' },
          { v: String(b), m: 'a-read-as-one' },
          { v: String(w + 1), m: 'arith-slip' },
          { v: String(w - 1), m: 'arith-slip' },
          { v: String(disc), m: 'discriminant-sign-slip' },
          { v: String(root), m: 'denominator-under-one-term-only' },
        ],
      };
    },
  },
  {
    id: 'qf-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = nz(r, lo, hi);
      const q = nz(r, lo, hi);
      if (p === q) throw new Error('retry: one reading twice');
      const b = -(p + q); const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      const disc = b * b - 4 * c;
      const root = Math.round(Math.sqrt(disc));
      if (root * root !== disc) throw new Error('retry: this form wants a whole root');
      if (!distinct(p, q, b, c, disc)) throw new Error('retry: repeated number');
      const math = `${quad(1, b, c, v)} = 0`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.solveIt')}`,
        latex: math,
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'quadratic', variable: v, want: 'roots', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(b)} \\pm \\sqrt{${safe(b)}^{2} - 4 \\cdot 1 \\cdot ${safe(c)}}}{2}`, why: T('l4.why.putTheThreeNumbersIn') },
          { latex: `${safe(b)}^{2} - 4 \\cdot 1 \\cdot ${safe(c)} = ${disc}`, why: T('l4.why.workOutUnderTheRoot', { disc }) },
          { latex: `${v} = \\frac{${-b} \\pm ${root}}{2}`, why: T('l4.why.thenTakeTheRoot', { root }) },
        ],
        distractors: [
          { v: pairTex(v, RI(-p), RI(-q)), m: 'minus-b-forgotten' },
          { v: `${v} = ${-b + root}, ${v} = ${frac(-b - root, 2)}`, m: 'denominator-under-one-term-only' },
          { v: `${v} = \\pm ${root}`, m: 'discriminant-sign-slip' },
          { v: pairTex(v, RI(p), RI(q + 1)), m: 'arith-slip' },
          { v: `${v} = ${frac(-b, 2)}`, m: 'partial-rule' },
          { v: `${v} = ${b * b + 4 * c}`, m: 'discriminant-sign-slip' },
          { v: pairTex(v, RI(p), RI(-q)), m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// parabola-features  —  the turn, the line through it, and the crossings
//
// A squared rule draws a curve that falls, turns and rises again. Every rule
// below is built from its turning point outwards, so `a`, `b` and `c` are
// whole numbers and the turn is exactly where the checker says it is. NO
// PARABOLA IS DRAWN: the renderer cannot draw one, and a curve that is not
// drawn cannot be read back. The non-symbolic reading is a table.
// ===========================================================================

/** A rule built from its turning point: returns [a, b, c] with vertex (h, k). */
const ruleFromTurn = (a, h, k) => [a, -2 * a * h, a * h * h + k];

const parabolaFeatures = [
  {
    id: 'pf-vertex', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = d >= 3 ? coefOf(r, LEAD, d) * (r() < 0.4 ? -1 : 1) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: T('l4.ask.whereDoesItTurn'),
        latex: named(v, math),
        type: 'expression',
        answer: pointTex(h, k),
        check: { kind: 'features', variable: v, want: 'vertex', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(B)}}{2 \\cdot ${safe(A)}} = ${h}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `${FN}\\left(${h}\\right) = ${k}`, why: T('l4.why.readTheRuleAtTheTurn', { h }) },
        ],
        distractors: [
          { v: pointTex(-h, k), m: 'turning-point-sign-wrong' },
          { v: pointTex(h, C), m: 'constant-called-the-turn' },
          { v: pointTex(k, h), m: 'swapped-roles' },
          { v: pointTex(h, -k), m: 'highest-and-lowest-swapped' },
          { v: pointTex(B, C), m: 'constant-called-the-turn' },
          { v: pointTex(h + 1, k), m: 'arith-slip' },
          { v: pointTex(h, k + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'pf-axis', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = d >= 3 ? coefOf(r, LEAD, d) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: T('l4.ask.lineOfSymmetry'),
        latex: named(v, math),
        type: 'expression',
        answer: `${v} = ${h}`,
        check: { kind: 'features', variable: v, want: 'axis', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(B)}}{2 \\cdot ${safe(A)}}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `${v} = ${h}`, why: T('l4.why.theLineRunsThroughTheTurn') },
        ],
        distractors: [
          { v: String(h), m: 'axis-given-as-a-number' },
          { v: `${v} = ${-h}`, m: 'turning-point-sign-wrong' },
          { v: `${v} = ${C}`, m: 'constant-called-the-turn' },
          { v: `${v} = ${k}`, m: 'swapped-roles' },
          { v: `${v} = ${h + 1}`, m: 'arith-slip' },
          { v: `${v} = ${B}`, m: 'constant-called-the-turn' },
          { v: `y = ${h}`, m: 'range-written-about-the-input' },
        ],
      };
    },
  },
  {
    id: 'pf-extreme', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const down = d >= 2 && r() < 0.5;
      const a = (d >= 3 ? coefOf(r, LEAD, d) : 1) * (down ? -1 : 1);
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: T(A < 0 ? 'l4.ask.greatestValue' : 'l4.ask.leastValue'),
        latex: named(v, math),
        type: 'numeric',
        answer: String(k),
        check: { kind: 'features', variable: v, want: 'extremeValue', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(B)}}{2 \\cdot ${safe(A)}} = ${h}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `${FN}\\left(${h}\\right) = ${k}`, why: T('l4.why.readTheRuleAtTheTurn', { h }) },
        ],
        distractors: [
          { v: String(C), m: 'constant-called-the-turn' },
          { v: String(h), m: 'swapped-roles' },
          { v: String(-k), m: 'highest-and-lowest-swapped' },
          { v: String(B), m: 'constant-called-the-turn' },
          { v: String(k + 1), m: 'arith-slip' },
          { v: String(k - 1), m: 'arith-slip' },
          { v: String(-h), m: 'turning-point-sign-wrong' },
        ],
      };
    },
  },
  {
    id: 'pf-yint', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = d >= 3 ? coefOf(r, LEAD, d) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (C === 0) throw new Error('retry: the crossing sits on the turn');
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: T('l4.ask.whereItCrossesUpright'),
        latex: named(v, math),
        type: 'numeric',
        answer: String(C),
        check: { kind: 'features', variable: v, want: 'yIntercept', math },
        steps: [
          { latex: `${FN}\\left(0\\right) = ${A} \\cdot 0 + ${safe(B)} \\cdot 0 + ${safe(C)}`, why: T('l4.why.putZeroIn') },
          { latex: `${FN}\\left(0\\right) = ${C}`, why: T('l4.why.onlyTheLastTermSurvives') },
        ],
        distractors: [
          { v: String(k), m: 'constant-called-the-turn' },
          { v: String(h), m: 'swapped-roles' },
          { v: String(B), m: 'constant-called-the-turn' },
          { v: String(-C), m: 'sign-slip' },
          { v: String(C + 1), m: 'arith-slip' },
          { v: String(A), m: 'constant-called-the-turn' },
          { v: '0', m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'pf-zeros', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: one reading twice');
      const b = -(p + q); const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      if (!distinct(p, q, b, c)) throw new Error('retry: repeated number');
      const math = quad(1, b, c, v);
      return {
        stem: T('l4.ask.whereItCrossesFlat'),
        latex: named(v, math),
        type: 'expression',
        answer: pairTex(v, RI(p), RI(q)),
        check: { kind: 'features', variable: v, want: 'zeros', math },
        steps: [
          { latex: `${math} = ${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))}`, why: T('l4.why.pairMultipliesAndAdds', { c, b }) },
          { latex: `${wrap(lin(1, v, -p))}${wrap(lin(1, v, -q))} = 0 \\Rightarrow ${pairTex(v, RI(p), RI(q))}`, why: T('l4.why.oneBracketIsZero') },
        ],
        distractors: [
          { v: pairTex(v, RI(-p), RI(-q)), m: 'turning-point-sign-wrong' },
          { v: `${v} = ${c}`, m: 'constant-called-the-turn' },
          { v: `${v} = ${frac(-b, 2)}`, m: 'swapped-roles' },
          { v: pairTex(v, RI(p + 1), RI(q)), m: 'arith-slip' },
          { v: `${v} = ${p}`, m: 'partial-rule' },
          { v: `${v} = ${b}`, m: 'constant-called-the-turn' },
          { v: pairTex(v, RI(-p), RI(q)), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'pf-range', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const down = r() < 0.5;
      const a = coefOf(r, LEAD, d) * (down ? -1 : 1);
      const [lo, hi] = TURNS[rung(d)];
      const h = nz(r, lo, hi);
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      const rel = A > 0 ? '\\ge' : '\\le';
      return {
        stem: T('l4.ask.whichOutputs'),
        // THE OUTPUT LETTER IS ON THE CARD. See `outNamed`: the key is stated
        // in `y`, so `y` is what the rule is printed in. Printing
        // `f\left(z\right) = \ldots` here left the accepted letter off the
        // display entirely.
        latex: outNamed(math),
        type: 'expression',
        answer: `${OUT} ${rel} ${k}`,
        check: { kind: 'features', variable: v, want: 'range', outputVariable: OUT, math },
        steps: [
          { latex: `${v} = \\frac{-${safe(B)}}{2 \\cdot ${safe(A)}} = ${h}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `${OUT} = ${k}`, why: T('l4.why.readTheRuleAtTheTurn', { h }) },
          { latex: `${OUT} ${rel} ${k}`, why: T(A > 0 ? 'l4.why.opensUpSoNothingLower' : 'l4.why.opensDownSoNothingHigher') },
        ],
        distractors: [
          { v: `${v} ${rel} ${k}`, m: 'range-written-about-the-input' },
          { v: `${OUT} ${A > 0 ? '\\le' : '\\ge'} ${k}`, m: 'highest-and-lowest-swapped' },
          { v: `${OUT} ${rel} ${C}`, m: 'constant-called-the-turn' },
          { v: `${OUT} ${rel} ${h}`, m: 'swapped-roles' },
          { v: `${OUT} ${rel} ${-k}`, m: 'turning-point-sign-wrong' },
          { v: `${OUT} ${rel} ${k + 1}`, m: 'arith-slip' },
          { v: `${OUT} ${rel} ${B}`, m: 'constant-called-the-turn' },
        ],
      };
    },
  },
  {
    id: 'pf-table', rep: 'table', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const a = pick(r, [-1, 1, -2, 2]);
      // THE READING ASKED FOR SITS PAST THE MIRROR OF EVERY PRINTED ONE.
      // A curve is symmetric about its turn, so f(at) equals f(2h - at); if
      // that mirror is one of the rows on screen the item is answered by
      // copying a cell rather than by finding the rule. Drawing `at` first and
      // keeping the turn below half of it makes the collision impossible
      // instead of unlikely.
      const at = 5 + rung(d);
      const h = int(r, 1, Math.floor((at - 1) / 2));
      const k = int(r, 4, 8 + 5 * rung(d));
      const [A, B, C] = ruleFromTurn(a, h, k);
      const rows = [];
      for (let t = 0; t <= 4; t++) rows.push([t, A * t * t + B * t + C]);
      const out = A * at * at + B * at + C;
      if (Math.abs(out) > 5000) throw new Error('retry: the reading outgrows the log');
      if (rows.some((row) => Math.abs(row[1]) > 5000)) throw new Error('retry: the log outgrows the page');
      // A CURVE IS SYMMETRIC, so the reading asked for can equal one already in
      // the log — and then the item is answered by copying a printed cell
      // instead of by finding the rule. Redrawn rather than shipped.
      if (rows.some((row) => row[1] === out)) throw new Error('retry: this reading is already in the log');
      if (!distinct(at, out)) throw new Error('retry: repeated number');
      return {
        stem: T('l4.ask.readingAt', { at }),
        latex: arrayTex('t', 'h', rows, -1),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'regression', model: 'quadratic', want: 'predict', at },
        steps: [
          { latex: `h = ${quad(A, B, C, 't')}`, why: T('l4.why.secondDifferencesAreEqual') },
          { latex: `h = ${out}`, why: T('l4.why.readTheRuleAt', { at }) },
        ],
        distractors: [
          { v: String(rows[4][1] + (rows[4][1] - rows[3][1])), m: 'constant-rate-assumed' },
          { v: String(rows[4][1]), m: 'partial-rule' },
          { v: String(C), m: 'constant-called-the-turn' },
          { v: String(k), m: 'constant-called-the-turn' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(-out), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'pf-story', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, ARCHES);
      const v = pick(r, VARS);
      const down = r() < 0.5;
      const a = (d >= 3 ? coefOf(r, LEAD, d) : 1) * (down ? -1 : 1);
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.whereDoesItTurn')}`,
        latex: named(v, math),
        type: 'expression',
        answer: pointTex(h, k),
        check: { kind: 'features', variable: v, want: 'vertex', math },
        steps: [
          { latex: `${v} = \\frac{-${safe(B)}}{2 \\cdot ${safe(A)}} = ${h}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `${FN}\\left(${h}\\right) = ${k}`, why: T('l4.why.readTheRuleAtTheTurn', { h }) },
        ],
        distractors: [
          { v: pointTex(-h, k), m: 'turning-point-sign-wrong' },
          { v: pointTex(h, C), m: 'constant-called-the-turn' },
          { v: pointTex(k, h), m: 'swapped-roles' },
          { v: pointTex(h, -k), m: 'highest-and-lowest-swapped' },
          { v: pointTex(B, C), m: 'constant-called-the-turn' },
          { v: pointTex(h + 1, k), m: 'arith-slip' },
          { v: pointTex(h, k + 1), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// quadratic-from-vertex  —  two spellings of one curve
//
// A squared rule can be written with its turning point showing, or as a
// product of the two brackets that are zero where the rule is. The two
// spellings describe the same curve, and this node walks between them in both
// directions. Nothing here builds a rule out of two bare readings: a checker
// re-derives its answer from the notation the learner is SHOWN, and a prompt
// that shows only two points shows no rule to read.
// ===========================================================================

const quadraticFromVertex = [
  {
    id: 'qv-vertex', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = d >= 3 ? coefOf(r, LEAD, d) * (r() < 0.4 ? -1 : 1) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      const ans = sqForm(a, -h, 1, k, 1, v);
      return {
        stem: T('l4.ask.ruleTurnsAt', { h, k }),
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `${FN}\\left(${v}\\right) = ${a === 1 ? '' : safe(a)}\\left(${v} - h\\right)^{2} + k`, why: T('l4.why.vertexFormShape') },
          { latex: `${math} = ${ans}`, why: T('l4.why.putTheTurnIn', { h, k }) },
        ],
        distractors: [
          { v: sqForm(a, h, 1, k, 1, v), m: 'turn-sign-copied' },
          { v: sqForm(1, -h, 1, k, 1, v), m: 'leading-multiplier-dropped' },
          { v: sqForm(a, -h, 1, C, 1, v), m: 'zeros-used-as-the-turn' },
          { v: sqForm(a, -h, 1, -k, 1, v), m: 'turn-sign-copied' },
          { v: `${a === 1 ? '' : safe(a)}\\left(${v}^{2} - ${h * h}\\right) ${sg(k)}`, m: 'bracket-squared-term-by-term' },
          { v: sqForm(a, -h, 1, k + 1, 1, v), m: 'arith-slip' },
          { v: sqForm(a, -h - 1, 1, k, 1, v), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'qv-expand', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = d >= 3 ? coefOf(r, LEAD, d) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = sqForm(a, -h, 1, k, 1, v);
      const ans = quad(A, B, C, v);
      return {
        stem: T('l4.ask.writeWithoutBrackets'),
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', variable: v, math },
        steps: [
          { latex: `${math} = ${a === 1 ? '' : a}\\left(${quad(1, -2 * h, h * h, v)}\\right) ${sg(k)}`, why: T('l4.why.squareTheBracketFirst') },
          { latex: `${a === 1 ? '' : a}\\left(${quad(1, -2 * h, h * h, v)}\\right) ${sg(k)} = ${ans}`, why: T('l4.why.shareThenJoin') },
        ],
        distractors: [
          { v: quad(A, B, a * h * h - k, v), m: 'stretch-assumed-one' },
          { v: quad(A, -B, C, v), m: 'turn-sign-copied' },
          { v: quad(A, B, C + 1, v), m: 'arith-slip' },
          { v: quad(1, -2 * h, h * h + k, v), m: 'leading-multiplier-dropped' },
          { v: quad(A, 0, C, v), m: 'bracket-squared-term-by-term' },
          { v: quad(A, B, k, v), m: 'zeros-used-as-the-turn' },
          { v: quad(A, 2 * B, C, v), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'qv-product', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const g = d >= 4 ? from(r, GCFS, d) : 1;
      const [lo, hi] = ROOTS[rung(d)];
      const p = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const q = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      if (p === q) throw new Error('retry: one reading twice');
      const b = -(p + q); const c = p * q;
      if (b === 0 || c === 0) throw new Error('retry: this is a simpler question than its band');
      if (!distinct(g, p, q, g * b, g * c)) throw new Error('retry: repeated number');
      const math = quad(g, g * b, g * c, v);
      const ans = `${g === 1 ? '' : g}${twoBrackets(v, -p, -q)}`;
      return {
        stem: T('l4.ask.ruleIsZeroAt', { p, q }),
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${v} = ${p} \\Rightarrow ${wrap(lin(1, v, -p))}`, why: T('l4.why.aZeroMakesABracket', { p }) },
          { latex: `${math} = ${ans}`, why: T('l4.why.bothZerosBothBrackets') },
        ],
        distractors: [
          { v: `${g === 1 ? '' : g}${twoBrackets(v, p, q)}`, m: 'turn-sign-copied' },
          { v: twoBrackets(v, -p, -q), m: 'leading-multiplier-dropped' },
          { v: `${g === 1 ? '' : g}${twoBrackets(v, -p, -q - 1)}`, m: 'arith-slip' },
          { v: `${g === 1 ? '' : g}${wrap(lin(1, v, -p))}`, m: 'partial-rule' },
          { v: `${g === 1 ? '' : g}${twoBrackets(v, -p - q, 1)}`, m: 'zeros-used-as-the-turn' },
          { v: `${g === 1 ? '' : g}${wrap(lin(1, v, -p))}^{2}`, m: 'stretch-assumed-one' },
          { v: `${p}, ${q}`, m: 'zeros-used-as-the-turn' },
        ],
      };
    },
  },
  {
    id: 'qv-fromturn', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = d >= 4 ? from(r, LEAD, d) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const m = int(r, 1, 2 + rung(d));
      const k = -a * m * m;
      if (m === 0) throw new Error('retry: the two brackets meet');
      if (!distinct(a, h, m, k)) throw new Error('retry: repeated number');
      const math = sqForm(a, -h, 1, k, 1, v);
      const ans = `${a === 1 ? '' : a}${twoBrackets(v, -(h - m), -(h + m))}`;
      return {
        stem: T('l4.ask.writeAsProduct'),
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'factored', form: 'factored', variable: v, math },
        steps: [
          { latex: `${wrap(lin(1, v, -h))}^{2} = ${m * m}`, why: T('l4.why.freeTheSquare') },
          { latex: `${v} = ${h} \\pm ${m}`, why: T('l4.why.rootBothSides') },
        ],
        distractors: [
          { v: `${a === 1 ? '' : a}${twoBrackets(v, h - m, h + m)}`, m: 'turn-sign-copied' },
          { v: twoBrackets(v, -(h - m), -(h + m)), m: 'leading-multiplier-dropped' },
          { v: `${a === 1 ? '' : a}${twoBrackets(v, -h, -m)}`, m: 'zeros-used-as-the-turn' },
          { v: `${a === 1 ? '' : a}${wrap(lin(1, v, -h))}^{2}`, m: 'stretch-assumed-one' },
          { v: `${a === 1 ? '' : a}${twoBrackets(v, -(h - m), -(h + m) - 1)}`, m: 'arith-slip' },
          { v: `${a === 1 ? '' : a}\\left(${v}^{2} - ${h * h}\\right)`, m: 'bracket-squared-term-by-term' },
          { v: `${h - m}, ${h + m}`, m: 'zeros-used-as-the-turn' },
        ],
      };
    },
  },
  {
    id: 'qv-turn', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, ARCHES);
      const v = pick(r, VARS);
      const a = d >= 3 ? coefOf(r, LEAD, d) * (r() < 0.4 ? -1 : 1) : 1;
      const [lo, hi] = TURNS[rung(d)];
      const h = d >= 3 ? nz(r, lo, hi) : int(r, 1, Math.max(2, hi));
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(a, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      const ans = sqForm(a, -h, 1, k, 1, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.ruleTurnsAt', { h, k })}`,
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `${FN}\\left(${v}\\right) = ${a === 1 ? '' : safe(a)}\\left(${v} - h\\right)^{2} + k`, why: T('l4.why.vertexFormShape') },
          { latex: `${math} = ${ans}`, why: T('l4.why.putTheTurnIn', { h, k }) },
        ],
        distractors: [
          { v: sqForm(a, h, 1, k, 1, v), m: 'turn-sign-copied' },
          { v: sqForm(1, -h, 1, k, 1, v), m: 'leading-multiplier-dropped' },
          { v: sqForm(a, -h, 1, C, 1, v), m: 'zeros-used-as-the-turn' },
          { v: sqForm(a, -h, 1, -k, 1, v), m: 'turn-sign-copied' },
          { v: `${a === 1 ? '' : safe(a)}\\left(${v}^{2} - ${h * h}\\right) ${sg(k)}`, m: 'bracket-squared-term-by-term' },
          { v: sqForm(a, -h, 1, k + 1, 1, v), m: 'arith-slip' },
          { v: sqForm(a, -h - 1, 1, k, 1, v), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'qv-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = pick(r, VARS);
      const [lo, hi] = TURNS[rung(d)];
      const h = nz(r, lo, hi);
      const k = signed(r, KONST, d);
      const [A, B, C] = ruleFromTurn(1, h, k);
      if (!distinct(A, B, C, h, k)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      const ans = sqForm(1, -h, 1, k, 1, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.showTheTurn')}`,
        latex: named(v, math),
        type: 'expression',
        answer: ans,
        check: { kind: 'vertexForm', form: 'vertex', variable: v, math },
        steps: [
          { latex: `${v} = \\frac{-${safe(B)}}{2} = ${h}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `${math} = ${ans}`, why: T('l4.why.putTheTurnIn', { h, k }) },
        ],
        distractors: [
          { v: sqForm(1, h, 1, k, 1, v), m: 'turn-sign-copied' },
          { v: sqForm(1, -h, 1, C, 1, v), m: 'zeros-used-as-the-turn' },
          { v: sqForm(1, -h, 1, -k, 1, v), m: 'turn-sign-copied' },
          { v: `\\left(${v}^{2} - ${h * h}\\right) ${sg(k)}`, m: 'bracket-squared-term-by-term' },
          { v: sqForm(1, -h, 1, k + 1, 1, v), m: 'arith-slip' },
          { v: sqForm(1, -h - 1, 1, k, 1, v), m: 'arith-slip' },
          { v: sqForm(2, -h, 1, k, 1, v), m: 'stretch-assumed-one' },
        ],
      };
    },
  },
];

// ===========================================================================
// quadratic-model  —  a throw, a fence and a price
//
// A thrown object, a fenced area and a price against takings all follow a
// squared rule. The turning point is the greatest height, the largest area or
// the best price, and the zeros are where the story ends. Every rule is built
// from its turn outwards, so the answer is a whole number and the checker
// re-derives it from the printed rule.
// ===========================================================================

const quadraticModel = [
  {
    id: 'qm-height', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, THROWS);
      const v = 't';
      const turn = int(r, 2 + rung(d), 4 + 2 * rung(d));
      const top = turn * turn + int(r, 4, 9 + 7 * rung(d));
      const [A, B, C] = ruleFromTurn(-1, turn, top);
      if (C < 0) throw new Error('retry: the throw starts below the ground');
      if (!distinct(turn, top, B, C)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.greatestHeight')}`,
        latex: `h\\left(${v}\\right) = ${math}`,
        type: 'numeric',
        answer: String(top),
        check: { kind: 'features', variable: v, want: 'extremeValue', math },
        steps: [
          { latex: `${v} = \\frac{-${B}}{2 \\cdot \\left(-1\\right)} = ${turn}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `h\\left(${turn}\\right) = ${top}`, why: T('l4.why.readTheRuleAtTheTurn', { h: turn }) },
        ],
        distractors: [
          { v: String(turn), m: 'turn-coordinates-swapped' },
          { v: String(C), m: 'start-value-called-the-greatest' },
          { v: String(B), m: 'zero-called-the-turn' },
          { v: String(top + 1), m: 'arith-slip' },
          { v: String(top - 1), m: 'arith-slip' },
          { v: String(C + B), m: 'constant-rate-assumed' },
          { v: String(-top), m: 'zero-called-the-turn' },
        ],
      };
    },
  },
  {
    id: 'qm-area', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, FENCES);
      const v = 'w';
      const half = int(r, 3 + rung(d), 6 + 4 * rung(d));
      const [A, B, C] = ruleFromTurn(-1, half, half * half);
      if (C !== 0) throw new Error('retry: this fence does not start at nothing');
      if (!distinct(half, B, half * half)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.largestArea')}`,
        latex: `A\\left(${v}\\right) = ${math}`,
        type: 'numeric',
        answer: String(half * half),
        check: { kind: 'features', variable: v, want: 'extremeValue', math },
        steps: [
          { latex: `${v} = \\frac{-${B}}{2 \\cdot \\left(-1\\right)} = ${half}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `A\\left(${half}\\right) = ${half * half}`, why: T('l4.why.readTheRuleAtTheTurn', { h: half }) },
        ],
        distractors: [
          { v: String(half), m: 'turn-coordinates-swapped' },
          { v: String(B), m: 'zero-called-the-turn' },
          { v: '0', m: 'start-value-called-the-greatest' },
          { v: String(half * half + 1), m: 'arith-slip' },
          { v: String(half * half - 1), m: 'arith-slip' },
          { v: String(2 * half), m: 'constant-rate-assumed' },
          { v: String(B * B), m: 'zero-called-the-turn' },
        ],
      };
    },
  },
  {
    id: 'qm-price', rep: 'context', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, PRICES);
      const v = 'p';
      const best = int(r, 3 + rung(d), 6 + 4 * rung(d));
      const [A, B, C] = ruleFromTurn(-1, best, best * best);
      if (!distinct(best, B, best * best)) throw new Error('retry: repeated number');
      void C;
      const math = quad(A, B, 0, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.bestPriceAndTakings')}`,
        latex: `R\\left(${v}\\right) = ${math}`,
        type: 'expression',
        answer: pointTex(best, best * best),
        check: { kind: 'features', variable: v, want: 'vertex', math },
        steps: [
          { latex: `${v} = \\frac{-${B}}{2 \\cdot \\left(-1\\right)} = ${best}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `R\\left(${best}\\right) = ${best * best}`, why: T('l4.why.readTheRuleAtTheTurn', { h: best }) },
        ],
        distractors: [
          { v: pointTex(best * best, best), m: 'turn-coordinates-swapped' },
          { v: pointTex(B, 0), m: 'zero-called-the-turn' },
          { v: pointTex(0, 0), m: 'start-value-called-the-greatest' },
          { v: pointTex(best + 1, best * best), m: 'arith-slip' },
          { v: pointTex(best, best * best + 1), m: 'arith-slip' },
          { v: pointTex(-best, best * best), m: 'zero-called-the-turn' },
          { v: pointTex(best, B), m: 'constant-rate-assumed' },
        ],
      };
    },
  },
  {
    id: 'qm-land', rep: 'context', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, LANDINGS);
      const v = 't';
      const w = int(r, 2 + rung(d), 4 + 3 * rung(d));
      const u = int(r, 1 + rung(d), 3 + 3 * rung(d));
      const b = w - u; const c = u * w;
      if (b === 0) throw new Error('retry: the middle term goes out');
      if (!distinct(u, w, b, c)) throw new Error('retry: repeated number');
      const math = `${quad(-1, b, c, v)} = 0`;
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.whenDoesItLand')}`,
        latex: math,
        type: 'numeric',
        answer: String(w),
        check: { kind: 'quadratic', variable: v, want: 'positive', math },
        steps: [
          { latex: `${quad(1, -b, -c, v)} = 0`, why: T('l4.why.everythingOnOneSide') },
          { latex: `${wrap(lin(1, v, -w))}${wrap(lin(1, v, u))} = 0 \\Rightarrow ${v} = ${w}`, why: T('l4.why.onlyTheTimeAfterLaunch') },
        ],
        distractors: [
          { v: String(-u), m: 'impossible-zero-chosen' },
          { v: String(c), m: 'start-value-called-the-greatest' },
          { v: String(b), m: 'zero-called-the-turn' },
          { v: String(w + 1), m: 'arith-slip' },
          { v: String(w - 1), m: 'arith-slip' },
          { v: String(w + u), m: 'constant-rate-assumed' },
          { v: String(frac(b, 2)), m: 'zero-called-the-turn' },
        ],
      };
    },
  },
  {
    id: 'qm-table', rep: 'table', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      // Same guard as `pf-table`: the reading asked for sits past the mirror of
      // every printed one, so the log cannot be copied. And the height stays
      // above the ground at every reading, printed or asked for, because this
      // one is a thrown object and a height below zero is not a height.
      const at = 5 + rung(d);
      const turn = int(r, 1, Math.floor((at - 1) / 2));
      const top = (at - turn) * (at - turn) + int(r, 4, 10 + 8 * rung(d));
      const [A, B, C] = ruleFromTurn(-1, turn, top);
      const rows = [];
      for (let t = 0; t <= 4; t++) rows.push([t, A * t * t + B * t + C]);
      const out = A * at * at + B * at + C;
      if (rows.some((row) => row[1] < 0)) throw new Error('retry: the log goes below the ground');
      if (Math.abs(out) > 5000) throw new Error('retry: the reading outgrows the log');
      if (rows.some((row) => row[1] === out)) throw new Error('retry: this reading is already in the log');
      if (!distinct(at, out)) throw new Error('retry: repeated number');
      return {
        stem: T('l4.ask.readingAt', { at }),
        latex: arrayTex('t', 'h', rows, -1),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'regression', model: 'quadratic', want: 'predict', at },
        steps: [
          { latex: `h = ${quad(A, B, C, 't')}`, why: T('l4.why.secondDifferencesAreEqual') },
          { latex: `h = ${out}`, why: T('l4.why.readTheRuleAt', { at }) },
        ],
        distractors: [
          { v: String(rows[4][1] + (rows[4][1] - rows[3][1])), m: 'constant-rate-assumed' },
          { v: String(top), m: 'start-value-called-the-greatest' },
          { v: String(C), m: 'start-value-called-the-greatest' },
          { v: String(turn), m: 'turn-coordinates-swapped' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(-out), m: 'zero-called-the-turn' },
        ],
      };
    },
  },
  {
    id: 'qm-dispute', rep: 'verbal', dMin: 1, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES);
      const v = 't';
      const turn = int(r, 2 + rung(d), 4 + 2 * rung(d));
      const top = turn * turn + int(r, 4, 9 + 7 * rung(d));
      const [A, B, C] = ruleFromTurn(-1, turn, top);
      if (C < 0) throw new Error('retry: the throw starts below the ground');
      if (!distinct(turn, top, B, C)) throw new Error('retry: repeated number');
      const math = quad(A, B, C, v);
      return {
        stem: `${T(sc.ctx)} ${T('l4.ask.greatestHeight')}`,
        latex: `h\\left(${v}\\right) = ${math}`,
        type: 'numeric',
        answer: String(top),
        check: { kind: 'features', variable: v, want: 'extremeValue', math },
        steps: [
          { latex: `${v} = \\frac{-${B}}{2 \\cdot \\left(-1\\right)} = ${turn}`, why: T('l4.why.turnIsMinusBOverTwoA') },
          { latex: `h\\left(${turn}\\right) = ${top}`, why: T('l4.why.readTheRuleAtTheTurn', { h: turn }) },
        ],
        distractors: [
          { v: String(turn), m: 'turn-coordinates-swapped' },
          { v: String(C), m: 'start-value-called-the-greatest' },
          { v: String(B), m: 'zero-called-the-turn' },
          { v: String(top + 1), m: 'arith-slip' },
          { v: String(top - 1), m: 'arith-slip' },
          { v: String(C + B), m: 'constant-rate-assumed' },
          { v: String(-top), m: 'zero-called-the-turn' },
        ],
      };
    },
  },
];

/**
 * TAKE THE LENGTH CUE OFF THE TABLE, BEFORE THE ENGINE CHOOSES THREE.
 *
 * `finalize` shows the first three distractors that carry different
 * misconceptions, in the order a form lists them, and then repairs the set only
 * when the key is the UNIQUE shortest or the UNIQUE longest option. Measured
 * across this unit before this wrapper existed, a unique shortest option
 * existed on 69% of option sets and was the right answer 0% of the time: a
 * cadet who had noticed could throw one option away without reading it, and go
 * from one in four to one in three on a gate everything downstream unlocks
 * behind.
 *
 * The cause is structural rather than careless. A wrong answer that is a
 * TRUNCATION — one bracket instead of two, one zero instead of both — is
 * genuinely shorter than the key, and those are among the most useful errors a
 * bank can recognise. So they are kept, and the ORDER is fixed instead: every
 * form's list is sorted by how close each option is in length to the answer, so
 * the three that reach the surface are the three that look most like it, and
 * the truncations stay in `diagnostics` where the echo can still name them.
 *
 * A special answer ("no solution") is localised after this runs and is long in
 * all three languages, so its list is sorted towards the long end instead.
 */
const glyphs = (x) => String(x).replace(/\\left|\\right|\\;|\\,|\s+/g, '').length;

/**
 * ONE READING PER OPTION, MEASURED AS A VALUE.
 *
 * A cadet who is right and is told they are wrong stops believing the thing
 * that told them. Two of the ways this bank did that were invisible to every
 * gate it had, because both are true of the MATHEMATICS and false only of the
 * spellings:
 *
 *   · `\sqrt{20}` beside the key `2\sqrt{5}`, scored an error with a
 *     misconception tag on it — 586 sampled surd-root items, and on 152 of the
 *     rs-side items the twin was the PRINTED QUESTION;
 *   · two wrong options that are one wrong option — `\sqrt{28}` and
 *     `2\sqrt{7}` — so a four-way choice was really three-way, on 164 more.
 *
 * `finalize` in src/learn/generators.js already drops a repeat, but it compares
 * NOTATION, and no amount of comparing notation can see either of those. This
 * compares what the notation is worth.
 *
 * It is a filter and not a rejection on purpose. A form whose set thins below
 * what a rift can offer is rejected anyway, one step later and by name, by
 * `finalize`'s own "too few recognisable errors to diagnose honestly" — so a
 * collision that is structural rather than incidental still fails loudly
 * rather than shipping a three-way choice.
 */
const bare = (x) => String(x).replace(/\s+/g, '').replace(/\\left|\\right/g, '');
/** Is this written option outside the checker entirely? */
const opaque = (x) => /\\text|\\square|\\begin/.test(String(x));

/** The one letter a set of written options is about, if there is exactly one. */
function oneLetter(...srcs) {
  const set = new Set();
  for (const src of srcs) {
    for (const m of String(src).replace(/\\[a-zA-Z]+/g, ' ').matchAll(/[a-zA-Z]/g)) set.add(m[0]);
  }
  return set.size === 1 ? [...set][0] : null;
}

/**
 * A cheap, EXACT fingerprint of what an option is worth.
 *
 * VALUES FIRST, AND THE NAME ON THE LEFT COUNTS. A statement is a statement
 * ABOUT something: `y = 3` and `z = 3` are two different lines and a bare `3`
 * is neither of them, so the unknowns a reading names go into the fingerprint
 * beside the values it carries. Reading only the right-hand side threw away
 * two honest distractors on every parabola-features/pf-axis card.
 *
 * How many statements a reading is written in does NOT count, because that is
 * spelling: `n = 3, n = 4` and `n = \frac{7 \pm 1}{2}` name the same two
 * numbers for the same unknown, and one of them was being marked wrong.
 *
 * Anything with a letter in the value itself is read at four exact rational
 * inputs instead, which settles every polynomial this unit prints (nothing
 * here is above degree three) without a pairwise identity test.
 *
 * `null` means "outside this reading", and a caller may not conclude anything
 * from two nulls.
 */
function worth(src, v) {
  const t = String(src);
  if (opaque(t)) return null;
  try {
    const names = [];
    const vals = [];
    for (const part of splitTop(t, ',')) {
      const body = part.trim();
      if (!body) return null;
      const at = body.indexOf('=');
      names.push(at >= 0 ? bare(body.slice(0, at)) : '');
      for (const tree of expandPm(parse(at >= 0 ? body.slice(at + 1) : body))) vals.push(evalSurd(tree, {}));
    }
    if (vals.length) {
      vals.sort(sCmp);
      const about = [...new Set(names)].sort().join('&');
      return `v:${about}|${vals.map((x) => `${x.p.n}/${x.p.d}+${x.q.n}/${x.q.d}r${x.k}`).join(';')}`;
    }
  } catch { /* it has a letter in it, or it is not a value at all */ }
  if (t.includes('=')) return null;
  const letter = oneLetter(t) || v;
  if (!letter) return null;
  try {
    const node = parse(t);
    const out = [];
    for (const x of [R(37, 100), R(-141, 100), R(5, 7), R(13, 3)]) {
      const y = evalAst(node, { [letter]: x });
      out.push(`${y.n}/${y.d}`);
    }
    return `e:${out.join(';')}`;
  } catch { return null; }
}

/** Do two written options say the same mathematics? Never a guess. */
function sameReading(a, b, v) {
  const A = String(a), B = String(b);
  if (bare(A) === bare(B)) return true;
  if (opaque(A) || opaque(B)) return false;
  const wa = worth(A, v), wb = worth(B, v);
  if (wa === null || wb === null || wa !== wb) return false;
  // An exact fingerprint of exact values settles it on its own. A fingerprint
  // taken at four inputs does not, so it only ever shortlists.
  if (wa.startsWith('v:')) return true;
  const letter = oneLetter(A, B) || v;
  if (!letter) return false;
  try { return equivalent(A, B, letter) === true; } catch { return false; }
}

/** Every option that says something none of the ones before it said. */
function oneReadingEach(answer, ds, v) {
  const kept = [];
  for (const dd of ds) {
    if (!dd || dd.v == null || String(dd.v) === '') continue;
    if (sameReading(dd.v, answer, v)) continue;
    if (kept.some((x) => sameReading(x.v, dd.v, v))) continue;
    kept.push(dd);
  }
  return kept;
}

function balanced(list) {
  return list.map((f) => ({
    ...f,
    build(ctx) {
      const raw = f.build(ctx);
      const ds = raw.distractors;
      if (!Array.isArray(ds) || raw.answer == null) return raw;
      const v = raw.check?.variable || oneLetter(String(raw.answer)) || 'x';
      const live = oneReadingEach(String(raw.answer), ds.filter(Boolean), v);
      const key = raw.type === 'special' ? 16 : glyphs(raw.answer);
      raw.distractors = live
        .map((d, i) => ({ d, i }))
        .sort((a, b) => (Math.abs(glyphs(a.d.v) - key) - Math.abs(glyphs(b.d.v) - key)) || (a.i - b.i))
        .map((x) => x.d);
      return raw;
    },
  }));
}

export default {
  id: 'algebra1-l4',
  skills: {
    'radical-simplify': balanced(radicalSimplify),
    'radical-arith': balanced(radicalArith),
    'factor-trinomial-monic': balanced(factorTrinomialMonic),
    'factor-trinomial-lead': balanced(factorTrinomialLead),
    'difference-of-squares': balanced(differenceOfSquares),
    'poly-divide': balanced(polyDivide),
    'quadratic-zero-product': balanced(quadraticZeroProduct),
    'solve-by-factoring': balanced(solveByFactoring),
    'square-root-method': balanced(squareRootMethod),
    'complete-the-square': balanced(completeTheSquare),
    'quadratic-formula': balanced(quadraticFormula),
    'parabola-features': balanced(parabolaFeatures),
    'quadratic-from-vertex': balanced(quadraticFromVertex),
    'quadratic-model': balanced(quadraticModel),
  },
  strings: { en, es, pl },
};
