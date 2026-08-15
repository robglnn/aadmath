/**
 * THE DESCENT PAYS FOR DEPTH, NOT REPETITION (temporary probe).
 *
 * Plays real descents through the real engine and reports what the wallet
 * actually paid for each one, then does the same after a night.
 */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4488';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await p.waitForTimeout(2500);

const items = (n) => p.evaluate(async (count) => {
  const A = window.__ascent, m = A.mastery;
  const before = A.state().shards;
  let deep = 0;
  for (let i = 0; i < count; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const it = A.itemFor(task); if (!it) continue;
    const res = m.observe(task.skill, true, {
      assisted: task.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: task.kind,
    });
    if (res && res.served === 'deep') deep++;
  }
  return { deep, paid: A.state().shards - before, best: A.kit.sync().sounding.best };
}, n);

// Hold the whole lattice first, so everything after this is the descent.
await items(300);
console.log('descents, all in one evening — what the wallet paid');
for (let i = 1; i <= 5; i++) {
  const r = await items(14);
  console.log(`   run ${i}: ${r.deep} deep items -> ${r.paid} shards`);
}
await p.evaluate(() => window.__ascent.advanceDays(1));
const t1 = await items(14);
console.log(`   next morning: ${t1.deep} deep items -> ${t1.paid} shards`);
console.log(`errors: ${errs.length}`);
await b.close();
