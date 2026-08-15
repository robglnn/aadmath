/** Does the coda fire on a day-one cram? (temporary probe) */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4488';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await p.waitForTimeout(2500);
await p.evaluate(async () => {
  const A = window.__ascent, m = A.mastery;
  for (let i = 0; i < 320; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const it = A.itemFor(task); if (!it) continue;
    m.observe(task.skill, true, { assisted: task.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: task.kind });
  }
});
for (const wait of [1000, 4000, 9000]) {
  await p.waitForTimeout(wait);
  const s = await p.evaluate(() => ({
    ...window.__ascent.story.state(), integrity: window.__ascent.mastery.integrity(),
    lines: window.__ascent.kit.sync().lines,
  }));
  console.log(`after ${wait}ms: chapter ${s.chapter} rank ${s.rank} nights ${s.nights} integrity ${s.integrity.toFixed(2)} lines ${s.lines} standing ${s.standing}`);
}
await b.close();
