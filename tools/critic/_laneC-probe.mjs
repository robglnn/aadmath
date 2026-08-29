#!/usr/bin/env node
/**
 * Where everything actually stands, and whether the field leg can fire.
 * lane C instrument. Reads facts off `window.__ascent`; changes nothing.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const a = window.__ascent;
  const d2 = (p, q) => Math.round(Math.hypot(p.x - q.x, p.z - q.z));
  const rifts = a.rifts.list.map((r) => ({ id: r.id, x: +(r.foot || r.pos).x.toFixed(1), z: +(r.foot || r.pos).z.toFixed(1), locked: r.locked }));
  const marks = (a.errand?.marks || []).map((m) => ({ id: m.id, x: +m.x.toFixed(1), z: +m.z.toFixed(1), y: +m.y.toFixed(1), rung: m.rung, held: m.held }));
  const caches = (a.caches?.list || []).map((c) => ({ i: c.i, key: c.key, tier: c.tier, x: c.x, y: c.y, z: c.z, opened: c.opened }));
  const spans = (a.spans?.list || []).map((c) => ({ i: c.i, x: c.x, y: c.y, z: c.z, opened: c.opened }));
  // For every rift, the nearest mark, cache and span.
  const near = rifts.map((r) => {
    const nm = marks.map((m) => ({ id: m.id, rung: m.rung, d: d2(r, m) })).sort((p, q) => p.d - q.d)[0] || null;
    const nc = caches.map((c) => ({ i: c.i, d: d2(r, c) })).sort((p, q) => p.d - q.d)[0] || null;
    const ns = spans.map((c) => ({ i: c.i, d: d2(r, c) })).sort((p, q) => p.d - q.d)[0] || null;
    const rr = rifts.filter((o) => o.id !== r.id).map((o) => ({ id: o.id, d: d2(r, o) })).sort((p, q) => p.d - q.d)[0] || null;
    return { rift: r.id, locked: r.locked, mark: nm, cache: nc, span: ns, tear: rr };
  });
  return {
    player: { x: +a.player.pos.x.toFixed(1), z: +a.player.pos.z.toFixed(1) },
    rifts, marks, caches, spans, near,
    objective: a.objective(), kit: a.kit.state().held, motes: a.wallet.count(),
  };
});
console.log(JSON.stringify(out, null, 1));
console.log('errors:', errs.slice(0, 5));
await browser.close();
