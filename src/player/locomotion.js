import * as THREE from 'three';
import { escapableAt, groundUnder, gradientAt, heightAt, onBuilt, RIM } from './terrain.js';

/**
 * The physics half of game feel.
 *
 * Ground movement uses linear accelerate-toward with a pivot boost, not an
 * exponential lerp: exponential lerps feel like driving a boat, linear
 * acceleration feels like legs. Everything else here exists to remove the
 * moments where a player knows they pressed the button and the game disagreed:
 * coyote time, an input buffer, apex hang, variable jump height, a ledge
 * mantle instead of a wall you slide down.
 */

export const P = {
  gravityUp: 26, gravityFall: 46, gravityApex: 15, apexWindow: 2.6,
  terminal: -58,

  // Walk, run and sprint have to be three *readably different* gaits. The old
  // spread put a sprint 60% above a jog and the ramp took a second and a
  // quarter to get there, so in practice the difference between holding shift
  // and not holding it was about one metre a second — below the threshold at
  // which a human notices they are going faster.
  walk: 3.1, run: 6.2, sprint: 11.8,
  accel: 46, accelAir: 19, pivotBoost: 1.5,
  frictionLin: 22, frictionProp: 7.0, airDrag: 0.32,

  jumpV: 11.4, doubleV: 9.9, cutJump: 0.42,
  coyote: 0.14, buffer: 0.17,

  sprintRamp: 0.85,            // seconds from run to full sprint
  slopeLimit: 1.5,             // gradient above which terrain is a wall (~56 deg)
  slideLimit: 1.3,
  stepUp: 0.55,

  dashSpeed: 22, dashTime: 0.19, dashCool: 0.62, dashExit: 1.12,

  mantleTime: 0.46, mantleMin: 0.65, mantleMax: 2.7, mantleReach: 1.05,

  glideDrag: 0.016, glideBase: -0.13, glideDive: -0.66, glideFlare: 0.44,
  glideMin: 6, glideMax: 34, glideTurn: 1.9,

  // Letting go of the stick at speed does not stop you: the boots plant and
  // plough. Friction during the plant is a fraction of the standing value, so
  // a sprint costs about two metres of skid to shed — the beat that makes
  // stopping a movement instead of a state change.
  skidEnter: 0.62,             // fraction of sprint speed above which a stop skids
  skidTime: 0.55, skidFric: 0.20,
  landTime: 0.36, hardLandTime: 1.15,

  // ---- THE LAUNCH -------------------------------------------------------
  // A surface that rises under you throws you off its head. Until this
  // existed, running off the top of a ramp you had just built dropped you
  // straight down at zero metres a second: the ramp gave back exactly the
  // height it cost and nothing else, which is why building read as scenery.
  // Now the ground you leave keeps the part of your speed that was pointing
  // up. A four-metre ramp climbs one metre per metre travelled, so a sprint
  // off its head is thrown about seven metres a second upward — a gap you
  // could not cross on foot, crossed, because you built the lip.
  // ---- THE SCRAMBLE -----------------------------------------------------
  // What the boots may do, and ONLY on ground a cadet cannot otherwise walk
  // off. The island was swept at two metres and 3.82% of it is one-way — a
  // ledge you can drop onto and not climb off, a slot whose head is a wall —
  // and a walk driven with nothing but W ended inside one of them, holding the
  // key, going nowhere, for twenty-three seconds. (src/world/paths.js)
  //
  // A cliff is still a cliff everywhere else in this game: the Reach is still
  // the way up the Spine, a perch is still somewhere you have to fly to. This
  // is a hand on the rock in the one place the world has hold of you, it is
  // slow enough to read as a climb rather than a run, and the terrain itself
  // decides when it is available — nothing the player presses can ask for it.
  // NO SLOPE LIMIT AT ALL, and that is the point. A limit of seven was still a
  // limit, and the faces that make one-way ground on this island run at a
  // gradient of fourteen — so the boots went on refusing them and a cadet
  // dropped on the Spine's west flank climbed twenty centimetres in twelve
  // seconds. What makes this a climb rather than a cheat is the RATE, below,
  // not a face the game is still allowed to say no to.
  scrambleSlope: 1e4,
  scrambleStep: 1.35,          // …the step the boots will pull up over
  scrambleClimb: 4.5,          // metres a second of height, and no more

  launchK: 0.62,               // fraction of the rising speed that becomes lift
  launchBuilt: 0.80,           // …off a lip you machined yourself
  launchMin: 0.26,             // metres of rise per metre run: below this, ground
  launchMax: 9.5,              // and never a rocket
  launchSpeedMin: 5.0,

  // ---- FLOW -------------------------------------------------------------
  // Chaining moves — dash into jump, ramp into wing, wing into a running
  // landing — banks a little speed. It bleeds away the moment you stand
  // still, so it is carried, never owned.
  flowTop: 0.17,               // top speed at full flow
  flowDecay: 0.40,             // per second while still moving
  flowDrop: 3.4,               // multiplier on that once you stop
  dashJump: 1.06,              // a jump out of a dash keeps this much of it
};

const up = new THREE.Vector3(0, 1, 0);

export class Locomotion {
  constructor() {
    this.pos = new THREE.Vector3(0, 12, 26);
    this.vel = new THREE.Vector3();
    this.grounded = false;
    this.groundY = 0;
    this.groundN = new THREE.Vector3(0, 1, 0);

    this.state = 'air';          // ground | air | glide | dash | mantle | slide
    this.airTime = 0;
    this.groundTime = 0;
    this.coyote = 0;
    this.jumps = 0;
    this.sprintCharge = 0;
    this.speed = 0;              // planar
    this.speedN = 0;             // 0..1 of sprint
    this.facing = Math.PI;
    this.moveDir = new THREE.Vector3(0, 0, 1);
    this.turnRate = 0;

    this.dashT = 0; this.dashCd = 0; this.airDash = true;
    this.dashDir = new THREE.Vector3(0, 0, 1);

    this.gliding = false; this.glideOpen = 0;
    this.glideSpeed = 0; this.glidePitch = P.glideBase; this.glideRoll = 0;
    this.heading = Math.PI;

    this.mantleT = 0;
    this._mFrom = new THREE.Vector3(); this._mTo = new THREE.Vector3();

    this.hardLand = 0;           // recovery lockout after a big impact
    this.slideT = 0;
    this.skidT = 0; this.skidMax = 1; this.skidPower = 0;
    this.skidDir = new THREE.Vector3(0, 0, 1);
    this.landT = 0; this.landMax = 1; this.landPower = 0;
    this.glideLoad = 0; this.deployT = 0;

    /** Chained-move charge, 0..1. Read by the camera, the wing and the top
     *  speed. Banked by linking moves, spent by standing still. */
    this.flow = 0;
    /** Strength of the last launch off a rising surface, 0..1. */
    this.launchPower = 0;
    /**
     * True while the ground under the cadet leads nowhere he can walk to.
     * Read from the world, never from an input (see P.scrambleSlope).
     */
    this.scrambling = false;
    /** Seconds spent on one-way ground. The interface reads it; nothing else. */
    this.scrambleT = 0;

    this.ev = {};
    this._wish = new THREE.Vector3();
    this._prev = new THREE.Vector3();
  }

  /** ctx: { wish:Vector3(unit, camera-relative), wishMag, sprint, yaw,
   *         jump:{pressed,held,consume}, dash:bool, glideBtn:bool } */
  update(dt, ctx) {
    const ev = this.ev = {
      landed: 0, jumped: 0, doubleJumped: 0, dashed: 0,
      glideOpened: 0, glideClosed: 0, mantled: 0, wallHit: 0, slideStart: 0,
      skidStart: 0, sprintOn: 0, launched: 0, dashJumped: 0,
    };
    this._prev.copy(this.pos);

    // ---- IS THE WORLD HOLDING HIM? ----------------------------------------
    // Asked of the island, once a frame, from a table built at boot: can a
    // cadet standing here walk home at all? On the 96% of the island where the
    // answer is yes this changes nothing whatsoever. On the 4% where it is no,
    // the boots get a hand on the rock — see P.scrambleSlope.
    const canLeave = this.grounded ? escapableAt(this.pos.x, this.pos.z) : true;
    this.scrambling = this.grounded && !canLeave;
    this.scrambleT = this.scrambling ? this.scrambleT + dt : 0;

    this.dashCd = Math.max(0, this.dashCd - dt);
    this.hardLand = Math.max(0, this.hardLand - dt);
    this.landT = Math.max(0, this.landT - dt);
    if (this.grounded) this.coyote = P.coyote; else this.coyote = Math.max(0, this.coyote - dt);

    const wish = this._wish.copy(ctx.wish);
    const wishMag = ctx.wishMag;
    const locked = this.mantleT > 0 || this.hardLand > 0;

    // ---------------- mantle ----------------
    if (this.mantleT > 0) {
      this._mantle(dt);
      this._finish(dt, ctx);
      return ev;
    }

    // ---------------- dash ----------------
    if (this.dashT > 0) {
      // THE DASH JUMP — and the reason to time a dash at all.
      //
      // A jump pressed during a dash used to be swallowed whole: this block
      // returns before the jump code ever runs, so the one press every player
      // makes at the lip of a gap did nothing. Now it *cancels* the dash and
      // keeps its speed, which is the difference between a dash that is a
      // panic button and a dash that is the run-up to a jump. Dash at the
      // wrong moment and you arrive at the edge with the cooldown up; dash
      // one step before the edge and you clear a gap you cannot walk across.
      if (ctx.jumpBuffered && !locked && this._dashJump(dt, ctx, ev)) return ev;
      this.dashT -= dt;
      this.vel.x = this.dashDir.x * P.dashSpeed;
      this.vel.z = this.dashDir.z * P.dashSpeed;
      this.vel.y = THREE.MathUtils.damp(this.vel.y, this.grounded ? 0 : -1.5, 9, dt);
      if (this.dashT <= 0) {
        const cap = P.sprint * P.dashExit;
        const s = Math.hypot(this.vel.x, this.vel.z);
        if (s > cap) { this.vel.x *= cap / s; this.vel.z *= cap / s; }
      }
      this._integrate(dt);
      this._finish(dt, ctx);
      return ev;
    }

    if (ctx.dash && this.dashCd <= 0 && !locked && (this.grounded || this.airDash)) {
      this.dashDir.copy(wishMag > 0.2 ? wish : this.moveDir).setY(0);
      if (this.dashDir.lengthSq() < 1e-4) this.dashDir.set(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
      this.dashDir.normalize();
      this.dashT = P.dashTime; this.skidT = 0;
      // a chained cadet gets the dash back sooner, which is the whole payment
      this.dashCd = P.dashCool * (1 - 0.32 * this.flow);
      if (!this.grounded) this.airDash = false;
      if (this.gliding) this._closeGlide(ev);
      this.jumps = Math.min(this.jumps, 1);
      this._flowLink(0.26);
      ev.dashed = 1;
      this.state = 'dash';
    }

    // ---------------- glide ----------------
    if (this.gliding) {
      this._glide(dt, ctx, ev);
      this._integrate(dt);
      this._finish(dt, ctx);
      return ev;
    }

    // ---------------- sprint build-up ----------------
    const wantSprint = ctx.sprint && wishMag > 0.55 && !this.gliding;
    const chargeWas = this.sprintCharge;
    this.sprintCharge = THREE.MathUtils.clamp(
      this.sprintCharge + (wantSprint ? dt / P.sprintRamp : -dt * 2.6), 0, 1);
    // the moment the legs commit, so the lens and the boots can react to it
    if (chargeWas < 0.42 && this.sprintCharge >= 0.42 && this.grounded) ev.sprintOn = 1;

    // ---------------- horizontal ----------------
    const stickTop = THREE.MathUtils.lerp(P.walk, P.run, THREE.MathUtils.smoothstep(wishMag, 0.12, 0.92));
    // Flow is spent here: a chained run is faster than a flat one, and the
    // only way to hold the extra is to keep chaining.
    const top = THREE.MathUtils.lerp(stickTop, P.sprint, this.sprintCharge * (wantSprint ? 1 : 0.55))
      * (1 + P.flowTop * this.flow);
    let target = top * Math.min(1, wishMag * 1.25);

    // Slopes: the hill takes something going up and gives it back coming down.
    //
    // A LATTICE RAMP IS NOT A HILL. This is the whole answer to "building asks
    // nothing and gives nothing". A hillside charges nearly half your speed to
    // climb; a ramp you set down yourself is machined ground and charges you
    // almost nothing — so the ramp is not a slower, tidier way up, it is the
    // *fast* way up, and the head of it then throws you (see `_launch`). One
    // piece, eleven charge, and a climb that cost you a sprint is a climb you
    // sprint through and leave the ground at the top of.
    this.onBuilt = this.grounded && onBuilt(this.pos.x, this.pos.z);
    if (this.grounded && wishMag > 0.05) {
      const g = gradientAt(this.pos.x, this.pos.z);
      const along = g.x * wish.x + g.y * wish.z;
      target *= this.onBuilt
        ? THREE.MathUtils.clamp(1 - along * 0.11, 0.86, 1.34)
        : THREE.MathUtils.clamp(1 - along * 0.42, 0.5, 1.28);
      // A scramble is a climb, not a run: the height gained is capped, so a
      // gradient-five face is taken at two thirds of a metre a second of run
      // and reads as hauling yourself up it.
      if (this.scrambling && along > P.slideLimit) {
        target = Math.min(target, P.scrambleClimb / along);
      }
    }

    const vx = this.vel.x, vz = this.vel.z;
    const sp = Math.hypot(vx, vz);
    const accelBase = this.grounded ? P.accel : P.accelAir;

    // ---------------- skid: letting go at speed plants the boots ----------------
    if (this.skidT > 0) {
      this.skidT = Math.max(0, this.skidT - dt);
      // steering out of a skid is possible but weak; pushing the stick the way
      // you were already going cancels it and you run out of the slide
      if (wishMag > 0.5 && (wish.x * this.skidDir.x + wish.z * this.skidDir.z) > 0.55) this.skidT = 0;
    } else if (this.grounded && wishMag < 0.2 && sp > P.sprint * P.skidEnter && !locked) {
      this.skidT = P.skidTime * THREE.MathUtils.clamp(sp / P.sprint, 0.6, 1.15);
      this.skidMax = this.skidT;
      this.skidPower = THREE.MathUtils.clamp((sp - P.run * 0.7) / (P.sprint - P.run * 0.7), 0, 1);
      this.skidDir.set(vx / sp, 0, vz / sp);
      ev.skidStart = this.skidPower;
    }

    if (wishMag > 0.02 && !locked) {
      const tx = wish.x * target, tz = wish.z * target;
      // opposing the current heading costs more force, which is what makes a
      // hard direction change read as a plant-and-pivot rather than a slide
      const dot = sp > 0.4 ? (vx * wish.x + vz * wish.z) / sp : 1;
      const a = accelBase * (1 + (1 - dot) * 0.5 * P.pivotBoost) * dt;
      const dx = tx - vx, dz = tz - vz;
      const d = Math.hypot(dx, dz);
      if (d <= a) { this.vel.x = tx; this.vel.z = tz; }
      else { this.vel.x += (dx / d) * a; this.vel.z += (dz / d) * a; }
    } else if (this.grounded) {
      // during a skid the boots are ploughing, not gripping: a fraction of the
      // usual friction, so the stop takes half a second and covers real ground
      const grip = this.skidT > 0 ? P.skidFric : 1;
      const drop = (P.frictionLin + sp * P.frictionProp) * dt * (locked ? 2.2 : 1) * grip;
      const k = sp > 0 ? Math.max(0, sp - drop) / sp : 0;
      this.vel.x *= k; this.vel.z *= k;
    } else {
      const k = Math.max(0, 1 - P.airDrag * dt);
      this.vel.x *= k; this.vel.z *= k;
    }

    // ---------------- jump ----------------
    const canGround = this.grounded || this.coyote > 0;
    if (ctx.jumpBuffered && !locked) {
      if (canGround) {
        ctx.consumeJump();
        this.vel.y = P.jumpV;
        this.grounded = false; this.coyote = 0; this.jumps = 1;
        this.airTime = 0; this._cutArmed = false; this._holdT = 0;
        ev.jumped = 1;
        this.state = 'air';
      } else if (this.jumps === 1) {
        ctx.consumeJump();
        this.vel.y = P.doubleV;
        // a second jump also redirects you, which is what makes it feel useful
        if (wishMag > 0.2) {
          const s = Math.max(Math.hypot(this.vel.x, this.vel.z), P.run * 0.9);
          this.vel.x = wish.x * s; this.vel.z = wish.z * s;
        }
        this.jumps = 2; this._cutArmed = false; this._holdT = 0;
        ev.doubleJumped = 1;
      } else if (this.airTime > 0.12) {
        // Out of jumps: this press means "wing". If the cadet is still going up
        // hard it cannot open yet, so the request is held rather than eaten —
        // the wing then pops the instant the arc allows it. A press the game
        // silently discards is the single most common way traversal feels bad.
        ctx.consumeJump();
        if (this.vel.y < 5) this._openGlide(ev, ctx.yaw);
        else this._glideWant = 0.5;
      }
    }
    this._glideWant = Math.max(0, (this._glideWant || 0) - dt);
    if (this._glideWant > 0 && !this.gliding && !this.grounded && this.vel.y < 5) {
      this._glideWant = 0;
      this._openGlide(ev, ctx.yaw);
    }
    // hold-to-glide: falling with the button down opens the wing
    this._holdT = ctx.jumpHeld ? (this._holdT || 0) + dt : 0;
    if (!this.gliding && !this.grounded && ctx.jumpHeld && this.jumps >= 1 &&
        this.airTime > 0.26 && this.vel.y < -1.5 && this._holdT > 0.2) {
      this._openGlide(ev, ctx.yaw);
    }
    if (ctx.glideBtn && !this.grounded && !this.gliding && this.airTime > 0.1) this._openGlide(ev, ctx.yaw);

    // Variable jump height, but only for a *deliberate* hold-and-release. A
    // quick tap gets the full jump — the alternative punishes light fingers and
    // makes every automated capture look like the cadet cannot jump.
    if (!this.grounded) {
      if (ctx.jumpHeld && this._holdT > 0.10) this._cutArmed = true;
      if (this._cutArmed && !ctx.jumpHeld) {
        this._cutArmed = false;
        if (this.vel.y > 0) this.vel.y *= P.cutJump;
      }
    }

    // ---------------- gravity ----------------
    if (!this.grounded) {
      const apex = Math.abs(this.vel.y) < P.apexWindow;
      const g = apex ? P.gravityApex : (this.vel.y > 0 ? P.gravityUp : P.gravityFall);
      this.vel.y = Math.max(P.terminal, this.vel.y - g * dt);

      // ledge grab — reach for the lip instead of sliding down the face of it
      if (this.vel.y < 3.5 && wishMag > 0.35 && this.airTime > 0.1 && !this.gliding) {
        this.tryMantle(wish.x, wish.z);
        if (this.mantleT > 0) { this._finish(dt, ctx); return ev; }
      }
    }

    this._integrate(dt);
    this._finish(dt, ctx);
    return ev;
  }

  // -------------------------------------------------------------------
  /**
   * Bank a link in the chain. `k` is how much of the bar one move is worth.
   * Nothing here is stored anywhere: flow only survives while you keep going.
   */
  _flowLink(k) {
    this.flow = THREE.MathUtils.clamp(this.flow + k, 0, 1);
  }

  /**
   * Cancel a dash into a jump, keeping the speed. Returns true if it fired,
   * in which case the caller must stop touching this frame.
   */
  _dashJump(dt, ctx, ev) {
    const onFloor = this.grounded || this.coyote > 0;
    if (!onFloor && this.jumps >= 2) return false;
    ctx.consumeJump();
    this.dashT = 0;
    // The exit cap, plus the small premium for having timed it. A dash is
    // 22 m/s and that is not a speed a body may leave the ground at; what
    // survives is a shade over a sprint, which is a long jump.
    const keep = P.sprint * P.dashExit * P.dashJump;
    this.vel.x = this.dashDir.x * keep;
    this.vel.z = this.dashDir.z * keep;
    this.vel.y = onFloor ? P.jumpV : P.doubleV;
    this.grounded = false; this.coyote = 0;
    this.airTime = 0; this._cutArmed = false; this._holdT = 0;
    this.jumps = onFloor ? 1 : 2;
    this.state = 'air';
    if (onFloor) ev.jumped = 1; else ev.doubleJumped = 1;
    ev.dashJumped = 1;
    this._flowLink(0.55);
    this._integrate(dt);
    this._finish(dt, ctx);
    return true;
  }

  /**
   * The cadet has just left the ground without jumping. If the surface he
   * left was climbing under him, the climb becomes lift.
   *
   * Sampled at the position he held at the START of the frame, because by now
   * he is over whatever is past the lip — usually nothing at all — and the
   * gradient out there says nothing about the ramp he was on.
   */
  _launch() {
    if (this.gliding || this.mantleT > 0) return;
    if (this.vel.y > 1.2) return;          // already climbing: something else did this
    const planar = Math.hypot(this.vel.x, this.vel.z);
    if (planar < P.launchSpeedMin) return;
    // A LAUNCH NEEDS A LIP, AND A LIP NEEDS SOMETHING ON THE FAR SIDE OF IT.
    //
    // The coastline of this shard rises before it ends, so without this test a
    // sprint off the north gate was *thrown* off the world — higher, further
    // out, and several seconds later into the fall-catch's arms. Running off
    // the edge of the world is a fall. A fall is not repaid.
    const dx = this.vel.x / planar, dz = this.vel.z / planar;
    if (heightAt(this.pos.x + dx * 3.5, this.pos.z + dz * 3.5) === null &&
        heightAt(this.pos.x + dx * 9, this.pos.z + dz * 9) === null) return;

    const g = gradientAt(this._prev.x, this._prev.z);
    // metres of rise per metre run, along the way he is actually going
    const rise = (g.x * this.vel.x + g.y * this.vel.z) / planar;
    if (rise < P.launchMin) return;
    // A built lip is a kicker with a machined edge; a knoll is a knoll.
    const k = onBuilt(this._prev.x, this._prev.z) ? P.launchBuilt : P.launchK;
    const v = Math.min(P.launchMax, planar * rise * k);
    if (v < 1.4) return;
    this.vel.y = Math.max(this.vel.y, v);
    this.launchPower = THREE.MathUtils.clamp((v - 1.4) / (P.launchMax - 1.4), 0, 1);
    this.ev.launched = this.launchPower;
    this._flowLink(0.20 + this.launchPower * 0.30);
  }

  // -------------------------------------------------------------------
  _openGlide(ev, yaw) {
    if (this.gliding) return;
    // A wing that unfurls half a metre off the plaza is a prop, not a wing.
    // Below head height the request is simply refused; the cadet lands instead.
    const gh = heightAt(this.pos.x, this.pos.z);
    if (gh !== null && this.pos.y - gh < 3.2) return;
    this.gliding = true;
    const planar = Math.hypot(this.vel.x, this.vel.z);
    // opening from a standstill must not hand the wing a random heading, or
    // it spends the first two seconds banking hard for no reason
    this.heading = planar > 1.2 ? Math.atan2(this.vel.x, this.vel.z)
      : (Number.isFinite(yaw) ? yaw : this.facing);
    // THE WING REPAYS THE LAUNCH.
    //
    // Upward speed is height already paid for. A wing opened at the top of a
    // ramp launch keeps it as airspeed instead of throwing it away, so the
    // distance you fly is decided by how well you left the ground rather than
    // by how high the cliff was. Opening off a standstill still gets the same
    // eleven metres a second it always did — this only ever adds.
    const climb = Math.max(0, this.vel.y);
    this.glideSpeed = THREE.MathUtils.clamp(
      Math.max(11, planar + climb * 0.85 + this.flow * 4), P.glideMin, P.glideMax);
    this.glidePitch = P.glideBase;
    this._deployT = 0.44;              // the wing catches, then settles
    this.deployT = 0.44;
    this.vel.y = Math.max(this.vel.y, -6);
    this.state = 'glide';
    ev.glideOpened = 1;
  }

  _closeGlide(ev) {
    if (!this.gliding) return;
    this.gliding = false;
    ev.glideClosed = 1;
  }

  _glide(dt, ctx, ev) {
    if (ctx.jumpBuffered) { ctx.consumeJump(); this._closeGlide(ev); this.vel.y *= 0.4; return; }
    if (ctx.glideBtn) { this._closeGlide(ev); return; }

    // The whole point of a glider is that it is *predictable*: hold the stick
    // where you like and the wing holds a steady two metres a second of sink,
    // far enough to plan a landing from a kilometre out. Trading that height for
    // speed is a deliberate act — the sprint control — not something that
    // happens because you were also asking to fly forwards. Pulling back flares.
    const dive = ctx.sprint ? 1 : 0;
    const flare = THREE.MathUtils.clamp(-ctx.stickY, 0, 1);
    const push = THREE.MathUtils.clamp(ctx.stickY, 0, 1);
    let targetPitch = P.glideBase - push * 0.030;
    if (flare > 0) targetPitch = THREE.MathUtils.lerp(targetPitch, P.glideFlare, flare);
    if (dive > 0) targetPitch = P.glideDive;
    let pitchRate = 3.4;
    // Deployment: the canopy fills and *arrests* the drop. It levels out — it
    // must not hand back altitude, or a glider becomes a jetpack and the whole
    // height-for-speed economy the wing exists for stops meaning anything.
    if (this._deployT > 0) {
      this._deployT -= dt;
      this.deployT = this._deployT;
      targetPitch = 0.04;
      pitchRate = 11;
    } else this.deployT = 0;
    this.glidePitch = THREE.MathUtils.damp(this.glidePitch, targetPitch, pitchRate, dt);

    // stall: too slow with the nose up and you drop it
    if (this.glideSpeed < P.glideMin + 1.5 && this.glidePitch > 0) {
      this.glidePitch = THREE.MathUtils.damp(this.glidePitch, -0.7, 6, dt);
    }

    // energy exchange: dv/dt = -g·sin(γ) − k·v²
    const g = 26;
    this.glideSpeed += (-g * Math.sin(this.glidePitch) - P.glideDrag * this.glideSpeed * this.glideSpeed) * dt;
    this.glideSpeed = THREE.MathUtils.clamp(this.glideSpeed, P.glideMin, P.glideMax);

    // banked turns: the camera aims, the stick banks, speed costs you turn rate
    const toCam = angleDelta(this.heading, ctx.yaw);
    const bankIn = THREE.MathUtils.clamp(ctx.stickX * 0.9 + toCam * 1.1, -1, 1);
    const rate = P.glideTurn * (1 - 0.42 * THREE.MathUtils.clamp(this.glideSpeed / P.glideMax, 0, 1));
    this.heading += bankIn * rate * dt;
    this.glideRoll = THREE.MathUtils.damp(this.glideRoll, bankIn, 4.5, dt);
    this.glideSpeed -= Math.abs(bankIn) * 2.6 * dt;

    const c = Math.cos(this.glidePitch), s = Math.sin(this.glidePitch);
    this.vel.x = Math.sin(this.heading) * this.glideSpeed * c;
    this.vel.z = Math.cos(this.heading) * this.glideSpeed * c;
    // a wing trades height for speed; it never manufactures height
    this.vel.y = Math.min(this.glideSpeed * s, 0.35);

    // wing loading: how hard the cloth is being pulled, for the cloth sim
    const gLoad = 0.35 + Math.max(0, this.glidePitch) * 1.6
      + THREE.MathUtils.clamp(this.glideSpeed / P.glideMax, 0, 1) * 0.5
      + Math.abs(this.glideRoll) * 0.35;
    this.glideLoad = THREE.MathUtils.damp(this.glideLoad, gLoad, 6, dt);
  }

  // -------------------------------------------------------------------
  _mantle(dt) {
    this.mantleT = Math.max(0, this.mantleT - dt);
    const u = 1 - this.mantleT / P.mantleTime;
    // up first, over second — the shape of a real pull-up
    const ky = THREE.MathUtils.smoothstep(u, 0, 0.62);
    const kz = THREE.MathUtils.smoothstep(u, 0.34, 1);
    this.pos.y = THREE.MathUtils.lerp(this._mFrom.y, this._mTo.y + 0.06, ky);
    this.pos.x = THREE.MathUtils.lerp(this._mFrom.x, this._mTo.x, kz);
    this.pos.z = THREE.MathUtils.lerp(this._mFrom.z, this._mTo.z, kz);
    this.vel.set(0, 0, 0);
    if (this.mantleT <= 0) {
      this.state = 'ground';
      this.grounded = true;
      this.jumps = 0; this.airDash = true;
      const d = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.vel.x = d.x * 3.4; this.vel.z = d.z * 3.4;
    }
  }

  /** Look for a ledge in front and start climbing it. Returns true if started. */
  tryMantle(dirX, dirZ) {
    if (this.mantleT > 0 || this.gliding || this.dashT > 0) return false;
    const m = Math.hypot(dirX, dirZ);
    if (m < 0.01) return false;
    const dx = dirX / m, dz = dirZ / m;
    for (const reach of [P.mantleReach, P.mantleReach * 1.5]) {
      const tx = this.pos.x + dx * reach, tz = this.pos.z + dz * reach;
      const top = groundUnder(tx, tz, 0.3);
      if (top === null) continue;
      const rise = top - this.pos.y;
      if (rise < P.mantleMin || rise > P.mantleMax) continue;
      // the top has to be somewhere you could actually stand
      const gx = gradientAt(tx, tz);
      if (Math.hypot(gx.x, gx.y) > 0.85) continue;
      // and there has to be a wall between here and there
      const mid = groundUnder(this.pos.x + dx * reach * 0.5, this.pos.z + dz * reach * 0.5, 0.2);
      if (mid === null || mid < this.pos.y + rise * 0.35) continue;
      this._mFrom.copy(this.pos);
      this._mTo.set(tx, top, tz);
      this.mantleT = P.mantleTime;
      this.state = 'mantle';
      this.gliding = false;
      this._flowLink(0.22);
      this.ev.mantled = 1;
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------
  /** True if standing at (x, z) would mean walking into a wall from height py. */
  _blocked(x, z, py) {
    const nh = groundUnder(x, z);
    if (nh === null) return false;
    const rise = nh - py;
    if (rise <= 0.03) return false;
    const step = this.scrambling ? P.scrambleStep : P.stepUp;
    if (rise > step) return true;
    const g2 = gradientAt(x, z, 0.7);
    return Math.hypot(g2.x, g2.y) > (this.scrambling ? P.scrambleSlope : P.slopeLimit);
  }

  _integrate(dt) {
    const px = this.pos.x, pz = this.pos.z, py = this.pos.y;
    this.pos.addScaledVector(this.vel, dt);

    // Walls. Two separate things stop you: ground too steep to stand on, and a
    // discrete step taller than the cadet can walk up. Testing the per-frame
    // rise alone cannot tell them apart — at running speed a 60° face rises
    // only 12cm a frame — so the slope is measured where the foot would land.
    //
    // When it *is* a wall, the move is resolved one axis at a time. Cancelling
    // the whole step instead is what made running into a hillside feel like
    // hitting an invisible full stop: the speed readout still said ten metres a
    // second while the world had not moved in a second.
    if (!(this.grounded || this.state === 'dash')) return;
    const nx = this.pos.x, nz = this.pos.z;
    if (!this._blocked(nx, nz, py)) return;

    const dx = nx - px, dz = nz - pz;
    if (this.tryMantle(dx, dz)) return;

    const freeX = Math.abs(dx) > 1e-6 && !this._blocked(nx, pz, py);
    const freeZ = Math.abs(dz) > 1e-6 && !this._blocked(px, nz, py);
    if (freeX && !freeZ) {
      this.pos.z = pz; this.vel.z *= 0.25;
    } else if (freeZ && !freeX) {
      this.pos.x = px; this.vel.x *= 0.25;
    } else {
      // a genuine corner: stop the step, keep whatever is tangential to the hill
      this.pos.x = px; this.pos.z = pz;
      const g = gradientAt(px, pz);
      const n = Math.hypot(g.x, g.y) || 1;
      const wx = -g.x / n, wz = -g.y / n;
      const into = this.vel.x * wx + this.vel.z * wz;
      if (into < 0) { this.vel.x -= wx * into * 0.92; this.vel.z -= wz * into * 0.92; }
    }
    this.ev.wallHit = 1;
  }

  _finish(dt, ctx) {
    const ev = this.ev;
    const gh = heightAt(this.pos.x, this.pos.z);
    const wasGrounded = this.grounded;
    const snap = wasGrounded && this.vel.y <= 0.1 ? 0.62 : 0.04;
    const inside = gh !== null && this.pos.y < gh - 0.001;
    const land = gh !== null && this.mantleT <= 0 &&
      (inside || (this.pos.y <= gh + snap && this.vel.y <= 0.5));

    if (land) {
      const impact = wasGrounded ? 0 : -Math.min(0, this.vel.y);
      this.pos.y = gh;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = this.vel.y <= 0.5;
      this.groundY = gh;
      if (!wasGrounded && this.grounded) {
        ev.landed = impact;
        this.jumps = 0; this.airDash = true; this._glideWant = 0;
        this.airTime = 0;
        if (this.gliding) { this._closeGlide(ev); }
        // recovery: knees absorb the drop, and the bigger the drop the longer
        // the cadet spends folded before he is a runner again
        this.landPower = THREE.MathUtils.clamp((impact - 5) / 26, 0, 1);
        this.landMax = P.landTime + (P.hardLandTime - P.landTime) * this.landPower;
        this.landT = this.landMax;
        if (impact > 30) { this.hardLand = 0.30 + this.landPower * 0.16; }
        // landing eats a slice of your speed, more the harder you hit
        const bleed = THREE.MathUtils.clamp(1 - (impact - 12) / 60, 0.55, 1);
        this.vel.x *= bleed; this.vel.z *= bleed;
        // A LANDING RUN OUT IS A LINK. Touching down still moving, and still
        // asking to move, is the hardest half of a chain and the half nobody
        // rewards; a heap on the floor (hardLand) is not.
        if (this.hardLand <= 0 && Math.hypot(this.vel.x, this.vel.z) > P.run * 0.8) {
          this._flowLink(0.18 + this.landPower * 0.16);
        }
      }
      this.groundTime += dt;
    } else {
      // Leaving the ground on your own momentum, not on a jump: whatever the
      // surface was doing under you comes with you.
      if (wasGrounded) { this.groundTime = 0; this._launch(); }
      this.grounded = false;
      this.skidT = 0;
      this.airTime += dt;
      if (gh === null) this.airTime += 0; // over the void
    }

    // steep ground: you slide, and you do not get to steer much
    if (this.grounded) {
      const g = gradientAt(this.pos.x, this.pos.z);
      const st = Math.hypot(g.x, g.y);
      // …except while the world has hold of him. Sliding a cadet back down the
      // one face he is allowed to climb is the trap with an animation on it.
      if (st > P.slideLimit && !this.scrambling) {
        if (this.slideT <= 0) ev.slideStart = 1;
        this.slideT = 0.2;
        this.vel.x -= g.x * 15 * dt;
        this.vel.z -= g.y * 15 * dt;
      }
      this.groundN.set(-g.x, 1, -g.y).normalize();
    } else {
      this.groundN.lerp(up, 1 - Math.exp(-6 * dt));
    }
    this.slideT = Math.max(0, this.slideT - dt);

    // ---- derived motion values the animator and camera both read ----
    const planar = Math.hypot(this.vel.x, this.vel.z);
    this.speed = planar;
    this.speedN = THREE.MathUtils.clamp(planar / P.sprint, 0, 1.4);
    // Flow bleeds. Keep moving and it lasts a few seconds; stand still, take a
    // wall, or land in a heap and it is gone almost at once. Nothing saves it.
    const carrying = planar > P.run * 0.55 && this.hardLand <= 0 && !ev.wallHit;
    this.flow = Math.max(0, this.flow - dt * P.flowDecay * (carrying ? 1 : P.flowDrop));
    if (planar > 0.35) {
      this.moveDir.set(this.vel.x / planar, 0, this.vel.z / planar);
      const want = Math.atan2(this.vel.x, this.vel.z);
      const prev = this.facing;
      const lambda = this.gliding ? 6 : (this.grounded ? 13 : 8);
      this.facing = dampAngle(this.facing, want, lambda, dt);
      this.turnRate = THREE.MathUtils.damp(this.turnRate, angleDelta(prev, this.facing) / Math.max(dt, 1e-4), 8, dt);
    } else {
      this.turnRate = THREE.MathUtils.damp(this.turnRate, 0, 8, dt);
    }

    if (this.mantleT > 0) this.state = 'mantle';
    else if (this.dashT > 0) this.state = 'dash';
    else if (this.gliding) this.state = 'glide';
    else if (this.slideT > 0) this.state = 'slide';
    else this.state = this.grounded ? 'ground' : 'air';

    this.glideOpen = THREE.MathUtils.damp(this.glideOpen, this.gliding ? 1 : 0, this.gliding ? 13 : 9, dt);

    // rim guard: the island lets you leave, it just makes you mean it
    const r = Math.hypot(this.pos.x, this.pos.z);
    const R = RIM() * 1.62;
    if (r > R) { const k = R / r; this.pos.x *= k; this.pos.z *= k; }
  }
}

export function dampAngle(a, b, lambda, dt) {
  return a + angleDelta(a, b) * (1 - Math.exp(-lambda * dt));
}

export function angleDelta(a, b) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export { heightAt };
