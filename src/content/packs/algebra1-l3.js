/**
 * Algebra I · Level 3 — the generator pack.
 *
 * Level 1 taught a balance that stays level. Level 2 taught it to lean, to be
 * turned round, and to be drawn. Level 3 is where the line stops being the only
 * shape in the sky: a rule gets a NAME, a power gets a RULE, and an expression
 * gets more than one term to carry at once. Eleven skills:
 *
 *   function-notation       f(x) is a name for a rule, and f(3) is a reading
 *   domain-range            which inputs a rule takes, and which outputs it gives
 *   exponent-product        x^a · x^b — the factors are counted, not multiplied
 *   exponent-power          (x^a)^b — a power of a power
 *   exponent-quotient       x^a / x^b — the factors that survive
 *   zero-negative-exponent  x^0 and x^-n, read off the quotient rule
 *   poly-add-sub            two polynomials joined, and one taken away
 *   poly-multiply           a binomial times a binomial
 *   factor-common           the distributive property, run backwards
 *   linear-vs-exponential   equal differences against equal factors
 *   exponential-rule        f(x) = a · b^x, evaluated and read
 *
 * IT IS STILL DATA. This file imports one toolkit from `src/learn/generators.js`
 * and three prose bundles from `content/lang/packs/`. It touches no engine file:
 * not the mastery model, not the scheduler, not the session planner, not the
 * report, not the rift surface, not the world, not `src/main.js`.
 *
 * NO NEW VERIFICATION KIND WAS ADDED FOR THIS UNIT, and that was a design
 * constraint rather than an accident. Every item below re-derives through a
 * checker that already existed — `equivalent` samples an identity at fourteen
 * values and will not take the generator's word for it, `evaluate` reads the
 * rule off the printed notation and works it out in exact rational arithmetic,
 * `solve` and `table` do the same for an equation and for a log of readings.
 *
 * WHAT THAT COST, IN WRITING. Two things a full Algebra I unit would like to
 * ask are NOT asked here, because the checker cannot re-derive the answer and
 * an unverified item does not ship:
 *
 *   · "does this set of pairs define a function?" — a yes/no judgement about a
 *     relation. Nothing in `verify()` reads a set of pairs. TEKS A.12(A) is
 *     therefore NOT claimed by this unit; the graph says so in writing.
 *   · a table whose rule is exponential. `check.kind: 'table'` fits a straight
 *     line through the readings and would reject one. Every table here is
 *     linear on purpose, and the exponential rules are shown as rules.
 *
 * PROSE LIVES UNDER content/lang. Not in this file, and nowhere in src/.
 */
import { kit } from '../../learn/generators.js';
import en from '../../../content/lang/packs/algebra1-l3.en.js';
import es from '../../../content/lang/packs/algebra1-l3.es.js';
import pl from '../../../content/lang/packs/algebra1-l3.pl.js';

const {
  pick, int, nz, nzc, co, sg, sgc, lin, distinct, arrayTex,
  // Every situation this pack shows is drawn through `scene`, never through
  // `pick`. `pick` chooses; `scene` chooses AND tells the engine what it chose,
  // which is what the session ledger, the worked analogue and the proving run's
  // transfer test all read.
  scene,
} = kit;

/**
 * The letters this unit uses for the input of a rule.
 *
 * Short, and deliberately none of `a`, `b`, `c`, `f`, `g`, `y`: those are spent
 * on the parameters of a rule, on the name of a rule, and on its output. A
 * learner who meets `b` as a base must never also meet it as an input.
 */
const VARS = ['x', 'n', 't'];
/** The names a rule is given. `g` only ever appears beside `f`. */
const FN = 'f';

// ---------------------------------------------------------------------------
// Notation.
//
// One spelling for each shape, everywhere, so an option set never offers the
// same expression twice in two costumes and `equivalent` never has to decide
// whether two spellings of the key are one answer.
// ---------------------------------------------------------------------------

/** `c·v^e`, printed the one way this pack prints it. "3x^{2}", "-x", "5". */
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

/**
 * A polynomial from a list of [coefficient, exponent] pairs, highest power
 * first. Zero coefficients drop out; an all-zero list is "0".
 */
function poly(terms, v) {
  const live = terms.filter(([c]) => c !== 0);
  if (!live.length) return '0';
  return live
    .map(([c, e], i) => (i === 0 ? mono(c, v, e) : smono(c, v, e)))
    .join(' ');
}

/** "\left(3x + 5\right)" — one bracketed quantity. */
const wrap = (inner) => `\\left(${inner}\\right)`;
/** A rule with its name on it: "f(x) = 3x + 5". */
const named = (v, body, name = FN) => `${name}\\left(${v}\\right) = ${body}`;
/** "5 \cdot 3^{x}" — the one spelling of an exponential rule. */
function expTex(a, b, v) {
  const base = typeof b === 'string' ? b : String(b);
  const power = `${base}^{${v}}`;
  return a === 1 ? power : `${a} \\cdot ${power}`;
}
/** "\left(\frac{1}{2}\right)" — a base that shrinks. */
const unitFrac = (q) => `\\left(\\frac{1}{${q}}\\right)`;

// ---------------------------------------------------------------------------
// Difficulty.
//
// The gate measures the ladder rather than believing it, so every rung below
// moves something `demandOf` can actually see: the size of the numbers, whether
// a sign is in play, and how many terms have to be held at once.
// ---------------------------------------------------------------------------
const rung = (d) => Math.max(1, Math.min(5, d | 0)) - 1;
const from = (r, table, d) => { const [lo, hi] = table[rung(d)]; return int(r, lo, hi); };
const fromNz = (r, table, d) => { const [lo, hi] = table[rung(d)]; return nz(r, lo, hi); };

/**
 * THE EXACTNESS CEILING — the most important number in this file.
 *
 * `equivalent` proves an identity by evaluating both sides at fourteen sample
 * values in exact rational arithmetic. The largest sample is 13, and the
 * arithmetic is backed by JavaScript numbers, which stop representing every
 * integer above 2^53.
 *
 * THE FAILURE THIS PREVENTS IS SILENT. Asked whether `x^{20}` equals `x^{20}`,
 * the checker answers **true** — not because it proved anything, but because
 * both sides rounded to the same wrong double. A checker that has quietly
 * started rounding is worse than no checker at all, because it still says yes,
 * and everything downstream is built on the belief that it would have said no.
 *
 * So no item in this unit is allowed to reach a magnitude the checker cannot
 * hold exactly, and `withinExact` is asserted at the point of the draw rather
 * than hoped for afterwards. `13^12` is about 2.3e13, which leaves three
 * decimal orders of headroom for the coefficient in front of it.
 */
const MAX_COUNT = 12;
const SAMPLE_MAX = 13;
const EXACT_LIMIT = 2 ** 53;
/**
 * Can `equivalent` still check this in exact integers?
 * @param {number} degree the largest total count the expression reaches
 * @param {number} coefficient the largest number standing in front of it
 */
function withinExact(degree, coefficient = 1) {
  if (!Number.isInteger(degree) || Math.abs(degree) > MAX_COUNT) return false;
  return Math.abs(coefficient) * SAMPLE_MAX ** Math.abs(degree) < EXACT_LIMIT;
}
/** The same, as a redraw: a `build` that cannot be checked exactly throws. */
function needExact(degree, coefficient = 1) {
  if (!withinExact(degree, coefficient)) throw new Error('retry: past exact arithmetic');
}

/**
 * The TOTAL count an answer reaches, by band — never the parts.
 *
 * Drawing the parts and adding them puts the ladder at the mercy of the sum,
 * and puts the exactness ceiling at the mercy of the draw. Drawing the total
 * and splitting it makes both exact: every rung really does rise, and no rung
 * can walk off the ceiling.
 */
const SUM = [[4, 5], [6, 7], [8, 8], [10, 11], [12, 12]];
/** The same, for the three-power form, which needs three parts of at least two. */
const SUM3 = [[6, 6], [7, 7], [8, 9], [10, 11], [12, 12]];
/** The count a single printed power carries. */
const EXPO = [[2, 3], [3, 4], [4, 5], [5, 6], [6, 7]];

/**
 * (inner count, outer count) pairs for a power of a power, listed by band.
 *
 * Drawing the two counts separately and multiplying them puts the rung at the
 * mercy of a division that rounds, and the exactness ceiling leaves so little
 * room above that the rung disappears into the sampling noise. Listing the
 * pairs makes the product — which is what `demandOf` actually measures — rise
 * by a fixed amount every band: 4, 6, 8, 10, 12.
 */
/** Small pairs, for the forms whose band is carried by the number in front. */
const XW_HEAVY = [[3, 2], [2, 3], [3, 3]];
const XW_PAIRS = [
  [[2, 3], [3, 2]],
  [[4, 2], [2, 4]],
  [[3, 3]],
  [[5, 2], [2, 5]],
  [[6, 2], [2, 6], [3, 4], [4, 3]],
];
/** Coefficients in front of a power. Never 0, never ±1. */
const COEF = [[2, 3], [2, 4], [3, 10], [4, 13], [8, 19]];
/** Loose constants. Negative from band 3, which is where the ladder turns. */
const KONST = [[1, 6], [2, 10], [-13, 13], [-19, 19], [-27, 27]];
/** Roots and readings — the value an input actually takes. */
const INPUT = [[1, 4], [1, 6], [-6, 8], [-9, 11], [-13, 14]];
/** The small whole numbers a binomial carries. */
const BINOM = [[2, 4], [2, 6], [-7, 7], [-10, 10], [-14, 14]];

/** Split a total into `parts` counts, each at least two. */
function split(r, total, parts) {
  if (total < 2 * parts) throw new Error('retry: the total will not divide into whole counts');
  const cuts = [];
  let left = total;
  for (let i = 0; i < parts - 1; i++) {
    const room = left - 2 * (parts - 1 - i);
    const take = int(r, 2, room);
    cuts.push(take);
    left -= take;
  }
  cuts.push(left);
  return cuts;
}

/** A signed draw that is never zero and never ±1 — a coefficient worth writing. */
function coefOf(r, d) {
  const [lo, hi] = COEF[rung(d)];
  return d >= 3 && r() < 0.45 ? -nzc(r, 2, hi) : nzc(r, Math.max(2, lo), hi);
}

// ---------------------------------------------------------------------------
// Situations.
//
// A pack cannot reach the engine's deck of framings, so it keeps its own and
// draws on `sr`, the situation stream, exactly as the deck does. Every entry is
// ONE sentence, and no entry states a number the mathematics does not use.
// ---------------------------------------------------------------------------

/**
 * Every deck below carries `ctx` and nothing else, and the QUESTION is chosen
 * by the form rather than by the deck. Level 2 pairs a question with each
 * framing, which is right when one situation can be asked two ways; here a
 * situation is only ever asked one way, and a second key per entry would be a
 * second place for the noun in the story and the noun in the question to drift
 * apart. One noun, one place.
 */

/** A rule with a name, read at an input. */
const MACHINES = [
  { ctx: 'l3.ctx.assay' },
  { ctx: 'l3.ctx.kilnRule' },
  { ctx: 'l3.ctx.sorter' },
  { ctx: 'l3.ctx.lathe' },
  { ctx: 'l3.ctx.beacon' },
];

/** A rule that takes whole inputs only, so its outputs are a short list. */
const RANGES = [
  { ctx: 'l3.ctx.crates' },
  { ctx: 'l3.ctx.berths' },
  { ctx: 'l3.ctx.panels' },
  { ctx: 'l3.ctx.rations' },
];

/** A shape that is a power of one count by a power of the same count. */
const FACTORS = [
  { ctx: 'l3.ctx.tileRun' },
  { ctx: 'l3.ctx.coilStack' },
  { ctx: 'l3.ctx.cellArray' },
  { ctx: 'l3.ctx.driveBank' },
  { ctx: 'l3.ctx.oreSeam' },
];

/** A power of a count, held a power of times. */
const NESTS = [
  { ctx: 'l3.ctx.stackOfStacks' },
  { ctx: 'l3.ctx.gridOfGrids' },
  { ctx: 'l3.ctx.podOfPods' },
  { ctx: 'l3.ctx.reelOfReels' },
];

/** A power of a count shared between a power of the same count. */
const SPLITS = [
  { ctx: 'l3.ctx.equalCrews' },
  { ctx: 'l3.ctx.equalPallets' },
  { ctx: 'l3.ctx.equalRacks' },
  { ctx: 'l3.ctx.equalVats' },
];

/** Two records of the same kinds of thing, joined or taken apart. */
const LOADS = [
  { ctx: 'l3.ctx.twoManifests' },
  { ctx: 'l3.ctx.twoSurveys' },
  { ctx: 'l3.ctx.twoHolds' },
  { ctx: 'l3.ctx.twoShifts' },
];

/** A rectangle whose sides are both unknown. */
const PLATES = [
  { ctx: 'l3.ctx.hullPlate' },
  { ctx: 'l3.ctx.deckPanel' },
  { ctx: 'l3.ctx.solarSail' },
  { ctx: 'l3.ctx.floorBay' },
];

/** Terms that all count the same thing, so that thing comes out in front. */
const SHARED = [
  { ctx: 'l3.ctx.sameCrew' },
  { ctx: 'l3.ctx.samePallet' },
  { ctx: 'l3.ctx.sameRack' },
  { ctx: 'l3.ctx.sameVat' },
];

/** Something that multiplies by the same factor every watch. */
const GROWTHS = [
  { ctx: 'l3.ctx.spore' },
  { ctx: 'l3.ctx.relaySignal' },
  { ctx: 'l3.ctx.rustBloom' },
  { ctx: 'l3.ctx.yeastVat' },
];

/** Something that keeps the same fraction of itself every watch. */
const DECAYS = [
  { ctx: 'l3.ctx.coolant' },
  { ctx: 'l3.ctx.isotope' },
  { ctx: 'l3.ctx.powerCell' },
  { ctx: 'l3.ctx.signalFade' },
];

/** A steady climb, logged watch by watch. */
const STEADIES = [
  { ctx: 'l3.ctx.steadyWinch' },
  { ctx: 'l3.ctx.steadyTank' },
  { ctx: 'l3.ctx.steadyStack' },
  { ctx: 'l3.ctx.steadyFrost' },
];

/** Two cadets who disagree about one move. */
const DISPUTES_EXP = [
  { ctx: 'l3.ctx.disputeExponent' },
  { ctx: 'l3.ctx.disputeFactorCount' },
];
const DISPUTES_SIGN = [
  { ctx: 'l3.ctx.disputeMinus' },
  { ctx: 'l3.ctx.disputeSecondBracket' },
];

// ===========================================================================
// exponent-product  —  x^a · x^b = x^{a+b}
//
// The whole node is one sentence: a power records HOW MANY FACTORS, so a
// product of powers records the two counts added. Every wrong answer worth
// naming comes from doing arithmetic to the counts that the factors do not
// justify — multiplying them, subtracting them, or moving the base as well.
//
// The counts are drawn by TOTAL and then split, so the answer's count is what
// the band actually controls. See `SUM` and `split`.
// ===========================================================================
const exponentProduct = [
  {
    id: 'xp-two', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const total = from(r, SUM, d);
      const [a, b] = split(r, total, 2);
      if (a === b) throw new Error('retry: two equal counts hide which one moved');
      needExact(total);
      const math = `${v}^{${a}} \\cdot ${v}^{${b}}`;
      const ans = `${v}^{${total}}`;
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} + ${b}}`, why: T('l3.why.countTheFactors') },
          { latex: `${v}^{${a} + ${b}} = ${ans}`, why: T('l3.why.addTheCounts', { a, b }) },
        ],
        distractors: [
          { v: `${v}^{${a * b}}`, m: 'exponents-multiplied' },
          { v: `${v}^{${Math.abs(a - b)}}`, m: 'exponents-subtracted-wrong-way' },
          { v: `${v}^{${total + 1}}`, m: 'arith-slip' },
          { v: `${v}^{${total - 1}}`, m: 'arith-slip' },
          { v: `${v}^{${a}}`, m: 'partial-rule' },
          { v: mono(total, v, 1), m: 'base-times-exponent' },
          { v: mono(2, v, total), m: 'bases-multiplied' },
        ],
      };
    },
  },
  {
    id: 'xp-coef', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const total = from(r, SUM, d);
      const [a, b] = split(r, total, 2);
      const p = coefOf(r, d);
      const q = coefOf(r, d);
      if (a === b) throw new Error('retry: two equal counts hide which one moved');
      if (!distinct(p, q, p * q)) throw new Error('retry: repeated number');
      needExact(total, p * q);
      const math = `${mono(p, v, a)} \\cdot ${mono(q, v, b)}`;
      const ans = mono(p * q, v, total);
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${p} \\cdot ${q} \\cdot ${v}^{${a}} \\cdot ${v}^{${b}}`, why: T('l3.why.numbersThenLetters') },
          { latex: `${p} \\cdot ${q} \\cdot ${v}^{${a}} \\cdot ${v}^{${b}} = ${ans}`, why: T('l3.why.multiplyNumbersAddCounts') },
        ],
        distractors: [
          { v: mono(p + q, v, total), m: 'coefficients-added' },
          { v: mono(p * q, v, a * b), m: 'exponents-multiplied' },
          { v: mono(p * q, v, Math.abs(a - b)), m: 'exponents-subtracted-wrong-way' },
          { v: mono(p * q, v, total + 1), m: 'arith-slip' },
          { v: mono(p * q, v, a), m: 'partial-rule' },
          { v: mono(-p * q, v, total), m: 'sign-slip' },
          { v: mono(p + q, v, a * b), m: 'coefficients-added' },
        ],
      };
    },
  },
  {
    id: 'xp-three', rep: 'symbolic', dMin: 3, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const total = from(r, SUM3, d);
      const [a, b, c] = split(r, total, 3);
      if (a === b || b === c || a === c) throw new Error('retry: equal counts hide which one moved');
      needExact(total);
      const math = `${v}^{${a}} \\cdot ${v}^{${b}} \\cdot ${v}^{${c}}`;
      const ans = `${v}^{${total}}`;
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} + ${b}} \\cdot ${v}^{${c}}`, why: T('l3.why.twoAtATime') },
          { latex: `${v}^{${a + b}} \\cdot ${v}^{${c}} = ${ans}`, why: T('l3.why.addTheLastCount', { c }) },
        ],
        distractors: [
          { v: `${v}^{${a + b}}`, m: 'partial-rule' },
          { v: `${v}^{${total + 1}}`, m: 'arith-slip' },
          { v: `${v}^{${total - 1}}`, m: 'arith-slip' },
          { v: `${v}^{${Math.min(MAX_COUNT, a * b + c)}}`, m: 'exponents-multiplied' },
          { v: `${v}^{${Math.abs(a + b - c)}}`, m: 'exponents-subtracted-wrong-way' },
          { v: mono(total, v, 1), m: 'base-times-exponent' },
          { v: `${v}^{${a}}`, m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'xp-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, FACTORS);
      const v = pick(r, VARS);
      const total = from(r, SUM, d);
      const [a, b] = split(r, total, 2);
      if (a === b) throw new Error('retry: two equal counts hide which one moved');
      // From band 4 up this form carries a number in front, because the counts
      // themselves cannot get any bigger without leaving exact arithmetic.
      // POSITIVE, always: the situation calls these the sides of a rectangle,
      // and a side of minus fourteen is not a thing the story can mean.
      const heavy = d >= 4;
      const p = heavy ? from(r, COEF, d) : 1;
      const q = heavy ? from(r, COEF, d) : 1;
      if (heavy && !distinct(p, q, p * q)) throw new Error('retry: repeated number');
      needExact(total, Math.abs(p * q));
      const math = `${mono(p, v, a)} \\cdot ${mono(q, v, b)}`;
      const ans = mono(p * q, v, total);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.areaOnePower')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: heavy ? [
          { latex: `${math} = ${p} \\cdot ${q} \\cdot ${v}^{${a}} \\cdot ${v}^{${b}}`, why: T('l3.why.numbersThenLetters') },
          { latex: `${p} \\cdot ${q} \\cdot ${v}^{${a}} \\cdot ${v}^{${b}} = ${ans}`, why: T('l3.why.multiplyNumbersAddCounts') },
        ] : [
          { latex: `${math} = ${v}^{${a} + ${b}}`, why: T('l3.why.countTheFactors') },
          { latex: `${v}^{${a} + ${b}} = ${ans}`, why: T('l3.why.addTheCounts', { a, b }) },
        ],
        distractors: [
          { v: mono(p * q, v, a * b), m: 'exponents-multiplied' },
          { v: mono(p * q, v, Math.abs(a - b)), m: 'exponents-subtracted-wrong-way' },
          { v: mono(p * q, v, total + 1), m: 'arith-slip' },
          { v: mono(p * q, v, a), m: 'partial-rule' },
          { v: mono(total, v, 1), m: 'base-times-exponent' },
          { v: mono(p + q, v, total), m: heavy ? 'coefficients-added' : 'bases-multiplied' },
          { v: mono(p * q, v, total - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'xp-dispute', rep: 'verbal', dMin: 2, dMax: 4,
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES_EXP);
      const v = pick(r, VARS);
      const total = from(r, SUM, d);
      const [a, b] = split(r, total, 2);
      if (a === b || a * b === total) throw new Error('retry: the two readings agree');
      needExact(total);
      const math = `${v}^{${a}} \\cdot ${v}^{${b}}`;
      const ans = `${v}^{${total}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.whichIsRight')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} + ${b}}`, why: T('l3.why.writeOutTheFactors') },
          { latex: `${v}^{${a} + ${b}} = ${ans}`, why: T('l3.why.addTheCounts', { a, b }) },
        ],
        distractors: [
          { v: `${v}^{${a * b}}`, m: 'exponents-multiplied' },
          { v: `${v}^{${Math.abs(a - b)}}`, m: 'exponents-subtracted-wrong-way' },
          { v: `${v}^{${total + 1}}`, m: 'arith-slip' },
          { v: `${v}^{${b}}`, m: 'partial-rule' },
          { v: mono(a * b, v, 1), m: 'base-times-exponent' },
          { v: `${v}^{${total - 1}}`, m: 'arith-slip' },
          { v: mono(total, v, 1), m: 'base-times-exponent' },
        ],
      };
    },
  },
];

// ===========================================================================
// exponent-power  —  (x^a)^b = x^{ab}
//
// The one place in the unit where the counts really are multiplied, which is
// exactly why it is a separate node: it is the rule the product rule is most
// often confused with, and the two have to be held apart on purpose.
//
// The demand ladder here is carried by the NUMBER in front rather than by the
// count, because the count is pinned under the exactness ceiling. Raising 6 to
// the third power is a real piece of arithmetic and the checker can hold it.
// ===========================================================================
const exponentPower = [
  {
    id: 'xw-plain', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const [a, b] = pick(r, XW_PAIRS[rung(d)]);
      const total = a * b;
      // The ONE pair that must never be drawn: 2 and 2, where multiplying the
      // counts and adding them give the same answer, so the item cannot tell a
      // learner who knows this rule from one who is still using the last one.
      if (total === a + b) throw new Error('retry: the two rules agree on this pair');
      needExact(total);
      const math = `\\left(${v}^{${a}}\\right)^{${b}}`;
      const ans = `${v}^{${total}}`;
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} \\cdot ${b}}`, why: T('l3.why.copiesOfTheBracket', { b, a }) },
          { latex: `${v}^{${a} \\cdot ${b}} = ${ans}`, why: T('l3.why.multiplyTheCounts', { a, b }) },
        ],
        distractors: [
          { v: `${v}^{${a + b}}`, m: 'exponents-added' },
          { v: `${v}^{${total + 1}}`, m: 'arith-slip' },
          { v: `${v}^{${total - 1}}`, m: 'arith-slip' },
          { v: `${v}^{${a}}`, m: 'partial-rule' },
          { v: `${v}^{${Math.abs(a - b)}}`, m: 'exponents-subtracted-wrong-way' },
          { v: mono(total, v, 1), m: 'base-times-exponent' },
          { v: `${v}^{${a + b + 1}}`, m: 'exponents-added' },
        ],
      };
    },
  },
  {
    id: 'xw-coef', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const b = int(r, 2, d >= 4 ? 3 : 2);
      const a = int(r, 2, 3);
      const p = (d >= 5 && r() < 0.5 ? -1 : 1) * from(r, COEF, d);
      const total = a * b;
      const raised = p ** b;
      if (!distinct(p, b, raised, a)) throw new Error('retry: repeated number');
      needExact(total, raised);
      const math = `\\left(${mono(p, v, a)}\\right)^{${b}}`;
      const ans = mono(raised, v, total);
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${p}^{${b}} \\cdot \\left(${v}^{${a}}\\right)^{${b}}`, why: T('l3.why.everyFactorIsRaised') },
          { latex: `${p}^{${b}} \\cdot \\left(${v}^{${a}}\\right)^{${b}} = ${ans}`, why: T('l3.why.raiseNumberMultiplyCounts') },
        ],
        distractors: [
          { v: mono(p, v, total), m: 'coefficient-not-raised' },
          { v: mono(p * b, v, total), m: 'coefficient-not-raised' },
          { v: mono(raised, v, a + b), m: 'exponents-added' },
          { v: mono(raised, v, total + 1), m: 'arith-slip' },
          { v: mono(p, v, a + b), m: 'coefficient-not-raised' },
          { v: mono(raised, v, a), m: 'partial-rule' },
          { v: mono(p * b, v, a + b), m: 'exponents-added' },
        ],
      };
    },
  },
  {
    id: 'xw-nested', rep: 'symbolic', dMin: 5, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = int(r, 2, 3);
      const b = int(r, 2, 3);
      const c = 2;
      const total = a * b * c;
      if (a === b) throw new Error('retry: equal counts hide which one moved');
      needExact(total);
      const math = `\\left(\\left(${v}^{${a}}\\right)^{${b}}\\right)^{${c}}`;
      const ans = `${v}^{${total}}`;
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = \\left(${v}^{${a * b}}\\right)^{${c}}`, why: T('l3.why.innerPairFirst') },
          { latex: `\\left(${v}^{${a * b}}\\right)^{${c}} = ${ans}`, why: T('l3.why.multiplyTheCounts', { a: a * b, b: c }) },
        ],
        distractors: [
          { v: `${v}^{${a + b + c}}`, m: 'exponents-added' },
          { v: `${v}^{${a * b + c}}`, m: 'partial-rule' },
          { v: `${v}^{${total + 1}}`, m: 'arith-slip' },
          { v: `${v}^{${a * b}}`, m: 'partial-rule' },
          { v: `${v}^{${a + b * c}}`, m: 'exponents-added' },
          { v: `${v}^{${total - 1}}`, m: 'arith-slip' },
          { v: mono(total, v, 1), m: 'base-times-exponent' },
        ],
      };
    },
  },
  {
    id: 'xw-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, NESTS);
      const v = pick(r, VARS);
      // When the number in front is carrying the band, the OUTER count has to
      // stay small: raising a big number to a count of five leaves exact
      // arithmetic at once, and the guard would then force the number back down
      // — which made band 4 measure harder than band 5.
      const heavy = d >= 4;
      const [a, b] = heavy ? pick(r, XW_HEAVY) : pick(r, XW_PAIRS[rung(d)]);
      const base = heavy ? from(r, COEF, d) : 1;
      const raised = base ** b;
      const total = a * b;
      // The ONE pair that must never be drawn: 2 and 2, where multiplying the
      // counts and adding them give the same answer, so the item cannot tell a
      // learner who knows this rule from one who is still using the last one.
      if (total === a + b) throw new Error('retry: the two rules agree on this pair');
      needExact(total, raised);
      const math = `\\left(${mono(base, v, a)}\\right)^{${b}}`;
      const ans = mono(raised, v, total);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.wholeOnePower')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: heavy ? [
          { latex: `${math} = ${base}^{${b}} \\cdot \\left(${v}^{${a}}\\right)^{${b}}`, why: T('l3.why.everyFactorIsRaised') },
          { latex: `${base}^{${b}} \\cdot \\left(${v}^{${a}}\\right)^{${b}} = ${ans}`, why: T('l3.why.raiseNumberMultiplyCounts') },
        ] : [
          { latex: `${math} = ${v}^{${a} \\cdot ${b}}`, why: T('l3.why.countCopiesOfCount') },
          { latex: `${v}^{${a} \\cdot ${b}} = ${ans}`, why: T('l3.why.multiplyTheCounts', { a, b }) },
        ],
        distractors: [
          { v: mono(raised, v, a + b), m: 'exponents-added' },
          { v: mono(raised, v, total + 1), m: 'arith-slip' },
          { v: mono(raised, v, a), m: 'partial-rule' },
          { v: mono(base, v, total), m: heavy ? 'coefficient-not-raised' : 'exponents-subtracted-wrong-way' },
          { v: mono(total, v, 1), m: 'base-times-exponent' },
          { v: mono(raised, v, total - 1), m: 'arith-slip' },
          { v: mono(raised, v, Math.abs(a - b)), m: 'exponents-subtracted-wrong-way' },
        ],
      };
    },
  },
];

// ===========================================================================
// exponent-quotient  —  x^a / x^b = x^{a-b}
//
// The counterpart to the product rule, and the node that makes the zero and
// negative counts inevitable rather than arbitrary: once the top count can be
// smaller than the bottom one, x^0 and x^-n have to mean something.
// ===========================================================================
const exponentQuotient = [
  {
    id: 'xq-plain', rep: 'symbolic', dMin: 1, dMax: 3,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = from(r, SUM, d);
      const b = int(r, 1, a - 2);
      const left = a - b;
      needExact(a);
      const math = `\\frac{${v}^{${a}}}{${v}^{${b}}}`;
      const ans = `${v}^{${left}}`;
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} - ${b}}`, why: T('l3.why.cancelMatchingFactors') },
          { latex: `${v}^{${a} - ${b}} = ${ans}`, why: T('l3.why.subtractTheCounts', { a, b }) },
        ],
        distractors: [
          { v: `${v}^{${a + b}}`, m: 'exponents-added' },
          { v: `\\frac{1}{${v}^{${left}}}`, m: 'exponents-subtracted-wrong-way' },
          { v: `${v}^{${left + 1}}`, m: 'arith-slip' },
          { v: `${v}^{${Math.max(1, left - 1)}}`, m: 'arith-slip' },
          { v: `${v}^{${a}}`, m: 'partial-rule' },
          { v: mono(left, v, 1), m: 'base-times-exponent' },
          { v: `${v}^{${Math.min(MAX_COUNT, a * b)}}`, m: 'exponents-multiplied' },
        ],
      };
    },
  },
  {
    id: 'xq-coef', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = from(r, SUM, d);
      const b = int(r, 1, a - 2);
      const left = a - b;
      const q = int(r, 2, 2 + 3 * rung(d));
      const k = (d >= 4 && r() < 0.5 ? -1 : 1) * int(r, 2, 2 + 3 * rung(d));
      const p = q * k;
      if (!distinct(p, q, k, a, b)) throw new Error('retry: repeated number');
      needExact(a, p);
      const math = `\\frac{${mono(p, v, a)}}{${mono(q, v, b)}}`;
      const ans = mono(k, v, left);
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = \\frac{${p}}{${q}} \\cdot ${v}^{${a} - ${b}}`, why: T('l3.why.numbersThenLetters') },
          { latex: `\\frac{${p}}{${q}} \\cdot ${v}^{${a} - ${b}} = ${ans}`, why: T('l3.why.divideNumbersSubtractCounts') },
        ],
        distractors: [
          { v: mono(k, v, a + b), m: 'exponents-added' },
          { v: mono(p - q, v, left), m: 'coefficients-added' },
          { v: `\\frac{1}{${mono(k, v, left)}}`, m: 'exponents-subtracted-wrong-way' },
          { v: mono(k, v, left + 1), m: 'arith-slip' },
          { v: mono(p, v, left), m: 'partial-rule' },
          { v: mono(k, v, a), m: 'partial-rule' },
          { v: mono(p - q, v, a + b), m: 'coefficients-added' },
        ],
      };
    },
  },
  {
    id: 'xq-chain', rep: 'symbolic', dMin: 3, dMax: 4,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = from(r, SUM, d);
      const b = int(r, 1, Math.max(1, a - 4));
      const c = int(r, 1, Math.max(1, a - b - 2));
      const left = a - b - c;
      if (left < 1) throw new Error('retry: the bottom outgrows the top');
      if (b === c) throw new Error('retry: equal counts hide which one moved');
      needExact(a);
      const math = `\\frac{${v}^{${a}}}{${v}^{${b}} \\cdot ${v}^{${c}}}`;
      const ans = `${v}^{${left}}`;
      return {
        stem: T('l3.ask.onePower'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = \\frac{${v}^{${a}}}{${v}^{${b} + ${c}}}`, why: T('l3.why.bottomFirst') },
          { latex: `\\frac{${v}^{${a}}}{${v}^{${b + c}}} = ${ans}`, why: T('l3.why.subtractTheCounts', { a, b: b + c }) },
        ],
        distractors: [
          { v: `${v}^{${a - b + c}}`, m: 'partial-rule' },
          { v: `${v}^{${Math.min(MAX_COUNT, a + b + c)}}`, m: 'exponents-added' },
          { v: `\\frac{1}{${v}^{${left}}}`, m: 'exponents-subtracted-wrong-way' },
          { v: `${v}^{${left + 1}}`, m: 'arith-slip' },
          { v: `${v}^{${a - b}}`, m: 'partial-rule' },
          { v: `${v}^{${Math.max(1, left - 1)}}`, m: 'arith-slip' },
          { v: mono(left, v, 1), m: 'base-times-exponent' },
        ],
      };
    },
  },
  {
    id: 'xq-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SPLITS);
      const v = pick(r, VARS);
      const a = from(r, SUM, d);
      const b = int(r, 1, a - 2);
      const left = a - b;
      const heavy = d >= 4;
      const q = heavy ? int(r, 2, 3 + 2 * rung(d)) : 1;
      const k = heavy ? int(r, 2, 3 + 2 * rung(d)) : 1;
      const p = q * k;
      if (heavy && !distinct(p, q, k, a, b)) throw new Error('retry: repeated number');
      needExact(a, p);
      const math = `\\frac{${mono(p, v, a)}}{${mono(q, v, b)}}`;
      const ans = mono(k, v, left);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.shareOnePower')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: heavy ? [
          { latex: `${math} = \\frac{${p}}{${q}} \\cdot ${v}^{${a} - ${b}}`, why: T('l3.why.numbersThenLetters') },
          { latex: `\\frac{${p}}{${q}} \\cdot ${v}^{${a} - ${b}} = ${ans}`, why: T('l3.why.divideNumbersSubtractCounts') },
        ] : [
          { latex: `${math} = ${v}^{${a} - ${b}}`, why: T('l3.why.cancelMatchingFactors') },
          { latex: `${v}^{${a} - ${b}} = ${ans}`, why: T('l3.why.subtractTheCounts', { a, b }) },
        ],
        distractors: [
          { v: mono(k, v, a + b), m: 'exponents-added' },
          { v: `\\frac{1}{${mono(k, v, left)}}`, m: 'exponents-subtracted-wrong-way' },
          { v: mono(k, v, left + 1), m: 'arith-slip' },
          { v: mono(k, v, a), m: 'partial-rule' },
          { v: mono(left, v, 1), m: 'base-times-exponent' },
          { v: mono(k, v, Math.max(1, left - 1)), m: 'arith-slip' },
          { v: mono(p - q, v, left), m: heavy ? 'coefficients-added' : 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// zero-negative-exponent  —  x^0 = 1 and x^-n = 1/x^n
//
// Not a convention to be memorised. Both fall out of the quotient rule the
// learner has just proved: x^3/x^3 is 1 by cancelling and x^0 by subtracting,
// so x^0 has to be 1; and x^2/x^5 is 1/x^3 by cancelling and x^-3 by
// subtracting. Every worked line here shows both readings of one quotient.
// ===========================================================================
const zeroNegativeExponent = [
  {
    id: 'xz-zero', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = from(r, EXPO, d);
      needExact(a);
      const math = `\\frac{${v}^{${a}}}{${v}^{${a}}}`;
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: '1',
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} - ${a}}`, why: T('l3.why.subtractTheCounts', { a, b: a }) },
          { latex: `${math} = 1`, why: T('l3.why.everyFactorCancels') },
        ],
        distractors: [
          { v: '0', m: 'zero-power-is-zero' },
          { v: `${v}^{${a}}`, m: 'partial-rule' },
          { v: v, m: 'base-times-exponent' },
          { v: `${v}^{${2 * a}}`, m: 'exponents-added' },
          { v: String(a), m: 'base-times-exponent' },
          { v: `\\frac{1}{${v}^{${a}}}`, m: 'negative-power-is-reciprocal-slip' },
          { v: '-1', m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'xz-coefzero', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = from(r, EXPO, d);
      const p = coefOf(r, d);
      if (!distinct(p, a)) throw new Error('retry: repeated number');
      const math = `${p}${v}^{0}`;
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: String(p),
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${p} \\cdot ${v}^{0}`, why: T('l3.why.theZeroBelongsToTheLetter') },
          { latex: `${p} \\cdot ${v}^{0} = ${p}`, why: T('l3.why.zeroPowerIsOne') },
        ],
        distractors: [
          { v: '0', m: 'zero-power-is-zero' },
          { v: '1', m: 'partial-rule' },
          { v: mono(p, v, 1), m: 'base-times-exponent' },
          { v: String(-p), m: 'sign-slip' },
          { v: String(p * a), m: 'arith-slip' },
          { v: String(p + 1), m: 'arith-slip' },
          { v: mono(p, v, a), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'xz-negative', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = from(r, EXPO, d);
      const gapSize = int(r, 1, 1 + rung(d));
      const b = a + gapSize;
      needExact(b);
      const math = `\\frac{${v}^{${a}}}{${v}^{${b}}}`;
      const ans = `\\frac{1}{${v}^{${gapSize}}}`;
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} - ${b}}`, why: T('l3.why.subtractTheCounts', { a, b }) },
          { latex: `${v}^{-${gapSize}} = ${ans}`, why: T('l3.why.negativeCountIsUnderTheBar', { n: gapSize }) },
        ],
        distractors: [
          { v: `${v}^{${gapSize}}`, m: 'negative-power-is-reciprocal-slip' },
          { v: mono(-1, v, gapSize), m: 'negative-power-is-negative' },
          { v: `\\frac{1}{${v}^{${gapSize + 1}}}`, m: 'arith-slip' },
          { v: `\\frac{1}{${v}^{${Math.min(MAX_COUNT, a + b)}}}`, m: 'exponents-added' },
          { v: `-\\frac{1}{${v}^{${gapSize}}}`, m: 'negative-power-is-negative' },
          { v: `\\frac{1}{${v}^{${Math.max(1, gapSize - 1)}}}`, m: 'arith-slip' },
          { v: `${v}^{${Math.min(MAX_COUNT, a + b)}}`, m: 'exponents-added' },
        ],
      };
    },
  },
  {
    id: 'xz-numeric', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const base = pick(r, d >= 5 ? [2, 3, 5, 6, 7] : d >= 4 ? [2, 3, 4, 5] : [2, 3]);
      const n = int(r, 2, d >= 5 ? 5 : d >= 4 ? 4 : 3);
      const whole = base ** n;
      if (whole > 4096) throw new Error('retry: the number outgrows the mathematics');
      if (!distinct(base, n, whole)) throw new Error('retry: repeated number');
      const math = `${base}^{-${n}}`;
      return {
        stem: T('l3.ask.exactValue'),
        latex: math,
        type: 'numeric',
        answer: `1/${whole}`,
        check: { kind: 'evaluate', math, env: {} },
        steps: [
          { latex: `${math} = \\frac{1}{${base}^{${n}}}`, why: T('l3.why.negativeCountIsUnderTheBar', { n }) },
          { latex: `\\frac{1}{${base}^{${n}}} = \\frac{1}{${whole}}`, why: T('l3.why.workOutTheBottom', { base, n }) },
        ],
        distractors: [
          { v: String(-whole), m: 'negative-power-is-negative' },
          { v: String(whole), m: 'negative-power-is-reciprocal-slip' },
          { v: `-1/${whole}`, m: 'negative-power-is-negative' },
          { v: String(-base * n), m: 'base-times-exponent' },
          { v: `1/${base * n}`, m: 'base-times-exponent' },
          { v: `1/${whole * base}`, m: 'arith-slip' },
          { v: '0', m: 'zero-power-is-zero' },
        ],
      };
    },
  },
  {
    id: 'xz-context', rep: 'context', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SPLITS);
      const v = pick(r, VARS);
      const a = from(r, EXPO, d);
      needExact(a);
      const math = `\\frac{${v}^{${a}}}{${v}^{${a}}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.oneExpression')}`,
        latex: math,
        type: 'expression',
        answer: '1',
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{${a} - ${a}}`, why: T('l3.why.subtractTheCounts', { a, b: a }) },
          { latex: `${math} = 1`, why: T('l3.why.everyFactorCancels') },
        ],
        distractors: [
          { v: '0', m: 'zero-power-is-zero' },
          { v: `${v}^{${a}}`, m: 'partial-rule' },
          { v: v, m: 'base-times-exponent' },
          { v: String(a), m: 'base-times-exponent' },
          { v: `\\frac{1}{${v}^{${a}}}`, m: 'negative-power-is-reciprocal-slip' },
          { v: `${v}^{${2 * a}}`, m: 'exponents-added' },
          { v: '-1', m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// function-notation  —  f(x) is a NAME for a rule, and f(3) is a reading
//
// The single hardest idea in the node is that `f` is a label and not a factor:
// `f(3)` is not `f` times `3`. Every form keeps the name on screen, and every
// worked line drops it the moment the input goes in, so a learner never sees a
// line where the name is being operated on.
//
// The verifier reads the RULE off the printed statement — `targetIsThePrompt`
// finds `3x + 5` inside `f(x) = 3x + 5`, delimited by an equals sign that
// cannot change its value — and evaluates it from scratch. The name is
// typography, and nothing is checked through it.
// ===========================================================================
/** An input, bracketed when it is negative, so a substitution reads cleanly. */
const at = (k) => (k < 0 ? `\\left(${k}\\right)` : String(k));

const functionNotation = [
  {
    id: 'fn-at', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = coefOf(r, d);
      const b = fromNz(r, KONST, d);
      const k = fromNz(r, INPUT, d);
      const out = a * k + b;
      if (!distinct(a, b, k, out)) throw new Error('retry: repeated number');
      const rule = lin(a, v, b);
      return {
        stem: T('l3.ask.valueOfF', { k }),
        latex: named(v, rule),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'evaluate', math: rule, env: { [v]: k } },
        steps: [
          { latex: `${a} \\cdot ${at(k)} ${sg(b)} = ${a * k} ${sg(b)}`, why: T('l3.why.putTheInputIn', { k }) },
          { latex: `${a * k} ${sg(b)} = ${out}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a + k + b), m: 'base-times-exponent' },
          { v: String(a * (k + b)), m: 'wrong-unwrap-order' },
          { v: String(a * k - b), m: 'sign-slip' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(a * k), m: 'partial-rule' },
          { v: String(-out), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'fn-square', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = coefOf(r, d);
      const b = fromNz(r, KONST, d);
      const k = int(r, d >= 3 ? -6 : 1, 3 + rung(d));
      if (k === 0) throw new Error('retry: a zero input hides the square');
      const sq = k * k;
      const out = a * sq + b;
      if (!distinct(a, b, k, sq, out)) throw new Error('retry: repeated number');
      const rule = `${mono(a, v, 2)} ${sg(b)}`;
      return {
        stem: T('l3.ask.valueOfF', { k }),
        latex: named(v, rule),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'evaluate', math: rule, env: { [v]: k } },
        steps: [
          { latex: `${a} \\cdot ${at(k)}^{2} ${sg(b)} = ${a} \\cdot ${sq} ${sg(b)}`, why: T('l3.why.putTheInputIn', { k }) },
          { latex: `${a} \\cdot ${sq} ${sg(b)} = ${out}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a * k * a * k + b), m: 'coefficient-not-raised' },
          { v: String(a * 2 * k + b), m: 'base-times-exponent' },
          { v: String(a * sq - b), m: 'sign-slip' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(a * sq), m: 'partial-rule' },
          { v: String(-out), m: 'sign-slip' },
          { v: String(out - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'fn-input', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = coefOf(r, d);
      const b = fromNz(r, KONST, d);
      const k = fromNz(r, INPUT, d);
      const out = a * k + b;
      if (!distinct(a, b, k, out)) throw new Error('retry: repeated number');
      const math = `${lin(a, v, b)} = ${out}`;
      return {
        stem: T('l3.ask.whichInputGives', { out }),
        latex: math,
        type: 'numeric',
        answer: String(k),
        check: { kind: 'solve', math, variable: v },
        steps: [
          { latex: `${co(a, v)} = ${out} ${sg(-b)}`, why: T('l3.why.undoToFindInput') },
          { latex: `${co(a, v)} = ${a * k}`, why: T('l3.why.workItOut') },
          { latex: `${v} = ${k}`, why: T('why.divideBothByCoef', { a }) },
        ],
        distractors: [
          { v: String(out - a), m: 'same-op-both' },
          { v: String(out + b), m: 'sign-on-constant' },
          { v: String(-k), m: 'sign-slip' },
          { v: String(k + 1), m: 'arith-slip' },
          { v: String(k - 1), m: 'arith-slip' },
          { v: String(out), m: 'partial-rule' },
          { v: String(a * k), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'fn-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = coefOf(r, d);
      const b = fromNz(r, KONST, d);
      const start = int(r, d >= 3 ? -4 : 1, 3);
      const rows = [0, 1, 2, 3].map((i) => [start + i, a * (start + i) + b]);
      const gap = int(r, 0, 3);
      const out = rows[gap][1];
      return {
        stem: T('l3.ask.missingReading'),
        latex: arrayTex(v, `${FN}\\left(${v}\\right)`, rows, gap),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'table' },
        steps: [
          { latex: `${a} \\cdot ${at(rows[gap][0])} ${sg(b)} = ${a * rows[gap][0]} ${sg(b)}`, why: T('l3.why.readTheRowAcross') },
          { latex: `${a * rows[gap][0]} ${sg(b)} = ${out}`, why: T('l3.why.oneStepDownTable') },
        ],
        distractors: [
          { v: String(out + a), m: 'off-by-one-row' },
          { v: String(out - a), m: 'off-by-one-row' },
          { v: String(rows[gap][0]), m: 'input-output-swap' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(-out), m: 'sign-slip' },
          { v: String(a * rows[gap][0]), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'fn-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = scene(sr, MACHINES);
      const v = pick(r, VARS);
      const a = coefOf(r, d);
      const b = fromNz(r, KONST, d);
      const k = int(r, 1, 4 + 2 * rung(d));
      const out = a * k + b;
      if (!distinct(a, b, k, out)) throw new Error('retry: repeated number');
      const rule = lin(a, v, b);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.valueOfF', { k })}`,
        latex: named(v, rule),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'evaluate', math: rule, env: { [v]: k } },
        steps: [
          { latex: `${a} \\cdot ${at(k)} ${sg(b)} = ${a * k} ${sg(b)}`, why: T('l3.why.putTheInputIn', { k }) },
          { latex: `${a * k} ${sg(b)} = ${out}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a + k + b), m: 'base-times-exponent' },
          { v: String(a * (k + b)), m: 'wrong-unwrap-order' },
          { v: String(a * k - b), m: 'sign-slip' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(a * k), m: 'partial-rule' },
          { v: String(k), m: 'input-output-swap' },
          { v: String(out - 1), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// domain-range  —  which inputs a rule takes, and which outputs it gives
//
// A HONEST NARROWING, STATED IN THE OPEN. The independent checker can
// re-derive an OUTPUT AT AN INPUT; it has no way to re-derive a claim about a
// SET. So every item here asks for an output the checker computes from the
// printed rule, and the item's own draw proves the endpoint claim by working
// the rule at every input in the listed domain before it ships. The domain is
// always a short run of whole numbers, so "every input" is four to seven of
// them and the proof is exhaustive rather than an argument.
//
// What that buys: the mathematics on screen is the mathematics that was
// checked. What it costs is written into the graph — this node does not ask
// "which set is the range", because that answer cannot be re-derived.
// ===========================================================================
/** The outputs a linear rule gives over a whole-number domain, in order. */
function outputsOver(a, b, lo, hi) {
  const out = [];
  for (let x = lo; x <= hi; x++) out.push([x, a * x + b]);
  return out;
}

const domainRange = [
  {
    id: 'dr-top', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = Math.abs(coefOf(r, d));
      const b = fromNz(r, KONST, d);
      const lo = int(r, d >= 3 ? -5 : 1, 2 + rung(d));
      const hi = lo + int(r, 3, 3 + rung(d));
      const pairs = outputsOver(a, b, lo, hi);
      const best = pairs.reduce((m, p) => (p[1] > m[1] ? p : m));
      if (best[0] !== hi) throw new Error('retry: the top input is not the top output');
      if (!distinct(a, b, lo, hi, best[1])) throw new Error('retry: repeated number');
      const rule = lin(a, v, b);
      return {
        stem: `${T('l3.ctx.inputsRun', { lo, hi })} ${T('l3.ask.largestOutput')}`,
        latex: named(v, rule),
        type: 'numeric',
        answer: String(best[1]),
        check: { kind: 'evaluate', math: rule, env: { [v]: hi } },
        steps: [
          { latex: `${a} \\cdot ${at(hi)} ${sg(b)} = ${a * hi} ${sg(b)}`, why: T('l3.why.risingRuleTopInput') },
          { latex: `${a * hi} ${sg(b)} = ${best[1]}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a * lo + b), m: 'range-ends-swapped' },
          { v: String(hi), m: 'input-output-swap' },
          { v: String(a * hi), m: 'partial-rule' },
          { v: String(best[1] + 1), m: 'arith-slip' },
          { v: String(best[1] - 1), m: 'arith-slip' },
          { v: String(a * hi - b), m: 'sign-slip' },
          { v: String(hi - lo), m: 'input-output-swap' },
        ],
      };
    },
  },
  {
    id: 'dr-bottom', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = Math.abs(coefOf(r, d));
      const b = fromNz(r, KONST, d);
      const lo = int(r, d >= 3 ? -5 : 1, 2 + rung(d));
      const hi = lo + int(r, 3, 3 + rung(d));
      const pairs = outputsOver(a, b, lo, hi);
      const least = pairs.reduce((m, p) => (p[1] < m[1] ? p : m));
      if (least[0] !== lo) throw new Error('retry: the bottom input is not the bottom output');
      if (!distinct(a, b, lo, hi, least[1])) throw new Error('retry: repeated number');
      const rule = lin(a, v, b);
      return {
        stem: `${T('l3.ctx.inputsRun', { lo, hi })} ${T('l3.ask.smallestOutput')}`,
        latex: named(v, rule),
        type: 'numeric',
        answer: String(least[1]),
        check: { kind: 'evaluate', math: rule, env: { [v]: lo } },
        steps: [
          { latex: `${a} \\cdot ${at(lo)} ${sg(b)} = ${a * lo} ${sg(b)}`, why: T('l3.why.risingRuleLowInput') },
          { latex: `${a * lo} ${sg(b)} = ${least[1]}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a * hi + b), m: 'range-ends-swapped' },
          { v: String(lo), m: 'input-output-swap' },
          { v: String(a * lo), m: 'partial-rule' },
          { v: String(least[1] + 1), m: 'arith-slip' },
          { v: String(least[1] - 1), m: 'arith-slip' },
          { v: String(a * lo - b), m: 'sign-slip' },
          { v: String(b), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'dr-falling', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = -Math.abs(coefOf(r, d));
      const b = fromNz(r, KONST, d);
      const lo = int(r, -5, 2 + rung(d));
      const hi = lo + int(r, 3, 3 + rung(d));
      const pairs = outputsOver(a, b, lo, hi);
      const best = pairs.reduce((m, p) => (p[1] > m[1] ? p : m));
      if (best[0] !== lo) throw new Error('retry: a falling rule must top out at the bottom input');
      if (!distinct(a, b, lo, hi, best[1])) throw new Error('retry: repeated number');
      const rule = lin(a, v, b);
      return {
        stem: `${T('l3.ctx.inputsRun', { lo, hi })} ${T('l3.ask.largestOutput')}`,
        latex: named(v, rule),
        type: 'numeric',
        answer: String(best[1]),
        check: { kind: 'evaluate', math: rule, env: { [v]: lo } },
        steps: [
          { latex: `${a} \\cdot ${at(lo)} ${sg(b)} = ${a * lo} ${sg(b)}`, why: T('l3.why.fallingRuleTopOutput') },
          { latex: `${a * lo} ${sg(b)} = ${best[1]}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a * hi + b), m: 'range-ends-swapped' },
          { v: String(lo), m: 'input-output-swap' },
          { v: String(-a * lo + b), m: 'sign-slip' },
          { v: String(best[1] + 1), m: 'arith-slip' },
          { v: String(best[1] - 1), m: 'arith-slip' },
          { v: String(a * lo), m: 'partial-rule' },
          { v: String(b), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'dr-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = Math.abs(coefOf(r, d));
      const b = fromNz(r, KONST, d);
      const lo = int(r, d >= 3 ? -4 : 1, 3);
      const rows = outputsOver(a, b, lo, lo + 3);
      const top = rows.length - 1;
      return {
        stem: T('l3.ask.largestOutput'),
        latex: arrayTex(v, `${FN}\\left(${v}\\right)`, rows, top),
        type: 'numeric',
        answer: String(rows[top][1]),
        check: { kind: 'table' },
        steps: [
          { latex: `${a} \\cdot ${at(rows[top][0])} ${sg(b)} = ${a * rows[top][0]} ${sg(b)}`, why: T('l3.why.risingRuleTopInput') },
          { latex: `${a * rows[top][0]} ${sg(b)} = ${rows[top][1]}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(rows[0][1]), m: 'range-ends-swapped' },
          { v: String(rows[top - 1][1]), m: 'off-by-one-row' },
          { v: String(rows[top][0]), m: 'input-output-swap' },
          { v: String(rows[top][1] + 1), m: 'arith-slip' },
          { v: String(rows[top][1] - 1), m: 'arith-slip' },
          { v: String(rows[top][1] + a), m: 'off-by-one-row' },
          { v: String(-rows[top][1]), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'dr-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = scene(sr, RANGES);
      const v = pick(r, VARS);
      const a = Math.abs(coefOf(r, d));
      const b = Math.abs(fromNz(r, KONST, d));
      const lo = 0;
      const hi = int(r, 4, 6 + 2 * rung(d));
      const pairs = outputsOver(a, b, lo, hi);
      const best = pairs.reduce((m, p) => (p[1] > m[1] ? p : m));
      if (best[0] !== hi) throw new Error('retry: the top input is not the top output');
      if (!distinct(a, b, hi, best[1])) throw new Error('retry: repeated number');
      const rule = lin(a, v, b);
      return {
        stem: `${T(sc.ctx, { lo, hi })} ${T('l3.ask.largestOutput')}`,
        latex: named(v, rule),
        type: 'numeric',
        answer: String(best[1]),
        check: { kind: 'evaluate', math: rule, env: { [v]: hi } },
        steps: [
          { latex: `${a} \\cdot ${hi} ${sg(b)} = ${a * hi} ${sg(b)}`, why: T('l3.why.risingRuleTopInput') },
          { latex: `${a * hi} ${sg(b)} = ${best[1]}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(b), m: 'range-ends-swapped' },
          { v: String(hi), m: 'input-output-swap' },
          { v: String(a * hi), m: 'partial-rule' },
          { v: String(best[1] + 1), m: 'arith-slip' },
          { v: String(best[1] - 1), m: 'arith-slip' },
          { v: String(a * hi - b), m: 'sign-slip' },
          { v: String(a + hi + b), m: 'base-times-exponent' },
        ],
      };
    },
  },
];

// ===========================================================================
// poly-add-sub  —  two polynomials joined, and one taken away
//
// Level 1 taught that terms merge only when their letter parts match. This is
// that rule with the brackets left on, and the whole node turns on ONE move:
// a minus in front of a bracket belongs to every term inside it, not just the
// first. The dispute form puts exactly that error on screen beside the truth.
// ===========================================================================
/** A run of terms as signed continuations: "+ 3x^{2} - x + 5". */
const tail = (terms, v) => terms.filter(([c]) => c !== 0).map(([c, e]) => smono(c, v, e)).join(' ');
/** Every coefficient negated — the second bracket after a minus goes in. */
const negate = (terms) => terms.map(([c, e]) => [-c, e]);
/** Term-by-term sum of two degree-two polynomials held as coefficient triples. */
const addTriples = (P, Q) => P.map(([c, e], i) => [c + Q[i][0], e]);

const polyAddSub = [
  {
    id: 'pa-add', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const deg = d >= 2 ? 2 : 1;
      const P = [[deg === 2 ? fromNz(r, COEF, d) : 0, 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const Q = [[deg === 2 ? fromNz(r, COEF, d) : 0, 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const S = addTriples(P, Q);
      if (S.every(([c]) => c === 0)) throw new Error('retry: nothing is left');
      if (S.filter(([c]) => c !== 0).length < 2) throw new Error('retry: too little survives to be worth collecting');
      const math = `${wrap(poly(P, v))} + ${wrap(poly(Q, v))}`;
      const ans = poly(S, v);
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${poly(P, v)} ${tail(Q, v)}`, why: T('l3.why.dropTheFirstBracket') },
          { latex: `${poly(P, v)} ${tail(Q, v)} = ${ans}`, why: T('l3.why.collectEachPower') },
        ],
        distractors: [
          { v: poly([[S[0][0] + S[1][0], 2], [0, 1], [S[2][0], 0]], v), m: 'combine-unlike' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [P[2][0] - Q[2][0], 0]], v), m: 'sign-slip' },
          { v: poly([[S[0][0], 2], [S[1][0] + 1, 1], [S[2][0], 0]], v), m: 'arith-slip' },
          { v: poly(P, v), m: 'partial-rule' },
          { v: poly([[P[0][0] - Q[0][0], 2], [S[1][0], 1], [S[2][0], 0]], v), m: 'sign-slip' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [S[2][0] + 1, 0]], v), m: 'arith-slip' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [0, 0]], v), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'pa-sub', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const P = [[fromNz(r, COEF, d), 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const Q = [[fromNz(r, COEF, d), 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const negQ = negate(Q);
      const S = addTriples(P, negQ);
      if (S.filter(([c]) => c !== 0).length < 2) throw new Error('retry: too little survives to be worth collecting');
      const math = `${wrap(poly(P, v))} - ${wrap(poly(Q, v))}`;
      const ans = poly(S, v);
      // The error this node exists to name: the minus reaches only the first
      // term of the second bracket.
      const halfDone = poly(addTriples(P, [[-Q[0][0], 2], [Q[1][0], 1], [Q[2][0], 0]]), v);
      return {
        stem: T('l3.ask.whatIsLeft'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${poly(P, v)} ${tail(negQ, v)}`, why: T('l3.why.minusEntersEveryTerm') },
          { latex: `${poly(P, v)} ${tail(negQ, v)} = ${ans}`, why: T('l3.why.collectEachPower') },
        ],
        distractors: [
          { v: halfDone, m: 'minus-first-term-only' },
          { v: poly(addTriples(P, Q), v), m: 'sign-slip' },
          { v: poly([[S[0][0] + S[1][0], 2], [0, 1], [S[2][0], 0]], v), m: 'combine-unlike' },
          { v: poly([[S[0][0], 2], [S[1][0] + 1, 1], [S[2][0], 0]], v), m: 'arith-slip' },
          { v: poly(negate(S), v), m: 'sign-slip' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [S[2][0] + 1, 0]], v), m: 'arith-slip' },
          { v: poly(P, v), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'pa-three', rep: 'symbolic', dMin: 4, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const P = [[fromNz(r, COEF, d), 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const Q = [[fromNz(r, COEF, d), 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const W = [[fromNz(r, COEF, d), 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const negW = negate(W);
      const S = addTriples(addTriples(P, Q), negW);
      if (S.filter(([c]) => c !== 0).length < 2) throw new Error('retry: too little survives to be worth collecting');
      const math = `${wrap(poly(P, v))} + ${wrap(poly(Q, v))} - ${wrap(poly(W, v))}`;
      const ans = poly(S, v);
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${poly(P, v)} ${tail(Q, v)} ${tail(negW, v)}`, why: T('l3.why.minusEntersEveryTerm') },
          { latex: `${poly(P, v)} ${tail(Q, v)} ${tail(negW, v)} = ${ans}`, why: T('l3.why.collectEachPower') },
        ],
        distractors: [
          { v: poly(addTriples(addTriples(P, Q), W), v), m: 'sign-slip' },
          { v: poly(addTriples(addTriples(P, Q), [[-W[0][0], 2], [W[1][0], 1], [W[2][0], 0]]), v), m: 'minus-first-term-only' },
          { v: poly([[S[0][0] + S[1][0], 2], [0, 1], [S[2][0], 0]], v), m: 'combine-unlike' },
          { v: poly([[S[0][0], 2], [S[1][0] + 1, 1], [S[2][0], 0]], v), m: 'arith-slip' },
          { v: poly(addTriples(P, Q), v), m: 'partial-rule' },
          { v: poly(negate(S), v), m: 'sign-slip' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [S[2][0] - 1, 0]], v), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'pa-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, LOADS);
      const v = pick(r, VARS);
      const P = [[d >= 3 ? fromNz(r, COEF, d) : 0, 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const Q = [[d >= 3 ? fromNz(r, COEF, d) : 0, 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const S = addTriples(P, Q);
      if (S.filter(([c]) => c !== 0).length < 2) throw new Error('retry: too little survives to be worth collecting');
      const math = `${wrap(poly(P, v))} + ${wrap(poly(Q, v))}`;
      const ans = poly(S, v);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.combinedTotal')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${poly(P, v)} ${tail(Q, v)}`, why: T('l3.why.dropTheFirstBracket') },
          { latex: `${poly(P, v)} ${tail(Q, v)} = ${ans}`, why: T('l3.why.collectEachPower') },
        ],
        distractors: [
          { v: poly([[S[0][0] + S[1][0], 2], [0, 1], [S[2][0], 0]], v), m: 'combine-unlike' },
          { v: poly(addTriples(P, negate(Q)), v), m: 'sign-slip' },
          { v: poly([[S[0][0], 2], [S[1][0] + 1, 1], [S[2][0], 0]], v), m: 'arith-slip' },
          { v: poly(P, v), m: 'partial-rule' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [S[2][0] + 1, 0]], v), m: 'arith-slip' },
          { v: poly(negate(S), v), m: 'sign-slip' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [0, 0]], v), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'pa-dispute', rep: 'verbal', dMin: 3, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, DISPUTES_SIGN);
      const v = pick(r, VARS);
      const P = [[fromNz(r, COEF, d), 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const Q = [[fromNz(r, COEF, d), 2], [fromNz(r, COEF, d), 1], [fromNz(r, KONST, d), 0]];
      const negQ = negate(Q);
      const S = addTriples(P, negQ);
      if (S.filter(([c]) => c !== 0).length < 2) throw new Error('retry: too little survives to be worth collecting');
      if (Q[1][0] === 0 && Q[2][0] === 0) throw new Error('retry: nothing distinguishes the two readings');
      const math = `${wrap(poly(P, v))} - ${wrap(poly(Q, v))}`;
      const ans = poly(S, v);
      const halfDone = poly(addTriples(P, [[-Q[0][0], 2], [Q[1][0], 1], [Q[2][0], 0]]), v);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.whichIsRight')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${poly(P, v)} ${tail(negQ, v)}`, why: T('l3.why.minusEntersEveryTerm') },
          { latex: `${poly(P, v)} ${tail(negQ, v)} = ${ans}`, why: T('l3.why.collectEachPower') },
        ],
        distractors: [
          { v: halfDone, m: 'minus-first-term-only' },
          { v: poly(addTriples(P, Q), v), m: 'sign-slip' },
          { v: poly(negate(S), v), m: 'sign-slip' },
          { v: poly([[S[0][0] + S[1][0], 2], [0, 1], [S[2][0], 0]], v), m: 'combine-unlike' },
          { v: poly([[S[0][0], 2], [S[1][0] + 1, 1], [S[2][0], 0]], v), m: 'arith-slip' },
          { v: poly(P, v), m: 'partial-rule' },
          { v: poly([[S[0][0], 2], [S[1][0], 1], [S[2][0] - 1, 0]], v), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// poly-multiply  —  a binomial times a binomial
//
// Deliberately taught as the distributive property twice, and never as a
// mnemonic: every term in the first bracket multiplies every term in the
// second. The four-product line is always shown before anything is collected,
// so the two middle terms are visible as two things that happen to be alike
// rather than as a step of a rhyme.
// ===========================================================================
const polyMultiply = [
  {
    id: 'pm-mono', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const c = coefOf(r, d);
      const e = int(r, 1, 1 + rung(d));
      const a = fromNz(r, COEF, d);
      const b = fromNz(r, KONST, d);
      needExact(e + 1, Math.abs(c * a));
      if (!distinct(c, a, b, c * a, c * b)) throw new Error('retry: repeated number');
      const math = `${mono(c, v, e)}${wrap(lin(a, v, b))}`;
      const ans = poly([[c * a, e + 1], [c * b, e]], v);
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${mono(c, v, e)} \\cdot ${co(a, v)} + ${mono(c, v, e)} \\cdot ${b}`, why: T('l3.why.monoIntoEveryTerm') },
          { latex: `${mono(c, v, e)} \\cdot ${co(a, v)} + ${mono(c, v, e)} \\cdot ${b} = ${ans}`, why: T('l3.why.multiplyNumbersAddCounts') },
        ],
        distractors: [
          { v: poly([[c * a, e + 1], [b, 0]], v), m: 'partial-distribute' },
          { v: poly([[c * a, e * 1 + 1], [c * b, e + 1]], v), m: 'exponents-added' },
          { v: poly([[c + a, e + 1], [c * b, e]], v), m: 'coefficients-added' },
          { v: poly([[c * a, e], [c * b, e]], v), m: 'partial-rule' },
          { v: poly([[c * a, e + 1], [-c * b, e]], v), m: 'sign-slip' },
          { v: poly([[c * a, e + 1], [c * b + 1, e]], v), m: 'arith-slip' },
          { v: poly([[c * a, e + 1], [c * b, e + 1]], v), m: 'exponents-added' },
        ],
      };
    },
  },
  {
    id: 'pm-binomial', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const p = fromNz(r, BINOM, d);
      const q = fromNz(r, BINOM, d);
      if (p === q) throw new Error('retry: two equal numbers make this a square');
      const mid = p + q;
      const end = p * q;
      if (mid === 0) throw new Error('retry: the middle term vanishes');
      const math = `${wrap(lin(1, v, p))}${wrap(lin(1, v, q))}`;
      const ans = poly([[1, 2], [mid, 1], [end, 0]], v);
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{2} ${smono(q, v, 1)} ${smono(p, v, 1)} ${sg(end)}`, why: T('l3.why.eachTimesEach') },
          { latex: `${v}^{2} ${smono(q, v, 1)} ${smono(p, v, 1)} ${sg(end)} = ${ans}`, why: T('l3.why.collectTheMiddle') },
        ],
        distractors: [
          { v: poly([[1, 2], [0, 1], [end, 0]], v), m: 'middle-term-missed' },
          { v: poly([[1, 2], [mid, 1], [-end, 0]], v), m: 'sign-slip' },
          { v: poly([[1, 2], [end, 1], [mid, 0]], v), m: 'swapped-roles' },
          { v: poly([[1, 2], [mid + 1, 1], [end, 0]], v), m: 'arith-slip' },
          { v: poly([[1, 2], [mid, 1], [end + 1, 0]], v), m: 'arith-slip' },
          { v: poly([[2, 2], [mid, 1], [end, 0]], v), m: 'coefficients-added' },
          { v: poly([[1, 2], [p * q, 1], [p + q, 0]], v), m: 'swapped-roles' },
        ],
      };
    },
  },
  {
    id: 'pm-coef', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = Math.abs(coefOf(r, d));
      const b = Math.abs(coefOf(r, d));
      const p = fromNz(r, BINOM, d);
      const q = fromNz(r, BINOM, d);
      const lead = a * b;
      const mid = a * q + b * p;
      const end = p * q;
      if (mid === 0) throw new Error('retry: the middle term vanishes');
      if (!distinct(a, b, p, q)) throw new Error('retry: repeated number');
      needExact(2, Math.max(lead, Math.abs(mid), Math.abs(end)));
      const math = `${wrap(lin(a, v, p))}${wrap(lin(b, v, q))}`;
      const ans = poly([[lead, 2], [mid, 1], [end, 0]], v);
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${mono(lead, v, 2)} ${smono(a * q, v, 1)} ${smono(b * p, v, 1)} ${sg(end)}`, why: T('l3.why.eachTimesEach') },
          { latex: `${mono(lead, v, 2)} ${smono(a * q, v, 1)} ${smono(b * p, v, 1)} ${sg(end)} = ${ans}`, why: T('l3.why.collectTheMiddle') },
        ],
        distractors: [
          { v: poly([[lead, 2], [0, 1], [end, 0]], v), m: 'middle-term-missed' },
          { v: poly([[lead, 2], [p + q, 1], [end, 0]], v), m: 'partial-distribute' },
          { v: poly([[lead, 2], [mid, 1], [-end, 0]], v), m: 'sign-slip' },
          { v: poly([[a + b, 2], [mid, 1], [end, 0]], v), m: 'coefficients-added' },
          { v: poly([[lead, 2], [mid + 1, 1], [end, 0]], v), m: 'arith-slip' },
          { v: poly([[lead, 2], [a * p + b * q, 1], [end, 0]], v), m: 'swapped-roles' },
          { v: poly([[lead, 2], [mid, 1], [end + 1, 0]], v), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'pm-square', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const a = Math.abs(coefOf(r, d));
      const p = fromNz(r, BINOM, d);
      const lead = a * a;
      const mid = 2 * a * p;
      const end = p * p;
      if (!distinct(a, p, lead, end)) throw new Error('retry: repeated number');
      needExact(2, Math.max(lead, Math.abs(mid), end));
      const math = `${wrap(lin(a, v, p))}^{2}`;
      const ans = poly([[lead, 2], [mid, 1], [end, 0]], v);
      return {
        stem: T('l3.ask.oneExpression'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${wrap(lin(a, v, p))}${wrap(lin(a, v, p))}`, why: T('l3.why.squareIsTwoBrackets') },
          { latex: `${wrap(lin(a, v, p))}${wrap(lin(a, v, p))} = ${ans}`, why: T('l3.why.eachTimesEach') },
        ],
        distractors: [
          { v: poly([[lead, 2], [0, 1], [end, 0]], v), m: 'middle-term-missed' },
          { v: poly([[lead, 2], [a * p, 1], [end, 0]], v), m: 'partial-distribute' },
          { v: poly([[lead, 2], [mid, 1], [-end, 0]], v), m: 'sign-slip' },
          { v: poly([[a, 2], [mid, 1], [end, 0]], v), m: 'coefficient-not-raised' },
          { v: poly([[lead, 2], [mid + 1, 1], [end, 0]], v), m: 'arith-slip' },
          { v: poly([[lead, 2], [mid, 1], [end + 1, 0]], v), m: 'arith-slip' },
          { v: poly([[lead, 2], [2 * p, 1], [end, 0]], v), m: 'partial-distribute' },
        ],
      };
    },
  },
  {
    id: 'pm-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, PLATES);
      const v = pick(r, VARS);
      const p = int(r, 2, 4 + 2 * rung(d));
      const q = int(r, 2, 4 + 2 * rung(d));
      if (p === q) throw new Error('retry: two equal sides make this a square');
      const mid = p + q;
      const end = p * q;
      const math = `${wrap(lin(1, v, p))}${wrap(lin(1, v, q))}`;
      const ans = poly([[1, 2], [mid, 1], [end, 0]], v);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.plateArea')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${v}^{2} ${smono(q, v, 1)} ${smono(p, v, 1)} ${sg(end)}`, why: T('l3.why.eachTimesEach') },
          { latex: `${v}^{2} ${smono(q, v, 1)} ${smono(p, v, 1)} ${sg(end)} = ${ans}`, why: T('l3.why.collectTheMiddle') },
        ],
        distractors: [
          { v: poly([[1, 2], [0, 1], [end, 0]], v), m: 'middle-term-missed' },
          { v: poly([[1, 2], [mid, 1], [-end, 0]], v), m: 'sign-slip' },
          { v: poly([[1, 2], [end, 1], [mid, 0]], v), m: 'swapped-roles' },
          { v: poly([[1, 2], [mid + 1, 1], [end, 0]], v), m: 'arith-slip' },
          { v: poly([[2, 2], [mid, 1], [end, 0]], v), m: 'coefficients-added' },
          { v: poly([[1, 2], [mid, 1], [end + 1, 0]], v), m: 'arith-slip' },
          { v: poly([[1, 1], [mid, 1], [end, 0]], v), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// factor-common  —  the distributive property, run backwards
//
// The learner has expanded brackets since Level 1. This is the same statement
// read right to left, and the only new judgement is HOW MUCH comes out: the
// largest number every term shares, and the lowest count of the letter every
// term carries. Both halves are drawn so that the answer really is the largest
// common factor and not merely a common one — `gcdOf(...) === 1` on what is
// left is asserted, not hoped for.
// ===========================================================================
const gcd2 = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; };
const gcdOf = (...ns) => ns.reduce((g, n) => gcd2(g, n));

const factorCommon = [
  {
    id: 'fc-number', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 3 + 2 * rung(d));
      const a = coefOf(r, d);
      const b = fromNz(r, KONST, d);
      if (gcdOf(a, b) !== 1) throw new Error('retry: something more still comes out');
      const e = int(r, 1, 1 + rung(d));
      needExact(e, Math.abs(k * a));
      if (!distinct(k, a, b, k * a, k * b)) throw new Error('retry: repeated number');
      const math = poly([[k * a, e], [k * b, 0]], v);
      const inner = poly([[a, e], [b, 0]], v);
      const ans = `${k}${wrap(inner)}`;
      return {
        stem: T('l3.ask.factoredForm'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${k} \\cdot ${mono(a, v, e)} + ${k} \\cdot ${b}`, why: T('l3.why.largestSharedFactor') },
          { latex: `${k} \\cdot ${mono(a, v, e)} + ${k} \\cdot ${b} = ${ans}`, why: T('l3.why.divideEachTerm') },
        ],
        distractors: [
          { v: `${k}${wrap(poly([[k * a, e], [b, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${k}${wrap(poly([[a, e], [k * b, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${k}${wrap(poly([[a, e], [-b, 0]], v))}`, m: 'sign-slip' },
          { v: `${k + 1}${wrap(inner)}`, m: 'arith-slip' },
          { v: `${k}${wrap(poly([[a + 1, e], [b, 0]], v))}`, m: 'arith-slip' },
          { v: `${mono(k, v, e)}${wrap(poly([[a, 0], [b, 0]], v))}`, m: 'factor-partial' },
          { v: `${k}${wrap(poly([[a, e], [b, 1]], v))}`, m: 'factor-partial' },
        ],
      };
    },
  },
  {
    id: 'fc-letter', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const p = int(r, 1, 1 + rung(d));
      const q = int(r, 1, 2 + rung(d));
      const a = coefOf(r, d);
      const b = coefOf(r, d);
      if (gcdOf(a, b) !== 1) throw new Error('retry: a number still comes out too');
      needExact(p + q, Math.abs(a));
      if (!distinct(a, b, p, q)) throw new Error('retry: repeated number');
      const math = poly([[a, p + q], [b, p]], v);
      const inner = poly([[a, q], [b, 0]], v);
      const ans = `${mono(1, v, p)}${wrap(inner)}`;
      return {
        stem: T('l3.ask.factoredForm'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${mono(1, v, p)} \\cdot ${mono(a, v, q)} + ${mono(1, v, p)} \\cdot ${b}`, why: T('l3.why.lowestPowerComesOut') },
          { latex: `${mono(1, v, p)} \\cdot ${mono(a, v, q)} + ${mono(1, v, p)} \\cdot ${b} = ${ans}`, why: T('l3.why.divideEachTerm') },
        ],
        distractors: [
          { v: `${mono(1, v, p)}${wrap(poly([[a, p + q], [b, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${mono(1, v, p + q)}${wrap(poly([[a, 0], [b, 0]], v))}`, m: 'factor-partial' },
          { v: `${mono(1, v, p)}${wrap(poly([[a, q], [-b, 0]], v))}`, m: 'sign-slip' },
          { v: `${mono(1, v, p)}${wrap(poly([[a, q], [b, 1]], v))}`, m: 'factor-partial' },
          { v: `${mono(1, v, p + 1)}${wrap(inner)}`, m: 'arith-slip' },
          { v: `${mono(1, v, p)}${wrap(poly([[a, q + 1], [b, 0]], v))}`, m: 'arith-slip' },
          { v: `${mono(1, v, q)}${wrap(inner)}`, m: 'factor-partial' },
        ],
      };
    },
  },
  {
    id: 'fc-both', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 3 + rung(d));
      const p = int(r, 1, 1 + rung(d));
      const q = int(r, 1, 2 + rung(d));
      const a = fromNz(r, COEF, d);
      const b = fromNz(r, COEF, d);
      if (gcdOf(a, b) !== 1) throw new Error('retry: something more still comes out');
      needExact(p + q, Math.abs(k * a));
      if (!distinct(k, a, b, p, q, k * a, k * b)) throw new Error('retry: repeated number');
      const math = poly([[k * a, p + q], [k * b, p]], v);
      const inner = poly([[a, q], [b, 0]], v);
      const front = mono(k, v, p);
      const ans = `${front}${wrap(inner)}`;
      return {
        stem: T('l3.ask.factoredForm'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${front} \\cdot ${mono(a, v, q)} + ${front} \\cdot ${b}`, why: T('l3.why.largestSharedFactor') },
          { latex: `${front} \\cdot ${mono(a, v, q)} + ${front} \\cdot ${b} = ${ans}`, why: T('l3.why.divideEachTerm') },
        ],
        distractors: [
          { v: `${k}${wrap(poly([[a, q], [b, 0]], v))}`, m: 'factor-partial' },
          { v: `${mono(1, v, p)}${wrap(poly([[k * a, q], [k * b, 0]], v))}`, m: 'factor-partial' },
          { v: `${front}${wrap(poly([[k * a, q], [b, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${front}${wrap(poly([[a, q], [-b, 0]], v))}`, m: 'sign-slip' },
          { v: `${front}${wrap(poly([[a, q + 1], [b, 0]], v))}`, m: 'arith-slip' },
          { v: `${mono(k, v, p + q)}${wrap(poly([[a, 0], [b, 0]], v))}`, m: 'factor-partial' },
          { v: `${mono(k + 1, v, p)}${wrap(inner)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'fc-three', rep: 'symbolic', dMin: 4, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 3 + rung(d));
      const a = fromNz(r, COEF, d);
      const b = fromNz(r, COEF, d);
      const c = fromNz(r, KONST, d);
      if (gcdOf(a, b, c) !== 1) throw new Error('retry: something more still comes out');
      needExact(2, Math.abs(k * a));
      if (!distinct(k, a, b, c, k * a, k * b, k * c)) throw new Error('retry: repeated number');
      const math = poly([[k * a, 2], [k * b, 1], [k * c, 0]], v);
      const inner = poly([[a, 2], [b, 1], [c, 0]], v);
      const ans = `${k}${wrap(inner)}`;
      return {
        stem: T('l3.ask.factoredForm'),
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${k} \\cdot ${mono(a, v, 2)} + ${k} \\cdot ${mono(b, v, 1)} + ${k} \\cdot ${c}`, why: T('l3.why.largestSharedFactor') },
          { latex: `${k} \\cdot ${mono(a, v, 2)} + ${k} \\cdot ${mono(b, v, 1)} + ${k} \\cdot ${c} = ${ans}`, why: T('l3.why.divideEachTerm') },
        ],
        distractors: [
          { v: `${k}${wrap(poly([[a, 2], [b, 1], [k * c, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${k}${wrap(poly([[k * a, 2], [b, 1], [c, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${k}${wrap(poly([[a, 2], [b, 1], [-c, 0]], v))}`, m: 'sign-slip' },
          { v: `${k + 1}${wrap(inner)}`, m: 'arith-slip' },
          { v: `${mono(k, v, 1)}${wrap(poly([[a, 1], [b, 0], [c, 0]], v))}`, m: 'factor-partial' },
          { v: `${k}${wrap(poly([[a, 2], [b + 1, 1], [c, 0]], v))}`, m: 'arith-slip' },
          { v: `${k}${wrap(poly([[a, 2], [b, 1], [0, 0]], v))}`, m: 'factor-drops-term' },
        ],
      };
    },
  },
  {
    id: 'fc-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SHARED);
      const v = pick(r, VARS);
      const k = int(r, 2, 3 + 2 * rung(d));
      const a = int(r, 2, 4 + rung(d));
      const b = int(r, 2, 5 + rung(d));
      if (gcdOf(a, b) !== 1) throw new Error('retry: something more still comes out');
      if (!distinct(k, a, b, k * a, k * b)) throw new Error('retry: repeated number');
      const math = poly([[k * a, 1], [k * b, 0]], v);
      const inner = poly([[a, 1], [b, 0]], v);
      const ans = `${k}${wrap(inner)}`;
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.factoredForm')}`,
        latex: math,
        type: 'expression',
        answer: ans,
        check: { kind: 'equivalent', math, variable: v },
        steps: [
          { latex: `${math} = ${k} \\cdot ${mono(a, v, 1)} + ${k} \\cdot ${b}`, why: T('l3.why.largestSharedFactor') },
          { latex: `${k} \\cdot ${mono(a, v, 1)} + ${k} \\cdot ${b} = ${ans}`, why: T('l3.why.checkByExpanding') },
        ],
        distractors: [
          { v: `${k}${wrap(poly([[k * a, 1], [b, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${k}${wrap(poly([[a, 1], [k * b, 0]], v))}`, m: 'factor-drops-term' },
          { v: `${k}${wrap(poly([[a, 1], [-b, 0]], v))}`, m: 'sign-slip' },
          { v: `${k + 1}${wrap(inner)}`, m: 'arith-slip' },
          { v: `${mono(k, v, 1)}${wrap(poly([[a, 0], [b, 0]], v))}`, m: 'factor-partial' },
          { v: `${k}${wrap(poly([[a + 1, 1], [b, 0]], v))}`, m: 'arith-slip' },
          { v: `${k}${wrap(poly([[a, 1], [b, 1]], v))}`, m: 'factor-partial' },
        ],
      };
    },
  },
];

// ===========================================================================
// linear-vs-exponential  —  equal differences against equal factors
//
// CCSS says a linear function grows by equal DIFFERENCES over equal intervals
// and an exponential one by equal FACTORS. This node asks the learner to
// produce each of those two numbers off the notation, and then to watch the
// factor overtake the difference.
//
// Both halves are re-derived by `evaluate` from the printed expression, which
// is why they are written as a ratio of two readings and as a difference of
// two readings rather than as a question about a shape. The checker cannot
// classify a table; it can work out `(5·3^4)/(5·3^3)` and get 3, exactly.
// ===========================================================================
/** Bases that stay whole and stay inside exact arithmetic. */
const BASES = [[2, 3], [3, 4], [4, 5], [5, 6], [6, 7]];

const linearVsExponential = [
  {
    id: 'lx-factor', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const b = from(r, BASES, d);
      const a = int(r, 3, 5 + 4 * rung(d));
      const k = int(r, 2, 2 + rung(d));
      if (b === a || b === k) throw new Error('retry: the factor is hiding behind another number');
      if (!distinct(a, b, k, a * b)) throw new Error('retry: repeated number');
      if (a * b ** (k + 1) > 1e9) throw new Error('retry: the reading outgrows the log');
      const math = `\\frac{${a} \\cdot ${b}^{${k + 1}}}{${a} \\cdot ${b}^{${k}}}`;
      return {
        stem: T('l3.ask.stepFactor'),
        latex: math,
        type: 'numeric',
        answer: String(b),
        check: { kind: 'evaluate', math, env: {} },
        steps: [
          { latex: `${math} = ${b}^{${k + 1} - ${k}}`, why: T('l3.why.divideNeighbours') },
          { latex: `${b}^{${k + 1} - ${k}} = ${b}`, why: T('l3.why.thatIsTheFactor') },
        ],
        distractors: [
          { v: String(a), m: 'growth-start-for-factor' },
          { v: String(a * b - a), m: 'growth-is-linear' },
          { v: String(b + 1), m: 'arith-slip' },
          { v: String(b - 1), m: 'arith-slip' },
          { v: String(a * b), m: 'growth-start-for-factor' },
          { v: String(b * k), m: 'base-times-exponent' },
          { v: String(b + k), m: 'base-times-exponent' },
          { v: String(b * b), m: 'exponents-added' },
          { v: String(a + b), m: 'growth-is-linear' },
        ],
      };
    },
  },
  {
    id: 'lx-step', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const m = coefOf(r, d);
      const c = fromNz(r, KONST, d);
      const k = int(r, 2, 4 + 2 * rung(d));
      if (!distinct(m, c, k)) throw new Error('retry: repeated number');
      const math = `${wrap(`${m} \\cdot ${k + 1} ${sg(c)}`)} - ${wrap(`${m} \\cdot ${k} ${sg(c)}`)}`;
      return {
        stem: T('l3.ask.stepAdd'),
        latex: math,
        type: 'numeric',
        answer: String(m),
        check: { kind: 'evaluate', math, env: {} },
        steps: [
          { latex: `${math} = ${m * (k + 1) + c} - ${m * k + c}`, why: T('l3.why.subtractNeighbours') },
          { latex: `${m * (k + 1) + c} - ${m * k + c} = ${m}`, why: T('l3.why.thatIsTheStep') },
        ],
        distractors: [
          { v: String(c), m: 'growth-start-for-factor' },
          { v: String(m * (k + 1) + c), m: 'partial-rule' },
          { v: String(-m), m: 'sign-slip' },
          { v: String(m + 1), m: 'arith-slip' },
          { v: String(m - 1), m: 'arith-slip' },
          { v: String(m + c), m: 'growth-start-for-factor' },
          { v: String(m * k), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'lx-gap', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const b = from(r, BASES, d);
      const a = int(r, 2, 3 + rung(d));
      const m = int(r, 2, 5 + 2 * rung(d));
      const c = int(r, 1, 8 + 2 * rung(d));
      const k = int(r, 3, 4 + rung(d));
      const grown = a * b ** k;
      const straight = m * k + c;
      const gapValue = grown - straight;
      if (grown > 1e7) throw new Error('retry: the reading outgrows the log');
      if (gapValue <= 0) throw new Error('retry: the factor has not overtaken the step yet');
      if (!distinct(a, b, m, c, k)) throw new Error('retry: repeated number');
      const math = `${a} \\cdot ${b}^{${v}} - ${wrap(lin(m, v, c))}`;
      return {
        stem: T('l3.ask.gapAt', { v, k }),
        latex: math,
        type: 'numeric',
        answer: String(gapValue),
        check: { kind: 'evaluate', math, env: { [v]: k } },
        steps: [
          { latex: `${a} \\cdot ${b}^{${k}} - ${wrap(`${m} \\cdot ${k} ${sg(c)}`)} = ${grown} - ${straight}`, why: T('l3.why.putTheStepIn', { k }) },
          { latex: `${grown} - ${straight} = ${gapValue}`, why: T('l3.why.exponentialOvertakes') },
        ],
        distractors: [
          { v: String(straight - grown), m: 'sign-slip' },
          { v: String(grown), m: 'partial-rule' },
          { v: String(straight), m: 'partial-rule' },
          { v: String(a * b * k - straight), m: 'growth-is-linear' },
          { v: String(gapValue + 1), m: 'arith-slip' },
          { v: String(gapValue - 1), m: 'arith-slip' },
          { v: String(grown + straight), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'lx-table', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, STEADIES);
      const v = pick(r, VARS);
      const m = Math.abs(coefOf(r, d));
      const c = fromNz(r, KONST, d);
      const rows = outputsOver(m, c, 1, 4);
      const gap = int(r, 1, 3);
      const out = rows[gap][1];
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.missingReading')}`,
        latex: arrayTex(v, `${FN}\\left(${v}\\right)`, rows, gap),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'table' },
        steps: [
          { latex: `${rows[0][1]} + ${m} = ${rows[0][1] + m}`, why: T('l3.why.subtractNeighbours') },
          { latex: `${m} \\cdot ${rows[gap][0]} ${sg(c)} = ${out}`, why: T('l3.why.thatIsTheStep') },
        ],
        distractors: [
          { v: String(out + m), m: 'off-by-one-row' },
          { v: String(out - m), m: 'off-by-one-row' },
          { v: String(rows[0][1] * m), m: 'growth-is-linear' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(rows[gap][0]), m: 'input-output-swap' },
          { v: String(m), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'lx-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, GROWTHS);
      const b = from(r, BASES, d);
      const a = int(r, 3, 5 + 4 * rung(d));
      const k = int(r, 2, 2 + rung(d));
      if (b === a || b === k) throw new Error('retry: the factor is hiding behind another number');
      if (!distinct(a, b, k, a * b)) throw new Error('retry: repeated number');
      if (a * b ** (k + 1) > 1e9) throw new Error('retry: the reading outgrows the log');
      const math = `\\frac{${a} \\cdot ${b}^{${k + 1}}}{${a} \\cdot ${b}^{${k}}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.whatFactor')}`,
        latex: math,
        type: 'numeric',
        answer: String(b),
        check: { kind: 'evaluate', math, env: {} },
        steps: [
          { latex: `${math} = ${b}^{${k + 1} - ${k}}`, why: T('l3.why.divideNeighbours') },
          { latex: `${b}^{${k + 1} - ${k}} = ${b}`, why: T('l3.why.thatIsTheFactor') },
        ],
        distractors: [
          { v: String(a), m: 'growth-start-for-factor' },
          { v: String(a * b - a), m: 'growth-is-linear' },
          { v: String(b + 1), m: 'arith-slip' },
          { v: String(b - 1), m: 'arith-slip' },
          { v: String(a * b), m: 'growth-start-for-factor' },
          { v: String(b * k), m: 'base-times-exponent' },
          { v: String(b + k), m: 'base-times-exponent' },
          { v: String(b * b), m: 'exponents-added' },
          { v: String(a + b), m: 'growth-is-linear' },
        ],
      };
    },
  },
];

// ===========================================================================
// exponential-rule  —  f(x) = a · b^x, evaluated and read
//
// The last node, and the one that pays for the four exponent nodes before it:
// f(0) = a only because b^0 = 1, and a decay rule is only readable because a
// unit fraction raised to a count is a count of divisions. Everything here is
// evaluated by the checker from the rule as printed.
// ===========================================================================
const exponentialRule = [
  {
    id: 'er-at', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const b = from(r, BASES, d);
      const a = int(r, 2, 4 + 2 * rung(d));
      const k = int(r, 2, 3 + rung(d));
      const out = a * b ** k;
      if (out > 1e7) throw new Error('retry: the reading outgrows the log');
      if (!distinct(a, b, k, out)) throw new Error('retry: repeated number');
      const rule = expTex(a, b, v);
      return {
        stem: T('l3.ask.valueOfF', { k }),
        latex: named(v, rule),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'evaluate', math: rule, env: { [v]: k } },
        steps: [
          { latex: `${a} \\cdot ${b}^{${k}} = ${a} \\cdot ${b ** k}`, why: T('l3.why.putTheInputIn', { k }) },
          { latex: `${a} \\cdot ${b ** k} = ${out}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a * b * k), m: 'growth-is-linear' },
          { v: String((a * b) ** k), m: 'coefficient-not-raised' },
          { v: String(b ** k), m: 'partial-rule' },
          { v: String(a + b * k), m: 'growth-is-linear' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(a * k ** b), m: 'swapped-roles' },
        ],
      };
    },
  },
  {
    id: 'er-start', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const b = from(r, BASES, d);
      const a = int(r, 3, 6 + 3 * rung(d));
      if (!distinct(a, b)) throw new Error('retry: repeated number');
      const rule = expTex(a, b, v);
      return {
        stem: T('l3.ask.startValue'),
        latex: named(v, rule),
        type: 'numeric',
        answer: String(a),
        check: { kind: 'evaluate', math: rule, env: { [v]: 0 } },
        steps: [
          { latex: `${a} \\cdot ${b}^{0} = ${a} \\cdot 1`, why: T('l3.why.zeroPowerIsOne') },
          { latex: `${a} \\cdot 1 = ${a}`, why: T('l3.why.startIsTheNumberInFront') },
        ],
        distractors: [
          { v: '0', m: 'zero-power-is-zero' },
          { v: String(b), m: 'growth-start-for-factor' },
          { v: String(a * b), m: 'growth-start-for-factor' },
          { v: '1', m: 'partial-rule' },
          { v: String(a + b), m: 'growth-is-linear' },
          { v: String(a + 1), m: 'arith-slip' },
          { v: String(a - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'er-next', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const b = from(r, BASES, d);
      const a = int(r, 2, 4 + 2 * rung(d));
      const k = int(r, 1, 3 + rung(d));
      const out = a * b ** (k + 1);
      if (out > 1e7) throw new Error('retry: the reading outgrows the log');
      if (!distinct(a, b, k, out)) throw new Error('retry: repeated number');
      const rule = expTex(a, b, v);
      return {
        stem: `${T('l3.ask.valueOfF', { k })} ${T('l3.ask.nextReading')}`,
        latex: named(v, rule),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'evaluate', math: rule, env: { [v]: k + 1 } },
        steps: [
          { latex: `${a} \\cdot ${b}^{${k + 1}} = ${a} \\cdot ${b ** (k + 1)}`, why: T('l3.why.oneMoreStepMultiplies') },
          { latex: `${a} \\cdot ${b ** (k + 1)} = ${out}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a * b ** k), m: 'partial-rule' },
          { v: String(a * b ** k + b), m: 'growth-is-linear' },
          { v: String(a * b * (k + 1)), m: 'growth-is-linear' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(b ** (k + 1)), m: 'partial-rule' },
          { v: String((a * b) ** (k + 1)), m: 'coefficient-not-raised' },
        ],
      };
    },
  },
  {
    id: 'er-decay', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const q = pick(r, [2, 3, 4, 5]);
      const k = int(r, 1, 2 + rung(d));
      const whole = int(r, 2, 4 + 2 * rung(d));
      const a = whole * q ** k;
      if (a > 1e6) throw new Error('retry: the store outgrows the tank');
      if (!distinct(a, q, k, whole)) throw new Error('retry: repeated number');
      const rule = `${a} \\cdot ${unitFrac(q)}^{${v}}`;
      return {
        stem: T('l3.ask.valueOfF', { k }),
        latex: named(v, rule),
        type: 'numeric',
        answer: String(whole),
        check: { kind: 'evaluate', math: rule, env: { [v]: k } },
        steps: [
          { latex: `${a} \\cdot ${unitFrac(q)}^{${k}} = \\frac{${a}}{${q ** k}}`, why: T('l3.why.unitFractionDivides', { q, n: k }) },
          { latex: `\\frac{${a}}{${q ** k}} = ${whole}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a - q * k), m: 'growth-is-linear' },
          { v: String(a * q ** k), m: 'negative-power-is-reciprocal-slip' },
          { v: String(Math.round(a / q)), m: 'partial-rule' },
          { v: String(whole + 1), m: 'arith-slip' },
          { v: String(whole - 1), m: 'arith-slip' },
          { v: String(-whole), m: 'negative-power-is-negative' },
          { v: String(a - q), m: 'growth-is-linear' },
        ],
      };
    },
  },
  {
    id: 'er-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const decay = d >= 3 && r() < 0.5;
      const sc = scene(sr, decay ? DECAYS : GROWTHS);
      const v = pick(r, VARS);
      if (decay) {
        const q = pick(r, [2, 3, 4, 5]);
        const k = int(r, 1, 2 + rung(d));
        const whole = int(r, 2, 4 + 2 * rung(d));
        const a = whole * q ** k;
        if (a > 1e6) throw new Error('retry: the store outgrows the tank');
        if (!distinct(a, q, k, whole)) throw new Error('retry: repeated number');
        const rule = `${a} \\cdot ${unitFrac(q)}^{${v}}`;
        return {
          stem: `${T(sc.ctx)} ${T('l3.ask.valueOfF', { k })}`,
          latex: named(v, rule),
          type: 'numeric',
          answer: String(whole),
          check: { kind: 'evaluate', math: rule, env: { [v]: k } },
          steps: [
            { latex: `${a} \\cdot ${unitFrac(q)}^{${k}} = \\frac{${a}}{${q ** k}}`, why: T('l3.why.putTheInputIn', { k }) },
            { latex: `\\frac{${a}}{${q ** k}} = ${whole}`, why: T('l3.why.workItOut') },
          ],
          distractors: [
            { v: String(a - q * k), m: 'growth-is-linear' },
            { v: String(a * q ** k), m: 'negative-power-is-reciprocal-slip' },
            { v: String(Math.round(a / q)), m: 'partial-rule' },
            { v: String(whole + 1), m: 'arith-slip' },
            { v: String(whole - 1), m: 'arith-slip' },
            { v: String(a), m: 'growth-start-for-factor' },
            { v: String(a - q), m: 'growth-is-linear' },
          ],
        };
      }
      const b = from(r, BASES, d);
      const a = int(r, 2, 4 + 2 * rung(d));
      const k = int(r, 2, 3 + rung(d));
      const out = a * b ** k;
      if (out > 1e7) throw new Error('retry: the reading outgrows the log');
      if (!distinct(a, b, k, out)) throw new Error('retry: repeated number');
      const rule = expTex(a, b, v);
      return {
        stem: `${T(sc.ctx)} ${T('l3.ask.valueOfF', { k })}`,
        latex: named(v, rule),
        type: 'numeric',
        answer: String(out),
        check: { kind: 'evaluate', math: rule, env: { [v]: k } },
        steps: [
          { latex: `${a} \\cdot ${b}^{${k}} = ${a} \\cdot ${b ** k}`, why: T('l3.why.putTheInputIn', { k }) },
          { latex: `${a} \\cdot ${b ** k} = ${out}`, why: T('l3.why.workItOut') },
        ],
        distractors: [
          { v: String(a * b * k), m: 'growth-is-linear' },
          { v: String((a * b) ** k), m: 'coefficient-not-raised' },
          { v: String(b ** k), m: 'partial-rule' },
          { v: String(a + b * k), m: 'growth-is-linear' },
          { v: String(out + 1), m: 'arith-slip' },
          { v: String(out - 1), m: 'arith-slip' },
          { v: String(a), m: 'growth-start-for-factor' },
        ],
      };
    },
  },
];

export default {
  id: 'algebra1-l3',
  skills: {
    'function-notation': functionNotation,
    'domain-range': domainRange,
    'exponent-product': exponentProduct,
    'exponent-power': exponentPower,
    'exponent-quotient': exponentQuotient,
    'zero-negative-exponent': zeroNegativeExponent,
    'poly-add-sub': polyAddSub,
    'poly-multiply': polyMultiply,
    'factor-common': factorCommon,
    'linear-vs-exponential': linearVsExponential,
    'exponential-rule': exponentialRule,
  },
  strings: { en, es, pl },
};
