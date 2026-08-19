/**
 * The session.
 *
 * ASCENT had no session. It had a world with rifts in it, which is a sandbox —
 * and a sandbox is exactly the shape that produces the hour-long block this
 * whole product is built to avoid. A learner could not tell when they had done
 * enough, so they either stopped at random or did not stop at all, and neither
 * ending makes anybody want to come back tomorrow.
 *
 * A run is the unit now, and it has four beats:
 *
 *   1. ORDERS   (`charter.js`)     the goal, stated before the first item, and
 *      sized by playing the real mastery engine forward at this learner's own
 *      measured pace until twenty minutes of work have gone by (`estimate.js`).
 *      On a return it opens by saying what the last run left standing.
 *   2. THE RUN  (`band.js`)        one cell per tear closed, a ladder mark
 *      where a seam is expected to shut, a `near` state at three quarters, and
 *      a second quiet read for work done that answers to every item worked,
 *      not only to the ones that came out right. No clock, anywhere, ever.
 *   3. THE CLOSE (`resolution.js`) what is now held, what that opened, and what
 *      the next run opens with — named and costed.
 *   4. THE REST  (`rest.js`)       distance and paced breathing, then a real
 *      ending you are allowed to take.
 *
 * The one thing it borrows from the rest of the game is the answer stream, and
 * it borrows it the same way `src/meta` does: by wrapping `mastery.observe`,
 * the single call every answer already goes through. Nothing in `src/learn`,
 * `src/ui` or `src/meta` knows this file exists.
 *
 * Everything is written to `localStorage` on every answer, so a run survives
 * the break, a reload, a dead battery and the end of the school day.
 *
 * THE FLOOR. When a session beat takes the frame it takes it whole. That is not
 * a preference: `src/main.js` chains the next rift 460 ms after a sealed one,
 * and a resolution card is opened on the frame *after* the rift panel closes —
 * so for four hundred milliseconds the close beat looks correct, and then a
 * live keypad paints itself underneath it and the break beat, whose entire
 * premise is looking at something a long way off, is a picture of a keypad.
 * `takeFloor()` is called before any beat is shown; main.js hands it the one
 * timer it owns, and `blocking()` is the standing answer to "may I open a rift
 * right now" for anything that fires later.
 */
import './session.css';
import { planRun, tearsToHold, minutesToHold, SESSION_MAX, SESSION_TARGET } from './estimate.js';
import { sessionClock } from './clock.js';
import { createPace } from './pace.js';
import { RunBand } from './band.js';
import { Charter } from './charter.js';
import { Resolution } from './resolution.js';
import { Rest } from './rest.js';
import { linesHeld, repaired } from '../meta/progress.js';
import { t, onLocaleChange } from '../i18n/index.js';

const KEY = 'ascent.run';
/** What the last closed run left behind, so a return can be acknowledged. */
const LAST_KEY = 'ascent.run.last';
/** A short extension when a learner asks for one more seam. Minutes. */
const EXTEND_MINUTES = 8;
/** Never let one frame's dt (a tab that was asleep) count as session time. */
const MAX_DT = 0.5;
/**
 * How much out-of-rift time is charged to the session, per gap. Seconds.
 *
 * `run.focus` used to be wall clock, and wall clock is the wrong clock: twenty
 * five minutes spent building a tower closed the session at zero tears and told
 * the learner they had done twenty five minutes of work, while `pace` — which
 * sizes the goal — deliberately refuses to charge the walk between two rifts to
 * anybody's thinking time. Two clocks is the same as none. So the session now
 * counts the same seconds the planner does: time with an item on the surface,
 * plus the walk to the next rift up to this much. Building, gliding and looking
 * at the sea are the game; they are not the Pomodoro.
 */
const GAP_GRACE = 45;
/**
 * Seconds the orders will wait for the cold open to retract before going
 * anyway. The establishing shot ends on the cadet's first step and has no timer
 * of its own, so this is the ceiling on "they have not moved yet".
 */
const OPEN_WAIT_MAX = 16;
/** How many times one sitting may be extended before the ceiling is the answer. */
const MAX_EXTENSIONS = 2;
/** An extension shorter than this is not worth the card that offers it. */
const MIN_EXTENSION = 3;

export function createSession({
  root, mastery, story, input, fx, audio, panel, hud,
  // reward economy (src/kit): optional, and only ever read for the one line
  // the orders card leads with. Absent, the card falls back to its own copy.
  kit = null,
  isBusy = () => false, onFloor = () => {},
}) {
  /* THE ONE SESSION CLOCK. Imported rather than constructed, and shared with
     `src/report/track.js` — the module is a singleton on purpose, because the
     defect this pass exists to kill was two live instances of the same idea and
     a constructor is a thing somebody can call twice. See ./clock.js. */
  const clock = sessionClock();
  const pace = createPace();
  const band = new RunBand(root);
  const charter = new Charter(root, { onBegin: startWork });
  const resolution = new Resolution(root, { onRest: toRest, onMore: extend });
  const rest = new Rest(root, {
    onDone: () => {},
    onAnother: () => { leaveRest(); plan(); },
    onClose: closeChannel,
  });

  /* ONE CEREMONY AT A TIME. The three session beats take the whole frame, and
     so do the rank rite and the chapter plate in src/meta. All five are type
     over a semi-transparent dim — the world stays in the frame on purpose — so
     two of them at once composite rather than stack: the word GOLD printed
     straight through the résumé at 1280x720, with "from 16 questions worked"
     sitting on its O and L, and no stacking order could have fixed it because
     neither card paints an opaque pixel. So src/meta is told, once, how to ask
     whether the frame is free, and it queues its beats behind this answer. */
  story?.setFrameGuard?.(() => blocking());

  let run = load();
  let last = loadLast();
  let phase = 'idle';          // idle · charter · work · close · rest · off
  let pending = 0;             // seconds waited before the orders arrive
  let saidNear = false;
  let ending = false;
  // work-time accounting (see GAP_GRACE)
  let panelWasOpen = false;
  let gapSpent = 0;
  /**
   * Did the cadet answer a question before the orders got out of the door?
   *
   * Set in `onAnswer` while this module is still counting down to its opening
   * beat. `plan()` reads it and declines to take the frame: see the comment
   * there. It is deliberately never cleared inside a sitting — once a learner
   * has done mathematics, no card in this file gets to stop them to announce
   * that they are about to start.
   */
  let workedAlready = false;
  /** Seconds already spent holding the orders back for the cold open. */
  let openWait = 0;

  // ---------------------------------------------------------------------------
  // The answer stream. One wrap, and the run can hear the whole game.
  // ---------------------------------------------------------------------------
  const rawObserve = mastery.observe.bind(mastery);
  mastery.observe = (id, correct, meta = {}) => {
    const res = rawObserve(id, correct, meta);
    try { onAnswer(id, !!correct, meta, res); } catch { /* never break the loop */ }
    return res;
  };

  // The pace clock starts when an item actually reaches the surface, not when
  // the last one was answered — otherwise the walk between two rifts is charged
  // to the learner's thinking time and tomorrow's goal shrinks for it.
  const rawShow = panel.show.bind(panel);
  panel.show = (item, opts) => {
    pace.presented(item, opts);
    noteFirstSight(opts?.skillId);
    return rawShow(item, opts);
  };

  /**
   * The first time a line reaches the surface inside this run, its distance is
   * read *before* the learner touches it.
   *
   * The plan takes that reading for the lines it named, but a run routinely
   * works a line the plan did not name — one that unlocked halfway through, or
   * an interleaved re-probe — and those were the lines with no `was` to compare
   * against, so the close beat's ledger fell back to "today bought the ground
   * under it" for exactly the case where it had something specific to say.
   */
  function noteFirstSight(id) {
    if (!id || !run || phase !== 'work') return;
    run.startLeft = run.startLeft || {};
    run.startBand = run.startBand || {};
    if (id in run.startLeft) return;
    const left = tearsToHold(mastery, id, pace);
    run.startLeft[id] = left ? left.tears : null;
    run.startBand[id] = mastery.get(id)?.difficulty ?? null;
  }

  function onAnswer(id, correct, meta, res) {
    pace.answered(correct);
    /* AN ANSWER BEFORE THE ORDERS MEANS THE RUN IS ALREADY UNDER WAY.
       Latched here rather than on "a panel was open", because those are not
       the same claim: a card that appeared and was shut again is a glance, and
       a glance is not grounds for withholding the one beat that states the
       goal. A question actually answered is. `plan()` reads this and says the
       goal in a line instead of taking the frame — see the comment there. */
    if (phase === 'idle' && pending > 0) workedAlready = true;
    if (!run || phase !== 'work') return;
    run.worked[id] = (run.worked[id] || 0) + 1;
    // Work done, which is not the same thing as work that came out right. This
    // is the only counter in the run that a wrong answer moves, and it is the
    // reason a learner who missed ten in a row is not shown a frozen band and
    // an unmoved zero for twenty minutes.
    run.items = (run.items || 0) + 1;
    if (!correct) {
      run.misses = (run.misses || 0) + 1;
      // Every miss puts a worked solve in front of the learner, jumped to the
      // step their answer revealed. That is teaching received, and the close
      // beat is allowed to count it.
      run.echoes = (run.echoes || 0) + 1;
    }
    if (correct) {
      run.tears++;
      band.tick(run.tears, true);
      if (!saidNear && run.tears / run.target >= 0.75 && run.tears < run.target) {
        saidNear = true;
        story?.comms?.sayKey('session.voice.near', { tag: 'session-near', force: true });
      }
    }
    band.work(run.items, run.plannedItems || 0);
    /* THE QUOTED WORKLOAD IS CORRECTED OUT LOUD WHEN IT IS WRONG.
       The orders card quotes the questions this run is expected to take, as a
       range, because twenty-one trials produce a range and not a number. A
       range still has a top, and a run that goes past it has been mis-quoted —
       so Marlow says so, once, in the same breath as saying it costs nothing.
       Saying nothing is what turned "Seal 16 rifts" over a 24-item plan into a
       thing a cold reader could call quoting a player two thirds of the work. */
    if (!run.overrun && run.itemsHigh && run.items > run.itemsHigh && run.tears < run.target) {
      run.overrun = true;
      story?.comms?.sayKey('session.voice.longer', {
        tag: 'session-longer', force: true, params: { n: run.itemsHigh },
      });
    }
    if (res?.justMastered) {
      if (!run.held.includes(id)) run.held.push(id);
      band.seamHeld();
    }
    for (const u of res?.newlyUnlocked || []) if (!run.opened.includes(u)) run.opened.push(u);
    save();
  }

  // ---------------------------------------------------------------------------
  // Planning
  // ---------------------------------------------------------------------------
  function plan(opts = {}) {
    const minutes = opts.minutes ?? SESSION_TARGET;
    const index = opts.keepIndex && run ? run.index : ((run?.index || 0) + 1);
    const p = planRun(mastery, pace, { minutes, seed: 0x5eed + index * 131 });
    const s = story?.state?.() || {};
    run = {
      index,
      startedAt: Date.now(),
      focus: 0,
      target: p.tears,
      tears: 0,
      // How many items the projection expected to spend on that goal. It is
      // what the band's work read is drawn against, and it is never shown as a
      // number: a learner is being told "you are working", not "you are late".
      plannedItems: Math.max(p.tears, Math.round(p.items || p.tears)),
      // …and the range the same projection produced, which is what the orders
      // card actually quotes. `plannedItems` is the middle of it. A cold reader
      // read "Seal 16 rifts" and found the engine had planned 24 questions:
      // both were true and only one of them was on screen. See `planRun`.
      itemsLow: Math.max(p.tears, Math.round(p.itemsLow ?? p.items ?? p.tears)),
      itemsHigh: Math.max(p.tears, Math.round(p.itemsHigh ?? p.items ?? p.tears)),
      // Said once, out loud, if the run goes past the top of the quoted range.
      // A promise stated as a range still has to be corrected when it is wrong.
      overrun: false,
      items: 0,
      misses: 0,
      echoes: 0,
      seams: p.seams,
      promised: p.promised,
      minutes: p.minutes,
      seeded: pace.seeded,
      complete: p.complete,
      worked: {},
      held: [],
      opened: [],
      extensions: 0,
      // Where every line the orders name actually stood before the first item,
      // in tears. The close compares against this rather than asserting that
      // twenty minutes must have moved something.
      startLeft: Object.fromEntries(p.seams.map((sm) => {
        const left = tearsToHold(mastery, sm.id, pace);
        return [sm.id, left ? left.tears : null];
      })),
      // …and the band each of them was being served at, which is the other
      // thing a hard run really does move.
      startBand: Object.fromEntries(p.seams.map((sm) => [sm.id, mastery.get(sm.id)?.difficulty ?? null])),
      /* WHERE THE ONE NUMBER STOOD WHEN THIS RUN OPENED.
         The close card leads with WORLD REPAIRED and how far this sitting moved
         it, and that delta has to be a difference between two readings of the
         same figure — not a second figure computed some other way. Saved on the
         run, so it survives a reload the way the run does. */
      repairedAt: repaired(mastery).pct,
      chapterAt: s.chapter ?? null,
      rankAt: s.rank ?? null,
      extension: false,
      done: false,
    };
    saidNear = false;
    resetWorkClock();
    save();
    paintBand();

    /* ORDERS ARE AN OPENING BEAT, AND AN OPENING CANNOT HAPPEN IN THE MIDDLE.
       A cold critic wrote "ORDERS re-issued mid-run", and the word "re-issued"
       is the only inaccurate thing in the sentence — this card was not sent
       twice, it was sent LATE. It waits for the cold open to finish and then
       waits again for the learner to be out of a tear, and a learner who walks
       straight into the first rift is out of it about thirty seconds in. So
       the beat that exists to happen *before* any mathematics is asked for
       arrived after the first three items, took the whole screen, and stopped
       a run that was visibly already going.

       A goal is still owed. It is just no longer owed AS A MODAL, because the
       player did not ask for one and is demonstrably not waiting for one. The
       band across the top carries the same goal, the companion says it in one
       line, and the run starts without anybody's hands being taken. */
    /* …AND WALKING COUNTS AS BEING UNDER WAY, not only answering.
       The rule above latches on a question answered. A cold player has not
       answered anything at twenty-five seconds — they are still crossing the
       plaza toward the first rift, with a key held down — and this card opened
       on top of them and took the keyboard mid-stride. `tools/critic/coldplay.mjs`
       measured the consequence and it is the whole game: "a stranger can WALK to
       the first rift with WASD alone" failed, and so did "the rift can be opened
       at all", because W was held BEFORE the card appeared and a key that is
       already down fires no further keydown for the card's own any-key dismissal
       to hear. A player who never lifts their finger is never let back in.
       Hands on the controls is the same claim as an answer already given: this
       person is playing, and is demonstrably not waiting to be told to start. */
    const handsOn = (input?.keys?.size || 0) > 0;
    if (workedAlready || handsOn) {
      startWork();
      story?.comms?.sayKey('session.voice.underway', {
        tag: 'session-underway', force: true, params: { tears: run.target },
      });
      return run;
    }

    phase = 'charter';
    takeFloor();
    charter.show({
      index: run.index,
      target: run.target,
      seams: run.seams,
      minutes: run.minutes,
      seeded: run.seeded && !last,
      // The workload, quoted beside the goal. See `run.itemsLow` above.
      itemsLow: run.itemsLow,
      itemsHigh: run.itemsHigh,
      // A thunk, not a sentence. The orders card lives for sixteen seconds and
      // the language switcher is on screen for all of them; a string rendered
      // here is a string frozen in whatever locale was loaded at the time.
      goalText: () => goalLong(run),
      back: backCard(),
      /* What is standing on the island, if anything is. The orders card leads
         with it on a return — see the note in `charter.js` `retext`. */
      order: (() => { try { return story?.night?.state?.() || null; } catch { return null; } })(),
      /* WHERE. The orders used to name the line and what holding it buys, and
         stop — so a learner closed the card knowing exactly what to do and
         having no idea where to go, which is the whole defect this run of work
         exists to fix. `src/meta/guide.js` already resolves the tear the
         scheduler picked and how far off it is, and it is a thunk for the same
         reason `goalText` is: this card lives for sixteen seconds. */
      mark: () => story?.guide?.() || null,
    });
    return run;
  }

  /**
   * What the last closed run left standing, for the top of the orders. A game
   * that greets a learner on day two with the same cold checklist it opened
   * with on day one — down to "I have not watched you work yet", said to
   * somebody it watched work for twenty minutes yesterday — has not noticed
   * they came back, and noticing is most of what makes them come back again.
   */
  function backCard() {
    if (!last || !Number.isFinite(last.tears)) return null;
    return {
      tears: last.tears,
      held: (last.held || []).slice(),
      index: last.index,
      days: last.endedAt ? Math.floor((Date.now() - last.endedAt) / 86400000) : 0,
    };
  }

  function startWork() {
    phase = 'work';
    setModal(false);
    band.show(true);
    resetWorkClock();
    save();
  }

  /** The band's label, its ladder marks and its work read, in this language. */
  function paintBand() {
    if (!run) return;
    band.set({
      index: run.index,
      tears: run.tears,
      target: run.target,
      // What the goal was before this run was extended, if it was. The band
      // prints the raise from this, so a reloaded run still says out loud that
      // its goal moved — see the note in band.js `set`.
      targetWas: run.targetWas ?? null,
      items: run.items || 0,
      plannedItems: run.plannedItems || 0,
      goalText: goalShort(run),
      marks: run.seams.filter((s) => s.hold && s.at != null).map((s) => s.at),
    });
  }

  function goalShort(r) {
    const hold = r.seams.filter((s) => s.hold);
    if (r.extension) return t('session.goal.extend');
    if (hold.length >= 2) return t('session.goal.holdN', { n: hold.length });
    if (hold.length === 1) return t('session.goal.hold', { skill: t('skills.' + hold[0].id) });
    const first = r.seams[0];
    return first
      ? t('session.goal.push', { skill: t('skills.' + first.id) })
      : t('session.goal.any');
  }

  function goalLong(r) {
    const hold = r.seams.filter((s) => s.hold);
    // reward economy: what this run is *for* is the capability the next held
    // line hands over, not a rep count. "Seal 16 tears on that line" is a toll
    // booth on the title card; Fortnite never says "eliminate 16 opponents to
    // unlock the glider." The skill named is the one the run is aimed at, and
    // the promise comes from the kit (src/kit/kit.js).
    const aim = hold[0] || r.seams[0];
    if (aim && kit) {
      const g = kit.nextGrant?.();
      const skill = t('skills.' + aim.id);
      // The orders lead with the verb. That needs the count, so it is passed:
      // "Seal 5 rifts on Reading a variable" rather than the skill's name and
      // a paragraph. i18n, additive — the keys themselves are in src/i18n.
      return g
        ? t('kit.charterNext', { skill, grant: g.name, what: g.what, tears: r.target })
        : t('kit.charterOpen', { skill, tears: r.target });
    }
    if (hold.length >= 2) return t('session.charter.goalHoldN', { n: hold.length, tears: r.target });
    if (hold.length === 1) {
      return t('session.charter.goalHold', {
        skill: t('skills.' + hold[0].id), tears: r.target,
      });
    }
    const first = r.seams[0];
    return first
      ? t('session.charter.goalPush', { skill: t('skills.' + first.id), tears: r.target })
      : t('session.charter.goalAny', { tears: r.target });
  }

  // ---------------------------------------------------------------------------
  // The close
  // ---------------------------------------------------------------------------
  /**
   * The run is over when the goal is met, or when it has taken as long as this
   * loop is designed to take — and in either case not until the learner is out
   * of a rift. A resolution that lands on top of a half-typed answer is a
   * resolution that reads as an interruption.
   */
  function shouldClose() {
    if (!run || phase !== 'work' || run.done) return false;
    if (isBusy() || charter.open) return false;
    return run.tears >= run.target || run.focus >= SESSION_MAX * 60;
  }

  function close() {
    if (!run || run.done) return;
    run.done = true;
    run.endedAt = Date.now();
    phase = 'close';
    takeFloor();
    band.show(false);
    fx?.impact?.('good');
    audio?.unlocked?.();
    /* LEAVE SOMETHING STANDING BEFORE THE CARD IS BUILT.
       The client's first ask, verbatim: *a reason to open it tomorrow that
       exists before you close it today.* Everything this card used to print
       about tomorrow was computed at the moment the learner arrived tomorrow,
       which is a reward for having already come back rather than a reason to.
       So the run lays a STANDING ORDER as it ends (src/meta/night.js): one line
       this cadet already holds, named and dated, with a mark raised over the
       ground where they stood down. It is laid BEFORE `buildReport`, so the
       card is describing a thing that is already true rather than promising
       one, and `lay()` refuses on a first session because a cadet holding no
       line has nothing that could survive a night. */
    try { story?.night?.lay?.(); } catch { /* a close beat never fails on this */ }
    const report = buildReport();
    run.report = report;
    /* THE PROMOTION IS PART OF WHAT THE RUN ACHIEVED, so if the run ended on
       the answer that bought it, this card is where it gets said — once. The
       rite is taken off src/meta rather than queued behind this card, because
       a rank ceremony that plays *after* the résumé listing the rank is a
       ceremony for something the learner has already read. `claimRite()`
       returns null whenever the rite has already had its own moment earlier in
       the run, and then the rank is an ordinary line under OPENED, which is
       what it is: a thing that happened, twenty minutes ago. */
    report.promoted = story?.claimRite?.() || null;
    if (report.promoted) report.rank = null;
    last = {
      index: run.index, tears: run.tears, held: report.held.slice(),
      endedAt: run.endedAt, next: report.next?.id || null,
    };
    save();
    saveLast();
    resolution.show(report);
  }

  /**
   * Everything the close beat says, computed off the live engine at the moment
   * the run ends — never off a running tally, so the two can never disagree.
   */
  function buildReport() {
    const s = story?.state?.() || {};
    // The seam this run leaned on hardest and did not close. Its distance is
    // asked of the engine, in tears, exactly as the goal was — and since
    // estimate.js answers that question off the shortest road rather than off a
    // sample of coin flips, the two readings twenty minutes apart are the same
    // measurement taken twice.
    let stalled = null;
    const worked = Object.entries(run.worked)
      .filter(([id]) => !mastery.get(id)?.mastered)
      .sort((a, b) => b[1] - a[1]);
    if (worked.length) {
      const id = worked[0][0];
      const left = tearsToHold(mastery, id, pace);
      stalled = {
        id,
        tears: left ? left.tears : null,
        was: run.startLeft?.[id] ?? null,
        items: run.worked[id],
        band: mastery.get(id)?.difficulty ?? null,
        bandWas: run.startBand?.[id] ?? null,
      };
    }
    const next = nextOpen();
    return {
      index: run.index,
      tears: run.tears,
      target: run.target,
      met: run.tears >= run.target,
      // A line that closed and then lapsed on its own re-probe inside the same
      // run is not a line held, and the close does not get to say it was. The
      // ledger is re-read off the engine rather than trusted from the tally.
      held: run.held.filter((id) => mastery.get(id)?.mastered),
      stalled,
      opened: run.opened.slice(),
      chapter: run.chapterAt != null && s.chapter > run.chapterAt ? s.chapter : null,
      rank: run.rankAt && s.rank && s.rank !== run.rankAt ? t('rank.' + s.rank) : null,
      next,
      /* WHAT KEEPS GOING — and it is read on every close now, not only on the
         last one. This used to be `next ? null : endgame()`, so the descent,
         the charter and the waystation were named by the card only after the
         tenth line was held. A cadet who cut a charter with a line still open
         — depth is lines plus durable re-probes, so that happens — closed the
         session with a charter in hand and nothing on screen that said so.
         The card decides which of these rows are worth printing; this decides
         nothing except whether the numbers exist. See `nextRows`. */
      endgame: endgame(),
      /* THE RETURNING LOOP, NAMED ON EVERY CLOSE.
         The endgame rows above only exist once the lattice is whole, so a
         learner three lines in read a card that said nothing at all about why
         tomorrow is different from another twenty minutes today. Nights held is
         the number that answers that, it is the number rank and the last two
         chapters are now paced against (src/meta/days.js), and it is the one
         number a long sitting cannot move. It goes on every close. */
      nights: s.nights || 0,
      /* WHAT IS STANDING ON THE ISLAND, waiting. Read off `night.js` rather
         than off the `lay()` above, because an order laid on an earlier run and
         never collected is exactly as much of a reason to come back as one laid
         four hundred milliseconds ago — and the card must say the same thing
         about both. */
      order: (() => { try { return story?.night?.state?.() || null; } catch { return null; } })(),
      due: watchNow()?.due || 0,
      // THE progress number, from the one function that defines it. This used
      // to walk `mastery.state` while the report walked `graph.nodes` and the
      // objective card counted a third way — three expressions for the single
      // figure a teacher is asked to trust. `held` above is a list of the lines
      // THIS RUN closed and is a different thing entirely, which is why this
      // one is named for the figure it is. See src/meta/progress.js.
      lines: linesHeld(mastery).held,
      linesTotal: linesHeld(mastery).total,
      /* THE ONE NUMBER, AND WHAT THIS SITTING DID TO IT. The close card's
         headline. Both readings come from `repaired()` — the same function the
         rig on the HUD is drawn from — so the résumé cannot claim a different
         world from the one the player was just looking at. */
      repaired: repaired(mastery).pct,
      repairedWas: run.repairedAt ?? null,
      /* HOW LONG THIS SITTING HAS BEEN GOING — from `clock.ms()`, the one
         session clock (src/session/clock.js), and NOT from `run.focus`.
         `run.focus` is the planner's clock: item time plus a capped walk, which
         is the right quantity for sizing a goal and the wrong one for anything
         with the word "minutes" on it, because it restarts at zero on every
         `plan()`. A cold critic watched the figure a teacher files read
         4 → 7 → 9 → 1 → 5 minutes inside one unbroken sitting; every reset in
         that sequence was a second clock being read under the first one's name.
         There is one clock now and this is it. */
      minutes: Math.round(clock.ms() / 60000),
      // Work done. A run that sealed nothing still has these, and they are the
      // difference between an honest close and a screen-height zero.
      items: run.items || 0,
      misses: run.misses || 0,
      echoes: run.echoes || 0,
      extensions: run.extensions || 0,
      canMore: canExtend(),
      moreMinutes: extendMinutes(),
    };
  }

  /**
   * WHAT THE NEXT RUN OPENS WITH — and only ever something that is actually open.
   *
   * This block used to be `mastery.next()`, and `mastery.next()` answers a
   * different question: *what is the single most useful item to serve right
   * now.* Two of its answers are lines the learner already holds — a retention
   * re-probe that has fallen due, and, past the last line, a rung of the
   * sounding — and `tearsToHold` correctly reports that a line already held is
   * zero minutes from being held. So the card printed
   *
   *     NEXT · Order of operations — About 0 minutes of work, and the
   *            highest-leverage thing left open. That is where we start.
   *
   * one column to the right of "everything you touched today was already
   * yours". Zero minutes is not a hook, it is the card contradicting itself,
   * and at the endgame it said that for ever.
   *
   * The close therefore asks its own question — what is still open, and which
   * of those has the most leverage — and when the honest answer is *nothing*,
   * it is nothing: `session.close.nextDone` has existed since this file was
   * written and was unreachable, because `mastery.next()` never returns null.
   */
  function nextOpen() {
    const pick = mastery.next();
    const id = pick && !mastery.get(pick.id)?.mastered ? pick.id : bestOpenSkill();
    if (!id) return null;
    const minutes = minutesToHold(mastery, id, pace);
    // Belt and braces: an open line cannot cost nothing, and if the model ever
    // says it does, the honest row is the one that prints no number at all.
    return { id, minutes: minutes > 0 ? minutes : null };
  }

  /** The highest-leverage line that is unlocked and not yet held. */
  function bestOpenSkill() {
    let best = null;
    let bestV = -Infinity;
    for (const id of mastery.unlockedSkills?.() || []) {
      if (mastery.get(id)?.mastered) continue;
      const v = mastery.leverage?.(id) ?? 0;
      if (best == null || v > bestV) { bestV = v; best = id; }
    }
    return best;
  }

  /**
   * THE THREE THINGS THAT KEEP GOING.
   *
   * Holding all ten lines is not the end of the game, and the screen that ends
   * a session was the one surface that never said so. Past the last line the
   * loop is entirely intact and entirely unnamed:
   *
   *   THE SOUNDING    held lines, at the top of the bank, with nothing to lean
   *                   on, one rung at a time. It has no floor and no ceiling,
   *                   and it is what a spare minute is for (src/learn).
   *   THE CHARTER     cut by depth, and depth's second term — a re-probe that
   *                   survived a night — cannot move inside one sitting. It is
   *                   the only thing in the game whose price is literally
   *                   coming back tomorrow and still knowing it (src/kit).
   *   THE WAYSTATION  what a charter buys: a permanent tower of rising air that
   *                   is also a place, and two of them are a route (src/kit).
   *
   * All three are read off the objects the HUD reads, never off a tally here,
   * and a missing kit only costs the rows it owns.
   */
  /** What the retention schedule wants looked at, off its own wall clock. */
  function watchNow() {
    try { return mastery.watch?.() || null; } catch { return null; }
  }

  function endgame() {
    let w = null;
    let k = null;
    try { w = mastery.watch?.() || null; } catch { /* never break the beat */ }
    try { k = kit?.state?.() || null; } catch { /* kit is optional */ }
    return {
      sounding: w?.sounding?.best || 0,
      charters: k ? k.charters : null,
      toCharter: k ? k.toCharter : null,
      stations: k ? k.stations : null,
    };
  }

  function toRest() {
    phase = 'rest';
    takeFloor();
    root.classList.add('ses-resting');
    rest.show(run?.report || null);
  }

  function leaveRest() {
    root.classList.remove('ses-resting');
    phase = 'idle';
  }

  function closeChannel() {
    ending = true;
    save();
  }

  // ---------------------------------------------------------------------------
  // One more line
  // ---------------------------------------------------------------------------
  /**
   * ONE MORE LINE used to plan a whole new run. Four presses took the run index
   * to five in a single sitting, every one of those runs was eight minutes long
   * and started from zero, and every close after the first read THE SHARD IS
   * QUIET · NOTHING NEW TO HOLD — so the button the game offers was the button
   * that punished you for taking it, and the fifteen-to-twenty-five minute
   * constraint was enforced by nothing at all.
   *
   * An extension is now what the word means: the same run, carried on. The band
   * keeps its count, the ledger keeps its held lines, and the close at the end
   * is the close for the whole sitting. What it cannot do is run past the
   * ceiling — the extension is only ever as long as the twenty-five minute
   * window has left, and when there is nothing left the offer is withdrawn and
   * the card says why.
   */
  function extendMinutes() {
    if (!run) return 0;
    return Math.max(0, Math.min(EXTEND_MINUTES, Math.floor(SESSION_MAX - run.focus / 60)));
  }

  function canExtend() {
    return !!run && (run.extensions || 0) < MAX_EXTENSIONS && extendMinutes() >= MIN_EXTENSION;
  }

  function extend() {
    if (!canExtend()) { toRest(); return; }
    const minutes = extendMinutes();
    const p = planRun(mastery, pace, {
      minutes, seed: 0x5eed + run.index * 131 + 7717 * (run.extensions + 1),
    });
    run.extensions = (run.extensions || 0) + 1;
    run.extension = true;
    run.done = false;
    run.report = null;
    run.endedAt = null;
    /* THE ONE PLACE THE GOAL IS ALLOWED TO MOVE — and it is announced.
       A cold critic read "Seal 16 rifts" on one card and "Seal 20 rifts" on a
       later one "without comment", and a target that changes in silence makes
       every earlier statement of it look like a lie. The band prints the raise
       from-and-to and keeps it printed for the rest of the run (band.js), and
       Marlow says it once out loud. The old target is kept on the run so a
       reloaded session can still say what it was raised from. */
    run.targetWas = run.target;
    run.target += Math.max(1, p.tears);
    run.plannedItems = (run.plannedItems || 0) + Math.max(1, Math.round(p.items || p.tears));
    // The workload is re-quoted with the goal, because a raised goal that left
    // the old workload standing would be the same defect one beat later.
    run.itemsLow = (run.itemsLow || 0) + Math.max(1, Math.round(p.itemsLow ?? p.items ?? p.tears));
    run.itemsHigh = (run.itemsHigh || 0) + Math.max(1, Math.round(p.itemsHigh ?? p.items ?? p.tears));
    run.overrun = false;
    run.minutes += minutes;
    for (const sm of p.seams) {
      const known = run.seams.find((x) => x.id === sm.id);
      if (known) { known.hold = known.hold || sm.hold; continue; }
      run.seams.push({ ...sm, at: sm.at != null ? run.tears + sm.at : null });
      const left = tearsToHold(mastery, sm.id, pace);
      run.startLeft[sm.id] = left ? left.tears : null;
      run.startBand[sm.id] = mastery.get(sm.id)?.difficulty ?? null;
    }
    saidNear = run.tears / run.target >= 0.75;
    phase = 'work';
    setModal(false);
    paintBand();
    band.show(true);
    resetWorkClock();
    save();
    story?.comms?.sayKey('session.voice.raised', {
      tag: 'session-extend', force: true, params: { from: run.targetWas, to: run.target },
    });
  }

  // ---------------------------------------------------------------------------
  // The work clock
  // ---------------------------------------------------------------------------
  function resetWorkClock() {
    panelWasOpen = !!panel?.open;
    gapSpent = 0;
  }

  /** See GAP_GRACE: the session's clock is the planner's clock, not the wall's. */
  function chargeWork(d) {
    const open = !!panel?.open;
    if (open) {
      run.focus += d;
    } else {
      if (panelWasOpen) gapSpent = 0;
      if (gapSpent < GAP_GRACE) {
        const c = Math.min(d, GAP_GRACE - gapSpent);
        gapSpent += c;
        run.focus += c;
      }
    }
    panelWasOpen = open;
  }

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  function update(dt) {
    const d = Math.min(MAX_DT, dt);
    if (phase === 'rest') {
      rest.update(d);
      if (!rest.open) { root.classList.remove('ses-resting'); setModal(false); phase = 'idle'; }
      return;
    }
    if (phase === 'idle' && pending > 0) {
      pending -= d;
      if (pending <= 0) { pending = 0; resume(); }
      return;
    }
    if (phase !== 'work') return;
    chargeWork(d);
    if (shouldClose()) close();
    // Written once a second rather than once a frame: the goal is that a run
    // survives a closed lid, not that it survives a power cut mid-frame.
    saveThrottled();
  }

  // ---------------------------------------------------------------------------
  // Coming in and going out
  // ---------------------------------------------------------------------------
  /**
   * Called once, after boot. The very first session waits for the cold open to
   * finish talking; a learner who has been here before waits only long enough
   * for the world to have drawn itself — but it does wait for that, because a
   * six-row checklist over a black screen four seconds after load is not an
   * opening beat, it is a loading error with type on it.
   */
  function begin() {
    /* A FIRST RUN WAITS FOR THE COLD OPEN, NOT FOR A CLOCK.
       This was a flat twenty-five seconds, chosen to clear an establishing
       shot that in practice ends the moment the cadet takes a step
       (src/meta/opening.js). So a player who walked at three seconds got
       twenty-two seconds of game and then, out in the meadow with a rift in
       front of them, the card that exists to be read *before* any of it.
       `resume()` now holds while `story.openingLive()` is true and delivers
       the orders a beat after it clears — which is early, at the landing,
       where an opening beat belongs. */
    pending = (run && !run.done) || last ? 4.2 : 2.5;
    phase = 'idle';
  }

  /** Has the world actually appeared yet? */
  function worldUp() {
    const boot = document.getElementById('boot');
    return !boot || boot.classList.contains('gone');
  }

  /**
   * Is another beat already holding the frame? The narrative replays an
   * ascension rite or opens the dossier on its own clock, and orders that
   * arrive underneath a letterboxed rank card are orders nobody reads. Read
   * defensively: src/meta owns these and the session must survive them moving.
   */
  function storyBusy() {
    try {
      return !!(story?.rite?.el?.classList?.contains('show') || story?.dossier?.open);
    } catch { return false; }
  }

  function resume() {
    // Never on top of a live rift: a set of orders that lands over a half-typed
    // answer reads as an interruption, and the whole point of this beat is that
    // it is the thing that happens *before* any mathematics is asked for.
    if (isBusy()) { pending = 2; return; }
    if (!worldUp()) { pending = 1.2; return; }
    /* The establishing shot is the first half of the opening and these orders
       are the second. Never both at once, and never these first.

       Bounded, because the cold open has no clock of its own — it retracts when
       the cadet takes a step and not before (src/meta/opening.js). Somebody who
       sits and looks at the sky for a quarter of a minute has still earned
       their orders, and a beat that waits forever on another beat is a hang
       wearing good manners. */
    if (story?.openingLive?.() && openWait < OPEN_WAIT_MAX) {
      openWait += 0.8;
      pending = 0.8;
      return;
    }
    if (storyBusy()) { pending = 1.5; return; }
    if (run && !run.done) {
      // A run that survived the break, the bell or a flat battery picks up
      // exactly where it stood.
      phase = 'work';
      saidNear = run.tears / run.target >= 0.75;
      paintBand();
      band.show(true);
      resetWorkClock();
      story?.comms?.sayKey('session.voice.resume', { tag: 'session-resume', force: true });
    } else {
      plan();
    }
  }

  /**
   * A session beat is about to own the frame. Everything else stands down —
   * including the one thing main.js has in flight, which is the rift it queued
   * to chain 460 ms after the last seal.
   */
  /**
   * "May anything else open right now?" — asked by main.js before the chained
   * rift it queued half a second ago actually opens, and by src/meta before it
   * starts a rite or a chapter plate.
   */
  function blocking() {
    return phase === 'charter' || phase === 'close' || phase === 'rest'
      || charter.open || resolution.open || rest.open;
  }

  function takeFloor() {
    try { onFloor(); } catch { /* a beat must never be stopped by its host */ }
    // Everything else that can hold the whole screen stands down: the cold
    // open's stamp retracts, and a chapter plate mid-draw goes back on its
    // queue to be played whole once this beat is over.
    try { story?.yieldFrame?.(); } catch { /* src/meta owns this; never fatal */ }
    // Torn down before the modal flag is set, because closing the panel hands
    // main.js back the input surface on its way out.
    if (panel?.open) panel.close?.();
    setModal(true);
  }

  function setModal(on) {
    if (input) input.uiOpen = !!on;
    if (on) document.exitPointerLock?.();
    root.classList.toggle('ses-cine', !!on);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  let lastSave = 0;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(run)); } catch { /* private mode */ }
    lastSave = performance.now();
  }
  function saveThrottled() {
    if (performance.now() - lastSave > 1000) save();
  }
  function saveLast() {
    try { localStorage.setItem(LAST_KEY, JSON.stringify(last)); } catch { /* private mode */ }
  }
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && typeof v.target === 'number' ? v : null;
    } catch { return null; }
  }
  function loadLast() {
    try {
      const v = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
      return v && Number.isFinite(v.tears) ? v : null;
    } catch { return null; }
  }

  onLocaleChange(() => {
    if (run) paintBand();
    charter.retext();
    resolution.retext();
    rest.retext();
  });

  addEventListener('beforeunload', () => { if (run) save(); });

  return {
    begin,
    update,
    band,
    charter,
    resolution,
    rest,
    pace,
    blocking,
    /** Everything a critic — or a teacher's report — needs off one call. */
    state: () => ({
      phase,
      run: run ? { ...run, seams: run.seams.map((s) => ({ ...s })) } : null,
      last,
      pace: pace.state(),
      ending,
      resting: rest.resting,
      canExtend: canExtend(),
    }),
    /** Critic hooks: drive the real beats without faking a single answer. */
    plan,
    close,
    skipToClose: () => { if (run && phase === 'work') { run.focus = SESSION_MAX * 60; close(); } },
    /**
     * Wind the work clock forward. It is the one thing a critic cannot do by
     * playing — twenty-five minutes is twenty-five minutes — and everything
     * downstream of it (whether the run closes, whether one more line is still
     * on offer, what the close beat says) is then the real thing reacting to a
     * real clock rather than a beat being posed.
     */
    chargeTo: (minutes) => { if (run) run.focus = Math.max(run.focus, minutes * 60); },
    toRest,
    reset() {
      try { localStorage.removeItem(KEY); localStorage.removeItem(LAST_KEY); } catch { /* private mode */ }
      pace.reset();
      run = null;
      last = null;
    },
  };
}
