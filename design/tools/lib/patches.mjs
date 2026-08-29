/**
 * CANDIDATE CHANGES TO THE ENGINE, as patches applied to the real object.
 *
 * Every arm in the frontier table is one of these. Nothing here re-implements
 * the gate: each patch replaces exactly one method of the shipping
 * `MasteryEngine` and leaves the rest of src/learn/mastery.js running. A
 * proposal that cannot be written this way is a proposal that has not been
 * measured.
 */
import { FORMS_BY_SKILL } from '../../../src/learn/generators.js';

const MODELLING = new Set(['context', 'verbal']);

/**
 * A — THE GATE IS THE BAR, NOT THE CEILING.
 *
 * A proving run is served at the demand the claim is actually about
 * (`gateFloorFor`), rather than at wherever the practice ladder has climbed to.
 *
 * Today a run opened by a clean sight-read inherits the sight-read's own band,
 * which is the TOP of the bank: `observe` does `s.difficulty = max(s.difficulty,
 * band)` and the run is stamped `band` — so the two items that follow the cold
 * item are the hardest the bank can produce, on a claim whose stated bar is
 * "band 4 or above".
 *
 * The sight-read itself is untouched. It is the one item that has to separate a
 * knower from a guesser with no prior evidence on this skill, and dropping it
 * to band 4 is already measured as a bad trade (`sightReadBand` in the config).
 */
export const gateAtBar = (e) => {
  e.gateBandFor = (id) => e.gateFloorFor(id);
};

/**
 * B — A HOLE IS PAID AT THE BAR.
 *
 * `checkTask` clamps a hole-pinned item into the form's own band range and then
 * serves it at the RUN's band. A hole opened by a missed sight-read is therefore
 * re-asked at band 5 — the band it was missed at — over and over. The claim it
 * stands in front of is a band-4 claim, so the bar is what it should be asked
 * at.
 */
export const holeAtBar = (e) => {
  const orig = e.checkTask.bind(e);
  e.checkTask = (s) => {
    const t = orig(s);
    if (!t || !t.check?.hole) return t;
    const f = (FORMS_BY_SKILL[s.id] || []).find((x) => x.id === t.check.hole);
    if (!f) return t;
    const d = Math.max(f.dMin, Math.min(f.dMax, e.gateFloorFor(s.id)));
    if (d === t.difficulty) return t;
    t.difficulty = d;
    if (s.lastServed) s.lastServed.difficulty = d;
    return t;
  };
};

/**
 * C — DO NOT BORROW WHILE IN DEBT.
 *
 * A proving run prefers a form this learner has never practised, which is what
 * makes it a transfer test. While a hole stands, that preference is also a hole
 * FACTORY: the run serves a fresh form, the learner misses it, and the run now
 * owes two shapes instead of one — and `formFloor` lengthens the run by one for
 * each.
 *
 * So while any hole is outstanding, the run serves the hole and forms this
 * learner has already produced a clean unassisted solve on, and stops
 * introducing new shapes. Nothing is skipped and nothing is shortened: the hole
 * is still the next thing, the run still cannot close over it, and the transfer
 * conditions are untouched — a form that settles a closing condition the run
 * still owes is exempt, because a run that cannot span two surfaces cannot
 * close.
 *
 * This changes WHICH good item is served. It changes no band, no threshold and
 * no closing condition, which is why it moves the tail without moving the
 * classifier.
 */
export const noNewDebt = (e) => {
  const orig = e.checkTask.bind(e);
  e.checkTask = (s) => {
    const t = orig(s);
    if (!t || t.check?.hole) return t;
    if (!e.weakForms(s).length) return t;
    const d = t.difficulty;
    const forms = (FORMS_BY_SKILL[s.id] || []).filter((f) => d >= f.dMin && d <= f.dMax);
    const solved = (f) => (s.formsSeen?.[f.id]?.correct || 0) > 0;
    // What the run still owes. A form that settles a closing condition is
    // served whatever its record, because the alternative is a run that can
    // never close.
    const owes = [];
    if (!s.check?.modelled) owes.push((f) => MODELLING.has(f.rep));
    if (!s.check?.nonSymbolic) owes.push((f) => f.rep !== 'symbolic');
    if ((s.check?.reps || []).length < 2) owes.push((f) => !(s.check.reps || []).includes(f.rep));
    const pays = (f) => owes.some((o) => o(f));
    // Widened to every form the band can ask, not only the ones this run has
    // not used yet — the forms it HAS used are precisely the ones this learner
    // has already produced a clean unassisted solve on, and they are what the
    // run should be filling the wait with.
    const safe = forms.filter((f) => solved(f) || pays(f));
    if (safe.length) t.formCandidates = safe.map((f) => f.id);
    return t;
  };
};

/**
 * E — THE RUN PAYS ITS DEBT AT ONCE.
 *
 * `holeSpacing` keeps one shape from filling a third of a session, and outside
 * a proving run that is right. Inside one it is the whole of the tail: the run
 * cannot close without that shape, so the three items it waits are three items
 * it did not have to serve — and, because the run prefers a form this learner
 * has never practised, each of them can open a debt of its own.
 *
 * So the spacing rule is suspended for the one road that cannot proceed without
 * the shape: a proving run in debt asks for the debt on the next item. Practice
 * (`task`, kind 'learn') is untouched, and so is every session-level diversity
 * rule that reads `recentActs` and `recentSkeletons`.
 */
export const payAtOnce = (e) => {
  const holeDue = e.holeDue.bind(e);
  e.holeDue = (s, f) => (s?.check ? true : holeDue(s, f));
};

/** D — pay the hole sooner. A config dial, kept here so every arm reads alike. */
export const holeSpacing = (n) => (e) => { e.cfg.holeSpacing = n; };

/** Compose patches left to right. */
export const all = (...ps) => (e) => { for (const p of ps) p(e); };

/**
 * E' — THE SAME, FOR THE LEARNER IT IS FOR.
 *
 * `payAtOnce` is a concession, and a concession granted to everybody is a
 * concession granted to the learner who is guessing. `steadyAtGate` is the
 * reading the engine already uses to decide whether a miss is a slip or a
 * pattern, and it reads the WHOLE lattice rather than this skill: measured on
 * this bank, 94.5% of the items served to a learner at competence 0.95 are
 * served while it is true and 4.5% of the items served to one at 0.60.
 *
 * So the run pays its debt at once for a learner whose record already reads
 * knower-level, and waits `holeSpacing` items for everybody else — which is
 * also the right teaching for the learner who is still learning the shape.
 */
export const payAtOnceSteady = (e) => {
  const holeDue = e.holeDue.bind(e);
  e.holeDue = (s, f) => ((s?.check && e.steadyAtGate()) ? true : holeDue(s, f));
};

/** B' — the hole is asked at the bar, for a learner whose record reads steady. */
export const holeAtBarSteady = (e) => {
  const orig = e.checkTask.bind(e);
  e.checkTask = (s) => {
    const t = orig(s);
    if (!t || !t.check?.hole || !e.steadyAtGate()) return t;
    const f = (FORMS_BY_SKILL[s.id] || []).find((x) => x.id === t.check.hole);
    if (!f) return t;
    const d = Math.max(f.dMin, Math.min(f.dMax, e.gateFloorFor(s.id)));
    if (d === t.difficulty) return t;
    t.difficulty = d;
    if (s.lastServed) s.lastServed.difficulty = d;
    return t;
  };
};

/** A' — the gate is served at the bar, for a learner whose record reads steady. */
export const gateAtBarSteady = (e) => {
  const orig = e.gateBandFor.bind(e);
  e.gateBandFor = (id, band) => (e.steadyAtGate() ? e.gateFloorFor(id) : orig(id, band));
};

/**
 * S — A HOLE FOUND AFTER THE CLAIM IS A LAPSE, NOT A VERDICT.
 *
 * `observe` ends with a block titled A HOLE THAT OPENS AFTER THE CLAIM STILL
 * UNSEATS IT. The rule is right and the sentence under it — "a line cannot be
 * HELD while a shape of it is never once solved" — is the sentence this whole
 * engine is built to be able to say. What nobody measured is who trips it.
 *
 * The endgame descent picks a held line BECAUSE its bank still holds a form
 * this learner has never worked (`soundingPick`: `fresh`), serves it at band 5
 * (`soundingTask`), and its own documentation says it "grants no mastery and no
 * retention credit … a miss ends the run and costs the line not one point of
 * its claim". That last clause is false: the miss writes
 * `formsSeen[f] = {items: 1, correct: 0}`, the block above then withdraws the
 * claim, and measured on a learner who genuinely knows all ten skills the
 * descent is responsible for 60% of every claim this engine takes away.
 *
 * The fix is the rule the engine already uses for the same shape of evidence.
 * A missed cold re-probe is a LAPSE: the line keeps its standing, comes back
 * round in two minutes, and a SECOND miss demotes it — because one miss cannot
 * tell a slip from rot. A shape that goes never-once-solved on a held line is
 * exactly that evidence and deserves exactly that answer: the claim stands, the
 * shape goes to the front of the queue pinned by name, and if it is missed
 * again the claim goes.
 *
 * Nothing is weakened. A claim still cannot survive a shape this learner cannot
 * do; it now takes two misses of that shape rather than one, which is the same
 * standard every other rot in this file is held to.
 */
export const holeIsALapse = (e) => {
  const obs = e.observe.bind(e);
  const taskFor = e.taskFor.bind(e);
  e.observe = (id, correct, meta = {}) => {
    const s = e.get(id);
    const res = obs(id, correct, meta);
    if (!s || !res) return res;
    // The pinned shape has come back right, unaided: the debt is closed and so
    // is the lapse.
    if (s.pendingHole && meta.form === s.pendingHole && correct && !meta.assisted) {
      s.pendingHole = null; s.pendingHoleSeq = null;
    }
    if (!res.justWithdrawn || res.withdrawnFor !== 'formFloor') return res;
    // A second miss of the pinned shape ON A NEW QUESTION lets the claim go.
    // The stamp matters: a card stays up until it comes out right, so one item
    // reports two or three times, and spending the second strike on the retry
    // of the card that opened the hole is the counting-taps-not-items defect
    // this file warns about everywhere else.
    const fresh = s.lastServed?.seq !== s.pendingHoleSeq;
    if (s.pendingHole && s.pendingHole === meta.form && fresh) {
      s.pendingHole = null; s.pendingHoleSeq = null;
      return res;
    }
    // Otherwise the claim stands and the line goes on the ENGINE'S OWN lapse
    // path — the same one a missed cold re-probe uses, with the same two-strike
    // rule and the same 2.2x priority boost in `leverage` — with the shape
    // pinned by name so the re-check is about the thing that opened it.
    s.mastered = true;
    s.reopenedFor = null;
    s.reopenedAt = null;
    if (!s.pendingHole) { s.pendingHole = meta.form || e.weakForms(s)[0] || null; s.pendingHoleSeq = s.lastServed?.seq ?? null; }
    s.lapsePending = true;
    s.reviewStage = 0;
    s.pL = Math.min(s.pL, 0.9);
    s.dueTime = e.now();
    s.dueAt = e.clock;
    s.check = null;
    res.justWithdrawn = false;
    res.withdrawnFor = null;
    res.mastered = true;
    return res;
  };
  e.taskFor = (id, opts) => {
    const t = taskFor(id, opts);
    if (!t || t.kind !== 'review') return t;
    const s = e.get(t.skill);
    if (!s?.pendingHole) return t;
    const f = (FORMS_BY_SKILL[t.skill] || []).find((x) => x.id === s.pendingHole);
    if (!f) return t;
    t.formCandidates = [f.id];
    const d = Math.max(f.dMin, Math.min(f.dMax, t.difficulty));
    t.difficulty = d;
    if (s.lastServed) s.lastServed.difficulty = d;
    return t;
  };
};

/**
 * R — A RETENTION PROBE IS ASKED AT THE BAND THE CLAIM WAS MADE AT.
 *
 * `taskFor` serves a spaced re-probe at `min(4, max(3, s.difficulty))` — the
 * learner's own practice band, clamped. So a learner the ladder has left at
 * band 3 is re-probed at band 3 and one sitting at band 5 is re-probed at band
 * 4, and the pass rate of the probe is therefore roughly the same for both,
 * whatever either of them actually remembers.
 *
 * Measured on daily returners, the pass rate of one cold re-probe is 84.6% for
 * a learner whose true competence is between 0.60 and 0.75 and 76.9% for one
 * between 0.85 and 0.92 — flat, and pointing the wrong way. A number that does
 * not move with the thing it is about is not a measurement of that thing, and
 * "day-five retention" computed from it would be a statement about the
 * scheduler's choice of band.
 *
 * A claim was granted at a band. Re-checking it anywhere else re-checks a
 * different claim. So the probe is served at the band on the claim's own
 * receipt (`provenBy.band`), floored by this skill's gate floor.
 */
export const probeAtTheClaim = (e) => {
  const taskFor = e.taskFor.bind(e);
  e.taskFor = (id, opts) => {
    const t = taskFor(id, opts);
    if (!t || t.kind !== 'review') return t;
    const s = e.get(t.skill);
    const want = Math.max(e.gateFloorFor(t.skill), Math.min(5, s?.provenBy?.band ?? e.gateFloorFor(t.skill)));
    if (want === t.difficulty) return t;
    t.difficulty = want;
    const forms = (FORMS_BY_SKILL[t.skill] || []).filter((f) => want >= f.dMin && want <= f.dMax);
    if (forms.length) {
      const keep = t.formCandidates.filter((cid) => forms.some((f) => f.id === cid));
      t.formCandidates = keep.length ? keep : forms.map((f) => f.id);
    }
    if (s?.lastServed) s.lastServed.difficulty = want;
    return t;
  };
};
