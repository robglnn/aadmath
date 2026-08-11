import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4831');
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [W, H] of [[1280, 720], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 700, isMobile: W < 700 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__ascent);
  await p.evaluate(() => { window.__ascent.session.reset(); window.__ascent.story.reset(); localStorage.removeItem('ascent.save'); });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__ascent);
  await p.waitForTimeout(1800);
  await p.evaluate(() => { window.__ascent.session.plan(); });
  await p.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.locator('.sc-go').click();
  await p.waitForTimeout(900);
  await p.evaluate(() => { window.__ascent.openRiftById('var-meaning'); });
  await p.waitForTimeout(2200);
  const r = await p.evaluate(() => {
    const band = document.querySelector('.ses-band');
    const cs = getComputedStyle(band);
    const q = band.getBoundingClientRect();
    const head = document.querySelector('.rift .rf-head') || document.querySelector('.rift header');
    return { op: cs.opacity, band: [q.left, q.top, q.right, q.bottom].map(Math.round),
      head: head ? [head.getBoundingClientRect().left, head.getBoundingClientRect().top, head.getBoundingClientRect().right, head.getBoundingClientRect().bottom].map(Math.round) : null };
  });
  console.log(W + 'x' + H, JSON.stringify(r));
  await p.screenshot({ path: `shots/bandtear-${W}x${H}.png` });
  await ctx.close();
}
await b.close();
