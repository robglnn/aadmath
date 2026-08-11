/**
 * Interact-affordance probe. Fresh save, REAL keyboard and mouse only.
 * Never calls teleportTo/openRiftById.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/afford2'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);

const shot = async (n, ms = 250) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };

// dismiss cold open / orders by clicking. Click in the world = pointer lock.
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(600);
// press Escape-free: try clicking any visible primary button
for (const sel of ['.ord-go', '.session-go', 'button.go', '.card button']) {
  const el = await page.$(sel);
  if (el && await el.isVisible()) { await el.click(); await page.waitForTimeout(400); }
}
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(800);
await shot('00-start');

const state = async () => page.evaluate(() => {
  const a = window.__ascent;
  const p = a.player.pos;
  const near = a.rifts.list.map(r => ({ id: r.id, locked: r.locked, mastered: r.mastered, d: Math.round(Math.hypot(p.x - r.foot.x, p.z - r.foot.z)) })).sort((x, y) => x.d - y.d);
  return {
    pos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)],
    guide: a.story?.state?.() || null,
    panel: a.panel.open,
    near: near.slice(0, 3),
    dom: {
      prompt: !!document.querySelector('.gd-prompt.show'),
      mark: !!document.querySelector('.gd-mark.show'),
      card: !!document.querySelector('.gd-card.show'),
      tags: [...document.querySelectorAll('.bk-tag')].filter(e => e.style.display !== 'none').map(e => e.textContent),
      hail: !!document.querySelector('.hail.plate'),
    },
  };
});

console.log('START', JSON.stringify(await state(), null, 1));

// Walk toward nearest open rift using real keys, steering by yaw.
async function walkTo(targetFn, seconds = 40) {
  const t0 = Date.now();
  await page.keyboard.down('KeyW');
  while (Date.now() - t0 < seconds * 1000) {
    const r = await page.evaluate(targetFn);
    if (!r) break;
    if (r.d < 5) break;
    // turn: mouse move proportional to bearing error
    const dx = Math.max(-260, Math.min(260, r.bearing * 260));
    if (Math.abs(dx) > 3) await page.mouse.move(W / 2 + dx, H / 2, { steps: 2 });
    await page.waitForTimeout(120);
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(200);
}

const AIM = () => {
  const a = window.__ascent;
  const p = a.player.pos;
  let best = null, bd = 1e9;
  for (const r of a.rifts.list) {
    if (r.locked) continue;
    const d = Math.hypot(p.x - r.foot.x, p.z - r.foot.z);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best) return null;
  const cam = a.camera;
  const f = new a.THREE.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize();
  const v = new a.THREE.Vector3(best.foot.x - p.x, 0, best.foot.z - p.z).normalize();
  const cross = f.x * v.z - f.z * v.x;      // >0 => target is to the left
  const dot = f.dot(v);
  const ang = Math.atan2(cross, dot);        // radians, + = left
  return { d: bd, id: best.id, bearing: -ang / Math.PI };
};

await walkTo(AIM, 45);
await shot('01-at-rift');
console.log('AT RIFT', JSON.stringify(await state(), null, 1));

// press E
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
await shot('02-after-E');
console.log('AFTER E', JSON.stringify(await state(), null, 1));

console.log('CONSOLE', logs.slice(0, 20));
await browser.close();
