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

/** Radial deadzone + response curve. Returns a vector of length 0..1. */
function stick(x, y, dz = STICK_DZ, expo = 1.35) {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0, 0];
  const n = Math.min(1, (m - dz) / (1 - dz));
  const s = Math.pow(n, expo) / m;
  return [x * s, y * s, Math.pow(n, expo)];
}

/** Buffered actions: a press stays claimable for a few frames. */
const ACTIONS = ['jump', 'dash', 'glide'];

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
    this.uiOpen = false;
    this.anyKey = false;
    this.source = 'kbm';          // kbm | pad | touch
    this.idleLook = 0;            // seconds since the player last aimed

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

  // ---- action queries -------------------------------------------------
  /** True once per press, and for a short buffer window after. */
  pressed(a) { return this._buf[a] > 0; }
  /** Consume a buffered press so it cannot fire twice. */
  consume(a) { const v = this._buf[a] > 0; this._buf[a] = 0; return v; }
  held(a) { return !!this._down[a]; }

  _press(a, buf = 0.17) {
    this.anyKey = true;
    if (a === 'fire' || a === 'interact') { if (!this.uiOpen) this[a] = true; return; }
    if (this.uiOpen) return;
    this._down[a] = true;
    this._buf[a] = buf;
  }
  _release(a) { if (this._down[a] !== undefined) this._down[a] = false; }

  // ---- binding --------------------------------------------------------
  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.source = 'kbm';
      switch (e.code) {
        case 'Space': this._press('jump'); e.preventDefault(); break;
        case 'KeyE': this._press('interact'); break;
        case 'ControlLeft': case 'KeyC': this._press('dash'); break;
        case 'KeyG': this._press('glide'); break;
      }
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0) this.slot = n;
      this.anyKey = true;
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this._release('jump');
      if (e.code === 'ControlLeft' || e.code === 'KeyC') this._release('dash');
      if (e.code === 'KeyE') this._release('interact');
      if (e.code === 'KeyG') this._release('glide');
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
    addEventListener('mousedown', (e) => {
      // A click on the world builds, whether or not the browser granted
      // pointer lock. It regularly does not — an iframe, a user who pressed
      // Escape, a Chromium started without a real window — and gating the
      // build verb on `locked` meant that in all of those cases clicking did
      // nothing at all and the whole build system looked deleted.
      if (this.uiOpen) return;
      if (!this.locked && e.target !== this.canvas) return;
      if (e.button === 0) this._press('fire');
      if (e.button === 2) this._press('dash');
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
    if (this._uiWas !== this.uiOpen) { this._uiWas = this.uiOpen; this.touch?.setVisible(!this.uiOpen); }
  }

  endFrame() {
    this.look.x = 0; this.look.y = 0;
    this.fire = false; this.interact = false; this.anyKey = false;
  }
}
