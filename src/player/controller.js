import * as THREE from 'three';
import { Locomotion, P, angleDelta, dampAngle } from './locomotion.js';
import { buildCadet, buildGhost } from './rig.js';
import { buildGlider } from './glider.js';
import { Animator } from './animator.js';
import { CameraRig } from './camera.js';
import { PlayerFX } from './effects.js';
import { ScreenFeel } from './screen.js';
import { heightAt, gradientAt, slopeAt, outsideWorld, deck, landingNear } from './terrain.js';
import {
  attachScene, escapeSite, siteVerdict, openBearing, openness, frameOccluded, EYE,
} from './escape.js';
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
    // …and neither must the recovery, which asks the same scene the same
    // question about the same meshes. (src/player/escape.js)
    attachScene(scene);
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
    /** How long the lens has had no room at all — see `_unstick`. */
    this._blindT = 0;
    this._blindAsk = -1e9;
    /** The recovery's own second look — see `_verifyRecovery`. */
    this._verifyAt = 0;
    this._verifyWhy = '';
    this._recTries = 0;
    this._banned = [];
    /** Fired when `stuck` changes, so the interface can offer the way out. */
    this.onStuck = null;
    /** Fired after a recovery, with the reason, so the interface can say so. */
    this.onRecover = null;
    /** True while the cadet is over open air with the island above them. */
    this.falling = false;
    this._fellT = 0;
    this._fellAt = 0;
    /** The hover watchdog — see `_catch`. Wall clock, and the height it began at. */
    this._hangAt = 0;
    this._hangY = 0;
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
   * …AND NEITHER IS THE CATCH. On its own line, for the same reason.
   *
   * `update()` does not run on frames a panel owns (src/main.js), and the
   * fall-catch lived inside `update()`. So a cadet who walked off the shard
   * with a rift open — which is not exotic: the ring opens on contact, the
   * panel takes the frame, and W is still held — fell out of the world and the
   * one system whose entire job is to notice never got a frame to notice in.
   * A cold-play run caught him twenty-two seconds past the point of no return,
   * a hundred and eighty metres out, still holding the wing open, with `caught`
   * at zero the whole time.
   *
   * The Recover KEY was hoisted out of `update()` for exactly this reason two
   * rounds ago, and the catch was left behind — which is the same defect
   * wearing the other hat, because the promise is not "the key answers", it is
   * "nothing in this game can strand you". The catch is the half of that a
   * player never presses.
   */
  pumpCatch(dt) {
    this.time += dt;
    this._catch(dt);
    // NOT the recovery's second look: that reads `cam.pos`, and the lens is not
    // being solved on these frames. It runs on the first frame the world gets
    // the screen back, which is the first frame there is a shot to judge.
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

    // ---- …AND BLIND IS A THIRD FACT ----------------------------------------
    //
    // Neither of the two above was true of the reported failure, and that is
    // why it lasted ninety seconds. Wedged inside a landmark the cadet is
    // *above* the heightfield — `heightAt` knows nothing about drawn meshes —
    // so he was never "buried", he could still walk, and the game therefore
    // never offered him the way out. He had a black frame, a working stick, and
    // no prompt.
    //
    // The lens already knows. `_hit` is how much room the boom found this
    // frame, and a boom crushed under two metres for two and a half seconds
    // means the frame has been full of the inside of something for two and a
    // half seconds. That is cheap and it is a screen fact, so it is only the
    // trigger: before anything is claimed, the eye point is actually probed
    // (src/player/escape.js), on a slow clock and only while the lens is
    // crushed, so a hard brush past a boulder costs nothing and says nothing.
    this._blindT = (this.cam._hit < 2.2 && !this.loco.gliding)
      ? this._blindT + dt : 0;
    if (this._blindT > 2.5 && this.time - this._blindAsk > 0.6) {
      this._blindAsk = this.time;
      const v = siteVerdict(p.x, p.z, true);
      if (!v.ok) this._stuckT += 1.2;
      else this._blindT = 0;
    }

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

    // ---- …AND NOBODY HANGS IN THE AIR, FOR ANY REASON AT ALL --------------
    //
    // Everything above reasons about the fall: where the ground is, how much
    // glide is left, how long the beat has run. All of it assumes the cadet is
    // *moving* — and every version of this catch that has been wrong was wrong
    // because some other system had quietly stopped him moving and the catch
    // was busy asking a question about geometry.
    //
    // So this asks the one question that needs no model of anything: **over
    // open air, with the wing shut and no scripted move running, is he still
    // losing height?** Half a metre in a second and a half is the whole bar. A
    // real fall covers fifty metres in that time and an apex lasts a tenth of a
    // second, so nothing that is actually falling can trip it; a standing
    // updraft lifts at thirteen metres a second, so nothing that is legitimately
    // climbing can either. A mantle, a dash and the wing are excluded by name
    // because those are the three states that are *allowed* to hold height, and
    // all three are time-boxed. Ground the cadet built is not open air —
    // `heightAt` sees the lattice — so a deck run out over the gulf is his.
    //
    // What is left is the failure this exists for: anything, now or later, that
    // pins a cadet in the sky outside the world — a beat that ended without
    // giving gravity back, a stale probe, a frame nobody ran. It does not matter
    // which. He is put down, and he is put down without the fall's grace beat,
    // because he has already had a second and a half of nothing happening.
    {
      const air = heightAt(p.x, p.z) === null;
      if (air && !this.loco.grounded && !this.loco.gliding
        && this.loco.mantleT <= 0 && this.loco.dashT <= 0) {
        const nw = typeof performance !== 'undefined' ? performance.now() : Date.now();
        // Measured from the height the window OPENED at, never from last frame:
        // a steady sink is 0.03 m per frame, and a per-frame threshold would
        // read the whole descent as a hover.
        if (!this._hangAt || Math.abs(p.y - this._hangY) > 0.5) {
          this._hangAt = nw; this._hangY = p.y;
        } else if ((nw - this._hangAt) / 1000 > 1.5) {
          why = why || 'hung';
        }
      } else {
        this._hangAt = 0;
      }
    }

    if (!why) {
      // ---- THE BEAT DOES NOT RESTART EVERY TIME THE ANSWER FLICKERS --------
      //
      // This used to be `_fellT = 0`, and that one line is why the edge catch
      // has been "marginal, flaky run to run" for as long as it has existed.
      // The grace below is nine tenths of a second; the predicate above it is
      // `reachFloor`, which is CACHED for 180 ms and for six metres of travel
      // (src/player/terrain.js — it is a few hundred distance sums and cannot
      // be run every frame). Under the wing the cadet covers six metres in
      // four tenths of a second, so the floor he is being measured against
      // arrives in steps while he descends smoothly through it: `why` reads
      // 'fell', null, 'fell', null. Every null threw the beat away and started
      // it again, so a fall that should have ended at 1.0 s ended at 1.6, 2.4,
      // or — on the run that failed this gate — never, at 182 m out with the
      // wing open. The cadet was gone the whole time; only the answer was
      // stuttering.
      //
      // So the beat decays rather than resetting, at twice the rate it built.
      // A cadet who genuinely gets back — opens the wing above a reachable pad,
      // or lands — clears it in half the time it took to accumulate, which is a
      // fraction of a second and changes nothing he can feel. A cadet whose
      // predicate is merely flickering keeps his beat and gets caught on time.
      this._fellT = Math.max(0, this._fellT - dt * 2);
      if (this._fellT <= 0) { this.falling = false; this._fellAt = 0; }
      return;
    }
    if (!this.falling) {
      this._fellAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
    this.falling = true;
    this._fellT += dt;
    // Through the terrain, or under the floor, is answered on the frame it is
    // seen: there is nothing to look at down there and nothing to understand.
    // A fall gets a beat — long enough to see the shard go past overhead and
    // to reach for the wing, and not one second longer. Reaching for it works:
    // the wing clears the test above on the frame it opens, and the beat is
    // abandoned rather than merely paused.
    // ---- THE BEAT IS MEASURED IN SECONDS OF THE PLAYER'S LIFE --------------
    //
    // …and it used to be measured in `dt`, which is not the same thing and is
    // the last of the reasons this step has been "marginal, flaky run to run"
    // for as long as it has existed. The engine clamps `dt` so a stall cannot
    // teleport the cadet through a wall — entirely correct — so on a machine
    // running at ten frames a second, one second of a child's life contributes
    // about a third of a second to any counter built out of `dt`. The beat is
    // nine tenths of a second on a fast laptop and nearly three on a school
    // Chromebook, and the promise the gate measures is in wall-clock seconds
    // either way. Instrumented on the software rasteriser: `_fellT` advanced
    // 0.25 per 0.6 s of real time.
    //
    // A beat is a thing the player experiences, so it is timed on the clock the
    // player is on. The decay above stays in `dt` on purpose — that one is
    // hysteresis on a predicate, not a promise about how long anything lasts.
    const grace = why === 'fell' ? 0.9 : 0;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if ((now - this._fellAt) / 1000 < grace) return;
    this._fellT = 0;
    this._fellAt = 0;
    this._hangAt = 0;
    this.falling = false;
    this.caught++;
    this.recover(why === 'under' ? 'buried' : 'fell');
    this.onFall?.(why);
  }

  /**
   * Put the cadet back on solid ground, wherever they are and whatever they
   * are inside of. Never fails: the landing site is the floor of last resort.
   *
   * ---------------------------------------------------------------------------
   * WHAT WAS WRONG WITH THIS FOR FOUR ROUNDS: IT MOVED YOU. IT DID NOT FREE YOU.
   *
   * A cold critic: *"I got wedged inside terrain at ~14 min: screen is black
   * mush, camera inside the mesh, ~90 seconds trapped. I pressed R three times
   * and clicked the menu's RECOVER button. Nothing. Distance moved 158 m ->
   * 154 m."* And then the sentence this comment exists for: **"Moving 3.5 m
   * inside a hill is still inside the hill."**
   *
   * He was exactly right, and the reason is one line of arithmetic. The old
   * search (`_safeSpot`) asked the heightfield for a column and put him at
   * `h + 0.55` on it. Collision on this island is a heightfield plus the built
   * lattice — and **every landmark, monolith, arch, hoodoo, wreck and boulder
   * on the shard is drawn with no collider at all.** So `heightAt` answers
   * "solid ground, 0.55 m under your boots" from the middle of a forty-metre
   * mesh, three and a half metres along is still the middle of it, and the HUD
   * printed BACK ON OPEN GROUND over a frame that was 81% black.
   *
   * The verb now searches for **escape** and verifies it before it commits:
   * ground under the boots, nothing over his head, nothing through his chest,
   * no drawn solid containing him, and a usable share of the directions around
   * him reaching real distance. If the first site fails any of those it is
   * discarded and the ring search goes on — out to sixty metres, which is
   * further than any single structure on this island. (src/player/escape.js)
   * ---------------------------------------------------------------------------
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
    //
    // …AND THE LIST OF REASONS IS GONE, because a list is a thing that gets one
    // entry short. It read `stuck || boxed || 'buried' || 'fell' || 'asked'`,
    // and the one reason missing from it was **`'menu'`** — the RECOVER button
    // on the Esc card, which is the second thing the cold critic tried and the
    // second thing that did nothing. The button hides the card and calls the
    // same verb the key does, so it inherited the whole promise and none of the
    // clause that keeps it: from a spot the game thought was fine, the button
    // set the cadet down on the exact square metre he was standing on.
    //
    // There is no reason to press Recover that does not mean "move me". So the
    // search always starts a ring out, whatever asked for it.
    const STEP_CLEAR = 3.5;
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
    // The search, in the order the player would want it: back over the lip he
    // left; failing that, clear of whatever has hold of him here; failing that,
    // the landing site; failing that, the middle of the shard. Every one of
    // these is the *verified* search — none of them can return a spot inside a
    // rock, which is the whole of the fix.
    // How much of the world he could see from where he pressed it, so the
    // search can refuse to hand him back less than he already had.
    const want = heightAt(p.x, p.z) === null ? 0 : openness(p.x, p.y + EYE, p.z);
    // A retry knows where it has already been. See `_verifyRecovery`.
    const fresh = this.time - this._recovered > 1.5;
    if (fresh) { this._recTries = 0; this._banned.length = 0; }
    const no = this._banned.length ? this._banned : null;
    const spot = (back && escapeSite(back.x, back.z, 0, this.home, want, no))
      || escapeSite(p.x, p.z, STEP_CLEAR, this.home, want, no)
      || escapeSite(this.home.x, this.home.z, 0, this.home, want, no)
      || escapeSite(0, 0, 0, this.home, want, no)
      // Nothing on the island passed. Better a legal column than a frozen
      // cadet — and `_safeSpot` at least guarantees the heightfield answers.
      || this._safeSpot(this.home.x, this.home.z, 0)
      || { x: this.home.x, y: this.home.y, z: this.home.z };

    p.set(spot.x, spot.y, spot.z);
    this.recoveries++;
    this.vel.set(0, 0, 0);
    const L = this.loco;
    L.gliding = false; L.glideOpen = 0; L.jumps = 0;
    L.grounded = true; L.airTime = 0; L.dashT = 0; L.mantleT = 0;
    // ---- AND HE IS FACING THE WAY OUT ---------------------------------------
    //
    // The second half of the same report: *"that time R moved me but jammed the
    // camera into my own avatar's shoulder."* The lens sits behind the cadet, so
    // a recovery that lands him with his back against a boulder has put the boom
    // inside the boulder, the boom collapses to a metre, and the frame is a
    // pauldron. Turning him is not cosmetic here — the bearing with the most
    // room behind it IS the bearing the shot works from, and being set down
    // facing the open world is what "back on solid ground" is supposed to look
    // like. (src/player/escape.js `openBearing`)
    const face = typeof spot.yaw === 'number'
      ? spot.yaw : openBearing(spot.x, spot.y + EYE, spot.z).yaw;
    this.yaw = face;
    // …and level. The pitch used to survive the recovery, so a cadet who had
    // been staring at his own boots inside a hill was set down on open ground
    // still staring at the ground — a frame of grass, which is the complaint
    // he made, arriving from the one axis nobody had checked. It is also what
    // made the shot unpredictable: every site check in escape.js solves for the
    // lens at the rest pitch, and a lens forty degrees below it is a different
    // camera looking at different geometry. Recovery hands back the rest pose.
    this.pitch = -0.14;
    L.facing = face;
    this.root.rotation.y = face;
    // The lens is re-founded rather than flown, or the recovery is a two second
    // pan out of the inside of a hill — and it is re-founded from scratch, so
    // no boom length, climb or landing kick survives the place he came from.
    this.cam.refound();
    this._stuckT = 0;
    this._blindT = 0;
    // …and the verb looks at what it did, two frames from now.
    this._verifyAt = this.time + 0.10;
    this._verifyWhy = reason;
    this._recovered = this.time;
    if (this.stuck) { this.stuck = false; this.onStuck?.(false); }
    this.onRecover?.(reason);
    return spot;
  }


  /**
   * DID THE RECOVERY ACTUALLY PRODUCE A SHOT? — asked of the real camera.
   *
   * Everything in src/player/escape.js is a *prediction* of where the lens will
   * end up, and it has to be: the search is choosing between places nobody is
   * standing yet. But predicting this camera is genuinely hard — the boom
   * shortens against geometry, the rig slides over a shoulder that swaps sides
   * on its own, the lens climbs to clear a rise, and the cadet's origin drops
   * half a metre onto the surface the frame after he is placed. Sharpening that
   * guess is an endless job, and every version of it that was a centimetre out
   * certified a frame the player could not see out of. Two rounds of this fix
   * were spent that way.
   *
   * So the guess only has to be good enough to CHOOSE, and the answer is
   * checked against the thing itself. A tenth of a second after a recovery the
   * lens is where it is going to be; if the boom is crushed into the cadet, or
   * a fifth of the frame is a wall inside three metres, the site is written off,
   * and the search runs again with that place struck out. Three tries, then it
   * stops — a cadet being teleported about the island for ever is its own kind
   * of broken, and by then he is on solid ground either way.
   */
  _verifyRecovery() {
    if (!this._verifyAt || this.time < this._verifyAt) return;
    this._verifyAt = 0;
    if (this._recTries >= 3) return;
    const c = this.cam.pos;
    const jam = this.cam._hit < 2.35;
    const wall = frameOccluded(c.x, c.y, c.z, this.yaw, this.pitch) > 0.20;
    if (!jam && !wall) return;
    this._recTries++;
    this._banned.push(this.pos.x, this.pos.z);
    this.recover(this._verifyWhy || 'asked');
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

    // The recovery's second look, on the lens that is about to be drawn.
    this._verifyRecovery();

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
