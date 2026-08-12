/**
 * THE THIRD CLOCK — the one a long afternoon cannot move.
 *
 * ASCENT had two clocks and both of them ran on answers.
 *
 *   TEARS turned the chapter. Twenty-eight of them opened the last act.
 *   STANDING bought the rank. A hundred and forty was the ceiling.
 *
 * Both are honest measures of work done. Neither can tell a single sitting
 * apart from a week. Played straight through, two hundred and sixty items
 * reached Sovereign and the final chapter — with **zero nights held**. The
 * mathematics was correctly paced across real days by the spacing schedule in
 * `src/learn/mastery.js`, and the story and the ladder were not, so the two
 * halves of the game disagreed about how long it was. A player could finish
 * everything the writing had to say on a Sunday and come back on Monday to a
 * game with nothing left to give them but re-probes.
 *
 * So there is a third clock, and it is the only one that a long sitting cannot
 * move:
 *
 *   NIGHTS HELD   a line you already held, re-probed after a real walk away
 *                 from the machine — five hours or more — and still there.
 *                 `mastery.durableCount()`. It is not a login streak and not a
 *                 participation number: it is retention, measured, and it is
 *                 the same evidence the mastery engine already gathers for
 *                 itself. Nothing you can do in one sitting produces one.
 *
 *   DAYS RETURNED how many separate days this cadet has worked on. Counted off
 *                 the same wall clock the spacing schedule reads, so a harness
 *                 that moves the clock moves this too, and a player who leaves
 *                 the tab open overnight is not credited with two.
 *
 * WHAT THE THIRD CLOCK GATES
 *
 *   The top of the rank ladder (`arc.js`). Bronze and Silver stay minutes away
 *   — the first rite has to be reachable in the first session or nobody sees
 *   one. Gold and Sovereign now also cost nights, so the Standard in the plaza
 *   says something a Sunday cannot buy.
 *
 *   The last two chapters (`shard.js`). The reveal and the ask are the payload
 *   of the writing, and they are worth more arriving on day two and day four
 *   than arriving forty minutes apart. The card says which night it is waiting
 *   for, so a held chapter is a hook and never a wall.
 *
 * WHAT IT DOES NOT GATE: anything to do with learning. No item, no skill, no
 * rift and no capability is behind a day count. A learner who wants to master
 * the whole lattice this afternoon may. They simply do not get told they are
 * the best cadet in the record for it.
 */

/** Milliseconds in a day. */
const DAY = 86400000;

/**
 * Which local calendar day a timestamp falls on, as an integer.
 *
 * Local, not UTC: "yesterday" means the day before the one the learner lived
 * through, and a cadet in Warsaw finishing at 23:40 has to be able to come back
 * at 08:00 and be on day two.
 */
export function dayNumber(ms) {
  const d = new Date(ms);
  return Math.floor((ms - d.getTimezoneOffset() * 60000) / DAY);
}

/** A blank day ledger. */
export function blankDays() {
  return {
    first: 0, last: 0, count: 0, streak: 0, best: 0, marked: [],
    // The third clock proper. `nights` is the number of separate days on which
    // the lattice re-checked something this cadet already held and it was still
    // there. `nightDay` is the last day credited, `durable` the engine's raw
    // count at the last look. See `noteNight`.
    nights: 0, nightDay: 0, durable: 0,
  };
}

/**
 * ONE NIGHT PER NIGHT.
 *
 * The mastery engine counts *durable re-probes*: every held line that came back
 * round after five hours or more and was still known. A cadet holding ten lines
 * passes ten of those on the morning they come back, so counting re-probes made
 * "nine nights held" a thing one Tuesday could buy — the same defect as before,
 * one clock further down.
 *
 * A night held is therefore a **day on which at least one durable re-probe was
 * passed**, which is what the words already said. It cannot be farmed inside a
 * sitting, it cannot be farmed by holding more lines, and nine of them is nine
 * separate mornings. Nothing else in the game behaves like that.
 *
 * @param {object} d the ledger, mutated
 * @param {number} now milliseconds, from the schedule's own clock
 * @param {number} durable `mastery.durableCount()`
 * @returns {boolean} whether this call earned a night
 */
export function noteNight(d, now, durable) {
  const had = d.durable || 0;
  d.durable = durable;
  if (durable <= had) return false;
  const n = dayNumber(now);
  if (d.nightDay === n) return false;   // already credited today
  d.nightDay = n;
  d.nights = (d.nights || 0) + 1;
  return true;
}

/**
 * Adopt the engine's current durable count without crediting a night.
 * Called once when a save is loaded, so restoring a record is not a re-probe.
 */
export function seedNights(d, durable) {
  if (d.durable == null || d.durable < durable) d.durable = durable;
  return d;
}

/**
 * Record that the cadet worked now. Returns the ledger and whether this call
 * opened a new day — which is the beat `dispatch.js` plays.
 *
 * @param {object} d the ledger, mutated
 * @param {number} now milliseconds, from the same clock the schedule reads
 */
export function noteDay(d, now) {
  const n = dayNumber(now);
  if (!d.first) { d.first = n; d.last = n; d.count = 1; d.streak = 1; d.best = 1; return { fresh: true, day: 1 }; }
  if (n === d.last) return { fresh: false, day: d.count };
  // A clock that went backwards is a device with the wrong date on it, not a
  // new day. Nothing is credited and nothing is lost.
  if (n < d.last) return { fresh: false, day: d.count };
  d.streak = n === d.last + 1 ? d.streak + 1 : 1;
  d.best = Math.max(d.best, d.streak);
  d.last = n;
  d.count += 1;
  return { fresh: true, day: d.count };
}

/** How many days since the last day worked. 0 means today. */
export function daysSince(d, now) {
  if (!d.last) return 0;
  return Math.max(0, dayNumber(now) - d.last);
}

/**
 * THE DISPATCHES.
 *
 * Marlow ran dry. The chapters stop at twenty-eight tears and the milestone
 * lines in `voice.js` carry the far end of a *long* save, but neither of them
 * knows what day it is, so a cadet on their fourth morning heard the same
 * ambient bank as one on their first afternoon.
 *
 * A dispatch is one short transmission that arrives on the first rift of a
 * given day, once, forever. It is not a chapter: nothing turns, nothing takes
 * the frame, and missing one costs nothing. It is the sound of somebody who
 * has noticed that you came back.
 *
 * `at` is the number of days worked, not the number of days elapsed — a cadet
 * who plays Monday and then Friday gets day two on Friday, because two days is
 * what they have done.
 */
export const DISPATCHES = [
  { at: 2, id: 'd2', lines: ['story.day.d2.a', 'story.day.d2.b'] },
  { at: 3, id: 'd3', lines: ['story.day.d3.a', 'story.day.d3.b'] },
  { at: 5, id: 'd5', lines: ['story.day.d5.a', 'story.day.d5.b'] },
  { at: 8, id: 'd8', lines: ['story.day.d8.a', 'story.day.d8.b'] },
  { at: 13, id: 'd13', lines: ['story.day.d13.a', 'story.day.d13.b'] },
  { at: 21, id: 'd21', lines: ['story.day.d21.a', 'story.day.d21.b'] },
];

/** The dispatch this day number opens, or null. */
export function dispatchFor(dayCount) {
  return DISPATCHES.find((x) => x.at === dayCount) || null;
}

/**
 * THE NIGHT BEAT — what held while you were away.
 *
 * Said once per returning day, before anything else, and only when there is
 * something true to say. Three sentences maximum, and the first one is the
 * number, because that is the one thing the learner wants.
 */
export function nightBeat({ nights, gap, held }) {
  if (!gap) return null;
  if (held > 0 && nights > 0) return { key: 'story.night.held', params: { n: nights } };
  if (held > 0) return { key: 'story.night.due', params: { n: held } };
  return { key: 'story.night.none', params: { n: gap } };
}
