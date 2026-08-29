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

// ---------------------------------------------------------------------------
// THE ALPHABET THE ENTRY ARRIVES IN.
// ---------------------------------------------------------------------------
/**
 * What a hand types, read as notation.
 *
 * THIS EXISTS BECAUSE THE GATE AND THE GAME WERE SPEAKING DIFFERENT LANGUAGES.
 *
 * `tools/check-echo.mjs` fed every tagged wrong value to `counterexample()` the
 * way the BANK writes it — `2\sqrt{6}` — and read back computed mathematics for
 * all 37,342 of them. The keypad does not write it that way. A backslash cannot
 * be typed, so the pad has its own small plain alphabet (see THE PAD SPEAKS ONE
 * ALPHABET in `src/ui/rift.js`): a radical sign, a fraction bar, a power mark,
 * a plus-or-minus and the two order marks. What the rift handed us was `2√6`,
 * `parse()` refused it, every probe returned nothing, and layer one fell all
 * the way through to the prompt reprinted under "This is what the rift is
 * asking, and nothing more than this."
 *
 * That is the exact defect this module was rewritten to remove, and it was
 * live in the running game on every radical, every plus-or-minus and every
 * fraction a cadet typed, while the gate read 100%. It was found by driving
 * the real keypad with real clicks, which is the only place it is visible.
 *
 * The surface owns the translation it renders with; this is the reader for the
 * one string that crosses back the other way, and `src/learn` may not import
 * `src/ui`. It is TOTAL in the same sense: a string it cannot read comes back
 * unchanged rather than half-converted, and a string that already carries a
 * backslash is bank notation and is left alone. `tools/check-echo.mjs` now
 * pushes every tagged slip through in BOTH spellings and fails if the two
 * disagree, so the two can no longer drift apart in silence.
 */
const PAD_ROOT = '√';
const PAD_PM = '±';
const PAD_LE = '≤';
const PAD_GE = '≥';
/** One atom: a bracketed group, a root, a number, or a letter with its power. */
function padAtomAt(s, i) {
  if (i >= s.length) return null;
  if (s[i] === PAD_ROOT) {
    const inner = padAtomAt(s, i + 1);
    return inner ? { body: s.slice(i, inner.end), end: inner.end } : null;
  }
  if (s[i] === '(') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') { depth--; if (!depth) return { body: s.slice(i + 1, j), end: j + 1 }; }
    }
    return { body: s.slice(i + 1), end: s.length };
  }
  const m = /^(?:\d+|[a-zA-Z](?:\^\d+)?)/.exec(s.slice(i));
  return m ? { body: m[0], end: i + m[0].length } : null;
}

// The glyphs the rest of this module genuinely cannot read.
//
// The pad's plain spelling of a BRACKET, a POWER and a FRACTION BAR is already
// read by `./parser.js` — `2(3x+4)`, `x^2` and `(x+1)/2` all parse — and
// `-1/5` is how the BANK itself writes a rational, so rewriting a bar into
// `\frac` breaks `fromString` on the bank's own values. Five glyphs are
// untranslatable, and those five are all that is translated. Each of them is
// also a unicode maths glyph, which may never reach the DOM (invariant 1), so
// this is the same rewrite the surface's own renderer performs.
const PAD_ONLY = new RegExp(`[${PAD_ROOT}${PAD_PM}${PAD_LE}${PAD_GE}*]`);

/**
 * @param {string} src what the cadet's hand left in the socket
 * @returns {string} the same value, as notation the rest of this module reads
 */
export function padToTex(src) {
  const before = String(src ?? '').trim();
  if (!before) return '';
  // A backslash cannot be typed on the pad, so its presence says this string
  // came out of the bank rather than off a hand.
  if (before.includes('\\')) return before;
  if (!PAD_ONLY.test(before)) return before;
  let s = before.replace(/\s+/g, '');
  // A root whose radicand cannot be grouped is not half-converted: the whole
  // string comes back as it arrived, so a caller never gets a mangled entry.
  for (let guard = 0; guard < 16 && s.includes(PAD_ROOT); guard++) {
    const i = s.indexOf(PAD_ROOT);
    const a = padAtomAt(s, i + 1);
    if (!a) return before;
    s = `${s.slice(0, i)}\\sqrt{${a.body}}${s.slice(a.end)}`;
  }
  s = s.split(PAD_PM).join(' \\pm ');
  s = s.split(PAD_LE).join(' \\le ');
  s = s.split(PAD_GE).join(' \\ge ');
  s = s.replace(/\*/g, ' \\cdot ');
  return s;
}


/**
 * One canonical spelling for two alphabets.
 *
 * A slip has to be recognised whichever way it was written. The bank writes
 * `t < \frac{11}{3}`; the keypad cannot type a backslash, so the same slip
 * arrives as `t<11/3`, and comparing the two as text named nothing. That
 * silence is expensive: the misconception is what aims the echo AND what the
 * worked example is redrawn to carry, so a tag that only survives in the
 * bank's spelling is a tag the running game almost never sees.
 *
 * So both sides are brought down to the plainer of the two alphabets — the one
 * a hand can type — and compared there. Nothing is evaluated and nothing is
 * guessed: this is spelling only.
 */
function canonical(src) {
  const atom = (b) => (/^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(String(b).trim()) ? String(b).trim() : `(${String(b).trim()})`);
  let s = String(src ?? '')
    .replace(/\\left|\\right|\\!|\\,|\;|\\ /g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pm/g, '±')
    .replace(/\\le(?![a-zA-Z])/g, '≤')
    .replace(/\\ge(?![a-zA-Z])/g, '≥');
  for (let guard = 0; guard < 16; guard++) {
    const before = s;
    // Powers first, innermost outward: a brace group inside a fraction stops
    // the fraction from being read at all.
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^$1');
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `${atom(a)}/${atom(b)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => '√' + atom(a));
    if (s === before) break;
  }
  return s.replace(/\s+/g, '');
}
const norm = canonical;

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
  // WHAT THE HAND TYPED, READ AS NOTATION.
  //
  // The keypad cannot type a backslash, so a cadet's `2\sqrt{6}` arrives here
  // as `2√6`. Compared as text against the generator's own tagged values it
  // matched nothing, `equivalent()` refused to parse it, and this returned
  // null — so a named, well-attested slip made on every radical, every
  // plus-or-minus and every fraction in the bank was reported as "we do not
  // know", the echo lost its aim, and the worked example was drawn without the
  // misconception in hand. (see `padToTex`)
  const raw = padToTex(String(response).trim());
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
