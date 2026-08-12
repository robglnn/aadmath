import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/teacher'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const dls = [];
page.on('download', async (d) => { try { const p = path.join(OUT, 'dl-' + d.suggestedFilename()); await d.saveAs(p); dls.push(d.suggestedFilename()); } catch (e) { dls.push('ERR ' + e.message); } });
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log('shot', n); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);

await page.evaluate(async () => {
  const A = window.__ascent; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const order = []; let g = 0;
  while (g++ < 600) {
    const nx = A.nextObjective(); if (!nx) break;
    const s = nx.id || nx.skill; if (!order.includes(s)) order.push(s);
    const st = A.state().skills || {};
    const held = Object.values(st).filter((x) => x.mastered).length;
    if (held >= 4 && order.length >= 6) break;
    if (!A.openRiftById(s)) break;
    await sleep(100);
    const it = A.panel?.item; if (!it) break;
    A.enter(order.length >= 6 && Math.random() < 0.45 ? '999' : it.answer);
    await sleep(75);
  }
});
await page.keyboard.press('Escape'); await page.waitForTimeout(900);
await page.keyboard.press('Escape'); await page.waitForTimeout(2500);
console.log('STATE:', JSON.stringify(await page.evaluate(() => Object.entries(window.__ascent.state().skills).map(([k, v]) => `${k}:${v.mastered ? 'HELD' : ''}${(v.pL || 0).toFixed(2)}/f${Object.keys(v.formsSeen || {}).length}`))));

await page.click('.rp-launch'); await page.waitForTimeout(1500);

const sc = async (f) => { await page.evaluate((fr) => { const e = document.querySelector('.rp-body'); if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * fr; }, f); await page.waitForTimeout(700); };

// expand a HELD skill row and an IN PROGRESS row to see claim depth per skill
await page.evaluate(() => { const rows = [...document.querySelectorAll('.rp-row')]; if (rows[0]) rows[0].click(); });
await page.waitForTimeout(800); await shot('50-skill-expanded-ccss');

// standards coverage, CCSS
for (const [i, f] of [0.45, 0.6, 0.75, 0.9, 1].entries()) { await sc(f); await shot(`60-ccss-std-${i}`); }

// switch to TEKS
await sc(0.4);
await page.click('.rp-frame-b:not(.on)'); await page.waitForTimeout(1000);
for (const [i, f] of [0.45, 0.6, 0.75, 0.9, 1].entries()) { await sc(f); await shot(`70-teks-std-${i}`); }
await sc(0); await shot('71-teks-top');
await page.evaluate(() => { const rows = [...document.querySelectorAll('.rp-row')]; if (rows[0]) rows[0].click(); });
await page.waitForTimeout(700); await shot('72-teks-skill-expanded');

// TEACHER RECORD
await page.click('.rp-teacher'); await page.waitForTimeout(1500); await shot('80-teacher-top');
const tsel = await page.evaluate(() => { const c = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300 && /tc-|rp-/.test(e.className)); return c.map((e) => e.className); });
console.log('TEACHER SCROLLERS:', JSON.stringify(tsel));
const tsc = async (f) => { await page.evaluate((fr) => { const c = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300); const e = c[c.length - 1]; if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * fr; }, f); await page.waitForTimeout(700); };
for (const [i, f] of [0.2, 0.4, 0.6, 0.8, 1].entries()) { await tsc(f); await shot(`81-teacher-${i}`); }

const btns = await page.evaluate(() => [...document.querySelectorAll('button,a')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => ({ t: (b.innerText || '').trim().slice(0, 40), c: b.className })));
await writeFile(path.join(OUT, 'btns.json'), JSON.stringify(btns, null, 1));
console.log('BUTTONS:', JSON.stringify(btns.filter((b) => /csv|json|print|export|down|sheet|copy/i.test(b.t + b.c))));

// click every plausible export control
for (const b of btns.filter((x) => /csv|json|print|export|sheet/i.test(x.t + x.c))) {
  const el = await page.$(`.${b.c.trim().split(/\s+/).join('.')}`);
  if (el) { await el.click().catch(() => {}); await page.waitForTimeout(1500); console.log('clicked', b.t || b.c); await shot('85-after-' + (b.t || b.c).replace(/\W+/g, '-').slice(0, 20)); }
}
await page.waitForTimeout(2500);
console.log('DOWNLOADS:', dls);
await writeFile(path.join(OUT, 'record.json'), JSON.stringify(await page.evaluate(() => window.__ascent.report.record({ name: 'A Student', id: 'S-001' })), null, 1));

// ES / PL
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc); await page.waitForTimeout(1300);
  await tsc(0); await shot(`90-${loc}-teacher-top`);
  await tsc(0.45); await shot(`91-${loc}-teacher-mid`);
  await tsc(0.85); await shot(`92-${loc}-teacher-low`);
}
// back to report view in ES/PL for the standards rows
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc); await page.waitForTimeout(800);
  await page.click('.tc-x, .rp-teacher, [class*=close]').catch(() => {});
  await page.waitForTimeout(900);
  await sc(0.5); await shot(`95-${loc}-report-std`);
  await sc(0); await shot(`96-${loc}-report-top`);
}

await browser.close();
console.log('ERRORS:', errors.length, errors.slice(0, 6));
