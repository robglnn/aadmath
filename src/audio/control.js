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
 */

import './audio.css';
import { t, onLocaleChange } from '../i18n/index.js';

const BARS = 5;

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
    el.addEventListener('click', (e) => {
      e.preventDefault();
      // The first click on this control is also the gesture that is allowed to
      // create the context — so it must start audio, not mute it.
      if (!bus.ready) { bus.setMuted(false); this.onFirstGesture?.(); }
      else bus.toggle();
      this._label();
    });
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

  _label() {
    const b = this.bus;
    const locked = !b.ready;
    this.el.classList.toggle('locked', locked);
    this.el.classList.toggle('off', b.muted);
    const state = locked ? t('audio.label') : (b.muted ? t('audio.off') : t('audio.on'));
    const action = b.muted || locked ? t('audio.unmute') : t('audio.mute');
    this.el.setAttribute('aria-label', `${state} — ${action}`);
    this.el.setAttribute('aria-pressed', b.muted ? 'true' : 'false');
    this.el.title = `${action} (${t('audio.hint')})`;
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
