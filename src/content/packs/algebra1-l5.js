/**
 * Algebra I · Level 5 — the generator pack.
 *
 * Level 2 taught a line to be drawn and a pair of lines to be solved. Level 3
 * gave a rule a name and a count a law. Level 5 is where the linear strand is
 * finished, where a rule stops being handed over and gets FITTED to real
 * readings, and where a list of numbers is given a rule of its own. Thirteen
 * skills:
 *
 *   rational-exponent     a count that is a fraction: which root, then what power
 *   relation-is-function  one input, one output — the whole definition
 *   sequence-terms        a list is a rule whose inputs are the positions
 *   sequence-nth-term     one formula for the value at any position
 *   point-slope-form      one reading and a rate pin a line down, three ways
 *   parallel-perpendicular  the same rate, or a rate turned over and negated
 *   inequality-two-var    a lean in two letters names a region, not a line
 *   write-system          two statements about one pair of unknowns
 *   system-graphically    where two rules agree, read off their own readings
 *   scatter-regression    the one line closest to every reading at once
 *   residual-and-fit      the gap between a reading and the line, and its sign
 *   association-strength  direction, and a share read out of a two-way table
 *   exponential-model     a factor at every step, and the percent it hides
 *
 * IT IS STILL DATA. This file imports one toolkit from `src/learn/generators.js`
 * and three prose bundles from `content/lang/`. It touches no engine file: not
 * the mastery model, not the scheduler, not the session planner, not the
 * report, not the rift surface, not the world, not `src/main.js`.
 *
 * EVERY ITEM RE-DERIVES, AND NONE OF THEM RE-DERIVES THROUGH A GENERATOR.
 * The check kinds this unit leans on are the ones the solver lane built —
 * `rationalExponent`, `radical`, `relationPairs`, `sequence`, `relatedLine`,
 * `halfPlane`, `systemWrite`, `regression`, `twoWayTable`, `exponentialFit` —
 * and every one of them reads the notation off the screen and works the answer
 * out again in exact rational arithmetic. `regression` solves the normal
 * equations by Cramer's rule over the printed readings; `relationPairs` runs a
 * complete decision procedure over the printed pairs rather than a sample;
 * `rationalExponent` takes NO root at all, and raises the learner's own value
 * to the q-th power instead.
 *
 * WHAT IS NOT SHIPPED, AND WHY. Three things a full Level 5 would like to ask
 * are absent, because the surface cannot carry the answer honestly:
 *
 *   · A VERDICT. `relationPairs`, `correlation` and `features` can all prove a
 *     yes/no answer, and `finalize` localises exactly two verdict tokens —
 *     `ALL` and `NONE`. A pack cannot add a third without editing
 *     `src/learn/generators.js`, and an unlocalised `YES` on a Polish screen is
 *     a broken promise, not a shortcut. So "is this a function?" is asked as
 *     "WHICH INPUT breaks it?", which has a numeric answer, re-derives through
 *     the same complete procedure, and cannot be answered by counting.
 *   · A CORRELATION COEFFICIENT. `correlation` is exact and honest — it works
 *     with r squared and the sign of r, never with r itself — but every one of
 *     its three asks needs either a verdict or a printed decimal, and the
 *     keypad has no decimal point. TEKS A.4(A) and CCSS S-ID.C.8 are therefore
 *     NOT CLAIMED, in writing, in the graph.
 *   · A DRAWING. This unit prints tables and rules. It draws no scatter plot,
 *     no shaded region and no pair of traces, because a new figure kind is a
 *     change to `src/ui/rift.js` and to `tools/check-figures.mjs`. Every
 *     alignment row whose expectation names a graph says so in its caveat.
 *
 * PROSE LIVES UNDER content/lang. Not in this file, and nowhere in src/.
 */
import { kit } from '../../learn/generators.js';
import en from '../../../content/lang/packs/algebra1-l5.en.js';
import es from '../../../content/lang/packs/algebra1-l5.es.js';
import pl from '../../../content/lang/packs/algebra1-l5.pl.js';

const { pick, int, nz, nzc, gcd, distinct, ratio, pointTex, scene } = kit;

// ---------------------------------------------------------------------------
// Notation.
//
// One spelling for each shape, everywhere. An option set never offers the same
// statement twice in two costumes, and a checker never has to decide whether
// two spellings of the key are one answer.
// ---------------------------------------------------------------------------

/** An exact rational as a plain answer string: "3", "-5/2". Never a decimal. */
function frac(n, d = 1) {
  if (d === 0) throw new Error('retry: a value with no denominator');
  let a = n; let b = d;
  if (b < 0) { a = -a; b = -b; }
  const g = gcd(a, b);
  return b / g === 1 ? String(a / g) : `${a / g}/${b / g}`;
}

/**
 * TWO READINGS THAT ARE ONE NUMBER ARE ONE READING AND A TRAP.
 *
 * `2\sqrt{4}` is the number four, and the option beside it that reads `4` is
 * the same option printed twice with one of them marked wrong. The spelling
 * cannot see that — `finalize` drops a distractor that repeats another one
 * LETTER for letter, and these two do not — so the exact value is worked out
 * here instead: a coefficient and a square-free radicand, or a plain rational.
 * A draw that puts one number on two caps is refused rather than repaired.
 */
function surdKey(src) {
  const t = String(src).trim();
  const m = /^(-?\d*)\\sqrt\{(\d+)\}$/.exec(t);
  if (!m) return `q:${t}`;
  let c = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  let r = Number(m[2]);
  for (let f = 2; f * f <= r; f++) while (r % (f * f) === 0) { r /= f * f; c *= f; }
  return r === 1 ? `q:${c}` : `s:${c}|${r}`;
}

/**
 * Every value this card offers, proved distinct as a NUMBER.
 *
 * Two readings spelled the SAME way are collapsed by `finalize` before a cadet
 * ever sees them, so they are not a fault and are dropped here first. What is
 * left has to differ in value as well as in spelling.
 */
/**
 * `c\sqrt{n}`, WRITTEN THE WAY THIS SKILL DEMANDS ITS ANSWERS.
 *
 * `re-surd` and `re-radical` are the two forms whose whole subject is simplest
 * form, and they offered options that were not in it — `3\sqrt{9}`, which is
 * secretly the whole number nine, and `4\sqrt{8}`, which is `8\sqrt{2}`. A
 * cadet who simplifies every option finds one that turns into a whole number
 * and picks the odd one out; that is a shape, not mathematics. A decoy is the
 * VALUE a wrong reading arrives at, so it is printed the way the skill
 * demands and differs from the key only in which number the cadet got.
 *
 * `null` means nothing is left under the bar. A whole number standing among
 * radicals is the same shape cue the other way round, so it is dropped.
 */
function simplestSurd(c, n) {
  if (!Number.isInteger(c) || !Number.isInteger(n) || n < 1 || c === 0) return null;
  let m = 1; let k = n;
  for (let f = 2; f * f <= k; f++) while (k % (f * f) === 0) { m *= f; k /= f * f; }
  if (m * m * k !== n) return null;
  if (k === 1) return null;
  const front = c * m;
  if (front === 1) return `\\sqrt{${k}}`;
  if (front === -1) return `-\\sqrt{${k}}`;
  return `${front}\\sqrt{${k}}`;
}

function allDifferent(values) {
  const once = [...new Set(values.map((v) => String(v)))];
  const seen = new Set();
  for (const v of once) {
    const k = surdKey(v);
    if (seen.has(k)) throw new Error('retry: two of these readings are the same number');
    seen.add(k);
  }
  return values;
}

/** `+ 5` / `- 5`, as a continuation. */
const sgn = (n) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);

/** `3x`, `-x`, `x`, `0` — a coefficient in front of a letter. */
function coefOf(c, v) {
  if (c === 0) return '0';
  if (c === 1) return v;
  if (c === -1) return `-${v}`;
  return `${c}${v}`;
}

/** The one spelling of a rate in front of a letter, fraction or not. */
function rateTex(n, d, v) {
  if (d === 0) throw new Error('retry: a rate with no run');
  let a = n; let b = d;
  if (b < 0) { a = -a; b = -b; }
  const g = gcd(a, b);
  a /= g; b /= g;
  if (b === 1) return coefOf(a, v);
  // The minus sign belongs in front of the fraction, not inside its numerator:
  // a cadet reads `-\frac{1}{2}x`, and `\frac{-1}{2}x` is the same number
  // printed badly. Nothing downstream compares this by spelling — every checker
  // that reads a rate parses it — so the typography is free to be right.
  return `${a < 0 ? '-' : ''}\\frac{${Math.abs(a)}}{${b}}${v}`;
}

/**
 * `y = 2x + 3` — the one spelling of a line in slope-intercept form, and the
 * one the checkers print when they have to name a line themselves.
 */
function lineTex(m, b, vy = 'y', vx = 'x') {
  if (m === 0) return `${vy} = ${b}`;
  if (b === 0) return `${vy} = ${coefOf(m, vx)}`;
  return `${vy} = ${coefOf(m, vx)} ${sgn(b)}`;
}
/** The same, with a fractional rate written over a bottom number. */
function lineTexQ(mn, md, b, vy = 'y', vx = 'x') {
  const head = rateTex(mn, md, vx);
  if (b === 0) return `${vy} = ${head}`;
  return `${vy} = ${head} ${sgn(b)}`;
}
/** `y - 5 = 3\left(x - 2\right)` — point-slope, one spelling. */
function pointSlopeTex(m, x0, y0, vy = 'y', vx = 'x') {
  const left = y0 === 0 ? vy : `${vy} ${sgn(-y0)}`;
  const inner = x0 === 0 ? vx : `${vx} ${sgn(-x0)}`;
  const head = m === 1 ? '' : m === -1 ? '-' : String(m);
  return `${left} = ${head}\\left(${inner}\\right)`;
}
/** `3x + 4y = 12` — standard form, one spelling, no fraction left in it. */
function standardTex(a, b, c, vy = 'y', vx = 'x') {
  return `${coefOf(a, vx)} ${b < 0 ? '-' : '+'} ${coefOf(Math.abs(b), vy)} = ${c}`;
}

/** A two-column table of readings, header row included. */
const tbl = (hx, hy, rows) =>
  `\\begin{array}{c|c} ${hx} & ${hy} \\\\ \\hline ${rows.map(([a, b]) => `${a} & ${b}`).join(' \\\\ ')} \\end{array}`;

/**
 * WHETHER A READING BELONGS TO THE REGION, SAID OUT LOUD.
 *
 * `R` is named by the stem of every form that prints this, so the cell is a
 * whole sentence about that row rather than a glyph the card never defines.
 * See the inequality-two-var header for what this replaced and why.
 */
const IN_OUT = { in: '\\in R', out: '\\notin R' };

/** The same, with a third column that carries a statement rather than a number. */
const tblMark = (hx, hy, rows) =>
  `\\begin{array}{c|c|c} ${hx} & ${hy} & {} \\\\ \\hline ${rows.map(([a, b, m]) => `${a} & ${b} & ${m || '{}'}`).join(' \\\\ ')} \\end{array}`;

/**
 * A MARK ON THE CARD, NOT A WORD ABOUT ONE.
 *
 * "the marked column" over a card that marks nothing is not one question, it
 * is four questions with one of them scored, and the learner cannot see which.
 * 1,170 association-strength items and 1,178 parallel-perpendicular items
 * shipped exactly that. A box drawn round one name, one count or one reading
 * is notation rather than prose, so the same mark serves all three languages
 * and the sentence above it is true in all three.
 */
const boxed = (x) => `\\boxed{${x}}`;

/** The one reading a card singles out, so a stem may point at it. */
const markedPoint = (x, y) => boxed(pointTex(x, y));

/**
 * A whole two-way frequency table, body plus its own printed totals.
 *
 * `mark` is what the card singles out: `{ row, col }` boxes one row NAME and
 * one column NAME. The names, never the count. `twoWayTable` re-derives the
 * whole table from its printed cells and reads a cell by evaluating it, and
 * `\boxed{9}` is not a number to that reader — boxing a count made every band
 * of the joint form fail to generate at all. A boxed name is dropped by the
 * same reader exactly as a plain name is, so the card can carry the mark and
 * the checker can still read the table.
 */
function twoWayTex(hCols, hRows, grid, mark = null) {
  const spec = `c|${'c'.repeat(hCols.length)}|c`;
  const head = `{} & ${hCols.map((h, j) => (mark && mark.col === j ? boxed(h) : h)).join(' & ')} & {}`;
  const body = grid.map((row, i) => {
    const name = hRows[i] ? (mark && mark.row === i ? boxed(hRows[i]) : hRows[i]) : '{}';
    return `${name} & ${row.join(' & ')}`;
  }).join(' \\\\ ');
  return `\\begin{array}{${spec}} ${head} \\\\ \\hline ${body} \\end{array}`;
}

/** Two displays, side by side. */
const beside = (a, b) => `${a} \\qquad ${b}`;
/** Two statements, one above the other, so neither runs into the other. */
const stacked = (a, b) => `\\begin{array}{l} ${a} \\\\ ${b} \\end{array}`;
/**
 * A prompt that ends in an empty socket.
 *
 * The rig reads `\square` as "this item is a choice between readings" and
 * builds the choice surface instead of the keypad. That is the right surface
 * whenever the answer is an equation, a pair of equations, a statement with a
 * lean, or a radical: the keypad has keys for digits, one letter, a plus, a
 * square and a fraction bar, and none of those can type `y = -\frac{1}{2}x + 3`.
 */
const asks = (mathTex) => `${mathTex} \\;\\Rightarrow\\; \\square`;

// ---------------------------------------------------------------------------
// Difficulty.
//
// The gate measures the ladder rather than believing it, so every rung below
// moves something `demandOf` can actually see: the size of the largest number
// on screen, whether a sign is in play, and whether the answer is a fraction.
// ---------------------------------------------------------------------------
const rung = (d) => Math.max(1, Math.min(5, d | 0)) - 1;
const from = (r, table, d) => { const [lo, hi] = table[rung(d)]; return int(r, lo, hi); };
const fromNz = (r, table, d) => { const [lo, hi] = table[rung(d)]; return nz(r, lo, hi); };

/** Whole-number rates for a line, by band. Negative from band 3. */
const RATE = [[1, 3], [1, 5], [-6, 6], [-8, 8], [-13, 13]];
/** The number a line meets the upright axis at. */
const INTERCEPT = [[1, 6], [2, 10], [-12, 12], [-16, 16], [-27, 27]];
/** Where a marked reading sits along the input axis. */
const ATX = [[1, 4], [1, 6], [-6, 6], [-8, 8], [-13, 13]];
/** The readings a data table is built from. */
const DATUM = [[1, 8], [2, 12], [3, 18], [4, 26], [5, 34]];
/** The step a list adds at every position. */
const STEP = [[2, 5], [2, 8], [-9, 9], [-13, 13], [-17, 17]];
/** The value a list starts at. */
const START = [[1, 7], [2, 11], [-13, 13], [-18, 18], [-24, 24]];
/** Where two rules cross, by band. Drawn first, so the band really controls it. */
const CROSSX = [[1, 2], [1, 3], [2, 5], [3, 7], [4, 9]];
const CROSSY = [[1, 6], [2, 10], [-13, 13], [-17, 17], [-22, 22]];
/** Counts in a two-way frequency table. */
const CELL = [[2, 6], [3, 9], [4, 13], [5, 18], [8, 32]];

/** A situation deck, drawn through the engine's ledger. */
const S = (...keys) => keys.map((ctx) => ({ ctx }));

/**
 * A STORY MAY NOT COUNT SOMETHING THAT CANNOT BE COUNTED.
 *
 * The bands push numbers below zero from band 3 up, which is right for a bare
 * table and wrong the moment a sentence is wrapped round it: a crop log with a
 * yield of minus eight, a crew that stacks minus twelve crates, a supplier
 * whose base price is below zero. Every situation-dressed form therefore draws
 * against this guard, and redraws rather than printing a story it does not
 * mean. The bare forms keep the negatives, so the ladder keeps them too.
 */
function allAbove(zero, ...values) {
  for (const v of values.flat(2)) {
    if (!Number.isFinite(v)) throw new Error('retry: a reading that is not a number');
    if (v <= zero) throw new Error('retry: this story cannot count a value at or below zero');
  }
  return true;
}

// ---------------------------------------------------------------------------
// Situations.
//
// A pack cannot reach the engine's deck of framings, so it keeps its own and
// draws on `sr`, the situation stream, exactly as the deck does. Every entry is
// ONE sentence, and no entry states a number the mathematics does not use.
// ---------------------------------------------------------------------------
const FRACTIONAL = S('l5.ctx.kilnFire', 'l5.ctx.tuner', 'l5.ctx.mixer', 'l5.ctx.gauge');
const SQUARES = S('l5.ctx.hullSquare', 'l5.ctx.tankSquare', 'l5.ctx.bayRoot');
const LOGS = S('l5.ctx.dockLog', 'l5.ctx.sensorLog', 'l5.ctx.cropLog', 'l5.ctx.relayLog', 'l5.ctx.pilotSheet');
// A list that ADDS and a list that TAKES AWAY are two different stories, and a
// crew that stacks the same number of crates at every watch cannot have a step
// below zero. The deck is chosen by the sign of the step, not before it.
const ADDING_UP = S('l5.ctx.driftRow', 'l5.ctx.stackRow', 'l5.ctx.tetherRow');
const ADDING_DOWN = S('l5.ctx.driftRow', 'l5.ctx.iceRow', 'l5.ctx.fuelRow', 'l5.ctx.stockRow');
const TIMESING = S('l5.ctx.sporeRow', 'l5.ctx.dimmerRow');
const STEADY = S('l5.ctx.rampRule', 'l5.ctx.beltRule', 'l5.ctx.pumpRule', 'l5.ctx.craneRule');
const ALONGSIDE = S('l5.ctx.girderRun', 'l5.ctx.railRun', 'l5.ctx.towLine');
const ATRIGHT = S('l5.ctx.braceRun', 'l5.ctx.strutRun');
const REGIONS = S('l5.ctx.safeLoad', 'l5.ctx.coldBay', 'l5.ctx.powerBudget', 'l5.ctx.airMix');
const TWOLOGS = S('l5.ctx.twoHoists', 'l5.ctx.twoTanks', 'l5.ctx.twoRovers', 'l5.ctx.twoKilns');
const MEETINGS = S('l5.ctx.priceMeet', 'l5.ctx.rangeMeet', 'l5.ctx.fillMeet', 'l5.ctx.climbMeet');
const SURVEYS = S('l5.ctx.oreAssay', 'l5.ctx.frostRun', 'l5.ctx.dustRun', 'l5.ctx.saltRun', 'l5.ctx.windRun', 'l5.ctx.yieldRun', 'l5.ctx.wearRun');
const AUDITS = S('l5.ctx.crewSurvey', 'l5.ctx.partsAudit', 'l5.ctx.cargoAudit', 'l5.ctx.faultAudit');
const GROWS = S('l5.ctx.blightSpread', 'l5.ctx.fundGrow');
const FADES = S('l5.ctx.coolantFade', 'l5.ctx.isotopeFade');
const RACES = S('l5.ctx.raceStep', 'l5.ctx.raceGrow');
const D_ROOT = S('l5.ctx.disputeRoot', 'l5.ctx.disputeOrder');
const D_FUNC = S('l5.ctx.disputeFunction');
const D_LIST = S('l5.ctx.disputeStep', 'l5.ctx.disputeFormula');
const D_LINE = S('l5.ctx.disputeRate');
const D_MEET = S('l5.ctx.disputeCrossing');
const D_FIT = S('l5.ctx.disputeFit', 'l5.ctx.disputeGap');
// A dispute has to be about the thing the card actually asks. The share forms
// were dressed from D_FIT — "Two cadets disagree about the closest line" — over
// a two-way table of counts with no line and no reading gap anywhere in it, on
// 300 of 300 seeds and in all three languages. A deck of its own, about shares.
const D_SHARE = S('l5.ctx.disputeShare', 'l5.ctx.disputeWhole');

// ===========================================================================
// rational-exponent  —  a count that is a fraction
//
// The whole node is two sentences. The BOTTOM of the count says which root to
// take. The TOP says what power to raise the result to. Every wrong answer
// worth naming comes from doing something else with the two numbers: reading
// them as a multiplication, swapping them over, or ignoring the bottom.
//
// THE CHECKER TAKES NO ROOT. `rationalExponent` raises the learner's own value
// to the q-th power and requires it to equal the base to the p-th, both in
// exact arithmetic. A generator that is wrong about its own root cannot make
// that agree with it.
// ===========================================================================

/** Perfect powers, by band: the root, the bottom count, and the top count. */
const PERFECT = [
  { a: [2, 4], q: [2], p: [1] },
  { a: [5, 7], q: [2], p: [1] },
  { a: [3, 5], q: [3], p: [1] },
  { a: [9, 12], q: [2], p: [1] },
  { a: [15, 25], q: [2], p: [1] },
];
/** The same, for the forms that raise the root to a power above one. */
const PERFECT_P = [
  { a: [2, 3], q: [2], p: [3] },
  { a: [2, 3], q: [2], p: [3, 5] },
  { a: [2, 4], q: [3], p: [2] },
  { a: [3, 5], q: [2, 3], p: [2, 3] },
  { a: [5, 9], q: [2], p: [3] },
];

/** Draw a base that really is a perfect q-th power, and its exact value. */
function drawPerfect(r, d, table) {
  const spec = table[rung(d)];
  const q = pick(r, spec.q);
  const p = pick(r, spec.p);
  if (gcd(p, q) !== 1) throw new Error('retry: the count is not in lowest terms');
  const a = int(r, spec.a[0], spec.a[1]);
  const base = a ** q;
  const out = a ** p;
  if (base > 1e6 || out > 1e6) throw new Error('retry: past comfortable arithmetic');
  return { a, q, p, base, out };
}

/** `\frac{2}{3}` or `-\frac{2}{3}` — the one spelling of a fractional count. */
const countTex = (p, q, neg) => `${neg ? '-' : ''}\\frac{${p}}{${q}}`;
/** The prompt: a base with a fractional count above it. */
const powTex = (base, p, q, neg) => `${base}^{${countTex(p, q, neg)}}`;

/** Every wrong reading of a fractional count that this unit can explain. */
function countWrongs({ a, q, p, base, out }) {
  return [
    { v: frac(base * p, q), m: p === 1 ? 'root-index-ignored' : 'exponent-becomes-a-factor' },
    { v: frac(base * q, p), m: 'top-and-bottom-swapped' },
    { v: String(a), m: 'base-rooted-and-count-kept' },
    { v: String(base), m: 'root-index-ignored' },
    { v: String(out + 1), m: 'arith-slip' },
    { v: String(out - 1), m: 'arith-slip' },
    { v: String(-out), m: 'negative-count-makes-a-negative' },
    { v: frac(1, out), m: 'negative-count-makes-a-negative' },
  ];
}

const rationalExponent = [
  {
    id: 're-root', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawPerfect(r, d, PERFECT);
      const math = powTex(g.base, g.p, g.q, false);
      return {
        stem: T('l5.ask.rootThenPower'),
        latex: math,
        type: 'numeric',
        answer: String(g.out),
        check: { kind: 'rationalExponent', math },
        steps: [
          { latex: `${math} = ${g.a}^{${g.p}}`, why: T('l5.why.bottomIsTheRoot') },
          { latex: `${g.a}^{${g.p}} = ${g.out}`, why: T('l5.why.topIsThePower') },
        ],
        distractors: countWrongs(g),
      };
    },
  },
  {
    id: 're-power', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawPerfect(r, d, PERFECT_P);
      if (g.p === 1) throw new Error('retry: this form raises the root to a power');
      const math = powTex(g.base, g.p, g.q, false);
      return {
        stem: T('l5.ask.exactValue'),
        latex: math,
        type: 'numeric',
        answer: String(g.out),
        check: { kind: 'rationalExponent', math },
        steps: [
          { latex: `${math} = ${g.a}^{${g.p}}`, why: T('l5.why.rootFirstThenPower') },
          { latex: `${g.a}^{${g.p}} = ${g.out}`, why: T('l5.why.workItOut') },
        ],
        distractors: countWrongs(g),
      };
    },
  },
  {
    id: 're-negative', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const g = drawPerfect(r, d, d >= 4 ? PERFECT_P : PERFECT);
      const math = powTex(g.base, g.p, g.q, true);
      if (g.out === 1) throw new Error('retry: a value of one hides the turn');
      return {
        stem: T('l5.ask.exactValue'),
        latex: math,
        type: 'numeric',
        answer: frac(1, g.out),
        check: { kind: 'rationalExponent', math },
        steps: [
          { latex: `${math} = \\frac{1}{${powTex(g.base, g.p, g.q, false)}}`, why: T('l5.why.negativeCountFlips') },
          { latex: `\\frac{1}{${g.a}^{${g.p}}} = \\frac{1}{${g.out}}`, why: T('l5.why.rootFirstThenPower') },
        ],
        distractors: [
          { v: String(-g.out), m: 'negative-count-makes-a-negative' },
          { v: String(g.out), m: 'negative-count-makes-a-negative' },
          { v: frac(g.base * g.p, g.q), m: 'exponent-becomes-a-factor' },
          { v: frac(1, g.a), m: 'top-and-bottom-swapped' },
          { v: frac(1, g.out + 1), m: 'arith-slip' },
          { v: frac(1, g.base), m: 'root-index-ignored' },
          { v: String(-g.a), m: 'base-rooted-and-count-kept' },
        ],
      };
    },
  },
  {
    id: 're-surd', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const m0 = from(r, [[2, 3], [2, 4], [2, 5], [3, 7], [4, 9]], d);
      const k = pick(r, [2, 3, 5, 6, 7, 10, 11, 13]);
      const n = m0 * m0 * k;
      if (n > 4000) throw new Error('retry: past a radicand a cadet can read');
      const math = powTex(n, 1, 2, false);
      const ans = `${m0}\\sqrt{${k}}`;
      // EVERY OPTION IS IN SIMPLEST FORM. See `simplestSurd`: this is the
      // skill whose subject is simplest form, and `3\sqrt{9}` — a whole
      // number in a radical coat — was on the card.
      const wrongs = [
        { v: `${m0 * m0}\\sqrt{${k}}`, m: 'base-rooted-and-count-kept' },
        { v: simplestSurd(m0, m0 * k), m: 'arith-slip' },
        { v: frac(n, 2), m: 'root-index-ignored' },
        // `\sqrt{m0^2 k}` USED TO SIT HERE, tagged 'partial-rule'. It IS the
        // key — the same number, one step earlier — so the card offered its
        // own answer as an error. The rig drops an option it can prove equal
        // to the answer, so it was never mounted; a bank that ships the answer
        // as a distractor is still one reader away from marking a right cadet
        // wrong. The real partial rule is stopping once the square is out.
        { v: String(m0), m: 'partial-rule' },
        { v: `${m0 + k}\\sqrt{${k}}`, m: 'exponent-becomes-a-factor' },
        { v: simplestSurd(k, m0), m: 'top-and-bottom-swapped' },
        { v: simplestSurd(m0, k + 1), m: 'arith-slip' },
        { v: `${m0 + 1}\\sqrt{${k}}`, m: 'arith-slip' },
        { v: `${m0 * k}\\sqrt{${k}}`, m: 'exponent-becomes-a-factor' },
      ].filter((o) => o.v != null);
      allDifferent([ans, ...wrongs.map((w) => w.v)]);
      return {
        stem: T('l5.ask.simplestForm'),
        latex: asks(math),
        type: 'expression',
        answer: ans,
        check: { kind: 'rationalExponent', math },
        steps: [
          { latex: `${math} = \\sqrt{${n}}`, why: T('l5.why.bottomIsTheRoot') },
          { latex: `\\sqrt{${n}} = \\sqrt{${m0 * m0}} \\cdot \\sqrt{${k}}`, why: T('l5.why.squareFactorComesOut') },
          { latex: `\\sqrt{${m0 * m0}} \\cdot \\sqrt{${k}} = ${ans}`, why: T('l5.why.rootOfAProduct') },
        ],
        distractors: wrongs,
      };
    },
  },
  {
    id: 're-radical', rep: 'symbolic', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const m0 = from(r, [[2, 3], [2, 4], [3, 5], [4, 7], [5, 9]], d);
      const k = pick(r, [2, 3, 5, 6, 7, 10]);
      const n = m0 * m0 * k;
      if (n > 3000) throw new Error('retry: past a radicand a cadet can read');
      const math = `\\sqrt{${n}}`;
      const ans = `${m0}\\sqrt{${k}}`;
      // EVERY OPTION IS IN SIMPLEST FORM. See `simplestSurd`.
      const wrongs = [
        { v: `${m0 * m0}\\sqrt{${k}}`, m: 'base-rooted-and-count-kept' },
        { v: simplestSurd(m0, m0 * k), m: 'arith-slip' },
        { v: simplestSurd(k, m0), m: 'top-and-bottom-swapped' },
        { v: frac(n, 2), m: 'root-index-ignored' },
        { v: `${m0 + 1}\\sqrt{${k}}`, m: 'arith-slip' },
        { v: simplestSurd(m0, k + 1), m: 'arith-slip' },
        // `m0 k \sqrt{m0}` used to stand here. With a square coefficient it
        // collapses to a whole number and lands on `n/2`, the option next to
        // it. Multiplying the wrong one of the two numbers is the same error
        // and does not collapse.
        { v: `${m0 * k}\\sqrt{${k}}`, m: 'exponent-becomes-a-factor' },
        { v: `${Math.max(1, m0 - 1)}\\sqrt{${k}}`, m: 'arith-slip' },
      ].filter((o) => o.v != null);
      allDifferent([ans, ...wrongs.map((w) => w.v)]);
      return {
        stem: T('l5.ask.simplestForm'),
        latex: asks(math),
        type: 'expression',
        answer: ans,
        check: { kind: 'radical', math, form: 'simplify' },
        steps: [
          { latex: `\\sqrt{${n}} = \\sqrt{${m0 * m0}} \\cdot \\sqrt{${k}}`, why: T('l5.why.squareFactorComesOut') },
          { latex: `\\sqrt{${m0 * m0}} \\cdot \\sqrt{${k}} = ${ans}`, why: T('l5.why.rootOfAProduct') },
        ],
        distractors: wrongs,
      };
    },
  },
  {
    id: 're-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const g = drawPerfect(r, d, d >= 3 ? PERFECT_P : PERFECT);
      const sc = scene(sr, FRACTIONAL);
      const math = powTex(g.base, g.p, g.q, false);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.exactValue')}`,
        latex: math,
        type: 'numeric',
        answer: String(g.out),
        check: { kind: 'rationalExponent', math },
        steps: [
          { latex: `${math} = ${g.a}^{${g.p}}`, why: T('l5.why.bottomIsTheRoot') },
          { latex: `${g.a}^{${g.p}} = ${g.out}`, why: T('l5.why.topIsThePower') },
        ],
        distractors: countWrongs(g),
      };
    },
  },
  {
    id: 're-side', rep: 'context', dMin: 1, dMax: 4,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SQUARES);
      const a = from(r, [[2, 6], [5, 11], [9, 17], [14, 24], [20, 31]], d);
      const base = a * a;
      const math = powTex(base, 1, 2, false);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.exactValue')}`,
        latex: math,
        type: 'numeric',
        answer: String(a),
        check: { kind: 'rationalExponent', math },
        steps: [
          { latex: `${math} = \\sqrt{${base}}`, why: T('l5.why.bottomIsTheRoot') },
          { latex: `\\sqrt{${base}} = ${a}`, why: T('l5.why.workItOut') },
        ],
        distractors: [
          { v: frac(base, 2), m: 'root-index-ignored' },
          { v: String(a + 1), m: 'arith-slip' },
          { v: String(a - 1), m: 'arith-slip' },
          { v: String(base), m: 'partial-rule' },
          { v: frac(base, 4), m: 'root-index-ignored' },
          { v: String(2 * a), m: 'exponent-becomes-a-factor' },
          { v: frac(1, a), m: 'negative-count-makes-a-negative' },
        ],
      };
    },
  },
  {
    id: 're-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_ROOT);
      const g = drawPerfect(r, d, PERFECT_P);
      if (g.p === 1) throw new Error('retry: a dispute needs a top count above one');
      const math = powTex(g.base, g.p, g.q, false);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.exactValue')}`,
        latex: math,
        type: 'numeric',
        answer: String(g.out),
        check: { kind: 'rationalExponent', math },
        steps: [
          { latex: `${math} = ${g.a}^{${g.p}}`, why: T('l5.why.rootFirstThenPower') },
          { latex: `${g.a}^{${g.p}} = ${g.out}`, why: T('l5.why.workItOut') },
        ],
        distractors: countWrongs(g),
      };
    },
  },
];

// ===========================================================================
// relation-is-function  —  one input, one output
//
// A.12(A) was declared UNCLAIMABLE by Level 3, because nothing in the checker
// read a set of pairs. `relationPairs` now does, and it is a COMPLETE decision
// procedure rather than a sample: it walks the printed pairs, keys them by
// input, and the first input that carries two different outputs is the whole
// answer. There is nothing else to check.
//
// The question is "WHICH input breaks it", not "is this a function", because
// the surface can carry a number and cannot carry a localised verdict. That
// turns out to be the stronger question: every table below ALSO carries two
// inputs that share one output, which is legal, so a learner who is hunting
// for any repeat at all lands on the decoy and says so out loud.
// ===========================================================================

/**
 * A table of pairs with exactly one broken input and one shared output.
 * The two are always different rows, so neither can be found by the other.
 */
function drawRelation(r, d, rows = 5, { positive = false } = {}) {
  const lo = (d >= 3 && !positive) ? -(3 + 2 * d) : 1;
  const hi = positive ? 4 + 4 * d : 3 + 3 * d;
  const nx = rows - 1;                       // how many distinct inputs are printed
  if (nx < 4) throw new Error('retry: too few rows to hold a break and a decoy');
  const draw = (n) => {
    const out = [];
    for (let i = 0; i < 120 && out.length < n; i++) {
      const v = int(r, lo, hi);
      if (!out.includes(v)) out.push(v);
    }
    if (out.length < n) throw new Error('retry: not enough distinct values in this band');
    return out;
  };
  const xs = draw(nx);
  const ys = draw(nx);
  // The input that breaks it, and two other inputs that will share one output.
  const b = int(r, 0, nx - 1);
  const rest = xs.map((_, i) => i).filter((i) => i !== b);
  const i0 = rest[int(r, 0, rest.length - 1)];
  const j0 = rest.filter((i) => i !== i0)[int(r, 0, rest.length - 2)];
  ys[j0] = ys[i0];
  // The second output the broken input carries. Outside the printed outputs,
  // so the table has exactly one broken input and exactly one shared output.
  let second = null;
  for (let i = 0; i < 120 && second === null; i++) {
    const v = int(r, lo, hi);
    if (!ys.includes(v)) second = v;
  }
  if (second === null) throw new Error('retry: no spare output to break with');
  const pairs = xs.map((x, i) => [x, ys[i]]);
  pairs.push([xs[b], second]);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  // …and now confirm it, off the table rather than off the draw.
  const seen = new Map();
  let breaks = 0;
  for (const [x, y] of pairs) {
    if (seen.has(x)) { if (seen.get(x) === y) throw new Error('retry: a row is printed twice'); breaks += 1; }
    seen.set(x, y);
  }
  if (breaks !== 1) throw new Error('retry: the table does not break exactly once');
  const outs = pairs.map(([, y]) => y);
  if (new Set(outs).size === outs.length) throw new Error('retry: no shared output to test against');
  return { pairs, broken: xs[b] };
}

/** Wrong readings of a broken table: every one of them a stated misconception. */
function relationWrongs(g) {
  const shared = (() => {
    const seen = new Map();
    for (const [x, y] of g.pairs) {
      if (seen.has(y) && seen.get(y) !== x) return seen.get(y);
      seen.set(y, x);
    }
    return g.pairs[0][0];
  })();
  const brokenOut = g.pairs.find(([x]) => x === g.broken)[1];
  return [
    { v: String(shared), m: 'repeated-output-rejected' },
    { v: String(brokenOut), m: 'input-output-swap' },
    { v: String(g.pairs.length), m: 'counted-not-checked' },
    { v: String(g.pairs[0][0]), m: 'ordering-required' },
    { v: String(g.pairs[g.pairs.length - 1][0]), m: 'repeated-input-accepted' },
    { v: String(g.broken + 1), m: 'arith-slip' },
    { v: String(g.broken - 1), m: 'arith-slip' },
    { v: String(-g.broken), m: 'sign-slip' },
  ];
}

const relationIsFunction = [
  {
    id: 'rf-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawRelation(r, d, 5 + (d >= 4 ? 1 : 0));
      return {
        stem: T('l5.ask.whichInputBreaks'),
        latex: tbl('x', 'y', g.pairs),
        type: 'numeric',
        answer: String(g.broken),
        check: { kind: 'relationPairs', want: 'breakingInput' },
        steps: [
          { latex: `x = ${g.broken}`, why: T('l5.why.readDownTheInputs') },
          { latex: `${g.broken} \\rightarrow ${g.pairs.filter(([x]) => x === g.broken).map(([, y]) => y).join(', ')}`, why: T('l5.why.twoOutputsBreakIt') },
        ],
        distractors: relationWrongs(g),
      };
    },
  },
  {
    /* A WIDE TABLE STILL HAS TO SAY WHICH ROW IS THE INPUT.
       This form used to print two unlabelled rows of numbers with a rule
       between them, under "One input carries two different outputs. Which
       input?" and a free keypad. Nothing on the card said the top row was x.
       Read the bottom row as the input and a different number is the answer,
       and the checker — `layout: 'rows'`, which the learner cannot see —
       scores only one of the two readings. The row names now sit in a leading
       column, which is the same notation `tbl` uses turned on its side, so the
       sentence above the table has something to point at in all three
       languages and the wide layout is still what makes this form its own. */
    id: 'rf-wide', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawRelation(r, d, 5);
      const top = g.pairs.map(([x]) => x).join(' & ');
      const bot = g.pairs.map(([, y]) => y).join(' & ');
      const spec = `c|${'c'.repeat(g.pairs.length)}`;
      return {
        stem: T('l5.ask.whichInputBreaks'),
        latex: `\\begin{array}{${spec}} x & ${top} \\\\ \\hline y & ${bot} \\end{array}`,
        type: 'numeric',
        answer: String(g.broken),
        check: { kind: 'relationPairs', want: 'breakingInput', layout: 'rows' },
        steps: [
          { latex: `x = ${g.broken}`, why: T('l5.why.readDownTheInputs') },
          { latex: `${g.broken} \\rightarrow ${g.pairs.filter(([x]) => x === g.broken).map(([, y]) => y).join(', ')}`, why: T('l5.why.twoOutputsBreakIt') },
        ],
        distractors: relationWrongs(g),
      };
    },
  },
  {
    id: 'rf-log', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, LOGS);
      const g = drawRelation(r, d, 5, { positive: true });
      allAbove(0, g.pairs);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.whichInputBreaks')}`,
        latex: tbl('x', 'y', g.pairs),
        type: 'numeric',
        answer: String(g.broken),
        check: { kind: 'relationPairs', want: 'breakingInput' },
        steps: [
          { latex: `x = ${g.broken}`, why: T('l5.why.oneOutputEachInput') },
          { latex: `${g.broken} \\rightarrow ${g.pairs.filter(([x]) => x === g.broken).map(([, y]) => y).join(', ')}`, why: T('l5.why.twoOutputsBreakIt') },
        ],
        distractors: relationWrongs(g),
      };
    },
  },
  {
    id: 'rf-shared', rep: 'context', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, LOGS);
      const g = drawRelation(r, d, 6, { positive: true });
      allAbove(0, g.pairs);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.whichInputBreaks')}`,
        latex: tbl('x', 'y', g.pairs),
        type: 'numeric',
        answer: String(g.broken),
        check: { kind: 'relationPairs', want: 'breakingInput' },
        steps: [
          { latex: `x = ${g.broken}`, why: T('l5.why.sharedOutputIsFine') },
          { latex: `${g.broken} \\rightarrow ${g.pairs.filter(([x]) => x === g.broken).map(([, y]) => y).join(', ')}`, why: T('l5.why.twoOutputsBreakIt') },
        ],
        distractors: relationWrongs(g),
      };
    },
  },
  {
    id: 'rf-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_FUNC);
      const g = drawRelation(r, d, 5);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.whichInputBreaks')}`,
        latex: tbl('x', 'y', g.pairs),
        type: 'numeric',
        answer: String(g.broken),
        check: { kind: 'relationPairs', want: 'breakingInput' },
        steps: [
          { latex: `x = ${g.broken}`, why: T('l5.why.oneOutputEachInput') },
          { latex: `${g.broken} \\rightarrow ${g.pairs.filter(([x]) => x === g.broken).map(([, y]) => y).join(', ')}`, why: T('l5.why.twoOutputsBreakIt') },
        ],
        distractors: relationWrongs(g),
      };
    },
  },
];

// ===========================================================================
// sequence-terms  —  a list is a rule whose inputs are the positions
//
// `sequence` cannot be checked by `equivalent`, and the reason is exact:
// `equivalent` samples at half-integer values, and a letter in an exponent has
// no value there. So this kind carries its own sampler, on whole numbers only,
// and it DERIVES the rule from the printed list rather than being told it.
// A list that is neither adding nor multiplying is refused outright.
// ===========================================================================

/** A list that adds the same amount at every position. */
function drawAdding(r, d, len = 4) {
  const step = fromNz(r, STEP, d);
  const first = fromNz(r, START, d);
  const rows = [];
  for (let i = 0; i < len; i++) rows.push([i + 1, first + i * step]);
  if (rows.some(([, v]) => Math.abs(v) > 4000)) throw new Error('retry: past a value a cadet can read');
  if (!distinct(step, first)) throw new Error('retry: the step and the start are one number');
  return { kind: 'add', step, first, rows };
}

/** A list that multiplies by the same number at every position. */
function drawTimesing(r, d, len = 4) {
  const factor = pick(r, d >= 4 ? [2, 3, 4, 5] : [2, 3]);
  const first = from(r, [[1, 3], [2, 5], [2, 7], [3, 9], [4, 12]], d);
  const rows = [];
  for (let i = 0; i < len; i++) rows.push([i + 1, first * factor ** i]);
  if (rows.some(([, v]) => Math.abs(v) > 40000)) throw new Error('retry: past a value a cadet can read');
  if (!distinct(factor, first)) throw new Error('retry: the factor and the start are one number');
  return { kind: 'times', factor, first, rows };
}

/** How far past the printed list this band asks a learner to walk. */
const REACH = [[1, 1], [1, 2], [2, 3], [2, 4], [3, 5]];

/** Wrong values of a list read at a later position. */
function listWrongs(g, at, want) {
  const last = g.rows[g.rows.length - 1];
  const out = [
    { v: String(want + 1), m: 'arith-slip' },
    { v: String(want - 1), m: 'arith-slip' },
    { v: String(last[1]), m: 'step-from-the-first-pair-only' },
  ];
  if (g.kind === 'add') {
    out.push({ v: String(g.first + at * g.step), m: 'position-off-by-one' });
    out.push({ v: String(want - g.step), m: 'position-off-by-one' });
    out.push({ v: String(g.first * g.step * at), m: 'step-and-factor-confused' });
    out.push({ v: String(at + g.step), m: 'rule-applied-to-the-position' });
    out.push({ v: String(g.first - (at - 1) * g.step), m: 'falling-step-made-positive' });
  } else {
    out.push({ v: String(g.first * g.factor ** at), m: 'position-off-by-one' });
    out.push({ v: String(g.first + (at - 1) * g.factor), m: 'step-and-factor-confused' });
    out.push({ v: String(want / g.factor), m: 'position-off-by-one' });
    out.push({ v: String(at * g.factor), m: 'rule-applied-to-the-position' });
    out.push({ v: String(g.first * g.factor * at), m: 'step-and-factor-confused' });
  }
  return out.filter((x) => /^-?\d+$/.test(x.v));
}

const sequenceTerms = [
  {
    id: 'st-add', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawAdding(r, d, 4);
      const at = g.rows.length + from(r, REACH, d);
      const want = g.first + (at - 1) * g.step;
      if (Math.abs(want) > 6000) throw new Error('retry: past a value a cadet can read');
      return {
        stem: T('l5.ask.valueAtPosition', { k: at }),
        latex: tbl('n', 'f', g.rows),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'sequence', form: 'term', at, variable: 'n' },
        steps: [
          { latex: `${g.rows[1][1]} - ${g.rows[0][1]} = ${g.step}`, why: T('l5.why.takeNeighbours') },
          { latex: `${g.rows[g.rows.length - 1][1]} + ${at - g.rows.length} \\cdot \\left(${g.step}\\right) = ${want}`, why: T('l5.why.addTheStepEachTime') },
        ],
        distractors: listWrongs(g, at, want),
      };
    },
  },
  {
    id: 'st-times', rep: 'table', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const g = drawTimesing(r, d, 4);
      const at = g.rows.length + from(r, [[1, 1], [1, 1], [1, 2], [1, 2], [1, 3]], d);
      const want = g.first * g.factor ** (at - 1);
      if (want > 200000) throw new Error('retry: past a value a cadet can read');
      return {
        stem: T('l5.ask.valueAtPosition', { k: at }),
        latex: tbl('n', 'f', g.rows),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'sequence', form: 'term', at, variable: 'n' },
        steps: [
          { latex: `\\frac{${g.rows[1][1]}}{${g.rows[0][1]}} = ${g.factor}`, why: T('l5.why.divideNeighbours') },
          { latex: `${g.rows[g.rows.length - 1][1]} \\cdot ${g.factor}^{${at - g.rows.length}} = ${want}`, why: T('l5.why.countTheStepsOn', { k: at }) },
        ],
        distractors: listWrongs(g, at, want),
      };
    },
  },
  {
    id: 'st-recursive', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const timesing = d >= 4 && r() < 0.4;
      const g = timesing ? drawTimesing(r, d, 4) : drawAdding(r, d, 4);
      const at = 2 + from(r, [[1, 2], [2, 3], [2, 4], [3, 5], [4, 6]], d);
      const want = timesing ? g.first * g.factor ** (at - 1) : g.first + (at - 1) * g.step;
      if (Math.abs(want) > 60000) throw new Error('retry: past a value a cadet can read');
      const start = `f\\left(1\\right) = ${g.first}`;
      const step = timesing
        ? `f\\left(n\\right) = ${g.factor} \\cdot f\\left(n-1\\right)`
        : `f\\left(n\\right) = f\\left(n-1\\right) ${sgn(g.step)}`;
      return {
        stem: T('l5.ask.valueAtPosition', { k: at }),
        latex: stacked(start, step),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'sequence', form: 'recursive', at, variable: 'n', statements: [start, step] },
        steps: [
          { latex: `f\\left(2\\right) = ${timesing ? g.first * g.factor : g.first + g.step}`, why: T('l5.why.runTheRuleOn') },
          { latex: `f\\left(${at}\\right) = ${want}`, why: timesing ? T('l5.why.multiplyEachTime') : T('l5.why.addTheStepEachTime') },
        ],
        distractors: listWrongs(timesing ? g : g, at, want)
          .concat([{ v: String(at + (timesing ? g.factor : g.step)), m: 'rule-applied-to-the-position' }]),
      };
    },
  },
  {
    id: 'st-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const timesing = d >= 3 && r() < 0.4;
      const g = timesing ? drawTimesing(r, d, 4) : drawAdding(r, d, 4);
      const sc = scene(sr, timesing ? TIMESING : (g.step > 0 ? ADDING_UP : ADDING_DOWN));
      const at = g.rows.length + (timesing ? 1 : from(r, REACH, d));
      const want = timesing ? g.first * g.factor ** (at - 1) : g.first + (at - 1) * g.step;
      if (Math.abs(want) > 60000) throw new Error('retry: past a value a cadet can read');
      allAbove(0, want, g.rows.map(([, v]) => v));
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.valueAtPosition', { k: at })}`,
        latex: tbl('n', 'f', g.rows),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'sequence', form: 'term', at, variable: 'n' },
        steps: timesing ? [
          { latex: `\\frac{${g.rows[1][1]}}{${g.rows[0][1]}} = ${g.factor}`, why: T('l5.why.divideNeighbours') },
          { latex: `${g.rows[g.rows.length - 1][1]} \\cdot ${g.factor}^{${at - g.rows.length}} = ${want}`, why: T('l5.why.multiplyEachTime') },
        ] : [
          { latex: `${g.rows[1][1]} - ${g.rows[0][1]} = ${g.step}`, why: T('l5.why.takeNeighbours') },
          { latex: `${g.rows[g.rows.length - 1][1]} + ${at - g.rows.length} \\cdot \\left(${g.step}\\right) = ${want}`, why: T('l5.why.addTheStepEachTime') },
        ],
        distractors: listWrongs(g, at, want),
      };
    },
  },
  {
    id: 'st-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_LIST);
      const g = drawAdding(r, d, 5);
      const at = g.rows.length + from(r, REACH, d);
      const want = g.first + (at - 1) * g.step;
      if (Math.abs(want) > 6000) throw new Error('retry: past a value a cadet can read');
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.valueAtPosition', { k: at })}`,
        latex: tbl('n', 'f', g.rows),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'sequence', form: 'term', at, variable: 'n' },
        steps: [
          { latex: `${g.rows[1][1]} - ${g.rows[0][1]} = ${g.step}`, why: T('l5.why.sameStepAllTheWay') },
          { latex: `${g.rows[g.rows.length - 1][1]} + ${at - g.rows.length} \\cdot \\left(${g.step}\\right) = ${want}`, why: T('l5.why.firstValuePlusSteps') },
        ],
        distractors: listWrongs(g, at, want),
      };
    },
  },
];

// ===========================================================================
// sequence-nth-term  —  one formula for the value at any position
//
// The checker parses the learner's own formula and evaluates it at every
// printed position AND at three positions past the end of the printed list.
// A formula that fits the four rows on screen and drifts afterwards — which is
// exactly what "the step times the position" does — fails on the fourth test.
// ===========================================================================

/** `4n + 1` — the one spelling of an adding formula. */
function addFormula(step, first) {
  const c = first - step;
  const head = coefOf(step, 'n');
  return c === 0 ? head : `${head} ${sgn(c)}`;
}
/** `3 \cdot 2^{n}` — the one spelling of a multiplying formula. */
function timesFormula(factor, first) {
  const head = first / factor;
  return `${head === 1 ? '' : `${head} \\cdot `}${factor}^{n}`;
}

/** Wrong formulas for a list, every one of them a stated misconception. */
function formulaWrongs(g) {
  if (g.kind === 'add') {
    return [
      { v: coefOf(g.step, 'n'), m: 'offset-dropped' },
      { v: `${coefOf(g.step, 'n')} ${sgn(g.first)}`, m: 'offset-dropped' },
      { v: `${coefOf(g.first, 'n')} ${sgn(g.step)}`, m: 'position-returned-instead-of-value' },
      { v: `${g.first} \\cdot ${Math.abs(g.step) + 1}^{n}`, m: 'adding-formula-used-for-multiplying' },
      { v: `${coefOf(g.step, 'n')} ${sgn(g.first + g.step)}`, m: 'factor-power-off-by-one' },
      { v: `${coefOf(-g.step, 'n')} ${sgn(g.first - g.step)}`, m: 'falling-step-made-positive' },
      { v: 'n', m: 'position-returned-instead-of-value' },
    ];
  }
  const head = g.first / g.factor;
  return [
    { v: `${g.first} \\cdot ${g.factor}^{n}`, m: 'factor-power-off-by-one' },
    { v: `${coefOf(g.factor, 'n')} ${sgn(g.first)}`, m: 'adding-formula-used-for-multiplying' },
    { v: `${head === 1 ? '' : `${head} \\cdot `}${g.factor}^{n-1}`, m: 'factor-power-off-by-one' },
    { v: `${coefOf(g.first, 'n')}`, m: 'position-returned-instead-of-value' },
    { v: `${head + 1} \\cdot ${g.factor}^{n}`, m: 'offset-dropped' },
    { v: `${head === 1 ? '' : `${head} \\cdot `}${g.factor + 1}^{n}`, m: 'step-and-factor-confused' },
    { v: 'n', m: 'position-returned-instead-of-value' },
  ];
}

const sequenceNthTerm = [
  {
    id: 'sn-add', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawAdding(r, d, 4);
      if (g.first - g.step === 0 && d >= 2) throw new Error('retry: this band wants a number left over');
      const ans = addFormula(g.step, g.first);
      return {
        stem: T('l5.ask.oneFormula', { v: 'n' }),
        latex: asks(tbl('n', 'f', g.rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'sequence', form: 'explicit', variable: 'n' },
        steps: [
          { latex: `${g.rows[1][1]} - ${g.rows[0][1]} = ${g.step}`, why: T('l5.why.takeNeighbours') },
          { latex: `${g.first} - \\left(${g.step}\\right) = ${g.first - g.step}`, why: T('l5.why.stepTimesPositionPlusStart') },
        ],
        distractors: formulaWrongs(g).concat([
          { v: `f\\left(n-1\\right) ${sgn(g.step)}`, m: 'recursive-called-explicit' },
        ]),
      };
    },
  },
  {
    id: 'sn-fall', rep: 'table', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const g = drawAdding(r, d, 4);
      if (g.step > 0) throw new Error('retry: this form draws a list that falls');
      const ans = addFormula(g.step, g.first);
      return {
        stem: T('l5.ask.oneFormula', { v: 'n' }),
        latex: asks(tbl('n', 'f', g.rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'sequence', form: 'explicit', variable: 'n' },
        steps: [
          { latex: `${g.rows[1][1]} - \\left(${g.rows[0][1]}\\right) = ${g.step}`, why: T('l5.why.takeNeighbours') },
          { latex: `${g.first} - \\left(${g.step}\\right) = ${g.first - g.step}`, why: T('l5.why.stepTimesPositionPlusStart') },
        ],
        distractors: formulaWrongs(g).concat([
          { v: `f\\left(n-1\\right) ${sgn(g.step)}`, m: 'recursive-called-explicit' },
        ]),
      };
    },
  },
  {
    id: 'sn-times', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawTimesing(r, d, 4);
      if (g.first % g.factor !== 0) throw new Error('retry: this form wants a whole number in front');
      const ans = timesFormula(g.factor, g.first);
      return {
        stem: T('l5.ask.oneFormula', { v: 'n' }),
        latex: asks(tbl('n', 'f', g.rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'sequence', form: 'explicit', variable: 'n' },
        steps: [
          { latex: `\\frac{${g.rows[1][1]}}{${g.rows[0][1]}} = ${g.factor}`, why: T('l5.why.sameFactorAllTheWay') },
          { latex: `\\frac{${g.first}}{${g.factor}} = ${g.first / g.factor}`, why: T('l5.why.factorPowerFromFirst') },
        ],
        distractors: formulaWrongs(g),
      };
    },
  },
  {
    id: 'sn-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const timesing = d >= 3 && r() < 0.4;
      const g = timesing ? drawTimesing(r, d, 4) : drawAdding(r, d, 4);
      const sc = scene(sr, timesing ? TIMESING : (g.step > 0 ? ADDING_UP : ADDING_DOWN));
      if (timesing && g.first % g.factor !== 0) throw new Error('retry: this form wants a whole number in front');
      allAbove(0, g.rows.map(([, v]) => v));
      const ans = timesing ? timesFormula(g.factor, g.first) : addFormula(g.step, g.first);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.oneFormula', { v: 'n' })}`,
        latex: asks(tbl('n', 'f', g.rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'sequence', form: 'explicit', variable: 'n' },
        steps: timesing ? [
          { latex: `\\frac{${g.rows[1][1]}}{${g.rows[0][1]}} = ${g.factor}`, why: T('l5.why.divideNeighbours') },
          { latex: `\\frac{${g.first}}{${g.factor}} = ${g.first / g.factor}`, why: T('l5.why.factorPowerFromFirst') },
        ] : [
          { latex: `${g.rows[1][1]} - \\left(${g.rows[0][1]}\\right) = ${g.step}`, why: T('l5.why.takeNeighbours') },
          { latex: `${g.first} - \\left(${g.step}\\right) = ${g.first - g.step}`, why: T('l5.why.stepTimesPositionPlusStart') },
        ],
        distractors: formulaWrongs(g),
      };
    },
  },
  {
    id: 'sn-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    /* A DISPUTE IS A SITUATION, NOT A CHOICE SET.
       This form used to end in "Which answer is right?" over a keypad, with no
       answers on the card at all — so the sentence pointed at something a
       cadet could look for and never find, and the only way through was to
       ignore it. The dispute stays, because caring about a disagreement is
       what makes a cadet check their own work; the question after it states
       the task, which is what every other form in this skill already does. */
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_LIST);
      const g = drawAdding(r, d, 5);
      const ans = addFormula(g.step, g.first);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.oneFormula', { v: 'n' })}`,
        latex: asks(tbl('n', 'f', g.rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'sequence', form: 'explicit', variable: 'n' },
        steps: [
          { latex: `${g.rows[1][1]} - \\left(${g.rows[0][1]}\\right) = ${g.step}`, why: T('l5.why.sameStepAllTheWay') },
          { latex: `${g.first} - \\left(${g.step}\\right) = ${g.first - g.step}`, why: T('l5.why.checkAtPositionOne') },
        ],
        distractors: formulaWrongs(g),
      };
    },
  },
];

// ===========================================================================
// point-slope-form  —  one reading and a rate pin a line down
//
// `relatedLine` derives the rate off the PRINTED line, derives the constant by
// putting the PRINTED reading into it, and then puts that reading back into the
// learner's own equation. A rule with the right rate and the wrong constant
// fails; a rule that is the given line copied whole fails unless the reading is
// really on it. `c.form` names which of the three written forms is wanted, and
// `lineFormOf` reads the learner's spelling to decide whether it is that one.
// ===========================================================================

/** A line and a reading that really sits on it. */
function drawLineAndPoint(r, d) {
  const m = fromNz(r, RATE, d);
  const b = fromNz(r, INTERCEPT, d);
  const x0 = fromNz(r, ATX, d);
  const y0 = m * x0 + b;
  if (Math.abs(y0) > 220) throw new Error('retry: past a reading a cadet can hold');
  if (!distinct(m, b, x0)) throw new Error('retry: repeated number');
  return { m, b, x0, y0 };
}

/** Wrong rules for a line through a reading. */
function lineWrongs(m, b, x0, y0) {
  return [
    { v: lineTex(m, y0 + m * x0), m: 'point-signs-copied' },
    { v: lineTex(b, m), m: 'rate-and-start-swapped' },
    { v: lineTex(m, y0), m: 'start-value-kept-from-the-given-line' },
    { v: lineTex(m, b + 1), m: 'arith-slip' },
    { v: lineTex(-m, b), m: 'sign-flipped-only' },
    { v: lineTex(m, 0), m: 'start-value-added-to-direct-variation' },
    { v: lineTex(m, b - 1), m: 'arith-slip' },
  ];
}

const pointSlopeForm = [
  {
    id: 'ps-point', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawLineAndPoint(r, d);
      const given = lineTex(g.m, g.b);
      const ans = pointSlopeTex(g.m, g.x0, g.y0);
      return {
        stem: T('l5.ask.sameLineFromReading'),
        latex: asks(`${given} \\quad ${markedPoint(g.x0, g.y0)}`),
        type: 'expression',
        answer: ans,
        check: { kind: 'relatedLine', math: given, point: [g.x0, g.y0], relation: 'parallel', form: 'pointSlope', vars: ['x', 'y'] },
        steps: [
          { latex: `m = ${g.m}`, why: T('l5.why.rateOffTheRule') },
          { latex: ans, why: T('l5.why.pointIntoTheForm') },
        ],
        distractors: [
          { v: pointSlopeTex(g.m, -g.x0, -g.y0), m: 'point-signs-copied' },
          { v: pointSlopeTex(g.b, g.x0, g.y0), m: 'rate-and-start-swapped' },
          { v: pointSlopeTex(g.m, g.y0, g.x0), m: 'point-signs-copied' },
          { v: pointSlopeTex(-g.m, g.x0, g.y0), m: 'sign-flipped-only' },
          { v: lineTex(g.m, g.y0), m: 'start-value-kept-from-the-given-line' },
          { v: pointSlopeTex(g.m, g.x0, 0), m: 'start-value-added-to-direct-variation' },
          { v: pointSlopeTex(g.m, 0, g.y0), m: 'point-signs-copied' },
        ],
      };
    },
  },
  {
    id: 'ps-toslope', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawLineAndPoint(r, d);
      const given = pointSlopeTex(g.m, g.x0, g.y0);
      const ans = lineTex(g.m, g.b);
      return {
        stem: T('l5.ask.sameLineOutputAlone'),
        latex: asks(`${given} \\quad ${markedPoint(g.x0, g.y0)}`),
        type: 'expression',
        answer: ans,
        check: { kind: 'relatedLine', math: given, point: [g.x0, g.y0], relation: 'parallel', form: 'slopeIntercept', vars: ['x', 'y'] },
        steps: [
          { latex: `y ${sgn(-g.y0)} = ${coefOf(g.m, 'x')} ${sgn(-g.m * g.x0)}`, why: T('l5.why.multiplyOutTheBracket') },
          { latex: ans, why: T('l5.why.takeAwayTheReading') },
        ],
        distractors: lineWrongs(g.m, g.b, g.x0, g.y0),
      };
    },
  },
  {
    id: 'ps-standard', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const q = pick(r, [2, 3, 4]);
      const p = fromNz(r, [[1, 2], [1, 3], [-5, 5], [-7, 7], [-9, 9]], d);
      if (p % q === 0) throw new Error('retry: this rate is a whole number');
      const b = fromNz(r, INTERCEPT, d);
      const x0 = q * fromNz(r, [[1, 2], [1, 3], [-3, 3], [-4, 4], [-5, 5]], d);
      const y0 = (p * x0) / q + b;
      if (!Number.isInteger(y0)) throw new Error('retry: the reading is not a whole pair');
      if (Math.abs(y0) > 220) throw new Error('retry: past a reading a cadet can hold');
      const given = lineTexQ(p, q, b);
      // p x - q y = -q b, written with a positive number in front of x
      const [A, B, C] = p < 0 ? [-p, q, q * b] : [p, -q, -q * b];
      const ans = standardTex(A, B, C);
      return {
        stem: T('l5.ask.sameLineWholeNumbers'),
        latex: asks(`${given} \\quad ${markedPoint(x0, y0)}`),
        type: 'expression',
        answer: ans,
        check: { kind: 'relatedLine', math: given, point: [x0, y0], relation: 'parallel', form: 'standard', vars: ['x', 'y'] },
        steps: [
          { latex: `${q}y = ${coefOf(p, 'x')} ${sgn(q * b)}`, why: T('l5.why.clearTheBottom') },
          { latex: ans, why: T('l5.why.gatherLettersLeft') },
        ],
        distractors: [
          { v: standardTex(A, -B, C), m: 'sign-flipped-only' },
          { v: standardTex(A, B, -C), m: 'point-signs-copied' },
          // `p/q x - y = -b` USED TO SIT HERE. Multiply it by -q and it IS the
          // key — the same line, offered a second time and marked wrong on 160
          // of 160 seeds, under a stem that said only "write the same line
          // another way". The stem now names the form that is wanted, and the
          // option that was a second right answer is gone. A fraction left in
          // is still the error worth naming, so the first line below keeps it
          // and gets the rearrangement wrong, which is a different line; the
          // second clears the bottom number off the letters and forgets the
          // number on the right, which is the printed line's own constant.
          { v: `${rateTex(p, q, 'x')} + y = ${b}`, m: 'fractions-left-in-standard-form' },
          { v: standardTex(A, B, p < 0 ? b : -b), m: 'start-value-kept-from-the-given-line' },
          { v: standardTex(B, A, C), m: 'rate-and-start-swapped' },
          { v: standardTex(A, B, C + 1), m: 'arith-slip' },
          { v: standardTex(A, B, 0), m: 'start-value-added-to-direct-variation' },
        ],
      };
    },
  },
  {
    id: 'ps-direct', rep: 'table', dMin: 1, dMax: 4,
    build({ r, d, T }) {
      const k = fromNz(r, RATE, d);
      const step = int(r, 1, 1 + rung(d));
      const rows = [1, 2, 3, 4].map((i) => { const x = i * step; return [x, k * x]; });
      if (rows.some(([, y]) => Math.abs(y) > 300)) throw new Error('retry: past a reading a cadet can hold');
      const ans = lineTex(k, 0);
      return {
        stem: T('l5.ask.writeTheRule'),
        latex: asks(tbl('x', 'y', rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'line', points: [rows[0], rows[1]], want: 'equation' },
        steps: [
          { latex: `\\frac{${rows[0][1]}}{${rows[0][0]}} = ${k}`, why: T('l5.why.constantIsOutputOverInput') },
          { latex: ans, why: T('l5.why.throughTheOrigin') },
        ],
        distractors: [
          { v: lineTex(k, rows[0][1]), m: 'start-value-added-to-direct-variation' },
          { v: lineTex(k, 1), m: 'start-value-added-to-direct-variation' },
          { v: lineTexQ(rows[0][0], rows[0][1], 0), m: 'constant-of-variation-inverted' },
          { v: lineTex(rows[0][1], 0), m: 'rate-and-start-swapped' },
          { v: lineTex(-k, 0), m: 'sign-flipped-only' },
          { v: lineTex(k + 1, 0), m: 'arith-slip' },
          { v: lineTex(k, -1), m: 'start-value-added-to-direct-variation' },
        ],
      };
    },
  },
  {
    id: 'ps-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, STEADY);
      const g = drawLineAndPoint(r, d);
      allAbove(0, g.m, g.b, g.x0, g.y0);
      const rule = `${coefOf(g.m, '')}\\left(x ${sgn(-g.x0)}\\right) ${sgn(g.y0)}`;
      const body = g.m === 1 ? `\\left(x ${sgn(-g.x0)}\\right) ${sgn(g.y0)}` : rule;
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.valueAtZero')}`,
        latex: `f\\left(x\\right) = ${body}`,
        type: 'numeric',
        answer: String(g.b),
        check: { kind: 'features', math: body, variable: 'x', want: 'yIntercept' },
        steps: [
          { latex: `${coefOf(g.m, '')}\\left(0 ${sgn(-g.x0)}\\right) ${sgn(g.y0)}`, why: T('l5.why.zeroIntoTheForm') },
          { latex: String(g.b), why: T('l5.why.multiplyOutTheBracket') },
        ],
        distractors: [
          { v: String(g.y0), m: 'start-value-kept-from-the-given-line' },
          { v: String(g.m), m: 'rate-and-start-swapped' },
          { v: String(-g.b), m: 'sign-flipped-only' },
          { v: String(g.b + 1), m: 'arith-slip' },
          { v: String(g.b - 1), m: 'arith-slip' },
          { v: String(g.y0 + g.m * g.x0), m: 'point-signs-copied' },
          { v: String(g.x0), m: 'point-signs-copied' },
        ],
      };
    },
  },
];

// ===========================================================================
// parallel-perpendicular  —  the same rate, or a rate turned over and negated
//
// The upright and level cases are the ones a bank usually leaves out, and they
// are where the misconception lives. `relatedLine` handles both without a
// special case: a line with no `y` in it has no rate, so a line beside it is
// `x = a`, and a line at right angles to it is level.
// ===========================================================================

const parallelPerpendicular = [
  {
    id: 'pp-beside', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const m = fromNz(r, RATE, d);
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const y0 = fromNz(r, INTERCEPT, d);
      const bNew = y0 - m * x0;
      if (bNew === b) throw new Error('retry: the new line is the given line');
      if (!distinct(m, b, x0, y0)) throw new Error('retry: repeated number');
      const given = lineTex(m, b);
      const ans = lineTex(m, bNew);
      return {
        stem: T('l5.ask.lineBeside'),
        latex: asks(`${given} \\quad ${markedPoint(x0, y0)}`),
        type: 'expression',
        answer: ans,
        check: { kind: 'relatedLine', math: given, point: [x0, y0], relation: 'parallel', form: 'slopeIntercept', vars: ['x', 'y'] },
        steps: [
          { latex: `m = ${m}`, why: T('l5.why.sameRateForParallel') },
          { latex: `${y0} - ${coefOf(m, '')}\\left(${x0}\\right) = ${bNew}`, why: T('l5.why.pointIntoTheForm') },
        ],
        distractors: [
          { v: given, m: 'given-line-copied-whole' },
          { v: lineTex(m, b), m: 'start-value-kept-from-the-given-line' },
          { v: lineTex(-m, bNew), m: 'sign-flipped-only' },
          { v: lineTex(m, y0), m: 'start-value-kept-from-the-given-line' },
          { v: lineTex(m, bNew + 1), m: 'arith-slip' },
          { v: lineTex(m, y0 + m * x0), m: 'point-signs-copied' },
          { v: lineTex(b, bNew), m: 'rate-and-start-swapped' },
        ],
      };
    },
  },
  {
    id: 'pp-right', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const q = fromNz(r, [[2, 3], [2, 4], [-5, 5], [-7, 7], [-9, 9]], d);
      if (Math.abs(q) < 2) throw new Error('retry: a rate of one hides the turn');
      const b = fromNz(r, INTERCEPT, d);
      const x0 = q * fromNz(r, [[1, 2], [1, 3], [-3, 3], [-4, 4], [-5, 5]], d);
      const y0 = fromNz(r, INTERCEPT, d);
      const bNew = y0 + x0 / q;
      if (!Number.isInteger(bNew)) throw new Error('retry: the new line misses a whole number');
      if (!distinct(q, b, x0, y0)) throw new Error('retry: repeated number');
      const given = lineTex(q, b);
      const ans = lineTexQ(-1, q, bNew);
      return {
        stem: T('l5.ask.lineAtRightAngle'),
        latex: asks(`${given} \\quad ${markedPoint(x0, y0)}`),
        type: 'expression',
        answer: ans,
        check: { kind: 'relatedLine', math: given, point: [x0, y0], relation: 'perpendicular', form: 'slopeIntercept', vars: ['x', 'y'] },
        steps: [
          { latex: `m = ${ratio(-1, q)}`, why: T('l5.why.turnOverAndChangeSign') },
          { latex: `${y0} - ${ratio(-1, q)} \\cdot \\left(${x0}\\right) = ${bNew}`, why: T('l5.why.pointIntoTheForm') },
        ],
        distractors: [
          { v: lineTex(-q, bNew), m: 'sign-flipped-only' },
          { v: lineTexQ(1, q, bNew), m: 'turned-over-only' },
          { v: given, m: 'given-line-copied-whole' },
          { v: lineTexQ(-1, q, b), m: 'start-value-kept-from-the-given-line' },
          { v: lineTexQ(-1, q, y0), m: 'start-value-kept-from-the-given-line' },
          { v: lineTexQ(-1, q, bNew + 1), m: 'arith-slip' },
          { v: lineTex(q, bNew), m: 'given-line-copied-whole' },
        ],
      };
    },
  },
  {
    id: 'pp-rate', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const q = fromNz(r, [[2, 3], [2, 4], [-5, 5], [-7, 7], [-9, 9]], d);
      if (Math.abs(q) < 2) throw new Error('retry: a rate of one hides the turn');
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const y0 = fromNz(r, INTERCEPT, d);
      if (!distinct(q, b, x0, y0)) throw new Error('retry: repeated number');
      const given = lineTex(q, b);
      return {
        stem: T('l5.ask.rateAtRightAngle'),
        latex: `${given} \\quad ${markedPoint(x0, y0)}`,
        type: 'numeric',
        answer: frac(-1, q),
        check: { kind: 'relatedLine', math: given, point: [x0, y0], relation: 'perpendicular', want: 'slope', vars: ['x', 'y'] },
        steps: [
          { latex: `m = ${q}`, why: T('l5.why.rateOffTheRule') },
          { latex: `m = ${ratio(-1, q)}`, why: T('l5.why.turnOverAndChangeSign') },
        ],
        distractors: [
          { v: frac(1, q), m: 'turned-over-only' },
          { v: String(-q), m: 'sign-flipped-only' },
          { v: String(q), m: 'given-line-copied-whole' },
          { v: String(b), m: 'rate-and-start-swapped' },
          { v: frac(-1, b), m: 'rate-and-start-swapped' },
          { v: String(0), m: 'flat-and-upright-swapped' },
          { v: frac(-1, q + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'pp-upright', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const a = fromNz(r, ATX, d);
      const x0 = fromNz(r, ATX, d);
      const y0 = fromNz(r, INTERCEPT, d);
      const beside0 = r() < 0.5;
      if (!distinct(a, x0, y0)) throw new Error('retry: repeated number');
      const given = `x = ${a}`;
      const ans = beside0 ? `x = ${x0}` : `y = ${y0}`;
      return {
        stem: T(beside0 ? 'l5.ask.lineBeside' : 'l5.ask.lineAtRightAngle'),
        latex: asks(`${given} \\quad ${markedPoint(x0, y0)}`),
        type: 'expression',
        answer: ans,
        check: {
          kind: 'relatedLine', math: given, point: [x0, y0],
          relation: beside0 ? 'parallel' : 'perpendicular', vars: ['x', 'y'],
        },
        steps: [
          { latex: given, why: T('l5.why.uprightHasNoRate') },
          { latex: ans, why: beside0 ? T('l5.why.sameRateForParallel') : T('l5.why.flatLineRateIsZero') },
        ],
        distractors: [
          { v: beside0 ? `y = ${x0}` : `x = ${y0}`, m: 'flat-and-upright-swapped' },
          { v: beside0 ? `x = ${y0}` : `y = ${x0}`, m: 'flat-and-upright-swapped' },
          { v: given, m: 'given-line-copied-whole' },
          { v: `y = ${a}`, m: 'flat-and-upright-swapped' },
          { v: beside0 ? `x = ${x0 + 1}` : `y = ${y0 + 1}`, m: 'arith-slip' },
          { v: `y = x ${sgn(y0 - x0)}`, m: 'sign-flipped-only' },
          { v: `x = ${a + x0}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'pp-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const right = d >= 3 && r() < 0.5;
      const sc = scene(sr, right ? ATRIGHT : ALONGSIDE);
      const q = fromNz(r, [[2, 3], [2, 4], [-5, 5], [-7, 7], [-9, 9]], d);
      if (Math.abs(q) < 2) throw new Error('retry: a rate of one hides the turn');
      const b = fromNz(r, INTERCEPT, d);
      const x0 = (right ? q : 1) * fromNz(r, [[1, 2], [1, 3], [-3, 3], [-4, 4], [-5, 5]], d);
      const y0 = fromNz(r, INTERCEPT, d);
      const bNew = right ? y0 + x0 / q : y0 - q * x0;
      if (!Number.isInteger(bNew)) throw new Error('retry: the new line misses a whole number');
      if (!distinct(q, b, x0, y0)) throw new Error('retry: repeated number');
      const given = lineTex(q, b);
      const ans = right ? lineTexQ(-1, q, bNew) : lineTex(q, bNew);
      if (ans === given) throw new Error('retry: the new line is the given line');
      return {
        // The situation names which line is wanted — a girder BESIDE this one,
        // a brace at a RIGHT ANGLE to it — so the question after it names the
        // line and not the relation, and the two do not say it twice.
        stem: `${T(sc.ctx)} ${T('l5.ask.writeThatLine')}`,
        latex: asks(`${given} \\quad ${markedPoint(x0, y0)}`),
        type: 'expression',
        answer: ans,
        check: {
          kind: 'relatedLine', math: given, point: [x0, y0],
          relation: right ? 'perpendicular' : 'parallel', form: 'slopeIntercept', vars: ['x', 'y'],
        },
        steps: [
          { latex: `m = ${right ? ratio(-1, q) : String(q)}`, why: right ? T('l5.why.turnOverAndChangeSign') : T('l5.why.sameRateForParallel') },
          { latex: ans, why: T('l5.why.pointIntoTheForm') },
        ],
        distractors: [
          { v: given, m: 'given-line-copied-whole' },
          { v: right ? lineTexQ(1, q, bNew) : lineTex(-q, bNew), m: right ? 'turned-over-only' : 'sign-flipped-only' },
          { v: right ? lineTex(-q, bNew) : lineTexQ(-1, q, bNew), m: 'sign-flipped-only' },
          { v: right ? lineTexQ(-1, q, b) : lineTex(q, b), m: 'start-value-kept-from-the-given-line' },
          { v: right ? lineTexQ(-1, q, y0) : lineTex(q, y0), m: 'start-value-kept-from-the-given-line' },
          { v: right ? lineTexQ(-1, q, bNew + 1) : lineTex(q, bNew + 1), m: 'arith-slip' },
          { v: `x = ${x0}`, m: 'flat-and-upright-swapped' },
        ],
      };
    },
  },
  {
    id: 'pp-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const m = fromNz(r, RATE, d);
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const y0 = fromNz(r, INTERCEPT, d);
      const bNew = y0 - m * x0;
      if (bNew === b) throw new Error('retry: the new line is the given line');
      if (!distinct(m, b, x0, y0)) throw new Error('retry: repeated number');
      const rows = [0, 1, 2].map((i) => { const x = i; return [x, m * x + b]; });
      if (rows.some(([, y]) => Math.abs(y) > 240)) throw new Error('retry: past a reading a cadet can hold');
      const given = lineTex(m, b);
      const ans = lineTex(m, bNew);
      return {
        stem: T('l5.ask.lineBeside'),
        latex: asks(`${given} \\quad ${tbl('x', 'y', rows)} \\quad ${markedPoint(x0, y0)}`),
        type: 'expression',
        answer: ans,
        check: { kind: 'relatedLine', math: given, point: [x0, y0], relation: 'parallel', form: 'slopeIntercept', vars: ['x', 'y'] },
        steps: [
          { latex: `m = ${m}`, why: T('l5.why.sameRateForParallel') },
          { latex: `${y0} - ${coefOf(m, '')}\\left(${x0}\\right) = ${bNew}`, why: T('l5.why.pointIntoTheForm') },
        ],
        distractors: [
          { v: given, m: 'given-line-copied-whole' },
          { v: lineTex(m, y0), m: 'start-value-kept-from-the-given-line' },
          { v: lineTex(-m, bNew), m: 'sign-flipped-only' },
          { v: lineTex(m, bNew + 1), m: 'arith-slip' },
          { v: lineTex(m, y0 + m * x0), m: 'point-signs-copied' },
          { v: lineTex(b, bNew), m: 'rate-and-start-swapped' },
          { v: `x = ${x0}`, m: 'flat-and-upright-swapped' },
        ],
      };
    },
  },
  {
    id: 'pp-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_LINE);
      const q = fromNz(r, [[2, 3], [2, 4], [-5, 5], [-7, 7], [-9, 9]], d);
      if (Math.abs(q) < 2) throw new Error('retry: a rate of one hides the turn');
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const y0 = fromNz(r, INTERCEPT, d);
      if (!distinct(q, b, x0, y0)) throw new Error('retry: repeated number');
      const given = lineTex(q, b);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.rateOfThatLine')}`,
        latex: `${given} \\quad ${markedPoint(x0, y0)}`,
        type: 'numeric',
        answer: frac(-1, q),
        check: { kind: 'relatedLine', math: given, point: [x0, y0], relation: 'perpendicular', want: 'slope', vars: ['x', 'y'] },
        steps: [
          { latex: `m = ${q}`, why: T('l5.why.rateOffTheRule') },
          { latex: `m = ${ratio(-1, q)}`, why: T('l5.why.turnOverAndChangeSign') },
        ],
        distractors: [
          { v: frac(1, q), m: 'turned-over-only' },
          { v: String(-q), m: 'sign-flipped-only' },
          { v: String(q), m: 'given-line-copied-whole' },
          { v: String(b), m: 'rate-and-start-swapped' },
          { v: frac(-1, b), m: 'rate-and-start-swapped' },
          { v: String(0), m: 'flat-and-upright-swapped' },
          { v: frac(-1, q - 1), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// inequality-two-var  —  a lean in two letters names a region
//
// NO REGION IS SHADED, because this unit draws nothing. The item prints the
// boundary as readings, and then says of exactly two readings whether they
// belong to the region: one ON the boundary, which settles whether the
// boundary itself is in, and one OFF it, which settles the side. Those two
// facts pin the statement down exactly, and `halfPlane` re-derives both off
// the printed table.
//
// THE STATEMENT IS `\in R`, AND THE STEM NAMES R — "R is the region." (the
// key `l5.ask.whichRegion`, in all three languages). This form used to
// print four glyphs — `+` in, `-` out, a filled circle included, an open
// circle excluded — in a third column whose header was literally `{}`, and
// defended them in this comment as "the convention". They were the whole of
// the answer and the card defined none of them; three of the four options on
// every one of these cards differ ONLY in the relation those glyphs decide, so
// a cadet who had not been told the convention could not answer at all. One
// statement replaces all four, it is the same statement in both roles, and the
// role is decided by geometry a learner can see: the readings that carry no
// statement are the ones that fit a straight line.
// ===========================================================================

const inequalityTwoVar = [
  {
    id: 'iv-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const m = fromNz(r, RATE, d);
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const strict = r() < 0.5;
      const above = r() < 0.5;
      const gapSize = int(r, 1, 3 + rung(d));
      const xs = [x0, x0 + 1, x0 + 2];
      const boundary = xs.map((x) => [x, m * x + b]);
      const tx = x0 + int(r, 0, 2);
      const ty = m * tx + b + (above ? gapSize : -gapSize);
      const inside = r() < 0.5;
      const regionIsAbove = inside ? above : !above;
      const rel = regionIsAbove ? (strict ? '>' : '\\ge') : (strict ? '<' : '\\le');
      const ans = `y ${rel} ${lineTex(m, b).slice(4)}`;
      if (boundary.some(([, y]) => Math.abs(y) > 240) || Math.abs(ty) > 260) {
        throw new Error('retry: past a reading a cadet can hold');
      }
      const marked = int(r, 0, 2);
      const rows = boundary.map(([x, y], i) => [x, y, i === marked ? (strict ? IN_OUT.out : IN_OUT.in) : '{}']);
      rows.push([tx, ty, inside ? IN_OUT.in : IN_OUT.out]);
      return {
        stem: T('l5.ask.whichRegion'),
        latex: asks(tblMark('x', 'y', rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'halfPlane', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(m, b), why: T('l5.why.boundaryFromReadings') },
          { latex: ans, why: inside ? T('l5.why.readingOffTheLineIsIn') : T('l5.why.readingOffTheLineIsOut') },
        ],
        distractors: [
          { v: `y ${regionIsAbove ? (strict ? '\\ge' : '>') : (strict ? '\\le' : '<')} ${lineTex(m, b).slice(4)}`, m: 'boundary-strictness-ignored' },
          { v: `y ${regionIsAbove ? (strict ? '<' : '\\le') : (strict ? '>' : '\\ge')} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(-m, b).slice(4)}`, m: 'lean-not-turned-after-dividing' },
          { v: `y ${rel} ${lineTex(m, -b).slice(4)}`, m: 'test-reading-substituted-backwards' },
          { v: lineTex(m, b), m: 'equation-given-instead-of-a-lean' },
          { v: `y ${rel} ${lineTex(b, m).slice(4)}`, m: 'test-reading-substituted-backwards' },
          { v: `y ${rel} ${lineTex(m, b + 1).slice(4)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'iv-strict', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const m = fromNz(r, RATE, d);
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const above = r() < 0.5;
      const boundary = [x0, x0 + 1, x0 + 2, x0 + 3].map((x) => [x, m * x + b]);
      const tx = x0 + int(r, 0, 3);
      const ty = m * tx + b + (above ? 1 : -1) * int(r, 1, 2 + rung(d));
      const rel = above ? '>' : '<';
      const ans = `y ${rel} ${lineTex(m, b).slice(4)}`;
      if (boundary.some(([, y]) => Math.abs(y) > 240) || Math.abs(ty) > 260) {
        throw new Error('retry: past a reading a cadet can hold');
      }
      const marked = int(r, 0, 3);
      const rows = boundary.map(([x, y], i) => [x, y, i === marked ? IN_OUT.out : '{}']);
      rows.push([tx, ty, IN_OUT.in]);
      return {
        stem: T('l5.ask.whichRegion'),
        latex: asks(tblMark('x', 'y', rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'halfPlane', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(m, b), why: T('l5.why.boundaryFromReadings') },
          { latex: ans, why: T('l5.why.boundaryLeftOutOfR') },
        ],
        distractors: [
          { v: `y ${above ? '\\ge' : '\\le'} ${lineTex(m, b).slice(4)}`, m: 'boundary-strictness-ignored' },
          { v: `y ${above ? '<' : '>'} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(-m, b).slice(4)}`, m: 'lean-not-turned-after-dividing' },
          { v: `y ${rel} ${lineTex(m, -b).slice(4)}`, m: 'test-reading-substituted-backwards' },
          { v: lineTex(m, b), m: 'equation-given-instead-of-a-lean' },
          { v: `y ${above ? '\\le' : '\\ge'} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(m, b - 1).slice(4)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'iv-closed', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const m = fromNz(r, RATE, d);
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const above = r() < 0.5;
      const boundary = [x0, x0 + 1, x0 + 2].map((x) => [x, m * x + b]);
      const tx = x0 + int(r, 0, 2);
      const ty = m * tx + b + (above ? 1 : -1) * int(r, 1, 2 + rung(d));
      // The marked reading is OUTSIDE, so the region is on the other side.
      const rel = above ? '\\le' : '\\ge';
      const ans = `y ${rel} ${lineTex(m, b).slice(4)}`;
      if (boundary.some(([, y]) => Math.abs(y) > 240) || Math.abs(ty) > 260) {
        throw new Error('retry: past a reading a cadet can hold');
      }
      const marked = int(r, 0, 2);
      const rows = boundary.map(([x, y], i) => [x, y, i === marked ? IN_OUT.in : '{}']);
      rows.push([tx, ty, IN_OUT.out]);
      return {
        stem: T('l5.ask.whichRegion'),
        latex: asks(tblMark('x', 'y', rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'halfPlane', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(m, b), why: T('l5.why.boundaryFromReadings') },
          { latex: ans, why: T('l5.why.readingOffTheLineIsOut') },
        ],
        distractors: [
          { v: `y ${above ? '<' : '>'} ${lineTex(m, b).slice(4)}`, m: 'boundary-strictness-ignored' },
          { v: `y ${above ? '\\ge' : '\\le'} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(-m, b).slice(4)}`, m: 'lean-not-turned-after-dividing' },
          { v: `y ${rel} ${lineTex(m, -b).slice(4)}`, m: 'test-reading-substituted-backwards' },
          { v: lineTex(m, b), m: 'equation-given-instead-of-a-lean' },
          { v: `y ${above ? '>' : '<'} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(m, b + 1).slice(4)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'iv-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, REGIONS);
      const m = fromNz(r, RATE, d);
      const b = from(r, [[2, 8], [3, 12], [4, 18], [5, 24], [6, 30]], d);
      const x0 = int(r, 0, 2 + rung(d));
      const strict = r() < 0.5;
      const above = r() < 0.5;
      const boundary = [x0, x0 + 1, x0 + 2].map((x) => [x, m * x + b]);
      const tx = x0 + int(r, 0, 2);
      const ty = m * tx + b + (above ? 1 : -1) * int(r, 1, 3 + rung(d));
      const rel = above ? (strict ? '>' : '\\ge') : (strict ? '<' : '\\le');
      const ans = `y ${rel} ${lineTex(m, b).slice(4)}`;
      if (boundary.some(([, y]) => Math.abs(y) > 240) || Math.abs(ty) > 260) {
        throw new Error('retry: past a reading a cadet can hold');
      }
      allAbove(0, boundary.map(([, y]) => y), ty, boundary.map(([x]) => x).concat(tx));
      const marked = int(r, 0, 2);
      const rows = boundary.map(([x, y], i) => [x, y, i === marked ? (strict ? IN_OUT.out : IN_OUT.in) : '{}']);
      rows.push([tx, ty, IN_OUT.in]);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.whichRegion')}`,
        latex: asks(tblMark('x', 'y', rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'halfPlane', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(m, b), why: T('l5.why.boundaryFromReadings') },
          { latex: ans, why: T('l5.why.testTheReadingOffTheLine') },
        ],
        distractors: [
          { v: `y ${above ? (strict ? '\\ge' : '>') : (strict ? '\\le' : '<')} ${lineTex(m, b).slice(4)}`, m: 'boundary-strictness-ignored' },
          { v: `y ${above ? (strict ? '<' : '\\le') : (strict ? '>' : '\\ge')} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(-m, b).slice(4)}`, m: 'lean-not-turned-after-dividing' },
          { v: `y ${rel} ${lineTex(m, -b).slice(4)}`, m: 'test-reading-substituted-backwards' },
          { v: lineTex(m, b), m: 'equation-given-instead-of-a-lean' },
          { v: `y ${rel} ${lineTex(b, m).slice(4)}`, m: 'test-reading-substituted-backwards' },
          { v: `y ${rel} ${lineTex(m, b + 1).slice(4)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'iv-flat', rep: 'verbal', dMin: 3, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, REGIONS);
      const m = fromNz(r, RATE, d);
      const b = fromNz(r, INTERCEPT, d);
      const x0 = fromNz(r, ATX, d);
      const strict = r() < 0.5;
      const boundary = [x0, x0 + 1, x0 + 2, x0 + 3].map((x) => [x, m * x + b]);
      const tx = x0 + int(r, 0, 3);
      const gapSize = int(r, 2, 4 + rung(d));
      const ty = m * tx + b - gapSize;
      const rel = strict ? '<' : '\\le';
      const ans = `y ${rel} ${lineTex(m, b).slice(4)}`;
      if (boundary.some(([, y]) => Math.abs(y) > 240) || Math.abs(ty) > 260) {
        throw new Error('retry: past a reading a cadet can hold');
      }
      const marked = int(r, 0, 3);
      const rows = boundary.map(([x, y], i) => [x, y, i === marked ? (strict ? IN_OUT.out : IN_OUT.in) : '{}']);
      rows.push([tx, ty, IN_OUT.in]);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.whichRegion')}`,
        latex: asks(tblMark('x', 'y', rows)),
        type: 'expression',
        answer: ans,
        check: { kind: 'halfPlane', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(m, b), why: T('l5.why.boundaryFromReadings') },
          { latex: ans, why: strict ? T('l5.why.boundaryLeftOutOfR') : T('l5.why.boundaryKeptInR') },
        ],
        distractors: [
          { v: `y ${strict ? '\\le' : '<'} ${lineTex(m, b).slice(4)}`, m: 'boundary-strictness-ignored' },
          { v: `y ${strict ? '>' : '\\ge'} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(-m, b).slice(4)}`, m: 'lean-not-turned-after-dividing' },
          { v: `y ${rel} ${lineTex(m, -b).slice(4)}`, m: 'test-reading-substituted-backwards' },
          { v: lineTex(m, b), m: 'equation-given-instead-of-a-lean' },
          { v: `y ${strict ? '\\ge' : '>'} ${lineTex(m, b).slice(4)}`, m: 'side-chosen-from-the-rate' },
          { v: `y ${rel} ${lineTex(m, b - 1).slice(4)}`, m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// write-system  —  two statements about one pair of unknowns
//
// The existing `system` kind proves a SOLUTION. It cannot prove that a written
// pair describes two sets of readings, so `systemWrite` fits BOTH printed
// tables exactly, refuses a pair of tables that fit the same line, and matches
// the learner's two rules against the two fits in either order.
// ===========================================================================

/** Two straight rules that really do meet, and the readings each one gives. */
function drawTwoRules(r, d) {
  const cx = from(r, CROSSX, d);
  const cy = fromNz(r, CROSSY, d);
  const m1 = fromNz(r, RATE, d);
  const m2 = fromNz(r, RATE, d);
  if (m1 === m2) throw new Error('retry: the two rules never meet');
  const b1 = cy - m1 * cx;
  const b2 = cy - m2 * cx;
  if (b1 === b2) throw new Error('retry: both rules start together');
  if (b1 === 0 || b2 === 0) throw new Error('retry: a rule that starts at zero hides its constant');
  if (Math.abs(b1) > 120 || Math.abs(b2) > 120) throw new Error('retry: past a reading a cadet can hold');
  if (!distinct(m1, m2, b1, b2)) throw new Error('retry: repeated number');
  return { m1, m2, b1, b2, cx, cy };
}

const writeSystem = [
  {
    id: 'ws-tables', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoRules(r, d);
      const step = int(r, 1, 1 + rung(d));
      const x0 = int(r, 0, 2 + rung(d));
      const rowsA = [0, 1, 2].map((i) => { const x = x0 + i * step; return [x, g.m1 * x + g.b1]; });
      const rowsB = [0, 1, 2].map((i) => { const x = x0 + i * step; return [x, g.m2 * x + g.b2]; });
      if ([...rowsA, ...rowsB].some(([, y]) => Math.abs(y) > 300)) throw new Error('retry: past a reading a cadet can hold');
      const ans = `${lineTex(g.m1, g.b1)}, ${lineTex(g.m2, g.b2)}`;
      return {
        stem: T('l5.ask.writeThePair'),
        latex: asks(beside(tbl('x', 'y', rowsA), tbl('x', 'y', rowsB))),
        type: 'expression',
        answer: ans,
        check: { kind: 'systemWrite', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(g.m1, g.b1), why: T('l5.why.ruleFromEachTable') },
          { latex: lineTex(g.m2, g.b2), why: T('l5.why.twoRulesTwoUnknowns') },
        ],
        distractors: [
          { v: lineTex(g.m1 + g.m2, g.b1 + g.b2), m: 'two-conditions-merged' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(2 * g.m1, 2 * g.b1)}`, m: 'same-line-twice' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(g.m1, g.b1)}`, m: 'same-line-twice' },
          { v: `${lineTex(g.m1, g.b2)}, ${lineTex(g.m2, g.b1)}`, m: 'letters-redefined-between-rows' },
          { v: `${lineTex(g.b1, g.m1)}, ${lineTex(g.b2, g.m2)}`, m: 'counts-added-to-values' },
          { v: pointTex(g.cx, g.cy), m: 'solved-instead-of-written' },
          { v: `${lineTex(g.m1, g.b1 + 1)}, ${lineTex(g.m2, g.b2)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'ws-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, TWOLOGS);
      const g = drawTwoRules(r, d);
      const x0 = int(r, 0, 2 + rung(d));
      const rowsA = [0, 1, 2].map((i) => { const x = x0 + i; return [x, g.m1 * x + g.b1]; });
      const rowsB = [0, 1, 2].map((i) => { const x = x0 + i; return [x, g.m2 * x + g.b2]; });
      if ([...rowsA, ...rowsB].some(([, y]) => Math.abs(y) > 300)) throw new Error('retry: past a reading a cadet can hold');
      allAbove(0, g.b1, g.b2, g.cy, [...rowsA, ...rowsB].map(([, y]) => y));
      const ans = `${lineTex(g.m1, g.b1)}, ${lineTex(g.m2, g.b2)}`;
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.writeThePair')}`,
        latex: asks(beside(tbl('x', 'y', rowsA), tbl('x', 'y', rowsB))),
        type: 'expression',
        answer: ans,
        check: { kind: 'systemWrite', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(g.m1, g.b1), why: T('l5.why.ruleFromEachTable') },
          { latex: lineTex(g.m2, g.b2), why: T('l5.why.twoRulesTwoUnknowns') },
        ],
        distractors: [
          { v: lineTex(g.m1 + g.m2, g.b1 + g.b2), m: 'two-conditions-merged' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(2 * g.m1, 2 * g.b1)}`, m: 'same-line-twice' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(g.m1, g.b2)}`, m: 'letters-redefined-between-rows' },
          { v: `${lineTex(g.b1, g.m1)}, ${lineTex(g.b2, g.m2)}`, m: 'counts-added-to-values' },
          { v: pointTex(g.cx, g.cy), m: 'solved-instead-of-written' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(g.m2, g.b2 + 1)}`, m: 'arith-slip' },
          { v: `${lineTex(g.m2, g.b2)}, ${lineTex(g.m2, g.b2)}`, m: 'same-line-twice' },
        ],
      };
    },
  },
  {
    id: 'ws-wide', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoRules(r, d);
      const x0 = int(r, 0, 2 + rung(d));
      const rowsA = [0, 1, 2, 3].map((i) => { const x = x0 + i; return [x, g.m1 * x + g.b1]; });
      const rowsB = [0, 1, 2, 3].map((i) => { const x = x0 + i; return [x, g.m2 * x + g.b2]; });
      if ([...rowsA, ...rowsB].some(([, y]) => Math.abs(y) > 300)) throw new Error('retry: past a reading a cadet can hold');
      const ans = `${lineTex(g.m1, g.b1)}, ${lineTex(g.m2, g.b2)}`;
      return {
        stem: T('l5.ask.writeThePair'),
        latex: asks(beside(tbl('x', 'y', rowsA), tbl('x', 'y', rowsB))),
        type: 'expression',
        answer: ans,
        check: { kind: 'systemWrite', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(g.m1, g.b1), why: T('l5.why.ruleFromEachTable') },
          { latex: lineTex(g.m2, g.b2), why: T('l5.why.twoRulesTwoUnknowns') },
        ],
        distractors: [
          { v: lineTex(g.m1 + g.m2, g.b1 + g.b2), m: 'two-conditions-merged' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(3 * g.m1, 3 * g.b1)}`, m: 'same-line-twice' },
          { v: `${lineTex(g.m1, g.b2)}, ${lineTex(g.m2, g.b1)}`, m: 'letters-redefined-between-rows' },
          { v: `${lineTex(g.b1, g.m1)}, ${lineTex(g.b2, g.m2)}`, m: 'counts-added-to-values' },
          { v: pointTex(g.cx, g.cy), m: 'solved-instead-of-written' },
          { v: `${lineTex(g.m1, g.b1 - 1)}, ${lineTex(g.m2, g.b2)}`, m: 'arith-slip' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(g.m1, g.b1)}`, m: 'same-line-twice' },
        ],
      };
    },
  },
  {
    id: 'ws-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_MEET);
      const g = drawTwoRules(r, d);
      const x0 = int(r, 0, 2 + rung(d));
      const rowsA = [0, 1, 2].map((i) => { const x = x0 + i; return [x, g.m1 * x + g.b1]; });
      const rowsB = [0, 1, 2].map((i) => { const x = x0 + i; return [x, g.m2 * x + g.b2]; });
      if ([...rowsA, ...rowsB].some(([, y]) => Math.abs(y) > 300)) throw new Error('retry: past a reading a cadet can hold');
      const ans = `${lineTex(g.m1, g.b1)}, ${lineTex(g.m2, g.b2)}`;
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.writeThePair')}`,
        latex: asks(beside(tbl('x', 'y', rowsA), tbl('x', 'y', rowsB))),
        type: 'expression',
        answer: ans,
        check: { kind: 'systemWrite', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(g.m1, g.b1), why: T('l5.why.ruleFromEachTable') },
          { latex: lineTex(g.m2, g.b2), why: T('l5.why.checkInBoth') },
        ],
        distractors: [
          { v: lineTex(g.m1 + g.m2, g.b1 + g.b2), m: 'two-conditions-merged' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(2 * g.m1, 2 * g.b1)}`, m: 'same-line-twice' },
          { v: `${lineTex(g.m1, g.b2)}, ${lineTex(g.m2, g.b1)}`, m: 'letters-redefined-between-rows' },
          { v: `${lineTex(g.b1, g.m1)}, ${lineTex(g.b2, g.m2)}`, m: 'counts-added-to-values' },
          { v: pointTex(g.cx, g.cy), m: 'solved-instead-of-written' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(g.m2 + 1, g.b2)}`, m: 'arith-slip' },
          { v: `${lineTex(g.m2, g.b2)}, ${lineTex(g.m2, g.b2)}`, m: 'same-line-twice' },
        ],
      };
    },
  },
  {
    id: 'ws-mixed', rep: 'table', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoRules(r, d);
      const x0 = int(r, 0, 2 + rung(d));
      const stepA = int(r, 1, 1 + rung(d));
      const rowsA = [0, 1, 2].map((i) => { const x = x0 + i * stepA; return [x, g.m1 * x + g.b1]; });
      const rowsB = [0, 1, 2, 3].map((i) => { const x = x0 + i; return [x, g.m2 * x + g.b2]; });
      if ([...rowsA, ...rowsB].some(([, y]) => Math.abs(y) > 300)) throw new Error('retry: past a reading a cadet can hold');
      const ans = `${lineTex(g.m1, g.b1)}, ${lineTex(g.m2, g.b2)}`;
      return {
        stem: T('l5.ask.writeThePair'),
        latex: asks(beside(tbl('x', 'y', rowsA), tbl('x', 'y', rowsB))),
        type: 'expression',
        answer: ans,
        check: { kind: 'systemWrite', vars: ['x', 'y'] },
        steps: [
          { latex: lineTex(g.m1, g.b1), why: T('l5.why.ruleFromEachTable') },
          { latex: lineTex(g.m2, g.b2), why: T('l5.why.twoRulesTwoUnknowns') },
        ],
        distractors: [
          { v: lineTex(g.m1 + g.m2, g.b1 + g.b2), m: 'two-conditions-merged' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(2 * g.m1, 2 * g.b1)}`, m: 'same-line-twice' },
          { v: `${lineTex(g.m1, g.b2)}, ${lineTex(g.m2, g.b1)}`, m: 'letters-redefined-between-rows' },
          { v: `${lineTex(g.b1, g.m1)}, ${lineTex(g.b2, g.m2)}`, m: 'counts-added-to-values' },
          { v: pointTex(g.cx, g.cy), m: 'solved-instead-of-written' },
          { v: `${lineTex(g.m1, g.b1 + 1)}, ${lineTex(g.m2, g.b2)}`, m: 'arith-slip' },
          { v: `${lineTex(g.m1, g.b1)}, ${lineTex(g.m1, g.b1)}`, m: 'same-line-twice' },
        ],
      };
    },
  },
];

// ===========================================================================
// system-graphically  —  where two rules agree
//
// The two rules are printed and each one's own readings are printed beside it,
// so the crossing is a row that appears in BOTH tables. That is the tabular
// stand-in for two traces meeting, and the unit's alignment says in writing
// that no trace is drawn. `system` re-solves the printed pair by Cramer's rule
// and refuses a pair that does not meet at one point.
// ===========================================================================

const systemGraphically = [
  {
    id: 'sg-pair', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoRules(r, d);
      const e1 = lineTex(g.m1, g.b1);
      const e2 = lineTex(g.m2, g.b2);
      return {
        stem: T('l5.ask.whereTheyMeet'),
        latex: asks(stacked(e1, e2)),
        type: 'expression',
        answer: pointTex(g.cx, g.cy),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'pair' },
        steps: [
          { latex: `${coefOf(g.m1, 'x')} ${sgn(g.b1)} = ${coefOf(g.m2, 'x')} ${sgn(g.b2)}`, why: T('l5.why.setThemEqual') },
          { latex: `x = ${g.cx}`, why: T('l5.why.solveForTheInput') },
        ],
        distractors: [
          { v: pointTex(g.cy, g.cx), m: 'crossing-coordinates-swapped' },
          { v: pointTex(0, g.b1), m: 'one-trace-followed' },
          { v: pointTex(0, g.b2), m: 'one-trace-followed' },
          { v: pointTex(g.cx + 1, g.cy), m: 'nearest-grid-line-taken' },
          { v: pointTex(g.cx, g.cy + 1), m: 'nearest-grid-line-taken' },
          { v: pointTex(g.cx, g.m2 * g.cx + g.b1), m: 'checked-in-one-statement-only' },
          { v: pointTex(g.b1, g.b2), m: 'one-trace-followed' },
        ],
      };
    },
  },
  {
    id: 'sg-tables', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoRules(r, d);
      const lo = g.cx - int(r, 1, 2);
      const rowsA = [0, 1, 2, 3].map((i) => { const x = lo + i; return [x, g.m1 * x + g.b1]; });
      const rowsB = [0, 1, 2, 3].map((i) => { const x = lo + i; return [x, g.m2 * x + g.b2]; });
      if ([...rowsA, ...rowsB].some(([, y]) => Math.abs(y) > 300)) throw new Error('retry: past a reading a cadet can hold');
      const e1 = lineTex(g.m1, g.b1);
      const e2 = lineTex(g.m2, g.b2);
      return {
        stem: T('l5.ask.whereTheyMeet'),
        latex: asks(`${stacked(e1, e2)} \\quad ${beside(tbl('x', 'y', rowsA), tbl('x', 'y', rowsB))}`),
        type: 'expression',
        answer: pointTex(g.cx, g.cy),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'pair' },
        steps: [
          { latex: `x = ${g.cx}`, why: T('l5.why.readTheSharedRow') },
          { latex: `y = ${g.cy}`, why: T('l5.why.checkInBoth') },
        ],
        distractors: [
          { v: pointTex(g.cy, g.cx), m: 'crossing-coordinates-swapped' },
          { v: pointTex(rowsA[0][0], rowsA[0][1]), m: 'one-trace-followed' },
          { v: pointTex(rowsB[0][0], rowsB[0][1]), m: 'one-trace-followed' },
          { v: pointTex(g.cx + 1, g.cy), m: 'nearest-grid-line-taken' },
          { v: pointTex(g.cx, g.cy + 1), m: 'nearest-grid-line-taken' },
          { v: pointTex(g.cx, g.m2 * g.cx + g.b1), m: 'checked-in-one-statement-only' },
          { v: pointTex(0, g.b1), m: 'one-trace-followed' },
        ],
      };
    },
  },
  {
    id: 'sg-input', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoRules(r, d);
      const e1 = lineTex(g.m1, g.b1);
      const e2 = lineTex(g.m2, g.b2);
      return {
        stem: T('l5.ask.inputAtCrossing'),
        latex: stacked(e1, e2),
        type: 'numeric',
        answer: String(g.cx),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${coefOf(g.m1, 'x')} ${sgn(g.b1)} = ${coefOf(g.m2, 'x')} ${sgn(g.b2)}`, why: T('l5.why.setThemEqual') },
          { latex: `x = ${g.cx}`, why: T('l5.why.solveForTheInput') },
        ],
        distractors: [
          { v: String(g.cy), m: 'crossing-coordinates-swapped' },
          { v: String(g.b1), m: 'one-trace-followed' },
          { v: String(g.b2), m: 'one-trace-followed' },
          { v: String(g.cx + 1), m: 'nearest-grid-line-taken' },
          { v: String(g.cx - 1), m: 'nearest-grid-line-taken' },
          { v: String(g.b1 + g.b2), m: 'checked-in-one-statement-only' },
          { v: String(-g.cx), m: 'crossing-invented-for-parallel-traces' },
        ],
      };
    },
  },
  {
    id: 'sg-output', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoRules(r, d);
      const e1 = lineTex(g.m1, g.b1);
      const e2 = lineTex(g.m2, g.b2);
      return {
        stem: T('l5.ask.outputAtCrossing'),
        latex: stacked(e1, e2),
        type: 'numeric',
        answer: String(g.cy),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'y' },
        steps: [
          { latex: `x = ${g.cx}`, why: T('l5.why.solveForTheInput') },
          { latex: `y = ${g.cy}`, why: T('l5.why.putItBackInEither') },
        ],
        distractors: [
          { v: String(g.cx), m: 'crossing-coordinates-swapped' },
          { v: String(g.b1), m: 'one-trace-followed' },
          { v: String(g.b2), m: 'one-trace-followed' },
          { v: String(g.cy + 1), m: 'nearest-grid-line-taken' },
          { v: String(g.cy - 1), m: 'nearest-grid-line-taken' },
          { v: String(g.m2 * g.cx + g.b1), m: 'checked-in-one-statement-only' },
          { v: String(-g.cy), m: 'crossing-invented-for-parallel-traces' },
        ],
      };
    },
  },
  {
    id: 'sg-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, MEETINGS);
      const g = drawTwoRules(r, d);
      allAbove(0, g.b1, g.b2, g.cx, g.cy);
      const e1 = lineTex(g.m1, g.b1);
      const e2 = lineTex(g.m2, g.b2);
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.inputAtCrossing')}`,
        latex: stacked(e1, e2),
        type: 'numeric',
        answer: String(g.cx),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${coefOf(g.m1, 'x')} ${sgn(g.b1)} = ${coefOf(g.m2, 'x')} ${sgn(g.b2)}`, why: T('l5.why.setThemEqual') },
          { latex: `x = ${g.cx}`, why: T('l5.why.solveForTheInput') },
        ],
        distractors: [
          { v: String(g.cy), m: 'crossing-coordinates-swapped' },
          { v: String(g.b1), m: 'one-trace-followed' },
          { v: String(g.b2), m: 'one-trace-followed' },
          { v: String(g.cx + 1), m: 'nearest-grid-line-taken' },
          { v: String(g.cx - 1), m: 'nearest-grid-line-taken' },
          { v: String(g.b1 + g.b2), m: 'checked-in-one-statement-only' },
          { v: String(g.b2 - g.b1), m: 'checked-in-one-statement-only' },
        ],
      };
    },
  },
];

// ===========================================================================
// scatter-regression  —  the one line closest to every reading at once
//
// THE READINGS DO NOT SIT ON A LINE, and that is the whole idea of the node.
// `regression` solves the normal equations by Cramer's rule over the printed
// readings, in exact rationals, so the fitted rate is a fact about the table
// and not a number this file kept to one side.
//
// The draw uses that on purpose. A residual pattern whose sum is zero AND
// whose sum against the inputs is zero leaves the least-squares fit exactly on
// the line it was built from — so the answers are whole numbers a cadet can
// hold, while the readings are genuinely scattered. The checker never learns
// which line that was: it fits the table.
// ===========================================================================

/**
 * Residual patterns for five and six readings.
 *
 * Each list adds to zero, and each one adds to zero again when weighted by the
 * distance of its input from the mean input. Those two conditions are exactly
 * the normal equations, so the closest line through the scattered readings is
 * the line the readings were built from — provably, not approximately.
 */
const SCATTER5 = [
  [1, -2, 2, -2, 1],
  [1, -1, 0, -1, 1],
  [0, 1, -2, 1, 0],
  [1, 0, -2, 0, 1],
  [-1, 2, 0, -2, 1],
  [2, -1, -2, -1, 2],
  [-2, 1, 2, 1, -2],
];
const SCATTER6 = [
  [1, -1, 0, 0, -1, 1],
  [0, 1, -1, -1, 1, 0],
  [2, -1, -1, -1, -1, 2],
  [-2, 1, 1, 1, 1, -2],
];

/** A scattered data table whose exact closest line is `y = M x + B`. */
function drawScatter(r, d, { rows = 5, wobble = 1 } = {}) {
  const M = fromNz(r, RATE, d);
  const B = fromNz(r, DATUM, d);
  const x0 = int(r, 1, 1 + rung(d));
  const pat = pick(r, rows === 6 ? SCATTER6 : SCATTER5);
  const k = wobble;
  const xs = [];
  for (let i = 0; i < rows; i++) xs.push(x0 + i);
  const table = xs.map((x, i) => [x, M * x + B + k * pat[i]]);
  if (table.some(([, y]) => Math.abs(y) > 400)) throw new Error('retry: past a reading a cadet can hold');
  if (table.some(([, y]) => y === 0)) throw new Error('retry: a reading of zero reads as a missing row');
  if (pat.every((e) => e === 0)) throw new Error('retry: these readings sit exactly on one line');
  return { M, B, xs, table, pat: pat.map((e) => k * e) };
}

/** Wrong readings of a fitted rate. */
function fitWrongs(g) {
  const first = g.table[0];
  const last = g.table[g.table.length - 1];
  const endRate = (last[1] - first[1]) / (last[0] - first[0]);
  const pairRate = g.table[1][1] - g.table[0][1];
  return [
    { v: frac(last[1] - first[1], last[0] - first[0]), m: 'first-and-last-joined' },
    { v: String(pairRate), m: 'rate-from-one-pair' },
    { v: String(g.M + 1), m: 'arith-slip' },
    { v: String(g.M - 1), m: 'arith-slip' },
    { v: String(-g.M), m: 'sign-flipped-only' },
    { v: String(first[1]), m: 'smallest-reading-called-the-start' },
    { v: String(Math.round(endRate) + 2), m: 'first-and-last-joined' },
  ];
}

const scatterRegression = [
  {
    id: 'sr-rate', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawScatter(r, d, { rows: 5, wobble: 1 + rung(d) % 2 });
      return {
        stem: T('l5.ask.fitRate'),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(g.M),
        check: { kind: 'regression', want: 'slope' },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.closestLineIdea') },
          { latex: `m = ${g.M}`, why: T('l5.why.rateFromAllReadings') },
        ],
        distractors: fitWrongs(g),
      };
    },
  },
  {
    id: 'sr-start', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawScatter(r, d, { rows: 5, wobble: 1 });
      return {
        stem: T('l5.ask.fitStart'),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(g.B),
        check: { kind: 'regression', want: 'intercept' },
        steps: [
          { latex: `m = ${g.M}`, why: T('l5.why.rateFromAllReadings') },
          { latex: lineTex(g.M, g.B), why: T('l5.why.closestLineIdea') },
        ],
        distractors: [
          { v: String(g.table[0][1]), m: 'smallest-reading-called-the-start' },
          { v: String(Math.min(...g.table.map(([, y]) => y))), m: 'smallest-reading-called-the-start' },
          { v: String(g.M), m: 'rate-from-one-pair' },
          { v: String(g.B + 1), m: 'arith-slip' },
          { v: String(g.B - 1), m: 'arith-slip' },
          { v: String(-g.B), m: 'sign-flipped-only' },
          { v: String(g.table[g.table.length - 1][1]), m: 'prediction-read-off-the-data' },
        ],
      };
    },
  },
  {
    id: 'sr-predict', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawScatter(r, d, { rows: 5, wobble: 1 });
      const at = g.xs[g.xs.length - 1] + int(r, 1, 2 + rung(d));
      const want = g.M * at + g.B;
      if (Math.abs(want) > 500) throw new Error('retry: past a reading a cadet can hold');
      return {
        stem: T('l5.ask.predictAt', { k: at }),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'regression', want: 'predict', at },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.closestLineIdea') },
          { latex: `${coefOf(g.M, '')}\\left(${at}\\right) ${sgn(g.B)} = ${want}`, why: T('l5.why.putTheInputIn', { k: at }) },
        ],
        distractors: [
          { v: String(g.table[g.table.length - 1][1]), m: 'prediction-read-off-the-data' },
          { v: String(g.M * at), m: 'smallest-reading-called-the-start' },
          { v: String(want + 1), m: 'arith-slip' },
          { v: String(want - 1), m: 'arith-slip' },
          { v: String(g.M * (at - 1) + g.B), m: 'prediction-read-off-the-data' },
          { v: String(at), m: 'rate-from-one-pair' },
          { v: String(g.B), m: 'smallest-reading-called-the-start' },
        ],
      };
    },
  },
  {
    id: 'sr-forecast', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SURVEYS);
      const g = drawScatter(r, d, { rows: 5, wobble: 1 });
      const at = g.xs[g.xs.length - 1] + int(r, 1, 2 + rung(d));
      const want = g.M * at + g.B;
      if (Math.abs(want) > 500) throw new Error('retry: past a reading a cadet can hold');
      allAbove(0, want, g.table.map(([, y]) => y));
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.predictAt', { k: at })}`,
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'regression', want: 'predict', at },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.noReadingIsExact') },
          { latex: `${coefOf(g.M, '')}\\left(${at}\\right) ${sgn(g.B)} = ${want}`, why: T('l5.why.predictIsNotMeasured') },
        ],
        distractors: [
          { v: String(g.table[g.table.length - 1][1]), m: 'prediction-read-off-the-data' },
          { v: String(g.M * at), m: 'smallest-reading-called-the-start' },
          { v: String(want + 1), m: 'arith-slip' },
          { v: String(want - 1), m: 'arith-slip' },
          { v: String(g.M * (at - 1) + g.B), m: 'prediction-read-off-the-data' },
          { v: String(g.B), m: 'smallest-reading-called-the-start' },
          { v: String(g.table[0][1]), m: 'prediction-stated-as-a-measurement' },
        ],
      };
    },
  },
  {
    id: 'sr-rule', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_FIT);
      const g = drawScatter(r, d, { rows: 6, wobble: 1 });
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.fitRate')}`,
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(g.M),
        check: { kind: 'regression', want: 'slope' },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.closestLineIdea') },
          { latex: `m = ${g.M}`, why: T('l5.why.rateFromAllReadings') },
        ],
        distractors: fitWrongs(g),
      };
    },
  },
];

// ===========================================================================
// residual-and-fit  —  the gap between a reading and the line
//
// A gap is the reading TAKE AWAY the line's value, in that order, and the
// order is the content: gaps that keep the same sign along a run say the
// straight rule is the wrong shape. `regression` returns exactly that
// difference, sign included, from a fit it worked out itself.
// ===========================================================================

const residualAndFit = [
  {
    id: 'rg-gap', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawScatter(r, d, { rows: 5, wobble: 1 + (d >= 4 ? 1 : 0) });
      const i = int(r, 0, g.xs.length - 1);
      if (g.pat[i] === 0) throw new Error('retry: a gap of zero teaches nothing here');
      const at = g.xs[i];
      const want = g.pat[i];
      return {
        stem: T('l5.ask.gapAt', { k: at }),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'regression', want: 'residual', at },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.closestLineIdea') },
          { latex: `${g.table[i][1]} - \\left(${g.M * at + g.B}\\right) = ${want}`, why: T('l5.why.gapIsReadingMinusLine') },
        ],
        distractors: [
          { v: String(-want), m: 'residual-sign-flipped' },
          { v: String(g.table[i][1]), m: 'single-largest-gap-used' },
          { v: String(g.M * at + g.B), m: 'residual-taken-at-the-wrong-row' },
          { v: String(want + 1), m: 'arith-slip' },
          { v: String(want - 1), m: 'arith-slip' },
          { v: String(g.pat[(i + 1) % g.pat.length]), m: 'residual-taken-at-the-wrong-row' },
        ],
      };
    },
  },
  {
    id: 'rg-curved', rep: 'table', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const g = drawScatter(r, d, { rows: 5, wobble: 2 });
      // A run of gaps on one side is what says the straight rule is wrong.
      const signs = g.pat.map((e) => Math.sign(e));
      if (!(signs[1] === signs[2] && signs[2] === signs[3] && signs[1] !== 0)) {
        throw new Error('retry: this pattern has no run of gaps on one side');
      }
      const i = int(r, 1, 3);
      const at = g.xs[i];
      const want = g.pat[i];
      return {
        stem: T('l5.ask.gapAt', { k: at }),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'regression', want: 'residual', at },
        steps: [
          { latex: `${g.table[i][1]} - \\left(${g.M * at + g.B}\\right) = ${want}`, why: T('l5.why.gapIsReadingMinusLine') },
          { latex: `${g.pat.map((e) => (e < 0 ? String(e) : `+${e}`)).join(' \\quad ')}`, why: T('l5.why.gapsAllOneSide') },
        ],
        distractors: [
          { v: String(-want), m: 'residual-sign-flipped' },
          { v: String(g.table[i][1]), m: 'single-largest-gap-used' },
          { v: String(g.M * at + g.B), m: 'residual-taken-at-the-wrong-row' },
          { v: String(want + 1), m: 'arith-slip' },
          { v: String(g.pat[0]), m: 'residual-taken-at-the-wrong-row' },
          { v: String(g.pat[4]), m: 'curved-data-kept-linear' },
        ],
      };
    },
  },
  {
    id: 'rg-line', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawScatter(r, d, { rows: 6, wobble: 1 });
      const i = int(r, 0, 5);
      if (g.pat[i] === 0) throw new Error('retry: a gap of zero teaches nothing here');
      const at = g.xs[i];
      const want = g.pat[i];
      return {
        stem: T('l5.ask.gapAt', { k: at }),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'regression', want: 'residual', at },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.rateFromAllReadings') },
          { latex: `${g.table[i][1]} - \\left(${g.M * at + g.B}\\right) = ${want}`, why: T('l5.why.signOfTheGap') },
        ],
        distractors: [
          { v: String(-want), m: 'residual-sign-flipped' },
          { v: String(g.M * at + g.B), m: 'residual-taken-at-the-wrong-row' },
          { v: String(g.table[i][1]), m: 'single-largest-gap-used' },
          { v: String(want + 1), m: 'arith-slip' },
          { v: String(want - 1), m: 'arith-slip' },
          { v: String(g.pat[(i + 2) % 6]), m: 'residual-taken-at-the-wrong-row' },
        ],
      };
    },
  },
  {
    id: 'rg-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SURVEYS);
      const g = drawScatter(r, d, { rows: 5, wobble: 1 });
      allAbove(0, g.table.map(([, y]) => y));
      const i = int(r, 0, 4);
      if (g.pat[i] === 0) throw new Error('retry: a gap of zero teaches nothing here');
      const at = g.xs[i];
      const want = g.pat[i];
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.gapAtShort', { k: at })}`,
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'regression', want: 'residual', at },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.closestLineIdea') },
          { latex: `${g.table[i][1]} - \\left(${g.M * at + g.B}\\right) = ${want}`, why: T('l5.why.gapIsReadingMinusLine') },
        ],
        distractors: [
          { v: String(-want), m: 'residual-sign-flipped' },
          { v: String(g.M * at + g.B), m: 'residual-taken-at-the-wrong-row' },
          { v: String(g.table[i][1]), m: 'single-largest-gap-used' },
          { v: String(want + 1), m: 'arith-slip' },
          { v: String(want - 1), m: 'arith-slip' },
          { v: String(g.pat[(i + 1) % 5]), m: 'residual-taken-at-the-wrong-row' },
        ],
      };
    },
  },
  {
    id: 'rg-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, D_FIT);
      const g = drawScatter(r, d, { rows: 5, wobble: 1 });
      const at = g.xs[g.xs.length - 1] + int(r, 1, 1 + rung(d));
      const want = g.M * at + g.B;
      if (Math.abs(want) > 500) throw new Error('retry: past a reading a cadet can hold');
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.predictAt', { k: at })}`,
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(want),
        check: { kind: 'regression', want: 'predict', at },
        steps: [
          { latex: lineTex(g.M, g.B), why: T('l5.why.closestLineIdea') },
          { latex: `${coefOf(g.M, '')}\\left(${at}\\right) ${sgn(g.B)} = ${want}`, why: T('l5.why.predictIsNotMeasured') },
        ],
        distractors: [
          { v: String(g.table[g.table.length - 1][1]), m: 'prediction-stated-as-a-measurement' },
          { v: String(want + 1), m: 'arith-slip' },
          { v: String(want - 1), m: 'arith-slip' },
          { v: String(g.M * at), m: 'single-largest-gap-used' },
          { v: String(g.M * (at - 1) + g.B), m: 'residual-taken-at-the-wrong-row' },
          { v: String(g.B), m: 'curved-data-kept-linear' },
          { v: String(g.table[0][1]), m: 'prediction-stated-as-a-measurement' },
        ],
      };
    },
  },
];

// ===========================================================================
// association-strength  —  which way two measurements go together
//
// WHAT THIS NODE DOES NOT DO. It never reports a correlation coefficient. The
// `correlation` check kind is exact and honest — it works with r squared and
// with the sign of r, and never takes a square root — but its three asks need
// either a localised verdict or a printed decimal, and this surface can carry
// neither. TEKS A.4(A) and CCSS S-ID.C.8 are NOT CLAIMED, in writing.
//
// What it does instead is exact and is still the idea: the SIGN of the fitted
// rate is the direction of the association, and a two-way frequency table
// splits one count against three different wholes. Both re-derive.
// ===========================================================================

/** A two-way frequency table with its own printed totals, and the whole grid. */
function drawTwoWay(r, d, { rows = 2, cols = 2 } = {}) {
  const body = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) row.push(from(r, CELL, d));
    body.push(row);
  }
  const grid = body.map((row) => [...row, row.reduce((a, b) => a + b, 0)]);
  const foot = [];
  for (let j = 0; j <= cols; j++) foot.push(body.reduce((a, row) => a + (j < cols ? row[j] : row.reduce((p, q) => p + q, 0)), 0));
  grid.push(foot);
  const grand = foot[cols];
  if (grand === 0) throw new Error('retry: a table with no readings in it');
  if (grid.some((row) => row.some((v) => v === 0))) throw new Error('retry: an empty cell reads as a missing row');
  return { body, grid, grand, rows, cols };
}

const COLNAMES = [['A', 'B'], ['P', 'Q'], ['S', 'T'], ['U', 'V']];
const ROWNAMES = [['G', 'H'], ['J', 'K'], ['M', 'N'], ['W', 'Z']];

const associationStrength = [
  {
    id: 'as-row', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoWay(r, d, { rows: 2, cols: 2 });
      const ri = int(r, 0, 1); const ci = int(r, 0, 1);
      const cols = pick(r, COLNAMES); const rws = pick(r, ROWNAMES);
      const num = g.body[ri][ci];
      const den = g.grid[ri][2];
      if (num === den) throw new Error('retry: a whole row in one cell is not a share');
      return {
        stem: T('l5.ask.shareOfRow'),
        latex: twoWayTex(cols, rws, g.grid, { row: ri, col: ci }),
        type: 'numeric',
        answer: frac(num, den),
        check: { kind: 'twoWayTable', want: 'conditionalRow', row: ri, col: ci },
        steps: [
          { latex: `\\frac{${num}}{${den}}`, why: T('l5.why.rowTotalIsTheWhole') },
          { latex: `\\frac{${num}}{${den}} = ${ratio(num, den)}`, why: T('l5.why.cellOverWhole') },
        ],
        distractors: [
          { v: frac(num, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: frac(num, g.grid[2][ci]), m: 'grand-total-used-as-the-row-total' },
          { v: frac(den, num), m: 'coefficient-and-rate-confused' },
          { v: frac(den, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: String(num), m: 'counted-not-checked' },
          { v: frac(num + 1, den), m: 'arith-slip' },
          { v: frac(g.body[1 - ri][ci], den), m: 'off-by-one-row' },
        ],
      };
    },
  },
  {
    id: 'as-col', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoWay(r, d, { rows: 2, cols: 2 });
      const ri = int(r, 0, 1); const ci = int(r, 0, 1);
      const cols = pick(r, COLNAMES); const rws = pick(r, ROWNAMES);
      const num = g.body[ri][ci];
      const den = g.grid[2][ci];
      if (num === den) throw new Error('retry: a whole column in one cell is not a share');
      return {
        stem: T('l5.ask.shareOfColumn'),
        latex: twoWayTex(cols, rws, g.grid, { row: ri, col: ci }),
        type: 'numeric',
        answer: frac(num, den),
        check: { kind: 'twoWayTable', want: 'conditionalCol', row: ri, col: ci },
        steps: [
          { latex: `\\frac{${num}}{${den}}`, why: T('l5.why.columnTotalIsTheWhole') },
          { latex: `\\frac{${num}}{${den}} = ${ratio(num, den)}`, why: T('l5.why.cellOverWhole') },
        ],
        distractors: [
          { v: frac(num, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: frac(num, g.grid[ri][2]), m: 'grand-total-used-as-the-row-total' },
          { v: frac(den, num), m: 'coefficient-and-rate-confused' },
          { v: frac(den, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: String(num), m: 'counted-not-checked' },
          { v: frac(num - 1, den), m: 'arith-slip' },
          { v: frac(g.body[1 - ri][ci], den), m: 'off-by-one-row' },
        ],
      };
    },
  },
  {
    id: 'as-joint', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoWay(r, d, { rows: 2, cols: 2 });
      const ri = int(r, 0, 1); const ci = int(r, 0, 1);
      const cols = pick(r, COLNAMES); const rws = pick(r, ROWNAMES);
      const num = g.body[ri][ci];
      return {
        // The cell this asks about is where the marked row meets the marked
        // column, and the stem says so. See `twoWayTex` for why the mark sits
        // on the two names rather than on the count.
        stem: T('l5.ask.shareOfAll'),
        latex: twoWayTex(cols, rws, g.grid, { row: ri, col: ci }),
        type: 'numeric',
        answer: frac(num, g.grand),
        check: { kind: 'twoWayTable', want: 'joint', row: ri, col: ci },
        steps: [
          { latex: `\\frac{${num}}{${g.grand}}`, why: T('l5.why.grandTotalIsTheWhole') },
          { latex: `\\frac{${num}}{${g.grand}} = ${ratio(num, g.grand)}`, why: T('l5.why.cellOverWhole') },
        ],
        distractors: [
          { v: frac(num, g.grid[ri][2]), m: 'grand-total-used-as-the-row-total' },
          { v: frac(num, g.grid[2][ci]), m: 'grand-total-used-as-the-row-total' },
          { v: frac(g.grand, num), m: 'coefficient-and-rate-confused' },
          { v: String(num), m: 'counted-not-checked' },
          { v: frac(g.grid[ri][2], g.grand), m: 'off-by-one-row' },
          { v: frac(num + 1, g.grand), m: 'arith-slip' },
          { v: frac(g.body[1 - ri][ci], g.grand), m: 'off-by-one-row' },
        ],
      };
    },
  },
  {
    id: 'as-audit', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, AUDITS);
      const g = drawTwoWay(r, d, { rows: 2, cols: 2 });
      const ri = int(r, 0, 1); const ci = int(r, 0, 1);
      const cols = pick(r, COLNAMES); const rws = pick(r, ROWNAMES);
      const num = g.body[ri][ci];
      const den = g.grid[ri][2];
      if (num === den) throw new Error('retry: a whole row in one cell is not a share');
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.shareOfRow')}`,
        latex: twoWayTex(cols, rws, g.grid, { row: ri, col: ci }),
        type: 'numeric',
        answer: frac(num, den),
        check: { kind: 'twoWayTable', want: 'conditionalRow', row: ri, col: ci },
        steps: [
          { latex: `\\frac{${num}}{${den}}`, why: T('l5.why.rowTotalIsTheWhole') },
          { latex: `\\frac{${num}}{${den}} = ${ratio(num, den)}`, why: T('l5.why.cellOverWhole') },
        ],
        distractors: [
          { v: frac(num, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: frac(num, g.grid[2][ci]), m: 'grand-total-used-as-the-row-total' },
          { v: frac(den, num), m: 'coefficient-and-rate-confused' },
          { v: frac(den, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: String(num), m: 'counted-not-checked' },
          { v: frac(num + 1, den), m: 'arith-slip' },
          { v: frac(g.body[1 - ri][ci], den), m: 'off-by-one-row' },
        ],
      };
    },
  },
  {
    id: 'as-direction', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, SURVEYS);
      const g = drawScatter(r, d, { rows: 5, wobble: 1 });
      allAbove(0, g.table.map(([, y]) => y));
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.fitRate')}`,
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(g.M),
        check: { kind: 'regression', want: 'slope' },
        steps: [
          { latex: `m = ${g.M}`, why: T('l5.why.rateFromAllReadings') },
          { latex: lineTex(g.M, g.B), why: g.M > 0 ? T('l5.why.riseTogetherIsPositive') : T('l5.why.fallAgainstIsNegative') },
        ],
        distractors: [
          { v: String(-g.M), m: 'sign-read-off-the-values' },
          { v: String(g.table[1][1] - g.table[0][1]), m: 'rate-from-one-pair' },
          { v: String(g.B), m: 'coefficient-and-rate-confused' },
          { v: String(g.M + 1), m: 'arith-slip' },
          { v: String(g.M - 1), m: 'arith-slip' },
          { v: String(Math.abs(g.M) + 4), m: 'strong-means-steep' },
          { v: String(0), m: 'no-pattern-called-negative' },
        ],
      };
    },
  },
  {
    id: 'as-wide', rep: 'table', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const g = drawTwoWay(r, d, { rows: 2, cols: 3 });
      const ri = int(r, 0, 1); const ci = int(r, 0, 2);
      const cols = ['A', 'B', 'C']; const rws = pick(r, ROWNAMES);
      const num = g.body[ri][ci];
      const den = g.grid[ri][3];
      if (num === den) throw new Error('retry: a whole row in one cell is not a share');
      return {
        stem: T('l5.ask.shareOfRow'),
        latex: twoWayTex(cols, rws, g.grid, { row: ri, col: ci }),
        type: 'numeric',
        answer: frac(num, den),
        check: { kind: 'twoWayTable', want: 'conditionalRow', row: ri, col: ci },
        steps: [
          { latex: `\\frac{${num}}{${den}}`, why: T('l5.why.rowTotalIsTheWhole') },
          { latex: `\\frac{${num}}{${den}} = ${ratio(num, den)}`, why: T('l5.why.cellOverWhole') },
        ],
        distractors: [
          { v: frac(num, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: frac(num, g.grid[2][ci]), m: 'grand-total-used-as-the-row-total' },
          { v: frac(den, num), m: 'coefficient-and-rate-confused' },
          { v: String(num), m: 'counted-not-checked' },
          { v: frac(g.body[1 - ri][ci], den), m: 'off-by-one-row' },
          { v: frac(num + 1, den), m: 'arith-slip' },
          { v: frac(den, g.grand), m: 'grand-total-used-as-the-row-total' },
        ],
      };
    },
  },
  {
    id: 'as-dispute', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T, sr }) {
      // D_FIT USED TO DRESS THIS — "Two cadets disagree about the closest line"
      // over a table of counts with no line anywhere on it, on 300 of 300
      // seeds and in all three languages. This is the only verbal form the
      // node has and `requiredReps` names verbal, so every cadet met it.
      const sc = scene(sr, D_SHARE);
      const g = drawTwoWay(r, d, { rows: 2, cols: 2 });
      const ri = int(r, 0, 1); const ci = int(r, 0, 1);
      const cols = pick(r, COLNAMES); const rws = pick(r, ROWNAMES);
      const num = g.body[ri][ci];
      const den = g.grid[ri][2];
      if (num === den) throw new Error('retry: a whole row in one cell is not a share');
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.shareOfRow')}`,
        latex: twoWayTex(cols, rws, g.grid, { row: ri, col: ci }),
        type: 'numeric',
        answer: frac(num, den),
        check: { kind: 'twoWayTable', want: 'conditionalRow', row: ri, col: ci },
        steps: [
          { latex: `\\frac{${num}}{${den}}`, why: T('l5.why.rowTotalIsTheWhole') },
          { latex: `\\frac{${num}}{${den}} = ${ratio(num, den)}`, why: T('l5.why.cellOverWhole') },
        ],
        distractors: [
          { v: frac(num, g.grand), m: 'grand-total-used-as-the-row-total' },
          { v: frac(num, g.grid[2][ci]), m: 'grand-total-used-as-the-row-total' },
          { v: frac(den, num), m: 'coefficient-and-rate-confused' },
          { v: String(num), m: 'counted-not-checked' },
          { v: frac(g.body[1 - ri][ci], den), m: 'off-by-one-row' },
          { v: frac(num - 1, den), m: 'arith-slip' },
          { v: frac(den, g.grand), m: 'grand-total-used-as-the-row-total' },
        ],
      };
    },
  },
];

// ===========================================================================
// exponential-model  —  a factor at every step, and the percent it hides
//
// `exponentialFit` refuses a table whose inputs are not consecutive and whose
// readings do not share ONE ratio, and it works the ratio and the value at
// input zero out itself. The percent is that ratio less one, times a hundred,
// in exact rationals — which is why a rise of seven percent is a factor of
// 1.07 and never 0.07.
// ===========================================================================

/**
 * Growth factors that give an exact whole percent, listed by band.
 *
 * THE BOTTOM NUMBER IS THE LADDER. A table of whole readings that share the
 * ratio p/q has to start at a multiple of q raised to the number of steps, so
 * a factor of eleven tenths puts a cadet in the thousands and a factor of two
 * keeps them under a hundred. Listing the pairs by band therefore moves the
 * size of every reading on screen, which is what `demandOf` measures.
 */
const FACTORS = [
  [[2, 1]],
  [[3, 1], [3, 2]],
  [[5, 4]],
  [[6, 5]],
  [[11, 10]],
];
/** Decay factors, the same way. */
const DECAYS_Q = [
  [[1, 2]],
  [[1, 2]],
  [[3, 4]],
  [[4, 5]],
  [[9, 10]],
];
/** How many whole copies of the bottom number a table starts from, by band. */
const COPIES = [[1, 3], [1, 3], [1, 2], [1, 2], [2, 3]];
/** How many readings a table can print before the numbers run away. */
const growthRows = (pd) => (pd >= 10 ? 3 : 4);

/**
 * A table of readings that really do share one ratio, all of them whole, and
 * whose first printed input is ONE — so the starting amount is never printed
 * and always has to be worked back to.
 */
function drawGrowth(r, d, { decay = false } = {}) {
  const [pn, pd] = pick(r, (decay ? DECAYS_Q : FACTORS)[rung(d)]);
  const rows = growthRows(pd);
  const c = from(r, COPIES, d);
  const startAtZero = c * pd ** rows;
  const table = [];
  for (let i = 1; i <= rows; i++) {
    const y = (startAtZero * pn ** i) / pd ** i;
    if (!Number.isInteger(y)) throw new Error('retry: a reading is not a whole number');
    table.push([i, y]);
  }
  if (table.some(([, y]) => Math.abs(y) > 200000 || y === 0)) throw new Error('retry: past a reading a cadet can read');
  if (!Number.isInteger(startAtZero)) throw new Error('retry: the start is not a whole number');
  return { pn, pd, table, startAtZero, percent: ((pn - pd) * 100) / pd };
}

/** `\left(\frac{4}{5}\right)^{x}` or `2^{x}` — the one spelling of a factor power. */
const factorPow = (pn, pd, v) => (pd === 1 ? `${pn}^{${v}}` : `\\left(\\frac{${pn}}{${pd}}\\right)^{${v}}`);

const exponentialModel = [
  {
    id: 'em-factor', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const decay = d >= 3 && r() < 0.4;
      const g = drawGrowth(r, d, { decay });
      return {
        stem: T('l5.ask.growthFactor'),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: frac(g.pn, g.pd),
        check: { kind: 'exponentialFit', form: 'factor', variable: 'x' },
        steps: [
          { latex: `\\frac{${g.table[1][1]}}{${g.table[0][1]}} = ${ratio(g.pn, g.pd)}`, why: T('l5.why.factorBetweenReadings') },
          { latex: `\\frac{${g.table[2][1]}}{${g.table[1][1]}} = ${ratio(g.pn, g.pd)}`, why: T('l5.why.startTimesFactorPower') },
        ],
        distractors: [
          { v: frac(g.pn - g.pd, g.pd), m: 'percent-used-as-the-factor' },
          { v: String(g.table[1][1] - g.table[0][1]), m: 'growth-is-linear' },
          { v: String(g.table[0][1]), m: 'growth-start-for-factor' },
          { v: frac(g.pd, g.pn), m: 'decay-factor-subtracted-from-one-twice' },
          { v: frac(g.pn + g.pd, g.pd), m: 'arith-slip' },
          { v: String(g.percent), m: 'percent-used-as-the-factor' },
          { v: frac(g.pn, g.pd + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'em-start', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawGrowth(r, d, { decay: d >= 4 && r() < 0.4 });
      if (!Number.isInteger(g.startAtZero)) throw new Error('retry: the start is not a whole number');
      return {
        stem: T('l5.ask.startAmount'),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(g.startAtZero),
        check: { kind: 'exponentialFit', form: 'start', variable: 'x' },
        // THE ECHO WALKS BACK TO THE INPUT THE QUESTION NAMES.
        // It used to end on a bare number with no working under it, which is
        // the one line an echo may not be. It now writes the rule and reads it
        // at zero, so the reason the start sits at $x = 0$ — a factor raised to
        // nothing is one — is on the page instead of assumed.
        steps: [
          { latex: `\\frac{${g.table[1][1]}}{${g.table[0][1]}} = ${ratio(g.pn, g.pd)}`, why: T('l5.why.factorBetweenReadings') },
          { latex: `y = ${g.startAtZero} \\cdot ${factorPow(g.pn, g.pd, 'x')}`, why: T('l5.why.startTimesFactorPower') },
          { latex: `${g.startAtZero} \\cdot ${factorPow(g.pn, g.pd, '0')} = ${g.startAtZero}`, why: T('l5.why.backToTheStart') },
        ],
        distractors: [
          { v: String(g.table[0][1]), m: 'step-count-off-by-one' },
          { v: String(g.table[1][1]), m: 'step-count-off-by-one' },
          { v: frac(g.pn, g.pd), m: 'growth-start-for-factor' },
          { v: String(g.startAtZero + 1), m: 'arith-slip' },
          { v: String(g.startAtZero - 1), m: 'arith-slip' },
          { v: String(g.table[0][1] - (g.table[1][1] - g.table[0][1])), m: 'growth-is-linear' },
          { v: String(g.percent), m: 'percent-used-as-the-factor' },
        ],
      };
    },
  },
  {
    id: 'em-percent', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawGrowth(r, d, { decay: false });
      if (!Number.isInteger(g.percent)) throw new Error('retry: this factor is not a whole percent');
      return {
        stem: T('l5.ask.percentEachStep'),
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: String(g.percent),
        check: { kind: 'exponentialFit', form: 'percent', variable: 'x' },
        steps: [
          { latex: `\\frac{${g.table[1][1]}}{${g.table[0][1]}} = ${ratio(g.pn, g.pd)}`, why: T('l5.why.factorBetweenReadings') },
          { latex: `\\left(${ratio(g.pn, g.pd)} - 1\\right) \\cdot 100 = ${g.percent}`, why: T('l5.why.percentFromFactor') },
        ],
        distractors: [
          { v: String(g.percent + 100), m: 'percent-used-as-the-factor' },
          { v: frac(g.pn, g.pd), m: 'growth-start-for-factor' },
          { v: String(100 - g.percent), m: 'decay-factor-subtracted-from-one-twice' },
          { v: String(g.table[1][1] - g.table[0][1]), m: 'growth-is-linear' },
          { v: String(g.percent + 1), m: 'arith-slip' },
          { v: String(g.percent - 1), m: 'arith-slip' },
          { v: String(-g.percent), m: 'decay-factor-subtracted-from-one-twice' },
        ],
      };
    },
  },
  {
    id: 'em-rule', rep: 'table', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const decay = d >= 4 && r() < 0.4;
      const g = drawGrowth(r, d, { decay });
      if (!Number.isInteger(g.startAtZero)) throw new Error('retry: the start is not a whole number');
      const head = g.startAtZero === 1 ? '' : `${g.startAtZero} \\cdot `;
      const ans = `${head}${factorPow(g.pn, g.pd, 'x')}`;
      return {
        stem: T('l5.ask.writeTheRule'),
        latex: asks(tbl('x', 'y', g.table)),
        type: 'expression',
        answer: ans,
        check: { kind: 'exponentialFit', form: 'fit', variable: 'x' },
        steps: [
          { latex: `\\frac{${g.table[1][1]}}{${g.table[0][1]}} = ${ratio(g.pn, g.pd)}`, why: T('l5.why.factorBetweenReadings') },
          { latex: ans, why: T('l5.why.startTimesFactorPower') },
        ],
        distractors: [
          { v: `${g.table[0][1]} \\cdot ${factorPow(g.pn, g.pd, 'x')}`, m: 'step-count-off-by-one' },
          { v: `${head}${factorPow(g.pn + g.pd, g.pd, 'x')}`, m: 'percent-used-as-the-factor' },
          { v: `${coefOf(g.table[1][1] - g.table[0][1], 'x')} + ${g.startAtZero}`, m: 'growth-is-linear' },
          { v: `${g.startAtZero === 1 ? '' : `${g.startAtZero} \\cdot `}${factorPow(g.pd, g.pn, 'x')}`, m: 'decay-factor-subtracted-from-one-twice' },
          { v: `${factorPow(g.pn, g.pd, 'x')}`, m: 'growth-start-for-factor' },
          { v: `${g.startAtZero + 1} \\cdot ${factorPow(g.pn, g.pd, 'x')}`, m: 'arith-slip' },
          { v: `${coefOf(g.startAtZero, 'x')}`, m: 'growth-is-linear' },
        ],
      };
    },
  },
  {
    id: 'em-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const decay = d >= 3 && r() < 0.4;
      const sc = scene(sr, decay ? FADES : GROWS);
      const g = drawGrowth(r, d, { decay });
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.growthFactor')}`,
        latex: tbl('x', 'y', g.table),
        type: 'numeric',
        answer: frac(g.pn, g.pd),
        check: { kind: 'exponentialFit', form: 'factor', variable: 'x' },
        steps: [
          { latex: `\\frac{${g.table[1][1]}}{${g.table[0][1]}} = ${ratio(g.pn, g.pd)}`, why: T('l5.why.factorBetweenReadings') },
          { latex: `\\frac{${g.table[2][1]}}{${g.table[1][1]}} = ${ratio(g.pn, g.pd)}`, why: T('l5.why.startTimesFactorPower') },
        ],
        distractors: [
          { v: frac(g.pn - g.pd, g.pd), m: 'percent-used-as-the-factor' },
          { v: String(g.table[1][1] - g.table[0][1]), m: 'growth-is-linear' },
          { v: String(g.table[0][1]), m: 'growth-start-for-factor' },
          { v: frac(g.pd, g.pn), m: 'decay-factor-subtracted-from-one-twice' },
          { v: String(g.percent), m: 'percent-used-as-the-factor' },
          { v: frac(g.pn + 1, g.pd), m: 'arith-slip' },
          { v: String(g.startAtZero), m: 'growth-start-for-factor' },
        ],
      };
    },
  },
  {
    id: 'em-overtake', rep: 'verbal', dMin: 3, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = scene(sr, RACES);
      const b = pick(r, [2, 3]);
      const a = int(r, 1, 1 + rung(d));
      const m = from(r, [[3, 6], [4, 9], [5, 12], [6, 16], [8, 20]], d);
      const c = from(r, [[4, 10], [6, 16], [8, 22], [10, 28], [12, 34]], d);
      const ruleA = a === 1 ? `${b}^{n}` : `${a} \\cdot ${b}^{n}`;
      const ruleB = `${coefOf(m, 'n')} ${sgn(c)}`;
      let first = null;
      for (let n = 0; n <= 14 && first === null; n++) {
        if (a * b ** n > m * n + c) first = n;
      }
      if (first === null || first < 2) throw new Error('retry: the two rules pass too early or never');
      return {
        stem: `${T(sc.ctx)} ${T('l5.ask.whenItPasses')}`,
        latex: stacked(ruleA, ruleB),
        type: 'numeric',
        answer: String(first),
        check: { kind: 'exponentialFit', form: 'overtake', variable: 'n', rules: [ruleA, ruleB], range: [0, 14] },
        steps: [
          { latex: `${a * b ** (first - 1)} < ${m * (first - 1) + c}`, why: T('l5.why.tryEachStep') },
          { latex: `${a * b ** first} > ${m * first + c}`, why: T('l5.why.factorBeatsStep') },
        ],
        distractors: [
          { v: String(first - 1), m: 'step-count-off-by-one' },
          { v: String(first + 1), m: 'step-count-off-by-one' },
          { v: String(a * b ** first), m: 'growth-start-for-factor' },
          { v: String(m * first + c), m: 'growth-is-linear' },
          { v: String(b), m: 'growth-start-for-factor' },
          { v: String(m), m: 'growth-is-linear' },
          { v: String(c), m: 'growth-is-linear' },
        ],
      };
    },
  },
];

export default {
  id: 'algebra1-l5',
  skills: {
    'rational-exponent': rationalExponent,
    'relation-is-function': relationIsFunction,
    'sequence-terms': sequenceTerms,
    'sequence-nth-term': sequenceNthTerm,
    'point-slope-form': pointSlopeForm,
    'parallel-perpendicular': parallelPerpendicular,
    'inequality-two-var': inequalityTwoVar,
    'write-system': writeSystem,
    'system-graphically': systemGraphically,
    'scatter-regression': scatterRegression,
    'residual-and-fit': residualAndFit,
    'association-strength': associationStrength,
    'exponential-model': exponentialModel,
  },
  strings: { en, es, pl },
};
