/**
 * MINUTE 1 AND MINUTE 8, FROM THE SAME GROUND.
 *
 * The critic's fourth requirement is a picture: *"the arrival frame genuinely
 * competes with a Fortnite screenshot; five minutes later it is a worksheet
 * with a wallpaper."* So both frames are taken from the SAME spot on the SAME
 * bearing, with the world holding the frame and nothing else — the difference
 * between them is only what eight minutes of play did to the island.
 *
 * It turns the view with a RIGHT-BUTTON DRAG, never a left click. A left click
 * is the build verb: an earlier capture ran 118 pieces of lattice up in front
 * of its own camera and photographed the inside of a wall it had built itself.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4990');
const OUT = path.resolve(arg('out', 'shots/w13-frames'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(5200);
const T0 = Date.now();
const el = () => (Date.now() - T0) / 1000;

/** Right-button drag: turns the view, never builds. */
async function drag(dx) {
  const from = Math.max(80, Math.min(W - 80, W / 2 - dx / 2));
  await page.mouse.move(from, H / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(from + dx, H / 2, { steps: 8 });
  await page.mouse.up({ button: 'right' });
}
const yaw = () => page.evaluate(() => window.__ascent.player.yaw);
/** Turn to an absolute world bearing, closed loop. */
async function faceBearing(want) {
  for (let i = 0; i < 40; i++) {
    const y = await yaw();
    let e = ((want - y + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (e < -Math.PI) e += Math.PI * 2;
    if (Math.abs(e) < 0.05) return true;
    await drag(-e * 330);
    await page.waitForTimeout(90);
  }
  return false;
}
const clearUI = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
};
const facts = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return {
    x: p.x, y: p.y, z: p.z,
    survey: a.errand.state(), held: [...a.mastery.state.values()].filter((s) => s.mastered).length,
    motes: a.wallet.count(), columns: a.drift.columns.length,
    drift: { ...a.drift.stats },
  };
});

// dismiss the orders card the way a player does
try { await page.waitForSelector('.sc-go', { timeout: 12000 }); await page.locator('.sc-go').click(); } catch {}
await page.waitForTimeout(900);
await clearUI();

// Face the Spine, the signature summit, from the landing plaza.
const SPINE = await page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return Math.atan2(62 - p.x, -98 - p.z);
});
const HOME = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));

async function shoot(name) {
  await clearUI();
  await faceBearing(SPINE);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  const f = await facts();
  console.log(`${name}  at (${f.x.toFixed(0)}, ${f.z.toFixed(0)}) y=${f.y.toFixed(0)} · `
    + `marks ${f.survey.held}/${f.survey.total} · lines held ${f.held} · motes ${f.motes} · columns ${f.columns}`);
}

await shoot('minute-01');

// ---- play for seven more minutes: walk to tears, press E, answer -----------
const panelOpen = () => page.evaluate(() => !!window.__ascent.panel?.open);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()); return c && c.open ? c : null; };
async function answer(c) {
  if (c.mode === 'choice') {
    const b = page.locator('.rf-reading');
    const n = await b.count();
    let w = 0;
    for (let i = 0; i < n; i++) if (String(await b.nth(i).getAttribute('data-value')) === String(c.answer)) { w = i; break; }
    if (n) await b.nth(w).click({ timeout: 4000 }).catch(() => {});
  } else if (c.mode === 'keypad') {
    for (const ch of String(c.answer ?? '')) {
      if (ch === '-') await page.keyboard.press('Minus'); else await page.keyboard.press(ch);
      await page.waitForTimeout(30);
    }
    await page.keyboard.press('Enter');
  } else {
    await page.keyboard.press('Escape');
  }
}
async function goto(tx, tz, budget, glide) {
  const t0 = Date.now();
  await page.keyboard.down('ShiftLeft');
  if (glide) await page.keyboard.down('Space');
  await page.keyboard.down('KeyW');
  let last = Infinity, stall = 0;
  while (Date.now() - t0 < budget) {
    if (await panelOpen()) break;
    const e = await page.evaluate(([x, z]) => {
      const a = window.__ascent, p = a.player.pos;
      let d = ((Math.atan2(x - p.x, z - p.z) - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(p.x - x, p.z - z) };
    }, [tx, tz]);
    if (Math.abs(e.d) > 0.06) { await page.keyboard.up('KeyW'); await drag(-e.d * 330); await page.keyboard.down('KeyW'); }
    await page.waitForTimeout(180);
    if (e.dist < 5) break;
    if (e.dist > last - 0.3) stall++; else stall = 0;
    last = e.dist;
    if (stall > 12) { await page.keyboard.press('Space'); await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD'); stall = 0; last = Infinity; }
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  if (glide) await page.keyboard.up('Space');
}

while (el() < 430) {
  if (await panelOpen()) {
    const c = await card();
    if (c && !c.settled) { await answer(c); await page.waitForTimeout(1800); } else await page.waitForTimeout(400);
    continue;
  }
  await clearUI();
  const aim = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const b = a.errand.bearing();
    // Alternate: a tear, then whatever the survey has lit — the same two
    // things the game itself offers.
    const live = a.rifts.list.filter((r) => !r.locked && !r.mastered)
      .map((r) => ({ kind: 'tear', x: r.foot.x, z: r.foot.z, d: Math.hypot(p.x - r.foot.x, p.z - r.foot.z) }))
      .sort((u, v) => u.d - v.d)[0];
    if (b && (!live || Math.random() < 0.5)) return { kind: 'mark', x: b.pos.x, z: b.pos.z };
    return live || null;
  });
  if (!aim) { await page.waitForTimeout(600); continue; }
  await goto(aim.x, aim.z, 55000, aim.kind === 'mark');
  if (aim.kind === 'tear' && !(await panelOpen())) { await page.keyboard.press('KeyE'); await page.waitForTimeout(800); }
}

// back to the same ground, and the same bearing
await clearUI();
await goto(HOME.x, HOME.z, 90000, false);
await shoot('minute-08');
console.log('console errors:', errors.length);
await browser.close();
