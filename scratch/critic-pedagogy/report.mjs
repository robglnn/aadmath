/**
 * Does the progress report tell a teacher the truth about a returning learner?
 * Plays the real loop, rewinds the save a night, plays the reviews, then opens
 * the real report and photographs it in three locales and on a phone.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4711');
const OUT = path.resolve(arg('out', 'shots/crit-ped-report'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('__c')) { localStorage.clear(); sessionStorage.setItem('__c', '1'); }
  } catch {}
});
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

// realistic sitting: mostly right, some wrong
const play = (n, acc = 0.85) => page.evaluate(async ({ count, acc }) => {
  const A = window.__ascent; const m = A.mastery; const kinds = {};
  for (let i = 0; i < count; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const item = A.itemFor(task); if (!item) continue;
    kinds[task.kind] = (kinds[task.kind] || 0) + 1;
    m.observe(task.skill, Math.random() < acc, {
      assisted: task.scaffold !== 'none', form: item.form, rep: item.rep,
      scene: item.scene, kind: task.kind,
    });
  }
  return kinds;
}, { count: n, acc });

async function rewindDays(days) {
  await page.evaluate((d) => {
    const ms = d * 86400000;
    const raw = JSON.parse(localStorage.getItem('ascent.save'));
    raw.mastery.savedAt -= ms;
    for (const v of Object.values(raw.mastery.skills)) {
      for (const k of ['dueTime', 'provedTime', 'masteredTime', 'lastTime', 'lastDurableAt']) {
        if (typeof v[k] === 'number') v[k] -= ms;
      }
    }
    localStorage.setItem('ascent.save', JSON.stringify(raw));
  }, days);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
}

console.log('sitting 1', JSON.stringify(await play(120)));
for (let d = 1; d <= 3; d++) {
  await rewindDays(1);
  console.log(`day ${d + 1}`, JSON.stringify(await play(40)));
}
console.log('watch', JSON.stringify(await page.evaluate(() => window.__ascent.watch())));

async function openReport() {
  const ok = await page.evaluate(() => {
    const A = window.__ascent;
    if (A.report?.open) { A.report.open(); return 'api'; }
    const b = document.querySelector('.rp-launch, [aria-label*="rogress"], .hud-progress');
    if (b) { b.click(); return 'click'; }
    return null;
  });
  await page.waitForTimeout(900);
  return ok;
}
console.log('open report ->', await openReport());
await page.screenshot({ path: path.join(OUT, 'report-en.png') });

// expand a skill's evidence
await page.evaluate(() => {
  const d = document.querySelectorAll('.rp-skill, details, [data-skill]');
  for (let i = 0; i < Math.min(3, d.length); i++) d[i].click?.();
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'report-en-open.png') });

for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `report-${loc}.png`) });
}
await page.evaluate(() => window.__ascent.setLocale('en'));

// teacher view if there is one
const teacher = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return btns;
});
console.log('buttons in report:', JSON.stringify(teacher.slice(0, 30)));

// phone
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'report-390.png'), fullPage: false });
await page.setViewportSize({ width: 414, height: 896 });
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'report-414.png') });

// text overflow audit at each viewport
for (const [w, h] of [[1280, 720], [1600, 900], [414, 896], [390, 844]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(800);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !el.textContent?.trim()) continue;
      if (el.children.length) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const clipped = el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll';
      const vclip = el.scrollHeight > el.clientHeight + 2 && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll';
      const off = r.right > innerWidth + 1 || r.left < -1;
      if (clipped || vclip || off) {
        out.push({ cls: el.className?.toString?.().slice(0, 40), t: el.textContent.trim().slice(0, 40), clipped, vclip, off, sw: el.scrollWidth, cw: el.clientWidth });
      }
    }
    return { out: out.slice(0, 12), bodyScroll: document.body.scrollWidth > innerWidth + 1 };
  });
  console.log(`overflow @${w}x${h}:`, JSON.stringify(bad));
}

console.log('errors', errors.length, errors.slice(0, 5));
await browser.close();
