/** Relative cost of each pass, measured back-to-back in one session. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: Number(arg('dpr', 2)) });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 200)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const a = window.__ascent, sd = a.world.sunDir;
  a.player.pos.set(-18, 0, 30); a.player.vel.set(0, 0, 0);
  a.player.yaw = Math.atan2(sd.x, sd.z); a.player.pitch = 0.19;
  a.fx.pinScale(1);
});

const ms = async (label, setup) => {
  if (setup) await page.evaluate(setup);
  await page.waitForTimeout(900);
  const r = await page.evaluate(async () => {
    window.__ascent.fx.pinScale(1);
    const ts = []; let last = performance.now();
    await new Promise((res) => { let n = 0; const s = () => { const t = performance.now(); ts.push(t - last); last = t; if (++n < 150) requestAnimationFrame(s); else res(); }; requestAnimationFrame(s); });
    const s = ts.slice(30).sort((x, y) => x - y);
    return { ms: +s[s.length >> 1].toFixed(2), dpr: +window.__ascent.engine.renderer.getPixelRatio().toFixed(2) };
  });
  console.log(label.padEnd(32), r.ms, 'ms/frame   dpr', r.dpr);
  return r.ms;
};

const base = await ms('everything on');
await ms('- shafts', () => { const p = window.__ascent.fx.passes; p.shafts.allowed = false; p.shafts.enabled = false; });
await ms('- shafts - sun', () => { const p = window.__ascent.fx.passes; p.sun.allowed = false; p.sun.enabled = false; });
await ms('- shafts - sun - bloom', () => { window.__ascent.fx.passes.bloom.enabled = false; });
await ms('- all above - fxaa', () => { window.__ascent.fx.passes.fxaa.enabled = false; });
await ms('scene only (post off)', () => {
  const a = window.__ascent; a.engine.postFX = null;
  a.engine.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  a.engine.renderer.setSize(innerWidth, innerHeight, false);
});
console.log('baseline was', base, 'ms');
await browser.close();
