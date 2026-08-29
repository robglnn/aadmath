/**
 * THE ONE DEFINITION OF LEFT.
 *
 * This project has now shipped a handedness inversion TWICE, in two different
 * files, written by two different hands, and both times every gate was green.
 *
 *   1. The client, in his own words, after a real session:
 *      *"A and D movement for character are backwards."*
 *      A left vector used as a right vector in the boots.
 *   2. `src/meta/guide.js`, `relative()`: the two branches of the planar cross
 *      product were swapped, so the objective card printed TO YOUR LEFT for a
 *      rift that was on the right, on every frame, in every locale — while the
 *      marker arrow beside it, which is derived from `camera.project()` and
 *      therefore cannot be wrong about a side, pointed the other way.
 *   3. …and, found while fixing (2): `src/world/afford.js` wrote the compass
 *      needle as `rotate: -ang`, which mirrors the needle about the screen's
 *      vertical axis. Three instruments, two of them inverted, all agreeing
 *      with each other about the NUMBER and disagreeing about the SIDE.
 *
 * A sign error is not a hard bug. It is an *unownable* bug: every author
 * re-derives `a × b` from memory at the call site, half of them get it right,
 * and no test in the world reads a minus sign and calls it wrong. The fix is
 * not to be more careful. The fix is that there is exactly ONE place in this
 * source tree that decides which way is left, it is this file, and
 * `tools/critic/handed.mjs` fails the build if a second one appears.
 *
 * THE DERIVATION, WRITTEN OUT, SO NOBODY EVER RE-DERIVES IT AGAIN
 *
 * three.js is right-handed, Y up. A camera's local axes are +X right, +Y up,
 * +Z *backward*, so `camera.getWorldDirection()` returns the local −Z axis and
 * the camera's own right is local +X. `Vector3.project()` maps view-space +X to
 * NDC +x, and NDC +x is screen-right. Therefore:
 *
 *     a target is on the player's RIGHT  ⇔  (target − eye) · cameraRight > 0
 *                                        ⇔  its projected NDC x > 0
 *
 * Take `f` = the flattened forward and `v` = the flattened eye→target vector.
 * The camera's right, flattened, is `right = (−f.z, 0, f.x)`. (Check it against
 * three.js rather than against intuition: looking down −Z, `f = (0,0,−1)`, and
 * that formula gives `right = (1,0,0)` = world +X, which is exactly what
 * `Vector3(1,0,0).applyQuaternion(camera.quaternion)` returns. It is the only
 * assignment that agrees.) So the projection of the target onto that right is
 *
 *     v · right  =  f.x·v.z − f.z·v.x     ← POSITIVE WHEN THE TARGET IS RIGHT
 *
 * and that single expression, with that single sign, is the whole of it.
 *
 * Both shipped inversions computed exactly that quantity and then read it
 * backwards: `guide.js` returned `'left'` when it was positive, and
 * `afford.js` wrote it into a CSS `rotate` negated. Neither is a hard bug and
 * neither is visible in a diff — which is precisely why the expression may now
 * be written down only once, here, where it is checked.
 *
 * Every function here is verified against `camera.project()` itself, over a
 * sweep of camera yaws and target offsets, by `tools/critic/handed.mjs
 * --self-test` — the projection is the ground truth because it is the same
 * matrix that puts the pixels on the glass, so an instrument that agrees with
 * it cannot disagree with what the player sees.
 *
 * WHAT THIS FILE MAY NOT DO. It may not import three. It takes plain numbers
 * and `{x, z}`-shaped things, so a gate can call it in node with no browser,
 * no scene and no camera, and so that nothing here can accidentally depend on
 * a matrix somebody else already got wrong.
 */

/** Radians to degrees, once, here, so no caller carries its own copy. */
export const DEG = 180 / Math.PI;

/**
 * WHICH SIDE. `+1` the target is to the player's right, `−1` to the left,
 * `0` when either vector is degenerate or the target is exactly on the axis.
 *
 * `fx, fz` is the forward direction (need not be normalised, need not be flat —
 * the y component is simply not read). `vx, vz` is eye → target.
 */
export function side(fx, fz, vx, vz) {
  const c = fx * vz - fz * vx;
  if (!Number.isFinite(c) || c === 0) return 0;
  return c > 0 ? 1 : -1;
}

/**
 * THE SIGNED TURN, in radians, in the range (−π, π].
 *
 * **Positive means turn RIGHT** — clockwise on the screen, clockwise on a map
 * seen from above, and the direct value of a CSS `rotate` on a glyph that
 * points up when it is zero. Negative means turn left. π means turn round.
 *
 * This is deliberately the same magnitude the old `afford.js` computed
 * (`cameraYaw − bearingYaw`, wrapped), so anything that reads the number rather
 * than the sign is unaffected; only the sign is fixed.
 */
export function turn(fx, fz, vx, vz) {
  const f2 = fx * fx + fz * fz;
  const v2 = vx * vx + vz * vz;
  if (f2 < 1e-12 || v2 < 1e-12) return 0;
  const s = 1 / Math.sqrt(f2), k = 1 / Math.sqrt(v2);
  const ax = fx * s, az = fz * s, bx = vx * k, bz = vz * k;
  return Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
}

/**
 * The same turn in degrees. Write it straight into a CSS `rotate` on a glyph
 * whose rest pose points up, and the glyph points at the thing.
 */
export function turnDeg(fx, fz, vx, vz) {
  return turn(fx, fz, vx, vz) * DEG;
}

/**
 * THE EIGHT-POINT BEARING WORD, as an id the bundle owns.
 *
 * Four buckets — ahead / left / right / behind — carry a worst case error of
 * 45°, which at 88 m is 62 m of lateral miss: a player who walks a straight
 * line on "TO YOUR RIGHT" can arrive most of a football pitch away from the
 * thing. Eight halve that to 22.5°, and eight is the most a sentence can carry
 * without becoming a bearing in degrees, which is a map instrument and a thing
 * you have to learn to read.
 *
 * The bands are deliberately NOT equal. `ahead` is wide (±25°) because it is
 * the only word that means "keep going" and a walker wobbles; `behind` is wide
 * (±25°) because "turn round" is right anywhere near the back. The four
 * diagonals take up the slack.
 *
 * @returns {'ahead'|'aheadRight'|'right'|'backRight'|'behind'|'backLeft'|'left'|'aheadLeft'}
 */
export function bearingWord(fx, fz, vx, vz) {
  const a = turn(fx, fz, vx, vz) * DEG;      // + right, − left
  const m = Math.abs(a);
  if (m <= 25) return 'ahead';
  if (m >= 155) return 'behind';
  const r = a > 0;
  if (m < 65) return r ? 'aheadRight' : 'aheadLeft';
  if (m < 115) return r ? 'right' : 'left';
  return r ? 'backRight' : 'backLeft';
}

/** Every id `bearingWord` can return, in turn order from straight ahead. */
export const BEARINGS = [
  'ahead', 'aheadRight', 'right', 'backRight',
  'behind', 'backLeft', 'left', 'aheadLeft',
];
