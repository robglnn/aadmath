/** The same filter with a metre-based scan of the middle of the leg. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const NEAR = Number(arg('near', 22)), CLEAR = Number(arg('clear', 30)), LEGMIN = Number(arg('legmin', 30)), HOME = Number(arg('home', 52));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(arg('url', 'http://127.0.0.1:4802'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(([NEAR, CLEAR, LEGMIN, HOME]) => {
  const a = window.__ascent, W = a.world;
  const list = a.rifts.list.map((r) => ({ id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z }));
  const legs = [];
  for (const r of list) legs.push({ id: `plaza>${r.id}`, a: { x: 0, z: 0 }, b: r });
  for (const r of list) for (const s of list) if (r.id !== s.id) legs.push({ id: `${r.id}>${s.id}`, a: r, b: s });
  legs.sort((p, q) => Math.hypot(q.b.x - q.a.x, q.b.z - q.a.z) - Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z));
  const seen = []; const placed = []; const why = {}; const bump=(k)=>{why[k]=(why[k]||0)+1;};
  for (const leg of legs) {
    const r = W.routeFrom(leg.a.x, leg.a.z, leg.b.x, leg.b.z);
    if (!r || r.metres < LEGMIN || r.cells.length < 4) continue;
    // walk the route in metres and score every candidate in the middle of it
    let run = 0, best = null;
    for (let i = 1; i < r.cells.length; i++) {
      const c = r.cells[i - 1], n = r.cells[i];
      run += Math.hypot(n[0] - c[0], n[2] - c[2]);
      const u = run / r.metres;
      if (u < 0.3 || u > 0.75) continue;
      const x = c[0], z = c[2];
      const h = a.islandAt(x, z);
      if (h === null) { bump('off'); continue; }
      if (Math.hypot(x, z) < HOME) { bump('home'); continue; }
      if (list.some((rr) => Math.hypot(x - rr.x, z - rr.z) < NEAR)) { bump('neartear'); continue; }
      let worst = 0;
      for (let d = 0; d < 8; d++) { const a2 = (d / 8) * Math.PI * 2; const hh = a.islandAt(x + Math.cos(a2) * 7, z + Math.sin(a2) * 7);
        if (hh === null) { worst = 99; break; } worst = Math.max(worst, Math.abs(hh - h)); }
      if (worst > 7.6) { bump('notflat'); continue; }
      bump('ok');
      const score = worst + Math.abs(u - 0.55) * 12;
      if (!best || score < best.score) best = { x, z, y: h, worst, u, score };
    }
    if (!best) { bump('LEG-NONE'); continue; }
    if (seen.some((q) => Math.hypot(q.x - best.x, q.z - best.z) < CLEAR)) { bump('LEG-CROWDED'); continue; }
    seen.push(best); placed.push({ leg: leg.id, x: +best.x.toFixed(0), z: +best.z.toFixed(0), u: +best.u.toFixed(2), flat: +best.worst.toFixed(1) });
  }
  return { legs: legs.length, placed, why };
}, [NEAR, CLEAR, LEGMIN, HOME]);
console.log(`legs ${out.legs}, placed ${out.placed.length}`, JSON.stringify(out.why));
console.log(out.placed.map(p => `${p.leg}@${p.x},${p.z}(u${p.u},f${p.flat})`).join('\n  '));
await browser.close();
