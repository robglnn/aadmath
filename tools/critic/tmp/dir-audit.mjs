/**
 * Independent critic driver: two roads to one claim + integrity desync.
 * Written by the judging critic; trusts nothing in the builder's own tools.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4877');
const OUT = path.resolve(arg('out', 'shots/dir-audit'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const out = {};

const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));
page.on('response', (r) => { if (r.status() >= 400) logs.push({ type: 'http', text: `${r.status()} ${r.url()}` }); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1800);

const shot = async (n, ms = 300) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };

// what skills exist
out.skills = await page.evaluate(() => window.__ascent.skillIds);

async function play(skill, missFirst, maxItems = 60) {
  return page.evaluate(async ({ skill, missFirst, maxItems }) => {
    const A = window.__ascent;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    let n = 0, first = true, idle = 0;
    while (n < maxItems && !A.mastery.get(skill).mastered && idle < 12) {
      if (!A.panel?.open && !A.openRiftById(skill)) break;
      await sleep(160);
      const p = A.panel;
      if (!p?.open || !p.item) { idle += 1; continue; }
      const it = p.item;
      const wrong = missFirst && first;
      const val = wrong ? (it.distractors?.[0]?.v ?? `${it.answer}9`) : it.answer;
      const clock = A.mastery.clock;
      A.enter(val);
      await sleep(240);
      if (A.mastery.clock === clock) idle += 1; else { idle = 0; n += 1; first = false; }
      const s = A.mastery.get(skill);
      log.push({ n, wrong, band: s.difficulty, check: s.check ? `${s.check.done}/${s.check.need}` : null, mastered: s.mastered });
      if (A.panel?.open) A.panel.close?.();
      await sleep(140);
    }
    const s = A.mastery.get(skill);
    return { itemsPlayed: n, mastered: s.mastered, provenBy: s.provenBy ? JSON.parse(JSON.stringify(s.provenBy)) : null, log };
  }, { skill, missFirst, maxItems });
}

const openReport = async () => {
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => { window.__ascent.panel?.close?.(); });
    await page.click('.rp-launch', { force: true }).catch(() => {});
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) return true;
  }
  return false;
};

const readCard = async (skill) => page.evaluate((id) => {
  const rows = [...document.querySelectorAll('.rp-skill')];
  const name = window.__ascent.t('skills.' + id);
  const art = rows.find((a) => a.querySelector('.rp-name')?.textContent === name);
  if (!art) return { missing: true, names: rows.map(r => r.querySelector('.rp-name')?.textContent) };
  const det = art.querySelector('.rp-detail');
  if (det && det.hidden) art.querySelector('.rp-row')?.click();
  const ev = [...art.querySelectorAll('.rp-ev-row')].map((li) => ({
    lab: li.querySelector('.rp-ev-lab')?.textContent,
    val: li.querySelector('.rp-ev-val')?.textContent,
    det: li.querySelector('.rp-ev-det')?.textContent,
    met: [...li.classList].join(' '),
  }));
  return {
    name,
    text: art.innerText.replace(/\n+/g, ' | '),
    ev,
    rect: art.getBoundingClientRect().toJSON(),
  };
}, skill);

// ---------------- ROAD A: sight-read ----------------
await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1600);
const firstSkill = out.skills[0];
out.sight = await play(firstSkill, false);
out.sightTracker = await page.evaluate((id) => ({
  itemsFor: window.__ascent.report.tracker.itemsFor(id),
  items: window.__ascent.report.tracker.items(),
  trust: window.__ascent.report.tracker.trust(),
}), firstSkill);
out.sightOpened = await openReport();
await shot('A1-report-sight');
out.sightCard = await readCard(firstSkill);
// scroll the card into view and shoot it
await page.evaluate((id) => {
  const name = window.__ascent.t('skills.' + id);
  const art = [...document.querySelectorAll('.rp-skill')].find((a) => a.querySelector('.rp-name')?.textContent === name);
  art?.scrollIntoView({ block: 'center' });
}, firstSkill);
await shot('A2-card-sight', 500);
out.sightTotals = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText.slice(0, 2500));

// ---------------- ROAD B: long road ----------------
await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1600);
out.long = await play(firstSkill, true);
out.longTracker = await page.evaluate((id) => ({
  itemsFor: window.__ascent.report.tracker.itemsFor(id),
  items: window.__ascent.report.tracker.items(),
  trust: window.__ascent.report.tracker.trust(),
}), firstSkill);
out.longOpened = await openReport();
out.longCard = await readCard(firstSkill);
await page.evaluate((id) => {
  const name = window.__ascent.t('skills.' + id);
  const art = [...document.querySelectorAll('.rp-skill')].find((a) => a.querySelector('.rp-name')?.textContent === name);
  art?.scrollIntoView({ block: 'center' });
}, firstSkill);
await shot('B1-card-long', 500);
out.longTotals = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText.slice(0, 2500));

// save the long-road save for the desync test
out.savedLS = await page.evaluate(() => ({
  save: localStorage.getItem('ascent.save'),
  report: localStorage.getItem('ascent.report'),
}));

// ---------------- DESYNC 1: report ledger wiped ----------------
await page.evaluate(() => { localStorage.removeItem('ascent.report'); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1600);
out.desyncWipe = await page.evaluate(() => ({
  trust: window.__ascent.report.tracker.trust(),
  items: window.__ascent.report.tracker.items(),
  hollow: window.__ascent.report.tracker.hollowRate(),
  granted: window.__ascent.report.tracker.granted(),
  withdrawn: window.__ascent.report.tracker.withdrawn(),
}));
await openReport();
await shot('C1-desync-wiped');
out.desyncWipeText = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText.slice(0, 2500));

// ---------------- DESYNC 2: foreign ledger (different recordId, flattering numbers) ----------------
await page.evaluate((saved) => {
  localStorage.setItem('ascent.save', saved.save);
  const rep = JSON.parse(saved.report);
  rep.recordId = 'someone-else-entirely';
  rep.items = 999; rep.unassisted = 999; rep.unassistedRight = 999;
  rep.granted = 40; rep.withdrawn = 0;
  localStorage.setItem('ascent.report', JSON.stringify(rep));
}, out.savedLS);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1600);
out.desyncForeign = await page.evaluate(() => ({
  trust: window.__ascent.report.tracker.trust(),
  items: window.__ascent.report.tracker.items(),
  hollow: window.__ascent.report.tracker.hollowRate(),
  granted: window.__ascent.report.tracker.granted(),
  withdrawn: window.__ascent.report.tracker.withdrawn(),
}));
await openReport();
await shot('C2-desync-foreign');
out.desyncForeignText = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText.slice(0, 2500));

// ---------------- DESYNC 3: inflated but same recordId (stale-behind ledger) ----------------
await page.evaluate((saved) => {
  localStorage.setItem('ascent.save', saved.save);
  const rep = JSON.parse(saved.report);
  rep.items = 500; rep.unassisted = 500; rep.unassistedRight = 500; rep.seq = 500;
  rep.granted = 30; rep.withdrawn = 0;
  localStorage.setItem('ascent.report', JSON.stringify(rep));
}, out.savedLS);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1600);
out.desyncInflated = await page.evaluate(() => ({
  trust: window.__ascent.report.tracker.trust(),
  items: window.__ascent.report.tracker.items(),
  hollow: window.__ascent.report.tracker.hollowRate(),
  granted: window.__ascent.report.tracker.granted(),
  withdrawn: window.__ascent.report.tracker.withdrawn(),
}));
await openReport();
await shot('C3-desync-inflated');
out.desyncInflatedText = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText.slice(0, 2500));

out.logs = logs.filter((l) => l.type === 'error' || l.type === 'pageerror' || l.type === 'http');
await writeFile(path.join(OUT, 'audit.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  sight: { items: out.sight.itemsPlayed, mastered: out.sight.mastered, pv: out.sight.provenBy },
  long: { items: out.long.itemsPlayed, mastered: out.long.mastered, pv: out.long.provenBy },
  errs: out.logs,
}, null, 2));
await ctx.close();
await browser.close();
