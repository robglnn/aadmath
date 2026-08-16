/**
 * THE CHIMNEY GUARD.
 *
 * A cold critic: "ten walls placed and every placement snapped into the plane
 * of the existing structure, producing a 2x2 slab, not a footprint." The
 * horizontal half of that was fixed by naming the cell a face belongs to. The
 * vertical half was not: an occupied slot cost 100 and the guard against a
 * storey the crosshair was not on cost 8, so a second click at a wall promoted
 * the piece a storey instead of saying the slot was taken. Standing still on
 * flat ground and clicking eight times therefore built a twenty-four metre
 * chimney — six walls, one above the other, none of them reachable.
 *
 * This is the test that has to keep failing to build one. It clicks at ONE face
 * without turning and without looking up, and then looks up and clicks again:
 *   - repeated clicks must set exactly ONE wall and then say "occupied";
 *   - a deliberate look up at the head of that wall must set the second storey.
 * Real mouse presses and real drags only; nothing here calls place().
 *
 *   node tools/critic/chimney.mjs --url http://127.0.0.1:4399 [--n 8]
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const N = +arg('n', 8);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
// hasTouch is required, and its absence is silent: without it Chromium drops
// every CDP touch event on the floor, so the look-up below did nothing at all
// and read as "the second storey cannot be built" when it had never been asked for.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4000);

const facts = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const live = [];
  for (const k of Object.keys(b.lattice.live)) for (const p of b.lattice.live[k]) if (!p.dead) live.push({ kind: p.kind, x: p.x, z: p.z, base: p.base });
  const tg = b.target();
  return {
    pos: { x: +a.player.pos.x.toFixed(2), y: +a.player.pos.y.toFixed(2), z: +a.player.pos.z.toFixed(2) },
    yaw: +a.player.yaw.toFixed(3), pitch: +a.player.pitch.toFixed(3),
    ghost: { x: tg.x, z: tg.z, base: tg.base, valid: tg.valid, reason: tg.reason },
    why: document.querySelector('.axiom-why.show')?.textContent || '',
    pieces: live,
  };
});
const clearUI = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => window.__ascent.input.uiOpen))) return;
    const btn = page.locator('button:visible').filter({ hasText: /BEGIN THE RUN|GOT IT|CLOSE|CONTINUE/i }).first();
    if (await btn.count().catch(() => 0)) await btn.click().catch(() => {}); else await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
};
const walk = async (k, ms) => { await clearUI(); await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(320); };
await clearUI();
const f0 = await facts();
const home = await page.evaluate((q) => {
  const a = window.__ascent; const c = (v) => Math.floor(v / 4 + 0.5) * 4; const out = [];
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = c(q.x) + i * 4, z = c(q.z) + j * 4; let lo = Infinity, hi = -Infinity, bad = false;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [6, 0], [-6, 0], [0, 6], [0, -6]]) {
      const h = a.islandAt(x + dx, z + dz); if (h === null) { bad = true; break; }
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    const clutter = a.builder.solids.all.some((p) => p.fixed && Math.hypot(p.x - x, p.z - z) < 11);
    if (!bad) out.push({ x, z, span: +(hi - lo).toFixed(3), clutter, d: Math.hypot(x - q.x, z - q.z) });
  }
  return out.sort((u, v) => (u.clutter - v.clutter) || (u.span - v.span) || (u.d - v.d))[0];
}, f0.pos);
const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
for (let i = 0; i < 30; i++) {
  const f = await facts(); const dx = home.x - f.pos.x, dz = home.z - f.pos.z, d = Math.hypot(dx, dz);
  if (d <= 0.9) break;
  const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
  const dir = { KeyW: [fx, fz], KeyS: [-fx, -fz], KeyA: [fz, -fx], KeyD: [-fz, fx] };
  let best = null, bs = -Infinity;
  for (const k of KEYS) { const s = (dir[k][0] * dx + dir[k][1] * dz) / d; if (s > bs) { bs = s; best = k; } }
  await walk(best, Math.min(430, Math.max(90, d * 55)));
}
await page.keyboard.press('Digit1');
await page.waitForTimeout(400);
const pts = [[1080, 470], [380, 520], [1200, 280]];
const pt = await page.evaluate((ps) => { for (const p of ps) { const el = document.elementFromPoint(p[0], p[1]); if (el && el.tagName === 'CANVAS') return p; } return null; }, pts) || pts[0];
await page.mouse.move(pt[0], pt[1]);
console.log(`\n${N} clicks at ONE face, no turn, no look up:`);
for (let i = 0; i < N; i++) {
  const b = await facts();
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
  await page.waitForTimeout(420);
  const a2 = await facts();
  console.log(`  click ${i + 1}: aim base ${b.ghost.base} valid=${b.ghost.valid} "${b.ghost.reason}" -> ${a2.pieces.length} pieces  chip:"${a2.why}"`);
}
// …and now LOOK UP at the head of the wall and click: the second storey is
// still one gesture. A vertical drag writes input.look.y, the same accumulator
// a mouse writes to.
const cdp = await page.context().newCDPSession(page);
const sens = await page.evaluate(() => window.__ascent.input.sensitivity || 1);
const k = 0.0052 * sens;
async function tilt(rad) {
  const px = -rad / k;                    // dragging up raises the gaze
  const x = 1100, y0 = 420 - px / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
  for (let i = 1; i <= 14; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (px * i) / 14, id: 1 }] });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
}
for (const deg of [36]) {
  await tilt((deg / 180) * Math.PI);
  const b = await facts();
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
  await page.waitForTimeout(420);
  const a2 = await facts();
  console.log(`  look up: pitch ${b.pitch} aim base ${b.ghost.base} valid=${b.ghost.valid} "${b.ghost.reason}" -> ${a2.pieces.length} pieces`);
}

const f = await facts();
const walls = f.pieces.filter((p) => p.kind === 'wall');
const cols = [...new Set(walls.map((p) => `${p.x},${p.z}`))];
const levels = [...new Set(walls.map((p) => p.base))].sort((a2, b2) => a2 - b2);
console.log(`\n${walls.length} walls  ${cols.length} column(s) ${JSON.stringify(cols)}  ${levels.length} level(s) ${JSON.stringify(levels)}`);
console.log('player y', f.pos.y, 'errors', errors.length);
await browser.close();
