/**
 * THE SUSTAINED VERDICT — what two frame-rate samples, taken an interval of real
 * play apart, are allowed to say about each other.
 *
 * Split out of `shoot.mjs` so it can be tested against runs that already
 * happened. It has to be: the reported failure needs a loaded machine, and on
 * an idle M4 three minutes of real play passes every bar here both with the
 * defect present and with it fixed. "I ran snapshot.sh and it exited 0" is
 * therefore not, by itself, evidence that these bars still bite.
 * `_sustainverdict-test.mjs` feeds this the numbers off the run the complaint
 * was written from and asserts it fails on them, by name.
 *
 * Four bars, and each one exists because of a specific way a real defect stayed
 * hidden:
 *
 *   perf-sustained   the frame rate itself, measured at an IDENTICAL drawing
 *                    buffer at both ends. It used to be measured at whatever
 *                    size the quality controller happened to have chosen, which
 *                    meant a session that ended sharper than it started was
 *                    reported as a 53% frame-rate collapse — punishing the game
 *                    for getting better, and burying a real resolution loss
 *                    inside a number that could not tell the two apart.
 *   perf-tier        the effect tier ending below where it started. A
 *                    controller that holds the frame rate by spending the
 *                    picture has hidden the defect rather than fixed it.
 *   perf-resolution  and the other half of the picture, which used to be
 *                    printed and never asserted. The reported session ended at
 *                    pixel cap 0.72 having opened at 1.20 — 36% of the pixels —
 *                    and nothing here objected.
 *   perf-growth      anything that accumulates. These are the *cause*; the
 *                    three above are the symptom, and a run on a fast enough
 *                    machine can pass all three while leaking, right up until
 *                    it meets a Chromebook.
 */
/* Exported because `shoot.mjs` prints the allowance beside the measurement it
   is judging — "decay 4.1% (allowance 25%)" — and a number a reader cannot see
   the bar for is a number they cannot check. It was inlined here when the
   verdict moved into this file, which left two live references in shoot.mjs
   pointing at nothing and took `snapshot.sh` down with a ReferenceError before
   it could reach its exit code. (Not the perf area's own change to make: this
   is the one-line re-export that makes the gate runnable again. — session P0
   clock/progress pass) */
export const GROWTH_MAX = 0.25;
export const DECAY_MAX = 0.25;
const BOUNDED = {
  sceneObjects: 'objects in the scene graph',
  geometries: 'live GPU geometries',
  textures: 'live GPU textures',
  programs: 'compiled shader programs',
  updaters: 'per-frame updaters on the engine',
  domNodes: 'DOM elements',
  listeners: 'net event listeners (added minus removed)',
};

/**
 * The verdict, as a pure function of two samples, so it can be tested against
 * runs that already happened.
 *
 * It has to be. The reported failure needs a loaded machine to reproduce: on an
 * idle M4 three minutes of play passes every bar here, before OR after the fix,
 * so "I ran it and it passed" says nothing about whether the bars still bite.
 * `--self-test` below feeds this the numbers off the run that was actually
 * reported and asserts it fails, by name, on each of them.
 */
export function sustainedVerdict(opening, sustained, minutes = 3) {
  const out = [];
  const say = (name, why) => out.push({ name, why });
  const RANK = ['low', 'medium', 'high'];

  const decay = (opening.fps - sustained.fps) / opening.fps;
  if (decay > DECAY_MAX) {
    say('perf-sustained', `the frame rate decayed ${(decay * 100).toFixed(1)}% over ${minutes} min of real play `
      + `(${opening.fps.toFixed(1)} -> ${sustained.fps.toFixed(1)} fps) on the SAME camera at the SAME buffer size `
      + `(pixel cap pinned to ${opening.measuredAtCap})`);
  }
  if (RANK.indexOf(sustained.tier) >= 0 && RANK.indexOf(opening.tier) >= 0
      && RANK.indexOf(sustained.tier) < RANK.indexOf(opening.tier)) {
    say('perf-tier', `the effect tier auto-degraded from '${opening.tier}' to '${sustained.tier}' during play`);
  }
  /* THE OTHER HALF OF THE PICTURE, WHICH USED TO GO UNASSERTED.
   *
   * The effect tier is the backstop knob; the drawing-buffer cap is the one the
   * controller actually reaches for, and it is worth far more of the image. The
   * reported session ended at cap 0.72 having opened at 1.20 — 36% of the
   * pixels — and this file printed that on a line and asserted nothing about
   * it, because the resolution loss was being laundered into the frame-rate
   * number instead. Now that the frame rate is measured at a pinned buffer it
   * cannot be, so the cap gets a bar of its own. */
  const a = opening.chosenCap, b = sustained.chosenCap;
  if (Number.isFinite(a) && Number.isFinite(b) && a > 0) {
    const lost = (a - b) / a;
    if (lost > DECAY_MAX) {
      say('perf-resolution', `the drawing buffer shrank ${(lost * 100).toFixed(1)}% over ${minutes} min of real play `
        + `(pixel cap ${a.toFixed(2)} -> ${b.toFixed(2)}) — the game got softer the longer it ran`);
    }
  }
  for (const [k, label] of Object.entries(BOUNDED)) {
    const x = opening[k], y = sustained[k];
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0) continue;
    const g = (y - x) / x;
    if (g > GROWTH_MAX) say('perf-growth', `${label} grew ${(g * 100).toFixed(0)}% (${x} -> ${y}) — unbounded accumulation`);
  }
  return out;
}

