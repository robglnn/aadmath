import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4477');
const UNIT = arg('unit', 'algebra1-l2');
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await pg.goto(`${URL}/?unit=${UNIT}`, { waitUntil: 'load' });
await pg.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await pg.waitForTimeout(2000);

// Play the scheduler's OWN choice, item after item, as a knower would.
const log = [];
for (let i = 0; i < 90; i++) {
  await pg.evaluate(() => document.querySelectorAll('.beat,.sn-card').forEach((e) => e.remove()));
  const step = await pg.evaluate(() => {
    const a = window.__ascent;
    const next = a.mastery.next ? a.mastery.next() : null;
    return next ? { id: next.skill || next.id || null } : null;
  }).catch(() => null);
  const id = step?.id;
  if (!id) break;
  const before = await pg.evaluate((s) => !!window.__ascent.mastery.get(s)?.mastered, id);
  const opened = await pg.evaluate((s) => window.__ascent.openRiftById(s), id);
  if (!opened) break;
  await pg.waitForTimeout(220);
  const why = await pg.evaluate(() => {
    const p = window.__ascent.panel;
    return { reason: p.item?.reason || p.item?.why || null, kind: p.item?.kind || null, mode: p.mode };
  });
  await pg.evaluate(() => window.__ascent.panel.demo('right'));
  await pg.waitForTimeout(220);
  await pg.evaluate(() => window.__ascent.panel.close?.());
  log.push({ i, id, alreadyMastered: before, ...why });
}
const served = log.filter((r) => r.alreadyMastered);
console.log(`items played ${log.length}; served on an ALREADY-MASTERED skill: ${served.length}`);
const byReason = {};
for (const r of served) byReason[r.reason || 'NO-REASON'] = (byReason[r.reason || 'NO-REASON'] || 0) + 1;
console.log('reasons given:', JSON.stringify(byReason));
console.log('sample:', JSON.stringify(served.slice(0, 8)));

// spacing: is it elapsed days, or attempts?
const w0 = await pg.evaluate(() => window.__ascent.watch());
console.log('watch before:', JSON.stringify(w0).slice(0, 400));
const after = await pg.evaluate(() => window.__ascent.advanceDays(3));
console.log('after +3 days:', JSON.stringify(after).slice(0, 500));
console.log('console errors:', errs.length, errs.slice(0, 5));
await b.close();
