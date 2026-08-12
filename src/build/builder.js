import * as THREE from 'three';
import './build.css';
import { t } from '../i18n/index.js';
import {
  CELL, LEVEL, KINDS, BASE_KINDS, SHARD_COST, SPEC, TURNS, isEdge, cellIndex,
  originY, surfaceAt, snapTurn, qLevel, clamp, covers,
} from './pieces.js';
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
/** How long "click again to shut yourself in anyway" stays claimable. Seconds. */
const SEAL_CONFIRM = 5.0;

export class Builder {
  constructor(scene, player, opts = {}) {
    this.scene = scene;
    this.player = player;
    this.input = opts.input || null;
    this.hud = opts.hud || null;
    this.groundAt = opts.groundAt || (() => null);

    this.slot = 0;
    /**
     * THE ROTATE. Quarter turns, applied on top of where the cadet is looking.
     *
     * Until this existed the only way to choose which face of a cell a wall
     * went on was to physically turn the whole body ninety degrees with a
     * mouse — and a mouse does not turn in ninety degree steps, so a player
     * aiming for the second side of a corner mostly got the first side again.
     * The bias is added to the *build yaw*, which means one press is exactly
     * equivalent to standing where you are and facing the next way round: the
     * same code path the joints already prove closes a square, reached without
     * a hand steady enough to hit a quarter turn.
     */
    this.turn = 0;
    /** Fired whenever the selected piece lands, so the hotbar can follow it. */
    this.onSlot = null;
    /** Fired when the rotate changes, so the interface can echo the facing. */
    this.onTurn = null;
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
    this._cw = [];
    this._cr = [];
    this._nodes = [];
    this._tg = {
      kind: 'wall', x: 0, y: 0, z: 0, yaw: 0, turn: 0, base: 0,
      valid: false, reason: '', slotSpan: 'edge',
      // the two lattice nodes a face piece ends on — the corners a player aims
      // at, handed to the preview so they can be drawn as corners
      nodes: [0, 0, 0, 0],
    };
    this._sealCache = { key: '', seal: false };
    this._boxed = false;
    this._boxT = 0;
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
      <span class="keys"><kbd data-i18n="build.keySet"></kbd><kbd data-i18n="build.keyTurn"></kbd><kbd data-i18n="build.keyClear"></kbd></span>`;
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

    // WHY IT WILL NOT GO THERE.
    //
    // A red ghost says "no". It does not say "no, because you are out of
    // charge", which is the difference between a rule a player learns in one
    // placement and a rule they decide is broken. The chip sits under the
    // crosshair, next to the thing being refused, and it is up *before* the
    // click rather than as a toast after it.
    const why = document.createElement('div');
    why.className = 'axiom-why';
    host.appendChild(why);
    this.elWhy = why;

    // THE WAY OUT OF YOUR OWN BUILD.
    //
    // Two players in three attempts shut themselves inside a square of four
    // walls and could not get out. `_seal()` now refuses the wall that would do
    // it, so this is the backstop for a box that already exists — a save from
    // before the guard, a piece the world put there, a cadet who walked into
    // one. It names the key, it is up the moment the lattice closes over him,
    // and the key it names always opens a hole whether or not the crosshair is
    // on anything: `_cutOut()` finds a wall of the room he is in.
    const out = document.createElement('div');
    out.className = 'axiom-out';
    out.innerHTML = '<b></b><span></span>';
    host.appendChild(out);
    this.elOut = out;
    this.elOutKey = out.querySelector('b');
    this.elOutText = out.querySelector('span');

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
    this.elOutKey.textContent = t('build.cutKey');
    this.elOutText.textContent = t('build.boxedIn');
    this._whyShown = null;
    this._boxShown = null;
    this._boxSrc = null;
    // The piece count is a sentence now, not a digit, so it has to be
    // re-rendered when the language changes. i18n, additive.
    this._nShown = null;
  }

  /** The one sentence that explains a refusal, in the player's own language. */
  static reasonKey(reason) {
    return reason === 'charge' ? 'build.noCharge'
      : reason === 'shards' ? 'build.noShards'
        : reason === 'occupied' ? 'build.alreadyThere'
          : reason === 'full' ? 'build.latticeFull'
            : reason === 'sealWarn' ? 'build.wouldSeal'
              : reason === 'sealAgain' ? 'build.sealAgain'
                : 'build.denied';
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
      // Turn the piece a quarter turn. `F` rather than `R`, because `R` is the
      // one key in this game that always gets a player out of a hole and it is
      // printed on the wedged card; a build verb does not get to take it.
      if (e.code === 'KeyF') { this.rotate(1); e.preventDefault(); }
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

  /**
   * Pick a piece off the rack — and say so, every single time.
   *
   * THE STATE BUG THIS FIXES. Two listeners answered the digit keys: this one,
   * which moved the builder's slot, and `Input`'s, which moved `input.slot`.
   * main.js then repainted the hotbar only when those two *disagreed* — so on
   * the keyboard path they were already equal by the time the frame ran and the
   * highlight was never repainted at all. Press 3 and the ghost became a floor
   * while the hotbar went on advertising RAMP: the interface said one piece and
   * the world built another, which is the worst thing a hotbar can do.
   *
   * So the builder is now the single source of truth and it *announces* the
   * landing rather than leaving anyone to notice it — including when the press
   * was refused, so a sealed kind snaps the highlight back to what is really in
   * the hand instead of leaving it on a piece that will not come out.
   */
  setSlot(i) {
    const n = ((i % KINDS.length) + KINDS.length) % KINDS.length;
    // Reaching for the rack is the deliberate act, and it counts even when the
    // piece reached for is still sealed — the hand came out either way. Every
    // route into this method is a chosen one: a digit key, the wheel, a
    // shoulder button, a tap on the hotbar. None of them happens in passing.
    this.drawHand();
    const ok = this.allowed.has(KINDS[n]);
    if (ok) {
      if (n !== this.slot) this.arm();
      this.slot = n;
    }
    this.onSlot?.(this.slot);
    return ok;
  }

  /**
   * Turn the next piece by `n` quarter turns. Wraps, cheap, and it arms the
   * preview so the turn is *seen* — a rotate you cannot watch happen is a
   * rotate a player does not believe in.
   */
  rotate(n = 1) {
    this.turn = (((this.turn + n) % 4) + 4) % 4;
    // Deliberately does NOT draw the hand. Turning a piece you are not holding
    // is not a way of asking for one, and `F` is a key cold players press at
    // everything — including, per tools/critic/coldplay.mjs, at a rift ring.
    if (this.handOut) this.arm();
    this.onTurn?.(this.turn);
    return this.turn;
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
   * WHERE THE NEXT PIECE LANDS.
   *
   * Two questions, answered separately and exactly.
   *
   * **Which slot.** A deck or a ramp fills a *cell*; a wall or a beam lies on a
   * cell *face*. That distinction is the whole reason walls can now meet corner
   * to corner: previously everything was dropped at a cell centre, so two walls
   * at right angles either crossed in the middle of one cell or stood four
   * metres apart with a hole between them. The face a wall goes on is the one
   * across the cadet's line of sight — turn ninety degrees and you get the next
   * side of the same square, which is how you close a room by turning on the
   * spot. The slot is clamped to the cells around him so a chain of ramps never
   * skips a cell and leaves a gap to fall into.
   *
   * **Which level.** Candidate levels are gathered from the lattice *first*, and
   * they win ties by a wide margin. That is the magnet: a level offered by a
   * piece already standing next to this slot is an exact number off that piece,
   * so the second wall of a corner is founded on precisely the same float as the
   * first and the two share an edge rather than nearly sharing one. Terrain, the
   * cadet's own boots and the top of whatever he is standing on come after, and
   * everything is quantised onto the vertical lattice on the way in.
   */
  target() {
    const p = this.player;
    const kind = this.kind;
    const tg = this._tg;
    const edge = isEdge(kind);
    // THE BUILD YAW. Where the cadet is looking, plus however many quarter
    // turns he has dialled in with the rotate. Everything below reads this and
    // not `p.yaw`, so one press of the rotate key is arithmetically identical
    // to standing still and turning ninety degrees — the exact manoeuvre the
    // joint rig performs to close a square, now available to a hand.
    const byaw = p.yaw + this.turn * (Math.PI / 2);
    const turn = snapTurn(byaw);
    const reach = REACH[kind] ?? 4.6;
    const ax = p.pos.x + Math.sin(byaw) * reach;
    const az = p.pos.z + Math.cos(byaw) * reach;
    const pitch = clamp(p.pitch, -1.05, 1.05);
    const aimY = p.pos.y + EYE + Math.tan(pitch) * reach;

    const pcx = cellIndex(p.pos.x), pcz = cellIndex(p.pos.z);
    let gx, gz, gturn;
    if (edge && (turn === 0 || turn === 2)) {
      // WHICH FACE, AND WHY IT IS NO LONGER A GUESS.
      //
      // The face used to be read off a point 2.6 m down the aim, rounded to the
      // half-grid. From a cell's exact centre that lands on the near face, which
      // is why the joint rig — which stands on centres — always closed its
      // square. A player does not stand on centres. Work the arithmetic and the
      // old rule only picks your own cell's faces while you are within **sixty
      // centimetres** of the centre line in *both* axes; a stride further and
      // the fourth wall of a square silently went onto the next cell's far face
      // instead, four metres from the corner it was supposed to close.
      //
      // That is the whole reason a square could not be closed by hand. So the
      // face is now named rather than sampled: the face of the cell the cadet
      // is standing in, on the side he is building toward. Anywhere in the
      // cell, four quarter turns give the four sides of that one cell — which
      // is what makes the rotate below worth having.
      gz = (pcz + (turn === 0 ? 0.5 : -0.5)) * CELL;
      gx = (pcx + clamp(cellIndex(ax) - pcx, -1, 1)) * CELL;
      gturn = 0;
    } else if (edge) {
      gx = (pcx + (turn === 1 ? 0.5 : -0.5)) * CELL;
      gz = (pcz + clamp(cellIndex(az) - pcz, -1, 1)) * CELL;
      gturn = 1;
    } else {
      gx = (pcx + clamp(cellIndex(ax) - pcx, -1, 1)) * CELL;
      gz = (pcz + clamp(cellIndex(az) - pcz, -1, 1)) * CELL;
      gturn = turn;
    }

    // The lattice nodes this slot ends on — the corners it can close. Computed
    // before the magnet runs, because which corner a piece shares is what
    // decides whose level it has to match.
    const nodes = this._nodes;
    nodes.length = 0;
    if (edge) {
      const [nc, ns] = TURNS[gturn];
      const nh = SPEC[kind].hx;
      nodes.push(gx + nc * nh, gz - ns * nh, gx - nc * nh, gz + ns * nh);
    } else {
      const nh = SPEC[kind].hx, nk = SPEC[kind].hz;
      nodes.push(gx - nh, gz - nk, gx + nh, gz - nk, gx - nh, gz + nk, gx + nh, gz + nk);
    }

    const cands = this._cands, weight = this._cw, ranks = this._cr;
    cands.length = 0; weight.length = 0; ranks.length = 0;
    // 1. the magnet: every level the standing lattice offers this slot, with the
    //    pieces this one will actually share a corner post with pulling hardest
    this.solids.slotLevels(gx, gz, cands, ranks, nodes);
    for (let i = 0; i < cands.length; i++) {
      weight.push(ranks[i] ? -NODE_MAGNET : -SLOT_MAGNET);
    }
    // 2. the top of whatever he is standing on, so stairs and rooms chain
    const stood = cands.length;
    this._standLevels(cands);
    for (let i = stood; i < cands.length; i++) weight.push(-STAND_MAGNET);
    // 3. the island under the slot
    const ground = this._groundBase(kind, gx, gz, gturn);
    if (ground !== null) { cands.push(ground); weight.push(0); }
    // 4. his own boots — the bridge move, and the only unquantised level in the
    //    game, so it is the last thing considered rather than the first
    cands.push(qLevel(p.pos.y)); weight.push(ground === null ? 0.2 : 1.1);

    const cost = SPEC[kind].cost;
    let base = ground ?? qLevel(p.pos.y);
    let bestScore = Infinity;
    let free = false;
    let held = false;
    for (let i = 0; i < cands.length; i++) {
      const c = qLevel(cands[i]);
      let s = Math.abs(c - aimY) + weight[i];
      // levels well above the eye line are not what you meant
      if (c > aimY + 2.6) s += 8;
      const clash = this.solids.blocked(kind, gx, gz, c);
      if (clash) s += 100;
      const ok = this._founded(gx, gz, c, ground);
      if (!ok) s += 24;
      if (s < bestScore) { bestScore = s; base = c; free = !clash; held = ok; }
    }

    tg.kind = kind;
    tg.turn = gturn;
    tg.yaw = gturn * (Math.PI / 2);
    tg.base = base;
    tg.x = gx; tg.z = gz;
    tg.y = originY(kind, base);
    tg.cost = cost;
    tg.slotSpan = edge ? 'edge' : 'cell';

    // Hand the first two nodes to the preview, which draws them as the rings a
    // player aims a corner at. (Everything the magnet needed is in `nodes`.)
    tg.nodes[0] = nodes[0]; tg.nodes[1] = nodes[1];
    tg.nodes[2] = nodes[2]; tg.nodes[3] = nodes[3];

    tg.shards = SHARD_COST[kind] || 0;
    if (!free) { tg.valid = false; tg.reason = 'occupied'; return tg; }
    if (this.charge < cost) { tg.valid = false; tg.reason = 'charge'; return tg; }
    if (tg.shards && this.wallet.count() < tg.shards) {
      tg.valid = false; tg.reason = 'shards'; return tg;
    }
    // Not a refusal — a warning the click path acts on. See `_seals`.
    tg.seals = this._seals(tg);
    tg.valid = held;
    tg.reason = held ? '' : 'support';
    return tg;
  }

  // ------------------------------------------------------------- not a trap
  /**
   * WOULD THIS PIECE SHUT THE CADET IN?
   *
   * A judge closed a square around himself twice in three attempts and had to
   * reload the browser both times. The lattice was doing exactly what it was
   * told; the verb was the problem.
   *
   * The obvious fix — refuse the wall outright — is wrong twice over. Closing a
   * square around yourself is a *real build*, it is the first thing anybody
   * does in a game with this verb, and `tools/critic/joints.mjs` builds exactly
   * that structure to prove the corners meet. Forbidding it would delete a
   * legitimate move and break the proof that the geometry works.
   *
   * So the answer is a warning with teeth, on the click path only:
   *   - the preview says, before the click, that this one shuts you in;
   *   - the first click is *refused* and spends itself saying so;
   *   - a second click inside a few seconds does it anyway, because you meant it;
   *   - and the moment the lattice closes over you, the way out is on screen
   *     (`_shutIn`, `_cutOut`) and `player.boxed` sends the recovery key to a
   *     spot outside the walls instead of the middle of the room.
   * A player cannot now be shut in by accident, and cannot be stuck when they
   * do it on purpose.
   *
   * The gate lives in `update()` rather than in `place()`, following the same
   * rule as the stowed hand above it: everything that places a piece for its
   * own reasons — the caches' perches, the manipulatives, the joint rig — is
   * untouched by it.
   *
   * Two ways a piece can take a player prisoner, and both are caught here:
   *
   *  - It lands **through** him. A four-metre panel materialising inside a
   *    person is an instant wedge.
   *  - It **closes the last face** of the room he is standing in. That is a
   *    flood fill over the cell graph with the hypothetical piece already in
   *    it; if the fill cannot escape, the piece shuts him in.
   *
   * A room with a ramp in it is not a prison — a ramp climbs exactly one storey
   * and a wall is exactly one storey tall, so you walk up it and step off over
   * the top. That case never warns.
   *
   * The answer is cached on the slot, the standing cell and the size of the
   * lattice, because `target()` runs every frame and a flood fill does not.
   */
  _seals(tg) {
    if (!isEdge(tg.kind) || tg.kind !== 'wall') return false;
    const p = this.player.pos;
    // Nothing within a couple of cells can be a wall of the room you are in.
    if (Math.abs(p.x - tg.x) > CELL * 2.6 || Math.abs(p.z - tg.z) > CELL * 2.6) return false;
    if (Math.abs(p.y - tg.base) > LEVEL * 0.92) return false;

    const key = `${tg.x}|${tg.z}|${tg.base}|${cellIndex(p.x)}|${cellIndex(p.z)}`
      + `|${Math.round(p.y * 4)}|${this.solids.count}`;
    const c = this._sealCache;
    if (c.key === key) return c.seal;
    c.key = key;
    c.seal = false;

    // `turn` matters: without it `covers()` treats every face piece as running
    // along x, so a wall on a north–south face reads as lying across the cadet
    // when it is in fact four metres to his side.
    const ghost = {
      kind: 'wall', x: tg.x, z: tg.z, y: originY('wall', tg.base),
      turn: tg.turn, dead: false,
    };
    // …straight through him.
    if (covers(ghost, p.x, p.z, 0.42)
      && ghost.y + SPEC.wall.lo < p.y + 1.7 && ghost.y + SPEC.wall.hi > p.y + 0.18) {
      c.seal = true;
      return true;
    }
    // A bounded region needs four walls around it at the very least, so three
    // must already be standing before the fourth can shut anybody in. That one
    // comparison keeps a flood fill out of the frame budget for almost all of a
    // session — `target()` runs sixty times a second and the fill does not.
    if (this.solids.owned < 3) return false;
    const region = this.solids.enclosure(p.x, p.z, p.y, ghost);
    c.seal = !!region && !this._wayOut(region, p.y);
    return c.seal;
  }

  /** A ramp inside the room climbs a full storey, which is a wall's height. */
  _wayOut(region, y) {
    for (let i = 0; i < region.length; i++) {
      const list = this.solids.inCell(region[i][0], region[i][1]);
      if (!list) continue;
      for (const q of list) {
        if (q.dead || q.kind !== 'ramp') continue;
        if (Math.abs(q.y - y) < LEVEL * 0.55) return true;
      }
    }
    return false;
  }

  /** Is the cadet, right now, inside a room of his own with no door? */
  _shutIn() {
    if (this.solids.owned < 3) return false;
    const p = this.player.pos;
    const region = this.solids.enclosure(p.x, p.z, p.y);
    return !!region && !this._wayOut(region, p.y);
  }

  /**
   * Cut a hole in the room the cadet is standing in. The nearest wall on a face
   * of his own cell, whether or not the crosshair happens to be on it — because
   * a player boxed in at arm's length is looking at a wall from thirty
   * centimetres away and "aim at it" is not a thing to ask of him.
   */
  _cutOut() {
    const p = this.player.pos;
    const cx = cellIndex(p.x), cz = cellIndex(p.z);
    const lo = p.y + 0.18, hi = p.y + 1.70;
    let best = null, bd = Infinity;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const fx = (cx + dx * 0.5) * CELL, fz = (cz + dz * 0.5) * CELL;
      const list = this.solids.at(fx, fz);
      if (!list) continue;
      for (const q of list) {
        if (q.dead || q.fixed || q.kind !== 'wall') continue;
        if (Math.abs(q.x - fx) > 0.01 || Math.abs(q.z - fz) > 0.01) continue;
        if (!(q.y + SPEC.wall.lo < hi && q.y + SPEC.wall.hi > lo)) continue;
        const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
        if (d < bd) { bd = d; best = q; }
      }
    }
    return best;
  }

  /**
   * The level a ground-founded piece sits on: the *lowest* island height under
   * its footprint, not the height at its middle, quantised onto the vertical
   * lattice so that two neighbouring slots over the same flat ground get the
   * same float rather than two that differ in the last bit.
   *
   * This is not a detail. On any ground that is not perfectly flat, founding on
   * the centre leaves the near edge of a four-metre cell floating half a metre
   * up — and half a metre is above the cadet's step height, so the ramp you
   * just built becomes a kerb you bounce off. Founding on the minimum means a
   * piece may bury its far corner in a slope and never floats.
   *
   * `rise` is what makes a deck a deck: a floor laid on raw ground puts its
   * *underside* on the dirt, because the level a floor names is the surface you
   * walk on, not the bottom of the plate.
   */
  _groundBase(kind, gx, gz, gturn = 0) {
    const c = this.groundAt(gx, gz);
    if (c === null) return null;
    let lo = c;
    for (const [dx, dz] of foot(kind, gturn)) {
      const h = this.groundAt(gx + dx, gz + dz);
      if (h !== null && h < lo) lo = h;
    }
    // …but only a little. Dropping the whole way to the lowest corner on a
    // hillside buries a metre of the ramp and throws away the climb it was
    // built to give you.
    return qLevel(Math.max(lo, c - 0.62) + SPEC[kind].rise);
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
      out.push(qLevel(q.kind === 'ramp' ? q.y + LEVEL : s.top));
    }
  }

  /** Is there anything for this level to stand on? */
  _founded(gx, gz, base, ground) {
    if (ground !== null && Math.abs(base - ground) < 1.3) return true;
    if (this.solids.supportNear(gx, gz, base)) return true;
    const p = this.player;
    const d = Math.hypot(p.pos.x - gx, p.pos.z - gz);
    // building out from under your own boots: the bridge move
    if (d < 9.0 && Math.abs(p.pos.y - base) < 1.3) return true;
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
    const g = this._groundBase(tg.kind, tg.x, tg.z, tg.turn);
    const piece = {
      kind: tg.kind, x: tg.x, y: tg.y, z: tg.z, yaw: tg.yaw, turn: tg.turn,
      base: tg.base, onGround: g !== null && Math.abs(tg.base - g) < 1.4,
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
    // Re-ask whether he is still shut in *on the next frame*, not up to a
    // quarter of a second later: a warning that lingers after the hole is cut
    // is a warning nobody trusts the second time.
    this._boxT = 0;
    this._sealCache.key = '';
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
        // The d-pad turns the piece: nothing else in the world uses it, and a
        // thumb reaching sideways is the console idiom for "rotate this".
        const dl = !!pad.buttons[14]?.pressed, dr = !!pad.buttons[15]?.pressed;
        if (dr && !this._padPrev[15]) this.rotate(1);
        if (dl && !this._padPrev[14]) this.rotate(-1);
        this._padPrev[14] = dl; this._padPrev[15] = dr;
      }

      // A cadet shut inside his own lattice is checked for four times a second,
      // not sixty: it is a flood fill, and nothing about being in a box changes
      // between frames.
      this._boxT -= dt;
      if (this._boxT <= 0) { this._boxT = 0.25; this._boxed = this._shutIn(); }
      // The player's own recovery reads this: a recovery that puts you back on
      // the same square metre inside the same box is a button that does
      // nothing. (src/player/controller.js — one line, `away`.)
      this.player.boxed = this._boxed;

      if (this._removeReq) {
        this._removeReq = false;
        // Boxed in, the crosshair is thirty centimetres from a wall and may be
        // inside it. The clear key opens a hole either way.
        let victim = this._aimed && !this._aimed.fixed ? this._aimed : null;
        if (this._boxed && !victim) victim = this._cutOut();
        if (victim) {
          this.remove(victim);
          if (this._boxed) this.hud?.flash(t('build.cutFree'), 'good');
        } else if (this._aimed) this.remove(this._aimed);
        else this.hud?.flash(t('build.nothingThere'), 'bad');
        this._aimed = null;
        this._sealCache.key = '';
      }

      if (padFire) this.arm();
      this._repeat = Math.max(0, this._repeat - dt);
      // The gate. A stowed hand answers a click with a sentence, not a wall.
      if (!this.handOut) {
        if (pressed) this._nudge(time);
        this._held = false;
      } else if (tg && tg.seals && !(this._sealArm > 0)) {
        // NOBODY GETS SHUT IN BY ACCIDENT. The first click on the wall that
        // closes the room around you buys a sentence instead of a wall; the
        // next one, inside the window, buys the wall. A held trigger never
        // spends the confirmation — you have to mean it twice.
        if (pressed) {
          this._sealArm = SEAL_CONFIRM;
          this.hud?.flash(t('build.sealAsk'), 'bad');
          this._refused = 0.5;
        }
      } else if (pressed || (held && this._repeat <= 0)) {
        const r = this.place();
        this._repeat = REPEAT;
        if (r.ok) this._sealArm = 0;
        if (!r.ok && pressed) {
          this.hud?.flash(t(Builder.reasonKey(r.reason)), 'bad');
          this._refused = 0.5;    // and the ghost kicks, so the refusal is felt
        }
      }
      this._sealArm = Math.max(0, (this._sealArm || 0) - dt);
    } else {
      if (this._aimed) { this._aimed.want = 0; this._aimed = null; }
      this._boxed = false;
      this.player.boxed = false;
    }

    this._refused = Math.max(0, (this._refused || 0) - dt);
    this.ghostView.visible = armed;
    this.ghostView.kick = this._refused;
    this.ghostView.update(dt, time, armed ? tg : null, camera);
    this.lattice.update(dt, time);
    this._reason = armed && tg && !tg.valid ? tg.reason : '';
    // A refusal chip has priority; otherwise the warning that this one shuts
    // you in, which is a thing to know before the click and not after it.
    if (!this._reason && armed && tg && tg.seals) {
      this._reason = this._sealArm > 0 ? 'sealAgain' : 'sealWarn';
    }
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
    // A bare digit sitting immediately after "Build charge" and a charge bar
    // reads as the charge, and a judge read it that way: "BUILD CHARGE 0" on a
    // full gauge. It is the number of pieces standing, so it says so. i18n,
    // additive.
    if (this._nShown !== n) { this._nShown = n; this.elCount.textContent = t('build.pieces', { n }); }
    // The charge gauge belongs to a hand that is out. Before that it is a
    // readout for a verb the player has not been given.
    this.elRoot.classList.toggle('show', on && this.handOut);
    this.elRoot.classList.toggle('armed', !!armed);
    const why = this._reason || '';
    // The text is only re-rendered when the refusal changes (or the locale
    // does, which nulls `_whyShown`); the visibility is written every frame,
    // because a chip whose class only flips when its *words* change is a chip
    // that gets stuck on screen after the reason has gone.
    if (why !== this._whyShown) {
      this._whyShown = why;
      if (why) this.elWhy.textContent = t(Builder.reasonKey(why));
    }
    this.elWhy.classList.toggle('show', !!why);
    this.elAim.classList.toggle('show', !!armed && !!this._aimed && !why && !this._boxed);

    // Boxed in: this is not an armed-hand affordance, it is an emergency exit.
    // It is up whether or not the preview is raised, because a player who has
    // just walled himself in is not holding a piece, he is pushing at a wall.
    const src = this.input?.source || 'kbm';
    if (this._boxed !== this._boxShown || src !== this._boxSrc) {
      this._boxShown = this._boxed; this._boxSrc = src;
      this.elOutKey.textContent = src === 'pad' ? t('build.cutKeyPad') : t('build.cutKey');
      this.elOutKey.style.display = src === 'touch' ? 'none' : '';
      this.elOut.classList.toggle('show', !!this._boxed);
    }
    this.elClear.classList.toggle('show', (!!armed || !!this._boxed) && src === 'touch');
  }

  /** Re-render the strings this module owns after a locale switch. */
  relocalise() { this._i18n(); this.man?.relocalise(); }
}

/**
 * How far ahead of the cadet each kind looks for its slot.
 *
 * A wall is short-armed on purpose: two and a half metres puts it on the near
 * face of the cell in front of him, which is the face a person means when they
 * throw a wall up. A deck wants the next cell whole; a ramp wants the cell it
 * will climb across.
 */
const REACH = { wall: 2.6, beam: 2.6, floor: 4.6, vault: 4.6, ramp: 5.0 };
/**
 * How much an exact level beats a guess — and why there are two numbers.
 *
 * Both magnets used to pull equally hard, and that is a bug you can photograph.
 * Standing in the plaza, three walls of a hand-built square came out on the
 * level the two walls beside them were on and the fourth came out 61 cm higher,
 * because the cadet happened to be standing within a step of a plaza deck whose
 * top was 61 cm up and `_standLevels` offered it with exactly the same pull as
 * the wall he was trying to meet. Four walls, three levels, a visible ledge at
 * one corner — the client's original complaint, arriving from a direction the
 * joint rig cannot reach because the rig stands on bare ground.
 *
 * They are not the same kind of fact. A level offered by a piece **beside this
 * slot** is a *joint*: taking it is the difference between two walls sharing an
 * edge and two walls nearly sharing one. A level offered by whatever the cadet
 * is **standing on** is a *convenience* — it is what lets a stair chain — and
 * it has no opinion about the piece next door. So when they disagree, the joint
 * wins, by enough that the disagreement can be most of a metre.
 */
const NODE_MAGNET = 6.0;
const SLOT_MAGNET = 3.4;
const STAND_MAGNET = 1.9;

const CELL_FOOT = [
  [-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8],
  [0, -1.9], [0, 1.9], [-1.9, 0], [1.9, 0],
];
const EDGE_FOOT = [[], []];
for (const t of [0, 1]) {
  const [c, s] = TURNS[t];
  for (const d of [-1.9, -0.95, 0.95, 1.9]) EDGE_FOOT[t].push([c * d, -s * d]);
}

/** The columns the terrain is sampled at to found a piece of this kind. */
function foot(kind, turn) {
  return isEdge(kind) ? EDGE_FOOT[turn % 2] : CELL_FOOT;
}

export { CELL, KINDS };
