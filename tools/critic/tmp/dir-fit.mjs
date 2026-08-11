import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4877');
const OUT = path.resolve(arg('out', 'shots/dir-fit'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const logs = [];
const out = { fit: [], testout: null };

const VIEWS = [[1280, 720, 'w1280'], [1600, 900, 'w1600'], [414, 896, 'p414'], [390, 844, 'p390']];

// ---- pass 1: play the whole lesson cold-correct, measure test-out cost
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  out.testout = await page.evaluate(async () => {
    const A = window.__ascent;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let items = 0, secs = 0, guard = 0;
    const per = [];
    while (guard++ < 400) {
      const nx = A.mastery.next();
      if (!nx) break;
      const held = A.skillIds.filter((s) => A.mastery.get(s).mastered).length;
      if (held >= A.skillIds.length) break;
      const task = A.task(nx.id);
      const it = A.itemFor(task);
      if (!it) { break; }
      secs += A.itemSeconds(task, it) || 20;
      A.mastery.observe(nx.id, true, { difficulty: task.difficulty, form: it.form, rep: it.rep, assisted: false, kind: task.kind });
      items += 1;
      per.push(nx.id);
    }
    const counts = {};
    for (const p of per) counts[p] = (counts[p] || 0) + 1;
    return {
      items, minutes: Math.round(secs / 6) / 10,
      held: A.skillIds.filter((s) => A.mastery.get(s).mastered).length,
      total: A.skillIds.length, perSkill: counts,
    };
  });
  await ctx.close();
}

// ---- pass 2: report layout fit across viewports and locales
for (const [w, h, tag] of VIEWS) {
  for (const loc of ['en', 'es', 'pl']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
    const page = await ctx.newPage();
    page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate((loc) => window.__ascent.setLocale(loc), loc);
    // seed a mastered skill by driving the real engine
    await page.evaluate(() => {
      const A = window.__ascent;
      const id = A.skillIds[0];
      for (let i = 0; i < 12 && !A.mastery.get(id).mastered; i++) {
        const task = A.task(id); const it = A.itemFor(task);
        A.mastery.observe(id, true, { difficulty: task.difficulty, form: it?.form, rep: it?.rep, assisted: false, kind: task.kind });
      }
    });
    // open report
    let opened = false;
    for (let i = 0; i < 30 && !opened; i++) {
      await page.evaluate(() => window.__ascent.panel?.close?.());
      await page.click('.rp-launch', { force: true }).catch(() => {});
      await page.waitForTimeout(350);
      opened = await page.evaluate(() => !!document.querySelector('.rp-scrim.show'));
    }
    // expand the first card
    await page.evaluate(() => {
      const art = document.querySelector('.rp-skill');
      if (art?.querySelector('.rp-detail')?.hidden) art.querySelector('.rp-row').click();
    });
    await page.waitForTimeout(500);
    const fit = await page.evaluate(() => {
      const bad = [];
      const scrim = document.querySelector('.rp-scrim');
      const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      for (const el of scrim.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
        const oy = cs.overflowY, ox = cs.overflowX;
        const clipX = el.scrollWidth > el.clientWidth + 2 && ox !== 'auto' && ox !== 'scroll';
        const clipY = el.scrollHeight > el.clientHeight + 2 && oy !== 'auto' && oy !== 'scroll';
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if ((clipX || clipY) && hasText) {
          bad.push({ cls: el.className?.baseVal ?? el.className, tag: el.tagName, sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, txt: el.textContent.trim().slice(0, 50) });
        }
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 2 && hasText) bad.push({ off: true, cls: el.className, txt: el.textContent.trim().slice(0, 40), right: Math.round(r.right) });
      }
      return { docOverflow, bad: bad.slice(0, 12) };
    });
    out.fit.push({ tag, w, h, loc, ...fit });
    await page.screenshot({ path: path.join(OUT, `${tag}-${loc}.png`) });
    await ctx.close();
  }
}
out.logs = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'fit.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 6000));
await browser.close();
