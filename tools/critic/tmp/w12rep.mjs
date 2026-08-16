import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4477');
const UNIT = arg('unit', 'algebra1-l2');
const OUT = arg('out', 'shots/w12-report');
await mkdir(OUT, { recursive: true });
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await pg.goto(`${URL}/?unit=${UNIT}`, { waitUntil: 'load' });
await pg.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await pg.waitForTimeout(2500);

// play a handful of items so the report has something to show
const nodes = await pg.evaluate(() => window.__ascent.content().nodes);
for (const id of nodes.slice(0, 6)) {
  for (let i = 0; i < 3; i++) {
    await pg.evaluate(() => document.querySelectorAll('.beat,.sn-card').forEach((e) => e.remove()));
    const ok = await pg.evaluate((s) => window.__ascent.openRiftById(s), id);
    if (!ok) break;
    await pg.waitForTimeout(400);
    await pg.evaluate(() => window.__ascent.panel.demo('right'));
    await pg.waitForTimeout(400);
    await pg.evaluate(() => window.__ascent.panel.close?.());
    await pg.waitForTimeout(150);
  }
}
await pg.evaluate(() => document.querySelectorAll('.beat,.sn-card').forEach((e) => e.remove()));
await pg.keyboard.press('KeyP');
await pg.waitForTimeout(1600);
await pg.screenshot({ path: `${OUT}/${UNIT}-report.png` });

const dump = await pg.evaluate(() => {
  const chips = [...document.querySelectorAll('.rp-chip')].map((c) => c.innerText.replace(/\n/g, ' '));
  const stdGrp = [...document.querySelectorAll('.rp-std-grp')].map((g) => g.innerText.replace(/\n/g, ' | ').slice(0, 200));
  const covRows = [...document.querySelectorAll('.rp-cov-row, .rp-cov tr, [class*=cov]')].length;
  return { chipCount: chips.length, chips: chips.slice(0, 30), stdGrp: stdGrp.slice(0, 20), covRows };
});
console.log(UNIT, 'REPORT:', JSON.stringify(dump, null, 1).slice(0, 2500));

// open the standards / coverage view
const clicked = await pg.evaluate(() => {
  const tabs = [...document.querySelectorAll('.rp-tab, .rp-nav button, button')];
  const t = tabs.find((x) => /standard|cover|norma|est|stand/i.test(x.innerText || ''));
  if (t) { t.click(); return t.innerText; }
  return null;
});
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${OUT}/${UNIT}-standards.png` });
const cov = await pg.evaluate(() => ({
  text: (document.querySelector('.rp-cov, .rp-body, .rp-panel')?.innerText || '').slice(0, 2000),
  rows: [...document.querySelectorAll('.rp-cov-row')].length,
}));
console.log('tab clicked:', clicked);
console.log('COVERAGE:', JSON.stringify(cov).slice(0, 2500));
console.log('console errors:', errs.length, errs.slice(0, 5));
await b.close();
