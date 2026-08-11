import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const out = [];
for (const [w,h] of [[390,844],[414,896],[1280,720]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: w<500, hasTouch: w<500 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4788', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2600);
  for (const loc of ['en','es','pl']) {
    const r = await page.evaluate(async (loc) => {
      const A = window.__ascent;
      A.setLocale(loc);
      let n = 0;
      for (const s of A.mastery.state.values()) { if (n++ < 10) { s.mastered = true; s.everMastered = true; s.pL = 0.97; } }
      A.kit.sync();
      await new Promise(r => setTimeout(r, 400));
      const chips = [...document.querySelectorAll('.kit-chip')].filter(e => e.style.display !== 'none');
      return chips.map(e => {
        const r = e.getBoundingClientRect();
        const inner = [...e.querySelectorAll('u,.full,.sh,em')].filter(s => getComputedStyle(s).display !== 'none').map(s => {
          const sr = s.getBoundingClientRect();
          return { cls: s.className || s.tagName, text: s.textContent, over: s.scrollWidth > s.clientWidth + 1,
                   spillsRight: +(sr.right - r.right).toFixed(1), spillsBottom: +(sr.bottom - r.bottom).toFixed(1) };
        });
        return { id: e.dataset.id, right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1), vw: innerWidth, vh: innerHeight, inner };
      });
    }, loc);
    out.push({ view: `${w}x${h}`, loc, chips: r });
  }
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
