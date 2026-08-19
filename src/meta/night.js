/**
 * THE STANDING ORDER — the reason to open it tomorrow, left on the island today.
 *
 * THE DEFECT THIS ANSWERS, MEASURED
 *
 * `tools/critic/_w16diag.mjs` played fifteen mornings of a returning cadet
 * against the running build. Days one to eight are dense: a rank, a chapter or
 * a new capability lands almost every morning. Then:
 *
 *   day  9: NOTHING — same lattice, same ladder, same price
 *   day 10: NOTHING
 *   day 11: NOTHING
 *   day 12: NOTHING
 *   day 13: charters 0 -> 1
 *   day 14: NOTHING
 *
 * and the wallet at day fifteen held **10,109 shards against a dearest price of
 * 240 and exactly one charter**. That is the blind critic's sentence — *"by
 * then I would hold all six grants, shards would be confetti, and the island
 * would still be scenery with pickups on it"* — reproduced as a table.
 *
 * Two separate things are wrong in it, and only one of them is the economy.
 *
 * THE FIRST is that **nothing was ever waiting.** Everything the game gives a
 * returning player is computed at the moment they arrive: a night is credited,
 * a ladder is re-read, a card names what continues. All of it is true and none
 * of it was *there* before they closed the tab. A reason to come back that only
 * comes into existence when you come back is not a reason to come back. It is a
 * reward for having already decided.
 *
 * So a session that ends leaves something behind, on the island, at the spot
 * where the cadet stood down:
 *
 *   A STANDING ORDER is one line the cadet already holds, named and dated at
 *   the close of a run, with a MARK raised over the ground where they stopped.
 *   The mark is visible from a long way off and it does not go out on its own.
 *   It goes out when the cadet comes back **on a later day** and answers that
 *   line once, unassisted. Then it pays.
 *
 * THE MARK IS A SIGN, NOT A GATE — and the words on the card say so.
 *
 * A first draft of the close card read *"Go to the column of light. Answer that
 * line once at the mark."* The engine has never required that and must not: the
 * mark stands where the cadet happened to be standing when the run ended, which
 * is not guaranteed to be anywhere near a tear that serves the line it names.
 * An instruction the engine does not enforce is either a wall the player cannot
 * climb or a lie they will eventually catch, and this build has been burned by
 * the second kind more than once. The order settles on the answer, wherever it
 * is given; the column is what makes the debt visible from across the island.
 *
 * That is not a new thing to learn and it is not a new currency. It is the
 * retention re-probe the mastery engine was going to run anyway
 * (`src/learn/mastery.js`), given a place, a date and a consequence — so that
 * the thing the whole product is actually claiming, *you still know this
 * tomorrow*, is something a fifteen-year-old can see standing in a field
 * instead of a number in a report.
 *
 * WHY IT CANNOT BE FARMED
 *
 * One order stands at a time, and an order laid today cannot be settled today.
 * `dayNumber` is the same local calendar day the spacing schedule and the night
 * ledger read (`days.js`), so a harness that moves the clock moves this with it
 * and a tab left open overnight is not two days. Answering the line twenty more
 * times this afternoon does nothing at all. The only input it accepts is: leave,
 * come back on another day, and still know it.
 *
 * THE SECOND thing wrong in that table is the economy, and this file is half of
 * that fix too. Charters are the licence for the only permanent, hand-placed,
 * map-changing thing in the game, and at day fifteen a daily player had earned
 * one — while holding forty-two waystations' worth of shards. The bottleneck
 * was on the wrong side, so there was never a decision to make: the money was
 * always there and the licence never was. **Every third order kept is a
 * charter** — the same rate a bound warden pays (`src/world/warden.js`), and
 * the same argument: three days of coming back. That puts the two scarcities
 * back on the same footing, which is the only condition under which a purchase
 * is a choice rather than a wait.
 *
 * WHAT IS NOT HERE. No streak. No penalty. An order that is never settled costs
 * nothing, expires nothing, and takes nothing away — it simply stands there
 * until it is collected, for as long as that takes. A cadet who misses four
 * days comes back to a mark still standing and still worth what it was worth.
 * The one thing this game must never do is make a teenager feel that not
 * playing it has cost them something, because that is the mechanic that turns
 * a game back into a compulsory assignment wearing a friendlier hat.
 */
import { dayNumber } from './days.js';

/** Where the standing order lives. Its own key: it outlives a run and a save. */
const KEY = 'ascent.night';

/**
 * Orders kept per charter. Three, which is three separate days of coming back —
 * the rate `src/world/warden.js` already pays, arrived at from the other end.
 */
export const ORDERS_PER_CHARTER = 3;

/**
 * What clearing a mark pays, in shards.
 *
 * It is a question answered, so the day's assay never tapers it
 * (`src/kit/ledger.js`) — and it is deliberately about a fifth of a waystation,
 * so that the thing which pays for the endgame is the thing that can only be
 * done by coming back. A cadet who wants the money faster can pick the island
 * clean instead, and the island's free income taper will make sure that is the
 * slower road.
 */
export const ORDER_PAYS = 48;

/** A blank record. */
export function blankNight() {
  return { order: null, kept: 0, day: 0 };
}

/**
 * @param {object} o
 * @param {object} o.mastery      the live engine — read only, never written
 * @param {() => number} o.clock  the wall clock the spacing schedule reads
 * @param {(info:object) => void} [o.onKept]  an order was settled, just now
 */
export function createNight({ mastery, clock = () => Date.now(), onKept = () => {} }) {
  const rec = load();

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v || typeof v !== 'object') return blankNight();
      return {
        order: v.order && typeof v.order.skill === 'string' ? { ...v.order } : null,
        kept: Math.max(0, v.kept | 0),
        day: v.day | 0,
      };
    } catch { return blankNight(); }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* private mode */ }
  }

  const today = () => dayNumber(clock());

  /** The lines this cadet holds, which are the only ones an order may name. */
  function heldLines() {
    const out = [];
    try {
      for (const n of mastery.graph.nodes) {
        if (mastery.state.get(n.id)?.mastered) out.push(n.id);
      }
    } catch { /* an engine mid-reset is not a reason to break the close beat */ }
    return out;
  }

  /**
   * How many orders a cadet keeps before the lattice starts asking for the hard
   * ones. Two: the first two are the introduction, and by the third this is a
   * habit rather than a novelty.
   */
  const AMBITION_AT = 2;

  /**
   * WHICH LINE THE ORDER NAMES — and it is not the same kind of line all week.
   *
   * FOR THE FIRST TWO it is the line the retention schedule was going to ask
   * about soonest anyway. An order is *a place and a date put on a re-probe
   * that was already coming*, so naming a line the engine had no intention of
   * re-checking would make it a second, competing schedule, and two schedules
   * is the same as none. It is also the gentlest possible introduction: the
   * first mark a cadet ever clears is one they would have cleared regardless.
   *
   * AFTER THAT it is the DEEPEST line still held — the one with the most
   * lattice standing under it (`mastery.standsOn`). This is the difference
   * between the second week and the first, and it is the answer to *"day 15 is
   * the same ten lines"*: by the third mark the easy lines have been re-proved
   * several times each, and an order that went on naming "Reading a variable"
   * on the fifteenth morning would be the game asking a Sovereign to prove they
   * can still read a letter. Ties break on the sooner re-probe, so the deep
   * choice is still a re-probe the schedule wanted.
   *
   * Falls back to the first held line if the engine will not answer, because a
   * close beat that throws is worse than an order on a line chosen plainly.
   */
  function pickSkill() {
    const held = heldLines();
    if (!held.length) return null;
    const deep = rec.kept >= AMBITION_AT;
    let best = null;
    let bestDue = Infinity;
    let bestDepth = -1;
    for (const id of held) {
      // `dueTime` is the wall clock at which the retention schedule wants this
      // line looked at again (src/learn/mastery.js, `isDue`). Soonest first.
      let at = Infinity;
      let under = 0;
      try {
        const s = mastery.state.get(id);
        if (s && Number.isFinite(s.dueTime)) at = s.dueTime;
        under = mastery.standsOn?.get?.(id) ?? 0;
      } catch { at = Infinity; under = 0; }
      const better = deep
        ? (under > bestDepth || (under === bestDepth && at < bestDue))
        : at < bestDue;
      if (best == null || better) { best = id; bestDue = at; bestDepth = under; }
    }
    return best || held[0];
  }

  /**
   * Leave an order. Called by the close beat, once, as the run ends.
   *
   * Refused — quietly, and returning null — when one already stands, or when
   * the cadet holds no line yet. A first session has nothing to re-check and
   * must not be told it has: the whole value of the mark is that it is a claim
   * about knowledge that survived a night, and on day one there is none.
   *
   * @returns {object|null} the order now standing, or null
   */
  function lay() {
    if (rec.order) return null;
    const skill = pickSkill();
    if (!skill) return null;
    rec.order = { skill, day: today(), at: null };
    save();
    return { ...rec.order };
  }

  /** The order standing right now, or null. Never the internal object. */
  function standing() {
    return rec.order ? { ...rec.order } : null;
  }

  /**
   * Is the standing order collectable — i.e. is it a later day than the one it
   * was laid on? This is the whole anti-farm rule and it is one comparison.
   */
  function ripe() {
    return !!rec.order && today() > rec.order.day;
  }

  /** Where the mark stands. Stamped once, by whoever can see the player. */
  function place(x, z, y = null) {
    if (!rec.order || rec.order.at) return false;
    rec.order.at = [Math.round(x * 10) / 10, Math.round(z * 10) / 10, y == null ? null : Math.round(y * 10) / 10];
    save();
    return true;
  }

  /**
   * An answer went through the engine. Settle the order if this was the one.
   *
   * Three conditions, and every one of them is load-bearing:
   *   · it names the line the order names;
   *   · it is CORRECT and UNASSISTED — the same bar the mastery engine uses for
   *     evidence, because an order settled by a scaffolded answer would be the
   *     game accepting help as proof that you knew it without help;
   *   · and it is a later day than the order was laid on.
   *
   * @returns {object|null} what was settled, for whoever wants to say so
   */
  function observed(id, correct, meta = {}) {
    if (!rec.order || rec.order.skill !== id) return null;
    if (!correct || meta.assisted) return null;
    if (!ripe()) return null;
    const nights = Math.max(1, today() - rec.order.day);
    rec.kept += 1;
    rec.order = null;
    rec.day = today();
    save();
    const info = {
      skill: id,
      nights,
      kept: rec.kept,
      pays: ORDER_PAYS,
      // A charter every third one. Reported rather than granted: this file owns
      // the learning fact, `src/kit` owns the licence and the wallet.
      charter: rec.kept % ORDERS_PER_CHARTER === 0,
      toCharter: (ORDERS_PER_CHARTER - (rec.kept % ORDERS_PER_CHARTER)) % ORDERS_PER_CHARTER,
    };
    try { onKept(info); } catch { /* a beat must never break the answer stream */ }
    return info;
  }

  return {
    lay,
    standing,
    ripe,
    place,
    observed,
    /** Orders kept, ever. The count the charter rate is drawn against. */
    kept: () => rec.kept,
    /** How many more kept orders buy the next charter. Never zero. */
    toCharter: () => ORDERS_PER_CHARTER - (rec.kept % ORDERS_PER_CHARTER),
    state: () => ({
      order: standing(),
      ripe: ripe(),
      kept: rec.kept,
      toCharter: ORDERS_PER_CHARTER - (rec.kept % ORDERS_PER_CHARTER),
      pays: ORDER_PAYS,
    }),
    reset() {
      rec.order = null; rec.kept = 0; rec.day = 0;
      try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    },
  };
}
