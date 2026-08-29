/**
 * THE QUALITY CONTROLLER GATE — the dead zone, in one second instead of fifteen
 * minutes.
 *
 * WHY THIS EXISTS
 *
 * `tools/critic/sustain.mjs` caught the real defect: fifteen minutes into a
 * session the game sat at fxTier 'low' with the resolution cap pinned at its
 * floor, while the median frame rate over that entire stretch was 96-108 fps.
 * It is the right gate and it found the right bug, and it costs a quarter of an
 * hour of wall clock and a GPU to run. Nobody runs it on a whim, which is part
 * of why the defect lived as long as it did.
 *
 * The controller itself is arithmetic. It takes frame times in and moves two
 * knobs out, and it does not need a browser, a GPU, or a fifteen-minute session
 * to be wrong in front of you — it needs a sequence of frame times. So this
 * feeds it the exact sequences that a real session produces and asserts what it
 * does about each, in about a second:
 *
 *   1. a fast machine climbs to its ceiling and stays there
 *   2. a genuinely slow machine gives up resolution, then the tier
 *   3. THE REGRESSION: a machine holding ~100 fps that hitches once a second —
 *      a card laying out KaTeX, a shader compiling, the collector — must
 *      RECOVER. This is the one that failed. The median was always comfortable
 *      and the p95 was never calm, so neither branch of the controller fired,
 *      both counters reset every window, and the quality it was knocked down to
 *      in the first bad minute was the quality it kept for the rest of the
 *      session.
 *   4. sustained stutter — a p95 that is late in every window, not one in ten —
 *      must still cost quality, or the fix above is just a disabled controller
 *   5. an early run of drops must not make later recovery impossible
 *
 *   node tools/critic/qualityloop.mjs
 *
 * Exit 0 = the controller can still find its way back up.
 */
import { QualityDirector } from '../../src/core/engine.js';
import { findings } from '../_findings.mjs';

// The controller reads `devicePixelRatio`, `matchMedia`, `innerWidth/Height`
// and `navigator` off the global to decide where to start. Node has none of
// them; a desktop-shaped machine is what we are testing.
globalThis.devicePixelRatio = 2;
globalThis.innerWidth = 1600;
globalThis.innerHeight = 900;
globalThis.matchMedia = () => ({ matches: false });
// Node ships a real `navigator` with only a getter, so it is redefined rather
// than assigned.
Object.defineProperty(globalThis, 'navigator', {
  value: { maxTouchPoints: 0, hardwareConcurrency: 10, deviceMemory: 8 },
  configurable: true,
});

const TIERS = ['low', 'medium', 'high'];

/** A stand-in for the engine: a post stack with a tier, and a pixel ratio. */
function rig(startTier = 'high') {
  const engine = {
    postFX: {
      tier: startTier,
      renderScale: 1,
      pinScale() {},
      setTier(t) { this.tier = t; },
    },
    applyPixelRatio() {},
  };
  const q = new QualityDirector(engine, {});
  return { engine, q };
}

/**
 * Run `seconds` of frames through the controller.
 *
 * `frame(i)` returns the frame time in ms for second `i`; a window is fed as
 * sixty frames so the percentiles the controller takes are real percentiles
 * rather than one number repeated.
 */
function play(q, seconds, frame) {
  for (let s = 0; s < seconds; s++) {
    const times = frame(s);
    for (const ms of times) q.tick(ms / 1000);
  }
}

/** Sixty frames at `ms`, with `spikes` of them replaced by a `spikeMs` hitch. */
const window60 = (ms, spikes = 0, spikeMs = 45) => {
  const a = new Array(60).fill(ms);
  for (let i = 0; i < spikes; i++) a[Math.floor((i + 1) * 60 / (spikes + 1))] = spikeMs;
  return a;
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`);
};

// ---------------------------------------------------------------- 1. fast
{
  const { q } = rig('high');
  play(q, 60, () => window60(6));
  check('a fast machine climbs to its resolution ceiling',
    q.cap >= q.ceiling - 0.001 && q.tierIndex === 2,
    `cap ${q.cap.toFixed(2)}/${q.ceiling.toFixed(2)} tier ${TIERS[q.tierIndex]}`);
}

// ---------------------------------------------------------------- 2. slow
{
  const { q } = rig('high');
  play(q, 90, () => window60(30));
  check('a genuinely slow machine spends resolution first, then the tier',
    q.cap <= q.floor + 0.001 && q.tierIndex < 2,
    `cap ${q.cap.toFixed(2)} floor ${q.floor.toFixed(2)} tier ${TIERS[q.tierIndex]}`);
}

// ------------------------------------------- 3. THE REGRESSION: hitchy 100fps
//
// Exactly the reported session. Two minutes of genuine early load knock the
// quality down — the world streaming in, the first shaders compiling — and then
// the machine settles at a 10 ms median (100 fps) that hitches once a second
// forever, which is what a session with learning cards in it looks like.
{
  const { q, engine } = rig('high');
  play(q, 120, () => window60(30));                 // the bad opening
  const sunkTier = q.tierIndex, sunkCap = q.cap;
  // These are MEASURED numbers, not invented ones: shots/sustain-before's
  // windows from minute three onward ran a median of 7-9 ms with a p95 of
  // 21-75 ms, which is five or six hitched frames in sixty.
  play(q, 600, () => window60(8, 5, 60));           // ten minutes of hitchy 125 fps

  check('a 100 fps machine that hitches once a second gets its EFFECT TIER back',
    q.tierIndex > sunkTier || sunkTier === 2,
    `tier ${TIERS[sunkTier]} -> ${TIERS[q.tierIndex]} (postFX says '${engine.postFX.tier}')`);
  check('…and its RESOLUTION back',
    q.cap > sunkCap + 0.05,
    `cap ${sunkCap.toFixed(2)} -> ${q.cap.toFixed(2)}`);
  check('…and does not end pinned at the resolution floor',
    q.cap > q.floor + 0.01,
    `cap ${q.cap.toFixed(2)} floor ${q.floor.toFixed(2)}`);
}

// ------------------------------------------------- 4. sustained stutter still costs
//
// The fix above must not be a disabled controller. A p95 that is late in EVERY
// window is stutter a player feels, and it must still be paid for.
{
  const { q } = rig('high');
  play(q, 120, () => window60(12, 25, 40));   // late in every window, not one in ten
  check('sustained stutter still costs quality',
    q.cap < q.ceiling - 0.05 || q.tierIndex < 2,
    `cap ${q.cap.toFixed(2)}/${q.ceiling.toFixed(2)} tier ${TIERS[q.tierIndex]}`);
}

// -------------------------------------------- 5. early drops do not sour the session
//
// `patience()` doubles with every tier drop. Without the calm-run forgiveness a
// rough opening makes every later recovery need thirty-two unbroken comfortable
// seconds, which a real session never supplies.
{
  const { q } = rig('high');
  play(q, 200, () => window60(35));           // a rough opening: several drops
  const drops = q.tierDrops;
  play(q, 900, () => window60(6));            // and then it is a fast machine
  check('a rough opening does not make later recovery impossible',
    q.tierIndex === 2 && q.cap >= q.ceiling - 0.001,
    `${drops} early drops, ended tier ${TIERS[q.tierIndex]} cap ${q.cap.toFixed(2)}`);
}

// ------------------------------------------------------------- 6. no flapping
//
// The other failure mode: a controller so eager to climb that it oscillates
// between two looks, which is worse to sit in front of than the lower one.
{
  const { q } = rig('high');
  play(q, 600, () => window60(17));           // right on the edge of the budget
  check('a machine on the edge of the budget does not flap',
    q.changes < 120, `${q.changes} quality changes in ten minutes`);
}

const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\nquality-loop gate FAILED (${bad} of ${results.length})`
  : `\nquality loop: all ${results.length} checks passed — the controller can find its way back up.`);
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This gate is recorded
   per wave and its recorded RED fails `npm run check`, so what it holds has to
   be legible to the runner and not only to a reader. The quality controller is arithmetic in
   src/core/engine.js and is not unit-scoped: a machine that spends its
   resolution down to the floor and never gives up the effect tier is that way
   in every unit at once. */
findings('check:quality', { scope: 'engine' })
  .engine(results.filter((r) => !r.ok).map((r) => `${r.name || r.label || 'case'}: ${r.why || r.detail || 'the controller did not recover'}`))
  .done();
