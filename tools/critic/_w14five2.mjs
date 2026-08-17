/**
 * The fifth sitting, properly. Days 1-4 are worked briefly (a real answer in
 * each day is what `src/meta/days.js` counts), a night is advanced between
 * each, and then day five is played for real with every non-rift card the world
 * can put in the way dismissed the way a player dismisses it.
 *
 * Then it goes hunting for whatever the fifth day put out there.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const OUT = path.resolve(arg('out', 'shots/w14-fun/five2'));
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
await page.waitForTimeout(2000);

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) }).catch(() => {});
const pinfo = () => page.evaluate(() => window.__ascent.panelInfo()).catch(() => ({ open: false }));
const panelOpen = async () => (await pinfo()).open;

/** Every card that is not a rift, cleared the way a player clears it. */
async function clearOverlays() {
  const sels = ['.sc-go', '.op-go', '.ct-go', '.fd-back', '.sx-rest', '.rt-go', '.rite-go', '.ar-go'];
  let did = false;
  for (const s of sels) {
    const l = page.locator(s);
    if (await l.count().catch(() => 0) && await l.first().isVisible().catch(() => false)) { await l.first().click({ timeout: 2500 }).catch(() => {}); did = true; await page.waitForTimeout(500); }
  }
  // any visible button whose text is a dismissal, as a net
  if (!did) {
    const btns = page.locator('button:visible');
    const n = Math.min(await btns.count().catch(() => 0), 14);
    for (let i = 0; i < n; i++) {
      const txt = ((await btns.nth(i).innerText().catch(() => '')) || '').trim().toUpperCase();
      if (/^(STEP BACK|BACK TO THE RUN|GOT IT|STAND DOWN|CONTINUE|GO|BEGIN)$/.test(txt)) { await btns.nth(i).click({ timeout: 2500 }).catch(() => {}); did = true; await page.waitForTimeout(500); break; }
    }
  }
  return did;
}

async function answer(c, wrong) {
  if (c.mode === 'choice') {
    const b = page.locator('.rf-reading'); const n = await b.count(); if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) { const v = await b.nth(i).getAttribute('data-value'); if ((String(v) === String(c.answer)) !== wrong) { want = i; break; } }
    await b.nth(want).click({ timeout: 4000 }).catch(() => {}); return true;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? ''); if (wrong) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : s + '1'; if (!s) return false;
    for (const ch of s) { if (ch === '-') await page.keyboard.press('Minus'); else if (ch === '/') await page.keyboard.press('Slash'); else await page.keyboard.press(ch); await page.waitForTimeout(45); }
    await page.keyboard.press('Enter'); return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 4000 }).catch(() => {}); return true; }
  return false;
}

/** Walk toward the guide marker, pressing E, clearing whatever pops. */
async function seek(budgetMs) {
  const t0 = Date.now(); const cx = W / 2 | 0, cy = H / 2 | 0; let mx = cx; let held = false;
  const fwd = async (on) => { if (on === held) return; held = on; if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW'); };
  try {
    while (Date.now() - t0 < budgetMs) {
      if (await panelOpen()) return true;
      if (await clearOverlays()) continue;
      const w = await page.evaluate(() => { const m = document.querySelector('.gd-mark'); if (!m || !m.classList.contains('show')) return null; const r = m.getBoundingClientRect(); return { x: r.left + r.width / 2, edge: m.classList.contains('edge') }; }).catch(() => null);
      if (w) { const off = w.x - cx; if (Math.abs(off) > 40 || w.edge) { const k = off > 0 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(Math.min(320, Math.abs(off) * 0.5)); await page.keyboard.up(k); } }
      else { const k = 'ArrowRight'; await page.keyboard.down(k); await page.waitForTimeout(220); await page.keyboard.up(k); }
      await fwd(true);
      for (let j = 0; j < 4; j++) { await page.waitForTimeout(160); await page.keyboard.press('KeyE'); if (await panelOpen()) { await fwd(false); return true; } }
    }
  } finally { await fwd(false); }
  return false;
}

async function playDay(idx, capMs, think, opts = {}) {
  const t0 = Date.now(); let n = 0; const served = []; const tape = [];
  const tick = setInterval(async () => {
    try {
      const s = await page.evaluate(() => { const A = window.__ascent; const p = A.panelInfo(); return { open: !!p.open, close: !!document.querySelector('.ses-close.show'), pos: [Math.round(A.player.pos.x), Math.round(A.player.pos.z)], w: A.wardens.state() }; });
      tape.push({ t: Math.round((Date.now() - t0) / 1000), open: s.open, close: s.close, pos: s.pos, wardens: s.w.alive });
    } catch {}
  }, 1000);
  const fr = [];
  if (opts.minuteFrames) for (let m = 1; m <= opts.minuteFrames; m++) fr.push(setTimeout(() => shot(`d${idx}-min-${String(m).padStart(2, '0')}`), m * 60000));
  await clearOverlays();
  while (Date.now() - t0 < capMs && (!opts.items || n < opts.items)) {
    if (await page.evaluate(() => !!document.querySelector('.ses-close.show')).catch(() => false)) { if (opts.stopOnClose) break; await clearOverlays(); }
    if (!(await panelOpen())) { if (!(await seek(35000))) { await clearOverlays(); continue; } }
    const c = await pinfo(); if (!c.open) continue;
    if (c.settled) { await page.waitForTimeout(700); continue; }
    n++;
    await page.waitForTimeout(think);
    const wrong = n % 6 === 4;
    served.push({ n, at: Math.round((Date.now() - t0) / 1000), skill: c.skill, mode: c.mode, form: c.form, kind: c.kind, reprobe: c.reprobe, mastered: c.masteredWhenServed, wrong });
    if (opts.cardShots && (n <= 2 || n % 6 === 0)) await shot(`d${idx}-item-${String(n).padStart(2, '0')}`);
    await answer(c, wrong);
    await page.waitForTimeout(1200);
    if (await panelOpen()) { const s = await pinfo(); if (s.settled) { const tS = Date.now(); while ((await panelOpen()) && Date.now() - tS < 3600) await page.waitForTimeout(200); } else { await page.waitForTimeout(700); await page.keyboard.press('Escape'); await page.waitForTimeout(300); await clearOverlays(); } }
  }
  clearInterval(tick); for (const f of fr) clearTimeout(f);
  const st = await page.evaluate(() => { const A = window.__ascent; const s = A.state(); return { wardens: A.wardens.state(), caches: A.caches.state(), kit: A.kit.state(), drift: s.drift, mastered: A.skillIds.filter((i) => A.mastery.state.get(i)?.mastered), watch: A.watch(), session: s.session?.run && { index: s.session.run.index, tears: s.session.run.tears, items: s.session.run.items } }; }).catch((e) => ({ err: String(e) }));
  const inPanel = tape.filter((x) => x.open).length;
  return { idx, seconds: Math.round((Date.now() - t0) / 1000), items: n, pctInPanel: tape.length ? Math.round(100 * inPanel / tape.length) : 0, served, st, tape };
}

const days = [];
for (let d = 1; d <= 4; d++) {
  const r = await playDay(d, 200000, 2200, { items: 9 });
  days.push(r);
  console.log(`day ${d}: ${r.seconds}s items=${r.items} mastered=${(r.st.mastered || []).length} wardens=${JSON.stringify(r.st.wardens)}`);
  await clearOverlays();
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2200);
}
await shot('d5-t000-cold-open');
const five = await playDay(5, 9 * 60000, 6500, { minuteFrames: 8, cardShots: true });
days.push(five);
console.log(`day 5: ${five.seconds}s items=${five.items} inPanel=${five.pctInPanel}% wardens=${JSON.stringify(five.st.wardens)}`);
await shot('d5-zz-end');

// what the fifth day put out there, and can it be reached?
const w = await page.evaluate(() => window.__ascent.wardens.state()).catch(() => null);
await writeFile(path.join(OUT, 'wardens.json'), JSON.stringify(w, null, 2));
if (w && w.at && w.at.length) {
  // frame it with the camera so the judge can see what a fifth session opens on
  await page.evaluate(() => {
    const A = window.__ascent; const a = A.wardens.state().at[0];
    A.player.pos.set(a.x - 26, (a.y || 60) + 4, a.z - 26); A.player.vel.set(0, 0, 0);
    window.__lk = () => { const c = A.camera; c.position.set(a.x - 30, (a.y || 60) + 8, a.z - 30); c.lookAt(a.x, a.y || 60, a.z); };
    A.engine.add(() => window.__lk());
  }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot('d5-warden');
}
await writeFile(path.join(OUT, 'days.json'), JSON.stringify({ errors, days: days.map(({ tape, ...r }) => r) }, null, 2));
await writeFile(path.join(OUT, 'tapes.json'), JSON.stringify(days.map((d) => ({ idx: d.idx, tape: d.tape })), null, 2));
console.log('errors', errors.length);
await browser.close();
