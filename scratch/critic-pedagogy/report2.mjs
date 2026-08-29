import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4711');
const OUT = path.resolve(arg('out', 'shots/crit-ped-report2'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { if (!sessionStorage.getItem('__c')) { localStorage.clear(); sessionStorage.setItem('__c', '1'); } } catch {} });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const play = (n, acc) => page.evaluate(async ({ count, acc }) => {
  const A = window.__ascent; const m = A.mastery; const kinds = {};
  for (let i = 0; i < count; i++) {
    const o = m.next(); if (!o) break;
    const t = m.taskFor(o.id); if (!t) break;
    const it = A.itemFor(t); if (!it) continue;
    kinds[t.kind] = (kinds[t.kind] || 0) + 1;
    m.observe(t.skill, Math.random() < acc, { assisted: t.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: t.kind });
  }
  return kinds;
}, { count: n, acc });

async function rewind(days) {
  await page.evaluate((d) => {
    const ms = d * 86400000; const raw = JSON.parse(localStorage.getItem('ascent.save'));
    raw.mastery.savedAt -= ms;
    for (const v of Object.values(raw.mastery.skills)) for (const k of ['dueTime', 'provedTime', 'masteredTime', 'lastTime', 'lastDurableAt']) if (typeof v[k] === 'number') v[k] -= ms;
    localStorage.setItem('ascent.save', JSON.stringify(raw));
  }, days);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
}
await play(120, 0.85);
for (let d = 0; d < 3; d++) { await rewind(1); await play(40, 0.85); }

// the contradiction probe: what does next() say vs what the list says
const probe = await page.evaluate(() => {
  const A = window.__ascent; const m = A.mastery;
  const o = m.next();
  const sk = m.save().skills;
  return { next: o && { id: o.id, ...o }, state: Object.fromEntries(Object.entries(sk).map(([k, v]) => [k, { mastered: v.mastered, pL: Math.round(v.pL * 100), stage: v.reviewStage, durable: v.durable }])) };
});
console.log('next():', JSON.stringify(probe.next));
console.log('state:', JSON.stringify(probe.state, null, 0));

await page.evaluate(() => document.querySelector('.rp-launch, [aria-label*="rogress"]')?.click());
await page.waitForTimeout(1000);
const doc = await page.evaluate(() => {
  const r = document.querySelector('.rp-doc, .rp-panel, .rp-sheet, [class*="rp-"]');
  const root = document.querySelector('[class*="rp-wrap"], [class*="rp-panel"], [class*="rp-doc"]') || document.body;
  return { text: root.innerText.slice(0, 6000) };
});
console.log('--- REPORT TEXT ---\n' + doc.text);
// scroll the report
await page.evaluate(() => {
  const s = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 50 && e.className?.toString?.().includes('rp'));
  if (s) s.scrollTop = s.scrollHeight;
});
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'report-bottom.png') });
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /teacher|profesor|nauczyc/i.test(x.textContent || '')); b?.click(); });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, 'teacher.png') });
const tr = await page.evaluate(() => document.body.innerText.slice(0, 5000));
console.log('--- TEACHER ---\n' + tr);
console.log('errors', errors.length);
await browser.close();
