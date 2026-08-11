import { P } from '../player/locomotion.js';
import { t, onLocaleChange } from '../i18n/index.js';
import { SHARD_COST } from '../build/pieces.js';
import {
  GRANT_LADDER, CHARTER_EVERY, CHARTER_FROM, STATION_PRICE, chartersAt, charterAt,
} from './ladder.js';
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
 *      BEACON      90  this hillside, for ever
 *      WAYSTATION 240  this hillside for ever, and every other one a step away
 *
 * The fourth is what a three-hundred-shard surplus is for. It is deliberately
 * the price of two hanging caches or a very good hour, it needs a charter as
 * well as the money, and there is always another one to save for — which is
 * what stops the wallet becoming a score again the moment the last grant lands.
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
 */
const SOUND_BASE = 1, SOUND_STEP = 1, SOUND_MAX = 12, SOUND_LAND = 30;

export function createKit(opts = {}) {
  const {
    root, mastery, builder, player, input, hud, audio, drift, caches, fx, wallet,
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
  // Charters spent. Charters *earned* is a function of depth and is therefore
  // not stored anywhere: it is re-derived from the learning record every time,
  // which means it cannot drift away from the mathematics that bought it.
  let spent = 0;

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
      const on = held.has(g.id);
      const verb = VERBS[g.id];
      const show = (on && verb) || (!on && next && g.id === next.id);
      b.style.display = show ? '' : 'none';
      if (!show) continue;
      b.classList.toggle('on', on);
      b.querySelector('u').textContent = on ? verb : LOCK;
      b.querySelector('.full').textContent = t(K(g.id, 'name'));
      b.querySelector('.sh').textContent = t(K(g.id, 'short'));
      b.querySelector('em').textContent = on ? costLine(g.id) : t('kit.next');
      b.title = t(K(g.id, 'what'));
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
    if (id === 'vault') return SHARD_COST.vault;
    if (id === 'flare') return held.has('squall') ? PRICE.flareSquall : PRICE.flare;
    if (id === 'beacon') return PRICE.beacon;
    if (id === 'station') return stationPrice();
    return 0;
  }

  /**
   * What the next waystation costs.
   *
   * It goes up. Two hundred and forty, then three hundred and twenty, then four
   * hundred and ten — because a sink that stays still stops being a sink the
   * moment the earn rate passes it, and the whole complaint this answers was a
   * player standing on a three-hundred-shard surplus with nothing left to want.
   * A network is also worth more the bigger it is: the fourth waystation is a
   * route to three places, and it is priced like one.
   */
  function stationPrice() {
    return Math.round(PRICE.station * (1 + 0.35 * stations.length) / 10) * 10;
  }

  /** A chip is a button as well as a readout: touch has no digit row. */
  function use(id) {
    if (!held.has(id)) return;
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
  function pumpToast(dt) {
    toastT = Math.max(0, toastT - dt);
    if (toastT > 0 || !queue.length || isBusy()) return;
    show(queue.shift());
    toastT = 6.2;
  }

  function show(g) {
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
    toast._t = setTimeout(() => toast.classList.remove('show'), 5200);
    audio?.unlocked?.();
    fx?.impact?.('good');
  }

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
          wallet?.earn?.(SOUND_MAX + SOUND_LAND);
          hud?.flash?.(t('kit.soundLanded', { n: SOUND_MAX }), 'good');
          audio?.unlocked?.();
          fx?.impact?.('good');
          sounding = res.sounding;
        } else if (correct && !meta.assisted && rung > 0) {
          wallet?.earn?.(Math.min(SOUND_MAX, SOUND_BASE + SOUND_STEP * (rung - 1)));
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
    if (!held.has('flare') || isBusy()) return false;
    const cost = priceOf('flare');
    if ((wallet?.count?.() ?? 0) < cost) {
      hud?.flash?.(t('kit.needShards', { n: cost }), 'bad');
      return false;
    }
    if (!wallet.spend(cost)) return false;
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
    if (!held.has('beacon') || isBusy()) return false;
    if ((wallet?.count?.() ?? 0) < PRICE.beacon) {
      hud?.flash?.(t('kit.needShards', { n: PRICE.beacon }), 'bad');
      return false;
    }
    if (!wallet.spend(PRICE.beacon)) return false;
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

  /** Charters earned by the whole learning record, minus the ones spent. */
  function charters() { return Math.max(0, chartersAt(Math.max(0, depth)) - spent); }

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
    if (!held.has('station') || isBusy()) return false;
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
    if (!wallet.spend(price)) return false;
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
      const top = q.y + 0.22;
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

  // ------------------------------------------------------------------- frame
  let poll = 0;
  function update(dt) {
    poll -= dt;
    if (poll <= 0) { poll = 0.4; sync(); }
    pumpToast(dt);
    if (!isBusy()) {
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
    beacon: PRICE.beacon,
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
    /** For the harness: light the bought verbs without a keyboard. */
    flare: lightFlare,
    vault: selectVault,
    beacon: plantBeacon,
    /** Raise a waystation, or travel from the one you are standing at. */
    station,
    /** Charters earned and not yet spent — the endgame's only scarce thing. */
    charters,
    /**
     * What the next grant is and what it promises, for the beat that states
     * what this run is *for*. The charter used to print a rep count; a
     * capability you want is not a quota, and this is where it comes from.
     */
    nextGrant() {
      const g = nextGrant();
      if (g) return { id: g.id, name: t(K(g.id, 'name')), what: t(K(g.id, 'what')) };
      // Past the last rung there is still something to want, and the orders
      // card is entitled to say what it is. This is the line that used to read
      // "everything the kit has is already yours".
      return { id: 'charter', name: t('kit.charter.name'), what: t('kit.charter.what') };
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
      sounding = { rung: 0, best: 0, runs: 0 };
      beacons.length = 0;
      stations.length = 0;
      try {
        localStorage.removeItem(BEACON_KEY);
        localStorage.removeItem(STATION_KEY);
        // The old attempt-counted ledger. Nothing reads it any more; it is
        // removed so a save from that build cannot leave a number behind that
        // no longer means anything.
        localStorage.removeItem('ascent.temper');
      } catch { /* private mode */ }
      paint();
    },
  };
}

// i18n-allow: a padlock glyph, not a word — it says the same thing in every locale
const LOCK = '·';
