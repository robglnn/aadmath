/**
 * Independent audit of the spaced-retrieval schedule against the running game.
 */
import { chromium } from 'playwright';

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4711';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('__critic_cleared')) {
      localStorage.clear();
      sessionStorage.setItem('__critic_cleared', '1');
    }
  } catch {}
});
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const play = (n) => page.evaluate(async (count) => {
  const A = window.__ascent; const m = A.mastery;
  const kinds = {}; let served = 0;
  for (let i = 0; i < count; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const item = A.itemFor(task); if (!item) continue;
    kinds[task.kind] = (kinds[task.kind] || 0) + 1; served++;
    m.observe(task.skill, true, {
      assisted: task.scaffold !== 'none', form: item.form, rep: item.rep,
      scene: item.scene, kind: task.kind,
    });
  }
  return { served, kinds };
}, n);

const snap = () => page.evaluate(() => {
  const A = window.__ascent; const m = A.mastery;
  const sk = m.save().skills;
  const rows = Object.entries(sk).filter(([, v]) => v.mastered).map(([k, v]) => ({
    id: k, durable: v.durable || 0, stage: v.reviewStage || 0,
    dueInMin: v.dueTime == null ? null : Math.round((v.dueTime - m.now()) / 60000),
    provedAgoMin: v.provedTime == null ? null : Math.round((m.now() - v.provedTime) / 60000),
  }));
  return {
    watch: m.watch(), durableCount: m.durableCount?.() ?? null,
    temper: A.kit.sync().temper, held: rows.length, rows,
    clockAttempts: m.clock,
  };
});

console.log('=== PHASE 1: one unbroken sitting, 400 items, clock frozen ===');
const cram = await play(400);
let s = await snap();
console.log('served', cram.served, 'kinds', JSON.stringify(cram.kinds));
console.log('held', s.held, 'durableCount', s.durableCount, 'temper', s.temper);
console.log('watch', JSON.stringify(s.watch));

console.log('\n=== PHASE 2: same sitting, wall clock crawls forward in 10-min steps (2 hours) ===');
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.__ascent.advanceDays(10 / 1440));
  const r = await play(25);
  const st = await snap();
  console.log(`  +${(i + 1) * 10}min  reviews=${r.kinds.review || 0} durable=${st.durableCount} temper=${st.temper} stages=${st.rows.map(x => x.stage).join('')}`);
}
s = await snap();
console.log('after 2 hours at the machine: durable =', s.durableCount, '(must be 0)');

console.log('\n=== PHASE 3: keep going to 6 hours in one sitting ===');
for (let i = 0; i < 24; i++) {
  await page.evaluate(() => window.__ascent.advanceDays(10 / 1440));
  await play(25);
}
s = await snap();
console.log('after ~6 hours continuously at the machine: durable =', s.durableCount, 'temper =', s.temper);

console.log('\n=== PHASE 4: persistence across a page reload ===');
const before = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('ascent.save') || 'null');
  const sk = raw?.mastery?.skills || {};
  return {
    savedAt: raw?.mastery?.savedAt,
    n: Object.keys(sk).length,
    withDueTime: Object.values(sk).filter((v) => v.dueTime != null).length,
    withProvedTime: Object.values(sk).filter((v) => v.provedTime != null).length,
    withDueAt: Object.values(sk).filter((v) => v.dueAt != null).length,
    sample: Object.entries(sk).filter(([, v]) => v.mastered)[0],
  };
});
console.log('save on disk: skills=', before.n, 'dueTime set=', before.withDueTime,
  'provedTime set=', before.withProvedTime, 'dueAt set=', before.withDueAt, 'savedAt=', !!before.savedAt);

// rewind every timestamp in the save by N days: the honest simulation of
// "closed the tab, came back tomorrow" with the machine's real clock.
async function rewindDays(days) {
  await page.evaluate((d) => {
    const ms = d * 86400000;
    const raw = JSON.parse(localStorage.getItem('ascent.save'));
    const m = raw.mastery;
    m.savedAt -= ms;
    for (const v of Object.values(m.skills)) {
      for (const k of ['dueTime', 'provedTime', 'masteredTime', 'lastTime', 'lastDurableAt']) {
        if (typeof v[k] === 'number') v[k] -= ms;
      }
    }
    localStorage.setItem('ascent.save', JSON.stringify(raw));
  }, days);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
}

await rewindDays(1);
let after = await snap();
console.log('after reload with the save rewound one day:');
console.log('  held', after.held, 'durable', after.durableCount, 'temper', after.temper);
console.log('  watch', JSON.stringify(after.watch));
console.log('  rows', JSON.stringify(after.rows.slice(0, 4)));

console.log('\n=== PHASE 5: five returning sittings, one night apart, 30 items each ===');
for (let d = 1; d <= 5; d++) {
  const r = await play(30);
  const st = await snap();
  console.log(`  day ${d}: reviews=${r.kinds.review || 0} durable=${st.durableCount} temper=${st.temper} stages=${st.rows.map(x => x.stage).join('')}`);
  if (d < 5) await rewindDays(1);
}

console.log('\n=== PHASE 6: hostile — can a cram farm the review ladder? ===');
const farm = await page.evaluate(async () => {
  const A = window.__ascent; const m = A.mastery;
  const start = m.durableCount?.() ?? 0;
  let reviews = 0;
  for (let i = 0; i < 600; i++) {
    const o = m.next(); if (!o) break;
    const t = m.taskFor(o.id); if (!t) break;
    const item = A.itemFor(t); if (!item) continue;
    if (t.kind === 'review') reviews++;
    m.observe(t.skill, true, { assisted: false, form: item.form, rep: item.rep, scene: item.scene, kind: t.kind });
  }
  return { start, end: m.durableCount?.() ?? 0, reviews };
});
console.log('600 more items, no clock movement:', JSON.stringify(farm));

console.log('\nconsole errors:', errors.length, errors.slice(0, 5));
await browser.close();
