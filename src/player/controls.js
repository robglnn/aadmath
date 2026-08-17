import './controls.css';
import { t, onLocaleChange } from '../i18n/index.js';

/**
 * FIRST CONTACT — the verbs, on screen, before the player needs them.
 *
 * A cold player was told nothing about how to move for the first sixty seconds
 * of this game. Sixty seconds in there were five proper nouns on the screen and
 * not one verb, and the only people who got past it were the ones who already
 * knew what a third-person game does with WASD. That is not a difficulty
 * curve, it is a door with no handle.
 *
 * So: the core verbs, in the world's own plate language, in the corner where
 * nothing else lives, from the fourth second. And then the two things that
 * make it not a tutorial popup —
 *
 *   1. **Each row retires when you do it.** Run, and MOVE ticks and goes dim.
 *      Look around, and LOOK goes. When the last one goes the card leaves on
 *      its own. Nobody has to dismiss a lesson they already finished, and the
 *      card is never on screen for a verb the player has already got.
 *   2. **It is never permanent and never lost.** GOT IT, Escape or `?` closes
 *      it; `?` or the pill in the corner brings it back at any point in the
 *      run, which is what you actually want three minutes later when you have
 *      forgotten which key the wing was on.
 *
 * The bindings come out of the bundle per input source, so a controller reads
 * about its own buttons and a phone reads about its own thumbs — and every one
 * of them is a translated string, because SPACE is a word in three languages.
 */

/** The five the brief names, plus the two that are not discoverable at all. */
const CORE = ['move', 'look', 'jump', 'glide', 'interact'];
// …plus dash, which moved the cadet and appeared on nothing. A critic met it
// as "an uncommunicated backward dash" and blamed the interact key for it.
// …and sprint, which was on no card at all. A cold critic finished a session
// and reported "sprint is hidden": the menu prints it, but the menu is the one
// surface a player has to go and find. Shift is how you cross a shard, and a
// movement verb that only the pause screen knows about is a movement verb
// nobody has. (i18n, additive: `firstrun.bind.*.sprint` in all three bundles.)
const TAIL = ['build', 'sprint', 'dash', 'recover'];

/**
 * How long after the boot curtain the card arrives. Seconds.
 *
 * Early enough that it is on screen before a cold player's hand has done
 * anything at all, and late enough that the cold open's title has landed.
 */
const OPEN_AT = 1.5;
/** A verb has to be held for this long to count as performed. Seconds. */
const HOLD = 0.42;

export class ControlsCard {
  constructor(root, { input, player, builder = null, onRecover = null } = {}) {
    this.input = input;
    this.player = player;
    this.builder = builder;
    this.onRecover = onRecover;

    this.el = document.createElement('div');
    this.el.className = 'fc';
    this.el.innerHTML = `
      <div class="fc-card plate" role="group">
        <div class="fc-head"><i aria-hidden="true"></i><h3></h3>
          <button type="button" class="fc-x"></button></div>
        <div class="fc-note" hidden><strong></strong><span></span></div>
        <ul class="fc-rows">${CORE.map((v) => row(v)).join('')}</ul>
        <ul class="fc-rows tail">${TAIL.map((v) => row(v)).join('')}</ul>
      </div>`;
    root.appendChild(this.el);

    this.pill = document.createElement('button');
    this.pill.type = 'button';
    this.pill.className = 'fc-pill';
    this.pill.textContent = '?';   // i18n-allow: the universal help glyph, not a word
    root.appendChild(this.pill);

    this.stuckEl = document.createElement('div');
    this.stuckEl.className = 'fcs';
    this.stuckEl.innerHTML = `
      <div class="fc-card plate" role="alert">
        <h3></h3><p></p><button type="button"><span class="fc-keys"></span><b></b></button>
      </div>`;
    root.appendChild(this.stuckEl);

    this.head = this.el.querySelector('h3');
    this.note = this.el.querySelector('.fc-note');
    this.noteTitle = this.note.querySelector('strong');
    this.noteBody = this.note.querySelector('span');
    this.dismissBtn = this.el.querySelector('.fc-x');
    this.rows = Object.fromEntries([...this.el.querySelectorAll('li')]
      .map((li) => [li.dataset.v, li]));
    this.sTitle = this.stuckEl.querySelector('h3');
    this.sBody = this.stuckEl.querySelector('p');
    this.sBtn = this.stuckEl.querySelector('button');
    this.sBtnKeys = this.stuckEl.querySelector('button .fc-keys');
    this.sBtnLabel = this.stuckEl.querySelector('button b');

    this.done = new Set();
    this.open = false;
    this.dismissed = false;
    this._t = 0;
    this._started = false;
    this._src = null;
    this._hold = { move: 0, look: 0 };
    this._look = 0;
    this._blocked = false;        // the browser refused the mouse; say so once

    this.dismissBtn.addEventListener('click', () => this.hide(true));
    this.pill.addEventListener('click', () => this.show());
    this.sBtn.addEventListener('click', () => this.onRecover?.('button'));
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      // "?" is the help key everywhere else a person has ever used a computer.
      if (e.code === 'Slash') { this.open ? this.hide(true) : this.show(); e.preventDefault(); }
      else if (e.code === 'Escape' && this.open) this.hide(true);
    });

    this.retext();
    onLocaleChange(() => this.retext());
  }

  /** Called once the boot curtain is gone. */
  begin() { this._started = true; }

  retext() {
    this.head.textContent = t('firstrun.title');
    this.dismissBtn.textContent = t('firstrun.got');
    this.pill.title = t('firstrun.title');
    this.pill.setAttribute('aria-label', t('firstrun.title'));
    this.sTitle.textContent = t('firstrun.stuck.title');
    this.sBody.textContent = t('firstrun.stuck.body');
    this.sBtnLabel.textContent = t('firstrun.stuck.act');
    this._src = null;             // force the bindings to be redrawn
    if (this._toldLook) this._noteText();
    const inp = this.input;
    this._bindings(inp ? this._hands(inp) : 'kbm', inp ? inp.lookMode : 'pointer');
  }

  /**
   * Whose hands are on this machine.
   *
   * `Input.source` is born holding `'kbm'` because that is the class's default,
   * not because anybody typed anything — so on a phone, where the whole point
   * of this card is to say *left thumb* rather than *W A S D*, it reads as a
   * keyboard until the first touch, which is exactly the moment the card is no
   * longer needed. On a device with no keyboard, silence means touch. (The
   * same reasoning, and the same predicate, as `HUD.bindInput`.)
   */
  _hands(inp) {
    if (inp.source === 'kbm' && inp.touch?.enabled && !inp.locked && !inp.keys.size) return 'touch';
    return inp.source;
  }

  /**
   * Print the bindings of the hands that are actually on the machine — and, for
   * LOOK, the binding that actually works at this second.
   *
   * A card that says "Look — MOUSE" on a machine where the mouse cannot look is
   * worse than a card that says nothing: it is the game insisting the player is
   * doing it wrong. A cold critic watched that exact row for nineteen minutes
   * while no mouse input reached the camera. So the look row is keyed on
   * `Input.lookMode` and changes the moment the truth does.
   */
  _bindings(src, look = 'pointer') {
    const key = `${src}/${look}`;
    if (key === this._src) return;
    this._src = key;
    const s = src === 'pad' ? 'pad' : src === 'touch' ? 'touch' : 'kbm';
    for (const v of [...CORE, ...TAIL]) {
      const li = this.rows[v];
      if (!li) continue;
      li.querySelector('.fc-verb').textContent = t('controls.' + v);
      // A stick and a thumb are never refused, so only the mouse has states.
      const bk = (s === 'kbm' && v === 'look' && look !== 'pointer')
        ? (look === 'blocked' ? 'lookBlocked' : 'lookFree')
        : v;
      li.querySelector('.fc-keys').innerHTML = caps(t(`firstrun.bind.${s}.${bk}`));
    }
    // On a touch device the button *is* the binding — printing a keycap that
    // says the same word as the label next to it reads as a stutter.
    this.sBtnKeys.innerHTML = s === 'touch' ? '' : caps(t(`firstrun.bind.${s}.recover`));
  }

  /**
   * THE BROWSER SAID NO. TELL THEM, ONCE, AND TELL THEM WHAT TO PRESS.
   *
   * Called by src/core/input.js the first time a pointer-lock request is
   * refused. Everything the player needs is already on this card, so the card
   * is what comes back: it un-retires, un-dismisses, opens, and grows one line
   * that names the keys. Nothing here blocks the game or asks to be dismissed —
   * a school laptop that has never once granted a lock is a normal machine, not
   * an error state.
   */
  lookBlocked() {
    this._blocked = true;
    if (this._toldLook) return;
    this._toldLook = true;
    this._noteText();
    this.note.hidden = false;
    // Marks this card as the one the cold open is not allowed to stand down.
    // See the `#ui.meta-cine .fc.nolock.show` memo in controls.css.
    this.el.classList.add('nolock');
    clearTimeout(this._leave);
    this._leaving = false;
    this._retired = false;
    this.dismissed = false;
    this.show();
    // The card holds for long enough to be read, then behaves normally again.
    this._warnUntil = performance.now() + 6000;
    this.el.classList.add('warned');
    setTimeout(() => this.el.classList.remove('warned'), 6000);
  }

  _noteText() {
    this.noteTitle.textContent = t('firstrun.nolock.title');
    this.noteBody.textContent = t('firstrun.nolock.body');
  }

  show() {
    this.dismissed = false;
    this.open = true;
    this.el.classList.add('show');
    this.pill.classList.remove('show');
    /* Asked for by hand, three minutes in, to check which key the wing was on.
       That is a reference lookup, not first contact, so the automatic retreat
       below does not apply to it: it leaves on GOT IT, Escape or `?`, and not
       one and a half seconds after it arrives. */
    if (this._retired) { clearTimeout(this._leave); this._leaving = false; }
  }

  hide(byHand = false) {
    this.open = false;
    this.el.classList.remove('show');
    if (byHand) this.dismissed = true;
    this.pill.classList.add('show');
  }

  /** The world has hold of the player, or has let go. */
  setStuck(on) {
    this.stuckEl.classList.toggle('show', !!on);
    // …and the controls card gets out of its way, on a phone frame especially,
    // where the two of them are most of the screen.
    this.el.classList.toggle('stood', !!on);
  }

  update(dt) {
    const inp = this.input;
    if (!inp) return;
    this._bindings(this._hands(inp), inp.lookMode);

    // A panel owns the frame: stand aside, and come back when it is done.
    this.el.classList.toggle('away', !!inp.uiOpen);
    this.stuckEl.classList.toggle('away', !!inp.uiOpen);

    if (this._started && !this.open && !this.dismissed && this.done.size < CORE.length) {
      this._t += dt;
      if (this._t > OPEN_AT) this.show();
    }

    // What has the cadet actually done? Only ever read, never driven — and read
    // off the odometers in src/core/input.js, so this can be ticked from
    // anywhere in the frame rather than from the one slot where edges are live.
    const L = this.player?.loco;
    if (inp.moveTime > HOLD) this._tick('move');
    if (inp.lookTravel > 0.85) this._tick('look');
    if (inp.ever.jump || (L && !L.grounded && L.airTime > 0.2)) this._tick('jump');
    if (L?.gliding || inp.ever.glide) this._tick('glide');
    if (inp.ever.interact) this._tick('interact');
    if (this.builder?.handOut) this._tick('build');
    if (inp.ever.recover) this._tick('recover');
    // src/ui P1 — DASH printed a row that could never tick. `input.ever.dash`
    // has always been kept; nothing read it, so the one verb a critic called
    // "an uncommunicated backward dash" stayed lit on the card after the cadet
    // had used it. A checklist with a row that cannot be completed is not a
    // checklist.
    if (inp.ever.dash) this._tick('dash');
    // Sprint keeps no odometer in src/core/input.js — it is a state, not an
    // edge. Held while actually moving is the whole verb, so that is the test,
    // read here rather than by adding a field to somebody else's module.
    if (inp.sprint && inp.moveMag > 0.2) this._tick('sprint');

    /* EVERY CORE VERB IS IN THEIR HANDS. LEAVE, WITHOUT BEING ASKED.
     *
     * src/ui P1 — this never once fired. The block ran on EVERY frame for which
     * the condition held, and its first statement cleared the timeout its last
     * statement had just set: at 60 fps the 1500 ms retreat was cancelled and
     * re-armed every 16 ms, so it could not reach 1500 ms while the card was
     * still open, which was exactly whenever it was allowed to run. The cold
     * critic measured the result — "the controls card never auto-dismisses even
     * after every verb is ticked; it holds ~300x200 px of screen for the whole
     * session."
     *
     * `_leaving` is the latch the sentinel in `done` was meant to be and never
     * was: nothing read it. The timer is armed once and then left alone. */
    // …but not while the card is holding a warning the player has had no time
    // to read. The look row ticks the instant the arrows are pressed, and the
    // arrows are exactly what the warning just told them to press.
    const warned = this._warnUntil && performance.now() < this._warnUntil;
    if (this.done.size >= CORE.length && this.open && !this._leaving && !this._retired && !warned) {
      this._leaving = true;
      this._leave = setTimeout(() => {
        this._leaving = false; this._retired = true; this.hide();
      }, 1500);
    }
  }

  _tick(v) {
    if (this.done.has(v)) return;
    this.done.add(v);
    const li = this.rows[v];
    if (!li) return;
    li.classList.add('done', 'lit');
    setTimeout(() => li.classList.remove('lit'), 600);
  }
}

function row(v) {
  return `<li data-v="${v}"><span class="fc-verb"></span><span class="fc-keys"></span></li>`;
}

/**
 * A binding string becomes keycaps. The bundle writes `W · A · S · D` and this
 * cuts it on the interpunct, so a translator controls both the words and how
 * many caps there are without touching any markup.
 */
function caps(s) {
  return String(s).split('·')
    .map((k) => k.trim()).filter(Boolean)
    .map((k) => `<kbd>${esc(k)}</kbd>`).join('');
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
