import * as THREE from 'three';
import { Locomotion, P, angleDelta, dampAngle } from './locomotion.js';
import { buildCadet, buildGhost } from './rig.js';
import { buildGlider } from './glider.js';
import { Animator } from './animator.js';
import { CameraRig } from './camera.js';
import { PlayerFX } from './effects.js';
import { ScreenFeel } from './screen.js';
import { heightAt, gradientAt, slopeAt, outsideWorld, deck, landingNear } from './terrain.js';
import { GrassPush } from './grasspush.js';

const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;

/**
 * The cadet, assembled.
 *
 * This class owns nothing clever — locomotion does the physics, the animator
 * does the pose, the rig does the camera. What lives here is the wiring
 * between them and, more importantly, the *reactions*: every locomotion event
 * gets a sound-shaped burst of dust, camera kick, FOV punch and rumble, so a
 * single button press lands in four senses at once.
 */
export class Player {
  constructor(scene, camera, input, renderer = null) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;

    this.loco = new Locomotion();
    this.pos = this.loco.pos;          // shared refs: teleports still work
    this.vel = this.loco.vel;
    this.pos.set(0, (heightAt(0, 26) ?? 12) + 0.4, 26);

    this.root = new THREE.Group();
    scene.add(this.root);

    this.rig = buildCadet();
    this.root.add(this.rig.root);
    this.anim = new Animator(this.rig);

    this.gliderRig = buildGlider();
    this.root.add(this.gliderRig.group);

    this.fx = new PlayerFX(scene, renderer, camera);
    this.screen = new ScreenFeel();

    // dash after-images
    this.ghosts = [];
    for (let i = 0; i < 6; i++) {
      const g = buildGhost();
      scene.add(g.group);
      this.ghosts.push({ ...g, t: 0 });
    }
    this._ghostTimer = 0;

    this.cam = new CameraRig(camera, scene);
    // the boom must never treat the cadet's own hardware as scenery
    this.root.traverse((o) => { o.userData.noCamBlock = true; });
    this.yaw = Math.PI;
    this.pitch = -0.14;
    this.groundW = 0;
    this.dashW = 0;
    this.accelLean = 0;
    this.slopePitch = 0;
    this.slopeRoll = 0;
    this._prevVel = new THREE.Vector3();
    this._mark = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._localVel = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._q = new THREE.Quaternion();
    this._qTarget = new THREE.Quaternion();
    this.time = 0;
    this.autoTurn = 0;
    this._turnFoot = 0;

    // ---- getting unstuck ---------------------------------------------------
    // Where the cadet made planetfall, and the place recovery falls back to.
    this.home = this.pos.clone();
    /** True while the world has hold of the player and the player knows it. */
    this.stuck = false;
    this._stuckT = 0;
    this._stuckAt = new THREE.Vector3();
    this._winMark = this.pos.clone();
    this._winT = 0;
    this._winWish = 0;
    this._recovered = 0;
    /** Fired when `stuck` changes, so the interface can offer the way out. */
    this.onStuck = null;
    /** Fired after a recovery, with the reason, so the interface can say so. */
    this.onRecover = null;
    /** True while the cadet is over open air with the island above them. */
    this.falling = false;
    this._fellT = 0;
    /** Recoveries the fall-catch has performed. Read by the gate. */
    this.caught = 0;
    /** Every recovery, however it was asked for. A key that fires is a key
     *  that leaves a mark — "nothing visibly moved" is not proof it worked. */
    this.recoveries = 0;

    this.anim.onStep = (foot, power) => this._footstep(foot, power);

    // The meadow bends around him. Attached from main.js once the world exists.
    this.grass = null;
  }

  /**
   * Hand the player the world's grass so the blades can lean away from him.
   * Optional by construction: if the world has no grass, or the world team has
   * since rewritten its shader, this quietly does nothing.
   */
  attachGrass(grass) { this.grass = new GrassPush(grass); }

  /** Terrain probe, for tools that need to reason about where to stand. */
  groundAt(x, z) { return heightAt(x, z); }

  // ---------------------------------------------------------------------------
  // GETTING UNSTUCK
  //
  // A critic ran into the hills, wedged the cadet in the terrain with the lens
  // inside a rock face, and found no compass, no map, no waypoint, no
  // out-of-bounds reset and no way back except reloading the browser. A game
  // that can be ended by walking into a hill is not shippable to a classroom,
  // where the reload also costs the run.
  //
  // Three things fix that, and all three live here. The camera never sits
  // inside geometry (src/player/camera.js). The player is *told* when the world
  // has hold of them, without having to work it out. And there is one verb —
  // one key, one button, one tap — that always puts them back on solid ground.
  // ---------------------------------------------------------------------------

  /**
   * The one verb that may never be dropped, on its own line.
   *
   * Ticked every frame from main.js — including the frames where a panel owns
   * the screen and `update()` is not running — because a key the controls card
   * documents and the game then ignores is worse than no key at all.
   */
  pumpRecover() {
    const inp = this.input;
    if (inp && inp.pressed('recover') && inp.consume('recover')) {
      this.recover('asked');
      return true;
    }
    return false;
  }

  /**
   * Notice a cadet who is trying to move and going nowhere, and a cadet who is
   * somewhere the world does not have a floor.
   */
  _unstick(dt, wishMag) {
    if (this.pumpRecover()) return;

    const p = this.pos;
    const h = heightAt(p.x, p.z);
    // Buried: the surface over this column is above the cadet's own head.
    const buried = h !== null && h > p.y + 1.15;
    // Out of bounds: past the point where the island can still be reached.
    const outside = h === null && p.y < deck() + 12;
    // Buried and out of bounds are facts, and are answered fast.
    if (buried || outside) this._stuckT += dt * 3.2;

    // Shoving into something is only evidence, and instantaneous speed is the
    // wrong evidence: wedged against a hillside the cadet still twitches, and
    // one frame over the threshold every half second was enough to keep a
    // per-frame test permanently reset while the player went precisely nowhere
    // for twenty seconds. So the question is asked over a window — *did you
    // ask to move, and did you get anywhere* — which is the question a person
    // stuck in a rock face is actually asking.
    this._winT += dt;
    this._winWish += wishMag * dt;
    if (this._winT >= 0.9) {
      const asked = this._winWish / this._winT;
      const got = p.distanceTo(this._winMark);
      const futile = asked > 0.5 && got < 1.0
        && !this.loco.gliding && this.loco.mantleT <= 0 && this.loco.dashT <= 0;
      if (futile) this._stuckT += this._winT;
      else if (!buried && !outside) this._stuckT = Math.max(0, this._stuckT - this._winT * 2);
      this._winMark.copy(p);
      this._winT = 0;
      this._winWish = 0;
    }

    // ONCE OFFERED, THE WAY OUT STAYS ON SCREEN. The obvious implementation —
    // clear it the moment the stuck evidence stops — takes the prompt away the
    // instant the player lets go of the stick to read it, which is the one
    // moment it has to be there. So it latches, and the only things that clear
    // it are recovering, or actually getting somewhere.
    //
    // AND IT DOES NOT CLEAR ON MOTION ALONE. Moving two and a half metres used
    // to be proof that the world had let go, which is true of a rock face and
    // flatly false of a fall: a cadet dropping at fifty-eight metres a second
    // clears the threshold every twentieth of a second, so the prompt offering
    // the way out strobed on and off for the entire descent and read as noise.
    // Getting somewhere means getting somewhere you can stand.
    if (!this.stuck) {
      if (this._stuckT > 1.7) {
        this.stuck = true;
        this._stuckAt.copy(p);
        this.onStuck?.(true);
      }
    } else if (!buried && !outside && p.distanceToSquared(this._stuckAt) > 2.5 * 2.5) {
      this.stuck = false;
      this._stuckT = 0;
      this.onStuck?.(false);
    }
    // Buried is not a suggestion — the frame is full of rock and the player
    // cannot see the prompt they are being offered. Free them.
    if (buried && this._stuckT > 2.6 && this.time - this._recovered > 2) {
      this.recover('buried');
    }
  }

  /**
   * Leaving the playable volume always ends the same way: on solid ground.
   *
   * The grace period exists so the catch is a beat rather than a snap — the
   * player gets long enough to see the island above them and understand what
   * they did, and not one second longer. It is deliberately short, because the
   * thing being fixed is a session that ended in a beige void.
   */
  _catch(dt) {
    const p = this.pos;
    let why = outsideWorld(p.x, p.y, p.z);

    // ---- …AND A FALL IS A FALL BEFORE IT IS HOPELESS ----------------------
    //
    // `outsideWorld` answers the question *can this cadet ever get back*, and
    // it answers it exactly (src/player/terrain.js). But exactly is not the
    // same as soon enough, and the gap between them was costing seconds that
    // felt like the end of the session.
    //
    // Walk off a seventy-metre cliff and, for the whole of the drop, you CAN
    // still get back: the wing turns height into distance at seven and a half
    // to one and you have seventy metres of it. The reach test is right to
    // leave you alone — and a child who has just walked off a cliff and is not
    // pressing anything does not experience three seconds of "you still have
    // options", he experiences three seconds of nothing happening. A cold gate
    // measured that as 3.1 s outside the world and counted it, correctly, as a
    // failure of the promise.
    //
    // So the wing is made the difference, which is what it is for. **Open it
    // and you are flying**: the reach test governs, the whole glide is yours,
    // and nothing interrupts it until the island really is out of range.
    // **Leave it shut and you are falling**, and falling ends the way falling
    // should end — on solid ground, about a second and a half later, before
    // there is time to wonder whether the game is over.
    //
    // This is only safe because of a fact about this island, and the fact is
    // checked rather than assumed: it has no holes in it. Every point where the
    // heightfield answers nothing is joined to the open air outside the
    // coastline, so there is no gap to jump and no crevasse to drop into —
    // being over open air here means being off the shard. `landingNear` covers
    // the one thing that is not the island: a deck the cadet built himself.
    if (!why && !this.loco.grounded && !this.loco.gliding
      && this.vel.y < -2 && heightAt(p.x, p.z) === null
      && !landingNear(p.x, p.y, p.z)) {
      why = 'fell';
    }

    if (!why) {
      this.falling = false;
      this._fellT = 0;
      return;
    }
    this.falling = true;
    this._fellT += dt;
    // Through the terrain, or under the floor, is answered on the frame it is
    // seen: there is nothing to look at down there and nothing to understand.
    // A fall gets a beat — long enough to see the shard go past overhead and
    // to reach for the wing, and not one second longer. Reaching for it works:
    // the wing clears the test above on the frame it opens, and the beat is
    // abandoned rather than merely paused.
    const grace = why === 'fell' ? 0.9 : 0;
    if (this._fellT < grace) return;
    this._fellT = 0;
    this.falling = false;
    this.caught++;
    this.recover(why === 'under' ? 'buried' : 'fell');
    this.onFall?.(why);
  }

  /**
   * Put the cadet back on solid ground, wherever they are and whatever they
   * are inside of. Never fails: the landing site is the floor of last resort.
   */
  recover(reason = 'asked') {
    const p = this.pos;
    // A recovery from something that had hold of you has to *move* you. Landing
    // back on the same square metre, pressed against the same wall, is a button
    // that does nothing as far as the player can tell — so when the world had
    // hold, the search starts one ring out and the cadet visibly steps clear.
    // `boxed` is written by src/build/builder.js when the cadet's own lattice
    // has closed over him. It belongs in this list for exactly the reason the
    // others are here: recovering onto the same square metre, still inside the
    // same four walls, is a button that did nothing.
    //
    // …AND SO DOES A RECOVERY THE PLAYER ASKED FOR, which is the correction
    // this line is carrying. `asked` used to land the cadet exactly where he
    // already stood whenever the ground under him was fine, on the theory that
    // there was nothing to recover from. But nobody presses Recover from a
    // place they are happy in. Pressing it *is* the report: "I am somewhere
    // this game has stopped working and I do not know how to leave." A cold
    // critic pressed it three separate times from a spot where the objective
    // card had gone blank, was set down on the same square metre each time, and
    // logged the key as a no-op — which, from where he was sitting, it was.
    //
    // The stranding itself is fixed where it was caused (src/meta/guide.js and
    // src/world/rifts.js: the card can no longer go quiet). This is the promise
    // underneath that fix, and it does not depend on having predicted the
    // state: **the way out always visibly moves you, onto open ground you can
    // stand on, every single time it is pressed.** It costs a step and a half.
    const away = this.stuck || this.boxed
      || reason === 'buried' || reason === 'fell' || reason === 'asked';
    // Off the shard entirely: come back over the lip you left, not to the
    // landing site. Being set down two hundred metres from what you were doing
    // is a second punishment on top of the fall, and it is the one that makes a
    // player stop trusting the edge of the map for the rest of the session.
    // …and it comes back *inland* of the lip, not onto it. Setting a cadet
    // down on the outermost metre of ground he just walked off means the key he
    // is still holding walks him straight off again, which reads as a recovery
    // that did not work.
    const off = heightAt(p.x, p.z) === null;
    const back = off ? this._shoreward(p.x, p.z) : null;
    const spot = (back && this._safeSpot(back.x, back.z, 0))
      || this._safeSpot(p.x, p.z, away ? 3.5 : 0)
      || this._safeSpot(this.home.x, this.home.z, 0)
      || this._safeSpot(0, 0, 0)
      || { x: this.home.x, y: this.home.y, z: this.home.z };

    p.set(spot.x, spot.y, spot.z);
    this.recoveries++;
    this.vel.set(0, 0, 0);
    const L = this.loco;
    L.gliding = false; L.glideOpen = 0; L.jumps = 0;
    L.grounded = true; L.airTime = 0; L.dashT = 0; L.mantleT = 0;
    // The lens is re-founded rather than flown, or the recovery is a two second
    // pan out of the inside of a hill.
    this.cam._first = true;
    this._stuckT = 0;
    this._recovered = this.time;
    if (this.stuck) { this.stuck = false; this.onStuck?.(false); }
    this.onRecover?.(reason);
    return spot;
  }

  /**
   * The first ground on the way home. Walks the bearing the cadet is on back
   * toward the middle of the island until the heightfield answers, so a fall
   * off the west cliff comes back on the west cliff.
   */
  _shoreward(x, z) {
    const r = Math.hypot(x, z);
    if (r < 1) return null;
    const ux = x / r, uz = z / r;
    for (let d = r; d > 0; d -= 3) {
      // Well inside whatever lip answers first. Far enough that the brink
      // (src/world/verge.js) is in front of the cadet rather than under him,
      // and that a still-held movement key does not immediately undo this.
      if (heightAt(ux * d, uz * d) !== null) {
        const k = Math.max(0, d - 16);
        return { x: ux * k, z: uz * k };
      }
    }
    return null;
  }

  /**
   * The nearest place a person could stand, searched outward in rings. Flat
   * ground is preferred over a slope, because being put down on a 40° face is
   * how you end up sliding straight back into the thing you were stuck in.
   */
  _safeSpot(x0, z0, minR = 0) {
    const RINGS = [0, 3.5, 7, 12, 18, 26, 36].filter((r) => r >= minR);
    let best = null;
    for (const r of RINGS) {
      const n = r === 0 ? 1 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
        const h = heightAt(x, z);
        if (h === null) continue;
        const s = slopeAt(x, z);
        const score = r + s * 9;
        if (!best || score < best.score) best = { x, y: h + 0.55, z, score };
      }
      // A whole ring of good ground: no reason to look further out.
      if (best && best.score < r + 3) break;
    }
    return best;
  }

  // getters other systems already rely on
  get grounded() { return this.loco.grounded; }
  get gliding() { return this.loco.gliding; }
  get speed() { return this.loco.speed; }

  update(dt, time) {
    const inp = this.input;
    this.time = time;

    // ---------------- look ----------------
    this.yaw -= inp.look.x;
    this.pitch = clamp(this.pitch - inp.look.y, -1.15, 0.92);

    // pad and touch recentre behind you when you stop aiming, like a console
    // third-person game; a mouse never gets its aim taken away.
    if (inp.source !== 'kbm' && inp.idleLook > 1.1 && this.loco.speed > 2.5 && !this.loco.gliding) {
      const d = angleDelta(this.yaw, this.loco.facing);
      this.yaw += d * (1 - Math.exp(-1.6 * dt));
      this.pitch = damp(this.pitch, -0.13, 1.2, dt);
    }

    // ---------------- wish direction ----------------
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    // Camera-relative basis. Forward is (fx, 0, fz); screen-right is
    // cross(forward, up) = (-fz, 0, fx). Using (fz, 0, -fx) here is the LEFT
    // vector, which silently swapped A and D for the whole project.
    const wish = this._wish.set(
      -fz * inp.move.x + fx * inp.move.y,
      0,
      fx * inp.move.x + fz * inp.move.y,
    );
    const wishMag = clamp(inp.moveMag || wish.length(), 0, 1);
    if (wish.lengthSq() > 1e-6) wish.normalize();

    // ---------------- step physics ----------------
    const ctx = {
      wish, wishMag, sprint: inp.sprint, yaw: this.yaw,
      stickX: inp.move.x, stickY: inp.move.y,
      jumpBuffered: inp.pressed('jump'), jumpHeld: inp.held('jump'),
      consumeJump: () => inp.consume('jump'),
      dash: inp.pressed('dash') && inp.consume('dash'),
      glideBtn: inp.pressed('glide') && inp.consume('glide'),
    };
    const L = this.loco;
    const prevVy = this.vel.y;
    const ev = L.update(dt, ctx);

    // THE FALL-CATCH. See the header of src/player/terrain.js for why this is
    // a volume test and not the `y < -180` depth test it replaces.
    this._catch(dt);

    // Nothing in this game may ever require a page reload. (src/player)
    this._unstick(dt, wishMag);

    // ---------------- reactions ----------------
    this._react(ev, dt, prevVy);

    // ---------------- turn in place ----------------
    // Standing still, `facing` is only ever written by the velocity, so a player
    // who spins the camera all the way round a stationary cadet is looking at a
    // mannequin on a turntable: the body keeps staring off in whatever direction
    // it was last running. Past about fifty degrees of twist the feet shuffle
    // round to meet the camera and stop short of it, which is exactly what a
    // person does — the head and shoulders keep the rest of the offset, and the
    // animator is already leading with them.
    if (L.grounded && L.speed < 0.7 && !L.gliding && L.mantleT <= 0 && L.dashT <= 0) {
      const d = angleDelta(L.facing, this.yaw);
      const slack = 0.52;
      if (Math.abs(d) > 0.90) {
        const goal = this.yaw - Math.sign(d) * slack;
        const was = L.facing;
        L.facing = dampAngle(L.facing, goal, 5.5, dt);
        const moved = Math.abs(angleDelta(was, L.facing));
        this.autoTurn += moved;
        // the pivot scuffs: one puff per ~35° of shuffle, alternating feet
        if (this.autoTurn > 0.62) {
          this.autoTurn = 0;
          this._footstep(this._turnFoot ^= 1, 0.30);
        }
      }
    } else this.autoTurn = 0;

    // ---------------- body transform ----------------
    this.root.position.copy(this.pos);
    const face = L.gliding ? L.heading : L.facing;
    this.root.rotation.y = face;

    // slope-aware stance: the body tilts with the ground it is standing on
    const g = gradientAt(this.pos.x, this.pos.z);
    const cf = Math.cos(face), sf = Math.sin(face);
    const along = g.x * sf + g.y * cf;         // uphill component ahead
    const across = g.x * cf - g.y * sf;
    const gw = L.grounded ? 1 : 0;
    this.slopePitch = damp(this.slopePitch, clamp(-along, -0.7, 0.7) * gw, 5, dt);
    this.slopeRoll = damp(this.slopeRoll, clamp(across, -0.6, 0.6) * gw, 5, dt);

    // acceleration lean — leaning into a start and out of a stop
    const ax = (this.vel.x - this._prevVel.x) / Math.max(dt, 1e-4);
    const az = (this.vel.z - this._prevVel.z) / Math.max(dt, 1e-4);
    const fwdA = ax * sf + az * cf;
    this.accelLean = damp(this.accelLean, clamp(fwdA * 0.011, -0.22, 0.34), 7, dt);
    this._prevVel.copy(this.vel);

    this.groundW = damp(this.groundW, L.grounded || L.mantleT > 0 ? 1 : 0, L.grounded ? 22 : 13, dt);
    this.dashW = damp(this.dashW, L.dashT > 0 ? 1 : 0, L.dashT > 0 ? 30 : 9, dt);

    // ---------------- animation ----------------
    // Velocity in the body's own frame. X is along body-right (-cf, 0, sf) and
    // Z along body-forward (sf, 0, cf) — the same handedness the wish vector
    // uses, so a strafe leans the way the cadet is actually travelling.
    this._localVel.set(
      -this.vel.x * cf + this.vel.z * sf,
      this.vel.y,
      this.vel.x * sf + this.vel.z * cf,
    );
    this.anim.lookYaw = damp(this.anim.lookYaw, clamp(angleDelta(face, this.yaw), -1.0, 1.0), 6, dt);
    this.anim.lookPitch = damp(this.anim.lookPitch, clamp(this.pitch, -0.7, 0.6), 6, dt);

    const glideW = L.glideOpen;

    // The wing flies the flight path; the body hangs off it. Its transform has
    // to be committed *before* the animator runs, because the hand IK reads the
    // real control bar out of the scene graph rather than guessing where it is.
    this.gliderRig.setOpen(glideW);
    if (glideW > 0.004) {
      this.gliderRig.group.rotation.x = L.glidePitch * 0.95;
      this.gliderRig.group.rotation.z = -L.glideRoll * 0.48;
      this.gliderRig.update(dt, {
        speed: L.glideSpeed, load: L.glideLoad, deploy: L.deployT,
      });
    }
    this.root.updateMatrixWorld(true);

    // The recovery's *blend weight* is not the same curve as its progress.
    // Fading it out linearly from the first frame meant the deepest, most
    // compressed instant of the absorb — which happens 40% of the way through —
    // was only ever mixed in at 60%, with the run cycle showing through the
    // other 40%. The landing therefore never looked like a landing. The pose
    // now owns the body outright while the knees are folded and only hands it
    // back on the way up.
    const landU = L.landT > 0 ? 1 - clamp(L.landT / Math.max(0.001, L.landMax), 0, 1) : 1;
    const landW = L.landT > 0
      ? (landU < 0.5 ? 1 : Math.pow(1 - (landU - 0.5) / 0.5, 1.3))
      : 0;
    const skidW = L.skidT > 0 ? 1 : 0;
    this.anim.update(dt, {
      speed: L.speed, speedN: clamp(L.speed / P.sprint, 0, 1),
      grounded: L.grounded, groundW: this.groundW,
      airTime: L.airTime, vy: this.vel.y,
      glideW, glidePitch: L.glidePitch, glideRoll: L.glideRoll,
      dashW: this.dashW,
      mantleW: L.mantleT > 0 ? 1 : 0,
      mantleU: L.mantleT > 0 ? 1 - L.mantleT / P.mantleTime : 0,
      landW: landW * (1 - glideW), landU, landPower: L.landPower,
      skidW: skidW * (1 - glideW),
      skidU: 1 - clamp(L.skidT / Math.max(0.001, L.skidMax), 0, 1),
      skidPower: L.skidPower,
      turnRate: L.turnRate, accelLean: this.accelLean,
      slopePitch: this.slopePitch * (1 - glideW),
      slopeRoll: this.slopeRoll * (1 - glideW),
      rollTarget: -L.glideRoll * 0.55 * glideW + clamp(-L.turnRate * 0.06, -0.18, 0.18) * (1 - glideW),
      localVel: this._localVel, time,
      groundDelta: (lx, lz) => this._groundDelta(lx, lz, cf, sf),
    });

    // hands onto the bar, solved against the wing that is actually in the scene
    if (glideW > 0.05) this.anim.gripBar(this.gliderRig, smoothRange(glideW, 0.05, 0.55));

    // skidding ploughs a continuous plume off both boots
    if (L.skidT > 0 && L.speed > 1.5) {
      const m = Math.max(0.001, L.speed);
      const bx = this.pos.x - (this.vel.x / m) * 0.18;
      const bz = this.pos.z - (this.vel.z / m) * 0.18;
      this.fx.slide(bx, heightAt(bx, bz) ?? this.pos.y, bz, this.vel.x / m, this.vel.z / m,
        clamp(L.speed / 9, 0, 1) * L.skidPower, dt, this.root.rotation.y);
    }

    this._ghosts(dt);

    // ---------------- landing marker ----------------
    // Where the boots are going to land, drawn on the ground, whenever the
    // cadet is high enough that it is a question worth asking.
    const groundY = heightAt(this.pos.x, this.pos.z);
    const agl = this.pos.y - (groundY ?? this.pos.y);
    // the near half of the altimeter: an occlusion patch under the boots that
    // spreads and pales with height, below where the ballistic ring starts
    this.fx.contactPatch(this.pos.x, groundY, this.pos.z, agl, dt);
    const wantMark = !L.grounded && L.mantleT <= 0 && (agl > 4.5 || L.gliding);
    this.fx.landingMark(
      wantMark ? this._predictLanding() : null,
      clamp((agl - 4) / 10, 0, 1) * (L.gliding ? 1 : 0.8),
      dt,
    );

    // ---------------- camera ----------------
    const sn = clamp(L.speed / P.sprint, 0, 1);
    this.cam.update(dt, {
      pos: this.pos, vel: this.vel, yaw: this.yaw, pitch: this.pitch,
      speedN: sn, gliding: L.gliding, glideRoll: L.glideRoll, glidePitch: L.glidePitch,
      dashW: this.dashW, turnRate: L.turnRate, time,
      grounded: L.grounded, airTime: L.airTime, flow: L.flow,
    });
    this.pitch = this.cam.pitch;

    // ---------------- screen ----------------
    const glideFast = L.gliding ? clamp((L.glideSpeed - 16) / 20, 0, 1) : 0;
    const rush = clamp(Math.max(smoothRange(sn, 0.72, 1.0), this.dashW * 0.85, glideFast), 0, 1);
    this.screen.update(dt, rush, 1 + sn);

    // the meadow leans away from the boots, and stands back up behind them
    if (this.grass) {
      const push = (L.grounded ? 1 : clamp(1 - agl / 1.6, 0, 1))
        * (0.55 + 0.45 * clamp(L.speed / P.run, 0, 1));
      this.grass.update(dt, this.pos, push, 0.88 + sn * 0.42, 0.62);
    }

    this.fx.update(dt);
  }

  // ------------------------------------------------------------------
  _react(ev, dt, prevVy) {
    const L = this.loco, fx = this.fx, cam = this.cam, inp = this.input;
    const p = this.pos;

    if (ev.jumped) {
      fx.jump(p.x, p.y, p.z, 1, this.root.rotation.y);
      cam.punchFov(-2.4);
      cam.shake(0.10);
      this.anim.squashV += 1.4;              // a little stretch off the ground
      inp.rumble(0.25, 60, 0.15);
    }
    // THE LAUNCH. The head of a ramp throws you, and it has to be felt as a
    // throw and not as a step off a kerb: the boots kick a wedge of grit
    // backwards off the lip, a ring marks the place you left, and the lens
    // drops behind you as the ground stops being underneath.
    if (ev.launched > 0) {
      const k = ev.launched;
      const m = Math.max(0.001, L.speed);
      fx.dust.emit(p.x, p.y + 0.12, p.z, 8 + Math.round(k * 14), {
        spread: 0.22, out: 1.1, up: 1.4 + k * 1.6, size: 0.22 + k * 0.18,
        life: 0.58, c: [0.88, 0.84, 0.76], alpha: 0.36 + k * 0.30,
        dx: -this.vel.x / m * 3.4, dz: -this.vel.z / m * 3.4, grav: 1.1, growth: 2.0,
      });
      fx.ring(p.x, p.y, p.z, {
        s0: 0.6, s1: 1.9 + k * 2.6, dur: 0.32 + k * 0.20,
        color: 0xdff0ff, a0: 0.26 + k * 0.28, lift: 0.22,
      });
      cam.punchFov(-1.6 - k * 3.4);
      cam.shake(0.06 + k * 0.14);
      cam.impact(-0.10 - k * 0.22, 0.5);
      this.anim.squashV += 0.7 + k * 1.1;
      inp.rumble(0.22 + k * 0.36, 70, 0.14 + k * 0.16);
    }
    // A dash cancelled into a jump: the lens snaps wide, because the cadet has
    // just kept a speed the game would otherwise have taken off him.
    if (ev.dashJumped) {
      cam.punchFov(5.5);
      this.screen.flash(0.16);
      inp.rumble(0.45, 95, 0.22);
    }
    if (ev.doubleJumped) {
      fx.airJump(p.x, p.y, p.z);
      cam.punchFov(4.5);
      cam.shake(0.16);
      this.anim.frontflip();
      this.screen.flash(0.2);
      inp.rumble(0.4, 80, 0.3);
    }
    if (ev.landed > 0) {
      const power = clamp((ev.landed - 6) / 26, 0, 1);
      fx.land(p.x, p.y, p.z, power, this.root.rotation.y);
      this.anim.land(power);
      // the drop goes through the tripod: 15cm off a hop, 80cm off a cliff
      cam.impact(0.14 + power * 0.62, 0.36 + power * 0.42);
      cam.shake(0.14 + power * 0.62);
      cam.punchFov(2 + power * 7);
      // the lens shove is a fraction of the boom, and the boom is now short —
      // 2 m of push on a 3.8 m arm buries the camera in his back
      cam.push(0.30 + power * 0.80, 0.55 + power * 0.35);
      if (power > 0.4) this.screen.flash(power * 0.4);
      inp.rumble(0.2 + power * 0.7, 70 + power * 120, 0.2 + power * 0.5);
    }
    if (ev.skidStart > 0) {
      const k = ev.skidStart;
      const m = Math.max(0.001, L.speed);
      fx.dust.emit(p.x, p.y + 0.16, p.z, 10 + Math.round(k * 14), {
        ring: 0, spread: 0.24, out: 1.5, up: 1.9 + k * 1.4, size: 0.26 + k * 0.20,
        life: 0.62, c: [0.88, 0.83, 0.74], alpha: 0.44 + k * 0.30,
        dx: -this.vel.x / m * 3.2, dz: -this.vel.z / m * 3.2, grav: 1.0, growth: 2.0,
      });
      fx.ring(p.x, p.y, p.z, {
        s0: 0.5, s1: 1.8 + k * 2.4, dur: 0.34 + k * 0.18,
        color: 0xf1e7d5, a0: 0.30 + k * 0.26, lift: 0.16,
      });
      cam.shake(0.06 + k * 0.10);
      cam.punchFov(-1.6 - k * 1.6);
      cam.impact(0.05 + 0.08 * k, 0.5);
      inp.rumble(0.3 * k, 220, 0.25 * k);
    }
    if (ev.dashed) {
      fx.dash(p.x, p.y, p.z, L.dashDir.x, L.dashDir.z);
      cam.punchFov(6.5);
      cam.shake(0.24);
      this.screen.flash(0.32);
      this._ghostTimer = 0;
      inp.rumble(0.55, 110, 0.35);
    }
    if (ev.glideOpened) {
      // the canopy cracks open: pressure burst, the lens jolts and pulls back
      fx.glideOpen(p.x, p.y, p.z);
      cam.punchFov(-7);
      cam.shake(0.22);
      cam.impact(-0.30, 0.55);
      this.screen.flash(0.14);
      inp.rumble(0.55, 180, 0.35);
    }
    if (ev.glideClosed && !L.grounded) {
      cam.punchFov(3);
      cam.shake(0.08);
    }
    if (ev.mantled) {
      cam.shake(0.12);
      fx.dust.emit(p.x, p.y + 1.2, p.z, 5, {
        spread: 0.3, out: 0.8, up: 0.4, size: 0.18, life: 0.4,
        c: [0.82, 0.79, 0.72], alpha: 0.5, grav: 1.4,
      });
      inp.rumble(0.35, 100, 0.25);
    }
    if (ev.wallHit && L.speed > 5) cam.shake(0.08);
    if (ev.sprintOn) {
      // the legs commit: the lens snaps wide and the boots throw grit
      cam.punchFov(-3.2);
      cam.shake(0.07);
      const m = Math.max(0.001, L.speed);
      fx.dust.emit(p.x, p.y + 0.14, p.z, 12, {
        ring: 1, spread: 0.26, out: 2.2, up: 1.8, size: 0.24, life: 0.52,
        c: [0.88, 0.84, 0.75], alpha: 0.48,
        dx: -this.vel.x / m * 2.2, dz: -this.vel.z / m * 2.2, grav: 1.1, growth: 2.0,
      });
      inp.rumble(0.35, 90, 0.3);
    }

    // sliding kicks up a continuous plume
    if (L.slideT > 0 && L.grounded && L.speed > 2) {
      fx.slide(p.x, p.y, p.z, this.vel.x / L.speed, this.vel.z / L.speed,
        clamp(L.speed / 8, 0, 1), dt, this.root.rotation.y);
      if (Math.random() < dt * 8) cam.shake(0.03);
    }
    // sprinting hums through the chassis
    if (L.grounded && L.speed > P.run * 1.05) cam.shake(0.006);
  }

  /**
   * A foot has just met the ground.
   *
   * The step is placed where the boot actually is — offset across the stance
   * and forward along the stride — because a print that appears under the
   * cadet's navel is worse than no print. Everything else about contact
   * (the mark, the scuff, the grit, the ring) is the effects layer's job; what
   * belongs here is the part the *player* feels: the lens dips on the plant,
   * and a sprint step is felt in the hands.
   */
  _footstep(foot, power) {
    const L = this.loco;
    if (!L.grounded) return;
    const face = this.root.rotation.y;
    const s = Math.sin(face), c = Math.cos(face);
    const lx = foot === 0 ? -0.115 : 0.115;
    const lz = 0.16 + power * 0.20;             // the boot lands ahead of the hips
    const x = this.pos.x + c * lx + s * lz;
    const z = this.pos.z - s * lx + c * lz;
    const y = heightAt(x, z) ?? this.pos.y;
    const m = Math.max(0.001, L.speed);
    this.fx.step(x, y, z, power, this.vel.x / m, this.vel.z / m, face);
    if (power > 0.55) this.cam.shake(0.018 * power);
    this.cam.heightV -= 0.10 * power;
    if (power > 0.7) this.input.rumble(0.10 * power, 40, 0.05);
  }

  /**
   * Ballistic touchdown point. Steps the current arc forward against the
   * heightfield — under the wing the path is a straight line, in freefall it is
   * a parabola — and reports the first place it meets the ground.
   */
  _predictLanding() {
    const L = this.loco;
    let x = this.pos.x, y = this.pos.y, z = this.pos.z;
    let vy = this.vel.y;
    const vx = this.vel.x, vz = this.vel.z;
    // The step scales with how much height there is left to lose, so a
    // kilometre-long glide and a two-metre hop both resolve in the same
    // fixed number of samples.
    const agl = y - (heightAt(x, z) ?? y - 60);
    const step = clamp(agl / (Math.abs(vy) + 1.2) / 38, 0.05, 0.75);
    let voids = 0;
    for (let i = 0; i < 42; i++) {
      x += vx * step; z += vz * step; y += vy * step;
      if (!L.gliding) vy = Math.max(P.terminal, vy - P.gravityFall * step);
      const h = heightAt(x, z);
      // crossing open air between two islands is not a reason to give up
      if (h === null) { if (++voids > 10) return null; continue; }
      voids = 0;
      if (y <= h) { this._mark.set(x, h, z); return this._mark; }
    }
    return null;
  }

  /** Terrain height under a foot, relative to the height under the hips. */
  _groundDelta(lx, lz, cf, sf) {
    const x = this.pos.x + cf * lx + sf * lz;
    const z = this.pos.z - sf * lx + cf * lz;
    const h = heightAt(x, z);
    if (h === null) return 0;
    return clamp(h - this.pos.y, -0.42, 0.42);
  }

  _ghosts(dt) {
    const active = this.loco.dashT > 0;
    if (active) {
      this._ghostTimer -= dt;
      if (this._ghostTimer <= 0) {
        this._ghostTimer = 0.055;
        const g = this.ghosts.find((x) => x.t <= 0) || this.ghosts[0];
        g.t = 0.3;
        g.group.position.copy(this.pos);
        g.group.rotation.y = this.root.rotation.y;
        g.group.visible = true;
      }
    }
    for (const g of this.ghosts) {
      if (g.t <= 0) continue;
      g.t -= dt;
      if (g.t <= 0) { g.group.visible = false; g.mat.opacity = 0; continue; }
      const u = g.t / 0.3;
      g.mat.opacity = u * u * 0.30;
      const s = 1 + (1 - u) * 0.12;
      g.group.scale.set(s, 1 - (1 - u) * 0.06, s);
    }
  }
}

function smoothRange(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
