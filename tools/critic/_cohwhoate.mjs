/**
 * COHERENCE PROBE — WHICH surface takes the frame while a phone walks to a tear?
 * check:touch fails `interact` in 9 of 9 locale x orientation cases with
 * "a surface took the frame mid-walk (uiOpen) at ~5 m". This names it.
 * Real touch through CDP; __ascent is READ only.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const LOC = arg('locale', 'en');
const W = Number(arg('w', 390)), H = Number(arg('h', 844));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const P = (x, y, id = 1) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 12, radiusY: 12, force: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(4000);
if (LOC !== 'en') {
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  await page.evaluate(l => document.querySelector(`.langs button[data-loc="${l}"]`)?.click(), LOC);
  await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(800);
}
const READ = () => {
  const a = window.__ascent, p = a.player.pos;
  const up = [...document.querySelectorAll('body *')].filter(e => {
    const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return r.width > innerWidth * 0.5 && r.height > innerHeight * 0.4 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.2 && c.pointerEvents !== 'none';
  }).map(e => e.className || e.tagName).slice(0, 8);
  const near = a.rifts.list.filter(r => !r.locked).map(r => ({ id: r.id, d: Math.hypot((r.foot ? r.foot.x : r.pos.x) - p.x, (r.foot ? r.foot.z : r.pos.z) - p.z) })).sort((u, v) => u.d - v.d)[0];
  return { ui: !!a.input.uiOpen, panel: !!a.panelInfo().open, phase: a.session.state().phase, up,
    text: (document.querySelector('.ses-charter.show,.fdy,.meta-quest,.ses-close.show,.ses-rest.show,.mnu.show') || {}).innerText?.slice(0, 220) || null,
    d: near ? +near.d.toFixed(1) : null, id: near ? near.id : null };
};
// clear whatever is up at planetfall the way a thumb does, then walk
const box = s => page.evaluate(q => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
  if (!(r.width > 1 && r.height > 1) || c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.05 || c.pointerEvents === 'none') return null;
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, s);
const tap = async (x, y) => { await tp('touchStart', [P(x, y)]); await page.waitForTimeout(70); await tp('touchEnd', [P(x, y)]); await page.waitForTimeout(120); };
for (let i = 0; i < 30; i++) {
  const s = await page.evaluate(READ); if (!s.ui) break;
  let hit = false;
  for (const q of ['.ses-charter.show .sc-go', '.fdy .fdy-close', '.ses-close.show .sx-rest', '.ses-rest.show .sr-again', '.rf-x', '.mnu .mnu-close']) {
    const b = await box(q); if (b) { await tap(b.x, b.y); hit = true; break; }
  }
  if (!hit) await page.waitForTimeout(400);
}
console.log('at the start of the walk:', JSON.stringify(await page.evaluate(READ)));
const home = await page.evaluate(() => { const e = document.querySelector('#touchpad .home'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
const sx = home ? home.x : 70, sy = home ? home.y : H - 90;
await tp('touchStart', [P(sx, sy, 9)]);
const t0 = Date.now(); let last = null;
while (Date.now() - t0 < 120000) {
  // aim
  await page.evaluate(() => { const a = window.__ascent, p = a.player.pos;
    const r = a.rifts.list.filter(x => !x.locked).map(x => ({ x: x.foot ? x.foot.x : x.pos.x, z: x.foot ? x.foot.z : x.pos.z, d: Math.hypot((x.foot ? x.foot.x : x.pos.x) - p.x, (x.foot ? x.foot.z : x.pos.z) - p.z) })).sort((u, v) => u.d - v.d)[0];
    window.__WANT = r ? Math.atan2(r.x - p.x, r.z - p.z) : null; });
  const e = await page.evaluate(() => { const a = window.__ascent; let d = (window.__WANT ?? a.player.yaw) - a.player.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; });
  if (Math.abs(e) > 0.10) {
    await tp('touchEnd', [P(sx, sy - 70, 9)]);
    const ax = Math.round(W * 0.62), ay = Math.round(H * 0.28), dx = Math.max(-320, Math.min(320, -e / 0.0052));
    await tp('touchStart', [P(ax, ay, 4)]);
    for (let i = 1; i <= 8; i++) { await tp('touchMove', [P(ax + dx * i / 8, ay, 4)]); await page.waitForTimeout(16); }
    await tp('touchEnd', [P(ax + dx, ay, 4)]);
    await tp('touchStart', [P(sx, sy, 9)]);
  }
  await tp('touchMove', [P(sx, sy - 70, 9)]);
  await page.waitForTimeout(110);
  const s = await page.evaluate(READ);
  const key = JSON.stringify([s.ui, s.panel, s.phase, s.up]);
  if (key !== last) { console.log(`  d=${s.d} ${s.id}  ui=${s.ui} panel=${s.panel} phase=${s.phase} up=${JSON.stringify(s.up)}${s.text ? '\n     TEXT: ' + s.text.replace(/\n/g, ' / ') : ''}`); last = key; }
  if (s.ui) { console.log(`\n*** A SURFACE TOOK THE FRAME AT ${s.d} m FROM ${s.id} ***`); await page.screenshot({ path: '/tmp/coh-whoate.png' }); break; }
  if (s.panel) { console.log(`\n*** the tear itself opened at ${s.d} m ***`); break; }
  if (s.d != null && s.d < 2) { console.log(`\nwalked in to ${s.d} m with nothing taking the frame`); break; }
}
await tp('touchEnd', [P(sx, sy - 70, 9)]).catch(() => {});
console.log('errors:', errs.length ? errs.slice(0, 4) : 'none');
await browser.close();
