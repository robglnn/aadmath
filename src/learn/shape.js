/**
 * THE SHAPE OF AN OPTION SET, AND HOW TO KEEP IT FROM NAMING THE KEY.
 *
 * WHY THIS FILE EXISTS
 *
 * Two surfaces in this game put a set of readings in front of a learner and ask
 * which one is right, and on both of them the same defect keeps coming back: the
 * right one LOOKS different. Wrong answers drift longer than right ones, so the
 * key came out the shortest string in the set and "pick the shortest" scored 39%
 * against a 25% baseline. The repair for that guaranteed the key was never the
 * unique shortest and never the unique longest, which turned a cue that was
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
 *                              moves to offer beside the ideal one.
 *
 * The two used to be unrelated, and the beam's tray was never balanced at all:
 * "take the unique fewest-digits option" named the ideal move 42% of the time
 * against 24.6%, and the ideal move sat in the LAST slot 30% of the time
 * against 20%, because a shuffle that dropped it simply appended it.
 *
 * WHAT MEASURES IT. Not this file. `tools/critic/choiceshape.mjs` reads every
 * answer surface off the shipped `src/ui/rift.js`, keeps its OWN list of cues,
 * and judges each surface separately against that surface's own chance. It has
 * to keep its own list: a gate that shares the generator's idea of what a cue is
 * cannot catch a cue the generator never thought of.
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

/**
 * WHY THERE IS NO shapeSize() HERE, AND WHY THAT IS A MEASURED DECISION.
 *
 * There is a third thing an eye reads, and neither count above can see it:
 * HOW BIG THE NUMBER IS. `-800` is longer than `12` and carries more digits
 * while being the smaller number. The lean is real and it is large — over
 * 10,260 route narrowed fields, "take the biggest of the three" names the key
 * 19.96% of the time against 33.33%, so its mirror "strike the biggest" names
 * it 40.02%, and the key's place by size runs 34.0 / 46.0 / 20.0 against 33.3
 * apiece.
 *
 * IT IS NOT THE CATALOGUE. That was the first guess and it is measurable and
 * false: over 3,420 route keypad cards the pack offers a wrong value on BOTH
 * sides of the key on 96.4% of them, and only 2.8% are bigger-only. The
 * freedom is there. What is not there is a cue asking for it — the two the
 * NARROWED FIELD actually shows straddle the key on 44.0% of cards.
 *
 * IT IS THE BUDGET, AND FOUR EXPERIMENTS SAY SO. Fourteen cues already cannot
 * all be had from three options drawn out of six, and this function answers a
 * PREFIX of a drawn order, so a fifteenth cue is paid for by the ones under it.
 * Measured on the shipped route, the cadet who reads no mathematics on the
 * narrowed field (chance 33.33%):
 *
 *     size not asked for at all                            45.74%   <- shipped
 *     + both size ends, its drawn place and its flatness   51.37%
 *     + both size ends only                                55.95%
 *     size ends IN PLACE OF the digit ends (budget kept)   55.81%
 *     + the composite as a cue of its own                  45.98%
 *
 * and the beam went 46.22% -> 52.79% on the first of those. The third is the
 * interesting one: it keeps the budget at fourteen and is still worse, because
 * silencing each ordinal cue separately is what MAKES the composite — a key
 * that is never the unique extreme on anything is exactly what survives
 * "strike every unique extreme at once", and on a three-option set there is not
 * enough room to be non-extreme on three metrics and inconspicuous as well.
 *
 * So the lean stays, and it stays MEASURED: `tools/critic/choiceshape.mjs`
 * reads it on every build with its own `shapeSize`, kept there for the reason
 * written at the top of that file. Closing it needs this function to score a
 * candidate set against ALL of its cues at once instead of the longest prefix
 * of a drawn order — which is a redesign, not another entry in the table above.
 */

/** How many digits an option carries — the other thing an eye counts. */
export function shapeDigits(x) {
  const s = String(x);
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c >= 48 && c <= 57) n++; }
  return n;
}

/**
 * THE SIX WRITTEN FEATURES, as one bitmask per option.
 *
 * Everything here is something a cadet can see at a glance in a rendered option
 * without knowing what any of it means: a minus hanging off the front, a bar
 * with something over and under it, a relation sign, a phrase in words, a
 * letter, a root. `words` is on the list because of the special-answer card,
 * where the key is a PHRASE and two of the four readings used to be bare
 * numbers — "strike every bare number" first-picked 50.00% against 25%. Writing those two as phrases that
 * NAMED a number moved the same cue one step along — the key was still one of
 * the two readings with no digit in it — which is why the wrong readings on
 * that card now name a COUNT and not a value.
 *
 * "Does it carry a numeral at all" is deliberately NOT one of these. It is the
 * digit count with everything above zero folded together, and this file already
 * asks four finer questions about that count — the unique fewest, the unique
 * most, which place the key stands in, and how flat that place is. Adding the
 * coarse one took a turn from the fine ones and pushed the beam's ideal move
 * back into the first place by digits, +6.3 points off 20. The GATE measures it
 * anyway, because a gate that only asks what the generator already asks cannot
 * catch a cue the generator never thought of.
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
  /* THE DIVISION GLYPH. The beam's move tray is an option set whose members
     differ by their OPERATOR, and no cue above can see one: `\\div\\; 4` and
     `+\\; 8` are the same printed length, carry the same digit count and share
     every feature. Written for three locales, because es and pl set division
     with a colon and an eye does not care which glyph a locale chose. */
  if (/\\div|\\mathbin\{:\}|÷/.test(t)) b |= 64;
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

/** The outcome of one cue on one candidate set. */
const CUE_NONE = 0, CUE_KEY = 1, CUE_OTHER = 2;

/**
 * THE FOURTEEN CUES, in four kinds.
 *
 *   kind 0  the unique least / greatest, by printed length and by digit count.
 *           Three answers: the cue names the KEY, it names a distractor
 *           (OTHER), or it does not fire at all (NONE).
 *   kind 1  a written feature. A cue that splits the set names a CLASS, and
 *           the strategy a cadet plays is "take the class the key is in and
 *           guess inside it", which is worth `1/c`. KEY when the key is inside
 *           that class, OTHER when it is not, NONE when the feature does not
 *           split the set.
 *   kind 2  WHICH SORTED PLACE the key stands in. Silencing the two extremes
 *           is not the whole job: on the beam's five-move tray the ideal
 *           stopped being the unique fewest-digits move and simply became one
 *           of the two fewest — 34.6% of the mass in the first sorted place and
 *           33.2% in the second against 20% apiece, and "take one of the two
 *           with the fewest digits" is a cue an eye reads as easily as "take
 *           the fewest". Only the whole distribution answers that, not its ends.
 *   kind 3  HOW FLAT that place is. A key measuring the same as every other
 *           option is the one arrangement that carries no information ON ITS
 *           OWN rather than only on average, and it is asked for first wherever
 *           the catalogue can give it.
 *
 * `p` is the probability the target draw should give KEY when both KEY and
 * OTHER are reachable: 1/k for a cue that names exactly one option, and `c/k`
 * for a class cue, which is the share of the set that class covers — the two
 * are the same number when c is 1.
 */
const CUES = [[0, -1], [0, +1], [0, -2], [0, +2], [3, 1], [3, 2], [2, 1], [2, 2],
  [1, 1], [1, 2], [1, 4], [1, 8], [1, 16], [1, 32]];

function cueOutcome(kind, arg, len, dig, feat, k) {
  if (kind === 0) {
    const vals = (arg === -1 || arg === 1) ? len : dig;
    const dir = arg < 0 ? -1 : +1;
    let best = vals[0], at = 0, ties = 1;
    for (let i = 1; i < k; i++) {
      if (dir < 0 ? vals[i] < best : vals[i] > best) { best = vals[i]; at = i; ties = 1; }
      else if (vals[i] === best) ties++;
    }
    if (ties > 1) return { o: CUE_NONE, p: 0 };
    return { o: at === 0 ? CUE_KEY : CUE_OTHER, p: 1 / k };
  }
  if (kind === 2) {
    // WHICH SORTED PLACES THE KEY COULD BE STANDING IN, as a bitmask.
    //
    // A key measuring the same as two others does not have a place; it has a
    // BLOCK of three, and it puts a third of itself in each. The target this
    // cue is asked for is one drawn place, and a candidate answers it when its
    // block COVERS that place — which is the one rule that makes the whole
    // distribution flat rather than the ends of it. A key alone in a place
    // covers exactly the place it was asked for, so those cards spread evenly;
    // a key tied with everything covers every place at 1/k, so those cards are
    // already flat. Asking instead for the block's CENTRE was measured and is
    // worse: it piles a third of the mass on the middle place, because a key
    // that is exactly in the middle of five is in the middle of five every
    // time it is asked for.
    const vals = arg === 1 ? len : dig;
    const key = vals[0];
    let below = 0, tie = 0;
    for (let i = 0; i < k; i++) { if (vals[i] < key) below++; else if (vals[i] === key) tie++; }
    let mask = 0;
    for (let p = below; p < below + tie && p < k; p++) mask |= 1 << p;
    return { o: mask, p: 0 };
  }
  if (kind === 3) {
    // HOW FLAT the key's place is over the k places, in units of 1/2k.
    //
    // A key that measures the same as every other option puts 1/k of itself in
    // every place, which is what a set carrying no information looks like, and
    // it is the one arrangement that is uniform ON ITS OWN rather than only on
    // average. Where the catalogue can give that, it is asked for first and the
    // place cue below only breaks the remaining tie. Where it cannot — a beam
    // whose ideal move is the thinnest thing that can be written — asking only
    // for a drawn place leaves every reachable block anchored at the bottom and
    // the distribution 27/28/17/14/13 against 20 apiece, because a block that
    // covers the drawn place still spreads its mass wherever it likes.
    const vals = arg === 1 ? len : dig;
    const key = vals[0];
    let below = 0, tie = 0;
    for (let i = 0; i < k; i++) { if (vals[i] < key) below++; else if (vals[i] === key) tie++; }
    let d = 0;
    for (let p = 0; p < k; p++) d += Math.abs((p >= below && p < below + tie ? 1 / tie : 0) - 1 / k);
    return { o: Math.round(d * k), p: 0 };
  }
  let c = 0;
  for (let i = 0; i < k; i++) if (feat[i] & arg) c++;
  if (c === 0 || c === k) return { o: CUE_NONE, p: 0 };
  return { o: (feat[0] & arg) ? CUE_KEY : CUE_OTHER, p: c / k };
}

/**
 * WHAT THIS CARD ASKS ONE CUE FOR, out of what its own catalogue can reach.
 *
 * This is the whole of the correction, and it is LOCAL — it needs no
 * measurement of the bank, so it cannot go stale when the bank changes, which
 * is what happened to the two hand-set weight vectors it replaces.
 *
 *   · both KEY and OTHER reachable → KEY with probability `p`, else OTHER. The
 *     cue fires, and over the population it names the key exactly at chance.
 *     This is the case that matters and it needs no constants at all.
 *   · KEY unreachable → ask for NONE if the catalogue can give it. A cue that
 *     never fires cannot become an elimination rule, and that is the honest
 *     answer to a one-sided catalogue.
 *   · OTHER unreachable → likewise NONE, so a cue that could only ever name the
 *     key is silenced instead of left pointing at it.
 *
 * @param {number} reach bitmask of the outcomes some candidate can give.
 * @param {number} u this card's own uniform for this cue.
 * @param {number} p the probability KEY should be asked for when the cue fires.
 */
function shapeTarget(reach, u, p) {
  const K = reach & 1, O = reach & 2, N = reach & 4;
  if (K && O) return u < p ? CUE_KEY : CUE_OTHER;
  if (K) return N ? CUE_NONE : CUE_KEY;
  if (O) return N ? CUE_NONE : CUE_OTHER;
  return CUE_NONE;
}

/**
 * CHOOSE THE OPTION SET WHOSE SHAPE SAYS LEAST ABOUT WHICH ONE IS THE KEY.
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
 * @returns {number} the index of the chosen candidate.
 */
export function balancedPick(key, cands, salt) {
  if (cands.length < 2) return 0;
  const k = 1 + cands[0].show.length;
  const h = shapeMix(salt);
  const R = CUES.length;

  const len = new Array(k), dig = new Array(k), fea = new Array(k);
  len[0] = shapeLen(key); dig[0] = shapeDigits(key); fea[0] = shapeFeatures(key);

  const outs = new Array(cands.length);
  const reach = new Array(R).fill(0);
  for (let r = 0; r < R; r++) if (CUES[r][0] === 3) reach[r] = 255;
  const pSum = new Array(R).fill(0), pN = new Array(R).fill(0);
  for (let s = 0; s < cands.length; s++) {
    const show = cands[s].show;
    for (let i = 1; i < k; i++) {
      const v = String(show[i - 1]);
      len[i] = shapeLen(v); dig[i] = shapeDigits(v); fea[i] = shapeFeatures(v);
    }
    const row = new Uint8Array(R);
    for (let r = 0; r < R; r++) {
      const { o, p } = cueOutcome(CUES[r][0], CUES[r][1], len, dig, fea, k);
      row[r] = o;
      if (CUES[r][0] === 2) { reach[r] |= o; continue; }
      // The flatness cue asks for the flattest arrangement this card can reach,
      // so its target is the smallest number any candidate answered with.
      if (CUES[r][0] === 3) { if (o < reach[r]) reach[r] = o; continue; }
      reach[r] |= o === CUE_NONE ? 4 : o === CUE_KEY ? 1 : 2;
      if (o !== CUE_NONE) { pSum[r] += p; pN[r] += 1; }
    }
    outs[s] = row;
  }

  const want = new Array(R);
  for (let r = 0; r < R; r++) {
    if (CUES[r][0] === 3) { want[r] = reach[r]; continue; }
    if (CUES[r][0] === 2) {
      // One drawn place out of k. Where the catalogue cannot reach a place at
      // all, the draw falls back on the places it can reach — a local rule, and
      // the residual is what `tools/critic/choiceshape.mjs` measures.
      const can = [];
      for (let p = 0; p < k; p++) if (reach[r] & (1 << p)) can.push(1 << p);
      const u = shapeUnit(h, `cue${r}`);
      const wish = 1 << Math.floor(u * k);
      want[r] = (reach[r] & wish) ? wish : (can.length ? can[Math.floor(u * can.length)] : 0);
      continue;
    }
    want[r] = shapeTarget(reach[r], shapeUnit(h, `cue${r}`), pN[r] ? pSum[r] / pN[r] : 1 / k);
  }

  /* THE ORDER THE CUES ARE ASKED IN, AND WHY IT IS NOT UNIFORM.
     Ten cues cannot all be had from three options drawn out of six, so some
     target is going to be given up — and what it costs to give one up is not
     the same for all ten. A cue this card can point EITHER way is cheap to
     miss: it fires either way and the miss is one card's worth of lean on a
     large denominator. A cue this card can only ever point ONE way is the
     expensive one — miss its silence and it becomes a rule that names the key,
     or strikes it, on 100% of the sets it is decisive on, which is precisely
     the elimination rule this file exists to abolish. So the one-sided cues are
     asked first. The PLACE cues come next, above the two-sided ends, because a
     place cue is a statement about the whole distribution and the two ends are
     two points of it: on the beam's tray, asking the ends first left the ideal
     move's place by digits at 31/33/15/11/10 against 20 apiece. The drawn order
     decides only inside each group. */
  const cost = new Array(R);
  for (let r = 0; r < R; r++) {
    if (CUES[r][0] === 3) { cost[r] = 0; continue; }
    if (CUES[r][0] === 2) {
      let n = 0;
      for (let p = 0; p < k; p++) if (reach[r] & (1 << p)) n++;
      cost[r] = n > 1 ? 2 : 3;
      continue;
    }
    const K = reach[r] & 1, O = reach[r] & 2, N = reach[r] & 4;
    cost[r] = (K && O) ? 2 : ((K || O) && N) ? 0 : 3;
  }
  const order = Array.from({ length: R }, (_, r) => r).sort((a, b) => cost[a] - cost[b]
    || (shapeUnit(h ^ 0x5bd1e995, `ord${a}`) - shapeUnit(h ^ 0x5bd1e995, `ord${b}`)));

  /* The set that answers the most of what was asked, with the drawn order
     deciding which cue wins when two cannot both be had: cue `order[0]` is
     worth more than every cue under it put together, cue `order[1]` more than
     every cue under IT, and so on. A plain "first mismatch and stop" was
     measured and is worse — it gives up on every cue below the first one it
     cannot have, so nine cues in ten were satisfied only by luck. */
  let take = 0, bestScore = -1;
  for (let s = 0; s < cands.length; s++) {
    let bits = 0, hit = 0, kept = 0;
    for (let i = 0; i < R; i++) {
      const r = order[i];
      /* kinds 0, 1 and 3 all answer with one number, so equality is the test;
         a place cue answers with the block of places the key covers. */
      const ok = CUES[r][0] === 2 ? (outs[s][r] & want[r]) !== 0 : outs[s][r] === want[r];
      if (!ok) continue;
      bits |= 1 << (R - 1 - i);
      hit++;
      if (!cost[r]) kept++;
    }
    /* THE SILENCES FIRST, THEN HOW MANY, THEN WHICH.
       A cue this card can only ever point one way is silenced or it becomes an
       elimination rule; nothing may be traded for that, so those are counted on
       their own and outrank everything. After them, HOW MANY of the remaining
       cues were answered comes before WHICH ones, and the drawn order settles
       the rest. Both halves were measured: protecting only the first cue in the
       order leaves the other thirteen to luck and the beam's ideal move sat in
       the bottom two places by digits 55% of the time against 40%; counting
       without the drawn order spends the effort on whichever cues are cheapest
       to answer. */
    const score = kept * (1 << (R + 5)) + hit * (1 << R) + bits;
    if (score > bestScore || (score === bestScore && cands[s].rank < cands[take].rank)) { bestScore = score; take = s; }
  }
  return take;
}
