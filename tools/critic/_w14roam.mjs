/**
 * The other player. Answers ONE stint, then deliberately walks away from the
 * tear and goes wherever the world says to go — the survey mark, the foundry,
 * a cache. Real keys throughout. The question it answers is the only one that
 * matters here: is there anything out there worth the trip, and does the game
 * tell you about it?
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const OUT = path.resolve(arg('out', 'shots/w14-fun/roam'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ascent.locale', 'en'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1800);

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
const panelOpen = () => page.evaluate(() => window.__ascent.panelInfo().open).catch(() => false);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()).catch(() => null); return c && c.open ? c : null; };
for (const sel of ['.sc-go', '.op-go', '.ct-go']) { const l = page.locator(sel); if (await l.count() && await l.first().isVisible().catch(() => false)) { await l.first().click().catch(() => {}); await page.waitForTimeout(700); } }

async function answer(c) {
  if (c.mode === 'choice') { const b = page.locator('.rf-reading'); const n = await b.count(); for (let i = 0; i < n; i++) { const v = await b.nth(i).getAttribute('data-value'); if (String(v) === String(c.answer)) { await b.nth(i).click().catch(() => {}); return; } } await b.first().click().catch(() => {}); return; }
  if (c.mode === 'keypad') { for (const ch of String(c.answer ?? '')) { if (ch === '-') await page.keyboard.press('Minus'); else if (ch === '/') await page.keyboard.press('Slash'); else await page.keyboard.press(ch); await page.waitForTimeout(50); } await page.keyboard.press('Enter'); return; }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first(); if (await any.count()) await any.click().catch(() => {});
}

/** Walk toward a world point with real keys + mouse. Returns closest distance reached. */
async function walkTo(get, budgetMs, glide = false) {
  const t0 = Date.now(); let best = Infinity;
  await page.keyboard.down('KeyShiftLeft').catch(() => {});
  await page.keyboard.down('KeyW');
  try {
    while (Date.now() - t0 < budgetMs) {
      const s = await page.evaluate((g) => {
        const A = window.__ascent; const p = A.player.pos;
        const tgt = eval(g);
        if (!tgt) return null;
        const dx = tgt.x - p.x, dz = tgt.z - p.z;
        const want = Math.atan2(dx, dz);
        const yaw = A.player.yaw ?? 0;
        return { d: Math.hypot(dx, dz), dy: (tgt.y ?? p.y) - p.y, want, yaw, pos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)] };
      }, get).catch(() => null);
      if (!s) break;
      best = Math.min(best, s.d);
      if (s.d < 10) break;
      // The game says so itself on its own controls card: without pointer lock
      // the mouse cannot turn the view, the arrow keys do. So we turn the way
      // the game tells a player to turn.
      let d = ((s.want - s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
      const ms = Math.min(500, Math.abs(d) * 240);
      if (Math.abs(d) > 0.08) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }
      if (glide) { await page.keyboard.down('Space'); await page.waitForTimeout(200); await page.keyboard.up('Space'); }
      await page.waitForTimeout(300);
    }
  } finally { await page.keyboard.up('KeyW'); await page.keyboard.up('KeyShiftLeft').catch(() => {}); }
  return best;
}

// walk to the first tear and do exactly one stint (3 items)
await walkTo('(()=>{const r=window.__ascent.rifts.list[0];return r?{x:r.pos.x,y:r.pos.y,z:r.pos.z}:null})()', 60000);
await page.keyboard.press('KeyE'); await page.waitForTimeout(900);
let done = 0;
while (done < 3 && await panelOpen()) {
  const c = await card(); if (!c) break;
  if (c.settled) { await page.waitForTimeout(600); continue; }
  await answer(c); done++; await page.waitForTimeout(2600);
  if (!(await panelOpen())) { await page.keyboard.press('KeyE'); await page.waitForTimeout(1200); }
}
// walk away from the tear rather than pausing — that is what ends a stint
await page.keyboard.down('KeyS'); await page.waitForTimeout(2500); await page.keyboard.up('KeyS');
await page.waitForTimeout(1500);
await shot('r1-stint-over');

const world = await page.evaluate(() => {
  const A = window.__ascent;
  return { errand: A.errand?.state ? A.errand.state() : (A.errand || null), relay: A.relay?.state ? A.relay.state() : null,
    kit: A.kit.state(), caches: A.caches.state(), drift: A.state().drift,
    pos: [Math.round(A.player.pos.x), Math.round(A.player.pos.y), Math.round(A.player.pos.z)] };
}).catch((e) => ({ err: String(e) }));
await writeFile(path.join(OUT, 'world-after-stint.json'), JSON.stringify(world, null, 2));

// what does the game say to do now?
const hud = await page.evaluate(() => ({
  objective: document.querySelector('.ob-card')?.innerText || null,
  guide: document.querySelector('.gd-dist')?.textContent || null,
  beckon: document.querySelector('.bk-card')?.innerText || null,
  marlow: document.querySelector('.cm-line')?.innerText || null,
})).catch(() => ({}));
await writeFile(path.join(OUT, 'hud-after-stint.json'), JSON.stringify(hud, null, 2));

// go for whatever the world hung out there: survey mark, else nearest cache
await shot('r2-look-around');
const mark = await page.evaluate(() => {
  const A = window.__ascent; const e = A.errand;
  const st = e && typeof e.state === 'function' ? e.state() : null;
  if (st && st.mark) return st.mark;
  if (st && st.at) return st.at;
  const c = A.caches.state(); const p = A.player.pos;
  let best = null; for (const x of c.at) { if (x.opened) continue; const d = Math.hypot(x.x - p.x, x.z - p.z); if (!best || d < best.d) best = { x: x.x, y: x.y, z: x.z, d, kind: 'cache' }; }
  return best;
}).catch(() => null);
await writeFile(path.join(OUT, 'mark.json'), JSON.stringify(mark, null, 2));
if (mark) {
  const reached = await walkTo(`(${JSON.stringify(mark)})`, 150000, true);
  await shot('r3-at-mark');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1500);
  await shot('r4-mark-claimed');
  const after = await page.evaluate(() => { const A = window.__ascent; return { kit: A.kit.state(), caches: A.caches.state(), drift: A.state().drift, pos: [Math.round(A.player.pos.x), Math.round(A.player.pos.y), Math.round(A.player.pos.z)] }; }).catch(() => null);
  await writeFile(path.join(OUT, 'after-mark.json'), JSON.stringify({ reached, after }, null, 2));
  console.log('reached within', Math.round(reached), 'm');
}
// wander 60s in a straight line to see what the middle distance holds
await page.keyboard.down('KeyW'); await page.waitForTimeout(45000); await page.keyboard.up('KeyW');
await shot('r5-wander');
await writeFile(path.join(OUT, 'errors.json'), JSON.stringify(errors, null, 2));
console.log('errors', errors.length);
await browser.close();
