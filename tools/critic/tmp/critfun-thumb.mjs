import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const out = [];
for (const [w,h] of [[414,896],[390,844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4788', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2600);
  await page.evaluate(async () => {
    const A = window.__ascent;
    for (let i = 0; i < 40; i++) {
      try { A.panel.close(); } catch {}
      const t = A.nextObjective(); if (!t) break;
      if (!A.openRiftById(t.id)) continue;
      await new Promise(r => setTimeout(r, 25));
      if (!A.panel.open) continue;
      A.enter(A.panel.item.answer);
      await new Promise(r => setTimeout(r, 40));
    }
    try { A.panel.close(); } catch {}
    A.kit.sync();
  });
  await page.waitForTimeout(30000);
  // make Marlow talk, the way the game does constantly
  await page.evaluate(() => window.__ascent.hud.say?.(window.__ascent.t('marlow.nearMastery')));
  await page.waitForTimeout(800);
  const probe = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.kit-chip')].filter(e => e.style.display !== 'none');
    return chips.map(e => {
      const r = e.getBoundingClientRect();
      const cx = r.x + r.width/2, cy = r.y + r.height/2;
      const hit = document.elementFromPoint(cx, cy);
      return {
        id: e.dataset.id, rect: [r.x|0, r.y|0, r.width|0, r.height|0],
        onScreen: r.bottom <= innerHeight && r.right <= innerWidth && r.top >= 0,
        hitIsChip: !!(hit && (hit === e || e.contains(hit))),
        hitClass: hit ? (hit.className?.toString().slice(0,40) || hit.tagName) : null,
        opacity: getComputedStyle(e).opacity,
        parentOpacity: getComputedStyle(e.parentElement).opacity,
      };
    });
  });
  await page.screenshot({ path: `shots/critfun-quiet/${w}-thumb.png` });
  out.push({ view: `${w}x${h}`, probe });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
