#!/usr/bin/env node
/**
 * THE TEACHING GATE.
 *
 *   node tools/check-echo.mjs                 # the report, non-zero on any miss
 *   node tools/check-echo.mjs 8               # eight seeds per form per band
 *   node tools/check-echo.mjs --self-test     # prove the gate can fail
 *   node tools/check-echo.mjs --json          # the same numbers, as data
 *
 * WHY THIS EXISTS
 *
 * The fourth invariant of this build is "invisible explicit teaching": the
 * instruction is complete, and it arrives as a faded worked echo aimed at the
 * misconception a wrong answer has just revealed. Layer one of that echo is the
 * whole claim. It is supposed to be a COMPUTED refusal built from the learner's
 * own entry — their brackets multiplied back out, their value put on the beam,
 * their rate measured against the readings it has to pass through.
 *
 * A curriculum critic measured how often that actually happened, per level:
 *
 *     Level 1  100.0%   Level 2  100.0%   Level 3   93.4%
 *     Level 4   53.4%   Level 5   17.9%
 *
 * Sixteen skills sat at 0.0%. `counterexample()` in src/learn/echo.js had no
 * handler for any check kind Levels 4 and 5 introduced — factored, quadratic,
 * twoWayTable, regression, halfPlane, sequence, rationalExponent, polyQuotient
 * — so it fell through to a bare reprint of the prompt with the sentence "this
 * is what the rift is asking, and nothing more than this." A cadet who had just
 * made a specific, named, well-attested error had their own question read back
 * to them. That is worse than silence, and no other gate could see it:
 * `tools/validate-items.mjs` walks the shipped Level 1 bank only, and
 * `tools/simulate.mjs` uses the same number as a simulation parameter rather
 * than as a bar to clear.
 *
 * WHAT IT MEASURES
 *
 * For every node of every unit in content/courses.json, every item form, every
 * difficulty band and every seed, it takes EVERY misconception-tagged wrong
 * answer the generator can produce for that item and pushes it through the real
 * `counterexample()`. A tagged slip passes only if all of the following hold:
 *
 *   1. an aimed probe answered it at all — `counterexample()` returned rows,
 *      rather than the caller falling back to the invariance probe or to the
 *      prompt;
 *   2. the rows carry NOTATION, not only a sentence about the learner;
 *   3. the notation is not the prompt reprinted;
 *   4. every line renders under the same strict KaTeX the game uses;
 *   5. no reason line still holds an unfilled `{placeholder}`;
 *   6. the same holds in EN, ES and PL — a probe that computes in English and
 *      falls silent in Polish is not a probe, it is an English probe.
 *
 * AND THE SECOND HALF: THE WORKED ANALOGUE
 *
 * Layer one is the refusal. Layers two to four are the lesson — "a different
 * rift, the same shape", opened a line at a time, with a reason on every line
 * and the landing burned until the last rung. That half had NO gate at all
 * over Levels 2 to 5. `tools/validate-items.mjs` measures it, and measures it
 * well, but it walks `SKILLS` at a bare import, which is TEN skills of
 * sixty-two: the ladder-fade rule, the reason-per-line rule and the
 * answer-leak rule were all Level 1 rules wearing a course-wide name. Measured
 * across the manifest for the first time, the deepest layer had no example at
 * all for 3.9% of Level 4 items and 8.6% of Level 5 — those cadets were handed
 * their OWN problem back, opened — and 38 of 414 Level 3 examples were the
 * live problem with the letter repainted, which prints the whole answer.
 *
 * So the same walk now also asks, of every item of every node of every unit:
 *
 *   1. is there a worked example at all — and when there is not, does a search
 *      SIX TIMES wider still find nothing? (If a wider search finds one, the
 *      chooser gave up early and that is a defect. If it does not, the bank
 *      genuinely holds no clean example and the gate names the item, with the
 *      count, rather than passing it in silence.)
 *   2. is it a DIFFERENT problem — not the live prompt, and not the live
 *      prompt with the unknown repainted;
 *   3. does it land somewhere else — not the live answer, under any letter;
 *   4. does every worked line carry a reason;
 *   5. do the four depths actually differ from one another;
 *   6. is the live answer never printed anywhere in the trace, at any depth;
 *   7. and does every line render under strict KaTeX, in EN, ES and PL.
 *
 * WHAT IT DOES NOT MEASURE
 *
 * Whether the mathematics is the RIGHT mathematics to show. No machine can
 * check that. What it can check is that mathematics was computed at all, which
 * is exactly the failure that shipped.
 */
import katex from 'katex';
import { generate } from '../src/learn/generators.js';
import { formsFor } from '../src/content/registry.js';
import { allUnits, loadUnit } from './_courses.mjs';
import { counterexample, echoScript, MAX_TIER } from '../src/learn/echo.js';
import { analogueFor } from '../src/learn/scaffold.js';
import { makeT } from '../src/learn/strings.js';
import { diagnose } from '../src/learn/diagnose.js';
import en from '../content/lang/items.en.js';
import { findings } from './_findings.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
/** Seeds per form per band. Four is the floor a defect has survived; more is better. */
const N = Number(argv.find((a) => /^\d+$/.test(a)) || 4);
/**
 * Seeds per form per band for the SECOND walk.
 *
 * The analogue walk auditions up to 96 candidates per pass per locale, so it
 * costs roughly forty times what a layer-one probe costs. Two seeds a cell is
 * 2,796 items and 16 seconds; the numeric argument scales it when a defect
 * needs cornering.
 */
const M = Number(argv.find((a) => /^\d+$/.test(a)) || 2);
const JSON_OUT = has('--json');
const SELF_TEST = has('--self-test');
const LOCALES = ['en', 'es', 'pl'];
const T = Object.fromEntries(LOCALES.map((l) => [l, makeT(l)]));
const RESTATEMENT = en['echo.theTear'];
const norm = (t) => String(t).replace(/\s+/g, '').replace(/\\left|\\right/g, '');

/**
 * Exceptions, with a reason each, and nothing else.
 *
 * An entry here says: this tagged slip is real, and there is no computed
 * contradiction to show, because the cadet's answer is not mathematically
 * wrong. The list is keyed on `skill/form/misconception` and every line has to
 * survive being read aloud to a teacher.
 */
const ALLOW = [];

/**
 * Does layer one answer this slip with computed mathematics?
 *
 * The predicate is separated from the walk so `--self-test` can drive it
 * directly with an item whose kind has no handler.
 *
 * @returns {{ok:boolean, why?:string}}
 */
export function judge(item, entry, locale = 'en') {
  let rows;
  try { rows = counterexample(item, entry, T[locale] || T.en); } catch (e) { return { ok: false, why: `probe threw: ${e.message}` }; }
  if (!rows.length) return { ok: false, why: 'no aimed probe answered the slip' };
  return inspectRows(rows, item);
}

/**
 * The rows themselves, judged apart from where they came from.
 *
 * Split out so `--self-test` can drive each refusal directly, rather than
 * hoping some real item happens to produce a broken line.
 */
export function inspectRows(rows, item) {
  const math = rows.filter((r) => r.latex);
  if (!math.length) return { ok: false, why: 'the answer carries no notation at all' };
  if (math.length === 1 && item.latex && norm(math[0].latex) === norm(item.latex)) {
    return { ok: false, why: 'the answer is the prompt, reprinted' };
  }
  return inspectLines(rows);
}

/**
 * One row at a time: a sentence that still holds a placeholder, a command that
 * lost its backslash, notation strict KaTeX will not take.
 *
 * Shared by both halves of the gate — the refusal at layer one and every
 * worked line of the analogue at layers two to four are held to the same bar,
 * because a learner cannot tell which half of the column they are reading.
 */
export function inspectLines(rows) {
  for (const r of rows) {
    const why = r.why || r.text || '';
    if (/\{[a-zA-Z]\w*\}/.test(why)) return { ok: false, why: `an unfilled placeholder survived: "${why}"` };
    if (!r.latex) continue;
    // A COMMAND THAT LOST ITS BACKSLASH.
    //
    // `\;` inside a JavaScript template literal is not an escape: the backslash
    // silently disappears and `2 \;\to\; 25` ships as `2 ;\to; 25`. KaTeX takes
    // that without complaint and renders punctuation where a space was meant,
    // so no other gate can see it. One shipped that way. The same trap catches
    // `\qquad`, `\quad` and `\cdot`, so every command is stripped off and what
    // is left is read for the wreckage.
    const stripped = String(r.latex).replace(/\\[a-zA-Z]+|\\./g, ' ');
    if (/[;]/.test(stripped)) {
      return { ok: false, why: `a spacing command lost its backslash: "${r.latex}"` };
    }
    const orphan = /\b(qquad|quad|cdot|frac|sqrt|left|right|approx|square|bullet|circ)\b/.exec(stripped);
    if (orphan) {
      return { ok: false, why: `the command "${orphan[1]}" lost its backslash: "${r.latex}"` };
    }
    try {
      katex.renderToString(String(r.latex), { throwOnError: true, strict: 'error', displayMode: false });
    } catch (e) {
      return { ok: false, why: `strict KaTeX refuses "${r.latex}": ${String(e.message).slice(0, 90)}` };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// LAYER TWO: the worked analogue.
// ---------------------------------------------------------------------------
/**
 * The same notation with every unknown blanked out.
 *
 * Two draws that differ only in their letter are one problem, not two, and the
 * caption over the deepest layer says "a different rift". Letters inside a
 * control sequence are notation, so `\sqrt` and `\frac` survive untouched.
 */
export function blankLetters(src) {
  const t = norm(src);
  let out = '';
  for (let i = 0; i < t.length;) {
    if (t[i] === '\\') {
      const m = /^\\[a-zA-Z]+|^\\./.exec(t.slice(i));
      const tok = m ? m[0] : '\\';
      out += tok; i += tok.length; continue;
    }
    out += /[a-zA-Z]/.test(t[i]) ? '@' : t[i];
    i++;
  }
  return out;
}

/**
 * The same value, spelled the way a HAND would have to type it.
 *
 * THE GATE AND THE GAME WERE SPEAKING DIFFERENT LANGUAGES, AND THE GATE WON.
 *
 * Every tagged wrong value below arrives from the generator in the notation the
 * BANK writes — `2\sqrt{6}`. The keypad cannot type a backslash, so what the
 * rift actually hands `counterexample()` is the pad's own plain alphabet,
 * `2√6`. Fed that, `parse()` refused it, every probe returned nothing, and
 * layer one fell through to the prompt reprinted under "This is what the rift
 * is asking, and nothing more than this" — the exact defect this gate exists to
 * catch, live in the running game on every radical, every plus-or-minus and
 * every fraction a cadet typed, while this file printed 100.0% for all five
 * levels. It was found by clicking the real caps of the real pad; no amount of
 * feeding the module its own dialect could ever have shown it.
 *
 * So every slip is now pushed through TWICE — as the bank writes it and as a
 * hand would type it — and the two have to come back with the same notation.
 * This is the inverse of `padToTex` in `src/learn/echo.js` and of `toPad` in
 * `src/ui/rift.js`; if any of the three drifts, the round trip stops matching
 * and this fails.
 *
 * @returns {string|null} the pad spelling, or null when the pad could not type
 *          this value at all and there is nothing to compare.
 */
export function asAHandWouldType(value) {
  const wrap = (b) => (/^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(String(b).trim()) ? String(b).trim() : `(${String(b).trim()})`);
  let s = String(value ?? '')
    .replace(/\\left|\\right|\\!|\\,|\;|\\ /g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pm/g, '±')
    .replace(/\\le(?![a-zA-Z])/g, '≤')
    .replace(/\\ge(?![a-zA-Z])/g, '≥');
  for (let guard = 0; guard < 16; guard++) {
    const before = s;
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^$1');
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `${wrap(a)}/${wrap(b)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => '√' + wrap(a));
    if (s === before) break;
  }
  s = s.replace(/\s+/g, '');
  return /\\/.test(s) ? null : s;
}

/**
 * Does `needle` stand on its own inside `hay`?
 *
 * Plain `includes` reads "23" out of "1234" and calls an honest example a
 * leak; joining rows with no separator manufactures matches out of thin air —
 * a trace ending `t = 3` followed by the landing `3` reads as `t = 33`. Both
 * traps were live in the first draft of this rule and both produced findings
 * that were false. Rows are joined with a bar, and a match counts only where
 * nothing alphanumeric runs into it.
 */
export function standsAlone(hay, needle) {
  if (!needle || needle.length < 2) return false;
  const alnum = (c) => c !== undefined && /[0-9A-Za-z]/.test(c);
  const headAl = /[0-9A-Za-z]/.test(needle[0]);
  const tailAl = /[0-9A-Za-z]/.test(needle[needle.length - 1]);
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (headAl && alnum(hay[i - 1])) continue;
    if (tailAl && alnum(hay[i + needle.length])) continue;
    return true;
  }
  return false;
}

/**
 * Judge the deeper layers of one item, in one locale.
 *
 * `ex` is passed in rather than drawn here so the caller can draw it once and
 * hold it against all three locales, and so `--self-test` can hand this an
 * example it has deliberately spoiled.
 *
 * @returns {{ok:boolean, why?:string}}
 */
export function judgeExample(item, ex, entry, locale = 'en') {
  if (!ex) return { ok: false, why: 'no worked example at all' };
  // A DIFFERENT PROBLEM, AND A DIFFERENT LANDING.
  //
  // "Which rule models this?" items carry NO notation of their own — only a
  // box — so for those, sameness lives in the situation and the stem is what
  // is compared. A prompt that holds a real table and a box at the end is not
  // one of those: the table is the problem, and it has to be a different
  // table. `analogueFor` treats every prompt containing a box as a skeleton,
  // which would leave those tables unchecked, so the test here is the narrower
  // one — nothing but boxes and spacing.
  // A display that carries no numerals states no problem. `y = \square x +
  // \square` and `\frac{\square}{\square} = \frac{\square}{\square}` are
  // printed by every item of their form, because the situation lives in the
  // stem — two of those items sharing a display is the form working, and
  // there is nothing on it a learner could carry across. Where the display
  // DOES carry numerals, it is the problem, and printing the live one again is
  // printing the live problem, whatever the story around it says.
  const statesTheProblem = !item.noDisplay && /\d/.test(String(item.latex || ''));
  const sameDisplay = norm(ex.latex || '') === norm(item.latex || '');
  if (statesTheProblem) {
    if (sameDisplay) return { ok: false, why: 'the example is the live problem' };
    if (blankLetters(ex.latex || '') === blankLetters(item.latex || '')) {
      return { ok: false, why: 'the example is the live problem with the unknown repainted' };
    }
  } else if (sameDisplay && item.stem && norm(ex.stem || '') === norm(item.stem)) {
    return { ok: false, why: 'the example is the live situation' };
  }
  if (norm(ex.answer) === norm(item.answer)) return { ok: false, why: 'the example lands on the live answer' };
  if (blankLetters(ex.answer) === blankLetters(item.answer)) {
    return { ok: false, why: 'the example lands on the live answer under another letter' };
  }
  // A REASON ON EVERY WORKED LINE.
  if (!(ex.steps || []).length) return { ok: false, why: 'the example carries no worked lines' };
  for (const st of ex.steps) {
    if (!st.why || !String(st.why).trim()) return { ok: false, why: `a worked line carries no reason: "${st.latex}"` };
  }
  // THE FOUR DEPTHS DIFFER, AND EVERY LINE OF EVERY DEPTH IS CLEAN.
  const rungs = [];
  const traced = [];
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    let script;
    try { script = echoScript({ item, analogue: ex, entry, tier, locale }); }
    catch (e) { return { ok: false, why: `the echo threw at depth ${tier}: ${e.message}` }; }
    const bad = inspectLines(script.rows.filter((r) => !r.rule));
    if (!bad.ok) return { ok: false, why: `depth ${tier}: ${bad.why}` };
    rungs.push(script.rows.map((r) => (r.rule ? '—' : `${r.cls}|${r.latex || ''}|${r.why || r.text || ''}`)).join('\n'));
    // The counterexample is left out on purpose: it is built out of the
    // cadet's OWN entry and the statement already on their screen, so a digit
    // it shares with the live answer is not one they could have copied from
    // anywhere. What is collected is the worked trace, at every depth.
    for (const r of script.rows) {
      if (!r.latex || /rf-echo-probe/.test(r.cls || '')) continue;
      traced.push(norm(r.latex));
    }
  }
  if (new Set(rungs).size !== rungs.length) return { ok: false, why: 'two depths render the same thing — the ladder does not fade' };
  // AND THE LIVE ANSWER IS NEVER PRINTED.
  if (standsAlone(traced.join(' | '), norm(item.answer))) {
    return { ok: false, why: `the live answer "${item.answer}" is printed inside the trace` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The walk.
// ---------------------------------------------------------------------------
async function walk() {
  const units = await allUnits();
  const report = [];
  const problems = [];
  let probes = 0;
  for (const { unit } of units) {
    const graph = await loadUnit(unit);
    const nodes = [];
    let uHit = 0; let uAll = 0;
    for (const n of graph.nodes) {
      let hit = 0; let all = 0;
      const misses = new Map();
      for (const f of formsFor(n.id) || []) {
        for (let d = f.dMin; d <= f.dMax; d++) {
          for (let i = 0; i < N; i++) {
            let item;
            const seed = (i * 2654435761 + d * 40503 + n.id.length * 7919 + f.id.length * 131) >>> 0;
            try { item = generate(n.id, d, seed, { form: f.id, record: false }); } catch { continue; }
            for (const dg of item.diagnostics || []) {
              all++;
              probes++;
              // English decides the count; the other two locales must not be
              // quieter, and a difference between them is its own defect.
              const verdicts = LOCALES.map((l) => ({ l, v: judge(item, dg.value, l) }));
              // …and the same slip as a hand would have typed it. See
              // `asAHandWouldType`: this is the spelling the running game
              // actually hands over, and for a year it was never tested.
              const typed = asAHandWouldType(dg.value);
              if (typed && typed !== String(dg.value).replace(/\s+/g, '')) {
                // AND THE SLIP STILL HAS A NAME.
                //
                // The misconception is what aims the echo AND what the worked
                // example is redrawn to carry, so a tag that only survives in
                // the bank's spelling is a tag the running game rarely sees.
                const named = diagnose(item, dg.value);
                const namedTyped = diagnose(item, typed);
                if (named !== namedTyped) {
                  verdicts.push({ l: 'en', v: { ok: false, why: `the slip loses its name when typed: bank "${dg.value}" is "${named}", the pad's "${typed}" is "${namedTyped}"` } });
                }
                for (const l of LOCALES) {
                  const v = judge(item, typed, l);
                  if (!v.ok) { verdicts.push({ l, v: { ok: false, why: `typed on the pad as "${typed}": ${v.why}` } }); break; }
                  // WHAT HAS TO MATCH IS THE TEACHING, NOT THE SPELLING.
                  //
                  // Layer one prints the cadet's entry back to them in their
                  // own hand — `m/4` where the bank writes `\frac{m}{4}`,
                  // `10x^2` where the bank writes `10x^{2}` — and that is the
                  // point of it, not a defect. What may not change is the
                  // REASONS, and those carry every number the probe computed
                  // (`squares back to 16`, `they differ by 6x`), so a probe
                  // that fires differently on one spelling shows up here.
                  const a = counterexample(item, dg.value, T[l]).map((r) => r.why || r.text || '').join(' | ');
                  const b = counterexample(item, typed, T[l]).map((r) => r.why || r.text || '').join(' | ');
                  if (a !== b) {
                    verdicts.push({ l, v: { ok: false, why: `the echo teaches something different by how it was typed: bank "${dg.value}" says "${a}", the pad's "${typed}" says "${b}"` } });
                    break;
                  }
                }
              }
              const bad = verdicts.find((x) => !x.v.ok);
              if (!bad) { hit++; continue; }
              const key = `${n.id}/${f.id}/${dg.misconception}`;
              if (ALLOW.some((a) => a.key === key)) { hit++; continue; }
              if (!misses.has(key)) {
                misses.set(key, `${key} [${bad.l}] ${bad.v.why}  (prompt "${item.latex}", entry "${dg.value}")`);
              }
            }
          }
        }
      }
      uHit += hit; uAll += all;
      // A NODE THAT DECLARES NO SLIP IS NOT A NODE THAT PASSED.
      //
      // `all ? … : 100` would print a clean 100% for a node whose forms tag no
      // wrong answer at all — the gate would be reporting on the emptiness of
      // its own sample. Nothing in the manifest is in that state today, and if
      // one ever is the gate says so instead of certifying it.
      if (!all) problems.push(`${n.id}: no item form declares a single misconception-tagged wrong answer, so nothing could be measured`);
      nodes.push({ id: n.id, hit, all, pct: all ? (100 * hit) / all : 0 });
      for (const m of misses.values()) problems.push(m);
    }
    report.push({ unit: unit.id, hit: uHit, all: uAll, pct: uAll ? (100 * uHit) / uAll : 0, nodes });
  }
  return { report, problems, probes };
}

// ---------------------------------------------------------------------------
// The second walk: the worked analogue at layers two to four.
// ---------------------------------------------------------------------------
/**
 * When the bank holds no clean example, is that the bank or the chooser?
 *
 * `analogueFor` auditions 96 candidates a pass. If a search SIX TIMES wider
 * finds one, the chooser gave up early and the item is a real miss. If it does
 * not, the bank genuinely has no draw that avoids printing the live answer,
 * and that is a fact about the content rather than a defect in the echo — so
 * it is named, counted and printed rather than passed in silence.
 */
function provedUnavailable(item, d) {
  try { return !analogueFor(item, { difficulty: d, seed: item.seed, tries: 600, record: false }); }
  catch { return true; }
}

async function walkExamples() {
  const units = await allUnits();
  const report = [];
  const problems = [];
  const named = [];
  for (const { unit } of units) {
    const graph = await loadUnit(unit);
    const nodes = [];
    let uHit = 0; let uAll = 0; let uNamed = 0;
    for (const n of graph.nodes) {
      let hit = 0; let all = 0; let excused = 0;
      const misses = new Map();
      const excuses = new Map();
      for (const f of formsFor(n.id) || []) {
        for (let d = f.dMin; d <= f.dMax; d++) {
          for (let i = 0; i < M; i++) {
            let item;
            const seed = (i * 2654435761 + d * 40503 + n.id.length * 7919 + f.id.length * 131) >>> 0;
            try { item = generate(n.id, d, seed, { form: f.id, record: false }); } catch { continue; }
            all++;
            // Drawn the way the rift draws it: the first tagged slip is the
            // entry, and the example is chosen with that slip in hand.
            const dg = (item.diagnostics || [])[0] || null;
            const entry = dg ? dg.value : null;
            let bad = null;
            for (const l of LOCALES) {
              let ex = null;
              try { ex = analogueFor(item, { locale: l, difficulty: d, seed: item.seed, misconception: dg?.misconception || null }); }
              catch { ex = null; }
              const v = judgeExample(item, ex, entry, l);
              if (!v.ok) { bad = { l, v }; break; }
            }
            if (!bad) { hit++; continue; }
            const key = `${n.id}/${f.id}`;
            if (bad.v.why === 'no worked example at all' && provedUnavailable(item, d)) {
              excused++;
              if (!excuses.has(key)) {
                excuses.set(key, `${key} — the live answer is "${item.answer}"; no draw in 600 attempts at any band avoids printing it, so the deepest layer opens the cadet's own tear with the landing burned`);
              }
              continue;
            }
            if (!misses.has(key)) {
              misses.set(key, `${key} [${bad.l}] ${bad.v.why}  (prompt "${item.latex}", answer "${item.answer}")`);
            }
          }
        }
      }
      uHit += hit; uAll += all; uNamed += excused;
      nodes.push({ id: n.id, hit, all, named: excused, pct: all ? (100 * (hit + excused)) / all : 0 });
      if (!all) problems.push(`${n.id}: no item form produced a single item, so nothing could be measured`);
      for (const m of misses.values()) problems.push(m);
      for (const e of excuses.values()) named.push(e);
    }
    report.push({ unit: unit.id, hit: uHit, all: uAll, named: uNamed, pct: uAll ? (100 * (uHit + uNamed)) / uAll : 0, nodes });
  }
  return { report, problems, named };
}

// ---------------------------------------------------------------------------
// The self-test: plant a node whose handler is missing.
// ---------------------------------------------------------------------------
/**
 * The same notation with every free unknown swapped for another letter.
 *
 * Used only by the self-test, to build the exact defect the second half exists
 * to catch: an example that is the live problem repainted. Letters inside a
 * control sequence are notation and are left alone.
 */
function repaint(src) {
  const t = String(src);
  let out = '';
  for (let i = 0; i < t.length;) {
    if (t[i] === '\\') {
      const m = /^\\[a-zA-Z]+|^\\./.exec(t.slice(i));
      const tok = m ? m[0] : '\\';
      out += tok; i += tok.length; continue;
    }
    const c = t[i];
    if (/[a-z]/.test(c)) out += c === 'z' ? 'a' : String.fromCharCode(c.charCodeAt(0) + 1);
    else if (/[A-Z]/.test(c)) out += c === 'Z' ? 'A' : String.fromCharCode(c.charCodeAt(0) + 1);
    else out += c;
    i++;
  }
  return out;
}

async function selfTest() {
  const units = await allUnits();
  for (const { unit } of units) await loadUnit(unit);
  const fails = [];
  const planted = [];

  // 1. A REAL Level 4 item with its check kind renamed. `counterexample()` then
  //    has no handler for it, which is exactly the defect this gate exists to
  //    catch, and it must come back as a miss rather than as a pass.
  const live = generate('radical-simplify', 3, 4242, { record: false });
  const dead = { ...live, check: { ...live.check, kind: 'aKindNothingHandles' } };
  planted.push(['a check kind with no handler', judge(dead, live.diagnostics[0].value)]);

  // 2. The exact shape that shipped: an item whose layer one is the prompt,
  //    reprinted, with the untargeted sentence under it.
  const parrot = {
    latex: '\\sqrt{144 + 100}',
    answer: '2\\sqrt{61}',
    type: 'expression',
    check: { kind: 'aKindNothingHandles', math: '\\sqrt{144 + 100}' },
    diagnostics: [{ value: '22', misconception: 'root-splits-over-sum' }],
  };
  const script = echoScript({ item: parrot, analogue: null, entry: '22', tier: 1 }).rows;
  const restated = script.length === 1 && norm(script[0].latex) === norm(parrot.latex)
    && script[0].why === RESTATEMENT;
  planted.push(['the shipped restatement', { ok: !restated, why: restated ? 'the prompt, reprinted' : 'something computed' }]);

  // 3. Rows that came back from a handler and are broken in the three ways a
  //    row can be broken: a sentence with an unfilled placeholder, notation
  //    strict KaTeX will not take, and the prompt reprinted under a different
  //    reason. Each is driven straight at the row check.
  const fake = { latex: '\\sqrt{8}' };
  planted.push(['a spacing command with its backslash gone', inspectRows(
    [{ cls: 'rf-echo-probe', latex: '3 ;\\to; 27', why: 'a reason' }], fake,
  )]);
  planted.push(['an unfilled placeholder', inspectRows(
    [{ cls: 'rf-echo-probe', latex: '2 + 2 = 4', why: 'your value {val} is out' }], fake,
  )]);
  planted.push(['notation strict KaTeX refuses', inspectRows(
    [{ cls: 'rf-echo-probe', latex: '\\frac{1}{', why: 'a reason' }], fake,
  )]);
  planted.push(['the prompt reprinted under another reason', inspectRows(
    [{ cls: 'rf-echo-probe', latex: '\\sqrt{ 8 }', why: 'a reason' }], fake,
  )]);

  // 4. THE SECOND HALF: the worked analogue. A real Level 5 item, and the
  //    example beside it spoiled one way at a time. Each spoiling is a defect
  //    that shipped somewhere in this bank, and the gate has to refuse each.
  const l5 = generate('sequence-nth-term', 3, 90210, { record: false });
  const l5entry = (l5.diagnostics || [])[0]?.value ?? null;
  const l5ex = analogueFor(l5, { difficulty: 3, seed: l5.seed });
  if (!l5ex) fails.push('self-test: no analogue for the Level 5 item the second half is driven with');
  else {
    planted.push(['no worked example at all', judgeExample(l5, null, l5entry)]);
    planted.push(['an example that is the live problem', judgeExample(l5, { ...l5ex, latex: l5.latex }, l5entry)]);
    planted.push(['an example that is the live problem with the letter repainted', judgeExample(
      l5, { ...l5ex, latex: repaint(l5.latex) }, l5entry,
    )]);
    planted.push(['an example that lands on the live answer', judgeExample(l5, { ...l5ex, answer: l5.answer }, l5entry)]);
    planted.push(['an example that lands on the live answer under another letter', judgeExample(
      l5, { ...l5ex, answer: repaint(l5.answer) }, l5entry,
    )]);
    planted.push(['a worked line with no reason', judgeExample(
      l5, { ...l5ex, steps: l5ex.steps.map((st, i) => (i === 0 ? { ...st, why: '' } : st)) }, l5entry,
    )]);
    planted.push(['an example with no worked lines at all', judgeExample(l5, { ...l5ex, steps: [] }, l5entry)]);
    planted.push(['a worked line strict KaTeX refuses', judgeExample(
      l5, { ...l5ex, steps: l5ex.steps.map((st, i) => (i === 0 ? { ...st, latex: '\\frac{1}{' } : st)) }, l5entry,
    )]);
    planted.push(['a trace that prints the live answer', judgeExample(
      l5, { ...l5ex, steps: [...l5ex.steps, { latex: String(l5.answer), why: 'a reason' }] }, l5entry,
    )]);
  }

  // 5. THE PAD'S OWN ALPHABET. The second pass has to be doing something: the
  //    spelling a hand types must actually differ from the bank's, and a slip
  //    that arrives unreadable in that alphabet must be refused, not passed.
  const padded = asAHandWouldType(live.diagnostics[0].value);
  if (!padded) fails.push('self-test: the pad could not type the Level 4 slip at all, so the second pass proves nothing');
  else if (padded === String(live.diagnostics[0].value).replace(/\s+/g, '')) {
    fails.push(`self-test: the pad's spelling of "${live.diagnostics[0].value}" is the bank's, so the second pass never runs`);
  } else console.log(`self-test: a hand types "${live.diagnostics[0].value}" as "${padded}"`);
  planted.push(['a slip left half-typed in the pad\'s alphabet', judge(live, '2√')]);

  for (const [what, v] of planted) {
    if (v.ok) fails.push(`self-test: the gate PASSED ${what}, which it must refuse`);
    else console.log(`self-test: caught ${what} — ${v.why}`);
  }

  // …and a real one still passes, so the gate is not simply failing everything.
  const good = judge(live, live.diagnostics[0].value);
  if (!good.ok) fails.push(`self-test: the gate refused a real, handled item — ${good.why}`);
  else console.log('self-test: a real Level 4 slip still passes');
  if (l5ex) {
    const good2 = judgeExample(l5, l5ex, l5entry);
    if (!good2.ok) fails.push(`self-test: the gate refused a real, honest analogue — ${good2.why}`);
    else console.log('self-test: a real Level 5 worked analogue still passes');
  }
  // …and the same real slip, typed the way a hand types it, is answered too.
  if (padded) {
    const typed = judge(live, padded);
    if (!typed.ok) fails.push(`self-test: the gate refused the same slip typed on the pad — ${typed.why}`);
    else console.log('self-test: the same slip typed on the real pad is answered too');
  }

  if (fails.length) { for (const f of fails) console.error(f); process.exit(1); }
  console.log('self-test: the gate can fail.\n');
}

// ---------------------------------------------------------------------------
if (SELF_TEST) await selfTest();
const { report, problems, probes } = await walk();
const ex2 = await walkExamples();
problems.push(...ex2.problems);

if (JSON_OUT) {
  console.log(JSON.stringify({ report, problems, probes, allow: ALLOW, examples: ex2.report, named: ex2.named }, null, 2));
} else {
  console.log('AIMED TEACHING AT LAYER ONE — the share of misconception-tagged wrong answers');
  console.log('that come back with computed mathematics rather than the prompt restated.\n');
  for (const u of report) {
    console.log(`${u.unit.padEnd(14)} ${u.pct.toFixed(1).padStart(6)}%   (${u.hit}/${u.all})`);
    for (const n of u.nodes) {
      if (n.pct >= 100) continue;
      console.log(`    ${n.id.padEnd(26)} ${n.pct.toFixed(1).padStart(6)}%   (${n.hit}/${n.all})`);
    }
  }
  console.log(`\n${probes} tagged slips pushed through the real echo, in EN, ES and PL.`);
  if (ALLOW.length) {
    console.log('\nNamed exceptions:');
    for (const a of ALLOW) console.log(`  ${a.key}\n      ${a.reason}`);
  }

  console.log('\n\nTHE WORKED ANALOGUE AT LAYERS TWO TO FOUR — the share of items whose deeper');
  console.log('layers open a DIFFERENT problem of the same shape, a line at a time, with a');
  console.log('reason on every line and the live answer never printed.\n');
  for (const u of ex2.report) {
    const tail = u.named ? `   (${u.hit}/${u.all}, ${u.named} named)` : `   (${u.hit}/${u.all})`;
    console.log(`${u.unit.padEnd(14)} ${u.pct.toFixed(1).padStart(6)}%${tail}`);
    for (const n of u.nodes) {
      if (n.pct >= 100 && !n.named) continue;
      console.log(`    ${n.id.padEnd(26)} ${n.pct.toFixed(1).padStart(6)}%   (${n.hit}/${n.all}${n.named ? `, ${n.named} named` : ''})`);
    }
  }
  if (ex2.named.length) {
    console.log('\nNamed exceptions — the bank holds no clean example, proved by a search six times wider:');
    for (const e of ex2.named) console.log(`  ${e}`);
  }
}

if (problems.length && !JSON_OUT) {
  console.error(`\n${problems.length} findings — a slip answered with no computed mathematics, or a`);
  console.error('worked analogue that is not a different problem taught a line at a time:\n');
  for (const p of problems.slice(0, 60)) console.error(`  ${p}`);
  if (problems.length > 60) console.error(`  …and ${problems.length - 60} more`);
}
if (!problems.length && !JSON_OUT) {
  console.log('\nEvery tagged slip in every unit is answered with computed mathematics, and');
  console.log('every item is taught from a different worked rift of the same shape.');
}
if (!JSON_OUT) {
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The teaching is the
     product: a misconception answered with the prompt restated is a learner
     given nothing, in whichever unit it lands. */
  findings('check:echo', { scope: 'sweep' }).route(problems.map(String)).done();
}
if (problems.length) process.exit(1);
