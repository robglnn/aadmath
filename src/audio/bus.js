/**
 * The mixer.
 *
 * One AudioContext, created on the first real user gesture and never before —
 * an autoplay-blocked context is not merely silent, it starts at `suspended`
 * and every note scheduled against its clock lands in the past, so the first
 * thing a player hears after they finally click is four seconds of backlog.
 * We refuse to build it until we are allowed to run it.
 *
 * Above that: four buses that exist so the game can duck one thing under
 * another without a mixing engineer. Music sits under everything the learner
 * does; ambience sits under the music; the world's own sounds and the
 * interface each get their own path to the limiter.
 *
 *   voice ──► bus ──────────────────────────────► master ─► limiter ─► out
 *        └──► send ─► convolver(hall | air) ─────┘
 */

import { impulse, gain, filter } from './dsp.js';

const SAVE = 'ascent.audio';

export class Bus {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = 1;
    this._listeners = new Set();
    try {
      const s = JSON.parse(localStorage.getItem(SAVE) || 'null');
      if (s && typeof s.muted === 'boolean') this.muted = s.muted;
      if (s && typeof s.volume === 'number') this.volume = s.volume;
    } catch { /* private mode */ }
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }

  /**
   * Build the graph. Safe to call repeatedly; only the first call does work,
   * and it must happen inside a gesture handler.
   */
  start() {
    if (this.ctx) { this._resume(); return this.ready; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    let ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return false; }
    this.ctx = ctx;

    // --- master chain -------------------------------------------------
    // The limiter is not there to be heard. It is there so that a seal chord
    // landing on top of a gale, a rift hum and eight pad voices cannot clip
    // the output — a game that distorts when something good happens teaches
    // the player that good things sound broken.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -11;
    limiter.knee.value = 6;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.22;

    this.out = gain(ctx, this.muted ? 0 : this.volume);
    this.master = gain(ctx, 0.80);
    // Everything below about 35 Hz is headroom being spent on something no
    // laptop and no phone can reproduce. Left in, it was taking two thirds of
    // the total energy of the mix and pushing the limiter down on top of the
    // parts you can actually hear.
    this.rumble = filter(ctx, 'highpass', 36, 0.6);
    const rumble2 = filter(ctx, 'highpass', 36, 0.6);
    this.master.connect(this.rumble); this.rumble.connect(rumble2);
    rumble2.connect(limiter);
    limiter.connect(this.out);
    this.out.connect(ctx.destination);

    // A meter for the interface, not for the mix. 32 bins is all the ring on
    // the sound button can show, and a small FFT is a small main-thread copy.
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.72;
    rumble2.connect(this.analyser);
    this.meter = new Uint8Array(this.analyser.frequencyBinCount);

    // --- spaces -------------------------------------------------------
    // Two reverbs, because a footstep and a chord are not in the same room.
    // `air` is the island: short, bright, wide — the reflection you get off a
    // grass slope and a rock face two hundred metres away. `hall` is the
    // lattice: long and dark, the sound of standing inside something built.
    this.hall = ctx.createConvolver();
    this.hall.buffer = impulse(ctx, 3.4, 2.4, 0.30, 1.5);
    this.hallIn = gain(ctx, 1);
    this.hallTone = filter(ctx, 'highpass', 180);
    this.hallIn.connect(this.hallTone); this.hallTone.connect(this.hall);
    this.hallOut = gain(ctx, 0.9);
    this.hall.connect(this.hallOut); this.hallOut.connect(this.master);

    this.air = ctx.createConvolver();
    this.air.buffer = impulse(ctx, 1.15, 3.4, 0.14, 3.0);
    this.airIn = gain(ctx, 1);
    this.airOut = gain(ctx, 1.05);
    this.airIn.connect(this.air); this.air.connect(this.airOut);
    this.airOut.connect(this.master);

    // --- buses --------------------------------------------------------
    this.music = gain(ctx, 0.46);
    // One filter across the whole score. When the learner is inside a rift the
    // music does not stop — it moves into the next room, which is what a film
    // does when a character stops hearing the world.
    this.musicTone = filter(ctx, 'lowpass', 16000, 0.5);
    this.music.connect(this.musicTone); this.musicTone.connect(this.master);

    this.amb = gain(ctx, 1.05); this.amb.connect(this.master);
    this.sfx = gain(ctx, 1.15); this.sfx.connect(this.master);
    this.ui = gain(ctx, 0.7); this.ui.connect(this.master);

    // Ducking: one gain each on music and ambience, driven by events, so a
    // seal or a spoken line has somewhere to sit.
    this.musicDuck = gain(ctx, 1);
    this.music.disconnect();
    this.music.connect(this.musicDuck); this.musicDuck.connect(this.musicTone);
    this.ambDuck = gain(ctx, 1);
    this.amb.disconnect();
    this.amb.connect(this.ambDuck); this.ambDuck.connect(this.master);

    this.ready = true;
    // A context created inside a gesture starts *running*, even when the
    // player left the game muted last time. Rendering a graph nobody can hear
    // is a phone battery being spent on nothing, so park it immediately.
    if (this.muted) ctx.suspend().catch(() => {});
    else this._resume();
    this._emit();
    return true;
  }

  _resume() {
    if (!this.ctx) return;
    if (this.muted) return;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Send a voice's output into a space, at a level. */
  send(node, space, amount) {
    if (!this.ready || amount <= 0) return null;
    const g = gain(this.ctx, amount);
    node.connect(g);
    g.connect(space === 'hall' ? this.hallIn : this.airIn);
    return g;
  }

  /**
   * Pull the music (and optionally the world) down for a moment so something
   * else can be the loudest thing in the room.
   */
  duck(depth = 0.45, hold = 0.35, release = 1.1, world = 0) {
    if (!this.ready) return;
    const t = this.t;
    for (const [node, d] of [[this.musicDuck, depth], [this.ambDuck, world]]) {
      if (d <= 0) continue;
      const p = node.gain;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(1 - d, t + 0.05);
      p.setValueAtTime(1 - d, t + 0.05 + hold);
      p.setTargetAtTime(1, t + 0.05 + hold, release / 3);
    }
  }

  setMuted(m) {
    this.muted = !!m;
    this._save();
    if (this.ready) {
      const t = this.t;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(this.muted ? 0 : this.volume, t + 0.14);
      // A muted context that keeps rendering is a phone battery being spent on
      // silence. Give the fade time to land, then park the whole graph.
      clearTimeout(this._park);
      if (this.muted) this._park = setTimeout(() => {
        if (this.muted && this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
      }, 300);
      else this._resume();
    }
    this._emit();
  }

  toggle() { this.setMuted(!this.muted); return this.muted; }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this._save();
    if (this.ready && !this.muted) this.out.gain.setTargetAtTime(this.volume, this.t, 0.05);
    this._emit();
  }

  _save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ muted: this.muted, volume: this.volume })); }
    catch { /* private mode */ }
  }

  /** True when there is a running graph to schedule against. */
  get live() { return this.ready && !this.muted && this.ctx.state === 'running'; }

  /** Peak level, 0..1, for the interface meter. Cheap, and only when asked. */
  level() {
    if (!this.ready) return 0;
    this.analyser.getByteFrequencyData(this.meter);
    let s = 0;
    for (let i = 1; i < 24; i++) s += this.meter[i];
    return Math.min(1, s / (23 * 190));
  }
}
