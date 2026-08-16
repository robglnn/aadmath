/**
 * w12 — THE FIFTH SITTING, played end to end.
 *
 * Four days of real work first, then a full twenty-minute fifth session:
 * whatever the game offers, taken in the order the game offers it, with the
 * warden chased on foot when it wakes.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4939');
const OUT = path.resolve(arg('out', 'shots/w12-day5'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
const say = console.log;

const item = async () => {
  const ok = await page.evaluate(() => {
    const a = window.__ascent;
    if (!a.panel.open) { const n = a.mastery.next(); if (!n) return 'none'; if (!a.openRiftById(n.id)) return 'noopen'; }
    return 'open';
  });
  if (ok !== 'open') return null;
  await page.waitForTimeout(260);
  const info = await page.evaluate(() => window.__ascent.panelInfo());
  await page.evaluate(() => { try { window.__ascent.panel.demo('right'); } catch {} });
  await page.waitForTimeout(340);
  await page.evaluate(() => { try { if (window.__ascent.panel.open) window.__ascent.panel.close?.(); } catch {} });
  await page.waitForTimeout(140);
  return info;
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(4000);

for (let d = 1; d <= 4; d++) {
  for (let i = 0; i < 40; i++) { if (!(await item())) break; }
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent);
  await page.waitForTimeout(3500);
}

say('===== FIFTH SITTING =====');
await page.waitForTimeout(3000);
await shot('a-arrival');
const arrive = await page.evaluate(() => {
  const a = window.__ascent;
  return {
    watch: a.watch(), wardens: a.wardens.state(),
    kit: a.kit.state(), caches: a.caches.state(),
    hud: (document.getElementById('ui')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 900),
  };
});
say('arrive watch=' + JSON.stringify(arrive.watch));
say('arrive kit depth=' + arrive.kit.depth + ' held=' + JSON.stringify(arrive.kit.held) + ' stock=' + JSON.stringify(arrive.kit.stock.map((s) => s.id + ':' + s.state)));
say('arrive caches=' + JSON.stringify({ t: arrive.caches.total, o: arrive.caches.opened, deep: arrive.caches.deep }));
say('arrive wardens=' + JSON.stringify(arrive.wardens));
say('HUD: ' + arrive.hud);

// --- play the fifth sitting: whatever the game hands you --------------------
const served = [];
let wardenSeen = null;
for (let i = 0; i < 40; i++) {
  const info = await item();
  if (!info) { say('scheduler ran dry at item ' + i); break; }
  served.push(info);
  if (i === 0) await shot('b-first-item');
  if (i === 8) await shot('c-mid');
  const w = await page.evaluate(() => window.__ascent.wardens.state());
  if (w.alive > 0 && !wardenSeen) { wardenSeen = { at: i, state: w }; say('WARDEN WOKE at item ' + i + ': ' + JSON.stringify(w.at)); await shot('d-warden-woke'); break; }
}
say('items this sitting: ' + served.length);
say('  kinds: ' + JSON.stringify(served.reduce((m, s) => { m[s.kind || s.reprobe ? 'reprobe/deep' : 'plain'] = 1; return m; }, {})));
say('  skills: ' + JSON.stringify([...new Set(served.map((s) => s.skill))]));
say('  forms: ' + JSON.stringify([...new Set(served.map((s) => s.form))]));
say('  modes: ' + JSON.stringify([...new Set(served.map((s) => s.mode))]));
say('  all on already-held lines: ' + served.every((s) => s.masteredWhenServed) + ' (' + served.filter((s) => s.masteredWhenServed).length + '/' + served.length + ')');

// --- chase the warden on foot ----------------------------------------------
const w0 = await page.evaluate(() => {
  const a = window.__ascent; const w = a.wardens.state();
  if (!w.at.length) return null;
  const p = a.player.pos; const x = w.at[0];
  return { latex: x.latex, answer: x.answer, state: x.state, dist: Math.hypot(x.x - p.x, x.z - p.z) };
});
say('\nwarden: ' + JSON.stringify(w0));
if (w0) {
  await page.mouse.click(800, 450);
  await page.waitForTimeout(300);
  let down = false;
  for (let k = 0; k < 900; k++) {
    const s = await page.evaluate(() => {
      const a = window.__ascent; const w = a.wardens.state(); const p = a.player.pos;
      if (!w.at.length) return { gone: true, bound: w.bound };
      const t = w.at[0];
      // aim at the correct counterweight if one is on the ground, else the warden
      const good = (t.weights || []).find((x) => x.correct === true || x.value === t.answer);
      // Cut the circle, do not follow it round: the wardens run a circuit about
      // the island centre, so aim at a point on that circle well ahead of it.
      let tx = t.x, tz = t.z;
      if (!good) {
        const R = Math.hypot(t.x, t.z) || 1;
        const ang = Math.atan2(t.z, t.x);
        const prev = a.__w12prev;
        let dir = 1;
        if (prev != null) { let da = ang - prev; while (da > Math.PI) da -= 2*Math.PI; while (da < -Math.PI) da += 2*Math.PI; dir = da >= 0 ? 1 : -1; a.__w12dir = dir; }
        else dir = a.__w12dir || 1;
        a.__w12prev = ang;
        const lead = (a.__w12lead || 1.1) * dir;
        tx = Math.cos(ang + lead) * R; tz = Math.sin(ang + lead) * R;
      } else { tx = good.x; tz = good.z; }
      const want = Math.atan2(tx - p.x, tz - p.z);
      let dy = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (dy < -Math.PI) dy += Math.PI * 2;
      return { dy, dist: Math.hypot(t.x - p.x, t.z - p.z), state: t.state, weights: (t.weights || []).length, aiming: !!good, bound: w.bound, refused: (t.refused || []).length };
    });
    if (s.gone) { say('warden gone/bound at step ' + k + ' bound=' + s.bound); break; }
    if (k % 80 === 0) say(`  ${k}: dist=${s.dist.toFixed(0)} state=${s.state} weights=${s.weights} aiming=${s.aiming} refused=${s.refused} bound=${s.bound}`);
    if (Math.abs(s.dy) > 0.05) await page.mouse.move(800 - s.dy * 260, 450, { steps: 2 });
    if (!down) { await page.keyboard.down('KeyW'); down = true; }
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(85);
    if (k === 60) await shot('e-chase-60');
    if (k === 200) await shot('f-chase-200');
    if (s.bound > 0) { say('BOUND at step ' + k); await shot('g-bound'); break; }
  }
  if (down) { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
  await shot('h-after-chase');
  say('after chase: ' + JSON.stringify(await page.evaluate(() => { const w = window.__ascent.wardens.state(); return { alive: w.alive, bound: w.bound, woke: w.woke, at: w.at.map((x) => ({ state: x.state, refused: (x.refused || []).length })) }; })));
}

await page.evaluate(() => { try { window.__ascent.report.open(); } catch {} });
await page.waitForTimeout(1500);
await shot('i-report');
say('\nerrors: ' + errs.length);
errs.slice(0, 6).forEach((e) => say(' ! ' + e));
await browser.close();
