/**
 * The echo: what a cadet is shown after a slip, and in what order.
 *
 * This module owns the *content* of the faded worked example. The surface owns
 * only its pixels. Three things had to be true for it to be worth anything:
 *
 *   1. **The first layer carries mathematics, and it is aimed.** A sentence
 *      naming a misconception is a diagnosis, not a lesson. So layer one is
 *      always something computed from the learner's own move, and which thing
 *      depends on what the move was — a teacher does not answer "you squared
 *      the minus" the way they answer "you read the log one row down". The
 *      probes, in the order they are tried:
 *
 *        · a number set beside another instead of multiplied  ->  the product
 *          and the two-digit number, side by side;
 *        · a minus read into the base of a power  ->  both readings expanded;
 *        · a power read as a multiplication  ->  the copies written out;
 *        · an expression read strictly left to right  ->  the brackets they
 *          drew in without noticing, with their own value beside them;
 *        · any other wrong evaluation  ->  the input that *would* have given
 *          their number, because their answer is the answer to some question
 *          and naming that question takes it seriously;
 *        · a value handed to an equation  ->  both pans reweighed, and which
 *          way the beam tipped, so they know whether to aim higher or lower;
 *        · an equation with no unique answer  ->  two substitutions, showing a
 *          gap that never closes or a statement that never fails;
 *        · a burned log line  ->  the rate between surviving rows and the rate
 *          their number implies, left unworked, because working them out is
 *          the lesson;
 *        · a point off a trace  ->  the same, in fractions;
 *        · a log line whose *input* burned  ->  their number run through the
 *          rule at the head of the column;
 *        · a rewrite  ->  the invariance test: put a number in, and whatever
 *          you write has to come to what this comes to;
 *        · a legal-but-useless move on the beam  ->  what is still standing in
 *          the way, counted, not gestured at;
 *        · a move that changed the solution set  ->  proof that it did.
 *
 *      Nothing is asserted that the rig has not just computed, and any probe
 *      it cannot compute is a probe it does not show. `tools/validate-items.mjs`
 *      pushes every tagged wrong value of every form through layer one and
 *      fails the build if any of them comes back with the prompt restated.
 *
 *   2. **Every layer differs from the one above it.** The ladder is a real
 *      fading sequence — complete, partial, none, run backwards. A row can be
 *      `full` (notation and reason), `open` (its left side and its reason, the
 *      right side burned to a box — a completion problem), or `hidden` (reason
 *      only). Layer 2 opens one move; layer 3 opens every move but the landing;
 *      layer 4 gives the landing away. Because a row's *reason* survives at
 *      every level, the cadet always has something to think with.
 *
 *   3. **Nothing here leaks the live answer.** The worked trace comes from a
 *      different tear (`./scaffold.js` guarantees the analogue shares no digits
 *      with the live answer), and the counterexample never prints the value the
 *      live rift wants — only the value the cadet handed in, and the fact that
 *      the statement rejects it.
 *
 * Everything a learner reads comes from `content/lang/items.*.js`, so the whole
 * ladder exists in EN, ES and PL.
 */
import { evaluate, varsOf, solveLinear, parse, parseEquation, linearize, parseArrayCells } from './parser.js';
import { R, str as rstr, texOf, fromString, eq as reqq, sub, isZero, toNum } from './rational.js';
import { makeT } from './strings.js';

export const MAX_TIER = 4;

const BOX = '\\square';
/** A subtracted negative needs its brackets: "7 - -3" is notation nobody writes. */
const par = (n) => (n < 0 ? `\\left(${n}\\right)` : String(n));
const HIDDEN = '\\square \\;\\; \\square \\;\\; \\square';

/** Replace a variable with a value, without touching letters inside \commands. */
function substitute(latex, v, valueTex) {
  let out = '';
  for (let i = 0; i < latex.length;) {
    if (latex[i] === '\\') {
      const m = /^\\[a-zA-Z]+|^\\./.exec(latex.slice(i));
      const tok = m ? m[0] : '\\';
      out += tok; i += tok.length; continue;
    }
    if (latex[i] === v) { out += valueTex; i++; continue; }
    out += latex[i]; i++;
  }
  return out;
}

/**
 * Write a value in for a letter, and check by evaluation that the notation
 * still means what it meant.
 *
 * Textual replacement is a trap: putting 4 into "5t + 12" gives "54 + 12",
 * which is a different and false statement rendered in exactly the same font
 * as a true one. Brackets always fix it and sometimes clutter it, so both
 * renderings are built and the unbracketed one is used only when parsing it
 * back gives the same value the substitution was supposed to have. Nothing is
 * shown on the strength of looking right.
 *
 * @returns {string|null} notation that is verified to carry the same value
 */
function substituteVerified(latex, v, val, env = {}) {
  let want;
  try { want = evaluate(latex, { ...env, [v]: val }); } catch { return null; }
  for (const written of [rstr(val), `\\left(${rstr(val)}\\right)`]) {
    const out = substitute(latex, v, written);
    try { if (reqq(evaluate(out, env), want)) return out; } catch { /* try the next */ }
  }
  return null;
}

/** Write every known value into an expression at once, or give up. */
function substituteAll(latex, env) {
  let out = latex;
  const left = { ...env };
  for (const name of Object.keys(env)) {
    delete left[name];
    out = substituteVerified(out, name, env[name], left);
    if (!out) return null;
  }
  return out;
}

/** Top-level split of "a = b" into its two sides, or null. */
function sides(latex) {
  if (/\\square|\\Rightarrow|\\begin/.test(latex)) return null;
  const parts = String(latex).split('=').map((p) => p.trim()).filter(Boolean);
  return parts.length === 2 ? parts : null;
}

/**
 * The side of the displayed prompt that carries the situation.
 *
 * "m + m + m + m = \square" holds its truth on the left and a gap on the
 * right. Substituting into that side gives a counterexample built from what is
 * already on the learner's screen — the strongest kind, because there is
 * nothing to take on trust.
 */
function promptTruth(item, v) {
  const raw = String(item.latex || '');
  if (/\\begin|\\Rightarrow/.test(raw)) return null;
  const parts = raw.split('=').map((p) => p.trim());
  const usable = parts.filter((p) => p && !/\\square/.test(p) && varsOf(p).length === 1 && varsOf(p)[0] === v);
  if (usable.length !== 1) return null;
  return usable[0];
}

/** The variable this item is about. */
function varOf(item) {
  if (item.check?.variable) return item.check.variable;
  const m = String(item.answer).match(/[a-zA-Z]/) || String(item.latex).match(/(?<!\\)[a-zA-Z](?![a-zA-Z])/);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// Instruments the probes are built from.
//
// Every one of these either computes an exact fact or returns null. Nothing in
// the echo is ever asserted because it is probably true.
// ---------------------------------------------------------------------------

/** Bind every known value except `v`, so what is left is a function of `v` alone. */
function holdOthers(latex, v, env = {}) {
  let out = latex;
  const rest = { ...env };
  delete rest[v];
  const left = { ...rest };
  for (const name of Object.keys(rest)) {
    delete left[name];
    const bound = typeof rest[name] === 'number' ? R(rest[name]) : rest[name];
    out = substituteVerified(out, name, bound, left);
    if (!out) return null;
  }
  return out;
}

/**
 * "Your number would be right if the letter were …"
 *
 * The single most useful sentence a teacher has for a wrong evaluation, because
 * it treats the learner's answer as the answer to *some* question and then shows
 * which question that was. It never prints the value this item wants: it prints
 * the input that would have produced theirs.
 *
 * @returns {import('./rational.js').Rational|null}
 */
function inputThatGives(latex, v, target, env = {}) {
  const f = holdOthers(latex, v, env);
  if (!f) return null;
  try {
    const sol = solveLinear(`${f} = ${rstr(target)}`, v);
    return sol.kind === 'unique' ? sol.value : null;
  } catch { return null; }
}

/**
 * Rebuild the expression the way a strict left-to-right reader would have
 * grouped it, and show the brackets they invisibly inserted.
 *
 * Only attempted on a flat chain of numbers and binary operators, because that
 * is the only shape where "read it as it comes" is unambiguous — and it is
 * exactly the shape where order of operations bites.
 */
const FLAT_CHAIN = /^\s*-?\d+(?:\s*(?:\+|-|\\cdot|\\div)\s*-?\d+)+\s*$/;
function leftToRightTex(latex) {
  if (!FLAT_CHAIN.test(latex)) return null;
  // Rebuild as ((a op b) op c) …, bracketing every join the notation does not.
  const parts = String(latex).trim().split(/(\\cdot|\\div|\+|(?<=\d)\s-)/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 5 || parts.length % 2 === 0) return null;
  let tex = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    // The outermost pair would wrap the whole line and say nothing: the
    // brackets worth drawing are the ones inside, where the reading went wrong.
    tex = i + 2 < parts.length ? `\\left(${tex} ${parts[i]} ${parts[i + 1]}\\right)` : `${tex} ${parts[i]} ${parts[i + 1]}`;
  }
  return tex;
}

/**
 * A power read as a multiplication. `3^{2}` handed in as 6 is not an arithmetic
 * slip, it is a reading of the notation, and the answer to it is the notation
 * written out in full: three, twice, multiplied.
 *
 * @returns {{tex:string, base:number, k:number}|null}
 */
function powerAsCopies(latex, env, target) {
  const m = /(?:\\left\()?\s*(-?\d+)\s*(?:\\right\))?\s*\^\s*\{?\s*(\d+)\s*\}?/.exec(latex);
  if (!m) return null;
  const base = Number(m[1]);
  const k = Number(m[2]);
  if (!(k >= 2 && k <= 4)) return null;
  const mis = latex.slice(0, m.index) + `\\left(${base} \\cdot ${k}\\right)` + latex.slice(m.index + m[0].length);
  try { if (!reqq(evaluate(mis, env), target)) return null; } catch { return null; }
  return { tex: `${m[0].trim()} = ${Array.from({ length: k }, () => base).join(' \\cdot ')}`, base, k };
}

/**
 * A minus sign that belongs to the base, and one that does not.
 *
 * `-3^{2}` is minus nine and `\left(-3\right)^{2}` is nine, and the whole
 * difference is a pair of brackets. A cadet who hands in the second value has
 * not made an arithmetic error; they have read a bracket that is not there. So
 * the answer is both readings, spelled out in full, side by side.
 *
 * @returns {{tex:string}|null}
 */
function negativeBaseRead(latex, env, target) {
  const m = /(^|[^\d\w}])-\s*(\d+)\s*\^\s*\{?\s*(\d+)\s*\}?/.exec(latex);
  if (!m) return null;
  const base = Number(m[2]);
  const k = Number(m[3]);
  if (!(k >= 2 && k <= 4)) return null;
  const bracketed = `\\left(-${base}\\right)^{${k}}`;
  const mis = latex.slice(0, m.index) + m[1] + bracketed + latex.slice(m.index + m[0].length);
  try { if (!reqq(evaluate(mis, env), target)) return null; } catch { return null; }
  const copies = (x) => Array.from({ length: k }, () => x).join(' \\cdot ');
  return {
    tex: `${bracketed} = ${copies(`\\left(-${base}\\right)`)} \\qquad -${base}^{${k}} = -\\left(${copies(base)}\\right)`,
  };
}

/** A number written where a product belongs: "2" beside "11" read as 211. */
function juxtaposedDigits(raw, parts) {
  const want = String(raw).trim();
  for (const a of parts) {
    for (const b of parts) {
      if (a === b) continue;
      if (`${a}${b}` === want) return { a, b };
    }
  }
  return null;
}

/**
 * The rule written at the head of a log's second column.
 *
 * It is read back out of the notation the learner is looking at rather than out
 * of the item's internals, so what the probe runs a number through is provably
 * the rule on screen and not a private copy of it.
 *
 * @returns {{tex:string, v:string}|null}
 */
function headerRule(latex) {
  let cells;
  try { cells = parseArrayCells(latex); } catch { return null; }
  const head = cells[0];
  if (!head || head.length !== 2) return null;
  const v = String(head[0]).trim();
  if (!/^[a-zA-Z]$/.test(v)) return null;
  const tex = String(head[1]).trim();
  const vars = varsOf(tex);
  if (vars.length !== 1 || vars[0] !== v) return null;
  return { tex, v };
}

/** The two sides of a linear equation as a single (a·v + b) difference. */
function slopeOf(latex, v) {
  try {
    const { left, right } = parseEquation(latex);
    const L = linearize(left, v), Rt = linearize(right, v);
    return { a: sub(L.a, Rt.a), b: sub(L.b, Rt.b) };
  } catch { return null; }
}

/**
 * What is still standing between the unknown and its value.
 *
 * A learner mid-solve who has just made a legal but useless move needs to be
 * told what is left in the way, not that they were wrong — they were not wrong.
 * So the state is read structurally: is the unknown on both pans, is something
 * multiplying it, is something added to it.
 */
function whatBlocks(stateTex, v) {
  const parts = sides(stateTex);
  if (!parts) return null;
  let L, Rt;
  try {
    L = linearize(parse(parts[0]), v);
    Rt = linearize(parse(parts[1]), v);
  } catch { return null; }
  const bothSides = !isZero(L.a) && !isZero(Rt.a);
  const a = sub(L.a, Rt.a);
  const b = sub(L.b, Rt.b);
  if (isZero(a)) return null;
  const coef = !reqq(a, R(1)) && !reqq(a, R(-1));
  const konst = !isZero(b);
  return { bothSides, coef, konst, a, b };
}

// ---------------------------------------------------------------------------
// Layer one: the learner's own entry, put back into the statement.
// ---------------------------------------------------------------------------
/**
 * Build a counterexample from what the cadet actually entered.
 *
 * Every branch either computes the contradiction and returns it, or returns
 * nothing. It never guesses. The value the live rift wants is never printed.
 *
 * @returns {Array<{cls:string, latex:string, why:string}>}
 */
export function counterexample(item, entry, T) {
  const raw = entry == null ? '' : String(entry).trim();
  if (!raw) return [];
  const v = varOf(item);
  const kind = item.check?.kind;

  try {
    // --- an equation with no unique answer at all --------------------------
    //
    // "No solution" and "every value works" are not values, so there is no
    // number to argue with — but there is something far better to show. A
    // contradiction differs by the same amount whatever you put in; an identity
    // agrees whatever you put in. Two substitutions make each of those visible,
    // and two substitutions is a thing a cadet can do for themselves for ever
    // after.
    // It runs whatever the cadet typed, including a number: on an identity a
    // number is not false, it is merely one of infinitely many, and being shown
    // a second one that also works is the only way to see that.
    if (kind === 'solve' && v && sides(item.latex)) {
      let shape = null;
      try { shape = solveLinear(item.latex, v).kind; } catch { shape = null; }
      if (shape === 'none' || shape === 'all') {
        const eq = sides(item.latex);
        const trials = [];
        for (const t of [2, 5, 3, 4, 7]) {
          if (trials.length === 2) break;
          const put = eq.map((s) => substituteVerified(s, v, R(t)));
          if (!put.every(Boolean)) continue;
          let got;
          try { got = eq.map((s) => evaluate(s, { [v]: R(t) })); } catch { continue; }
          trials.push({ t, tex: `${rstr(got[0])} ${shape === 'none' ? '\\ne' : '='} ${rstr(got[1])}`, put });
        }
        if (trials.length === 2) {
          return [
            {
              cls: 'rf-echo-probe',
              latex: `${trials[0].put[0]} \\;\\;${shape === 'none' ? '\\ne' : '='}\\;\\; ${trials[0].put[1]}`,
              why: T(shape === 'none' ? 'echo.tryOneNumber' : 'echo.tryOneNumberHolds', { v, t: trials[0].t }),
            },
            {
              cls: 'rf-echo-probe verdict',
              latex: `${trials[1].tex} \\qquad \\left(${v} = ${trials[1].t}\\right)`,
              why: T(shape === 'none' ? 'echo.gapNeverCloses' : 'echo.holdsEverywhere'),
            },
          ];
        }
      }
    }

    // --- a chart is a log you can see --------------------------------------
    //
    // A straight trace climbs at one rate along its whole length, so the point
    // a cadet hands in either sits on that rate or it does not, and the check
    // is two fractions written side by side. Left unworked, as ever: the
    // arithmetic is the lesson.
    if (kind === 'graph' && Array.isArray(item.check.points) && item.check.points.length >= 2) {
      const val = fromString(raw);
      const [p, q] = item.check.points;
      if (val && val.d === 1) {
        const mine = item.check.mode === 'x' ? [val.n, item.check.at] : [item.check.at, val.n];
        const frac = (A, B) => (A[0] === B[0] ? null
          : `\\frac{${B[1]} - ${par(A[1])}}{${B[0]} - ${par(A[0])}}`);
        const rate = (A, B) => (A[0] === B[0] ? null : (B[1] - A[1]) / (B[0] - A[0]));
        const known = frac(p, q);
        const ours = frac(p, mine) || frac(q, mine);
        const oursRate = rate(p, mine) ?? rate(q, mine);
        if (known && ours && Math.abs(oursRate - rate(p, q)) > 1e-9) {
          return [
            { cls: 'rf-echo-probe', latex: known, why: T('echo.traceOneRate') },
            { cls: 'rf-echo-probe verdict', latex: ours, why: T('echo.yourPointBreaksIt') },
          ];
        }
      }
    }

    // --- solving: put the proposed value back on the beam ------------------
    if (kind === 'solve' && v) {
      const val = fromString(raw);
      const eq = sides(item.latex);
      if (val && eq) {
        const got = eq.map((s) => evaluate(s, { [v]: val }));
        if (!reqq(got[0], got[1])) {
          // Only a side that actually contains the unknown is worth rewriting;
          // printing "18 = 18" beside it teaches nothing.
          const shown = eq.map((s, i) => {
            if (!varsOf(s).includes(v)) return null;
            const put = substituteVerified(s, v, val);
            return put ? `${put} = ${rstr(got[i])}` : null;
          });
          if (!shown.some(Boolean)) return [];
          const rows = [
            {
              cls: 'rf-echo-probe',
              latex: shown.filter(Boolean).join(' \\qquad '),
              why: T('echo.substituteYours', { v, val: rstr(val) }),
            },
            {
              cls: 'rf-echo-probe verdict',
              latex: `${rstr(got[0])} \\ne ${rstr(got[1])}`,
              why: T('echo.sidesDisagree'),
            },
          ];
          // Which way it tipped is a fact, and it is the fact that tells them
          // what to do next. A linear beam is monotone in the unknown, so the
          // sign of the mismatch against the sign of the coefficient settles
          // whether they aimed high or low — without naming the value.
          const lin = slopeOf(item.latex, v);
          if (lin && !isZero(lin.a)) {
            const gap = sub(got[0], got[1]);
            const high = (toNum(gap) > 0) === (toNum(lin.a) > 0);
            rows.push({
              cls: 'rf-echo-probe aim',
              latex: `${v} ${high ? '<' : '>'} ${texOf(val)}`,
              why: T(high ? 'echo.aimedHigh' : 'echo.aimedLow', { v, val: rstr(val) }),
            });
          }
          return rows;
        }
      }
    }

    // --- evaluating: the statement itself refuses their number -------------
    if (kind === 'evaluate' && item.check.math) {
      const val = fromString(raw);
      const env = item.check.env || {};
      if (val) {
        const got = evaluate(item.check.math, env);
        if (!reqq(got, val)) {
          const bound = Object.fromEntries(Object.entries(env).map(([n, x]) => [n, typeof x === 'number' ? R(x) : x]));
          const put = substituteAll(item.check.math, bound);
          const rows = [];
          if (put) {
            rows.push({
              cls: 'rf-echo-probe verdict',
              latex: `${put} \\ne ${rstr(val)}`,
              why: T('echo.notThatNumber', { val: rstr(val) }),
            });
          }

          // The oldest slip on the graph: the number beside the letter read as
          // a digit rather than a multiplier, so 2 and 11 come back as 211.
          // Nothing to compute — just the two readings written out, one of
          // which is a product and one of which is a two-digit number.
          const onScreen = [
            ...(String(item.check.math).match(/\d+/g) || []),
            ...Object.values(bound).map((x) => rstr(x)),
          ];
          const jx = juxtaposedDigits(raw, [...new Set(onScreen)]);
          if (jx) {
            rows.push({
              cls: 'rf-echo-probe',
              latex: `${jx.a} \\cdot ${jx.b} \\ne ${jx.a}${jx.b}`,
              why: T('echo.sideBySideIsNotTimes', { a: jx.a, b: jx.b }),
            });
            return rows;
          }

          // A minus that was read as belonging to the base.
          const nb = negativeBaseRead(item.check.math, bound, val);
          if (nb) {
            rows.push({ cls: 'rf-echo-probe', latex: nb.tex, why: T('echo.minusOutsideThePower') });
            return rows;
          }

          // A power read as a repeated multiplication of base by exponent. The
          // answer to that is the notation spelled out, and nothing else.
          const pw = powerAsCopies(item.check.math, bound, val);
          if (pw) {
            rows.push({
              cls: 'rf-echo-probe',
              latex: pw.tex,
              why: T('echo.powerIsCopies', { base: pw.base, k: pw.k }),
            });
            return rows;
          }

          // Straight left to right. If that reading reproduces their number
          // exactly, the brackets they were reading are drawn in for them —
          // which is a far better answer than being told about precedence.
          const ltr = leftToRightTex(item.check.math);
          if (ltr) {
            let same = false;
            try { same = reqq(evaluate(ltr, bound), val); } catch { same = false; }
            if (same) {
              rows.push({
                cls: 'rf-echo-probe',
                latex: `${ltr} = ${rstr(val)}`,
                why: T('echo.bracketsYouAdded'),
              });
              return rows;
            }
          }

          // Otherwise: their number is the reading this expression gives at
          // some other input. Naming that input is the teacher's move — it
          // takes the answer seriously instead of only refusing it.
          if (bound[v] !== undefined) {
            const need = inputThatGives(item.check.math, v, val, bound);
            if (need && !reqq(need, bound[v])) {
              rows.push({
                cls: 'rf-echo-probe',
                latex: `${holdOthers(item.check.math, v, bound)} = ${texOf(val)} \\;\\Rightarrow\\; ${v} = ${texOf(need)}`,
                why: T('echo.yoursNeeds', { v, need: rstr(need), val: rstr(bound[v]) }),
              });
            }
          }
          if (rows.length) return rows;
        }
      }
    }

    // --- a reading of a situation: try their reading on a real number ------
    if ((kind === 'equivalent' || item.type === 'expression') && v) {
      const target = item.check?.math || item.answer;
      const truth = promptTruth(item, v);
      for (const t of [3, 4, 5, 2, 6, 7]) {
        let mine, theirs;
        try { mine = evaluate(raw, { [v]: t }); } catch { break; }
        try { theirs = evaluate(target, { [v]: t }); } catch { break; }
        if (reqq(mine, theirs)) continue;
        // The statement the rift is holding open, with a number in it. It is
        // already on the learner's screen, so nothing is given away by writing
        // it out — and the arithmetic that settles the argument is theirs.
        const put = truth ? substituteVerified(truth, v, R(t)) : null;
        return [
          {
            cls: 'rf-echo-probe',
            latex: `\\left. ${raw} \\right|_{${v} = ${t}} = ${rstr(mine)}`,
            why: T('echo.yourReadingAt', { v, t, val: rstr(mine) }),
          },
          {
            cls: 'rf-echo-probe verdict',
            latex: put ? `${put} \\ne ${rstr(mine)}` : `\\left. ${BOX} \\right|_{${v} = ${t}} \\ne ${rstr(mine)}`,
            why: T('echo.countItByHand', { v, t, val: rstr(mine) }),
          },
        ];
      }
    }

    // --- a burned row of a log ---------------------------------------------
    //
    // One rule made every line of the log, so between any two lines the reading
    // climbs at the same rate. That is the whole content of a linear table, and
    // it is checkable by hand from what is already on screen. The probe writes
    // the rate between each surviving pair of rows, and the rate their number
    // would imply, as unevaluated fractions — deliberately unevaluated, because
    // the arithmetic that settles it is the arithmetic worth doing.
    if (kind === 'table' && Array.isArray(item.check.rows)) {
      const val = fromString(raw);
      const src = item.check.rows;
      const miss = item.check.missing;
      const solvingForX = item.check.solveFor === 'x';

      // The rule is written at the head of the column, in full, where the cadet
      // can see it. When the burned cell is an *input*, running their number
      // through that rule is the whole check — and it never touches the value
      // the line actually wants.
      if (val && solvingForX && src[miss]) {
        const rule = headerRule(item.latex);
        if (rule) {
          const put = substituteVerified(rule.tex, rule.v, val);
          let got = null;
          try { got = evaluate(rule.tex, { [rule.v]: val }); } catch { got = null; }
          if (put && got && !reqq(got, R(src[miss][1]))) {
            return [
              { cls: 'rf-echo-probe', latex: put, why: T('echo.runItThroughTheRule', { val: rstr(val) }) },
              {
                cls: 'rf-echo-probe verdict',
                latex: `${rstr(got)} \\ne ${src[miss][1]}`,
                why: T('echo.ruleRefusesYours', { y: src[miss][1] }),
              },
            ];
          }
        }
      }

      if (val && val.d === 1 && src.length >= 3 && src[miss]) {
        const mine = src.map((row, i) => (i === miss
          ? (solvingForX ? [val.n, row[1]] : [row[0], val.n])
          : row));

        // Their number repeats a reading the log already gives at another
        // input, on a log that plainly does not stand still.
        const twin = src.findIndex((row, i) => i !== miss && (solvingForX ? row[0] === val.n : row[1] === val.n));
        const flat = solvingForX
          ? src.every((row) => row[0] === src[0][0])
          : src.every((row) => row[1] === src[0][1]);
        if (twin >= 0 && !flat) {
          const col = solvingForX ? 0 : 1;
          const other = solvingForX ? 1 : 0;
          return [{
            cls: 'rf-echo-probe verdict',
            latex: `${src[twin][other]} \\;\\to\\; ${src[twin][col]} \\qquad ${mine[miss][other]} \\;\\to\\; ${mine[miss][col]}`,
            why: T(solvingForX ? 'echo.sameOutputTwice' : 'echo.sameInputTwice'),
          }];
        }

        const rate = (rows, i) => {
          const dx = rows[i + 1][0] - rows[i][0];
          const dy = rows[i + 1][1] - rows[i][1];
          if (!dx) return null;
          return { tex: `\\frac{${rows[i + 1][1]} - ${par(rows[i][1])}}{${rows[i + 1][0]} - ${par(rows[i][0])}}`, q: dy / dx };
        };
        const truth = src.slice(0, -1).map((_, i) => rate(src, i));
        const ours = mine.slice(0, -1).map((_, i) => rate(mine, i));
        if (truth.every(Boolean) && ours.every(Boolean)
          && truth.every((g) => Math.abs(g.q - truth[0].q) < 1e-9)
          && ours.some((g) => Math.abs(g.q - truth[0].q) > 1e-9)) {
          const clean = truth.filter((_, i) => i !== miss && i !== miss - 1);
          const dirty = ours.filter((_, i) => i === miss || i === miss - 1);
          return [
            {
              cls: 'rf-echo-probe',
              latex: clean.map((g) => g.tex).join(' \\qquad '),
              why: T('echo.everyPairSameRate'),
            },
            {
              cls: 'rf-echo-probe verdict',
              latex: dirty.map((g) => g.tex).join(' \\qquad '),
              why: T('echo.yourRateBreaksIt'),
            },
          ];
        }
      }
    }

    // --- a chosen equation: solve theirs and read the number back ----------
    //
    // A model is not wrong the way arithmetic is wrong. It is wrong about the
    // world, and the only way to see that is to follow it to the number it
    // names and hold that number up against the story. So the echo does the
    // following: it solves the equation the cadet signed.
    if (kind === 'equationChoice' && v) {
      const mine = varsOf(raw).length === 1 ? raw : null;
      if (mine) {
        let named = null;
        try {
          const sol = solveLinear(mine, v);
          if (sol.kind === 'unique') named = rstr(sol.value);
        } catch { named = null; }
        if (named) {
          return [
            { cls: 'rf-echo-probe', latex: mine, why: T('echo.yourModelSays', { v }) },
            {
              cls: 'rf-echo-probe verdict',
              latex: `${v} = ${named}`,
              why: T('echo.yourModelNames', { v, val: named }),
            },
          ];
        }
        return [{ cls: 'rf-echo-probe verdict', latex: mine, why: T('echo.yourModelSays', { v }) }];
      }
    }
  } catch { /* a probe we cannot compute is a probe we do not show */ }

  return [];
}

/**
 * The rule that governs every rewrite: an expression may be rewritten, but not
 * changed.
 *
 * When a cadet is rearranging notation — collecting terms, opening a bracket,
 * pulling a factor out — there is often no numeric entry to argue with, only a
 * chip in the wrong bay. The honest answer is not the rule they broke, it is
 * the test that would have caught them: put a number in, and whatever you write
 * has to come to what this comes to.
 *
 * The substituted expression is printed *unevaluated* on purpose. Working it
 * out is the work, and handing over the total would hand over the test.
 *
 * @returns {Array<{cls:string, latex:string, why:string}>}
 */
export function invarianceProbe(item, T) {
  const v = varOf(item);
  const src = item?.check?.math || item?.latex;
  if (!v || !src || /\\square|\\begin|\\Rightarrow|=/.test(String(src))) return [];
  if (!varsOf(src).includes(v)) return [];
  const onScreen = new Set(String(item.latex).match(/\d+/g) || []);
  for (const t of [3, 4, 5, 2, 6, 10, 7]) {
    if (onScreen.has(String(t))) continue;
    const put = substituteVerified(src, v, R(t));
    if (!put) continue;
    try { evaluate(put, {}); } catch { continue; }
    return [{
      cls: 'rf-echo-probe verdict',
      latex: put,
      why: T('echo.mustAgreeAt', { v, t }),
    }];
  }
  return [];
}

/**
 * A move on the beam that was legal but got nowhere, or illegal and quietly
 * changed the question.
 *
 * The surface hands us the statement the cadet's move left standing. Comparing
 * it with the statement they started from is a fact, not an opinion: either the
 * two are about the same number or they are not, and either way there is a real
 * sentence to say about it.
 *
 * @returns {Array<{cls:string, latex:string, why:string}>}
 */
export function stateProbe(item, stateTex, T, fallbackKey) {
  const v = varOf(item);
  const say = (why, latex = stateTex) => [{ cls: 'rf-echo-probe verdict', latex, why }];
  if (!v || !stateTex || !sides(stateTex)) return say(T(fallbackKey || 'echo.whereItStands'));

  // A move made while *rewriting* an expression asserts an identity: "3x + 5"
  // and "8x" are the same thing. An identity is refuted by one number, and one
  // number is what the cadet gets — chosen, substituted and evaluated here so
  // that nothing is claimed the rig has not just watched come apart.
  if (!sides(item?.latex || '')) {
    const two = sides(stateTex);
    for (const t of [2, 3, 4, 5, 6]) {
      let l, rr;
      try { l = evaluate(two[0], { [v]: R(t) }); rr = evaluate(two[1], { [v]: R(t) }); } catch { break; }
      if (reqq(l, rr)) continue;
      const put = two.map((s) => substituteVerified(s, v, R(t)));
      return [
        { cls: 'rf-echo-probe', latex: stateTex, why: T(fallbackKey || 'echo.thatMergeSays') },
        {
          cls: 'rf-echo-probe verdict',
          latex: put.every(Boolean) ? `${put[0]} \\ne ${put[1]}` : `${rstr(l)} \\ne ${rstr(rr)}`,
          why: T('echo.oneNumberBreaksIt', { v, t }),
        },
      ];
    }
    return say(T(fallbackKey || 'echo.whereItStands'));
  }
  let was, now;
  try { was = solveLinear(item.latex, v); now = solveLinear(stateTex, v); } catch { return say(T(fallbackKey || 'echo.whereItStands')); }

  // The move changed which number the beam is about. That is provable: take the
  // number the new line names, put it back into the tear as it was given, and
  // watch the pans come apart.
  if (was.kind === 'unique' && now.kind === 'unique' && !reqq(was.value, now.value)) {
    const eq = sides(item.latex);
    const got = eq.map((s) => { try { return evaluate(s, { [v]: now.value }); } catch { return null; } });
    if (got.every(Boolean) && !reqq(got[0], got[1])) {
      const shown = eq.map((s, i) => {
        if (!varsOf(s).includes(v)) return null;
        const put = substituteVerified(s, v, now.value);
        return put ? `${put} = ${rstr(got[i])}` : null;
      }).filter(Boolean);
      return [
        { cls: 'rf-echo-probe', latex: stateTex, why: T('echo.moveNames', { v, val: rstr(now.value) }) },
        {
          cls: 'rf-echo-probe verdict',
          latex: shown.length ? shown.join(' \\qquad ') : `${rstr(got[0])} \\ne ${rstr(got[1])}`,
          why: T('echo.moveChangedIt'),
        },
      ];
    }
    return say(T('echo.moveChangedIt'));
  }

  // The move was legal. It simply did not get anywhere, and the useful thing to
  // say is what is still standing in the way — counted, not gestured at.
  const blk = whatBlocks(stateTex, v);
  if (blk) {
    if (blk.bothSides) return say(T('echo.stillBothSides', { v }));
    if (blk.coef && blk.konst) return say(T('echo.stillTwoThings', { v }));
    if (blk.coef) return say(T('echo.stillMultiplied', { v, a: rstr(blk.a) }));
    if (blk.konst) return say(T('echo.stillAdded', { v }));
  }
  return say(T(fallbackKey || 'echo.whereItStands'));
}

// ---------------------------------------------------------------------------
// Layers two to four: a worked trace, faded.
// ---------------------------------------------------------------------------
/** LHS shown, RHS burned to a box — a completion problem, not a blank. */
function openTex(latex) {
  if (/\\Rightarrow/.test(latex)) return latex.replace(/\\Rightarrow[\s\S]*$/, `\\Rightarrow ${BOX}`);
  const i = String(latex).indexOf('=');
  if (i < 0) return HIDDEN;
  return `${latex.slice(0, i).trim()} = ${BOX}`;
}

/**
 * The rows of a worked trace at a given depth.
 *
 * @param {Array<{latex:string, why:string}>} steps
 * @param {number} tier 2..4
 * @param {boolean} live true when this is the learner's own item (no analogue
 *        was available), in which case the landing line is never given away.
 */
function tracedRows(steps, tier, live) {
  const n = steps.length;
  const rows = [];
  const last = n - 1;
  for (let i = 0; i < n; i++) {
    const s = steps[i];
    let level;
    if (live) {
      // the cadet's own tear: the final line is never handed over, but its
      // left-hand side is, so the last move is theirs to complete.
      if (i < last) level = tier >= 3 ? 'full' : (i === 0 ? 'full' : 'hidden');
      else level = tier >= 4 ? 'open' : 'hidden';
    } else if (tier === 2) {
      level = i === 0 ? 'full' : 'open';
    } else {
      level = 'full';
    }
    rows.push({
      cls: 'rf-echo-step' + (level === 'full' ? '' : level === 'open' ? ' masked' : ' burned'),
      latex: level === 'full' ? s.latex : level === 'open' ? openTex(s.latex) : HIDDEN,
      why: s.why,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The whole script for one depth.
// ---------------------------------------------------------------------------
/**
 * @param {object} o
 * @param {object} o.item      the live item
 * @param {object|null} o.analogue a verified worked analogue (see scaffold.js)
 * @param {string|null} o.entry what the learner actually entered
 * @param {number} o.tier      1..4
 * @param {string} o.locale
 * @returns {{rows:Array, sealed:string|null}}
 */
export function echoScript({
  item, analogue = null, entry = null, tier = 1, locale = 'en',
  state = null, stateKey = 'echo.whereItStands',
}) {
  const T = makeT(locale);
  const rows = [];

  // ---- layer 1: aimed at the entry, and carrying real notation -----------
  // On the beam, on the bays and on the field, what the cadet "entered" is a
  // move rather than a value, and the honest thing to read back to them is the
  // statement their move left standing.
  const probe = counterexample(item, entry, T);
  if (probe.length) rows.push(...probe);
  else if (state) rows.push(...stateProbe(item, state, T, stateKey));
  else {
    // No value to argue with and no move to read back. There is still one
    // thing to say that is mathematics rather than a restatement of the
    // question: whatever you write in its place has to agree with it.
    const inv = invarianceProbe(item, T);
    if (inv.length) rows.push(...inv);
    else if (item?.latex) rows.push({ cls: 'rf-echo-probe', latex: item.latex, why: T('echo.theTear') });
  }
  if (tier <= 1) return { rows, sealed: null };

  // ---- layers 2-4: a trace, faded --------------------------------------
  const ex = analogue && analogue.steps?.length ? analogue : null;
  const steps = (ex ? ex.steps : item?.steps) || [];
  if (!steps.length) return { rows, sealed: null };
  const live = !ex;

  rows.push({ rule: true });
  rows.push({
    cls: 'rf-echo-lead alt',
    text: live ? T('echo.ownTraceOnly') : T('echo.differentTear'),
  });
  let shown = steps;
  if (ex) {
    // A "which reading is it?" tear carries no notation of its own — only a
    // gap — so the situation itself is the seed.
    const bare = !ex.latex || /^\s*(\\square|\\;|\\,|\s)+$/.test(ex.latex);
    if (bare) rows.push({ cls: 'rf-echo-step seed prose', text: ex.stem || T('echo.theTear') });
    else rows.push({ cls: 'rf-echo-step seed', latex: ex.latex, why: ex.stem || T('echo.theTear') });
    // Some forms open by restating the prompt. Printing it twice, once as the
    // tear and once as the first move, wastes the rung.
    if (!bare && shown.length > 2 && shown[0].latex.replace(/\s+/g, '') === ex.latex.replace(/\s+/g, '')) {
      shown = shown.slice(1);
    }
  }
  rows.push(...tracedRows(shown, tier, live));

  if (!live) {
    rows.push({
      cls: 'rf-echo-step landing' + (tier >= 4 ? '' : ' burned'),
      latex: tier >= 4 ? String(ex.answer) : HIDDEN,
      why: tier >= 4 ? T('echo.landsAt') : T('echo.landingBurned'),
    });
  }
  return { rows, sealed: !live && tier >= 4 ? String(ex.answer) : null };
}

/**
 * Do the four depths actually differ?  Used by tools/validate-items.mjs: a
 * ladder whose rungs render the same thing is a dead scaffold, and that is the
 * exact failure this module exists to prevent.
 */
export function ladderOf(item, analogue, entry, locale = 'en') {
  const out = [];
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const { rows } = echoScript({ item, analogue, entry, tier, locale });
    out.push(rows.map((r) => (r.rule ? '—' : `${r.cls}|${r.latex || ''}|${r.why || r.text || ''}`)).join('\n'));
  }
  return out;
}

/**
 * The notation of the *trace* at full depth — the worked lines only.
 *
 * The counterexample is deliberately excluded: it is assembled out of the
 * statement already on the learner's screen and the value they themselves just
 * entered, so digits it shares with the live answer are not something the
 * learner could have copied from anywhere. The trace is the part that must
 * stay clean, and the gate measures it here.
 */
export function ladderNotation(item, analogue, entry, locale = 'en') {
  const { rows } = echoScript({ item, analogue, entry, tier: MAX_TIER, locale });
  return rows.filter((r) => r.latex && !/rf-echo-probe/.test(r.cls || '')).map((r) => r.latex);
}
