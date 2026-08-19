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

// What the spacing schedule already calls a walk away from the machine. A night
// is measured against the same bar, from the one place it is defined.
import { DURABLE_MINUTES } from '../learn/mastery.js';

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
    // …and the two that make a night cost a real absence rather than a long
    // evening. `playedAt` is the wall clock at the last item; `gapDay` is the
    // calendar day on which this cadet last came back from a genuine walk away
    // from the machine. See `noteNight`.
    playedAt: 0, gapDay: -1,
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
 * passed**, which is what the words already said. It cannot be farmed by
 * holding more lines, and nine of them is nine separate mornings.
 *
 * …AND IT HAS TO BE A NIGHT.
 *
 * That was still one hole short, and the hole was the size of the original
 * complaint. `durable` is the engine's count of re-probes passed after five
 * hours of ELAPSED time on that line, and a line goes quiet while its owner
 * works on other lines. So a cadet who never closes the tab accumulates them
 * exactly like a cadet who leaves and comes back: measured on this build before
 * this paragraph existed, one ten-hour sitting earned **one night held** and
 * opened chapter four with it — the reveal, which is written to arrive on day
 * two, bought by staying up. The calendar cannot close it either, because an
 * evening that runs past midnight changes the date without anybody going
 * anywhere.
 *
 * So a night now costs an absence. `playedAt` is the wall clock at the last
 * item this cadet answered, and the gap in front of an item is the only thing
 * in the game that a long sitting cannot manufacture: playing produces items,
 * and items are what keep the gap at zero. A day may credit a night only if
 * the cadet ARRIVED on it after a real walk away from the machine —
 * `DURABLE_MINUTES`, the same five hours the spacing schedule already calls a
 * gap, imported from `mastery.js` so the two cannot drift apart.
 *
 * The absence is remembered for the day rather than demanded of the exact item
 * that happens to increment `durable`, and it has to be: the first item of a
 * morning is rarely the re-probe, so requiring the gap on the item itself would
 * credit nothing to anybody and turn the pacing gate into a wall.
 *
 * What this leaves reachable is unchanged for anyone who plays like a person: a
 * morning and an evening are two arrivals and the second is five hours after
 * the first, so a cadet who works twice a day still banks their one night a
 * day, and a cadet who comes back tomorrow banks tomorrow's.
 *
 * @param {object} d the ledger, mutated
 * @param {number} now milliseconds, from the schedule's own clock
 * @param {number} durable `mastery.durableCount()`
 * @returns {boolean} whether this call earned a night
 */
export function noteNight(d, now, durable) {
  const n = dayNumber(now);
  // Did this item arrive after a real absence? Read before `playedAt` moves,
  // because the gap in front of an item is the whole measurement.
  //
  // With no `playedAt` there are two cases and they get opposite answers. A
  // ledger that has never worked a day is a first sitting, and a first sitting
  // is not an absence. A ledger written before this field existed, whose last
  // worked day is behind us, is a save being reopened on a later day — which is
  // exactly an absence, and reading it as anything else would cost every
  // existing record a night on the day it upgraded.
  const gap = d.playedAt ? now - d.playedAt
    : (d.last && d.last < n ? Infinity : 0);
  if (gap >= DURABLE_MINUTES * 60000) d.gapDay = n;
  d.playedAt = now;
  const had = d.durable || 0;
  d.durable = durable;
  if (durable <= had) return false;
  if (d.gapDay !== n) return false;     // nobody came back today
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
