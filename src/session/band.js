/**
 * The run band — visible pacing that is not a clock.
 *
 * A countdown clock on a mastery game is a threat. It says the same thing to a
 * learner who is finding this hard as to one who is not, and what it says is
 * "you are behind". So there is no clock anywhere in this system. What is on
 * screen instead is the thing games have always used to say *you are near the
 * end of this run*: a row of cells that fill.
 *
 *   · One cell, one tear. Countable at a glance, and it moves on every correct
 *     answer, which is roughly every forty seconds. Nothing about it moves on a
 *     wrong one — a slip costs you nothing here, it just is not a step.
 *   · The row is exactly as long as *this learner's* goal, which was sized off
 *     their own measured pace. A slower learner does not get a longer row, they
 *     get the same twenty minutes with fewer cells in it.
 *   · The seams the run is expected to close are drawn on the track as ladder
 *     marks, the way `src/ui/hud.js` draws the rank gates on the integrity
 *     meter. You can see the milestone before you reach it.
 *   · At three quarters the band goes to its `near` state: the unlit cells
 *     start to breathe and the plate takes the rank's glow. That is the whole
 *     "last chamber" signal, and it is a change in the instrument rather than a
 *     line of text telling you to hurry.
 *   · Underneath the cells, a hairline that answers to *work* rather than to
 *     result. "A wrong answer costs nothing" was true and it was not enough:
 *     measured on a learner who missed ten in a row, the band read 0 of 17 for
 *     the whole session and nothing on this instrument moved once — a wrong
 *     answer cost nothing and also showed nothing, which is the same silence a
 *     learner reads as "you are not here". So the hairline creeps on every item
 *     worked, right or wrong, and the foot names it in words. It is never a
 *     percentage and never a target: it says you are working, not that you are
 *     behind.
 *
 * Everything animated is inside `aria-live="off"`; one composed sentence is put
 * on the plate for a screen reader when the count changes.
 */
import { t } from '../i18n/index.js';

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
        <b class="sb-n">0</b>
        <span class="sb-of"></span>
        <span class="sb-work"></span>
        <span class="sb-state"></span>
      </span>`;
    this.kick = this.el.querySelector('.sb-kick');
    this.goal = this.el.querySelector('.sb-goal');
    this.track = this.el.querySelector('.sb-track');
    this.fill = this.el.querySelector('.sb-fill');
    this.headMark = this.el.querySelector('.sb-head-mark');
    this.marks = this.el.querySelector('.sb-marks');
    this.ground = this.el.querySelector('.sb-ground');
    this.workEl = this.el.querySelector('.sb-work');
    this.n = this.el.querySelector('.sb-n');
    this.of = this.el.querySelector('.sb-of');
    this.state = this.el.querySelector('.sb-state');
    root.appendChild(this.el);
    this._run = null;
    this._shown = -1;
    this._items = 0;
    this._planned = 0;
  }

  /**
   * @param {{index:number, tears:number, target:number, goalText:string,
   *          marks:number[], items:number, plannedItems:number}} run  marks are
   *          tear counts at which a seam is expected to close, 0..target
   */
  set(run) {
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
    this.kick.textContent = t('session.band.run', { n: r.index });
    this.goal.textContent = r.goalText;
    this.of.textContent = t('session.band.of', { n: r.target });
    this._shown = -1;
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
    if (tears !== this._shown) {
      this._shown = tears;
      this.n.textContent = String(tears);
      this._label();
    }
    // "You are near the end of this run", said by the instrument.
    this.el.classList.toggle('near', frac >= 0.75 && frac < 1);
    this.el.classList.toggle('full', frac >= 1);
    this.state.textContent = frac >= 1
      ? t('session.band.done')
      : (frac >= 0.75 ? t('session.band.near') : '');
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
    this.workEl.textContent = this._items > 0
      ? t('session.band.worked', { n: this._items })
      : '';
    this._label();
  }

  /**
   * One composed sentence for a screen reader. Composed, not concatenated: a
   * count and a noun glued together in English source order is exactly the bug
   * that put "MIEDŹ RANGA" on the rig, so the work read has its own whole
   * pattern rather than being appended to the tear read.
   */
  _label() {
    const r = this._run;
    if (!r) return;
    this.el.setAttribute('aria-label', this._items > 0
      ? t('session.band.readoutWorked', {
        n: r.tears, target: r.target, goal: r.goalText, items: this._items,
      })
      : t('session.band.readout', { n: r.tears, target: r.target, goal: r.goalText }));
  }

  /** A seam closed for real — light the mark it was predicted at. */
  seamHeld() {
    this.el.classList.remove('seam');
    void this.el.offsetWidth;
    this.el.classList.add('seam');
  }

  show(v = true) { this.el.classList.toggle('show', v); }
}
