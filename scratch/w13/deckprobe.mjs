/**
 * What does the player module actually think the point of no return is, and how
 * long does a real walk off the coast take to be caught? Keys only.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(arg('url', 'http://127.0.0.1:4996'), { waitUntil: 'networkidle' });
await p.evaluate(() => { try { localStorage.clear(); } catch {} });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(4500);
await p.mouse.click(640, 360);

const f = () => p.evaluate(() => {
  const a = window.__ascent, q = a.player.pos;
  return {
    x: q.x, y: q.y, z: q.z,
    ground: a.islandAt(q.x, q.z), surface: a.surfaceAt(q.x, q.z),
    grounded: !!a.player.grounded, caught: a.player.caught | 0, rec: a.player.recoveries | 0,
    falling: !!a.player.falling,
  };
});

for (const run of [['KeyW'], ['KeyW', 'KeyD'], ['KeyA'], ['KeyS']]) {
  await p.keyboard.press('KeyR');
  await p.waitForTimeout(1200);
  await p.keyboard.down('ShiftLeft');
  for (const k of run) await p.keyboard.down(k);
  let off = 0, base = null;
  const t0 = Date.now();
  let caught = null;
  while ((Date.now() - t0) / 1000 < 55) {
    await p.waitForTimeout(200);
    const g = await f();
    if (!off && g.ground === null && g.surface === null) {
      off = Date.now();
      base = g;
      await p.keyboard.down('Space');
      console.log(`left the world at y=${g.y.toFixed(1)}  (${Math.hypot(g.x, g.z).toFixed(0)} m out)`);
    }
    if (off && (g.ground !== null || g.surface !== null) && g.grounded) {
      caught = (Date.now() - off) / 1000;
      console.log(`  back on solid ground after ${caught.toFixed(2)}s  falling=${g.falling}`);
      break;
    }
    if (off && (Date.now() - off) / 1000 > 12) {
      console.log(`  NOT BACK after 12s — y=${g.y.toFixed(1)}, falling=${g.falling}, caught=${g.caught}`);
      break;
    }
  }
  await p.keyboard.up('Space').catch(() => {});
  for (const k of run) await p.keyboard.up(k);
  await p.keyboard.up('ShiftLeft');
  if (!off) console.log(`(${run.join('+')}) never left the world`);
}
console.log('deck/low as the module sees it:');
console.log(await p.evaluate(async () => {
  const m = await import('/assets/' + [...document.querySelectorAll('script')].map((s) => s.src).join(''));
  return 'n/a';
}).catch(() => 'module not reachable from the page — using behaviour above'));
await b.close();
