/**
 * H6 — LATE STATE. Grind the lattice through the real engine to get the wing,
 * reach day five, then fly out and SOLVE an off-island site with real keys.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4777');
const OUT = path.resolve(arg('out', 'shots/h6-site3'));
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
await page.waitForTimeout(4200);

// ---- SETUP ONLY: grind the real scheduler + real bank through the real engine
async function grind(n) {
  return page.evaluate(async (N) => {
    const A = window.__ascent;
    let done = 0, served = [];
    for (let i = 0; i < N; i++) {
      const o = A.nextObjective();
      if (!o) break;
      if (!A.openRiftById(o.id)) break;
      const info = A.panelInfo();
      if (!info.open) break;
      served.push(info.skill);
      A.enter(info.answer);
      done++;
      await new Promise((r) => setTimeout(r, 30));
      try { A.panel.close?.(); } catch {}
      await new Promise((r) => setTimeout(r, 20));
    }
    return { done, served };
  }, n);
}
for (const d of [1, 2, 3, 4, 5]) {
  const g = await grind(70);
  const st = await page.evaluate(() => {
    const A = window.__ascent, s = A.state();
    return { lines: s.kit.lines, depth: s.kit.depth, held: s.kit.held, mastered: Object.values(s.skills).filter((v) => v.mastered).length, watch: A.watch() };
  });
  say(`day ${d}: grind ${g.done} -> ${JSON.stringify(st)}`);
  if (d < 5) {
    await page.evaluate(() => window.__ascent.advanceDays(1));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(3500);
  }
}
say('LATE kit: ' + JSON.stringify(await page.evaluate(() => { const k = window.__ascent.kit.state(); return { lines: k.lines, depth: k.depth, held: k.held, move: k.move }; })));
say('LATE wardens: ' + JSON.stringify(await page.evaluate(() => window.__ascent.wardens.state())));
say('LATE rifts: ' + JSON.stringify(await page.evaluate(() => window.__ascent.rifts.list.map((r) => r.id + (r.locked ? ':LOCK' : '')))));

// A clean reload so the cadet stands on the ground like a player who just
// opened the tab, not wherever the grind left him.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);

// ---- from here on: REAL KEYS ONLY
let strafeSign = 1, downNow = new Set();
async function hold(keys) {
  const want = new Set(keys);
  for (const k of downNow) if (!want.has(k)) await page.keyboard.up(k).catch(() => {});
  for (const k of want) if (!downNow.has(k)) await page.keyboard.down(k).catch(() => {});
  downNow = want;
}
async function calibrate() {
  const a = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
  await hold(['KeyD']); await page.waitForTimeout(600); await hold([]);
  const b = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z, yaw: window.__ascent.player.yaw }));
  if (Math.hypot(b.x - a.x, b.z - a.z) < 0.4) return false;
  const dir = Math.atan2(b.x - a.x, b.z - a.z);
  let rel = ((dir - b.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (rel < -Math.PI) rel += Math.PI * 2;
  strafeSign = rel > 0 ? 1 : -1; return true;
}
function keysFor(rel) {
  const out = [];
  if (Math.cos(rel) > 0.38) out.push('KeyW'); else if (Math.cos(rel) < -0.38) out.push('KeyS');
  const s = Math.sin(rel);
  if (s > 0.38) out.push(strafeSign > 0 ? 'KeyD' : 'KeyA'); else if (s < -0.38) out.push(strafeSign > 0 ? 'KeyA' : 'KeyD');
  return out.length ? out : ['KeyW'];
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
say('calibrated ' + await calibrate());
await shot('00-late-day5');

async function runAt(target, budgetMs, near = 4, glide = false, stop = null) {
  const t0 = Date.now(); let check = 0, stall = 0, wedged = 0, lastDist = Infinity;
  await page.keyboard.down('ShiftLeft');
  try {
    while (Date.now() - t0 < budgetMs) {
      if (stop && await stop()) return true;
      if (++check % 12 === 0 && await page.evaluate(() => !!window.__ascent.input.uiOpen)) {
        await hold([]); await page.keyboard.up('ShiftLeft'); await clearFrame(3); await page.keyboard.down('ShiftLeft');
      }
      const t = typeof target === 'function' ? await target() : target;
      if (!t) { await hold([]); await page.waitForTimeout(200); continue; }
      const err = await page.evaluate((tt) => {
        const a = window.__ascent, p = a.player.pos;
        const want = Math.atan2(tt.x - p.x, tt.z - p.z);
        let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return { d, dist: Math.hypot(tt.x - p.x, tt.z - p.z), dy: (tt.y ?? p.y) - p.y, grounded: !!a.player.grounded, y: p.y };
      }, t);
      if (err.dist < near && (t.y == null || Math.abs(err.dy) < 5)) return true;
      if (glide) { if (err.grounded) await page.keyboard.press('Space'); else await page.keyboard.down('Space'); }
      if (++stall % 30 === 0) {
        if (err.dist > lastDist - 1 && err.grounded) {
          await page.keyboard.press('Space'); await page.waitForTimeout(120); wedged++;
          if (wedged >= 4) { wedged = 0; await page.keyboard.press('KeyR'); await page.waitForTimeout(900); }
        } else wedged = 0;
        lastDist = err.dist;
      }
      await hold(keysFor(err.d));
      await page.waitForTimeout(100);
    }
  } finally { await hold([]); await page.keyboard.up('ShiftLeft').catch(() => {}); await page.keyboard.up('Space').catch(() => {}); }
  return false;
}

// ------------------------------------------------- LOOK at a cache from afar
const cache0 = await page.evaluate(() => {
  const A = window.__ascent, p = A.player.pos; let best = null;
  for (const c of A.caches.list) { if (c.opened) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (!best || d < best.d) best = { i: c.i, x: c.x, y: c.y, z: c.z, d }; }
  return best;
});
say('cache: ' + JSON.stringify(cache0));

// Run to the coast on the cache's bearing, then launch.
const ang = Math.atan2(cache0.x, cache0.z);
const coast = { x: Math.sin(ang) * 150, z: Math.cos(ang) * 150 };
say('running to coast ' + JSON.stringify(coast));
await runAt(coast, 90000, 10);
say('at coast: ' + JSON.stringify(await page.evaluate(() => { const p = window.__ascent.player.pos; return [Math.round(p.x), Math.round(p.y), Math.round(p.z)]; })));
await shot('01-coast');
// jump off and glide at the cache
await page.keyboard.press('Space'); await page.waitForTimeout(120);
const got = await runAt({ x: cache0.x, z: cache0.z }, 100000, 12, true);
say('glide reached: ' + got + ' at ' + JSON.stringify(await page.evaluate(() => { const p = window.__ascent.player.pos; return [Math.round(p.x), Math.round(p.y), Math.round(p.z)]; })));
await shot('02-glide');

// stand on the perch and read the balance
const detail = await page.evaluate(() => {
  const A = window.__ascent, p = A.player.pos; let c = null, bd = 1e9;
  for (const x of A.caches.list) { const d = Math.hypot(x.x - p.x, x.z - p.z); if (d < bd) { bd = d; c = x; } }
  if (!c) return null;
  const keys = Object.keys(c);
  const arr = keys.filter((k) => Array.isArray(c[k]));
  return { i: c.i, d: Math.round(bd), opened: c.opened, keys, arrays: arr.map((k) => [k, c[k].length]),
    q: c.q ? { latex: c.q.latex, x: c.q.x, a: c.q.a, b: c.q.b, cc: c.q.c } : null,
    fan: (c.stones || []).map((s) => { const v = new window.__ascent.THREE.Vector3(); s.group.getWorldPosition(v); return { v: s.v, spent: !!s.spent, x: v.x, y: v.y, z: v.z }; }) };
});
say('perch detail: ' + JSON.stringify(detail));
await shot('03-perch');

for (let round = 0; round < 5; round++) {
  const tgt = await page.evaluate(() => {
    const A = window.__ascent, p = A.player.pos; let c = null, bd = 1e9;
    for (const x of A.caches.list) { if (x.opened) continue; const d = Math.hypot(x.x - p.x, x.z - p.z); if (d < bd) { bd = d; c = x; } }
    if (!c || bd > 45) return null;
    const good = (c.stones || []).find((s) => !s.spent && Number(s.v) === Number(c.q?.x));
    if (!good) return null;
    const v = new A.THREE.Vector3(); good.group.getWorldPosition(v);
    return { x: v.x, y: v.y, z: v.z, v: good.v, ans: c.q?.x };
  });
  say('target weight: ' + JSON.stringify(tgt));
  if (!tgt) break;
  await runAt({ x: tgt.x, y: tgt.y, z: tgt.z }, 30000, 1.8, true, async () => (await page.evaluate(() => window.__ascent.caches.state().opened)) > 0);
  await page.waitForTimeout(1400);
  const st = await page.evaluate(() => window.__ascent.caches.state());
  say('  opened=' + st.opened);
  await shot(`04-weight-${round}`);
  if (st.opened > 0) break;
}
await page.waitForTimeout(1500);
await shot('05-after');
say('caches: ' + JSON.stringify(await page.evaluate(() => { const c = window.__ascent.caches.state(); return { total: c.total, opened: c.opened, deep: c.deep }; })));
say('motes: ' + JSON.stringify(await page.evaluate(() => window.__ascent.state().kit.motes ?? window.__ascent.state().drift)));
say('errors ' + errors.length + (errors.length ? ' :: ' + errors.slice(0, 3).join(' ;; ') : ''));
await writeFile(path.join(OUT, 'log.txt'), log.join('\n'));
await browser.close();
