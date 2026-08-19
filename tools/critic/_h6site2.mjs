/** H6 — bind the warden, crack the cache. Real keys only. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4777');
const OUT = path.resolve(arg('out', 'shots/h6-site2'));
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
async function runAt(target, budgetMs, near = 4, stop = null, keepRift = false, glide = false) {
  const t0 = Date.now(); let check = 0, stall = 0, wedged = 0, lastDist = Infinity;
  await page.keyboard.down('ShiftLeft');
  if (glide) await page.keyboard.down('Space');
  try {
    while (Date.now() - t0 < budgetMs) {
      if (stop && await stop()) return true;
      if (++check % 12 === 0 && await page.evaluate(() => !!window.__ascent.input.uiOpen) && !(keepRift && (await panelInfo()).open)) {
        await hold([]); await page.keyboard.up('ShiftLeft'); if (glide) await page.keyboard.up('Space');
        await clearFrame(3); await page.keyboard.down('ShiftLeft'); if (glide) await page.keyboard.down('Space');
      }
      const t = typeof target === 'function' ? await target() : target;
      if (!t) { await hold([]); await page.waitForTimeout(200); continue; }
      const err = await page.evaluate((tt) => {
        const a = window.__ascent, p = a.player.pos;
        const want = Math.atan2(tt.x - p.x, tt.z - p.z);
        let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return { d, dist: Math.hypot(tt.x - p.x, tt.z - p.z), dy: (tt.y ?? p.y) - p.y };
      }, t);
      if (err.dist < near && (t.y == null || Math.abs(err.dy) < 6)) return true;
      if (!glide && ++stall % 27 === 0) {
        if (err.dist > lastDist - 1) {
          await page.keyboard.press('Space'); await page.waitForTimeout(120); wedged++;
          if (wedged >= 3) { wedged = 0; await page.keyboard.press('KeyR'); await page.waitForTimeout(900); }
        } else wedged = 0;
        lastDist = err.dist;
      }
      await hold(keysFor(err.d));
      await page.waitForTimeout(100);
    }
  } finally { await hold([]); await page.keyboard.up('ShiftLeft').catch(() => {}); if (glide) await page.keyboard.up('Space').catch(() => {}); }
  return false;
}
async function answerOpenCard() {
  const c = await panelInfo(); if (!c || !c.open) return false;
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading'); const n = await btns.count();
    for (let i = 0; i < n; i++) if (String(await btns.nth(i).getAttribute('data-value')) === String(c.answer)) { await btns.nth(i).click({ timeout: 5000 }).catch(() => {}); return true; }
    return false;
  }
  if (c.mode === 'keypad') {
    for (const ch of String(c.answer ?? '')) {
      if (ch === '-') await page.keyboard.press('Minus'); else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal'); else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch); await page.waitForTimeout(40);
    }
    await page.keyboard.press('Enter'); return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}
async function workItems(n) {
  let done = 0;
  for (let i = 0; i < n * 3 && done < n; i++) {
    if ((await panelInfo()).open) { if (await answerOpenCard()) { await page.waitForTimeout(1500); done++; continue; } }
    const target = await page.evaluate(() => {
      const a = window.__ascent, p = a.player.pos; let best = null, bd = 1e9;
      for (const r of a.rifts.list) { if (r.locked) continue; const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z); if (d < bd) { bd = d; best = r; } }
      return best ? { x: best.pos.x, z: best.pos.z } : null;
    });
    if (!target) return done;
    await runAt(target, 25000, 6, async () => (await panelInfo()).open, true);
    for (let k = 0; k < 8; k++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(300); if ((await panelInfo()).open) break; }
    if (!(await panelInfo()).open) await clearFrame(2);
  }
  return done;
}

await clearFrame(6); await page.mouse.click(W / 2, H / 2); await calibrate();
say('d1 ' + await workItems(6));
for (const d of [2, 3, 4, 5]) {
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  await clearFrame(6); await page.mouse.click(W / 2, H / 2); await calibrate();
  say(`d${d} ` + await workItems(d === 5 ? 3 : 5));
}
await clearFrame(6);
await shot('00-day5');

// ------------------------------------------------------------ THE WARDEN
const wsnap = () => page.evaluate(() => {
  const A = window.__ascent;
  const w = (A.wardens.list || []).find((x) => x.state !== 'bound');
  if (!w) return null;
  return {
    state: w.state, x: w.group.position.x, y: w.group.position.y, z: w.group.position.z,
    latex: w.q?.latex, answer: w.q?.x,
    fan: (w.fan || []).map((s) => ({ v: s.v, spent: !!s.spent, x: s.group.position.x, y: s.group.position.y, z: s.group.position.z })),
    d: Math.hypot(w.group.position.x - A.player.pos.x, w.group.position.z - A.player.pos.z),
  };
});
let w = await wsnap();
say('warden day5: ' + JSON.stringify(w));
if (w) {
  await runAt(async () => { const q = await wsnap(); return q ? { x: q.x, z: q.z } : null; }, 70000, 12);
  await shot('01-warden-near');
  w = await wsnap();
  say('after approach: ' + JSON.stringify(w));
  for (let round = 0; round < 6; round++) {
    const tgt = await page.evaluate(() => {
      const A = window.__ascent;
      const w2 = (A.wardens.list || []).find((x) => x.state !== 'bound'); if (!w2) return null;
      const good = (w2.fan || []).find((s) => !s.spent && Number(s.v) === Number(w2.q.x));
      return good ? { x: good.group.position.x, y: good.group.position.y, z: good.group.position.z, v: good.v } : null;
    });
    if (!tgt) { say('no live correct weight'); break; }
    say(`round ${round}: running at weight ${tgt.v} at (${tgt.x.toFixed(0)},${tgt.y.toFixed(0)},${tgt.z.toFixed(0)}) from ` + JSON.stringify(await page.evaluate(() => { const p = window.__ascent.player.pos; return [Math.round(p.x), Math.round(p.y), Math.round(p.z)]; })));
    await runAt({ x: tgt.x, y: tgt.y, z: tgt.z }, 25000, 2.0, async () => (await page.evaluate(() => window.__ascent.wardens.state().bound)) > 0, false, true);
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => window.__ascent.wardens.state());
    say('  bound=' + st.bound + ' at=' + JSON.stringify(st.at));
    if (st.bound > 0) break;
  }
  await shot('02-warden-result');
  say('wardens: ' + JSON.stringify(await page.evaluate(() => window.__ascent.wardens.state())));
  say('caches after: ' + JSON.stringify(await page.evaluate(() => { const c = window.__ascent.caches.state(); return { total: c.total, opened: c.opened, deep: c.deep }; })));
}

// ------------------------------------------------------------ A CACHE
const csnap = () => page.evaluate(() => {
  const A = window.__ascent, p = A.player.pos;
  let best = null;
  for (const c of (A.caches.list || [])) {
    if (c.opened) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (!best || d < best.d) best = { i: c.i, tier: c.tier, x: c.x, y: c.y, z: c.z, d,
      latex: c.latex ?? c.q?.latex ?? null, answer: c.answer ?? c.q?.x ?? null,
      fan: (c.weights || c.fan || []).map((s) => ({ v: s.v, spent: !!s.spent, x: s.group?.position.x, y: s.group?.position.y, z: s.group?.position.z })) };
  }
  return { best, player: { x: p.x, y: p.y, z: p.z } };
});
let cs = await csnap();
say('cache target: ' + JSON.stringify(cs));
if (cs.best) {
  // Get to high ground on the cache's bearing first, then jump and glide out.
  await runAt({ x: cs.best.x * 0.45, z: cs.best.z * 0.45 }, 60000, 8);
  await shot('03-launch');
  say('at launch point: ' + JSON.stringify(await page.evaluate(() => { const p = window.__ascent.player.pos; return [Math.round(p.x), Math.round(p.y), Math.round(p.z)]; })));
  await runAt({ x: cs.best.x, z: cs.best.z }, 120000, 11, null, false, true);
  await shot('04-approach');
  const p1 = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
  say('after glide: ' + JSON.stringify(p1) + ' target ' + JSON.stringify([cs.best.x, cs.best.y, cs.best.z]));
  cs = await csnap();
  say('cache now: ' + JSON.stringify(cs.best));
  // if standing on the perch, run into the right weight
  for (let round = 0; round < 6; round++) {
    const tgt = await page.evaluate(() => {
      const A = window.__ascent, p = A.player.pos;
      let c = null, bd = 1e9;
      for (const x of (A.caches.list || [])) { if (x.opened) continue; const d = Math.hypot(x.x - p.x, x.z - p.z); if (d < bd) { bd = d; c = x; } }
      if (!c || bd > 40) return null;
      const ws = c.weights || c.fan || c.stones || [];
      const ans = c.answer ?? c.q?.x;
      const good = ws.find((s) => !s.spent && Number(s.v) === Number(ans));
      return good && good.group ? { x: good.group.position.x, y: good.group.position.y, z: good.group.position.z, v: good.v, ans, keys: Object.keys(c) } : { none: true, ans, keys: Object.keys(c), nws: ws.length };
    });
    say('weight probe: ' + JSON.stringify(tgt));
    if (!tgt || tgt.none) break;
    await runAt({ x: tgt.x, y: tgt.y, z: tgt.z }, 25000, 2.0, null, false, true);
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => window.__ascent.caches.state());
    say('  opened=' + st.opened);
    if (st.opened > 0) break;
  }
  await shot('05-cache-result');
  say('caches final: ' + JSON.stringify(await page.evaluate(() => { const c = window.__ascent.caches.state(); return { total: c.total, opened: c.opened, deep: c.deep }; })));
  say('player final: ' + JSON.stringify(await page.evaluate(() => ({ ...window.__ascent.player.pos }))));
}
say('errors ' + errors.length);
await writeFile(path.join(OUT, 'log.txt'), log.join('\n'));
await browser.close();
