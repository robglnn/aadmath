/**
 * The run band — visible pacing that is not a clock, and **not a number**.
 *
 * A countdown clock on a mastery game is a threat. It says the same thing to a
 * learner who is finding this hard as to one who is not, and what it says is
 * "you are behind". So there is no clock anywhere in this system. What is on
 * screen instead is the thing games have always used to say *you are near the
 * end of this run*: a row of cells that fill.
 *
 * WHY THERE ARE NO NUMERALS ON THIS BAND ANY MORE.
 *
 * It used to print two: "2 OF 16 RIFTS THIS RUN" and, two hundred pixels away
 * on the same strip, "4 questions this run". A cold critic read them together
 * against the ESC glossary — *"Each rift holds one maths statement that is not
 * true yet"* — and drew the only available conclusion: if a rift is one
 * statement then rifts must equal questions, and these two never match after
 * item two. They ended a session 13 against 15. Both were true. A rift takes
 * as many questions as it takes; that is what an adaptive engine is for. But
 * the pair could only be read as one number contradicting itself, and adding
 * the words "this run" to both — which is what a previous pass did — does not
 * change what a fourteen-year-old sees.
 *
 * So the band keeps everything that made it work as an instrument and gives up
 * the two numerals. The plan those numerals stated is still stated, once, on
 * the orders card the learner dismisses to start the run, and the tally is in
 * the report. See `src/meta/progress.js` for the whole rule.
 *
 *   · One cell, one tear. Countable at a glance, and it moves on every correct
 *     answer, which is roughly every forty seconds. Nothing about it moves on a
 *     wrong one — a slip costs you nothing here, it just is not a step.
 *   · The row is exactly as long as *this learner's* goal, which was sized off
 *     their own measured pace. A slower learner does not get a longer row, they
 *     get the same twenty minutes with fewer cells in it.
 *   · The seams the run is expected to close are drawn on the track as ladder
 *     marks. You can see the milestone before you reach it.
 *   · At three quarters the band goes to its `near` state: the unlit cells
 *     start to breathe and the plate takes the rank's glow. That is the whole
 *     "last chamber" signal, and it is a change in the instrument rather than a
 *     line of text telling you to hurry.
 *   · Underneath the cells, a hairline that answers to *work* rather than to
 *     result. "A wrong answer costs nothing" was true and it was not enough:
 *     measured on a learner who missed ten in a row, the band showed nothing
 *     moving for a whole session, which is the same silence a learner reads as
 *     "you are not here". So the hairline creeps on every item worked, right or
 *     wrong. It is a mark on glass, not a figure.
 *
 * Everything animated is inside `aria-live="off"`; one composed sentence is put
 * on the plate for a screen reader when the state changes — and it names the
 * run and its state, not a count, because a screen reader must be told the same
 * thing the screen says and no more.
 */
import { t } from '../i18n/index.js';
// `retext()` declares "RUN 2" as an ordinal rather than a count. It has always
// called `tagFigure`; it has never imported it. Un-imported, the call was a
// ReferenceError thrown on the first line of the first run and on every locale
// change after it — which also meant the two statements *below* it, including
// the one that writes this run's goal, never ran at all. A missing import is
// why the band's goal line was blank in Spanish and Polish.
import { FIG, tagFigure } from '../meta/progress.js';

/** Beyond this many tears the row stops being countable and starts being a bar. */
const MAX_CELLS = 32;

export class RunBand {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'ses-band';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-live', 'off');
    this.el.innerHTML = `
      <span class="sb-head">
        <span class="sb-kick"></span>
        <span class="sb-goal"></span>
      </span>
      <span class="sb-track">
        <i class="sb-fill"></i>
        <i class="sb-head-mark"></i>
        <i class="sb-cells"></i>
        <i class="sb-marks"></i>
        <i class="sb-ground"></i>
      </span>
      <span class="sb-foot">
        <span class="sb-state"></span>
      </span>`;
    this.kick = this.el.querySelector('.sb-kick');
    this.goal = this.el.querySelector('.sb-goal');
    this.track = this.el.querySelector('.sb-track');
    this.fill = this.el.querySelector('.sb-fill');
    this.headMark = this.el.querySelector('.sb-head-mark');
    this.marks = this.el.querySelector('.sb-marks');
    this.ground = this.el.querySelector('.sb-ground');
    this.state = this.el.querySelector('.sb-state');
    root.appendChild(this.el);
    /* THE BAND PUBLISHES ITS OWN HEIGHT.
     *
     * On a phone the left column is a ladder of measured offsets, and the band
     * is one of its rungs — `src/ui/portrait.css` reserves a height for it and
     * stacks the progress pill, the objective card and the chapter strip below
     * that reservation. The reservation was a constant, which was true for
     * exactly as long as this band never changed height. It changes height the
     * first time a goal is raised: the announcement is two lines of prose, the
     * band grows, the reservation does not, and the sentence ends up underneath
     * the MENU pill — measured at 390x844, and it is the sentence that exists
     * to stop a number moving in silence.
     *
     * `src/meta/guide.js` already solved this for the objective card by writing
     * `--gd-h`, and portrait.css consumes it. This is the same contract for the
     * same reason: one property, written whenever the box actually changes, and
     * the ladder below follows. */
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        root.style.setProperty('--sb-h', `${Math.round(this.el.offsetHeight) + 7}px`);
      }).observe(this.el);
    }
    this._run = null;
    this._items = 0;
    this._planned = 0;
  }

  /**
   * @param {{index:number, tears:number, target:number, goalText:string,
   *          marks:number[], items:number, plannedItems:number,
   *          targetWas:number|null}} run  marks are tear counts at which a seam
   *          is expected to close, 0..target; `targetWas` is what the goal was
   *          before this run was extended, and is the reason a raise survives a
   *          reload rather than being a message the learner had to be watching
   *          for. See `_sayRaised`.
   */
  set(run) {
    /* THERE IS NO "GOAL RAISED" SENTENCE HERE ANY MORE, AND THAT IS THE POINT.
       It existed because the target was printed on this band and could move
       under the learner in silence — "Seal 16 rifts" on the orders card and a
       band saying 20 twenty screenshots later. The band prints no target now,
       so nothing can move in silence on it. The raise is offered, taken and
       stated on the close card, by the button the learner presses to take it,
       which is the surface that actually owes the sentence. */
    this._run = run;
    const cells = Math.min(MAX_CELLS, Math.max(4, run.target));
    this.track.style.setProperty('--cells', String(cells));
    this.marks.innerHTML = (run.marks || [])
      .filter((m) => m > 0 && m < run.target)
      .map((m) => `<u style="left:${((m / run.target) * 100).toFixed(2)}%"></u>`)
      .join('');
    this.retext();
    this.tick(run.tears, false);
    this.work(run.items || 0, run.plannedItems || 0);
  }

  /** Re-say every word on the band in the current language. */
  retext() {
    const r = this._run;
    if (!r) return;
    /* "RUN 2" is an ordinal — the name of this sitting, not a count of
       anything — and it is the only numeral left on this band. It is declared
       as one so the gate can tell a name with a digit in it from a tenth
       opinion about progress, rather than having to infer that from the words
       in three languages. */
    this.kick.textContent = t('session.band.run', { n: r.index });
    tagFigure(this.kick, FIG.RUN_NO, r.index);
    // Count-free by construction: `goalShort` in src/session/index.js names the
    // line this run is aimed at and never how many rifts it wants.
    this.goal.textContent = r.goalText;
    this.tick(r.tears, false);
    this.work(this._items, this._planned);
  }

  /** One tear closed — or a repaint after a language change. */
  tick(tears, gained = true) {
    const r = this._run;
    if (!r) return;
    r.tears = tears;
    const frac = Math.max(0, Math.min(1, tears / Math.max(1, r.target)));
    this.fill.style.width = `${frac * 100}%`;
    this.headMark.style.left = `${frac * 100}%`;
    this.headMark.style.opacity = frac > 0.005 && frac < 0.999 ? '1' : '0';
    // "You are near the end of this run", said by the instrument.
    this.el.classList.toggle('near', frac >= 0.75 && frac < 1);
    this.el.classList.toggle('full', frac >= 1);
    this.state.textContent = frac >= 1
      ? t('session.band.done')
      : (frac >= 0.75 ? t('session.band.near') : '');
    // After the state word is written: the read quotes it.
    this._label();
    if (gained) {
      this.el.classList.remove('pop');
      void this.el.offsetWidth;
      this.el.classList.add('pop');
    }
  }

  /**
   * Work done — every item answered, whichever way it came out.
   *
   * The hairline is drawn against what the projection expected the run to
   * spend, so it moves at a readable rate, and it is clamped rather than
   * allowed to overrun: a learner still working past the estimate is working,
   * not failing, and the instrument has nothing to say about it.
   */
  work(items, planned) {
    this._items = items | 0;
    this._planned = planned | 0;
    // A run saved by an older build carries no projection; the words still
    // work, the hairline simply has nothing to be drawn against.
    const frac = this._planned > 0
      ? Math.max(0, Math.min(1, this._items / this._planned))
      : 0;
    this.ground.style.width = `${(frac * 100).toFixed(2)}%`;
    this.el.classList.toggle('worked', this._items > 0);
    this._label();
  }

  /**
   * One composed sentence for a screen reader — and it says exactly what the
   * screen says, which is now no numbers.
   *
   * A screen reader that recites "nine rifts sealed this run, of twenty" off a
   * band that prints neither figure is a tenth progress number that only blind
   * learners are given, and it would disagree with the rig for exactly the same
   * reason the printed one did. So the label is the run's name, its goal and
   * its state, which is the whole of what is on the plate.
   */
  _label() {
    const r = this._run;
    if (!r) return;
    const state = this.state.textContent;
    this.el.setAttribute('aria-label', state
      ? t('session.band.readoutState', { goal: r.goalText, state })
      : t('session.band.readoutPlain', { goal: r.goalText }));
  }

  /** A seam closed for real — light the mark it was predicted at. */
  seamHeld() {
    this.el.classList.remove('seam');
    void this.el.offsetWidth;
    this.el.classList.add('seam');
  }

  show(v = true) { this.el.classList.toggle('show', v); }
}
