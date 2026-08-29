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
 * THE SIX RULES
 *
 *   long      a sentence over 25 words                      (both classes)
 *   passive   passive voice                                 (instructional)
 *   pronoun   a sentence opening on a bare it/this/that      (instructional)
 *   cluster   four or more nouns in a row                    (instructional)
 *   term      a coined word used before it is defined        (both classes)
 *   fancy     a long word where a plain one carries it       (both classes)
 *
 * ESCAPE HATCH
 *
 * ALLOW below takes an exact key and a mandatory reason, printed by
 * --list-allows. Exceptions stay a short reviewable list, not a habit.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import {
  isFlavour, rankOf, TERMS, FANCY, PASSIVE, PASSIVE_EXEMPT, PRONOUN_OPENER,
  NOT_NOUN, CLUSTER_EXEMPT, MAX_SENTENCE_WORDS, AIM_SENTENCE_WORDS, MAX_CLUSTER,
  CLUSTER_MODE, PL_GENITIVE, PL_VERBish, PL_ADJ,
} from './lang/rules.mjs';

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
  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('self-test: ok — every rule fires, and none fires on clean text');
}

// ---------------------------------------------------------------------------
const RULE_LABEL = {
  long: 'sentence over 25 words',
  aim: 'sentence over 20 words (instructional)',
  passive: 'passive voice',
  pronoun: 'ambiguous it/this opener',
  cluster: 'noun cluster over three',
  term: 'term used before it is defined',
  'term-def': 'coined term has no definition',
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

  const B = await bundles();
  const locales = ONLY_LOCALE ? [ONLY_LOCALE] : ['en', 'es', 'pl'];
  const report = {};
  let errors = 0;
  for (const loc of locales) {
    report[loc] = runLocale(loc, B[loc]);
    errors += report[loc].findings.filter((f) => !SOFT.has(f.rule)).length;
  }

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
    const order = ['long', 'passive', 'pronoun', 'cluster', 'term', 'term-def', 'fancy', 'aim'];
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

  console.log('');
  if (STATS_ONLY) return;
  if (errors) {
    console.log(`\x1b[31m${errors} finding(s)\x1b[0m — run with --list=<rule> to see them`);
    process.exit(1);
  }
  console.log('\x1b[32mlanguage: clean across en/es/pl\x1b[0m');
}

const invokedDirectly = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
export { checkString, runLocale, normalise, sentences, words };
