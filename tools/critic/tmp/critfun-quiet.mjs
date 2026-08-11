/** The settled game, after every celebration has drained: four viewports, real audit. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = 'http://127.0.0.1:4788';
const OUT = 'shots/critfun-quiet';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const errors = [];
const res = [];

for (const [w, h] of [[1280, 720], [1600, 900], [414, 896], [390, 844]]) {
  const mob = w < 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  await page.evaluate(async () => {
    const A = window.__ascent;
    for (let i = 0; i < 130; i++) {
      try { A.panel.close(); } catch { /* */ }
      const task = A.nextObjective();
      if (!task) break;
      if (!A.openRiftById(task.id)) continue;
      await new Promise((r) => setTimeout(r, 30));
      if (!A.panel.open) continue;
      A.enter(A.panel.item.answer);
      await new Promise((r) => setTimeout(r, 50));
    }
    try { A.panel.close(); } catch { /* */ }
    A.kit.sync();
  });
  // every queued grant toast is 6.2 s apart and the rite runs 5.2 s: drain it all
  await page.waitForTimeout(120000);
  await page.evaluate(() => {
    const A = window.__ascent;
    A.player.pos.set(0, (A.islandAt(0, 40) ?? 10) + 1.4, 40);
    A.player.vel.set(0, 0, 0); A.player.yaw = 0; A.player.pitch = -0.02;
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${w}x${h}-settled.png` });

  const audit = await page.evaluate(() => {
    const bad = [];
    const nodes = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.15) return false;
      if (el.closest('#boot')) return false;
      const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const r = el.getBoundingClientRect();
      return txt && r.width > 4 && r.height > 4;
    });
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1) {
        bad.push({ kind: 'offscreen', cls: el.className?.toString().slice(0, 30), t: el.textContent.trim().slice(0, 34), r: [r.x | 0, r.y | 0, r.width | 0, r.height | 0] });
      }
      if (el.scrollWidth > el.clientWidth + 2) bad.push({ kind: 'clipped', cls: el.className?.toString().slice(0, 30), t: el.textContent.trim().slice(0, 34), sw: el.scrollWidth, cw: el.clientWidth });
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.contains(b) || b.contains(a) || a === document.body || b === document.body) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 4 && oy > 4) bad.push({ kind: 'overlap', a: a.className?.toString().slice(0, 24), at: a.textContent.trim().slice(0, 24), b: b.className?.toString().slice(0, 24), bt: b.textContent.trim().slice(0, 24) });
      }
    }
    return bad;
  });

  // the progress report, on the real launcher
  await page.click('.rp-launch');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${w}x${h}-report.png`, fullPage: false });
  const repAudit = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('.rp-sheet *, .rp-doc *, [class^="rp-"] *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || Number(cs.opacity) < 0.15) continue;
      const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!txt) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4) continue;
      if (el.scrollWidth > el.clientWidth + 2) bad.push({ kind: 'clipped', cls: el.className?.toString().slice(0, 30), t: el.textContent.trim().slice(0, 30) });
      if (r.right > innerWidth + 1 || r.left < -1) bad.push({ kind: 'offscreen', cls: el.className?.toString().slice(0, 30), t: el.textContent.trim().slice(0, 30), r: [r.x | 0, r.y | 0, r.width | 0, r.height | 0] });
    }
    return bad;
  });

  const st = await page.evaluate(() => ({ kit: window.__ascent.kit.state(), shards: window.__ascent.state().shards }));
  res.push({ view: `${w}x${h}`, st, audit, repAudit });
  await ctx.close();
}

console.log(JSON.stringify({ errors, res }, null, 1));
await browser.close();
