/**
 * THE SHAPE OF AN OPTION SET, AND HOW TO KEEP IT FROM NAMING THE KEY.
 *
 * WHY THIS FILE EXISTS
 *
 * Several surfaces in this game put a set of readings in front of a learner and
 * ask which one is right, and on all of them the same defect keeps coming back:
 * the right one LOOKS different. Wrong answers drift longer than right ones, so
 * the key came out the shortest string in the set and "pick the shortest" scored
 * 39% against a 25% baseline. The repair for that guaranteed the key was never
 * the unique shortest and never the unique longest, which turned a cue that was
 * right 39% of the time into an elimination rule that was right 100% of the
 * time. The repair after THAT drew the key's place from the card's own hash,
 * which was right in shape and wrong in measurement: the weights were fitted to
 * an average over every card in the bank, and 71% of those cards never show an
 * option set at all.
 *
 * THE RULE. On each surface a learner is shown, every cue an eye can read must
 * be worth exactly what chance is worth. Not "the key is never extreme", not
 * "the key is sometimes extreme", and not "on average over everything".
 *
 * A cue that never fires leaks nothing. A cue that fires must name the key 1/k
 * of the time. Both halves matter, and the second is why the target is DRAWN
 * rather than clamped.
 *
 * WHERE IT IS USED
 *
 *   `src/learn/generators.js`  chooses which three of a catalogue of
 *                              recognisable errors to show, and in which order
 *                              — the four-option card shows all three, the
 *                              narrowed field shows the first two.
 *   `src/ui/rift.js`           chooses which four of the beam's legal-but-wrong
 *                              moves to offer beside the ideal one, and which
 *                              two shards stand beside each right one on the
 *                              area field's tray.
 *
 * The surfaces used to be unrelated, and the beam's tray was never balanced at
 * all: "take the unique fewest-digits option" named the ideal move 42% of the
 * time against 24.6%, and the ideal move sat in the LAST slot 30% of the time
 * against 20%, because a shuffle that dropped it simply appended it.
 *
 * WHAT MEASURES IT. Not this file. `tools/critic/choiceshape.mjs` reads every
 * answer surface off the shipped `src/ui/rift.js`, keeps its OWN list of cues,
 * and judges each surface separately against that surface's own chance. It has
 * to keep its own list: a gate that shares the generator's idea of what a cue is
 * cannot catch a cue the generator never thought of.
 *
 * ---------------------------------------------------------------------------
 * THE FOURTH REPAIR, AND WHY THE THIRD ONE COULD NOT WORK — READ THIS FIRST.
 * ---------------------------------------------------------------------------
 *
 * The third repair — the one this rewrite replaces — asked each cue for a target
 * of its own, drew those targets INDEPENDENTLY, put the cues in a per-card drawn
 * order, and took the candidate set answering the longest prefix of that order.
 * Every single cue then came out at chance, and it was measured and true: on the
 * narrowed field "take the unique longest option", "take the unique shortest",
 * "the unique most digits" and "the unique fewest" all sat inside the band.
 *
 * And a cadet who struck EVERY unique extreme at once still first-picked
 * **45.74% against 33.33%**, on 97% of 10,260 route sets.
 *
 * THE MECHANISM, because it is not obvious and it cost three rounds. A
 * three-option set has exactly three places on any ordinal measure: least,
 * middle, greatest. "The key is not the unique least and not the unique
 * greatest" therefore means THE KEY IS THE MIDDLE ONE — and if the key is the
 * middle one, the two distractors ARE the two extremes, so a rule that strikes
 * every extreme strikes both of them and leaves the key standing alone. Asking
 * four separate cues each to be at chance pushed the key into the middle far
 * more often than a third of the time, because "at chance" for a one-option cue
 * is 1/3 for KEY and 2/3 for OTHER, and OTHER on a three-set means the middle.
 * Every marginal was flat and the joint was a giveaway.
 *
 * Four experiments confirmed the diagnosis by making it worse in four different
 * ways. Measured on the shipped route, the cadet who reads no mathematics on the
 * narrowed field (chance 33.33%):
 *
 *     size not asked for at all                            45.74%   <- shipped
 *     + both size ends, its drawn place and its flatness   51.37%
 *     + both size ends only                                55.95%
 *     size ends IN PLACE OF the digit ends (budget kept)   55.81%
 *     + the composite as its own cue                       45.98%
 *
 * Adding cues made the composite STRONGER, which is the signature of this
 * failure and not of a shortage of cues: every cue added is one more reason to
 * put the key in the middle.
 *
 * IT WAS NEVER THE CATALOGUE. That was the first guess and it is measurable and
 * false: over 3,564 route keypad cards the pack offers a wrong value on BOTH
 * sides of the key on 96.4% of them, 74.7% can put the key in ANY of the three
 * places by size, and the median card can offer 17 distinct pairs. The freedom
 * was there. What was missing was anything that asked for all of it at once.
 *
 * WHAT THIS FILE DOES NOW: ONE TARGET FOR EVERY RULE, AND ONE SET CLOSEST TO
 * ALL OF THEM TOGETHER.
 *
 * The null hypothesis every one of these gates tests is a single sentence: THE
 * KEY IS JUST ANOTHER OPTION. Written out, it says that given the k shapes on
 * the glass, which of them is the right one is a uniform draw. That statement
 * has a property worth the whole rewrite: for ANY rule a cadet can play — one
 * this file knows, one it does not, one nobody has thought of yet — the value of
 * that rule on a fixed set of shapes, summed over "what if option i were the
 * key", is exactly 1, because the survivors of the rule share a total of 1
 * between them. So under exchangeability every strategy is worth exactly 1/k,
 * with no list of cues anywhere in the argument.
 *
 * So for one card this file:
 *
 *   1. takes every option set the caller is willing to show and DEDUPLICATES
 *      them by what is on the glass — the order inside a set is thrown away by
 *      `arranged()` a moment later, so two orderings of one set are one set and
 *      must not vote twice;
 *   2. scores every one of them against TWENTY-NINE rules at once — the least
 *      and greatest end of three ordinal measures, taken and struck; eight
 *      written features, taken and struck; and the composite that strikes every
 *      unique extreme together — as WHAT EACH RULE IS WORTH TO A CADET WHO
 *      PLAYS IT, `1/|survivors|` when the key survives it and 0 when it does
 *      not. That is the same arithmetic the gate scores every strategy on, and
 *      it is what makes twenty-nine rules comparable on one scale;
 *   3. asks each rule for a value DRAWN from the two ends this card can reach,
 *      mixed so the mean is exactly `1/k` (`drawTargets`);
 *   4. shows the set closest to all twenty-nine answers at once, in
 *      family-weighted squared distance — never the longest prefix of a drawn
 *      order, which is the design this replaced.
 *
 * THE COMPOSITE IS ONE OF THE TWENTY-NINE, and it has to be, because what a
 * rule is worth is `1/|survivors|` and how many options survive "strike every
 * unique extreme" is a fact about the WHOLE SET that no statement about one
 * place in it settles. Two sets that put the key in identical places on all
 * three measures can leave one option standing and three.
 *
 * AND THE WALL THIS CANNOT CLIMB, MEASURED RATHER THAN GUESSED AT. Where only
 * ONE measure is live on a card, "the key survives the composite" and "the key
 * is not the unique smallest" are the SAME statement, so a catalogue with no
 * wrong value above the answer cannot put both at chance whatever this function
 * does; the best any arrangement could reach is a half on each.
 * `multi-step/ms-context` is the clearest case: the answer is 5 and the whole
 * catalogue is 4, 6, 37/6, 22/3, 10, 30 — ONE value below the key and five
 * above — so the key can be the middle of three or the smallest of three and
 * can never be the biggest, and the two rules trade off one for one.
 *
 * SEVENTEEN route FORMS on the narrowed field are still over the seven-point
 * band. A GREEDY ORACLE that is allowed to see the whole population — it picks
 * each card's set knowing the running mean of all 32 of the gate's strategies,
 * which no per-card rule can ever do — clears SEVEN of them and cannot clear
 * the other TEN. So seven are worth more work here and ten are a catalogue with
 * nothing on one side of the key, and the difference is written down so the
 * next lane does not have to re-derive it:
 *
 *     worth more work here   ee-context 3.9, bbs-symbolic 2.4, sr-points 4.4,
 *                            se-add 4.8, i2-limit 6.0, se-context 6.7,
 *                            fs-split 6.7   (points the oracle can reach)
 *     the catalogue's wall   ms-context 33.3, lt-perimeter 33.3,
 *                            ms-bracket 29.8, ss-forx 15.6, sr-graph 10.4,
 *                            rft-dispute 9.8, gl-cross 9.3, i2-edge 8.8,
 *                            ee-graph 8.1, sr-context 7.8
 *
 * AND THE TRAP THIS FILE HAS ALREADY FALLEN INTO ONCE. Nothing here forces the
 * key to be non-extreme, or extreme, or anything else. Forcing the key never to
 * be the unique shortest is what turned a 39% cue into a 100% elimination rule,
 * and it is the same move as forcing it to be the middle. RANDOMISE, DO NOT
 * EQUALISE: the key is the unique biggest about a third of the time, the unique
 * smallest about a third of the time, and in the middle about a third of the
 * time, because that is what an option that carries no information looks like.
 */

/**
 * HOW LONG AN OPTION LOOKS, in glyphs a learner can actually see.
 *
 * Not the length of the LaTeX. `\div\; 4` is eight characters of source and
 * three marks on the glass, of which one is a spacing macro that draws nothing;
 * `+\; 8` is six characters and the same three marks. Counting the source made
 * the beam's ideal move the "longest" thing on its tray 27% of the time when a
 * cadet looking at the screen could see no such thing — a finding about the
 * notation this file writes rather than about the surface a learner meets.
 *
 * So: spacing and sizing macros draw nothing and are dropped, every other
 * control sequence is one mark, braces are grouping and are dropped, and the
 * words inside `\text{}` are counted as the words they are.
 */
export function shapeLen(x) {
  return String(x)
    .replace(/\\left|\\right|\\[,;:!]|\s+/g, '')
    .replace(/\\[a-zA-Z]+/g, '@')
    .replace(/[{}]/g, '')
    .length;
}

/** How many digits an option carries — the other thing an eye counts. */
export function shapeDigits(x) {
  const s = String(x);
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c >= 48 && c <= 57) n++; }
  return n;
}

/**
 * HOW BIG THE NUMBER AN OPTION CARRIES IS — the third thing an eye reads.
 *
 * Neither count above can see it: `-800` is longer than `12` and carries more
 * digits while being the smaller number, so a set balanced on length and digits
 * can still put the key at one end of the size order every time. It did. Over
 * 10,260 route narrowed fields "take the biggest of the three" named the key
 * 19.96% of the time against 33.33%, so its mirror "strike the biggest" named it
 * 40.02%, and the key's place by size ran 34.0 / 46.0 / 20.0 against 33.3 apiece.
 *
 * This used to be a written argument for why size was NOT read here — a
 * fifteenth cue could only be paid for out of the fourteen under it, because
 * the old design answered the longest PREFIX of a drawn cue order. Scoring
 * every rule at once has no prefix and no budget to pay out of: size is four
 * rules of twenty-nine, and adding it costs the other twenty-five nothing.
 *
 * Anything that does not read as one signed number is NaN, and a set carrying a
 * NaN leaves every size rule undecided rather than guessing — the same
 * discipline `tools/critic/choiceshape.mjs` holds, and for the same reason: a
 * measurement that guesses is worse than one that says it cannot see.
 */
export function shapeSize(x) {
  let t = String(x).replace(/\\left|\\right|\\[,;:!]|\s+/g, '');
  const fr = t.match(/^(-?)\\frac\{(-?\d+)\}\{(-?\d+)\}$/);
  if (fr) return (fr[1] === '-' ? -1 : 1) * Number(fr[2]) / Number(fr[3]);
  t = t.replace(/\\[a-zA-Z]+\{[^{}]*\}/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/\\[^a-zA-Z]/g, '');
  const m = t.match(/^([+-]?)(\d+)(?:\/(\d+))?/);
  if (!m) return NaN;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * Number(m[2]) / (m[3] ? Number(m[3]) : 1);
}

/**
 * THE EIGHT WRITTEN FEATURES, as one bitmask per option.
 *
 * Everything here is something a cadet can see at a glance in a rendered option
 * without knowing what any of it means: a minus hanging off the front, a bar
 * with something over and under it, a relation sign, a phrase in words, a
 * letter, a root, a division glyph, a numeral at all. `words` is on the list
 * because of the special-answer card, where the key is a PHRASE and two of the
 * four readings used to be bare numbers — "strike every bare number" first-picked
 * 50.00% against 25%. Writing those two as phrases that NAMED a number moved the
 * same cue one step along — the key was still one of the two readings with no
 * digit in it — which is why the wrong readings on that card now name a COUNT
 * and not a value.
 *
 * THE DIVISION GLYPH. The beam's move tray is an option set whose members differ
 * by their OPERATOR, and no count above can see one: `\div\; 4` and `+\; 8` are
 * the same printed length, carry the same digit count and share every other
 * feature. Written for three locales, because es and pl set division with a
 * colon and an eye does not care which glyph a locale chose.
 *
 * "DOES IT CARRY A NUMERAL AT ALL" is here now, and it was not before, and the
 * reason it was not is the whole argument for this rewrite. It is the digit
 * count with everything above zero folded together, so under the old
 * prefix-scoring scheme it stole a turn from the four finer questions about
 * that count and pushed the beam's ideal move back into the first place by
 * digits, +6.3 points off 20. Scoring every rule at once has no turns to
 * steal: the fine questions and the coarse one are asked in the same pass, and
 * the gate reads the coarse one whether this file does or not.
 */
export function shapeFeatures(s) {
  const t = String(s);
  let b = 0;
  if (/(^|[^0-9A-Za-z}])-/.test(t)) b |= 1;
  if (/\\frac|\//.test(t)) b |= 2;
  if (/[=<>]|\\le|\\ge|\\neq/.test(t)) b |= 4;
  if (/\\text\{/.test(t)) b |= 8;
  if (/[A-Za-z]/.test(t.replace(/\\[a-zA-Z]+/g, ' ').replace(/\\text\{[^}]*\}/g, ' '))) b |= 16;
  if (/\\sqrt/.test(t)) b |= 32;
  if (/\\div|\\mathbin\{:\}|÷/.test(t)) b |= 64;
  if (/[0-9]/.test(t)) b |= 128;
  return b;
}

/**
 * A 32-bit avalanche over a string.
 *
 * The same mixer `arranged()` uses in `src/ui/rift.js`, for the reason written
 * down there: a placement drawn from `% n` of an unmixed value is not a
 * placement, it is a pattern with a different shape.
 */
export function shapeMix(salt) {
  let h = 0x811c9dc5 >>> 0;
  const s = String(salt);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
/** A uniform in [0,1) drawn from one hash and one label. */
export const shapeUnit = (h, tag) => shapeMix(`${h}|${tag}`) / 4294967296;

/** The three ordinal measures a set can be put in order by. */
const METRICS = [shapeLen, shapeDigits, shapeSize];
/** The written features, in the order the cue vector lists them. */
const FEATURE_BITS = [1, 2, 4, 8, 16, 32, 64, 128];
/**
 * HOW MANY RULES ARE READ AT ONCE.
 *
 * Three measures, each with a least and a greatest end, each end with the rule
 * that TAKES it and the rule that STRIKES it — a cadet who has learned a cue is
 * inverted plays it just as well backwards. Eight written features, each with
 * "take the ones that have it" and "take the ones that do not". And the
 * composite, which is none of them and all of them at once.
 */
/**
 * AND THE THREE THE SENTENCE OVER THE SET CARRIES.
 *
 * Every rule above reads the options alone. A whole family of forms in this
 * bank prints a reading INTO THE STEM — a graph card names the values it plots,
 * a dispute card chalks two readings and asks which is true — and quoting is a
 * cue an eye reads before it reads anything else. Measured on the shipped
 * route, before this family existed: on `eval-expr/ee-graph` "take the ones the
 * stem prints" named the key 18.8% against 33.3% over 144 sets, decisive on
 * 44% of them, and its mirror "take the ones the stem does NOT print" was
 * therefore worth 40.6%; `graph-linear/gl-cross` read 21.5%. Nothing in the
 * twenty-nine rules could see either, because both readings are honest numbers
 * of the same length carrying the same glyphs.
 *
 * The stem is OPTIONAL. A caller that has one hands it over; a caller that has
 * none (the beam's move tray, the area field's shards) leaves these three at
 * `1/k` on every candidate, which makes them identical on every candidate,
 * which makes their target a constant and their say in the choice exactly
 * nothing. One code path, not two.
 */
const STEM_CUES = 3;
const CUE_COUNT = METRICS.length * 4 + FEATURE_BITS.length * 2 + 1 + STEM_CUES;

/* Reading the stem the way `tools/critic/choiceshape.mjs` reads it, and for the
   reason written down there: a stem writes `$x \ge -4$` and the option is
   `x \ge -4`, so whitespace collapses to ONE space rather than none — squeezing
   it all out makes "makesit18" run a letter against the `1` and a boundary test
   then refuses a quotation that a learner can plainly see. Both normalisations
   are tried, because an eye does not care which one matched. */
const stemBare = (x) => String(x).replace(/\\left|\\right/g, '').replace(/\s+/g, ' ').trim();
const stemSqueeze = (x) => String(x).replace(/\s+/g, '');
const stemWordish = (c) => c !== undefined && /[0-9A-Za-z]/.test(c);
function stemFind(hay, needle) {
  if (needle.length < 2) return -1;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (stemWordish(needle[0]) && stemWordish(hay[i - 1])) continue;
    const end = i + needle.length;
    if (stemWordish(needle[needle.length - 1]) && stemWordish(hay[end])) continue;
    return i;
  }
  return -1;
}
/** Where the stem prints this reading whole, or -1 — never inside a longer number. */
function stemAt(hay, needle) {
  const a = stemFind(hay, needle);
  return a >= 0 ? a : stemFind(stemSqueeze(hay), stemSqueeze(needle));
}

/**
 * WHAT EVERY CUE IS WORTH TO A CADET WHO PLAYS IT, if option `at` were the key.
 *
 * One number per rule: `1/|survivors|` when this option survives the rule, 0
 * when the rule strikes it, and `1/k` when the rule refuses nothing at all —
 * which is a cadet who learned nothing from it and guesses. That is the same
 * arithmetic `tools/critic/choiceshape.mjs` scores every strategy on, and it is
 * what makes twenty-nine rules comparable on one scale: under the null this
 * whole file is defending — the key is shape-wise just another option — EVERY
 * one of these is worth exactly `1/k`, whatever the rule is and whatever the
 * set looks like.
 *
 * A measure that cannot be read on every option in the set (a size that is not
 * one signed number) puts nothing in order, so its four rules refuse nothing.
 *
 * @param {Array<[number, number, number, number, string]>} rows per option:
 *        printed length, digit count, size, feature mask, and the option as it
 *        is written, which is what the stem rules match against.
 * @param {number} at which option to value the rules for.
 * @param {string} stem the sentence over the set, or '' when there is none.
 * @param {number[]} out a reusable array of length CUE_COUNT, filled in place.
 */
function cueValues(rows, at, stem, out) {
  const k = rows.length;
  const flat = 1 / k;
  for (let c = 0; c < CUE_COUNT; c++) out[c] = flat;
  /* Struck by "cross off anything that stands out" — the option standing alone
     at one end of a measure an eye can read. */
  let struck = 0;
  let c = 0;
  for (let m = 0; m < METRICS.length; m++) {
    let readable = true;
    for (let i = 0; i < k; i++) {
      const v = rows[i][m];
      if (typeof v !== 'number' || !Number.isFinite(v)) { readable = false; break; }
    }
    for (let d = 0; d < 2; d++) {
      let sole = -1;
      if (readable) {
        let best = rows[0][m], where = 0, ties = 1;
        for (let i = 1; i < k; i++) {
          const v = rows[i][m];
          if (d === 0 ? v < best : v > best) { best = v; where = i; ties = 1; }
          else if (v === best) ties++;
        }
        if (ties === 1) sole = where;
      }
      if (sole >= 0) {
        struck |= 1 << sole;
        out[c] = at === sole ? 1 : 0;
        out[c + 1] = at === sole ? 0 : 1 / (k - 1);
      }
      c += 2;
    }
  }
  for (let f = 0; f < FEATURE_BITS.length; f++) {
    let n = 0;
    for (let i = 0; i < k; i++) if (rows[i][3] & FEATURE_BITS[f]) n++;
    if (n > 0 && n < k) {
      const has = !!(rows[at][3] & FEATURE_BITS[f]);
      out[c] = has ? 1 / n : 0;
      out[c + 1] = has ? 0 : 1 / (k - n);
    }
    c += 2;
  }
  /* THE COMPOSITE, and why it is one entry and not a summary of the twelve
     above it. What a rule is worth is `1/|survivors|`, and how many options
     survive "strike every unique extreme at once" is a fact about the WHOLE SET
     that no statement about one place in it settles: two sets that put the key
     in identical places on all three measures can leave one option standing and
     three. A rule that leaves nothing standing has refused nothing, which is
     how the gate reads it too. */
  let live = 0;
  for (let i = 0; i < k; i++) if (!(struck & (1 << i))) live++;
  if (live) out[c] = (struck & (1 << at)) ? 0 : 1 / live;
  c += 1;
  /* WHAT THE SENTENCE OVER THE SET PRINTS. A reading the stem names is a
     reading an eye lands on first, so it is read here exactly as the gate reads
     it: the ones the stem prints, the ones it does not, and the one it prints
     FIRST. A stem that prints all of them or none of them has refused nothing,
     which is the same neutral answer every other rule gives in that case. */
  if (stem) {
    const s = stemBare(stem);
    let n = 0, first = -1, best = Infinity;
    const q = new Array(k);
    for (let i = 0; i < k; i++) {
      q[i] = stemAt(s, stemBare(rows[i][4]));
      if (q[i] >= 0) { n++; if (q[i] < best) { best = q[i]; first = i; } }
    }
    if (n > 0 && n < k) {
      out[c] = q[at] >= 0 ? 1 / n : 0;
      out[c + 1] = q[at] >= 0 ? 0 : 1 / (k - n);
    }
    if (first >= 0) out[c + 2] = at === first ? 1 : 0;
  }
  return out;
}


/**
 * WHAT THIS CARD CAN BE ASKED FOR, ONE RULE AT A TIME, OUT OF WHAT IT CAN REACH.
 *
 * A cue's target is not a constant and is not fitted to the bank. It is drawn,
 * per card, from the two ENDS this card's own catalogue can actually reach on
 * that rule, mixed so the mean is exactly `1/k`:
 *
 *     P(the high end) = (1/k - lo) / (hi - lo)
 *
 * Everything the earlier hand-written policy said falls out of that one line,
 * which is why the policy is gone and the line is here.
 *
 *   · both ends reachable — the key can be the unique longest, and some
 *     distractor can be — then `lo` is 0 and `hi` is 1 and the draw asks for
 *     the key exactly `1/k` of the time. Over the population the rule names the
 *     key at chance, which is the whole claim.
 *   · THE KEY CAN NEVER BE THE UNIQUE LONGEST, but it can TIE for it. Then the
 *     reachable ends are 0 and `1/k`, the formula gives P = 1, and the card is
 *     asked for the tie — a rule that does not fire at all. That is the honest
 *     answer to a one-sided catalogue, and it matters more than it sounds:
 *     wrong answers drift longer than right ones, so over 3,564 route keypad
 *     cards the key can be the unique longest of three on 36% and can tie for
 *     longest on 93%. A cue that fires on a one-sided catalogue is not a weak
 *     cue, it is an elimination rule with the sign flipped.
 *   · the key can ONLY be the unique longest — `lo` is `1/k`, P is 0, silence
 *     again, from the same line.
 *   · one reachable value — nothing to ask for, and the residual is what
 *     `tools/critic/choiceshape.mjs` measures and prints.
 *
 * The ends, never the middle: aiming at `1/k` where `1/k` is reachable would
 * pick the most anonymous set on the shelf every time, which is this
 * repository's oldest mistake wearing a new hat. RANDOMISE, DO NOT EQUALISE.
 */
function drawTargets(rows, k, h, out) {
  let high = false;
  for (let c = 0; c < CUE_COUNT; c++) {
    let lo = Infinity, hi = -Infinity;
    for (const v of rows) { if (v[c] < lo) lo = v[c]; if (v[c] > hi) hi = v[c]; }
    if (lo === hi) { out[c] = lo; continue; }
    if (MIRROR[c]) { out[c] = high ? lo : hi; continue; }
    let p = (1 / k - lo) / (hi - lo);
    if (p < 0) p = 0; else if (p > 1) p = 1;
    high = shapeUnit(h, `cue${c}`) < p;
    out[c] = high ? hi : lo;
  }
  return out;
}

/**
 * HOW MUCH EACH RULE COUNTS WHEN THEY CANNOT ALL BE HAD.
 *
 * Every FAMILY weighs the same — the three ordinal measures, each of the eight
 * written features, and the composite — and a family's weight is split evenly
 * between the rules inside it. Without that the sixteen feature rules outvote
 * the twelve ordinal ones and the composite five to one, and the composite is
 * the rule this whole file exists to abolish.
 */
const FAM_W = (() => {
  const w = new Array(CUE_COUNT).fill(0);
  let c = 0;
  for (let m = 0; m < METRICS.length; m++) { for (let j = 0; j < 4; j++) w[c + j] = 1 / 4; c += 4; }
  for (let f = 0; f < FEATURE_BITS.length; f++) { w[c] = 1 / 2; w[c + 1] = 1 / 2; c += 2; }
  w[c++] = 1;
  for (let j = 0; j < STEM_CUES; j++) w[c + j] = 1 / STEM_CUES;
  return w;
})();

/**
 * WHICH CUE IS THE MIRROR OF THE ONE BEFORE IT, AND WHY THAT IS ONE DRAW.
 *
 * `take the unique longest` and `strike the unique longest` are two readings of
 * ONE fact — is the key the sole longest option or is it not — and until this
 * map existed they were drawn from two independent uniforms. That asks for
 * "the key is the sole longest AND the key is not the sole longest" on four
 * ninths of cards, and a request no set can answer is resolved by the argmin,
 * which resolves it the same way every time: towards the set that is nobody's
 * extreme, which is the composite this file exists to abolish.
 *
 * The mirror is not drawn. It takes the OTHER end of its own reachable range,
 * and that keeps its mean at `1/k` for the same reason the primary's does:
 * where `hi` is `1/n` for the options that carry the mark and the mirror's `hi`
 * is `1/(k-n)` for the ones that do not, `1 - P(primary high)` IS the mirror's
 * own probability, because `n + (k - n) = k`.
 *
 * Measured on the shipped route, over the 75 route forms the narrowed field
 * draws, counting the forms the gate calls a finding — the shipped bank, and
 * then the mean over eight hash streams, because a design chosen on one stream
 * is fitted to the instrument:
 *
 *     shipped (no coupling, no stem)          17    mean 23.6
 *     + the stem family                       16    mean 22.0
 *     + mirror coupling                       15    mean 24.3
 *     + BOTH                                  13    mean 22.1   <- shipped
 */
const MIRROR = (() => {
  const m = new Array(CUE_COUNT).fill(false);
  let c = 0;
  for (let i = 0; i < METRICS.length; i++) { m[c + 1] = true; m[c + 3] = true; c += 4; }
  for (let f = 0; f < FEATURE_BITS.length; f++) { m[c + 1] = true; c += 2; }
  c += 1;
  m[c + 1] = true;
  return m;
})();

/**
 * CHOOSE THE OPTION SET WHOSE SHAPE SAYS LEAST ABOUT WHICH ONE IS THE KEY.
 *
 * Three steps, and the argument for every one of them is at the head of this
 * file:
 *
 *   1. DEDUPLICATE by what is on the glass. `arranged()` throws the order away
 *      before a learner sees it, so two orderings of one set are one set and
 *      must not vote twice in step 3.
 *   2. ASK, for every one of the twenty-nine rules AT ONCE, for a value drawn
 *      from what this card can reach with mean `1/k` — see `drawTargets`.
 *   3. SHOW THE SET CLOSEST TO ALL TWENTY-NINE OF THEM TOGETHER, in
 *      family-weighted SQUARED distance.
 *
 * WHY SQUARED, AND WHY THAT IS A MEASURED CHOICE RATHER THAN A TASTE. A LEARNER
 * PLAYS ONE RULE, so what matters is not the total error over twenty-nine rules
 * but the WORST of them: three points off on ten rules is a bank nobody can
 * play, thirty points off on one is a sitting handed over. Plain distance trades
 * those at par. Squaring buys the spread. Measured on the shipped route, with
 * everything else identical and only the exponent moved — route findings, and
 * the narrowed field's own worst rule:
 *
 *     plain distance                     49
 *     ^1.5                               50
 *     SQUARED                            46   <- shipped
 *     ^3                                 56
 *     ^4                                 58
 *     worst single miss first            57
 *     each rule scaled by its own span   52
 *
 * The last row is the one worth explaining: dividing each rule's error by how
 * much this card could have done about it sounds fairer and is worse, because
 * it hands a rule whose whole reachable range is eight points the same say as
 * one whose range is a hundred. The band this is judged against is in POINTS,
 * so the error has to be in points too. Scaling only the SIXTEEN FEATURE rules
 * that way — they are the ones whose ranges are narrow, so they are the ones
 * squaring quietly gives up on — reads 54, which is the same answer again.
 *
 * The family weights were swept the same way — the eight feature families at
 * two, four and eight times the ordinal ones read 51, 52 and 56, the size
 * family at two and three times the others read 57 and 55, and drawing a
 * weight per family per card read 52. Everything weighing the same is not a
 * default; it is the bottom of the curve.
 *
 * AND ONE IDEA THAT LOOKS RIGHT AND IS THE OLD DISEASE. Where the targets
 * cannot all be had, the obvious repair is to DRAW AGAIN until they can —
 * keep re-drawing and take the request the catalogue can actually answer. It
 * was built and measured: 64 route findings at four attempts, 67 at eight, 73
 * at sixteen, worse the harder it tried. It is "aim at 1/k" wearing a third
 * hat. Choosing the most satisfiable request is choosing the most anonymous
 * arrangement, and an arrangement that is always the most anonymous one is a
 * rule: strike whatever stands out and what is left is the key. The
 * contradiction has to be resolved by taking the loss, not by asking an easier
 * question.
 *
 * WHAT THIS IS NOT. It is not "answer the first cue in a drawn order, then the
 * next" — that is the design this replaced, and it is what manufactured the
 * composite. It is not "aim at 1/k", which would make the most anonymous set on
 * the shelf a perfect rule. And nothing here clamps the key away from an end:
 * the key is the biggest of three about a third of the time because that is
 * what an option carrying no information looks like.
 *
 * WHAT IT STILL CANNOT DO, because a measured wall is worth writing down. On a
 * card where only ONE measure is live, "the key survives the composite" and
 * "the key is not the unique smallest" are the SAME statement, so a catalogue
 * with no wrong value above the answer cannot have both at chance whatever this
 * function does — the best a mixture could reach is a half on each. Ten of the
 * seventeen route forms still over the band are on that wall, `ms-context`
 * worst, and the fix for them is a wrong value on the other side of the key,
 * not an arrangement. The head of this file names all seventeen and says which
 * side of the wall each is on, measured against a greedy oracle.
 *
 * TWO STRUCTURAL IDEAS THAT LOOK RIGHT AND ARE WORSE, both built and measured,
 * because they are the obvious next two things to try:
 *
 *   · EVERY SORTED PLACE AS A RULE OF ITS OWN — "take the one standing third by
 *     size" — on the grounds that two ends do not pin the three interior places
 *     of a five-button tray. 53 route findings against 46, and it puts a new
 *     place finding on the narrowed field while barely moving the tray's.
 *   · THE TWO ENDS OF ONE MEASURE DRAWN TOGETHER, so the request is never "be
 *     the shortest and the longest at once" — which an independent draw asks
 *     for on a ninth of cards. 66 route findings against 46. The contradictory
 *     request is doing useful work: resolving it costs one card's lean, and
 *     removing it hands a third of the cards to "neither end", which is the
 *     middle, which is the composite.
 *
 * @param {string} key the right answer, as it will be written on screen.
 * @param {Array<{show:string[], rank:number}>} cands every set the caller is
 *        willing to offer. `show` is the options a learner will SEE beside the
 *        key — not every option the caller holds — because a set nobody is
 *        shown cannot leak and must not be allowed to spend the freedom. `rank`
 *        breaks ties, lower first, so the caller keeps its own preference
 *        (a generator prefers the errors its pack catalogued first).
 * @param {string} salt what makes this card THIS card. Never the key's shape,
 *        which is the one quantity this whole file exists to keep out of the
 *        arrangement.
 * @param {string} [stem] the sentence the set stands under, when the caller has
 *        one. A reading the stem prints is a reading an eye lands on first, and
 *        no count above can see it. A caller with no sentence — the beam's move
 *        tray, the area field's shards — passes nothing and the three stem
 *        rules go silent, because a rule that reads the same on every candidate
 *        has no say in which candidate is taken.
 * @returns {number} the index of the chosen candidate.
 */
export function balancedPick(key, cands, salt, stem = '') {
  if (cands.length < 2) return 0;
  const h = shapeMix(salt);
  const say = stem ? String(stem) : '';

  const memo = new Map();
  const look = (x) => {
    const s = String(x);
    let v = memo.get(s);
    if (v === undefined) {
      v = [shapeLen(s), shapeDigits(s), shapeSize(s), shapeFeatures(s), s];
      memo.set(s, v);
    }
    return v;
  };
  const K = look(key);

  const seen = new Map();
  const sets = [];
  for (let s = 0; s < cands.length; s++) {
    const show = cands[s].show;
    const id = show.map(String).sort().join(' ');
    const at = seen.get(id);
    if (at !== undefined) {
      if (cands[s].rank < cands[sets[at].pick].rank) sets[at].pick = s;
      continue;
    }
    seen.set(id, sets.length);
    sets.push({ pick: s, rows: [K, ...show.map(look)] });
  }
  if (sets.length < 2) return sets[0].pick;

  const k = sets[0].rows.length;
  const rows = sets.map((s) => cueValues(s.rows, 0, say, new Array(CUE_COUNT)));
  const want = drawTargets(rows, k, h, new Array(CUE_COUNT));

  let take = sets[0].pick, best = Infinity;
  for (let i = 0; i < sets.length; i++) {
    let d = 0;
    for (let c = 0; c < CUE_COUNT; c++) { const e = rows[i][c] - want[c]; d += FAM_W[c] * e * e; }
    if (d < best || (d === best && cands[sets[i].pick].rank < cands[take].rank)) { best = d; take = sets[i].pick; }
  }
  return take;
}
