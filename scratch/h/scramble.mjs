/** LANE H — put the cadet in the trap and hold W. Does he get out? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h-scramble'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2200);
await page.evaluate(() => { const s = window.__ascent?.session; s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  document.getElementById('boot')?.classList.add('gone'); });

const SPOTS = [[35, -91], [36, -88], [20, -110], [40, -100], [26, -120], [46, -96]];
for (const [x, z] of SPOTS) {
  const st = await page.evaluate(([x, z]) => {
    const a = window.__ascent, W = a.world;
    const h = a.islandAt(x, z);
    if (h === null) return null;
    a.player.pos.set(x, h + 0.4, z);
    a.player.vel.set(0, 0, 0);
    return { h, escapable: W.escapable(x, z), way: W.wayOut(x, z), recoveries: a.player.recoveries };
  }, [x, z]);
  if (!st) { console.log(`${x},${z}: off island`); continue; }
  await page.waitForTimeout(700);
  // face the way out (a player pushes wherever; the way out is the honest test)
  await page.evaluate((y) => { if (y !== null) window.__ascent.player.yaw = y; },
    st.way ? st.way.yaw : null);
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.keyboard.down('KeyW');
  let out = null, cam = 0;
  while ((Date.now() - t0) / 1000 < 25) {
    await page.waitForTimeout(200);
    const f = await page.evaluate(() => {
      const a = window.__ascent, W = a.world, p = a.player.pos, T = a.THREE;
      const c = new T.Vector3(); a.camera.getWorldPosition(c);
      const gc = a.islandAt(c.x, c.z);
      return { x: p.x, y: p.y, z: p.z, esc: W.escapable(p.x, p.z), scr: !!a.player.loco?.scrambling,
        rec: a.player.recoveries, camUnder: gc === null ? 0 : gc - c.y, hit: a.player.cam?._hit ?? 99 };
    });
    if (f.camUnder > cam) cam = f.camUnder;
    if (f.esc) { out = { s: (Date.now() - t0) / 1000, ...f }; break; }
    if (f.rec > st.recoveries) { out = { s: (Date.now() - t0) / 1000, viaRecover: true, ...f }; break; }
  }
  await page.keyboard.up('KeyW');
  console.log(`${x},${z}  h=${st.h.toFixed(1)} escapable=${st.escapable} wayOut=${st.way ? st.way.metres.toFixed(0) + 'm' : '-'}  ->  `
    + (out ? `OUT in ${out.s.toFixed(1)}s at ${out.x.toFixed(0)},${out.y.toFixed(0)},${out.z.toFixed(0)}${out.viaRecover ? ' (recover fired)' : ''}` : 'STILL TRAPPED after 25s')
    + `  camUnderWorst=${cam.toFixed(2)}`);
  await page.screenshot({ path: path.join(OUT, `${x}_${z}.png`) });
}
await browser.close();
