/** Layout + overlap + fps sweep across the four required viewports and 3 locales. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = 'http://127.0.0.1:4791';
const OUT = 'shots/crit-layout';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });

const CLIP = () => {
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (el.children.length === 0 && el.textContent.trim()) {
      const okX = ['auto', 'scroll'].includes(cs.overflowX);
      const okY = ['auto', 'scroll'].includes(cs.overflowY);
      if (el.scrollWidth > el.clientWidth + 2 && !okX) bad.push(`clipX ${el.className || el.tagName} "${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
      if (el.scrollHeight > el.clientHeight + 4 && !okY) bad.push(`clipY ${el.className || el.tagName} "${el.textContent.trim().slice(0, 40)}" ${el.scrollHeight}>${el.clientHeight}`);
      if (r.right > innerWidth + 2 || r.left < -2) bad.push(`offscreen ${el.className || el.tagName} "${el.textContent.trim().slice(0, 40)}" [${Math.round(r.left)},${Math.round(r.right)}] vw=${innerWidth}`);
    }
  }
  return [...new Set(bad)];
};

const OVERLAP = () => {
  const pick = (sel) => [...document.querySelectorAll(sel)].filter((e) => {
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 4 && r.height > 4;
  });
  const rect = (e) => { const r = e.getBoundingClientRect(); return { cls: e.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const hits = [];
  const bands = pick('.ses-band');
  const others = pick('.hud-report-btn, .hud-progress, [class*="report"], [class*="rank"], .hud-integrity, .hud-quest, .q-card');
  for (const a of bands) for (const o of others) {
    const A = a.getBoundingClientRect(); const B = o.getBoundingClientRect();
    const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
    const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (ox > 2 && oy > 2) hits.push({ a: rect(a), o: rect(o), ox: Math.round(ox), oy: Math.round(oy) });
  }
  return { band: bands.map(rect), others: others.map(rect), hits };
};

for (const [W, H] of [[1280, 720], [1600, 900], [414, 896], [390, 844]]) {
  for (const loc of ['en', 'es', 'pl']) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: W < 700, isMobile: W < 700 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__ascent);
    await p.evaluate((l) => { window.__ascent.session.reset(); localStorage.removeItem('ascent.save'); localStorage.setItem('ascent.locale', l); }, loc);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__ascent);
    await p.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const tag = `${W}x${H}-${loc}`;
    const out = [];
    await p.screenshot({ path: `${OUT}/${tag}-orders.png` });
    out.push(['orders', await p.evaluate(CLIP)]);
    await p.locator('.sc-go').click();
    await p.waitForTimeout(600);
    // work phase: band + hud together
    const seam = 'var-meaning';
    await p.evaluate((id) => window.__ascent.teleportTo(id), seam);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${tag}-band.png` });
    const ov = await p.evaluate(OVERLAP);
    out.push(['band', await p.evaluate(CLIP)]);
    // rift
    await p.evaluate((id) => window.__ascent.openRiftById(id), seam);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/${tag}-rift.png` });
    out.push(['rift', await p.evaluate(CLIP)]);
    await p.evaluate(() => window.__ascent.panel.demo('wrong'));
    await p.waitForTimeout(1400);
    await p.screenshot({ path: `${OUT}/${tag}-echo.png` });
    out.push(['echo', await p.evaluate(CLIP)]);
    await p.evaluate(() => window.__ascent.panel.close());
    await p.waitForTimeout(400);
    await p.evaluate(() => window.__ascent.session.skipToClose());
    await p.waitForTimeout(1400);
    await p.screenshot({ path: `${OUT}/${tag}-close.png` });
    out.push(['close', await p.evaluate(CLIP)]);
    await p.locator('.ses-close .sx-rest').click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${tag}-rest.png` });
    out.push(['rest', await p.evaluate(CLIP)]);
    const clips = out.filter(([, v]) => v.length);
    console.log(`\n${tag}  band-overlap-hits=${ov.hits.length}  clip-beats=${clips.length}  errors=${errs.length}`);
    if (ov.hits.length) console.log('  OVERLAP ' + JSON.stringify(ov.hits));
    if (ov.band.length) console.log('  band box ' + JSON.stringify(ov.band) + '  others ' + JSON.stringify(ov.others.map((o) => o.cls + '@' + o.y)));
    for (const [beat, v] of clips) console.log(`  ${beat}: ` + v.slice(0, 5).join(' | '));
    if (errs.length) console.log('  ERR ' + errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
}
await b.close();
