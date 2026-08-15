/**
 * DOES MARLOW RUN DRY?
 *
 * The complaint: *"Marlow is finished by seal 28, and then repeats its tutorial
 * line to a Sovereign."* A pass answered it with four registers (`voice.js`), a
 * milestone bank and a tutorial gate keyed to evidence rather than to memory.
 * This checks that the answer holds, against the real bundles and the real
 * state machine, at four points in a save:
 *
 *   0 seals      a cold cadet. The only state that may hear a tutorial line.
 *   30 seals     past the last chapter. Nothing may still be explaining.
 *   130 seals    the state the complaint was measured in.
 *   whole        every line held, every chapter open, Sovereign.
 *
 * For each it prints the register, whether Marlow may still tutor, which bank
 * every ambient beat is drawing from, and HOW MANY LINES ARE LEFT IN THE BANK —
 * a register with one line in it is a register that repeats, which is the same
 * defect wearing a better coat.
 *
 *   node tools/critic/marlow.mjs --url http://127.0.0.1:4488
 */
import { chromium } from 'playwright';
import {
  MILESTONES, MILESTONE_EVERY, NIGHT_MARKS, NIGHT_EVERY,
  milestoneCrossed, milestoneKey, nightMarkReached, nightMarkKey,
} from '../../src/meta/voice.js';

// ---------------------------------------------------------------------------
// The two ladders, read off the shipping module: does either of them end?
// ---------------------------------------------------------------------------
const seal = [];
for (let n = 1, at = 0; n <= 700; n++) {
  const m = milestoneCrossed(at, n);
  at = n;
  if (m) seal.push(m);
}
const nightsLadder = [];
for (let n = 1, said = 0; n <= 90; n++) {
  const m = nightMarkReached(n);
  if (m && m !== said) { nightsLadder.push(m); said = m; }
}
console.log('MARLOW — the two ladders, played one tick at a time');
console.log(`   seals   ${seal.join(' ')}`);
console.log(`   written to ${MILESTONES[MILESTONES.length - 1]}, then one every ${MILESTONE_EVERY} for ever`);
console.log(`   the beat at ${seal[seal.length - 1]} draws ${milestoneKey(seal[seal.length - 1])}`);
console.log(`   nights  ${nightsLadder.join(' ')}`);
console.log(`   written to ${NIGHT_MARKS[NIGHT_MARKS.length - 1]}, then one every ${NIGHT_EVERY} for ever`);
console.log(`   the beat at ${nightsLadder[nightsLadder.length - 1]} draws ${nightMarkKey(nightsLadder[nightsLadder.length - 1])}`);


const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

/** Every ambient bank, with how many distinct lines it can draw from. */
const look = () => page.evaluate(() => {
  const A = window.__ascent;
  const s = A.story.state();
  const banks = A.story.banks();
  const depth = {};
  for (const [name, key] of Object.entries(banks)) {
    const v = A.t(key);
    depth[name] = { key, lines: Array.isArray(v) ? v.length : (v && !String(v).startsWith('story.') ? 1 : 0) };
  }
  return {
    seals: s.seals, register: s.register, stage: s.stage, canTutor: s.canTutor,
    rank: s.rank, chapter: s.chapter, milestones: s.milestones, banks: depth,
  };
});

const report = async (label) => {
  const r = await look();
  const thin = Object.entries(r.banks).filter(([, b]) => b.lines <= 1).map(([n]) => n);
  console.log(`\n${label}`);
  console.log(`   seals ${r.seals}  rank ${r.rank}  chapter ${r.chapter}  register ${r.register}  stage ${r.stage}  may tutor ${r.canTutor}`);
  console.log(`   milestones heard: ${r.milestones.length ? r.milestones.join(', ') : 'none'}`);
  console.log('   bank lines: ' + Object.entries(r.banks).map(([n, b]) => `${n}:${b.lines}`).join('  '));
  if (thin.length) console.log(`   ONE LINE ONLY: ${thin.join(', ')}`);
  return r;
};

await report('0 seals — a cold cadet');
await page.evaluate(() => window.__ascent.story.seal(30));
await page.waitForTimeout(600);
await report('30 seals — past the last chapter beat');
await page.evaluate(() => window.__ascent.story.seal(100));
await page.waitForTimeout(600);
await report('130 seals — the state the complaint was measured in');
await page.evaluate(() => window.__ascent.story.seal(140));
await page.waitForTimeout(600);
await report('270 seals — past the last milestone');

// Full mastery: the real engine, the real lines, and then the real state.
await page.evaluate(async () => {
  const A = window.__ascent, m = A.mastery;
  for (let i = 0; i < 320; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const it = A.itemFor(task); if (!it) continue;
    m.observe(task.skill, true, {
      assisted: task.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: task.kind,
    });
  }
});
await page.waitForTimeout(1500);
const whole = await report('every line held');

// What he would actually say, right now, in each of the four situations that
// carry the most repetition risk — drawn the way the game draws them.
const said = await page.evaluate(() => {
  const A = window.__ascent;
  const b = A.story.banks();
  const out = {};
  for (const k of ['wrong', 'right', 'idle', 'returning', 'rift']) {
    const v = A.t(b[k]);
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
});
console.log('\nwhat he says at the top of the ladder:');
for (const [k, v] of Object.entries(said)) console.log(`   ${k.padEnd(10)} ${v}`);

console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log('   ' + e);
await browser.close();
process.exit(errors.length || whole.canTutor ? 1 : 0);
