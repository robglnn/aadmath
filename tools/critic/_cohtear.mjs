/**
 * COHERENCE: can a cadet who never walks keep the same tear serving?
 * One arrival is meant to be worth three pieces of work (src/session/stint.js).
 * Real keys only. `stint.state()` and `panelInfo()` are read for facts.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const MIN = Number(arg('minutes', 5));
const OUT = path.resolve(arg('out', '/tmp/cohplay/tear'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);
const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo().open);
const card = () => page.evaluate(() => window.__ascent.panelInfo());
const st = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return { stint: a.stint.state(), pos: [+p.x.toFixed(2), +p.z.toFixed(2)],
    obj: (() => { const o = a.objective(); return o ? { id: o.id, spent: o.spent, d: +Math.hypot(o.x - p.x, o.z - p.z).toFixed(1) } : null; })() };
});
async function dismiss() {
  for (const s of ['.ses-charter.show .sc-go', '.ses-close.show .sx-more', '.ses-rest.show .sr-skip', '.ses-rest.show .sr-e-acts button', '.fdy .fdy-close']) {
    const el = page.locator(s).first();
    if (await el.count() && await el.isVisible().catch(() => false)) { await el.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); return true; }
  }
  return false;
}
async function answer(c) {
  if (c.mode === 'choice') {
    const b = page.locator('.rf-reading'); const n = await b.count(); if (!n) return false;
    let w = 0; for (let i = 0; i < n; i++) if (String(await b.nth(i).getAttribute('data-value')) === String(c.answer)) { w = i; break; }
    await b.nth(w).click({ timeout: 5000 }).catch(() => {}); return true;
  }
  if (c.mode === 'keypad') {
    const s = String(c.answer ?? ''); if (!s) return false;
    for (const ch of s) { await page.keyboard.press(ch === '-' ? 'Minus' : ch === '/' ? 'Slash' : ch === '+' ? 'Equal' : ch === '^' ? 'Digit6' : ch); await page.waitForTimeout(26); }
    await page.keyboard.press('Enter'); return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans, .rf-cell').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}
// walk to the first tear on real keys, then never move again
await dismiss();
await page.mouse.click(800, 450); await page.waitForTimeout(300);
let opened = false;
for (let i = 0; i < 300 && !opened; i++) {
  const w = await page.evaluate(() => {
    const a = window.__ascent, T = a.THREE, o = a.objective(); if (!o) return null;
    const p = a.player.pos; const hd = a.world.headingTo(p.x, p.z, o.x, o.z);
    const f = new T.Vector3(); a.camera.getWorldDirection(f); f.y = 0; f.normalize();
    const d = new T.Vector3(Math.sin(hd.yaw), 0, Math.cos(hd.yaw));
    return { ang: Math.atan2(f.x * d.z - f.z * d.x, f.dot(d)), dist: Math.hypot(o.x - p.x, o.z - p.z) };
  });
  if (!w) { await page.waitForTimeout(200); continue; }
  if (Math.abs(w.ang) > 0.08) { const k = w.ang > 0 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(90); await page.keyboard.up(k); }
  await page.keyboard.down('KeyW'); await page.waitForTimeout(160); 
  await page.keyboard.press('KeyE');
  opened = await panelOpen();
  if (opened) await page.keyboard.up('KeyW');
  await dismiss();
}
await page.keyboard.up('KeyW');
const anchor = await page.evaluate(() => { const p = window.__ascent.player.pos; return [p.x, p.z]; });
console.log(`opened=${opened} anchor=${anchor.map((v) => v.toFixed(1))}`);
const t0 = Date.now(); const dl = t0 + MIN * 60000;
let n = 0, refusals = 0, maxDrift = 0; const log = [];
while (Date.now() < dl) {
  const d = await page.evaluate((a) => { const p = window.__ascent.player.pos; return Math.hypot(p.x - a[0], p.z - a[1]); }, anchor);
  if (d > maxDrift) maxDrift = d;
  await dismiss();
  if (!(await panelOpen())) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(320);
    if (!(await panelOpen())) { refusals++; await page.waitForTimeout(700); continue; }
  }
  const c = await card();
  if (!c.open) continue;
  if (c.settled) { await page.waitForTimeout(900); continue; }
  n++;
  if (n % 6 === 1) { const s = await st(); log.push({ n, at: Math.round((Date.now() - t0) / 1000), ...s }); }
  await answer(c);
  await page.waitForTimeout(650);
  if (await panelOpen() && !(await page.evaluate(() => !!window.__ascent.panelInfo().settled))) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
}
const end = await st();
console.log(`\n${MIN} minutes standing still: ${n} items answered, ${refusals} refusals of the key`);
console.log(`the cadet never went further than ${maxDrift.toFixed(2)} m from where he stopped`);
console.log(`stint at the end: ${JSON.stringify(end.stint)}`);
console.log(`objective at the end: ${JSON.stringify(end.obj)}`);
for (const r of log) console.log(`  t=${r.at}s n=${r.n} pos=${JSON.stringify(r.pos)} stint=${JSON.stringify(r.stint)} obj=${JSON.stringify(r.obj)}`);
console.log('errors: ' + (errs.length ? errs.slice(0, 5).join(' | ') : 'none'));
await browser.close();
