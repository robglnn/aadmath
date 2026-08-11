import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4877');
const OUT = path.resolve(arg('out', 'shots/dir-integrity'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));
const out = {};
const boot = async () => {
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
};
const openReport = async () => {
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => { window.__ascent.panel?.close?.(); });
    await page.click('.rp-launch', { force: true }).catch(() => {});
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) return true;
  }
  return false;
};
const recordShot = async (name) => {
  await openReport();
  await page.evaluate(() => document.querySelector('.rp-trustbar, .rp-rec, .rp-record, .rp-h-record')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
};
const stats = () => page.evaluate(() => {
  const T = window.__ascent.report.tracker;
  return { trust: T.trust(), items: T.items(), hollow: T.hollowRate(), granted: T.granted(), withdrawn: T.withdrawn(), acc: T.accuracy(), totalMs: T.totalMs() };
});

await page.goto(URL, { waitUntil: 'load' }); await boot();
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' }); await boot();

// Master a skill the long road
const skill = await page.evaluate(() => window.__ascent.skillIds[0]);
await page.evaluate(async (skill) => {
  const A = window.__ascent; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let n = 0, first = true, idle = 0;
  while (n < 60 && !A.mastery.get(skill).mastered && idle < 12) {
    if (!A.panel?.open && !A.openRiftById(skill)) break;
    await sleep(150);
    const p = A.panel; if (!p?.open || !p.item) { idle++; continue; }
    const it = p.item; const val = (first ? (it.distractors?.[0]?.v ?? `${it.answer}9`) : it.answer);
    const c = A.mastery.clock; A.enter(val); await sleep(220);
    if (A.mastery.clock === c) idle++; else { idle = 0; n++; first = false; }
    A.panel?.close?.(); await sleep(120);
  }
}, skill);
out.baseline = await stats();
const saved = await page.evaluate(() => ({ save: localStorage.getItem('ascent.save'), report: localStorage.getItem('ascent.report') }));

// ---- CASE A: model shows a WITHDRAWN claim, ledger wiped. Does hollow rate rise?
await page.evaluate(({ saved, skill }) => {
  const s = JSON.parse(saved.save);
  const row = s.mastery.skills[skill] || s.mastery.skills[0];
  const target = s.mastery.skills[skill] ? skill : null;
  // find the record for the skill regardless of shape
  const bag = s.mastery.skills;
  const k = Array.isArray(bag) ? bag.findIndex((x) => x.id === skill) : skill;
  const rec = Array.isArray(bag) ? bag[k] : bag[k];
  rec.mastered = false; rec.everMastered = true;
  localStorage.setItem('ascent.save', JSON.stringify(s));
  localStorage.removeItem('ascent.report');
  return { target, shape: Array.isArray(bag) ? 'array' : 'object', rec };
}, { saved, skill });
await page.reload({ waitUntil: 'load' }); await boot();
out.caseA_withdrawnWipedLedger = await stats();
await recordShot('A-withdrawn-ledger-wiped');
out.caseAText = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText || '');

// ---- CASE B: ascent.save wiped, ledger kept (reverse desync)
await page.evaluate((saved) => { localStorage.setItem('ascent.report', saved.report); localStorage.removeItem('ascent.save'); }, saved);
await page.reload({ waitUntil: 'load' }); await boot();
out.caseB_saveWipedLedgerKept = await stats();
await recordShot('B-save-wiped');
out.caseBText = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText || '');

// ---- CASE C: ledger corrupted to unparseable
await page.evaluate((saved) => { localStorage.setItem('ascent.save', saved.save); localStorage.setItem('ascent.report', '{not json'); }, saved);
await page.reload({ waitUntil: 'load' }); await boot();
out.caseC_corrupt = await stats();
out.caseCText = await page.evaluate(() => document.querySelector('.rp-scrim')?.innerText || '');

out.logs = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'integrity.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ baseline: out.baseline, A: out.caseA_withdrawnWipedLedger, B: out.caseB_saveWipedLedgerKept, C: out.caseC_corrupt, logs: out.logs }, null, 2));
await browser.close();
