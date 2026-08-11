/**
 * Probe 5 — collisions, milestones, and the far end in three languages.
 *   A. natural-rate hand play: does the chapter card ever land on the grant card?
 *   B. drive the seal ledger to 140 and read what Marlow actually says
 *   C. the watch card at four viewports in EN/ES/PL, with a pairwise
 *      text-rect overlap audit that ignores ancestors and stacking parents.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funcrit5'));
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
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3000);
const out = [];
const say = (o) => { out.push(o); console.log(JSON.stringify(o)); };

const OVERLAP = `() => {
  const vis = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.35) continue;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 6) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue;
    vis.push({ el, r, txt: txt.slice(0, 46), c: el.className || el.tagName });
  }
  const hits = [];
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i], b = vis[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 6 && oy > 6) hits.push({ a: a.txt, b: b.txt, ca: String(a.c), cb: String(b.c), ox: Math.round(ox), oy: Math.round(oy) });
  }
  // off-screen right/left
  const spill = [];
  for (const v of vis) if (v.r.right > innerWidth + 2 || v.r.left < -2) spill.push({ t: v.txt, c: String(v.c), l: Math.round(v.r.left), r: Math.round(v.r.right) });
  return { hits: hits.slice(0, 14), spill: spill.slice(0, 10) };
}`;
const overlap = () => page.evaluate(eval('(' + OVERLAP + ')'));

async function answerOnce(ok = true) {
  const info = await page.evaluate((k) => {
    const p = window.__ascent.panel;
    if (!p.open || !p.item) return null;
    return { a: String(k ? p.item.answer : (String(p.item.answer) === '1' ? '2' : '1')) };
  }, ok);
  if (!info) return false;
  await page.evaluate((v) => window.__ascent.enter(v), info.a);
  await page.waitForTimeout(500);
  return true;
}

// --- A. natural-rate play; sample overlaps continuously ---
await page.mouse.click(800, 450);
const collisions = [];
for (let round = 0; round < 40; round++) {
  const open = await page.evaluate(() => window.__ascent.panel.open);
  if (!open) {
    // out in the world: this is where the cards land
    const o = await overlap();
    if (o.hits.length) collisions.push({ round, where: 'world', ...o });
    if (o.hits.length && collisions.length <= 3) await page.screenshot({ path: path.join(OUT, `A-collide-${round}.png`) });
    const next = await page.evaluate(() => { const n = window.__ascent.nextObjective(); return n ? n.id : null; });
    if (!next) break;
    await page.evaluate((id) => window.__ascent.openRiftById(id), next);
    await page.waitForTimeout(800);
  } else {
    await answerOnce(true);
  }
  await page.waitForTimeout(300);
}
say({ act: 'natural-collisions', n: collisions.length, sample: collisions.slice(0, 4) });

// --- B. drive the ledger to 140 tears and read Marlow ---
const heard = [];
for (let batch = 0; batch < 16; batch++) {
  await page.evaluate(async () => {
    const A = window.__ascent, m = A.mastery;
    for (let i = 0; i < 12; i++) {
      const o = m.next(); if (!o) break; const t = m.taskFor(o.id); if (!t) break;
      const it = A.itemFor(t); if (!it) continue;
      m.observe(t.skill, true, { assisted: t.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: t.kind });
    }
  });
  await page.waitForTimeout(3500);
  const line = await page.evaluate(() => document.querySelector('.marlow')?.innerText?.replace(/\n/g, ' ')?.trim() || null);
  const seals = await page.evaluate(() => window.__ascent.state().seals ?? window.__ascent.state().tears ?? null);
  if (line && !heard.some((h) => h.line === line)) heard.push({ batch, seals, line: line.slice(0, 200) });
}
say({ act: 'marlow-mile', heard });
await page.waitForTimeout(12000);
const ledger = await page.evaluate(() => { const s = window.__ascent.state(); return { tears: s.tears, seals: s.seals, chapter: s.chapter, rank: s.rank, standing: s.standing }; });
say({ act: 'ledger', ledger, body: await page.evaluate(() => document.querySelector('.chapcard, .chap-card, .card')?.innerText?.replace(/\n/g, ' | ') || null) });

// --- C. four viewports, three languages ---
for (const loc of ['en', 'es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  for (const [w, h] of [[1280, 720], [1600, 900], [414, 896], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1200);
    const o = await overlap();
    say({ act: 'viewport', loc, size: `${w}x${h}`, hits: o.hits.length, spill: o.spill.length, sample: o.hits.slice(0, 3), spillSample: o.spill.slice(0, 3) });
    await page.screenshot({ path: path.join(OUT, `C-${loc}-${w}x${h}.png`) });
    await page.evaluate(() => window.__ascent.openRiftById('both-sides'));
    await page.waitForTimeout(1100);
    const o2 = await overlap();
    say({ act: 'viewport-rift', loc, size: `${w}x${h}`, hits: o2.hits.length, spill: o2.spill.length, sample: o2.hits.slice(0, 3), spillSample: o2.spill.slice(0, 3) });
    await page.screenshot({ path: path.join(OUT, `C-${loc}-${w}x${h}-rift.png`) });
    await page.evaluate(() => window.__ascent.panel.close?.());
    await page.waitForTimeout(400);
  }
  await page.setViewportSize({ width: 1600, height: 900 });
}

await writeFile(path.join(OUT, 'funcrit5.json'), JSON.stringify({ out, errors }, null, 2));
console.log('errors:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e.split('\n')[0]));
await browser.close();
process.exit(0);
