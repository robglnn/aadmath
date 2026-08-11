/**
 * This learner's pace, measured rather than assumed.
 *
 * Two numbers decide how big a twenty-minute goal is: how long an item takes
 * this person, and how often they get one right.
 *
 * Neither is invented here. The *shape* of the time model already exists and is
 * already load-bearing: `itemSeconds()` in src/learn/mastery.js is what the
 * scheduler divides by when it ranks skills by leverage per minute, and it
 * knows that a situation has to be read before it can be solved, that a worked
 * example has to be studied, and that a band-5 item is not a band-1 item. A
 * session planner with its own private idea of how long an item takes would be
 * optimising against a different clock from the one the scheduler optimises
 * against, and two clocks is the same as none.
 *
 * So what is measured here is a single dimensionless **factor**: how long this
 * learner takes compared with what the engine's own model predicted for the
 * items they were actually served. A factor of 1.4 means "everything takes this
 * person about forty per cent longer than the model says", and it travels
 * correctly across item types — a slow reader served a page of word problems is
 * not charged twice for the same slowness.
 *
 * The accuracy seed is the engine's own equilibrium, not a guess: the credit
 * ladder pays +1 for a clean solve and −2 for a miss, so unassisted practice
 * settles where p = 2/3, and the scaffolded stream mixed in with it sits a
 * little above that. 0.72 is replaced by the learner's own figure within about
 * a dozen items anyway.
 *
 * Two guards keep the measurement honest:
 *
 *   · a gap longer than three minutes is a learner who wandered off to build
 *     something, not a learner who thought hard, and is dropped rather than
 *     folded in. Otherwise one bathroom break halves tomorrow's goal.
 *   · the clock starts when the item reaches the surface, not when the previous
 *     one was answered, so the walk between two rifts is never charged to
 *     anybody's thinking time.
 */
import { itemSeconds } from '../learn/mastery.js';

const KEY = 'ascent.pace';

export const SEED = { factor: 1, accuracy: 0.72 };
/** Above this a gap is idleness, not thought. Seconds. */
const IDLE_GAP = 180;
/** Below this it is a harness or a mis-tap. */
const FLOOR = 3;
const ALPHA_TIME = 0.22;
const ALPHA_ACC = 0.12;

export function createPace() {
  let factor = SEED.factor;
  let accuracy = SEED.accuracy;
  let samples = 0;
  let openedAt = 0;
  let modelled = 0;

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Number.isFinite(saved.factor)) {
      factor = clamp(saved.factor, 0.35, 3.2);
      accuracy = clamp(saved.accuracy ?? SEED.accuracy, 0.25, 0.98);
      samples = saved.samples | 0;
    }
  } catch { /* private mode — the pace simply starts from the seed again */ }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ factor, accuracy, samples }));
    } catch { /* nothing to be done, and nothing that should break the loop */ }
  }

  return {
    get factor() { return factor; },
    get accuracy() { return accuracy; },
    get samples() { return samples; },
    /** True while the pace is still mostly the seed rather than this learner. */
    get seeded() { return samples < 6; },

    /** What this learner is expected to spend on one item of this shape. */
    secondsFor(task) { return itemSeconds(task) * factor; },

    /** An item just went up on the surface. */
    presented(item, opts) {
      openedAt = performance.now();
      modelled = itemSeconds({
        rep: item?.rep,
        difficulty: item?.difficulty,
        scaffold: opts?.scaffold,
      });
    },

    /** …and has been answered. */
    answered(correct) {
      const dt = openedAt ? (performance.now() - openedAt) / 1000 : 0;
      openedAt = 0;
      accuracy = clamp(accuracy + ((correct ? 1 : 0) - accuracy) * ALPHA_ACC, 0.25, 0.98);
      if (dt >= FLOOR && dt <= IDLE_GAP && modelled > 0) {
        const seen = clamp(dt / modelled, 0.2, 4);
        factor = clamp(factor + (seen - factor) * ALPHA_TIME, 0.35, 3.2);
        samples++;
      }
      save();
    },

    reset() {
      factor = SEED.factor;
      accuracy = SEED.accuracy;
      samples = 0;
      try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    },

    /** A per-item figure for the places that want one plain number. */
    get secPerItem() { return itemSeconds({ difficulty: 3 }) * factor; },

    state: () => ({ factor, accuracy, samples, seeded: samples < 6 }),
  };
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
