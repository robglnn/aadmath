/**
 * THE SORTING BAYS, PLAYED BY A CADET WHO DOES NO MATHEMATICS.
 *
 * WHY THIS FILE EXISTS
 *
 * The sorter has no option set, so nothing in `choiceshape.mjs`'s first-pick
 * machinery can read it. What it has is chips and bays, and the only question
 * worth asking of it is: CAN A CHIP'S BAY BE READ OFF ANYTHING BUT THE
 * MATHEMATICS?
 *
 * Three rounds of that question have already been answered wrong, each time
 * because the instrument could only see the cue that had just been fixed:
 *
 *   1. the chips were painted the two colours of the two bay headers, so the
 *      board could be filed by hue;
 *   2. the tray was built in the statement's own term order, which alternates
 *      the kinds, so "first chip left, next right, keep alternating" filed
 *      100.0% of boards against an 11.3% permuted-order baseline;
 *   3. and with both of those fixed the board was still sealed, because a
 *      variable chip is printed with the unknown's letter on it and a number
 *      chip never is — so "a chip with a letter goes left" filed every chip of
 *      1,350 of 1,350 boards.
 *
 * The third one is not a cue on top of the question. Two bays that are "carries
 * a letter" and "carries no letter" ARE the two glyph classes of the printed
 * board, so no arrangement of chips could ever have made that surface anything
 * but a glyph match. The bays are like-classes now — the `x` terms, the
 * `x^{2}` terms, the `y` terms, the numbers — and this file is the instrument
 * that says whether that actually bought anything.
 *
 * WHAT IS MEASURED. A RULE is a table from something a cadet can see about a
 * chip to something a cadet can see about a bay. It is FITTED on half the
 * boards and SCORED on the other half, so a rule that wins on the sample it was
 * chosen from cannot be reported. What it is scored on is the SEAL — every chip
 * of a board filed with no miss — because a rejected drop is a miss, a board
 * with a miss on it is not an unassisted seal, and only an unassisted seal
 * advances a proving run. The per-chip hit rate is printed beside it.
 *
 * WHAT IT IS COMPARED WITH. Not zero, and not a written constant: the same
 * fit-and-score over the same boards with the GROUPS RE-MATCHED TO THE BAYS at
 * random — every group of chips kept whole, every bay left where it is with the
 * header it has. That is exactly the null being tested, THE SHAPE OF A CHIP
 * SAYS NOTHING ABOUT WHICH BAY ITS GROUP BELONGS TO, and it prices in the one
 * thing that is not a cue: grouping. A cadet who reads the letter off every
 * chip has grouped the board and still has to say which bay each group goes in,
 * and one guess in six at three bays is not a leak. A permutation baseline
 * cannot go stale when the bank changes, which a written constant would.
 *
 * THE ONE RULE THAT IS ALLOWED TO WIN is `the whole variable part`: match a
 * chip's letter-and-power against the bay whose header is that letter and
 * power. That is not a cue, it is the definition of a like term, and it MUST
 * seal every board — a surface it cannot seal is a surface nobody can answer.
 * It is measured on every run for exactly that reason and reported apart from
 * the cues.
 *
 * WHAT THE THIRD ROUND ADDED, and why each of the three was needed.
 *
 * 1. RULES THAT NEED THE WHOLE BOARD. Every cue used to read one chip, and the
 *    cue that sealed this surface in round two — "first chip left, next right,
 *    keep alternating" — is not a fact about a chip, it is a fact about a
 *    chip's place among the others. So a cue is handed the board now: how many
 *    chips share its body, whether it is alone, where its GROUP starts, how big
 *    its group is, its rank by the size of its count. And two addresses a rank
 *    by place or by length cannot reach: the header read alphabetically, and
 *    whether the header carries a numeral.
 *
 * 2. THE WEIGHT BEHIND A RATE IS CARDS, NOT ROWS. The same card is drawn once
 *    per locale, its three rows carry the same chips into the same bays, and
 *    they seal or miss together. `side()` already split by card for that
 *    reason; the z did not, so it was multiplied by sqrt(3). Widening the rule
 *    table made it visible at once: a 61.7% tilt over 60 cards that a
 *    chi-square over the same cards calls noise came out at z 3.4 and was
 *    printed as a route finding. It reads z 1.9 now, and at four times the
 *    cards the effect fell to +3.0 points — which is what noise does.
 *
 * 3. A NULL THAT CANNOT BE ZERO BY CONSTRUCTION. Where a rule has more values
 *    than there are bays, the table used to take each value's modal bay with no
 *    constraint — so on the route's band-1 shape (two bays, four chips, both
 *    orders drawn) a near-even split sent EVERY position to the same bay, and a
 *    table that names one bay for everything can never seal a board. The
 *    baseline came out at 0.0% where one arrangement in six is 16.7%, and the
 *    rule was printed at +23.0 points over nothing. Ties spread across bays
 *    now, and the null re-matches once per CARD rather than once per row.
 *
 * AND THE ROW THAT IS PRINTED WITHOUT BEING A CUE: the FLOOR. A cadet can also
 * eliminate — group the chips that look alike, pin what one bit can pin, guess
 * the rest — and no fitted table can express that. It is computed exactly, held
 * to `RUN_BAR`, and argued in `eliminationFloor`.
 *
 *   node tools/critic/sortcues.mjs               # the table, over the route
 *   node tools/critic/sortcues.mjs --self-test   # plant every cue, one at a time
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A whole board sealed with no miss is worth this many points over its null. */
export const CUE_BAND = 7;
/** ~p<0.001, two-sided, the same bar `choiceshape.mjs` holds everywhere else. */
export const Z_P001 = 3.29;
/** Fewer boards than this and the arithmetic that would make it red is noise. */
export const MIN_BOARDS = 60;

// ---------------------------------------------------------------------------
// WHAT A CADET CAN SEE ABOUT A CHIP.
//
// Every one of these is a property of the printed chip that is NOT its variable
// part. The variable part is the mathematics and has its own row at the foot of
// the report; everything here is a way of not reading it.
// ---------------------------------------------------------------------------
const coefOf = (s) => {
  const m = /^(-?)(\d*)/.exec(String(s));
  const n = m[2] === '' ? 1 : Number(m[2]);
  return (m[1] === '-' ? -1 : 1) * n;
};
const bucket = (x) => (x <= 1 ? 0 : x <= 3 ? 1 : x <= 6 ? 2 : x <= 12 ? 3 : 4);
/** What a chip reads as once the count in front of it is taken off. */
const bodyOf = (c) => String(c).replace(/^-?\d*/, '');
/**
 * The groups a cadet can make WITHOUT reading a bay: chips whose printed body
 * is the same string. On this board that partition is always the right one, and
 * it is priced into the null on purpose (see `scramble`) — a rule that only
 * groups has still said nothing about which bay a group belongs to.
 */
const groupsOf = (bd) => {
  const at = new Map();
  bd.chips.forEach((c, i) => {
    const b = bodyOf(c);
    if (!at.has(b)) at.set(b, []);
    at.get(b).push(i);
  });
  return [...at.entries()];
};
/** Rank a list of strings, ties broken by position, so the answer is a permutation. */
const rankOfStr = (vals) => {
  const order = vals.map((v, i) => [v, i]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const out = new Array(vals.length);
  order.forEach(([, i], r) => { out[i] = r; });
  return out;
};

export const CHIP_CUES = [
  ['it carries a letter', (s) => (/[A-Za-z]/.test(s) ? 'L' : 'n')],
  ['it carries a power', (s) => (/\^/.test(s) ? 'P' : 'p')],
  ['letter and power together', (s) => `${/[A-Za-z]/.test(s) ? 'L' : 'n'}${/\^/.test(s) ? 'P' : 'p'}`],
  // MEASURED, PRINTED, AND NOT JUDGED — see EXEMPT below.
  ['the letter alone, power ignored', (s) => (String(s).match(/[A-Za-z]/) || ['-'])[0]],
  ['how many glyphs long it is', (s) => String(s).replace(/[{}^]/g, '').length],
  ['how many digits it carries', (s) => (String(s).match(/\d/g) || []).length],
  ['the size of the count in front', (s) => bucket(Math.abs(coefOf(s)))],
  ['whether the count is negative', (s) => (String(s).startsWith('-') ? '-' : '+')],
  ['where it lies in the tray', (s, i) => i],
  ['whether its slot is odd or even', (s, i) => i % 2],
  // THE READINGS THAT NEED THE WHOLE BOARD, not one chip. Every one of these
  // was added because a single-chip table cannot express it, and the cue that
  // sealed this surface in round two — "the first chip left, the next right,
  // keep alternating" — was exactly that shape: a fact about a chip's PLACE
  // among the others rather than about the chip.
  ['how many chips share its body', (s, i, bd) => bd.chips.filter((c) => bodyOf(c) === bodyOf(s)).length],
  ['whether it is the only chip of its body', (s, i, bd) => (bd.chips.filter((c) => bodyOf(c) === bodyOf(s)).length === 1 ? 'alone' : 'with')],
  ['where its GROUP starts in the tray', (s, i, bd) => {
    const g = groupsOf(bd).map(([b, at]) => [b, Math.min(...at)]).sort((a, b) => a[1] - b[1]);
    return g.findIndex(([b]) => b === bodyOf(s));
  }],
  ['how big its group is, ranked', (s, i, bd) => {
    const g = groupsOf(bd).map(([b, at]) => [b, at.length]);
    const r = rankOf(g.map(([, n]) => n));
    return r[g.findIndex(([b]) => b === bodyOf(s))];
  }],
  ['its rank in the tray by the size of the count', (s, i, bd) => rankOf(bd.chips.map((c) => Math.abs(coefOf(c))))[i]],
  ['whether the count is odd or even', (s) => Math.abs(coefOf(s)) % 2],
  ['the first digit of the count', (s) => String(Math.abs(coefOf(s)))[0]],
  ['nothing at all — one bay for the lot', () => 0],
];

// ---------------------------------------------------------------------------
// HOW A RULE NAMES A BAY.
//
// EVERY ONE OF THESE IS A PERMUTATION of the bays, and that is not decoration.
// An address that gives two bays the same number lets a rule score a hit
// without ever having said WHICH bay — so "the header has a power in it",
// read as a bare flag, marked every chip on a three-bay board correct and
// reported a 100% seal for a rule that names nothing. It is a rank now, ties
// broken by position, which is the same idea and is answerable.
//
// What an address may NOT be is the bay's own variable part compared with the
// chip's. That comparison is not a cue, it is the definition of a like term,
// and it has its own row at the foot of the report.
// ---------------------------------------------------------------------------
export const BAY_ADDRESSES = [
  ['by where the bay sits', (bays) => bays.map((_, i) => i)],
  ['by how long its header is', (bays) => rankOf(bays.map((b) => b.length))],
  ['by which header has a power in it', (bays) => rankOf(bays.map((b) => (/\^/.test(b) ? 1 : 0)))],
  ['by which header carries a numeral', (bays) => rankOf(bays.map((b) => (/\d/.test(b) ? 1 : 0)))],
  ['by the header read alphabetically', (bays) => rankOfStr(bays.map((b) => String(b)))],
];

/**
 * THE ONE CUE THAT IS NOT JUDGED, and exactly why.
 *
 * On a board whose classes are `x`, `y` and the numbers, the letter IS the
 * whole variable part — there is nothing else to read — so a rule that files by
 * the letter has done the mathematics and is not a cue. On a board that also
 * carries `x^{2}` it is a strictly coarser reading, it merges two bays, and it
 * cannot seal anything; that case needs no bar because the arithmetic refuses
 * it. Judging it either way would be judging the definition of a like term.
 *
 * Every OTHER reading of the variable part is judged, and hard: "it carries a
 * letter" is the one-bit reading that sealed 1,350 of 1,350 boards, and
 * "letter and power together" is the two-bit reading one step along from it.
 * Neither can seal a board carrying two different letters, so the bar costs
 * nothing to hold and says so if that ever stops being true.
 */
const EXEMPT = /^the letter alone/;

/**
 * THE TWO THINGS A BAY IS, and they are not interchangeable.
 *
 * `bd.parts[j]` is the bay's variable part — the machine fact the mathematics
 * is defined over. `bd.bays[j]` is the HEADER A LEARNER READS, in the locale
 * the card was drawn in: `x^{2} terms`, `NÚMEROS PUROS`, `CZYSTE LICZBY`. Shape
 * rules read the header, because "the chip with no letter goes in the bay with
 * the longest header" is a rule about what is printed and those three strings
 * are not the same length. The mathematics reads the part.
 */
const partsOf = (bd) => bd.parts || bd.bays;

/** How many different letters the bays of one board carry. */
const lettersOn = (parts) => new Set(parts.map((b) => (String(b).match(/[A-Za-z]/) || [''])[0]).filter(Boolean)).size;

/** Rank within a list, ties broken by position, so the answer is a permutation. */
function rankOf(vals) {
  const order = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = new Array(vals.length);
  order.forEach(([, i], r) => { out[i] = r; });
  return out;
}

/**
 * Fit one rule, then score it.
 *
 * The table is keyed on the bay count as well as the cue value, because a slot
 * number only means anything inside a fixed number of bays. It is fitted TWICE
 * — pooled over every board with that many bays, and again split by chip count
 * as well — and the better of the two is reported, because the cadet being
 * modelled here is allowed to be as clever as the board lets them be.
 *
 * A RULE NAMES DISTINCT BAYS WHEN IT CAN, and that is not a detail: it is what
 * makes the baseline comparable. Fitting each cue value to its own modal bay
 * independently lets a table say "x goes in bay 1, y goes in bay 1" — a rule no
 * cadet would ever hold, and one that can never seal anything. On honest boards
 * the real fit resolves into a permutation and the shuffled one does not, so an
 * independent fit read 21% against 1% for a rule that is worth one guess in six
 * on both sides. Where there are no more cue values than bays the table is
 * fitted as an ASSIGNMENT — greedily, highest count first, each value taking a
 * bay nothing else has taken — and both sides are then measuring the same thing.
 */
function playRule(boards, cue, addr) {
  const score = (keyOf) => {
    const table = new Map();
    const bayCount = new Map();
    for (let b = 0; b < boards.length; b++) {
      if (side(boards[b], b) !== 0) continue;
      const bd = boards[b];
      const slot = addr(bd.bays);
      const key = keyOf(bd);
      bayCount.set(key, bd.bays.length);
      bd.chips.forEach((c, i) => {
        const val = String(cue(c, i, bd));
        if (!table.has(key)) table.set(key, new Map());
        const rows = table.get(key);
        if (!rows.has(val)) rows.set(val, new Map());
        const t = rows.get(val);
        const want = slot[bd.truth[i]];
        t.set(want, (t.get(want) || 0) + 1);
      });
    }
    const best = new Map();
    for (const [key, rows] of table) {
      const k = bayCount.get(key);
      const picked = new Map();
      if (rows.size <= k) {
        // An assignment: every value takes a bay of its own.
        const cells = [];
        for (const [val, t] of rows) for (const [a, c] of t) cells.push([c, val, a]);
        cells.sort((x, y) => y[0] - x[0] || String(x[1]).localeCompare(String(y[1])) || x[2] - y[2]);
        const usedVal = new Set(), usedAddr = new Set();
        for (const [, val, a] of cells) {
          if (usedVal.has(val) || usedAddr.has(a)) continue;
          usedVal.add(val); usedAddr.add(a); picked.set(val, a);
        }
        for (const [val] of rows) if (!picked.has(val)) picked.set(val, -1);
      } else {
        /**
         * MORE CUE VALUES THAN BAYS, so a value may share a bay with another —
         * but the table still has to NAME BAYS, and a table that sends every
         * value to one bay is not a rule anybody holds. It can never seal a
         * board either, so a baseline computed from one is ZERO BY
         * CONSTRUCTION, and every rule measured against it reads as a leak.
         *
         * That is not hypothetical. On the route's band-1 boards — two bays,
         * four chips, both orders drawn — the shuffled baseline for "where it
         * lies in the tray" came out at 0.0% under one card-id string and
         * 13.9% under another, because with the counts split near-exactly the
         * old tie-break took the first bay it had seen for every position. The
         * honest chance level there is one arrangement in six, 16.7%, and the
         * rule was printed at +23.0 points over nothing.
         *
         * So ties spread. The values are taken in a fixed order — most
         * observations first, then by value, so the answer does not depend on
         * insertion order — and a tie prefers a bay the table has not used yet.
         */
        const order = [...rows.entries()]
          .map(([val, t]) => [val, t, [...t.values()].reduce((a, c) => a + c, 0)])
          .sort((a, b) => b[2] - a[2] || String(a[0]).localeCompare(String(b[0])));
        const used = new Set();
        for (const [val, t] of order) {
          let top = null, n = -1, fresh = false;
          for (const [a, c] of t) {
            const f = !used.has(a);
            if (c > n || (c === n && f && !fresh) || (c === n && f === fresh && top !== null && a < top)) {
              top = a; n = c; fresh = f;
            }
          }
          used.add(top);
          picked.set(val, top);
        }
      }
      best.set(key, picked);
    }
    let sealed = 0, boardsN = 0, hit = 0, chips = 0;
    // HOW MANY INDEPENDENT THINGS WERE MEASURED, which is not how many rows.
    // The same card is drawn once per locale and its mathematics does not
    // change, so its three rows carry the same chips into the same bays and
    // seal or miss together. `side()` already keeps the three copies on one
    // side of the hold-out; counting them as three observations in the z as
    // well multiplies it by sqrt(3) and manufactures p<0.001 out of a tilt
    // that is not there. The rate is still a rate over boards; the WEIGHT
    // behind it is the number of distinct cards.
    const heldCards = new Set();
    for (let b = 0; b < boards.length; b++) {
      if (side(boards[b], b) !== 1) continue;
      const bd = boards[b];
      const slot = addr(bd.bays);
      const picked = best.get(keyOf(bd));
      let all = true;
      bd.chips.forEach((c, i) => {
        const said = picked ? picked.get(String(cue(c, i, bd))) : undefined;
        chips += 1;
        if (said !== undefined && said === slot[bd.truth[i]]) hit += 1; else all = false;
      });
      boardsN += 1;
      heldCards.add(bd.card ?? `#${b}`);
      if (all) sealed += 1;
    }
    return { seal: boardsN ? sealed / boardsN : 0, hit: chips ? hit / chips : 0, n: boardsN, sealed, cards: heldCards.size };
  };
  const a = score((bd) => String(bd.bays.length));
  const b = score((bd) => `${bd.bays.length}.${bd.chips.length}`);
  return a.seal >= b.seal ? a : b;
}

/**
 * WHICH HALF A BOARD IS FITTED ON, AND WHICH IT IS SCORED ON.
 *
 * By CARD, never by row. The same card is drawn once per locale and its
 * mathematics does not change, so its three copies carry the same chips in the
 * same order into the same bays. Splitting on the array index put copies of one
 * card on both sides of the hold-out, which is a rule scoring itself. Boards
 * with no card — the synthetic sets `--self-test` plants — fall back to the
 * index, which is what they always were.
 */
function side(bd, i) {
  if (!bd.card) return i % 2;
  let h = 0x811c9dc5;
  for (let k = 0; k < bd.card.length; k++) h = Math.imul(h ^ bd.card.charCodeAt(k), 0x01000193) >>> 0;
  return (h >>> 8) & 1;
}

/**
 * THE NULL — and getting it wrong is how a harness reports the mathematics as
 * a cue.
 *
 * The first version of this shuffled which chip belongs where, keeping only the
 * bay sizes. That destroys the GROUPS as well as the association, and the
 * groups are not a cue: a cadet who reads the letter off every chip has grouped
 * the board correctly and still has to say which bay each group goes in. Under
 * a group-destroying null that reading looked like a 12.7% leak against 2.0%,
 * and it is nothing of the sort — 12.7% is one guess in six at a permutation of
 * three bays, which is what "I grouped them and then guessed" is worth.
 *
 * So the null keeps every group whole, keeps every bay where it is with the
 * header it has, and RE-MATCHES the groups to the bays at random. The claim
 * being tested is exactly that: the shape of a chip says nothing about which
 * bay its group belongs to. Deterministic, so two runs on one tree agree.
 */
function scramble(boards, seed = 0x9e3779b9) {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0; return s / 4294967296; };
  // ONE RE-MATCH PER CARD, not per row, for the same reason `side()` splits by
  // card: the three locale copies of a card are one board drawn three times.
  // Giving them three independent re-matches makes the null a population the
  // real one has no copy of — three different answers to one question — and the
  // two sides stop being comparable.
  const perms = new Map();
  return boards.map((bd, i) => {
    const k = bd.bays.length;
    const id = `${bd.card ?? `#${i}`}|${k}`;
    let perm = perms.get(id);
    if (!perm) {
      perm = [...Array(k).keys()];
      for (let j = k - 1; j > 0; j--) { const q = Math.floor(rnd() * (j + 1)); [perm[j], perm[q]] = [perm[q], perm[j]]; }
      perms.set(id, perm);
    }
    return { ...bd, truth: bd.truth.map((t) => perm[t]) };
  });
}

/**
 * Two proportions, pooled standard error, ON THE NUMBER OF DISTINCT CARDS.
 *
 * The rate is a rate over boards. The sample size is not: three locale copies
 * of one card are one observation drawn three times, they seal or miss
 * together, and counting them as three multiplies every z by sqrt(3). This file
 * already knew that on the other side of the arithmetic — `side()` splits by
 * CARD for exactly this reason — and the z did not. Widening the rule table
 * made it visible: a 61.7% tilt over 60 cards, which a chi-square over the same
 * cards calls noise, came out at z 3.4 and was printed as a finding.
 */
function zOf(a, b) {
  const na = a.cards || a.n, nb = b.cards || b.n;
  if (!na || !nb) return 0;
  const pooled = (a.seal * na + b.seal * nb) / (na + nb);
  const se = Math.sqrt(Math.max(1e-12, pooled * (1 - pooled) * (1 / na + 1 / nb)));
  return Math.abs(a.seal - b.seal) / se;
}

/**
 * WHERE EACH KIND OF BAY SITS.
 *
 * The chips being drawn is only half of it. With the numbers bay always on the
 * right, "the chip with no letter goes right" needs no header read at all — and
 * that is one of the two facts that made the old two-bay board a glyph match.
 * The bays are drawn from the card's own hash now, so every kind of bay must
 * sit in every slot equally often, and this measures it rather than trusting
 * the sentence: a chi-square over which slot each kind lands in, per bay count,
 * against uniform.
 *
 * The bar is the same one `choiceshape.mjs` holds the key's own position to:
 * a slot more than five points off its share is biased.
 */
const CHI_CRIT = { 2: 10.83, 3: 13.82, 4: 16.27 };
const KIND_OF_BAY = [
  ['the numbers bay', (b) => b === ''],
  ['a bay with a power in its header', (b) => /\^/.test(b)],
];
function bayOrderLines(boards, label, faults) {
  const lines = [];
  for (const [name, is] of KIND_OF_BAY) {
    const by = new Map();
    const seenCard = new Set();
    for (const bd of boards) {
      if (bd.card) { if (seenCard.has(bd.card)) continue; seenCard.add(bd.card); }
      const parts = partsOf(bd);
      const k = parts.length;
      const at = parts.findIndex(is);
      if (at < 0 || parts.filter(is).length !== 1) continue;
      if (!by.has(k)) by.set(k, new Array(k).fill(0));
      by.get(k)[at] += 1;
    }
    for (const [k, row] of [...by.entries()].sort()) {
      const n = row.reduce((a, b) => a + b, 0);
      // PRINTED EVEN WHEN IT CANNOT BE JUDGED. A row that disappears below a
      // sample-size bar is a row nobody notices going quiet, which is the shape
      // of defect this whole file exists about. `--seeds 80` deepens it.
      const thin = n < MIN_BOARDS;
      const exp = n / k;
      const chi = row.reduce((a, c) => a + ((c - exp) ** 2) / exp, 0);
      const worst = row.reduce((w, c, i) => (Math.abs(c - exp) > Math.abs(row[w] - exp) ? i : w), 0);
      const off = 100 * (row[worst] - exp) / n;
      const biased = !thin && chi > (CHI_CRIT[k] || 16.27) && Math.abs(off) > 5;
      lines.push(`    ${name} sits in slot   ${row.map((c) => (100 * c / n).toFixed(1) + '%').join(' ')}`
        + `   of ${n} card(s) with ${k} bays   chi2 ${chi.toFixed(1)}   `
        + `${thin ? `too few cards to judge — --seeds ${Math.ceil(MIN_BOARDS / 12) * 12} deepens it` : biased ? 'BIASED' : 'drawn'}`);
      if (biased) {
        faults.push(`${label}: ${name} does not sit in every slot equally often — slot ${worst + 1} takes it `
          + `${off >= 0 ? '+' : ''}${off.toFixed(1)} points off ${(100 / k).toFixed(1)}%, chi2 ${chi.toFixed(1)} over ${n} boards `
          + `with ${k} bays. A bay that is always in the same place needs no header read`);
      }
    }
  }
  return lines;
}

/**
 * THE CADETS WHO HOLD THE ERRORS THE GRAPH DECLARES.
 *
 * THIS IS THE HALF THAT ANSWERS THE REAL QUESTION, and no amount of shape
 * statistics could have answered it.
 *
 * A board is only a probe of a misconception if a learner who holds that
 * misconception gets it WRONG. On the two-bay board — the terms in the unknown
 * on one side, the pure numbers on the other — a learner who believes every
 * letter stands for the same kind of thing files every chip correctly, because
 * the board never asks them to tell `3x` from `3y`. So does a learner who
 * believes `x` and `x^{2}` are the same kind. So does a learner who conjoins
 * `3x + 2` into `5x`, because the board has already done the classifying for
 * them and printed it on the bays. **A surface named for like terms was
 * invisible to every error the node declares about like terms.**
 *
 * Each cadet below reads a chip and works out its kind BY THEIR OWN WRONG
 * RULE, then looks for the bay whose header is that kind by the same wrong
 * rule. If exactly one bay answers and it is the right one, for every chip on
 * the board, that cadet SEALS the board — and a board a wrong cadet seals
 * cannot tell them from a right one. There is no baseline and no threshold
 * here: it is a proof about each board, and the bar is zero.
 */
/**
 * THE BARS, and each one is a structural property of the board rather than a
 * taste.
 *
 * `never` — this cadet must seal NOTHING, because the board is built so they
 *   cannot. Every board carries two different letters, so a cadet who thinks
 *   one letter is as good as another finds two bays answering and cannot say
 *   which; a cadet who conjoins everything finds them all answering. A single
 *   sealed board means that construction has stopped holding.
 *
 * `run` — this cadet must not clear a THREE-BOARD PROVING RUN more often than a
 *   coin, which is `p^3 <= 0.5`, i.e. sealing at most 79.4% of boards. A board
 *   with no squared term on it cannot probe the squared-is-the-same error, and
 *   that is honest: band 1 of a first algebra unit does not carry `x^{2}`. What
 *   is not honest is a surface where the error can carry a learner through the
 *   unassisted run that advances a mastery claim, and three items is the run
 *   this game actually asks for.
 */
export const RUN_BAR = Math.cbrt(0.5);
export const MIS_CADETS = [
  ['combine-unlike', 'never', 'every term is the same kind (Booth: `3x + 2 = 5x`)', () => 'one'],
  ['combine-unlike', 'never', 'one letter is as good as another (MacGregor and Stacey)', (p) => (p ? 'letter' : '')],
  ['combine-unlike', 'never', 'the power is the kind, the letter is decoration', (p) => (/\^\{(\d+)\}/.exec(String(p)) || [null, p ? '1' : '0'])[1]],
  ['x-and-x-squared', 'run', '`x` and `x` squared are the same kind', (p) => String(p).replace(/\^\{\d+\}/, '')],
];

/** The variable part a chip carries, read off the printed chip. */
const partOfChip = (s) => {
  const m = /([A-Za-z](?:\^\{?\d\}?)?)$/.exec(String(s));
  return m ? m[1].replace(/\^(\d)$/, '^{$1}') : '';
};

/**
 * Play every misconception cadet over one population of boards.
 * @returns {{lines:string[], faults:string[]}}
 */
export function playMisconceptions(boards, label) {
  const lines = [], faults = [];
  if (!boards.length) return { lines, faults };
  lines.push(`    a cadet who holds the error the graph declares, filing by their OWN rule — a board they seal is a`);
  lines.push(`    board that cannot tell them from a cadet who is right, so the bar is zero and there is no baseline`);
  for (const [mid, bar, name, kindOf] of MIS_CADETS) {
    let sealed = 0;
    for (const bd of boards) {
      const parts = partsOf(bd);
      const ok = bd.chips.every((c, i) => {
        const want = kindOf(partOfChip(c));
        const answering = parts.map((b, j) => [kindOf(b), j]).filter(([k]) => k === want).map(([, j]) => j);
        return answering.length === 1 && answering[0] === bd.truth[i];
      });
      if (ok) sealed += 1;
    }
    const rate = sealed / boards.length;
    lines.push(`      ${name.padEnd(58)} seals ${(100 * rate).toFixed(1).padStart(5)}% of boards`
      + `   … and a three-board run ${(100 * rate ** 3).toFixed(1)}%   [${mid}, bar: ${bar === 'never' ? 'none at all' : '50% of a three-board run'}]`);
    const over = bar === 'never' ? sealed > 0 : rate > RUN_BAR;
    if (over) {
      faults.push(`${label}: a cadet who believes "${name}" files every chip of ${sealed.toLocaleString('en-US')} of `
        + `${boards.length.toLocaleString('en-US')} boards correctly, with no ambiguity — ${(100 * rate).toFixed(1)}% of `
        + `boards and ${(100 * rate ** 3).toFixed(1)}% of three-board proving runs. The graph declares \`${mid}\` on this `
        + `node, and a board this cadet seals cannot tell them from a cadet who knows what a like term is`);
    }
  }
  return { lines, faults };
}

/**
 * THE FLOOR OF THE WHOLE SURFACE — and it is printed even though it is not a
 * finding, because a number nobody prints is a number the next round re-derives
 * by hand and holds up as new.
 *
 * A fitted table is not the cleverest thing a cadet can do. A cadet can also
 * ELIMINATE: put the chips that look alike together, use the one-bit readings
 * (`is there a letter on it`, `is there a power on it`) to pin the groups those
 * readings can pin, and then GUESS among the matchings still standing — one
 * group to one bay, because a bay holds one kind. No fitted rule can express
 * that, because it is not a table from a chip to a bay; it is a constraint over
 * a whole board. So it is computed exactly here: for every board, how many
 * matchings survive the one-bit readings, and therefore what one guess is worth.
 *
 * WHY IT IS PRINTED AND NOT JUDGED AS A CUE. The step this cadet gets for free
 * — "chips whose printed body is the same string belong together" — is the SAME
 * GLYPH COMPARISON as filing a chip against a bay, because the bay's header
 * prints that body (`x terms`, `x^{2} terms`). There is no reading that groups
 * `4x` with `-7x` and cannot also match `4x` to the bay headed `x`: not colour
 * (one material), not position (both orders drawn), not length (`4x` and `-7x`
 * are different lengths), and not "it carries a letter" (that merges the `x`
 * group with the `y` group and is the wrong partition). So this figure is an
 * upper bound on a cadet who cannot exist, and the null every cue above is
 * measured against hands them that same free grouping on purpose — which makes
 * the baseline higher and every finding harder, never easier.
 *
 * It is still held to `RUN_BAR`: whatever the argument, a board that a coin
 * seals often enough to carry a three-board proving run is a board that cannot
 * be used as evidence, and this is the row that would say so.
 *
 * @returns {{rate:number, lines:string[], faults:string[]}}
 */
export function eliminationFloor(boards, label) {
  const lines = [], faults = [];
  if (!boards.length) return { rate: 0, lines, faults };
  // The one-bit readings, and nothing else. A chip is read off what is printed
  // on it; a bay off the KIND its header names, which is the thing a learner
  // can tell without matching a letter — "this one is for numbers, that one is
  // for squares". Telling WHICH letter is the mathematics and is withheld.
  const sigChip = (c) => `${/[A-Za-z]/.test(bodyOf(c)) ? 'L' : 'n'}${/\^/.test(bodyOf(c)) ? 'P' : 'p'}`;
  const sigBay = (p) => `${p ? 'L' : 'n'}${/\^/.test(String(p)) ? 'P' : 'p'}`;
  const left = new Map();
  let total = 0;
  for (const bd of boards) {
    const parts = partsOf(bd);
    const groups = groupsOf(bd);
    const gBy = new Map(), bBy = new Map();
    for (const [body] of groups) gBy.set(sigChip(body), (gBy.get(sigChip(body)) || 0) + 1);
    for (const p of parts) bBy.set(sigBay(p), (bBy.get(sigBay(p)) || 0) + 1);
    // How many one-to-one matchings survive: inside each signature, any group
    // may take any bay, so it is the falling factorial.
    let ways = 1;
    for (const [sig, g] of gBy) {
      const b = bBy.get(sig) || 0;
      if (b < g) { ways = 0; break; }
      for (let k = 0; k < g; k++) ways *= (b - k);
    }
    const p = ways ? 1 / ways : 0;
    total += p;
    left.set(ways, (left.get(ways) || 0) + 1);
  }
  const rate = total / boards.length;
  const spread = [...left.entries()].sort((a, b) => a[0] - b[0])
    .map(([w, c]) => `${w} matching${w === 1 ? '' : 's'} on ${(100 * c / boards.length).toFixed(1)}%`).join(', ');
  lines.push('    the FLOOR — group the chips that look alike, pin what one bit can pin, then guess the rest:');
  lines.push(`      a cadet who never reads a variable part seals ${(100 * rate).toFixed(1)}% of boards`
    + `   … and a three-board run ${(100 * rate ** 3).toFixed(1)}%   [${spread}]`);
  lines.push('      printed, not judged as a cue: grouping `4x` with `-7x` is the same glyph comparison as matching');
  lines.push('      `4x` to the bay headed `x`, so no cadet can have the first step and not the second');
  if (rate > RUN_BAR) {
    faults.push(`${label}: a cadet who groups the chips that look alike, pins what "is there a letter on it" and `
      + `"is there a power on it" can pin, and guesses the rest seals ${(100 * rate).toFixed(1)}% of boards and `
      + `${(100 * rate ** 3).toFixed(1)}% of three-board proving runs. A board a coin seals that often is not evidence`);
  }
  return { rate, lines, faults };
}

/**
 * THE RULE THAT IS SUPPOSED TO WIN — read the whole variable part off the chip
 * and put it in the bay whose header is that variable part. No fitting: it is
 * the definition, not a cue.
 */
function intendedRule(boards) {
  let sealed = 0;
  for (const bd of boards) {
    const parts = partsOf(bd);
    const ok = bd.chips.every((c, i) => parts[bd.truth[i]] === partOf(c));
    if (ok) sealed += 1;
  }
  return boards.length ? sealed / boards.length : 0;
}
const partOf = partOfChip;

/**
 * Play every rule over one population of boards.
 *
 * @param {Array} boards `{ chips:[string], truth:[number], bays:[string] }`
 * @param {string} label what to call this population in the report
 */
export function playSorter(boards, label) {
  const lines = [], faults = [];
  if (!boards.length) return { lines: [`  ${label}: no boards drawn`], faults, worst: null };
  const sizes = new Map();
  for (const bd of boards) sizes.set(bd.bays.length, (sizes.get(bd.bays.length) || 0) + 1);
  const chips = boards.reduce((a, b) => a + b.chips.length, 0);
  const twoLetters = boards.reduce((a, b) => a + (lettersOn(partsOf(b)) >= 2 ? 1 : 0), 0);

  const cards = new Set(boards.map((b) => b.card).filter(Boolean)).size;
  lines.push(`  ${label} — ${boards.length.toLocaleString('en-US')} boards`
    + `${cards ? ` (${cards.toLocaleString('en-US')} distinct cards, drawn once per locale)` : ''}`
    + `, ${chips.toLocaleString('en-US')} chips, `
    + `bays per board ${[...sizes.entries()].sort().map(([k, c]) => `${k}x${c}`).join(' ')}`);
  lines.push(`    two DIFFERENT letters on ${(100 * twoLetters / boards.length).toFixed(1)}% of boards`
    + `   — under 100% is a board where one glyph tells the bays apart`);
  const intended = intendedRule(boards);
  lines.push(`    reading the whole variable part seals ${(100 * intended).toFixed(1)}% of boards`
    + `   — that is the definition of a like term, and it has to be 100%`);
  if (intended < 0.999) {
    faults.push(`${label}: reading the whole variable part off a chip and matching it to the bay whose header is that `
      + `variable part seals only ${(100 * intended).toFixed(1)}% of boards. The surface is asking something a cadet `
      + `cannot answer by knowing what a like term is`);
  }
  if (twoLetters < boards.length) {
    faults.push(`${label}: ${boards.length - twoLetters} of ${boards.length} boards carry only one letter. With one `
      + `letter on the board every bay is told from every other by ONE glyph — is there a letter on the chip, is there `
      + `a power on it — and one glyph is what sealed this surface the last three times. Two different letters is the `
      + `bar, because then two bays cannot be told apart by anything except the letter itself`);
  }

  const nulls = scramble(boards);
  const rows = [];
  for (const [cueName, cue] of CHIP_CUES) {
    for (const [addrName, addr] of BAY_ADDRESSES) {
      const real = playRule(boards, cue, addr);
      const nul = playRule(nulls, cue, addr);
      rows.push({ name: `${cueName}  ->  ${addrName}`, real, nul, off: 100 * (real.seal - nul.seal), z: zOf(real, nul) });
    }
  }
  rows.sort((a, b) => b.off - a.off);
  lines.push(`    every rule below is fitted on half the boards and scored on the other half; the baseline beside it is`);
  lines.push(`    the same rule over the same boards with the GROUPS RE-MATCHED to the bays at random — groups whole,`);
  lines.push(`    bays where they are, so what is priced in is "I grouped them by shape and then guessed"`);
  for (const r of rows.slice(0, 12)) {
    lines.push(`      ${r.name.padEnd(58)} seals ${(100 * r.real.seal).toFixed(1).padStart(5)}%  `
      + `(baseline ${(100 * r.nul.seal).toFixed(1)}%, ${r.off >= 0 ? '+' : ''}${r.off.toFixed(1)} pts, `
      + `chips ${(100 * r.real.hit).toFixed(1)}%, ${r.real.n} boards / ${r.real.cards} cards held out, `
      + `z ${r.z === Infinity ? 'inf' : r.z.toFixed(1)})`
      + `${EXEMPT.test(r.name) ? '   — printed, not judged: on a board of one letter per kind that IS the variable part' : ''}`);
  }
  lines.push(...bayOrderLines(boards, label, faults));

  const mis = playMisconceptions(boards, label);
  lines.push(...mis.lines);
  faults.push(...mis.faults);

  const floor = eliminationFloor(boards, label);
  lines.push(...floor.lines);
  faults.push(...floor.faults);

  const worst = rows[0];
  for (const r of rows) {
    if (boards.length < MIN_BOARDS) break;
    if (EXEMPT.test(r.name)) continue;
    if (r.off > CUE_BAND && r.z > Z_P001) {
      faults.push(`${label}: "${r.name}" seals a whole board with NO MISS on ${(100 * r.real.seal).toFixed(1)}% of boards `
        + `against ${(100 * r.nul.seal).toFixed(1)}% for the same rule over a shuffled board, +${r.off.toFixed(1)} points over `
        + `${r.real.n} held-out boards (${r.real.cards} distinct cards, z ${r.z.toFixed(1)}). That is an unassisted seal `
        + `with no mathematics in it, on the surface `
        + `\`like-terms\` is taught through`);
    }
  }
  return { lines, faults, worst, intended, twoLetters: twoLetters / boards.length };
}

// ---------------------------------------------------------------------------
// --self-test: plant every cue, one at a time, and require the harness to name
// it — then hand it an honest board set and require silence.
// ---------------------------------------------------------------------------
function mkRnd(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0; return s / 4294967296; };
}

/**
 * An honest board: several unlike variable parts, TWO DIFFERENT LETTERS among
 * them, the chips drawn, the bays drawn, the counts drawn independently of the
 * kind. Two different letters is the bar the surface itself holds (see `_sort`):
 * with one letter on the board, one glyph tells any two bays apart.
 */
export function honestBoards(n = 600, seed = 7, sets = null) {
  const r = mkRnd(seed);
  const out = [];
  const SETS = sets || [['x', 'y', ''], ['n', 'n^{2}', 'p', ''], ['t', 'k', ''], ['m', 'm^{2}', 'q', ''], ['a', 'a^{2}', 'b', 'b^{2}']];
  for (let i = 0; i < n; i++) {
    const set = SETS[Math.floor(r() * SETS.length)];
    const bays = set.slice();
    for (let j = bays.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [bays[j], bays[k]] = [bays[k], bays[j]]; }
    const chips = [], truth = [];
    for (const part of set) {
      const many = 1 + Math.floor(r() * 2);
      for (let k = 0; k < many; k++) {
        let c = Math.floor(r() * 19) - 9;
        if (c === 0) c = 4;
        chips.push(part ? (c === 1 ? part : c === -1 ? `-${part}` : `${c}${part}`) : String(c));
        truth.push(bays.indexOf(part));
      }
    }
    for (let j = chips.length - 1; j > 0; j--) {
      const k = Math.floor(r() * (j + 1));
      [chips[j], chips[k]] = [chips[k], chips[j]];
      [truth[j], truth[k]] = [truth[k], truth[j]];
    }
    out.push({ chips, truth, parts: bays, bays: bays.map(printed) });
  }
  return out;
}

/** What a bay header reads as, in the shape the real surface prints it. */
const printed = (part) => (part ? `${part} terms` : 'pure numbers');

/** The board this surface used to draw: one letter, two bays, glyph classes. */
function glyphBoards(n = 600, seed = 11) {
  const r = mkRnd(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = 'xyn'[Math.floor(r() * 3)];
    const bays = ['', v];
    const chips = [], truth = [];
    for (let k = 0; k < 2; k++) { const c = 2 + Math.floor(r() * 8); chips.push(`${c}${v}`); truth.push(1); }
    for (let k = 0; k < 2; k++) { const c = 2 + Math.floor(r() * 30); chips.push(String(c)); truth.push(0); }
    for (let j = chips.length - 1; j > 0; j--) {
      const k = Math.floor(r() * (j + 1));
      [chips[j], chips[k]] = [chips[k], chips[j]];
      [truth[j], truth[k]] = [truth[k], truth[j]];
    }
    out.push({ chips, truth, bays });
  }
  return out;
}

/**
 * A board whose KIND SIZES say the bay: the group with one chip is the first
 * bay, the group with two the second, and so on. The tray is shuffled, so
 * nothing about a chip's place carries it — only how many chips share its body,
 * which is a fact about the board and not about the chip.
 */
function sizedBoards(n = 600, seed = 83) {
  const r = mkRnd(seed);
  const out = [];
  const SETS = [['x', 'y', ''], ['n', 'p', ''], ['a', 'b', '']];
  for (let i = 0; i < n; i++) {
    const set = SETS[Math.floor(r() * SETS.length)];
    const bays = set.slice();
    for (let j = bays.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [bays[j], bays[k]] = [bays[k], bays[j]]; }
    const chips = [], truth = [];
    bays.forEach((part, j) => {
      for (let k = 0; k <= j; k++) {
        const c = 2 + Math.floor(r() * 9);
        chips.push(part ? `${c}${part}` : String(c));
        truth.push(j);
      }
    });
    for (let j = chips.length - 1; j > 0; j--) {
      const k = Math.floor(r() * (j + 1));
      [chips[j], chips[k]] = [chips[k], chips[j]];
      [truth[j], truth[k]] = [truth[k], truth[j]];
    }
    out.push({ chips, truth, parts: bays, bays: bays.map(printed) });
  }
  return out;
}

/**
 * A WEAK tilt, over a controlled number of distinct CARDS.
 *
 * Three bays, two chips each, and how long a chip is says which bay it belongs
 * in — on a fraction `q` of cards, and a wrong bay on the rest. Every card is
 * emitted `copies` times, the way `sortboards.mjs` emits one row per locale.
 * The same tilt over the same number of ROWS must be a finding when the rows
 * are distinct cards and must not be one when they are three copies of a third
 * as many; that is the whole contract of the effective sample size, and it is
 * the difference between z 4.7 and z 2.7 on identical output.
 */
function tiltedBoards(cards, copies, q, seed = 137) {
  const r = mkRnd(seed);
  const out = [];
  for (let c = 0; c < cards; c++) {
    const bays = ['x', 'y', ''];
    for (let j = bays.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [bays[j], bays[k]] = [bays[k], bays[j]]; }
    const shift = r() < q ? 0 : 1 + Math.floor(r() * (bays.length - 1));
    const chips = [], truth = [];
    bays.forEach((part, j) => {
      const said = (j + shift) % bays.length;
      for (let k = 0; k < 2; k++) { chips.push(`${'9'.repeat(said + 1)}${part || '4'}`); truth.push(j); }
    });
    for (let j = chips.length - 1; j > 0; j--) {
      const k = Math.floor(r() * (j + 1));
      [chips[j], chips[k]] = [chips[k], chips[j]];
      [truth[j], truth[k]] = [truth[k], truth[j]];
    }
    for (let k = 0; k < copies; k++) out.push({ chips, truth, parts: bays, bays: bays.map(printed), card: `tilt-${c}` });
  }
  return out;
}

/** Rewrite every chip of a board, keeping which bay it belongs in. */
const repaint = (boards, f) => boards.map((bd) => ({ ...bd, chips: bd.chips.map((c, i) => f(c, bd.truth[i], bd)) }));

function selfTest() {
  let bad = 0;
  const say = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) bad += 1; };
  const caught = (boards, label, re) => playSorter(boards, label).faults.some((f) => re.test(f));
  console.log('sortcues --self-test — every cue planted, one at a time\n');

  // 0. THE HALF THAT MATTERS. A threshold that catches every planted defect and
  //    also catches the honest board is a threshold nobody keeps.
  const honest = playSorter(honestBoards(), 'HONEST');
  say(honest.faults.length === 0, `an honest board set draws no finding   (best cue "${honest.worst.name}" `
    + `${(100 * honest.worst.real.seal).toFixed(1)}% vs ${(100 * honest.worst.nul.seal).toFixed(1)}%)`);

  // 1. THE DEFECT THIS FILE EXISTS FOR: two bays that are the two glyph classes.
  const glyph = playSorter(glyphBoards(), 'PLANTED · the two bays are the two glyph classes');
  say(glyph.faults.some((f) => /it carries a letter/.test(f)),
    'the letter cue is caught — "a chip with a letter goes left, one without goes right" is refused');
  say(glyph.faults.some((f) => /carry only one letter/.test(f)),
    '  … and the shape of board that allows it is named on its own, before any rule is played');

  // 2. The tray laid out in bay order — the cue that shipped before this one.
  const ordered = honestBoards(600, 21).map((bd) => {
    const idx = bd.chips.map((_, i) => i).sort((a, b) => bd.truth[a] - bd.truth[b]);
    return { ...bd, chips: idx.map((i) => bd.chips[i]), truth: idx.map((i) => bd.truth[i]) };
  });
  say(caught(ordered, 'PLANTED · the tray sorted into bay order', /where it lies in the tray/),
    'the tray-order cue is caught');

  // 3. The bay is written in how long the chip is.
  const byLen = repaint(honestBoards(600, 33), (c, t) => `${'9'.repeat(t)}${bodyOf(c) || '4'}`);
  say(caught(byLen, 'PLANTED · the bay is written in the chip length', /how many glyphs long it is|how many digits it carries/),
    'the chip-length cue is caught');

  // 4. The count in front says which bay.
  const bySize = repaint(honestBoards(600, 41), (c, t) => `${[2, 7, 14, 19][t] ?? 3}${bodyOf(c)}`);
  say(caught(bySize, 'PLANTED · the count in front says the bay', /the size of the count in front/),
    'the coefficient-size cue is caught');

  // 5. The sign says which bay. Planted on two-bay boards, because a cue with
  //    two values cannot seal a board with three bays on it whatever it says —
  //    and on headers of different lengths, because with the bay order drawn a
  //    rule still has to be able to NAME the bay it wants.
  const twoBay = honestBoards(600, 53, [['x', 'y^{2}'], ['n', 'p^{2}'], ['t', 'k^{2}']]);
  const bySign = repaint(twoBay, (c, t, bd) => (bd.bays[t].includes('^') ? `-${bodyOf(c) || '4'}` : `${bodyOf(c) || '4'}`));
  say(caught(bySign, 'PLANTED · the sign says the bay', /whether the count is negative/), 'the sign cue is caught');

  // 6. Bay ORDER: the numbers bay is always the last one, so a chip with no
  //    letter on it needs no header read at all.
  const fixedBays = honestBoards(600, 61).map((bd) => {
    const order = bd.parts.map((b, i) => [b, i]).sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0) || a[1] - b[1]);
    const at = new Map(order.map(([, was], now) => [was, now]));
    return {
      ...bd,
      parts: order.map(([, was]) => bd.parts[was]),
      bays: order.map(([, was]) => bd.bays[was]),
      truth: bd.truth.map((t) => at.get(t)),
    };
  });
  say(caught(fixedBays, 'PLANTED · the numbers bay is always the last one', /does not sit in every slot equally often/),
    'a bay always in the same place is caught — the bays are drawn, and that is measured, not asserted');

  // 7. THE THREE RULES A ONE-CHIP TABLE CANNOT WRITE DOWN. Every cue above this
  //    line reads one chip; the cue that sealed this surface in round two —
  //    "first chip left, next right, keep alternating" — was a fact about a
  //    chip's place among the others. These three are that shape.
  //
  //    7a. The group with one chip in it is always the first bay, the group
  //        with two the second, and so on.
  const sized = sizedBoards();
  say(caught(sized, 'PLANTED · how many chips a kind has says which bay it is', /how big its group is, ranked|how many chips share its body/),
    'the group-size cue is caught — a rule about a chip\'s KIND, which no one-chip table can write');

  //    7b. The tray is drawn, but the groups first APPEAR in bay order — the
  //        round-two cue with the rest of the tray shuffled on top of it, so
  //        position alone cannot seal and only the first appearances carry it.
  const started = honestBoards(600, 91).map((bd) => {
    const at = new Map();
    bd.chips.forEach((c, i) => { const b = bodyOf(c); if (!at.has(b)) at.set(b, []); at.get(b).push(i); });
    const bySlot = [...at.values()].sort((a, b) => bd.truth[a[0]] - bd.truth[b[0]]);
    const head = bySlot.map((ix) => ix[0]);
    const rest = bySlot.flatMap((ix) => ix.slice(1));
    const r = mkRnd(0x51ed + bd.chips.length);
    for (let j = rest.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [rest[j], rest[k]] = [rest[k], rest[j]]; }
    const idx = [...head, ...rest];
    return { ...bd, chips: idx.map((i) => bd.chips[i]), truth: idx.map((i) => bd.truth[i]) };
  });
  say(caught(started, 'PLANTED · the groups first appear in bay order', /where its GROUP starts in the tray/),
    'the group-first-appearance cue is caught — round two\'s cue with the rest of the tray shuffled over it');

  //    7c. An ADDRESS a rank by position or by length cannot reach: the bays
  //        read alphabetically. Without it, a board whose bays are named in a
  //        fixed alphabetical order has a cue no rule in the table can express.
  const alpha = honestBoards(600, 103).map((bd) => {
    const rank = rankOfStr(bd.bays.map(String));
    return { ...bd, chips: bd.chips.map((c, i) => `${'9'.repeat(rank[bd.truth[i]])}${bodyOf(c) || '4'}`) };
  });
  say(caught(alpha, 'PLANTED · the bay is written in where its header falls alphabetically', /by the header read alphabetically/),
    'an address that is neither a place nor a length is caught — the bays read alphabetically');

  //    7d. THE FLOOR ITSELF. On the board this surface used to draw, eliminating
  //        leaves exactly one matching, so the "guess" is not a guess.
  const floorOld = eliminationFloor(glyphBoards(), 'PLANTED · the old board');
  const floorNew = eliminationFloor(honestBoards(), 'HONEST');
  say(floorOld.faults.length > 0 && floorOld.rate > 0.99,
    `the FLOOR refuses the old board — eliminating alone seals ${(100 * floorOld.rate).toFixed(1)}% of it`);
  say(floorNew.faults.length === 0,
    `  … and is quiet on a board of several unlike kinds (${(100 * floorNew.rate).toFixed(1)}%, bar ${(100 * RUN_BAR).toFixed(1)}%)`);

  // 7e. THE WEIGHT BEHIND A RATE IS CARDS, NOT ROWS. The same tilt over the
  //     same number of rows: a finding when the rows are distinct cards, and
  //     not one when they are three locale copies of a third as many. Without
  //     this the z is multiplied by sqrt(3) and the gate manufactures p<0.001
  //     out of a tilt a chi-square over the same cards calls noise — which is
  //     exactly what it did the first time the rule table was widened.
  const LEN = /how many glyphs long it is/;
  const wide = playSorter(tiltedBoards(1200, 1, 0.28), 'PLANTED · a weak tilt over 1,200 distinct cards');
  const deep = playSorter(tiltedBoards(400, 3, 0.28), 'PLANTED · the same tilt over 400 cards drawn three times');
  say(wide.faults.some((f) => LEN.test(f)), 'a weak tilt over 1,200 distinct cards IS a finding');
  say(!deep.faults.some((f) => LEN.test(f)),
    '  … and the same tilt over 400 cards drawn three times is NOT — three copies of one card are one card');

  // 7f. THE SHAPE THE ROUTE'S FIRST BAND ACTUALLY DRAWS, and the control this
  //     file did not have. Two letter bays, four chips, both orders drawn:
  //     there are six arrangements, so ONE fixed positional table seals one in
  //     six of them by chance and 16.7% is the honest baseline. The old modal
  //     fit could name the same bay for every position when the counts split
  //     near-evenly — a table that can never seal anything — so the baseline
  //     came out at 0.0% and the rule was printed at +23.0 points over nothing.
  //     A gate that fires on honest content is a gate somebody switches off.
  const TWO = [['x', 'y'], ['n', 'p'], ['t', 'k']];
  const POS = /where it lies in the tray|how many glyphs long it is|the size of the count in front/;
  const band1 = honestBoards(1800, 17, TWO).map((bd, i) => ({ ...bd, card: `b1-${Math.floor(i / 3)}` }));
  const b1 = playSorter(band1, 'HONEST · two letter bays, four chips — the band-1 shape');
  const posRow = b1.lines.find((l) => /where it lies in the tray  ->  by where the bay sits/.test(l)) || '';
  say(!b1.faults.some((f) => POS.test(f)),
    `a two-bay board with both orders drawn draws no SHAPE finding${(/baseline (\d+\.\d)%/.exec(posRow) || [])[1] ? `   (baseline ${(/baseline (\d+\.\d)%/.exec(posRow) || [])[1]}%, and one arrangement in six is 16.7%)` : ''}`);

  //     … and the same shape with the tray laid out in bay order must still be
  //     refused, because the fix above must not have bought the quiet by
  //     raising the baseline past what a real cue is worth.
  const band1cue = honestBoards(1800, 23, TWO).map((bd, i) => {
    const idx = bd.chips.map((_, j) => j).sort((a, b) => bd.truth[a] - bd.truth[b]);
    return { ...bd, chips: idx.map((j) => bd.chips[j]), truth: idx.map((j) => bd.truth[j]), card: `b1c-${Math.floor(i / 3)}` };
  });
  say(playSorter(band1cue, 'PLANTED · two bays, the tray sorted into bay order').faults.some((f) => POS.test(f)),
    '  … and the same two-bay shape with the tray sorted into bay order IS still refused');

  // 8. A surface nobody can answer: a bay does not hold what its header says.
  const unanswerable = honestBoards(300, 71).map((bd) => ({ ...bd, truth: bd.truth.map((t) => (t + 1) % bd.bays.length) }));
  say(caught(unanswerable, 'PLANTED · the bays do not hold what their headers say', /cannot answer by knowing what a like term is/),
    'a board whose bays do not hold what their headers say is caught');

  console.log(`\n${bad ? `${bad} check(s) FAILED` : 'every planted cue was caught, and the honest set drew nothing'}`);
  return bad;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 1 : 0);
  const { routeBoards } = await import('./sortboards.mjs');
  const i = process.argv.indexOf('--seeds');
  const { route, preview, forms } = await routeBoards(Number(i >= 0 ? process.argv[i + 1] : 12));
  console.log(`the sorting bays, played by a cadet who does no mathematics — ${route.length} route boards, `
    + `${preview.length} preview, over ${forms.size} route form(s): ${[...forms.entries()].map(([k, c]) => `${k} ${c}`).join(', ')}\n`);
  for (const [boards, label] of [[route, 'ROUTE · the sorter'], [preview, 'preview · the sorter']]) {
    const r = playSorter(boards, label);
    r.lines.forEach((l) => console.log(l));
    r.faults.forEach((f) => console.log(`  FINDING  ${f}`));
    console.log('');
  }
}
