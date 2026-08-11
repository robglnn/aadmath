/**
 * Probe 4 — hands on the keyboard. Real UI, real clicks.
 *   A. cold open, walk, open a rift, answer 12 items through the panel
 *   B. the return beat: come back tomorrow and see what the game says
 *   C. the sounding at the far end — the endgame loop, played by hand
 * fps sampled during real play, not while parked.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funcrit4'));
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

// --- A. answer through the real panel, correctly, using __ascent.enter ---
async function answerOnce(correct = true) {
  const info = await page.evaluate((ok) => {
    const A = window.__ascent, p = A.panel;
    if (!p.open || !p.item) return null;
    const it = p.item;
    const prompt = document.querySelector('.rf-stem, .rf-prompt, .rf-q')?.innerText?.slice(0, 120) || null;
    const mode = p.mode;
    const answer = ok ? it.answer : (String(it.answer) === '1' ? '2' : '1');
    return { prompt, mode, answer: String(answer), skill: it.skill || p.skill };
  }, correct);
  if (!info) return null;
  const res = await page.evaluate((v) => window.__ascent.enter(v), info.answer);
  await page.waitForTimeout(650);
  return { ...info, res };
}

await page.mouse.click(800, 450);
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1600);
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await page.screenshot({ path: path.join(OUT, 'a1-run.png') });

// fps while actually moving
const movingFps = await page.evaluate(async () => {
  const a = window.__ascent; const dts = []; let last = performance.now();
  await new Promise((res) => { let n = 0; const step = () => { const t = performance.now(); dts.push(t - last); last = t; if (++n < 160) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  const s = dts.slice(40).sort((x, y) => x - y); const q = (p) => s[Math.floor(s.length * p)];
  return { median: 1000 / q(0.5), p95: q(0.95), low1: 1000 / q(0.99) };
});
say({ act: 'fps-moving', movingFps });

await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, 'a2-first-rift.png') });
const played = [];
for (let i = 0; i < 14; i++) {
  const r = await answerOnce(i !== 2);           // one deliberate miss
  if (!r) break;
  played.push({ i, mode: r.mode, ok: r.res?.correct ?? r.res?.ok ?? null, mis: r.res?.misconception ?? null });
  if (i === 2) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, 'a3-miss-echo.png') }); }
  const stillOpen = await page.evaluate(() => window.__ascent.panel.open);
  if (!stillOpen) { await page.waitForTimeout(1400); await page.screenshot({ path: path.join(OUT, `a4-sealed-${i}.png`) }); break; }
}
say({ act: 'hand-play', played });
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(OUT, 'a5-after-seal.png') });
say({ act: 'after-first-seal', state: await page.evaluate(() => { const s = window.__ascent.state(); return { shards: s.shards, kit: { held: s.kit.held, next: s.kit.next, lines: s.kit.lines }, session: s.session }; }) });

// --- B. get most of the way, then come back tomorrow ---
await page.evaluate(async () => {
  const A = window.__ascent, m = A.mastery;
  for (let i = 0; i < 260; i++) {
    const o = m.next(); if (!o) break; const t = m.taskFor(o.id); if (!t) break;
    const it = A.itemFor(t); if (!it) continue;
    m.observe(t.skill, true, { assisted: t.scaffold !== 'none', form: it.form, rep: it.rep, scene: it.scene, kind: t.kind });
  }
  A.kit.sync?.();
});
await page.waitForTimeout(9000);            // drain the beats
await page.screenshot({ path: path.join(OUT, 'b1-end-of-day-1.png') });
const closing = await page.evaluate(() => ({
  session: window.__ascent.session.state(),
  body: document.body.innerText.replace(/\n+/g, ' | ').slice(0, 900),
}));
say({ act: 'end-of-day-1', closing });

await page.evaluate(() => window.__ascent.advanceDays(1));
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, 'b2-day-2-return.png') });
say({ act: 'day-2', watch: await page.evaluate(() => window.__ascent.mastery.watch()),
  objective: await page.evaluate(() => document.querySelector('.objective')?.innerText?.replace(/\n/g, ' | ') || null),
  marlow: await page.evaluate(() => document.querySelector('.marlow')?.innerText?.replace(/\n/g, ' | ') || null) });

// play the due lines by hand at a real rift
await page.evaluate(() => window.__ascent.openRiftById('two-step'));
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, 'b3-day-2-rift.png') });
for (let i = 0; i < 6; i++) { const r = await answerOnce(true); if (!r) break; if (!(await page.evaluate(() => window.__ascent.panel.open))) break; }
await page.evaluate(() => window.__ascent.panel.close?.());

// --- C. the sounding: the endgame loop, by hand ---
await page.evaluate(() => window.__ascent.openRiftById('both-sides'));
await page.waitForTimeout(1100);
const soundStart = await page.evaluate(() => ({ mode: window.__ascent.panel.mode, kind: window.__ascent.panel.task?.kind, header: document.querySelector('.rf-head, .rf-top')?.innerText?.replace(/\n/g, ' | ') || null }));
await page.screenshot({ path: path.join(OUT, 'c1-sounding-open.png') });
say({ act: 'sounding-open', soundStart });
const rungs = [];
for (let i = 0; i < 16; i++) {
  const r = await answerOnce(true); if (!r) break;
  const s = await page.evaluate(() => ({ sounding: window.__ascent.mastery.watch().sounding, open: window.__ascent.panel.open, head: document.querySelector('.rf-head, .rf-top')?.innerText?.replace(/\n/g, ' ') || null }));
  rungs.push({ i, rung: s.sounding?.rung, best: s.sounding?.best, open: s.open });
  if (i === 5) await page.screenshot({ path: path.join(OUT, 'c2-sounding-mid.png') });
  if (!s.open) break;
}
say({ act: 'sounding', rungs, final: await page.evaluate(() => window.__ascent.mastery.watch().sounding) });
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(OUT, 'c3-sounding-end.png') });

// miss on purpose deep in a descent — does it sting?
await page.evaluate(() => window.__ascent.panel.close?.());
await page.evaluate(() => window.__ascent.openRiftById('multi-step'));
await page.waitForTimeout(900);
for (let i = 0; i < 4; i++) { await answerOnce(true); if (!(await page.evaluate(() => window.__ascent.panel.open))) break; }
await answerOnce(false);
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, 'c4-sounding-broken.png') });
say({ act: 'sounding-broken', s: await page.evaluate(() => window.__ascent.mastery.watch().sounding),
  text: await page.evaluate(() => document.querySelector('.rf')?.innerText?.replace(/\n/g, ' | ').slice(0, 500) || null) });

await writeFile(path.join(OUT, 'funcrit4.json'), JSON.stringify({ out, errors }, null, 2));
console.log('errors:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e.split('\n')[0]));
await browser.close();
process.exit(0);
