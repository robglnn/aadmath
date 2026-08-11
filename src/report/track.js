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

const KEY = 'ascent.report';
/** Longer than this between two answers and the learner was not working. */
const IDLE_CAP_MS = 90_000;
/** A gap this long ends a session; the next answer starts a fresh one. */
const SESSION_GAP_MS = 10 * 60_000;

export function createTracker(mastery) {
  const state = load();

  const skillRow = (id) => (state.skills[id] ||= { ms: 0, items: 0, unassisted: 0, unassistedRight: 0 });

  let lastAt = 0;

  // Before a single number is read out of this ledger, prove it describes the
  // save that is actually loaded.
  reconcile(state, mastery);
  save(state);

  /**
   * Fold the clock forward. Returns the milliseconds credited, which is zero
   * for the first answer of a session — there is nothing before it to measure
   * against, and inventing a number there is how "time on task" starts lying.
   */
  function tick(skillId) {
    const now = Date.now();
    const gap = lastAt ? now - lastAt : Infinity;
    if (gap >= SESSION_GAP_MS) {
      state.sessions.push({ start: now, ms: 0, items: 0 });
      if (state.sessions.length > 60) state.sessions.shift();
      lastAt = now;
      return 0;
    }
    const credited = Math.min(gap, IDLE_CAP_MS);
    lastAt = now;
    state.totalMs += credited;
    skillRow(skillId).ms += credited;
    const s = state.sessions[state.sessions.length - 1];
    if (s) s.ms += credited;
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
    /** Wall-clock milliseconds in the session currently open. */
    sessionMs: () => state.sessions[state.sessions.length - 1]?.ms || 0,
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
