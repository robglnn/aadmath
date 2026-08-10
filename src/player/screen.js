import './feel.css';

/**
 * Screen-space speed feedback. Two cheap DOM layers cost nothing and give the
 * top of the speed range somewhere to go once FOV has run out of room.
 */
export class ScreenFeel {
  constructor() {
    const el = document.createElement('div');
    el.id = 'feel';
    el.innerHTML = '<div class="layer streak"></div><div class="layer vig"></div><div class="layer flash"></div>';
    // sits between the canvas and the HUD, never over it
    const app = document.getElementById('app') || document.body;
    app.insertBefore(el, document.getElementById('ui') || null);
    this.streak = el.querySelector('.streak');
    this.vig = el.querySelector('.vig');
    this.flashEl = el.querySelector('.flash');
    this.spin = 0;
    this.flashV = 0;
    this._s = -1; this._v = -1; this._f = -1;
  }

  flash(a) { this.flashV = Math.min(1, this.flashV + a); }

  update(dt, intensity, spinRate = 1) {
    this.spin = (this.spin + dt * 6 * spinRate) % 360;
    this.flashV = Math.max(0, this.flashV - dt * 3.4);

    const s = Math.round(Math.min(1, intensity) * 100) / 100;
    if (s !== this._s) {
      this._s = s;
      this.streak.style.opacity = (s * s * 0.5).toFixed(3);
      this.streak.style.transform = `scale(${(1 + s * 0.14).toFixed(3)})`;
    }
    const v = Math.round(Math.min(1, intensity * 0.9) * 100) / 100;
    if (v !== this._v) { this._v = v; this.vig.style.opacity = (v * v * 0.6).toFixed(3); }
    const f = Math.round(this.flashV * 100) / 100;
    if (f !== this._f) { this._f = f; this.flashEl.style.opacity = f.toFixed(3); }
  }
}
