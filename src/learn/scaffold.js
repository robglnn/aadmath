/**
 * Choosing the worked analogue that sits beside a live problem.
 *
 * A faded worked example only teaches if it is an *analogue*: the same
 * structure, different numbers. If it shares the live item's answer — or worse,
 * if the live answer is sitting in plain sight inside the analogue's worked
 * lines — then the strongest strategy available to the learner is to copy a
 * numeral across, and the scaffold has quietly become the answer key. That is
 * exactly where it does most damage, because scaffolds appear when the learner
 * is weakest.
 *
 * So the analogue is *rejected and redrawn* until it is genuinely a different
 * problem: different notation, a different answer, and not one appearance of
 * the live answer's digits anywhere in its prompt, its steps or its own
 * solution. If no draw survives that, we show no example at all rather than a
 * leaky one — an unscaffolded item is a worse lesson, but a leaking scaffold is
 * a false one.
 */
import { safeGenerate, noteSituation } from './generators.js';

const norm = (s) => String(s).replace(/\s+/g, '');
// Exponent digits are notation, not values: the 2 in x^{2} is not a number a
// learner could copy across as an answer.
const digitsOf = (s) => new Set((String(s).replace(/\^\s*\{?-?\d+\}?/g, '').match(/\d+/g) || []));

/**
 * @param {object} item the live item the learner is about to attempt
 * @param {{locale?:string, difficulty?:number, seed?:number, tries?:number,
 *          avoidScenes?:string[]}} opts
 * @returns {object|null} a verified analogue, or null if none is safe
 */
export function analogueFor(item, opts = {}) {
  if (!item) return null;
  const locale = opts.locale || 'en';
  const d = opts.difficulty || item.difficulty || 1;
  const base = ((opts.seed ?? item.seed ?? 1) + 8117) >>> 0;
  // How many candidates to audition. A prompt that shows one number is easy to
  // find an analogue for; a four-row table beside a rule shows nine, and every
  // one of them has to miss the live answer's numerals. Measured over the whole
  // bank, thirty-two draws left one table item in twenty with no example at all
  // — and an item with no example falls back on the learner's own trace, which
  // is the one trace that cannot help but contain the live answer.
  const tries = opts.tries || 96;

  // Every numeral in the live answer — those are the digits that must not be
  // copyable off the example.
  const forbidden = digitsOf(item.answer);
  const onScreen = digitsOf(item.latex);
  const liveTex = norm(item.latex);
  const liveAns = norm(item.answer);
  const skeleton = /\\square/.test(item.latex);
  // The worked example is a second situation on the same card. It must not be
  // the live item's situation, and it must not be one the scheduler has already
  // refused for this learner.
  const avoid = [item.scene, ...(opts.avoidScenes || [])].filter(Boolean);

  const leaks = (cand) => {
    const surfaces = [cand.latex, cand.answer, ...(cand.steps || []).map((s) => s.latex)];
    for (const s of surfaces) for (const nmb of digitsOf(s)) if (forbidden.has(nmb)) return true;
    // The example's own answer must also not be a number already sitting in
    // the live prompt: "the last cadet sealed it at 12" next to a live table
    // containing a 12 is an invitation to copy the wrong thing across.
    for (const nmb of digitsOf(cand.answer)) if (onScreen.has(nmb)) return true;
    return false;
  };

  // Pass one: the same form — structurally aligned, which is what makes a
  // completion problem a completion problem. Pass two: any form of the same
  // skill at the same band, which is a weaker alignment but still an analogue.
  // Pass three: the band below, which is where the search has to go for the
  // prompts that show a lot of numbers at once — a four-row table beside a
  // rule prints nine, and every one of them has to miss the live answer's
  // numerals. An analogue one band easier is still an analogue, and it is what
  // a teacher reaches for anyway when the cadet is struggling; showing nothing
  // means falling back on the learner's own trace, which is the one trace that
  // cannot avoid containing the live answer.
  const passes = [
    { sameForm: true, band: d },
    { sameForm: false, band: d },
    { sameForm: false, band: Math.max(1, d - 1) },
  ];
  for (const pass of passes) {
    const sameForm = pass.sameForm;
    for (let i = 0; i < tries; i++) {
      let cand;
      try {
        // `record: false`: this loop auditions dozens of candidates and throws
        // most of them away. Charging the bank's situation ledger for framings
        // nobody ever saw would burn through a deck without a learner reading a
        // word of it, and the survivor would then be the one that repeats. Only
        // the analogue actually returned is reported, at the bottom.
        cand = safeGenerate(item.skill, pass.band, (base + i * 6131 + (sameForm ? 0 : 977) + pass.band * 31) >>> 0,
          { locale, record: false, avoidScenes: avoid, ...(sameForm ? { form: item.form } : {}) });
      } catch { continue; }
      if (!cand) continue;
      if (sameForm && cand.form !== item.form) continue;
      // "Which equation models this?" items share one skeleton prompt, so for
      // them sameness lives in the situation, not in the notation.
      if (skeleton) { if (norm(cand.stem) === norm(item.stem)) continue; }
      else if (norm(cand.latex) === liveTex) continue;   // the same problem twice
      if (norm(cand.answer) === liveAns) continue;       // the same answer
      if (leaks(cand)) continue;                         // the live answer is readable off it
      noteSituation(cand.scene);
      return cand;
    }
  }

  // LAST PASS, and it only ever runs where the three above found nothing.
  //
  // The digit rule above was written for Level 1, where every answer is one
  // number: if the live answer is 7, a 7 anywhere on the example is a numeral
  // a learner can copy straight across. Level 2 answers are COMPOSITE — a rule
  // `y = 2x + 1`, a rate `1/2`, a point `(4, 3)` — and the same rule then
  // forbids every 1 and every 2 anywhere on any candidate. Measured over the
  // band-1 line forms, that rejected every draw: `write-linear` found no
  // analogue for a third of its items, and an item with no analogue falls back
  // on the LEARNER'S OWN TRACE, whose second worked line prints the slope of
  // the live answer in full. The strict rule was producing the exact leak it
  // exists to prevent.
  //
  // So for a composite answer only, and only after the strict search has
  // failed, the test becomes the one that matches what a learner could
  // actually copy: no component of the live answer may be a component of the
  // example's answer, and the live answer must not appear on the example
  // anywhere as written. A stray `1` inside a coordinate is not an answer.
  const parts = digitsOf(item.answer);
  if (parts.size > 1) {
    for (const pass of passes) {
      for (let i = 0; i < tries; i++) {
        let cand;
        try {
          cand = safeGenerate(item.skill, pass.band, (base + i * 6131 + (pass.sameForm ? 0 : 977) + pass.band * 31) >>> 0,
            { locale, record: false, avoidScenes: avoid, ...(pass.sameForm ? { form: item.form } : {}) });
        } catch { continue; }
        if (!cand) continue;
        if (pass.sameForm && cand.form !== item.form) continue;
        if (skeleton) { if (norm(cand.stem) === norm(item.stem)) continue; }
        else if (norm(cand.latex) === liveTex) continue;
        if (norm(cand.answer) === liveAns) continue;
        // Not one numeral of the live answer may also be a numeral of the
        // example's answer: the two landings have to be readably different.
        let shares = false;
        for (const nmb of digitsOf(cand.answer)) if (parts.has(nmb)) { shares = true; break; }
        if (shares) continue;
        // …and the live answer must not be legible, as written, anywhere on it.
        const surfaces = [cand.latex, cand.answer, ...(cand.steps || []).map((s) => s.latex)].join(' ');
        if (norm(surfaces).includes(liveAns)) continue;
        noteSituation(cand.scene);
        return cand;
      }
    }
  }
  return null;
}

/**
 * Measure the leak rate of a batch of (item, analogue) pairs. Used by the
 * tools; exported so the claim can be checked rather than asserted.
 */
export function leakRate(pairs) {
  let sameAnswer = 0, inSteps = 0;
  for (const [item, ex] of pairs) {
    if (!ex) continue;
    if (norm(ex.answer) === norm(item.answer)) sameAnswer++;
    const digits = digitsOf(item.answer);
    const surfaces = [ex.latex, ex.answer, ...(ex.steps || []).map((s) => s.latex)];
    if (surfaces.some((s) => [...digitsOf(s)].some((n) => digits.has(n)))) inSteps++;
  }
  const n = pairs.filter(([, ex]) => ex).length || 1;
  return { sameAnswer: sameAnswer / n, inSteps: inSteps / n, n };
}
