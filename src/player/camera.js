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
    this.side = 1;            // which shoulder the lens is over: +1 right, -1 left
    this._sideWant = 1;
    this._hit = BOOM;
    this._first = true;

    this._d = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._want = new THREE.Vector3();
    this._pivot = new THREE.Vector3();
    this._rig = new THREE.Vector3();
    this._axis = new THREE.Vector3(0, 0, 1);
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
    const reach = Math.max(MIN_BOOM, this.boom - kickB);

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
    for (let i = 0; i <= STEPS; i++) {
      const f = MIN_BOOM + (i / STEPS) * (reach - MIN_BOOM);
      const h = heightAt(rig.x - dir.x * f, rig.z - dir.z * f);
      // over the void there is nothing to clear and nothing to hide behind
      if (h !== null) run = Math.max(run, (h + CLEAR) - (rig.y - dir.y * f));
      // How much climb a given boom length is allowed to buy. It grows with
      // distance: a long boom lifting a metre is a camera looking over a ridge,
      // a short one lifting a metre is a map screen.
      if (run > 0.50 + f * 0.46) break;
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

    // ---- aim point ----
    // Under the wing the lens looks *below* the pilot, which drops the horizon
    // toward the top of the frame and opens the world up underneath him. It is
    // the single beat that separates a glide from a fall with a decoration.
    this.focus.copy(rig).add(this.lead);
    this.focus.y -= gW * (1.05 + dive * 1.15);

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
    this.cam.lookAt(this.focus);

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
    const fovWant = 70 + this.sprintW * 8 + runN * 2
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
  if (need(p.x, p.y, p.z) <= 0) return;

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
