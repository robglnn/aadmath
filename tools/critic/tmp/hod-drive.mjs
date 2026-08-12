/**
 * Department-head drive: play the REAL game to a partially-mastered state,
 * then open the REAL progress view and photograph it in both frameworks
 * and all three locales.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/teacher'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
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

// ---- Play the real learning surface -------------------------------------
// Strategy: fully master the first two skills (all correct), grind a third
// with a deliberate error pattern (partial), and never touch the rest.
const played = await page.evaluate(async () => {
  const A = window.__ascent;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  let guard = 0;

  while (guard++ < 400) {
    const nx = A.nextObjective();
    if (!nx) break;
    const skill = nx.id || nx.skill;
    // stop once we have 3 skills touched and 2 held
    const st = A.state().skills || {};
    const touched = Object.keys(st).filter((k) => (st[k].reps || st[k].attempts || 0) > 0);
    const held = Object.values(st).filter((s) => s.mastered).length;
    if (held >= 2 && touched.length >= 3 && guard > 40) break;

    const ok = A.openRiftById(skill);
    if (!ok) break;
    await sleep(120);
    // answer the item on the surface
    const item = A.panel?.item;
    if (!item) { A.panel?.hide?.(); break; }
    // third skill onward: miss ~40% deliberately
    const deliberateMiss = touched.length >= 2 && Math.random() < 0.4;
    const val = deliberateMiss ? 'zzz' : item.answer;
    const r = A.enter(val);
    log.push({ skill, entry: String(val), answer: String(item.answer), form: item.form, miss: deliberateMiss, misconception: r?.misconception || null });
    await sleep(90);
  }
  return { log: log.slice(-25), n: log.length, guard };
});
console.log('played items:', played.n, 'loops', played.guard);

const st1 = await page.evaluate(() => {
  const s = window.__ascent.state().skills;
  return Object.entries(s).map(([k, v]) => ({ k, mastered: !!v.mastered, pL: +(v.pL || 0).toFixed(2), reps: v.reps || 0, forms: Object.keys(v.formsSeen || {}).length }));
});
console.log('SKILL STATE:', JSON.stringify(st1, null, 1));

// close any open panel, then open the report with the real P key
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.keyboard.press('KeyP');
await page.waitForTimeout(1200);
await shot('01-report-open');

// dump the report data the teacher sees
const data = await page.evaluate(() => {
  const A = window.__ascent;
  return { snap: A.report.snapshot ? A.report.snapshot() : null, cov: A.report.coverage() };
});
await writeFile(path.join(OUT, 'report-data.json'), JSON.stringify(data, null, 1));

// framework switch: find the control in the real DOM
const switcher = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#ui button, #ui [role=button], #ui select, #ui [role=tab]').forEach((b) => {
    const txt = (b.innerText || b.textContent || '').trim().slice(0, 40);
    const r = b.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push({ txt, cls: b.className, x: Math.round(r.x), y: Math.round(r.y) });
  });
  return out;
});
await writeFile(path.join(OUT, 'controls.json'), JSON.stringify(switcher, null, 1));
console.log('CONTROLS:', JSON.stringify(switcher.slice(0, 40)));

await browser.close();
console.log('errors:', errors.length, errors.slice(0, 5));
