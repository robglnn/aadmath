import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL = 'http://127.0.0.1:5173';
const OUT = path.resolve('shots/teacher');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; const dls = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('download', async (d) => { const p = path.join(OUT, 'dl-' + d.suggestedFilename()); await d.saveAs(p); dls.push(d.suggestedFilename()); });
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log('shot', n); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);
await page.evaluate(async () => {
  const A = window.__ascent; const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const order = []; let g = 0;
  while (g++ < 600) {
    const nx = A.nextObjective(); if (!nx) break;
    const id = nx.id || nx.skill; if (!order.includes(id)) order.push(id);
    const st = A.state().skills || {};
    if (Object.values(st).filter((x) => x.mastered).length >= 4 && order.length >= 6) break;
    if (!A.openRiftById(id)) break;
    await s(100); const it = A.panel?.item; if (!it) break;
    A.enter(order.length >= 6 && Math.random() < 0.45 ? '999' : it.answer); await s(75);
  }
});
await page.keyboard.press('Escape'); await page.waitForTimeout(900);
await page.keyboard.press('Escape'); await page.waitForTimeout(2500);
await page.click('.rp-launch'); await page.waitForTimeout(1500);

const sc = async (f) => { await page.evaluate((x) => { const e = document.querySelector('.rp-body'); if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * x; }, f); await page.waitForTimeout(600); };

// --- expand three CCSS standard rows: one HELD, one PART, one untouched
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.rp-crow')];
  [0, 7, rows.length - 2].forEach((i) => rows[i]?.click());
});
await page.waitForTimeout(900);
await sc(0.42); await shot('A1-ccss-expanded-1');
await sc(0.55); await shot('A2-ccss-expanded-2');
await sc(0.72); await shot('A3-ccss-expanded-3');
await sc(0.95); await shot('A4-ccss-expanded-4');

// --- same in TEKS
await sc(0.4); await page.click('.rp-frame-b:not(.on)'); await page.waitForTimeout(900);
await page.evaluate(() => { const r = [...document.querySelectorAll('.rp-crow')]; [0, 6].forEach((i) => r[i]?.click()); });
await page.waitForTimeout(800);
await sc(0.45); await shot('B1-teks-expanded-1');
await sc(0.6); await shot('B2-teks-expanded-2');
await sc(0.78); await shot('B3-teks-expanded-3');

// --- teacher record: STANDARDS tab + exports
await page.click('.rp-teacher'); await page.waitForTimeout(1400);
const tabs = await page.evaluate(() => [...document.querySelectorAll('.rp-doc [role=tab], .rp-tab, [class*=tab]')].map((b) => ({ t: (b.innerText || '').trim(), c: b.className })));
console.log('TABS:', JSON.stringify(tabs.slice(0, 8)));
// click STANDARDS tab by text
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /STANDARDS/i.test(x.innerText || '')); b?.click(); });
await page.waitForTimeout(1200); await shot('C1-teacher-standards-tab');
const dsc = async (f) => { await page.evaluate((x) => { const e = document.querySelector('.rp-doc-body'); if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * x; }, f); await page.waitForTimeout(600); };
for (const [i, f] of [0.25, 0.5, 0.75, 1].entries()) { await dsc(f); await shot(`C2-teacher-std-${i}`); }

// --- EXPORTS, clicked by visible text
for (const label of ['EXPORT RECORD', 'EXPORT TABLE']) {
  await page.evaluate((l) => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').toUpperCase().includes(l)); b?.click(); }, label);
  await page.waitForTimeout(2500);
}
console.log('DOWNLOADS:', dls);

// --- print rendering
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(800);
await shot('D1-print-media');
await page.pdf({ path: path.join(OUT, 'record.pdf'), format: 'Letter', printBackground: true }).catch((e) => console.log('pdf err', e.message));
await page.emulateMedia({ media: 'screen' });

// --- ES / PL on the teacher record and the standards view
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc); await page.waitForTimeout(1300);
  await dsc(0); await shot(`E-${loc}-teacher-top`);
  await dsc(0.5); await shot(`E-${loc}-teacher-mid`);
}
await browser.close();
console.log('ERRORS:', errors.length, errors.slice(0, 5));
