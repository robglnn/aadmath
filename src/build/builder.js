import * as THREE from 'three';
import './build.css';
import { t } from '../i18n/index.js';
import { CELL, KINDS, BASE_KINDS, SHARD_COST, SPEC, originY, surfaceAt, clamp } from './pieces.js';
import { Solids } from './solids.js';
import { Lattice } from './lattice.js';
import { Ghost } from './ghost.js';
import { Anchors } from './anchors.js';
import { Manipulatives } from './manipulative.js';

/**
 * Axiom building — the cadet's own lattice, and the game's second verb.
 *
 * The whole system is one loop: aim picks a **cell** and a **level**, the ghost
 * shows both, a click commits a piece into the renderer *and* into the collider
 * at the same instant, and the collider is the same surface the player's boots
 * read. That last part is what turns building from decoration into traversal —
 * a ramp you set is a ramp you can run up, a floor you set is a bridge over the
 * void, and the three anchors over the plaza are only reachable that way.
 *
 * At a rift the same pieces stop being architecture and start being apparatus:
 * a beam becomes a balance carrying the two sides of the equation, a floor
 * becomes the area model of the product. You are not shown a diagram — you
 * build the diagram, out of the thing you were already building with.
 */
/**
 * WHAT THE LATTICE COSTS, AND WHY IT IS NOT FREE.
 *
 * The reserve used to hold eleven ramps and refill itself in four seconds, from
 * the first frame of a new save, for ever. That made the entire build sandbox —
 * the game's second verb — something a player owned before answering a single
 * question, which is the exact failure the brief names: the mathematics bought
 * prose while the capability was handed over anyway.
 *
 * So the starting reserve is a working reserve, not a generous one: enough to
 * rush a stair, not enough to bridge a canyon without thinking. `DEEP RESERVE`
 * (the third sealed line, src/kit/kit.js) more than doubles both numbers, and a
 * player feels that the moment they hold the trigger down.
 */
/**
 * THE HAND IS STOWED UNTIL IT IS DRAWN.
 *
 * A cold player's first instinct in a third-person game is to click, and this
 * game answered that instinct by slamming a four-metre wall across the frame —
 * before the player had been told building existed, before they knew a piece
 * could be cleared, and in the one shot that has to sell the place. A verb
 * nobody chose is not a verb, it is an accident.
 *
 * So the lattice hand starts stowed. It is drawn by an act that can only be
 * deliberate — picking a piece off the hotbar with 1–4, the wheel, a shoulder
 * button or a tap — and once drawn it stays drawn for the rest of the save.
 * Until then a click on the world costs nothing and says, once, what the hand
 * is and how to draw it. The gate lives in `update()` rather than in `place()`
 * so that everything which places a piece for its own reasons — the caches'
 * perches, the manipulatives at a rift, the critics' harness — is untouched.
 */
const HAND_KEY = 'ascent.hand';

const MAX_CHARGE = 78;
const REGEN = 16;
const REPEAT = 0.135;
const EYE = 1.62;
/** How often a click on a stowed hand is allowed to explain itself. Seconds. */
const NUDGE_EVERY = 5;

export class Builder {
  constructor(scene, player, opts = {}) {
    this.scene = scene;
    this.player = player;
    this.input = opts.input || null;
    this.hud = opts.hud || null;
    this.groundAt = opts.groundAt || (() => null);

    this.slot = 0;
    this.maxCharge = MAX_CHARGE;
    this.regen = REGEN;
    this.charge = MAX_CHARGE;
    this.active = true;
    this.placedCount = 0;

    // A save that does not exist yet is a player who has never held the hand.
    // (`__ascent.reset()` clears the save, so this follows it without knowing
    // anything about the reset path.)
    try {
      if (!localStorage.getItem('ascent.save')) localStorage.removeItem(HAND_KEY);
      this.handOut = localStorage.getItem(HAND_KEY) === '1';
    } catch { this.handOut = false; }
    this._nudgeT = -999;   // the first click is always allowed its sentence
    /** Called the first time the hand comes out, so the world can react. */
    this.onHand = null;

    // What the cadet is allowed to set. The kit (src/kit/kit.js) opens the rest
    // of this list as lines are sealed; nothing else in the build system knows
    // or cares that a kind can be locked.
    this.allowed = new Set(BASE_KINDS);
    // The shard ledger, handed over by main.js. A kit piece is paid for out of
    // the mathematics, not out of thin air.
    this.wallet = { count: () => 0, spend: () => false };

    this.solids = new Solids(this.groundAt);
    this.solids.feet = () => this.player.pos.y;
    this.lattice = new Lattice(scene);
    this.ghostView = new Ghost(scene);
    this.anchors = opts.anchors === false ? null
      : new Anchors(scene, this.groundAt, player.pos.clone());
    this.man = new Manipulatives(scene, opts.uiRoot || document.body);

    this._dom(opts.uiRoot);

    this._cands = [];
    this._tg = {
      kind: 'wall', x: 0, y: 0, z: 0, yaw: 0, base: 0, valid: false, reason: '',
    };
    this._ray = new THREE.Vector3();
    this._eye = new THREE.Vector3();
    this._aimed = null;
    this._repeat = 0;
    this._held = false;
    this._removeReq = false;
    this._padPrev = [];
    this._chargeShown = -1;
    this._bind();

    // kept for anything that still reads the old shape of this object
    this.pieces = this.lattice.live;
    this.kinds = KINDS;
    this.ghost = { get visible() { return false; } };
  }

  // ---------------------------------------------------------------- surface
  _dom(root) {
    const host = root || document.body;
    const el = document.createElement('div');
    el.className = 'axiom';
    el.innerHTML = `
      <span data-i18n="build.charge"></span>
      <span class="gauge"><i></i></span>
      <b class="count">0</b>
      <span class="keys"><kbd data-i18n="build.keySet"></kbd><kbd data-i18n="build.keyClear"></kbd></span>`;
    host.appendChild(el);
    this.elGauge = el.querySelector('.gauge');
    this.elBar = el.querySelector('.gauge i');
    this.elCount = el.querySelector('.count');
    this.elRoot = el;

    const aim = document.createElement('div');
    aim.className = 'axiom-aim';
    aim.setAttribute('data-i18n', 'build.removePrompt');
    host.appendChild(aim);
    this.elAim = aim;

    const clear = document.createElement('div');
    clear.className = 'axiom-clear';
    clear.setAttribute('data-i18n', 'build.remove');
    clear.addEventListener('pointerdown', (e) => { e.preventDefault(); this._removeReq = true; });
    host.appendChild(clear);
    this.elClear = clear;

    this._i18n();
  }

  _i18n() {
    this.elRoot.querySelectorAll('[data-i18n]').forEach((n) => {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    this.elAim.textContent = t('build.removePrompt');
    this.elClear.textContent = t('build.remove');
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat || this.input?.uiOpen) return;
      if (e.code === 'KeyQ' || e.code === 'Delete' || e.code === 'Backspace') {
        this._removeReq = true;
        e.preventDefault();
      }
      // Reaching for the rack draws the hand even when the piece under that
      // digit is the one already selected — main.js only syncs the slot when it
      // *changes*, so pressing 1 on a fresh save (slot 0) reached nothing at
      // all and the verb stayed locked behind a key that looked like it worked.
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0) this.setSlot(n);
    });
    addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // WHOSE CLICK WAS THAT. This listener is on the window and used to test
      // nothing but `uiOpen`, so every click on a hotbar slot, a language pill
      // or the quest card set a piece down in the world behind it — the exact
      // fall-through that put a wall through the ORDERS card's own button.
      // One question, asked in one place: src/core/input.js.
      if (!this.input?.worldPointer(e)) return;
      if (!this.handOut) return;    // a stowed hand does not even raise a ghost
      this._held = true;
      this.arm();
    });
    addEventListener('wheel', () => {
      if (this.input?.uiOpen) return;
      // Reaching for the wheel is reaching for the lattice.
      this.drawHand();
      this.arm();
    }, { passive: true });
    addEventListener('mouseup', (e) => { if (e.button === 0) this._held = false; });
    addEventListener('blur', () => { this._held = false; });
  }

  setActive(on) {
    this.active = on;
    if (!on) this._held = false;
  }

  /**
   * Raise the hand.
   *
   * The preview is only drawn once the cadet has actually reached for the
   * lattice — a slot, the wheel, the trigger. A ghost hanging in the middle of
   * the frame from the first second of the game is clutter in the one shot that
   * has to sell the place, and it makes the verb feel ambient rather than
   * chosen. It stays up for as long as you keep building and eight seconds
   * after you stop.
   */
  arm() { this._armT = 8; }

  setSlot(i) {
    const n = ((i % KINDS.length) + KINDS.length) % KINDS.length;
    // Reaching for the rack is the deliberate act, and it counts even when the
    // piece reached for is still sealed — the hand came out either way. Every
    // route into this method is a chosen one: a digit key, the wheel, a
    // shoulder button, a tap on the hotbar. None of them happens in passing.
    this.drawHand();
    if (!this.allowed.has(KINDS[n])) return false;
    if (n !== this.slot) this.arm();
    this.slot = n;
    return true;
  }

  /**
   * Draw the lattice hand, for good. Idempotent, and cheap to call from
   * anywhere that counts as the player reaching for the build verb.
   */
  drawHand() {
    if (this.handOut) return false;
    this.handOut = true;
    try { localStorage.setItem(HAND_KEY, '1'); } catch { /* private mode */ }
    this.arm();
    this.hud?.flash(t('build.handOut'), 'good');
    this.onHand?.();
    return true;
  }

  /**
   * A click on a stowed hand. It costs nothing and says what the hand is.
   *
   * One toast, not a line from Marlow: she is mid-sentence for the first half
   * minute of a new save, and a companion who interrupts her own cold open to
   * explain a button the player did not ask about is worse than silence. The
   * controls card is on screen next to this, with the same binding on it.
   */
  _nudge(time) {
    if (time - this._nudgeT < NUDGE_EVERY) return;
    this._nudgeT = time;
    this.hud?.flash(t('build.handStowed'), '');
  }

  /** Open a kind for good. Called by the kit when a line is sealed. */
  allow(kind) { if (KINDS.includes(kind)) this.allowed.add(kind); }

  get kind() { return KINDS[this.slot]; }

  // ---------------------------------------------------------------- aiming
  /**
   * Where the next piece lands.
   *
   * Cell comes from where the cadet faces — one and a half cells ahead, so the
   * piece appears clearly in front of him rather than around his own shoulders,
   * which is what the previous reach of 5.6 m did. Level comes from where he
   * *looks*: the candidate levels are the island, his own boots, the tops of
   * anything already in that cell, and — the one that makes ramp rushing work —
   * the high end of whatever he is currently standing on.
   */
  target() {
    const p = this.player;
    const kind = this.kind;
    const tg = this._tg;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const dist = kind === 'floor' ? 4.6 : 6.2;
    const ax = p.pos.x + fx * dist;
    const az = p.pos.z + fz * dist;
    const pitch = clamp(p.pitch, -1.05, 1.05);
    const aimY = p.pos.y + EYE + Math.tan(pitch) * dist;

    // The cell is always one of the eight around the cadet. Letting the aim
    // ray choose freely put pieces two cells out, which leaves a gap you then
    // walk into — the reason a chain of ramps has to snap to *adjacent* cells
    // in every building game ever shipped.
    const pcx = Math.round(p.pos.x / CELL), pcz = Math.round(p.pos.z / CELL);
    const gx = (pcx + clamp(Math.round(ax / CELL) - pcx, -1, 1)) * CELL;
    const gz = (pcz + clamp(Math.round(az / CELL) - pcz, -1, 1)) * CELL;

    // Candidate levels, in the order a builder actually thinks about them:
    // the island under the cell, the top of whatever he is standing on, and the
    // top of anything already in that cell.
    const cands = this._cands;
    cands.length = 0;
    const ground = this._groundBase(gx, gz);
    if (ground !== null) cands.push(ground);
    const before = cands.length;
    this._standLevels(cands);
    // His own boot level counts only when he is standing on the lattice, or out
    // over open air. Standing on a hillside it is simply the hillside a metre
    // uphill of the cell he is aiming at, and founding there hangs the piece in
    // space — which is how a rushed staircase used to stack a second ramp
    // inside the first and wedge the cadet against his own kerb.
    if (cands.length > before || ground === null) cands.push(p.pos.y);
    this.solids.levelsIn(gx, gz, cands);

    const cost = SPEC[kind].cost;
    let base = cands[0] ?? p.pos.y;
    let bestScore = Infinity;
    let free = false;
    for (const c of cands) {
      // levels well above the eye line are not what you meant
      let s = Math.abs(c - aimY) + (c > aimY + 2.4 ? 7 : 0);
      // and a level with nothing under it is almost never what you meant either
      if (ground !== null && c > ground + 1.4 && !this.solids.supportNear(gx, gz, c)) s += 3.5;
      // a level already filled by the same kind of piece is not a level at all
      const clash = this.solids.overlaps(kind, c, gx, gz);
      if (clash) s += 100;
      if (s < bestScore) { bestScore = s; base = c; free = !clash; }
    }

    tg.kind = kind;
    tg.yaw = snapYaw(p.yaw);
    tg.base = base;
    tg.x = gx; tg.z = gz;
    tg.y = originY(kind, base);
    tg.cost = cost;

    tg.shards = SHARD_COST[kind] || 0;
    if (!free) { tg.valid = false; tg.reason = 'occupied'; return tg; }
    if (this.charge < cost) { tg.valid = false; tg.reason = 'charge'; return tg; }
    if (tg.shards && this.wallet.count() < tg.shards) {
      tg.valid = false; tg.reason = 'shards'; return tg;
    }
    tg.valid = this._founded(gx, gz, base, ground);
    tg.reason = tg.valid ? '' : 'support';
    return tg;
  }

  /**
   * The level a ground-founded piece sits on: the *lowest* island height under
   * its footprint, not the height at its middle.
   *
   * This is not a detail. On any ground that is not perfectly flat, founding on
   * the centre leaves the near edge of a four-metre cell floating half a metre
   * up — and half a metre is above the cadet's step height, so the ramp you
   * just built becomes a kerb you bounce off, and a wall whose foot is above
   * your boots stops registering as ground at all. Founding on the minimum
   * means a piece may bury its far corner in a slope and never floats.
   */
  _groundBase(gx, gz) {
    const c = this.groundAt(gx, gz);
    if (c === null) return null;
    let lo = c;
    for (const [dx, dz] of FOOT) {
      const h = this.groundAt(gx + dx, gz + dz);
      if (h !== null && h < lo) lo = h;
    }
    // …but only a little. Dropping the whole way to the lowest corner on a
    // hillside buries a metre of the ramp and throws away the climb it was
    // built to give you.
    return Math.max(lo, c - 0.62);
  }

  /** The high end of whatever the cadet is standing on, so stairs chain. */
  _standLevels(out) {
    const p = this.player;
    const list = this.solids.at(p.pos.x, p.pos.z);
    if (!list) return;
    for (const q of list) {
      if (q.dead) continue;
      const s = surfaceAt(q, p.pos.x, p.pos.z);
      if (!s || Math.abs(s.top - p.pos.y) > 1.1) continue;
      out.push(q.kind === 'ramp' ? q.y + SPEC.ramp.hi : s.top);
    }
  }

  /** Is there anything for this level to stand on? */
  _founded(gx, gz, base, ground) {
    if (ground !== null && Math.abs(base - ground) < 1.2) return true;
    if (this.solids.supportNear(gx, gz, base)) return true;
    const p = this.player;
    const d = Math.hypot(p.pos.x - gx, p.pos.z - gz);
    // building out from under your own boots: the bridge move
    if (d < 8.8 && Math.abs(p.pos.y - base) < 1.1) return true;
    return false;
  }

  // ---------------------------------------------------------------- placing
  place() {
    this.arm();
    const tg = this.target();
    if (!tg.valid) return { ok: false, reason: tg.reason };
    // A kit piece is bought, not conjured. The charge is spent below; the
    // shards are spent here, and if the ledger refuses, nothing else happens.
    if (tg.shards && !this.wallet.spend(tg.shards, tg.kind)) return { ok: false, reason: 'shards' };
    const g = this._groundBase(tg.x, tg.z);
    const piece = {
      kind: tg.kind, x: tg.x, y: tg.y, z: tg.z, yaw: tg.yaw,
      base: tg.base, onGround: g !== null && Math.abs(tg.base - g) < 1.3,
      grow: 0, fade: 0, sel: 0, want: 0, tone: 0, dead: false,
      id: ++this.placedCount,
    };
    if (!this.lattice.add(piece)) return { ok: false, reason: 'full' };
    this.solids.add(piece);
    this.charge = Math.max(0, this.charge - tg.cost);
    this._chargeHold = 0.18;
    this.man?.onPlaced(piece);
    this._feel(0.05, 0.28, 40);
    return { ok: true, piece, kind: piece.kind };
  }

  remove(piece) {
    if (!piece || piece.dead) return false;
    // Some structure in this world is not the cadet's to unmake: the perches
    // the caches stand on are registered with the same collider so that they are
    // real ground, and clearing one out from under yourself is not a verb.
    if (piece.fixed) { this.hud?.flash(t('build.fixed'), 'bad'); return false; }
    this.arm();
    this.solids.remove(piece);
    this.lattice.kill(piece);
    this.man?.onRemoved(piece);
    this.charge = Math.min(this.maxCharge, this.charge + SPEC[piece.kind].cost * 0.65);
    this._feel(0.035, 0.2, 30);
    return true;
  }

  /** Clear everything — used by the reset hook and by the anchors' fail-safe. */
  clearAll() {
    for (const kind of KINDS) {
      for (const p of [...this.lattice.live[kind]]) if (!p.dead) this.remove(p);
    }
  }

  _feel(shake, rumble, ms) {
    this.player?.cam?.shake?.(shake);
    this.input?.rumble?.(rumble, ms, rumble * 0.6);
  }

  // ---------------------------------------------------------------- frame
  update(dt, time, camera) {
    const inp = this.input;
    const on = this.active && !(inp && inp.uiOpen);

    // charge regenerates on a short leash so a burst of building costs rhythm
    this._chargeHold = Math.max(0, (this._chargeHold || 0) - dt);
    if (!this._chargeHold && this.charge < this.maxCharge) {
      this.charge = Math.min(this.maxCharge, this.charge + this.regen * dt);
    }

    this._armT = Math.max(0, (this._armT || 0) - dt);
    const armed = on && this._armT > 0 && this.handOut;

    let tg = null;
    if (on) {
      tg = this.target();
      this._aim(camera);

      // pad trigger counts as held too, so a controller can rush a ramp
      const pad = inp?.gamepad;
      const padFire = pad ? (pad.buttons[7]?.value ?? 0) > 0.4 : false;
      const held = (this._held || padFire) && !inp?.uiOpen;
      const pressed = !!inp?.fire;

      if (pad) {
        const lb = !!pad.buttons[4]?.pressed;
        if (lb && !this._padPrev[4]) this._removeReq = true;
        this._padPrev[4] = lb;
      }

      if (this._removeReq) {
        this._removeReq = false;
        if (this._aimed) this.remove(this._aimed);
        else this.hud?.flash(t('build.nothingThere'), 'bad');
        this._aimed = null;
      }

      if (padFire) this.arm();
      this._repeat = Math.max(0, this._repeat - dt);
      // The gate. A stowed hand answers a click with a sentence, not a wall.
      if (!this.handOut) {
        if (pressed) this._nudge(time);
        this._held = false;
      } else if (pressed || (held && this._repeat <= 0)) {
        const r = this.place();
        this._repeat = REPEAT;
        if (!r.ok && pressed) {
          this.hud?.flash(t(r.reason === 'charge' ? 'build.noCharge'
            : r.reason === 'shards' ? 'build.noShards'
            : r.reason === 'occupied' ? 'build.alreadyThere' : 'build.denied'), 'bad');
        }
      }
    } else if (this._aimed) {
      this._aimed.want = 0;
      this._aimed = null;
    }

    this.ghostView.visible = armed;
    this.ghostView.update(dt, time, armed ? tg : null, camera);
    this.lattice.update(dt, time);
    this.man?.update(dt, time, camera, this.solids);
    if (this.anchors) {
      const got = this.anchors.update(dt, time, this.player.pos);
      if (got) this.onAnchor?.(this.anchors.secured, this.anchors.total);
    }
    this._paint(on, armed);
  }

  /** Highlight the piece under the crosshair so removal has a subject. */
  _aim(camera) {
    if (this._aimed) { this._aimed.want = 0; this._aimed = null; }
    if (!camera || !this.solids.count) return;
    camera.getWorldDirection(this._ray);
    const hit = this.solids.pick(camera.position, this._ray, 30);
    if (!hit) return;
    this._aimed = hit.piece;
    hit.piece.want = 1;
  }

  _paint(on, armed) {
    const pctv = this.charge / this.maxCharge;
    if (Math.abs(pctv - this._chargeShown) > 0.004) {
      this._chargeShown = pctv;
      this.elBar.style.transform = `scaleX(${pctv.toFixed(3)})`;
      this.elGauge.classList.toggle('low', pctv < SPEC[this.kind].cost / this.maxCharge);
    }
    const n = this.solids.owned;
    if (this._nShown !== n) { this._nShown = n; this.elCount.textContent = String(n); }
    // The charge gauge belongs to a hand that is out. Before that it is a
    // readout for a verb the player has not been given.
    this.elRoot.classList.toggle('show', on && this.handOut);
    this.elRoot.classList.toggle('armed', !!armed);
    this.elAim.classList.toggle('show', !!armed && !!this._aimed);
    this.elClear.classList.toggle('show', !!armed && this.input?.source === 'touch');
  }

  /** Re-render the strings this module owns after a locale switch. */
  relocalise() { this._i18n(); this.man?.relocalise(); }
}

const FOOT = [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8], [0, -1.9], [0, 1.9], [-1.9, 0], [1.9, 0]];

function snapYaw(yaw) {
  return Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
}

export { CELL, KINDS };
