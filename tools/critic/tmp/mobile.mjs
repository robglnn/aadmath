import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = process.argv[2] || 'http://127.0.0.1:4877';
await mkdir('shots/critic-mobile', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const errs = [];
for (const [w, h] of [[390, 844], [414, 896]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`${w}x${h} ${e.message}`));
  page.on('console', m => { if (m.type()==='error') errs.push(`${w}x${h} ${m.text()}`); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `shots/critic-mobile/${w}x${h}-world.png` });
  // open the learning surface
  await page.evaluate(() => window.__ascent.openRiftById('two-step'));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `shots/critic-mobile/${w}x${h}-rift.png` });
  // overflow check
  const of = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02) continue;
      if (r.right > innerWidth + 1 || r.left < -1) bad.push({ sel: el.className || el.tagName, l: Math.round(r.left), r: Math.round(r.right) });
      // clipped text: scrollWidth notably exceeds clientWidth with hidden overflow
      if (cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 4 && el.children.length === 0 && (el.textContent||'').trim())
        bad.push({ sel: 'CLIPTEXT ' + (el.className||el.tagName), sw: el.scrollWidth, cw: el.clientWidth, txt: (el.textContent||'').slice(0,50) });
      if (cs.overflow !== 'visible' && el.scrollHeight > el.clientHeight + 4 && el.children.length === 0 && (el.textContent||'').trim())
        bad.push({ sel: 'CLIPTEXT-V ' + (el.className||el.tagName), sh: el.scrollHeight, ch: el.clientHeight, txt: (el.textContent||'').slice(0,50) });
    }
    return { bad: bad.slice(0, 25), docW: document.documentElement.scrollWidth, innerW: innerWidth };
  });
  console.log(`${w}x${h}: docScrollWidth ${of.docW} vs ${of.innerW};  issues ${of.bad.length}`);
  of.bad.forEach(b => console.log('   ', JSON.stringify(b)));
  await ctx.close();
}
console.log('errors:', errs.length, errs.slice(0,6));
await browser.close();
