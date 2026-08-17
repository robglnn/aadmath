import { t, pct, num, LOCALES, LOCALE_SWITCH, getLocale, setLocale, onLocaleChange, applyStatic } from '../i18n/index.js';
import { FIG, tagFigure } from '../meta/progress.js';

/**
 * The rig readout — and the one place in this game that answers "how am I
 * doing".
 *
 * THE ONE NUMBER IS **WORLD REPAIRED**, a percentage. See `src/meta/progress.js`
 * for the whole rule and for why the number is what it is; the part that
 * belongs here is what this file is now forbidden to do.
 *
 * A cold critic counted nine progress figures on one frame. Two of them were on
 * this panel — the percentage, and a rank ladder drawn on the meter implying
 * the rank came from that percentage when it comes from standing. This panel is
 * now the single progress instrument, and nothing else on the live HUD prints a
 * progress figure at all:
 *
 *   - The meter carries **ONE value**. It used to carry two — a solid fill for
 *     mastery and a dimmer ghost ahead of it for "credit still being earned" —
 *     which is two answers to one question rendered zero pixels apart. The one
 *     value is now the belief-weighted figure itself, so the ghost's meaning is
 *     inside the number rather than beside it.
 *   - The meter is **segmented and raked**, so a gain is a count of cells that
 *     lit rather than a rectangle that got wider.
 *   - **No rank marks.** They said "rank arrives at 20/40/60/80% of this bar",
 *     and rank does not: it is bought with standing (`src/meta/arc.js`), which
 *     is why the rig could read COPPER while the chapter card read BRONZE. This
 *     panel no longer derives a rank at all — `src/meta/index.js` owns rank and
 *     writes the name here, one source, no second opinion.
 *   - It is **the rank's colour**, live, off the same `--rank-ink` the story
 *     sets. Nothing here can disagree with the chapter card beneath it.
 *   - Numbers **travel**. A rise counts up and the meter head flares. A number
 *     that snaps is a spreadsheet.
 *
 * Everything tweened is inside `aria-live="off"`, with one composed label on
 * the panel — otherwise `#ui`'s polite live region would read forty
 * intermediate percentages out loud on every answer.
 */

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
            <!-- THERE IS NO DELTA CHIP HERE ANY MORE. It printed "+7%" beside
                 the figure it was a change in — a second numeral, twenty pixels
                 from the one number, on the one panel this whole pass exists to
                 keep down to one. The gain is still felt: the meter sweeps, the
                 head flares, and the figure counts up to its new value rather
                 than snapping. A rise you can watch happen does not need to be
                 restated as an arithmetic. -->
            <span class="rig-pct" id="hud-int">0%</span>
          </div>
          <div class="rig-meter" id="hud-meter">
            <i class="fill" id="hud-bar"></i>
            <i class="head" id="hud-head"></i>
            <i class="cells"></i>
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
    this.head = root.querySelector('#hud-head');
    this.marlow = root.querySelector('#marlow');
    this.toast = root.querySelector('#toast');

    this.rig.style.setProperty('--cells', String(CELLS));

    // what is currently drawn, so a change can be animated from it
    this._shown = { repaired: 0, shards: 0 };
    this._flareT = {};

    this._platform();
    this._langs();
    this._buildbar();
    this._order();
    applyStatic(root);
    onLocaleChange(() => {
      applyStatic(root); this._langs(); this._buildbar(); this._order();
      // The rank NAME is written by src/meta/index.js (`syncChip`), which is the
      // single owner of rank; it re-says it on a locale change. This panel only
      // has to forget what it has painted so the figure counts up again in the
      // new language's numerals.
      this._shown = { repaired: 0, shards: 0 };
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
      // Turning the piece is a core build control, not a keyboard luxury: on a
      // phone there is no yaw key at all, so without this a thumb can never
      // choose which face of a cell a wall goes on — which is to say it can
      // never intend a corner. It wears `.place` so it inherits every rule that
      // button already has, including the landscape ones.
      + `<button type="button" class="slot place turn" data-turn="1">
           <u aria-hidden="true"></u>
           <svg viewBox="0 0 24 24" aria-hidden="true">
             <path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 3v4h-4"/></svg>
           <span>${t('build.turn')}</span>
         </button>`
      + `<button type="button" class="slot place" data-place="1">
           <svg viewBox="0 0 24 24" aria-hidden="true">
             <path d="M12 3 L20 7.5 L12 12 L4 7.5 Z"/><path d="M4 12.5 L12 17 L20 12.5"/>
             <path d="M4 16.5 L12 21 L20 16.5"/></svg>
           <span>${t('controls.build')}</span>
         </button>`;
    this.slots = [...bar.querySelectorAll('.slot[data-slot]')];
    this.turnBtn = bar.querySelector('.slot.turn');
    const turn = (e) => { e.preventDefault(); this.turnBtn.classList.add('hit'); this.onTurn?.(); };
    this.turnBtn.addEventListener('click', turn);
    this.turnBtn.addEventListener('touchstart', turn, { passive: false });
    this.turnBtn.addEventListener('animationend', () => this.turnBtn.classList.remove('hit'));
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
  /**
   * @param {{repaired:number, shards:number}} s `repaired` is the 0..1 fraction
   *   from `repaired()` in src/meta/progress.js — the ONE progress number. This
   *   panel does not compute it, does not adjust it, and does not derive a
   *   second figure from it.
   */
  render(s) {
    this._last = s;
    const repaired = Math.max(0, Math.min(1, s.repaired || 0));
    const shards = s.shards ?? 0;

    const from = this._shown;
    if (repaired - from.repaired > 0.004) this._flare('gain', 1500);
    if (shards > from.shards) this._flare('shardup', 900);

    this._tween(from, { repaired, shards });
  }

  /**
   * A promotion, announced by the one thing that owns rank.
   *
   * `src/meta/index.js` writes the rank name and the rank colour onto this
   * panel (`syncChip`). It calls this when the rank actually went up, so the
   * flare belongs to a real promotion instead of to a percentage crossing an
   * imaginary line — which is what it used to belong to, on a ladder that had
   * nothing to do with how rank is earned.
   */
  rankUp() { this._flare('rankup', 2400); }

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
        repaired: a.repaired + (to.repaired - a.repaired) * e,
        shards: Math.round(a.shards + (to.shards - a.shards) * e),
      };
      this._paint(cur);
      if (k < 1) this._raf = requestAnimationFrame(step);
      else { this._shown = { ...to }; this._paint(to); this._label(to); }
    };
    this._raf = requestAnimationFrame(step);
  }

  _paint(v) {
    const f = v.repaired * 100;
    this.bar.style.width = `${f}%`;
    this.head.style.left = `${f}%`;
    this.head.style.opacity = f > 0.5 ? '1' : '0';
    this.int.textContent = pct(v.repaired);
    /* THE ONE PROGRESS FIGURE, DECLARED.
       Tagged with the rounded whole per cent rather than the tweening fraction,
       because that is what a person reads off the glass: the gate compares the
       screen against the engine, and it must compare the printed integer, not a
       number that is mid-animation. */
    tagFigure(this.int, FIG.REPAIRED, Math.round(v.repaired * 100));
    this.shards.textContent = num(v.shards);
    // A noun after a numeral inflects in Polish — 1 odłamek, 3 odłamki,
    // 12 odłamków — so the caption is drawn with the count, not as a fixed
    // label sitting next to one.
    this.shardCap.textContent = t('hud.shards', { n: v.shards });
    // Motes are spendable, not progress — the foundry trades them for updrafts.
    // Declared anyway, so the gate can tell an inventory from a fourth opinion
    // about mastery rather than having to guess from the words.
    tagFigure(this.shards, FIG.MOTES, v.shards);
  }

  /**
   * One composed, localised line for assistive tech — said once, not forty
   * times. The *sentence* is a translated pattern, not three fragments joined
   * in English order: a screen reader is the one surface where a botched word
   * order cannot be papered over by layout.
   */
  _label(v) {
    this.rig.setAttribute('aria-label', t('hud.readout', {
      pct: pct(v.repaired),
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

  /**
   * THE NOTICE SLOT — one at a time, in order, and never overwritten.
   *
   * There is exactly one notice on this screen (src/ui/slots.css names its
   * slot), and this used to be a single element with a single 1800 ms timer:
   * whatever was said second deleted whatever was said first, mid-sentence,
   * with no trace. src/kit/ledger.css already carries the scar — "the line
   * explaining a surge was being deleted by the 'no footing' toast that the
   * same surge's knockback fired half a second later" — and its answer was to
   * build a second element and a second clock rather than to fix the slot.
   *
   * So the slot is a QUEUE. Each notice gets its whole life, and the next one
   * starts when it ends.
   *
   * Three rules that make a queue honest rather than a backlog:
   *   · the same words, twice, are one notice. A player leaning on a verb they
   *     cannot afford asks for the same sentence sixty times a second; it is
   *     already on screen, so the repeat is dropped. It is NOT allowed to
   *     restart the clock either — that is how a message ends up on the glass
   *     for as long as a finger is down, which is a message with no end.
   *   · at most two wait. A notice that lands more than four seconds after the
   *     button that caused it is not an answer, it is noise, so the oldest
   *     waiting one is dropped rather than the newest.
   *   · `classList`, never `className`. src/ui/slots.js may have hushed this
   *     element for standing on something, and assigning the whole class string
   *     wipes that decision until its next pass 110 ms later — which the player
   *     sees as a flicker.
   */
  flash(text, kind = '') {
    const q = (this._notices ||= []);
    const live = this._notice;
    if (live && live.text === text) return;
    if (q.length && q[q.length - 1].text === text) return;
    if (!live) { this._noticeShow({ text, kind }); return; }
    q.push({ text, kind });
    while (q.length > 2) q.shift();
  }

  _noticeShow(n) {
    this._notice = n;
    this.toast.textContent = n.text;
    this.toast.classList.remove('good', 'bad');
    if (n.kind) this.toast.classList.add(n.kind);
    this.toast.classList.add('show');
    this._noticeHold();
  }

  /** Run this notice's dwell, then hand the slot to whatever is waiting. */
  _noticeHold() {
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => {
      this.toast.classList.remove('show');
      this._notice = null;
      const next = (this._notices ||= []).shift();
      // Long enough that two notices read as two, short enough that the second
      // still belongs to the button that asked for it.
      if (next) this._toastT = setTimeout(() => this._noticeShow(next), 220);
    }, 1800);
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
    const tu = this.turnBtn?.querySelector('u');
    // i18n-allow: keycaps. `F` is the same cap on every layout this game ships
    // to, and a d-pad glyph is a picture of a control, not a word.
    if (tu) tu.textContent = pad ? '✛' : 'F';
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
