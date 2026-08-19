/**
 * The evidence ledger.
 *
 * The mastery engine knows what a learner *knows*. It does not know what the
 * session *cost*, and it does not keep a history of the claims it has had to
 * take back. Both of those are what a teacher actually asks for, so they are
 * recorded here rather than being reconstructed from a posterior after the
 * fact.
 *
 * Three things are counted, and only three:
 *
 *   TIME      wall-clock seconds between one answer and the next, attributed to
 *             the skill that was on screen, and capped. A learner who walks
 *             away mid-rift has not spent forty minutes on two-step equations,
 *             and a report that says they did is worse than no report.
 *
 *   CLAIMS    every promotion the engine makes, and — the part a mastery system
 *             is tempted to lose — every promotion it later withdraws when the
 *             spaced re-probe comes back wrong twice. The ratio of the second
 *             to the first is the hollow-mastery rate for this one learner, and
 *             it is the only honest self-check a live system has: there is no
 *             hidden ground truth outside a simulator, so the closest thing to
 *             "was that claim real?" is "did it survive being asked again,
 *             cold, days of play later?".
 *
 *   PROBES    each retention re-probe, hit or missed, so the claim's shelf life
 *             is visible rather than inferred.
 *
 * It wraps `mastery.observe` rather than asking the game to call it, because a
 * ledger that depends on every call site remembering to update it is a ledger
 * that will be wrong within a week.
 *
 * TWO STORES, ONE RECORD
 *
 * The learner model lives in `ascent.save` and this ledger lives in
 * `ascent.report`, and until they were reconciled that was a defect with a
 * face: restore one without the other — a shared Chromebook profile, a cleared
 * site-data prompt answered halfway, a save exported and re-imported — and the
 * report cheerfully printed "LINES HELD 4" next to "QUESTIONS ANSWERED 0". It
 * failed *open*: the missing half was the half that could have contradicted the
 * claims, so losing it made the record look cleaner than it was.
 *
 * So the model now stamps every record with an id and an observation count, and
 * `reconcile()` below refuses to report numbers it cannot stand behind:
 *
 *   verified       the ledger's stamp matches the model's, item for item.
 *   reconstructed  the ledger was behind or blank, and has been rebuilt from
 *                  the model's own attempt counts. Question counts are true
 *                  again; time on task before the break is gone and is reported
 *                  as unknown rather than as zero.
 *   foreign        the ledger belongs to a different record. It is discarded,
 *                  not merged — merging two learners' evidence is worse than
 *                  losing one.
 *
 * Reconstruction always rounds *against* the claims: every mastery the model
 * holds gets a claim in the ledger even when the ledger never saw it granted,
 * and every claim the model has since lost gets a withdrawal. That way a
 * half-restored record can only make the hollow-mastery rate worse, never
 * better, and the integrity figure fails closed.
 */

import { sessionClock } from '../session/clock.js';

const KEY = 'ascent.report';
/** Longer than this between two answers and the learner was not working. */
const IDLE_CAP_MS = 90_000;
/** A gap this long between two answers ends a *stretch of work*. See `tick`. */
const SESSION_GAP_MS = 10 * 60_000;

/**
 * TWO FIGURES, ONE CLOCK, AND THE DAY THE OTHER ONE RAN BACKWARDS
 *
 * A cold reader opened the report at wall-clock minute sixteen and read
 * "4 min THIS SESSION". Nothing was broken; the wrong clock was on the label.
 * The pass that fixed that built a SECOND clock in this file to carry the right
 * one, and a later critic watched it read 4 → 7 → 9 → **1** → 5 across one
 * unbroken sitting. Two clocks is how you get a clock that runs backwards, and
 * the second one is always the one that does.
 *
 * So there is now exactly one, it lives in `src/session/clock.js`, and this file
 * reads it. What is still measured here is the OTHER FIGURE — which is not a
 * second clock but a second *quantity*, in the same way that distance walked is
 * not a second clock:
 *
 *   TIME ON TASK is measured *between answers* and capped at `IDLE_CAP_MS`, so a
 *   learner who walks away mid-rift has not spent forty minutes on two-step
 *   equations. It is deliberately smaller than the session, it is an amount of
 *   work rather than an amount of time, and it can never exceed the session
 *   clock — `oneclock.mjs` asserts exactly that, at every checkpoint.
 *
 *   THIS SESSION is `sessionClock().ms()`: how long this sitting has been
 *   going, monotonic, matching the wall. Walking to a rift is part of a session.
 *   Reading a worked echo is part of a session. A Pomodoro shape is 15–25
 *   minutes of *sitting*, so the figure the session is judged against has to be
 *   the one the session is planned in.
 *
 * WHAT WAS DELETED, AND WHY IT HAD TO BE. `sessions[]` used to close a sitting
 * after ten minutes with no ANSWER and open the next one from zero. A cadet who
 * spends eleven minutes walking, building and reading a worked echo has not
 * left the chair; "no answer" is not "no learner", and only the second one ends
 * a sitting. The rows survive as what they always really were — stretches of
 * work inside the record, used for the item counts — and no figure a learner or
 * a teacher reads is a subtraction against one of their start times any more.
 */
export function createTracker(mastery, {
  now = () => Date.now(), clock = sessionClock(),
} = {}) {
  const state = load();

  const skillRow = (id) => (state.skills[id] ||= { ms: 0, items: 0, unassisted: 0, unassistedRight: 0 });

  let lastAt = 0;

  // Before a single number is read out of this ledger, prove it describes the
  // save that is actually loaded.
  reconcile(state, mastery);
  openSitting();
  save(state);

  /**
   * The stretch of work this learner is in.
   *
   * NOT a clock any more, and nothing a learner reads is a subtraction against
   * its start. It is a bucket that time on task and item counts are poured
   * into, so the report can say what this sitting's work was as distinct from
   * the lifetime record. On load the previous bucket is resumed if it was still
   * warm — a reload, a dropped tab, a Chromebook lid.
   */
  function openSitting() {
    const at = now();
    const last = state.sessions[state.sessions.length - 1];
    if (last && at - (last.last ?? last.start ?? 0) < SESSION_GAP_MS) {
      last.start ??= at;
      last.last ??= at;
      // TIME ON TASK does not carry across a reload: `lastAt` stays zero, so
      // the first answer after a load credits nothing. There is nothing before
      // it on this page to measure against, and the gap it would otherwise be
      // charged is the game loading.
      lastAt = 0;
      return;
    }
    state.sessions.push({ start: at, last: at, ms: 0, items: 0 });
    if (state.sessions.length > 60) state.sessions.shift();
  }

  /**
   * Fold TIME ON TASK forward. Returns the milliseconds credited, which is zero
   * for the first answer of a stretch — there is nothing before it to measure
   * against, and inventing a number there is how time on task starts lying.
   *
   * THE SESSION CLOCK IS NOT TOUCHED HERE, and that is the whole repair. This
   * function used to open a new "sitting" whenever ten minutes had passed with
   * no answer, and the figure a learner reads as THIS SESSION was a subtraction
   * against that sitting's start — so eleven minutes of walking and building
   * put twenty-five minutes of real time on screen as "1 min". The bucket below
   * still rolls over, because a stretch of work really does end when the work
   * stops; the clock does not, because the learner did not go anywhere.
   */
  function tick(skillId) {
    const at = now();
    const gap = lastAt ? at - lastAt : Infinity;
    let s = state.sessions[state.sessions.length - 1];
    if (!s || (s.items > 0 && at - (s.last ?? s.start) >= SESSION_GAP_MS)) {
      state.sessions.push({ start: at, last: at, ms: 0, items: 0 });
      if (state.sessions.length > 60) state.sessions.shift();
      lastAt = at;
      return 0;
    }
    s.last = at;
    if (gap >= SESSION_GAP_MS) { lastAt = at; return 0; }
    const credited = Math.min(gap, IDLE_CAP_MS);
    lastAt = at;
    state.totalMs += credited;
    skillRow(skillId).ms += credited;
    s.ms += credited;
    return credited;
  }

  const original = mastery.observe.bind(mastery);
  mastery.observe = (id, correct, meta = {}) => {
    const before = mastery.state.get(id);
    const wasMastered = !!before?.mastered;
    const wasEver = !!before?.everMastered;

    tick(id);
    const res = original(id, correct, meta);
    if (!res) return res;

    const row = skillRow(id);
    row.items += 1;
    state.items += 1;
    const s = state.sessions[state.sessions.length - 1];
    if (s) s.items += 1;
    if (!meta.assisted) {
      row.unassisted += 1;
      state.unassisted += 1;
      if (correct) { row.unassistedRight += 1; state.unassistedRight += 1; }
    }

    // A re-probe of something already claimed: the only live signal we have
    // about whether the claim was worth anything. It has to be an actual
    // scheduled re-probe — an enrichment item served after mastery is not the
    // system asking "is it still there?", and counting it as one inflates the
    // retention figure by an order of magnitude.
    if (wasMastered && meta.kind === 'review') {
      const p = (state.probes[id] ||= { hit: 0, miss: 0 });
      if (correct && !meta.assisted) p.hit += 1;
      else if (!correct) p.miss += 1;
    }

    const now = mastery.state.get(id);
    if (!wasMastered && now?.mastered) {
      state.claims.push({ id, at: Date.now(), regrant: wasEver });
      if (state.claims.length > 400) state.claims.shift();
      // WHERE THE COUNTERS STOOD WHEN THE CLAIM WAS MADE.
      //
      // Without this the card printed one lifetime total — "questions here: 12"
      // — under a claim that rested on three items, and a reader had no way to
      // tell whether the other nine came before the claim (in which case the
      // claim is thin) or after it (in which case they are practice on a line
      // already held). Those are opposite readings of the same figure, so the
      // figure was worthless. Frozen here, at the instant of the grant, for the
      // same reason the receipt in `promote()` is: it is a fact about the claim,
      // and a live read of it is a fact about last Tuesday.
      row.atClaim = { items: row.items, unassistedRight: row.unassistedRight, unassisted: row.unassisted };
    }
    if (wasMastered && !now?.mastered) {
      state.withdrawn.push({ id, at: Date.now() });
      if (state.withdrawn.length > 400) state.withdrawn.shift();
    }
    // The two stores move together or not at all: the ledger adopts the model's
    // observation count on every answer, so the next load can tell to the item
    // whether one of them was restored without the other.
    const stamp = mastery.stamp?.();
    if (stamp) { state.recordId = stamp.recordId; state.seq = stamp.seq; }
    save(state);
    return res;
  };

  return {
    state,
    /** Milliseconds this learner has spent working on one skill. */
    msFor: (id) => state.skills[id]?.ms || 0,
    itemsFor: (id) => state.skills[id]?.items || 0,
    /**
     * Solved first time with no support, as a count rather than a share — so a
     * reader (and tools/critic/_repassert.mjs) can check the percentage beside
     * it against the two numbers it was made from.
     */
    unaidedRightFor: (id) => (state.skills[id]?.rebuilt ? null : state.skills[id]?.unassistedRight || 0),
    /**
     * The share of questions on one skill solved first time with no support.
     *
     * The denominator is every question answered, not every *unassisted*
     * question — because the learning panel marks a miss as assisted the moment
     * it opens the worked echo, so "right, out of the unassisted attempts"
     * silently discards every wrong answer and reads 100% forever. Dividing by
     * the whole is the only version of this number that can move.
     */
    accuracyFor(id) {
      const r = state.skills[id];
      if (r?.rebuilt) return null;   // rebuilt from the model, which cannot say
      return r && r.items ? r.unassistedRight / r.items : null;
    },
    probesFor: (id) => state.probes[id] || { hit: 0, miss: 0 },
    /**
     * The two counts on one line, split at the instant the claim was granted.
     *
     * `before` is what the claim was made on the strength of; `since` is
     * practice, enrichment and cold re-tests on a line already held. Null when
     * the line holds no claim, or when the claim predates this split — an
     * unknown is reported as an unknown, never folded into the other half.
     */
    claimSplit(id) {
      const r = state.skills[id];
      const s = mastery.get(id);
      if (!r || !s?.mastered || r.rebuilt) return null;
      const at = r.atClaim;
      if (!at || at.items == null) return null;
      const since = Math.max(0, r.items - at.items);
      return {
        before: at.items,
        since,
        unaidedBefore: at.items ? at.unassistedRight / at.items : null,
        unaidedSince: since ? (r.unassistedRight - at.unassistedRight) / since : null,
      };
    },
    /**
     * How long this sitting has been going: THE session clock, monotonic, from
     * `src/session/clock.js`. This file does not own it, does not derive it and
     * does not adjust it — it reads it, so that every surface in the game reads
     * the same number at the same instant. See the note at the top.
     */
    sessionMs: () => clock.ms(),
    /** Which sitting this is. A returning learner is on a later one. */
    sittingIndex: () => clock.sittingIndex(),
    /** Time on task inside this sitting: measured between answers, capped. */
    sessionTaskMs: () => state.sessions[state.sessions.length - 1]?.ms || 0,
    sessionItems: () => state.sessions[state.sessions.length - 1]?.items || 0,
    sessions: () => state.sessions.length,
    totalMs: () => state.totalMs,
    items: () => state.items,
    // Rebuilt rows put items into the denominator whose outcomes were never
    // measured, so the whole-record accuracy is withheld rather than diluted.
    accuracy: () => (state.items && !hasRebuilt(state) ? state.unassistedRight / state.items : null),
    granted: () => state.claims.length,
    withdrawnList: () => state.withdrawn,
    withdrawn: () => state.withdrawn.length,
    /**
     * The hollow-mastery rate as a live system can honestly measure it: the
     * share of mastery claims this learner earned that a later cold re-probe
     * took back. Zero claims means zero rate and an explicit "nothing to
     * report yet" in the UI — not a flattering 100% integrity.
     */
    hollowRate: () => (state.claims.length ? state.withdrawn.length / state.claims.length : null),
    /**
     * Whether this ledger can be stood behind, and what had to be done to it.
     * The report reads this before it prints anything a teacher would sign.
     */
    trust: () => state.trust,
    /** True only while every minute in the ledger was actually measured. */
    msTrusted: () => state.trust.level === 'verified' || !!state.trust.msTrusted,
    reset() {
      Object.assign(state, blank());
      const stamp = mastery.stamp?.();
      if (stamp) { state.recordId = stamp.recordId; state.seq = stamp.seq; }
      lastAt = 0;
      // A fresh cadet is still sitting in the chair, but this is a different
      // record's sitting, so it starts at zero. THE ONE CALL IN THE GAME THAT
      // IS ALLOWED TO MAKE THE SESSION CLOCK SMALLER, and it is allowed because
      // a cleared record is a new learner, not a learner who lost fifteen
      // minutes. Nothing else may call it. See src/session/clock.js.
      clock.reset();
      openSitting();
      save(state);
    },
  };
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

/** What the learner model itself remembers, independent of this ledger. */
function modelCounts(mastery) {
  let items = 0;
  const held = [], everHeld = [], lost = [];
  for (const s of mastery.state.values()) {
    items += s.attempts || 0;
    if (s.everMastered) everHeld.push(s.id);
    if (s.mastered) held.push(s.id);
    else if (s.everMastered) lost.push(s.id);
  }
  return { items, held, everHeld, lost };
}

/**
 * Make the ledger describe the save that is loaded, or say plainly that it
 * cannot. Mutates `state` and always leaves `state.trust` populated.
 */
export function reconcile(state, mastery) {
  const stamp = mastery.stamp?.() || { recordId: null, seq: null };
  const model = modelCounts(mastery);
  const reasons = [];
  const t = {
    level: 'verified', at: Date.now(), reasons,
    msTrusted: true, rebuiltItems: 0, rebuiltClaims: 0, rebuiltWithdrawn: 0,
    ledgerItems: state.items, modelItems: model.items,
  };

  const blankLedger = !state.items && !state.claims.length && !Object.keys(state.skills).length;

  // --- identity ------------------------------------------------------------
  // A ledger with no id is either the first one this build has written or one
  // written before records were stamped; it is adopted if — and only if — its
  // counts already agree with the model. A ledger carrying a *different* id is
  // another learner's, and no part of it may be merged into this record.
  if (state.recordId && stamp.recordId && state.recordId !== stamp.recordId) {
    reasons.push('foreign');
    Object.assign(state, blank());
    t.level = 'foreign';
  } else if (!state.recordId && !blankLedger && state.items !== model.items) {
    reasons.push('unstamped');
  }

  // --- volume --------------------------------------------------------------
  // The model counts every observation it has ever taken. The ledger cannot
  // honestly claim fewer.
  if (state.items < model.items) {
    reasons.push(state.items ? 'ledger-behind' : 'ledger-lost');
    for (const s of mastery.state.values()) {
      const row = (state.skills[s.id] ||= { ms: 0, items: 0, unassisted: 0, unassistedRight: 0 });
      if ((s.attempts || 0) > row.items) {
        t.rebuiltItems += (s.attempts || 0) - row.items;
        row.items = s.attempts || 0;
        // Correctness is recoverable from the model; "solved with no help at
        // all" is not, because the model does not separate an assisted success
        // from a clean one after the fact. Rebuilding it from `correct` would
        // publish a flattering accuracy that nothing measured, so the row is
        // marked and the accuracy reads as unknown instead.
        row.rebuilt = true;
      }
    }
    state.items = Math.max(state.items, model.items);
    t.msTrusted = false;
    t.level = t.level === 'foreign' ? 'foreign' : 'reconstructed';
  } else if (state.items > model.items && !blankLedger) {
    // The model is the one that was rolled back. Everything the ledger says
    // about claims is now unsupported by the model it is filed against.
    reasons.push('model-behind');
    t.level = t.level === 'foreign' ? 'foreign' : 'reconstructed';
    t.msTrusted = false;
  }

  // --- claims, rounded against the record ----------------------------------
  const claimed = new Set(state.claims.map((c) => c.id));
  for (const id of model.everHeld) {
    if (claimed.has(id)) continue;
    const s = mastery.get(id);
    state.claims.push({ id, at: s?.provenBy?.at || null, regrant: false, rebuilt: true });
    t.rebuiltClaims += 1;
  }
  // A claim the model has no memory of ever granting cannot be counted as one
  // this learner earned. Dropping it shrinks the denominator of the hollow
  // rate, which makes that rate worse, which is the correct direction.
  const everHeld = new Set(model.everHeld);
  const kept = state.claims.filter((c) => everHeld.has(c.id));
  if (kept.length !== state.claims.length) {
    reasons.push('claims-unsupported');
    state.claims = kept;
    t.level = t.level === 'foreign' ? 'foreign' : 'reconstructed';
  }
  const withdrawn = new Set(state.withdrawn.map((w) => w.id));
  for (const id of model.lost) {
    if (withdrawn.has(id)) continue;
    state.withdrawn.push({ id, at: null, rebuilt: true });
    t.rebuiltWithdrawn += 1;
  }
  if (t.rebuiltClaims || t.rebuiltWithdrawn) {
    if (!reasons.includes('ledger-behind') && !reasons.includes('ledger-lost')) reasons.push('claims-behind');
    if (t.level === 'verified') t.level = 'reconstructed';
  }

  if (blankLedger && !model.items) t.level = 'verified';
  state.recordId = stamp.recordId || state.recordId;
  state.seq = stamp.seq ?? state.seq;
  state.trust = t;
  return t;
}

const hasRebuilt = (state) => Object.values(state.skills).some((r) => r.rebuilt);

function blank() {
  return {
    v: 2,
    recordId: null,
    seq: null,
    trust: { level: 'verified', reasons: [], msTrusted: true },
    totalMs: 0,
    items: 0,
    unassisted: 0,
    unassistedRight: 0,
    skills: {},
    probes: {},
    claims: [],
    withdrawn: [],
    sessions: [],
  };
}

function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }
  const base = blank();
  // v1 ledgers are read, not thrown away: their shape is a subset of this one
  // and reconcile() is what decides whether their numbers can be trusted.
  if (!saved || (saved.v !== 1 && saved.v !== 2)) return base;
  return {
    ...base,
    ...saved,
    v: 2,
    trust: { ...base.trust },
    skills: { ...(saved.skills || {}) },
    probes: { ...(saved.probes || {}) },
    claims: Array.isArray(saved.claims) ? saved.claims : [],
    withdrawn: Array.isArray(saved.withdrawn) ? saved.withdrawn : [],
    sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
  };
}

function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
