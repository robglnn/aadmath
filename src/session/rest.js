/**
 * The break beat, and the clean stopping point.
 *
 * A break that is not a rest is worse than no break at all. Cutting to a menu,
 * a leaderboard or a shop asks the same attention that was just spent for
 * twenty minutes to keep working, which is exactly the thing a Pomodoro break
 * exists to stop. So this surface is built out of the two interventions that
 * actually restore directed attention rather than merely interrupting it:
 *
 *   · DISTANCE. The world stays on screen and keeps moving — the cloud deck,
 *     the grass, the sea. Nothing is asked of it and nothing can be clicked in
 *     it. Looking at something a long way off relaxes the ciliary muscle and
 *     drops accommodative load; it is the whole of the 20-20-20 rule, and it is
 *     the one restful thing a 3D game can do that a worksheet cannot.
 *   · SLOW BREATHING. The ring paces four seconds in, two held, six out — five
 *     breaths a minute, at the low end where paced breathing reliably raises
 *     vagal tone and drops arousal. It is a ring, not a coach: after the first
 *     line there is no text to read.
 *
 * Then it stops properly. A game that will not let you leave is a game you
 * resent, so the break ends on a card that says the shard is holding, offers
 * the next run and offers, equally, to close the channel — and closing it is a
 * real ending with a real last line, not a modal you dismiss.
 *
 * Nothing here is on a countdown. The arc at the foot fills, once, and it is
 * driven from the frame loop rather than by a CSS transition so that a learner
 * who has asked the OS for reduced motion still gets an honest progress read
 * instead of a bar that snapped to full on the first frame.
 */
import { t } from '../i18n/index.js';

/** Long enough to be a rest, short enough that nobody sits it out twice. */
export const REST_SECONDS = 165;
/** …and after this long they have had the useful part, so let them go. */
const SKIP_AFTER = 40;
/**
 * Nothing dismisses this beat for this long after it opens.
 *
 * It is a quarter of the close card's window, not the same number, and the
 * difference is the point. The close card's 700 ms exists because the keystroke
 * that sealed the last tear is genuinely still in the queue when it opens.
 * Nothing is in flight when THIS beat opens except the Escape that dismissed
 * the card above it, and that one event is already stopped dead by
 * `stopImmediatePropagation` in `resolution.js` — so a long window here would
 * buy nothing and cost the one thing that matters: a player who presses Escape
 * twice in a second, meaning it both times, has to be let out.
 */
const GRACE = 250;

/**
 * A BREAK YOU CANNOT LEAVE IS NOT A BREAK.
 *
 * This beat had no key handler either. It runs for `REST_SECONDS` — two and
 * three quarter minutes — and `src/session/index.js` holds `input.uiOpen` for
 * every second of it, which on a phone means no controls at all. Its one early
 * exit, the SKIP button, is drawn at `opacity: 0` until `SKIP_AFTER`, so for
 * the first forty seconds there is nothing on screen to press and no key that
 * does anything. Then it ends on a card that waits for a click forever, and
 * the two roads off that card both lead back into a new run: **there was no
 * road from here to the world at all.**
 *
 * Escape is that road, at any phase of the beat, in one press.
 */

export class Rest {
  constructor(root, { onDone, onAnother, onClose, onDismiss }) {
    this.el = document.createElement('div');
    this.el.className = 'ses-rest';
    this.el.innerHTML = `
      <div class="sr-scrim"></div>
      <div class="sr-stage">
        <div class="sr-ring"><i class="r1"></i><i class="r2"></i><i class="r3"></i></div>
        <p class="sr-say"></p>
        <button type="button" class="sr-skip"></button>
      </div>
      <button type="button" class="sr-esc"><span></span><kbd></kbd></button>
      <div class="sr-arc"><i></i></div>
      <div class="sr-end" role="dialog" aria-modal="true">
        <div class="sr-e-kick"></div>
        <h2 class="sr-e-title"></h2>
        <p class="sr-e-body"></p>
        <div class="sr-e-acts">
          <button type="button" class="sr-again"></button>
          <button type="button" class="sr-off"></button>
        </div>
      </div>
      <div class="sr-off-frame"><p></p><button type="button"></button></div>`;
    this.say = this.el.querySelector('.sr-say');
    this.skip = this.el.querySelector('.sr-skip');
    this.arc = this.el.querySelector('.sr-arc i');
    this.eKick = this.el.querySelector('.sr-e-kick');
    this.eTitle = this.el.querySelector('.sr-e-title');
    this.eBody = this.el.querySelector('.sr-e-body');
    this.again = this.el.querySelector('.sr-again');
    this.off = this.el.querySelector('.sr-off');
    this.offFrame = this.el.querySelector('.sr-off-frame');
    this.offLine = this.offFrame.querySelector('p');
    this.offBack = this.offFrame.querySelector('button');

    /* A BUTTON, NOT A LINE OF TYPE. `uiOpen` sets `#touchpad` to `display: none`
       (src/core/input.js -> src/player/touch.js), and a phone has no Escape key,
       so on touch this beat had NOTHING that could be pressed for the first
       forty seconds. This is that thing. It is deliberately not `.sr-skip` with
       a shortcut bolted on: SKIP ends the breathing and offers another run,
       this gives the world back. */
    this.escLine = this.el.querySelector('.sr-esc');
    this.escLabel = this.el.querySelector('.sr-esc span');
    this.escKey = this.el.querySelector('.sr-esc kbd');
    this.escLine.addEventListener('click', () => this._leave());

    this.skip.addEventListener('click', () => this._finish());
    this.again.addEventListener('click', () => { this.hide(); onAnother?.(); });
    this.off.addEventListener('click', () => this._standDown());
    this.offBack.addEventListener('click', () => { this.hide(); onAnother?.(); });
    root.appendChild(this.el);

    this._onDone = onDone;
    this._onClose = onClose;
    this._onDismiss = onDismiss;
    this._openedAt = 0;
    this.phase = 'off';
    this.t = 0;

    /* ESCAPE LEAVES THE BREAK, from any phase of it, in one press. Capture, for
       the same reason the close card takes it in capture: the menu hands Escape
       back whenever `uiOpen` is true, so nothing downstream would ever have got
       it. It is not the SKIP button with a shortcut on it — SKIP ends the
       breathing and shows the card that offers another run, which is a
       different verb. This one gives the world back. */
    addEventListener('keydown', (e) => {
      if (!this.open || e.repeat || e.code !== 'Escape') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (performance.now() - this._openedAt < GRACE) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this._leave();
    }, true);
  }

  /** The one road from this beat back to the world. Escape, or the button. */
  _leave() {
    if (!this.open) return;
    this.hide();
    this._onDismiss?.();
  }

  get open() { return this.phase !== 'off'; }
  /** True while the break is genuinely resting — nothing should interrupt it. */
  get resting() { return this.phase === 'breathe'; }

  show(report) {
    this._report = report || null;
    this.phase = 'breathe';
    this.t = 0;
    this.retext();
    this.el.classList.remove('ended', 'closed', 'lettergo');
    this.el.classList.add('show');
    this._openedAt = performance.now();
    this.arc.style.width = '0%';
    /* FOCUS GOES TO A CONTROL THE PLAYER CAN SEE.
       It used to go to `.sr-skip`, which is drawn at `opacity: 0` for the first
       `SKIP_AFTER` seconds — so the keyboard's Enter was wired to a button
       nobody could see, and pressing it in the first forty seconds skipped the
       break with nothing on screen to say what had happened. `.sr-esc` is on
       the glass from this frame, it says what it does, and it carries the same
       key Escape does. `_finish()` moves focus on to ANOTHER RUN as before. */
    requestAnimationFrame(() => this.escLine.focus({ preventScroll: true }));
  }

  update(dt) {
    if (this.phase !== 'breathe') return;
    this.t += dt;
    const k = Math.max(0, Math.min(1, this.t / REST_SECONDS));
    this.arc.style.width = `${(k * 100).toFixed(2)}%`;
    // The first line is read once and then gets out of the way; a break with
    // words on it for two and a half minutes is not a break.
    this.el.classList.toggle('quiet', this.t > 13);
    this.el.classList.toggle('lettergo', this.t > SKIP_AFTER);
    if (k >= 1) this._finish();
  }

  _finish() {
    if (this.phase !== 'breathe') return;
    this.phase = 'end';
    this.el.classList.add('ended');
    this.arc.style.width = '100%';
    this._onDone?.();
    requestAnimationFrame(() => this.again.focus({ preventScroll: true }));
  }

  _standDown() {
    this.phase = 'closed';
    this.el.classList.add('closed');
    this._onClose?.();
    requestAnimationFrame(() => this.offBack.focus({ preventScroll: true }));
  }

  retext() {
    this.say.textContent = t('session.rest.say');
    this.skip.textContent = t('session.rest.skip');
    this.eKick.textContent = t('session.rest.endKick');
    this.eTitle.textContent = t('session.rest.endTitle');
    this.eBody.textContent = this._report?.next
      ? t('session.rest.endBodyNext', { skill: t('skills.' + this._report.next.id) })
      : t('session.rest.endBody');
    this.again.textContent = t('session.rest.again');
    this.off.textContent = t('session.rest.off');
    this.offLine.textContent = t('session.rest.signOff');
    this.offBack.textContent = t('session.rest.wakeUp');
    /* The way out, printed from the first frame of the beat — because the only
       other one is invisible for forty seconds. */
    this.escLabel.textContent = t('session.rest.leave');
    this.escKey.textContent = t('session.rest.leaveKey');
    this.escLine.setAttribute('aria-keyshortcuts', 'Escape');
    this.el.querySelector('.sr-stage').setAttribute('aria-label', t('session.rest.aria'));
  }

  hide() {
    this.phase = 'off';
    this.el.classList.remove('show', 'ended', 'closed', 'quiet', 'lettergo');
  }
}
