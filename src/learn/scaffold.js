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
import { explains } from './diagnose.js';

/**
 * THE ANALOGUE HAS TO BE AN ANALOGUE OF THE *SLIP*, NOT ONLY OF THE ITEM.
 *
 * The deepest layer of the echo is captioned "A different rift, the same
 * shape", and a cold critic read that caption over a worked example that was
 * not the same shape at all: the learner's error had been a **negative sign**,
 * and every number in the example was positive. Nothing in it could have gone
 * wrong the way their answer went wrong, so the one thing the layer promises —
 * *this is your mistake, made somewhere else* — was the one thing it did not
 * deliver. The caption was writing a cheque the chooser never knew about.
 *
 * The chooser was picking for *structural* sameness: same skill, same form,
 * same band, different digits. That is the right test for a completion problem
 * and it is blind to the only question the deep layer asks. So when the rig
 * knows which misconception the learner revealed, a candidate now has to pass
 * a second test as well.
 *
 * Two tests, strongest first:
 *
 *   1. THE EXAMPLE CAN GO WRONG THE SAME WAY. `explains(cand, mis)` asks the
 *      generator's own diagnostic table whether this candidate carries a wrong
 *      value that this misconception would produce. If it does, the mistake is
 *      genuinely available on the example — the two problems are the same shape
 *      in the sense the caption means.
 *   2. AND, FOR THE SIGN FAMILY, THE SIGN IS ACTUALLY IN PLAY. A misconception
 *      about a lost or misplaced negative is not reproducible on a problem with
 *      no negative in it, whatever a distractor table says, because the learner
 *      cannot see the thing they got wrong. So those tags additionally require
 *      a negative number somewhere the learner will read: the prompt, the
 *      answer, or a worked line.
 *
 * The requirement is a PREFERENCE and not a wall. If no candidate in the whole
 * search can carry the slip, the ordinary structural analogue is returned
 * rather than nothing — a structurally-matched example is a weaker lesson than
 * a slip-matched one, and both are far better than no example at all, which
 * falls back on the learner's own trace.
 */
const SIGN_SLIPS = new Set([
  'sign-slip', 'sign-on-constant', 'same-op-both', 'sign-on-distribute',
  'negative-coefficient', 'drop-negative', 'sign-both-sides',
]);

/** Is there a negative number anywhere this learner would read it? */
function signInPlay(cand) {
  const surfaces = [cand.latex || '', cand.answer, ...(cand.steps || []).map((x) => x.latex)];
  // A minus that stands between two things is a subtraction, not a negative
  // quantity; the one that matters is the sign attached to a number.
  return surfaces.some((x) => /(^|[\s(={+\-*/,])-\s*\d/.test(String(x)));
}

/**
 * Does this candidate share the structure that produced `mis`?
 * True when no misconception is known — every candidate is equally suitable
 * then, and this must not narrow a search it has nothing to say about.
 */
function carriesSlip(cand, mis) {
  if (!mis) return true;
  if (SIGN_SLIPS.has(mis) && !signInPlay(cand)) return false;
  return explains(cand, mis);
}

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
  // The slip the learner actually revealed, when the rig knows it. See
  // `carriesSlip`: this narrows the search to examples the mistake could have
  // been made on, and gives way rather than return nothing.
  const mis = opts.misconception || null;
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
  const onScreen = digitsOf(item.latex || '');
  const liveTex = norm(item.latex || '');
  const liveAns = norm(item.answer);
  // Items whose prompt is not a problem in itself — the "which equation models
  // this?" forms, which now carry no display at all rather than a row of empty
  // boxes. For those, sameness lives in the situation and not in the notation.
  const skeleton = !!item.noDisplay || /\\square/.test(item.latex || '');
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
  // The structural analogue that would have been returned before the slip test
  // existed. Kept so the slip requirement can be a preference: if nothing in
  // the whole search can carry the learner's mistake, this is what comes back,
  // rather than no example at all.
  let fallback = null;
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
      else if (norm(cand.latex || '') === liveTex) continue;   // the same problem twice
      if (norm(cand.answer) === liveAns) continue;       // the same answer
      if (leaks(cand)) continue;                         // the live answer is readable off it
      // …AND IT HAS TO BE THE SAME SHAPE IN THE SENSE THE CAPTION MEANS.
      if (!carriesSlip(cand, mis)) { fallback ||= cand; continue; }
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
        else if (norm(cand.latex || '') === liveTex) continue;
        if (norm(cand.answer) === liveAns) continue;
        // Not one numeral of the live answer may also be a numeral of the
        // example's answer: the two landings have to be readably different.
        let shares = false;
        for (const nmb of digitsOf(cand.answer)) if (parts.has(nmb)) { shares = true; break; }
        if (shares) continue;
        // …and the live answer must not be legible, as written, anywhere on it.
        const surfaces = [cand.latex, cand.answer, ...(cand.steps || []).map((s) => s.latex)].join(' ');
        if (norm(surfaces).includes(liveAns)) continue;
        if (!carriesSlip(cand, mis)) { fallback ||= cand; continue; }
        noteSituation(cand.scene);
        return cand;
      }
    }
  }
  // Nothing in the bank could carry this learner's slip. A structurally-matched
  // example is a weaker lesson than a slip-matched one and a far better one
  // than none — an item with no example falls back on the learner's own trace,
  // which is the single trace that cannot help but contain the live answer.
  if (fallback) { noteSituation(fallback.scene); return fallback; }
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
