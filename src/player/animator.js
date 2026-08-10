import * as THREE from 'three';
import { LIMB } from './rig.js';

/**
 * Procedural animation for the cadet.
 *
 * The gait is driven by distance travelled, not by a clock, so feet plant where
 * the body actually is and there is no skating at any speed. Legs are solved
 * with two-bone IK against foot targets that are themselves adapted to the
 * ground under them, which is what makes running across a slope read as
 * running across a slope. Every other state (air, glide, dash, mantle, idle) is
 * a pose that blends over the gait by weight.
 */

// pose channel layout — one flat array so blending is a single loop
const N = 30;
const HIP_Y = 0, HIP_X = 1, HIP_YAW = 2, HIP_ROLL = 3,
  SPN_X = 4, SPN_YAW = 5, SPN_ROLL = 6,
  CHS_X = 7, CHS_YAW = 8, CHS_ROLL = 9,
  HED_X = 10, HED_YAW = 11,
  LEG = 12,   // per leg: thighX, shinX, footX, thighZ  (L then R)
  ARM = 20,   // per arm: shoulderX, shoulderZ, shoulderY, elbowX (L then R)
  ROOT_X = 28, ROOT_Z = 29;

/** How far a planted foot may travel front-to-back before the leg runs out. */
const REACH = 1.04;

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;

function blend(dst, src, w) {
  if (w <= 0) return;
  if (w >= 1) { dst.set(src); return; }
  for (let i = 0; i < N; i++) dst[i] += (src[i] - dst[i]) * w;
}

/** Two-bone IK in the sagittal plane. dy is negative (target below the hip). */
function ik(dz, dy, L1, L2, out) {
  let d = Math.hypot(dz, dy);
  d = clamp(d, Math.abs(L1 - L2) + 0.03, L1 + L2 - 0.012);
  const theta = Math.atan2(dz, -dy);
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const b = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  out[0] = -(theta + a);        // thigh rotation.x
  out[1] = Math.PI - b;         // shin rotation.x
  return out;
}

export class Animator {
  constructor(rig) {
    this.rig = rig;
    this.phase = 0;
    this.cur = new Float32Array(N);
    this.tgt = new Float32Array(N);
    this.tmp = new Float32Array(N);
    this._ik = [0, 0];
    this.onStep = null;

    this.flip = 0; this.flipV = 0;
    this.swing = 0; this.swingV = 0;      // body pendulum under the wing
    this.squash = 0; this.squashV = 0;
    this.breath = Math.random() * 6.28;
    this.idleT = 0;
    this.lookYaw = 0; this.lookPitch = 0;
    this._scarf = [];
    for (let i = 0; i < rig.scarf.length; i++) this._scarf.push({ x: 0, z: 0 });
    this.stepImpulse = 0;
  }

  /** A land, from the locomotion event. The pose does the acting now; this is
   *  the extra half-frame of compression that sells the first contact. */
  land(power) {
    this.squashV -= 2.2 * clamp(power, 0, 1) + 0.5;
  }

  frontflip() { this.flipV = -14.0; }

  update(dt, s) {
    const t = this.tgt, tmp = this.tmp;

    // ---- gait phase, advanced by ground distance ----
    // cadence comes first, stride follows from it, and the stance fraction is
    // then whatever keeps the planted foot inside the leg's reach. That is the
    // whole trick behind "no foot skating at any speed".
    const sn = clamp(s.speedN, 0, 1);
    const cycle = lerp(1.15, 0.42, Math.pow(sn, 0.6));
    const stride = Math.max(0.55, s.speed * cycle);
    this.duty = clamp(REACH / stride, 0.17, 0.66);
    this.travel = stride * this.duty;
    const moving = s.grounded && s.speed > 0.45;
    const prev = this.phase;
    // Standing still, the phase *stops*. Letting it creep on at 0.16 Hz meant
    // every channel driven by it kept oscillating under an idle that is
    // supposed to be a planted stance.
    if (moving) this.phase = (this.phase + (s.speed / stride) * dt) % 1;
    if (moving) {
      // footfalls: one at each half-cycle
      if (crossed(prev, this.phase, 0)) this.onStep?.(0, clamp(s.speedN, 0.25, 1));
      if (crossed(prev, this.phase, 0.5)) this.onStep?.(1, clamp(s.speedN, 0.25, 1));
    }

    // pendulum: the harness lets the body swing behind a dive and ahead of a
    // flare, and it keeps swinging for a moment after the wing has settled
    const swingWant = clamp(-s.glidePitch * 1.15, -0.85, 0.85) * (s.glideW || 0);
    this.swingV += (swingWant - this.swing) * 46 * dt - this.swingV * 6.2 * dt;
    this.swing += this.swingV * dt;

    this._gait(t, s, dt);

    const airW = clamp(1 - s.groundW, 0, 1);
    if (airW > 0.001) { this._air(tmp, s); blend(t, tmp, airW); }
    if (s.glideW > 0.001) { this._glide(tmp, s); blend(t, tmp, s.glideW); }
    if (s.dashW > 0.001) { this._dash(tmp, s); blend(t, tmp, s.dashW); }
    if (s.mantleW > 0.001) { this._mantle(tmp, s); blend(t, tmp, s.mantleW); }
    // Recovery poses have the last word: they are the impact frames, and a
    // blend that lets the run cycle bleed through them is a blend that reads
    // as "nothing happened".
    if (s.landW > 0.001) { this._landPose(tmp, s); blend(t, tmp, s.landW); }
    if (s.skidW > 0.001) { this._skid(tmp, s); blend(t, tmp, s.skidW); }

    // whole-body flip on the second jump
    this.flipV += (0 - this.flip) * 40 * dt - this.flipV * 3.4 * dt;
    this.flip += this.flipV * dt;
    if (Math.abs(this.flip) < 0.004 && Math.abs(this.flipV) < 0.05) { this.flip = 0; this.flipV = 0; }
    t[ROOT_X] += this.flip;
    t[ROOT_Z] += s.rollTarget;

    // ---- smoothing: fast enough to be crisp, slow enough to have mass ----
    const k = 1 - Math.exp(-(s.grounded ? 26 : 16) * dt);
    for (let i = 0; i < N; i++) this.cur[i] += (t[i] - this.cur[i]) * k;

    this._apply(dt, s);
    this._scarfSim(dt, s);
  }

  // ------------------------------------------------------------------
  _gait(p, s, dt) {
    const sn = clamp(s.speedN, 0, 1);
    const run = smooth(sn, 0.08, 0.55);
    const ph = this.phase;
    const tau = Math.PI * 2;

    // hips: two bobs per cycle, lowest at each footstrike
    const bobAmp = lerp(0.018, 0.10, sn);
    p[HIP_Y] = -bobAmp * (0.5 + 0.5 * Math.cos(ph * tau * 2)) - lerp(0, 0.055, run);
    p[HIP_X] = 0;
    p[HIP_YAW] = Math.sin(ph * tau) * lerp(0.04, 0.20, sn);
    p[HIP_ROLL] = Math.cos(ph * tau) * lerp(0.02, 0.075, sn);

    // torso leans into speed and into acceleration
    const lean = lerp(0.045, 0.36, Math.pow(sn, 1.15)) + clamp(s.accelLean, -0.16, 0.30);
    p[SPN_X] = lean + s.slopePitch * 0.55;
    p[SPN_YAW] = -p[HIP_YAW] * 0.55 + clamp(-s.turnRate * 0.05, -0.22, 0.22);
    p[SPN_ROLL] = -p[HIP_ROLL] * 0.7 - s.slopeRoll * 0.4;
    p[CHS_X] = Math.sin(ph * tau * 2) * 0.035 * run - lean * 0.18;
    p[CHS_YAW] = -Math.sin(ph * tau) * lerp(0.05, 0.26, sn);
    p[CHS_ROLL] = clamp(s.turnRate * 0.045, -0.2, 0.2);
    // the head stays level and looks where the camera looks
    p[HED_X] = -(p[SPN_X] + p[CHS_X]) * 0.82 + this.lookPitch * 0.45;
    p[HED_YAW] = this.lookYaw * 0.55 - p[CHS_YAW] * 0.6;

    // ---- legs ----
    const duty = this.duty;
    const reachF = this.travel * 0.55;
    const reachB = this.travel * 0.45;
    const lift = lerp(0.045, 0.30, sn);
    const hipJointY = LIMB.hipY + p[HIP_Y] - 0.09;

    for (let i = 0; i < 2; i++) {
      const lp = (ph + (i === 0 ? 0 : 0.5)) % 1;
      let fz, fy, pitch;
      if (lp < duty) {
        const u = lp / duty;
        fz = lerp(reachF, -reachB, u);
        fy = 0;
        // heel strike rolls into toe-off
        pitch = lerp(-0.28, 0.55, smooth(u, 0.55, 1)) * run + (1 - run) * 0;
        if (u < 0.16) pitch = lerp(-0.30 * run, 0, u / 0.16);
      } else {
        const u = (lp - duty) / (1 - duty);
        fz = lerp(-reachB, reachF, smoothstep2(u));
        fy = Math.sin(Math.PI * u) * lift;
        pitch = lerp(0.45, -0.30, smooth(u, 0.15, 0.85)) * run;
      }
      // ground adaptation: the planted foot follows the terrain under it
      const gd = s.groundDelta ? s.groundDelta(i === 0 ? -0.115 : 0.115, fz) : 0;
      const dy = (fy + gd + 0.092) - hipJointY;
      const r = ik(fz, Math.min(dy, -0.14), LIMB.thigh, LIMB.shin, this._ik);
      const b = LEG + i * 4;
      p[b] = r[0];
      p[b + 1] = r[1];
      p[b + 2] = -(r[0] + r[1]) + pitch;
      p[b + 3] = (i === 0 ? -1 : 1) * lerp(0.02, 0.06, sn);
    }

    // ---- arms: counter-swing, elbow tightens with speed ----
    // The elbow never fully straightens at pace — a runner's forearm stays
    // folded near ninety degrees and the swing happens at the shoulder.
    const swing = lerp(0.20, 1.05, Math.pow(sn, 0.85));
    const elbow = lerp(0.45, 1.62, Math.pow(sn, 0.7));
    for (let i = 0; i < 2; i++) {
      const a = ARM + i * 4;
      const sgn = i === 0 ? -1 : 1;   // +z rotation swings a limb toward +x
      const sw = Math.sin((ph + (i === 0 ? 0.5 : 0)) * tau);   // opposite the same-side leg
      p[a] = -sw * swing - lean * 0.40 - lerp(0.05, 0.28, sn);
      // Abduction — how far the upper arm is held out from the ribs. This is a
      // silhouette control, not an anatomy one: at eight degrees the arms sat
      // inside the outline of the torso, the pauldrons welded themselves to the
      // chest shell, and from six metres behind the cadet was one solid slab
      // with no daylight in it. Negative space between the arm and the body is
      // the single cheapest thing that makes a character read at distance, and
      // a man in armour this bulky could not put his arms down that far anyway.
      p[a + 1] = sgn * (lerp(0.27, 0.35, sn) + Math.max(0, sw) * 0.09);
      p[a + 2] = -sgn * lerp(0.04, 0.26, sn) * (0.5 + sw * 0.5);
      p[a + 3] = elbow + Math.max(0, -sw) * elbow * 0.42;
    }

    // ---- idle ----
    //
    // Two things were wrong here and both of them read as "mannequin".
    //
    // The gait phase kept advancing at 0.16 Hz while standing still, so the
    // legs scissored back and forth through a fifth of a metre on a six-second
    // loop — a slow-motion walk on the spot, which is uncannier than no
    // animation at all. Standing is now a *stance*, solved once: feet apart,
    // one forward, the far knee soft, and it does not travel.
    //
    // And the stance itself was symmetrical — heels together, shoulders square.
    // Nobody stands like that. The weight sits over one leg and shifts to the
    // other every few seconds, which is what all of the sway below is now
    // hung off.
    if (!moving(s)) {
      this.idleT += dt;
      this.breath += dt * 1.35;
      const b = Math.sin(this.breath);
      const w = 1 - smooth(s.speed, 0.2, 1.4);
      // the weight shift: a slow settle onto one leg, held, then the other
      const wob = Math.sin(this.idleT * 0.42);
      const shift = Math.sign(wob) * Math.pow(Math.abs(wob), 0.55);   // held at the ends
      const sway = shift;

      p[HIP_Y] += (b * 0.012 - 0.028) * w;
      p[HIP_ROLL] += sway * 0.075 * w;
      p[HIP_YAW] += sway * 0.045 * w + 0.05 * w;
      p[SPN_X] += (0.035 + b * 0.02) * w;
      p[SPN_ROLL] += -sway * 0.055 * w;
      p[CHS_X] += b * 0.03 * w;
      p[CHS_ROLL] += -sway * 0.035 * w;
      p[CHS_YAW] += -0.05 * w;
      // an idle break: every eleven seconds he checks the horizon
      const scan = Math.sin(this.idleT * 0.57) * Math.max(0, Math.sin(this.idleT * 0.093));
      p[HED_YAW] += scan * 0.55 * w;
      p[HED_X] += -Math.abs(scan) * 0.10 * w;

      // ---- the stance: planted, asymmetric, and not going anywhere ----
      const hipJointYi = LIMB.hipY + p[HIP_Y] - 0.09;
      for (let i = 0; i < 2; i++) {
        const bI = LEG + i * 4;
        // left foot back and taking the weight when the shift is left, and the
        // reverse — so the whole body genuinely swaps which leg is loaded
        const load = i === 0 ? 0.5 - shift * 0.5 : 0.5 + shift * 0.5;
        const fz = (i === 0 ? -0.075 : 0.115);
        const gd = s.groundDelta ? s.groundDelta(i === 0 ? -0.135 : 0.135, fz) : 0;
        const dy = (gd + 0.092) - hipJointYi;
        const r = ik(fz, Math.min(dy, -0.14), LIMB.thigh, LIMB.shin, this._ik);
        // the unloaded leg keeps a softer knee, which is what stops the two
        // legs reading as one mirrored pair of sticks
        const soft = (1 - load) * 0.13;
        p[bI] += (r[0] - soft * 0.6 - p[bI]) * w;
        p[bI + 1] += (r[1] + soft - p[bI + 1]) * w;
        p[bI + 2] += (-(r[0] + r[1]) - soft * 0.4 - p[bI + 2]) * w;
        // feet turned out and set wider than the hips — a stance, not a plinth
        p[bI + 3] += ((i === 0 ? -1 : 1) * (0.085 + load * 0.03) - p[bI + 3]) * w;
      }

      for (let i = 0; i < 2; i++) {
        const a = ARM + i * 4;
        const sgn = i === 0 ? -1 : 1;   // +z rotation swings a limb toward +x
        p[a] += (-0.06 + b * 0.03 + sgn * shift * 0.05) * w;
        p[a + 1] += sgn * 0.07 * w;
        p[a + 3] += (0.34 + b * 0.05 - sgn * shift * 0.10) * w;
      }
    } else this.idleT = 0;

    p[ROOT_X] = 0; p[ROOT_Z] = 0;
  }

  _air(p, s) {
    const rise = clamp(s.vy / 9, -1, 1);
    const up = Math.max(0, rise), down = Math.max(0, -rise);
    p[HIP_Y] = 0.02;
    p[HIP_X] = 0; p[HIP_YAW] = 0; p[HIP_ROLL] = 0;
    p[SPN_X] = 0.22 * up + 0.06 * down + clamp(s.accelLean, -0.2, 0.35);
    p[SPN_YAW] = clamp(-s.turnRate * 0.06, -0.3, 0.3);
    p[SPN_ROLL] = clamp(s.turnRate * 0.05, -0.25, 0.25);
    p[CHS_X] = -0.12 * down;
    p[CHS_YAW] = 0; p[CHS_ROLL] = 0;
    p[HED_X] = -0.12 + 0.22 * down + this.lookPitch * 0.4;
    p[HED_YAW] = this.lookYaw * 0.5;

    // tuck hard on the way up, reach and split on the way down
    const tuckT = [[-1.35, 2.10, -0.45], [-0.85, 1.65, -0.30]];
    const fallT = [[-0.78, 1.10, 0.18], [0.62, 0.42, -0.22]];
    for (let i = 0; i < 2; i++) {
      const b = LEG + i * 4;
      const f = fallT[i], t2 = tuckT[i];
      p[b] = lerp(f[0], t2[0], up) + Math.sin(s.airTime * 6 + i * 3.1) * 0.06;
      p[b + 1] = lerp(f[1], t2[1], up);
      p[b + 2] = lerp(f[2], t2[2], up);
      p[b + 3] = (i === 0 ? -1 : 1) * 0.16;
    }
    // Arms in the air. Straight out sideways is a T-pose, and a T-pose in mid
    // air is the single loudest tell that a character is a rig and not a
    // person: the arms stay close to the body, asymmetric, elbows bent, one
    // leading. Falling opens them a little for balance, never past 40 degrees.
    const flail = Math.sin(s.airTime * 5.2) * 0.10 * down;
    for (let i = 0; i < 2; i++) {
      const a = ARM + i * 4;
      const sgn = i === 0 ? -1 : 1;
      const lead = i === 0 ? 1 : -1;
      p[a] = lerp(-0.55, -1.55, up) - down * 0.30 + lead * (0.30 * down + 0.12) + flail * lead;
      p[a + 1] = sgn * (lerp(0.34, 0.26, up) + down * 0.30);
      p[a + 2] = -sgn * (0.30 + down * 0.16);
      p[a + 3] = lerp(1.05, 1.75, up) + down * 0.35 + lead * 0.22;
    }
    p[ROOT_X] = 0; p[ROOT_Z] = 0;
  }

  /**
   * Hanging in a harness, not standing in the air.
   *
   * The body swings under the wing like a pendulum — a dive throws the legs
   * back and the hips forward, a flare swings them under and ahead — and the
   * arms are *not* posed here at all: `gripBar()` solves them onto the real
   * control bar afterwards, so the hands are on the wing by construction
   * instead of by a hand-tuned Euler angle that drifts the moment the wing
   * moves.
   */
  _glide(p, s) {
    const pitch = s.glidePitch;
    // pendulum: lags the wing's attitude, so pitching in makes the body swing
    const swing = this.swing;
    const flap = Math.sin(s.time * 2.3) * 0.035 + Math.sin(s.time * 3.7) * 0.02;
    p[HIP_Y] = 0.02;
    p[HIP_X] = 0.06 + swing * 0.10; p[HIP_YAW] = 0; p[HIP_ROLL] = -s.glideRoll * 0.14;
    p[SPN_X] = 0.16 + swing * 0.55 + flap;
    p[SPN_YAW] = s.glideRoll * 0.10; p[SPN_ROLL] = -s.glideRoll * 0.22;
    p[CHS_X] = 0.06 + swing * 0.16;
    p[CHS_YAW] = 0; p[CHS_ROLL] = -s.glideRoll * 0.12;
    p[HED_X] = -0.30 - pitch * 0.55 - swing * 0.4 + this.lookPitch * 0.3;
    p[HED_YAW] = s.glideRoll * 0.28 + this.lookYaw * 0.3;
    // legs trail behind and stream: never straight, never symmetric — a person
    // hanging in a harness has one knee up and one leg long, and both drift
    for (let i = 0; i < 2; i++) {
      const b = LEG + i * 4;
      const sgn = i === 0 ? -1 : 1;
      const s2 = Math.sin(s.time * 1.7 + i * 1.9);
      const bias = i === 0 ? 1 : 0.42;
      p[b] = 0.86 - swing * 1.05 + s2 * 0.09 + bias * 0.26;
      p[b + 1] = 0.72 + bias * 0.62 + Math.max(0, swing) * 0.6;
      p[b + 2] = -0.52 + s2 * 0.10;
      p[b + 3] = sgn * (0.13 + s.glideRoll * 0.07);
    }
    // arms are placeholders; gripBar() overwrites them with the real solve
    for (let i = 0; i < 2; i++) {
      const a = ARM + i * 4;
      const sgn = i === 0 ? -1 : 1;
      p[a] = -2.55; p[a + 1] = sgn * 0.22; p[a + 2] = -sgn * 0.08; p[a + 3] = 0.28;
    }
    p[ROOT_X] = pitch * 0.30 + swing * 0.22;
    p[ROOT_Z] = 0;
  }

  /**
   * The landing recovery. One deep absorb over ~0.1s, then a long extension
   * with a little overshoot — the shape a body actually makes when a drop goes
   * through the knees. `power` scales it from a step-off to a two-storey fall,
   * where the hand goes down and takes some of it.
   */
  _landPose(p, s) {
    const u = clamp(s.landU, 0, 1);
    const pw = clamp(s.landPower, 0, 1);
    // absorb hard, extend slow, with a small bounce past neutral at the end
    // compress in a tenth, hold folded for a quarter, extend over the rest
    const amp = u < 0.09 ? smooth(u / 0.09, 0, 1)
      : u < 0.42 ? 1
        : Math.pow(1 - (u - 0.42) / 0.58, 1.6) - 0.08 * Math.sin((u - 0.42) / 0.58 * Math.PI) * (1 - pw * 0.4);
    const a = clamp(amp, -0.2, 1) * (0.55 + pw * 0.45);
    const hand = smooth(pw, 0.45, 1) * a;      // heavy landings put a hand down

    p[HIP_Y] = -0.42 * a;
    p[HIP_X] = 0.10 * a; p[HIP_YAW] = -0.10 * hand; p[HIP_ROLL] = 0;
    p[SPN_X] = 0.52 * a + 0.30 * hand;
    p[SPN_YAW] = 0.16 * hand; p[SPN_ROLL] = 0.10 * hand;
    p[CHS_X] = 0.20 * a;
    p[CHS_YAW] = -0.12 * hand; p[CHS_ROLL] = 0;
    p[HED_X] = -0.30 * a + this.lookPitch * 0.3;
    p[HED_YAW] = this.lookYaw * 0.4;

    for (let i = 0; i < 2; i++) {
      const b = LEG + i * 4;
      const stagger = i === 0 ? 1 : 0.78;       // the two legs never fold alike
      p[b] = -1.22 * a * stagger + 0.16 * a;
      p[b + 1] = 2.10 * a * stagger;
      p[b + 2] = -0.62 * a * stagger + 0.18 * a;
      p[b + 3] = (i === 0 ? -1 : 1) * (0.10 + 0.16 * a);
    }
    // Left arm reaches down to the ground on a heavy landing, right counters up.
    // Both are kept *in front of* the body rather than flung out sideways: two
    // arms straight out level with the shoulders is a T-pose with a crouch under
    // it, which is what this used to look like at the moment of impact.
    const aL = ARM, aR = ARM + 4;
    p[aL] = -0.30 * a + 1.55 * hand;
    p[aL + 1] = -(0.30 * a + 0.12 * hand);
    p[aL + 2] = 0.35 * hand;
    p[aL + 3] = 0.60 * a - 0.35 * hand;
    p[aR] = -1.05 * a - 0.55 * hand;
    p[aR + 1] = 0.42 * a + 0.18 * hand;
    p[aR + 2] = -0.20 * a;
    p[aR + 3] = 1.15 * a + 0.45 * hand;

    p[ROOT_X] = 0.06 * a; p[ROOT_Z] = 0.10 * hand;
  }

  /**
   * A stop from sprint: the front boot plants and ploughs, the hips slide out
   * ahead of the shoulders, the torso pitches back against the momentum, and
   * the arms come out for balance.
   */
  _skid(p, s) {
    const w = clamp(s.skidU, 0, 1);            // 0 fresh → 1 recovered
    const a = Math.pow(1 - w, 0.7);
    const pw = clamp(s.skidPower, 0.3, 1);
    const k = a * pw;
    const wob = Math.sin(s.time * 22) * 0.02 * k;

    p[HIP_Y] = -0.16 * k;
    p[HIP_X] = -0.10 * k; p[HIP_YAW] = 0.22 * k; p[HIP_ROLL] = -0.10 * k;
    p[SPN_X] = -0.30 * k + wob;             // leaning back against the slide
    p[SPN_YAW] = -0.30 * k; p[SPN_ROLL] = 0.14 * k;
    p[CHS_X] = -0.10 * k;
    p[CHS_YAW] = -0.16 * k; p[CHS_ROLL] = 0.10 * k;
    p[HED_X] = 0.14 * k + this.lookPitch * 0.4;
    p[HED_YAW] = this.lookYaw * 0.5 + 0.18 * k;

    // front leg straight and forward with the heel down; back leg tucked under
    const front = LEG, back = LEG + 4;
    p[front] = -0.78 * k; p[front + 1] = 0.30 * k; p[front + 2] = -0.46 * k + 0.18;
    p[front + 3] = -0.12 - 0.10 * k;
    p[back] = 0.52 * k; p[back + 1] = 1.15 * k; p[back + 2] = -0.30 * k;
    p[back + 3] = 0.12 + 0.14 * k;

    const aL = ARM, aR = ARM + 4;
    p[aL] = -0.30 - 0.45 * k; p[aL + 1] = -(0.62 * k + 0.16); p[aL + 2] = 0.30 * k; p[aL + 3] = 0.95 + 0.35 * k;
    p[aR] = -0.30 - 1.05 * k; p[aR + 1] = 0.55 * k + 0.16; p[aR + 2] = -0.34 * k; p[aR + 3] = 0.95 + 0.70 * k;

    p[ROOT_X] = -0.05 * k; p[ROOT_Z] = 0;
  }

  _dash(p, s) {
    p[HIP_Y] = -0.03;
    p[HIP_X] = 0; p[HIP_YAW] = 0; p[HIP_ROLL] = 0;
    p[SPN_X] = 0.62; p[SPN_YAW] = 0; p[SPN_ROLL] = 0;
    p[CHS_X] = 0.12; p[CHS_YAW] = 0; p[CHS_ROLL] = 0;
    p[HED_X] = -0.5; p[HED_YAW] = 0;
    const legs = [[-0.72, 1.15, -0.15], [0.62, 0.95, -0.25]];
    for (let i = 0; i < 2; i++) {
      const b = LEG + i * 4, L = legs[i];
      p[b] = L[0]; p[b + 1] = L[1]; p[b + 2] = L[2];
      p[b + 3] = (i === 0 ? -1 : 1) * 0.08;
    }
    for (let i = 0; i < 2; i++) {
      const a = ARM + i * 4, sgn = i === 0 ? 1 : -1;
      p[a] = i === 0 ? 1.35 : -1.25;
      p[a + 1] = sgn * 0.28;
      p[a + 2] = 0;
      p[a + 3] = i === 0 ? 0.30 : 1.05;
    }
    p[ROOT_X] = 0; p[ROOT_Z] = 0;
  }

  _mantle(p, s) {
    const u = s.mantleU;                  // 0..1
    const pull = smooth(u, 0.0, 0.55);
    const push = smooth(u, 0.45, 1.0);
    p[HIP_Y] = -0.05 + 0.06 * push;
    p[HIP_X] = 0; p[HIP_YAW] = 0; p[HIP_ROLL] = 0;
    p[SPN_X] = lerp(0.30, 0.55, pull) - push * 0.45;
    p[SPN_YAW] = 0; p[SPN_ROLL] = 0;
    p[CHS_X] = 0.1; p[CHS_YAW] = 0; p[CHS_ROLL] = 0;
    p[HED_X] = -0.35; p[HED_YAW] = 0;
    for (let i = 0; i < 2; i++) {
      const b = LEG + i * 4;
      const tuck = i === 0 ? 1 : 0.55;
      p[b] = lerp(-0.35, -1.35 * tuck, pull) + push * (1.05 * tuck);
      p[b + 1] = lerp(0.6, 1.85, pull) - push * 1.25;
      p[b + 2] = -0.2;
      p[b + 3] = (i === 0 ? -1 : 1) * 0.16;
    }
    for (let i = 0; i < 2; i++) {
      const a = ARM + i * 4, sgn = i === 0 ? 1 : -1;
      p[a] = lerp(-2.65, -0.55, push);
      p[a + 1] = sgn * 0.30;
      p[a + 2] = 0;
      p[a + 3] = lerp(0.22, 1.5, push);
    }
    p[ROOT_X] = 0; p[ROOT_Z] = 0;
  }

  // ------------------------------------------------------------------
  _apply(dt, s) {
    const c = this.cur, r = this.rig;
    r.hips.position.y = LIMB.hipY + c[HIP_Y];
    r.hips.position.z = c[HIP_X];
    r.hips.rotation.set(0, c[HIP_YAW], c[HIP_ROLL]);
    r.spine.rotation.set(c[SPN_X], c[SPN_YAW], c[SPN_ROLL]);
    r.chest.rotation.set(c[CHS_X], c[CHS_YAW], c[CHS_ROLL]);
    r.head.rotation.set(c[HED_X], c[HED_YAW], 0);

    const legs = [r.legL, r.legR];
    for (let i = 0; i < 2; i++) {
      const b = LEG + i * 4, L = legs[i];
      L.thigh.rotation.x = c[b];
      L.thigh.rotation.z = c[b + 3];
      L.shin.rotation.x = c[b + 1];
      L.foot.rotation.x = c[b + 2];
    }
    const arms = [r.armL, r.armR];
    for (let i = 0; i < 2; i++) {
      const a = ARM + i * 4, A = arms[i];
      A.upper.rotation.set(c[a], c[a + 2], c[a + 1]);
      A.fore.rotation.x = c[a + 3];
    }

    // squash & stretch — a spring, so the recovery has a little bounce in it
    this.squashV += (0 - this.squash) * 260 * dt - this.squashV * 21 * dt;
    this.squash += this.squashV * dt;
    this.squash = clamp(this.squash, -0.38, 0.16);
    const sq = this.squash;
    r.root.scale.set(1 - sq * 0.55, 1 + sq, 1 - sq * 0.55);
    r.pivot.rotation.x = c[ROOT_X];
    r.pivot.rotation.z = c[ROOT_Z];

    // visor and trim brighten with effort
    // The lit surfaces all share one material now, and it is multiplied by the
    // palette rather than tinted per part, so the useful range is much smaller:
    // past about 2.5 every light on him clips to white and the colour is gone.
    const glow = 1.05 + s.speedN * 0.7 + s.dashW * 1.4;
    r.mats.trim.emissiveIntensity += (glow - r.mats.trim.emissiveIntensity) * Math.min(1, dt * 6);
    r.mats.visor.emissiveIntensity = 0.7 + s.speedN * 0.5;
  }

  /**
   * Put both hands on the control bar, for real.
   *
   * Everything else in this file is a hand-authored pose; this is the one place
   * that has to be geometrically true, because a glider the cadet is not
   * holding is a glider glued to his back. Two-bone analytic IK: aim the upper
   * arm along the shoulder→grip line, pre-rotate by the half-angle the bent
   * elbow introduces, twist the plane so the elbows flare outward.
   *
   * Call after the pose has been applied and after the glider's matrices are up
   * to date — the target is read from the actual bar mesh, not a guess at it.
   */
  gripBar(glider, w, twist = 0.5) {
    if (w <= 0.02) return;
    const r = this.rig;
    r.root.updateMatrixWorld(true);
    const L1 = LIMB.upperArm, L2 = LIMB.foreArm + 0.03;
    const wk = clamp(w, 0, 1);
    for (let i = 0; i < 2; i++) {
      const A = i === 0 ? r.armL : r.armR;
      const side = i === 0 ? -1 : 1;
      glider.gripAt(side, _tgt);
      A.shoulder.matrixWorld.decompose(_sp, _sq, _ss);
      _inv.copy(_sq).invert();
      _d.copy(_tgt).sub(_sp).applyQuaternion(_inv);
      const sc = Math.max(0.2, (_ss.x + _ss.y + _ss.z) / 3);
      _d.multiplyScalar(1 / sc);

      let dist = _d.length();
      if (dist < 1e-5) continue;
      dist = clamp(dist, Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.004);
      _d.normalize();

      const cosB = clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1);
      const bend = Math.PI - Math.acos(cosB);
      const alpha = Math.atan2(L2 * Math.sin(bend), L1 + L2 * Math.cos(bend));

      _qPose.copy(A.upper.quaternion);
      _qA.setFromUnitVectors(_down, _d);
      _qB.setFromAxisAngle(_xAxis, alpha);
      _qT.setFromAxisAngle(_d, side * twist);
      A.upper.quaternion.copy(_qT).multiply(_qA).multiply(_qB);
      if (wk < 1) A.upper.quaternion.slerpQuaternions(_qPose, A.upper.quaternion, wk);

      A.fore.rotation.x = lerp(A.fore.rotation.x, -bend, wk);
      A.fore.rotation.y = lerp(A.fore.rotation.y, 0, wk);
      A.fore.rotation.z = lerp(A.fore.rotation.z, 0, wk);
      A.hand.rotation.z = lerp(A.hand.rotation.z, -side * 0.28, wk);
      A.hand.rotation.x = lerp(A.hand.rotation.x, 0.30, wk);
    }
  }

  _scarfSim(dt, s) {
    // trailing cloth: each link chases the one above it against airflow
    // Cloth as one bend, distributed down the chain.
    //
    // Each link rotates relative to its parent, so giving every link the same
    // angle does not bend the scarf — it coils it. (It did: at a sprint the old
    // sim accumulated about six radians and rolled the scarf into a spiral that
    // came out of the cadet's chest.) The total bend is authored once and the
    // weights below spend it along the chain, most at the collar, least at the
    // tip, which is also how a real trailing cloth actually breaks.
    const air = s.localVel;
    const n = this.rig.scarf.length;
    const flow = Math.hypot(air.x, air.z) + Math.abs(s.vy) * 0.55;
    const bank = clamp(flow / 11, 0, 1.5);
    // +rotation.x lays the scarf back over the shoulders, which is the way the
    // airflow goes; the small resting value is gravity plus the collar
    // At rest this used to hold a third of a radian of bend per link, which laid
    // the mantle out behind him like a board on a shelf while he was standing
    // perfectly still. Cloth at rest hangs; the wind is what lifts it.
    // The ceiling matters more than it looks. Past about a radian and a half of
    // total bend the mantle is lying flat behind him, and once it is flat, every
    // link's *roll* has become a *yaw* — the chain's own z axis has rotated to
    // near-vertical — so the lateral flutter below stops rippling the cloth and
    // starts swinging the whole thing out sideways. Which is what it did: at a
    // sprint the mantle came off his ribs like a plank nailed across his chest.
    // Capped here it trails at forty-odd degrees and stays cloth.
    const wantX = clamp(0.20 + air.z * 0.105 + Math.max(0, -s.vy) * 0.028 + bank * 0.30, -0.4, 1.50);
    // A scarf that only ever bends fore-and-aft is a windsock. The lateral term
    // is what makes it *cloth*: it leans out of a turn, and at speed it sways
    // across the back on its own slow beat.
    const sway = Math.sin(s.time * 2.3) * 0.13 * clamp(s.speedN * 1.4, 0, 1);
    const wantZ = clamp(-air.x * 0.042 + sway + clamp(s.turnRate * 0.07, -0.3, 0.3), -0.6, 0.6);
    for (let i = 0; i < n; i++) {
      const seg = this.rig.scarf[i];
      const st = this._scarf[i];
      // Two flutters, not one. The fast term is airflow and dies when he stops;
      // the slow one is a breeze, and it is the reason the scarf is still alive
      // while the cadet stands still. Without it the cloth freezes into a plank
      // the moment the player lets go of the stick.
      const flutter = Math.sin(s.time * (6.5 + i * 1.4) + i * 1.9) * 0.16 * bank
        + Math.sin(s.time * (1.5 + i * 0.31) + i * 2.4) * 0.11;
      const k = Math.min(1, dt * (17 - i * 1.4));       // the tip lags the collar
      st.x += (wantX + flutter - st.x) * k;
      st.z += (wantZ + flutter * 0.6 - st.z) * k;
      const w = WEIGHT[i] ?? 0.05;
      // KINK is the rest shape. It has to be added here rather than authored
      // into the rig, because this line overwrites the joint every frame — a
      // rest pose set at build time is wiped on frame one.
      seg.rotation.x = st.x * w;
      seg.rotation.z = st.z * w + KINK[i % KINK.length];
    }
  }
}

/** How the scarf's single total bend is spent along its seven links. */
const WEIGHT = [0.30, 0.23, 0.17, 0.12, 0.09, 0.06, 0.03];
/** The rest-shape zigzag: cloth hangs in a lazy S, never in a straight line. */
const KINK = [0.0, 0.09, -0.11, 0.10, -0.09, 0.08, -0.06];

// scratch for the arm IK — allocation-free, this runs twice a frame
const _tgt = new THREE.Vector3();
const _sp = new THREE.Vector3();
const _ss = new THREE.Vector3();
const _d = new THREE.Vector3();
const _sq = new THREE.Quaternion();
const _inv = new THREE.Quaternion();
const _qPose = new THREE.Quaternion();
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _qT = new THREE.Quaternion();
const _down = new THREE.Vector3(0, -1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);

function moving(s) { return s.grounded && s.speed > 0.5; }
function smoothstep2(u) { return u * u * (3 - 2 * u); }
function crossed(a, b, at) {
  if (b >= a) return a < at && b >= at;
  return a < at || b >= at;    // wrapped
}
