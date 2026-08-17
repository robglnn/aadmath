/**
 * Five sittings, one save, real input throughout.
 *
 * Sessions 1..4 are played to their own close (the game decides when a run is
 * over), with a night advanced between each. Session 5 is the one under the
 * microscope: minute frames on the wall clock, a tape of where the player was
 * standing every second, and — after the run closes — a real walk out to the
 * nearest thing the world has hung in the distance, to find out whether there
 * is anything out there worth the trip.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const OUT = path.resolve(arg('out', 'shots/w14-fun/five'));
const THINK = Number(arg('think', 6000));   // ms a hand spends per item
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ascent.locale', 'en'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1800);

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
const panelOpen = () => page.evaluate(() => window.__ascent.panelInfo().open).catch(() => false);
const panelSettled = () => page.evaluate(() => !!window.__ascent.panelInfo().settled).catch(() => false);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()).catch(() => null); return c && c.open ? c : null; };
const closeUp = () => page.evaluate(() => !!document.querySelector('.ses-close.show')).catch(() => false);
const snapshotState = () => page.evaluate(() => {
  const A = window.__ascent; const st = A.state();
  return { shards: st.shards, integrity: st.integrity, session: st.session?.run && { index: st.session.run.index, tears: st.session.run.tears, items: st.session.run.items, done: st.session.run.done, phase: st.session.phase },
    kit: A.kit.state(), caches: A.caches.state(), wardens: A.wardens.state(), drift: st.drift, watch: A.watch(),
    mastered: A.skillIds.filter((id) => A.mastery.state.get(id)?.mastered),
    pos: [Math.round(A.player.pos.x), Math.round(A.player.pos.y), Math.round(A.player.pos.z)] };
}).catch((e) => ({ err: String(e) }));

async function dismissCards() {
  for (const sel of ['.sc-go', '.op-go', '.ct-go']) {
    const l = page.locator(sel);
    if (await l.count() && await l.first().isVisible().catch(() => false)) { await l.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700); }
  }
}

async function walkAndKnock(budgetMs, tape) {
  const tS = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  let held = false;
  const forward = async (on) => { if (on === held) return; held = on; if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW'); };
  const cx = W / 2 | 0, cy = H / 2 | 0; let mx = cx;
  try {
    while (Date.now() - tS < budgetMs) {
      if (await closeUp()) return false;
      const w = await page.evaluate(() => {
        const m = document.querySelector('.gd-mark');
        if (!m || !m.classList.contains('show')) return null;
        const r = m.getBoundingClientRect();
        return { x: r.left + r.width / 2, edge: m.classList.contains('edge') };
      }).catch(() => null);
      if (w) {
        const off = w.x - cx;
        if (Math.abs(off) > 40 || w.edge) {
          const step = Math.max(-160, Math.min(160, off * (w.edge ? 1.6 : 0.7))) || 120;
          mx = Math.max(4, Math.min(W - 4, mx + step));
          await page.mouse.move(mx, cy); if (mx <= 8 || mx >= W - 8) mx = cx;
        }
      }
      await forward(true);
      for (let j = 0; j < 4; j++) { await page.waitForTimeout(150); await page.keyboard.press('KeyE'); if (await panelOpen()) { await forward(false); return true; } }
      if (!w) { mx = mx > cx ? cx - 150 : cx + 150; await page.mouse.move(mx, cy); }
    }
  } finally { await forward(false); }
  return false;
}

async function answer(c, wrong) {
  if (c.mode === 'choice') {
    const b = page.locator('.rf-reading'); const n = await b.count(); if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) { const v = await b.nth(i).getAttribute('data-value'); if ((String(v) === String(c.answer)) !== wrong) { want = i; break; } }
    await b.nth(want).click({ timeout: 5000 }).catch(() => {}); return true;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? ''); if (wrong) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : s + '1'; if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus'); else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal'); else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(60);
    }
    await page.keyboard.press('Enter'); return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

/** Play until the game itself puts the close card up, or the cap runs out. */
async function playSitting(idx, capMs, opts = {}) {
  const t0 = Date.now();
  const tape = []; const served = [];
  let n = 0, byHand = 0;
  const tick = setInterval(async () => {
    try {
      const s = await page.evaluate(() => {
        const A = window.__ascent; const p = A.panelInfo();
        return { open: !!p.open, skill: p.skill || null, close: !!document.querySelector('.ses-close.show'),
          dist: document.querySelector('.gd-dist')?.textContent || '',
          pos: [Math.round(A.player.pos.x), Math.round(A.player.pos.z)] };
      });
      tape.push({ t: Math.round((Date.now() - t0) / 1000), ...s });
    } catch {}
  }, 1000);
  const frames = [];
  if (opts.minuteFrames) for (let m = 1; m <= opts.minuteFrames; m++) frames.push(setTimeout(() => shot(`s${idx}-min-${String(m).padStart(2, '0')}`).catch(() => {}), m * 60000));

  await dismissCards();
  await walkAndKnock(40000, tape);
  while (Date.now() - t0 < capMs) {
    if (await closeUp()) break;
    if (!(await panelOpen())) {
      const tS = Date.now();
      while (Date.now() - tS < 5200 && !(await panelOpen()) && !(await closeUp())) await page.waitForTimeout(180);
      if (await closeUp()) break;
      if (!(await panelOpen())) { byHand++; await walkAndKnock(35000, tape); }
      if (!(await panelOpen())) continue;
    }
    const c = await card(); if (!c) { await page.waitForTimeout(200); continue; }
    if (c.settled) { const tS = Date.now(); while ((await panelOpen()) && Date.now() - tS < 4000) await page.waitForTimeout(200); continue; }
    n++;
    // a hand takes time to read and type
    await page.waitForTimeout(THINK);
    const wrong = opts.mode === 'struggler' ? n <= 8 : (n % 6 === 4);
    served.push({ n, at: Math.round((Date.now() - t0) / 1000), skill: c.skill, mode: c.mode, form: c.form, kind: c.kind, reprobe: c.reprobe, mastered: c.masteredWhenServed, wrong });
    if (opts.cardShots && (n <= 2 || n % 7 === 0)) await shot(`s${idx}-item-${String(n).padStart(2, '0')}`).catch(() => {});
    await answer(c, wrong);
    await page.waitForTimeout(1100);
    if (await panelOpen()) {
      if (await panelSettled()) { const tS = Date.now(); while ((await panelOpen()) && Date.now() - tS < 3600) await page.waitForTimeout(200); }
      else { await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    }
  }
  clearInterval(tick); for (const f of frames) clearTimeout(f);
  const closed = await closeUp();
  if (closed && opts.shotClose) await shot(`s${idx}-close`).catch(() => {});
  const st = await snapshotState();
  const inPanel = tape.filter((x) => x.open).length;
  const still = (() => { let best = 0, cur = 0; for (let i = 1; i < tape.length; i++) { const a = tape[i - 1].pos, b = tape[i].pos; if (a[0] === b[0] && a[1] === b[1]) { cur++; best = Math.max(best, cur); } else cur = 0; } return best; })();
  return { idx, seconds: Math.round((Date.now() - t0) / 1000), items: n, byHand, closed, pctInPanel: tape.length ? Math.round(100 * inPanel / tape.length) : 0, longestStillSeconds: still, served, state: st, tape };
}

const log = [];
for (let s = 1; s <= 4; s++) {
  const r = await playSitting(s, 7 * 60000, { mode: s === 2 ? 'struggler' : 'mixed', shotClose: s === 1 });
  log.push(r);
  console.log(`sitting ${s}: ${r.seconds}s items=${r.items} closed=${r.closed} inPanel=${r.pctInPanel}% stillest=${r.longestStillSeconds}s mastered=${(r.state.mastered || []).length}`);
  // stand down and sleep a night
  const rest = page.locator('.sx-rest');
  if (await rest.count() && await rest.first().isVisible().catch(() => false)) { await rest.first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1500); }
  if (s === 1) await shot('s1-after-standdown').catch(() => {});
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  if (s === 4) await shot('s5-t000-cold-open').catch(() => {});
}

// ---------------------------------------------------------------- sitting #5
const five = await playSitting(5, 10 * 60000, { mode: 'mixed', minuteFrames: 9, cardShots: true, shotClose: true });
log.push(five);
console.log(`sitting 5: ${five.seconds}s items=${five.items} closed=${five.closed} inPanel=${five.pctInPanel}% stillest=${five.longestStillSeconds}s`);

// after the run closes: is there anything out there worth walking to?
const more = page.locator('.sx-more');
if (await more.count() && await more.first().isVisible().catch(() => false)) { /* leave it */ }
const rest5 = page.locator('.sx-rest');
if (await rest5.count() && await rest5.first().isVisible().catch(() => false)) { await rest5.first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1500); }
await shot('s5-after-close').catch(() => {});

// walk toward the nearest unopened cache with real keys, for 90s
const target = await page.evaluate(() => {
  const A = window.__ascent; const c = A.caches.state();
  const p = A.player.pos; let best = null;
  for (const x of c.at) { if (x.opened) continue; const d = Math.hypot(x.x - p.x, x.z - p.z); if (!best || d < best.d) best = { ...x, d }; }
  return best;
});
if (target) {
  const t0 = Date.now();
  await page.keyboard.down('KeyW');
  while (Date.now() - t0 < 90000) {
    const s = await page.evaluate((t) => {
      const A = window.__ascent; const p = A.player.pos;
      const dx = t.x - p.x, dz = t.z - p.z;
      const want = Math.atan2(dx, dz);
      const yaw = A.player.yaw ?? A.camera.rotation.y;
      return { d: Math.hypot(dx, dz), want, yaw, pos: [Math.round(p.x), Math.round(p.z)] };
    }, target).catch(() => null);
    if (!s || s.d < 12) break;
    // steer with real mouse movement
    let dy = ((s.want - s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    await page.mouse.move(W / 2 + Math.max(-200, Math.min(200, dy * 220)), H / 2);
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);
  await shot('s5-at-cache').catch(() => {});
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1400);
  await shot('s5-cache-opened').catch(() => {});
}
const afterWalk = await snapshotState();
await shot('s5-zz-final').catch(() => {});

await writeFile(path.join(OUT, 'five.json'), JSON.stringify({ errors, log: log.map(({ tape, ...r }) => r), afterWalk, target }, null, 2));
await writeFile(path.join(OUT, 'tapes.json'), JSON.stringify(log.map((r) => ({ idx: r.idx, tape: r.tape })), null, 2));
console.log('errors', errors.length);
await browser.close();
