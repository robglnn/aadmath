import { t } from '../i18n/index.js';
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
 * reach it. Two motes earned reads `+2 · Cipher vein · 6 left`. Nine lost reads
 * `−9 · Rift surge · 31 left`. There is no state of this game in which the
 * number moves and the player is not told which way, by how much, and why.
 *
 * Everything downstream — the builder, the kit, the drift field, the caches —
 * keeps the exact surface it had (`count/earn/spend/take`), so this is a
 * replacement for the wallet object rather than a new dependency for anybody.
 */

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
 */
export function createLedger({ root, initial = 0, onChange = () => {} }) {
  let count = clean(initial);
  /** The last movements, newest first — evidence, for the foundry and for tools. */
  const log = [];

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
    row.querySelector('.led-why').textContent = reason(why);
    row.querySelector('.led-left').textContent = t('ledger.left', { n: count });
    strip.appendChild(row);
    while (strip.children.length > MAX_LINES) strip.firstChild.remove();
    // Two frames, then the entrance transition — a row appended and animated in
    // the same tick does not animate at all in Chromium.
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('in')));
    setTimeout(() => {
      row.classList.remove('in');
      setTimeout(() => row.remove(), 420);
    }, LINE_MS);
    log.unshift({ delta, why, at: Date.now(), left: count });
    if (log.length > 24) log.pop();
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
    setTimeout(() => { row.classList.remove('in'); setTimeout(() => row.remove(), 420); }, LINE_MS);
    log.unshift({ delta: 0, why, at: Date.now(), left: count });
  }

  return {
    count: () => count,

    /** Motes into the wallet. `why` names the source on the strip. */
    earn(n, why = 'found') {
      const got = clean(n);
      if (!got) return 0;
      count += got;
      announce(got, why, 'up');
      onChange();
      return got;
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

    /** A fresh cadet. Used by `__ascent.reset()` and by the harness. */
    reset() {
      count = 0;
      log.length = 0;
      strip.innerHTML = '';
      onChange();
    },
  };
}

const clean = (n) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const reason = (why) => {
  const line = t('ledger.why.' + why);
  return line && !line.startsWith('ledger.') ? line : t('ledger.why.found');
};
