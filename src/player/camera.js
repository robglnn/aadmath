import * as THREE from 'three';
import { heightAt } from './terrain.js';
// Built structure is not a heightfield, so it needs its own two answers for
// the lens. Both live with the builder. (src/build/camclip.js)
import { camMarch, camClear } from '../build/camclip.js';

/**
 * Third-person camera.
 *
 * The five things that decide whether a third-person game feels expensive:
 *
 *  1. **The cadet is not in the middle of the screen.** The whole rig — lens and
 *     aim together — is slid sideways by an over-the-shoulder offset, so the
 *     character sits about a sixth of the frame off centre and the reticle has
 *     open world behind it instead of his own pauldron. Offsetting only the
 *     *pivot*, which is what this used to do, moves nothing at all on screen:
 *     the boom just orbits a point next to him.
 *  2. **It never ends up inside the scenery.** A short march down the
 *     heightfield picks the longest boom whose lens is above ground, and a
 *     three-ray sweep against a live list of nearby solids pulls it in the
 *     instant a trunk, a monolith or a boulder gets between the lens and the
 *     cadet.
 *  3. **It flies parallel to the ground.** The boom pitches with the slope
 *     behind you, so running down a mountainside frames the mountainside
 *     instead of levering the lens straight up into a top-down shot.
 *  4. **Every state is a different shot.** Walk, sprint, dash, glide and land
 *     each have their own boom length, height, aim and field of view, and the
 *     transitions between them are the game's camera work.
 *  5. **It leads and it settles.** The aim drifts ahead of your velocity so you
 *     see where you are going, and comes back to centre when you stop.
 */
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const smoothstep = THREE.MathUtils.smoothstep;

const HEAD = 1.46;        // aim height up the cadet
const CLEAR = 0.72;       // the lens never gets closer than this to the ground
const MIN_BOOM = 1.85;    // ...and never closer than this to the cadet

/**
 * How much of the frame's height the cadet is allowed to be.
 *
 * This is the number the whole rig is tuned around, and the one the old rig got
 * wrong. A 1.8 m body at boom `d` under a vertical field of view `f` covers
 * `1.8 / (2·d·tan(f/2))` of the frame. The previous camera sat at 4.55 m and
 * then *added* 1.4 m of boom and 12° of lens for a sprint — so the exact moment
 * the player was going fastest, the hero shrank from 30% of the frame to 17%,
 * which is a postage stamp. Speed now costs about four points of frame height
 * instead of thirteen, and buys its excitement from the lens instead.
 */
const BOOM = 3.80;

/**
 * ---- THE TWO NUMBERS THAT KEEP THE FRAME A FRAME -------------------------
 *
 * Everything above this line is a camera with ONE move: when something gets
 * between the lens and the cadet, come closer. On open ground that is the
 * right and only move. On tight ground it has one destination — the lens
 * pressed against whatever is behind him, looking at it — and the project's
 * own escape instrument (`notFree()` in tools/critic/_escape.mjs) reads that
 * destination as four separate failures at once: `boom 1.85`, `short 0.73`,
 * `seeFar 0.00`, `open 0.00`, over a frame that is solid dark green with no
 * cadet in it. Measured, standing three metres from an objective ring the
 * game itself had sent the player to.
 *
 * A camera operator has a SECOND move, and it is the one the reference games
 * use: back into the wall and raise the camera over your own head. These two
 * numbers are that move.
 *
 *  `RISE_MAX` — how far the lens may climb to find a shot. Beyond about three
 *  metres on a four-metre boom the shot is a map screen, which is the failure
 *  the boom-climb budget below was written to prevent, so the climb is capped
 *  rather than uncapped.
 *
 *  `EYE_MIN` — the closest the DRAWN lens may end up to the cadet. 2.35 m is
 *  not a taste: it is the bar src/player/controller.js already uses to decide
 *  whether a recovery produced a frame (`_verifyRecovery`, `_hit < 2.35`), and
 *  it clears the instrument's own 2.2 m with the margin a bar needs.
 */
const RISE_MAX = 3.2;
const EYE_MIN = 2.35;
/**
 * How far the top of the frame has to reach before it counts as a horizon.
 *
 * THE BAR IS 25 m AND THIS USED TO BE 26. A solve that clears the instrument's
 * own distance by one metre is a solve that fails whenever the lens settles
 * anywhere but exactly where the solve assumed — and the composition gate duly
 * read `nothing in the frame reaches 25m` at fifty-nine places on a build whose
 * horizon solve was reporting itself satisfied. Thirty is the same solve with a
 * fifth of margin in it.
 */
const HZ_FAR = 30;
/**
 * ---- THE THIRD MOVE: TILT ---------------------------------------------------
 *
 * The lens has two ways to find a horizon and both are bounded. It can climb —
 * capped at `RISE_MAX`, and capped harder by the hero's place in the frame — and
 * it can back off, which the boom budget already pays for. On a 22-degree sun's
 * island that is enough for a bank and not enough for a hillside: measured on
 * this build at the frames the composition gate refused, the median climb the
 * solve asked for was **0.03 m**, so the cap was not even binding. The rig was
 * satisfied and the frame still had nothing in it past twenty-five metres.
 *
 * A camera operator standing in a hollow does not only stand up. They TILT, and
 * the sky arrives at the top of the frame. That is the move this constant is:
 * how far the axis may be tipped up, in radians, when the climb has been spent
 * and the top row still does not reach. It is paid for by raising the aim point,
 * which is the same lever the climb already uses, and it is bounded by the one
 * rule that outranks it — the cadet does not leave his own frame.
 */
const TILT_MAX = 0.34;

export class CameraRig {
  constructor(camera, scene = null) {
    this.cam = camera;
    this.scene = scene;
    this._nd = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = -0.14;
    this.pos = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.lead = new THREE.Vector3();
    this.boom = BOOM;
    this.boomWant = BOOM;
    this.zoom = 1;                 // debug/inspection multiplier
    this.shoulder = 0;
    this.trauma = 0;
    this.fov = 70;
    this.fovPunch = 0;
    this.roll = 0;
    this.height = 0;
    this.heightV = 0;
    this.dip = 0; this.dipT = 0; this.dipDur = 0.42;
    this.kick = 0; this.kickT = 0; this.kickDur = 0.5;
    this.glideW = 0;
    this.sprintW = 0;
    this.terrainBias = 0;
    this.pitchBias = 0;
    this.lift = 0;
    // How far the axis is tipped up to find a horizon, and how far it wants to
    // be. See TILT_MAX and `_horizon`.
    this.tilt = 0;
    this._tiltWant = 0;
    this.side = 1;            // which shoulder the lens is over: +1 right, -1 left
    this._sideWant = 1;
    this._hit = BOOM;
    this._first = true;
    this._axisEl = -0.14;

    this._d = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._want = new THREE.Vector3();
    this._pivot = new THREE.Vector3();
    this._rig = new THREE.Vector3();
    this._axis = new THREE.Vector3(0, 0, 1);
  }

  /**
   * Re-found the lens after a recovery, rather than flying it.
   *
   * `_first` alone was not enough, and the gap is the reported defect: *"that
   * time R moved me but jammed the camera into my own avatar's shoulder."*
   * `_first` teleports the lens to wherever this frame's solve puts it — and
   * the solve carries state. A boom that had been squeezed to a metre against
   * the inside of a hill, a metre and a half of accumulated climb, a landing
   * kick mid-curve and a shoulder swapped to the blocked side all survive the
   * teleport, so the lens is re-founded *at the jam*. Everything the old place
   * taught the rig is therefore thrown away here, and the first frame in the
   * new one is solved from the rig's rest pose.
   */
  refound() {
    this.boom = BOOM;
    this.boomWant = BOOM;
    this._hit = BOOM;
    this.lift = 0;
    this.kick = 0; this.kickT = 0;
    this.dip = 0; this.dipT = 0;
    this.trauma = 0;
    this.side = 1; this._sideWant = 1;
    this.lead.set(0, 0, 0);
    this.glideW = 0;
    this.terrainBias = 0;
    this.pitchBias = 0;
    this._axisEl = -0.14;
    this._first = true;
  }

  /** Kick the camera. amount 0..1. */
  shake(amount) { this.trauma = clamp(this.trauma + amount, 0, 1); }
  punchFov(d) { this.fovPunch += d; }

  /**
   * Drop the camera as if the impact went through the tripod.
   *
   * Authored as a curve rather than a spring on purpose. A spring integrated at
   * 25fps has its whole oscillation eaten by one step of damping, so the same
   * landing that cost 50cm on a fast machine cost 12cm on a slow one — the beat
   * disappeared exactly where it was needed most. This is frame-rate identical.
   */
  impact(metres, dur = 0.42) {
    if (Math.abs(metres) < 0.002) return;
    this.dip = metres; this.dipDur = dur; this.dipT = dur;
  }

  /** Shove the lens toward the cadet and let it drift back out. */
  push(metres, dur = 0.5) {
    if (metres <= 0.002) return;
    this.kick = metres; this.kickDur = dur; this.kickT = dur;
  }

  update(dt, s) {
    const t = s.time;

    // ---- aim ----
    this.yaw = s.yaw;
    this.pitch = s.pitch;

    const sn = clamp(s.speedN, 0, 1);
    // Sprint has to be a different shot, not a slightly different number. This
    // is the weight that pulls the boom back, widens the lens and lights the
    // speed lines, and it is deliberately near-zero at a jog.
    this.glideW = damp(this.glideW, s.gliding ? 1 : 0, s.gliding ? 2.4 : 3.6, dt);
    const gW = this.glideW;
    // ...on foot only. A wing cruising at sixteen metres a second is not a
    // sprint, and letting it read as one blew the lens out to ninety degrees.
    this.sprintW = damp(this.sprintW, smoothstep(sn, 0.62, 0.97) * (1 - gW), 4.5, dt);
    const runN = sn * (1 - gW);
    const dive = clamp(-s.glidePitch / 0.66, 0, 1);

    // ---- the boom flies parallel to the ground it passes over ----
    // Without this, running down anything steep puts the hillside behind you
    // between the lens and the cadet, the lens levers itself up over the top of
    // it, and you get a map screen. With it, the whole rig tilts with the hill
    // and the shot stays a shot.
    const bx = -Math.sin(this.yaw), bz = -Math.cos(this.yaw);
    const g0 = heightAt(s.pos.x, s.pos.z);
    const gB = heightAt(s.pos.x + bx * 5.0, s.pos.z + bz * 5.0);
    const rise = (g0 !== null && gB !== null) ? (gB - g0) / 5.0 : 0;
    const wantTerrain = -clamp(Math.atan(rise), -0.28, 0.52) * 0.82;
    this.terrainBias = damp(this.terrainBias, s.airTime > 0.6 ? 0 : wantTerrain, 3.0, dt);

    // the *player's* aim is never taken away; only the lens leans
    const pitchUse = clamp(this.pitch + this.terrainBias, -1.25, 0.95);

    // ---- pivot: chest height on the cadet ----
    const lookDown = clamp(-pitchUse, 0, 1);
    const pivot = this._pivot.set(
      s.pos.x,
      s.pos.y + HEAD - lookDown * 0.10 + gW * 0.20,
      s.pos.z,
    );

    // Footfalls ride a small spring; impacts ride the authored dip curve.
    this.heightV += (0 - this.height) * 150 * dt - this.heightV * 15 * dt;
    this.height += this.heightV * dt;
    this.height = clamp(this.height, -0.25, 0.14);
    let dipY = 0;
    if (this.dipT > 0) {
      this.dipT = Math.max(0, this.dipT - dt);
      const u = 1 - this.dipT / this.dipDur;
      // down in a fifth of the move, back up over the rest, ending level
      const c = u < 0.20 ? u / 0.20 * (2 - u / 0.20) : Math.pow(1 - (u - 0.20) / 0.80, 1.7);
      dipY = -this.dip * c;
    }
    pivot.y += this.height + dipY;

    // ---- over the shoulder ----
    // screen-right, in world space. The rig — lens *and* aim — slides along it,
    // which is what actually moves the cadet off centre on screen.
    const sr = this._r.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    // Authored as a *fraction of the frame*, not a distance. A fixed 1m offset
    // is a sixth of the screen at a walk and a tenth at a sprint, so the framing
    // quietly drifts back to centre exactly when the shot should be at its most
    // dynamic. This holds the cadet at 18% off centre through every boom length
    // and every field of view.
    const tanH = Math.tan(this.fov * Math.PI / 360) * (this.cam.aspect || 1.777);
    // 0.30 of the *half* frame — so the cadet sits about 15% of the full frame
    // width off centre, which is where a modern third-person shot puts him and
    // roughly twice as far over as this used to manage.
    // `side` is the shoulder swap, decided from the ground either side of where
    // the lens ended up last frame (see the lateral clearance test below).
    this.side = damp(this.side, this._sideWant, 2.2, dt);
    const shWant = 0.30 * this.boom * tanH * (1 - 0.82 * gW) * this.side;
    this.shoulder = damp(this.shoulder, shWant, 4.0, dt);
    // A fixed world offset on a short boom is a huge screen offset, so it is
    // scaled by how far the lens actually is: the framing holds while the
    // camera is squeezing past a rock. The floor is high on purpose — the
    // squeezed-in shot is exactly the one where a centred character starts
    // hiding the thing the player is trying to look at.
    const shScale = clamp(this._hit / Math.max(0.001, this.boomWant), 0.62, 1);
    const rig = this._rig.copy(pivot).addScaledVector(sr, this.shoulder * shScale);

    // ---- lead: where the lens looks, ahead of where the body is ----
    const leadScale = s.gliding ? 0.15 : 0.12;
    this.lead.x = damp(this.lead.x, clamp(s.vel.x * leadScale, -1.6, 1.6), 2.2, dt);
    this.lead.z = damp(this.lead.z, clamp(s.vel.z * leadScale, -1.6, 1.6), 2.2, dt);
    // A hard landing must not leave the lens staring at the floor: the vertical
    // lead is short and recovers fast, so the horizon comes back with the cadet.
    this.lead.y = damp(this.lead.y, clamp(s.vel.y * 0.055, -0.55, 0.45), 3.2, dt);

    // ---- boom ----
    // Speed is bought with the lens, not the boom. See BOOM above: the whole
    // point is that going faster must not make the hero smaller.
    this.boomWant = (BOOM + runN * runN * 0.22 + this.sprintW * 0.20
      + s.dashW * 0.55 + gW * 5.05) * this.zoom;
    // extend lazily, retract fast: getting closer must never feel sluggish
    const grow = this.boomWant > this.boom;
    this.boom = damp(this.boom, this.boomWant, grow ? 2.4 : 10, dt);

    // an impact shoves the lens in and lets it drift back out — the beat that
    // makes a landing something that happened *to* the camera
    let kickB = 0;
    if (this.kickT > 0) {
      this.kickT = Math.max(0, this.kickT - dt);
      const u = 1 - this.kickT / this.kickDur;
      kickB = this.kick * (u < 0.14 ? u / 0.14 : Math.pow(1 - (u - 0.14) / 0.86, 1.9));
    }
    // ---- AND THE CLIMB IS PART-PAID FOR IN BOOM ----------------------------
    //
    // The first version of the climb below only went UP, and the capture says
    // exactly what that looks like: at a bank on the north shore the lens rose
    // three metres, the frame filled with trees and sky and valley — and the
    // cadet was a helmet at the very bottom edge of it. Where the hero sits in
    // the frame is `lift / boom` and nothing else, so a climb has to buy some
    // boom or it is a plan view.
    //
    // IT IS BOUNDED, AND THE BOUND IS THE SECOND THING THE CAPTURES TAUGHT. An
    // unbounded `reach += lift` is a loop that feeds itself: a longer boom is
    // allowed a bigger climb, a bigger climb buys a longer boom, and two frames
    // later the lens is eight metres back in a stand of trees with something
    // twenty-six centimetres in front of it. A metre and a quarter is what the
    // composition needs and nothing beyond it is safe.
    //
    // AND THE BOUND IS 2.4, NOT 1.25, BECAUSE THE HORIZON HAS TO BE PAYABLE.
    // The climb below is capped at `lift <= max(1.4, hit) * 0.62` — the hero's
    // place in the frame — so on a four-metre boom no climb over 2.5 m can ever
    // be taken, and the horizon solve was asking for three and being refused.
    // The composition gate then read `nothing in the frame reaches 25m` at
    // fifty-six places with nothing at all near the lens: not a wall, a
    // hollow. Climbing and reaching are the same move, and this is the line
    // that lets the operator step BACK to stand up. It is still bounded, and
    // the loop still converges — `this.lift` is last frame's damped climb, so
    // 2.16 m of extra boom is the whole of what a maximum climb can buy.
    const reach = Math.max(MIN_BOOM, this.boom - kickB) + Math.min(this.lift, 2.4) * 0.9;

    const cp = Math.cos(pitchUse);
    const dir = this._d.set(Math.sin(this.yaw) * cp, Math.sin(pitchUse), Math.cos(this.yaw) * cp);

    // ---- occlusion ----
    //
    // The old version tested only whether the *endpoint* of each candidate boom
    // was above the heightfield, and then capped how far the lens was allowed to
    // rise to clear it. Running up any real hillside, no candidate passed, the
    // loop fell out with its initial value, and the lens was parked two metres
    // behind the cadet — *inside* the hill. Half the frame became the backfaces
    // of a mountain and the game looked broken, which is exactly what it was.
    //
    // This marches out from the cadet instead, carrying the running maximum of
    // how high the lens would have to sit to clear every metre of ground it has
    // passed over so far, and keeps the longest boom whose required climb is
    // still within budget. Two things fall out of that. The lens rides *over* a
    // rise rather than through it, which is what a hand-held camera crew would
    // do. And the ground between the cadet and the lens is checked, not just the
    // point the lens lands on — the case the old test could not see at all.
    let hit = MIN_BOOM;
    let lift = 0;
    const STEPS = 12;
    let run = 0;
    // ---- AND WHAT THE MARCH GAVE UP ON IS NOT THROWN AWAY ------------------
    //
    // The loop stops the moment the climb it would take to clear the ground
    // behind the cadet outgrows the budget for a boom that short. Until this
    // line existed it then DISCARDED that number and left the lens at the last
    // station it liked. On the tightest ground the FIRST station already blows
    // the budget — `run > 0.50 + 1.85 * 0.46` — so `hit` never moves off
    // `MIN_BOOM`, `lift` never moves off zero, and the lens is planted 1.85 m
    // behind the cadet inside the bank. That is the reported frame, exactly:
    // boom 1.85, short 0.73, seeFar 0.00, and no cadet in his own shot.
    //
    // The budget is the right rule for CHOOSING a boom length, and the wrong
    // rule for deciding whether to climb at all — because the alternative to
    // climbing is not a shorter shot, it is the inside of a hill.
    let overrun = 0;
    for (let i = 0; i <= STEPS; i++) {
      const f = MIN_BOOM + (i / STEPS) * (reach - MIN_BOOM);
      const h = heightAt(rig.x - dir.x * f, rig.z - dir.z * f);
      // over the void there is nothing to clear and nothing to hide behind
      if (h !== null) run = Math.max(run, (h + CLEAR) - (rig.y - dir.y * f));
      // How much climb a given boom length is allowed to buy. It grows with
      // distance: a long boom lifting a metre is a camera looking over a ridge,
      // a short one lifting a metre is a map screen.
      // THE BUDGET BUYS A LONGER BOOM AS WELL AS A HIGHER ONE. At 0.46 a
      // four-metre boom could climb 2.25 m, and on anything steeper the march
      // fell out early and handed back a SHORT boom as well as a low one —
      // which is the worst of both, because a short boom is the thing that
      // makes the climb look like a map screen. Climbing and reaching are the
      // same move here, so the slope of the budget is what lets the lens ride
      // out over a bank instead of standing on top of the cadet.
      if (run > 0.50 + f * 0.70) { overrun = run; break; }
      hit = f; lift = Math.max(0, run);
    }
    // Two more samples, either side of where the lens is going to end up.
    // Running along the flank of a hill, the ground *under* the boom is fine
    // and the ground half a metre to the left of it is two metres higher — the
    // lens ends up in the hillside sideways, which an on-axis march cannot see
    // and which is what the last three rounds of captures kept photographing.
    const ex = rig.x - dir.x * hit, ez = rig.z - dir.z * hit;
    const ey = rig.y - dir.y * hit;
    const need = [0, 0];
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? 0.9 : -0.9;
      const h = heightAt(ex + sr.x * s, ez + sr.z * s);
      need[k] = h === null ? -9 : (h + CLEAR) - ey;
      if (h !== null) lift = Math.max(lift, Math.min(need[k], 1.4));
    }
    // Shoulder swap. Running along a cliff, the whole of one side of the frame
    // is rock and the whole of the other is the world the player came to look
    // at — and the rig was, half the time, holding the cadet against the open
    // side and pointing the lens into the rock. When one flank is blocked and
    // the other is clear the offset moves the lens to the clear one, which is
    // what a camera operator does without being asked. Hysteresis on both ends,
    // because a shoulder that flips every few strides is worse than a fixed one.
    if (need[0] > 0.85 && need[1] < 0.20) this._sideWant = -1;
    else if (need[1] > 0.85 && need[0] < 0.20) this._sideWant = 1;
    else if (need[0] < 0.20 && need[1] < 0.20) this._sideWant = 1;
    // Solids get a three-ray sweep: a single centre ray lets the lens shave the
    // inside of a tree trunk and fill a third of the frame with its backfaces.
    this.farRay = reach;
    // A built wall beside the cadet is not on the boom's line, so the raycast
    // never sees it; the exact march does. Take whichever stops first.
    const solid = Math.min(
      this._propHit(dt, rig, dir, sr),
      camMarch(rig.x, rig.y, rig.z, -dir.x, -dir.y, -dir.z, reach),
    );
    if (solid < hit) {
      const squeeze = clamp(solid / Math.max(0.001, hit), 0, 1);
      // A boom that has been shoved right in against a boulder is about to
      // photograph the boulder. Climbing as it closes lets the lens come over
      // the top of whatever it is instead of pressing its face against it.
      lift = lift * squeeze + (1 - squeeze) * 0.55;
      hit = solid;
    }
    // ---- AND IT NEVER SITS INSIDE THE CADET ---------------------------------
    //
    // The line above deliberately allows the boom below `MIN_BOOM`, and it is
    // right to: the alternative is placing the lens on the far side of the
    // boulder it just detected, which fills the frame with the inside of the
    // boulder. But a boom of 1.05 m on a 1.8 m body is not a shot either — it
    // is the reported defect, *"jammed the camera into my own avatar's
    // shoulder"* — and there is a third answer neither of those two considered:
    // **go over the top of it.** A lens squeezed inside the minimum climbs by
    // what it lost, which lifts it clear of the pauldron and looks down at the
    // cadet from behind and above, the way a camera operator backed into a wall
    // raises the camera over their own head. The ground clamp and the two
    // de-penetration passes below still have the last word on where it lands.
    if (hit < MIN_BOOM) lift = Math.max(lift, Math.min(1.1, (MIN_BOOM - hit) * 1.35));
    // …and the same answer for the ground, which is the case that was leaving
    // the lens in the hill: the march wanted to climb and was not allowed to,
    // so it climbs now, capped.
    if (overrun > 0) lift = Math.max(lift, Math.min(overrun, RISE_MAX));

    // ---- HOLD A HORIZON ----------------------------------------------------
    //
    // Everything above answers "is the lens inside something". Nothing above
    // answers the question the player is actually asking, which is "can I see
    // anything from here" — and those are different questions. A lens sitting
    // in clean air at the bottom of a bowl is inside nothing at all and its
    // frame still stops dead at nine metres in every direction.
    //
    // So this asks the instrument's own question, on the terrain, off the same
    // lens: DOES THE TOP OF THE FRAME REACH REAL DISTANCE. `seeFar` in
    // tools/critic/_escape.mjs counts frame rays that get past 25 m and wants
    // more than one in sixteen of them; the top row of its grid is nine rays of
    // sixty-three, so the top row reaching is the whole of that clause. The
    // climb that would make it reach is computed directly rather than searched
    // for, and the second-cheapest of five bearings is taken — one clear
    // bearing is luck, two across the width of the frame is a horizon.
    //
    // It is off on the wing: a glider is already nine metres back and looking
    // down past the pilot, and lifting that shot flattens it into a map.
    //
    // ONE THING HERE IS LOAD-BEARING AND WAS WRONG IN THE FIRST VERSION OF IT.
    // The elevation the top of the frame actually points along is NOT the boom
    // pitch: the lens looks AT the cadet, so every metre it climbs tips the
    // whole frame further down, and a lift solved against the boom pitch buys
    // a horizon the frame is no longer aimed at. Measured: `seeFar` stayed at
    // 0.00 while the lens rose. So the climb is solved against the elevation
    // the previous frame's lens really looked along, which is a loop that
    // closes rather than a prediction that has to be right first time — and
    // the aim compensation below is the other half of it.
    if (gW < 0.3 && s.airTime < 0.6) {
      lift = Math.max(lift, this._horizon(
        rig.x - dir.x * hit, rig.y - dir.y * hit + lift, rig.z - dir.z * hit,
        this.yaw, this._axisEl + 0.586,
      ) * (1 - gW));
    }
    // ---- AND THE HERO NEVER LEAVES HIS OWN FRAME ---------------------------
    //
    // The hard tie, for the case the boom could not be paid: a wall directly
    // behind the cadet holds `hit` short however much the lens wants to climb,
    // and the two together are a top-down shot of a helmet — measured, with a
    // capture: at a bank on the north shore the lens rose three metres on a
    // four-and-a-half-metre boom and the cadet was a helmet at the bottom edge.
    //
    // 0.62 of the boom is 32° below the LENS, and the aim compensation further
    // down tips the axis up by most of that, so the cadet lands about seven
    // tenths of the way down the frame with the horizon above him — a high
    // shot, which is what this whole section is trying to reach.
    //
    // THE NUMBER WAS CHOSEN OFF CAPTURES, NOT OFF THE GATE. At 0.85 the escape
    // instrument scores better — the lens climbs further out of more wedges —
    // and the cadet sits at 92% of the way down the frame with his helmet under
    // the companion's card. A camera that passes a predicate and loses the hero
    // is the failure this file exists to prevent, so the tighter number wins
    // and the residual wedges are named in the report instead of hidden.
    lift = Math.min(lift, Math.max(1.4, hit) * 0.62);
    this._hit = hit;

    // the climb is damped, or a boom that steps over a boulder pops the horizon
    this.lift = damp(this.lift, lift, 9, dt);

    const want = this._want.set(
      rig.x - dir.x * hit,
      rig.y - dir.y * hit + this.lift + gW * 0.38,
      rig.z - dir.z * hit,
    );
    // and a hard floor at the lens's own position, whatever the march concluded
    const gh = heightAt(want.x, want.z);
    if (gh !== null && want.y < gh + CLEAR) want.y = gh + CLEAR;

    // ---- settle ----
    const teleported = this._first || this.pos.distanceToSquared(want) > 900;
    if (teleported) { this.pos.copy(want); this._first = false; }
    else this.pos.lerp(want, 1 - Math.exp(-(hit < this.boom - 0.05 ? 26 : 15) * dt));

    // ---- de-penetration, unconditionally, on the pixel that actually ships --
    //
    // Everything above solves for where the lens *should* go, and then the
    // settle above lerps toward it — which means for as long as the target is
    // moving, the lens the player is looking through is somewhere the solver
    // never approved. Run into a cliff at sprint speed and the smoothed
    // position spends most of a second inside the rock: the frame fills with
    // backfaces, the horizon is gone, and there is no input that gets you out
    // because the character is fine and only the camera is buried. That is the
    // failure a critic escaped by refreshing the browser.
    //
    // So the last word belongs to the ground, not to the solver. Whatever the
    // boom concluded, the drawn position is pulled back along its own line
    // toward the cadet until the ground it is standing over is below it, and
    // if it is still buried at the minimum boom it is simply lifted out.
    this._clear(rig);
    // …and out of the cadet's own lattice, which `heightAt` answers for by
    // naming the top of a wall rather than its face.
    camClear(this.pos, rig);


    // ---- IT IS NOT INSIDE ANYTHING, WHATEVER MOVED IT LAST -----------------
    //
    // Everything above this line answers the boom's own question — *how far
    // back may the lens sit* — and then two passes move it somewhere else
    // vertically: the climb, and the ground clamp in `_clear`. Both leave the
    // line the boom was tested along, and neither re-asks the only question
    // that matters about the pixel that ships: is there anything drawn between
    // the cadet and the lens.
    //
    // The heightfield is answered by `_clear` and the built lattice by
    // `camClear`. Nothing answered for the third kind of solid — the trees,
    // boulders, hoodoos, arches and landmarks the island is actually made of —
    // and that is the frame the composition gate keeps photographing:
    // `minD 0.02, camOpen 0.00, short 1.00`, a lens with its face against the
    // inside of a trunk. This is the answer for that kind, and it runs before
    // the pauldron rise below so that the rise can put back whatever boom
    // there is room to put back.
    this._unbury(rig, sr);

    // ---- AND THE SHOT IS NEVER A PAULDRON ----------------------------------
    //
    // Both passes above are allowed to pull the lens IN toward the cadet, and
    // they have to be: the alternative to a short boom is the inside of a rock.
    // What they may not do is leave it there. A lens 1.85 m from a 1.8 m body
    // is not a shot of a place with a person in it, it is a shot of a person,
    // and `notFree()` names it — *the lens is in his shoulder*.
    //
    // Rising is the way out that keeps the boom pointing where it was pointing,
    // and above a heightfield it is always available, because nothing in a
    // heightfield is over your head. So a lens that has been squeezed inside
    // the minimum stands up on the spot until it is a shot again — the same
    // 2.35 m src/player/controller.js uses to decide a recovery worked.
    //
    // AND THE RISE IS INTO SPACE THAT IS ACTUALLY THERE. *"Above a heightfield
    // it is always available, because nothing in a heightfield is over your
    // head"* is true of the heightfield and false of the island: the thing
    // over your head is a canopy, a lintel, a hoodoo's capstone or an arch.
    // The composition gate photographed the result — `boom 2.35, minD 0.02,
    // camOpen 0.00, short 1.00`, a lens that had stood up exactly the 2.35 m
    // this block asks for and stood up into a tree. So the climb is measured
    // first and taken only as far as it is free.
    {
      const ax = s.pos.x, ay = s.pos.y + HEAD, az = s.pos.z;
      const dx = this.pos.x - ax, dy = this.pos.y - ay, dz = this.pos.z - az;
      const flat2 = dx * dx + dz * dz;
      if (flat2 + dy * dy < EYE_MIN * EYE_MIN) {
        const up = Math.sqrt(Math.max(0, EYE_MIN * EYE_MIN - flat2));
        if (up > dy) this.pos.y = ay + Math.min(up, dy + this._headroom(up - dy));
        // one more word from the lattice, since the lens just moved
        camClear(this.pos, rig);
      }
    }


    // ---- aim point ----
    // Under the wing the lens looks *below* the pilot, which drops the horizon
    // toward the top of the frame and opens the world up underneath him. It is
    // the single beat that separates a glide from a fall with a decoration.
    this.focus.copy(rig).add(this.lead);
    this.focus.y -= gW * (1.05 + dive * 1.15);
    // ---- A CLIMBING LENS LOOKS OVER HIM, NOT DOWN AT HIM -------------------
    //
    // An orbit camera aims at the centre of its own sphere, and that is right
    // for as long as the lens is ON the sphere. The climb above takes it off:
    // three metres up on a four-metre boom is a lens looking down at forty
    // degrees, so the horizon it just climbed to see is above the top of the
    // frame and the whole shot is ground. Every metre of climb therefore also
    // moves the aim point up and out along the bearing, which tips the axis
    // back toward level and drops the cadet down the frame — which is what a
    // high shot is supposed to look like.
    //
    // The vertical share is capped against the boom, because that ratio IS the
    // cadet's place in the frame: 0.45 of the boom holds him no lower than
    // about a quarter of the frame under the axis, well inside a 70° lens.
    if (gW < 0.3) {
      // The whole of what the aim point may be raised by, climb and tilt
      // together. It is the cadet's place in the frame and it outranks the
      // horizon: a shot with a legal `seeFar` and no hero in it is the failure
      // this file exists to prevent, not the one it is fixing.
      const budget = Math.max(1.2, this._hit) * 0.55;
      let up = 0;
      if (this.lift > 0.02) {
        up = Math.min(this.lift, Math.max(1.2, this._hit) * 0.45);
        this.focus.x += Math.sin(this.yaw) * this.lift * 0.85;
        this.focus.z += Math.cos(this.yaw) * this.lift * 0.85;
      }
      // ---- AND WHEN THE CLIMB CANNOT BUY A HORIZON, THE TILT DOES --------
      //
      // `_horizon` now returns both prices for the same piece of ground: the
      // metres of climb, and the radians of elevation. The climb is taken first
      // because it keeps the axis level and the shot honest; whatever it could
      // not pay for arrives here as a tip of the axis, which puts sky in the top
      // of the frame instead of the hillside that was in it.
      //
      // It converges rather than predicts: `_axisEl` on the next frame is read
      // off the transform that actually shipped, so a tilt that bought the
      // horizon makes `_tiltWant` zero and the tilt decays out again. That is
      // the same loop the climb closes, and for the same reason.
      const tiltWant = (s.airTime < 0.6) ? (this._tiltWant || 0) : 0;
      this.tilt = damp(this.tilt, tiltWant, 5, dt);
      if (this.tilt > 0.004) up += Math.max(1.2, this._hit) * Math.tan(this.tilt);
      if (up > 0.001) this.focus.y += Math.min(up, budget);
    }

    // ---- shake ----
    this.trauma = Math.max(0, this.trauma - dt * 1.35);
    const sh = this.trauma * this.trauma;
    let ox = 0, oy = 0, rz = 0;
    if (sh > 0.0002) {
      ox = (noise(t * 27.1) * 0.5 + noise(t * 11.3) * 0.5) * sh * 0.46;
      oy = (noise(t * 23.7 + 5) * 0.5 + noise(t * 9.1 + 2) * 0.5) * sh * 0.46;
      rz = noise(t * 17.9 + 11) * sh * 0.060;
    }

    this.cam.position.copy(this.pos);
    this.cam.position.x += sr.x * ox;
    this.cam.position.z += sr.z * ox;
    this.cam.position.y += oy;
    // ---- AND THE SHAKE DOES NOT GET TO BURY THE LENS ----------------------
    //
    // Everything above solves for a lens that is clear of the ground, and then
    // trauma adds up to 46 cm of vertical offset to the pixel that actually
    // ships. On flat ground that is a knock; on a slope taken at a scramble it
    // is the lens 47 cm under the drawn hillside, which the traverse gate
    // caught at bearing 315° and which is the same class of failure as every
    // other one this file exists to prevent. The offset is a *shake*, not a
    // position, so it yields to the floor.
    {
      const gy = heightAt(this.cam.position.x, this.cam.position.z);
      if (gy !== null && this.cam.position.y < gy + CLEAR * 0.82) {
        this.cam.position.y = gy + CLEAR * 0.82;
      }
    }
    this.cam.lookAt(this.focus);
    // What the lens is really looking along, for the horizon solve above. It
    // is read off the shipped transform rather than predicted, which is why
    // the loop converges instead of being right or wrong once.
    {
      const fx2 = this.focus.x - this.cam.position.x;
      const fy2 = this.focus.y - this.cam.position.y;
      const fz2 = this.focus.z - this.cam.position.z;
      const fl = Math.hypot(fx2, fz2);
      this._axisEl = fl > 0.01 ? clamp(Math.atan2(fy2, fl), -0.9, 0.7) : 0;
    }

    // ---- bank ----
    const lateral = s.vel.x * sr.x + s.vel.z * sr.z;
    const rollWant = clamp(lateral * -0.010, -0.09, 0.09)
      + clamp(s.turnRate * 0.03, -0.06, 0.06)
      + gW * s.glideRoll * 0.30;
    this.roll = damp(this.roll, rollWant, 4.5, dt);
    this.cam.rotateOnAxis(this._axis, this.roll + rz);

    // ---- fov ----
    // 70 at rest is about a hundred degrees horizontal on a 16:9 frame, which is
    // the width a modern third-person action game opens with. Sprint takes it to
    // eighty-two: a twelve degree swing you feel in your hands, not a rounding
    // error you can only find in telemetry.
    this.fovPunch = damp(this.fovPunch, 0, 7, dt);
    // Flow is the only thing on screen that says a chain is live. It is worth
    // four degrees — under half of what a sprint is worth, so it reads as the
    // run getting away from you rather than as a second sprint button.
    const flow = clamp(s.flow || 0, 0, 1);
    const fovWant = 70 + this.sprintW * 8 + runN * 2 + flow * 4
      + gW * (4 + dive * 8) + this.fovPunch;
    this.fov = damp(this.fov, fovWant, 6, dt);
    if (Math.abs(this.cam.fov - this.fov) > 0.02) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }
}

const _sc = new THREE.Vector3();
const _c = new THREE.Vector3();
const _o = new THREE.Vector3();
const _dp = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * The lens is never inside the island. Run on the position that is drawn.
 *
 * `rig` is the cadet's own aim point, which is by construction a place the
 * player can be, so shortening the boom toward it always terminates somewhere
 * legal. Eight steps in is plenty at 4 m of boom and costs eight heightfield
 * samples on the frames where anything is wrong at all — on a clear frame the
 * first test passes and it costs one.
 */
CameraRig.prototype._clear = function (rig) {
  const p = this.pos;
  const need = (x, y, z) => {
    const h = heightAt(x, z);
    return h === null ? -99 : (h + CLEAR * 0.82) - y;
  };
  // ---- THE GROUND BETWEEN THE CADET AND THE LENS, NOT UNDER IT ------------
  //
  // This used to ask one question — is the ground under the lens's own column
  // below it — and that question is blind to the case the captures keep
  // returning: the lens beside a bank rather than over one. Stand on a shelf
  // with a two-metre face half a metre behind you and every one of these is
  // true at once: the ground under the lens is a metre below it, the boom's own
  // march approved the shot two frames ago at a different pitch, and the frame
  // reads `short 0.98, minD 0.02` — the lens two centimetres from the face of
  // the bank, looking at it.
  //
  // The boom march (above, in `update`) does look along the line — but at the
  // boom the SOLVER chose, before the climb, before the ground clamp, and
  // before the settle lerp puts the drawn lens somewhere between the two. So
  // the same march is run again here, on the pixel that ships, over the
  // segment from the cadet's own aim point to the lens.
  let under = need(p.x, p.y, p.z);
  {
    _dp.copy(p).sub(rig);
    const len = _dp.length();
    if (len > 1e-4) {
      // Raising the lens by `r` raises a station a fraction `f` along the
      // segment by only `f · r`, so what each station asks for is its own
      // shortfall divided by `f`. Stations nearer than a third of the way in
      // are skipped: they sit at the cadet's feet, where that division is
      // meaningless and the answer is always negative anyway.
      for (let i = 3; i < 8; i++) {
        const f = i / 8;
        const q = need(rig.x + _dp.x * f, rig.y + _dp.y * f, rig.z + _dp.z * f) / f;
        if (q > under) under = q;
      }
    }
  }
  if (under <= 0) return;

  // ---- RISE BEFORE WALKING IN --------------------------------------------
  //
  // Walking the lens toward the cadet gets it out of the hill and hands back a
  // shot of a pauldron. There is a second way out of a heightfield and it is
  // always available, because nothing in a heightfield is over your head, and
  // it is the one that KEEPS THE BOOM — which is to say, keeps the shot. It is
  // bounded: a lens ten metres inside a mountain rising ten metres is a map
  // screen, and for that case walking in is still the right answer.
  if (under <= RISE_MAX) { p.y += under; return; }

  _dp.copy(rig).sub(p);
  const len = _dp.length();
  if (len > 1e-4) {
    _dp.multiplyScalar(1 / len);
    // Walk in toward the cadet. The first station that is above ground wins.
    for (let i = 1; i <= 8; i++) {
      const d = (i / 8) * len;
      const x = p.x + _dp.x * d, y = p.y + _dp.y * d, z = p.z + _dp.z * d;
      if (need(x, y, z) <= 0) { p.set(x, y, z); return; }
    }
  }
  // Buried the whole way in — the cadet is under the heightfield too, which is
  // the wedged-in-a-rock-face case. Lift the lens out on the spot; the player
  // gets a view of where they are rather than the inside of a hill, and
  // src/player/controller.js is meanwhile offering them the way out.
  const h = heightAt(p.x, p.z);
  if (h !== null) p.y = Math.max(p.y, h + CLEAR);
};

/**
 * HOW MUCH CLEAR AIR IS OVER THE LENS, up to `want` metres.
 *
 * Straight up from the drawn position, against the same three kinds of solid
 * the boom is tested against — the scenery list, the built lattice, and (for
 * completeness, though nothing in a heightfield is over your head) nothing
 * else. Returns the metres of climb that are actually available.
 */
CameraRig.prototype._headroom = function (want) {
  if (!(want > 0.01)) return 0;
  let free = want;
  const list = this.blockers;
  if (list && list.length && this._ray) {
    const ray = this._ray;
    ray.near = 0.04; ray.far = want + 0.30;
    ray.set(_o.copy(this.pos), _up);
    const hits = ray.intersectObjects(list, false);
    // A HIT AT ARM'S LENGTH IS NOT A CEILING, IT IS A FLOOR SEEN FROM INSIDE.
    // Every material on this list is single-sided in the shipped frame but the
    // lens can still end up within a few centimetres of one, and the nearest
    // thing overhead is then the underside of whatever it is standing against —
    // at which point refusing the climb keeps the lens exactly where it must
    // not be. Anything inside 45 cm is treated as already-behind: the climb is
    // measured against the first surface the lens has actual room under.
    for (const h of hits) {
      if (h.distance <= 0.45) continue;
      free = Math.min(free, Math.max(0, h.distance - 0.30));
      break;
    }
  }
  const built = camMarch(this.pos.x, this.pos.y, this.pos.z, 0, 1, 0, want + 0.30);
  if (built < want + 0.30) free = Math.min(free, Math.max(0, built - 0.30));
  return free;
};

/**
 * NOTHING DRAWN BETWEEN THE CADET AND THE LENS. Run on the position that ships,
 * after every other pass has had its say.
 *
 * The cadet's own aim point is by construction a place the player can be, so
 * shortening the boom toward it always terminates somewhere legal — the same
 * argument `_clear` is built on, and the same three-ray sweep `_propHit` uses,
 * because a single centre ray lets the lens shave the inside of a trunk and
 * fill a third of the frame with its backfaces.
 *
 * It is allowed to end up closer than `MIN_BOOM`. That is the trade this file
 * already made once and it has not changed: *squeezing right up against the
 * cadet's shoulders is not a nice shot, but it is a shot; the inside of a rock
 * is not.*
 */
CameraRig.prototype._unbury = function (rig, sr) {
  const list = this.blockers;
  _dp.copy(this.pos).sub(rig);
  const len = _dp.length();
  if (len < 0.12) return;
  _dp.multiplyScalar(1 / len);
  let hit = len;
  if (list && list.length && this._ray) {
    const ray = this._ray;
    ray.near = 0.05; ray.far = len;
    for (let k = 0; k < 3; k++) {
      _o.copy(rig);
      if (k === 1) _o.addScaledVector(sr, 0.26);
      else if (k === 2) _o.addScaledVector(sr, -0.26);
      ray.set(_o, _dp);
      const hits = ray.intersectObjects(list, false);
      if (hits.length) hit = Math.min(hit, hits[0].distance);
    }
  }
  const built = camMarch(rig.x, rig.y, rig.z, _dp.x, _dp.y, _dp.z, len);
  if (built < hit) hit = built;
  if (hit >= len - 0.02) return;
  // 0.34 is the lens's own girth, the same figure `_propHit` backs off by.
  //
  // AND IT IS NEVER PLACED BEYOND THE THING IT JUST DETECTED. The floor used to
  // be a flat 0.75 m, which on anything the lens was already half a metre from
  // put it on the FAR side of the hit — inside the stone — and then the rise
  // out of the pauldron below could not lift it out either, because a ray cast
  // upward from inside a mesh hits that mesh's own backface at once. The gate
  // photographed the result six times over: `boom 1.36, short 1.00, minD 0.06`.
  // A very short boom is a bad shot; the inside of a kerb is not a shot.
  const d = Math.max(0.25, hit > 1.09 ? hit - 0.34 : hit - 0.22);
  this.pos.copy(rig).addScaledVector(_dp, d);
  // the ground still has the last word on the shorter boom
  this._clear(rig);
};

/**
 * HOW HIGH THE LENS HAS TO SIT FOR THE TOP OF THE FRAME TO REACH DISTANCE.
 *
 * Five bearings across the width of the shipped frame, marched over the
 * heightfield at the elevation of its top row, out to `HZ_FAR`. For each one
 * the answer is a single number — the metres of climb that would put every
 * piece of ground on that bearing under the ray — and it is computed rather
 * than searched for, so the whole thing is eighty-five heightfield samples and
 * costs about fifteen microseconds.
 *
 * The SECOND CHEAPEST of the five is returned, not the cheapest and not the
 * worst. The cheapest is one bearing, which is a gap between two hills and not
 * a horizon; the worst would fly the lens up the side of any mountain the
 * player happened to be facing, which is the map screen this file's boom-climb
 * budget exists to prevent. Two of five is about a third of the frame's width,
 * which is comfortably more than the `seeFar` clause asks for.
 *
 * Terrain only, deliberately. Props and landmarks are answered by the boom's
 * own three-ray sweep at the range where they matter, and marching a raycast
 * through the scene five times a frame to find a horizon would cost more than
 * the horizon is worth.
 */
const _hz = [0, 0, 0, 0, 0];
const _hzT = [0, 0, 0, 0, 0];
CameraRig.prototype._horizon = function (lx, ly, lz, yaw, el) {
  const ce = Math.cos(el), se = Math.sin(el);
  for (let b = 0; b < 5; b++) {
    // ±35°, which is the half-width of a 70° lens on a 16:9 frame
    const a = yaw + (b / 4 - 0.5) * 1.22;
    const dx = Math.sin(a) * ce, dz = Math.cos(a) * ce;
    let m = -99, mt = -9;
    for (let t = 2; t <= HZ_FAR; t += 1.6) {
      const h = heightAt(lx + dx * t, lz + dz * t);
      // off the edge of the island: this bearing sees for ever
      if (h === null) { m = -99; mt = -9; break; }
      const k = h + 0.9 - (ly + se * t);
      if (k > m) m = k;
      // ---- THE SAME SHORTFALL, AS AN ANGLE ------------------------------
      //
      // `k` is how far the lens would have to CLIMB to pass over this piece of
      // ground. That is one of the two ways to clear it and it is the bounded
      // one: three metres of climb clears a bank and does not clear a hillside.
      // This is the other — the elevation the top row would have to be at to
      // pass over the same ground from where the lens already is. The rig pays
      // whichever it can afford, and on the frames this file was rewritten
      // against it can afford this one.
      const q = Math.atan2(h + 0.9 - ly, t) - el;
      if (q > mt) mt = q;
    }
    _hz[b] = m; _hzT[b] = mt;
  }
  _hz.sort((p, q) => p - q);
  _hzT.sort((p, q) => p - q);
  // ---- THE MEDIAN OF FIVE, NOT THE SECOND CHEAPEST -----------------------
  //
  // The second cheapest is two bearings of five, which is about two of the top
  // row's nine rays, which is two of the instrument's sixty-three — and the
  // clause wants more than four. So the old solve was calibrated to land ON the
  // bar it was trying to clear, and a solve that lands on a bar fails half the
  // time by construction. The median is five of nine rays and clears it.
  //
  // ---- AND THE TILT IS SOLVED AGAINST THE UNTILTED AXIS ------------------
  //
  // `el` is the elevation the lens ACTUALLY looked along last frame, tilt
  // included. Asking "how much more elevation do I need than I already have"
  // and then damping toward that answer is an oscillator: the tilt buys the
  // horizon, the horizon says nothing is needed, the tilt decays, the horizon
  // goes away again. The climb does not have this problem because it is solved
  // against the lens height it is ABOUT to be at, not the one it was at. So the
  // tilt is put on the same footing — `this.tilt` is added back, making
  // `_tiltWant` the total tilt this frame needs from a level axis, which is a
  // damp target that stands still when the shot is right.
  this._tiltWant = Math.max(0, Math.min(_hzT[2] + this.tilt, TILT_MAX));
  return Math.max(0, Math.min(_hz[2], RISE_MAX));
};

/**
 * Solid things the boom must not pass through.
 *
 * The island's scenery is almost entirely `InstancedMesh` scatter — a few
 * hundred trees, boulders, pillars and totems per batch — plus a handful of
 * merged landmark meshes. The previous filter culled instanced batches by the
 * distance to their *shared* geometry origin, which is the middle of the
 * island, so on any real play position every tree in the world was excluded and
 * the lens spent its life inside stonework. Instanced batches are now always
 * kept: three.js sphere-tests the batch and then each instance before it
 * touches a triangle, so a few hundred of them cost almost nothing.
 */
CameraRig.prototype._propHit = function (dt, rig, dir, sr) {
  this._scan = (this._scan || 0) - dt;
  if (!this._ray) {
    this._ray = new THREE.Raycaster();
    this.blockers = [];
  }
  if (this._scan <= 0 && this.scene) {
    this._scan = 0.35;
    const list = this.blockers;
    list.length = 0;
    this.scene.traverse((o) => {
      if (list.length >= 64) return;
      if (!o.visible || !o.isMesh || o.userData.noCamBlock) return;
      const m = o.material;
      if (!m || m.transparent || m.depthWrite === false || m.wireframe) return;
      const g = o.geometry;
      if (!g) return;
      // The terrain shell is handled exactly by the heightfield march, and it is
      // the one mesh big enough that raycasting it every frame would show up.
      const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
      if (!tris || tris > 30000) return;
      if (o.isInstancedMesh) { list.push(o); return; }
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere;
      if (!bs) return;
      _sc.setFromMatrixScale(o.matrixWorld);
      const r = bs.radius * Math.max(_sc.x, _sc.y, _sc.z);
      if (r < 0.5) return;
      _c.copy(bs.center).applyMatrix4(o.matrixWorld);
      if (_c.distanceToSquared(rig) > (70 + r) * (70 + r)) return;
      list.push(o);
    });
  }
  if (!this.blockers.length) return Infinity;

  const ray = this._ray;
  ray.near = 0.15;
  ray.far = this.farRay;
  let best = Infinity;
  // centre, then two rays offset by the lens radius — a poor man's sphere-cast,
  // and enough to stop the boom threading a trunk it should have been stopped by
  for (let k = 0; k < 3; k++) {
    _o.copy(rig);
    if (k === 1) _o.addScaledVector(sr, 0.30);
    else if (k === 2) _o.addScaledVector(sr, -0.30);
    ray.set(_o, this._nd.copy(dir).negate());
    const hits = ray.intersectObjects(this.blockers, false);
    if (hits.length) best = Math.min(best, hits[0].distance);
  }
  // NOT clamped to MIN_BOOM. Clamping here was the whole bug: when a trunk or a
  // rock sat a metre and a half behind the cadet, the sweep correctly reported
  // it, the result was then raised back to the two-metre minimum, and the lens
  // was placed *on the far side of the thing it had just detected* — which is
  // how you end up with two thirds of the frame filled by the black inside of a
  // boulder. Squeezing right up against the cadet's shoulders is not a nice
  // shot, but it is a shot; the inside of a rock is not.
  return best === Infinity ? Infinity : Math.max(1.05, best - 0.34);
};

// cheap smooth pseudo-noise, deterministic and allocation free
function noise(x) {
  return Math.sin(x) * 0.6 + Math.sin(x * 2.17 + 1.3) * 0.3 + Math.sin(x * 4.31 + 2.7) * 0.1;
}
