/**
 * Naming a learner's error — and refusing to name it when we do not know.
 *
 * The rig tells the learner things about their own thinking ("they read the
 * letter as a thing being counted"). That is the most powerful line in the
 * whole surface and the easiest one to abuse: a keypad accepts *anything*, so
 * most wrong entries are not any tagged misconception at all. Attaching the
 * item's first distractor tag to an arbitrary entry is not feedback, it is
 * fabrication — the game asserting a fact about a mind it has no evidence
 * about.
 *
 * So this module answers with a misconception only on evidence:
 *
 *   1. the entry is one of the item's tagged diagnostics — the wrong value that
 *      *this* misconception produces on *this* item, computed by the generator;
 *   2. or it is a structural certainty that holds for any item of this shape:
 *      the exact negation of the answer (a sign lost), or a value one or two
 *      away from it when everything else was right (an arithmetic slip);
 *
 * and otherwise returns null, which the surface renders as the untargeted
 * trace: "someone stood here once; this is what they left behind." No claim
 * about the learner is made, because none is warranted.
 *
 * `explains()` is the mirror image, used by the tools: given a misconception
 * tag, can this item actually produce it? A tag the bank cannot produce is a
 * tag the echo can never earn.
 */
import { equivalent } from './parser.js';

const norm = (s) => String(s).replace(/\s+/g, '').replace(/\\left|\\right/g, '').replace(/\\!|\\,|\\;/g, '');

/** "12", "-3", "7/2" -> {n, d}; anything else -> null. */
function ratio(s) {
  const m = String(s).trim().match(/^(-?\d+)(?:\s*\/\s*(\d+))?$/);
  if (!m) return null;
  const d = Number(m[2] || 1);
  if (!d) return null;
  return { n: Number(m[1]), d };
}
const rEq = (a, b) => a && b && a.n * b.d === b.n * a.d;

/**
 * @param {object} item a generated item
 * @param {string} response exactly what the learner entered
 * @returns {string|null} a misconception id, or null when we cannot say
 */
export function diagnose(item, response) {
  if (!item || response == null) return null;
  const raw = String(response).trim();
  if (!raw) return null;

  // A correct answer is never an error, however it was written.
  const want0 = ratio(item.answer);
  const got0 = ratio(raw);
  if (norm(raw) === norm(item.answer) || (got0 && want0 && rEq(got0, want0))) return null;

  const tagged = item.diagnostics && item.diagnostics.length ? item.diagnostics : (item.distractors || []);

  // 1. Exact textual match against a value this item knows how to explain.
  const key = norm(raw);
  for (const d of tagged) if (norm(d.value) === key) return d.misconception;

  // 2. Same value, different notation. "6/3" is "2"; "2x+3" is "3+2x".
  const got = ratio(raw);
  if (got) {
    for (const d of tagged) {
      const dv = ratio(d.value);
      if (dv && rEq(got, dv)) return d.misconception;
    }
  } else if (item.type === 'expression') {
    const variable = item.check?.variable || (String(item.answer).match(/[a-zA-Z]/) || [])[0];
    if (variable) {
      for (const d of tagged) {
        let same = false;
        try { same = equivalent(raw, d.value, variable) === true; } catch { same = false; }
        if (same) return d.misconception;
      }
    }
  }

  // 3. Structural certainties. These hold whatever the item is, so they are
  //    honest without needing the generator to have foreseen them.
  const want = ratio(item.answer);
  if (got && want) {
    if (rEq(got, { n: -want.n, d: want.d })) return 'sign-slip';
    if (got.d === want.d) {
      const off = Math.abs(got.n - want.n);
      if (off > 0 && off <= 2 && Math.abs(want.n) >= 3) return 'arith-slip';
    }
  }

  // 4. We do not know. Say nothing about this learner's mind.
  return null;
}

/** Does this item carry a wrong value that would reveal `misconception`? */
export function explains(item, misconception) {
  if (!misconception) return false;
  return (item.diagnostics || []).some((d) => d.misconception === misconception);
}

/** Every misconception this item is able to recognise. */
export function tagsOf(item) {
  return [...new Set((item.diagnostics || []).map((d) => d.misconception))];
}
