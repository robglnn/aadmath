#!/usr/bin/env node
/**
 * THE DETERMINACY GATE — is the answer decided by what the learner is shown?
 *
 *   node tools/critic/determinate.mjs                # every skill in every unit
 *   node tools/critic/determinate.mjs --self-test    # prove all four rules fire
 *   node tools/critic/determinate.mjs --seeds 400    # deeper sample
 *   node tools/critic/determinate.mjs --skill parallel-perpendicular
 *   node tools/critic/determinate.mjs --list         # print every finding, not a census
 *
 * WHY THIS FILE EXISTS
 *
 * Every gate in this repo asks whether the answer is RIGHT. None of them asked
 * whether the question has ONE right answer. A blind critic found 2,348 items
 * whose answer is not determined by what the learner is shown, in a build whose
 * gates were all green. Two families, both shipped, both re-derived correctly by
 * `validate-items`, both rendered legibly by `check-figures`, both written in
 * plain STE by `check-language`:
 *
 *  1. 1,178 `parallel-perpendicular` items whose whole stem is
 *
 *         "Write the rule of the line through the marked reading."
 *
 *     over  `y = 2x + 3   (4, 5)  ⇒  □`. Three different forms print that
 *     sentence over that arrangement: `pp-beside` wants the parallel line,
 *     `pp-right` wants the perpendicular one, and `pp-upright` tosses a coin.
 *     A learner who writes the parallel rule is told they are wrong on a third
 *     of them, and there is nothing on the card that could have told them
 *     otherwise. This gate finds literal pairs — the same sentence over the
 *     same numbers, with two different accepted answers.
 *
 *  2. 1,170 `association-strength` items reading
 *
 *         "What share of that row sits in the marked column?"
 *
 *     `item.figure` is null, the display is a plain two-way table, and nothing
 *     in it is marked. "That row" has no antecedent and "the marked column" has
 *     no referent; the row and column that decide the answer live in
 *     `item.check` where the learner cannot see them.
 *
 * THE GENERAL TEST is the one in the brief: if two different valid answers
 * satisfy the stem plus the rendered notation, the item fails. That is checked
 * three ways, weakest evidence last, because the first is a proof and the other
 * two are the shapes that proof takes when the numbers happen not to collide.
 *
 *   collision   Two items with the SAME rendered stem and the SAME rendered
 *               notation and DIFFERENT accepted answers. This is not a
 *               heuristic and has no threshold: the bank itself has produced
 *               the counter-example. It is printed with both seeds so anyone
 *               can regenerate the pair.
 *
 *   ambiguous   One rendered stem, over one shape of notation, under which the
 *               bank declares two different RELATIONSHIPS — `check.relation`
 *               parallel here and perpendicular there. No arrangement of
 *               numbers can tell a learner which one a sentence that mentions
 *               neither is asking for, so every item in that group is
 *               under-determined whether or not two of them happened to land
 *               on the same numbers. The list of fields that count is narrow
 *               and argued for at AMBIGUITY_FIELDS below; `check.want` is not
 *               on it, and the first draft was wrong to put it there.
 *
 *   dangling    The stem points at something on the surface that is not there:
 *               a MARKED row / column / cell / reading with nothing marked, a
 *               graph with no figure, a table with no table, or TWO CANDIDATE
 *               ANSWERS to choose between when the card names none. Checked in
 *               all three locales against the words each locale actually uses,
 *               because a stem is composed from a situation and a question that
 *               were translated at different times.
 *
 *               The `candidates` class is the newest and has its own scar.
 *               Sixteen `*-dispute` forms across Levels 3, 4 and 5 read
 *               "Two cadets at the same console write different answers here.
 *               Which answer is right?" over `\sqrt{20}` — with no answers
 *               anywhere on the card and a keypad, not a choice set, under it.
 *               A cadet had to notice the sentence was false and ignore it.
 *               Level 1's four disputes do the same thing honestly: they print
 *               BOTH readings in the sentence ("Cadet Wren makes it 26. Cadet
 *               Vale makes it 40."), so "which reading is the true one" has
 *               something to point at. That difference is what this measures.
 *
 *   selector    `item.check` carries a coordinate the display cannot carry —
 *               `row`, `col`, `at`, `index`, `term` — and the stem never states
 *               it. This is the machine-readable form of "the answer lives
 *               somewhere the learner cannot look". It is reported next to
 *               `dangling` and fails for the same reason.
 *
 * WHAT THIS GATE IS NOT. It does not check that the answer is correct
 * (`validate-items`, `check-solver`), that the options contain it
 * (`choiceaudit`), that the drawing agrees with the prose (`check-figures`), or
 * that the sentence is readable (`check-language`). It checks that the question
 * has exactly one answer, which none of those can see.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generate, SKILLS } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../_courses.mjs';
import { findings, sandbox } from '../_findings.mjs';

export const LOCALES = ['en', 'es', 'pl'];

// ---------------------------------------------------------------------------
// WHAT A STEM CAN POINT AT, IN THREE LANGUAGES.
//
// Written per language rather than translated from English, and matched WORD BY
// WORD over a unicode-aware split rather than by a loose \\b regex. Both of
// those are scars:
//
//  · `\\b(tabel\\w+)\\b` never matched the Polish "tabelę", because JavaScript's
//    `\\w` is ASCII and "ę" is not in it. The Polish half of this gate was silent
//    on a whole class of reference and looked green.
//
//  · A bare `marcad[oa]s?` matched "Un carrete de marcado" — a MARKING reel, a
//    piece of scenery — and reported twelve determinate Spanish items. So a
//    mark word only counts when it sits beside a thing the display could
//    actually mark: a row, a column, a cell, a reading. That is what "the
//    marked column" means and what "a marking reel" does not.
//
//  · "shown" and "grid" were in the first draft and are gone. An expression
//    "shown" IS the display, and half this bank calls an area model a grid.
//
// A word earns a place here only when it is a claim that the card carries a
// MARK or a PICTURE — something a learner would look for and fail to find.
// ---------------------------------------------------------------------------
/** Letters, for a language whose alphabet JavaScript's `\\w` does not cover. */
const PL = '[a-ząćęłńóśźż]';

/** Split on anything that is not a letter or a digit, in any alphabet. */
export function words(text) {
  return String(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Do a word matching `a` and a word matching `b` sit within `gap` of each other? */
export function nearby(text, a, b, gap = 3) {
  const w = words(text);
  const ai = []; const bi = [];
  w.forEach((x, i) => { if (a.test(x)) ai.push(i); if (b.test(x)) bi.push(i); });
  return ai.some((i) => bi.some((j) => i !== j && Math.abs(i - j) <= gap));
}

/** Does any word match? */
export function anyWord(text, re) {
  return words(text).some((w) => re.test(w));
}

/** "the MARKED column", "one READING is marked" — the adjective. */
export const MARK_WORD = {
  en: /^(marked|highlighted|shaded|circled|starred|flagged|ringed)$/,
  es: /^(marcad[oa]s?|resaltad[oa]s?|sombread[oa]s?|se[ñn]alad[oa]s?|rodead[oa]s?)$/,
  pl: new RegExp(`^(zaznaczon${PL}*|wyr[oó]żnion${PL}*|zacieniowan${PL}*|okr[ąa]żon${PL}*)$`),
};

/** …and the part of the display it claims is marked. */
export const SURFACE_NOUN = {
  en: /^(rows?|columns?|cells?|readings?|points?|entr(y|ies)|values?|lines?|squares?|box(es)?|bars?|terms?)$/,
  es: /^(filas?|columnas?|celdas?|lecturas?|puntos?|entradas?|valores?|valor|rectas?|casillas?|barras?|t[eé]rminos?)$/,
  pl: new RegExp(`^(wiersz${PL}*|kolumn${PL}*|kom[oó]rk${PL}*|odczyt${PL}*|punkt${PL}*|pol${PL}*|warto[śs]${PL}*|prost${PL}*|s[łl]upk${PL}*)$`),
};

/**
 * "WHICH answer / cadet / reading is right?" — a stem that asks the learner to
 * choose between candidates rather than to work one out.
 *
 * Written per language, matched word by word, and the Polish forms are spelt
 * with the letter class rather than `\w` for the reason at the head of this
 * block: `odpowiedź` ends in a letter JavaScript's ASCII `\w` cannot see, and
 * a regex that cannot see it reports a clean Polish bank.
 */
export const WHICH_WORD = {
  en: /^which$/,
  // ACCENTED ONLY. Unaccented "que" is Spanish's relative pronoun and sits one
  // word from everything: "¿Cuál es la lectura QUE falta?" put `que` beside
  // `lectura` and reported 223 honest `ratio-proportion` items.
  es: /^(qué|cuál|cuáles)$/,
  pl: new RegExp(`^kt[oó]r${PL}*$`),
};
/** …and the thing it asks the learner to choose between. */
export const CANDIDATE_NOUN = {
  en: /^(answers?|cadets?|readings?)$/,
  es: /^(respuestas?|cadetes?|lecturas?)$/,
  pl: new RegExp(`^(odpowied[\u017Az]${PL}*|kadet${PL}*|odczyt${PL}*)$`),
};
/**
 * …and the word that makes it a question about WHICH ONE IS RIGHT rather than
 * a question about a quantity.
 *
 * This third word is the whole soundness of the rule, and the first draft did
 * not have it. "Which" beside "reading" within three words also matches
 * "¿Cuál es la lectura que falta?" — what is the missing reading, an ordinary
 * question with one answer — and 45 more shapes like it across the bank. Run
 * without it the rule reported 5,000 honest items, and a rule that fires on
 * honest content gets switched off. A chooser is a chooser when it asks which
 * one is RIGHT.
 */
export const RIGHT_WORD = {
  en: /^(right|correct|correctly|true|truly)$/,
  // No `razón`: "tener razón" is to be right, but this bank counts ratios, and
  // "la misma razón" is the same RATIO on every row of a proportion table.
  es: /^(correct[oa]s?|verdader[oa]s?|bien)$/,
  pl: new RegExp(`^(dobr${PL}*|poprawn${PL}*|prawdziw${PL}*|racj${PL}*|rację)$`),
};

/**
 * The quantities a sentence names IN ITS OWN WORDS — every `$…$` span and
 * every bare numeral in the prose.
 *
 * This is what "the two cadets' answers are on the card" means in this bank:
 * `ctx.dispute` renders as "Cadet Wren makes it 26. Cadet Vale makes it 40.",
 * so the sentence carries two quantities and the choice it then offers is a
 * real one. A situation that carries none — "Two cadets at the same console
 * write different answers here." — offers a choice between nothing.
 */
export function quantitiesIn(stem) {
  const src = String(stem || '');
  const out = new Set();
  for (const m of src.matchAll(/\$([^$]+)\$/g)) out.add(m[1].trim());
  for (const m of src.replace(/\$[^$]+\$/g, ' ').matchAll(/-?\d+(?:[.,]\d+)?/g)) out.add(m[0]);
  return out;
}

/** A drawn graph, a printed table, any drawing at all. */
export const FIGURE_WORD = {
  graph: {
    en: /^(graphs?|plots?)$/,
    es: /^(gr[áa]ficas?|gr[áa]ficos?)$/,
    pl: new RegExp(`^wykres${PL}*$`),
  },
  table: {
    en: /^(tables?)$/,
    es: /^(tablas?)$/,
    pl: new RegExp(`^tabel${PL}*$`),
  },
  drawing: {
    en: /^(diagrams?|drawings?|pictures?|sketch(es)?)$/,
    es: /^(diagramas?|dibujos?|esquemas?)$/,
    pl: new RegExp(`^(rysun${PL}*|schemat${PL}*)$`),
  },
};

/**
 * "reads the ledger AS A conversion table" is a simile, not a claim that a
 * table is on the card. Polish has no articles, so this is a word test rather
 * than a determiner test: the comparison word, then the noun within three.
 */
export const SIMILE = {
  en: /^(as|like)$/,
  es: /^(como|cual)$/,
  pl: /^(jak|jako|niczym)$/,
};


/** LaTeX that actually singles a part of the display out. */
const LATEX_MARK = /\\(boxed|fbox|colorbox|underline|underbrace|overbrace|textcolor|color|mathbf|bm|xrightarrow|xleftarrow|overset|underset)\b/;
/** LaTeX that really is a table. */
const LATEX_TABLE = /\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|cases)\}/;
/** Figure kinds that really are a drawn graph. */
const GRAPH_FIGURES = new Set(['plot', 'line', 'lines']);

/**
 * Does the surface satisfy this class of reference?
 * `item` is a finalised item; only its rendered parts are consulted.
 */
export function surfaceHas(item, cls) {
  const kind = item.figure ? item.figure.kind : null;
  const latex = String(item.latex || '');
  if (cls === 'mark') {
    // A figure may mark a point; the notation may box or colour one part. A
    // plain display with nothing singled out satisfies nothing.
    if (item.figure && (item.figure.mark != null || item.figure.marked != null || item.figure.at != null)) return true;
    return LATEX_MARK.test(latex);
  }
  if (cls === 'candidates') {
    // Two quantities named in the sentence are two candidates to choose
    // between. One or none is a question with nothing under it.
    return quantitiesIn(item.stem).size >= 2;
  }
  if (cls === 'graph') return GRAPH_FIGURES.has(kind);
  if (cls === 'table') return !!kind || LATEX_TABLE.test(latex);
  if (cls === 'drawing') return !!kind;
  return true;
}

/**
 * The fields of `item.check` that say what the learner is being ASKED TO DO, as
 * opposed to what they are being shown. Two items that print the same sentence
 * over the same shape of notation and disagree here are asking two different
 * questions in the same words.
 *
 * Data fields are deliberately absent. `env`, `math`, `point`, `table` and
 * `variable` are the item's own numbers, and the numbers ARE on the display —
 * `5c` with `c = 29` and `5c` with `c = 3` are two honest items, not one
 * ambiguous one.
 */
export const TASK_FIELDS = ['relation', 'want', 'form', 'model', 'direction', 'about', 'target', 'side', 'role', 'kind'];

export function taskOf(check) {
  if (!check || typeof check !== 'object') return '-';
  const parts = [];
  for (const k of TASK_FIELDS) if (check[k] != null) parts.push(`${k}=${JSON.stringify(check[k])}`);
  return parts.join(' ') || '-';
}

/**
 * THE FIELDS THAT CAN MAKE ONE SENTENCE INTO TWO QUESTIONS — a strict subset of
 * TASK_FIELDS, and the narrower list is the whole soundness of the `ambiguous`
 * rule.
 *
 * Each of these names WHICH OF SEVERAL RELATIONSHIPS the item wants. There is
 * no arrangement of numbers that can tell a learner whether "the line through
 * the marked reading" means the parallel one or the perpendicular one, so a
 * sentence that carries both is ambiguous however the numbers fall.
 *
 * `want`, `form` and `model` are NOT here, and the first draft of this file was
 * wrong to include them. `square-root-method` prints "Find every value that
 * works." over `n^{2} = 25` (`want: roots`) and over `n^{2} = -25`
 * (`want: none`); the field records what the answer TURNED OUT to be, and the
 * minus sign on the card is what decides it. Reading that as two questions in
 * one sentence flagged 36 perfectly determinate items, and a rule that fires on
 * honest content gets switched off — which is how a project ends up with
 * twenty-four gates and 2,348 indeterminate items.
 */
export const AMBIGUITY_FIELDS = ['relation', 'direction', 'about', 'side', 'role', 'target', 'kind'];

export function askOf(check) {
  if (!check || typeof check !== 'object') return '-';
  const parts = [];
  for (const k of AMBIGUITY_FIELDS) if (check[k] != null) parts.push(`${k}=${JSON.stringify(check[k])}`);
  return parts.join(' ') || '-';
}

/**
 * Coordinates a checker uses to pick out one part of the display. If the stem
 * never states one, the learner cannot know which part is meant.
 */
export const SELECTOR_FIELDS = ['row', 'col', 'column', 'index', 'at', 'term', 'nth', 'cell'];

/** `y = 2x + 3 \quad (4, 5)` -> `y = #x + # \quad (#, #)`; the shape, not the numbers. */
export function skeletonOfLatex(latex) {
  return String(latex || '')
    .replace(/-?\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Numbers a stem states outright, so a selector stated in words is not a fault. */
function numeralsIn(text) {
  return new Set(String(text || '').match(/-?\d+/g) || []);
}

// ---------------------------------------------------------------------------
// THE RULES, as pure functions over a bag of generated items.
//
// `sample` is [{ loc, skill, form, difficulty, seed, stem, latex, answer, check,
//               figure }]. Everything below reads only those fields, so the
// self-test can hand it items built by hand and watch each rule fire.
// ---------------------------------------------------------------------------

/** collision + ambiguous. */
export function askFaults(sample) {
  const out = [];

  // --- collision: the same card, two answers -------------------------------
  const bySurface = new Map();
  for (const it of sample) {
    const key = `${it.loc} ${it.stem} ${it.latex} ${JSON.stringify(it.figure ?? null)}`;
    let g = bySurface.get(key);
    if (!g) { g = { loc: it.loc, stem: it.stem, answers: new Map() }; bySurface.set(key, g); }
    if (!g.answers.has(it.answer)) g.answers.set(it.answer, it);
  }
  for (const { loc, stem, answers } of bySurface.values()) {
    if (answers.size < 2) continue;
    const shown = [...answers.entries()];
    out.push({
      rule: 'collision',
      skill: shown[0][1].skill,
      form: [...new Set(shown.map(([, it]) => it.form))].join('/'),
      loc,
      count: answers.size,
      text: `${shown[0][1].skill}: the same card has ${answers.size} different accepted answers in ${loc} — `
        + `"${stem}" over ${shown[0][1].latex} is answered `
        + shown.map(([a, it]) => `"${a}" (${it.form} d${it.difficulty} seed ${it.seed})`).join(' and '),
    });
  }

  // --- ambiguous: one sentence, one shape, two tasks ------------------------
  const byAsk = new Map();
  for (const it of sample) {
    const key = `${it.loc} ${it.stem} ${skeletonOfLatex(it.latex)}`;
    let g = byAsk.get(key);
    if (!g) { g = { loc: it.loc, stem: it.stem, skill: it.skill, tasks: new Map(), n: 0 }; byAsk.set(key, g); }
    g.n += 1;
    const t = askOf(it.check);
    if (!g.tasks.has(t)) g.tasks.set(t, it);
  }
  for (const g of byAsk.values()) {
    if (g.tasks.size < 2) continue;
    out.push({
      rule: 'ambiguous',
      skill: g.skill,
      form: [...new Set([...g.tasks.values()].map((it) => it.form))].join('/'),
      loc: g.loc,
      count: g.n,
      text: `${g.skill}: one sentence over one shape of notation asks ${g.tasks.size} different things in ${g.loc} `
        + `(${g.n} items sampled) — "${g.stem}" is used for `
        + [...g.tasks.entries()].map(([t, it]) => `${t} (${it.form})`).join(' and '),
    });
  }
  return out;
}

/**
 * Which classes of thing this stem claims are on the card.
 * `mark` needs the adjective AND the part it marks; the figure classes need the
 * noun and no comparison word in front of it.
 */
export function referencesIn(stem, loc) {
  const out = [];
  const markAdj = MARK_WORD[loc];
  const noun = SURFACE_NOUN[loc];
  if (markAdj && noun && nearby(stem, markAdj, noun, 3)) out.push('mark');
  // "which ANSWER … is RIGHT" — the chooser word beside the thing chosen, and
  // the rightness word anywhere in the sentence. See RIGHT_WORD for why all
  // three are required.
  const which = WHICH_WORD[loc];
  const cand = CANDIDATE_NOUN[loc];
  const right = RIGHT_WORD[loc];
  if (which && cand && right && nearby(stem, which, cand, 1) && anyWord(stem, right)) out.push('candidates');
  for (const [cls, byLoc] of Object.entries(FIGURE_WORD)) {
    const re = byLoc[loc];
    if (!re || !anyWord(stem, re)) continue;
    if (SIMILE[loc] && nearby(stem, SIMILE[loc], re, 3)) continue;   // "as a conversion table"
    out.push(cls);
  }
  return out;
}

/** dangling + selector, per item. */
export function referenceFaults(item) {
  const out = [];
  const loc = item.loc || 'en';
  for (const cls of referencesIn(item.stem, loc)) {
    if (surfaceHas(item, cls)) continue;
    out.push({
      rule: 'dangling',
      cls,
      skill: item.skill,
      form: item.form,
      loc,
      text: cls === 'candidates'
        ? `${item.skill}/${item.form} (${loc}): the stem asks which of several answers is right, and the card `
          + `names none of them — "${item.stem}"`
        : `${item.skill}/${item.form} (${loc}): the stem points at a ${cls} the card does not carry `
          + `(figure ${item.figure ? item.figure.kind : 'null'}) — "${item.stem}"`,
    });
  }
  const check = item.check || {};
  const stated = numeralsIn(item.stem);
  for (const f of SELECTOR_FIELDS) {
    if (check[f] == null) continue;
    if (typeof check[f] !== 'number') continue;
    // A selector the sentence states outright is fine: "the 4th term" carries
    // its own coordinate. Only an unstated one hides the question.
    if (stated.has(String(check[f])) || stated.has(String(check[f] + 1))) continue;
    // …and a display that marks the part it means answers it too.
    if (surfaceHas(item, 'mark')) continue;
    out.push({
      rule: 'selector',
      cls: f,
      skill: item.skill,
      form: item.form,
      loc,
      text: `${item.skill}/${item.form} (${loc}): the checker picks a ${f} `
        + `which the stem never states and the display never marks — "${item.stem}"`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);

async function run() {
  // Every unit the manifest ships, not just the one `generators.js` registers
  // at import. Without this line the gate reads ten skills and says nothing at
  // all about the fifty-two the manifest also ships — which is how both of the
  // defects above stayed invisible.
  for (const { unit } of await allUnits()) await loadUnit(unit);

  const SEEDS = Number(arg('seeds', 200));
  const only = arg('skill', null);
  const skills = only ? SKILLS.filter((s) => s === only) : SKILLS.slice();
  if (!skills.length) { console.error(`no such skill: ${only}`); process.exit(2); }

  const findings = [];
  let items = 0;
  for (const skill of skills) {
    const sample = [];
    for (let d = 1; d <= 5; d++) {
      for (let s = 0; s < SEEDS; s++) {
        for (const loc of LOCALES) {
          let it;
          try { it = generate(skill, d, s * 7919 + d * 131, { locale: loc, strict: true, record: false }); } catch { continue; }
          items += 1;
          const row = {
            loc, skill, form: it.form, difficulty: d, seed: it.seed,
            stem: it.stem, latex: it.latex, answer: it.answer, check: it.check, figure: it.figure,
          };
          sample.push(row);
          for (const f of referenceFaults(row)) findings.push({ ...f, count: 1 });
        }
      }
    }
    findings.push(...askFaults(sample));
  }

  // A deck deals the same defect hundreds of times. Report it once, with the
  // count, or nobody reads the report.
  const census = new Map();
  for (const f of findings) {
    const key = `${f.rule}|${f.skill}|${f.form || ''}|${f.loc}|${f.cls || ''}|${f.text.slice(0, 120)}`;
    const c = census.get(key);
    if (c) { c.count += f.count || 1; continue; }
    census.set(key, { ...f, count: f.count || 1 });
  }
  const rows = [...census.values()].sort((a, b) => b.count - a.count);

  const byRule = new Map();
  for (const r of rows) byRule.set(r.rule, (byRule.get(r.rule) || 0) + r.count);

  console.log(`determinacy — ${items} items over ${skills.length} skills, ${SEEDS} seeds per band, ${LOCALES.join('/')}`);
  if (!rows.length) {
    console.log('every item sampled has exactly one answer its own card can justify');
    return determinacyVerdict([], []);
  }

  /* ------------------------------------------------------------------------
     THE HEADLINE, AND WHY IT IS AT THE TOP.

     This gate worked. It found 2,348 under-determined items, and later a
     ratio-proportion card with THIRTY accepted answers in Polish. Two critics
     then found the same defect by hand, independently, which means the gate had
     already said it and nobody acted. The report was forty lines of prose in
     which nothing said WHICH FORM, IN WHICH UNIT, and WHETHER A LEARNER CAN
     ACTUALLY BE HANDED IT — so it read like a wall of text about content in
     general rather than a defect with an owner and an address.

     So the first thing printed is a table: the form, the unit, on the route or
     not, and the count. Route-first, biggest first. A reader who stops after
     six lines still knows what to fix and whether it is in front of a learner
     today. Everything below it is the detail.
     ------------------------------------------------------------------------ */
  const unitOf = new Map();
  const routeIds = new Set();
  try {
    const { routeUnits, ROOT: CROOT } = await import('../_courses.mjs');
    const { readFile } = await import('node:fs/promises');
    const nodePath = (await import('node:path')).default;
    const { road } = await routeUnits();
    for (const u of road) routeIds.add(u.id);
    for (const { unit } of await allUnits()) {
      const g = JSON.parse(await readFile(nodePath.join(CROOT, 'content', unit.graph), 'utf8'));
      for (const n of g.nodes) unitOf.set(n.id, unit.id);
    }
  } catch (e) {
    console.log(`  (the unit map could not be read — ${e.message}; the table below cannot say what is on the route)`);
  }

  const addr = new Map();
  for (const r of rows) {
    const unit = unitOf.get(r.skill) || '?';
    const key = `${r.skill}|${r.form || '?'}|${r.rule}|${unit}`;
    const a = addr.get(key)
      || { skill: r.skill, form: r.form || '?', rule: r.rule, unit, onRoute: routeIds.has(unit), items: 0, locs: new Set() };
    a.items += r.count;
    a.locs.add(r.loc);
    addr.set(key, a);
  }
  const table = [...addr.values()].sort((a, b) =>
    (b.onRoute - a.onRoute) || (b.items - a.items) || a.skill.localeCompare(b.skill));
  const onRoute = table.filter((a) => a.onRoute);
  const off = table.filter((a) => !a.onRoute);
  const totalOn = onRoute.reduce((n, a) => n + a.items, 0);
  const totalOff = off.reduce((n, a) => n + a.items, 0);

  console.log('\n\x1b[1m═══ UNDER-DETERMINED ITEMS — the answer is not decided by what the learner is shown ═══\x1b[0m\n');
  const line = (a) => `  ${a.onRoute ? '\x1b[31mON ROUTE\x1b[0m' : 'preview '}  `
    + `${a.skill.padEnd(24)} ${String(a.form).padEnd(20)} ${String(a.unit).padEnd(13)} `
    + `${String(a.items).padStart(7)} items  ${a.rule.padEnd(9)} ${[...a.locs].sort().join('/')}`;
  console.log(`            ${'skill'.padEnd(24)} ${'form'.padEnd(20)} ${'unit'.padEnd(13)} ${'items'.padStart(7)}         rule      locales`);
  if (onRoute.length) {
    for (const a of onRoute) console.log(line(a));
  } else console.log('  (nothing on the shipped route)');
  if (off.length) {
    console.log('');
    for (const a of off.slice(0, has('--list') ? off.length : 12)) console.log(line(a));
    if (!has('--list') && off.length > 12) console.log(`            … and ${off.length - 12} more off-route form(s) (--list)`);
  }
  console.log(`\n  \x1b[1m${totalOn} item(s) ON THE SHIPPED ROUTE\x1b[0m across ${onRoute.length} form(s); `
    + `${totalOff} item(s) in preview units across ${off.length} form(s).`);
  console.log('  A defect on the route is in front of a learner today. This gate has found these before and the');
  console.log('  report was not read; the address is at the top now so it cannot be missed again.\n');

  console.log(`FAIL — ${rows.length} distinct finding(s), ${[...byRule.entries()].map(([k, v]) => `${k} ${v}`).join(', ')} items affected:\n`);
  for (const r of (has('--list') ? rows : rows.slice(0, 40))) {
    console.log(`  [${r.rule}${r.cls ? '/' + r.cls : ''} ×${r.count}] ${r.text}`);
  }
  if (!has('--list') && rows.length > 40) console.log(`  … and ${rows.length - 40} more (--list for all)`);
  /* THE LAST LINE, in the shape `npm run check` reads (tools/check-all.mjs).
     It is prose a person can read and a marker the runner can classify, so the
     build's one-line summary can say which red gates are in front of a learner
     without check-all having to guess. */
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The severity rule here
     is HARDER than the collector's floor and stays that way: an under-determined
     item is a card whose answer its own surface cannot justify, and this gate
     has refused those in preview units since it was written. The ledger is a
     floor on severity, never a ceiling, so the preview findings are declared as
     preview — which is what puts them in the build's summary — and this gate
     still returns 1 for them. What the ledger adds is that the ROUTE half can
     no longer be printed under a zero exit code by anybody who edits this
     line. */
  determinacyVerdict(onRoute, off);
  return 1;
}

/**
 * This gate's verdict, as a pure function so it can be planted against.
 *
 * @param {{skill:string, form:string, unit:string, items:number, rule:string}[]} onRoute
 * @param {{skill:string, form:string, unit:string, items:number, rule:string}[]} off
 * @param {Function} [make] `findings` in the build, `sandbox` in a test
 */
export function determinacyVerdict(onRoute, off, make = findings) {
  const F = make('check:determinate', { scope: 'sweep' });
  const say = (a) => `${a.items} item(s) whose answer its own card cannot decide — ${a.skill}/${a.form} `
    + `(${a.unit}, ${a.rule})`;
  F.route(onRoute.map(say));
  F.preview(off.map(say));
  return F.report();
}

// ---------------------------------------------------------------------------
// Self-test: the exact fault this gate exists to catch, planted by hand.
//
// Items built here rather than drawn from the bank, so the cases stay the two
// defects the critic reported even after somebody fixes them — a gate whose
// self-test depends on the bank still being broken stops testing anything the
// moment the bank is fixed.
// ---------------------------------------------------------------------------
function selfTest() {
  let bad = 0;
  const fires = (rule, got, why) => {
    if (!got.some((f) => f.rule === rule)) { console.error(`SELF-TEST FAIL: ${rule} not raised on ${why}`); bad++; }
    else console.log(`  fires  ${rule.padEnd(10)} ${why}`);
  };
  const quiet = (rule, got, why) => {
    if (got.some((f) => f.rule === rule)) {
      console.error(`SELF-TEST FAIL: ${rule} false positive on ${why} — ${JSON.stringify(got.filter((f) => f.rule === rule).map((f) => f.text))}`);
      bad++;
    } else console.log(`  quiet  ${rule.padEnd(10)} ${why}`);
  };
  const I = (o) => ({
    loc: 'en', skill: 'planted', form: 'f1', difficulty: 3, seed: 1,
    stem: '', latex: '', answer: '0', check: {}, figure: null, ...o,
  });

  // 1. COLLISION — the exact card the bank deals today, with both answers.
  //    (Real seeds: parallel-perpendicular d3, pp-upright, seeds 4672603 and
  //    5092310, both printing `x = 5 \quad (-4, -12) => box`.)
  const SAME = 'x = 5 \\quad \\left(-4, -12\\right) \\;\\Rightarrow\\; \\square';
  fires('collision', askFaults([
    I({ stem: 'Write the rule of the line through the marked reading.', latex: SAME, answer: 'x = -4', form: 'pp-upright', seed: 4672603 }),
    I({ stem: 'Write the rule of the line through the marked reading.', latex: SAME, answer: 'y = -12', form: 'pp-upright', seed: 5092310 }),
  ]), 'the same sentence over the same numbers, answered two ways');

  /* THE HONEST TWIN, AND A LESSON THIS SELF-TEST ALREADY TAUGHT ITS AUTHOR.
     The first draft of this case was the SAME stem over the SAME `5c`, with the
     value of `c` only in `check.env` — and the rule fired on it, correctly. Two
     cards that both read "What is the expression worth?" over `5c` and are
     answered 145 and 15 are exactly the defect: the number that decides the
     answer is not on the card. The honest version states it, which is what the
     shipped bank does. */
  quiet('collision', askFaults([
    I({ stem: 'The manifest reads c = 29. What is the expression worth?', latex: '5c', answer: '145', check: { kind: 'evaluate', env: { c: 29 } } }),
    I({ stem: 'The manifest reads c = 3. What is the expression worth?', latex: '5c', answer: '15', check: { kind: 'evaluate', env: { c: 3 } } }),
  ]), 'two honest items that each state the value that decides them');
  fires('collision', askFaults([
    I({ stem: 'What is the expression worth?', latex: '5c', answer: '145', check: { kind: 'evaluate', env: { c: 29 } } }),
    I({ stem: 'What is the expression worth?', latex: '5c', answer: '15', check: { kind: 'evaluate', env: { c: 3 } } }),
  ]), 'the same expression, two values of c, neither of them on the card');

  // 2. AMBIGUOUS — one sentence, one shape, two tasks. The pp defect in full.
  fires('ambiguous', askFaults([
    I({ stem: 'Write the rule of the line through the marked reading.', latex: 'y = 2x + 3 \\quad \\left(4, 5\\right)', answer: 'y = 2x - 3', form: 'pp-beside', check: { kind: 'relatedLine', relation: 'parallel' } }),
    I({ stem: 'Write the rule of the line through the marked reading.', latex: 'y = 7x + 1 \\quad \\left(2, 9\\right)', answer: 'y = -\\frac{1}{7}x + 9', form: 'pp-right', check: { kind: 'relatedLine', relation: 'perpendicular' } }),
  ]), 'parallel and perpendicular asked in the same words');

  quiet('ambiguous', askFaults([
    I({ stem: 'A rail runs beside this line and carries the marked reading. Write the rule.', latex: 'y = 2x + 3 \\quad \\left(4, 5\\right)', check: { kind: 'relatedLine', relation: 'parallel' } }),
    I({ stem: 'A brace crosses this line at a right angle. Write the rule.', latex: 'y = 7x + 1 \\quad \\left(2, 9\\right)', check: { kind: 'relatedLine', relation: 'perpendicular' } }),
  ]), 'the same two tasks, each named by its own sentence');

  quiet('ambiguous', askFaults([
    I({ stem: 'What is the expression worth?', latex: '5c', check: { kind: 'evaluate', env: { c: 29 } } }),
    I({ stem: 'What is the expression worth?', latex: '9c', check: { kind: 'evaluate', env: { c: 3 } } }),
  ]), 'one task, many numbers');

  /* THE FALSE POSITIVE THIS RULE ACTUALLY HAD, kept as a case so it cannot come
     back. `square-root-method` asks "Find every value that works." over
     `n^{2} = 25` and over `n^{2} = -25`. The checker records `want: roots` for
     one and `want: none` for the other — but that is a report of how the answer
     came out, and the minus sign on the card is what decides it. Thirty-six
     determinate items were flagged before `want` was taken out of
     AMBIGUITY_FIELDS. */
  quiet('ambiguous', askFaults([
    I({ stem: 'Find every value that works.', latex: 'n^{2} = 25', answer: 'n = -5, n = 5', form: 'sq-plain', check: { kind: 'quadratic', variable: 'n', want: 'roots', math: 'n^{2} = 25' } }),
    I({ stem: 'Find every value that works.', latex: 'n^{2} = -25', answer: '\\text{no solution}', form: 'sq-none', check: { kind: 'quadratic', variable: 'n', want: 'none', math: 'n^{2} = -25' } }),
  ]), 'one solve whose answer sometimes turns out to be "no value works"');

  // 3. DANGLING — the association-strength defect, in all three languages.
  const TABLE = '\\begin{array}{c|cc|c} {} & P & Q & {} \\\\ \\hline G & 6 & 2 & 8 \\\\ H & 3 & 9 & 12 \\\\ {} & 9 & 11 & 20 \\end{array}';
  for (const [loc, stem] of [
    ['en', 'What share of that row sits in the marked column?'],
    ['es', '¿Qué parte de esa fila cae en la columna marcada?'],
    ['pl', 'Jaka część tego wiersza wypada w zaznaczonej kolumnie?'],
  ]) {
    fires('dangling', referenceFaults(I({ loc, stem, latex: TABLE, figure: null, check: { kind: 'twoWayTable', want: 'conditionalRow' } })),
      `${loc}: "the marked column" over a table with nothing marked`);
  }
  fires('dangling', referenceFaults(I({ stem: 'Read the graph. Where does it cross?', latex: 'y = 2x + 1', figure: null })),
    'a stem that reads a graph the card does not draw');
  fires('dangling', referenceFaults(I({ stem: 'The table gives four readings. Write the rule.', latex: 'y = 2x + 1', figure: null })),
    'a stem that reads a table the card does not print');
  fires('dangling', referenceFaults(I({ stem: 'The diagram shows a hatch. What is the distance round it?', latex: '2x + 6', figure: null })),
    'a stem that reads a diagram the card does not draw');

  quiet('dangling', referenceFaults(I({ stem: 'What share of that row sits in the marked column?', latex: TABLE.replace('6', '\\boxed{6}'), figure: null })),
    'the same stem over a table whose cell is boxed');
  quiet('dangling', referenceFaults(I({ stem: 'Read the graph. Where does it cross?', latex: 'y = 2x + 1', figure: { kind: 'line', m: 2, b: 1 } })),
    'a graph stem over a drawn line');
  quiet('dangling', referenceFaults(I({ stem: 'The table gives four readings. Write the rule.', latex: TABLE, figure: null })),
    'a table stem over a printed table');
  quiet('dangling', referenceFaults(I({ stem: 'Write the rule of the line through the marked reading.', latex: 'y = 2x + 3', figure: { kind: 'plot', mark: [4, 5] } })),
    'a marked-reading stem over a plot that marks the reading');
  quiet('dangling', referenceFaults(I({ stem: 'What is the expression worth when c = 29?', latex: '5c' })),
    'an item that points at nothing');

  /* THE TWO FALSE POSITIVES THIS RULE ACTUALLY HAD, kept as cases.
     Both were found by running the rule over the whole bank and reading every
     finding, which is the only way to know a gate is not lying. */
  quiet('dangling', referenceFaults(I({
    loc: 'es', latex: '36 - 3t',
    stem: 'Un carrete de marcado sale con 36 metros de pintura y pone 3 cada minuto. ¿Qué marca después de 5 minutos?',
  })), 'es: a MARKING reel, which is scenery and not a mark on the card');
  for (const [loc, stem] of [
    ['en', 'Cadet Wren reads an old letter-and-number ledger as a conversion table. The manifest says $b = 11$.'],
    ['es', 'Cadete Wren lee un viejo libro de letras y números como tabla de conversión. El manifiesto dice $b = 11$.'],
    ['pl', 'Kadet Wren czyta stary spis liter i numerów jak tabelę przeliczeń. Manifest mówi: $b = 11$.'],
  ]) {
    quiet('dangling', referenceFaults(I({ loc, stem, latex: '4b' })),
      `${loc}: a ledger read AS a conversion table — a simile, not a table on the card`);
  }
  /* AND THE ONE THE POLISH REGEX USED TO MISS ENTIRELY. `\w` is ASCII, so
     `tabel\w+` never matched "tabelę" and the Polish half of this rule was
     silent. If this case stops firing, Polish has gone dark again. */
  fires('dangling', referenceFaults(I({
    loc: 'pl', latex: 'y = 2x + 1',
    stem: 'Odczytaj tabelę i zapisz regułę.',
  })), 'pl: "tabelę" — the inflected form the ASCII regex could not see');
  fires('dangling', referenceFaults(I({
    loc: 'pl', latex: 'y = 2x + 1',
    stem: 'Jaka część tego wiersza wypada w zaznaczonej kolumnie?',
  })), 'pl: "zaznaczonej kolumnie", inflected, with nothing marked');

  /* 3b. DANGLING / CANDIDATES — the sixteen dispute forms, in three languages.
     The stem offers a choice between two cadets' answers over a card that
     prints neither, and a keypad. Real text: `rs-dispute` d3 over
     `\sqrt{20}`. */
  for (const [loc, stem] of [
    ['en', 'Two cadets at the same console write different answers here. Which answer is right?'],
    ['es', 'Dos cadetes en la misma consola escriben respuestas distintas aquí. ¿Qué respuesta es correcta?'],
    ['pl', 'Dwaj kadeci przy tej samej konsoli piszą tu różne odpowiedzi. Która odpowiedź jest dobra?'],
  ]) {
    fires('dangling', referenceFaults(I({ loc, stem, latex: '\\sqrt{20}', answer: '2\\sqrt{5}' })),
      `${loc}: "which answer is right" over a card that names no answers`);
  }

  /* THE HONEST TWIN, AND IT IS IN THE SHIPPED BANK. Level 1's four disputes
     ask the very same question and print BOTH readings in the sentence, so the
     choice they offer is a real one. If these ever start firing, the rule has
     become a rule against error-analysis items, which is not what it is for. */
  for (const [loc, stem] of [
    ['en', 'Cadet Wren makes it 26. Cadet Vale makes it 40. Both cannot be right. Which reading is the true one?'],
    ['es', 'Cadete Wren obtiene 26. Cadete Vale obtiene 40. No pueden tener razón los dos. ¿Qué lectura es la verdadera?'],
    ['pl', 'Kadet Wren wylicza 26. Kadet Vale wylicza 40. Obaj nie mogą mieć racji. Który odczyt jest prawdziwy?'],
  ]) {
    quiet('dangling', referenceFaults(I({ loc, stem, latex: '4 + 5 \\cdot 6', answer: '34' })),
      `${loc}: the same question with both readings printed in the sentence`);
  }
  quiet('dangling', referenceFaults(I({
    stem: 'Cadet Wren multiplies $3n$ and 5 by 4. Cadet Vale multiplies only $3n$. Which reading is the true one?',
    latex: '4\\left(3n + 5\\right) = 68',
  })), 'en: a dispute whose sentence names the quantities the two cadets worked on');
  quiet('dangling', referenceFaults(I({
    stem: 'Only one of these comes apart. Write that one as a product.', latex: 'x^{2} + 4 \\;\\; x^{2} - 9',
  })), 'en: "only one of these" — a chooser with no candidate noun in it');
  quiet('dangling', referenceFaults(I({
    loc: 'es', stem: '¿Qué valor de $m$ mantiene esto cierto?', latex: '3m + 4 = 19',
  })), 'es: "which value of m" — a solve, not a choice between readings');

  /* THE FALSE POSITIVES THIS CLASS ACTUALLY HAD, kept as cases. The first
     draft asked only for a chooser word within three of a candidate noun, and
     reported roughly five thousand honest items across nineteen skills. Every
     line below is real text from the bank. */
  for (const [loc, stem, latex] of [
    ['es', '¿Cuál es la lectura que falta?', '\\begin{array}{c|c} x & y \\\\ \\hline 1 & 4 \\end{array}'],
    ['es', 'El polvo se posa a ritmo constante, y el registro guarda dos lecturas. ¿Cuál es la tasa por cada paso?', 'y = 3x + 1'],
    ['es', 'Dos cadetes que se revisan no se ponen de acuerdo en esto. ¿Dónde vale cero?', '\\left(z - 3\\right)\\left(z - 1\\right) = 0'],
    ['es', 'Dos cadetes discuten cuál es la recta más cercana. ¿Cuál es la tasa de la recta más cercana?', 'y = 2x + 5'],
    ['pl', 'Która para odczytów spełnia oba zdania naraz?', 'y = 2x + 1'],
    ['pl', 'Dziennik czujnika łączy każde ustawienie z odczytem. Jedno wejście niesie dwa różne wyjścia. Które wejście?', 'y = 2x + 1'],
    ['en', 'A sluice gate opens only while the reading below holds. Which statement gives every value of $n$ that works?', '3n + 4 > 19'],
    ['es', 'Todas las filas tienen la misma razón. ¿Cuál es la lectura que falta?', '\\frac{3}{4} = \\frac{x}{8}'],
  ]) {
    quiet('dangling', referenceFaults(I({ loc, stem, latex })), `${loc}: "${stem.slice(0, 52)}…"`);
  }

  // 4. SELECTOR — the checker reaches for a coordinate the card never states.
  fires('selector', referenceFaults(I({
    stem: 'What share of every reading sits in the cell?', latex: TABLE,
    check: { kind: 'twoWayTable', want: 'joint', row: 1, col: 0 },
  })), 'a checker that picks row 1, column 0 off an unmarked table');
  quiet('selector', referenceFaults(I({
    stem: 'What is the 4th term?', latex: '3, 7, 11, \\ldots',
    check: { kind: 'sequence', want: 'term', at: 4 },
  })), 'a coordinate the sentence states outright');
  quiet('selector', referenceFaults(I({
    stem: 'What share of every reading sits in the marked cell?', latex: TABLE.replace('6', '\\boxed{6}'),
    check: { kind: 'twoWayTable', want: 'joint', row: 0, col: 0 },
  })), 'a coordinate the display marks');

  /* AND THE SEVERITY, WHICH IS WHAT THE REPORT IS FOR. This gate had already
     found its own defect twice and had it re-found by hand, because the report
     did not say which form, in which unit, or whether a learner could be handed
     it. The ledger is what carries that now, so the ledger is planted against. */
  {
    const A = { skill: 'ratio-proportion', form: 'rp-model', unit: 'algebra1-l2', items: 525, rule: 'ambiguous' };
    const B = { skill: 'l4-thing', form: 'x-form', unit: 'algebra1-l4', items: 12, rule: 'dangling' };
    const lines = [];
    const mk = (g, o) => sandbox(g, { ...o, out: (l) => lines.push(l) });
    const onR = determinacyVerdict([A], [B], mk);
    if (onR !== 1) { console.error(`SELF-TEST FAIL: 525 under-determined items ON THE ROUTE did not require a red gate (${onR})`); bad++; }
    else console.log('  ok     525 under-determined items on the shipped route require exit 1, and the ledger says which form and which unit');
    const text = lines.join('\n');
    if (!text.includes('ratio-proportion/rp-model') || !text.includes('algebra1-l2')) { console.error('SELF-TEST FAIL: the ledger dropped the address — which form, in which unit'); bad++; }
    else console.log('  ok     the finding carries its address: ratio-proportion/rp-model (algebra1-l2, ambiguous)');
    if (!text.includes('algebra1-l4')) { console.error('SELF-TEST FAIL: the preview finding was silenced rather than made advisory'); bad++; }
    else console.log('  ok     the preview finding is printed in full beside it, advisory, not silenced');
    if (determinacyVerdict([], [B], mk) !== 0) { console.error('SELF-TEST FAIL: a preview-only ledger required a red gate'); bad++; }
    else console.log('  ok     a preview-only ledger asks for 0 — and this gate still returns 1 for it, because a ledger is a floor on severity and never a ceiling');
    if (determinacyVerdict([], [], mk) !== 0) { console.error('SELF-TEST FAIL: a clean ledger was not clean'); bad++; }
    else console.log('  ok     clean content is clean, which is the half that keeps the gate switched on');
  }

  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('\nself-test: ok — all four rules fire on the planted defect and stay quiet on the honest twin of each');
}

const isMain = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  if (has('--self-test')) selfTest();
  else process.exit(await run());
}
