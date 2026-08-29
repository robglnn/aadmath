/** Why does only one waygate get placed? Replay the siteFor filter, leg by leg. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(arg('url', 'http://127.0.0.1:4802'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const a = window.__ascent, W = a.world;
  const LEG_MIN = 34, CLEAR = 30, ALONG = 0.56;
  const list = a.rifts.list.map((r) => ({ id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z }));
  const nodes = a.content().nodes;
  const graph = a.rifts.list.map((r) => r.id);
  const legs = [];
  for (const id of graph) { const b = list.find((q) => q.id === id); if (b) legs.push({ id: `plaza>${id}`, a: { x: 0, z: 0 }, b }); }
  for (const r of list) for (const s of list) if (r.id !== s.id) legs.push({ id: `${r.id}>${s.id}`, a: r, b: s });
  legs.sort((p, q) => Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) - Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z));
  const why = {};
  const bump = (k) => { why[k] = (why[k] || 0) + 1; };
  const seen = [];
  const placed = [];
  for (const leg of legs) {
    const r = W.routeFrom(leg.a.x, leg.a.z, leg.b.x, leg.b.z);
    if (!r) { bump('no route'); continue; }
    if (r.metres < LEG_MIN) { bump('leg under 34 m'); continue; }
    if (r.cells.length < 6) { bump('under 6 cells'); continue; }
    let want = r.metres * ALONG, run = 0, idx = 1;
    for (; idx < r.cells.length; idx++) { run += Math.hypot(r.cells[idx][0]-r.cells[idx-1][0], r.cells[idx][2]-r.cells[idx-1][2]); if (run >= want) break; }
    idx = Math.min(r.cells.length - 2, Math.max(1, idx));
    let best = null; const reasons = {};
    for (let k = -7; k <= 7; k++) {
      const j = Math.min(r.cells.length - 2, Math.max(1, idx + k));
      const c = r.cells[j];
      const x = c[0], z = c[2];
      const h = a.islandAt(x, z);
      if (h === null) { reasons.offisland = 1; continue; }
      let worst = 0;
      for (let d = 0; d < 8; d++) { const a2 = (d/8)*Math.PI*2; const hh = a.islandAt(x+Math.cos(a2)*7, z+Math.sin(a2)*7);
        if (hh === null) { worst = 99; break; } worst = Math.max(worst, Math.abs(hh - h)); }
      if (worst > 7.6) { reasons.notflat = (reasons.notflat||0)+1; continue; }
      if (Math.hypot(x, z) < 52) { reasons.inlandingframe = (reasons.inlandingframe||0)+1; continue; }
      if (a.rifts.list.some((rr) => { const rx = rr.foot?rr.foot.x:rr.pos.x, rz = rr.foot?rr.foot.z:rr.pos.z; return Math.hypot(x-rx, z-rz) < 26; })) { reasons.neartear = (reasons.neartear||0)+1; continue; }
      if (!best || worst < best.worst) best = { x, z, worst };
    }
    if (!best) { bump('no site: ' + Object.keys(reasons).join('+')); continue; }
    if (seen.some((q) => Math.hypot(q.x - best.x, q.z - best.z) < CLEAR)) { bump('too close to another gate'); continue; }
    seen.push(best); placed.push({ leg: leg.id, x: +best.x.toFixed(0), z: +best.z.toFixed(0) });
  }
  return { legs: legs.length, why, placed };
});
console.log(`legs ${out.legs}, placed ${out.placed.length}`);
console.log(JSON.stringify(out.why, null, 1));
console.log(out.placed.map(p => `${p.leg}@${p.x},${p.z}`).join('  '));
await browser.close();
