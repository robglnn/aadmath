/**
 * The ceremonies.
 *
 * A session in this game has four beats — orders, the run, the close, the rest
 * (`src/session`) — and above them a rank rite and a capability grant
 * (`src/meta`, `src/kit`). Every one of them was SILENT. Not quiet: silent. The
 * whole audible response to twenty minutes of work resolving, to a promotion,
 * and to a two-and-a-half-minute paced-breathing break was one call to
 * `audio.unlocked()`, which is the same five-bell figure the game plays when
 * the wallet can afford a beacon.
 *
 * WHY THIS IS AN OBSERVER AND NOT A SET OF HOOKS.
 *
 * `src/audio/index.js` opens with the rule this file obeys: *it reads the
 * running game and never asks the running game to tell it anything*, because a
 * system that has to be told about every event is a system that goes quiet the
 * moment somebody else refactors. Six modules would each have to remember to
 * call six new methods, and the first one to forget would be a silent beat
 * nobody notices for a month.
 *
 * So this watches the surfaces themselves. Every ceremony in this game is a
 * `<div>` that gains a class when it takes the frame and loses it when it lets
 * go — `.ses-charter.show`, `.ses-close.show`, `.ses-rest.show`,
 * `.meta-rite.show`, `.kit-toast.show` — and those class names are already a
 * published contract: `src/meta/meta.css` and `src/session/session.css` both
 * key off them to stand the rest of the interface down, and
 * `src/world/tagspace.js` keeps a registry of exactly this kind of selector.
 *
 * EVERY LOOKUP IS OPTIONAL. A surface that is not there produces no sound and
 * no error, which means a rename downstream costs a beat rather than a crash,
 * and a build that drops a beat entirely simply stops playing its sound.
 *
 * NOTHING HERE CARRIES INFORMATION. Every one of these surfaces is a card with
 * words on it. A learner with the sound off reads the card; a learner with the
 * sound on reads the card and hears the room agree with it. That is the whole
 * contract, and it is why none of these is allowed to be a notification.
 */

/**
 * The surfaces this file watches. Each entry is an element and the class it
 * gains when it takes the frame; a sound is made on the frame the class lands
 * and never on the frame it goes, because a card being dismissed is the learner
 * doing something and not the game doing something.
 *
 * `.ses-rest` appears three times on purpose: the break beat, the card at the
 * end of it, and the sign-off are three states of one element.
 */
const SURFACES = [
  { id: 'charter', sel: '.ses-charter', cls: 'show' },
  { id: 'close', sel: '.ses-close', cls: 'show' },
  { id: 'rest', sel: '.ses-rest', cls: 'show' },
  { id: 'restEnd', sel: '.ses-rest', cls: 'ended' },
  { id: 'restOff', sel: '.ses-rest', cls: 'closed' },
  { id: 'rite', sel: '.meta-rite', cls: 'show' },
  { id: 'grant', sel: '.kit-toast', cls: 'show' },
];

/** The pacer in `src/session/rest.js`: four seconds in, two held, six out. */
const BREATH_IN = 4;
const BREATH_HOLD = 2;
const BREATH_OUT = 6;
const BREATH_CYCLE = BREATH_IN + BREATH_HOLD + BREATH_OUT;

export class Beats {
  /**
   * @param {HTMLElement} root the interface root every surface is mounted in
   * @param {Stings} sting
   */
  constructor(root, sting) {
    this.root = root || document.body;
    this.sting = sting;
    this.place = 'home';
    /** How many lines the run that is closing actually held. Set by the director. */
    this.held = 0;
    this._state = new Map();
    this._els = new Map();
    this._find = 0;
    this._breath = 0;
    this._ring = null;
    /** True while a ceremony owns the frame — the score reads this and stands down. */
    this.holding = false;
    this.resting = false;
  }

  /** Cached, and re-looked-up now and then in case a surface mounted late. */
  _el(sel) {
    let e = this._els.get(sel);
    if (e && e.isConnected) return e;
    e = this.root.querySelector(sel) || document.querySelector(sel);
    this._els.set(sel, e || null);
    return e;
  }

  /**
   * Called from the director's slow tick. Everything in here is a `classList`
   * read on at most five cached elements, which costs less than one of the
   * eight height samples the exposure probe already takes every metre and a
   * half walked.
   */
  update(dt) {
    // Re-resolve the surfaces about twice a second UNTIL THEY ARE ALL FOUND, and
    // then stop: `src/session` and `src/meta` build them at boot but the audio
    // graph can exist first, and a sweep that keeps running for the rest of the
    // session is seven `querySelector` calls twice a second for nothing.
    if (!this._complete) {
      this._find -= dt;
      if (this._find <= 0) {
        this._find = 0.5;
        this._els.clear();
        this._complete = SURFACES.every((s) => this._el(s.sel));
      }
    }

    let holding = false;
    let resting = false;
    for (const s of SURFACES) {
      const el = this._el(s.sel);
      const on = !!el && el.classList.contains(s.cls);
      if (on && (s.id === 'charter' || s.id === 'close' || s.id === 'rest' || s.id === 'rite')) holding = true;
      if (s.id === 'rest' && on) resting = true;
      if (on === !!this._state.get(s.id)) continue;
      this._state.set(s.id, on);
      if (on) this._enter(s.id);
    }
    this.holding = holding;
    // `restEnd` and `restOff` are still inside `.ses-rest.show`, so the rest is
    // only *resting* while the breathing card itself is the one on screen.
    this.resting = resting && !this._state.get('restEnd') && !this._state.get('restOff');

    if (this.resting) this._pace(dt);
    else this._breath = 0;
  }

  _enter(id) {
    const S = this.sting;
    if (!S) return;
    // When a ceremony last had a voice. `AudioDirector.unlocked()` reads this to
    // drop the generic five-bell figure that most of these surfaces ALSO fire,
    // one tick before they raise themselves.
    if (id !== 'rest' && id !== 'restOff') this.firedAt = performance.now();
    switch (id) {
      // The orders. A run is a thing with a shape, and its opening gets one.
      case 'charter': S.ordersOpen(this.place); break;
      // The close. Twenty minutes of work landing on one chord — and the choir
      // only if the run actually held a line, because the card says the same.
      case 'close':
        S.resolutionLand(this.place, this.held);
        // The next run starts owing nothing.
        this.held = 0;
        break;
      // It is a rest; a fanfare at the start of a rest is a contradiction. What
      // it gets is the breath, below — and the first one waits for the ring's
      // own next inhale rather than starting out of step with the circle the
      // learner is watching.
      // The break beat itself makes no entry sound. `_phase` is cleared so a
      // value left over from an earlier rest cannot read as a cycle boundary
      // and fire a breath out of step with the ring on the first frame.
      case 'rest': this._breath = 0; this._phase = null; break;
      case 'restEnd': S.restEnd(this.place); break;
      case 'restOff': break;
      case 'rite': S.rankUp(this.place); break;
      case 'grant': S.granted(this.place); break;
      default: break;
    }
  }

  /**
   * The breath, locked to the ring the learner is watching.
   *
   * The ring is a CSS animation on `.sr-ring i` that runs from page load rather
   * than from the moment the break opens, so its phase is arbitrary and cannot
   * be guessed. It can be *read*: `getAnimations()` hands back the live
   * animation and its `currentTime`, which is the exact position of the circle
   * on screen. Reading it is the only way the sound and the picture can be the
   * same event rather than two things that are nearly together.
   *
   * When there is no animation to read — an old engine, or a learner who has
   * asked for reduced motion, where `session.css` turns the ring's animation
   * off outright — a free-running twelve-second clock takes over. That case
   * matters more than the other one, not less: a learner who asked for less
   * motion is exactly the learner for whom a pacer that is not visual is worth
   * having.
   */
  _pace(dt) {
    let phase = null;
    const ring = this._ringEl();
    if (ring && ring.getAnimations) {
      try {
        const a = ring.getAnimations().find((x) => typeof x.currentTime === 'number');
        if (a && a.playState === 'running') phase = (a.currentTime / 1000) % BREATH_CYCLE;
      } catch { phase = null; }
    }
    if (phase === null) {
      this._breath += dt;
      phase = this._breath % BREATH_CYCLE;
      if (this._breath > BREATH_CYCLE) this._breath -= BREATH_CYCLE;
    }
    // Schedule one whole breath when the cycle crosses its own start, and never
    // twice for one crossing.
    const last = this._phase ?? phase;
    this._phase = phase;
    if (phase < last) {
      this.sting?.breathe?.(BREATH_IN, BREATH_HOLD, BREATH_OUT, this.place);
    }
  }

  _ringEl() {
    if (this._ring && this._ring.isConnected) return this._ring;
    this._ring = this.root.querySelector('.sr-ring i') || document.querySelector('.sr-ring i');
    return this._ring;
  }
}

export { SURFACES };
