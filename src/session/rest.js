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

export class Rest {
  constructor(root, { onDone, onAnother, onClose }) {
    this.el = document.createElement('div');
    this.el.className = 'ses-rest';
    this.el.innerHTML = `
      <div class="sr-scrim"></div>
      <div class="sr-stage">
        <div class="sr-ring"><i class="r1"></i><i class="r2"></i><i class="r3"></i></div>
        <p class="sr-say"></p>
        <button type="button" class="sr-skip"></button>
      </div>
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

    this.skip.addEventListener('click', () => this._finish());
    this.again.addEventListener('click', () => { this.hide(); onAnother?.(); });
    this.off.addEventListener('click', () => this._standDown());
    this.offBack.addEventListener('click', () => { this.hide(); onAnother?.(); });
    root.appendChild(this.el);

    this._onDone = onDone;
    this._onClose = onClose;
    this.phase = 'off';
    this.t = 0;
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
    this.arc.style.width = '0%';
    requestAnimationFrame(() => this.skip.focus({ preventScroll: true }));
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
    this.el.querySelector('.sr-stage').setAttribute('aria-label', t('session.rest.aria'));
  }

  hide() {
    this.phase = 'off';
    this.el.classList.remove('show', 'ended', 'closed', 'quiet', 'lettergo');
  }
}
