import './hud.css';
import { t, pct, num, onLocaleChange, applyStatic } from '../i18n/index.js';
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

/**
 * THE OPENING. Ninety seconds, and it is ninety because that is the window a
 * study measured and a gate now checks.
 *
 * design/FIRST-90-SECONDS.md §7.1 sets two caps for it — at most 3 text
 * surfaces and at most 12 readable strings — and relaxes to 5 and 30
 * afterwards. `#ui.hud-open` is that window, written once, here, and read by
 * every surface that composes itself differently for a stranger:
 * src/ui/hud.css folds, and src/ui/quiet.js drops its prose budget to one.
 * One clock, so two files cannot disagree about when the opening ended.
 */
const OPENING_MS = 90000;

/** The fold this pass writes. Defined in src/ui/hud.css. */
const FOLD = 'hud-fold';
/** …and the hush, for a surface whose BOX another module still measures. */
const HUSH = 'hud-hush';


/**
 * Every surface the three slots arbitrate between. Nothing outside this list is
 * ever touched, so a module that grows a new panel is not silently governed by
 * a file that has never heard of it.
 */
const SLOTTED = ['.fcs.show', '.gd-prompt.show', '.fc.show', '.afd-call .afd-plate', '.gd-card.show',
  '.gd-mark .gd-lab', '#toast.show', '.meta-comms.show', '.led-row'];

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
    /* THE RIG READS THE TRUTH; IT IS NOT TOLD IT.
       See `watch()`. Set by src/main.js to `hudState`, the same expression the
       report and the résumé are drawn from. */
    this._source = null;
    this._poll = 0;

    this._bornAt = performance.now();
    this._platform();
    this._buildbar();
    this._order();
    this._ownClicks();
    applyStatic(root);
    this._compose();
    this._composeT = setInterval(() => this._compose(), 60);
    onLocaleChange(() => {
      applyStatic(root); this._buildbar(); this._order();
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
   * A PRESS ON THIS PANEL BELONGS TO THIS PANEL.
   *
   * The world's build verb listens for `mousedown` on the window, and it asks
   * `Input.worldPointer` whose press it was. That question is answered
   * correctly for these controls — they are real buttons — but the answer is
   * arrived at by walking up the tree and reading computed styles, which is a
   * shared predicate three modules depend on and one this file cannot see.
   * This project has already shipped a wall built through the ORDERS card's own
   * button, so the HUD does not rely on being recognised: a press that lands on
   * a control it owns stops here, in the capture phase, before any listener on
   * the window can read it as a press on the world.
   *
   * `click` is deliberately NOT stopped — the controls' own handlers are click
   * handlers, and the input layer's pointer-lock request reads clicks on
   * capture at the window and correctly ignores anything wearing a button.
   */
  _ownClicks() {
    const eat = (e) => {
      const el = e.target;
      if (el instanceof Element && el.closest('button')) e.stopPropagation();
    };
    for (const box of [this.rig, this.root.querySelector('#buildbar')]) {
      if (!box) continue;
      box.addEventListener('pointerdown', eat);
      box.addEventListener('mousedown', eat);
      box.addEventListener('touchstart', eat, { passive: true });
    }
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

  /* THE LOCALE SWITCHER IS NOT ON THE GLASS ANY MORE.
     It was three permanent strings and a whole plate for a decision that is
     taken once, before the game boots — `<html lang>` is already resolved from
     `localStorage` and `navigator.languages` in index.html. The client asked
     for it to move ("languages should also be in settings") and §7.3 of
     design/FIRST-90-SECONDS.md lists it under CUT with the same destination.

     It is not buried. `src/ui/menu.js` builds the same `.langs` control as the
     FIRST row of the settings card, every button written in its own language —
     English, Español, Polski — and the handle that opens that card carries a
     globe beside the bars. A student who speaks Spanish and lands in English
     has to read no English at all to get out: a symbol, and then their own
     language's name for itself. */

  _buildbar() {
    const ICONS = {
      wall: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
      ramp: '<path d="M4 20 L20 20 L20 5 Z"/>',
      floor: '<path d="M3 14 L12 9 L21 14 L12 19 Z"/>',
      beam: '<path d="M4 10h16M4 14h16M8 6v12"/>',
    };
    const bar = this.root.querySelector('#buildbar');
    /* THE RACK IS SHUT UNTIL THERE IS SOMETHING TO BUILD WITH IT.
     *
     * The client's first sentence was "we need to collapse build menu by
     * default", and §7.2 of design/FIRST-90-SECONDS.md says the same thing in
     * numbers: four slots and eight readable strings, on the glass, at a cadet
     * who has not been given the verb.
     *
     * THE TWO REASONS THIS RACK CANNOT SIMPLY BE DELETED are both in the
     * comments below and both are honoured. The digit that selects a slot is
     * printed ON the slot, so this is where a keyboard learns its binding; and
     * PLACE and TURN are the only build verbs a thumb has anywhere in the game,
     * so on a phone the rack is not decoration, it is the whole system.
     *
     * So it collapses rather than disappearing, and the thing it collapses to
     * is one icon with no caption. `HANDLE` opens the rack; a digit key, the
     * wheel, a shoulder button or the build hand coming out opens it too, and
     * `.buildbar[data-reason]` — set by `watchBuild` — decides whether the
     * handle is on the glass at all. Before the game has given the cadet a
     * reason to build there is no rack, no handle, and no row of vertical
     * space spent on either. */
    const HANDLE = `<button type="button" class="slot rack" aria-expanded="false"
           title="${esc(t('controls.build'))}" aria-label="${esc(t('controls.build'))}">
         <svg viewBox="0 0 24 24" aria-hidden="true" class="bar-shut">
           <path d="M12 3 L20 7.5 L12 12 L4 7.5 Z"/><path d="M4 12.5 L12 17 L20 12.5"/>
           <path d="M4 16.5 L12 21 L20 16.5"/></svg>
         <svg viewBox="0 0 24 24" aria-hidden="true" class="bar-open">
           <path d="M6 9l6 6 6-6"/></svg>
       </button>`;
    // The digit that selects a slot is printed on the slot. A hotbar that does
    // not teach its own binding is a hotbar nobody uses the keyboard for.
    bar.innerHTML = HANDLE + ['wall', 'ramp', 'floor', 'beam'].map((k, i) =>
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
    /* `rackBar`, NOT `bar`. `this.bar` is the rig meter's fill (`#hud-bar`) and
       `_paint` writes a percentage width onto it sixty times a second. Holding
       the build rack under the same name handed the progress meter's width to
       the rack: `<div class="buildbar" style="width: 0%">`, which collapsed the
       column to its own padding and threw all six slots off the right edge of a
       390 px frame — while the rig's own meter stopped moving. */
    this.rackBar = bar;
    this.rackBtn = bar.querySelector('.slot.rack');
    const rack = (e) => {
      e.preventDefault();
      /* ONE GESTURE, ONE TOGGLE.
         A tap on a touch device fires `touchstart` and then the click the
         browser synthesises from it, and this control is a toggle — so the
         same finger opened the rack and shut it again inside a few
         milliseconds, and a phone player saw a button that did nothing.
         (`.place` and `.turn` are bound the same way and get away with it
         because firing a verb twice looks like firing it once.) */
      const now = performance.now();
      if (now - (this._rackTap || 0) < 400) return;
      this._rackTap = now;
      const want = !bar.classList.contains('open');
      // A rack the cadet opened by hand stays open until they shut it by hand.
      // Only a rack that opened because the hand came out closes when it goes
      // back in — otherwise a thumb that opened the rack to read it would
      // watch it slam shut a frame later.
      this._rackByHand = want;
      this.openRack(want);
    };
    this.rackBtn.addEventListener('click', rack);
    this.rackBtn.addEventListener('touchstart', rack, { passive: false });
    this.rackBtn.addEventListener('animationend', () => this.rackBtn.classList.remove('hit'));
    // A rebuild — a locale change rebuilds this whole element — must not slam
    // the rack shut on a cadet who is halfway through a wall, and must not
    // leave it advertising WALL while the hand holds a RAMP. Both are restored
    // from the truth rather than from what this element used to look like.
    bar.classList.toggle('open', !!this._rackOpen);
    if (this._reason) bar.dataset.reason = '1';
    this.rackBtn.setAttribute('aria-expanded', this._rackOpen ? 'true' : 'false');
    // …and the highlight comes back from the truth, not from where it was
    // before the rebuild. Measured: switching to Polish while holding a FLOOR
    // left the rack advertising a WALL, which is the exact failure
    // src/build/builder.js:setSlot calls "the worst thing a hotbar can do".
    this._slot = null;
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

  /**
   * WHAT THE RACK ADVERTISES IS WHAT THE HAND IS HOLDING.
   *
   * src/build/builder.js:setSlot documents the failure this closes: two
   * listeners answered the digit keys, the highlight was repainted only when
   * they disagreed, and so pressing 3 gave a floor while the rack went on
   * saying RAMP — *"the interface said one piece and the world built another,
   * which is the worst thing a hotbar can do."* The builder announces every
   * landing now, and this is the other end of that announcement.
   *
   * It is also PULLED, not only pushed (`watchBuild`), for the same reason the
   * one progress number is: a rebuild of this element — every locale change
   * rebuilds it — used to reset the highlight to slot 0 without asking anyone,
   * so changing language while holding a beam left the rack advertising a wall.
   * A repaint that has to be remembered is a repaint that gets forgotten.
   */
  setSlot(i) {
    this._paintSlot(i);
    // Reaching for a piece IS opening the rack. The digit keys, the wheel and
    // the shoulder buttons all arrive here, so a keyboard never has to find
    // the handle and a rack is never shut over a hand that is already out.
    this.openRack(true);
  }

  /** Move the highlight and nothing else. See `_compose`. */
  _paintSlot(i) {
    this._slot = i;
    this.slots?.forEach((s, k) => s.classList.toggle('on', k === i));
  }

  /** Open or shut the rack. Idempotent; safe to call every frame. */
  openRack(on) {
    this._rackOpen = !!on;
    if (!this.rackBar) return;
    if (on) this.buildReason(true);
    this.rackBar.classList.toggle('open', !!on);
    this.rackBtn?.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  /**
   * Has the cadet been given a reason to build?
   *
   * Before the first one there is no rack and no handle — §7.2's rule 1. After
   * it the handle stays, on every device, because a thumb that has once been
   * given the build verb must always be able to find it again.
   */
  buildReason(on = true) {
    if (!on || this._reason) return;
    this._reason = true;
    if (this.rackBar) this.rackBar.dataset.reason = '1';
  }

  /**
   * THE RACK READS THE BUILDER; IT IS NOT TOLD BY IT.
   *
   * Same argument as `watch()` above, and the same shape. `main.js` hands over
   * the expression rather than the answer, so the rack cannot be left showing a
   * piece the hand is not holding or shut over a hand that is out — including
   * across a locale change, which rebuilds this element from scratch.
   *
   * @param {() => {handOut:boolean, slot:number, reason:boolean}} source
   */
  watchBuild(source) {
    this._buildSrc = typeof source === 'function' ? source : null;
  }

  // -------------------------------------------------------------------------
  // THE COMPOSITION PASS — what the glass is allowed to carry right now
  // -------------------------------------------------------------------------
  /**
   * ONE PASS, NINE TIMES A SECOND, THAT WRITES CLASSES AND NOTHING ELSE.
   *
   * The client played the shipping build and wrote: *"i see like 3 different
   * progress bars, we need to collapse to only whats relevant and free up
   * vertical space."* An independent study had already measured the same frame
   * — ten text surfaces and seventy-six readable strings at once
   * (design/FIRST-90-SECONDS.md §1.2) — and set the caps this pass is written
   * to: **at most 3 text surfaces and 12 readable strings in the first ninety
   * seconds**, in every language, in both orientations.
   *
   * WHY IT IS A PASS AND NOT A SET OF CALL SITES. Every surface here is
   * individually correct and every one belongs to a different module, so no
   * owner can see the pile — the defect exists only in the sum. That is the
   * argument src/ui/quiet.js already makes for prose; this is the same argument
   * for the instruments. It is deliberately the same shape: it writes no words,
   * moves nothing, owns none of the panels it reads, and every decision is a
   * class that its own stylesheet (src/ui/hud.css) turns into a fold.
   *
   * AND IT READS RATHER THAN BEING TOLD. `render()` still exists and is still
   * called; this is the floor underneath it, for the same reason `watch()` is
   * the floor under the one progress number: a repaint somebody has to remember
   * to trigger is a repaint that eventually gets forgotten, and the forgetting
   * is invisible.
   */
  _compose() {
    const ui = this.root;
    if (!ui) return;

    // ---- the opening ------------------------------------------------------
    /* THE OPENING ENDS AT NINETY SECONDS, OR AT THE FIRST HELD LINE.
       Whichever comes first. The ninety is the window the study measured and
       the gate checks; the held line is the better end, because a cadet who has
       sealed a tear is no longer a stranger and has earned the whole
       instrument. It also keeps this composition out of the way of every
       critic that plays a real session before it photographs anything. */
    const opening = !this._sealed
      && performance.now() - (this._begunAt ?? this._bornAt) < OPENING_MS;
    if ((this._target?.repaired || 0) > 0.001) this._sealed = true;
    ui.classList.toggle('hud-open', opening);

    // ---- the rack follows the builder ------------------------------------
    // src/build/builder.js is the single source of truth about which piece is
    // in the hand and whether the hand is out at all. Pulled every pass, so a
    // rebuild of this element cannot leave the rack advertising the wrong
    // piece — see `setSlot`.
    if (this._buildSrc) {
      let b = null;
      try { b = this._buildSrc(); } catch { b = null; }
      if (b) {
        if (b.reason) this.buildReason(true);
        /* PAINT the highlight; do not OPEN the rack. Reading the builder's slot
           is not the cadet reaching for a piece — on the first frame of a cold
           save it reads 0 because that is where the builder starts, and an
           earlier draft treated that as a reason to build and put the handle on
           the glass at second zero. Every real reason arrives through
           `setSlot`, which the builder calls when a piece is actually chosen. */
        if (typeof b.slot === 'number' && b.slot !== this._slot) this._paintSlot(b.slot);
        // A hand that is out keeps the rack open; a hand that is stowed shuts
        // it again, which is the whole of "collapse again when they do not".
        // The handle stays: once a cadet has been given the verb they must
        // always be able to reach it.
        if (b.handOut && !this._rackOpen) this.openRack(true);
        if (!b.handOut && this._rackOpen && !this._rackByHand) this.openRack(false);
      }
    }

    // ---- the rig prints nothing it has not been given --------------------
    // A rank nobody has been promoted to and a purse with nothing in it are
    // not information. Both LATCH: once the cadet has been given one it stays
    // on the glass for the rest of the run, because an inventory that vanishes
    // when you spend it reads as a game that has broken.
    /* A RANK YOU ARRIVED WITH IS NOT AN ACHIEVEMENT.
       Every cadet starts at Copper, so "COPPER RANK" on the first frame is two
       readable strings that say nothing happened yet — and src/ui/menu.js's own
       WORDS block was written because a cold critic listed COPPER RANK among
       five invented words on screen before any of them meant anything. The chip
       arrives on the first promotion (`rankUp`, called by src/meta/index.js
       when rank actually goes up) or on a save that is already past the first
       rank, and then it stays. */
    const rankName = (this.rank?.textContent || '').trim();
    if (rankName && rankName !== '—' && rankName !== t('rank.copper')) this._gotRank = true;
    if ((this._target?.shards || 0) > 0) this._gotMotes = true;
    const earned = [this._gotRank ? 'rank' : '', this._gotMotes ? 'motes' : ''].filter(Boolean).join(' ');
    if (earned) this.rig.dataset.earned = earned;
    else delete this.rig.dataset.earned;

    // ---- one bar at a time ------------------------------------------------
    // The run band (src/session/band.js) is the pacing instrument: one cell per
    // tear, moving every forty seconds. This panel's segmented meter is the
    // long arc and moves once a session. Two bars answering "how far along am
    // I" is exactly what the client counted. While the band is up it is the
    // bar, and the rig keeps the figure — which is the one number
    // src/meta/progress.js says must never leave the glass.
    const band = ui.querySelector('.ses-band.show');
    if (band && !band.classList.contains('slot-yield')) this.rig.dataset.band = '1';
    else delete this.rig.dataset.band;

    // ---- the controls card teaches one verb at a time --------------------
    // See "4 · THE CONTROLS CARD" in src/ui/hud.css for the whole argument.
    // `.fc-pill.show` is set by `ControlsCard.hide()`, so it is the exact and
    // only signal that the card has been put away once — which makes any later
    // showing a reference lookup the player asked for, and a reference lookup
    // gets all nine rows.
    const fc = ui.querySelector('.fc');
    const first = !!fc && fc.classList.contains('show')
      && !ui.querySelector('.fc-pill.show');
    ui.classList.toggle('hud-brief', first);

    if (opening) this._slots(ui);
    else {
      for (const el of ui.querySelectorAll('.' + FOLD)) el.classList.remove(FOLD);
      for (const el of ui.querySelectorAll('.' + HUSH)) el.classList.remove(HUSH);
    }
  }

  /**
   * THREE SLOTS, AND EVERYTHING ELSE WAITS ITS TURN.
   *
   * This is the whole of the client's sentence — *"collapse to only whats
   * relevant and free up vertical space"* — written as a rule instead of as an
   * opinion. A stranger, in the first ninety seconds, is given three things and
   * no more, because §7.1 measured that three is what fits:
   *
   *   A · THE ONE NUMBER        the rig. Permanent. src/meta/progress.js says
   *                             there is exactly one progress figure in this
   *                             game and tools/critic/oneprogress.mjs fails the
   *                             build if it ever leaves the glass.
   *   B · WHAT TO DO NEXT       exactly one of: the controls card while it is
   *                             still teaching a verb, the key at the ring you
   *                             are standing at, the call on the thing you are
   *                             walking to, the objective card.
   *   C · WHAT JUST HAPPENED    exactly one of: the notice, the companion, the
   *                             newest ledger receipt.
   *
   * WHY IT IS A RANK AND NOT A BUDGET. Every pair in slot B is the same fact at
   * a different range: "walk into it · 53 m", then "E · open the rift", then
   * "you are standing in it". Three printings of one instruction is not three
   * surfaces' worth of information, it is one — so the nearest one wins and the
   * others fold. Slot C is the same shape in time rather than in space: the
   * newest thing that happened is the one being read.
   *
   * IT NEVER LIFTS ANYTHING. A fold is only ever added to a surface whose own
   * owner has it up; the owner's `.show` class is the only signal read, exactly
   * as src/ui/quiet.js does it, so a folded surface cannot be judged on a
   * visibility this pass wrote and oscillate against itself.
   */
  _slots(ui) {
    const keep = new Set();
    const pick = (sels) => {
      for (const sel of sels) {
        const el = ui.querySelector(sel);
        if (el) { keep.add(el); return; }
      }
    };
    // B — what to do next. Nearest wins.
    // The way-out card first: a wedged cadet has exactly one next action, and
    // it is not the objective. (src/player/controls.js `.fcs`, the one panel
    // that has to be reachable when things have gone wrong.)
    /* …and the world's own label on the objective mark is LAST in this rank,
       not outside it. src/ui/quiet.js already hushes it whenever the objective
       card is up — "the world label repeats the objective card word for word" —
       and that rule was written when the card was the only thing that could be
       saying it. Now the prompt or the call plate may be saying it instead, and
       a label that only stands down for the card would print "Reading a
       variable · 79 m" out in the world beside a plate saying the same thing. */
    /* THE KEY OUTRANKS THE TEACHING CARD. The interact prompt is not a card,
       it is the verb on the thing the cadet is touching — and an earlier draft
       ranked it under the first-contact card, which meant that standing at a
       tear with the controls card still up folded away the one control that
       opens it. tools/critic/transient.mjs found it in a sentence: it drops a
       notice onto the prompt and asserts the prompt yields, and a prompt that
       is not on screen cannot yield. A key is never folded by a reference
       card; the reference card yields to it. */
    pick(['.fcs.show', '.gd-prompt.show', '.fc.show', '.afd-call .afd-plate', '.gd-card.show',
      '.gd-mark .gd-lab']);
    // C — what just happened. Newest wins. The notice-versus-companion half of
    // this rank is in src/ui/hud.css, where `:has()` resolves it in the same
    // frame the class changes rather than on this pass's next tick.
    pick(['#toast.show', '.meta-comms.show', '.led-row:last-child']);

    for (const sel of SLOTTED) {
      for (const el of ui.querySelectorAll(sel)) {
        el.classList.toggle(FOLD, !keep.has(el));
      }
    }
    /* THE STANDING NARRATIVE IS NOT "NEXT".
       The chapter card arrives unprompted — the study caught it at t=27.7 s,
       eight strings landing on a player who had not asked a question. It is
       standing narrative, it is one keystroke away for the rest of the run, and
       it is not an answer to "what do I do". src/ui/quiet.js already ranks it
       last; during the opening it does not stand at all.

       THE KIT CHIP IS HUSHED RATHER THAN FOLDED, and the difference is the
       whole reason there are two classes. Folding it took its box away, the
       kit strip that carries it collapsed to nothing, and
       tools/critic/transient.mjs reads that strip's own box to know the surface
       is up — so a fold meant for one teaser took a whole column out of the
       gate's sight. Leaving it to src/ui/quiet.js did not work either: quiet
       ranks it last of eight, but this pass folds the seven above it, and a
       budget of one then hands the slot to the only thing left standing. So it
       is hushed here: no ink, and the box the strip is measured by stays
       exactly where it was. */
    for (const el of ui.querySelectorAll('.meta-quest.show')) el.classList.add(FOLD);
    for (const el of ui.querySelectorAll('.kit-chip')) el.classList.add(HUSH);
  }

  // -------------------------------------------------------------------------
  // The readout
  // -------------------------------------------------------------------------
  /**
   * WHERE THE ONE NUMBER COMES FROM — pulled, not pushed.
   *
   * A cold critic photographed the progress report reading **22% WORLD
   * REPAIRED** and, seconds later with no action taken, this rig reading **10%**
   * with the bar drawn at 10 — and the rig stayed at 10 across four more dumps,
   * roughly forty seconds of play, before it caught up. Both surfaces call the
   * same `repaired()`, so neither number was computed wrongly. The report
   * recomputes every time it is opened; the rig was told once, by whoever
   * remembered to call `render`, and any path that moved the learner model
   * without going through that one call site left the largest figure on the
   * screen describing a world the learner had already left.
   *
   * "Every surface must read the SAME value at the SAME instant" cannot be kept
   * by a notification, because a notification is a thing somebody can forget to
   * send and the forgetting is invisible. It is kept by both surfaces asking the
   * same question of the same function. So the rig is handed the expression
   * rather than the answer, and reads it on a frame of its own — cheap (a sum
   * over ten lines), idempotent, and impossible to leave stale. `render` still
   * works and is still called on the answer, because that is the frame the
   * flare belongs to; this is the floor underneath it.
   *
   * @param {() => {repaired:number, shards:number}} source
   */
  watch(source) {
    this._source = typeof source === 'function' ? source : null;
    clearInterval(this._poll);
    if (!this._source) return;
    const read = () => {
      let s = null;
      try { s = this._source(); } catch { s = null; }
      if (!s) return;
      const want = Math.max(0, Math.min(1, s.repaired || 0));
      const shards = s.shards ?? 0;
      // Nothing to say unless the glass and the truth have actually parted. A
      // repaint on every tick would restart the sweep four times a second.
      const t0 = this._target || { repaired: -1, shards: -1 };
      if (Math.round(want * 100) === Math.round(t0.repaired * 100) && shards === t0.shards) return;
      this.render(s);
    };
    read();
    this._poll = setInterval(read, 250);
  }

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

    /* THE NUMBER IS THE TRUTH; THE BAR IS THE RIDE.
       A cold critic photographed the report reading 22% and, seconds later with
       no action taken, this rig reading 10%. Two answers to one question, and
       the one the learner had been staring at all session was the wrong one.
       Part of that was staleness (fixed at the call site) and part of it was
       this: the printed integer used to be a sample of a 620 ms tween, so for
       the first half of every animation the largest figure on the glass was a
       number the engine did not hold and nothing in the game had ever claimed.
       P0's rule is exact — *if a number is animating toward a target, it must
       never be the number a teacher reads.* So the figure and its declaration
       snap to the truth on the frame the answer lands, and only the sweep of
       the bar is allowed to take its time. */
    this._target = { repaired, shards };
    this._say({ repaired, shards });
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
  rankUp() { this._gotRank = true; this._flare('rankup', 2400); }

  /**
   * Play has begun — the boot curtain is gone.
   *
   * Called from main.js beside `controls.begin()` and `story.begin()`, so the
   * ninety seconds this HUD composes for a stranger are ninety seconds of the
   * game rather than ninety seconds of a bundle parsing on a school Chromebook.
   */
  begin() { this._begunAt = performance.now(); }

  /** Sweep the bar across to the new state rather than snapping it. */
  _tween(from, to) {
    cancelAnimationFrame(this._raf);
    // A player who asked the OS for less movement gets the number, not the ride.
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this._shown = { ...to }; this._paint(to);
      return;
    }
    const a = { ...from };
    const ms = 620;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = easeOut(k);
      this._paint({ repaired: a.repaired + (to.repaired - a.repaired) * e });
      if (k < 1) this._raf = requestAnimationFrame(step);
      else { this._shown = { ...to }; this._paint(to); }
    };
    this._raf = requestAnimationFrame(step);
  }

  /**
   * THE BAR ONLY. Every frame of the animation moves the sweep and nothing
   * else: no text, no declaration, no aria label. What a person reads is
   * written once, by `_say`, on the frame the truth arrived.
   */
  _paint(v) {
    const f = v.repaired * 100;
    this.bar.style.width = `${f}%`;
    this.head.style.left = `${f}%`;
    this.head.style.opacity = f > 0.5 ? '1' : '0';
  }

  /**
   * THE WORDS AND THE NUMBERS, at the value the engine actually holds.
   *
   * Called from `render` before the tween starts, so there is no instant at
   * which the glass carries a figure the model does not. `_paint` may not write
   * anything this function writes; the gate reads `data-fig-v` off the element
   * this writes it on, and compares it to the engine with zero slack.
   */
  _say(v) {
    this.int.textContent = pct(v.repaired);
    /* THE ONE PROGRESS FIGURE, DECLARED — at the target, never at the tween. */
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
    this._label(v);
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

  /* A NOTICE IS NEVER HELD BACK — not even for the companion.
   *
   * One draft of this pass queued a notice behind a sentence Marlow was still
   * reading, so that during the opening only one of the game's two "that just
   * happened" channels was ever on the glass. It read well and it was wrong:
   * tools/critic/transient.mjs drops a notice onto the interact prompt and
   * asserts the prompt yields within half a second, and a notice that can be
   * held for a second and a half is a notice that is no longer an answer to the
   * button that caused it. src/ui/slots.css's own rule 3 already settles who
   * gives way when two surfaces cannot share a frame, and src/ui/hud.css settles
   * this pair with `:has(#toast.show)`: the notice takes the slot, the
   * companion's card stands down for the 1800 ms the notice lives, and her line
   * is on the glass again the moment it goes — her own clock never stopped. */

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
    /* THE MENU IS ON THIS LIST NOW, and it is the one that mattered most: a
       pad opens it with Start (src/ui/menu.js:_pad) and, until this line, had
       no way to move focus inside it or to press anything on it. The settings
       that live there — sound, language, look speed — were reachable by
       keyboard and by thumb and by nobody holding a controller. */
    const open = document.querySelector('.rift.show, .dos.show, .meta-dossier.show, .mnu.show');
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

/** Text into an attribute. The rack's handle carries its name in a `title`. */
function esc(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
