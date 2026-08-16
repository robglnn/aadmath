/**
 * w12: day five, played. Master the lattice, sleep four nights, then go and
 * find the one thing that is new on day five and try to actually beat it,
 * with keys, the way a player would.
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

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(4000);

// --- grind the lattice out over four days, fast, through the real engine ----
for (let d = 1; d <= 4; d++) {
  for (let i = 0; i < 45; i++) {
    const ok = await page.evaluate(async () => {
      const a = window.__ascent;
      if (!a.panel.open) { const n = a.mastery.next(); if (!n) return 'none'; if (!a.openRiftById(n.id)) return 'noopen'; }
      return 'open';
    });
    if (ok !== 'open') break;
    await page.waitForTimeout(220);
    await page.evaluate(() => { try { window.__ascent.panel.demo('right'); } catch {} });
    await page.waitForTimeout(320);
    await page.evaluate(() => { try { if (window.__ascent.panel.open) window.__ascent.panel.close?.(); } catch {} });
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent);
  await page.waitForTimeout(3500);
  const f = await page.evaluate(() => {
    const a = window.__ascent;
    const sk = a.mastery.save().skills;
    return { held: Object.values(sk).filter((s) => s.mastered).length, watch: a.watch(), wardens: a.wardens.state() };
  });
  say(`after day ${d}: held=${f.held} durable=${f.watch.durable} wardens=${JSON.stringify({ wake: f.wardens.wakeDay, alive: f.wardens.alive })}`);
}

// --- DAY FIVE ---------------------------------------------------------------
say('\n===== DAY FIVE =====');
await page.waitForTimeout(2500);
await shot('05-arrival');
const st = await page.evaluate(() => {
  const a = window.__ascent;
  const sk = a.mastery.save().skills;
  return {
    held: Object.values(sk).filter((s) => s.mastered).length,
    watch: a.watch(),
    wardens: a.wardens.state(),
    kit: a.kit.state().held,
    stock: a.kit.state().stock.map((s) => `${s.id}:${s.state}`),
    caches: a.caches.state(),
    hud: (document.getElementById('ui')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 700),
    next: a.mastery.next(),
  };
});
say('held=' + st.held + ' watch=' + JSON.stringify(st.watch));
say('kit=' + JSON.stringify(st.kit) + ' stock=' + JSON.stringify(st.stock));
say('caches=' + JSON.stringify({ total: st.caches.total, opened: st.caches.opened, deep: st.caches.deep, deepOpen: st.caches.deepOpen }));
say('wardens=' + JSON.stringify(st.wardens));
say('next=' + JSON.stringify(st.next));
say('HUD: ' + st.hud);

// --- walk to the warden with keys and try to bind it ------------------------
const w0 = await page.evaluate(() => {
  const a = window.__ascent; const w = a.wardens.state();
  if (!w.at.length) return null;
  const p = a.player.pos; const x = w.at[0];
  return { x: x.x, y: x.y, z: x.z, state: x.state, latex: x.latex, dist: Math.hypot(x.x - p.x, x.z - p.z) };
});
say('\nwarden at start: ' + JSON.stringify(w0));

if (w0) {
  await page.mouse.click(800, 450);
  await page.waitForTimeout(300);
  let held = false;
  const trail = [];
  for (let k = 0; k < 700; k++) {
    const s = await page.evaluate(() => {
      const a = window.__ascent; const w = a.wardens.state();
      const p = a.player.pos;
      if (!w.at.length) return { gone: true };
      const t = w.at[0];
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let dy = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (dy < -Math.PI) dy += Math.PI * 2;
      return {
        dy, dist: Math.hypot(t.x - p.x, t.z - p.z), state: t.state,
        weights: (t.weights || []).length, refused: (t.refused || []).length,
        bound: w.bound, alive: w.alive,
      };
    });
    if (s.gone) { say('warden gone at step ' + k); break; }
    if (k % 60 === 0) { trail.push(`${k}: dist=${s.dist.toFixed(0)} state=${s.state} weights=${s.weights} bound=${s.bound}`); }
    if (s.state === 'roused' && s.weights > 0 && k % 5 === 0) {
      // steer at the CORRECT counterweight — the answer is chosen with the feet
      await page.evaluate(() => {
        const a = window.__ascent; const w = a.wardens.state(); const t = w.at[0];
        const good = (t.weights || []).find((x) => x.correct || x.right || x.value === t.answer);
        if (good) { a.__w12target = { x: good.x, z: good.z }; }
      });
    }
    if (Math.abs(s.dy) > 0.06) await page.mouse.move(800 - s.dy * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await page.waitForTimeout(90);
    if (s.bound > 0) { say(`BOUND at step ${k}`); break; }
    if (k === 120) await shot('06-chasing');
    if (s.dist < 30 && k % 40 === 0) await shot(`07-close-${k}`);
  }
  if (held) await page.keyboard.up('KeyW');
  say(trail.join('\n'));
  await shot('08-after-chase');
  const w1 = await page.evaluate(() => {
    const a = window.__ascent; const w = a.wardens.state();
    return { alive: w.alive, bound: w.bound, at: w.at.map((x) => ({ state: x.state, weights: (x.weights || []).length, refused: (x.refused || []).length })), caches: a.caches.state().total };
  });
  say('warden after chase: ' + JSON.stringify(w1));
}

// what the player is shown as "what next" on day five
await page.evaluate(() => { try { window.__ascent.report.open(); } catch {} });
await page.waitForTimeout(1500);
await shot('09-report');
const rep = await page.evaluate(() => (document.getElementById('ui')?.innerText || '').replace(/\s+/g, ' ').trim());
say('\nREPORT: ' + rep.slice(0, 1200));

say('\nerrors: ' + errs.length);
errs.slice(0, 6).forEach((e) => say(' ! ' + e));
await browser.close();
