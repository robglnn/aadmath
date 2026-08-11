/**
 * "Come back to a sealed rift" probe. Fresh save, real walking, real E.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/afford3'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const shot = async (n, ms = 250) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); };
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(1200);

const AIM = (mode) => {
  const a = window.__ascent;
  const p = a.player.pos;
  let best = null, bd = 1e9;
  for (const r of a.rifts.list) {
    if (r.locked) continue;
    if (mode === 'unsealed' && r.mastered) continue;
    if (mode === 'sealed' && !r.mastered) continue;
    const d = Math.hypot(p.x - r.foot.x, p.z - r.foot.z);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best) return null;
  const cam = a.camera;
  const f = new a.THREE.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize();
  const v = new a.THREE.Vector3(best.foot.x - p.x, 0, best.foot.z - p.z).normalize();
  const ang = Math.atan2(f.x * v.z - f.z * v.x, f.dot(v));
  return { d: bd, id: best.id, bearing: -ang / Math.PI };
};

async function walk(mode, stopAt = 4, seconds = 60, away = false) {
  const t0 = Date.now();
  await page.keyboard.down(away ? 'KeyS' : 'KeyW');
  while (Date.now() - t0 < seconds * 1000) {
    const r = await page.evaluate(AIM, mode);
    if (!r) break;
    if (away ? r.d > stopAt : r.d < stopAt) break;
    if (!away) {
      const dx = Math.max(-300, Math.min(300, r.bearing * 300));
      if (Math.abs(dx) > 3) await page.mouse.move(W / 2 + dx, H / 2, { steps: 2 });
    }
    await page.waitForTimeout(110);
  }
  await page.keyboard.up(away ? 'KeyS' : 'KeyW');
  await page.waitForTimeout(250);
}

const probe = () => page.evaluate(() => {
  const a = window.__ascent;
  const p = a.player.pos;
  const rows = a.rifts.list.map(r => ({ id: r.id, locked: r.locked, mastered: r.mastered, d: +Math.hypot(p.x - r.foot.x, p.z - r.foot.z).toFixed(1) })).sort((x, y) => x.d - y.d);
  return {
    panel: a.panel.open,
    nearest: rows[0],
    nearestE: (() => { const n = a.rifts.nearest(p); return n ? n.id : null; })(),
    prompt: !!document.querySelector('.gd-prompt.show'),
    promptText: document.querySelector('.gd-prompt')?.textContent || '',
    mark: !!document.querySelector('.gd-mark.show'),
    tags: [...document.querySelectorAll('.bk-tag')].filter(e => e.style.display !== 'none').map(e => e.textContent),
    obj: a.story?.guideState?.() || null,
  };
});

await walk('unsealed', 4, 60);
console.log('1 ARRIVED', JSON.stringify(await probe()));
await shot('01-arrived');

// seal it: answer correctly until mastered or 30 answers
for (let i = 0; i < 40; i++) {
  const open = await page.evaluate(() => window.__ascent.panel.open);
  if (!open) {
    // nudge: press E to reopen
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    if (!await page.evaluate(() => window.__ascent.panel.open)) break;
  }
  await page.evaluate(() => { const a = window.__ascent; a.enter(a.panel.item.answer); });
  await page.waitForTimeout(700);
  const done = await page.evaluate(() => {
    const a = window.__ascent;
    return a.rifts.list.some(r => r.mastered);
  });
  if (done) break;
}
await page.waitForTimeout(1500);
// close the panel
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
console.log('2 SEALED', JSON.stringify(await probe()));
await shot('02-sealed');

// walk away
await walk('sealed', 40, 40, true);
await page.waitForTimeout(400);
console.log('3 AWAY', JSON.stringify(await probe()));
await shot('03-away');

// walk back
await walk('sealed', 4, 60);
console.log('4 BACK', JSON.stringify(await probe()));
await shot('04-back');
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
console.log('5 AFTER-E', JSON.stringify(await probe()));
await shot('05-after-E');
console.log('CONSOLE', logs.slice(0, 10));
await browser.close();
