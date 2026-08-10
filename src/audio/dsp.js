/**
 * The synthesis primitives. Everything this game makes a sound with is built
 * here, from arithmetic — there is not one sample file in the project.
 *
 * Two rules keep the rest of the audio layer honest:
 *
 *  1. Nothing allocates a node it does not schedule a stop for. Every one-shot
 *     voice tears itself down on `ended`, so an hour of play does not end with
 *     four thousand oscillators quietly summing to mud.
 *  2. Every envelope is exponential where the ear is exponential (amplitude,
 *     filter cutoff) and linear where it is not (pan, detune in cents).
 *     `setTargetAtTime` toward zero never actually reaches it, so releases end
 *     on an explicit `linearRampToValueAtTime(0)` before the stop.
 */

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// Buffers
// ---------------------------------------------------------------------------

const cache = new Map();
function memo(key, make) {
  let v = cache.get(key);
  if (!v) { v = make(); cache.set(key, v); }
  return v;
}

/**
 * Noise, in the three colours that matter.
 *
 * White is too bright to be air; real wind and real gravel are much closer to
 * pink, so pink is the default and white is reserved for transient grit.
 * Paul Kellet's filter bank is the pink generator — cheap, and flat to within
 * a fraction of a dB across the audible band.
 */
export function noise(ctx, colour = 'pink', seconds = 4) {
  return memo(`n:${colour}:${seconds}`, () => {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (colour === 'white') { d[i] = w; continue; }
        if (colour === 'brown') { brown = (brown + w * 0.02) / 1.02; d[i] = brown * 3.2; continue; }
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      // A looping buffer whose ends do not match clicks once a second. Cross-
      // fade the seam: the last 40 ms is mixed into the first 40 ms.
      const x = Math.min(2048, n >> 4);
      for (let i = 0; i < x; i++) {
        const k = i / x;
        d[i] = d[i] * k + d[n - x + i] * (1 - k);
      }
    }
    return buf;
  });
}

/**
 * A plucked string, rendered offline by Karplus–Strong.
 *
 * Web Audio cannot build this in the graph: a feedback loop through a
 * DelayNode is quantised to a 128-sample render block, which puts a ceiling of
 * about 340 Hz on the pitch. Computing the delay line by hand costs a few
 * milliseconds once and gives a real string — the attack noise, the inharmonic
 * first 30 ms, and a decay whose highs die before its fundamental does.
 */
export function pluckBuffer(ctx, freq = 220, seconds = 2.6, damp = 0.42, fb = 0.9965) {
  const key = `k:${freq}:${seconds}:${damp}:${fb}`;
  return memo(key, () => {
    const sr = ctx.sampleRate;
    const N = Math.max(4, Math.round(sr / freq));
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const line = new Float32Array(N);
    // A pick is not a click: bandlimit the excitation, or the first millisecond
    // is a spectrum-wide spike that no real plectrum ever produced.
    let s = 0;
    for (let i = 0; i < N; i++) {
      s = s * 0.6 + (Math.random() * 2 - 1) * 0.4;
      line[i] = s * (1 - i / N) ** 0.25;
    }
    let idx = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const cur = line[idx];
      d[i] = cur;
      const y = cur * (1 - damp) + last * damp;
      last = y;
      line[idx] = y * fb;
      idx = idx + 1 === N ? 0 : idx + 1;
    }
    const fade = Math.min(len, sr * 0.25) | 0;
    for (let i = 0; i < fade; i++) d[len - fade + i] *= 1 - i / fade;
    return buf;
  });
}

/**
 * A reverb impulse, grown rather than recorded.
 *
 * Exponentially decaying noise on its own sounds like a cheap plate. What
 * makes it a *place* is three things layered on top: a handful of discrete
 * early reflections in the first 90 ms (which is what the ear reads as room
 * size), progressive damping so the tail gets darker as it dies (air absorbs
 * treble), and a slight decorrelation between the two channels (which is what
 * makes it wide instead of merely loud).
 */
export function impulse(ctx, seconds = 2.8, decay = 2.6, damping = 0.35, spread = 1) {
  return memo(`ir:${seconds}:${decay}:${damping}:${spread}`, () => {
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const env = Math.pow(1 - t, decay);
        const w = (Math.random() * 2 - 1) * env;
        // one-pole whose corner slides down as the tail ages
        const a = clamp(1 - damping * (0.25 + t * 1.4), 0.05, 1);
        lp += a * (w - lp);
        d[i] = lp;
      }
      // early reflections: sparse, panned differently per channel
      const refl = 7;
      for (let r = 0; r < refl; r++) {
        const at = Math.floor(sr * (0.006 + r * 0.011 * spread + (ch ? 0.0031 : 0)) * (1 + r * 0.16));
        if (at < n) d[at] += (0.5 - r * 0.055) * (ch ? -1 : 1) * 0.7;
      }
      // hard silence at the head so the dry signal keeps its own transient
      const pre = Math.floor(sr * 0.004);
      for (let i = 0; i < pre; i++) d[i] *= i / pre;
    }
    return buf;
  });
}

// ---------------------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------------------

export function gain(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }

export function filter(ctx, type, freq, Q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = Q;
  return f;
}

/** StereoPanner where it exists; a silent no-op passthrough where it does not. */
export function panner(ctx, v = 0) {
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(v, -1, 1);
    return p;
  }
  return gain(ctx, 1);
}

/**
 * A looping noise source, started exactly when it is asked for.
 *
 * The `at` argument is not a nicety. A one-shot built out of noise — every
 * footstep, every gust, every grain of scree in this game — schedules its
 * amplitude envelope against an absolute time, so a source that begins some
 * randomly-chosen number of milliseconds *after* that time has already thrown
 * away the front of its own transient. A 3 ms attack and a 55 ms decay losing
 * a random 0–50 ms is the difference between a boot and a rustle, and it is
 * different every step, which is the worst version: the footsteps do not sound
 * varied, they sound broken.
 *
 * Decorrelation between simultaneous grains is what the random offset was
 * actually for, so it is done the correct way instead: two sources that start
 * at the same instant read the same buffer from different places and do not
 * comb-filter each other.
 */
export function noiseSource(ctx, colour = 'pink', rate = 1, at = null) {
  const s = ctx.createBufferSource();
  const buf = noise(ctx, colour);
  s.buffer = buf;
  s.loop = true;
  s.playbackRate.value = rate;
  s.start(Math.max(ctx.currentTime, at ?? ctx.currentTime), Math.random() * buf.duration);
  return s;
}

/**
 * Every buffer this game will ever need, in the order it will need them, one
 * call each. Generating four seconds of stereo white noise is a few
 * milliseconds — cheap, unless it happens on the frame the cadet's boot first
 * meets scree, in which case it is a visible stutter at exactly the moment the
 * player is judging whether the game feels good.
 */
export function warmers(ctx) {
  return [
    () => noise(ctx, 'white'),        // every footstep, every gust
    () => noise(ctx, 'brown'),        // the body of the air
    () => pluckBuffer(ctx, 220, 2.8, 0.38),  // the harp, major
    () => pluckBuffer(ctx, 220, 2.8, 0.5),   // the harp, minor
    () => pluckBuffer(ctx, 220, 2.8, 0.24),  // the resting harp
    () => pluckBuffer(ctx, 220, 2.8, 0.26),  // the seal's roll
    () => pluckBuffer(ctx, 220, 2.8, 0.34),  // its half cadence
  ];
}

/**
 * Percussive amplitude envelope, in the shape the ear expects: an attack that
 * is linear (transients are linear events) and a decay that is exponential
 * (everything that rings is exponential).
 */
export function hit(param, t0, peak, attack, decay, hold = 0) {
  const p = Math.max(1e-4, peak);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(1e-4, t0);
  param.linearRampToValueAtTime(p, t0 + attack);
  if (hold > 0) param.setValueAtTime(p, t0 + attack + hold);
  param.exponentialRampToValueAtTime(1e-4, t0 + attack + hold + decay);
  param.linearRampToValueAtTime(0, t0 + attack + hold + decay + 0.01);
}

/**
 * Sustained envelope: attack, hold at level, release. Returns the time the
 * voice is finally silent, so a scheduler can overlap the next one against it.
 *
 * The shape matters more here than anywhere else in the file, and getting it
 * wrong is not obvious from reading the code — it is obvious from a recording.
 * An exponential ramp from 1e-4 up to 0.07 travels 57 dB: half way through a
 * two-second attack the note is still 28 dB under its own peak, which is
 * inaudible under wind. Written that way, every chord in the score was a
 * three-second blip inside an eight-second slot with a 26 dB hole between it
 * and the next one — a sequence of unconnected swells rather than music. So:
 *
 *   attack   two linear segments, convex, reaching the peak *on time*. This is
 *            what a bowed section does and what a fader does; exponentials
 *            belong to things that ring, not to things that are pushed.
 *   sustain  flat.
 *   release  exponential — that half really is exponential — but down to a
 *            fraction of this note's own peak rather than to an absolute
 *            floor, so a quiet voice does not get a longer tail than a loud
 *            one purely by arithmetic.
 */
export function swell(param, t0, peak, attack, sustain, release) {
  const p = Math.max(1e-4, peak);
  const a = Math.max(0.005, attack);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(0, t0);
  param.linearRampToValueAtTime(p * 0.30, t0 + a * 0.34);
  param.linearRampToValueAtTime(p, t0 + a);
  param.setValueAtTime(p, t0 + a + sustain);
  param.exponentialRampToValueAtTime(p * 0.004, t0 + a + sustain + release);
  param.linearRampToValueAtTime(0, t0 + a + sustain + release + 0.02);
  return t0 + a + sustain + release + 0.04;
}

