#!/usr/bin/env node
/**
 * THE VOCABULARY GATE — does the game ever say the words the standard is
 * written in?
 *
 *   node tools/check-vocab.mjs                 # the gate
 *   node tools/check-vocab.mjs --self-test     # prove the gate can refuse
 *   node tools/check-vocab.mjs --json          # machine report
 *   node tools/check-vocab.mjs --report        # before/after table, exit 0
 *   node tools/check-vocab.mjs --seeds=200     # deeper draw
 *
 * WHY IT EXISTS. A cadet who held every line on the shipped route had met the
 * word SLOPE zero times. INTERCEPT zero. INEQUALITY zero. VARIABLE zero. The
 * bank says "the rate", "the start", "the letter", "the line leans" — which is
 * genuinely good Simplified Technical English and is exactly why check:lang is
 * green — and it is also why that cadet would not recognise a STAAR card that
 * asks "what is the slope of the line?". Every existing gate was happy: the
 * mathematics was right, the three locales matched, the sentences were short.
 * Nothing anywhere asked whether the words a state test is printed in had ever
 * appeared in front of a learner.
 *
 * WHAT IT PROVES, against the REAL generated bank in EN, ES and PL:
 *
 *   accounted  Every word of CCSS and TEKS text quoted in the route's own graph
 *              files is in exactly one bucket of tools/lang/terms.json —
 *              taught, deferred with a written reason, a symbol, or ordinary
 *              English. A term cannot be dropped by leaving it off a list.
 *   present    Every taught term's formal word is in the learner-facing bank,
 *              in every locale.
 *   early      No learner-facing string — stem or worked-echo line — on a skill
 *              BEFORE the owner in route order uses the formal word. A word can
 *              never arrive before the lesson that gives it meaning.
 *   intro      On the owner skill, at every band, at least `introShare` of the
 *              item stems carry BOTH the plain phrase and the formal word. The
 *              gate prints the chance a learner clears that skill without ever
 *              reading the introduction.
 *   met        Across the route the learner meets the formal word at least
 *              `meetFloor` times, counted as sum over skills of
 *              (itemsPerSkillFloor x share of that skill's stems carrying it).
 *   bare       At least one skill AFTER the owner prints the formal word with
 *              no plain phrase beside it — the way a test prints it. A term
 *              whose owner is the last skill on the route is exempt, and says so.
 *
 * WHAT IT FOUND THE FIRST TIME IT RAN, on the shipped route, 60 seeds a band a
 * locale, before any of this was written:
 *
 *   slope 0 · intercept 0 · inequality 0 · variable 0 · domain 0 · range 0 ·
 *   coefficient 0 · solution 0 · function 0 · linear 0 · proportion 0 ·
 *   exponent 0 · parentheses 0 (en) · order of operations 0 · like terms 0 ·
 *   distributive property 0 · rate of change 0 · coordinate plane 0 ·
 *   graph 0 · system of equations 0 · evaluate 0 · initial value 0
 *
 * Seven of the standard's words were already the bank's own — expression,
 * term, equation, ratio, formula, factor, substitute — and the other
 * twenty-six were absent from every stem a learner reads.
 *
 * WHAT IT IS NOT. It is not a translation checker and not a style checker.
 * check:i18n owns key parity; check:lang owns sentence length and ASD-STE100.
 * This gate owns one question only: is the standard's own vocabulary taught,
 * in order, often enough — in each locale's own words, not in translated
 * English.
 *
 * COUNTING. Stems and worked-echo lines are read exactly as `check:lang` reads
 * them: the real generator, fixed seeds, every skill of the route, every band,
 * every locale. `coverage` is over ITEMS, not over distinct strings, because
 * what a learner meets is items.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, realpathSync } from 'node:fs';
import { generate, FORMS_BY_SKILL } from '../src/learn/generators.js';
import { MasteryEngine } from '../src/learn/mastery.js';
import { allUnits, loadUnit, manifest } from './_courses.mjs';
import { findings } from './_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const JSON_OUT = has('--json');
const SELF_TEST = has('--self-test');
const REPORT = has('--report');
const SEEDS = Number(opt('seeds', '60'));
const MEASURE_ONLY = has('--measure');
/** The chance a learner may be allowed to clear a skill without reading the introduction. */
const MISS_CAP = 0.05;
const LOCALES = ['en', 'es', 'pl'];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const grn = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// The route, and the standards text it is written against
// ---------------------------------------------------------------------------

/** The units a learner with no query string actually walks, in course order. */
async function routeUnits() {
  const m = await manifest();
  const course = m.courses.find((c) => c.id === m.route.course);
  const want = m.route.units || (course.units || []).filter((u) => u.status === 'shipped').map((u) => u.id);
  return (course.units || []).filter((u) => want.includes(u.id));
}

/** Topological order of the route's nodes: the order a learner meets them. */
function routeOrder(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = [];
  const done = new Set();
  let guard = 0;
  while (out.length < nodes.length && guard++ < 500) {
    let moved = false;
    for (const n of nodes) {
      if (done.has(n.id)) continue;
      if ((n.prereqs || []).every((p) => done.has(p) || !byId.has(p))) {
        out.push(n.id); done.add(n.id); moved = true;
      }
    }
    if (!moved) break;      // a cycle: validate-courses owns that defect
  }
  for (const n of nodes) if (!done.has(n.id)) out.push(n.id);
  return out;
}

/** Every standards citation the route's graphs carry, with its quoted text. */
function citations(graphs) {
  const out = [];
  for (const g of graphs) {
    for (const n of g.nodes) {
      for (const s of [...(n.standards || []), ...(n.alignment || [])]) {
        if (!s?.text) continue;
        out.push({ node: n.id, framework: s.framework || g.framework || 'CCSS-M', code: s.code, depth: s.depth, text: s.text });
      }
    }
  }
  return out;
}

const WORD_RE = /[a-z][a-z-]*/g;
function corpusWords(cites) {
  const map = new Map();      // word -> Set(code)
  for (const c of cites) {
    for (const w of String(c.text).toLowerCase().match(WORD_RE) || []) {
      if (!map.has(w)) map.set(w, new Set());
      map.get(w).add(`${c.node}/${c.code}`);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// The bank, read the way a learner reads it
// ---------------------------------------------------------------------------

/**
 * @returns {Map<string, Map<number, Array<{stem:string, why:string}>>>}
 *   locale -> skill -> band -> one entry per generated item
 */
function drawBank(skills, seeds = SEEDS) {
  const bank = {};
  for (const loc of LOCALES) {
    bank[loc] = {};
    for (const s of skills) {
      bank[loc][s] = {};
      for (let d = 1; d <= 5; d++) {
        const items = [];
        for (let i = 0; i < seeds; i++) {
          let it;
          try { it = generate(s, d, i * 7919 + d * 104729, { locale: loc }); } catch { continue; }
          if (!it?.stem) continue;
          items.push({
            stem: String(it.stem),
            why: (it.steps || []).map((x) => String(x?.why || '')).join(' · '),
          });
        }
        bank[loc][s][d] = items;
      }
    }
  }
  return bank;
}

/**
 * A word boundary that knows ę and ó are letters.
 *
 * JS's own `\b` is ASCII-only, so `/\bnierówność\b/` cannot match `Nierówność`
 * — there is no boundary between `ć` and the space after it, because `ć` is not
 * a word character to `\b`. Every Polish and half the Spanish surface form in
 * the registry ends in one of those letters, so this is not a corner case: it
 * is the difference between the gate reading the Polish bank and the gate
 * silently reading nothing. `tools/lang/rules.mjs` solved the same problem the
 * same way; this is that solution, applied to a pattern written with `\b`.
 */
const L = 'a-zA-Z\u00C0-\u024F';
const rx = (src) => new RegExp(
  src.replace(/\\b/g, (m, i) => (i === 0 || /[|(]/.test(src[i - 1] || '') ? `(?<![${L}])` : `(?![${L}])`)),
  'i',
);

/**
 * What a learner reads, with the mathematics taken out — a term has to be
 * taught in prose, never in notation.
 *
 * And with every space made an ordinary space. `src/i18n/typography.js` binds a
 * one-letter Polish word to the next with a NO-BREAK SPACE, so the bank really
 * prints `równanie z\u00a0literami`, and a pattern written with a plain space
 * silently matched nothing — the Polish half of a term could read as absent
 * while it was on the card the whole time.
 */
const prose = (s) => String(s).replace(/\$[^$]*\$/g, ' ').replace(/[\u00a0\u2007\u202f\u2009\u200a]/g, ' ');


// ---------------------------------------------------------------------------
// HOW MANY ITEMS A LEARNER IS REALLY SERVED ON ONE SKILL
//
// The intro rule is a probability, and a probability needs an exponent. Taking
// it from a document is how a constant goes stale, so it is MEASURED here, on
// every run, against the real MasteryEngine over the real route: thirty cold
// learners, every mastery claim they earn, and how many items that skill cost
// them up to the claim. About two and a half seconds.
//
// The gate uses the 10th percentile — nine claims in ten cost at least this
// many items — floored at the number the graph's own mastery block guarantees
// (cleanRun + checkItems) and capped at 20 so that a slower engine can never
// buy the bank a softer bar than the one below.
// ---------------------------------------------------------------------------
function itemsPerSkill(graph, floor) {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const costs = [];
  for (let learner = 0; learner < 30; learner += 1) {
    const e = new MasteryEngine(graph);
    const k = new Map(graph.nodes.map((n) => [n.id, 0.1 + 0.2 * rnd()]));
    const rate = 0.12 + 0.18 * rnd();
    const spent = new Map();
    const closed = new Set();
    for (let step = 0; step < 3000; step += 1) {
      const obj = e.next();
      if (!obj) break;
      const task = e.taskFor(obj.id) || { skill: obj.id, kind: 'learn', difficulty: 1, scaffold: 'none' };
      const s = task.skill;
      spent.set(s, (spent.get(s) || 0) + 1);
      const forms = FORMS_BY_SKILL[s] || [];
      const pool = forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax);
      const form = pool[Math.floor(rnd() * pool.length)] || forms[0] || { id: 'x', rep: 'symbolic' };
      const ok = rnd() < sig(6 * (k.get(s) - 0.12 * task.difficulty)) * 0.94;
      const res = e.observe(s, ok, { assisted: task.scaffold !== 'none', form: form.id, rep: form.rep, kind: task.kind });
      k.set(s, Math.min(1, k.get(s) + rate * (ok ? 0.35 : 0.5) * (1 - k.get(s))));
      if (res?.justMastered && !closed.has(s)) { closed.add(s); costs.push(spent.get(s)); }
    }
  }
  costs.sort((a, b) => a - b);
  const at = (p) => (costs.length ? costs[Math.floor(costs.length * p)] : floor);
  return { n: Math.max(floor, Math.min(20, at(0.10))), p10: at(0.10), median: at(0.5), claims: costs.length };
}

// ---------------------------------------------------------------------------
// The five rules
// ---------------------------------------------------------------------------
function audit(reg, order, bank, skills, served) {
  const findings = [];
  const rows = [];
  const idx = new Map(order.map((id, i) => [id, i]));
  const itemsFloor = reg.itemsPerSkillFloor;
  // The share of a skill's stems that must introduce the word, derived from the
  // measured exponent so that the chance of missing the introduction stays under
  // MISS_CAP. It is never taken from a file: a bar somebody can edit is not a bar.
  const shareFloor = 1 - MISS_CAP ** (1 / served.n);

  for (const t of reg.terms) {
    if (!idx.has(t.owner)) {
      findings.push({ rule: 'owner', term: t.id, detail: `owner "${t.owner}" is not a skill on the route` });
      continue;
    }
    const ownerAt = idx.get(t.owner);
    const later = order.slice(ownerAt + 1);
    const row = { id: t.id, owner: t.owner, native: !!t.native, loc: {} };

    for (const loc of LOCALES) {
      const spec = t[loc];
      if (!spec?.re) { findings.push({ rule: 'registry', term: t.id, loc, detail: 'no surface form declared' }); continue; }
      /* NATIVE, AND NATIVE IN ONE LANGUAGE ONLY.
         Some of the standard's words were already the bank's own — expression,
         term, equation, ratio, formula. And some are native in one locale and
         not another: Spanish and Polish call a bracket a paréntesis / nawias
         and always did, so only English has two words for it and only English
         needs an introduction. A term that is native here needs no gloss and no
         bare-use proof; it still has to be MET. */
      const native = !!t.native || (t.nativeIn || []).includes(loc);
      if (native && !t.nativeNote && !t.native) {
        findings.push({ rule: 'registry', term: t.id, loc, detail: 'nativeIn with no nativeNote saying why' });
      }
      const word = rx(spec.re);
      const plain = spec.plainRe ? rx(spec.plainRe) : null;

      let total = 0, hitStem = 0, hitIntro = 0, hitWhy = 0;
      let bareLater = null, earliest = null;
      const introByBand = {};
      const perSkill = {};

      for (const s of skills) {
        let sTotal = 0, sStem = 0;
        for (let d = 1; d <= 5; d++) {
          const items = bank[loc][s][d];
          let bTotal = 0, bIntro = 0;
          for (const it of items) {
            const stem = prose(it.stem);
            const why = prose(it.why);
            total += 1; sTotal += 1; bTotal += 1;
            const inStem = word.test(stem);
            const inWhy = word.test(why);
            if (inStem) { hitStem += 1; sStem += 1; }
            if (inWhy) hitWhy += 1;
            if ((inStem || inWhy) && idx.get(s) < ownerAt && earliest === null) {
              earliest = { skill: s, band: d, sample: (inStem ? stem : why).trim().slice(0, 120) };
            }
            if (inStem && !native && plain && plain.test(stem)) {
              if (s === t.owner) hitIntro += 1;
              bIntro += 1;
            }
            /* BARE — the word printed the way a test prints it, with nothing
               beside it. A stem on any LATER skill counts. So does a worked-echo
               line on the OWNER skill, and the ordering there is guaranteed by
               construction rather than by argument: within one item the learner
               reads the stem — which is where the introduction lives — and the
               echo only ever opens after that. */
            if (!bareLater) {
              if (inStem && idx.get(s) > ownerAt && (!plain || !plain.test(stem))) {
                bareLater = { skill: s, where: 'stem', sample: stem.trim().slice(0, 120) };
              } else if (inWhy && idx.get(s) >= ownerAt && (!plain || !plain.test(why))) {
                bareLater = { skill: s, where: 'echo', sample: why.trim().slice(0, 120) };
              }
            }
          }
          if (s === t.owner) introByBand[d] = bTotal ? bIntro / bTotal : 0;
        }
        perSkill[s] = { total: sTotal, stem: sStem, share: sTotal ? sStem / sTotal : 0 };
      }

      const met = skills.reduce((a, s) => a + served.n * perSkill[s].share, 0);
      const ownerShare = perSkill[t.owner].share;
      const introShare = perSkill[t.owner].total ? hitIntro / perSkill[t.owner].total : 0;
      const worstIntro = introShare;
      const missP = native ? 0 : (1 - worstIntro) ** served.n;

      row.loc[loc] = {
        word: spec.word, native, stems: hitStem, whys: hitWhy, total,
        ownerShare: +ownerShare.toFixed(3),
        met: +met.toFixed(2),
        introByBand, introShare: +introShare.toFixed(3), missP: +missP.toFixed(4),
        bareLater: bareLater?.skill || null,
        skills: Object.entries(perSkill).filter(([, v]) => v.stem).map(([k]) => k),
      };

      // --- present
      if (hitStem === 0) {
        findings.push({ rule: 'present', term: t.id, loc, detail: `"${spec.word}" appears in no item stem on the route` });
      }
      // --- early
      if (earliest) {
        findings.push({
          rule: 'early', term: t.id, loc,
          detail: `"${spec.word}" is used on ${earliest.skill} (band ${earliest.band}), which comes before its owner ${t.owner}`,
          sample: earliest.sample,
        });
      }
      /* --- intro
         Two clauses, and they answer two different failures.

         DENSE ENOUGH. The share is taken over the WHOLE owning skill, not band
         by band, because a learner does not sit at one band: the engine moves
         them up on a clean run and down on a miss, so what they meet is the
         skill's mix. `served.n` items at `introShare` leaves the chance of
         clearing the line without ever reading the introduction under MISS_CAP,
         and the number is printed for every term.

         AND NO DEAD BAND. A skill-wide share could still be bought entirely at
         band 1 and leave a learner who places straight into band 3 with nothing.
         So the introduction must also be DEALT at every band the skill offers.
         The first clause is about how often; the second is about whether it is
         reachable at all from where this learner starts. */
      if (!native) {
        if (introShare < shareFloor) {
          findings.push({
            rule: 'intro', term: t.id, loc,
            detail: `${t.owner}: ${(introShare * 100).toFixed(0)}% of stems name "${spec.word}" beside its plain phrase — a learner clears the line without reading it ${(((1 - introShare) ** served.n) * 100).toFixed(1)}% of the time (cap ${(MISS_CAP * 100).toFixed(0)}%, needs ${(shareFloor * 100).toFixed(0)}%)`,
          });
        }
        const dead = Object.entries(introByBand).filter(([, v]) => v === 0).map(([d]) => d);
        if (dead.length) {
          findings.push({
            rule: 'intro', term: t.id, loc,
            detail: `${t.owner} deals no introduction of "${spec.word}" at band ${dead.join(', ')} — a learner placed there meets the word with nothing beside it`,
          });
        }
      }
      // --- met
      const floor = t.meet ?? reg.meetFloor;
      // An override is allowed — some words the route can only honestly say a
      // few times — but never a silent one.
      if (t.meet != null && !t.meetNote) {
        findings.push({ rule: 'registry', term: t.id, loc, detail: `meet override ${t.meet} with no meetNote saying why the route cannot give more` });
      }
      if (met < floor) {
        findings.push({
          rule: 'met', term: t.id, loc,
          detail: `a learner meets "${spec.word}" ${met.toFixed(1)} times on the route (floor ${floor})`,
        });
      }
      // --- bare
      if (!native && !bareLater) {
        findings.push({
          rule: 'bare', term: t.id, loc,
          detail: `nothing prints "${spec.word}" the way a test prints it — with no plain phrase beside it — on ${t.owner} or after`,
        });
      }
    }
    rows.push(row);
  }
  return { findings, rows };
}

/** Every corpus word must sit in exactly one bucket. */
function accounted(reg, words) {
  const findings = [];
  const owners = new Map();
  const claim = (w, by) => {
    if (!owners.has(w)) owners.set(w, []);
    owners.get(w).push(by);
  };
  for (const t of reg.terms) for (const w of t.words || []) claim(w, `terms/${t.id}`);
  for (const w of Object.keys(reg.deferred || {})) claim(w, 'deferred');
  for (const w of reg.symbol || []) claim(w, 'symbol');
  for (const w of reg.ordinary || []) claim(w, 'ordinary');

  for (const [w, codes] of words) {
    const who = owners.get(w);
    if (!who) {
      findings.push({
        rule: 'accounted', term: w,
        detail: `the standards text says "${w}" and tools/lang/terms.json accounts for it nowhere`,
        sample: [...codes].slice(0, 3).join(', '),
      });
    }
  }
  for (const [w, who] of owners) {
    const inTerms = who.filter((x) => x.startsWith('terms/'));
    if (inTerms.length > 1) {
      findings.push({ rule: 'accounted', term: w, detail: `claimed by two taught terms: ${inTerms.join(', ')}` });
    }
    if (inTerms.length && who.length > inTerms.length) {
      findings.push({ rule: 'accounted', term: w, detail: `claimed both as a taught term and as ${who.filter((x) => !x.startsWith('terms/')).join('/')}` });
    }
    if (!inTerms.length && who.length > 1) {
      findings.push({ rule: 'accounted', term: w, detail: `in two buckets at once: ${who.join(', ')}` });
    }
    if (!words.has(w) && !String(w).endsWith('-note')) {
      findings.push({ rule: 'accounted', term: w, detail: `bucketed as ${who.join('/')}, but no cited standard on the route uses it` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Self-test: plant the exact defect this gate exists to catch, and prove the
// same rules stay quiet on the honest bank beside it.
// ---------------------------------------------------------------------------
function planted(reg, order, bank, skills, kind) {
  const clone = JSON.parse(JSON.stringify(reg));
  const bk = JSON.parse(JSON.stringify(bank));
  const scrub = (re, keepSkill = null) => {
    const r = new RegExp(re, 'gi');
    for (const loc of LOCALES) for (const s of skills) {
      if (s === keepSkill) continue;
      for (let d = 1; d <= 5; d++) {
        for (const it of bk[loc][s][d]) { it.stem = it.stem.replace(r, 'XX'); it.why = it.why.replace(r, 'XX'); }
      }
    }
  };
  const t = clone.terms.find((x) => x.id === 'slope');
  if (kind === 'present') { for (const loc of LOCALES) scrub(t[loc].re); }
  if (kind === 'met') {
    // leave the owner skill alone, delete every later meeting
    for (const loc of LOCALES) scrub(t[loc].re, t.owner);
  }
  if (kind === 'intro') {
    for (const loc of LOCALES) {
      const r = new RegExp(t[loc].plainRe, 'gi');
      for (let d = 1; d <= 5; d++) for (const it of bk[loc][t.owner][d]) it.stem = it.stem.replace(r, 'XX');
    }
  }
  if (kind === 'bare') {
    // every bare use of the word turns into a glossed one: the plain phrase is
    // welded next to it everywhere, so a learner never meets it the way a test
    // prints it.
    for (const loc of LOCALES) {
      const r = new RegExp(t[loc].re, 'gi');
      for (const s of skills) for (let d = 1; d <= 5; d++) {
        for (const it of bk[loc][s][d]) {
          it.stem = it.stem.replace(r, (m) => `${m} (${t[loc].plain})`);
          it.why = it.why.replace(r, (m) => `${m} (${t[loc].plain})`);
        }
      }
    }
  }
  if (kind === 'early') {
    const first = order[0];
    for (const loc of LOCALES) for (let d = 1; d <= 5; d++) {
      for (const it of bk[loc][first][d]) it.stem = `${t[loc].word} — ${it.stem}`;
    }
  }
  if (kind === 'accounted') clone.ordinary = (clone.ordinary || []).filter((w) => w !== 'the');
  if (kind === 'dropped') clone.terms = clone.terms.filter((x) => x.id !== 'slope');
  return { reg: clone, bank: bk };
}

// ---------------------------------------------------------------------------
async function main() {
  for (const { unit } of await allUnits()) await loadUnit(unit);
  const units = await routeUnits();
  const graphs = [];
  for (const u of units) graphs.push(JSON.parse(readFileSync(path.join(ROOT, 'content', u.graph), 'utf8')));
  const nodes = graphs.flatMap((g) => g.nodes);
  const order = routeOrder(nodes);
  const cites = citations(graphs);
  const words = corpusWords(cites);
  const reg = JSON.parse(readFileSync(path.join(ROOT, 'tools/lang/terms.json'), 'utf8'));
  // The composed lattice the route really walks — the same shape loadCourse
  // builds — so the engine measurement below sees the learner's own graph.
  const ids = new Set(nodes.map((n) => n.id));
  const composed = {
    ...graphs[0],
    id: 'route-composed',
    nodes: nodes.map((n) => ({ ...n, prereqs: (n.prereqs || []).filter((p) => ids.has(p)) })),
  };
  const served = itemsPerSkill(composed, reg.itemsPerSkillFloor);
  if (MEASURE_ONLY) {
    console.log(`items served on one skill up to its first mastery claim: p10 ${served.p10} · median ${served.median} · ${served.claims} claims · gate uses n=${served.n}`);
    process.exit(0);
  }
  const bank = drawBank(order);

  if (SELF_TEST) {
    const cases = [
      ['present', 'present', 'a term the standards use is nowhere in the bank'],
      ['met', 'met', 'the word is introduced and then never said again'],
      ['intro', 'intro', 'the formal word arrives with no plain phrase beside it'],
      ['early', 'early', 'the word is used on a skill before the one that defines it'],
      ['bare', 'bare', 'the word never appears without its plain twin welded to it'],
      ['accounted', 'accounted', 'a word of the standards text is in no bucket'],
      ['dropped', 'accounted', 'a whole term is deleted from the registry'],
    ];
    let bad = 0;
    for (const [kind, wantRule, why] of cases) {
      const p = planted(reg, order, bank, order, kind);
      const w = corpusWords(cites);
      const f = [...accounted(p.reg, w), ...audit(p.reg, order, p.bank, order, served).findings];
      const caught = f.some((x) => x.rule === wantRule);
      console.log(`${caught ? grn('CAUGHT ') : red('MISSED ')} ${kind.padEnd(10)} ${dim(why)}`);
      if (!caught) bad += 1;
    }
    // the control: the honest bank beside it must stay quiet on those same rules
    const clean = [...accounted(reg, words), ...audit(reg, order, bank, order, served).findings];
    const noisy = clean.length;
    console.log(`${noisy ? red('CONTROL ' + noisy + ' finding(s) on the honest bank') : grn('CONTROL clean')}`);
    if (noisy) {
      for (const f of clean.slice(0, 40)) console.log(`   ${f.rule} ${f.term}${f.loc ? '/' + f.loc : ''}: ${f.detail}`);
      if (clean.length > 40) console.log(`   ... and ${clean.length - 40} more`);
    }
    process.exit(bad || noisy ? 1 : 0);
  }

  const accFindings = accounted(reg, words);
  const { findings: termFindings, rows } = audit(reg, order, bank, order, served);
  const all = [...accFindings, ...termFindings];

  if (JSON_OUT) {
    console.log(JSON.stringify({ route: units.map((u) => u.id), order, terms: rows, findings: all }, null, 2));
    process.exit(REPORT ? 0 : all.length ? 1 : 0);
  }

  console.log(bold('\nVOCABULARY — the words the standard is written in'));
  console.log(dim(`  route ${units.map((u) => u.id).join(' -> ')} · ${order.length} skills · ${cites.length} citations · ${words.size} distinct words · ${SEEDS} seeds/band/locale`));
  console.log(dim(`  measured on the real engine just now: a mastery claim costs at least ${served.p10} items on that skill nine times in ten (median ${served.median}, ${served.claims} claims)`));
  console.log(dim(`  "met" counts that measured floor times the share of each skill's stems that carry the word; the graph's own guarantee is lower still at ${reg.itemsPerSkillFloor} (cleanRun + checkItems)`));
  console.log(dim(`  the introduction must be dense enough that a learner clears its skill without reading it under ${(MISS_CAP * 100).toFixed(0)}% of the time, at n=${served.n}: ${((1 - MISS_CAP ** (1 / served.n)) * 100).toFixed(0)}% of stems\n`));

  const pad = (s, n) => String(s).padEnd(n);
  console.log(bold(`  ${pad('term', 22)}${pad('owner', 20)}${pad('en', 26)}${pad('es', 26)}pl`));
  for (const r of rows) {
    const cell = (l) => {
      const v = r.loc[l];
      if (!v) return pad('—', 26);
      return pad(`${v.word.slice(0, 13)} ${v.met.toFixed(0)}x ${v.stems}`, 26);
    };
    console.log(`  ${pad(r.id, 22)}${pad(r.owner, 20)}${cell('en')}${cell('es')}${cell('pl').trim()}`);
  }

  console.log(dim('\n  columns: the locale\'s own word · times met on the route · item stems that carry it'));
  const worst = rows.map((r) => Math.max(...LOCALES.map((l) => r.loc[l]?.missP ?? 0)));
  if (worst.length) {
    console.log(dim(`  worst chance of clearing an owning skill without reading the introduction: ${(Math.max(...worst) * 100).toFixed(1)}%`));
  }

  const def = Object.keys(reg.deferred || {}).length;
  console.log(dim(`\n  ${rows.length} terms taught · ${def} deferred with a written reason · ${(reg.ordinary || []).length} ordinary · ${(reg.symbol || []).length} symbols`));
  const gaps = Object.entries(reg.deferred || {}).filter(([, v]) => /NAMED GAP/.test(v));
  if (gaps.length) {
    console.log(dim(`  named gaps — cited on the route, not taught, and not pretended otherwise: ${gaps.map(([k]) => k).join(', ')}`));
  }

  if (!all.length) {
    console.log(grn('\n  vocabulary: every term the route\'s standards use is taught, in order, in en/es/pl\n'));
  } else {
  console.log(red(`\n  ${all.length} finding(s)\n`));
  const byRule = {};
  for (const f of all) (byRule[f.rule] ||= []).push(f);
  for (const [rule, list] of Object.entries(byRule)) {
    console.log(bold(`  ${rule}  (${list.length})`));
    for (const f of list.slice(0, 24)) {
      console.log(`    ${red('x')} ${f.term}${f.loc ? ' · ' + f.loc : ''}: ${f.detail}`);
      if (f.sample) console.log(dim(`        ${f.sample}`));
    }
    if (list.length > 24) console.log(dim(`    ... and ${list.length - 24} more`));
  }
  console.log('');
  }
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. Every term here is
     cited by a node the shipped route walks, and the item bank is what a
     learner reads today, so a finding is a route finding. */
  const F = findings('check:vocab', { scope: 'sweep' });
  if (all.length && !REPORT) {
    const byRule2 = {};
    for (const f of all) (byRule2[f.rule] ||= []).push(f);
    for (const [rule, list] of Object.entries(byRule2)) {
      F.route(`${rule}: ${list.length} finding(s) — ${[...new Set(list.map((x) => x.term))].slice(0, 6).join(', ')}${list.length > 6 ? ' …' : ''}`);
    }
  }
  F.done();
}

if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
