#!/usr/bin/env node
/**
 * THE CHOICE-SHAPE GATE — can the key be picked out without reading it?
 *
 *   node tools/critic/choiceshape.mjs                 # every surface, every unit
 *   node tools/critic/choiceshape.mjs --self-test     # plant a leak in each surface
 *   node tools/critic/choiceshape.mjs --seeds 24      # deeper sample
 *   node tools/critic/choiceshape.mjs --skill two-step
 *   node tools/critic/choiceshape.mjs --per-form      # the worst forms, named
 *   node tools/critic/choiceshape.mjs --strategies    # every strategy, per surface
 *
 * WHY THIS FILE EXISTS
 *
 * `tools/critic/choiceaudit.mjs` proves the answer is IN the option set and
 * that its POSITION carries nothing. Nothing proved the same thing about the
 * key's SHAPE, and shape is the cue a test-wise teenager reaches for first: the
 * longest one, the shortest one, the one with the most digits, the only one
 * with a minus sign in front of it, the two that are words among two that are
 * numbers.
 *
 * WHY IT WAS REWRITTEN: IT WAS MEASURING THE WRONG POPULATION.
 *
 * The first version of this gate swept the bank and read
 * `[item.answer, ...item.distractors]` as though every card were four readings
 * a learner is shown. It is not. `RiftPanel._mount` sends each card to one of
 * six surfaces and only some of them ever draw that list:
 *
 *     26,436 route cards go to a surface that shows the options
 *     63,558 route cards go to a keypad, a beam, a sorter, a field or a plane
 *
 * The choice cards read 31.6% for a cadet who reads no mathematics, against a
 * 25% baseline. The cards whose options are never drawn read 24.6%. The gate
 * averaged all 89,994 of them to 26.31% and printed PASS. **71% of its
 * population was cards nobody is ever asked to choose between**, and they were
 * voting on whether a real leak was a leak.
 *
 * So severity is not the only thing that has to be per-surface. THE
 * MEASUREMENT IS. Every surface is tallied, judged and printed on its own, and
 * nothing is ever averaged across two of them. `--strategies` prints the lot.
 *
 * WHICH SURFACES, AND WHO DECIDES. Not this file. `tools/critic/riftsurfaces.mjs`
 * cuts the real routing chain and the real prefix of each modality builder out
 * of `src/ui/rift.js` and executes them, the way `tools/critic/handed.mjs`
 * executes the real strafe basis. A change to the shipped file is what runs
 * here on the next build, and a moved anchor throws instead of quietly
 * reverting to "everything" — which is the defect this rewrite exists to end.
 *
 *     the four-option card    `_choice`    all three distractors, at once
 *     the special-answer card `_choice`    the same surface, but its key is a
 *                                          PHRASE and its distractors were bare
 *                                          numbers: a cadet who strikes every
 *                                          bare number first-picked 50.00%
 *     the narrowed field      `_narrow`    the key and the FIRST TWO
 *                                          distractors, drawn after two honest
 *                                          misses — the moment a learner is
 *                                          weakest, and the surface NO GATE HAD
 *                                          EVER READ
 *     the balance move tray   `_balance`   five moves, one of them the ideal
 *     the sorter              `_sort`      chips, and two bays to file them in
 *     the area field          `_area`      one tray, two cells, and a chip of
 *                                          each kind that is right
 *     the free keypad         `_keypad`    NO option set at all — so the only
 *                                          cue left is the stem printing the
 *                                          answer, and it is counted here
 *
 * `_plot` puts no option set on screen; it is counted in the census so that
 * every route card is accounted for, and it is not judged.
 *
 * AND FOUR CUES NO READING OF ONE CARD CAN CARRY. Everything above reads a
 * single option set. Four of the defects this gate exists for are not inside
 * one card and were invisible to it:
 *
 *   THE RETURNING CADET   The special-answer card passed at 25.00% while the
 *                         whole route bank drew four distinct strings and the
 *                         key was always one of two of them. A cadet who has
 *                         met the surface twice first-picked 56.25%. So the
 *                         gate now learns each reading's record on half the
 *                         CARDS and plays "take the best-remembered one" on
 *                         the other half, in two vocabularies — the exact
 *                         reading, and the reading's shape.
 *   THE SORTER'S ORDER    Not a property of any chip: the tray was built in
 *                         the printed statement's own term order, which
 *                         alternates, so ONE positional rule sealed 100% of
 *                         route boards with no miss. Fitted on half the boards
 *                         of each size, scored on the other half, against the
 *                         same procedure over a drawn order.
 *   THE STEM              A dispute card quotes two readings into its sentence
 *                         and every framing printed the key FIRST.
 *   THE SIZE OF A NUMBER  `-800` is longer than `12` and carries more digits
 *                         while being the smaller number, so neither of the two
 *                         counts this gate already read could see it.
 *
 * WHAT IT MEASURES: ONE NUMBER WITH ONE MEANING.
 *
 * A **strategy** is any rule that reads the options and refuses some of them.
 * Its value on one set is `1/|survivors|` when the key survives and 0 when it
 * does not — the chance that a cadet playing that rule and then guessing among
 * what is left first-picks correctly. Under the null this gate is testing —
 * the key is shape-wise just another option — **the expected value of EVERY
 * strategy is exactly 1/k, whatever the rule is and whatever the option set
 * looks like**. That is what makes twenty strategies comparable on one scale,
 * and it is why an inverted leak is caught by the same arithmetic as a plain
 * one: a rule that STRIKES the key 100% of the time scores 0, which is as far
 * from 1/k as a rule that picks it.
 *
 * The strategies are the cues an eye can actually use: the unique longest and
 * shortest option, the unique most and fewest digits, and, for each of six
 * written features — a leading minus, a fraction bar, a relation, words, a
 * letter, a radical — "take the ones that have it" and "take the ones that do
 * not". Each comes with its mirror, because a cadet who has learned the rule is
 * INVERTED scores just as well by striking what it names.
 *
 * THE CADET is the whole attack in one number: the best of those strategies on
 * this surface, and the composite that strikes every unique extreme at once.
 * The report leads with the first-pick rate and with the odds of clearing a
 * three-item proving run by shape alone, which is the number a curriculum
 * director asks for.
 *
 * WHY THE Z-TEST IS NOT THE WHOLE VERDICT. This sweep reads tens of thousands
 * of sets, and at that size a p<0.001 test refuses a 1.4-point lean — a lean no
 * learner could act on and no generator could remove, since the option pool is
 * finite and one-sided. A gate that goes red for something nobody can use or
 * fix is a gate somebody switches off, which is how this repository lost three
 * gates already. So a strategy fails when it is BOTH statistically
 * distinguishable from 1/k AND off by more than `RULE_BAND` points. Neither
 * half can be relaxed without the other noticing.
 *
 * AND THE SAME ERROR ONE LEVEL DOWN: A FORM IS A POPULATION TOO.
 *
 * A surface's number is an average over every form that lands on it, and a
 * learner does not meet an average — the scheduler hands out one skill at a
 * time. On this tree the narrowed field reads 34.9% against 33.3% and passes,
 * and inside it `multi-step/ms-bracket` reads 62.2%: a cadet working that skill
 * for a sitting is being handed the answer while the surface says it is fine.
 * So every form with enough draws is judged on its own by exactly the same
 * two-part test, and the ones over the band are PRINTED IN FULL on every run
 * with the cue that pays them NAMED — `--per-form` prints the whole list rather
 * than only the findings.
 *
 * They are printed and counted (`FORMS:` on the last line) and they do not turn
 * the build red, and that is a deliberate, written scope rather than a quiet
 * one: the bar this gate ENFORCES is the surface, because that is the bar the
 * generator was moved to meet and the per-form reading is a stricter one that
 * nothing in the bank meets yet. 28 route forms are over it today. Nothing here
 * hides them; the list, the cue and the count are on every build.
 *
 * ROUTE FIRST. `content/courses.json` ships two of five units. Severity is read
 * off `route.units` rather than written here: the composed route is hard,
 * preview units are printed with their numbers and never turn the build red,
 * and promoting a unit makes its numbers hard on the next build with no edit.
 *
 * EVERY DEVIATE IS TAKEN OVER CARDS, NOT ROWS. Each card is drawn once per
 * locale and the three draws are the same set with the same key, so three rows
 * are one observation about the generator's choice. Dividing by the row count
 * claims three times the evidence there is, and it showed: the special-answer
 * card's key sits in each of its four printed places EXACTLY 25.0% of the time
 * over 960 cards, and over 96 cards the same content read 17/17/28/37 and was
 * printed as a route finding. See `cards` on the tally.
 *
 * WHERE THIS LEFT THE SURFACES this lane touched, measured on the shipped
 * route, 62 skills, three locales:
 *
 *                                                  before      after   chance
 *   the special-answer card                        56.25%     25.00%      25%
 *     … clearing a three-item proving run          17.80%      1.56%    1.56%
 *   the sorter, best fixed positional rule        100.0%       19.8%    13.1%
 *     (the same rule over a drawn chip order is the chance column)
 *   the area field, both cells with no miss        68.22%     12.45%   11.11%
 *     ("take the biggest chip of each kind")
 *   the balance move tray                          46.22%     42.39%      20%
 *     "if there is a divide button, press it"      24.31%    silent       20%
 *   the free keypad: the stem prints the answer      1.94%      0.23%       0%
 */
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { allUnits, loadUnit, routeUnits, ROOT } from '../_courses.mjs';
import { realSurfaces } from './riftsurfaces.mjs';
import { findings, sandbox } from '../_findings.mjs';

export const LOCALES = ['en', 'es', 'pl'];
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

// ---------------------------------------------------------------------------
// THE BARS. Each one is a number this repository already stands behind.
// ---------------------------------------------------------------------------
/**
 * How far from chance a strategy may sit, in points.
 *
 * 7, because that is the bar `tools/validate-items.mjs` already holds from
 * above: `SURFACE_MAX = 0.32` against a 0.25 baseline, described there as "a
 * whisker over the baseline itself, because that is the actual claim". This
 * gate applies the same whisker in both directions, on every surface, against
 * that surface's own chance.
 */
const RULE_BAND = 7;

/** The same allowance on one slot of a rank or position distribution, where k
 *  slots share the error rather than two sides of one rule carrying it. */
const SLOT_BAND = 5;

/**
 * A strategy decisive on fewer sets than this is reported and not judged.
 *
 * A rule that fires on 2% of cards and is wrong on all of them costs a cadet
 * half a point over a session; the arithmetic that would make it red is noise.
 * The share is printed either way, so a rule going quiet cannot hide a change.
 */
const RULE_MIN_SHARE = 0.05;

/** A surface with fewer sets than this is printed and not judged. */
const SURFACE_MIN_SETS = 120;

/** And the same for one form of one skill, which is a smaller population by
 *  construction — a form has one band's worth of draws, not a unit's. */
const FORM_MIN_SETS = 60;

/**
 * The two-sided normal deviate at p = 0.001, WITH A BONFERRONI STEP for the
 * number of strategies read on one surface.
 *
 * The report leads with the BEST of about twenty strategies, and the maximum of
 * twenty noisy estimates sits above the mean of one by construction. A gate
 * that did not pay for that would fire on an honest bank roughly one run in
 * fifty, and a gate that cries wolf is a gate somebody switches off. 4.20 is
 * the deviate at 0.001/32 — the list is 32 strategies wide since the SIZE of
 * the number an option carries, the division glyph and the three stem-quoting
 * rules joined it, and a step that is not paid for is a false alarm a month
 * from now.
 */
const Z_P001 = 4.20;

/**
 * And the same deviate for THE RETURNING CADET, which is a family of TWO.
 *
 * The step above is paid for the maximum of thirty-two strategies read on one
 * option set. The memory is not one of those: it is two readings — the exact
 * reading and the reading's shape — and charging it for thirty-two rules it
 * does not run is a step nobody owes. 3.48 is the two-sided deviate at
 * 0.001/2. It costs nothing that matters, because the band has to be cleared
 * as well: the plant this instrument exists for is 27 points off chance at
 * 96 cards and reads z 3.8, and the honest content beside it is 12 points off
 * at the same size and reads 1.8.
 */
const Z_MEM = 3.48;

/** Upper-tail chi-square at p = 0.001, by degrees of freedom — the same table
 *  and the same p as tools/critic/choiceaudit.mjs, for the same reason. */
const CHI2_P001 = { 1: 10.828, 2: 13.816, 3: 16.266, 4: 18.467, 5: 20.515, 6: 22.458, 7: 24.322 };

// ---------------------------------------------------------------------------
// What an eye can read off an option without doing any mathematics.
// ---------------------------------------------------------------------------
/**
 * HOW LONG AN OPTION LOOKS, in glyphs a learner can actually see.
 *
 * Not the length of the LaTeX, which is what this gate used to count and what
 * `tools/validate-items.mjs` still counts. `\div\; 4` is eight characters of
 * source and three marks on the glass, one of which is a spacing macro that
 * draws nothing; `+\; 8` is six characters and the same three marks. Counting
 * the source reported the beam's ideal move as the "longest" thing on its tray
 * on 27% of trays, which is a fact about the notation the generator writes and
 * not about the surface a learner meets — and a gate that fires on something a
 * learner cannot see is a gate somebody switches off.
 *
 * Spacing and sizing macros draw nothing and are dropped, every other control
 * sequence is one mark, braces are grouping and are dropped, and the words
 * inside `\text{}` are counted as the words they are. `src/learn/shape.js`
 * counts the same way, on purpose: this is a measurement of the glass, and the
 * two sides of it must agree about what a learner sees.
 */
export function shapeLen(x) {
  return String(x)
    .replace(/\\left|\\right|\\[,;:!]|\s+/g, '')
    .replace(/\\[a-zA-Z]+/g, '@')
    .replace(/[{}]/g, '')
    .length;
}
/** How many digits an option carries. */
export function shapeDigits(x) {
  const s = String(x);
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c >= 48 && c <= 57) n++; }
  return n;
}
/**
 * HOW BIG THE NUMBER AN OPTION CARRIES IS.
 *
 * The third thing an eye reads, and the one neither of the two above can see.
 * `-8` is shorter than `12` and carries fewer digits while being the smaller
 * number, so a bank balanced on length and digits can still put the key at the
 * top of the size order every time — which is exactly what the area field did:
 * every wrong shard was built out of `a` and `b` and both right ones out of
 * `k·a` and `k·b`, so "take the biggest chip of each kind" covered the whole
 * field with no miss on 58.4% of route cards against 11.1%.
 *
 * Anything that does not read as one signed number is NaN, and a set with a
 * NaN in it leaves every size rule undecided rather than guessing — the same
 * discipline `expectation-unknown` follows in the choice lab.
 */
export function shapeSize(x) {
  let t = String(x).replace(/\\left|\\right|\\[,;:!]|\s+/g, '');
  const fr = t.match(/^(-?)\\frac\{(-?\d+)\}\{(-?\d+)\}$/);
  if (fr) return (fr[1] === '-' ? -1 : 1) * Number(fr[2]) / Number(fr[3]);
  t = t.replace(/\\[a-zA-Z]+\{[^{}]*\}/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/\\[^a-zA-Z]/g, '');
  const m = t.match(/^([+-]?)(\d+)(?:\/(\d+))?/);
  if (!m) return NaN;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * Number(m[2]) / (m[3] ? Number(m[3]) : 1);
}
const METRICS = [['length', shapeLen], ['digits', shapeDigits], ['size', shapeSize]];

/**
 * The written features. Every one of these is something a cadet can see at a
 * glance in a rendered option without knowing what any of it means: a minus
 * hanging off the front, a bar with something over and under it, a relation
 * sign, a phrase in words among numbers, a letter, a root.
 *
 * `words` is here because of the special-answer card, where the key is a
 * PHRASE and two of the four options were bare numbers, so "strike every bare
 * number" first-picked 50.00% against 25%.
 */
export const FEATURES = [
  ['a minus sign', (s) => /(^|[^0-9A-Za-z}])-/.test(s)],
  ['a fraction bar', (s) => /\\frac|\//.test(s)],
  ['a relation', (s) => /[=<>]|\\le|\\ge|\\neq/.test(s)],
  ['words', (s) => /\\text\{/.test(s)],
  ['a letter', (s) => /[A-Za-z]/.test(String(s).replace(/\\[a-zA-Z]+/g, ' ').replace(/\\text\{[^}]*\}/g, ' '))],
  ['a radical', (s) => /\\sqrt/.test(s)],
  ['a numeral', (s) => /[0-9]/.test(s)],
  /* THE DIVISION GLYPH. On the beam's move tray the ideal move is the DIVISION
     at every closing step, and until this line existed no cue in this file
     could see it: `\div\; 4` and `+\; 8` are the same printed length, carry
     the same digit count, and differ in none of the six written features. "If
     there is a divide button, press it" named the ideal move on two thirds of
     route trays against a 20% baseline while this gate read 25.7% and passed.
     Written for all three locales — es and pl set division with a colon, and a
     cue an eye can read does not care which glyph the locale chose. */
  ['a division sign', (s) => /\\div|\\mathbin\{:\}|÷/.test(s)],
];

/** The one option at the extreme, or -1 when two or more share it. */
function soleExtreme(vals, dir) {
  const best = dir < 0 ? Math.min(...vals) : Math.max(...vals);
  let at = -1;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] !== best) continue;
    if (at >= 0) return -1;
    at = i;
  }
  return at;
}

/**
 * EVERY STRATEGY, as a function from an option set to the options it leaves
 * standing.
 *
 * A strategy that cannot be applied to a set — no unique longest option, no
 * option carrying a fraction bar, every option carrying one — leaves the whole
 * set standing, which is a cadet who learned nothing from it and guesses. That
 * is what keeps the null at exactly 1/k for every strategy on every set.
 */
export const STRATEGIES = [];
for (const [mn, m] of METRICS) {
  for (const [dn, dir] of [['shortest', -1], ['longest', +1]]) {
    const name = mn === 'length' ? `the unique ${dn} option`
      : mn === 'digits' ? `the unique ${dir < 0 ? 'fewest' : 'most'}-digits option`
      : `the unique ${dir < 0 ? 'smallest' : 'biggest'} option`;
    STRATEGIES.push({
      name: `take ${name}`, family: `${mn}:${dir}`,
      live: (o) => { const at = soleExtreme(o.map(m), dir); return at < 0 ? o.map(() => true) : o.map((_, i) => i === at); },
    });
    STRATEGIES.push({
      name: `strike ${name}`, family: `${mn}:${dir}`,
      live: (o) => { const at = soleExtreme(o.map(m), dir); return at < 0 ? o.map(() => true) : o.map((_, i) => i !== at); },
    });
  }
}
for (const [fn, f] of FEATURES) {
  STRATEGIES.push({
    name: `take the ones with ${fn}`, family: `feature:${fn}`,
    live: (o) => { const b = o.map(f); return b.some(Boolean) && !b.every(Boolean) ? b : o.map(() => true); },
  });
  STRATEGIES.push({
    name: `take the ones without ${fn}`, family: `feature:${fn}`,
    live: (o) => { const b = o.map(f); return b.some(Boolean) && !b.every(Boolean) ? b.map((x) => !x) : o.map(() => true); },
  });
}
/**
 * WHAT THE STEM ITSELF PRINTS.
 *
 * Every rule above reads the option set alone. These three read the SENTENCE
 * over it, because a whole family of forms in this bank quotes readings into
 * the stem — "One cadet chalks $x > 4$. Another chalks $x < 4$." — and quoting
 * is a cue an eye reads before it reads anything else.
 *
 * On `inequality-multi/im-dispute` the stem named exactly two of the four
 * options and the KEY WAS ALWAYS THE FIRST OF THE TWO, in twelve framings and
 * three locales: "take the first reading the stem prints" was right 100% of
 * the time. Nothing in this file could see it, because both readings are
 * honest inequalities of the same length carrying the same glyphs.
 *
 * `matchQuoted` compares on the same normalisation the panel renders with —
 * whitespace and \left/\right dropped — so a reading quoted as `$x \ge -4$`
 * inside prose is recognised as the option `x \ge -4`.
 */
/**
 * TWO NORMALISATIONS, AND WHY BOTH ARE NEEDED.
 *
 * A stem writes `$x \ge -4$` and the option is `x \ge -4`; a stem writes
 * "makes it 18." and the answer is `18`. Squeezing all the space out matches
 * the first pair and BREAKS the second — "makesit18" has a letter against the
 * `1`, so a boundary test refuses it and the reader misses the giveaway. That
 * exact miss happened: `order-ops/oo-dispute` prints the answer in every
 * sentence it owns, and the first version of this reader found four cards in
 * ten thousand. So a run of whitespace collapses to ONE space, which is not a
 * word character and keeps the boundary honest, and the fully squeezed form is
 * tried as well — a hit from either is a hit, because a cadet reading the
 * glass does not care which.
 */
const bare = (x) => String(x).replace(/\\left|\\right/g, '').replace(/\s+/g, ' ').trim();
const squeeze = (x) => String(x).replace(/\s+/g, '');
const wordish = (c) => c !== undefined && /[0-9A-Za-z]/.test(c);
/** Where the stem prints this reading whole, or -1 — never inside a longer number. */
function quoteOnce(hay, needle) {
  if (needle.length < 2) return -1;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (wordish(needle[0]) && wordish(hay[i - 1])) continue;
    const end = i + needle.length;
    if (wordish(needle[needle.length - 1]) && wordish(hay[end])) continue;
    return i;
  }
  return -1;
}
function quoteAt(hay, needle) {
  const a = quoteOnce(hay, needle);
  return a >= 0 ? a : quoteOnce(squeeze(hay), squeeze(needle));
}
function quotedIn(stem, opts) {
  const s = bare(stem || '');
  return opts.map((o) => quoteAt(s, bare(o)) >= 0);
}
/** Which option the stem prints FIRST, or -1. */
function firstQuoted(stem, opts) {
  const s = bare(stem || '');
  let at = -1, best = Infinity;
  for (let i = 0; i < opts.length; i++) {
    const j = quoteAt(s, bare(opts[i]));
    if (j >= 0 && j < best) { best = j; at = i; }
  }
  return at;
}
STRATEGIES.push({
  name: 'take the ones the stem prints', family: 'stem:in',
  live: (o, ctx) => { const b = quotedIn(ctx?.stem, o); return b.some(Boolean) && !b.every(Boolean) ? b : o.map(() => true); },
});
STRATEGIES.push({
  name: 'take the ones the stem does not print', family: 'stem:in',
  live: (o, ctx) => { const b = quotedIn(ctx?.stem, o); return b.some(Boolean) && !b.every(Boolean) ? b.map((x) => !x) : o.map(() => true); },
});
STRATEGIES.push({
  name: 'take the FIRST reading the stem prints', family: 'stem:first',
  live: (o, ctx) => { const at = firstQuoted(ctx?.stem, o); return at < 0 ? o.map(() => true) : o.map((_, i) => i === at); },
});

/** The composite the first version of this gate led with: strike every option
 *  that is a unique extreme on any of the four ordinal rules at once. */
STRATEGIES.push({
  name: 'strike every unique extreme at once', family: 'composite',
  live: (o) => {
    const out = o.map(() => true);
    for (const [, m] of METRICS) for (const dir of [-1, +1]) {
      const at = soleExtreme(o.map(m), dir);
      if (at >= 0) out[at] = false;
    }
    return out.some(Boolean) ? out : o.map(() => true);
  },
});

/**
 * Read one option set.
 *
 * @param {string[]} opts every option a learner would see, THE KEY FIRST.
 * @returns {{k:number, v:number[], decisive:boolean[], slots:number[][]}}
 *   `v[s]` is strategy s's first-pick value on this set — `1/|survivors|` when
 *   the key survives, 0 when it does not. `decisive[s]` says the strategy
 *   refused something. `slots[m]` is the key's tie-block spread over the k
 *   sorted places on metric m.
 */
export function readSet(opts, ctx = null) {
  const k = opts.length;
  const v = [], decisive = [];
  for (const st of STRATEGIES) {
    const live = st.live(opts, ctx);
    let n = 0;
    for (const b of live) if (b) n++;
    v.push(live[0] && n ? 1 / n : 0);
    decisive.push(n > 0 && n < k);
  }
  const slots = METRICS.map(([, m]) => {
    const vals = opts.map(m);
    // A metric that cannot read every option in the set has no order to put
    // the key in, so it contributes nothing rather than half an order.
    if (vals.some((x) => typeof x === 'number' && !Number.isFinite(x))) return new Array(k).fill(0);
    const key = vals[0];
    let below = 0, tie = 0;
    for (const x of vals) { if (x < key) below++; else if (x === key) tie++; }
    const row = new Array(k).fill(0);
    for (let s = below; s < below + tie && s < k; s++) row[s] += 1 / tie;
    return row;
  });
  return { k, v, decisive, slots };
}

// ---------------------------------------------------------------------------
// THE RETURNING CADET — the cue no reading of ONE option set can ever see.
//
// Every strategy above is a function of a single set. That is the whole of
// what this gate could read, and it is why it certified the special-answer
// card at 25.00% while a cadet who had met the surface twice first-picked
// 50.00%: the four readings are all phrases, all fourteen glyphs long, all
// free of digits, so no cue inside one card can separate them — and the WHOLE
// ROUTE BANK draws exactly four distinct strings, of which the key is always
// one of two. Nothing about that is visible on one card. It is visible on the
// second one.
//
// So this reads the population the way a learner meets it: over sets. For each
// reading it learns, on HALF the sets, how often that reading turned out to be
// the key; on the other half it plays "take the readings with the best record
// and guess between them". The split is what keeps it honest — a rate fitted
// and scored on the same cards is an oracle and reads about 80% on any bank.
//
// Under the null — the key is just another option — every reading's record is
// 1/k plus noise, so the argmax is an arbitrary option and the strategy is
// worth exactly 1/k. A reading nobody has seen scores the prior, which is the
// same 1/k, so a bank whose options are all unique reads exactly chance and
// this instrument stays silent on it.
//
// TWO VOCABULARIES, because a cadet remembers two things: the reading itself
// ("the answer is one of these two sentences") and its SHAPE ("the answer is
// the one with the divide sign in it"). The second is what catches the beam.
// ---------------------------------------------------------------------------
/** An option reduced to its shape: digits are `#`, letters `@`, words kept. */
export function shapeClass(x) {
  return String(x).replace(/\s+/g, '')
    .replace(/(\\text\{[^}]*\})|(\\[a-zA-Z]+)|(\d+)|([a-zA-Z])/g,
      (m, w, mac, dig) => (w || mac || (dig ? '#' : '@')));
}
const VOCAB = [['the exact reading', (x) => String(x)], ['the reading’s shape', shapeClass]];

const emptyMem = () => VOCAB.map(() => ({ id: new Map(), sets: [], side: [], grp: [] }));

/** Which half of the experiment a card belongs to — by the CARD, never by the
 *  row. The same card is drawn once per locale and the three draws carry the
 *  same numbers, so splitting on the row index puts a card's English copy in
 *  the fit and its Spanish copy in the score, and the "memory" is then a
 *  memory of that one card's answer. Measured: it read 90.5% on the
 *  four-option card, which is an instrument fault and not a finding. */
function memSide(group) {
  let h = 0x811c9dc5 >>> 0;
  const t = String(group);
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h & 1;
}

function absorbMem(mem, opts, group) {
  const side = memSide(group);
  for (let vi = 0; vi < VOCAB.length; vi++) {
    const m = mem[vi], f = VOCAB[vi][1];
    const row = new Array(opts.length);
    for (let i = 0; i < opts.length; i++) {
      const key = f(opts[i]);
      let id = m.id.get(key);
      if (id === undefined) { id = m.id.size; m.id.set(key, id); }
      row[i] = id;
    }
    m.sets.push(row);
    m.side.push(side);
    m.grp.push(String(group));
  }
}

/** How few sets a memory needs before its two halves say anything. */
const MEM_MIN_SETS = 200;
/**
 * How often a reading must have been MET before a cadet is credited with
 * remembering its record.
 *
 * Without this the instrument is a maximum over hundreds of one-observation
 * estimates, and the maximum of noise is not noise: a reading seen once, as
 * the key, scores 1.0 and wins the argmax on the strength of one card. That
 * reads well above chance on a bank that leaks nothing, which is a gate that
 * cries wolf. Eight is the number of times a reading has to come up before
 * "that one is usually right" is a thing a person could have noticed.
 */
const MEM_MIN_SEEN = 8;

/**
 * Play the returning cadet on one surface.
 *
 * @returns {null|{name:string, rate:number, chance:number, z:number, n:number, cue:string}}
 */
function judgeMem(mem, vi) {
  const m = mem[vi];
  const sets = m.sets;
  if (sets.length < MEM_MIN_SETS) return null;
  const num = new Map(), den = new Map();
  for (let i = 0; i < sets.length; i++) {
    if (m.side[i]) continue;
    const st = sets[i];
    for (const id of st) den.set(id, (den.get(id) || 0) + 1);
    num.set(st[0], (num.get(st[0]) || 0) + 1);
  }
  let sum = 0, sq = 0, n = 0, chance = 0;
  /* HOW MANY INDEPENDENT THINGS WERE MEASURED, WHICH IS NOT HOW MANY ROWS.
     Every card is drawn once per locale, and the three draws are the same card:
     the same numbers, the same statement, and — this is the part that matters
     here — the same ANSWER. So three rows carry one observation of "was this
     reading the key", and dividing the variance by the row count claims three
     times the evidence there is. Measured: the special-answer card reads 25.00%
     over 960 cards and 37.50% over 96, and at the row count the second one
     came out at z 3.1 and was printed as a finding on content that is exactly
     at chance. The deviate is taken over CARDS. */
  const cards = new Set();
  let worst = null;
  for (let i = 0; i < sets.length; i++) {
    if (!m.side[i]) continue;
    cards.add(m.grp[i]);
    const st = sets[i], k = st.length;
    const rate = (id) => ((den.get(id) || 0) >= MEM_MIN_SEEN ? (num.get(id) || 0) / den.get(id) : 1 / k);
    let best = -1, cnt = 0, at = -1;
    for (let j = 0; j < k; j++) {
      const r = rate(st[j]);
      if (r > best + 1e-12) { best = r; cnt = 1; at = j; }
      else if (Math.abs(r - best) <= 1e-12) cnt += 1;
    }
    const val = Math.abs(rate(st[0]) - best) <= 1e-12 ? 1 / cnt : 0;
    const e = val - 1 / k;
    sum += e; sq += e * e; n += 1; chance += 1 / k;
    if (val > 0 && (!worst || best > worst.r)) worst = { r: best, id: st[at] };
  }
  if (!n) return null;
  const mean = sum / n;
  const varr = Math.max(0, sq / n - mean * mean);
  const se = Math.sqrt(varr / Math.max(1, cards.size));
  let cue = '?';
  if (worst) for (const [k2, v2] of m.id) if (v2 === worst.id) { cue = k2; break; }
  return {
    name: VOCAB[vi][0], rate: 100 * (mean + chance / n), chance: 100 * chance / n,
    z: se > 0 ? Math.abs(mean) / se : (Math.abs(mean) > 0 ? Infinity : 0),
    n, cards: cards.size, cue, vocab: m.id.size,
  };
}

// ---------------------------------------------------------------------------
// One tally per surface. Nothing is ever added across two of them.
// ---------------------------------------------------------------------------
const emptyTally = (label, what) => ({
  label, what, sets: 0, chance: 0,
  strat: STRATEGIES.map(() => ({ n: 0, sum: 0, sq: 0, decisive: 0 })),
  ranks: {},            // `${metric}:${k}` -> number[]
  places: {},           // where the key/ideal sat, by k -> number[]
  perForm: new Map(),
  /**
   * WHICH CARDS THE ROWS CAME FROM.
   *
   * Every card is drawn once per locale, and for a numeric option set the three
   * draws are the same set: the same options, in the same order, with the same
   * key. Three rows are then one observation about the generator's choice, and
   * a test that divides the variance by the row count claims three times the
   * evidence it has. It showed: the special-answer card's key sits in each of
   * the four printed places EXACTLY 25.0% of the time over 960 cards — chi2
   * 0.0 — and over 96 cards the same content read 17/17/28/37 and was printed
   * as a route finding at chi2 28.1 against 16.3. That is a gate crying wolf on
   * content that is exactly at chance.
   *
   * So every deviate below is taken over CARDS. The correction is the ratio of
   * rows to cards, it is 1 when the caller does not say (nothing changes for a
   * planted bank), and it is conservative for a cue that is real in only one
   * locale — which is the direction a gate should err in.
   */
  cards: new Set(),
  // The returning cadet's two vocabularies, kept on the SURFACE tally only: a
  // form is one skill's worth of cards and the memory that matters is the one
  // built over a whole surface, which is what a learner meets.
  mem: emptyMem(),
});

function absorb(tally, read, where, place = -1, opts = null, group = '') {
  tally.sets += 1;
  tally.chance += 1 / read.k;
  for (let s = 0; s < STRATEGIES.length; s++) {
    const t = tally.strat[s];
    const e = read.v[s] - 1 / read.k;
    t.n += 1; t.sum += e; t.sq += e * e;
    if (read.decisive[s]) t.decisive += 1;
  }
  for (let m = 0; m < METRICS.length; m++) {
    const key = `${METRICS[m][0]}:${read.k}`;
    const row = (tally.ranks[key] ||= new Array(read.k).fill(0));
    for (let i = 0; i < read.k; i++) row[i] += read.slots[m][i];
  }
  if (place >= 0) {
    const row = (tally.places[read.k] ||= new Array(read.k).fill(0));
    row[place] += 1;
  }
  // A learner works ONE SKILL AT A TIME, so a form is a population too, and it
  // is kept as a whole tally rather than a summary: the number that matters is
  // the best FIXED cue over this form's sets, which is what a cadet can play.
  // It used to be the per-set maximum over every cue, which is an oracle that
  // reads about 80% on an honest bank and means nothing.
  if (group) tally.cards.add(group);
  if (opts) absorbMem(tally.mem, opts, group);
  if (where) {
    let f = tally.perForm.get(where);
    if (!f) { f = emptyTally(where, 'one form'); tally.perForm.set(where, f); }
    absorb(f, read, null, place, null, group);
  }
}

/** Rows per card — the factor every deviate on this tally is paid for. */
const deffOf = (t) => (t.cards && t.cards.size ? Math.max(1, t.sets / t.cards.size) : 1);

function chi2(row, deff = 1) {
  const n = row.reduce((a, b) => a + b, 0);
  const k = row.length;
  if (k < 2 || n <= 0) return null;
  const exp = n / k;
  const chi = row.reduce((a, c) => a + ((c - exp) ** 2) / exp, 0) / Math.max(1, deff);
  const crit = CHI2_P001[k - 1] ?? (() => {
    const df = k - 1;
    return df * (1 - 2 / (9 * df) + 3.0902 * Math.sqrt(2 / (9 * df))) ** 3;
  })();
  let worst = 0;
  for (let i = 0; i < k; i++) if (Math.abs(row[i] / n - 1 / k) > Math.abs(row[worst] / n - 1 / k)) worst = i;
  return { n, chi, crit, worst, off: 100 * (row[worst] / n - 1 / k) };
}

/** One strategy's reading on one surface, in points off chance. */
function readStrategy(t, s) {
  const st = t.strat[s];
  if (!st.n) return null;
  const mean = st.sum / st.n;
  const varr = Math.max(0, st.sq / st.n - mean * mean);
  const se = Math.sqrt(varr / (st.n / deffOf(t)));
  return {
    off: 100 * mean,
    z: se > 0 ? Math.abs(mean) / se : (Math.abs(mean) > 0 ? Infinity : 0),
    share: st.decisive / st.n,
    rate: 100 * (mean + t.chance / t.sets),
  };
}

/**
 * Judge one surface.
 *
 * @returns {{lines:string[], faults:string[], cadet:number, chance:number}}
 */
export function judge(tally, { all = false } = {}) {
  const lines = [], faults = [];
  const label = tally.label;
  if (!tally.sets) return { lines: [`  ${label}: no option sets drawn`], faults, cadet: 0, chance: 0 };
  const chance = 100 * tally.chance / tally.sets;

  // The cadet: the best strategy on this surface, judged over the sets where it
  // is decisive often enough to be worth playing.
  let best = null;
  const rows = [];
  for (let s = 0; s < STRATEGIES.length; s++) {
    const r = readStrategy(tally, s);
    if (!r) continue;
    rows.push({ s, ...r });
    if (r.share < RULE_MIN_SHARE) continue;
    if (!best || r.rate > best.rate) best = { s, ...r };
  }
  // THE RETURNING CADET IS PART OF THE HEADLINE, not a footnote. A cadet does
  // not meet one card; the number that matters is the best attack available to
  // somebody who has played this surface before.
  const mems = [];
  for (let vi = 0; vi < VOCAB.length; vi++) {
    const r = judgeMem(tally.mem, vi);
    if (r) mems.push(r);
  }
  const judged = tally.sets >= SURFACE_MIN_SETS;
  let cadet = best ? best.rate : chance;
  let cadetCue = best ? STRATEGIES[best.s].name : 'none';
  for (const r of mems) {
    if (r.rate > cadet) { cadet = r.rate; cadetCue = `remember which reading is the key, by ${r.name}`; }
  }
  const run = (p) => 100 * Math.pow(p / 100, 3);

  lines.push(`  ${label} — ${tally.sets.toLocaleString('en-US')} sets   (${tally.what})`);
  lines.push(`    a cadet who reads no mathematics first-picks   ${cadet.toFixed(2)}%   (chance ${chance.toFixed(2)}%${judged ? `, allowed ${(chance - RULE_BAND).toFixed(2)}–${(chance + RULE_BAND).toFixed(2)}%` : ', too few sets to judge'})`);
  lines.push(`    … and clears a three-item proving run          ${run(cadet).toFixed(2)}%   (chance ${run(chance).toFixed(2)}%)`);
  lines.push(`    the cue that pays: "${cadetCue}"`);
  if (best) {
    lines.push(`      one card at a time — "${STRATEGIES[best.s].name}"`
      + `   ${best.off >= 0 ? '+' : ''}${best.off.toFixed(2)} pts, decisive on ${(100 * best.share).toFixed(1)}% of sets, z ${best.z === Infinity ? 'inf' : best.z.toFixed(1)}`);
  }
  for (const r of mems) {
    const off = r.rate - r.chance;
    lines.push(`      having played it before, by ${r.name.padEnd(18)} ${r.rate.toFixed(2)}%   ${off >= 0 ? '+' : ''}${off.toFixed(2)} pts`
      + `   ${r.vocab} distinct readings over the whole surface, ${r.n} rows over ${r.cards} cards held out, z ${r.z === Infinity ? 'inf' : r.z.toFixed(1)}`
      + `${Math.abs(off) > RULE_BAND ? `   — the best-remembered reading is ${JSON.stringify(r.cue).slice(0, 44)}` : ''}`);
    if (judged && Math.abs(off) > RULE_BAND && r.z > Z_MEM) {
      faults.push(`${label}: a cadet who has played this surface before and plays "take the reading with the best record" `
        + `first-picks ${r.rate.toFixed(2)}% against ${r.chance.toFixed(2)}% — the whole surface draws only ${r.vocab} distinct readings `
        + `(by ${r.name}), so which one is the key is learnable without ever reading the mathematics; `
        + `measured on ${r.cards} CARDS (${r.n} rows) held out of the ${tally.sets.toLocaleString('en-US')} this surface drew`);
    }
  }

  for (const r of rows.sort((a, b) => Math.abs(b.off) - Math.abs(a.off))) {
    const st = STRATEGIES[r.s];
    const worth = Math.abs(r.off);
    const tooRare = r.share < RULE_MIN_SHARE;
    if (all || (!tooRare && worth > RULE_BAND / 2)) {
      lines.push(`      ${st.name.padEnd(38)} ${r.rate.toFixed(2).padStart(6)}%   `
        + `${r.off >= 0 ? '+' : ''}${r.off.toFixed(2)} pts   decisive on ${(100 * r.share).toFixed(1)}%`
        + `${tooRare ? '  — too rare to judge' : ''}`);
    }
    if (!judged || tooRare) continue;
    if (worth > RULE_BAND && r.z > Z_P001) {
      faults.push(`${label}: "${st.name}" first-picks the key ${r.rate.toFixed(2)}% against ${chance.toFixed(2)}% — `
        + `${r.off > 0 ? 'the shape says which one it is' : 'the shape says which ones it is NOT, which is the same leak inverted'}; `
        + `decisive on ${(100 * r.share).toFixed(1)}% of ${tally.sets.toLocaleString('en-US')} sets, worth ${worth.toFixed(1)} points to a cadet who never reads the mathematics`);
    }
  }

  for (const key of Object.keys(tally.ranks).sort()) {
    const row = tally.ranks[key];
    const v = chi2(row, deffOf(tally));
    if (!v || v.n < SURFACE_MIN_SETS) continue;
    const real = v.chi > v.crit, big = Math.abs(v.off) > SLOT_BAND;
    if (all || (real && big)) {
      lines.push(`      key's place by ${key.padEnd(10)} ${row.map((c) => (100 * c / v.n).toFixed(1) + '%').join(' ')}`
        + `   chi2 ${v.chi.toFixed(1)} vs ${v.crit}   worst slot ${v.worst + 1} ${v.off >= 0 ? '+' : ''}${v.off.toFixed(1)} pts`
        + `   ${real && big ? 'BIASED' : real ? 'real but under the band' : 'ok'}`);
    }
    if (judged && real && big) {
      faults.push(`${label}: the key's place by ${key} is not uniform — slot ${v.worst + 1} takes it `
        + `${v.off >= 0 ? '+' : ''}${v.off.toFixed(1)} points off ${(100 / row.length).toFixed(1)}%, chi2 ${v.chi.toFixed(1)} > ${v.crit} over ${Math.round(v.n)} sets`);
    }
  }

  for (const k of Object.keys(tally.places).sort()) {
    const row = tally.places[k];
    const v = chi2(row, deffOf(tally));
    if (!v || v.n < SURFACE_MIN_SETS) continue;
    const real = v.chi > v.crit, big = Math.abs(v.off) > SLOT_BAND;
    lines.push(`      which button it is, of ${k}   ${row.map((c) => (100 * c / v.n).toFixed(1) + '%').join(' ')}`
      + `   worst slot ${v.worst + 1} ${v.off >= 0 ? '+' : ''}${v.off.toFixed(1)} pts   ${real && big ? 'BIASED' : 'ok'}`);
    if (judged && real && big) {
      faults.push(`${label}: the answer is not evenly spread over the ${k} buttons — slot ${v.worst + 1} takes it `
        + `${v.off >= 0 ? '+' : ''}${v.off.toFixed(1)} points off ${(100 / row.length).toFixed(1)}% over ${Math.round(v.n)} trays`);
    }
  }
  return { lines, faults, cadet, chance, cue: cadetCue };
}

// ---------------------------------------------------------------------------
// THE SORTER. It has no option set: it has chips, and two bays to file them in.
//
// The leak worth measuring is therefore not "which option is the key" but "can
// a chip's bay be read off anything but the mathematics". The mathematics here
// is one question — does this term carry the unknown — so the cues to test are
// the ones that are NOT that: how long the chip is, and how many digits it
// carries.
//
// A card SEPARATES on a metric when every chip in one bay measures strictly
// above every chip in the other. On such a card a cadet who has learned the
// direction once files the whole board with no algebra in it. Under the null
// the direction is a coin, so the bar is 50% and it is two-sided.
// ---------------------------------------------------------------------------
const emptySorter = (label) => ({
  label, cards: 0, chips: 0, letter: 0, by: METRICS.map(() => ({ sep: 0, varHigh: 0 })),
  // The kind of every chip IN THE ORDER THE TRAY LAYS IT OUT — the whole of
  // what the positional attack below reads. `printed` is the same board in the
  // order the STATEMENT writes its terms, which is what the tray used to be
  // built out of: it is measured and printed beside the tray so that a revert
  // to `parseTerms` order is a number in the report and not a silence.
  boards: [], printed: [],
});

function absorbSorter(t, strs, isVar, v, printedVar = null) {
  t.cards += 1;
  t.chips += strs.length;
  if (isVar.length >= 2 && isVar.length <= 8) {
    t.boards.push(isVar.slice());
    t.printed.push((printedVar || isVar).slice());
  }
  // THE CUE THIS SURFACE MEANS TO GIVE. A chip belongs in the unknown's bay
  // exactly when it carries the unknown, and on this skill reading that IS the
  // mathematics — the whole of what a sorter teaches is that `-7a` is a
  // multiple of the unknown and `30` is not. It is measured, not assumed,
  // because the verdict below depends on it.
  const byLetter = strs.every((s, i) => s.includes(v) === isVar[i]);
  if (byLetter) t.letter += 1;
  const anyVar = isVar.some(Boolean), anyNum = isVar.some((x) => !x);
  if (!anyVar || !anyNum) return;
  for (let m = 0; m < METRICS.length; m++) {
    const vals = strs.map(METRICS[m][1]);
    const vLo = Math.min(...vals.filter((_, i) => isVar[i]));
    const vHi = Math.max(...vals.filter((_, i) => isVar[i]));
    const nLo = Math.min(...vals.filter((_, i) => !isVar[i]));
    const nHi = Math.max(...vals.filter((_, i) => !isVar[i]));
    if (vLo > nHi) { t.by[m].sep += 1; t.by[m].varHigh += 1; }
    else if (vHi < nLo) { t.by[m].sep += 1; }
  }
}

/**
 * THE POSITIONAL ATTACK — can a board be filed by WHERE a chip lies?
 *
 * The two rules above ask whether a chip's SIZE says which bay it belongs in.
 * Neither of them can see the cue that actually shipped, because it is not a
 * property of any chip: it is a property of the ORDER.
 *
 * `parseTerms` reads the printed statement left to right, and a collect-like-
 * terms statement is written `14a + 30 - 7a + 18` — variable, number,
 * variable, number. The tray was built straight out of that list, so 95.5% of
 * 3,279 route boards alternated strictly and the FIRST chip carried the
 * unknown on 3,279 of 3,279. The unknown's bay is the left one on every board.
 * So "tap the first loose chip into the left bay, the next into the right, and
 * keep alternating" filed EVERY chip of EVERY board with no miss — and a board
 * filed with no miss is an UNASSISTED seal, the only kind that advances a
 * proving run.
 *
 * WHAT IS MEASURED. A positional rule is one bit per slot: this slot goes to
 * the unknown's bay, that one to the numbers'. There are 2^n of them for a
 * board of n chips and a cadet needs no arithmetic to play one. The rule is
 * FITTED on half the boards of each size and SCORED on the other half, so a
 * rule that wins by luck on the sample it was chosen from cannot be reported.
 *
 * WHAT IT IS COMPARED WITH. Not zero, and not a hand-set number: the SAME
 * procedure run over the same boards with the chip order permuted at random.
 * That is exactly the null this gate is testing — the order says nothing about
 * the kinds — and it prices in the fact that a board of two unknowns and two
 * numbers is filed by one rule in six however it is laid out. A permutation
 * baseline cannot go stale when the bank changes, which a written constant
 * would.
 */
function positionalAttack(boards, shuffle) {
  const bySize = new Map();
  for (const b of boards) {
    const n = b.length;
    if (!bySize.has(n)) bySize.set(n, []);
    bySize.get(n).push(b);
  }
  let sealed = 0, total = 0;
  for (const [n, list] of bySize) {
    if (list.length < 8) continue;
    const rows = shuffle ? list.map(shuffle) : list;
    const R = 1 << n;
    const fit = new Int32Array(R);
    let trained = 0;
    for (let i = 0; i < rows.length; i += 2) {
      let mask = 0;
      for (let j = 0; j < n; j++) if (rows[i][j]) mask |= 1 << j;
      fit[mask] += 1;
      trained += 1;
    }
    if (!trained) continue;
    let best = 0;
    for (let m = 1; m < R; m++) if (fit[m] > fit[best]) best = m;
    for (let i = 1; i < rows.length; i += 2) {
      let mask = 0;
      for (let j = 0; j < n; j++) if (rows[i][j]) mask |= 1 << j;
      total += 1;
      if (mask === best) sealed += 1;
    }
  }
  return { sealed, total, rate: total ? sealed / total : 0 };
}

/**
 * Judge the sorter.
 *
 * THE RULE IS CONDITIONAL, AND THE CONDITION IS MEASURED.
 *
 * A shape cue on this surface is only a leak if it buys a cadet something the
 * surface does not already hand them. It does not: a chip belongs in the
 * unknown's bay exactly when it carries the unknown's letter, that mark is on
 * every chip, and reading it IS the mathematics `like-terms` teaches. The
 * length correlation that follows from it is not a defect either — it is the
 * letter, counted: `14a` is one character longer than `14` because of the very
 * mark that decides its bay, and no arrangement of the question's own terms can
 * take that back without changing the question.
 *
 * So the length and digit directions are printed in full and are a NOTE — but
 * ONLY while the letter really does file every chip. That is measured on every
 * run, and if it ever stops being true the same numbers become a fault,
 * because then a cadet would be filing boards by something that is not the
 * mathematics and nothing else on the surface would be. `--self-test` plants
 * both sides of that.
 */
function judgeSorter(t) {
  const lines = [], faults = [];
  if (!t.cards) return { lines: [`  ${t.label}: no boards drawn`], faults };
  const letter = t.letter / t.cards;
  lines.push(`  ${t.label} — ${t.cards.toLocaleString('en-US')} boards, ${t.chips.toLocaleString('en-US')} chips   (chips filed into two bays)`);
  lines.push(`    the unknown's letter files every chip on ${(100 * letter).toFixed(1)}% of boards`
    + `   — that mark IS the mathematics here, so a shape cue below can only repeat it`);
  for (let m = 0; m < METRICS.length; m++) {
    const { sep, varHigh } = t.by[m];
    const share = sep / t.cards;
    const dir = sep ? 100 * varHigh / sep : 50;
    const clears = 100 * share * Math.max(dir, 100 - dir) / 100;
    const rare = share < RULE_MIN_SHARE;
    lines.push(`    ${METRICS[m][0].padEnd(7)} splits the two bays on ${(100 * share).toFixed(1)}% of boards`
      + `   the unknown's chips are the ${dir >= 50 ? 'longer' : 'shorter'} ones ${Math.max(dir, 100 - dir).toFixed(1)}% of the time (chance 50%)`
      + `${rare ? '  — too rare to judge' : ''}`);
    lines.push(`      a cadet who has learned that direction files a whole board with no algebra on ${clears.toFixed(1)}% of them`
      + `${letter >= 0.999 ? '  — a note, not a finding: the letter already does' : ''}`);
    if (!rare && t.cards >= SURFACE_MIN_SETS && Math.abs(dir - 50) > RULE_BAND && letter < 0.999) {
      faults.push(`${t.label}: the unknown's letter files every chip on only ${(100 * letter).toFixed(1)}% of boards, `
        + `and on the ${(100 * share).toFixed(1)}% where ${METRICS[m][0]} splits the two bays the unknown's chips are the `
        + `${dir >= 50 ? 'longer' : 'shorter'} ones ${Math.max(dir, 100 - dir).toFixed(1)}% of the time against 50% — `
        + `a cadet who learns that once files a whole board with no algebra in it on ${clears.toFixed(1)}% of boards`);
    }
  }

  // THE ORDER. Unconditional: no reading of any chip can excuse it, because it
  // is not about the chips.
  if (t.boards.length >= 40) {
    let seed = 0x9e3779b9;
    const rnd = () => { seed = (Math.imul(seed ^ (seed >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
    const perm = (b) => { const a = b.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const real = positionalAttack(t.boards, null);
    const null_ = positionalAttack(t.boards, perm);
    const printed = positionalAttack(t.printed, null);
    const off = 100 * (real.rate - null_.rate);
    const pooled = (real.sealed + null_.sealed) / Math.max(1, real.total + null_.total);
    const se = Math.sqrt(Math.max(1e-12, pooled * (1 - pooled) * (1 / Math.max(1, real.total) + 1 / Math.max(1, null_.total))));
    const z = Math.abs(real.rate - null_.rate) / se;
    lines.push(`    the best fixed POSITIONAL rule — one bay per slot, no chip read — seals a whole board with no miss`);
    lines.push(`      on ${(100 * real.rate).toFixed(1)}% of boards   (the same rule over a DRAWN chip order: ${(100 * null_.rate).toFixed(1)}%`
      + `, ${real.total} boards held out of the fit, z ${z === Infinity ? 'inf' : z.toFixed(1)})`);
    lines.push(`      … and over the order the STATEMENT writes its terms in, which the tray used to be built out of: `
      + `${(100 * printed.rate).toFixed(1)}%`);
    if (t.cards >= SURFACE_MIN_SETS && off > RULE_BAND && z > Z_P001) {
      faults.push(`${t.label}: the chips lie in an order that files them. The best fixed positional rule — tap slot 1 into `
        + `one bay, slot 2 into the other, no chip ever read — seals a whole board with NO MISS on ${(100 * real.rate).toFixed(1)}% `
        + `of boards against ${(100 * null_.rate).toFixed(1)}% for the same rule over a drawn order, +${off.toFixed(1)} points over `
        + `${real.total} held-out boards. A board sealed with no miss is an UNASSISTED seal, which is what advances a proving run`);
    }
  }
  return { lines, faults };
}

// ---------------------------------------------------------------------------
// THE AREA FIELD. Two cells and one tray, so it is TWO option sets on one card
// — the chips that carry the unknown and the chips that do not — and the thing
// a cadet gets paid for is covering BOTH with no miss, because a rejected drop
// is a miss and a card with a miss on it is not an unassisted seal.
//
// The per-cell sets go into an ordinary surface tally, so all 32 rules read
// them against that cell's own chance. The JOINT number is kept beside it,
// because 1/3 x 1/3 is 11.1% and that is the number a curriculum director
// asks for: how often does a cadet who never opens a bracket seal the card.
// ---------------------------------------------------------------------------
const emptyJoint = (label) => ({ label, cards: 0, chance: 0, strat: STRATEGIES.map(() => ({ n: 0, sum: 0, sq: 0, dec: 0 })) });

function absorbArea(t, j, letters, numbers, ctx, where, group) {
  if (letters.length < 2 || numbers.length < 2) return;
  const rl = readSet(letters, ctx), rn = readSet(numbers, ctx);
  absorb(t, rl, where, -1, letters, `${group}|a`);
  absorb(t, rn, where, -1, numbers, `${group}|b`);
  j.cards += 1;
  const ch = 1 / (letters.length * numbers.length);
  j.chance += ch;
  for (let i = 0; i < STRATEGIES.length; i++) {
    const val = rl.v[i] * rn.v[i];
    const e = val - ch;
    j.strat[i].n += 1; j.strat[i].sum += e; j.strat[i].sq += e * e;
    if (rl.decisive[i] || rn.decisive[i]) j.strat[i].dec += 1;
  }
}

function judgeJoint(j) {
  const lines = [], faults = [];
  if (!j.cards) return { lines, faults };
  const chance = 100 * j.chance / j.cards;
  let best = null;
  const rows = [];
  for (let i = 0; i < STRATEGIES.length; i++) {
    const st = j.strat[i];
    if (!st.n) continue;
    const mean = st.sum / st.n;
    const varr = Math.max(0, st.sq / st.n - mean * mean);
    const se = Math.sqrt(varr / st.n);
    const row = {
      i, rate: 100 * (mean + j.chance / j.cards), off: 100 * mean, share: st.dec / st.n,
      z: se > 0 ? Math.abs(mean) / se : (Math.abs(mean) > 0 ? Infinity : 0),
    };
    rows.push(row);
    if (row.share >= RULE_MIN_SHARE && (!best || row.rate > best.rate)) best = row;
  }
  const cadet = best ? best.rate : chance;
  lines.push(`    covering BOTH cells with no miss — the only reading that seals the card`);
  lines.push(`      a cadet who reads no mathematics does it on ${cadet.toFixed(2)}% of cards   (chance ${chance.toFixed(2)}%)`);
  if (best) {
    lines.push(`      the cue that pays: "${STRATEGIES[best.i].name}"   ${best.off >= 0 ? '+' : ''}${best.off.toFixed(2)} pts`
      + `   decisive on ${(100 * best.share).toFixed(1)}% of cards, z ${best.z === Infinity ? 'inf' : best.z.toFixed(1)}`);
  }
  for (const r of rows) {
    if (r.share < RULE_MIN_SHARE || j.cards < SURFACE_MIN_SETS) continue;
    if (Math.abs(r.off) > RULE_BAND && r.z > Z_P001) {
      faults.push(`${j.label}: "${STRATEGIES[r.i].name}" covers BOTH cells with no miss on ${r.rate.toFixed(2)}% of cards `
        + `against ${chance.toFixed(2)}% — that is an unassisted seal with no mathematics in it, `
        + `on ${j.cards.toLocaleString('en-US')} cards`);
    }
  }
  return { lines, faults, cadet, chance };
}

// ---------------------------------------------------------------------------
const SURFACES = [
  ['choice', 'the four-option card', 'every distractor, shown at once'],
  ['special', 'the special-answer card', 'the same surface; the key is a phrase'],
  ['narrow', 'the narrowed field', 'the key and the first two, after two honest misses'],
  ['balance', 'the balance move tray', 'the moves offered; the key is the IDEAL one'],
  ['area', 'the area field', 'one tray, two cells; a chip of each kind is right'],
];

/**
 * THE VERDICT OF THIS GATE, as a pure function so it can be planted against.
 *
 * Both arrays it is handed are ROUTE-SCOPED BY CONSTRUCTION: `faults` and
 * `formFaults` are built only out of `T.ROUTE`, the tally of the units
 * `content/courses.json` puts in front of a learner. That is the whole reason
 * the old ending was a defect — it printed `formFaults` in full and then said
 * `the bar this gate enforces is the surface` and returned 0.
 *
 * @param {string[]} faults        surface-level leaks, on the route
 * @param {string[]} formFaults    per-form leaks, on the route
 * @param {string[]} previewFaults anything in a unit nobody is sent to
 * @param {Function} [make]        `findings` in the build, `sandbox` in a test
 */
export function shapeVerdict(faults, formFaults, previewFaults, make = findings) {
  const F = make('check:shape', { scope: 'sweep' });
  F.route(faults);
  F.route(formFaults);
  F.preview(previewFaults);
  return F;
}

async function run() {
  for (const { unit } of await allUnits()) await loadUnit(unit);
  const { road } = await routeUnits();
  const surf = await realSurfaces();
  const unitOf = new Map();
  for (const { unit } of await allUnits()) {
    const g = JSON.parse(await readFile(path.join(ROOT, 'content', unit.graph), 'utf8'));
    for (const n of g.nodes) unitOf.set(n.id, unit.id);
  }
  const onRoute = new Set(road.map((u) => u.id));

  const SEEDS = Number(arg('seeds', 12));
  const only = arg('skill', null);
  const skills = only ? SKILLS.filter((s) => s === only) : SKILLS.slice();
  if (!skills.length) { console.error(`no such skill: ${only}`); process.exit(2); }

  const mk = (where) => {
    const t = {};
    for (const [id, label, what] of SURFACES) t[id] = emptyTally(`${where} · ${label}`, what);
    t.sort = emptySorter(`${where} · the sorter`);
    t.areaJoint = emptyJoint(`${where} · the area field`);
    return t;
  };
  const T = { ROUTE: mk('ROUTE'), preview: mk('preview') };
  const census = { ROUTE: new Map(), preview: new Map() };
  // THE FREE KEYPAD HAS NO OPTION SET, so no rule above can read it — and it
  // is the surface with the least forgiving baseline in the game, because a
  // cadet has to produce the answer rather than pick it. The one cue that
  // survives there is the stem printing the answer itself, which is exactly
  // what a `dispute` form does when it quotes two readings and one of them is
  // right. It is counted here and nowhere else.
  const pad = { ROUTE: { n: 0, gave: 0, forms: new Map() }, preview: { n: 0, gave: 0, forms: new Map() } };
  let skipped = 0;

  for (const skill of skills) {
    const unit = unitOf.get(skill) || '?';
    const where = onRoute.has(unit) ? 'ROUTE' : 'preview';
    const t = T[where], cen = census[where];
    for (const form of FORMS_BY_SKILL[skill] || []) {
      for (let d = form.dMin; d <= form.dMax; d++) {
        for (let s = 0; s < SEEDS; s++) {
          const seed = s * 7919 + d * 131;
          for (const loc of LOCALES) {
            let it;
            try { it = generate(skill, d, seed, { locale: loc, form: form.id, strict: true, record: false }); }
            catch { skipped += 1; continue; }
            if (!it) continue;
            let r;
            try { r = surf.route(it, seed); } catch { skipped += 1; continue; }
            cen.set(r.name, (cen.get(r.name) || 0) + 1);
            const where2 = `${skill}/${form.id}`;

            const ctx = { stem: String(it.stem || '') };
            // THE CARD, not the row: the same card is drawn once per locale and
            // its numbers do not change, so the three copies must not be split
            // between the fit and the score. (see `memSide`)
            const card = `${skill}|${form.id}|${d}|${seed}`;
            if (r.name === 'choice') {
              const opts = surf.choiceOptions(it);
              if (opts.length < 2) continue;
              absorb(t.choice, readSet(opts, ctx), where2, -1, opts, card);
              if (it.type === 'special') absorb(t.special, readSet(opts, ctx), where2, -1, opts, card);
            } else if (r.name === 'keypad') {
              const P = pad[where];
              P.n += 1;
              if (quoteAt(bare(ctx.stem), bare(String(it.answer))) >= 0) {
                P.gave += 1;
                P.forms.set(where2, (P.forms.get(where2) || 0) + 1);
              }
              // Every keypad card can narrow. `_narrow` refuses a field of one.
              const opts = surf.narrowOptions(it);
              if (opts.length < 2) continue;
              absorb(t.narrow, readSet(opts, ctx), where2, -1, opts, card);
            } else if (r.name === 'area') {
              const { chips, wantA, wantB } = r.field;
              const carries = (x) => /[A-Za-z]/.test(String(x).replace(/\\[a-zA-Z]+/g, ' '));
              const all = chips.map((c) => String(c.v ?? c));
              const letters = [wantA, ...all.filter((x) => x !== wantA && carries(x))];
              const numbers = [wantB, ...all.filter((x) => x !== wantB && !carries(x))];
              absorbArea(t.area, t.areaJoint, letters, numbers, ctx, where2, card);
            } else if (r.name === 'balance') {
              const { S, candidates, ideal } = r.beam;
              let list, best;
              try { list = candidates(S); best = ideal(S); } catch { continue; }
              if (!best || !list?.length) continue;
              const at = list.findIndex((o) => o.tex === best.tex);
              if (at < 0) continue;
              const opts = [list[at].tex, ...list.filter((_, i) => i !== at).map((o) => o.tex)];
              absorb(t.balance, readSet(opts, ctx), where2, at, opts, card);
            } else if (r.name === 'sort') {
              // THE TRAY, not the parse. `chipOrder` is the list the surface
              // really lays out; `terms` is the statement's own order, which is
              // what it used to be, and both are read so the report can say
              // what the change bought.
              const { terms, v, chipOrder } = r.chips;
              const lay = chipOrder || terms;
              const co = (c) => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
              absorbSorter(t.sort, lay.map((x) => (x.kind === 'var' ? co(x.c) : String(x.c))),
                lay.map((x) => x.kind === 'var'), v, terms.map((x) => x.kind === 'var'));
            }
          }
        }
      }
    }
  }

  const total = [...census.ROUTE.values()].reduce((a, b) => a + b, 0)
    + [...census.preview.values()].reduce((a, b) => a + b, 0);
  console.log(`choice shape — ${total.toLocaleString('en-US')} cards over ${skills.length} skills, `
    + `${SEEDS} seeds per band, ${LOCALES.join('/')}${skipped ? `, ${skipped} draws the bank refused` : ''}`);
  console.log(`the route is ${[...onRoute].join(' + ')}; everything else is preview and is advisory`);
  console.log(`the surfaces are read out of src/ui/rift.js (${surf.anchors.length} anchors, `
    + `lines ${surf.anchors.map((a) => a.line).join(' ')}) — nothing here keeps a copy of the routing chain\n`);

  console.log('the census — where the routing chain actually sends a card:');
  for (const where of ['ROUTE', 'preview']) {
    const cen = census[where];
    const n = [...cen.values()].reduce((a, b) => a + b, 0) || 1;
    const shown = new Set(['choice', 'keypad', 'balance', 'sort', 'area']);
    const row = [...cen.entries()].sort((a, b) => b[1] - a[1])
      .map(([k, c]) => `${k} ${c.toLocaleString('en-US')} (${(100 * c / n).toFixed(1)}%)${shown.has(k) ? '' : '*'}`);
    console.log(`  ${where.padEnd(8)} ${row.join('   ')}`);
  }
  console.log('  * no option set is drawn on that surface; it is counted and not judged\n');

  const faults = [], previewFaults = [], formFaults = [];
  for (const where of ['ROUTE', 'preview']) {
    const bag = where === 'ROUTE' ? faults : previewFaults;
    for (const [id] of SURFACES) {
      const { lines, faults: f } = judge(T[where][id], { all: has('--strategies') });
      lines.forEach((l) => console.log(l));
      if (where === 'ROUTE') bag.push(...f); else bag.push(...f);
      console.log('');
    }
    const aj = judgeJoint(T[where].areaJoint);
    aj.lines.forEach((l) => console.log(l));
    bag.push(...aj.faults);
    if (aj.lines.length) console.log('');
    const sj = judgeSorter(T[where].sort);
    sj.lines.forEach((l) => console.log(l));
    bag.push(...sj.faults);
    console.log('');

    // THE FREE KEYPAD. No option set, so no baseline but zero: a stem that
    // prints the answer hands it over, and a cadet who types the number they
    // just read needs no mathematics at all.
    const P = pad[where];
    if (P.n) {
      const rate = 100 * P.gave / P.n;
      console.log(`  ${where} · the free keypad — ${P.n.toLocaleString('en-US')} cards   (no option set is drawn; the cadet must produce the answer)`);
      console.log(`    the STEM prints the answer on ${rate.toFixed(2)}% of them   (a cadet who types what they just read needs no mathematics)`);
      for (const [fid, c] of [...P.forms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
        console.log(`      ${fid.padEnd(32)} ${c} card(s)`);
      }
      if (P.gave) {
        const worst = [...P.forms.entries()].sort((a, b) => b[1] - a[1]);
        bag.push(`${where} · the free keypad: the stem prints the answer itself on ${P.gave} of ${P.n.toLocaleString('en-US')} cards `
          + `(${rate.toFixed(2)}%) — a keypad has no option set, so a cadet who types the reading the sentence just quoted `
          + `seals the card with nothing at all; worst forms: ${worst.slice(0, 4).map(([f, c]) => `${f} (${c})`).join(', ')}`);
      }
      console.log('');
    }
  }

  // THE FORMS, ON EVERY RUN. A surface's number is an average over every form
  // that lands on it, and a learner does not meet an average: the scheduler
  // hands out one skill at a time, so a single form at 87% is a cadet being
  // handed the answer for a whole sitting while the surface reads 34.9%. This
  // is the same population error as the one this rewrite exists for, one level
  // down, so the worst forms are printed whether or not anybody asked.
  console.log('the route forms furthest from chance — a learner works ONE SKILL at a time:');
  let anyForm = false;
  for (const [id, label] of SURFACES) {
    const rows = [];
    for (const [fid, f] of T.ROUTE[id].perForm.entries()) {
      if (f.sets < FORM_MIN_SETS) continue;
      const { cadet, chance, faults: ff, cue } = judge(f);
      rows.push({ fid, sets: f.sets, cadet, chance, cue, real: ff.length > 0 });
    }
    rows.sort((a, b) => (b.cadet - b.chance) - (a.cadet - a.chance));
    // A form is a few hundred sets, not tens of thousands, so the best of
    // twenty-one cues sits above chance on an honest form by luck alone. The
    // list is printed off the plain distance from chance; a FINDING needs the
    // same two-part test every other rule here passes — off the band AND
    // distinguishable from chance at p<0.001 with the Bonferroni step.
    const worst = rows.filter((x) => x.real);
    if (!rows.length) continue;
    anyForm = true;
    console.log(`  ${label} — ${rows.length} forms with ${FORM_MIN_SETS}+ sets, `
      + `${worst.length} of them over ${RULE_BAND} points`);
    for (const x of (has('--per-form') ? rows : worst).slice(0, 12)) {
      console.log(`    ${x.fid.padEnd(32)} ${String(x.sets).padStart(5)} sets   `
        + `${x.cadet.toFixed(1)}% vs ${x.chance.toFixed(1)}%   "${x.cue}"`);
    }
    for (const x of worst) {
      formFaults.push(`${label}: the form ${x.fid} hands a cadet who plays "${x.cue}" ${x.cadet.toFixed(1)}% `
        + `against ${x.chance.toFixed(1)}% over ${x.sets} sets — a learner works one skill at a time, so that is what a whole sitting on it is worth`);
    }
  }
  if (!anyForm) console.log('  (no form drew enough sets to read)');
  console.log('');

  /* THE LEDGER OWNS THE VERDICT — see tools/_findings.mjs.
     What used to stand here is the third occurrence of one disease: this gate
     found per-form leaks ON THE SHIPPED ROUTE at 62.2% and 57.3% against a 25%
     chance, printed every one of them in full, and then wrote
     `the bar this gate enforces is the surface` and RETURNED 0. A route finding
     printed inside a passing log is a finding nobody reads: two critics later
     re-found this one by hand.

     `formFaults` is route-scoped by construction — it is built only out of
     `T.ROUTE` — so it goes on the ledger as route, beside `faults`, and the
     collector decides what that is worth. Nothing about the measurement
     changed; what changed is that the gate no longer gets to grade it. */
  const F = shapeVerdict(faults, formFaults, previewFaults);
  if (!faults.length) {
    console.log(`no SURFACE a learner meets carries a shape cue worth more than ${RULE_BAND} points`
      + `${formFaults.length ? `, but ${formFaults.length} single FORM does — and a learner works one skill at a time` : ''}`);
  }
  return F.report();
}

// ---------------------------------------------------------------------------
// SELF-TEST — plant a leak IN ONE SURFACE and require that surface to refuse
// it, prove the other surfaces stay quiet, and prove the old averaged reading
// would have hidden it. Then plant the nearest HONEST content and require the
// same rule to stay quiet on that.
//
// Built by hand rather than drawn from the bank, so the cases stay what they
// are after somebody fixes the bank: a self-test that depends on the content
// still being broken stops testing anything the moment the content is fixed.
// ---------------------------------------------------------------------------
function selfTest() {
  let bad = 0;
  const say = (ok, what) => { if (ok) console.log(`  ${ok === 'skip' ? '~' : '·'} ${what}`); else { console.error(`SELF-TEST FAIL: ${what}`); bad++; } };

  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed ^ (seed >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
  const digits = (n) => String(Math.floor(rnd() * Math.pow(10, n)) + Math.pow(10, n - 1));

  /** A bank of n sets of k options, built by a rule that says where the key sits. */
  const bank = (label, n, k, place, opts = null) => {
    const t = emptyTally(label, 'planted');
    for (let i = 0; i < n; i++) {
      const lens = [3, 5, 7, 9, 11].slice(0, k);
      const vals = opts ? opts(i) : lens.map((L) => digits(L));
      const at = place(i);
      absorb(t, readSet([vals[at], ...vals.filter((_, j) => j !== at)]), null);
    }
    return t;
  };

  console.log('the reader itself');
  const r = readSet(['12', '12', '1234', '123456']);
  const iOf = (nm) => STRATEGIES.findIndex((s) => s.name === nm);
  say(r.v[iOf('take the unique shortest option')] === 0.25,
    'a key TIED for shortest leaves "take the unique shortest" undecided, worth exactly 1/k');
  say(r.v[iOf('take the unique longest option')] === 0,
    'the unique longest is seen, and it is not the key');
  say(Math.abs(r.slots[0][0] - 0.5) < 1e-9 && Math.abs(r.slots[0][1] - 0.5) < 1e-9,
    'a two-way tie puts half the key in each of the two places it covers');
  const words = readSet(['\\text{no solution}', '\\text{every value works}', '7', '24']);
  say(words.v[iOf('take the ones with words')] === 0.5,
    'THE SPECIAL-ANSWER LEAK IS READABLE: two phrases among two bare numbers, and striking the numbers is worth 50%');
  say(words.v[iOf('take the ones without words')] === 0,
    '  … and its mirror scores zero, which is the same leak upside down');

  console.log('\nthe null — every strategy is worth exactly 1/k when shape says nothing');
  for (const k of [3, 4, 5]) {
    const honest = bank(`honest k=${k}`, 6000, k, () => Math.floor(rnd() * k));
    const j = judge(honest);
    say(j.faults.length === 0, `quiet on an honest ${k}-option bank (cadet ${j.cadet.toFixed(2)}% against ${j.chance.toFixed(2)}%)`);
  }

  console.log('\nPLANTED, ONE SURFACE AT A TIME');
  // 1. The four-option card: the key is always the shortest.
  const card = bank('ROUTE · the four-option card', 6000, 4, () => 0);
  const cf = judge(card).faults;
  say(cf.some((f) => /four-option card/.test(f) && /unique shortest/.test(f)),
    'the four-option card refuses a key that is always the shortest option');
  // 2. … and the over-correction, which is the same leak inverted.
  const never = bank('ROUTE · the four-option card', 6000, 4, () => 1 + Math.floor(rnd() * 3));
  const nf = judge(never).faults;
  say(nf.some((f) => /same leak inverted/.test(f)),
    'the four-option card refuses a key that is NEVER the shortest — the over-correction that shipped');
  // 3. The narrowed field, against ITS OWN chance of 1/3.
  const narrow = bank('ROUTE · the narrowed field', 6000, 3, () => 2);
  const naf = judge(narrow).faults;
  say(naf.some((f) => /narrowed field/.test(f) && /unique longest/.test(f)),
    'THE NARROWED FIELD refuses a key that is always the longest of three — judged against 33.33%, not 25%');
  const narrowOk = judge(bank('ROUTE · the narrowed field', 6000, 3, () => Math.floor(rnd() * 3)));
  say(narrowOk.faults.length === 0 && Math.abs(narrowOk.chance - 100 / 3) < 0.01,
    '  … and the same field is quiet at 33.33% when the key falls anywhere');
  // 4. The special-answer card: the key is a phrase, two options are numbers.
  const spec = emptyTally('ROUTE · the special-answer card', 'planted');
  for (let i = 0; i < 3000; i++) {
    const other = rnd() < 0.5 ? '\\text{no solution}' : '\\text{every value works}';
    absorb(spec, readSet(['\\text{it never balances}', other, digits(1), digits(2)]), null);
  }
  const sf = judge(spec).faults;
  say(sf.some((f) => /special-answer card/.test(f) && /words/.test(f)),
    'the special-answer card refuses a key in WORDS beside two bare numbers — 50% against 25%');
  const specOk = emptyTally('ROUTE · the special-answer card', 'planted');
  for (let i = 0; i < 3000; i++) {
    const four = ['\\text{no solution}', '\\text{every value works}', '\\text{only x = 4}', '\\text{only x = 17}'];
    const at = Math.floor(rnd() * 4);
    absorb(specOk, readSet([four[at], ...four.filter((_, j) => j !== at)]), null);
  }
  say(judge(specOk).faults.length === 0,
    '  … and is quiet when every reading is a phrase and the key falls anywhere among them');
  // 5. The balance tray: the ideal move is always the last button.
  const tray = emptyTally('ROUTE · the balance move tray', 'planted');
  for (let i = 0; i < 3000; i++) {
    const five = [0, 1, 2, 3, 4].map((j) => `+\; ${digits(1 + (j % 3))}${'x'.repeat(j)}`);
    const read = readSet(five);
    absorb(tray, read, null, 4);
  }
  const tf = judge(tray).faults;
  say(tf.some((f) => /balance move tray/.test(f) && /not evenly spread over the 5 buttons/.test(f)),
    'THE BALANCE TRAY refuses an ideal move that is always the last button — 100% against 20%');
  const trayOk = emptyTally('ROUTE · the balance move tray', 'planted');
  for (let i = 0; i < 3000; i++) {
    const five = [0, 1, 2, 3, 4].map(() => digits(3));
    absorb(trayOk, readSet(five), null, Math.floor(rnd() * 5));
  }
  say(judge(trayOk).faults.length === 0,
    '  … and is quiet when the ideal move lands on every button equally and no move looks different');
  // 6. The sorter: the unknown's chips are always the longer ones.
  // A board whose chips no longer carry the unknown — the mark that IS the
  // mathematics — and which is therefore filed by nothing but its shape.
  const sortBad = emptySorter('ROUTE · the sorter');
  for (let i = 0; i < 2000; i++) absorbSorter(sortBad, ['13?', '25?', '4', '9'], [true, true, false, false], 'n');
  say(judgeSorter(sortBad).faults.some((f) => /sorter/.test(f) && /longer/.test(f)),
    'THE SORTER refuses a board the letter cannot file and the shape can — 100% against 50%');
  // The ORDER is drawn in all three of these, because what they are about is
  // whether a chip's SIZE files it; a fixed layout would set off the
  // positional rule below and prove nothing about the rule under test.
  const lay = (strs, isVar) => {
    const ix = strs.map((_, i) => i);
    for (let i = ix.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ix[i], ix[j]] = [ix[j], ix[i]]; }
    return [ix.map((i) => strs[i]), ix.map((i) => isVar[i])];
  };
  const sortLetter = emptySorter('ROUTE · the sorter');
  for (let i = 0; i < 2000; i++) absorbSorter(sortLetter, ...lay(['13n', '25n', '4', '9'], [true, true, false, false]), 'n');
  const sl = judgeSorter(sortLetter);
  say(sl.faults.length === 0 && sl.lines.some((l) => /letter already does/.test(l)),
    '  … and calls the SAME shape correlation a note when the letter files every chip itself');
  const sortOk = emptySorter('ROUTE · the sorter');
  for (let i = 0; i < 2000; i++) {
    const flip = rnd() < 0.5;
    absorbSorter(sortOk, ...lay(flip ? ['13?', '25?', '4', '9'] : ['3?', '7?', '124', '195'],
      [true, true, false, false]), 'n');
  }
  say(judgeSorter(sortOk).faults.length === 0,
    '  … and is quiet on a letterless board when the direction is a coin');

  // ------------------------------------------------------------------
  // 7. THE RETURNING CADET. Plant a surface whose option set never changes and
  //    whose key is confined to two of the four strings — the special-answer
  //    card as it shipped — and require the memory to name it. Then plant the
  //    same fixed set with a uniform key and require silence, because that is
  //    the repair and a gate that cannot tell them apart certifies nothing.
  // ------------------------------------------------------------------
  console.log('\nTHE RETURNING CADET — the cue no reading of one card can see');
  const FOUR = ['\\text{no value works}', '\\text{each one works}',
    '\\text{only one works}', '\\text{only four work}'];
  const memBank = (n, key, group = (i) => `card${i}`) => {
    const t = emptyTally('ROUTE · the special-answer card', 'planted');
    for (let i = 0; i < n; i++) {
      const at = key(i);
      const opts = [FOUR[at], ...FOUR.filter((_, j) => j !== at)];
      absorb(t, readSet(opts), null, -1, opts, group(i));
    }
    return t;
  };
  const twoOfFour = judge(memBank(4000, () => (rnd() < 0.5 ? 0 : 1)));
  say(twoOfFour.faults.some((f) => /played this surface before/.test(f)) && twoOfFour.cadet > 45,
    `a fixed set of four readings whose key is always one of TWO is refused — the cadet reads ${twoOfFour.cadet.toFixed(2)}% against 25%`);
  /* AND THE CORRECTION IT COST: the deviate is taken over cards, not rows, so
     the plant has to survive being drawn only 96 times — the number of cards
     the shipped special-answer card really draws at the gate's own seed count,
     each of them once per locale. If this stops firing, the correction has been
     paid for with the finding it exists to make. */
  const small = judge(memBank(288, () => (rnd() < 0.5 ? 0 : 1), (i) => `card${Math.floor(i / 3)}`));
  say(small.faults.some((f) => /played this surface before/.test(f)),
    `  … and it is still refused at 96 cards drawn in three locales — the size the shipped card really is (${small.cadet.toFixed(2)}%)`);
  const allFour = judge(memBank(4000, () => Math.floor(rnd() * 4)));
  say(allFour.faults.length === 0 && Math.abs(allFour.cadet - 25) < 3,
    `  … and the SAME four readings with the key drawn over all of them are clean at ${allFour.cadet.toFixed(2)}%`);
  const unique = judge(bank('ROUTE · the four-option card', 4000, 4, () => Math.floor(rnd() * 4)));
  say(unique.faults.length === 0,
    '  … and a bank whose readings are all different reads chance, because a reading nobody has met twice is not remembered');
  // THE INSTRUMENT'S OWN FAULT, PLANTED. The same card is drawn once per
  // locale with the same numbers; splitting the memory by ROW puts one copy in
  // the fit and another in the score, and the "memory" is then a memory of
  // that card's answer. It read 90.5% on honest content before `memSide`.
  const perRow = judge(bank('ROUTE · the four-option card', 4000, 4, () => Math.floor(rnd() * 4)));
  const triple = emptyTally('ROUTE · the four-option card', 'planted');
  for (let i = 0; i < 1400; i++) {
    const vals = [3, 5, 7, 9].map((L) => digits(L));
    const at = Math.floor(rnd() * 4);
    const opts = [vals[at], ...vals.filter((_, j) => j !== at)];
    for (let c = 0; c < 3; c++) absorb(triple, readSet(opts), null, -1, opts, `card${i}`);
  }
  say(judge(triple).faults.length === 0,
    '  … and three locale copies of one card cannot teach the cadet that card, because the split is by CARD and not by row');
  say(perRow.faults.length === 0, '  … and the honest control beside it is clean');

  // ------------------------------------------------------------------
  // 8. THE SORTER'S ORDER. The defect that shipped: chips laid out in the
  //    statement's own term order, which alternates.
  // ------------------------------------------------------------------
  console.log('\nTHE SORTER, BY POSITION — the cue that is not a property of any chip');
  const sortBoards = (make) => {
    const t = emptySorter('ROUTE · the sorter');
    for (let i = 0; i < 900; i++) {
      const isVar = make(i);
      const strs = isVar.map((b, j) => (b ? `${2 + j}n` : String(3 + j)));
      absorbSorter(t, strs, isVar, 'n');
    }
    return t;
  };
  const alt = judgeSorter(sortBoards(() => [true, false, true, false]));
  say(alt.faults.some((f) => /order that files them/.test(f)),
    'THE SORTER refuses a tray laid out variable, number, variable, number — one rule seals every board with no miss');
  const drawn = judgeSorter(sortBoards(() => {
    const a = [true, true, false, false];
    for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }));
  say(drawn.faults.length === 0,
    '  … and is quiet on the same two-and-two boards when the order is drawn');
  // The half that keeps it switched on: a board of three unknowns and one
  // number is filed by one rule in four HOWEVER it is laid out, and that is
  // arithmetic about the board and not a leak. The permutation null prices it.
  const lopsided = judgeSorter(sortBoards(() => {
    const a = [true, true, true, false];
    for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }));
  say(lopsided.faults.length === 0,
    '  … and quiet on a lopsided board that ONE rule in four seals by construction — the null is a permutation, not a constant');

  // ------------------------------------------------------------------
  // 9. THE AREA FIELD. Two cells, one tray, and the reading that seals a card
  //    is covering both with no miss.
  // ------------------------------------------------------------------
  console.log('\nTHE AREA FIELD — covering both cells with no miss');
  const areaBank = (biggest) => {
    const t = emptyTally('ROUTE · the area field', 'planted');
    const j = emptyJoint('ROUTE · the area field');
    for (let i = 0; i < 900; i++) {
      const base = 3 + Math.floor(rnd() * 20);
      const sizes = [base, base + 7, base + 13];
      const at = biggest ? 2 : Math.floor(rnd() * 3);
      const L = [`${sizes[at]}x`, ...sizes.filter((_, q) => q !== at).map((z) => `${z}x`)];
      const at2 = biggest ? 2 : Math.floor(rnd() * 3);
      const N = [String(sizes[at2] + 1), ...sizes.filter((_, q) => q !== at2).map((z) => String(z + 1))];
      absorbArea(t, j, L, N, null, null, `card${i}`);
    }
    return judgeJoint(j);
  };
  const areaBad = areaBank(true);
  say(areaBad.faults.some((f) => /covers BOTH cells/.test(f)),
    `THE AREA FIELD refuses a tray whose two right chips are the biggest of their kind — ${areaBad.cadet.toFixed(2)}% against ${areaBad.chance.toFixed(2)}%`);
  const areaOk = areaBank(false);
  say(areaOk.faults.length === 0,
    `  … and is quiet when the right chip's place in the size order is drawn (${areaOk.cadet.toFixed(2)}%)`);

  // ------------------------------------------------------------------
  // 10. WHAT THE SENTENCE OVER THE OPTIONS PRINTS.
  // ------------------------------------------------------------------
  console.log('\nTHE STEM — a reading quoted into the sentence is a reading an eye reads first');
  const stemBank = (howMany) => {
    const t = emptyTally('ROUTE · the four-option card', 'planted');
    for (let i = 0; i < 3000; i++) {
      const vals = [3, 5, 7, 9].map((L) => digits(L));
      const at = Math.floor(rnd() * 4);
      const opts = [vals[at], ...vals.filter((_, j2) => j2 !== at)];
      const named = howMany(opts);
      const stem = `One cadet wrote ${named[0]}. Another wrote ${named[1]}.`;
      absorb(t, readSet(opts, { stem }), null, -1, opts, `card${i}`);
    }
    return judge(t);
  };
  const keyFirst = stemBank((o) => [o[0], o[1]]);
  say(keyFirst.faults.some((f) => /FIRST reading the stem prints/.test(f)),
    'THE STEM: a sentence that always names the key FIRST is refused — the defect twelve dispute framings shipped in three locales');
  const drawnTwo = stemBank((o) => {
    const i = Math.floor(rnd() * 4);
    const j = (i + 1 + Math.floor(rnd() * 3)) % 4;
    return [o[i], o[j]];
  });
  say(drawnTwo.faults.length === 0,
    '  … and quoting TWO of the four, drawn, is clean — the key is quoted half the time and quoted first a quarter of it');
  const neverKey = stemBank((o) => [o[1], o[2]]);
  say(neverKey.faults.some((f) => /the stem prints/.test(f)),
    '  … and quoting two readings that are NEVER the key is refused too, because striking them leaves two of four');
  say(quoteAt('Cadet Iro makes it 18. Cadet Sol makes it 23.', '18') >= 0
    && quoteAt('the run was 3125 long', '12') < 0,
    '  … and "makes it 18" is a quotation of 18 while "3125" is not a quotation of 12 — the miss that found four cards in ten thousand');

  // ------------------------------------------------------------------
  // 11. THE SIZE OF THE NUMBER. Neither length nor digits can see it.
  // ------------------------------------------------------------------
  console.log('\nTHE SIZE OF THE NUMBER — the third thing an eye reads');
  say(shapeSize('-800') < shapeSize('12') && shapeLen('-800') > shapeLen('12') && shapeDigits('-800') > shapeDigits('12'),
    '`-800` is LONGER than `12` and carries MORE digits while being the smaller number — both other metrics point the wrong way');
  const sizeBad = judge(bank('ROUTE · the four-option card', 4000, 4, () => 0,
    (i) => { const b = 10 + Math.floor(rnd() * 40); return [String(b + 30), String(b), String(b + 9), String(b + 17)]; }));
  say(sizeBad.faults.some((f) => /biggest/.test(f)),
    'a key that is always the biggest number in the set is refused, at equal printed length');

  console.log('\nAND THE DEFECT THIS REWRITE EXISTS FOR: a leak on one surface may not be');
  console.log('diluted by a surface nobody is shown.');
  // The exact shape of the old gate: 26,436 choice cards leaking, 63,558 quiet
  // cards whose options are never drawn, averaged into one number.
  const leaky = bank('ROUTE · the four-option card', 26436, 4, () => (rnd() < 0.33 ? 0 : 1 + Math.floor(rnd() * 3)));
  const quiet = bank('ROUTE · never shown', 63558, 4, () => Math.floor(rnd() * 4));
  const merged = emptyTally('ROUTE · averaged', 'the old population');
  for (const t of [leaky, quiet]) {
    merged.sets += t.sets; merged.chance += t.chance;
    for (let s = 0; s < STRATEGIES.length; s++) {
      merged.strat[s].n += t.strat[s].n; merged.strat[s].sum += t.strat[s].sum;
      merged.strat[s].sq += t.strat[s].sq; merged.strat[s].decisive += t.strat[s].decisive;
    }
  }
  const lj = judge(leaky), mj = judge(merged);
  say(lj.faults.length > 0, `the choice cards alone are refused (cadet ${lj.cadet.toFixed(2)}%)`);
  say(mj.faults.length === 0, `  … and the SAME cards averaged with 63,558 unseen ones pass (cadet ${mj.cadet.toFixed(2)}%)`);
  say(lj.faults.length > 0 && mj.faults.length === 0,
    '  … so averaging is the defect, and this gate never averages two surfaces');

  console.log('\nAND THE DEFECT THAT GOT PAST THIS GATE ITSELF: a per-form leak on the route,');
  console.log('printed in full, inside a passing log.');
  const perForm = ['the four-option card: the form vm-share hands a cadet who plays "take the longest option" 62.2% against 25.0% over 412 sets'];
  say(shapeVerdict([], perForm, [], sandbox).code() === 1,
    'A ROUTE FORM OVER THE BAND FAILS THE GATE, with every surface average inside the band — the exact reading this gate exited 0 on');
  say(shapeVerdict([], [], ['a preview unit leaks'], sandbox).code() === 0,
    '  … and a preview-only finding is still advisory, so the gate does not go red for a region nobody is sent to');
  say(shapeVerdict([], [], [], sandbox).code() === 0,
    '  … and clean content is clean, which is the half that keeps the gate switched on');
  const printed = [];
  shapeVerdict([], perForm, [], (g, o) => sandbox(g, { ...o, out: (l) => printed.push(l) })).report();
  say(printed.join('\n').includes('62.2%') && printed.join('\n').includes('ROUTE:'),
    '  … and the finding is PRINTED, with the ROUTE: marker npm run check sorts by, not just counted');

  console.log('\nthe cut — the surfaces are read out of the shipped file, not remembered here');
  return { bad, say };
}

async function selfTestLive(state) {
  const { say } = state;
  let surf = null;
  try { surf = await realSurfaces(); }
  catch (e) { say(false, `src/ui/rift.js could not be cut: ${e.message}`); return state.bad + 1; }
  say(surf.anchors.length >= 10, `${surf.anchors.length} anchors found in src/ui/rift.js, at lines ${surf.anchors.map((a) => a.line).join(' ')}`);

  for (const { unit } of await allUnits()) await loadUnit(unit);
  const cases = [
    ['var-meaning', 'vm-share', 'choice'],
    ['both-sides', 'bs-special', 'choice'],
    ['like-terms', 'lt-collect', 'sort'],
    ['two-step', 'ts-symbolic', 'balance'],
    ['eval-expr', 'ee-linear', 'keypad'],
  ];
  let bad = state.bad;
  for (const [skill, form, want] of cases) {
    let got = '?';
    try {
      const it = generate(skill, 2, 12345, { locale: 'en', form, strict: true, record: false });
      got = surf.route(it, 7).name;
    } catch (e) { got = `threw: ${e.message}`; }
    if (got === want) console.log(`  · ${skill}/${form} is routed to the ${want} surface, by the shipped chain`);
    else { console.error(`SELF-TEST FAIL: ${skill}/${form} should route to ${want}, the shipped chain says ${got}`); bad++; }
  }
  // And the narrowed field really is the key and the FIRST TWO — read off the
  // shipped argument, not restated here.
  try {
    const it = generate('eval-expr', 2, 12345, { locale: 'en', form: 'ee-linear', strict: true, record: false });
    const n = surf.narrowOptions(it), c = surf.choiceOptions(it);
    if (n.length === 3 && c.length === 4 && n[0] === c[0] && n[1] === c[1] && n[2] === c[2]) {
      console.log('  · the narrowed field is the key and the first two distractors; the card is all three');
    } else { console.error(`SELF-TEST FAIL: narrowed ${n.length} / card ${c.length} — the cut no longer describes the surfaces`); bad++; }
  } catch (e) { console.error(`SELF-TEST FAIL: could not read the two option sets — ${e.message}`); bad++; }

  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('\nself-test: ok — every surface refuses its own planted leak, stays quiet on its honest twin,');
  console.log('and no surface can be talked out of a finding by another surface\'s numbers');
  return 0;
}

const isMain = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  if (has('--self-test')) await selfTestLive(selfTest());
  else process.exit(await run());
}
