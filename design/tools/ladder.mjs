/**
 * THE SPACED RE-ENTRY SCHEDULE, GRADED.
 *
 *   node design/tools/ladder.mjs [learners] [sittings]
 *
 * The ladder that ships is [10 min, 8 h, 21 h, 52 h, 130 h] and it has never
 * been graded against a named alternative on a named night. Every row here is
 * the SAME engine with `reviewMinutes` replaced, on identical seeds, playing
 * Pomodoro sittings on a virtual wall clock.
 *
 * What each row has to answer at once:
 *   · does the learner get there  — lines held, and truly held, at the buzzer
 *   · does it survive             — the same learners a week and a month later,
 *                                   taught nothing and asked nothing
 *   · what it costs a sitting     — re-probes as a share of a 22-minute session,
 *                                   because every one of them is a minute not
 *                                   spent on something the learner cannot do
 *   · night five                  — cold re-probes right first try, unaided, on
 *                                   the fifth night after a claim
 */
import { buildWorld, runLearner, decayTo, mean, wilson, TRUE_MASTERY } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 250);
const DAYS = Number(process.argv[3] || 25);
const SESSION = Number(process.env.SESSION || 22);
const GAP = Number(process.env.GAP || 24);
const arm = armOf();
const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;
const NEED = Math.max(1, Math.round(0.9 * skills.length));

const LADDERS = [
  ['shipping        10m 8h 21h 52h 130h', null],
  ['no in-sitting rung  8h 21h 52h 130h', [480, 1260, 3120, 7800]],
  ['daily-aligned  10m 20h 44h 92h 188h', [10, 1200, 2640, 5520, 11280]],
  ['tight early    10m 4h 20h 44h  92h', [10, 240, 1200, 2640, 5520]],
  ['six rungs  10m 8h 21h 52h 130h 14d', [10, 480, 1260, 3120, 7800, 20160]],
  ['slow           10m 20h 3d  7d  21d', [10, 1200, 4320, 10080, 30240]],
  ['old, pre-clock  1d 3d 8d 21d', [1440, 4320, 11520, 30240]],
  ['tighter        10m 3h 12h 30h 72h 7d', [10, 180, 720, 1800, 4320, 10080]],
  ['tight+long 10m 4h 20h 44h 92h 14d', [10, 240, 1200, 2640, 5520, 20160]],
];
const ONLY = process.env.LADDERS ? process.env.LADDERS.split(',').map(Number) : null;

console.log(`THE SPACED RE-ENTRY SCHEDULE — ${N} learners, ${DAYS} sittings of ${SESSION} min, ${GAP} h apart, arm "${arm.name}"`);
console.log('  ' + 'ladder'.padEnd(36) + ' held  trueheld   learners >=' + NEED + '   +7d    +30d   review/sitting  night-5 probe  durable');
LADDERS.forEach(([label, mins], idx) => {
  if (ONLY && !ONLY.includes(idx)) return;
  const cfg = { ...arm.cfg };
  if (mins) cfg.reviewMinutes = mins;
  const runs = [];
  for (let i = 0; i < N; i++) {
    runs.push(runLearner(world, (i * 2654435761 + 12345) >>> 0, {
      budget: 6000, sessions: DAYS, sessionMinutes: SESSION, gapHours: GAP, ...arm, cfg,
    }));
  }
  let held = 0, trueHeld = 0, heldN = 0, ok = 0, dur = 0, rev = 0, items = 0;
  let n5 = 0, n5clean = 0;
  for (const r of runs) {
    held += r.heldSet.size;
    for (const s of r.heldSet) { heldN++; if (r.k.get(s) >= TRUE_MASTERY) trueHeld++; }
    if (skills.filter((s) => r.k.get(s) >= TRUE_MASTERY).length >= NEED) ok++;
    dur += r.durable;
    rev += r.probes.length;
    items += r.items;
    for (const p of r.probes) if (p.sinceClaim != null && p.sinceClaim >= 4.5 && p.sinceClaim < 5.5) { n5++; if (p.clean) n5clean++; }
  }
  const later = (d) => {
    let c = 0;
    for (const r of runs) {
      const kk = decayTo(r, skills, d);
      if (skills.filter((s) => kk.get(s) >= TRUE_MASTERY).length >= NEED) c++;
    }
    return 100 * c / runs.length;
  };
  const [lo, hi] = wilson(n5clean, n5);
  console.log(`  ${label.padEnd(36)}${(held / N).toFixed(1).padStart(5)}  ${(trueHeld / Math.max(1, heldN) * 100).toFixed(1).padStart(7)}%  ${(100 * ok / N).toFixed(1).padStart(10)}%  ${later(7).toFixed(1).padStart(5)}%  ${later(30).toFixed(1).padStart(5)}%  ${(rev / N / DAYS).toFixed(2).padStart(11)}    ${(100 * n5clean / Math.max(1, n5)).toFixed(1).padStart(9)}% ±${(50 * (hi - lo)).toFixed(1)}  ${(dur / N).toFixed(1).padStart(6)}`);
});
