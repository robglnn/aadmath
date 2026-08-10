/**
 * Post-processing quality tiers, and the governor that keeps them honest.
 *
 * The rule: **a lower tier must never look broken, only cheaper.** Every tier
 * keeps the same *look* — the grade, the aerial ramp, the volumetrics, the
 * motes, the vignette, the bloom — and pays for it at a different internal
 * resolution and a different step count. Nothing switches off any more. The one
 * effect that used to disappear at the bottom, the dialogue defocus, has been
 * deleted at every tier: it was a lens trick that made the frame worse, and the
 * time it was holding open now pays for air that is in every shot.
 *
 * Cost is spent in this order, most valuable first:
 *
 *   grade + aerial ramp + contact + flare    one fullscreen pass, always
 *   volumetric march                         always, at volumeScale, shadow-fed
 *   bloom pyramid                            always, from bloomScale down
 *   near-field particulate                   always, motes count by tier
 *   FXAA                                     high + medium (we run MSAA-free)
 *
 * On top sits a **resolution governor**: if the frame is late we shrink the
 * drawing buffer before we touch the effect list, because 0.85x of a good image
 * beats 1.0x of a cheap one.
 *
 * `maxPixelRatio` used to cap `high` at 1.6 on a display reporting 2.0 and the
 * governor's floor took another 20% off that, so on every retina laptop the
 * game settled at a 0.64x image bilinearly stretched over the panel. That —
 * not any depth-of-field pass — is what two independent critics were seeing
 * when they called a static frame smeared and unreadable: plaza tiles and tree
 * silhouettes really were gone, because they were never drawn.
 *
 * The ceiling is now 1.75 with a 0.78 floor, so the worst case is 1.365x and
 * the normal case is 87% of native linear resolution — 1.87x the pixels the
 * game was actually shipping. Measured cost of that on this world is about
 * 1.7 ms a frame, paid for by the draw-call and shader work in the same round.
 */

export const TIERS = {
  high: {
    name: 'high',
    bloomScale: 0.5,
    bloomLevels: 5,
    bloomStrength: 0.56,
    bloomThreshold: 1.24,
    bloomKnee: 0.55,
    volumeScale: 0.38,
    volumeSteps: 38,
    volumeStrength: 0.95,
    volumeDensity: 0.0210,
    contact: 0.55,
    fxaa: true,
    aberration: 0.0013,
    grain: 0.020,
    motes: 6000,
    maxPixelRatio: 1.75,
  },
  medium: {
    name: 'medium',
    bloomScale: 0.4,
    bloomLevels: 4,
    bloomStrength: 0.60,
    bloomThreshold: 1.24,
    bloomKnee: 0.55,
    volumeScale: 0.32,
    volumeSteps: 26,
    volumeStrength: 0.95,
    volumeDensity: 0.0210,
    contact: 0.50,
    fxaa: true,
    aberration: 0.0012,
    grain: 0.018,
    motes: 3200,
    maxPixelRatio: 1.5,
  },
  low: {
    name: 'low',
    bloomScale: 0.3,
    bloomLevels: 3,
    bloomStrength: 0.64,
    bloomThreshold: 1.24,
    bloomKnee: 0.55,
    volumeScale: 0.28,
    volumeSteps: 20,
    volumeStrength: 0.95,
    volumeDensity: 0.0210,
    contact: 0.42,
    fxaa: false,
    aberration: 0.0010,
    grain: 0.0,
    motes: 1400,
    maxPixelRatio: 1.35,
  },
};

/** True when the player has asked the OS for less movement. */
export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Watch the reduced-motion setting so a mid-session change is honoured. */
export function onReducedMotionChange(fn) {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const h = () => fn(mq.matches);
  mq.addEventListener?.('change', h);
  return () => mq.removeEventListener?.('change', h);
}

/**
 * Pick a starting tier. Deliberately generous: a desktop display gets `high`,
 * because `high` is budgeted to hold 60 there. The governor handles the
 * machines that turn out not to.
 */
export function pickTier(quality = 1) {
  const small = Math.min(innerWidth, innerHeight) < 520;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (quality <= 0.6 || small) return TIERS.low;
  if (coarse) return TIERS.medium;
  return TIERS.high;
}

/**
 * Frame-time governor.
 *
 * Watches a median-ish frame time and asks for a smaller drawing buffer when we
 * are late, a bigger one when we have headroom. Scale moves in coarse steps
 * with a dead band and a cool-down so it never oscillates, and never goes below
 * `floor` — past that the aliasing costs more than the frame rate buys.
 */
export function makeGovernor({ target = 60, floor = 0.78, onScale } = {}) {
  const budget = 1 / target;
  let scale = 1;
  let acc = 0, n = 0, cool = 1.6;
  let slow = 0, fast = 0;

  return {
    get scale() { return scale; },
    set(s) { scale = Math.min(1, Math.max(floor, s)); onScale?.(scale); },
    reset() { acc = 0; n = 0; slow = 0; fast = 0; cool = 1.6; },
    /** Feed one frame's delta time. */
    tick(dt) {
      if (dt <= 0 || dt > 0.5) return;
      acc += dt; n++;
      cool -= dt;
      if (acc < 0.5) return;
      const avg = acc / n;
      acc = 0; n = 0;

      if (avg > budget * 1.30) { slow++; fast = 0; }
      else if (avg < budget * 1.02) { fast++; slow = 0; }
      else { slow = 0; fast = 0; }

      if (cool > 0) return;
      if (slow >= 2 && scale > floor) {
        scale = Math.max(floor, +(scale - 0.11).toFixed(3));
        slow = 0; cool = 2.2;
        onScale?.(scale);
      } else if (fast >= 6 && scale < 1) {
        scale = Math.min(1, +(scale + 0.06).toFixed(3));
        fast = 0; cool = 3.5;
        onScale?.(scale);
      }
    },
  };
}
