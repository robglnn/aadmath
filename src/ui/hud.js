import { t, pct, num, LOCALES, LOCALE_SWITCH, getLocale, setLocale, onLocaleChange, applyStatic } from '../i18n/index.js';

/**
 * The rig readout.
 *
 * The HUD's whole job is to make one number felt: **lattice integrity**. It is
 * the number the world is built out of — the story reads it for the act you
 * are in, the rifts read it for what opens next, and the standard in the plaza
 * is painted in its colour. So it is not a chip with a bar in it. It is an
 * instrument:
 *
 *   - The meter is **segmented and raked**, so a gain is a count of cells that
 *     lit rather than a rectangle that got wider. You can see three cells go.
 *   - It carries **two values at once**: the solid fill is mastery the rig will
 *     stand behind, and the dimmer ghost ahead of it is credit still being
 *     earned. The gap between them is the honest picture of a session in
 *     progress, and it is the thing that makes you want to close it.
 *   - **The rank ladder is drawn on the meter**, at 20/40/60/80% — exactly
 *     where `src/meta/arc.js` puts the act breaks. You can see the next rank
 *     coming before you reach it.
 *   - It is **the rank's colour**, live, off the same `--rank-ink` the story
 *     sets. Copper reads as copper. Sovereign reads as violet. Nothing here
 *     can disagree with the chapter card sitting directly beneath it.
 *   - Numbers **travel**. A rise counts up, the meter head flares, and the
 *     delta rides up out of the panel. A number that snaps is a spreadsheet.
 *
 * Everything tweened is inside `aria-live="off"`, with one composed label on
 * the panel — otherwise `#ui`'s polite live region would read forty
 * intermediate percentages out loud on every answer.
 */

const RANKS = ['copper', 'bronze', 'silver', 'gold', 'sovereign'];
/** Integrity at which each rank begins — the same ladder src/meta/arc.js uses. */
const RANK_AT = [0.2, 0.4, 0.6, 0.8];
const CELLS = 30;

const easeOut = (x) => 1 - Math.pow(1 - x, 3);

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-top">
        <div class="rig plate" id="rig" role="group" aria-live="off">
          <div class="rig-line">
            <span class="rig-cap" data-i18n="hud.mastery"></span>
            <span class="rig-delta" id="hud-delta" aria-hidden="true"></span>
            <span class="rig-pct" id="hud-int">0%</span>
          </div>
          <div class="rig-meter" id="hud-meter">
            <i class="soft" id="hud-soft"></i>
            <i class="fill" id="hud-bar"></i>
            <i class="head" id="hud-head"></i>
            <i class="cells"></i>
            <i class="marks">${RANK_AT.map((v) => `<u style="left:${v * 100}%"></u>`).join('')}</i>
            <i class="sweep"></i>
          </div>
          <div class="rig-line rig-foot">
            <span class="rig-rank" id="hud-rankchip"><em id="hud-rank">—</em><i data-i18n="hud.rank"></i></span>
            <span class="rig-shards">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L20 12 L12 22 L4 12 Z"/></svg>
              <em id="hud-shards">0</em><i id="hud-shardcap"></i>
            </span>
          </div>
        </div>
      </div>
      <div class="langs plate" id="langs"></div>
      <div class="crosshair"><b></b><i class="n"></i><i class="e"></i><i class="s"></i><i class="w"></i></div>
      <div class="marlow plate" id="marlow"></div>
      <div class="toast plate" id="toast"></div>
      <div class="buildbar plate" id="buildbar"></div>
    `;
    this.rig = root.querySelector('#rig');
    this.rankChip = root.querySelector('#hud-rankchip');
    this.rank = root.querySelector('#hud-rank');
    this.shards = root.querySelector('#hud-shards');
    this.shardCap = root.querySelector('#hud-shardcap');
    this.int = root.querySelector('#hud-int');
    this.bar = root.querySelector('#hud-bar');
    this.softBar = root.querySelector('#hud-soft');
    this.head = root.querySelector('#hud-head');
    this.delta = root.querySelector('#hud-delta');
    this.marlow = root.querySelector('#marlow');
    this.toast = root.querySelector('#toast');

    this.rig.style.setProperty('--cells', String(CELLS));

    // what is currently drawn, so a change can be animated from it
    this._shown = { integrity: 0, soft: 0, shards: 0 };
    this._rankIx = -1;
    this._flareT = {};

    this._platform();
    this._langs();
    this._buildbar();
    this._order();
    applyStatic(root);
    onLocaleChange(() => {
      applyStatic(root); this._langs(); this._buildbar(); this._order();
      // The rank name is only rewritten when the rank *changes*, so on a
      // language switch it would sit there in the old language until the
      // cadet was promoted. Forget which rank is painted and let render()
      // write it again. (-1 also keeps the promotion flare from firing.)
      this._rankIx = -1;
      this._shown = { integrity: 0, soft: 0, shards: 0 };
      this.render(this._last || {});
    });
    // A phone that turns sideways is a different machine: the thumbs move, the
    // free band moves with them, and `innerWidth < 760` can flip either way.
    addEventListener('resize', () => this._platform());
    addEventListener('orientationchange', () => this._platform());
  }

  /**
   * Where the caption sits relative to the value it captions.
   *
   * "COPPER RANK" is an English noun phrase, and it was built out of two
   * elements in a fixed order — so Polish rendered it as "MIEDŹ RANGA" and
   * Spanish as "COBRE RANGO", both of which are two nouns shoved together
   * rather than a label. Word order is part of a language, not part of a
   * layout, so the order comes out of the bundle like every other word does.
   */
  _order() {
    const capFirst = t('hud.capOrder') === 'before';
    this.rankChip.dataset.cap = capFirst ? 'before' : 'after';
    // The nodes are moved, not merely painted in the other order. Reversing a
    // flex row leaves the DOM saying "MIEDŹ RANGA" while the screen says
    // "RANGA MIEDŹ", which is what a screen reader and a text selection would
    // both get wrong — and a screen reader is precisely the surface where a
    // botched word order has no layout to hide behind.
    this.rankChip.append(...(capFirst
      ? [this.rankChip.querySelector('i'), this.rank]
      : [this.rank, this.rankChip.querySelector('i')]));
    this.shardCap.textContent = t('hud.shards', { n: this._shown.shards });
  }

  _langs() {
    const box = this.root.querySelector('#langs');
    // A flag is not a language and a two-letter code is not a name. Each
    // button carries its own language's word for itself, said in that
    // language, so a screen reader and a hovering hand both get it right.
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', t('hud.language'));
    box.innerHTML = LOCALES.map((l) => {
      const m = LOCALE_SWITCH[l] || { short: l.toUpperCase(), name: l, title: l };
      return `<button type="button" lang="${l}" data-loc="${l}" class="${l === getLocale() ? 'on' : ''}"` +
        ` title="${m.title}" aria-label="${m.name}"` +
        ` aria-pressed="${l === getLocale() ? 'true' : 'false'}">${m.short}</button>`;
    }).join('');
    box.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => setLocale(b.dataset.loc)));
  }

  _buildbar() {
    const ICONS = {
      wall: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
      ramp: '<path d="M4 20 L20 20 L20 5 Z"/>',
      floor: '<path d="M3 14 L12 9 L21 14 L12 19 Z"/>',
      beam: '<path d="M4 10h16M4 14h16M8 6v12"/>',
    };
    const bar = this.root.querySelector('#buildbar');
    // The digit that selects a slot is printed on the slot. A hotbar that does
    // not teach its own binding is a hotbar nobody uses the keyboard for.
    bar.innerHTML = ['wall', 'ramp', 'floor', 'beam'].map((k, i) =>
      `<button type="button" class="slot ${i === 0 ? 'on' : ''}" data-slot="${i}">
         <u aria-hidden="true">${i + 1}</u>
         <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>
         <span>${t('build.' + k)}</span>
       </button>`).join('')
      // The verb, on a device that has no mouse button.
      //
      // On a phone the hotbar was decorative: you could pick a wall and there
      // was no gesture anywhere in the game that would set it down — a whole
      // system, four buttons wide, that did nothing. It belongs on the hotbar
      // rather than on the thumb pad because that is where the piece it places
      // was chosen, and because the hotbar is already out of the stick's way.
      + `<button type="button" class="slot place" data-place="1">
           <svg viewBox="0 0 24 24" aria-hidden="true">
             <path d="M12 3 L20 7.5 L12 12 L4 7.5 Z"/><path d="M4 12.5 L12 17 L20 12.5"/>
             <path d="M4 16.5 L12 21 L20 16.5"/></svg>
           <span>${t('controls.build')}</span>
         </button>`;
    this.slots = [...bar.querySelectorAll('.slot[data-slot]')];
    this.slots.forEach((s) => s.addEventListener('click', () => this.onSlot?.(+s.dataset.slot)));
    const place = bar.querySelector('.place');
    const fire = (e) => { e.preventDefault(); place.classList.add('hit'); this.onPlace?.(); };
    place.addEventListener('click', fire);
    place.addEventListener('touchstart', fire, { passive: false });
    place.addEventListener('animationend', () => place.classList.remove('hit'));
    this._bindingLabels(document.documentElement.dataset.input || 'kbm');
  }

  setSlot(i) {
    this.slots?.forEach((s, k) => s.classList.toggle('on', k === i));
  }

  // -------------------------------------------------------------------------
  // The readout
  // -------------------------------------------------------------------------
  render(s) {
    this._last = s;
    const integrity = Math.max(0, Math.min(1, s.integrity || 0));
    const soft = Math.max(integrity, Math.min(1, s.soft ?? integrity));
    const shards = s.shards ?? 0;

    const rankIx = Math.min(RANKS.length - 1, Math.floor(integrity * RANKS.length));
    if (rankIx !== this._rankIx) {
      const up = rankIx > this._rankIx && this._rankIx >= 0;
      this._rankIx = rankIx;
      this.rank.textContent = t('rank.' + RANKS[rankIx]);
      this.rig.dataset.rank = RANKS[rankIx];
      if (up) this._flare('rankup', 2400);
    }

    const from = this._shown;
    const gain = integrity - from.integrity;
    if (gain > 0.004) {
      this.delta.textContent = '+' + pct(gain);
      this._flare('gain', 1500);
    }
    if (shards > from.shards) this._flare('shardup', 900);

    this._tween(from, { integrity, soft, shards });
  }

  /** Count the readout across to a new state rather than snapping to it. */
  _tween(from, to) {
    cancelAnimationFrame(this._raf);
    // A player who asked the OS for less movement gets the number, not the ride.
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this._shown = { ...to }; this._paint(to); this._label(to);
      return;
    }
    const a = { ...from };
    const ms = 620;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = easeOut(k);
      const cur = {
        integrity: a.integrity + (to.integrity - a.integrity) * e,
        soft: a.soft + (to.soft - a.soft) * e,
        shards: Math.round(a.shards + (to.shards - a.shards) * e),
      };
      this._paint(cur);
      if (k < 1) this._raf = requestAnimationFrame(step);
      else { this._shown = { ...to }; this._paint(to); this._label(to); }
    };
    this._raf = requestAnimationFrame(step);
  }

  _paint(v) {
    const f = v.integrity * 100, g = v.soft * 100;
    this.bar.style.width = `${f}%`;
    this.softBar.style.width = `${g}%`;
    this.head.style.left = `${f}%`;
    this.head.style.opacity = f > 0.5 ? '1' : '0';
    this.int.textContent = pct(v.integrity);
    this.shards.textContent = num(v.shards);
    // A noun after a numeral inflects in Polish — 1 odłamek, 3 odłamki,
    // 12 odłamków — so the caption is drawn with the count, not as a fixed
    // label sitting next to one.
    this.shardCap.textContent = t('hud.shards', { n: v.shards });
    // Which rank gates are behind us — the ladder lights as it is passed.
    this.rig.dataset.passed = String(RANK_AT.filter((x) => v.integrity >= x - 1e-6).length);
  }

  /**
   * One composed, localised line for assistive tech — said once, not forty
   * times. The *sentence* is a translated pattern, not three fragments joined
   * in English order: a screen reader is the one surface where a botched word
   * order cannot be papered over by layout.
   */
  _label(v) {
    this.rig.setAttribute('aria-label', t('hud.readout', {
      pct: pct(v.integrity),
      rank: this.rank.textContent,
      n: num(v.shards),
      shards: t('hud.shards', { n: v.shards }),
    }));
  }

  _flare(cls, ms) {
    this.rig.classList.remove(cls);
    void this.rig.offsetWidth;
    this.rig.classList.add(cls);
    clearTimeout(this._flareT[cls]);
    this._flareT[cls] = setTimeout(() => this.rig.classList.remove(cls), ms);
  }

  say(text, ms = 5200) {
    this.marlow.textContent = text;
    this.marlow.classList.add('show');
    clearTimeout(this._sayT);
    this._sayT = setTimeout(() => this.marlow.classList.remove('show'), ms);
  }

  flash(text, kind = '') {
    this.toast.textContent = text;
    this.toast.className = `toast plate show ${kind}`;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this.toast.className = 'toast plate'; }, 1800);
  }

  // ---------------------------------------------------------------------------
  // Which machine is this, and whose hands are on it
  // ---------------------------------------------------------------------------
  /**
   * `[data-touch]` and `[data-input]` on the root element.
   *
   * The layout has to know whether a thumb owns the foot of the screen *before*
   * it places anything there, and no media query can tell it: `(pointer:
   * coarse)` is false on a touchscreen laptop the moment a mouse is plugged in,
   * and false in every headless capture of a phone-sized viewport. So the flag
   * comes from exactly the predicate src/player/touch.js uses to decide whether
   * to mount the controls at all. One decision, two consumers.
   *
   * `[data-input]` follows the hands live — kbm, pad, touch — which is what
   * lets the hotbar print `1` for a keyboard and the shoulder button for a
   * controller, and lets the crosshair get out of the way of a thumb.
   */
  _platform() {
    const el = document.documentElement;
    const touch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
      || 'ontouchstart' in window
      || (navigator.maxTouchPoints || 0) > 0
      || innerWidth < 760;
    if (touch) el.dataset.touch = '1'; else delete el.dataset.touch;
    if (!el.dataset.input) el.dataset.input = touch ? 'touch' : 'kbm';
    this._touch = touch;
  }

  /**
   * Follow the live input source, and give a controller a way through the DOM.
   *
   * Called once from main.js with the shared Input and the engine. Everything
   * here is edge-triggered off state that is already being sampled every frame,
   * so it costs a comparison per frame and a DOM write only when the player
   * actually changes hands.
   */
  bindInput(input, engine) {
    this.input = input;
    const el = document.documentElement;
    let last = null;
    const tick = () => {
      // `source` defaults to 'kbm' because that is what the Input class is born
      // holding, not because anybody typed anything. On a device that has no
      // keyboard, silence means touch.
      const src = (this._touch && input.source === 'kbm' && !input.locked && !input.keys.size)
        ? 'touch' : input.source;
      if (src !== last) {
        last = src;
        el.dataset.input = src;
        this._bindingLabels(src);
      }
      this._padUI(input);
    };
    if (engine?.add) engine.add(tick);
    else this._padTimer = setInterval(tick, 100);
  }

  /** The hotbar teaches whatever binding the player is actually holding. */
  _bindingLabels(src) {
    const pad = src === 'pad';
    this.slots?.forEach((s, i) => {
      const u = s.querySelector('u');
      if (u) u.textContent = pad ? (i === 0 ? 'LB' : i === 3 ? 'RB' : '') : String(i + 1);
    });
    this.root.dataset.bind = src;
  }

  /**
   * A controller, through a panel.
   *
   * The rift stabiliser, the dossier and the language pill are DOM, and a
   * gamepad has no pointer — so without this a pad player can walk to a tear,
   * open it, and then be unable to answer the question inside it, which is the
   * entire game. The stick and the d-pad move real DOM focus by *geometry*
   * (the nearest focusable in the direction pushed, not the next one in source
   * order, because a keypad and a beam are grids, not lists), A activates, B
   * sends the Escape the panels already listen for.
   *
   * Deliberately not a focus trap: it only runs while something modal is
   * actually open, and it never touches focus while the player is out in the
   * world with a pad in their hands.
   */
  _padUI(input) {
    const gp = input.gamepad;
    if (!gp || input.source !== 'pad') { this._padNav = null; return; }
    const open = document.querySelector('.rift.show, .dos.show, .meta-dossier.show');
    if (!open) { this._padNav = null; return; }
    const prev = this._padNav || (this._padNav = { t: 0 });

    const b = (i) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes;
    const now = performance.now();
    const dx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0) + (Math.abs(ax[0] || 0) > 0.6 ? Math.sign(ax[0]) : 0);
    const dy = (b(13) ? 1 : 0) - (b(12) ? 1 : 0) + (Math.abs(ax[1] || 0) > 0.6 ? Math.sign(ax[1]) : 0);

    if ((dx || dy) && now - prev.t > 190) {
      prev.t = now;
      this._focusStep(open, Math.sign(dx), Math.sign(dy));
    } else if (!dx && !dy) {
      prev.t = 0;
    }

    const a = b(0), back = b(1);
    if (a && !prev.a) {
      const f = document.activeElement;
      if (f && open.contains(f) && typeof f.click === 'function') f.click();
      else this._focusStep(open, 0, 1);
    }
    if (back && !prev.b) {
      open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    prev.a = a; prev.b = back;
  }

  /** Move focus to the nearest focusable in a direction, inside `root`. */
  _focusStep(root, dx, dy) {
    const all = [...root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter((e) => !e.disabled && e.offsetParent !== null);
    if (!all.length) return;
    const cur = all.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { all[0].focus(); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestD = Infinity;
    for (const e of all) {
      if (e === cur) continue;
      const r = e.getBoundingClientRect();
      const vx = r.left + r.width / 2 - ax, vy = r.top + r.height / 2 - ay;
      // only what lies in the pushed direction, and cross-axis drift is
      // penalised so a nudge right never jumps two rows down
      if (dx && Math.sign(vx) !== dx) continue;
      if (dy && Math.sign(vy) !== dy) continue;
      const along = dx ? Math.abs(vx) : Math.abs(vy);
      const across = dx ? Math.abs(vy) : Math.abs(vx);
      const d = along + across * 2.6;
      if (d < bestD) { bestD = d; best = e; }
    }
    (best || all[0]).focus();
  }
}
