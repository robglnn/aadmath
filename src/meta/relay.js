import { t, num } from '../i18n/index.js';

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
 */

/** Seconds after the card closes before the world says anything. */
const BEAT = 0.75;
/** Inside this many metres a destination is "here" and the line is not worth it. */
const HERE = 14;

export function createRelay(opts = {}) {
  const {
    mastery, rifts, player, hud, comms, errand = null,
    isBusy = () => false,
  } = opts;

  let wait = 0;
  let pending = null;
  let firstDone = false;

  /**
   * A stint has ended at `riftId`. Decide where the player goes, light it, and
   * queue the line — never speak on the same frame the card died on, because a
   * sentence that lands under a collapsing aperture is a sentence nobody read.
   */
  function returned(riftId) {
    pending = riftId || null;
    wait = BEAT;
  }

  /** The tear the scheduler wants next, if it is a different one from here. */
  function nextTear(fromId) {
    let id = null;
    try { id = mastery.next?.()?.id || null; } catch { id = null; }
    if (!id || id === fromId) return null;
    const r = rifts?.list?.find((x) => x.id === id && !x.locked);
    if (!r) return null;
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
    update,
    state: () => ({ pending, waiting: wait > 0, taught: firstDone }),
    reset() { wait = 0; pending = null; firstDone = false; },
  };
}
