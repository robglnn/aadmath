/** H6 — fly out and crack a hanging cache with real keys. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4777');
const OUT = path.resolve(arg('out', 'shots/h6-fly'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const log = []; const say = (s) => { console.log(s); log.push(String(s)); };
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);
// setup only: five real days of the real scheduler, so the wing is earned
for (const d of [1, 2, 3, 4, 5]) {
  await page.evaluate(async () => {
    const A = window.__ascent;
    for (let i = 0; i < 70; i++) {
      const o = A.nextObjective(); if (!o) break;
      if (!A.openRiftById(o.id)) break;
      const info = A.panelInfo(); if (!info.open) break;
      A.enter(info.answer);
      await new Promise((r) => setTimeout(r, 25));
      try { A.panel.close?.(); } catch {}
      await new Promise((r) => setTimeout(r, 15));
    }
  });
  if (d < 5) {
    await page.evaluate(() => window.__ascent.advanceDays(1));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(3500);
  }
}
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);

let strafeSign = 1, downNow = new Set();
async function hold(keys) {
  const want = new Set(keys);
  for (const k of downNow) if (!want.has(k)) await page.keyboard.up(k).catch(() => {});
  for (const k of want) if (!downNow.has(k)) await page.keyboard.down(k).catch(() => {});
  downNow = want;
}
const panelInfo = () => page.evaluate(() => window.__ascent.panelInfo());
async function clearFrame(tries = 6) {
  const CARDS = ['.fdy.show .fdy-close', '.ses-charter.show .sc-go', '.ses-close.show .sx-rest', '.ses-rest.show .sr-skip', '.ses-rest.show .sr-off'];
  for (let i = 0; i < tries; i++) {
    for (const sel of CARDS) {
      const b = page.locator(sel).first();
      if (!(await b.count())) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      if (await b.click({ timeout: 1500 }).then(() => true).catch(() => false)) await page.waitForTimeout(500);
    }
    if ((await panelInfo()).open || await page.evaluate(() => !!window.__ascent.input.uiOpen)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    await page.evaluate(() => document.activeElement?.blur?.());
    const a = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    await hold(['KeyW']); await page.waitForTimeout(600); await hold([]);
    const b = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.6) return true;
    await page.mouse.click(W / 2, H / 2); await page.waitForTimeout(300);
  }
  return false;
}
await clearFrame(8);
await page.mouse.click(W / 2, H / 2);
{ // calibrate
  const a = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
  await hold(['KeyD']); await page.waitForTimeout(600); await hold([]);
  const b = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z, yaw: window.__ascent.player.yaw }));
  const dir = Math.atan2(b.x - a.x, b.z - a.z);
  let rel = ((dir - b.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (rel < -Math.PI) rel += Math.PI * 2;
  strafeSign = rel > 0 ? 1 : -1;
}
/** Face a bearing with the arrow keys — the game's own no-pointer-lock path. */
async function faceYaw(want) {
  for (let i = 0; i < 20; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2; return e;
    }, want);
    if (Math.abs(d) < 0.1) return true;
    const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(350, Math.max(50, Math.abs(d) / 2.6 * 1000)));
    await page.keyboard.up(key);
  }
  return false;
}
const P = () => page.evaluate(() => { const p = window.__ascent.player.pos; return { x: p.x, y: p.y, z: p.z, g: !!window.__ascent.player.grounded }; });

const cache = await page.evaluate(() => {
  const A = window.__ascent, p = A.player.pos; let best = null;
  for (const c of A.caches.list) { if (c.opened) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (!best || d < best.d) best = { i: c.i, x: c.x, y: c.y, z: c.z, d }; }
  return best;
});
say('cache ' + JSON.stringify(cache) + ' player ' + JSON.stringify(await P()));

// --- walk to the coast on the cache's bearing (ground only) ---
const ang = Math.atan2(cache.x, cache.z);
for (let leg = 0; leg < 90; leg++) {
  const p = await P();
  const r = Math.hypot(p.x, p.z);
  const dist = Math.hypot(cache.x - p.x, cache.z - p.z);
  if (r > 158 || dist < 42) break;
  await faceYaw(Math.atan2(cache.x - p.x, cache.z - p.z));
  await page.keyboard.down('ShiftLeft'); await hold(['KeyW']);
  await page.waitForTimeout(900);
  await hold([]); await page.keyboard.up('ShiftLeft');
  if (leg % 6 === 5) { await page.keyboard.press('Space'); }
  if (await page.evaluate(() => !!window.__ascent.input.uiOpen)) await clearFrame(3);
}
let p = await P();
say('coast: ' + JSON.stringify(p) + ' r=' + Math.hypot(p.x, p.z).toFixed(0) + ' to cache ' + Math.hypot(cache.x - p.x, cache.z - p.z).toFixed(0));
await shot('01-coast');

// --- launch: run off, then HOLD space for the wing, steering with arrows ---
await faceYaw(Math.atan2(cache.x - p.x, cache.z - p.z));
await page.keyboard.down('ShiftLeft');
await hold(['KeyW']);
await page.waitForTimeout(900);
await page.keyboard.up('ShiftLeft');      // sprint is the DIVE control in the air
await page.keyboard.down('Space');        // one keydown, held: jump then the wing
const traj = [];
let hit = false;
for (let i = 0; i < 220; i++) {
  const q = await page.evaluate((c) => {
    const A = window.__ascent, pp = A.player.pos;
    const ca = A.caches.list.find((x) => x.i === c.i);
    return { x: pp.x, y: pp.y, z: pp.z, g: !!A.player.grounded,
      d: Math.hypot(c.x - pp.x, c.z - pp.z), dy: pp.y - c.y, opened: A.caches.state().opened };
  }, cache);
  traj.push([Math.round(q.x), Math.round(q.y), Math.round(q.z), Math.round(q.d), q.g ? 'G' : 'a']);
  if (q.opened > 0) { hit = true; break; }
  if (q.d < 13 && q.g) { hit = true; break; }
  if (q.y < cache.y - 40) break;   // fallen far below, no recovery
  // steer
  const want = Math.atan2(cache.x - q.x, cache.z - q.z);
  const err = await page.evaluate((wv) => {
    let e = ((wv - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (e < -Math.PI) e += Math.PI * 2; return e;
  }, want);
  if (Math.abs(err) > 0.22) {
    const key = err > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key); await page.waitForTimeout(45); await page.keyboard.up(key);
  } else await page.waitForTimeout(80);
}
await page.keyboard.up('Space'); await hold([]);
say('flight: ' + JSON.stringify(traj.filter((_, i) => i % 6 === 0)));
p = await P();
say('landed: ' + JSON.stringify(p) + ' d=' + Math.hypot(cache.x - p.x, cache.z - p.z).toFixed(1) + ' cache y=' + cache.y.toFixed(1) + ' hit=' + hit);
await shot('02-arrive');

// --- on the perch: read the balance, then walk into the right stone ---
const detail = await page.evaluate(() => {
  const A = window.__ascent, pp = A.player.pos; let c = null, bd = 1e9;
  for (const x of A.caches.list) { const d = Math.hypot(x.x - pp.x, x.z - pp.z); if (d < bd) { bd = d; c = x; } }
  if (!c) return null;
  return { i: c.i, d: Math.round(bd), opened: c.opened, latex: c.q?.latex, answer: c.q?.x,
    stones: (c.stones || []).map((s) => { const v = new A.THREE.Vector3(); s.group.getWorldPosition(v); return { v: s.v, spent: !!s.spent, x: v.x, y: v.y, z: v.z, d: Math.round(Math.hypot(v.x - pp.x, v.z - pp.z)) }; }) };
});
say('balance: ' + JSON.stringify(detail));
await shot('03-balance');
for (let round = 0; round < 4; round++) {
  const tgt = await page.evaluate(() => {
    const A = window.__ascent, pp = A.player.pos; let c = null, bd = 1e9;
    for (const x of A.caches.list) { if (x.opened) continue; const d = Math.hypot(x.x - pp.x, x.z - pp.z); if (d < bd) { bd = d; c = x; } }
    if (!c || bd > 40) return null;
    const good = (c.stones || []).find((s) => !s.spent && Number(s.v) === Number(c.q?.x));
    if (!good) return null;
    const v = new A.THREE.Vector3(); good.group.getWorldPosition(v);
    return { x: v.x, y: v.y, z: v.z, v: good.v };
  });
  say('stone: ' + JSON.stringify(tgt));
  if (!tgt) break;
  for (let step = 0; step < 60; step++) {
    const q = await P();
    const d = Math.hypot(tgt.x - q.x, tgt.z - q.z);
    const dy = tgt.y - q.y;
    if (d < 1.6 && Math.abs(dy) < 2.2) break;
    await faceYaw(Math.atan2(tgt.x - q.x, tgt.z - q.z));
    if (dy > 1.2 && q.g) await page.keyboard.press('Space');
    await hold(['KeyW']); await page.waitForTimeout(230); await hold([]);
    const op = await page.evaluate(() => window.__ascent.caches.state().opened);
    if (op > 0) break;
  }
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => window.__ascent.caches.state());
  say('  opened=' + st.opened + ' deep=' + st.deep);
  await shot(`04-stone-${round}`);
  if (st.opened > 0) break;
}
await page.waitForTimeout(2000);
await shot('05-result');
say('caches: ' + JSON.stringify(await page.evaluate(() => window.__ascent.caches.state())).slice(0, 400));
say('errors ' + errors.length);
await writeFile(path.join(OUT, 'log.txt'), log.join('\n'));
await browser.close();
