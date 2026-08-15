/**
 * Algebra I · Level 2 — the generator pack.
 *
 * Level 1 ends with a balance that stays level. Level 2 is what happens when
 * the balance starts to LEAN, when a formula has to be turned round to give up
 * a different letter, and when one statement is no longer enough to pin a
 * point down. Fourteen skills:
 *
 *   bracket-both-sides      a(x + b) = c(x + d)
 *   fraction-solve          a balance divided rather than multiplied
 *   rule-from-table         a table with no rule written on it
 *   inequality-one-step     a balance that leans, and the move that turns it
 *   inequality-two-step     the same lean, unwrapped in reverse
 *   inequality-multi-step   brackets and unknowns on both sides, still leaning
 *   compound-inequality     two statements at once — a band, not a ray
 *   literal-equations       a formula solved for a different letter
 *   ratio-proportion        two ratios that agree, and the fourth number
 *   slope-rate              rise over run, off points, tables and traces
 *   graph-linear            a rule drawn as a line, and a line read back
 *   write-linear            a rule written down from readings
 *   system-substitution     two statements, one point, one letter at a time
 *   system-elimination      two statements added until one letter leaves
 *
 * IT IS STILL DATA. This file imports one toolkit from `src/learn/generators.js`
 * and three prose bundles from `content/lang/packs/`. It touches no engine file:
 * not the mastery model, not the scheduler, not the session planner, not the
 * report, not the rift surface, not the world, not `src/main.js`.
 *
 * EVERY ITEM GOES THROUGH THE SAME GATE. `finalize` in generators.js re-derives
 * the answer from the displayed notation in exact rational arithmetic, checks
 * every worked line, refuses untagged distractors and refuses a set with fewer
 * than five recognisable errors. The Level 2 mathematics needed six new ways of
 * re-deriving an answer — an inequality, a band, a rearranged formula, a
 * proportion, a pair of statements, and a line — and they live in `verify()`
 * beside the others. A pack can add mathematics. It cannot add a way past the
 * gate.
 *
 * PROSE LIVES UNDER content/lang. Not in this file, and nowhere in src/.
 */
import { kit } from '../../learn/generators.js';
import en from '../../../content/lang/packs/algebra1-l2.en.js';
import es from '../../../content/lang/packs/algebra1-l2.es.js';
import pl from '../../../content/lang/packs/algebra1-l2.pl.js';

const {
  pick, int, nz, nzc, band, Bcoef, Bkonst, Broot, co, sg, lin, paren, distinct,
  arrayTex, ratio, pointTex, ptsTex,
} = kit;

/** The letters this unit uses for one unknown. Short, and never `l` or `o`. */
const VARS = ['x', 'n', 'm', 't', 'p'];

// ---------------------------------------------------------------------------
// Relations. One spelling each, everywhere, so an option set never offers the
// same statement twice in two costumes.
// ---------------------------------------------------------------------------
const RELS = ['>', '<', '\\ge', '\\le'];
const FLIP = { '>': '<', '<': '>', '\\ge': '\\le', '\\le': '\\ge' };
/** Swap a strict boundary for a closed one and back. The commonest careless read. */
const EDGE = { '>': '\\ge', '<': '\\le', '\\ge': '>', '\\le': '<' };
/** "x > 5" — the one spelling `verify()` derives and compares against. */
const st = (v, rel, n) => `${v} ${rel} ${n}`;
/** "3x + 5 > 20  =>  ?" — the prompt of every statement-choice item. */
const asks = (mathTex) => `${mathTex} \\;\\Rightarrow\\; \\square`;

// ---------------------------------------------------------------------------
// Situations.
//
// A pack cannot reach the engine's deck of framings, so it keeps its own and
// draws on `sr`, the situation stream, exactly as the deck does: the numbers an
// item asks about never move when the words around them change.
// ---------------------------------------------------------------------------
/** A machine that runs only while a reading holds. */
const LIMITS = [
  { ctx: 'l2.ctx.hoist', set: 'l2.ask.setHoist', least: 'l2.ask.leastHoist', most: 'l2.ask.mostHoist' },
  { ctx: 'l2.ctx.airlock', set: 'l2.ask.setAirlock', least: 'l2.ask.leastAirlock', most: 'l2.ask.mostAirlock' },
  { ctx: 'l2.ctx.kiln', set: 'l2.ask.setKiln', least: 'l2.ask.leastKiln', most: 'l2.ask.mostKiln' },
  { ctx: 'l2.ctx.tether', set: 'l2.ask.setTether', least: 'l2.ask.leastTether', most: 'l2.ask.mostTether' },
  { ctx: 'l2.ctx.thruster', set: 'l2.ask.setThruster', least: 'l2.ask.leastThruster', most: 'l2.ask.mostThruster' },
];
/** A machine that will only run inside a band. */
const BANDS = [
  { ctx: 'l2.ctx.bandGlaze', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandHold', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandSeed', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandTrack', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
];
/** Two quantities that keep the same ratio. */
const RATIOS = [
  { ctx: 'l2.ctx.mix', ask: 'l2.ask.mixHowMany' },
  { ctx: 'l2.ctx.chart', ask: 'l2.ask.chartHowFar' },
  { ctx: 'l2.ctx.alloy', ask: 'l2.ask.alloyHowMuch' },
  { ctx: 'l2.ctx.feed', ask: 'l2.ask.feedHowMany' },
  { ctx: 'l2.ctx.dye', ask: 'l2.ask.dyeHowMuch' },
];
/** Something that changes at a steady rate, read twice. */
const RATES = [
  { ctx: 'l2.ctx.rateWinch', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateFrost', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateTank', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateSled', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateKiln', ask: 'l2.ask.ratePerStep' },
];
/** A rule to be written down, or drawn. */
const RULES = [
  { ctx: 'l2.ctx.ruleLift', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleDrift', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleStack', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleBrine', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
];
/** Two conditions that hold at once. */
const PAIRS = [
  { ctx: 'l2.ctx.pairCrates', x: 'l2.ask.pairHowManyLight', y: 'l2.ask.pairHowManyHeavy' },
  { ctx: 'l2.ctx.pairTickets', x: 'l2.ask.pairHowManyCadet', y: 'l2.ask.pairHowManyCrew' },
  { ctx: 'l2.ctx.pairAlloys', x: 'l2.ask.pairHowManyTin', y: 'l2.ask.pairHowManyLead' },
  { ctx: 'l2.ctx.pairRuns', x: 'l2.ask.pairHowManyShort', y: 'l2.ask.pairHowManyLong' },
];

// ===========================================================================
// inequality-one-step  —  x + b REL c   and   ax REL c
// ===========================================================================
/** A one-step lean with a whole-number boundary. */
function drawLean(r, d) {
  const v = pick(r, VARS);
  const rel = pick(r, RELS);
  const x = Broot(r, d);
  return { v, rel, x };
}

const inequalityOneStep = [
  {
    id: 'i1-add', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, rel, x } = drawLean(r, d);
      const b = Bkonst(r, d);
      const c = x + b;
      if (!distinct(b, c, x)) throw new Error('retry: repeated number');
      const math = `${lin(1, v, b)} ${rel} ${c}`;
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${v} ${rel} ${c} ${sg(-b)}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, rel, x), why: T('l2.why.leanUnchanged') },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, c + b), m: 'sign-on-constant' },
          { v: st(v, rel, b - c), m: 'sign-slip' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, x - 1), m: 'arith-slip' },
          { v: st(v, FLIP[rel], c + b), m: 'flip-always' },
        ],
      };
    },
  },
  {
    id: 'i1-mul', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, rel, x } = drawLean(r, d);
      const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 3 + d);
      const c = a * x;
      if (Math.abs(a) < 2 || x === 0) throw new Error('retry: nothing to undo');
      if (!distinct(a, c, x)) throw new Error('retry: repeated number');
      const out = a < 0 ? FLIP[rel] : rel;
      const math = `${co(a, v)} ${rel} ${c}`;
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, out, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          {
            latex: `\\frac{${co(a, v)}}{${a}} ${out} \\frac{${c}}{${a}}`,
            why: T(a < 0 ? 'l2.why.divideByNegativeTurns' : 'why.divideBothByCoef', { a }),
          },
          { latex: st(v, out, x), why: T('why.whatIsLeft') },
        ],
        distractors: [
          { v: st(v, rel, x), m: a < 0 ? 'flip-not-needed' : 'flip-always' },
          { v: st(v, out, c - a), m: 'same-op-both' },
          { v: st(v, out, -x), m: 'sign-slip' },
          { v: st(v, EDGE[out], x), m: 'boundary-slip' },
          { v: st(v, out, x + 1), m: 'arith-slip' },
          { v: st(v, out, x - 1), m: 'arith-slip' },
          { v: st(v, FLIP[out], -x), m: 'flip-always' },
        ],
      };
    },
  },
  {
    id: 'i1-edge', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 2 + 2 * d);
      // A boundary that is NOT whole is the whole point: the first reading that
      // works is a second thought, not a copy of the line above.
      const c = a * int(r, 1, 2 + 2 * d) + int(r, 1, a - 1);
      if (c % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, c)) throw new Error('retry: repeated number');
      const q = c / a;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${co(a, v)} ${rel} ${c}`;
      return {
        stem: T(up ? 'l2.ask.leastWhole' : 'l2.ask.mostWhole', { v }),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${v} ${rel} \\frac{${c}}{${a}}`, why: T('why.divideBothByCoef', { a }) },
          { latex: st(v, rel, ratio(c, a)), why: T('l2.why.boundaryNotWhole') },
          { latex: `${ans} ${rel} ${ratio(c, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(c - a), m: 'same-op-both' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(c), m: 'partial-rule' },
          { v: String(a), m: 'partial-rule' },
          { v: String(-ans), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'i1-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = pick(sr, LIMITS);
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = int(r, 2, 2 + 2 * d);
      const x = int(r, 2, 3 + 2 * d);
      const c = a * x;
      if (!distinct(a, c, x)) throw new Error('retry: repeated number');
      const math = `${co(a, v)} ${rel} ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.set, { v })}`,
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `\\frac{${co(a, v)}}{${a}} ${rel} \\frac{${c}}{${a}}`, why: T('why.divideBothByCoef', { a }) },
          { latex: st(v, rel, x), why: T('why.whatIsLeft') },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, c - a), m: 'same-op-both' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, x - 1), m: 'arith-slip' },
          { v: st(v, rel, c), m: 'partial-rule' },
          { v: st(v, FLIP[rel], c - a), m: 'flip-always' },
        ],
      };
    },
  },
];

// ===========================================================================
// inequality-two-step  —  ax + b REL c
// ===========================================================================
function drawTwoStepLean(r, d, { forceNeg = false } = {}) {
  const v = pick(r, VARS);
  const rel = pick(r, RELS);
  const x = Broot(r, d);
  const a = forceNeg ? -Math.abs(nzc(r, 2, 3 + d)) : (d >= 3 ? Bcoef(r, d) : int(r, 2, 3 + d));
  if (Math.abs(a) < 2) throw new Error('retry: nothing to divide by');
  const b = Bkonst(r, d);
  const c = a * x + b;
  if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
  return { v, rel, x, a, b, c, out: a < 0 ? FLIP[rel] : rel };
}

/** The two moves every two-step lean is made of, as worked lines. */
function leanSteps(T, { v, rel, x, a, b, c, out }) {
  return [
    { latex: `${co(a, v)} ${rel} ${c} ${sg(-b)}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
    { latex: `${co(a, v)} ${rel} ${c - b}`, why: T('why.whatIsLeft') },
    {
      latex: st(v, out, ratio(c - b, a)),
      why: T(a < 0 ? 'l2.why.divideByNegativeTurns' : 'why.divideBothByCoef', { a }),
    },
    { latex: st(v, out, x), why: T('l2.why.leanNowRead') },
  ];
}

/** The wrong statements a two-step lean can actually produce. */
function leanWrong({ v, rel, x, a, b, c, out }) {
  return [
    { v: st(v, rel, x), m: a < 0 ? 'flip-not-needed' : 'flip-always' },
    { v: st(v, out, ratio(c + b, a)), m: 'sign-on-constant' },
    { v: st(v, out, ratio(c, a) === ratio(c - b, a) ? c : c - a), m: 'partial-rule' },
    { v: st(v, EDGE[out], x), m: 'boundary-slip' },
    { v: st(v, out, -x), m: 'sign-slip' },
    { v: st(v, out, x + 1), m: 'arith-slip' },
    { v: st(v, out, x - 1), m: 'arith-slip' },
    { v: st(v, FLIP[out], x), m: 'flip-always' },
  ];
}

const inequalityTwoStep = [
  {
    id: 'i2-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawTwoStepLean(r, d);
      const math = `${lin(s.a, s.v, s.b)} ${s.rel} ${s.c}`;
      return {
        stem: T('l2.ask.whichStatement', { v: s.v }),
        latex: asks(math),
        type: 'expression',
        answer: st(s.v, s.out, s.x),
        check: { kind: 'inequality', math, variable: s.v },
        steps: leanSteps(T, s),
        distractors: leanWrong(s),
      };
    },
  },
  {
    id: 'i2-turn', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawTwoStepLean(r, d, { forceNeg: true });
      const math = `${lin(s.a, s.v, s.b)} ${s.rel} ${s.c}`;
      return {
        stem: T('l2.ask.whichStatement', { v: s.v }),
        latex: asks(math),
        type: 'expression',
        answer: st(s.v, s.out, s.x),
        check: { kind: 'inequality', math, variable: s.v },
        steps: leanSteps(T, s),
        distractors: leanWrong(s),
      };
    },
  },
  {
    id: 'i2-edge', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 3 + d);
      const b = Bkonst(r, d);
      const c = a * int(r, 1, 3 + d) + int(r, 1, a - 1) + b;
      if ((c - b) % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const q = (c - b) / a;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        stem: T(up ? 'l2.ask.leastWhole' : 'l2.ask.mostWhole', { v }),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, rel, ratio(c - b, a)), why: T('why.divideBothByCoef', { a }) },
          { latex: `${ans} ${rel} ${ratio(c - b, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(Math.round((c + b) / a)), m: 'sign-on-constant' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    // The question a real limit actually asks: not "which statement", but
    // "what is the most I can load?".
    id: 'i2-limit', rep: 'context', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = pick(sr, LIMITS);
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 3 + d);
      const b = int(r, 2, 5 + d);
      const c = a * int(r, 2, 3 + d) + int(r, 1, a - 1) + b;
      if ((c - b) % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const q = (c - b) / a;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(up ? sc.least : sc.most, { v })}`,
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T('l2.why.takeOffBothSides', { n: b }) },
          { latex: st(v, rel, ratio(c - b, a)), why: T('why.divideBothByCoef', { a }) },
          { latex: `${ans} ${rel} ${ratio(c - b, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(c), m: 'partial-rule' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(a), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'i2-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = pick(sr, LIMITS);
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = int(r, 2, 3 + d);
      const b = int(r, 2, 5 + d);
      const x = int(r, 2, 4 + d);
      const c = a * x + b;
      if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.set, { v })}`,
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T('l2.why.takeOffBothSides', { n: b }) },
          { latex: st(v, rel, x), why: T('why.divideBothByCoef', { a }) },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, ratio(c + b, a)), m: 'sign-on-constant' },
          { v: st(v, rel, c - b), m: 'partial-rule' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, x - 1), m: 'arith-slip' },
          { v: st(v, rel, -x), m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// inequality-multi-step  —  a(x + b) REL c   and   ax + b REL cx + e
// ===========================================================================
const inequalityMultiStep = [
  {
    id: 'im-bracket', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 3 + d);
      if (Math.abs(a) < 2) throw new Error('retry: an empty factor');
      const b = Bkonst(r, d);
      const x = Broot(r, d);
      const c = a * (x + b);
      if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
      const out = a < 0 ? FLIP[rel] : rel;
      const math = `${paren(a, lin(1, v, b))} ${rel} ${c}`;
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, out, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${lin(a, v, a * b)} ${rel} ${c}`, why: T('why.everyTermInside') },
          { latex: `${co(a, v)} ${rel} ${c - a * b}`, why: T(a * b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(a * b) }) },
          { latex: st(v, out, x), why: T(a < 0 ? 'l2.why.divideByNegativeTurns' : 'why.divideBothByCoef', { a }) },
        ],
        distractors: [
          { v: st(v, rel, x), m: a < 0 ? 'flip-not-needed' : 'flip-always' },
          { v: st(v, out, ratio(c, a) - b), m: 'partial-distribute' },
          { v: st(v, out, ratio(c - b, a)), m: 'partial-distribute' },
          { v: st(v, EDGE[out], x), m: 'boundary-slip' },
          { v: st(v, out, -x), m: 'sign-slip' },
          { v: st(v, out, x + 1), m: 'arith-slip' },
          { v: st(v, out, x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'im-bothsides', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = int(r, 2, 4 + d);
      const cc = d >= 3 ? nzc(r, -(4 + d), a - 1) : int(r, 1, a - 1);
      if (cc === a || Math.abs(cc) < 1) throw new Error('retry: the unknown cancels');
      const gap = a - cc;
      const b = Bkonst(r, d);
      const x = Broot(r, d);
      const e = gap * x + b;
      if (!distinct(a, b, cc, e, x)) throw new Error('retry: repeated number');
      const math = `${lin(a, v, b)} ${rel} ${lin(cc, v, e)}`;
      // Gathering on the left leaves a POSITIVE coefficient, so this form never
      // turns the lean: it is the one that teaches that gathering is a choice.
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${lin(gap, v, b)} ${rel} ${e}`, why: T('why.gatherUnknownOneSide', { term: co(cc, v) }) },
          { latex: `${co(gap, v)} ${rel} ${e - b}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, rel, x), why: T('why.divideBothByCoef', { a: gap }) },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, ratio(b - e, gap)), m: 'collect-wrong-side' },
          { v: st(v, rel, ratio(e - b, a + cc)), m: 'collect-wrong-side' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, e - b), m: 'partial-rule' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, -x), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'im-edge', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 3 + d);
      const b = Bkonst(r, d);
      const c = a * int(r, 1, 3 + d) + int(r, 1, a - 1);
      if (c % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const q = c / a - b;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${paren(a, lin(1, v, b))} ${rel} ${c}`;
      return {
        stem: T(up ? 'l2.ask.leastWhole' : 'l2.ask.mostWhole', { v }),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${lin(a, v, a * b)} ${rel} ${c}`, why: T('why.everyTermInside') },
          { latex: st(v, rel, ratio(c - a * b, a)), why: T('why.divideBothByCoef', { a }) },
          { latex: `${ans} ${rel} ${ratio(c - a * b, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(Math.round(c / a) - b), m: 'partial-distribute' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(c - a), m: 'partial-rule' },
          { v: String(c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'im-dispute', rep: 'verbal', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const rel = pick(r, ['>', '<']);
      const a = -Math.abs(nzc(r, 2, 3 + d));
      const b = Bkonst(r, d);
      const x = Broot(r, d);
      const c = a * x + b;
      if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
      const out = FLIP[rel];
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        stem: `${T('l2.ctx.disputeLean')} ${T('l2.ask.whichCadetIsRight', { v })}`,
        latex: asks(math),
        type: 'expression',
        answer: st(v, out, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, out, x), why: T('l2.why.divideByNegativeTurns', { a }) },
        ],
        distractors: [
          { v: st(v, rel, x), m: 'flip-not-needed' },
          { v: st(v, EDGE[out], x), m: 'boundary-slip' },
          { v: st(v, out, -x), m: 'sign-slip' },
          { v: st(v, out, x + 1), m: 'arith-slip' },
          { v: st(v, out, x - 1), m: 'arith-slip' },
          { v: st(v, rel, -x), m: 'flip-not-needed' },
          { v: st(v, out, c - b), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// compound-inequality  —  p REL ax + b REL q
// ===========================================================================
function drawBandLean(r, d, { forceNeg = false } = {}) {
  const v = pick(r, VARS);
  const lo = Broot(r, d);
  const width = int(r, 2, 3 + d);
  const hi = lo + width;
  const a = forceNeg ? -Math.abs(nzc(r, 2, 2 + d)) : (d >= 4 ? Bcoef(r, d) : int(r, 2, 2 + d));
  if (Math.abs(a) < 2) throw new Error('retry: nothing to divide by');
  const b = Bkonst(r, d);
  const l = pick(r, ['<', '\\le']);
  const u = pick(r, ['<', '\\le']);
  // Written left to right, the smaller end always comes first, so a negative
  // coefficient turns the whole statement inside out — which is the point.
  const p = a > 0 ? a * lo + b : a * hi + b;
  const q = a > 0 ? a * hi + b : a * lo + b;
  if (!distinct(a, b, p, q)) throw new Error('retry: repeated number');
  // A negative coefficient turns the written statement inside out: the end that
  // was printed on the left is the end the unknown carries on the right.
  const math = `${p} ${a > 0 ? l : u} ${lin(a, v, b)} ${a > 0 ? u : l} ${q}`;
  const answer = `${lo} ${l} ${v} ${u} ${hi}`;
  return { v, a, b, lo, hi, p, q, l, u, loRel: l, upRel: u, math, answer };
}

const compoundInequality = [
  {
    id: 'cd-band', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawBandLean(r, d);
      const mid = s.a > 0 ? s.l : s.u;
      const midU = s.a > 0 ? s.u : s.l;
      return {
        stem: T('l2.ask.whichBand', { v: s.v }),
        latex: asks(s.math),
        type: 'expression',
        answer: s.answer,
        check: { kind: 'compound', math: s.math, variable: s.v },
        steps: [
          { latex: `${s.p - s.b} ${mid} ${co(s.a, s.v)} ${midU} ${s.q - s.b}`, why: T(s.b > 0 ? 'l2.why.takeOffEveryPart' : 'l2.why.addToEveryPart', { n: Math.abs(s.b) }) },
          { latex: s.answer, why: T(s.a < 0 ? 'l2.why.divideByNegativeTurnsBoth' : 'l2.why.divideEveryPart', { a: s.a }) },
        ],
        distractors: [
          { v: `${s.hi} ${s.loRel} ${s.v} ${s.upRel} ${s.lo}`, m: 'band-reversed' },
          { v: `${s.lo} ${EDGE[s.loRel]} ${s.v} ${s.upRel} ${s.hi}`, m: 'boundary-slip' },
          { v: `${s.lo} ${s.loRel} ${s.v} ${EDGE[s.upRel]} ${s.hi}`, m: 'boundary-slip' },
          { v: `${s.lo - 1} ${s.loRel} ${s.v} ${s.upRel} ${s.hi}`, m: 'arith-slip' },
          { v: `${s.lo} ${s.loRel} ${s.v} ${s.upRel} ${s.hi + 1}`, m: 'arith-slip' },
          { v: `${s.p} ${s.loRel} ${s.v} ${s.upRel} ${s.q}`, m: 'partial-rule' },
          { v: `${-s.hi} ${s.loRel} ${s.v} ${s.upRel} ${-s.lo}`, m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'cd-turn', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawBandLean(r, d, { forceNeg: true });
      const mid = s.u;
      const midU = s.l;
      return {
        stem: T('l2.ask.whichBand', { v: s.v }),
        latex: asks(s.math),
        type: 'expression',
        answer: s.answer,
        check: { kind: 'compound', math: s.math, variable: s.v },
        steps: [
          { latex: `${s.p - s.b} ${mid} ${co(s.a, s.v)} ${midU} ${s.q - s.b}`, why: T(s.b > 0 ? 'l2.why.takeOffEveryPart' : 'l2.why.addToEveryPart', { n: Math.abs(s.b) }) },
          { latex: s.answer, why: T('l2.why.divideByNegativeTurnsBoth', { a: s.a }) },
        ],
        distractors: [
          { v: `${s.hi} ${s.loRel} ${s.v} ${s.upRel} ${s.lo}`, m: 'band-reversed' },
          { v: `${s.lo} ${FLIP[s.loRel]} ${s.v} ${FLIP[s.upRel]} ${s.hi}`, m: 'flip-not-needed' },
          { v: `${s.lo} ${EDGE[s.loRel]} ${s.v} ${s.upRel} ${s.hi}`, m: 'boundary-slip' },
          { v: `${-s.hi} ${s.loRel} ${s.v} ${s.upRel} ${-s.lo}`, m: 'sign-slip' },
          { v: `${s.lo + 1} ${s.loRel} ${s.v} ${s.upRel} ${s.hi}`, m: 'arith-slip' },
          { v: `${s.lo} ${s.loRel} ${s.v} ${s.upRel} ${s.hi - 1}`, m: 'arith-slip' },
          { v: `${s.p} ${s.loRel} ${s.v} ${s.upRel} ${s.q}`, m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'cd-count', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawBandLean(r, d);
      const first = s.loRel === '<' ? s.lo + 1 : s.lo;
      const last = s.upRel === '<' ? s.hi - 1 : s.hi;
      const n = last - first + 1;
      if (n < 2) throw new Error('retry: a band with nothing in it');
      return {
        stem: T('l2.ask.howManyWhole', { v: s.v }),
        latex: s.math,
        type: 'numeric',
        answer: String(n),
        check: { kind: 'compound', math: s.math, variable: s.v, want: 'count' },
        steps: [
          { latex: s.answer, why: T('l2.why.bandFirst') },
          { latex: `${last} - ${first} + 1 = ${n}`, why: T('l2.why.countTheEnds') },
        ],
        distractors: [
          { v: String(n - 1), m: 'boundary-slip' },
          { v: String(n + 1), m: 'boundary-slip' },
          { v: String(s.hi - s.lo), m: 'partial-rule' },
          { v: String(s.q - s.p), m: 'partial-rule' },
          { v: String(n + 2), m: 'arith-slip' },
          { v: String(Math.max(1, n - 2)), m: 'arith-slip' },
          { v: String(s.hi), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'cd-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = pick(sr, BANDS);
      const v = pick(r, VARS);
      const lo = int(r, 2, 4 + d);
      const hi = lo + int(r, 2, 3 + d);
      const a = int(r, 2, 2 + d);
      const b = int(r, 1, 4 + d);
      const l = pick(r, ['<', '\\le']);
      const u = pick(r, ['<', '\\le']);
      const p = a * lo + b;
      const q = a * hi + b;
      if (!distinct(a, b, p, q)) throw new Error('retry: repeated number');
      const math = `${p} ${l} ${lin(a, v, b)} ${u} ${q}`;
      const answer = `${lo} ${l} ${v} ${u} ${hi}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.set, { v })}`,
        latex: asks(math),
        type: 'expression',
        answer,
        check: { kind: 'compound', math, variable: v },
        steps: [
          { latex: `${p - b} ${l} ${co(a, v)} ${u} ${q - b}`, why: T('l2.why.takeOffEveryPart', { n: b }) },
          { latex: answer, why: T('l2.why.divideEveryPart', { a }) },
        ],
        distractors: [
          { v: `${hi} ${l} ${v} ${u} ${lo}`, m: 'band-reversed' },
          { v: `${lo} ${EDGE[l]} ${v} ${u} ${hi}`, m: 'boundary-slip' },
          { v: `${lo} ${l} ${v} ${EDGE[u]} ${hi}`, m: 'boundary-slip' },
          { v: `${p} ${l} ${v} ${u} ${q}`, m: 'partial-rule' },
          { v: `${lo - 1} ${l} ${v} ${u} ${hi}`, m: 'arith-slip' },
          { v: `${lo} ${l} ${v} ${u} ${hi + 1}`, m: 'arith-slip' },
          { v: `${p - b} ${l} ${v} ${u} ${q - b}`, m: 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// literal-equations  —  a formula solved for a different letter
// ===========================================================================
/**
 * The formulas, by band. Each carries the wrong rearrangements a learner
 * actually writes, so a distractor is never invented to fill a slot.
 */
const FORMULAS = [
  {
    d: 1, math: 'A = bh', v: 'h', vars: ['A', 'b'], answer: '\\frac{A}{b}', name: 'l2.name.area',
    steps: [{ l: '\\frac{A}{b} = h', w: 'l2.why.divideBothByLetter' }, { l: 'h = \\frac{A}{b}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{b}{A}', m: 'div-direction' }, { v: 'A b', m: 'same-op-both' },
      { v: 'A - b', m: 'same-op-both' }, { v: 'b - A', m: 'div-direction' },
      { v: '\\frac{A}{b} + b', m: 'partial-rule' }, { v: '\\frac{A b}{2}', m: 'partial-rule' },
    ],
  },
  {
    d: 1, math: 'd = rt', v: 't', vars: ['d', 'r'], answer: '\\frac{d}{r}', name: 'l2.name.distance',
    steps: [{ l: '\\frac{d}{r} = t', w: 'l2.why.divideBothByLetter' }, { l: 't = \\frac{d}{r}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{r}{d}', m: 'div-direction' }, { v: 'd r', m: 'same-op-both' },
      { v: 'd - r', m: 'same-op-both' }, { v: 'r - d', m: 'div-direction' },
      { v: '\\frac{d}{r} + r', m: 'partial-rule' }, { v: '\\frac{d + r}{r}', m: 'partial-rule' },
    ],
  },
  {
    d: 2, math: 'F = ma', v: 'a', vars: ['F', 'm'], answer: '\\frac{F}{m}', name: 'l2.name.force',
    steps: [{ l: '\\frac{F}{m} = a', w: 'l2.why.divideBothByLetter' }, { l: 'a = \\frac{F}{m}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{m}{F}', m: 'div-direction' }, { v: 'F m', m: 'same-op-both' },
      { v: 'F - m', m: 'same-op-both' }, { v: 'm - F', m: 'div-direction' },
      { v: '\\frac{F}{m} - m', m: 'partial-rule' }, { v: '\\frac{F - m}{m}', m: 'partial-rule' },
    ],
  },
  {
    d: 2, math: 'A = \\frac{bh}{2}', v: 'h', vars: ['A', 'b'], answer: '\\frac{2A}{b}', name: 'l2.name.triangle',
    steps: [
      { l: '2A = bh', w: 'l2.why.clearTheBarFirst' },
      { l: '\\frac{2A}{b} = h', w: 'l2.why.divideBothByLetter' },
      { l: 'h = \\frac{2A}{b}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{A}{2b}', m: 'divide-not-multiply' }, { v: '\\frac{A}{b}', m: 'partial-rule' },
      { v: '\\frac{2b}{A}', m: 'div-direction' }, { v: '2A b', m: 'same-op-both' },
      { v: '\\frac{b}{2A}', m: 'div-direction' }, { v: '2A - b', m: 'same-op-both' },
    ],
  },
  {
    d: 3, math: 'P = 2l + 2w', v: 'w', vars: ['P', 'l'], answer: '\\frac{P - 2l}{2}', name: 'l2.name.perimeter',
    steps: [
      { l: 'P - 2l = 2w', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{P - 2l}{2} = w', w: 'l2.why.divideBothByNumber' },
      { l: 'w = \\frac{P - 2l}{2}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{P}{2} - 2l', m: 'partial-rule' }, { v: 'P - 2l', m: 'partial-rule' },
      { v: '\\frac{P + 2l}{2}', m: 'sign-on-constant' }, { v: '\\frac{2l - P}{2}', m: 'sign-slip' },
      { v: '\\frac{P - l}{2}', m: 'partial-distribute' }, { v: '\\frac{2}{P - 2l}', m: 'div-direction' },
    ],
  },
  {
    d: 3, math: 'y = mx + b', v: 'x', vars: ['y', 'm', 'b'], answer: '\\frac{y - b}{m}', name: 'l2.name.line',
    steps: [
      { l: 'y - b = mx', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{y - b}{m} = x', w: 'l2.why.divideBothByLetter' },
      { l: 'x = \\frac{y - b}{m}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{y}{m} - b', m: 'partial-rule' }, { v: 'y - b - m', m: 'same-op-both' },
      { v: '\\frac{y + b}{m}', m: 'sign-on-constant' }, { v: '\\frac{m}{y - b}', m: 'div-direction' },
      { v: '\\frac{b - y}{m}', m: 'sign-slip' }, { v: 'm y - b', m: 'same-op-both' },
    ],
  },
  {
    d: 4, math: 'ax + by = c', v: 'y', vars: ['a', 'x', 'c', 'b'], answer: '\\frac{c - ax}{b}', name: 'l2.name.standard',
    steps: [
      { l: 'ax + by - ax = c - ax', w: 'l2.why.moveTheOtherTermFirst' },
      { l: 'by = c - ax', w: 'why.whatIsLeft' },
      { l: 'y = \\frac{c - ax}{b}', w: 'l2.why.divideBothByLetter' },
    ],
    wrong: [
      { v: '\\frac{c}{b} - ax', m: 'partial-rule' }, { v: 'c - ax', m: 'partial-rule' },
      { v: '\\frac{c + ax}{b}', m: 'sign-on-constant' }, { v: '\\frac{ax - c}{b}', m: 'sign-slip' },
      { v: '\\frac{b}{c - ax}', m: 'div-direction' }, { v: '\\frac{c - a}{b}', m: 'partial-distribute' },
    ],
  },
  {
    d: 4, math: 'S = \\frac{a + b}{2}', v: 'b', vars: ['S', 'a'], answer: '2S - a', name: 'l2.name.mean',
    steps: [
      { l: '2S = a + b', w: 'l2.why.clearTheBarFirst' },
      { l: '2S - a = b', w: 'l2.why.moveTheOtherTermFirst' },
      { l: 'b = 2S - a', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{S}{2} - a', m: 'divide-not-multiply' }, { v: '2S + a', m: 'sign-on-constant' },
      { v: 'S - a', m: 'partial-rule' }, { v: 'a - 2S', m: 'sign-slip' },
      { v: '\\frac{2S}{a}', m: 'same-op-both' }, { v: '2 S a', m: 'same-op-both' },
    ],
  },
  {
    d: 5, math: 'T = a + (n - 1)d', v: 'n', vars: ['T', 'a', 'd'], answer: '\\frac{T - a}{d} + 1', name: 'l2.name.term',
    steps: [
      { l: 'T - a = (n - 1)d', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{T - a}{d} = n - 1', w: 'l2.why.divideBothByLetter' },
      { l: '\\frac{T - a}{d} + 1 = n', w: 'l2.why.putBackTheOne' },
    ],
    wrong: [
      { v: '\\frac{T - a}{d}', m: 'partial-rule' }, { v: '\\frac{T - a}{d} - 1', m: 'sign-on-constant' },
      { v: '\\frac{T - a - 1}{d}', m: 'partial-rule' }, { v: '\\frac{T + a}{d} + 1', m: 'sign-slip' },
      { v: '\\frac{d}{T - a} + 1', m: 'div-direction' }, { v: 'T - a - d + 1', m: 'same-op-both' },
    ],
  },
  {
    d: 5, math: 'F = \\frac{9C}{5} + 32', v: 'C', vars: ['F'], answer: '\\frac{5\\left(F - 32\\right)}{9}', name: 'l2.name.degrees',
    steps: [
      { l: 'F - 32 = \\frac{9C}{5}', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '5\\left(F - 32\\right) = 9C', w: 'l2.why.clearTheBarFirst' },
      { l: 'C = \\frac{5\\left(F - 32\\right)}{9}', w: 'l2.why.divideBothByNumber' },
    ],
    wrong: [
      { v: '\\frac{9\\left(F - 32\\right)}{5}', m: 'div-direction' },
      { v: '\\frac{5F - 32}{9}', m: 'partial-distribute' },
      { v: '\\frac{5\\left(F + 32\\right)}{9}', m: 'sign-on-constant' },
      { v: '\\frac{9F}{5} + 32', m: 'same-op-both' },
      { v: '5\\left(F - 32\\right)', m: 'partial-rule' },
      { v: '\\frac{F - 32}{9}', m: 'partial-rule' },
    ],
  },
  {
    d: 5, math: 'I = Prt', v: 'r', vars: ['I', 'P', 't'], answer: '\\frac{I}{Pt}', name: 'l2.name.interest',
    steps: [
      { l: '\\frac{I}{P} = rt', w: 'l2.why.divideBothByLetter' },
      { l: '\\frac{I}{Pt} = r', w: 'l2.why.divideBothByLetter' },
      { l: 'r = \\frac{I}{Pt}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{Pt}{I}', m: 'div-direction' },
      { v: '\\frac{I}{P} - t', m: 'same-op-both' },
      { v: '\\frac{I}{P}', m: 'partial-rule' },
      { v: 'I - Pt', m: 'same-op-both' },
      { v: '\\frac{It}{P}', m: 'div-direction' },
      { v: '\\frac{I}{P + t}', m: 'partial-rule' },
    ],
  },
  {
    d: 5, math: 'V = \\frac{Bh}{3}', v: 'B', vars: ['V', 'h'], answer: '\\frac{3V}{h}', name: 'l2.name.cone',
    steps: [
      { l: '3V = Bh', w: 'l2.why.clearTheBarFirst' },
      { l: '\\frac{3V}{h} = B', w: 'l2.why.divideBothByLetter' },
      { l: 'B = \\frac{3V}{h}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{V}{3h}', m: 'divide-not-multiply' }, { v: '\\frac{V}{h}', m: 'partial-rule' },
      { v: '\\frac{3h}{V}', m: 'div-direction' }, { v: '3V h', m: 'same-op-both' },
      { v: '\\frac{h}{3V}', m: 'div-direction' }, { v: '3V - h', m: 'same-op-both' },
    ],
  },
];

/** The formula skeleton a choice is made against: the shape, with the values gone. */
const literalPrompt = (f) => `${f.math} \\;\\Rightarrow\\; ${f.v} = \\square`;

const literalEquations = [
  {
    id: 'le-formula', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const pool = FORMULAS.filter((f) => f.d <= d && f.d >= d - 1);
      const f = pick(r, pool.length ? pool : FORMULAS.filter((x) => x.d <= d));
      if (!f) throw new Error('retry: no formula at this band');
      return {
        stem: T('l2.ask.solveFormulaFor', { v: f.v }),
        latex: literalPrompt(f),
        type: 'expression',
        answer: f.answer,
        check: { kind: 'rearrange', math: f.math, variable: f.v, vars: f.vars },
        steps: f.steps.map((s) => ({ latex: s.l, why: T(s.w, { v: f.v }) })),
        distractors: f.wrong.map((w) => ({ v: w.v, m: w.m })),
      };
    },
  },
  {
    id: 'le-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const pool = FORMULAS.filter((f) => f.d <= d && f.d >= d - 1);
      const f = pick(r, pool.length ? pool : FORMULAS.filter((x) => x.d <= d));
      if (!f) throw new Error('retry: no formula at this band');
      return {
        stem: `${T(f.name)} ${T('l2.ask.turnItRound', { v: f.v })}`,
        latex: literalPrompt(f),
        type: 'expression',
        answer: f.answer,
        check: { kind: 'rearrange', math: f.math, variable: f.v, vars: f.vars },
        steps: f.steps.map((s) => ({ latex: s.l, why: T(s.w, { v: f.v }) })),
        distractors: f.wrong.map((w) => ({ v: w.v, m: w.m })),
      };
    },
  },
  {
    id: 'le-general', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      // A literal equation with numbers in it: the same act, at the magnitudes
      // the band promises, so the ladder is measured and not asserted.
      const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 3 + d);
      const b = Bkonst(r, d);
      if (Math.abs(a) < 2 || !distinct(a, b)) throw new Error('retry: repeated number');
      const math = `y = ${lin(a, 'x', 0)} ${sg(b)}`;
      const answer = `\\frac{y ${sg(-b)}}{${a}}`;
      return {
        stem: T('l2.ask.solveFormulaFor', { v: 'x' }),
        latex: `${math} \\;\\Rightarrow\\; x = \\square`,
        type: 'expression',
        answer,
        check: { kind: 'rearrange', math, variable: 'x', vars: ['y'] },
        steps: [
          { latex: `y ${sg(-b)} = ${co(a, 'x')}`, why: T('l2.why.moveTheOtherTermFirst', { v: 'x' }) },
          { latex: `\\frac{y ${sg(-b)}}{${a}} = x`, why: T('why.divideBothByCoef', { a }) },
        ],
        distractors: [
          { v: `\\frac{y}{${a}} ${sg(-b)}`, m: 'partial-rule' },
          { v: `\\frac{y ${sg(b)}}{${a}}`, m: 'sign-on-constant' },
          { v: `y ${sg(-b)}`, m: 'partial-rule' },
          { v: `\\frac{${a}}{y ${sg(-b)}}`, m: 'div-direction' },
          { v: `${a}y ${sg(-b)}`, m: 'same-op-both' },
          { v: `\\frac{${-b} - y}{${a}}`, m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'le-share', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      // A bar over a sum: the move that has to happen first, in letters.
      const k = int(r, 2, 2 + d);
      const a = int(r, 2, 4 + d);
      if (!distinct(k, a)) throw new Error('retry: repeated number');
      const math = `\\frac{P ${sg(-a)}}{${k}} = Q`;
      const answer = `${k}Q + ${a}`;
      return {
        stem: T('l2.ask.solveFormulaFor', { v: 'P' }),
        latex: `${math} \\;\\Rightarrow\\; P = \\square`,
        type: 'expression',
        answer,
        check: { kind: 'rearrange', math, variable: 'P', vars: ['Q'] },
        steps: [
          { latex: `P ${sg(-a)} = ${k}Q`, why: T('l2.why.clearTheBarFirst', { v: 'P' }) },
          { latex: `P = ${k}Q + ${a}`, why: T('l2.why.moveTheOtherTermFirst', { v: 'P' }) },
        ],
        distractors: [
          { v: `${k}Q - ${a}`, m: 'sign-on-constant' },
          { v: `\\frac{Q}{${k}} + ${a}`, m: 'divide-not-multiply' },
          { v: `${k}Q`, m: 'partial-rule' },
          { v: `Q + ${a}`, m: 'partial-rule' },
          { v: `${k}\\left(Q + ${a}\\right)`, m: 'partial-distribute' },
          { v: `${a} - ${k}Q`, m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// ratio-proportion  —  two ratios that agree
// ===========================================================================
/** A proportion with a whole-number answer, with the gap in any of four slots. */
function drawProportion(r, d, slot) {
  const k = int(r, 2, 2 + 2 * d);      // the scale between the two ratios
  const a = int(r, 2, 4 + 2 * d);
  const b = int(r, 2, 4 + 2 * d);
  if (a === b) throw new Error('retry: a ratio of one is not a ratio');
  const c = a * k;
  const e = b * k;
  const cells = [a, b, c, e];
  if (!distinct(...cells)) throw new Error('retry: repeated number');
  const x = cells[slot];
  const shown = cells.map((n, i) => (i === slot ? 'x' : String(n)));
  const math = `\\frac{${shown[0]}}{${shown[1]}} = \\frac{${shown[2]}}{${shown[3]}}`;
  return { a, b, c, e, k, x, slot, math };
}

const ratioProportion = [
  {
    id: 'rp-solve', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const slot = d >= 3 ? int(r, 0, 3) : int(r, 2, 3);
      const p = drawProportion(r, d, slot);
      const cross = [p.a * p.e, p.b * p.c];
      return {
        stem: T('l2.ask.findTheFourth'),
        latex: p.math,
        type: 'numeric',
        answer: String(p.x),
        check: { kind: 'proportion', math: p.math, variable: 'x' },
        steps: [
          { latex: `${p.a} \\cdot ${p.e} = ${p.b} \\cdot ${p.c}`, why: T('l2.why.crossMultiply') },
          { latex: `${cross[0]} = ${cross[1]}`, why: T('l2.why.oneNumberLeft') },
        ],
        distractors: [
          { v: String(p.k), m: 'partial-rule' },
          { v: String(p.x + p.k), m: 'add-not-multiply' },
          { v: String(p.x - p.k), m: 'add-not-multiply' },
          { v: String(Math.round(p.a * p.b / Math.max(1, p.k))), m: 'div-direction' },
          { v: String(p.x + 1), m: 'arith-slip' },
          { v: String(p.x - 1), m: 'arith-slip' },
          { v: String(p.a + p.b), m: 'add-not-multiply' },
        ],
      };
    },
  },
  {
    id: 'rp-rate', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      // Equivalent ratios in a table. The rule through the origin is the rate.
      const rate = int(r, 2, 3 + 2 * d);
      const start = int(r, 1, 2 + d);
      const step = int(r, 1, Math.max(1, d - 1));
      const rows = [0, 1, 2, 3].map((i) => [start + i * step, rate * (start + i * step)]);
      const missing = int(r, 1, 3);
      if (!distinct(rate, start, step)) throw new Error('retry: repeated number');
      const ans = rows[missing][1];
      return {
        stem: T('l2.ask.sameRatioRow'),
        latex: arrayTex('x', 'y', rows, missing),
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'table', rows, missing },
        steps: [
          { latex: `\\frac{${rows[0][1]}}{${rows[0][0]}} = ${rate}`, why: T('l2.why.oneRowGivesTheRate') },
          { latex: `${rate} \\cdot ${rows[missing][0]} = ${ans}`, why: T('l2.why.applyRateToRow') },
        ],
        distractors: [
          { v: String(rows[missing - 1][1]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
          { v: String(rows[missing][0] + rate), m: 'add-not-multiply' },
          { v: String(rate), m: 'partial-rule' },
          { v: String(ans + rate), m: 'arith-slip' },
          { v: String(ans - rate), m: 'arith-slip' },
          { v: String(ans + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'rp-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = pick(sr, RATIOS);
      const p = drawProportion(r, d, 3);
      const cross = [p.a * p.e, p.b * p.c];
      return {
        stem: `${T(sc.ctx)} ${T(sc.ask)}`,
        latex: p.math,
        type: 'numeric',
        answer: String(p.x),
        check: { kind: 'proportion', math: p.math, variable: 'x' },
        steps: [
          { latex: `${p.a} \\cdot ${p.e} = ${p.b} \\cdot ${p.c}`, why: T('l2.why.crossMultiply') },
          { latex: `${cross[0]} = ${cross[1]}`, why: T('l2.why.oneNumberLeft') },
        ],
        distractors: [
          { v: String(p.k), m: 'partial-rule' },
          { v: String(p.x + p.k), m: 'add-not-multiply' },
          { v: String(p.b + p.c - p.a), m: 'add-not-multiply' },
          { v: String(p.x + 1), m: 'arith-slip' },
          { v: String(p.x - 1), m: 'arith-slip' },
          { v: String(p.c), m: 'partial-rule' },
          { v: String(p.a * p.b), m: 'div-direction' },
        ],
      };
    },
  },
  {
    id: 'rp-model', rep: 'verbal', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T, sr }) {
      const sc = pick(sr, RATIOS);
      // The unknown stands in a numerator, because the rig re-solves whichever
      // statement the cadet chooses and a letter under a bar is a different
      // question from the one this form is asking.
      const p = drawProportion(r, d, 2);
      const ans = `\\frac{${p.a}}{${p.b}} = \\frac{x}{${p.e}}`;
      return {
        stem: `${T(sc.ctx)} ${T('l2.ask.whichProportion')}`,
        latex: '\\frac{\\square}{\\square} = \\frac{\\square}{\\square}',
        type: 'expression',
        answer: ans,
        check: { kind: 'equationChoice', variable: 'x', expect: String(p.x) },
        steps: [
          { latex: `\\frac{${p.a}}{${p.b}}`, why: T('l2.why.firstPairIsTheRatio') },
          { latex: ans, why: T('l2.why.secondPairMatchesIt') },
        ],
        distractors: [
          { v: `\\frac{${p.b}}{${p.a}} = \\frac{x}{${p.e}}`, m: 'div-direction' },
          { v: `\\frac{${p.a}}{${p.e}} = \\frac{x}{${p.b}}`, m: 'swapped-roles' },
          { v: `\\frac{${p.e}}{${p.b}} = \\frac{x}{${p.a}}`, m: 'swapped-roles' },
          { v: `\\frac{${p.a}}{${p.b}} = \\frac{x}{${p.e + 1}}`, m: 'arith-slip' },
          { v: `\\frac{${p.b}}{${p.e}} = \\frac{x}{${p.a}}`, m: 'swapped-roles' },
        ],
      };
    },
  },
];

// ===========================================================================
// slope-rate  —  rise over run
// ===========================================================================
/** Two readings on one straight rule, with the rate the band asks for. */
function drawRate(r, d, { whole = false } = {}) {
  const run = whole ? 1 : int(r, 1, 1 + d);
  const rise = d >= 3 ? nz(r, -(2 + 2 * d), 2 + 2 * d) : int(r, 1, 2 + 2 * d);
  if (rise === 0) throw new Error('retry: a flat rule teaches nothing here');
  if (!whole && d >= 4 && rise % run === 0 && r() < 0.6) throw new Error('retry: draw a rate that is not whole');
  const x1 = d >= 3 ? int(r, -4 - d, 4 + d) : int(r, 0, 4 + d);
  const b0 = d >= 3 ? nz(r, -(4 + 2 * d), 4 + 2 * d) : int(r, 0, 4 + 2 * d);
  const x2 = x1 + run;
  const y1 = b0;
  const y2 = b0 + rise;
  return { x1, y1, x2, y2, rise, run };
}

const slopeRate = [
  {
    id: 'sr-points', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const p = drawRate(r, d);
      if (!distinct(p.x1, p.x2)) throw new Error('retry: two readings at one input');
      return {
        stem: T('l2.ask.rateBetweenReadings'),
        latex: ptsTex([p.x1, p.y1], [p.x2, p.y2]),
        type: 'numeric',
        answer: ratioStr(p.rise, p.run),
        check: { kind: 'line', points: [[p.x1, p.y1], [p.x2, p.y2]], want: 'slope' },
        steps: [
          { latex: `\\frac{${p.y2} - ${p.y1}}{${p.x2} - ${p.x1}}`, why: T('l2.why.riseOverRun') },
          { latex: `\\frac{${p.y2 - p.y1}}{${p.x2 - p.x1}} = ${ratio(p.rise, p.run)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(p.run, p.rise), m: 'run-over-rise' },
          { v: ratioStr(-p.rise, p.run), m: 'sign-slip' },
          { v: String(p.y2 - p.y1), m: 'partial-rule' },
          { v: String(p.x2 - p.x1), m: 'run-over-rise' },
          { v: ratioStr(p.y1 - p.y2, p.x2 - p.x1), m: 'sign-slip' },
          { v: ratioStr(p.y2 + p.y1, p.x2 + p.x1), m: 'add-not-subtract' },
          { v: String(p.y2), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'sr-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const p = drawRate(r, d);
      const rows = [0, 1, 2, 3].map((i) => [p.x1 + i * p.run, p.y1 + i * p.rise]);
      return {
        stem: T('l2.ask.rateFromTable'),
        latex: arrayTex('x', 'y', rows, -1),
        type: 'numeric',
        answer: ratioStr(p.rise, p.run),
        check: { kind: 'line', points: [[rows[0][0], rows[0][1]], [rows[1][0], rows[1][1]]], want: 'slope' },
        steps: [
          { latex: `\\frac{${rows[1][1]} - ${rows[0][1]}}{${rows[1][0]} - ${rows[0][0]}}`, why: T('l2.why.oneStepDownTheTable') },
          { latex: `\\frac{${p.rise}}{${p.run}} = ${ratio(p.rise, p.run)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(p.run, p.rise), m: 'run-over-rise' },
          { v: ratioStr(-p.rise, p.run), m: 'sign-slip' },
          { v: String(p.rise), m: 'partial-rule' },
          { v: String(p.run), m: 'run-over-rise' },
          { v: String(rows[0][1]), m: 'off-by-one-row' },
          { v: String(rows[1][1]), m: 'off-by-one-row' },
          { v: ratioStr(p.rise + p.run, p.run), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'sr-graph', rep: 'graph', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const lim = band(d).chart;
      const p = drawRate(r, d, { whole: true });
      if (Math.abs(p.rise) > lim - 1) throw new Error('retry: off chart');
      const x1 = int(r, -Math.floor(lim / 2), 0);
      const y1 = int(r, -Math.floor(lim / 2), Math.floor(lim / 2) - Math.abs(p.rise));
      const x2 = x1 + int(r, 1, 3);
      const y2 = y1 + p.rise * (x2 - x1);
      if (Math.abs(y2) > lim || Math.abs(x2) > lim) throw new Error('retry: off chart');
      const b = y1 - p.rise * x1;
      if (Math.abs(b) > lim) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.rateOfTrace'),
        latex: ptsTex([x1, y1], [x2, y2]),
        type: 'numeric',
        answer: String(p.rise),
        figure: { kind: 'line', m: p.rise, b, points: [[x1, y1], [x2, y2]], range: fitRange([[x1, y1], [x2, y2]], b) },
        check: { kind: 'line', points: [[x1, y1], [x2, y2]], want: 'slope' },
        steps: [
          { latex: `\\frac{${y2} - ${y1}}{${x2} - ${x1}}`, why: T('l2.why.riseOverRun') },
          { latex: `\\frac{${y2 - y1}}{${x2 - x1}} = ${p.rise}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(x2 - x1, y2 - y1), m: 'run-over-rise' },
          { v: String(-p.rise), m: 'sign-slip' },
          { v: String(y2 - y1), m: 'partial-rule' },
          { v: String(b), m: 'slope-intercept-swap' },
          { v: String(y2), m: 'axis-swap' },
          { v: String(x2), m: 'axis-swap' },
          { v: String(p.rise + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    // The rate of a line handed over as Ax + By = C. TEKS A.3(A) names this
    // form explicitly, and it is the first time the rate is not simply visible.
    id: 'sr-standard', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const a = nzc(r, 2, 4 + 3 * d);
      const b = nzc(r, 2, 4 + 2 * d);
      const c = nz(r, -(8 + 6 * d), 8 + 6 * d);
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = `${lin(a, 'x', 0)} ${signedTerm(b, 'y')} = ${c}`;
      return {
        stem: T('l2.ask.rateOfStatement'),
        latex: math,
        type: 'numeric',
        answer: ratioStr(-a, b),
        check: { kind: 'lineEquation', math, want: 'slope' },
        steps: [
          { latex: `${co(b, 'y')} = ${lin(-a, 'x', c)}`, why: T('l2.why.gatherYAlone') },
          { latex: `y = ${ratio(-a, b)}x ${sgRatio(c, b)}`, why: T('l2.why.divideByCoefOfY', { b }) },
          { latex: `\\frac{${-a}}{${b}} = ${ratio(-a, b)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(a, b), m: 'sign-slip' },
          { v: ratioStr(-b, a), m: 'run-over-rise' },
          { v: ratioStr(c, b), m: 'slope-intercept-swap' },
          { v: String(a), m: 'partial-rule' },
          { v: String(b), m: 'partial-rule' },
          { v: ratioStr(b, a), m: 'run-over-rise' },
          { v: ratioStr(-a, c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'sr-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = pick(sr, RATES);
      const run = int(r, 2, 2 + d);
      const rise = int(r, 2, 3 + 2 * d);
      const x1 = int(r, 0, 3 + d);
      const y1 = int(r, 1, 5 + 2 * d);
      const x2 = x1 + run;
      const y2 = y1 + rise;
      if (!distinct(x1, y1, x2, y2)) throw new Error('retry: repeated number');
      return {
        stem: `${T(sc.ctx)} ${T(sc.ask)}`,
        latex: ptsTex([x1, y1], [x2, y2]),
        type: 'numeric',
        answer: ratioStr(rise, run),
        check: { kind: 'line', points: [[x1, y1], [x2, y2]], want: 'slope' },
        steps: [
          { latex: `\\frac{${y2} - ${y1}}{${x2} - ${x1}}`, why: T('l2.why.riseOverRun') },
          { latex: `\\frac{${rise}}{${run}} = ${ratio(rise, run)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(run, rise), m: 'run-over-rise' },
          { v: String(rise), m: 'partial-rule' },
          { v: String(run), m: 'run-over-rise' },
          { v: ratioStr(y2, x2), m: 'partial-rule' },
          { v: ratioStr(rise + run, run), m: 'arith-slip' },
          { v: String(y2 - y1 + 1), m: 'arith-slip' },
          { v: ratioStr(-rise, run), m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// graph-linear  —  a rule drawn, and a line read back
// ===========================================================================
/**
 * A line that fits inside the chart at this band, on whole lattice points.
 *
 * The rungs here are the rate, the height it starts from, and the sign of
 * both. A band-5 trace climbs five for one and starts a dozen below the axis;
 * a band-1 trace climbs one or two and starts above it. `validate-courses`
 * measures the result, so these numbers are checked rather than claimed.
 */
const MSPAN = [2, 3, 4, 5, 6];
const BSPAN = [4, 7, 10, 14, 18];
/** How far the chart reaches at each band. A wider sky holds a steeper trace. */
const CHART = [8, 11, 14, 17, 20];
function drawChartLine(r, d) {
  const lim = CHART[d - 1];
  const ms = MSPAN[d - 1];
  const bs = BSPAN[d - 1];
  const m = d >= 3 ? nz(r, -ms, ms) : int(r, 1, ms);
  if (m === 0) throw new Error('retry: a flat trace');
  const b = d >= 2 ? nz(r, -bs, bs) : int(r, 1, bs);
  const reach = Math.max(1, Math.min(3, Math.floor((lim - 2) / Math.abs(m))));
  const x1 = -int(r, 0, reach);
  const x2 = x1 + int(r, 1, reach);
  if (x1 === x2) throw new Error('retry: two readings at one input');
  const pts = [[x1, m * x1 + b], [x2, m * x2 + b]];
  if (pts.some((p) => Math.abs(p[1]) > lim - 1 || Math.abs(p[0]) > lim - 1)) throw new Error('retry: off chart');
  return { m, b, lim, pts };
}

const graphLinear = [
  {
    id: 'gl-plot-points', rep: 'graph', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      return {
        stem: T('l2.ask.drawThroughBoth'),
        latex: ptsTex(g.pts[0], g.pts[1]),
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        figure: { kind: 'plot', range: fitRange(g.pts, g.b), target: { m: g.m, b: g.b }, points: g.pts },
        check: { kind: 'line', points: g.pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.pts[0][1]} - ${g.m} \\cdot \\left(${g.pts[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
        ],
        distractors: [
          { v: `y = ${lineTex(-g.m, g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.b, g.m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(g.m, -g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.m, 0)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(g.m + 1, g.b)}`, m: 'arith-slip' },
          { v: `y = ${lineTex(g.m, g.b + 1)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'gl-plot-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const step = g.pts[1][0] - g.pts[0][0];
      const rows = [0, 1, 2].map((i) => {
        const x = g.pts[0][0] + i * step;
        return [x, g.m * x + g.b];
      });
      if (rows.some((p) => Math.abs(p[1]) > g.lim - 1)) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.drawThroughTable'),
        latex: arrayTex('x', 'y', rows, -1),
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        figure: { kind: 'plot', range: fitRange(rows, g.b), target: { m: g.m, b: g.b }, points: rows.map((p) => [p[0], p[1]]) },
        check: { kind: 'line', points: [rows[0], rows[1]], want: 'equation' },
        steps: [
          { latex: `\\frac{${rows[1][1]} - ${rows[0][1]}}{${rows[1][0]} - ${rows[0][0]}} = ${g.m}`, why: T('l2.why.oneStepDownTheTable') },
          { latex: `${rows[0][1]} - ${g.m} \\cdot \\left(${rows[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
        ],
        distractors: [
          { v: `y = ${lineTex(-g.m, g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.b, g.m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(g.m, -g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.m, 0)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(g.m + 1, g.b)}`, m: 'arith-slip' },
          { v: `y = ${lineTex(g.m, g.b + 1)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'gl-read', rep: 'graph', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const at = g.pts[0][0] + int(r, 1, 3);
      const y = g.m * at + g.b;
      if (Math.abs(y) > g.lim - 1) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.traceHeightAt', { val: at }),
        latex: `${ptsTex(g.pts[0], g.pts[1])} \\quad x = ${at}`,
        type: 'numeric',
        answer: String(y),
        figure: { kind: 'line', m: g.m, b: g.b, points: g.pts, at, range: fitRange(g.pts.concat([[at, y]]), g.b) },
        check: { kind: 'graph', points: g.pts, mode: 'y', at },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.m} \\cdot \\left(${at}\\right) ${sg(g.b)}`, why: T('why.findColumn', { val: at }) },
          { latex: `${g.m * at} ${sg(g.b)} = ${y}`, why: T('why.readHeight') },
        ],
        distractors: [
          { v: String(at), m: 'axis-swap' },
          { v: String(g.b), m: 'slope-intercept-swap' },
          { v: String(g.m * at), m: 'partial-rule' },
          { v: String(-y), m: 'sign-slip' },
          { v: String(y + 1), m: 'arith-slip' },
          { v: String(y - 1), m: 'arith-slip' },
          { v: String(at + g.m), m: 'add-not-multiply' },
        ],
      };
    },
  },
  {
    id: 'gl-cross', rep: 'graph', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const x = g.pts[0][0] + int(r, 1, 4);
      const target = g.m * x + g.b;
      if (Math.abs(target) > g.lim - 1 || Math.abs(x) > g.lim - 1) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.traceReaches', { val: target }),
        latex: `${ptsTex(g.pts[0], g.pts[1])} \\quad y = ${target}`,
        type: 'numeric',
        answer: String(x),
        figure: { kind: 'line', m: g.m, b: g.b, points: g.pts, target, range: fitRange(g.pts.concat([[x, target]]), g.b) },
        check: { kind: 'graph', points: g.pts, mode: 'x', at: target },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${target} ${sg(-g.b)} = ${target - g.b}`, why: T('why.heightIsEquation', { val: target }) },
          { latex: `\\frac{${target - g.b}}{${g.m}} = ${x}`, why: T('why.divideBothByCoef', { a: g.m }) },
        ],
        distractors: [
          { v: String(target), m: 'axis-swap' },
          { v: String(g.b), m: 'slope-intercept-swap' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(target - g.b), m: 'partial-rule' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
          { v: String(g.m * target), m: 'div-direction' },
        ],
      };
    },
  },
  {
    // Key features off a statement in standard form. TEKS A.3(C) names the
    // x-intercept and the y-intercept, and neither is legible until the
    // statement is opened.
    id: 'gl-standard', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const a = nzc(r, 2, 2 + Math.min(d, 3));
      const b = nzc(r, 2, 2 + Math.min(d, 3));
      const q = nz(r, -(d - 1), d - 1);
      const c = a * b * q;                 // both intercepts land on whole numbers
      const wantX = r() < 0.5;
      const ans = wantX ? c / a : c / b;
      if (!distinct(a, b, c, ans)) throw new Error('retry: repeated number');
      const math = `${lin(a, 'x', 0)} ${signedTerm(b, 'y')} = ${c}`;
      return {
        stem: T(wantX ? 'l2.ask.crossesAcross' : 'l2.ask.crossesUpright'),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'lineEquation', math, want: wantX ? 'xintercept' : 'intercept' },
        steps: [
          {
            latex: wantX ? `${lin(a, 'x', 0)} = ${c}` : `${co(b, 'y')} = ${c}`,
            why: T(wantX ? 'l2.why.otherIsZeroAcross' : 'l2.why.otherIsZeroUpright'),
          },
          { latex: `\\frac{${c}}{${wantX ? a : b}} = ${ans}`, why: T('why.divideBothByCoef', { a: wantX ? a : b }) },
        ],
        distractors: [
          { v: String(wantX ? c / b : c / a), m: 'axis-swap' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(c), m: 'partial-rule' },
          { v: ratioStr(wantX ? -a : -b, wantX ? b : a), m: 'slope-intercept-swap' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(a + b), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'gl-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = pick(sr, RULES);
      const lim = CHART[d - 1];
      const m = int(r, 2, 2 + 2 * d);
      const b = int(r, 2, Math.max(3, lim - 3));
      const pts = [[0, b], [1, m + b]];
      if (Math.abs(pts[1][1]) > lim - 1) throw new Error('retry: off chart');
      return {
        stem: `${T(sc.ctx)} ${T(sc.draw)}`,
        latex: ptsTex(pts[0], pts[1]),
        type: 'expression',
        answer: `y = ${lineTex(m, b)}`,
        figure: { kind: 'plot', range: fitRange(pts, b), target: { m, b }, points: pts },
        check: { kind: 'line', points: pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${pts[1][1]} - ${pts[0][1]}}{${pts[1][0]} - ${pts[0][0]}} = ${m}`, why: T('l2.why.riseOverRun') },
          { latex: `${pts[1][1]} - ${m} = ${b}`, why: T('l2.why.backToTheAxis') },
          { latex: `y = ${lineTex(m, b)}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: [
          { v: `y = ${lineTex(b, m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(-m, b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(m, 0)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(m, -b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(m + 1, b)}`, m: 'arith-slip' },
          { v: `y = ${lineTex(m, b + 1)}`, m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// write-linear  —  the rule written down
// ===========================================================================
const RULE_SKELETON = 'y = \\square x + \\square';

/** The six rules a learner writes instead of the right one. */
function ruleWrong(m, b) {
  return [
    { v: `y = ${lineTex(b, m)}`, m: 'slope-intercept-swap' },
    { v: `y = ${lineTex(-m, b)}`, m: 'sign-slip' },
    { v: `y = ${lineTex(m, -b)}`, m: 'sign-on-constant' },
    { v: `y = ${lineTex(m, 0)}`, m: 'partial-rule' },
    { v: `y = ${lineTex(m + 1, b)}`, m: 'arith-slip' },
    { v: `y = ${lineTex(m, b + 1)}`, m: 'arith-slip' },
  ];
}

const writeLinear = [
  {
    id: 'wl-points', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      return {
        stem: T('l2.ask.writeTheRule'),
        latex: `${ptsTex(g.pts[0], g.pts[1])} \\qquad ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        check: { kind: 'line', points: g.pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.pts[0][1]} - ${g.m} \\cdot \\left(${g.pts[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
        ],
        distractors: ruleWrong(g.m, g.b),
      };
    },
  },
  {
    id: 'wl-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const step = int(r, 1, 1 + Math.floor(d / 2));
      const rows = [0, 1, 2, 3].map((i) => {
        const x = g.pts[0][0] + i * step;
        return [x, g.m * x + g.b];
      });
      return {
        stem: T('l2.ask.writeTheRule'),
        latex: `${arrayTex('x', 'y', rows, -1)} \\qquad ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        check: { kind: 'line', points: [rows[0], rows[1]], want: 'equation' },
        steps: [
          { latex: `\\frac{${rows[1][1]} - ${rows[0][1]}}{${rows[1][0]} - ${rows[0][0]}} = ${g.m}`, why: T('l2.why.oneStepDownTheTable') },
          { latex: `${rows[0][1]} - ${g.m} \\cdot \\left(${rows[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
        ],
        distractors: ruleWrong(g.m, g.b),
      };
    },
  },
  {
    id: 'wl-graph', rep: 'graph', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      return {
        stem: T('l2.ask.writeTheTrace'),
        latex: RULE_SKELETON,
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        figure: { kind: 'line', m: g.m, b: g.b, points: g.pts, range: fitRange(g.pts, g.b) },
        check: { kind: 'line', points: g.pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.pts[0][1]} - ${g.m} \\cdot \\left(${g.pts[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
        ],
        distractors: ruleWrong(g.m, g.b),
      };
    },
  },
  {
    // The same line, said the other way. TEKS A.2(B) asks for the rule in
    // various forms, and turning Ax + By = C into y = mx + b is the turn a
    // learner needs before any of the graphing work is usable.
    id: 'wl-standard', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const b = nzc(r, 2, 3 + d);
      const m = nz(r, -(2 + d), 2 + d);
      const k = nz(r, -(4 + 2 * d), 4 + 2 * d);
      if (m === 0 || k === 0) throw new Error('retry: a flat trace');
      const a = -m * b;
      const c = k * b;
      if (a === 0 || !distinct(a, b, c, m, k)) throw new Error('retry: repeated number');
      const math = `${lin(a, 'x', 0)} ${signedTerm(b, 'y')} = ${c}`;
      return {
        stem: T('l2.ask.sameLineOtherWay'),
        latex: `${math} \\;\\Rightarrow\\; ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(m, k)}`,
        check: { kind: 'lineEquation', math, want: 'equation' },
        steps: [
          { latex: `${co(b, 'y')} = ${lin(-a, 'x', c)}`, why: T('l2.why.gatherYAlone') },
          { latex: `y = ${lineTex(m, k)}`, why: T('l2.why.divideByCoefOfY', { b }) },
        ],
        distractors: [
          { v: `y = ${lineTex(-m, k)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(a, c)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(k, m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(m, -k)}`, m: 'sign-on-constant' },
          { v: `y = ${lineTex(m, c)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(m + 1, k)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'wl-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = pick(sr, RULES);
      const m = d >= 3 ? nz(r, -(2 + 2 * d), 2 + 2 * d) : int(r, 2, 2 + 2 * d);
      const b = d >= 2 ? nz(r, -(4 + 3 * d), 4 + 3 * d) : int(r, 1, 7);
      if (m === 0 || b === 0 || !distinct(m, b)) throw new Error('retry: repeated number');
      const pts = [[0, b], [1, m + b]];
      return {
        stem: `${T(sc.ctx)} ${T(sc.write)}`,
        latex: `${ptsTex(pts[0], pts[1])} \\qquad ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(m, b)}`,
        check: { kind: 'line', points: pts, want: 'equation' },
        steps: [
          { latex: `${pts[1][1]} - ${pts[0][1]} = ${m}`, why: T('l2.why.oneStepIsTheRate') },
          { latex: `${pts[0][1]} = ${b}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: ruleWrong(m, b),
      };
    },
  },
];

// ===========================================================================
// system-substitution  —  one letter already alone
// ===========================================================================
/** A pair of statements meeting at whole numbers, the first already solved for y. */
function drawSubSystem(r, d) {
  const x = d >= 3 ? nz(r, -(3 + d), 4 + d) : int(r, 1, 3 + d);
  const y = d >= 3 ? nz(r, -(3 + d), 4 + d) : int(r, 1, 3 + d);
  const m = d >= 3 ? nzc(r, -(2 + d), 2 + d) : int(r, 2, 2 + d);
  const b = y - m * x;
  const a = d >= 3 ? nzc(r, -(3 + d), 3 + d) : int(r, 2, 3 + d);
  const c = a * x + y;
  if (b === 0 || !distinct(a, b, c, m)) throw new Error('retry: repeated number');
  const e1 = `y = ${lin(m, 'x', b)}`;
  const e2 = `${lin(a, 'x', 0)} + y = ${c}`;
  return { x, y, m, b, a, c, e1, e2, latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}` };
}

const systemSubstitution = [
  {
    id: 'ss-forx', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const s = drawSubSystem(r, d);
      return {
        stem: T('l2.ask.findX'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.x),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(s.a, 'x', 0)} + ${lin(s.m, 'x', s.b)} = ${s.c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `${lin(s.a + s.m, 'x', s.b)} = ${s.c}`, why: T('why.gatherSameKind', { v: 'x' }) },
          { latex: `x = ${s.x}`, why: T('why.divideBothByCoef', { a: s.a + s.m }) },
        ],
        distractors: [
          { v: String(s.y), m: 'axis-swap' },
          { v: String(-s.x), m: 'sign-slip' },
          { v: String(s.c - s.b), m: 'partial-rule' },
          { v: String(s.x + 1), m: 'arith-slip' },
          { v: String(s.x - 1), m: 'arith-slip' },
          { v: String(s.b), m: 'partial-rule' },
          { v: String(s.c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'ss-fory', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const s = drawSubSystem(r, d);
      return {
        stem: T('l2.ask.findY'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.y),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'y' },
        steps: [
          { latex: `${lin(s.a, 'x', 0)} + ${lin(s.m, 'x', s.b)} = ${s.c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `x = ${s.x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${s.m} \\cdot \\left(${s.x}\\right) ${sg(s.b)} = ${s.y}`, why: T('l2.why.backIntoTheRule') },
        ],
        distractors: [
          { v: String(s.x), m: 'axis-swap' },
          { v: String(-s.y), m: 'sign-slip' },
          { v: String(s.b), m: 'partial-rule' },
          { v: String(s.y + 1), m: 'arith-slip' },
          { v: String(s.y - 1), m: 'arith-slip' },
          { v: String(s.m * s.x), m: 'partial-rule' },
          { v: String(s.c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'ss-pair', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const s = drawSubSystem(r, d);
      return {
        stem: T('l2.ask.whichPairHoldsBoth'),
        latex: `${s.latex} \\qquad \\left(\\square, \\square\\right)`,
        type: 'expression',
        answer: pointTex(s.x, s.y),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'pair' },
        steps: [
          { latex: `${lin(s.a, 'x', 0)} + ${lin(s.m, 'x', s.b)} = ${s.c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `x = ${s.x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${s.y}`, why: T('l2.why.backIntoTheRule') },
        ],
        distractors: [
          { v: pointTex(s.y, s.x), m: 'axis-swap' },
          { v: pointTex(-s.x, s.y), m: 'sign-slip' },
          { v: pointTex(s.x, -s.y), m: 'sign-slip' },
          { v: pointTex(s.x + 1, s.y), m: 'arith-slip' },
          { v: pointTex(s.x, s.y + 1), m: 'arith-slip' },
          { v: pointTex(s.b, s.c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'ss-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = pick(sr, PAIRS);
      const x = int(r, 2, 4 + d);
      const y = int(r, 2, 4 + d);
      const m = int(r, 2, 2 + d);
      const b = y - m * x;
      const a = int(r, 2, 3 + d);
      const c = a * x + y;
      if (b === 0 || !distinct(a, b, c, m, x, y)) throw new Error('retry: repeated number');
      const e1 = `y = ${lin(m, 'x', b)}`;
      const e2 = `${lin(a, 'x', 0)} + y = ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.x)}`,
        latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}`,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(a, 'x', 0)} + ${lin(m, 'x', b)} = ${c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `${lin(a + m, 'x', b)} = ${c}`, why: T('why.gatherSameKind', { v: 'x' }) },
          { latex: `x = ${x}`, why: T('why.divideBothByCoef', { a: a + m }) },
        ],
        distractors: [
          { v: String(y), m: 'axis-swap' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
          { v: String(b), m: 'partial-rule' },
          { v: String(c), m: 'partial-rule' },
          { v: String(m), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// system-elimination  —  add until one letter leaves
// ===========================================================================
/** Two statements in standard form whose y-terms are already opposite. */
function drawElimSystem(r, d, { scaled = false } = {}) {
  const x = d >= 3 ? nz(r, -(3 + d), 4 + d) : int(r, 1, 3 + d);
  const y = d >= 3 ? nz(r, -(3 + d), 4 + d) : int(r, 1, 3 + d);
  const a1 = d >= 3 ? nzc(r, -(3 + d), 3 + d) : int(r, 2, 3 + d);
  const a2 = d >= 3 ? nzc(r, -(3 + d), 3 + d) : int(r, 2, 3 + d);
  const b1 = nzc(r, 2, 2 + d);
  const k = scaled ? int(r, 2, 2 + d) : 1;
  const b2 = -b1 * k;
  if (a1 * b2 - a2 * b1 === 0) throw new Error('retry: the traces never meet');
  if (!distinct(a1, a2, b1, k)) throw new Error('retry: repeated number');
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;
  const e1 = `${lin(a1, 'x', 0)} ${signedTerm(b1, 'y')} = ${c1}`;
  const e2 = `${lin(a2, 'x', 0)} ${signedTerm(b2, 'y')} = ${c2}`;
  return { x, y, a1, a2, b1, b2, c1, c2, k, e1, e2, latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}` };
}

const systemElimination = [
  {
    id: 'se-add', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const s = drawElimSystem(r, d);
      return {
        stem: T('l2.ask.findX'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.x),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(s.a1 + s.a2, 'x', 0)} = ${s.c1 + s.c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${s.x}`, why: T('why.divideBothByCoef', { a: s.a1 + s.a2 }) },
        ],
        distractors: [
          { v: String(s.y), m: 'axis-swap' },
          { v: String(-s.x), m: 'sign-slip' },
          { v: String(s.c1 + s.c2), m: 'partial-rule' },
          { v: String(s.x + 1), m: 'arith-slip' },
          { v: String(s.x - 1), m: 'arith-slip' },
          { v: String(s.c1 - s.c2), m: 'subtract-not-add' },
          { v: String(s.a1 + s.a2), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'se-scale', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const s = drawElimSystem(r, d, { scaled: true });
      return {
        stem: T('l2.ask.findX'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.x),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(s.a1 * s.k, 'x', 0)} ${signedTerm(s.b1 * s.k, 'y')} = ${s.c1 * s.k}`, why: T('l2.why.scaleUntilOpposite', { k: s.k }) },
          { latex: `${lin(s.a1 * s.k + s.a2, 'x', 0)} = ${s.c1 * s.k + s.c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${s.x}`, why: T('why.divideBothByCoef', { a: s.a1 * s.k + s.a2 }) },
        ],
        distractors: [
          { v: String(s.y), m: 'axis-swap' },
          { v: String(-s.x), m: 'sign-slip' },
          { v: String(s.c1 + s.c2), m: 'partial-rule' },
          { v: String(s.x + 1), m: 'arith-slip' },
          { v: String(s.x - 1), m: 'arith-slip' },
          { v: String(s.c1 * s.k + s.c2), m: 'partial-rule' },
          { v: String(s.k), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'se-fory', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const s = drawElimSystem(r, d);
      return {
        stem: T('l2.ask.findY'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.y),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'y' },
        steps: [
          { latex: `${lin(s.a1 + s.a2, 'x', 0)} = ${s.c1 + s.c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${s.x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${s.y}`, why: T('l2.why.backIntoEitherStatement') },
        ],
        distractors: [
          { v: String(s.x), m: 'axis-swap' },
          { v: String(-s.y), m: 'sign-slip' },
          { v: String(s.c1 + s.c2), m: 'partial-rule' },
          { v: String(s.y + 1), m: 'arith-slip' },
          { v: String(s.y - 1), m: 'arith-slip' },
          { v: String(s.c1), m: 'partial-rule' },
          { v: String(s.b1), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'se-context', rep: 'context', dMin: 1, dMax: 5,
    build({ r, d, T, sr }) {
      const sc = pick(sr, PAIRS);
      const x = int(r, 2, 4 + d);
      const y = int(r, 2, 4 + d);
      const a1 = int(r, 2, 3 + d);
      const a2 = int(r, 2, 3 + d);
      const b1 = int(r, 2, 2 + d);
      const b2 = -b1;
      if (a1 * b2 - a2 * b1 === 0) throw new Error('retry: the traces never meet');
      if (!distinct(a1, a2, b1) || x === y) throw new Error('retry: repeated number');
      const c1 = a1 * x + b1 * y;
      const c2 = a2 * x + b2 * y;
      const e1 = `${lin(a1, 'x', 0)} + ${b1}y = ${c1}`;
      const e2 = `${lin(a2, 'x', 0)} - ${b1}y = ${c2}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.y)}`,
        latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}`,
        type: 'numeric',
        answer: String(y),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'y' },
        steps: [
          { latex: `${lin(a1 + a2, 'x', 0)} = ${c1 + c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${y}`, why: T('l2.why.backIntoEitherStatement') },
        ],
        distractors: [
          { v: String(x), m: 'axis-swap' },
          { v: String(c1 + c2), m: 'partial-rule' },
          { v: String(y + 1), m: 'arith-slip' },
          { v: String(y - 1), m: 'arith-slip' },
          { v: String(c1 - c2), m: 'subtract-not-add' },
          { v: String(c1), m: 'partial-rule' },
          { v: String(b1), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// bracket-both-sides —  a(x + b) = c(x + d)      (shipped in the first Level 2)
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
  const g = gcdOf(n, k);
  return `${n / g}/${k / g}`;
}
function gcdOf(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
/** The keypad answer format for an exact rate: "3", "-3", "3/2". */
function ratioStr(n, dd) {
  if (dd === 0) throw new Error('retry: a rate with no run');
  let a = n, b = dd;
  if (b < 0) { a = -a; b = -b; }
  const g = gcdOf(a, b);
  return b / g === 1 ? String(a / g) : `${a / g}/${b / g}`;
}
/** "+ \frac{3}{4}", "- 2" — an exact value, signed, to stand after another. */
function sgRatio(n, dd) {
  const s = ratio(n, dd);
  return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`;
}
/** "+ 3y", "- y" — a signed term to stand after another one. */
function signedTerm(c, v) {
  const a = Math.abs(c);
  return `${c < 0 ? '-' : '+'} ${a === 1 ? v : `${a}${v}`}`;
}
/**
 * A chart just big enough for what is on it.
 *
 * A grid that reaches to the band's outer limit while the readings sit in one
 * corner is a grid a cadet cannot place a point on: at forty units across, one
 * lattice step is seven pixels and the knob covers two of them. So the chart is
 * cut to the data, with a margin to see the trace leave.
 */
function fitRange(pts, extra = 0) {
  let far = 4;
  for (const [x, y] of pts) far = Math.max(far, Math.abs(x), Math.abs(y));
  return Math.max(5, Math.ceil(Math.max(far, Math.abs(extra)) + 2));
}
/** "3x + 2", "-x - 4", "5" — a straight line written the one way. */
function lineTex(m, b) {
  if (m === 0) return String(b);
  if (b === 0) return co(m, 'x');
  return `${co(m, 'x')} ${sg(b)}`;
}
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
    'inequality-one-step': inequalityOneStep,
    'inequality-two-step': inequalityTwoStep,
    'inequality-multi-step': inequalityMultiStep,
    'compound-inequality': compoundInequality,
    'literal-equations': literalEquations,
    'ratio-proportion': ratioProportion,
    'slope-rate': slopeRate,
    'graph-linear': graphLinear,
    'write-linear': writeLinear,
    'system-substitution': systemSubstitution,
    'system-elimination': systemElimination,
  },
  strings: { en, es, pl },
};
