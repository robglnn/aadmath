import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage();
await p.goto(arg('url', 'http://127.0.0.1:4971'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(() => {
  const a = window.__ascent;
  const marks = a.errand.marks.map((m) => ({ id: m.id, x: Math.round(m.x), z: Math.round(m.z), ground: Math.round(m.ground), y: Math.round(m.y), lift: m.lift }));
  const cols = a.drift.columns.map((c) => ({ x: Math.round(c.x), z: Math.round(c.z), y0: Math.round(c.y0), top: Math.round(c.top), r: c.r, earned: c.earned }));
  // For each mark: the nearest column, and the height it can carry you to.
  for (const m of marks) {
    let best = null, bd = 1e9;
    for (const c of cols) { const d = Math.hypot(c.x - m.x, c.z - m.z); if (d < bd) { bd = d; best = c; } }
    m.nearestColumn = best ? { d: Math.round(bd), top: best.top } : null;
    // How high the ground gets within 90 m — a glide start point
    let hi = -1e9;
    for (let a2 = 0; a2 < 6.28; a2 += 0.35) for (let r = 20; r <= 90; r += 10) {
      const h = a.islandAt(m.x + Math.cos(a2) * r, m.z + Math.sin(a2) * r);
      if (h !== null && h > hi) hi = h;
    }
    m.highGroundWithin90 = Math.round(hi);
  }
  return { marks, columns: cols, spawn: { x: Math.round(a.player.pos.x), z: Math.round(a.player.pos.z), y: Math.round(a.player.pos.y) } };
}), null, 1));
await b.close();
