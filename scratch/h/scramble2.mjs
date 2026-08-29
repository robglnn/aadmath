import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2000);
for (const [x, z] of [[40.8, -103.1], [42.9, -77.1], [42, -112]]) {
  const st = await page.evaluate(([x, z]) => {
    const a = window.__ascent, W = a.world;
    const h = a.islandAt(x, z);
    if (h === null) return null;
    a.player.pos.set(x, h + 0.4, z); a.player.vel.set(0, 0, 0);
    const w = W.wayOut(x, z);
    if (w) a.player.yaw = w.yaw;
    // local relief in the wayOut direction
    const prof = [];
    for (let d = 0; d <= 16; d += 2) prof.push(+(a.islandAt(x + Math.sin(w.yaw) * d, z + Math.cos(w.yaw) * d) ?? NaN).toFixed(1));
    return { h, esc: W.escapable(x, z), way: w, prof };
  }, [x, z]);
  if (!st) { console.log(x, z, 'off island'); continue; }
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW');
  const rows = [];
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    rows.push(await page.evaluate(() => {
      const a = window.__ascent, p = a.player.pos, L = a.player.loco;
      return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
        scr: !!L.scrambling, gnd: !!L.grounded, st: L.state, spd: +L.speed.toFixed(1),
        esc: a.world.escapable(p.x, p.z), stuck: !!a.player.stuck, rec: a.player.recoveries };
    }));
  }
  await page.keyboard.up('KeyW');
  console.log(`\n${x},${z} h=${st.h.toFixed(1)} esc=${st.esc} wayOut=${st.way.metres.toFixed(0)}m yaw=${st.way.yaw.toFixed(2)}`);
  console.log('  profile along wayOut (0..16m):', st.prof.join(' '));
  for (let i = 0; i < rows.length; i += 3) console.log('  ', JSON.stringify(rows[i]));
}
await browser.close();
