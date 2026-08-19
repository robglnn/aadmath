/**
 * H6 — the off-island expedition. Reach day five, then go and SOLVE a site.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4777');
const OUT = path.resolve(arg('out', 'shots/h6-site'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
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
  if (s > 0.38) out.push(strafeSign > 0 ? 'KeyD' : 'KeyA');
  else if (s < -0.38) out.push(strafeSign > 0 ? 'KeyA' : 'KeyD');
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
  try {
    while (Date.now() - t0 < budgetMs) {
      if (stop && await stop()) return true;
      if (++check % 9 === 0 && await page.evaluate(() => !!window.__ascent.input.uiOpen) && !(keepRift && (await panelInfo()).open)) {
        await hold([]); await page.keyboard.up('ShiftLeft'); await clearFrame(3); await page.keyboard.down('ShiftLeft');
      }
      const t = typeof target === 'function' ? await target() : target;
      if (!t) { await hold([]); await page.waitForTimeout(200); continue; }
      const err = await page.evaluate((tt) => {
        const a = window.__ascent, p = a.player.pos;
        const want = Math.atan2(tt.x - p.x, tt.z - p.z);
        let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return { d, dist: Math.hypot(tt.x - p.x, tt.z - p.z) };
      }, t);
      if (err.dist < near) return true;
      if (glide) await page.keyboard.down('Space');
      if (++stall % 27 === 0) {
        if (err.dist > lastDist - 1) {
          await page.keyboard.press('Space'); await page.waitForTimeout(120); wedged++;
          if (wedged >= 3) { wedged = 0; await page.keyboard.press('KeyR'); await page.waitForTimeout(900); }
        } else wedged = 0;
        lastDist = err.dist;
      }
      await hold(keysFor(err.d));
      await page.waitForTimeout(110);
    }
  } finally { await hold([]); await page.keyboard.up('ShiftLeft'); if (glide) await page.keyboard.up('Space').catch(() => {}); }
  return false;
}
async function answerOpenCard() {
  const c = await panelInfo();
  if (!c || !c.open) return false;
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading'); const n = await btns.count();
    for (let i = 0; i < n; i++) if (String(await btns.nth(i).getAttribute('data-value')) === String(c.answer)) { await btns.nth(i).click({ timeout: 5000 }).catch(() => {}); return true; }
    return false;
  }
  if (c.mode === 'keypad') {
    for (const ch of String(c.answer ?? '')) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(40);
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
    if ((await panelInfo()).open) { if (await answerOpenCard()) { await page.waitForTimeout(1600); done++; continue; } }
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

// ---- day 1..4 quickly, then day 5
await clearFrame(6);
await page.mouse.click(W / 2, H / 2);
await calibrate();
say('d1 items ' + await workItems(6));
for (const d of [2, 3, 4, 5]) {
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  await clearFrame(6); await page.mouse.click(W / 2, H / 2); await calibrate();
  say(`d${d} items ` + await workItems(d === 5 ? 4 : 5));
}
await clearFrame(6);
say('DAY5 wardens: ' + JSON.stringify(await page.evaluate(() => window.__ascent.wardens.state())));
say('DAY5 kit: ' + JSON.stringify(await page.evaluate(() => { const k = window.__ascent.kit.state(); return { held: k.held, motes: k.motes, beacons: k.beacons, charters: k.charters, move: k.move }; })));
say('DAY5 errand: ' + JSON.stringify(await page.evaluate(() => window.__ascent.errand?.state?.() ?? null)).slice(0, 800));
await shot('00-day5');

// ---------------------------------------------------------------- THE WARDEN
const wpos = () => page.evaluate(() => {
  const s = window.__ascent.wardens.state();
  const w = s.at.find((x) => x.state !== 'bound');
  return w ? { x: w.x, y: w.y, z: w.z, state: w.state, latex: w.latex, answer: w.answer, weights: w.weights } : null;
});
let w0 = await wpos();
say('warden at ' + JSON.stringify(w0));
if (w0) {
  await runAt(async () => { const w = await wpos(); return w ? { x: w.x, z: w.z } : null; }, 90000, 9);
  await shot('01-warden-close');
  say('after chase, warden: ' + JSON.stringify(await wpos()));
  say('player: ' + JSON.stringify(await page.evaluate(() => ({ ...window.__ascent.player.pos }))));
  // the counterweights: read them, then RUN into the right one
  const wt = await page.evaluate(() => {
    const s = window.__ascent.wardens.state();
    const w = s.at.find((x) => x.state !== 'bound');
    return w ? { answer: w.answer, weights: w.weights } : null;
  });
  say('weights: ' + JSON.stringify(wt));
  if (wt && wt.weights?.length) {
    for (let round = 0; round < 4; round++) {
      const tgt = await page.evaluate(() => {
        const A = window.__ascent, s = A.wardens.state();
        const w = s.at.find((x) => x.state !== 'bound'); if (!w) return null;
        const good = (w.weights || []).find((q) => Number(q.v) === Number(w.answer) && !q.spent);
        return good ? { x: good.x, y: good.y, z: good.z, v: good.v } : null;
      });
      if (!tgt) break;
      say('running at weight ' + JSON.stringify(tgt));
      await runAt({ x: tgt.x, z: tgt.z }, 30000, 2.5, null, false, true);
      await page.waitForTimeout(1500);
      const st = await page.evaluate(() => window.__ascent.wardens.state());
      say('warden state now: ' + JSON.stringify(st.at[0] ?? null) + ' bound=' + st.bound);
      if (st.bound > 0) break;
    }
  }
  await shot('02-warden-after');
  say('wardens final: ' + JSON.stringify(await page.evaluate(() => window.__ascent.wardens.state())));
  say('caches: ' + JSON.stringify(await page.evaluate(() => { const c = window.__ascent.caches.state(); return { total: c.total, opened: c.opened, deep: c.deep, deepOpen: c.deepOpen }; })));
}

// ---------------------------------------------------------------- A CACHE
const cache = await page.evaluate(() => {
  const A = window.__ascent, c = A.caches.state(), p = A.player.pos;
  let best = null;
  for (const x of c.at) { if (x.opened) continue; const d = Math.hypot(x.x - p.x, x.z - p.z); if (!best || d < best.d) best = { ...x, d }; }
  return best;
});
say('nearest unopened cache: ' + JSON.stringify(cache));
if (cache) {
  say('player before: ' + JSON.stringify(await page.evaluate(() => ({ ...window.__ascent.player.pos }))));
  const reached = await runAt({ x: cache.x, z: cache.z }, 150000, 10, null, false, true);
  say('reached horizontally: ' + reached);
  const at = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
  say('player after: ' + JSON.stringify(at) + ' cache y=' + cache.y);
  await shot('03-at-cache');
  const c2 = await page.evaluate(() => { const c = window.__ascent.caches.state(); return { opened: c.opened, at: c.at }; });
  say('caches: ' + JSON.stringify(c2.opened));
  // read the balance the cache is holding
  const detail = await page.evaluate(() => {
    const A = window.__ascent;
    const list = A.caches.list || [];
    return list.map((c) => ({ i: c.i, opened: c.opened, latex: c.latex, answer: c.answer,
      weights: (c.weights || []).map((w) => ({ v: w.v, spent: w.spent, x: Math.round(w.pos?.x ?? w.x ?? 0), y: Math.round(w.pos?.y ?? w.y ?? 0), z: Math.round(w.pos?.z ?? w.z ?? 0) })) }));
  }).catch((e) => 'ERR ' + e.message);
  say('cache detail: ' + JSON.stringify(detail).slice(0, 1200));
}
await writeFile(path.join(OUT, 'log.txt'), log.join('\n'));
say('errors ' + errors.length + (errors.length ? ' :: ' + errors.slice(0, 4).join(' ;; ') : ''));
await writeFile(path.join(OUT, 'final.json'), JSON.stringify(await page.evaluate(() => {
  const A = window.__ascent, s = A.state();
  return { fps: s.fps, tier: s.fxTier, caches: s.caches, spans: s.spans, wardens: s.wardens, kit: s.kit, session: s.session, watch: A.watch() };
}), null, 2));
await browser.close();
