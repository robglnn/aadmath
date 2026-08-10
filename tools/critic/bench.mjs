/**
 * Honest frame benchmark: one page, one GPU, a scripted play loop.
 * Reports median ms, p95 ms, implied median fps and the 1% low.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 160)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

await page.evaluate(() => {
  window.__frames = [];
  const push = () => { window.__frames.push(performance.now()); requestAnimationFrame(push); };
  requestAnimationFrame(push);
});

const spots = [
  ['plaza',  () => { const a = window.__ascent; a.player.pos.set(0, (a.player.groundAt(0, 26) ?? 12) + 0.4, 26); a.player.vel.set(0,0,0); a.player.yaw = Math.PI; a.player.pitch = -0.14; }],
  ['sunward',() => { const a = window.__ascent, s = a.world.sunDir; a.player.pos.set(-18, (a.player.groundAt(-18,30) ?? 12) + 0.4, 30); a.player.vel.set(0,0,0); a.player.yaw = Math.atan2(s.x, s.z); a.player.pitch = 0.12; }],
  ['vista',  () => { const a = window.__ascent; a.player.pos.set(0, 62, 120); a.player.vel.set(0,0,0); a.player.yaw = Math.PI; a.player.pitch = -0.30; }],
  ['grove',  () => { const a = window.__ascent; a.player.pos.set(40, (a.player.groundAt(40,-30) ?? 12) + 0.4, -30); a.player.vel.set(0,0,0); a.player.yaw = 0.9; a.player.pitch = -0.05; }],
];

const rows = [];
for (const [name, fn] of spots) {
  await page.evaluate(fn);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__frames.length = 0; });
  // sprint on the spot so grass/dust/animation are all live
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(2600);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  const r = await page.evaluate(() => {
    const f = window.__frames; const d = [];
    for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
    d.sort((a, b) => a - b);
    const q = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
    return { n: d.length, med: q(0.5), p95: q(0.95), p99: q(0.99), scale: window.__ascent.fx.renderScale, dpr: window.__ascent.engine.renderer.getPixelRatio() };
  });
  rows.push([name, r]);
  console.log(name.padEnd(9),
    'median', r.med.toFixed(2) + 'ms', '=', (1000 / r.med).toFixed(1) + 'fps  ',
    'p95', r.p95.toFixed(1) + 'ms  ',
    '1%low', (1000 / r.p99).toFixed(1) + 'fps  ',
    'scale', r.scale.toFixed(2), 'dpr', r.dpr.toFixed(2));
}
const all = rows.map(([, r]) => r.med);
console.log('\nMEDIAN ACROSS SPOTS:', (all.reduce((a, b) => a + b) / all.length).toFixed(2) + 'ms',
  '=', (1000 / (all.reduce((a, b) => a + b) / all.length)).toFixed(1) + 'fps');
await browser.close();
