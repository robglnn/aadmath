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
 * landings, the wing, building, mastery, region, altitude, proximity — is
 * observed. That is deliberate: a system that has to be told about every event
 * is a system that goes quiet the moment somebody else refactors.
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

    // The learning surface: typing, committing, and the buttons on the card.
    // Delegated, so a rebuild of the rift's DOM cannot break it.
    if (uiRoot) {
      uiRoot.addEventListener('pointerdown', (e) => {
        if (!this.built) return;
        const b = e.target.closest?.('button, .ans, .slot, .tile, .bay');
        if (b) this.sting.commit();
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
      this._expose = this._exposureAt(p.x, p.z);
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
    s.travel = clamp(Math.max(speed * 0.85, glide, L.dashT > 0 ? 1 : 0), 0, 1);
    s.alt = alt;
    s.focus = this._focus;
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

      this.amb.update(sdt, {
        weights: this._w, alt, speed, glide, fall,
        water: this._water || 0, indoors: this._focus,
        expose: this._expose ?? 0.5,
      });
      this._riftHum(sdt, p, R, open);

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
    if (this._age > 3.5 && first && !first.locked && !first.mastered
      && nd[0] < 6.0 && !this._inRange && !open) {
      this._inRange = true;
      this.sting.inRange();
    } else if (this._inRange && (!first || nd[0] > 8.0)) {
      this._inRange = false;
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
   * The learner committed. `res` is exactly what the mastery engine handed
   * back, so the sound of being right is a function of how right it made you.
   */
  answered(correct, res) {
    if (!this.built || !this.bus.live) return;
    if (correct) {
      this._slips = 0;
      this._streak = (this._streak || 0) + 1;
      // Two in a row is a run. The score picks it up and keeps it for about
      // half a minute after the last one — which is roughly how long a
      // fifteen-year-old stays feeling like they are winning.
      this.score.momentum = clamp(0.35 + this._streak * 0.22, 0, 1);
      const i = this._focusIndex >= 0 ? this._focusIndex : 0;
      this.hum.resolve(i);
      this.sting.seal({
        place: this._place || 'home',
        mastery: res?.pL ?? 0.5,
        big: !!res?.justMastered,
      });
      if (res?.justMastered) this.score.lift(true);
    } else {
      this._streak = 0;
      this._slips = (this._slips || 0) + 1;
      this.score.momentum *= 0.4;
      this.hum.tighten(this._focusIndex >= 0 ? this._focusIndex : 0);
      this.sting.slip(this._slips);
    }
  }

  /** A new line of the lattice opened. */
  unlocked() {
    if (this.built && this.bus.live) this.sting.unlocked();
  }

  setMuted(m) { this.bus.setMuted(m); }
  get muted() { return this.bus.muted; }
}

export function createAudio(root) {
  return new AudioDirector(root);
}
