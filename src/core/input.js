/**
 * One input surface for keyboard+mouse, gamepad, and touch.
 *
 * Everything downstream reads the same normalised state, so a console stick, a
 * phone thumb and a WASD hand produce identical motion. Actions are edge
 * triggered with a short press-buffer so a jump typed one frame early still
 * counts — the difference between "responsive" and "the game ate my input".
 */
import { TouchControls } from '../player/touch.js';

const STICK_DZ = 0.17;
const TRIGGER_DZ = 0.35;

/**
 * How fast the arrow keys swing the view. Radians per second.
 *
 * Deliberately close to the pad's stick rate (3.1) rather than to a mouse. A
 * key has no magnitude, so this single number is the whole feel of it: slower
 * and a player cannot turn round inside a rift's dwell time, faster and the
 * horizon slews past too quickly to read the marker they are turning to find.
 */
const KEY_TURN = 2.6;

/**
 * How far a mouse must travel before a press becomes a look and not a click.
 *
 * A left click in the world places a build piece. Without a deadzone every
 * placement would also nudge the camera by the two or three pixels a hand moves
 * while a finger goes down, which reads as the world twitching at you.
 */
const DRAG_DZ = 3;

/**
 * How long after losing the pointer a refusal is treated as ordinary.
 *
 * Chrome will not re-lock the pointer for about a second after Escape released
 * it. That refusal is the browser protecting the player's way out of the game,
 * not a policy that stops them looking around — announcing it as "your school
 * has blocked the mouse" would be a lie told to every player who ever pauses.
 */
const RELOCK_COOLDOWN = 2200;

/**
 * Controls that eat a click. Anything a hand can aim at and expect to respond.
 */
const UI_TAGS = 'button,a[href],input,select,textarea,summary,label,[role="button"],'
  + '[role="tab"],[role="switch"],[role="menuitem"],[contenteditable="true"]';

/**
 * Did this pointer land on the interface, or merely on a pane of glass?
 *
 * `e.target === canvas` is the obvious test and it is wrong in both directions.
 * The interface is a stack of full-bleed layers — `#ui` is `pointer-events:
 * none` but `#ui > *` is `auto`, so several modules own a transparent
 * 1600×900 div that is *always* the topmost hit-testable element. Under a
 * granted pointer lock nothing notices, because every event then targets the
 * canvas; the moment lock is refused — an iframe, a school-managed Chromebook,
 * a player who pressed Escape — a naive target test hands every click in the
 * game to an invisible pane and the world goes dead.
 *
 * So the question asked is the honest one: is the thing under the cursor
 * something a person could *see* and could reasonably have been aiming at? A
 * control, or anything wearing a pointer cursor, is. A layer at zero opacity is
 * not, whatever its pointer-events say.
 */
function uiHit(el) {
  let hit = false;
  for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (!hit && (n.matches?.(UI_TAGS) || cs.cursor === 'pointer')) hit = true;
  }
  return hit;
}

/**
 * The pad's own attribute. The on-screen stick and the four action buttons in
 * src/player/touch.js carry `data-verbs="world"` on their root, and that is the
 * whole of the contract between the two files.
 */
const OWN_CONTROLS = '[data-verbs="world"]';

/**
 * Is this press on the game's OWN on-screen controls?
 *
 * THE PAD IS THE PLAYER'S HANDS, NOT THE INTERFACE. This distinction has to be
 * made in exactly one place, and this is it.
 *
 * `uiHit` above answers a different question — "could a person have been aiming
 * at a control?" — and for the touch pad the honest answer is yes: the four
 * action buttons are real `<button>` elements, so `uiHit` returns true and
 * `worldPointer` returns false. That is CORRECT for what `worldPointer` is for:
 * a thumb on the jump button must not also set a build piece down in the world
 * behind it.
 *
 * It is not correct for the *deafness*. A press on the interface buys the world
 * 0.16 s of silence so that a panel fading out under the cursor cannot leak a
 * click through to the ground. But the pad is not a panel fading out. It is the
 * only way a phone can say `jump` at all, and it says it through `_press` a few
 * milliseconds after this handler runs — so the pad's own tap was arriving into
 * a silence its own tap had just bought, and `_press` threw it away on the
 * `_grace > 0` line. Every button on the pad was dead on every touch device,
 * always: jump, dash, glide and interact. See tools/critic/touch.mjs, which taps
 * all four for real and fails if the world does not answer.
 */
function ownControls(el) {
  return !!(el && typeof el.closest === 'function' && el.closest(OWN_CONTROLS));
}

/** Radial deadzone + response curve. Returns a vector of length 0..1. */
function stick(x, y, dz = STICK_DZ, expo = 1.35) {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0, 0];
  const n = Math.min(1, (m - dz) / (1 - dz));
  const s = Math.pow(n, expo) / m;
  return [x * s, y * s, Math.pow(n, expo)];
}

/** Buffered actions: a press stays claimable for a few frames. */
const ACTIONS = ['jump', 'dash', 'glide', 'recover'];

/**
 * How long the world stays deaf to a click after a panel hands the frame back.
 *
 * A modal in this game fades for 400 ms after its own button is pressed, and it
 * drops `pointer-events` on the frame the class comes off — so for those 400 ms
 * a card is plainly on screen, the cursor is plainly on its button, and the
 * click lands on the canvas behind it. That is how the ORDERS card managed to
 * build a wall through its own BEGIN THE RUN button. Nothing about that is a
 * pointer-events bug we can fix from here (the card is not ours), and nothing
 * about it is the player's fault: they clicked a button that was on screen.
 * So the world simply does not accept a verb for a moment after a panel closes.
 */
const UI_GRACE = 0.42;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();

    this.move = { x: 0, y: 0 };   // -1..1, camera relative
    this.moveMag = 0;             // 0..1 analog magnitude
    this.look = { x: 0, y: 0 };   // radians this frame
    this.sprint = false;
    this.fire = false;             // one-frame edge, cleared in endFrame()
    this.interact = false;         // one-frame edge, cleared in endFrame()
    this.slot = 0;
    this.locked = false;

    // ---- looking around without the pointer lock -------------------------
    //
    // THE VIEW IS NEVER THE BROWSER'S TO WITHHOLD.
    //
    // `requestPointerLock` is a request, and a browser is allowed to say no. It
    // says no in an `<iframe>` that was embedded without `allow="pointer-lock"`
    // — which is how every LMS on earth embeds a game — it says no under a
    // managed-device policy, and it says no for a second after a player presses
    // Escape. Until now the answer to "no" was that `mousemove` returned early
    // and NOTHING turned the camera: not the mouse, not a drag, not a key. A
    // cold critic sat for nineteen minutes reading "56 m TO YOUR LEFT" off the
    // objective card with no way on the machine to face left.
    //
    // So looking around no longer depends on the lock at all. The lock is an
    // upgrade — it buys unlimited travel and a hidden cursor — and the arrow
    // keys and a click-drag are always live underneath it.
    this.lockDenied = false;      // the browser refused, and it was not the Escape cooldown
    this.onLookFallback = null;   // called once, when that is first known
    this._told = false;
    this._drag = null;
    this._dragged = false;        // the last press ended as a look, not a click
    this._askedAt = 0;
    this._unlockedAt = 0;

    this._uiOpen = false;
    this._grace = 0;              // seconds the world stays deaf after a panel
    this.pointerOnUI = false;     // was the last press aimed at the interface?
    this.anyKey = false;
    this.source = 'kbm';          // kbm | pad | touch
    this.idleLook = 0;            // seconds since the player last aimed

    // Odometers. Frame-order-independent, because the one thing that wants to
    // know whether the player has ever moved, looked or pressed a verb — the
    // controls card, src/player/controls.js — is not going to be wired into the
    // exact slot between `sample()` and `endFrame()` where the edges are live.
    this.lookTravel = 0;          // radians of aim, cumulative
    this.moveTime = 0;            // seconds of continuous stick over deadzone
    this.ever = { jump: false, dash: false, glide: false, interact: false, fire: false, recover: false };

    // edge state
    this._down = {};              // held
    this._buf = {};               // seconds remaining in the press buffer
    for (const a of ACTIONS) { this._down[a] = false; this._buf[a] = 0; }
    this._padPrev = [];

    this.sensitivity = Number(localStorage.getItem('ascent.sens') || 1);
    this.invertY = localStorage.getItem('ascent.invertY') === '1';

    this._bind();
    this.touch = new TouchControls(this);
  }

  // ---- who owns the pointer -------------------------------------------
  /**
   * `uiOpen` is a plain flag to everything that sets it — six modules do — but
   * setting it back to false is the interesting edge, so it is watched here.
   */
  get uiOpen() { return this._uiOpen; }
  set uiOpen(v) {
    const on = !!v;
    if (on === this._uiOpen) return;
    this._uiOpen = on;
    // Coming *out* of a panel: hold the world's verbs off for a beat (UI_GRACE)
    // and forget anything that was buffered while the panel had the frame.
    if (!on) {
      this._grace = UI_GRACE;
      this.fire = false; this.interact = false;
      // …every verb except the way out. A recover pressed while the card was up
      // is a player asking to be got out of a hole, and it must survive the card
      // closing rather than be swept up with the leftover jumps.
      for (const a of ACTIONS) {
        if (a === 'recover') continue;
        this._buf[a] = 0; this._down[a] = false;
      }
    }
  }

  /**
   * Did this pointer event happen *in the world*, or on the interface?
   *
   * The single question every world verb has to ask, and the one the build
   * system never asked: its own `mousedown` listener was on `window` with no
   * target test at all, so a click on the hotbar, the quest card or a language
   * pill set a piece down in the world behind them. Under pointer lock every
   * event targets the canvas by definition; without it, only the canvas counts,
   * and only outside the grace window after a panel closed.
   */
  worldPointer(e) {
    if (this.uiOpen || this._grace > 0) return false;
    // A CONTROL WINS, LOCK OR NO LOCK.
    //
    // `if (this.locked) return true` used to stand here, above the target test,
    // and it made "the interface ate that click" conditional on a browser
    // setting. Under a granted lock every event really does target the canvas,
    // so the line below answers the locked case correctly and the short circuit
    // bought nothing — but any press that reaches a real button while `locked`
    // is still set (a lock the page has lost and not been told about yet, a
    // synthesised press, a machine that reports the lock and delivers events to
    // the element anyway) was handed to the world with the button under it.
    // This project has already shipped one catastrophic version of a pointer
    // that went to the wrong owner, so the question is now asked the same way
    // every time. (learn-ux, lane B: smallest change that closes the hole.)
    const el = e && e.target;
    if (!el || el === this.canvas) return true;
    return !uiHit(el);
  }

  /** Deafen the world for a moment — used when the interface eats a gesture. */
  eatPointer(s = UI_GRACE) { this._grace = Math.max(this._grace, s); }

  // ---- how the player can look, right now -----------------------------
  /**
   * What actually turns the camera on this machine at this moment.
   *
   *   `pointer`  the lock is held: the mouse looks, with no edge to the desk
   *   `blocked`  the browser refused the lock: arrow keys and drag, and the
   *              player has been told so in words
   *   `free`     no lock yet, and no refusal yet — clicking may still get one,
   *              and meanwhile the arrow keys work
   *
   * The controls card prints the bindings for whichever of these is true, which
   * is the whole reason it exists as a value rather than as two booleans read
   * in three places. (src/player/controls.js)
   */
  get lookMode() {
    if (this.locked) return 'pointer';
    return this.lockDenied ? 'blocked' : 'free';
  }

  /**
   * The browser will not lock the pointer. Say so, once, and never again.
   *
   * Called from four places because a refusal arrives in four shapes: a
   * rejected promise, a `pointerlockerror` event, a method that is not there at
   * all, and — the quiet one — a request that neither resolves nor errors and
   * simply leaves `pointerLockElement` null forever.
   */
  _denyLock(why) {
    clearTimeout(this._lockWatch);
    if (this.locked) return;
    // The Escape cooldown is not a denial. See RELOCK_COOLDOWN.
    if (this._unlockedAt && performance.now() - this._unlockedAt < RELOCK_COOLDOWN) return;
    this.lockDenied = true;
    this.lockDeniedWhy = why;
    if (this._told) return;
    this._told = true;
    // The card is not this module's business, so it is handed the fact and
    // decides what to say. (src/main.js wires it to src/player/controls.js)
    try { this.onLookFallback?.(why); } catch { /* the view still works */ }
  }

  // ---- settings -------------------------------------------------------
  /**
   * Aim speed and inverted aim, live and remembered.
   *
   * These two numbers were read out of `localStorage` once in the constructor
   * and there was no surface anywhere in the game that could write them — the
   * game had no settings at all, which for a player whose mouse is too fast is
   * the difference between playable and not. The menu (src/ui/menu.js) writes
   * them through here so that one place clamps the range and one place decides
   * what is persisted.
   */
  setSensitivity(v) {
    const n = Math.min(2.4, Math.max(0.35, Number(v) || 1));
    this.sensitivity = n;
    try { localStorage.setItem('ascent.sens', String(n)); } catch { /* private mode */ }
    return n;
  }

  setInvertY(on) {
    this.invertY = !!on;
    try { localStorage.setItem('ascent.invertY', this.invertY ? '1' : '0'); } catch { /* private mode */ }
    return this.invertY;
  }

  // ---- action queries -------------------------------------------------
  /** True once per press, and for a short buffer window after. */
  pressed(a) { return this._buf[a] > 0; }
  /** Consume a buffered press so it cannot fire twice. */
  consume(a) { const v = this._buf[a] > 0; this._buf[a] = 0; return v; }
  held(a) { return !!this._down[a]; }

  _press(a, buf = 0.17) {
    this.anyKey = true;
    if (a === 'fire' || a === 'interact') {
      if (!this.uiOpen && this._grace <= 0) { this[a] = true; this.ever[a] = true; }
      return;
    }
    // RECOVER IS NEVER DROPPED. Every other verb here is a world verb, and a
    // world verb has no business firing behind a card — that gate is correct
    // and stays. Recover is not a world verb: it is the way out, it is printed
    // on the controls card and in the pause menu, and the whole point of it is
    // that it works when everything else has stopped working.
    //
    // This is exactly why a cold critic pressed R three times, waited fifteen
    // seconds, and watched nothing happen. He was out of the world and falling,
    // and a card had opened over the top of the frame while he fell; `uiOpen`
    // was therefore true, and the one key that could have saved the session was
    // being thrown away in this branch before the player ever reached it.
    // (`Menu._pad` already carries the same reasoning for the pause button.)
    if (a !== 'recover' && (this.uiOpen || this._grace > 0)) return;
    if (a in this.ever) this.ever[a] = true;
    this._down[a] = true;
    this._buf[a] = buf;
  }
  _release(a) { if (this._down[a] !== undefined) this._down[a] = false; }

  // ---- binding --------------------------------------------------------
  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // A hand in a text field is writing, not playing. This matters now that
      // recover is allowed through while a panel owns the frame: the rift's
      // keypad is an `<input>`, and typing an answer that contains an "r" must
      // not pick the cadet up and put him down somewhere else.
      const tag = e.target?.tagName;
      // SELECT joins the list now that the arrow keys steer the camera: an
      // arrow inside a dropdown is choosing an option, not turning the cadet.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      this.keys.add(e.code);
      this.source = 'kbm';
      switch (e.code) {
        case 'Space': this._press('jump'); e.preventDefault(); break;
        // INTERACT IS ONE KEY, AND IT IS THE ONE ON THE PLATE.
        //
        // A cold critic stood inside the first rift's footprint and "pressed E,
        // F, R, Enter, Space and clicked it". Two of those five moved him:
        // Space jumped, and R — `recover` — picked him up and set him down on
        // open ground, which he read, reasonably, as "an uncommunicated
        // backward dash that repeatedly shoved me away from the thing I was
        // trying to touch". Nothing he pressed *interacted* except E, and E is
        // what the plate on the ring has always printed.
        //
        // So: E remains the interact key, it is what the world advertises, and
        // Return is accepted alongside it — because Return is the other thing
        // every hand reaches for when a prompt is on screen, and a game that
        // ignores it has spent a player's guess for nothing.
        case 'KeyE': case 'Enter': case 'NumpadEnter': this._press('interact'); break;
        case 'ControlLeft': case 'KeyC': this._press('dash'); break;
        case 'KeyG': this._press('glide'); break;
        // The way out of a hole. It is bound at the input layer rather than in
        // the player so that a controller and a thumb reach it the same way.
        case 'KeyR': this._press('recover', 0.30); break;
      }
      // These four scroll a page by default, and a page that scrolls under a
      // full-bleed canvas moves the interface off the top of the window.
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp'
        || e.code === 'ArrowDown' || e.code === 'PageUp' || e.code === 'PageDown') e.preventDefault();
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0) this.slot = n;
      this.anyKey = true;
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this._release('jump');
      if (e.code === 'ControlLeft' || e.code === 'KeyC') this._release('dash');
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') this._release('interact');
      if (e.code === 'KeyG') this._release('glide');
      if (e.code === 'KeyR') this._release('recover');
    });
    addEventListener('blur', () => {
      this.keys.clear();
      for (const a of ACTIONS) this._down[a] = false;
      // A drag that was in progress when the window lost focus never gets its
      // `pointerup`, and a live drag would keep swinging the view on the next
      // stray move. (Alt-tab out of a right-drag is exactly this.)
      this._drag = null;
    });

    // THE LOCK IS ASKED FOR ON A *WORLD* CLICK, NOT ON THE CANVAS ELEMENT.
    //
    // This used to be `canvas.addEventListener('click', …)`, and it inherited
    // the exact trap this file's `uiHit` comment was written about: `#ui` is a
    // stack of full-bleed layers, several of which are transparent divs with
    // `pointer-events: auto` sitting over the entire frame. The canvas is their
    // sibling, not their ancestor, so when one of them is up the click never
    // reaches the canvas and the request was simply never made — no lock, no
    // error, no way to look, and nothing anywhere that could notice. Captured
    // in three locales at two frame sizes, five of the six never asked at all.
    //
    // `worldPointer` already knows the difference between a pane of glass and a
    // control, so the same question decides this as decides every other world
    // verb. Capture phase, so a layer that stops propagation cannot hide it.
    addEventListener('click', (e) => {
      if (this.locked || this.uiOpen) return;
      if (!this.worldPointer(e)) return;
      // A press that turned into a look was a look, not a request for a lock.
      if (this._dragged) return;
      // ASK EVERY TIME, BUT NEVER DEPEND ON THE ANSWER.
      //
      // The request is repeated on later clicks even after a refusal, because
      // the commonest refusal in this game is its own pause menu calling
      // `exitPointerLock` — and a player coming back out of a menu must get the
      // mouse back. It is throttled only so a machine that always says no is
      // not asked sixty times a minute.
      const now = performance.now();
      if (now - this._askedAt < 1200) return;
      this._askedAt = now;
      // Chrome returns a promise here and rejects it when the document is not
      // allowed to lock the pointer (a sandboxed iframe, a headless run). An
      // unhandled rejection is a console error, and this project treats a
      // console error as a failure — so refusal is a normal outcome, not a bug.
      if (!this.canvas.requestPointerLock) { this._denyLock('unsupported'); return; }
      let req;
      try { req = this.canvas.requestPointerLock(); }
      catch { this._denyLock('threw'); return; }
      if (req && typeof req.catch === 'function') req.catch(() => this._denyLock('rejected'));
      // …and the silent case, which is the one that cost the nineteen minutes:
      // no rejection, no error event, no lock. Only a clock can see it.
      clearTimeout(this._lockWatch);
      this._lockWatch = setTimeout(() => { if (!this.locked) this._denyLock('silent'); }, 900);
    }, true);
    document.addEventListener('pointerlockerror', () => this._denyLock('error'));
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) {
        // It works here after all. Forget the refusal; the card goes back to
        // printing the mouse.
        clearTimeout(this._lockWatch);
        this.lockDenied = false;
        this._askedAt = 0;
      } else if (was) {
        this._unlockedAt = performance.now();
        this._drag = null;
      }
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const k = 0.0021 * this.sensitivity;
      this.look.x += e.movementX * k;
      this.look.y += e.movementY * k * (this.invertY ? -1 : 1);
      this.source = 'kbm';
      this.idleLook = 0;
    });

    // ---- drag to look, whether or not the lock was granted ---------------
    //
    // Under a lock the mouse reports `movementX` forever in any direction. With
    // no lock it reports a cursor that stops at the edge of the window, so the
    // gesture has to be a drag: press, pull, release, press again. That is the
    // same gesture every map and every model viewer on the web uses, and it is
    // the one a hand tries first when the mouse does nothing.
    //
    // Either button drags. The right button is what a player who knows games
    // reaches for, and the left is what everyone else reaches for; a left drag
    // still places its build piece on the way down, because the press is a
    // click until it has travelled DRAG_DZ and only then becomes a look.
    addEventListener('pointermove', (e) => {
      const d = this._drag;
      if (!d || e.pointerId !== d.id) return;
      // A button released outside the window never sends its `pointerup`. The
      // next move with no buttons down is the honest end of the gesture.
      if (e.buttons === 0) { this._endDrag(); return; }
      if (this.locked || this.uiOpen) { this._drag = null; return; }
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (!d.look && d.moved < DRAG_DZ) return;
      d.look = true;
      const k = 0.0030 * this.sensitivity;
      this.look.x += dx * k;
      this.look.y += dy * k * (this.invertY ? -1 : 1);
      this.source = 'kbm';
      this.idleLook = 0;
    });
    addEventListener('pointerup', (e) => { if (this._drag?.id === e.pointerId) this._endDrag(); });
    addEventListener('pointercancel', (e) => { if (this._drag?.id === e.pointerId) this._endDrag(); });
    // Capture phase, on the window, before anything else sees the press: one
    // decision about who this gesture belongs to, recorded where every other
    // world system can read it. Capture is the point — a UI handler that calls
    // `stopPropagation` must not be able to hide the fact that the interface,
    // not the world, was clicked.
    addEventListener('pointerdown', (e) => {
      const world = this.worldPointer(e);
      this.pointerOnUI = !world;
      // A gesture the interface ate also buys the world a moment of deafness,
      // which covers a panel that is still fading out under the cursor. The
      // game's own on-screen pad is exempt: it is the hands, not the interface,
      // and the deafness bought here landed on its own `_press` a few
      // milliseconds later and killed it. (`ownControls`, above.)
      const mine = ownControls(e.target);
      if (!world && !this.locked && !mine) this.eatPointer(0.16);
      // A press in the world is a candidate look. Touch is excluded: a thumb
      // already has its own stick and its own TURN pad. (src/player/touch.js)
      this._dragged = false;
      if (!world || this.locked) return;
      // A stylus on a classroom 2-in-1 drags the same way a mouse does. Only a
      // finger is excluded, and only because it already has a stick and a TURN
      // pad of its own.
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      this._drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, look: false };
    }, true);

    addEventListener('mousedown', (e) => {
      // A click on the world builds, whether or not the browser granted
      // pointer lock. It regularly does not — an iframe, a user who pressed
      // Escape, a Chromium started without a real window — and gating the
      // build verb on `locked` meant that in all of those cases clicking did
      // nothing at all and the whole build system looked deleted.
      if (!this.worldPointer(e)) return;
      if (e.button === 0) this._press('fire');
      // The right button used to dash. It is a *movement verb on a button a
      // player presses to cancel things*, it appeared on no card and in no
      // prompt, and it fired while the cadet was walking backwards out of a
      // rift he could not open — which is most of how "E is a backward dash"
      // came to be written down about a key that has never moved anybody.
      // Dash keeps C, left Ctrl and the pad's B, all three of which the
      // controls card now prints. (src/player/controls.js)
    });
    // On macOS the context menu opens on the *press*, so a right-drag to look
    // would never survive its own first pixel unless the menu is refused up
    // front. It is refused over the world only — a right click on a button, a
    // link or a text field still does what the operating system promises.
    addEventListener('contextmenu', (e) => {
      if (this.locked || this._drag || this._dragged) { e.preventDefault(); return; }
      const el = e.target;
      if (!el || el === this.canvas || !uiHit(el)) e.preventDefault();
    });
    // The hotbar wheel was gated on the lock for the same reason the look was,
    // and it failed in the same place: with no lock the player could not change
    // the piece in their hand by the one gesture every game binds it to.
    addEventListener('wheel', (e) => {
      if (!this.locked) {
        if (this.uiOpen || this._grace > 0) return;
        const el = e.target;
        if (el && el !== this.canvas && uiHit(el)) return;   // a scrollable panel
      }
      this.slot = (this.slot + (e.deltaY > 0 ? 1 : 3)) % 4;
    }, { passive: true });
  }

  /** End a drag, remembering whether it turned into a look. */
  _endDrag() {
    this._dragged = !!this._drag?.look;
    this._drag = null;
  }

  // ---- gamepad --------------------------------------------------------
  _gamepad(dt) {
    const gp = navigator.getGamepads?.()[0];
    if (!gp || !gp.connected) return false;
    const ax = gp.axes;
    const [mx, my, mm] = stick(ax[0] || 0, -(ax[1] || 0));
    const [lx, ly] = stick(ax[2] || 0, ax[3] || 0, 0.14, 1.9);

    const active = mm > 0 || Math.abs(lx) + Math.abs(ly) > 0 || gp.buttons.some((b) => b.pressed);
    if (active) this.source = 'pad';
    if (this.source !== 'pad') return false;

    this.move.x = mx; this.move.y = my; this.moveMag = mm;

    const rate = 3.1 * this.sensitivity;
    if (lx || ly) this.idleLook = 0;
    this.look.x += lx * rate * dt;
    this.look.y += ly * rate * dt * (this.invertY ? -1 : 1);

    const b = (i) => !!gp.buttons[i]?.pressed;
    const t = (i) => (gp.buttons[i]?.value ?? 0) > TRIGGER_DZ;
    const edge = (i, action, on) => {
      const now = on !== undefined ? on : b(i);
      if (now && !this._padPrev[i]) this._press(action);
      else if (!now && this._padPrev[i]) this._release(action);
      this._padPrev[i] = now;
    };
    edge(0, 'jump');
    edge(1, 'dash');
    edge(5, 'dash');
    edge(3, 'glide');
    edge(8, 'recover');   // Back / View / Share — the console's "get me out"
    if (b(2) && !this._padPrev[2]) this._press('interact');
    this._padPrev[2] = b(2);
    if (t(7) && !this._padPrev[7]) this._press('fire');
    this._padPrev[7] = t(7);
    this.sprint = b(10) || t(6);
    this.gamepad = gp;
    return true;
  }

  /** Short rumble; silently ignored where the browser has no actuator. */
  rumble(strong = 0.4, ms = 90, weak = 0.2) {
    const a = this.gamepad?.vibrationActuator;
    if (!a?.playEffect) return;
    try {
      a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
    } catch { /* no haptics here */ }
  }

  /** Called once per frame before any system reads the state. */
  sample(dt = 1 / 60) {
    if (this._grace > 0) this._grace = Math.max(0, this._grace - dt);
    for (const a of ACTIONS) if (this._buf[a] > 0) this._buf[a] = Math.max(0, this._buf[a] - dt);
    this.idleLook += dt;

    const pad = this._gamepad(dt);
    const touching = this.touch?.active;
    if (touching) this.source = 'touch';

    if (!pad && !touching) {
      const k = this.keys;
      // LEFT AND RIGHT TURN. THEY DO NOT STRAFE.
      //
      // They used to be a second copy of A and D, which made them the only keys
      // on the board that did something WASD already did — while the one thing
      // a keyboard could not do at all was turn round. On a machine with no
      // pointer lock that was the difference between a playable game and a
      // player facing a wall for nineteen minutes.
      //
      // Up and Down keep walking, so a hand that never leaves the arrow cluster
      // can still go everywhere: forward, back, and any bearing it likes.
      const kx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const m = Math.hypot(kx, ky);
      this.move.x = m ? kx / m : 0;
      this.move.y = m ? ky / m : 0;
      this.moveMag = m ? 1 : 0;
      this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');

      // ---- the view, from the keyboard alone ----
      // Live under a granted lock as well as without one. A binding that only
      // exists when something else has failed is a binding nobody ever learns,
      // and the controls card could not honestly print it.
      if (!this.uiOpen) {
        const tx = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
        const ty = (k.has('PageDown') ? 1 : 0) - (k.has('PageUp') ? 1 : 0);
        if (tx || ty) {
          const rate = KEY_TURN * this.sensitivity * dt;
          this.look.x += tx * rate;
          this.look.y += ty * rate * (this.invertY ? -1 : 1);
          this.idleLook = 0;
          this.source = 'kbm';
        }
      }
    }
    if (this.uiOpen) { this.move.x = 0; this.move.y = 0; this.moveMag = 0; this.sprint = false; }
    this.lookTravel += Math.abs(this.look.x) + Math.abs(this.look.y);
    this.moveTime = this.moveMag > 0.3 ? this.moveTime + dt : 0;
    if (this._uiWas !== this.uiOpen) { this._uiWas = this.uiOpen; this.touch?.setVisible(!this.uiOpen); }
  }

  endFrame() {
    this.look.x = 0; this.look.y = 0;
    this.fire = false; this.interact = false; this.anyKey = false;
  }
}
