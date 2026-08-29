/** How much of the walk between two tears is a composed place, and where the gaps are. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const a = window.__ascent, W = a.world;
  const sites = [];
  const add = (x, z, r, kind) => { if (Number.isFinite(x) && Number.isFinite(z)) sites.push({ x, z, r, kind }); };
  add(0, 0, 45, 'plaza');
  for (const r of (a.rifts?.list || [])) add(r.foot ? r.foot.x : r.pos.x, r.foot ? r.foot.z : r.pos.z, 18, 'rift');
  for (const g of (a.waygates?.list || [])) add(g.x, g.z, 18, 'waygate');
  for (const c of (a.caches?.list || [])) add(c.x ?? c.pos?.x, c.z ?? c.pos?.z, 20, 'cache');
  for (const s of (a.spans?.list || [])) add(s.x ?? s.pos?.x, s.z ?? s.pos?.z, 20, 'span');
  for (const w of (a.wardens?.list || [])) add(w.x ?? w.pos?.x, w.z ?? w.pos?.z, 18, 'warden');
  for (const [k, l] of Object.entries(a.world?.landmarks || {})) {
    const p = l?.group?.position || l?.position; if (p) add(p.x, p.z, 22, 'landmark:' + k);
  }
  const list = a.rifts.list.map((r) => ({ id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z }));
  const graph = a.content().nodes;
  const legs = [];
  for (const n of graph) {
    const b = list.find((q) => q.id === n.id); if (!b) continue;
    legs.push({ id: `plaza>${n.id}`, a: { x: 0, z: 0 }, b });
  }
  for (const r of list) for (const s of list) if (r.id !== s.id) legs.push({ id: `${r.id}>${s.id}`, a: r, b: s });
  const rows = [];
  for (const leg of legs) {
    const r = W.routeFrom(leg.a.x, leg.a.z, leg.b.x, leg.b.z);
    if (!r) { rows.push({ id: leg.id, none: true }); continue; }
    let m = 0, inSite = 0, run = 0, worst = 0, at = null;
    for (let i = 1; i < r.cells.length; i++) {
      const [x0, , z0] = r.cells[i - 1], [x1, , z1] = r.cells[i];
      const L = Math.hypot(x1 - x0, z1 - z0);
      m += L;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const hit = sites.some((s) => Math.hypot(mx - s.x, mz - s.z) <= s.r);
      if (hit) { inSite += L; run = 0; }
      else { run += L; if (run > worst) { worst = run; at = [+mx.toFixed(0), +mz.toFixed(0)]; } }
    }
    rows.push({ id: leg.id, m: +m.toFixed(0), inSite: +inSite.toFixed(0), share: +(inSite / Math.max(1, m)).toFixed(2), worst: +worst.toFixed(0), at });
  }
  const kinds = {};
  for (const s of sites) kinds[s.kind.split(':')[0]] = (kinds[s.kind.split(':')[0]] || 0) + 1;
  return { sites: sites.length, kinds, rows, siteList: sites.map((s) => `${s.kind}@${s.x.toFixed(0)},${s.z.toFixed(0)}`) };
});
console.log(`sites: ${out.sites}`, JSON.stringify(out.kinds));
console.log(out.siteList.join('  '));
const rows = out.rows.filter((r) => !r.none).sort((a, b) => b.worst - a.worst);
console.log(`\n${rows.length} legs. worst unbroken uncomposed stretch, longest first:`);
for (const r of rows.slice(0, 16)) console.log(`  ${r.id.padEnd(28)} ${String(r.m).padStart(4)} m route, ${String(Math.round(r.share*100)).padStart(3)}% inside a place, worst gap ${String(r.worst).padStart(4)} m at ${(r.at||[]).join(',')}`);
const w = rows.map((r) => r.worst).sort((a, b) => a - b);
console.log(`\ngap over ${rows.length} legs: median ${w[w.length>>1]} m, p90 ${w[Math.floor(w.length*0.9)]} m, max ${w[w.length-1]} m`);
const sh = rows.map((r) => r.share).sort((a, b) => a - b);
console.log(`share inside a composed place: median ${(sh[sh.length>>1]*100).toFixed(0)}%, worst ${(sh[0]*100).toFixed(0)}%`);
await browser.close();
