/**
 * w14 fun critic — a real sitting, driven by real keys and real mouse, with a
 * frame taken every 60 seconds of WALL CLOCK time so minute 8 can be laid next
 * to minute 1. Also logs, second by second, whether the player is in the world
 * or staring at a card, because "worksheet with a wallpaper" is a claim about
 * that ratio.
 *
 *   node tools/critic/_w14fun.mjs --url http://127.0.0.1:4917 --minutes 9 --out shots/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const MINUTES = Number(arg('minutes', 9));
const OUT = path.resolve(arg('out', 'shots/w14-play'));
const MODE = arg('mode', 'mixed');
const DAYS = Number(arg('days', 0));      // advanceDays before playing
const SESSION = arg('session', '1');
const FRESH = arg('fresh', '1') === '1';
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
if (FRESH) {
  await page.evaluate(() => { localStorage.removeItem('ascent.save'); localStorage.removeItem('ascent.clock'); localStorage.setItem('ascent.locale', 'en'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
}
await page.waitForTimeout(1800);
if (DAYS > 0) {
  await page.evaluate((d) => window.__ascent.advanceDays(d), DAYS);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(1800);
}

const t0 = Date.now();
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
await shot('t000-cold-open');

// dismiss any orders card with a real click
for (const sel of ['.sc-go', '.op-go', '.ct-go']) {
  const l = page.locator(sel);
  if (await l.count()) { await l.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700); break; }
}
await shot('t001-after-open');

// ---------------------------------------------------------- second-by-second
const tape = [];   // {t, panelOpen, dist, objective}
const timer = setInterval(async () => {
  try {
    const s = await page.evaluate(() => {
      const A = window.__ascent;
      const p = A.panelInfo();
      const mark = document.querySelector('.gd-dist');
      const obj = document.querySelector('.gd-title, .ob-title')?.textContent || '';
      return { open: !!p.open, skill: p.skill || null, dist: mark?.textContent || '', obj,
        pos: [Math.round(A.player.pos.x), Math.round(A.player.pos.z)] };
    });
    tape.push({ t: Math.round((Date.now() - t0) / 1000), ...s });
  } catch { /* mid-navigation */ }
}, 1000);

// minute frames
const frameTimers = [];
for (let m = 1; m <= MINUTES; m++) {
  frameTimers.push(setTimeout(async () => {
    try { await shot(`min-${String(m).padStart(2, '0')}`); } catch {}
  }, m * 60000));
}

// -------------------------------------------------------------- real walking
const panelOpen = () => page.evaluate(() => window.__ascent.panelInfo().open).catch(() => false);
const panelSettled = () => page.evaluate(() => !!window.__ascent.panelInfo().settled).catch(() => false);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()).catch(() => null); return c && c.open ? c : null; };

async function walkAndKnock(budgetMs = 45000) {
  const tS = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  let held = false;
  const forward = async (on) => { if (on === held) return; held = on; if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW'); };
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  let mx = cx;
  try {
    while (Date.now() - tS < budgetMs) {
      const w = await page.evaluate(() => {
        const mark = document.querySelector('.gd-mark');
        if (!mark || !mark.classList.contains('show')) return null;
        const r = mark.getBoundingClientRect();
        const m = document.querySelector('.gd-dist')?.textContent || '';
        return { x: r.left + r.width / 2, edge: mark.classList.contains('edge'), dist: parseInt(m.replace(/[^0-9]/g, ''), 10) || null };
      }).catch(() => null);
      if (w) {
        const off = w.x - cx;
        if (Math.abs(off) > 40 || w.edge) {
          const step = Math.max(-160, Math.min(160, off * (w.edge ? 1.6 : 0.7))) || 120;
          mx = Math.max(4, Math.min(W - 4, mx + step));
          await page.mouse.move(mx, cy);
          if (mx <= 8 || mx >= W - 8) mx = cx;
        }
      }
      await forward(true);
      for (let j = 0; j < 4; j++) {
        await page.waitForTimeout(150);
        await page.keyboard.press('KeyE');
        if (await panelOpen()) { await forward(false); return true; }
      }
      if (!w) { mx = mx > cx ? cx - 150 : cx + 150; await page.mouse.move(mx, cy); }
    }
  } finally { await forward(false); }
  return false;
}

async function awaitChain(ms = 5200) {
  const tS = Date.now();
  while (Date.now() - tS < ms) { if (await panelOpen()) return true; await page.waitForTimeout(180); }
  return false;
}

async function answer(c, wrong) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count(); if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) {
      const v = await btns.nth(i).getAttribute('data-value');
      if ((String(v) === String(c.answer)) !== wrong) { want = i; break; }
    }
    await btns.nth(want).click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? '');
    if (wrong) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : (s + '1');
    if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(40);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

// ------------------------------------------------------------------ the play
const served = [];
const deadline = t0 + MINUTES * 60000;
let n = 0, openedByHand = 0;
await walkAndKnock(45000);

while (Date.now() < deadline) {
  if (!(await panelOpen())) {
    if (!(await awaitChain())) { openedByHand++; await walkAndKnock(40000); }
    if (!(await panelOpen())) continue;
  }
  const c = await card();
  if (!c) { await page.waitForTimeout(200); continue; }
  if (c.settled) { const tS = Date.now(); while ((await panelOpen()) && Date.now() - tS < 4000) await page.waitForTimeout(200); continue; }
  n++;
  const wrong = MODE === 'struggler' ? n <= 10 : (MODE === 'knower' ? false : (n % 5 === 3));
  const at = Math.round((Date.now() - t0) / 1000);
  if (n <= 3 || n % 6 === 0) await shot(`item-${String(n).padStart(2, '0')}-card`);
  const delivered = await answer(c, wrong);
  served.push({ n, at, skill: c.skill, mode: c.mode, form: c.form, kind: c.kind, mastered: c.masteredWhenServed, reprobe: c.reprobe, wrong, delivered });
  await page.waitForTimeout(900);
  if (await panelOpen()) {
    if (await panelSettled()) { const tS = Date.now(); while ((await panelOpen()) && Date.now() - tS < 3600) await page.waitForTimeout(200); }
    else { await page.waitForTimeout(700); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }
}

clearInterval(timer);
for (const ft of frameTimers) clearTimeout(ft);
await page.waitForTimeout(400);
await shot('zz-last-frame');
// open the progress panel the way a player does
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(700);
await shot('zz-menu');
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(500);
const prog = page.locator('.hud-progress, [data-progress], .pg-open').first();
if (await prog.count()) { await prog.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(900); await shot('zz-progress'); await page.keyboard.press('Escape').catch(() => {}); }

const final = await page.evaluate(() => {
  const A = window.__ascent;
  const st = A.state();
  const skills = {};
  for (const id of A.skillIds) { const s = A.mastery.state.get(id); if (s) skills[id] = { attempts: s.attempts, correct: s.correct, mastered: s.mastered }; }
  return { hud: st, skills, watch: A.watch(), content: A.content(), kit: A.kit?.state?.(), caches: A.caches?.state?.(), wardens: A.wardens?.state?.(), drift: st.drift };
}).catch((e) => ({ err: String(e) }));

const inPanel = tape.filter((x) => x.open).length;
const summary = {
  session: SESSION, minutes: MINUTES, mode: MODE, days: DAYS,
  items: n, openedByHand, errors,
  secondsSampled: tape.length, secondsInPanel: inPanel,
  pctInPanel: tape.length ? Math.round(100 * inPanel / tape.length) : 0,
  served, final,
};
await writeFile(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(path.join(OUT, 'tape.json'), JSON.stringify(tape, null, 2));
console.log(JSON.stringify({ session: SESSION, items: n, pctInPanel: summary.pctInPanel, openedByHand, errors: errors.length }, null, 2));
await browser.close();
