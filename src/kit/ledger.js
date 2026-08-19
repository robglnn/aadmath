import { t } from '../i18n/index.js';
import { dayNumber } from '../meta/days.js';
import './ledger.css';

/**
 * THE LEDGER — the one place a cipher mote is created, spent or lost, and the
 * one place that says so out loud.
 *
 * WHY THIS FILE EXISTS
 *
 * A cold player wrote: *"Cipher shards silently reset to zero three separate
 * times (4 → 0, 2 → 0, +1 → 0) with no toast, no explanation, and no way I ever
 * found to spend them."* Nothing in the game was resetting anything. What was
 * happening was worse, because it looked like a bug and was in fact the design:
 *
 *   · `src/world/drift.js` throws a pressure ring out of every unsealed rift
 *     every fifteen seconds, and a ring that catches you took a FLAT NINE
 *     motes off the wallet;
 *   · the wallet's old `take` was `Math.min(count, 9)` — so any balance under
 *     nine went to exactly zero, every time, which is indistinguishable from a
 *     reset by anybody who is not reading the source;
 *   · the one line that explained it went through `hud.flash`, which is a
 *     SINGLE toast element on an 1800 ms timer. A surge also throws the cadet
 *     fifteen metres and off his feet, and landing fires `player.onFall ->
 *     hud.flash('No footing there')`. The explanation was overwritten by its
 *     own consequence, roughly half a second after it appeared.
 *
 * So the first four minutes of the game were: earn two, earn two, lose all of
 * it, with the reason printed and then deleted. A currency that vanishes
 * without explanation does not merely cost the player some motes — it makes
 * every other number on screen unreliable, which is the whole product.
 *
 * THE TWO RULES
 *
 * ONE. **A levy is a tithe, never a confiscation.** `take()` may remove at most
 * a QUARTER of the balance, rounded down, and never more than it asked for. A
 * surge that meets a rich cadet still costs the full nine; a surge that meets a
 * cadet holding four motes costs one; under four it costs nothing at all and
 * says so. The wallet can no longer be emptied by anything the player did not
 * choose — `spend` is the only path to zero, and `spend` is a purchase.
 *
 * TWO. **Every movement is on screen, in its own element, for four and a half
 * seconds, with the reason and the balance it left behind.** The strip below
 * belongs to the ledger alone: no toast can overwrite it, because no toast can
 * reach it. Two motes earned reads `+2 · Cipher vein · balance 6`. Nine lost
 * reads `−9 · Rift surge · balance 31`. There is no state of this game in which
 * the number moves and the player is not told which way, by how much, and why.
 *
 * That last figure used to be printed as `6 left`, and a cold player watched it
 * read 2 left, 6 left, 10 left, 13 left, 39 left and wrote *"a number called
 * 'left' that only goes up is not a number."* The figure was always the balance
 * after the movement — right number, wrong noun, and in English a countdown's
 * noun. See `ledger.balance` in the bundle.
 *
 * Everything downstream — the builder, the kit, the drift field, the caches —
 * keeps the exact surface it had (`count/earn/spend/take`), so this is a
 * replacement for the wallet object rather than a new dependency for anybody.
 */

/**
 * THE ASSAY — why a long night pays less than a second morning.
 *
 * A blind critic measured a wallet holding **34,782 shards at day 60** against
 * a price list whose dearest line was 410. At that balance no purchase is a
 * decision, and Marlow's own coda line — "nine thousand shards have just
 * stopped arguing" — was the game noticing and not fixing it.
 *
 * Sixty days of that balance came from one place. The island's standing charge
 * is about a thousand shards a sweep (tools/critic/econflow.mjs), and **every
 * shard of it pays without a single question being answered**. It is a faucet
 * with no tap on it: walk further, earn more, for ever.
 *
 * So the ground has a day's yield in it, and no more.
 *
 *   The first `ASSAY` shards the island gives up in a day pay in full.
 *   The next `ASSAY` pay half. Everything after that pays a quarter.
 *   Nothing ever pays nothing: a mote you picked up is always worth at least
 *   one shard, because a pickup that pays zero reads as a bug.
 *
 * The day is the local calendar day the spacing schedule reads (`days.js`), so
 * a harness that moves the clock moves this with it and a tab left open
 * overnight is not two days.
 *
 * WHAT IS NOT TAPERED: everything a question pays. A sealed rift, a worked
 * example, a proving item, a rung of the descent — all of it pays full rate,
 * all day, for ever. The whole point is that after about twenty minutes of
 * picking things up, **answering is the better-paid job**, which is the one
 * sentence this game's economy is supposed to say.
 *
 * A cadet who plays one session a day never meets this rule: `ASSAY` is more
 * than a sitting's worth of ground. It is only ever felt by somebody trying to
 * buy the endgame by staying up late, and it tells them so once, plainly.
 */
export const ASSAY = 260;
/**
 * Income the island hands over for free, and therefore the only income the
 * day's assay tapers. `deepcache` is here for the same reason `cache` is: a
 * cadet who cracks one is picking something up, however hard it was to reach.
 * `bind` is deliberately NOT here — running a warden down and taking the weight
 * that makes its statement true is a question answered, and answers are never
 * tapered. That distinction is the one sentence this economy exists to say.
 */
const GROUND = new Set(['vein', 'cache', 'deepcache', 'span', 'anchor', 'found']);
/** Where the day's yield is kept, so a reload is not a fresh seam. */
const ASSAY_KEY = 'ascent.assay';

/** What share of the wallet a levy is allowed to reach, at the very most. */
export const LEVY_SHARE = 0.25;
/** How long one line stays on the strip. Long enough to read after a knockback. */
const LINE_MS = 4500;
/** How many movements the strip shows at once before the oldest is retired. */
const MAX_LINES = 3;

/**
 * @param {object} o
 * @param {HTMLElement} o.root       where the strip mounts (the UI layer)
 * @param {number}      o.initial    the balance restored from the save
 * @param {() => void}  o.onChange   redraw the HUD and persist; called after every move
 * @param {() => number} o.clock     the wall clock the spacing schedule reads, so
 *        the day's yield turns over on the same midnight everything else does
 */
/**
 * A ROW'S LIFE IS COUNTED IN THE TIME IT WAS ACTUALLY ON THE GLASS.
 *
 * A wall clock spends a row whether anybody could see it or not. That is
 * survivable for a receipt and fatal for the row that says what a word MEANS:
 * `ledger.first.*` is printed once, EVER, and the reason is written into the
 * seen set the moment the row is appended. If the frame it landed on belonged
 * to something else — a rank rite, an open tear, or the grant card that a phone
 * on its side gives the whole middle of the screen to — then the one printing
 * of that definition was spent on a frame nobody could read, and there is no
 * second one.
 *
 * So the clock only runs while the row is lit. src/kit/kit.js takes exactly
 * this position about the grant card, in almost these words, and for exactly
 * this reason: a thing the player earned and could not read is worse than one
 * that arrives four seconds late.
 */
function retire(row, ms) {
  let left = ms;
  let last = -1;
  const tick = (now) => {
    if (!row.isConnected) return;
    if (last < 0) last = now;
    if (now - last >= 100) {
      let lit = 1;
      try {
        lit = parseFloat(getComputedStyle(row).opacity || '1');
        const p = row.parentElement;
        if (p) lit *= parseFloat(getComputedStyle(p).opacity || '1');
      } catch { lit = 1; }
      if (lit > 0.5) left -= now - last;
      last = now;
    }
    if (left <= 0) {
      row.classList.remove('in');
      setTimeout(() => row.remove(), 420);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function createLedger({ root, initial = 0, onChange = () => {}, clock = () => Date.now() }) {
  let count = clean(initial);
  /** The day's yield: which day it is, and how much ground has been worked. */
  const assay = { day: 0, took: 0, said: false };
  try {
    const raw = JSON.parse(localStorage.getItem(ASSAY_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      assay.day = raw.day | 0;
      assay.took = Math.max(0, raw.took | 0);
      assay.said = !!raw.said;
    }
  } catch { /* private mode */ }

  /** A new day is a fresh seam. Nothing carries over, in either direction. */
  function today() {
    const n = dayNumber(clock());
    if (n !== assay.day) { assay.day = n; assay.took = 0; assay.said = false; }
    return assay;
  }

  /**
   * What the island actually pays for the next `n` shards of ground, given how
   * much it has already given up today. Full rate to `ASSAY`, half to twice
   * that, a quarter after — and never less than one shard for a real pickup.
   */
  function assayed(n) {
    const a = today();
    let left = n;
    let paid = 0;
    let at = a.took;
    while (left > 0) {
      const band = at < ASSAY ? 1 : at < ASSAY * 2 ? 0.5 : 0.25;
      const room = at < ASSAY ? ASSAY - at : at < ASSAY * 2 ? ASSAY * 2 - at : left;
      const take = Math.min(left, room);
      paid += take * band;
      at += take;
      left -= take;
    }
    a.took += n;
    saveAssay();
    return { paid: Math.max(1, Math.round(paid)), thin: a.took > ASSAY };
  }

  /* One mote is one `earn`, and a cadet running through a lit vein earns eight
     of them in two seconds, so this is throttled: the number in memory is
     always right, and the copy on disk is at most two seconds behind. A crash
     inside that window costs the player nothing and the game a couple of motes
     of yield. `pagehide` closes the window on the ordinary way out. */
  let assayT = 0;
  function saveAssay(now = false) {
    const at = Date.now();
    if (!now && at - assayT < 2000) return;
    assayT = at;
    try { localStorage.setItem(ASSAY_KEY, JSON.stringify(assay)); } catch { /* private mode */ }
  }
  addEventListener('pagehide', () => saveAssay(true));
  /** The last movements, newest first — evidence, for the foundry and for tools. */
  const log = [];
  /** Which reasons have already introduced themselves. See FIRST SIGHT below. */
  const seen = loadSeen();

  const strip = document.createElement('div');
  strip.className = 'ledger';
  strip.setAttribute('aria-live', 'polite');
  (root || document.body).appendChild(strip);

  /**
   * Put one movement on the strip.
   *
   * `why` is an i18n key under `ledger.why`. An unknown or missing reason falls
   * back to a neutral one rather than printing a key — a caller that has not
   * been taught the vocabulary yet should still produce a readable line.
   */
  function announce(delta, why, kind) {
    const row = document.createElement('div');
    row.className = `led-row ${kind}`;
    const sign = delta > 0 ? '+' : '−';
    row.innerHTML = '<b class="led-n"></b><span class="led-why"></span><i class="led-left"></i>';
    row.querySelector('.led-n').textContent = `${sign}${Math.abs(delta)}`;
    // First sight: the reason arrives with its own definition, once, ever.
    const gloss = !seen.has(why) && t('ledger.first.' + why);
    if (gloss && !String(gloss).startsWith('ledger.')) {
      seen.add(why); saveSeen(seen);
      row.classList.add('taught');
      row.querySelector('.led-why').textContent = gloss;
    } else {
      row.querySelector('.led-why').textContent = reason(why, kind);
    }
    // The wallet balance after this movement — not a countdown. See the note on
    // `ledger.balance` in the bundle: the figure was right and the noun was
    // wrong, and a counter has to count what its label says.
    row.querySelector('.led-left').textContent = t('ledger.balance', { n: count });
    strip.appendChild(row);
    while (strip.children.length > MAX_LINES) strip.firstChild.remove();
    // Two frames, then the entrance transition — a row appended and animated in
    // the same tick does not animate at all in Chromium.
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('in')));
    // A definition is read once and needs longer than a receipt does — and it
    // is counted in painted time, not wall time (see `retire` above).
    retire(row, row.classList.contains('taught') ? LINE_MS + 2600 : LINE_MS);
    // `left` here is the BALANCE AFTER the movement, and the field keeps its
    // name because tools/critic/pacing.mjs and the foundry read it. The strip's
    // own label no longer says "left" — see `ledger.balance` — because on screen
    // that noun promised a countdown and delivered a running total.
    log.unshift({ delta, why, at: Date.now(), left: count });
    if (log.length > 24) log.pop();
  }

  /**
   * A rule on the strip, with no number on it. One a day, at most: it says why
   * the last pickup paid less than the one before it.
   */
  function announceNote(key) {
    const row = document.createElement('div');
    row.className = 'led-row note';
    row.innerHTML = '<b class="led-n">·</b><span class="led-why"></span>';
    row.querySelector('.led-why').textContent = t(key);
    strip.appendChild(row);
    while (strip.children.length > MAX_LINES) strip.firstChild.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('in')));
    retire(row, LINE_MS + 1600);
  }

  /** A line the strip prints when a levy found nothing worth taking. */
  function announceSafe(why) {
    const row = document.createElement('div');
    row.className = 'led-row safe';
    row.innerHTML = '<b class="led-n">—</b><span class="led-why"></span>';
    row.querySelector('.led-why').textContent = t('ledger.spared');
    strip.appendChild(row);
    while (strip.children.length > MAX_LINES) strip.firstChild.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('in')));
    retire(row, LINE_MS);
    log.unshift({ delta: 0, why, at: Date.now(), left: count });
  }

  return {
    count: () => count,

    /**
     * Motes into the wallet. `why` names the source on the strip.
     *
     * Ground income — a vein, a cache, an anchor, a thing picked up — is paid
     * against the day's assay above. Everything a question pays is paid in
     * full, always. The strip prints what actually arrived, so the balance and
     * the line can never disagree.
     */
    earn(n, why = 'found') {
      const got = clean(n);
      if (!got) return 0;
      let paid = got;
      if (GROUND.has(why)) {
        const a = assayed(got);
        paid = Math.min(got, a.paid);
        // Said once a day, the first time the seam thins, and never again that
        // day: a rule a player cannot see is a bug with better manners.
        if (a.thin && !assay.said) {
          assay.said = true;
          saveAssay(true);
          setTimeout(() => announceNote('ledger.thin'), 900);
        }
      }
      count += paid;
      announce(paid, why, 'up');
      onChange();
      return paid;
    },

    /**
     * A purchase. The only route to an empty wallet, and always a choice.
     * Refuses rather than going into debt, exactly as it always did.
     */
    spend(n, why = 'spent') {
      const cost = clean(n);
      if (count < cost) return false;
      count -= cost;
      announce(-cost, why, 'down');
      onChange();
      return true;
    },

    /**
     * A LEVY — what the world takes without being asked. See rule one above:
     * at most a quarter of the balance, rounded down, and never more than `n`.
     * Returns what it actually cost, so the caller can word its own line.
     */
    take(n, why = 'surge') {
      const asked = clean(n);
      const cap = Math.floor(count * LEVY_SHARE);
      const got = Math.max(0, Math.min(count, asked, cap));
      if (!got) { announceSafe(why); return 0; }
      count -= got;
      announce(-got, why, 'down');
      onChange();
      return got;
    },

    /** The last movements, newest first. Read by tools and by the foundry. */
    history: () => log.slice(),

    /**
     * One rule on the strip, with no number on it — for a caller that has just
     * paid less than the player expected and owes them the reason. The kit uses
     * it for the descent's day record; it is deliberately not rate-limited
     * here, because "once a day" is a fact only the caller knows.
     */
    note: (key) => announceNote(key),

    /**
     * The day's yield: how much ground has been worked today, out of the assay,
     * and what the next shard of it would pay. Read by tools/critic/pacing.mjs
     * so the earn curve it measures is this one and not a copy of it.
     */
    assay: () => {
      const a = today();
      return {
        cap: ASSAY, took: a.took,
        rate: a.took < ASSAY ? 1 : a.took < ASSAY * 2 ? 0.5 : 0.25,
      };
    },

    /** A fresh cadet. Used by `__ascent.reset()` and by the harness. */
    reset() {
      count = 0;
      log.length = 0;
      strip.innerHTML = '';
      assay.took = 0;
      assay.said = false;
      saveAssay(true);
      // A fresh cadet has been taught nothing, so every reason introduces
      // itself again. A cleared save that still remembers the vocabulary is not
      // a cleared save, and it is exactly the state a cold-start gate runs in.
      seen.clear();
      saveSeen(seen);
      onChange();
    },
  };
}

const clean = (n) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/**
 * A caller that has not been taught the vocabulary — a piece the kit gains
 * later, a sink somebody adds next week — must still produce a readable line
 * rather than a dotted key. The fallback follows the direction of travel:
 * money arriving was picked up, money leaving was spent.
 */
const reason = (why, kind) => {
  const line = t('ledger.why.' + why);
  if (line && !line.startsWith('ledger.')) return line;
  return t('ledger.why.' + (kind === 'down' ? 'spent' : 'found'));
};

/* ---------------------------------------------------------------------------
   FIRST SIGHT — a reason that says what it means, once.

   src/ui P1. The cold critic's list of words the game uses and never defines
   ended with the sharpest one: *"+5 DESCENT is printed as a reward reason and
   defined nowhere."* It was not alone — CIPHER VEIN, LATTICE ANCHOR, HANGING
   CACHE and RIFT SURGE were all coined on this strip, at 0.56 rem, in the
   corner of the eye, to a fifteen-year-old who has been playing for ninety
   seconds. Five nouns invented by a receipt.

   The critic also named the fix, because the game already did it once and did
   it well: *"held means proved for good"* on the objective card — the term and
   its meaning in one breath, the first time, and the bare term every time
   after. This is that, generalised.

   The FIRST time a reason is printed the strip prints `ledger.first.<why>`,
   which is the reason with its definition attached. Every printing after that
   is the bare noun, because by then it is a word the player owns. What has been
   seen is persisted, so it survives the session break the whole product is
   shaped around: coming back tomorrow does not re-teach you a word, and it also
   does not leave you having missed the one time it was explained.
   --------------------------------------------------------------------------- */
const SEEN_KEY = 'ascent.ledgerterms';

function loadSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch { return new Set(); }
}

function saveSeen(seen) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* private mode */ }
}
