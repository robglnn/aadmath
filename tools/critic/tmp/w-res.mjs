import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = 'http://127.0.0.1:4789';
const OUT = '/tmp/critic-w/res';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const sizes = [[1280,720,1],[1600,900,2],[414,896,3],[390,844,3]];
for (const [w,h,dsf] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR '+e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${w}x${h}-world.png` });
  // open a rift
  await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${w}x${h}-rift.png` });
  const overflow = await page.evaluate(() => {
    const bad = [];
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1.5 || r.left < -1.5 || r.bottom > vh + 1.5 || r.top < -1.5) {
        bad.push({ sel: el.className || el.tagName, r: [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)], txt: (el.textContent||'').slice(0,40) });
      }
      // clipped text: scrollWidth beyond clientWidth with hidden overflow
      if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2 && el.children.length === 0 && (el.textContent||'').trim()) {
        bad.push({ sel: 'CLIP ' + (el.className || el.tagName), sw: el.scrollWidth, cw: el.clientWidth, txt: (el.textContent||'').slice(0,40) });
      }
    }
    return bad.slice(0, 25);
  });
  const katex = await page.evaluate(() => ({
    err: document.querySelectorAll('.katex-error').length,
    mathml: document.querySelectorAll('.katex').length,
    rawTex: [...document.querySelectorAll('body *')].filter(e => e.children.length===0 && /\\\\[a-zA-Z]+|\$\$/.test(e.textContent||'')).length,
  }));
  console.log(`${w}x${h}`, 'errors', errs.length, 'overflow', overflow.length, JSON.stringify(overflow.slice(0,6)), 'katex', JSON.stringify(katex));
  if (errs.length) console.log('  ERRS', errs.slice(0,3));
  await ctx.close();
}
await browser.close();
