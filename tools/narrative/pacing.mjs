/**
 * DOES THE STORY OUTLAST THE AFTERNOON?
 *
 * The finding this exists to answer: two hundred and sixty items in one sitting
 * reached Sovereign and the final chapter with **0 NIGHTS HELD**, while the
 * mathematics was correctly paced across real days by the spacing schedule. The
 * game disagreed with itself about how long it was.
 *
 * This runs the real mastery engine on its real wall clock, plays a learner
 * through sessions on separate days, and asks the real gates in `src/meta`
 * which rank and which chapter that state has bought. Two arms:
 *
 *   THE MARATHON   one sitting. Items until it stops paying.
 *   THE RETURN     twenty-five minutes a day, coming back.
 *
 *   node tools/narrative/pacing.mjs [--days 12] [--minutes 25]
 *
 * It fails if the marathon can still buy the top of either ladder, because that
 * is the defect, and if the returning learner cannot reach them in a fortnight,
 * because a gate nobody passes is not pacing, it is a wall.
 */
import { MasteryEngine, itemSeconds } from '../../src/learn/mastery.js';
import { standingOf, blankLedger } from '../../src/meta/standing.js';
import { RANKS, RANK_AT, RANK_NIGHTS, rankFor, rankGate } from '../../src/meta/arc.js';
import { CHAPTER_AT, CHAPTER_NIGHTS, chapterFor, chapterGate } from '../../src/meta/shard.js';
import { blankDays, noteDay, noteNight } from '../../src/meta/days.js';
import { loadUnit, allUnits } from '../_courses.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const DAYS = arg('days', 14);
const MINUTES = arg('minutes', 25);
const ACC = 0.92;

const units = await allUnits();
const graph = await loadUnit(units.find((u) => u.unit.id === 'algebra1-l1').unit);

console.log('ASCENT — story and rank against real returning days\n');
const marathon = play({ sessions: 1, minutes: 600, label: 'THE MARATHON  one sitting, ten hours' });
const returning = play({ sessions: DAYS, minutes: MINUTES, label: `THE RETURN    ${MINUTES} min a day, ${DAYS} days` });

console.log('\nWHERE EACH LADDER LANDS');
console.log('  arm        items  tears  standing  nights  rank        chapter  next gate');
for (const r of [marathon, returning]) {
  console.log(`  ${r.tag.padEnd(10)} ${String(r.items).padStart(5)} ${String(r.tears).padStart(6)} `
    + `${String(r.standing).padStart(9)} ${String(r.nights).padStart(7)} `
    + `${RANKS[r.rank].padEnd(11)} ${String(r.chapter).padStart(7)}  ${r.gate}`);
}

console.log('\nFIRST DAY EACH BEAT ARRIVES, for the returning learner');
for (let i = 1; i < RANKS.length; i++) {
  const d = returning.rankDay[i];
  console.log(`  rank ${RANKS[i].padEnd(10)} standing ${String(RANK_AT[i]).padStart(3)}  nights ${String(RANK_NIGHTS[i]).padStart(2)}  ->  ${d ? 'day ' + d : 'not reached'}`);
}
for (let c = 2; c <= CHAPTER_AT.length; c++) {
  const d = returning.chapterDay[c];
  console.log(`  chapter ${String(c).padEnd(8)} tears ${String(CHAPTER_AT[c - 1]).padStart(6)}  nights ${String(CHAPTER_NIGHTS[c - 1]).padStart(2)}  ->  ${d ? 'day ' + d : 'not reached'}`);
}

const problems = [];
if (marathon.rank >= 4) problems.push('one sitting still buys Sovereign');
if (marathon.chapter >= 5) problems.push('one sitting still opens the last chapter');
if (!returning.rankDay[4]) problems.push(`a returning learner does not reach Sovereign inside ${DAYS} days`);
if (!returning.chapterDay[5]) problems.push(`a returning learner does not reach chapter 5 inside ${DAYS} days`);

console.log('');
if (problems.length) {
  for (const p of problems) console.log('FAIL — ' + p);
  process.exit(1);
}
console.log('PASS — the marathon cannot buy the top of either ladder, and coming back can.');

// ---------------------------------------------------------------------------

function play({ sessions, minutes, label }) {
  const mastery = new MasteryEngine(graph);
  let clockMs = Date.now();
  mastery.setClock(() => clockMs);
  const led = blankLedger();
  const days = blankDays();
  const rankDay = {}, chapterDay = {};
  let items = 0;
  const rnd = mulberry(0x51DE);

  for (let day = 1; day <= sessions; day++) {
    let spent = 0;
    while (spent < minutes * 60) {
      const task = mastery.next();
      if (!task) break;
      const id = task.id || task.skill;
      if (!id) break;
      const t2 = mastery.taskFor(id);
      const correct = rnd() < ACC;
      const kind = t2?.kind;
      mastery.observe(id, correct, { assisted: false, kind, seconds: 40 });
      noteDay(days, clockMs);
      noteNight(days, clockMs, mastery.durableCount());
      if (correct) led.clean += 1;
      if (correct && kind === 'check') led.checks += 1;
      items += 1;
      spent += itemSeconds(t2?.difficulty ?? 3, true);
      // A sitting cannot manufacture a night: five hours of wall clock is the
      // engine's own bar. Inside a session the clock moves by the item.
      clockMs += Math.round(itemSeconds(t2?.difficulty ?? 3, true) * 1000);
    }
    const s = snapshot(mastery, led, days);
    if (!rankDay[s.rank] || rankDay[s.rank] > day) {
      for (let i = 1; i <= s.rank; i++) if (!rankDay[i]) rankDay[i] = day;
    }
    for (let c = 2; c <= s.chapter; c++) if (!chapterDay[c]) chapterDay[c] = day;
    // …and then a real night.
    clockMs += 86400000 - minutes * 60000;
  }

  const s = snapshot(mastery, led, days);
  const g = rankGate(s.standing, s.nights, s.rank);
  const cg = chapterGate(s.tears, s.nights, s.chapter);
  console.log(`${label}`);
  console.log(`  ${items} items · ${s.tears} tears · standing ${s.standing} · ${s.nights} nights held`);
  console.log(`  rank ${RANKS[s.rank]} (${g.kind === 'top' ? 'summit' : `needs ${g.need} more ${g.kind}`})`
    + ` · chapter ${s.chapter} (${cg.kind === 'top' ? 'all open' : `needs ${cg.need} more ${cg.kind}`})\n`);
  return {
    tag: label.split(' ')[1].toLowerCase(), items, ...s, rankDay, chapterDay,
    gate: g.kind === 'top' ? 'summit' : `${g.need} ${g.kind}`,
  };
}

function snapshot(mastery, led, days) {
  let lines = 0, open = 0;
  for (const st of mastery.state.values()) if (st.mastered) lines += 1;
  for (const n of mastery.graph.nodes) if (mastery.isUnlocked(n.id)) open += 1;
  const tears = led.clean + led.assisted;
  const standing = standingOf(led, lines, open);
  const nights = days.nights || 0;
  return {
    tears, standing, nights, lines,
    rank: rankFor(standing, nights),
    chapter: chapterFor(tears, nights),
  };
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
