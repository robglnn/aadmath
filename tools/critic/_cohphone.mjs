/**
 * COHERENCE: the phone. Real touch, through the browser's own input pipeline
 * (CDP Input.dispatchTouchEvent), on a 390x844 frame with a notch.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const LOC = arg('locale', 'en');
const OUT = path.resolve(arg('out', '/tmp/cohplay/phone'));
const MIN = Number(arg('minutes', 8));
const W = Number(arg('w', 390)), H = Number(arg('h', 844));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
const say = (s) => console.log(s);

// --- real touch, through the browser -----------------------------------
const tp = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const P = (x, y, id = 1) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 12, radiusY: 12, force: 1 });
/* A touchEnd MUST CARRY THE POINT IT IS LIFTING. Sent with an empty
   touchPoints array it produces a TouchEvent whose `changedTouches` is empty,
   so `src/player/touch.js` `onEnd` deletes nothing, the stick stays "held" for
   ever and every later gesture reads `moveMag 0`. That is a harness defect and
   it cost this lane two readings of the phone's verbs. */
async function tap(x, y, id = 1) {
  await tp('touchStart', [P(x, y, id)]);
  await page.waitForTimeout(70);
  await tp('touchEnd', [P(x, y, id)]);
  await page.waitForTimeout(90);
}
async function press(x, y, ms, id = 1) {
  await tp('touchStart', [P(x, y, id)]);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { await tp('touchMove', [P(x, y, id)]); await page.waitForTimeout(60); }
  await tp('touchEnd', [P(x, y, id)]);
}
async function drag(x0, y0, dx, dy, holdMs = 500, id = 1) {
  await tp('touchStart', [P(x0, y0, id)]);
  for (let i = 1; i <= 6; i++) { await tp('touchMove', [P(x0 + dx * i / 6, y0 + dy * i / 6, id)]); await page.waitForTimeout(16); }
  const t0 = Date.now();
  while (Date.now() - t0 < holdMs) { await tp('touchMove', [P(x0 + dx, y0 + dy, id)]); await page.waitForTimeout(50); }
  await tp('touchEnd', [P(x0 + dx, y0 + dy, id)]);
}
const box = (sel) => page.evaluate((q) => {
  const e = document.querySelector(q); if (!e) return null;
  const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  const mid = document.elementFromPoint(cx, cy);
  return { x: cx, y: cy, w: Math.round(r.width), h: Math.round(r.height),
    display: c.display, visibility: c.visibility, opacity: +c.opacity, pointerEvents: c.pointerEvents,
    onTop: mid ? (mid === e || e.contains(mid) ? 'itself' : (mid.className || mid.tagName)) : 'nothing' };
}, sel);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);
if (LOC !== 'en') {
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  await page.evaluate((l) => document.querySelector(`.langs button[data-loc="${l}"]`)?.click(), LOC);
  await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(700);
}
await page.screenshot({ path: path.join(OUT, '00-arrival.png') });
const pad = await page.evaluate(() => {
  const el = document.getElementById('touchpad');
  if (!el) return { none: true };
  const btns = [...el.querySelectorAll('.btn')].map((b) => {
    const r = b.getBoundingClientRect();
    return { a: b.dataset.a, label: b.querySelector('b')?.textContent, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const home = el.querySelector('.home')?.getBoundingClientRect();
  return { cls: el.className, on: el.classList.contains('on'), btns,
    home: home ? { x: Math.round(home.left + home.width / 2), y: Math.round(home.top + home.height / 2), w: Math.round(home.width) } : null,
    enabled: !!window.__ascent.input.touch?.enabled };
});
say('touch pad: ' + JSON.stringify(pad));
// what verbs the pad can reach at all
say('verbs the pad offers: ' + (pad.btns || []).map((b) => b.a).join(', '));

// Hand the frame back first. The ORDERS card comes up a few seconds after
// planetfall and `Input.sample()` zeroes the stick while any panel owns the
// screen — so a verb test run over the top of it measures the modal, not the
// pad. (This cost this lane one whole reading: jump and glide both read
// "nothing happened" with the charter up.)
{
  const clearUI = async () => {
    for (let i = 0; i < 40; i++) {
      if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return true;
      for (const sel of ['.ses-charter.show .sc-go', '.fdy .fdy-close', '.ses-close.show .sx-rest',
        '.ses-rest.show .sr-again', '.rf-x']) {
        const b = await box(sel);
        if (b && b.w > 1 && b.visibility !== 'hidden' && b.display !== 'none' && b.opacity > 0.05 && b.pointerEvents !== 'none') {
          await tap(b.x, b.y); break;
        }
      }
      await page.waitForTimeout(500);
    }
    return false;
  };
  const ok = await clearUI();
  say(`frame handed back before the verb tests: ${ok ? 'yes' : 'NO — a panel still owns it'}`);
}

// --- can he walk? ---------------------------------------------------------
const before = await page.evaluate(() => { const p = window.__ascent.player.pos; return [p.x, p.z]; });
await drag(pad.home ? pad.home.x : 70, pad.home ? pad.home.y : H - 90, 0, -70, 2500);
const after = await page.evaluate(() => { const p = window.__ascent.player.pos; return [p.x, p.z]; });
const moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
say(`walking on the floating stick: ${moved.toFixed(1)} m in 2.5 s`);
// --- sprint: the stick to the rim ----------------------------------------
const watchSprint = page.evaluate(() => new Promise((res) => {
  const t0 = performance.now(); let seen = false, maxMag = 0, maxSpeed = 0;
  const tick = () => { const i = window.__ascent.input, L = window.__ascent.player.loco || {};
    if (i.sprint) seen = true;
    if (i.moveMag > maxMag) maxMag = i.moveMag;
    if ((L.speedN || 0) > maxSpeed) maxSpeed = L.speedN;
    if (performance.now() - t0 > 4200) return res({ seen, maxMag: +maxMag.toFixed(2), maxSpeedN: +maxSpeed.toFixed(2) });
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}));
await drag(pad.home ? pad.home.x : 70, pad.home ? pad.home.y : H - 90, 0, -150, 3400, 1);
const sprintRead = await watchSprint;
say(`sprint from the stick rim: ${sprintRead.seen ? 'YES' : 'NO'} (peak stick magnitude ${sprintRead.maxMag}, peak speed ${sprintRead.maxSpeedN} of sprint)`);
const sawSprint = sprintRead.seen;
// --- the three action buttons --------------------------------------------
for (const a of ['jump', 'dash', 'glide']) {
  const b = (pad.btns || []).find((x) => x.a === a); if (!b) { say(`  ${a}: NO BUTTON`); continue; }
  const w = page.evaluate((verb) => new Promise((res) => {
    const t0 = performance.now(); let seen = false, peakY = -1e9, base = window.__ascent.player.pos.y;
    const tick = () => { const L = window.__ascent.player.loco || {}, P2 = window.__ascent.player;
      if (P2.pos.y - base > peakY) peakY = P2.pos.y - base;
      if (verb === 'jump' && (P2.pos.y - base > 0.45 || (L.vel && L.vel.y > 2))) seen = true;
      if (verb === 'dash' && (L.dashT || 0) > 0) seen = true;
      if (verb === 'glide' && L.gliding) seen = true;
      if (performance.now() - t0 > 3000) return res({ seen, rise: +peakY.toFixed(2) }); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), a);
  if (a === 'glide') {
    // a glide is a thing you do in the air: jump first, then hold the button
    const j = (pad.btns || []).find((x) => x.a === 'jump');
    if (j) { await tap(j.x, j.y, 3); await page.waitForTimeout(300); }
    await press(b.x, b.y, 1800, 4);
  } else {
    await tap(b.x, b.y, 3);
  }
  const r = await w;
  say(`  ${a} button ("${b.label}", ${b.w}x${b.h}px): ${r.seen ? 'FIRES' : 'NOTHING HAPPENED'} (rise ${r.rise} m)`);
  await page.waitForTimeout(900);
}
// --- the build verb -------------------------------------------------------
const buildReach = await page.evaluate(() => {
  const bar = document.getElementById('buildbar');
  const r = bar ? bar.getBoundingClientRect() : null;
  const c = bar ? getComputedStyle(bar) : null;
  return { present: !!bar, shown: !!(r && r.width > 1 && r.height > 1 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.05),
    slots: bar ? bar.querySelectorAll('button, .slot, li').length : 0 };
});
say('build rack on the phone: ' + JSON.stringify(buildReach));

// --- a whole short sitting on the thumbs ---------------------------------
const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo().open);
const card = () => page.evaluate(() => window.__ascent.panelInfo());
async function dismissT() {
  for (const sel of ['.fdy .fdy-close', '.ses-charter.show .sc-go', '.ses-close.show .sx-rest',
    '.ses-rest.show .sr-again', '.ses-rest.show .sr-off-frame button', '.rf-x']) {
    const b = await box(sel);
    if (b && b.w > 1 && b.visibility !== 'hidden' && b.display !== 'none' && b.opacity > 0.05 && b.pointerEvents !== 'none') {
      await tap(b.x, b.y); await page.waitForTimeout(450); return sel;
    }
  }
  return null;
}
async function answerT(c) {
  if (c.mode === 'choice') {
    const n = await page.locator('.rf-reading').count(); if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) if (String(await page.locator('.rf-reading').nth(i).getAttribute('data-value')) === String(c.answer)) { want = i; break; }
    const bb = await page.locator('.rf-reading').nth(want).boundingBox(); if (!bb) return false;
    await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true;
  }
  if (c.mode === 'keypad') {
    const s = String(c.answer ?? ''); if (!s) return false;
    for (const ch of s) {
      const g = ch === '-' ? '-' : ch;
      let k = page.locator(`.rf-key[data-g="${g}"]`).first();
      if (!(await k.count())) k = page.locator('.rf-key').filter({ hasText: new RegExp(`^\\s*[${ch === '-' ? '\\-\\u2212' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]\\s*$`) }).first();
      if (await k.count()) { const bb = await k.boundingBox(); if (bb) { await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); continue; } }
      return 'NO-KEY:' + ch;
    }
    const seal = page.locator('.rf-key.commit, .rf-key[data-g="seal"]').first();
    const bb = await (await seal.count() ? seal.boundingBox() : null);
    if (bb) await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else return 'NO-SEAL';
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans, .rf-cell').first();
  if (await any.count()) { const bb = await any.boundingBox(); if (bb) { await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; } }
  return false;
}
const t0 = Date.now(); let n = 0; const notes = [];
while (Date.now() - t0 < MIN * 60000) {
  await dismissT();
  if (!(await panelOpen())) {
    // steer with the look side, walk with the stick, knock with the interact button
    const w = await page.evaluate((half) => {
      const a = window.__ascent, T = a.THREE, o = a.objective(); if (!o) return null;
      const p = a.player.pos, hd = a.world.headingTo(p.x, p.z, o.x, o.z);
      const f = new T.Vector3(); a.camera.getWorldDirection(f); f.y = 0; f.normalize();
      const d = new T.Vector3(Math.sin(hd.yaw), 0, Math.cos(hd.yaw));
      return { ang: Math.atan2(f.x * d.z - f.z * d.x, f.dot(d)), dist: Math.hypot(o.x - p.x, o.z - p.z) };
    }, W / 2);
    if (w && Math.abs(w.ang) > 0.12) await drag(Math.round(W * 0.72), Math.round(H * 0.42), Math.max(-90, Math.min(90, w.ang * 90)), 0, 60, 4);
    await drag(pad.home ? pad.home.x : 70, pad.home ? pad.home.y : H - 90, 0, -80, 900, 5);
    const ib = (pad.btns || []).find((x) => x.a === 'interact');
    if (ib) { await tap(ib.x, ib.y); }
    if (!(await panelOpen())) continue;
  }
  const c = await card(); if (!c.open) continue;
  if (c.settled) { await page.waitForTimeout(900); continue; }
  n++;
  const r = await answerT(c);
  if (r !== true) notes.push(`item ${n} (${c.mode}): ${r}`);
  if (n === 1) await page.screenshot({ path: path.join(OUT, '01-card.png') });
  await page.waitForTimeout(900);
  if (await panelOpen() && !(await page.evaluate(() => !!window.__ascent.panelInfo().settled))) { const x = await box('.rf-x'); if (x) await tap(x.x, x.y); }
}
await dismissT();
await page.screenshot({ path: path.join(OUT, '02-late.png') });
const fin = await page.evaluate(() => {
  const a = window.__ascent;
  return { held: Object.values(a.state().skills || {}).filter((s) => s.mastered).length,
    phase: a.session.state().phase, run: a.session.state().run ? { tears: a.session.state().run.tears, target: a.session.state().run.target } : null };
});
say(`\n${MIN} minutes on the thumbs: ${n} items answered on touch, ${JSON.stringify(fin)}`);
if (notes.length) say('  what the thumbs could not do: ' + notes.slice(0, 10).join(' | '));
// overlap: does anything print over anything on this frame?
const ink = await page.evaluate(() => {
  const sels = ['#hud', '#marlow', '.gd-card', '.ses-band', '#buildbar', '#touchpad .pads', '#touchpad .home', '.kit-rack', '.mnu-pill', '.rp-launch'];
  const rs = sels.map((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    if (!(r.width > 1 && r.height > 1) || c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return null;
    return { s, x: r.left, y: r.top, w: r.width, h: r.height }; }).filter(Boolean);
  const hits = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    if (ox > 4 && oy > 4) hits.push(`${a.s} x ${b.s} = ${Math.round(ox)}x${Math.round(oy)}px`);
  }
  return { boxes: rs.map((r) => `${r.s} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}x${Math.round(r.h)}]`), hits };
});
say('phone furniture: ' + ink.boxes.join('  |  '));
say('box overlaps: ' + (ink.hits.length ? ink.hits.join(' ; ') : 'none'));
say('errors: ' + (errs.length ? errs.slice(0, 6).join(' | ') : 'none'));
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ pad, moved, sawSprint, buildReach, n, fin, ink, notes, errs }, null, 1));
await browser.close();
