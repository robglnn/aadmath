import * as THREE from 'three';

/**
 * The frame.
 *
 * Three jobs, and they are all about time rather than pixels:
 *
 *  1. **Measure honestly.** Every frame's delta lands in a ring buffer, and
 *     everything downstream reads *percentiles* off it. An average frame time
 *     is the one number that cannot tell you whether a game is smooth: a run
 *     that alternates 8 ms and 40 ms averages a comfortable 24 ms and feels
 *     like a slideshow. `stats()` reports p50 / p95 / p99 and a 1% low.
 *
 *  2. **Spend the budget.** The post stack proposes a drawing-buffer scale of
 *     its own; the engine owns the renderer, so it *caps* what anybody may
 *     ask for and moves that cap with measured frame time. This matters more
 *     than any effect toggle, because on this world the frame is almost
 *     perfectly fill-bound: on the same machine, the same scene, the same
 *     effects, at device pixel ratio 1.75 it costs 50 ms and at 1.15 it costs
 *     12 ms. Nothing in the effect list is worth 4x the frame rate, so
 *     resolution is the first knob and the effect tier is the backstop.
 *
 *     The cap starts *below* what a good machine can hold and climbs. A game
 *     that opens at 20 fps and recovers has already lost the player; a game
 *     that opens smooth and sharpens over the next few seconds has not.
 *
 *  3. **Stop when nobody is looking.** A backgrounded tab used to keep the
 *     whole post chain running — on a phone that is the battery, and on a
 *     laptop it is the fan. Hidden means paused, and the clock is reset on the
 *     way back so the first visible frame is not a 40-second delta.
 */

const HISTORY = 240;          // ~4 s of frames at 60 Hz
const TIERS = ['low', 'medium', 'high'];

/** Frame-time percentiles over a rolling window. */
class FrameLog {
  constructor(n = HISTORY) {
    this.buf = new Float32Array(n);
    this.n = 0;
    this.i = 0;
  }

  push(ms) {
    this.buf[this.i] = ms;
    this.i = (this.i + 1) % this.buf.length;
    if (this.n < this.buf.length) this.n++;
  }

  reset() { this.n = 0; this.i = 0; }

  /** Sorted copy of what we have. Allocates — call it from reports, not frames. */
  sorted() {
    const a = Array.prototype.slice.call(this.buf, 0, this.n);
    return a.sort((x, y) => x - y);
  }

  percentiles() {
    if (!this.n) return null;
    const s = this.sorted();
    const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
    return {
      samples: s.length,
      p50: q(0.5), p95: q(0.95), p99: q(0.99),
      best: s[0], worst: s[s.length - 1],
      fps: 1000 / q(0.5),
      fps1Low: 1000 / q(0.99),
    };
  }
}

/**
 * Closed-loop quality control.
 *
 * One controller, two knobs, in the order that costs the least image for the
 * most milliseconds:
 *
 *   pixel-ratio cap   continuous, moves often, this is the real lever
 *   effect tier       discrete, moves rarely, only once resolution is spent
 *
 * The post stack ships a resolution governor of its own. Two controllers on
 * one knob oscillate, so this one takes the wheel: it pins the stack's scale
 * to 1 on every window and does the deciding itself.
 */
class QualityDirector {
  constructor(engine, opts = {}) {
    this.engine = engine;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const small = Math.min(innerWidth, innerHeight) < 520;
    // A phone is not merely a small window. A 3x panel on a 4-core part is the
    // case that decides whether this game is playable on the device most
    // teenagers actually own, and the three signals disagree often enough that
    // any one of them alone gets it wrong: an external monitor makes a phone
    // look big, a touchscreen laptop reports coarse, and a narrow desktop
    // window reports small. Any of them is enough to start conservative — the
    // ladder climbs back within a couple of seconds if the machine is quick.
    const touch = (navigator.maxTouchPoints || 0) > 1;
    const thin = (navigator.hardwareConcurrency || 8) <= 6 || (navigator.deviceMemory || 8) <= 4;
    const handheld = coarse || small || (touch && (thin || dpr >= 2.5));

    this.ceiling = Math.min(dpr, opts.ceiling ?? (handheld ? 1.4 : 1.5));
    this.floor = Math.min(dpr, opts.floor ?? (handheld ? 0.6 : 0.72));
    // A phone opens at exactly its CSS resolution: sharp, and cheap enough that
    // a mid-range handset has somewhere to fall to rather than somewhere to
    // climb from. A laptop opens a little above it and climbs.
    this.cap = Math.min(this.ceiling, Math.max(this.floor, handheld ? 1.0 : 1.2));

    // 60 fps is 16.7 ms. We act on the median being late, or on the frame
    // *spikes* being late — a 60 fps median with a 40 ms p95 is what a player
    // calls stutter. But a spike alone is not enough: on a machine with other
    // work on it the p95 is somebody else's compositor, and shrinking our
    // image to pay for their process makes the game blurry for nothing. A
    // spike only counts against us when our own median is not comfortable.
    //
    // And the target is not 60 fps, it is 60 fps *with room*. A controller that
    // converges exactly on 16.7 ms parks the game on the edge of the budget,
    // where any extra load — a rift opening, somebody else's tab — drops
    // frames. Shrink above 16.5 ms, grow below 11.5, settle around 70.
    this.slowMs = opts.slowMs ?? 16.5;
    this.spikeMs = opts.spikeMs ?? 32;
    this.direMs = opts.direMs ?? 26;
    this.fastMs = opts.fastMs ?? 11.5;
    this.calmMs = opts.calmMs ?? 21;

    this.window = [];
    this.acc = 0;
    this.cool = 2.2;          // let the world finish streaming in before judging
    this.bad = 0;
    this.good = 0;
    this.tierBad = 0;
    this.tierGood = 0;
    this.changes = 0;
    this.enabled = opts.enabled !== false;
  }

  get tierIndex() {
    const name = this.engine.postFX?.tier;
    const i = TIERS.indexOf(name);
    return i < 0 ? TIERS.length - 1 : i;
  }

  tick(dt) {
    if (!this.enabled) return;
    if (dt <= 0 || dt > 0.5) return;
    this.window.push(dt * 1000);
    this.acc += dt;
    this.cool -= dt;
    if (this.acc < 1.0) return;

    const s = this.window.slice().sort((a, b) => a - b);
    this.window.length = 0;
    this.acc = 0;
    const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
    const p50 = q(0.5), p95 = q(0.95);

    // Take the wheel back from the post stack's own governor, so there is
    // exactly one thing in this program deciding how big the buffer is. Only
    // when it has actually moved — re-asserting it every window would cost a
    // buffer reallocation a second for nothing.
    const fx = this.engine.postFX;
    if (fx && fx.renderScale !== undefined && Math.abs(fx.renderScale - 1) > 0.001) fx.pinScale?.(1);

    const late = p50 > this.slowMs || (p95 > this.spikeMs && p50 > this.fastMs);
    const dire = p50 > this.direMs;
    const easy = p50 < this.fastMs && p95 < this.calmMs;
    if (late) { this.bad += dire ? 2 : 1; this.good = 0; }
    else if (easy) { this.good++; this.bad = 0; }
    else { this.bad = 0; this.good = 0; }

    if (this.cool > 0) return;

    if (this.bad >= 2) {
      this.bad = 0;
      this.tierGood = 0;
      if (this.cap > this.floor + 0.001) {
        this.setCap(this.cap - (dire ? 0.3 : 0.15));
        this.cool = 1.4;
      } else if (++this.tierBad >= 2 && this.tierIndex > 0) {
        this.tierBad = 0;
        this.engine.postFX?.setTier?.(TIERS[this.tierIndex - 1]);
        this.changes++;
        this.cool = 3.0;
      }
    } else if (this.good >= 3) {
      this.good = 0;
      this.tierBad = 0;
      if (this.cap < this.ceiling - 0.001) {
        // Plenty of headroom buys a bigger step. Sharpness is the only thing
        // resolution is for, and taking twenty seconds to find it wastes the
        // first twenty seconds of the game.
        this.setCap(this.cap + (p50 < 8 ? 0.2 : 0.12));
        this.cool = 2.0;
      } else if (++this.tierGood >= 4 && this.tierIndex < TIERS.length - 1) {
        this.tierGood = 0;
        this.engine.postFX?.setTier?.(TIERS[this.tierIndex + 1]);
        this.changes++;
        this.cool = 5.0;
      }
    }
  }

  setCap(v) {
    const next = Math.min(this.ceiling, Math.max(this.floor, +v.toFixed(3)));
    if (Math.abs(next - this.cap) < 0.001) return;
    this.cap = next;
    this.changes++;
    this.engine.applyPixelRatio();
  }
}

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance', stencil: false,
      // The post stack owns the final draw and reads the frame back through a
      // render target, so the default drawing buffer never needs preserving
      // and the compositor never needs an alpha channel from us.
      alpha: false, depth: true, preserveDrawingBuffer: false,
    });

    // The renderer's pixel ratio is a *shared* setting — the post stack asks
    // for one, a resize asks for one, and the quality director decides what is
    // affordable. Rather than have three writers race, everything routes
    // through here and the director's cap is the last word.
    // It also swallows no-op writes. `setPixelRatio` resizes the drawing
    // buffer unconditionally, and reallocating a 2800x1575 canvas plus the
    // whole HDR chain to the size it already was is a visible hitch — which is
    // exactly what a governor that re-asserts its scale once a second was
    // buying us.
    this._setPixelRatio = this.renderer.setPixelRatio.bind(this.renderer);
    this.renderer.setPixelRatio = (v) => {
      if (v === undefined || !Number.isFinite(v)) return;
      this._requestedPixelRatio = v;
      const eff = Math.min(v, this.quality ? this.quality.cap : v);
      if (Math.abs(this.renderer.getPixelRatio() - eff) < 0.0005) return;
      this._setPixelRatio(eff);
    };

    this._requestedPixelRatio = Math.min(devicePixelRatio || 1, 2);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000);
    this.clock = new THREE.Clock();
    this.updaters = new Set();
    // Optional post-processing stack (src/fx). When present it owns the frame's
    // final draw and its own resize; when absent we render straight to screen.
    this.postFX = null;

    this.quality = new QualityDirector(this, opts.quality);
    this.log = new FrameLog();

    this.frame = 0;
    this.fps = 60;
    this.paused = false;
    this._acc = 0;
    this._frames = 0;
    this._w = 0; this._h = 0;

    this.renderer.setPixelRatio(this._requestedPixelRatio);
    this._resize(true);

    // Phones fire `resize` for every pixel the address bar slides, and each one
    // used to reallocate an HDR target, a depth texture, a bloom pyramid and a
    // volumetric buffer — mid-scroll, mid-frame. Coalesced to one per frame,
    // and dropped entirely when the size did not actually change.
    const bump = () => this._queueResize();
    addEventListener('resize', bump);
    addEventListener('orientationchange', bump);
    window.visualViewport?.addEventListener?.('resize', bump);
    // iOS slides the URL bar without ever firing `resize`: the visual viewport
    // scrolls instead. Without this the game keeps drawing at the old height
    // for the whole of the animation and the controls sit in the wrong place.
    window.visualViewport?.addEventListener?.('scroll', bump);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._suspend();
      else this._resume();
    });
  }

  // ---- sizing ---------------------------------------------------------
  _queueResize() {
    if (this._resizeQueued) return;
    this._resizeQueued = true;
    requestAnimationFrame(() => { this._resizeQueued = false; this._resize(); });
  }

  /**
   * How tall the game actually is.
   *
   * `innerHeight` is the *layout* viewport, which on a phone includes the strip
   * of screen the URL bar is currently sitting on. Sizing the frame to it draws
   * the bottom 90 px of the world underneath the browser's own chrome, and —
   * worse — puts the on-screen jump button under the address bar, where every
   * press is a tap on the URL field. `visualViewport` is the part the player can
   * actually see, and it is the only measurement that stays true while the bar
   * is mid-slide.
   *
   * The number is published as `--vp-h` so the HUD's fixed layer can be pinned
   * to the same box the renderer is drawing into; without that the canvas and
   * the controls disagree about where the bottom of the screen is.
   */
  _viewport() {
    const vv = window.visualViewport;
    // A pinch-zoom shrinks visualViewport without shrinking the game; scale is
    // divided back out so a zoom cannot resize the drawing buffer.
    const w = vv ? vv.width * (vv.scale || 1) : innerWidth;
    const h = vv ? vv.height * (vv.scale || 1) : innerHeight;
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  }

  _resize(force = false) {
    const { w, h } = this._viewport();
    if (!force && w === this._w && h === this._h) return;
    this._w = w; this._h = h;
    document.documentElement.style.setProperty('--vp-h', `${h}px`);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.postFX) this.postFX.setSize(w, h);
  }

  /** Re-apply the requested pixel ratio through the director's cap. */
  applyPixelRatio() {
    const before = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(this._requestedPixelRatio);
    if (Math.abs(this.renderer.getPixelRatio() - before) < 0.0005) return;
    if (this.postFX) this.postFX.setSize(this._w, this._h);
  }

  // ---- telemetry ------------------------------------------------------
  /**
   * Real percentiles over the last few seconds, plus what the quality loop is
   * currently spending. Averages are deliberately absent.
   */
  stats() {
    const p = this.log.percentiles();
    const r = this.renderer.info.render;
    return {
      ...(p || { samples: 0, p50: 0, p95: 0, p99: 0, fps: 0, fps1Low: 0 }),
      pixelRatio: this.renderer.getPixelRatio(),
      pixelCap: this.quality.cap,
      tier: this.postFX?.tier ?? 'none',
      qualityChanges: this.quality.changes,
      draws: r.calls,
      tris: r.triangles,
      paused: this.paused,
    };
  }

  add(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  // ---- the loop -------------------------------------------------------
  _suspend() {
    if (this.paused) return;
    this.paused = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _resume() {
    if (!this.paused) return;
    this.paused = false;
    this.clock.getDelta();       // swallow the gap
    this.log.reset();
    this.quality.window.length = 0;
    this.quality.acc = 0;
    this.quality.cool = 1.0;
    if (this._started) this._loop();
  }

  _loop() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      const raw = this.clock.getDelta();
      const dt = Math.min(raw, 0.05);
      const t = this.clock.elapsedTime;
      this.frame++;

      this.log.push(raw * 1000);
      this.quality.tick(raw);

      this._acc += dt; this._frames++;
      if (this._acc >= 0.5) { this.fps = this._frames / this._acc; this._acc = 0; this._frames = 0; }

      for (const fn of this.updaters) fn(dt, t);
      if (this.postFX) {
        this.postFX.update(dt, t);
        this.postFX.render(dt);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    tick();
  }

  start() {
    this._started = true;
    // The post stack sets its own pixel ratio when it is installed; put it
    // back through the cap so the very first frame is already affordable.
    this.applyPixelRatio();
    // Opened in a background tab: start suspended rather than rendering a
    // whole post chain nobody is looking at, and pick up on the way back.
    if (document.hidden) { this.paused = true; return; }
    this._loop();
  }

  stop() { this._started = false; this._suspend(); }
}
