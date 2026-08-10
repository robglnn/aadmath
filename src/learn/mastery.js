/**
 * The learner model.
 *
 * Per skill we run Bayesian Knowledge Tracing: a hidden binary "knows it" state
 * updated from each observed response. BKT alone is a famously soft gate — a
 * lucky run of four-option guesses will push a posterior past 0.95. So five
 * mechanisms sit on top of it, and between them they are what makes 80%+ true
 * mastery the default outcome rather than a lucky one:
 *
 *   1. Prerequisite gating   — a rift line never opens before its parents are
 *      mastered, so nobody accumulates failure on a skill they were never
 *      equipped for. (Bloom's mastery-learning condition.)
 *   2. Unassisted evidence   — hinted or scaffolded successes move pL only
 *      fractionally and never satisfy the gate. Only clean solves count.
 *   3. Worked-example fading — support is complete when the model says the
 *      learner is new, partial in the middle, and absent once competence shows.
 *      (Sweller's completion effect and the expertise-reversal effect.)
 *   4. Interleaved retrieval — practice is not blocked. Prerequisites are
 *      re-probed on an expanding schedule, and a rift will hand you an item
 *      from the lattice below it rather than a third helping of the same thing.
 *   5. A proving run          — the final gate is three unassisted items with
 *      all support switched off, and it does not close until it has spanned two
 *      representations, one of them non-symbolic, has asked once for the walk
 *      between a situation and the algebra. Its first pick at every step, and
 *      the first debt it settles at the last step, is an item form *or a
 *      situation* this learner has never practised in. Transfer, not repetition
 *      — and by the late gates it is the unseen situation, not the unseen form,
 *      that carries that claim.
 *
 *   6. Placement            — a skill whose prerequisites are already solid does
 *      not restart at band 1 with a full worked example. Re-teaching what the
 *      lattice below already proves is the largest single waste of items in a
 *      mastery system, and it is what makes 450 items enough for most learners
 *      rather than 800.
 *
 * A miss on a spaced re-probe demotes the skill and reopens practice, so
 * "mastered" cannot rot silently.
 *
 * The difficulty bands these rules lean on are not labels: generators.demandOf()
 * scores every item and tools/validate-items.mjs fails the build unless measured
 * demand rises strictly from band 1 to band 5 inside every skill. That is what
 * lets the proving run say "at band 4 or above" and mean something.
 */
import { FORMS_BY_SKILL } from './generators.js';

const DEFAULT_BKT = { pInit: 0.25, pTransit: 0.25, pSlip: 0.1, pGuess: 0.15 };
const DEFAULT_MASTERY = {
  pL: 0.95,
  cleanRun: 3,
  minDifficulty: 3,
  checkItems: 3,
  checkMinDifficulty: 4,
  reviewIntervals: [3, 8, 20, 48],
};

export const MASTERY_PL = DEFAULT_MASTERY.pL;
export const MASTERY_CLEAN_RUN = DEFAULT_MASTERY.cleanRun;
export const REVIEW_INTERVALS = DEFAULT_MASTERY.reviewIntervals;

export class MasteryEngine {
  /** @param {object} graph parsed algebra1-l1.json */
  constructor(graph, saved) {
    this.graph = graph;
    this.cfg = { ...DEFAULT_MASTERY, ...(graph.mastery || {}) };
    this.nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    this.state = new Map();
    this.clock = 0;         // global count of attempts; drives the spacing schedule
    this.recent = [];       // skills of the last few items, for interleaving
    this.recentReps = [];   // representations of the last few items, so the surface keeps changing
    for (const n of graph.nodes) this.state.set(n.id, blank(n));
    if (saved) this.load(saved);
  }

  node(id) { return this.nodes.get(id); }
  get(id) { return this.state.get(id); }

  isUnlocked(id) {
    const n = this.nodes.get(id);
    if (!n) return false;
    return n.prereqs.every((p) => this.state.get(p)?.mastered);
  }

  unlockedSkills() {
    return this.graph.nodes.map((n) => n.id).filter((id) => this.isUnlocked(id));
  }

  // -------------------------------------------------------------------------
  // Scheduling
  // -------------------------------------------------------------------------

  /** Skills whose spaced re-probe has come round. */
  dueReviews() {
    return this.unlockedSkills()
      .map((id) => this.state.get(id))
      .filter((s) => s.mastered && s.dueAt != null && this.clock >= s.dueAt)
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  /** The single most useful rift to be standing in front of right now. */
  next() {
    const due = this.dueReviews();
    if (due.length) return { id: due[0].id, kind: 'review' };
    const open = this.unlockedSkills()
      .map((id) => this.state.get(id))
      .filter((s) => !s.mastered)
      .sort((a, b) => (b.check ? 1 : 0) - (a.check ? 1 : 0) || a.pL - b.pL);
    if (open.length) return { id: open[0].id, kind: open[0].check ? 'check' : 'learn' };
    const any = this.unlockedSkills().map((id) => this.state.get(id)).sort((a, b) => a.pL - b.pL);
    return any.length ? { id: any[0].id, kind: 'enrich' } : null;
  }

  /**
   * Turn "the learner walked into the rift for `skillId`" into a concrete task.
   *
   * The rift's own skill is the default, but the scheduler will hand back a
   * retrieval item from the lattice beneath it when practice has gone blocked,
   * or a spaced re-probe of something already mastered. That is interleaving:
   * it costs a little accuracy in the moment and buys a lot of retention.
   */
  /**
   * How much this learner has already shown on everything this skill sits on.
   * 0 when the skill has no prerequisites (a genuinely cold start), otherwise
   * the weakest posterior among its parents — a chain is as strong as its
   * weakest link, and this is the number that decides where a newly opened
   * skill *starts* rather than making everyone begin again at band 1.
   */
  priorCompetence(id) {
    const n = this.nodes.get(id);
    if (!n || !n.prereqs.length) return 0;
    return Math.min(...n.prereqs.map((p) => this.state.get(p)?.pL ?? 0));
  }

  /**
   * Placement, once, when a skill is first met. Re-teaching a learner what
   * their prerequisites already prove they can do is the largest single waste
   * of items in a mastery system, so a skill whose parents are solid opens at
   * band 2 or 3 instead of band 1.
   */
  place(s) {
    if (s.placed || s.attempts > 0) return;
    s.placed = true;
    const ready = this.priorCompetence(s.id);
    const parents = (this.nodes.get(s.id)?.prereqs || [])
      .map((p) => this.state.get(p))
      .filter(Boolean);
    if (!parents.length) return;
    const floor = Math.min(...parents.map((p) => p.difficulty));
    if (ready >= 0.93) s.difficulty = Math.max(s.difficulty, Math.min(3, floor));
    else if (ready >= 0.85) s.difficulty = Math.max(s.difficulty, Math.min(2, floor));
  }

  taskFor(skillId) {
    const s = this.state.get(skillId);
    if (!s) return null;
    this.place(s);

    // A proving run in progress always continues, uninterrupted.
    if (s.check) return this.checkTask(s);

    // A spaced re-probe that has come due beats new material.
    const due = this.dueReviews();
    if (due.length && (due[0].id === skillId || this.blocked(skillId))) {
      const target = due[0];
      return this.task(target, 'review', { difficulty: Math.min(4, Math.max(3, target.difficulty)), scaffold: 'none' });
    }

    // Blocked practice: after two items in a row on one skill, drop in a
    // retrieval item from a mastered prerequisite instead.
    if (this.blocked(skillId)) {
      const prereq = this.retrievalCandidate(skillId);
      if (prereq) return this.task(prereq, 'retrieval', { difficulty: Math.max(2, prereq.difficulty - 1), scaffold: 'none' });
    }

    if (s.mastered) {
      return this.task(s, 'enrich', { difficulty: Math.min(5, s.difficulty + 1), scaffold: 'none' });
    }
    return this.task(s, 'learn', { difficulty: s.difficulty, scaffold: this.scaffoldFor(skillId) });
  }

  blocked(skillId) {
    const r = this.recent;
    return r.length >= 2 && r[r.length - 1] === skillId && r[r.length - 2] === skillId;
  }

  /** A mastered prerequisite that has gone longest without being touched. */
  retrievalCandidate(skillId) {
    const n = this.nodes.get(skillId);
    if (!n) return null;
    const pool = [...allPrereqs(this.graph, skillId)]
      .map((id) => this.state.get(id))
      .filter((x) => x && x.mastered)
      .sort((a, b) => (a.lastSeenAt ?? -1) - (b.lastSeenAt ?? -1));
    return pool[0] || null;
  }

  task(s, kind, extra) {
    const forms = FORMS_BY_SKILL[s.id] || [];
    const seen = (f) => (s.formsSeen[f.id]?.seen || 0);
    const d = Math.max(1, Math.min(5, extra.difficulty | 0 || 1));
    const eligible = forms.filter((f) => d >= f.dMin && d <= f.dMax);
    // Prefer a form this learner has met least often, so a skill is never
    // reducible to one template.
    // New practice hunts for the forms this learner has met least, so a skill
    // can never collapse into one template. A retention probe does not: it is
    // asking "is it still there?", not "can you transfer it?".
    const least = eligible.length ? Math.min(...eligible.map(seen)) : 0;
    let chosen = kind === 'learn' ? eligible.filter((f) => seen(f) <= least + 1) : eligible;
    // Two items in the same representation back to back is how a mastery game
    // turns into a worksheet. Where the pool allows it, change the surface.
    const lastRep = this.recentReps[this.recentReps.length - 1];
    if (lastRep && chosen.length > 1) {
      const other = chosen.filter((f) => f.rep !== lastRep);
      if (other.length) chosen = other;
    }
    const fresh = chosen.map((f) => f.id);
    const requiredReps = (this.nodes.get(s.id)?.requiredReps || []).filter((rep) => !(s.repsCorrect[rep] > 0));
    return {
      skill: s.id,
      kind,
      difficulty: d,
      scaffold: extra.scaffold || 'none',
      formCandidates: fresh,
      reps: requiredReps.length && kind === 'learn' ? requiredReps : null,
      // Practice does not have to be novel, but it must not be a loop: the
      // last handful of framings are off the table so the same sentence is
      // never served twice running.
      avoidScenes: s.recentScenes.slice(),
      check: null,
    };
  }

  /**
   * The proving run — and what makes it a transfer test rather than a lap of
   * honour.
   *
   * Drawing from the forms a learner has practised least is not, on its own,
   * transfer: "least" can still mean "four times last week". So the run is
   * built against three requirements, in order of how much they cost the
   * learner to fake:
   *
   *   · a form this learner has **never met** is preferred over every other,
   *     at every step of the run. Nothing else in the system asks a learner to
   *     recognise the skill in a shape they have not been trained on;
   *   · the run must span **two representations at least** — a claim proved
   *     only in one surface is a claim about that surface;
   *   · and it must include one **modelling** item, verbal or contextual: the
   *     translation between a situation and the algebra is the direction that
   *     collapses first when a skill has been learned as a procedure.
   *
   * The last two are enforced by *extending* the run rather than by failing it,
   * and the extension is bounded, so a learner on a skill whose band offers no
   * modelling form is not held for ever on a requirement the bank cannot meet.
   */
  checkTask(s) {
    const forms = (FORMS_BY_SKILL[s.id] || []);
    // The proving run is never easier than the band the claim is being made
    // about, and never below the configured floor — a gate served at band 1
    // would prove nothing about a band-4 claim.
    const d = Math.min(5, Math.max(this.cfg.checkMinDifficulty, s.difficulty));
    const eligible = forms.filter((f) => d >= f.dMin && d <= f.dMax);
    const seen = (f) => (s.formsSeen[f.id]?.seen || 0);
    const unused = eligible.filter((f) => !s.check.forms.includes(f.id));
    const pool = unused.length ? unused : eligible;
    // "A form you have met least often" stops being transfer the moment a
    // learner has met all of them, which is the normal case by the time the
    // gate opens. So novelty is measured twice: a form never practised, or a
    // form whose deck of situations still holds a world this learner has never
    // worked inside. The second one is what keeps the gate honest late on.
    const novel = (f) => seen(f) === 0
      || (f.sceneKeys || []).some((key) => !(key in s.scenesSeen));
    const fresh = pool.filter(novel);
    const sorted = (fresh.length ? fresh : pool).slice()
      .sort((a, b) => (novel(b) - novel(a)) || (seen(a) - seen(b)));
    let want = sorted.slice(0, Math.max(2, Math.ceil(sorted.length / 2)));

    // What the run still owes before it can close, cheapest debt served last.
    // The three closing conditions come first: leaving them unpaid extends the
    // run, and every extra unassisted item at band 4 is another chance for a
    // learner who does know this to be knocked back to the start of the gate.
    // Novelty is preferred at every step by the sort above, so it is asked for
    // here only when the run owes nothing else.
    const last = s.check.done === s.check.need - 1;
    if (last) {
      const owes = [];
      if (!s.check.modelled) owes.push((f) => f.rep === 'context' || f.rep === 'verbal');
      if (!s.check.nonSymbolic) owes.push((f) => f.rep !== 'symbolic');
      if ((s.check.reps || []).length < 2) owes.push((f) => !(s.check.reps || []).includes(f.rep));
      if (!s.check.novel) owes.push(novel);
      for (const owed of owes) {
        const can = pool.filter(owed);
        if (can.length) { want = can; break; }
      }
    }
    return {
      skill: s.id,
      kind: 'check',
      difficulty: d,
      scaffold: 'none',
      formCandidates: want.map((f) => f.id),
      reps: null,
      // Every situation this learner has already worked inside, refused.
      avoidScenes: Object.keys(s.scenesSeen),
      check: { done: s.check.done, need: s.check.need },
    };
  }

  /**
   * How much of a worked example to put in front of this item.
   *   full    — a complete solved analogue, then the live problem
   *   partial — the analogue with its last line left blank (a completion problem)
   *   none    — no support; the learner is the expert now
   */
  scaffoldFor(id) {
    const s = this.state.get(id);
    if (!s) return 'none';
    if (s.check) return 'none';
    const recentMiss = s.lastCorrect === false;
    // A cold start gets the whole worked analogue — unless the lattice below
    // this skill is already solid, in which case a completion problem is the
    // right level of support and the full example is redundant load.
    if (s.attempts < 2) return this.priorCompetence(id) >= 0.9 ? 'partial' : 'full';
    if (s.pL < 0.35 || s.consecutiveWrong >= 2) return 'full';
    if (s.pL < 0.7 || recentMiss) return 'partial';
    return 'none';
  }

  // -------------------------------------------------------------------------
  // Observation
  // -------------------------------------------------------------------------

  /**
   * Fold one observed response into the model.
   * @param {string} id skill id
   * @param {boolean} correct
   * @param {{assisted?:boolean, misconception?:string|null, form?:string, rep?:string, kind?:string}} meta
   */
  observe(id, correct, meta = {}) {
    const s = this.state.get(id);
    const n = this.nodes.get(id);
    if (!s || !n) return null;
    const p = { ...DEFAULT_BKT, ...(n.bkt || {}) };

    this.clock += 1;
    s.attempts += 1;
    s.lastSeenAt = this.clock;
    s.lastCorrect = correct;
    if (correct) s.correct += 1;
    this.recent.push(id);
    if (this.recent.length > 12) this.recent.shift();
    // Judged before anything below records it: was this item in a shape or a
    // world this learner had genuinely never worked in?
    const wasNovel = (!!meta.form && !(s.formsSeen[meta.form]?.seen))
      || (!!meta.scene && !(meta.scene in s.scenesSeen));
    if (meta.rep) { this.recentReps.push(meta.rep); if (this.recentReps.length > 8) this.recentReps.shift(); }

    if (meta.form) {
      const f = (s.formsSeen[meta.form] ||= { seen: 0, correct: 0 });
      f.seen += 1;
      if (correct && !meta.assisted) f.correct += 1;
    }
    // Which situations this skill has already been dressed in for this learner.
    // The proving run reads this and refuses to re-use them, which is what
    // turns "a form you have met less often" into "a world you have not seen".
    if (meta.scene) {
      s.scenesSeen[meta.scene] = (s.scenesSeen[meta.scene] || 0) + 1;
      s.recentScenes.push(meta.scene);
      if (s.recentScenes.length > 6) s.recentScenes.shift();
    }
    if (meta.rep && correct && !meta.assisted) {
      s.repsCorrect[meta.rep] = (s.repsCorrect[meta.rep] || 0) + 1;
    }

    // --- BKT posterior given the observation ---
    const prior = s.pL;
    const pCorrect = prior * (1 - p.pSlip) + (1 - prior) * p.pGuess;
    const pIncorrect = 1 - pCorrect;
    let post = correct
      ? (prior * (1 - p.pSlip)) / Math.max(pCorrect, 1e-6)
      : (prior * p.pSlip) / Math.max(pIncorrect, 1e-6);

    // An assisted success is much weaker evidence of knowing than a clean one.
    if (correct && meta.assisted) post = prior + (post - prior) * 0.35;

    s.pL = Math.min(0.999, Math.max(0.001, post + (1 - post) * p.pTransit));

    if (correct) s.consecutiveWrong = 0; else s.consecutiveWrong += 1;
    if (correct && !meta.assisted) s.cleanRun += 1; else s.cleanRun = 0;

    if (meta.misconception) {
      s.misconceptions[meta.misconception] = (s.misconceptions[meta.misconception] || 0) + 1;
    }

    // --- adaptive difficulty band ---
    // A credit ladder rather than a staircase: three clean solves buy a step up,
    // two misses buy a step down. That holds observed success near four in five,
    // which is where practice is hard enough to teach and easy enough to finish.
    if (correct && !meta.assisted) s.credit += 1;
    else if (!correct) s.credit -= 2;
    else s.credit += 0.34;
    if (s.credit >= 3) { s.difficulty = Math.min(5, s.difficulty + 1); s.credit = 0; }
    else if (s.credit <= -2) { s.difficulty = Math.max(1, s.difficulty - 1); s.credit = 0; }

    const wasMastered = s.mastered;
    let checkEvent = null;

    if (s.check) {
      // --- proving run in progress ---
      if (correct && !meta.assisted) {
        s.check.done += 1;
        if (meta.form && !s.check.forms.includes(meta.form)) s.check.forms.push(meta.form);
        if (wasNovel) s.check.novel = true;
        if (meta.rep && meta.rep !== 'symbolic') s.check.nonSymbolic = true;
        if (meta.rep === 'context' || meta.rep === 'verbal') s.check.modelled = true;
        s.check.reps ||= [];
        if (meta.rep && !s.check.reps.includes(meta.rep)) s.check.reps.push(meta.rep);
        if (s.check.done >= s.check.need) {
          // The run is not complete until it has spanned more than one surface
          // and has been proved at least once on a modelling item — but it
          // cannot be extended for ever, or a skill whose band offers no such
          // form would never close.
          // Three claims the run must make before it closes: two surfaces, one
          // of them not symbolic, and one item that walks between a situation
          // and the algebra. Novelty — a form or a world this learner has never
          // practised in — is claimed *first* among the run's debts (see
          // checkTask) but is not a closing condition, because a bank can run
          // out of unseen framings for a learner while a gate must not run out
          // of ways to close.
          const spans = s.check.nonSymbolic && s.check.reps.length >= 2 && s.check.modelled;
          if (spans || s.check.need >= this.cfg.checkItems + 2) {
            this.promote(s);
            checkEvent = 'passed';
          } else {
            s.check.need += 1;
          }
        }
      } else {
        s.check = null;
        s.cleanRun = 0;
        s.pL = Math.min(s.pL, 0.88);
        checkEvent = 'failed';
      }
    } else if (!s.mastered) {
      if (s.pL >= this.cfg.pL && s.cleanRun >= this.cfg.cleanRun && s.difficulty >= this.cfg.minDifficulty) {
        s.check = {
          done: 0, need: s.everMastered ? 2 : this.cfg.checkItems,
          forms: [], reps: [], nonSymbolic: false, modelled: false, novel: false,
        };
        checkEvent = 'opened';
      }
    } else {
      // --- spaced re-probe outcome ---
      // A single miss is a lapse, not a collapse: the skill keeps its standing
      // but comes back round almost immediately. Miss the re-probe as well and
      // it is demoted and practice reopens, so mastery cannot rot silently.
      if (correct && !meta.assisted) {
        s.lapsePending = false;
        s.reviewStage = Math.min(this.cfg.reviewIntervals.length - 1, s.reviewStage + 1);
        s.dueAt = this.clock + this.cfg.reviewIntervals[s.reviewStage];
      } else if (!correct) {
        if (s.lapsePending) {
          s.mastered = false;
          s.lapsePending = false;
          s.cleanRun = 0;
          s.pL = Math.min(s.pL, 0.78);
          s.reviewStage = 0;
          s.dueAt = null;
        } else {
          s.lapsePending = true;
          s.reviewStage = 0;
          s.dueAt = this.clock + 2;
          s.pL = Math.min(s.pL, 0.9);
        }
      }
    }

    const newlyUnlocked = !wasMastered && s.mastered
      ? this.graph.nodes.filter((n2) => n2.prereqs.includes(id) && this.isUnlocked(n2.id)).map((n2) => n2.id)
      : [];

    return {
      skill: id,
      pL: s.pL,
      mastered: s.mastered,
      justMastered: !wasMastered && s.mastered,
      newlyUnlocked,
      difficulty: s.difficulty,
      check: s.check ? { done: s.check.done, need: s.check.need } : null,
      checkEvent,
    };
  }

  promote(s) {
    s.mastered = true;
    s.everMastered = true;
    s.masteredAt = this.clock;
    s.check = null;
    s.reviewStage = 0;
    s.dueAt = this.clock + this.cfg.reviewIntervals[0];
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------
  integrity() {
    const total = this.graph.nodes.length;
    const done = [...this.state.values()].filter((s) => s.mastered).length;
    return total ? done / total : 0;
  }

  softIntegrity() {
    const vals = [...this.state.values()];
    if (!vals.length) return 0;
    return vals.reduce((a, s) => a + (s.mastered ? 1 : s.pL), 0) / vals.length;
  }

  /** Which misconception has this learner shown most on this skill? */
  topMisconception(id) {
    const s = this.state.get(id);
    if (!s) return null;
    let best = null, n = 0;
    for (const [k, v] of Object.entries(s.misconceptions)) if (v > n) { n = v; best = k; }
    return best;
  }

  save() {
    return {
      clock: this.clock,
      recent: this.recent.slice(-12),
      recentReps: this.recentReps.slice(-8),
      skills: Object.fromEntries([...this.state].map(([k, v]) => [k, v])),
    };
  }

  load(saved) {
    if (!saved) return;
    this.clock = saved.clock || 0;
    this.recent = Array.isArray(saved.recent) ? saved.recent.slice(-12) : [];
    this.recentReps = Array.isArray(saved.recentReps) ? saved.recentReps.slice(-8) : [];
    for (const [k, v] of Object.entries(saved.skills || {})) {
      if (!this.state.has(k)) continue;
      const base = this.state.get(k);
      this.state.set(k, {
        ...base, ...v,
        misconceptions: { ...(v.misconceptions || {}) },
        formsSeen: { ...(v.formsSeen || {}) },
        // A save written before situations were tracked simply has none yet.
        scenesSeen: { ...(v.scenesSeen || {}) },
        recentScenes: Array.isArray(v.recentScenes) ? v.recentScenes.slice(-6) : [],
        repsCorrect: { ...(v.repsCorrect || {}) },
      });
    }
  }
}

function blank(n) {
  return {
    id: n.id,
    pL: (n.bkt || DEFAULT_BKT).pInit,
    cleanRun: 0,
    consecutiveWrong: 0,
    credit: 0,
    everMastered: false,
    lapsePending: false,
    placed: false,
    attempts: 0,
    correct: 0,
    mastered: false,
    masteredAt: null,
    reviewStage: 0,
    dueAt: null,
    lastSeenAt: null,
    lastCorrect: null,
    misconceptions: {},
    formsSeen: {},
    scenesSeen: {},
    recentScenes: [],
    repsCorrect: {},
    check: null,
    difficulty: 1,
  };
}

/** Every ancestor of a node in the knowledge graph. */
export function allPrereqs(graph, id, out = new Set()) {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n) return out;
  for (const p of n.prereqs) {
    if (out.has(p)) continue;
    out.add(p);
    allPrereqs(graph, p, out);
  }
  return out;
}
