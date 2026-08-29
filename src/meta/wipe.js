/**
 * THE RECORD, AND HOW IT IS THROWN AWAY.
 *
 * The pause menu offers START OVER, and above the two buttons it prints a
 * promise: *"Every rift you have sealed and every mote you have earned goes."*
 * It was not true. Motes went. Sealed rifts, world repair, the rank, the
 * teacher record and the entire mastery model came back, through a full page
 * reload, because the wipe was a hand-written list of `removeItem` calls that
 * ran BEFORE the module resets — and one of those resets (`wallet.reset()`)
 * fires `onChange`, which is wired to `save()`, which wrote the live mastery
 * engine straight back over the file that had just been deleted. Measured:
 * four held lines still standing in `ascent.save` after the confirm, with
 * `shards: 0` beside them. A student handed a "fresh start" got somebody
 * else's evidence, and the teacher reading that record was reading a lie.
 *
 * Two rules come out of that, and this file is both of them.
 *
 * 1. THE SWEEP IS DENY-BY-DEFAULT. A key does not have to be remembered to be
 *    wiped; it has to be remembered to SURVIVE. `KEPT` below is the whole list
 *    of things a start-over keeps, each with the reason it is not progress.
 *    Everything else under the `ascent.` prefix goes. The old shape — a list
 *    of the keys to delete — is one `localStorage.setItem` in a new module
 *    away from being wrong again, and it had already gone wrong three times:
 *    `ascent.waygates`, `ascent.learner` and `ascent.hand` all survived a
 *    "start over" on the shipping build.
 *
 * 2. THE SWEEP RUNS AT BOOT, NOT AT THE CLICK. Deleting a save in a document
 *    that is still running is a race against every timer in the game: the
 *    session clock writes once a second off `requestAnimationFrame`, the
 *    ledger writes on `pagehide`, the run writes on `beforeunload`, and the
 *    frame loop keeps running until the browser commits the navigation — four
 *    seconds of it, on a school laptop with a slow reload. So the confirm
 *    writes ONE key and reloads; the next boot reads that key and sweeps
 *    before a single module has been constructed. Nothing can re-persist into
 *    a document that no longer exists, and a wipe interrupted by a crash
 *    finishes itself on the boot after that.
 *
 * `tools/critic/wipegate.mjs` (`npm run check:wipe`) plants a real record —
 * built by the shipping MasteryEngine's own serializer — presses Escape with a
 * real key, clicks the real button, and asserts across the reload that not one
 * of these keys is left. Its self-test plants a key that survives the sweep and
 * requires the gate to go red.
 */

/** The one key a wipe leaves behind for itself, cleared by the sweep it asks for. */
export const WIPE_MARK = 'ascent.wipe';

/** Every key under this prefix is the game's, and is the sweep's business. */
export const PREFIX = 'ascent.';

/**
 * THE RECORD. Everything a learner's standing, their world and their evidence
 * is kept in. START OVER throws every one of these away. The list is not what
 * the sweep reads — the sweep is deny-by-default — it is what the gate plants,
 * and it is here so that the answer to "what is in the save?" is written down
 * in one place instead of being reconstructed from twelve modules.
 */
export const RECORD_KEYS = [
  // No reason is written beside these, because "this is part of the record" is
  // the default. It is the two lists BELOW — the things that survive — that owe
  // an explanation, and they carry theirs as data so a gate can require one.
  'ascent.save',        // the learner model and the mote balance (src/main.js)
  'ascent.run',         // the sitting in progress (src/session)
  'ascent.run.last',    // what the last closed sitting left behind (src/session)
  'ascent.pace',        // how fast this learner works (src/session/pace.js)
  'ascent.clock',       // the sitting clock and its index (src/session/clock.js)
  'ascent.clockoffset', // how far a harness pushed the wall clock (src/main.js)
  'ascent.report',      // the teacher record (src/report/track.js)
  'ascent.story',       // chapter, rank, beats already told (src/meta/index.js)
  'ascent.night',       // nights held (src/meta/night.js)
  'ascent.survey',      // landmarks claimed (src/world/errand.js)
  'ascent.waygates',    // world repair (src/world/waygate.js)
  'ascent.spans',       // world repair (src/world/span.js)
  'ascent.caches',      // world repair (src/world/caches.js)
  'ascent.meet',        // world repair: THE MEET, opened and said (src/world/meet.js)
  'ascent.wardens',     // wardens beaten (src/world/warden.js)
  'ascent.charges',     // kit: glide charges (src/kit/kit.js)
  'ascent.beacons',     // kit: beacons planted (src/kit/kit.js)
  'ascent.stations',    // kit: stations raised (src/kit/kit.js)
  'ascent.charters',    // kit: charters granted (src/kit/kit.js)
  'ascent.sound',       // kit: the sounding day (src/kit/kit.js)
  'ascent.temper',      // kit: a count kept by an older build (src/kit/kit.js)
  'ascent.assay',       // the day's yield already taken (src/kit/ledger.js)
  'ascent.ledgerterms', // which reasons have introduced themselves (src/kit/ledger.js)
  'ascent.hand',        // the builder's first-run flag (src/build/builder.js)
  'ascent.learner',     // the name stamped on the record (src/report/teacher.js)
  WIPE_MARK,            // the marker this wipe left for itself
];

/**
 * WHAT A START-OVER KEEPS, and why each one is not somebody's progress.
 *
 * Short on purpose, and the reason is DATA rather than a comment: an exception
 * nothing can read is how a list of exceptions turns into a habit. Every entry
 * here has to carry a reason or `npm run check:wipe` refuses the build.
 *
 * A key gets on to this list by being a property of the machine or of a
 * different person — never of this learner's own work.
 */
export const KEPT_KEYS = [
  ['ascent.locale', 'the language this browser is read in. Not progress, and re-picking it is a worse first frame than keeping it.'],   // i18n-allow: a developer-facing reason in the storage ledger; never rendered, never translated
  ['ascent.sens', 'look speed. A device setting; the hand it belongs to did not change.'],   // i18n-allow: same ledger, same reason
  ['ascent.invertY', 'inverted look. A device setting, and for some players an accessibility one.'],   // i18n-allow: same ledger, same reason
  ['ascent.audio', 'muted, and how loud. A room setting.'],   // i18n-allow: same ledger, same reason
  ['ascent.framework', 'whether standards are read as CCSS or TEKS. A reading preference, usually the teacher\'s.'],   // i18n-allow: same ledger, same reason
  ['ascent.class', 'OTHER learners records, imported by a teacher on this machine. A student pressing START OVER may not delete a class.'],   // i18n-allow: same ledger, same reason
];

/**
 * Strings that look like storage keys and are not. Named so the gate's static
 * check can balance its books without either guessing or going quiet.
 */
export const NOT_STORAGE = [
  ['ascent.hdr', 'the name of a render target (src/fx/index.js)'],   // i18n-allow: same ledger, same reason
  ['ascent.volume', 'the name of a render target (src/fx/passes/volumetrics.js)'],   // i18n-allow: same ledger, same reason
  ['ascent.learner-record', 'the kind stamped inside an exported record FILE, not a key (src/report/record.js)'],   // i18n-allow: same ledger, same reason
];

const KEPT = new Set(KEPT_KEYS.map(([k]) => k));

/** A storage that cannot throw. Private browsing refuses `setItem` outright. */
function safe(storage) {
  if (storage) return storage;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/**
 * Phase one: ask for the wipe, and say nothing else.
 *
 * Deliberately does not delete anything. The document doing the asking is about
 * to be replaced, and every deletion it makes is a race against its own timers.
 * @returns {boolean} whether the request could be recorded at all
 */
export function markWipe(storage = null) {
  const s = safe(storage);
  if (!s) return false;
  try { s.setItem(WIPE_MARK, String(Date.now())); return true; } catch { return false; }
}

/** Is a wipe outstanding? */
export function pendingWipe(storage = null) {
  const s = safe(storage);
  if (!s) return false;
  try { return s.getItem(WIPE_MARK) != null; } catch { return false; }
}

/**
 * Phase two: sweep, if one was asked for. Called at the top of boot, before any
 * module has read a byte of it.
 *
 * Deny-by-default: every `ascent.` key that is not named in `KEPT_KEYS` goes,
 * including keys this file has never heard of. A key added by a lane that never
 * read this file is, until somebody says otherwise, part of somebody's record —
 * and the safe direction for a control called START OVER is to throw it away.
 *
 * @param {Storage|null} storage
 * @returns {string[]} the keys removed, sorted. Empty when no wipe was asked for.
 */
export function finishWipe(storage = null) {
  const s = safe(storage);
  if (!s || !pendingWipe(s)) return [];
  return sweep(s);
}

/**
 * The sweep itself, with no marker asked for.
 *
 * Exported for the one case `markWipe` cannot cover: a browser that refuses to
 * write at all. There the mark can never be left, so the next boot would find
 * nothing to do and the player would watch the page reload with their whole
 * record intact — a promise quietly not kept. If the request cannot be
 * recorded, it is carried out on the spot instead, best effort.
 *
 * @param {Storage|null} storage
 * @returns {string[]} the keys removed, sorted
 */
export function sweep(storage = null) {
  const s = safe(storage);
  if (!s) return [];
  const doomed = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(PREFIX) && !KEPT.has(k)) doomed.push(k);
    }
  } catch { return []; }
  for (const k of doomed) { try { s.removeItem(k); } catch { /* private mode */ } }
  // The marker last, and only once the rest is gone: a sweep interrupted
  // halfway is a sweep that runs again on the next boot.
  try { s.removeItem(WIPE_MARK); } catch { /* private mode */ }
  return doomed.sort();
}
