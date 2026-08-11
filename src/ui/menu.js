import './menu.css';
import { t, onLocaleChange } from '../i18n/index.js';

/**
 * THE MENU — the surface that was not there.
 *
 * A cold player pressed Escape, H, F1, ?, M and Tab in the first minute of this
 * game and every one of them did nothing. There was no pause, no help, no
 * settings: a thing you cannot stop and cannot ask a question of is not a game
 * a fourteen-year-old trusts. The controls card (src/player/controls.js) says
 * the five verbs once and then retires itself, which is right — but it is a
 * card that leaves, and the player who wants it back four minutes later needs
 * a door with a handle on it.
 *
 * So this is the door:
 *
 *   - **Escape opens it, from anywhere in the world.** Escape is also the key
 *     the browser uses to hand back the pointer, so it is exactly the key a
 *     stuck player already presses. It only opens when nothing else owns the
 *     frame (`input.uiOpen` is the one flag every panel in this game sets), so
 *     it can never steal an Escape from the rift, the report or the dossier.
 *     F1 opens it too, because that is where a hand raised on Windows goes.
 *   - **There is a button.** A key nobody is told about is not an affordance,
 *     so the pill sits under the progress launcher from the first frame and
 *     carries its own binding printed on it.
 *   - **It is a real pause.** The world keeps breathing behind the glass, but
 *     `input.uiOpen` is held while it is open, so nothing the player leans on
 *     while reading moves the cadet, builds a piece or fires a verb.
 *   - **It answers the three questions a lost player has**: which key does
 *     what, what opens which screen, and *what am I supposed to be doing* —
 *     the last one in one sentence, at the bottom, where a beaten player looks.
 *   - **It is where the settings live**, because "no settings" was the other
 *     half of that complaint: look speed and inverted aim, both persisted,
 *     both applied to the live input on the frame they are changed.
 *
 * Bindings come out of the bundle per input source, so a controller reads about
 * its own buttons and a phone about its own thumbs. Every string is translated;
 * the keycaps are cut on the interpunct exactly the way the controls card cuts
 * them, so a translator owns both the words and the number of caps.
 */

/** The verbs, in the order a hand meets them. `bind` names the bundle branch. */
const VERBS = [
  { id: 'move', bind: 'firstrun' },
  { id: 'look', bind: 'firstrun' },
  { id: 'jump', bind: 'firstrun' },
  { id: 'glide', bind: 'firstrun' },
  { id: 'sprint', bind: 'menu' },
  { id: 'dash', bind: 'firstrun' },
  { id: 'interact', bind: 'firstrun' },
  { id: 'build', bind: 'firstrun' },
  { id: 'recover', bind: 'firstrun' },
];

/** The screens, and the key that opens each. Keyboard only — see `_screens`. */
const SCREENS = ['progress', 'dossier', 'controls', 'menu'];

export class Menu {
  /**
   * @param {HTMLElement} root  the `#ui` layer
   * @param {object} opts
   * @param {import('../core/input.js').Input} opts.input
   * @param {() => boolean} [opts.isBusy] another surface owns the frame
   */
  constructor(root, { input, isBusy = () => false } = {}) {
    this.input = input;
    this.isBusy = isBusy;
    this.open = false;
    this._src = null;

    this.el = document.createElement('div');
    this.el.className = 'mnu';
    this.el.innerHTML = `
      <div class="mnu-scrim"></div>
      <div class="mnu-card plate" role="dialog" aria-modal="true" tabindex="-1">
        <div class="mnu-head">
          <i aria-hidden="true"></i>
          <div class="mnu-titles"><h2></h2><p class="mnu-sub"></p></div>
          <button type="button" class="mnu-resume"><b></b><span class="mnu-keys"></span></button>
        </div>
        <div class="mnu-cols">
          <section class="mnu-sec mnu-verbs"><h3></h3><ul></ul></section>
          <div class="mnu-side">
            <section class="mnu-sec mnu-screens"><h3></h3><ul></ul></section>
            <section class="mnu-sec mnu-set">
              <h3></h3>
              <label class="mnu-row mnu-slider">
                <span class="mnu-verb"></span>
                <input type="range" min="0.35" max="2.4" step="0.05" class="mnu-sens">
                <em class="mnu-val"></em>
              </label>
              <div class="mnu-row">
                <span class="mnu-verb"></span>
                <button type="button" class="mnu-toggle" aria-pressed="false"><span></span></button>
              </div>
            </section>
          </div>
        </div>
        <div class="mnu-now"><h3></h3><p></p></div>
      </div>`;
    root.appendChild(this.el);

    this.pill = document.createElement('button');
    this.pill.type = 'button';
    this.pill.className = 'mnu-pill';
    this.pill.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"/></svg><b></b><span class="mnu-keys"></span>`;
    root.appendChild(this.pill);

    this.card = this.el.querySelector('.mnu-card');
    this.h2 = this.el.querySelector('.mnu-head h2');
    this.sub = this.el.querySelector('.mnu-sub');
    this.resume = this.el.querySelector('.mnu-resume');
    this.verbList = this.el.querySelector('.mnu-verbs ul');
    this.screenList = this.el.querySelector('.mnu-screens ul');
    this.sens = this.el.querySelector('.mnu-sens');
    this.sensVal = this.el.querySelector('.mnu-val');
    this.toggle = this.el.querySelector('.mnu-toggle');
    this.nowH = this.el.querySelector('.mnu-now h3');
    this.nowP = this.el.querySelector('.mnu-now p');

    this.verbList.innerHTML = VERBS.map((v) => row(v.id)).join('');
    this.screenList.innerHTML = SCREENS.map((s) => row(s)).join('');

    // --- wiring ---------------------------------------------------------
    this.pill.addEventListener('click', () => this.toggleOpen());
    this.resume.addEventListener('click', () => this.hide());
    this.el.querySelector('.mnu-scrim').addEventListener('click', () => this.hide());
    this.sens.addEventListener('input', () => {
      this.input?.setSensitivity?.(Number(this.sens.value));
      this._paintSettings();
    });
    this.toggle.addEventListener('click', () => {
      this.input?.setInvertY?.(!this.input.invertY);
      this._paintSettings();
    });

    // CAPTURE PHASE, and that is the whole trick. Every other Escape in this
    // game is a bubble-phase listener on `window`, and they were all bound
    // before this one — so by the time a bubble-phase handler here ran, the
    // report had already closed itself and dropped `uiOpen`, and Escape read
    // as "the frame is the world's" and opened this card on top of the panel
    // it had just dismissed. On capture we get the key first, decide that the
    // frame is not ours, and hand it straight back untouched.
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.code !== 'Escape' && e.code !== 'F1') return;
      if (this.open) { this.hide(); stop(e); return; }
      // Escape belongs to whichever panel is on screen; this one only takes it
      // when the frame is otherwise the world's. (F1 asks the same question a
      // moment later, in `show()`, but never has to compete for its key.)
      if (e.code === 'Escape' && this.input?.uiOpen) return;
      if (!this.open) this.show();
      // Taken. Nothing downstream gets this key — otherwise the controls card,
      // which also closes on Escape, would be dismissed for the rest of the run
      // by the same press that opened this, and the player would have thrown
      // away the card without ever choosing to.
      if (this.open) stop(e);
    }, true);

    this.retext();
    onLocaleChange(() => { this._src = null; this.retext(); });
  }

  retext() {
    this.h2.textContent = t('menu.title');
    this.sub.textContent = t('menu.sub');
    this.resume.querySelector('b').textContent = t('menu.resume');
    this.pill.querySelector('b').textContent = t('menu.open');
    this.pill.setAttribute('aria-label', t('menu.open'));
    this.el.querySelector('.mnu-verbs h3').textContent = t('menu.controls');
    this.el.querySelector('.mnu-screens h3').textContent = t('menu.screens');
    this.el.querySelector('.mnu-set h3').textContent = t('menu.settings');
    this.el.querySelector('.mnu-slider .mnu-verb').textContent = t('menu.sens');
    this.el.querySelector('.mnu-set .mnu-row:last-child .mnu-verb').textContent = t('menu.invert');
    this.nowH.textContent = t('menu.now');
    this.card.setAttribute('aria-label', t('menu.title'));
    this._paintSettings();
    this._bindings(this._hands());
  }

  /** Whose hands are on this machine — the same predicate the controls card uses. */
  _hands() {
    const inp = this.input;
    if (!inp) return 'kbm';
    if (inp.source === 'kbm' && inp.touch?.enabled && !inp.locked && !inp.keys.size) return 'touch';
    return inp.source;
  }

  /** Print the bindings of the hands that are actually on the machine. */
  _bindings(src) {
    if (src === this._src) return;
    this._src = src;
    const s = src === 'pad' ? 'pad' : src === 'touch' ? 'touch' : 'kbm';
    for (const v of VERBS) {
      const li = this.verbList.querySelector(`li[data-v="${v.id}"]`);
      li.querySelector('.mnu-verb').textContent = t('controls.' + v.id);
      li.querySelector('.mnu-keys').innerHTML = caps(t(`${v.bind}.bind.${s}.${v.id}`));
    }
    // A screen is opened by a key or by a button on the glass. Only the
    // keyboard has keys for these, and inventing a gamepad chord that nothing
    // in the game listens for would be a lie printed in three languages.
    const keyed = s === 'kbm';
    // The handle carries its own binding, so the key is learned by anyone who
    // ever looks at the button — and by nobody who has no keys to press it with.
    this.pill.querySelector('.mnu-keys').innerHTML = keyed ? caps(t('menu.bind.kbm.menu')) : '';
    this.el.querySelector('.mnu-screens').hidden = !keyed;
    if (keyed) {
      for (const id of SCREENS) {
        const li = this.screenList.querySelector(`li[data-v="${id}"]`);
        li.querySelector('.mnu-verb').textContent = t('menu.screen.' + id);
        li.querySelector('.mnu-keys').innerHTML = caps(t('menu.bind.kbm.' + id));
      }
    }
    // The one sentence a lost player is looking for names the key that is
    // actually under their hand — E on a keyboard, X on a pad, the button on
    // a phone — composed from one pattern rather than glued together, so the
    // word order stays the translator's.
    this.nowP.textContent = t('menu.nowBody', { key: t(`firstrun.bind.${s}.interact`) });
    // Look speed and inverted aim are a mouse and a stick's settings; a thumb
    // has neither, and the row would be a dead control on a phone.
    this.el.querySelector('.mnu-set').hidden = s === 'touch';
  }

  _paintSettings() {
    const inp = this.input;
    if (!inp) return;
    this.sens.value = String(inp.sensitivity);
    this.sens.setAttribute('aria-label', t('menu.sens'));
    this.sensVal.textContent = `${Math.round(inp.sensitivity * 100)}%`; // i18n-allow: a percentage of a slider, not prose
    this.toggle.setAttribute('aria-pressed', inp.invertY ? 'true' : 'false');
    this.toggle.querySelector('span').textContent = t(inp.invertY ? 'menu.on' : 'menu.off');
  }

  toggleOpen() { this.open ? this.hide() : this.show(); }

  show() {
    if (this.open) return;
    // Somebody else already has the frame — the foundry, a session beat, a
    // rift. A pause menu that opens on top of a live keypad is not a pause.
    if (this.isBusy() || this.input?.uiOpen) return;
    this.open = true;
    this._bindings(this._hands());
    this._paintSettings();
    this.el.classList.add('show');
    this.pill.classList.add('on');
    if (this.input) this.input.uiOpen = true;
    document.exitPointerLock?.();
    // The one control a player who opened this by accident is reaching for.
    setTimeout(() => this.resume.focus({ preventScroll: true }), 40);
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    this.pill.classList.remove('on');
    // Hand the frame back — unless something else took it while we were open,
    // in which case it is not ours to hand back.
    if (this.input && !this.isBusy()) this.input.uiOpen = false;
  }

  /**
   * Start, on a controller.
   *
   * Read here rather than in the input layer because a pause button is the one
   * verb that has to work *while* the world is deaf: `Input._press` drops every
   * action the moment a panel owns the frame, so a Start routed through it
   * could open this card and never close it again. Standard mapping — button 9
   * is Start / Options / +.
   */
  _pad() {
    const gp = navigator.getGamepads?.()[0];
    const on = !!gp?.connected && !!gp.buttons[9]?.pressed;
    const edge = on && !this._padStart;
    this._padStart = on;
    if (edge) this.toggleOpen();
  }

  /** Ticked by main.js. Keeps the frame held and the bindings honest. */
  update() {
    // The handle stands aside while a panel owns the frame: a button that is
    // plainly on screen and refuses the click is worse than no button.
    this.pill.classList.toggle('away', !this.open && !!this.input?.uiOpen);
    this._pad();
    if (!this.open) return;
    // Somebody else took the frame while this was up — the report on P, the
    // dossier on J, a session beat that came due. Stand down rather than sit
    // underneath it: two stacked cards means the next Escape closes the wrong
    // one, which is how a player ends up with a panel they cannot dismiss.
    if (this.isBusy()) { this.hide(); return; }
    this._bindings(this._hands());
    // Another surface may have released `uiOpen` on its way out — a rift that
    // closed behind this card, say. While this is on screen the world stays
    // deaf, whoever else was talking.
    if (this.input && !this.input.uiOpen) this.input.uiOpen = true;
  }
}

/** This key is spoken for: no default, and nobody downstream hears it. */
function stop(e) { e.preventDefault(); e.stopPropagation(); }

function row(id) {
  return `<li data-v="${id}"><span class="mnu-verb"></span><span class="mnu-keys"></span></li>`;
}

/**
 * A binding string becomes keycaps, cut on the interpunct — the same contract
 * the controls card has with the bundle, so one translator note covers both.
 */
function caps(s) {
  return String(s).split('·')
    .map((k) => k.trim()).filter(Boolean)
    .map((k) => `<kbd>${esc(k)}</kbd>`).join('');
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
