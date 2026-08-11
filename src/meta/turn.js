/**
 * The chapter turn.
 *
 * The rite (`rite.js`) belongs to rank: letterbox, sparks, a name arriving too
 * big and settling. It is scarce on purpose and it must stay that way.
 *
 * A chapter turning is the other clock, and it happens four or five times in a
 * session — often enough that the same slam would become wallpaper, important
 * enough that a card quietly relabelling itself in the corner is not payment.
 * So this is a different gesture entirely: a rule that draws itself across the
 * frame, the chapter number set as a word above it and the act's title below,
 * and the number of tears that bought it in the corner of the rule. Nothing
 * dims, nothing letterboxes, the controls are never taken. You can be running
 * when it happens and it does not stop you running.
 *
 * 3.6 s end to end, one composited layer, no per-frame JS.
 * `prefers-reduced-motion` keeps every word and drops the travel.
 */
import { t } from '../i18n/index.js';

export class Turn {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'meta-turn';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <div class="tn-in">
        <div class="tn-kick"></div>
        <div class="tn-rule"><i></i><b class="tn-seals"></b></div>
        <div class="tn-title"></div>
      </div>`;
    this.kick = this.el.querySelector('.tn-kick');
    this.title = this.el.querySelector('.tn-title');
    this.seals = this.el.querySelector('.tn-seals');
    root.appendChild(this.el);
    this._live = null;
  }

  /** Is the plate holding the frame right now? */
  get playing() { return this.el.classList.contains('show'); }

  /** What it is showing, for a beat that has to take the frame off it. */
  get live() { return this._live ? { ...this._live } : null; }

  /** @param {number} n chapter @param {string} id act id @param {number} tears */
  play(n, id, tears) {
    this._live = { n, id, tears };
    this.retext();
    this.el.classList.remove('show', 'out');
    void this.el.offsetWidth;
    this.el.classList.add('show');
    clearTimeout(this._t);
    clearTimeout(this._t2);
    // The exit is a timer plus a transition, never an animation with a fill:
    // the reduced-motion reset collapses animations to nothing, and a filled
    // fade-out would then be over before the plate had been seen.
    this._t = setTimeout(() => this.el.classList.add('out'), 3050);
    this._t2 = setTimeout(() => {
      this.el.classList.remove('show', 'out');
      this._live = null;
    }, 3620);
  }

  retext() {
    const L = this._live;
    if (!L) return;
    this.kick.textContent = t('story.hud.act', { n: L.n });
    this.title.textContent = t(`story.${L.id}.title`);
    this.seals.textContent = t('story.hud.sealsAt', { n: L.tears });
  }

  hide() {
    clearTimeout(this._t);
    clearTimeout(this._t2);
    this.el.classList.remove('show', 'out');
    this._live = null;
  }
}
