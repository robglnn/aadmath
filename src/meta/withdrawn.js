/**
 * A CLAIM TAKEN BACK ON THE WAY IN — and the word that has to go with it.
 *
 * `MasteryEngine.load()` withdraws any line loaded as held over a question type
 * the learner has never once got right unaided (`reopenedFor: 'formFloor'`).
 * That call is correct and it is old: the form floor stops a hollow claim being
 * made, and this is the same rule applied to the ones already sitting in a save
 * file. The product reloads that save on EVERY visit, so it runs on every boot.
 *
 * What it did not do was say anything. A line a learner held at the end of one
 * sitting could be open again on the next boot's first frame, with no re-check
 * offered and nothing on screen — a mastery claim moving in silence. This
 * project's rule is that claims are honest in BOTH directions, and a withdrawal
 * nobody is told about is the hollow-mastery failure with the sign flipped.
 *
 * So: one short beat, on the channel the companion already owns, naming the
 * line and saying the one thing the learner can do about it. It is not a modal
 * — a card that takes the frame on arrival is how an opening beat gets skipped,
 * and this is news, not a lesson. It is spoken once, because the withdrawal
 * happens once: after it, the record no longer says the line is held.
 *
 * `tools/critic/withdrawgate.mjs` (`npm run check:withdrawn`) plants a record
 * holding exactly that hollow claim, boots the real page, and requires the
 * words on screen in the learner's own language before it will pass.
 */
import { t } from '../i18n/index.js';

/** How long after the greeting the beat lands. */
const DELAY_MS = 3400;
/** How often the beat asks again while another surface still holds the frame. */
const RETRY_MS = 900;
/** …and how long it will wait before saying it anyway. A cold open runs 21 s. */
const PATIENCE_MS = 60_000;

/**
 * Say what loading this record took back.
 *
 * @param {object} mastery   the live MasteryEngine
 * @param {object} comms     the companion channel (src/meta/comms.js)
 * @param {object} [opts]
 * @param {(id:string)=>string} [opts.name]  how a line is named on screen
 * @param {number} [opts.delay]              ms before the first attempt
 * @param {() => boolean} [opts.ready]       is the frame free to be spoken into
 * @returns {string[]} the ids spoken about — empty when nothing was withdrawn
 */
export function sayWithdrawals(mastery, comms, opts = {}) {
  const taken = withdrawnOnLoad(mastery);
  if (!taken.length || !comms) return [];
  const name = opts.name || ((id) => t('skills.' + id));
  const delay = opts.delay ?? DELAY_MS;
  const ids = taken.map((w) => w.id);

  // `force` on purpose. Every other ambient line in this game may be dropped
  // when the channel is busy; a claim being taken back may not, because the
  // alternative is the silence this module exists to end.
  const head = ids.length === 1
    ? () => t('story.withdrawn.one', { skill: name(ids[0]) })
    : () => t('story.withdrawn.many', { n: ids.length, skills: ids.map(name).join(', ') });

  /* IT WAITS FOR THE FRAME, RATHER THAN GAMBLING ON A NUMBER.
     The cold open holds the screen for twenty-one seconds and queues its own
     speech at 2.6 s, and the channel keeps five lines. A beat posted into that
     is a beat that gets dropped — silently, which is the exact failure this
     module exists to end. So it asks whether the frame is free, and keeps
     asking. `PATIENCE_MS` is a floor, not a licence: after a minute of some
     other surface holding the screen it says it anyway, because being late is
     recoverable and being quiet is not. */
  const ready = opts.ready || (() => true);
  const gaveUpAt = Date.now() + PATIENCE_MS;
  const attempt = () => {
    if (!ready() && Date.now() < gaveUpAt) { setTimeout(attempt, RETRY_MS); return; }
    /* IT GOES TO THE FRONT OF THE CHANNEL, and both lines go together.
       Queued behind the ordinary returning greeting these two arrived over a
       minute into the session in Spanish — the locale with the longest lines
       and one extra beat of its own at boot — which is not "told", it is
       "mentioned eventually". A claim being taken back outranks "welcome back".

       `now` unshifts, so the two are pushed in reverse to come out in order:
       the offer first, then the news in front of it. `_yield` completes the
       sentence being typed rather than cutting it (src/meta/comms.js), so
       jumping the queue never leaves half a word on screen. */
    // The second line is the offer, and it is the reason this is two lines and
    // not one: "we took it back" without "here is how you get it back" is a
    // punishment. It must be read as one thought with the line above it.
    comms.push(() => t('story.withdrawn.why'), { tag: 'withdrawn-why', force: true, now: true });
    comms.push(head, { tag: 'withdrawn', force: true, now: true });
  };
  setTimeout(attempt, delay);
  return ids;
}

/**
 * What loading the record took back, defensively read.
 *
 * The engine records it as `withdrewOnLoad`. Read through a function so that a
 * caller holding an older engine — or a stub in a tool — degrades to "nothing
 * was withdrawn" rather than throwing on the boot path.
 *
 * @returns {{id:string, forms:string[]}[]}
 */
export function withdrawnOnLoad(mastery) {
  const list = mastery?.withdrewOnLoad;
  return Array.isArray(list) ? list : [];
}
