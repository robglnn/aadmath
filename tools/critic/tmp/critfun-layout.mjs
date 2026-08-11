/** Layout probe: kit strip + comms + rift + progress at four viewports, with a DOM overlap audit. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4788';
const OUT = 'shots/critfun-layout';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const VIEWS = [[1280, 720], [1600, 900], [414, 896], [390, 844]];
const errors = [];
const audits = [];

for (const [w, h] of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  // play a stretch of the real loop so grants land and the strip fills
  await page.evaluate(async () => {
    const A = window.__ascent;
    for (let i = 0; i < 70; i++) {
      try { A.panel.close(); } catch { /* */ }
      const task = A.nextObjective();
      if (!task) break;
      if (!A.openRiftById(task.id)) continue;
      await new Promise((r) => setTimeout(r, 40));
      if (!A.panel.open) continue;
      A.enter(A.panel.item.answer);
      await new Promise((r) => setTimeout(r, 60));
    }
    try { A.panel.close(); } catch { /* */ }
    A.kit.sync();
  });
  await page.waitForTimeout(900);

  // a companion line talking at the same moment as the kit strip
  await page.evaluate(() => window.__ascent.hud.say?.(window.__ascent.t('marlow.nearMastery')));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${w}x${h}-world.png` });

  const kit = await page.evaluate(() => window.__ascent.kit.state());
  const shards = await page.evaluate(() => window.__ascent.state().shards);

  // the DOM overlap audit: visible text boxes that intersect or spill the viewport
  const audit = await page.evaluate(() => {
    const bad = [];
    const nodes = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.06) return false;
      const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!txt) return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    });
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1) {
        bad.push({ kind: 'offscreen', cls: el.className?.toString().slice(0, 40), text: el.textContent.trim().slice(0, 40), r: [r.x | 0, r.y | 0, r.width | 0, r.height | 0] });
      }
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflowX !== 'scroll') {
        bad.push({ kind: 'clipped', cls: el.className?.toString().slice(0, 40), text: el.textContent.trim().slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 6 && oy > 6) {
          bad.push({
            kind: 'overlap', area: (ox * oy) | 0,
            a: a.className?.toString().slice(0, 30), at: a.textContent.trim().slice(0, 28),
            b: b.className?.toString().slice(0, 30), bt: b.textContent.trim().slice(0, 28),
          });
        }
      }
    }
    return bad;
  });

  // the rift on this viewport
  await page.evaluate(() => window.__ascent.openRiftById('two-step'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${w}x${h}-rift.png` });
  const riftAudit = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('.rift *, .rf-inner *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) {
        bad.push({ cls: el.className?.toString().slice(0, 36), text: el.textContent.trim().slice(0, 30), r: [r.x | 0, r.y | 0, r.width | 0, r.height | 0] });
      }
    }
    return bad;
  });
  await page.evaluate(() => window.__ascent.panel.close());
  await page.waitForTimeout(300);

  // the progress report
  await page.evaluate(() => document.querySelector('.hud-report, [data-open="report"], .progress-btn, .rep-open')?.click());
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${w}x${h}-progress.png` });

  audits.push({ view: `${w}x${h}`, kit, shards, audit, riftAudit });
  await ctx.close();
}

console.log(JSON.stringify({ errors, audits }, null, 1));
await browser.close();
