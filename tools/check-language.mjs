#!/usr/bin/env node
/**
 * The language gate.
 *
 *   node tools/check-language.mjs               # human report, non-zero on any error
 *   node tools/check-language.mjs --json        # machine report
 *   node tools/check-language.mjs --self-test   # prove the gate can fail
 *   node tools/check-language.mjs --stats       # readability numbers only, always exit 0
 *   node tools/check-language.mjs --list=long   # print every string a rule caught
 *   node tools/check-language.mjs --locale=pl   # one locale
 *
 * WHY THIS EXISTS
 *
 * The client asked for one standard across every word a player reads:
 * ASD-STE100 Simplified Technical English, written for a smart eighteen-year-old,
 * and structured for an attention span that will not read a paragraph.
 *
 * Prose gates usually fail because they treat a game like a manual. This one
 * does not. `tools/lang/rules.mjs` splits every key into INSTRUCTIONAL and
 * FLAVOUR. Instructional text is held to all six rules with no exceptions,
 * because a learner who misreads an instruction loses the lesson. Flavour text —
 * Marlow's asides, the world, the seal beat — is held to short sentences and
 * plain words only, because that is where the game's voice lives and a gate that
 * sands it flat has made the product worse.
 *
 * THE SEVEN RULES
 *
 *   long      a sentence over 25 words                      (both classes)
 *   passive   passive voice                                 (instructional)
 *   pronoun   a sentence opening on a bare it/this/that      (instructional)
 *   cluster   four or more nouns in a row                    (instructional)
 *   term      a coined word used before it is defined        (both classes)
 *   gloss     a coined LABEL with no meaning on its own screen (see rules.mjs)
 *   fancy     a long word where a plain one carries it       (both classes)
 *
 * AND TWO MORE, ON THE ITEM BANK
 *
 * A judge read one of ours: "A rig-repair broadcast from three shards over
 * cheerfully explains that a letter is worth its place in the alphabet, so
 * Cadet Rell writes down 3. The manifest, which is not a broadcast, reads
 * c = 29. What is the expression worth?" Forty words of scenery wrapped round
 * 5c, plus a number — 3 — that the mathematics never touches. A learner with
 * ADHD reads the equation and skips the story, which is the opposite of what
 * the story was for.
 *
 * The bundle rules above never saw it, because an item stem is not a bundle
 * string: it is composed at generation time out of a situation from one file
 * and a question from another. So these two rules generate real items through
 * the real bank, in all three languages, and read what a learner would read.
 *
 *   stem      a composed item stem over 25 words           (all three locales)
 *   decoy     a numeral in a stem that the mathematics never uses
 *
 * `decoy` allows the one honest exception: an item whose whole question is
 * "which of these stated readings is right" prints its candidates in the
 * prose, and the wrong one is a distractor by design. That is recognised by
 * the stem containing the item's own answer — everything else must earn its
 * digits from the latex, the answer, the check environment or the steps.
 *
 * ESCAPE HATCH
 *
 * ALLOW below takes an exact key and a mandatory reason, printed by
 * --list-allows. Exceptions stay a short reviewable list, not a habit.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync, readdirSync, readFileSync, statSync } from 'node:fs';
import {
  isFlavour, rankOf, TERMS, FANCY, PASSIVE, PASSIVE_EXEMPT, PRONOUN_OPENER,
  NOT_NOUN, CLUSTER_EXEMPT, MAX_SENTENCE_WORDS, AIM_SENTENCE_WORDS, MAX_CLUSTER,
  CLUSTER_MODE, PL_GENITIVE, PL_VERBish, PL_ADJ,
  GLOSSED, GLOSS_ALLOW, GLOSS_NAMESPACES, GLOSS_MIN,
} from './lang/rules.mjs';
import { generate, SKILLS } from '../src/learn/generators.js';
import { allUnits, loadUnit } from './_courses.mjs';
import { findings } from './_findings.mjs';

/**
 * EVERY UNIT THE MANIFEST SHIPS, not just the one `generators.js` registers at
 * import. `SKILLS` is a live view over the registry, and with no pack loaded it
 * holds ten skills — so the two item rules below (`stem` and `decoy`) read the
 * Level 1 bank and reported "language: clean across en/es/pl" while saying
 * nothing whatever about the other fifty-two skills the manifest ships. A
 * pack's stems are composed from a pack's own situations and questions, which
 * is exactly where the forty-word sentence lives.
 */
async function loadEveryUnit() {
  for (const { unit } of await allUnits()) await loadUnit(unit);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const JSON_OUT = has('--json');
const STATS_ONLY = has('--stats');
const SELF_TEST = has('--self-test');
const LIST_ALLOWS = has('--list-allows');
const LIST_RULE = opt('list', null);
const ONLY_LOCALE = opt('locale', null);
/**
 * How many seeds per skill and difficulty the item pass draws.
 *
 * 120 is where the whole run still costs under a second and a half and the
 * decks have dealt every framing they hold several times over. It found a
 * Spanish salt-block stem that forty seeds never dealt. Raise it with
 * `--seeds=` when a deck grows.
 */
const STEM_SEEDS = Number(opt('seeds', '120'));

// ---------------------------------------------------------------------------
// Exceptions. Key, then why. Both are required.
// ---------------------------------------------------------------------------
const ALLOW = {
  'meta.description': 'the share-card blurb: read outside the game, before any surface can define anything',
  'report.foot': 'the legal footer a teacher reads once, not a play instruction',
  'report.record.foot': 'same footer on the printable record',
  'report.record.sub': 'the printed record has to say what it is not, in one breath',
  'report.trust.note.reconstructed': 'a data-loss disclosure; splitting it invites a partial read',
  'report.trust.note.foreign': 'a data-loss disclosure; splitting it invites a partial read',
  'report.record.trustNote.reconstructed': 'same disclosure on the printable record',
  'report.record.trustNote.foreign': 'same disclosure on the printable record',
  'report.evidence.noReceiptNote': 'says why an old claim is unevidenced; must not be split into a half-claim',
  'report.record.classEmpty': 'the empty-state that tells a teacher the whole workflow',
  'report.record.classFoot': 'privacy statement, read once',
  'report.record.nameNote': 'privacy statement, read once',
};

// ---------------------------------------------------------------------------
// Reading the bundles
// ---------------------------------------------------------------------------
async function bundles() {
  const out = {};
  for (const loc of ['en', 'es', 'pl']) {
    const url = pathToFileURL(path.join(ROOT, 'src/i18n', `${loc}.js`)).href;
    out[loc] = (await import(url)).default;
  }
  return out;
}

/** Every string in a bundle, as [dottedKey, text] — arrays flatten to key[i]. */
function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push([key, v]);
    else if (Array.isArray(v)) v.forEach((s, i) => { if (typeof s === 'string') out.push([`${key}[${i}]`, s]); });
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}

const baseKey = (k) => k.replace(/\[\d+\]$/, '');

// ---------------------------------------------------------------------------
// Normalising a bundle string into something a rule can read
//
// A raw value carries three things a word counter must not trip over:
// `{name}` interpolations, `«n|one:…|other:…»` plural alternants, and backtick
// spans that are strict-KaTeX source rather than prose. Each collapses to a
// single word, because that is what it is when a player reads the line.
// ---------------------------------------------------------------------------
function normalise(raw) {
  let s = raw;
  // Plural alternants: read the branch a player is most likely to see.
  s = s.replace(/«\s*\w+\s*\|([^»]*)»/g, (m, body) => {
    const parts = body.split('|').map((p) => p.replace(/^\s*\w+\s*:/, '').trim());
    const pick = parts[parts.length - 1] || parts[0] || '';
    return pick.replace(/#/g, '9');
  });
  s = s.replace(/`[^`]*`/g, 'X');          // KaTeX source is one symbol
  // …and so is a `$…$` span. Item prose carries its notation that way, and
  // "$6m + 2$" read as three words is how a 24-word stem measures 26.
  s = s.replace(/\$[^$]*\$/g, 'X');
  s = s.replace(/\{(\w+)\}/g, 'X');        // an interpolated value is one word
  s = s.replace(/ /g, ' ');
  return s.trim();
}

/**
 * Sentences. Full stops, question and exclamation marks, and the interpunct —
 * this bundle uses `·` as a hard separator between independent chunks on HUD
 * strips, and treating one strip as a single 30-word sentence would be a lie.
 */
function sentences(text) {
  return text
    .split(/(?<=[.!?…])\s+|\s*[·•]\s*|\s*—\s+(?=[A-ZÁÉÍÓÚÑÄÖÜŻŹĆĄŚĘŁÓŃ])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function words(text) {
  return text
    .replace(/[—–,;:!?.()"'«»“”‘’…]/g, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
}

function syllablesEn(w) {
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return 0;
  if (s.length <= 3) return 1;
  const m = s.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

/**
 * A noun pile-up, in whichever shape the language builds one.
 *
 * English stacks bare nouns. Spanish and Polish cannot, so they build the same
 * unreadable thing out of `de` links and stacked genitives instead. Testing all
 * three with the English rule is how the first draft of this gate decided that
 * a plain Polish relative clause was a five-noun cluster.
 */
function clusters(loc, sentence) {
  const out = [];
  for (const part of phrases(sentence)) out.push(...clustersInPhrase(loc, part));
  return out;
}

/**
 * A noun cluster is a run of *adjacent* nouns. A comma, a dash or a colon ends
 * the run: "Cited into the Texas Administrative Code, Chapter 111" is two
 * phrases of three, not one pile of four, and the first draft of this gate got
 * that wrong because it stripped the punctuation before it counted.
 */
function phrases(sentence) {
  return sentence.split(/\s*[,;:—–(){}[\]/]\s*|\s+[-]\s+/).filter((p) => p.trim());
}

function clustersInPhrase(loc, sentence) {
  const out = [];
  const ws = words(sentence);
  const bare = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '');

  if (CLUSTER_MODE[loc] === 'nouns') {
    let run = [];
    for (const w of ws.concat([','])) {
      const b = bare(w);
      const isNoun = b.length > 1 && !NOT_NOUN.en.has(b) && !/^\d+$/.test(b) && b !== 'x';
      if (isNoun) run.push(w);
      else {
        if (run.length > MAX_CLUSTER) out.push({ detail: `${run.length} nouns in a row: "${run.join(' ')}"` });
        run = [];
      }
    }
    return out;
  }

  if (CLUSTER_MODE[loc] === 'de-chain') {
    // head de X de Y de Z — four or more links in one breath.
    let chain = [];
    let sinceLink = 99;
    const flush = () => {
      const links = chain.filter((c) => /^del?$/i.test(bare(c))).length;
      if (links >= 3) out.push({ detail: `${links} chained "de" links: "${chain.join(' ')}"` });
    };
    for (const w of ws) {
      const b = bare(w);
      if (b === 'de' || b === 'del') { sinceLink = 0; chain.push(w); continue; }
      if (sinceLink <= 2) { chain.push(w); sinceLink++; continue; }
      flush();
      chain = [w];
      sinceLink = 99;
    }
    flush();
    return out;
  }

  // Polish: four or more stacked genitives with no preposition or verb between.
  let run = [];
  for (const w of ws.concat([','])) {
    const b = bare(w);
    const genitive = b.length >= 5 && PL_GENITIVE.test(b) && !PL_ADJ.test(b)
      && !PL_VERBish.test(b) && !NOT_NOUN.pl.has(b) && !/^\d+$/.test(b);
    if (genitive) run.push(w);
    else {
      if (run.length > MAX_CLUSTER) out.push({ detail: `${run.length} stacked genitives: "${run.join(' ')}"` });
      run = [];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// WHICH KEYS THE GAME ACTUALLY PRINTS
//
// A definition nothing renders is not a definition, it is a note to ourselves.
// `report.stateNote.*` sat in the bundle for months reading like documentation
// and reached a player only as a `title` attribute — invisible on a phone,
// invisible to a keyboard, invisible to everybody. So the gloss rule asks the
// source: does any module ask for this key?
//
// Keys are regularly composed (`t('report.stateNote.' + st)`), so a literal that
// ENDS IN A DOT counts as a claim on everything under it. That is exactly how
// the game reads them, and it is the only way this can be answered statically.
// ---------------------------------------------------------------------------
let _rendered = null;
function renderedKeys() {
  if (_rendered) return _rendered;
  const lits = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(js|mjs)$/.test(name)) continue;
      // The bundles themselves are where the keys are DECLARED. A declaration
      // is not a use, and counting one would make this rule always pass.
      if (/src[\\/]i18n[\\/](en|es|pl)\.js$/.test(p)) continue;
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/['"`]([a-zA-Z][\w-]*(?:\.[\w-]*)+)['"`]/g)) lits.add(m[1]);
    }
  };
  walk(path.join(ROOT, 'src'));
  _rendered = lits;
  return lits;
}

/** Does anything in src/ ask for this key, by name or by prefix? */
function isRendered(key) {
  const lits = renderedKeys();
  if (lits.has(key)) return true;
  for (const l of lits) if (l.endsWith('.') && key.startsWith(l)) return true;
  return false;
}

/**
 * A LABEL THAT COINS A WORD MUST CARRY ITS MEANING ON THE SAME SCREEN.
 *
 * See the long note over GLOSSED in tools/lang/rules.mjs. Four questions, and
 * a namespace guard so a new label cannot be added without answering them.
 */
function checkGlosses(loc, byKey) {
  const out = [];
  const bad = (key, detail, sample = '') =>
    out.push({ rule: 'gloss', loc, key, flavour: false, detail, sample });

  const labelled = new Set(GLOSSED.map((g) => g.label));
  for (const g of GLOSSED) {
    const label = byKey.get(g.label);
    if (label === undefined) { bad(g.label, 'the label this gloss is for does not exist'); continue; }
    const gloss = byKey.get(g.gloss);
    if (gloss === undefined) {
      bad(g.label, `"${normalise(label)}" is printed with no gloss — add ${g.gloss}`);
      continue;
    }
    if (g.gloss === g.label) { bad(g.label, 'a label cannot be its own gloss'); continue; }
    const n = words(normalise(gloss)).length;
    const min = g.min || GLOSS_MIN;
    if (n < min) {
      bad(g.label, `the gloss for "${normalise(label)}" is ${n} words, which is a synonym and not a meaning (needs ${min})`,
        normalise(gloss).slice(0, 90));
    }
    const lr = rankOf(baseKey(g.label));
    const gr = rankOf(baseKey(g.gloss));
    if (gr > lr) {
      bad(g.label, `"${normalise(label)}" is printed at surface rank ${lr}; its meaning does not arrive until rank ${gr} (${g.gloss})`);
    }
    // …and the one that has teeth.
    if (!isRendered(g.gloss)) {
      bad(g.label, `${g.gloss} is never rendered by anything in src/ — a gloss nothing prints is not a definition`);
    }
  }

  // THE GUARD. Every key under a guarded namespace has to be answered for.
  for (const key of byKey.keys()) {
    const base = baseKey(key);
    if (!GLOSS_NAMESPACES.some((ns) => base.startsWith(ns))) continue;
    if (labelled.has(base) || GLOSS_ALLOW[base]) continue;
    bad(base, 'a new player-facing label in a guarded namespace: give it a gloss in GLOSSED, '
      + 'or a written reason in GLOSS_ALLOW', normalise(byKey.get(key)).slice(0, 90));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------
function checkString(loc, key, raw, ctx) {
  const found = [];
  const flavour = isFlavour(baseKey(key));
  const allowed = ALLOW[baseKey(key)];
  const text = normalise(raw);
  if (!text) return found;

  const add = (rule, detail, sample) => {
    if (allowed) return;
    found.push({ rule, loc, key, flavour, detail, sample: sample || text.slice(0, 90) });
  };

  const sents = sentences(text);

  // -- long ---------------------------------------------------------------
  for (const s of sents) {
    const n = words(s).length;
    ctx.sentences.push(n);
    if (n > MAX_SENTENCE_WORDS) add('long', `${n} words in one sentence (cap ${MAX_SENTENCE_WORDS})`, s);
    else if (n > AIM_SENTENCE_WORDS && !flavour) add('aim', `${n} words (aim under ${AIM_SENTENCE_WORDS})`, s);
  }

  // -- passive ------------------------------------------------------------
  if (!flavour) {
    for (const s of sents) {
      if (PASSIVE_EXEMPT[loc]?.test(s)) continue;
      const hit = s.match(PASSIVE[loc]);
      if (hit) add('passive', `passive voice: "${hit[0]}"`, s);
    }
  }

  // -- pronoun ------------------------------------------------------------
  if (!flavour) {
    sents.forEach((s, i) => {
      const hit = s.match(PRONOUN_OPENER[loc]);
      // A string's own first sentence may point at the thing on screen beside
      // it; a later one can only be pointing at the sentence before it.
      if (hit && i > 0) add('pronoun', `sentence opens on a bare "${hit[0]}"`, s);
    });
  }

  // -- cluster ------------------------------------------------------------
  if (!flavour && !CLUSTER_EXEMPT.some((r) => r.test(text))) {
    for (const s of sents) for (const hit of clusters(loc, s)) add('cluster', hit.detail, s);
  }

  // -- fancy --------------------------------------------------------------
  for (const [bad, good] of Object.entries(FANCY[loc])) {
    const re = new RegExp(`(^|[^\\p{L}])${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
    if (re.test(text)) add('fancy', `"${bad}" — say "${good}"`);
  }

  // -- term before definition ---------------------------------------------
  const myRank = rankOf(baseKey(key));
  for (const term of TERMS) {
    const re = term[loc];
    if (!re || !re.test(text)) continue;
    const defRank = ctx.termRank[term.id];
    if (defRank === undefined) continue;
    if (myRank < defRank) {
      add('term', `uses "${term.id}" at surface rank ${myRank}; it is defined at rank ${defRank} (${term.def})`);
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------
function runLocale(loc, bundle) {
  const entries = flatten(bundle);
  const byKey = new Map(entries.map(([k, v]) => [k, v]));
  const ctx = { sentences: [], termRank: {} };

  // Every coined term must have a home, and the home must contain the word.
  const structural = [];
  for (const term of TERMS) {
    const def = byKey.get(term.def);
    if (def === undefined) {
      structural.push({ rule: 'term-def', loc, key: term.def, flavour: false,
        detail: `"${term.id}" has no defining key — add ${term.def}`, sample: '' });
      continue;
    }
    // A definition has to do two things: say the word, and say enough about it
    // to be a definition. A three-word button that happens to contain the term
    // is not where a learner learns it.
    if (term[loc] && !term[loc].test(normalise(def))) {
      structural.push({ rule: 'term-def', loc, key: term.def, flavour: false,
        detail: `the defining key for "${term.id}" does not contain the word`, sample: normalise(def).slice(0, 90) });
    } else if (words(normalise(def)).length < (term.min || 12)) {
      structural.push({ rule: 'term-def', loc, key: term.def, flavour: false,
        detail: `the defining key for "${term.id}" is too short to define it (${words(normalise(def)).length} words, needs ${term.min || 12})`,
        sample: normalise(def).slice(0, 90) });
    }
    ctx.termRank[term.id] = rankOf(term.def);
  }

  structural.push(...checkGlosses(loc, byKey));

  const findings = structural.slice();
  for (const [key, raw] of entries) findings.push(...checkString(loc, key, raw, ctx));

  // readability
  const sl = ctx.sentences.filter((n) => n > 0).sort((a, b) => a - b);
  const total = sl.length;
  const sum = sl.reduce((a, b) => a + b, 0);
  const allWords = entries.flatMap(([, v]) => words(normalise(v)));
  // The ADHD number. A label is not the problem; a block is. Count only the
  // strings that are actually prose, and say how big the biggest blocks are.
  const proseLens = entries.map(([, v]) => words(normalise(v)).length).filter((n) => n >= 12).sort((a, b) => a - b);
  const walls = proseLens.filter((n) => n > 40).length;
  const stats = {
    strings: entries.length,
    sentences: total,
    words: allWords.length,
    meanSentence: total ? +(sum / total).toFixed(1) : 0,
    p95Sentence: total ? sl[Math.min(total - 1, Math.floor(total * 0.95))] : 0,
    maxSentence: total ? sl[total - 1] : 0,
    over25: total ? +((sl.filter((n) => n > 25).length / total) * 100).toFixed(1) : 0,
    over20: total ? +((sl.filter((n) => n > 20).length / total) * 100).toFixed(1) : 0,
    proseStrings: proseLens.length,
    meanProse: proseLens.length ? +(proseLens.reduce((a, b) => a + b, 0) / proseLens.length).toFixed(1) : 0,
    p95Prose: proseLens.length ? proseLens[Math.min(proseLens.length - 1, Math.floor(proseLens.length * 0.95))] : 0,
    maxProse: proseLens.length ? proseLens[proseLens.length - 1] : 0,
    walls,
  };
  if (loc === 'en' && total) {
    const syl = allWords.reduce((a, w) => a + syllablesEn(w), 0);
    stats.flesch = +(206.835 - 1.015 * (allWords.length / total) - 84.6 * (syl / allWords.length)).toFixed(1);
    stats.grade = +(0.39 * (allWords.length / total) + 11.8 * (syl / allWords.length) - 15.59).toFixed(1);
  }
  return { findings, stats };
}

// ---------------------------------------------------------------------------
// THE ITEM BANK
//
// Everything above reads strings out of a bundle. An item stem is not one: it
// is welded together at generation time from a situation in
// content/lang/items.*.js and a question from the same file, and neither half
// is long on its own. The forty-word broadcast in the header was two
// perfectly innocent keys.
//
// So this pass generates real items through the real generator, in all three
// languages, at fixed seeds, and reads exactly what a learner would read.
// ---------------------------------------------------------------------------

/** The cap on a whole composed stem, situation and question together. */
export const MAX_STEM_WORDS = 25;

/**
 * Every numeral the mathematics of an item actually uses.
 *
 * The notation, the answer, the substitution environment, the worked steps and
 * any table or trace the surface draws. Deliberately NOT the distractors: a
 * wrong value is allowed to be an option, and putting it in the prose as well
 * is the defect this rule exists to catch.
 */
/**
 * THE OTHER END OF A STATED RANGE.
 *
 * A correction to the `decoy` rule, with the evidence for it, because a gate is
 * not allowed to be softened without one.
 *
 * `domain-range/dr-bottom` prints
 *
 *     "The inputs are the whole numbers from 1 to 5. What is the smallest
 *      output?"     over    f(n) = 2n + 3
 *
 * The arithmetic uses 1. The 5 is in no latex, no step, no answer and no check
 * environment, so `mathsNumerals` did not have it and the rule called it "a
 * numeral the mathematics never uses". It is the top of the stated domain. The
 * sibling form `dr-top` prints the SAME sentence and asks for the largest
 * output, and its answer is f(5) — a numeral that decides the answer of the
 * sibling ask on the same sentence is not scenery, and without it "the smallest
 * output" is a question about an unbounded set. Four forms, 231 findings across
 * three locales, every one of them wrong; the rule had never seen them because
 * it only ever read the ten Level 1 skills.
 *
 * The carve-out is deliberately narrow. Both numerals must be the two ends of a
 * range the prose states outright, and the OTHER end must be one the
 * mathematics really does use. Two numerals the mathematics ignores are still
 * two decoys, however they are punctuated — the self-test holds that line.
 */
const RANGES = [
  /(-?\d+)\s+to\s+(-?\d+)/gi,          // en: "from 1 to 5", "between 1 and 5"
  /(-?\d+)\s+and\s+(-?\d+)/gi,
  /(-?\d+)\s+a\s+(-?\d+)/gi,           // es: "de 1 a 5"
  /(-?\d+)\s+y\s+(-?\d+)/gi,
  /(-?\d+)\s+do\s+(-?\d+)/gi,          // pl: "od 1 do 5"
];
function rangePartners(stem, maths) {
  const out = new Set();
  for (const re of RANGES) {
    re.lastIndex = 0;
    for (const m of String(stem).matchAll(re)) {
      const a = m[1].replace('-', '');
      const b = m[2].replace('-', '');
      if (maths.has(a) && !maths.has(b)) out.add(b);
      if (maths.has(b) && !maths.has(a)) out.add(a);
    }
  }
  return out;
}

function mathsNumerals(item) {
  const parts = [item.latex, item.answer, item.check, item.steps, item.table,
    item.rows, item.graph, item.trace, item.given, item.state];
  const nums = new Set();
  for (const p of parts) {
    if (p == null) continue;
    const text = typeof p === 'string' ? p : JSON.stringify(p);
    for (const n of text.match(/\d+/g) || []) nums.add(n);
  }
  return nums;
}

/**
 * The values the item offers as wrong answers.
 *
 * A finalised item names them `value`; a form under construction writes `v`.
 * Reading only one of the two is how this rule spent its first run reporting
 * every honest "which reading is right" item in the bank.
 */
function distractorNumerals(item) {
  const nums = new Set();
  for (const list of [item.distractors, item.diagnostics]) {
    for (const d of list || []) {
      for (const n of String(d?.value ?? d?.v ?? d).match(/\d+/g) || []) nums.add(n);
    }
  }
  return nums;
}

/**
 * One item, read as prose.
 * @returns {Array<{rule:string, detail:string, sample:string}>}
 */
export function checkItem(item) {
  const found = [];
  const stem = String(item.stem || '');
  if (!stem) return found;

  const n = words(normalise(stem)).length;
  if (n > MAX_STEM_WORDS) {
    found.push({
      rule: 'stem',
      detail: `${n} words in one item stem (cap ${MAX_STEM_WORDS})`,
      sample: stem,
    });
  }

  // A stem that QUOTES READINGS is asking the learner to weigh them, and those
  // readings are the question, so their numerals are allowed in the prose.
  //
  // WHICH ITEMS THOSE ARE USED TO BE INFERRED, AND THE INFERENCE WAS THE WRONG
  // ONE. The test was "does the stem print the item's own answer" — which is
  // true of a dispute card only because it was handing the answer over, and
  // `src/learn/generators.js` no longer does that on a free keypad: a surface
  // with no option set has no baseline but zero, so a sentence that prints the
  // answer is a card a cadet seals by typing what they just read. 171 route
  // cards did. The moment that stopped, every one of those stems became two
  // numerals "the mathematics never uses" and this rule fired on all of them.
  //
  // So the item now SAYS what its sentence quotes (`item.quoted`), and that is
  // read here. The older inference is kept beside it, because the dispute forms
  // in the preview units still print the answer and this rule is not the gate
  // that should be telling them so — `npm run check:shape` is, and it does, on
  // the free-keypad line of its report.
  const maths = mathsNumerals(item);
  const answer = String(item.answer ?? '');
  const statesAnswer = answer !== ''
    && new RegExp(`(?<!\\d)${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`).test(stem);
  const quoted = new Set();
  for (const q of item.quoted || []) for (const n of String(q).match(/\d+/g) || []) quoted.add(n);
  const allowed = statesAnswer
    ? new Set([...maths, ...distractorNumerals(item), ...quoted])
    : new Set([...maths, ...quoted]);
  const spare = rangePartners(stem, allowed);

  for (const num of stem.match(/\d+/g) || []) {
    if (allowed.has(num) || spare.has(num)) continue;
    found.push({
      rule: 'decoy',
      detail: `the stem says "${num}", and the mathematics never uses it`,
      sample: stem,
    });
    break;      // one report per stem; the fix is the same string either way
  }
  return found;
}

/**
 * Walk the bank. Deterministic: fixed seeds, every skill, every band.
 * @returns {{findings:object[], stats:object}}
 */
function runItems(locales) {
  const findings = [];
  const seen = new Set();
  let items = 0;
  const lens = [];
  const scenes = new Set();
  for (const loc of locales) {
    for (const skill of SKILLS) {
      for (let d = 1; d <= 5; d++) {
        for (let i = 0; i < STEM_SEEDS; i++) {
          let item;
          try { item = generate(skill, d, i * 7919 + d * 104729, { locale: loc }); } catch { continue; }
          if (!item?.stem) continue;
          items += 1;
          lens.push(words(normalise(String(item.stem))).length);
          if (item.scene) scenes.add(item.scene);
          for (const f of checkItem(item)) {
            // One report per (locale, rule, situation). A deck deals the same
            // situation with fresh numbers hundreds of times, and printing it
            // hundreds of times is how a reviewer stops reading the report.
            const id = `${loc}|${f.rule}|${skill}|${f.sample.slice(0, 48)}`;
            if (seen.has(id)) continue;
            seen.add(id);
            findings.push({ ...f, loc, key: `item:${skill}`, flavour: false });
          }
        }
      }
    }
  }
  lens.sort((a, b) => a - b);
  const at = (p) => (lens.length ? lens[Math.min(lens.length - 1, Math.floor(lens.length * p))] : 0);
  return {
    findings,
    stats: {
      items,
      scenes: scenes.size,
      meanStem: lens.length ? +(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1) : 0,
      p95Stem: at(0.95),
      maxStem: lens.length ? lens[lens.length - 1] : 0,
      over25: lens.length ? +((lens.filter((x) => x > MAX_STEM_WORDS).length / lens.length) * 100).toFixed(1) : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Self-test: a gate nobody has watched fail is a gate nobody should trust.
// ---------------------------------------------------------------------------
function selfTest() {
  const cases = [
    ['long', 'en', 'a.b', 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix.'],
    ['passive', 'en', 'a.b', 'The rift was sealed by the cadet.'],
    ['passive', 'es', 'a.b', 'La grieta fue sellada por el cadete.'],
    ['passive', 'pl', 'a.b', 'Wyrwa została zamknięta przez kadeta.'],
    ['pronoun', 'en', 'a.b', 'Press E to open the rift. It closes the hole.'],
    ['pronoun', 'es', 'a.b', 'Pulsa E para abrir. Eso cierra el agujero.'],
    ['pronoun', 'pl', 'a.b', 'Naciśnij E. To zamyka dziurę.'],
    ['cluster', 'en', 'a.b', 'Watch the rift surge pressure ring warning.'],
    ['cluster', 'es', 'a.b', 'Mira el anillo de presión de la red del fragmento del cadete.'],
    ['cluster', 'pl', 'a.b', 'Zobacz raport kontroli jakości produkcji sieci.'],
    ['fancy', 'en', 'a.b', 'Utilise the beam to balance both sides.'],
    ['term', 'en', 'boot.tip', 'Seal the rift.'],
  ];
  const ctx = { sentences: [], termRank: { rift: 3 } };
  let bad = 0;
  for (const [rule, loc, key, text] of cases) {
    const hits = checkString(loc, key, text, ctx).map((f) => f.rule);
    if (!hits.includes(rule)) { console.error(`SELF-TEST FAIL: ${loc} ${rule} not raised on: ${text}`); bad++; }
  }
  // and it must stay quiet on clean text
  const clean = [
    ['en', 'learn.prompt', 'Type the value that makes the statement true. Then press Seal.'],
    ['es', 'learn.prompt', 'Escribe el valor que hace verdadera la frase. Luego pulsa Sellar.'],
    ['pl', 'learn.prompt', 'Wpisz wartość, która czyni zdanie prawdziwym. Potem naciśnij Zamknij.'],
  ];
  for (const [loc, key, text] of clean) {
    const hits = checkString(loc, key, text, ctx);
    if (hits.length) { console.error(`SELF-TEST FAIL: ${loc} false positive on clean text: ${JSON.stringify(hits)}`); bad++; }
  }
  /* THE GLOSS RULE, IN ALL FIVE OF THE WAYS IT HAS TO BE ABLE TO FAIL.
   *
   * A gate that cannot be watched failing is a gate nobody should trust, and
   * this one exists because the previous version of it passed a screen on which
   * SLIPPING, PROVING and TESTED OUT were all undefined. Each case below is one
   * of those defects, minimised. `report.state.provisional` is used as the
   * label under test because it is the exact row the critic photographed. */
  const gloss = (map, want, why) => {
    const hits = checkGlosses('en', new Map(Object.entries(map)));
    const got = hits.filter((h) => h.key === want);
    if (!got.length) { console.error(`SELF-TEST FAIL: gloss rule silent on ${why}`); bad++; }
  };
  const BASE = {
    'report.state.provisional': 'Slipping',
    'report.stateNote.provisional': 'One re-test missed. Miss the next and the claim is withdrawn.',
  };
  gloss({ 'report.state.provisional': 'Slipping' },
    'report.state.provisional', 'a label with no gloss key at all');
  gloss({ ...BASE, 'report.stateNote.provisional': 'It slipped.' },
    'report.state.provisional', 'a gloss too short to be a meaning');
  // A brand-new label in a guarded namespace, with nobody having answered for it.
  gloss({ ...BASE, 'report.state.wobbling': 'Wobbling' },
    'report.state.wobbling', 'an unanswered new label in a guarded namespace');
  /* …and the one with teeth: a gloss that exists, reads well, sits at the right
     rank, and is rendered by nothing. That is what `report.stateNote.*` was
     before the legend — a definition written for a `title` attribute, which is
     to say for nobody. Checked through the rule rather than through
     `isRendered` alone, because the composed-key case (`t('report.state.' + st)`)
     means a prefix literal in the source is a genuine claim on the whole
     namespace, and only a namespace nothing asks for can prove the negative. */
  const NOWHERE = {
    'report.state.provisional': 'Slipping',
    'report.glossNobodyPrints.provisional': 'One re-test missed. Miss the next and the claim is withdrawn.',
  };
  const saved = GLOSSED.find((g) => g.label === 'report.state.provisional').gloss;
  GLOSSED.find((g) => g.label === 'report.state.provisional').gloss = 'report.glossNobodyPrints.provisional';
  gloss(NOWHERE, 'report.state.provisional', 'a gloss no module in src/ renders');
  GLOSSED.find((g) => g.label === 'report.state.provisional').gloss = saved;
  if (!isRendered('report.stateNote.provisional')) {
    console.error('SELF-TEST FAIL: isRendered() says no to a key the report prints');
    bad++;
  }
  // The clean case must stay quiet.
  if (checkGlosses('en', new Map(Object.entries(BASE)))
    .some((h) => h.key === 'report.state.provisional')) {
    console.error('SELF-TEST FAIL: gloss rule false positive on a properly glossed label');
    bad++;
  }

  // …and the two item rules, on items built by hand so the case is exactly
  // the defect a judge reported rather than whatever the bank happens to deal.
  const ITEMS = [
    ['stem', {
      stem: 'A rig-repair broadcast from three shards over cheerfully explains that a letter is worth '
        + 'its place in the alphabet, so Cadet Rell writes down 3. The manifest, which is not a '
        + 'broadcast, reads c = 29. What is the expression worth?',
      latex: '5c', answer: '145', check: { env: { c: 29 } }, distractors: [{ v: '15' }],
    }],
    ['decoy', {
      stem: 'Cadet Rell writes down 3. The manifest reads c = 29. What is the expression worth?',
      latex: '5c', answer: '145', check: { env: { c: 29 } }, distractors: [{ v: '15' }],
    }],
  ];
  for (const [rule, item] of ITEMS) {
    const hits = checkItem(item).map((f) => f.rule);
    if (!hits.includes(rule)) { console.error(`SELF-TEST FAIL: item rule ${rule} not raised on: ${item.stem}`); bad++; }
  }
  // A short stem whose every numeral is load-bearing must pass…
  const CLEAN_ITEM = {
    stem: 'A drop-pod takes 5 cadets. 4 pods empty the bay. How many cadets is that?',
    latex: '4 \\cdot 5', answer: '20', check: { env: {} }, distractors: [{ v: '9' }],
  };
  if (checkItem(CLEAN_ITEM).length) {
    console.error(`SELF-TEST FAIL: item false positive: ${JSON.stringify(checkItem(CLEAN_ITEM))}`); bad++;
  }
  // …and so must a "which reading is right" item, whose stated candidates are
  // the question itself rather than smuggled scenery.
  const CHOICE_ITEM = {
    stem: 'Cadet Iro makes it 23. Cadet Ashe makes it 32. Which reading is true?',
    latex: '3 + 5 \\cdot 4', answer: '23', check: {}, distractors: [{ v: '32' }],
  };
  /* …and the stated range, in all three languages. The far end of a domain is
     the reason the question has an answer; see `rangePartners`. */
  for (const stem of [
    'The inputs are the whole numbers from 1 to 5. What is the smallest output?',
    'Las entradas son los números enteros de 1 a 5. ¿Cuál es la salida más pequeña?',
    'Wejścia to liczby całkowite od 1 do 5. Jakie jest najmniejsze wyjście?',
  ]) {
    const RANGE_ITEM = { stem, latex: 'f(n) = 2n + 3', answer: '5', check: { kind: 'evaluate', math: '2n + 3', env: { n: 1 } }, distractors: [] };
    if (checkItem(RANGE_ITEM).some((f) => f.rule === 'decoy')) {
      console.error(`SELF-TEST FAIL: the far end of a stated domain was called a decoy: ${stem}`); bad++;
    }
  }
  /* AND THE LINE THAT MUST NOT MOVE: two numerals the mathematics ignores are
     two decoys, however they are punctuated. If this stops firing, the carve-out
     above has been widened into a hole. */
  const FAKE_RANGE = {
    stem: 'Cadet Rell counts crates from 7 to 9. The manifest says c = 29. What is the expression worth?',
    latex: '5c', answer: '145', check: { env: { c: 29 } }, distractors: [{ v: '15' }],
  };
  if (!checkItem(FAKE_RANGE).some((f) => f.rule === 'decoy')) {
    console.error('SELF-TEST FAIL: a range whose BOTH ends are scenery went through as a range'); bad++;
  }
  if (checkItem(CHOICE_ITEM).length) {
    console.error(`SELF-TEST FAIL: stated-candidate item flagged: ${JSON.stringify(checkItem(CHOICE_ITEM))}`); bad++;
  }
  /* THE READINGS A CARD QUOTES ARE THE QUESTION — and nothing else is. The
     first of these declares the two numerals its sentence quotes and must pass
     even though neither of them is the answer; the second prints the same two
     numerals and declares nothing, and must still be refused, or the carve-out
     has become a hole anyone can walk through by putting a number in a stem. */
  const QUOTED_ITEM = {
    stem: 'Cadet Iro makes it 23. Cadet Ashe makes it 32. Work out the value.',
    latex: '3 + 5 \\cdot 4', answer: '19', check: {}, distractors: [{ v: '32' }],
    quoted: ['23', '32'],
  };
  if (checkItem(QUOTED_ITEM).some((f) => f.rule === 'decoy')) {
    console.error(`SELF-TEST FAIL: a card that DECLARES the two readings it quotes was called a decoy: ${JSON.stringify(checkItem(QUOTED_ITEM))}`); bad++;
  }
  if (!checkItem({ ...QUOTED_ITEM, quoted: undefined }).some((f) => f.rule === 'decoy')) {
    console.error('SELF-TEST FAIL: the same two numerals with nothing declared went through as scenery'); bad++;
  }
  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('self-test: ok — every rule fires, and none fires on clean text or a clean item');
}

// ---------------------------------------------------------------------------
const RULE_LABEL = {
  stem: 'item stem over 25 words',
  decoy: 'a numeral in a stem the mathematics never uses',
  long: 'sentence over 25 words',
  aim: 'sentence over 20 words (instructional)',
  passive: 'passive voice',
  pronoun: 'ambiguous it/this opener',
  cluster: 'noun cluster over three',
  term: 'term used before it is defined',
  'term-def': 'coined term has no definition',
  gloss: 'a coined label with no meaning on its own screen',
  fancy: 'a plainer word exists',
};
/** `aim` is advice, not a gate. Everything else fails the build. */
const SOFT = new Set(['aim']);

async function main() {
  if (LIST_ALLOWS) {
    for (const [k, why] of Object.entries(ALLOW)) console.log(`${k.padEnd(38)} ${why}`);
    return;
  }
  if (SELF_TEST) return selfTest();

  await loadEveryUnit();
  const B = await bundles();
  const locales = ONLY_LOCALE ? [ONLY_LOCALE] : ['en', 'es', 'pl'];
  const report = {};
  let errors = 0;
  for (const loc of locales) {
    report[loc] = runLocale(loc, B[loc]);
    errors += report[loc].findings.filter((f) => !SOFT.has(f.rule)).length;
  }
  // The bank. Its findings are filed under the locale they were read in, so
  // --list and --json behave exactly as they do for a bundle string.
  const bank = runItems(locales);
  for (const f of bank.findings) report[f.loc]?.findings.push(f);
  errors += bank.findings.length;

  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: errors === 0, errors, report }, null, 2));
    return process.exit(STATS_ONLY ? 0 : (errors ? 1 : 0));
  }

  for (const loc of locales) {
    const { findings, stats } = report[loc];
    const hard = findings.filter((f) => !SOFT.has(f.rule));
    console.log(`\n\x1b[1m${loc.toUpperCase()}\x1b[0m  ${stats.strings} strings · ${stats.words} words · ${stats.sentences} sentences`);
    console.log(`  mean sentence ${stats.meanSentence} words · p95 ${stats.p95Sentence} · longest ${stats.maxSentence}`);
    console.log(`  over 25 words: ${stats.over25}%   over 20 words: ${stats.over20}%` +
      (stats.flesch !== undefined ? `   Flesch ${stats.flesch} (grade ${stats.grade})` : ''));
    console.log(`  prose blocks (12+ words): ${stats.proseStrings} · mean ${stats.meanProse} words · p95 ${stats.p95Prose} · longest ${stats.maxProse} · walls over 40 words: ${stats.walls}`);
    const counts = {};
    for (const f of findings) counts[f.rule] = (counts[f.rule] || 0) + 1;
    const order = ['stem', 'decoy', 'long', 'passive', 'pronoun', 'cluster', 'term', 'term-def', 'gloss', 'fancy', 'aim'];
    for (const r of order) {
      if (!counts[r]) continue;
      const mark = SOFT.has(r) ? '\x1b[33m·\x1b[0m' : (counts[r] ? '\x1b[31m✗\x1b[0m' : ' ');
      console.log(`  ${mark} ${String(counts[r]).padStart(4)}  ${RULE_LABEL[r]}`);
    }
    if (!hard.length) console.log('  \x1b[32m✓\x1b[0m  clean');
    if (LIST_RULE) {
      for (const f of findings.filter((x) => x.rule === LIST_RULE)) {
        console.log(`    ${f.key}${f.flavour ? ' (flavour)' : ''}\n      ${f.detail}\n      ${f.sample}`);
      }
    }
  }

  console.log(`\n\x1b[1mITEM BANK\x1b[0m  ${bank.stats.items} real items generated across ${locales.join('/')} · ${bank.stats.scenes} situations dealt`);
  console.log(`  mean stem ${bank.stats.meanStem} words · p95 ${bank.stats.p95Stem} · longest ${bank.stats.maxStem} · over ${MAX_STEM_WORDS}: ${bank.stats.over25}%`);

  console.log('');
  if (STATS_ONLY) return;
  if (!errors) console.log(`\x1b[32mlanguage: clean across ${locales.join('/')}\x1b[0m`);
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This sweeps the
     bundles and real composed stems in every unit, and the bundles are shared,
     so a sentence a learner cannot read is one a learner meets. */
  const F = findings('check:lang', { scope: 'sweep' });
  if (errors) F.route(`${errors} ASD-STE100 / ELI18 finding(s) across ${locales.join('/')} — run with --list=<rule> to see them`);
  F.done();
}

const invokedDirectly = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
export { checkString, runLocale, normalise, sentences, words };
