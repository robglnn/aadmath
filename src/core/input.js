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
    if (this.locked) return true;
    const el = e && e.target;
    if (!el || el === this.canvas) return true;
    return !uiHit(el);
  }

  /** Deafen the world for a moment — used when the interface eats a gesture. */
  eatPointer(s = UI_GRACE) { this._grace = Math.max(this._grace, s); }

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
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
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
    addEventListener('blur', () => { this.keys.clear(); for (const a of ACTIONS) this._down[a] = false; });

    this.canvas.addEventListener('click', () => {
      if (this.locked || this.uiOpen) return;
      // Chrome returns a promise here and rejects it when the document is not
      // allowed to lock the pointer (a sandboxed iframe, a headless run). An
      // unhandled rejection is a console error, and this project treats a
      // console error as a failure — so refusal is a normal outcome, not a bug.
      const req = this.canvas.requestPointerLock?.();
      if (req && typeof req.catch === 'function') req.catch(() => {});
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const k = 0.0021 * this.sensitivity;
      this.look.x += e.movementX * k;
      this.look.y += e.movementY * k * (this.invertY ? -1 : 1);
      this.source = 'kbm';
      this.idleLook = 0;
    });
    // Capture phase, on the window, before anything else sees the press: one
    // decision about who this gesture belongs to, recorded where every other
    // world system can read it. Capture is the point — a UI handler that calls
    // `stopPropagation` must not be able to hide the fact that the interface,
    // not the world, was clicked.
    addEventListener('pointerdown', (e) => {
      const world = this.worldPointer(e);
      this.pointerOnUI = !world;
      // A gesture the interface ate also buys the world a moment of deafness,
      // which covers a panel that is still fading out under the cursor.
      if (!world && !this.locked) this.eatPointer(0.16);
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
    addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.slot = (this.slot + (e.deltaY > 0 ? 1 : 3)) % 4;
    }, { passive: true });
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
      const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const m = Math.hypot(kx, ky);
      this.move.x = m ? kx / m : 0;
      this.move.y = m ? ky / m : 0;
      this.moveMag = m ? 1 : 0;
      this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
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
