/**
 * DAY-FIVE RETENTION — the number this project has never had.
 *
 *   node design/tools/retention.mjs [learners] [days]
 *   LADDER=10,1200,2880,5760,11520 node design/tools/retention.mjs 400 8
 *   SESSION=22 GAP=24 node design/tools/retention.mjs
 *
 * The spaced schedule in src/learn/mastery.js is measured in ELAPSED NIGHTS, on
 * purpose, so that it cannot be ground out in one sitting. That is right, and it
 * is also why nobody has ever measured what happens on night five: the only
 * instrument that could wait five nights is a simulated clock, and the shipping
 * simulation reports a day-spanning cohort in aggregate rather than on a named
 * night.
 *
 * So this plays Pomodoro sittings — `SESSION` minutes of work, `GAP` hours
 * apart — through the real engine on a virtual wall clock, and reads two
 * different things off night five:
 *
 *   MEASURED   the engine's own cold re-probe: of the lines this learner had
 *              proved, what share came back right, first try, unaided, on the
 *              first ask of that day. This is a number the game can actually
 *              print, because it is an event the schedule was going to produce
 *              anyway. Nothing extra is asked of the learner.
 *   TRUE       the hidden competence the learner really has on night five,
 *              which the engine never sees. This is what the MEASURED number is
 *              an estimate OF, and printing both is the only way to say whether
 *              the estimate is honest.
 */
import { buildWorld, runLearner, decayTo, q, med, mean, wilson, TRUE_MASTERY, HOLLOW } from './lib/sim.mjs';
import { armOf } from './lib/arms.mjs';

const N = Number(process.argv[2] || 400);
const DAYS = Number(process.argv[3] || 8);
const SESSION = Number(process.env.SESSION || 22);
const GAP = Number(process.env.GAP || 24);
const arm = armOf();
if (process.env.LADDER) arm.cfg.reviewMinutes = process.env.LADDER.split(',').map(Number);
const world = await buildWorld(process.env.UNIT || 'algebra1-l1');
const { skills } = world;

console.log(`DAY-FIVE RETENTION — ${N} learners, ${DAYS} sittings of ${SESSION} min, ${GAP} h apart`);
console.log(`  arm "${arm.name}"   ladder ${JSON.stringify(arm.cfg.reviewMinutes || 'shipping')}   feedback ${(100 * world.feedbackRate).toFixed(1)}%${world.feedbackPinned ? ' pinned' : ''}`);

const runs = [];
for (let i = 0; i < N; i++) {
  runs.push(runLearner(world, (i * 2654435761 + 12345) >>> 0, {
    budget: 4000, sessions: DAYS, sessionMinutes: SESSION, gapHours: GAP, ...arm,
  }));
}

// --- 1. what a sitting is made of, day by day -------------------------------
console.log('\n  what a sitting is made of — items per learner per day, by what the scheduler called them');
console.log('    day   items   learn   check   probe   review   retrieval   deep     minutes   lines held at the end   durable');
{
  const per = [];
  for (let d = 1; d <= DAYS; d++) per.push({ n: 0, kinds: new Map(), mins: 0, held: 0, durable: 0 });
  for (const r of runs) {
    let prev = { items: 0, seconds: 0 };
    r.sessionTrace.forEach((t, i) => {
      if (i >= DAYS) return;
      const p = per[i];
      p.n++;
      p.mins += (t.seconds - prev.seconds) / 60;
      p.held += t.engineMastered;
      p.durable += t.durable;
      prev = t;
    });
  }
  // Kinds have to come off a watch, so a second, smaller pass does it.
  const kn = Math.min(N, 200);
  const kinds = [];
  for (let d = 0; d < DAYS; d++) kinds.push(new Map());
  const cnt = new Array(DAYS).fill(0);
  for (let i = 0; i < kn; i++) {
    let sit = 0, sec = 0;
    runLearner(world, (i * 2654435761 + 12345) >>> 0, {
      budget: 4000, sessions: DAYS, sessionMinutes: SESSION, gapHours: GAP, ...arm,
      watch: (e) => {
        // `sitting` is not on the hook, so it is recomputed from the clock the
        // same way the loop does: work seconds inside the current sitting.
        sec += e.cost;
        if (sit < DAYS) { const m = kinds[sit]; m.set(e.kind, (m.get(e.kind) || 0) + 1); }
        if (sec >= SESSION * 60) { sec = 0; if (sit < DAYS) cnt[sit]++; sit++; }
      },
    });
  }
  for (let d = 0; d < DAYS; d++) {
    const p = per[d];
    if (!p.n) break;
    const m = kinds[d];
    const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    const g = (k) => ((m.get(k) || 0) / kn).toFixed(1).padStart(6);
    console.log(`    ${String(d + 1).padStart(3)}  ${(tot / kn).toFixed(1).padStart(6)}  ${g('learn')}  ${g('check')}  ${g('probe')}  ${g('review')}  ${g('retrieval').padStart(9)}  ${g('deep')}   ${(p.mins / p.n).toFixed(1).padStart(7)}   ${(p.held / p.n).toFixed(1).padStart(19)}   ${(p.durable / p.n).toFixed(1).padStart(7)}`);
  }
}

// --- 2. THE NUMBER ----------------------------------------------------------
// Every cold re-probe the schedule called for, grouped by the day it landed on.
console.log('\n  THE COLD RE-PROBE — every question the schedule called for, by the day it landed on');
console.log('    day    probes/learner   answered right, first try, unaided   median gap since last proved   across a night');
{
  const byDay = new Map();
  for (const r of runs) {
    for (const p of r.probes) {
      const d = Math.floor(p.day) + 1;
      const b = byDay.get(d) || { n: 0, clean: 0, gaps: [], night: 0 };
      b.n++; if (p.clean) b.clean++; b.gaps.push(p.gapHours);
      if (p.gapHours >= 5) b.night++;
      byDay.set(d, b);
    }
  }
  for (const [d, b] of [...byDay].sort((a, c) => a[0] - c[0])) {
    if (d > DAYS) break;
    const [lo, hi] = wilson(b.clean, b.n);
    console.log(`    ${String(d).padStart(3)}   ${(b.n / N).toFixed(2).padStart(12)}   ${(100 * b.clean / b.n).toFixed(1).padStart(12)}% [${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}]   ${med(b.gaps).toFixed(1).padStart(24)} h   ${(100 * b.night / b.n).toFixed(1).padStart(11)}%`);
  }
}

// --- 3. night five, on its own ---------------------------------------------
console.log('\n  NIGHT FIVE');
{
  const day5 = [];
  const firstOfDay5 = [];
  for (const r of runs) {
    const mine = r.probes.filter((p) => Math.floor(p.day) + 1 === 5);
    day5.push(...mine);
    // The FIRST cold ask on each line that day — the honest "did it survive the
    // night" reading, before the day's own practice has warmed anything up.
    const seen = new Set();
    for (const p of mine) { if (seen.has(p.skill)) continue; seen.add(p.skill); firstOfDay5.push(p); }
  }
  const rate = (xs) => { const k = xs.filter((x) => x.clean).length; const [lo, hi] = wilson(k, xs.length); return `${(100 * k / Math.max(1, xs.length)).toFixed(1)}% [${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}], n=${xs.length}`; };
  console.log(`    every cold re-probe on day five, right first try unaided      ${rate(day5)}`);
  console.log(`    the FIRST cold ask on each line that day                      ${rate(firstOfDay5)}`);
  const night = firstOfDay5.filter((p) => p.gapHours >= 5);
  console.log(`    ...of those, the ones that really crossed a night (>= 5 h)    ${rate(night)}   (${(100 * night.length / Math.max(1, firstOfDay5.length)).toFixed(1)}% of them)`);
  const byStage = new Map();
  for (const p of firstOfDay5) { const b = byStage.get(p.stage) || []; b.push(p); byStage.set(p.stage, b); }
  console.log('    by the rung the line was on:');
  for (const [st, xs] of [...byStage].sort((a, b) => a[0] - b[0])) {
    console.log(`      rung ${st}   ${rate(xs)}   median gap ${med(xs.map((x) => x.gapHours)).toFixed(1)} h`);
  }
  const byNights = new Map();
  for (const p of firstOfDay5) { const b = byNights.get(Math.min(4, p.wasDurable)) || []; b.push(p); byNights.set(Math.min(4, p.wasDurable), b); }
  console.log('    by how many nights this line had already survived:');
  for (const [nn, xs] of [...byNights].sort((a, b) => a[0] - b[0])) {
    console.log(`      ${nn === 4 ? '4+' : ` ${nn}`} nights   ${rate(xs)}`);
  }
}

// --- 3b. FIVE NIGHTS AFTER THE CLAIM ----------------------------------------
// The other reading of the question, and the one retention is actually about:
// not "night five of the course" but "the fifth night after this line was
// proved". The engine's ladder puts cold re-probes at roughly 1, 2, 4 and 9
// nights after a claim, so the curve is read off where the probes actually fall.
console.log('\n  FIVE NIGHTS AFTER THE CLAIM — the forgetting curve, as the game measures it');
console.log('    nights since the claim   probes   right first try, unaided   hidden competence, mean / share >= ' + TRUE_MASTERY);
{
  const bins = [[0.5, 1.5, '1'], [1.5, 2.5, '2'], [2.5, 3.5, '3'], [3.5, 4.5, '4'], [4.5, 5.5, '5'], [5.5, 8.5, '6-8'], [8.5, 14.5, '9-14'], [14.5, 1e9, '15+']];
  for (const [a, b, label] of bins) {
    const xs = [];
    for (const r of runs) for (const p of r.probes) if (p.sinceClaim != null && p.sinceClaim >= a && p.sinceClaim < b) xs.push(p);
    if (!xs.length) continue;
    const k = xs.filter((x) => x.clean).length;
    const [lo, hi] = wilson(k, xs.length);
    const above = xs.filter((x) => x.k >= TRUE_MASTERY).length;
    console.log(`    ${label.padStart(18)}   ${String(xs.length).padStart(8)}   ${(100 * k / xs.length).toFixed(1).padStart(12)}% [${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}]   ${mean(xs.map((x) => x.k)).toFixed(3).padStart(14)} / ${(100 * above / xs.length).toFixed(1)}%`);
  }
}

// --- 4. the hidden truth on night five --------------------------------------
console.log('\n  WHAT IS ACTUALLY THERE ON NIGHT FIVE — hidden competence the engine never sees');
{
  const rows = [];
  for (const r of runs) {
    const held = [...r.heldSet];
    if (!held.length) continue;
    let above = 0, sum = 0;
    for (const s of held) { const kk = r.k.get(s); sum += kk; if (kk >= TRUE_MASTERY) above++; }
    rows.push({ held: held.length, above, mean: sum / held.length, hollow: held.filter((s) => r.k.get(s) < HOLLOW).length });
  }
  const H = rows.reduce((a, b) => a + b.held, 0);
  const A = rows.reduce((a, b) => a + b.above, 0);
  const HO = rows.reduce((a, b) => a + b.hollow, 0);
  const [lo, hi] = wilson(A, H);
  console.log(`    lines standing HELD at the end of day ${DAYS}                     ${(H / rows.length).toFixed(2)} per learner`);
  console.log(`    of those, truly above the mastery bar (k >= ${TRUE_MASTERY})         ${(100 * A / H).toFixed(1)}% [${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}]`);
  console.log(`    of those, below the hollow bar (k < ${HOLLOW})                    ${(100 * HO / H).toFixed(2)}%`);
  console.log(`    mean hidden competence on a held line                       ${mean(rows.map((r) => r.mean)).toFixed(3)}`);
  // …and the same question asked of the LEARNER rather than of the line, which
  // is the definition every published mastery figure in this project uses.
  const need = Math.max(1, Math.round(0.9 * skills.length));
  const learnerRate = (days) => {
    let ok = 0, allOf = 0;
    for (const r of runs) {
      const kk = days ? decayTo(r, skills, days) : r.k;
      const t = skills.filter((s) => kk.get(s) >= TRUE_MASTERY).length;
      if (t >= need) ok++;
      if (t === skills.length) allOf++;
    }
    return [100 * ok / runs.length, 100 * allOf / runs.length];
  };
  console.log(`    LEARNERS with >= ${need} of ${skills.length} skills truly mastered, at the buzzer   ${learnerRate(0)[0].toFixed(1)}%   (all ${skills.length}: ${learnerRate(0)[1].toFixed(1)}%)`);
  for (const d of [1, 7, 30]) console.log(`      the same learners ${String(d).padStart(2)} days later, taught nothing         ${learnerRate(d)[0].toFixed(1)}%   (all ${skills.length}: ${learnerRate(d)[1].toFixed(1)}%)`);
  // And with nothing taught and nothing re-probed after the last sitting.
  for (const extra of [1, 7, 30]) {
    let ab = 0, tot = 0, sum = 0;
    for (const r of runs) {
      const kk = decayTo(r, skills, extra);
      for (const s of r.heldSet) { tot++; sum += kk.get(s); if (kk.get(s) >= TRUE_MASTERY) ab++; }
    }
    console.log(`    ${String(extra).padStart(2)} more days away, taught nothing and asked nothing      ${(100 * ab / Math.max(1, tot)).toFixed(1)}% still above the bar, mean ${(sum / Math.max(1, tot)).toFixed(3)}`);
  }
}

// --- 5. is the measured number an honest estimate of the true one? ----------
console.log('\n  IS THE MEASURED NUMBER HONEST?  the cold re-probe against the hidden truth, on the same lines');
{
  let n = 0, clean = 0, trueAbove = 0;
  const cal = [[0, 0.6], [0.6, 0.75], [0.75, 0.85], [0.85, 0.92], [0.92, 1.01]];
  const bins = cal.map(() => ({ n: 0, clean: 0 }));
  for (const r of runs) {
    const seen = new Set();
    for (const p of r.probes.filter((x) => Math.floor(x.day) + 1 === 5)) {
      if (seen.has(p.skill)) continue;
      seen.add(p.skill);
      n++; if (p.clean) clean++; if (p.k >= TRUE_MASTERY) trueAbove++;
      const i = cal.findIndex(([a, b]) => p.k >= a && p.k < b);
      if (i >= 0) { bins[i].n++; if (p.clean) bins[i].clean++; }
    }
  }
  console.log(`    measured on night five  ${(100 * clean / Math.max(1, n)).toFixed(1)}%    truly above the bar  ${(100 * trueAbove / Math.max(1, n)).toFixed(1)}%   (n=${n})`);
  console.log('    calibration — the pass rate of one cold item, by the learner\'s real competence BEFORE the answer:');
  cal.forEach(([a, b], i) => {
    if (!bins[i].n) return;
    console.log(`      k in [${a.toFixed(2)}, ${b.toFixed(2)})   ${(100 * bins[i].clean / bins[i].n).toFixed(1).padStart(5)}% pass   n=${bins[i].n}`);
  });
  // …and the same question at the grain a report card is written at: a whole
  // learner, over every cold re-probe of their last five days.
  console.log('\n    per LEARNER — their measured pass rate over the last five days against what is really there');
  const rowsL = [];
  for (const r of runs) {
    const cutoff = Math.max(...r.probes.map((p) => p.day), 0) - 5;
    const mine = r.probes.filter((p) => p.day >= cutoff);
    if (mine.length < 4 || !r.heldSet.size) continue;
    const measured = mine.filter((p) => p.clean).length / mine.length;
    const truly = [...r.heldSet].filter((s2) => r.k.get(s2) >= TRUE_MASTERY).length / r.heldSet.size;
    rowsL.push({ measured, truly, held: r.heldSet.size });
  }
  for (const [a, b] of [[0, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]]) {
    const xs = rowsL.filter((x) => x.measured >= a && x.measured < b);
    if (xs.length < 5) continue;
    console.log(`      measured ${(100 * a).toFixed(0)}-${(100 * b).toFixed(0)}%   ${String(xs.length).padStart(5)} learners   truly at mastery on ${(100 * mean(xs.map((x) => x.truly))).toFixed(1)}% of their held lines   (they hold ${mean(xs.map((x) => x.held)).toFixed(1)})`);
  }
}
