import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:4399', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(4500);
await p.mouse.click(800, 450);
await p.keyboard.press('KeyR'); await p.waitForTimeout(1000);
await p.evaluate(() => { window.__ascent.player.yaw = (265 * Math.PI) / 180; });
await p.waitForTimeout(250); await p.mouse.click(800, 450);
await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW');
let spaced = false;
for (let i = 0; i < 90; i++) {
  await p.waitForTimeout(400);
  const f = await p.evaluate(() => {
    const a = window.__ascent, q = a.player;
    return { r: +Math.hypot(q.pos.x, q.pos.z).toFixed(0), y: +q.pos.y.toFixed(1),
      out: a.outside(q.pos.x, q.pos.y, q.pos.z), fellT: +(q._fellT ?? -1).toFixed(2),
      falling: q.falling, caught: q.caught, rec: q.recoveries, glid: q.gliding,
      air: a.islandAt(q.pos.x, q.pos.z) === null, ui: !!a.input.uiOpen || !!a.panel.open };
  });
  if (f.air && !spaced) { spaced = true; await p.keyboard.down('Space'); console.log('--- off the edge, Space down ---'); }
  if (spaced) console.log(JSON.stringify(f));
  if (f.caught > 0) { console.log('CAUGHT at poll', i); break; }
}
await b.close();
