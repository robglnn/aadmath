import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4877');
const OUT = path.resolve(arg('out', 'shots/dir-teacher'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1500);
// master 4 skills through the engine, one of them the long way
await page.evaluate(() => {
  const A = window.__ascent;
  for (const id of A.skillIds.slice(0, 4)) {
    let n = 0;
    if (id === A.skillIds[1]) { const t0 = A.task(id); const i0 = A.itemFor(t0); A.mastery.observe(id, false, { difficulty: t0.difficulty, form: i0?.form, rep: i0?.rep, assisted: false, kind: t0.kind }); }
    while (n++ < 30 && !A.mastery.get(id).mastered) {
      const t = A.task(id); const it = A.itemFor(t);
      A.mastery.observe(id, true, { difficulty: t.difficulty, form: it?.form, rep: it?.rep, assisted: false, kind: t.kind });
    }
  }
});
for (let i = 0; i < 30; i++) {
  await page.evaluate(() => window.__ascent.panel?.close?.());
  await page.click('.rp-launch', { force: true }).catch(() => {});
  await page.waitForTimeout(350);
  if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
}
await page.click('.rp-teacher', { force: true }).catch(() => {});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'teacher-1.png') });
const txt = await page.evaluate(() => document.body.innerText.slice(0, 4000));
// scroll down inside the teacher sheet
await page.evaluate(() => { const el = document.querySelector('.tr-body, .tr-sheet, .tr-scroll, .rp-scroll'); if (el) el.scrollTop = el.scrollHeight; else window.scrollTo(0, 99999); });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'teacher-2.png') });
await writeFile(path.join(OUT, 'teacher.json'), JSON.stringify({ txt, logs: logs.filter((l) => l.type === 'error' || l.type === 'pageerror') }, null, 2));
console.log(txt.slice(0, 3000));
console.log('ERRORS', JSON.stringify(logs.filter((l) => l.type === 'error' || l.type === 'pageerror')));
await browser.close();
