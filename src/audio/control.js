/**
 * The mute control, and the only audio-reactive pixels in the game.
 *
 * Three states, and it is important that they are three and not two:
 *
 *   locked   the browser has not yet seen a gesture, so there is no context to
 *            speak of. The control says "sound, waiting" rather than lying
 *            about being on.
 *   on       running. Five bars track the low half of the spectrum, which is
 *            enough to see the score breathing and the footsteps land.
 *   off      muted, persisted, and the graph is suspended behind it.
 *
 * `prefers-reduced-motion` is honoured properly rather than nominally: the
 * bars are not merely frozen in CSS, the analyser is never polled at all, so a
 * player who asked for stillness also stops paying for the copy out of the
 * audio thread every frame.
 *
 * ── AND IT IS A LEVEL, NOT A SWITCH ─────────────────────────────────────────
 *
 * A game whose only audio control is mute has two settings, and the one a
 * learner in a shared classroom, a library or a bedroom at eleven at night
 * actually wants — *quieter* — is not one of them. The whole of this control's
 * new half is therefore volume, and it is added without a single new string,
 * because the audio layer owns `src/audio` and not `src/i18n`:
 *
 *   · the arrow keys, Home and End, while the control has focus;
 *   · the wheel over it;
 *   · a drag across the meter, which is already five bars wide and is now also
 *     the track it looks like;
 *   · and the number is spoken by `Intl.NumberFormat`, in the learner's own
 *     locale, which needs no translation because it is not a word.
 *
 * A click still means mute, because that is what a speaker icon has meant for
 * thirty years. Dropping the level to zero mutes, and raising it from zero
 * unmutes, so the control can never sit lit and unmuted and silent.
 *
 * NOTHING IN THIS GAME IS ONLY AUDIBLE. Every sound the layer makes is beside
 * something already drawn — a card, a flash, a light, a number — so a learner
 * who leaves this at zero loses atmosphere and loses no information at all.
 */

import './audio.css';
import { t, onLocaleChange, pct } from '../i18n/index.js';

const BARS = 5;
/** One press of an arrow key, one notch of a wheel. */
const STEP = 0.1;

export class SoundControl {
  constructor(root, bus) {
    this.bus = bus;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sound locked';
    el.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h3.4L12 5.6v12.8L7.4 14.5H4z"/>
        <path class="wave" d="M15.6 9.4a3.6 3.6 0 0 1 0 5.2"/>
        <path class="wave" d="M18.1 7a7 7 0 0 1 0 10"/>
        <path class="slash" d="M15.6 9.4 21 15"/>
        <path class="slash" d="M21 9.4 15.6 15"/>
      </svg>
      <span class="meter">${'<i></i>'.repeat(BARS)}</span>`;
    root.appendChild(el);

    this.el = el;
    this.bars = [...el.querySelectorAll('.meter i')];
    this.meterEl = el.querySelector('.meter');
    el.addEventListener('click', (e) => {
      // A click that ended a drag across the meter set a level; it must not
      // also toggle mute on the way up.
      if (this._dragged) { this._dragged = false; e.preventDefault(); return; }
      e.preventDefault();
      // The first click on this control is also the gesture that is allowed to
      // create the context — so it must start audio, not mute it.
      if (!bus.ready) { bus.setMuted(false); this.onFirstGesture?.(); }
      else bus.toggle();
      this._label();
    });

    // --- the level ---------------------------------------------------------
    // Keys first, because a control that can only be driven with a mouse is a
    // control half this game's players cannot reach: the pointer is locked for
    // most of a session and a gamepad has no cursor at all.
    el.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      let d = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = STEP;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -STEP;
      else if (e.key === 'Home') { this._set(0); e.preventDefault(); return; }
      else if (e.key === 'End') { this._set(1); e.preventDefault(); return; }
      if (!d) return;
      e.preventDefault();
      if (!bus.ready) { this.onFirstGesture?.(); }
      bus.nudge(d);
      this._label();
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!bus.ready) { this.onFirstGesture?.(); }
      bus.nudge(e.deltaY > 0 ? -STEP : STEP);
      this._label();
    }, { passive: false });

    // …and a drag across the five bars, which already look like a track.
    const fromX = (ev) => {
      const r = this.meterEl.getBoundingClientRect();
      if (!r.width) return null;
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    };
    this.meterEl.addEventListener('pointerdown', (e) => {
      const v = fromX(e);
      if (v === null) return;
      e.stopPropagation();
      this._drag = e.pointerId;
      this._dragged = false;
      try { this.meterEl.setPointerCapture(e.pointerId); } catch { /* older engine */ }
      if (!bus.ready) this.onFirstGesture?.();
    });
    this.meterEl.addEventListener('pointermove', (e) => {
      if (this._drag !== e.pointerId) return;
      const v = fromX(e);
      if (v === null) return;
      this._dragged = true;
      this._set(v);
    });
    const end = (e) => {
      if (this._drag !== e.pointerId) return;
      this._drag = null;
      try { this.meterEl.releasePointerCapture(e.pointerId); } catch { /* gone */ }
    };
    this.meterEl.addEventListener('pointerup', end);
    this.meterEl.addEventListener('pointercancel', end);
    // Hover on the control itself is the one place a UI sound would be
    // circular, so it is silent by design.

    bus.onChange(() => this._label());
    onLocaleChange(() => this._label());
    this._label();

    // The meter is polled on a timer, not on the frame loop: it is a two-
    // millimetre widget and it has no business costing anything at 120 Hz.
    if (!this.reduced) {
      this._timer = setInterval(() => this._meter(), 60);
    }
  }

  _set(v) {
    this.bus.setVolume(v);
    this._label();
  }

  /**
   * The percentage, in the learner's own locale and in no language at all.
   * `src/i18n` already formats one — it is a number, not a word, which is
   * exactly why this control can carry a level without the bundle carrying a
   * string for it.
   */
  _pct() {
    return pct(this.bus.muted ? 0 : this.bus.volume);
  }

  _label() {
    const b = this.bus;
    const locked = !b.ready;
    this.el.classList.toggle('locked', locked);
    this.el.classList.toggle('off', b.muted);
    const state = locked ? t('audio.label') : (b.muted ? t('audio.off') : t('audio.on'));
    const action = b.muted || locked ? t('audio.unmute') : t('audio.mute');
    const pct = this._pct();
    this.el.setAttribute('aria-label', locked ? `${state} — ${action}` : `${state} ${pct} — ${action}`);
    this.el.setAttribute('aria-pressed', b.muted ? 'true' : 'false');
    this.el.setAttribute('aria-valuenow', String(Math.round((b.muted ? 0 : b.volume) * 100)));
    this.el.setAttribute('aria-valuetext', pct);
    this.el.title = `${action} (${t('audio.hint')})`;
    // How far the five bars are lit is the level, so the control shows what it
    // is set to even while nothing is playing through it.
    this.el.style.setProperty('--vol', (b.muted ? 0 : b.volume).toFixed(3));
  }

  _meter() {
    const b = this.bus;
    if (!b.ready || b.muted || document.hidden) {
      if (this._wasLive) {
        for (const i of this.bars) i.style.setProperty('--v', 1);
        this._wasLive = false;
      }
      return;
    }
    this._wasLive = true;
    b.analyser.getByteFrequencyData(b.meter);
    const n = b.meter.length;
    for (let k = 0; k < BARS; k++) {
      // Logarithmic bins: the interesting half of this game's spectrum is
      // below 2 kHz, and a linear split would give four bars of silence.
      const a = Math.floor((n * 0.5) * (k / BARS) ** 1.7) + 1;
      const c = Math.floor((n * 0.5) * ((k + 1) / BARS) ** 1.7) + 2;
      let s = 0, m = 0;
      for (let i = a; i < c && i < n; i++) { s += b.meter[i]; m++; }
      const v = m ? s / m / 255 : 0;
      this.bars[k].style.setProperty('--v', (1 + v * 5.4).toFixed(2));
    }
  }

  dispose() { clearInterval(this._timer); this.el.remove(); }
}
