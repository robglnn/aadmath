import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const a = window.__ascent, W = a.world;
  const r = a.rifts.list.find((x) => x.id === 'eval-expr') || a.rifts.list[1];
  const t = { x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z };
  const th = (315 / 180) * Math.PI;
  let x = t.x + Math.cos(th) * 78, z = t.z + Math.sin(th) * 78;
  const wasOneWay = !W.escapable(x, z);
  if (wasOneWay) {
    outer: for (let rr = 4; rr <= 40; rr += 4) for (let k = 0; k < 16; k++) {
      const q = (k / 16) * Math.PI * 2, cx = x + Math.cos(q) * rr, cz = z + Math.sin(q) * rr;
      if (a.islandAt(cx, cz) !== null && W.escapable(cx, cz)) { x = cx; z = cz; break outer; }
    }
  }
  const h = a.islandAt(x, z);
  a.player.pos.set(x, h + 0.4, z); a.player.vel.set(0, 0, 0);
  const rt = W.routeFrom(x, z, t.x, t.z);
  return { t, x, z, h, wasOneWay, esc: W.escapable(x, z), route: rt ? Math.round(rt.metres) : null,
    pts: rt ? rt.points.slice(0, 8).map((p) => [Math.round(p[0]), Math.round(p[2])]) : null };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(600);
for (let i = 0; i < 30; i++) {
  const f = await page.evaluate((t) => {
    const a = window.__ascent, W = a.world, p = a.player.pos;
    const h = W.headingTo(p.x, p.z, t.x, t.z);
    let e = ((h.yaw - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (e < -Math.PI) e += Math.PI * 2;
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), err: +e.toFixed(2),
      esc: W.escapable(p.x, p.z), escaping: !!h.escaping, d: +Math.hypot(t.x - p.x, t.z - p.z).toFixed(1),
      scr: !!a.player.loco.scrambling, rec: a.player.recoveries, st: a.player.loco.state };
  }, info.t);
  if (Math.abs(f.err) > 0.14) {
    const k = f.err > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down('KeyW'); await page.keyboard.down(k);
    await page.waitForTimeout(Math.min(420, Math.max(60, (Math.abs(f.err) / 2.6) * 1000)));
    await page.keyboard.up(k);
  }
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  console.log(i, JSON.stringify(f));
}
await page.keyboard.up('KeyW');
await browser.close();
