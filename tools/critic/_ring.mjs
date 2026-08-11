/** Close looks at the ring itself: the seal bars, and the plate on the dais. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/ring'));
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForTimeout(2600);
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));

/** Hold the cadet in the air for one frame and photograph the ring. */
async function look(name, id, dx, dy, dz, pitch) {
  for (let i = 0; i < 7; i++) {
    await p.evaluate(([id, dx, dy, dz, pitch]) => {
      const A = window.__ascent;
      const r = A.rifts.list.find((q) => q.id === id);
      const rr = Math.hypot(r.foot.x, r.foot.z) || 1;
      const ux = r.foot.x / rr, uz = r.foot.z / rr;
      A.player.pos.set(r.foot.x - ux * dz + dx, r.foot.y + dy, r.foot.z - uz * dz);
      A.player.vel.set(0, 0, 0);
      A.player.yaw = Math.atan2(r.foot.x, r.foot.z);
      A.player.pitch = pitch;
    }, [id, dx, dy, dz, pitch]);
    await p.waitForTimeout(110);
  }
  await p.screenshot({ path: path.join(OUT, name + '.png') });
}

const ids = await p.evaluate(() => ({
  shut: window.__ascent.rifts.list.find((r) => r.locked).id,
  live: window.__ascent.rifts.list.find((r) => !r.locked).id,
}));
await look('01-seal-bars', ids.shut, 0, 1.0, 15, -0.12);
await look('02-seal-bars-close', ids.shut, 0, 0.5, 9, -0.20);
await look('03-live-plate', ids.live, 0, 9.0, 15, 0.30);
await look('04-live-ring', ids.live, 0, 1.0, 15, -0.12);
await b.close();
