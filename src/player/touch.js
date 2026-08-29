import './touch.css';
import { t, onLocaleChange } from '../i18n/index.js';

const ICON = {
  jump: '<path d="M12 20V5"/><path d="M6 11l6-6 6 6"/>',
  dash: '<path d="M3 12h13"/><path d="M11 7l5 5-5 5"/><path d="M19 6v12"/>',
  glide: '<path d="M2 9l10 4 10-4"/><path d="M12 13v7"/><path d="M7 11l5 9 5-9"/>',
  interact: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><circle cx="12" cy="16" r=".6" fill="currentColor"/>',
};

/**
 * Virtual stick + action pad. The stick is floating — it materialises wherever
 * the left thumb lands, which is the difference between a phone control that
 * feels native and one that feels like a website.
 */
export class TouchControls {
  constructor(input) {
    this.input = input;
    this.active = false;
    this.enabled = matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window || innerWidth < 760;
    if (!this.enabled) return;

    const el = document.createElement('div');
    el.id = 'touchpad';
    el.className = 'on';
    // THIS PAD IS THE PLAYER'S HANDS, NOT THE INTERFACE.
    //
    // Every button below is a real `<button>`, so `uiHit()` in src/core/input.js
    // correctly reports "a control was pressed" and `worldPointer()` correctly
    // refuses to also drop a build piece in the world behind the thumb. What it
    // must NOT do is buy the world 0.16 s of deafness, because the verb this
    // very press is about to fire arrives inside that window and was thrown
    // away on the `_grace > 0` line — which is why the on-screen jump button
    // did nothing on any phone, ever. One attribute, read in one place
    // (`ownControls`, src/core/input.js), is the whole of the contract.
    el.dataset.verbs = 'world';
    // icon-only, and hidden from assistive tech: these duplicate the keyboard
    // and pad bindings, and no learner-visible string may live outside i18n
    el.setAttribute('aria-hidden', 'true');
    // An abstract glyph on a phone is a button nobody presses. Every action
    // carries its own name, from i18n, in whatever language the game is in.
    const btn = (a) => `<button class="btn" data-a="${a}" tabindex="-1">`
      + `<svg viewBox="0 0 24 24">${ICON[a]}</svg><b data-k="${a}"></b></button>`;
    el.innerHTML = `
      <div class="home"><i></i></div>
      <div class="stick"></div><div class="knob"></div>
      <div class="pads">
        ${btn('glide')}${btn('interact')}${btn('dash')}${btn('jump')}
      </div>`;
    (document.getElementById('app') || document.body).appendChild(el);
    this._label = () => {
      for (const b of el.querySelectorAll('.btn b')) b.textContent = t('controls.' + b.dataset.k);
    };
    this._label();
    onLocaleChange(this._label);
    this.el = el;
    this.stick = el.querySelector('.stick');
    this.knob = el.querySelector('.knob');
    // A floating stick that draws nothing until it is touched is invisible to
    // anyone who has not been told it exists — a phone player looks at four
    // buttons and concludes there is no analogue movement. The resting home
    // ring says "put your thumb anywhere here"; it hides the moment you do.
    this.home = el.querySelector('.home');

    for (const b of el.querySelectorAll('.btn')) {
      const act = b.dataset.a;
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        b.classList.add('press');
        input.source = 'touch';
        input._press(act);
      };
      const up = (e) => { e.preventDefault(); b.classList.remove('press'); input._release(act); };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', up);
    }

    this._bind(input.canvas);
  }

  _bind(canvas) {
    const input = this.input;
    const touches = new Map();
    const R = 58;

    const place = (x, y) => {
      this.stick.style.left = `${x}px`; this.stick.style.top = `${y}px`;
      this.knob.style.left = `${x}px`; this.knob.style.top = `${y}px`;
      this.stick.classList.add('on'); this.knob.classList.add('on');
      this.home.classList.add('gone');
    };

    const onStart = (e) => {
      for (const t of e.changedTouches) {
        const left = t.clientX < innerWidth * 0.48;
        touches.set(t.identifier, { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, left });
        if (left) { this.active = true; input.source = 'touch'; place(t.clientX, t.clientY); }
      }
    };

    const onMove = (e) => {
      for (const t of e.changedTouches) {
        const s = touches.get(t.identifier);
        if (!s) continue;
        if (s.left) {
          let dx = t.clientX - s.x0, dy = t.clientY - s.y0;
          const m = Math.hypot(dx, dy);
          // the stick base drags along once the thumb outruns it
          if (m > R * 1.35) {
            const k = (m - R * 1.35) / m;
            s.x0 += dx * k; s.y0 += dy * k;
            dx = t.clientX - s.x0; dy = t.clientY - s.y0;
            place(s.x0, s.y0);
          }
          const mag = Math.min(1, Math.hypot(dx, dy) / R);
          const inv = mag > 0 ? mag / Math.hypot(dx, dy) : 0;
          input.move.x = dx * inv; input.move.y = -dy * inv;
          input.moveMag = mag;
          input.sprint = mag > 0.86;
          input.source = 'touch';
          this.knob.style.left = `${s.x0 + dx * inv * R}px`;
          this.knob.style.top = `${s.y0 + dy * inv * R}px`;
        } else {
          input.look.x += (t.clientX - s.x) * 0.0052 * input.sensitivity;
          input.look.y += (t.clientY - s.y) * 0.0052 * input.sensitivity * (input.invertY ? -1 : 1);
          input.source = 'touch';
          input.idleLook = 0;
        }
        s.x = t.clientX; s.y = t.clientY;
      }
      e.preventDefault();
    };

    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        const s = touches.get(t.identifier);
        touches.delete(t.identifier);
        if (s?.left) {
          input.move.x = 0; input.move.y = 0; input.moveMag = 0; input.sprint = false;
          this.stick.classList.remove('on'); this.knob.classList.remove('on');
          this.active = [...touches.values()].some((v) => v.left);
          if (!this.active) this.home.classList.remove('gone');
        }
      }
    };

    canvas.addEventListener('touchstart', onStart, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: true });
    canvas.addEventListener('touchcancel', onEnd, { passive: true });
  }

  /** Hide the pad while a learning panel owns the screen. */
  setVisible(v) { this.el?.classList.toggle('on', !!v); }
}
