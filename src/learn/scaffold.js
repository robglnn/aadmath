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
 * The same notation with every free letter blanked out.
 *
 * THE EXAMPLE MUST NOT BE THE LIVE PROBLEM WITH THE LETTER CHANGED.
 *
 * `digitsOf` strips exponents on purpose — the 2 in `x^{2}` is notation, not a
 * value. On `exponent-product` the exponent IS the answer, so two draws that
 * differ only in their unknown share nothing the digit rule can see: a live
 * `n^{2} \cdot n^{3}` was answered with a worked `t^{2} \cdot t^{3} = t^{5}`,
 * which is not "a different rift, the same shape" — it is the same rift with
 * the letter repainted, and the whole of the answer is printed on it. Measured
 * over the bank that shipped: 38 of 414 analogues at Level 3 and 6 of 554 at
 * Level 2 were the live problem relabelled; Levels 1, 4 and 5 had none.
 *
 * Letters inside a control sequence are notation and are left alone, so
 * `\sqrt`, `\frac` and `\cdot` survive intact and only the unknowns blank.
 */
function blankLetters(s) {
  const t = norm(s);
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
 * Is this answer one bare number, or does it carry notation?
 *
 * The distinction decides which leak rule is the honest one. A bare number is
 * copyable as itself, so no numeral of it may appear anywhere on the example.
 * An answer that carries notation — `2\sqrt{2}`, `y = 2x`, `2 \cdot 2^{n}`,
 * `\left(2x + 3\right)\left(x + 2\right)` — is not one number, and the
 * numeral rule then forbids every 2 and every 3 on every candidate in a bank
 * where every factorisation is built out of the integers 1 to 9.
 */
const bareNumber = (s) => /^\s*-?\d+\s*$/.test(String(s))
  || /^\s*-?\d+\s*\/\s*\d+\s*$/.test(String(s))
  || /^\s*-?\\frac\{\d+\}\{\d+\}\s*$/.test(String(s));

/**
 * Does `needle` stand on its own inside `hay`?
 *
 * Plain `includes` reads `23` out of `1234` and calls the example a leak, and
 * a rule that fires on honest content is a rule somebody switches off. A match
 * counts only where it is not butted up against another digit or letter at the
 * end that would run into it.
 */
function standsAlone(hay, needle) {
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
  // The same two, with every unknown blanked. See `blankLetters`: a candidate
  // that matches either of these is the live problem with the letter repainted.
  const liveTexBlank = blankLetters(item.latex || '');
  const liveAnsBlank = blankLetters(item.answer);
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
    // THE LIVE ANSWER, AS WRITTEN, ANYWHERE ON THE EXAMPLE.
    //
    // The numeral rule below cannot see this one, because it strips exponents:
    // a live answer of `x^{2}` beside a worked `\frac{x^{6}}{x^{2}}` shares no
    // numeral run at all, and the answer is printed on the example all the
    // same. Rows are joined with a separator so that two rows butted together
    // cannot manufacture a match that neither of them contains.
    if (standsAlone(surfaces.map(norm).join(' | '), liveAns)) return true;
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
      else if (blankLetters(cand.latex || '') === liveTexBlank) continue; // …under another letter
      if (norm(cand.answer) === liveAns) continue;       // the same answer
      if (blankLetters(cand.answer) === liveAnsBlank) continue; // …under another letter
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
  // So for an answer that CARRIES NOTATION, and only after the strict search
  // has failed, the test becomes the one that matches what a learner could
  // actually copy: the live answer must not be legible on the example
  // anywhere as written, and the example's landing must not be the live
  // landing under another letter. A stray `1` inside a coordinate is not an
  // answer, and neither is the 3 inside `\left(2x + 3\right)`.
  //
  // WHICH ANSWERS COUNT AS COMPOSITE WAS THE BUG. The gate was
  // `digitsOf(item.answer).size > 1` — the count of distinct numeral RUNS in
  // the answer — and that reads `2\sqrt{2}`, `y = 2x`, `2 \cdot 2^{n}`, `-2`
  // and `n + 4` as one number apiece, so the relaxed pass never ran for them
  // and the strict numeral rule was the only rule they ever met. Measured over
  // the shipped bank, that left the deepest teaching layer with no example at
  // all for 2.8% of Level 3 items, 3.9% of Level 4 and 8.6% of Level 5 —
  // against 0.0% at Levels 1 and 2, where the answers really are bare numbers
  // and the strict rule is the right one. `bareNumber` asks the question the
  // comment above always meant to ask.
  //
  // The second half was wrong for the same reason. "Not one numeral of the
  // live answer may also be a numeral of the example's answer" cannot be
  // satisfied on `factor-trinomial-lead`, where every answer in the bank is
  // built from the integers 1 to 9 — so every draw was refused and every one
  // of those items fell back on the learner's own trace. What a learner can
  // actually copy is the answer AS WRITTEN, and that is what is tested.
  if (!bareNumber(item.answer)) {
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
        else if (blankLetters(cand.latex || '') === liveTexBlank) continue;
        if (norm(cand.answer) === liveAns) continue;
        // The two landings have to be readably different, and changing the
        // unknown does not make them different.
        if (blankLetters(cand.answer) === liveAnsBlank) continue;
        // …and the live answer must not be legible, as written, anywhere on it.
        const surfaces = [cand.latex, cand.answer, ...(cand.steps || []).map((s) => s.latex)];
        if (standsAlone(surfaces.map(norm).join(' | '), liveAns)) continue;
        if (!carriesSlip(cand, mis)) { fallback ||= cand; continue; }
        noteSituation(cand.scene);
        return cand;
      }
    }
  }
  // AND A LAST ONE FOR A BARE NUMBER, WHICH IS WHERE THE STRICT RULE BITES.
  //
  // `residual-and-fit` asks for a gap and the gap is `-1`. `scatter-regression`
  // asks for a rate and the rate is `3`. Every one of those prompts is a table
  // of five small readings, and the strict rule forbids the example from
  // printing a standalone `1` or `3` ANYWHERE, its own table included. No draw
  // in the bank survives that, so the deepest layer fell back on the learner's
  // own problem for 5.7% of Level 5 items.
  //
  // A reading in somebody else's table is not an answer to anything. What a
  // learner can copy is the example's LANDING, and the numbers its worked
  // lines come to on the way — so those are what the live answer may not be.
  // The example's prompt is left free, because a `3` sitting in a column of a
  // different situation is a reading and not a result.
  if (bareNumber(item.answer)) {
    const liveNumerals = digitsOf(item.answer);
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
        else if (blankLetters(cand.latex || '') === liveTexBlank) continue;
        if (norm(cand.answer) === liveAns) continue;
        // Not the landing, and not anything a worked line comes to.
        let copyable = false;
        for (const nmb of digitsOf(cand.answer)) if (liveNumerals.has(nmb)) { copyable = true; break; }
        if (!copyable) {
          for (const st of cand.steps || []) {
            for (const nmb of digitsOf(st.latex)) if (liveNumerals.has(nmb)) { copyable = true; break; }
            if (copyable) break;
          }
        }
        if (copyable) continue;
        const surfaces = [cand.latex, cand.answer, ...(cand.steps || []).map((s) => s.latex)];
        if (standsAlone(surfaces.map(norm).join(' | '), liveAns)) continue;
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
