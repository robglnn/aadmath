/** COHERENCE: is the foundry in the way at boot, and what covers the middle of the glass? */
import { chromium } from 'playwright';
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4917';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);
const info = await page.evaluate(() => {
  const out = {};
  const els = [...document.querySelectorAll('.fdy, .fdy-row, .mnu, .ses-rest, .ses-close, .ses-charter')];
  out.nodes = els.map((e) => {
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    return { cls: e.className, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      display: c.display, visibility: c.visibility, opacity: c.opacity, pointerEvents: c.pointerEvents, zIndex: c.zIndex, position: c.position };
  });
  // what is on top at nine points of the glass
  out.hits = [];
  for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.35], [0.5, 0.65], [0.25, 0.5], [0.75, 0.5], [0.5, 0.2], [0.5, 0.8], [0.47, 0.51], [0.53, 0.51]]) {
    const x = Math.round(innerWidth * fx), y = Math.round(innerHeight * fy);
    const e = document.elementFromPoint(x, y);
    out.hits.push({ at: [x, y], el: e ? (e.className || e.tagName) : null,
      chain: e ? (() => { const c = []; let n = e; while (n && c.length < 5) { c.push(n.className || n.tagName); n = n.parentElement; } return c; })() : null });
  }
  out.uiOpen = !!window.__ascent.input.uiOpen;
  out.menuOpen = !!window.__ascent.menu?.open;
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
