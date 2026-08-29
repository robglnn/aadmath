/**
 * Figure/prose agreement gate.
 *
 * WHY THIS FILE EXISTS
 *
 * A cold critic opened a `like-terms` card and read this:
 *
 *     "A pressure hatch is 3m + 6 across and m + 15 down.
 *      The seal runs right round.
 *      Which expression gives the distance all the way round?"
 *
 * and beside it a drawing of a rectangle labelled `3m + 6` across and `m` down.
 * A cadet who trusts the drawing computes 2(3m + 6) + 2(m) = 8m + 12 and is
 * marked wrong. The accepted answer was 8m + 42, because the sentence — not the
 * picture — was what the marking used.
 *
 * The generator was innocent. It emitted `hLabel: "m + 15"`, the same string the
 * sentence carried. The drawing put that label in a 90-unit box starting at unit
 * 362 of a 396-unit viewBox, an SVG clips at its viewBox, and 72% of the ink was
 * cut off. What survived was the leading `m` — a *plausible* label, which is why
 * nobody caught it. A figure that renders as obvious garbage gets fixed in an
 * hour. A figure that renders as a different, well-formed question can ship.
 *
 * Every gate we had passed it. `validate-items` re-derived the mathematics and
 * the mathematics was right. `check-i18n` compared key sets and they matched.
 * `check-context-ask` reads situations against questions and this defect was in
 * neither — it was in the space between the item's data and the pixels.
 *
 * The same card carried two more faults of the same family:
 *   · the target expression `2(3m + 6) + 2(m + 15)` was printed in full in the
 *     statement box directly above the answer box, and the word "simplify"
 *     appeared nowhere — the question as written was answered by the display;
 *   · the footer read "Type the value that makes the statement true" while the
 *     task was to type an expression.
 *
 * So this file checks four things that nothing else checks:
 *
 *   A. AGREEMENT — every quantity a figure declares is a quantity the item's own
 *      mathematics declares, and the figure re-derives the item's own answer.
 *      A drawing may not carry a number the prose never said.
 *   B. NOT-ALREADY-ANSWERED — if the printed notation is already equivalent to
 *      the accepted answer, the question must name the rewriting as the task.
 *   C. LEGIBILITY (--render) — in a real browser, with the real `figureHtml` from
 *      `src/ui/rift.js` and the real `rift.css`, every label's ink lies inside
 *      the clip box with slack to spare. This is the one that would have caught
 *      the shipped defect, because A, B and the whole existing gate suite all
 *      passed while the picture on screen said something else.
 *   D. THE CHART (--render) — the coordinate figures, in the REAL `RiftPanel`,
 *      at every viewport `check:layout` covers and in all three locales: every
 *      numbered tick on a drawn gridline, every gridline a whole square, every
 *      reading drawn at the pixel the numerals name, and type big enough to
 *      read. A and C both passed a chart whose lines were stepped on one
 *      expression and whose numbers were stepped on another, so a cadet who
 *      counted squares from a numbered tick read the point wrong — see the
 *      long note over section D below.
 *
 *   node tools/check-figures.mjs              # A and B, every form × band × locale
 *   node tools/check-figures.mjs --render     # C and D, in a real browser
 *   node tools/check-figures.mjs --charts     # D on its own
 *   node tools/check-figures.mjs --self-test  # prove A, B, C and D can all fail
 *   node tools/check-figures.mjs --shots DIR  # the evidence, in pixels
 *   node tools/check-figures.mjs --list       # print every figure the bank makes
 */
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listenFree } from './_freeport.mjs';
import { generate, SKILLS, FORMS_BY_SKILL } from '../src/learn/generators.js';
import { equivalent, solveLinear } from '../src/learn/parser.js';
import { eq as req } from '../src/learn/rational.js';
import { allUnits, loadUnit } from './_courses.mjs';
import { ALL as VIEWPORTS } from './critic/_viewports.mjs';
import { findings } from './_findings.mjs';

/**
 * Every course the manifest ships, not just the one `generators.js` registers
 * at import. A pack draws figures through the same renderer, so a pack can
 * introduce exactly this defect and the gate has to be looking at it.
 */
export async function loadEveryCourse() {
  for (const { unit } of await allUnits()) await loadUnit(unit);
}

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCALES = ['en', 'es', 'pl'];

/**
 * Every figure kind the bank may produce, and who draws it.
 *
 * `svg` kinds go through `figureHtml` in `src/ui/rift.js` and are drawn into a
 * clipping viewBox — those are the ones `--render` measures. `modality` kinds
 * are built as ordinary flow DOM by the rig that owns them (`_area`, `_balance`,
 * `mountPlot`), which cannot clip a label the way a viewBox can.
 *
 * A kind that appears in an item and is not listed here fails the gate. That is
 * deliberate: an unlisted kind is one `figureHtml` renders as the empty string,
 * so the card would silently lose its drawing and keep its prose — the same
 * defect as a wrong label, arrived at from the other side.
 */
export const FIGURE_KINDS = {
  rect: 'svg',
  line: 'svg',
  lines: 'svg',
  area: 'modality',
  balance: 'modality',
  plot: 'modality',
};

// ---------------------------------------------------------------------------
// Asks that declare rewriting as the task.
//
// An item whose display is already equivalent to its answer is legitimate — it
// is the whole shape of "simplify this" — but only if the question says so.
// Listing the keys, rather than grepping the prose for a verb, is the point:
// three languages have three verbs, and a new ask has to be classified by a
// person rather than pattern-matched by luck.
// ---------------------------------------------------------------------------
export const REWRITE_ASKS = new Set([
  'ask.simplify', 'ask.simplifyAlt', 'ask.simplifyAlt2',
  'ask.expand', 'ask.expandAndSimplify', 'ask.multiplyOut', 'ask.takeBracketOff',
  'ask.shareOut', 'ask.whichEquivalent', 'ask.whichProduct',
  'ask.perimeterGather', 'ask.areaMultiplyOut',
  // Level 3's power-law bank. "Write this as one power" (`l3.ask.onePower`)
  // names the rewriting as the task in as many words, in all three locales —
  // `n^{2} \cdot n^{3}` shown against `n^{5}` is the shape of "simplify this",
  // not a display that answers its own question. It was simply never
  // classified, and an unclassified rewriting ask is indistinguishable here
  // from a giveaway: it was 4284 of this gate's findings, every one of them a
  // false positive on one form. Classified by hand, which is the point of the
  // list — see the note above.
  'l3.ask.onePower', 'l3.ask.oneExpression', 'l3.ask.whatIsLeft',
  'l3.ask.combinedTotal', 'l3.ask.plateArea', 'l3.ask.factoredForm',
  'l3.ask.areaOnePower', 'l3.ask.wholeOnePower', 'l3.ask.shareOnePower',
  // Level 4's factoring and dividing bank. Each of these four shows an
  // expression and marks an equivalent one, and each names the rewriting as
  // the task in as many words, in all three locales:
  //   'l4.ask.writeAsProduct'   "Write this as a product of brackets."
  //   'l4.ask.areaAsProduct'    "Write the area as its two sides."
  //   'l4.ask.writeTheQuotient' "Write the answer to this division."
  //   'l4.ask.otherSide'        "Write the other side." (the area is on top)
  // `l3.ask.whichIsRight` and `l4.ask.whichIsRight` used to be on this list.
  // They are gone from the bank: "Which answer is right?" was printed over a
  // keypad with no answers on the card, so the dispute forms now end in the
  // task their own skill asks and are classified under that ask instead.
  'l4.ask.writeAsProduct', 'l4.ask.areaAsProduct', 'l4.ask.writeTheQuotient',
  'l4.ask.otherSide',
]);

const norm = (s) => String(s ?? '').replace(/\\left|\\right/g, '').replace(/\s+/g, '');

/** The notation inside a prose stem: every `$…$` span, unwrapped. */
export function mathSpans(stem) {
  return [...String(stem || '').matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
}

/**
 * Is this notation printed somewhere the learner can actually read it?
 *
 * `exact` demands that the prose states this quantity as a quantity of its own —
 * a whole `$…$` span — rather than merely containing its characters. It matters:
 * `m` is a substring of `m + 15`, so a containment test calls the truncated
 * label "stated in the prose" and waves through the very defect this file was
 * written for. A side of a rectangle is named outright by the sentence, so it
 * gets the exact test. A strip of a distributed width is one half of a printed
 * sum and is not stated alone, so it gets containment.
 */
function isOnScreen(item, src, { exact = false } = {}) {
  const want = norm(src);
  if (!want) return false;
  const spans = mathSpans(item.stem).map(norm);
  if (exact) return spans.includes(want);
  if (norm(item.latex).includes(want)) return true;
  return spans.some((s) => s === want || s.includes(want));
}

const onLine = (m, b, x, y) => m * x + b === y;

/**
 * One item's figure, checked against the item's own mathematics.
 *
 * Every branch answers the same question in the terms of its own kind: could a
 * learner who read ONLY the drawing arrive at the answer this item marks? If
 * not, the drawing and the marking are two different questions.
 */
export function auditFigure(item) {
  const out = [];
  const fig = item.figure;
  const where = `${item.skill}/${item.form} d${item.difficulty} seed ${item.seed}`;
  if (!fig) return out;

  const drawnBy = FIGURE_KINDS[fig.kind];
  if (!drawnBy) {
    out.push(`${where}: figure kind "${fig.kind}" is not declared in FIGURE_KINDS — nothing is known to draw it`);
    return out;
  }

  const v = item.check?.variable || (String(item.answer).match(/[a-zA-Z]/) || [])[0] || 'x';
  const equiv = (a, b) => { try { return equivalent(a, b, v) === true; } catch { return false; } };

  if (fig.kind === 'rect') {
    // The two sides are the whole question. Each must be printed in the prose
    // the learner reads, and the two of them must add up — twice each — to the
    // answer that will be marked.
    for (const [slot, label] of [['wLabel', fig.wLabel], ['hLabel', fig.hLabel]]) {
      if (!label) { out.push(`${where}: rect has no ${slot}`); continue; }
      if (!isOnScreen(item, label, { exact: true })) {
        out.push(`${where}: the drawing labels a side "${label}", which the prose never states`
          + `\n      stem: ${item.stem}\n      latex: ${item.latex}`);
      }
    }
    if (fig.wLabel && fig.hLabel) {
      const round = `2\\left(${fig.wLabel}\\right) + 2\\left(${fig.hLabel}\\right)`;
      if (!equiv(round, item.answer)) {
        out.push(`${where}: a learner reading only the drawing gets ${round}`
          + `, which is not the accepted answer ${item.answer}`);
      }
    }
  }

  if (fig.kind === 'area') {
    const { k, aLabel, bLabel } = fig;
    if (!Number.isFinite(Number(k))) out.push(`${where}: area figure has no depth`);
    for (const [slot, label] of [['aLabel', aLabel], ['bLabel', bLabel]]) {
      if (!label) { out.push(`${where}: area has no ${slot}`); continue; }
      if (!isOnScreen(item, label)) {
        out.push(`${where}: the field is drawn with a strip "${label}", which the prose never states`
          + `\n      stem: ${item.stem}\n      latex: ${item.latex}`);
      }
    }
    if (aLabel && bLabel) {
      const covered = `${k}\\left(${aLabel} + \\left(${bLabel}\\right)\\right)`;
      if (!equiv(covered, item.answer)) {
        out.push(`${where}: covering the drawn field gives ${covered}, not the accepted answer ${item.answer}`);
      }
    }
  }

  if (fig.kind === 'balance') {
    const { left = {}, right = {} } = fig;
    const lv = left.coef ?? 0, lk = left.konst ?? 0, rk = right.konst ?? 0;
    const beam = `${lv === 1 ? '' : lv}${left.v || v} ${lk < 0 ? '-' : '+'} ${Math.abs(lk)} = ${rk}`;
    let sol = null;
    try { sol = solveLinear(beam, left.v || v); } catch { /* reported below */ }
    if (!sol || sol.kind !== 'unique') {
      out.push(`${where}: the beam ${beam} does not state a solvable equation`);
    } else {
      let want = null;
      try { want = solveLinear(item.latex, left.v || v); } catch { /* reported below */ }
      if (!want || want.kind !== 'unique' || !req(want.value, sol.value)) {
        out.push(`${where}: the beam reads ${beam}, but the statement reads ${item.latex}`
          + ` — the pans and the notation are two different equations`);
      }
    }
  }

  if (fig.kind === 'line' || fig.kind === 'lines' || fig.kind === 'plot') {
    const lines = fig.kind === 'lines' ? (fig.lines || [])
      : fig.kind === 'plot' ? (fig.target ? [fig.target] : [])
        : [{ m: fig.m, b: fig.b }];
    if (!lines.length) out.push(`${where}: a ${fig.kind} figure with no trace to draw`);
    for (const ln of lines) {
      if (!Number.isFinite(ln.m) || !Number.isFinite(ln.b)) {
        out.push(`${where}: a trace with no rule (m=${ln.m}, b=${ln.b})`);
      }
    }
    // Every plotted reading must sit on a trace. A dot beside the line is a
    // reading the chart denies, and reading values off the chart is the entire
    // skill these items claim to test.
    for (const [x, y] of fig.points || []) {
      if (!lines.some((ln) => onLine(ln.m, ln.b, x, y))) {
        out.push(`${where}: the chart plots (${x}, ${y}), which sits on none of its own traces`
          + ` [${lines.map((l) => `y = ${l.m}x + ${l.b}`).join(', ')}]`);
      }
    }
    if (fig.mark && !lines.some((ln) => onLine(ln.m, ln.b, fig.mark[0], fig.mark[1]))) {
      out.push(`${where}: the chart marks (${fig.mark[0]}, ${fig.mark[1]}), which is not on its traces`);
    }
    // A GOLD RULE OFF THE EDGE OF THE PAPER IS NOT A RULE.
    //
    // These items say "what does the trace read at x = 4?" and draw a dashed
    // upright there. If that upright falls outside the drawn range, the cadet is
    // asked to read a crossing that is not on the picture — the graph half of
    // exactly the defect this file is about, and the reason the range is checked
    // and not merely the arithmetic.
    const R = fig.range;
    const inRange = (n) => !Number.isFinite(R) || Math.abs(n) <= R;
    if (fig.at != null && !inRange(fig.at)) {
      out.push(`${where}: the chart rules an upright at x = ${fig.at}, outside its own range of ±${R}`);
    }
    if (fig.at != null && lines.length === 1) {
      const y = lines[0].m * fig.at + lines[0].b;
      if (!inRange(y)) {
        out.push(`${where}: at x = ${fig.at} the trace reads ${y}, off the top of a chart that only shows ±${R}`);
      }
    }
    if (fig.target != null && fig.kind !== 'plot') {
      if (!inRange(fig.target)) {
        out.push(`${where}: the chart rules a level at y = ${fig.target}, outside its own range of ±${R}`);
      }
      if (lines.length === 1) {
        const ln = lines[0];
        if (ln.m !== 0 && !Number.isInteger((fig.target - ln.b) / ln.m)) {
          out.push(`${where}: the chart rules a level at y = ${fig.target}, which its trace crosses off the lattice`);
        }
        if (ln.m !== 0 && !inRange((fig.target - ln.b) / ln.m)) {
          out.push(`${where}: the trace reaches y = ${fig.target} at x = ${(fig.target - ln.b) / ln.m},`
            + ` outside the drawn range of ±${R} — the crossing the question asks for is not on the picture`);
        }
      }
    }
    for (const [x, y] of fig.points || []) {
      if (!inRange(x) || !inRange(y)) {
        out.push(`${where}: the chart plots (${x}, ${y}), outside its own range of ±${R}`);
      }
    }
  }

  return out;
}

/**
 * Is this item answered by its own display?
 *
 * `latex` is printed in the statement box directly above the answer box. If it
 * is already equivalent to what the marking accepts, then the only honest
 * question is "rewrite this", and the ask has to say so.
 */
export function auditSelfAnswering(item, askKey) {
  const where = `${item.skill}/${item.form} d${item.difficulty} seed ${item.seed}`;
  if (item.type !== 'expression') return [];
  const v = item.check?.variable || (String(item.answer).match(/[a-zA-Z]/) || [])[0];
  if (!v) return [];
  let same = null;
  try { same = equivalent(item.latex, item.answer, v); } catch { return []; }
  if (same !== true) return [];
  if (askKey && REWRITE_ASKS.has(askKey)) return [];
  return [`${where}: the display is already an expression for what the question asks`
    + `, and the ask (${askKey || 'unclassified'}) does not name the rewriting as the task`
    + `\n      stem : ${item.stem}\n      shown: ${item.latex}\n      marks: ${item.answer}`];
}

// ---------------------------------------------------------------------------
// Which ask each figure-bearing form uses.
//
// Written down rather than scraped, for the same reason `ASK_SUBJECT` is in
// check-context-ask.mjs: the pairing is the thing being checked, so it must be
// a person's claim that the build can falsify, not a regex's guess.
// ---------------------------------------------------------------------------
export const FORM_ASK = {
  'lt-perimeter': 'ask.perimeterGather',
  'ds-area': 'ask.areaMultiplyOut',
  'lt-collect': 'ask.simplifyAlt2',
  'lt-three': 'ask.simplifyAlt2',
  'lt-four': 'ask.simplifyAlt2',
  'lt-square': 'ask.simplifyAlt2',
  'lt-equivalent': 'ask.whichEquivalent',
  'ds-expand': 'ask.expand',
  'ds-negative': 'ask.expand',
  'ds-share': 'ask.shareOut',
  'ds-twoterm': 'ask.expandAndSimplify',
  'ds-factor': 'ask.whichProduct',
  // --- Level 3, the rewriting bank -----------------------------------------
  // Every form below shows an expression and marks an equivalent one. That is
  // legitimate — it is the ordinary shape of "simplify this" — but only because
  // the ask says so, and this table is where the ask is claimed. Not one of
  // them had a row here, so `askKey` came through undefined for all of them and
  // the classification could never apply: 4284 of this gate's findings were
  // these missing rows, every one a false positive.
  //
  // Read off `src/content/packs/algebra1-l3.js` form by form, not guessed —
  // each id below is paired with the ask key that form actually passes to `T`.
  // `l3.ask.onePower`      "Write this as one power."
  // `l3.ask.oneExpression` "Write this as one expression."
  // `l3.ask.whatIsLeft`    "Write what is left as one expression."
  // `l3.ask.combinedTotal` "Write the combined total as one expression."
  // `l3.ask.plateArea`     "Write the area as one expression."
  // `l3.ask.factoredForm`  "Write this as a product."
  // All six name the rewriting as the task, in all three locales.
  'xp-two': 'l3.ask.onePower',
  'xp-coef': 'l3.ask.onePower',
  'xp-three': 'l3.ask.onePower',
  'xw-plain': 'l3.ask.onePower',
  'xw-coef': 'l3.ask.onePower',
  'xw-nested': 'l3.ask.onePower',
  'xq-plain': 'l3.ask.onePower',
  'xq-coef': 'l3.ask.onePower',
  'xq-chain': 'l3.ask.onePower',
  'xz-zero': 'l3.ask.oneExpression',
  'xz-coefzero': 'l3.ask.oneExpression',
  'xz-negative': 'l3.ask.oneExpression',
  'xz-context': 'l3.ask.oneExpression',
  'pa-add': 'l3.ask.oneExpression',
  'pa-sub': 'l3.ask.whatIsLeft',
  'pa-three': 'l3.ask.oneExpression',
  'pa-context': 'l3.ask.combinedTotal',
  'pm-mono': 'l3.ask.oneExpression',
  'pm-binomial': 'l3.ask.oneExpression',
  'pm-coef': 'l3.ask.oneExpression',
  'pm-square': 'l3.ask.oneExpression',
  'pm-context': 'l3.ask.plateArea',
  'fc-number': 'l3.ask.factoredForm',
  'fc-letter': 'l3.ask.factoredForm',
  'fc-both': 'l3.ask.factoredForm',
  'fc-three': 'l3.ask.factoredForm',
  'fc-context': 'l3.ask.factoredForm',
  // The three situation-dressed power forms. Same rewriting, said in a world:
  // "Write the area / the whole / one share as one power."
  'xp-context': 'l3.ask.areaOnePower',
  'xw-context': 'l3.ask.wholeOnePower',
  'xq-context': 'l3.ask.shareOnePower',
  // The dispute forms. The situation says two cadets disagree; the question
  // after it states the rewriting, exactly as the plain forms of the same
  // skill do. (It used to read "Which cadet is right?" over a keypad with no
  // cadets' answers anywhere on the card.)
  'xp-dispute': 'l3.ask.onePower',
  'pa-dispute': 'l3.ask.whatIsLeft',
  // --- Level 4, the factoring and dividing bank ----------------------------
  // Only the forms whose DISPLAY is a bare expression are listed. Every other
  // Level 4 form prints a named rule ("f\left(x\right) = ...") or an equation,
  // which `equivalent()` cannot read as one expression, so `auditSelfAnswering`
  // never reaches them. Read off src/content/packs/algebra1-l4.js form by form.
  'fm-plus': 'l4.ask.writeAsProduct',
  'fm-signs': 'l4.ask.writeAsProduct',
  'fm-square': 'l4.ask.writeAsProduct',
  'fm-gcf': 'l4.ask.writeAsProduct',
  'fm-area': 'l4.ask.areaAsProduct',
  'fm-dispute': 'l4.ask.writeAsProduct',
  'fl-simple': 'l4.ask.writeAsProduct',
  'fl-signs': 'l4.ask.writeAsProduct',
  'fl-square': 'l4.ask.writeAsProduct',
  'fl-both': 'l4.ask.writeAsProduct',
  'fl-area': 'l4.ask.areaAsProduct',
  'fl-dispute': 'l4.ask.writeAsProduct',
  'dq-plain': 'l4.ask.writeAsProduct',
  'dq-coef': 'l4.ask.writeAsProduct',
  'dq-gcf': 'l4.ask.writeAsProduct',
  'dq-plate': 'l4.ask.areaAsProduct',
  'pd-mono': 'l4.ask.writeTheQuotient',
  'pd-exact': 'l4.ask.writeTheQuotient',
  'pd-lead': 'l4.ask.writeTheQuotient',
  'pd-side': 'l4.ask.otherSide',
  'pd-dispute': 'l4.ask.writeTheQuotient',
};

/** The whole bank, every band, many seeds, all three locales. */
export function auditFigures({ seeds = 12, locales = LOCALES, items = null } = {}) {
  const problems = [];
  const seen = new Map();
  let checked = 0;

  const take = (item, locale) => {
    checked++;
    if (item.figure) {
      const key = `${item.skill}/${item.form}/${item.figure.kind}`;
      if (!seen.has(key)) seen.set(key, { item, locale });
      for (const p of auditFigure(item)) problems.push(`${locale}: ${p}`);
    }
    for (const p of auditSelfAnswering(item, FORM_ASK[item.form])) problems.push(`${locale}: ${p}`);
  };

  if (items) {
    for (const { item, locale } of items) take(item, locale || 'en');
    return { problems, checked, seen };
  }

  for (const skill of SKILLS) {
    for (const f of FORMS_BY_SKILL[skill] || []) {
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (let s = 0; s < seeds; s++) {
          for (const locale of locales) {
            let item;
            try {
              item = generate(skill, d, 7001 + s * 6779, { form: f.id, locale, record: false });
            } catch { continue; }
            take(item, locale);
          }
        }
      }
    }
  }
  return { problems, checked, seen };
}

/** One representative item per figure-bearing form, for the render pass. */
export function figureSamples({ seeds = 24 } = {}) {
  const out = [];
  const seen = new Set();
  for (const skill of SKILLS) {
    for (const f of FORMS_BY_SKILL[skill] || []) {
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (let s = 0; s < seeds; s++) {
          for (const locale of LOCALES) {
            let item;
            try { item = generate(skill, d, 8101 + s * 4409, { form: f.id, locale, record: false }); } catch { continue; }
            if (!item.figure || FIGURE_KINDS[item.figure.kind] !== 'svg') continue;
            // Widest labels matter most, so keep every distinct label pair
            // rather than the first one drawn.
            const key = `${f.id}/${locale}/${item.figure.wLabel || ''}|${item.figure.hLabel || ''}`
              + `|${item.figure.m ?? ''}|${item.figure.b ?? ''}|${item.figure.range ?? ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              skill, form: f.id, d, locale, seed: item.seed,
              figure: item.figure,
              expect: {
                w: item.figure.wLabel ? norm(item.figure.wLabel) : null,
                h: item.figure.hLabel ? norm(item.figure.hLabel) : null,
              },
            });
          }
        }
      }
    }
  }
  return out;
}

export { norm as normNotation };

// ---------------------------------------------------------------------------
// C. LEGIBILITY — the pixels, in a real browser.
//
// A, above, reads the item's data. The shipped defect was not in the data: the
// generator emitted the right label and the renderer cut it in half. So this
// pass renders the REAL `figureHtml` from `src/ui/rift.js`, under the REAL
// `rift.css`, through a real Vite dev server, and measures the ink.
//
// Two things are asserted of every label:
//   · its text is exactly the notation the item declared — not a prefix of it;
//   · its ink lies inside the SVG's clip box, with at least SLACK of the label
//     box to spare, so that a slightly wider draw in some future band does not
//     land straight back on the edge.
//
// The second one is what matters. `m + 15` clipped to `m` reads as a complete,
// well-formed label; no assertion about text content can see it, because the
// text is all still in the DOM. Only geometry knows.
// ---------------------------------------------------------------------------
const SLACK = 0.12;   // of the label box, on each side, that must stay unused

/**
 * A FROZEN build of a harness page, served on its own port.
 *
 * Not the dev server. Several builders hot-edit this tree at once, so Vite
 * full-reloads mid-measure and Playwright dies with "Execution context was
 * destroyed" — the house rule (BRIEF.md) is to judge frozen pixels. This builds
 * a one-line entry that re-exports the real `figureHtml` from `src/ui/rift.js`,
 * which pulls in the real `rift.css` through the real bundler, and serves the
 * result as static files. Nothing can reload underneath it.
 */
/**
 * THE HARNESS PAGE — two surfaces, one frozen build.
 *
 * `window.__figureHtml` is the real `figureHtml`, for the label pass.
 * `window.__show` mounts the real `RiftPanel` — the shipping class, its own
 * stylesheet, the two orientation sheets `src/main.js` loads last, strict
 * KaTeX, and every generator pack the manifest names — and puts one item on
 * it. The geometry pass measures THAT: the figure at the size a learner is
 * actually handed, inside the panel that decides that size. Measuring a
 * figure outside the panel would prove nothing about the complaint, which is
 * that the panel hands it 224 px.
 *
 * The pack list is the manifest and never a list kept up to date by hand: a
 * lab that registers the core bank alone sees ten skills of sixty-two and
 * prints the same word either way (`check:coverage`), and every coordinate
 * figure in this product lives in `algebra1-l2`.
 */
const HARNESS_HTML = '<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  + '<title>figure harness</title>'
  + '<style>html,body{margin:0;height:100%;background:#06070f;overflow:hidden}'
  + '#ui{position:absolute;inset:0}</style></head>'
  + '<body><div id="ui"></div><div id="stage"></div>'
  + '<script type="module" src="./harness.js"></script></body></html>';

const HARNESS_SRC = (rel) => [
  "import 'katex/dist/katex.min.css';",
  "import '" + rel('src/ui/style.css') + "';",
  "import { figureHtml, RiftPanel } from '" + rel('src/ui/rift.js') + "';",
  "import { safeGenerate } from '" + rel('src/learn/generators.js') + "';",
  "import { setLocale } from '" + rel('src/i18n/index.js') + "';",
  "import { registerPack } from '" + rel('src/content/registry.js') + "';",
  "import manifest from '" + rel('content/courses.json') + "';",
  // LAST, exactly as src/main.js loads them: the orientation sheets compose the
  // phone frame, and a harness that leaves them out photographs a desktop
  // layout at phone dimensions — the defect tools/critic/landscape.mjs exists
  // to have caught once already.
  "import '" + rel('src/ui/landscape.css') + "';",
  "import '" + rel('src/ui/portrait.css') + "';",
  "const PACKS = import.meta.glob('../../../../src/content/packs/*.js', { eager: true, import: 'default' });",
  'for (const course of manifest.courses) {',
  '  for (const unit of course.units || []) {',
  '    if (!unit.pack) continue;',
  "    const pack = PACKS['../../../../src/content/packs/' + unit.pack + '.js'];",
  "    if (!pack) throw new Error('the manifest names a generator pack that is not there: ' + unit.pack);",
  '    registerPack(pack);',
  '  }',
  '}',
  'window.__figureHtml = figureHtml;',
  "const panel = new RiftPanel(document.getElementById('ui'));",
  'window.__panel = panel;',
  'window.__show = (spec) => {',
  "  setLocale(spec.locale || 'en');",
  '  const item = safeGenerate(spec.skill, spec.d, spec.seed, { locale: spec.locale, form: spec.form, record: false });',
  '  panel.show(item, {',
  "    title: '', skillId: item.skill, tier: 0, kind: 'learn',",
  "    scaffold: 'none', example: null, streak: 0,",
  '    onAnswer() { return { gained: 1, pL: 1, prev: 0.5 }; },',
  '    onClose() {},',
  '  });',
  '  return { form: item.form, mode: panel.mode, figure: item.figure };',
  '};',
  'window.__ready = true;',
].join('\n') + '\n';

export async function serveFrozen() {
  const { build } = await import('vite');
  const { mkdtemp, writeFile, rm, readFile } = await import('node:fs/promises');
  const { createServer } = await import('node:http');
  const os = await import('node:os');

  const stage = path.join(ROOT, 'tools/critic/tmp/.figharness');
  await rm(stage, { recursive: true, force: true });
  await (await import('node:fs/promises')).mkdir(stage, { recursive: true });
  // The entry lives inside the repo so it resolves `src/ui/rift.js` and its CSS
  // exactly as the game does.
  const srcRel = (f) => path.relative(stage, path.join(ROOT, f)).replace(/\\/g, '/');
  await writeFile(path.join(stage, 'harness.js'), HARNESS_SRC(srcRel));
  await writeFile(path.join(stage, 'index.html'), HARNESS_HTML);

  const out = await mkdtemp(path.join(os.tmpdir(), 'ascent-fig-'));
  await build({
    root: ROOT,
    base: './',
    logLevel: 'error',
    build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false,
      rollupOptions: { input: path.join(stage, 'index.html') } },
  });

  // The built html lands under the entry's path relative to root.
  const rel = path.relative(ROOT, path.join(stage, 'index.html'));
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
  const server = createServer(async (req, res) => {
    const p = path.join(out, decodeURIComponent(req.url.split('?')[0]));
    try {
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('no'); }
  });
  // Port 0, not a random one in a range: see tools/_freeport.mjs.
  const port = await listenFree(server);
  return {
    base: `http://127.0.0.1:${port}/${rel.split(path.sep).join('/')}`,
    stop: async () => { server.close(); await rm(out, { recursive: true, force: true }); await rm(stage, { recursive: true, force: true }); },
  };
}

/**
 * Measure every label of every figure the bank can draw.
 *
 * `samples` may be overridden so the self-test can push a known-bad geometry
 * through the identical measuring code.
 */
export async function auditRendered({ samples = null, geometry = null } = {}) {
  const { chromium } = await import('playwright');
  const list = samples || figureSamples();
  const server = await serveFrozen();
  const browser = await chromium.launch();
  const problems = [];
  let measured = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(server.base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });

    const results = await page.evaluate(async ({ list, geometry, SLACK }) => {
      const real = window.__figureHtml;
      // The self-test swaps in a past geometry and measures it with this same
      // code, so a claim that the gate "would have caught it" is demonstrated
      // rather than asserted. `texFirst` is handed in because the replaced body
      // is `rectSvg`'s, which closes over it in the real module.
      const probe = document.createElement('div');
      probe.innerHTML = real({ kind: 'rect', wLabel: 'x', hLabel: 'x' });
      const tex = (srcs) => { const d = document.createElement('div'); d.innerHTML = real({ kind: 'rect', wLabel: srcs[0], hLabel: srcs[0] }); return d.querySelector('.figlabel').innerHTML; };
      const figureHtml = geometry ? new Function('texFirst', 'fig', geometry) : null;
      const host = document.createElement('div');
      // The figure's real home: the same box, the same width constraints.
      host.className = 'rift';
      host.style.cssText = 'position:fixed;left:0;top:0;width:520px;z-index:99999;opacity:1;';
      host.innerHTML = '<div class="rf-figbox"></div>';
      document.body.appendChild(host);
      const box = host.querySelector('.rf-figbox');
      const out = [];
      for (const s of list) {
        box.innerHTML = figureHtml ? figureHtml(tex, s.figure) : real(s.figure);
        const svg = box.querySelector('svg');
        if (!svg) { out.push({ ...s, fatal: 'figureHtml drew nothing' }); continue; }
        const sb = svg.getBoundingClientRect();
        const labels = [];
        for (const el of box.querySelectorAll('.figlabel')) {
          // KaTeX emits the same maths twice — a visually-hidden MathML copy for
          // screen readers and the HTML copy that is actually drawn. Only the
          // drawn one has a size, and only the drawn one is what a cadet reads.
          const ink = el.querySelector('.katex-html') || el.querySelector('.katex') || el;
          const r = ink.getBoundingClientRect();
          const hostR = el.getBoundingClientRect();
          labels.push({
            slot: el.dataset.fig || '?',
            text: ink.textContent.replace(/\s+/g, ''),
            // How much of the label's ink is inside the clip box, 0..1.
            visible: r.width > 0
              ? Math.max(0, Math.min(r.right, sb.right) - Math.max(r.left, sb.left)) / r.width
              : 0,
            // How much of its own box the ink leaves unused on the tighter side.
            slack: hostR.width > 0
              ? Math.min(r.left - hostR.left, hostR.right - r.right) / hostR.width
              : -1,
            rightOverflow: +(r.right - sb.right).toFixed(1),
          });
        }
        // Axis numerals and the like are plain SVG <text>; they clip too.
        const texts = [];
        for (const el of svg.querySelectorAll('text')) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          texts.push({
            text: el.textContent,
            inside: r.left >= sb.left - 0.5 && r.right <= sb.right + 0.5
              && r.top >= sb.top - 0.5 && r.bottom <= sb.bottom + 0.5,
          });
        }
        out.push({ ...s, labels, texts });
      }
      host.remove();
      return out;
    }, { list, geometry, SLACK });

    for (const r of results) {
      const where = `${r.locale}: ${r.skill}/${r.form} d${r.d} seed ${r.seed} (${r.figure.kind})`;
      measured++;
      if (r.fatal) { problems.push(`${where}: ${r.fatal}`); continue; }
      for (const L of r.labels) {
        const want = L.slot === 'w' ? r.expect.w : L.slot === 'h' ? r.expect.h : null;
        if (want && L.text !== want) {
          problems.push(`${where}: the ${L.slot} label renders as "${L.text}" but the item declares "${want}"`);
        }
        if (L.visible < 0.999) {
          problems.push(`${where}: the ${L.slot} label "${L.text}" is CLIPPED — only ${(L.visible * 100).toFixed(0)}%`
            + ` of its ink is inside the drawing (${L.rightOverflow}px past the edge).`
            + ` A cadet reads a different side length than the prose states.`);
        } else if (L.slack < SLACK) {
          problems.push(`${where}: the ${L.slot} label "${L.text}" fills its box to within`
            + ` ${(L.slack * 100).toFixed(1)}% (need ${(SLACK * 100).toFixed(0)}%) — one wider band clips it`);
        }
      }
      for (const T of r.texts) {
        if (!T.inside) problems.push(`${where}: the scale numeral "${T.text}" falls outside the drawing`);
      }
    }
    if (errors.length) problems.push(`console errors while drawing figures: ${errors.slice(0, 3).join(' | ')}`);
  } finally {
    await browser.close();
    // Awaited: the teardown deletes the staged entry, and a second pass (the
    // self-test runs two) must not start building while it is being removed.
    await server.stop();
  }
  return { problems, measured, total: list.length };
}

// ---------------------------------------------------------------------------
// D. THE CHART — does the picture say what the axes say, at a size that can
//    be read?
//
// A and C ask whether a LABEL says what the item says. This asks the question
// one layer down, of every coordinate figure: is the drawing the cadet counts
// squares on the drawing the numerals describe? Two faults were live at once,
// and neither is visible to any check that reads an item's data.
//
//   · THE NUMBERS WERE NOT ON THE LINES. The gridlines were stepped on
//     `round(R/5)` and the numerals on `round(R/3)` — two expressions computed
//     apart from one another, in two files. Over the 36 (kind, range) pairs the
//     bank draws, 30 had at least one numeral off every gridline, and at the
//     commonest range of all — ±10, the default — NOT ONE of the six numerals
//     sat on a line. At ±9 the lattice was not even anchored on the origin: the
//     axes crossed at zero and the nearest gridlines stood at ±1, so counting
//     squares out from the origin was wrong for every reading on the chart.
//     A cadet who trusts the picture reads the point wrong and is marked wrong
//     for it. That is a figure that teaches a wrong answer.
//   · IT WAS TOO SMALL TO READ. The coordinate surface that carries the whole
//     question was handed 224x224 CSS px inside a 1600x900 window, with 9 px
//     numerals — smaller than the keys used to answer it. The mathematics was
//     the smallest thing on the screen.
//
// `src/learn/generators.js` already carries the rule this pass enforces for
// figures: *the mathematics we check must be the mathematics we display.* It
// was enforced for notation and not for drawings.
//
// So this drives the REAL `RiftPanel` at every viewport `check:layout` covers,
// in all three locales, and measures the drawing off the DOM. Nothing here
// re-derives a pixel from the renderer's own formula — that would only check
// the code against itself. Every rule compares two things the page produced
// independently of each other:
//
//   D1 ON-GRID    every numbered tick's pixel is some gridline's pixel.
//   D2 LINEAR     the numerals are one consistent scale: fit the axis map from
//                 the numerals alone and every numeral must lie on that fit.
//   D3 ORIGIN     the drawn axis stands where the numerals say zero is.
//   D4 LATTICE    the gridlines are evenly spaced, and one gap is a whole
//                 number of chart units under that same fit.
//   D5 PLACED     every reading the item declares at (a, b) is drawn at the
//                 pixel the NUMERALS say (a, b) is — not at the pixel the
//                 renderer believes it is.
//   D6 LEGIBLE    a grid square is big enough to count, and the numerals are
//                 not the smallest type in the panel.
//   D7 PRINCIPAL  a figure the cadet must ACT on to answer — the coordinate
//                 surface — is not drawn smaller than the controls under it.
//                 (A figure that is only read has to be legible, D6; a figure
//                 that is the instrument has to be reachable.)
// ---------------------------------------------------------------------------

/** The figure kinds that are drawn on numbered axes. */
export const CHART_KINDS = new Set(['plot', 'line', 'lines']);

/**
 * A grid square smaller than this cannot be counted: one CSS px of stroke and
 * under three of gap is a wash on the 1x panel of a school Chromebook, and
 * counting squares is how a cadet reads a point off a chart.
 *
 * Four and not a taste. Measured on this tree, at the tightest place the panel
 * ever puts a chart — 844x390, where the drawing gets 179 CSS px — a unit
 * lattice holds down to ±16 (4.6 px a square) and the next range up is 4.35.
 * `chartLattice` in src/learn/plot.js coarsens at exactly that point, so the
 * threshold and the renderer meet in a measured gap rather than a guess, and
 * the honest charts either side of it are all clear of it.
 */
export const MIN_SQUARE_PX = 4;

/**
 * Pixel tolerances. Sub-pixel on purpose: every rule here compares two
 * renderings of ONE number — where the line went and where the number went —
 * so anything past half a pixel is a disagreement, not a rounding.
 */
const ON_GRID_PX = 0.75;
const PLACED_PX = 1.25;

/**
 * One sample per (form, drawn range), or per (kind, drawn range).
 *
 * The range is what decides the lattice, and the form is what decides the
 * readings drawn on it. The two sweeps below want different halves of that:
 * the rules about the LATTICE and the READINGS need every form; the rules
 * about SIZE need every viewport and every locale, and do not care which form
 * drew the chart. Sweeping the product of all four would be five minutes of
 * build to say the same thing three times over.
 */
export function geometrySamples({ seeds = 60, key = 'form' } = {}) {
  const out = [];
  const seen = new Set();
  for (const skill of SKILLS) {
    for (const f of FORMS_BY_SKILL[skill] || []) {
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (let s = 0; s < seeds; s++) {
          let item;
          try { item = generate(skill, d, 8101 + s * 4409, { form: f.id, locale: 'en', record: false }); } catch { continue; }
          const fig = item.figure;
          if (!fig || !CHART_KINDS.has(fig.kind)) continue;
          const range = Math.max(4, Math.round(fig.range || 10));
          const id = key === 'kind' ? `${fig.kind}/${range}` : `${f.id}/${range}`;
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({ skill, form: f.id, d, seed: item.seed, kind: fig.kind, range });
        }
      }
    }
  }
  return out;
}

/**
 * Read one chart off the page.
 *
 * Injected whole, so the numbers come out of the same layout the cadet is
 * looking at. It measures and reports; it decides nothing — every rule is
 * applied in node, where it can be read next to the reason it exists.
 */
const MEASURE_CHART = async ({ specs, badGrid }) => {
  const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const out = [];
  for (const spec of specs) {
    let shown;
    try { shown = window.__show(spec); } catch (e) { out.push({ spec, fatal: String(e && e.message || e) }); continue; }
    // The panel re-cuts itself on a rAF, and the fit pass bisects. Two frames,
    // a macrotask, then two more: measuring mid-bisect reads a size no cadet
    // is ever shown.
    await settle();
    await new Promise((r) => setTimeout(r, 0));
    await settle();
    const panel = window.__panel;
    let svg = panel.el.querySelector('.rf-plot-stage svg, .rf-fig.grid svg');
    if (!svg) { out.push({ spec, fatal: 'the panel drew no chart for a chart-bearing item' }); continue; }
    // The self-test plants a chart whose numerals step differently from its
    // lines, in the same panel, measured by this same code — so "the gate
    // would have caught it" is a demonstration and not a claim.
    if (badGrid) {
      const g = svg.querySelector('g') || svg;
      // eslint-disable-next-line no-new-func
      new Function('svg', 'g', badGrid)(svg, g);
    }
    const vb = svg.viewBox.baseVal;
    const box = svg.getBoundingClientRect();
    const scale = vb && vb.width ? box.width / vb.width : 1;

    const lines = [...svg.querySelectorAll('path.gl')].map((el) => rectOf(el));
    const vGrid = lines.filter((r) => r.h > r.w).map((r) => +(r.x + r.w / 2).toFixed(3)).sort((a, b) => a - b);
    const hGrid = lines.filter((r) => r.w > r.h).map((r) => +(r.y + r.h / 2).toFixed(3)).sort((a, b) => a - b);
    const axes = [...svg.querySelectorAll('path.ax')].map((el) => rectOf(el));
    const axV = axes.filter((r) => r.h > r.w).map((r) => +(r.x + r.w / 2).toFixed(3));
    const axH = axes.filter((r) => r.w > r.h).map((r) => +(r.y + r.h / 2).toFixed(3));

    const numeral = (el) => {
      const r = rectOf(el);
      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      return {
        v: Number(el.textContent.trim()),
        raw: el.textContent.trim(),
        axis: el.dataset.axis,
        cx: +(r.x + r.w / 2).toFixed(3), cy: +(r.y + r.h / 2).toFixed(3),
        x0: +r.x.toFixed(3), x1: +(r.x + r.w).toFixed(3),
        y0: +r.y.toFixed(3), y1: +(r.y + r.h).toFixed(3),
        w: +r.w.toFixed(2), h: +r.h.toFixed(2),
        fontPx: +(fs * scale).toFixed(2),
      };
    };
    const nums = [...svg.querySelectorAll('text[data-axis]')].map(numeral);

    const readings = [...svg.querySelectorAll('circle.anchor, circle.pt, circle.mk')].map((el) => {
      const r = rectOf(el);
      return { cx: +(r.x + r.w / 2).toFixed(3), cy: +(r.y + r.h / 2).toFixed(3), cls: el.getAttribute('class') };
    });

    // The type the cadet reads everywhere else in this panel. The numerals may
    // not be the smallest of it.
    let minType = Infinity;
    let minTypeWhere = '';
    for (const sel of ['.rf-ask', '.rf-help', '.rf-key', '.rf-reading', '.rf-plot-read', '.rf-socket']) {
      for (const el of panel.el.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
        if (fs > 0 && fs < minType) { minType = fs; minTypeWhere = sel; }
      }
    }

    // The answer surface: the controls that end the turn.
    let answerW = 0;
    let answerWhere = '';
    for (const sel of ['.rf-pad', '.rf-keys', '.rf-readings', '.rf-narrow', '.rf-bays', '.rf-plot-bar']) {
      for (const el of panel.el.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width > answerW) { answerW = r.width; answerWhere = sel; }
      }
    }

    out.push({
      spec, mode: shown.mode, figure: shown.figure,
      svg: { w: +box.width.toFixed(1), h: +box.height.toFixed(1) },
      vGrid, hGrid, axV, axH, nums, readings,
      minType: minType === Infinity ? null : +minType.toFixed(2), minTypeWhere,
      answerW: +answerW.toFixed(1), answerWhere,
    });
  }
  return out;
};

/**
 * Fit an axis map from the numerals ALONE.
 *
 * Least squares over (value, pixel). The renderer's own X()/Y() are never
 * consulted: the whole point is that the picture is checked against the
 * numbering, by somebody who was not told how either was computed.
 */
function fitAxis(pts) {
  const n = pts.length;
  if (n < 2) return null;
  const sv = pts.reduce((a, p) => a + p.v, 0);
  const sp = pts.reduce((a, p) => a + p.p, 0);
  const svv = pts.reduce((a, p) => a + p.v * p.v, 0);
  const svp = pts.reduce((a, p) => a + p.v * p.p, 0);
  const den = n * svv - sv * sv;
  if (!den) return null;
  const k = (n * svp - sv * sp) / den;
  const c = (sp - k * sv) / n;
  const resid = Math.max(...pts.map((p) => Math.abs(k * p.v + c - p.p)));
  return { k, c, resid, at: (v) => k * v + c };
}

/** Every rule, over one measured chart. */
export function auditChart(m) {
  const out = [];
  const s = m.spec;
  const where = `${s.skill}/${s.form} d${s.d} seed ${s.seed} (${s.kind} ±${s.range})`;
  if (m.fatal) return [`${where}: ${m.fatal}`];

  const fig = m.figure || {};
  const xs = m.nums.filter((t) => t.axis === 'x');
  const ys = m.nums.filter((t) => t.axis === 'y');

  // A chart with no numbers on it is a decoration, and a numeral that does not
  // say which axis it belongs to cannot be checked against one.
  if (m.nums.some((t) => !Number.isFinite(t.v))) {
    out.push(`${where}: a numeral on the axes reads "${m.nums.find((t) => !Number.isFinite(t.v)).raw}", which is not a number`);
  }
  if (xs.length < 2 || ys.length < 2) {
    out.push(`${where}: the chart carries ${xs.length} numeral(s) on x and ${ys.length} on y`
      + ' — a trace nobody can read a value off is a decoration');
    return out;
  }
  // The renderer DECLARES which axis each numeral is on; the declaration is
  // checked against the geometry rather than believed.
  // A row of numerals is a row because their boxes share a band, not because
  // their centres agree: the y numerals are right-aligned, so "-8" and "8"
  // have different centres and the same edge.
  const band = (list, a, b) => Math.max(...list.map((t) => t[a])) <= Math.min(...list.map((t) => t[b])) + 1;
  if (!band(xs, 'y0', 'y1')) out.push(`${where}: the numerals declared as the x scale do not sit in one band`);
  if (!band(ys, 'x0', 'x1')) out.push(`${where}: the numerals declared as the y scale do not sit in one band`);

  // D2 LINEAR
  const fx = fitAxis(xs.map((t) => ({ v: t.v, p: t.cx })));
  const fy = fitAxis(ys.map((t) => ({ v: t.v, p: t.cy })));
  if (!fx || !fy) { out.push(`${where}: the numerals do not describe a scale`); return out; }
  for (const [name, f, list] of [['x', fx, xs], ['y', fy, ys]]) {
    if (f.resid > 0.75) {
      const worst = list.map((t) => ({ t, e: Math.abs(f.at(t.v) - (name === 'x' ? t.cx : t.cy)) }))
        .sort((a, b) => b.e - a.e)[0];
      out.push(`${where}: the ${name} numerals are not one scale — "${worst.t.raw}" is ${worst.e.toFixed(2)}px`
        + ' from where the rest of them put it');
    }
  }

  // D1 ON-GRID — the rule this pass exists for.
  const near = (p, list) => list.reduce((best, g) => Math.min(best, Math.abs(g - p)), Infinity);
  for (const [name, list, grid, key] of [['x', xs, m.vGrid, 'cx'], ['y', ys, m.hGrid, 'cy']]) {
    if (!grid.length) { out.push(`${where}: the ${name} axis is numbered but no gridlines are drawn across it`); continue; }
    const off = list.filter((t) => near(t[key], grid) > ON_GRID_PX);
    if (off.length) {
      out.push(`${where}: ${off.length} of ${list.length} numbered ticks on ${name} DO NOT SIT ON A GRIDLINE`
        + ` — ${off.slice(0, 6).map((t) => `${t.raw} is ${near(t[key], grid).toFixed(1)}px off the nearest line`).join(', ')}.`
        + ' A cadet counting squares from a numbered tick reads the chart wrong.');
    }
  }

  // D4 LATTICE — evenly spaced, and one gap is a whole number of chart units.
  for (const [name, grid, f] of [['x', m.vGrid, fx], ['y', m.hGrid, fy]]) {
    if (grid.length < 3) continue;
    const gaps = grid.slice(1).map((g, i) => g - grid[i]);
    const lo = Math.min(...gaps), hi = Math.max(...gaps);
    if (hi - lo > 0.75) {
      out.push(`${where}: the ${name} gridlines are not evenly spaced (${lo.toFixed(1)}px to ${hi.toFixed(1)}px)`);
      continue;
    }
    const units = Math.abs(((lo + hi) / 2) / f.k);
    if (Math.abs(units - Math.round(units)) > 0.02) {
      out.push(`${where}: one ${name} grid square is ${units.toFixed(3)} chart units — not a whole number,`
        + ' so no count of squares is a count of anything');
    }
  }

  // D3 ORIGIN — the drawn axis stands where the numerals put zero.
  if (m.axV.length !== 1 || m.axH.length !== 1) {
    out.push(`${where}: the chart draws ${m.axV.length} upright axis line(s) and ${m.axH.length} level one(s)`);
  } else {
    const dx = Math.abs(m.axV[0] - fx.at(0));
    const dy = Math.abs(m.axH[0] - fy.at(0));
    if (dx > ON_GRID_PX) out.push(`${where}: the y axis is drawn ${dx.toFixed(2)}px from where the x numerals put zero`);
    if (dy > ON_GRID_PX) out.push(`${where}: the x axis is drawn ${dy.toFixed(2)}px from where the y numerals put zero`);
    if (near(m.axV[0], m.vGrid) > ON_GRID_PX) out.push(`${where}: the origin is not on the lattice — the y axis stands ${near(m.axV[0], m.vGrid).toFixed(1)}px off the nearest gridline`);
    if (near(m.axH[0], m.hGrid) > ON_GRID_PX) out.push(`${where}: the origin is not on the lattice — the x axis stands ${near(m.axH[0], m.hGrid).toFixed(1)}px off the nearest gridline`);
  }

  // D5 PLACED — the readings the ITEM declares, at the pixel the NUMERALS name.
  const R = s.range;
  const declared = [];
  for (const p of fig.points || []) if (Math.abs(p[0]) <= R && Math.abs(p[1]) <= R) declared.push(p);
  if (fig.showMark && fig.mark) declared.push(fig.mark);
  for (const [a, b] of declared) {
    const px = fx.at(a), py = fy.at(b);
    const hit = m.readings.some((c) => Math.hypot(c.cx - px, c.cy - py) <= PLACED_PX);
    if (!hit) {
      const closest = m.readings.map((c) => Math.hypot(c.cx - px, c.cy - py)).sort((x, y) => x - y)[0];
      out.push(`${where}: the item plots (${a}, ${b}) and the axes put that at (${px.toFixed(1)}, ${py.toFixed(1)}),`
        + ` where nothing is drawn (nearest reading ${Number.isFinite(closest) ? closest.toFixed(1) + 'px away' : 'none on the chart'}).`
        + ' The dot and the numbers are two different claims.');
    }
  }
  if (m.readings.length !== declared.length) {
    out.push(`${where}: the item declares ${declared.length} reading(s) inside the window and the chart draws ${m.readings.length}`);
  }

  // D6 LEGIBLE
  const square = Math.min(
    m.vGrid.length > 1 ? m.vGrid[1] - m.vGrid[0] : Infinity,
    m.hGrid.length > 1 ? m.hGrid[1] - m.hGrid[0] : Infinity,
  );
  if (Number.isFinite(square) && square < MIN_SQUARE_PX) {
    out.push(`${where}: a grid square is ${square.toFixed(2)} CSS px (need ${MIN_SQUARE_PX})`
      + ` in a ${m.svg.w}x${m.svg.h} drawing — the squares merge, so they cannot be counted`);
  }
  const tick = Math.min(...m.nums.map((t) => t.fontPx));
  if (m.minType != null && tick < m.minType - 0.25) {
    out.push(`${where}: the axis numerals are set at ${tick.toFixed(1)}px against ${m.minType.toFixed(1)}px`
      + ` on ${m.minTypeWhere} — the mathematics is the smallest type in the panel`);
  }

  // D7 PRINCIPAL — the figure the cadet ACTS on.
  if (m.mode === 'plot' && m.answerW > 0 && m.svg.w < m.answerW - 1) {
    out.push(`${where}: the coordinate surface is ${m.svg.w}px wide and the controls under it (${m.answerWhere})`
      + ` are ${m.answerW}px — the instrument the cadet has to act on is smaller than the button that ends the turn`);
  }

  return out;
}

/**
 * Drive the real panel over the whole capture matrix.
 *
 * Every viewport `check:layout` covers, every locale, because the panel's fit
 * pass decides the figure's size from how much room the SENTENCE left it —
 * and the Polish sentence is the long one.
 */
export async function auditCharts({ passes = null } = {}) {
  const { chromium } = await import('playwright');
  const runs = passes || DEFAULT_PASSES();
  const server = await serveFrozen();
  const browser = await chromium.launch();
  const problems = [];
  const found = new Map(runs.map((r) => [r, []]));
  let measured = 0;
  try {
    const page = await browser.newPage({ viewport: { width: VIEWPORTS[0].w, height: VIEWPORTS[0].h } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(server.base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    for (const run of runs) {
      for (const vp of run.viewports) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        // The panel re-cuts itself off a `resize`, on a frame. Measuring before
        // that lands photographs the LAST viewport's layout at this one's size.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        for (const locale of run.locales) {
          const specs = run.specs.map((x) => ({ ...x, locale }));
          const got = await page.evaluate(MEASURE_CHART, { specs, badGrid: run.badGrid || null });
          for (const m of got) {
            measured++;
            for (const p of auditChart(m)) {
              const line = `${vp.name} ${locale}: ${p}`;
              problems.push(line);
              found.get(run).push(line);
            }
          }
        }
      }
    }
    if (errors.length) problems.push(`console errors while drawing charts: ${errors.slice(0, 3).join(' | ')}`);
  } finally {
    await browser.close();
    await server.stop();
  }
  return { problems, measured, passes: runs, byPass: runs.map((r) => ({ ...r, problems: found.get(r) })) };
}

/**
 * The two sweeps, and why they are two.
 *
 *  · WIDE — one chart per (kind, range) over every viewport `check:layout`
 *    covers and all three locales. This is the pass the SIZE rules need: the
 *    panel's fit decides the drawing's size out of the room the SENTENCE left
 *    it, and the Polish sentence is the long one.
 *  · DEEP — every form the bank can draw a chart with, at the reference
 *    laptop, in all three locales. This is the pass the LATTICE and READING
 *    rules need: they turn on which form drew the chart, not on the window.
 *
 * Every rule runs on every measurement in both. The split is only about which
 * axis each is swept along, because the product of all four is five minutes of
 * browser to say the same thing three times.
 */
export function DEFAULT_PASSES() {
  const laptop = VIEWPORTS.find((v) => v.name === '1600x900') || VIEWPORTS[0];
  return [
    { name: 'wide', specs: geometrySamples({ key: 'kind' }), viewports: VIEWPORTS, locales: LOCALES },
    { name: 'deep', specs: geometrySamples(), viewports: [laptop], locales: LOCALES },
  ];
}

/**
 * The evidence, in pixels: one coordinate item on the real panel, photographed
 * at the sizes a cadet holds. Same harness, same build, same item and seed
 * before and after, so the two frames differ only by the code under test.
 *
 *   node tools/check-figures.mjs --shots shots/figures-before
 */
export async function shootCharts(outDir, { specs = null, viewports = null, locales = ['en'] } = {}) {
  const { chromium } = await import('playwright');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const list = specs || geometrySamples().filter((x) => x.kind === 'plot' && x.range === 10).slice(0, 1)
    .concat(geometrySamples().filter((x) => x.kind === 'line' && x.range === 10).slice(0, 1));
  const vps = viewports || [
    { name: '1600x900', w: 1600, h: 900 },
    { name: '390x844', w: 390, h: 844 },
  ];
  await mkdir(outDir, { recursive: true });
  const server = await serveFrozen();
  const browser = await chromium.launch();
  const shot = [];
  try {
    const page = await browser.newPage({ viewport: { width: vps[0].w, height: vps[0].h } });
    await page.goto(server.base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    for (const vp of vps) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      // The panel re-cuts itself off a `resize`, on a frame — photograph before
      // that lands and the frame is the last viewport's composition at this
      // one's size.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      for (const locale of locales) {
        for (const spec of list) {
          const size = await page.evaluate(async (sp) => {
            window.__show(sp);
            const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await settle(); await new Promise((r) => setTimeout(r, 0)); await settle();
            const svg = window.__panel.el.querySelector('.rf-plot-stage svg, .rf-fig.grid svg');
            const r = svg ? svg.getBoundingClientRect() : null;
            return r ? { w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null;
          }, { ...spec, locale });
          const name = `${spec.form}-r${spec.range}-${vp.name}-${locale}.png`;
          await page.screenshot({ path: path.join(outDir, name) });
          shot.push({ name, size });
        }
      }
    }
    await writeFile(path.join(outDir, 'sizes.json'), JSON.stringify(shot, null, 2));
  } finally {
    await browser.close();
    await server.stop();
  }
  return shot;
}

// ---------------------------------------------------------------------------
// Prove the gate can fail.
// ---------------------------------------------------------------------------

/** A. plant a drawing that contradicts its own prose. */
function selfTestAgreement() {
  const item = generate('like-terms', 4, 4242, { form: 'lt-perimeter', locale: 'en', record: false });
  const clean = auditFigure(item);
  // Exactly the shipped defect, in data form: the drawing keeps the leading
  // term of the side and drops the constant, the way the clip did.
  const cut = { ...item, figure: { ...item.figure, hLabel: item.figure.hLabel.split(' ')[0] } };
  const caught = auditFigure(cut);
  // …and the mirror image: a side the prose never mentions at all.
  const invented = { ...item, figure: { ...item.figure, wLabel: '9z + 1' } };
  const caught2 = auditFigure(invented);

  // The same defect on a chart: a dot drawn beside its own trace, and a gold
  // rule at a level the drawn window never shows.
  const gitem = generate('two-step', 3, 4242, { form: 'ts-graph', locale: 'en', record: false });
  const gclean = auditFigure(gitem);
  const offLine = { ...gitem, figure: { ...gitem.figure, points: [[gitem.figure.points[0][0], gitem.figure.points[0][1] + 1]] } };
  const caught3 = auditFigure(offLine);
  const offPaper = { ...gitem, figure: { ...gitem.figure, target: gitem.figure.range * 4 } };
  const caught4 = auditFigure(offPaper);

  const ok = clean.length === 0 && caught.length > 0 && caught2.length > 0
    && gclean.length === 0 && caught3.length > 0 && caught4.length > 0;
  console.log(`  A agreement: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`     clean item (${item.figure.wLabel} × ${item.figure.hLabel}): ${clean.length} problem(s)`);
  console.log(`     height label truncated to "${cut.figure.hLabel}": ${caught.length} problem(s)`);
  for (const p of caught) console.log('       · ' + p.split('\n')[0]);
  console.log(`     width label replaced with "9z + 1": ${caught2.length} problem(s)`);
  for (const p of caught2) console.log('       · ' + p.split('\n')[0]);
  console.log(`     clean chart (y = ${gitem.figure.m}x + ${gitem.figure.b}): ${gclean.length} problem(s)`);
  console.log(`     one plotted reading nudged off its trace: ${caught3.length} problem(s)`);
  for (const p of caught3) console.log('       · ' + p.split('\n')[0]);
  console.log(`     the gold rule moved off the drawn window: ${caught4.length} problem(s)`);
  for (const p of caught4) console.log('       · ' + p.split('\n')[0]);
  return ok;
}

/**
 * B. plant a question that its own display answers.
 *
 * The fixture used to be a live `lt-perimeter` item, whose display was the four
 * sides already written out — a real self-answering display, kept honest only
 * by an ask that named the rewriting. That item has since had its display taken
 * away entirely (it was handing the learner the whole assembly; see
 * `lt-perimeter` in src/learn/generators.js), and with no display there is
 * nothing for this branch to catch. A self-test whose fixture has stopped being
 * an example of the defect passes by accident, which is worse than failing.
 *
 * So the fixture is now BUILT here rather than drawn from the bank: a display
 * and an answer that are the same expression written two ways. It cannot go
 * stale when the bank changes, and it is unambiguously the thing the branch is
 * for.
 */
function selfTestSelfAnswering() {
  const item = {
    skill: 'like-terms', form: 'self-test', difficulty: 4, seed: 4242, type: 'expression',
    latex: '\\left(7x + 1\\right) + \\left(5x + 11\\right) + \\left(7x + 1\\right) + \\left(5x + 11\\right)',
    answer: '24x + 24',
    stem: 'Which expression gives the distance all the way round?',
    check: { kind: 'equivalent', variable: 'x' },
  };
  // Named as rewriting: legitimate, and must not be flagged.
  const clean = auditSelfAnswering(item, 'ask.perimeterGather');
  // The ask as it shipped: names the quantity, never names the work.
  const shipped = auditSelfAnswering(item, 'ask.perimeterExpr');
  // …and an item with no display at all cannot be self-answering.
  const none = auditSelfAnswering({ ...item, latex: null, noDisplay: true }, 'ask.perimeterExpr');
  const ok = clean.length === 0 && shipped.length > 0 && none.length === 0;
  console.log(`  B not-already-answered: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`     a rewriting ask over its own display: ${clean.length} problem(s)`);
  console.log(`     the same display under ask.perimeterExpr: ${shipped.length} problem(s)`);
  console.log(`     the same item with no display at all: ${none.length} problem(s)`);
  for (const p of shipped) console.log('       · ' + p.split('\n')[0]);
  return ok;
}

/**
 * C. put the shipped geometry back and prove the browser pass rejects it.
 *
 * This is the important one. The body below is `rectSvg` exactly as it shipped
 * — a 90-unit label box beginning at unit 362 of a 396-unit viewBox — measured
 * by the identical code that measures the real renderer.
 */
const SHIPPED_RECT_SVG = `
  const w = 300, h = 150;
  return \`<div class="rf-fig">
    <svg viewBox="0 0 \${w + 96} \${h + 62}" role="img">
      <rect x="56" y="34" width="\${w}" height="\${h}" fill="rgba(95,230,255,.07)" stroke="#5fe6ff" stroke-width="1.4"/>
      <path d="M56 22 h\${w}" stroke="rgba(95,230,255,.5)" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="M44 34 v\${h}" stroke="rgba(95,230,255,.5)" stroke-width="1" stroke-dasharray="3 3"/>
      <foreignObject x="56" y="0" width="\${w}" height="22">
        <div class="figlabel" data-fig="w" xmlns="http://www.w3.org/1999/xhtml">\${texFirst([fig.wLabel]) || ''}</div>
      </foreignObject>
      <foreignObject x="\${56 + w + 6}" y="\${34 + h / 2 - 14}" width="90" height="28">
        <div class="figlabel" data-fig="h" xmlns="http://www.w3.org/1999/xhtml">\${texFirst([fig.hLabel]) || ''}</div>
      </foreignObject>
    </svg></div>\`;`;

/**
 * D. PUT THE SHIPPED LATTICE BACK, AND PROVE THE CHART PASS REJECTS IT.
 *
 * The body below is the geometry exactly as it shipped — gridlines on
 * `round(R/5)`, numerals on `round(R/3)`, in a 16-unit pad — redrawn into the
 * real panel and measured by the identical code that measures the real
 * renderer. It is the same demonstration `SHIPPED_RECT_SVG` is for the label
 * pass: not a claim that the gate would have caught it, a showing.
 */
const SHIPPED_LATTICE = `
  const NS = 'http://www.w3.org/2000/svg';
  const fig = window.__panel.item.figure;
  const R = Math.max(4, Math.round(fig.range || 10));
  const S = 300, pad = 16, k = (S - pad * 2) / (2 * R);
  const X = (x) => pad + (x + R) * k;
  const Y = (y) => pad + (R - y) * k;
  for (const el of svg.querySelectorAll('path.gl, path.ax, text[data-axis]')) el.remove();
  const mk = (t, a, text) => {
    const n = document.createElementNS(NS, t);
    for (const key in a) n.setAttribute(key, a[key]);
    if (text != null) n.textContent = text;
    g.appendChild(n);
  };
  for (let i = -R; i <= R; i += Math.max(1, Math.round(R / 5))) {
    mk('path', { d: 'M' + X(i) + ' ' + pad + ' V' + (S - pad), class: 'gl' });
    mk('path', { d: 'M' + pad + ' ' + Y(i) + ' H' + (S - pad), class: 'gl' });
  }
  mk('path', { d: 'M' + X(0) + ' ' + pad + ' V' + (S - pad), class: 'ax' });
  mk('path', { d: 'M' + pad + ' ' + Y(0) + ' H' + (S - pad), class: 'ax' });
  const lab = Math.max(2, Math.round(R / 3));
  for (let i = -R + (R % lab); i <= R; i += lab) {
    if (i === 0 || Math.abs(i) > R - 1) continue;
    mk('text', { x: X(i), y: Y(0) + 12, 'text-anchor': 'middle', 'data-axis': 'x',
                 fill: 'rgba(159,179,208,.8)', 'font-size': 9 }, String(i));
    mk('text', { x: X(0) - 6, y: Y(i) + 3.2, 'text-anchor': 'end', 'data-axis': 'y',
                 fill: 'rgba(159,179,208,.8)', 'font-size': 9 }, String(i));
  }
`;

/**
 * THE NARROW PLANTS: the numbering off by one step, and nothing else wrong.
 *
 * "Off by one step" has two honest readings, and the first draft of this
 * self-test only planted a third one that is not a defect at all: sliding
 * every numeral by exactly one gridline pitch on a UNIT lattice lands it on
 * the next gridline, which is a mislabelled chart but not an off-grid one.
 * The gate said so — it caught nothing, and it was right to. So:
 *
 *  · SLID_HALF_A_SQUARE — the numerals fall BETWEEN the lines, which is what
 *    the two disagreeing steps did in pixels. D1 must fire.
 *  · RENUMBERED_ONE_STEP — the numerals stay exactly where they are drawn and
 *    every one of them is moved one step along in VALUE. Nothing about the
 *    picture is malformed: the ticks are on lines, the scale is linear, the
 *    squares are whole. The only thing wrong is that the chart now says a
 *    different point is (a, b) — so D3 and D5 must fire, off the readings and
 *    the origin, and if they do not this gate is only a shape check.
 */
const SLID_HALF_A_SQUARE = `
  const xs = [...svg.querySelectorAll('path.gl')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.height > r.width)
    .map((r) => r.x + r.width / 2).sort((a, b) => a - b);
  const step = xs.length > 1 ? xs[1] - xs[0] : 0;
  const unit = svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
  for (const t of svg.querySelectorAll('text[data-axis]')) {
    if (t.dataset.axis === 'x') t.setAttribute('x', parseFloat(t.getAttribute('x')) + step * unit * 0.5);
    else t.setAttribute('y', parseFloat(t.getAttribute('y')) - step * unit * 0.5);
  }
`;

const RENUMBERED_ONE_STEP = `
  const vals = [...svg.querySelectorAll('text[data-axis="x"]')]
    .map((t) => Number(t.textContent)).sort((a, b) => a - b);
  const jump = vals.length > 1 ? vals[1] - vals[0] : 1;
  for (const t of svg.querySelectorAll('text[data-axis]')) {
    t.textContent = String(Number(t.textContent) + jump);
  }
`;

/** A reading drawn one square from where its own axes put it. */
const READING_NUDGED = `
  const xs = [...svg.querySelectorAll('path.gl')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.height > r.width)
    .map((r) => r.x + r.width / 2).sort((a, b) => a - b);
  const step = xs.length > 1 ? xs[1] - xs[0] : 0;
  const unit = svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
  for (const c of svg.querySelectorAll('circle.anchor, circle.pt, circle.mk')) {
    c.setAttribute('cx', parseFloat(c.getAttribute('cx')) + step * unit);
  }
`;

/** The drawing cut back to the size the complaint reported. */
const DRAWN_TOO_SMALL = `
  svg.style.width = '110px';
`;

/**
 * Clean first, then each plant, all inside ONE frozen build and one browser —
 * the same charts, the same panel, the same measuring code. The clean pass is
 * the half that matters as much as the plants: a rule that also fires on the
 * honest chart beside it is a rule somebody switches off.
 */
async function selfTestCharts() {
  const laptop = VIEWPORTS.find((v) => v.name === '1600x900') || VIEWPORTS[0];
  const all = geometrySamples({ key: 'kind' });
  // The two ranges the shipped steps disagreed worst on, one of each kind, and
  // one range they happened to agree on — the honest chart on the safe side.
  const pick = (kind, range) => all.find((x) => x.kind === kind && x.range === range);
  const specs = [pick('plot', 10), pick('line', 10), pick('plot', 9), pick('line', 7)].filter(Boolean);
  const passes = [
    { name: 'clean', specs, viewports: [laptop], locales: ['en'] },
    { name: 'the shipped lattice put back', specs, viewports: [laptop], locales: ['en'], badGrid: SHIPPED_LATTICE },
    { name: 'the numbering slid half a square', specs, viewports: [laptop], locales: ['en'], badGrid: SLID_HALF_A_SQUARE },
    { name: 'the numbering renumbered one step out', specs, viewports: [laptop], locales: ['en'], badGrid: RENUMBERED_ONE_STEP },
    { name: 'a reading drawn one square off', specs, viewports: [laptop], locales: ['en'], badGrid: READING_NUDGED },
    { name: 'the drawing cut to 110px', specs, viewports: [laptop], locales: ['en'], badGrid: DRAWN_TOO_SMALL },
  ];
  const { byPass } = await auditCharts({ passes });
  const by = Object.fromEntries(byPass.map((r) => [r.name, r.problems]));
  const hit = (name, re) => (by[name] || []).filter((p) => re.test(p));
  const clean = by.clean || [];
  const shipped = hit('the shipped lattice put back', /DO NOT SIT ON A GRIDLINE/);
  const slid = hit('the numbering slid half a square', /DO NOT SIT ON A GRIDLINE/);
  const renum = hit('the numbering renumbered one step out', /numerals put zero|two different claims/);
  const nudged = hit('a reading drawn one square off', /two different claims/);
  const small = hit('the drawing cut to 110px', /grid square is|smallest type/);
  const ok = clean.length === 0 && shipped.length > 0 && slid.length > 0
    && renum.length > 0 && nudged.length > 0 && small.length > 0;
  console.log(`  D charts: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`     today's lattice over ${specs.length} charts: ${clean.length} problem(s)`);
  for (const p of clean.slice(0, 4)) console.log('       · ' + p);
  const say = (name, found, what) => {
    console.log(`     ${name}: ${found.length} ${what}`);
    for (const p of found.slice(0, 2)) console.log('       · ' + p);
  };
  say('the shipped lattice put back', shipped, `off-grid finding(s) of ${(by['the shipped lattice put back'] || []).length} in all`);
  say('the numbering slid half a square', slid, 'off-grid finding(s)');
  say('the numbering renumbered one step out', renum, 'finding(s) on the origin or the readings');
  say('a reading drawn one square off', nudged, 'finding(s)');
  say('the drawing cut to 110px', small, 'finding(s)');
  return ok;
}

async function selfTestRendered() {
  const rects = figureSamples().filter((s) => s.figure.kind === 'rect').slice(0, 8);
  if (!rects.length) { console.log('  C legibility: FAIL — no rect figures to measure'); return false; }
  const now = await auditRendered({ samples: rects });
  const then = await auditRendered({ samples: rects, geometry: SHIPPED_RECT_SVG });
  const clipped = then.problems.filter((p) => /CLIPPED/.test(p));
  const ok = now.problems.length === 0 && clipped.length > 0;
  console.log(`  C legibility: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`     today's rectSvg over ${rects.length} drawings: ${now.problems.length} problem(s)`);
  for (const p of now.problems.slice(0, 3)) console.log('       · ' + p);
  console.log(`     the shipped rectSvg put back: ${then.problems.length} problem(s), ${clipped.length} clipped`);
  for (const p of clipped.slice(0, 3)) console.log('       · ' + p);
  return ok;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  await loadEveryCourse();
  if (args.includes('--list')) {
    const { seen } = auditFigures({ seeds: 6, locales: ['en'] });
    for (const [key, { item }] of [...seen].sort()) {
      console.log(`${key.padEnd(40)} ${FIGURE_KINDS[item.figure.kind].padEnd(9)} ${JSON.stringify(item.figure).slice(0, 90)}`);
    }
    process.exit(0);
  }
  if (args.includes('--self-test')) {
    console.log('ASCENT — figure/prose agreement · self-test');
    const a = selfTestAgreement();
    const b = selfTestSelfAnswering();
    const c = args.includes('--no-render') ? true : await selfTestRendered();
    const d = args.includes('--no-render') ? true : await selfTestCharts();
    const ok = a && b && c && d;
    console.log(ok ? '\nself-test: PASS — every branch of the gate was watched to fail.'
      : '\nself-test: FAIL — a branch of the gate did not catch its planted defect.');
    process.exit(ok ? 0 : 1);
  }
  if (args.includes('--shots')) {
    const dir = path.resolve(args[args.indexOf('--shots') + 1] || 'shots/figures');
    const shot = await shootCharts(dir);
    for (const s2 of shot) console.log(`  ${s2.name.padEnd(46)} drawing ${s2.size ? `${s2.size.w}x${s2.size.h}` : 'MISSING'} CSS px`);
    console.log(`\n  ${shot.length} frame(s) in ${dir}`);
    process.exit(0);
  }
  if (args.includes('--render') || args.includes('--charts')) {
    const onlyCharts = args.includes('--charts');
    console.log('ASCENT — figure legibility (real browser, real rift.js, real rift.css)');
    const problems = [];
    if (!onlyCharts) {
      const r = await auditRendered();
      console.log(`  labels:  ${r.measured}/${r.total} drawings measured`);
      problems.push(...r.problems);
    }
    const c = await auditCharts();
    for (const r of c.passes) {
      console.log(`  charts (${r.name}): ${r.specs.length} coordinate figure(s)`
        + ` x ${r.viewports.length} viewport(s) x ${r.locales.length} locale(s)`);
    }
    console.log(`  charts:  ${c.measured} measured drawings`);
    problems.push(...c.problems);
    if (problems.length) {
      console.error(`\n  ${problems.length} problem(s):`);
      for (const p of problems.slice(0, 60)) console.error('   · ' + p);
      if (problems.length > 60) console.error(`   … and ${problems.length - 60} more`);
      console.error('\nFAIL — a drawing does not say what the item says.');
      process.exit(1);
    }
    console.log('\n  PASS — every label renders in full inside its drawing, every numbered tick sits on a');
    console.log('         gridline, every reading is drawn where the axes put it, and the mathematics is');
    console.log('         not the smallest thing in the panel — at every viewport, in all three languages');
    process.exit(0);
  }
  const { problems, checked, seen } = auditFigures();
  console.log('ASCENT — figure/prose agreement');
  console.log(`  ${checked} items over ${LOCALES.length} locales; ${seen.size} distinct figure-bearing forms`);
  console.log(`  ${Object.keys(FIGURE_KINDS).length} figure kinds declared, ${REWRITE_ASKS.size} asks classified as rewriting`);
  if (problems.length) {
    console.error(`\n  ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.error('   · ' + p);
    console.error('\na drawing contradicts its item, or a question is answered by its own display.');
  } else {
    console.log('\n  every figure re-derives its item\'s answer, and no question is answered by its display');
  }
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. A drawing that says
     something the prose beside it does not is a card a learner reads wrong,
     whichever unit it is drawn in. */
  findings('check:figures', { scope: 'sweep' }).route(problems.map(String)).done();
}
