/**
 * Algebra I · Level 2 — the generator pack.
 *
 * THIS FILE IS THE PROOF.
 *
 * It adds three skills to the game. It imports one toolkit from
 * `src/learn/generators.js` and nothing else. It does not touch the mastery
 * engine, the scheduler, the session planner, the report, the rift surface, the
 * world or `src/main.js`. A course is a graph, a pack and a manifest entry, and
 * this is what a pack looks like.
 *
 * THE THREE LINES
 *
 *   bracket-both-sides   a(x + b) = c(x + d).  Both hard cases named by TEKS
 *                        A.5(A) in one statement.
 *   fraction-solve       (x + b)/k = c, and x/k + b = c. A balance divided.
 *   rule-from-table      a table with no rule written on it. Find the rate of
 *                        change, then the missing cell.
 *
 * EVERY ITEM STILL GOES THROUGH THE SAME GATE. `finalize` in generators.js
 * re-derives the answer from the displayed notation, checks every worked line,
 * refuses untagged distractors and refuses a set with fewer than five
 * recognisable errors. A pack can add mathematics. It cannot add a way past
 * that.
 *
 * PROSE LIVES UNDER content/lang. Not in this file, and not anywhere in src/ —
 * the same rule the shipped item bundles follow. The three bundles this pack
 * imports are merged in behind `content/lang/items.*.js`. Three locales or the
 * pack does not load, and nothing here overrides an existing key.
 */
import { kit } from '../../learn/generators.js';
// Prose lives under content/lang, never in src/ — the same rule the shipped
// item bundles follow. See content/lang/packs/.
import en from '../../../content/lang/packs/algebra1-l2.en.js';
import es from '../../../content/lang/packs/algebra1-l2.es.js';
import pl from '../../../content/lang/packs/algebra1-l2.pl.js';

const {
  pick, int, nz, nzc, band, Bkonst, Broot, co, sg, lin, paren, distinct, arrayTex,
} = kit;

/** The letters this unit uses. Short, and never `l` or `o`. */
const VARS = ['x', 'n', 'm', 't', 'p'];

// ---------------------------------------------------------------------------
// bracket-both-sides —  a(x + b) = c(x + d)
// ---------------------------------------------------------------------------
/**
 * Draw an equation with a bracket on each side that has a whole-number answer.
 * `a` and `c` must differ, or the letters cancel and the statement is either
 * always true or never true — a different skill, and one Level 1 already owns.
 */
function drawBrackets(r, d, { negOutside = false } = {}) {
  const v = pick(r, VARS);
  const x = Broot(r, d);
  const a = negOutside ? -Math.abs(nzc(r, 2, 3 + d)) : nzc(r, 2, 3 + d);
  let c = nzc(r, 2, 3 + d);
  if (a === c) c = Math.abs(a) >= 9 ? 2 : Math.abs(a) + 1;
  const b = Bkonst(r, d);
  // The right-hand bracket's constant is forced, so the solution is the whole
  // number drawn above rather than whatever the arithmetic happens to give.
  //   a(x + b) = c(x + e)  =>  e = ((a - c)x + ab) / c
  const num = (a - c) * x + a * b;
  if (num % c !== 0) throw new Error('retry: this draw does not land on a whole number');
  const e = num / c;
  if (e === 0 || b === 0) throw new Error('retry: an empty bracket is a different question');
  if (!distinct(a, b, c, e, x)) throw new Error('retry: repeated number');
  return { v, x, a, b, c, e };
}

const bracketBothSides = [
  {
    id: 'bbs-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, x, a, b, c, e } = drawBrackets(r, d);
      const eqn = `${paren(a, lin(1, v, b))} = ${paren(c, lin(1, v, e))}`;
      const L = lin(a, v, a * b);   // opened left
      const Rt = lin(c, v, c * e);  // opened right
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${L} = ${Rt}`, why: T('l2.why.openBothBrackets') },
          { latex: `${lin(a - c, v, a * b)} = ${c * e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
          { latex: `${co(a - c, v)} = ${c * e - a * b}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
        ],
        distractors: [
          // the bracket opened onto the letter only, on one side or both
          { v: String(safeDiv((c * e) - a * b, a - c) + 1), m: 'arith-slip' },
          { v: String(safeDiv(e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(c * e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(a * b - c * e, a - c)), m: 'collect-wrong-side' },
          { v: String(safeDiv(c * e - a * b, a + c)), m: 'collect-wrong-side' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(x - 1), m: 'arith-slip' },
          { v: String(c * e - a * b), m: 'one-side-only' },
        ],
      };
    },
  },
  {
    id: 'bbs-negative', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, x, a, b, c, e } = drawBrackets(r, d, { negOutside: true });
      const eqn = `${paren(a, lin(1, v, b))} = ${paren(c, lin(1, v, e))}`;
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(a, v, a * b)} = ${lin(c, v, c * e)}`, why: T('l2.why.minusEntersEveryTerm') },
          { latex: `${lin(a - c, v, a * b)} = ${c * e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
          { latex: `${co(a - c, v)} = ${c * e - a * b}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
        ],
        distractors: [
          { v: String(safeDiv(c * e - (a * b - 2 * a * b), a - c)), m: 'neg-distribute' },
          { v: String(safeDiv(c * e + a * b, a - c)), m: 'neg-distribute' },
          { v: String(safeDiv(a * b - c * e, a - c)), m: 'collect-wrong-side' },
          { v: String(safeDiv(c * e - a * b, a + c)), m: 'collect-wrong-side' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(safeDiv(e - b, a - c)), m: 'partial-distribute' },
        ],
      };
    },
  },
  {
    id: 'bbs-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, x, a, b, c, e } = drawBrackets(r, d);
      if (a < 0 || c < 0 || b < 0 || e < 0 || x < 0) throw new Error('retry: a hold cannot carry a negative mass');
      const eqn = `${paren(a, lin(1, v, b))} = ${paren(c, lin(1, v, e))}`;
      return {
        stem: `${T('l2.ctx.twoHolds')} ${T('l2.ask.holdMass', { v })}`,
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(a, v, a * b)} = ${lin(c, v, c * e)}`, why: T('l2.why.openBothBrackets') },
          { latex: `${lin(a - c, v, a * b)} = ${c * e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
          { latex: `${co(a - c, v)} = ${c * e - a * b}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
        ],
        distractors: [
          { v: String(safeDiv(e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(c * e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(a * b - c * e, a - c)), m: 'collect-wrong-side' },
          { v: String(safeDiv(c * e - a * b, a + c)), m: 'collect-wrong-side' },
          { v: String(c * e - a * b), m: 'one-side-only' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// fraction-solve —  (x + b)/k = c   and   x/k + b = c
// ---------------------------------------------------------------------------
const fractionSolve = [
  {
    id: 'fs-bar', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 2 + d);
      const c = d >= 3 ? nz(r, -(3 + d), 3 + d) : int(r, 2, 3 + d);
      const b = Bkonst(r, d);
      const x = c * k - b;
      if (x === 0) throw new Error('retry: a zero answer hides the last step');
      if (!distinct(k, b, c, x)) throw new Error('retry: repeated number');
      const eqn = `\\frac{${lin(1, v, b)}}{${k}} = ${c}`;
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(1, v, b)} = ${c * k}`, why: T('l2.why.multiplyBothByBottom', { k }) },
          { latex: `${v} = ${x}`, why: T('why.unwrapConstantFirst') },
        ],
        distractors: [
          { v: String(c * k + b), m: 'sign-slip' },
          { v: safeFrac(c, k, b), m: 'divide-not-multiply' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(c * k), m: 'partial-rule' },
          { v: String((c - b) * k), m: 'wrong-unwrap-order' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'fs-split', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 2 + d);
      const b = Bkonst(r, d);
      const q = d >= 3 ? nz(r, -(3 + d), 3 + d) : int(r, 2, 3 + d);
      const x = q * k;
      const c = q + b;
      if (x === 0 || c === 0) throw new Error('retry: a zero answer hides the last step');
      if (!distinct(k, b, c, q)) throw new Error('retry: repeated number');
      const eqn = `\\frac{${v}}{${k}} ${sg(b)} = ${c}`;
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `\\frac{${v}}{${k}} = ${q}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('l2.why.multiplyBothByBottom', { k }) },
        ],
        distractors: [
          { v: String(c * k - b), m: 'wrong-unwrap-order' },
          { v: String(c * k), m: 'wrong-unwrap-order' },
          { v: safeFrac(c - b, k, 0), m: 'divide-not-multiply' },
          { v: String(q), m: 'partial-rule' },
          { v: String(x + b), m: 'partial-rule' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(x + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'fs-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 2 + d);
      const c = int(r, 2, 4 + d);
      const b = int(r, 2, 4 + d);
      const x = c * k - b;
      if (x <= 0) throw new Error('retry: a delivery cannot be negative');
      if (!distinct(k, b, c, x)) throw new Error('retry: repeated number');
      const eqn = `\\frac{${lin(1, v, b)}}{${k}} = ${c}`;
      return {
        stem: `${T('l2.ctx.shareOut')} ${T('l2.ask.oneLoad', { v })}`,
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(1, v, b)} = ${c * k}`, why: T('l2.why.multiplyBothByBottom', { k }) },
          { latex: `${v} = ${x}`, why: T('why.unwrapConstantFirst') },
        ],
        distractors: [
          { v: String(c * k + b), m: 'sign-slip' },
          { v: safeFrac(c, k, b), m: 'divide-not-multiply' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(c * k), m: 'partial-rule' },
          { v: String((c - b) * k), m: 'wrong-unwrap-order' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// rule-from-table — the table never states its rule
// ---------------------------------------------------------------------------
/** Four rows of one linear rule, with even steps and no rule written down. */
function drawTable(r, d) {
  // The ladder here is magnitude and sign, and it has to be a real rung: the
  // rate, the constant the table starts from and the step between rows all
  // widen with the band, and negatives enter at band 3. `validate-courses`
  // measures the result and fails the build if band 5 does not ask more than
  // band 4, so these numbers are checked rather than asserted.
  const rate = nzc(r, 2, 1 + 2 * d) * (d >= 3 && r() < 0.4 ? -1 : 1);
  const base = d >= 3 ? nz(r, -(4 + 4 * d), 4 + 4 * d) : int(r, 1, 4 + 2 * d);
  const step = int(r, 1, Math.max(1, d - 1));
  const start = d >= 3 ? int(r, -3 - d, 3 + d) : int(r, 1, 4);
  const rows = [0, 1, 2, 3].map((i) => {
    const x = start + i * step;
    return [x, rate * x + base];
  });
  const missing = int(r, 1, 3);
  if (!distinct(rate, base, step)) throw new Error('retry: repeated number');
  return { rows, missing, rate, base, step };
}

const ruleFromTable = [
  {
    id: 'rft-output', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const { rows, missing, rate, base } = drawTable(r, d);
      const ans = rows[missing][1];
      const prev = rows[missing - 1];
      return {
        stem: `${T('l2.ctx.gauge')} ${T('ask.missingReading')}`,
        latex: arrayTex('x', 'y', rows, missing),
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'table', rows, missing },
        steps: [
          { latex: `${rows[0][1]} \\rightarrow ${rows[1][1]}`, why: T('l2.why.stepTellsRate', { n: rate }) },
          { latex: `${prev[1]} ${sg(rate * (rows[missing][0] - prev[0]))} = ${ans}`, why: T('l2.why.applyRateOnce') },
        ],
        distractors: [
          { v: String(prev[1]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
          { v: String(rows[missing][0] + rate), m: 'add-not-multiply' },
          { v: String(rate * rows[missing][0]), m: 'partial-rule' },
          { v: String(ans + rate), m: 'arith-slip' },
          { v: String(ans - rate), m: 'arith-slip' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(base), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'rft-input', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const { rows, missing, rate } = drawTable(r, d);
      const ans = rows[missing][0];
      const shown = rows.map((row, i) => (i === missing ? [null, row[1]] : row));
      const prev = rows[missing - 1];
      return {
        stem: `${T('l2.ctx.gauge')} ${T('ask.missingInput')}`,
        latex: arrayTexInput('x', 'y', shown),
        type: 'numeric',
        answer: String(ans),
        // The verifier reads the gap out of the printed table either way round.
        check: { kind: 'table', rows: rows.map((row, i) => (i === missing ? ['?', row[1]] : row)), missing },
        steps: [
          { latex: `${rows[0][1]} \\rightarrow ${rows[1][1]}`, why: T('l2.why.stepTellsRate', { n: rate }) },
          { latex: `${prev[0]} + ${rows[missing][0] - prev[0]} = ${ans}`, why: T('l2.why.stepBackToInput') },
        ],
        distractors: [
          { v: String(prev[0]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][0]), m: 'off-by-one-row' },
          { v: String(rows[missing][1]), m: 'partial-rule' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(ans + rate), m: 'add-not-multiply' },
          { v: String(-ans), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'rft-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const { rows, missing, rate, base } = drawTable(r, d);
      if (rate < 0 || base < 0) throw new Error('retry: a stockpile does not run backwards here');
      const ans = rows[missing][1];
      const prev = rows[missing - 1];
      return {
        stem: `${T('l2.ctx.stockpile')} ${T('l2.ask.missingWatch')}`,
        latex: arrayTex('x', 'y', rows, missing),
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'table', rows, missing },
        steps: [
          { latex: `${rows[0][1]} \\rightarrow ${rows[1][1]}`, why: T('l2.why.stepTellsRate', { n: rate }) },
          { latex: `${prev[1]} ${sg(rate * (rows[missing][0] - prev[0]))} = ${ans}`, why: T('l2.why.applyRateOnce') },
        ],
        distractors: [
          { v: String(prev[1]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
          { v: String(rows[missing][0] + rate), m: 'add-not-multiply' },
          { v: String(rate * rows[missing][0]), m: 'partial-rule' },
          { v: String(ans + rate), m: 'arith-slip' },
          { v: String(ans - rate), m: 'arith-slip' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(base), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// small local helpers
// ---------------------------------------------------------------------------
/** A distractor that would divide by zero is not a distractor. */
function safeDiv(n, dd) { return dd === 0 ? n + 1 : Math.round(n / dd); }
/** "(c - b)/k" as an exact string, for a divide-instead-of-multiply slip. */
function safeFrac(c, k, b) {
  const n = c - b;
  if (k === 0) return String(n);
  if (n % k === 0) return String(n / k);
  const g = gcd(n, k);
  return `${n / g}/${k / g}`;
}
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
/** The table printer for a gap on the input side. */
function arrayTexInput(vname, ruleLabel, rowsShown) {
  const body = rowsShown
    .map((row) => `${row[0] === null ? '?' : row[0]} & ${row[1]}`)
    .join(' \\\\ ');
  return `\\begin{array}{c|c} ${vname} & ${ruleLabel} \\\\ \\hline ${body} \\end{array}`;
}

// ---------------------------------------------------------------------------
// the pack
// ---------------------------------------------------------------------------
export default {
  id: 'algebra1-l2',
  skills: {
    'bracket-both-sides': bracketBothSides,
    'fraction-solve': fractionSolve,
    'rule-from-table': ruleFromTable,
  },
  strings: { en, es, pl },
};
