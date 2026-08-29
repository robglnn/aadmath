import './menu.css';
import { t, onLocaleChange, LOCALES, LOCALE_SWITCH, getLocale, setLocale } from '../i18n/index.js';

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
 *     Both paths are covered — see THE ESCAPE THE BROWSER EATS below, which is
 *     the half that was missing and made the printed key a lie.
 *   - **It says what the words mean.** Every noun this game coined is on the
 *     card, one short line each. See WORDS.
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

/**
 * WORDS — every noun this game coined, in the order a player meets it.
 *
 * A cold critic counted the vocabulary on screen at the first frame: LATTICE,
 * RIFT, LINE, CIPHER MOTES, COPPER RANK. Five invented words, before a single
 * one of them meant anything. Some were defined later — rift about thirty-five
 * seconds in, mote only if you happened to walk into the foundry — and some
 * were never defined anywhere.
 *
 * The world glosses what the world can: `src/meta/lexicon.js` names a thing the
 * first time you are actually looking at one, which is the best possible way to
 * learn a noun. But the five words above are not things you look at. They are
 * printed on the chrome from the first frame — a counter, a rank chip, a title
 * card — and a caption on a chip has no room for a sentence.
 *
 * So this is the sentence. Ten rows, one line each, on the card that is one
 * key away from every frame of the game. It sits at the same surface rank as
 * the HUD that prints the words (`tools/lang/rules.mjs`), so the gate can prove
 * no term reaches a player earlier than its meaning does.
 */
const WORDS = ['rift', 'line', 'held', 'lattice', 'mote', 'rank', 'band', 'proving', 'sounding', 'plate'];

/**
 * How long after opening a repeat of the opening key is treated as the same
 * press. Chrome swallows the Escape that releases the pointer; Firefox delivers
 * it as well. Without this, the browser that does both would open the card on
 * the lock release and close it again on the keystroke, one millisecond later,
 * and Escape would look exactly as dead as it did before.
 */
const SAME_PRESS_MS = 420;

/**
 * Ours or theirs?
 *
 * A pointer lock ends for two completely different reasons and the browser
 * reports both the same way. Either the game let it go — a rift opening, a
 * session beat, this card — or the player pressed Escape. Only the second one
 * is a request for the menu, so every release the game asks for is stamped
 * here, once, by wrapping the one method that can ask for it.
 */
let letGoAt = -1e9;
if (typeof document !== 'undefined' && document.exitPointerLock && !document.__ascentExitHooked) {
  const native = document.exitPointerLock;
  document.__ascentExitHooked = true;
  document.exitPointerLock = function (...a) {
    letGoAt = performance.now();
    return native.apply(this, a);
  };
}

export class Menu {
  /**
   * @param {HTMLElement} root  the `#ui` layer
   * @param {object} opts
   * @param {import('../core/input.js').Input} opts.input
   * @param {() => boolean} [opts.isBusy] another surface owns the frame
   * @param {(id: string) => void} [opts.onScreen] open a screen named in SCREENS
   */
  constructor(root, { input, isBusy = () => false, onRecover = null, onRestart = null,
    onScreen = null } = {}) {
    this.input = input;
    this.isBusy = isBusy;
    this.onRecover = onRecover;
    this.onRestart = onRestart;
    /** Open one of the game's screens by id — see SCREENS. Wired in main.js. */
    this.onScreen = onScreen;
    this.open = false;
    this._src = null;
    this._shownAt = -1e9;
    this._wasLocked = false;
    this._byLock = false;

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
              <div class="mnu-row mnu-lang">
                <span class="mnu-verb"></span>
                <div class="langs" role="group"></div>
              </div>
              <div class="mnu-row mnu-audio">
                <span class="mnu-verb"></span>
                <div class="mnu-sound"></div>
              </div>
              <label class="mnu-row mnu-slider mnu-aim">
                <span class="mnu-verb"></span>
                <input type="range" min="0.35" max="2.4" step="0.05" class="mnu-sens">
                <em class="mnu-val"></em>
              </label>
              <div class="mnu-row mnu-aim mnu-invert">
                <span class="mnu-verb"></span>
                <button type="button" class="mnu-toggle" aria-pressed="false"><span></span></button>
              </div>
            </section>
          </div>
        </div>
        <section class="mnu-sec mnu-words">
          <h3></h3>
          <dl></dl>
        </section>
        <section class="mnu-sec mnu-out">
          <h3></h3>
          <p class="mnu-out-body"></p>
          <div class="mnu-acts">
            <button type="button" class="mnu-act mnu-recover"><b></b><span class="mnu-keys"></span></button>
            <button type="button" class="mnu-act mnu-restart"><b></b></button>
          </div>
          <p class="mnu-confirm" hidden><span></span>
            <button type="button" class="mnu-yes"></button>
            <button type="button" class="mnu-no"></button>
          </p>
        </section>
        <div class="mnu-now"><h3></h3><p></p></div>
      </div>`;
    root.appendChild(this.el);

    this.pill = document.createElement('button');
    this.pill.type = 'button';
    this.pill.className = 'mnu-pill';
    /* TWO SYMBOLS AND NO WORDS.
     *
     * This handle used to print MENU · ESC · F1 — three readable strings, in
     * the corner of every frame of the game, for a button whose shape is the
     * most universally understood control on any screen a teenager has ever
     * touched. src/ui/hud.css folds the words; they stay in the DOM for the
     * `aria-label`, and the card names its own keys the moment it opens.
     *
     * THE GLOBE IS NOT DECORATION. The locale switcher has left the glass
     * (§7.3, and the client: "languages should also be in settings"), and a
     * student who speaks Spanish and lands in English cannot read the word
     * MENU to find out that their language is behind it. A globe beside the
     * bars says "settings, and one of them is what language this is in" in no
     * language at all — and the first row inside the card is every language
     * written in its own name. */
    this.pill.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" class="mnu-globe">
        <circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>
        <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/></svg><b></b><span class="mnu-keys"></span>`;
    root.appendChild(this.pill);

    this.card = this.el.querySelector('.mnu-card');
    this.h2 = this.el.querySelector('.mnu-head h2');
    this.sub = this.el.querySelector('.mnu-sub');
    this.resume = this.el.querySelector('.mnu-resume');
    this.verbList = this.el.querySelector('.mnu-verbs ul');
    this.screenList = this.el.querySelector('.mnu-screens ul');
    this.wordList = this.el.querySelector('.mnu-words dl');
    this.langBox = this.el.querySelector('.mnu-set .langs');
    this.soundBox = this.el.querySelector('.mnu-sound');
    this.sens = this.el.querySelector('.mnu-sens');
    this.sensVal = this.el.querySelector('.mnu-val');
    this.toggle = this.el.querySelector('.mnu-toggle');
    this.nowH = this.el.querySelector('.mnu-now h3');
    this.nowP = this.el.querySelector('.mnu-now p');
    this.outSec = this.el.querySelector('.mnu-out');
    this.recoverBtn = this.el.querySelector('.mnu-recover');
    this.recoverKeys = this.el.querySelector('.mnu-recover .mnu-keys');
    this.restartBtn = this.el.querySelector('.mnu-restart');
    this.confirm = this.el.querySelector('.mnu-confirm');
    this.yesBtn = this.el.querySelector('.mnu-yes');
    this.noBtn = this.el.querySelector('.mnu-no');

    this.verbList.innerHTML = VERBS.map((v) => row(v.id)).join('');
    /* A SCREEN IS A DOOR, SO IT IS A BUTTON.
     *
     * This list used to be three lines of prose naming three keys, which made
     * every screen in the game keyboard-only from here: a thumb and a
     * controller could open this card and then read about doors they could not
     * push. The progress report's own handle is now an icon rather than a
     * caption (src/ui/hud.css), so this list is also where the WORD "progress"
     * lives — and a word that names a door had better be the door. */
    this.screenList.innerHTML = SCREENS.map((id) => screenRow(id)).join('');
    this.wordList.innerHTML = WORDS.map((w) => `<div data-w="${w}"><dt></dt><dd></dd></div>`).join('');

    // --- wiring ---------------------------------------------------------
    /* THE LANGUAGE, WRITTEN IN ITS OWN LANGUAGE.
     *
     * This control is the one that used to sit on the glass as EN / ES / PL
     * (src/ui/hud.js). It has moved here — the client asked for it and §7.3 of
     * design/FIRST-90-SECONDS.md lists it under CUT with the same destination —
     * and moving it is only half the job. A student who reads no English has to
     * be able to get out of English, so:
     *
     *   · the handle that opens this card carries a globe, in no language;
     *   · this is the FIRST row of the settings, above everything else;
     *   · and each button says its own language's name for itself — English,
     *     Español, Polski — because a flag is not a language and a two-letter
     *     code is not a name.
     *
     * The class is still `.langs` and the buttons still carry `data-loc`, so
     * every harness and every habit that ever reached for this control still
     * finds it. */
    this._langs();
    /* THE SCREENS, AS BUTTONS. Same handlers a key would reach: the game's own
     * keydown listeners are what open these, so this dispatches the key rather
     * than inventing a second way in — one path, one behaviour, nothing here
     * to drift out of step with the binding printed beside it. */
    this.screenList.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button[data-screen]') : null;
      if (!b) return;
      const id = b.dataset.screen;
      if (id === 'menu') { this.hide(); return; }
      this.hide();
      // Let the frame settle before the next surface asks for it: every panel
      // in this game refuses to open while somebody else holds `uiOpen`.
      setTimeout(() => this.onScreen?.(id), 60);
    });
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

    // --- THE WAY OUT ------------------------------------------------------
    //
    // This card listed "Recover · R" among the controls and then offered no way
    // to press it. A cold player read that line while wedged under the terrain,
    // pressed R, got nothing, and had no other door: the menu that names the
    // escape hatch has to *be* one. So the verb is a button here, and under it
    // is the only other thing a genuinely beaten player wants — start again.
    //
    // Recover closes the card first, because the whole value of it is watching
    // the cadet arrive back on solid ground; landing behind a pause screen is
    // indistinguishable from a button that did nothing, which is the failure
    // being fixed. Restart asks once, because it throws a session away.
    this.recoverBtn.addEventListener('click', () => {
      this.hide();
      this.onRecover?.('menu');
    });
    this.restartBtn.addEventListener('click', () => { this._askRestart(true); });
    this.noBtn.addEventListener('click', () => this._askRestart(false));
    this.yesBtn.addEventListener('click', () => { this._askRestart(false); this.onRestart?.(); });

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
      if (this.open) {
        // The card went up on the lock release a moment ago and this is the
        // very keystroke that released it, arriving second — Chrome swallows
        // that key, Firefox delivers it, and on Firefox the same press would
        // otherwise open the card and shut it again inside a millisecond. One
        // press, one outcome. See THE ESCAPE THE BROWSER EATS.
        if (this._byLock && performance.now() - this._shownAt < SAME_PRESS_MS) { stop(e); return; }
        this.hide(); stop(e); return;
      }
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

    // --- THE ESCAPE THE BROWSER EATS --------------------------------------
    //
    // THIS IS THE HALF THAT WAS MISSING, AND IT MADE A PRINTED KEY A LIE.
    //
    // The handler above is correct and it never ran for a real player. The
    // reason is in the specification, not in this game: while the pointer is
    // locked, the Escape that releases the lock is consumed by the browser and
    // **no keydown is delivered to the page at all**. Every player who has
    // clicked once to look around — which is every player, the game asks them
    // to — is locked. So the HUD printed MENU · ESC · F1, the card printed
    // "This menu · ESC · F1", and the first key a stuck fourteen-year-old
    // reaches for did nothing but take the mouse back. A cold critic pressed it
    // twice from a clean world, found no menu either time, and was right.
    //
    // It cannot be caught with a key listener, because there is no key. What
    // there is, is the lock ending. So that is what is listened for:
    //
    //   the lock ended  +  the game did not end it  =  the player pressed Escape
    //
    // `letGoAt` is stamped by the wrapper at the top of this file, so every
    // release the game asks for — a rift opening, a session beat, this card —
    // is known to be ours and is ignored. A release that nobody asked for is
    // theirs. `document.hasFocus()` drops the last case that is neither: a
    // task switch takes the lock away too, and a pause card discovered on
    // return from another tab is a surprise, not an answer to a question.
    //
    // None of this can open the card over another surface: `show()` refuses
    // while anything else owns the frame, and every panel in this game sets
    // `uiOpen` before it releases the pointer, so the flag is already true by
    // the time this event arrives.
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) { this._wasLocked = true; return; }
      if (!this._wasLocked) return;
      this._wasLocked = false;
      if (performance.now() - letGoAt < 400) return;   // the game let it go
      if (!document.hasFocus?.()) return;              // the window did
      this._byLock = true;                             // the player did
      this.show();
      this._byLock = this.open;
    });

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
    this.el.querySelector('.mnu-lang .mnu-verb').textContent = t('hud.language');
    this.el.querySelector('.mnu-audio .mnu-verb').textContent = t('audio.label');
    this.el.querySelector('.mnu-slider .mnu-verb').textContent = t('menu.sens');
    /* `.mnu-invert`, by name. This was `.mnu-set .mnu-aim:last-of-type`, and
       `:last-of-type` counts ELEMENT TYPES, not classes: the slider row is a
       <label> and the invert row a <div>, so both were "last of type" and
       `querySelector` returned the first — LOOK SPEED was overwritten with
       INVERT LOOK and the invert row was left with no label at all. Caught in
       the Polish settings frame; it was wrong in all three. */
    this.el.querySelector('.mnu-invert .mnu-verb').textContent = t('menu.invert');
    this._langs();
    this.el.querySelector('.mnu-words h3').textContent = t('menu.words');
    for (const w of WORDS) {
      const box = this.wordList.querySelector(`div[data-w="${w}"]`);
      box.querySelector('dt').textContent = t('menu.word.' + w);
      box.querySelector('dd').textContent = t('menu.wordIs.' + w);
    }
    this.nowH.textContent = t('menu.now');
    this.el.querySelector('.mnu-out h3').textContent = t('menu.out');
    this.el.querySelector('.mnu-out-body').textContent = t('menu.outBody');
    this.recoverBtn.querySelector('b').textContent = t('menu.recover');
    this.restartBtn.querySelector('b').textContent = t('menu.restart');
    this.confirm.querySelector('span').textContent = t('menu.restartAsk');
    this.yesBtn.textContent = t('menu.restartYes');
    this.noBtn.textContent = t('menu.restartNo');
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
    /* A screen is opened by a key or by a button. Only the keyboard has keys
       for these, and inventing a gamepad chord that nothing in the game
       listens for would be a lie printed in three languages — so the KEYCAPS
       are keyboard-only. The list itself is not: it is buttons now, and a
       thumb and a stick can push them. (The whole section used to disappear
       for everyone else, which made the progress report, the dossier and the
       controls card keyboard-only screens in a game that ships to phones.) */
    const keyed = s === 'kbm';
    // The handle carries its own binding, so the key is learned by anyone who
    // ever looks at the button — and by nobody who has no keys to press it with.
    this.pill.querySelector('.mnu-keys').innerHTML = keyed ? caps(t('menu.bind.kbm.menu')) : '';
    this.el.querySelector('.mnu-screens').hidden = false;
    // The button carries the binding, so the key is learned by whoever has one
    // and the button is still the whole affordance for whoever has not.
    this.recoverKeys.innerHTML = s === 'touch' ? '' : caps(t(`firstrun.bind.${s}.recover`));
    for (const id of SCREENS) {
      const li = this.screenList.querySelector(`li[data-v="${id}"]`);
      li.querySelector('.mnu-verb').textContent = t('menu.screen.' + id);
      li.querySelector('.mnu-keys').innerHTML = keyed ? caps(t('menu.bind.kbm.' + id)) : '';
      li.querySelector('button').setAttribute('aria-label', t('menu.screen.' + id));
    }
    // The one sentence a lost player is looking for names the key that is
    // actually under their hand — E on a keyboard, X on a pad, the button on
    // a phone — composed from one pattern rather than glued together, so the
    // word order stays the translator's.
    this.nowP.textContent = t('menu.nowBody', { key: t(`firstrun.bind.${s}.interact`) });
    /* LOOK SPEED AND INVERTED AIM ARE NOT A MOUSE'S SETTINGS ONLY.
     *
     * This whole section used to be hidden on a touch device, on the reasoning
     * that "a thumb has neither, and the row would be a dead control on a
     * phone". Read src/player/touch.js:128 — a drag to look is
     *
     *     input.look.x += (t.clientX - s.x) * 0.0052 * input.sensitivity;
     *     input.look.y += … * input.sensitivity * (input.invertY ? -1 : 1);
     *
     * Both settings apply, exactly, to the one look control a phone has. They
     * were not dead on a phone; they were hidden from the players most likely
     * to want them, because a drag-to-look that is too fast is the commonest
     * complaint a touch game gets. They stay, on every device.
     *
     * (And the section itself must stay regardless now: it holds the language
     * and the sound, which are the two settings a phone most needs.) */
  }

  /**
   * The language row. Every button says its own language's name for itself.
   *
   * Moved here from src/ui/hud.js unchanged in behaviour: same class, same
   * `data-loc`, same `setLocale`. What changed is the LABEL — the glass could
   * only afford `EN ES PL`, and a card can afford `English · Español · Polski`,
   * which is the only form a student who does not read the current language can
   * actually use.
   */
  _langs() {
    const box = this.langBox;
    if (!box) return;
    box.setAttribute('aria-label', t('hud.language'));
    box.innerHTML = LOCALES.map((l) => {
      const m = LOCALE_SWITCH[l] || { short: l.toUpperCase(), name: l, title: l };
      const on = l === getLocale();
      return `<button type="button" lang="${l}" data-loc="${l}" class="${on ? 'on' : ''}"`
        + ` title="${esc(m.title)}" aria-pressed="${on ? 'true' : 'false'}">${esc(m.name)}</button>`;
    }).join('');
    box.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => setLocale(b.dataset.loc));
    });
  }

  /**
   * TAKE THE SOUND CONTROL OFF THE GLASS AND PUT IT IN THE SETTINGS.
   *
   * The audio meter is five animated bars and a level, permanently, in the
   * corner of a game whose own audio layer says *"nothing in this game is only
   * audible"*. The client asked for it to move; §7.3 lists it under CUT with
   * the same destination.
   *
   * It is MOVED, not rebuilt. `src/audio/control.js` owns three states, a
   * level driven by arrows, wheel and drag, `prefers-reduced-motion`, and the
   * one gesture the browser will accept as permission to start audio at all —
   * none of which this file knows anything about, and all of which keep working
   * because it is the same element in a different place.
   *
   * @param {HTMLElement} el the `.sound` button src/audio/index.js built
   */
  adoptSound(el) {
    if (!el || !this.soundBox) return;
    this.soundBox.appendChild(el);
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

  /** Restart asks once. It is the only control here that cannot be undone. */
  _askRestart(on) {
    this.confirm.hidden = !on;
    this.restartBtn.hidden = !!on;
    if (on) setTimeout(() => this.noBtn.focus({ preventScroll: true }), 40);
  }

  toggleOpen() { this.open ? this.hide() : this.show(); }

  show() {
    if (this.open) return;
    // Somebody else already has the frame — the foundry, a session beat, a
    // rift. A pause menu that opens on top of a live keypad is not a pause.
    if (this.isBusy() || this.input?.uiOpen) return;
    this.open = true;
    this._shownAt = performance.now();
    this._byLock = false;
    this._bindings(this._hands());
    this._paintSettings();
    this._askRestart(false);
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

/** A screen is a door, so its row is a button. See `screenList` above. */
function screenRow(id) {
  return `<li data-v="${id}"><button type="button" data-screen="${id}">`
    + '<span class="mnu-verb"></span><span class="mnu-keys"></span></button></li>';
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
