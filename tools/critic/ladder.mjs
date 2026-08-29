#!/usr/bin/env node
/**
 * THE DIFFICULTY-LADDER RULES.
 *
 *   node tools/critic/ladder.mjs --self-test   # prove all four rules can fail
 *   node tools/critic/ladder.mjs --thresholds  # print the numbers and why
 *
 * WHY THIS FILE EXISTS
 *
 * `tools/validate-courses.mjs` has measured the ladder for a long time, and it
 * asked one question: does every band ask more than the band under it? That is
 * the only shape of broken ladder it could see, and it is not the only shape a
 * ladder breaks in. A critic read the same table by hand and found two more,
 * neither of which the gate had an opinion about:
 *
 *   · `system-substitution` runs 8.20 8.65 8.66 8.90 9.19. Every rung rises, so
 *     the gate was happy. Band five asks 12% more than band one — the whole
 *     climb is smaller than a single ordinary rung elsewhere in the bank — and
 *     bands two and three differ by 0.01. The engine spends its adaptivity
 *     moving a learner between five settings that are the same setting.
 *
 *   · `exponent-power` runs 4.01 4.44 4.96 9.16 10.21. Every rung rises, so the
 *     gate was happy about this one too. Bands one to three cover 0.95 of
 *     demand and the step from three to four covers 4.20 — 68% of the whole
 *     climb at one boundary, an 85% jump. That is not a rung, it is a wall
 *     inside one skill, and the learner who hits it has done nothing wrong.
 *
 * A gate that only knows about inversion certifies both. So the rules live
 * here, as a pure function over one skill's five band means, with a self-test
 * that fires each of them on the REAL numbers from the real defect and then
 * proves each one stays quiet on the nearest honest skill in the same bank.
 * That second half is the half that matters: a threshold picked to catch the
 * defect is worthless if it also catches the twenty skills either side of it.
 *
 * WHERE THE THRESHOLDS COME FROM
 *
 * Measured over all 62 skills the manifest ships, at 240 seeds per band:
 *
 *     whole rise (band5 - band1)    min 0.99   p10 1.90   median 2.68   max 6.20
 *     smallest adjacent step        min -0.03  p10 0.10   median 0.20   max 0.42
 *     biggest step / whole rise     median 35%  p90 48%   p95 50%   max 68%
 *     biggest step, % of band below  median 17%  p90 27%   p95 29%   max 85%
 *
 * Every threshold below sits in a real gap in that distribution, and the
 * self-test names the skill on the safe side of each gap.
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The four numbers, and the sentence each one is enforcing. */
export const THRESHOLDS = {
  /** Band 5 must ask at least this much more than band 1, as a share of band 1.
   *  Five bands that differ by less than a sixth are one band wearing five
   *  hats. `system-substitution` is +12.1%; the next thinnest ladder in the
   *  bank, `write-linear`, is +21.4%. */
  minRise: 0.15,
  /** An adjacent step below this share of the band under it is not a step.
   *  `system-substitution` band 2→3 is +0.12% and `slope-rate` band 4→5 is
   *  +0.55%; the next smallest in the bank, `write-linear` band 4→5, is
   *  +1.46%. At 240 seeds a difference this small is inside the sampling
   *  noise, which is exactly the point: the boundary is invisible. */
  minStepRel: 0.01,
  /** One step may not carry more than this share of the whole climb…
   *  `exponent-power` band 3→4 carries 67.7%; the next largest, `poly-divide`,
   *  carries 55.1%. */
  cliffShare: 0.60,
  /** …AND be a jump of more than this much over the band under it.
   *  Both conditions have to hold, so a short ladder whose rise is small
   *  enough for one step to dominate it is not called a wall unless that step
   *  is also a real wall. `exponent-power` is +84.7%; `poly-divide` is +41.0%
   *  and so is never asked the first question. */
  cliffRel: 0.50,
};

/**
 * Below this many seeds per band the sampling noise is larger than a rung, so
 * a short run measures and prints but does not fail. The shipped gate runs the
 * full count. (This is the rule `validate-courses.mjs` already applied to
 * inversion; every rule here inherits it.)
 */
export const MIN_SEEDS = 120;

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const f2 = (x) => x.toFixed(2);

/**
 * Every way this skill's ladder is broken, in reading order.
 *
 * @param {number[]} mean five band means, band 1 first
 * @param {{seeds?:number}} opts
 * @returns {{rule:string, band:number, text:string}[]}
 */
export function ladderFaults(mean, opts = {}) {
  const seeds = opts.seeds ?? MIN_SEEDS;
  const out = [];
  if (!Array.isArray(mean) || mean.length !== 5 || mean.some((m) => !Number.isFinite(m) || m <= 0)) {
    return [{ rule: 'no-ladder', band: 0, text: `the five band means are not five positive numbers: ${JSON.stringify(mean)}` }];
  }
  if (seeds < MIN_SEEDS) return out;

  const rise = mean[4] - mean[0];
  const steps = [];
  for (let i = 1; i < 5; i++) steps.push(mean[i] - mean[i - 1]);

  // 1. INVERTED — a band that asks less than the one under it.
  for (let i = 1; i < 5; i++) {
    if (steps[i - 1] > 0) continue;
    const drop = mean[i - 1] - mean[i];
    out.push({
      rule: 'inverted',
      band: i + 1,
      text: `band ${i + 1} does not ask more than band ${i} (${f2(mean[i - 1])} -> ${f2(mean[i])}, `
        + `${drop === 0 ? 'identical' : `down ${f2(drop)}, ${pct(drop / mean[i - 1])}`})`,
    });
  }

  // 2. FLAT-SPAN — the whole ladder is one band.
  if (rise / mean[0] < THRESHOLDS.minRise) {
    out.push({
      rule: 'flat-span',
      band: 0,
      text: `bands 1 to 5 span only ${f2(rise)} (${f2(mean[0])} -> ${f2(mean[4])}, +${pct(rise / mean[0])}); `
        + `a ladder must rise at least ${pct(THRESHOLDS.minRise)} or the five bands are one band `
        + `[${mean.map(f2).join(' ')}]`,
    });
  }

  // 3. FLAT-STEP — a rung that rises, but not enough to be a rung.
  for (let i = 1; i < 5; i++) {
    const st = steps[i - 1];
    if (st <= 0) continue;                       // already reported as inverted
    const rel = st / mean[i - 1];
    if (rel >= THRESHOLDS.minStepRel) continue;
    out.push({
      rule: 'flat-step',
      band: i + 1,
      text: `band ${i + 1} asks the same as band ${i} (${f2(mean[i - 1])} -> ${f2(mean[i])}, `
        + `+${st.toFixed(3)}, +${pct(rel)}); a step under +${pct(THRESHOLDS.minStepRel)} is inside the noise`,
    });
  }

  // 4. CLIFF — a wall inside one skill.
  if (rise > 0) {
    for (let i = 1; i < 5; i++) {
      const st = steps[i - 1];
      if (st <= 0) continue;
      const share = st / rise;
      const rel = st / mean[i - 1];
      if (share <= THRESHOLDS.cliffShare || rel <= THRESHOLDS.cliffRel) continue;
      out.push({
        rule: 'cliff',
        band: i + 1,
        text: `band ${i} to band ${i + 1} is a wall, not a rung (${f2(mean[i - 1])} -> ${f2(mean[i])}, `
          + `+${f2(st)}, +${pct(rel)}) — ${pct(share)} of the whole climb happens at one boundary `
          + `[${mean.map(f2).join(' ')}]`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Self-test: a gate nobody has watched fail is a gate nobody should trust.
//
// Each rule fires on the REAL band means of the REAL skill a critic caught by
// hand, and then stays quiet on the REAL band means of the nearest honest skill
// in the same bank. A threshold that cannot show its own margin is a guess.
// ---------------------------------------------------------------------------
function selfTest() {
  let bad = 0;
  const must = (rule, mean, why) => {
    const hits = ladderFaults(mean, { seeds: 240 }).map((f) => f.rule);
    if (!hits.includes(rule)) { console.error(`SELF-TEST FAIL: ${rule} not raised on ${why} [${mean.join(' ')}]`); bad++; }
    else console.log(`  fires  ${rule.padEnd(10)} ${why}`);
  };
  const mustNot = (rule, mean, why) => {
    const hits = ladderFaults(mean, { seeds: 240 }).map((f) => f.rule);
    if (hits.includes(rule)) { console.error(`SELF-TEST FAIL: ${rule} false positive on ${why} [${mean.join(' ')}]`); bad++; }
    else console.log(`  quiet  ${rule.padEnd(10)} ${why}`);
  };

  // --- each rule, on the defect it exists for -------------------------------
  must('inverted', [7.99, 9.04, 9.01, 9.87, 10.55], 'multi-step, band 3 below band 2 (the one the old rule caught)');
  must('flat-span', [8.20, 8.65, 8.66, 8.90, 9.19], 'system-substitution, five bands spanning 0.99');
  must('flat-step', [8.20, 8.65, 8.66, 8.90, 9.19], 'system-substitution, band 2 to band 3 is +0.01');
  must('flat-step', [5.38, 5.67, 6.68, 7.26, 7.30], 'slope-rate, band 4 to band 5 is +0.04');
  must('cliff', [4.01, 4.44, 4.96, 9.16, 10.21], 'exponent-power, 4.96 -> 9.16 is 68% of the whole climb');

  // --- and on the nearest honest skill, where it must stay quiet ------------
  mustNot('flat-span', [5.71, 6.12, 6.35, 6.83, 6.93], 'write-linear, the thinnest honest ladder (+21.4%)');
  mustNot('flat-step', [5.71, 6.12, 6.35, 6.83, 6.93], 'write-linear, the smallest honest step (+1.46%)');
  mustNot('cliff', [5.01, 5.66, 7.98, 8.79, 9.22], 'poly-divide, the steepest honest step (55% of the climb)');
  mustNot('cliff', [3.78, 4.19, 4.92, 6.31, 8.83], 'exponent-product, a ladder that steepens all the way up');
  mustNot('inverted', [5.62, 6.66, 8.55, 9.85, 10.15], 'difference-of-squares, a clean ladder');

  // A clean ladder raises nothing at all.
  const clean = ladderFaults([5.0, 5.8, 6.6, 7.4, 8.2], { seeds: 240 });
  if (clean.length) { console.error(`SELF-TEST FAIL: a clean ladder raised ${JSON.stringify(clean)}`); bad++; }
  else console.log('  quiet  all        a textbook ladder 5.0 5.8 6.6 7.4 8.2');

  // A short run measures and prints but does not fail.
  if (ladderFaults([8.20, 8.65, 8.66, 8.90, 9.19], { seeds: 24 }).length) {
    console.error('SELF-TEST FAIL: a 24-seed run failed the build on sampling noise'); bad++;
  } else console.log('  quiet  all        a 24-seed run, where the noise is bigger than a rung');

  // Nonsense in, a named failure out — never a silent pass.
  if (!ladderFaults([1, 2, 3], { seeds: 240 }).length) { console.error('SELF-TEST FAIL: three bands passed as five'); bad++; }
  if (!ladderFaults([0, 0, 0, 0, 0], { seeds: 240 }).length) { console.error('SELF-TEST FAIL: an all-zero ladder passed'); bad++; }

  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('\nself-test: ok — all four rules fire on the real defect and stay quiet on the nearest honest skill');
}

/* Run as a tool, or imported by tools/validate-courses.mjs. `realpathSync`
   rather than a string compare: the repo is reached through a symlink on more
   than one machine here, and a mismatched path would silently turn the
   self-test into a no-op — which is the one failure a self-test may not have. */
const isMain = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  if (process.argv.includes('--self-test')) selfTest();
  else if (process.argv.includes('--thresholds')) {
    for (const [k, v] of Object.entries(THRESHOLDS)) console.log(`${k.padEnd(12)} ${v}`);
    console.log(`${'minSeeds'.padEnd(12)} ${MIN_SEEDS}`);
  } else {
    console.log('usage: node tools/critic/ladder.mjs --self-test | --thresholds');
    console.log('The rules themselves are applied by tools/validate-courses.mjs, per skill.');
  }
}
