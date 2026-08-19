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
export class QualityDirector {
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
    // Comfortable, but not luxurious: a median under this is a machine holding
    // well above 60 with room to spare, and it is allowed to climb back out of
    // a degrade on it — at half speed. See `tick`, THE DEAD ZONE.
    this.mildMs = opts.mildMs ?? 13.5;

    this.window = [];
    this.acc = 0;
    this.cool = 2.2;          // let the world finish streaming in before judging
    this.bad = 0;
    this.good = 0;
    this.tierBad = 0;
    this.tierGood = 0;
    this.changes = 0;
    // How many tier steps this controller currently OWES the player, and how
    // many times it has ever had to take one. See `tick` — the first decides
    // what is handed back, the second decides how patient it is about it.
    this.tierOwed = 0;
    this.tierDrops = 0;
    // The live test of whether the last tier drop bought any frame time, and
    // the verdict once it has. See `tick`, DID SPENDING THE PICTURE BUY
    // ANYTHING — a machine that is not fill-bound must not be charged the
    // effects for a fault they cannot fix.
    this.tierProbe = null;
    this.tierUseless = false;
    this.tierUselessAt = 0;
    // Milliseconds one step of the effect tier is worth on this machine, as
    // measured rather than assumed. Zero until a drop has proved itself.
    this.tierCost = 0;
    // Consecutive windows whose p95 was late, and consecutive windows that were
    // outright comfortable. One hitch is an event; a run of them is a load.
    this.spikeRun = 0;
    this.calmRun = 0;
    this.enabled = opts.enabled !== false;
  }

  /** Forget the shape of the last few seconds. Called when the clock jumps. */
  forget() {
    this.window.length = 0;
    this.acc = 0;
    this.bad = 0;
    this.good = 0;
    this.spikeRun = 0;
    this.calmRun = 0;
    // A probe measures frame time across the seconds either side of a drop.
    // A tab that was in the background for a minute has no such seconds, so
    // the reading is void rather than favourable — abandon it and let the next
    // genuine drop start a fresh one.
    this.tierProbe = null;
  }

  /**
   * How many comfortable seconds buy the effect tier back.
   *
   * Doubling per drop, to a ceiling. A machine that lost the tier once because
   * a rift opened and a hundred motes spawned should have it back in four
   * seconds; a machine that genuinely cannot hold it must not spend the rest of
   * the session flapping between two looks, which is worse to sit in front of
   * than the lower one.
   */
  patience() { return 4 * (1 << Math.min(3, Math.max(0, this.tierDrops - 1))); }

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

    // ---- THE DEAD ZONE, AND WHY THE TIER NEVER CAME BACK ----------------
    //
    // A fifteen-minute session (`tools/critic/sustain.mjs`) put this machine at
    // fxTier 'low' with the resolution cap pinned at its floor from minute two
    // to minute fifteen — while the median frame rate over that whole stretch
    // was 96 to 108 fps. The controller was not fighting a slow machine. It was
    // stuck.
    //
    // Both tests below used to be absolute AND unforgiving of a single window:
    //
    //     late = p50 > 16.5  ||  (p95 > 32 && p50 > 11.5)
    //     easy = p50 < 11.5  &&   p95 < 21
    //
    // At 100 fps the median is 10 ms, so `late` is false. But a real session
    // never stops producing one-frame hitches — a card laying out KaTeX, a
    // shader compiling the first time a biome is seen, a texture upload, the
    // collector. Any one of those puts p95 over 21 ms, so `easy` is false too.
    // Neither branch fires, both counters reset, and the controller sits in the
    // `else` forever at whatever quality the first bad minute knocked it down
    // to. The longer the session runs the likelier every single window contains
    // at least one hitch, which is precisely why this only appeared at minute
    // fifteen and never at second five.
    //
    // Measured off the real session: the median frame time in those windows was
    // 7 to 9 ms — 110 to 140 fps — while the p95 was 21 to 75 ms in EVERY ONE
    // of them. So `p95 < calmMs` was never once true after minute two, and the
    // climb was gated on it.
    //
    // The deciding argument is what the knob actually does. The resolution cap
    // and the effect tier are FILL-RATE knobs. A 60 ms hitch caused by KaTeX
    // laying out a card, a shader compiling, or the collector running is not
    // fill rate, and shrinking the drawing buffer does not shorten it by a
    // microsecond — it just makes the other 95% of the session blurry to pay
    // for an event it cannot fix. A median of 8 ms is a machine with enormous
    // headroom, whatever its p95 says, and it should be allowed to spend it.
    //
    // So the median alone decides the climb. The p95 keeps its veto exactly
    // where it is a fill signal — in `late` below, which already requires the
    // median to be elevated too.
    //
    // ---- AND THE SAME ARGUMENT, ONE KNOB DOWN: THE RESOLUTION RATCHET -----
    //
    // The half-credit band used to keep the p95 veto, on the grounds that its
    // headroom is thin enough for spikes to matter. Over a real fifteen-minute
    // session that veto is not occasional, it is permanent, and it closes the
    // only door a machine in that band has. Measured, playing with real keys
    // for fifteen minutes:
    //
    //     cap 1.50 -> 1.35 -> 1.20 -> 1.17     median 61 to 91 fps throughout
    //
    // Monotone. The median never once justified a shrink of that size, but the
    // p95 was over 21 ms in nearly every window — a card laying out KaTeX, a
    // shader compiling the first time a biome is seen, the collector — so
    // `okish` was false in nearly every window, `easy` needs 11.5 ms and was
    // false too, and the cap simply stayed wherever the first bad minute left
    // it. That is 61% of the pixels the game opened with, and it is most of
    // what "it gets uglier the longer you play it" means.
    //
    // Two changes, and they are the same change: a p95 spike only counts
    // against us when the median is genuinely uncomfortable — `mildMs`, the
    // line the half-credit band itself uses — and below that line the median
    // alone decides. The two tests are now mutually exclusive by construction,
    // so the controller cannot shrink and grow against the same window, which
    // is the oscillation the veto was there to prevent.
    const spiky = p95 > this.calmMs;
    this.spikeRun = spiky ? this.spikeRun + 1 : 0;

    // One late window is an event; two in a row is a load. Without this a
    // single card opening costs resolution the session then has to buy back.
    const late = p50 > this.slowMs || (p95 > this.spikeMs && p50 >= this.mildMs && this.spikeRun >= 2);
    const dire = p50 > this.direMs;
    const easy = p50 < this.fastMs;
    // The band between "fast" and "comfortable" is no longer a hole to fall
    // into. It climbs, at half credit, so a machine sitting at 80 fps still
    // gets its effects back — it just takes six windows instead of three.
    const okish = p50 < this.mildMs;

    if (late) { this.bad += dire ? 2 : 1; this.good = 0; }
    else if (easy) { this.good++; this.bad = 0; }
    else if (okish) { this.good += 0.5; this.bad = 0; }
    else { this.bad = 0; this.good = 0; }

    // A machine that has been comfortable for half a minute is not the machine
    // that lost the tier three times during the opening stream-in. Without this
    // the doubling in `patience()` is permanent: three early drops mean every
    // later recovery needs thirty-two unbroken comfortable seconds, and over a
    // long session it never gets them.
    if (easy) {
      if (++this.calmRun >= 30) { this.calmRun = 0; this.tierDrops = Math.max(0, this.tierDrops - 1); }
    } else this.calmRun = 0;

    // ---- DID SPENDING THE PICTURE ACTUALLY BUY ANYTHING? ------------------
    //
    // The reported session is the argument for this whole block. A critic
    // played three minutes and photographed the result:
    //
    //     tier high, 70.9 fps   ->   tier low, 74.6 fps
    //
    // The controller surrendered the volumetric march, two thirds of the bloom
    // pyramid, FXAA and three quarters of the near-field motes, and it bought
    // back three and a half frames a second. The frame was never fill-bound;
    // it was late for a reason a fill-rate knob cannot touch, and the player
    // paid for the diagnosis in picture.
    //
    // So a drop is now a *hypothesis*, and it is tested. When the tier goes
    // down we remember the median that took it, watch the next few windows,
    // and read the result in the purchase's own favour — the BEST median it
    // managed, not the average. If even that is not a tenth of the frame
    // better, the tier was not the lever on this machine: hand it straight
    // back and stop reaching for it. Resolution keeps working either way,
    // because resolution really is fill rate.
    if (this.tierUseless && p50 > this.tierUselessAt * 1.6) {
      this.tierUseless = false;
      this.tierUselessAt = 0;
    }

    if (this.tierProbe) {
      this.tierProbe.best = Math.min(this.tierProbe.best, p50);
      if (--this.tierProbe.left <= 0) {
        const saved = this.tierProbe.before - this.tierProbe.best;
        const gain = saved / this.tierProbe.before;
        // What one step of the effect tier is worth on THIS machine, in
        // milliseconds. Remembering it is the difference between a controller
        // that hands the tier back whenever the frame looks calm — and then
        // takes it away again the moment the effects are switched back on, all
        // session, which is far worse to sit in front of than either state —
        // and one that waits until there is demonstrably room for it.
        if (gain >= 0.10) this.tierCost = Math.max(this.tierCost, saved);
        if (gain < 0.10) {
          this.tierUseless = true;
          // …but "useless" is a verdict about the frame we measured, not a
          // life sentence. If the frame later becomes half again as expensive
          // as the one the probe judged, that is a different machine in a
          // different place — a heavier part of the island, a second tab
          // closing, a phone coming off the charger — and it earns a retry.
          this.tierUselessAt = this.tierProbe.before;
          if (this.tierIndex < TIERS.length - 1) {
            this.tierOwed = Math.max(0, this.tierOwed - 1);
            this.tierDrops = Math.max(0, this.tierDrops - 1);
            this.engine.postFX?.setTier?.(TIERS[this.tierIndex + 1]);
            this.changes++;
            this.cool = 4.0;
          }
        }
        this.tierProbe = null;
      }
    }

    if (this.cool > 0) return;

    // ---- REPAYING THE TIER, ON THE MEASUREMENT THAT TOOK IT ---------------
    //
    // The tier is taken when the median passes `slowMs`. It used to be repaid
    // out of `good`, which needs a median under `mildMs` — a full 3 ms, and on
    // this budget a full 14 fps, BELOW the line that took it. A machine whose
    // steady state sits in that gap (14–16.5 ms, 61–74 fps: a school
    // Chromebook, or any laptop with a second tab in it) therefore loses the
    // tier to its first hitch and can never, for the rest of the session, earn
    // it back. That is a ratchet, and it is what "the game gets uglier the
    // longer you play it" actually means.
    //
    // Repayment is now symmetric with the taking, plus a margin so the two
    // thresholds cannot chatter against each other: a median comfortably
    // inside the budget, held for `patience()` unbroken seconds. Resolution
    // still climbs on its own faster ladder underneath.
    if (this.tierOwed > 0 && !this.tierProbe && this.tierIndex < TIERS.length - 1) {
      // Room for the effects, not merely room for the frame. `tierCost` is
      // what the drop measurably bought, so this is the same comparison the
      // player would make: switching them back on will cost that again.
      if (p50 < this.slowMs * 0.92 - this.tierCost) {
        if (++this.tierGood >= this.patience()) {
          this.tierGood = 0;
          this.tierOwed--;
          this.engine.postFX?.setTier?.(TIERS[this.tierIndex + 1]);
          this.changes++;
          this.cool = 5.0;
          return;
        }
      } else this.tierGood = Math.max(0, this.tierGood - 1);
    }

    if (this.bad >= 2) {
      this.bad = 0;
      // ONE BAD SECOND DOES NOT ERASE FOUR GOOD ONES.
      //
      // This used to be `this.tierGood = 0`, and on a machine with anything
      // else running that single line is why the effect tier never came back:
      // restoring it needs several comfortable windows in a row, a shrink
      // reset the count to zero, and a shrink happens the moment somebody
      // else's compositor spikes. The counter walks back one step instead, so
      // four consecutive shrinks still cancel four good windows — the harsh
      // reading was never the useful one, it was just the easy one to write.
      this.tierGood = Math.max(0, this.tierGood - 1);
      if (this.cap > this.floor + 0.001) {
        this.setCap(this.cap - (dire ? 0.3 : 0.15));
        this.cool = 1.4;
      } else if (++this.tierBad >= 2 && this.tierIndex > 0
                 && !this.tierUseless && !this.tierProbe) {
        this.tierBad = 0;
        // Remember what we are buying with, so the next few windows can say
        // whether the purchase was worth the picture. See THE PROBE above.
        this.tierProbe = { before: p50, best: p50, left: 6 };
        this.engine.postFX?.setTier?.(TIERS[this.tierIndex - 1]);
        this.tierOwed++;
        this.tierDrops++;
        this.changes++;
        this.cool = 3.0;
      }
    } else if (this.good >= 3) {
      this.good = 0;
      this.tierBad = 0;
      // ---- GIVE IT BACK IN THE REVERSE OF THE ORDER IT WAS TAKEN ----
      //
      // A player reported the game sitting at fxTier 'low' eighteen minutes
      // in, on an M4. Reproduced over a real fifteen-minute session
      // (`tools/critic/sustain.mjs`): the tier fell at minute two and was
      // still down at minute fifteen while the frame rate was back at 90.
      //
      // Some of that was leaks elsewhere. This part was here. The ladder DOWN
      // spends resolution first and the tier last — resolution is cheap and
      // the tier is the backstop — and the ladder UP used to climb in the same
      // direction, which means the last thing surrendered was the last thing
      // returned. Every recovery therefore had to buy back the entire
      // resolution range at 0.12 a second, reach the ceiling, and hold four
      // more comfortable seconds before the effects came back at all; any
      // single late window anywhere in that half-minute reset it to the floor.
      // On a machine with anything else running, that is never.
      //
      // An undo stack is LIFO. The tier was taken last, so it comes back
      // first — and it is the more visible of the two by a distance, because
      // it is volumetrics and bloom rather than a fraction of a pixel.
      if (this.tierOwed > 0 && this.tierIndex < TIERS.length - 1) {
        // The tier's own clock runs above, on the measurement that took it.
        // Waiting it out is not a reason to keep looking at a soft image, so
        // resolution climbs while that clock runs — just not in the big steps,
        // which would spend the headroom the tier needs.
        if (this.cap < this.ceiling - 0.001) {
          this.setCap(this.cap + 0.12);
          this.cool = 2.0;
        }
      } else if (this.cap < this.ceiling - 0.001) {
        // Plenty of headroom buys a bigger step. Sharpness is the only thing
        // resolution is for, and taking twenty seconds to find it wastes the
        // first twenty seconds of the game.
        this.setCap(this.cap + (p50 < 8 ? 0.2 : 0.12));
        this.cool = 2.0;
      } else if (++this.tierGood >= 4 && this.tierIndex < TIERS.length - 1) {
        // A tier this controller never took: the post stack simply opened
        // below its ceiling. Climb it the slow way, on a full ceiling.
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
    this.quality.forget();
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
