import { chromium } from 'playwright';
import path from 'node:path';
const PROFILE = '/tmp/ascent-profile';
const URL = 'http://127.0.0.1:4577';
const ctx = await chromium.launchPersistentContext(PROFILE, { args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'], viewport: { width: 1600, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
console.log('rifts:', JSON.stringify(await page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return { player: [Math.round(p.x), Math.round(p.y), Math.round(p.z)],
    list: a.rifts.list.map((r) => ({ id: r.id, locked: r.locked, sealed: r.sealed,
      pos: [Math.round(r.pos.x), Math.round(r.pos.y), Math.round(r.pos.z)],
      ground: Math.round(a.islandAt(r.pos.x, r.pos.z)),
      d: Math.round(Math.hypot(r.pos.x - p.x, r.pos.z - p.z)) })) };
}), null, 1));

await page.mouse.move(800, 450); await page.mouse.click(800, 450);
await page.waitForTimeout(300);
const target = await page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  const r = a.rifts.list.filter((x) => !x.locked && !x.sealed);
  let best = null, bd = 1e9;
  for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
  return { id: best.id, x: best.pos.x, y: best.pos.y, z: best.pos.z };
});
console.log('target', target);
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate((t) => {
    const a = window.__ascent, p = a.player.pos;
    const want = Math.atan2(t.x - p.x, t.z - p.z);
    let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return { yawErr: +d.toFixed(2), dist: +Math.hypot(t.x - p.x, t.z - p.z).toFixed(1),
      p: [Math.round(p.x), Math.round(p.y), Math.round(p.z)], ty: Math.round(t.y),
      ground: Math.round(a.islandAt(p.x, p.z)), speed: +Math.hypot(a.player.vel.x, a.player.vel.z).toFixed(1),
      stuckCard: !!document.querySelector('.fcs.show'), panel: !!a.panel.open };
  }, target);
  if (Math.abs(s.yawErr) > 0.06) await page.mouse.move(800 - s.yawErr * 240, 450, { steps: 2 });
  if (i % 5 === 0) console.log(i, JSON.stringify(s));
  if (s.panel) { console.log('OPENED at step', i); break; }
  await page.waitForTimeout(300);
}
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await page.screenshot({ path: 'shots/fun-reach/probe.png' });
await ctx.close();
