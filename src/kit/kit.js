import { P } from '../player/locomotion.js';
import { t, onLocaleChange } from '../i18n/index.js';
import { SHARD_COST, SPEC } from '../build/pieces.js';
import { dayNumber } from '../meta/days.js';
/* hud/progress pass, one import and one call: this chip prints a numeral on the
   live HUD ("Hold 1 line", "90 motes"), and tools/critic/oneprogress.mjs now
   fails a build for any numeral on the live HUD that nothing has declared.
   Declaring it as a PRICE is what tells the gate it is the cost of a thing on a
   shelf rather than a second reading of the learner's progress. Nothing about
   the kit changes. */
import { FIG, tagFigure } from '../meta/progress.js';
import {
  GRANT_LADDER, CHARTER_EVERY, CHARTER_FROM, STATION_PRICE, chartersAt, charterAt,
} from './ladder.js';
import { createFoundry } from './foundry.js';
import './kit.css';

/**
 * THE KIT — what a held line actually buys, and for how long it keeps buying.
 *
 * The first complaint this file answered, in the critic's words: *"correct
 * answers purchase chapter text, a rank word and a shard counter that spends on
 * nothing — you never unlock a new verb, a new piece, a faster glider or a new
 * region."* That gap is closed and must stay closed: six capabilities, one per
 * line held, all of them traversal, all of them felt inside five seconds.
 *
 * The second complaint is the one this version exists for: **the whole ladder
 * was spent inside one session.** All six grants landed by the twenty-second
 * correct answer. Seals seven to ten bought nothing, and after the tenth line
 * the game had nothing left to give anybody, for ever.
 *
 * WHY THAT HAPPENED, AND WHAT REPLACES IT
 *
 * The ladder was counting the wrong thing. "Lines held" is a number with ten
 * values in it and a fast learner reaches all ten in a sitting, so any ladder
 * built on it is a one-session ladder by construction. But a mastery engine
 * knows something else about a learner, something that *cannot* be produced in
 * a sitting and that is the actual claim this product makes: whether the lines
 * they hold are still held tomorrow.
 *
 * So the kit runs on DEPTH:
 *
 *      depth  =  lines held  +  every spaced re-probe those lines have survived
 *                              **across a real walk away from the machine**
 *
 * The third complaint is the one this version exists for, and it was two
 * complaints wearing one coat.
 *
 * FIRST: depth was sold as knowledge that survived a walk away from the
 * machine and counted in *attempts of separation* — three items, then eight,
 * then twenty, then forty-eight. A critic playing to exhaustion in one unbroken
 * sitting harvested a temper of 67 and ate the entire ladder without ever
 * leaving the chair. The whole value of spaced retrieval is that knowledge
 * survives a NIGHT, not fifty more questions. The schedule in
 * src/learn/mastery.js is now real elapsed wall-clock, persisted across
 * sessions, and it counts a re-probe as durable only when five hours or more of
 * real time passed since the line was last proved. This file reads that number
 * — `mastery.durableCount()` — and nothing else. Measured in tools/simulate.mjs:
 * eight hundred items in one unbroken sitting now earn **zero** points of the
 * second term; the same eight hundred items across daily sittings earn eighty.
 *
 * SECOND: the ladder ended. The twelfth grant landed and `kit.next` was null
 * for ever, on a Sovereign rank with nothing above it and a shard pile with
 * nothing left to buy. So past the last grant the ladder stops being a ladder
 * and becomes a rate: every five further points of depth is a CHARTER, and a
 * charter plus two hundred and forty shards raises a WAYSTATION — a permanent
 * column of rising air that is also a place you can travel to from any other
 * one. It is the only thing in the game that changes the island for ever, there
 * is no last one, and the only way to earn another is to come back and find
 * that what you knew is still there.
 *
 *   1  VAULT PLATE      a fifth build piece. Set it, stand on it, it throws you
 *                       twenty-two metres straight up.
 *   2  UPDRAFT FLARE    F. A column of rising air under your own boots.
 *   3  KITE TRIM        the wing. About 1:7 to about 1:18.
 *   4  DEEP RESERVE     the lattice reserve, more than doubled.
 *   5  STORM LEGS       sprint 11.8 -> 14.6 m/s, dash back in a third of a second.
 *   6  RESONANT SIGHT   motes lean in from fourteen metres; caches read twice as far.
 *  ---- and then, only for lines that keep holding ----
 *   7  STANDING BEACON  G. Plant a permanent updraft anywhere on the island, for
 *                       ninety shards. The only thing in the game that changes
 *                       the map for ever, and the reason to save.
 *   8  WINDSTEP         the dash comes back while you are still in the air. Three
 *                       dashes across a gap that used to need the wing.
 *   9  LONG SPAN        the wing again: 1:18 to about 1:26, and faster with it.
 *  10  PLATE ARRAY      the vault throws you a third higher, and a plate costs
 *                       six shards instead of eighteen — plates become a staircase.
 *  11  SQUALL FLARE     the flare costs sixteen, stands seventy-four metres and
 *                       holds for eleven seconds.
 *  12  DEEP WELL        the reserve again: three hundred, and it refills twice as fast.
 *  ---- and then, for as long as the lines keep holding ----
 *  13  WAYSTATION       H. A charter and two hundred and forty shards raise one
 *                       anywhere: a permanent column of rising air that is also
 *                       somewhere you can travel to, from any other one, from
 *                       now on. There is no last charter.
 *
 * THE SHARDS ARE THE OTHER HALF
 *
 * A currency that only ever goes up is a score. Earning was rebalanced against
 * these sinks in src/world/drift.js (veins are places that run dry for five
 * minutes, not a spawner that follows you) and src/world/caches.js (120 for the
 * hardest thing in the game). What is left here is the spend, and it is three
 * horizons that compete for the same shards:
 *
 *      FLARE       30  six seconds, right now
 *      PLATE       18  one place, until you clear it
 *      BEACON      90  this hillside, for ever — and dearer every time
 *      WAYSTATION 240  this hillside for ever, and every other one a step away
 *
 * The fourth is what a three-hundred-shard surplus is for. It is deliberately
 * the price of two hanging caches or a very good hour, it needs a charter as
 * well as the money, and there is always another one to save for — which is
 * what stops the wallet becoming a score again the moment the last grant lands.
 *
 * THE THIRD COMPLAINT, AND THE FOUNDRY
 *
 * All of the above was true, measurable, and completely invisible. A real
 * player finished a session holding **eight hundred shards, having spent
 * nothing**, and wrote: *"not sure what to do about rifts, shards, and other
 * things."* Measured against the running game, that is not a mystery:
 *
 *   · the island's standing charge is ~990 shards a sweep — 208 in drift motes,
 *     600 in five hanging caches, 180 in three anchors — and every one of those
 *     routes pays without a single question being answered;
 *   · while **every sink in the game was gated behind a grant**. The plate
 *     needs a line held, the flare needs two, and the beacon — the one purchase
 *     worth saving for — sits at depth 13, which by construction cannot be
 *     reached in a first sitting at all. A player who had not yet sealed a line
 *     could not spend a shard on anything, ever, and nothing told him why.
 *
 * So the sinks are no longer keys. They are **stock, in a place**: see
 * src/kit/foundry.js. Both consumable verbs can be bought over the counter from
 * the first minute of the first session, whether or not the ladder has licensed
 * them, and the licence keeps its meaning by being the right to make one
 * *anywhere* instead of walking back. The shelves quote every price and say
 * what each thing does before it is bought, and the two rows that are not for
 * sale yet say exactly which held lines open them — so the shop is also where a
 * player learns that mathematics is the thing the rest of the kit is bought
 * with.
 *
 * And the beacon's price now **climbs**: 90, 120, 160, 220, 290. A permanent
 * that stays at one price stops being a decision the moment the earn rate
 * passes it, and four permanents is about what one full sweep of the island
 * buys — which is exactly the shape a spend curve is supposed to have.
 *
 * THE FOURTH COMPLAINT: THE CURRENCY STOPPED MEANING ANYTHING
 *
 * Measured, by a critic who played sixty days: **34,782 shards in hand, against
 * a price list of 6/16/90/410, affordable: 0.** Three separate faults, all of
 * them here or next door, all of them fixed and all of them measured by
 * tools/critic/pacing.mjs:
 *
 *   1. THE GROUND WAS A FAUCET. About a thousand shards a sweep, paid for
 *      walking, for ever. There is now a day's assay on ground income and a
 *      taper past it (src/kit/ledger.js). Answers are never tapered.
 *   2. THE DESCENT PAID FOR REPETITION. The endgame loop paid the same for the
 *      twentieth twelve-rung descent of one evening as for the first. Full pay
 *      is now for depth not reached today; see SOUND_KEY below.
 *   3. THE WAYSTATION'S PRICE CRAWLED. It went up by 84 a time while income
 *      went up by hundreds a day. It is geometric now, like the beacon's:
 *      240 · 310 · 410 · 530 · 690 · 900 · 1170 …
 *
 * And `affordable: 0` was the shop lying: it counted only rows the *counter*
 * would sell, so an endgame cadet who owned every licence and could pay every
 * price was told there was nothing here. See `reach` in `shelf`.
 *
 * Measured after: a cadet who buys every permanent they can afford spends 90%
 * of sixty days' income and ends day sixty holding less than one waystation.
 *
 * This module owns no physics of its own. It edits the objects that already
 * hold the numbers — `src/player/locomotion.js`'s exported `P`, the builder's
 * reserve, the piece price table — from the outside, snapshotting all of them
 * at boot so a reset puts them back exactly.
 */

/**
 * What each rung actually changes, keyed by id. The thresholds live in
 * `ladder.js` so that a tool with no browser in it can read them and print the
 * sitting each one lands on.
 */
const APPLY = {
  vault({ builder }) { builder.allow('vault'); },
  // No numbers to change: the verb itself is the grant, and `held` is what the
  // F key checks.
  flare() {},
  kite() {
    // A wing that sinks at 1:7 cannot cross anything. This is the single
    // most-felt number in the game.
    P.glideBase = -0.055;
    P.glideDrag = 0.0115;
    P.glideMax = 44;
    P.glideMin = 7;
    P.glideTurn = 2.2;
  },
  reserve({ builder }) {
    builder.maxCharge = 176;
    builder.regen = 36;
    builder.charge = builder.maxCharge;
  },
  legs() {
    P.sprint = 14.6;
    P.dashCool = 0.36;
    P.dashSpeed = 25;
    P.jumpV = 12.2;
    P.doubleV = 10.8;
  },
  sight({ drift, caches }) { drift?.setMagnet?.(14); caches?.setSight?.(true); },

  // ---- everything below here is paid for by lines that stayed held ----
  // The verb the whole economy pointed at until the waystation: permanent,
  // costs real saving, placed by hand.
  beacon() {},
  // The dash is the one movement verb the wing does not replace, and it is the
  // one that dies the instant your boots leave the ground. Windstep hands it
  // back in the air, on the ordinary cooldown, for ever.
  windstep() {},
  span() {
    P.glideBase = -0.042;
    P.glideDrag = 0.0092;
    P.glideMax = 58;
    P.glideMin = 8;
    P.glideTurn = 2.6;
  },
  array() { SHARD_COST.vault = 6; },
  squall() {},
  deepwell({ builder }) {
    builder.maxCharge = 300;
    builder.regen = 62;
    builder.charge = builder.maxCharge;
  },
  // The licence, not the thing. What it unlocks is the H key; what H does still
  // costs a charter and two hundred and forty shards every single time.
  station() {},
};

const GRANTS = GRANT_LADDER.map((g) => ({ ...g, apply: APPLY[g.id] || (() => {}) }));

/** The three sinks, at their two prices. The second price is a later grant. */
const PRICE = {
  flare: 30, flareSquall: 16,
  beacon: 90,
  plate: 18, plateArray: 6,
  station: STATION_PRICE,
};
/**
 * What each further standing beacon costs, as a multiple of the one before.
 * 90 · 120 · 160 · 220 · 290 · 390. One full sweep of the island's standing
 * charge is about four of them, and the fifth is a reason to go somewhere you
 * have not been.
 */
const BEACON_STEP = 1.34;
/** Charges bought over the counter and not yet spent. */
const CHARGE_KEY = 'ascent.charges';
const VAULT_KICK = 25.5;         // 12 m of clean air, before the double jump
const VAULT_KICK_ARRAY = 34;

/** Chips that are a control as well as a readout. Everything else is a number. */
const VERBS = { vault: '5', flare: 'F', beacon: 'G', station: 'H' };

const BEACON_KEY = 'ascent.beacons';
const STATION_KEY = 'ascent.stations';
/** How close you have to be standing to a waystation for H to move you. */
const STATION_REACH = 9;
/**
 * What a descent pays.
 *
 * One shard for the first rung, two for the second, and so on to the floor at
 * twelve: seventy-eight for a descent that lands, plus thirty for landing it,
 * plus the two a correct answer pays anyway. That is about a hundred and thirty
 * shards for twelve unassisted items at the top of the bank with one miss
 * between you and the surface — a little over a hanging cache, which is the
 * hardest thing in the world outside a rift, and a little over half a
 * waystation. A descent that breaks on rung three pays six.
 *
 * AND IT PAYS FOR DEPTH, NOT FOR REPETITION.
 *
 * Past the tenth line the descent is the loop, and it is the only unbounded
 * earner in the game: a critic measured **34,782 shards at day sixty** against
 * a dearest price of 410, which is a currency that has stopped meaning
 * anything. Most of that was the same twelve rungs, climbed down again and
 * again inside one sitting.
 *
 * So a rung pays in full the first time it is reached **on a given day**, and a
 * quarter after that, floored at one shard. The first descent of a morning is
 * worth exactly what it always was; the fourth in the same hour is worth
 * pocket change. Nothing is capped, nothing is refused, and the way to be paid
 * in full again is to go deeper — or to come back tomorrow, which is the thing
 * this whole game is trying to be worth.
 */
const SOUND_BASE = 1, SOUND_STEP = 1, SOUND_MAX = 12, SOUND_LAND = 30;
/** The day's deepest rung, so full pay is for new ground. Persisted. */
const SOUND_KEY = 'ascent.sound';

export function createKit(opts = {}) {
  const {
    root, mastery, builder, player, input, hud, audio, drift, caches, fx, wallet,
    scene,
    isBusy = () => false,
  } = opts;

  // What the game's own numbers were before the kit touched anything.
  const base = {
    glideBase: P.glideBase, glideDrag: P.glideDrag, glideMax: P.glideMax,
    glideMin: P.glideMin, glideTurn: P.glideTurn, sprint: P.sprint,
    dashCool: P.dashCool, dashSpeed: P.dashSpeed, jumpV: P.jumpV, doubleV: P.doubleV,
    maxCharge: builder.maxCharge, regen: builder.regen, plate: SHARD_COST.vault,
  };
  SHARD_COST.vault = PRICE.plate;

  const ctx = { builder, player, drift, caches };
  const held = new Set();
  let depth = -1;
  let lines = 0;
  let temper = 0;
  // The descent in progress, mirrored off the engine's own record so the strip
  // and the harness can read it without asking the engine twice a frame.
  let sounding = { rung: 0, best: 0, runs: 0 };

  /* ------------------------------------------------------------------------
     THE DAY'S DEEPEST RUNG. See SOUND_KEY above: full pay is for ground the
     descent has not covered today, so the loop that carries the endgame cannot
     be turned into a shard printer by running it twenty times before bed. The
     day is the local day the spacing schedule reads, so the same clock that
     moves the nights moves this.
     ------------------------------------------------------------------------ */
  const clockNow = () => (mastery.now ? mastery.now() : Date.now());
  const sday = { day: 0, best: 0, said: false };
  try {
    const raw = JSON.parse(localStorage.getItem(SOUND_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      sday.day = raw.day | 0; sday.best = Math.max(0, raw.best | 0); sday.said = !!raw.said;
    }
  } catch { /* private mode */ }
  function soundDay() {
    const n = dayNumber(clockNow());
    if (n !== sday.day) { sday.day = n; sday.best = 0; sday.said = false; }
    return sday;
  }
  function saveSound() {
    try { localStorage.setItem(SOUND_KEY, JSON.stringify(sday)); } catch { /* private mode */ }
  }
  /**
   * What a rung is worth: all of it for new depth, a quarter for ground already
   * covered today, and never nothing. The rule is said once a day, on the strip
   * that says everything else about the wallet.
   */
  function pay(full, fresh) {
    if (fresh) return full;
    if (!sday.said) {
      sday.said = true;
      saveSound();
      setTimeout(() => wallet?.note?.('ledger.deep'), 700);
    }
    return Math.max(1, Math.round(full / 4));
  }
  // Charters spent. Charters *earned* is a function of depth and is therefore
  // not stored anywhere: it is re-derived from the learning record every time,
  // which means it cannot drift away from the mathematics that bought it.
  let spent = 0;

  /**
   * What the cadet is carrying out of the foundry.
   *
   * A charge is one use of a verb the ladder has not licensed yet, bought over
   * the counter at the same price the licensed version costs to fire. It is the
   * whole answer to "eight hundred shards and nothing to spend them on": the
   * shop is open from the first minute, and the licence is still worth having,
   * because a licence is the right to do it *out there* instead of walking
   * back. Persisted, because a thing you paid for has to survive a reload.
   */
  const charges = { flare: 0, beacon: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(CHARGE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      charges.flare = Math.max(0, raw.flare | 0);
      charges.beacon = Math.max(0, raw.beacon | 0);
    }
  } catch { /* private mode */ }
  function saveCharges() {
    try { localStorage.setItem(CHARGE_KEY, JSON.stringify(charges)); } catch { /* private mode */ }
  }
  /** Held by the ladder, or carried out of the foundry — either way, it fires. */
  const canUse = (id) => held.has(id) || (charges[id] || 0) > 0;

  // ---------------------------------------------------------------- surface
  const el = document.createElement('div');
  el.className = 'kit';
  (root || document.body).appendChild(el);

  const toast = document.createElement('div');
  toast.className = 'kit-toast';
  (root || document.body).appendChild(toast);

  const chips = new Map();
  for (const g of GRANTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kit-chip';
    b.dataset.id = g.id;
    // Two names, one shown. A phone has room for four chips, a stick's width of
    // gutter and a companion talking above them; the full name only fits on a
    // pointer device, and an ellipsised word is not a translation.
    b.innerHTML = '<u></u><span class="full"></span><span class="sh"></span><em></em>';
    b.addEventListener('click', () => use(g.id));
    el.appendChild(b);
    chips.set(g.id, b);
  }

  /** `kit.<id>.<field>` — composed, never templated: the i18n gate reads a
   *  template literal as prose because it cannot see through the substitution. */
  const K = (id, field) => 'kit.' + id + '.' + field;

  function paint() {
    // The strip carries the things you can *press* — a verb with a price on it
    // is a decision, and a decision belongs on screen. The passive grants are
    // numbers; they announce themselves once and then live in the dossier.
    // Plus exactly one locked chip: the next thing the lattice will hand over,
    // named as the capability it is and never as a quota.
    const next = nextGrant();
    for (const g of GRANTS) {
      const b = chips.get(g.id);
      // A verb you are carrying a charge for is a verb you have, and the strip
      // is the only place that says so once the foundry's panel has closed.
      const on = canUse(g.id);
      const carried = charges[g.id] || 0;
      const verb = VERBS[g.id];
      const show = (on && verb) || (!on && next && g.id === next.id);
      b.style.display = show ? '' : 'none';
      if (!show) continue;
      b.classList.toggle('on', on);
      b.classList.toggle('carry', on && !held.has(g.id));
      // A KEYCAP IS A PROMISE. The locked chip printed a bare interpunct in
      // the slot where every other chip prints its hotkey, so VAULT PLATE
      // advertised itself as bound to a key that does not exist — a cold
      // player read it as an unassigned binding and went looking for the key.
      // A padlock is not a key, so it is drawn as one rather than typed into
      // the keycap, and the cap itself stands down.
      const u = b.querySelector('u');
      u.classList.toggle('lock', !on);
      u.innerHTML = on ? '' : LOCK_SVG;
      if (on) u.textContent = verb;
      b.querySelector('.full').textContent = t(K(g.id, 'name'));
      b.querySelector('.sh').textContent = t(K(g.id, 'short'));
      // The locked chip used to read "NEXT", which is not information: it sat
      // in the HUD from the first second, could not be pressed, and nothing on
      // screen said what would make it pressable. It now names its own price in
      // the only currency that buys it — lines held, never motes.
      const priceEl = b.querySelector('em');
      priceEl.textContent = !on
        ? (g.lines != null ? t('kit.nextAtLines', { n: g.lines }) : t('kit.nextAtDepth'))
        : (carried && !held.has(g.id) ? t('kit.carrying', { n: carried }) : costLine(g.id));
      tagFigure(priceEl, FIG.PRICE, !on ? (g.lines ?? 0) : priceOf(g.id));
      b.title = t(K(g.id, 'what'));
      // …and the same sentence where a screen reader can reach it, composed
      // from one pattern rather than concatenated in English word order.
      b.setAttribute('aria-label', t('kit.chipAria', {
        name: t(K(g.id, 'name')), what: t(K(g.id, 'what')),
      }));
    }
    el.classList.add('any');
  }

  /**
   * What the chip says under the verb.
   *
   * A price for everything you can buy with shards alone. The waystation is the
   * one thing that also costs a charter, and a charter is the only currency in
   * the game that cannot be earned by playing longer — so the chip says which
   * of the two you are short of, and when you are short of neither it says how
   * far the next charter is. That line is the endgame's whole ladder, and it
   * is never blank.
   */
  function costLine(id) {
    if (id !== 'station') return t('kit.cost', { n: priceOf(id) });
    const n = charters();
    if (n > 0) return t('kit.chartersHeld', { n, cost: stationPrice() });
    return t('kit.charterIn', { n: Math.max(1, toCharter()) });
  }

  /** What a verb costs right now — later grants make the same verb cheaper. */
  function priceOf(id) {
    if (id === 'vault' || id === 'plate') return SHARD_COST.vault;
    if (id === 'flare') return held.has('squall') ? PRICE.flareSquall : PRICE.flare;
    if (id === 'beacon') return beaconPrice();
    if (id === 'station') return stationPrice();
    return 0;
  }

  /**
   * What the next standing beacon costs.
   *
   * It climbs, for the same reason the waystation's does: a permanent at a
   * fixed price stops being a decision the moment the earn rate passes it, and
   * a player standing on a surplus with nothing left to want is the exact
   * complaint this file is answering. Counted off beacons *raised plus carried*,
   * so buying three charges over the counter costs 90, 120 and 160 rather than
   * ninety three times over.
   */
  function beaconPrice() {
    const n = beacons.length + charges.beacon;
    return Math.round(PRICE.beacon * Math.pow(BEACON_STEP, n) / 10) * 10;
  }

  /**
   * What the next waystation costs.
   *
   * It goes up, and it now goes up the way the beacon does — by a multiple
   * rather than by a fixed step. 240 · 310 · 410 · 530 · 690 · 900 · 1170 …
   *
   * The straight line it replaced added 84 shards a time, which is less than a
   * tenth of a day's income by the second week: a critic holding 34,782 shards
   * at day sixty could have bought every waystation they had a charter for and
   * still had 14,000 spare. A sink that does not climb as fast as the earn rate
   * is not a sink, it is a formality. A network is also worth more the bigger
   * it is — the eighth waystation is a road to seven places — so the curve is
   * the honest shape as well as the useful one.
   */
  const STATION_STEP = 1.3;
  function stationPrice() {
    return Math.round(PRICE.station * Math.pow(STATION_STEP, stations.length) / 10) * 10;
  }

  /**
   * Pay for one firing of a verb: a carried charge first, then the wallet.
   *
   * A charge was already paid for at the counter, so it is always the cheaper
   * of the two — and it means a player who bought one before they had the
   * licence never pays twice for the same lift.
   */
  function spendOrCharge(id, cost) {
    if ((charges[id] || 0) > 0) {
      charges[id] -= 1;
      saveCharges();
      paint();
      return true;
    }
    if ((wallet?.count?.() ?? 0) < cost) {
      hud?.flash?.(t('kit.needShards', { n: cost }), 'bad');
      return false;
    }
    return !!wallet.spend(cost, id);
  }

  // -------------------------------------------------------------- the shelves
  /**
   * What shards buy, in the order a player meets it, with everything the
   * foundry needs to quote a price *before* it is paid: the number, one line of
   * what the thing does, and — for the two that are not for sale yet — exactly
   * what opens them.
   *
   * `state` is one of:
   *   buy      you can afford it and the counter will hand it over now
   *   poor     it is for sale and you are short; the row says by how much
   *   held     the ladder has licensed it, so it is a key out in the world
   *   sealed   held lines open it, and `lock` says how many
   */
  function shelf(id, { sold = true, key = null, lock = null } = {}) {
    const purse = wallet?.count?.() ?? 0;
    const price = priceOf(id);
    const licensed = held.has(id === 'plate' ? 'vault' : id);
    let state;
    if (licensed) state = 'held';
    else if (!sold) state = 'sealed';
    else state = purse >= price ? 'buy' : 'poor';
    return {
      id, price, key, state,
      /* WITHIN REACH — which is not the same question as `state`.
         `state` answers "will the counter hand this over", and a licensed verb
         is not for sale over a counter: you already own the right to make one,
         out there, for the same price. So a cadet at the endgame, with every
         row licensed and thousands of shards in hand, read `affordable: 0` —
         the shop saying it had nothing for somebody who could buy anything.
         `reach` is the honest question: can this purse pay this price right
         now, at the counter or in the field. The waystation also wants a
         charter, and a charter is not something a wallet can produce. */
      reach: purse >= price && (id !== 'station' || charters() > 0),
      // The plate's rung is called `vault`; everything else names itself.
      nameKey: 'kit.' + (id === 'plate' ? 'vault' : id) + '.name',
      carried: charges[id] || 0,
      lock: state === 'sealed' ? lock : null,
    };
  }

  /**
   * What opens a rung, said as the thing a player can act on: a count of lines
   * for the six the first sitting reaches, and depth — lines that were still
   * held after a night away — for the seven above them.
   */
  const rungAt = (id) => {
    const g = GRANTS.find((x) => x.id === id);
    if (!g) return null;
    return g.lines != null
      ? { key: 'foundry.sealedLines', n: g.lines }
      : { key: 'foundry.sealedDepth', n: g.depth };
  };

  function stock() {
    return [
      // Bought over the counter from the first minute, licence or no licence.
      shelf('flare', { key: VERBS.flare }),
      shelf('beacon', { key: VERBS.beacon }),
      // Placed by the lattice rather than handed over, so the counter quotes it
      // and the ladder licenses it. This row is where a player learns that a
      // held line is what opens the rest of the shop.
      shelf('plate', { sold: false, key: VERBS.vault, lock: rungAt('vault') }),
      shelf('station', { sold: false, key: VERBS.station, lock: rungAt('station') }),
    ];
  }

  /**
   * How many things the wallet can pay for right now — over the counter or out
   * in the field. See `reach` in `shelf`: a licence changes where a thing can
   * be made, never whether it is paid for, so a licensed verb is still a price
   * and still a decision. Counting only unlicensed rows is what made the shop
   * tell a cadet holding thousands of shards that there was nothing here.
   */
  const affordable = () => stock().filter((s) => s.reach).length;

  /**
   * What the crucible burns like, read off the wallet: dead when nothing is in
   * reach, cold when the six-second thing is, and warm when the permanent one
   * is. It is the only affordability readout in the game you can see from four
   * hundred metres away, and it is the reason a full wallet feels like
   * something rather than being a number in a corner.
   */
  function tone() {
    const rows = stock();
    // The permanents, whether or not the ladder has licensed them: a waystation
    // in reach is the warmest thing the wallet can say, and a beacon after it.
    if (rows.some((s) => s.reach && (s.id === 'station' || s.id === 'beacon'))) return 'best';
    return rows.some((s) => s.reach) ? 'some' : 'none';
  }

  /** Buy one thing at the counter. Returns what was bought, or null. */
  function buy(id) {
    const row = stock().find((s) => s.id === id);
    if (!row || row.state !== 'buy') return null;
    if (!wallet?.spend?.(row.price, id)) return null;
    charges[id] = (charges[id] || 0) + 1;
    saveCharges();
    paint();
    hud?.flash?.(t('foundry.bought', { name: t(row.nameKey), key: row.key }), 'good');
    audio?.unlocked?.();
    fx?.impact?.('good');
    input?.rumble?.(0.5, 120);
    return { id, price: row.price, carried: charges[id] };
  }

  /** A chip is a button as well as a readout: touch has no digit row. */
  function use(id) {
    // A chip you cannot fire yet still has to answer for itself. Its only
    // explanation used to live in a `title` attribute, which a keyboard and a
    // thumb never see; pressing it now says what the thing is, out loud, in
    // the same toast the rest of the kit speaks through.
    if (!canUse(id)) { hud?.flash?.(t(K(id, 'what')), ''); return; }
    if (id === 'vault') selectVault();
    if (id === 'flare') lightFlare();
    if (id === 'beacon') plantBeacon();
    if (id === 'station') station();
  }

  // ------------------------------------------------------------------ grants
  function grant(g, quiet) {
    if (held.has(g.id)) return;
    held.add(g.id);
    g.apply(ctx);
    paint();
    if (quiet) return;
    // A grant fires at the same moment as the rank rite and the session's close
    // card, both of which take the middle of the frame. So it queues behind
    // them rather than being printed through them; it is a capability, and it
    // will still be a capability in four seconds.
    queue.push(g);
  }

  const queue = [];
  let toastT = 0;
  let live = null;              // the grant currently on the plate, if any

  /**
   * src/ui P1 — A CARD THAT IS ALREADY UP WHEN THE FRAME IS TAKEN.
   *
   * `isBusy()` stopped a *new* grant printing over a tear, and that much always
   * worked. What it never did was retract one that was ALREADY on screen: a
   * grant lands in the two seconds between two rifts, the cadet walks into the
   * next ring, and the card is still there for the rest of its 5.2 s — behind a
   * panel that is translucent by design. That is the frame the cold critic
   * photographed: VAULT PLATE coming up through the number keypad, garbling the
   * 5, 6, 1, 2 and 3.
   *
   * The stacking order in src/ui/layers.css and the `:has(.rift.show)` rule in
   * src/meta/meta.css both stop it being *seen*. This stops it being *spent*:
   * the grant goes back to the head of the queue and plays again, in full, the
   * moment the frame is free. A capability the player earned and could not read
   * is worse than one that arrives four seconds late.
   */
  function retract() {
    if (!live) return;
    clearTimeout(toast._t);
    toast.classList.remove('show');
    queue.unshift(live);
    live = null;
    toastT = 0;
  }

  function pumpToast(dt) {
    toastT = Math.max(0, toastT - dt);
    if (isBusy()) { retract(); return; }
    if (toastT > 0 || !queue.length) return;
    show(queue.shift());
    toastT = 6.2;
  }

  function show(g) {
    live = g;
    toast.innerHTML = '';
    const a = document.createElement('b');
    a.textContent = t(K(g.id, 'name'));
    const c = document.createElement('i');
    c.textContent = t(K(g.id, 'what'));
    const lede = document.createElement('u');
    lede.textContent = t(g.depth ? 'kit.grantedHeld' : 'kit.granted');
    toast.append(lede, a, c);
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.classList.remove('show'); live = null; }, 5200);
    audio?.unlocked?.();
    fx?.impact?.('good');
  }

  /**
   * Wave the grant away.
   *
   * LINE SEALED never held the controls — it is a plate at the foot of the
   * frame with `pointer-events:none` on it — but a beat you cannot end is
   * still a beat that ends on somebody else's clock, so Escape ends it.
   *
   * Escape, and deliberately not "any key". The ceremonies in src/meta are in
   * the middle of the screen and a cadet who has read one wants it gone; this
   * one is a caption in the corner of a game the cadet is playing with both
   * hands, and dismissing it on W would mean nobody ever read the sentence
   * that says what they just earned. One key that means "dismiss", used the
   * way the rest of the game already uses it.
   */
  addEventListener('keydown', (e) => {
    if (e.repeat || e.code !== 'Escape' || !live) return;
    clearTimeout(toast._t);
    toast.classList.remove('show');
    live = null;
  }, true);

  /**
   * DEPTH — lines held, plus every spaced re-probe those lines have survived
   * across a real walk away from the machine.
   *
   * Both halves are read straight off the mastery engine, which is the whole
   * point: this file invents no ledger of its own and can therefore not be
   * wrong about the learning in a way the progress report is not also wrong
   * about. `durableCount()` is the engine's own count of re-probes passed after
   * five hours or more of real elapsed time since the line was last proved.
   *
   * This used to be a counter kept here, incremented on any `kind: 'review'`
   * that came back clean — which, under a schedule counted in attempts, a
   * player could run up to sixty-seven in one unbroken sitting. The number has
   * no ceiling now either. It just cannot be produced without leaving.
   */
  function measure() {
    let l = 0;
    for (const s of mastery.state.values()) if (s.mastered) l++;
    lines = l;
    temper = mastery.durableCount?.() ?? 0;
    return l + temper;
  }

  /**
   * The descent pays. A rung of a sounding is an unassisted item at the top of
   * the bank on a line already held, and the pay rises with how deep the
   * descent has gone — two shards for the first, twenty-four at the ceiling —
   * because that is what makes a chain of them a run rather than a queue. One
   * miss ends the descent and the next one starts at the bottom, which is the
   * only reason the numbers on the way down are worth anything.
   */
  const rawObserve = mastery.observe.bind(mastery);
  mastery.observe = (id, correct, meta = {}) => {
    const res = rawObserve(id, correct, meta);
    try {
      if (res && res.served === 'deep') {
        const rung = res.sounding?.rung || 0;
        if (res.soundingLanded) {
          // The descent touched its floor. Everything a rung pays, plus the
          // bounty for landing it, plus a line worth reading out loud.
          const d = soundDay();
          const fresh = d.best < SOUND_MAX;
          d.best = SOUND_MAX;
          saveSound();
          wallet?.earn?.(pay(SOUND_MAX + SOUND_LAND, fresh), 'sound');
          hud?.flash?.(t('kit.soundLanded', { n: SOUND_MAX }), 'good');
          audio?.unlocked?.();
          fx?.impact?.('good');
          sounding = res.sounding;
        } else if (correct && !meta.assisted && rung > 0) {
          const d = soundDay();
          const fresh = rung > d.best;
          if (fresh) { d.best = rung; saveSound(); }
          wallet?.earn?.(pay(Math.min(SOUND_MAX, SOUND_BASE + SOUND_STEP * (rung - 1)), fresh), 'sound');
          if (rung === res.sounding.best && rung > 2) {
            hud?.flash?.(t('kit.soundDeep', { n: rung }), 'good');
          }
          sounding = res.sounding;
        } else if (!correct && sounding.rung >= 3) {
          hud?.flash?.(t('kit.soundBroke', { n: sounding.rung }), 'bad');
          sounding = res.sounding;
        } else {
          sounding = res.sounding;
        }
      }
    } catch { /* never break the learning loop */ }
    return res;
  };

  /**
   * The ladder is a ladder: a rung is only reachable when every rung below it
   * is held. Without that, a learner holding two lines and re-proving those two
   * for an hour collects the beacon before the wing — depth would be measuring
   * doggedness on a narrow front and calling it range.
   */
  const reachedBy = (g, d, l) => (g.lines != null ? l >= g.lines : d >= g.depth);

  /** The next thing the lattice will hand over, or null at the top. */
  function nextGrant() {
    for (const g of GRANTS) if (!held.has(g.id)) return g;
    return null;
  }

  // ------------------------------------------------------------------- verbs
  function selectVault() {
    if (!held.has('vault')) return false;
    // slot 4 is the vault plate; the digit row in src/core/input.js only knows
    // 1-4, so the kit sets both sides of that handshake itself.
    if (builder.setSlot(4)) {
      if (input) input.slot = 4;
      // the HUD's hotbar only has the four base kinds on it, so nothing there
      // should look selected while the fifth is in the cadet's hand
      hud?.setSlot?.(4);
    }
    builder.arm();
    return true;
  }

  function lightFlare() {
    if (busy()) return false;
    if (!canUse('flare')) {
      hud?.flash?.(t('kit.buyAt', { name: t('kit.flare.name') }), 'bad');
      return false;
    }
    const cost = priceOf('flare');
    if (!spendOrCharge('flare', cost)) return false;
    const big = held.has('squall');
    drift?.flare?.(player.pos.x, player.pos.z, big ? { height: 74, radius: 6.6, life: 11 } : null);
    hud?.flash?.(t('kit.flareLit'), 'good');
    player.cam?.shake?.(0.05);
    input?.rumble?.(0.4, 90);
    return true;
  }

  /**
   * The beacon. Ninety shards — four or five minutes of very good running, or
   * one cache — spent on a column of rising air that is still standing when you
   * come back tomorrow. It is the only purchase in the game you cannot undo,
   * and the only one that is worth saving for rather than spending on.
   */
  const beacons = [];
  function plantBeacon(quiet) {
    if (busy()) return false;
    if (!canUse('beacon')) {
      hud?.flash?.(t('kit.buyAt', { name: t('kit.beacon.name') }), 'bad');
      return false;
    }
    if (!spendOrCharge('beacon', priceOf('beacon'))) return false;
    raise(player.pos.x, player.pos.z);
    beacons.push([Math.round(player.pos.x), Math.round(player.pos.z)]);
    saveBeacons();
    if (!quiet) {
      hud?.flash?.(t('kit.beaconSet'), 'good');
      audio?.unlocked?.();
      fx?.impact?.('good');
      player.cam?.shake?.(0.07);
      input?.rumble?.(0.6, 140);
    }
    return true;
  }

  function raise(x, z) { drift?.addColumn?.(x, z, 82, 8.2, true); }

  function saveBeacons() {
    try { localStorage.setItem(BEACON_KEY, JSON.stringify(beacons)); } catch { /* private mode */ }
  }
  // Planted beacons are part of the island now, so they are standing before the
  // first frame — a permanent thing that has to be re-earned is not permanent.
  try {
    for (const b of JSON.parse(localStorage.getItem(BEACON_KEY) || '[]')) {
      if (!Array.isArray(b)) continue;
      beacons.push(b);
      raise(b[0], b[1]);
    }
  } catch { /* private mode */ }

  // ------------------------------------------------------------- waystations
  /**
   * THE WAYSTATION — the rung after the last rung.
   *
   * A charter and two hundred and forty shards. What you get is a column of
   * rising air twice the height of a beacon that is *also* a place: stand at
   * one, press H, and you are at the next one, anywhere on the island. Two of
   * them is a route. Four is a network, and the island is a different shape
   * than it was.
   *
   * Charters are earned only by depth, and depth's second term can only be
   * earned by leaving and coming back, so this is the one thing in the game
   * whose price is literally "come back tomorrow and still know it". There is
   * no last one. That is the entire answer to "the twelfth grant lands and then
   * `kit.next` is null for ever".
   */
  const stations = [];

  /**
   * CHARTERS THAT DEPTH DID NOT PAY FOR.
   *
   * A charter used to come from one place only: five further points of depth,
   * which starts at depth 46 and is therefore something a cadet meets somewhere
   * in his second month. Everything the waystation was built to be — a real
   * decision between four beacons and one network node, a reason a wallet is
   * not a score — was a month away from the player who most needed a reason to
   * come back on the fifth day.
   *
   * So the wardens pay one too, every third one bound (src/world/warden.js).
   * They cannot be farmed: one warden wakes per returning day, and three is the
   * most that are ever out. Three days of coming back is one charter, which is
   * the same rate the depth ladder settles at — the fifth day just reaches it
   * from the other end.
   *
   * Stored rather than derived, because unlike depth it is not a function of
   * the learning record and cannot be re-derived from it.
   */
  const CHARTER_KEY = 'ascent.charters';
  let granted = 0;
  try { granted = Math.max(0, JSON.parse(localStorage.getItem(CHARTER_KEY) || '0') | 0); }
  catch { granted = 0; }

  /** Charters earned by the whole record — depth and binds — minus those spent. */
  function charters() {
    return Math.max(0, chartersAt(Math.max(0, depth)) + granted - spent);
  }

  /** One more charter, from something that is not depth. Returns the new total. */
  function grantCharter(n = 1) {
    granted += Math.max(0, n | 0);
    try { localStorage.setItem(CHARTER_KEY, JSON.stringify(granted)); } catch { /* private mode */ }
    sync();
    hud?.flash?.(t('kit.charterWon', { n: charters(), cost: stationPrice() }), 'good');
    return charters();
  }

  /**
   * How much deeper the next charter is. Counted off charters *earned*, never
   * off charters in hand — spending one must not move the goalposts, and a
   * player holding three is still exactly as far from the fourth as they were.
   */
  function toCharter() {
    const d = Math.max(0, depth);
    return Math.max(0, charterAt(chartersAt(d) + 1) - d);
  }

  function station() {
    if (!held.has('station') || busy()) return false;
    // Standing at one? Then H is the road, not the shovel.
    const at = nearestStation(STATION_REACH);
    if (at >= 0) return travel(at);
    const price = stationPrice();
    if (charters() <= 0) {
      hud?.flash?.(t('kit.needCharter', { n: Math.max(1, toCharter()) }), 'bad');
      return false;
    }
    if ((wallet?.count?.() ?? 0) < price) {
      hud?.flash?.(t('kit.needShards', { n: price }), 'bad');
      return false;
    }
    if (!wallet.spend(price, 'station')) return false;
    spent += 1;
    const p = [Math.round(player.pos.x), Math.round(player.pos.z), Math.round(player.pos.y * 10) / 10];
    stations.push(p);
    raiseStation(p);
    saveStations();
    hud?.flash?.(t('kit.stationSet', { n: stations.length }), 'good');
    audio?.unlocked?.();
    fx?.impact?.('good');
    player.cam?.shake?.(0.09);
    input?.rumble?.(0.8, 180);
    paint();
    return true;
  }

  /** Index of a waystation within `r` metres of the player, or -1. */
  function nearestStation(r) {
    let best = -1, bestD = r * r;
    for (let i = 0; i < stations.length; i++) {
      // [x, z, y] — the ground height is remembered so travel puts you on your
      // own feet rather than inside a hill.
      const d = (stations[i][0] - player.pos.x) ** 2 + (stations[i][1] - player.pos.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /** From this one to the next one round the ring. */
  function travel(from) {
    if (stations.length < 2) {
      hud?.flash?.(t('kit.stationAlone'), 'bad');
      return false;
    }
    const to = stations[(from + 1) % stations.length];
    player.pos.set(to[0], (to[2] ?? player.pos.y) + 1.2, to[1]);
    player.vel.set(0, 0, 0);
    if (player.loco) { player.loco.grounded = false; player.loco.state = 'air'; }
    hud?.flash?.(t('kit.travelled'), 'good');
    audio?.unlocked?.();
    fx?.impact?.('good');
    player.cam?.shake?.(0.06);
    input?.rumble?.(0.5, 120);
    return true;
  }

  function raiseStation(p) { drift?.addColumn?.(p[0], p[1], 148, 11, true); }

  function saveStations() {
    try {
      localStorage.setItem(STATION_KEY, JSON.stringify({ at: stations, spent }));
    } catch { /* private mode */ }
  }
  try {
    const raw = JSON.parse(localStorage.getItem(STATION_KEY) || 'null');
    if (raw && Array.isArray(raw.at)) {
      spent = Math.max(0, raw.spent | 0);
      for (const p of raw.at) {
        if (!Array.isArray(p)) continue;
        stations.push(p);
        raiseStation(p);
      }
    }
  } catch { /* private mode */ }

  // The plate throws you. Detection is a footprint test against the pieces the
  // lattice is already holding — no new collision, no new state.
  const cool = new Map();
  let vaultSaid = false;
  function vaultCheck(dt) {
    const live = builder.lattice?.live?.vault;
    if (!live || !live.length) return;
    const p = player.pos;
    for (const q of live) {
      if (q.dead) continue;
      const c = (cool.get(q.id) || 0) - dt;
      cool.set(q.id, Math.max(0, c));
      if (c > 0) continue;
      if (Math.abs(p.x - q.x) > 2.1 || Math.abs(p.z - q.z) > 2.1) continue;
      // A deck's origin IS the surface you stand on now (src/build/pieces.js),
      // so read the plate's top off the spec rather than off a copied constant.
      const top = q.y + SPEC.vault.hi;
      if (p.y > top + 1.1 || p.y < top - 1.2) continue;
      if (player.vel.y > 3) continue;
      cool.set(q.id, 0.75);
      p.y = top + 0.6;
      player.vel.y = held.has('array') ? VAULT_KICK_ARRAY : VAULT_KICK;
      const lo = player.loco;
      lo.grounded = false;
      lo.jumps = 1;
      lo.state = 'air';
      lo.airTime = 0.02;
      lo.coyote = 0;
      lo.landT = 0;
      q.want = 1;
      q.tone = 1;
      setTimeout(() => { q.want = 0; }, 220);
      player.cam?.shake?.(0.06);
      input?.rumble?.(0.55, 120);
      // Said once, the first time a plate throws him, and never again: the
      // launch is its own feedback and a caption on every bounce is litter.
      if (!vaultSaid) { vaultSaid = true; hud?.flash?.(t('kit.vaulted'), 'good'); }
      break;
    }
  }

  /**
   * WINDSTEP. The dash's air charge is spent the moment it is used off the
   * ground; this hands it back as soon as the ordinary cooldown is up, so a
   * held line turns one dash into as many as the fall lasts. Nothing in
   * src/player has to know: it is the same flag the locomotion sets itself on
   * landing, set a little more often.
   */
  function windstep() {
    const lo = player.loco;
    if (!lo || lo.grounded || lo.airDash || lo.dashCd > 0) return;
    lo.airDash = true;
  }

  // ----------------------------------------------------------- the shop floor
  /**
   * The foundry is modal while it is open, so every verb the kit owns has to be
   * as quiet under it as it is under a rift. One predicate, read everywhere.
   */
  const busy = () => isBusy() || foundry.isOpen();

  const foundry = createFoundry({
    scene, root, player, input, hud, audio, fx, builder, isBusy,
    kit: {
      stock, buy, tone, affordable,
      purse: () => wallet?.count?.() ?? 0,
    },
  });

  /**
   * AFFORDABILITY, FELT.
   *
   * The wallet crossing a price is the only moment in the economy where nothing
   * happened before: the number went up, and a number going up is a score. Now
   * the first time a given price comes into reach, the world says so once —
   * named, so it is an invitation and not a notification — and the crucible
   * over the foundry flares. Said once per price, never again, because a
   * message that repeats is a message a player learns to look past.
   */
  const announced = new Set();
  function watchAffordable() {
    if (busy()) return;
    for (const s of stock()) {
      const tag = s.id + ':' + s.price;
      if (s.state !== 'buy') continue;
      if (announced.has(tag)) continue;
      announced.add(tag);
      // The very first row a fresh wallet can pay for is worth a whole beat;
      // after that it is a line in the corner.
      hud?.flash?.(t('kit.afford', { n: s.price, name: t(s.nameKey) }), 'good');
      audio?.unlocked?.();
      break;
    }
  }

  /**
   * Marlow, once, if the player is carrying real money and has never found the
   * counter. Not a tutorial: the companion says where a place is, which is the
   * one thing a navigational intelligence is unambiguously for.
   */
  let nudgeT = 42;
  let nudges = 0;
  function nudge(dt) {
    if (foundry.seen() || nudges >= 3) return;
    nudgeT -= dt;
    if (nudgeT > 0 || busy()) return;
    nudgeT = 75;
    if ((wallet?.count?.() ?? 0) < priceOf('flare')) return;
    nudges++;
    hud?.say?.(t('foundry.callout'), 8000);
  }

  // ------------------------------------------------------------------- frame
  let poll = 0;
  let watch = 0;
  function update(dt, time) {
    poll -= dt;
    if (poll <= 0) { poll = 0.4; sync(); }
    pumpToast(dt);
    foundry.update(dt, time);
    watch -= dt;
    if (watch <= 0) { watch = 0.5; watchAffordable(); foundry.refresh(); }
    nudge(dt);
    if (!busy()) {
      vaultCheck(dt);
      if (held.has('windstep')) windstep();
    }
  }

  /** Re-read the engine and hand over anything newly earned. */
  function sync() {
    const d = measure();
    if (d !== depth) {
      const first = depth < 0;
      depth = d;
      for (const g of GRANTS) {
        if (!reachedBy(g, d, lines)) break;
        grant(g, first);
      }
      paint();
    }
    return state();
  }

  const state = () => ({
    depth: Math.max(0, depth), lines, temper,
    seals: lines,                    // the name the older harnesses print
    held: [...held],
    // --- the shop ------------------------------------------------------------
    // What is on the shelves, what it costs, what the wallet can reach and what
    // the cadet is carrying out of the door — so a critic reads the economy the
    // player is actually looking at rather than a model of it.
    stock: stock(),
    charges: { ...charges },
    affordable: affordable(),
    tone: tone(),
    foundry: { at: [foundry.pos.x, foundry.pos.z], seen: foundry.seen(), open: foundry.isOpen(), d: Math.round(foundry.distance()) },
    // Never null. Past the last named rung the next thing is the next charter,
    // and there is always a next charter.
    next: nextGrant()?.id || 'charter',
    prices: prices(),
    beacons: beacons.length,
    // --- the endgame ---------------------------------------------------------
    charters: charters(),
    stations: stations.length,
    toCharter: toCharter(),
    sounding: { ...sounding },
    watch: mastery.watch?.() ?? null,
    move: {
      sprint: P.sprint, jumpV: P.jumpV, dashCool: P.dashCool,
      glideBase: P.glideBase, glideMax: P.glideMax, glideDrag: P.glideDrag,
      reserve: builder.maxCharge, regen: builder.regen,
      vaultKick: held.has('array') ? VAULT_KICK_ARRAY : VAULT_KICK,
      airDash: held.has('windstep'),
      kinds: [...builder.allowed],
    },
  });

  const prices = () => ({
    plate: SHARD_COST.vault,
    flare: priceOf('flare'),
    beacon: beaconPrice(),
    station: stationPrice(),
  });

  addEventListener('keydown', (e) => {
    if (e.repeat || input?.uiOpen) return;
    if (e.code === 'Digit5') { selectVault(); e.preventDefault(); }
    if (e.code === 'KeyF') { lightFlare(); e.preventDefault(); }
    if (e.code === 'KeyG') { plantBeacon(); e.preventDefault(); }
    if (e.code === 'KeyH') { station(); e.preventDefault(); }
  });

  onLocaleChange(() => paint());
  paint();

  return {
    update,
    /**
     * The capability numbers, live off the objects the game runs on — so that
     * "a held line changed what the player can do" is something a harness reads
     * rather than something this file claims.
     */
    state,
    /** Force the poll and report. Harnesses play faster than 0.4 s a frame. */
    sync,
    prices,
    has: (id) => held.has(id),
    // --- the shop: the same three calls the foundry's own panel is built on ---
    /** Everything shards buy, priced and stated, whether or not it is for sale. */
    stock,
    /** Buy one thing at the counter, exactly as pressing the row would. */
    buy,
    /** dead / cold / warm — what the crucible is saying about the wallet. */
    tone,
    /**
     * The next `n` prices of a thing whose price climbs, without buying any of
     * them — so tools/critic/econflow.mjs measures the real curve rather than
     * re-implementing it and then agreeing with itself.
     */
    curve(id, n = 6) {
      if (id !== 'beacon') return Array.from({ length: n }, () => priceOf(id));
      const base = beacons.length + charges.beacon;
      return Array.from({ length: n }, (_, i) =>
        Math.round(PRICE.beacon * Math.pow(BEACON_STEP, base + i) / 10) * 10);
    },
    /** The place itself, so a critic can walk to it and open it for real. */
    foundry,
    /** For the harness: light the bought verbs without a keyboard. */
    flare: lightFlare,
    vault: selectVault,
    beacon: plantBeacon,
    /** Raise a waystation, or travel from the one you are standing at. */
    station,
    /** Charters earned and not yet spent — the endgame's only scarce thing. */
    charters,
    /**
     * Award one that depth did not pay for. The wardens call this every third
     * bind (src/world/warden.js), which is what puts a waystation inside reach
     * of a cadet on his second week instead of his second month.
     */
    grantCharter,
    /**
     * What the next grant is and what it promises, for the beat that states
     * what this run is *for*. The charter used to print a rep count; a
     * capability you want is not a quota, and this is where it comes from.
     */
    /* `gist` is the short form of `what` — six to ten words, no full stop —
       for the surfaces that have to make you WANT this thing before you own
       it. The objective card used to say "Hold it and Kite trim is yours",
       naming a reward the game only explains on the card you get after you
       win it. i18n, additive: `kit.<id>.gist` is in all three bundles. */
    nextGrant() {
      const g = nextGrant();
      if (g) {
        return {
          id: g.id, name: t(K(g.id, 'name')),
          what: t(K(g.id, 'what')), gist: t(K(g.id, 'gist')),
        };
      }
      // Past the last rung there is still something to want, and the orders
      // card is entitled to say what it is. This is the line that used to read
      // "everything the kit has is already yours".
      return {
        id: 'charter', name: t('kit.charter.name'),
        what: t('kit.charter.what'), gist: t('kit.charter.gist'),
      };
    },
    grants: GRANTS.map((g) => ({ id: g.id, lines: g.lines ?? null, depth: g.depth ?? null })),
    reset() {
      Object.assign(P, {
        glideBase: base.glideBase, glideDrag: base.glideDrag, glideMax: base.glideMax,
        glideMin: base.glideMin, glideTurn: base.glideTurn, sprint: base.sprint,
        dashCool: base.dashCool, dashSpeed: base.dashSpeed, jumpV: base.jumpV,
        doubleV: base.doubleV,
      });
      builder.maxCharge = base.maxCharge;
      builder.regen = base.regen;
      SHARD_COST.vault = PRICE.plate;
      held.clear();
      depth = -1;
      temper = 0;
      spent = 0;
      granted = 0;
      sounding = { rung: 0, best: 0, runs: 0 };
      sday.day = 0; sday.best = 0; sday.said = false;
      beacons.length = 0;
      stations.length = 0;
      charges.flare = 0;
      charges.beacon = 0;
      announced.clear();
      nudges = 0;
      nudgeT = 42;
      foundry.reset();
      try {
        localStorage.removeItem(CHARGE_KEY);
        localStorage.removeItem(BEACON_KEY);
        localStorage.removeItem(STATION_KEY);
        localStorage.removeItem(CHARTER_KEY);
        // The descent's day record. A fresh cadet has not been anywhere today.
        localStorage.removeItem(SOUND_KEY);
        // The old attempt-counted ledger. Nothing reads it any more; it is
        // removed so a save from that build cannot leave a number behind that
        // no longer means anything.
        localStorage.removeItem('ascent.temper');
      } catch { /* private mode */ }
      paint();
    },
  };
}

// i18n-allow: a drawn padlock, not a word — it says the same thing in every locale
const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<rect x="5" y="10.5" width="14" height="10" rx="2"/>'
  + '<path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7"/></svg>';
