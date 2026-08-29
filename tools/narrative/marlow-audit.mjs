#!/usr/bin/env node
/**
 * The Marlow gate.
 *
 *   node tools/narrative/marlow-audit.mjs           # human report, non-zero on any finding
 *   node tools/narrative/marlow-audit.mjs --json
 *   node tools/narrative/marlow-audit.mjs --lines   # just the per-bank line census
 *
 * Three things went wrong with the companion channel, and each one gets a check
 * that would have caught it before a critic did.
 *
 *  1. A TUTORIAL LINE REACHED A SOVEREIGN. At a hundred and thirty seals, top
 *     rank, every chapter open, Marlow still said "That tear ahead of you is a
 *     rift. Walk into it and the rig throws the statement onto your visor."
 *     The beat was gated on whether the *save* remembered saying it, so any
 *     state the save had not authored replayed the tutorial at the top of the
 *     ladder.
 *     → REACH check sweeps the whole state space through the real `canTutor()`
 *       and asserts it is true in exactly one place: a cadet who has sealed
 *       nothing, holds nothing, ranks nothing and has turned no chapter.
 *     → GUARD check reads `src/meta/index.js` and asserts every tutorial key
 *       literal in it sits behind that predicate, so a future edit cannot
 *       reintroduce a second, ungated path.
 *     → RATCHET check asserts the register never decreases as evidence grows,
 *       which is what stops a demoted line or a re-derived standing from
 *       putting Marlow back into explaining mode.
 *
 *  2. HE RAN DRY. Past the last chapter beat at twenty-eight seals there was
 *     one line per ambient event for the rest of the save.
 *     → CENSUS reports lines per bank per register and fails any bank that has
 *       fewer than two alternatives in a register a real player will spend
 *       hours inside.
 *
 *  3. POLISH ADDRESSED EVERY GIRL IN THE CLASS AS A BOY. Polish marks the sex
 *     of the person spoken to in three places — past tense (`zamknąłeś`), the
 *     conditional (`wyczułbyś`) and predicative adjectives (`jesteś gotowy`) —
 *     and English has no such marking to translate from, so it goes wrong
 *     silently and stays wrong.
 *     → GENDER check flags second-person gendered morphology in Polish and
 *       masculine-agreeing address in Spanish, across Marlow's whole script.
 *       Marlow's own first-person feminine forms (`przestałam`, `powiedziałabym`,
 *       `segura`) are hers by design and are not flagged: the rule is scoped to
 *       *second* person, which is the only person the player is.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findings as ledger } from '../_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JSON_OUT = process.argv.includes('--json');
const LINES_ONLY = process.argv.includes('--lines');

const load = async (f) => (await import(pathToFileURL(path.join(ROOT, 'src/i18n', f)).href)).default;
const voice = await import(pathToFileURL(path.join(ROOT, 'src/meta/voice.js')).href);
const { STAGES, REGISTERS, BANKS, MILESTONES, stageIndex, registerFor, canTutor, bankKey, milestoneKey } = voice;

const BUNDLES = { en: await load('en.js'), es: await load('es.js'), pl: await load('pl.js') };
const LOCALES = Object.keys(BUNDLES);

const findings = [];
const fail = (rule, detail) => findings.push({ rule, detail });

const at = (o, key) => key.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);

// ---------------------------------------------------------------------------
// 1. REACH — where a tutorial line is permitted to exist at all
// ---------------------------------------------------------------------------
const TUTORIAL_KEYS = ['story.voice.firstRift', 'story.voice.firstSeal', 'story.voice.standard'];

let tutorTrue = 0;
let tutorStates = [];
for (const tears of [0, 1, 2, 3, 7, 16, 28, 40, 60, 100, 130, 200, 300]) {
  for (const lines of [0, 1, 2, 3, 5, 7, 10]) {
    for (const rankIndex of [0, 1, 2, 3, 4]) {
      for (const chapter of [1, 2, 3, 4, 5, 6]) {
        for (const peak of [0, 1, 2, 3, 4, 5, 6]) {
          const s = { tears, lines, rankIndex, chapter, integrity: lines / 10 };
          if (canTutor(s, peak)) { tutorTrue++; tutorStates.push({ ...s, peak }); }
        }
      }
    }
  }
}
// Permitted only where every single piece of evidence is absent. peak 0 and 1
// are both "green" stages (landfall and novice), so both may still tutor.
const illegal = tutorStates.filter(
  (s) => s.tears !== 0 || s.lines !== 0 || s.rankIndex !== 0 || s.chapter > 1 || s.peak > 1,
);
if (illegal.length) {
  fail('reach', `canTutor() true in ${illegal.length} states with evidence, e.g. ${JSON.stringify(illegal[0])}`);
}
if (!canTutor({ tears: 0, lines: 0, rankIndex: 0, chapter: 1 }, 0)) {
  fail('reach', 'canTutor() is false for a brand-new cadet — the tutorial is now unreachable entirely');
}
// The exact state the critic reported.
const SOVEREIGN = { tears: 130, lines: 10, rankIndex: 4, chapter: 5, integrity: 1 };
if (canTutor(SOVEREIGN, 6)) fail('reach', 'a Sovereign at 130 seals can still be tutored');
if (registerFor(SOVEREIGN, 0) !== 'master') {
  fail('reach', `a Sovereign at 130 seals speaks in "${registerFor(SOVEREIGN, 0)}", expected "master"`);
}

// ---------------------------------------------------------------------------
// 2. RATCHET — the register may never go backwards
// ---------------------------------------------------------------------------
{
  let prev = -1;
  for (let tears = 0; tears <= 300; tears++) {
    const i = stageIndex({ tears, lines: 0, rankIndex: 0 });
    if (i < prev) fail('ratchet', `stage fell from ${prev} to ${i} at ${tears} seals`);
    prev = Math.max(prev, i);
  }
  // A demotion: mastery falls away but the ratchet holds the register.
  const high = stageIndex({ tears: 130, lines: 10, rankIndex: 4, integrity: 1 });
  const after = registerFor({ tears: 130, lines: 4, rankIndex: 2 }, high);
  if (after !== 'master') fail('ratchet', `a demoted master dropped to "${after}"`);
}

// ---------------------------------------------------------------------------
// 3. GUARD — no ungated tutorial key in src/meta
// ---------------------------------------------------------------------------
{
  const src = readFileSync(path.join(ROOT, 'src/meta/index.js'), 'utf8').split('\n');
  for (const key of TUTORIAL_KEYS) {
    const hits = [];
    src.forEach((line, i) => {
      // the `mark(...)` bookkeeping calls and the `seen.has(...)` reads are not
      // speech; only a call that puts the key on the channel is checked
      if (line.includes(`'${key}'`) && /sayKey|say\(|push\(/.test(line)) hits.push(i);
    });
    if (!hits.length) continue;
    for (const i of hits) {
      const window = src.slice(Math.max(0, i - 8), i + 1).join('\n');
      if (!/mayTutor\(\)|mayFirstSeal\(\)/.test(window)) {
        fail('guard', `${key} is spoken at src/meta/index.js:${i + 1} with no mayTutor()/mayFirstSeal() guard within 8 lines`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. CENSUS — how much material Marlow actually has, by register
// ---------------------------------------------------------------------------
const census = {};
let total = 0;
for (const bank of BANKS) {
  census[bank] = {};
  for (const reg of REGISTERS) {
    const key = bankKey(bank, reg);
    const counts = {};
    for (const loc of LOCALES) {
      const v = at(BUNDLES[loc], key);
      counts[loc] = v == null ? 0 : (Array.isArray(v) ? v.length : 1);
    }
    census[bank][reg] = counts;
    total += counts.en;
    if (!counts.en) fail('census', `${key} is missing from EN`);
    for (const loc of LOCALES) {
      if (counts[loc] !== counts.en) {
        fail('parity', `${key}: EN has ${counts.en} lines, ${loc.toUpperCase()} has ${counts[loc]}`);
      }
    }
    // Registers a player lives inside for hours must not be a single sentence.
    const floor = reg === 'green' ? 1 : 2;
    if (counts.en && counts.en < floor) {
      fail('census', `${key} has only ${counts.en} line(s); a bank a player hears repeatedly needs at least ${floor}`);
    }
  }
}
for (const m of MILESTONES) {
  const key = milestoneKey(m);
  for (const loc of LOCALES) {
    if (typeof at(BUNDLES[loc], key) !== 'string') fail('parity', `${key} missing from ${loc.toUpperCase()}`);
  }
  total += 1;
}

// Placeholders must survive transcreation: `{skill}` in EN and nowhere in PL is
// how a companion says "held." with a hole where the noun was.
for (const bank of BANKS) {
  for (const reg of REGISTERS) {
    const key = bankKey(bank, reg);
    const en = at(BUNDLES.en, key);
    if (en == null) continue;
    const want = placeholders(en);
    for (const loc of LOCALES.filter((l) => l !== 'en')) {
      const got = placeholders(at(BUNDLES[loc], key));
      if (want.join() !== got.join()) {
        fail('parity', `${key}: EN interpolates {${want.join('},{')}}, ${loc.toUpperCase()} interpolates {${got.join('},{')}}`);
      }
    }
  }
}
function placeholders(v) {
  const s = Array.isArray(v) ? v.join(' ') : String(v ?? '');
  return [...new Set((s.match(/\{(\w+)\}/g) || []).map((x) => x.slice(1, -1)))].sort();
}

// ---------------------------------------------------------------------------
// 5. GENDER — the address must not assign a sex to the player
// ---------------------------------------------------------------------------
/**
 * Polish. Only *second person* forms are flagged. Marlow speaks about herself
 * in the first person feminine throughout and that is deliberate, so `-łam`,
 * `-łabym` and `-am` are explicitly not matched.
 *
 *   -łeś / -łaś / -eś        second person singular past           zamknąłeś
 *   -łbyś / -łabyś           second person conditional             wyczułbyś
 *   -liście / -łyście        second person plural past             zamknęliście
 *   powinieneś / powinnaś    the gendered modal                    powinieneś
 *
 * The predicative adjectives are a wordlist rather than a pattern: `gotowy` is
 * only a defect when it agrees with the addressee, and there is no way to tell
 * that from morphology alone, so the list is short and deliberately literal.
 */
/**
 * NOTE ON WORD BOUNDARIES. JavaScript's `\b` is ASCII even under the `u` flag,
 * so `ł`, `ś`, `ż` and `ą` all read as non-word characters and `\b` fires in
 * the middle of a Polish word. The first version of this rule set flagged
 * `właśnie` — "just now", one of the commonest adverbs in the language —
 * fourteen times, because it saw `właś` followed by a boundary. Every boundary
 * here is therefore an explicit `\p{L}` lookaround.
 */
const L = '(?<!\\p{L})';
const R = '(?!\\p{L})';
const rx = (body, flags = 'giu') => new RegExp(L + body + R, flags);

const PL_SECOND_PERSON = [
  { re: rx('\\p{L}*[łl](?:eś|aś)'), why: 'second-person past tense carries the addressee’s gender' },
  { re: rx('\\p{L}*[łl](?:by|aby)ś'), why: 'second-person conditional carries the addressee’s gender' },
  { re: rx('byś'), why: 'the conditional clitic needs a gendered participle beside it' },
  { re: rx('\\p{L}{2,}(?:liście|łyście)'), why: 'second-person plural past carries gender' },
  { re: rx('(?:powinieneś|powinnaś)'), why: 'gendered modal; use an imperative or „warto”' },
  { re: /jesteś\s+(?:gotowy|gotowa|pewien|pewna|zmęczony|zmęczona|ciekawy|ciekawa|winien|winna)(?!\p{L})/giu, why: 'predicative adjective agrees with the addressee' },
];
const ES_SECOND_PERSON = [
  // The noun ("te doy la bienvenida") is fine; the participle ("bienvenido")
  // is the defect, and the two differ only by what precedes them.
  { re: /(?<!la\s)(?<!una\s)(?<!\p{L})bienvenid[oa]s?(?!\p{L})/giu, why: 'greeting agrees with the addressee’s gender; use „te doy la bienvenida”' },
  { re: /(?:estás|eres|te\s+has\s+quedado|te\s+sientes|te\s+veo)\s+(?:muy\s+|bastante\s+|un\s+poco\s+)?(?:cansad[oa]|list[oa]|sol[oa]|hart[oa]|segur[oa]|preparad[oa]|callad[oa]|tranquil[oa])(?!\p{L})/giu, why: 'predicative adjective agrees with the addressee' },
  // Only the *address* form: "eres el cadete". A third-party cadet ("hacia el
  // cadete cuatrocientos") and Marlow's own past ("yo era la cadete") are not
  // defects, and a rule that cannot tell them apart gets switched off.
  { re: /(?:tú\s+)?eres\s+(?:el|la)\s+cadete(?!\p{L})/giu, why: 'the article assigns a sex to the player; use „tienes rango de cadete”' },
  // "las dos sabemos" = you and I, both female. "los dos mentían" = two other
  // people, and none of our business.
  { re: /(?:las|los)\s+dos\s+(?:lo\s+)?(?:sabemos|sepamos|hayamos|estemos|seamos|hemos|sabíamos)(?!\p{L})/giu, why: '„las dos”/„los dos” sexes the player-and-Marlow pair; use „tú y yo”' },
];

/** Every string under `story.*` — Marlow's whole script — with its key. */
function walkStrings(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push([key, v]);
    else if (Array.isArray(v)) v.forEach((s, i) => { if (typeof s === 'string') out.push([`${key}[${i}]`, s]); });
    else if (v && typeof v === 'object') walkStrings(v, key, out);
  }
  return out;
}

const genderHits = { pl: [], es: [] };
for (const [loc, rules] of [['pl', PL_SECOND_PERSON], ['es', ES_SECOND_PERSON]]) {
  for (const [key, text] of walkStrings(BUNDLES[loc].story, 'story')) {
    for (const { re, why } of rules) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m) genderHits[loc].push({ key, hit: m[0], why, text: text.slice(0, 110) });
    }
  }
}
for (const loc of ['pl', 'es']) {
  for (const h of genderHits[loc]) {
    fail('gender', `${loc.toUpperCase()} ${h.key}: “${h.hit}” — ${h.why}`);
  }
}

// The same scan over the rest of the bundle is reported but not failed: those
// namespaces belong to other owners, and a gate that fails on somebody else's
// file is a gate that gets disabled.
const foreign = { pl: [], es: [] };
for (const [loc, rules] of [['pl', PL_SECOND_PERSON], ['es', ES_SECOND_PERSON]]) {
  for (const [key, text] of walkStrings(BUNDLES[loc], '')) {
    if (key.startsWith('story.')) continue;
    for (const { re, why } of rules) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m) foreign[loc].push({ key, hit: m[0], why });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const report = { total, census, findings, foreign, tutorStates: tutorStates.length };
if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else if (LINES_ONLY) {
  printCensus();
} else {
  printCensus();
  console.log('');
  console.log(`tutorial reachability : canTutor() true in ${tutorStates.length} of the swept states,`);
  console.log('                        all of them zero-evidence (0 seals, 0 lines, copper, chapter 1)');
  console.log(`sovereign @130 seals  : register "${registerFor(SOVEREIGN, 0)}", canTutor ${canTutor(SOVEREIGN, 6)}`);
  console.log('');
  for (const loc of ['pl', 'es']) {
    const n = foreign[loc].length;
    if (n) {
      console.log(`gendered address outside story.* in ${loc.toUpperCase()} (not owned here, reported only): ${n}`);
      foreign[loc].slice(0, 6).forEach((f) => console.log(`   · ${f.key}: “${f.hit}” — ${f.why}`));
    }
  }
  console.log('');
  if (!findings.length) console.log('marlow-audit: clean');
  else {
    console.log(`marlow-audit: ${findings.length} finding(s)`);
    for (const f of findings) console.log(`  [${f.rule}] ${f.detail}`);
  }
}

function printCensus() {
  console.log('Marlow line census — EN/ES/PL, by bank and register\n');
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('bank', 11) + REGISTERS.map((r) => pad(r, 12)).join(''));
  for (const bank of BANKS) {
    const row = REGISTERS.map((r) => {
      const c = census[bank][r];
      const same = LOCALES.every((l) => c[l] === c.en);
      return pad(same ? String(c.en) : `${c.en}/${c.es}/${c.pl}!`, 12);
    }).join('');
    console.log(pad(bank, 11) + row);
  }
  console.log(pad('milestone', 11) + pad(MILESTONES.length, 12) + '(one-shot, past the last chapter)');
  console.log(`\ntotal distinct Marlow lines per locale: ${total}  ·  across three locales: ${total * 3}`);
  console.log(`stages: ${STAGES.map((s) => s.id).join(' → ')}`);
}

/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The companion channel
   is the shipped route: a tutorial line reaching a sovereign is in front of a
   learner today. */
const F = ledger('check:marlow', { scope: 'route' });
F.route(findings.map((f) => (typeof f === 'string' ? f : JSON.stringify(f))));
F.done();
