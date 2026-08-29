/**
 * The audio director.
 *
 * Everything in this directory is deaf on its own. This is the file that
 * listens to the game — where the cadet is standing, how fast, how high, how
 * much of the lattice is true, which tear is nearest and whether its statement
 * holds — and turns that into the numbers the score, the ambience and the rift
 * hum are each asking for.
 *
 * It reads the running game and never asks the running game to tell it
 * anything. The only wiring the rest of the project owes it is a tick and the
 * four learning events that have no observable side effect: a right answer, a
 * wrong one, a rift opening and a rift closing. Everything else — footsteps,
 * landings, the wing, building, mastery, region, altitude, proximity, and now
 * every ceremony the session and the arc put on the glass — is observed. That
 * is deliberate: a system that has to be told about every event is a system
 * that goes quiet the moment somebody else refactors.
 *
 * THE LEARNING EVENTS ARE THE ONES THAT MATTER, and for a long time this file
 * threw most of them away. `answered()` is handed the mastery engine's entire
 * report — `checkEvent`, `check.done`, `check.need`, `justMastered`,
 * `justWithdrawn`, `served`, `durable` — and it read two fields of it, so a
 * proving run opening, a proving run absorbing a miss, a proving run
 * collapsing, and a claim being withdrawn all sounded like an ordinary right or
 * wrong answer. `_answered` below is that report routed properly; the sounds
 * themselves are in `stings.js` and the reasoning for each is written there.
 *
 * Autoplay policy is obeyed at the only level that actually works: there is no
 * AudioContext at all until a real gesture arrives, so nothing is ever
 * scheduled against a clock that is not running.
 */

import * as THREE from 'three';
import { Bus } from './bus.js';
import { Score } from './music.js';
import { Ambience } from './ambience.js';
import { Footsteps } from './footsteps.js';
import { RiftHum } from './rifthum.js';
import { Stings } from './stings.js';
import { Beats } from './beats.js';
import { SoundControl } from './control.js';
import { PLACES } from './theory.js';
import { clamp, warmers } from './dsp.js';
import { dominantZone, zoneWeights } from '../world/biomes.js';
import {
  heightAt, slopeAt, pathAt, moistAt, underWater, SNOW_Y, LAKE,
} from '../world/terrain.js';

const SPRINT = 11.8;   // matches player/locomotion P.sprint; only used to normalise

/** Eight bearings at twenty-two metres, as flat pairs so nothing is allocated. */
const RING = (() => {
  const r = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    r.push(Math.cos(a) * 22, Math.sin(a) * 22);
  }
  return r;
})();

export class AudioDirector {
  constructor(root) {
    this._root = root;
    this.bus = new Bus();
    this.control = new SoundControl(root, this.bus);
    this.control.onFirstGesture = () => this._wake();
    this.built = false;
    this.refs = null;

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._to = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._w = null;
    this._surface = 'grass';
    this._sampleAt = new THREE.Vector3(1e9, 0, 0);
    this._nearD = new Float64Array(3);
    this._nearI = new Int32Array(3);
    this._counts = { solids: 0, anchors: 0 };
    this._focus = 0;
    this._muffle = 0;
    // The continuous half of this director — wind balance, bed crossfades,
    // three rift voices, the reverb sends — is a set of `setTargetAtTime`
    // calls, and a target is a *destination*, not a sample: re-issuing it at
    // 140 Hz produces exactly the same audio as issuing it at 30 and costs
    // four times the automation-timeline churn. Events (footsteps, landings,
    // the wing) stay on the frame, where they belong.
    this._slow = 0;
    this._slowDt = 0;
    // Preallocated, because this ran every frame and handed the collector
    // three fresh objects and an array each time.
    this._humArgs = [0, 1, 2].map(() => ({
      d: 0, pan: 0, mastered: false, locked: false, tension: 1, focus: false,
    }));
    this._humList = [];
    this._breath = 0;
    this._inRange = false;
    this._warm = null;

    // Autoplay: the context is created inside the gesture handler and not one
    // instruction earlier.
    const wake = () => this._wake();
    this._wakeFn = wake;
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      addEventListener(ev, wake, { capture: true, passive: true });
    }

    // A mute key, because reaching for a button with the pointer locked is not
    // a thing anyone should have to do.
    addEventListener('keydown', (e) => {
      if (e.code !== 'KeyM' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      if (this.bus.ready) this.bus.toggle();
      else this._wake();
    });
  }

  _wake() {
    if (this._woke) return;
    this._woke = true;
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      removeEventListener(ev, this._wakeFn, { capture: true });
    }
    try { this.bus.start(); } catch { /* no audio on this device */ }
    this.control._label();
  }

  /** Build the persistent graph. Only once, and only when there is a point. */
  _build() {
    if (this.built || !this.bus.live) return;
    const A = this.bus;
    try {
      this.score = new Score(A);
      this.amb = new Ambience(A);
      this.feet = new Footsteps(A);
      this.hum = new RiftHum(A);
      this.sting = new Stings(A);
      this.beats = new Beats(this._root, this.sting);
      this.built = true;
      this.sting.wake();
      // Every noise colour and every string this game uses, generated once and
      // one per frame, starting now — so the first footstep on scree is not
      // also the frame that synthesises four seconds of white noise.
      this._warm = warmers(A.ctx);
    } catch (err) {
      // A device without a working audio graph gets a silent game, not a
      // broken one.
      this.built = false;
      this.disabled = true;
    }
  }

  /**
   * Wire into the running game. Everything here is either a read-only handle
   * or a wrapper that calls through to whatever was there before — nothing in
   * another team's file is replaced.
   */
  attach(refs) {
    this.refs = refs;
    const { player, hud, builder, uiRoot } = refs;

    // Footsteps come off the animator's own contact event, so a boot sounds
    // when the boot lands and not on a timer that drifts against the stride.
    if (player?.anim) {
      const prev = player.anim.onStep;
      player.anim.onStep = (foot, power) => {
        prev?.(foot, power);
        this._step(foot, power);
      };
    }

    // Marlow speaking gets a comms blip and a small dip in the score, the way
    // a radio call does in any film where somebody is flying something.
    if (hud) {
      const say = hud.say.bind(hud);
      hud.say = (text, ms) => { this._comms(); return say(text, ms); };
    }

    this._counts.solids = builder?.solids?.count ?? 0;
    this._counts.anchors = builder?.anchors?.secured ?? 0;

    /*
     * THE LEARNING SURFACE, AND WHAT EACH PRESS ON IT MEANS.
     *
     * This used to be one selector — `button, .ans, .slot, .tile, .bay` — and
     * one sound: `commit()`, the two-note rising figure that means *I am
     * handing this in*. So picking an option played it, moving a tile played
     * it, typing a digit played it, and calling up the worked echo played it.
     * Asking for help and finishing an answer were the same sound, and a sound
     * that means four things means nothing.
     *
     * Three sounds now, and the boundaries are drawn where the meaning changes
     * rather than where the markup happens to:
     *
     *   COMMIT   the two elements that genuinely hand an answer over — the
     *            keypad's SET key (`.rf-key.commit`, published as `data-g="seal"`
     *            by src/ui/rift.js) and a choice option, which submits on the
     *            press. Nothing else.
     *   TICK     a glyph going into the socket. Already the keyboard's sound;
     *            now the glass makes it too.
     *   PICK     a thing chosen but not yet handed in — a tile into a bay, a
     *            slot on the area model, a beam pan, an ordinary button
     *            anywhere in the interface. One soft tick, no interval, no
     *            direction: it means "registered", and nothing else.
     *
     * And the echo's own controls are deliberately in NONE of them — `#rf-hint`
     * and the strata rail (`.rf-stratum`) both dig a layer, and the LAYER is
     * what makes the sound (`_watchEcho`), so that a layer opened by the rig —
     * which happens on a slip, without anybody pressing anything — sounds the
     * same as one the learner asked for. A stratum that is merely being re-read
     * rather than newly cut makes no sound at all, which is right: nothing has
     * been opened.
     */
    if (uiRoot) {
      uiRoot.addEventListener('pointerdown', (e) => {
        if (!this.built || !this.bus.live) return;
        const el = e.target.closest?.('button, .ans, .slot, .tile, .bay');
        if (!el) return;
        if (el.closest('#rf-hint, .rf-stratum, .rf-strata-bar, .sound')) return;
        if (el.matches('.ans') || el.matches('.rf-key.commit') || el.closest('.rf-key.commit')) {
          this.sting.commit();
        } else if (el.matches('.rf-key') || el.closest('.rf-key')) {
          this.sting.tick();
        } else {
          this.sting.pick();
        }
      }, { passive: true });
    }
    addEventListener('keydown', (e) => {
      if (!this.built || !refs.panel?.open) return;
      if (e.key === 'Enter') this.sting.commit();
      else if (e.key.length === 1 || e.key === 'Backspace') this.sting.tick();
    }, { passive: true });
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    if (this.disabled) return;
    // A gamepad press fires no pointer, key or touch event, so a player on a
    // controller would sit in silence forever waiting for a gesture they have
    // no way to make. Whether the browser then honours the resume is the
    // browser's business; ours is to ask.
    if (!this._woke && this.refs?.input?.source === 'pad') this._wake();
    const A = this.bus;
    if (!A.ready) return;
    if (!this.built) { this._build(); if (!this.built) return; }
    if (!A.live) return;

    const R = this.refs;
    if (!R) return;
    const p = R.player.pos;
    const L = R.player.loco;
    const open = !!R.panel?.open;

    // --- where we are, sampled lazily -------------------------------------
    // The region field is a couple of octaves of noise per call; a cadet who
    // has not moved a metre does not need it recomputed at 120 Hz.
    if (this._sampleAt.distanceToSquared(p) > 2.2 || !this._w) {
      this._sampleAt.copy(p);
      this._w = zoneWeights(p.x, p.z).slice();
      this._surface = this._surfaceAt(p.x, p.z, p.y);
      const r = Math.hypot(p.x, p.z);
      const z = dominantZone(p.x, p.z);
      // The plaza is its own place: inside thirty metres of the middle the
      // score plays the game's home key regardless of which biome bleeds in.
      this._place = r < 32 ? 'home' : z.id;
      this._water = clamp(1 - (Math.hypot(p.x - LAKE.x, p.z - LAKE.z) - LAKE.r) / 26, 0, 1);
      const was = this._expose;
      this._expose = this._exposureAt(p.x, p.z);

      /*
       * THE SCORE ARRIVES ON A CREST.
       *
       * The brief this build is measured against names one thing about the
       * reference soundtrack above all others: the music ARRIVES on discovery
       * rather than looping underneath. This score already knows how to arrive
       * — `Score.arrival` is what a region change sets, and it forces a full
       * phrase and lets the theme play — and until now the only thing that
       * could set it was crossing an ecotone.
       *
       * Cresting something is the other discovery this island has, and the
       * number for it is already being computed for the wind: `_exposureAt` is
       * eight height probes on a twenty-two metre ring, and it goes from about
       * a third in a hollow to nearly one on a ridge line with the land gone on
       * every side. Walking over the top of a rise moves it by a lot in a few
       * metres. Nothing has to be hand-placed and a piece of terrain that
       * changes shape changes where the music arrives for free.
       *
       * Hysteresis and a cooldown, because a cadet jogging along a ridge crosses
       * a threshold a dozen times and a score that arrived every time would be
       * a score that never arrives.
       */
      this._crestT = Math.max(0, (this._crestT || 0) - 1);
      if (was !== undefined && this.score && !this._crestT
        && was < 0.52 && this._expose > 0.76) {
        this._crestT = 40;              // ~60 m of walking before another one
        this.score.arrival = Math.max(this.score.arrival, 2);
      }
    }

    const ground = heightAt(p.x, p.z);
    const agl = ground === null ? 60 : p.y - ground;
    const alt = clamp(agl / 110, 0, 1) * 0.75 + clamp((p.y - 30) / 190, 0, 1) * 0.25;
    const speed = clamp(L.speed / SPRINT, 0, 1);
    const glide = L.gliding ? clamp((L.glideSpeed - 7) / 26, 0, 1) : 0;
    // Falling is not gliding, and it should not sound like it. Under an open
    // wing the air is an edge tone you can steer; in a free fall it is a
    // broadband roar that arrives fast and stops the instant the ground does.
    const fall = L.grounded ? 0 : clamp((-R.player.vel.y - 9) / 30, 0, 1);

    this._focus += ((open ? 1 : 0) - this._focus) * (1 - Math.exp(-6 * dt));
    this._muffle = this._focus;

    // --- score -------------------------------------------------------------
    const s = this.score;
    s.setPlace(this._place || 'home');
    s.setMastery(R.mastery.softIntegrity ? R.mastery.softIntegrity() : R.mastery.integrity());
    // …and the half a learner can actually hear change inside one sitting.
    s.setLine(this._standing(R, dt));
    s.travel = clamp(Math.max(speed * 0.85, glide, L.dashT > 0 ? 1 : 0), 0, 1);
    s.alt = alt;
    s.focus = this._focus;
    // The break beat takes the score down to the root and the island. It is
    // read off the surface rather than announced, like everything else here.
    const hush = this.beats?.resting ? 1 : 0;
    s.hush += (hush - s.hush) * (1 - Math.exp(-3 * dt));
    s.update(dt);

    // --- the continuous half, at thirty hertz -------------------------------
    this._slow += dt;
    this._slowDt += dt;
    if (this._slow >= 0.033) {
      const sdt = this._slowDt;
      this._slow = 0; this._slowDt = 0;

      // Inside a rift the world is still there, it is just in the next room.
      const tone = 980 + (1 - this._focus) * 15000;
      A.musicTone.frequency.setTargetAtTime(tone, A.t, 0.25);
      A.hallOut.gain.setTargetAtTime(0.55 + alt * 0.65, A.t, 0.8);

      // A card that owns the whole frame puts the world in the next room, the
      // same way an open rift does — but NOT the break beat, whose entire
      // premise is that the island is still there and still moving. That one
      // takes the score down (`hush`) and leaves the wind alone.
      const ceremony = this.beats && this.beats.holding && !this.beats.resting ? 0.55 : 0;
      this.amb.update(sdt, {
        weights: this._w, alt, speed, glide, fall,
        water: this._water || 0, indoors: Math.max(this._focus, ceremony),
        expose: this._expose ?? 0.5,
      });
      this._riftHum(sdt, p, R, open);

      // The ceremonies. Five class names on five surfaces, read; see beats.js
      // for why this is an observer and not six new hooks in five modules.
      if (this.beats) {
        this.beats.place = this._place || 'home';
        this.beats.update(sdt);
      }
      // The worked echo, cut open a layer at a time. `panel.echoTier` is the
      // depth the learning surface has dug to, and it only ever climbs while a
      // card is up — so watching it needs nothing from src/ui at all.
      this._watchEcho(R);

      // One buffer per slow tick until the table is full. Each is a few
      // milliseconds of arithmetic and there are six of them.
      if (this._warm && this._warm.length) this._warm.shift()();
    }

    // --- locomotion events -------------------------------------------------
    if (!open) {
      this._moves(dt, L, speed);
      this._breathing(dt, L, speed);
    }

    // --- the build verb ----------------------------------------------------
    const solids = R.builder?.solids?.count ?? 0;
    if (solids !== this._counts.solids) {
      if (solids > this._counts.solids) this.sting.place(R.builder.slot || 0);
      else this.sting.unplace();
      this._counts.solids = solids;
    }
    const anch = R.builder?.anchors?.secured ?? 0;
    if (anch > this._counts.anchors) { this._counts.anchors = anch; this.sting.anchor(); }
  }

  // ------------------------------------------------------------------ pieces
  /**
   * The three nearest tears, with a stereo position and a measure of how far
   * their statement is from being true. `tension` is the actual posterior the
   * mastery engine holds, which is why a rift you have nearly cracked already
   * sounds calmer than one you have not touched.
   */
  _riftHum(dt, p, R, open) {
    const cam = R.camera;
    cam.getWorldDirection(this._fwd);
    this._right.crossVectors(this._fwd, this._up).normalize();

    // Nearest three, by insertion into two preallocated numeric arrays rather
    // than by building and sorting a fresh array of wrapper objects thirty
    // times a second for the collector to take away again. Three is small
    // enough that insertion is also the fastest way to do it.
    const list = R.rifts?.list || [];
    const nd = this._nearD, ni = this._nearI;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const q = list[i].pos;
      const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      if (d > 92 || (n === 3 && d >= nd[2])) continue;
      let k = n < 3 ? n : 2;
      while (k > 0 && nd[k - 1] > d) { nd[k] = nd[k - 1]; ni[k] = ni[k - 1]; k--; }
      nd[k] = d; ni[k] = i;
      if (n < 3) n++;
    }

    const out = this._humList;
    out.length = 0;
    for (let i = 0; i < n; i++) {
      const r = list[ni[i]], d = nd[i];
      this._to.set(r.pos.x - p.x, 0, r.pos.z - p.z);
      const len = this._to.length() || 1;
      this._to.multiplyScalar(1 / len);
      const pL = R.mastery.state?.get(r.id)?.pL ?? 0;
      const o = this._humArgs[i];
      o.d = d;
      o.pan = this._right.dot(this._to) * clamp(len / 6, 0, 1);
      o.mastered = !!r.mastered;
      o.locked = !!r.locked;
      o.tension = clamp(1 - pL, 0.05, 1);
      o.focus = open && R.activeRiftId === r.id;
      out.push(o);
    }
    this._focusIndex = out.findIndex((x) => x.focus);
    this.hum.setKey((PLACES[this._place] || PLACES.home).root);
    this.hum.update(dt, out);

    // Crossing into arm's reach of a tear you are allowed to work on. The
    // world already puts a prompt on the screen; this is the same information
    // for the half of the field of view a player is not looking at. Hysteresis
    // at eight metres, so standing exactly on the boundary does not chirp.
    // …but not in the first seconds of the session, where it would land on top
    // of the sound the game makes when audio is first allowed to exist.
    this._age = (this._age || 0) + dt;
    const first = n ? list[ni[0]] : null;
    // The line the cadet is walking toward, for the score's fast dial. A tear
    // that is locked or already sealed is not the line in front of anybody.
    this._nearestId = (first && !first.locked && !first.mastered && nd[0] < 46)
      ? first.id : null;
    if (this._age > 3.5 && first && !first.locked && !first.mastered
      && nd[0] < 6.0 && !this._inRange && !open) {
      this._inRange = true;
      this.sting.inRange();
    } else if (this._inRange && (!first || nd[0] > 8.0)) {
      this._inRange = false;
    }
  }

  /**
   * WHERE THIS LEARNER STANDS, RIGHT NOW.
   *
   * The score used to be handed one number — the mean posterior over every
   * skill in the record — and that number moves by a sixtieth when a line
   * holds, against cadence banks a quarter of the range wide. So a learner
   * could master four skills in a sitting and never once hear the harmony
   * resolve. The dial existed and there was no way to turn it.
   *
   * These three turn it, and all three are read rather than reported:
   *
   *   line  the posterior on the skill in front of them — the one the open
   *         card is asking about, or, out in the world, the one the nearest
   *         workable tear carries. That second half is deliberate: walking
   *         toward a line you have nearly got should already sound different
   *         from walking toward one you have not touched.
   *   run   how far a live proving run has filled. It is the only thing on
   *         this list that is about to be resolved, so it carries the pedal.
   *   open  how much of the ground is unknown. A skill nobody has attempted,
   *         over a lattice full of skills nobody has attempted, is 1 — and at
   *         1 the chord loses its third, the bells thin out, the theme is
   *         withheld and the silence between phrases gets longer. That is what
   *         a unit opening is supposed to sound like: altitude and space, not
   *         a fanfare for work nobody has done yet.
   *
   * The lattice sweep is O(skills) and runs about every two seconds; the rest
   * is two map lookups.
   */
  _standing(R, dt) {
    const M = R.mastery;
    if (!M?.state) return { line: 0, open: 0, run: 0 };

    // How new the whole lattice in front of them is. Recomputed on its own slow
    // clock because it is the one part of this that walks every skill, and
    // `isUnlocked` walks a node's prerequisites on top of that.
    this._openT = (this._openT || 0) - dt;
    if (this._openT <= 0 || this._latticeOpen === undefined) {
      this._openT = 2.0;
      let fresh = 0, live = 0;
      for (const [k, v] of M.state) {
        if (v.mastered) continue;
        if (M.isUnlocked && !M.isUnlocked(k)) continue;
        live++;
        if (!(v.attempts > 0)) fresh++;
      }
      this._latticeOpen = live ? fresh / live : 1;
    }

    // The line in front of them: the open card first, then the nearest tear.
    const id = (R.panel?.open && R.panel.opts?.skillId)
      || R.activeRiftId
      || this._nearestId
      || null;
    const st = id ? M.state.get(id) : null;
    // WITH NOTHING IN FRONT OF THEM, THE LATTICE IS THE ANSWER.
    //
    // Falling back to zero here would mean the score forgot everything the
    // learner had done the moment they walked away from the last tear, and
    // remembered it again when they walked up to the next one. What is true out
    // on the island with no rift in ninety metres is the whole record, which is
    // exactly the number the slow dial already holds.
    const lattice = M.softIntegrity ? M.softIntegrity() : M.integrity();
    const line = st ? (st.mastered ? 1 : clamp(st.pL ?? 0, 0, 1)) : clamp(lattice, 0, 1);
    const chk = st?.check;
    const run = chk && chk.need ? clamp((chk.done || 0) / chk.need, 0, 1) : 0;
    // How new this particular line is. Six honest attempts is enough to stop
    // being somewhere new; with no line in front of them, the lattice again.
    const skillOpen = st
      ? (st.mastered ? 0 : clamp(1 - (st.attempts || 0) / 6, 0, 1))
      : this._latticeOpen;

    return {
      line,
      run,
      open: clamp(this._latticeOpen * 0.62 + skillOpen * 0.46, 0, 1),
    };
  }

  /**
   * The worked echo, cut open.
   *
   * `src/learn/echo.js` answers a wrong move by computing mathematics from the
   * learner's own answer — "your number is the answer to some question, and
   * naming that question takes it seriously". A sound over that surface has to
   * take the same stance, and until now it did the opposite: the delegated
   * click handler in `attach()` matched every `button` on the card, so calling
   * up the echo played `commit()`, the two-note figure that means *I am handing
   * this in*. Asking for help sounded like finishing.
   *
   * `panel.echoTier` is the depth the surface has dug to. It only ever climbs
   * while a card is up and it resets to 0 on the next card, so the whole of the
   * detection is one integer compared with its own previous value.
   */
  _watchEcho(R) {
    const tier = R.panel?.open ? (R.panel.echoTier | 0) : 0;
    const was = this._echoTier || 0;
    this._echoTier = tier;
    if (tier > was && this.built && this.bus.live) {
      this.sting.echoOpen(tier, this._place || 'home');
    }
  }

  /**
   * A cadet who has been sprinting for four seconds is a cadet who is
   * breathing. It is two breaths a phrase, it is under the wind, and it is the
   * cheapest way there is to make a run feel like a body rather than a camera
   * on rails. It stops the moment the legs do.
   */
  _breathing(dt, L, speed) {
    if (!L.grounded || speed < 0.72) { this._breath = Math.min(this._breath, 1.2); return; }
    this._breath += dt;
    if (this._breath < 2.6) return;
    this._breath = 0;
    this.feet.breath(clamp((speed - 0.7) / 0.3, 0, 1));
  }

  _step(foot, power) {
    if (!this.built || !this.bus.live) return;
    this.feet.step(this._surface, clamp(power ?? 0.5, 0, 1), foot === 0 ? -0.32 : 0.32, this._muffle);
  }

  /**
   * Locomotion's own event record, read once per frame and marked so a paused
   * frame cannot replay it. Nothing in player/ is modified to produce this —
   * the events were already there for the dust and the camera shake.
   */
  _moves(dt, L, speed) {
    const ev = L.ev;
    if (ev && !ev._heard) {
      ev._heard = true;
      const sfc = this._surface;
      if (ev.jumped) this.feet.jump(sfc, 0.6);
      if (ev.doubleJumped) this.feet.airJump();
      if (ev.landed > 0) this.feet.land(sfc, clamp((ev.landed - 6) / 26, 0, 1), this._muffle);
      if (ev.dashed) this.feet.dash();
      if (ev.glideOpened) this.feet.wingOpen();
      if (ev.glideClosed) this.feet.wingClose();
      if (ev.mantled) this.feet.mantle(sfc);
      if (ev.skidStart > 0) this.feet.skid(sfc, ev.skidStart);
      if (ev.wallHit && L.speed > 5) this.feet.bump();
      if (ev.sprintOn) this.feet.effort();
    }
    // continuous contact: a skid or a slide keeps throwing material
    if (L.grounded && (L.skidT > 0 || L.slideT > 0) && L.speed > 1.6) {
      this.feet.slide(this._surface, clamp(L.speed / 9, 0, 1), dt);
    }
  }

  /**
   * Which material the boot is meeting. Every branch here reads the same
   * fields the terrain shader and the scatterer read, so what you hear and
   * what you see are answers to one question.
   */
  _surfaceAt(x, z, y) {
    const solids = this.refs?.builder?.solids;
    if (solids && solids.count) {
      const top = solids.top(x, z);
      const g = heightAt(x, z);
      if (top !== null && Math.abs(y - top) < 1.1 && (g === null || top > g + 0.25)) return 'lattice';
    }
    if (underWater(x, z, 0.9)) return 'water';
    const z5 = dominantZone(x, z);
    // The plaza, a worn track, and ground too steep for soil to stay on it.
    // The slope threshold has to sit above the walkable limit or half the
    // island reads as bare rock: at 0.95 it was catching every hillside the
    // cadet can still run up, and the vale sounded like a quarry.
    if (pathAt(x, z) > 0.62 || Math.hypot(x, z) < 17) return 'stone';
    if (slopeAt(x, z) > 1.18) return 'stone';
    if (z5.id === 'alpine') return y > SNOW_Y ? 'snow' : 'scree';
    if (z5.id === 'badland') return 'dust';
    if (z5.id === 'steppe') return moistAt(x, z) > 0.34 ? 'grass' : 'dust';
    return 'grass';
  }

  /**
   * How much of the sky this patch of ground can see.
   *
   * Eight probes on a twenty-two metre ring, asking the same height field the
   * terrain mesh is built from whether the land around here is below you or
   * above you. One on a summit with everything falling away; nought at the
   * bottom of a gully with walls on every side; about a half on open rolling
   * ground, which is most of the island.
   *
   * This is the one number that lets the world sound different on a ridge than
   * in a grove, and it is deliberately geometric rather than a hand-placed
   * volume: nobody has to remember to mark a hollow, and a piece of terrain
   * that changes shape changes how it sounds for free. It is sampled only when
   * the cadet has actually moved a metre and a half — eight noise evaluations
   * per metre and a half walked is not a cost anybody can measure.
   */
  _exposureAt(x, z) {
    const here = heightAt(x, z);
    if (here === null) return 1;   // over the edge: nothing but sky
    let open = 0;
    for (let i = 0; i < RING.length; i += 2) {
      const h = heightAt(x + RING[i], z + RING[i + 1]);
      // A neighbour that is off the island entirely is open air, and open air
      // is the most exposed thing there is. Otherwise it is a question of how
      // far below you it stands: graded, not counted, because a flat plain and
      // a summit are not the same place and a yes/no test calls them both open.
      open += h === null ? 1 : clamp((here - h + 1.5) / 9, 0, 1);
    }
    return clamp(open / (RING.length / 2), 0, 1);
  }

  _comms() {
    if (!this.built || !this.bus.live) return;
    this.sting.commsBlip?.();
  }

  // ------------------------------------------------------- learning events
  /** A rift opened on the learning surface. */
  riftOpened(rift) {
    if (this.refs) this.refs.activeRiftId = rift?.id || null;
    if (this.built && this.bus.live) this.sting.riftOpen();
  }

  riftClosed() {
    if (this.refs) this.refs.activeRiftId = null;
    if (this.built && this.bus.live) this.sting.riftClose();
  }

  /**
   * The learner committed.
   *
   * `res` is the mastery engine's whole report, and this used to read two
   * fields of it. Every branch below is a fact the engine was already handing
   * over and nobody was listening to:
   *
   *   RIGHT, and a proving run banked it   the run has a rung, pitched by how
   *      full it is, so three in a row is an ascending figure a learner learns
   *      to want. The seal under it gets smaller, because the rung is the news.
   *   RIGHT, and the gate has now opened    the score lifts onto the fifth and
   *      holds there. A question has been asked; a question that resolves is
   *      not a question.
   *   RIGHT, and the line held              the whole seal, the choir, and the
   *      one lift the music is allowed. Unchanged, because it was right.
   *   WRONG, and the run absorbed it        the ladder steps back down one rung
   *      and the warm figure plays, QUIETER than an ordinary slip. A learner
   *      inside a run is already working at the top of what they can do.
   *   WRONG, and the run ended              the ladder unwinds, downward, warm,
   *      landing on the tonic. Not a failure sting: `src/learn/echo.js` answers
   *      a wrong move by computing mathematics out of it, and a buzzer over
   *      that surface would contradict the surface.
   *   A CLAIM WITHDRAWN                     one low tone with no attack, under
   *      whatever else is playing. A light going out, never an alarm — and it
   *      can arrive on a right answer as well as a wrong one, so it is tested
   *      on its own rather than inside either branch.
   *
   * Nothing here is louder than the ordinary seal except the one that closes a
   * skill, and nothing carries information the card does not already print.
   */
  answered(correct, res) {
    if (!this.built || !this.bus.live) return;
    const place = this._place || 'home';
    const i = this._focusIndex >= 0 ? this._focusIndex : 0;
    const ev = res?.checkEvent || null;
    const chk = res?.check || null;
    // How many items the run had banked before this answer, PER SKILL. A
    // learner walks away from a half-finished run and works another line; if
    // this were a single number, the first correct answer back at the first
    // rift would read as a rung whether or not the run banked anything, because
    // the count it was compared against belonged to a different skill.
    const id = res?.skill || null;
    if (!this._runDone) this._runDone = new Map();
    const prev = id && this._runDone.has(id) ? this._runDone.get(id) : 0;
    const done = chk ? (chk.done | 0) : 0;
    if (id) { if (chk) this._runDone.set(id, done); else this._runDone.delete(id); }

    if (correct) {
      this._slips = 0;
      this._streak = (this._streak || 0) + 1;
      // Two in a row is a run. The score picks it up and keeps it for about
      // half a minute after the last one — which is roughly how long a
      // fifteen-year-old stays feeling like they are winning.
      this.score.momentum = clamp(0.35 + this._streak * 0.22, 0, 1);
      this.hum.resolve(i);
      const big = !!res?.justMastered;
      // A rung is the news when there is one, so the seal underneath it stands
      // back: two events at full size on the same downbeat is one event twice.
      // The item that OPENS a run does not get one — the gate arriving is the
      // news on that answer, and a rung under it would be two pieces of news
      // about the same thing.
      const rang = !big && ev !== 'opened' && chk && chk.need && done > prev;
      this.sting.seal({
        place,
        mastery: res?.pL ?? 0.5,
        big,
        // …unless this answer closed the skill, in which case nothing stands
        // back from anything.
        quiet: rang ? 0.55 : 1,
      });
      if (rang) this.sting.rung(done, chk.need, place);
      if (big) {
        this.score.lift(true);
        // What the run that is closing actually held, so `resolutionLand` knows
        // whether the choir has earned its entrance. `beats.js` clears it when
        // the close beat fires, so the next run starts owing nothing.
        if (this.beats) this.beats.held = (this.beats.held || 0) + 1;
      }
      // The gate arriving is its own event and it lands after the seal, not
      // under it — the seal is about the answer, this is about what the answer
      // has just bought.
      if (!big && ev === 'opened') {
        this._later(0.62, () => this.sting.runOpened(place));
      }
    } else {
      this._streak = 0;
      this._slips = (this._slips || 0) + 1;
      this.score.momentum *= 0.4;
      this.hum.tighten(i);
      if (ev === 'charged') this.sting.runCharged(done, chk?.need || 3, place);
      else if (ev === 'failed') this.sting.runEnded(place);
      else this.sting.slip(this._slips);
    }

    // Either way: a claim the engine has taken back.
    if (res?.justWithdrawn) this._later(0.9, () => this.sting.withdrawn(place));
  }

  /**
   * Something in the future, without a bare `setTimeout` that outlives the
   * graph it was scheduled against. Every callback re-checks that there is
   * still a running context, so a player who mutes in the second between a
   * seal and its consequence gets silence rather than a late noise.
   */
  _later(sec, fn) {
    setTimeout(() => { if (this.built && this.bus.live) fn(); }, sec * 1000);
  }

  /**
   * SOMETHING GOOD HAPPENED.
   *
   * This method has one sound and fourteen callers: a rank promotion, a unit
   * opening, a cache opened, a warden bound, a span laid, a beacon planted, a
   * station raised, a travel between two of them, a purchase at the foundry, a
   * capability granted, a standing order kept, a sounding landed, a session
   * closed, and the wallet crossing the price of a thing it can now afford. All
   * fourteen play five bells in A. A sound that means fourteen things means
   * nothing, and the ear stops hearing it inside one session.
   *
   * The ones that own the frame have their own voice now, taken off the
   * surfaces they put on the glass rather than off a hook (see `beats.js`): a
   * promotion, a capability grant, the orders, and the close. The rest still
   * arrive here, and `kind` is how they will stop having to: it is optional and
   * the default is exactly what this always did, so nothing has to change and
   * anything that wants to can.
   *
   * WHAT THE OTHER LANES WOULD HAVE TO PASS, if they want the rest of it:
   *   `src/world/caches.js`  `audio.unlocked('cache')`
   *   `src/world/warden.js`  `audio.unlocked('bind')`
   *   `src/world/span.js`    `audio.unlocked('span')`
   *   `src/kit/kit.js`       `'buy'` at the counter, `'beacon'`, `'station'`,
   *                          `'travel'`, `'afford'`, `'sound'`
   *   `src/main.js`          `'unlocked'` for a line opening, `'order'` for a
   *                          standing order kept
   * Nothing breaks if none of them ever does.
   *
   * @param {string} [kind]
   */
  unlocked(kind) {
    if (!this.built || !this.bus.live) return;
    const place = this._place || 'home';
    switch (kind) {
      case 'rank': this.sting.rankUp(place); break;
      case 'grant': case 'buy': this.sting.granted(place); break;
      case 'beacon': case 'station': case 'travel':
        this.sting.anchor(); break;
      case 'afford': this.sting.pick(); break;
      default: {
        /*
         * A CEREMONY MAY BE ABOUT TO TAKE THE FRAME.
         *
         * Several callers announce the event and raise the surface in the same
         * tick, in that order — `src/meta/index.js` plays the rite and then
         * calls this; `src/session/index.js` closes the run and then calls
         * this; `src/kit/kit.js` shows the grant toast and then calls this. The
         * surface observer (`beats.js`) sees the class on the next slow tick,
         * which is up to a frame later, so without this the promotion would
         * play the five-bell figure and then the fanfare, one after the other.
         *
         * A hundred and fifty milliseconds is under the threshold at which
         * anybody can tell an event from its own sound, and `src/main.js`
         * already sits on this call for two and a half seconds when a line
         * opens. If a ceremony lands inside the window it has already said
         * this, and the generic figure is dropped.
         */
        clearTimeout(this._genericT);
        this._genericT = setTimeout(() => {
          if (!this.built || !this.bus.live) return;
          const fired = this.beats?.firedAt || 0;
          if (fired && performance.now() - fired < 500) return;
          this.sting.unlocked();
        }, 150);
        break;
      }
    }
  }

  setMuted(m) { this.bus.setMuted(m); }
  get muted() { return this.bus.muted; }
}

export function createAudio(root) {
  return new AudioDirector(root);
}
