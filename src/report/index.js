/**
 * The progress report.
 *
 * Two people read this screen and they want opposite things.
 *
 * A fourteen-year-old wants to know *what they have got* and *what is next* —
 * one line each, no arithmetic. A teacher wants to know whether the claim on
 * that line means anything, which is a completely different question and is
 * answered by naming the evidence: how many unassisted solves, at what
 * difficulty, in how many representations, whether the proving run spanned a
 * form the learner had never seen, and whether the claim has survived being
 * asked again days later.
 *
 * So the report is one document with two depths. Closed, every skill is a name,
 * a state and a bar. Opened, the same skill is five evidence conditions with
 * their actual numbers, the standards it answers to in both frameworks, and the
 * misconception this learner keeps returning to.
 *
 * The uncomfortable number is on the front page, not buried. A mastery system
 * that cannot say how often it was wrong is not reporting, it is advertising —
 * so the count of claims this engine has had to withdraw after a cold re-probe
 * is a headline tile, and it says "nothing to report yet" rather than a
 * flattering 100% when there is no evidence either way.
 *
 * TWO RULES THIS SCREEN IS NOW BUILT ON, BOTH LEARNED THE HARD WAY
 *
 * 1. AN EVIDENCE ROW MAY NOT READ FROM THE CONFIGURATION. This screen used to
 *    render the clean-run tile as `max(cleanRun, cfg.cleanRun)` and the
 *    proving-run tile as `cfg.checkItems`, unconditionally, the moment a skill
 *    was mastered. Both numbers therefore came from the gate's own settings
 *    rather than from the learner, which means neither could ever disagree with
 *    the claim it sat under — and on the sight-read road the card printed six
 *    items of evidence above a line reading "questions here: 4". A row that
 *    cannot contradict the claim is not evidence, it is decoration. Every
 *    figure below now comes from `provenBy`, the receipt `promote()` freezes at
 *    the instant a claim is granted, and the two roads to mastery produce
 *    visibly different cards because they *are* different evidence.
 *
 * 2. THE ARITHMETIC IS SHOWN. Under the five conditions the card states, in one
 *    sentence, how many unassisted items the claim rests on and how many
 *    questions have been answered on that line — because that is the comparison
 *    a teacher was doing in their head when they caught us.
 *
 * 3. NO TWO FIGURES ON THIS SCREEN MAY BE TRUE OF DIFFERENT WORLDS. Rules one
 *    and two got every number honest one at a time, and the screen still
 *    contradicted itself, because honesty one number at a time is not
 *    consistency. A cold reader found four of them in a single sitting:
 *
 *      · "4 min THIS SESSION" at wall-clock minute sixteen — the session strip
 *        was printing *time on task*, which is measured between answers and
 *        capped, under the session's label. Two clocks, one name. `track.js`
 *        now keeps them apart and this screen prints each under its own.
 *      · "TESTED OUT · this line proved out on first contact" over "QUESTIONS
 *        HERE 12" and "SOLVED UNAIDED 83%". The road was right and the sentence
 *        was wrong: a sight-read opens the run, and the run may then absorb a
 *        miss and pay for it. The receipt records that now, and the sentence is
 *        chosen by `firstContact` rather than by the road.
 *      · A confidence percentage on a line with zero attempts. The model's
 *        opening belief is read off the lines underneath — a starting point, not
 *        a measurement — and printing it as `80%` beside `OPEN` made it one.
 *        Every unmeasured figure on this screen now reads `—`.
 *      · A posterior of 0.996 printed as `100%`. A belief rounded into a fact.
 *        `conf()` below will not print certainty for anything short of it.
 *
 *    A lifetime total under a claim is the general shape of all four: two
 *    readings of one number, opposite in meaning, with nothing to say which.
 *    So every count on a held line is split at the instant the claim was
 *    granted — what proved it, and what happened afterwards — and
 *    `tools/critic/_repassert.mjs` fails the build if any pair stops agreeing.
 */
import './report.css';
import { t, pct, num, getLocale, onLocaleChange } from '../i18n/index.js';
import { createTracker } from './track.js';
import { createTeacher } from './teacher.js';
import { buildRecord, duration, dateText } from './record.js';
import { allPrereqs } from '../learn/mastery.js';
import { FORMS_BY_SKILL } from '../learn/generators.js';
import { FIG, tagFigure, linesHeld, repaired } from '../meta/progress.js';
import {
  buildCoverage, buildProcess, createFrameSwitch, depthFor, caveatFor,
  getFramework, onFrameworkChange, shortCode, useGraph, unitTitle, unitIdsOf,
} from './standards.js';
import { alignmentOf } from '../content/standards.js';

const REPS = ['symbolic', 'context', 'verbal', 'table', 'graph'];
const DEPTHS = ['core', 'supporting', 'introduced'];
const COVERS = ['held', 'part', 'indirect', 'working', 'none'];

/**
 * What this screen prints where a figure was never measured.
 *
 * One mark, everywhere, and never a zero and never a plausible-looking
 * percentage: `0%` and `—` are different claims, and only one of them is true
 * of a line nobody has asked a question about.
 */
const UNMEASURED = '—';

/**
 * A belief, printed as a belief.
 *
 * `pct()` rounds, so a posterior of 0.996 came out as `100%` — and 100% is not
 * a thing this model can mean. Bayesian knowledge tracing approaches one and
 * never arrives; a slip probability alone puts a ceiling under it. So certainty
 * is reserved for an actual one, which nothing in `src/learn` produces, and
 * everything else tops out one point short of it.
 */
const conf = (x) => pct(x >= 1 ? 1 : Math.min(x, 0.99));

/**
 * THE NUMBER ON THE ROW IS THE LOWER BOUND, NOT THE POSTERIOR.
 *
 * A cold reader put three figures side by side that were all about one line and
 * all told different stories: the row said 99%, the model's posterior was 0.999,
 * the session planner's own confidence that this line would close was 0.667, and
 * underneath all three sat a question type standing at nought correct out of
 * three served. Every one of those numbers was computed correctly. The screen
 * was still lying, because it printed the highest of them.
 *
 * So the percentage is now `mastery.confidence(id).floor` — the smallest of the
 * posterior, a Wilson lower bound on the weakest question type actually served,
 * a Wilson lower bound on the gate band, and the planner's confidence when there
 * is one. The posterior has not gone anywhere: it is on the evidence list inside
 * the row, labelled as what it is, so a teacher can see both and see which one
 * the badge is drawn from. A number a reader has to trust is the one you would
 * defend, not the one you would prefer.
 */
const floorOf = (mastery, id, plan) => mastery.confidence(id, { plan }).floor;

/**
 * Coverage depth, for both frameworks, from the same working data the build is
 * gated on.
 *
 * Both frameworks now answer through one function in `./standards.js`, which
 * reads the depth out of the standards maps — including the per-line override
 * TEKS needs, because `A.5(A)` is genuinely core on `multi-step` and supporting
 * on `two-step`. Before this the report drew a Common Core chip with no depth
 * at all, so `eval-expr` read "TEKS 7.7, A.12(B)" with nothing to say that
 * neither is a core claim on that line. A standards claim a reader cannot see
 * the depth of is a stronger claim than the one we actually make.
 */
const depthOf = (framework, nodeId, code) => depthFor(framework, nodeId, code);

/**
 * Which surface a question type is read off.
 *
 * A form id is an internal name — `vm-table`, `ee-graph` — and printing one at a
 * learner would be worse than printing nothing. The surface is the thing a
 * reader recognises ("a table", "a situation"), it is already translated in all
 * three locales, and it is what the weakest-type sentence actually needs to say.
 */
const repOfForm = (skillId, formId) => (FORMS_BY_SKILL[skillId] || [])
  .find((f) => f.id === formId)?.rep || null;

export function createReport({
  root, mastery, graph, isBusy = () => false, onToggle,
  /**
   * The session planner's own confidence, per line, for the run under way:
   * `[{id, confidence}]` off `planRun` in src/session/estimate.js.
   *
   * It is optional and the report works without it — but when it is there, the
   * badge on the row may not be higher than it. This is the third of the three
   * figures a cold reader found disagreeing about one line: the row said 99%
   * while the engine's own projection put this line's chance of closing at
   * 0.667. Both were computed correctly, and a product that shows a learner the
   * larger of two numbers it holds about the same thing is advertising.
   */
  seams = () => null,
  /**
   * RIFTS SEALED IN ALL — the lifetime count, off the one ledger that keeps it
   * (`story.state().tears`, src/meta/index.js). Optional; absent, the tile is
   * simply not drawn rather than drawn with a guess in it.
   *
   * It is here because of the other half of a cold critic's finding. The
   * chapter card on the live HUD carried a label reading "RIFTS SEALED IN ALL"
   * over a bar that measures something else entirely, with the numeral removed
   * by an earlier pass — "whose bar is empty and whose number is missing all
   * session". The label on the HUD now names the bar it sits on; the count it
   * used to claim is a fact a teacher genuinely wants, it is EVIDENCE, and
   * evidence belongs on the screen a learner opens on purpose. So it is here,
   * with a number on it, declared as `all.sealed` and checked against the
   * engine by tools/critic/oneprogress.mjs — which has had that check written
   * and unreachable for two passes, because nothing printed the figure.
   */
  sealed = () => null,
}) {
  // THE MAPS ARE THE RUNNING GRAPH'S. Before this call the standards module
  // imported Level 1's two files and printed them under every unit; it now
  // derives both frameworks from whatever lattice was loaded. See rule 4 in
  // ./standards.js.
  useGraph(graph);
  const tracker = createTracker(mastery);
  /** This line's seam confidence, if a run is planned and names it. */
  const planFor = (id) => {
    const list = seams();
    if (!Array.isArray(list)) return undefined;
    const hit = list.find((x) => x && x.id === id);
    return hit && Number.isFinite(hit.confidence) ? hit.confidence : undefined;
  };
  const cfg = {
    pL: 0.95, cleanRun: 3, checkItems: 3, minDifficulty: 3, checkMinDifficulty: 4,
    // The form floor, mirrored from src/learn/mastery.js: how many times a
    // question type must have been served before this learner can be judged on
    // it, and how many clean unassisted solves of it a claim requires.
    formFloor: 3, formNeed: 1,
    ...(graph.mastery || {}),
  };
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));

  // Order is the argument this screen makes about who it is for.
  //
  // The six administrative tiles used to come first, which on a 414-wide phone
  // is the entire first screen: a fourteen-year-old had to scroll past time on
  // task, questions answered and the withdrawn-claims rate to reach the one
  // line they opened this for. So the student's two questions — what have I got,
  // what is next — are answered above the fold in every viewport, the ten lines
  // come next, and the record a teacher reads sits underneath them behind its
  // own heading. Nothing was removed; the two readers were simply put in the
  // order in which they arrive.
  const el = document.createElement('div');
  el.className = 'rp-scrim';
  el.innerHTML = `<section class="rp-card" role="dialog" aria-modal="true">
    <header class="rp-head">
      <div class="rp-titles"><h2 class="rp-h"></h2><p class="rp-sub"></p></div>
      <div class="rp-head-acts">
        <button class="rp-teacher" type="button"></button>
        <button class="rp-x" type="button"></button>
      </div>
    </header>
    <div class="rp-body">
      <div class="rp-strip"></div>
      <div class="rp-next"></div>
      <h3 class="rp-h3 rp-h-skills"></h3>
      <div class="rp-skills"></div>
      <dl class="rp-legend"></dl>
      <div class="rp-cover-head">
        <h3 class="rp-h3 rp-h-cover"></h3>
        <div class="rp-frame-slot"></div>
      </div>
      <p class="rp-cover-sub"></p>
      <div class="rp-cover-strip"></div>
      <div class="rp-cover"></div>
      <h3 class="rp-h3 rp-h-record"></h3>
      <p class="rp-recsub"></p>
      <div class="rp-trust"></div>
      <div class="rp-stats"></div>
      <p class="rp-foot"></p>
    </div>
  </section>`;
  root.appendChild(el);

  const q = (sel) => el.querySelector(sel);
  const open = { value: false };
  const expanded = new Set();
  const stdOpen = new Set();

  // The framework switch. It writes one setting that every standards surface in
  // this folder reads, so the report, the printed record and the exports can
  // never disagree about which framework a teacher asked for.
  const frame = createFrameSwitch();
  q('.rp-frame-slot').appendChild(frame.el);

  // The teacher's copy: the same numbers as a dated, named, printable document.
  const teacher = createTeacher({
    build: (learner) => buildRecord({
      mastery, graph, tracker, learner, stateOf, depthOf,
      coverage: () => coverage(),
      // The course and unit this document is about, in the reader's language.
      // A thunk, because the record is rebuilt on every locale change.
      levelName: unitTitle(graph),
    }),
    coverage: () => coverage(),
    process: () => buildProcess({ graph, mastery, framework: getFramework(), stateOf }),
    onToggle: (on) => { el.classList.toggle('behind', on); },
  });

  const coverage = () => buildCoverage({ graph, mastery, framework: getFramework(), stateOf });

  q('.rp-x').addEventListener('click', close);
  q('.rp-teacher').addEventListener('click', () => teacher.show());
  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  // The launcher. It is its own control rather than a slot in the HUD, so it
  // reaches a thumb on a phone without landing in the movement zone, and it
  // does not need the HUD to make room for it.
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rp-launch';
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M4 20V9M9.3 20V4M14.7 20v-8M20 20v-5"/></svg><span class="rp-launch-t"></span>';
  root.appendChild(btn);
  btn.addEventListener('click', () => toggle());

  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    // The teacher's copy is a modal on top of this one; P must not pull the
    // floor out from under it.
    if (teacher.open) return;
    if (e.code === 'KeyP' && !e.repeat) { e.preventDefault(); toggle(); }
    else if (e.code === 'Escape' && open.value) { e.stopPropagation(); close(); }
  });

  onLocaleChange(() => { relabel(); if (open.value) render(); if (teacher.open) teacher.render(); });
  // One click on the switch re-expresses both screens. Open rows are keyed by
  // standard code, and the two frameworks share no codes, so a switch lands on
  // a clean list rather than on somebody else's expanded row.
  onFrameworkChange(() => { if (open.value) render(); if (teacher.open) teacher.render(); });
  relabel();

  function relabel() {
    btn.querySelector('.rp-launch-t').textContent = t('report.launch');
    btn.setAttribute('aria-label', t('report.open'));
    btn.title = t('report.openHint');
  }

  /** Our wrapper around `mastery.observe`, live only while the report is open. */
  let modelWatch = null;

  function toggle() { (open.value ? close : show)(); }

  function show() {
    if (isBusy()) return;
    render();
    open.value = true;
    el.classList.add('show');
    btn.classList.add('on');
    watchModel(true);
    onToggle?.(true);
  }

  function close() {
    if (!open.value) return;
    open.value = false;
    el.classList.remove('show');
    btn.classList.remove('on');
    watchModel(false);
    onToggle?.(false);
  }

  /**
   * A REPORT ON SCREEN IS NEVER OLDER THAN THE SCREEN AROUND IT.
   *
   * The cold reading was "the Progress report opened minutes earlier counted
   * QUESTIONS ANSWERED 9" while the run band beside it read ten. Both were
   * right when they were written. Only one of them had been written recently.
   * A figure that was true four minutes ago is, on a live screen, simply a
   * wrong figure — and it is the exact failure this whole pass is about,
   * because a stale number looks identical to a contradictory one.
   *
   * So while the report is open it recomputes on every answer. It is cheap
   * (everything on this screen is already a pure read of the learner model, by
   * design — see `foot`) and it is edge-triggered: nothing runs at all while
   * the report is closed, which is nearly always.
   */
  function watchModel(on) {
    if (on === !!modelWatch) return;
    if (!on) {
      // Only ever unwrap our own wrapper. `src/session` wraps this same call at
      // boot and something else may wrap it later; restoring a saved reference
      // blindly would delete whichever wrapper arrived after ours.
      if (mastery.observe === modelWatch.wrapped) mastery.observe = modelWatch.raw;
      modelWatch = null;
      return;
    }
    const raw = mastery.observe.bind(mastery);
    const wrapped = (id, correct, meta) => {
      const res = raw(id, correct, meta);
      // Never let a repaint break the answer loop: the learner's answer has
      // already been recorded by the time this runs, and a report that fails to
      // redraw is a smaller problem than an answer that fails to land.
      try { if (open.value) render(); } catch { /* redraw only */ }
      return res;
    };
    modelWatch = { raw, wrapped };
    mastery.observe = wrapped;
  }

  // -------------------------------------------------------------------------
  // Reading the learner model
  // -------------------------------------------------------------------------

  /**
   * One skill's standing, in the vocabulary the report speaks.
   *
   * `withdrawn` is deliberately distinct from `open`. A skill that was mastered
   * and then lost the claim is not the same as a skill that has never been
   * proved, and collapsing the two is exactly how a progress screen stops being
   * evidence.
   *
   * A HELD CLAIM OUTRANKS THE LOCK, and this order used to be the other way up.
   *
   * `isUnlocked()` answers *"may we serve this line next?"* — it is a routing
   * decision, and it goes false the moment any line underneath loses its claim
   * on a cold re-probe. It is not, and was being read as, a statement about
   * what this learner has proved. So a seventeen-minute session ended with the
   * strip reading "5 of 10 LINES HELD" over a list in which only four rows said
   * HELD: `two-step` was proved, carried a receipt for five unassisted items at
   * band 5, and was drawn greyed out, labelled LOCKED, with a dash where its
   * confidence should be — because `one-step-mul` under it had lapsed. The
   * standards coverage read it as unheld at the same time.
   *
   * Erasing a proof because a different line lapsed is the worst direction this
   * screen can fail in: it deletes evidence the learner earned, over an event
   * that happened somewhere else. The claim is reported. That a line underneath
   * has reopened is reported too — as its own flag on the row, which is what it
   * is — and the router goes on doing exactly what it did before.
   */
  function stateOf(id) {
    const s = mastery.get(id);
    if (s.mastered) return s.lapsePending ? 'provisional' : 'mastered';
    if (s.check) return 'proving';
    if (s.everMastered) return 'withdrawn';
    if (!mastery.isUnlocked(id)) return 'locked';
    if (s.attempts > 0) return 'practising';
    return 'open';
  }

  /**
   * Held, but standing on a line that has since been reopened. Not a state —
   * the claim is unaffected — but a teacher reading "held" is owed the fact
   * that the ground under it is being re-proved.
   */
  const underReopened = (id) => mastery.get(id).mastered && !mastery.isUnlocked(id);

  /**
   * The five things a mastery claim in this system is made of.
   *
   * For an unproved skill these are live progress towards a gate. For a proved
   * one, the first two are read off the receipt `promote()` wrote — the numbers
   * this learner actually put up, on the road they actually took — and never
   * off `cfg`. A claim granted on the cold sight-read says so and shows three
   * items; a claim ground out the long way shows six. They should look
   * different, because a teacher deciding how much to trust them is asking
   * exactly that.
   */
  function evidenceOf(id) {
    const s = mastery.get(id);
    const n = nodes.get(id);
    const done = s.mastered;
    const pv = done ? s.provenBy : null;
    // A claim granted by a build that kept no receipt. It is not reconstructed
    // and it is not dressed up as met: it is reported as unevidenced.
    const orphan = done && !pv;
    const parents = n.prereqs;
    const parentsMet = parents.every((p) => mastery.get(p)?.mastered);
    const probes = tracker.probesFor(id);
    // Nothing has been asked here. The model still holds an opening belief —
    // seeded off the lines underneath this one — and that belief is a plan for
    // where to start, not a measurement of this learner on this line. Printed as
    // a percentage it is indistinguishable from one, so it is not printed.
    const measured = s.attempts > 0;
    return [
      measured
        ? {
          id: 'posterior',
          met: s.pL >= cfg.pL ? 'met' : 'part',
          value: conf(s.pL),
          detail: t('report.evidence.posteriorNote', { need: pct(cfg.pL) }),
        }
        : {
          id: 'posterior',
          met: 'no',
          value: UNMEASURED,
          detail: t('report.evidence.posteriorNone'),
        },
      cleanRow(),
      provingRow(),
      formsRow(),
      {
        id: 'prereq',
        met: parentsMet ? 'met' : 'no',
        value: parents.length
          ? `${num(parents.filter((p) => mastery.get(p)?.mastered).length)}/${num(parents.length)}`
          : t('report.evidence.noPrereq'),
        detail: parents.length
          ? t('report.evidence.prereqNote', { list: parents.map((p) => t('skills.' + p)).join(', ') })
          : t('report.evidence.prereqRoot'),
      },
      {
        id: 'retention',
        met: probes.hit && !probes.miss ? 'met' : probes.hit || probes.miss ? 'part' : 'no',
        value: probes.hit || probes.miss
          ? t('report.evidence.probeCount', { hit: probes.hit, n: probes.hit + probes.miss })
          : t('report.evidence.probeNone'),
        detail: t('report.evidence.retentionNote'),
      },
    ];

    /**
     * The standing that opened the proving run.
     *
     * On the long road that is three clean unassisted solves at band 3+. On the
     * short road it is one, asked at the gate band itself — fewer items, harder
     * items, and the card says which. On the sight-read road it is *none*,
     * because the cold item is the run's own first item and is counted once,
     * inside the run. Printing "3/3 ✓" over any of those three was the bug.
     *
     * The sight-read road then split in two, because it always had been and the
     * card could not see it. Passing the cold item opens the run; it does not
     * finish it. A run that goes straight through proved out on first contact
     * and the card says so. A run that stumbled, absorbed the miss and paid for
     * it in extra unassisted items did *not* prove out on first contact — and
     * that is exactly the card a reader found printing that sentence over
     * "questions here: 7" and "solved unaided: 71%". `firstContact` is written
     * on the receipt at the moment of the grant; a receipt from a build that
     * did not write it says which road it took and makes no claim about the run.
     */
    function cleanRow() {
      if (orphan) return unevidenced('clean');
      if (pv) {
        if (pv.road === 'sight') {
          const clean = pv.firstContact === true;
          const stumbled = pv.firstContact === false;
          return {
            id: 'clean',
            met: 'met',
            value: t('report.evidence.coldVal', { band: num(pv.band) }),
            detail: clean ? t('report.evidence.cleanSight')
              : stumbled
                ? t('report.evidence.cleanSightCharged', { band: num(pv.band), n: pv.missed || 0 })
                : t('report.evidence.cleanSightOld', { band: num(pv.band) }),
          };
        }
        return {
          id: 'clean',
          met: pv.entryRun >= pv.entryNeed ? 'met' : 'part',
          value: `${num(pv.entryRun)}/${num(pv.entryNeed)}`,
          detail: t('report.evidence.cleanRoad.' + pv.road, { band: num(pv.entryBand ?? cfg.minDifficulty) }),
        };
      }
      const need = s.check ? (s.check.entryNeed ?? cfg.cleanRun) : cfg.cleanRun;
      const run = s.check ? (s.check.entryRun ?? s.cleanRun) : s.cleanRun;
      return {
        id: 'clean',
        met: run >= need ? 'met' : run ? 'part' : 'no',
        value: `${num(Math.min(run, need))}/${num(need)}`,
        detail: t('report.evidence.cleanNote', { band: num(cfg.minDifficulty) }),
      };
    }

    /**
     * The run itself, including every item it extended itself by — and every
     * miss it absorbed. A run that stumbled ends on *more* unassisted evidence
     * than a clean one, never less, so saying so costs the claim nothing and
     * is the difference between a receipt and a slogan.
     */
    function provingRow() {
      if (orphan) return unevidenced('proving');
      if (pv) {
        return {
          id: 'proving',
          met: 'met',
          value: `${num(pv.checkDone)}/${num(pv.checkNeed)}`,
          detail: pv.missed
            ? t('report.evidence.provingCharged', { band: num(pv.band), n: pv.missed })
            : pv.checkNeed > pv.checkBase
              ? t('report.evidence.provingExtended', { band: num(pv.band), n: pv.checkNeed - pv.checkBase })
              : t('report.evidence.provingNote', { band: num(pv.band) }),
        };
      }
      return {
        id: 'proving',
        met: s.check ? 'part' : 'no',
        value: s.check ? `${num(s.check.done)}/${num(s.check.need)}` : `0/${num(cfg.checkItems)}`,
        detail: t('report.evidence.provingNote', { band: num(cfg.checkMinDifficulty) }),
      };
    }

    /**
     * EVERY QUESTION TYPE THIS LINE HAS ACTUALLY SERVED — the row that did not
     * exist when the engine certified a learner on reading a variable while the
     * table form stood at nought correct out of three.
     *
     * The four rows above it are aggregates: a posterior, a run length, a count
     * of prerequisites, a count of re-tests. Every one of them can be carried by
     * a strong showing on the easy shapes, which is exactly what happened. This
     * row cannot be: it reports the WEAKEST question type on the line, by name,
     * with its actual record — and while any served type stands below the floor
     * the claim is not granted at all (see `formFloor` in src/learn/mastery.js).
     *
     * Types the bank never offered this learner are not counted. The engine does
     * not get to be judged on questions it never asked, and it does not get to
     * be flattered by them either.
     */
    function formsRow() {
      // `items`, not `seen`: a missed question is re-offered with the worked
      // step showing and reports again, so `seen` is attempts and only `items`
      // is questions. The sentence this row prints says "out of {of} asked",
      // and a learner counting the questions they were asked would not count
      // the same one three times.
      const seen = Object.entries(s.formsSeen || {})
        .map(([f, r]) => ({ f, seen: r?.items ?? r?.seen ?? 0, got: r?.correct || 0 }))
        .filter((x) => x.seen > 0);
      if (!seen.length) {
        return {
          id: 'forms',
          met: 'no',
          value: t('report.evidence.formsNone'),
          detail: t('report.evidence.formsNote'),
        };
      }
      // Judged on every type that was served. There used to be a third state
      // here — a "not judging you yet" sentence for types the rig had served
      // fewer than `formFloor` times — and that sentence is what a cold critic
      // photographed under a HELD badge: *"Your weakest so far is symbols:
      // 0 right with no help, out of 1 asked"*, printed on a card that had
      // already sealed the line. The row was telling the truth and the badge
      // was not, because the gate had a sample-size threshold under it. The
      // threshold is gone (see `formFloor` in mastery.js), so a served type is
      // a judged type, the middle state cannot occur, and the row can only say
      // "every type solved" or "this one is not solved yet".
      const judged = seen.filter((x) => x.seen >= cfg.formFloor);
      const weakest = (judged.length ? judged : seen)
        .slice().sort((a, b) => (a.got / a.seen) - (b.got / b.seen) || (b.seen - a.seen))[0];
      const solid = seen.filter((x) => x.got >= cfg.formNeed).length;
      const holes = judged.filter((x) => x.got < cfg.formNeed);
      const rep = t('report.rep.' + (repOfForm(id, weakest.f) || 'symbolic'));
      const detail = holes.length
        ? t('report.evidence.formsHole', { rep, n: num(weakest.got), of: num(weakest.seen) })
        : t('report.evidence.formsOk', { rep, n: num(weakest.got), of: num(weakest.seen) });
      return {
        id: 'forms',
        met: holes.length ? 'no' : solid === seen.length ? 'met' : 'part',
        value: `${num(solid)}/${num(seen.length)}`,
        detail,
      };
    }

    function unevidenced(rowId) {
      return {
        id: rowId,
        met: 'old',
        value: t('report.evidence.noReceipt'),
        detail: t('report.evidence.noReceiptNote'),
      };
    }
  }

  /**
   * The sentence that closes the argument: how many unassisted items this claim
   * rests on, beside how many questions were asked on this line *before it was
   * granted*. Six over four is what a curriculum director noticed; three over
   * three is what a clean sight-read actually does.
   *
   * The denominator used to be the lifetime total, which is the wrong number in
   * a way that always flattered the wrong side: nine enrichment items answered
   * on a line already held made a three-item claim read as though twelve
   * questions had gone into it. A claim can only rest on what came before it.
   * What came after is on the next line, named as what it is.
   */
  function claimSum(id) {
    const s = mastery.get(id);
    const asked = tracker.itemsFor(id);
    if (!s.mastered) return null;
    if (!s.provenBy) return t('report.evidence.restsUnknown', { of: num(asked) });
    const split = tracker.claimSplit(id);
    if (!split) return t('report.evidence.rests', { n: num(s.provenBy.items), of: num(asked) });
    return t('report.evidence.restsSplit', { n: num(s.provenBy.items), of: num(split.before) });
  }

  /** What has happened on this line since the claim, which is not evidence for it. */
  function sinceClaim(id) {
    const split = tracker.claimSplit(id);
    if (!split) return null;
    return split.since
      ? t('report.evidence.sinceClaim', {
        n: split.since,
        pct: split.unaidedSince == null ? UNMEASURED : pct(split.unaidedSince),
      })
      : t('report.evidence.sinceNone');
  }

  function repsOf(id) {
    const s = mastery.get(id);
    return REPS.filter((r) => (s.repsCorrect[r] || 0) > 0);
  }

  function nextObjective() {
    const nx = mastery.next();
    if (!nx) return null;
    const s = mastery.get(nx.id);
    const why = nx.kind === 'review' ? 'review'
      : nx.kind === 'check' ? 'check'
        : nx.kind === 'enrich' ? 'enrich'
          : s.attempts === 0 ? 'fresh' : 'continue';
    // How many unassisted items this learner's run actually has left. The card
    // used to say "three clean answers" in every case, which is the gate's
    // default quoting itself: a run that has absorbed a miss, or extended
    // itself to span a second surface, needs more than three and the same
    // screen said so two inches lower. One number, read off the live run.
    const left = s.check ? Math.max(0, (s.check.need || 0) - (s.check.done || 0)) : null;
    return { id: nx.id, kind: nx.kind, why, left };
  }

  // -------------------------------------------------------------------------
  // Painting
  // -------------------------------------------------------------------------
  function render() {
    q('.rp-h').textContent = t('report.title');
    q('.rp-sub').textContent = t('report.sub');
    q('.rp-x').textContent = t('report.close');
    q('.rp-x').setAttribute('aria-label', t('report.close'));
    q('.rp-teacher').textContent = t('report.record.open');
    q('.rp-teacher').title = t('report.record.openHint');
    q('.rp-h-skills').textContent = t('report.skillsHead');
    q('.rp-h-cover').textContent = t('report.std.cover.head');
    q('.rp-cover-sub').textContent = t('report.std.cover.sub');
    q('.rp-h-record').textContent = t('report.recordHead');
    q('.rp-recsub').textContent = t('report.recordSub');
    q('.rp-foot').textContent = t('report.foot');

    frame.relabel();
    renderStrip();
    renderNext();
    renderSkills();
    renderCoverage();
    renderTrust();
    renderStats();
  }

  // -------------------------------------------------------------------------
  // Standards coverage
  //
  // The report turned the other way up. Above this a row is one of our skills;
  // here a row is one expectation in the framework the teacher picked, and our
  // skills are the evidence underneath it. Rows are grouped by how much
  // evidence there is, strongest group first, because the two questions a
  // teacher opens this for are "what can I sign off?" and "what has this child
  // never touched?" — and both are answered by which group a code is in.
  // -------------------------------------------------------------------------
  function renderCoverage() {
    const cov = coverage();
    renderCoverStrip(cov);

    const host = q('.rp-cover');
    host.innerHTML = '';
    for (const key of COVERS) {
      const rows = cov.rows.filter((r) => r.cover === key);
      const grp = document.createElement('section');
      grp.className = `rp-cgrp c-${key}`;
      const head = document.createElement('h4');
      head.className = 'rp-cgrp-h';
      const nameEl = document.createElement('b');
      nameEl.textContent = t('report.std.cover.group.' + key);
      const countEl = document.createElement('i');
      countEl.textContent = num(rows.length);
      head.append(nameEl, countEl);
      const note = document.createElement('p');
      note.className = 'rp-cgrp-note';
      note.textContent = rows.length
        ? t('report.std.cover.groupNote.' + key)
        : t('report.std.cover.empty');
      grp.append(head, note);
      for (const row of rows) grp.appendChild(coverRow(row));
      host.appendChild(grp);
    }
  }

  /** The three figures that answer the whole section before it is read. */
  function renderCoverStrip(cov) {
    const host = q('.rp-cover-strip');
    host.innerHTML = '';
    const tot = cov.totals;
    for (const [big, small, lab, tone] of [
      [num(tot.evidenced), t('report.std.cover.ofN', { n: tot.total }), t('report.std.cover.evidenced'), ''],
      [num(tot.coreHeld), t('report.std.cover.ofN', { n: tot.coreTotal }), t('report.std.cover.core'), 'good'],
      [num(tot.none), '', t('report.std.cover.untouched'), tot.none ? 'warn' : ''],
    ]) {
      const d = document.createElement('div');
      d.className = `rp-strip-i${tone ? ' t-' + tone : ''}`;
      d.innerHTML = '<b></b><i></i><span></span>';
      d.querySelector('b').textContent = big;
      d.querySelector('i').textContent = small;
      d.querySelector('span').textContent = lab;
      host.appendChild(d);
    }
  }

  function coverRow(row) {
    const art = document.createElement('article');
    art.className = 'rp-cstd';
    art.dataset.cover = row.cover;
    art.dataset.depth = row.depth || 'unknown';
    // The two numbers the row prints in words, as numbers. A row whose
    // denominator is ZERO is the exact shape of the defect this section was
    // rewritten for: Level 2 and Level 3 printing Level 1's twenty-three
    // expectations, every one of them reading "lines held 0 of 0", because the
    // rows came from an imported file and the lines came from the running
    // graph. `tools/check-record.mjs` fails on a zero denominator.
    art.dataset.lines = String(row.totalLines);
    art.dataset.held = String(row.heldLines);
    const isOpen = stdOpen.has(row.code);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rp-crow';
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.setAttribute('aria-label', t('report.std.cover.openRow', { code: row.short }));
    const code = document.createElement('code');
    code.className = 'rp-ccode';
    code.textContent = row.short;
    const dep = document.createElement('span');
    dep.className = 'rp-cdepth';
    dep.textContent = t('report.std.depth.' + (DEPTHS.includes(row.depth) ? row.depth : 'unknown'));
    dep.title = t('report.std.depthNote.' + (DEPTHS.includes(row.depth) ? row.depth : 'unknown'));
    const lines = document.createElement('span');
    lines.className = 'rp-clines';
    lines.textContent = t('report.std.cover.linesHeld', { n: num(row.heldLines), of: num(row.totalLines) });
    const caret = document.createElement('span');
    caret.className = 'rp-caret';
    caret.setAttribute('aria-hidden', 'true');
    btn.append(code, dep, lines);
    // The thinnest kind of true claim, on the closed row: every line behind
    // this expectation was proved on first sight. A teacher scanning twenty
    // codes should find those without opening one.
    if (row.thin) {
      const flag = document.createElement('span');
      flag.className = 'rp-cthin';
      flag.textContent = t('report.road.sight');
      flag.title = t('report.std.cover.thin');
      btn.appendChild(flag);
    }
    btn.appendChild(caret);

    const det = document.createElement('div');
    det.className = 'rp-cdetail';
    det.hidden = !isOpen;
    btn.addEventListener('click', () => {
      const now = !stdOpen.has(row.code);
      if (now) stdOpen.add(row.code); else stdOpen.delete(row.code);
      btn.setAttribute('aria-expanded', String(now));
      det.hidden = !now;
      if (now && !det.childElementCount) fillCover(det, row);
    });
    if (isOpen) fillCover(det, row);
    art.append(btn, det);
    return art;
  }

  function fillCover(host, row) {
    host.innerHTML = '';

    // --- what the standard asks -------------------------------------------
    host.appendChild(h4(t('report.std.cover.textHead')));
    const quote = document.createElement('p');
    quote.className = 'rp-cquote';
    // The expectation, word for word. It is a legal quotation of a US standard,
    // so it stays in English in every locale and is labelled as a quotation
    // rather than passed off as our own prose — TEKS and Common Core have no
    // official Spanish or Polish text, and inventing one would be a worse lie
    // than the language mismatch.
    quote.textContent = row.text;
    quote.lang = 'en';
    host.appendChild(quote);
    if (row.citation) {
      const cite = document.createElement('p');
      cite.className = 'rp-cquote-note';
      cite.textContent = row.citation;
      host.appendChild(cite);
    }
    const src = document.createElement('p');
    src.className = 'rp-cquote-note';
    src.textContent = t('report.std.cover.textNote');
    host.appendChild(src);

    // --- the lines that carry it ------------------------------------------
    host.appendChild(h4(t('report.std.cover.linesHead')));
    const ul = document.createElement('ul');
    ul.className = 'rp-clist';
    for (const line of row.lines) {
      const li = document.createElement('li');
      li.dataset.state = line.state;
      const nm = document.createElement('b');
      nm.textContent = t('skills.' + line.id);
      const dp = document.createElement('em');
      dp.textContent = t('report.std.depth.' + (DEPTHS.includes(line.depth) ? line.depth : 'unknown'));
      dp.title = t('report.std.depthNote.' + (DEPTHS.includes(line.depth) ? line.depth : 'unknown'));
      const st = document.createElement('i');
      st.textContent = t('report.state.' + line.state);
      li.append(nm, dp, st);
      ul.appendChild(li);
    }
    host.appendChild(ul);

    // --- what this learner actually did -----------------------------------
    host.appendChild(h4(t('report.std.cover.evHead')));
    if (!row.answers) {
      const none = document.createElement('p');
      none.className = 'rp-cnone';
      none.textContent = t('report.std.cover.noneYet');
      host.appendChild(none);
    } else {
      const dl = document.createElement('dl');
      dl.className = 'rp-facts';
      for (const [k, v, tip] of [
        [t('report.std.cover.forms'),
          t('report.std.cover.formsVal', { n: num(row.formsMet), of: num(row.formsDeclared) }),
          t('report.std.cover.formsNote', { n: num(row.formsMet), of: num(row.formsDeclared) })],
        [t('report.std.cover.answers'), num(row.answers), ''],
        [t('report.std.cover.unaided'), num(row.unaided), t('report.std.cover.unaidedNote')],
      ]) {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        if (tip) { dt.title = tip; dd.title = tip; }
        dl.append(dt, dd);
      }
      host.appendChild(dl);
      const note = document.createElement('p');
      note.className = 'rp-cnote';
      note.textContent = t('report.std.cover.unaidedNote');
      host.appendChild(note);
    }

    for (const [flag, key] of [
      [row.cover === 'indirect', 'indirectNote'],
      [row.thin, 'thin'],
      [row.unevidenced, 'unevidenced'],
    ]) {
      if (!flag) continue;
      const warn = document.createElement('p');
      warn.className = 'rp-cwarn';
      warn.textContent = t('report.std.cover.' + key);
      host.appendChild(warn);
    }
  }

  function h4(text) {
    const e = document.createElement('h4');
    e.className = 'rp-h4';
    e.textContent = text;
    return e;
  }

  /**
   * The two facts the learner came for, on one line, above everything else.
   * Deliberately not a tile grid: on a phone a grid of six is a whole screen,
   * and this has to leave room for what is next.
   */
  function renderStrip() {
    const host = q('.rp-strip');
    host.innerHTML = '';
    /* THE ONE PROGRESS NUMBER LEADS THE REPORT, because it is the number the
       learner has been looking at all session and this is the surface where
       they come to check it. It is read from `repaired()` — the same function
       `hudState()` in src/main.js draws the rig from — so opening the report
       cannot produce a different answer from the one on the glass behind it.
       Everything else here is EVIDENCE: it is what the claim is made of, it is
       what a teacher checks, and it is on a surface a learner opened on purpose.
       See src/meta/progress.js. */
    const rep = repaired(mastery);
    const { held: done, total } = linesHeld(mastery);
    /* THE ONE SESSION CLOCK (src/session/clock.js), monotonic, matching the
       wall. It used to be a subtraction against a start time this file's own
       ledger was allowed to move, and a critic watched it read 4 → 7 → 9 → 1 →
       5 minutes across one unbroken sitting. Declared, in whole minutes, so
       `oneclock.mjs` can sample it against every other clock on the glass in
       one frame and against itself over a whole session. The capped,
       answer-to-answer figure is "time on task" in the record below and is
       deliberately a different tile carrying a different fact. */
    const sess = duration(tracker.sessionMs());
    /* DECLARED IN SECONDS, PRINTED IN WHATEVER READS BEST. The tile says
       "11 sec" under a minute and "18 min" over it; a declaration in minutes
       would have read 0 under the first of those, and a gate comparing the tag
       to the glass would be comparing two different units. Seconds is the
       finest thing any of these surfaces prints, so it is the one they can all
       be checked in. */
    const sessSec = Math.round(tracker.sessionMs() / 1000);
    for (const [big, small, lab, tone, tip, fig, figV] of [
      [pct(rep.frac), '', t('hud.mastery'), 'good', t('report.stat.repairedNote'), FIG.REPAIRED, rep.pct],
      [num(done), t('report.stat.ofN', { n: total }), t('report.stat.mastered'), '', t('report.stat.masteredNote'), FIG.LINES_HELD, done],
      [sess.big, sess.small, t('report.stat.session'), '', t('report.stat.sessionNote'), FIG.SESSION_TIME, sessSec],
    ]) {
      const d = document.createElement('div');
      d.className = `rp-strip-i${tone ? ' t-' + tone : ''}`;
      d.innerHTML = '<b></b><i></i><span></span>';
      d.querySelector('b').textContent = big;
      d.querySelector('i').textContent = small;
      d.querySelector('span').textContent = lab;
      d.title = tip;
      if (fig) tagFigure(d, fig, figV);
      host.appendChild(d);
    }
  }

  /**
   * Whether the two stores that make up this record agree with each other.
   *
   * The learner model and the evidence ledger are separate keys in local
   * storage, and on a shared Chromebook profile one can come back without the
   * other. That used to fail open — the report printed "lines held 4" beside
   * "questions answered 0" and said nothing — which is the worst possible
   * direction for it to fail in, because the half that goes missing is the half
   * that could have contradicted the claims. It now fails closed and says so
   * here, above the figures it affects.
   */
  function renderTrust() {
    const host = q('.rp-trust');
    host.innerHTML = '';
    const tr = tracker.trust();
    if (!tr || tr.level === 'verified') return;
    const box = document.createElement('div');
    box.className = `rp-warn t-${tr.level}`;
    box.setAttribute('role', 'status');
    box.innerHTML = '<b></b><span></span>';
    box.querySelector('b').textContent = t('report.trust.head.' + tr.level);
    box.querySelector('span').textContent = t('report.trust.note.' + tr.level, {
      n: num(tr.rebuiltItems || 0), claims: num(tr.rebuiltClaims || 0),
    });
    host.appendChild(box);
  }

  function renderStats() {
    const host = q('.rp-stats');
    host.innerHTML = '';
    // One definition of the progress number, shared with the strip above and
    // with every other surface in the game. See src/meta/progress.js.
    const { held: done, total } = linesHeld(mastery);
    const acc = tracker.accuracy();
    const hollow = tracker.hollowRate();
    const msOk = tracker.msTrusted();
    const sight = graph.nodes.filter((n) => mastery.get(n.id).mastered
      && mastery.get(n.id).provenBy?.road === 'sight').length;
    // Read defensively: src/meta owns this ledger and a report opened before
    // the story has booted must print no tile rather than a zero.
    let tearsAll = null;
    try { const v = sealed(); tearsAll = Number.isFinite(v) ? v : null; } catch { tearsAll = null; }

    const tiles = [
      {
        id: 'mastered', tone: 'good', fig: FIG.LINES_HELD, figV: done,
        big: `${num(done)}`, small: t('report.stat.ofN', { n: total }),
        lab: t('report.stat.mastered'),
        note: t('report.stat.masteredNote'),
      },
      {
        /* TIME ON TASK, AND THE SCOPE IN THE NOUN.
           A cold critic read "TIME ON TASK 7 min" here at the same instant the
           strip above said "5 min THIS SESSION" and called the pair a
           contradiction — correctly, on the words that were on the glass. This
           tile is a LIFETIME total and the strip is one sitting, which is the
           same trap "Questions answered in all" was pulled out of two passes
           ago and the same fix: the scope is part of the name, not a footnote
           in a tooltip. Declared as its own fact, so the gate compares it
           against the session clock rather than to it. */
        id: 'time', fig: FIG.TASK_TIME,
        // Seconds, for the same reason the session tile is. See `renderStrip`.
        figV: msOk ? Math.round(tracker.totalMs() / 1000) : '',
        big: msOk ? duration(tracker.totalMs()).big : UNMEASURED,
        small: msOk ? duration(tracker.totalMs()).small : '',
        lab: t('report.stat.timeAll'),
        note: msOk ? t('report.stat.timeAllNote') : t('report.stat.timeUnknown'),
      },
      {
        id: 'items', fig: FIG.ALL_ITEMS, figV: tracker.items(),
        big: num(tracker.items()), small: '',
        lab: t('report.stat.items'),
        note: t('report.stat.itemsNote'),
      },
      // RIFTS SEALED IN ALL — filled, numbered, and on the surface where the
      // scope in its name is true. See the `sealed` parameter at the top.
      ...(tearsAll == null ? [] : [{
        id: 'sealed', fig: FIG.ALL_SEALED, figV: tearsAll,
        big: num(tearsAll), small: '',
        lab: t('report.stat.sealed'),
        note: t('report.stat.sealedNote'),
      }]),
      {
        id: 'accuracy',
        big: acc == null ? UNMEASURED : pct(acc), small: '',
        lab: t('report.stat.accuracy'),
        note: acc == null ? t('report.stat.accuracyUnknown') : t('report.stat.accuracyNote'),
      },
      {
        // The thinnest claims this record contains, counted rather than
        // implied. mastery.js flags them; until now nothing read the flag.
        id: 'sight', tone: '',
        big: num(sight), small: done ? t('report.stat.ofHeld', { n: done }) : '',
        lab: t('report.stat.sight'),
        note: sight ? t('report.stat.sightNote') : t('report.stat.sightNone'),
      },
      {
        id: 'hollow', tone: hollow == null ? '' : hollow > 0 ? 'warn' : 'good',
        big: hollow == null ? UNMEASURED : pct(hollow), small: '',
        lab: t('report.stat.hollow'),
        note: hollow == null
          ? t('report.stat.hollowNone')
          : t('report.stat.hollowNote', { n: tracker.withdrawn(), of: tracker.granted() }),
      },
    ];

    for (const tile of tiles) {
      const d = document.createElement('div');
      d.className = `rp-tile${tile.tone ? ' t-' + tile.tone : ''}`;
      d.innerHTML = '<span class="rp-t-lab"></span>'
        + '<span class="rp-t-val"><b></b><i></i></span>'
        + '<span class="rp-t-note"></span>';
      d.querySelector('.rp-t-lab').textContent = tile.lab;
      d.querySelector('.rp-t-val b').textContent = tile.big;
      d.querySelector('.rp-t-val i').textContent = tile.small;
      d.querySelector('.rp-t-note').textContent = tile.note;
      /* Two of these tiles are figures the rest of the game also prints, and
         they are the two the cold critic caught disagreeing with it: LINES HELD
         is THE progress number and must equal the objective card's, and
         QUESTIONS ANSWERED IN ALL is a lifetime total that must not be read as
         the run band's questions-this-run. Tagging the whole tile hands the
         gate the value and the words together. */
      if (tile.fig) tagFigure(d, tile.fig, tile.figV);
      host.appendChild(d);
    }
  }

  function renderNext() {
    const host = q('.rp-next');
    host.innerHTML = '';
    const nx = nextObjective();
    const card = document.createElement('div');
    card.className = 'rp-nx';
    if (!nx) {
      card.innerHTML = '<span class="rp-nx-lab"></span><b class="rp-nx-name"></b><p class="rp-nx-why"></p>';
      card.querySelector('.rp-nx-lab').textContent = t('report.next.head');
      card.querySelector('.rp-nx-name').textContent = t('report.next.doneName');
      card.querySelector('.rp-nx-why').textContent = t('report.next.doneWhy');
      host.appendChild(card);
      return;
    }
    const locked = allPrereqs(graph, nx.id).size;
    card.innerHTML = '<span class="rp-nx-lab"></span><b class="rp-nx-name"></b>'
      + '<p class="rp-nx-why"></p><p class="rp-nx-path"></p>';
    card.querySelector('.rp-nx-lab').textContent = t('report.next.head');
    card.querySelector('.rp-nx-name').textContent = t('skills.' + nx.id);
    card.querySelector('.rp-nx-why').textContent = nx.why === 'check' && nx.left
      ? t('report.next.why.checkLeft', { n: nx.left })
      : t('report.next.why.' + nx.why);
    card.querySelector('.rp-nx-path').textContent = locked
      ? t('report.next.built', { n: locked })
      : t('report.next.start');
    host.appendChild(card);
  }

  /**
   * THE WORDS ON THE ROWS, DEFINED UNDER THE ROWS.
   *
   * A cold critic read a Progress row and could not tell what any of it claimed:
   * HELD, PROVING, SLIPPING, REOPENED, TESTED OUT and GROUND REOPENED were six
   * coined labels with nothing on the screen that said what they meant. Every
   * one of them had a sentence already written — it was in a `title` attribute,
   * which is not on screen, does not exist on a phone, and is not something a
   * fourteen-year-old has ever discovered.
   *
   * So the sentences come out of the tooltips and onto the page. The legend
   * lists ONLY the words that are on the rows right now, in row order: a first
   * report shows two lines, and each new word gets defined on the first report
   * that prints it. That is the whole rule — a word arrives with its meaning,
   * once, where it lands. Nothing is listed in advance, because a glossary of
   * states a learner has never reached is the same wall of vocabulary this is
   * here to remove.
   */
  const STATE_ORDER = ['open', 'practising', 'proving', 'mastered', 'provisional', 'withdrawn', 'locked'];
  const ROAD_ORDER = ['sight', 'fast', 'long'];

  function renderLegend(states, roads, under, measured) {
    const host = q('.rp-legend');
    host.innerHTML = '';
    const rows = [];
    /* WHAT THE PERCENTAGE IS, said on the page, the first time one is printed.
       The figure on a row is now the lowest thing measured on that line — the
       weakest question type, the record at the hardest band, or the model's own
       confidence, whichever is smallest (src/report/index.js `floorOf`). That is
       the correction of a screen that printed the largest of them and read 99%
       over a question type standing at never once solved.
       It has to be said out loud, and this is where. A held line whose weakest
       type is running at a third reads HELD and 33%, and those two are only a
       contradiction while nobody has told the reader what the number counts.
       With this line they are one sentence: proved, and here is where to go
       next. Without it, a cold reader is right to file it. */
    if (measured) rows.push([t('report.pctTerm'), t('report.pctIs'), 'r-floor']);
    for (const s of STATE_ORDER) if (states.has(s)) rows.push([t('report.state.' + s), t('report.stateNote.' + s), 's-' + s]);
    for (const r of ROAD_ORDER) if (roads.has(r)) rows.push([t('report.road.' + r), t('report.roadIs.' + r), 'r-' + r]);
    if (under) rows.push([t('report.flag.under'), t('report.flagIs.under'), 'r-under']);
    for (const [term, means, cls] of rows) {
      const box = document.createElement('div');
      box.className = 'rp-leg ' + cls;
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = means;
      box.append(dt, dd);
      host.appendChild(box);
    }
    host.hidden = !rows.length;
  }

  function renderSkills() {
    const host = q('.rp-skills');
    host.innerHTML = '';
    const states = new Set();
    const roads = new Set();
    let anyUnder = false;
    let anyMeasured = false;
    for (const n of graph.nodes) {
      const s = mastery.get(n.id);
      const st = stateOf(n.id);
      const art = document.createElement('article');
      art.className = 'rp-skill';
      art.dataset.state = st;

      const isOpen = expanded.has(n.id);
      art.innerHTML = `<button class="rp-row" type="button" aria-expanded="${isOpen}">
          <span class="rp-pip" aria-hidden="true"></span>
          <span class="rp-name"></span>
          <span class="rp-flags"><span class="rp-tag"></span></span>
          <span class="rp-bar"><i></i></span>
          <span class="rp-pct"></span>
          <span class="rp-caret" aria-hidden="true"></span>
        </button>
        <div class="rp-detail"${isOpen ? '' : ' hidden'}></div>`;

      art.querySelector('.rp-name').textContent = t('skills.' + n.id);
      art.querySelector('.rp-tag').textContent = t('report.state.' + st);
      states.add(st);
      /* The road, on the closed row. mastery.js has flagged a claim granted off
         the cold sight-read since the sight-read shipped, with a comment saying
         a teacher-facing view could say so; no view ever did, so the thinnest
         claim in the record looked exactly like the thickest.

         A SKILL CANNOT BE BOTH. A cold critic photographed one row reading
         "Reading a variable — SLIPPING — TESTED OUT — 95%" and filed it as a
         contradiction, and it is one. Both halves were true and they are not
         about the same moment: SLIPPING is where the claim stands right now,
         TESTED OUT is how it was granted, weeks ago. On one line, at a glance,
         a badge with no tense reads as present tense — so it says a line is
         proved and slipping in the same breath.

         The road badge is therefore printed only while the claim is actually
         standing. Nothing is hidden: on a slipping or withdrawn line the road
         is still reported, in the past tense and with its date, inside the
         detail this row opens — which is where a teacher asking "how was this
         granted?" is already looking, and where there is room to answer. */
      if (st === 'mastered' && s.provenBy?.road) {
        const road = document.createElement('span');
        road.className = `rp-road r-${s.provenBy.road}`;
        road.textContent = t('report.road.' + s.provenBy.road);
        road.title = t('report.roadNote.' + s.provenBy.road);
        art.querySelector('.rp-flags').appendChild(road);
        roads.add(s.provenBy.road);
      }
      // Held, on ground that has reopened underneath. See `underReopened`.
      if (underReopened(n.id)) {
        const flag = document.createElement('span');
        flag.className = 'rp-road r-under';
        flag.textContent = t('report.flag.under');
        flag.title = t('report.flagNote.under');
        art.querySelector('.rp-flags').appendChild(flag);
        anyUnder = true;
      }
      // THE BAR AND THE NUMBER ONLY EXIST IF SOMETHING WAS MEASURED.
      //
      // A locked line has always read `—`. An *unlocked and untouched* line read
      // the model's opening belief — seeded from the lines underneath it — as a
      // percentage, so the report printed "Evaluating expressions · OPEN · 80%"
      // for a skill with zero attempts, on the same screen as the card naming it
      // as new ground. Eighty per cent of nothing was measured. It is a plan for
      // which band to open at, and it is not this learner's standing on this
      // line, so it does not get this learner's bar.
      //
      // …AND THE FIGURE IS THE FLOOR, NOT THE POSTERIOR. See `floorOf`: the
      // three numbers this screen used to be able to print about one line could
      // disagree, and the one it printed was always the most flattering. The
      // bar and the percentage are now the same lower bound, so they cannot
      // come apart from each other either.
      const measured = st !== 'locked' && s.attempts > 0;
      if (measured) anyMeasured = true;
      const c = mastery.confidence(n.id, { plan: planFor(n.id) });
      art.dataset.measured = String(measured);
      art.querySelector('.rp-bar i').style.width = measured ? `${Math.round(c.floor * 100)}%` : '0%';
      art.querySelector('.rp-pct').textContent = measured ? conf(c.floor) : UNMEASURED;
      const row = art.querySelector('.rp-row');
      row.title = measured
        ? t('report.rowTitle', {
          state: t('report.stateNote.' + st),
          why: t('report.evidence.floorWhy.' + c.why),
        })
        : t('report.evidence.posteriorNone');
      row.addEventListener('click', () => {
        const nowOpen = !expanded.has(n.id);
        if (nowOpen) expanded.add(n.id); else expanded.delete(n.id);
        row.setAttribute('aria-expanded', String(nowOpen));
        const det = art.querySelector('.rp-detail');
        det.hidden = !nowOpen;
        if (nowOpen && !det.childElementCount) fillDetail(det, n);
      });
      if (isOpen) fillDetail(art.querySelector('.rp-detail'), n);
      host.appendChild(art);
    }
    renderLegend(states, roads, anyUnder, anyMeasured);
  }

  function fillDetail(host, n) {
    host.innerHTML = '';
    const s = mastery.get(n.id);

    const idea = document.createElement('p');
    idea.className = 'rp-idea';
    idea.textContent = t('report.idea.' + n.id);
    host.appendChild(idea);

    // --- the five conditions ---------------------------------------------
    const evHead = document.createElement('h4');
    evHead.className = 'rp-h4';
    evHead.textContent = t('report.evidence.head');
    host.appendChild(evHead);

    const list = document.createElement('ul');
    list.className = 'rp-ev';
    for (const e of evidenceOf(n.id)) {
      const li = document.createElement('li');
      li.className = `rp-ev-row m-${e.met}`;
      li.innerHTML = '<span class="rp-ev-mark" aria-hidden="true"></span>'
        + '<span class="rp-ev-lab"></span><span class="rp-ev-val"></span>'
        + '<span class="rp-ev-note"></span>';
      li.querySelector('.rp-ev-lab').textContent = t('report.evidence.' + e.id);
      li.querySelector('.rp-ev-val').textContent = e.value;
      li.querySelector('.rp-ev-note').textContent = e.detail;
      li.querySelector('.rp-ev-mark').textContent = e.met === 'met' ? '✓' : e.met === 'part' ? '·' : '';
      list.appendChild(li);
    }
    host.appendChild(list);

    // The arithmetic, out loud. This is the line the whole rewrite exists for:
    // whatever the five rows above say, they now have to add up to a number
    // that can be laid beside "questions here" without embarrassing anyone.
    const sum = claimSum(n.id);
    if (sum) {
      const p = document.createElement('p');
      p.className = 'rp-ev-sum';
      p.textContent = sum;
      if (s.provenBy?.at) {
        const when = document.createElement('span');
        when.className = 'rp-ev-when';
        when.textContent = t('report.evidence.grantedOn', { date: dateText(s.provenBy.at) });
        p.appendChild(when);
      }
      host.appendChild(p);
      // …and what happened here afterwards, in its own sentence, so that a
      // lifetime question count can never again be read as evidence for a claim
      // that was granted before most of it existed.
      const since = sinceClaim(n.id);
      if (since) {
        const p2 = document.createElement('p');
        p2.className = 'rp-ev-since';
        p2.textContent = since;
        host.appendChild(p2);
      }
    }

    // --- the working numbers ---------------------------------------------
    const facts = document.createElement('dl');
    facts.className = 'rp-facts';
    const acc = tracker.accuracyFor(n.id);
    const reps = repsOf(n.id);
    const formsMet = Object.keys(s.formsSeen || {}).length;
    // On a record that was restored without its ledger these two were measured
    // by nobody, and "0 sec / not yet" would read as a fact about the learner.
    const measured = tracker.msTrusted();
    // Nothing has been asked on this line. Every row below that describes the
    // learner has to say so rather than print the setting it would have used —
    // "Band 1 of 5" on an untouched line is where practice *would* open, and it
    // reads as where this learner *is*.
    const asked = tracker.itemsFor(n.id);
    const touched = s.attempts > 0;
    const split = tracker.claimSplit(n.id);
    const right = tracker.unaidedRightFor(n.id);
    const rows = [
      [t('report.fact.time'), measured ? duration(tracker.msFor(n.id)).full : t('report.record.notMeasured')],
      // The one number a reader was laying beside the claim, now carrying the
      // only thing that made it readable: which side of the claim it fell on.
      // The split is only printed when there are two sides to it — a claim with
      // nothing after it reads "3", not "3 — 3 before the claim, 0 since",
      // which is a sentence about a distinction that does not exist here.
      [t('report.fact.items'), split && split.since
        ? t('report.fact.itemsSplit', { n: num(asked), before: num(split.before), since: num(split.since) })
        : num(asked)],
      [t('report.fact.accuracy'), acc == null
        ? (measured ? t('report.fact.noneYet') : t('report.record.notMeasured'))
        : split && split.since && split.unaidedSince != null
          ? t('report.fact.accuracySplit', {
            all: pct(acc),
            n: num(right),
            of: num(asked),
            before: split.unaidedBefore == null ? UNMEASURED : pct(split.unaidedBefore),
            since: pct(split.unaidedSince),
          })
          : t('report.fact.accuracyOf', { all: pct(acc), n: num(right), of: num(asked) })],
      // BAND WAS A NUMBER WITH NO UNIT. "Band 3 of 5" was printed here, on the
      // orders card, on the close card and six times in the evidence rows, and
      // nothing anywhere said what a band is. The third element of a row is the
      // one line that says — printed under the value, not hidden in a `title`.
      [t('report.fact.band'), touched ? t('report.fact.bandVal', { n: s.difficulty }) : UNMEASURED,
        touched ? t('report.fact.bandIs') : ''],
      [t('report.fact.reps'), reps.length
        ? reps.map((r) => t('report.rep.' + r)).join(', ')
        : t('report.fact.noneYet')],
      [t('report.fact.forms'), t('report.fact.formsVal', { n: formsMet })],
      [t('report.fact.slip'), slipLabel(n)],
    ];
    for (const [k, v, note] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      if (note) {
        const em = document.createElement('em');
        em.className = 'rp-fact-note';
        em.textContent = note;
        dd.appendChild(em);
      }
      facts.append(dt, dd);
    }
    host.appendChild(facts);

    // --- what this skill is alignment for --------------------------------
    const stdHead = document.createElement('h4');
    stdHead.className = 'rp-h4';
    stdHead.textContent = t('report.std.head');
    host.appendChild(stdHead);

    const std = document.createElement('div');
    std.className = 'rp-std';
    // Depth is rendered, in words, on every chip in both frameworks.
    //
    // content/STANDARDS.md is careful about this and the screen was not: it
    // printed `TEKS 7.7, A.12(B)` beside "HELD 100%" with nothing to say that
    // on this line one is *supporting* and the other is a deliberately partial
    // first encounter, and it gave Common Core chips no depth at all. An
    // alignment claim whose depth is invisible reads as core, which is a
    // stronger claim than the one the working papers make.
    // One framework at a time, and it is the one the teacher chose. Printing
    // both at once means a Texas reader scans past Common Core codes to find
    // theirs, and a Common Core reader does the same in reverse. The switch is
    // one click and it is at the top of the coverage section.
    const fw = getFramework();
    const counts = { core: 0, total: 0 };
    // `alignmentOf` reads both graph shapes. Reading `n.teks` / `n.standards`
    // directly, as this did, printed nothing at all on every unit after
    // Level 1 — those units align through the unified `alignment` array.
    const want = fw === 'teks' ? 'TEKS' : 'CCSS-M';
    const chips = alignmentOf(n)
      .filter((x) => x.framework === want)
      .map((x) => ({
        code: shortCode(x.code),
        title: [x.citation, x.text].filter(Boolean).join('\n'),
        // The graph copy of a citation carries no caveat — the standards record
        // is where that prose lives, and it is translated there.
        caveat: caveatFor(fw, x.code),
        depth: depthOf(fw, n.id, x.code) || x.depth,
      }));
    const grp = document.createElement('div');
    grp.className = `rp-std-grp g-${fw}`;
    const lab = document.createElement('span');
    lab.className = 'rp-std-lab';
    lab.textContent = t('report.std.' + fw);
    grp.appendChild(lab);
    for (const row of chips) {
      const depth = DEPTHS.includes(row.depth) ? row.depth : 'unknown';
      counts.total += 1;
      if (depth === 'core') counts.core += 1;
      const chip = document.createElement('code');
      chip.className = 'rp-chip';
      chip.dataset.depth = depth;
      const code = document.createElement('span');
      code.textContent = row.code;
      const dep = document.createElement('i');
      dep.textContent = t('report.std.depth.' + depth);
      chip.append(code, dep);
      chip.title = [row.title, row.caveat, t('report.std.depthNote.' + depth)]
        .filter(Boolean).join('\n\n');
      grp.appendChild(chip);
    }
    std.appendChild(grp);
    host.appendChild(std);

    const depthLine = document.createElement('p');
    depthLine.className = 'rp-std-sum';
    depthLine.textContent = counts.core
      ? t('report.std.depthSum', { n: num(counts.core), of: num(counts.total) })
      : t('report.std.depthNoCore', { of: num(counts.total) });
    host.appendChild(depthLine);
  }

  /**
   * The misconception this learner keeps returning to, said in their language.
   *
   * The knowledge graph's own description of a misconception is a design note
   * written in English for the people building the bank; it is not a sentence
   * to put in front of a Polish fourteen-year-old or their teacher. The report
   * looks the id up in the bundle and falls back to nothing rather than to
   * English prose.
   */
  function slipLabel(n) {
    const id = mastery.topMisconception(n.id);
    if (!id) return t('report.fact.noSlip');
    const label = t('report.slip.' + id);
    return label === 'report.slip.' + id ? t('report.fact.noSlip') : label;
  }

  return {
    get open() { return open.value; },
    show, close, toggle,
    tracker,
    teacher,
    /** Everything the report shows, as data — for critics and for exports. */
    snapshot() {
      const cov = coverage();
      return {
        locale: getLocale(),
        framework: cov.framework,
        // Which lattice this report is about. A critic comparing the printed
        // codes against a unit's graph needs to know which unit was open, and
        // the answer used to be "Level 1, whatever you loaded".
        units: unitIdsOf(graph),
        level: unitTitle(graph),
        // Standard-level coverage, as data: a critic can compare what the
        // screen printed against what the learner model actually holds.
        coverage: {
          totals: cov.totals,
          rows: cov.rows.map((r) => ({
            code: r.short, depth: r.depth, cover: r.cover, thin: r.thin,
            heldLines: r.heldLines, totalLines: r.totalLines,
            formsMet: r.formsMet, formsDeclared: r.formsDeclared, basis: r.basis,
            answers: r.answers, unaided: r.unaided,
            lines: r.lines.map((l) => ({ id: l.id, depth: l.depth, state: l.state })),
          })),
        },
        mastered: graph.nodes.filter((n) => mastery.get(n.id).mastered).length,
        total: graph.nodes.length,
        totalMs: tracker.totalMs(),
        // The two session clocks, apart and named — so a critic can check that
        // the one on the strip is the wall clock and not the other one.
        sessionMs: tracker.sessionMs(),
        sessionTaskMs: tracker.sessionTaskMs(),
        items: tracker.items(),
        accuracy: tracker.accuracy(),
        granted: tracker.granted(),
        withdrawn: tracker.withdrawn(),
        hollowRate: tracker.hollowRate(),
        trust: tracker.trust(),
        next: nextObjective(),
        skills: graph.nodes.map((n) => ({
          id: n.id,
          title: t('skills.' + n.id),
          state: stateOf(n.id),
          // Held, with a line underneath it reopened. Reported beside the state
          // rather than folded into it: the claim did not change.
          underReopened: underReopened(n.id),
          unlocked: mastery.isUnlocked(n.id),
          pL: mastery.get(n.id).pL,
          // Whether anything on this line was measured at all. Every figure
          // below is null or a mark when this is false, and the row prints no
          // percentage — see the note on the bar in renderSkills.
          measured: mastery.get(n.id).attempts > 0,
          attempts: mastery.get(n.id).attempts,
          ms: tracker.msFor(n.id),
          items: tracker.itemsFor(n.id),
          accuracy: tracker.accuracyFor(n.id),
          // The numerator behind that share, so the two can be checked against
          // each other rather than believed one at a time.
          unaidedRight: tracker.unaidedRightFor(n.id),
          // Questions asked on this line after the claim was granted. They are
          // practice on a held line, and they are not evidence for the claim.
          itemsSinceClaim: tracker.claimSplit(n.id)?.since ?? null,
          reps: repsOf(n.id),
          // The receipt, verbatim, so a critic can check the rendered card
          // against what the engine actually granted the claim on. `itemsAtClaim`
          // is the ledger's count at that instant, beside the model's own
          // `attemptsAt` — two stores answering the same question, which is the
          // only way either can be caught being wrong.
          claim: mastery.get(n.id).mastered
            ? (mastery.get(n.id).provenBy
              ? { ...mastery.get(n.id).provenBy, itemsAtClaim: tracker.claimSplit(n.id)?.before ?? null }
              : null)
            : null,
          claimSum: claimSum(n.id),
          sinceClaim: sinceClaim(n.id),
          evidence: evidenceOf(n.id).map((e) => ({ id: e.id, met: e.met, value: e.value })),
          ccss: alignmentOf(n).filter((x) => x.framework === 'CCSS-M')
            .map((x) => ({ code: x.code, depth: depthOf('ccss', n.id, x.code) || x.depth })),
          teks: alignmentOf(n).filter((x) => x.framework === 'TEKS')
            .map((x) => ({ code: x.code, citation: x.citation || null, depth: depthOf('teks', n.id, x.code) || x.depth })),
        })),
      };
    },
    /** The document a teacher would print or export, as data. */
    record: (learner) => buildRecord({
      mastery, graph, tracker, learner, stateOf, depthOf, coverage: () => coverage(),
      levelName: unitTitle(graph),
    }),
    /** Standard-level coverage in the framework now chosen. */
    coverage,
  };
}
