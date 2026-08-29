import { t, num } from '../i18n/index.js';
import { resolveObjective } from './objective.js';

/**
 * THE RELAY — the beat that was missing between two pieces of mathematics.
 *
 * The critic's sentence, in full, because every clause of it is a requirement:
 *
 *   "From 01:16 to 11:30 I answered twelve consecutive items inside a modal
 *    card without ever choosing to return to the 3D world — sealing a rift
 *    auto-opens the next card, so there is no beat where I decide what to do."
 *
 * `src/session/stint.js` supplies the first half: three items per arrival, and
 * then the card really closes. That on its own would be a worse game, not a
 * better one. A player handed a world back with no idea what to do in it has
 * been given a pause, not a beat — and this island has already had one report
 * of exactly that ("unsure what to do next"), which is the whole reason
 * `src/meta/guide.js` exists.
 *
 * So this file is the other half: **the world comes back with one destination
 * on it, named, bearing and distance, and it is never the place you are
 * standing.** One, not two — a return card offering a choice between a rift
 * and a landmark is a menu, and a menu is what a player closes.
 *
 * The rule that picks it is a single question: *is the next line the scheduler
 * wants a different tear from the one I just worked?*
 *
 *   YES  Then travelling is the mathematics. The destination is that tear,
 *        which `src/world/afford.js` already stands a gold column over, and
 *        this beat only has to name it and say how far.
 *   NO   Then the scheduler wants more of the line under my feet — which, on a
 *        ten-node lattice, is most of a first session — and sending a cadet
 *        thirty metres away and back is theatre. The destination is a SURVEY
 *        MARK (`src/world/errand.js`): a real place with a real find on it,
 *        which pays, plants a permanent updraft, and leaves the island
 *        different. Go and get something, then come back and seal three more.
 *
 * The first time it ever fires it also says what the rhythm IS, once, in the
 * companion's voice. Nothing in this game is allowed to be a rule the player
 * has to infer from being interrupted.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE GAINED WHEN THE ARRIVAL BECAME REAL
 *
 * `src/session/stint.js` now bounds an arrival — three pieces of work, nine
 * answers, or a hundred and fifty seconds — and hands the world back when one
 * is used up. One thing was added here for it.
 *
 *   THE VENT    A filled arrival makes the tear breathe out. A column of rising
 *               air stands for a few seconds a short way off the plate, on the
 *               bearing of wherever the cadet is being sent, and it is the
 *               reward for the arrival rather than a thing to buy.
 *
 * THE VENT IS WHY THE KIT EXISTS. A critic counted an eighteen-minute sitting
 * that used dash 0, glide 0, updraft 0, build 0 — the mathematics bought
 * UPDRAFT FLARE and KITE TRIM on camera and the run never asked for either
 * again, which makes advancement a card instead of a capability. Height is the
 * one thing the whole kit ladder spends: the wing turns thirty metres of it
 * into two hundred (1:7) or five hundred (1:18, KITE TRIM), the dash extends
 * the glide, STORM LEGS lands it in a sprint, and the flare on F is this same
 * column bought over a counter and planted where you choose. **The tear hands
 * the cadet the verb it granted them, once per arrival, at the exact moment
 * they have somewhere to be.** Nobody is required to step into it; it stands
 * beside the road, not across it.
 */

/** Seconds after the card closes before the world says anything. */
const BEAT = 0.75;
/** Inside this many metres a destination is "here" and the line is not worth it. */
const HERE = 14;
/**
 * THE VENT, in three numbers.
 *
 * `VENT_M` — how far off the plate the column stands. Far enough that it is a
 * thing you step into rather than a thing that happens to you; near enough that
 * it is on the way out. `VENT_H` — the height it will carry a cadet to. Thirty
 * metres is about what a vault plate and a double jump are worth together, so
 * it is inside this game's own vertical scale and a cadet with no wing at all
 * lands safely under it. `VENT_S` — seconds it stands. Long enough to walk into
 * on purpose, short enough that it is a beat and not a fixture: the permanent
 * ones are bought (`src/kit/kit.js`) and earned (`src/world/errand.js`), and
 * this one must not make either of those pointless.
 */
const VENT_M = 11, VENT_H = 30, VENT_R = 6.4, VENT_S = 7.5;

export function createRelay(opts = {}) {
  const {
    mastery, rifts, player, hud, comms, errand = null,
    /**
     * The drift, for the vent — read through the kit so that the one file that
     * owns "what a held line buys" is also the file that says how big the free
     * one is. Optional: with no kit the relay is exactly what it was.
     */
    kit = null,
    isBusy = () => false,
  } = opts;

  let wait = 0;
  let pending = null;
  let firstDone = false;
  /** Seconds, monotonic where the platform has one. */
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  /** Seconds between two answers to the same settled tear. */
  const SAY_EVERY = 6;
  /** The last thing `speak()` named, for a critic to read back. */
  let lastSaid = null;
  /** The tear the last reply was about, and when it was given. */
  let saidFor = null;
  let saidAt = -1e9;

  /**
   * A stint has ended at `riftId`. Decide where the player goes, light it, and
   * queue the line — never speak on the same frame the card died on, because a
   * sentence that lands under a collapsing aperture is a sentence nobody read.
   */
  function returned(riftId, info = null) {
    pending = riftId || null;
    wait = BEAT;
    // The vent goes up on the frame the arrival filled, not after the beat: a
    // reward that arrives three quarters of a second after the thing it is
    // rewarding reads as a coincidence.
    if (info && info.filled) vent(riftId);
  }

  /**
   * THE TEAR BREATHES OUT.
   *
   * Planted on the bearing of wherever this cadet is being sent next, so the
   * column is on the road rather than on the dais — step into it and the walk
   * to the next line starts thirty metres up, which is the one currency the
   * whole kit ladder spends.
   */
  function vent(riftId) {
    const r = rifts?.list?.find((x) => x.id === riftId);
    const at = r && (r.foot || r.pos);
    if (!at || !kit?.vent) return;
    const to = aimOf(riftId) || null;
    let dx = to ? to.x - at.x : player.pos.x - at.x;
    let dz = to ? to.z - at.z : player.pos.z - at.z;
    const m = Math.hypot(dx, dz);
    if (m < 0.01) { dx = 1; dz = 0; } else { dx /= m; dz /= m; }
    try {
      kit.vent(at.x + dx * VENT_M, at.z + dz * VENT_M,
        { height: VENT_H, radius: VENT_R, life: VENT_S });
    } catch { /* a beat must never stop the loop */ }
  }

  /** Where this cadet is being sent, as a flat point, or null. */
  function aimOf(fromId) {
    const tear = nextTear(fromId);
    if (tear) return { x: tear.foot.x, z: tear.foot.z };
    const mark = (() => { try { return errand?.bearing?.() || null; } catch { return null; } })();
    if (mark?.pos) return { x: mark.pos.x, z: mark.pos.z };
    return null;
  }

  /**
   * The interact key, pressed at a tear that has settled for this visit.
   *
   * There is always a reply, and it is a place rather than a refusal: the next
   * tear the card is already naming, or the survey mark the island has lit.
   * A key that does nothing is the defect this project has fixed the most
   * times, and a rule that spends a tear is only defensible while the tear
   * still answers when it is asked.
   *
   * @returns {boolean} true when it named somewhere. **False means the rift
   *   must open after all** — there was nowhere to send this cadet, and
   *   refusing them would be a wall rather than a beat.
   */
  function onward(rift) {
    const from = rift?.id || null;
    const now = clock();
    // Answered a moment ago about this tear. The refusal stands; the sentence
    // is not written again, and the scheduler is not played forward on a held
    // key. (traffic.mjs presses the interact key four times a second.)
    if (saidFor === from && now - saidAt < SAY_EVERY) return true;
    const tear = nextTear(from);
    if (tear) {
      const d = Math.round(Math.hypot(player.pos.x - tear.foot.x, player.pos.z - tear.foot.z));
      lastSaid = tear.id; saidFor = from; saidAt = now;
      hud?.flash?.(t('relay.onwardTear', { skill: t('skills.' + tear.id), n: num(d) }), 'good');
      return true;
    }
    const mark = (() => { try { return errand?.offer?.() || null; } catch { return null; } })();
    if (mark) {
      const d = Math.round(Math.hypot(player.pos.x - mark.x, player.pos.z - mark.z));
      lastSaid = mark.id; saidFor = from; saidAt = now;
      hud?.flash?.(t('relay.onwardMark', { name: t('survey.' + mark.id), n: num(d) }), 'good');
      return true;
    }
    return false;
  }

  /**
   * The tear the game is pointing at, if it is a different one from here.
   *
   * THIS ASKS THE SAME FUNCTION THE CARD ASKS. It used to read `mastery.next()`
   * directly, which was correct until the arrival became real: a spent tear
   * makes `src/meta/objective.js` name the nearest OTHER open tear, so the card
   * and the gold column would have been pointing at one place while the line
   * under them named another. Two instruments, one distance, disagreeing — the
   * defect this codebase has the longest record of. There is one answer to
   * "where now", and this is where it is asked from.
   */
  function nextTear(fromId) {
    let o = null;
    try { o = resolveObjective({ mastery, rifts, player, kit }); } catch { o = null; }
    const r = o?.rift || null;
    if (!r || r.locked || r.id === fromId) return null;
    return r;
  }

  function speak() {
    const from = pending;
    pending = null;
    if (isBusy()) return;

    /* THE HORIZON IS LIT FIRST, AND ALWAYS.
       An earlier cut of this only offered a survey mark when there was no other
       tear to name — and on a ten-node lattice whose daises stand thirty metres
       apart there is nearly always another tear, so the whole survey was
       unreachable for most of a first session and the walk between two stints
       was eight seconds of grass. Lighting the mark is not the same act as
       naming it: a lit landmark on the horizon is an open world, and only the
       line below is the instruction. One instruction, several places. */
    const mark = errand?.offer?.() || null;

    const tear = nextTear(from);
    if (tear) {
      const d = Math.round(Math.hypot(player.pos.x - tear.foot.x, player.pos.z - tear.foot.z));
      if (d > HERE) {
        lastSaid = tear.id;
        hud?.flash?.(t('relay.toTear', {
          skill: t('skills.' + tear.id), n: num(d),
        }), 'good');
        firstLine();
        return;
      }
    }

    // No second tear worth walking to: the island is the errand.
    if (mark) {
      const d = Math.round(Math.hypot(player.pos.x - mark.x, player.pos.z - mark.z));
      hud?.flash?.(t('relay.toMark', {
        name: t('survey.' + mark.id), n: num(d),
      }), 'good');
      firstLine();
      return;
    }

    // Everything is claimed and the scheduler wants this same tear. Say so
    // plainly rather than inventing an errand: an objective that points at
    // nothing is worse than no objective.
    hud?.flash?.(t('relay.stay'), 'good');
    firstLine();
  }

  /** What the rhythm is. Said once, ever. */
  function firstLine() {
    if (firstDone) return;
    firstDone = true;
    comms?.sayKey?.('relay.rhythm', { tag: 'relay-rhythm' });
  }

  function update(dt) {
    if (wait <= 0) return;
    wait -= dt;
    if (wait <= 0) speak();
  }

  return {
    returned,
    onward,
    update,
    state: () => ({ pending, waiting: wait > 0, taught: firstDone, said: lastSaid }),
    reset() {
      wait = 0; pending = null; firstDone = false; lastSaid = null;
      saidFor = null; saidAt = -1e9;
    },
  };
}
