/**
 * THE SESSION CLOCK — one of them, and it only ever goes forwards.
 *
 * ---------------------------------------------------------------------------
 * WHAT WENT WRONG
 *
 * A cold critic, in one unbroken sitting with the tab never reloaded, read the
 * session figure five times:
 *
 *     4 min  →  7 min  →  9 min  →  1 min  →  5 min
 *
 * and the real elapsed time at the "1 min" reading was about twenty-five
 * minutes. A clock that runs backwards is not a rounding error and it is not a
 * cosmetic defect: it is the number a teacher files, and the moment a learner
 * catches it going down, every other figure on the screen is worth nothing.
 *
 * There were three clocks, and none of them was this one.
 *
 *   1. `sessions[]` in `src/report/track.js`. A "sitting" was opened by the
 *      page loading and CLOSED BY TEN MINUTES WITH NO ANSWER — and the next
 *      answer opened a fresh one, starting from zero. That is the reset the
 *      critic photographed. The rule is defensible for time on task and
 *      indefensible for a session clock: a cadet who spends eleven minutes
 *      walking, building a tower and reading a worked echo has not left. They
 *      are having the session. Ten minutes of "no answer" is not ten minutes
 *      of "no learner", and only the second one ends a sitting.
 *
 *   2. `run.focus` in `src/session/index.js`. The planner's clock — item time
 *      plus a capped walk between tears. Correct for sizing a goal, and it
 *      restarts at zero on every `plan()`, which is once per run and twice in a
 *      sitting that takes a break beat and comes back.
 *
 *   3. The wall, which is what a fifteen-year-old is actually holding.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS
 *
 * ONE accumulator, in ONE place, that can only be added to. Not "a start time
 * that we try not to move" — a start time is a subtraction, and every defect
 * above was a subtraction against a start time somebody else had moved. This
 * counts forwards, from zero, and there is no expression anywhere in the game
 * that can make it smaller.
 *
 *   · It advances on `requestAnimationFrame`, which the browser stops when the
 *     tab is hidden. A closed lid does not bill the learner.
 *   · It advances only while there has been real input inside `IDLE_MS`, so a
 *     tab left open on the meadow overnight does not read nine hours. Reading a
 *     worked echo is not idling — the window is minutes, not seconds.
 *   · It survives a reload: the accumulator and the moment it was last seen are
 *     written to `localStorage`, and a page that comes back inside `AWAY_MS`
 *     picks the same sitting up rather than starting a new one.
 *   · It starts a NEW sitting only after a real absence — the machine was shut,
 *     or the learner went to another lesson and came back after the break.
 *
 * MONOTONIC IS A PROPERTY OF THE SHAPE, NOT OF THE CARE TAKEN. `ms()` returns
 * a number that is `+=`'d and never assigned, and `_latch` refuses to hand back
 * anything smaller than it handed back last time even if a future edit breaks
 * that. `tools/critic/oneclock.mjs` samples it forty times across a twenty
 * minute session and fails the build on a single decrease.
 */

const KEY = 'ascent.clock';

/** Away for longer than this, and coming back is a new sitting. */
export const AWAY_MS = 10 * 60_000;
/**
 * No key, no mouse, no touch for this long and the clock parks until the next
 * one. Generous on purpose: a learner reading a faded worked example, or
 * looking at the sea while they think, is having the session. Somebody who left
 * the tab open and went to lunch is not.
 */
export const IDLE_MS = 5 * 60_000;
/** Never let one frame — a tab that was asleep — bill more than this. */
const MAX_STEP_MS = 500;

/**
 * @returns {{ms:()=>number, sittingIndex:()=>number, startedAt:()=>number,
 *            live:()=>boolean, reset:()=>void, stop:()=>void}}
 */
export function createSessionClock({ now = () => Date.now(), storage = safeStorage() } = {}) {
  const saved = read(storage);
  const at = now();

  /* THE SITTING. Resumed if the page was here recently — a reload, a dropped
     tab, a Chromebook lid — and started fresh only after a real absence. The
     accumulator carries across the reload with it, which is the whole point:
     the clock a learner reads is about the sitting, not about the page.

     A SITTING BELONGS TO A RECORD. If the learner model has been wiped since
     the last tick — a cleared install, a shared Chromebook profile, a harness
     starting from nothing — then whoever is in the chair now did not do those
     minutes, and inheriting them would print somebody else's session length in
     the first frame of a fresh save. No record, no sitting. */
  const hasRecord = (() => {
    try { return !!storage.getItem('ascent.save'); } catch { return false; }
  })();
  const resumed = !!saved && hasRecord && at - (saved.seenAt || 0) < AWAY_MS;
  const state = resumed
    ? { ms: Math.max(0, saved.ms || 0), sitting: saved.sitting || 1, startedAt: saved.startedAt || at }
    : { ms: 0, sitting: ((saved?.sitting || 0) + 1) || 1, startedAt: at };

  let seen = at;
  let lastInput = at;
  /** The floor `ms()` may never go below. Belt and braces; see the header. */
  let latch = state.ms;
  let raf = 0;
  let stopped = false;
  let wrote = 0;

  const bump = () => { lastInput = now(); };
  const EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove'];
  if (typeof window !== 'undefined') {
    for (const e of EVENTS) window.addEventListener(e, bump, { passive: true, capture: true });
    window.addEventListener('beforeunload', () => write(storage, state, seen), { capture: true });
    window.addEventListener('visibilitychange', () => {
      // Coming back from a hidden tab must not bill the time it was hidden:
      // rAF was not running, so `seen` is stale by exactly that much.
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') seen = now();
    }, { capture: true });
  }

  /**
   * One frame of the sitting.
   *
   * Deliberately the only place `state.ms` is written, and the only operator
   * used on it is `+=`. There is no branch in this function that can produce a
   * smaller number than the one it was called with.
   */
  function step() {
    if (stopped) return;
    const t = now();
    const dt = Math.min(MAX_STEP_MS, Math.max(0, t - seen));
    seen = t;
    if (t - lastInput < IDLE_MS) state.ms += dt;
    // Once a second is enough: the goal is that a sitting survives a closed lid,
    // not that it survives a power cut mid-frame.
    if (t - wrote > 1000) { write(storage, state, seen); wrote = t; }
    raf = requestAnimationFrame(step);
  }
  if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(step);

  return {
    /** Milliseconds this sitting has been going. Only ever larger. */
    ms() {
      latch = Math.max(latch, state.ms);
      return latch;
    },
    /** Which sitting this is, so a surface can tell a return from a resume. */
    sittingIndex: () => state.sitting,
    /** Wall-clock instant the sitting opened, for a critic to check against. */
    startedAt: () => state.startedAt,
    /** Is the clock counting right now, or parked on an idle learner? */
    live: () => now() - lastInput < IDLE_MS,
    /**
     * A cleared record. The learner is still in the chair, so the sitting keeps
     * going — but it is a different record's sitting, so it starts at zero.
     * This is the ONE call allowed to make the number smaller, and nothing but
     * `tracker.reset()` may make it.
     */
    reset() {
      state.ms = 0;
      state.sitting += 1;
      state.startedAt = now();
      latch = 0;
      seen = now();
      lastInput = now();
      write(storage, state, seen);
    },
    stop() {
      stopped = true;
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      if (typeof window !== 'undefined') for (const e of EVENTS) window.removeEventListener(e, bump, { capture: true });
      write(storage, state, seen);
    },
  };
}

function write(storage, state, seenAt) {
  try {
    storage.setItem(KEY, JSON.stringify({
      ms: Math.round(state.ms), sitting: state.sitting, startedAt: state.startedAt, seenAt,
    }));
  } catch { /* private mode: the clock still runs, it just does not survive */ }
}

function read(storage) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || 'null');
    return v && typeof v.ms === 'number' ? v : null;
  } catch { return null; }
}

function safeStorage() {
  try { return localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
}

/**
 * THE ONE CLOCK, for everything that draws in a browser.
 *
 * A module-level singleton rather than something threaded through
 * `createSession`, because the defect was two live instances of the same idea,
 * and an argument is a thing somebody can pass a second copy of. `src/report`
 * and `src/session` both import THIS.
 */
let shared = null;
export function sessionClock() {
  if (!shared) shared = createSessionClock();
  return shared;
}
