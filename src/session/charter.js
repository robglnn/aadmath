/**
 * The opening beat: orders for this run.
 *
 * A session with no stated goal is a sandbox, and a sandbox is where the last
 * forty minutes of a school period go to die. This is the beat that says, once,
 * before anything is asked of the learner: *here is what this run is for, here
 * is how big it is, and here is roughly what it will cost you.*
 *
 * It is deliberately one screen, one control and about six seconds of reading.
 * The lines are named in the world's own words — a line is a step of the proof,
 * and where it has torn there is a rift — and the estimate is stated in plain
 * minutes, because a learner deciding whether to start is entitled to know what
 * they are agreeing to. That is the only place in the whole system where a
 * number of minutes appears. Once the run has started there is no clock
 * anywhere.
 *
 * ON A RETURN it opens differently. A game that greets a learner on day two
 * with the identical cold checklist it opened with on day one — down to "I have
 * not watched you work yet", said to somebody it watched work for twenty
 * minutes yesterday — has not noticed they came back, and noticing is most of
 * what makes them come back a third time. So when the last run left a record,
 * the card leads with what that run left standing, by name, and the estimate
 * stops apologising for being a stranger's.
 *
 * It never becomes a wall. **Any** key dismisses it, a click anywhere outside
 * it dismisses it, and BEGIN THE RUN takes focus the moment it opens, so Enter
 * and a pad's A both work without aiming at anything. A card that stands
 * between a fourteen-year-old and the game until they find the right button is
 * not an opening beat, it is a licence agreement.
 *
 * IT NO LONGER DISMISSES ITSELF, and that is the correction of a real defect.
 * This card used to start the run on its own after sixteen seconds — the
 * friendly-sounding version of taking a decision away from the person whose
 * decision it is. A cold critic met the consequence in the exact words that
 * make it indefensible:
 *
 *   "ORDERS re-issued mid-run and auto-dismissed before I could click
 *    BEGIN THE RUN."
 *
 * Sixteen seconds is a long time to stare at a card and no time at all to read
 * one in your second language, decide, and reach for the mouse. The one screen
 * in the game that asks *do you want to start this* is the last screen that
 * should answer for you. A beat with a button on it waits for the button. The
 * escape hatch was never the timer anyway: it is that literally any input
 * clears this card, which is why it cannot become a wall.
 */
import { t } from '../i18n/index.js';
import { FIG, tagFigure } from '../meta/progress.js';

/**
 * How long after this card appears no input can dismiss it. Milliseconds.
 *
 * Long enough that a keystroke or a click already on its way to the world
 * cannot eat the card; short enough that a player who wants past it never
 * waits. Nothing here is a timer that ACTS — the run still never starts
 * without a decision.
 */
const GRACE = 700;

export class Charter {
  constructor(root, { onBegin }) {
    this.el = document.createElement('div');
    this.el.className = 'ses-charter';
    this.el.innerHTML = `
      <div class="sc-dim"></div>
      <div class="sc-card" role="dialog" aria-modal="true">
        <p class="sc-back"></p>
        <div class="sc-kick"></div>
        <h2 class="sc-title"></h2>
        <div class="sc-rule"><i></i></div>
        <p class="sc-goal"></p>
        <ul class="sc-seams"></ul>
        <p class="sc-mark"></p>
        <p class="sc-eta"></p>
        <p class="sc-work"></p>
        <button type="button" class="sc-go"></button>
      </div>`;
    this.card = this.el.querySelector('.sc-card');
    this.back = this.el.querySelector('.sc-back');
    this.kick = this.el.querySelector('.sc-kick');
    this.title = this.el.querySelector('.sc-title');
    this.goal = this.el.querySelector('.sc-goal');
    this.seams = this.el.querySelector('.sc-seams');
    this.mark = this.el.querySelector('.sc-mark');
    this.eta = this.el.querySelector('.sc-eta');
    this.work = this.el.querySelector('.sc-work');
    this.go = this.el.querySelector('.sc-go');
    /* An aimed click on the button IS the decision, and it is not something a
       player does by accident, so it is never held back. A click with no
       pointer behind it (`detail === 0`) is the browser turning Space or Enter
       on the focused button into a click, which is a key — and a key that was
       in the air when the card opened has to obey the same rule as any other. */
    this.go.addEventListener('click', (e) => {
      if (e.detail === 0 && !this._canAct(null)) return;
      this.begin();
    });
    this.el.addEventListener('click', (e) => {
      if (!this._canAct(null)) return;      // a click aimed at the world, in flight
      if (e.target === this.el || e.target.className === 'sc-dim') this.begin();
    });
    /* ANY KEY AT ALL — BUT NOT A KEY THAT WAS ALREADY IN THE AIR.
     *
     * "Any key dismisses it" was written as the escape hatch that stops this
     * card being a wall, and as a wall-breaker it is right. As written it was
     * also the mechanism of the exact defect it was supposed to have fixed:
     *
     *   "ORDERS re-issued mid-run and auto-dismissed before I could click
     *    BEGIN THE RUN."
     *
     * Nothing auto-dismissed. The card opened on a keyboard that was already
     * being used — a held W repeating, a jump landing, the tail of the
     * keystroke that got here — and the very next event on the queue closed it
     * before a single frame of it had been read. From the player's chair that
     * is indistinguishable from a timer, and it is worse than a timer, because
     * it fires in milliseconds rather than seconds.
     *
     * Three tests, and the card is still not a wall:
     *   · `e.repeat` is not a decision. A finger that has been down for two
     *     seconds is one press, and it was pressed before this card existed.
     *   · a key that was ALREADY DOWN when the card opened is not a decision
     *     either — its keydown belongs to whatever the player was doing a
     *     moment ago. It has to be lifted and pressed again to mean anything
     *     here. (`_downAtOpen`, filled from the live input set on show().)
     *   · and for the first `GRACE` ms nothing at all dismisses it, because a
     *     keystroke in flight when the card appeared was aimed at the world.
     *
     * GRACE is 700 ms: under a second, so it cannot be felt as a lock, and
     * longer than any input queue, so it cannot be raced. */
    this._keys = (e) => {
      if (!this.open || !this._canAct(e.code)) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.repeat) return;
      e.stopPropagation();
      this.begin();
    };
    addEventListener('keydown', this._keys);
    this._openedAt = 0;
    this._downAtOpen = new Set();
    /* The card keeps its own record of what is under the player's fingers
       rather than reading somebody else's, in the capture phase and before its
       own handler, so the answer is true at the instant it is asked. */
    this._held = new Set();
    addEventListener('keydown', (e) => { if (e.isTrusted !== false) this._held.add(e.code); }, true);
    addEventListener('keyup', (e) => {
      this._held.delete(e.code);
      this._downAtOpen.delete(e.code);   // lifted: the next press is a decision
    }, true);
    // A window that loses focus never delivers the keyup, and a key recorded
    // as still down forever is a key that could never dismiss this card again.
    addEventListener('blur', () => { this._held.clear(); this._downAtOpen.clear(); });
    this._onBegin = onBegin;
    root.appendChild(this.el);
    this._live = null;
  }

  get open() { return this.el.classList.contains('show'); }

  /**
   * Is this input a decision the player made about THIS card?
   *
   * @param {string|null} code the key, or null for a pointer
   */
  _canAct(code) {
    if (performance.now() - this._openedAt < GRACE) return false;
    if (code && this._downAtOpen.has(code)) return false;
    return true;
  }

  /**
   * @param {{index:number, target:number, seams:Array<{id:string,hold:boolean}>,
   *          minutes:number, goalText:string, seeded:boolean,
   *          back:{tears:number, held:string[], index:number}|null}} plan
   */
  show(plan) {
    this._live = plan;
    this.retext();
    this.el.classList.add('show');
    // Focus, and no timer. The run starts when the cadet says so — see the
    // header for why the sixteen-second auto-begin that used to live on this
    // line is gone.
    // Whatever is under their fingers RIGHT NOW belongs to the world, not to
    // this card, and the grace window starts here. See `_canAct`.
    this._openedAt = performance.now();
    this._downAtOpen = new Set(this._held);
    requestAnimationFrame(() => this.go.focus({ preventScroll: true }));
  }

  retext() {
    const p = this._live;
    if (!p) return;
    // The return beat, when there is one to give.
    this.back.textContent = p.back ? backLine(p.back) : '';
    this.el.classList.toggle('back', !!p.back);
    this.kick.textContent = t(p.back ? 'session.charter.kickBack' : 'session.charter.kick', { n: p.index });
    this.title.textContent = t('session.charter.title');
    // A thunk re-renders in the locale that is loaded *now*; a plain string is
    // whatever locale was loaded when the card opened.
    this.goal.textContent = typeof p.goalText === 'function' ? p.goalText() : p.goalText;
    /* The goal sentence names how many rifts this run asks for, and that number
       is the same `run.target` the band prints for the next twenty minutes. It
       is tagged so tools/critic/oneprogress.mjs can prove the two agree — the
       cold critic read "Seal 16 rifts" here and a band that said something else
       later, and nothing in the build had ever compared them. */
    tagFigure(this.goal, FIG.RUN_TARGET, p.target);
    this.seams.innerHTML = p.seams.map((s) => `
      <li class="${s.hold ? 'hold' : ''}">
        <i aria-hidden="true"></i>
        <b>${escape(t('skills.' + s.id))}</b>
        <span>${escape(t(s.hold ? 'session.charter.willHold' : 'session.charter.willPush'))}</span>
      </li>`).join('');
    /* …and where it is. A goal a learner cannot walk to is a goal they will
       wander looking for, which is exactly the session the client reported.
       Five whole sentences rather than a bearing word dropped into a slot,
       because "51 m ahead" and "51 m to your left" put the distance in
       different places in Spanish and Polish, and word order belongs to the
       language. */
    const m = typeof p.mark === 'function' ? p.mark() : p.mark;
    const where = m && Number.isFinite(m.metres) ? m.where : null;
    this.mark.textContent = where ? t('session.charter.mark.' + where, { n: m.metres }) : '';
    this.mark.hidden = !where;

    // The estimate is honest about being an estimate, and about whose pace it
    // was measured on — the first session has not measured anything yet.
    this.eta.textContent = t(p.seeded ? 'session.charter.etaSeed' : 'session.charter.eta', {
      n: p.minutes, tears: p.target,
    });
    /* …AND WHAT IT COSTS, NOT ONLY WHAT IT BUYS.
       "Seal 16 rifts" is the goal, and a rift is a question ANSWERED CORRECTLY,
       so it was never the amount of work: the projection that produced the 16
       had planned 24 questions and only the 16 was ever on this card. A cold
       reader called that quoting a player two thirds of the real workload, and
       they are right — a fourteen-year-old deciding whether to start is reading
       this number as "how much is this going to be".
       It is a range because twenty-one trials of the real engine produce a
       range, and `session.voice.longer` corrects it out loud if the run passes
       the top of it. A single number here would be a promise the projection is
       not entitled to make. (src/session/estimate.js, src/session/index.js) */
    const lo = p.itemsLow, hi = p.itemsHigh;
    const hasWork = Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo && hi > 0;
    this.work.textContent = hasWork ? t('session.charter.work', { low: lo, high: hi }) : '';
    this.work.hidden = !hasWork;
    this.go.textContent = t('session.charter.begin');
  }

  begin() {
    if (!this.open) return;
    this.hide();
    this._onBegin?.();
  }

  hide() {
    this.el.classList.remove('show');
    this._live = null;
  }
}

/** What the last run left standing, said once, in one sentence. */
function backLine(b) {
  const held = b.held || [];
  if (held.length >= 2) return t('session.charter.backHeldN', { n: held.length, tears: b.tears });
  if (held.length === 1) {
    return t('session.charter.backHeld', { n: b.tears, skill: t('skills.' + held[0]) });
  }
  return t('session.charter.backNone', { n: b.tears });
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
