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
 *
 * AND IT CAN BE WAVED AWAY. The plate never held the controls — the layer is
 * `pointer-events:none` and always has been — but "you can keep running" is
 * not the same promise as "you can make it stop". A cadet who has read this
 * chapter card, or who simply does not want it over the horizon right now,
 * presses anything and it goes. That is the difference between a flourish and
 * a thing that happens *to* you, and it costs one listener.
 */
import { t } from '../i18n/index.js';
/* A CEREMONY MARKS A MOMENT. IT DOES NOT REPORT ONE.
 *
 * This plate used to print the lifetime seal count under its rule, and it was
 * declared so the one-number gate would compare it against the engine. The gate
 * immediately caught what the declaration made visible: the plate says "3 RIFTS
 * SEALED IN ALL" and the engine says 4, because `L.tears` is the count at the
 * instant the chapter turned and the plate is still on screen several answers
 * later. A figure frozen at the moment a ceremony began is a figure that is
 * wrong for as long as the ceremony lasts.
 *
 * The fix is not to make it live — a plate whose number ticks while it is being
 * read is worse. It is that a ceremony states no figure at all. The chapter's
 * number and its title are what this plate is for; the count is in the report,
 * where it is always current because it is recomputed every time it opens.
 */
import { FIG, tagFigure, untagFigure } from './progress.js';

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

    /* Skip. Listened for in the capture phase on the window, because this
       layer takes no pointer events and never will — the key press that
       dismisses the plate is the same key press that keeps doing whatever it
       was already doing in the world. Nothing is swallowed: no
       `preventDefault`, no `stopPropagation`. The plate steps aside; the game
       does not miss a frame. */
    // …after a breath. A cadet running with W held down is pressing keys
    // continuously, and a plate that vanished on the first keydown after it
    // appeared would never be seen at all by the players most likely to earn
    // one. Six hundred milliseconds is long enough that the skip is a decision
    // and short enough that it feels instant.
    // `e.repeat` is not a decision. A cadet crossing the plateau with W
    // held down emits a keydown every 30 ms, and a ceremony that counted
    // those would not be skippable — it would be un-seeable.
    this._skip = (e) => {
      if (e && e.repeat) return;
      if (this.playing && performance.now() > this._armAt) this.hide();
    };
    this._armAt = 0;
    addEventListener('keydown', this._skip, true);
    addEventListener('mousedown', this._skip, true);
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
    this._armAt = performance.now() + 600;
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
    this.seals.textContent = '';
    untagFigure(this.seals);
    tagFigure(this.kick, FIG.CHAPTER_NO, L.n);
  }

  hide() {
    clearTimeout(this._t);
    clearTimeout(this._t2);
    this.el.classList.remove('show', 'out');
    this._live = null;
  }
}
