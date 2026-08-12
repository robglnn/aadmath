import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/teacher'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log('shot', n); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);

// ---- Play deep: master ~4, leave a partial trail on the next, never touch the rest
const played = await page.evaluate(async () => {
  const A = window.__ascent;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let n = 0, guard = 0;
  const touchedOrder = [];
  while (guard++ < 600) {
    const nx = A.nextObjective(); if (!nx) break;
    const skill = nx.id || nx.skill;
    if (!touchedOrder.includes(skill)) touchedOrder.push(skill);
    const st = A.state().skills || {};
    const held = Object.values(st).filter((s) => s.mastered).length;
    // stop when 4 held AND we've left a partial trail on a 5th
    if (held >= 4 && touchedOrder.length >= 5 && (st[touchedOrder[touchedOrder.length - 1]]?.pL || 0) > 0.3) break;
    if (!A.openRiftById(skill)) break;
    await sleep(110);
    const item = A.panel?.item; if (!item) break;
    // deliberate error pattern on the 5th skill onward
    const miss = touchedOrder.length >= 5 && Math.random() < 0.45;
    A.enter(miss ? '999' : item.answer);
    n++;
    await sleep(80);
  }
  return { n, guard, touchedOrder };
});
console.log('items played:', played.n, 'order:', played.touchedOrder.join(','));

// let ceremonies settle, close everything
await page.keyboard.press('Escape'); await page.waitForTimeout(900);
await page.keyboard.press('Escape'); await page.waitForTimeout(2500);

const st = await page.evaluate(() => Object.entries(window.__ascent.state().skills).map(([k, v]) => ({ k, m: !!v.mastered, pL: +(v.pL || 0).toFixed(2), forms: Object.keys(v.formsSeen || {}).length })));
console.log('STATE:', JSON.stringify(st));

// Open the report by CLICKING the real PROGRESS button
await page.click('.rp-launch', { timeout: 5000 }).catch(async () => { await page.keyboard.press('KeyP'); });
await page.waitForTimeout(1500);
await shot('10-progress-ccss-top');

// scroll the report body to catch the standards section
const scrollBox = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300);
  return cands.map((e) => ({ cls: e.className, sh: e.scrollHeight, ch: e.clientHeight })).slice(0, 6);
});
console.log('SCROLLERS:', JSON.stringify(scrollBox));

const scrollTo = async (frac) => {
  await page.evaluate((f) => {
    const cands = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300);
    const e = cands[0]; if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * f;
  }, frac);
  await page.waitForTimeout(600);
};
await scrollTo(0.33); await shot('11-progress-ccss-mid');
await scrollTo(0.66); await shot('12-progress-ccss-low');
await scrollTo(1); await shot('13-progress-ccss-end');

// switch to TEKS via the real control
await scrollTo(0);
await page.click('.rp-frame-b:not(.on)', { timeout: 5000 });
await page.waitForTimeout(900);
await shot('20-progress-teks-top');
await scrollTo(0.33); await shot('21-progress-teks-mid');
await scrollTo(0.66); await shot('22-progress-teks-low');
await scrollTo(1); await shot('23-progress-teks-end');

// the teacher / record view
await scrollTo(0);
await page.click('.rp-teacher', { timeout: 5000 }).catch(() => console.log('no rp-teacher'));
await page.waitForTimeout(1200);
await shot('30-teacher-teks');
const tScroll = async (f) => { await page.evaluate((fr) => { const c = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300); const e = c[0]; if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * fr; }, f); await page.waitForTimeout(600); };
await tScroll(0.35); await shot('31-teacher-teks-mid');
await tScroll(0.7); await shot('32-teacher-teks-low');
await tScroll(1); await shot('33-teacher-teks-end');

// what export controls exist in the teacher view?
const tctl = await page.evaluate(() => [...document.querySelectorAll('#ui button, #ui a')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => ({ txt: (b.innerText || '').trim().slice(0, 60), cls: b.className, tag: b.tagName })));
await writeFile(path.join(OUT, 'teacher-controls.json'), JSON.stringify(tctl, null, 1));
console.log('TEACHER CONTROLS:', JSON.stringify(tctl.filter((c) => /csv|json|print|export|record|down/i.test(c.txt + c.cls))));

// try an export: intercept downloads
const dls = [];
page.on('download', async (d) => { const p = path.join(OUT, d.suggestedFilename()); await d.saveAs(p); dls.push(d.suggestedFilename()); });

for (const sel of ['.rp-dl-csv', '.rp-dl-json', '.rp-print', '[class*=csv]', '[class*=json]', '[class*=print]']) {
  const has = await page.$(sel);
  if (has) { await has.click().catch(() => {}); await page.waitForTimeout(1200); console.log('clicked', sel); }
}
await page.waitForTimeout(2000);
console.log('DOWNLOADS:', dls);

// record data
const rec = await page.evaluate(() => { try { return window.__ascent.report.record({ name: 'Test Student', id: 'S-001' }); } catch (e) { return { err: String(e) }; } });
await writeFile(path.join(OUT, 'record.json'), JSON.stringify(rec, null, 1));

// ES and PL on the standards view
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(1200);
  await tScroll(0); await shot(`40-teacher-${loc}-top`);
  await tScroll(0.4); await shot(`41-teacher-${loc}-mid`);
  await tScroll(0.8); await shot(`42-teacher-${loc}-low`);
}

await browser.close();
console.log('ERRORS:', errors.length, errors.slice(0, 6));
