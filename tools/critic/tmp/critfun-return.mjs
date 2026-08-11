/** The reason to come back: how a run closes, and what the game says when you reopen it. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = 'http://127.0.0.1:4788';
const OUT = 'shots/critfun-return';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/01-first-open.png` });

const first = await page.evaluate(() => {
  const el = document.querySelector('.ses-charter');
  return { text: el?.innerText?.trim().slice(0, 400) || null, session: window.__ascent.state().session };
});

// a real-shaped session: items paced like a learner, not like a harness
const beats = [];
for (let i = 0; i < 40; i++) {
  const r = await page.evaluate(async () => {
    const A = window.__ascent;
    const st = A.state().session;
    const res = document.querySelector('.ses-resolution, .ses-rest');
    if (res && getComputedStyle(res).opacity > 0.2) return { beat: res.className, text: res.innerText.trim().slice(0, 300), session: st };
    try { A.panel.close(); } catch { /* */ }
    const t = A.nextObjective(); if (!t) return { done: true };
    if (!A.openRiftById(t.id)) return { blocked: true, session: st };
    await new Promise((x) => setTimeout(x, 60));
    if (!A.panel.open) return { blocked: true, session: st };
    A.enter(A.panel.item.answer);
    await new Promise((x) => setTimeout(x, 140));
    return { ok: true, session: A.state().session };
  });
  beats.push(r);
  if (r.beat) break;
  await page.waitForTimeout(300);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-mid-run.png` });

// force the run to its close the way the game does when the budget is spent
const closed = await page.evaluate(async () => {
  const A = window.__ascent;
  try { A.panel.close(); } catch { /* */ }
  if (A.session.close) { A.session.close(); }
  await new Promise((r) => setTimeout(r, 1400));
  const el = document.querySelector('.ses-resolution');
  return { html: !!el, text: el?.innerText?.trim().slice(0, 600) || null };
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/03-resolution.png` });

// the break beat
await page.evaluate(() => {
  document.querySelector('.sr-go, .ses-resolution button')?.click();
});
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/04-rest.png` });
const rest = await page.evaluate(() => {
  const el = document.querySelector('.ses-rest');
  return el ? el.innerText.trim().slice(0, 400) : null;
});

// ---- come back tomorrow: same storage, fresh page
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3200);
await page.screenshot({ path: `${OUT}/05-return.png` });
const back = await page.evaluate(() => {
  const el = document.querySelector('.ses-charter');
  return {
    charter: el?.innerText?.trim().slice(0, 500) || null,
    kit: window.__ascent.kit.state(),
    shards: window.__ascent.state().shards,
    session: window.__ascent.state().session,
  };
});

console.log(JSON.stringify({ errors, first, beats: beats.slice(-6), closed, rest, back }, null, 1));
await browser.close();
